# Analysis of 7 Failing Tests

Based on HANDOFF.md and solar-old.rip behavior at 99.3% (955/962 tests)

## Test #1: Array Destructuring Skip
**File:** `test/rip/assignment.rip`  
**Code:** `[a, , c] = [1,2,3]; a + c`  
**Expected Result:** 4 (a=1, skip 2, c=3)  
**Root Cause:** Array destructuring with elisions (skipped elements)

**Why PRD Failed:**
- Array rule ordering: Tried `[ ArgElisionList OptElisions ]` before `[ Elisions ]`
- Pure elisions at start `[, ,` couldn't match ArgElisionList (expects Arg first)
- Parser error instead of trying simpler elision rule

**Architectural Solution (Phase 6.1):**
```coffee
# Order Array alternatives by specificity:
# 1. Empty: [ ] (score 10)
# 2. Pure elisions: [ Elisions ] (score 9)
# 3. Mixed: [ ArgElisionList OptElisions ] (score 5)

_orderArrayAlternatives: (alternatives) ->
  scoreRule = (rule) =>
    symbols = rule.symbols.join(' ')
    return 10 if symbols is '[ ]'
    return 9 if symbols is '[ Elisions ]'
    return 5 if symbols.includes('ArgElisionList')
    return 0
  alternatives.sort (a, b) => scoreRule(b.rule) - scoreRule(a.rule)
```

**Expected S-Expression:**
```
["program",
  ["=", ["array", "a", ",", "c"], ["array", 1, 2, 3]],
  ["+", "a", "c"]
]
```

---

## Test #2: Dammit Method Call
**File:** `test/rip/async.rip`  
**Test Name:** "dammit method call"  
**Root Cause:** DO_IIFE parsing with method calls using dammit operator (!)

**Why PRD Failed:**
- Token metadata loss: Property with `.await = true` converted to primitive
- Codegen didn't see await flag, generated sync call instead of async

**Architectural Solution (Phase 6.5):**
```coffee
# CRITICAL: Never call .valueOf() or .value on tokens
# Return complete String objects from all parsers

parseProperty() {
  return this._match(SYM_PROPERTY);  # Complete token with metadata
}

# NOT:
parseProperty() {
  const token = this._match(SYM_PROPERTY);
  return token.value;  # LOSES .await METADATA!
}
```

**Token Flow:**
```
Lexer → method! → String("method") with .await=true
Parser → [".", obj, method] → method still String with .await=true
Codegen → sees method.await → generates await obj.method()
```

**Fix:** Preserve String objects throughout parsing.

---

## Test #3: Await Expression
**File:** `test/rip/async.rip`  
**Test Name:** "await expression"  
**Root Cause:** Await expression evaluation in various contexts

**Why PRD Failed:**
- Await expression parsing incomplete
- May have been parsing context issue (statement vs value)

**Architectural Solution (Phase 9.5):**
```coffee
# Generate proper await parsing for both forms:
# AWAIT Expression
# AWAIT INDENT Object OUTDENT

case SYM_AWAIT: {
  this._match(SYM_AWAIT);
  
  if (this.la && this.la.id === SYM_INDENT) {
    this._match(SYM_INDENT);
    const obj = this.parseObject();
    this._match(SYM_OUTDENT);
    return ['await', obj];
  } else {
    const expr = this.parseExpression();
    return ['await', expr];
  }
}
```

**Expected S-Expression:**
```
["await", ["call-expr"]]
```

---

## Test #4: Trailing Comma Multiline
**File:** `test/rip/basic.rip`  
**Test Name:** "trailing comma multiline"  
**Root Cause:** Multiline arrays with trailing commas

**Why PRD Failed:**
- Trailing comma after last element not handled
- OptElisions at end of array pattern

**Example Code:**
```coffee
[
  1,
  2,
]
```

