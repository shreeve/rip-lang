<p><img src="rip.svg" alt="Rip Logo" width="100"></p>

# Comprehension Context Determination

**Version:** 1.0.0
**Last Updated:** 2025-10-31
**Topic:** When comprehensions build arrays vs. when they're plain loops

---

## Purpose

Comprehensions can act as **data builders** or **control loops**. Rip distinguishes these automatically based on surrounding context, improving on CoffeeScript's behavior with smarter optimizations.

**Key insight:** At parse time, all comprehensions produce identical s-expressions. Context resolution happens only during code generation.

### Rip vs CoffeeScript Design Philosophy

**CoffeeScript (syntax-based):**
- `for x in xs then f(x)` → plain loop (statement-style)
- `for x in xs` (multi-line) → IIFE (expression-style, always returns array)
- **Problem:** Multi-line form builds wasteful arrays even when result unused

**Rip (context-based):**
- Same syntax, different output based on **how value is used**
- `for x in xs` → IIFE if assigned/returned, plain loop if result discarded
- **Benefit:** Automatic optimization - no wasteful array building!

**Example of improvement:**
```rip
fn = ->
  process x for x in arr    # ← Rip: plain loop! CS: IIFE (wasteful)
  doMore()
```

**Result:** Rip is smarter and faster than CoffeeScript while maintaining full compatibility.

---

## The Core Rule

Comprehensions have **dual semantics** based on how their value is used:

| Context | Generates | Example |
|---------|-----------|---------|
| **Value Context** | IIFE (builds array) | `x = (n*2 for n in arr)` |
| **Statement Context** | Plain loop (side effects) | `process(n) for n in arr; other()` |

**Critical principle:** Context is **downward-propagating**. Parent nodes decide if children need values. Comprehensions never inspect siblings or decide context themselves.

**Formal definition:** A child is in **value context** if the parent evaluates the child expression and uses its result (non-void). Everything else is **statement context**.

---

## Implementation: The `context` Parameter

Our s-expression compiler uses a simple parameter:

```javascript
generate(sexpr, context = 'statement') {
  // context: 'value' or 'statement'
  // Note: Could be 'expr'/'stmt' for brevity, but we use full words for clarity
  // Internal enum could be { VALUE: 'value', STATEMENT: 'statement' } to avoid typos
}
```

**Algorithm:**
```javascript
case 'comprehension': {
  if (context === 'statement') {
    return this.generateComprehensionAsLoop(...);  // Plain loop
  }
  return this.generateIIFE(...);  // Array-building IIFE
}
```

**Benefits of context-passing (vs. AST tagging):**
- ✅ S-expressions stay pure (no mutation)
- ✅ No separate analysis pass needed
- ✅ Context determined on-the-fly
- ✅ Simpler to understand and debug

---

## Context Propagation Patterns

**How parent nodes set child context:**

| Parent Node | Child | Context | Reason |
|-------------|-------|---------|---------|
| `Assignment` | RHS | `'value'` | Value assigned to variable |
| `Call` | Arguments | `'value'` | Values passed to function |
| `Return` | Expression | `'value'` | Value returned from function |
| `Function` | Last statement | `'value'` | Implicit return |
| `Function` | Non-last statements | `'statement'` | Result discarded |
| `Loop` | Body (all statements) | `'statement'` | Loops don't return values |
| `If/Unless` | Branches | **Inherit parent** | Pass through context |
| `Array` | Elements | `'value'` | Values stored in array |
| `Object` | Values | `'value'` | Values stored in object |
| `Ternary` | Both branches | `'value'` | Both branches produce values |
| `Switch/Case` | Branch bodies | **Inherit parent** | Last statement inherits from switch context |
| `Property Access` | Object | `'value'` | Need value to access property |
| `Binary Operators` | Operands | `'value'` | Need values to operate on |
| `Logical Operators` | Both operands | `'value'` | Short-circuit still demands values (`&&`, `\|\|`, `??`)* |
| `Program` | Single statement | `'value'` | REPL mode (controlled by `options.replMode`) |
| `Program` | Multiple statements | `'statement'` | Script mode (side effects) |

*Short-circuit operators (`&&`, `||`, `??`) compile both operands in `'value'` context. Only the necessary operand is **evaluated** at runtime due to short-circuiting (e.g., `false && expr` never evaluates `expr`).

