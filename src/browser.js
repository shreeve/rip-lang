// Browser-compatible entry point for Rip compiler
// Includes runtime for <script type="text/rip"> support

// Side-effect import — registers the BROWSER schema runtime provider.
// Pulls in only the validate + browser-stubs fragments; tree-shakes
// db-naming, orm, and ddl fragments out of the bundle. Must be the
// first import so any later module-load eager-installs see it.
import './schema/loader-browser.js';

export { Lexer } from './lexer.js';
export { parser } from './parser.js';
export { CodeEmitter, Compiler, compile, compileToJS, formatSExpr, getStdlibCode, getReactiveRuntime, getComponentRuntime, RipError, formatError, formatErrorHTML } from './compiler.js';
import { mergeChunksWithInlineMap } from './sourcemap-merge.js';
import { getStdlibCode, formatError as _formatError } from './compiler.js';

// Version info (replaced during build)
export const VERSION = "0.0.0";
export const BUILD_DATE = "0000-00-00@00:00:00GMT";

// Import compiler functions for use in rip() function and globalThis registration
import { compile, compileToJS, formatSExpr, getReactiveRuntime, getComponentRuntime } from './compiler.js';

// Eagerly register Rip's reactive and component runtimes on globalThis so that
// framework code (app.rip) and browser-compiled scripts can use them directly
if (typeof globalThis !== 'undefined') {
  if (!globalThis.__rip) new Function(getReactiveRuntime())();
  if (!globalThis.__ripComponent) new Function(getComponentRuntime())();
}

const dedent = s => {
  const m = s.match(/^[ \t]*(?=\S)/gm);
  const i = Math.min(...(m || []).map(x => x.length));
  return s.replace(RegExp(`^[ \t]{${i}}`, 'gm'), '').trim();
}

// ---------------------------------------------------------------------------
// Source-map helpers — for browser-side debugger + DevTools navigation.
//
// `compileToJS(src, { sourceMap: 'inline', filename: <name>.rip })` returns
// JS with a trailing `//# sourceMappingURL=data:application/json;base64,...`
// comment. We add a leading `//# sourceURL=<name>.rip.js` so DevTools shows
// the eval'd code as a navigable virtual file (named differently than the
// source-map's `sources[]` entry to avoid DevTools merging entries).
//
// CR/LF in the `sourceURL` would let an attacker inject another pragma; sanitize.
// ---------------------------------------------------------------------------

const sanitizeSourceURL = (url) =>
  String(url).replace(/[\r\n]/g, '').replace(/\s+$/g, '');

// Insert `//# sourceURL=<name>` BEFORE the existing `//# sourceMappingURL=...`
// comment (or append at end if none). NEVER prepend — that would shift every
// generated-line mapping by 1 line, breaking line-only source maps.
function addSourceURL(js, generatedName) {
  const safe = sanitizeSourceURL(generatedName);
  const pragma = `//# sourceURL=${safe}`;
  const mapRe = /\n?\/\/# sourceMappingURL=[^\n]*\s*$/;
  const m = js.match(mapRe);
  if (m) return js.slice(0, m.index) + '\n' + pragma + js.slice(m.index);
  return js + '\n' + pragma;
}

// Shift all generated-line mappings by N lines by prepending N semicolons to
// the `mappings` field. Each `;` in source-map V3 mappings represents an empty
// generated line. Used to compensate for a runtime async IIFE wrapper that
// adds N lines BEFORE the compiled code.
function offsetSourceMap(js, offsetLines) {
  if (!offsetLines) return js;
  return js.replace(
    /\/\/# sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)/,
    (_, b64) => {
      let json;
      try {
        // UTF-8-safe decode: counterpart of the encode in compiler.js. The
        // map JSON may contain non-ASCII chars (sourcesContent), so we go
        // bytes -> string via TextDecoder.
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        json = new TextDecoder().decode(bytes);
      } catch { return _; /* leave unchanged on decode failure */ }
      let map;
      try { map = JSON.parse(json); } catch { return _; }
      map.mappings = ';'.repeat(offsetLines) + map.mappings;
      // UTF-8-safe re-encode.
      const bytes = new TextEncoder().encode(JSON.stringify(map));
      let out = '';
      for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
      return `//# sourceMappingURL=data:application/json;base64,${btoa(out)}`;
    }
  );
}

// Wrap compiled JS in an async IIFE for top-level await support, applying the
// 1-line source-map offset that the wrapper introduces, AND adding a
// `sourceURL` pragma so DevTools shows the eval'd code with a sensible name.
function wrapForEval(js, ripName) {
  const generatedName = `${sanitizeSourceURL(ripName)}.js`;
  const shifted = offsetSourceMap(js, 1);
  const tagged = addSourceURL(shifted, generatedName);
  return `(async()=>{\n${tagged}\n})()`;
}

