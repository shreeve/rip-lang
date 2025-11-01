# Changelog

All notable changes to Rip will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-11-01

### Major Enhancements

#### Comprehensions & Loops
- **Postfix comprehensions with `by` step** - `(x for x in [0...10] by 2)` now works ([#1](https://github.com/shreeve/rip-lang/issues/1))
- **Range loops without loop variable** - `for [1...N]` for N-time repetition ([#9](https://github.com/shreeve/rip-lang/issues/9))
- **Nested comprehension optimization** - Eliminated wasteful nested IIFEs, 50%+ output reduction ([#11](https://github.com/shreeve/rip-lang/issues/11))
- **Unified step handling** - Supports any negative step (`by -2`, `by -3`), 37% code reduction ([#3](https://github.com/shreeve/rip-lang/issues/3))

#### Parameter Handling
- **Rest parameters in middle position** - `(first, middle..., last)` now generates valid JavaScript ([#15](https://github.com/shreeve/rip-lang/issues/15))
- **Array destructuring with rest in middle** - `[first, ...middle, last] = arr` works correctly ([#17](https://github.com/shreeve/rip-lang/issues/17))

#### Error Handling
- **Throw in expression position** - `x = fn() || throw "error"` wraps in IIFE for valid JS ([#13](https://github.com/shreeve/rip-lang/issues/13))
- **Parser error locations** - Errors now show line and column numbers for easy debugging ([#7](https://github.com/shreeve/rip-lang/issues/7))

#### Developer Experience
- **`rip` executes scripts directly** - `rip script.rip` now runs scripts (no `bun` needed) ([#19](https://github.com/shreeve/rip-lang/issues/19))
- **`rip -w` launches browser REPL** - One command to start local server and open REPL
- **Beautiful s-expression formatter** - Canonical format with 80% less vertical space
- **Friendly error messages** - "File not found: X" instead of stack traces

### Browser REPL Enhancements
- **Resizable panes** - Drag slider between Rip source and JavaScript output
- **Local time display** - Build timestamp shown in user's timezone
- **Canonical s-expression display** - Compact, readable format with proper indentation
- **Heregex collapse** - Multi-line regexes displayed as single-line quoted strings

### Bug Fixes
- **Comprehension last-statement context** - Fixed array destructuring comprehensions ([#5](https://github.com/shreeve/rip-lang/issues/5))
- **Block comments** - Confirmed working (handled by CoffeeScript lexer)

### Infrastructure
- **GitHub issue templates** - Bug report, feature request, CoffeeScript compatibility, questions
- **PR template** - Comprehensive checklist for contributions
- **CONTRIBUTING.md** - Complete workflow guide with real examples
- **docs/WORKFLOW.md** - Quick command reference
- **.cursor/rules/rip-agent-onboarding.md** - AI agent onboarding guide
- **ISSUE-11.md** - Handoff documentation for complex issues

### Documentation
- **Real-world output comparison** - Demonstrated 50% smaller output vs CoffeeScript
- **Heregex interpolation behavior** - Documented #{} vs ${} in regexes
- **Updated all stats** - Test counts, file references, feature lists
- **Cleaned up HTML files** - Removed outdated files, renamed for clarity

### Code Quality
- **Refactored step handling** - Eliminated code duplication, cleaner logic
- **Consistent formatting** - All s-expressions use canonical parenthesized format
- **Meta-circular utilities** - S-expression formatter written in Rip itself

### Testing
- **21 new tests added** - Coverage for all new features
- **Test count: 843 → 864** - All passing (100%)
- **Comprehensive coverage** - Nested comprehensions, rest in middle, throw expressions

### Package
- **Ready for NPM** - Complete package.json with engines, repository, keywords
- **Bun requirement** - Clearly specified (Bun >=1.0.0)

### Real-World Validation
- **bar.coffee migration** - Complex 400-line CoffeeScript file now compiles perfectly
- **Output quality** - 608 lines (CoffeeScript) → 304 lines (Rip) = 50% smaller
- **All features working** - Nested switches, comprehensions, rest params, everything!

---

## [1.0.0] - 2025-10-31

### Initial Release

- ✅ Complete CoffeeScript-inspired syntax
- ✅ 843/843 tests passing (100%)
- ✅ Zero dependencies
- ✅ Self-hosting compiler
- ✅ ES2022 output
- ✅ Triple REPL (terminal, browser, console)
- ✅ 43KB browser bundle
- ✅ Comprehensive documentation

**Features:**
- Dual optional syntax (CoffeeScript soak + ES6 optional chaining)
- Dammit operator (`!`) for call-and-await
- Void functions (side-effect only)
- Heregex (extended regex with comments)
- Ruby-style regex (`=~` operator, indexing)
- __DATA__ marker
- Auto-detection (async/generators)
- Context-aware comprehensions
- Smart range optimization

**Implementation:**
- 9,450 LOC (50% smaller than CoffeeScript's 17,760)
- S-expression IR (simple arrays vs complex AST)
- SLR(1) parser generator included (solar.rip)
- Complete ES6 module support

---

[1.1.0]: https://github.com/shreeve/rip-lang/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/shreeve/rip-lang/releases/tag/v1.0.0
