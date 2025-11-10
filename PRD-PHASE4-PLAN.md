# PRD Parser - Phase 4 Implementation Plan

**Objective:** Implement multi-symbol action compilation to handle complex grammar rules

**Status:** Phases 1-3 complete. Core patterns proven. Ready for Phase 4.

---

## Context: What's Been Done (Phases 1-3)

### Current State ✅

**Working Features:**
- ✅ Oracle consultation (SLR(1) tables guide code generation)
- ✅ Left-recursion → while loops with FOLLOW termination
- ✅ Intermediate nonterminal inlining (breaks circular dependencies)
- ✅ Basic action compilation (spreads, literals, single symbols)
- ✅ Symbol constants generation (`SYM_IDENTIFIER = 40`, etc.)
- ✅ Clean switch/case dispatch
- ✅ Token metadata preservation (String objects with `.quote`, `.await`, etc.)

**Test Results:**
```bash
echo 'x' | ./bin/rip -s           # Output: (program x) ✅
echo 'x; y; z' | ./bin/rip -s     # Output: (program x y z) ✅
echo '42' | ./bin/rip -s          # Output: (program 42) ✅
```

**File Sizes:**
- Table-driven: 294KB
- PRD (partial): 19KB
- **Reduction: 94%** (will be ~83-86% when complete)

**Functions Generated:** 29/86 nonterminals (34% coverage)

### What Works Currently

**Simple actions compile correctly:**
```coffeescript
# Grammar
o 'IDENTIFIER'                    # Default action (return token 1)
o 'UNDEFINED', '"undefined"'      # String literal action
o 'Root → Body', '["program", ...1]'  # Spread action

# Generated
parseIdentifier() { return this._match(SYM_IDENTIFIER); }
parseLiteral() { case SYM_UNDEFINED: return "undefined"; }
parseRoot() { return ["program", ...this.parseBody()]; }
```

### What Doesn't Work Yet ⚠️

**Multi-symbol rules fail:**
```coffeescript
# Grammar
o 'DEF Identifier CALL_START ParamList CALL_END Block', '["def", 2, 4, 6]'

# Currently generates (WRONG):
parseDef() {
  return this._match(SYM_DEF);  // ❌ Ignores positions 2, 4, 6!
}

# Should generate:
parseDef() {
  this._match(SYM_DEF);              // Position 1
  const tok2 = this.parseIdentifier(); // Position 2 - in action
  this._match(SYM_CALL_START);       // Position 3
  const tok4 = this.parseParamList(); // Position 4 - in action
  this._match(SYM_CALL_END);         // Position 5
  const tok6 = this.parseBlock();     // Position 6 - in action
  return ["def", tok2, tok4, tok6];
}
```

**This is what Phase 4 fixes!**

---

## Phase 4 Goal: Multi-Symbol Action Compilation

### What to Implement

Generate correct code for **multi-symbol rules** where:
1. Multiple symbols need to be parsed
2. Action references specific positions (not just first symbol)
3. Temp variables capture results for referenced positions
4. Unreferenced positions are still matched but not saved

### Key Insight

**Action positions are 1-indexed:**
```
Position:  1      2          3            4         5        6
Rule:      DEF    Identifier CALL_START   ParamList CALL_END Block
Action:    '["def", 2, 4, 6]'
           ↑       ↑  ↑  ↑
           |       |  |  └─ Position 6 (Block)
           |       |  └──── Position 4 (ParamList)
           |       └─────── Position 2 (Identifier)
           └───────────── Literal "def" string
```

**Only positions in the action need temp variables:** 2, 4, 6
**Other positions are matched but discarded:** 1, 3, 5

---

## Implementation Strategy

### Step 1: Detect Multi-Symbol Rules

In `_compileAction()`, detect when a rule has multiple symbols:

```coffeescript
_compileAction: (rule) ->
  symbols = rule.symbols
  action = rule.action
  
  # Single-symbol rules - already working
  return @_compileSimpleAction(rule) if symbols.length <= 1
  
  # Multi-symbol rules - Phase 4 implementation
  @_compileMultiSymbolAction(rule)
```

### Step 2: Parse Action to Find Position References

Analyze the action to find which positions are referenced:

```coffeescript
_compileMultiSymbolAction: (rule) ->
  symbols = rule.symbols
  action = rule.action
  
  # Find all position references in action
  # Examples:
  #   '["def", 2, 4, 6]' → positions [2, 4, 6]
  #   '[1, 3]' → positions [1, 3]
  #   '[$3[0], $1]' → positions [1, 3] (protected $)
  referencedPositions = @_findReferencedPositions(action, symbols.length)
```

