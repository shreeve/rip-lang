# PRD Parser - Phase 5 Implementation Plan

**Objective:** Implement lookahead disambiguation for rules with ambiguous FIRST sets

**Status:** Phase 4 complete. Multi-symbol actions working. Ready for Phase 5.

---

## Context: What's Been Done (Phases 1-4)

### Current State ✅

**Working Features:**
- ✅ Oracle consultation (SLR(1) tables guide generation)
- ✅ Left-recursion → while loops with FOLLOW termination
- ✅ Intermediate nonterminal inlining (breaks circular dependencies)
- ✅ Multi-symbol action compilation (Phase 4) ⭐
- ✅ Symbol constants generation
- ✅ Clean switch/case dispatch
- ✅ Token metadata preservation
- ✅ Block scoping for multi-statement cases

**Phase 4 Achievement:**
```javascript
parseRange() {
  this._match(75);                    // Position 1 - not captured
  const tok2 = this.parseExpression(); // Position 2 - captured ✅
  const tok3 = this.parseRangeDots();  // Position 3 - captured ✅
  const tok4 = this.parseExpression(); // Position 4 - captured ✅
  this._match(76);                    // Position 5 - not captured
  return [tok3, tok2, tok4];          // ✅ Perfect!
}
```

**File Sizes:**
- Table-driven: 300KB
- PRD (partial): 20KB
- **Reduction: 93%**

**Functions Generated:** 26/86 nonterminals

### What Doesn't Work Yet ⚠️

**Ambiguous FIRST sets cause issues:**

```coffeescript
Return: [
  o 'RETURN Expression'            # FIRST = {RETURN}
  o 'RETURN INDENT Object OUTDENT' # FIRST = {RETURN}
  o 'RETURN'                       # FIRST = {RETURN}
]
```

**All three rules start with RETURN!** The oracle can't distinguish them based on the first token alone.

**Current behavior (WRONG):**
```javascript
parseReturn() {
  this._match(SYM_RETURN);
  // ❌ Which rule? Oracle can't tell - just picks first one
  const tok2 = this.parseExpression();
  return ["return", tok2];
}
```

**This is what Phase 5 fixes!**

---

## Phase 5 Goal: Lookahead Disambiguation

### What to Implement

When multiple rules for a nonterminal have the **same FIRST token**, use **lookahead** (peek at the second token) to determine which rule to apply.

### Key Insight

**FIRST sets tell us the first token, but sometimes we need the second:**

```
Rule 1: RETURN Expression
        ^      ^
        |      └─ Second token: any Expression FIRST token
        └──────── First token: RETURN

Rule 2: RETURN INDENT Object OUTDENT
        ^      ^
        |      └─ Second token: INDENT
        └──────── First token: RETURN

Rule 3: RETURN
        ^
        └──────── First token: RETURN (no second token)
```

**Solution:** After matching RETURN, **peek** at the next token to decide which rule.

---

## Implementation Strategy

### Step 1: Detect Ambiguous FIRST Sets

In `_generateSwitchFunction()`, detect when multiple rules share the same FIRST token:

```coffeescript
_generateSwitchFunction: (nonTerminal, rules) ->
  # Build dispatch map
  dispatchMap = {}
  for rule in rules
    firstTokens = @_getFirstTokens(rule)
    for tokenId in firstTokens
      dispatchMap[tokenId] ?= []
      dispatchMap[tokenId].push(rule)
  
  # Check for ambiguity
  for own tokenId, rulesForToken of dispatchMap
    if rulesForToken.length > 1
      # AMBIGUOUS! Need lookahead
      @_generateLookaheadDisambiguation(tokenId, rulesForToken)
    else
      # Normal case - single rule
      @_generateNormalCase(tokenId, rulesForToken[0])
```

### Step 2: Generate Lookahead Disambiguation

For ambiguous cases, generate if/else chains that peek at the second token:

