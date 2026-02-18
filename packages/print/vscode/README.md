<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.png" style="width:50px" /> <br>

# Rip Print - VS Code Extension

Syntax-highlighted source code printing for VS Code.

## Features

- Print the current file with beautiful syntax highlighting
- Print all files in a folder
- 14 color themes (7 light, 7 dark) with runtime switching
- Adjustable font sizes (S / M / L)
- Line numbers
- Table of contents for multi-file prints
- Print-optimized CSS (toolbar and navigation hidden when printing)
- Auto-detects light/dark mode from your VS Code theme

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

## Packaging and Publishing

```sh
cd packages/print/vscode
npm install
npm run package                  # produces print-1.0.2.vsix
npx @vscode/vsce publish         # publishes to marketplace as rip-lang.print
```

To install locally:

```sh
code --install-extension print-1.0.2.vsix --force
```
