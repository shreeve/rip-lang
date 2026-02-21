<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Rip Print

Syntax-highlighted source code printing for VS Code and Cursor.

## Features

- Print the current file with beautiful syntax highlighting
- Print all files in a folder
- 14 color themes (7 light, 7 dark) with runtime switching
- Adjustable font sizes (S / M / L)
- Line numbers
- Table of contents for multi-file prints
- Print-optimized CSS (toolbar and navigation hidden when printing)
- Auto-detects light/dark mode from your editor theme
- Rip syntax highlighting inside `<script type="text/rip">` HTML blocks

## Usage

### Command Palette

- `Rip Print: Print Current File` — print the active editor file
- `Rip Print: Print Folder` — print all files in a selected folder

### Context Menus

- **Explorer**: Right-click a file or folder to print
- **Editor**: Right-click in the editor → Rip Print: Print Current File

## Supported Languages

40+ languages including JavaScript, TypeScript, Python, Rust, Go, Ruby, C, C++,
Zig, Rip, CoffeeScript, Bash, YAML, JSON, HTML, CSS, SQL, Markdown, and more.

HTML files with embedded `<script type="text/rip">` blocks get proper Rip
syntax highlighting instead of JavaScript.

## Installation

### From the Marketplace

Search for "Rip Print" in the Extensions panel, or visit:
https://marketplace.visualstudio.com/items?itemName=rip-lang.print

### From a Local Build

```sh
cd packages/print/vscode
npm install
npm run package                  # produces print-x.y.z.vsix
```

Install into **VS Code**:

```sh
code --install-extension print-x.y.z.vsix --force
```

Install into **Cursor**:

```sh
cursor --install-extension print-x.y.z.vsix --force
```

### Publishing

```sh
npx @vscode/vsce publish         # publishes to marketplace as rip-lang.print
```
