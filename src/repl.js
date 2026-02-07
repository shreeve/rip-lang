/**
 * Rip REPL - Interactive Read-Eval-Print Loop
 *
 * Features:
 * - Multi-line input detection
 * - Command history
 * - Special commands (.help, .clear, .vars, etc.)
 * - Colored output
 * - Persistent context
 * - Native ES module support via vm.SourceTextModule
 * - Direct .rip file imports (compiled on-the-fly)
 */

import * as readline from 'readline';
import { inspect } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vm from 'vm';
import { Compiler, compileToJS } from './compiler.js';
import packageJson from '../package.json' with { type: 'json' };

const VERSION = packageJson.version;

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

export class RipREPL {
  constructor() {
    this.buffer = '';   // Multi-line input buffer
    this.history = [];  // Command history
    this.historyFile = path.join(os.homedir(), '.rip_history');
    this.reactiveVars = new Set();  // Track reactive variables across lines
    this.cwd = process.cwd();

    // Persisted variables across evaluations
    this.vars = {};

    // Module cache for linked modules
    this.moduleCache = new Map();

    // VM context with necessary globals
    this.vmContext = vm.createContext({
      console,
      process,
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      Buffer,
      URL,
      URLSearchParams,
      TextEncoder,
      TextDecoder,
      __vars: this.vars  // Reference to persisted variables
    });

    // Inject reactive runtime
    this.injectReactiveRuntime();

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.getPrompt(),
      historySize: 1000,
      removeHistoryDuplicates: true
    });

    // Load persistent history from file
    this.loadHistory();
  }

  get context() {
    return this.vars;
  }

  getPrompt() {
    if (this.buffer) {
      return `${colors.dim}....>${colors.reset} `;  // Continuation prompt
    }
    return `${colors.cyan}rip>${colors.reset} `;
  }

  start() {
    this.printWelcome();

    this.rl.on('line', async (line) => {
      await this.handleLine(line);
    });

    this.rl.on('close', () => {
      this.saveHistory();
      console.log(`\n${colors.gray}Goodbye!${colors.reset}`);
      process.exit(0);
    });

    this.rl.prompt();
  }

  printWelcome() {
    console.log(`${colors.bright}Rip ${VERSION}${colors.reset} - Interactive REPL`);
    console.log(`${colors.gray}Type ${colors.cyan}.help${colors.gray} for commands, ${colors.cyan}Ctrl+C${colors.gray} to exit${colors.reset}\n`);
  }

  injectReactiveRuntime() {
    // Define reactive primitives in the VM context
    const ctx = this.vmContext;

    ctx.__currentEffect = null;
    ctx.__pendingEffects = new Set();

    ctx.__state = function(v) {
      const subs = new Set();
      let notifying = false, locked = false, dead = false;
      const s = {
        get value() { if (dead) return v; if (ctx.__currentEffect) { subs.add(ctx.__currentEffect); ctx.__currentEffect.dependencies.add(subs); } return v; },
        set value(n) {
          if (dead || locked || n === v || notifying) return;
          v = n;
          notifying = true;
          for (const sub of subs) if (sub.markDirty) sub.markDirty();
          for (const sub of subs) if (!sub.markDirty) ctx.__pendingEffects.add(sub);
          const fx = [...ctx.__pendingEffects]; ctx.__pendingEffects.clear();
          for (const e of fx) e.run();
          notifying = false;
        },
        read() { return v; },
        lock() { locked = true; return s; },
        free() { subs.clear(); return s; },
        kill() { dead = true; subs.clear(); return v; },
        valueOf() { return this.value; },
        toString() { return String(this.value); },
        [Symbol.toPrimitive](hint) { return hint === 'string' ? this.toString() : this.valueOf(); }
      };
      return s;
    };

    ctx.__computed = function(fn) {
      let v, dirty = true, locked = false, dead = false;
      const subs = new Set();
      const c = {
        dependencies: new Set(),
        markDirty() {
          if (!dead && !locked && !dirty) { dirty = true; for (const s of subs) if (s.markDirty) s.markDirty(); for (const s of subs) if (!s.markDirty) ctx.__pendingEffects.add(s); }
        },
        get value() {
          if (dead) return v;
          if (ctx.__currentEffect) { subs.add(ctx.__currentEffect); ctx.__currentEffect.dependencies.add(subs); }
          if (dirty && !locked) {
            for (const d of c.dependencies) d.delete(c); c.dependencies.clear();
            const prev = ctx.__currentEffect; ctx.__currentEffect = c;
            try { v = fn(); } finally { ctx.__currentEffect = prev; }
            dirty = false;
          }
          return v;
        },
        read() { return dead ? v : c.value; },
        lock() { locked = true; c.value; return c; },
        free() { for (const d of c.dependencies) d.delete(c); c.dependencies.clear(); subs.clear(); return c; },
        kill() { dead = true; const result = v; c.free(); return result; },
        valueOf() { return this.value; },
        toString() { return String(this.value); },
        [Symbol.toPrimitive](hint) { return hint === 'string' ? this.toString() : this.valueOf(); }
      };
      return c;
    };

    ctx.__effect = function(fn) {
      const e = {
        dependencies: new Set(),
        run() {
          for (const d of e.dependencies) d.delete(e); e.dependencies.clear();
          const prev = ctx.__currentEffect; ctx.__currentEffect = e;
          try { fn(); } finally { ctx.__currentEffect = prev; }
        },
        free() { for (const d of e.dependencies) d.delete(e); e.dependencies.clear(); }
      };
      e.run();
      return () => e.free();
    };

    ctx.__batch = function(fn) { fn(); };
    ctx.__readonly = function(v) { return Object.freeze({ value: v }); };
  }

  async handleLine(line) {
    // Handle special commands
    if (line.startsWith('.')) {
      this.handleCommand(line);
      this.rl.setPrompt(this.getPrompt());
      this.rl.prompt();
      return;
    }

    // Add to buffer
    if (this.buffer) {
      this.buffer += '\n' + line;
    } else {
      this.buffer = line;
    }

    // Check if input is complete
    if (this.isComplete(this.buffer)) {
      await this.evaluate(this.buffer);
      this.buffer = '';
    }

    this.rl.setPrompt(this.getPrompt());
    this.rl.prompt();
  }

  isComplete(code) {
    if (!code.trim()) return true;

    let parens = 0, braces = 0, brackets = 0;
    let inString = false;
    let stringChar = null;

    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      const prev = i > 0 ? code[i - 1] : null;

      if ((char === '"' || char === "'") && prev !== '\\') {
        if (inString && char === stringChar) {
          inString = false;
          stringChar = null;
        } else if (!inString) {
          inString = true;
          stringChar = char;
        }
      }

      if (inString) continue;

      if (char === '(') parens++;
      if (char === ')') parens--;
      if (char === '{') braces++;
      if (char === '}') braces--;
      if (char === '[') brackets++;
      if (char === ']') brackets--;
    }

    if (parens > 0 || braces > 0 || brackets > 0) return false;

    const trimmed = code.trim();

    if (trimmed.endsWith('++') || trimmed.endsWith('--')) return true;
    if (/\/[gimsuvy]*$/.test(trimmed)) return true;
    if (trimmed.endsWith('\\') || trimmed.endsWith(',')) return false;
    if (trimmed.endsWith('->') || trimmed.endsWith('=>')) return false;

    if (trimmed.endsWith('=') && !trimmed.endsWith('==') && !trimmed.endsWith('!=') &&
        !trimmed.endsWith('>=') && !trimmed.endsWith('<=') && !trimmed.endsWith('??=') &&
        !trimmed.endsWith('&&=') && !trimmed.endsWith('||=') && !trimmed.endsWith('=~')) {
      return false;
    }

    if (trimmed.endsWith('+') || trimmed.endsWith('-')) return false;
    if (trimmed.endsWith('*') && !trimmed.endsWith('**')) return false;

    return true;
  }

  async evaluate(code) {
    try {
      this.history.push(code);

      const compiler = new Compiler({
        showTokens: this.showTokens,
        showSExpr: this.showSExp,
        skipReactiveRuntime: true,
        reactiveVars: this.reactiveVars
      });
      const result = compiler.compile(code);

      if (result.reactiveVars) {
        for (const v of result.reactiveVars) {
          this.reactiveVars.add(v);
        }
      }

      let js = result.code;

      if (this.showJS) {
        console.log(`${colors.gray}// Compiled JavaScript:${colors.reset}`);
        console.log(`${colors.dim}${js}${colors.reset}\n`);
      }

      const evalResult = await this.moduleEval(js);

      if (evalResult !== undefined) {
        this.vars._ = evalResult;
        this.printResult(evalResult);
      }
    } catch (error) {
      this.printError(error);
    }
  }

  // Module linker for resolving imports
  async linker(specifier, referencingModule) {
    return this.resolveModule(specifier, referencingModule.identifier);
  }

  // Resolve and load a module
  async resolveModule(specifier, referrer) {
    // Resolve relative paths based on referrer location
    let resolvedPath = specifier;
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      const referrerDir = referrer ? path.dirname(referrer) : this.cwd;
      resolvedPath = path.resolve(referrerDir, specifier);
    }

    // Check cache
    if (this.moduleCache.has(resolvedPath)) {
      return this.moduleCache.get(resolvedPath);
    }

    // Handle .rip files - compile on the fly
    if (resolvedPath.endsWith('.rip')) {
      const source = fs.readFileSync(resolvedPath, 'utf-8');
      const js = compileToJS(source);

      const ripMod = new vm.SourceTextModule(js, {
        context: this.vmContext,
        identifier: resolvedPath
      });
      await ripMod.link(this.linker.bind(this));
      await ripMod.evaluate();
      this.moduleCache.set(resolvedPath, ripMod);
      return ripMod;
    }

    // Import native/npm modules
    const imported = await import(specifier);
    const exportNames = [...new Set([...Object.keys(imported), 'default'])];

    const synth = new vm.SyntheticModule(
      exportNames,
      function() {
        for (const key of exportNames) {
          if (key in imported) this.setExport(key, imported[key]);
        }
      },
      { context: this.vmContext, identifier: specifier }
    );

    // SyntheticModule needs to be linked and evaluated
    await synth.link(() => {});
    await synth.evaluate();

    this.moduleCache.set(resolvedPath, synth);
    return synth;
  }

  // Evaluate using vm.SourceTextModule (no temp files!)
  async moduleEval(js) {
    // Extract declared variables (both let and const)
    const declaredVars = new Set();
    for (const match of js.matchAll(/^let\s+([^=]+);$/gm)) {
      for (const name of match[1].split(/\s*,\s*/)) declaredVars.add(name.trim());
    }
    for (const match of js.matchAll(/^const\s+(\w+)\s*=/gm)) {
      declaredVars.add(match[1]);
    }

    // Transform reactive declarations to persist in __vars
    // const x = __state(...) → const x = __vars.x ?? (__vars.x = __state(...)); x;
    // const x = __computed(...) → const x = __vars.x ?? (__vars.x = __computed(...)); x;
    // const x = __effect(...) → const x = __vars.x ?? (__vars.x = __effect(...)); x;
    // The trailing `x;` ensures the value is captured and displayed
    js = js.replace(
      /^const\s+(\w+)\s*=\s*((?:__state|__computed|__effect)\(.+\));?$/gm,
      (match, varName, rhs) => {
        return `const ${varName} = __vars['${varName}'] ?? (__vars['${varName}'] = ${rhs});\n${varName};`;
      }
    );

    // Transform await import() to static imports (workaround for Bun bug #24217)
    const dynamicImports = [];
    let counter = 0;
    js = js.replace(/await\s+import\s*\(\s*(['"])([^'"]+)\1\s*\)/g, (match, quote, specifier) => {
      const varName = '__import_' + counter++ + '__';
      dynamicImports.push({ varName, specifier });
      return varName;
    });

    const staticImports = dynamicImports
      .map(({ varName, specifier }) => `import * as ${varName} from '${specifier}';`)
      .join('\n');

    // Restore existing variables and remove duplicate declarations
    const existingVars = Object.keys(this.vars);
    const existingNonReactive = existingVars.filter(v => !this.reactiveVars.has(v));

    // Remove existing vars from hoisted let declarations (handles comma-separated)
    const existingSet = new Set(existingNonReactive);
    js = js.replace(/^let\s+([^=]+);$/gm, (match, varList) => {
      const vars = varList.split(/\s*,\s*/);
      const newVars = vars.filter(v => !existingSet.has(v));
      if (newVars.length === 0) return '';
      return `let ${newVars.join(', ')};`;
    });
    // Remove let from initialized existing vars: let x = → x =
    for (const v of existingNonReactive) {
      js = js.replace(new RegExp(`^let ${v}(\\s*=)`, 'm'), `${v}$1`);
    }

    // Build restore code
    // Non-reactive vars: let x = __vars['x'];
    // Reactive vars: const x = __vars['x']; (they're already stored)
    const nonReactiveRestore = existingNonReactive
      .filter(k => k !== '_')
      .map(v => `let ${v} = __vars['${v}'];`)
      .join('\n');

    const reactiveRestore = [...this.reactiveVars]
      .filter(v => existingVars.includes(v))
      .map(v => `const ${v} = __vars['${v}'];`)
      .join('\n');

    const restoreCode = [nonReactiveRestore, reactiveRestore].filter(Boolean).join('\n');

    // Build save code (save non-reactive vars back to __vars)
    // Reactive vars are already saved via the const transformation
    const nonReactiveVars = [...new Set([...existingNonReactive, ...declaredVars])]
      .filter(k => k !== '_' && !this.reactiveVars.has(k));
    const saveCode = nonReactiveVars
      .map(v => `if (typeof ${v} !== 'undefined') __vars['${v}'] = ${v};`)
      .join('\n');

    // Extract last expression for result capture
    const lines = js.trim().split('\n');
    let lastLine = lines[lines.length - 1];

    if (lastLine && !lastLine.startsWith('import ') && !lastLine.startsWith('export ') &&
        !lastLine.startsWith('let ') && !lastLine.startsWith('const ')) {
      if (lastLine.endsWith(';')) lastLine = lastLine.slice(0, -1);
      lines[lines.length - 1] = '__result = ' + lastLine + ';';
    }

    // Build module code
    const moduleCode = `${staticImports}
${restoreCode}
let __result;
${lines.join('\n')}
${saveCode}
export { __result };
`;

    // Create and evaluate module
    const mod = new vm.SourceTextModule(moduleCode, {
      context: this.vmContext,
      identifier: this.cwd + '/repl-' + Date.now()
    });

    await mod.link(this.linker.bind(this));
    await mod.evaluate();

    return mod.namespace.__result;
  }

  printResult(value) {
    // For reactive values, show the actual value
    let displayValue = value;
    if (value && typeof value === 'object' && 'value' in value &&
        (typeof value.valueOf === 'function' || typeof value.markDirty === 'function')) {
      displayValue = value.value;
    }

    const formatted = inspect(displayValue, {
      colors: true,
      depth: 3,
      maxArrayLength: 100
    });
    console.log(`${colors.green}→${colors.reset} ${formatted}`);
  }

  printError(error) {
    console.log(`${colors.red}✗${colors.reset} ${colors.red}${error.message}${colors.reset}`);
    if (error.stack && process.env.RIP_DEBUG) {
      console.log(`${colors.dim}${error.stack}${colors.reset}`);
    }
  }

  handleCommand(cmd) {
    const parts = cmd.split(/\s+/);
    const command = parts[0];

    switch (command) {
      case '.help':
        this.printHelp();
        break;

      case '.clear':
        this.vars = {};
        this.vmContext.__vars = this.vars;
        this.moduleCache.clear();
        this.reactiveVars = new Set();
        this.buffer = '';
        console.log(`${colors.green}Context cleared${colors.reset}`);
        break;

      case '.vars':
        this.printVars();
        break;

      case '.history':
        this.printHistory();
        break;

      case '.exit':
        this.rl.close();
        break;

      case '.tokens':
        this.showTokens = !this.showTokens;
        console.log(`${colors.yellow}Token display: ${this.showTokens ? 'ON' : 'OFF'}${colors.reset}`);
        break;

      case '.sexp':
        this.showSExp = !this.showSExp;
        console.log(`${colors.yellow}S-expression display: ${this.showSExp ? 'ON' : 'OFF'}${colors.reset}`);
        break;

      case '.js':
        this.showJS = !this.showJS;
        console.log(`${colors.yellow}JavaScript display: ${this.showJS ? 'ON' : 'OFF'}${colors.reset}`);
        break;

      default:
        console.log(`${colors.red}Unknown command: ${command}${colors.reset}`);
        console.log(`${colors.gray}Type .help for available commands${colors.reset}`);
    }
  }

  printHelp() {
    console.log(`
${colors.bright}Rip REPL Commands:${colors.reset}

${colors.cyan}Special Commands:${colors.reset}
  .help          Show this help message
  .clear         Clear the context (reset all variables)
  .vars          Show all defined variables
  .history       Show command history
  .exit          Exit the REPL (or Ctrl+C)

${colors.cyan}Debug Toggles:${colors.reset}
  .tokens        Toggle token stream display
  .sexp          Toggle s-expression display
  .js            Toggle compiled JavaScript display

${colors.cyan}Tips:${colors.reset}
  - Multi-line input is supported (press Enter mid-expression)
  - Import .rip files: { x } = await import('./file.rip')
  - Use Tab for history navigation
  - Previous results stored in _ variable
  - Use Ctrl+C to cancel multi-line input or exit
`);
  }

  printVars() {
    const userVars = Object.keys(this.vars).filter(k => k !== '_');

    if (userVars.length === 0) {
      console.log(`${colors.gray}No variables defined${colors.reset}`);
      return;
    }

    console.log(`${colors.bright}Defined variables:${colors.reset}`);
    userVars.forEach(key => {
      const value = this.vars[key];
      const isReactive = this.reactiveVars.has(key);

      // For reactive vars, display the .value and indicate the type
      let displayValue, typeIndicator;
      if (isReactive && value && typeof value === 'object' && 'value' in value) {
        displayValue = value.value;
        // Determine reactive type
        if (typeof value.markDirty === 'function') {
          typeIndicator = `${colors.magenta}~=${colors.reset}`;  // computed
        } else if (typeof value.run === 'function' || typeof value === 'function') {
          typeIndicator = `${colors.magenta}~>${colors.reset}`;  // effect
        } else {
          typeIndicator = `${colors.magenta}:=${colors.reset}`;  // state
        }
      } else {
        displayValue = value;
        typeIndicator = `${colors.gray}=${colors.reset}`;
      }

      const preview = inspect(displayValue, { colors: true, depth: 0, maxArrayLength: 3 });
      console.log(`  ${colors.cyan}${key}${colors.reset} ${typeIndicator} ${preview}`);
    });

    if (this.vars._ !== undefined) {
      console.log(`  ${colors.dim}${colors.cyan}_${colors.reset}${colors.dim} = ${inspect(this.vars._, { colors: true, depth: 0 })}${colors.reset}`);
    }
  }

  printHistory() {
    if (this.history.length === 0) {
      console.log(`${colors.gray}No history${colors.reset}`);
      return;
    }

    console.log(`${colors.bright}Command history:${colors.reset}`);
    const recent = this.history.slice(-20);
    const startIdx = this.history.length - recent.length;
    recent.forEach((cmd, i) => {
      console.log(`  ${colors.gray}${startIdx + i + 1}:${colors.reset} ${cmd.replace(/\n/g, '⏎ ')}`);
    });
  }

  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const historyData = fs.readFileSync(this.historyFile, 'utf-8');
        const lines = historyData.split('\n').filter(line => line.trim());
        this.history = lines;
        this.rl.history = [...lines].reverse();
      }
    } catch (error) {
      // Silently ignore errors
    }
  }

  saveHistory() {
    try {
      const toSave = this.history.slice(-1000);
      fs.writeFileSync(this.historyFile, toSave.join('\n') + '\n', 'utf-8');
    } catch (error) {
      // Silently ignore errors
    }
  }
}

/**
 * Start the REPL
 */
export function startREPL() {
  const repl = new RipREPL();
  repl.start();
}
