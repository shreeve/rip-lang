# GitHub Workflow Quick Reference

**For AI Agents & Developers**

This is the standard workflow used in this project. See `../CONTRIBUTING.md` for detailed walkthrough with real examples.

---

## The 10-Step Workflow

```bash
# 1. Find/identify bug or feature need
echo 'failing code' | ./bin/rip -s  # Debug with -s, -t, -c flags

# 2. Create GitHub issue
gh issue create --title "..." --label "bug" --body "..."

# 3. Create feature branch
git checkout -b fix/issue-name

# 4. Write failing tests FIRST
# Edit test/rip/RELEVANT_FILE.rip
bun test/runner.js test/rip/RELEVANT_FILE.rip  # Verify they fail

# 5. Implement the fix
# - Grammar change? Edit src/grammar/grammar.rip then: bun run parser
# - Codegen change? Edit src/codegen.js
# - Solar change? Edit src/grammar/solar.rip then: bun run parser

# 6. Verify tests pass
bun run test  # All tests must pass

# 7. Build browser bundle (if code changes)
bun run browser  # Updates web REPL

# 8. Update documentation
# - README.md (if user-facing change)
# - docs/CODEGEN.md (if new node types)
# - Test count updates

# 9. Commit with issue reference
git add <files>
git commit -m "Fix: Description

Fixes #N  ← This auto-closes the issue when PR merges!

- Bullet points of changes
- Test results

All tests passing: X/Y (100%)"

# 10. Push, create PR, merge
git push origin fix/issue-name
gh pr create --title "..." --base main --body "Fixes #N ..."
gh pr merge <number> --squash --delete-branch
```

---

## Critical Details

### Issue References

**Always include in commit message:**
```
Fixes #N
```

This **auto-closes the issue** when the PR is merged! 🪄

### Test Count Updates

When tests change, update in **README.md**:
- Badge: `tests-X%2FY-brightgreen.svg`
- Multiple locations (search for old count)

### Files That Are Generated (Don't Edit Directly)

- ❌ `src/parser.js` - Regenerate with `bun run parser`
- ⚠️ `src/lexer.js` - Only edit Rewriter section
- ❌ `src/grammar/solar.rip` - Given (don't modify)

**If you need to change parser behavior:**
- Edit `src/grammar/solar.rip` for runtime behavior (parseError, etc.)
- Edit `src/grammar/grammar.rip` for grammar rules
- Then: `bun run parser`

---

## When to Use Workflow vs Direct Commit

### Use Full Workflow When:
- 🐛 **Bug fixes** - Track issue → resolution
- ✨ **New features** - Document design decisions
- 🔧 **Breaking changes** - Need review/discussion
- 📚 **Complex changes** - Multiple files/systems

### Direct Commit to Main When:
- 📝 **Documentation only** - No code changes
- 🧪 **Test additions** - Documenting existing behavior
- 🎨 **Formatting/style** - Trivial changes
- 🔖 **Version bumps** - Routine maintenance

**When in doubt, use the workflow!** It creates a paper trail.

---

## Quick Commands

```bash
# Check auth
gh auth status

# List issues
gh issue list

# View issue
gh issue view <number>

# List PRs
gh pr list

# View PR
gh pr view <number>

# Check branch
git branch --show-current

# Check what's changed
git status
git diff

# Run specific tests
bun test/runner.js test/rip/FILE.rip

# Debug flags
./bin/rip -t code.rip  # Tokens
./bin/rip -s code.rip  # S-expressions
./bin/rip -c code.rip  # JavaScript
```

---

## Example Session

**Real example from Issue #1 → PR #2:**

```bash
# Found: Postfix comprehensions with 'by' step fail to parse
echo '(x for x in [0...10] by 2)' | ./bin/rip -s  # Parse error!

# Created issue
gh issue create --title "Postfix comprehensions with 'by' step fail to parse" ...
# → Issue #1

# Created branch
git checkout -b fix/postfix-comprehension-by-step

# Added 3 failing tests
# Edited test/rip/comprehensions.rip

# Fixed grammar + codegen
# Edited src/grammar/grammar.rip (added 3 rules)
bun run parser
# Edited src/codegen.js (handle step parameter)

# Verified fix
bun run test  # 846/846 passing (+3)

# Updated README
# Changed 843 → 846

# Committed
git add README.md src/codegen.js src/grammar/grammar.rip src/parser.js test/rip/comprehensions.rip
git commit -m "Fix: Add support for postfix comprehensions with 'by' step

Fixes #1
...
All tests passing: 846/846 (100%)"

# Created PR
git push origin fix/postfix-comprehension-by-step
gh pr create --title "..." --body "Fixes #1 ..."
# → PR #2

# Merged
gh pr merge 2 --squash --delete-branch
# → Issue #1 automatically closed! ✅
```

**Total time:** ~15 minutes for complete workflow

---

## Common Pitfalls

### ❌ Forget to reference issue
```
git commit -m "Fix bug"  # ← Issue won't auto-close!
```

### ✅ Always reference
```
git commit -m "Fix: Description

Fixes #N  ← This is the magic!
..."
```

### ❌ Edit generated files
```
vim src/parser.js  # ← Changes lost on next bun run parser!
```

### ✅ Edit source files
```
vim src/grammar/grammar.rip
bun run parser  # Regenerates parser.js
```

### ❌ Skip tests
```
# Make fix, commit immediately  # ← Might break things!
```

### ✅ Always test
```
bun run test  # MUST pass before committing
```

---

## Workflow Variants

### Variant A: Combined PR (Multiple Issues)

When fixes are related:
```
Fixes #7, Fixes #9

Two enhancements in one PR...
```

Both issues auto-close when PR merges.

### Variant B: Stacked PRs

For dependent changes:
```bash
# PR #1: Foundation
git checkout -b feat/foundation
# ... work ...
gh pr create

# PR #2: Building on PR #1
git checkout -b feat/extension
# ... work ...
gh pr create --base feat/foundation  # ← Base on other branch!
```

---

## Pro Tips

1. **Small, focused PRs** - Easier to review and merge
2. **Test-driven** - Write failing tests first
3. **Commit messages** - Clear, descriptive, reference issues
4. **Browser bundle** - Always rebuild before committing code changes
5. **Clean git history** - Use `--squash` merge to keep main clean

---

## For AI Agents

**When resuming work on an issue:**

1. **Read the issue** - `gh issue view <number>`
2. **Check if branch exists** - `git branch -a | grep issue-name`
3. **Read ISSUE-N.md** if it exists (handoff docs)
4. **Review related docs** - ../AGENT.md, COMPREHENSIONS.md, etc.
5. **Check test status** - `bun run test`
6. **Follow the 10 steps above**

**When stuck:**
- Check `../CONTRIBUTING.md` for full examples
- Review closed PRs for patterns
- Use debug flags: `-t`, `-s`, `-c`
- Read tests for expected behavior

---

## Success Metrics

**Today's session (2025-10-31):**
- ✅ 5 complete workflows executed
- ✅ 2 direct commits (documentation)
- ✅ 11 tests added (843 → 854)
- ✅ 100% test pass rate maintained
- ✅ All issues auto-closed via `Fixes #N`
- ✅ bar.coffee now compiles (was broken)

**This workflow works!** 🎉

---

See `../CONTRIBUTING.md` for detailed walkthrough with real examples from Issue #1/PR #2.
