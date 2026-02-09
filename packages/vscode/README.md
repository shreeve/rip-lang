<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.svg" style="width:50px" /> <br>

# Rip - VS Code Extension

> **Syntax highlighting and editor integration for Rip**

Full language support for [Rip](https://github.com/shreeve/rip-lang), a modern reactive language that compiles to JavaScript. Provides syntax highlighting, comment toggling, bracket matching, code folding, and type annotation support.

## Features

- Full syntax highlighting for `.rip` files
- Comment toggling (`#` line, `###` block)
- Bracket matching and auto-closing
- Indentation-based code folding
- Type annotation highlighting (`::`, `::=`)
- Reactive operator highlighting (`:=`, `~=`, `~>`)

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

No additional dependencies required. This extension provides syntax highlighting out of the box.

## Development

### Install Locally

```bash
cd packages/vscode
npx @vscode/vsce package --no-dependencies
cursor --install-extension rip-0.1.0.vsix --force
# Then: Cmd+Shift+P -> "Developer: Reload Window"
```

### Test in Extension Development Host

Open `packages/vscode/` as a workspace folder, then press **F5** to launch a new window with the extension loaded. Open `test/sample.rip` to verify syntax highlighting.

### Publishing

#### 1. Create a Personal Access Token

1. Go to https://dev.azure.com
2. Sign in with your Microsoft account (or create one)
3. Click your profile icon (top right) -> **Personal Access Tokens**
4. Click **New Token**
5. Set:
   - **Name**: `Rip`
   - **ID**: rip-lang
   - **Description**: A modern reactive language that compiles to JavaScript
   - **Logo**: Upload the Rip logo (the icon.png from packages/vscode/)
   - **Scopes**: Custom defined -> **Marketplace** -> check **Manage**
6. Click **Create** and copy the token

#### 2. Create the Publisher (one-time)

```bash
npx @vscode/vsce create-publisher rip-lang
# Display name: Rip
# Personal Access Token: <paste token>
```

#### 3. Publish

```bash
cd packages/vscode
npx @vscode/vsce publish
```

#### 4. Update

Bump `version` in `package.json`, then run `npx @vscode/vsce publish` again.

## Links

- [Rip Language](https://github.com/shreeve/rip-lang)
- [Rip Types Documentation](https://github.com/shreeve/rip-lang/blob/main/docs/RIP-TYPES.md)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=rip-lang.rip)
