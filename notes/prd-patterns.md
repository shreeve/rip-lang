# PRD Generic Fixes - Reference Documentation

Extracted from solar-old.rip (99.3% success rate, 955/962 tests)

## Critical Fixes for Clean-Room Implementation

### Fix #20: EOF Validation (Lines 820-840)
**Problem:** Parser accepts partial input - `'3 extends 2'` parses as just `3`.
**Detection:** After parseRoot() completes, check if tokens remain.
**Solution:**
```javascript
if (this.la && this.la.id !== SYM_EOF && this.la.id !== SYM_TERMINATOR) {
  this._error([SYM_EOF], this.la.id);
}
```
**Impact:** Catches invalid syntax that would otherwise succeed partially.

### Fix #21: Return Comma Tokens (Lines 1327-1333, 3640-3646)
**Problem:** PRD interpreted action `'null'` as JavaScript null → dense arrays `[1, null, 2]`.
**Detection:** `symbols.length === 1 && action === 'null' && !@types[symbols[0]]`
**Solution:**
```coffee
# In action compilation:
if symbols.length is 1 and action is 'null' and not @types[symbols[0]]
  return "return $1;"  # Return matched token, not null
```
**Impact:** Creates sparse arrays `[1, , 2]` with comma tokens, not null values.

### Fix #19: Nullable Lookahead (Lines 3360-3381, 3849-3865)
**Problem:** Nullable nonterminals always succeed, blocking longer matches.
**Example:** OptComma → '' succeeds, OptElisions → ',' Elisions never tried.
**Detection:** `@types[nonterminal].nullable === true`
**Solution:**
```javascript
$1 = this.parseOptComma();
// If trigger token follows, try longer match
if (this.la && this.la.id === triggerToken) {
  this._restoreState(_saved);
  throw new Error('Try fallback');
}
```
**Note:** In clean-room, check EXPECTED follow tokens (not just trigger).

### Fix #16: Separator Restoration (Lines 3847-3865)
**Problem:** Orphaned separator tokens when element doesn't follow.
**Detection:** Separator-based left-recursive patterns `A → B | A sep B`
**Solution:**
```javascript
while (this.la && this.la.id === SYM_SEP) {
  const _saved = this._saveState();  // BEFORE match
  const sep = this._match(SYM_SEP);  // Consume
  
  if (!this.la || !firstSet.includes(this.la.id)) {
    this._restoreState(_saved);  // Undo match
    break;
  }
  
  separators.push(sep);
  elements.push(this.parseElement());
}
```

## Additional Generic Fixes from solar-old.rip

### Fix #1: Nullable-First Rule Inclusion (Lines 1113-1121)
**Problem:** Skipping nullable-first rules prevented conflict detection.
**Solution:** Include nullable rules in dispatch for conflict analysis.

### Fix #2: Passthrough Detection (Lines ~1400-1500)
**Problem:** Single-nonterminal rules needed special handling.
**Solution:** Detect rules with single nonterminal symbol, generate direct calls.

### Fix #3: Multi-Hop Cycle Detection (Lines ~1600-1700)
**Problem:** Indirect left-recursion not detected (A → B, B → A α).
**Solution:** DFS traversal to find cycles through multiple hops.

### Fix #4: Gateway Generation (Lines 2124-2130)
**Problem:** Moved postfix rules need entry points.
**Solution:** Generate gateway cases that parse and jump to postfix loop.

### Fix #5: Inline Code Overlap (Lines 2347-2352)
**Problem:** Extracting parser calls lost context (SUPER Arguments vs plain Arguments).
**Solution:** Use full inline code in try/catch, don't extract fragments.

### Fix #6: Nonterminal-First Rules (Lines 3177-3182)
**Problem:** Assumed all rules start with terminals.
**Solution:** Check `@types[firstSymbol]` to detect nonterminal starts.

