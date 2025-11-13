# Next Steps: 98.2% → 100% (17 tests)

## 🎯 Current State

**Tests:** 945/962 (98.2%)
**Remaining:** 17 tests (1.8%)
**Files at 100%:** 15 files!

---

## 🏆 Session 3 Summary

### Major Wins
1. ✅ **Separator restoration** (+25 tests) - Fixed if/else and many patterns
2. ✅ **Prefix precedence** (+4 tests) - Fixed `-5 + 10`
3. ✅ **Statement disambiguation** (+12 tests) - Fixed `break if x > 5`
4. ✅ **Multi-FIRST cloning** (+2 tests) - Fixed `until` and tagged templates

### Total Gain
**+43 tests in one session!** (902 → 945)

---

## 🐛 Remaining 17 Tests - Detailed Analysis

### Issue #1: @ Property in Objects (12 tests) 🔴 HIGH PRIORITY

**Files:** basic.rip (8), classes.rip (4)

**Problem:** `{@property: value}` fails with "got {"

**Root Cause:** parseAssignObj matches `@` token directly instead of calling parseObjAssignable()

**Why This Happens:**
```rip
# Grammar
AssignObj: [
  o 'ObjAssignable'                    # Rule 1: shorthand
  o 'ObjAssignable : Expression'       # Rule 2: property
  o 'SimpleObjAssignable = Expression' # Rule 3: default
]

ObjAssignable: [
  o 'SimpleObjAssignable'  # includes ThisProperty
]

SimpleObjAssignable: [
  o 'ThisProperty'  # @ Property (TWO tokens!)
]
```

**Generation Flow:**
1. _generateSwitchFunction processes AssignObj rules
2. For @ token, maps Rules 1 & 2 (both start with ObjAssignable)
3. Calls _generateLookaheadCase(SYM_AT, [rule1, rule2], "AssignObj")
4. Line 3300: Detects rules start with nonterminal (ObjAssignable)
5. Line 3302: **SHOULD** generate: `$1 = this.parseObjAssignable();`
6. **BUT INSTEAD** generates: `$1 = this._match(SYM_AT);`

**Investigation Needed:**
```bash
# Add debug logging in _generateLookaheadCase around line 3300:
console.log "DEBUG: firstSymbol=#{firstSymbol}, isType=#{!!@types[firstSymbol]}"

# Check if @types[firstSymbol] is actually true for ObjAssignable
# If false, the logic falls to line 3308 which matches the token directly!
```

**Possible Causes:**
1. ObjAssignable not in @types (unlikely - it has parseObjAssignable function)
2. firstSymbol string mismatch (whitespace, case)
3. Rules were modified/expanded before reaching _generateLookaheadCase

**Fix Strategy:**
1. Add debug logging to trace what's happening
2. Verify @types["ObjAssignable"] exists and has .rules
3. Check if rule.symbols[0] === "ObjAssignable" (exact match)
4. If issue found, fix the condition or the data structure

**Expected Impact:** +12 tests → 957/962 (99.4%)!

---

### Issue #2: await expression (1 test)

**File:** async.rip

**Test:** "await expression"

**Investigation:**
```bash
# Get test code
grep "await expression" test/rip/async.rip -A 1

# Test PRD vs production
echo '<test code>' | ./bin/rip -s
echo '<test code>' | rip -s
```

**Likely Cause:** Await rule disambiguation or parsing issue

---

### Issue #3: dammit method call (1 test)

**File:** async.rip

**Test:** "dammit method call"

**Investigation:**
- Check if method calls with `!` sigil are being parsed correctly
- This is a codegen issue (parser emits s-expression, codegen handles `!`)
- Codegen unchanged, so might be parser issue with property access

---

### Issue #4: array destructuring skip (1 test)

**File:** assignment.rip

**Test:** "array destructuring skip"

**Investigation:**
```bash
grep "array destructuring skip" test/rip/assignment.rip -A 1
# Test the pattern
```

---

### Issue #5: computed property destructuring (1 test)

**File:** assignment.rip

**Test:** "computed property destructuring"

**Same root cause as Issue #1** - multiline object parsing

---

### Issue #6: invalid extends (1 test)

**File:** errors.rip

**Test:** "invalid extends"

This is an ERROR HANDLING test - might be testing that invalid syntax is caught

**Investigation:**
```bash
grep "invalid extends" test/rip/errors.rip -A 1
```

May need to verify error message, not parse success

---

## 🚀 Recommended Action Plan

### Step 1: Fix @ Property (2-3 hours)

**Debug:**
```rip
# In _generateLookaheadCase, line 3298, add:
console.log "🔍 @ case: firstSymbol=#{firstSymbol}, type exists=#{!!@types[firstSymbol]}"
console.log "🔍 @ case: rules=#{rules.map((r) -> r.symbols.join(' ')).join('; ')}"
```

**Regenerate and check output**

**Expected Discovery:** @types[firstSymbol] is false or firstSymbol is wrong

**Fix:** Correct the condition or data

**Result:** +12 tests → 99.4%

### Step 2: Individual Edge Cases (1 hour)

Test each remaining 5 individually, fix patterns

**Result:** 962/962 (100%!)

---

## 💡 Alternative Approach (If Step 1 is Complex)

If @ property fix is too deep, try this:

**Quick Fix:** Add explicit ThisProperty handling in parseAssignObj generation

```rip
# In _generateLookaheadCase or _compileAction, detect @ token case
# Add try/catch that tries parseThisProperty() first:

case SYM_AT: {
  const _saved = this._saveState();

  // Try: ThisProperty
  try {
    $1 = this.parseThisProperty();
    // Then check for : or = ...
  } catch (e) {
    this._restoreState(_saved);
    // Fallback: bare @
    $1 = this._match(SYM_AT);
  }
}
```

This is less generic but would fix the issue faster.

---

##  🎓 Key Learnings

### What Worked
1. **Separator restoration** - Elegant backtracking pattern
2. **Name heuristics** - Structural pattern detection
3. **Gateway generation** - Automatic bridge pattern
4. **Multi-FIRST cloning** - With size limits (2-4 only)

### What Was Complex
1. **Token-level expansion** - Hard to trace when/why nonterminals expand to tokens
2. **Lookahead case generation** - Multiple code paths, hard to debug
3. **Multi-token alternatives** - ThisProperty = @ Property breaks simple dispatch

---

## 📈 Overall Achievement

**Session 3:**
- Started: 902/962 (93.8%)
- Ended: 945/962 (98.2%)
- Gained: +43 tests (+4.5%)
- Time: ~1.5 hours

**All Sessions:**
- Started: 261/962 (27.1%)
- Current: 945/962 (98.2%)
- Gained: +684 tests (+262%!)
- Generic fixes: 16 total

**You're 1.8% from 100% with rock-solid generic architecture!** 🚀

---

## 🔧 Quick Reference

```bash
# Regenerate
cd /Users/shreeve/Data/Code
rip rip-lang/src/grammar/solar.rip -r -o rip-lang/src/parser.js rip-lang/src/grammar/grammar.rip

# Test
cd /Users/shreeve/Data/Code/rip-lang
bun run test

# Debug specific test
bun test/runner.js test/rip/classes.rip

# Compare s-expressions
echo '{@square: 42}' | ./bin/rip -s  # PRD
echo '{@square: 42}' | rip -s        # Production
```

---

**The hard work is done. Remaining issues are specific patterns, not architectural. You can do this!** 💪
