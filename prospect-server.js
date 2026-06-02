const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }

  // Serve the HTML file
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const html = fs.readFileSync(path.join(__dirname, 'prospect-tool.html'));
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html); return;
  }

  // Proxy to Anthropic
  if (req.method === 'POST' && req.url === '/api') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(body); } catch { res.writeHead(400); res.end('Bad JSON'); return; }

      const apiKey = parsed._apiKey;
      delete parsed._apiKey;

      const payload = JSON.stringify(parsed);

      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(payload),
        }
      };

      const proxy = https.request(options, (apiRes) => {
        res.writeHead(apiRes.statusCode, {
          'Content-Type': apiRes.headers['content-type'] || 'application/json',
        });
        apiRes.pipe(res);
      });

      proxy.on('error', (e) => {
        res.writeHead(502); res.end(JSON.stringify({ error: { message: e.message } }));
      });

      proxy.write(payload);
      proxy.end();
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  RN Media Prospect Tool`);
  console.log(`  Running at http://localhost:${PORT}\n`);
});
