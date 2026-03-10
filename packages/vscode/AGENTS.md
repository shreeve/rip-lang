# VS Code Extension — Agent Guide

The extension in `packages/vscode/` provides syntax highlighting, autocomplete, hover, go-to-definition, and signature help via TypeScript.

## Type Intelligence Flow

1. compile `.rip` to virtual `.ts` in memory
2. let a TypeScript language service analyze that virtual file
3. proxy completion / hover / definition through the reverse source map
4. return the mapped result to the `.rip` editor

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