---

## Value Context (Builds Array)

When parent demands a value, comprehension generates an IIFE:

```javascript
(() => {
  const result = [];
  for (const x of arr) { result.push(x * 2); }
  return result;  // ← Lexically isolated, no variable leakage, returns [] for empty
})()
```

**IIFE form guarantees:**
- ✅ No variable leakage (lexically scoped)
- ✅ Always returns array (even `[]` for empty input)
- ✅ Consistent evaluation order
- ✅ **Single evaluation** of iterator source (stored in temp before loop to avoid double side-effects)
- ✅ **Last expression** in block bodies is what gets pushed (if `undefined`, pushes `undefined`)

**Example of single evaluation:**
```javascript
const _src$1 = computeItems();  // ← Evaluate once (gensym'd to avoid collisions)
for (const x of _src$1) {
  result.push(transform(x));
}
```

**Temp name hygiene:** Use generated symbols (e.g., `_src$1`, `_item$2`) to avoid collisions with user bindings and nested comprehensions.

**All cases that demand values:**

| Parent Type | Example | Why Value Needed |
|-------------|---------|------------------|
| **Assignment RHS** | `x = (for n in arr ...)` | Assigned to variable |
| **Call Argument** | `fn(for n in arr ...)` | Passed to function |
| **Explicit Return** | `return (for n in arr ...)` | Returned from function |
| **Implicit Return** | `-> (for n in arr ...)` | Last in function body |
| **Array Element** | `[(for n in arr ...), x]` | Part of array literal |
| **Object Value** | `{k: (for n in arr ...)}` | Part of object literal |
| **Property Chain** | `(for n in arr ...).length` | Value needed for property access |
| **Binary Operator** | `(for n in arr ...) + x` | Value needed for operation |
| **Ternary Branch** | `if c then (for ...) else []` | Branch must produce value |
| **Template Interpolation** | `` `${for n in arr ...}` `` | Value inserted in string |
| **REPL/Single Top-Level** | `(for n in arr ...)` | Result displayed/tested |

**Implementation:** Parent nodes pass `context = 'value'` when generating these children.

---

## Statement Context (Plain Loop)

When value is discarded, generate an efficient plain loop:

```javascript
for (const x of arr) {
  process(x);  // Side effects only
}
```

**Plain loop form guarantees:**
- ✅ No array allocation (efficient)
- ✅ Supports `break`/`continue`
- ✅ Loop variables scoped with `const`/`let` (smallest block scope, no TDZ issues)

**All cases that discard values:**

| Scenario | Example | Why Plain Loop |
|----------|---------|----------------|
| **Not Last in Block** | `fn = -> (for...); return x` | Result unused |
| **Explicit Return After** | `fn = -> (for...); return null` | Return statement is last |
| **Inside Loop Body** | `for x in xs then (for y in ys...)` | Loops don't return |
| **Multiple Top-Level** | `(for...); other(); more()` | Script mode (not REPL) |
| **After Control Flow** | `(for...); throw error` | Following statement is last |

**Implementation:** Parent nodes pass `context = 'statement'` when children aren't needed for values.

---

## Edge Cases Summary

