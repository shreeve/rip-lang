---
description: Load Rip project context
---

You are working on **Rip**, a modern reactive language that compiles to ES2022 JavaScript. The project lives at `/Users/shreeve/Data/Code/rip-lang`. Before doing anything, read these files to understand the language and codebase:

1. **`AGENT.md`** — AI guide to the compiler architecture, project structure, build commands, testing
2. **`README.md`** — Language overview, features, operators, installation
3. **`docs/RIP-LANG.md`** — Full language reference (syntax, operators, reactivity, modules)
4. **`src/grammar/README.md`** — How Solar and Lunar work (this is the current project)

For packages work, also read `packages/README.md` for package overview.

Key references:
- `docs/RIP-LANG.md` — Language reference
- `docs/RIP-INTERNALS.md` — Compiler internals & design rationale

## Compiler Development

### File Editing Rules

| File | Can Edit? | Notes |
|------|-----------|-------|
| `src/compiler.js` | Yes | Code generator |
| `src/lexer.js` | Yes | Lexer + Rewriter |
| `src/components.js` | Yes | Component system |
| `src/grammar/grammar.rip` | Carefully | Run `bun run parser` after changes |
| `src/parser.js` | Never | Generated file |
| `src/grammar/solar.rip` | Never | Parser generator |
| `test/rip/*.rip` | Yes | Test files |

### Compilation Pipeline

```
Rip Source  ->  Lexer  ->  Parser  ->  S-Expressions  ->  Codegen  ->  JavaScript
```

S-expressions are simple arrays like `["=", "x", 42]`.

### Build Commands

- `bun run test` — Run tests before committing
- `bun run parser` — Rebuild parser after grammar changes
- `bun run browser` — Rebuild browser bundle after codegen changes