```coffeescript
_generateLookaheadDisambiguation: (firstToken, rules) ->
  lines = []
  
  # Generate the case label
  lines.push "case #{@_getSymbolConstName(firstToken)}: {"
  
  # Match the first token (common to all rules)
  lines.push "  #{@_generateMatchStatement(firstToken)};"
  
  # Peek at next token to disambiguate
  lines.push "  const next = this._peek();"
  
  # Generate if/else chain
  for rule, i in rules
    secondTokens = @_getSecondTokens(rule)
    
    if i == 0
      lines.push "  if (#{@_generatePeekCondition(secondTokens)}) {"
    else if i == rules.length - 1
      lines.push "  } else {"
    else
      lines.push "  } else if (#{@_generatePeekCondition(secondTokens)}) {"
    
    # Generate parsing code for this rule
    lines.push @_generateRuleBody(rule, startPosition: 2)  # Start at position 2 (first already matched)
    lines.push "  }"
  
  lines.push "}"
  lines.join('\n')
```

### Step 3: Get Second Tokens

Determine what the second token could be for each rule:

```coffeescript
_getSecondTokens: (rule) ->
  return null if rule.symbols.length <= 1  # No second token
  
  secondSymbol = rule.symbols[1]
  
  if @types[secondSymbol]
    # Nonterminal - get its FIRST set
    Array.from(@types[secondSymbol].firsts)
  else
    # Terminal - use directly
    [@symbolIds[secondSymbol]]
```

### Step 4: Generate Peek Conditions

Create the condition that checks if the peeked token matches:

```coffeescript
_generatePeekCondition: (tokenIds) ->
  return "true" unless tokenIds  # Empty rule - matches anything
  
  if tokenIds.length == 1
    "next === #{tokenIds[0]}"
  else
    # Multiple possible tokens
    conditions = tokenIds.map (id) -> "next === #{id}"
    "(#{conditions.join(' || ')})"
```

### Step 5: Generate Rule Body Starting at Position N

When the first token is already matched, generate the rest:

```coffeescript
_generateRuleBody: (rule, options = {}) ->
  startPosition = options.startPosition ? 1
  symbols = rule.symbols[startPosition - 1..]  # Remaining symbols
  
  # Same logic as _compileMultiSymbolAction, but starting at startPosition
  # ... (use existing multi-symbol action compilation)
```

---

## Concrete Examples

### Example 1: Return Statement (3 Rules)

**Grammar:**
```coffeescript
Return: [
  o 'RETURN Expression', '["return", 2]'
  o 'RETURN INDENT Object OUTDENT', '["return", 3]'
  o 'RETURN', '["return"]'
]
```

**Analysis:**
- All start with RETURN (FIRST = {RETURN})
- Rule 1: Second tokens = FIRST(Expression) = {IDENTIFIER, NUMBER, STRING, ...}
- Rule 2: Second token = INDENT
- Rule 3: No second token = EOF, TERMINATOR, OUTDENT, etc.

**Should Generate:**
```javascript
parseReturn() {
  switch (this.la.id) {
  case SYM_RETURN: {
    this._match(SYM_RETURN);          // Match first token
    const next = this._peek();        // Peek at second token
    
    if (next === SYM_INDENT) {
      // Rule 2: RETURN INDENT Object OUTDENT
      this._match(SYM_INDENT);
      const tok3 = this.parseObject();
      this._match(SYM_OUTDENT);
      return ["return", tok3];
    } else if (next === SYM_EOF || next === SYM_TERMINATOR || next === SYM_OUTDENT) {
      // Rule 3: RETURN (empty)
      return ["return"];
    } else {
      // Rule 1: RETURN Expression
      const tok2 = this.parseExpression();
      return ["return", tok2];
    }
  }
  default: this._error([SYM_RETURN], this.la.id);
  }
}
```

**Key Points:**
- ✅ First token (RETURN) matched before peeking
- ✅ Peek distinguishes the three cases
- ✅ Each branch generates appropriate parsing code
- ✅ Most specific checks first (INDENT), most general last (Expression)

### Example 2: Yield Expression (2 Rules)

**Grammar:**
```coffeescript
Yield: [
  o 'YIELD FROM Expression', '["yield-from", 3]'
  o 'YIELD Expression', '["yield", 2]'
]
```

