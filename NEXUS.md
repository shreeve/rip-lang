# NEXUS Grammar Specification Syntax

## Overview

**NEXUS** is a unified grammar syntax used by the **Solar** toolchain to define programming language grammars once and target multiple backends seamlessly. This includes:

- **Tree-sitter** grammars (for IDEs, syntax highlighting, and incremental parsing)
- **Solar-LR/IELR** parsers (for deterministic, compiler-grade parsing with actions)
- **Solar-GLR** parsers (for tolerant or ambiguous parsing in interactive environments)

The goal is to express the *entire structure* of a language grammar — lexing, parsing, and repetition patterns — using a compact, readable syntax that maps directly to Tree-sitter’s combinators while being deterministic enough for LR/GLR generation.

With NEXUS syntax, a single `.rip` grammar file can describe the complete language structure and be transformed into all these targets. This avoids the duplication, divergence, and fragility common when maintaining separate grammars for compilers and editors.

---

## Design Philosophy

NEXUS is intentionally minimal and regular. Each sigil (symbolic operator) represents a single parsing combinator. These sigils compose naturally to express complex language constructs such as nested groups, optional elements, and separated lists — all without needing extra rules or boilerplate.

By using sigils instead of verbose function calls, the grammar reads like the surface syntax of the language being described, keeping it lightweight and visually familiar.

---

## Sigil Reference Table

| **Sigil / Form** | **Tree-sitter Mapping** | **Description** |
|------------------:|-------------------------|-----------------|
| `A B C` | `seq($.A, $.B, $.C)` | **Sequence** — all items must appear in order. (`=` can be explicit, but adjacency implies it.) |
| `@ (A B C)` or `A @ B @ C` | `choice($.A, $.B, $.C)` | **Alternation** — one of several possible rules. |
| `X?` | `optional($.X)` | **Optional** — zero or one occurrence. |
| `X*` | `repeat($.X)` | **Repetition (0+)** — zero or more occurrences. |
| `X+` | `repeat1($.X)` | **Repetition (1+)** — one or more occurrences. |
| `'(' expr+ ')'` | `seq('(', repeat1($.expr), ')')` | **Grouping / nesting** — parentheses group sub-expressions. (Literals stay quoted.) |
| `X{S}` | `seq($.X, repeat(seq(S, $.X)))` | **Separated list (1+)** — one-or-more `X`, separated by `S`. |
| `X{S}?` | `optional(seq($.X, repeat(seq(S, $.X))))` | **Separated list (0+)** — zero-or-more `X`, separated by `S`. |
| `X{S+}` | `seq($.X, repeat(seq(S, $.X)), optional(S))` | **Separated list (1+) with trailing sep allowed**. |
| `X{S+}?` | `optional(seq($.X, repeat(seq(S, $.X)), optional(S)))` | **Separated list (0+) with trailing sep allowed**. |
| `(expr)` | `($.expr)` | **Grouping** for precedence or clarity; no node created. |
| `SoftSep = TERMINATOR?` | `optional($.TERMINATOR)` | **Named optional separator**; reusable shorthand. |
| *(future)* `A ~ B` | `seq($.A, token.immediate($.B))` | **Immediate adjacency** (no extras between tokens) — optional future extension. |

---

## Advantages

### 🧩 **Single Source of Truth**
Define the grammar once and generate multiple targets:
- **Tree-sitter** for editors and IDEs.
- **Solar-LR** for production compilation.
- **Solar-GLR** for interactive or ambiguous parsing.

### 🧮 **Clean, Readable Syntax**
NEXUS grammars look like code, not data structures. You can skim them and instantly understand precedence, repetition, and grouping.

### ⚙️ **Directly Translatable**
Each sigil maps one-to-one with Tree-sitter combinators and Solar’s parser actions, ensuring deterministic compilation and faithful reproduction.

### ♻️ **Composable & Extensible**
The syntax allows easy extension with macros (`%prec`, `:field`, `@inline`) and future operators like `~` for immediate adjacency.

---

## Example

### NEXUS Syntax
```coffeescript
Expr =
  @ (
    (:left Expr) '+' (:right Expr)
    (:left Expr) '*' (:right Expr)
    NUMBER
    '(' Expr ')'
  )

Args = Arg{','+}?
```

### Generated Tree-sitter Grammar
```js
expr: $ => choice(
  prec.left(seq(field('left', $.expr), '+', field('right', $.expr))),
  prec.left(seq(field('left', $.expr), '*', field('right', $.expr))),
  $.NUMBER,
  seq('(', $.expr, ')')
),

args: $ => optional(seq($.arg, repeat(seq(',', $.arg)), optional(',')))
```

### Generated Solar-LR Rules
```coffeescript
Expr
  → Expr '+' Expr   { ['+', $1, $3] }
  | Expr '*' Expr   { ['*', $1, $3] }
  | NUMBER          { ['num', text()] }
  | '(' Expr ')'    { $2 }

Args
  → (Arg (',' Arg)* ','?)?
```

---

NEXUS turns the grammar file into the **center of truth** for the entire toolchain. From that one definition, Solar can emit fast, deterministic LR parsers for compilers and elegant, incremental Tree-sitter grammars for IDEs — perfectly aligned.

