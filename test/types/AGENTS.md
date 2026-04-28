# Type Audit — Agent Guide

Independent test files for every Rip type system feature. Each file compiles and type-checks on its own — a break in one doesn't cascade.

## Verification (ALWAYS run these)

When asked to verify, validate, or check any audit file, run `bun run test:types`. No exceptions — don't ask the user which commands to run, just run it.

```bash
bun run test:types
```

All checks must pass. If errors appear, isolate with single-file commands:

```bash
rip FILE.rip        # run the .rip file
bun run FILE.ts     # run the .ts companion
rip -c FILE.rip     # inspect compiled JS
rip -d FILE.rip     # inspect generated .d.ts
```

Update the status table below as features are fixed or regress.

**Picking up compiler changes in the editor:**

The LSP loads `src/compiler.js` and `src/typecheck.js` at runtime from the project root (not bundled). After changing `src/types.js`, `src/typecheck.js`, or `src/compiler.js`, just reload the editor window (Cmd+Shift+P → "Developer: Reload Window").

**Rebuilding the VS Code extension** (required after changes to `packages/vscode/`):

```bash
cd packages/vscode
bun run install-vscode    # rebuild + reinstall for VS Code
```

Then reload the editor window to pick up the new extension.

## Output Parity Rule

**Each `.rip` file and its `.ts`/`.tsx` companion MUST produce identical console output.** This is a hard requirement — if you add, remove, or change any `console.log` in a `.rip` file, make the same change in the `.ts` companion (and vice versa). Avoid non-deterministic values (e.g. `Date.now()`, `Math.random()`) in output; use fixed literals instead. Verify with `bun run test:types` (the parity checks will fail on mismatch).

## Feature **Status**

Each file exercises a specific type feature. Status key:

- **pass** — `rip check` reports no errors, file runs correctly
- **check-only** — `rip check` passes but file can't run (type-only content)
- **fail** — `rip check` or runtime reports errors
- **partial** — some features in the file work, others don't

| File               | Feature                                                     | Status | Notes                                                      |
| ------------------ | ----------------------------------------------------------- | ------ | ---------------------------------------------------------- |
| 01-basic.rip       | `::` on variables, nullable (`T \| null`, `T \| undefined`) | pass   |                                                            |
| 02-aliases.rip     | `type` aliases (simple, union, typeof, function)            | pass   | Function aliases `(a: T) => R` with generics + negatives   |
| 03-structural.rip  | `type` blocks, optional, readonly, recursive, generic       | pass   | Nested blocks, index signatures, deep nesting, negatives   |
| 04-unions.rip      | Inline, block, discriminated unions + switch narrowing      | pass   | Narrowing + exhaustiveness via strict mode                 |
| 05-interfaces.rip  | `interface`, `extends`, optional members                    | pass   |                                                            |
| 06-functions.rip   | Typed functions, arrows, overloads, array transforms        | pass   | 22 negative tests; overloads narrow return types           |
| 07-integration.rip | Cross-module imports of typed functions                     | pass   | Cross-file type flow via `.d.ts`                           |
| 08-reactive.rip    | `:: T :=`, `:: T ~=`, `:: T =!`, `:: T ~>`                  | pass   | Reactive state annotations                                 |
| 09-components.rip  | `@prop:: T :=`, `@prop:: T`, default validation             | pass   | Required props, default-vs-type, 4 negative body tests     |
| 10-validation.rip  | Runtime validation use cases (4 real-world patterns)        | pass   | API shape, composition, discriminated config, 3rd-party    |
| 11-inference.rip   | Type inference on unannotated variables                     | pass   | Top-level, block-scoped, destructured, inline-let in funcs |

## Type Safety Gap Analysis

What `rip check` catches today vs. what it doesn't. This tracks the overall health of Rip's type story — not just this audit. Grouped by status, ordered by importance within each group.

**Maintenance rule:** When you fix a gap, run the full verification suite. If everything passes, move the row to 🔍. To promote from 🔍 to ✅, manually verify IDE behavior (squiggle on correct token, hover shows expected type, no parse errors masking diagnostics, no false-positive errors). Remove stale "Fixed:" annotations — the row's position is the status. Never leave a fixed item in ❌.

### ❌ Not working (language-level changes or runtime validation needed)

| Category                       | Tested In     | Notes                                                                                      |
| ------------------------------ | ------------- | ------------------------------------------------------------------------------------------ |
| `@app.data` stash typing       | 09-components | `@app.data` is `any` — no cross-component stash typing. RFC in `examples/cart/README.md`   |
| Runtime return-type validation | 10-validation | Return types erased; `response.json()` is `any`. See "Future Notes" for the schema bridge. |

### 🔶 Partial

*(No items currently in partial state.)*

### 🔍 Compiler-verified (IDE review needed)

*(No items currently need IDE review.)*

### ✅ Working

