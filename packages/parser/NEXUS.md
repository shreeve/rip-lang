# NEXUS: Universal Grammar Specification System

> **⚠️ Status:** This document describes the planned architecture for NEXUS and LAGER (the lexer generator). These systems are not yet implemented - this is a design specification and roadmap for future development. The concepts are based on proven technologies (Ragel, RE2, Solar) and real-world experience with the Rip compiler.

---

## Overview

**NEXUS** is a unified, executable grammar specification system for the **Solar** compiler toolchain. Unlike traditional parser generators that use text-based configuration files, NEXUS grammars are written as **executable Rip code** that defines the complete language specification—lexing, parsing, precedence, and semantic actions—in a single self-hosting file.

From one NEXUS grammar file, Solar generates:
- **Optimized lexers** via **LAGER** (DFA-based Zig/WASM with 5-10x speedup)
- **Efficient parsers** (SLR/LALR/GLR with full precedence control)
- **S-expression ASTs** (arrays with named property access)
- Support for **multiple backends** (native parsers, Tree-sitter, etc.)

---

## Design Philosophy

NEXUS embraces several key principles:

1. **Self-Hosting**: Grammar files are written in the language they define
2. **Executable Code**: Not a text format—real Rip code that executes to build the grammar
3. **Minimal Syntax**: One helper function (`o`) and arrays for structure
4. **Sigil-Based Patterns**: Compact, visual operators (`<>`, `*+?`, `{}`, etc.)
5. **Opinionated Defaults**: One best way to do things, no configuration paralysis
6. **Universal IR**: S-expressions as the AST format for all targets
7. **Performance First**: WASM lexers, optimized parsers, zero overhead

---

## Complete Compiler Pipeline

```
Source Code (text)
    ↓
┌─────────────────────────────────────┐
│ 1. LEXER (LAGER-generated WASM)     │
│    • DFA with early exits            │
│    • Context-sensitive modes         │
│    • Stack for INDENT/DEDENT         │
│    • Embedded Zig actions            │
│    • 5-10x faster than JavaScript    │
└─────────────────────────────────────┘
    ↓
Token[] (mutable array)
    ↓
┌─────────────────────────────────────┐
│ 2. REWRITER (Optional, user code)   │
│    • Complex token transformations   │
│    • Implicit syntax injection       │
│    • Mutates array in-place          │
└─────────────────────────────────────┘
    ↓
Token[] (cleaned)
    ↓
┌─────────────────────────────────────┐
│ 3. PARSER (Solar-generated)         │
│    • SLR/LALR/GLR tables             │
│    • Produces S-expression AST       │
│    • Named property access           │
└─────────────────────────────────────┘
    ↓
S-expression AST (arrays with properties)
    ↓
┌─────────────────────────────────────┐
│ 4. OPTIMIZER (Optional)              │
│    • Transform/optimize AST          │
│    • Constant folding, etc.          │
│    • Mutates sexp in-place           │
└─────────────────────────────────────┘
    ↓
S-expression AST (optimized)
    ↓
┌─────────────────────────────────────┐
│ 5. CODEGEN (User/target-specific)   │
│    • Walk S-expression               │
│    • Emit target code/bytecode       │
│    • JavaScript, WASM, native, etc.  │
└─────────────────────────────────────┘
    ↓
Output Code
```

---

## LAGER: The Lexer Generator

**LAGER** (Lexer Automaton GEneRator) is NEXUS's lexer generator - a Ragel-inspired DFA compiler that generates optimized Zig code compiling to WebAssembly.

### Why LAGER?

**Traditional mega-regex approach:**
```javascript
/(?<IF>if)|(?<WHILE>while)|(?<NUMBER>[0-9]+)|(?<IDENTIFIER>[a-zA-Z_]\w*)/y
```

**Problem:** Must try ALL alternatives even when one matches early.

**LAGER's solution:** Unified DFA with early exit:

```zig
state = switch (state) {
    0 => switch (c) {
        'i' => 1,        // Might be 'if'
        'w' => 5,        // Might be 'while'
        '0'...'9' => 10, // Number
        else => break,
    },
    2 => switch (c) {
        'a'...'z' => 15, // 'ifa...' - identifier
        else => return TOKEN_IF,  // ← Early exit! Got 'if'
    },
};
```

**Performance:** 5-10x faster than pure JavaScript lexers

---

## Grammar File Structure

A NEXUS grammar is a `.rip` file with multiple sections:

### 1. Directives (Metadata)
### 2. State Variables (for lexer)
### 3. Standard Library Imports
### 4. Token Definitions (Lexer)
### 5. Grammar Rules (Parser)

---

## Complete Example

```coffeescript
# rip.nexus - Complete language specification

# ============================================
# SECTION 1: DIRECTIVES
# ============================================

@target 'lager-wasm', 'solar-slr'

# ============================================
# SECTION 2: STATE VARIABLES (for LAGER)
# ============================================

@state ```zig
// Custom state variables
var mode: u32 = MODE_NORMAL;
var paren_depth: u32 = 0;
```

# ============================================
# SECTION 3: STANDARD LIBRARY
# ============================================

@use 'indent' { tab_width: 2 }    # Python/Rip/CoffeeScript indentation
@use 'brackets'                    # Bracket matching
@use 'interpolation'               # String interpolation tracking

# ============================================
# SECTION 4: TOKEN DEFINITIONS
# ============================================

# Keywords (ALLCAPS = tokens)
IF = 'if'
ELSE = 'else'
WHILE = 'while'
FOR = 'for'
DEF = 'def'

# Operators
PLUS = '+'
MINUS = '-'
STAR = '*'
SLASH = '/'
POWER = '**'

# Punctuation with standard actions
LPAREN = '(' @action brackets.push('(')
RPAREN = ')' @action brackets.pop(')')
LBRACKET = '[' @action brackets.push('[')
RBRACKET = ']' @action brackets.pop(']')

# Complex tokens with custom actions
NEWLINE = '\n' @action ```zig
    // Custom: Skip newlines inside brackets (implicit line joining)
    if (brackets.depth() == 0) {
        indent.handle_newline(input, &pos, len, tokens, &token_count, .{});
    } else {
        pos += 1;  // Skip newline inside brackets
    }
```

STRING = '"' @action ```zig
    const start = pos;
    pos += 1;

    while (pos < len) {
        const c = input[pos];

        if (c == '"') {
            tokens[token_count] = Token{
                .type = TOKEN_STRING,
                .start = @intCast(u32, start),
                .end = @intCast(u32, pos + 1),
            };
            token_count += 1;
            pos += 1;
            break;
        }

        // Check for interpolation
        if (interpolation.check_start(input, &pos, len)) {
            // Handle #{ ... }
        }

        pos += 1;
    }
```

# Literals (simple - no actions)
NUMBER = /[0-9]+/
IDENTIFIER = /[a-zA-Z_][a-zA-Z0-9_]*/

# Helper tokens (lowerCamelCase = auto-hidden)
spacing = /[ \t]+/
lineComment = /#[^\n]*/

# ============================================
# SECTION 5: GRAMMAR RULES (PARSER)
# ============================================

Program = [
  o 'Statement*', '["program", ...$1]'
]

Statement = [
  o 'IfStatement'
  o 'WhileLoop'
  o 'ForLoop'
  o 'FunctionDecl'
  o 'ExprStatement'
]

IfStatement = [
  o 'IF Expr:condition Block:then =10',
    '["if", $condition, $then]'
  o 'IF Expr:condition Block:then ELSE Block:else =10',
    '["if", $condition, $then, $else]'
  o 'IF Expr:condition Block:then ELSE IfStatement:elif =10',
    '["if", $condition, $then, $elif]'
]

WhileLoop = [
  o 'WHILE Expr:condition Block:body =10',
    '["while", $condition, $body]'
]

ForLoop = [
  o 'FOR IDENTIFIER:var IN Expr:iterable Block:body =10',
    '["for", $var, $iterable, $body]'
]

Block = [
  o 'INDENT OUTDENT', '["block"]'
  o 'INDENT Body OUTDENT', '["block", ...$2]'
]

Body = [
  o 'Statement+'
]

Expr = [
  # Binary operators with precedence
  o 'Expr< PLUS Expr>  <10', '["add", $left, $right]'
  o 'Expr< MINUS Expr> <10', '["sub", $left, $right]'
  o 'Expr< STAR Expr>  <20', '["mul", $left, $right]'
  o 'Expr< SLASH Expr> <20', '["div", $left, $right]'
  o 'Expr< POWER Expr> >30', '["pow", $left, $right]'

  # Primary expressions
  o 'NUMBER', '["number", parseInt($1, 10)]'
  o 'STRING', '["string", $1]'
  o 'IDENTIFIER', '["identifier", $1]'
  o 'LPAREN Expr RPAREN', '$2'
]

# Finalize action (called at EOF)
@finalize ```zig
    // Emit remaining DEDENTs at EOF
    indent.finalize(pos, tokens, &token_count);
