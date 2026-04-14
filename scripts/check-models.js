const fs = require('fs');
const path = require('path');

const API_BASE = (process.env.API_PROXY_URL || 'https://ai.ezif.in').replace(/\/+$/, '');
const API_KEY = process.env.KIVEST_API_KEY;
const PROXY_TOKEN = process.env.PROXY_TOKEN || null;
const DATA_DIR = path.join(__dirname, '..', 'data');
const STATUS_FILE = path.join(DATA_DIR, 'status.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

const MAX_HISTORY_ENTRIES = 288; // 24h at 5-min intervals
const BATCH_SIZE = 4;
const BATCH_DELAY_MS = 13000; // 13s between batches (safe under 5/10s burst)

// Non-LLM models to exclude (image generation, video generation, slides, deep-research)
const EXCLUDED_MODELS = new Set([
  'qwen-image', 'glm-image', 'gpt-image-1', 'gpt-image-1.5',
  'gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview', 'grok-image',
  'qwen-video', 'grok-video', 'veo-3.1',
  'qwen-slides', 'qwen-deep-research'
]);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchModels() {
  // Helper: add proxy token if configured
  const proxyHeader = PROXY_TOKEN ? { 'x-proxy-token': PROXY_TOKEN } : {};

  // Prefer documented auth flow first, then fallback without auth if needed.
  for (const authHeaders of [{ 'Authorization': `Bearer ${API_KEY}` }, {}]) {
    try {
      const url = `${API_BASE}/v1/models`;
      const res = await fetch(url, { headers: { ...proxyHeader, ...authHeaders } });
      if (res.ok) {
        const data = await res.json();
        return (data.data || []).filter(m => !EXCLUDED_MODELS.has(m.id));
      }
      const body = await res.text();
      console.warn(`/v1/models returned ${res.status} (auth=${!!authHeaders.Authorization}): ${body.slice(0, 200)}`);
    } catch (err) {
      console.warn(`/v1/models fetch failed (auth=${!!authHeaders.Authorization}): ${err.message}`);
    }
  }
  // Fallback: use model list from previous status.json
  console.warn('Live model list unavailable, falling back to cached status.json');
  try {
    const cached = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
    const ids = Object.keys(cached.models || {});
    if (ids.length > 0) {
      return ids.filter(id => !EXCLUDED_MODELS.has(id)).map(id => ({
        id,
        owned_by: cached.models[id].ownedBy || 'unknown'
      }));
    }
  } catch {}
  throw new Error('Failed to fetch models from API and no cached data available');
}

/**
 * Test a single LLM model.
 * Sends include_thinking: true + stream: false to detect reasoning support.
 * Detects paid-only via: "does not have access to model" error message.
 */
async function testModel(modelId) {
  const start = Date.now();
  try {
    const res = await fetch(`${API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        ...(PROXY_TOKEN ? { 'x-proxy-token': PROXY_TOKEN } : {})
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Which LLM are you?' }],
        max_tokens: 60,
        stream: false,
        include_thinking: true
      }),
      signal: AbortSignal.timeout(45000)
    });
    const elapsed = Date.now() - start;

    // Handle non-JSON responses (e.g. proxy errors)
    const contentType = res.headers.get('content-type') || '';
    let body;
    if (contentType.includes('application/json')) {
      body = await res.json();
    } else {
      const text = await res.text();
      return {
        status: 'down',
        responseTime: elapsed,
        isPaidOnly: false,
        supportsReasoning: false,
        response: null,
        error: `HTTP ${res.status}: ${text.slice(0, 200)}`
      };
    }

    if (!res.ok) {
      const errMsg = body?.error?.message || '';
      // Paid model detection: exact error from Kivest API
      const isPaid = errMsg.includes('does not have access to model');
      return {
        status: isPaid ? 'paid_only' : 'down',
        responseTime: elapsed,
        isPaidOnly: isPaid,
        supportsReasoning: false,
        response: null,
        error: errMsg.slice(0, 200)
      };
    }

    // Detect reasoning support from the response
    const choice = body?.choices?.[0];
    const hasReasoningContent = !!(
      choice?.message?.reasoning_content ||
      choice?.message?.reasoning
    );
    const hasReasoningTokens = (body?.usage?.reasoning_tokens || 0) > 0;
    const responseText = (choice?.message?.content || '').trim().slice(0, 300);

    return {
      status: 'operational',
      responseTime: elapsed,
      isPaidOnly: false,
      supportsReasoning: hasReasoningContent || hasReasoningTokens,
      response: responseText || null,
      error: null
    };
  } catch (err) {
    return {
      status: 'down',
      responseTime: Date.now() - start,
      isPaidOnly: false,
      supportsReasoning: false,
      response: null,
      error: (err.name === 'TimeoutError' ? 'Timeout (45s)' : `${err.name}: ${err.message}`).slice(0, 200)
    };
  }
}

async function main() {
  if (!API_KEY) {
    console.error('KIVEST_API_KEY environment variable is required');
    process.exit(1);
  }

  // Load existing data
  let statusData;
  try {
    statusData = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
  } catch {
    statusData = { lastRun: null, runCount: 0, models: {} };
  }

  let history;
  try {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
  } catch {
    history = [];
  }

  const runCount = (statusData.runCount || 0) + 1;
  const now = new Date().toISOString();

  // Fetch LLM models only
  console.log('Fetching model list...');
  const models = await fetchModels();
  console.log(`Found ${models.length} LLM models (excluded ${EXCLUDED_MODELS.size} non-LLM models)`);
  console.log(`Run #${runCount}`);

  // Build test queue
  const testQueue = models.map(m => ({
    id: m.id,
    ownedBy: m.owned_by
  }));

  console.log(`Testing ${testQueue.length} models in batches of ${BATCH_SIZE}...`);

  // Process in batches
  const results = {};
  for (let i = 0; i < testQueue.length; i += BATCH_SIZE) {
    const batch = testQueue.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(testQueue.length / BATCH_SIZE);
    console.log(`Batch ${batchNum}/${totalBatches}: ${batch.map(m => m.id).join(', ')}`);

    const promises = batch.map(async (model) => {
      const result = await testModel(model.id);
      return { ...model, ...result };
    });

    const batchResults = await Promise.all(promises);
    for (const r of batchResults) {
      results[r.id] = r;
      const emoji = r.status === 'operational' ? '✓' :
                     r.status === 'paid_only' ? '$' : '✗';
      const extras = [];
      if (r.supportsReasoning) extras.push('reasoning');
      if (r.isPaidOnly) extras.push('paid');
      const extraStr = extras.length ? ` [${extras.join(', ')}]` : '';
      console.log(`  ${emoji} ${r.id}: ${r.status} (${r.responseTime}ms)${extraStr}`);
    }

    // Wait between batches (except after the last one)
    if (i + BATCH_SIZE < testQueue.length) {
      console.log(`  Waiting ${BATCH_DELAY_MS / 1000}s...`);
      await sleep(BATCH_DELAY_MS);
    }
  }

  // Merge results with existing status data
  const updatedModels = {};
  for (const model of models) {
    const id = model.id;
    const prev = statusData.models?.[id];
    if (results[id]) {
      // Preserve reasoning flag if previously detected (reasoning is sticky)
      const prevReasoning = prev?.supportsReasoning || false;
      updatedModels[id] = {
        id,
        ownedBy: model.owned_by,
        status: results[id].status,
        responseTime: results[id].responseTime,
        supportsReasoning: results[id].supportsReasoning || prevReasoning,
        isPaidOnly: results[id].isPaidOnly,
        response: results[id].response,
        error: results[id].error,
        lastChecked: now
      };
    } else {
      updatedModels[id] = prev || {
        id,
        ownedBy: model.owned_by,
        status: 'unknown',
        responseTime: null,
        supportsReasoning: false,
        isPaidOnly: false,
        response: null,
        error: null,
        lastChecked: null
      };
    }
  }

  // Build history entry
  const historyEntry = {
    timestamp: now,
    runCount,
    statuses: {}
  };
  for (const [id, m] of Object.entries(results)) {
    historyEntry.statuses[id] = {
      status: m.status,
      responseTime: m.responseTime
    };
  }
  history.push(historyEntry);

  // Trim history
  if (history.length > MAX_HISTORY_ENTRIES) {
    history = history.slice(-MAX_HISTORY_ENTRIES);
  }

  // Calculate uptime per model from history
  const uptimeMap = {};
  for (const entry of history) {
    for (const [id, s] of Object.entries(entry.statuses)) {
      if (!uptimeMap[id]) uptimeMap[id] = { total: 0, up: 0 };
      uptimeMap[id].total++;
      if (s.status === 'operational') uptimeMap[id].up++;
    }
  }
  for (const [id, u] of Object.entries(uptimeMap)) {
    if (updatedModels[id]) {
      updatedModels[id].uptime = u.total > 0
        ? parseFloat(((u.up / u.total) * 100).toFixed(2))
        : null;
      updatedModels[id].totalChecks = u.total;
    }
  }

  // Write status.json
  const finalStatus = {
    lastRun: now,
    runCount,
    totalModels: models.length,
    models: updatedModels
  };

  fs.writeFileSync(STATUS_FILE, JSON.stringify(finalStatus, null, 2));
  console.log(`\nWrote ${STATUS_FILE}`);

  // Write history.json
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history));
  console.log(`Wrote ${HISTORY_FILE}`);

  // Summary
  const statuses = Object.values(updatedModels);
  const operational = statuses.filter(m => m.status === 'operational').length;
  const down = statuses.filter(m => m.status === 'down').length;
  const paidOnly = statuses.filter(m => m.status === 'paid_only').length;
  const reasoning = statuses.filter(m => m.supportsReasoning).length;

  console.log(`\n=== Summary ===`);
  console.log(`Operational: ${operational} | Down: ${down} | Paid Only: ${paidOnly}`);
  console.log(`Reasoning-capable: ${reasoning}`);
  console.log(`Total LLMs: ${models.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
