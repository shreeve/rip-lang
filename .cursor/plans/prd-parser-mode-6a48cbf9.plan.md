<!-- 6a48cbf9-64fe-456a-b9c0-c0f0f5cc41e7 51271b09-aa03-4d41-834d-fc60901b6330 -->
# PRD Parser: Table-Guided Recursive Descent

## Core Insight

**SLR(1) tables = oracle at generation time, not runtime.** Consult tables during codegen to answer "what should I do here?" and compile that into direct code.

## Phase 1: Foundation

### Add PRD Flag

- Modify `src/grammar/solar.rip` to accept `-r` OR `--recursive-descent` (either works)
- Branch in `generate()`: `if @options.recursiveDescent then @_generatePRD() else @_generateTableDriven()`
- Keep table mode for comparison

### Symbol Constants

Generate from `@symbolIds`:

```javascript
// Terminals
const SYM_IDENTIFIER = 40, SYM_NUMBER = 44, SYM_STRING = 46;
// Keywords  
const SYM_IF = 172, SYM_FOR = 114, SYM_WHILE = 156;
// Operators
const SYM_ASSIGN = 68, SYM_PLUS = 182, SYM_MINUS = 181;
const TOKEN_NAMES = {40: "IDENTIFIER", 44: "NUMBER", ...};
```

### Parser Shell with Buffered Lookahead

```javascript
const parser = {
  parse(input) {
    this.lexer.setInput(input);
    this.peekToken = null;
    this.la = this._advance();
    return this.parseRoot();
  },
  
  _match(expected) {
    if (this.la.id !== expected) this._error([expected], this.la.id);
    const tok = this.la;  // COMPLETE token
    this.la = this._advance();
    return tok;
  },
  
  _peek() {
    if (!this.peekToken) this.peekToken = this.lexer.lex();
    return this.peekToken.id;
  },
  
  _advance() {
    const tok = this.peekToken || this.lexer.lex();
    this.peekToken = null;
    return tok;
  },
  
  _error(expected, got) { /* format with TOKEN_NAMES */ }
};
```

## Phase 2: Prove Pattern (ONE Nonterminal!)

### Implement parseIdentifier Only

```javascript
parseIdentifier() {
  const tok = this._match(SYM_IDENTIFIER);
  return tok;  // Complete token with metadata!
}
```

### Test First Function

- Generate: `bun src/grammar/solar.rip -r -o parser-test.js src/grammar/grammar.rip`
- Test: `echo 'x' | ./bin/rip -s`
- Verify matches table mode
- **Pattern validated → proceed**

## Phase 3: Action Compilation

### Token Metadata (CRITICAL!)

⚠️ **Return COMPLETE tokens, never `.value`!**

Lexer String objects have:

- `.quote` - heredoc quote type
- `.await` - dammit `!` operator
- `.heregex` - extended regex

Codegen depends on these properties!

### Action Examples

```javascript
// Rule: Identifier → IDENTIFIER (default action)
parseIdentifier() {
  return this._match(SYM_IDENTIFIER);  // Complete token
}

// Rule: Property → PROPERTY
parseProperty() {
  return this._match(SYM_PROPERTY);
}

// Rule: Assign → Assignable = Expression
// Action: '["=", 1, 3]'
parseAssign() {
  const tok1 = this.parseAssignable();
  this._match(SYM_ASSIGN);  // Position 2 discarded
  const tok3 = this.parseExpression();
  return ["=", tok1, tok3];
}

// Rule: Def → DEF Identifier CALL_START ParamList CALL_END Block
// Action: '["def", 2, 4, 6]'
parseDef() {
  this._match(SYM_DEF);              // Pos 1 - not in action
  const tok2 = this.parseIdentifier(); // Pos 2 - in action
  this._match(SYM_CALL_START);       // Pos 3 - not in action
  const tok4 = this.parseParamList(); // Pos 4 - in action
  this._match(SYM_CALL_END);         // Pos 5 - not in action
  const tok6 = this.parseBlock();     // Pos 6 - in action
  return ["def", tok2, tok4, tok6];
}

// Rule: Block → INDENT Body OUTDENT
// Action: '["block", ...2]'
parseBlock() {
  this._match(SYM_INDENT);
  const tok2 = this.parseBody();
  this._match(SYM_OUTDENT);
  return ["block", ...tok2];  // Spread
}
```

