# Parser Optimization Status

**Date:** November 14, 2025  
**Status:** ✅ Baseline established, ready for optimization work

---

## ✅ Current State

### Working Baseline (Unoptimized)
- **Parser:** Standard unoptimized version
- **Tests:** 968/968 passing (100%)
- **Baseline saved:** `BASELINE-UNOPTIMIZED.txt`

### Performance Baseline
```
Actions/sec:          ~3.1M
Parser files/sec:     ~128
Full compilation:     ~29
```

---

## 🎯 Optimizations (Coded in solar.rip, needs debugging)

Your `src/grammar/solar.rip` (1216 lines) contains:

1. ✅ **Alias detection** (`detectAliases()`) - Lines 651-723
   - Detects single-symbol passthrough rules
   - Follows alias chains to ultimate target
   - Creates `@aliases` map

2. ✅ **Packed Uint32Array table** (`_generateTableCode()`) - Lines 794-847
   - Packs as: `(index << 16) | value`
   - 64% size savings (106 KB vs 298 KB)
   - Lazy inflation on first parse

3. ✅ **Bitwise action encoding** (`_encodeAction()`) - Lines 849-872
   - Type in LOW 2 bits (shift=1, reduce=2, accept=3)
   - Value in HIGH 14 bits
   - GOTO entries stored as-is

4. ✅ **Optimized runtime parser** - Lines 885-1032
   - Flat Uint16Array table (cache-friendly)
   - Uint16Array state stack (pre-allocated)
   - Alias elimination in GOTO lookup
   - Bitwise decode: `entry & 0x3` and `entry >>> 2`

---

## 🐛 Bootstrap Issue

**Problem:** The optimized solar.rip can't compile itself yet due to a subtle bug in the optimized parser code.

**Workaround:** Use external solar-parser to bootstrap:
```bash
bun run parser-old  # Uses $c/solar-parser/src/solar.rip
```

This generates an **unoptimized** parser (no Uint16Array, no packed table).

---

## 📋 Next Steps to Complete Optimization

### Option 1: Debug the optimized parser
1. Fix the location stack issue (lines 998-1012)
2. Fix GOTO encoding/decoding consistency
3. Test bootstrap: `bun run parser && bun run test`

### Option 2: Use working external solar-parser
If you have a working optimized solar-parser elsewhere:
```bash
rip $c/solar-parser-optimized/src/solar.rip -o src/parser.js src/grammar/grammar.rip
bun run test  # Verify it works
./scripts/benchmark-all.sh > AFTER-OPTIMIZATION.txt
diff BASELINE-UNOPTIMIZED.txt AFTER-OPTIMIZATION.txt
```

---

## 🎯 Expected Improvements

| Metric | Baseline | Expected | Improvement |
|--------|----------|----------|-------------|
| **Actions/sec** | 3.1M | 22-45M | 6-12× |
| **Parser files/sec** | 128 | 260-390 | 2-3× |
| **Full compilation** | 29 | 35-42 | 1.2-1.4× |

---

## 📦 What You Have

### Benchmark Scripts
- ✅ `bun run benchmark:actions` - Parsing actions/sec
- ✅ `bun run benchmark:parser` - Parser-only files/sec
- ✅ `bun run benchmark` - Full compilation
- ✅ `./scripts/benchmark-all.sh` - All three at once

### Parser Build Scripts
- ✅ `bun run parser` - Build with local solar.rip (self-hosting)
- ✅ `bun run parser-old` - Build with external solar-parser (bootstrap)

### Saved Files
- ✅ `BASELINE-UNOPTIMIZED.txt` - Current performance
- ✅ `src/grammar/solar-optimized.rip` - Backup of optimized code
- ✅ `src/grammar/solar-old.rip` - Backup of original

---

## 🚀 Ready to Optimize!

**Your baseline is solid:**
- 3.1M actions/sec
- All tests passing
- Benchmarks working

**Your optimizations are coded:**
- Alias detection ✅
- Packed table ✅  
- Bitwise encoding ✅
- Flat Uint16Array ✅

**Just need to debug the bootstrap issue!**

Once working, run:
```bash
./scripts/benchmark-all.sh > AFTER.txt
diff BASELINE-UNOPTIMIZED.txt AFTER.txt
```

Look for actions/sec to jump from ~3M to 22-45M! 🎯

