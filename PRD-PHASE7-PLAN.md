# PRD Parser - Phase 7 Implementation Plan

**Objective:** Resolve circular dependencies to enable full grammar coverage

**Status:** Phase 6 complete. Operator precedence working. Ready for Phase 7.

---

## Context: What's Been Done (Phases 1-6)

### Current State ✅

**Phase 1-6 Achievements:**
- ✅ Oracle consultation (SLR(1) tables guide generation)
- ✅ Left-recursion → while loops
- ✅ Intermediate nonterminal inlining
- ✅ Multi-symbol action compilation (Phase 4)
- ✅ Lookahead disambiguation for TRUE ambiguity (Phase 5)
- ✅ Operator precedence climbing (Phase 6)

**File Size:** 31KB (89.5% reduction from 294KB table)
**Functions:** 27 nonterminals generated
**Coverage:** 31%

### The Problem Phase 7 Solves ⚠️

**Circular dependencies prevent generating more functions:**

```
Expression → Operation → Value → Assignable → ... → Expression
Expression → Statement → For → Expression
Expression → If → Expression
SimpleAssignable → Value . Property → Value → SimpleAssignable
```

**Result:** We can't generate these nonterminals without hitting infinite recursion or undefined function calls at runtime.

**This is what Phase 7 tackles.**

---

## Understanding the Circular Dependencies

### Dependency Graph Analysis

Let me map out the key circular dependencies in the CoffeeScript grammar:

#### Cycle 1: Expression ↔ Operation ↔ Value
```
Expression → Operation (for binary expressions)
Operation → Value (base case)
Value → Assignable
Assignable → SimpleAssignable
SimpleAssignable → Identifier | ThisProperty | Value (for accessors)
Value → back to Expression in some cases
```

**Already handled:** Operation uses precedence climbing, skipping normal generation ✅

#### Cycle 2: Expression ↔ Statement ↔ Control Flow
```
Expression → Statement
Statement → Return | Import | Export | etc.
Return → RETURN Expression (back to Expression!)
For → FOR ... Expression (back to Expression!)
If → IF Expression (back to Expression!)
While → WHILE Expression (back to Expression!)
```

**Problem:** Control flow constructs need Expression, Expression needs Statement

#### Cycle 3: Value ↔ Accessor Chains
```
Value → SimpleAssignable
SimpleAssignable → Value . Property (accessor)
SimpleAssignable → Value [ Expression ] (index)
SimpleAssignable → Value Arguments (call)
```

**Problem:** Value and SimpleAssignable call each other for accessor chains like `obj.prop[0].method()`

#### Cycle 4: Expression ↔ Parenthetical
```
Expression → Value → Parenthetical
Parenthetical → ( Body )
Body → Line → Expression
```

**Status:** This cycle is actually fine - Parenthetical matches `(`, calls parseBody(), which calls parseExpression(). As long as we eventually reach base cases (Identifier, Number, etc.), this terminates.

### Which Cycles Block Us?

**Currently blocking generation:**
1. **Cycle 2 (Statement ↔ Expression)** - Can't generate If, While, For without Expression; Expression dispatches to Statement
2. **Cycle 3 (Value ↔ Accessor)** - Can't generate accessor handling without cycling

**Not currently blocking:**
- Cycle 1: Operation already handled specially (precedence climbing)
- Cycle 4: Actually fine - has base cases

---

## Solution Strategies

### Strategy A: Inline Small Nonterminals (Recommended First)

**Approach:** For nonterminals that just dispatch to one or two alternatives, inline them instead of generating separate functions.

**Example: Statement**
```coffeescript
Statement: [
  o 'Return'
  o 'STATEMENT'
  o 'Import'
  o 'Export'
]
```

**Current approach (fails):**
```javascript
parseStatement() {
  switch (this.la.id) {
  case SYM_RETURN: return this.parseReturn();  // Return needs Expression
  // ...
  }
}
```

**Inline approach (works):**
```javascript
parseExpression() {
  switch (this.la.id) {
  case SYM_RETURN: return this.parseReturn();  // Inline Statement dispatch
  case SYM_IMPORT: return this.parseImport();
  case SYM_EXPORT: return this.parseExport();
  case SYM_STATEMENT: return this._match(SYM_STATEMENT);
  case SYM_IDENTIFIER: /* ... Value alternatives ... */
  // ...
  }
}
```

