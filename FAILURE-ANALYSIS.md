# Systematic Analysis of 315 Test Failures

**Date:** Current session
**Test Coverage:** 647/962 passing (67.3%)
**Remaining:** 315 failures (32.7%)

---

## Executive Summary

After implementing operator precedence (+17 tests), we analyzed all 315 remaining failures to identify the highest-impact issues. The failures fall into a few major categories, with **two critical blockers** accounting for an estimated **120-150 tests** (~38-48% of remaining failures).

---

## Top Issues (Prioritized by Impact)

### 🔴 #1: Statement-in-Expression Context (~90-120 tests, ~29-38%)

**Problem:** Parser doesn't allow control flow statements as expressions

**Examples that fail:**
```rip
result = if x > 0 then 'positive' else 'negative'  # IF as expression
value = while condition then doSomething()          # WHILE as expression
data = for x in arr then process(x)                 # FOR as comprehension value
```

**Error message:**
```
Parse error: expected @, BOOL, ..., IDENTIFIER, ..., got IF
Parse error: expected @, BOOL, ..., IDENTIFIER, ..., got WHILE
Parse error: expected @, BOOL, ..., IDENTIFIER, ..., got UNLESS
Parse error: expected @, BOOL, ..., IDENTIFIER, ..., got UNTIL
```

**Count:**
- Direct parse errors: 40 tests (IF, UNLESS, WHILE, UNTIL, LOOP)
- Affects test files:
  - `control.rip`: ~14 failures (if/unless/while blocks)
  - `stabilization.rip`: ~35 failures (complex control flow, nested returns)
  - `parens.rip`: ~8 failures (conditions in various contexts)
  - `semicolons.rip`: ~6 failures (block syntax)
  - `loops.rip`: ~12 failures (while/until as statements)
  - `comprehensions.rip`: ~8 failures (for as expression)
  - `functions.rip`: ~7 failures (return in if blocks)

**Root Cause:**
The PRD parser currently treats IF/UNLESS/WHILE/UNTIL/FOR/SWITCH as **statements only**, not as expressions. The grammar likely has these in the `Statement` rule but not in the `Expression` rule, causing parse failures when they appear in value context.

**Solution Approach:**
1. Check grammar: Are IF/UNLESS/etc in `Expression` rule or only `Statement`?
2. If missing from Expression, add them
3. Regenerate parser
4. May need codegen updates to handle expression vs statement context

**Estimated Impact:** +90-120 tests (29-38% of remaining)

---

### 🔴 #2: FOR Loop Variable Parsing (~40-50 tests, ~13-16%)

**Problem:** Parser requires destructuring brackets `[var]` but should accept bare identifiers

**Examples that fail:**
```rip
for x in arr then doSomething(x)           # Expects [x]
for k of obj then console.log(k)           # Expects [k]
for i in [1..10] then process(i)           # Expects [i]
```

**Error message:**
```
Parse error: expected [, got IDENTIFIER
Parse error: expected [, got AWAIT  (for await patterns)
Parse error: expected [, got OWN    (for own patterns)
```

**Count:**
- Direct parse errors: 23 tests
- Affects test files:
  - `loops.rip`: ~13 failures (for-in, for-of basic syntax)
  - `guards.rip`: ~13 failures (for with when/own keywords)
  - `comprehensions.rip`: ~9 failures (comprehension syntax)
  - `basic.rip`: ~8 failures (for with ranges, slices)
  - `semicolons.rip`: ~2 failures
  - `stabilization.rip`: ~3 failures
  - `async.rip`: ~4 failures (for await)

**Root Cause:**
Grammar rule for FOR loops requires `ForVariables` which might be defined as array destructuring only, not accepting bare identifiers.

**Solution Approach:**
1. Check `ForVariables` grammar rule
2. Add alternative: `ForVariables: Identifier | Array destructuring`
3. Update codegen if needed to handle both patterns
4. Regenerate parser

**Estimated Impact:** +40-50 tests (13-16% of remaining)

---

### 🟡 #3: Import/Export Statements (~21 tests, ~7%)

**Problem:** Module syntax not parsing correctly

**Error:**
```
Parse error: expected @, ..., got IMPORT
Parse error: expected @, ..., got EXPORT
```

**Count:** 21 tests (all in `modules.rip`)

