#!/usr/bin/env bun

/**
 * Benchmark script for Solar parser performance
 * Measures parses per second for solar.rip (the parser generator itself)
 *
 * This is a realistic benchmark since solar.rip is a real Rip program,
 * not a grammar specification file.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { compile } from '../src/compiler.js';

const WARMUP_RUNS = 10;
const BENCHMARK_RUNS = 100;
const BENCHMARK_DURATION_MS = 5000; // Run for 5 seconds

function formatNumber(num) {
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatTime(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function runBenchmark() {
  console.log('Solar Parser Benchmark');
  console.log('======================\n');

  // Read solar.rip source (the parser generator itself - a real Rip program)
  const solarPath = join(import.meta.dir, '../src/grammar/solar.rip');
  const source = readFileSync(solarPath, 'utf8');
  const sourceLines = source.split('\n').length;
  const sourceBytes = Buffer.byteLength(source, 'utf8');

  console.log(`Source file: solar.rip`);
  console.log(`Lines: ${formatNumber(sourceLines)}`);
  console.log(`Size: ${formatNumber(sourceBytes)} bytes (${formatNumber(sourceBytes / 1024)} KB)\n`);

  // Warmup phase
  console.log(`Warming up (${WARMUP_RUNS} runs)...`);
  for (let i = 0; i < WARMUP_RUNS; i++) {
    try {
      compile(source, { filename: 'solar.rip' });
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
    compile(source, { filename: 'solar.rip' });
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
    compile(source, { filename: 'solar.rip' });
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

  console.log(`\nThroughput:`);
  console.log(`  ${formatNumber(bytesPerSec)} bytes/sec (${formatNumber(bytesPerSec / 1024 / 1024)} MB/sec)`);
  console.log(`  ${formatNumber(linesPerSec)} lines/sec`);

  // Memory usage
  const memUsage = process.memoryUsage();
  console.log(`\nMemory Usage:`);
  console.log(`  RSS: ${formatNumber(memUsage.rss / 1024 / 1024)} MB`);
  console.log(`  Heap Used: ${formatNumber(memUsage.heapUsed / 1024 / 1024)} MB`);
  console.log(`  Heap Total: ${formatNumber(memUsage.heapTotal / 1024 / 1024)} MB`);

  console.log('\n✓ Benchmark complete!');
}

// Run benchmark
try {
  runBenchmark();
} catch (error) {
  console.error('Benchmark failed:', error);
  process.exit(1);
}
