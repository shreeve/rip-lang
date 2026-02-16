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

---

## Redundancies

### 2. `?=` is an exact alias for `??=`

The compiler explicitly maps `?=` → `??=` at line 801: `let op = head === '?=' ? '??=' : head`.
They compile to identical JavaScript. Both are in the lexer's `COMPOUND_ASSIGN` set, the grammar,
and the compiler dispatch table.

**Fix:** Decide whether to keep both (as a convenience alias) or remove `?=` to eliminate the
synonym. If keeping, no code change needed — just a conscious decision.

- [ ] Done

### 3. `for x as! iter` duplicates `for await x as iter`

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

### 4. `unless` is half-desugared

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

