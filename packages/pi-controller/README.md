# pi-controller

FastAPI backend running on the **Controller Pi**. This is the hub of the entire LawnBot system — it controls GPIO relays, manages the 14-day watering schedule, serves the React web UI, and provides the REST + WebSocket API consumed by both the web and mobile apps.

## Responsibilities

- Drive GPIO relays to open/close irrigation valves
- Run the 14-day rotating watering schedule
- Execute manual zone runs on demand
- Auto-mist when ambient temperature exceeds a threshold
- Publish and subscribe to MQTT for sensor data and status broadcasts
- Store watering history and sensor readings in SQLite
- Serve the built React web app as a static SPA at `/`
- Push live status updates to all clients every 2 seconds via WebSocket

## Running locally (mock mode)

The system automatically detects when it is not running on a Raspberry Pi and enables **mock GPIO mode** — relays are simulated in memory, no hardware access occurs.

```bash
cd packages/pi-controller
pip install -r requirements.txt
python main.py
```

API available at `http://localhost:8000`. Web UI served if `packages/web/dist/` exists (run `pnpm build:web` first).

## Running on the Pi

Managed by systemd. Deploy via the root `deploy-all.sh` script, then:

```bash
sudo systemctl start lawnbot-controller
sudo systemctl status lawnbot-controller
journalctl -u lawnbot-controller -f   # live logs
```

Service file: `systemd/lawnbot-controller.service`
Working directory on Pi: `/home/lds00/lawnbot/`

## Configuration

`config/config.json` — edit this file to change pins, MQTT broker, sensor Pi host, etc.

| Key | Default | Description |
|---|---|---|
| `device_id` | `"controller_pi"` | MQTT client identity |
| `mqtt.broker_host` | `"localhost"` | Mosquitto runs on the same Pi |
| `mqtt.broker_port` | `1883` | Standard MQTT port |
| `api.host` | `"0.0.0.0"` | Listen on all interfaces |
| `api.port` | `8000` | HTTP port |
| `gpio.relays` | `{Hanging Pots:17, Garden:27, Misters:22}` | Zone name → GPIO pin |
| `gpio.leds` | `{system:5, hanging_pots:6, garden:13, misters:19}` | LED GPIO pins |
| `gpio.mock` | `false` | Force mock mode (auto-set on non-Pi) |
| `sensor_pi.host` | `"100.117.254.20"` | Sensor Pi Tailscale IP |
| `sensor_pi.api_port` | `8001` | Sensor Pi FastAPI port |
| `database_path` | `"/home/lds00/lawnbot/lawnbot.db"` | SQLite file path |
| `schedule_file` | `"/home/lds00/lawnbot/sprinkler_schedule.json"` | Schedule JSON path |
| `misters_overlap` | `true` | Allow Misters to run alongside other zones |

## Module reference

### `main.py` — Entry point

Bootstraps all subsystems and starts six async background tasks:

| Task | Interval | Purpose |
|---|---|---|
| `schedule_loop_task` | 30 seconds | Fires `run_set()` when scheduled time matches |
| `mist_manager_task` | Configurable | Auto-mists when temperature ≥ threshold |
| `heartbeat_task` | 30 seconds | Publishes Pi health metrics to MQTT |
| `ws_broadcaster_task` | 2 seconds | Pushes status to all WebSocket clients |
| `db_maintenance_task` | 1 hour | Prunes old history and sensor data |
| `status_publisher_task` | 2 seconds | Publishes status to MQTT `status/watering` |

### `api.py` — FastAPI application

Defines all routes. See [ARCHITECTURE.md](../../ARCHITECTURE.md#api-reference) for the full endpoint table.

Key exports:
- `app` — the FastAPI instance (imported by `main.py` for uvicorn)
- `_build_status()` — assembles the full system status dict used by both `/api/status` and the WebSocket broadcaster

### `src/scheduler.py` — Schedule engine

- `load_schedule()` / `save_schedule()` — read/write `sprinkler_schedule.json`
- `get_schedule_day_index()` — returns 0–13 based on days since 2024-01-01
- `is_watering_day()` — checks `schedule_days[today_index]`
- `make_run_id()` — SHA-256 idempotency key from `zone|time|date`
- `get_upcoming_runs()` — preview of next 3 days' runs
- `get_sets_for_time()` — returns sets that should fire right now

### `src/run_manager.py` — Watering execution

- `run_set()` — public entry point; handles locking and idempotency check
- `force_stop_all()` — immediate emergency stop
- Supports two watering modes:
  - **Normal** — open relay for full duration
  - **Pulse/Soak** — cycle: open N seconds → close N seconds → repeat

### `src/gpio_controller.py` — Hardware abstraction

- `set_relay(zone_name, on)` — asyncio-locked relay toggle
- `turn_off_all()` — cuts every relay immediately
- `set_led(zone_name, color)` — LED status indicator
- In mock mode: all operations update in-memory state only, no GPIO calls

### `src/mqtt_handler.py` — MQTT client

- Subscribes to all `sensors/*` and `status/*` topics from the Sensor Pi
- Caches latest payload per topic in a dict (`_latest`)
- Stores incoming readings to SQLite via `database.store_sensor_reading()`
- Publishes `status/watering` (retained) and `sensors/heartbeat` (retained, QoS 1)

### `src/state.py` — In-memory run state

Thread-safe store for the currently active run. Read by `_build_status()`, written by `run_manager.py`. The stop flag is the signal path from `/api/stop-all` to the running watering loop.

### `src/database.py` — SQLite layer

Four tables:

| Table | Purpose |
|---|---|
| `watering_history` | Permanent log of every run (start, end, duration, manual flag) |
| `run_journal` | Idempotency — tracks `enqueued` and `executed` stages per `run_id` |
| `sensor_readings` | Rolling 48-hour cache of MQTT sensor payloads |
| `system_metrics` | Pi system health snapshots |

### `src/models.py` — Pydantic models

Validates all API request and response bodies. Mirrors `shared/types/index.ts` for TypeScript clients.

Key models: `Schedule`, `ScheduleSet`, `StartTime`, `MistSettings`, `ManualRunRequest`, `CurrentRun`, `NextRun`, `ZoneState`, `HistoryEntry`.

### `src/config.py` — Configuration

Loads `config/config.json` once at import time into a typed `AppConfig` dataclass. Exported as `CONFIG` — imported by every other module.

## Database schema

```sql
CREATE TABLE watering_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT UNIQUE NOT NULL,
    set_name TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    duration_seconds INTEGER,
    is_manual INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0
);

CREATE TABLE run_journal (
    run_id TEXT NOT NULL,
    stage TEXT NOT NULL,   -- 'enqueued' or 'executed'
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (run_id, stage)
);

CREATE TABLE sensor_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recorded_at TEXT DEFAULT (datetime('now')),
    topic TEXT NOT NULL,
    payload TEXT NOT NULL   -- JSON
);

CREATE TABLE system_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recorded_at TEXT DEFAULT (datetime('now')),
    cpu_temp_c REAL,
    cpu_percent REAL,
    memory_percent REAL,
    disk_percent REAL,
    uptime_seconds INTEGER
);
```

## Zones

| Zone | GPIO Relay Pin | LED Pin | Use |
|---|---|---|---|
| Hanging Pots | 17 | 6 | Drip irrigation for container plants |
| Garden | 27 | 13 | Garden bed spray |
| Misters | 22 | 19 | Evaporative cooling / auto-mist |
| System | — | 5 | Overall system status LED |
