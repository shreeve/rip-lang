# PRD Parser - Phase 5 Implementation Plan (CORRECTED)

**Objective:** Implement lookahead disambiguation ONLY for rules with truly ambiguous FIRST sets

**Status:** Phase 4 complete and verified. Ready for Phase 5.

---

## CRITICAL: What Went Wrong in First Attempt

The first Phase 5 attempt failed because:

1. ❌ **Generated lookahead for rules that don't need it** (Line, Expression, etc.)
2. ❌ **Missing `case` keywords** in switch statements
3. ❌ **Undefined variables** (`tok1`) in generated code
4. ❌ **Didn't test before committing**

**This plan fixes all of these issues with clearer instructions.**

---

## Context: What's Working (Phase 4)

### Current State ✅

**Phase 4 Achievements:**
- ✅ Multi-symbol action compilation working
- ✅ Temp variables generated correctly (`tok2`, `tok3`, etc.)
- ✅ Block scoping for multi-statement cases
- ✅ Spreads working (`...tok2`)
- ✅ Protected literals working (`$1`, `$3`)

**File Size:** 20KB (93% reduction from 300KB table)
**Functions:** 26 nonterminals generated
**Tests Passing:** `x`, `x; y; z`, `42`

### What Phase 4 Does NOT Handle ⚠️

**Rules with multiple alternatives that ALL start with the same token:**

```coffeescript
Return: [
  o 'RETURN Expression'            # FIRST = {RETURN}
  o 'RETURN INDENT Object OUTDENT' # FIRST = {RETURN}  ← SAME!
  o 'RETURN'                       # FIRST = {RETURN}  ← SAME!
]
```

**All three rules start with RETURN!** Phase 4 just picks the first rule and ignores the others.

**This is what Phase 5 fixes - and ONLY this.**

---

## Phase 5 Goal: True Ambiguity Disambiguation

### What is "True Ambiguity"?

**True ambiguity:** When multiple rules for a nonterminal have the **exact same first token**.

**Examples of TRUE ambiguity (need lookahead):**
```coffeescript
Return: [
  o 'RETURN Expression'            # All start with RETURN
  o 'RETURN INDENT Object OUTDENT'
  o 'RETURN'
]

Yield: [
  o 'YIELD FROM Expression'        # All start with YIELD
  o 'YIELD Expression'
  o 'YIELD'
]
```

**Examples of FALSE ambiguity (NO lookahead needed):**
```coffeescript
Line: [
  o 'Expression'                   # FIRST = {IDENTIFIER, NUMBER, STRING, ...}
  o 'Statement'                    # FIRST = {STATEMENT, RETURN, IMPORT, EXPORT}
]
# Different FIRST sets → NO ambiguity → NO lookahead needed!

Literal: [
  o 'NUMBER'                       # FIRST = {NUMBER}
  o 'String'                       # FIRST = {STRING, STRING_START}
  o 'REGEX'                        # FIRST = {REGEX}
]
# Different FIRST sets → NO ambiguity → NO lookahead needed!
```

**CRITICAL RULE:** Only generate lookahead when `dispatchMap[tokenId].length > 1` for a specific token.

---

## Implementation Strategy

### Step 1: Detect TRUE Ambiguity (Fix from First Attempt)

**Build dispatch map correctly:**

```coffeescript
_generateSwitchFunction: (nonTerminal, rules) ->
  # Build dispatch map: tokenId → array of rules
  dispatchMap = {}
  
  for rule in rules
    firstTokens = @_getFirstTokens(rule)
    for tokenId in firstTokens
      dispatchMap[tokenId] ?= []
      dispatchMap[tokenId].push(rule)
  
  # CRITICAL CHECK: Only use lookahead when truly ambiguous
  cases = []
  processedRules = new Set()
  
  # Pass 1: Handle ambiguous tokens (multiple rules per token)
  for own tokenId, rulesForToken of dispatchMap
    if rulesForToken.length > 1
      # TRUE AMBIGUITY - generate lookahead ✅
      lookaheadCase = @_generateLookaheadDisambiguation(tokenId, rulesForToken, nonTerminal)
      cases.push(lookaheadCase)
      
      # Mark these rules as processed
      for rule in rulesForToken
        processedRules.add(rule.id)
  
  # Pass 2: Handle unambiguous tokens (single rule per token)
  # Group by RULE (not token) to avoid duplicates
  ruleTokenMap = {}
  for own tokenId, rulesForToken of dispatchMap
    if rulesForToken.length is 1
      rule = rulesForToken[0]
      continue if processedRules.has(rule.id)
      
      ruleTokenMap[rule.id] ?= {rule, tokens: []}
      ruleTokenMap[rule.id].tokens.push(tokenId)
  
  # Generate one case per rule
  for own ruleId, {rule, tokens} of ruleTokenMap
    caseStr = tokens.map((id) => "case #{@_getSymbolConstName(id)}").join(': ')
    caseBody = @_generateRuleBody(rule)
    cases.push("#{caseStr}: #{caseBody}")
  
  # Generate switch
  """
  switch (this.la.id) {
  #{cases.join('\n')}
  default: this._error([...expected...], this.la.id);
  }
  """
```