```
```

---

## LAGER Standard Library

NEXUS includes a **standard library of pre-built actions** for common lexing patterns. Users can import these instead of writing custom Zig code.

### Available Libraries

| Library | Purpose | Languages |
|---------|---------|-----------|
| **indent** | INDENT/DEDENT tracking | Python, Rip, CoffeeScript, YAML |
| **brackets** | Bracket matching + errors | All C-like languages |
| **interpolation** | String interpolation | Ruby, CoffeeScript, Rip |
| **heredoc** | Here-documents | Ruby, Bash, Perl, PHP |
| **comments** | Line and block comments | Most languages |
| **line_joining** | Implicit line continuation | Python (inside brackets) |
| **regex_mode** | Regex vs division context | JavaScript, Ruby |

---

### Standard Library: `indent`

**For:** Python, Rip, CoffeeScript, YAML, Nim, Haskell

```coffeescript
# Usage in grammar
@use 'indent' {
    tab_width: 2,
    spaces_only: false,
    tabs_only: false,
}

NEWLINE = '\n' @action indent.handle_newline
@finalize indent.finalize
```

**What it provides:**

```zig
// Built into LAGER standard library
const IndentConfig = struct {
    tab_width: u32 = 8,
    spaces_only: bool = false,
    tabs_only: bool = false,
};

// State (automatically included)
var indent_stack: [256]u32 = undefined;
var stack_depth: usize = 1;

// Actions
pub fn init() void {
    indent_stack[0] = 0;
    stack_depth = 1;
}

pub fn handle_newline(
    input: [*]const u8,
    pos: *usize,
    len: usize,
    tokens: [*]Token,
    token_count: *usize,
    config: IndentConfig,
) void {
    pos.* += 1;

    // Skip blank lines
    while (pos.* < len and input[pos.*] == '\n') {
        pos.* += 1;
    }

    // Measure indentation
    var indent: u32 = 0;
    while (pos.* < len and (input[pos.*] == ' ' or input[pos.*] == '\t')) {
        if (input[pos.*] == '\t') {
            indent += config.tab_width;
        } else {
            indent += 1;
        }
        pos.* += 1;
    }

    const prev_indent = indent_stack[stack_depth - 1];

    if (indent > prev_indent) {
        // INDENT
        indent_stack[stack_depth] = indent;
        stack_depth += 1;
        tokens[token_count.*] = Token{
            .type = TOKEN_INDENT,
            .start = @intCast(u32, pos.*),
            .end = @intCast(u32, pos.*),
        };
        token_count.* += 1;
    } else if (indent < prev_indent) {
        // DEDENT (possibly multiple)
        while (stack_depth > 1 and indent_stack[stack_depth - 1] > indent) {
            stack_depth -= 1;
            tokens[token_count.*] = Token{
                .type = TOKEN_DEDENT,
                .start = @intCast(u32, pos.*),
                .end = @intCast(u32, pos.*),
            };
            token_count.* += 1;
        }

        // Indentation error check
        if (indent_stack[stack_depth - 1] != indent) {
            tokens[token_count.*] = Token{
                .type = TOKEN_ERROR,
                .start = @intCast(u32, pos.*),
                .end = @intCast(u32, pos.*),
            };
            token_count.* += 1;
        }
    }
}

pub fn finalize(
    pos: usize,
    tokens: [*]Token,
    token_count: *usize,
) void {
    // Emit remaining DEDENTs at EOF
    while (stack_depth > 1) {
        stack_depth -= 1;
        tokens[token_count.*] = Token{
            .type = TOKEN_DEDENT,
            .start = @intCast(u32, pos),
            .end = @intCast(u32, pos),
        };
        token_count.* += 1;
    }
}

pub fn depth() usize {
    return stack_depth;
}
```

**Usage example:**

```python
# Python code
def fibonacci(n):
    if n <= 1:        # INDENT emitted
        return n      # INDENT emitted
    else:             # DEDENT, then INDENT
        return fibonacci(n-1) + fibonacci(n-2)
# EOF: DEDENT, DEDENT emitted automatically
```

---

### Standard Library: `brackets`

**For:** All C-like languages, most languages with paired delimiters

```coffeescript
# Usage in grammar
@use 'brackets'

LPAREN = '(' @action brackets.push('(')
RPAREN = ')' @action brackets.pop(')')
LBRACKET = '[' @action brackets.push('[')
RBRACKET = ']' @action brackets.pop(']')
LBRACE = '{' @action brackets.push('{')
RBRACE = '}' @action brackets.pop('}')
```

**What it provides:**

```zig
// State
var bracket_stack: [256]u8 = undefined;
var bracket_depth: usize = 0;

// Push opening bracket
pub fn push(bracket: u8) void {
    bracket_stack[bracket_depth] = bracket;
    bracket_depth += 1;
}

// Pop and verify closing bracket
pub fn pop(
    expected: u8,
    pos: usize,
    tokens: [*]Token,
    token_count: *usize,
) bool {
    if (bracket_depth == 0) {
        // Error: unmatched closing bracket
        tokens[token_count.*] = Token{
            .type = TOKEN_ERROR,
            .start = @intCast(u32, pos),
            .end = @intCast(u32, pos + 1),
        };
        token_count.* += 1;
        return false;
    }

    const opening = bracket_stack[bracket_depth - 1];
    bracket_depth -= 1;

    // Check for mismatch (e.g., '(' closed by ']')
    const pairs = [_][2]u8{
        .{'(', ')'},
        .{'[', ']'},
        .{'{', '}'},
    };

    for (pairs) |pair| {
        if (pair[0] == opening and pair[1] != expected) {
            // Error: mismatched brackets
            tokens[token_count.*] = Token{
                .type = TOKEN_ERROR,
                .start = @intCast(u32, pos),
                .end = @intCast(u32, pos + 1),
            };
            token_count.* += 1;
            return false;
        }
    }

    return true;
}

// Get current nesting depth
pub fn depth() usize {
    return bracket_depth;
}

// Check if balanced
pub fn isBalanced() bool {
    return bracket_depth == 0;
}
```

**Features:**
- ✅ Automatic bracket matching
- ✅ Error detection (unmatched, mismatched)
- ✅ Depth tracking (for implicit line joining)

---

### Standard Library: `interpolation`

**For:** Ruby, CoffeeScript, Rip, shell scripts

```coffeescript
# Usage in grammar
@use 'interpolation'

STRING = '"' @action ```zig
    const start = pos;
    pos += 1;

    interpolation.start('"');

    while (pos < len) {
        if (input[pos] == '"' and !interpolation.in_interpolation()) {
            // End of string
            break;
        }

        if (interpolation.check_interp_start(input, &pos, len, tokens, &token_count)) {
            // Entered interpolation mode
            continue;
        }

        if (interpolation.check_interp_end(input, pos)) {
            // Exited interpolation mode
        }

        pos += 1;
    }
```
```

**What it provides:**

