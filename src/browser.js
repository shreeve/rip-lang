// Browser-compatible entry point for Rip compiler
// Includes runtime for <script type="text/rip"> support

export { Lexer } from './lexer.js';
export { parser } from './parser.js';
export { CodeGenerator, Compiler, compile, compileToJS, formatSExpr } from './compiler.js';

// Version info (replaced during build)
export const VERSION = "0.0.0";
export const BUILD_DATE = "0000-00-00@00:00:00GMT";

// Import compileToJS for use in rip() function
import { compileToJS } from './compiler.js';

const dedent = s => {
  const m = s.match(/^[ \t]*(?=\S)/gm);
  const i = Math.min(...(m || []).map(x => x.length));
  return s.replace(RegExp(`^[ \t]{${i}}`, 'gm'), '').trim();
}

// Browser runtime for executing <script type="text/rip"> tags
async function processRipScripts() {
  const scripts = document.querySelectorAll('script[type="text/rip"]');

  for (const script of scripts) {
    // Skip if already processed
    if (script.hasAttribute('data-rip-processed')) {
      continue;
    }

    try {
      // Get script content and remove HTML indentation
      const ripCode = dedent(script.textContent);

      // Compile to JavaScript
      const jsCode = compileToJS(ripCode);

      // Execute in global scope using indirect eval
      // This makes functions available as global variables
      (0, eval)(jsCode);

      // Mark as processed
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
    // DOM already loaded, process immediately
    processRipScripts();
  }
}

// Export for manual processing if needed
export { processRipScripts };

/**
 * Browser Console REPL
 * Usage: rip('x = 42')  → evaluates and returns result
 */
export function rip(code) {
  try {
    const js = compileToJS(code);

    // For browser console, strip ALL let/const declarations
    // Variables will be created as implicit globals
    let persistentJs = js.replace(/^let\s+[^;]+;\s*\n\s*/m, '');
    persistentJs = persistentJs.replace(/^const\s+/gm, 'var ');

    // Evaluate in global scope - variables become properties of globalThis
    const result = (1, eval)(persistentJs);

    // Store in global _ for convenience
    if (result !== undefined) {
      globalThis._ = result;
    }

    return result;
  } catch (error) {
    console.error('Rip compilation error:', error.message);
    return undefined;
  }
}

// Make rip() available globally for console use
if (typeof globalThis !== 'undefined') {
  globalThis.rip = rip;
}
