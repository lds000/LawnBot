# LawnBot — System Architecture

## System diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LawnBot System                                    │
│                                                                          │
│  ┌──────────────────────────────────────────────────┐                   │
│  │             Controller Pi  (100.116.147.6)        │                   │
│  │                                                    │                   │
│  │  ┌─────────────┐   ┌────────────┐  ┌──────────┐  │                   │
│  │  │  FastAPI    │   │  Scheduler │  │  GPIO    │  │                   │
│  │  │  :8000      │   │  (14-day)  │  │  Relays  │  │                   │
│  │  │             │   └─────┬──────┘  └────┬─────┘  │                   │
│  │  │  REST API   │         │ run_set()     │ pins   │                   │
│  │  │  WebSocket  │   ┌─────▼──────┐  ┌────▼─────┐  │                   │
│  │  │  SPA host   │   │ RunManager │  │  Zones   │  │                   │
│  │  └──────┬──────┘   └────────────┘  │ HP/G/M   │  │                   │
│  │         │          ┌────────────┐  └──────────┘  │                   │
│  │         │          │  SQLite DB │                  │                   │
│  │         │          │  lawnbot.db│                  │                   │
│  │         │          └────────────┘                  │                   │
│  │         │          ┌────────────┐                  │                   │
│  │         │          │ MQTT Client│◄─────────────────┼────────────────┐ │
│  │         │          │  :1883     │                  │                │ │
│  │         │          └────────────┘                  │                │ │
│  └─────────┼──────────────────────────────────────────┘                │ │
│            │                                                            │ │
│            │ HTTP + WS                                                  │ │
│    ┌───────┴──────┐    ┌───────────────┐                               │ │
│    │  Web App     │    │  Mobile App   │                               │ │
│    │  (browser)   │    │  (Expo RN)    │                               │ │
│    │  served from │    │  LAN/Tailscale│                               │ │
│    │  Controller  │    └───────────────┘                               │ │
│    └──────────────┘                                                     │ │
│                                                                         │ │
│  ┌──────────────────────────────────────┐                               │ │
│  │        Sensor Pi  (100.117.254.20)   │  MQTT publish                 │ │
│  │                                       │──────────────────────────────┘ │
│  │  SensorMonitor.py  →  log files       │  topics: sensors/environment    │
│  │  FastAPI :8001      →  /api/sensors/  │          sensors/sets           │
│  │  MQTT publisher                       │          sensors/plant           │
│  └──────────────────────────────────────┘          status/system           │
│                                                                             │
│  ┌──────────────────────────────────────┐                                  │
│  │  Mosquitto MQTT Broker (on Ctrl Pi)  │◄─────────────────────────────────┘
│  │  localhost:1883                       │
│  └──────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component responsibilities

### Controller Pi (`packages/pi-controller`)

The hub of the entire system. Runs one Python process (`main.py → uvicorn`) that manages:

| Component | File | Responsibility |
|---|---|---|
| HTTP/WS server | `api.py` | REST API, WebSocket, SPA static file serving |
| Schedule loop | `main.py` | Polls every 30s; fires `run_set()` when `HH:MM` matches |
| Run manager | `src/run_manager.py` | Async execution, pulse/soak cycles, countdown, cancellation |
| GPIO driver | `src/gpio_controller.py` | Relay + LED control; mock mode on non-Pi hardware |
| Scheduler | `src/scheduler.py` | 14-day rotation, idempotency keys, upcoming run preview |
| MQTT handler | `src/mqtt_handler.py` | Subscribe to sensor topics, publish status/heartbeat |
| Database | `src/database.py` | Async SQLite via aiosqlite; history, idempotency, sensor cache |
| State | `src/state.py` | Thread-safe in-memory current-run + stop flag |
| Config | `src/config.py` | Typed singleton from `config/config.json` |
| Mist manager | `main.py` | Checks temperature; auto-triggers Misters zone |

### Sensor Pi (`packages/pi-sensor`)

Dedicated sensor node. Runs independently from the Controller Pi.

| Component | Responsibility |
|---|---|
| `SensorMonitor.py` | (External process) Reads hardware sensors, writes to log files |
| `api.py` | FastAPI on port 8001; reads log files + publishes to MQTT; WebSocket for live data |

### Web app (`packages/web`)

Single-page React app, built by Vite and served directly from the Controller Pi at `/`.

| Route | Page | Key functionality |
|---|---|---|
| `/` | Dashboard | Live zone status, sensor gauges, manual run/stop, schedule summary |
| `/schedule` | Schedule | 14-day rotation editor, start times, pulse/soak config, mist settings |
| `/history` | History | Paginated watering run log |
| `/sensors` | Sensors | Live sensor gauges + historical trend charts |
| `/weather` | Weather | Full-screen animated instrument panel (thermometer, compass, dials) |
| `/settings` | Settings | Pi system health metrics, connection info |

### Mobile app (`packages/mobile`)

Expo React Native app, connects to the Controller Pi over local network or Tailscale VPN.