## Phase 4: Dispatch via Oracle

### For Each Nonterminal

1. Get `@types[name].rules`
2. Consult `rule.firsts` from SLR(1)
3. Generate dispatch

**Disjoint FIRST (clean switch):**

```javascript
parseLiteral() {
  switch (this.la.id) {
    case SYM_NUMBER: return this.parseNumber();
    case SYM_STRING: return this.parseString();
    case SYM_NULL: case SYM_UNDEFINED: return this._match(this.la.id);
  }
}
```

**Overlapping FIRST (add lookahead):**

```javascript
parseExpression() {
  switch (this.la.id) {
    case SYM_IDENTIFIER:
      // Oracle: FIRST overlap detected
      if (this._peek() === SYM_ASSIGN) return this.parseAssign();
      if (this._peek() === SYM_CALL_START) return this.parseInvocation();
      return this.parseValue();
    case SYM_IF: return this.parseIf();
    case SYM_FOR: return this.parseFor();
  }
}
```

### Left Recursion Detection

When `rule.symbols[0] === rule.type` → generate while loop using FOLLOW set:

```javascript
// Body → Body TERMINATOR Line
parseBody() {
  const items = [this.parseLine()];
  while (this.la.id === SYM_TERMINATOR) {
    this._match(SYM_TERMINATOR);
    // Oracle FOLLOW(Body) = {OUTDENT, EOF}
    if (this.la.id === SYM_OUTDENT || this.la.id === SYM_EOF) break;
    items.push(this.parseLine());
  }
  return items;
}
```

## Phase 5: Operators

Generate precedence tables + climbing:

```javascript
const PREC = {[SYM_PLUS]: 11, [SYM_TIMES]: 12, [SYM_POWER]: 14, ...};
const ASSOC = {[SYM_PLUS]: 'left', [SYM_POWER]: 'right', ...};

parseOperation(minPrec = 0) { /* precedence climbing */ }
```

## Phase 6: Expand Incrementally

Groups: Terminals → Collections → Assignments → Lists → Control Flow → Complex → Top-level

Test after each group.

## Phase 7: SHOW STRUCTURE (Before Full Tests!)

Generate complete parser, show me:

1. Simple function (parseIdentifier)
2. Switch dispatch (parseLiteral)
3. Ambiguous FIRST (parseExpression)
4. Left recursion (parseBody)
5. Operators (parseOperation)
6. File size

**Wait for my approval.**

## Phase 8: Testing

- Diff table vs PRD (must be identical s-expressions)
- Full suite: `bun run test` → 962/962
- Performance validation

## Bootstrap Safety

Backup parser, use global `rip` if needed

## Success Criteria

- ✓ 962/962 tests
- ✓ 80% smaller (40-60KB vs 294KB)
- ✓ 2-10x faster
- ✓ Token metadata preserved
- ✓ Clean generated code

### To-dos

- [ ] Add --recursive-descent flag to solar.rip, create branch in generate() method
- [ ] Create _generatePRD() and helper methods in Generator class
- [ ] Generate SYM_* constants from @symbolIds map
- [ ] Generate parser object shell with lexer integration, _match(), _peek(), _error()
- [ ] Implement one simple nonterminal (Identifier) to prove concept end-to-end
- [ ] Implement FIRST-set-based switch dispatch for nonterminals
- [ ] Process grammar actions (position refs, spreads, protected literals) into JS
- [ ] Detect left-recursive rules, generate while loops with FOLLOW-based termination
- [ ] Generate precedence table and climbing algorithm for binary operators
- [ ] Generate parse functions for all 86 nonterminals
- [ ] Run full test suite, achieve 962/962 tests passing
- [ ] Add comments, clean formatting, verify code quality