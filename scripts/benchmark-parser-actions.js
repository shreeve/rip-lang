#!/usr/bin/env bun

/**
 * Benchmark script measuring PARSING ACTIONS (shifts/reduces)
 * This counts individual table lookups and grammar rule applications,
 * which is the standard parser benchmark metric.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { Lexer } from '../src/lexer.js';
import { parser } from '../src/parser.js';

const WARMUP_RUNS = 100;
const BENCHMARK_DURATION_MS = 5000;

function formatNumber(num) {
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatTime(ms) {
  if (ms < 0.001) return `${(ms * 1000000).toFixed(2)}ns`;
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function runBenchmark() {
  console.log('Parser Action Benchmark (Shifts + Reduces)');
  console.log('===========================================\n');

  // Read solar.rip source
  const solarPath = join(import.meta.dir, '../src/grammar/solar.rip');
  const source = readFileSync(solarPath, 'utf8');
  const sourceLines = source.split('\n').length;
  const sourceBytes = Buffer.byteLength(source, 'utf8');

  console.log(`Source file: solar.rip`);
  console.log(`Lines: ${formatNumber(sourceLines)}`);
  console.log(`Size: ${formatNumber(sourceBytes)} bytes (${formatNumber(sourceBytes / 1024)} KB)\n`);

  // Pre-lex the source
  console.log('Pre-lexing source...');
  const lexer = new Lexer();
  const tokens = lexer.tokenize(source);
  console.log(`Tokens: ${formatNumber(tokens.length)}\n`);

  // Create lexer object
  function createLexerObject(tokens) {
    return {
      tokens: tokens,
      pos: 0,
      setInput: function(input, yy) {
        this.pos = 0;
      },
      lex: function() {
        if (this.pos >= this.tokens.length) return 1; // EOF
        const token = this.tokens[this.pos++];
        this.yytext = token[1];
        this.yylloc = token[2];
        return token[0];
      }
    };
  }

  // Instrument parser to count actions
  let shiftCount = 0;
  let reduceCount = 0;

  const originalPerformAction = parser.performAction;
  parser.performAction = function(...args) {
    reduceCount++;
    return originalPerformAction.apply(this, args);
  };

  // Count one file parse to get actions per parse
  console.log('Counting parsing actions for one file parse...');
  shiftCount = 0;
  reduceCount = 0;

  // Monkey-patch the parser's parse method to count shifts
  const originalParse = parser.parse;
  parser.parse = function(input) {
    const self = this;
    const originalLex = this.lexer.lex;

    // Wrap lex to count shifts (each token consumed is a shift)
    this.lexer.lex = function() {
      const token = originalLex.call(this);
      if (token !== 1) { // Not EOF
        shiftCount++;
      }
      return token;
    };

    try {
      return originalParse.call(this, input);
    } finally {
      this.lexer.lex = originalLex;
    }
  };

  parser.lexer = createLexerObject(tokens);
  parser.parse(source);

  const actionsPerParse = shiftCount + reduceCount;
  console.log(`Shifts per parse: ${formatNumber(shiftCount)}`);
  console.log(`Reduces per parse: ${formatNumber(reduceCount)}`);
  console.log(`Total actions per parse: ${formatNumber(actionsPerParse)}\n`);

  // Warmup
  console.log(`Warming up (${WARMUP_RUNS} runs)...`);
  for (let i = 0; i < WARMUP_RUNS; i++) {
    parser.lexer = createLexerObject(tokens);
    parser.parse(source);
  }
  console.log('Warmup complete.\n');

  // Extended benchmark
  console.log(`Running benchmark (${BENCHMARK_DURATION_MS / 1000}s duration)...`);
  let fileParseCount = 0;
  const start = performance.now();
  let end = start;

  while (end - start < BENCHMARK_DURATION_MS) {
    parser.lexer = createLexerObject(tokens);
    parser.parse(source);
    fileParseCount++;
    end = performance.now();
  }

  const totalTime = end - start;
  const totalActions = fileParseCount * actionsPerParse;

  // Calculate metrics
  const filesParsedPerSec = fileParseCount / (totalTime / 1000);
  const actionsPerSec = totalActions / (totalTime / 1000);
  const avgTimePerFile = totalTime / fileParseCount;
  const avgTimePerAction = totalTime / totalActions;

  console.log('\nBenchmark Results:');
  console.log('==================\n');

  console.log('File-Level Metrics:');
  console.log(`  Files parsed: ${formatNumber(fileParseCount)}`);
  console.log(`  Files/sec: ${formatNumber(filesParsedPerSec)}`);
  console.log(`  Time per file: ${formatTime(avgTimePerFile)}\n`);

  console.log('Action-Level Metrics:');
  console.log(`  Total actions: ${formatNumber(totalActions)}`);
  console.log(`  Actions/sec: ${formatNumber(actionsPerSec)}`);
  console.log(`  Time per action: ${formatTime(avgTimePerAction * 1000)} (${(avgTimePerAction * 1000000).toFixed(2)}ns)\n`);

  console.log('Breakdown:');
  console.log(`  Shifts per file: ${formatNumber(shiftCount)}`);
  console.log(`  Reduces per file: ${formatNumber(reduceCount)}\n`);

  console.log('Ratio:');
  console.log(`  Actions per file: ${formatNumber(actionsPerParse)}`);
  console.log(`  Actions per token: ${(actionsPerParse / tokens.length).toFixed(2)}`);

  console.log('\n✓ Benchmark complete!');
}

// Run benchmark
try {
  runBenchmark();
} catch (error) {
  console.error('Benchmark failed:', error);
  process.exit(1);
}
