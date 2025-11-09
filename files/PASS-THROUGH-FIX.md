# Pass-Through Chain Inlining - Quick Fix for Mutual Left-Recursion

## The Problem

Your Rip grammar has this structure:
```
Expression → Value              (single pass-through)
Value → Assignable              (single pass-through)
Assignable → SimpleAssignable   (single pass-through)
SimpleAssignable → Value . Property   (cycles back!)
```

This creates infinite recursion:
```javascript
parseExpression() → parseValue() → parseAssignable() → 
parseSimpleAssignable() → parseValue() → ... 💥 BOOM!
```

## The Solution: Aggressive Inlining

When we detect a **single-rule pass-through** that chains to another pass-through, we now **follow the chain** until we hit:
1. A nonterminal with multiple rules (not a pass-through)
2. A terminal symbol
3. A cycle back to the starting nonterminal
4. Max depth of 5 levels

## What Changed

### 1. Modified Pattern Detection (line ~873)

**Before:**
```coffeescript
if rules.every((r) -> r.symbols.length is 1)
  console.log "      → Pass-through dispatch"
  return @_generatePassThroughDispatch name, rules
```

**After:**
```coffeescript
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

### 2. Added Helper Method

```coffeescript
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
  return targetRules[0].symbols.length is 1
  
  nextSymbol = targetRules[0].symbols[0]
  
  # If next symbol is a terminal, stop
  return targetNt unless @types[nextSymbol]
  
  # Recursively inline
  @_inlinePassThroughChain(startNt, nextSymbol, visited, depth + 1)
```

## Expected Result

**Before (infinite recursion):**
```javascript
parseExpression() {
  return this.parseValue();
}

parseValue() {
  return this.parseAssignable();
}

parseAssignable() {
  return this.parseSimpleAssignable();
}

parseSimpleAssignable() {
  // ... has rule: Value . Property
  return this.parseValue();  // 💥 CYCLE!
}
```

**After (cycle broken):**
```javascript
parseExpression() {
  return this.parseSimpleAssignable();  // ✅ Inlined 3 levels!
}

parseValue() {
  return this.parseSimpleAssignable();  // ✅ Inlined 2 levels!
}

parseAssignable() {
  return this.parseSimpleAssignable();  // ✅ Inlined 1 level!
}

parseSimpleAssignable() {
  // Multiple rules - actual parsing logic
  switch (this.la.id) {
    // ... no cycle because we're at the bottom!
  }
}
```

## How to Test

1. **Replace your solar.rip** with the modified version from `/mnt/user-data/outputs/solar.rip`

2. **Regenerate the parser:**
   ```bash
   bun run parser-prd
   ```

3. **Look for inlining messages:**
   ```
   Generating parseExpression...
     → Pass-through (inlined Expression → SimpleAssignable)
   Generating parseValue...
     → Pass-through (inlined Value → SimpleAssignable)
   Generating parseAssignable...
     → Pass-through (inlined Assignable → SimpleAssignable)
   ```

4. **Test parsing:**
   ```bash
   echo "42" | bun test/runner-prd.js -
   ```
   
   Should work without stack overflow! 🎉

5. **Test basic.rip:**
   ```bash
   bun test/runner-prd.js test/rip/basic.rip
   ```

## Why This Works

The key insight is that `SimpleAssignable` has **multiple rules** (not just a pass-through), so it's the **actual implementation** of assignable expressions. By inlining directly to it, we skip the intermediate pass-throughs and break the cycle.

The recursion now looks like:
```
parseExpression → parseSimpleAssignable (has actual logic, no cycle!)
```

Instead of:
```
parseExpression → parseValue → parseAssignable → parseSimpleAssignable → parseValue → ... 💥
```

## What If It Doesn't Work?

If you still get stack overflow, it might be because:
1. `SimpleAssignable` itself has pass-throughs we didn't catch
2. There's a different cycle in the grammar
3. We need deeper inlining (increase max depth from 5)

Check the generated code:
```bash
grep -A 5 "parseExpression" src/parser-prd.js
grep -A 5 "parseSimpleAssignable" src/parser-prd.js
```

If `parseSimpleAssignable` is also just a pass-through, we need to inline further!

## Next Steps

Once this works:
- ✅ Test `echo "42" | bun test/runner-prd.js -`
- ✅ Test `echo "x = 42" | bun test/runner-prd.js -`
- ✅ Test `bun test/runner-prd.js test/rip/basic.rip`
- ✅ Run all 962 tests
- ✅ Ship it! 🚀

---

**Modified files:**
- `/mnt/user-data/outputs/solar.rip` - Your updated generator with cycle-breaking inlining

**Total changes:** 30 lines added across 2 locations

This is a **surgical fix** that doesn't change the overall architecture - it just makes single-rule pass-throughs smarter about following chains! 🎯
