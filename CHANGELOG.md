<p><img src="docs/rip.svg" alt="Rip Logo" width="100"></p>

# Changelog

All notable changes to Rip will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-14

### Added - Reactive UI Framework

**Phase 1: Reactivity** (previously released)
- Signal-based reactivity: `count = 0` creates reactive state
- Derived values: `doubled ~= count * 2` auto-tracks dependencies
- Effects: `effect -> console.log count` runs on changes
- Runtime: `__signal()`, `__computed()`, `__effect()`, `__batch()`, `__readonly()`

**Phase 2: Templates**
- Indentation-based template syntax in `render` blocks
- CSS-style selectors: `div#main.card.active`
- Event handlers: `@click: handler`
- Event modifiers: `@click.prevent.stop: handler`
- Two-way binding: `input value <=> username`
- Spread attributes: `div ...props`
- Dynamic classes: `div.('btn', isActive && 'active')` (clsx-style)
- Control flow: `if`/`else`, `for` loops in templates
- Special attributes: `key:`, `ref:`
- Multiple roots via `DocumentFragment`
- Runtime helpers: `h()`, `frag()`, `txt()`, `cx()`

**Phase 3: Components**
- `component` keyword for defining UI components
- Props system:
  - Required: `@label`
  - Optional: `@label?`
  - Default: `@label = "default"`
  - Rest: `@...rest`
- Reactive state within components (auto-signals)
- Derived values within components (auto-computed)
- Component composition: `Button label: "Click"` inside render
- Children/slots: `@children` prop for nested content
- Lifecycle hooks: `mounted:`, `unmounted:`
- Reactive re-rendering via effect-based mount

### Changed
- Grammar extended with `component`, `render`, `style` keywords
- Lexer handles template contexts (ID selectors, arrow injection)
- Codegen generates ES6 classes for components

### Technical Details
- Components compile to ES6 classes with constructor, render, mount, unmount
- Props validated at construction (required props throw if missing)
- State variables become `__signal()` calls
- Derived values become `__computed()` calls
- `mount()` wraps render in `__effect()` for reactive updates
- PascalCase names in templates trigger component instantiation

All 1033 tests passing (100%) ✅

---

## [1.5.7] - 2025-11-16

### Changed
- **Documentation updates** - Updated all version references to 1.5.7
  - Updated README.md version badge and status section
  - Updated AGENT.md current status section
  - Regenerated parser and browser bundles with correct version
  - All compiled artifacts current and properly versioned

All 968 tests passing (100%) ✅

## [1.5.6] - 2025-11-16

### Fixed
- **Package completeness** - Ensure all compiled files included in npm package
  - Regenerated parser with optimized encoding
  - Rebuilt browser bundles (44.55 KB compressed)
  - All compiled artifacts present and current

All 968 tests passing (100%) ✅

## [1.5.5] - 2025-11-16

### Changed
- **Parser optimization: Sign-based parseTable encoding** - 28.7% faster parsing!
  - Transformed parseTable from `[type, value]` arrays to semantic integers
  - Positive N = GOTO/SHIFT to state N (forward movement)
  - Negative -N = REDUCE by rule N (contraction)
  - 0 = ACCEPT (parsing complete)
  - undefined = ERROR (syntax error)
  - **Performance improvements:**
    - Parse speed: 28.7% faster (3.27ms → 2.33ms average)
    - Full compile: 16.3% faster (15.24ms → 12.75ms)
    - File size: 24.5% smaller (291.9KB → 220.4KB, -71.5KB)
  - **Why it's fast:** Direct integer comparison (`action > 0`, `action < 0`) instead of array unpacking, better cache locality, fewer allocations
  - The sign bit elegantly encodes operation semantics
  - Updated src/grammar/solar.rip with optimized encoding
  - Regenerated src/parser.js with new format
  - Documented in AGENT.md architecture section

All 968 tests passing (100%) ✅

## [1.5.3] - 2025-11-09

### Added
- **Keyboard shortcuts for Run button in browser REPL** (repl.html)
  - **F5** - Execute code (all platforms)
  - **Cmd+Enter** - Execute code (Mac)
  - **Ctrl+Enter** - Execute code (Windows/Linux)
  - Refactored Run button handler into reusable `runCode()` function
  - Added global keyboard event listener with preventDefault to avoid conflicts
  - Updated Run button tooltip to show available shortcuts
  - Improves workflow for quick code execution without mouse clicks

All 962 tests passing (100%) ✅

## [1.5.2] - 2025-11-09

