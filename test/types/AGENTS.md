# Type Audit — Agent Guide

Independent test files for every Rip type system feature. Each file compiles and type-checks on its own — a break in one doesn't cascade.

## Verification (ALWAYS run these)

When asked to verify, validate, or check any audit file, run ALL of these commands from this directory (`test/types/`). No exceptions — don't ask the user which commands to run, just run them all.

**Single file** (replace FILE with the target, e.g. `01-basic`):

```bash
rip FILE.rip        # 1. run the .rip file
bun run FILE.ts     # 2. run the .ts companion
rip -c FILE.rip     # 3. inspect compiled JS
rip -d FILE.rip     # 4. inspect generated .d.ts
```

**Full suite** (always run after single-file checks):

```bash
rip check                                                                 # 5. type-check all .rip files
bunx tsc                                                                  # 6. type-check all .ts files
for f in *.rip; do printf "\n── %s ──\n" "$f" && rip "$f"; done           # 7. run all .rip
for f in *.ts *.tsx; do printf "\n── %s ──\n" "$f" && bun run "$f"; done  # 8. run all .ts
for n in 01-basic 02-aliases 03-structural 04-unions 05-interfaces 06-functions 07-integration 08-reactive 09-components 10-validation 11-inference 12-intrinsics; do
  ext=ts; [[ "$n" == 09-* || "$n" == 12-* ]] && ext=tsx
  rip "$n.rip" > /tmp/rip_out.txt 2>&1
  bun run "$n.$ext" > /tmp/ts_out.txt 2>&1
  diff -q /tmp/rip_out.txt /tmp/ts_out.txt > /dev/null 2>&1 && echo "✓ $n" || echo "✗ $n — MISMATCH"
done                                                                      # 9. output parity
```

All commands must pass. 09-components (.rip and .tsx) are silent at runtime but type-check correctly. Report results in a summary table. If errors appear, isolate with single-file commands. Update the status table below as features are fixed or regress.

**Picking up compiler changes in the editor:**

The LSP loads `src/compiler.js` and `src/typecheck.js` at runtime from the project root (not bundled). After changing `src/types.js`, `src/typecheck.js`, or `src/compiler.js`, just reload the editor window (Cmd+Shift+P → "Developer: Reload Window").

**Rebuilding the VS Code extension** (required after changes to `packages/vscode/`):

```bash
cd packages/vscode
bun run install-vscode    # rebuild + reinstall for VS Code
```

Then reload the editor window to pick up the new extension.

## Output Parity Rule

**Each `.rip` file and its `.ts`/`.tsx` companion MUST produce identical console output.** This is a hard requirement — if you add, remove, or change any `console.log` in a `.rip` file, make the same change in the `.ts` companion (and vice versa). Avoid non-deterministic values (e.g. `Date.now()`, `Math.random()`) in output; use fixed literals instead. Verify with command 9 in the full suite above.

## Feature **Status**

Each file exercises a specific type feature. Status key:

- **pass** — `rip check` reports no errors, file runs correctly
- **check-only** — `rip check` passes but file can't run (type-only content)
- **fail** — `rip check` or runtime reports errors
- **partial** — some features in the file work, others don't

