# PRD Parser - Phase 6 Implementation Plan

**Objective:** Implement operator precedence climbing for binary expressions

**Status:** Phase 5 complete. Lookahead disambiguation working. Ready for Phase 6.

---

## Context: What's Been Done (Phases 1-5)

### Current State ✅

**Phase 1-5 Achievements:**
- ✅ Oracle consultation (SLR(1) tables guide generation)
- ✅ Left-recursion → while loops
- ✅ Intermediate nonterminal inlining
- ✅ Multi-symbol action compilation (Phase 4)
- ✅ Lookahead disambiguation for TRUE ambiguity (Phase 5)
- ✅ Symbol constants and clean dispatch

**File Size:** 30KB (90% reduction from 294KB table)
**Functions:** 26 nonterminals generated
**Tests Passing:** Return, Yield, Line, Range all verified

### What Phase 5 Does NOT Handle ⚠️

**Binary operators with precedence:**

```coffeescript
# Current grammar has ~15 precedence levels!
Operation: [
  o 'Value'                          # Base case
  o 'Operation MATH Operation'       # + - * / % //
  o 'Operation ** Operation'         # Power (right-associative)
  o 'Operation SHIFT Operation'      # << >> >>>
  o 'Operation COMPARE Operation'    # < > <= >=
  o 'Operation & Operation'          # Bitwise AND
  o 'Operation ^ Operation'          # Bitwise XOR
  o 'Operation | Operation'          # Bitwise OR
  o 'Operation && Operation'         # Logical AND
  o 'Operation || Operation'         # Logical OR
  o 'Operation ?? Operation'         # Nullish coalescing
  # ... more operators
]
```

**Problem:** Generating separate parse functions for each precedence level would create 15+ functions and be very complex.

**Solution:** Use **precedence climbing algorithm** - a standard technique that handles all precedence levels in ONE function with a small precedence table.

**This is what Phase 6 implements.**

---

## Phase 6 Goal: Operator Precedence Climbing

### What is Precedence Climbing?

**Precedence climbing** is a well-known algorithm for parsing binary operators with different precedence levels and associativity rules.

**Key idea:** Instead of separate functions for each precedence level, use ONE recursive function with a precedence parameter.

**Example:**
```javascript
parseOperation(minPrec = 0) {
  let left = this.parseValue();  // Parse left operand
  
  // While we see operators at our precedence level or higher
  while (this.la && PREC[this.la.id] >= minPrec) {
    const op = this.la.id;
    const prec = PREC[op];
    this._match(op);
    
    // Right-associative: same precedence; Left-associative: higher precedence
    const nextPrec = prec + (ASSOC[op] === 'right' ? 0 : 1);
    const right = this.parseOperation(nextPrec);  // Recurse
    
    left = [op, left, right];  // Build AST node
  }
  
  return left;
}
```

**Result:** `1 + 2 * 3` parses as `(+ 1 (* 2 3))` because `*` has higher precedence than `+`.

---

## Implementation Strategy

### Step 1: Define Precedence Table

Create a precedence table mapping operator tokens to their precedence levels:

```coffeescript
OPERATOR_PRECEDENCE =
  # Lowest precedence (evaluated last)
  [SYM_OR]: 1           # ||
  [SYM_AND]: 2          # &&
  [SYM_NULLISH]: 3      # ??
  [SYM_BITOR]: 4        # |
  [SYM_BITXOR]: 5       # ^
  [SYM_BITAND]: 6       # &
  [SYM_COMPARE]: 7      # == != === !==
  [SYM_RELATION]: 8     # < > <= >= in of instanceof
  [SYM_SHIFT]: 9        # << >> >>>
  [SYM_PLUS]: 10        # + (binary)
  [SYM_MINUS]: 10       # - (binary)
  [SYM_MATH]: 11        # * / % //
  [SYM_POWER]: 12       # ** (highest precedence)
  # Unary operators handled separately in parseValue/parseUnary

OPERATOR_ASSOCIATIVITY =
  [SYM_POWER]: 'right'  # 2**3**4 = 2**(3**4)
  # All others default to 'left'
```

**Note:** These precedence levels come from JavaScript/CoffeeScript operator precedence rules.

### Step 2: Generate Precedence Climbing Function

Instead of generating `parseOperation()` with switch dispatch, generate a special precedence climbing function:

