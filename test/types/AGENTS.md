# Type Audit — Agent Guide

Independent test files for every Rip type system feature. Each file compiles and type-checks on its own — a break in one doesn't cascade.

## Verification (ALWAYS run these)

When asked to verify, validate, or check any audit file, run ALL of these commands from `demos/types/audit/`. No exceptions — don't ask the user which commands to run, just run them all.

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
```

All commands must pass. 09-components (.rip and .tsx) are silent at runtime but type-check correctly. Report results in a summary table. If errors appear, isolate with single-file commands. Update the status table below as features are fixed or regress.

## Feature **Status**

Each file exercises a specific type feature. Status key:

- **pass** — `rip check` reports no errors, file runs correctly
- **check-only** — `rip check` passes but file can't run (type-only content)
- **fail** — `rip check` or runtime reports errors
- **partial** — some features in the file work, others don't

| File               | Feature                                                     | Status | Notes                                            |
| ------------------ | ----------------------------------------------------------- | ------ | ------------------------------------------------ |
| 01-basic.rip       | `::` on variables, nullable (`T \| null`, `T \| undefined`) | pass   |                                                  |
| 02-aliases.rip     | `::=` aliases (simple, union, typeof)                       | pass   |                                                  |
| 03-structural.rip  | `::= type` blocks, optional, readonly, recursive, generic   | pass   | Includes `PagedResult<T>` generic struct         |
| 04-unions.rip      | Inline, block, discriminated unions + switch narrowing      | pass   | Narrowing not checked — see gap table            |
| 05-interfaces.rip  | `interface`, `extends`, optional members                    | pass   |                                                  |
| 06-functions.rip   | Typed functions, arrows, and array transforms               | pass   | 15 negative tests (7 param + 5 return + 3 array) |
| 07-integration.rip | Cross-module imports of typed functions                     | pass   | Cross-file type flow via .d.ts                   |
| 08-reactive.rip    | `:: T :=`, `:: T ~=`, `:: T =!`, `:: T ~>`                  | pass   | Tier 1 — reactive state annotations              |
| 09-components.rip  | `@prop:: T :=`, `@prop:: T =!`                              | pass   | Tier 1 — component prop annotations              |
| 10-validation.rip  | Runtime validation + async/await (`!` operator)             | pass   | Tier 2 — Rip erases types; TS+Zod validates      |
| 11-inference.rip   | Type inference on unannotated variables                     | pass   | Top-level works; block/destructure/any are gaps  |

## Type Safety Gap Analysis

What `rip check` catches today vs. what it doesn't. This tracks the overall health of Rip's type story — not just this audit. Grouped by status, ordered by importance within each group.

### ❌ Not working

**Compiler / type-checker gaps** (affect `rip check` correctness):

| Category                         | Tested In                | Notes                                                                                                                 |
| -------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Component prop types             | 09-components            | .d.ts emits typed constructors but no safety inside component body — **highest-ROI gap** (90% of app code lives here) |
| Event handler typing             | 09-components            | Handler params are untyped — `(e) ->` gives `any`, no typed event objects                                             |
| Runtime return-type validation   | 10-validation            | Return types are erased — `response.json()` is unvalidated `any`; no `schema.parse()` equivalent                      |
| Type narrowing (control flow)    | 04-unions *(comment)*    | TS narrows compiled JS, not Rip source                                                                                |
| Destructured typed params        | 06-functions *(comment)* | `{name:: string}` in params fails to parse                                                                            |
| Optional param `?` in .d.ts      | 06-functions *(comment)* | `y?:: T` emits `y: T` — drops the `?`; use default param workaround                                                   |
| `void` return annotation         | 06-functions *(comment)* | `void` is reserved; use `!` operator (`def fn!`) instead                                                              |
| Unresolved import paths          | 07-integration           | `rip check` doesn't flag imports to nonexistent files                                                                 |
| Enum exhaustiveness              | 04-unions                | Switch narrowing works in .ts but `rip check` doesn't verify exhaustiveness                                           |
| Inline discriminated union .d.ts | 04-unions *(comment)*    | `Shape ::= \| { kind: "circle" } \| { ... }` emits malformed .d.ts; split into named types as workaround              |

**Component model gaps** (would need language-level changes):

| Category                    | Tested In     | Notes                                                                                          |
| --------------------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| Shared state typing (stash) | 09-components | Stash is untyped — any path/value accepted; zustand equivalent is fully typed (see .tsx)       |
| Element type inheritance    | 09-components | No way to inherit HTML element's full type surface; wrappers must declare each prop manually   |
| Generic components          | 09-components | Can't parameterize components by type (e.g. typed select where value type flows through props) |

**IDE-only gaps** (require VS Code extension changes, not testable in audit files):

| Category                    | Tested In    | Notes                                                                                                 |
| --------------------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| Hover types                 | *(IDE only)* | Hover only works at declaration site; later usages show nothing. Reactive `:=`/`~=` always show `any` |
| Go-to-definition on imports | *(IDE only)* | Import lines unmapped; works at call sites only                                                       |

### 🔶 Partial

| Category                      | Tested In     | Notes                                                                                                                                         |
| ----------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Nullable safety               | 01-basic      | `strictNullChecks` is on but many codes suppressed                                                                                            |
| Readonly / immutability       | 03-structural | `=!` → const; deep readonly not checked                                                                                                       |
| Generic types                 | 03-structural | Declarable; .d.ts emission has some gaps                                                                                                      |
| Discriminated union narrowing | 04-unions     | Types declarable, narrowing doesn't flow in `rip check`                                                                                       |
| Async/await unwrapping        | 10-validation | `!` operator compiles to `await`; with return type annotation TS correctly unwraps `Promise<T>` → `T`; without annotation the result is `any` |
| Type inference (split decl.)  | 11-inference  | Top-level `x = expr` inferred via `patchUninitializedTypes`; block-scoped, destructured, and `any` RHS are gaps                               |

### ✅ Working

| Category                 | Tested In      | Notes                                      |
| ------------------------ | -------------- | ------------------------------------------ |
| Variable type mismatches | 01-basic       | Same-file typed variables                  |
| Object shape checking    | 03-structural  | Missing fields, extra fields               |
| Union value checking     | 04-unions      | Literal unions validated                   |
| Property access checking | 03-structural  | Typos, nonexistent fields                  |
| Function argument types  | 06-functions   | Same-file typed functions                  |
| Function return types    | 06-functions   | Same-file typed functions                  |
| Cross-file type flow     | 07-integration | Via .d.ts; untyped files get `@ts-nocheck` |

### Suppressed error codes

`rip check` runs TypeScript under the hood but suppresses 15 error codes (defined in `SKIP_CODES` in [src/typecheck.js](../../../src/typecheck.js)). Most suppressions are necessary — Rip's compilation model produces patterns that confuse TS (DTS coexisting with compiled bodies, module resolution, etc.). But three categories directly weaken type safety:

| Suppressed codes | What they hide                         | Impact on audit                                                                                                           |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 7005, 7006, 7034 | Implicit `any` on variables and params | Root cause of the component prop gap — TS *would* flag untyped props inside component bodies, but these codes suppress it |
| 2304             | Cannot find name                       | Masks references to undefined variables; contributes to unresolved import gap                                             |
| 2300, 2451       | Duplicate identifiers                  | Necessary (DTS + compiled body coexist) but also hides real shadowing bugs                                                |
| 2307             | Cannot find module                     | Rip resolves modules differently, but this also masks genuinely broken imports                                            |

The remaining codes (2389, 2391, 2393, 2394, 2567, 1064, 2582, 2593) are structural — they exist because Rip's compilation model inherently produces overload/duplicate patterns that TS doesn't expect. These are safe to suppress.

Reducing the implicit-any suppressions (7005/7006/7034) is the single highest-leverage change for type safety — it would surface errors in every component body and untyped function. The tradeoff: it would also flag every intentionally untyped variable in untyped files, so it likely needs a per-file opt-in (e.g. only enforce when the file has `::` annotations).

## TypeScript Companions

Each `.rip` file has a `.ts` companion with equivalent TypeScript for side-by-side IntelliSense comparison.

**Style rules for `.ts` files (mandatory):**

- **No semicolons** — never append `;` to any line
- **Single quotes** — use `'string'` not `"string"`
- **Trailing commas** — in multi-line objects and arrays
- **`type` over `interface`** — use `type X = { ... }` not `interface X { ... }` (except in `05-interfaces.ts` which tests `interface` specifically)
