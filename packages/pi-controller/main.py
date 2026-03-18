"""
LawnBot Controller Pi — main entry point.
Initializes GPIO, database, MQTT, and starts the FastAPI server.
Also runs the background scheduler loop that fires watering at configured times.
"""
import asyncio
import json
import logging
import signal
import time
from datetime import datetime, date
from pathlib import Path

import uvicorn

from src.config import CONFIG
from src import database, gpio_controller, mqtt_handler, run_manager, scheduler, state
from api import app, ws_broadcaster_task, db_maintenance_task

logging.basicConfig(
    level=getattr(logging, CONFIG.log_level, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger(__name__)


# --- Mist manager ---

_mist_active_until: float = 0.0


async def mist_manager_task() -> None:
    """
    Check temperature periodically and activate misters when hot enough.
    Temperature is read from the latest MQTT environment reading.
    """
    while True:
        try:
            sched = scheduler.load_schedule()
            mist = sched.get("mist_settings", {})
            if not mist.get("enabled", False):
                await asyncio.sleep(60)
                continue

            interval_sec = mist.get("check_interval_minutes", 20) * 60
            trigger_f = mist.get("trigger_temp_f", 95.0)
            duration_sec = mist.get("duration_seconds", 60)

            env = mqtt_handler.get_latest("sensors/environment")
            if env:
                data = env.get("data", env)
                temp_c = data.get("temperature_c") or data.get("temperature")
                if temp_c is not None:
                    temp_f = temp_c * 9 / 5 + 32
                    if temp_f >= trigger_f:
                        log.info(f"Mist trigger: {temp_f:.1f}°F >= {trigger_f}°F")
                        set_config = {
                            "name": "Misters",
                            "duration_minutes": duration_sec / 60,
                            "mode": "normal",
                        }
                        run_id = f"mist_{int(time.time())}"
                        await database.mark_enqueued(run_id)
                        asyncio.create_task(
                            run_manager.run_set(set_config, run_id, is_manual=False)
                        )

            await asyncio.sleep(interval_sec)
        except Exception as e:
            log.error(f"Mist manager error: {e}")
            await asyncio.sleep(60)


# --- Schedule loop ---

async def schedule_loop_task() -> None:
    """
    Main scheduling loop — checks every 30 seconds whether any configured
    start times match now, and queues runs if so.
    Uses run_id idempotency to prevent double-firing.
    """
    log.info("Schedule loop started")
    while True:
        try:
            sched = scheduler.load_schedule()
            now = datetime.now()
            time_str = now.strftime("%H:%M")
            today = date.today()

            sets = scheduler.get_sets_for_time(sched, time_str)
            for set_config in sets:
                if not set_config.get("enabled", True):
                    continue
                run_id = scheduler.make_run_id(set_config["name"], time_str, today)
                if await database.was_enqueued(run_id):
                    continue
                log.info(f"Scheduling {set_config['name']} at {time_str} run_id={run_id}")
                await database.mark_enqueued(run_id)
                asyncio.create_task(
                    run_manager.run_set(set_config, run_id, is_manual=False)
                )
        except Exception as e:
            log.error(f"Schedule loop error: {e}")

        await asyncio.sleep(30)


# --- Heartbeat task ---

async def heartbeat_task() -> None:
    """Publish system health metrics to MQTT every 30 seconds."""
    while True:
        try:
            import psutil
            import subprocess
            cpu_temp = None
            try:
                r = subprocess.run(["vcgencmd", "measure_temp"], capture_output=True, text=True)
                cpu_temp = float(r.stdout.strip().replace("temp=", "").replace("'C", ""))
            except Exception:
                pass

            metrics = {
                "cpu_temp_c": cpu_temp,
                "cpu_percent": psutil.cpu_percent(interval=1),
                "memory_percent": psutil.virtual_memory().percent,
                "disk_percent": psutil.disk_usage("/").percent,
                "uptime_seconds": int(time.time() - psutil.boot_time()),
                "status": "ok",
            }
            mqtt_handler.publish_heartbeat(metrics)
        except Exception as e:
            log.warning(f"Heartbeat error: {e}")
        await asyncio.sleep(30)


# --- Startup / shutdown ---

async def startup() -> None:
    log.info("LawnBot Controller starting up...")
    await database.init_db()
    await gpio_controller.initialize()
    loop = asyncio.get_running_loop()
    mqtt_handler.setup_mqtt(loop)

    # Ensure schedule file exists
    sched_path = Path(CONFIG.schedule_file)
    if not sched_path.exists():
        sched_path.parent.mkdir(parents=True, exist_ok=True)
        default = {
            "start_times": [],
            "schedule_days": [True] * 14,
            "mist_settings": {
                "enabled": False,
                "trigger_temp_f": 95.0,
                "duration_seconds": 60,
                "check_interval_minutes": 20,
            },
        }
        sched_path.write_text(json.dumps(default, indent=2))
        log.info("Created default schedule file")

    log.info("Startup complete")


async def shutdown() -> None:
    log.info("Shutting down...")
    await run_manager.force_stop_all()
    mqtt_handler.stop_mqtt()
    await gpio_controller.cleanup()
    log.info("Shutdown complete")


async def main() -> None:
    await startup()

    # Register background tasks
    tasks = [
        asyncio.create_task(schedule_loop_task()),
        asyncio.create_task(mist_manager_task()),
        asyncio.create_task(heartbeat_task()),
        asyncio.create_task(ws_broadcaster_task()),
        asyncio.create_task(db_maintenance_task()),
        asyncio.create_task(
            mqtt_handler.status_publisher_task(_build_status_sync)
        ),
    ]

    config = uvicorn.Config(
        app,
        host=CONFIG.api.host,
        port=CONFIG.api.port,
        log_level=CONFIG.log_level.lower(),
    )
    server = uvicorn.Server(config)

    try:
        await server.serve()
    finally:
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await shutdown()


def _build_status_sync() -> dict:
    """Sync wrapper for MQTT status publisher."""
    from api import _build_status
    return _build_status()


if __name__ == "__main__":
    asyncio.run(main())
