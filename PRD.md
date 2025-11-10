# Requirements for Predictive Recursive Descent Parser

## Overview
Create a new PRD (Predictive Recursive Descent) mode in Solar that generates fast, table-free parsers by compiling SLR(1) disambiguation logic directly into code at generation time.

## Core Requirements

### 1. Command-Line Flag
Create new PRD mode in solar.rip with flag: `-r` or `--recursive-descent` that generates a predictive recursive descent parser instead of table-driven SLR(1).

### 2. Grammar Compatibility
Use existing `grammar.rip` unmodified - same grammar rules, same actions. No LL(1) conversion required.

### 3. Symbol Constants
Generate parser with integer symbol constants (`SYM_IDENTIFIER`, `SYM_EXPRESSION`, etc.) instead of string-based lookups for fast dispatch.

### 4. Direct Parsing Functions
Generate clean, hand-written-style recursive descent functions (`parseExpression()`, `parseAssignable()`, etc.) when SLR(1) ACTION table has only one possible action for all lookahead tokens in that state (unambiguous cases).

### 5. SLR(1) Table Access for Disambiguation ⚠️ CRITICAL
**At code generation time** (when creating parser.js), consult Solar's SLR(1) data structures to resolve conflicts and generate correct dispatch code.

**Available data structures in Generator class:**
- `@types` - Map of nonterminals, each Type has:
  - `@firsts` - Set of tokens that can begin this type
  - `@follows` - Set of tokens that can follow this type
  - `@rules` - Array of Rule objects
- `@rules` - Array of all Rule objects, each has:
  - `@firsts` - Set of tokens that can begin this rule
  - `@symbols` - Array of symbols in the rule
- `@parseTable` - Array of state objects (ACTION/GOTO table)
  - `parseTable[stateNum][tokenId]` → action `[SHIFT, nextState]` or `[REDUCE, ruleId]`
- `@states` - Array of State objects from LR automaton
  - Each state has `@transitions` Map (symbol → nextStateId)
  - Each state has `@reductions` Set of reduction items
- `@symbolIds` - Map of symbol names to integer IDs
- `@tokenNames` - Map of token IDs to names (for error messages)

**How to use:** When generating parsing function for a nonterminal, check `@parseTable` and `@types[symbol].firsts/.follows` to determine what lookahead checks are needed.

### 6. No Runtime Tables
No parse tables in generated `parser.js` - all disambiguation must be baked into the generated code structure (switch statements, if/else conditionals). Small data structures ARE allowed:
- Operator precedence arrays (if needed)
- Symbol name strings for error messages
- Token ID to name mapping for debugging

### 7. Existing Infrastructure
Use existing `lexer.js`, `codegen.js`, `compiler.js` unchanged - only `parser.js` generation changes. The parser must work with the existing compilation pipeline.

### 8. Grammar Actions
Process existing grammar actions that produce s-expressions using this system:

**Action Processing Rules:**
- **Default (empty/undefined):** Returns token 1 (first matched symbol)
- **Literal values:** `""` or `null` pass through unchanged
- **Bare numbers:** `1`, `3`, etc. reference token positions (1-indexed)
- **String actions:** Numbers in strings auto-convert to token positions
- **Protected literals:** Use `$n` syntax (`$1`, `$3`) for tokens; allows bare numbers to stay literal

**Examples:**
```javascript
['Token1 Token2 Token3']                    => Token1
['Token1 Token2 Token3', 'null']            => 'null'
['Token1 Token2 Token3', 3]                 => Token3
['Token1 Token2 Token3', '2']               => Token2
['Token1 Token2 Token3', '[1, 3, 2]']       => [Token1, Token3, Token2]
['Token1 Token2 Token3', '[$3.slice(3,7), $2, 12]'] => [Token3.slice(3,7), Token2, 12]
```

### 9. Heredoc Margin Control
Use Rip's heredoc margin control for clean codegen - position closing `'''` or `"""` at desired column to set baseline indentation automatically.

**Examples:**
```coffeescript
# This source...
code = '''
    foo(bar) {
      console.log(bar);
    }
'''

# Produces this JS...
code = `    foo(bar) {
      console.log(bar);
    }`;

# And this...
code = '''
    foo(bar) {
      console.log(bar);
    }
  '''

# Produces this...
code = `  foo(bar) {
    console.log(bar);
  }`;
```

### 10. Switch/Case Formatting
Format generated parser with compact switch/case dispatch: stack case labels horizontally (until ~100 chars), then action on same or next line.

**Example:**
```javascript
case SYM_IF: case SYM_UNLESS: case SYM_SWITCH: return this.parseConditional();
case SYM_FOR: case SYM_WHILE: return this.parseLoop();
case SYM_IDENTIFIER:
  if (this._peek() === SYM_CALL_START) return this.parseInvocation();
  return this.parseValue();
```

### 11. Bootstrap Strategy
Can bootstrap with system-wide `rip` command if `parser.js` breaks during development. This allows recovery from self-hosting issues.

### 12. Success Criteria
**962/962 tests passing (100%)** - `bun run test` must pass completely. No regression in functionality.

### 13. Strategy (DO NOT Convert to LL(1))
Generate direct parsing functions that use switch statements on lookahead token. When multiple productions are possible for a symbol, generate conditional logic (if/else or nested switch) that uses SLR(1) table data to determine correct production. **Never convert grammar to LL(1)** - trust SLR(1) tables to resolve conflicts.

### 14. Safety Valve
**Pause if things get complex or unclear** - don't forge ahead blindly. Ask for clarification if:
- The SLR(1) table structure is unclear
- Action compilation strategy is ambiguous  
- Left recursion handling needs explanation
- Any requirement seems contradictory

## Additional Requirements

### 15. API Compatibility
Generated parser should have same public API as current parser:
- `parser.parse(source)` returns s-expression AST
- `parser.lexer` property for token source
- Same error format/behavior

### 16. Operator Precedence
Preserve existing operator precedence handling. Current PRD has precedence climbing for operators - keep this approach or improve it, don't regress.

### 17. Generated Code Comments
Add comments in generated code explaining disambiguation logic to aid debugging:

```javascript
// SLR(1) tables indicate IDENTIFIER followed by CALL_START is invocation
if (this._peek() === SYM_CALL_START) {
  return this.parseInvocation();
}
```

This will help with maintenance and debugging.

## Implementation Notes

### Error Handling
Generate error messages with expected tokens from SLR(1) tables:

```javascript
default: this._error([SYM_IF, SYM_FOR, SYM_WHILE], this.la.id);
```

Where the array contains token IDs of expected symbols at that point.

### Left Recursion (Already Solved)
Solar already converts left-recursive rules to iterative while loops. The SLR(1) FOLLOW sets provide the loop termination condition:

```javascript
parseBody() {
  const items = [this.parseLine()];  // First item
  
  while (this.la.id === SYM_TERMINATOR) {  // ← Iteration, not recursion!
    this._match(SYM_TERMINATOR);
    
    // Check FOLLOW set (this is the table guidance!)
    if (this.la.id === SYM_END || this.la.id === SYM_OUTDENT) break;
    
    items.push(this.parseLine());
  }
  
  return items;
}
```

### Entry Point
Top-level parse function should be `parse()` that calls `parseProgram()` or similar starting nonterminal.

## Philosophy

**The key insight:** SLR(1) tables are a precomputed solution to all parsing decisions.

- **Table-driven parser:** Interprets the solution at runtime (slow, 24K lines)
- **Table-guided PRD:** Compiles the solution to code at generation time (fast, ~2K lines)

We use SLR(1)'s computational power at *generation time* to create optimized code with no runtime overhead.
