# NEXUS Grammar Specification

## Overview

**NEXUS** is a unified, executable grammar specification system for the **Solar** compiler toolchain. Unlike traditional parser generators that use text-based configuration files, NEXUS grammars are written as **executable Rip code** that defines the complete language specification—lexing, parsing, precedence, and semantic actions—in a single self-hosting file.

From one NEXUS grammar file, Solar generates:
- **Optimized lexers** (mega-regex leveraging Bun/V8 engines)
- **Efficient parsers** (SLR/LALR/GLR with full precedence control)
- **S-expression ASTs** (arrays with named property access)
- Support for **multiple backends** (Tree-sitter, native parsers, etc.)

---

## Design Philosophy

NEXUS embraces several key principles:

1. **Self-Hosting**: Grammar files are written in the language they define
2. **Executable Code**: Not a text format—real Rip code that executes to build the grammar
3. **Minimal Syntax**: One helper function (`o`) and arrays for structure
4. **Sigil-Based Patterns**: Compact, visual operators (`<>`, `*+?`, `{}`, etc.)
5. **Opinionated Defaults**: One best way to do things, no configuration paralysis
6. **Universal IR**: S-expressions as the AST format for all targets

---

## Complete Compiler Pipeline

```
Source Code (text)
    ↓
┌─────────────────────────────────────┐
│ 1. LEXER (Solar-generated)          │
│    • Mega-regex (Bun/V8 optimized)  │
│    • External scanners (optional)   │
│    • Keyword post-classification    │
└─────────────────────────────────────┘
    ↓
Token[] (mutable array)
    ↓
┌─────────────────────────────────────┐
│ 2. REWRITER (Optional, user code)   │
│    • Inject implicit syntax         │
│    • Transform token stream         │
│    • Mutates array in-place         │
└─────────────────────────────────────┘
    ↓
Token[] (cleaned)
    ↓
┌─────────────────────────────────────┐
│ 3. PARSER (Solar-generated)         │
│    • SLR/LALR/GLR tables            │
│    • Produces S-expression AST      │
│    • Named property access          │
└─────────────────────────────────────┘
    ↓
S-expression AST (arrays with properties)
    ↓
┌─────────────────────────────────────┐
│ 4. OPTIMIZER (Optional, NJVL/user)  │
│    • Transform/optimize AST         │
│    • Constant folding, etc.         │
│    • Mutates sexp in-place          │
└─────────────────────────────────────┘
    ↓
S-expression AST (optimized)
    ↓
┌─────────────────────────────────────┐
│ 5. CODEGEN (User/target-specific)   │
│    • Walk S-expression              │
│    • Emit target code/bytecode      │
│    • JavaScript, WASM, native, etc. │
└─────────────────────────────────────┘
    ↓
Output Code
```

---

## Grammar File Structure

A NEXUS grammar is a `.rip` file with three main sections:

### 1. Directives (Metadata)
### 2. Token Definitions (Lexer)
### 3. Grammar Rules (Parser)

---

## Complete Example