```zig
// State
var interp_depth: u32 = 0;
var string_quote: u8 = 0;

pub fn start(quote: u8) void {
    string_quote = quote;
    interp_depth = 0;
}

pub fn check_interp_start(
    input: [*]const u8,
    pos: *usize,
    len: usize,
    tokens: [*]Token,
    token_count: *usize,
) bool {
    if (pos.* + 1 < len and
        input[pos.*] == '#' and
        input[pos.* + 1] == '{') {

        interp_depth += 1;
        pos.* += 2;

        tokens[token_count.*] = Token{
            .type = TOKEN_STRING_INTERP_START,
            .start = @intCast(u32, pos.* - 2),
            .end = @intCast(u32, pos.*),
        };
        token_count.* += 1;

        return true;
    }
    return false;
}

pub fn check_interp_end(input: [*]const u8, pos: usize) bool {
    if (interp_depth > 0 and input[pos] == '}') {
        interp_depth -= 1;
        return true;
    }
    return false;
}

pub fn in_interpolation() bool {
    return interp_depth > 0;
}

pub fn depth() u32 {
    return interp_depth;
}
```

**Example:**

```coffeescript
name = "Alice"
str = "Hello #{name}, age #{user.age * 2}"
#             ^^^^^^      ^^^^^^^^^^^^^^
#             Tracked with depth counter!
```

---

### Standard Library: `heredoc`

**For:** Ruby, Bash, Perl, PHP

```coffeescript
@use 'heredoc'

HEREDOC_START = '<<' @action ```zig
    heredoc.start(input, &pos, len);
```
```

**What it provides:**

```zig
// State
var heredoc_delimiter: [64]u8 = undefined;
var delimiter_len: usize = 0;
var heredoc_active: bool = false;

pub fn start(input: [*]const u8, pos: *usize, len: usize) void {
    pos.* += 2;  // Skip <<

    // Read delimiter
    delimiter_len = 0;
    while (pos.* < len and delimiter_len < heredoc_delimiter.len) {
        const c = input[pos.*];
        if (c == '\n' or c == ' ') break;

        heredoc_delimiter[delimiter_len] = c;
        delimiter_len += 1;
        pos.* += 1;
    }

    heredoc_active = true;
}

pub fn check_end(input: [*]const u8, pos: usize, len: usize) bool {
    if (!heredoc_active) return false;

    // Check if line matches delimiter
    var i: usize = 0;
    while (i < delimiter_len and pos + i < len) {
        if (input[pos + i] != heredoc_delimiter[i]) {
            return false;
        }
        i += 1;
    }

    if (pos + i >= len or input[pos + i] != '\n') {
        return false;
    }

    heredoc_active = false;
    return true;
}
```

---

### Standard Library: `regex_mode`

**For:** JavaScript, Ruby (distinguishing `/` as regex vs division)

```coffeescript
@use 'regex_mode'

SLASH = '/' @action ```zig
    if (regex_mode.is_regex_context()) {
        // Scan regex literal
        regex_mode.scan_regex(input, &pos, len, tokens, &token_count);
    } else {
        // Division operator
        tokens[token_count] = Token{
            .type = TOKEN_SLASH,
            .start = @intCast(u32, pos),
            .end = @intCast(u32, pos + 1),
        };
        token_count += 1;
        pos += 1;
    }
```
```

**What it provides:**

```zig
// Track whether we're in expression or statement context
var last_token_type: u16 = 0;

pub fn update_context(token_type: u16) void {
    last_token_type = token_type;
}

pub fn is_regex_context() bool {
    // Regex after: =, (, [, {, return, etc.
    // Division after: ), ], identifiers, numbers
    return switch (last_token_type) {
        TOKEN_EQUALS, TOKEN_LPAREN, TOKEN_LBRACKET,
        TOKEN_LBRACE, TOKEN_RETURN, TOKEN_COMMA => true,
        TOKEN_RPAREN, TOKEN_RBRACKET, TOKEN_IDENTIFIER,
        TOKEN_NUMBER => false,
        else => true,  // Default to regex
    };
}

pub fn scan_regex(
    input: [*]const u8,
    pos: *usize,
    len: usize,
    tokens: [*]Token,
    token_count: *usize,
) void {
    const start = pos.*;
    pos.* += 1;  // Skip opening /

    while (pos.* < len) {
        const c = input[pos.*];

        if (c == '/') {
            pos.* += 1;
            // Scan flags (g, i, m, etc.)
            while (pos.* < len and isAlpha(input[pos.*])) {
                pos.* += 1;
            }
            break;
        }

        if (c == '\\' and pos.* + 1 < len) {
            pos.* += 2;  // Skip escaped character
            continue;
        }

        pos.* += 1;
    }

    tokens[token_count.*] = Token{
        .type = TOKEN_REGEX,
        .start = @intCast(u32, start),
        .end = @intCast(u32, pos.*),
    };
    token_count.* += 1;
}
```

---

## LAGER Architecture Deep Dive

