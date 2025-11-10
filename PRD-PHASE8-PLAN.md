# PRD Parser - Phase 8 Implementation Plan

**Objective:** Achieve 100% grammar coverage and pass all 962 tests

**Status:** Phase 7 complete. 35/86 functions (41%). Need 51 more functions for full coverage.

---

## Critical Reality Check

**Current State:**
- ✅ 35 functions working (41%)
- ✅ 88% file size reduction
- ❌ **Only 41% of grammar covered**
- ❌ **Most tests will fail** (For, While, If, Expression not working)
- ❌ **Language doesn't actually work** for real code

**Phase 8 Goal:** Get to 86/86 functions (100%) and pass all 962 tests.

**This is the REAL work.** Phases 1-7 were foundation. Phase 8 makes it actually work.

---

## The 51 Missing Functions

Let me list ALL functions we still need to generate:

### Category 1: Expression & Statement (CRITICAL - 2 functions)
```
❌ Expression - The core! Dispatches to Value, Operation, Statement
❌ Statement - Return, Import, Export, etc. (or inline into Expression)
```

**Why critical:** Without Expression, can't parse most code. This is THE blocker.

### Category 2: Control Flow (8 functions)
```
❌ If - if/then/else
❌ IfBlock - if blocks
❌ UnlessBlock - unless blocks  
❌ While - while loops
❌ Loop - infinite loops
❌ For - for loops (complex!)
❌ ForValue - for loop values
❌ ForVariables - for loop variables
```

### Category 3: Pattern Matching & Destructuring (10 functions)
```
❌ Assign - Assignment with patterns
❌ AssignObj - Object destructuring
❌ ObjAssignable - Object pattern matching
❌ SimpleObjAssignable - Simple object patterns
❌ AssignList - List destructuring
❌ Splat - Spread operator in patterns
❌ Slice - Array slicing
❌ ForVar - For loop variable patterns
❌ Param - Function parameters
❌ ParamVar - Parameter variables
```

### Category 4: Complex Expressions (6 functions)
```
❌ Parenthetical - (expressions)
❌ OptFuncExist - Optional function existence checks
❌ OptComma - Optional trailing commas
❌ OptElisions - Optional array elisions  
❌ Elision - Array holes
❌ Elisions - Multiple holes
```

### Category 5: Switch & Try (5 functions)
```
❌ Switch - Switch statements
❌ Whens - When clauses
❌ When - Single when
❌ Try - Try/catch/finally
❌ Catch - Catch clause
```

### Category 6: Classes (4 functions)
```
❌ Class - Class definitions
❌ Import - Import statements (partially done?)
❌ Export - Export statements (partially done?)
❌ ImportDefaultSpecifier, ImportNamespaceSpecifier, etc. (8 more import/export related)
```

### Category 7: Interpolation & Regex (6 functions)
```
❌ Interpolations - String interpolation
❌ InterpolationChunk - Interpolation parts
❌ RegexWithIndex - Regex with index access
❌ (String and Regex partially done)
```

### Category 8: Misc (10+ functions)
```
❌ DoIife - Do blocks (partially done?)
❌ ObjRestValue - Object rest patterns
❌ ObjSpreadExpr - Object spread
❌ ThisProperty - @property (partially done?)
❌ RangeDots - .. vs ... (partially done?)
❌ SimpleArgs - Simple argument lists
❌ ArgElision - Argument elisions
❌ ArgElisionList - Multiple argument elisions
❌ WhileSource - While loop sources
❌ ForFromTo - For from/to loops
```

**Total needed:** ~51 functions to get from 35 → 86

---

## The Core Blocker: Expression & Statement

**Everything depends on Expression working.** Here's why:

```
If → IF Expression Block
While → WHILE Expression Block  
For → FOR ... Expression
Assign → Assignable = Expression
Array → [ ArgList ] where ArgList uses Expression
```

**Expression is called by almost everything.** Without it, the grammar is 40% complete but 0% functional.

## Strategy: Attack Expression Head-On

**Phase 8 must solve the Expression ↔ Statement cycle.** Here's how:

### Approach: Aggressive Inlining + Controlled Generation

**Step 1: Inline Statement completely**
```coffeescript
# Don't generate parseStatement at all
# Instead, when generating parseExpression, inline ALL Statement alternatives

Expression: [
  o 'Value'           # Base case
  o 'Invocation'      # Function calls  
  o 'Code'           # Arrow functions (already working)
  o 'Operation'      # Binary ops (already working)
  o 'Assign'         # Assignment
  # Statement alternatives (INLINE these):
  o 'Return'         # Already generated, call directly
  o 'STATEMENT'      # Match directly
  o 'Import'         # Already generated, call directly
  o 'Export'         # Already generated, call directly
  # Control flow (generate separately, call from Expression):
  o 'If'             # Generate parseIf, call from Expression
  o 'Try'            # Generate parseTry, call from Expression
  o 'While'          # Generate parseWhile, call from Expression
  o 'For'            # Generate parseFor, call from Expression
  o 'Throw'          # Already generated, call directly
  o 'Yield'          # Already generated, call directly
  o 'Class'          # Generate parseClass, call from Expression
  o 'Switch'         # Generate parseSwitch, call from Expression
]
```

