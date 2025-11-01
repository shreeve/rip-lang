# Changelog

All notable changes to Rip will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-11-01

### Added
- **Beautiful s-expression formatter** - Canonical format with proper indentation
  - Deployed in CLI (`-s` flag), browser REPL, and as standalone utility
  - 80% more compact than JSON, fully parenthesized
  - Heregex patterns collapsed to single line
  - Meta-circular: Rip code formatting Rip's data structures!
- **Script execution** - `rip script.rip` now executes directly (no explicit `bun` needed)
  - Auto-detects .rip files and uses Bun loader
  - Passes arguments correctly
  - Shebang support: `#!/usr/bin/env rip`
- **Browser REPL launcher** - `rip -w` starts local server and opens browser
  - One-command workflow
  - Works offline with local changes
  - Cross-platform (macOS, Windows, Linux)
- **Resizable REPL panes** - Drag slider between Rip source and JavaScript output
- **Local time display** - Build timestamp shown in user's timezone
- **Friendly error messages** - Clear "File not found" instead of stack traces

### Fixed
- **Postfix `by` step in comprehensions** - `for i in [0..10] by 2` now works
- **Nested IIFE elimination** - Major code generation optimization (37% smaller)
- **Throw in expressions** - Properly wrapped in IIFE
- **Rest parameters in middle position** - Both functions and array destructuring
  - `def fn(first, ...middle, last)` works
  - `[first, ...middle, last] = arr` works
- **Parser error messages** - Now show line and column numbers
- **Range loops without variable** - `for [1..10]` optimization
- **Comprehension context detection** - Smart IIFE vs plain loop decisions
- **Step handling refactoring** - Unified logic, 37% code reduction
- **Global installation** - `rip -w` works correctly when installed via npm/bun

### Changed
- Version bumped to 1.1.0
- Test count: 843 → 864 (+21 tests, all passing)
- Documentation updated throughout
- Package.json prepared for NPM publishing

### Documentation
- Complete GitHub workflow system (issues, PRs, templates)
- AI agent onboarding guide
- CONTRIBUTING.md with real examples
- Updated README, AGENT.md, COFFEESCRIPT-COMPARISON.md
- All stats current (864 tests)

### Infrastructure
- 10 complete GitHub workflows (issue → branch → test → fix → PR → merge)
- Comprehensive test coverage (100% passing)
- Ready for NPM publish

## [1.0.0] - 2025-10-31

### Initial Release
- Complete Rip language compiler
- CoffeeScript-inspired syntax with modern ES2022 output
- Zero dependencies (includes SLR(1) parser generator)
- Self-hosting capability
- 843/843 tests passing
- Terminal REPL
- Browser bundle (43KB brotli-compressed)
- Complete documentation
