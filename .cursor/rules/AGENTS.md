# LawnBot — AI Agent Guide

This document gives AI assistants (Cursor, Copilot, Claude, etc.) a complete mental model of the LawnBot codebase so they can make accurate, well-integrated changes.

---

## What this project is

LawnBot is a **Raspberry Pi irrigation controller** with a monorepo structure:

- **Two Python FastAPI backends** — one on the Controller Pi (controls GPIO + serves the web UI), one on the Sensor Pi (reads hardware sensors)
- **One React web app** — built by Vite, served as a static SPA from the Controller Pi at `/`
- **One Expo React Native mobile app** — connects over LAN or Tailscale VPN
- **One shared TypeScript types package** — used by both frontend clients

The Controller Pi is the hub. Everything connects to it.

---

## Monorepo layout

```
LawnBot/
├── packages/
│   ├── pi-controller/   ← Python FastAPI: GPIO, schedule, MQTT, SQLite, REST API, WebSocket, SPA serving
│   ├── pi-sensor/       ← Python FastAPI: sensor log reader, MQTT publisher, WebSocket
│   ├── web/             ← React + Vite SPA (served from Controller Pi at /)
│   └── mobile/          ← Expo React Native (connects to Controller Pi over network)
├── shared/              ← TypeScript types only — no runtime code
├── deploy-all.sh        ← Builds web + rsyncs to both Pis
├── README.md            ← Project overview and quick start
└── ARCHITECTURE.md      ← Full system diagram, data flows, API reference, MQTT map
```

---

## Where things live — quick lookup

| What you're looking for | Where to find it |
|---|---|
| All REST API endpoints | `packages/pi-controller/api.py` |
| WebSocket broadcaster | `api.py` → `ws_broadcaster_task` + `ConnectionManager` |
| Schedule logic + 14-day rotation | `packages/pi-controller/src/scheduler.py` |
| Watering execution (relays, pulse/soak) | `packages/pi-controller/src/run_manager.py` |
| GPIO relay + LED control | `packages/pi-controller/src/gpio_controller.py` |
| MQTT subscribe/publish | `packages/pi-controller/src/mqtt_handler.py` |
| In-memory run state + stop flag | `packages/pi-controller/src/state.py` |
| SQLite schema + queries | `packages/pi-controller/src/database.py` |
| Pydantic request/response models | `packages/pi-controller/src/models.py` |
| Runtime config (GPIO pins, MQTT, paths) | `packages/pi-controller/config/config.json` |
| Typed config singleton (Python) | `packages/pi-controller/src/config.py` → `CONFIG` |
| Background tasks (schedule loop, mist, heartbeat) | `packages/pi-controller/main.py` |
| Web HTTP client | `packages/web/src/lib/api.ts` |
| Mobile HTTP client | `packages/mobile/lib/api.ts` |
| Pi host/port config for mobile | `packages/mobile/lib/config.ts` |
| WebSocket hook (web) | `packages/web/src/hooks/useWebSocket.ts` |
| WebSocket hook (mobile) | `packages/mobile/components/useWebSocket.ts` |
| All TypeScript types | `shared/types/index.ts` |
| Nav items (web) | `packages/web/src/components/Navbar.tsx` |
| Tab bar (mobile) | `packages/mobile/app/(tabs)/_layout.tsx` |
| Web router | `packages/web/src/App.tsx` |

---

## Key invariants — don't break these

### 1. Single active watering run
Only one zone can water at a time. This is enforced by `_global_run_lock` in `run_manager.py`. The `/api/zones/{name}/run` endpoint returns 409 if `state.get_current_run()` is not None.

### 2. Run idempotency
Every scheduled run has a `run_id = sha256("{zone}|{HH:MM}|{YYYY-MM-DD}")[:16]`. The `run_journal` table prevents the same run from executing twice. Never bypass this check.

### 3. 14-day schedule array
`schedule.schedule_days` is exactly 14 booleans. Day index is `(today - 2024-01-01).days % 14`. This is validated by the `Schedule` Pydantic model. Do not change the epoch date — it would shift all existing schedules.

