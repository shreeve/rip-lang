# Solar & Lunar — Dual Parser Generators

One grammar. Two parsers. Two fundamentally different parsing strategies.

```
grammar.rip ──→ Solar ──→ parser.js     (SLR(1) table-driven, 215KB)
             └→ Lunar ──→ parser-rd.js  (predictive recursive descent, 110KB)
```

Both parsers accept the same token stream from the lexer and produce identical
s-expression ASTs. They share no code at runtime — they are completely
independent implementations derived from the same grammar specification.

**Test parity:** 1,162 / 1,182 tests passing (98.3%) — 20 files at 100%.

---

## Files

| File | Lines | Purpose |
|------|-------|---------|
| `grammar.rip` | 944 | Grammar specification — defines all syntax rules |
| `solar.rip` | 926 | SLR(1) parser generator — produces table-driven parsers |
| `lunar.rip` | 2,412 | Predictive recursive descent generator — produces PRD parsers |

---

## Grammar (`grammar.rip`)

The grammar defines Rip's syntax as production rules with semantic actions.
Each rule maps a pattern of tokens and nonterminals to an s-expression:

```coffee
# Assignment: Assignable = Expression → ["=", target, value]
Assign: [
  o 'Assignable = Expression'               , '["=", 1, 3]'
  o 'Assignable = INDENT Expression OUTDENT' , '["=", 1, 4]'
]

# If/else: builds nested s-expression nodes
IfBlock: [
  o 'IF Expression Block'                    , '["if", 2, 3]'
  o 'IfBlock ELSE IF Expression Block'       , '...'  # left-recursive chain
]

# Binary operators: Expression OP Expression with precedence
Operation: [
  o 'Expression + Expression'                , '["+", 1, 3]'
  o 'Expression MATH Expression'             , '[2, 1, 3]'
  o 'Expression ** Expression'               , '["**", 1, 3]'
]
```

---

## Solar (`solar.rip`) — SLR(1) Table Parser Generator

Solar processes the grammar through a classic compiler-theory pipeline:

```
Grammar → Process Rules → Build LR Automaton → Compute FIRST/FOLLOW
        → Build Parse Table → Resolve Conflicts → Generate Code
```

### What it produces

A table-driven parser where every parsing decision is a lookup:
`parseTable[state][symbol]` → shift, reduce, or accept. The parse table
encodes 801 states with all transitions delta-compressed for minimal size.

### How to use

```bash
bun src/grammar/solar.rip grammar.rip              # → parser.js (SLR table)
bun src/grammar/solar.rip -r grammar.rip           # → parser-rd.js (PRD via Lunar)
bun src/grammar/solar.rip --info grammar.rip       # Show grammar statistics
bun src/grammar/solar.rip --sexpr grammar.rip      # Show grammar as s-expression
```

### Integration with Lunar

Solar imports Lunar and installs it with one line:

```coffee
import { install as installLunar } from './lunar.rip'
# ... (Generator class definition) ...
installLunar Generator
```

This adds `generateRD()` to the Generator prototype. When `-r` is passed,
Solar calls `generator.generateRD()` instead of `generator.generate()`.

---

## Lunar (`lunar.rip`) — Predictive Recursive Descent Generator

Lunar analyzes the same grammar that Solar processes and generates a
hand-rolled-looking recursive descent parser with Pratt expression parsing.

### Architecture

The generated parser has five layers:

1. **Token management** — `advance()`, `expect()`, `match()`, `loc()`, `withLoc()`
2. **Speculation** — `mark()`, `reset()`, `speculate()` for backtracking
3. **Pratt expression parser** — `parseExpression(minBP)` with binding powers
4. **Nonterminal functions** — one `parseX()` function per grammar nonterminal
5. **Parser shell** — same API as the table parser (`parser.parse()`, exports)

### How it works

Lunar derives everything from the grammar — no hardcoded token or nonterminal
names in the core generators:

**Expression analysis** (`_analyzeExpressionRules`) — walks the grammar to detect:
- Which nonterminal is the "expression" (contains Operation as an alternative)
- Which is the "operation" (has the most `NT OP NT` binary rules with precedence)
- Which is the "value" (pure choice nonterminal with the most atom alternatives)
- Which is "code" (FIRST set contains `->` or `=>`)
- Assignment operators (nonterminals where all rules are `LHS TOKEN RHS`)
- Prefix starters (keyword tokens that begin expression alternatives)
- Postfix chains (left-recursive property/index/call rules through Value chain)
- Atom types (terminals reachable through the Value nonterminal chain)
- Expression-handled tokens (for skipping redundant choice alternatives)

**Pratt parser generation** (`_generateRDExpression`) — builds the while loop:
- Prefix starters dispatch to keyword-led parsers (IF→parseIf, FOR→parseFor, etc.)
- Assignment operators checked at binding power 0
- Postfix operators from Operation rules (with INDENT/TERMINATOR variants)
- Postfix chains from property/index/call rules (resolved to FIRST sets)
- Infix binary operators with correct associativity and control-flow merging
- Ternary operators
- Postfix if/unless/while/until and comprehensions
- Statement tokens (RETURN, STATEMENT) enter the Pratt loop for postfix patterns