### Step 3: Generate Parsing Code

For each symbol position:
- If referenced in action → generate temp variable
- If not referenced → just match and discard

```coffeescript
_compileMultiSymbolAction: (rule) ->
  symbols = rule.symbols
  action = rule.action
  referencedPositions = @_findReferencedPositions(action, symbols.length)
  
  lines = []
  
  # Generate parsing for each symbol
  for symbol, i in symbols
    position = i + 1  # 1-indexed
    
    if position in referencedPositions
      # This position is used in action - save it
      lines.push @_generateCaptureStatement(symbol, position)
    else
      # Not used in action - just match
      lines.push @_generateMatchStatement(symbol)
  
  # Generate return statement with compiled action
  lines.push @_compileActionExpression(action, symbols.length)
  
  return lines.join('\n')
```

### Step 4: Generate Capture vs Match Statements

```coffeescript
_generateCaptureStatement: (symbol, position) ->
  if @types[symbol]
    # Nonterminal - call parse function
    "const tok#{position} = this.parse#{symbol}();"
  else
    # Terminal - match token
    symbolId = @symbolIds[symbol]
    "const tok#{position} = this._match(#{symbolId});"

_generateMatchStatement: (symbol) ->
  if @types[symbol]
    "this.parse#{symbol}();"
  else
    symbolId = @symbolIds[symbol]
    "this._match(#{symbolId});"
```

### Step 5: Compile Action Expression

Transform action string by replacing position numbers with temp variables:

```coffeescript
_compileActionExpression: (action, symbolCount) ->
  # Handle different action types
  
  # Array construction: '["def", 2, 4, 6]'
  if typeof action is 'string' and action.match(/^\[/)
    # Replace bare numbers with tok variables
    # Protected $n references stay as literals
    compiled = action
      .replace(/(?<!\$)(\d+)/g, (match, num) -> 
        pos = parseInt(num)
        if pos >= 1 and pos <= symbolCount
          "tok#{pos}"
        else
          num
      )
    return "return #{compiled};"
  
  # Single number: 3
  if typeof action is 'number'
    return "return tok#{action};"
  
  # Default: return first symbol
  return "return tok1;"
```

---

## Concrete Examples

### Example 1: Simple Multi-Symbol Rule

**Grammar:**
```coffeescript
Def: [
  o 'DEF Identifier Block', '["def", 2, 3]'
]
```

**Should Generate:**
```javascript
parseDef() {
  this._match(SYM_DEF);              // Position 1 - not in action
  const tok2 = this.parseIdentifier(); // Position 2 - in action
  const tok3 = this.parseBlock();     // Position 3 - in action
  return ["def", tok2, tok3];
}
```

**Breakdown:**
- Position 1 (DEF): Not in action `["def", 2, 3]` → just match
- Position 2 (Identifier): In action → capture as `tok2`
- Position 3 (Block): In action → capture as `tok3`
- Return: Build array with `tok2` and `tok3`

### Example 2: Complex Rule with Many Positions

**Grammar:**
```coffeescript
Def: [
  o 'DEF Identifier CALL_START ParamList CALL_END Block', '["def", 2, 4, 6]'
]
```

**Should Generate:**
```javascript
parseDef() {
  this._match(SYM_DEF);              // Pos 1 - not in action
  const tok2 = this.parseIdentifier(); // Pos 2 - in action
  this._match(SYM_CALL_START);       // Pos 3 - not in action
  const tok4 = this.parseParamList(); // Pos 4 - in action
  this._match(SYM_CALL_END);         // Pos 5 - not in action
  const tok6 = this.parseBlock();     // Pos 6 - in action
  return ["def", tok2, tok4, tok6];
}
```

### Example 3: Protected Literals

**Grammar:**
```coffeescript
SimpleArgs: [
  o 'Expression',
  o 'SimpleArgs , Expression', 'Array.isArray($1) ? [...$1, $3] : [$1, $3]'
]
```

**Action has `$1` and `$3`:** These reference positions 1 and 3, but the `$` protects them from being treated as bare numbers.

**Should Generate:**
```javascript
parseSimpleArgs() {
  // ... dispatch logic ...
  
  // For second alternative:
  const tok1 = this.parseSimpleArgs();
  this._match(SYM_COMMA);
  const tok3 = this.parseExpression();
  return Array.isArray(tok1) ? [...tok1, tok3] : [tok1, tok3];
}
```

