// === Provider Icon Map (same CDN URLs as ai.ezif.in) ===
const PROVIDER_ICONS = {
  anthropic: 'https://svgstack.com/media/img/claude-logo-6FGW382926.webp',
  openai: 'https://svgstack.com/media/img/chatgpt-logo-hyKG382924.webp',
  google: 'https://svgstack.com/media/img/gemini-logo-P9mq386067.webp',
  xai: 'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/grok.png',
  qwen: 'https://unpkg.com/@lobehub/icons-static-png@latest/light/qwen-color.png',
  deepseek: 'https://svgstack.com/media/img/deepseek-logo-TrLl386065.webp',
  meta: 'https://unpkg.com/@lobehub/icons-static-png@latest/light/meta-color.png',
  microsoft: 'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/microsoft-color.png',
  mistral: 'https://svgstack.com/media/img/mistral-ai-logo-1N5p386073.webp',
  minimax: 'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/minimax-color.png',
  moonshot: 'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/kimi.png',
  nvidia: 'https://svgstack.com/media/img/nvidia-logo-pv5D386076.webp',
  zhipu: 'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/zai.png',
  kivest: 'https://svgstack.com/media/img/chatgpt-logo-hyKG382924.webp',
  sarvam: 'https://i.ibb.co/W4m5pZZ6/image.png',
  xiaomi: 'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/xiaomimimo.png',
  bytedance: 'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/bytedance-color.png',
  stepfun: 'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/stepfun-color.png',
  'openai-oss': 'https://svgstack.com/media/img/chatgpt-logo-hyKG382924.webp',
};

// Special icon overrides for specific model patterns
function getModelIcon(modelId, ownedBy) {
  if (modelId.includes('codex')) {
    return 'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/light/codex.png';
  }
  if (modelId.includes('veo')) {
    return 'https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/dark/deepmind-color.png';
  }
  return PROVIDER_ICONS[ownedBy] || null;
}

// === State ===
let statusData = null;
let historyData = null;
let activeProvider = 'all';
let activeStatusFilter = null;
let filterReasoning = false;
let searchQuery = '';
let autoRefreshInterval = null;

// === DOM refs ===
const $grid = document.getElementById('model-grid');
const $loading = document.getElementById('loading-screen');
const $systemStatus = document.getElementById('system-status');
const $systemStatusText = document.getElementById('system-status-text');
const $heroTitle = document.getElementById('hero-title');
const $heroSubtitle = document.getElementById('hero-subtitle');
const $lastUpdated = document.getElementById('last-updated');
const $searchInput = document.getElementById('search-input');
const $statOnline = document.getElementById('stat-online');
const $statDown = document.getElementById('stat-down');
const $statUptime = document.getElementById('stat-uptime');
const $statTotal = document.getElementById('stat-total');

// === Data Fetching ===
async function fetchData() {
  try {
    const [statusRes, historyRes] = await Promise.all([
      fetch('data/status.json?' + Date.now()),
      fetch('data/history.json?' + Date.now())
    ]);
    statusData = await statusRes.json();
    historyData = await historyRes.json();
    return true;
  } catch (err) {
    console.error('Failed to fetch data:', err);
    return false;
  }
}

