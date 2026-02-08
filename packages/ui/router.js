// =============================================================================
// File-Based Router — Client-side routing from VFS paths
//
// Maps URLs to VFS file paths with support for:
//   - File-based routing:  pages/index.rip    → /
//                          pages/about.rip    → /about
//                          pages/users/[id].rip → /users/:id
//   - Dynamic segments:    [param] → :param
//   - Catch-all routes:    [...slug].rip → wildcard
//   - Nested layouts:      _layout.rip in each directory
//   - Index routes:        index.rip in any directory
//
// Usage:
//   const router = createRouter(fs, { root: 'pages', compile })
//   router.push('/users/42')            // navigate
//   router.replace('/login')            // replace history
//   router.current                      // reactive: { path, params, route }
//   router.onNavigate(callback)         // hook
//
// Author: Steve Shreeve <steve.shreeve@gmail.com>
//   Date: February 2026
// =============================================================================

import { signal, effect, batch } from './stash.js';

// ---------------------------------------------------------------------------
// Route tree — file paths → route patterns
// ---------------------------------------------------------------------------

function buildRouteTree(fs, root = 'pages') {
  const routes = [];
  const layouts = new Map(); // dir → layout path

  // Scan the VFS for .rip files under root
  const allFiles = fs.listAll(root);
  for (const filePath of allFiles) {
    const rel = filePath.slice(root.length + 1); // strip root prefix + /
    if (!rel.endsWith('.rip')) continue;

    // Collect layouts
    if (rel === '_layout.rip' || rel.endsWith('/_layout.rip')) {
      const dir = rel === '_layout.rip' ? '' : rel.slice(0, -'/_layout.rip'.length);
      layouts.set(dir, filePath);
      continue;
    }

    // Skip files starting with _ (private)
    const name = rel.split('/').pop();
    if (name.startsWith('_')) continue;

    // Convert file path to URL pattern
    const urlPattern = fileToPattern(rel);
    const regex = patternToRegex(urlPattern);

    routes.push({ pattern: urlPattern, regex, file: filePath, rel });
  }

  // Sort: static routes first, then by specificity (fewer dynamic segments first)
  routes.sort((a, b) => {
    const aDynamic = (a.pattern.match(/:/g) || []).length;
    const bDynamic = (b.pattern.match(/:/g) || []).length;
    const aCatch = a.pattern.includes('*') ? 1 : 0;
    const bCatch = b.pattern.includes('*') ? 1 : 0;
    if (aCatch !== bCatch) return aCatch - bCatch; // catch-all last
    if (aDynamic !== bDynamic) return aDynamic - bDynamic; // fewer dynamic first
    return a.pattern.localeCompare(b.pattern); // alphabetical tiebreak
  });

  return { routes, layouts };
}

// Convert file path to URL pattern
//   index.rip           → /
//   about.rip           → /about
//   users/index.rip     → /users
//   users/[id].rip      → /users/:id
//   blog/[...slug].rip  → /blog/*slug
function fileToPattern(rel) {
  // Remove .rip extension
  let pattern = rel.replace(/\.rip$/, '');

  // Replace [param] segments
  pattern = pattern.replace(/\[\.\.\.(\w+)\]/g, '*$1'); // catch-all
  pattern = pattern.replace(/\[(\w+)\]/g, ':$1');        // dynamic

  // Handle index routes
  if (pattern === 'index') return '/';
  pattern = pattern.replace(/\/index$/, '');

  return '/' + pattern;
}

// Convert URL pattern to regex
function patternToRegex(pattern) {
  const paramNames = [];
  let regexStr = pattern
    .replace(/\*(\w+)/g, (_, name) => { paramNames.push(name); return '(.+)'; })
    .replace(/:(\w+)/g, (_, name) => { paramNames.push(name); return '([^/]+)'; });
  return { regex: new RegExp('^' + regexStr + '$'), paramNames };
}

// Match a URL path against routes
function matchRoute(url, routes) {
  // Strip query string and hash
  const path = url.split('?')[0].split('#')[0];

  for (const route of routes) {
    const { regex, paramNames } = route.regex;
    const match = path.match(regex);
    if (match) {
      const params = {};
      for (let i = 0; i < paramNames.length; i++) {
        params[paramNames[i]] = decodeURIComponent(match[i + 1]);
      }
      return { route, params };
    }
  }
  return null;
}

// Collect layout chain for a route
function getLayoutChain(routeFile, root, layouts) {
  const chain = [];
  const rel = routeFile.slice(root.length + 1);
  const parts = rel.split('/');
  let dir = '';

  // Check root layout
  if (layouts.has('')) chain.push(layouts.get(''));

  // Check each directory level
  for (let i = 0; i < parts.length - 1; i++) {
    dir = dir ? dir + '/' + parts[i] : parts[i];
    if (layouts.has(dir)) chain.push(layouts.get(dir));
  }

  return chain;
}

