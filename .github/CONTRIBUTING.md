# Contributing to Rip

Thanks for your interest in contributing to Rip! This guide will help you get started.

## Quick Start

1. **Clone and setup:**
   ```bash
   git clone https://github.com/shreeve/rip-lang.git
   cd rip-lang
   bun link  # Make Rip available globally
   ```

2. **Verify setup:**
   ```bash
   bun run test  # Should show 846/846 passing
   ```

## Development Workflow

### Making Changes

1. **Identify what needs changing:**
   - **Codegen only?** Edit `src/codegen.js`
   - **Grammar change?** Edit `src/grammar/grammar.rip` then run `bun run parser`
   - **Lexer rewriter?** Edit `src/lexer.js` (⚠️ only modify the Rewriter section)

2. **Debug your changes:**
   ```bash
   echo 'your code' | ./bin/rip -t  # See tokens (lexer output)
   echo 'your code' | ./bin/rip -s  # See s-expressions (parser output)
   echo 'your code' | ./bin/rip -c  # See JavaScript (codegen output)
   ```

3. **Add tests:**
   - Find the appropriate file in `test/rip/`
   - Add test cases using `test "name", "code", expectedResult`
   - Run: `bun test/runner.js test/rip/YOUR_FILE.rip`

4. **Run all tests:**
   ```bash
   bun run test  # Must pass all tests
   ```

5. **Update documentation:**
   - Update `docs/CODEGEN.md` if adding/changing node types
   - Update `README.md` if user-facing change
   - Update `AGENT.md` if relevant for AI/developers

### Example: Adding a Feature

```bash
# 1. Check what parser emits
echo 'new syntax' | ./bin/rip -s

# 2. If grammar change needed:
#    Edit src/grammar/grammar.rip
bun run parser

# 3. Add case to src/codegen.js
#    case 'new-pattern': { ... }

# 4. Write tests
#    Edit test/rip/RELEVANT_FILE.rip

# 5. Run tests
bun run test

# 6. Document in docs/CODEGEN.md
```

### Example: Fixing a Bug

```bash
# 1. Debug the issue
echo 'failing code' | ./bin/rip -s  # What does parser emit?

# 2. Find the case in src/codegen.js
grep -A 20 "case 'pattern':" src/codegen.js

# 3. Fix the generation logic

# 4. Add regression test
#    Edit test/rip/RELEVANT_FILE.rip

# 5. Verify fix
bun test/runner.js test/rip/RELEVANT_FILE.rip
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
bun --no-cache test/runner.js test/rip    # Clear cache
```

## Code Style

- Use existing patterns as examples
- Keep it simple - s-expressions over complex AST
- Add comments for non-obvious logic
- Test edge cases

## Submitting Changes

1. Create a branch: `git checkout -b fix-feature-name`
2. Make your changes
3. Ensure all tests pass: `bun run test`
4. Commit with clear message: `git commit -m "Fix: description (X/Y tests)"`
5. Push: `git push origin fix-feature-name`
6. Open a Pull Request on GitHub

## Important Notes

### Zero Dependencies

Rip has **zero dependencies** - this is intentional and must be maintained. Don't add any npm packages without discussion.

### Self-Hosting

Rip compiles itself. After grammar changes:
```bash
bun run parser  # Regenerates src/parser.js from grammar
```

### ES2022 Target

Rip outputs modern JavaScript (ES2022). Don't downgrade to older syntax.

### Don't Edit Generated Files

- ❌ `src/parser.js` - Regenerate with `bun run parser`
- ❌ `src/grammar/solar.rip` - Given (parser generator)
- ⚠️ `src/lexer.js` - Only modify Rewriter section

## Key Concepts

### S-Expressions

Rip uses simple arrays as IR:
```javascript
["=", "x", 42]           // Assignment
["+", left, right]       // Binary operation
["def", "fn", params, body]  // Function
```

### Context-Aware Generation

Pass `context` parameter: `'statement'` or `'value'`
```javascript
generate(sexpr, context = 'statement')
```

### Block Unwrapping

Parser wraps statements in blocks everywhere:
```javascript
if (Array.isArray(body) && body[0] === 'block') {
  const statements = body.slice(1);  // Unwrap!
}
```

## Getting Help

- Read [AGENT.md](../AGENT.md) for AI assistant guide
- Check [docs/](../docs/) for detailed documentation
- Open a [Question issue](https://github.com/shreeve/rip-lang/issues/new/choose)
- Look at existing tests in `test/rip/` for examples

## Questions?

Open an issue or start a discussion. We're happy to help!

---

**Philosophy:** Keep it simple. Keep it tested. Keep it elegant. ✨