**Note:** The `$1` and `$3` in the action become `tok1` and `tok3` in generated code.

### Example 4: Spread in Action

**Grammar:**
```coffeescript
Block: [
  o 'INDENT Body OUTDENT', '["block", ...2]'
]
```

**Should Generate:**
```javascript
parseBlock() {
  this._match(SYM_INDENT);
  const tok2 = this.parseBody();
  this._match(SYM_OUTDENT);
  return ["block", ...tok2];
}
```

---

## Finding Referenced Positions

### Algorithm

```coffeescript
_findReferencedPositions: (action, symbolCount) ->
  positions = new Set
  
  return positions unless action  # No action
  
  if typeof action is 'number'
    # Action is just a number like 3
    positions.add(action)
    return Array.from(positions)
  
  if typeof action is 'string'
    # Find all number references (but not protected $n)
    # Match patterns like: [1, 3], ...2, etc.
    # But NOT: $1, $3 (these are protected)
    
    # Remove protected $n references temporarily
    temp = action.replace(/\$\d+/g, '')
    
    # Now find bare numbers
    matches = temp.match(/\b\d+\b/g)
    if matches
      for match in matches
        pos = parseInt(match)
        if pos >= 1 and pos <= symbolCount
          positions.add(pos)
  
  Array.from(positions).sort()
```

### Examples

```coffeescript
# Action: '["def", 2, 4, 6]'
# Result: [2, 4, 6]

# Action: '[1, 3]'
# Result: [1, 3]

# Action: '["block", ...2]'
# Result: [2]

# Action: '[$3[0], $1, 12]'
# Result: [1, 3]  (12 is out of range, $1 and $3 are positions)

# Action: 'Array.isArray($1) ? [...$1, $3] : [$1, $3]'
# Result: [1, 3]
```

---

## Testing Strategy

### Test Cases for Phase 4

After implementing multi-symbol actions, test these progressively:

#### Test 1: Simple 3-Symbol Rule
```bash
echo 'def foo() {}' | ./bin/rip -s
```
**Expected:** Should parse `def` with identifier and block

#### Test 2: Complex 6-Symbol Rule
```bash
echo 'def foo(x, y) { return x }' | ./bin/rip -s
```
**Expected:** Should parse `def` with parameters

#### Test 3: Property Access
```bash
echo 'x.y' | ./bin/rip -s
```
**Expected:** `(program (. x y))`

#### Test 4: Array Access
```bash
echo 'arr[0]' | ./bin/rip -s
```
**Expected:** `(program ([] arr 0))`

#### Test 5: Compare with Table Mode
```bash
# Table mode
echo 'def foo() {}' | ./bin/rip -s > /tmp/table.txt

# PRD mode (after Phase 4)
cp parser-prd.js src/parser.js
echo 'def foo() {}' | ./bin/rip -s > /tmp/prd.txt

# Should be identical
diff /tmp/table.txt /tmp/prd.txt
```

---

## Implementation Checklist

### Phase 4 Tasks

- [ ] Implement `_findReferencedPositions()` to parse actions and find position refs
- [ ] Implement `_generateCaptureStatement()` for positions in action
- [ ] Implement `_generateMatchStatement()` for positions not in action
- [ ] Implement `_compileMultiSymbolAction()` to orchestrate generation
- [ ] Update `_compileAction()` to dispatch to multi-symbol handler
- [ ] Handle protected literals (`$1`, `$3`) correctly
- [ ] Handle spreads in actions (`...2`)
- [ ] Handle complex expressions in actions (`Array.isArray($1) ? ...`)
- [ ] Test with simple 3-symbol rules
- [ ] Test with complex 6-symbol rules
- [ ] Compare output with table mode (must be identical)

### Success Criteria

✅ **Def rules parse correctly** with identifier and parameters
✅ **Property access works** (`x.y` → `(. x y)`)
✅ **Array access works** (`arr[0]` → `([] arr 0)`)
✅ **Output identical to table mode** for all tested cases
✅ **No regressions** - Phase 1-3 tests still pass

---

## Files to Modify

### Primary File: `src/grammar/solar.rip`

**Functions to add/modify:**

1. **`_findReferencedPositions(action, symbolCount)`**
   - Parse action string to find position references
   - Return array of positions (1-indexed)

2. **`_generateCaptureStatement(symbol, position)`**
   - Generate `const tokN = this.parse...()` or `this._match(...)`
   - Returns string of JavaScript code

