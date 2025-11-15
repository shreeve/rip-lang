# Solar Parser Benchmark

## Purpose

This benchmark measures the performance of Solar's SLR(1) parser when compiling the `solar.rip` file (the parser generator itself, ~996 lines). This is a realistic benchmark since solar.rip is a real Rip program with typical language constructs, not a specialized grammar specification file.

**Why solar.rip?**
- It's a real-world Rip program (the parser generator)
- Contains typical language features: functions, classes, conditionals, loops, etc.
- More representative of actual user code
- Larger and more complex than grammar.rip (996 lines vs 808 lines)
- Better stress test for the parser

## Running the Benchmark

```bash
bun run benchmark
```

Or directly:

```bash
bun scripts/benchmark-parser.js
```

## Baseline Performance (November 14, 2025)

**System:** macOS arm64, Bun v1.3.1
**Version:** Rip v1.5.4 (optimized-solar branch)
**Test file:** solar.rip (996 lines, 35.7 KB)

### Quick Benchmark Results (100 iterations)
- **Parses/sec:** 26.00
- **Average:** 38.47ms per parse
- **Median:** 34.63ms per parse
- **Min/Max:** 30.10ms - 213.20ms
- **P95:** 60.33ms
- **P99:** 213.20ms

### Extended Benchmark Results (5 second duration)
- **Parses/sec:** 33.22
- **Average:** 30.10ms per parse
- **Iterations:** 167 parses

### Throughput
- **1.13 MB/sec** (1,187,161.73 bytes/sec)
- **33,087.45 lines/sec**

### Memory Usage
- **RSS:** 227.23 MB
- **Heap Used:** 17.33 MB
- **Heap Total:** 94.33 MB

## Interpreting Results

### Key Metrics

1. **Parses/sec (Extended)** - Most reliable metric (33.22)
   - Smooths out JIT warmup effects
   - Better for comparing before/after optimizations

2. **Average parse time** - Easy to understand (30.10ms)
   - Lower is better
   - Should be consistent across runs

3. **P95/P99** - Worst-case performance
   - Important for real-world responsiveness
   - Watch for outliers (note the P99 spike at 213ms!)

4. **Throughput** - Context for the numbers
   - ~1.13 MB/sec or ~33k lines/sec
   - Scales with file size

### What to Track

When optimizing, focus on:
- ✅ **Extended Parses/sec** going up
- ✅ **Average parse time** going down
- ✅ **P95/P99 times** improving (consistent performance)
- ⚠️ **Memory usage** not significantly increasing

### Expected Improvements

Typical optimization targets:
- **5-10% improvement** - Good optimization
- **20%+ improvement** - Major algorithmic change
- **2x improvement** - Significant architectural change

## Benchmark Design

The benchmark has two phases:

1. **Quick benchmark** (100 fixed iterations)
   - Provides detailed statistics (min, median, avg, P95, P99, max)
   - Good for understanding distribution

2. **Extended benchmark** (5 second duration)
   - Runs as many parses as possible in 5 seconds
   - More stable metric (JIT fully warmed up)
   - Best for comparing optimizations

Both phases are preceded by 10 warmup runs to stabilize JIT compilation.

## Comparison Notes

Before making changes:
1. Run benchmark 3-5 times to get average baseline
2. Note the extended parses/sec and average time
3. Make your optimization
4. Run benchmark 3-5 times again
5. Compare the results

Example:
```bash
# Before optimization
Extended: 33.22 parses/sec (30.10ms avg)

# After optimization
Extended: 39.86 parses/sec (25.09ms avg)

# Result: 20% faster! ✅
```

## Known Variables

Performance can vary based on:
- ❄️ **CPU temperature** - Thermal throttling on laptops
- 🔥 **Background processes** - Close heavy apps
- ⚡ **Power mode** - Plugged in vs battery
- 🎯 **JIT warmup** - First few runs may be slower
- 💾 **Disk cache** - File system caching effects

For most accurate comparisons:
- Run benchmarks back-to-back
- Same system state (fresh terminal, minimal apps)
- Take average of multiple runs

## Future Enhancements

Potential additions:
- [ ] Test with multiple input files (small, medium, large)
- [ ] Compare parser-only vs full compilation
- [ ] Measure just lexer performance
- [ ] Measure just codegen performance
- [ ] Track performance over git commits
- [ ] JSON output for automated tracking
