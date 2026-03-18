"""
Async run manager — executes a watering set with pulse/soak support.
One set runs at a time (global lock). Per-set locks prevent duplicate runs.
Reports state via shared state module throughout execution.
"""
import asyncio
import logging
from datetime import datetime
from typing import Optional

from src import state, database, gpio_controller
from src.config import CONFIG

log = logging.getLogger(__name__)

# Global lock: only one zone can water at a time
_global_run_lock = asyncio.Lock()
# Per-zone locks to prevent duplicate runs of the same zone
_zone_locks: dict[str, asyncio.Lock] = {}


def _zone_lock(zone_name: str) -> asyncio.Lock:
    if zone_name not in _zone_locks:
        _zone_locks[zone_name] = asyncio.Lock()
    return _zone_locks[zone_name]


async def run_set(set_config: dict, run_id: str, is_manual: bool = False) -> None:
    """
    Run a single watering set. Handles pulse/soak cycles.
    Acquires global lock so zones don't run concurrently.
    Skips if already executed (idempotent via DB journal).
    """
    zone_name = set_config["name"]

    # Idempotency check
    if await database.was_executed(run_id):
        log.info(f"Skipping {zone_name} run_id={run_id} — already executed")
        return

    async with _zone_lock(zone_name):
        async with _global_run_lock:
            await _execute_run(set_config, run_id, is_manual)


async def _execute_run(set_config: dict, run_id: str, is_manual: bool) -> None:
    zone_name = set_config["name"]
    mode = set_config.get("mode", "normal")
    duration_minutes = float(set_config.get("duration_minutes", 0))
    pulse_minutes = float(set_config.get("pulse_minutes", duration_minutes))
    soak_minutes = float(set_config.get("soak_minutes", 0))

    start_time = datetime.now()
    await database.record_run_start(run_id, zone_name, start_time, is_manual)
    await database.mark_executed(run_id)

    log.info(f"Starting {zone_name} | mode={mode} | duration={duration_minutes}m | run_id={run_id}")

    try:
        if mode == "pulse_soak" and pulse_minutes > 0 and soak_minutes > 0:
            await _run_pulse_soak(zone_name, run_id, duration_minutes,
                                  pulse_minutes, soak_minutes, is_manual)
        else:
            await _run_normal(zone_name, run_id, duration_minutes, is_manual)
    except asyncio.CancelledError:
        log.warning(f"Run cancelled: {zone_name} run_id={run_id}")
        await gpio_controller.set_relay(zone_name, False)
        await gpio_controller.set_led(zone_name.lower().replace(" ", "_"), "orange")
        raise
    finally:
        await gpio_controller.set_relay(zone_name, False)
        end_time = datetime.now()
        duration_sec = int((end_time - start_time).total_seconds())
        await database.record_run_end(run_id, end_time, duration_sec)
        state.clear_current_run()
        await gpio_controller.set_led(zone_name.lower().replace(" ", "_"), "off")
        log.info(f"Finished {zone_name} | {duration_sec}s elapsed | run_id={run_id}")


async def _run_normal(zone_name: str, run_id: str,
                      duration_minutes: float, is_manual: bool) -> None:
    total_seconds = int(duration_minutes * 60)
    await gpio_controller.set_relay(zone_name, True)
    await gpio_controller.set_led(zone_name.lower().replace(" ", "_"), "blue")

    state.set_current_run(
        zone_name=zone_name,
        run_id=run_id,
        total_seconds=total_seconds,
        phase="watering",
        is_manual=is_manual,
    )

    await _sleep_with_state(total_seconds, zone_name, run_id, "watering", is_manual)
    await gpio_controller.set_relay(zone_name, False)


async def _run_pulse_soak(zone_name: str, run_id: str, duration_minutes: float,
                          pulse_minutes: float, soak_minutes: float,
                          is_manual: bool) -> None:
    pulse_sec = int(pulse_minutes * 60)
    soak_sec = int(soak_minutes * 60)
    total_water_sec = int(duration_minutes * 60)
    cycles = max(1, int(total_water_sec / pulse_sec))

    log.info(f"{zone_name} pulse/soak: {cycles} cycles × {pulse_sec}s water / {soak_sec}s soak")

    for cycle in range(cycles):
        # Watering pulse
        await gpio_controller.set_relay(zone_name, True)
        await gpio_controller.set_led(zone_name.lower().replace(" ", "_"), "blue")
        state.set_current_run(
            zone_name=zone_name,
            run_id=run_id,
            total_seconds=pulse_sec,
            phase="watering",
            phase_detail=f"pulse {cycle + 1}/{cycles}",
            is_manual=is_manual,
        )
        await _sleep_with_state(pulse_sec, zone_name, run_id, "watering", is_manual)
        await gpio_controller.set_relay(zone_name, False)

        # Soak pause (skip after last cycle)
        if cycle < cycles - 1 and soak_sec > 0:
            await gpio_controller.set_led(zone_name.lower().replace(" ", "_"), "purple")
            state.set_current_run(
                zone_name=zone_name,
                run_id=run_id,
                total_seconds=soak_sec,
                phase="soaking",
                phase_detail=f"soak {cycle + 1}/{cycles - 1}",
                is_manual=is_manual,
            )
            await _sleep_with_state(soak_sec, zone_name, run_id, "soaking", is_manual)


async def _sleep_with_state(total_seconds: int, zone_name: str, run_id: str,
                             phase: str, is_manual: bool) -> None:
    """Sleep for total_seconds, updating state every second for live UI."""
    for remaining in range(total_seconds, 0, -1):
        state.update_run_remaining(remaining)
        await asyncio.sleep(1)
        if state.stop_requested():
            log.warning(f"Stop requested during {zone_name} run")
            raise asyncio.CancelledError("stop requested")


async def force_stop_all() -> None:
    """Immediately stop all watering — called by emergency stop endpoint."""
    state.request_stop()
    await gpio_controller.turn_off_all()
    state.clear_current_run()
    log.warning("Force stop all: all relays off")