**Analysis:**
- Both start with YIELD
- Rule 1: Second token = FROM
- Rule 2: Second tokens = FIRST(Expression)

**Should Generate:**
```javascript
parseYield() {
  switch (this.la.id) {
  case SYM_YIELD: {
    this._match(SYM_YIELD);           // Match first token
    const next = this._peek();        // Peek at second token
    
    if (next === SYM_FROM) {
      // Rule 1: YIELD FROM Expression
      this._match(SYM_FROM);
      const tok3 = this.parseExpression();
      return ["yield-from", tok3];
    } else {
      // Rule 2: YIELD Expression
      const tok2 = this.parseExpression();
      return ["yield", tok2];
    }
  }
  default: this._error([SYM_YIELD], this.la.id);
  }
}
```

### Example 3: Import Statement (Multiple Rules)

**Grammar:**
```coffeescript
Import: [
  o 'IMPORT ImportDefaultSpecifier FROM String', '["import", 2, 4]'
  o 'IMPORT ImportNamespaceSpecifier FROM String', '["import", 2, 4]'
  o 'IMPORT ImportSpecifierList FROM String', '["import", 2, 4]'
  o 'IMPORT String', '["import", 2]'
]
```

**Analysis:**
- All start with IMPORT
- Rule 1: Second = ImportDefaultSpecifier FIRST = {IDENTIFIER}
- Rule 2: Second = ImportNamespaceSpecifier FIRST = {IMPORT_ALL}
- Rule 3: Second = ImportSpecifierList FIRST = {LBRACE}
- Rule 4: Second = String FIRST = {STRING, STRING_START}

**Should Generate:**
```javascript
parseImport() {
  switch (this.la.id) {
  case SYM_IMPORT: {
    this._match(SYM_IMPORT);
    const next = this._peek();
    
    if (next === SYM_IMPORT_ALL) {
      // Rule 2: ImportNamespaceSpecifier
      const tok2 = this.parseImportNamespaceSpecifier();
      this._match(SYM_FROM);
      const tok4 = this.parseString();
      return ["import", tok2, tok4];
    } else if (next === SYM_LBRACE) {
      // Rule 3: ImportSpecifierList
      const tok2 = this.parseImportSpecifierList();
      this._match(SYM_FROM);
      const tok4 = this.parseString();
      return ["import", tok2, tok4];
    } else if (next === SYM_STRING || next === SYM_STRING_START) {
      // Rule 4: Just string
      const tok2 = this.parseString();
      return ["import", tok2];
    } else {
      // Rule 1: ImportDefaultSpecifier (IDENTIFIER)
      const tok2 = this.parseImportDefaultSpecifier();
      this._match(SYM_FROM);
      const tok4 = this.parseString();
      return ["import", tok2, tok4];
    }
  }
  default: this._error([SYM_IMPORT], this.la.id);
  }
}
```

---

## Ordering Rules in If/Else Chain

### Priority Order (Most Specific → Most General)

1. **Single terminal tokens** (most specific)
   - `next === SYM_INDENT`
   - `next === SYM_FROM`

2. **Small FIRST sets** (2-3 tokens)
   - `next === SYM_STRING || next === SYM_STRING_START`

3. **Negative conditions** (EOF, TERMINATOR, etc.)
   - `next === SYM_EOF || next === SYM_TERMINATOR`

4. **Large FIRST sets** (many tokens - most general)
   - Expression FIRST = 40+ tokens
   - Put this last as the "else" catch-all

### Algorithm for Ordering

```coffeescript
_orderRulesForDisambiguation: (rules) ->
  # Sort by specificity of second token
  rules.sort (a, b) ->
    aTokens = @_getSecondTokens(a)
    bTokens = @_getSecondTokens(b)
    
    # Empty rules (no second token) → most specific
    return -1 if !aTokens and bTokens
    return 1 if aTokens and !bTokens
    
    # Fewer tokens = more specific
    return aTokens.length - bTokens.length if aTokens and bTokens
    
    return 0
```

---

## Testing Strategy

### Test Cases for Phase 5

After implementing lookahead disambiguation:

