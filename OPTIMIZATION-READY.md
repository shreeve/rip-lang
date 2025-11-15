# 🎯 Ready for Parser Optimization!

## Quick Start

**Save your baseline:**
```bash
./scripts/benchmark-all.sh > BEFORE.txt
```

**After optimization:**
```bash
./scripts/benchmark-all.sh > AFTER.txt
diff BEFORE.txt AFTER.txt
```

---

## Current Baseline (November 14, 2025)

### Primary Metric: Parsing Actions/Sec 🎯
```
3.73 million actions/sec
268 nanoseconds per action
24,410 actions per file (6,648 shifts + 17,762 reduces)
```

**This is what you're optimizing!** Table lookups and grammar reductions.

**Expected after Uint16Array:** 6-12× faster = **22-45 million actions/sec**

---

### Secondary Metrics

**Parser-only (no lexer, no codegen):**
```
150.74 files/sec
6.63ms per file
```

**Full compilation (lexer + parser + codegen):**
```
33.22 files/sec
30.10ms per file
```

---

## Available Benchmarks

| Command | What It Measures | Key Metric |
|---------|------------------|------------|
| `bun run benchmark:actions` | Individual parsing operations | **Actions/sec** |
| `bun run benchmark:parser` | Parser-only (no lexer/codegen) | Files/sec |
| `bun run benchmark` | Full compilation pipeline | Files/sec |
| `./scripts/benchmark-all.sh` | All three at once | Summary |

---

## What to Expect

### Parsing Actions (Primary)
- **Baseline:** 3.73M actions/sec
- **Target:** 22-45M actions/sec
- **Expected:** 6-12× improvement 🚀

### Parser Files/Sec (Secondary)
- **Baseline:** 151 files/sec
- **Expected:** 300-500 files/sec
- **Improvement:** 2-3× (some overhead is s-expression building)

### Full Compilation (Real-World)
- **Baseline:** 33 files/sec
- **Expected:** 40-45 files/sec
- **Improvement:** 1.2-1.4× (codegen dominates at 56% of time)

---

## Why Three Metrics?

1. **Actions/sec** - Proves your table optimization worked
2. **Parser files/sec** - Shows end-to-end parser improvement
3. **Full compilation** - Real user experience

All three tell a story! 📊

---

## Test Files

All benchmarks use **solar.rip** (the parser generator itself):
- 996 lines
- 35.7 KB
- 6,648 tokens
- Real Rip code (not a test file)

---

## Ready to Optimize!

1. **Save baseline:** `./scripts/benchmark-all.sh > BEFORE.txt`
2. **Make your changes** (Uint16Array tables, etc.)
3. **Run tests:** `bun run test` (must pass!)
4. **Benchmark:** `./scripts/benchmark-all.sh > AFTER.txt`
5. **Compare:** `diff BEFORE.txt AFTER.txt`

Look for **Actions/sec** to jump from ~3.73M to 22-45M! 🎯

Good luck! 🚀

---

## Documentation

- `scripts/BASELINE.md` - Detailed baseline with math
- `scripts/BENCHMARK.md` - How benchmarks work
- `scripts/benchmark-*.js` - Individual benchmark scripts

---

**The baseline is established. Time to optimize!** ⚡