### The Complete Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                     LAGER Pipeline                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Token Patterns (from NEXUS grammar)                    │
│     ↓                                                       │
│  2. Regex → NFA (Thompson Construction)                    │
│     ↓                                                       │
│  3. Merge NFAs (Common start state)                        │
│     ↓                                                       │
│  4. NFA → DFA (Subset Construction)                        │
│     ↓                                                       │
│  5. DFA Minimization (Hopcroft's Algorithm)                │
│     ↓                                                       │
│  6. Priority Resolution (Longest match + priority)         │
│     ↓                                                       │
│  7. Include Standard Libraries                              │
│     ↓                                                       │
│  8. Generate Zig Code (Template-based)                     │
│     ↓                                                       │
│  9. Compile to WASM (zig build-lib)                        │
│     ↓                                                       │
│ 10. JavaScript Wrapper (with fallback)                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Core Algorithms

#### **1. Thompson's NFA Construction**

Converts regex patterns to Non-deterministic Finite Automata:

```javascript
function regexToNFA(pattern) {
  if (pattern is 'a') {
    // Single character: start --a--> accept
    return NFA(start, accept, transitions: {start: {a: [accept]}});
  }

  if (pattern is 'ab') {
    // Concatenation: chain two NFAs
    nfa1 = regexToNFA('a');
    nfa2 = regexToNFA('b');
    nfa1.accept.addTransition('ε', nfa2.start);
    return NFA(nfa1.start, nfa2.accept);
  }

  if (pattern is 'a|b') {
    // Alternation: fork to both options
    nfa1 = regexToNFA('a');
    nfa2 = regexToNFA('b');
    newStart = new State();
    newAccept = new State();
    newStart.addTransition('ε', nfa1.start);
    newStart.addTransition('ε', nfa2.start);
    nfa1.accept.addTransition('ε', newAccept);
    nfa2.accept.addTransition('ε', newAccept);
    return NFA(newStart, newAccept);
  }

  if (pattern is 'a*') {
    // Kleene star: loop back or skip
    nfa = regexToNFA('a');
    newStart = new State();
    newAccept = new State();
    newStart.addTransition('ε', nfa.start);
    newStart.addTransition('ε', newAccept);
    nfa.accept.addTransition('ε', nfa.start);
    nfa.accept.addTransition('ε', newAccept);
    return NFA(newStart, newAccept);
  }
}
```

**Complexity: O(n)** where n = pattern length

#### **2. Subset Construction (NFA → DFA)**

The **key algorithm** that eliminates non-determinism:

```javascript
function nfaToDFA(nfa) {
  // DFA state = set of NFA states
  const startClosure = epsilonClosure([nfa.start]);
  const dfaStates = [startClosure];
  const transitions = new Map();
  const worklist = [startClosure];

  while (worklist.length > 0) {
    const currentDFA = worklist.shift();

    // For each possible input character
    for (const char of alphabet) {
      // Find all NFA states reachable on this character
      const nextNFA = new Set();
      for (const nfaState of currentDFA) {
        for (const nextState of nfaState.transitions[char] || []) {
          nextNFA.add(nextState);
        }
      }

      if (nextNFA.size === 0) continue;

      // Epsilon closure of those states
      const nextDFA = epsilonClosure(Array.from(nextNFA));

      // Add to DFA if new state
      let dfaStateId = findState(dfaStates, nextDFA);
      if (dfaStateId === -1) {
        dfaStateId = dfaStates.length;
        dfaStates.push(nextDFA);
        worklist.push(nextDFA);
      }

      // Record transition
      const fromId = findState(dfaStates, currentDFA);
      transitions.set([fromId, char], dfaStateId);
    }
  }

  return { states: dfaStates, transitions };
}
```

**Result:** Deterministic state machine with O(1) transitions

#### **3. DFA Minimization (Hopcroft's Algorithm)**

```javascript
function minimizeDFA(dfa) {
  // Start with partitions: accepting vs non-accepting
  let partitions = [
    dfa.states.filter(s => !s.isAccepting),
    dfa.states.filter(s => s.isAccepting)
  ];

  // Further partition by token type
  partitions = refineByTokenType(partitions);

  let changed = true;
  while (changed) {
    changed = false;

    for (let i = 0; i < partitions.length; i++) {
      const partition = partitions[i];

      // Try to split this partition
      for (const char of alphabet) {
        const subgroups = new Map();

        for (const state of partition) {
          const nextState = dfa.transitions.get([state.id, char]);
          const nextPartition = findPartition(nextState, partitions);

          if (!subgroups.has(nextPartition)) {
            subgroups.set(nextPartition, []);
          }
          subgroups.get(nextPartition).push(state);
        }

        if (subgroups.size > 1) {
          // Split the partition!
          partitions.splice(i, 1, ...subgroups.values());
          changed = true;
          break;
        }
      }
    }
  }

  return buildDFAFromPartitions(partitions);
}
```

**Result:** Minimal DFA (30-50% fewer states)

---

## Generated Code Structure

### Complete Generated Lexer

```zig
// lexer.zig - Generated by LAGER from rip.nexus

const std = @import("std");

// ============================================
// TOKEN DEFINITIONS
// ============================================

const TOKEN_IF = 1;
const TOKEN_ELSE = 2;
const TOKEN_WHILE = 3;
const TOKEN_NUMBER = 10;
const TOKEN_IDENTIFIER = 11;
const TOKEN_INDENT = 20;
const TOKEN_DEDENT = 21;
// ... etc

const Token = packed struct {
    type: u16,
    start: u32,
    end: u32,
};

// ============================================
// STANDARD LIBRARY: indent
// ============================================

const IndentConfig = struct {
    tab_width: u32 = 2,
    spaces_only: bool = false,
    tabs_only: bool = false,
};

const indent = struct {
    var stack: [256]u32 = undefined;
    var depth: usize = 1;

    pub fn init() void {
        stack[0] = 0;
        depth = 1;
    }

    pub fn handle_newline(
        input: [*]const u8,
        pos: *usize,
        len: usize,
        tokens: [*]Token,
        token_count: *usize,
        config: IndentConfig,
    ) void {
        // ... full implementation from stdlib
    }

    pub fn finalize(pos: usize, tokens: [*]Token, token_count: *usize) void {
        while (depth > 1) {
            depth -= 1;
            tokens[token_count.*] = Token{
                .type = TOKEN_DEDENT,
                .start = @intCast(u32, pos),
                .end = @intCast(u32, pos),
            };
            token_count.* += 1;
        }
    }
};

// ============================================
// STANDARD LIBRARY: brackets
// ============================================

const brackets = struct {
    var stack: [256]u8 = undefined;
    var depth: usize = 0;

    pub fn push(bracket: u8) void {
        stack[depth] = bracket;
        depth += 1;
    }

    pub fn pop(
        expected: u8,
        pos: usize,
        tokens: [*]Token,
        token_count: *usize,
    ) bool {
        // ... full implementation
    }

    pub fn depth() usize {
        return depth;
    }
};

// ============================================
// CUSTOM STATE VARIABLES (from @state)
// ============================================

var mode: u32 = 0;
var paren_depth: u32 = 0;

// ============================================
// MAIN LEXER
// ============================================

pub export fn lex(input: [*]const u8, len: usize, tokens: [*]Token) usize {
    var pos: usize = 0;
    var token_count: usize = 0;
    var state: u32 = 0;

    // Initialize standard libraries
    indent.init();

    while (pos < len) {
        const start = pos;
        const c = input[pos];

        // ========================================
        // CUSTOM ACTIONS (from grammar)
        // ========================================

        // NEWLINE with custom action
        if (c == '\n') {
            if (brackets.depth() == 0) {
                indent.handle_newline(input, &pos, len, tokens, &token_count, .{
                    .tab_width = 2,
                });
            } else {
                pos += 1;
            }
            continue;
        }

        // LPAREN with standard action
        if (c == '(') {
            brackets.push('(');
            tokens[token_count] = Token{
                .type = TOKEN_LPAREN,
                .start = @intCast(u32, pos),
                .end = @intCast(u32, pos + 1),
            };
            token_count += 1;
            pos += 1;
            continue;
        }

        // ========================================
        // DFA STATE MACHINE (generated)
        // ========================================

        var last_accept: i32 = -1;
        var last_accept_pos: usize = 0;

        while (pos < len) {
            const ch = input[pos];

            state = switch (state) {
                0 => switch (ch) {
                    'i' => 1,
                    'e' => 5,
                    'w' => 10,
                    '0'...'9' => 100,
                    'a'...'h', 'j'...'z' => 200,
                    '+', '-', '*' => 300,
                    else => break,
                },
                1 => switch (ch) {
                    'f' => 2,
                    'a'...'z', '0'...'9' => 200,
                    else => break,
                },
                2 => switch (ch) {
                    'a'...'z', '0'...'9' => 200,
                    else => break,
                },
                // ... more states (generated from DFA)
                else => break,
            };

            pos += 1;

            // Check if accepting state
            const token_type = getTokenType(state);
            if (token_type != 0) {
                last_accept = @intCast(i32, token_type);
                last_accept_pos = pos;
            }
        }

        // Did we match?
        if (last_accept >= 0) {
            tokens[token_count] = Token{
                .type = @intCast(u16, last_accept),
                .start = @intCast(u32, start),
                .end = @intCast(u32, last_accept_pos),
            };
            token_count += 1;
            pos = last_accept_pos;
            state = 0;  // Reset
        } else {
            // No match - error
            return token_count;
        }
    }

    // ========================================
    // FINALIZE (from @finalize directive)
    // ========================================

    indent.finalize(pos, tokens, &token_count);

    return token_count;
}

// ========================================
// HELPER FUNCTIONS
// ========================================

inline fn getTokenType(state: u32) u16 {
    return switch (state) {
        2 => TOKEN_IF,
        3 => TOKEN_IN,
        7 => TOKEN_ELSE,
        12 => TOKEN_WHILE,
        100 => TOKEN_NUMBER,
        200 => TOKEN_IDENTIFIER,
        300 => TOKEN_PLUS,
        else => 0,
    };
}
```

---

## Syntax Reference

### Directives

```coffeescript
# Target backends
@target 'lager-wasm', 'solar-slr', 'solar-lalr'

# Standard library imports
@use 'indent' { tab_width: 2 }
@use 'brackets'
@use 'interpolation'

# Custom state variables
@state ```zig
var custom_counter: u32 = 0;
var mode: u32 = MODE_NORMAL;
```

# Helper functions
@helper ```zig
fn isWhitespace(c: u8) bool {
    return c == ' ' or c == '\t';
}
```

# Finalize action (called at EOF)
@finalize ```zig
    indent.finalize(pos, tokens, &token_count);
```
```

### Token Definitions

Tokens follow naming conventions:

| **Pattern** | **Type** | **Behavior** |
|-------------|----------|--------------|
| `ALLCAPS` | Token (lexer) | Creates token type, included in output |
| `TitleCase` | Rule (parser) | Grammar rule that produces AST node |
| `lowerCamelCase` | Helper | Auto-hidden, not in AST (whitespace, etc.) |

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

**Tokens with standard actions:**
```coffeescript
NEWLINE = '\n' @action indent.handle_newline
LPAREN = '(' @action brackets.push('(')
RPAREN = ')' @action brackets.pop(')')
```

**Tokens with custom actions:**
```coffeescript
STRING = '"' @action ```zig
    const start = pos;
    pos += 1;

    while (pos < len and input[pos] != '"') {
        if (input[pos] == '\\') pos += 1;
        pos += 1;
    }

    tokens[token_count] = Token{
        .type = TOKEN_STRING,
        .start = @intCast(u32, start),
        .end = @intCast(u32, pos + 1),
    };
    token_count += 1;
    pos += 1;
```
```

**Token aliases:**
```coffeescript
IDENTIFIER aka ClassName, VariableName, FunctionName
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

### Pattern Syntax

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

**This single sigil saves hundreds of lines of grammar rules!**

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

---

## Action Syntax (for Parser)

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

#### **Rule 4: Explicit `$` references**
```coffeescript
o 'Expr PLUS Expr', '["add", $1, $3]'
o 'NUMBER', '["number", parseInt($1, 10)]'
```

**Best practice:** Always use explicit `$` for clarity.

#### **Named References**
```coffeescript
o 'IF Expr:condition Block:then', '["if", $condition, $then]'
```

#### **Spread Operator**
```coffeescript
o 'INDENT Body OUTDENT', '["block", ...$2]'
# Spreads Body's children into the block array
```

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

### Named Property Access (The Killer Feature!)

S-expressions are **normal arrays** with **named properties attached**:

```javascript
const sexp = ['if', condition, thenBlock, elseBlock];

// Solar automatically attaches named properties:
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

// JSON serialization is clean (properties don't serialize):
JSON.stringify(sexp);
// ["if",[">",[...],[...]],[...]]
```

**This hybrid approach combines:**
- ✅ Simple array structure (easy pattern matching)
- ✅ Named access for readability
- ✅ No custom AST node classes
- ✅ Clean serialization

---

## Performance Analysis

### Expected Lexer Performance

| File Size | JS Lexer | LAGER (WASM) | Speedup |
|-----------|----------|--------------|---------|
| **1 KB** | 0.5ms | 0.3ms | 1.7x |
| **10 KB** | 3ms | 0.8ms | 3.8x |
| **100 KB** | 35ms | 5ms | **7x** |
| **1 MB** | 380ms | 45ms | **8.4x** |
| **10 MB** | 4.2s | 480ms | **8.8x** |

**Why LAGER is faster:**
- ✅ No GC pauses
- ✅ Direct memory access
- ✅ CPU cache-friendly layout
- ✅ Early exit on match
- ✅ Optimized state transitions

### Memory Usage

```
For 1MB source file with ~100K tokens:

JavaScript Lexer:
  - Token objects: ~100K × 80 bytes = 8MB
  - String values: Shared with source
  - GC overhead: ~2-3MB
  Total: ~10-11MB

LAGER (WASM):
  - Input buffer: 1MB (UTF-8)
  - Token buffer: 100K × 8 bytes = 800KB
  - Stack variables: ~1KB
  - No GC overhead
  Total: ~2MB (5x less memory!)
```

---

## LAGER vs Alternatives

### vs. Mega-Regex

| Aspect | Mega-Regex | LAGER |
|--------|------------|-------|
| **Speed** | 1x | 5-10x |
| **Memory** | High (GC) | Low (no GC) |
| **Scalability** | Poor (100+ patterns) | Excellent |
| **Early exit** | ❌ No | ✅ Yes |
| **Context-sensitive** | ❌ Hard | ✅ Built-in |
| **INDENT/DEDENT** | ❌ External | ✅ Built-in (stack) |
| **Actions** | ❌ None | ✅ Full Zig |

### vs. Hand-Written Lexer

| Aspect | Hand-Written | LAGER |
|--------|--------------|-------|
| **Speed** | Fast | Faster (optimized DFA) |
| **Maintenance** | Hard | Regenerate from grammar |
| **Correctness** | Bugs possible | Provably correct |
| **Updates** | Manual editing | Regenerate |

### vs. Ragel

| Component | LAGER | Ragel |
|-----------|-------|-------|
| **NFA→DFA** | ✅ | ✅ |
| **Minimization** | ✅ | ✅ |
| **Actions** | ✅ Zig | ✅ C/C++ |
| **Stack support** | ✅ | ✅ |
| **Standard library** | ✅ Built-in | ❌ Manual |
| **Target** | Zig/WASM | C/C++ |
| **LOC** | 2-3K | 15K+ |

---

## What LAGER Can Do

### ✅ **Context-Sensitive Lexing**

```javascript
// Distinguishes based on context:
x / y        // Division (expression context)
/regex/      // Regex literal (statement context)
```

### ✅ **INDENT/DEDENT with Stack**

```python
# Python-style indentation
def fib(n):
    if n <= 1:      # INDENT
        return n    # INDENT
    else:           # DEDENT, INDENT
        return fib(n-1) + fib(n-2)
# EOF: DEDENT, DEDENT
```

**All handled in WASM with stack! No external scanner!**

### ✅ **String Interpolation**

```coffeescript
str = "Hello #{name}, age #{user.age * 2}"
#             ^^^^^^      ^^^^^^^^^^^^^^
#             Tracked with depth counter
```

### ✅ **Bracket Matching + Errors**

```javascript
array = [1, 2, 3)  // Error: Mismatched brackets
//              ^ Expected ']', got ')'
```

### ✅ **Multi-Mode Scanning**

```zig
const Mode = enum { NORMAL, STRING, REGEX, COMMENT };
var current_mode: Mode = .NORMAL;

// Switch modes based on context
```

### ✅ **Actions on Transitions**

```zig
// Execute code when entering/leaving states
if (c == '"') {
    string_mode.enter();
    // Custom logic here
}
```

---

## Implementation Plan

### Phase 1: LAGER Core (2-3 weeks)

**Week 1: MVP**
- ✅ Thompson NFA construction
- ✅ Subset construction (NFA→DFA)
- ✅ Basic Zig code generation
- ✅ Simple test cases
- **Estimated LOC:** 500-800

**Week 2: Optimization**
- ✅ DFA minimization (Hopcroft)
- ✅ Character range compression
- ✅ Priority resolution
- ✅ Test with Rip grammar (~80 patterns)
- **Estimated LOC:** 1,500-2,000

**Week 3: Production**
- ✅ Standard library (indent, brackets, etc.)
- ✅ JavaScript wrapper with fallback
- ✅ Error handling and diagnostics
- ✅ Integration with NEXUS
- **Estimated LOC:** 2,500-3,000

### Phase 2: Parser Integration (Existing)

Solar parser generation is already proven in Rip:
- ✅ SLR(1) parsing working
- ✅ S-expression generation
- ✅ Named property access
- ✅ Self-hosting operational

### Phase 3: Complete System

- Unified NEXUS grammar format
- LAGER + Solar integration
- Standard library distribution
- Documentation and examples
- Benchmarks and validation

---

## Usage Examples

### Simple Language (Calculator)

```coffeescript
# calc.nexus - Simple calculator language

@target 'lager-wasm', 'solar-slr'

# Tokens (no actions needed)
PLUS = '+'
MINUS = '-'
STAR = '*'
SLASH = '/'
NUMBER = /[0-9]+/
LPAREN = '('
RPAREN = ')'

spacing = /[ \t\n]+/
@extras 'spacing'

# Grammar
Program = [o 'Expr']

Expr = [
  o 'Expr< PLUS Expr>   <10', '["add", $1, $3]'
  o 'Expr< MINUS Expr>  <10', '["sub", $1, $3]'
  o 'Expr< STAR Expr>   <20', '["mul", $1, $3]'
  o 'Expr< SLASH Expr>  <20', '["div", $1, $3]'
  o 'NUMBER', '["number", parseInt($1, 10)]'
  o 'LPAREN Expr RPAREN', '$2'
]
```

**Generate compiler:**
```bash
$ solar compile calc.nexus

Generated:
  ✓ calc-lexer.zig (150 LOC)
  ✓ calc-lexer.wasm (3KB)
  ✓ calc-lexer.js (wrapper)
  ✓ calc-parser.js (SLR tables)

Expected speedup: 8x
```

---

### Python-like Language

```coffeescript
# python.nexus - Python-style indentation

@target 'lager-wasm', 'solar-slr'

# Use standard indentation library
@use 'indent' { tab_width: 4, spaces_only: true }
@use 'brackets'

# Keywords
IF = 'if'
ELIF = 'elif'
ELSE = 'else'
WHILE = 'while'
DEF = 'def'
RETURN = 'return'

# Operators
PLUS = '+'
MINUS = '-'
COLON = ':'

# Literals
NUMBER = /[0-9]+/
STRING = /"[^"]*"/
IDENTIFIER = /[a-zA-Z_][a-zA-Z0-9_]*/

