# Contributing to Rip

Thanks for your interest in contributing to Rip! This guide shows the complete workflow with a real example.

## Complete GitHub Workflow (Real Example)

This is the actual workflow we used to fix [Issue #1](https://github.com/shreeve/rip-lang/issues/1):

### 1. ✅ Found a Bug

While migrating a CoffeeScript file, discovered that postfix comprehensions with `by` step fail to parse:

```coffeescript
# ❌ Parse error
result = (x for x in [0...10] by 2)
```

**Diagnosis:**
```bash
echo '(x for x in [0...10] by 2)' | ./bin/rip -s
# Compilation Error: (parser fails)
```

### 2. ✅ Filed GitHub Issue

Created [Issue #1](https://github.com/shreeve/rip-lang/issues/1) using GitHub CLI:

```bash
gh issue create \
  --title "Postfix comprehensions with 'by' step fail to parse" \
  --label "bug" \
  --body "Description with code examples..."
```

**Issue included:**
- Clear description of the problem
- Failing code examples
- Expected vs actual behavior
- Root cause analysis
- Real-world example from migration

### 3. ✅ Wrote Failing Tests

Added tests to `test/rip/comprehensions.rip`:

```coffeescript
test "comprehension by 2", "(x for x in [0...10] by 2)", [0, 2, 4, 6, 8]
test "comprehension by 3", "(x * 2 for x in [0...12] by 3)", [0, 6, 12, 18]
test "comprehension by step with guard", "(x for x in [0...20] by 2 when x > 5)", [6, 8, 10, 12, 14, 16, 18]
```

**Verified they fail:**
```bash
bun test/runner.js test/rip/comprehensions.rip
# ✗ 3 failing (as expected)
```

### 4. ✅ Fixed the Problem

**a) Updated grammar** (`src/grammar/grammar.rip`):
```coffeescript
# Added 3 new production rules
o 'Expression FOR ForVariables FORIN Expression BY Expression'                , '["comprehension", 1, [["for-in", 3, 5, 7]], []]'
o 'Expression FOR ForVariables FORIN Expression WHEN Expression BY Expression', '["comprehension", 1, [["for-in", 3, 5, 9]], [7]]'
o 'Expression FOR ForVariables FORIN Expression BY Expression WHEN Expression', '["comprehension", 1, [["for-in", 3, 5, 7]], [9]]'
```

**b) Regenerated parser:**
```bash
bun run parser  # Rebuilds src/parser.js from grammar
```

**c) Updated codegen** (`src/codegen.js`):
- Fixed comprehension value context (IIFE generation)
- Fixed comprehension statement context (plain loop)
- Fixed regular for-in loops with step

**d) Updated README.md** - Test count: 843 → 846

### 5. ✅ Verified Tests Pass

```bash
bun test/runner.js test/rip/comprehensions.rip
# ✓ 22 passing (including 3 new tests)

bun run test
# ✓ 846 passing, ✗ 0 failing
```

**Generated code verification:**
```bash
echo '(x for x in [0...10] by 2)' | ./bin/rip -c
# Output: for (let x = 0; x < 10; x += 2) { ... }
```

### 6. ✅ Created Feature Branch

```bash
git checkout -b fix/postfix-comprehension-by-step
```

### 7. ✅ Committed Changes

```bash
git add README.md src/codegen.js src/grammar/grammar.rip src/parser.js test/rip/comprehensions.rip

git commit -m "Fix: Add support for postfix comprehensions with 'by' step

Fixes #1

- Added 3 grammar rules for postfix comprehensions with by step
- Updated codegen to handle step parameter in comprehensions
- Fixed regular for-in loops to use step increment
- Added 3 tests for by step in comprehensions
- Updated test count: 843 → 846

All tests passing: 846/846 (100%)"
```

**Important:** The commit message includes `Fixes #1` to auto-close the issue when merged.

### 8. ✅ Pushed & Created Pull Request

```bash
# Push branch
git push origin fix/postfix-comprehension-by-step

# Create PR
gh pr create \
  --title "Fix: Add support for postfix comprehensions with 'by' step" \
  --base main \
  --body "Detailed PR description with Fixes #1 reference..."
```

**PR #2 created:** https://github.com/shreeve/rip-lang/pull/2

### 9. ✅ Reviewed & Merged

```bash
# Review the PR (check changes, tests, etc.)
gh pr view 2

# Merge using squash merge
gh pr merge 2 --squash --delete-branch
```

