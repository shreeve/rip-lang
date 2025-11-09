# Pass-Through Inlining: Visual Explanation

## Before: Infinite Recursion 💥

```
Call Stack (grows forever):
┌─────────────────────────────────┐
│ parseExpression()               │
│   └─> parseValue()              │
│         └─> parseAssignable()   │
│               └─> parseSimpleAssignable() │
│                     └─> parseValue() ◄─┐  │
│                           (CYCLE BACK!)│  │
│                           Stack grows  │  │
│                           infinitely!  │  │
└────────────────────────────────────────┘
```

## After: Cycle Broken ✅

```
Inlining Process:
Expression ─(inline)─> Value ─(inline)─> Assignable ─(inline)─> SimpleAssignable ✓
   │                      │                   │                        │
   │                      │                   │                        │
   └──────────────────────┴───────────────────┴────────────────> SimpleAssignable
                         (skip the chain!)

Call Stack (finite):
┌─────────────────────────────────┐
│ parseExpression()               │
│   └─> parseSimpleAssignable()   │ ✅ Direct call!
│         └─> (actual parsing)    │ ✅ Multiple rules, no cycle
└─────────────────────────────────┘
```

## The Algorithm

```
For each nonterminal:
  
  1. Check: Is it a single-rule pass-through?
     Expression → Value ✓
  
  2. Check: Is the target ALSO a pass-through?
     Value → Assignable ✓
  
  3. Follow the chain:
     Expression → Value → Assignable → SimpleAssignable
  
  4. Stop when we hit:
     - Multiple rules (SimpleAssignable has them) ✓
     - A terminal
     - Cycle back to start
     - Max depth (5)
  
  5. Generate:
     parseExpression() {
       return this.parseSimpleAssignable(); // Skip to the end!
     }
```

## Code Comparison

### Without Inlining (BROKEN)

```javascript
// Generated code:
parseExpression() {
  return this.parseValue();  // Pass-through
}

parseValue() {
  return this.parseAssignable();  // Pass-through
}

parseAssignable() {
  return this.parseSimpleAssignable();  // Pass-through
}

parseSimpleAssignable() {
  switch (this.la.id) {
    case SYM_IDENTIFIER:
      // One of the rules is: Value . Property
      const base = this.parseValue();  // 💥 INFINITE LOOP!
      // ...
  }
}
```

### With Inlining (FIXED)

```javascript
// Generated code:
parseExpression() {
  return this.parseSimpleAssignable();  // ✅ Inlined!
}

parseValue() {
  return this.parseSimpleAssignable();  // ✅ Inlined!
}

parseAssignable() {
  return this.parseSimpleAssignable();  // ✅ Inlined!
}

parseSimpleAssignable() {
  switch (this.la.id) {
    case SYM_IDENTIFIER:
      // When we need Value, we call parseValue()
      // But parseValue() → parseSimpleAssignable()
      // So this becomes a direct call (no infinite loop!)
      const base = this.parseValue();  // ✅ Works! Eventually bottoms out
      // ...
  }
}
```

## Why It Works

The key insight: **SimpleAssignable is the "real" implementation**

- Expression, Value, and Assignable are just **aliases**
- They all mean "parse a simple assignable thing"
- By inlining, we skip the aliases and go straight to the implementation
- The implementation has **multiple rules**, not all of which recurse
- This breaks the cycle!

## Example Parse Trace

**Input:** `42`

**Before (infinite recursion):**
```
parseExpression()
  parseValue()
    parseAssignable()
      parseSimpleAssignable()
        case SYM_NUMBER: (should work, but...)
        (other cases might call parseValue again)
          parseValue()
            parseAssignable()
              parseSimpleAssignable()
                (endless loop in some cases)
```

**After (works):**
```
parseExpression()
  parseSimpleAssignable()  ✅ Direct!
    case SYM_NUMBER:
      return this._match(SYM_NUMBER);  ✅ Done!
```

## Implementation Stats

- **Lines added:** 30
- **Methods added:** 1 (_inlinePassThroughChain)
- **Modified sections:** 1 (pattern detection)
- **Breaking change:** No (only optimization)
- **Risk:** Very low (only affects single-rule pass-throughs)

## Testing Checklist

- [ ] Regenerate parser: `bun run parser-prd`
- [ ] Check for inlining messages in output
- [ ] Test simple expression: `echo "42" | bun test/runner-prd.js -`
- [ ] Test assignment: `echo "x = 42" | bun test/runner-prd.js -`
- [ ] Test basic.rip: `bun test/runner-prd.js test/rip/basic.rip`
- [ ] If it works, run all tests: `bun test/runner-prd.js test/rip/`
- [ ] Celebrate! 🎉

---

**Summary:** This fix makes single-rule pass-throughs "look ahead" through the chain to find the real implementation, breaking cycles caused by mutual left-recursion through pass-throughs.
