/**
 * Rip UI Demo — Dev Server (Bun)
 * --------------------------------
 * Serves the demo app with all framework files.
 * Resolves imports from the parent packages/ui/ directory.
 *
 * Run: bun packages/ui/demo/serve.ts
 */

const PORT = 3002;
const DEMO_DIR = import.meta.dir;
const UI_DIR = `${DEMO_DIR}/..`;
const ROOT_DIR = `${UI_DIR}/../..`;

const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.rip': 'text/plain',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ts': 'application/javascript',
};

function getMimeType(path: string): string {
    const ext = path.substring(path.lastIndexOf('.'));
    return MIME_TYPES[ext] || 'application/octet-stream';
}

Bun.serve({
    port: PORT,

    async fetch(req) {
        const url = new URL(req.url);
        let path = url.pathname;

        // Default to index.html
        if (path === '/') path = '/index.html';

        // Resolve framework files from parent directory
        // /ui.js → packages/ui/ui.js
        // /stash.js → packages/ui/stash.js
        const frameworkFiles = ['ui.js', 'stash.js', 'vfs.js', 'router.js', 'renderer.js'];
        const fileName = path.slice(1); // strip leading /
        if (frameworkFiles.includes(fileName)) {
            const file = Bun.file(`${UI_DIR}/${fileName}`);
            if (await file.exists()) {
                return new Response(file, {
                    headers: { 'Content-Type': 'application/javascript' }
                });
            }
        }

        // Resolve rip.browser.js from the project root build
        if (path === '/rip.browser.js') {
            // Try built output first, then misc/lab copy
            for (const loc of [`${ROOT_DIR}/dist/rip.browser.js`, `${ROOT_DIR}/misc/lab/rip.browser.js`]) {
                const file = Bun.file(loc);
                if (await file.exists()) {
                    return new Response(file, {
                        headers: { 'Content-Type': 'application/javascript' }
                    });
                }
            }
        }

        // Serve from demo directory
        const file = Bun.file(`${DEMO_DIR}${path}`);
        if (await file.exists()) {
            return new Response(file, {
                headers: { 'Content-Type': getMimeType(path) }
            });
        }

        // SPA fallback — return index.html for unmatched routes
        const index = Bun.file(`${DEMO_DIR}/index.html`);
        if (await index.exists()) {
            return new Response(index, {
                headers: { 'Content-Type': 'text/html' }
            });
        }

        return new Response('Not Found', { status: 404 });
    }
});

console.log(`
  Rip UI Demo

  Local:  http://localhost:${PORT}

  Framework files served from: packages/ui/
  Compiler served from:        dist/ or misc/lab/

  Press Ctrl+C to stop
`);
