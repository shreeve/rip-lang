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
    .replace(/^\/\/.*\n/gm, '')             // Remove comment lines
    .replace(/^globalThis\.\w+.*\n?/gm, '') // Remove stdlib preamble lines
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

    // True when the compiled code has an `await` at module scope
    // (outside any function body). A `{` opens a function body when it
    // follows `)` or `=>` and the `)` is NOT preceded by a control
    // keyword (if/for/while/catch/switch/with) at the same scope. We
    // push onto a function-scope stack and pop when the matching `}`
    // closes. `await` encountered with an empty stack is top-level and
    // forces AsyncFunction wrapping.
    const CONTROL_KEYWORDS = new Set(['if','for','while','catch','switch','with']);
    const needsAsyncWrapper = (() => {
      if (result.code.includes('for await')) return true;
      if (!/\bawait\b/.test(result.code)) return false;
      const code = result.code;
      let inStr = null;
      const stack = [];
      let braceDepth = 0;
      for (let i = 0; i < code.length; i++) {
        const c = code[i];
        if (inStr) {
          if (c === '\\') { i++; continue; }
          if (c === inStr) inStr = null;
          continue;
        }
        if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
        if (c === '/' && code[i + 1] === '/') {
          while (i < code.length && code[i] !== '\n') i++;
          continue;
        }
        if (c === '{') {
          braceDepth++;
          let k = i - 1;
          while (k >= 0 && /\s/.test(code[k])) k--;
          let isFunc = false;
          if (k >= 1 && code[k] === '>' && code[k - 1] === '=') {
            isFunc = true;
          } else if (code[k] === ')') {
            // Find the matching `(` and look at the keyword before it.
            let d = 1, j = k - 1;
            while (j >= 0 && d > 0) {
              if (code[j] === ')') d++;
              else if (code[j] === '(') d--;
              if (d === 0) break;
              j--;
            }
            // j is at the matching `(`.
            let m = j - 1;
            while (m >= 0 && /\s/.test(code[m])) m--;
            let end = m + 1;
            while (m >= 0 && /[\w$]/.test(code[m])) m--;
            const prevWord = code.slice(m + 1, end);
            isFunc = !CONTROL_KEYWORDS.has(prevWord);
          }
          if (isFunc) stack.push(braceDepth);
          continue;
        }
        if (c === '}') {
          if (stack.length && stack[stack.length - 1] === braceDepth) stack.pop();
          braceDepth--;
          continue;
        }
        if (stack.length === 0 && c === 'a' && code.slice(i, i + 6) === 'await ' &&
            (i === 0 || !/[\w$]/.test(code[i - 1]))) {
          return true;
        }
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