#### Test 1: Empty Return
```bash
echo 'return' | ./bin/rip -s
```
**Expected:** `(program (return))`

#### Test 2: Return with Expression
```bash
echo 'return 42' | ./bin/rip -s
```
**Expected:** `(program (return 42))`

#### Test 3: Return with Object
```bash
echo 'return
  x: 1' | ./bin/rip -s
```
**Expected:** `(program (return (object (: x 1))))`

#### Test 4: Yield
```bash
echo 'yield x' | ./bin/rip -s
```
**Expected:** `(program (yield x))`

#### Test 5: Yield From
```bash
echo 'yield from arr' | ./bin/rip -s
```
**Expected:** `(program (yield-from arr))`

#### Test 6: Import Variants
```bash
echo 'import "foo"' | ./bin/rip -s
echo 'import x from "foo"' | ./bin/rip -s
echo 'import * as y from "foo"' | ./bin/rip -s
echo 'import {a, b} from "foo"' | ./bin/rip -s
```

#### Test 7: Compare with Table Mode
```bash
# For each test above
echo 'return 42' | ./bin/rip -s > /tmp/table.txt
cp parser-prd.js src/parser.js
echo 'return 42' | ./bin/rip -s > /tmp/prd.txt
diff /tmp/table.txt /tmp/prd.txt  # Should be empty
```

---

## Implementation Checklist

### Phase 5 Tasks

- [ ] Detect ambiguous FIRST sets (multiple rules per token)
- [ ] Implement `_getSecondTokens(rule)` to get lookahead tokens
- [ ] Implement `_generatePeekCondition(tokenIds)` for if/else conditions
- [ ] Implement `_generateLookaheadDisambiguation()` for if/else chains
- [ ] Implement `_orderRulesForDisambiguation()` for specificity ordering
- [ ] Modify `_generateSwitchFunction()` to dispatch to lookahead when needed
- [ ] Handle empty rules (no second token) correctly
- [ ] Handle EOF/TERMINATOR in FOLLOW sets
- [ ] Test with Return (3 rules)
- [ ] Test with Yield (2 rules)
- [ ] Test with Import (4 rules)
- [ ] Compare output with table mode (must be identical)

### Success Criteria

✅ **Return statement works** with all 3 variants (empty, expression, object)
✅ **Yield works** with both variants (yield, yield-from)
✅ **Import works** with all 4 variants
✅ **Output identical to table mode** for all tested cases
✅ **No regressions** - Phase 1-4 tests still pass
✅ **Peek logic is correct** - doesn't consume tokens

---

## Files to Modify

### Primary File: `src/grammar/solar.rip`

**Functions to add:**

1. **`_getSecondTokens(rule)`**
   - Get FIRST set of second symbol in rule
   - Return null if rule has only 1 symbol
   - Handle both terminals and nonterminals

2. **`_generatePeekCondition(tokenIds)`**
   - Generate condition like `next === SYM_INDENT`
   - Handle multiple tokens with OR conditions
   - Handle null (empty rule case)

3. **`_orderRulesForDisambiguation(rules)`**
   - Sort by specificity (fewer tokens = more specific)
   - Put empty rules first
   - Put large FIRST sets last

4. **`_generateLookaheadDisambiguation(firstToken, rules)`**
   - Generate if/else chain with peek logic
   - Match first token before peeking
   - Call `_generateRuleBody()` for each branch

5. **`_generateRuleBody(rule, options)`**
   - Generate parsing code starting at arbitrary position
   - Reuse multi-symbol action compilation from Phase 4
   - Handle `startPosition` option

**Functions to modify:**

1. **`_generateSwitchFunction(nonTerminal, rules)` - MODIFY**
   - Detect when `dispatchMap[tokenId].length > 1` (ambiguous)
   - Call `_generateLookaheadDisambiguation()` for ambiguous cases
   - Keep existing logic for unambiguous cases

---

## Edge Cases to Handle

### 1. Empty Rule as One Alternative

```coffeescript
Return: [
  o 'RETURN Expression'
  o 'RETURN'              # ← Empty (no second token)
]
```

