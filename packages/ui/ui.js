// =============================================================================
// @rip-lang/ui — Zero-build reactive web framework
//
// Combines:
//   - Reactive Stash (deep state tree with path navigation)
//   - Virtual File System (browser-local file storage)
//   - File-Based Router (URL ↔ VFS paths)
//   - Component Renderer (mounts compiled Rip components)
//
// Usage:
//   import { createApp } from '@rip-lang/ui'
//
//   const app = createApp({
//     target: '#app',
//     state: { user: null, theme: 'dark' },
//     files: { 'pages/index.rip': '...' }
//   })
//
// Or in the browser with the Rip compiler:
//   <script type="module">
//     import { createApp } from '/ui.js'
//     import { compileToJS } from '/rip.browser.js'
//     createApp({ compile: compileToJS, target: '#app' }).start()
//   </script>
//
// Author: Steve Shreeve <steve.shreeve@gmail.com>
//   Date: February 2026
// =============================================================================

// Re-export everything
export { stash, Stash, signal, computed, effect, batch, raw, isStash, walk } from './stash.js';
export { vfs } from './vfs.js';
export { createRouter, fileToPattern, patternToRegex, matchRoute } from './router.js';
export { createRenderer } from './renderer.js';

// Import for internal use
import { stash } from './stash.js';
import { vfs } from './vfs.js';
import { createRouter } from './router.js';
import { createRenderer } from './renderer.js';

// ---------------------------------------------------------------------------
// createApp — one-call setup for a Rip application
// ---------------------------------------------------------------------------

export function createApp(options = {}) {
  const {
    target = '#app',         // DOM mount target
    state = {},              // Initial app state
    files = {},              // Initial VFS files { path: content }
    root = 'pages',          // Pages directory in VFS
    compile,                 // Rip compiler function (compileToJS)
    transition,              // Route transition config
    onError,                 // Global error handler
    onNavigate               // Navigation callback
  } = options;

  // 1. Create the reactive stash (app-level state)
  const app = stash(state);

  // 2. Create the virtual file system
  const fs = vfs(files);

  // 3. Create the router
  const router = createRouter(fs, {
    root,
    compile,
    onError: onError || defaultErrorHandler
  });

  // 4. Create the renderer
  const renderer = createRenderer({
    router,
    fs,
    stash: app,
    compile,
    target,
    onError: onError || defaultErrorHandler,
    transition
  });

  // Navigation hook
  if (onNavigate) router.onNavigate(onNavigate);

  // Public API
  const instance = {
    // Core systems
    app,        // Reactive stash (app state)
    fs,         // Virtual file system
    router,     // File-based router
    renderer,   // Component renderer

    // Start the application
    start() {
      renderer.start();
      return instance;
    },

    // Stop the application
    stop() {
      instance._eventSource?.close();
      instance._eventSource = null;
      renderer.stop();
      router.destroy();
      return instance;
    },

    // Load files into the VFS from URLs
    async load(manifest) {
      await fs.fetchManifest(manifest);
      router.rebuild();
      return instance;
    },

    // Load a bundled manifest (all page sources in one JSON response)
    async loadBundle(url) {
      const res = await fetch(url);
      const bundle = await res.json();
      fs.load(bundle);
      router.rebuild();
      return instance;
    },

    // Connect to SSE watch endpoint for hot reload (notify + invalidate + refetch)
    watch(url, opts = {}) {
      const eagerFiles = new Set(opts.eager || []);
      const es = new EventSource(url);

      es.addEventListener('changed', async (e) => {
        const { paths } = JSON.parse(e.data);

        // Invalidate all changed files in VFS
        for (const path of paths) {
          fs.delete(path);
        }

        // Check if any affect the current route (page or layouts)
        const current = router.current;
        const toFetch = paths.filter(p =>
          eagerFiles.has(p) ||
          p === current.route?.file ||
          current.layouts?.includes(p)
        );

        // Rebuild router (handles new/deleted pages)
        router.rebuild();

        // Refetch and remount only if current view is affected
        if (toFetch.length > 0) {
          try {
            await Promise.all(toFetch.map(p => fs.fetch(p)));
            renderer.remount();
          } catch (err) {
            console.error('[Rip] Hot reload fetch error:', err);
          }
        }
      });

      es.addEventListener('connected', () => {
        console.log('[Rip] Hot reload connected');
      });

      es.onerror = () => {
        console.log('[Rip] Hot reload reconnecting...');
      };

      instance._eventSource = es;
      return instance;
    },

    // Navigate to a route
    go(path) {
      router.push(path);
      return instance;
    },

    // Add a page to the VFS and navigate to it
    async addPage(path, source) {
      fs.write(`${root}/${path}`, source);
      router.rebuild();
      return instance;
    },

    // Get/set app state via path
    get(path, defaultValue) { return app.get(path, defaultValue); },
    set(path, value) { app.set(path, value); return instance; }
  };

  return instance;
}

// ---------------------------------------------------------------------------
// Default error handler
// ---------------------------------------------------------------------------

function defaultErrorHandler({ status, message, path, error }) {
  const prefix = status === 404 ? '404 Not Found' : `Error ${status}`;
  console.error(`[Rip] ${prefix}: ${message || path || 'unknown error'}`);
  if (error?.stack) console.error(error.stack);
}

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

export const VERSION = '0.1.2';

export default createApp;
