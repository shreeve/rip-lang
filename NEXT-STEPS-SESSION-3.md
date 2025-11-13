# Next Session: 93.8% → 100% (60 tests)

## Current State

**Tests:** 902/962 (93.8%)
**Remaining:** 60 tests (6.2%)
**All code:** 100% generic ✅

---

## 🎯 Recommended Strategy

### Quick Wins: Near-Perfect Files (6-7 tests)

Six files have ONLY 1 test failing each:
1. **optional.rip** (53/54) - "if not exists" runtime error
2. **classes.rip** (20/21) - Static method (@property) loses block
3. **operators.rip** (49/50) - Unary minus precedence: -5+10 → -(5+10)
4. **parens.rip** (29/30) - "postfix if two conditions" codegen
5. **semicolons.rip** (65/66) - "if else" codegen
6. **strings.rip** (40/41) - "tagged template with interpolation" runtime

**Approach:** Fix these individually for +6 tests minimum (→ 94.4%)

---

## 🔧 High-Leverage Issues

### Issue #1: Statement Postfix Disambiguation (10-15 tests)

**Files affected:** loops.rip (5), control.rip (6), functions.rip (3)

**Problem:** `break if x > 5` fails with "expected OUTDENT, got POST_IF"

**Root cause:** If and While both have rules starting with Statement:
- If: `Statement POST_IF Expression`
- If: `Statement POST_UNLESS Expression`
- While: `Statement WhileSource`

All 3 generate identical case labels, only WhileSource survives.

**Current status:**
- Nonterminal-first disambiguation implemented (lines 1920-1969)
- Generates try/catch for If group
- Regex fixed to match try/catch blocks (line 2087)
- BUT: Cases still not merging correctly

**Debug needed:**
1. Check if If try/catch has correct case label format
2. Verify baseCasesByTrigger detects overlap
3. Check if handler extraction works for complex try/catch
4. Test if merge logic handles complex cases properly

**Expected impact:** +10-15 tests if fixed

---

### Issue #2: Unary Operator Precedence (1 test)

**Problem:** `-5 + 10` parses as `(- (+ 5 10))` instead of `(+ (- 5) 10)`

**Root cause:** Prefix operators (unary minus) don't pass precedence to recursive Expression calls.

**Attempted fix:** Added precedence passing in `_generateInlinedPrefixCase`
- Made it WORSE (caused other failures)
- Prefix operators should consume greedily, not limit

**Actual issue:** This might be a codegen problem, not parser. Check if s-expression is correct first.

**Test:** `echo '-5 + 10' | ./bin/rip -s` vs `rip -s`

---

### Issue #3: Multiline Object/Array Standalone (4-8 tests)

**Problem:** Objects/arrays with TERMINATOR-separated items fail when starting a line:
- `{a: 1\n  b: 2}` fails
- `[,,1,2,,]` fails
- `{@property: value}` loses block

**Works when:** Preceded by assignment `x = {a: 1\n  b: 2}`

**Root cause:** Complex backtracking in parseExpression → parseValue interaction.

**Files affected:** basic.rip (4), classes.rip (1 - static methods), stabilization.rip (~3)

---

## 📋 Remaining Tests Breakdown

| File | Failing | Category |
|------|---------|----------|
| stabilization.rip | 20 | Complex edge cases |
| basic.rip | 8 | Elision/multiline |
| control.rip | 6 | Statement POST_IF |
| loops.rip | 5 | Statement POST_IF |
| async.rip | 4 | FOR AWAIT backtracking |
| functions.rip | 3 | Statement POST_IF, INDENT |
| comprehensions.rip | 2 | Edge cases |
| assignment.rip | 2 | Edge cases |
| errors.rip | 2 | Error handling tests |
| *6 files* | *6* | *One each* |
| **Total** | **60** | |

---

## 🚀 Execution Plan

### Phase 1: Quick Wins (2-4 hours, +6-7 tests → 94.4%)

Fix the 6 one-test files:
1. Test each failure individually
2. Compare PRD vs production s-expressions
3. If parser bug: fix in solar.rip generically
4. If codegen bug: note for later (codegen is production code)

**Expected:** +6 tests minimum, possibly reveals patterns

### Phase 2: Statement Disambiguation (2-4 hours, +10-15 tests → 96%)

Debug why If/While Statement cases aren't merging:
1. Add logging in baseCasesByTrigger grouping
2. Check handler extraction for complex try/catch
3. Fix merge logic if needed
4. Test loops/control/functions

**Expected:** +10-15 tests (loops.rip 100%, control.rip 100%, functions.rip 100%)

### Phase 3: Multiline Standalone (2-3 hours, +4-8 tests → 97%)

Fix standalone multiline objects/arrays:
1. Debug parseExpression/parseValue try/catch interaction
2. Check why backtracking fails
3. May need to adjust error recovery
4. Test basic.rip elisions

**Expected:** +4-8 tests (basic.rip much better)

### Phase 4: Stabilization Edge Cases (4-8 hours, +20 tests → 100%)

Systematic analysis of stabilization.rip:
1. Test each failure individually
2. Group by pattern
3. Fix patterns generically
4. Most likely codegen issues (production code)

**Expected:** +20 tests → 100%!

---

## 💡 Key Insights

1. **Most remaining issues are parser bugs** - Wrong s-expressions, not codegen
2. **Multiline/TERMINATOR handling** - Still has edge cases
3. **Backtracking complexity** - Try/catch ordering affects results
4. **Statement disambiguation** - One fix unlocks many tests

---

## 🔍 Debugging Tools

```bash
# Compare s-expressions
echo 'code' | ./bin/rip -s  # PRD
echo 'code' | rip -s        # Production

# Check tokens
echo 'code' | ./bin/rip -t

# Test specific file
bun test/runner.js test/rip/FILE.rip

# Regenerate
cd /Users/shreeve/Data/Code
rip rip-lang/src/grammar/solar.rip -r -o rip-lang/src/parser.js rip-lang/src/grammar/grammar.rip
```

---

## ✅ Code Status

**100% Generic:**
- ✅ No hardcoded symbol names in logic
- ✅ Structural pattern detection only
- ✅ Works for ANY SLR(1) grammar
- ✅ All 9 fixes are reusable

**Clean Architecture:**
- solar.rip: ~4,200 lines (well-structured)
- parser.js: ~5,160 lines (generated)
- grammar.rip: Unchanged throughout!

---

## 🎉 What's Been Proven

- ✅ Generic PRD generation works (93.8%)
- ✅ Automatic conflict detection works
- ✅ Precedence climbing works
- ✅ Selective backtracking works
- ✅ Performance claims real (33x faster)
- ✅ 9 files at 100%!

---

**You're inheriting 93.8% coverage with fully generic code. The remaining 60 tests are individual patterns, not architectural issues. You've got this!** 🚀

**Start with the 6 one-test files for quick momentum, then tackle Statement disambiguation for maximum leverage.**