**Architectural Solution (Phase 6):**
- Array rule: `[ ArgElisionList OptElisions ]`
- OptElisions handles trailing commas
- Elision generation must return comma tokens (Fix #21)

**Expected S-Expression:**
```
["array", 1, 2]  # Trailing comma is optional, discarded
```

---

## Test #5: Elision Undefined Check
**File:** `test/rip/basic.rip`  
**Test Name:** "elision undefined check"  
**Code:** `arr = [1,,2]; arr[1]`  
**Expected Result:** undefined (arr[1] is hole in sparse array)

**Why PRD Failed:**
- Multi-statement parsing: Two statements separated by semicolon
- First statement has array with elisions
- May have been parsing statement boundary incorrectly

**Architectural Solution (Phase 8.5):**
```coffee
# Body parser (left-recursive with TERMINATOR separator):
parseBody() {
  $1 = this.parseLine();
  const elements = [$1];
  
  while (this.la && this.la.id === SYM_TERMINATOR) {
    const _saved = this._saveState();
    const sep = this._match(SYM_TERMINATOR);
    
    // Check if Line follows (not EOF, not OUTDENT)
    if (!this.la || !FIRST_LINE.includes(this.la.id)) {
      this._restoreState(_saved);
      break;
    }
    
    const line = this.parseLine();
    elements.push(line);
  }
  
  return elements;
}
```

**Expected S-Expression:**
```
["program",
  ["=", "arr", ["array", 1, ",", 2]],
  ["[]", "arr", 1]
]
```

**Key:** TERMINATOR separator vs comma elision distinguished by context.

---

## Test #6: Elision Destructuring Multiple
**File:** `test/rip/basic.rip`  
**Test Name:** "elision destructuring multiple"  
**Root Cause:** Complex destructuring with multiple elisions

**Example Pattern:** `[,,a,,b] = [1,2,3,4,5]`
- Position 0: skip (1)
- Position 1: skip (2)
- Position 2: a = 3
- Position 3: skip (4)
- Position 4: b = 5
- Result: a + b = 8

**Why PRD Failed:**
- Same as Test #1: Array rule ordering
- Multiple leading elisions failed to parse

**Architectural Solution (Phase 6.1):**
- Same elision-first ordering as Test #1
- Must handle `[,,a,,b]` pattern

**Expected S-Expression:**
```
["array", ",", ",", "a", ",", ",", "b"]
```

**Fix:** Elision-first ordering + comma token return.

---

## Test #7: Invalid Extends
**File:** `test/rip/errors.rip`  
**Test Name:** "invalid extends"  
**Code:** `'3 extends 2'`  
**Expected:** Parse error (syntax invalid)  
**Actual (PRD old):** Parses as `3` (accepts partial input)

**Why PRD Failed:**
- No EOF validation after parseRoot()
- Parser consumed `3`, stopped, returned success
- Never checked if `extends 2` remained unparsed

**Architectural Solution (Phase 3.2 - Fix #20):**
```coffee
parseRoot() {
  const result = this.parseBody();
  
  // EOF VALIDATION: Ensure all tokens consumed
  if (this.la && this.la.id !== SYM_EOF && this.la.id !== SYM_TERMINATOR) {
    this._error([SYM_EOF], this.la.id);
  }
  
  return ['program', ...result];
}
```

**Result:** Parser throws error on incomplete input.

---

## Summary: Test to Phase Mapping

| Test # | Name | Phase | Core Fix | Validation |
|--------|------|-------|----------|------------|
| 1 | array destructuring skip | 6.1 | Elision ordering | `[a, , c] = [1,2,3]` |
| 2 | dammit method call | 6.5 | Metadata preservation | `do obj.method!` |
| 3 | await expression | 9.5 | Await parsing | `await fn()` |
| 4 | trailing comma | 6 | Elision handling | `[1, 2,]` |
| 5 | elision undefined | 8.5 | Multi-statement | `arr = [1,,2]; arr[1]` |
| 6 | elision destructuring | 6.1 | Elision ordering | `[,,a,,b] = [1,2,3,4,5]` |
| 7 | invalid extends | 3.2 | EOF validation | `'3 extends 2'` error |

## Common Themes

1. **Elisions (Tests 1, 4, 5, 6):** Array rule ordering + comma token return
2. **Metadata (Test 2):** Preserve String objects, never convert to primitives
3. **Context (Tests 3, 5):** Parse in appropriate context (async, statement boundary)
4. **Validation (Test 7):** Check complete input consumed

## Implementation Order

Phase 3.2 (EOF) → Phase 5 (Separator) → Phase 6 (Elisions) → Phase 6.5 (DO_IIFE) → Phase 8.5 (Multi-statement) → Phase 9.5 (Await)

**Result:** All 7 tests should pass by end of Phase 11.