**Nonterminal classification** (`_classifyNonterminal`) — detects patterns:

| Pattern | Detection | Example |
|---------|-----------|---------|
| `root` | Grammar start symbol | Root |
| `body-list` | Left-recursive with TERMINATOR | Body, ComponentBody |
| `comma-list` | Left-recursive with `,` | ArgList, ParamList |
| `concat-list` | Left-recursive, no separator | Interpolations, Whens |
| `left-rec-loop` | Self-referential with terminal continuation | IfBlock |
| `expression` | Contains the operation nonterminal | Expression |
| `operation` | Has binary operator rules | Operation |
| `token` | Single rule, single terminal | Identifier, Property |
| `keyword` | All rules start with unique terminals | Return, Def, Enum |
| `choice` | All rules are single-nonterminal passthroughs | Value, Line, Statement |
| `sequence` | Everything else | Assign, Catch, Block |

**Shared prefix disambiguation** (`_generateRDSharedPrefix`) — handles rules
that share a common beginning:
- Optional chain detection with rule-length-based action dispatch
- Same-token grouping with deeper disambiguation
- Terminal and nonterminal suffix separation with FIRST set grouping
- Empty-rule-as-default when nonterminal suffixes have FIRST checks

**Speculation** — `mark()`/`reset()`/`speculate()` for grammar ambiguities:
- Range vs Array: `[1..10]` vs `[1, 2, 3]` — try Range first
- Slice vs Expression in INDEX_START: `arr[1..3]` vs `arr[0]`
- Range vs destructuring in For: `for [1..5]` vs `for [a, b] as iter`
- Terminal/nonterminal overlap: `...` as Splat vs expansion marker
- Left-rec-loop lookahead: `ELSE IF` vs `ELSE Block` in IfBlock

### Three specialized generators

Three nonterminals (out of 93) have patterns that require multi-token lookahead
and can't be handled by the generic generators:

- **For** (34 rules) — FORIN/FOROF/FORAS variants with optional WHEN/BY in both orders
- **Object** (5 rules) — comprehension vs regular object determined after parsing key:value
- **AssignObj** (6 rules) — key:value vs key=default vs shorthand vs rest after parsing key

90 of 93 nonterminals (96.8%) are generated purely from grammar analysis.

### Remaining 20 test failures (98.3% → 100%)

The remaining failures cluster into a few fixable categories:

| Category | Tests | Root Cause |
|----------|-------|------------|
| **Array elisions** | 5 | `[,1]`, `[1,,3]` — ArgElisionList/Elision not parsed |
| **Trailing comma** | 1 | `[1,2,]` — OptElisions at end of array |
| **Export/Import edge** | 3 | `export { x }` without FROM, `export x ~= ...`, `import x, * as m` — deeper shared-prefix disambiguation generates duplicate conditions |
| **Semicolons context** | 3 | `def foo(); 42` — Def/async without block body (CALL_END before Block) |
| **Class patterns** | 2 | Class expression without name, `@bar:` static in class body |
| **Postfix ternary** | 1 | `a = x if true else 0` — assignment context for postfix ternary |
| **Other edge cases** | 5 | `invalid extends`, `array destructuring skip`, type alias, typed runtime |

**Key fix needed for Export/Import:** The shared-prefix handler generates duplicate
`else if` branches with identical conditions when two rules share a common prefix
through nonterminals but diverge at a terminal after parsing (e.g., `} FROM` vs `}`).
The inner terminal group disambiguator needs to check terminal continuation instead
of generating separate branches.

**Key fix needed for elisions:** The Array parser routes `[` to Range speculation
then Array. Array uses ArgElisionList which calls Arg → Expression. But leading
commas `[,1]` and sparse `[1,,3]` need the Elision nonterminal which the generic
comma-list handler doesn't generate.

---

## Comparison

| Aspect | Solar (SLR) | Lunar (PRD) |
|--------|-------------|-------------|
| Strategy | Bottom-up table lookup | Top-down predictive |
| Output size | 215KB (encoded tables) | 110KB (readable code) |
| Startup | Decode table on load | Zero initialization |
| Debugging | "State 437" errors | Named function call stacks |
| Correctness | Mathematically derived | Grammar-derived + 3 specializations |
| Test parity | 1,235/1,235 (100%) | 1,162/1,182 (98.3%) |
| Speed | O(n) tight loop | O(n) function calls |
| Expressions | Shift/reduce with precedence | Pratt with binding powers |

Both produce identical s-expressions for 98.3% of the test suite. Having two
independent implementations from the same grammar provides cross-validation.

---

## The Innovation

Most parser generators commit to one strategy: Yacc produces LALR tables,
ANTLR produces LL recursive descent, PEG.js produces PEG parsers. Solar and
Lunar generate **both** from a single grammar specification.

The key insight: the FIRST/FOLLOW sets and operator precedence table that
Solar computes for SLR(1) contain all the information a Pratt-based recursive
descent parser needs. The data is the same — it's just read differently.
Solar reads it as table entries. Lunar reads it as dispatch conditions and
binding powers.

Same grammar. Same semantics. Two fundamentally different parsers.
