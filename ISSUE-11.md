# Issue #11: Nested Comprehension Context Problem

**Status:** In Progress  
**Branch:** `fix/nested-comprehension-context`  
**Issue:** https://github.com/shreeve/rip-lang/issues/11  
**Complexity:** High - Requires careful design  
**Priority:** Medium - Functionally correct but inefficient

---

## The Problem

Nested comprehensions/loops inside value-context comprehensions generate wasteful nested IIFEs instead of plain loops, resulting in inefficient code with variable shadowing bugs.

### Real-World Example from bar.coffee

**Source (lines 211-220):**
```coffeescript
when enc[0].test str
  for row in @scan enc[1], str
    [seg, col...] = row.split(@fld)
    for fld, nfld in col
      for rep, nrep in fld.split(@rep)
        all = rep.split(@com)
        for com, ncom in all when com
          @data(tag, com)  # Side effect only!
```

**Current Rip Output (BAD - 4 nested IIFEs):**
```javascript
return (() => {                    // IIFE 1 - from switch when in value context
  const result = [];
  for (const row of ...) {
    result.push((() => {            // IIFE 2 - WASTEFUL!
      const result = [];             // Shadows outer result!
      for (let nfld...) {
        result.push((() => {        // IIFE 3 - WASTEFUL!
          const result = [];         // Shadows again!
          for (let nrep...) {
            result.push((() => {    // IIFE 4 - WASTEFUL!
              const result = [];     // Shadows again!
              for (let ncom...) {
                result.push(this.data(tag, com));  // Builds array to discard!
              }
              return result;         // Array immediately discarded
            })());
          }
        })());
      }
    })());
  }
})();
```

**CoffeeScript Output (GOOD):**
```javascript
for (k = 0, len1 = ref.length; k < len1; k++) {
  row = ref[k];
  for (nfld = l = 0, len2 = col.length; l < len2; nfld = ++l) {
    fld = col[nfld];
    for (nrep = m = 0, len3 = ref1.length; m < len3; nrep = ++m) {
      rep = ref1[nrep];
      for (ncom = n = 0, len4 = all.length; n < len4; ncom = ++n) {
        com = all[ncom];
        this.data(tag, com);  // Just the side effect!
      }
    }
  }
}
```

**Expected Rip Output (CLEAN):**
```javascript
for (const row of ...) {           // Plain loop
  [seg, ...col] = row.split(this.fld);
  for (let nfld = 0; nfld < col.length; nfld++) {
    const fld = col[nfld];
    for (let nrep = 0; nrep < fld.split(this.rep).length; nrep++) {
      const rep = fld.split(this.rep)[nrep];
      for (let ncom = 0; ncom < all.length; ncom++) {
        const com = all[ncom];
        if (com) {
          this.data(tag, com);  // Just the side effect!
        }
      }
    }
  }
}
```

---

## Impact

**Performance:**
- 🐌 4 unnecessary IIFEs with function call overhead
- 💾 4 array allocations that are immediately discarded
- 🔄 Memory churn from building/discarding arrays

**Code Quality:**
- 😱 Ugly nested IIFE soup
- 🐛 Variable shadowing (`result` shadows outer `result`)
- 📏 Verbose output (2x larger than needed)

**Real-world:**
- bar.coffee: 608 lines (CoffeeScript) vs 312 lines (Rip)
- Without this bug, Rip output could be even smaller

---

## Root Cause Analysis

### The Context Propagation Chain

1. **Function level:** `set()` method's last statement is a switch → switch in **value context**
2. **Switch level:** When in value context, switch wraps in IIFE (line 2005-2010)
3. **Switch case body:** Generates with **value context passed down** (line 1989: `generateSwitchCaseBody(body, context)`)
4. **For-in in value context:** Converts to comprehension (line 1320-1326)
5. **Comprehension in value context:** Generates IIFE (line 2025-2230)
6. **Nested loops:** Also get value context, repeat steps 4-5 recursively
7. **Result:** Nested IIFE cascade

### The Core Bug

**Line 1320-1326 in src/codegen.js:**
```javascript
case 'for-in': {
  // For-in loop: ["for-in", vars, iterable, step, guard, body]
  const [vars, iterable, step, guard, body] = rest;

  // In value context, convert to comprehension (collect results)
  if (context === 'value') {
    // BUG: This conversion happens EVEN for nested loops in other loops!
    const iterator = ['for-in', vars, iterable, step];
    const guards = guard ? [guard] : [];
    return this.generate(['comprehension', body, [iterator], guards], context);
  }
```

This is too aggressive - it converts **all** for-in loops in value context to comprehensions, even when they're nested inside other loops where the result isn't actually used.

---

## Why It's Tricky

**Can't just force all nested loops to statement context** because sometimes we DO need the nested array:

