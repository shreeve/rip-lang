#!/usr/bin/env bun

/**
 * Rip Test Runner
 *
 * Runs .rip test files with three test types:
 * - test(name, code, expected) - Execute and compare result
 * - code(name, code, expected) - Compile and compare generated code
 * - fail(name, code) - Expect compilation/execution to fail
 *
 * Usage:
 *   bun test/runner.js test/rip                 # Run directory
 *   bun test/runner.js test/rip/operators.rip   # Run file
 *   bun test/runner.js test/rip test/cs2        # Multiple paths
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';
import { compile } from '../src/compiler.js';
// Side-effect imports — register the CLI-side type emitter and full
// schema runtime so the test runner exercises the same code paths as
// `bin/rip`. The browser bundle reaches NEITHER of these modules.
import '../src/dts.js';
import '../src/schema/loader-server.js';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Test tracking
let currentFile = '';
let fileTests = { pass: 0, fail: 0 };
let totalTests = { pass: 0, fail: 0 };
let failures = [];
let pendingTests = [];

// Normalize code for comparison (remove extra whitespace, normalize semicolons)
function normalizeCode(code) {
  return code
    .trim()
    .replace(/\/\/ rip:stdlib:begin[\s\S]*?\/\/ rip:stdlib:end\n?/g, '') // Strip multi-line stdlib block
    .replace(/^\/\/.*\n/gm, '')             // Remove comment lines
    .replace(/^globalThis\.\w+.*\n?/gm, '') // Remove single-line stdlib preamble (legacy / partial bundles)
    .replace(/^\s*let\s[^;]*;\n?/gm, '')     // Remove program-level let declarations
    .replace(/^\s*var\s[^;]*;\n?/gm, '')    // Remove program-level var declarations
    .replace(/;\s*$/gm, '')                 // Remove trailing semicolons from lines
    .replace(/\s+/g, ' ')                   // Collapse whitespace
    .replace(/\s*([{}();,=])\s*/g, '$1')    // Remove spaces around punctuation
    .replace(/;}/g, '}')                    // Remove semicolon before closing brace
    .trim();
}


// Test helper: Execute code and compare result
// Note: This is async to support await - but await on non-promises is instant,
// so synchronous tests have zero performance impact
let _testChain = Promise.resolve();
function test(name, code, expected) {
  // Serialize async tests via a promise chain. Concurrent execution
  // across tests that mutate shared module-level runtime state (registry,
  // adapters, globals) produces nondeterministic failures.
  _testChain = _testChain.then(() => _runTest(name, code, expected));
  pendingTests.push(_testChain);
}

