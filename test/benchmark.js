#!/usr/bin/env bun

/**
 * Benchmark: Table-Driven vs Direct Table-to-Code Parser
 *
 * Compares performance of both parser implementations
 */

import { readFileSync } from 'fs';
import { compile as compileTable } from '../src/compiler.js';
import { compile as compilePRD } from '../src/compiler-prd.js';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
};

// Test cases of varying complexity
const testCases = [
  {
    name: 'Simple assignment',
    code: 'x = 42',
    iterations: 10000,
  },
  {
    name: 'Function definition',
    code: 'def add(a, b)\n  a + b',
    iterations: 5000,
  },
  {
    name: 'If statement',
    code: 'if x > 0\n  y = x * 2\nelse\n  y = 0',
    iterations: 5000,
  },
  {
    name: 'For loop',
    code: 'for i in [1..10]\n  console.log i',
    iterations: 5000,
  },
  {
    name: 'Array comprehension',
    code: 'result = (x * 2 for x in [1, 2, 3, 4, 5])',
    iterations: 3000,
  },
  {
    name: 'Class definition',
    code: `class Point
  constructor: (@x, @y) ->
  distance: ->
    Math.sqrt(@x * @x + @y * @y)`,
    iterations: 2000,
  },
  {
    name: 'Complex expression',
    code: 'result = (a + b) * (c - d) / (e ** f) if x > y and z < w',
    iterations: 3000,
  },
  {
    name: 'Real file (fibonacci.rip)',
    code: readFileSync('docs/examples/fibonacci.rip', 'utf-8'),
    iterations: 1000,
  },
];

// Run benchmark for a single test case
function benchmark(testCase, compiler, name) {
  const { code, iterations } = testCase;

  // Warmup (let JIT optimize)
  for (let i = 0; i < Math.min(100, iterations); i++) {
    compiler(code);
  }

  // Actual benchmark
  const start = Bun.nanoseconds();
  for (let i = 0; i < iterations; i++) {
    compiler(code);
  }
  const end = Bun.nanoseconds();

  const totalMs = (end - start) / 1_000_000;
  const avgMs = totalMs / iterations;
  const tokensPerSec = (code.split(/\s+/).length * iterations) / (totalMs / 1000);

  return {
    totalMs,
    avgMs,
    tokensPerSec,
    iterations,
  };
}

// Main benchmark
console.log(`${colors.bright}${colors.cyan}🏁 Parser Performance Benchmark${colors.reset}\n`);
console.log(`Comparing table-driven vs direct table-to-code parsers\n`);
console.log(`${'='.repeat(80)}\n`);

const results = [];

for (const testCase of testCases) {
  console.log(`${colors.bright}${testCase.name}${colors.reset} (${testCase.iterations} iterations)`);

  // Benchmark table-driven
  const tableResult = benchmark(testCase, compileTable, 'Table-Driven');
  console.log(`  Table-Driven: ${tableResult.avgMs.toFixed(3)}ms/parse, ${(tableResult.tokensPerSec / 1000).toFixed(1)}K tok/s`);

  // Benchmark PRD
  const prdResult = benchmark(testCase, compilePRD, 'PRD');
  console.log(`  Direct Code:  ${prdResult.avgMs.toFixed(3)}ms/parse, ${(prdResult.tokensPerSec / 1000).toFixed(1)}K tok/s`);

  // Calculate speedup
  const speedup = tableResult.avgMs / prdResult.avgMs;
  const speedupColor = speedup >= 5 ? colors.green : speedup >= 3 ? colors.yellow : '';
  console.log(`  ${speedupColor}Speedup: ${speedup.toFixed(2)}x faster${colors.reset}\n`);

  results.push({
    name: testCase.name,
    table: tableResult,
    prd: prdResult,
    speedup,
  });
}

// Summary
console.log(`${'='.repeat(80)}\n`);
console.log(`${colors.bright}${colors.cyan}📊 Summary${colors.reset}\n`);

const avgSpeedup = results.reduce((sum, r) => sum + r.speedup, 0) / results.length;
const minSpeedup = Math.min(...results.map(r => r.speedup));
const maxSpeedup = Math.max(...results.map(r => r.speedup));

console.log(`Average Speedup: ${colors.green}${avgSpeedup.toFixed(2)}x${colors.reset}`);
console.log(`Range: ${minSpeedup.toFixed(2)}x - ${maxSpeedup.toFixed(2)}x`);
console.log(``);

// Best improvement
const best = results.reduce((a, b) => a.speedup > b.speedup ? a : b);
console.log(`Best: ${colors.green}${best.name}${colors.reset} (${best.speedup.toFixed(2)}x faster)`);

// Worst improvement
const worst = results.reduce((a, b) => a.speedup < b.speedup ? a : b);
console.log(`Worst: ${worst.name} (${worst.speedup.toFixed(2)}x faster)`);

console.log(``);
console.log(`${colors.bright}Result: Direct table-to-code is ${avgSpeedup.toFixed(1)}x faster on average!${colors.reset} 🚀`);
