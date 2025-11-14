# Table-Oracle Quick Start Guide

## Installation

```bash
cd /Users/shreeve/Data/Code/rip-lang

# Create new branch
git checkout -b table-oracle

# Copy the modified solar.rip
cp /path/to/solar.rip src/grammar/solar.rip

# Commit the base implementation
git add src/grammar/solar.rip
git commit -m "Add table-oracle PRD generation

- Simulate SLR(1) parse table to extract routing decisions
- Generate predictive recursive descent parsers
- ~325 lines of clean extraction/generation code
- No inference, no heuristics - pure oracle extraction"
```

## Testing

### Step 1: Regenerate Parser with PRD

```bash
# Regenerate parser with -r flag
cd src/grammar
bun ../../node_modules/.bin/bun run solar.rip -r -o ../parser.js grammar.rip

# Or if you've set up package.json with -r:
cd ../..
bun run parser
```

### Step 2: Test Simple Cases

```bash
# Test literals
echo '42' | ./bin/rip -s
# Expected: (program 42)

# Test identifiers
echo 'x' | ./bin/rip -s
# Expected: (program x)

# Test assignment
echo 'x = 42' | ./bin/rip -s
# Expected: (program (= x 42))

# Test arrays
echo '[1,2,3]' | ./bin/rip -s
# Expected: (program (array 1 2 3))
```

### Step 3: Run Test Suite

```bash
# Run all 962 tests
bun run test

# Expected first pass: 50-70% (basic cases)
# After iteration: 90-100%
```

## Debugging

### Check Routing Extraction

The extraction process prints diagnostic info:

```
🔮 Extracting PRD routing via table simulation...
  ✓ Expression: 45 tokens
  ✓ Value: 23 tokens
  ✓ Assignable: 12 tokens
  ...
✅ Extracted routing for 46 nonterminals

🏗️  Generating PRD parser...
```

If a nonterminal shows 0 tokens, check:
- Does it have rules?
- Can `_findStartState` locate it?
- Does simulation complete?

### Compare Outputs

```bash
# Table-driven (proven correct)
rip -s test.rip

# PRD (should match)
./bin/rip -s test.rip

# Diff them
diff <(rip -s test.rip) <(./bin/rip -s test.rip)
```

### Check Generated Code

```bash
# Look at generated parser
head -200 src/parser.js

# Check if routing was extracted
grep "parseExpression()" src/parser.js -A 20
```

## Common Issues & Fixes

### Issue 1: "Parser for X not yet implemented"

**Cause:** Nonterminal has no routing extracted

**Fix:** Check if `_findStartState` can locate it
```coffee
# In solar.rip, add debug:
_findStartState: (nonterminal) ->
  console.log "Finding start state for #{nonterminal}"
  # ... existing code
```

### Issue 2: Infinite loop during generation

**Cause:** Simulation doesn't terminate

**Fix:** Check visited set and maxSteps limit
```coffee
# Already implemented safety:
maxSteps = 100
visited = new Set
```

### Issue 3: Parse error on valid input

**Cause:** Routing extracted wrong alternative

**Debug:**
```coffee
# Add logging to simulation:
_simulateTableForToken: (startState, nonterminal, tokenId) ->
  console.log "Simulating #{nonterminal} + token #{tokenId}"
  # ... trace each step
```

### Issue 4: Missing tokens in switch

**Cause:** Token not in routing map

**Check:**
```javascript
// Generated code should have:
switch (this.la?.id) {
  case 40:  // IDENTIFIER
  case 44:  // NUMBER
  // ... all tokens from extraction
}
```

## Iteration Strategy

### Phase 1: Terminals Only (Day 1)
- Get literals working (NUMBER, STRING, BOOL)
- Get identifiers working (IDENTIFIER)
- Basic dispatch should work

### Phase 2: Simple Nonterminals (Day 1-2)
- Single-symbol passthroughs
- Multi-symbol rules (assignment, property access)
- Array/object literals

### Phase 3: Complex Cases (Day 2-3)
- Operators with precedence
- Control flow (if, for, while)
- Function definitions

### Phase 4: Edge Cases (Day 3-4)
- Left-recursion (iterative loops)
- Ambiguous cases (try/catch)
- Error recovery

## Success Criteria

### Minimum Viable (50-60% tests)
- ✅ Literals parse correctly
- ✅ Identifiers parse correctly
- ✅ Simple assignments work
- ✅ Arrays and objects work

### Production Ready (90-95% tests)
- ✅ All expressions parse
- ✅ All statements parse
- ✅ Control flow works
- ✅ Functions work

### Perfect (100% tests)
- ✅ All 962 tests pass
- ✅ Self-hosting works
- ✅ Performance verified
- ✅ Code is clean

## Performance Expectations

The table-oracle approach should be:
- **Faster than table-driven** (no table lookup, direct calls)
- **Expected:** 10-30x speedup
- **Trade-off:** Larger code size (5-10x)

Measure with:
```bash
# Benchmark parsing 1000 times
time for i in {1..1000}; do echo 'x = 42' | ./bin/rip -s > /dev/null; done
```

## Next Steps After Working

1. **Document the approach** - Write paper/blog post
2. **Optimize generated code** - Inline common cases
3. **Add more features** - Error recovery, better diagnostics
4. **Publish** - Share with compiler community

## Files Modified

- `src/grammar/solar.rip` - Added ~325 lines PRD code
- `src/parser.js` - Will be regenerated with PRD version
- `package.json` - May need to add `-r` flag to parser script

## Backup Strategy

Keep table-driven version available:
```bash
# Generate table version
bun run solar.rip -o parser-table.js grammar.rip

# Generate PRD version
bun run solar.rip -r -o parser-prd.js grammar.rip

# Switch between them in package.json
```

---

## Bottom Line

**You now have:** Complete table-oracle implementation (325 lines)

**Ready to:** Regenerate parser and test

**Expected:** 50-70% tests pass initially, 90-100% after iteration

**Time to 100%:** 2-4 days of focused work

**This is the foundation.** The hard part (table simulation) is done! 🎯