### 4. GPIO mock mode
`gpio_controller.py` auto-detects non-Pi hardware and enables mock mode. All GPIO calls are safe to make on any machine. Never add `if mock` guards in calling code — the abstraction handles it.

### 5. Web app served at `/`
The Vite build uses `base: "/"`. The FastAPI SPA catch-all is at `/{full_path:path}`. All `/api/*` and `/ws` routes must be registered **before** the catch-all or they will be swallowed. The `/assets` StaticFiles mount must also come before the catch-all.

### 6. Sensor field normalization
Sensor Pi MQTT envelopes may use `temperature` or `temperature_c`, `humidity` or `humidity_percent`, `wind_speed` or `wind_speed_ms`. Web and mobile pages always normalize with `??`:
```ts
const tempC = env?.temperature_c ?? env?.temperature ?? null;
```
Don't assume a single field name when reading sensor data.

---

## Adding a new API endpoint

1. Add the route handler in `packages/pi-controller/api.py`
2. Add a corresponding function in `packages/web/src/lib/api.ts`
3. Add a corresponding function in `packages/mobile/lib/api.ts`
4. If the request/response has a new shape, add Pydantic model in `src/models.py` and TypeScript type in `shared/types/index.ts`

---

## Adding a new web page

1. Create `packages/web/src/pages/MyPage.tsx` and export a named component
2. Import it in `packages/web/src/App.tsx` and add a `<Route path="/my-page" element={<MyPage />} />`
3. Add a nav item in `packages/web/src/components/Navbar.tsx` (import icon from `lucide-react`)

---

## Adding a new mobile tab

1. Create `packages/mobile/app/(tabs)/my-tab.tsx` and export a default component
2. Add the tab to `packages/mobile/app/(tabs)/_layout.tsx` with an icon from `@expo/vector-icons`

---

## Deploying changes

### Web app only (most common)
```bash
cd packages/web && pnpm build
scp -r dist/* lds00@100.116.147.6:/home/lds00/web/dist/
```
No Pi restart needed — FastAPI serves the files on every request.

### Backend changes (api.py, any src/ file, main.py)
```bash
./deploy-all.sh --controller-only --restart
```
Or manually:
```bash
rsync -avz packages/pi-controller/ lds00@100.116.147.6:/home/lds00/lawnbot/
ssh lds00@100.116.147.6 "sudo systemctl restart lawnbot-controller"
```

### Full deploy (web + both Pis)
```bash
./deploy-all.sh --restart
```

---

## Pi network info

| Pi | Tailscale IP | Service port | Role |
|---|---|---|---|
| Controller Pi | `100.116.147.6` | `8000` | API + GPIO + web UI |
| Sensor Pi | `100.117.254.20` | `8001` | Sensor reader |

MQTT broker runs on the **Controller Pi** at `localhost:1883` (accessible from Sensor Pi as `100.116.147.6:1883`).

---

## What NOT to do

- **Don't add another catch-all route** in `api.py` above the existing `/{full_path:path}` handler — it will shadow the SPA
- **Don't change the schedule anchor date** (2024-01-01) — shifts every existing 14-day schedule
- **Don't import from `packages/web` or `packages/mobile` in `pi-controller`** — the Python backend has no knowledge of the frontend
- **Don't add GPIO calls outside `gpio_controller.py`** — the abstraction layer exists to ensure mock safety
- **Don't hardcode Pi IPs in web app source** — the web app uses relative `/api/` paths; the Pi IP only belongs in `vite.config.ts` (proxy) and `packages/mobile/lib/config.ts`
- **Don't forget to rebuild and redeploy** after changing web source — the Pi serves the built `dist/`, not the source files

---

## Useful commands

```bash
# Check Controller Pi service status
ssh lds00@100.116.147.6 "systemctl status lawnbot-controller"

# Tail live logs from Controller Pi
ssh lds00@100.116.147.6 "journalctl -u lawnbot-controller -f"

# Test the API
curl http://100.116.147.6:8000/api/status

# Build web and deploy
cd packages/web && pnpm build
scp -r dist/* lds00@100.116.147.6:/home/lds00/web/dist/

# Run backend locally (mock GPIO)
cd packages/pi-controller && python main.py
```
