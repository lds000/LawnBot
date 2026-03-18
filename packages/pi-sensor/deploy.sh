#!/bin/bash
# Deploy pi-sensor API to Sensor Pi
# Usage: ./deploy.sh [--restart]

REMOTE_USER="lds00"
REMOTE_HOST="100.117.254.20"
REMOTE_DIR="/home/lds00/ColorSensorTest"

echo "=== Deploying LawnBot Sensor API to $REMOTE_HOST ==="

# Only deploy the new API file and service — don't overwrite existing sensor code
scp "$(dirname "$0")/api.py" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/api.py"
scp "$(dirname "$0")/systemd/lawnbot-sensor.service" "$REMOTE_USER@$REMOTE_HOST:/tmp/lawnbot-sensor.service"

ssh "$REMOTE_USER@$REMOTE_HOST" "
  pip3 install -q fastapi uvicorn pydantic
  sudo cp /tmp/lawnbot-sensor.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable lawnbot-sensor.service
  echo 'Service installed.'
"

if [[ "$1" == "--restart" ]]; then
  echo "Restarting service..."
  ssh "$REMOTE_USER@$REMOTE_HOST" "sudo systemctl restart lawnbot-sensor.service"
  sleep 2
  ssh "$REMOTE_USER@$REMOTE_HOST" "systemctl status lawnbot-sensor.service --no-pager | head -20"
fi

echo "=== Deploy complete ==="