**Root Cause:** IMPORT/EXPORT might be in `Statement` but not recognized at top level or in expression contexts where they're used.

**Impact:** +21 tests

---

### 🟡 #4: Class Syntax (~20 tests, ~6%)

**Problem:** Class declarations, methods, super calls

**Count:** 20 failures in `classes.rip`

**Examples:**
- Basic class declarations
- Methods and constructors
- Inheritance with `extends`
- `super()` calls
- Static methods

**Impact:** +20 tests

---

### 🟢 #5: Array/Object Destructuring Edge Cases (~25 tests, ~8%)

**Problems:**
- Elisions (holes in arrays): `[a, , c] = arr`
- Rest in middle: `[a, ...rest, b] = arr`
- Computed properties: `{[key]: value} = obj`
- Spread in literals: `[...arr, x]`

**Count:**
- Invalid destructuring: 3 tests
- Parse errors with `[` in expression context: ~6 tests
- Parse errors with `{` in expression context: ~3 tests
- Postfix spread (`compatibility.rip`): ~13 tests

**Impact:** +25 tests

---

### 🟢 #6: Regex Index Syntax (~13 tests, ~4%)

**Problem:** `str[/pattern/, N]` syntax for extracting capture groups

**Count:** 13 failures in `regex.rip`

**Example:**
```rip
email = "user@example.com"
domain = email[/@(.+)$/, 1]  # Extract group 1
```

**Impact:** +13 tests

---

### 🟢 #7: Return Statement Context (~11 tests, ~3%)

**Problem:** Return not recognized in some contexts

**Count:** 4 direct + ~7 in functions/stabilization

**Examples:**
- `return` at statement level
- `return` with postfix conditions
- `return` in void functions

**Impact:** +11 tests

---

### 🟢 #8: Comprehension Features (~18 tests, ~6%)

**Problems:**
- Object comprehensions: `{k: v for k, v of obj}`
- Guards: `for x in arr when x > 0`
- Multiple guards
- `break`/`continue` in comprehensions

**Count:** ~18 failures in `comprehensions.rip`, `guards.rip`

**Impact:** +18 tests

---

### 🟢 #9: Runtime/Execution Errors (~16 tests, ~5%)

**Problem:** Code parses correctly but produces wrong output

**Count:** 16 tests (not parse errors)

**Examples:**
- Wrong values returned
- Missing await behavior
- Incorrect codegen

**Impact:** These need individual investigation

---

### 🟢 #10: Miscellaneous (~50-60 tests, ~16-19%)

**Includes:**
- Prefix increment/decrement
- Various operator edge cases
- Multiline syntax (trailing commas, INDENT/OUTDENT)
- Complex nested expressions
- Codegen optimizations
- Minor grammar issues

**Impact:** Need case-by-case analysis

---

## Recommended Priority Order

### Phase 1: Critical Blockers (130-170 tests, ~41-54%)
1. **Statement-in-Expression** (~90-120 tests)
2. **FOR Loop Variables** (~40-50 tests)

**Time estimate:** 6-10 hours
**New total:** 777-817 tests (81-85%)

### Phase 2: Medium Impact (40-60 tests, ~13-19%)
3. **Import/Export** (21 tests)
4. **Classes** (20 tests)
5. **Destructuring** (25 tests)

**Time estimate:** 6-8 hours
**New total:** 817-877 tests (85-91%)

### Phase 3: Polish (85-105 tests, ~27-33%)
6. **Regex Index** (13 tests)
7. **Returns** (11 tests)
8. **Comprehensions** (18 tests)
9. **Runtime Errors** (16 tests)
10. **Misc** (50-60 tests)

**Time estimate:** 10-15 hours
**New total:** 962 tests (100%)

---

## Key Insights

1. **Only 2 issues block ~130-170 tests** (41-54% of failures)
2. **Both are grammar issues**, not complex codegen problems
3. **Operator precedence revealed this** - many tests now parse far enough to hit these blockers
4. **The +17 from precedence makes sense** - those were tests where precedence was the ONLY blocker

---

## Next Steps

**Immediate:** Fix "Statement-in-Expression" issue
**Why:** Single highest impact (~90-120 tests)
**How:** Add IF/UNLESS/WHILE/etc to Expression rule in grammar

After that fix, we should see a major jump (possibly 65.5% → 79-80%).