**Key Points:**
- ✅ Check `rulesForToken.length > 1` to detect TRUE ambiguity
- ✅ Only generate lookahead for truly ambiguous tokens
- ✅ Group unambiguous tokens by rule (not by token) to avoid duplicates

### Step 2: Generate Lookahead Disambiguation (Fix Syntax)

**Add `case` keyword!**

```coffeescript
_generateLookaheadDisambiguation: (firstTokenId, rules, nonTerminal) ->
  firstConstName = @_getSymbolConstName(firstTokenId)
  lines = []
  
  # CRITICAL: Include 'case' keyword!
  lines.push "    case #{firstConstName}: {"
  
  # Match first token (common to all rules)
  lines.push "      this._match(#{firstTokenId});"
  
  # Peek at next token
  lines.push "      const next = this._peek();"
  lines.push ""
  
  # Order rules by specificity
  orderedRules = @_orderRulesForDisambiguation(rules, nonTerminal)
  
  # Generate if/else chain
  for rule, i in orderedRules
    secondTokens = @_getSecondTokens(rule)
    condition = @_generatePeekCondition(secondTokens, nonTerminal, rules)
    
    if i is 0
      lines.push "      if (#{condition}) {"
    else if i is orderedRules.length - 1
      lines.push "      } else {"
    else
      lines.push "      } else if (#{condition}) {"
    
    # Generate body for this rule (starting at position 2)
    body = @_generateRuleBody(rule, startPosition: 2, indent: '        ')
    lines.push body
  
  # Close all branches and the case
  lines.push "      }"
  lines.push "    }"
  
  lines.join('\n')
```

**Critical fix:** `"case #{firstConstName}: {"` not `"#{firstConstName}: {"`

### Step 3: Get Second Tokens (Same as Before)

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

### Step 4: Generate Peek Condition (Fix FOLLOW Logic)

```coffeescript
_generatePeekCondition: (tokenIds, nonTerminal, allRules) ->
  # If no second token, check FOLLOW set
  unless tokenIds
    followSet = Array.from(@types[nonTerminal].follows)
    
    # CRITICAL: Exclude tokens that are explicit second tokens in other rules
    explicitSecondTokens = new Set()
    for rule in allRules
      secondTokens = @_getSecondTokens(rule)
      if secondTokens
        for tok in secondTokens
          explicitSecondTokens.add(tok)
    
    # Filter FOLLOW to exclude explicit second tokens
    followSet = followSet.filter (tok) -> not explicitSecondTokens.has(tok)
    
    if followSet.length is 0
      return "true"  # Empty rule matches anything not handled by other rules
    
    conditions = followSet.map (id) -> "next === #{id}"
    return "(#{conditions.join(' || ')})"
  
  # Has second token(s) - check for them
  if tokenIds.length is 1
    "next === #{tokenIds[0]}"
  else
    conditions = tokenIds.map (id) -> "next === #{id}"
    "(#{conditions.join(' || ')})"
```

### Step 5: Order Rules by Specificity (Same as Before)

```coffeescript
_orderRulesForDisambiguation: (rules, nonTerminal) ->
  rules.slice().sort (a, b) =>
    aTokens = @_getSecondTokens(a)
    bTokens = @_getSecondTokens(b)
    
    # Empty rules (no second token) → check last (most general)
    return 1 if not aTokens and bTokens      # a is empty, b is not → a after b
    return -1 if aTokens and not bTokens     # b is empty, a is not → b after a
    return 0 if not aTokens and not bTokens  # both empty → same
    
    # Fewer tokens = more specific → comes first
    aTokens.length - bTokens.length
```

### Step 6: Generate Rule Body Starting at Position N (Fix Variable Names)

**CRITICAL FIX:** When starting at position 2, don't reference `tok1` (it's already matched).