```coffeescript
# rip.nexus (actually rip.rip - executable Rip code!)

# ============================================
# SECTION 1: DIRECTIVES
# ============================================

@target 'solar-slr', 'tree-sitter'
@extras 'spacing', 'lineComment', 'blockComment'
@external 'INDENT', 'DEDENT', 'NEWLINE'

# ============================================
# SECTION 2: TOKEN DEFINITIONS
# ============================================

# Keywords (ALLCAPS = tokens)
IF = 'if'
ELSE = 'else'
WHILE = 'while'
FOR = 'for'
FUNCTION = 'function'
RETURN = 'return'
YIELD = 'yield'
FROM = 'from'

# Operators
PLUS = '+'
MINUS = '-'
STAR = '*'
SLASH = '/'
STARSTAR = '**'
GT = '>'
LT = '<'
GTEQ = '>='
LTEQ = '<='
EQ = '=='
NEQ = '!='

# Punctuation
LPAREN = '('
RPAREN = ')'
LBRACE = '{'
RBRACE = '}'
LBRACKET = '['
RBRACKET = ']'
COMMA = ','
SEMICOLON = ';'
COLON = ':'
DOT = '.'

# Literals (regex patterns)
NUMBER = /[0-9]+(\.[0-9]+)?/
STRING = /"([^"\\]|\\.)*"/
IDENTIFIER = /[a-zA-Z_][a-zA-Z0-9_]*/

# Helper tokens (lowerCamelCase = auto-hidden)
spacing = /[ \t]+/
lineComment = /#[^\n]*/
blockComment = /\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//

# Token aliases (multiple names for same token)
IDENTIFIER aka ClassName, VariableName, FunctionName

# External tokens (provided by custom scanner)
@external 'INDENT', 'DEDENT', 'NEWLINE'

# ============================================
# SECTION 3: GRAMMAR RULES
# ============================================

# Every rule is an array of alternatives
# Each alternative uses the o() helper

Program = [
  o 'Statement*', '["program", ...$1]'
]

Statement = [
  o 'IfStatement'
  o 'WhileLoop'
  o 'ForLoop'
  o 'FunctionDecl'
  o 'ReturnStatement'
  o 'YieldStatement'
  o 'ExprStatement'
]

IfStatement = [
  o 'IF Expr:condition Block:then (ELSE Block:else)? =10',
    '["if", $condition, $then, $else]'
]

WhileLoop = [
  o 'WHILE Expr:condition Block:body =10',
    '["while", $condition, $body]'
]

ForLoop = [
  o 'FOR IDENTIFIER:var IN Expr:iterable Block:body =10',
    '["for", $var, $iterable, $body]'
]

FunctionDecl = [
  o 'FUNCTION IDENTIFIER:name LPAREN Params? RPAREN Block:body',
    '["function", $name, $2, $body]'
]

ReturnStatement = [
  o 'RETURN Expr? SEMICOLON',
    '["return", $2]'
]

YieldStatement = [
  o 'YIELD', '["yield"]'
  o 'YIELD Expr', '["yield", $2]'
  o 'YIELD INDENT Object OUTDENT', '["yield", $3]'
  o 'YIELD FROM Expr', '["yield-from", $3]'
]

ExprStatement = [
  o 'Expr SEMICOLON', '$1'
]

Block = [
  o 'INDENT OUTDENT', '["block"]'
  o 'INDENT Body OUTDENT', '["block", ...$2]'
]

Body = [
  o 'Statement+', '$1'
]

Params = [
  o 'IDENTIFIER{COMMA}', '["params", ...$1]'
]

Expr = [
  # Binary operators with precedence and associativity
  o 'Expr< PLUS Expr>     <10', '["add", $1, $3]'
  o 'Expr< MINUS Expr>    <10', '["sub", $1, $3]'
  o 'Expr< STAR Expr>     <20', '["mul", $1, $3]'
  o 'Expr< SLASH Expr>    <20', '["div", $1, $3]'
  o 'Expr< STARSTAR Expr> >30', '["pow", $1, $3]'
  
  # Comparison operators (non-associative)
  o 'Expr< GT Expr>   |5', '["gt", $1, $3]'
  o 'Expr< LT Expr>   |5', '["lt", $1, $3]'
  o 'Expr< GTEQ Expr> |5', '["gte", $1, $3]'
  o 'Expr< LTEQ Expr> |5', '["lte", $1, $3]'
  o 'Expr< EQ Expr>   |5', '["eq", $1, $3]'
  o 'Expr< NEQ Expr>  |5', '["neq", $1, $3]'
  
  # Unary operators
  o 'MINUS Expr> >40', '["neg", $2]'
  
  # Primary expressions
  o 'CallExpr'
  o 'MemberAccess'
  o 'ArrayLiteral'
  o 'ObjectLiteral'
  o 'NUMBER', '["number", parseInt($1, 10)]'
  o 'STRING', '["string", $1.slice(1, -1)]'
  o 'IDENTIFIER', '["identifier", $1]'
  o 'LPAREN Expr RPAREN', '$2'
]

CallExpr = [
  o 'Expr:callee LPAREN Args? RPAREN',
    '["call", $callee, $3]'
]

MemberAccess = [
  o 'Expr:object DOT IDENTIFIER:property',
    '["member", $object, $property]'
]

ArrayLiteral = [
  o 'LBRACKET Args? RBRACKET',
    '["array", ...$2]'
]

ObjectLiteral = [
  o 'LBRACE Properties? RBRACE',
    '["object", ...$2]'
]

Properties = [
  o 'Property{COMMA+}',
    '$1'
]

Property = [
  o 'IDENTIFIER:key COLON Expr:value',
    '["property", $key, $value]'
]

Args = [
  o 'Expr{COMMA+}',
    '["args", ...$1]'
]
```

---

## Syntax Reference

### Directives

Directives use the `@` prefix and configure the grammar:

```coffeescript
# Target backends to generate
@target 'solar-slr', 'solar-lalr', 'solar-glr', 'tree-sitter'

# Tokens to skip/ignore (whitespace, comments)
@extras 'spacing', 'lineComment', 'blockComment'

# Tokens provided by external scanner
@external 'INDENT', 'DEDENT', 'NEWLINE'
```

---

### Token Definitions

Tokens follow naming conventions:

| **Pattern** | **Type** | **Behavior** |
|-------------|----------|--------------|
| `ALLCAPS` | Token (lexer) | Creates token type, included in output |
| `TitleCase` | Rule (parser) | Grammar rule that produces AST node |
| `lowerCamelCase` | Helper | Auto-hidden, not in AST (for whitespace, etc.) |

**Literal tokens:**
```coffeescript
IF = 'if'              # matches exactly "if"
PLUS = '+'             # matches exactly "+"
```

**Pattern tokens:**
```coffeescript
NUMBER = /[0-9]+/                    # regex pattern
IDENTIFIER = /[a-zA-Z_][a-zA-Z0-9_]*/  # regex pattern
STRING = /"([^"\\]|\\.)*"/           # regex pattern
```

**Helper tokens (auto-hidden):**
```coffeescript
spacing = /[ \t]+/           # whitespace (not in AST)
lineComment = /#[^\n]*/       # comments (not in AST)
```

**Token aliases:**
```coffeescript
IDENTIFIER aka ClassName, VariableName, FunctionName
# Multiple semantic names for same token
```

---

### Grammar Rules

Every rule is an **array** of alternatives, each created with the `o()` helper:

```coffeescript
RuleName = [
  o 'pattern1', 'action1'
  o 'pattern2', 'action2'
  o 'pattern3'  # action defaults to $1
]
```

**The `o()` helper:**
- Takes pattern string and optional action
- Returns `[pattern, action]` pair
- Default action is `$1` (pass through first element)

---

### Pattern Syntax (Inside Pattern Strings)

Patterns use NEXUS sigils for expressive grammar specification:

#### **Sequence**
```coffeescript
o 'IF Expr Block'  # tokens/rules in order
```

#### **Optional** (`?`)
```coffeescript
o 'IF Expr Block (ELSE Block)?'  # optional else
o 'RETURN Expr?'                  # optional expression
```

#### **Repetition** (`*` = 0+, `+` = 1+)
```coffeescript
o 'Statement*'   # zero or more statements
o 'Statement+'   # one or more statements
o 'Digit+'       # one or more digits
```

#### **Grouping** (`()`)
```coffeescript
o '(PLUS | MINUS) Expr'           # group alternatives
o 'IF Expr Block (ELSE Block)?'   # optional group
```

#### **Separated Lists** (`{separator}`)
```coffeescript
o 'IDENTIFIER{COMMA}'      # 1+ comma-separated: a, b, c
o 'Expr{COMMA}?'           # 0+ comma-separated: (empty) or a, b, c
o 'Arg{COMMA+}'            # 1+ with optional trailing: a, b, c,
o 'Param{COMMA+}?'         # 0+ with optional trailing: (empty) or a, b,
```

#### **Field Names** (`:name` or `<` `>`)
```coffeescript
o 'IF Expr:condition Block:then'    # named fields
o 'Expr:left PLUS Expr:right'       # named fields

# Shorthand for left/right:
o 'Expr< PLUS Expr>'                # Expr:left PLUS Expr:right
```

#### **Precedence and Associativity**
```coffeescript
o 'Expr< PLUS Expr>  <10'    # left-assoc, precedence 10
o 'Expr< STAR Expr>  <20'    # left-assoc, precedence 20
o 'Expr< POWER Expr> >30'    # right-assoc, precedence 30
o 'Expr< EQ Expr>    |15'    # non-assoc, precedence 15
o 'MINUS Expr>       =40'    # precedence only (no assoc)
```

**Precedence Sigils:**
- `<N` = Left-associative, precedence N
- `>N` = Right-associative, precedence N
- `|N` = Non-associative, precedence N (no chaining)
- `=N` = Precedence only (no associativity)

**Dynamic Precedence** (runtime resolution):
```coffeescript
o 'Expr< CmpOp Expr> <15!'   # dynamic left-assoc (! = resolve at parse time)
```

#### **Immediate Adjacency** (`~`)
```coffeescript
o '0x ~ /[0-9a-f]+/'         # no whitespace between 0x and digits
```

---

### Action Syntax

Actions define how to build the S-expression AST. They're strings that get transformed:

#### **Rule 1: Omitted → pass through `$1`**
```coffeescript
o 'PrimaryExpr'              # returns $1
```

#### **Rule 2: `null` or `''` → literal**
```coffeescript
o 'VOID Expr', null          # returns null
o 'EMPTY', ''                # returns ""
```

#### **Rule 3: Bare number → token reference**
```coffeescript
o 'LPAREN Expr RPAREN', 2    # returns $2 (the Expr)
```

#### **Rule 4: String without `$` → convert all numbers to `$n`**
```coffeescript
o 'Expr PLUS Expr', '["add", 1, 3]'
# Solar converts to: ["add", $1, $3]
# Returns: ["add", leftExpr, rightExpr]
```

