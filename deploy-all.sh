#!/bin/bash
# ============================================================
# LawnBot Master Deploy Script
# Builds web app and deploys everything to both Pis.
# Usage:
#   ./deploy-all.sh              # deploy code only
#   ./deploy-all.sh --restart    # deploy + restart services
#   ./deploy-all.sh --web-only   # build web + deploy to controller
#   ./deploy-all.sh --controller-only
#   ./deploy-all.sh --sensor-only
# ============================================================

set -e

CONTROLLER_HOST="100.116.147.6"
SENSOR_HOST="100.117.254.20"
CONTROLLER_USER="lds00"
SENSOR_USER="lds00"
CONTROLLER_DIR="/home/lds00/lawnbot"
SENSOR_DIR="/home/lds00/ColorSensorTest"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESTART="${1:-}"

# Parse flags
DEPLOY_CONTROLLER=true
DEPLOY_SENSOR=true
WEB_ONLY=false

for arg in "$@"; do
  case $arg in
    --web-only) WEB_ONLY=true ;;
    --controller-only) DEPLOY_SENSOR=false ;;
    --sensor-only) DEPLOY_CONTROLLER=false; WEB_ONLY=false ;;
  esac
done

echo "=============================="
echo " LawnBot Deploy"
echo " Controller: $CONTROLLER_HOST"
echo " Sensor:     $SENSOR_HOST"
echo "=============================="

# --- Build web app ---
if $DEPLOY_CONTROLLER; then
  echo ""
  echo ">>> Building web app..."
  (cd "$SCRIPT_DIR/packages/web" && pnpm build)
  echo "Web app built."
fi

if $WEB_ONLY; then
  echo "Web-only mode: skipping Pi deploys."
  exit 0
fi

# --- Deploy Controller Pi ---
if $DEPLOY_CONTROLLER; then
  echo ""
  echo ">>> Deploying to Controller Pi ($CONTROLLER_HOST)..."
  rsync -avz --delete \
    --exclude '__pycache__/' \
    --exclude '*.pyc' \
    --exclude '.git/' \
    --exclude 'node_modules/' \
    --exclude 'venv/' \
    --exclude '*.db' \
    --exclude '*.db-journal' \
    "$SCRIPT_DIR/packages/pi-controller/" \
    "$CONTROLLER_USER@$CONTROLLER_HOST:$CONTROLLER_DIR/"

  # Also sync web dist for Pi-served static files
  rsync -avz \
    "$SCRIPT_DIR/packages/web/dist/" \
    "$CONTROLLER_USER@$CONTROLLER_HOST:$CONTROLLER_DIR/../web/dist/"

  ssh "$CONTROLLER_USER@$CONTROLLER_HOST" "
    cd $CONTROLLER_DIR
    pip3 install -q -r requirements.txt 2>&1 | tail -5
    sudo cp systemd/lawnbot-controller.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable lawnbot-controller.service
    echo 'Controller service configured.'
  "

  if [[ "$*" == *"--restart"* ]]; then
    echo "Restarting Controller service..."
    ssh "$CONTROLLER_USER@$CONTROLLER_HOST" \
      "sudo systemctl restart lawnbot-controller.service"
    sleep 3
    ssh "$CONTROLLER_USER@$CONTROLLER_HOST" \
      "systemctl status lawnbot-controller.service --no-pager | head -15"
  fi

  echo "Controller deploy complete."
fi

# --- Deploy Sensor Pi ---
if $DEPLOY_SENSOR; then
  echo ""
  echo ">>> Deploying to Sensor Pi ($SENSOR_HOST)..."
  scp "$SCRIPT_DIR/packages/pi-sensor/api.py" \
    "$SENSOR_USER@$SENSOR_HOST:$SENSOR_DIR/api.py"
  scp "$SCRIPT_DIR/packages/pi-sensor/systemd/lawnbot-sensor.service" \
    "$SENSOR_USER@$SENSOR_HOST:/tmp/lawnbot-sensor.service"

  ssh "$SENSOR_USER@$SENSOR_HOST" "
    pip3 install -q fastapi uvicorn pydantic paho-mqtt 2>&1 | tail -3
    sudo cp /tmp/lawnbot-sensor.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable lawnbot-sensor.service
    echo 'Sensor service configured.'
  "

  if [[ "$*" == *"--restart"* ]]; then
    echo "Restarting Sensor service..."
    ssh "$SENSOR_USER@$SENSOR_HOST" \
      "sudo systemctl restart lawnbot-sensor.service"
    sleep 3
    ssh "$SENSOR_USER@$SENSOR_HOST" \
      "systemctl status lawnbot-sensor.service --no-pager | head -15"
  fi

  echo "Sensor deploy complete."
fi

echo ""
echo "=============================="
echo " All deployments finished!"
echo "=============================="
echo ""
echo " Controller API: http://$CONTROLLER_HOST:8000/api/status"
echo " Controller Web: http://$CONTROLLER_HOST:8000/"
echo " Sensor API:     http://$SENSOR_HOST:8001/api/sensors/all-latest"
echo ""
