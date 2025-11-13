# Multiline Objects Issue - Technical Deep Dive

## Status: UNRESOLVED (Low Priority - ~4 tests / 1%)

## The Problem

Multiline objects fail to parse in PRD mode:

```bash
# ✅ WORKS
echo '{a: 1}' | ./bin/rip -s

# ❌ FAILS
echo 'obj = {
  x: 1
}' | ./bin/rip -s
# Error: Parse error... got {
```

## Root Cause Analysis

### Token Difference

**Inline:** `{ PROPERTY : NUMBER }`  
**Multiline:** `{ INDENT PROPERTY : NUMBER OUTDENT }`

### The Grammar ALREADY Handles This!

```coffeescript
AssignList: [
  o 'AssignObj'                                             # Base
  o 'AssignList , AssignObj'                                # Comma separation
  o 'AssignList OptComma TERMINATOR AssignObj'              # Terminator separation
  o 'AssignList OptComma INDENT AssignList OptComma OUTDENT' # INDENT nesting!
]
```

**The INDENT rule exists!** The table-driven parser uses it correctly.

### Why PRD Fails

**FIRST Set Problem:**
- `parseAssignList()` checks if `this.la.id` is in FIRST(AssignObj)
- FIRST(AssignObj) = `{IDENTIFIER, PROPERTY, @, [, NUMBER, STRING, ...}`
- **INDENT is NOT in this set**
- When it sees INDENT after `{`, it returns `[]` immediately
- Then parseObject tries to match `}` but encounters INDENT → ERROR

### Current Generated Code

```javascript
parseAssignList() {
  // Check if list is empty
  if (!this.la || ![SYM_IDENTIFIER, SYM_PROPERTY, ..., SYM_INDENT].includes(this.la.id)) {
    return [];
  }
  
  $1 = this.parseAssignObj();
  $1 = [$1];
  
  while (this.la && (this.la.id === SYM_COMMA || this.la.id === SYM_TERMINATOR || this.la.id === SYM_INDENT)) {
    if (this.la.id === SYM_INDENT) {
      $2 = this._match(SYM_INDENT);
      $3 = this.parseAssignList();  // Recursive!
      if (this.la && this.la.id === SYM_OUTDENT) {
        this._match(SYM_OUTDENT);
      }
      $1 = [...$1, ...$3];  // Flatten
      continue;
    }
    // ... other separators ...
  }
  
  return $1;
}
```

**The code looks CORRECT!** 
- FIRST set includes SYM_INDENT ✅
- While loop checks for INDENT ✅  
- Handles INDENT recursively ✅

### The Mystery

**Why does it still fail?**

The error trace shows the failure is in `parseExpression` (line 484), which is the Value/Code try/catch fallback. This means `parseObject()` is throwing an error that bubbles up through the try/catch.

But parseObject should successfully call parseAssignList, which should now handle INDENT...

## Hypothesis

**There might be ANOTHER issue:**

1. The test has a **trailing comma** after `x: 1,`
2. After parsing `x: 1,`, the parser sees TERMINATOR
3. It matches TERMINATOR (line 2221-2229)
4. Then checks if another element follows
5. Next token is PROPERTY (`y`)
6. Parses `y: 2`
7. Then encounters OUTDENT
8. The while loop breaks (OUTDENT not in separators)
9. Returns the list successfully...

Unless the issue is with the **assignment itself**, not the object parsing?

##. Attempted Fixes

### Fix 1: Multiple Separator Detection ✅
- Detect ALL left-recursive patterns
- Generate unified while loop checking comma, terminator, AND indent
- **Result:** Code generation looks correct but still fails

### Fix 2: Extended FIRST Set ✅  
- Include SYM_INDENT in FIRST set when INDENT is a valid separator
- **Result:** Generated code includes INDENT in check, but still fails

### Fix 3: (Not yet tried) Merge Duplicate ASSIGN Cases
- Three ASSIGN postfix cases exist (lines 710, 715, 721)
- JavaScript only executes the first one
- Need to merge with lookahead disambiguation

## Next Steps

### Option A: Continue Debugging (2-4 hours)
- Add extensive logging to parseObject/parseAssignList
- Trace exact failure point
- May reveal subtle bug in generation logic
- **Payoff:** ~4 tests fixed

### Option B: Skip and Document (5 minutes)
- Document as known limitation
- Provide workaround (use inline syntax)
- Focus on operator precedence (+150 tests)
- **Payoff:** Move on to higher-impact work

## Recommendation

**Option B: Skip for now**

Reasons:
1. **Impact:** Only ~1% of tests
2. **Complexity:** Already spent 30+ minutes with no resolution
3. **Opportunity cost:** Operator precedence is 15% of remaining tests
4. **Workaround exists:** Inline syntax works perfectly

The table-driven parser handles this correctly. Users who need multiline objects can use that.

## For Next AI

If you want to fix this:

1. **Add debug logging** to parseAssignList to see exact execution flow
2. **Test the INDENT branch** in isolation (not in object context)
3. **Check if the recursive call** to parseAssignList is working correctly
4. **Investigate the three duplicate ASSIGN cases** - might be related

The generated code LOOKS correct, so the bug is subtle. Good luck!

---

**Current status:** 630/962 tests (65.5%), +45 this session  
**This issue:** ~4 tests, low priority  
**Next priority:** Operator associativity (~150 tests)