#### **Rule 5: String with `$` → convert only `$n`, protect other numbers**
```coffeescript
o 'NUMBER', '["number", parseInt($1, 10)]'
# Solar converts to: ["number", parseInt($1, 10)]
# The "10" is protected (not converted to $10)

o 'STRING', '["string", $1.slice(1, -1)]'
# The 1 and -1 are protected
```

**The rule:** If you write explicit `$`, only those are converted. Otherwise, all bare numbers become token references.

#### **Named References**
```coffeescript
o 'IF Expr:condition Block:then', '["if", $condition, $then]'
# Solar converts to: ["if", $condition, $then]
```

#### **Spread Operator**
```coffeescript
o 'INDENT Body OUTDENT', '["block", ...$2]'
# Spreads Body's children into the block array
```

---

## Lexer: Mega-Regex Approach

Solar generates a **unified regex** that matches all tokens simultaneously, leveraging Bun's or V8's highly-optimized regex engine.

### How It Works

**1. Token Collection**
```coffeescript
# Your tokens:
IF = 'if'
WHILE = 'while'
NUMBER = /[0-9]+/
IDENTIFIER = /[a-zA-Z_]\w*/
PLUS = '+'
```

**2. Solar Generates Mega-Regex**
```javascript
const TOKEN_REGEX = /(?<IF>if)|(?<WHILE>while)|(?<NUMBER>[0-9]+)|(?<IDENTIFIER>[a-zA-Z_]\w*)|(?<PLUS>\+)/y;
//                   ^^^^^^^^   ^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^   ^^^^^^^^
//                   named capture groups for each token type
```

**3. Lexer Uses Sticky Flag (`y`)**
```javascript
function* lex(input) {
  TOKEN_REGEX.lastIndex = 0;
  
  while (TOKEN_REGEX.lastIndex < input.length) {
    const match = TOKEN_REGEX.exec(input);
    
    if (!match) {
      throw new SyntaxError(`Unexpected character at ${TOKEN_REGEX.lastIndex}`);
    }
    
    // Find which group matched
    const type = TOKEN_TYPES.find(t => match.groups[t]);
    
    // Skip extras (whitespace/comments)
    if (EXTRAS.includes(type)) continue;
    
    yield {
      type,
      value: match[0],
      start: match.index,
      end: TOKEN_REGEX.lastIndex
    };
  }
}
```

**4. Keyword Classification (Post-Match)**
```javascript
// After matching, check if IDENTIFIER is actually a keyword:
const KEYWORDS = { 'if': 'IF', 'while': 'WHILE', 'for': 'FOR' };

if (type === 'IDENTIFIER' && KEYWORDS[value]) {
  type = KEYWORDS[value];
}
```

### Why This Works

✅ **Leverages native optimization** - Bun/V8's regex engine is highly optimized
✅ **Longest match** - Greedy quantifiers ensure longest token match
✅ **Order matters** - First alternative wins on ties (put keywords before identifiers)
✅ **Single pass** - One scan through the input
✅ **Fast** - JIT-compiled regex execution

### Whitespace Handling

**Ignorable whitespace** (most languages):
```coffeescript
@extras 'spacing', 'lineComment'

spacing = /[ \t]+/
lineComment = /#[^\n]*/

# These tokens are matched but filtered out before parser
```

**Significant whitespace** (Python, Rip, CoffeeScript):
```coffeescript
# Explicit whitespace tokens
SP1 = ' '              # one space (MUMPS)
SP2 = '  '+            # two or more spaces (MUMPS)
NEWLINE = /\r?\n/      # explicit newlines

# External scanner for complex indentation
@external 'INDENT', 'DEDENT'
```

### External Scanners

For complex lexing that regex can't handle:

```coffeescript
@external 'INDENT', 'DEDENT', 'NEWLINE'

# Lexer interleaves mega-regex with external scanner:
function* lex(input) {
  let pos = 0;
  
  while (pos < input.length) {
    // Try external scanner first
    const extToken = externalScanner.scan(input, pos);
    if (extToken) {
      yield extToken;
      pos = extToken.end;
      continue;
    }
    
    // Then try mega-regex
    TOKEN_REGEX.lastIndex = pos;
    const match = TOKEN_REGEX.exec(input);
    // ...
  }
}
```

**Use cases for external scanners:**
- Indentation tracking (Python-style)
- String interpolation (context switching)
- Here-docs with variable delimiters
- Complex state-dependent lexing

---

## Rewriter: Optional Token Stream Transformation

For languages with implicit syntax (CoffeeScript, Ruby, Python), a **rewriter** transforms the token stream between lexing and parsing.

### The Contract