| Tab | Screen | Key functionality |
|---|---|---|
| Dashboard | `index.tsx` | Zone cards, manual run/stop, live status |
| Schedule | `schedule.tsx` | Schedule viewer/editor |
| History | `history.tsx` | Watering run log |
| Sensors | `sensors.tsx` | Sensor metric tiles |
| Weather | `weather.tsx` | Animated gauge instruments |

---

## Data flows

### Scheduled watering run

```
main.py schedule_loop_task (every 30s)
  │
  ├─ scheduler.get_sets_for_time(schedule, "HH:MM")
  │   └─ returns list of ScheduleSet configs if today is watering day
  │
  ├─ database.was_executed(run_id)  →  skip if already ran today
  │
  └─ run_manager.run_set(set_config, run_id)
      ├─ database.mark_executed(run_id)
      ├─ state.set_current_run(...)
      ├─ gpio_controller.set_relay(zone, True)
      ├─ _sleep_with_state(duration_sec)
      │   └─ state.update_run_remaining(remaining)  ← every second
      ├─ gpio_controller.set_relay(zone, False)
      ├─ database.record_run_end(...)
      └─ state.clear_current_run()
```

### Live status delivery to clients

```
api.py ws_broadcaster_task (every 2s)
  │
  └─ _build_status()
      ├─ state.get_current_run()
      ├─ gpio_controller.get_relay_states()
      ├─ scheduler.get_upcoming_runs(schedule)
      └─ ws_manager.broadcast({type: "status", data: {...}})
          └─ → all connected WebSocket clients (web + mobile)
```

### Sensor data flow

```
SensorMonitor.py (Sensor Pi)
  └─ writes to log files (avg_pressure_log.txt, avg_wind_log.txt, ...)

pi-sensor/api.py
  ├─ reads log files on demand (GET /api/sensors/*)
  └─ publishes to MQTT on receive:
      sensors/environment, sensors/sets, sensors/plant, sensors/soil

Mosquitto broker (Controller Pi, localhost:1883)
  └─ routes messages to subscribers

mqtt_handler.py (Controller Pi)
  ├─ caches latest payload per topic in _latest dict
  └─ stores in SQLite via database.store_sensor_reading()

api.py GET /api/sensors/latest
  └─ returns mqtt_handler.get_latest() for each topic

Web/Mobile clients
  └─ poll /api/sensors/latest every 5–10 seconds
```

### Manual run (web or mobile)

```
User clicks "Run" on a zone card
  │
  └─ POST /api/zones/{zone_name}/run  { duration_minutes: N }
      ├─ checks state.get_current_run() → 409 if busy
      ├─ database.mark_enqueued(run_id)
      └─ asyncio.create_task(run_manager.run_set(..., is_manual=True))
          └─ same execution path as scheduled run
```

### Emergency stop

```
User clicks "Stop All"
  │
  └─ POST /api/stop-all
      └─ run_manager.force_stop_all()
          ├─ state.request_stop()         ← sets stop flag
          ├─ gpio_controller.turn_off_all() ← immediately cuts all relays
          └─ _active_run_task.cancel()    ← cancels the asyncio task
              └─ _sleep_with_state polls stop_requested() each second
                  └─ raises CancelledError → finally block clears state
```

### Auto-mist flow

```
main.py mist_manager_task (every N minutes, configured)
  │
  └─ mqtt_handler.get_latest("sensors/environment")
      └─ if temperature_c * 9/5 + 32 >= trigger_temp_f:
          └─ run_manager.run_set(misters_config, run_id, is_manual=False)
```

---

## API reference

Base URL: `http://<controller-pi>:8000`

All data endpoints are under `/api/`. The web app uses relative `/api/` paths since it is served from the same origin.

### Status & control

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/status` | Full system snapshot (zones, current run, next run, schedule day) |
| `POST` | `/api/zones/{zone_name}/run` | Start a manual run — body: `{duration_minutes}` |
| `POST` | `/api/stop-all` | Emergency stop all zones immediately |
| `GET` | `/api/zones` | List zones with relay state and GPIO pin |
| `WS` | `/ws` | WebSocket — pushes `{type:"status", data:{...}}` every 2 seconds |

### Schedule

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/schedule` | Load schedule from `sprinkler_schedule.json` |
| `PUT` | `/api/schedule` | Save schedule — body: `{schedule: Schedule}` |

### History

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/history?limit=50` | Last N watering runs from SQLite |

### Sensors

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/sensors/latest` | Latest MQTT readings (environment, flow_pressure, plant, system) |
| `GET` | `/api/sensors/history/environment?limit=60` | DB-stored environment sensor history |
| `GET` | `/api/sensors/history/flow?limit=60` | DB-stored flow/pressure history |
| `GET` | `/api/sensors/history/plant?limit=60` | DB-stored plant moisture history |