**Handle by checking FOLLOW set:**
```javascript
if (next === SYM_EOF || next === SYM_TERMINATOR || next === SYM_OUTDENT) {
  return ["return"];  // Empty rule
}
```

### 2. All Alternatives Have Same Second Token

```coffeescript
Foo: [
  o 'BAR Identifier Expression'
  o 'BAR Identifier Block'
]
```

**Both have Identifier as second token → need THIRD token lookahead!**

**Solution:** Not implemented in Phase 5. For now, just pick first rule. Document as limitation.

### 3. Overlapping Second Token FIRST Sets

```coffeescript
Foo: [
  o 'BAR Value'       # FIRST(Value) = {IDENTIFIER, NUMBER, ...}
  o 'BAR Identifier'  # FIRST = {IDENTIFIER}
]
```

**IDENTIFIER is in both FIRST sets!**

**Solution:** Order more specific rule first (Identifier before Value).

### 4. Optional Tokens

```coffeescript
Foo: [
  o 'BAR Identifier'
  o 'BAR'
]
```

**Second rule has no second token → check FOLLOW(Foo)**

---

## Common Pitfalls to Avoid

### ❌ Don't Consume the Peeked Token

**Wrong:**
```javascript
const next = this._advance();  // ❌ Consumes token!
if (next.id === SYM_INDENT) {
  // Now INDENT is gone!
}
```

**Right:**
```javascript
const next = this._peek();  // ✅ Just looks, doesn't consume
if (next === SYM_INDENT) {
  this._match(SYM_INDENT);  // Now consume it
}
```

### ❌ Don't Match First Token Multiple Times

**Wrong:**
```javascript
case SYM_RETURN: {
  const next = this._peek();
  if (next === SYM_INDENT) {
    this._match(SYM_RETURN);  // ❌ Already matched in case!
    this._match(SYM_INDENT);
  }
}
```

**Right:**
```javascript
case SYM_RETURN: {
  this._match(SYM_RETURN);  // Match once before peek
  const next = this._peek();
  if (next === SYM_INDENT) {
    this._match(SYM_INDENT);  // ✅ Just match second token
  }
}
```

### ❌ Don't Forget to Order by Specificity

**Wrong:**
```javascript
if (/* Expression tokens - 40+ */) {
  // Rule 1
} else if (next === SYM_INDENT) {  // ❌ Never reached!
  // Rule 2
}
```

**Right:**
```javascript
if (next === SYM_INDENT) {  // ✅ Specific first
  // Rule 2
} else {
  // Rule 1 - general case
}
```

### ❌ Don't Assume Second Token Exists

**Wrong:**
```javascript
const secondSymbol = rule.symbols[1];  // ❌ Might not exist!
const secondTokens = @types[secondSymbol].firsts;
```

**Right:**
```javascript
if (rule.symbols.length <= 1) return null;  // ✅ Check length
const secondSymbol = rule.symbols[1];
```

---

## Expected Outcome

After Phase 5 implementation:

### File Size
- Current: 20KB (26 functions, no lookahead)
- After Phase 5: ~25-30KB (30-40 functions with lookahead)
- Final target: ~40-50KB (all 86 functions)

### Coverage
- Current: 26/86 nonterminals (30%)
- After Phase 5: ~35-45/86 (40-50%)
- Unlocked: Return, Yield, Import, Export, and others

### Test Coverage
```bash
✅ 'x' → (program x)
✅ 'x; y; z' → (program x y z)
✅ '42' → (program 42)
✅ 'return' → (program (return))  # NEW!
✅ 'return 42' → (program (return 42))  # NEW!
✅ 'yield x' → (program (yield x))  # NEW!
✅ 'yield from arr' → (program (yield-from arr))  # NEW!
✅ 'import "x"' → (program (import "x"))  # NEW!
```

---

## Phase 6 Preview (After Phase 5)

Once Phase 5 is complete, Phase 6 will implement **operator precedence climbing** to handle expressions:

```javascript
const PREC = {
  [SYM_PLUS]: 11,
  [SYM_MINUS]: 11,
  [SYM_TIMES]: 12,
  [SYM_DIVIDE]: 12,
  [SYM_POWER]: 14
};

const ASSOC = {
  [SYM_PLUS]: 'left',
  [SYM_POWER]: 'right'
};

parseOperation(minPrec = 0) {
  let left = this.parseValue();
  while (this.la && PREC[this.la.id] >= minPrec) {
    const op = this.la.id;
    const prec = PREC[op];
    this._match(op);
    const nextPrec = prec + (ASSOC[op] === 'right' ? 0 : 1);
    const right = this.parseOperation(nextPrec);
    left = [op, left, right];
  }
  return left;
}
```

But **don't implement this in Phase 5** - focus only on lookahead disambiguation!

---

## Summary: What Phase 5 Accomplishes

**Before Phase 5:**
- ✅ Single-rule nonterminals work
- ✅ Multi-symbol actions work (Phase 4)
- ❌ Ambiguous FIRST sets broken (picks first rule blindly)

**After Phase 5:**
- ✅ Single-rule nonterminals still work
- ✅ Multi-symbol actions still work
- ✅ Ambiguous FIRST sets use lookahead to disambiguate
- ✅ Return works (3 variants)
- ✅ Yield works (2 variants)
- ✅ Import works (4 variants)
- ✅ Output identical to table mode

**Phase 5 unlocks statement parsing** - a major step toward complete grammar coverage.

---

## Getting Started

### 1. Verify Current State Works
```bash
bun src/grammar/solar.rip -r -o parser-prd.js src/grammar/grammar.rip
# Verify Phase 4 is still working
```

### 2. Implement Phase 5 Functions
Add the functions described above to `solar.rip`:
- `_getSecondTokens()`
- `_generatePeekCondition()`
- `_orderRulesForDisambiguation()`
- `_generateLookaheadDisambiguation()`
- `_generateRuleBody()`
- Modify `_generateSwitchFunction()`

### 3. Test Incrementally
Start with simple 2-rule cases (Yield), then 3-rule (Return), then 4+ (Import).

### 4. Compare with Table Mode
For every test, verify PRD output matches table mode exactly.

---

## Questions to Ask If You Get Stuck

1. **"Am I correctly detecting when FIRST sets are ambiguous?"**
   - Check if `dispatchMap[tokenId].length > 1`

2. **"Am I ordering rules by specificity correctly?"**
   - Single terminals first, large FIRST sets last

3. **"Is my peek logic consuming tokens?"**
   - Should use `_peek()`, not `_advance()`

4. **"Are my second token FIRST sets correct?"**
   - Add debug logging to verify

5. **"Does my generated code match the examples?"**
   - Compare with the Return/Yield/Import examples above

---

## Success! How to Know Phase 5 is Complete

✅ **All these tests pass:**
```bash
echo 'return' | ./bin/rip -s          # Empty return
echo 'return 42' | ./bin/rip -s       # Return with expression
echo 'yield x' | ./bin/rip -s         # Yield
echo 'yield from arr' | ./bin/rip -s  # Yield from
echo 'import "x"' | ./bin/rip -s      # Import
```

✅ **Output identical to table mode** for all tested inputs

✅ **Generated code looks like the examples** in this document

✅ **No regressions** in Phase 1-4 functionality

When all these are true, **Phase 5 is complete!** 🎉

---

## Reference: Key Patterns from Phase 4

### Multi-Symbol Action (from Phase 4)
```javascript
parseRange() {
  this._match(75);                    // Position 1
  const tok2 = this.parseExpression(); // Position 2
  const tok3 = this.parseRangeDots();  // Position 3
  const tok4 = this.parseExpression(); // Position 4
  this._match(76);                    // Position 5
  return [tok3, tok2, tok4];
}
```

### Block Scoping (from Phase 4)
```javascript
case SYM_SUPER: {
  const tok2 = this.parseArguments();
  return ["super", ...tok2];
}
```

**Phase 5 builds on these patterns by adding if/else chains inside the blocks!**

---

**Good luck with Phase 5!** This will unlock statement parsing and bring you much closer to full coverage. 🚀