**Benefits:**
- ✅ Breaks the cycle - Expression doesn't call Statement, it directly calls Return/Import/Export
- ✅ Fewer functions = smaller file size
- ✅ No runtime overhead

**Drawbacks:**
- ❌ parseExpression() becomes larger
- ❌ Less modular

**Implementation:**
Add Statement to SKIP_GENERATION, then when generating Expression, expand through Statement to get its alternatives directly.

### Strategy B: Generate Stubs with Forward References

**Approach:** Generate all function declarations first as stubs, then fill in bodies. JavaScript allows calling functions defined later in the same file.

**Example:**
```javascript
// Forward declarations (stubs)
parseExpression() { /* filled in later */ }
parseStatement() { /* filled in later */ }
parseReturn() { /* filled in later */ }

// Now fill in the bodies
parseExpression = function() {
  switch (this.la.id) {
  case SYM_RETURN: return this.parseStatement();
  // ...
  }
}

parseStatement = function() {
  switch (this.la.id) {
  case SYM_RETURN: return this.parseReturn();
  // ...
  }
}

parseReturn = function() {
  this._match(SYM_RETURN);
  const expr = this.parseExpression();  // Calls back to Expression - OK!
  return ["return", expr];
}
```

**Benefits:**
- ✅ Keeps functions modular
- ✅ Preserves grammar structure
- ✅ Works for any cycle

**Drawbacks:**
- ❌ More complex generation
- ❌ Slightly different code structure

**Implementation:**
1. First pass: Generate all function declarations with empty bodies
2. Second pass: Fill in function bodies
3. Requires restructuring _generateParseFunctions

### Strategy C: Topological Sort with Cycle Breaking

**Approach:** Use topological sorting to order function generation, breaking cycles by inlining one nonterminal in the cycle.

**Algorithm:**
1. Build dependency graph (which functions call which)
2. Find strongly connected components (cycles)
3. For each cycle, pick one nonterminal to inline (break the cycle)
4. Generate functions in topological order

**Example:**
```
Cycle detected: Expression → Statement → Return → Expression

Pick Statement to inline (smallest)
Generate order:
1. Return (can call Expression - not generated yet, but will be)
2. Import, Export (no dependencies)
3. Expression (inlines Statement, calls Return/Import/Export)
```

**Benefits:**
- ✅ Systematic approach
- ✅ Minimizes inlining (only where needed)
- ✅ Handles any number of cycles

**Drawbacks:**
- ❌ Complex to implement
- ❌ Requires graph algorithms
- ❌ Still needs forward references or inline for cycle breaking

**Implementation:**
1. Build dependency graph in _generateParseFunctions
2. Use Tarjan's algorithm to find SCCs
3. Pick smallest nonterminal in each SCC to inline
4. Generate in topological order

### Strategy D: Accept Partial Coverage (Pragmatic)

**Approach:** Accept that some nonterminals can't be generated in PRD mode. Focus on generating as much as possible.

**What to skip:**
- Complex control flow (For, While) - keep these skipped
- Accessor chains - keep SimpleAssignable skipped
- Class definitions - complex, skip

**What to generate:**
- Expression (inlining Statement)
- Return, Yield, Import, Export
- If (simple variant without complex nesting)
- Literals, identifiers, basic values
- Arrays, objects (without complex patterns)

**Result:** ~40-50 functions generated (50-60% coverage)

**Benefits:**
- ✅ Simpler to implement
- ✅ Focuses on most common cases
- ✅ Still much smaller than table parser

**Drawbacks:**
- ❌ Incomplete - can't parse all valid CoffeeScript
- ❌ Falls back to table parser for skipped cases (if implementing hybrid)

---

## Recommended Approach: Strategy A + Strategy D

**Phase 7 Plan:**

1. **Inline Statement into Expression**
   - Add Statement to SKIP_GENERATION
   - When generating Expression, expand through Statement
   - Result: Expression directly handles Return, Import, Export

2. **Keep SimpleAssignable Skipped (Already Done)**
   - Continue inlining SimpleAssignable into Value
   - Accessor chains handled within parseValue

3. **Skip Complex Control Flow**
   - Keep For, While, Class in SKIP_GENERATION
   - These have complex dependencies and are less common