| Category                       | Tested In      | Notes                                                                                |
| ------------------------------ | -------------- | ------------------------------------------------------------------------------------ |
| Variable type mismatches       | 01-basic       | Same-file typed variables                                                            |
| Readonly / immutability        | 01-basic       | `=!` → `const`/`declare const`; reassignment + readonly mutation caught              |
| Nullable safety                | 01-basic       | Full `strictNullChecks` at all usage sites; 2 negative tests                         |
| Function type aliases          | 02-aliases     | `type Fn = (a: T) => R` with generics; negative test for wrong return                |
| Nested structural types        | 03-structural  | `data: type` blocks; recursive nesting, depth-aware DTS formatting                   |
| Index signatures               | 03-structural  | `[key: string]: number`; string, number, and mixed (props + sig) emit correct DTS    |
| Generic types                  | 03-structural  | Structs, functions, constraints, nested, multi-param, unions                         |
| Object shape checking          | 03-structural  | Missing fields, extra fields                                                         |
| Property access checking       | 03-structural  | Typos, nonexistent fields                                                            |
| Union value checking           | 04-unions      | Literal unions validated                                                             |
| Union narrowing + exhaust.     | 04-unions      | Switch narrowing; squiggles land on correct `when` branch                            |
| Inline discriminated unions    | 04-unions      | Hover shows union members; variable-aware DTS error positioning                      |
| Function argument types        | 06-functions   | Same-file typed functions                                                            |
| Function return types          | 06-functions   | Same-file typed functions                                                            |
| Optional param `?`             | 06-functions   | `y?:: T` emits `y?: T`                                                               |
| Destructured typed params      | 06-functions   | `{name:: string, age:: number}` emits matching DTS                                   |
| Destructured defaults          | 06-functions   | `{name:: string = "anon"}` → optional `?` in DTS, correct codegen                    |
| Destructured rest              | 06-functions   | `...rest` in pattern, `[key: string]: unknown` in DTS                                |
| Destructured rename            | 06-functions   | `{name: userName:: string}` — prop name `name` in DTS, alias in pattern              |
| Array destructured params      | 06-functions   | `[first:: string, second:: string]` → tuple `[string, string]`                       |
| Nested destructured params     | 06-functions   | `{user: {name:: string, age:: number}}` emits matching DTS                           |
| `void` return annotation       | 06-functions   | `def fn!` emits `: void`; `!` suppresses implicit return                             |
| Async/await unwrapping         | 06-functions   | `!` → `await`; `Promise<T>` → `T`                                                    |
| Function overloads             | 06-functions   | Bodiless `def` overloads → `declare function`; relocated to non-ambient overload     |
| Cross-file type flow           | 07-integration | Via `.d.ts`; untyped files get `@ts-nocheck`; unresolved `.rip` imports flagged      |
| Auto-imports                   | 07-integration | Completion + TS2304/2552/2503 quick fix; "Add all missing imports"; multi-line lists |
| Component prop types           | 09-components  | Stub injects Signal/Computed; checks computeds, methods, render block intrinsics     |
| Required component props       | 09-components  | `@prop:: T` (no `:=`) — required in constructor, caught at usage sites               |
| Prop default validation        | 09-components  | `@prop:: T := val` — validates default; squiggle on prop name                        |
| Element type inheritance       | 09-components  | `component extends tag` widens via `__RipProps<'tag'>`; invalid tags caught          |
| Event handler typing           | 09-components  | Inline via `__RipEvents`; named refs via stub-injected `HTMLElementEventMap`         |
| Render block conditionals      | 09-components  | `if`/`unless`/`?:`, `switch`, `for` iterables emitted into type-checking stub        |
| Render block text exprs        | 09-components  | `= expr` emitted into stub; typos caught via "Cannot find name"                      |
| Dot-completion accuracy        | 09-components  | Source map fix + LSP single-line `__rip__` patching for trailing-dot                 |
| Generic components             | 09-components  | `Name<T extends C> = component` — type params flow through DTS, stub, inference      |
| Type inference (split decl.)   | 11-inference   | `patchUninitializedTypes` infers from first assignment; top-level + block + destruct |
| Type inference (inline-let)    | 11-inference   | Inline-let emits `let x = value;` everywhere; no patcher needed                      |
| Strict mode                    | *(all files)*  | `strict: true` — `noImplicitAny`, full null checks, strict function types            |
| Project-level type enforcement | *(all files)*  | CLI `--strict`, `rip.json`, `package.json`; `# @nocheck` / `"exclude"` opt-out       |
| Hover types                    | *(IDE only)*   | Column-aware source maps, overload preference, typed implementation params           |
| Union value autocomplete       | *(IDE only)*   | String literal completions for prop values, defaults, typed assignments              |
| Semantic token provider        | *(IDE only)*   | Bridges TS classifications to Rip; reactive vars not marked readonly                 |
| Unused variable dimming        | *(IDE only)*   | `DiagnosticTag.Unnecessary`; expands hoisted-let 6199 into per-var 6133              |
| Deprecated strikethrough       | *(IDE only)*   | `DiagnosticTag.Deprecated`; hover includes JSDoc `@deprecated`, `@param`             |
| Go-to-def on imports           | *(IDE only)*   | Path string + symbol jump to target file; multi-line import lists supported          |
| Hover on imports               | *(IDE only)*   | Module path as written; symbol hover via TS quick info; multi-line supported         |

