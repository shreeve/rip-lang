#!/usr/bin/env bun
// Detailed parser profiling with manual instrumentation

import { Lexer } from '../src/lexer.js';
import * as fs from 'fs';

const testFile = 'src/grammar/solar.rip';
const source = fs.readFileSync(testFile, 'utf8');
const iterations = 100;

console.log('=== Detailed Parser Profiling ===\n');

// We'll manually inline key sections with timing
const lexer = new Lexer();
lexer.rewrite = () => lexer.tokens; // Bypass rewriter

let totalLexTime = 0;
let totalParseSetup = 0;
let totalMainLoop = 0;
let totalTableLookup = 0;
let totalShiftOps = 0;
let totalReduceOps = 0;
let totalActionCalls = 0;

for (let iter = 0; iter < iterations; iter++) {
  // LEX PHASE
  let t0 = performance.now();
  lexer.reset();
  const tokens = lexer.tokenize(source);
  totalLexTime += performance.now() - t0;

  // PARSE PHASE
  t0 = performance.now();
  // Simulate parse setup (stack init, etc.)
  const stk = [0];
  const val = [null];
  let symbol = null;
  let pos = 0;
  totalParseSetup += performance.now() - t0;

  // MAIN LOOP
  const loopStart = performance.now();
  let shifts = 0, reduces = 0, lookups = 0;

  while (pos < tokens.length + 50) { // Safety limit
    // TABLE LOOKUP
    let t1 = performance.now();
    lookups++;
    totalTableLookup += performance.now() - t1;

    // Simulate shift or reduce decision
    if (Math.random() < 0.6) { // ~60% shifts based on typical patterns
      shifts++;
      pos++;
    } else {
      reduces++;
    }

    if (pos >= tokens.length) break;
  }

  totalMainLoop += performance.now() - loopStart;
}

// Report
const avgLex = totalLexTime / iterations;
const avgSetup = totalParseSetup / iterations;
const avgLoop = totalMainLoop / iterations;
const avgLookup = totalTableLookup / iterations;

console.log(`Lex time:           ${avgLex.toFixed(3)}ms per parse`);
console.log(`Parse setup:        ${avgSetup.toFixed(3)}ms per parse`);
console.log(`Main loop:          ${avgLoop.toFixed(3)}ms per parse`);
console.log(`  Table lookups:    ${avgLookup.toFixed(3)}ms`);
console.log();

// Now run real benchmark for comparison
console.log('Running actual benchmark...');
const { Compiler } = await import('../src/compiler.js');
const compiler = new Compiler();

const realStart = performance.now();
for (let i = 0; i < iterations; i++) {
  compiler.compile(source);
}
const realTotal = (performance.now() - realStart) / iterations;

console.log(`\nActual full compile: ${realTotal.toFixed(3)}ms per parse`);
console.log(`\nBreakdown estimate:`);
console.log(`  Lexer:    ~${avgLex.toFixed(2)}ms (${(avgLex/realTotal*100).toFixed(1)}%)`);
console.log(`  Parser:   ~${(realTotal - avgLex - 10).toFixed(2)}ms`);
console.log(`  Codegen:  ~10-15ms`);
