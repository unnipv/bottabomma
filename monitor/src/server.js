const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const config = require('./config');

const execFileAsync = promisify(execFile);
const STATIC_FILES = {
  '/': { type: 'text/html; charset=utf-8', file: 'index.html' },
  '/app.js': { type: 'application/javascript; charset=utf-8', file: 'app.js' },
  '/styles.css': { type: 'text/css; charset=utf-8', file: 'styles.css' }
};
const cpuSample = {
  total: 0,
  idle: 0,
  usagePercent: 0,
  ready: false
};

updateCpuSample();

function readCpuTimes() {
  const stat = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0];
  const values = stat.trim().split(/\s+/).slice(1).map(Number);
  const idle = (values[3] || 0) + (values[4] || 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  return { idle, total };
}

function updateCpuSample() {
  try {
    const current = readCpuTimes();
    if (cpuSample.ready) {
      const totalDelta = current.total - cpuSample.total;
      const idleDelta = current.idle - cpuSample.idle;
      if (totalDelta > 0) {
        cpuSample.usagePercent = Math.max(
          0,
          Math.min(100, Number((((totalDelta - idleDelta) / totalDelta) * 100).toFixed(1)))
        );
      }
    }

    cpuSample.total = current.total;
    cpuSample.idle = current.idle;
    cpuSample.ready = true;
  } catch (error) {
    cpuSample.usagePercent = 0;
  }
}

function timingSafeMatch(input, expected) {
  const left = Buffer.from(input);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isAuthorized(request) {
  if (!config.username && !config.password) {
    return true;
  }

  const header = request.headers.authorization || '';
  if (!header.startsWith('Basic ')) {
    return false;
  }

  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) {
      return false;
    }

    const username = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);
    return timingSafeMatch(username, config.username) && timingSafeMatch(password, config.password);
  } catch (error) {
    return false;
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, payload, type = 'text/plain; charset=utf-8') {
  response.writeHead(statusCode, {
    'Content-Type': type,
    'Cache-Control': 'no-store'
  });
  response.end(payload);
}

async function serveStatic(response, pathname) {
  const asset = STATIC_FILES[pathname];
  if (!asset) {
    return false;
  }

  const filePath = path.join(config.publicDir, asset.file);
  const contents = await fsp.readFile(filePath);
  sendText(response, 200, contents, asset.type);
  return true;
}

async function readTail(filePath, lineLimit) {
  if (!filePath) {
    return [];
  }

  try {
    const handle = await fsp.open(filePath, 'r');
    try {
      const stats = await handle.stat();
      const bytesToRead = Math.min(stats.size, 64 * 1024);
      const buffer = Buffer.alloc(bytesToRead);

      if (bytesToRead > 0) {
        await handle.read(buffer, 0, bytesToRead, stats.size - bytesToRead);
      }

      const text = buffer.toString('utf8').trim();
      if (!text) {
        return [];
      }

      return text.split(/\r?\n/).slice(-lineLimit);
    } finally {
      await handle.close();
    }
  } catch (error) {
    return [`Unable to read ${filePath}: ${error.message}`];
  }
}

async function getDiskUsage() {
  try {
    const { stdout } = await execFileAsync('df', ['-kP', config.diskPath]);
    const lines = stdout.trim().split(/\r?\n/);
    const parts = (lines[1] || '').trim().split(/\s+/);
    if (parts.length < 6) {
      return null;
    }

    const totalKb = Number(parts[1]);
    const usedKb = Number(parts[2]);
    const availableKb = Number(parts[3]);

    return {
      mount: parts[5],
      totalBytes: totalKb * 1024,
      usedBytes: usedKb * 1024,
      freeBytes: availableKb * 1024,
      usedPercent: Number((((usedKb / totalKb) || 0) * 100).toFixed(1))
    };
  } catch (error) {
    return null;
  }
}

async function fetchJson(urlString) {
  const url = new URL(urlString);
  const client = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.get(url, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('error', reject);
    request.setTimeout(1500, () => {
      request.destroy(new Error('Request timed out'));
    });
  });
}

async function getNgrokSummary() {
  try {
    const payload = await fetchJson(config.ngrokApiUrl);
    const tunnels = Array.isArray(payload.tunnels) ? payload.tunnels : [];
    const httpTunnel = tunnels.find((item) => (item.public_url || '').startsWith('https://'))
      || tunnels.find((item) => (item.public_url || '').startsWith('http://'))
      || tunnels[0];

    if (!httpTunnel) {
      return {
        enabled: false,
        status: 'idle'
      };
    }

    return {
      enabled: true,
      status: 'online',
      name: httpTunnel.name || 'ngrok',
      publicUrl: httpTunnel.public_url || '',
      forwardsTo: httpTunnel.config && httpTunnel.config.addr ? httpTunnel.config.addr : ''
    };
  } catch (error) {
    return {
      enabled: false,
      status: 'offline',
      error: error.message
    };
  }
}