# Indentation handling (standard library!)
NEWLINE = '\n' @action ```zig
    // Skip newlines inside brackets (implicit line joining)
    if (brackets.depth() == 0) {
        indent.handle_newline(input, &pos, len, tokens, &token_count, .{
            .tab_width = 4,
            .spaces_only = true,
        });
    } else {
        pos += 1;  // Inside brackets - ignore newline
    }
```

# Brackets with standard actions
LPAREN = '(' @action brackets.push('(')
RPAREN = ')' @action brackets.pop(')')
LBRACKET = '[' @action brackets.push('[')
RBRACKET = ']' @action brackets.pop(']')

# Finalize
@finalize indent.finalize

# Grammar rules
Program = [o 'Statement*']

Statement = [
  o 'IfStatement'
  o 'WhileLoop'
  o 'FunctionDecl'
  o 'ExprStatement'
]

# ... rest of grammar
```

**Complete Python lexer in ~100 lines!** (vs 500+ with custom code)

---

### Rip Language (Real-World Example)

```coffeescript
# rip.nexus - Complete Rip language specification

@target 'lager-wasm', 'solar-slr'

# ==========================================
# STANDARD LIBRARIES
# ==========================================

@use 'indent' { tab_width: 2 }
@use 'brackets'
@use 'interpolation'
@use 'regex_mode'

