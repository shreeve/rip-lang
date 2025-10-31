#!/usr/bin/env bun
// Simple static file server with brotli support
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const PORT = 3000;
const ROOT = 'docs';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

Bun.serve({
  port: PORT,

  fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    // Default to index.html for directory requests
    if (pathname.endsWith('/')) {
      pathname += 'index.html';
    }

    const filePath = join(ROOT, pathname);
    const ext = extname(pathname);
    const acceptEncoding = req.headers.get('accept-encoding') || '';

    // Check for brotli compressed version (.br)
    if (acceptEncoding.includes('br') && existsSync(filePath + '.br')) {
      try {
        const compressed = readFileSync(filePath + '.br');
        return new Response(compressed, {
          headers: {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            'Content-Encoding': 'br',
            'Cache-Control': 'public, max-age=31536000'
          }
        });
      } catch (e) {
        // Fall through to regular file
      }
    }

    // Serve regular file
    try {
      const file = readFileSync(filePath);
      return new Response(file, {
        headers: {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream'
        }
      });
    } catch (e) {
      return new Response('404 Not Found', { status: 404 });
    }
  }
});

console.log(`🚀 Server running at http://localhost:${PORT}`);
console.log(`📁 Serving from: ${ROOT}/`);
console.log(`🗜️  Brotli compression: enabled`);
console.log('');
console.log(`✨ Rip REPL:   http://localhost:${PORT}/`);
console.log(`📚 Examples:   http://localhost:${PORT}/examples/`);
