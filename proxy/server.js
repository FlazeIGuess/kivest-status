const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3099;
const TARGET = 'https://ai.ezif.in';
const PROXY_TOKEN = process.env.PROXY_TOKEN;

// Constant-time comparison to prevent timing attacks
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const server = http.createServer((req, res) => {
  // Reject if no token configured (fail-closed)
  if (!PROXY_TOKEN) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy not configured' }));
    return;
  }

  // Authenticate request via X-Proxy-Token header
  const token = req.headers['x-proxy-token'];
  if (!safeCompare(token || '', PROXY_TOKEN)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return;
  }

  // Only allow /v1/ paths
  const urlPath = req.url.replace(/\/+/g, '/');
  if (!urlPath.startsWith('/v1/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  const targetUrl = new URL(urlPath, TARGET);

  // Forward only safe headers, strip proxy token
  const headers = {
    'user-agent': 'Mozilla/5.0 (compatible; status-monitor/1.0)',
  };
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
  if (req.headers['authorization']) headers['authorization'] = req.headers['authorization'];

  const options = {
    hostname: targetUrl.hostname,
    port: 443,
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers,
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  req.pipe(proxyReq);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Proxy running on :${PORT} → ${TARGET}`);
  if (!PROXY_TOKEN) console.warn('WARNING: PROXY_TOKEN not set — all requests will be rejected');
});