# ==========================================
# CUSTOM STATE
# ==========================================

@state ```zig
var heregex_depth: u32 = 0;
```

# ==========================================
# TOKENS
# ==========================================

# Keywords
IF = 'if'
UNLESS = 'unless'
ELSE = 'else'
WHILE = 'while'
FOR = 'for'
DEF = 'def'
CLASS = 'class'
RETURN = 'return'
AWAIT = 'await'
YIELD = 'yield'

# Operators (complex - dual ? syntax)
ARROW = '->'
FAT_ARROW = '=>'
DAMMIT = '!'           # Call-and-await: fetchData!
OTHERWISE = '!?'       # Undefined-only coalescing
NULLISH = '??'
OPTIONAL = '?.'
SOAK = '?'
COMPARE = /==|!=|<=|>=|<|>/
REGEX_MATCH = '=~'

# Punctuation
LPAREN = '(' @action brackets.push('(')
RPAREN = ')' @action brackets.pop(')')
LBRACKET = '[' @action brackets.push('[')
RBRACKET = ']' @action brackets.pop(']')
LBRACE = '{' @action brackets.push('{')
RBRACE = '}' @action brackets.pop('}')

# Indentation
NEWLINE = '\n' @action ```zig
    if (brackets.depth() == 0) {
        indent.handle_newline(input, &pos, len, tokens, &token_count, .{
            .tab_width = 2,
        });
    } else {
        pos += 1;
    }
```

# Strings with interpolation
STRING = '"' @action ```zig
    interpolation.start('"');
    const start = pos;
    pos += 1;

    while (pos < len) {
        if (input[pos] == '"' and !interpolation.in_interpolation()) {
            pos += 1;
            break;
        }

        if (interpolation.check_interp_start(input, &pos, len, tokens, &token_count)) {
            continue;
        }

        pos += 1;
    }

    tokens[token_count] = Token{
        .type = TOKEN_STRING,
        .start = @intCast(u32, start),
        .end = @intCast(u32, pos),
    };
    token_count += 1;
```

# Heregex (extended regex with comments)
HEREGEX = '///' @action ```zig
    const start = pos;
    pos += 3;

    while (pos + 2 < len) {
        if (input[pos] == '/' and
            input[pos + 1] == '/' and
            input[pos + 2] == '/') {
            pos += 3;
            break;
        }
        pos += 1;
    }

    tokens[token_count] = Token{
        .type = TOKEN_HEREGEX,
        .start = @intCast(u32, start),
        .end = @intCast(u32, pos),
    };
    token_count += 1;
```

# Regex vs division (context-sensitive)
SLASH = '/' @action ```zig
    if (regex_mode.is_regex_context()) {
        regex_mode.scan_regex(input, &pos, len, tokens, &token_count);
    } else {
        tokens[token_count] = Token{
            .type = TOKEN_SLASH,
            .start = @intCast(u32, pos),
            .end = @intCast(u32, pos + 1),
        };
        token_count += 1;
        pos += 1;
    }
```

# Simple tokens (no actions)
NUMBER = /[0-9]+(_[0-9]+)*/     # With underscores
IDENTIFIER = /[a-zA-Z_@][a-zA-Z0-9_]*/

# Finalize
@finalize ```zig
    indent.finalize(pos, tokens, &token_count);
```

# ==========================================
# GRAMMAR RULES (simplified for example)
# ==========================================

Program = [o 'Statement*']

Statement = [
  o 'IfStatement'
  o 'FunctionDecl'
  o 'ClassDecl'
  o 'ExprStatement'
]

# ... full grammar rules ...
```

---

## JavaScript Integration

### WASM Wrapper (Auto-Generated)

```javascript
// lexer.js - Generated by LAGER

let wasmInstance;
let memory;

export async function initLexer() {
    const wasmBytes = await fetch('lexer.wasm').then(r => r.arrayBuffer());
    const wasmModule = await WebAssembly.instantiate(wasmBytes);
    wasmInstance = wasmModule.instance;
    memory = wasmInstance.exports.memory;
    console.log('✓ WASM lexer loaded (8x faster)');
}

export function lex(source) {
    // 1. Encode to UTF-8
    const encoder = new TextEncoder();
    const encoded = encoder.encode(source);

    // 2. Allocate WASM buffers
    const inputPtr = wasmInstance.exports.alloc(encoded.length);
    const inputView = new Uint8Array(memory.buffer, inputPtr, encoded.length);
    inputView.set(encoded);

    const maxTokens = Math.ceil(source.length / 2);
    const tokenSize = 8;
    const tokensPtr = wasmInstance.exports.alloc(maxTokens * tokenSize);

    // 3. Call WASM lexer
    const tokenCount = wasmInstance.exports.lex(
        inputPtr,
        encoded.length,
        tokensPtr
    );

    // 4. Read tokens back
    const tokensView = new DataView(memory.buffer, tokensPtr, tokenCount * tokenSize);
    const tokens = [];

    for (let i = 0; i < tokenCount; i++) {
        const offset = i * tokenSize;
        tokens.push({
            type: tokensView.getUint16(offset, true),
            start: tokensView.getUint32(offset + 2, true),
            end: tokensView.getUint32(offset + 6, true),
            value: source.substring(
                tokensView.getUint32(offset + 2, true),
                tokensView.getUint32(offset + 6, true)
            )
        });
    }

    // 5. Free memory
    wasmInstance.exports.free(inputPtr);
    wasmInstance.exports.free(tokensPtr);

    return tokens;
}
```

### Automatic Fallback

```javascript
// lexer-wrapper.js - Smart fallback

let lexerImpl;