async function getPm2Process() {
  try {
    const { stdout } = await execFileAsync('pm2', ['jlist']);
    const processes = JSON.parse(stdout);
    return processes.find((item) => item.name === config.targetName) || null;
  } catch (error) {
    return null;
  }
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = value;
  let unitIndex = 0;

  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }

  return `${amount.toFixed(amount >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function safeCall(fn, fallback) {
  try {
    return fn();
  } catch (error) {
    return fallback;
  }
}

function getSystemSummary(disk) {
  const totalMemory = safeCall(() => os.totalmem(), 0);
  const freeMemory = safeCall(() => os.freemem(), 0);
  const usedMemory = totalMemory - freeMemory;
  const uptimeSeconds = safeCall(() => os.uptime(), null);
  const loadAverage = safeCall(() => os.loadavg(), [0, 0, 0]);

  return {
    hostname: safeCall(() => os.hostname(), 'unknown-host'),
    platform: `${safeCall(() => os.platform(), 'unknown')} ${safeCall(() => os.release(), '')}`.trim(),
    uptimeSeconds,
    cpuUsagePercent: cpuSample.usagePercent,
    cpuLoad1m: Number((loadAverage[0] || 0).toFixed(2)),
    memory: {
      totalBytes: totalMemory,
      usedBytes: usedMemory,
      freeBytes: freeMemory,
      usedPercent: totalMemory ? Number(((usedMemory / totalMemory) * 100).toFixed(1)) : 0,
      usedLabel: formatBytes(usedMemory),
      totalLabel: formatBytes(totalMemory)
    },
    disk
  };
}

function getProcessSummary(processInfo) {
  if (!processInfo) {
    return {
      found: false,
      name: config.targetName,
      status: 'not-found',
      healthy: false
    };
  }

  const monit = processInfo.monit || {};
  const env = processInfo.pm2_env || {};
  const startedAt = env.pm_uptime || null;

  return {
    found: true,
    name: processInfo.name,
    status: env.status || 'unknown',
    healthy: env.status === 'online',
    restarts: env.restart_time || 0,
    pid: processInfo.pid || null,
    cpuPercent: Number((monit.cpu || 0).toFixed ? (monit.cpu || 0).toFixed(1) : monit.cpu || 0),
    memoryBytes: monit.memory || 0,
    memoryLabel: formatBytes(monit.memory || 0),
    uptimeSeconds: startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null,
    startedAt,
    outLogPath: env.pm_out_log_path || '',
    errorLogPath: env.pm_err_log_path || ''
  };
}

async function getLogs(processSummary) {
  const lineLimit = config.logLines;

  if (processSummary.outLogPath || processSummary.errorLogPath) {
    const [outLines, errorLines] = await Promise.all([
      readTail(processSummary.outLogPath, lineLimit),
      readTail(processSummary.errorLogPath, lineLimit)
    ]);

    return {
      out: outLines,
      error: errorLines,
      combined: [...outLines.map((line) => `[out] ${line}`), ...errorLines.map((line) => `[err] ${line}`)]
        .slice(-lineLimit)
    };
  }

  if (config.botLogFile) {
    const lines = await readTail(config.botLogFile, lineLimit);
    return { out: lines, error: [], combined: lines };
  }

  return {
    out: [],
    error: [],
    combined: ['No PM2 log file found. Start the bot with PM2 or set BOT_LOG_FILE in monitor/.env.']
  };
}

async function buildSummary() {
  const [disk, pm2Process, ngrok] = await Promise.all([getDiskUsage(), getPm2Process(), getNgrokSummary()]);
  const processSummary = getProcessSummary(pm2Process);
  const logs = await getLogs(processSummary);

  return {
    timestamp: new Date().toISOString(),
    monitor: {
      status: 'online',
      version: '1.0.0'
    },
    system: getSystemSummary(disk),
    bot: processSummary,
    ngrok,
    logs
  };
}

function toDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return 'n/a';
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function createServer() {
  return http.createServer(async (request, response) => {
    if (!isAuthorized(request)) {
      response.writeHead(401, {
        'WWW-Authenticate': 'Basic realm="Bottabomma Monitor"'
      });
      response.end('Authentication required');
      return;
    }

    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const pathname = requestUrl.pathname;

    try {
      if (pathname === '/api/summary') {
        const summary = await buildSummary();
        sendJson(response, 200, summary);
        return;
      }

      if (pathname === '/api/health') {
        const pm2Process = await getPm2Process();
        const processSummary = getProcessSummary(pm2Process);
        sendJson(response, 200, {
          timestamp: new Date().toISOString(),
          monitor: 'online',
          bot: processSummary.status,
          healthy: processSummary.healthy
        });
        return;
      }

      if (await serveStatic(response, pathname)) {
        return;
      }

      sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
  });
}

function startServer() {
  updateCpuSample();
  setInterval(updateCpuSample, 5000);

  const server = createServer();
  server.listen(config.port, config.host, () => {
    const authState = config.username || config.password ? 'enabled' : 'disabled';
    console.log(`[monitor] listening on http://${config.host}:${config.port}`);
    console.log(`[monitor] auth ${authState} | target "${config.targetName}"`);
    console.log(`[monitor] sample uptime format: ${toDuration(safeCall(() => os.uptime(), 0))}`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  buildSummary,
  createServer,
  startServer
};
