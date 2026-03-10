# VS Code Extension — Agent Guide

The extension in `packages/vscode/` provides syntax highlighting, auto `.d.ts` generation on save, autocomplete, hover, and go-to-definition via TypeScript, and commands to generate `.d.ts` for one file or all files.

## Type Intelligence Flow

1. compile `.rip` to shadow `.ts` in `.rip-cache/`
2. let VS Code TypeScript analyze that shadow file
3. proxy completion / hover / definition through the reverse source map
4. return the mapped result to the `.rip` editor

## Settings

| Setting | Purpose |
| --- | --- |
| `rip.types.generateOnSave` | auto-generate `.d.ts` on save |
| `rip.types.intellisense` | enable autocomplete / hover / definition |
| `rip.compiler.path` | override compiler binary path |

## Debugging

Typical sequence for investigating type issues:

```bash
rip --shadow file.rip
rip -d file.rip
rip -cd file.rip
rip -c file.rip
rip -s file.rip
```

`rip --shadow` dumps the virtual TypeScript file that `rip check` and the extension feed into the TypeScript language service.

## Publishing

```bash
cd packages/vscode
npx @vscode/vsce login rip-lang
npx @vscode/vsce publish
```

## Type System Reference

The type system architecture (`types.js`, `typecheck.js`) and detailed type audit are documented in `src/AGENTS.md` and `test/types/AGENTS.md` respectively.