export async function initLexer() {
    if (typeof WebAssembly !== 'undefined') {
        try {
            await loadWasmLexer();
            lexerImpl = wasmLex;
            console.log('✓ WASM lexer (8x faster)');
        } catch (e) {
            console.warn('WASM failed, using JS:', e);
            lexerImpl = jsLex;
        }
    } else {
        lexerImpl = jsLex;
        console.log('Using JS lexer (WASM unavailable)');
    }
}

export function lex(source) {
    return lexerImpl(source);
}
```

**Graceful degradation:** Fast where possible, works everywhere.

---

## Rewriter: Token Stream Transformation

For languages with complex implicit syntax, an optional **rewriter** transforms the token stream after lexing but before parsing.

### When Needed

**LAGER can handle:**
- ✅ INDENT/DEDENT (with stack)
- ✅ Bracket matching
- ✅ String interpolation
- ✅ Context-sensitive lexing
- ✅ Simple token injection

**Rewriter still needed for:**
- Token reordering (`args...` → `...args`)
- Complex lookahead (implicit parentheses)
- Token deletion (NEWLINE suppression)
- AST-aware transformations

### The Contract

```javascript
// Input: Token[] (mutable array)
// Output: Token[] (same array, modified in-place)

function rewrite(tokens) {
  injectImplicitParentheses(tokens);
  convertPostfixSpread(tokens);
  return tokens;
}
```

### Example: Implicit Parentheses

```javascript
// rip-rewriter.js

export function rewrite(tokens) {
  injectImplicitParentheses(tokens);
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

      i = closePos;
    }
  }
}
```

### Pipeline Integration

```javascript
const tokens = lex(source);      // LAGER (WASM)
rewrite(tokens);                 // Optional transformation
const ast = parse(tokens);       // Solar (SLR/LALR)
```

---

## Complete Build Flow

```bash
# 1. Write NEXUS grammar
$ cat > mylang.nexus
@target 'lager-wasm', 'solar-slr'
@use 'indent'
# ... grammar definition

# 2. Generate compiler
$ solar compile mylang.nexus

Generating LAGER lexer:
  ✓ Parsed 65 token patterns
  ✓ Built NFA (287 states)
  ✓ Converted to DFA (134 states)
  ✓ Minimized DFA (78 states)
  ✓ Included libraries: indent, brackets
  ✓ Generated lexer.zig (724 LOC)
  ✓ Compiled to lexer.wasm (9.2KB)
  ✓ Generated lexer.js (wrapper, 156 LOC)

Generating Solar parser:
  ✓ Built LR(0) items (342 items)
  ✓ Constructed SLR automaton (89 states)
  ✓ Generated parser.js (1,245 LOC)

Total time: 2.3s
Expected speedup: 7-9x

# 3. Use compiler
$ cat > test.mylang
def greet(name)
    print "Hello, #{name}!"

$ node
> import { lex, parse, codegen } from './mylang-compiler.js';
> const source = fs.readFileSync('test.mylang', 'utf8');
> const tokens = lex(source);
> const ast = parse(tokens);
> const js = codegen(ast);
> console.log(js);
```

---

## Best Practices

### 1. Use Standard Libraries When Possible

```coffeescript
# Good: Leverage standard library
@use 'indent'
NEWLINE = '\n' @action indent.handle_newline

# Avoid: Reinventing the wheel
NEWLINE = '\n' @action ```zig
    // 100 lines of custom indent logic...
```
```

### 2. Keep Custom Actions Simple

```coffeescript
# Good: Simple token emission
STRING = '"' @action ```zig
    scan_simple_string(input, &pos, len, tokens, &token_count);
```

# Avoid: Complex logic inline
STRING = '"' @action ```zig
    // 200 lines of complex string parsing...
```
```

### 3. Organize Grammar Clearly

```coffeescript
# ===== TOKENS =====
# Group by category

# ===== GRAMMAR RULES =====
# Group by language construct

# ===== EXPRESSIONS =====
Expr = [...]

# ===== STATEMENTS =====
Statement = [...]
```

### 4. Use Named Fields

```coffeescript
# Good: Named fields for clarity
o 'IF Expr:condition Block:then ELSE Block:else',
  '["if", $condition, $then, $else]'

# Less clear: Positional only
o 'IF Expr Block ELSE Block',
  '["if", $2, $3, $5]'
```

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
  o 'Expr< PLUS Expr> <10', '["add", $1, $3]'
  o 'NUMBER', '["number", $1]'
]
```

✅ Cleaner syntax
✅ Inline precedence
✅ Executable code
✅ Standard actions
✅ WASM lexer (5-10x faster)

### vs. Ragel

**Ragel:**
```ragel
%%{
    machine lexer;

    action push { stack[top++] = indent; }

    newline = '\n' @push;
}%%
```

**NEXUS:**
```coffeescript
@use 'indent'
NEWLINE = '\n' @action indent.handle_newline
```

✅ Standard library (no manual stack)
✅ Zig target (vs C)
✅ WASM output
✅ Integrated with parser generator

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
  o 'Expr PLUS Expr', '["add", $1, $3]'
  o 'NUMBER', '["number", $1]'
]
```

✅ Actions in grammar (not separate visitor)
✅ S-expression output
✅ Self-hosting
✅ Faster lexer (WASM)

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
  o 'Expr< PLUS Expr> <10', '["add", $1, $3]'
  o 'NUMBER', '["number", $1]'
]
```

✅ More compact
✅ Actions built-in
✅ Multiple targets
✅ Standard libraries

---

## What LAGER Enables vs Mega-Regex

| Feature | Mega-Regex | LAGER (DFA + Stack) |
|---------|-----------|---------------------|
| **Keywords** | ✅ | ✅ (faster) |
| **Operators** | ✅ | ✅ (faster) |
| **Numbers/strings** | ✅ | ✅ (faster) |
| **Early exit** | ❌ | ✅ |
| **Context modes** | ❌ | ✅ |
| **INDENT/DEDENT** | ❌ | ✅ (stack) |
| **Bracket matching** | ❌ | ✅ (stack) |
| **String interpolation** | ❌ | ✅ (depth tracking) |
| **Regex vs division** | ❌ | ✅ (context) |
| **Here-documents** | ❌ | ✅ (state) |
| **Error recovery** | ❌ | ✅ |
| **Incremental lexing** | ❌ | ✅ |

**LAGER handles 90-95% of lexing needs. Rewriter handles the remaining 5-10%.**

---

## Advantages Over External Scanner

**Traditional approach (Rip currently uses this):**

```
WASM Lexer (fast) → JavaScript External Scanner (slow) → Tokens
                     ↑
                     Handles INDENT/DEDENT
                     Crosses WASM boundary (expensive!)
```

**NEXUS approach:**

```
WASM Lexer with Stack (fast) → Tokens
       ↑
       Handles EVERYTHING
       No boundary crossing!
```

**Performance difference:**

| Operation | External Scanner | LAGER (Built-in) |
|-----------|------------------|------------------|
| **Push to stack** | ~50-100ns (JS object) | ~2ns (array write) |
| **Boundary crossing** | ~500ns per call | None |
| **GC pressure** | Yes | None |
| **Total speedup** | 1x | **100-1000x** for indent tracking |

---

## Implementation Roadmap

### Phase 1: LAGER MVP (Week 1)

**Goal:** Basic DFA compiler

- [ ] Thompson NFA construction
- [ ] Subset construction (NFA→DFA)
- [ ] Basic Zig code generation
- [ ] Test with 10-20 simple patterns
- [ ] Compile to WASM and verify

**Deliverable:** Working lexer generator for simple tokens

### Phase 2: Optimization (Week 2)

**Goal:** Production performance

- [ ] DFA minimization (Hopcroft)
- [ ] Character range compression
- [ ] Priority resolution
- [ ] Test with Rip grammar (~80 patterns)
- [ ] Benchmark vs current lexer

**Deliverable:** Optimized lexer with 5x+ speedup

### Phase 3: Standard Library (Week 3)

**Goal:** Common patterns made easy