4. **Generate Simple Control Flow**
   - If, Try - simpler variants that can work
   - May need lookahead or inline

5. **Measure Progress**
   - Target: 40-50 functions (50-60% coverage)
   - Focus on common language features
   - Document what's not covered

**Why this approach:**
- ✅ Builds on Phase 5's inlining strategy (proven to work)
- ✅ Doesn't require complex graph algorithms
- ✅ Pragmatic - focuses on high-value targets
- ✅ Can always add more in Phase 8

---

## Implementation Steps

### Step 1: Analyze Current SKIP_GENERATION

```coffeescript
SKIP_GENERATION = [
  'Assignable',
  'SimpleAssignable',
  'ObjAssignable',
  'SimpleObjAssignable',
  'Operation',  # Special handling
  'Assign'      # Complex, skip for now
]
```

**Add to skip:**
```coffeescript
SKIP_GENERATION = [
  'Assignable',
  'SimpleAssignable',
  'ObjAssignable',
  'SimpleObjAssignable',
  'Operation',
  'Assign',
  'Statement',     # ← Inline into Expression
  'ExpressionLine', # ← Inline into Line/Expression
  'OperationLine',  # ← Inline into Line/Expression
  
  # Complex control flow - skip for now
  'For',
  'While',
  'Class',
  'Switch',  # Complex
]
```

### Step 2: Update Expression Generation

When generating Expression, expand through Statement to get Return, Import, Export directly:

```coffeescript
# In _generateSwitchFunction for Expression:
if nonTerminal is 'Expression'
  # Expand through Statement to inline its alternatives
  for rule in rules
    if rule.symbols[0] is 'Statement'
      # Don't call parseStatement - expand to Return/Import/Export
      statementRules = @types['Statement'].rules
      for statementRule in statementRules
        # Add Statement's alternatives to Expression's dispatch
        # ...
```

### Step 3: Generate If and Try

These are simpler control flow constructs that can work:

**If:**
```coffeescript
If: [
  o 'IF Expression Block'
  o 'IF Expression Block ELSE Block'
]
```

**Try:**
```coffeescript
Try: [
  o 'TRY Block Catch'
  o 'TRY Block Catch FINALLY Block'
]
```

Generate these normally - they call Expression but Expression is generated, so it works.

### Step 4: Test Coverage

After implementation, test what parses successfully:

**Should work:**
- ✅ Identifiers, numbers, strings
- ✅ Binary operations (`1 + 2 * 3`)
- ✅ Return statements (`return x`)
- ✅ If statements (`if x then y`)
- ✅ Try/catch (`try x catch e`)
- ✅ Arrays, objects (simple)
- ✅ Function calls (simple)

**Won't work (OK for now):**
- ❌ For loops
- ❌ While loops
- ❌ Class definitions
- ❌ Complex accessor chains with multiple levels
- ❌ Switch statements

### Step 5: Measure Success

**Target metrics:**
- Functions generated: 40-50 (50-60% of 86)
- File size: ~40-50KB (still 83-86% reduction)
- Common code coverage: 80%+ of typical CoffeeScript

---

## Testing Strategy

### Test Cases for Phase 7

After implementing Strategy A + D:

#### Test 1: Inline Statement Working
```bash
echo 'return 42' | ./bin/rip -s
# Expected: (program (return 42))

echo 'import "foo"' | ./bin/rip -s
# Expected: (program (import "foo"))
```

#### Test 2: If Statements
```bash
echo 'if x then y' | ./bin/rip -s
# Expected: (program (if x y))

echo 'if x then y else z' | ./bin/rip -s
# Expected: (program (if x y z))
```

#### Test 3: Try/Catch
```bash
echo 'try x catch e then y' | ./bin/rip -s
# Expected: (program (try x (catch e y)))
```

#### Test 4: Complex Expressions
```bash
echo 'x + y * z' | ./bin/rip -s
# Expected: (program (+ x (* y z)))

echo 'return x + y' | ./bin/rip -s
# Expected: (program (return (+ x y)))
```

#### Test 5: What Doesn't Work (Expected)
```bash
echo 'for x in arr then y' | ./bin/rip -s
# Expected: Error or fallback (For not generated)

echo 'while x then y' | ./bin/rip -s
# Expected: Error or fallback (While not generated)
```

