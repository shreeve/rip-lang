# Debug Notes - PRD Generator

## Current Status: 471/962 (49.0%)

### Quick Tests

```bash
# Objects work!
echo '{}'               | ./bin/rip -s  # ✅
echo '{a}'              | ./bin/rip -s  # ✅
echo '{a: 1}'           | ./bin/rip -s  # ✅
echo '{a: 1, b: 2}'     | ./bin/rip -s  # ✅

# Arrows fail
echo '-> 5'             | ./bin/rip -s  # ❌ Expected ::
echo '(x) -> x'         | ./bin/rip -s  # ❌ Expected .

# Operators work
echo '1 + 2'            | ./bin/rip -s  # ✅
echo 'x = 42'           | ./bin/rip -s  # ✅
```

### Known Bugs

**1. Duplicate Case Labels (Lines 449-454 in parser.js)**
- parseValue() case includes PARAM_START/THIN_ARROW/FAT_ARROW
- parseCode() case also includes same tokens
- Second case unreachable (JavaScript picks first match)
- **Causes:** Arrow functions without params fail

**2. Overlap Detection Scope**
- Works within single function (Value, Expression separately)
- Doesn't detect cross-case overlaps in final switch
- **Fix:** Final overlap pass after all cases generated

### Regenerate Command

```bash
cd /Users/shreeve/Data/Code
rip rip-lang/src/grammar/solar.rip -r -o rip-lang/src/parser.js rip-lang/src/grammar/grammar.rip
```

### Test

```bash
cd /Users/shreeve/Data/Code/rip-lang
bun run test
```

### Debug Flags in solar.rip

Currently enabled:
- Line 1623: "📝 Adding base case..."
- Line 1642: "🔄 Deduplication..."
- Line 1664: "🔗 Merging..." / "✨ New group..."
- Line 1704: "Case X: Y ops - ..."
- Line 1713: "✨ Overlapping triggers..."

To disable: Comment out console.log lines.

### Key Insight

**The backtracking approach works!** Objects, AssignObj, Import, Export, Class all use try/catch and parse correctly.

The remaining issue is architectural - need to detect overlaps in the FINAL switch, not just during case generation.

---

**Next AI:** The fix for duplicate case labels is straightforward - run overlap detection on the final baseCases array before generating the switch. See HANDOFF.md line 288 for details.