- [ ] `indent` library (Python/Rip/CoffeeScript)
- [ ] `brackets` library (matching + errors)
- [ ] `interpolation` library (strings)
- [ ] `heredoc` library (multi-line)
- [ ] `regex_mode` library (context-sensitive)

**Deliverable:** Complete standard library

### Phase 4: Integration (Week 4)

**Goal:** NEXUS + LAGER + Solar unified

- [ ] Unified grammar format
- [ ] JavaScript wrapper generation
- [ ] Fallback mechanism
- [ ] Documentation
- [ ] Examples (Python, Ruby, Rip)

**Deliverable:** Complete NEXUS system

---

## Technical Details

### Memory Layout Optimization

```zig
// Optimized for CPU cache lines (64 bytes)
const Token = packed struct {
    type: u16,    // 2 bytes
    start: u32,   // 4 bytes
    end: u32,     // 4 bytes
    // Total: 10 bytes per token
    // Fits 6 tokens per cache line
};
```

### State Machine Optimization

```zig
// Character range compression
switch (c) {
    'a'...'h', 'j'...'v', 'x'...'z' => 15,  // Compressed!
    // vs: 'a', 'b', 'c', 'd', 'e', ... (verbose)
}
```

### SIMD Opportunities (Future)

```zig
// Vectorized whitespace scanning
fn skipWhitespace(input: [*]const u8, pos: usize) usize {
    const v = @Vector(16, u8){input[pos..pos+16]};
    const spaces = @Vector(16, u8){' '} ** 16;
    const mask = v == spaces;
    return pos + @popCount(mask);
}
```

---

## Real-World Precedents

**This approach is proven:**

| Project | Language | Target | Use Case |
|---------|----------|--------|----------|
| **Tree-sitter** | C | WASM | GitHub, Neovim, Atom |
| **SWC** | Rust | WASM | Next.js, Deno (20-70x faster) |
| **Prettier** | Rust | WASM | Millions of developers |
| **Ragel** | Ragel | C/C++ | Ruby, Mongrel, others |

**NEXUS/LAGER follows proven patterns.** This works! 🚀

---

## Advanced Topics

### Dynamic Precedence

For context-sensitive precedence resolution:

```coffeescript
o 'Expr< CmpOp Expr> <15!', '["compare", $1, $2, $3]'
#                        ^
#                        dynamic (resolved at parse time)
```

### GLR Parsing

For ambiguous grammars:

```coffeescript
@target 'solar-glr'
```

GLR forks the parser on ambiguities and explores multiple parse paths.

### Incremental Lexing

```zig
// Future: Re-lex only changed regions
pub export fn lex_incremental(
    input: [*]const u8,
    changed_start: usize,
    changed_end: usize,
    prev_tokens: [*]Token,
) usize {
    // Find safe restart point
    const restart = findSafePoint(changed_start, prev_tokens);

    // Re-lex changed region only
    lex_range(input, restart, changed_end + SAFETY_MARGIN);

    // Merge with unchanged tokens
}
```

**Use case:** LSP (Language Server Protocol) - edit 1 line, re-lex 10 lines instead of 10K.

---

## Project Metrics

### Expected Implementation

| Component | Lines of Code | Time |
|-----------|---------------|------|
| **LAGER core** | 2,500-3,000 | 3 weeks |
| **Standard library** | 1,000-1,500 | 1 week |
| **NEXUS integration** | 500-1,000 | 1 week |
| **Documentation** | N/A | 1 week |
| **Total** | **4,000-5,500 LOC** | **6 weeks** |

### vs. Ragel

| Aspect | LAGER | Ragel |
|--------|-------|-------|
| **Core algorithms** | Same | Same |
| **Actions** | Zig | C/C++ |
| **Standard library** | ✅ Built-in | ❌ None |
| **Target** | WASM | Native |
| **LOC** | 4-5K | 15K+ |
| **Complexity** | Lower | Higher |

**LAGER is simpler because:**
- Standard library eliminates common code
- Target is WASM (simpler than native)
- Focused scope (lexing only, not full FSM)

---

## Why This Will Succeed

### 1. Algorithms Are Proven ✅

- Thompson NFA construction (1960s)
- Subset construction (1970s)
- Hopcroft minimization (1970s)
- Used in: lex, flex, Ragel, RE2, etc.

**These are solved problems.**

### 2. Technology Is Mature ✅

- Zig: Production-ready (1.0 released)
- WASM: Universal (95%+ browser support)
- Solar: Self-hosting in Rip already

**All components exist and work.**

### 3. Performance Is Real ✅

- Tree-sitter proves WASM works for parsing
- SWC proves 20-70x speedups are real
- RE2 proves DFA-based lexing is fast

**This isn't theoretical - it's reproducible.**

### 4. Scope Is Manageable ✅

**Not building:**
- ❌ Full regex engine (just token patterns)
- ❌ Complex semantic actions (just token emission)
- ❌ Multiple targets (just WASM for now)

**This is 6 weeks of work, not 6 months.**

---

## Success Criteria

### MVP (End of Phase 1)

- ✅ Generate WASM lexer from 20 token patterns
- ✅ Benchmark shows 3x+ speedup vs JavaScript
- ✅ Handles keywords, numbers, identifiers, operators

### Production (End of Phase 3)

- ✅ Standard library complete (indent, brackets, interpolation)
- ✅ Rip grammar compiles to WASM lexer
- ✅ 7x+ speedup on large files
- ✅ All Rip tests passing with WASM lexer

### Complete (End of Phase 4)

- ✅ NEXUS grammar format finalized
- ✅ LAGER + Solar fully integrated
- ✅ Documentation complete
- ✅ 3+ example languages (Rip, Python-like, calc)

---

## Future Enhancements

### Phase 5: Advanced Features

1. **Streaming lexer** - Process input in chunks
2. **Error recovery** - Continue after invalid input
3. **Incremental lexing** - Re-lex only changed regions (for LSP)
4. **SIMD optimization** - Vectorized operations
5. **Multi-threading** - Parallel lexing for huge files

### Phase 6: Ecosystem

1. **LSP support** - Language server protocol integration
2. **Syntax highlighting** - Fast token-based coloring
3. **Tree-sitter bridge** - Convert NEXUS → Tree-sitter
4. **VS Code extension** - Grammar highlighting
5. **Debugging tools** - DFA visualization, trace execution

---

## Conclusion

NEXUS provides a unified, executable grammar specification system that:

- **Generates ultra-fast lexers** via LAGER (DFA-based Zig/WASM, 5-10x speedup)
- **Produces efficient parsers** (SLR/LALR/GLR with full precedence control)
- **Outputs clean S-expressions** (arrays with named property access)
- **Includes standard libraries** (indent, brackets, interpolation, etc.)
- **Enables self-hosting** (grammar written in the language it defines)
- **Uses minimal, elegant syntax** (one helper, sigil-based patterns)

**Key innovations:**
1. ✅ **Standard action libraries** - Common patterns (indent, brackets) in ~1 line
2. ✅ **Embedded Zig actions** - Full language power when needed
3. ✅ **DFA with stack** - Handles INDENT/DEDENT without external scanner
4. ✅ **S-expressions + named props** - Simple arrays, readable access
5. ✅ **WASM compilation** - 5-10x faster than JavaScript

**The complete pipeline—LAGER lexer → rewriter → Solar parser → optimizer → codegen—provides clean separation of concerns while maintaining efficiency and simplicity.**

**NEXUS is how modern language tools should be built: executable, unified, performant, and beautiful.** ✨

---

## References

- **Dragon Book** (Aho, Lam, Sethi, Ullman) - Compiler theory and algorithms
- **Ragel** - State machine compiler (design inspiration)
- **RE2** - Google's regex engine (DFA approach)
- **Tree-sitter** - Modern parser (WASM precedent)
- **Zig Language** - Modern systems programming
- **WebAssembly** - Universal binary format
- **Solar** - SLR(1) parser generator (existing, proven)

---

**Status:** Design specification complete, ready for implementation

**Timeline:** 6 weeks from start to production-ready system

**Next steps:** Begin Phase 1 MVP (LAGER core)