| File               | Feature                                                     | Status | Notes                                                                   |
| ------------------ | ----------------------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| 01-basic.rip       | `::` on variables, nullable (`T \| null`, `T \| undefined`) | pass   |                                                                         |
| 02-aliases.rip     | `type` aliases (simple, union, typeof)                      | pass   |                                                                         |
| 03-structural.rip  | `type` blocks, optional, readonly, recursive, generic       | pass   | Includes `PagedResult<T>` generic struct                                |
| 04-unions.rip      | Inline, block, discriminated unions + switch narrowing      | pass   | Narrowing + exhaustiveness verified via strict mode                     |
| 05-interfaces.rip  | `interface`, `extends`, optional members                    | pass   |                                                                         |
| 06-functions.rip   | Typed functions, arrows, and array transforms               | pass   | 21 negative tests (7 param + 6 return + 3 array + 5 destructured)       |
| 07-integration.rip | Cross-module imports of typed functions                     | pass   | Cross-file type flow via .d.ts                                          |
| 08-reactive.rip    | `:: T :=`, `:: T ~=`, `:: T =!`, `:: T ~>`                  | pass   | Reactive state annotations                                              |
| 09-components.rip  | `@prop:: T :=`, `@prop:: T`, default validation             | pass   | Required props, default-vs-type validation, 4 negative body tests       |
| 10-validation.rip  | Runtime validation use cases (4 real-world patterns)        | pass   | API shape, composition, discriminated union config, 3rd-party transform |
| 11-inference.rip   | Type inference on unannotated variables                     | pass   | Top-level works; block/destructure/any are gaps                         |
| 12-intrinsics.rip  | Intrinsic tags, attributes, events, global attrs            | pass   | `__ripEl` validates via lib.dom; wrong types caught; event params typed |

## Type Safety Gap Analysis

What `rip check` catches today vs. what it doesn't. This tracks the overall health of Rip's type story — not just this audit. Grouped by status, ordered by importance within each group.

**Maintenance rule:** When you fix a gap, run the full verification suite. If everything passes, move the row to 🔍. To promote from 🔍 to ✅, manually verify IDE behavior (squiggle on correct token, hover shows expected type, no parse errors masking diagnostics, no false-positive errors). Remove stale "Fixed:" annotations — the row's position is the status. Never leave a fixed item in ❌.

**Design trade-offs** (inherent to the language, not fixable via type system):

| Category                   | Tested In     | Notes                                                                                                                                              |
| -------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implicit variable creation | 09-components | `loadingz = true` creates a new local — typos in assignments are invisible to types. This is CoffeeScript's core `=`-creates-a-variable semantics. |
| Untyped files unchecked    | *(all files)* | Files without `::` annotations get `// @ts-nocheck` — zero type checking. Removing it requires `strict: true` and annotations on every file.       |

### ❌ Not working (language-level changes or runtime validation needed)

| Category                       | Tested In     | Notes                                                                                            |
| ------------------------------ | ------------- | ------------------------------------------------------------------------------------------------ |
| Runtime return-type validation | 10-validation | Return types are erased — `response.json()` is unvalidated `any`; no `schema.parse()` equivalent |
| Shared state typing (stash)    | 09-components | Stash is untyped — any path/value accepted; zustand equivalent is fully typed (see .tsx)         |
| Generic components             | 09-components | Can't parameterize components by type (e.g. typed select where value type flows through props)   |

### 🔶 Partial

| Category                 | Tested In     | Notes                                                                                              |
| ------------------------ | ------------- | -------------------------------------------------------------------------------------------------- |
| Generic types            | 03-structural | Basic generics work (structs, function returns); edge cases may remain                             |
| Render block type safety | 09, 12        | Intrinsic tag/attr/event checking via `__ripEl`; conditionals and text expressions still unchecked |

### 🔍 Compiler-verified (IDE review needed)

`rip check` passes for these features but IDE presentation (squiggle positions, hover types, diagnostic messages) has not been manually verified. To promote to ✅, open the relevant file in a VS Code-based editor and confirm: correct squiggle position, correct hover type, no parse errors masking diagnostics, no false positives.

| Category                     | Tested In     | Notes                                                                                                       |
| ---------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------- |
| Event handler typing         | 09, 12        | Inline handlers typed via `__RipEvents`; named method refs (`@submit: @handler`) remain `any`               |
| Type inference (split decl.) | 11-inference  | Top-level `x = expr` inferred via `patchUninitializedTypes`; block-scoped and destructured caught by strict |
| Intrinsic element typing     | 12-intrinsics | `__ripEl` emits typed helper calls; lib.dom source of truth for tags, attrs, events, global attrs           |