### System

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/system/metrics` | Live Pi system health (CPU temp, CPU %, memory %, disk %, uptime) |

---

## MQTT topic map

| Topic | Publisher | Subscriber | Payload |
|---|---|---|---|
| `sensors/environment` | Sensor Pi | Controller Pi | `{temperature_c, humidity_percent, wind_speed_ms, wind_direction_deg, wind_direction_compass}` |
| `sensors/sets` | Sensor Pi | Controller Pi | `{pressure_psi, pressure_kpa, flow_litres, flow_rate_lpm}` |
| `sensors/plant` | Sensor Pi | Controller Pi | `{moisture, lux, soil_temperature_c}` |
| `sensors/soil` | Sensor Pi | Controller Pi | Raw soil reading |
| `status/system` | Sensor Pi | Controller Pi | Sensor Pi health check |
| `status/watering` | Controller Pi | (any subscriber) | Current watering status, retained |
| `sensors/heartbeat` | Controller Pi | (any subscriber) | Pi system metrics, retained, QoS 1 |

---

## 14-day schedule rotation

The schedule uses a fixed 14-element boolean array instead of day-of-week.

- The rotation anchor is **2024-01-01 (day 0)**
- `day_index = (today - 2024-01-01).days % 14`
- This means the same physical day of the week falls on different schedule-days each week, allowing patterns like "water 4 of every 7 days" without day-of-week bias
- The index is deterministic: it survives reboots, power outages, and config changes

**Example:** A schedule with `[true, false, true, false, true, false, false, true, false, true, false, true, false, false]` waters on days 0, 2, 4, 7, 9, 11 out of every 14.

---

## Run idempotency

Each scheduled run is identified by a SHA-256 `run_id` derived from:

```
run_id = sha256("{zone_name}|{HH:MM}|{YYYY-MM-DD}")[:16]
```

The `run_journal` table in SQLite tracks two stages per `run_id`:
- `enqueued` — set when the task is created (prevents duplicate dispatch)
- `executed` — set when the relay actually opens (prevents double-execution after crash/restart)

The schedule loop checks `was_executed(run_id)` before dispatching. Even if the loop ticks multiple times in the same minute, the run fires exactly once.

---

## Directory structure

```
LawnBot/
├── README.md                    ← Project overview and quick start
├── ARCHITECTURE.md              ← This file
├── deploy-all.sh                ← Master deploy script
├── package.json                 ← pnpm workspace root
├── shared/
│   ├── README.md
│   ├── package.json
│   └── types/
│       └── index.ts             ← All shared TypeScript types
├── packages/
│   ├── pi-controller/
│   │   ├── README.md
│   │   ├── main.py              ← Entry point: bootstrap + background tasks + uvicorn
│   │   ├── api.py               ← FastAPI app: routes, WebSocket, SPA serving
│   │   ├── requirements.txt
│   │   ├── config/
│   │   │   ├── config.json      ← Runtime config (GPIO pins, MQTT, paths)
│   │   │   └── sprinkler_schedule.json  ← Live schedule (read/written at runtime)
│   │   ├── systemd/
│   │   │   └── lawnbot-controller.service
│   │   └── src/
│   │       ├── config.py        ← Typed config loader (CONFIG singleton)
│   │       ├── models.py        ← Pydantic v2 request/response models
│   │       ├── scheduler.py     ← Schedule I/O, 14-day rotation, run_id generation
│   │       ├── run_manager.py   ← Async watering execution engine
│   │       ├── gpio_controller.py  ← Relay + LED driver (mock-safe)
│   │       ├── mqtt_handler.py  ← MQTT subscribe/publish/cache
│   │       ├── state.py         ← Thread-safe in-memory run state
│   │       └── database.py      ← Async SQLite (history, idempotency, sensors)
│   ├── pi-sensor/
│   │   ├── README.md
│   │   └── api.py               ← FastAPI :8001; log reader + MQTT publisher + WS
│   ├── web/
│   │   ├── README.md
│   │   ├── package.json
│   │   ├── vite.config.ts       ← base="/", proxy /api + /ws to Pi
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx          ← Router root + global data fetching
│   │       ├── pages/
│   │       │   ├── Dashboard.tsx
│   │       │   ├── Schedule.tsx
│   │       │   ├── History.tsx
│   │       │   ├── Sensors.tsx
│   │       │   ├── Weather.tsx
│   │       │   └── Settings.tsx
│   │       ├── components/
│   │       │   ├── Navbar.tsx
│   │       │   ├── ConnectionBadge.tsx
│   │       │   ├── ZoneCard.tsx
│   │       │   └── Gauge.tsx
│   │       ├── hooks/
│   │       │   └── useWebSocket.ts
│   │       └── lib/
│   │           ├── api.ts       ← Axios HTTP client (baseURL="/api")
│   │           └── utils.ts
│   └── mobile/
│       ├── README.md
│       ├── app.json             ← Expo config
│       ├── app/
│       │   ├── _layout.tsx      ← Root Stack layout
│       │   └── (tabs)/
│       │       ├── _layout.tsx  ← Tab bar (5 tabs)
│       │       ├── index.tsx    ← Dashboard
│       │       ├── schedule.tsx
│       │       ├── history.tsx
│       │       ├── sensors.tsx
│       │       └── weather.tsx
│       ├── components/
│       │   └── useWebSocket.ts
│       └── lib/
│           ├── api.ts           ← fetch-based HTTP client
│           └── config.ts        ← PI_HOST, API_BASE, WS_URL
```
