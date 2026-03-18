"""
Schedule loader and 14-day rotation planner.
Reads sprinkler_schedule.json and computes what should run today and when.
"""
import hashlib
import json
import logging
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Optional

from src.config import CONFIG

log = logging.getLogger(__name__)


def load_schedule() -> dict:
    """Load and return the raw schedule JSON. Raises on parse error."""
    path = Path(CONFIG.schedule_file)
    with open(path) as f:
        return json.load(f)


def save_schedule(schedule: dict) -> None:
    """Persist schedule JSON to disk atomically."""
    path = Path(CONFIG.schedule_file)
    tmp = path.with_suffix(".json.tmp")
    with open(tmp, "w") as f:
        json.dump(schedule, f, indent=2)
    tmp.replace(path)
    log.info("Schedule saved")


def get_schedule_day_index(reference_date: Optional[date] = None) -> int:
    """
    Return 0-based index into the 14-day schedule_days array for today.
    Uses a fixed epoch (2024-01-01) so the index is consistent across restarts.
    """
    epoch = date(2024, 1, 1)
    ref = reference_date or date.today()
    delta = (ref - epoch).days
    return delta % 14


def is_watering_day(schedule: dict, reference_date: Optional[date] = None) -> bool:
    """Return True if today's schedule slot is enabled."""
    idx = get_schedule_day_index(reference_date)
    days = schedule.get("schedule_days", [True] * 14)
    if idx >= len(days):
        return False
    return bool(days[idx])


def make_run_id(set_name: str, start_time_str: str, day: date) -> str:
    """Deterministic run ID — same input always produces the same ID (idempotency)."""
    key = f"{set_name}|{start_time_str}|{day.isoformat()}"
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def get_sets_for_time(schedule: dict, trigger_time: str,
                      reference_date: Optional[date] = None) -> list[dict]:
    """
    Return the list of sets configured for a given start time string (HH:MM),
    but only if today is a watering day and the start time is enabled.
    Returns empty list if nothing should run.
    """
    if not is_watering_day(schedule, reference_date):
        return []

    for st in schedule.get("start_times", []):
        if not st.get("enabled", True):
            continue
        if st.get("time", "") == trigger_time:
            return st.get("sets", [])

    return []


def get_upcoming_runs(schedule: dict, from_dt: Optional[datetime] = None,
                      days_ahead: int = 3) -> list[dict]:
    """
    Plan the next N days of scheduled runs for display in the UI.
    Returns a list of {set_name, scheduled_time, duration_minutes}.
    """
    runs = []
    now = from_dt or datetime.now()
    for day_offset in range(days_ahead):
        check_date = now.date() + timedelta(days=day_offset)
        if not is_watering_day(schedule, check_date):
            continue
        for st in schedule.get("start_times", []):
            if not st.get("enabled", True):
                continue
            t_str = st.get("time", "")
            try:
                t = datetime.strptime(t_str, "%H:%M").time()
            except ValueError:
                continue
            scheduled_dt = datetime.combine(check_date, t)
            if scheduled_dt <= now:
                continue
            for s in st.get("sets", []):
                if not s.get("enabled", True):
                    continue
                dur = compute_effective_minutes(s)
                runs.append({
                    "set_name": s["name"],
                    "scheduled_time": scheduled_dt.isoformat(),
                    "duration_minutes": dur,
                    "run_id": make_run_id(s["name"], t_str, check_date),
                })
    return runs


def compute_effective_minutes(set_config: dict) -> float:
    """
    Compute total wall-clock minutes for a set, accounting for pulse/soak cycles.
    """
    mode = set_config.get("mode", "normal")
    duration = float(set_config.get("duration_minutes", 0))
    if mode != "pulse_soak":
        return duration
    pulse = float(set_config.get("pulse_minutes", duration))
    soak = float(set_config.get("soak_minutes", 0))
    if pulse <= 0:
        return duration
    cycles = max(1, int(duration / pulse))
    return cycles * pulse + max(0, cycles - 1) * soak
