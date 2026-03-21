# mobile

Expo React Native app for LawnBot. Connects to the Controller Pi over the local network or Tailscale VPN. Uses Expo Router for file-based navigation.

## Tech stack

| Library | Version | Purpose |
|---|---|---|
| Expo SDK | 51 | React Native toolchain |
| Expo Router | 3 | File-based routing + tab navigation |
| React Native | 0.74 | Cross-platform mobile UI |
| TypeScript | 5 | Type safety |

## Development

```bash
# From repo root
pnpm dev:mobile

# Or directly
cd packages/mobile
npx expo start
```

Scan the QR code with the Expo Go app on your phone, or press `i`/`a` to open in simulator.

### Connecting to the Pi

Edit `lib/config.ts` to point at the correct host:

```ts
// Local network (mDNS — works on most home networks)
export const PI_HOST = "raspberrypi.local";

// Tailscale VPN (use when off local network)
export const PI_HOST = "100.116.147.6";
```

Everything else (`API_BASE`, `WS_URL`) is derived from `PI_HOST` automatically.

## Tabs

| Tab | File | Description |
|---|---|---|
| Dashboard | `app/(tabs)/index.tsx` | Zone cards, manual run/stop, live status, schedule summary |
| Schedule | `app/(tabs)/schedule.tsx` | 14-day schedule viewer/editor |
| History | `app/(tabs)/history.tsx` | Watering run log |
| Sensors | `app/(tabs)/sensors.tsx` | Live sensor metric tiles |
| Weather | `app/(tabs)/weather.tsx` | Animated instrument panel (thermometer, compass, pressure/wind/humidity gauges) |

Tab bar styling: dark background `#030712`, active tint `#22c55e` (green), inactive `#6b7280`.

## Key files

```
app/
├── _layout.tsx          ← Root Stack layout (wraps the tab group)
└── (tabs)/
    ├── _layout.tsx      ← Tab bar configuration (5 tabs, icons, colors)
    ├── index.tsx        ← Dashboard screen
    ├── schedule.tsx     ← Schedule screen
    ├── history.tsx      ← History screen
    ├── sensors.tsx      ← Sensors screen (simple metric tiles)
    └── weather.tsx      ← Weather screen (rich gauge instruments)
components/
└── useWebSocket.ts      ← Auto-reconnecting WebSocket hook for React Native
lib/
├── api.ts               ← All HTTP calls using native fetch
└── config.ts            ← PI_HOST, API_BASE, WS_URL constants
```

## Data fetching

Unlike the web app, the mobile app does **not** use React Query. Each screen manages its own polling:

- `useEffect` + `setInterval` — polls the relevant API endpoint every 5–10 seconds
- `useCallback` wraps the fetch function so the interval reference is stable
- `useWebSocket` hook — connects to `ws://PI_HOST:8000/ws`; receives status pushes every 2 seconds

## Weather screen gauges

`weather.tsx` implements a full instrument panel built entirely with React Native `View`/`Text` primitives (no SVG library):

| Gauge | Technique |
|---|---|
| Thermometer | Absolute-positioned `View` rectangles forming a tube + bulb |
| Compass | `Line` components (positioned `View` strips) approximating a circle of tick marks; needle built from 4 line segments |
| Pressure dial | `ArcStrokes` — arc approximated by many tiny `Line` segments; colored zone bands + needle |
| Wind speed dial | Same as pressure dial; includes Beaufort scale label |
| Humidity dial | Same dial style; orange/teal/blue zones |

The `polarToXY()` helper converts polar coordinates (center, radius, angle) to `{x, y}` for all drawing primitives.

## API surface

`lib/api.ts` exports one function per endpoint:

| Function | Endpoint |
|---|---|
| `getStatus()` | `GET /api/status` |
| `getSchedule()` | `GET /api/schedule` |
| `updateSchedule(schedule)` | `PUT /api/schedule` |
| `getHistory(limit)` | `GET /api/history` |
| `getSensors()` | `GET /api/sensors/latest` |
| `getSensorHistory(topic, limit)` | `GET /api/sensors/history/{topic}` |
| `getSystemMetrics()` | `GET /api/system/metrics` |
| `manualRun(zone_name, duration_minutes)` | `POST /api/zones/{zone}/run` |
| `stopAll()` | `POST /api/stop-all` |

## Building for production

```bash
npx expo build:android   # Android APK/AAB
npx expo build:ios       # iOS IPA (requires Apple developer account)

# Or with EAS Build
npx eas build --platform all
```