### 1. Comprehension Inside If Inside Loop
```rip
for state in states
  if condition
    process(x) for x in items   # ← Plain loop (inside loop body)
```
**Context:** `'statement'` (loops don't return, even for last statement in nested if).

### 2. Own + Guard + Value Variable (Critical!)
```rip
for own k, v of obj when v > 5
  process(k, v)
```
**Must generate:**
```javascript
for (const k in obj) {
  if (obj.hasOwnProperty(k)) {    // 1. Own check FIRST
    const v = obj[k];              // 2. Assign value SECOND
    if (v > 5) {                   // 3. Guard check THIRD (uses v!)
      process(k, v);
    }
  }
}
```
**Bug to avoid:** `if (hasOwnProperty && v > 5)` before `v` is defined!

### 3. Mixed Nested Contexts
```rip
fn = ->
  for x in outer
    (y * 2 for y in x)  # ← PLAIN LOOP (inside loop body)
  5                     # ← Last in function, returns 5
```
Inner comprehension is in loop body → statement context → plain loop. The `5` is last in function → implicit return.

**To force IIFE from inside loop:**
```rip
fn = ->
  out = []
  for x in outer
    out.push (y * 2 for y in x)  # ← Argument position → IIFE
  out
```

### 4. Async Comprehensions & for-await
```rip
results = (await fetchData(url) for url in urls)
# → async IIFE: async () => { ... for await? No, just await inside }
```
If comprehension expression contains `await`, IIFE becomes `async`.

**When Rip enables `for await`:** Context rules stay identical; only the loop header changes (`for await (const x of ...)`).

### 5. Parentheses & `void` Force Expression

**Parens force expression context:**
```rip
(for x in xs then x * 2)  # ← Parens → value context → IIFE
```

**`void` discards value but still expression:**
```rip
void (for x in xs then x * 2)  # ← Expression context (IIFE) but value discarded
```
**Guidance:** Using `void` or parens on comprehensions for side effects is a code smell. **Prefer statement form** for side effects; parens/`void` are primarily testing/REPL aids.

### 6. Guard Ordering with Destructuring
When using array destructuring or index variables, bind values BEFORE guard checks:
```javascript
for (let i = 0; i < arr.length; i++) {
  const [a, b] = arr[i];  // ← Destructure FIRST (const in smallest block scope)
  if (a && b) {            // ← Guard SECOND (references a, b)
    process(a, b);
  }
}
```

**Emit discipline:** Always bind loop temporaries with `const`/`let` in the smallest block scope to avoid TDZ/hoisting surprises. Never use `var`.

### 7. Containment Safety Rule
**Never allow comprehensions in `'statement'` context to leak values that might be used as expressions.** This prevents unintentional returns or double-evaluation bugs.

---

## Implementation Pitfalls & Checklist

### Common Mistakes

| Mistake | Bad Code | Fix |
|---------|----------|-----|
| **Always IIFE** | `return (() => {...})()` | Check `context === 'statement'` first |
| **Guard before valueVar** | `if (v > 5) { const v = obj[k]; }` | Assign `v` BEFORE checking guard |
| **Value context in loops** | `generateLoopBody(body, 'value')` | Always use `'statement'` (loops don't return) |
| **Combining own + guard** | `if (hasOwn && guard)` when guard uses valueVar | Nest: own-check → assign → guard-check |
| **Missing iterator types** | Only handle `for-in` | Support `for-in`, `for-from`, `for-of` |
| **break/continue in IIFE** | Allow in value context | **Error E001**: Scan emitted body, error if found |
| **yield/yield* in IIFE** | Allow in value context | **Error E002**: Both rejected (IIFE can't be generator) |

### Implementation Checklist

**Core comprehension handling:**
- [x] Check `context` parameter in `case 'comprehension'`
- [x] Generate IIFE for `context === 'value'`
- [x] Generate plain loop for `context === 'statement'`

**Context propagation:**
- [x] Assignments pass `'value'` to RHS
- [x] Function calls pass `'value'` to arguments
- [x] Returns pass `'value'` to expression
- [x] Function bodies pass `'value'` to last statement (unless loop/control flow)
- [x] Loop bodies pass `'statement'` to all statements
- [x] Single top-level statement passes `'value'` (REPL mode)

**Iterator support in `generateComprehensionAsLoop`:**
- [x] `for-in` (with optional index variable)
- [x] `for-from` (ES6 for-of alias)
- [x] `for-of` (object iteration with own/valueVar/guard)
- [x] Proper guard ordering (assign valueVar before checking guard)
- [x] Proper own-check ordering (check hasOwnProperty before assigning valueVar)

**Edge cases:**
- [x] Nested comprehensions (context propagates correctly)
- [x] Comprehensions with `break`/`continue` (only in plain loops)
- [x] Async comprehensions (add `async` to IIFE if expr contains await)
- [x] for-of with own + guard + valueVar (three-level nesting)

## Key Implementation Functions

| Function | Purpose | Context Handling |
|----------|---------|------------------|
| `generateProgram` | Top-level code | Single comp → `'value'` (REPL), multiple → `'statement'` |
| `generateFunctionBody` | Function bodies | Last stmt → `'value'` (implicit return), others → `'statement'` |
| `generateMethodBody` | Class methods | Same as functions (except constructors always `'statement'`) |
| `generateLoopBody` | Loop bodies | **Always `'statement'`** (loops never return) |
| `generateBlockWithReturns` | If-blocks needing returns | Last stmt → `'value'` with explicit `return` |
| `extractExpression` | Ternary/conditional branches | Always `'value'` |
| `generateComprehensionAsLoop` | Plain loop generation | Called when `context === 'statement'` |

---

## Special Constructs

### `break`/`continue` in Comprehensions

**Statement context (plain loop):**
```rip
for x in items
  result.push(y) for y in x when shouldBreak(y)
  break if x > 10  # ← breaks outer loop ✅
```

**Value context (IIFE) - ERROR:**
```rip
fn = -> (break for x in items)  # ← Compile error!
# Error E001: break/continue not allowed in value context
```

**Policy:** Scan the emitted comprehension body (after desugaring guards) for `break`/`continue`. If found in `'value'` context, produce **compile-time error** - these control flow keywords are meaningless inside IIFEs.

**Example error:**
```
Error E001: break/continue not allowed in value context
  for x in items
    result.push(y) for y in x
      break  # ← Can't break from inside IIFE!

Suggestion: Move comprehension to statement position or restructure code.
```

### Async Comprehensions

**Sequential (await in body):**
```rip
# IIFE is async, but awaits happen serially inside loop
results = (await fetchData(url) for url in urls)
# → async () => { const result = []; for (...) { result.push(await fetch(...)); } }
```

**Parallel (recommended for I/O):**
```rip
# Build array of promises, then await all in parallel
results = await Promise.all (fetchData(url) for url in urls)
# → await Promise.all([promises...])  ← No await in body!
```

**Key difference:** `await` **inside** comprehension body = sequential. `await` **outside** with `Promise.all` = parallel.

**Implementation:** If `containsAwait(expr)`, add `async` prefix to IIFE.

**Scope rule for `containsAwait`:** Only consider `await` at the top level of the comprehension body. Do **not** flip to `async` due to `await` inside nested function literals (lambdas) within the body:
```rip
# Nested await doesn't make IIFE async
results = (-> await fetch(x) for x in urls)  # ← Returns array of functions, NOT async IIFE
```

**Note on block bodies:** If the comprehension body is a block, the **last expression** in that block is what gets pushed to `result`. If it yields `undefined`, `undefined` is pushed.

**To skip iterations** (rather than push `undefined`), use a `when` guard or structure the block so the last expression only exists when you intend to push:
```rip
# Push undefined (no guard)
results = ((x if x > 5) for x in arr)  # → [undefined, undefined, 6, 7, ...]

# Skip items (with guard)
results = (x for x in arr when x > 5)  # → [6, 7, 8, ...]  ✅ Preferred
```

### Generator Comprehensions

**If using `yield` inside comprehensions:**
```rip
fn = function*
  results = (yield x for x in arr)  # ← Error!
```

**Policy:** `yield` and `yield*` in value-context comprehensions should produce **compile-time error** (IIFE can't be a generator). Use plain loop instead:
```rip
fn = function*
  for x in arr
    yield x  # ✅ Plain loop in generator function
```

**Example error:**
```
Error E002: yield not allowed in comprehension IIFE (can't be generator)
  results = (yield x for x in arr)
            ^^^^^

Suggestion: Use plain loop in statement position instead.
```

---

## Diagnostics & Error Policy

**Compile-time errors for invalid comprehension patterns:**

| Error | Condition | Message | Fix |
|-------|-----------|---------|-----|
| **E001** | `break`/`continue` in value context | "`break/continue` not allowed in value context; move comprehension to statement position" | Use plain loop or restructure |
| **E002** | `yield` or `yield*` in value context | "`yield` not allowed in comprehension IIFE (can't be generator); use plain loop" | Use statement-context loop |
| **E003** | Guard references valueVar before assignment | "Variable used in guard before assignment (internal error)" | Fix codegen ordering |
| **E004** | Async iterator without `for await` | "Use `for await` for async iterables" | Add `await` keyword to iterator |
| **E005** | `return` in comprehension body | "`return` not allowed inside comprehension body; wrap in function or use plain loop" | Restructure code |

**Implementation:** Check for these patterns during IIFE generation and throw clear errors.

**Future:** If Rip supports `for await` for async iterables:
```rip
# Async iteration (same context rules apply)
results = (await x for await x from asyncGenerator())
# → async () => { for await (const x of ...) { ... } }
```

**Error E005 - `return` in comprehension body:**

`return` statements inside a comprehension body (outside nested function literals) are invalid and should error:
```
Error E005: return not allowed inside comprehension body
  results = (return x for x in arr)  # ← Invalid!

Suggestion: Wrap in a function or use a plain loop with explicit returns.
```

This prevents confusion about control flow boundaries (return would exit the IIFE, not the enclosing function).

---

## Testing & Verification

### Quick Tests for Context Correctness

```rip
# Value context → IIFE
test "assigned", "x = (n for n in [1,2,3])\nx", [1,2,3]
test "argument", "fn = (arr) -> arr.length\nfn(n for n in [1,2,3])", 3
test "implicit return", "fn = -> (n for n in [1,2,3])\nfn()", [1,2,3]
test "block body pushes last", "x = ((a = n*2; a) for n in [1,2])\nx", [2,4]
test "short-circuit context", "f = -> (n for n in [1,2,3])\nt = true\n(t && f()).length", 3

# Statement context → Plain loop
test "not last", "fn = -> (process(n) for n in [1,2,3]); 5\nfn()", 5
test "in loop", "c = 0; for x in [1,2] then c++ for y in [1,2,3]; c", 6
test "multi-stmt", "process(n) for n in [1,2]; other(); 'done'", 'done'

# Single evaluation of source
test "source once", "calls = 0\nsrc = -> (calls++; [1,2])\n(n for n in src())\ncalls", 1
```

### Debug Context Flow

**Add temporary debug:**
```javascript
case 'comprehension': {
  if (this.debug) console.error(`COMP ctx=${context}`, sexpr);
  // ...
}
```

**Test patterns:**
```bash
echo 'x = (n for n in [1,2,3])' | ./bin/rip -c
# Should generate IIFE

echo 'fn = -> (for n in [1,2,3] then n); null' | ./bin/rip -c
# Should generate plain loop
```

---

## Why Rip is Smarter

**CoffeeScript's limitation:**
```coffee
# CoffeeScript (multi-line form always builds array)
for state in @states
  for item from state.reductions
    item.lookaheads.add token for token from follows
# → Generates results, results1, results2 arrays (wasteful!)
```

**Rip's optimization:**
```rip
# Rip (context-aware)
for state in @states
  for item from state.reductions
    item.lookaheads.add token for token from follows
    null  # ← Explicit: side effects only
# → Plain loops, no arrays! (efficient)
```

**Why this matters:**
- ✅ **Performance:** No unnecessary array allocation
- ✅ **Memory:** Avoids building throwaway arrays
- ✅ **Clarity:** Intent is explicit (context-driven)
- ✅ **Compatibility:** Can still force IIFE with assignment/return/parens

**Trade-off:** Requires developers to understand context (but it's intuitive: "is the value used?")

**Future optimizations:**
- Detect more wasteful patterns
- Static analysis of value flow
- Warnings for suspicious patterns (IIFE result immediately discarded)

---

## Quick Reference

### Decision Tree
```
Comprehension encountered
│
├─ context === 'value' → Generate IIFE (builds array)
│  └─ Check containsAwait() → add async prefix if needed
│
└─ context === 'statement' → Generate plain loop
   └─ Call generateComprehensionAsLoop()
```

### Success Checklist

✅ `x = (for...)` → IIFE
✅ `fn = -> (for...); null` → plain loop
✅ `(for...)` at REPL → IIFE
✅ Nested loops in loop bodies → plain loops
✅ Guards with valueVar → correct ordering
✅ for-own with guard + valueVar → three-level nesting
✅ All 814 tests passing

---

## References

| Resource | Location | Description |
|----------|----------|-------------|
| **Comprehension case** | `src/compiler.js:2136-2299` | Main comprehension handler |
| **Loop generator** | `src/compiler.js:4210-4346` | `generateComprehensionAsLoop()` |
| **Tests** | `test/rip/comprehensions.rip` | 19 comprehensive tests |
| **Guard tests** | `test/rip/guards.rip` | 27 tests with when clauses |
| **Context propagation** | Throughout `src/compiler.js` | See table above |

---

**Remember:** Context flows downward from parent to child. Comprehensions respond to context; they don't determine it.
