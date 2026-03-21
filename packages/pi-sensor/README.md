# pi-sensor

FastAPI backend running on the **Sensor Pi**. Reads environmental and irrigation sensor data from log files written by the hardware monitoring process, publishes readings to MQTT, and serves a REST + WebSocket API.

## Responsibilities

- Read averaged sensor readings from flat log files written by `SensorMonitor.py`
- Publish incoming MQTT messages to connected WebSocket clients in real time
- Subscribe to the MQTT broker on the Controller Pi and forward messages
- Expose per-sensor HTTP endpoints for historical readings

## Running on the Pi

Managed by systemd:

```bash
sudo systemctl start lawnbot-sensor
sudo systemctl status lawnbot-sensor
journalctl -u lawnbot-sensor -f
```

Service file: `systemd/lawnbot-sensor.service`
Working directory on Pi: `/home/lds00/ColorSensorTest/`
Port: **8001**

## Sensor data sources

Sensor readings are written to log files by an external process (`SensorMonitor.py`). The API reads these files on demand.

| Sensor | Log file |
|---|---|
| Pressure | `logs/avg_pressure_log.txt` |
| Wind speed | `logs/avg_wind_log.txt` |
| Flow rate | `logs/avg_flow_log.txt` |
| Temperature | `logs/avg_temperature_log.txt` |
| Wind direction | `logs/avg_wind_direction_log.txt` |
| Plant moisture | `logs/color_log.txt` |

Log entries are either JSON (`{...}`) or CSV (`timestamp, key=value, ...`) format. The parser handles both gracefully and skips unparseable lines.

## REST API

Base URL: `http://100.117.254.20:8001`

All endpoints accept an optional `?n=` query parameter (default 20) for how many tail entries to return.

| Method | Endpoint | Returns |
|---|---|---|
| `GET` | `/api/sensors/pressure` | Last N pressure readings |
| `GET` | `/api/sensors/wind` | Last N wind speed readings |
| `GET` | `/api/sensors/flow` | Last N flow rate readings |
| `GET` | `/api/sensors/temperature` | Last N temperature readings |
| `GET` | `/api/sensors/wind-direction` | Last N wind direction readings |
| `GET` | `/api/sensors/moisture` | Last N plant moisture readings |
| `GET` | `/api/sensors/all-latest` | Single most-recent value from each sensor |
| `GET` | `/api/status` | Health check — log file existence and sizes |

## WebSocket

`ws://100.117.254.20:8001/ws`

- On connect: sends `{type: "snapshot", data: {<all-latest>}}`
- Stays alive via 30-second ping/pong
- Live push: when the MQTT subscriber receives a message, it broadcasts `{type: "sensor", topic: "...", data: {...}}` to all connected WebSocket clients

## MQTT

The Sensor Pi both publishes and relays MQTT:

**Subscribes to** (on Controller Pi broker at `100.116.147.6:1883`):
- `sensors/environment`
- `sensors/sets`
- `sensors/plant`
- `sensors/soil`
- `status/system`

Incoming messages are forwarded directly to WebSocket clients — the Sensor Pi acts as a bridge between the MQTT bus and browser/app WebSocket connections.

**Publishes:**
The `SensorMonitor.py` process (external to this API) publishes raw sensor readings to MQTT. This API reads those readings from log files rather than subscribing to them directly.

## Data flow

```
Hardware sensors
  └─ SensorMonitor.py
      ├─ writes averaged readings to log files
      └─ publishes to MQTT broker (Controller Pi)

pi-sensor/api.py
  ├─ GET /api/sensors/* → reads log files → returns JSON
  ├─ MQTT subscriber thread → forwards to WebSocket clients
  └─ GET /api/sensors/all-latest → reads all log files → single snapshot

Controller Pi mqtt_handler.py
  └─ subscribes to sensors/* → caches in memory → stores in SQLite
      └─ → api.py GET /api/sensors/latest (consumed by web + mobile)
```

## Notes

- The Sensor Pi is accessed by the Controller Pi via Tailscale IP `100.117.254.20`
- The primary sensor data path for the web and mobile apps goes through the **Controller Pi's** `/api/sensors/latest` endpoint (MQTT-based), not this API directly
- This API is the source of truth for raw/historical sensor logs and is also consumed by the Sensor Pi's own WebSocket clients
