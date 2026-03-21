# web

React single-page application for the LawnBot dashboard. Built with Vite and Tailwind CSS, served directly from the Controller Pi at `http://<pi>:8000/`.

## Tech stack

| Library | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 5 | Build tool + dev server |
| Tailwind CSS | 3 | Utility-first styling |
| React Query | 5 | Server state, polling, caching |
| React Router | 6 | Client-side routing |
| Recharts | 2 | Historical sensor charts |
| Axios | 1 | HTTP client |
| Lucide React | — | Icon set |

## Development

```bash
# From the repo root
pnpm dev:web

# Or directly
cd packages/web
pnpm dev
```

The dev server proxies `/api` and `/ws` to `http://raspberrypi.local:8000`. The Controller Pi must be reachable on your network (or via Tailscale).

To use a different Pi address, edit `vite.config.ts`:

```ts
proxy: {
  "/api": { target: "http://100.116.147.6:8000", changeOrigin: true },
  "/ws":  { target: "ws://100.116.147.6:8000",  ws: true }
}
```

## Build and deploy

```bash
pnpm build:web        # from repo root — builds to packages/web/dist/
./deploy-all.sh --web-only   # builds + rsync to Pi
```

The built `dist/` is served by the Controller Pi's FastAPI via a catch-all `/{full_path:path}` route that falls back to `index.html` for all unmatched paths (SPA routing).

## Pages

| Route | Component | Description |
|---|---|---|
| `/` | `Dashboard` | Zone status, manual run/stop, sensor gauges, schedule summary |
| `/schedule` | `Schedule` | Full 14-day schedule editor with visual preview |
| `/history` | `History` | Paginated watering run log |
| `/sensors` | `Sensors` | Live sensor gauges + historical trend charts |
| `/weather` | `Weather` | Animated instrument panel: thermometer, compass, pressure/wind/humidity dials |
| `/settings` | `Settings` | Pi system health metrics and connection info |

## Components

| Component | Purpose |
|---|---|
| `Navbar` | Fixed top nav with route links and WebSocket connection badge |
| `ConnectionBadge` | Green/yellow/red dot showing WebSocket status |
| `ZoneCard` | Per-zone card with status indicator and Run/Stop button |
| `Gauge` | SVG arc gauge used on Dashboard and Sensors pages |

## Data fetching

The app uses two data channels:

**WebSocket (`useWebSocket` hook):**
- Connects to `ws://<same-origin>/ws`
- Receives `{type: "status", data: {...}}` every 2 seconds
- Used for: zone states, current run countdown, next run, schedule day

**React Query polling:**
- `sensors-latest` — polls `/api/sensors/latest` every 5 seconds
- `schedule` — on-demand, refetches after save
- `history` — on-demand with pagination
- `sensor-history-*` — polls every 30 seconds for chart data
- `system-metrics` — polls every 15 seconds on Settings page

## Key files

```
src/
├── App.tsx              ← Router root; global WebSocket + sensor polling; passes data to Dashboard
├── main.tsx             ← React entry point
├── pages/
│   ├── Dashboard.tsx    ← Receives status + sensors as props; manual run dialog
│   ├── Schedule.tsx     ← Local state editor; TwoWeekPreview sub-component
│   ├── History.tsx      ← Paginated run list
│   ├── Sensors.tsx      ← Live gauges + Recharts line charts
│   ├── Weather.tsx      ← SVG instrument panel (thermometer, compass, dials)
│   └── Settings.tsx     ← System metrics + static connection info
├── components/
│   ├── Navbar.tsx       ← Nav items + ConnectionBadge
│   ├── ZoneCard.tsx     ← Zone status + run/stop button
│   ├── Gauge.tsx        ← Reusable SVG arc gauge
│   └── ConnectionBadge.tsx
├── hooks/
│   └── useWebSocket.ts  ← Auto-reconnecting WebSocket; returns {data, status}
└── lib/
    ├── api.ts           ← All HTTP calls (axios, baseURL="/api")
    └── utils.ts         ← cn(), formatDuration(), formatDateTime(), tempCtoF()
```

## Sensor field normalization

The Controller Pi API may return sensor data in two formats depending on the MQTT envelope version. Pages normalize both:

```ts
const tempC = env?.temperature_c ?? env?.temperature ?? null;
const humidity = env?.humidity_percent ?? env?.humidity ?? null;
const windMs = env?.wind_speed_ms ?? env?.wind_speed ?? null;
```

## Styling conventions

- Dark theme throughout: `bg-gray-950`, `bg-gray-900`, `bg-gray-800`
- Accent color: `brand-500` (`#22c55e` green) — defined in `tailwind.config`
- Cards: `card` utility class — rounded, bordered, padded `bg-gray-900` panels
- Badges: `badge badge-green` / `badge badge-red` for status pills
