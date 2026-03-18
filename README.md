# LawnBot — Unified Irrigation Control System

A full rewrite of the LawnMan + Sprinkler repos into a modern, reliable monorepo.

## Architecture

```
LawnBot/
├── packages/
│   ├── pi-controller/   # FastAPI backend — Controller Pi (port 8000)
│   ├── pi-sensor/       # FastAPI backend — Sensor Pi (port 8001)
│   ├── web/             # React + Vite dashboard (served by pi-controller)
│   └── mobile/          # Expo React Native iOS app
├── shared/
│   └── types/           # Shared TypeScript types
├── deploy-all.sh        # Master deploy script
└── pnpm-workspace.yaml
```

## Device Roster

| Device | Tailscale IP | Local Hostname | Role |
|--------|-------------|----------------|------|
| Controller Pi | 100.116.147.6 | pisprinkler.local | Main watering controller, MQTT broker |
| Sensor Pi | 100.117.254.20 | pi1zerowh.local | Environmental/flow/pressure sensors |

## Quick Start

### Prerequisites
- Node 22+ / pnpm
- Python 3.11+ on Pis
- SSH keys set up (see previous session)

### Development (PC)
```bash
# Install all dependencies
pnpm install

# Run web dev server (proxies to Pi at raspberrypi.local:8000)
pnpm dev:web

# Run mobile (Expo Go on iPhone)
pnpm dev:mobile
```

### Deploy to Pis
```bash
# First deploy (installs services, doesn't restart)
./deploy-all.sh

# Deploy and restart both services
./deploy-all.sh --restart

# Deploy only controller
./deploy-all.sh --controller-only --restart

# Deploy only sensor
./deploy-all.sh --sensor-only --restart

# Just rebuild web and push to Pi (no Python changes)
./deploy-all.sh --web-only && scp -r packages/web/dist lds00@100.116.147.6:~/web/dist
```

## API Reference

### Controller Pi (port 8000)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Full system status (JSON) |
| `/api/schedule` | GET | Current schedule |
| `/api/schedule` | PUT | Update schedule |
| `/api/zones` | GET | Zone list + relay states |
| `/api/zones/{name}/run` | POST | Manual run `{set_name, duration_minutes}` |
| `/api/stop-all` | POST | Emergency stop all relays |
| `/api/history` | GET | Watering history |
| `/api/sensors/latest` | GET | Latest sensor readings |
| `/api/sensors/history/{type}` | GET | type = environment/flow/plant |
| `/api/system/metrics` | GET | CPU/RAM/disk/temp |
| `/ws` | WebSocket | Real-time status push (2s interval) |
| `/app` | GET | React web app (static) |
| `/docs` | GET | FastAPI auto-docs (Swagger UI) |

### Sensor Pi (port 8001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sensors/all-latest` | GET | All sensor latest readings |
| `/api/sensors/pressure` | GET | Pressure history |
| `/api/sensors/wind` | GET | Wind speed history |
| `/api/sensors/flow` | GET | Flow rate history |
| `/api/sensors/temperature` | GET | Temperature/humidity history |
| `/api/sensors/moisture` | GET | Moisture history |
| `/ws` | WebSocket | Live sensor data push |

## Schedule Format

```json
{
  "start_times": [
    {
      "time": "06:00",
      "enabled": true,
      "sets": [
        {"name": "Garden", "duration_minutes": 15, "mode": "normal", "enabled": true},
        {"name": "Hanging Pots", "duration_minutes": 10, "mode": "pulse_soak",
         "pulse_minutes": 2, "soak_minutes": 5, "enabled": true}
      ]
    }
  ],
  "schedule_days": [true, false, true, false, true, false, true,
                   false, true, false, true, false, true, false],
  "mist_settings": {
    "enabled": true,
    "trigger_temp_f": 95,
    "duration_seconds": 60,
    "check_interval_minutes": 20
  }
}
```

## Mobile App (Expo)

Run on iPhone via Expo Go (no Apple Developer account needed for testing):
```bash
cd packages/mobile
pnpm start
# Scan QR code with Expo Go app
```

The app connects to `raspberrypi.local:8000` when on the same WiFi network.
Over Tailscale (remote), update `packages/mobile/lib/config.ts`:
```typescript
export const PI_HOST = "100.116.147.6"; // Tailscale IP
```

## Services on Pis

After deploying with `--restart`, services are managed by systemd:
```bash
# On Controller Pi
sudo systemctl status lawnbot-controller
sudo journalctl -u lawnbot-controller -f  # live logs

# On Sensor Pi
sudo systemctl status lawnbot-sensor
sudo journalctl -u lawnbot-sensor -f
```

## Offline Operation

Both Pis operate fully offline:
- Controller Pi runs its own FastAPI server + MQTT broker (Mosquitto)
- Sensor Pi publishes data locally via MQTT
- Schedules stored in JSON file, history in SQLite — no internet required
- Web UI is served directly from the Pi at `/app`
