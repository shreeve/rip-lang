#!/usr/bin/env bun
// Simple static file server with brotli support
import { readFileSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the directory where this script lives
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Serve from docs/ relative to script location (works when globally installed)
const ROOT = process.env.SERVE_DIR || join(__dirname, '../docs');
// Try port 3000 first, fallback to 0 (OS-assigned)
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.rip': 'text/plain; charset=utf-8'
};

// Request handler for serving files
function handleRequest(req) {
  const url = new URL(req.url);
  let pathname = url.pathname;

  // Strip /rip-lang/ prefix if present (for GitHub Pages compatibility)
  if (pathname.startsWith('/rip-lang/')) {
    pathname = pathname.slice('/rip-lang'.length);
  }

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

// Try to start server on preferred port, fallback to OS-assigned port
let server;
try {
  server = Bun.serve({ port: PORT, fetch: handleRequest });
} catch (err) {
  if (err.code === 'EADDRINUSE') {
    // Port in use, let OS assign one
    server = Bun.serve({ port: 0, fetch: handleRequest });
  } else {
    throw err;
  }
}

const actualPort = server.port;

console.log(`🚀 Server running at http://localhost:${actualPort}`);
console.log(`📁 Serving from: ${ROOT}/`);
console.log(`🗜️  Brotli compression: enabled`);
console.log('');
console.log(`✨ Rip Playground: http://localhost:${actualPort}/`);
