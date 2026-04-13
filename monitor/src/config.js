const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, '');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const monitorRoot = path.resolve(__dirname, '..');
loadEnvFile(path.join(monitorRoot, '.env'));

function toNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = {
  monitorRoot,
  host: process.env.MONITOR_HOST || '127.0.0.1',
  port: toNumber(process.env.MONITOR_PORT, 3010),
  username: process.env.MONITOR_USERNAME || '',
  password: process.env.MONITOR_PASSWORD || '',
  targetName: process.env.MONITOR_TARGET_NAME || 'bottabomma',
  logLines: toNumber(process.env.MONITOR_LOG_LINES, 120),
  diskPath: process.env.MONITOR_DISK_PATH || '/',
  botLogFile: process.env.BOT_LOG_FILE || '',
  ngrokApiUrl: process.env.NGROK_API_URL || 'http://127.0.0.1:4040/api/tunnels',
  publicDir: path.join(monitorRoot, 'public')
};