async function _runTest(name, code, expected) {
  try {
    const result = compile(code);

    // True when the compiled code has an `await` at module scope (outside
    // any function body). The walker tracks brace depth, ignoring tokens
    // that would otherwise look like braces/awaits but live inside:
    //
    //   * line comments  // ...
    //   * block comments / * ... * /
    //   * single/double-quoted strings (with backslash escapes)
    //   * template literals — including `${...}` re-entry into code mode
    //   * regex literals — disambiguated from division by previous-token
    //     context (operators, punctuation, and a handful of keywords mean
    //     a `/` opens a regex; identifiers/numbers/`)`/`]` mean division)
    //
    // A `{` opens a function body when it follows `=>` or a `)` whose
    // matching `(` is NOT preceded by a control keyword. We push onto a
    // function-scope stack and pop when the matching `}` closes. An
    // `await ` keyword encountered with an empty stack is top-level and
    // forces AsyncFunction wrapping.
    //
    // Failure mode if this misclassifies: top-level `await` runs in a
    // synchronous `eval()`, throws SyntaxError, the test reports the
    // exception text instead of the expected value. The classic regression
    // was a regex literal containing `{` (e.g. `/#\{/g`) that faked out
    // brace tracking and silently broke ~370 schema tests.
    const CONTROL_KEYWORDS = new Set(['if','for','while','catch','switch','with']);
    const REGEX_PUNCT = new Set('([{,;:?=!&|+-*%/<>~^'.split(''));
    const REGEX_KEYWORDS = new Set([
      'return','typeof','delete','void','throw','new','in','of','instanceof','await','yield'
    ]);
    const needsAsyncWrapper = (() => {
      if (result.code.includes('for await')) return true;
      if (!/\bawait\b/.test(result.code)) return false;
      const code = result.code;
      const stack = [];        // brace depths that opened function bodies
      const tplStack = [];     // brace depths captured at each ${...} entry
      let braceDepth = 0;
      // True if a `/` at this position opens a regex literal rather than
      // a division operator. Looks at the previous non-whitespace char;
      // identifier-like context means division, anything else means regex.
      const isRegexHere = (pos) => {
        let p = pos - 1;
        while (p >= 0 && /\s/.test(code[p])) p--;
        if (p < 0) return true;
        const ch = code[p];
        if (REGEX_PUNCT.has(ch)) return true;
        if (!/[\w$]/.test(ch)) return false;
        let end = p + 1;
        while (p >= 0 && /[\w$]/.test(code[p])) p--;
        return REGEX_KEYWORDS.has(code.slice(p + 1, end));
      };
      let i = 0;
      while (i < code.length) {
        const c = code[i];
        // Line comment
        if (c === '/' && code[i + 1] === '/') {
          while (i < code.length && code[i] !== '\n') i++;
          continue;
        }
        // Block comment
        if (c === '/' && code[i + 1] === '*') {
          i += 2;
          while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
          i += 2;
          continue;
        }
        // Regex literal
        if (c === '/' && isRegexHere(i)) {
          i++;
          while (i < code.length && code[i] !== '/') {
            if (code[i] === '\\') { i += 2; continue; }
            if (code[i] === '[') {
              i++;
              while (i < code.length && code[i] !== ']') {
                if (code[i] === '\\') { i += 2; continue; }
                i++;
              }
            }
            i++;
          }
          i++;
          while (i < code.length && /[gimsuy]/.test(code[i])) i++;
          continue;
        }
        // Plain string literal
        if (c === '"' || c === "'") {
          const quote = c;
          i++;
          while (i < code.length && code[i] !== quote) {
            if (code[i] === '\\') { i += 2; continue; }
            i++;
          }
          i++;
          continue;
        }
        // Template literal — `${...}` re-enters code mode at the current
        // brace depth, which is what tplStack tracks.
        if (c === '`') {
          i++;
          while (i < code.length && code[i] !== '`') {
            if (code[i] === '\\') { i += 2; continue; }
            if (code[i] === '$' && code[i + 1] === '{') {
              tplStack.push(braceDepth);
              braceDepth++;
              i += 2;
              break;
            }
            i++;
          }
          if (i < code.length && code[i] === '`') i++;
          continue;
        }
        // Opening brace
        if (c === '{') {
          braceDepth++;
          let k = i - 1;
          while (k >= 0 && /\s/.test(code[k])) k--;
          let isFunc = false;
          if (k >= 1 && code[k] === '>' && code[k - 1] === '=') {
            isFunc = true;
          } else if (code[k] === ')') {
            let d = 1, j = k - 1;
            while (j >= 0 && d > 0) {
              if (code[j] === ')') d++;
              else if (code[j] === '(') d--;
              if (d === 0) break;
              j--;
            }
            let m = j - 1;
            while (m >= 0 && /\s/.test(code[m])) m--;
            let end = m + 1;
            while (m >= 0 && /[\w$]/.test(code[m])) m--;
            const prevWord = code.slice(m + 1, end);
            isFunc = !CONTROL_KEYWORDS.has(prevWord);
          }
          if (isFunc) stack.push(braceDepth);
          i++;
          continue;
        }
        // Closing brace — could be closing a function body, an arbitrary
        // block, or the `}` that ends a `${...}` and re-enters template-
        // literal mode.
        if (c === '}') {
          if (tplStack.length && tplStack[tplStack.length - 1] === braceDepth - 1) {
            tplStack.pop();
            braceDepth--;
            i++;
            // Re-enter template scan until the next `${` or backtick.
            while (i < code.length && code[i] !== '`') {
              if (code[i] === '\\') { i += 2; continue; }
              if (code[i] === '$' && code[i + 1] === '{') {
                tplStack.push(braceDepth);
                braceDepth++;
                i += 2;
                break;
              }
              i++;
            }
            if (i < code.length && code[i] === '`') i++;
            continue;
          }
          if (stack.length && stack[stack.length - 1] === braceDepth) stack.pop();
          braceDepth--;
          i++;
          continue;
        }
        // Top-level await detection
        if (stack.length === 0 && c === 'a' && code.slice(i, i + 6) === 'await ' &&
            (i === 0 || !/[\w$]/.test(code[i - 1]))) {
          return true;
        }
        i++;
      }
      return false;
    })();

    let actual;
    if (needsAsyncWrapper) {
      // AsyncFunction doesn't auto-return the last expression the way
      // eval() does. Inject a `return` on the last expression-statement
      // so the test helper receives the value.
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const lines = result.code.split('\n');
      let lastIdx = lines.length - 1;
      while (lastIdx >= 0 && lines[lastIdx].trim() === '') lastIdx--;
      if (lastIdx >= 0) {
        const stripped = lines[lastIdx].trim().replace(/;$/, '');
        if (!/^(if|for|while|do|class|function|async function|const|let|var|return|throw|try|switch|import|export|await\s*$)\b/.test(stripped) &&
            !stripped.startsWith('{') && !stripped.endsWith('{') && !stripped.endsWith('}')) {
          lines[lastIdx] = lines[lastIdx].replace(stripped, 'return ' + stripped);
        }
      }
      const fn = new AsyncFunction(lines.join('\n'));
      actual = await fn();
    } else {
      // Regular eval (preserves function types like AsyncFunction)
      actual = eval(result.code);
      // If result is a Promise, await it
      actual = await actual;
    }

    if (JSON.stringify(actual) === JSON.stringify(expected)) {
      fileTests.pass++;
      totalTests.pass++;
      console.log(`  ${colors.green}✓${colors.reset} ${name}`);
    } else {
      fileTests.fail++;
      totalTests.fail++;
      console.log(`  ${colors.red}✗${colors.reset} ${name}`);
      failures.push({
        file: currentFile,
        test: name,
        type: 'test',
        expected: JSON.stringify(expected),
        actual: JSON.stringify(actual),
        code
      });
    }
  } catch (error) {
    fileTests.fail++;
    totalTests.fail++;
    console.log(`  ${colors.red}✗${colors.reset} ${name}`);
    if (process.env.DEBUG_RUNNER) {
      console.log('--- DBG stack ---');
      console.log(error.stack);
    }
    failures.push({
      file: currentFile,
      test: name,
      type: 'test',
      error: error.message,
      code
    });
  }
}