### Fix #7: Mixed Terminal/Nonterminal (Lines 3343-3348)
**Problem:** Rules with both terminal and nonterminal starts need disambiguation.
**Solution:** Generate try/catch for nonterminal-first, fallback to terminal-first.

### Fix #8: Different-Target Disambiguation (Lines 3409-3415)
**Problem:** Multiple nonterminal-first rules need separate try/catch.
**Solution:** Try each nonterminal parser in sequence.

### Fix #9: Postfix Variant Sorting (Lines 2490-2495)
**Problem:** Try/catch order matters for specificity.
**Solution:** Sort by operation count (more specific first).

### Fix #10: Prefix Operator Precedence (Lines 2836-2840)
**Problem:** Unary operators consumed too much (- 5 + 10 parsed as -(5 + 10)).
**Solution:** Pass (precedence - 1) to limit consumption.

### Fix #11: Operator Precedence Extraction (Lines ~2900-3000)
**Problem:** Need precedence map for climbing algorithm.
**Solution:** Generate OPERATOR_PRECEDENCE from @operators.

### Fix #12: Compound Assignment Handling (Lines ~3050-3100)
**Problem:** +=, -=, etc. need precedence integration.
**Solution:** Include in precedence map with assignment precedence.

### Fix #13: Position Remapping (Lines ~3700-3750)
**Problem:** Multi-separator variables need correct mapping.
**Solution:** Track separator positions, remap $N variables.

### Fix #14: Bare Terminal/Nonterminal Disambiguation (Lines 3281-3286)
**Problem:** Single-symbol rules need type-aware handling.
**Solution:** Check if nonterminal vs terminal, generate appropriately.

### Fix #15: Duplicate Cases for Multi-FIRST (Lines 2538-2545)
**Problem:** Nonterminals with multiple FIRST tokens only get one case.
**Solution:** Clone case for each FIRST token.

### Fix #16-21: Additional Pattern Fixes
(See solar-old.rip for details - these are variations on themes above)

## Key Patterns for Clean-Room Implementation

### Pattern 1: Structural Detection Only
```coffee
# ✅ GOOD - Generic
if rule.symbols.length is 1 and not @types[rule.symbols[0]]
  # Single terminal rule

# ❌ BAD - Hardcoded
if typeName is 'Array' and rule contains 'Elision'
  # Specific to grammar
```

### Pattern 2: FIRST/FOLLOW Usage
```coffee
# Check what can start a nonterminal
firstTokens = Array.from(@types[nonTerminal].firsts)

# Check what can follow
followTokens = Array.from(@types[nonTerminal].follows)
```

### Pattern 3: Metadata Preservation
```coffee
# Always return complete tokens
return this._match(SYM_IDENTIFIER);  # ✅ String object
# Never:
return this._match(SYM_IDENTIFIER).value;  # ❌ Loses metadata
```

### Pattern 4: State Management
```coffee
# Save before risky operations
const _saved = this._saveState();
try {
  // Parse attempt
} catch (e) {
  this._restoreState(_saved);  # Backtrack
}
```

## Reference Map: Fix → solar-old.rip Location

| Fix # | Description | Lines | Critical? |
|-------|-------------|-------|-----------|
| 20 | EOF validation | 820-840 | ✅ Yes |
| 21 | Comma tokens | 1327-1333, 3640-3646 | ✅ Yes |
| 19 | Nullable lookahead | 3360-3381, 3849-3865 | ✅ Yes |
| 16 | Separator restoration | 3847-3865 | ✅ Yes |
| 1 | Nullable-first inclusion | 1113-1121 | ⚠️ Medium |
| 2-18 | Various patterns | Throughout | ℹ️ Reference |

## Implementation Priority

1. **Must have** (Phase 3-6): Fixes #20, #21, #16
2. **Critical** (Phase 7-8): Fix #19, elision ordering
3. **Important** (Phase 9-10): Precedence, action compilation
4. **Nice to have** (Phase 11): Edge case optimizations

**Strategy:** Implement must-haves first, validate with tests, then add critical fixes.