// ---------------------------------------------------------------------------
// Router — reactive navigation
// ---------------------------------------------------------------------------

export function createRouter(fs, options = {}) {
  const { root = 'pages', compile, onError } = options;

  // Reactive state
  const _path = signal(location.pathname);
  const _params = signal({});
  const _route = signal(null);
  const _layouts = signal([]);
  const _query = signal({});
  const _hash = signal('');

  // Navigation callbacks
  const navigateCallbacks = new Set();

  // Route tree (rebuilt when VFS changes)
  let tree = buildRouteTree(fs, root);

  // Watch VFS for changes to pages
  fs.watch(root, () => {
    tree = buildRouteTree(fs, root);
    // Re-resolve current route
    resolve(_path.get());
  });

  // Resolve a URL to a route
  function resolve(url) {
    const path = url.split('?')[0].split('#')[0];
    const queryStr = url.split('?')[1]?.split('#')[0] || '';
    const hash = url.includes('#') ? url.split('#')[1] : '';

    const result = matchRoute(path, tree.routes);
    if (result) {
      batch(() => {
        _path.set(path);
        _params.set(result.params);
        _route.set(result.route);
        _layouts.set(getLayoutChain(result.route.file, root, tree.layouts));
        _query.set(Object.fromEntries(new URLSearchParams(queryStr)));
        _hash.set(hash);
      });

      for (const cb of navigateCallbacks) cb(router.current);
      return true;
    }

    // No match — 404
    if (onError) onError({ status: 404, path });
    else console.warn(`Router: no route for '${path}'`);
    return false;
  }

  // Handle browser back/forward
  function onPopState() {
    resolve(location.pathname + location.search + location.hash);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', onPopState);
  }

  // Intercept link clicks for SPA navigation
  function onClick(e) {
    // Only handle left-clicks without modifier keys
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    // Find the nearest anchor
    let target = e.target;
    while (target && target.tagName !== 'A') target = target.parentElement;
    if (!target || !target.href) return;

    // Only handle same-origin links
    const url = new URL(target.href, location.origin);
    if (url.origin !== location.origin) return;

    // Skip links with explicit external targets
    if (target.target === '_blank' || target.hasAttribute('data-external')) return;

    e.preventDefault();
    router.push(url.pathname + url.search + url.hash);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('click', onClick);
  }

  // Public API
  const router = {
    // Navigate to a new URL
    push(url) {
      if (resolve(url)) {
        history.pushState(null, '', url);
      }
    },

    // Replace current URL (no history entry)
    replace(url) {
      if (resolve(url)) {
        history.replaceState(null, '', url);
      }
    },

    // Go back
    back() { history.back(); },

    // Go forward
    forward() { history.forward(); },

    // Current route state (reactive reads)
    get current() {
      return {
        path: _path.get(),
        params: _params.get(),
        route: _route.get(),
        layouts: _layouts.get(),
        query: _query.get(),
        hash: _hash.get()
      };
    },

    // Individual reactive getters
    get path() { return _path.get(); },
    get params() { return _params.get(); },
    get route() { return _route.get(); },
    get layouts() { return _layouts.get(); },
    get query() { return _query.get(); },
    get hash() { return _hash.get(); },

    // Subscribe to navigation events
    onNavigate(callback) {
      navigateCallbacks.add(callback);
      return () => navigateCallbacks.delete(callback);
    },

    // Compile and execute a route's component
    async load(route) {
      if (!route) return null;
      const source = fs.read(route.file);
      if (!source) return null;

      // Check compile cache
      let cached = fs.getCompiled(route.file);
      if (cached && cached.source === source) return cached.code;

      // Compile .rip → JS
      if (compile) {
        const code = compile(source);
        fs.setCompiled(route.file, { source, code });
        return code;
      }

      return source; // fallback: return raw source
    },

    // Rebuild route tree manually
    rebuild() { tree = buildRouteTree(fs, root); },

    // Get all defined routes
    get routes() { return tree.routes; },

    // Clean up event listeners
    destroy() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('popstate', onPopState);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('click', onClick);
      }
      navigateCallbacks.clear();
    },

    // Initialize — resolve current URL
    init() {
      resolve(location.pathname + location.search + location.hash);
      return router;
    }
  };

  return router;
}

// Export utilities
export { buildRouteTree, fileToPattern, patternToRegex, matchRoute };

export default createRouter;