// Test helper: Compile and compare generated code
function code(name, have, want, options = {}) {
  try {
    const result = compile(have, options);
    const actualNorm = normalizeCode(result.code);
    const expectedNorm = normalizeCode(want);

    if (actualNorm === expectedNorm) {
      fileTests.pass++;
      totalTests.pass++;
      console.log(`  ${colors.green}✓${colors.reset} ${name}`);
    } else {
      fileTests.fail++;
      totalTests.fail++;
      console.log(`  ${colors.red}✗${colors.reset} ${name}`);
      failures.push({
        file: currentFile,
        test: name,
        type: 'code',
        expected: want,
        actual: result.code,
        normalized: {
          expected: expectedNorm,
          actual: actualNorm
        }
      });
    }
  } catch (error) {
    fileTests.fail++;
    totalTests.fail++;
    console.log(`  ${colors.red}✗${colors.reset} ${name} - ${error.message.split('\n')[0]}`);
    failures.push({
      file: currentFile,
      test: name,
      type: 'code',
      error: error.message,
      have
    });
  }
}

// Test helper: Compile with types and compare .d.ts output
function type(name, have, want) {
  try {
    const result = compile(have, { types: 'emit' });
    const actualDts = (result.dts || '').trim();
    const expectedTrimmed = want.trim();

    if (actualDts === expectedTrimmed) {
      fileTests.pass++;
      totalTests.pass++;
      console.log(`  ${colors.green}✓${colors.reset} ${name}`);
    } else {
      fileTests.fail++;
      totalTests.fail++;
      console.log(`  ${colors.red}✗${colors.reset} ${name}`);
      failures.push({
        file: currentFile,
        test: name,
        type: 'type',
        expected: expectedTrimmed,
        actual: actualDts,
      });
    }
  } catch (error) {
    fileTests.fail++;
    totalTests.fail++;
    console.log(`  ${colors.red}✗${colors.reset} ${name} - ${error.message.split('\n')[0]}`);
    failures.push({
      file: currentFile,
      test: name,
      type: 'type',
      error: error.message,
      have
    });
  }
}

// Test helper: Expect failure (compilation or execution)
function fail(name, have) {
  try {
    const result = compile(have);

    // Try to execute - should fail
    try {
      eval(result.code);

      // If we get here, test failed (should have thrown)
      fileTests.fail++;
      totalTests.fail++;
      console.log(`  ${colors.red}✗${colors.reset} ${name}`);
      failures.push({
        file: currentFile,
        test: name,
        type: 'fail',
        reason: 'Expected failure but succeeded',
        code: result.code
      });
    } catch (execError) {
      // Execution failed as expected
      fileTests.pass++;
      totalTests.pass++;
      console.log(`  ${colors.green}✓${colors.reset} ${name}`);
    }
  } catch (compileError) {
    // Compilation failed as expected
    fileTests.pass++;
    totalTests.pass++;
    console.log(`  ${colors.green}✓${colors.reset} ${name}`);
  }
}

