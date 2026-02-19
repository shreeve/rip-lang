<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.png" style="width:50px" /> <br>

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
- Type annotation highlighting (`::`, `::=`)
- Reactive operator highlighting (`:=`, `~=`, `~>`)

## How It Works

The extension runs a lightweight language server that compiles `.rip` files to virtual TypeScript in memory. The TypeScript language service reads these virtual files to provide completions, hover info, go-to-definition, and signature help — without ever writing to disk.

```
.rip file → Rip compiler → virtual .ts (in-memory) → TypeScript service → IntelliSense
```

The Rip compiler is loaded from the workspace (`src/compiler.js` in a dev repo, or `node_modules/rip-lang` otherwise). TypeScript is loaded from the workspace or the editor's built-in copy. The server runs under Bun for fast startup.

## Tailwind CSS Autocompletion

To enable Tailwind CSS autocompletion inside `.()` CLSX helpers in Rip render templates, add these to your VS Code or Cursor settings:

```json
"tailwindCSS.includeLanguages": { "rip": "html" },
"tailwindCSS.experimental.classRegex": [
  ["\\.\\(([\\s\\S]*?)\\)", "'([^']*)'"]
]
```

## Rip at a Glance

```coffee
# Types (optional, compile-time only)
def greet(name:: string):: string
  "Hello, #{name}!"

User ::= type
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
bun run install-ext

# Then reload the window: Cmd+Shift+P → "Developer: Reload Window"
```

### What the build does

1. **`esbuild src/extension.js`** → `dist/extension.js` (~345KB) — the LSP client, bundled with `vscode-languageclient`
2. **`esbuild src/server.js`** → `dist/server.js` (~177KB) — the language server, bundled with `vscode-languageserver`
3. **`vsce package`** → `rip-*.vsix` — the installable extension package

Both `vscode` and `typescript` are external (not bundled) — `vscode` is provided by the editor, `typescript` is loaded at runtime from the workspace or editor.

## Publishing

```bash
cd packages/vscode
npx @vscode/vsce login rip-lang    # login with PAT (one-time)
npx @vscode/vsce publish           # publish to Marketplace
```

Bump `version` in `package.json` before each publish.

## Links

- [Rip Language](https://github.com/shreeve/rip-lang)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=rip-lang.rip)
