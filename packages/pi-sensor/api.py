"""
LawnBot Sensor Pi — FastAPI backend.
Replaces avg_pressure_api.py (Flask) with a modern async FastAPI app.
Reads from the same log files that SensorMonitor.py writes, so SensorMonitor
can continue running unchanged.
Also provides a WebSocket that pushes live sensor data as it arrives via MQTT.
"""
import asyncio
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

BASE_DIR = Path(__file__).parent

app = FastAPI(title="LawnBot Sensor API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Log file paths (same as SensorMonitor writes) ---
LOG_FILES = {
    "pressure":      BASE_DIR / "logs" / "avg_pressure_log.txt",
    "wind":          BASE_DIR / "logs" / "avg_wind_log.txt",
    "flow":          BASE_DIR / "logs" / "avg_flow_log.txt",
    "temperature":   BASE_DIR / "logs" / "avg_temperature_log.txt",
    "wind_direction":BASE_DIR / "logs" / "avg_wind_direction_log.txt",
    "moisture":      BASE_DIR / "logs" / "color_log.txt",
}


def _read_log_tail(path: Path, n: int) -> list[dict]:
    """Read the last n non-empty lines from a log file and parse them."""
    if not path.exists():
        return []
    try:
        lines = path.read_text().splitlines()
        lines = [l.strip() for l in lines if l.strip()][-n:]
        results = []
        for line in lines:
            try:
                if line.startswith("{"):
                    results.append(json.loads(line))
                else:
                    parts = [p.strip() for p in line.split(",")]
                    entry = {"timestamp": parts[0]}
                    for part in parts[1:]:
                        if "=" in part:
                            k, v = part.split("=", 1)
                            try:
                                entry[k.strip()] = float(v.strip())
                            except ValueError:
                                entry[k.strip()] = v.strip()
                    results.append(entry)
            except Exception:
                continue
        return results
    except Exception as e:
        log.warning(f"Error reading {path}: {e}")
        return []


# --- REST Endpoints ---

@app.get("/api/sensors/pressure")
async def get_pressure(n: int = 20):
    return _read_log_tail(LOG_FILES["pressure"], n)


@app.get("/api/sensors/wind")
async def get_wind(n: int = 20):
    return _read_log_tail(LOG_FILES["wind"], n)


@app.get("/api/sensors/flow")
async def get_flow(n: int = 20):
    return _read_log_tail(LOG_FILES["flow"], n)


@app.get("/api/sensors/temperature")
async def get_temperature(n: int = 20):
    return _read_log_tail(LOG_FILES["temperature"], n)


@app.get("/api/sensors/wind-direction")
async def get_wind_direction(n: int = 20):
    return _read_log_tail(LOG_FILES["wind_direction"], n)


@app.get("/api/sensors/moisture")
async def get_moisture(n: int = 20):
    return _read_log_tail(LOG_FILES["moisture"], n)


@app.get("/api/sensors/all-latest")
async def get_all_latest():
    """Return the single most recent reading from each sensor."""
    result = {}
    for key, path in LOG_FILES.items():
        rows = _read_log_tail(path, 1)
        result[key] = rows[0] if rows else None
    return result


@app.get("/api/status")
async def get_status():
    statuses = {}
    for key, path in LOG_FILES.items():
        statuses[key] = {
            "file": str(path),
            "exists": path.exists(),
            "size_bytes": path.stat().st_size if path.exists() else 0,
        }
    return {"status": "ok", "logs": statuses, "timestamp": datetime.now().isoformat()}


# --- WebSocket for live push ---

class SensorConnectionManager:
    def __init__(self):
        self._connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self._connections:
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


sensor_ws = SensorConnectionManager()


@app.websocket("/ws")
async def sensor_websocket(ws: WebSocket):
    await sensor_ws.connect(ws)
    try:
        # Send immediate snapshot
        await ws.send_json({"type": "snapshot", "data": await get_all_latest()})
        while True:
            try:
                msg = await asyncio.wait_for(ws.receive_text(), timeout=30.0)
                if msg == "ping":
                    await ws.send_text("pong")
            except asyncio.TimeoutError:
                await ws.send_json({"type": "snapshot", "data": await get_all_latest()})
    except WebSocketDisconnect:
        sensor_ws.disconnect(ws)


# --- MQTT subscriber for live push ---

def setup_mqtt_subscriber():
    """Subscribe to sensor MQTT topics and push to WebSocket clients."""
    import paho.mqtt.client as mqtt
    import threading

    loop = asyncio.get_event_loop()

    def on_message(client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            data = {"type": "sensor", "topic": msg.topic, "data": payload}
            if loop and not loop.is_closed():
                asyncio.run_coroutine_threadsafe(sensor_ws.broadcast(data), loop)
        except Exception as e:
            log.warning(f"MQTT parse error: {e}")

    def on_connect(client, userdata, flags, rc, properties=None):
        topics = ["sensors/environment", "sensors/sets", "sensors/plant",
                  "sensors/soil", "status/system"]
        for t in topics:
            client.subscribe(t, qos=0)
        log.info("Sensor MQTT subscriber connected")

    try:
        client = mqtt.Client(
            client_id="lawnbot_sensor_api",
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        )
        client.on_connect = on_connect
        client.on_message = on_message
        client.connect("100.116.147.6", 1883, keepalive=60)
        t = threading.Thread(target=client.loop_forever, daemon=True)
        t.start()
        log.info("MQTT subscriber started")
    except Exception as e:
        log.warning(f"MQTT subscriber failed to connect: {e} — will retry on next restart")


@app.on_event("startup")
async def on_startup():
    setup_mqtt_subscriber()
    log.info("Sensor API started")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
