# RIP-TYPES.md Audit Issues

Issues discovered by testing every claim in `docs/RIP-TYPES.md` against the actual compiler. Work through these one by one.

## ~~1. Type suffixes (`T?`, `T??`, `T!`) are broken~~

**Status:** Resolved by RFC 1 (implemented). The suffix operators have been removed from the spec entirely. `?` only ever means "optional" when placed on a name before `::` (`name?:: T`). Value-level optionality is written with explicit unions (`T | undefined`, `T | null | undefined`, `NonNullable<T>`). `data.predicate` was renamed to `data.optional`. See `docs/RIP-TYPES.md` "Optionality Modifiers".

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

## ~~8. Implementation Plan says `emitTypes()` runs before parsing — it doesn't~~

**Status:** Resolved. Updated 6 locations in the Implementation Plan. `emitTypes()` actually runs after codegen and receives both the annotated token stream and the parsed s-expression tree. Remaining "before parsing" references correctly describe TYPE_DECL marker removal.

## ~~9. "What Rip Does Not Do" — could mention `rip check` delegation~~

**Status:** Resolved. Added explicit mention that `rip check` delegates to TypeScript for narrowing, exhaustiveness, and error rejection when types are added.

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
