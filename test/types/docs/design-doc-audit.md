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

## 2. Function type aliases parse error

**Doc ref:** §3 Type Aliases, §7 Function Types

The doc shows:
```coffee
type Callback = (error:: Error?, data:: any) => void
type Comparator = (a:: any, b:: any) => number
type Handler = () => void
```

All forms — `::` params, `:` params, empty parens — produce a parse error. The `rewriteTypes()` rewriter can't handle parenthesized function types as standalone type alias RHS values. Function types only work as structural type **members** (e.g., `compareTo: (other: T) => number`).

**Resolution:** Fix `rewriteTypes()` to handle `type Name = (...) => ReturnType` patterns, or document the workaround (wrap in a structural type).

## 3. Nested structural types emit garbled output

**Doc ref:** §4 Structural Types — "Nesting, Readonly, and Index Signatures"

The doc claims:
```coffee
type Response =
  data: type
    users: User[]
    total: number
```
emits `data: { users: User[]; total: number; }`.

Actual output: `data: type users : User[]total : number;` — garbled inline text, not a nested object.

**Resolution:** Fix `emitTypes()` to handle nested `type` blocks within structural types.

## 4. Index signatures missing opening bracket

**Doc ref:** §4 Structural Types

The doc claims:
```coffee
type Dictionary =
  [key: string]: any
```
emits `[key: string]: any;`.

Actual output: `key: string]: any;` — missing opening `[`.

**Resolution:** Fix `emitTypes()` structural type parsing to preserve index signature brackets.

## 5. Function overloads (bodiless `def`) parse error

**Doc ref:** §7 Function Types

The doc shows:
```coffee
def toHtml(content:: string):: string
def toHtml(nodes:: Element[]):: string
def toHtml(input:: any):: string
  "hi"
```

The first two (bodiless) `def` lines produce a parse error. The grammar requires `def` to have a body.

**Resolution:** Add grammar support for bodiless `def` (type-only declarations that emit to DTS but not JS), or remove overloads from the spec.

## 6. File-level type directives not implemented

**Doc ref:** §12 Adoption Model

The doc describes three file-level directives:
```coffee
# @types off     — Ignore types in this file
# @types emit    — Parse and emit .d.ts
# @types check   — Full TypeScript checking
```

None of these exist. The only directive is `# @nocheck` (opt out of strict-mode checking). There is no `# @types off/emit/check` handler anywhere in the codebase.

**Resolution:** Remove from the spec. The three-mode system doesn't map to any real workflow — untyped files are already "off" (get `// @ts-nocheck` automatically), "emit" is the default for all typed files, and "check" is what `rip check` does. `# @nocheck` is the only escape hatch needed.

## 7. Project-level `types` mode not implemented

**Doc ref:** §12 Adoption Model

The doc claims `rip.json` supports `{ "types": "off" | "emit" | "check" }`.

Actual `rip.json` config: `{ strict: boolean, exclude: string[] }`. There is no `types` mode selector. The typecheck pipeline always uses `types: 'emit'` internally.

**Resolution:** Remove from the spec. `strict` + `exclude` + `# @nocheck` already covers every real scenario. The three-mode project config was designed before implementation and has no use case that isn't already handled.

## 8. Implementation Plan says `emitTypes()` runs before parsing — it doesn't

**Doc ref:** §Implementation Plan (9 references to "before parsing"), §Current Status

The Implementation Plan consistently describes `emitTypes()` running between tokenization and parsing. The Current Status section correctly says it runs after parsing. The actual code (`compiler.js:3468`) runs it **after** parsing and code generation, receiving the s-expression tree.

**Resolution:** Update the Implementation Plan to match reality, or add a note that this section describes the original design which evolved.

## 9. "What Rip Does Not Do" — could mention `rip check` delegation

**Doc ref:** §16 What Rip Intentionally Does Not Do

The doc states Rip does not: narrow types, perform exhaustiveness checks, or reject programs based on type errors. This is accurate — untyped Rip genuinely does none of these things. Only by opting into types does `rip check` delegate to TypeScript, which provides narrowing, exhaustiveness, and error rejection.

The section could be improved by mentioning this delegation explicitly — making it clear that these capabilities become available when types are added, via TypeScript under the hood.

**Resolution:** Consider adding a sentence like "When types are enabled, `rip check` delegates to TypeScript, which provides all of these." Low priority — the current text isn't wrong, just incomplete.

## 10. Minor: extra space in structural function type params

Structural type members with function type signatures emit an extra space around `:` — e.g., `(other : T)` instead of `(other: T)`. Not invalid, but doesn't match doc examples.

**Resolution:** Fix spacing in `emitTypes()` structural type member formatting.

## 11. `expandSuffixes()` regex fails on complex types

**Where:** `src/types.js` — `expandSuffixes()` function

Even if issue #1 is fixed (lexer preserves suffixes in type context), the `expandSuffixes()` regex only matches `word` or `word<simple>` before a suffix. These all fail:

- Union types: `(Foo | Bar)?` — parens not matched by `\w+`
- Nested generics: `Map<string, Set<number>>?` — `[^>]+` stops at the first `>`
- Array types: `string[]?` — brackets not matched
- Intersection: `A & B??` — only `B` matches

**Resolution:** If type suffixes are kept in the spec, rewrite `expandSuffixes()` with a proper parser instead of regex. If suffixes are removed (per issue #1), delete the dead code.
