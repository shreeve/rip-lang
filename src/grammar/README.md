# Solar — Rip's Parser Generator

One grammar. One parser. Mathematically derived.

```
grammar.rip ──→ Solar ──→ parser.js   (SLR(1) table-driven)
```

The parser accepts the token stream from the lexer and produces s-expression
ASTs — simple arrays like `["=", "x", 42]` — that the code emitter consumes.

---

## Files

| File | Purpose |
|------|---------|
| `grammar.rip` | Grammar specification — defines all syntax rules |
| `solar.rip` | SLR(1) parser generator — produces the table-driven parser |

`src/parser.js` is the generated output. Never edit it by hand — regenerate
with `bun run parser` after any grammar change.

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

Action format:

- Numbers (`1`, `2`, `...3`) reference matched symbols by position
- `...N` spreads the array at position N
- String literals become s-expression nodes: `'["if", 2, 3]'`
- Default action (no action given) returns position 1

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
encodes all states with transitions delta-compressed for minimal size.

### How to use

```bash
bun run parser                                     # Regenerate src/parser.js
bun src/grammar/solar.rip grammar.rip              # → parser.js (SLR table)
bun src/grammar/solar.rip --info grammar.rip       # Show grammar statistics
bun src/grammar/solar.rip --info --conflicts grammar.rip  # Conflict details
bun src/grammar/solar.rip --sexpr grammar.rip      # Show grammar as s-expression
bun src/grammar/solar.rip -o out.js grammar.rip    # Custom output path
```

### Workflow for grammar changes

1. Edit `src/grammar/grammar.rip`
2. Run `bun run parser`
3. Verify the new parse shape with `echo 'code' | ./bin/rip -s`
4. Update codegen in `src/compiler.js` if the node shape changed
5. Run `bun run test`
