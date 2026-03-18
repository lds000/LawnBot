"""
FastAPI application — replaces Flask + flask_api.py.
Serves REST endpoints and a WebSocket for real-time status push.
Also serves the built React web app as static files at /app.
"""
import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from src import database, gpio_controller, mqtt_handler, run_manager, scheduler, state
from src.config import CONFIG
from src.models import (
    HistoryEntry,
    ManualRunRequest,
    Schedule,
    ScheduleUpdateRequest,
    SystemStatusResponse,
    ZoneState,
    NextRun,
    CurrentRun,
)

log = logging.getLogger(__name__)

app = FastAPI(title="LawnBot Controller API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root_redirect():
    return RedirectResponse(url="/app/")

# --- WebSocket connection manager ---

class ConnectionManager:
    def __init__(self):
        self._connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._connections.append(ws)

    def disconnect(self, ws: WebSocket):
        self._connections.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self._connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections.remove(ws)


ws_manager = ConnectionManager()

# Track last completed run for status
_last_completed_run: Optional[dict] = None
_active_run_task: Optional[asyncio.Task] = None
_mist_active_until: float = 0.0


def _is_misting() -> bool:
    import time
    return time.time() < _mist_active_until


def _build_status() -> dict:
    """Build the full system status payload."""
    current = state.get_current_run()
    relay_states = gpio_controller.get_relay_states()

    zone_states = []
    for zone_name, relay_on in relay_states.items():
        status = "idle"
        if relay_on and current and current["phase"] == "watering":
            status = "watering"
        elif relay_on and current and current["phase"] == "soaking":
            status = "soaking"
        zone_states.append({"name": zone_name, "relay_on": relay_on, "status": status})

    try:
        sched = scheduler.load_schedule()
        today_watering = scheduler.is_watering_day(sched)
        day_index = scheduler.get_schedule_day_index()
        upcoming = scheduler.get_upcoming_runs(sched)
        next_run = upcoming[0] if upcoming else None
    except Exception:
        sched = {}
        today_watering = False
        day_index = 0
        upcoming = []
        next_run = None

    return {
        "system_status": "Watering" if current else "All Systems Nominal",
        "test_mode": CONFIG.gpio.mock,
        "current_run": current,
        "next_run": next_run,
        "last_completed_run": _last_completed_run,
        "upcoming_runs": upcoming[:5],
        "zone_states": zone_states,
        "today_is_watering_day": today_watering,
        "schedule_day_index": day_index,
        "is_misting": _is_misting(),
        "timestamp": datetime.now().isoformat(),
    }


# --- REST Endpoints ---

@app.get("/api/status")
async def get_status():
    return _build_status()


@app.get("/api/schedule")
async def get_schedule():
    try:
        return scheduler.load_schedule()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/schedule")
async def update_schedule(req: ScheduleUpdateRequest):
    try:
        scheduler.save_schedule(req.schedule.model_dump())
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/zones/{zone_name}/run")
async def manual_run(zone_name: str, req: ManualRunRequest):
    global _active_run_task
    if state.get_current_run():
        raise HTTPException(status_code=409, detail="A zone is already running")

    # Find set config or build a simple one
    set_config = {"name": zone_name, "duration_minutes": req.duration_minutes, "mode": "normal"}
    run_id = f"manual_{zone_name}_{int(datetime.now().timestamp())}"
    await database.mark_enqueued(run_id)

    _active_run_task = asyncio.create_task(
        run_manager.run_set(set_config, run_id, is_manual=True)
    )
    log.info(f"Manual run started: {zone_name} for {req.duration_minutes}m")
    return {"ok": True, "run_id": run_id}


@app.post("/api/stop-all")
async def stop_all():
    await run_manager.force_stop_all()
    if _active_run_task and not _active_run_task.done():
        _active_run_task.cancel()
    return {"ok": True}


@app.get("/api/history")
async def get_history(limit: int = 50):
    rows = await database.get_history(limit)
    return rows


@app.get("/api/zones")
async def get_zones():
    relay_states = gpio_controller.get_relay_states()
    return [
        {"name": name, "relay_on": on, "gpio_pin": CONFIG.gpio.relays[name]}
        for name, on in relay_states.items()
    ]


@app.get("/api/sensors/latest")
async def get_sensors_latest():
    return {
        "environment": mqtt_handler.get_latest("sensors/environment"),
        "flow_pressure": mqtt_handler.get_latest("sensors/sets"),
        "plant": mqtt_handler.get_latest("sensors/plant"),
        "system": mqtt_handler.get_latest("status/system"),
        "online": mqtt_handler.get_latest("sensors/environment") is not None,
    }


@app.get("/api/sensors/history/{topic_suffix}")
async def get_sensor_history(topic_suffix: str, limit: int = 100):
    topic_map = {
        "environment": "sensors/environment",
        "flow": "sensors/sets",
        "plant": "sensors/plant",
    }
    topic = topic_map.get(topic_suffix)
    if not topic:
        raise HTTPException(status_code=404, detail="Unknown sensor topic")
    rows = await database.get_sensor_history(topic, limit)
    return rows


@app.get("/api/system/metrics")
async def get_system_metrics():
    try:
        import psutil
        import subprocess
        cpu_temp = None
        try:
            result = subprocess.run(["vcgencmd", "measure_temp"], capture_output=True, text=True)
            cpu_temp = float(result.stdout.strip().replace("temp=", "").replace("'C", ""))
        except Exception:
            pass
        return {
            "cpu_temp_c": cpu_temp,
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage("/").percent,
            "uptime_seconds": int(datetime.now().timestamp() - psutil.boot_time()),
        }
    except Exception as e:
        return {"error": str(e)}


# --- WebSocket ---

@app.websocket("/ws")
async def websocket_status(ws: WebSocket):
    await ws_manager.connect(ws)
    log.info(f"WebSocket connected: {ws.client}")
    try:
        # Send immediate status on connect
        await ws.send_json({"type": "status", "data": _build_status()})
        # Keep alive — client sends pings, we echo
        while True:
            try:
                msg = await asyncio.wait_for(ws.receive_text(), timeout=30.0)
                if msg == "ping":
                    await ws.send_text("pong")
            except asyncio.TimeoutError:
                await ws.send_json({"type": "status", "data": _build_status()})
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
        log.info(f"WebSocket disconnected: {ws.client}")


# Serve the built React web app
# Check relative path first (dev), then absolute Pi path
_web_dist_rel = Path(__file__).parent.parent.parent / "web" / "dist"
_web_dist_abs = Path("/home/lds00/web/dist")
_web_dist = _web_dist_abs if _web_dist_abs.exists() else _web_dist_rel

if _web_dist.exists():
    # Mount static assets (JS, CSS, images) — no html=True so unknown paths don't 404
    app.mount("/app/assets", StaticFiles(directory=str(_web_dist / "assets")), name="web-assets")

    # Catch-all for SPA: serve index.html for any /app/* route not matched above
    @app.get("/app/{full_path:path}")
    async def serve_spa(full_path: str):
        # Serve real files (favicon, icons, etc.) if they exist
        candidate = _web_dist / full_path
        if candidate.exists() and candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(_web_dist / "index.html"))


# --- Background tasks (started from main.py) ---

async def ws_broadcaster_task():
    """Push status to all WebSocket clients every 2 seconds."""
    while True:
        if ws_manager._connections:
            await ws_manager.broadcast({"type": "status", "data": _build_status()})
        await asyncio.sleep(2)


async def db_maintenance_task():
    """Run periodic DB cleanup tasks."""
    while True:
        await asyncio.sleep(3600)  # every hour
        await database.prune_history(days=30)
        await database.prune_sensor_readings(hours=48)
