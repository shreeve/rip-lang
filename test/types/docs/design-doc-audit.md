# RIP-TYPES.md Audit Issues

Issues discovered by testing every claim in `docs/RIP-TYPES.md` against the actual compiler. Work through these one by one.

## 1. Type suffixes (`T?`, `T??`, `T!`) are broken

**Doc ref:** §5 Optionality Modifiers, Current Status table ("Working")

The doc claims `string?` → `string | undefined`, `string??` → `string | null | undefined`, `ID!` → `NonNullable<ID>`. The Current Status table says "Working."

Actual output:
- `email:: string? = ""` → DTS: `let email: string;` (`?` silently eaten by lexer)
- `middle:: string?? = ""` → DTS: `let middle: string ??;` (invalid TypeScript)
- `id:: ID! = 0` → DTS: `let id: ID;` (`!` silently eaten by lexer)

**Root cause:** The lexer strips `?` and `!` (setting `data.predicate` / `data.await`) before `types.js` sees them. `expandSuffixes()` in types.js is dead code.

**Resolution:** Remove from the spec (see `?::` RFC below) or fix the lexer to preserve them in type context.

## ~~2. Function type aliases parse error~~

**Status:** Fixed. `collectTypeExpression()` in `src/types.js` now handles `=> INDENT ... OUTDENT` (the lexer wraps arrow return types in indent blocks). Added `.consumed` tracking for accurate splice ranges. Function type aliases (`type Fn = (a: T) => R`) now parse, emit correct DTS, and type-check. Test added in `02-aliases.rip`.

## ~~3. Nested structural types emit garbled output~~

**Status:** Fixed. Two changes in `src/types.js`: (1) `collectStructuralType` now detects `IDENTIFIER "type"` + `INDENT` and recursively calls itself to build nested `{ ... }` strings. (2) `emitBlock` uses depth-aware splitting (tracks `{`/`}` depth) instead of naive `'; '` split, so nested semicolons aren't shredded. Test added in `03-structural.rip`.

## ~~4. Index signatures missing opening bracket~~

**Status:** Fixed. Added index signature detection in `collectStructuralType()` in `src/types.js` — when `[` is seen at depth 1, collects through `]: type`, formats as `[sig]: val`. Test added in `03-structural.rip` (MixedMap + negative test).

## ~~5. Function overloads (bodiless `def`) parse error~~

**Status:** Fixed. Three changes: (1) `rewriteTypes()` in `src/types.js` second pass detects bodiless typed `def` and replaces with `TYPE_DECL` markers (`kind: 'overload'`) before the parser sees them. (2) `emitTypes()` handles `kind: 'overload'` to emit `declare function` lines in DTS. (3) `compileForCheck()` in `src/typecheck.js` fixed return-type stacking bug — when multiple DTS sigs target the same implementation, only the last sig's params/return annotate the body. Test added in `06-functions.rip`.

## ~~6. File-level type directives not implemented~~

**Status:** Resolved. Removed `# @types off/emit/check` from the spec (§12 Adoption Model and Implementation Plan). Replaced with `# @nocheck` which is what actually exists. Untyped files already get `// @ts-nocheck` automatically.

## ~~7. Project-level `types` mode not implemented~~

**Status:** Resolved. Replaced the `{ "types": "off" | "emit" | "check" }` config in the spec with what actually exists: `{ strict: boolean, exclude: string[] }`. Also updated `types: "check"` references in §Editor-First Workflow and §What Rip Intentionally Does Not Do to say `rip check`.

## 8. Implementation Plan says `emitTypes()` runs before parsing — it doesn't

**Doc ref:** §Implementation Plan (9 references to "before parsing"), §Current Status

The Implementation Plan consistently describes `emitTypes()` running between tokenization and parsing. The Current Status section correctly says it runs after parsing. The actual code (`compiler.js:3468`) runs it **after** parsing and code generation, receiving the s-expression tree.

**Resolution:** Update the Implementation Plan to match reality, or add a note that this section describes the original design which evolved.

## 9. "What Rip Does Not Do" — could mention `rip check` delegation

**Doc ref:** §16 What Rip Intentionally Does Not Do

The doc states Rip does not: narrow types, perform exhaustiveness checks, or reject programs based on type errors. This is accurate — untyped Rip genuinely does none of these things. Only by opting into types does `rip check` delegate to TypeScript, which provides narrowing, exhaustiveness, and error rejection.

The section could be improved by mentioning this delegation explicitly — making it clear that these capabilities become available when types are added, via TypeScript under the hood.

**Resolution:** Consider adding a sentence like "When types are enabled, `rip check` delegates to TypeScript, which provides all of these." Low priority — the current text isn't wrong, just incomplete.

## ~~10. Minor: extra space in structural function type params~~

**Status:** Fixed. Added ` : ` → `: ` replacement in `buildTypeString()` in `src/types.js`. Now `(other: T)` instead of `(other : T)`.

## 11. `expandSuffixes()` regex fails on complex types

**Where:** `src/types.js` — `expandSuffixes()` function

Even if issue #1 is fixed (lexer preserves suffixes in type context), the `expandSuffixes()` regex only matches `word` or `word<simple>` before a suffix. These all fail:

- Union types: `(Foo | Bar)?` — parens not matched by `\w+`
- Nested generics: `Map<string, Set<number>>?` — `[^>]+` stops at the first `>`
- Array types: `string[]?` — brackets not matched
- Intersection: `A & B??` — only `B` matches

**Resolution:** If type suffixes are kept in the spec, rewrite `expandSuffixes()` with a proper parser instead of regex. If suffixes are removed (per issue #1), delete the dead code.
