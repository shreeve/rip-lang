# Fixups

Grammar and compiler cleanup items, ordered from highest to lowest priority.
Work through one at a time, committing after each.

---

## Bugs / Dead Code

### 1. Missing compiler handler: `%%=`

The lexer includes `%%=` in its `COMPOUND_ASSIGN` set, and the grammar handles it through the
generic `SimpleAssignable COMPOUND_ASSIGN Expression` rule. So `x %%= 5` parses successfully. But
the compiler has no handler for `%%=` — it has `%%` → `generateModulo` and `//=` →
`generateFloorDivAssign`, but nothing for `%%=`. Code generation will crash.

**Fix:** Add a `%%=` → `generateModuloAssign` handler (matching the pattern of `//=` →
`generateFloorDivAssign`), or remove `%%=` from the lexer if we don't want it.

- [ ] Done

### 2. Bug: `until...when` guard silently dropped

The grammar produces `["until", cond, guard]` when `WHEN` is used (grammar.rip line 613). After the
`While` rule merges the block, this becomes `["until", cond, guard, body]`. But `generateUntil`
only destructures two elements: `let [cond, body] = rest`. When a guard is present, `body` receives
the guard expression and the actual body is lost. Compare with `generateWhile` which correctly
handles the 3-element case.

**Fix:** Fix `generateUntil` to match `generateWhile`'s guard handling, or desugar `until` to
`while` at the grammar level (see item 6).

- [ ] Done

---

## Redundancies

### 3. `?=` is an exact alias for `??=`

The compiler explicitly maps `?=` → `??=` at line 801: `let op = head === '?=' ? '??=' : head`.
They compile to identical JavaScript. Both are in the lexer's `COMPOUND_ASSIGN` set, the grammar,
and the compiler dispatch table.

**Fix:** Decide whether to keep both (as a convenience alias) or remove `?=` to eliminate the
synonym. If keeping, no code change needed — just a conscious decision.

- [ ] Done

### 4. `for x as! iter` duplicates `for await x as iter`

Two ways to write async `for-as` loops:
- `for await x as iter` — uses standard `AWAIT` keyword
- `for x as! iter` — uses special `FORASAWAIT` lexer token

Both produce identical `["for-as", ..., true, ...]`. The `as!` form requires a dedicated lexer
token and adds 6 grammar rules (4 block + 2 comprehension). The `for await` form is more readable
and mirrors JavaScript's `for await...of`.

**Fix:** Remove the `FORASAWAIT` token from the lexer and the 6 grammar rules that use it. Keep
only the `for await x as iter` form.

- [ ] Done

---

## Grammar Desugaring

### 5. `unless` is half-desugared

The grammar inconsistently handles `unless`:
- `unless expr block` → `["unless", cond, body]` (compiler must handle)
- `unless expr block else block` → `["if", ["!", cond], then, else]` (already desugared!)

The simple form could also desugar to `["if", ["!", cond], body]` at the grammar level, removing
the `unless` case from the compiler entirely.

**Fix:** Change the grammar rule for `unless expr block` to emit `["if", ["!", cond], body]`
instead of `["unless", cond, body]`. Remove `generateUnless` from the compiler (it's currently
handled by `generateIf` via a shared mapping, but the `unless` entry in the dispatch table and the
negation logic in `generateIf` can be simplified).

- [ ] Done

### 6. `until` is just `while` with negation

`until cond` compiles to `while (!(cond))`. The grammar could desugar `until` to
`["while", ["!", cond], ...]` at the grammar level, eliminating `generateUntil` entirely. This also
fixes the guard bug (item 2) for free, since the desugared form would flow through `generateWhile`
which already handles guards correctly.

**Fix:** Change the grammar rules for `until` to emit `["while", ["!", cond], ...]`. Remove
`generateUntil` from the compiler.

- [ ] Done

---

## Features to Evaluate

### 7. `=~` regex match operator

Requires a `toSearchable` runtime helper (14 lines emitted into every program that uses it) and
pollutes the scope with a `_` variable. Users can write `str.match(/pattern/)` directly. It's a
Perl/Ruby-ism that doesn't exist in JavaScript.

The `toSearchable` helper handles type coercion (numbers, booleans, symbols, Uint8Array, etc.) which
is convenient but niche. The regex-index variant (`=~ /pat/ [n]`) adds further complexity.

**Decision:** Keep or remove?

- [ ] Done

### 8. `!?` undefined-only coalescing operator

Compiles to `(x !== undefined ? x : y)`. This is like `??` but only coalesces `undefined`, not
`null`. The use case where you want to coalesce `undefined` but preserve `null` is rare.

**Decision:** Keep or remove?

- [ ] Done

### 9. Object comprehensions

Four dedicated grammar rules for `{ k: v for x of obj }` syntax. They only support `for-of`
iteration (not `for-in` or `for-as`), require a dedicated compiler handler
(`generateObjectComprehension`), and the same result is achievable with `Object.fromEntries()` plus
a regular array comprehension.

**Decision:** Keep or remove?

- [ ] Done

### 10. `for own k of obj`

CoffeeScript heritage. Adds 6 grammar rules across block, comprehension, and object-comprehension
forms. Modern JavaScript has `Object.keys()`, `Object.entries()`, `Object.hasOwn()`. However, this
IS used in the Rip codebase itself (e.g., the `for-of` loops in `ui.rip`).

**Decision:** Keep or remove?

- [ ] Done

### 11. `loop n` counted loop

`loop 5` with a block produces `for (let it = 0; it < 5; it++)`. The iteration variable is always
named `it` and can't be customized. Adds 1 grammar rule + 1 compiler handler. Small footprint but
niche.

**Decision:** Keep or remove?

- [ ] Done