// === Rendering ===
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(isoString) {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusLabel(status) {
  switch (status) {
    case 'operational': return 'Operational';
    case 'down': return 'Down';
    case 'paid_only': return 'Paid Only';
    default: return 'Unknown';
  }
}

function getModels() {
  if (!statusData?.models) return [];
  return Object.values(statusData.models);
}

function getFilteredModels() {
  let models = getModels();

  if (activeProvider !== 'all') {
    models = models.filter(m => (m.ownedBy || '').toLowerCase() === activeProvider);
  }

  if (filterReasoning) {
    models = models.filter(m => m.supportsReasoning);
  }

  if (activeStatusFilter === 'online') {
    models = models.filter(m => m.status === 'operational');
  } else if (activeStatusFilter === 'offline') {
    models = models.filter(m => m.status === 'down');
  } else if (activeStatusFilter === 'paid') {
    models = models.filter(m => m.status === 'paid_only');
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    models = models.filter(m =>
      m.id.toLowerCase().includes(q) ||
      (m.ownedBy || '').toLowerCase().includes(q)
    );
  }

  // Sort: operational first, then paid, then by name
  models.sort((a, b) => {
    const order = { operational: 0, paid_only: 1, unknown: 2, down: 3 };
    const diff = (order[a.status] ?? 2) - (order[b.status] ?? 2);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  return models;
}

function getModelHistory(modelId) {
  if (!historyData) return [];
  const entries = [];
  for (const entry of historyData) {
    if (entry.statuses?.[modelId]) {
      entries.push({
        timestamp: entry.timestamp,
        ...entry.statuses[modelId]
      });
    }
  }
  return entries.slice(-48); // Last 48 entries for the timeline
}

function renderSummary() {
  const models = getModels();
  if (models.length === 0) {
    $systemStatus.className = 'system-status degraded';
    $systemStatusText.textContent = 'Loading...';
    $heroTitle.textContent = 'Model Status';
    $heroSubtitle.textContent = 'Waiting for data...';
    $statOnline.textContent = '-';
    $statDown.textContent = '-';
    $statUptime.textContent = '-';
    $statTotal.textContent = '-';
    return;
  }

  const operational = models.filter(m => m.status === 'operational').length;
  const down = models.filter(m => m.status === 'down').length;
  const paidOnly = models.filter(m => m.status === 'paid_only').length;
  const total = models.length;
  const onlinePercent = ((operational / total) * 100).toFixed(1);

  // Average uptime
  const uptimes = models.filter(m => m.uptime != null).map(m => m.uptime);
  const avgUptime = uptimes.length > 0
    ? (uptimes.reduce((a, b) => a + b, 0) / uptimes.length).toFixed(1)
    : '-';

  // System status
  if (down === 0 && paidOnly === 0) {
    $systemStatus.className = 'system-status operational';
    $systemStatusText.textContent = 'All Systems Operational';
  } else if (down > total * 0.5) {
    $systemStatus.className = 'system-status outage';
    $systemStatusText.textContent = 'Major Outage';
  } else if (down > 0) {
    $systemStatus.className = 'system-status degraded';
    $systemStatusText.textContent = 'Partial Outage';
  } else {
    $systemStatus.className = 'system-status operational';
    $systemStatusText.textContent = 'All Systems Operational';
  }

  $heroTitle.textContent = `${onlinePercent}% Online`;
  $heroSubtitle.textContent = `${operational} of ${total} models operational`;

  $statOnline.textContent = operational;
  $statDown.textContent = down;
  $statUptime.textContent = avgUptime !== '-' ? avgUptime + '%' : '-';
  $statTotal.textContent = total;

  // Last updated
  if (statusData?.lastRun) {
    $lastUpdated.textContent = `Last checked: ${timeAgo(statusData.lastRun)} · Run #${statusData.runCount || '?'}`;
  }
}

function renderModelCard(model) {
  const history = getModelHistory(model.id);
  const icon = getModelIcon(model.id, model.ownedBy);
  const uptimeClass = model.uptime >= 95 ? 'high' : model.uptime >= 80 ? 'medium' : 'low';
  const iconHTML = icon
    ? `<img class="model-icon" src="${icon}" alt="${model.ownedBy}" loading="lazy" onerror="this.style.display='none'">`
    : '';

  let timelineHTML = '';
  if (history.length > 0) {
    const segments = history.map(h => {
      const cls = h.status === 'operational' ? 'up' : h.status === 'paid_only' ? 'paid' : 'down';
      return `<div class="uptime-segment ${cls}" title="${new Date(h.timestamp).toLocaleString()}: ${statusLabel(h.status)}"></div>`;
    }).join('');
    // Pad with empty segments if fewer than 48
    const pad = Math.max(0, 48 - history.length);
    const padHTML = Array(pad).fill('<div class="uptime-segment unknown"></div>').join('');
    timelineHTML = `<div class="uptime-timeline">${padHTML}${segments}</div>`;
  } else {
    timelineHTML = `<div class="uptime-timeline">${Array(48).fill('<div class="uptime-segment unknown"></div>').join('')}</div>`;
  }

  const badges = [];
  if (model.supportsReasoning) {
    badges.push('<span class="badge badge-reasoning">⚡ Reasoning</span>');
  }
  if (model.isPaidOnly) {
    badges.push('<span class="badge badge-paid">💎 Paid</span>');
  }
  badges.push(`<span class="badge badge-provider">${model.ownedBy || 'unknown'}</span>`);

  // Response section — always present for all models
  let responseHTML = '';
  if (model.response) {
    responseHTML = `
      <div class="model-response-section">
        <div class="response-preview">
          <span class="response-label">Response:</span> <span class="response-text">${escapeHtml(model.response.slice(0, 200))}${model.response.length > 200 ? '...' : ''}</span>
        </div>
        <button class="expand-toggle" onclick="toggleExpand(this)" data-expanded="false">
          <svg class="expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          Show Full Response
        </button>
        <div class="expand-content" style="display:none">
          <div class="response-full"><span class="response-label">Full Response:</span>\n${escapeHtml(model.response)}</div>
          ${model.reasoningContent ? `<div class="reasoning-block"><span class="response-label">⚡ Reasoning:</span>\n${escapeHtml(model.reasoningContent)}</div>` : ''}
          ${model.rawResponse ? `<div class="raw-response-block"><button class="raw-toggle" onclick="toggleRaw(this)">Show RAW JSON</button><pre class="raw-json" style="display:none">${escapeHtml(JSON.stringify(model.rawResponse, null, 2))}</pre></div>` : ''}
        </div>
      </div>`;
  } else if (model.error) {
    responseHTML = `
      <div class="model-response-section">
        <div class="model-error"><span class="response-label">Error:</span> <span class="error-text">${escapeHtml(model.error.slice(0, 200))}${model.error.length > 200 ? '...' : ''}</span></div>
        <button class="expand-toggle" onclick="toggleExpand(this)" data-expanded="false">
          <svg class="expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          Show Details
        </button>
        <div class="expand-content" style="display:none">
          <div class="error-full"><span class="response-label">Full Error:</span>\n${escapeHtml(model.error)}</div>
          ${model.rawResponse ? `<div class="raw-response-block"><button class="raw-toggle" onclick="toggleRaw(this)">Show RAW JSON</button><pre class="raw-json" style="display:none">${escapeHtml(JSON.stringify(model.rawResponse, null, 2))}</pre></div>` : ''}
        </div>
      </div>`;
  } else if (model.status === 'operational') {
    // Operational but no response text stored (e.g. older runs)
    responseHTML = `
      <div class="model-response-section">
        <div class="response-preview">
          <span class="response-label">Response:</span> <span class="response-text" style="opacity:0.5">[No text content recorded]</span>
        </div>
        ${model.rawResponse ? `<button class="expand-toggle" onclick="toggleExpand(this)" data-expanded="false">
          <svg class="expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          Show RAW JSON
        </button>
        <div class="expand-content" style="display:none">
          <div class="raw-response-block"><button class="raw-toggle" onclick="toggleRaw(this)">Show RAW JSON</button><pre class="raw-json" style="display:none">${escapeHtml(JSON.stringify(model.rawResponse, null, 2))}</pre></div>
        </div>` : ''}
      </div>`;
  }

  return `
    <div class="model-card" data-model-id="${model.id}">
      <div class="model-card-header">
        ${iconHTML}
        <span class="model-name" title="${model.id}">${model.id}</span>
        <div class="model-status-dot ${model.status}"></div>
      </div>
      <div class="model-card-meta">
        <span class="badge badge-status ${model.status}">${statusLabel(model.status)}</span>
        ${badges.join('')}
      </div>
      ${responseHTML}
      ${timelineHTML}
      ${model.uptime != null ? `
        <div class="uptime-bar-container">
          <div class="uptime-bar-label">
            <span class="uptime-bar-text">24h Uptime</span>
            <span class="uptime-bar-value ${uptimeClass}">${model.uptime}%</span>
          </div>
          <div class="uptime-bar">
            <div class="uptime-bar-fill ${uptimeClass}" style="width: ${model.uptime}%"></div>
          </div>
        </div>
      ` : ''}
      <div class="model-card-footer">
        <div class="response-time">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${model.responseTime != null ? `${(model.responseTime / 1000).toFixed(1)}s` : '-'}
        </div>
        <span>${model.lastChecked ? timeAgo(model.lastChecked) : 'Not tested'}</span>
      </div>
    </div>
  `;
}

// Expand/collapse response section
function toggleExpand(btn) {
  const content = btn.nextElementSibling;
  const expanded = btn.dataset.expanded === 'true';
  if (expanded) {
    content.style.display = 'none';
    btn.dataset.expanded = 'false';
    btn.innerHTML = '<svg class="expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg> Show Full Response';
  } else {
    content.style.display = 'block';
    btn.dataset.expanded = 'true';
    btn.innerHTML = '<svg class="expand-icon rotated" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg> Hide';
  }
}

// Toggle raw JSON visibility
function toggleRaw(btn) {
  const pre = btn.nextElementSibling;
  if (pre.style.display === 'none') {
    pre.style.display = 'block';
    btn.textContent = 'Hide RAW JSON';
  } else {
    pre.style.display = 'none';
    btn.textContent = 'Show RAW JSON';
  }
}

function renderGrid() {
  const models = getFilteredModels();
  if (models.length === 0) {
    $grid.innerHTML = '<div class="no-results">No models found matching your filters.</div>';
    return;
  }
  $grid.innerHTML = models.map(renderModelCard).join('');
}

function renderAll() {
  renderSummary();
  renderGrid();
}

// === Filters ===
function buildProviderTabs() {
  const models = getModels();
  const providers = new Set(models.map(m => (m.ownedBy || 'unknown').toLowerCase()));
  const $tabs = document.getElementById('provider-tabs');
  if (!$tabs) return;
  let html = '<button class="filter-tab active" data-provider="all">All</button>';
  const sorted = [...providers].sort();
  for (const p of sorted) {
    const label = p.charAt(0).toUpperCase() + p.slice(1);
    html += `<button class="filter-tab" data-provider="${p}">${label}</button>`;
  }
  $tabs.innerHTML = html;

  $tabs.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $tabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeProvider = tab.dataset.provider;
      renderGrid();
    });
  });
}

