// Browser-compatible entry point for Rip compiler
// Includes runtime for <script type="text/rip"> support

export { Lexer } from './lexer.js';
export { parser } from './parser.js';
export { CodeGenerator, Compiler, compile, compileToJS, formatSExpr, getReactiveRuntime, getComponentRuntime } from './compiler.js';

// Version info (replaced during build)
export const VERSION = "0.0.0";
export const BUILD_DATE = "0000-00-00@00:00:00GMT";

// Import compileToJS for use in rip() function
import { compileToJS, getReactiveRuntime } from './compiler.js';

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
async function processRipScripts() {
  const scripts = document.querySelectorAll('script[type="text/rip"]');

  for (const script of scripts) {
    if (script.hasAttribute('data-rip-processed')) continue;

    try {
      const ripCode = dedent(script.textContent);
      const jsCode = compileToJS(ripCode);

      // Execute as async to support await (importRip!, etc.)
      await (0, eval)(`(async()=>{\n${jsCode}\n})()`);

      script.setAttribute('data-rip-processed', 'true');
    } catch (error) {
      console.error('Error compiling Rip script:', error);
      console.error('Script content:', script.textContent);
    }
  }
}

// Auto-process scripts when this module loads
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processRipScripts);
  } else {
    processRipScripts();
  }
}

export { processRipScripts };

/**
 * Import a .rip file as an ES module
 * Fetches the URL, compiles Rip→JS, dynamically imports via Blob URL
 * Usage: const { launch } = await importRip('/ui.rip')
 */
export async function importRip(url) {
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

// Make key functions available globally for console and <script type="text/rip"> use
if (typeof globalThis !== 'undefined') {
  globalThis.rip = rip;
  globalThis.importRip = importRip;
  globalThis.compileToJS = compileToJS;
}