```javascript
// Input: Token[] (mutable array)
// Output: Token[] (same array, modified in-place)

function rewrite(tokens) {
  // Modify tokens array:
  // - Insert synthetic tokens
  // - Delete tokens
  // - Change token types
  
  return tokens;  // return the modified array
}
```

### Example: Implicit Parentheses

```javascript
// rip-rewriter.js

export function rewrite(tokens) {
  injectImplicitParentheses(tokens);
  handleIndentation(tokens);
  return tokens;
}

function injectImplicitParentheses(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    if (isImplicitCall(tokens, i)) {
      // Insert LPAREN after function name
      tokens.splice(i + 1, 0, {
        type: 'LPAREN',
        value: '(',
        synthetic: true,
        start: tokens[i].end,
        end: tokens[i].end
      });
      
      // Find end of arguments, insert RPAREN
      const closePos = findArgumentEnd(tokens, i + 2);
      tokens.splice(closePos, 0, {
        type: 'RPAREN',
        value: ')',
        synthetic: true,
        start: tokens[closePos - 1].end,
        end: tokens[closePos - 1].end
      });
      
      i = closePos; // skip past inserted tokens
    }
  }
}

function isImplicitCall(tokens, i) {
  const token = tokens[i];
  const next = tokens[i + 1];
  
  return token.type === 'IDENTIFIER' 
    && next 
    && next.type !== 'LPAREN'
    && canBeArgument(next);
}
```

### Pipeline Integration

```javascript
// Full pipeline:
const tokens = Array.from(lex(source));      // lexer generator → array
rewrite(tokens);                             // rewriter modifies in-place
const ast = parse(tokens);                   // parser consumes array
```

### When to Use

✅ **CoffeeScript/Rip** - implicit parentheses, implicit braces
✅ **Python** - INDENT/DEDENT injection (if not using external scanner)
✅ **Ruby** - block syntax transformations
✅ **Sass** - nested block handling

❌ **JavaScript/C/Java** - no rewriter needed
❌ **Most languages** - rewriter is optional

---

## Parser: S-expression Generation

Solar generates LR parser tables (SLR/LALR/GLR) from the grammar. The parser produces **S-expression ASTs** - arrays with optional named properties.

### S-expression Structure

Every node is a JavaScript array:

```javascript
// Basic structure:
['type', child1, child2, child3, ...]

// Example:
['if',
  ['>', ['identifier', 'x'], ['number', 0]],
  ['block', ['call', ['identifier', 'foo'], []]]
]
```

### Named Property Access

S-expressions are **normal arrays** with **named properties attached**:

```javascript
const sexp = ['if', condition, thenBlock, elseBlock];

// Attach named properties (Solar does this automatically)
sexp.condition = condition;  // same as sexp[1]
sexp.then = thenBlock;       // same as sexp[2]
sexp.else = elseBlock;       // same as sexp[3]

// Access by position (array):
console.log(sexp[0]);        // 'if'
console.log(sexp[1]);        // condition

// Or by name (property):
console.log(sexp.condition); // condition (same reference as sexp[1])
console.log(sexp.then);      // thenBlock (same reference as sexp[2])

// It's just a normal array:
Array.isArray(sexp);         // true
sexp.length;                 // 4
```

### Metadata Properties

You can attach any metadata as properties:

```javascript
// Location data (Solar adds automatically):
sexp.line = 42;
sexp.col = 10;
sexp.start = 150;
sexp.end = 200;
sexp.source = 'example.rip';

// Additional metadata:
sexp.indentLevel = 2;
sexp.synthetic = false;      // generated by rewriter?
sexp.comments = [...];       // attached comments
sexp.inferredType = 'number'; // from type checker

// Array stays clean when serialized:
JSON.stringify(sexp);
// ["if",[">",[...],[...]],[...]]
```

### Parser Action Generation

From your grammar:
```coffeescript
IfStatement = [
  o 'IF Expr:condition Block:then (ELSE Block:else)?',
    '["if", $condition, $then, $else]'
]
```

Solar generates:
```javascript
function reduce_IfStatement() {
  // Extract values by position
  const condition = $$2;  // Expr
  const thenBlock = $$3;  // Block  
  const elseBlock = $$5;  // optional ELSE Block
  
  // Build sexp
  const sexp = ['if', condition, thenBlock, elseBlock];
  
  // Attach named properties
  sexp.condition = condition;
  sexp.then = thenBlock;
  sexp.else = elseBlock;
  
  // Attach location data
  sexp.start = @1.start;
  sexp.end = @5.end;
  sexp.line = @1.line;
  
  return sexp;
}
```

---

## Optimizer: Optional AST Transformation

An optional optimization pass can transform the S-expression AST:

```javascript
// optimizer.js

export function optimize(sexp) {
  // Constant folding
  if (sexp[0] === 'add' && 
      sexp[1][0] === 'number' && 
      sexp[2][0] === 'number') {
    return ['number', sexp[1][1] + sexp[2][1]];
  }
  
  // Dead code elimination
  if (sexp[0] === 'if' && sexp.condition[0] === 'number') {
    return sexp.condition[1] !== 0 ? sexp.then : sexp.else;
  }
  
  // Recurse into children
  for (let i = 1; i < sexp.length; i++) {
    if (Array.isArray(sexp[i])) {
      sexp[i] = optimize(sexp[i]);
    }
  }
  
  return sexp;
}
```

### Integration

```javascript
const ast = parse(tokens);
optimize(ast);  // mutates AST in-place
const code = codegen(ast);
```

---

## Codegen: Target Code Generation

The final stage walks the S-expression AST and emits target code:

```javascript
// codegen-js.js

export function codegen(sexp, indent = 0) {
  const [type, ...rest] = sexp;
  const ind = '  '.repeat(indent);
  
  switch (type) {
    case 'program':
      return rest.map(stmt => codegen(stmt, indent)).join('\n');
    
    case 'if':
      // Use named properties for clarity
      const cond = codegen(sexp.condition);
      const then = codegen(sexp.then, indent);
      const els = sexp.else ? ` else ${codegen(sexp.else, indent)}` : '';
      return `${ind}if (${cond}) ${then}${els}`;
    
    case 'while':
      return `${ind}while (${codegen(sexp.condition)}) ${codegen(sexp.body, indent)}`;
    
    case 'block':
      const stmts = rest.map(s => codegen(s, indent + 1)).join('\n');
      return `{\n${stmts}\n${ind}}`;
    
    case 'add':
      return `${codegen(sexp[1])} + ${codegen(sexp[2])}`;
    
    case 'call':
      const args = sexp[2].slice(1).map(codegen).join(', ');
      return `${codegen(sexp.callee)}(${args})`;
    
    case 'number':
      return String(sexp[1]);
    
    case 'string':
      return `"${sexp[1]}"`;
    
    case 'identifier':
      return sexp[1];
    
    default:
      throw new Error(`Unknown node type: ${type}`);
  }
}
```

### Multiple Targets

Different codegens for different targets:

```javascript
import { codegen as codegenJS } from './codegen-js.js';
import { codegen as codegenPy } from './codegen-python.js';
import { codegen as codegenWASM } from './codegen-wasm.js';

// Same AST, different outputs:
const js = codegenJS(ast);
const py = codegenPy(ast);
const wasm = codegenWASM(ast);
```

---

## Complete Usage Example

### 1. Define Grammar (rip.rip)

```coffeescript
@target 'solar-slr'
@extras 'spacing'

IF = 'if'
PLUS = '+'
NUMBER = /[0-9]+/
IDENTIFIER = /[a-zA-Z_]\w*/

spacing = /[ \t]+/

Program = [o 'Expr', '$1']

Expr = [
  o 'Expr< PLUS Expr> <10', '["add", 1, 3]'
  o 'NUMBER', '["number", parseInt($1, 10)]'
  o 'IDENTIFIER', '["identifier", $1]'
]
```

### 2. Generate Compiler

```bash
$ solar compile rip.rip

Generated:
  ✓ rip-lexer.js
  ✓ rip-parser.js
```

### 3. Use Compiler

```javascript
// compiler.js
import { lex } from './generated/rip-lexer.js';
import { parse } from './generated/rip-parser.js';
import { codegen } from './codegen-js.js';

export function compile(source) {
  // 1. Lex
  const tokens = Array.from(lex(source));
  
  // 2. Parse
  const ast = parse(tokens);
  
  // 3. Codegen
  return codegen(ast);
}

// Usage:
const output = compile('x + 42');
console.log(output);  // "x + 42"
```

---

## API Reference

### The `o` Helper

```coffeescript
o(pattern, action?) → [pattern, action]
```

Creates a grammar rule alternative.

**Parameters:**
- `pattern` (string): Pattern string with NEXUS syntax
- `action` (optional): Action to build sexp (defaults to `$1`)

**Returns:** Array `[pattern, action]`

**Examples:**
```coffeescript
o 'Expr PLUS Expr', '["add", 1, 3]'
o 'NUMBER', '["number", $1]'
o 'LPAREN Expr RPAREN', 2
o 'Statement'  # defaults to $1
```

### Directives

```coffeescript
@target 'solar-slr', 'solar-lalr', 'tree-sitter'
@extras 'tokenName1', 'tokenName2'
@external 'TOKEN1', 'TOKEN2'
```

