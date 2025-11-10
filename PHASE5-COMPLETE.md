# Phase 5 Implementation - COMPLETE ✅

**Date:** November 10, 2025
**Status:** Lookahead disambiguation correctly implemented and verified

---

## What Was Implemented

Phase 5 successfully implements **lookahead disambiguation** for grammar rules with **TRUE ambiguity** - where all alternatives for a nonterminal start with the exact same token.

### Key Insight: TRUE vs FALSE Ambiguity

**TRUE Ambiguity (needs lookahead):**
- ALL rules for a nonterminal start with the SAME token
- Example: Return has 3 alternatives, ALL start with RETURN

**FALSE Ambiguity (no lookahead needed):**
- Rules map to DIFFERENT tokens
- Oracle can distinguish them via simple dispatch
- Example: Line has 3 alternatives with different FIRST sets

### Core Features Implemented

1. **TRUE Ambiguity Detection**
   - Only generate lookahead when `rulesForToken.length > 1` AND `rulesForToken.length === totalRulesForNonterminal`
   - This means ALL alternatives use the same single token

2. **`_getSecondTokens(rule)`**
   - Extracts FIRST set of second symbol
   - Returns null for single-symbol rules

3. **`_generatePeekCondition(tokenIds, nonTerminal, allRules)`**
   - Generates lookahead conditions with proper syntax
   - For empty rules, checks FOLLOW set (excluding explicit second tokens)

4. **`_orderRulesForDisambiguation(rules)`**
   - Sorts by specificity: single terminals first, empty rules last
   - Ensures most specific checks come first

5. **`_generateLookaheadDisambiguation(firstTokenId, rules, nonTerminal)`**
   - Generates if/else chain with `_peek()`
   - Includes **`case` keyword** (critical fix!)
   - Captures tok1 if any rule's action references it

6. **`_generateRuleBody(rule, options)`**
   - Generates parsing code starting at arbitrary position
   - Correctly names variables (tok2, tok3, etc.)
   - Integrates with Phase 4 multi-symbol actions

### Critical Bugs Fixed

**Bug #1: FALSE Ambiguity Detection**
- **Problem:** Generated lookahead for Line when it has non-overlapping FIRST sets
- **Fix:** Only generate lookahead when ALL rules map to ONE token

**Bug #2: Missing `case` Keyword**
- **Problem:** `SYM_RETURN: {` instead of `case SYM_RETURN: {`
- **Fix:** Added `case` keyword in `_generateLookaheadDisambiguation`

**Bug #3: Undefined Variables**
- **Problem:** Referenced `tok1` when it was never captured
- **Fix:** Check if action references position 1 and capture it before peek

**Bug #4: Parent vs Child Rules**
- **Problem:** Pushed childRule when expanding through skipped nonterminals
- **Fix:** Push parentRule to prevent false ambiguity

**Bug #5: Missing Statement Cases**
- **Problem:** FALSE ambiguity tokens weren't handled in Pass 2
- **Fix:** Pick preferred rule (last one) for multi-rule tokens not in lookahead

---

## Verified Examples

### Example 1: Return (TRUE Ambiguity - Has Lookahead)

**Grammar:**
```coffeescript
Return: [
  o 'RETURN Expression'            # All start with RETURN
  o 'RETURN INDENT Object OUTDENT'
  o 'RETURN'
]
```

**Dispatch Map:**
```
RETURN (94): 3 rules
  - Rule 97: Return → RETURN Expression
  - Rule 98: Return → RETURN INDENT Object OUTDENT
  - Rule 99: Return → RETURN
```

**Generated Code:**
```javascript
parseReturn() {
  switch (this.la.id) {
  case SYM_RETURN: {                    // ✅ Has 'case'
    this._match(94);                    // ✅ Match once
    const next = this._peek();          // ✅ Peek

    if (next === SYM_INDENT) {
      this._match(36);
      const tok3 = this.parseObject();  // ✅ tok3 defined
      this._match(38);
      return ["return", tok3];          // ✅ Object return
    } else if (/* Expression FIRST */) {
      const tok2 = this.parseExpression(); // ✅ tok2 defined
      return ["return", tok2];          // ✅ Expression return
    } else {
      return ["return"];                // ✅ Empty return
    }
  }
  default: this._error([94], this.la.id);
  }
}
```

### Example 2: Yield (TRUE Ambiguity - Has Lookahead)

**Grammar:**
```coffeescript
Yield: [
  o 'YIELD'
  o 'YIELD Expression'
  o 'YIELD INDENT Object OUTDENT'
  o 'YIELD FROM Expression'
]
```

