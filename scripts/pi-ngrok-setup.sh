#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

echo "🌍 Bottabomma ngrok Setup"
echo "========================="

if ! command -v ngrok >/dev/null 2>&1; then
  echo "❌ ngrok is not installed."
  echo "   Install guide: https://ngrok.com/docs/guides/device-gateway/raspbian/"
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "❌ PM2 is required. Install it first, then rerun this script."
  exit 1
fi

cd "$APP_DIR"
pm2 start monitor/ngrok.ecosystem.config.js --only bottabomma-ngrok
pm2 save

echo ""
echo "✅ ngrok started with PM2"
echo "   Check tunnel logs: pm2 logs bottabomma-ngrok --lines 100"
echo "   ngrok local API: http://127.0.0.1:4040/api/tunnels"
