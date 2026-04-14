const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3099;
const TARGET = 'https://ai.ezif.in';

const server = http.createServer(async (req, res) => {
  // Only allow /v1/ paths
  if (!req.url.startsWith('/v1/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  const targetUrl = new URL(req.url, TARGET);

  // Forward only safe headers
  const headers = {};
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
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });

  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`Proxy running on :${PORT} → ${TARGET}`);
});
