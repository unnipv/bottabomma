#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUNDLE_NAME="bottabomma-monitor.tar.gz"
BUNDLE_PATH="$PROJECT_DIR/$BUNDLE_NAME"

echo "📦 Building monitor-only bundle..."
cd "$PROJECT_DIR"
tar -czf "$BUNDLE_PATH" \
  monitor \
  scripts/pi-monitor-setup.sh \
  scripts/pi-ngrok-setup.sh \
  scripts/build-monitor-bundle.sh

echo "✅ Created $BUNDLE_PATH"
echo "📡 Copy it with:"
echo "   scp $BUNDLE_PATH pi@<PI_IP>:~/"
echo ""
echo "🔧 On the Pi, inside the existing repo:"
echo "   tar -xzf ~/bottabomma-monitor.tar.gz -C ~/bottabomma"
echo "   cd ~/bottabomma"
echo "   bash scripts/pi-monitor-setup.sh"
echo "   bash scripts/pi-ngrok-setup.sh"
