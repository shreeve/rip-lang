#!/usr/bin/env bun
// Deep parser profiling - measure reduction patterns

import { Lexer } from '../src/lexer.js';
import { Compiler } from '../src/compiler.js';
import parser from '../src/parser.js';
import * as fs from 'fs';

const testFile = 'src/grammar/solar.rip';
const source = fs.readFileSync(testFile, 'utf8');
const iterations = 1000;

console.log('=== Parser Profiling ===');
console.log(`File: ${testFile} (${source.split('\n').length} lines)`);
console.log(`Iterations: ${iterations}\n`);

// Instrument the ruleActions to count calls per rule
const ruleCallCounts = {};
const ruleTimings = {};
const originalActions = parser.ruleActions;

parser.ruleActions = function(rule, vals, locs, shared) {
  ruleCallCounts[rule] = (ruleCallCounts[rule] || 0) + 1;

  const start = performance.now();
  const result = originalActions.call(this, rule, vals, locs, shared);
  ruleTimings[rule] = (ruleTimings[rule] || 0) + (performance.now() - start);

  return result;
};

// Run iterations
const compiler = new Compiler();
for (let i = 0; i < iterations; i++) {
  try {
    compiler.compile(source);
  } catch (e) {
    console.error('Compile error:', e.message);
    break;
  }
}

// Analyze results
const totalCalls = Object.values(ruleCallCounts).reduce((a, b) => a + b, 0);
const totalTime = Object.values(ruleTimings).reduce((a, b) => a + b, 0);

console.log(`Total reductions: ${totalCalls.toLocaleString()} (${(totalCalls/iterations).toFixed(0)} per parse)`);
console.log(`Total action time: ${totalTime.toFixed(2)}ms (${(totalTime/iterations).toFixed(3)}ms per parse)\n`);

// Find hottest rules
const sorted = Object.entries(ruleCallCounts)
  .map(([rule, count]) => ({
    rule: parseInt(rule),
    count,
    time: ruleTimings[rule] || 0,
    avgTime: (ruleTimings[rule] || 0) / count,
    percent: (count / totalCalls * 100)
  }))
  .sort((a, b) => b.count - a.count);

console.log('Top 20 most-called rules:');
console.log('  Rule  | Calls  | % Total | Avg Time | Is Alias?');
console.log('  ------|--------|---------|----------|----------');

const aliasSet = parser.aliasRules || new Set();
for (let i = 0; i < Math.min(20, sorted.length); i++) {
  const {rule, count, percent, avgTime} = sorted[i];
  const isAlias = aliasSet.has(rule) ? 'YES' : 'no';
  console.log(`  ${rule.toString().padStart(4)} | ${count.toString().padStart(6)} | ${percent.toFixed(2).padStart(6)}% | ${(avgTime * 1000).toFixed(2)}µs | ${isAlias}`);
}

// Count alias vs non-alias
const aliasCalls = sorted.filter(r => aliasSet.has(r.rule)).reduce((sum, r) => sum + r.count, 0);
const nonAliasCalls = totalCalls - aliasCalls;

console.log();
console.log('Alias rules:');
console.log(`  Count: ${aliasSet.size} rules`);
console.log(`  Calls: ${aliasCalls} (${(aliasCalls/totalCalls*100).toFixed(1)}% of reductions)`);
console.log();
console.log('Non-alias rules:');
console.log(`  Count: ${sorted.length - aliasSet.size} rules`);
console.log(`  Calls: ${nonAliasCalls} (${(nonAliasCalls/totalCalls*100).toFixed(1)}% of reductions)`);
