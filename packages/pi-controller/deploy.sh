#!/bin/bash
# Deploy pi-controller to Controller Pi
# Usage: ./deploy.sh [--restart]

REMOTE_USER="lds00"
REMOTE_HOST="100.116.147.6"
REMOTE_DIR="/home/lds00/lawnbot"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Deploying LawnBot Controller to $REMOTE_HOST ==="

# Sync code (exclude venv, __pycache__, .git)
rsync -avz --delete \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude '.git/' \
  --exclude 'venv/' \
  --exclude '*.db' \
  --exclude '*.db-journal' \
  "$LOCAL_DIR/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"

echo "Code synced."

# Install/update dependencies on Pi
ssh "$REMOTE_USER@$REMOTE_HOST" "
  cd $REMOTE_DIR
  pip3 install -q -r requirements.txt
  echo 'Dependencies installed.'
"

# Install systemd service if not already installed
ssh "$REMOTE_USER@$REMOTE_HOST" "
  sudo cp $REMOTE_DIR/systemd/lawnbot-controller.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable lawnbot-controller.service
  echo 'Service installed.'
"

if [[ "$1" == "--restart" ]]; then
  echo "Restarting service..."
  ssh "$REMOTE_USER@$REMOTE_HOST" "sudo systemctl restart lawnbot-controller.service"
  sleep 2
  ssh "$REMOTE_USER@$REMOTE_HOST" "systemctl status lawnbot-controller.service --no-pager | head -20"
fi

echo "=== Deploy complete ==="