**Key insight:** Expression becomes a BIG dispatcher. It doesn't call parseStatement - it directly dispatches to Return, Import, If, While, etc.

**Step 2: Generate control flow FIRST**
Generate these in order (no dependencies on Expression):
1. `parseIf` - can have forward reference to Expression
2. `parseWhile` - can have forward reference to Expression  
3. `parseFor` - can have forward reference to Expression
4. `parseTry` - can have forward reference to Expression
5. `parseSwitch` - can have forward reference to Expression
6. `parseClass` - can have forward reference to Expression

**Step 3: Generate Expression LAST**
After all control flow exists, generate Expression which calls them all.

**Why this works:** 
- Control flow functions can call `this.parseExpression()` even though it doesn't exist yet
- JavaScript allows forward references in same file
- When Expression is generated last, all the functions it calls already exist

---

## Implementation Plan

### Phase 8.1: Generate Control Flow (No Expression Yet)

**Add to nonterminals list (but NOT Expression):**
```coffeescript
'If', 'IfBlock', 'UnlessBlock',
'While', 'WhileSource', 'Loop',
'Try', 'Catch',
'Switch', 'Whens', 'When',
'Class'
```

**These can be generated because:**
- They have clear FIRST sets
- They call `this.parseExpression()` which is a forward reference
- JavaScript doesn't care that Expression doesn't exist yet

**Result:** 35 + 13 = 48 functions

### Phase 8.2: Generate Pattern Matching & Destructuring

**Add to nonterminals:**
```coffeescript
'Assign', 'AssignObj', 'AssignList',
'Param', 'ParamList', 'ParamVar',
'Splat', 'Slice',
'ForVar', 'ForValue', 'ForVariables'
```

**Why now:** These are needed by control flow but don't depend on Expression directly.

**Result:** 48 + 11 = 59 functions

### Phase 8.3: Generate Complex Expressions & Misc

**Add to nonterminals:**
```coffeescript
'Parenthetical',
'OptFuncExist', 'OptComma', 'OptElisions', 'Elision', 'Elisions',
'ObjRestValue', 'ObjSpreadExpr',
'Interpolations', 'InterpolationChunk',
'RegexWithIndex',
'SimpleArgs', 'ArgElision', 'ArgElisionList',
'DoIife' (if not already),
'ForFromTo' (if needed)
```

**Result:** 59 + 15 = 74 functions

### Phase 8.4: Generate Expression (THE BIG ONE)

**Remove Expression from SKIP_GENERATION**

**Modify generation to inline Statement:**
```coffeescript
# When generating Expression, if a rule is:
#   Expression → Statement
# Expand Statement's rules and add them directly to Expression

# So Expression's cases include:
case SYM_RETURN: return this.parseReturn();  # From Statement
case SYM_IMPORT: return this.parseImport();  # From Statement  
case SYM_IF: return this.parseIf();          # From Statement
case SYM_WHILE: return this.parseWhile();    # From Statement
case SYM_FOR: return this.parseFor();        # From Statement
case SYM_IDENTIFIER: return this.parseValue(); # Direct
# ... etc
```

**Result:** 74 + 1 = 75 functions

### Phase 8.5: Generate Remaining Import/Export Functions

**Add all import/export variants:**
```coffeescript
'ImportDefaultSpecifier',
'ImportNamespaceSpecifier',  
'ImportSpecifierList',
'ImportSpecifier',
'ExportSpecifierList',
'ExportSpecifier'
```

**Result:** 75 + 6 = 81 functions

### Phase 8.6: Generate Remaining Misc Functions

**Add whatever's left:**
```coffeescript
'ObjAssignable', 'SimpleObjAssignable' (if not inlined)
# ... any other stragglers
```

**Result:** 81 → 86 functions (100%!)

---

## Critical Implementation Details

### Detail 1: Forward References

**JavaScript allows calling functions before they're defined in the same file:**

```javascript
// This works!
function foo() {
  return bar();  // bar doesn't exist yet - OK!
}

function bar() {
  return 42;
}
```

**So parseIf can call parseExpression even though Expression is generated later.**

**Key:** Generate functions in the right order:
1. Control flow first (If, While, For, Try, Switch, Class)
2. Patterns/destructuring next  
3. Expression last (calls everything)

### Detail 2: Inlining Statement into Expression

**When generating Expression, expand Statement:**