### 10. ✅ Issue Auto-Closed

Because the PR included `Fixes #1`, GitHub automatically closed Issue #1 when PR #2 merged! ✨

```bash
gh issue view 1
# state: CLOSED
```

---

## Quick Reference

### Development Commands

```bash
# Debug tools
./bin/rip -t code.rip  # Tokens (lexer)
./bin/rip -s code.rip  # S-expressions (parser)
./bin/rip -c code.rip  # JavaScript (codegen)

# Build & test
bun run parser         # Rebuild parser from grammar
bun run test           # Run all 846 tests
bun run browser        # Build browser bundle
bun run serve          # Dev server (localhost:3000)
```

### Git Workflow

```bash
# Start work
git checkout -b fix/issue-name
# Make changes...
git add <files>
git commit -m "Fix: description\n\nFixes #N"
git push origin fix/issue-name

# Create PR
gh pr create --title "..." --base main

# Merge (as maintainer)
gh pr merge <number> --squash --delete-branch
```

### Issue Management

```bash
# Create issue
gh issue create --title "..." --label "bug"

# View issue
gh issue view <number>

# Close issue (usually auto-closed by PR)
gh issue close <number>
```

## Project Structure

```
src/
├── lexer.js         # CoffeeScript 2.7 lexer (⚠️ rewriter only)
├── parser.js        # Generated parser (❌ don't edit directly)
├── codegen.js       # Code generator (✅ main work here)
├── compiler.js      # Pipeline orchestration
├── repl.js          # Terminal REPL
├── browser.js       # Browser integration
└── grammar/
    ├── grammar.rip  # Grammar specification (⚠️ expert only)
    └── solar.rip    # Parser generator (❌ given)

test/rip/            # 20 test files, 846 tests
docs/                # Comprehensive documentation
```

## Testing

**Test Types:**
```coffeescript
# Execute and compare result
test "name", "x = 42; x", 42

# Compare generated JavaScript
code "name", "x + y", "(x + y)"

# Expect compilation failure
fail "name", "invalid syntax"
```

**Running Tests:**
```bash
bun run test                              # All tests
bun test/runner.js test/rip/functions.rip # Specific file
bun --no-cache test/runner.js test/rip    # Clear Bun cache
```

## Key Concepts

### S-Expressions

Rip uses simple arrays as intermediate representation:
```javascript
["=", "x", 42]                  // Assignment
["+", left, right]              // Binary operation
["def", "fn", params, body]     // Function
["comprehension", expr, iterators, guards]  // Comprehension
```

### Context-Aware Generation

Pass `context` parameter to determine output:
```javascript
generate(sexpr, context = 'statement')
// context: 'statement' | 'value'
```

Example - Comprehensions:
- **Value context** (result used) → IIFE with array building
- **Statement context** (result discarded) → Plain loop

### Block Unwrapping

Parser wraps statements in blocks everywhere:
```javascript
if (Array.isArray(body) && body[0] === 'block') {
  const statements = body.slice(1);  // Always unwrap!
}
```

## Important Rules

### Zero Dependencies

Rip has **zero runtime or build dependencies** - this is intentional and must be maintained. Don't add npm packages.

### Self-Hosting

Rip compiles itself. After grammar changes:
```bash
bun run parser  # Regenerates src/parser.js
```

### ES2022 Target

Output modern JavaScript (ES2022). Don't downgrade syntax.

### Don't Edit Generated Files

- ❌ `src/parser.js` - Regenerate with `bun run parser`
- ❌ `src/grammar/solar.rip` - Given (parser generator)
- ⚠️ `src/lexer.js` - Only modify Rewriter section

## Commit Message Format

```
Fix: Short description (50 chars or less)

Fixes #N

- Bullet points describing changes
- What was modified and why
- Test results

All tests passing: X/Y (100%)
```

**Important:** Include `Fixes #N` to auto-close issues when PR merges.

## Getting Help

- Read [AGENT.md](AGENT.md) for AI assistant guide
- Check [docs/](docs/) for detailed documentation  
- Open a [Question issue](https://github.com/shreeve/rip-lang/issues/new/choose)
- Look at existing tests in `test/rip/` for examples
- Review closed PRs for workflow examples

## Questions?

Open an issue or discussion. We're happy to help!

---

**Philosophy:** Keep it simple. Keep it tested. Keep it elegant. ✨

