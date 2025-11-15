# Parser Performance Baseline

**Date:** November 14, 2025
**System:** macOS arm64, Bun v1.3.1
**Version:** Rip v1.5.4 (optimized-solar branch)
**Test file:** solar.rip (996 lines, 35.7 KB, 6,648 tokens)

---

## Quick Reference - Before Optimization

| Metric | Value | Command |
|--------|-------|---------|
| **Parsing actions/sec** | **3.73M actions/sec** | `bun run benchmark:actions` |
| **Parser-only files/sec** | **150.74 files/sec** | `bun run benchmark:parser` |
| **Full compilation files/sec** | **33.22 files/sec** | `bun run benchmark` |

---

## Detailed Metrics

### 1. Parsing Actions Benchmark 🎯
**Command:** `bun run benchmark:actions`

This measures individual shift/reduce operations - the standard parser performance metric.

```
Actions per file: 24,410 (6,648 shifts + 17,762 reduces)
Actions/sec: 3,729,177.93 (~3.73 million)
Time per action: 268.16 nanoseconds
Actions per token: 3.67
```

**What this means:**
- Each token triggers ~3.67 parsing operations on average
- The parser performs ~3.73 million table lookups per second
- Each lookup + grammar reduction takes ~268ns

**Expected after Uint16Array optimization:** 6-12× faster = **22-45 million actions/sec**

---

### 2. Parser-Only Benchmark
**Command:** `bun run benchmark:parser`

This measures complete file parsing (lexer pre-run, parser builds s-expressions).

```
Files parsed/sec: 150.74
Average per file: 6.63ms
Throughput: 5.14 MB/sec, 150,136 lines/sec, 1,002,118 tokens/sec
Memory: 17.33 MB heap used
```

**What this means:**
- Parses the entire 996-line file ~151 times per second
- Includes parser table lookups + s-expression array building
- Excludes lexer time (pre-tokenized)

**Expected after optimization:** Depends on how much time is table lookup vs s-expression building

---

### 3. Full Compilation Benchmark
**Command:** `bun run benchmark`

This measures the complete pipeline: lexer → parser → codegen.

```
Files compiled/sec: 33.22
Average per file: 30.10ms
Throughput: 1.13 MB/sec, 33,087 lines/sec
Memory: 17.33 MB heap used
```

**Breakdown by stage (estimated):**
- Lexer: ~22% (6.6ms)
- Parser: ~22% (6.6ms)
- Codegen: ~56% (16.9ms) - string concatenation is expensive!

**What this means:**
- Codegen dominates the pipeline (string manipulation)
- Parser optimization will improve this, but not dramatically
- Expect ~10-15% improvement in full compilation

---

## How to Compare After Optimization

### Step 1: Run all three benchmarks and save results

```bash
# Save baseline (do this now!)
bun run benchmark:actions > baseline-actions.txt
bun run benchmark:parser > baseline-parser.txt
bun run benchmark > baseline-full.txt
```

### Step 2: Make your optimization changes

### Step 3: Run benchmarks again

```bash
bun run benchmark:actions > optimized-actions.txt
bun run benchmark:parser > optimized-parser.txt
bun run benchmark > optimized-full.txt
```

### Step 4: Compare key metrics

**Primary metric (table optimization):**
```bash
# Baseline: ~3.73M actions/sec
# Target: 22-45M actions/sec (6-12× faster)
grep "Actions/sec:" baseline-actions.txt optimized-actions.txt
```

**Secondary metrics:**
```bash
# Parser-only improvement
grep "Files/sec:" baseline-parser.txt optimized-parser.txt

# Full compilation improvement
grep "Parses/sec:" baseline-full.txt optimized-full.txt
```

---

## Understanding the Numbers

### Why three different benchmarks?

1. **Actions/sec** - Measures what you're optimizing (table lookups)
2. **Parser files/sec** - Shows parser overhead beyond table lookups
3. **Full compilation** - Real-world user experience

### Expected improvements:

| Benchmark | Baseline | Expected | Improvement |
|-----------|----------|----------|-------------|
| Actions/sec | 3.73M | 22-45M | **6-12×** |
| Parser files/sec | 151 | ~300-500 | **2-3×** |
| Full compilation | 33 | ~40-45 | **1.2-1.4×** |

Why smaller improvement for full compilation?
- Codegen dominates (~56% of time)
- Parser is only ~22% of pipeline
- Even 10× parser speedup = 1.28× total speedup

### The math:
```
Baseline: 6.6ms parser + 23.5ms other = 30.1ms total

10× faster parser:
0.66ms parser + 23.5ms other = 24.16ms total
= 1.245× faster overall (24.5% improvement)
```

---

## System Variables

Performance can vary based on:
- CPU temperature (thermal throttling)
- Background processes
- Power mode (battery vs plugged in)
- JIT warmup state

**Best practice:**
- Run each benchmark 3-5 times
- Take the median value
- Compare under same conditions

---

## Quick Commands

```bash
# Run all benchmarks
bun run benchmark:actions
bun run benchmark:parser
bun run benchmark

# Run and log
./scripts/benchmark-log.sh

# Just the key numbers
bun run benchmark:actions | grep "Actions/sec:"
bun run benchmark:parser | grep "Files/sec:"
bun run benchmark | grep "Parses/sec:"
```

---

## Ready for Optimization!

Your baseline is established. After you optimize:

1. Run `bun run benchmark:actions`
2. Look for **Actions/sec** to go from ~3.73M to 22-45M
3. That's your proof the optimization worked! 🚀

Good luck! 🎯
