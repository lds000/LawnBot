# pi-sensor — LawnBot Sensor Pi Backend

FastAPI backend for the Sensor Pi. Replaces the original Flask avg_pressure_api.py.
SensorMonitor.py sensor loop is kept intact — only the API layer is replaced.

## Structure

```
pi-sensor/
├── api.py               # FastAPI app (:8001) — sensor history endpoints + WebSocket
├── SensorMonitor.py     # Sensor loop (unchanged from original)
├── sensors/             # Hardware sensor modules (unchanged)
├── services/            # mqtt_publisher, log_manager (unchanged)
├── config.json          # Sensor enable/disable toggles
├── calibration.json     # Sensor calibration values
├── systemd/             # systemd service files
├── requirements.txt
└── deploy.sh
```
