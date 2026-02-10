<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.png" style="width:50px" /> <br>

# Rip Vim - vim-rip

> **Vim syntax highlighting, indentation, and filetype support for Rip**

Full-featured Vim plugin for the [Rip](https://github.com/shreeve/rip-lang) programming language, with highlighting quality on par with the VS Code extension.

## Features

- **Syntax highlighting** — keywords, strings, numbers, operators, types, built-ins, comments
- **String interpolation** — `#{}` and `${}` with nested brace support
- **Function calls** — `fetch(`, `.json(`, and dammit calls (`name!`)
- **Object keys** — `method:` and `optional?:` highlighting
- **Assignment variables** — `x = 5` highlights the variable name
- **Function definitions** — `def name`, `name = ->`, and `name: ->`
- **Class / enum / interface** — name and extends capture
- **Reactive operators** — `:=`, `~=`, `~>`, `<=>`, `=!`
- **Type annotations** — `::` and `::=`
- **Regular expressions** — `/regex/` and `///heregex///` with interpolation
- **Auto-indentation** — indent/dedent for offside-rule blocks
- **Filetype settings** — 2-space soft tabs, fold-by-indent, `gf` navigation

## Install

**vim-plug:**

```vim
Plug 'shreeve/vim-rip'
```

**lazy.nvim (Neovim):**

```lua
{ "shreeve/vim-rip" }
```

**Pathogen:**

```bash
cd ~/.vim/bundle && git clone https://github.com/shreeve/vim-rip.git
```

**Vim packages (no plugin manager):**

```bash
mkdir -p ~/.vim/pack/languages/start
cd ~/.vim/pack/languages/start
git clone https://github.com/shreeve/vim-rip.git
```

## Plugin Structure

| File | Purpose |
|------|---------|
| `ftdetect/rip.vim` | Detect `*.rip` files and `#!/usr/bin/env rip` shebangs |
| `ftplugin/rip.vim` | Comment format, indentation, fold method, `suffixesadd` |
| `syntax/rip.vim` | Syntax highlighting rules |
| `indent/rip.vim` | Auto-indentation for offside-rule blocks |

## Links

- [Rip Language](https://github.com/shreeve/rip-lang)
- [vim-rip on GitHub](https://github.com/shreeve/vim-rip)
- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=rip-lang.rip)
