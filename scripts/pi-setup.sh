#!/bin/bash
# ============================================================
# Bottabomma Raspberry Pi Setup Script
# Run this on the Pi after transferring the bundle
# Safe version: sets up swap FIRST, does NOT auto-start the bot
# ============================================================
set -e

# Detect where this script lives — app dir is its parent
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
BUNDLE="$APP_DIR/bottabomma-deploy.tar.gz"

# If bundle isn't next to the app, check home dir
if [ ! -f "$BUNDLE" ]; then
    BUNDLE="$HOME/bottabomma-deploy.tar.gz"
fi

echo "🍓 Bottabomma Pi Setup"
echo "======================"
echo "   App dir: $APP_DIR"
echo ""

# ----------------------------------------------------------
# Fix locale warning if present
# ----------------------------------------------------------
if ! locale -a 2>/dev/null | grep -q "en_US.utf8"; then
    echo "🌐 Fixing locale..."
    sudo sed -i 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen 2>/dev/null || true
    sudo locale-gen en_US.UTF-8 2>/dev/null || true
fi

# ----------------------------------------------------------
# Step 1: SWAP FIRST — prevents OOM crashes that corrupt SD
# ----------------------------------------------------------
echo "💾 [1/7] Setting up swap (prevents memory crashes)..."
CURRENT_SWAP=$(free -m | awk '/Swap/ {print $2}')
if [ "$CURRENT_SWAP" -lt 512 ] 2>/dev/null; then
    sudo dphys-swapfile swapoff 2>/dev/null || true
    echo "CONF_SWAPSIZE=1024" | sudo tee /etc/dphys-swapfile > /dev/null
    sudo dphys-swapfile setup
    sudo dphys-swapfile swapon
    echo "   ✅ 1GB swap enabled"
else
    echo "   ✅ Swap already configured (${CURRENT_SWAP}MB)"
fi
free -h | grep Swap

# ----------------------------------------------------------
# Step 2: System dependencies
# ----------------------------------------------------------
echo "📦 [2/7] Installing system dependencies..."
sudo apt update -qq

# RPi OS Bookworm uses 'chromium', older versions use 'chromium-browser'
CHROMIUM_PKG="chromium"
if ! apt-cache show chromium &>/dev/null; then
    if apt-cache show chromium-browser &>/dev/null; then
        CHROMIUM_PKG="chromium-browser"
    fi
fi

sudo apt install -y -qq \
    $CHROMIUM_PKG \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    fonts-liberation \
    curl \
    tmux

# Find the actual chromium binary path
CHROMIUM_BIN=""
for candidate in /usr/bin/chromium /usr/bin/chromium-browser; do
    if [ -x "$candidate" ]; then
        CHROMIUM_BIN="$candidate"
        break
    fi
done

if [ -z "$CHROMIUM_BIN" ]; then
    echo "❌ Could not find chromium binary after install!"
    exit 1
fi
echo "   Chromium binary: $CHROMIUM_BIN"

# ----------------------------------------------------------
# Step 3: Node.js (v20 LTS)
# ----------------------------------------------------------
if command -v node &>/dev/null; then
    NODE_VER=$(node -v)
    echo "✅ [3/7] Node.js already installed: $NODE_VER"
else
    echo "📦 [3/7] Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
    sudo apt install -y -qq nodejs
    echo "   Installed: $(node -v)"
fi

# ----------------------------------------------------------
# Step 4: Extract bundle (if not already extracted)
# ----------------------------------------------------------
if [ -f "$BUNDLE" ]; then
    echo "📂 [4/7] Extracting bundle..."
    tar -xzf "$BUNDLE" -C "$APP_DIR"
    echo "   Extracted to $APP_DIR"
else
    echo "✅ [4/7] Already extracted (no bundle tar.gz found, skipping)"
fi

# ----------------------------------------------------------
# Step 5: Configure .env for Pi
# ----------------------------------------------------------
echo "⚙️  [5/7] Configuring for Raspberry Pi..."

if [ ! -f "$APP_DIR/.env" ]; then
    echo "❌ .env file not found at $APP_DIR/.env"
    exit 1
fi

# Add/update CHROMIUM_PATH
if grep -q "^CHROMIUM_PATH=" "$APP_DIR/.env"; then
    sed -i "s|^CHROMIUM_PATH=.*|CHROMIUM_PATH=$CHROMIUM_BIN|" "$APP_DIR/.env"
    echo "   Updated CHROMIUM_PATH=$CHROMIUM_BIN"
elif grep -q "CHROMIUM_PATH" "$APP_DIR/.env"; then
    sed -i "s|^#.*CHROMIUM_PATH=.*|CHROMIUM_PATH=$CHROMIUM_BIN|" "$APP_DIR/.env"
    echo "   Enabled CHROMIUM_PATH=$CHROMIUM_BIN"
else
    echo "" >> "$APP_DIR/.env"
    echo "# Raspberry Pi: use system Chromium" >> "$APP_DIR/.env"
    echo "CHROMIUM_PATH=$CHROMIUM_BIN" >> "$APP_DIR/.env"
    echo "   Added CHROMIUM_PATH=$CHROMIUM_BIN"
fi

# ----------------------------------------------------------
# Step 6: Install npm dependencies (skip Chromium download)
# ----------------------------------------------------------
echo "📦 [6/7] Installing npm dependencies (skipping Chromium download)..."
cd "$APP_DIR"
PUPPETEER_SKIP_DOWNLOAD=true npm install --production
echo "   Done. node_modules size: $(du -sh node_modules | cut -f1)"

# ----------------------------------------------------------
# Step 7: Install PM2 (but do NOT start the bot yet)
# ----------------------------------------------------------
echo "🚀 [7/7] Installing PM2..."
if ! command -v pm2 &>/dev/null; then
    sudo npm install -g pm2
fi

# Cleanup bundle to save space
if [ -f "$BUNDLE" ]; then
    rm -f "$BUNDLE"
    echo "   Deleted bundle to save space"
fi

sudo apt clean

echo ""
echo "============================================"
echo "  ✅ Setup complete!"
echo "============================================"
echo ""
echo "  Memory status:"
free -h
echo ""
echo "============================================"
echo "  NEXT STEP: Start the bot inside tmux"
echo "  (so SSH disconnect won't kill it)"
echo "============================================"
echo ""
echo "  Run these commands:"
echo ""
echo "    tmux new -s bomma"
echo "    cd $APP_DIR && node src/index.js"
echo ""
echo "  Scan the QR code, then press Ctrl+B then D"
echo "  to detach from tmux."
echo ""
echo "  Then set up PM2 for auto-start:"
echo ""
echo "    cd $APP_DIR"
echo "    pm2 start src/index.js --name bottabomma"
echo "    pm2 save"
echo "    sudo env PATH=\$PATH:\$(which node | xargs dirname) \$(which pm2) startup systemd -u \$USER --hp \$HOME"
echo "    pm2 save"
echo ""

# Cleanup bundle to save space
if [ -f "$BUNDLE" ]; then
    read -p "🗑️  Delete the bundle tar.gz to save space? [Y/n] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        rm -f "$BUNDLE"
        echo "   Deleted $BUNDLE"
    fi
fi