### Fixed
- **Fixed 'in' operator to check array VALUES instead of INDICES** (#60)
  - JavaScript's `in` operator checks indices: `'apple' in ['apple', 'banana']` returns `false`
  - Previous fix (v1.4.2) only handled string literal in variable case
  - Now handles ALL cases: variable in variable, literal in literal, variable in literal
  - Uses runtime dispatch: arrays/strings → `.includes()`, objects → `in` operator
  - Added 15 comprehensive tests (12 execution + 3 code generation)
  - Critical fix: prevents silent bugs where membership checks return wrong results
  - Example: `val = 'apple'; val in ['apple', 'banana']` now correctly returns `true`

All 962 tests passing (100%) ✅

## [1.5.1] - 2025-11-09

### Fixed
- **Refined heredoc closing delimiter logic** for edge cases
  - Only uses closing position when it's at or left of content minimum
  - Falls back to minimum indent when closing is right of content (old behavior)
  - Removes trailing whitespace-only line when using minimum indent fallback
  - Prevents incorrect dedenting when closing delimiter is indented beyond content

### Changed
- **Refactored heredoc logic into helper methods** for maintainability
  - Extracted `getHeredocClosingColumn()` - Detects closing delimiter position
  - Extracted `extractHeredocContent()` - Gets content from tokens
  - Extracted `findMinimumIndent()` - Calculates minimum indentation
  - Extracted `selectHeredocIndent()` - Chooses baseline intelligently
  - Extracted `removeTrailingWhitespaceLine()` - Cleans up edge case
  - Main heredoc logic now 15 lines (was 70), crystal clear
  - Zero performance impact, much more maintainable

- **Added inline SVG favicon to HTML files**
  - repl.html, index.html, example.html now have embedded favicon
  - No HTTP request needed for favicon
  - Works in all contexts (local, GitHub Pages, offline)

- **Enhanced dev server** (scripts/serve.js)
  - Now strips `/rip-lang/` prefix for GitHub Pages URL compatibility
  - Works with both local and GitHub Pages paths

All 947 tests passing (100%) ✅

## [1.5.0] - 2025-11-09

### Added
- **Heredoc closing delimiter position determines dedenting baseline** (#58)
  - When closing `'''` or `"""` has only whitespace before it, use its column as baseline
  - Strip that exact amount from all content lines
  - Preserve additional indentation beyond baseline
  - Falls back to minimum-indent behavior when non-whitespace precedes closing delimiter
  - Visual control: Move closing delimiter left/right to control stripping
  - Perfect for code generation use cases
  - Works with both single (`'''`) and double (`"""`) quote heredocs
  - Added 10 comprehensive tests covering all edge cases

### Removed
- **Soak super syntax** (`super?()`) - Removed for clarity and simplicity
  - Semantically questionable (parent methods always exist in practice)
  - Zero real-world usage (one test only)
  - Makes `super?()` a parse error (clearer than silently handling)
  - Removed `generateOptionalSuper` method from codegen
  - Removed `?super` from dispatch table
  - Removed test from test/rip/classes.rip

### Changed
- Test count: 938 → 947 (+10 heredoc tests, -1 soak super test)

All 947 tests passing (100%) ✅

## [1.4.6] - 2025-11-08

### Changed
- **Documentation updates for consistency**
  - Updated AGENT.md to reflect current version (1.4.6)
  - Standardized all test count references to 938/938 (100%)
  - Updated README.md version references

All 938 tests passing (100%) ✅

## [1.4.5] - 2025-11-08

### Changed
- **Renamed rip-loader.ts → rip-loader.js** - Pure JavaScript, no TypeScript
  - Removed fake TypeScript annotation (`err: any` → `err`)
  - Updated `bunfig.toml` to reference `.js` file
  - Updated `package.json` exports and files array
  - Honest about what the file is - simplicity and clarity

- **Completed CODEGEN-FINAL-ANALYSIS recommendations**
  - Extracted `isNegativeOneLiteral()` helper method (DRY principle)
  - Removed duplicate negative-one literal checks
  - Deleted analysis document (all work complete)

All 938 tests passing (100%) ✅

## [1.4.4] - 2025-11-08

### Changed
- **S-expression formatter - Clean room rebuild**
  - Complete rewrite of `formatSExpr()` with clear, simple rules
  - Fixed indentation hierarchy: children ALWAYS indented more than parents
  - Fixed method chaining indentation (`.` operator in call heads)
  - Multi-line heads now properly re-indented to maintain hierarchy
  - Block nodes always expand children on separate lines
  - Removed all column-based continuation complexity
  - +89 lines added, -52 lines removed (net +37 for clarity)

- **INLINE_FORMS cleanup**
  - Removed legacy MUMPS cruft (tag, entryref, lock-*, newline, etc.)
  - Organized by category with aligned comments
  - Added `new` to inline forms for compact constructor calls
  - Clear documentation of what belongs and why

### Improved
- S-expression output is now beautifully formatted with perfect hierarchy
- Method chaining like `s.replace().trim()` displays correctly
- Simple constructors stay compact: `(new (Date))`
- Complex constructors expand naturally: `(new (Set (...)))`

All 938 tests passing (100%) ✅

## [1.4.3] - 2025-11-07

### Refactored
- **Convert generateNot to s-expression approach** - Following Rip philosophy!
  - Check operand TYPE at s-expression level (not regex on generated code)
  - Handles primitives: `!1`, `!x`, `!true` (clean output without extra parens)
  - Handles property access: `!obj.prop`, `!arr[0]` (clean output)
  - Conservative for complex expressions: `!(a + b)` (keeps parens)
  - Simple, maintainable logic (~26 lines)
  - Follows philosophy from Issues #46 (flattenBinaryChain) and #49 (unwrapComprehensionIIFE)
  - **Work at IR level, not string level!**

All 938 tests passing (100%) ✅

## [1.4.2] - 2025-11-07

### Fixed
- **Critical: Fix 'in' operator with string literals** - Restores self-hosting!
  - JavaScript's `in` operator checks numeric indices on strings, NOT characters
  - `'\n' in "text"` incorrectly returns `false` (should check if newline exists)
  - Fixed `generateIn()` to detect string literal checks and use `.includes()`
  - Pattern: `'x' in variable` → runtime type check with `.includes()` for strings/arrays
  - **This broke parser regeneration since Phase 1!** (`bun run parser` now works ✅)
  - Added 7 tests for string literal `in` operator behavior
  - Critical for bootstrap: solar.rip uses `'\n' in action` pattern

### Changed
- **Massive code cleanup** - Removed 2,042 lines of dead/duplicate code (28%)!
  - Removed ALL 37 Phase 2 duplicate switch cases (1,614 lines) - never cleaned after extraction
  - Removed old* cases (47 lines), error-throwing cases (26 lines), forwarding cases (185 lines)
  - Removed duplicate property cases (149 lines), function cases (185 lines)
  - Eliminated pointless switch wrapper with only default case (4 lines)
  - Extracted duplicate `findPostfixConditional` helper (DRY principle)
  - Added missing assignment operators to dispatch table
  - Centralized number literal regex patterns
  - Result: 7,263 → 5,239 LOC (27.9% reduction!)

### Documentation
- Consolidated AI agent docs into single AGENT.md (removed duplicate rip-agent-onboarding.md)
- Updated all LOC references (5,239 LOC, ~45% smaller than CoffeeScript)
- Cleaned up 8 obsolete planning docs
- Created simple .cursor/rules/rip-quick-start.md pointer

All 938 tests passing (100%) ✅

## [1.4.1] - 2025-11-07

### Changed
- **Dispatch table Phase 2 complete** (#54) - Extracted all remaining 39 cases (100% complete!)
  - Exception handling: `try`, `throw` (2 cases)
  - Switch statements: `switch`, `when` (2 cases)
  - Comprehensions: `comprehension`, `object-comprehension` (2 cases)
  - Classes: `class`, `super`, `?call`, `?super` (4 cases)
  - Modules: `import`, `export`, `export-default`, `export-all`, `export-from` (5 cases)
  - Special forms: `do-iife`, `regex`, `tagged-template`, `str` (4 cases)
  - **All 110 node types now in dispatch table** - Perfect O(1) lookup ✅
  - Codegen organization complete - Easy to navigate and maintain
  - File size: 6,203 → 7,263 LOC (+1,060 lines from extraction)
  - All 931 tests passing (100%) ✅

## [1.4.0] - 2025-11-07

### Changed
- **Major refactoring: Dispatch table architecture** (#52 Phase 1) - Extracted 71/110 cases (65%)
  - Added O(1) dispatch table (was O(n) switch with 110 cases)
  - Extracted 71 generator methods organized by category
  - Shared methods for similar operations (DRY principle)
  - Binary operators: 20+ cases → 1 shared method
  - Assignment operators: 17 cases → 1 shared method
  - All operators, property access, functions, loops, exception handling extracted
  - ~1,500 lines reorganized into categorized methods
  - Clear organization: operators, property access, functions, control flow, etc.
  - Remaining 39 cases documented for Phase 2
- Test count: 926 → 931 (+5 tests from Issue #49)

## [1.3.14] - 2025-11-07

### Changed
- **S-expression comprehension generation** (#49) - Removed string manipulation anti-pattern
  - Replaced `unwrapComprehensionIIFE()` with s-expression-based approach
  - Added `generateComprehensionWithTarget()` for direct array building
  - No more generating IIFE then unwrapping with regex ✅
  - Follows same philosophy as Issue #46 improvements
  - **42 lines removed** (string manipulation eliminated)
  - Safer, faster, cleaner code generation
- Test count: 926 → 931 (+5 tests)
- Added CODEGEN-ANALYSIS.md with optimization roadmap

## [1.3.13] - 2025-11-07

### Fixed
- **Clean logical chains** (#46) - Flatten nested logical operators at s-expression level
  - Transforms deeply nested chains: `if (((!a && !b) && !c) && d)` → `if (!a && !b && !c && d)`
  - Works by flattening s-expression tree BEFORE code generation (Rip philosophy!)
  - Added `flattenBinaryChain()` to recursively flatten same-operator chains
  - Pure chains unwrap completely, mixed precedence stays safe ✅
  - Example: `arr[len - (x || 1)]` preserves inner parens
  - Much cleaner than regex string manipulation (50 lines vs 100+)
- Test count: 922 → 926 (+4 tests)

## [1.3.12] - 2025-11-07

### Changed
- **Cleaner output in delimited contexts** (#44) - Removed redundant outer parens
  - Function args: `fn((expr))` → `fn(expr)`
  - Assignments: `x = (value)` → `x = value`
  - Array indices: `arr[(index)]` → `arr[index]`
  - Applied unwrap() in contexts that already provide delimiters
  - Safety preserved: `arr[len - (x || 1)]` keeps inner parens ✅
  - Object literals still protected
- Test count: 913 → 922 (+9 tests)

## [1.3.11] - 2025-11-07

### Fixed
- **Critical: Safe operator wrapping** - Reverted to conservative wrapping approach
  - Always wrap `&&`, `||`, `??` operators by default (safe precedence)
  - Unwrap only in guaranteed-safe contexts (if/while conditions)
  - Prevents broken JavaScript: `arr[len - (x || 1)]` now preserves parens ✅
  - Mixed precedence now safe: `a - (b || c)` preserves parens ✅

### Changed
- **Improved unwrapLogical()** - Better aggressive unwrapping for conditions
  - `if (!isEmpty && isValid)` still clean in conditions ✅
  - But never breaks precedence in mixed contexts ✅
  - Best of both worlds: safety + readability

## [1.3.10] - 2025-11-06

### Changed
- **Eliminated exponential parentheses** (#42) - Removed paren hell in logical operator chains
  - Stopped wrapping `&&`, `||`, `??` operators (left-associative, safe to chain)
  - `(((!a && !b) && !c) && d)` → `!a && !b && !c && d` (4 layers → 0!)
  - Created `unwrapLogical()` for aggressive unwrapping in conditions
  - Matches CoffeeScript clean output

### Fixed
- **Unary NOT precedence bug** - `!(a && b)` now generates correctly
  - Was: `!a && b` (wrong precedence) ❌
  - Now: `(!(a && b))` (correct precedence) ✅

### Changed
- Test count: 907 → 913 (+6 tests)

## [1.3.9] - 2025-11-06

### Fixed
- **Indentation in for-in loops with index and guard** - Fixed broken indentation
  - For-loops with both index variable and guard clause now indent correctly
  - Root cause: Mixed array building with formatStatements causing double-indent
  - Solution: Direct code building with explicit indent levels (Option 2)
  - Example: `for symbol, i in arr when guard` now has perfect indentation
  - Every statement at correct level (no 0-space or 12-space chaos)

## [1.3.8] - 2025-11-06

### Changed
- **Cleaner conditions** (#40) - Removed excessive double parentheses
  - `if ((x > y))` → `if (x > y)` (single parens)
  - Applied to all conditionals: if, unless, while, until, guards
  - Used existing `unwrap()` helper for consistency
  - Smart negation handling (keeps parens when needed for precedence)
  - More readable, professional output
- Test count: 901 → 907 (+6 tests)

## [1.3.7] - 2025-11-06

### Changed
- **Cleaner arrow function syntax** (#38) - Remove parens around single parameters
  - `(x) => x * 2` → `x => x * 2` (single simple param)
  - Keeps parens for multiple params, destructuring, defaults, rest
  - Matches ESLint/Prettier standards
  - More idiomatic modern JavaScript
- Test count: 893 → 901 (+8 tests)

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
