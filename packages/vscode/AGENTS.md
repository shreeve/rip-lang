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

## Syntax Highlighting Roadmap

Rip has a TextMate grammar (`syntaxes/rip.tmLanguage.json`) and a Markdown injection grammar (`syntaxes/rip-markdown-injection.tmLanguage.json`). Current status of ` ```rip ` fenced block highlighting:

| Surface                        | Status          | What's needed                                                                                                                                                      |
| ------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| VS Code editor (`.rip` files)  | **Working**     | Nothing — TextMate grammar is registered                                                                                                                           |
| VS Code Markdown source        | **Working**     | Nothing — Markdown injection grammar handles this                                                                                                                  |
| VS Code Markdown preview       | **Not working** | Preview uses a hardcoded language list in VS Code's built-in `markdown-basics` extension; requires a PR to [microsoft/vscode](https://github.com/microsoft/vscode) |
| GitHub                         | **Not working** | Requires adding Rip to [github/linguist](https://github.com/github/linguist): `languages.yml` entry, grammar reference, sample file                                |
| Shiki (VitePress, Astro, etc.) | **Not working** | Contribute `rip.tmLanguage.json` to [shikijs/shiki](https://github.com/shikijs/shiki)                                                                              |
| highlight.js                   | **Partial**     | `docs/ui/hljs-rip.js` exists but is only used in Rip's own docs site                                                                                               |
| Prism                          | **Not working** | Needs a separate JS grammar definition (different format from TextMate)                                                                                            |

**Current recommendation:** Use ` ```coffee ` in Markdown for maximum compatibility (highlights reasonably on GitHub, in preview, and in editor). Switch to ` ```rip ` once Linguist support lands.