**@target**: Specifies which backends to generate
**@extras**: Tokens to skip (whitespace, comments)
**@external**: Tokens provided by external scanner

### Token Definitions

```coffeescript
TOKENNAME = 'literal'     # Exact string match
TOKENNAME = /regex/       # Regex pattern
tokenName = /regex/       # Helper (auto-hidden)

TOKENNAME aka Alias1, Alias2  # Multiple names
```

### Grammar Rules

```coffeescript
RuleName = [
  o 'pattern1', 'action1'
  o 'pattern2', 'action2'
  o 'pattern3'
]
```

Every rule is an array of alternatives using the `o` helper.

---

## Implementation Guide

### Solar's Processing Steps

**1. Execute the .rip grammar file**
- The file is executable Rip code
- Directives (`@target`, etc.) call functions that build metadata
- Token assignments (`IF = 'if'`) register tokens
- Rule assignments (`Expr = [...]`) register grammar rules

**2. Extract grammar data**
- Collect all tokens and their patterns
- Collect all rules and their alternatives
- Extract metadata (targets, extras, external tokens)

**3. Generate lexer**
- Combine all token patterns into mega-regex
- Generate keyword classification map
- Generate lexer function with `yield` for tokens
- Handle external scanner integration

**4. Generate parser**
- Build LR(0) items from grammar rules
- Construct SLR/LALR/GLR automaton
- Generate parse tables (ACTION/GOTO)
- Generate reduction actions that build sexps with properties

**5. Output generated code**
- `grammar-lexer.js` - Tokenizer
- `grammar-parser.js` - Parser with tables

### Lexer Generation

```javascript
// Solar generates:
const TOKEN_REGEX = /(?<IF>if)|(?<PLUS>\+)|(?<NUMBER>[0-9]+)|(?<IDENTIFIER>[a-zA-Z_]\w*)/y;
const TOKEN_TYPES = ['IF', 'PLUS', 'NUMBER', 'IDENTIFIER'];
const KEYWORDS = { 'if': 'IF', 'while': 'WHILE' };
const EXTRAS = ['spacing', 'lineComment'];

export function* lex(input) {
  TOKEN_REGEX.lastIndex = 0;
  
  while (TOKEN_REGEX.lastIndex < input.length) {
    const match = TOKEN_REGEX.exec(input);
    if (!match) throw new SyntaxError(`Unexpected character at ${TOKEN_REGEX.lastIndex}`);
    
    let type = TOKEN_TYPES.find(t => match.groups[t]);
    const value = match[0];
    
    // Keyword classification
    if (type === 'IDENTIFIER' && KEYWORDS[value]) {
      type = KEYWORDS[value];
    }
    
    // Skip extras
    if (EXTRAS.includes(type)) continue;
    
    yield { type, value, start: match.index, end: TOKEN_REGEX.lastIndex };
  }
}
```

### Parser Generation

Solar generates a table-driven LR parser:

```javascript
// ACTION table (what to do in each state)
const ACTION = {
  0: { 'NUMBER': ['shift', 3], 'IDENTIFIER': ['shift', 4] },
  1: { 'PLUS': ['shift', 5], '$': ['accept'] },
  // ...
};

// GOTO table (next state after reduction)
const GOTO = {
  0: { 'Expr': 1 },
  // ...
};

// Reduction actions (build sexps)
const REDUCTIONS = {
  'Expr → Expr PLUS Expr': (stack) => {
    const right = stack.pop();
    stack.pop(); // PLUS
    const left = stack.pop();
    
    const sexp = ['add', left, right];
    sexp.left = left;
    sexp.right = right;
    // ... location data
    
    return sexp;
  },
  // ...
};

export function parse(tokens) {
  const stack = [0];  // state stack
  let i = 0;
  
  while (true) {
    const state = stack[stack.length - 1];
    const token = tokens[i];
    const action = ACTION[state][token.type];
    
    if (action[0] === 'shift') {
      stack.push(token, action[1]);
      i++;
    } else if (action[0] === 'reduce') {
      const reduction = action[1];
      const sexp = REDUCTIONS[reduction](stack);
      const gotoState = GOTO[stack[stack.length - 1]][sexp[0]];
      stack.push(sexp, gotoState);
    } else if (action[0] === 'accept') {
      return stack[1]; // the AST root
    }
  }
}
```

---

## Best Practices

### 1. Grammar Organization

```coffeescript
# Group related rules together:

# ===== EXPRESSIONS =====
Expr = [...]
CallExpr = [...]
MemberExpr = [...]

# ===== STATEMENTS =====
Statement = [...]
IfStatement = [...]
WhileLoop = [...]

# ===== DECLARATIONS =====
FunctionDecl = [...]
ClassDecl = [...]
```

### 2. Precedence Levels

