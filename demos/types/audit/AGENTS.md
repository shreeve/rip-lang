# Type Audit — Agent Guide

Independent test files for every Rip type system feature. Each file
compiles and type-checks on its own — a break in one doesn't cascade.

## Verification (ALWAYS run these)

When asked to verify, validate, or check any audit file, run ALL of
these commands from `demos/types/audit/`. No exceptions — don't ask
the user which commands to run, just run them all.

**Single file** (replace FILE with the target, e.g. `01-basic.rip`):

```bash
rip FILE.rip      # 1. run the file — check runtime output
rip -c FILE.rip   # 2. inspect compiled JS
rip -d FILE.rip   # 3. inspect generated .d.ts
```

**Full suite** (always run after single-file checks):

```bash
rip check         # 4. type-check all .rip files
bunx tsc          # 5. type-check all .ts files
```

All five commands must pass. Report results in a summary table.

## Validation Workflow

After any change to the type system (`src/types.js`, `src/typecheck.js`,
`src/compiler.js` type-related code, or `src/lexer.js` type rewriting):

```bash
rip check     # 1. check .rip files
bunx tsc      # 2. check .ts files
```

If errors appear, isolate with single-file commands above.
Update the status table below as features are fixed or regress.

## Feature Status

Each file exercises a specific type feature. Status key:

- **pass** — `rip check` reports no errors, file runs correctly
- **check-only** — `rip check` passes but file can't run (type-only content)
- **fail** — `rip check` or runtime reports errors
- **partial** — some features in the file work, others don't

| File                 | Feature                                      | Status     | Notes                                          |
| -------------------- | -------------------------------------------- | ---------- | ---------------------------------------------- |
| 01-basic.rip         | `::` on variables (primitives, generics, tuples) | pass   |                                                |
| 02-aliases.rip       | `::=` aliases (simple, union, typeof)        | pass       |                                                |
| 03-structural.rip    | `::= type` blocks, optional, readonly, recursive | pass   |                                                |
| 04-nullable.rip      | `:: T \| undefined`, `:: T \| null`, optional `?` | pass  |                                                |
| 05-unions.rip        | Inline unions, block unions, discriminated   | pass       | Narrowing not checked — see gap table          |
| 06-interfaces.rip    | `interface`, `extends`, optional members     | pass       |                                                |
| 07-functions.rip     | `::` on params/returns, rest, union returns  | pass       | Same-file arg types not checked — see file     |
| 08-arrows.rip        | `::` on arrow results (map/filter/reduce)    | pass       |                                                |
| 09-domain.rip        | Nested types, generic structs (`T`)          | pass       |                                                |
| 10-integration.rip   | Cross-module imports of typed functions       | pass       | Cross-file arg types not checked yet           |
| 11-reactive.rip      | `:: T :=`, `:: T ~=`, `:: T =!`, `:: T ~>`  | pass       | Tier 1 — reactive state annotations           |
| 12-components.rip    | `@prop:: T :=`, `@prop:: T =!`               | pass       | Tier 1 — component prop annotations           |
| 13-generics.rip      | `:: Promise<T>`, `:: Map<K,V>` on returns    | pass       | Tier 2 — generic return types                  |
| 14-exports.rip       | `export ... ::=` named type export            | pass       | Tier 3 — `import type` not yet supported       |
| 15-generic-calls.rip | `:: Map<K,V>` on variables (Rip idiom)        | pass       | Tier 3 — generic call-site syntax unnecessary  |
| 16-enums.rip         | `enum` (numeric, string), typed switch        | pass       | Exhaustiveness checking not yet supported       |

## Type Safety Gap Analysis

What `rip check` catches today vs. what it doesn't. This tracks the
overall health of Rip's type story — not just this audit.

| Category                    | Status | Notes                                             |
| --------------------------- | ------ | ------------------------------------------------- |
| Variable type mismatches    | ✅     | Same-file typed variables                         |
| Function argument types     | ✅     | Same-file typed functions                         |
| Function return types       | ✅     | Same-file typed functions                         |
| Object shape checking       | ✅     | Missing fields, extra fields                      |
| Property access checking    | ✅     | Typos, nonexistent fields                         |
| Union value checking        | ✅     | Literal unions validated                          |
| Cross-file type flow        | ✅     | Via .d.ts; untyped files get `@ts-nocheck`        |
| Nullable safety             | 🔶     | `strictNullChecks` is on but many codes suppressed |
| Discriminated union narrow. | 🔶     | Types declarable, narrowing doesn't flow          |
| Component prop types        | 🔶     | Annotations work; cross-file prop checking is limited |
| Generic types               | 🔶     | Declarable; .d.ts emission has some gaps          |
| Readonly / immutability     | 🔶     | `=!` → const; deep readonly not checked           |
| Async/await unwrapping      | 🔶     | `!` operator awaits; return type sometimes `any`  |
| Enum exhaustiveness         | ❌     | Enums emit .d.ts but switch narrowing absent      |
| Type narrowing (control flow)| ❌    | TS narrows compiled JS, not Rip source            |

**Highest-ROI gap:** Component prop types across files. In UI-heavy apps
80% of type errors are at component boundaries.

## Adding a Feature

1. Create a new numbered file (e.g. `17-feature.rip`)
2. Define any needed types locally (type-only imports fail at
   runtime since types are erased)
3. Include a runtime exercise section so the file can both
   `rip check` and `rip FILE.rip`
4. Run `rip check` to verify
5. Add a row to the Feature Status table above

## TypeScript Companions

Each `.rip` file has a `.ts` companion with equivalent TypeScript for
side-by-side IntelliSense comparison.

**Style rules for `.ts` files (mandatory):**

- **No semicolons** — never append `;` to any line
- **Single quotes** — use `'string'` not `"string"`
- **Trailing commas** — in multi-line objects and arrays

## Key Differences from TypeScript

**No type inference.** Rip compiles `x = expr` as `let x; x = expr;`
(split declaration), so TypeScript sees `let x;` → `any` and can't
infer the type from the assignment. Every variable that participates
in type checking must have an explicit `::` annotation. In TypeScript,
`const x = expr` infers the type automatically. This means Rip's `.rip`
files are more verbose than their `.ts` equivalents for derived values.

**Hover types only at declarations.** In TypeScript, hovering any usage
of a variable shows its type. In Rip, type hover only works at the
declaration site — hovering a later usage of the same variable shows
nothing. The VS Code extension proxies hover requests through a
line-based reverse source map that only connects declaration lines,
not every reference.
