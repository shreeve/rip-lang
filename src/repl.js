/**
 * Rip REPL - Interactive Read-Eval-Print Loop
 *
 * Features:
 * - Multi-line input detection
 * - Command history
 * - Special commands (.help, .clear, .vars, etc.)
 * - Colored output
 * - Persistent context
 */

import * as readline from 'readline';
import { inspect } from 'util';
import * as vm from 'vm';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Compiler } from './compiler.js';
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
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

export class RipREPL {
  constructor() {
    this.buffer = '';   // Multi-line input buffer
    this.history = [];  // Command history
    this.historyFile = path.join(os.homedir(), '.rip_history');

    // Create persistent VM context (like a sandboxed global scope)
    this.context = vm.createContext({
      console,
      process,
      Buffer,
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      // Add any other globals you want available
    });

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

  getPrompt() {
    if (this.buffer) {
      return `${colors.dim}....>${colors.reset} `;  // Continuation prompt
    }
    return `${colors.cyan}rip>${colors.reset} `;
  }

  start() {
    this.printWelcome();

    this.rl.on('line', (line) => {
      this.handleLine(line);
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

  handleLine(line) {
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
      this.evaluate(this.buffer);
      this.buffer = '';
    }

    this.rl.setPrompt(this.getPrompt());
    this.rl.prompt();
  }

  isComplete(code) {
    // Simple heuristic: check for balanced braces/parens/brackets
    // and whether it ends with incomplete syntax

    if (!code.trim()) return true;

    // Count brackets
    let parens = 0, braces = 0, brackets = 0;
    let inString = false;
    let stringChar = null;

    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      const prev = i > 0 ? code[i - 1] : null;

      // Handle strings (skip counting inside strings)
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

      // Count brackets
      if (char === '(') parens++;
      if (char === ')') parens--;
      if (char === '{') braces++;
      if (char === '}') braces--;
      if (char === '[') brackets++;
      if (char === ']') brackets--;
    }

    // Check if incomplete
    if (parens > 0 || braces > 0 || brackets > 0) {
      return false;  // Has unclosed brackets
    }

    // Check for trailing operators that suggest continuation
    const trimmed = code.trim();

    // Complete statements (don't wait for more input)
    if (trimmed.endsWith('++') || trimmed.endsWith('--')) {
      return true;  // x++ and x-- are complete
    }

    // Check if ends with regex literal /pattern/flags
    // Regex can end with / followed by optional flags (gimsuvy)
    if (/\/[gimsuvy]*$/.test(trimmed)) {
      return true;  // Likely a regex, complete
    }

    // Incomplete operators (wait for more input)
    if (trimmed.endsWith('\\') || trimmed.endsWith(',')) {
      return false;
    }

    if (trimmed.endsWith('->') || trimmed.endsWith('=>')) {
      return false;  // Arrow functions need body
    }

    // Assignment operators
    if (trimmed.endsWith('=') && !trimmed.endsWith('==') && !trimmed.endsWith('!=') &&
        !trimmed.endsWith('>=') && !trimmed.endsWith('<=') && !trimmed.endsWith('??=') &&
        !trimmed.endsWith('&&=') && !trimmed.endsWith('||=') && !trimmed.endsWith('=~')) {
      return false;
    }

    // Arithmetic operators (check AFTER ++ and -- are handled)
    if (trimmed.endsWith('+') || trimmed.endsWith('-')) {
      return false;  // Binary + or -
    }

    if (trimmed.endsWith('*') && !trimmed.endsWith('**')) {
      return false;
    }

    // Division operator (check AFTER regex pattern)
    if (trimmed.endsWith('/') && !trimmed.endsWith('//') && !/\/[gimsuvy]*$/.test(trimmed)) {
      return false;
    }

    return true;
  }

  evaluate(code) {
    try {
      // Add to history
      this.history.push(code);

      // Compile Rip to JavaScript with debug options
      const compiler = new Compiler({
        showTokens: this.showTokens,
        showSExpr: this.showSExp
      });
      const result = compiler.compile(code);

      const js = result.code;

      // Show compiled JS if enabled
      if (this.showJS) {
        console.log(`${colors.gray}// Compiled JavaScript:${colors.reset}`);
        console.log(`${colors.dim}${js}${colors.reset}\n`);
      }

      // Convert let/const to var for REPL persistence in vm context
      // In vm.runInContext, var declarations persist while let/const are scoped
      let processedJs = js;

      // Replace 'let x, y, z;' with 'var x, y, z;'
      processedJs = processedJs.replace(/^let\s+/m, 'var ');

      // Replace 'const x =' with 'var x ='
      processedJs = processedJs.replace(/^const\s+/gm, 'var ');

      // Evaluate in persistent context
      const evalResult = vm.runInContext(processedJs, this.context);

      // Store result in _ for convenience
      if (evalResult !== undefined) {
        this.context._ = evalResult;
        this.printResult(evalResult);
      }
    } catch (error) {
      this.printError(error);
    }
  }

  printResult(value) {
    // Pretty print the result
    const formatted = inspect(value, {
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
        // Recreate the context to clear all variables
        this.context = vm.createContext({
          console,
          process,
          Buffer,
          setTimeout,
          setInterval,
          clearTimeout,
          clearInterval,
        });
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
  - Use Tab for history navigation
  - Previous results stored in _ variable
  - Use Ctrl+C to cancel multi-line input or exit
`);
  }

  printVars() {
    // Get all variables from the context (excluding built-in globals)
    const builtins = new Set(['console', 'process', 'Buffer', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', '_']);
    const allKeys = Object.keys(this.context);
    const userVars = allKeys.filter(k => !builtins.has(k) && !k.startsWith('_'));

    if (userVars.length === 0) {
      console.log(`${colors.gray}No variables defined${colors.reset}`);
      return;
    }

    console.log(`${colors.bright}Defined variables:${colors.reset}`);
    userVars.forEach(key => {
      const value = this.context[key];
      const preview = inspect(value, { colors: true, depth: 0, maxArrayLength: 3 });
      console.log(`  ${colors.cyan}${key}${colors.reset} = ${preview}`);
    });

    // Show _ if it exists
    if (this.context._ !== undefined) {
      console.log(`  ${colors.dim}${colors.cyan}_${colors.reset}${colors.dim} = ${inspect(this.context._, { colors: true, depth: 0 })}${colors.reset}`);
    }
  }

  printHistory() {
    if (this.history.length === 0) {
      console.log(`${colors.gray}No history${colors.reset}`);
      return;
    }

    console.log(`${colors.bright}Command history:${colors.reset}`);
    this.history.slice(-20).forEach((cmd, i) => {
      const num = this.history.length - 20 + i + 1;
      console.log(`  ${colors.gray}${num}:${colors.reset} ${cmd.replace(/\n/g, '⏎ ')}`);
    });
  }

  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const historyData = fs.readFileSync(this.historyFile, 'utf-8');
        const lines = historyData.split('\n').filter(line => line.trim());

        // Load into this.history for tracking
        this.history = lines;

        // Also load into readline's history for arrow key navigation
        // Note: readline manages its own history, but we keep ours for .history command
        this.rl.history = [...lines].reverse(); // readline wants reverse order
      }
    } catch (error) {
      // Silently ignore errors (first run, permission issues, etc.)
    }
  }

  saveHistory() {
    try {
      // Save last 1000 commands (prevent unlimited growth)
      const toSave = this.history.slice(-1000);
      fs.writeFileSync(this.historyFile, toSave.join('\n') + '\n', 'utf-8');
    } catch (error) {
      // Silently ignore errors (permission issues, etc.)
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