### ✅ Working

| Category                    | Tested In      | Notes                                                                                                                              |
| --------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Variable type mismatches    | 01-basic       | Same-file typed variables                                                                                                          |
| Readonly / immutability     | 01-basic       | `=!` emits `const`/`declare const`; reassignment caught (TS2588); `readonly` field mutation caught (TS2540)                        |
| Nullable safety             | 01-basic       | `strict: true` enables full `strictNullChecks` — null/undefined caught at all usage sites; 2 negative tests                        |
| Object shape checking       | 03-structural  | Missing fields, extra fields                                                                                                       |
| Property access checking    | 03-structural  | Typos, nonexistent fields                                                                                                          |
| Union value checking        | 04-unions      | Literal unions validated                                                                                                           |
| Union narrowing + exhaust.  | 04-unions      | Switch narrowing + exhaustiveness; squiggles land on correct `when` branch                                                         |
| Inline discriminated unions | 04-unions      | Hover shows union members, not internal names; DTS error mapping fixed for variable-aware positioning                              |
| Function argument types     | 06-functions   | Same-file typed functions                                                                                                          |
| Function return types       | 06-functions   | Same-file typed functions                                                                                                          |
| Optional param `?`          | 06-functions   | `y?:: T` emits `y?: T` in .d.ts                                                                                                    |
| Destructured typed params   | 06-functions   | `{name:: string, age:: number}` in params; emits `{name, age}: {name: string, age: number}` in .d.ts                               |
| Destructured defaults       | 06-functions   | `{name:: string = "anon"}` → optional `?` in .d.ts type, correct `{name = "anon"}` codegen                                         |
| Destructured rest           | 06-functions   | `{name:: string, ...rest}` → `...rest` in pattern, `[key: string]: unknown` in .d.ts type                                          |
| Destructured rename         | 06-functions   | `{name: userName:: string}` → prop name `name` in .d.ts type, `{name: userName}` in pattern                                        |
| Array destructured params   | 06-functions   | `[first:: string, second:: string]` → tuple `[string, string]` in .d.ts                                                            |
| Nested destructured params  | 06-functions   | `{user: {name:: string, age:: number}}` → `{user: {name: string, age: number}}` in .d.ts                                           |
| `void` return annotation    | 06-functions   | `def fn!` emits `: void` in .d.ts; `!` sigil suppresses implicit return and declares void return type                              |
| Async/await unwrapping      | 06-functions   | `!` compiles to `await`; return types inferred or explicit; `Promise<T>` → `T`                                                     |
| Cross-file type flow        | 07-integration | Via .d.ts; untyped files get `@ts-nocheck`; unresolved `.rip` imports flagged                                                      |
| Component prop types        | 09-components  | Enriched stub gives Signal<T>/Computed<T> declarations; TS checks computeds, methods, and render block intrinsic elements          |
| Required component props    | 09-components  | `@prop:: T` (no `:=`) — required in constructor, caught at usage sites                                                             |
| Prop default validation     | 09-components  | `@prop:: T := val` — validates default against declared type; squiggle on prop name                                                |
| Element type inheritance    | 09-components  | `component extends tag` widens constructor props with `__RipProps<'tag'>`; invalid tags caught with clean error                    |
| Strict mode                 | *(all files)*  | `strict: true` — `noImplicitAny`, full null checks, strict function types all active; hardcoded in all paths                       |
| Hover types                 | *(IDE only)*   | Column-aware source maps, overload preference, typed implementation params                                                         |
| Union value autocomplete    | *(IDE only)*   | String literal union completions for prop values, prop defaults, and typed variable assignments                                    |
| Semantic token provider     | *(IDE only)*   | Bridges TS `getEncodedSemanticClassifications()` to Rip source; typed files get semantic tokens, reactive vars not marked readonly |
| Unused variable dimming     | *(IDE only)*   | Forwards `DiagnosticTag.Unnecessary` from TS; expands hoisted-let 6199 into per-variable 6133; scoped source mapping for functions |
| Deprecated strikethrough    | *(IDE only)*   | Forwards `DiagnosticTag.Deprecated` from TS suggestion diagnostics; hover includes JSDoc `@deprecated`, `@param` tags              |
| Go-to-def on imports        | *(IDE only)*   | Resolves import paths directly; symbol names jump to definition in target file; path string navigates to file                      |