```coffeescript
_generateRuleBody: (rule, options = {}) ->
  startPosition = options.startPosition ? 1
  indent = options.indent ? '    '
  
  symbols = rule.symbols
  action = rule.action
  
  # If startPosition > 1, we've already matched earlier symbols
  remainingSymbols = symbols[startPosition - 1..]
  
  # Find which positions in the ORIGINAL rule are referenced in the action
  referencedPositions = @_findReferencedPositions(action, symbols.length)
  
  lines = []
  
  # Generate parsing for remaining symbols
  for symbol, i in remainingSymbols
    position = startPosition + i  # Actual position in original rule
    
    if position in referencedPositions
      # This position is used in action - capture it
      varName = "tok#{position}"
      
      if @types[symbol]
        lines.push "#{indent}const #{varName} = this.parse#{symbol}();"
      else
        lines.push "#{indent}const #{varName} = this._match(#{@symbolIds[symbol]});"
    else
      # Not used in action - just match
      if @types[symbol]
        lines.push "#{indent}this.parse#{symbol}();"
      else
        lines.push "#{indent}this._match(#{@symbolIds[symbol]});"
  
  # Generate return statement
  returnStmt = @_compileActionExpression(action, symbols.length)
  lines.push "#{indent}#{returnStmt}"
  
  lines.join('\n')
```

**Key Fix:** Use `startPosition + i` to calculate the actual position in the original rule, so `tok2`, `tok3`, etc. are named correctly.

---

## Concrete Examples

### Example 1: Return (TRUE Ambiguity - Needs Lookahead)

**Grammar:**
```coffeescript
Return: [
  o 'RETURN Expression', '["return", 2]'
  o 'RETURN INDENT Object OUTDENT', '["return", 3]'
  o 'RETURN', '["return"]'
]
```

**Detection:**
```
dispatchMap[SYM_RETURN] = [rule1, rule2, rule3]  # Length = 3 > 1 ✅
→ TRUE AMBIGUITY → Generate lookahead
```

**Should Generate:**
```javascript
parseReturn() {
  switch (this.la.id) {
  case SYM_RETURN: {
    this._match(94);                    // Match RETURN
    const next = this._peek();          // Peek at second token
    
    if (next === SYM_INDENT) {
      // Rule 2: RETURN INDENT Object OUTDENT
      this._match(36);                  // INDENT
      const tok3 = this.parseObject();  // Position 3
      this._match(38);                  // OUTDENT
      return ["return", tok3];
    } else if ((next === SYM_TERMINATOR || next === SYM_OUTDENT || ...)) {
      // Rule 3: RETURN (empty)
      return ["return"];
    } else {
      // Rule 1: RETURN Expression (default)
      const tok2 = this.parseExpression();
      return ["return", tok2];
    }
  }
  default: this._error([94], this.la.id);
  }
}
```

**Verification Checklist:**
- ✅ Has `case` keyword
- ✅ Matches RETURN once before peek
- ✅ Variables named correctly (tok2, tok3)
- ✅ No undefined variables
- ✅ Different logic in each branch

### Example 2: Line (FALSE Ambiguity - NO Lookahead)

**Grammar:**
```coffeescript
Line: [
  o 'Expression'
  o 'Statement'
]
```

**Detection:**
```
dispatchMap[SYM_IDENTIFIER] = [Expression_rule]  # Length = 1
dispatchMap[SYM_RETURN] = [Statement_rule]       # Length = 1
dispatchMap[SYM_NUMBER] = [Expression_rule]      # Length = 1
→ NO AMBIGUITY → Normal case dispatch
```

**Should Generate:**
```javascript
parseLine() {
  switch (this.la.id) {
  case SYM_STATEMENT: case SYM_RETURN: case SYM_IMPORT: case SYM_EXPORT:
    return this.parseStatement();
  case SYM_IDENTIFIER: case SYM_NUMBER: case SYM_STRING: /* ... many tokens ... */:
    return this.parseExpression();
  default: this._error([...], this.la.id);
  }
}
```

**Verification Checklist:**
- ✅ NO lookahead generated
- ✅ Simple case dispatch
- ✅ One case per rule (grouped tokens)
- ✅ No duplicate case labels

---

## Implementation Checklist

### Phase 5 Tasks

**Critical Checks:**
- [ ] `dispatchMap[tokenId].length > 1` is the ONLY trigger for lookahead
- [ ] Every case label has `case` keyword before it
- [ ] `_generateRuleBody()` with `startPosition: 2` names variables correctly
- [ ] Test `parseReturn()` BEFORE expanding to other nonterminals
- [ ] Verify NO lookahead generated for Line, Expression, Literal, etc.

**Implementation Steps:**
- [ ] Fix `_generateSwitchFunction()` to detect TRUE ambiguity
- [ ] Add `case` keyword to `_generateLookaheadDisambiguation()`
- [ ] Fix variable naming in `_generateRuleBody()`
- [ ] Generate ONLY Return first, verify it's correct
- [ ] Add Yield, verify it's correct
- [ ] Regenerate full parser, check for bugs
- [ ] Compare with Phase 4 - ensure no regressions

