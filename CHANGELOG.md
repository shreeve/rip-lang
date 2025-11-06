# Changelog

All notable changes to Rip will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.6] - 2025-11-06

### Changed
- **Simplified Object.hasOwn() generation** - Removed unnecessary _pregenerated pattern
  - Direct inline generation instead of wrapper objects
  - Cleaner code flow (~30 lines removed)
  - No need for special handling since Object.hasOwn() is built-in ES2022

## [1.3.5] - 2025-11-06

### Changed
- **Modernized to Object.hasOwn()** (#36) - Replaced hasOwnProperty with ES2022 standard
  - All `obj.hasOwnProperty(key)` → `Object.hasOwn(obj, key)`
  - Cannot be shadowed by instance properties
  - Works with null-prototype objects
  - More readable and safer
  - Uses clean `continue` pattern like CoffeeScript
- Test count: 891 → 893 (+2 tests)

## [1.3.4] - 2025-11-06

### Fixed
- **Semicolons in all contexts** - Extended clean semicolon removal to nested blocks
  - Function bodies now have clean blocks (no semicolons after `}`)
  - Method bodies now have clean blocks
  - Loop bodies and nested contexts all clean
  - Added helper methods: `needsSemicolon()` and `addSemicolon()`
  - Applied smart semicolon logic to all statement generation

### Changed
- Cleaner JavaScript output throughout entire codebase, not just top-level

## [1.3.3] - 2025-11-06

### Changed
- **Cleaner JavaScript output** (#34) - Removed unnecessary semicolons after block statements
  - Function and class declarations no longer have trailing semicolons
  - Control flow blocks (if/for/while/switch/try) no longer have trailing semicolons
  - Produces more idiomatic, professional-looking JavaScript
  - Matches standard formatters (Prettier, ESLint)
- Test count: 878 → 891 (+13 tests)

## [1.3.2] - 2025-11-05

### Changed
- Minor code cleanup and refinements
- Updated solar.rip indentation handling for better code generation

## [1.3.1] - 2025-11-05

### Added
- **Otherwise operator (`!?`)** (#32) - Undefined-only coalescing
  - Returns first value that is NOT `undefined`
  - Unlike `??` (nullish), treats `null`, `false`, `0`, `""` as valid values
  - Perfect for optional parameters with meaningful falsy values
  - Syntax: `value1 !? value2 !? 'default'`
  - Example: `timeout = config.timeout !? 5000` (null/0 are valid!)
- Test count: 868 → 878 (+10 tests)

## [1.3.0] - 2025-11-05

### Added
- **Script execution with proper argument passing** - `rip script.rip -h` now passes `-h` to script
  - Arguments before script name → rip options
  - Arguments after script name → script arguments
  - Fixes issue where rip would consume script's flags
- **Solar.rip synchronization** - Updated to match solar-parser 1.2.0
  - New CLI options: `--version`, `--info`, `--sexpr`
  - Removed `commonCode` architecture for simpler code generation
  - Fixed file writing bug (was using `unless` incorrectly)

### Changed
- Improved CLI argument parsing for better script execution

## [1.2.2] - 2025-11-04

### Added
- **Browser REPL UI improvements** - Cleaner, more intuitive interface
  - Made "Live Compiler" the default tab
  - Added Clear and Run buttons to Rip Source panel
  - Converted checkboxes to toggle buttons (gray/blue states)
  - Consistent header layout across both panes
  - Helpful tooltips on all buttons

### Fixed
- **For-loop destructuring with defaults** (#30) - Full CoffeeScript compatibility
  - `for [a, b = 99, c = 88] in arr` now works correctly
  - Generates proper ES6 destructuring with defaults
  - Previously generated invalid s-expressions in patterns

### Changed
- Test count: 867 → 868 (+1 test)

## [1.2.1] - 2025-11-04

### Fixed
- **Slice syntax with nested indices** (#28) - Property access after nested brackets now works
  - `line[_[0].length..]` now compiles correctly
  - Fixed lexer rewriter to use bracket depth counting
  - Previously failed with parse error
  - Example: `arr[obj.data[0].length..]` → `arr.slice(obj.data[0].length)`
- Test count: 865 → 867 (+2 tests)

## [1.2.0] - 2025-11-04

### Fixed
- **Switch without discriminant context bug** (#26) - Statement context no longer adds returns
  - Switch in loops now generates correct code (no invalid returns)
  - Made `generateSwitchAsIfChain()` context-aware
  - Value context: adds returns (switch as expression)
  - Statement context: plain statements (side effects only)
- **__DATA__ section generation** - Natural code emission without string surgery
  - `var DATA;` now positioned logically before `_setDataSection()` call
  - Removed ~50 lines of complex regex/string manipulation
  - Clean, obvious code generation in `generateProgram()`
- **S-expression pretty printer** - Restored missing features
  - Fixed heregex handling (multi-line regex collapsing)
  - Fixed program node formatting with proper indentation
  - Faster with Set lookup for INLINE_FORMS
  - Modern JS with optional chaining and nullish coalescing

### Changed
- Test count: 864 → 865 (+1 test)
- Improved code generation architecture

## [1.1.5] - 2025-11-03

### Fixed
- **npm package files** - Added `scripts/serve.js` for `rip -w` command
  - Browser REPL now works for npm users
  - Fixed missing dependency for web server functionality

### Changed
- S-expression printer improvements backported to docs/examples/sexpr.rip

## [1.1.4] - 2025-11-03

### Fixed
- **S-expression printer** - Improved performance and correctness
  - Faster Set-based INLINE_FORMS lookup
  - Modern JavaScript features (optional chaining, nullish coalescing)
  - Proper heregex and program node formatting
  - All functionality restored and working

## [1.1.3] - 2025-11-03

### Fixed
- **Package files** - Included `scripts/serve.js` in npm package
  - Required for `rip -w` browser REPL command

## [1.1.2] - 2025-11-02

### Added
- **npm publishing safeguards** (#24) - Professional package configuration
  - `files` whitelist (only 51 essential files published)
  - `prepublishOnly` script (runs tests + rebuilds browser bundle)
  - `pack` script for previewing package contents
- **Comprehension optimization** (#22) - Eliminated wasteful IIFEs
  - Function-final comprehension assignments ~24% smaller
  - Smarter context detection for when to use IIFE vs plain loop

### Changed
- Package size optimized: excludes test/, scripts/, dev files
- Test count: 864 tests (all passing)

## [1.1.1] - 2025-11-01

### Fixed
- **Browser REPL launcher (`rip -w`)** - Port fallback now works correctly
  - Fixed `ReferenceError: assignedPort is not defined`
  - Server tries port 3000, falls back to OS-assigned port if busy
  - Browser opens with correct port automatically
  - Works when installed globally via `npm install -g rip-lang` or `bun install -g rip-lang`

### Changed
- Refactored serve.js to eliminate code duplication
- Improved port detection by parsing server output

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