```coffeescript
_generateOperationFunction: ->
  """
  parseOperation(minPrec = 0) {
    let left = this.parseValue();
    
    while (this.la && this.la.id !== SYM_EOF) {
      const prec = OPERATOR_PRECEDENCE[this.la.id];
      if (prec === undefined || prec < minPrec) break;
      
      const op = this.la.id;
      const assoc = OPERATOR_ASSOCIATIVITY[op] || 'left';
      this._match(op);
      
      const nextPrec = prec + (assoc === 'right' ? 0 : 1);
      const right = this.parseOperation(nextPrec);
      
      left = [TOKEN_NAMES[op] || op, left, right];
    }
    
    return left;
  }
  """
```

### Step 3: Generate Precedence Tables in Output

The precedence table needs to be included in the generated parser:

```coffeescript
_generatePrecedenceTables: ->
  """
  // Operator precedence (higher = binds tighter)
  const OPERATOR_PRECEDENCE = {
    #{@_formatPrecedenceTable()}
  };
  
  const OPERATOR_ASSOCIATIVITY = {
    [SYM_POWER]: 'right',  // 2**3**4 = 2**(3**4)
    // All others are left-associative by default
  };
  """

_formatPrecedenceTable: ->
  lines = []
  for op, prec in OPERATOR_PRECEDENCE
    constName = @_getSymbolConstName(op)
    lines.push "    [#{constName}]: #{prec},"
  lines.join('\n')
```

### Step 4: Skip Operation in Normal Generation

Add `Operation` to the skip list so it doesn't generate via normal switch dispatch:

```coffeescript
SKIP_GENERATION = [
  'Assignable', 'SimpleAssignable', 'ObjAssignable',
  'Operation',  # ← Add this - handled specially
  'Assign'      # Also complex, skip for now
]
```

### Step 5: Integrate with Expression

When `Expression` calls `Operation`, it should use the precedence climbing function:

```coffeescript
# In the grammar, Expression has an alternative for Operation
# The generated code should call parseOperation(0) to start at lowest precedence

case SYM_IDENTIFIER: case SYM_NUMBER: /* ... */:
  return this.parseOperation(0);  // Start at precedence 0
```

---

## Concrete Examples

### Example 1: Simple Addition

**Input:** `1 + 2`

**Parse trace:**
```
parseOperation(0)
  left = parseValue() → 1
  see PLUS (prec=10 >= 0) ✓
  match PLUS
  right = parseOperation(11) → parseValue() → 2
  left = ['+', 1, 2]
  no more operators
  return ['+', 1, 2]
```

**Result:** `(+ 1 2)` ✅

### Example 2: Precedence

**Input:** `1 + 2 * 3`

**Parse trace:**
```
parseOperation(0)
  left = parseValue() → 1
  see PLUS (prec=10 >= 0) ✓
  match PLUS
  right = parseOperation(11)
    left = parseValue() → 2
    see MATH (*) (prec=11 >= 11) ✓
    match MATH
    right = parseOperation(12) → parseValue() → 3
    left = ['*', 2, 3]
    no more operators (PLUS prec=10 < 11)
    return ['*', 2, 3]
  left = ['+', 1, ['*', 2, 3]]
  no more operators
  return ['+', 1, ['*', 2, 3]]
```

**Result:** `(+ 1 (* 2 3))` ✅

**Correct!** `*` has higher precedence than `+`, so `2 * 3` is evaluated first.

### Example 3: Right Associativity

**Input:** `2 ** 3 ** 4`

**Parse trace:**
```
parseOperation(0)
  left = 2
  see POWER (prec=12)
  match POWER
  right = parseOperation(12)  // Note: same precedence for right-assoc!
    left = 3
    see POWER (prec=12 >= 12) ✓
    match POWER
    right = parseOperation(12) → 4
    return ['**', 3, 4]
  return ['**', 2, ['**', 3, 4]]
```

**Result:** `(** 2 (** 3 4))` ✅

**Correct!** Right-associative, so `3 ** 4` is evaluated first, then `2 ** result`.

### Example 4: Mixed Operators

**Input:** `a && b || c`

**Parse trace:**
```
parseOperation(0)
  left = a
  see AND (prec=2)
  right = parseOperation(3)
    left = b
    see OR (prec=1 < 3) ✗
    return b
  left = ['&&', a, b]
  see OR (prec=1 < 2) ✗... wait, 1 >= 0 ✓
  match OR
  right = parseOperation(2) → c
  return ['||', ['&&', a, b], c]
```

**Result:** `(|| (&& a b) c)` ✅

**Correct!** `&&` has higher precedence than `||`.

---

## Testing Strategy

### Test Cases for Phase 6

After implementing precedence climbing:

#### Test 1: Simple Arithmetic
```bash
echo '1 + 2' | ./bin/rip -s
# Expected: (program (+ 1 2))
```

