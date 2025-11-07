# Rip Language - Quick Reference

**👋 For the complete AI agent guide, see: `AGENT.md` in the project root**

---

## Super Quick Start

### Essential Commands
```bash
# Debug pipeline
echo 'code' | ./bin/rip -t  # Tokens
echo 'code' | ./bin/rip -s  # S-expressions
echo 'code' | ./bin/rip -c  # JavaScript

# Test
bun run test                           # All 931 tests
bun test/runner.js test/rip/FILE.rip   # Specific

# After grammar changes
bun run parser
```

### Current Status (v1.4.2)
- ✅ All 110 node types in dispatch table
- ✅ 938/938 tests passing (100%)
- ✅ 5,239 LOC (clean architecture - 28% reduction!)
- ✅ Self-hosting fully operational ✅

### File Guide
- `src/codegen.js` - **YOU'LL WORK HERE** (lines 32-141: dispatch table)
- `src/parser.js` - ❌ Generated (don't edit)
- `test/rip/*.rip` - Add tests here

### Workflow
1. Create branch: `git checkout -b fix/name`
2. Write failing tests
3. Fix in `src/codegen.js` (check dispatch table first!)
4. Test: `bun run test`
5. Commit with `Fixes #N`

---

**📖 For complete guide with examples, workflows, and patterns:**

**→ Read `AGENT.md` in the project root ←**