3. **`_generateMatchStatement(symbol)`**
   - Generate `this.parse...()` or `this._match(...)` without capture
   - Returns string of JavaScript code

4. **`_compileMultiSymbolAction(rule)`**
   - Orchestrate multi-symbol parsing
   - Generate all capture/match statements
   - Compile final return statement
   - Returns complete function body

5. **`_compileAction(rule)` - MODIFY**
   - Add dispatch to `_compileMultiSymbolAction()` for rules with multiple symbols
   - Keep existing simple action handling

### Testing

After implementation, verify with:

```bash
# Regenerate PRD parser
bun src/grammar/solar.rip -r -o parser-prd.js src/grammar/grammar.rip

# Test simple cases (should still work)
echo 'x' | ./bin/rip -s
echo '42' | ./bin/rip -s

# Test new multi-symbol cases
echo 'def foo() {}' | ./bin/rip -s

# Compare with table mode
echo 'def foo() {}' | ./bin/rip -s > /tmp/table.txt
cp parser-prd.js src/parser.js
echo 'def foo() {}' | ./bin/rip -s > /tmp/prd.txt
diff /tmp/table.txt /tmp/prd.txt  # Should be empty (identical)
```

---

## Edge Cases to Handle

### 1. First Position in Action
```coffeescript
o 'Value . Property', '[".", 1, 3]'
```
**All three positions referenced:** 1, 3, and literal `"."`

### 2. Consecutive Positions
```coffeescript
o 'YIELD FROM Expression', '["yield-from", 3]'
```
**Only last position referenced:** 3

### 3. No Positions Referenced (Rare)
```coffeescript
o 'LOOP Block', '["loop", 2]'
```
**Only position 2 referenced**

### 4. Protected Literals Mixed with Bare Numbers
```coffeescript
o 'SimpleArgs , Expression', 'Array.isArray($1) ? [...$1, $3] : [$1, $3]'
```
**Positions 1 and 3 referenced**, but written as `$1` and `$3` (protected)

---

## Common Pitfalls to Avoid

### ❌ Don't Confuse 0-Indexed Arrays with 1-Indexed Positions

**Grammar positions are 1-indexed:**
```
Position:  1    2          3
Symbols:   DEF  Identifier Block
Array:     [0]  [1]        [2]
```

**When iterating:**
```coffeescript
for symbol, i in symbols
  position = i + 1  # Convert to 1-indexed position
```

### ❌ Don't Match Terminals When Nonterminals Expected

**Check if symbol is a nonterminal:**
```coffeescript
if @types[symbol]
  # Nonterminal - call parse function
  "this.parse#{symbol}()"
else
  # Terminal - match token
  "this._match(#{@symbolIds[symbol]})"
```

### ❌ Don't Generate temp Variables for Unreferenced Positions

**Only capture what's needed:**
```coffeescript
if position in referencedPositions
  "const tok#{position} = ..."
else
  "this._match(...);"  # No const assignment
```

### ❌ Don't Forget Spreads in Actions

**Handle spread operator:**
```coffeescript
# Action: '["block", ...2]'
# Generate: return ["block", ...tok2];
```

---

## Expected Outcome

After Phase 4 implementation:

### File Size
- Current: 19KB (partial, 29 functions)
- After Phase 4: ~25-30KB (40-50 functions)
- Final target: ~40-50KB (all 86 functions)

### Coverage
- Current: 29/86 nonterminals (34%)
- After Phase 4: ~40-50/86 (50-60%)
- Remaining: Operator precedence, lookahead disambiguation, full expansion

### Test Coverage
```bash
✅ 'x' → (program x)
✅ 'x; y; z' → (program x y z)
✅ '42' → (program 42)
✅ 'def foo() {}' → (program (def foo [] (block)))  # NEW!
✅ 'x.y' → (program (. x y))  # NEW!
✅ 'arr[0]' → (program ([] arr 0))  # NEW!
```

---

## Phase 5 Preview (After Phase 4)

Once Phase 4 is complete, Phase 5 will add **lookahead disambiguation** for rules like:

```coffeescript
Return: [
  o 'RETURN Expression'            # Peek → Expression token
  o 'RETURN INDENT Object OUTDENT' # Peek → INDENT
  o 'RETURN'                        # Peek → EOF/TERMINATOR
]
```

