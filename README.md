# LawnBot

An automated irrigation system running on two Raspberry Pis, controlled via a React web app and an Expo mobile app.

## What it does

- Controls three irrigation zones (Hanging Pots, Garden, Misters) via GPIO-driven relays
- Runs on a 14-day rotating schedule with configurable start times and per-zone durations
- Supports pulse/soak watering cycles for zones that benefit from soak time between bursts
- Auto-mists based on ambient temperature (triggers the Misters zone when it gets hot)
- Reads live environmental sensors (temperature, humidity, wind, pressure, flow, plant moisture)
- Streams real-time status to all connected clients via WebSocket
- Serves the full web UI directly from the Controller Pi — no separate web server needed

## Monorepo structure

```
LawnBot/
├── packages/
│   ├── pi-controller/   # FastAPI backend — runs on Controller Pi, controls GPIO + serves web UI
│   ├── pi-sensor/       # FastAPI backend — runs on Sensor Pi, reads and publishes sensor data
│   ├── web/             # React + Vite SPA — served by pi-controller at http://<pi>:8000/
│   └── mobile/          # Expo React Native app — connects over LAN or Tailscale VPN
├── shared/              # TypeScript type definitions shared between web and mobile
├── deploy-all.sh        # Master deploy script (builds web, rsync to both Pis)
└── ARCHITECTURE.md      # Full system architecture and data flow reference
```

## Hardware

| Device | Role | IP (Tailscale) |
|---|---|---|
| Controller Pi | FastAPI API + GPIO relay driver + MQTT client + web server | `100.116.147.6` |
| Sensor Pi | Sensor reader + MQTT publisher + sensor API | `100.117.254.20` |

### Zones (Controller Pi GPIO)

| Zone | GPIO Pin | Purpose |
|---|---|---|
| Hanging Pots | 17 | Drip irrigation for container plants |
| Garden | 27 | Garden bed spray |
| Misters | 22 | Evaporative cooling / auto-mist |

## Quick start

### Prerequisites

- Node.js ≥ 18, pnpm ≥ 8
- Python 3.11+ (on the Pis)
- Expo CLI (for mobile development)

### Install dependencies

```bash
pnpm install
```

### Run the web app locally (dev server with Pi proxy)

```bash
pnpm dev:web
```

Proxies `/api` and `/ws` to `http://raspberrypi.local:8000` — requires the Controller Pi to be reachable on your network.

### Run the mobile app

```bash
pnpm dev:mobile
```

Opens the Expo dev server. Edit `packages/mobile/lib/config.ts` to point at the correct Pi host/IP.

### Deploy everything to both Pis

```bash
./deploy-all.sh --restart
```

See [deploy-all.sh](./deploy-all.sh) for partial deploy flags (`--web-only`, `--controller-only`, `--sensor-only`).

## Packages at a glance

| Package | Tech stack | Docs |
|---|---|---|
| `pi-controller` | Python 3.11, FastAPI, aiosqlite, Paho MQTT, RPi.GPIO | [README](packages/pi-controller/README.md) |
| `pi-sensor` | Python 3.11, FastAPI, Paho MQTT | [README](packages/pi-sensor/README.md) |
| `web` | React 18, TypeScript, Vite, Tailwind CSS, React Query, Recharts | [README](packages/web/README.md) |
| `mobile` | Expo SDK 51, React Native, Expo Router | [README](packages/mobile/README.md) |
| `shared` | TypeScript (types only) | [README](shared/README.md) |

## Architecture overview

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system diagram, data flows, API reference, and MQTT topic map.

## Key design decisions

- **Single hub:** The Controller Pi is the center of everything — it runs the API, controls hardware, manages the schedule, and serves the web UI. No external cloud services required.
- **MQTT as the real-time bus:** Sensor Pi publishes readings to MQTT; Controller Pi subscribes and caches them in memory and SQLite. This decouples the two Pis cleanly.
- **14-day schedule rotation:** Instead of day-of-week scheduling, LawnBot uses a 14-day boolean array. Day 0 is anchored to 2024-01-01, so the schedule is deterministic and survives reboots.
- **Idempotent runs:** Each scheduled run has a SHA-256 `run_id` derived from `zone|time|date`. The DB journal prevents the same run from firing twice even if the schedule loop ticks multiple times.
- **Mock GPIO mode:** The entire system runs on non-Pi hardware (Windows/Mac) with `mock=true` — relays are simulated in memory. Useful for developing and testing the API without hardware.