```coffeescript
_generateSwitchFunction: (nonTerminal, rules) ->
  if nonTerminal is 'Expression'
    # Expand Statement alternatives
    expandedRules = []
    for rule in rules
      if rule.symbols[0] is 'Statement'
        # Get Statement's rules and add them
        statementRules = @types['Statement'].rules
        for stmtRule in statementRules
          # Create pseudo-rule: Expression → Statement's alternative
          expandedRules.push({
            type: 'Expression',
            symbols: stmtRule.symbols,
            action: stmtRule.action,
            # ... copy other fields
          })
      else
        expandedRules.push(rule)
    
    # Now generate with expanded rules
    rules = expandedRules
  
  # Continue with normal generation...
```

**This makes Expression dispatch directly to Return, Import, If, etc.**

### Detail 3: Generation Order Matters

**The order functions are added to the output matters:**

```javascript
// Good order:
parseIf() { /* calls this.parseExpression() */ }
parseWhile() { /* calls this.parseExpression() */ }
parseExpression() { /* calls parseIf, parseWhile */ }

// Bad order:
parseExpression() { /* calls parseIf, parseWhile */ }
parseIf() { /* doesn't exist yet when Expression tries to call it */ }
```

**Solution:** Control the order in `_generateParseFunctions`:

```coffeescript
_generateParseFunctions: ->
  functions = []
  
  # Phase 1: Generate everything EXCEPT Expression and Statement
  for own nonTerminal of @types
    continue if nonTerminal in ['Expression', 'Statement', '$accept', 'error']
    continue if nonTerminal in SKIP_GENERATION
    functions.push @_generateParseFunction(nonTerminal)
  
  # Phase 2: Generate Expression last (calls everything else)
  if 'Expression' of @types
    functions.push @_generateParseFunction('Expression')
  
  functions.join('\n\n')
```

### Detail 4: Handle Recursive Calls in Control Flow

**If, While, For all recursively call Expression:**

```coffeescript
If: [
  o 'IF Expression Block'
  o 'IF Expression Block ELSE Block'
]
```

**Generated:**
```javascript
parseIf() {
  this._match(SYM_IF);
  const condition = this.parseExpression();  // Recursive call - OK!
  const thenBlock = this.parseBlock();
  // ...
  return ["if", condition, thenBlock];
}
```

**This is fine!** The recursion terminates when Expression reaches a base case (Identifier, Number, etc.).

---

## Testing Strategy

### Phase 8.1 Tests (Control Flow)

```bash
# After Phase 8.1 (control flow generated)
echo 'if x then y' | ./bin/rip -s
# Expected: Error (Expression not generated yet)

# But the FUNCTION exists:
grep "parseIf()" parser-prd.js
# Should find it!
```

### Phase 8.2 Tests (Patterns)

```bash
# After Phase 8.2
echo '[a, b] = [1, 2]' | ./bin/rip -s  
# Expected: Still error (Expression not generated)
```

### Phase 8.3 Tests (Misc)

```bash
# After Phase 8.3
echo '(1 + 2)' | ./bin/rip -s
# Expected: Still error (Expression not generated)
```

### Phase 8.4 Tests (Expression - THE BIG TEST)

```bash
# After Phase 8.4 - SHOULD WORK!
echo 'x' | ./bin/rip -s
# Expected: (program x)

echo 'if x then y' | ./bin/rip -s
# Expected: (program (if x y))

echo 'for x in arr then y' | ./bin/rip -s
# Expected: (program (for x arr y))

echo '[a, b] = [1, 2]' | ./bin/rip -s
# Expected: (program (= [a b] [1 2]))
```

### Phase 8.5-8.6 Tests (Completion)

```bash
# After all phases - run FULL test suite
npm test
# Expected: 962/962 tests passing!
```

---

## Potential Issues & Solutions

### Issue 1: Expression Becomes Too Large

**Problem:** Expression with inlined Statement might have 50+ case labels.

**Solution:** That's OK! It's just a big switch statement. Better than circular dependency.

**Alternative:** Generate Statement normally but accept the circular dependency (JavaScript allows it).

### Issue 2: Function Order Causes Runtime Errors

**Problem:** A function calls another that's defined later in the file.

**Solution:** 
- Ensure control flow generated before Expression
- Test incrementally after each phase
- If errors occur, reorder generation

### Issue 3: Some Functions Still Can't Be Generated

**Problem:** Even with Expression working, some functions might have issues.

**Solution:**
- Keep minimal SKIP_GENERATION list
- For any function that truly can't be generated, document why
- Aim for 95%+ coverage, 100% if possible

### Issue 4: Tests Fail Due to AST Differences

**Problem:** PRD parser generates slightly different AST than table parser.

**Solution:**
- Compare outputs carefully
- Fix action compilation if needed
- Actions must match exactly for tests to pass

