// Browser-compatible entry point for Rip compiler
// Includes runtime for <script type="text/rip"> support

export { Lexer } from './lexer.js';
export { parser } from './parser.js';
export { CodeGenerator, Compiler, compile, compileToJS, formatSExpr, getReactiveRuntime, getComponentRuntime } from './compiler.js';

// Version info (replaced during build)
export const VERSION = "0.0.0";
export const BUILD_DATE = "0000-00-00@00:00:00GMT";

// Import compiler functions for use in rip() function and globalThis registration
import { compile, compileToJS, formatSExpr, getReactiveRuntime, getComponentRuntime } from './compiler.js';

// Eagerly register Rip's reactive primitives on globalThis so that
// framework code (ui.rip) can use them directly without the compiler
// needing to detect reactive operators in the source
if (typeof globalThis !== 'undefined' && !globalThis.__rip) {
  new Function(getReactiveRuntime())();
}

const dedent = s => {
  const m = s.match(/^[ \t]*(?=\S)/gm);
  const i = Math.min(...(m || []).map(x => x.length));
  return s.replace(RegExp(`^[ \t]{${i}}`, 'gm'), '').trim();
}

// Browser runtime for executing <script type="text/rip"> tags
// Supports both inline scripts and external files via src attribute
async function processRipScripts() {
  const scripts = document.querySelectorAll('script[type="text/rip"]');

  for (const script of scripts) {
    if (script.hasAttribute('data-rip-processed')) continue;

    try {
      let ripCode;
      if (script.src) {
        const response = await fetch(script.src);
        if (!response.ok) {
          console.error(`Rip: failed to fetch ${script.src} (${response.status})`);
          continue;
        }
        ripCode = await response.text();
      } else {
        ripCode = dedent(script.textContent);
      }

      let jsCode;
      try {
        jsCode = compileToJS(ripCode);
      } catch (compileError) {
        console.error('Rip compile error:', compileError.message);
        console.error('Source:', ripCode);
        continue;
      }

      // Execute as async to support await (importRip!, etc.)
      await (0, eval)(`(async()=>{\n${jsCode}\n})()`);

      script.setAttribute('data-rip-processed', 'true');
    } catch (error) {
      console.error('Rip runtime error:', error);
    }
  }
}

export { processRipScripts };

/**
 * Import a .rip file as an ES module
 * Fetches the URL, compiles Rip→JS, dynamically imports via Blob URL
 * Usage: const { launch } = await importRip('/ui.rip')
 *
 * Pre-compiled modules can be registered on importRip.modules to skip fetching.
 * The rip-ui bundle uses this to embed ui.rip without a server round-trip.
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
  const blob = new Blob([js], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  try {
    return await import(blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
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
  globalThis.__ripExports = { compile, compileToJS, formatSExpr, VERSION, BUILD_DATE, getReactiveRuntime, getComponentRuntime };
}

// Auto-process <script type="text/rip"> blocks.
// Deferred via queueMicrotask so bundled entry code (e.g. rip-ui.min.js registering
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
