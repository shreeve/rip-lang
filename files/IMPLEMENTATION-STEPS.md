# Quick Fix Implementation Guide

## Step 1: Apply the Fix

Replace your `solar.rip` file with the modified version:

```bash
cp /path/to/outputs/solar.rip src/grammar/solar.rip
```

Or manually apply these two changes:

### Change 1: Add Helper Method (insert before line 1375, before `_generatePassThroughDispatch`)

```coffeescript
  # ============================================================================
  # Pass-Through Chain Inlining (breaks mutual left-recursion cycles)
  # ============================================================================

  _inlinePassThroughChain: (startNt, targetNt, visited = new Set(), depth = 0) ->
    # Prevent infinite loops
    return targetNt if depth > 5
    return targetNt if visited.has(targetNt)
    return targetNt if targetNt is startNt  # Detect cycle back to start
    
    visited.add(targetNt)
    
    # Check if target is also a single-rule pass-through
    targetRules = @types[targetNt]?.rules
    return targetNt unless targetRules
    
    # If target has multiple rules or isn't a pass-through, stop here
    return targetNt unless targetRules.length is 1
    return targetNt unless targetRules[0].symbols.length is 1
    
    nextSymbol = targetRules[0].symbols[0]
    
    # If next symbol is a terminal, stop
    return targetNt unless @types[nextSymbol]
    
    # Recursively inline
    @_inlinePassThroughChain(startNt, nextSymbol, visited, depth + 1)
```

### Change 2: Modify Pass-Through Detection (around line 873)

**Find this:**
```coffeescript
    # Check if all rules are single-symbol pass-throughs
    if rules.every((r) -> r.symbols.length is 1)
      console.log "      → Pass-through dispatch"
      return @_generatePassThroughDispatch name, rules
```

**Replace with this:**
```coffeescript
    # Check if all rules are single-symbol pass-throughs
    if rules.every((r) -> r.symbols.length is 1)
      # Special case: single pass-through to another nonterminal
      if rules.length is 1
        target = rules[0].symbols[0]
        
        # AGGRESSIVE INLINING: Follow pass-through chains to break cycles
        if @types[target]
          inlinedTarget = @_inlinePassThroughChain(name, target)
          if inlinedTarget isnt target
            console.log "      → Pass-through (inlined #{name} → #{inlinedTarget})"
            return """
              parse#{name}() {
                return this.parse#{inlinedTarget}();
              }
            """
      
      console.log "      → Pass-through dispatch"
      return @_generatePassThroughDispatch name, rules
```

## Step 2: Regenerate the Parser

```bash
bun run parser-prd
```

**Look for these messages:**
```
Generating parseExpression...
  → Pass-through (inlined Expression → SimpleAssignable)
Generating parseValue...
  → Pass-through (inlined Value → SimpleAssignable)
Generating parseAssignable...
  → Pass-through (inlined Assignable → SimpleAssignable)
```

This confirms the inlining is working!

## Step 3: Verify the Generated Code

Check that the cycle is broken:

```bash
grep -A 3 "parseExpression()" src/parser-prd.js
```

**Should see:**
```javascript
parseExpression() {
  return this.parseSimpleAssignable();
}
```

**NOT:**
```javascript
parseExpression() {
  return this.parseValue();  // ❌ Would cause cycle
}
```

## Step 4: Test Parsing

**Test 1: Simple literal**
```bash
echo "42" | bun test/runner-prd.js -
```

**Expected:** Should parse without stack overflow and return the AST

**Test 2: Assignment**
```bash
echo "x = 42" | bun test/runner-prd.js -
```

**Expected:** Should parse successfully

**Test 3: Basic file**
```bash
bun test/runner-prd.js test/rip/basic.rip
```

**Expected:** Should complete without errors

## Step 5: Full Test Suite (if Step 4 works)

```bash
bun test/runner-prd.js test/rip/
```

**Expected:** All 962 tests pass! 🎉

## Troubleshooting

### Still Getting Stack Overflow?

**Check 1:** Is SimpleAssignable also a pass-through?
```bash
grep -A 10 "parseSimpleAssignable()" src/parser-prd.js
```

If it's ALSO just `return this.parseXXX()`, we need to inline deeper.

**Fix:** Increase max depth from 5 to 10 in `_inlinePassThroughChain`:
```coffeescript
return targetNt if depth > 10  # Was: depth > 5
```

**Check 2:** Different cycle?
```bash
# Run with stack trace to see which functions are looping
bun test/runner-prd.js test/rip/basic.rip 2>&1 | tail -50
```

Look for repeated function names in the stack trace.

### Parse Errors Instead of Stack Overflow?

**This is progress!** Stack overflow is fixed, now we have different issues.

Check what's failing:
```bash
bun test/runner-prd.js test/rip/basic.rip
```

Common issues:
1. **Missing pattern handlers** - Some patterns not generating correctly
2. **Wrong semantic actions** - Actions not transformed properly
3. **FIRST/FOLLOW set issues** - Token dispatch is wrong

Debug by:
```bash
grep -A 30 "parseFailing Function" src/parser-prd.js
```

### Generated Code Looks Wrong?

**Check symbol constants:**
```bash
grep "^const SYM_" src/parser-prd.js | head -20
```

Should see clean constants like:
```javascript
const SYM_IDENTIFIER = 3;
const SYM_NUMBER = 4;
// etc.
```

**Check helper methods:**
```bash
grep -A 5 "_match(" src/parser-prd.js | head -10
```

Should have proper _match, _error implementations.

## Success Criteria

✅ No stack overflow on `echo "42" | bun test/runner-prd.js -`
✅ basic.rip parses successfully  
✅ Generated parser is ~1,200-1,400 lines
✅ No duplicate cases within functions
✅ Semantic actions are correct arrays

## What's Next After This Works?

1. **Fix any remaining parser bugs** - Some patterns might need tweaking
2. **Run all 962 tests** - Verify 100% compatibility
3. **Benchmark performance** - Should be 40-120x faster
4. **Update documentation** - Note the inlining strategy
5. **Ship it!** 🚀

---

## Quick Reference

**Files:**
- Modified: `src/grammar/solar.rip` (your generator)
- Generated: `src/parser-prd.js` (the output)
- Tests: `test/rip/*.rip` (test cases)

**Commands:**
- Generate: `bun run parser-prd`
- Test one: `bun test/runner-prd.js test/rip/basic.rip`
- Test all: `bun test/runner-prd.js test/rip/`
- Inspect: `grep -A 30 "parseYield" src/parser-prd.js`

**What Changed:**
- Added: `_inlinePassThroughChain()` method
- Modified: Pass-through detection logic
- Effect: Breaks cycles in pass-through chains

---

**You're 30 lines of code away from a working PRD generator!** 🎯

Apply the fix, regenerate, and test. If you hit issues, check the troubleshooting section above.

The architecture is sound, the implementation is beautiful - we just needed to handle this one grammar pattern. Let's ship it! 💪
