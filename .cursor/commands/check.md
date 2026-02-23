---
description: Check code for quality
---

Review the current diff to ensure it's correct, clear, clean, consistent, concise, and efficient.

Check specifically:
- Tests pass (`bun run test`)
- No regressions in test count
- Compiler output looks right for affected features (`echo '...' | ./bin/rip -c`)
- No accidental debug code or console.log left behind
- If stdlib changed, `getStdlibCode()` is the single source of truth (compiler.js, repl.js, and browser REPL all use it)
