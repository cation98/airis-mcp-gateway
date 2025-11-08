const { app, Menu, Tray, nativeImage, shell, dialog } = require('electron');

const API_BASE = process.env.MCP_GATEWAY_API ?? 'http://localhost:9100/api/v1';
const DASHBOARD_URL = process.env.MCP_GATEWAY_DASHBOARD ?? 'http://ui.gateway.localhost:5174';
const REFRESH_INTERVAL = Number(process.env.MCP_GATEWAY_REFRESH_MS ?? 10000);

let tray;
let summaryCache = null;
let refreshTimer;
let isRefreshing = false;

const ICON_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAQlBMVEUAAAD////////////////////////////////////////////////////////////h4eHu7u77+/vX19fQ0ND9/f37+/vi4uK5ubmxsbGgoKB6enpjY2P8/PwVoFH4AAAAFHRSTlMAAQMEBxAaIygqLjE0PkRja3+Q0dna8depAAAAK0lEQVQY022OQRKAIAwDHdR2W9r//5uGKylNAAQ4EztJMUCrg8PUoZDQG1wW8xHAXqHjo6whGw4DG+A1YgAAAABJRU5ErkJggg==';

function createTrayIcon() {
  try {
    const image = nativeImage.createFromBuffer(Buffer.from(ICON_BASE64, 'base64'));
    image.setTemplateImage(true);
    return image;
  } catch (error) {
    console.error('Failed to create tray icon', error);
    return nativeImage.createEmpty();
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${body}`);
  }
  return response.json();
}

async function fetchSummary() {
  const data = await fetchJson(`${API_BASE}/dashboard/summary`);
  return data;
}

function formatServerLabel(server) {
  const statusGlyph = server.enabled ? '●' : '○';
  const keyGlyph = server.api_key_required && !server.api_key_configured ? ' ⚠︎' : '';
  return `${statusGlyph} ${server.name}${keyGlyph}`;
}

function openDashboard(fragment = '') {
  const target = fragment ? `${DASHBOARD_URL}${fragment}` : DASHBOARD_URL;
  shell.openExternal(target);
}

async function handleToggle(server) {
  const desiredState = !server.enabled;
  try {
    await fetchJson(`${API_BASE}/server-states/${server.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: desiredState })
    });
    await refreshSummary();
  } catch (error) {
    console.error('Failed to toggle server', error);
    dialog.showErrorBox('Toggle failed', `Could not update ${server.name}: ${error.message}`);
  }
}

function buildServerSubmenu(server) {
  const items = [];
  if (server.api_key_required && !server.api_key_configured) {
    items.push({ label: 'API key missing', enabled: false });
  }
  const toggleEnabled = !server.api_key_required || server.api_key_configured;
  items.push({
    label: server.enabled ? 'Disable server' : 'Enable server',
    enabled: toggleEnabled,
    click: () => handleToggle(server)
  });
  items.push({
    label: 'Open dashboard…',
    click: () => openDashboard(`#${server.id}`)
  });
  return items;
}

function buildMenu() {
  const template = [];
  if (!summaryCache) {
    template.push({ label: 'Loading summary…', enabled: false });
  } else {
    const { stats, servers } = summaryCache;
    template.push({
      label: `AIRIS MCP — ${stats.active}/${stats.total} active`,
      enabled: false
    });
    template.push({
      label: `API keys missing: ${stats.api_key_missing}`,
      enabled: false
    });
    template.push({ type: 'separator' });

    const sortedServers = [...servers].sort((a, b) => {
      if (a.enabled === b.enabled) {
        return a.name.localeCompare(b.name);
      }
      return a.enabled ? -1 : 1;
    });

    sortedServers.forEach((server) => {
      template.push({
        label: formatServerLabel(server),
        submenu: buildServerSubmenu(server)
      });
    });
  }

  template.push({ type: 'separator' });
  template.push({ label: 'Refresh now', click: () => refreshSummary(true) });
  template.push({ label: 'Open dashboard…', click: () => openDashboard() });
  template.push({ type: 'separator' });
  template.push({ role: 'quit', label: 'Quit' });

  tray.setContextMenu(Menu.buildFromTemplate(template));
}

async function refreshSummary(showErrors = false) {
  if (isRefreshing) {
    return;
  }
  isRefreshing = true;
  try {
    summaryCache = await fetchSummary();
  } catch (error) {
    console.error('Failed to load dashboard summary', error);
    summaryCache = null;
    if (showErrors) {
      dialog.showErrorBox('Refresh failed', error.message);
    }
  } finally {
    isRefreshing = false;
    buildMenu();
  }
}

function startAutoRefresh() {
  refreshTimer = setInterval(() => {
    void refreshSummary();
  }, REFRESH_INTERVAL);
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = undefined;
  }
}

app.whenReady().then(() => {
  if (app.dock?.hide) {
    app.dock.hide();
  }
  tray = new Tray(createTrayIcon());
  tray.setToolTip('AIRIS MCP Gateway');
  Menu.setApplicationMenu(null);
  buildMenu();
  void refreshSummary(true);
  startAutoRefresh();
});

app.on('before-quit', () => {
  stopAutoRefresh();
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});
