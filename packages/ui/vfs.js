// =============================================================================
// Virtual File System — Browser-local file storage
//
// Phase 1: In-memory Map-based storage (works everywhere)
// Phase 2: OPFS-backed persistence (93%+ browser support)
//
// Usage:
//   const fs = vfs()
//   fs.write('pages/index.rip', 'component Home\n  render\n    h1 "Hello"')
//   fs.read('pages/index.rip')     // returns source string
//   fs.list('pages/')              // ['index.rip', 'about.rip']
//   fs.exists('pages/index.rip')   // true
//   fs.watch('pages/', callback)   // notified on changes
//
// Author: Steve Shreeve <steve.shreeve@gmail.com>
//   Date: February 2026
// =============================================================================

// ---------------------------------------------------------------------------
// Normalize paths — always forward slash, no leading slash, no trailing slash
// ---------------------------------------------------------------------------

function normalize(path) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function dirname(path) {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(0, i) : '';
}

function basename(path) {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(i + 1) : path;
}

function join(...parts) {
  return normalize(parts.filter(Boolean).join('/'));
}

// ---------------------------------------------------------------------------
// VFS — In-memory virtual file system
// ---------------------------------------------------------------------------

export function vfs(initial = {}) {
  const files = new Map();     // path -> content (string)
  const watchers = new Map();  // directory -> Set<callback>
  const compiled = new Map();  // path -> { source, code } (compile cache)

  // Populate initial files
  for (const [path, content] of Object.entries(initial)) {
    files.set(normalize(path), content);
  }

  // Notify watchers for a path
  function notify(path, event = 'change') {
    const dir = dirname(path);
    const name = basename(path);

    // Notify exact directory watchers
    const dirWatchers = watchers.get(dir);
    if (dirWatchers) {
      for (const cb of dirWatchers) cb({ event, path, dir, name });
    }

    // Notify ancestor directory watchers (walk up to root)
    let parent = dir;
    while (true) {
      const next = dirname(parent);
      if (next === parent) break; // reached root
      const pw = watchers.get(next);
      if (pw) for (const cb of pw) cb({ event, path, dir, name });
      parent = next;
    }
    // Notify root watchers (empty string key)
    if (dir !== '') {
      const rw = watchers.get('');
      if (rw) for (const cb of rw) cb({ event, path, dir, name });
    }

    // Invalidate compile cache
    compiled.delete(path);
  }

  return {
    // Read a file — returns content string or undefined
    read(path) {
      return files.get(normalize(path));
    },

    // Write a file — creates intermediate directories implicitly
    write(path, content) {
      path = normalize(path);
      const existed = files.has(path);
      files.set(path, content);
      notify(path, existed ? 'change' : 'create');
      return content;
    },

    // Delete a file
    delete(path) {
      path = normalize(path);
      if (files.has(path)) {
        files.delete(path);
        compiled.delete(path);
        notify(path, 'delete');
        return true;
      }
      return false;
    },

    // Check if a file exists
    exists(path) {
      return files.has(normalize(path));
    },

    // List files in a directory (non-recursive)
    list(dir = '') {
      dir = normalize(dir);
      const prefix = dir ? dir + '/' : '';
      const result = new Set();
      for (const path of files.keys()) {
        if (dir && !path.startsWith(prefix)) continue;
        if (!dir && path.includes('/')) {
          // Root listing — show top-level entries
          result.add(path.split('/')[0]);
        } else if (dir) {
          const rest = path.slice(prefix.length);
          if (rest.includes('/')) result.add(rest.split('/')[0]);
          else result.add(rest);
        } else {
          result.add(path);
        }
      }
      return [...result].sort();
    },

    // List all files (recursive, with optional prefix filter)
    listAll(dir = '') {
      dir = normalize(dir);
      const prefix = dir ? dir + '/' : '';
      const result = [];
      for (const path of files.keys()) {
        if (!dir || path.startsWith(prefix)) result.push(path);
      }
      return result.sort();
    },

    // List directories at a path
    dirs(dir = '') {
      dir = normalize(dir);
      const prefix = dir ? dir + '/' : '';
      const result = new Set();
      for (const path of files.keys()) {
        if (dir && !path.startsWith(prefix)) continue;
        const rest = dir ? path.slice(prefix.length) : path;
        if (rest.includes('/')) result.add(rest.split('/')[0]);
      }
      return [...result].sort();
    },

    // Watch a directory for changes
    watch(dir, callback) {
      dir = normalize(dir ?? '');
      if (!watchers.has(dir)) watchers.set(dir, new Set());
      watchers.get(dir).add(callback);
      return () => watchers.get(dir)?.delete(callback); // unwatch
    },

    // Get/set compiled cache for a file
    getCompiled(path) { return compiled.get(normalize(path)); },
    setCompiled(path, result) { compiled.set(normalize(path), result); return result; },

    // Bulk load files (from server manifest, etc.)
    load(fileMap) {
      for (const [path, content] of Object.entries(fileMap)) {
        files.set(normalize(path), content);
      }
    },

    // Fetch a file from a URL and store it in the VFS
    async fetch(path, url) {
      const response = await globalThis.fetch(url ?? '/' + path);
      if (!response.ok) throw new Error(`VFS fetch failed: ${url ?? path} (${response.status})`);
      const content = await response.text();
      this.write(path, content);
      return content;
    },

    // Fetch multiple files from a manifest
    async fetchManifest(manifest) {
      const entries = Array.isArray(manifest) ? manifest.map(p => [p, '/' + p]) : Object.entries(manifest);
      await Promise.all(entries.map(([path, url]) => this.fetch(path, url)));
    },

    // Export all files as a plain object
    toJSON() {
      const obj = {};
      for (const [k, v] of files) obj[k] = v;
      return obj;
    },

    // Stats
    get size() { return files.size; },

    // Path utilities
    normalize,
    dirname,
    basename,
    join
  };
}

// Default export
export default vfs;
