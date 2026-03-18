"""
In-memory shared state for the current watering run.
Single source of truth — no global dicts scattered across modules.
Thread/async-safe via asyncio (single-threaded event loop).
"""
import threading
from datetime import datetime
from typing import Optional

_lock = threading.Lock()

_current_run: Optional[dict] = None
_stop_flag: bool = False


def set_current_run(
    zone_name: str,
    run_id: str,
    total_seconds: int,
    phase: str,
    phase_detail: str = "",
    is_manual: bool = False,
    start_time: Optional[datetime] = None,
) -> None:
    global _current_run
    with _lock:
        _current_run = {
            "zone_name": zone_name,
            "run_id": run_id,
            "total_seconds": total_seconds,
            "remaining_seconds": total_seconds,
            "phase": phase,
            "phase_detail": phase_detail,
            "is_manual": is_manual,
            "start_time": (start_time or datetime.now()).isoformat(),
        }


def update_run_remaining(remaining: int) -> None:
    global _current_run
    with _lock:
        if _current_run is not None:
            _current_run["remaining_seconds"] = remaining


def clear_current_run() -> None:
    global _current_run, _stop_flag
    with _lock:
        _current_run = None
        _stop_flag = False


def get_current_run() -> Optional[dict]:
    with _lock:
        return dict(_current_run) if _current_run else None


def request_stop() -> None:
    global _stop_flag
    with _lock:
        _stop_flag = True


def stop_requested() -> bool:
    with _lock:
        return _stop_flag
