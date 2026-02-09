<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.png" style="width:50px" /> <br>

# Rip Print - @rip-lang/print

> **Syntax-highlighted source code printer**

Highlights source code using highlight.js and serves the result in the browser for viewing and printing. Serves once and exits — no leftover files, no cleanup.

## Quick Start

```bash
# Install
bun add -g @rip-lang/print

# Print all source files in a directory
rip-print src/

# Print specific files
rip-print src/compiler.js src/lexer.js

# Dark theme
rip-print -d src/

# Strip leading comment blocks
rip-print -b src/

# Exclude extensions
rip-print -x lock,map src/
```

## Features

- **highlight.js** — 190+ languages, beautiful GitHub-style themes
- **Auto-detect languages** — 40+ languages supported
- **Light and dark themes** — GitHub Light (default) and GitHub Dark
- **Print-optimized CSS** — page breaks between files, clean headers
- **Table of contents** — auto-generated for multi-file output
- **Sticky headers** — file names stay visible while scrolling
- **Serve once** — opens browser, serves the page, exits automatically
- **No leftover files** — everything is in-memory

## Options

| Flag | Description |
|------|-------------|
| `-b`, `--bypass` | Strip leading comment blocks from files |
| `-d`, `--dark` | Use dark theme (default: light) |
| `-h`, `--help` | Show help |
| `-x <exts>` | Comma list of extensions to exclude |

## How It Works

1. Walks the specified paths, discovers source files
2. Highlights each file using Shiki with the detected language
3. Builds a single HTML page with table of contents
4. Starts a Bun server on a random port
5. Opens the browser
6. Exits after serving the page

Print from the browser with **Cmd+P** (Mac) or **Ctrl+P** (Windows/Linux).

## Links

- [Rip Language](https://github.com/shreeve/rip-lang)
- [highlight.js](https://highlightjs.org)
