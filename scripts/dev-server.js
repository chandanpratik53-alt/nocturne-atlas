// scripts/dev-server.js
// Lightweight local static HTTP development server for Nocturne Atlas
// Zero external dependencies — uses Node.js standard library only

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const DEFAULT_PORT = 3000;

function startServer(port) {
  const server = http.createServer((req, res) => {
    // Parse URL and sanitize path
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // Default to index.html for root or directories
    if (pathname === '/' || pathname.endsWith('/')) {
      pathname = path.posix.join(pathname, 'index.html');
    }

    // Resolve system path
    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(rootDir, safePath);

    // Guard against path traversal outside rootDir
    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('403 Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // If not found and client requested HTML navigation, serve index.html (SPA fallback)
        if (req.headers.accept && req.headers.accept.includes('text/html')) {
          const indexPath = path.join(rootDir, 'index.html');
          fs.readFile(indexPath, (idxErr, content) => {
            if (idxErr) {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('404 Not Found');
            } else {
              res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache'
              });
              res.end(content);
            }
          });
          return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`404 Not Found: ${pathname}`);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      // Set headers: no-cache for local dev convenience, service worker allowed
      const headers = {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=60',
        'Service-Worker-Allowed': './'
      };

      res.writeHead(200, headers);
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(port, () => {
    console.log('\n======================================================');
    console.log('   🌙 Nocturne Atlas - Local Development Server');
    console.log('======================================================');
    console.log(`  Local URL:      http://localhost:${port}/`);
    console.log(`  Project Root:   ${rootDir}`);
    console.log('  Press Ctrl+C to stop the server\n');
  });
}

startServer(DEFAULT_PORT);