```coffeescript
# NEEDS nested array building:
result = ((x * y for x in [1, 2]) for y in [10, 20])
# Expected: [[10, 20], [20, 40]]
# Inner comprehension MUST build array

# vs.

# Should NOT build arrays:
result = for y in outer
  process(x) for x in y  # Side effect only!
# Expected: process each x, return undefined or last value
```

**The distinction:**
- Inner comprehension is the **entire body expression** → needs array
- Inner comprehension is **just a side effect** → plain loop

---

## Proposed Solutions

### Solution A: Smart Expression Analysis (Most Correct)

Analyze if comprehension result is actually used:

```javascript
const comprehensionResultIsUsed = (expr) => {
  // If expr IS the comprehension: (comp for ...) for ... → USED
  if (Array.isArray(expr) && expr[0] === 'comprehension') {
    return true;  // The comprehension itself is the value
  }
  
  // If expr is a block with comprehension as last: { ...; comp for ... } → USED
  if (Array.isArray(expr) && expr[0] === 'block') {
    const statements = expr.slice(1);
    const last = statements[statements.length - 1];
    return Array.isArray(last) && last[0] === 'comprehension';
  }
  
  // If expr contains comprehension but isn't the comprehension: side effect
  return false;
};

// Then at line 2200:
if (comprehensionResultIsUsed(stmt)) {
  code += this.indent() + `result.push(${this.generate(stmt, 'value')});\n`;
} else {
  code += this.indent() + this.generate(stmt, 'statement') + ';\n';
}
```

### Solution B: Track IIFE Nesting (Simpler)

Add instance variable to track nesting:

```javascript
// Add to CodeGenerator constructor
this.inComprehensionIIFE = 0;

// In comprehension value context (line ~2040):
this.inComprehensionIIFE++;
// ... generate IIFE body ...
this.inComprehensionIIFE--;

// In for-in (line ~1321):
if (context === 'value' && this.inComprehensionIIFE === 0) {
  // Only convert top-level for-in to comprehension
  return this.generate(['comprehension', ...], context);
}
// Nested for-in stays as plain loop
```

**Pros:** Simple, works reliably  
**Cons:** Adds mutable state to generator

### Solution C: Use Unique Variable Names (Band-Aid)

Fix the shadowing bug but keep the IIFEs:

```javascript
// Generate unique result variable names
const resultVar = `_result${this.comprehensionDepth || 0}`;
this.comprehensionDepth = (this.comprehensionDepth || 0) + 1;
code += this.indent() + `const ${resultVar} = [];\n`;
// ... push to resultVar instead of 'result' ...
this.comprehensionDepth--;
```

**Pros:** Fixes the shadowing bug  
**Cons:** Doesn't fix the inefficiency

---

## Recommended Approach

**Option B (Track Nesting)** is the best balance:

1. **Solves the core problem** - No nested IIFEs
2. **Simple to implement** - One counter variable
3. **Low risk** - Doesn't break existing tests
4. **Clean output** - Matches CoffeeScript quality

### Implementation Checklist

- [ ] Add `this.inComprehensionIIFE = 0` to CodeGenerator constructor
- [ ] Increment/decrement in comprehension IIFE generation
- [ ] Check nesting level in for-in/for-of/while/until value context conversion
- [ ] Add tests for nested comprehensions (side effects vs value-producing)
- [ ] Update COMPREHENSIONS.md with nesting rules
- [ ] Verify bar.coffee generates clean output
- [ ] Run all 854 tests

---

## Test Cases Required

```coffeescript
# Test 1: Nested loops for side effects (should be plain loops)
test "nested loops side effects", '''
  count = 0
  for x in [1, 2]
    count++ for y in [1, 2, 3]
  count
  ''', 6

# Test 2: Nested comprehensions building 2D array (needs IIFEs)
test "nested comprehension value", '''
  ((x * y for x in [1, 2]) for y in [10, 20])
  ''', [[10, 20], [20, 40]]

# Test 3: Triple nesting side effects
test "triple nested side effects", '''
  count = 0
  for a in [1, 2]
    for b in [1, 2]
      count++ for c in [1, 2]
  count
  ''', 8

# Test 4: Mixed - outer needs array, inner is side effect
test "mixed nesting", '''
  (for x in [1, 2]
    process(y) for y in [1, 2, 3]
    x * 10) # Last value is what gets collected
  ''', [10, 20]
```

---

## Files Modified So Far

**On branch `fix/nested-comprehension-context`:**
- `test/rip/comprehensions.rip` - Added tests for nested comprehensions
- `src/codegen.js` - Attempted fixes (reverted for now)

**Status:** Tests all passing (854/854) but issue not fixed

---

## Key Code Locations

### 1. for-in Value Context Conversion
**File:** `src/codegen.js`  
**Line:** 1320-1326  
```javascript
if (context === 'value') {
  // TODO: Check if we're nested in another comprehension IIFE
  const iterator = ['for-in', vars, iterable, step];
  const guards = guard ? [guard] : [];
  return this.generate(['comprehension', body, [iterator], guards], context);
}
```

