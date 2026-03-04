// Browser-compatible entry point for Rip compiler
// Includes runtime for <script type="text/rip"> support

export { Lexer } from './lexer.js';
export { parser } from './parser.js';
export { CodeGenerator, Compiler, compile, compileToJS, formatSExpr, getStdlibCode, getReactiveRuntime, getComponentRuntime } from './compiler.js';
import { getStdlibCode } from './compiler.js';

// Version info (replaced during build)
export const VERSION = "0.0.0";
export const BUILD_DATE = "0000-00-00@00:00:00GMT";

// Import compiler functions for use in rip() function and globalThis registration
import { compile, compileToJS, formatSExpr, getReactiveRuntime, getComponentRuntime } from './compiler.js';

// Eagerly register Rip's reactive and component runtimes on globalThis so that
// framework code (ui.rip) and browser-compiled scripts can use them directly
if (typeof globalThis !== 'undefined') {
  if (!globalThis.__rip) new Function(getReactiveRuntime())();
  if (!globalThis.__ripComponent) new Function(getComponentRuntime())();
}

const dedent = s => {
  const m = s.match(/^[ \t]*(?=\S)/gm);
  const i = Math.min(...(m || []).map(x => x.length));
  return s.replace(RegExp(`^[ \t]{${i}}`, 'gm'), '').trim();
}

// Browser runtime: collect all sources (inline scripts, data-src files, bundles),
// compile them in a shared scope, and execute as one async IIFE.
//
// data-src URLs ending in .rip are fetched as individual source files.
// All other URLs are fetched as JSON bundles containing multiple files.
async function processRipScripts() {
  const sources = [];

  // Step 1: Collect data-src URLs from the runtime script tag
  const runtimeTag = document.querySelector('script[src$="rip.min.js"], script[src$="rip.js"]');
  const dataSrc = runtimeTag?.getAttribute('data-src');
  if (dataSrc) {
    for (const url of dataSrc.trim().split(/\s+/)) {
      if (url) sources.push({ url });
    }
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

    // Step 3b: Expand bundles into individual sources
    const expanded = [];
    for (const s of sources) {
      if (s.bundle) {
        const comps = s.bundle.components || {};
        for (const [name, code] of Object.entries(comps)) {
          expanded.push({ code, url: name });
        }
        if (s.bundle.data) {
          if (!s.bundle._dataMerged) {
            s.bundle._dataMerged = true;
            const stateAttr = runtimeTag?.getAttribute('data-state');
            let initial = {};
            if (stateAttr) {
              try { initial = JSON.parse(stateAttr); } catch {}
            }
            Object.assign(initial, s.bundle.data);
            runtimeTag?.setAttribute('data-state', JSON.stringify(initial));
          }
        }
      } else if (s.code) {
        expanded.push(s);
      }
    }

    const opts = { skipRuntimes: true, skipExports: true };
    const compiled = [];
    for (const s of expanded) {
      if (!s.code) continue;
      try {
        const js = compileToJS(s.code, opts);
        compiled.push({ js, url: s.url || 'inline' });
      } catch (e) {
        console.error(`Rip compile error in ${s.url || 'inline'}:`, e.message);
      }
    }

    // Step 4: Create app stash
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

    // Step 5: Execute all compiled code in shared scope
    if (compiled.length > 0) {
      let js = compiled.map(c => c.js).join('\n');

      const mount = runtimeTag?.getAttribute('data-mount');
      if (mount) {
        const target = runtimeTag.getAttribute('data-target') || 'body';
        js += `\n${mount}.mount(${JSON.stringify(target)});`;
      }

      try {
        await (0, eval)(`(async()=>{\n${js}\n})()`);
        document.body.classList.add('ready');
      } catch (e) {
        if (e instanceof SyntaxError) {
          console.error(`Rip syntax error in combined output: ${e.message}`);
          for (const c of compiled) {
            try { new Function(`(async()=>{\n${c.js}\n})()`); }
            catch (e2) { console.error(`  → source: ${c.url}`, e2.message); }
          }
        } else {
          console.error('Rip runtime error:', e);
        }
      }
    }
  }

  // Step 6: data-reload enables SSE hot-reload from dev server
  if (runtimeTag?.hasAttribute('data-reload')) {
    let ready = false;
    const es = new EventSource('/watch');
    es.addEventListener('connected', () => {
      if (ready) location.reload();
      ready = true;
    });
    es.addEventListener('reload', (e) => {
      if (e.data === 'styles') {
        const t = Date.now();
        document.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
          if (new URL(l.href).origin !== location.origin) return;
          const url = new URL(l.href);
          url.searchParams.set('_r', t);
          l.href = url.toString();
        });
      } else {
        location.reload();
      }
    });
  }
}

export { processRipScripts };

/**
 * Import a .rip file as an ES module
 * Fetches the URL, compiles Rip→JS, dynamically imports via Blob URL
 * Usage: const { launch } = await importRip('/ui.rip')
 *
 * Pre-compiled modules can be registered on importRip.modules to skip fetching.
 * The browser bundle uses this to embed ui.rip without a server round-trip.
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
    console.error('Rip compilation error:', error.message);
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