// Expose the helpers on globalThis so `app.rip` (compiled separately into
// the bundle) can apply the same source-map post-processing to its
// component-load path. The `enabled` flag is owned by processRipScripts —
// when it reads `data-debug` from the runtime <script> tag, it sets this
// flag accordingly. Code paths outside processRipScripts (notably
// `app.launch()`'s component compile path) gate their source-map work on
// __ripDebug.enabled.
if (typeof globalThis !== 'undefined') {
  globalThis.__ripDebug = {
    enabled: true,    // default ON — processRipScripts may flip to false
    offsetSourceMap,
    addSourceURL,
    sanitizeSourceURL,
  };
}

// Browser runtime: collect all sources (inline scripts, data-src files, bundles),
// compile them in a shared scope, and execute as one async IIFE.
//
// data-src URLs ending in .rip are fetched as individual source files.
// All other URLs are fetched as JSON bundles containing multiple files.
async function processRipScripts() {
  const sources = [];

  // Step 1: Collect data-src URLs from the runtime script tag
  // When data-src is omitted, default to '/app' (auto-scanned bundle from serve middleware).
  const runtimeTag = document.querySelector('script[src$="rip.min.js"], script[src$="rip.js"]');
  const dataSrc = runtimeTag?.getAttribute('data-src');
  if (dataSrc !== null && dataSrc !== undefined) {
    for (const url of dataSrc.trim().split(/\s+/)) {
      if (url) sources.push({ url });
    }
  } else if (runtimeTag) {
    sources.push({ url: '/app' });
  }

  // Step 2: Collect all <script type="text/rip"> tags (inline and external)
  for (const script of document.querySelectorAll('script[type="text/rip"]')) {
    if (script.src) {
      sources.push({ url: script.src });
    } else {
      const code = dedent(script.textContent);
      if (code) sources.push({ code });
    }
  }

  // Step 3: Fetch externals — .rip URLs as source text, others as JSON bundles
  if (sources.length > 0) {
    const results = await Promise.allSettled(sources.map(async (s) => {
      if (!s.url) return;
      const res = await fetch(s.url);
      if (!res.ok) throw new Error(`${s.url} (${res.status})`);
      if (s.url.endsWith('.rip')) {
        s.code = await res.text();
      } else {
        const bundle = await res.json();
        s.bundle = bundle;
      }
    }));
    for (const r of results) {
      if (r.status === 'rejected') console.warn('Rip: fetch failed:', r.reason.message);
    }

    // Separate bundles from individual sources
    const bundles = [];
    const individual = [];
    for (const s of sources) {
      if (s.bundle) bundles.push(s.bundle);
      else if (s.code) individual.push(s);
    }

    const routerAttr = runtimeTag?.getAttribute('data-router');
    const hasRouter = routerAttr != null;

    // Step 3b: If data-router is present and we have a bundle, use launch()
    // for full routing support. Otherwise compile everything upfront.
    if (hasRouter && bundles.length > 0) {
      // Compile non-bundle sources (inline scripts, individual .rip files)
      // with per-component source maps for browser-debugger support. The
      // bundle itself is launched separately via `app.launch(bundle)` —
      // its components get source maps too via `globalThis.__ripDebug`,
      // which `app.rip`'s component-compile path reads to apply the same
      // offset+sourceURL treatment we apply here.
      const debug = runtimeTag?.getAttribute('data-debug') !== 'false';
      if (globalThis.__ripDebug) globalThis.__ripDebug.enabled = debug;
      const baseOpts = { skipRuntimes: true, skipExports: true, skipImports: true };
      let inlineCounter = 0;
      for (const s of individual) {
        const ripName = s.url || `inline-${++inlineCounter}.rip`;
        const opts = debug
          ? { ...baseOpts, sourceMap: 'inline', filename: ripName }
          : baseOpts;
        let js;
        try { js = compileToJS(s.code, opts); }
        catch (e) { console.error(_formatError(e, { source: s.code, file: ripName, color: false })); continue; }
        try { await (0, eval)(debug ? wrapForEval(js, ripName) : `(async()=>{\n${js}\n})()`); }
        catch (e) { console.error(`Rip runtime error in ${ripName}:`, e); }
      }

      // Launch with the last bundle (app bundle) — handles router, renderer, stash
      const app = importRip.modules?.['app.rip'];
      if (app?.launch) {
        const appBundle = bundles[bundles.length - 1];
        const persistAttr = runtimeTag.getAttribute('data-persist');
        const launchOpts = { bundle: appBundle, hash: routerAttr === 'hash' };
        if (persistAttr != null) launchOpts.persist = persistAttr === 'local' ? 'local' : true;
        await app.launch('', launchOpts);
      }
    } else {
      // No routing — expand bundles into individual sources, compile everything
      const expanded = [];
      for (const b of bundles) {
        for (const [name, code] of Object.entries(b.components || {})) {
          expanded.push({ code, url: name });
        }
        if (b.data) {
          const stateAttr = runtimeTag?.getAttribute('data-state');
          let initial = {};
          if (stateAttr) { try { initial = JSON.parse(stateAttr); } catch {} }
          Object.assign(initial, b.data);
          runtimeTag?.setAttribute('data-state', JSON.stringify(initial));
        }
      }
      expanded.push(...individual);

      // Expose the components-source store on window.__RIP__ so source-text
      // access (e.g. view-source UIs) works the same on the no-router path
      // as it does after launch(). Mirrors what launch() sets up — minus
      // app/router/renderer, since those don't exist on this path.
      if (bundles.length > 0 && typeof globalThis.createComponents === 'function') {
        const sourceStore = globalThis.createComponents();
        for (const b of bundles) {
          if (b.components) sourceStore.load(b.components);
        }
        if (typeof window !== 'undefined') {
          if (!window.__RIP__) window.__RIP__ = {};
          window.__RIP__.components = sourceStore;
        }
      }

      // Bundle / multi-source path. Components defined in one .rip file
      // need to be visible to siblings (e.g. `WidgetGallery` referencing
      // `Toast`, `Dialog`, `Menu`). To make that work we concatenate
      // every compiled chunk into ONE async-IIFE and eval it as a
      // single closure — declarations made by one source are visible
      // to all subsequent sources via lexical scope.
      //
      // For source maps: each compileToJS call emits its own per-chunk
      // map; mergeChunksWithInlineMap merges them into ONE V3 map with
      // a multi-entry `sources` / `sourcesContent` array. DevTools
      // reads the single merged map and shows each `.rip` file as a
      // navigable source — same UX as the data-router path, no
      // per-component IIFE split that would break lexical scope.
      const debug = runtimeTag?.getAttribute('data-debug') !== 'false';
      if (globalThis.__ripDebug) globalThis.__ripDebug.enabled = debug;
      const baseOpts = { skipRuntimes: true, skipExports: true, skipImports: true };
      const compiled = [];
      let inlineCounter = 0;
      for (const s of expanded) {
        if (!s.code) continue;
        const ripName = s.url || `inline-${++inlineCounter}.rip`;
        const opts = debug
          ? { ...baseOpts, sourceMap: 'inline', filename: ripName }
          : baseOpts;
        try {
          const js = compileToJS(s.code, opts);
          compiled.push({ js, url: ripName });
        } catch (e) {
          console.error(_formatError(e, { source: s.code, file: ripName, color: false }));
        }
      }

      // Create app stash
      if (!globalThis.__ripApp && runtimeTag) {
        const stashFn = globalThis.stash;
        if (stashFn) {
          let initial = {};
          const stateAttr = runtimeTag.getAttribute('data-state');
          if (stateAttr) {
            try { initial = JSON.parse(stateAttr); }
            catch (e) { console.error('Rip: invalid data-state JSON:', e.message); }
          }
          const app = stashFn({ data: initial });
          globalThis.__ripApp = app;
          if (typeof window !== 'undefined') window.app = app;

          const persistAttr = runtimeTag.getAttribute('data-persist');
          if (persistAttr != null && globalThis.persistStash) {
            globalThis.persistStash(app, { local: persistAttr === 'local' });
          }
        }
      }

      // Concatenate all compiled chunks into one async IIFE so component
      // declarations made in earlier chunks are visible (via lexical
      // scope) to later chunks AND to the final mount step. Without
      // this, each chunk's `let Foo = class ...` dies when its IIFE
      // returns and `WidgetGallery` (defined in one chunk) can't see
      // `Toast` (defined in another).
      //
      // mergeChunksWithInlineMap concatenates the per-chunk JS bodies
      // (stripping their individual `//# sourceMappingURL=` pragmas)
      // and emits ONE V3 map at the end whose `sources` array holds
      // every chunk's original `.rip` filename. DevTools shows each
      // `.rip` file as its own source even though everything runs in
      // one eval'd closure.
      if (compiled.length > 0) {
        const mount = runtimeTag?.getAttribute('data-mount');
        const target = runtimeTag?.getAttribute('data-target') || 'body';
        const mountSnippet = mount ? `\n${mount}.mount(${JSON.stringify(target)});\n` : '';
        const mergedBody = mergeChunksWithInlineMap(compiled.map(c => ({ js: c.js })));
        // Inject the mount call BEFORE the trailing sourceMappingURL pragma
        // so the pragma stays at the end of the eval'd chunk (DevTools
        // requires it there). If no mount, mergedBody is emitted as-is.
        const wrapped = mount
          ? mergedBody.replace(/(\n\/\/# sourceMappingURL=[^\n]*\n?)?$/, mountSnippet + '$1')
          : mergedBody;
        let ok = true;
        try {
          await (0, eval)(`(async()=>{\n${wrapped}\n})()`);
        } catch (e) {
          ok = false;
          if (e instanceof SyntaxError) console.error(`Rip syntax error: ${e.message}`);
          else console.error('Rip runtime error:', e);
        }
        if (ok) document.body.classList.add('ready');
      }
    }
  }

  // Step 6: data-reload enables SSE hot-reload from dev server
  // Skip if launch() was called — it connects its own SSE watch.
  // Uses exponential backoff: 1s → 2s → 4s → … → 30s (then 30s forever).
  // The retry delay only affects reconnection to a DOWN server — once connected,
  // the server pushes reload notifications instantly regardless of this value.
  if (runtimeTag?.hasAttribute('data-reload') && !globalThis.__ripLaunched) {
    let ready = false;
    let retryDelay = 1000;
    const maxDelay = 30000;
    const connectWatch = () => {
      const es = new EventSource('/watch');
      es.addEventListener('connected', () => {
        retryDelay = 1000;
        if (ready) location.reload();
        ready = true;
      });
      es.addEventListener('reload', (e) => {
        if (e.data === 'styles') {
          const t = Date.now();
          let refreshed = 0;
          document.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
            if (new URL(l.href).origin !== location.origin) return;
            const url = new URL(l.href);
            url.searchParams.set('_r', t);
            l.href = url.toString();
            refreshed++;
          });
          if (!refreshed) location.reload();
        } else {
          location.reload();
        }
      });
      es.onerror = () => {
        es.close();
        setTimeout(connectWatch, retryDelay);
        retryDelay = Math.min(retryDelay * 2, maxDelay);
      };
    };
    connectWatch();
  }
}