---

## Implementation Checklist

### Phase 8.1: Control Flow
- [ ] Add If, IfBlock, UnlessBlock to nonterminals
- [ ] Add While, WhileSource, Loop to nonterminals
- [ ] Add Try, Catch to nonterminals
- [ ] Add Switch, Whens, When to nonterminals
- [ ] Add Class to nonterminals
- [ ] Generate and verify functions exist
- [ ] **Don't test yet** (Expression not generated)

### Phase 8.2: Patterns
- [ ] Add Assign, AssignObj, AssignList to nonterminals
- [ ] Add Param, ParamList, ParamVar to nonterminals
- [ ] Add Splat, Slice to nonterminals
- [ ] Add ForVar, ForValue, ForVariables to nonterminals
- [ ] Generate and verify functions exist

### Phase 8.3: Misc
- [ ] Add Parenthetical to nonterminals
- [ ] Add OptFuncExist, OptComma, OptElisions, Elision, Elisions
- [ ] Add ObjRestValue, ObjSpreadExpr
- [ ] Add Interpolations, InterpolationChunk, RegexWithIndex
- [ ] Add SimpleArgs, ArgElision, ArgElisionList
- [ ] Generate and verify functions exist

### Phase 8.4: Expression (CRITICAL)
- [ ] Remove Expression from SKIP_GENERATION
- [ ] Implement Statement inlining in generation
- [ ] Generate parseExpression
- [ ] **TEST IMMEDIATELY** - verify basic expressions work
- [ ] Test control flow (if, while, for)
- [ ] Test assignments
- [ ] Compare output with table mode

### Phase 8.5: Import/Export
- [ ] Add ImportDefaultSpecifier, ImportNamespaceSpecifier
- [ ] Add ImportSpecifierList, ImportSpecifier
- [ ] Add ExportSpecifierList, ExportSpecifier
- [ ] Generate and test

### Phase 8.6: Remaining
- [ ] Generate any remaining functions
- [ ] Remove any remaining items from SKIP_GENERATION
- [ ] Verify 86/86 functions generated

### Phase 8.7: Full Test Suite
- [ ] Run `npm test`
- [ ] Fix any failing tests
- [ ] Iterate until 962/962 passing

---

## Success Criteria

✅ **86/86 functions generated** (100% coverage)
✅ **Expression working** - parses identifiers, operations, control flow
✅ **Control flow working** - if, while, for, try, switch
✅ **Patterns working** - destructuring, splats, assignments
✅ **962/962 tests passing** - full compatibility
✅ **File size < 80KB** - still much smaller than 294KB table
✅ **No regressions** - Phases 1-7 features still work
✅ **Output identical to table mode** - for all test cases

---

## Expected Outcome

### File Size
- Phase 7: 35KB (41% coverage)
- Phase 8: ~60-80KB (100% coverage)
- Table: 294KB
- **Reduction: 73-80%** (still significant!)

### Coverage
- Phase 7: 35/86 functions (41%)
- Phase 8: 86/86 functions (100%)

### Tests
- Phase 7: ~40% of tests passing (estimate)
- Phase 8: 962/962 tests passing (100%)

### What Works (Everything!)
```
✅ All literals, identifiers, numbers, strings
✅ All binary operators with correct precedence
✅ All control flow (if, while, for, try, switch)
✅ All patterns (destructuring, splats)
✅ All statements (return, yield, throw, import, export)
✅ All expressions (assignments, calls, accessors)
✅ Arrow functions
✅ Classes
✅ String interpolation
✅ Regex
✅ Arrays, objects with all features
✅ Everything in the CoffeeScript grammar!
```

---

## Critical Reminders

**Before starting Phase 8:**
1. This is a BIG phase - 51 functions to add
2. Break it into sub-phases (8.1, 8.2, etc.)
3. Test after EACH sub-phase
4. Expression is the key - everything unlocks after that

**During Phase 8:**
1. Generate in the right order (control flow → Expression)
2. Inline Statement into Expression
3. Test incrementally
4. Don't rush - verify each batch works

**Phase 8.4 is make-or-break:**
- If Expression generates successfully, 90% of work is done
- If Expression fails, debug carefully before proceeding
- The full test suite should pass after Expression works

**After Phase 8:**
- Run full test suite
- Compare every test output with table mode
- Fix any mismatches in AST generation
- Iterate until 962/962 passing

---

## Final Note

**Phase 8 is where we finish the job.** Phases 1-7 built the foundation. Phase 8 makes it a complete, working language parser.

**This is achievable!** The hard problems (lookahead, precedence, left-recursion) are solved. Phase 8 is "just" expanding coverage systematically.

**Target: 86/86 functions, 962/962 tests, < 80KB file size** 🎯

Let's finish this! 🚀