function setupFilters() {
  buildProviderTabs();

  // Status filter buttons
  document.querySelectorAll('.filter-status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.status;
      if (activeStatusFilter === filter) {
        activeStatusFilter = null;
        btn.classList.remove('active-green', 'active-red', 'active-amber');
      } else {
        document.querySelectorAll('.filter-status-btn').forEach(b => b.classList.remove('active-green', 'active-red', 'active-amber'));
        activeStatusFilter = filter;
        if (filter === 'online') btn.classList.add('active-green');
        else if (filter === 'paid') btn.classList.add('active-amber');
        else btn.classList.add('active-red');
      }
      renderGrid();
    });
  });

  // Reasoning filter
  const $reasoningBtn = document.getElementById('filter-reasoning');
  if ($reasoningBtn) {
    $reasoningBtn.addEventListener('click', () => {
      filterReasoning = !filterReasoning;
      $reasoningBtn.classList.toggle('active-purple', filterReasoning);
      renderGrid();
    });
  }

  // Search
  $searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderGrid();
  });
}

// === Auto Refresh ===
function startAutoRefresh() {
  autoRefreshInterval = setInterval(async () => {
    const ok = await fetchData();
    if (ok) renderAll();
  }, 60000); // Refresh every 60s
}

// === Theme Toggle ===
function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

// === Init ===
initTheme();

async function init() {
  const ok = await fetchData();
  if (ok) {
    renderAll();
  }
  $loading.classList.add('hidden');
  setupFilters();
  startAutoRefresh();

  // Theme toggle
  const $toggle = document.getElementById('theme-toggle');
  if ($toggle) $toggle.addEventListener('click', toggleTheme);

  // Update time-ago labels every 30s
  setInterval(() => {
    renderAll();
  }, 30000);
}

document.addEventListener('DOMContentLoaded', init);
