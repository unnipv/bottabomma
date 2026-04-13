#!/bin/bash
# ============================================================
# Bottabomma Deploy Bundle Script
# Run this on your Mac to create a transfer-ready tarball
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUNDLE_NAME="bottabomma-deploy.tar.gz"
BUNDLE_PATH="$PROJECT_DIR/$BUNDLE_NAME"

echo "📦 Building deploy bundle..."
echo "   Project: $PROJECT_DIR"

# Verify critical files exist
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "❌ .env file not found! Cannot create bundle without it."
    exit 1
fi

if [ ! -f "$PROJECT_DIR/credentials/service-account.json" ]; then
    echo "❌ credentials/service-account.json not found!"
    exit 1
fi

# Create tarball excluding unnecessary files
cd "$PROJECT_DIR"
tar -czf "$BUNDLE_PATH" \
    --exclude='node_modules' \
    --exclude='.wwebjs_auth' \
    --exclude='.wwebjs_cache' \
    --exclude='.git' \
    --exclude='.DS_Store' \
    --exclude='*.tar.gz' \
    --exclude='logs' \
    .

BUNDLE_SIZE=$(du -h "$BUNDLE_PATH" | cut -f1)
echo ""
echo "✅ Bundle created: $BUNDLE_PATH ($BUNDLE_SIZE)"
echo ""
echo "📡 Transfer to your Pi with:"
echo "   scp $BUNDLE_PATH pi@<PI_IP>:~/"
echo ""
echo "🔧 Then SSH into the Pi and run:"
echo "   ssh pi@<PI_IP>"
echo "   bash ~/bottabomma/scripts/pi-setup.sh"
