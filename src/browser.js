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

// Browser runtime: collect all <script type="text/rip"> sources (inline + src)
// plus any data-src URLs on the runtime tag, compile them all with shared-scope
// options, and execute as one async IIFE. Then handle data-launch for server mode.
async function processRipScripts() {
  const sources = [];

  // 1. Collect data-src URLs from the runtime script tag
  const runtimeTag = document.querySelector('script[src$="rip.min.js"], script[src$="rip.js"]');
  const dataSrc = runtimeTag?.getAttribute('data-src');
  if (dataSrc) {
    for (const url of dataSrc.trim().split(/\s+/)) {
      if (url) sources.push({ url });
    }
  }

  // 2. Collect all <script type="text/rip"> tags (inline and external)
  for (const script of document.querySelectorAll('script[type="text/rip"]')) {
    if (script.src) {
      sources.push({ url: script.src });
    } else {
      const code = dedent(script.textContent);
      if (code) sources.push({ code });
    }
  }

  // 3. If any sources, fetch externals, compile all, execute in shared scope
  if (sources.length > 0) {
    await Promise.all(sources.map(async (s) => {
      if (!s.url) return;
      try {
        const res = await fetch(s.url);
        if (!res.ok) {
          console.error(`Rip: failed to fetch ${s.url} (${res.status})`);
          return;
        }
        s.code = await res.text();
      } catch (e) {
        console.error(`Rip: failed to fetch ${s.url}:`, e.message);
      }
    }));

    const opts = { skipRuntimes: true, skipExports: true };
    const compiled = [];
    for (const s of sources) {
      if (!s.code) continue;
      try {
        compiled.push(compileToJS(s.code, opts));
      } catch (e) {
        console.error('Rip compile error:', e.message);
      }
    }

    if (compiled.length > 0) {
      const js = compiled.join('\n');
      try {
        await (0, eval)(`(async()=>{\n${js}\n})()`);
      } catch (e) {
        console.error('Rip runtime error:', e);
      }
    }
  }

  // 4. data-launch triggers launch() for server mode
  const cfg = document.querySelector('script[data-launch]');
  if (cfg && !globalThis.__ripLaunched) {
    const ui = importRip.modules?.['app.rip'];
    if (ui?.launch) {
      const url = cfg.getAttribute('data-launch') || '';
      const hash = cfg.getAttribute('data-hash');
      const opts = { hash: hash !== 'false' };
      if (url) opts.bundleUrl = url;
      await ui.launch('', opts);
    }
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

// Auto-process <script type="text/rip"> blocks and handle data-launch.
// Deferred via queueMicrotask so bundled entry code (e.g. rip.min.js registering
// importRip.modules) runs before script processing begins.
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
