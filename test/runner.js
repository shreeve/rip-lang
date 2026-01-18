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

// Normalize code for comparison (remove extra whitespace, normalize semicolons)
function normalizeCode(code) {
  return code
    .trim()
    .replace(/^\/\/.*\n/gm, '')           // Remove comment lines
    .replace(/;\s*$/gm, '')               // Remove trailing semicolons from lines
    .replace(/\s+/g, ' ')                 // Collapse whitespace
    .replace(/\s*([{}();,=])\s*/g, '$1')  // Remove spaces around punctuation
    .replace(/;}/g, '}')                  // Remove semicolon before closing brace
    .trim();
}

// Strip reactive runtime from code (for code comparison tests)
function stripRuntime(code) {
  return code
    // New format with detailed comments
    .replace(/\/\/ =+\n\/\/ Rip Reactive Runtime[\s\S]*?\/\/ === End Reactive Runtime ===/g, '')
    // Old format
    .replace(/\/\/ === Rip Reactive Runtime ===[\s\S]*?\/\/ === End Reactive Runtime ===/g, '')
    .replace(/let __currentEffect[\s\S]*?function __readonly\([^)]*\)\s*\{[^}]*\}/g, '')
    .trim();
}

// Test helper: Execute code and compare result
// Note: This is async to support await - but await on non-promises is instant,
// so synchronous tests have zero performance impact
async function test(name, code, expected) {
  try {
    const result = compile(code);

    // Check if code contains for-await or top-level await (needs async wrapper)
    const needsAsyncWrapper = result.code.includes('for await') ||
                              (result.code.includes('await ') && !result.code.includes('async function'));

    let actual;
    if (needsAsyncWrapper) {
      // Wrap in async function for for-await support
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction(result.code);
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
function code(name, sourceCode, expectedCode) {
  try {
    const result = compile(sourceCode);
    const actualNorm = normalizeCode(result.code);
    const expectedNorm = normalizeCode(expectedCode);

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
        expected: expectedCode,
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
      sourceCode
    });
  }
}

// Test helper: Compile and compare generated code (strips reactive runtime)
// Use for tests where we only want to compare the class/function output
function codeBody(name, sourceCode, expectedCode) {
  try {
    const result = compile(sourceCode);
    const actualStripped = stripRuntime(result.code);
    const actualNorm = normalizeCode(actualStripped);
    const expectedNorm = normalizeCode(expectedCode);

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
        type: 'codeBody',
        expected: expectedCode,
        actual: actualStripped,
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
      type: 'codeBody',
      error: error.message,
      sourceCode
    });
  }
}

// Test helper: Expect failure (compilation or execution)
function fail(name, sourceCode) {
  try {
    const result = compile(sourceCode);

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
      codeBody,
      fail,
      console,
      // For async tests
      Promise,
      async: true,
    };

    // Execute test file as async function
    const testFn = new (async function(){}).constructor(...Object.keys(testEnv), result.code);
    await testFn(...Object.values(testEnv));

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

    if (failure.type === 'code' || failure.type === 'codeBody') {
      console.log(`   Expected code:`);
      console.log(`   ${failure.expected}`);
      console.log(`   Actual code:`);
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