---

## Implementation Checklist

### Phase 7 Tasks

**Preparation:**
- [ ] Add Statement to SKIP_GENERATION
- [ ] Add ExpressionLine, OperationLine to SKIP_GENERATION
- [ ] Add For, While, Class, Switch to SKIP_GENERATION

**Implementation:**
- [ ] Update _expandThroughSkippedNonterminal to handle Statement
- [ ] Ensure Expression inlines Statement alternatives
- [ ] Generate If, Try normally
- [ ] Test Return, Import, Export from Expression
- [ ] Verify no undefined function calls

**Testing:**
- [ ] Test return statements
- [ ] Test import/export statements
- [ ] Test if/else statements
- [ ] Test try/catch
- [ ] Test expressions with operators
- [ ] Verify file size reasonable (~40-50KB)

### Success Criteria

✅ **Expression inlines Statement** - Return/Import/Export work
✅ **No circular dependency errors** - All generated functions work
✅ **If and Try work** - Simple control flow parsing
✅ **File size reasonable** - 40-50KB (83-86% reduction)
✅ **Coverage improved** - 40-50 functions (50-60%)
✅ **Phase 1-6 still work** - No regressions

---

## Alternative: Hybrid Approach (Future)

If partial coverage isn't acceptable, consider a **hybrid parser**:

**Idea:** Use PRD parser for common cases, fall back to table parser for complex cases.

```javascript
parseExpression() {
  // Try PRD parser first
  if (this.canParsePRD(this.la.id)) {
    return this.parseExpressionPRD();
  }
  // Fall back to table parser for complex cases
  return this.parseExpressionTable();
}
```

**Benefits:**
- ✅ Best of both worlds - speed for common cases, completeness for edge cases
- ✅ Can incrementally migrate features to PRD

**Drawbacks:**
- ❌ More complex - two parsers in one file
- ❌ Larger file size - includes both
- ❌ May not be worth the complexity

**Recommendation:** Consider this for Phase 8 or beyond, not Phase 7.

---

## Expected Outcome

After Phase 7 implementation:

### File Size
- Phase 6: 31KB
- Phase 7: ~40-50KB (adding If, Try, more coverage)
- Still 83-86% reduction vs 294KB table

### Coverage
- Phase 6: 27 functions (31%)
- Phase 7: 40-50 functions (50-60%)
- Remaining: Complex control flow, classes, advanced features

### What Works
```bash
✅ Identifiers, literals, numbers
✅ Binary operations (all precedence levels)
✅ Return, yield
✅ Import, export
✅ If/else
✅ Try/catch/finally
✅ Arrays, objects (simple)
✅ Function calls (simple)
✅ Parenthetical expressions
```

### What Doesn't Work (Acceptable)
```bash
❌ For loops
❌ While loops
❌ Class definitions
❌ Switch statements
❌ Complex accessor chains
❌ List comprehensions
```

---

## Critical Reminders

**Before implementing:**
1. Review the inlining strategy from Phase 3 - same pattern applies
2. Focus on high-value targets (common language features)
3. Accept that 100% coverage may not be practical

**During implementation:**
1. Start with Statement inlining (highest value)
2. Add If and Try (moderate complexity)
3. Test incrementally - don't add everything at once

**Before committing:**
1. Verify no circular dependency errors
2. Test return, import, if statements work
3. Check file size is reasonable
4. Ensure Phase 1-6 still work

**If stuck:**
1. Show me the error message
2. Show me which function is calling undefined function
3. We can adjust the skip list

---

## Summary: What Phase 7 Accomplishes

**Before Phase 7:**
- ✅ Phases 1-6 working
- ❌ Statement ↔ Expression cycle blocks progress
- ❌ Can't generate If, Try, more features
- 🔢 31% coverage

**After Phase 7:**
- ✅ Phases 1-6 still working
- ✅ Statement inlined - cycle broken
- ✅ If, Try, more control flow working
- 🔢 50-60% coverage
- 📦 40-50KB file size (still 83-86% reduction)

**Phase 7 is pragmatic** - it accepts that 100% coverage may require the hybrid approach or table parser fallback. But 50-60% coverage of the most common language features is still a huge win!

---

**Good luck with Phase 7!** This is the last major conceptual challenge. Phase 8 will just be expansion. 🚀
