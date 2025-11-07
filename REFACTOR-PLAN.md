# Refactoring Plan: Extract Dispatch Table (Issue #52)

## Current State
- **Method:** `generate()` at lines 266-3144
- **Size:** 2,879 LOC (57% of file!)
- **Cases:** 110 total

## Target State
- **Dispatcher:** ~50 LOC with lookup table
- **Methods:** 110 focused methods (~25 LOC average)
- **Organization:** Grouped by category

---

## Case Categorization (110 total)

### Category 1: OPERATORS - Binary (35 cases)
**Arithmetic:** `+` `-` `*` `/` `%` `**` `%%` `//`
**Comparison:** `==` `===` `!=` `!==` `<` `>` `<=` `>=`
**Logical:** `&&` `||` `??` `!?`
**Bitwise:** `&` `|` `^` `<<` `>>` `>>>`
**Assignment:** `=` `+=` `-=` `*=` `/=` `%=` `**=` `//=` `&&=` `||=` `?=` `??=` `&=` `|=` `^=` `<<=` `>>=` `>>>=`
**Other:** `..` `...` `=~`

### Category 2: OPERATORS - Unary (4 cases)
`!` `~` `++` `--` `typeof` `delete`

### Category 3: PROPERTY ACCESS (6 cases)
`.` `?.` `::` `?::` `[]` `?[]` `optindex`

### Category 4: FUNCTION CALLS (2 cases)
`?call` `optcall`

### Category 5: CONTROL FLOW - Conditionals (5 cases)
`if` `unless` `?:` `?` `switch` `when`

### Category 6: CONTROL FLOW - Loops (8 cases)
`for-in` `for-of` `for-from` `while` `until` `loop` `break` `continue` `break-if` `continue-if`

### Category 7: FUNCTIONS (4 cases)
`def` `->` `=>` `return`

### Category 8: DATA STRUCTURES (2 cases)
`array` `object`

### Category 9: COMPREHENSIONS (2 cases)
`comprehension` `object-comprehension`

### Category 10: CLASSES (3 cases)
`class` `super` `?super`

### Category 11: ASYNC/GENERATORS (3 cases)
`await` `yield` `yield-from`

### Category 12: MODULES (5 cases)
`import` `export` `export-default` `export-all` `export-from`

### Category 13: SPECIAL FORMS (11 cases)
`program` `block` `new` `instanceof` `in` `of` `try` `throw` `do-iife` `regex` `tagged-template` `str`

---

## Refactoring Strategy

### Phase 1: Infrastructure (30 minutes)
1. Create dispatch table
2. Add category comment sections
3. Test with 1-2 extracted methods

### Phase 2: Extract by Category (4-6 hours)
Extract systematically, testing after each category:

1. **Operators** (1 hour) - Most similar, can batch
2. **Property Access** (30 min) - Similar patterns
3. **Control Flow** (1 hour) - More complex
4. **Functions** (30 min) - Well-defined
5. **Data Structures** (30 min) - Straightforward
6. **Comprehensions** (30 min) - Already have helpers
7. **Classes/Async/Modules** (45 min) - Specialized
8. **Special Forms** (1 hour) - Varied

### Phase 3: Verification (30 minutes)
1. Run all 931 tests
2. Verify no behavior changes
3. Check performance

### Phase 4: Release (30 minutes)
1. Update README
2. Bump version
3. Rebuild
4. Update CHANGELOG
5. Commit, push, PR, merge

**Total Estimated Time:** 6-8 hours of focused work

---

## Method Naming Convention

```javascript
// Binary operators: generateBinaryOp (shared)
// Unary operators: generateUnaryOp (shared)
// Specific: generate<NodeType>

'+': 'generateBinaryOp',
'if': 'generateIf',
'for-in': 'generateForIn',
'array': 'generateArray',
```

---

## Safety Checklist

- [ ] All 931 tests pass before starting
- [ ] Run tests after each category extraction
- [ ] No behavior changes (pure refactoring)
- [ ] Performance doesn't regress
- [ ] All 931 tests pass at end