**Generated code will use `_peek()`:**
```javascript
parseReturn() {
  this._match(SYM_RETURN);
  const next = this._peek();
  if (next === SYM_INDENT) {
    // INDENT Object OUTDENT case
  } else if (next === SYM_EOF || next === SYM_TERMINATOR) {
    return ["return"];
  } else {
    // Expression case
  }
}
```

But **don't implement this in Phase 4** - focus only on multi-symbol actions!

---

## Summary: What Phase 4 Accomplishes

**Before Phase 4:**
- ✅ Single-symbol rules work
- ❌ Multi-symbol rules broken (only match first symbol)

**After Phase 4:**
- ✅ Single-symbol rules still work
- ✅ Multi-symbol rules generate correct temp variables
- ✅ Actions compile to proper array construction
- ✅ Property access works (`x.y`)
- ✅ Array access works (`arr[0]`)
- ✅ Def with parameters works
- ✅ Output identical to table mode

**Phase 4 is the biggest expansion step** - it unlocks most of the grammar coverage.

---

## Getting Started

### 1. Verify Current State Works
```bash
bun src/grammar/solar.rip -r -o parser-prd.js src/grammar/grammar.rip
echo 'x; y; z' | ./bin/rip -s  # Should output: (program x y z)
```

### 2. Implement Phase 4 Functions
Add the functions described above to `solar.rip`:
- `_findReferencedPositions()`
- `_generateCaptureStatement()`
- `_generateMatchStatement()`
- `_compileMultiSymbolAction()`
- Modify `_compileAction()` to dispatch correctly

### 3. Test Incrementally
After each function, regenerate and test. Don't wait until everything is done.

### 4. Compare with Table Mode
For every test, verify PRD output matches table mode output exactly.

---

## Questions to Ask If You Get Stuck

1. **"Am I correctly identifying which positions are referenced in the action?"**
   - Add console.log to `_findReferencedPositions()` to debug

2. **"Are my temp variables named correctly?"**
   - Should be `tok1`, `tok2`, `tok3`, etc. (1-indexed)

3. **"Am I calling parse functions for nonterminals and _match for terminals?"**
   - Check `@types[symbol]` to distinguish

4. **"Is my action compilation preserving spreads and protected literals?"**
   - Test with actions like `'["block", ...2]'` and `'[$1, $3]'`

5. **"Does my generated code match the examples in this document?"**
   - Compare your output with the concrete examples above

---

## Success! How to Know Phase 4 is Complete

✅ **All these tests pass:**
```bash
echo 'x' | ./bin/rip -s               # Still works
echo 'x; y; z' | ./bin/rip -s         # Still works
echo 'def foo() {}' | ./bin/rip -s    # Now works!
echo 'x.y' | ./bin/rip -s             # Now works!
```

✅ **Output identical to table mode** for all tested inputs

✅ **Generated code looks like the examples** in this document

✅ **No regressions** in Phase 1-3 functionality

When all these are true, **Phase 4 is complete!** 🎉

---

## Reference: Current Working Code Patterns

### Left-Recursive Function (from Phase 3)
```javascript
parseBody() {
  const items = [this.parseLine()];
  while (this.la && this.la.id === SYM_TERMINATOR) {
    this._match(SYM_TERMINATOR);
    if (this.la.id === SYM_EOF || this.la.id === SYM_OUTDENT || 
        this.la.id === SYM_INTERPOLATION_END || this.la.id === SYM_RPAREN) break;
    items.push(this.parseLine());
  }
  return items;
}
```

### Switch Dispatch (from Phase 3)
```javascript
parseLiteral() {
  switch (this.la.id) {
  case SYM_NUMBER: case SYM_STRING: case SYM_STRING_START: return this.parseAlphaNumeric();
  case SYM_JS: return this._match(61);
  case SYM_REGEX: case SYM_REGEX_START: return this.parseRegex();
  case SYM_UNDEFINED: return "undefined";
  case SYM_NULL: return "null";
  case SYM_BOOL: return this._match(64);
  default: this._error([44, 46, 47, 54, 55, 61, 62, 63, 64, 65, 66], this.la.id);
  }
}
```

### Simple Action (from Phase 3)
```javascript
parseRoot() {
  switch (this.la.id) {
  case SYM_STATEMENT: case SYM_DEF: /* ...50+ tokens... */:
    return ["program", ...this.parseBody()];  // Spread action working
  default: return ["program"];  // Empty rule working
  }
}
```

**Phase 4 extends these patterns to multi-symbol rules!**

---

**Good luck with Phase 4!** This is the biggest step toward complete coverage. 🚀
