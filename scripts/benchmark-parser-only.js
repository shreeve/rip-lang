#!/usr/bin/env bun

/**
 * Benchmark script for PARSER ONLY (no lexer, no codegen)
 * Measures pure parsing speed for solar.rip
 *
 * This tests the parser table lookup and s-expression building,
 * which is what you're optimizing with Uint16Array tables.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { Lexer } from '../src/lexer.js';
import { parser } from '../src/parser.js';

const WARMUP_RUNS = 100;
const BENCHMARK_RUNS = 1000;
const BENCHMARK_DURATION_MS = 5000; // Run for 5 seconds

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
  console.log('Parser-Only Benchmark (No Lexer, No Codegen)');
  console.log('==============================================\n');

  // Read solar.rip source
  const solarPath = join(import.meta.dir, '../src/grammar/solar.rip');
  const source = readFileSync(solarPath, 'utf8');
  const sourceLines = source.split('\n').length;
  const sourceBytes = Buffer.byteLength(source, 'utf8');

  console.log(`Source file: solar.rip`);
  console.log(`Lines: ${formatNumber(sourceLines)}`);
  console.log(`Size: ${formatNumber(sourceBytes)} bytes (${formatNumber(sourceBytes / 1024)} KB)\n`);

  // Pre-lex the source ONCE (we're only benchmarking the parser)
  console.log('Pre-lexing source (one time only)...');
  const lexer = new Lexer();
  const tokens = lexer.tokenize(source);
  console.log(`Tokens: ${formatNumber(tokens.length)}\n`);

  // Create a custom lexer object that provides pre-lexed tokens
  function createLexerObject(tokens) {
    return {
      tokens: tokens,
      pos: 0,
      setInput: function(input, yy) {
        this.pos = 0; // Reset position
      },
      lex: function() {
        if (this.pos >= this.tokens.length) return 1; // EOF
        const token = this.tokens[this.pos++];
        this.yytext = token[1];
        this.yylloc = token[2];
        return token[0]; // Return tag
      }
    };
  }

  // Warmup phase
  console.log(`Warming up (${WARMUP_RUNS} runs)...`);
  for (let i = 0; i < WARMUP_RUNS; i++) {
    try {
      parser.lexer = createLexerObject(tokens);
      parser.parse(source); // Source string is ignored, lexer provides tokens
    } catch (e) {
      console.error('Error during warmup:', e.message);
      process.exit(1);
    }
  }
  console.log('Warmup complete.\n');

  // Quick benchmark (fixed iterations)
  console.log(`Quick benchmark (${BENCHMARK_RUNS} iterations)...`);
  const times = [];
  const quickStart = performance.now();

  for (let i = 0; i < BENCHMARK_RUNS; i++) {
    const start = performance.now();
    parser.lexer = createLexerObject(tokens);
    parser.parse(source);
    const end = performance.now();
    times.push(end - start);
  }

  const quickEnd = performance.now();
  const quickTotal = quickEnd - quickStart;

  // Calculate statistics
  times.sort((a, b) => a - b);
  const min = times[0];
  const max = times[times.length - 1];
  const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
  const median = times[Math.floor(times.length / 2)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];

  console.log('\nQuick Benchmark Results:');
  console.log('------------------------');
  console.log(`Total time: ${formatTime(quickTotal)}`);
  console.log(`Iterations: ${formatNumber(BENCHMARK_RUNS)}`);
  console.log(`Parses/sec: ${formatNumber(BENCHMARK_RUNS / (quickTotal / 1000))}`);
  console.log(`\nPer-parse statistics:`);
  console.log(`  Min:    ${formatTime(min)}`);
  console.log(`  Median: ${formatTime(median)}`);
  console.log(`  Average: ${formatTime(avg)}`);
  console.log(`  P95:    ${formatTime(p95)}`);
  console.log(`  P99:    ${formatTime(p99)}`);
  console.log(`  Max:    ${formatTime(max)}`);

  // Extended benchmark (time-based)
  console.log(`\nExtended benchmark (${BENCHMARK_DURATION_MS / 1000}s duration)...`);
  let extendedCount = 0;
  const extendedStart = performance.now();
  let extendedEnd = extendedStart;

  while (extendedEnd - extendedStart < BENCHMARK_DURATION_MS) {
    parser.lexer = createLexerObject(tokens);
    parser.parse(source);
    extendedCount++;
    extendedEnd = performance.now();
  }

  const extendedTotal = extendedEnd - extendedStart;
  const extendedParsesPerSec = extendedCount / (extendedTotal / 1000);
  const extendedAvg = extendedTotal / extendedCount;

  console.log('\nExtended Benchmark Results:');
  console.log('---------------------------');
  console.log(`Total time: ${formatTime(extendedTotal)}`);
  console.log(`Iterations: ${formatNumber(extendedCount)}`);
  console.log(`Parses/sec: ${formatNumber(extendedParsesPerSec)}`);
  console.log(`Average: ${formatTime(extendedAvg)}`);

  // Throughput calculations
  const bytesPerSec = extendedParsesPerSec * sourceBytes;
  const linesPerSec = extendedParsesPerSec * sourceLines;
  const tokensPerSec = extendedParsesPerSec * tokens.length;

  console.log(`\nThroughput:`);
  console.log(`  ${formatNumber(bytesPerSec)} bytes/sec (${formatNumber(bytesPerSec / 1024 / 1024)} MB/sec)`);
  console.log(`  ${formatNumber(linesPerSec)} lines/sec`);
  console.log(`  ${formatNumber(tokensPerSec)} tokens/sec`);

  // Memory usage
  const memUsage = process.memoryUsage();
  console.log(`\nMemory Usage:`);
  console.log(`  RSS: ${formatNumber(memUsage.rss / 1024 / 1024)} MB`);
  console.log(`  Heap Used: ${formatNumber(memUsage.heapUsed / 1024 / 1024)} MB`);
  console.log(`  Heap Total: ${formatNumber(memUsage.heapTotal / 1024 / 1024)} MB`);

  // Comparison note
  console.log(`\n${'='.repeat(60)}`);
  console.log('NOTE: This measures PARSER ONLY (no lexer, no codegen)');
  console.log('For full compilation benchmark, use: bun run benchmark');
  console.log(`${'='.repeat(60)}`);

  console.log('\n✓ Benchmark complete!');
}

// Run benchmark
try {
  runBenchmark();
} catch (error) {
  console.error('Benchmark failed:', error);
  process.exit(1);
}