#### Test 2: Precedence
```bash
echo '1 + 2 * 3' | ./bin/rip -s
# Expected: (program (+ 1 (* 2 3)))

echo '2 * 3 + 4' | ./bin/rip -s
# Expected: (program (+ (* 2 3) 4))
```

#### Test 3: Right Associativity
```bash
echo '2 ** 3 ** 4' | ./bin/rip -s
# Expected: (program (** 2 (** 3 4)))
```

#### Test 4: Parentheses
```bash
echo '(1 + 2) * 3' | ./bin/rip -s
# Expected: (program (* (+ 1 2) 3))
```

#### Test 5: Multiple Operators
```bash
echo 'a && b || c' | ./bin/rip -s
# Expected: (program (|| (&& a b) c))
```

#### Test 6: Comparison with Table Mode
```bash
# For each test above
echo '1 + 2 * 3' | ./bin/rip -s > /tmp/table.txt
cp parser-prd.js src/parser.js
echo '1 + 2 * 3' | ./bin/rip -s > /tmp/prd.txt
diff /tmp/table.txt /tmp/prd.txt  # Should be empty
```

---

## Implementation Checklist

### Phase 6 Tasks

**Preparation:**
- [ ] Define `OPERATOR_PRECEDENCE` table with all operator tokens
- [ ] Define `OPERATOR_ASSOCIATIVITY` table (just POWER for now)
- [ ] Add `Operation` to `SKIP_GENERATION` list

**Implementation:**
- [ ] Implement `_generatePrecedenceTables()` to output tables
- [ ] Implement `_generateOperationFunction()` with climbing algorithm
- [ ] Modify `_generateParseFunctions()` to call special handler for Operation
- [ ] Ensure `parseValue()` calls `parseOperation(0)` where needed

**Testing:**
- [ ] Test simple arithmetic (`1 + 2`)
- [ ] Test precedence (`1 + 2 * 3`)
- [ ] Test right associativity (`2 ** 3 ** 4`)
- [ ] Test mixed operators (`a && b || c`)
- [ ] Compare with table mode (must be identical)

### Success Criteria

