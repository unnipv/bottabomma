#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
MONITOR_DIR="$APP_DIR/monitor"
ENV_FILE="$MONITOR_DIR/.env"
EXAMPLE_FILE="$MONITOR_DIR/.env.example"

echo "📡 Bottabomma Monitor Setup"
echo "==========================="

if [ ! -d "$MONITOR_DIR" ]; then
  echo "❌ Monitor directory not found at $MONITOR_DIR"
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "❌ PM2 is required. Install it first, then rerun this script."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  echo "📝 Created $ENV_FILE from the example file."
  echo "   Edit MONITOR_USERNAME and MONITOR_PASSWORD, then rerun:"
  echo "   nano $ENV_FILE"
  exit 0
fi

if grep -q '^MONITOR_PASSWORD=change-me$' "$ENV_FILE" || grep -q '^MONITOR_PASSWORD=$' "$ENV_FILE"; then
  echo "❌ Please set a real MONITOR_PASSWORD in $ENV_FILE before exposing the dashboard."
  exit 1
fi

cd "$APP_DIR"
pm2 start monitor/ecosystem.config.js --only bottabomma-monitor
pm2 save

echo ""
echo "✅ Monitor started with PM2"
echo "   Local URL: http://127.0.0.1:3010"
echo "   Check logs: pm2 logs bottabomma-monitor --lines 100"