### Suppressed error codes

`rip check` runs TypeScript under the hood but suppresses error codes in two tiers (defined in [src/typecheck.js](../../../src/typecheck.js)):

**Blanket suppression (7 codes in `SKIP_CODES`):** Structural artifacts that always fire due to Rip's compilation model — overload patterns, async return types, enum declarations. These are safe to suppress unconditionally: 2389, 2391, 2393, 2394, 2567, 2842, 1064.

**Conditional suppression (5 codes in `CONDITIONAL_CODES`):** These are only suppressed when the diagnostic is structural:

| Code       | What it reports           | Suppressed when                                                                      | Kept when                                             |
| ---------- | ------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| 2300, 2451 | Duplicate identifiers     | Other endpoint sits in the DTS header, or import line names the identifier only once | Body↔body collision, including ≥2 imports of the name |
| 2307       | Cannot find module        | Path starts with `@rip-lang/` or ends with `.rip` (Rip resolves these)               | Any other import (npm packages, JS/TS files)          |
| 2582, 2593 | Cannot find test/describe | File basename contains `test`/`spec`, or path includes `/test/` etc.                 | Non-test files (e.g. `app.rip`, `index.rip`)          |

## Future Notes — Runtime Return Validation

This captures design notes for the `Runtime return-type validation` gap in `10-validation`.

### Problem

`rip check` verifies declared return types at compile time, but runtime values are not validated. Example: `response.json()` in a function typed as `Promise<User>` can return invalid data and still run.

### Why the `schema` keyword is a likely fit

- First-class runtime validator API (`Schema.parse / .safe / .ok`)
- Good support for boundary checks (named object types, nested types, arrays, required/optional)
- Already built into the language, no extra dependency needed

### Practical MVP (no grammar changes)

1. **Compiler hook**: in `src/compiler.js`, detect functions with explicit return types (`User`, `Promise<User>`).
2. **Return wrapper**: inject runtime helper around return values for eligible functions.
3. **Validation contract**: use a global hook (for decoupling), e.g. `globalThis.__ripReturnValidator(typeName, value)`.
4. **Schema adapter**: app code wires a named schema for each type it wants enforced, e.g. `__setReturnValidator('User', User.parse)`.
5. **Tests**: extend `test/types/10-validation.rip` with pass/fail runtime cases for typed API payloads.

### Important caveats

- Start with **named type returns**; full arbitrary type expression validation is larger scope.
- The schema runtime is good for boundary validation, but not a complete replacement for full TypeScript-level runtime type semantics.
- Consider option-gating first rollout (e.g. compiler/runtime flag) to avoid breaking existing apps.

## TypeScript Companions

Each `.rip` file has a `.ts` companion with equivalent TypeScript for side-by-side IntelliSense comparison.

**Sync rule (mandatory):** When you add, remove, or change a component, type, negative test, or comment block in a `.rip` file, make the equivalent change in the `.ts`/`.tsx` companion (and vice versa). The two files must always demonstrate the same features with matching structure. Verify with `bunx tsc` and the output parity check.

**Style rules for `.ts` files (mandatory):**

- **No semicolons** — never append `;` to any line
- **Single quotes** — use `'string'` not `"string"`
- **Trailing commas** — in multi-line objects and arrays
- **`type` over `interface`** — use `type X = { ... }` not `interface X { ... }` (except in `05-interfaces.ts` which tests `interface` specifically)

## Rip Gotchas

Surprising behaviors, parser traps, and non-obvious syntax requirements discovered during the type audit. These trip up both developers and AI agents.

### Typos in assignments create new variables

Rip inherits CoffeeScript's `=`-creates-a-variable semantics. A typo silently creates a new local.

```coffee
loading := false
# ...
loadingz = true    # No error — creates `loadingz`, `loading` unchanged
```

No automated fix. The type system can't catch this because the new variable has an inferred type.

### Implicit call ambiguity

Rip's implicit parentheses work by greedy consumption. When a function call's arguments include commas, the parser can't distinguish between "another argument to this call" and "next sibling in render block."

```coffee
render
  # TRAP — "Add to Cart" gets swallowed as second arg to addItem
  button @click: -> stash.cart.addItem { id: 1 }, "Add to Cart"

  # FIX — explicit parens on the call
  button @click: -> stash.cart.addItem({ id: 1 }), "Add to Cart"

  # FIX — block form (attrs and children are siblings)
  button
    @click: -> stash.cart.addItem { id: 1 }
    "Add to Cart"
```

### `reduce` needs double parentheses

The callback argument to `reduce` must be wrapped in parens to prevent the implicit call from consuming the initial value.

```coffee
# CORRECT — inner parens group the callback
items.reduce ((sum, i) -> sum + i.price), 0

# WRONG — `, 0` gets misinterpreted
items.reduce (sum, i) -> sum + i.price, 0
```

Same applies to any method where the first argument is a callback followed by more arguments.