### Suppressed error codes

`rip check` runs TypeScript under the hood but suppresses 13 error codes (defined in `SKIP_CODES` in [src/typecheck.js](../../../src/typecheck.js)). Most suppressions are necessary — Rip's compilation model produces patterns that confuse TS (DTS coexisting with compiled bodies, module resolution, etc.). But some categories directly weaken type safety:

| Suppressed codes | What they hide        | Impact on audit                                                                |
| ---------------- | --------------------- | ------------------------------------------------------------------------------ |
| 2300, 2451       | Duplicate identifiers | Necessary (DTS + compiled body coexist) but also hides real shadowing bugs     |
| 2307             | Cannot find module    | Rip resolves modules differently, but this also masks genuinely broken imports |

**Fixed:** 7005, 7006, 7034 (implicit `any` on variables and params) were removed from `SKIP_CODES`. Untyped files already get `// @ts-nocheck`, and typed files have sufficient annotations that implicit `any` never leaks through.

**Fixed:** 2304 ("Cannot find name") was removed from `SKIP_CODES`. Stdlib globals (`p`, `pp`, `sleep`, `warn`, etc.) are now declared in the type-check preamble, so undefined variable references are correctly flagged.

The remaining codes (2389, 2391, 2393, 2394, 2567, 2842, 1064, 2582, 2593) are structural — they exist because Rip's compilation model inherently produces overload/duplicate patterns that TS doesn't expect. These are safe to suppress.

## Future Notes — Runtime Return Validation

This captures design notes for the `Runtime return-type validation` gap in `10-validation`.

### Problem

`rip check` verifies declared return types at compile time, but runtime values are not validated. Example: `response.json()` in a function typed as `Promise<User>` can return invalid data and still run.

### Why `@rip-lang/schema` is a likely fit

- Existing runtime validator API (`Schema.validate(typeName, value)`)
- Good support for boundary checks (named object types, nested types, arrays, required/optional)
- Already in this monorepo, no new external dependency needed

### Practical MVP (no grammar changes)

1. **Compiler hook**: in `src/compiler.js`, detect functions with explicit return types (`User`, `Promise<User>`).
2. **Return wrapper**: inject runtime helper around return values for eligible functions.
3. **Validation contract**: use a global hook (for decoupling), e.g. `globalThis.__ripReturnValidator(typeName, value)`.
4. **Schema adapter**: app code can wire `@rip-lang/schema` by setting the hook to call `schema.validate(...)`.
5. **Tests**: extend `test/types/10-validation.rip` with pass/fail runtime cases for typed API payloads.

### Important caveats

- Start with **named type returns**; full arbitrary type expression validation is larger scope.
- `@rip-lang/schema` is good for boundary validation, but not a complete replacement for full TypeScript-level runtime type semantics.
- Consider option-gating first rollout (e.g. compiler/runtime flag) to avoid breaking existing apps.

## TypeScript Companions

Each `.rip` file has a `.ts` companion with equivalent TypeScript for side-by-side IntelliSense comparison.

**Style rules for `.ts` files (mandatory):**

- **No semicolons** — never append `;` to any line
- **Single quotes** — use `'string'` not `"string"`
- **Trailing commas** — in multi-line objects and arrays
- **`type` over `interface`** — use `type X = { ... }` not `interface X { ... }` (except in `05-interfaces.ts` which tests `interface` specifically)
