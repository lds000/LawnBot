# shared

Shared TypeScript type definitions consumed by both the `web` and `mobile` packages. This package contains **no runtime code** — only type declarations.

## Purpose

Provides a single source of truth for all data shapes that cross the API boundary. When the Python Pydantic models in `pi-controller/src/models.py` change, this is the file to update alongside them.

## Usage

Both `web` and `mobile` have this package in their `tsconfig.json` path aliases:

```ts
// vite.config.ts (web)
"@shared": path.resolve(__dirname, "../../shared")

// tsconfig.json (mobile)
"@shared/*": ["../../shared/*"]
```

Import types:

```ts
import type { SystemStatus, Schedule, HistoryEntry } from "@shared/types";
```

## Type reference

### System status

| Type | Description |
|---|---|
| `ZoneStatus` | `'idle' \| 'watering' \| 'soaking' \| 'scheduled-soon' \| 'error'` |
| `ZoneState` | `{name, status, relay_on}` |
| `CurrentRun` | `{set_name, start_time, duration_minutes, phase, time_remaining_seconds, is_manual, run_id}` |
| `NextRun` | `{set_name, scheduled_time, duration_minutes}` |
| `SystemStatus` | Full `/api/status` response shape |

### Schedule

| Type | Description |
|---|---|
| `Schedule` | `{start_times, schedule_days: boolean[14], mist_settings}` |
| `StartTime` | `{time: "HH:MM", enabled, sets: ScheduleSet[]}` |
| `ScheduleSet` | `{name, duration_minutes, pulse_minutes?, soak_minutes?, mode, enabled}` |
| `MistSettings` | `{enabled, trigger_temp_f, duration_seconds, check_interval_minutes}` |

Watering modes:
- `"normal"` — open relay for full `duration_minutes`
- `"pulse_soak"` — cycle between `pulse_minutes` on and `soak_minutes` off

### Sensors

| Type | Description |
|---|---|
| `EnvironmentReading` | `{timestamp, temperature_c, humidity_percent, wind_speed_ms, wind_direction_deg, wind_direction_compass}` |
| `FlowPressureReading` | `{timestamp, flow_litres, flow_rate_lpm, pressure_psi, pressure_kpa}` |
| `PlantReading` | `{timestamp, moisture, lux, soil_temperature_c}` |
| `SensorStatus` | `{environment, flow_pressure, plant, online, last_seen}` |

### History

| Type | Description |
|---|---|
| `HistoryEntry` | `{id, set_name, start_time, end_time, duration_seconds, is_manual, run_id, completed}` |

### WebSocket

| Type | Description |
|---|---|
| `WsMessage<T>` | `{type: 'status' \| 'sensor' \| 'error' \| 'history_update', data: T, timestamp}` |

### API requests

| Type | Description |
|---|---|
| `ManualRunRequest` | `{set_name, duration_minutes}` |
| `ScheduleUpdateRequest` | `{schedule: Schedule}` |

## Known divergences from Python models

The Python `CurrentRun` Pydantic model uses `zone_name` and `remaining_seconds`, while the shared TypeScript `CurrentRun` type uses `set_name` and `time_remaining_seconds`. The web and mobile apps handle both field names with null-coalescing normalization.
