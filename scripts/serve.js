#!/usr/bin/env bun
// Simple static file server with brotli support
import { readFileSync, existsSync, statSync } from 'fs';
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

// ETag (size+mtime, plus encoding so brotli/plain get distinct tags) +
// no-cache for cheap 304 revalidation, and Vary so caches don't mix encodings.
// Returns null if unreadable, letting the caller fall back.
function serveFile(req, diskPath, contentType, encoding) {
  let stat;
  try { stat = statSync(diskPath); } catch { return null; }
  const etag = `"${stat.size.toString(16)}-${Math.round(stat.mtimeMs).toString(16)}${encoding ? '-' + encoding : ''}"`;
  const headers = {
    'Content-Type': contentType,
    'ETag': etag,
    'Cache-Control': 'no-cache',
    'Vary': 'Accept-Encoding'
  };
  if (encoding) headers['Content-Encoding'] = encoding;
  if (req.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers });
  }
  try {
    return new Response(readFileSync(diskPath), { headers });
  } catch {
    return null;
  }
}

// Request handler for serving files
function handleRequest(req) {
  const url = new URL(req.url);
  let pathname = url.pathname;

  // Strip /rip-lang/ prefix if present (for GitHub Pages compatibility)
  if (pathname.startsWith('/rip-lang/')) {
    pathname = pathname.slice('/rip-lang'.length);
  }

  // Redirect /dir to /dir/ if it's a directory
  if (!pathname.endsWith('/') && !extname(pathname)) {
    try { if (statSync(join(ROOT, pathname)).isDirectory()) return Response.redirect(pathname + '/', 301); } catch {}
  }

  // Default to index.html for directory requests
  if (pathname.endsWith('/')) {
    pathname += 'index.html';
  }

  const filePath = join(ROOT, pathname);
  const ext = extname(pathname);
  const acceptEncoding = req.headers.get('accept-encoding') || '';
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // Prefer the pre-compressed Brotli sidecar when the client accepts it.
  if (acceptEncoding.includes('br') && existsSync(filePath + '.br')) {
    const res = serveFile(req, filePath + '.br', contentType, 'br');
    if (res) return res;
  }

  // Plain file — also the failover when no .br sidecar exists.
  const res = serveFile(req, filePath, contentType, null);
  if (res) return res;

  return new Response('404 Not Found', { status: 404 });
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
