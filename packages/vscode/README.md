<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Rip - VS Code Extension

> **Syntax highlighting, type intelligence, and editor integration for Rip**

Full language support for [Rip](https://github.com/shreeve/rip-lang), a modern reactive language that compiles to JavaScript. Provides syntax highlighting, an in-memory TypeScript language server, comment toggling, bracket matching, and code folding.

## Features

- Full syntax highlighting for `.rip` files
- TypeScript-powered IntelliSense (completions, hover, go-to-definition, signature help)
- All type intelligence runs in-memory — no generated files on disk
- Comment toggling (`#` line, `###` block)
- Bracket matching and auto-closing
- Indentation-based code folding
- Type annotation highlighting (`::`, `type`)
- Reactive operator highlighting (`:=`, `~=`, `~>`)

## How It Works

The extension runs a lightweight language server that compiles `.rip` files to virtual TypeScript in memory. The TypeScript language service reads these virtual files to provide completions, hover info, go-to-definition, and signature help — without ever writing to disk.

```
.rip file → Rip compiler → virtual .ts (in-memory) → TypeScript service → IntelliSense
```

The Rip compiler is loaded from the workspace (`src/compiler.js` in a dev repo, or `node_modules/rip-lang` otherwise). TypeScript is loaded from the workspace or the editor's built-in copy. The server runs under Bun for fast startup.

## Type Inference for Hoisted Variables

The Rip compiler hoists local variable declarations to the top of their scope (`let x; x = expr;` instead of `let x = expr;`). TypeScript sees the uninitialized `let` and infers `any`, which kills IntelliSense — no completions, no hover types, no signature help.

We explored several approaches: inlining `let` in the compiler (broke `eval` semantics in tests), post-processing the virtual TypeScript (complex source map adjustments), and monkey-patching the TypeScript checker's public API (fixed hover but not completions, because the completions pipeline uses internal functions that bypass patched methods).

The solution exploits TypeScript's own `getSymbolLinks()` function, which is the internal gateway used by 67+ checker functions. It checks `symbol.flags & Transient` first — and if set, reads type information from `symbol.links` on the object itself instead of an inaccessible closured array. By setting these two properties on each hoisted variable's symbol before any type resolution occurs, TypeScript sees the correct inferred type through every code path: hover, completions, signature help, and go-to-definition.

This is 35 lines of code in the language server — no compiler changes, no source map changes, no generated files.

## Tailwind CSS Autocompletion

Tailwind IntelliSense works automatically in `.rip` files when the
[Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)
extension is installed. The Rip extension configures the class regex patterns
via `configurationDefaults` — no manual setup needed.

Completions are provided in these contexts:

```coffee
div.("px-4 py-2 text-sm")          # .() CLSX helper — double or single quotes
div class: "flex items-center"      # class: attribute
```

If you need to override the patterns (e.g., to merge with other frameworks),
add these to your settings:

```json
"tailwindCSS.includeLanguages": { "rip": "html" },
"tailwindCSS.experimental.classRegex": [
  ["\\.\\(([\\s\\S]*?)\\)", "\"([^\"]*)\""],
  ["\\.\\(([\\s\\S]*?)\\)", "'([^']*)'"],
  "class:\\s*\"([^\"]*)\"",
  "class:\\s*'([^']*)'"
]
```

## Rip at a Glance

```coffee
# Types (optional, compile-time only)
def greet(name:: string):: string
  "Hello, #{name}!"

type User =
  id: number
  name: string

# Reactivity (language-level operators)
count := 0
doubled ~= count * 2
~> console.log doubled

# Modern syntax
data = fetchUsers!                  # Dammit operator (call + await)
squares = (x * x for x in [1..10]) # Comprehensions
str =~ /Hello, (\w+)/              # Regex match
```

## Requirements

[Bun](https://bun.sh/) must be installed — the language server runs under Bun for fast startup.

The Rip compiler (`rip-lang` npm package) must be available in the workspace for type intelligence. Syntax highlighting works without it.

```bash
curl -fsSL https://bun.sh/install | bash   # install Bun (if needed)
npm install rip-lang                        # install Rip compiler
```

## Building the Extension

The extension manages its own dependencies and builds into self-contained bundles via esbuild.

```bash
cd packages/vscode

# Install dependencies (only needed once, or after updating package.json)
bun install

# Build the bundled dist/ files
bun run build

# Build + package into a .vsix
bun run package

# Build + package + install into Cursor
bun run install-cursor

# Build + package + install into VS Code
bun run install-vscode

# Then reload the window: Cmd+Shift+P → "Developer: Reload Window"
```

### What the build does

1. **`esbuild src/extension.js`** → `dist/extension.js` (~345KB) — the LSP client, bundled with `vscode-languageclient`
2. **`esbuild src/lsp.js`** → `dist/lsp.js` (~179KB) — the language server, bundled with `vscode-languageserver`
3. **`vsce package`** → `rip-*.vsix` — the installable extension package

Both `vscode` and `typescript` are external (not bundled) — `vscode` is provided by the editor, `typescript` is loaded at runtime from the workspace or editor.

## Publishing

```bash
cd packages/vscode

# Bump version first
$EDITOR package.json

# Build a local installable package
bun run package

# Install locally in Cursor while testing the release
bun run install-cursor

# Publish to the Marketplace
bunx @vscode/vsce login rip-lang   # one-time
bunx @vscode/vsce publish --no-dependencies --skip-license
```

Release notes:

- `packages/vscode` is not included in the root `bun run bump` flow.
- After publishing, create and push a git tag such as `vscode-vX.Y.Z`.
- Create a matching GitHub release and attach the generated `rip-*.vsix`.

### Repeatable Release Checklist

```bash
# 1. Bump the extension version in packages/vscode/package.json
#    and keep bun.lock in sync if it tracks the workspace version.

# 2. Run validation from the repo root
bun run test

# 3. Build, package, and install locally in Cursor
cd packages/vscode
bun run install-cursor

# 4. If the repo has unrelated changes, stage only the release files
cd ../..
git add bun.lock packages/vscode/package.json packages/vscode/README.md src/components.js src/typecheck.js src/types.js

# 5. Commit and push the release
git commit -m "Release VS Code extension vX.Y.Z"
git push

# 6. Publish to the Marketplace
cd packages/vscode
bunx @vscode/vsce publish --no-dependencies --skip-license

# 7. Tag and publish the GitHub release
cd ../..
git tag "vscode-vX.Y.Z"
git push origin "vscode-vX.Y.Z"
gh release create "vscode-vX.Y.Z" "packages/vscode/rip-X.Y.Z.vsix" \
  --title "VS Code Extension vX.Y.Z"
```

- Reload Cursor after local install so the new extension instance is active.
- When the worktree is dirty, stage only the files meant for the extension release.

## Links

- [Rip Language](https://github.com/shreeve/rip-lang)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=rip-lang.rip)