**Generated Code:**
```javascript
parseYield() {
  case SYM_YIELD: {
    this._match(35);
    const next = this._peek();

    if (next === SYM_INDENT) { /* object */ }
    else if (next === SYM_FROM) { /* yield-from */ }
    else if (/* Expression */) { /* expression */ }
    else { return ["yield"]; }  // Empty
  }
}
```

### Example 3: Line (FALSE Ambiguity - NO Lookahead)

**Grammar:**
```coffeescript
Line: [
  o 'Expression'      # FIRST = {IDENTIFIER, NUMBER, ...}
  o 'ExpressionLine'  # FIRST = {PARAM_START, THIN_ARROW, ...}
  o 'Statement'       # FIRST = {STATEMENT, RETURN, IMPORT, EXPORT}
]
```

**Dispatch Map:**
```
STATEMENT: 1 rule → Line → Statement
RETURN: 1 rule → Line → Statement
IDENTIFIER: 1 rule → Line → Expression
PARAM_START: 1 rule → Line → ExpressionLine
```

**Generated Code:**
```javascript
parseLine() {
  switch (this.la.id) {
  case SYM_STATEMENT: case SYM_RETURN: case SYM_IMPORT: case SYM_EXPORT:
    return this.parseStatement();     // ✅ Simple dispatch
  case SYM_PARAM_START: case SYM_THIN_ARROW: case SYM_FAT_ARROW: /* ... */:
    return this.parseExpressionLine();
  case SYM_IDENTIFIER: case SYM_NUMBER: /* ... */:
    return this.parseExpression();
  default: this._error([...], this.la.id);
  }
}
```

**✅ NO lookahead generated - just simple case dispatch!**

---

## Success Criteria - All Met! ✅

✅ **Return has lookahead** (3 rules, all start with RETURN)
✅ **Yield has lookahead** (4 rules, all start with YIELD)
✅ **Line has NO lookahead** (3 rules, different FIRST sets)
✅ **Every case has `case` keyword**
✅ **No undefined variables**
✅ **Different logic in each lookahead branch**
✅ **Phase 4 still works** (Range multi-symbol actions verified)
✅ **Syntax valid** (verified with `node -c`)
✅ **File size reasonable** (30KB, not 76KB bloat)

---

## Statistics

### File Sizes
- **Table parser:** 294KB
- **PRD parser:** 30KB
- **Reduction:** 90%

### Coverage
- **Functions:** 26
- **Total nonterminals:** 86
- **Coverage:** 30%

### Nonterminals with Lookahead
- `Return` - 3 variants
- `Yield` - 4 variants

### Nonterminals with Simple Dispatch
- All others (Root, Body, Line, Value, Literal, etc.)

---

## What Was Learned

### Lesson 1: TRUE vs FALSE Ambiguity

The key insight was that **not all multi-rule tokens need lookahead**. Only when ALL rules for a nonterminal converge on a SINGLE token do you have TRUE ambiguity.

**The test:**
```coffeescript
if rulesForToken.length > 1 and rulesForToken.length is totalRulesForNonterminal
  # TRUE ambiguity - generate lookahead
```

### Lesson 2: Parent vs Child Rules

When expanding through skipped nonterminals, push the PARENT rule, not child rules. This prevents false ambiguity:

```coffeescript
dispatchMap[tokenId].push(parentRule)  # ✅ Not childRule!
```

### Lesson 3: Test Before Committing

Always inspect generated code before committing:
- Check parseReturn() for lookahead logic
- Check parseLine() for simple dispatch
- Verify syntax with `node -c`
- Check file size for bloat

---

## Next Steps

### Phase 6: Operator Precedence Climbing

Implement precedence climbing for binary operators to avoid generating individual functions for every precedence level.

### Phase 7: Resolve Circular Dependencies

Handle Expression ↔ For ↔ Statement cycles to enable full parser generation.

### Phase 8: Full Coverage

Generate all 86 nonterminals with complete disambiguation and precedence handling.

---

## Conclusion

**Phase 5 is COMPLETE!** 🎉

TRUE ambiguity detection working correctly:
- Return and Yield use lookahead (intentional ambiguity)
- Line and Expression use simple dispatch (distinguishable by oracle)
- No undefined variables, proper syntax, reasonable file size
- All bugs from first attempt fixed
- Ready for Phase 6!

**Committed:** ✅
**Pushed:** ✅
**Tagged:** ✅ `baseline-for-phase-6`