export { processRipScripts };

/**
 * Import a .rip file as an ES module
 * Fetches the URL, compiles Rip→JS, dynamically imports via Blob URL
 * Usage: const { launch } = await importRip('/app.rip')
 *
 * Pre-compiled modules can be registered on importRip.modules to skip fetching.
 * The browser bundle uses this to embed app.rip without a server round-trip.
 */
export async function importRip(url) {
  for (const [key, mod] of Object.entries(importRip.modules)) {
    if (url.includes(key)) return mod;
  }
  const source = await fetch(url).then(r => {
    if (!r.ok) throw new Error(`importRip: ${url} (${r.status})`);
    return r.text();
  });
  const js = compileToJS(source);
  const header = `// ${url}\n`;
  const blob = new Blob([header + js], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  return await import(blobUrl);
}
importRip.modules = {};

/**
 * Browser Console REPL
 * Usage: rip('x = 42')  → evaluates and returns result
 */
export function rip(code) {
  try {
    // Wrap in a do block so Rip handles implicit return and auto-async
    const indented = code.replace(/^/gm, '  ');
    const wrapped = compileToJS(`do ->\n${indented}`);

    // Strip let declarations so variables become implicit globals
    let js = wrapped.replace(/^let\s+[^;]+;\s*\n\s*/m, '');
    js = js.replace(/^const\s+(\w+)\s*=/gm, 'globalThis.$1 =');

    // Eval — the do block compiles to an IIFE (async if code uses !)
    const result = (0, eval)(js);

    // If async (returns a Promise), persist the resolved value
    if (result && typeof result.then === 'function') {
      return result.then(v => {
        if (v !== undefined) globalThis._ = v;
        return v;
      });
    }

    if (result !== undefined) globalThis._ = result;
    return result;
  } catch (error) {
    console.error(_formatError(error, { source: code, color: false }));
    return undefined;
  }
}

// Register globals BEFORE auto-processing scripts (order matters in bundled output)
if (typeof globalThis !== 'undefined') {
  globalThis.rip = rip;
  globalThis.importRip = importRip;
  globalThis.compileToJS = compileToJS;
  globalThis.__ripExports = { compile, compileToJS, formatSExpr, getStdlibCode, VERSION, BUILD_DATE, getReactiveRuntime, getComponentRuntime };
}

// Auto-process <script type="text/rip"> blocks and data-src sources.
// Deferred via queueMicrotask so bundled entry code runs before script processing.
if (typeof document !== 'undefined') {
  globalThis.__ripScriptsReady = new Promise(resolve => {
    const run = () => processRipScripts().then(resolve);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => queueMicrotask(run));
    } else {
      queueMicrotask(run);
    }
  });
}