### Testing Strategy (BEFORE Committing!)

**Step 1: Generate Return Only**
```bash
# Modify SKIP_GENERATION to include everything except Return
bun src/grammar/solar.rip -r -o parser-prd.js src/grammar/grammar.rip
```

**Step 2: Inspect parseReturn()**
```bash
grep -A 30 "parseReturn()" parser-prd.js
```

**Verify:**
- ✅ Has `case SYM_RETURN: {`
- ✅ Matches RETURN once
- ✅ Peeks at next token
- ✅ Has three different branches
- ✅ Variables are `tok2`, `tok3` (not `tok1`)
- ✅ No syntax errors

**Step 3: Check parseLine() Has NO Lookahead**
```bash
grep -A 10 "parseLine()" parser-prd.js
```

**Verify:**
- ✅ NO peek logic
- ✅ Simple case dispatch only
- ✅ No undefined variables

**Step 4: Only After Verification**
- Commit if everything looks correct
- Tag as `phase-5-complete`

---

## Success Criteria

✅ **Return has lookahead** (3 rules, all start with RETURN)
✅ **Yield has lookahead** (4 rules, all start with YIELD)
✅ **Line has NO lookahead** (2 rules, different FIRST sets)
✅ **Expression has NO lookahead** (2 rules, different FIRST sets)
✅ **Every case has `case` keyword**
✅ **No undefined variables** (tok1, tok2, tok3 all defined when referenced)
✅ **Different logic in each lookahead branch**
✅ **Phase 4 still works** (no regressions)

---

## What NOT to Do (Learn from First Attempt)

❌ **Don't generate lookahead for every nonterminal with multiple rules**
   - Only generate when rules have SAME first token

❌ **Don't forget `case` keyword in switch statements**
   - Every label needs `case` before it

❌ **Don't reference variables that don't exist**
   - If you start at position 2, don't use `tok1`

❌ **Don't commit without inspecting the generated code**
   - Always look at parseReturn() and parseLine() before committing

❌ **Don't generate identical if/else branches**
   - Each branch should do something different

---

## Files to Modify

### Primary File: `src/grammar/solar.rip`

**Functions to fix:**

1. **`_generateSwitchFunction()` - FIX AMBIGUITY DETECTION**
   - Check `rulesForToken.length > 1` before generating lookahead
   - Don't generate lookahead for single-rule tokens

2. **`_generateLookaheadDisambiguation()` - ADD `case` KEYWORD**
   - Change `"#{firstConstName}: {"` to `"case #{firstConstName}: {"`

3. **`_generateRuleBody()` - FIX VARIABLE NAMING**
   - When `startPosition: 2`, name variables correctly (`tok2`, `tok3`)
   - Don't reference `tok1` when starting at position 2

4. **Add functions from Phase 5 plan** (if not already added):
   - `_getSecondTokens()`
   - `_generatePeekCondition()`
   - `_orderRulesForDisambiguation()`

---

## Expected Outcome

After Phase 5 (corrected):

### File Size
- Phase 4: 20KB
- Phase 5: ~30-40KB (lookahead adds if/else chains, but only where needed)
- Still 85-87% reduction vs 300KB table

### Coverage
- Same 26 functions as Phase 4
- But Return and Yield now work correctly with all variants

### Generated Code Quality
```javascript
// Return - with lookahead ✅
parseReturn() {
  switch (this.la.id) {
  case SYM_RETURN: {
    this._match(94);
    const next = this._peek();
    if (next === SYM_INDENT) { /* ... */ }
    else if (/* FOLLOW */) { return ["return"]; }
    else { /* ... */ }
  }
  default: this._error([94], this.la.id);
  }
}

// Line - without lookahead ✅
parseLine() {
  switch (this.la.id) {
  case SYM_STATEMENT: case SYM_RETURN: case SYM_IMPORT: case SYM_EXPORT:
    return this.parseStatement();
  case SYM_IDENTIFIER: case SYM_NUMBER: /* ... */:
    return this.parseExpression();
  default: this._error([...], this.la.id);
  }
}
```

---

## Critical Reminders

**Before implementing:**
1. Review the "What NOT to Do" section
2. Focus on TRUE ambiguity detection first
3. Add `case` keywords to every switch label
4. Test Return alone before expanding

**Before committing:**
1. Inspect parseReturn() - verify syntax and logic
2. Inspect parseLine() - verify NO lookahead
3. Check for undefined variables
4. Make sure Phase 4 tests still pass

**If stuck:**
1. Show me parseReturn() and parseLine()
2. Don't commit broken code
3. Ask for help before proceeding

---

**Phase 5 (Corrected) is focused, testable, and will work correctly!** 🎯