Use consistent precedence levels:

```coffeescript
# 1-5: Logical operators
o 'Expr< OR Expr>  <1'
o 'Expr< AND Expr> <2'

# 5-10: Comparison
o 'Expr< EQ Expr>  |5'
o 'Expr< LT Expr>  |5'

# 10-20: Additive
o 'Expr< PLUS Expr>  <10'
o 'Expr< MINUS Expr> <10'

# 20-30: Multiplicative
o 'Expr< STAR Expr>  <20'
o 'Expr< SLASH Expr> <20'

# 30+: Unary/power
o 'Expr< POWER Expr> >30'
o 'MINUS Expr>       >40'
```

### 3. Action Simplicity

Keep actions simple:

```coffeescript
# Good: Simple construction
o 'Expr PLUS Expr', '["add", 1, 3]'

# Good: Simple transformation
o 'STRING', '["string", $1.slice(1, -1)]'

# Avoid: Complex logic in actions
# Instead, do complex transformations in optimizer or codegen
```

### 4. Named Fields for Clarity

Use named fields for complex patterns:

```coffeescript
# Good: Named fields
o 'IF Expr:condition Block:then (ELSE Block:else)?',
  '["if", $condition, $then, $else]'

# Less clear: Positional only
o 'IF Expr Block (ELSE Block)?',
  '["if", $2, $3, $5]'
```

### 5. Rewriter Guidelines

- Keep rewriter focused on syntax transformations only
- Don't do semantic analysis in the rewriter
- Document what transformations are applied
- Make transformations idempotent when possible

---

## Advanced Topics

### Dynamic Precedence

For context-sensitive precedence resolution:

```coffeescript
o 'Expr< CmpOp Expr> <15!', '["compare", 1, 2, 3]'
#                        ^
#                        dynamic (resolved at parse time)
```

Use when static precedence isn't sufficient.

### Tree-sitter Target

Solar can also generate Tree-sitter grammars:

```bash
$ solar compile rip.rip --target tree-sitter

Generated:
  ✓ grammar.js (Tree-sitter format)
```

The same NEXUS syntax maps to Tree-sitter's combinators:
- `*` → `repeat()`
- `+` → `repeat1()`
- `?` → `optional()`
- `{S}` → `seq($.X, repeat(seq(S, $.X)))`

### GLR Parsing

For ambiguous grammars, use GLR mode:

```coffeescript
@target 'solar-glr'
```

GLR forks the parser on ambiguities and explores multiple parse paths.

---

## Comparison with Other Systems

### vs. Jison/Bison

**Jison:**
```javascript
%left '+'
%%
expr: expr '+' expr { $$ = ['+', $1, $3]; }
    | NUMBER        { $$ = ['number', $1]; }
```

**NEXUS:**
```coffeescript
Expr = [
  o 'Expr< PLUS Expr> <10', '["add", 1, 3]'
  o 'NUMBER', '["number", $1]'
]
```

✅ Cleaner syntax (no `%%`, `$$`)
✅ Sigil-based (visual)
✅ Executable code (not text format)

### vs. Tree-sitter

**Tree-sitter:**
```javascript
expr: $ => choice(
  prec.left(10, seq($.expr, '+', $.expr)),
  $.NUMBER
)
```

**NEXUS:**
```coffeescript
Expr = [
  o 'Expr< PLUS Expr> <10', '["add", 1, 3]'
  o 'NUMBER', '["number", $1]'
]
```

✅ More compact
✅ Actions built-in (Tree-sitter doesn't have actions)
✅ Multiple targets from one grammar

### vs. ANTLR

**ANTLR:**
```antlr
expr: expr '+' expr  # add
    | NUMBER         # number
    ;
```

**NEXUS:**
```coffeescript
Expr = [
  o 'Expr PLUS Expr', '["add", 1, 3]'
  o 'NUMBER', '["number", $1]'
]
```

✅ Actions directly in grammar (not separate visitor)
✅ S-expression output (simpler than parse trees)
✅ Self-hosting

---

## Conclusion

NEXUS provides a unified, executable grammar specification system that:

- **Generates optimized lexers** leveraging Bun/V8 regex engines
- **Produces efficient parsers** (SLR/LALR/GLR) with full precedence control
- **Outputs clean S-expressions** (arrays with named property access)
- **Supports multiple targets** (Tree-sitter, native parsers, etc.)
- **Enables self-hosting** (grammar written in the language it defines)
- **Uses minimal, elegant syntax** (one helper, sigil-based patterns)

The complete pipeline—lexer → rewriter → parser → optimizer → codegen—provides a clean separation of concerns while maintaining efficiency and simplicity.

**NEXUS is how modern language tools should be built: executable, unified, and beautiful.** ✨
