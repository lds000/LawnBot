# pi-controller — LawnBot Controller Pi Backend

FastAPI backend for the Controller Pi. Replaces the original Flask + main.py combo.

## Structure

```
pi-controller/
├── main.py              # Entry point — starts all async tasks + uvicorn
├── api.py               # FastAPI app — REST endpoints + WebSocket
├── src/
│   ├── config.py        # Config loader (reads config/config.json)
│   ├── scheduler.py     # 14-day rotation schedule engine
│   ├── run_manager.py   # Async pulse/soak watering execution
│   ├── gpio_controller.py  # Relay + LED GPIO (mock-safe)
│   ├── mqtt_handler.py  # MQTT publish/subscribe
│   ├── database.py      # SQLite via aiosqlite
│   ├── state.py         # Shared in-memory run state
│   └── models.py        # Pydantic request/response models
├── config/config.json   # Device configuration
├── systemd/             # systemd service files
├── requirements.txt
└── deploy.sh            # rsync deploy script
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/status | Full system status |
| GET | /api/schedule | Get current schedule |
| PUT | /api/schedule | Update schedule |
| GET | /api/zones | Zone list + relay states |
| POST | /api/zones/{name}/run | Manual run a zone |
| POST | /api/stop-all | Emergency stop |
| GET | /api/history | Watering history |
| GET | /api/sensors/latest | Latest sensor readings |
| GET | /api/sensors/history/{type} | Sensor history |
| GET | /api/system/metrics | CPU/memory/disk/temp |
| WS  | /ws | Real-time status WebSocket |
| GET | /app/* | Serves React web app |

## Development

```bash
# Install dependencies (on PC — RPi.GPIO will fail, GPIO mock mode auto-enabled)
pip install -r requirements.txt

# Run locally (mock GPIO)
python main.py
```

## Deploy to Pi

```bash
# First deploy
./deploy.sh

# Deploy + restart service
./deploy.sh --restart
```