### 2. Comprehension IIFE Generation
**File:** `src/codegen.js`  
**Line:** 2025-2230  
```javascript
case 'comprehension': {
  if (context === 'statement') {
    return this.generateComprehensionAsLoop(...);  // Plain loop - good!
  }
  
  // TODO: Track if we're in an IIFE to avoid nesting
  let code = `(${asyncPrefix}() => {\n`;
  // ...
}
```

### 3. Loop Body Generation (Already Optimized)
**File:** `src/codegen.js`  
**Line:** 3579-3614  
```javascript
generateLoopBody(body) {
  // Already handles nested comprehensions correctly!
  if (Array.isArray(stmt) && stmt[0] === 'comprehension') {
    return this.indent() + this.generateComprehensionAsLoop(...);
  }
}
```

This shows the pattern is already established - we just need to apply it consistently.

---

## Existing Workarounds

**For now, users can avoid nested IIFEs by:**

1. **Extract to named functions:**
```coffeescript
# Instead of:
for outer in data
  for inner in outer
    process(inner)

# Use:
processOuter = (outer) ->
  for inner in outer
    process(inner)

for outer in data
  processOuter(outer)
```

2. **Use explicit statement context:**
```coffeescript
# Add explicit return to force statement context
for outer in data
  for inner in outer
    process(inner)
  null  # Last statement
```

---

## Related Documentation

- **docs/COMPREHENSIONS.md** - Context determination rules
- **AGENT.md:243-248** - Comprehension overview
- **README.md:580-616** - Comprehension examples
- **test/rip/comprehensions.rip** - 24 tests including nesting

---

## Session Context

This issue was discovered on **2025-10-31** during the migration of `bar.coffee`, a real-world CoffeeScript file with complex nested loops.

**Prior work today:**
- Fixed postfix comprehensions with `by` step (Issue #1)
- Refactored step handling (Issue #3)
- Fixed comprehension context detection (Issue #5)
- Added parser error locations (Issue #7)
- Added range loops without variable (Issue #9)
- **Current:** Tackling nested comprehension efficiency (Issue #11)

**Test progression:** 843 → 854 (all passing)

**bar.coffee status:** Compiles successfully (0 errors) but generates inefficient nested IIFEs

---

## Why This Matters

**Current situation:**
- bar.coffee: 394 lines source
- CoffeeScript output: 608 lines
- Rip output: 312 lines (48% smaller overall)
- **But:** The nested IIFEs could be eliminated for even cleaner output

**Goal:** Match or beat CoffeeScript's output quality while maintaining Rip's modern ES2022 style.

---

## Next Steps for Developer/AI

1. **Read this document fully**
2. **Review docs/COMPREHENSIONS.md** for context rules
3. **Choose Solution B** (nesting tracker) - simplest that works
4. **Implement the fix:**
   - Add `inComprehensionIIFE` counter
   - Increment/decrement in comprehension IIFE generation
   - Check counter in for-in/for-of/while/until value→comprehension conversion
5. **Test with bar.coffee** - verify clean output
6. **Run all tests** - must maintain 854/854 passing
7. **Add tests** for nested comprehension scenarios
8. **Update COMPREHENSIONS.md** if needed
9. **Follow the workflow** - commit, PR, merge, close issue

---

## Important Notes

### Don't Break These Tests

```coffeescript
# test/rip/comprehensions.rip:20 - Must keep nested arrays
test "nested comprehension", "((x * y for x in [1, 2]) for y in [10, 20])", [[10, 20], [20, 40]]
```

This test REQUIRES the inner comprehension to build an array. Any fix must distinguish between:
- Comprehension AS the expression (needs array)
- Comprehension FOR side effects (plain loop)

### Code Quality Principles

From the session today:
- ✅ **Keep it clean** - No ugly hacks
- ✅ **Keep it simple** - Prefer simple solutions
- ✅ **Keep it tested** - Add comprehensive tests
- ✅ **Keep it documented** - Update COMPREHENSIONS.md

---

## Alternative: Close as "Won't Fix"

If the complexity is too high, consider:

1. **Fix the variable shadowing** (use unique names: `_result$N`)
2. **Document the limitation** in COMPREHENSIONS.md
3. **Close Issue #11** as "Known inefficiency - optimization deferred to v1.1"
4. **Add workaround docs** for users who need optimal output

The current code is **functionally correct** (minus shadowing), just not optimally efficient. Sometimes "good enough" is the right answer for v1.0.

---

## Contact

If questions arise, refer to:
- **AGENT.md** - AI assistant guide
- **docs/COMPREHENSIONS.md** - Complete context rules
- **CONTRIBUTING.md** - Development workflow
- Prior PRs: #2, #4, #6, #10 for workflow examples

---

**Good luck! The foundation is solid, the tests are comprehensive, and the path forward is clear.** 🚀