✅ **Precedence climbing function generated** with while loop
✅ **Precedence table included** in output
✅ **Operators parse correctly** with proper precedence
✅ **Right associativity works** for power operator
✅ **Output identical to table mode** for all test cases
✅ **File size reasonable** (shouldn't add much - just one function)
✅ **Phase 1-5 still work** (no regressions)

---

## Files to Modify

### Primary File: `src/grammar/solar.rip`

**Functions to add:**

1. **Define precedence tables at top of file**
   ```coffeescript
   OPERATOR_PRECEDENCE =
     [SYMBOL_IDS['||']]: 1
     [SYMBOL_IDS['&&']]: 2
     # ... etc
   ```

2. **`_generatePrecedenceTables()`**
   - Generate OPERATOR_PRECEDENCE object
   - Generate OPERATOR_ASSOCIATIVITY object
   - Returns string for insertion in parser

3. **`_generateOperationFunction()`**
   - Generate parseOperation(minPrec) function
   - Implements precedence climbing algorithm
   - Returns complete function as string

**Functions to modify:**

1. **`_generateParseFunctions()` - ADD SPECIAL CASE**
   - Check if `nonTerminal is 'Operation'`
   - If yes, call `_generateOperationFunction()`
   - Otherwise, use normal generation

2. **`_generatePRD()` - ADD TABLES**
   - After symbol constants, add precedence tables
   - Call `_generatePrecedenceTables()`

3. **Update `SKIP_GENERATION`**
   - Add `'Operation'` to the list

---

## Edge Cases to Handle

### 1. Unary Operators

Unary operators (`-x`, `+x`, `!x`) are NOT handled by precedence climbing. They should be handled in `parseValue()` or a separate `parseUnary()` function.

**For Phase 6:** Assume unary operators are already handled elsewhere. Focus only on binary operators.

### 2. Ternary Operator

The ternary operator (`a ? b : c`) is also special and not handled by precedence climbing.

**For Phase 6:** Skip ternary for now. Can be added in Phase 7/8.

### 3. Assignment Operators

Assignment (`=`, `+=`, etc.) has special semantics (right-to-left evaluation).

**For Phase 6:** Skip assignment for now. Already in `SKIP_GENERATION`.

### 4. Non-Operator Tokens

If `parseOperation()` sees a token that's not in the precedence table, it should break out of the loop and return `left`.

```javascript
const prec = OPERATOR_PRECEDENCE[this.la.id];
if (prec === undefined || prec < minPrec) break;  // ✅ Handle gracefully
```

---

## Common Pitfalls to Avoid

### ❌ Don't Use Separate Functions for Each Precedence Level

**Wrong approach:**
```javascript
parseAdditive() { /* handle + - */ }
parseMultiplicative() { /* handle * / */ }
parsePower() { /* handle ** */ }
// ... 15 functions!
```

**Right approach:**
```javascript
parseOperation(minPrec) { /* handle all operators with precedence */ }
// ONE function!
```

### ❌ Don't Forget Right Associativity for Power

```javascript
// Wrong
const nextPrec = prec + 1;  // Always left-associative

// Right
const nextPrec = prec + (assoc === 'right' ? 0 : 1);
```

### ❌ Don't Hard-Code Operator Names

```javascript
// Wrong
left = ['+', left, right];  // Hard-coded string

// Right
left = [TOKEN_NAMES[op] || op, left, right];  // Use token name from table
```

### ❌ Don't Forget to Check for EOF

```javascript
while (this.la && this.la.id !== SYM_EOF) {  // ✅ Check both
  const prec = OPERATOR_PRECEDENCE[this.la.id];
  // ...
}
```

---

## Expected Outcome

After Phase 6 implementation:

### File Size
- Phase 5: 30KB
- Phase 6: ~32-35KB (adds one function + small tables)
- Still 88-89% reduction vs 300KB table

### Coverage
- Same 26 functions as Phase 5
- Plus 1 new: `parseOperation(minPrec)`
- Operation now works for expressions!

### Generated Code Quality
```javascript
// Precedence tables (compact)
const OPERATOR_PRECEDENCE = {
  [SYM_OR]: 1,
  [SYM_AND]: 2,
  // ... ~15 lines
};

const OPERATOR_ASSOCIATIVITY = {
  [SYM_POWER]: 'right',
};

// Precedence climbing function (elegant, ~20 lines)
parseOperation(minPrec = 0) {
  let left = this.parseValue();
  
  while (this.la && this.la.id !== SYM_EOF) {
    const prec = OPERATOR_PRECEDENCE[this.la.id];
    if (prec === undefined || prec < minPrec) break;
    
    const op = this.la.id;
    const assoc = OPERATOR_ASSOCIATIVITY[op] || 'left';
    this._match(op);
    
    const nextPrec = prec + (assoc === 'right' ? 0 : 1);
    const right = this.parseOperation(nextPrec);
    
    left = [TOKEN_NAMES[op] || op, left, right];
  }
  
  return left;
}
```

**Clean, compact, elegant!** ✨

---

## Phase 7 Preview (After Phase 6)

Once Phase 6 is complete, Phase 7 will focus on **resolving circular dependencies** between nonterminals like Expression ↔ For ↔ Statement.

This may involve:
- Careful ordering of function generation
- Forward declarations or stubs
- Breaking cycles by inlining certain nonterminals
- Or accepting that some nonterminals can't be generated and must be skipped

But **don't think about this yet** - focus on Phase 6!

---

## Critical Reminders

**Before implementing:**
1. Review precedence climbing algorithm (it's standard, not invented here)
2. Define precedence table carefully (match CoffeeScript/JS precedence)
3. Remember: only BINARY operators - unary handled separately

**During implementation:**
1. Generate tables first, then function
2. Test with simple cases (`1 + 2`) before complex
3. Verify right-associativity works for power

**Before committing:**
1. Test all examples from this plan
2. Compare with table mode output (must match exactly)
3. Check file size (should be ~32-35KB)
4. Verify Phase 1-5 still work

**If stuck:**
1. Show me the generated `parseOperation()` function
2. Show me the precedence tables
3. Show me test output vs expected

---

## Summary: What Phase 6 Accomplishes

**Before Phase 6:**
- ✅ Phases 1-5 working (lookahead, multi-symbol, left-recursion)
- ❌ Binary operators not handled (Operation skipped)
- ❌ Can't parse `1 + 2 * 3` correctly

**After Phase 6:**
- ✅ Phases 1-5 still working
- ✅ Binary operators use precedence climbing
- ✅ Can parse `1 + 2 * 3` → `(+ 1 (* 2 3))` correctly
- ✅ Right-associativity works (`2**3**4`)
- ✅ All precedence levels in ONE function
- ✅ File size stays small (~32-35KB)

**Phase 6 is simpler than Phase 5** - it's a well-known algorithm with no ambiguity issues. Just implement the climbing algorithm and it should work!

---

**Good luck with Phase 6!** This will unlock expression parsing. 🚀
