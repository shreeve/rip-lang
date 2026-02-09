<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.png" style="width:50px" /> <br>

# Rip - VS Code Extension

> **Syntax highlighting, type generation, and editor integration for Rip**

Full language support for [Rip](https://github.com/shreeve/rip-lang), a modern reactive language that compiles to JavaScript. Provides syntax highlighting, comment toggling, bracket matching, code folding, type annotation support, and automatic `.d.ts` generation.

## Features

- Full syntax highlighting for `.rip` files
- Comment toggling (`#` line, `###` block)
- Bracket matching and auto-closing
- Indentation-based code folding
- Type annotation highlighting (`::`, `::=`)
- Reactive operator highlighting (`:=`, `~=`, `~>`)
- Auto-generate `.d.ts` files on save
- Commands: generate types for current file or entire workspace

## Type Generation

Rip's optional type system emits `.d.ts` files for TypeScript interoperability. The extension automatically generates these files when you save a `.rip` file with type annotations.

### How It Works

1. Add type annotations to your Rip code using `::` and `::=`
2. Save the file — the extension runs `rip -d` to generate a `.d.ts` alongside it
3. TypeScript/JavaScript consumers of your package get full autocomplete and type checking

### Example

```coffee
# greet.rip — types are optional, compile-time only
def greet(name:: string):: string
  "Hello, #{name}!"

User ::= type
  id: number
  name: string
  email?: string

export { greet, User }
```

Saving generates `greet.d.ts`:

```typescript
export declare function greet(name: string): string;
export interface User {
  id: number;
  name: string;
  email?: string;
}
```

### Commands

- **Rip: Generate .d.ts for Current File** — generate types for the active `.rip` file
- **Rip: Generate .d.ts for All Files** — generate types for all `.rip` files in the workspace

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `rip.types.generateOnSave` | `true` | Auto-generate `.d.ts` on save |
| `rip.compiler.path` | (auto) | Path to the `rip` compiler binary |

## Rip at a Glance

```coffee
# Types (optional, emit .d.ts)
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

The Rip compiler (`rip-lang` npm package) must be installed for type generation. Syntax highlighting works without it.

```bash
npm install -g rip-lang    # global install
# or
npm install rip-lang       # local install (auto-detected)
```

## Development

### Install Locally

```bash
cd packages/vscode
npx @vscode/vsce package --no-dependencies
cursor --install-extension rip-0.3.1.vsix --force
# Then: Cmd+Shift+P -> "Developer: Reload Window"
```

### Test in Extension Development Host

Open `packages/vscode/` as a workspace folder, then press **F5** to launch a new window with the extension loaded. Open `test/sample.rip` to verify syntax highlighting.

### Publishing

```bash
cd packages/vscode
npx @vscode/vsce login rip-lang    # login with PAT (one-time)
npx @vscode/vsce publish           # publish to Marketplace
```

Bump `version` in `package.json` before each publish.

## Links

- [Rip Language](https://github.com/shreeve/rip-lang)
- [Rip Types Documentation](https://github.com/shreeve/rip-lang/blob/main/docs/RIP-TYPES.md)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=rip-lang.rip)