// Run a single test file
async function runTestFile(filePath) {
  currentFile = relative(process.cwd(), filePath);
  fileTests = { pass: 0, fail: 0 };

  console.log(`\n${colors.cyan}${currentFile}${colors.reset}`);

  try {
    const source = readFileSync(filePath, 'utf-8');
    const result = compile(source);

    // Create test environment with test helpers
    const testEnv = {
      test,
      code,
      fail,
      type,
      console,
      Promise,
    };

    // Execute test file as async function
    pendingTests = [];
    const testFn = new (async function(){}).constructor(...Object.keys(testEnv), result.code);
    await testFn(...Object.values(testEnv));
    await Promise.all(pendingTests);

  } catch (error) {
    console.log(`  ${colors.red}✗ File failed to compile/execute${colors.reset}`);
    console.log(`    ${error.message}`);
    fileTests.fail++;
    totalTests.fail++;
    failures.push({
      file: currentFile,
      test: 'File execution',
      type: 'file',
      error: error.message
    });
  }

  return fileTests;
}

// Recursively find all test files
function findTestFiles(path) {
  try {
    const stats = statSync(path);

    if (stats.isFile()) {
      return ['.rip'].includes(extname(path)) ? [path] : [];
    }

    if (stats.isDirectory()) {
      if (path.includes('/fixtures')) return [];
      const entries = readdirSync(path).sort();
      return entries.flatMap(entry => findTestFiles(join(path, entry)));
    }
  } catch (error) {
    console.error(`${colors.red}Error reading path: ${path}${colors.reset}`);
    console.error(`  ${error.message}`);
  }

  return [];
}

// Print failure summary
function printFailures() {
  if (failures.length === 0) return;

  console.log(`\n${colors.bright}${colors.red}Failure Details:${colors.reset}\n`);

  failures.slice(0, 20).forEach((failure, index) => {
    console.log(`${colors.bright}${index + 1}. ${failure.file} - ${failure.test}${colors.reset}`);
    if (failure.error) {
      console.log(`   Error: ${failure.error.split('\n')[0]}`);
    }

    if (failure.type === 'test') {
      console.log(`   Expected: ${failure.expected}`);
      console.log(`   Actual:   ${failure.actual}`);
    }

    if (failure.type === 'code') {
      console.log(`   Expected code:`);
      console.log(`   ${failure.expected}`);
      console.log(`   Actual code:`);
      console.log(`   ${failure.actual}`);
    }

    if (failure.type === 'type') {
      console.log(`   Expected .d.ts:`);
      console.log(`   ${failure.expected}`);
      console.log(`   Actual .d.ts:`);
      console.log(`   ${failure.actual}`);
    }

    if (failure.type === 'fail') {
      console.log(`   ${failure.reason}`);
    }

    console.log('');
  });

  if (failures.length > 20) {
    console.log(`   ... and ${failures.length - 20} more failures\n`);
  }
}

// Main entry point
async function main(args) {
  // Default to test/rip if no arguments provided
  if (args.length === 0) {
    args = ['test/rip'];
    console.log(`${colors.cyan}Running default: test/rip${colors.reset}\n`);
  }

  // Collect all test files from arguments
  const testFiles = args.flatMap(arg => findTestFiles(arg));

  if (testFiles.length === 0) {
    console.log(`${colors.yellow}No test files found${colors.reset}`);
    process.exit(0);
  }

  console.log(`${colors.bright}Running ${testFiles.length} test file(s)...${colors.reset}`);

  // Run each test file (await for async support)
  for (const file of testFiles) {
    await runTestFile(file);
  }

  // Summary
  console.log(`\n${colors.bright}${'─'.repeat(60)}${colors.reset}`);

  if (totalTests.fail > 0) {
    console.log(`${colors.red}${colors.bright}Test failures detected${colors.reset}`);
    printFailures();
  } else {
    console.log(`${colors.green}${colors.bright}🎉 ALL TESTS PASSED!${colors.reset}`);
  }

  console.log(`${colors.green}✓ ${totalTests.pass} passing${colors.reset}`);
  if (totalTests.fail > 0) {
    console.log(`${colors.red}✗ ${totalTests.fail} failing${colors.reset}`);
  }

  // Calculate and display percentage
  const total = totalTests.pass + totalTests.fail;
  if (total > 0) {
    const percentage = ((totalTests.pass / total) * 100).toFixed(1);
    console.log(`${colors.bright}★ ${percentage}% passing${colors.reset}`);
  }

  process.exit(totalTests.fail > 0 ? 1 : 0);
}

// Run if called directly
if (import.meta.main) {
  await main(process.argv.slice(2));
}

export { test, code, fail };
