<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.svg" style="width:50px" /> <br>

# @rip-lang/parser

**SLR(1) Parser Generator for Rip**

> **Status:** This package will contain the standalone parser generator extracted from `rip-lang`. Coming soon.

## Overview

`@rip-lang/parser` is an SLR(1) parser generator written in Rip. It's the same parser generator (`solar.rip`) that powers the Rip compiler itself.

## Current Location

The parser generator currently lives in the main `rip-lang` package at:
- `src/grammar/solar.rip` — The parser generator
- `src/grammar/grammar.rip` — Rip's grammar specification

## Planned Features

- Standalone SLR(1) parser generator
- Generate parsers from grammar specifications
- Self-hosting (written in Rip, compiles itself)

## Related

- [rip-lang](https://github.com/shreeve/rip-lang) — The Rip language compiler
- [SOLAR.md](https://github.com/shreeve/rip-lang/blob/main/docs/SOLAR.md) — Parser generator documentation

## License

MIT
