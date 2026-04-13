const ids = {
  statusPill: document.getElementById('status-pill'),
  botStatus: document.getElementById('bot-status'),
  botPid: document.getElementById('bot-pid'),
  botUptime: document.getElementById('bot-uptime'),
  botRestarts: document.getElementById('bot-restarts'),
  botCpu: document.getElementById('bot-cpu'),
  botRam: document.getElementById('bot-ram'),
  botStarted: document.getElementById('bot-started'),
  hostName: document.getElementById('host-name'),
  sysCpu: document.getElementById('sys-cpu'),
  sysLoad: document.getElementById('sys-load'),
  sysMemory: document.getElementById('sys-memory'),
  sysDisk: document.getElementById('sys-disk'),
  sysPlatform: document.getElementById('sys-platform'),
  sysUptime: document.getElementById('sys-uptime'),
  lastRefresh: document.getElementById('last-refresh'),
  monitorStatus: document.getElementById('monitor-status'),
  ngrokStatus: document.getElementById('ngrok-status'),
  ngrokUrl: document.getElementById('ngrok-url'),
  ngrokTarget: document.getElementById('ngrok-target'),
  ngrokName: document.getElementById('ngrok-name'),
  logs: document.getElementById('logs'),
  refreshButton: document.getElementById('refresh-button')
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = bytes;
  let unitIndex = 0;

  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }

  const rounded = amount >= 10 || unitIndex === 0 ? amount.toFixed(0) : amount.toFixed(1);
  return `${rounded} ${units[unitIndex]}`;
}

function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return 'n/a';
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDate(value) {
  if (!value) {
    return 'n/a';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'n/a';
  }

  return date.toLocaleString();
}

function render(summary) {
  const bot = summary.bot;
  const system = summary.system;
  const disk = system.disk;
  const ngrok = summary.ngrok || {};

  ids.statusPill.textContent = bot.healthy ? 'Bot online' : 'Bot needs attention';
  ids.statusPill.className = `pulse ${bot.healthy ? 'ok' : 'warn'}`;

  ids.botStatus.textContent = bot.status;
  ids.botPid.textContent = bot.pid || 'n/a';
  ids.botUptime.textContent = formatDuration(bot.uptimeSeconds);
  ids.botRestarts.textContent = bot.restarts ?? 'n/a';
  ids.botCpu.textContent = `${bot.cpuPercent || 0}%`;
  ids.botRam.textContent = bot.memoryLabel || formatBytes(bot.memoryBytes || 0);
  ids.botStarted.textContent = formatDate(bot.startedAt);
  ids.hostName.textContent = system.hostname;

  ids.sysCpu.textContent = `${system.cpuUsagePercent}%`;
  ids.sysLoad.textContent = `${system.cpuLoad1m}`;
  ids.sysMemory.textContent = `${system.memory.usedLabel} / ${system.memory.totalLabel} (${system.memory.usedPercent}%)`;
  ids.sysDisk.textContent = disk
    ? `${formatBytes(disk.usedBytes)} / ${formatBytes(disk.totalBytes)} (${disk.usedPercent}%)`
    : 'n/a';
  ids.sysPlatform.textContent = system.platform;
  ids.sysUptime.textContent = formatDuration(system.uptimeSeconds);
  ids.lastRefresh.textContent = formatDate(summary.timestamp);
  ids.monitorStatus.textContent = summary.monitor.status;
  ids.ngrokStatus.textContent = ngrok.status || 'unknown';
  ids.ngrokUrl.textContent = ngrok.publicUrl || (ngrok.error ? `Unavailable (${ngrok.error})` : 'Not running');
  ids.ngrokTarget.textContent = ngrok.forwardsTo || 'n/a';
  ids.ngrokName.textContent = ngrok.name || 'n/a';
  ids.logs.textContent = (summary.logs.combined || []).join('\n') || 'No logs available yet.';
}

async function refresh() {
  try {
    const response = await fetch('/api/summary', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const summary = await response.json();
    render(summary);
  } catch (error) {
    ids.statusPill.textContent = 'Monitor unavailable';
    ids.statusPill.className = 'pulse warn';
    ids.logs.textContent = `Unable to load dashboard data: ${error.message}`;
  }
}

ids.refreshButton.addEventListener('click', refresh);
refresh();
setInterval(refresh, 5000);
