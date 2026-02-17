// ==========================================================================
// Schema Lexer — Tokenizer for Rip Schema Files
// ==========================================================================
//
// Tokenizes schema source into a stream of tagged tokens with
// indentation-based INDENT/OUTDENT for block structure.
//
// Design principles:
//   - Every token carries .loc  (location: r, c, n)
//   - Indentation tracked during tokenization
//   - Keywords use @ prefix for definitions and directives
//   - # is a comment when preceded by whitespace, a modifier otherwise
//   - Zero dependencies
//
// Token format:
//   { type, value, loc }
//   type  — token tag string (IDENTIFIER, MODEL, etc.)
//   value — parsed value (string, number, boolean)
//   loc   — { r: row, c: col, n: length }
//
// Author: Steve Shreeve <steve.shreeve@gmail.com>
//   Date: January 2026
// ==========================================================================

// ==========================================================================
// Keyword Maps
// ==========================================================================

// Keywords that require @ prefix (definition and directive keywords)
let AT_KEYWORDS = {
  // Definitions
  'enum':        'ENUM',
  'type':        'TYPE',
  'model':       'MODEL',
  'mixin':       'MIXIN',
  'widget':      'WIDGET',
  'form':        'FORM',
  'state':       'STATE',
  'import':      'IMPORT',

  // Directives (both snake_case and camelCase accepted)
  'timestamps':  'TIMESTAMPS',
  'softDelete':  'SOFT_DELETE',
  'soft_delete': 'SOFT_DELETE',
  'include':     'INCLUDE',
  'computed':    'COMPUTED',
  'validate':    'VALIDATE',
  'index':       'INDEX',
  'pattern':     'PATTERN',
  'belongs_to':  'BELONGS_TO',
  'belongsTo':   'BELONGS_TO',
  'has_one':     'HAS_ONE',
  'hasOne':      'HAS_ONE',
  'has_many':    'HAS_MANY',
  'hasMany':     'HAS_MANY',
  'one':         'ONE',
  'many':        'MANY',
  'link':        'LINK',
  'events':      'EVENTS',
  'actions':     'ACTIONS',
};

// Regular keywords (no @ prefix needed)
let KEYWORDS = {
  'true':        'BOOL',
  'false':       'BOOL',
  'null':        'NULL',
  'undefined':   'UNDEFINED',
  'is':          'IS',
  'isnt':        'ISNT',
  'not':         'NOT',
  'and':         'AND',
  'or':          'OR',
};

// ==========================================================================
// Regex Patterns
// ==========================================================================

let IDENTIFIER_RE    = /^[a-zA-Z_$][a-zA-Z0-9_$]*/;
let NUMBER_RE        = /^-?(?:0x[\da-f]+|0b[01]+|0o[0-7]+|\d*\.?\d+(?:e[+-]?\d+)?)/i;
let STRING_DOUBLE_RE = /^"(?:[^"\\]|\\.)*"/;
let STRING_SINGLE_RE = /^'(?:[^'\\]|\\.)*'/;
let REGEX_RE         = /^\/(?:[^\/\\]|\\.)+\/[gimsuy]*/;
let WHITESPACE_RE    = /^[^\n\S]+/;
let COMMENT_RE       = /^#.*/;
let NEWLINE_RE       = /^\n/;
let INDENT_RE        = /^[ \t]*/;
let BLANK_LINE_RE    = /^(#[^\n]*)?(\n|$)/;

// ==========================================================================
// Single-character token map
// ==========================================================================

let SINGLE_CHARS = {
  ':': ':', ',': ',', '.': '.', '(': '(', ')': ')',
  '[': '[', ']': ']', '{': '{', '}': '}',
  '!': '!', '#': '#', '?': '?',
  '+': '+', '-': '-', '*': '*', '/': '/',
  '<': '<', '>': '>',
  '=': '=', '&': '&', '|': '|', '^': '^',
};

// Multi-character operators (checked before single chars)
let MULTI_OPS = ['...', '?.', '->', '==', '!=', '<=', '>=', '&&', '||', '??'];

// ==========================================================================
// Helpers
// ==========================================================================

function syntaxError(message, {r = 0, c = 0, n = 1} = {}) {
  let err = new SyntaxError(message);
  err.location = {r, c, n};
  throw err;
}

// ==========================================================================
// Schema Lexer
// ==========================================================================

export class SchemaLexer {
  constructor() {
    this.input      = '';
    this.pos        = 0;
    this._row       = 0;
    this._col       = 0;
    this.indentStack = [0];
    this.tokens     = [];
    this.tokenIndex = 0;

    // Parser-facing state (set by lex())
    this.text  = '';
    this.line  = 0;
    this.len   = 0;
    this.loc   = {};
    this.match = '';
  }

  // --------------------------------------------------------------------------
  // Input
  // --------------------------------------------------------------------------

  setInput(input, ctx = {}) {
    this.input      = input;
    this.pos        = 0;
    this._row       = 0;
    this._col       = 0;
    this.indentStack = [0];
    this.tokens     = [];
    this.tokenIndex = 0;
    this.ctx        = ctx;

    this._tokenize();
  }

  // --------------------------------------------------------------------------
  // Token creation
  // --------------------------------------------------------------------------

  _emit(tokens, type, value, r, c, n) {
    let token = { type, value, loc: {r, c, n} };
    tokens.push(token);
    return token;
  }

  // --------------------------------------------------------------------------
  // Tokenizer
  // --------------------------------------------------------------------------

  _tokenize() {
    let input  = this.input;
    let tokens = this.tokens;
    let pos    = 0;
    let row    = 0;
    let col    = 0;
    let indentStack  = [0];
    let atLineStart  = true;
    let lastSignificant = null;

    let emit = (type, value, r, c, n) => {
      this._emit(tokens, type, value, r, c, n);
      if (type !== 'TERMINATOR' && type !== 'INDENT' && type !== 'OUTDENT') {
        lastSignificant = type;
      }
    };

    while (pos < input.length) {
      let remaining = input.slice(pos);
      let startRow  = row;
      let startCol  = col;
      let match;

      // --- Newlines ---
      if (match = remaining.match(NEWLINE_RE)) {
        pos += 1;
        row += 1;
        col  = 0;
        atLineStart = true;

        if (lastSignificant && lastSignificant !== 'TERMINATOR') {
          emit('TERMINATOR', '\n', startRow, startCol, 1);
        }
        continue;
      }

      // --- Indentation at line start ---
      if (atLineStart) {
        match = remaining.match(INDENT_RE);
        let indent = match[0].length;
        pos += indent;
        col += indent;
        atLineStart = false;

        // Blank or comment-only line — skip
        let restOfLine = input.slice(pos);
        let blankMatch = restOfLine.match(BLANK_LINE_RE);

        if (blankMatch) {
          let currentIndent = indentStack[indentStack.length - 1];

          // Outdent at column 0 even on blank/comment lines
          if (indent === 0 && indent < currentIndent) {
            while (indentStack.length > 1) {
              indentStack.pop();
              emit('OUTDENT', indent, row, 0, indent);
            }
            if (lastSignificant && lastSignificant !== 'TERMINATOR') {
              emit('TERMINATOR', '\n', row, 0, 0);
            }
          }

          let skipLen = blankMatch[0].length;
          pos += skipLen;
          if (blankMatch[2] === '\n') {
            row += 1;
            col  = 0;
            atLineStart = true;
          }
          continue;
        }

        // Real content — process indent changes
        let currentIndent = indentStack[indentStack.length - 1];

        if (indent > currentIndent) {
          indentStack.push(indent);
          emit('INDENT', indent, row, 0, indent);
        } else if (indent < currentIndent) {
          while (indentStack.length > 1 && indentStack[indentStack.length - 1] > indent) {
            indentStack.pop();
            emit('OUTDENT', indent, row, 0, indent);
          }
          if (lastSignificant && lastSignificant !== 'TERMINATOR') {
            emit('TERMINATOR', '\n', row, 0, 0);
          }
        }
        continue;
      }

      // --- Whitespace (mid-line) ---
      if (match = remaining.match(WHITESPACE_RE)) {
        pos += match[0].length;
        col += match[0].length;
        continue;
      }

      // --- Comments (#) ---
      // # is a comment when preceded by whitespace or at line start.
      // Otherwise it's a modifier token (e.g., email!# email).
      if (remaining[0] === '#') {
        let prevChar = input[pos - 1];
        let isComment = !prevChar || /\s/.test(prevChar);

        if (isComment) {
          match = remaining.match(COMMENT_RE);
          pos += match[0].length;
          col += match[0].length;
          continue;
        }
        // Fall through to single-char handling
      }

      // --- @ keywords/directives ---
      if (remaining[0] === '@') {
        pos += 1;
        col += 1;
        let identMatch = input.slice(pos).match(IDENTIFIER_RE);
        if (identMatch) {
          let word = identMatch[0];
          let tokenType = AT_KEYWORDS[word];
          if (tokenType) {
            pos += word.length;
            col += word.length;
            emit(tokenType, word, startRow, startCol, word.length + 1);
            continue;
          }
          // @ followed by non-keyword identifier = @property access
          emit('@', '@', startRow, startCol, 1);
          continue;
        }
        emit('@', '@', startRow, startCol, 1);
        continue;
      }

      // --- Multi-character operators ---
      let foundMultiOp = false;
      for (let op of MULTI_OPS) {
        if (remaining.startsWith(op)) {
          pos += op.length;
          col += op.length;
          emit(op, op, startRow, startCol, op.length);
          foundMultiOp = true;
          break;
        }
      }
      if (foundMultiOp) continue;

      // --- Identifiers and keywords ---
      if (match = remaining.match(IDENTIFIER_RE)) {
        let word = match[0];
        pos += word.length;
        col += word.length;

        let tokenType = KEYWORDS[word] || 'IDENTIFIER';
        let value = (tokenType === 'BOOL') ? (word === 'true') : word;
        emit(tokenType, value, startRow, startCol, word.length);
        continue;
      }

      // --- Numbers ---
      if (match = remaining.match(NUMBER_RE)) {
        pos += match[0].length;
        col += match[0].length;
        emit('NUMBER', parseFloat(match[0]), startRow, startCol, match[0].length);
        continue;
      }

      // --- Strings ---
      if (match = remaining.match(STRING_DOUBLE_RE) || remaining.match(STRING_SINGLE_RE)) {
        let str = match[0];
        pos += str.length;

        let newlines = (str.match(/\n/g) || []).length;
        if (newlines > 0) {
          row += newlines;
          col  = str.length - str.lastIndexOf('\n') - 1;
        } else {
          col += str.length;
        }

        // Remove quotes and unescape
        let value = str.slice(1, -1).replace(/\\(.)/g, (_, c) => {
          switch (c) {
            case 'n':  return '\n';
            case 't':  return '\t';
            case 'r':  return '\r';
            case '\\': return '\\';
            case '"':  return '"';
            case "'":  return "'";
            default:   return c;
          }
        });
        emit('STRING', value, startRow, startCol, str.length);
        continue;
      }

      // --- Regex literals ---
      let canBeRegex = !lastSignificant ||
        [':', ',', '(', '[', '{', '=', '!', '->', '&&', '||', '??', 'TERMINATOR',
         'INDENT', 'PATTERN', 'RETURN'].includes(lastSignificant);

      if (canBeRegex && (match = remaining.match(REGEX_RE))) {
        let regex = match[0];
        pos += regex.length;
        col += regex.length;
        emit('REGEX', regex, startRow, startCol, regex.length);
        continue;
      }

      // --- Single-character tokens ---
      let char = remaining[0];
      pos += 1;
      col += 1;

      if (SINGLE_CHARS[char]) {
        emit(SINGLE_CHARS[char], char, startRow, startCol, 1);
        continue;
      }

      // Unknown character
      syntaxError(`unexpected character '${char}'`, {r: row, c: col - 1, n: 1});
    }

    // Close remaining indents
    while (indentStack.length > 1) {
      indentStack.pop();
      emit('OUTDENT', 0, row, col, 0);
    }

    // Final terminator
    if (lastSignificant && lastSignificant !== 'TERMINATOR') {
      emit('TERMINATOR', '\n', row, col, 0);
    }
  }

  // --------------------------------------------------------------------------
  // Parser interface — returns one token at a time
  // --------------------------------------------------------------------------

  lex() {
    if (this.tokenIndex >= this.tokens.length) {
      return false; // EOF
    }

    let token  = this.tokens[this.tokenIndex++];
    this.text  = token.value;
    this.len   = typeof token.value === 'string' ? token.value.length : 1;
    this.line  = token.loc.r;
    this.loc   = token.loc;
    this.match = String(token.value);

    return token.type;
  }

  // --------------------------------------------------------------------------
  // Error display
  // --------------------------------------------------------------------------

  showPosition() {
    let lines = this.input.split('\n');
    let currentLine = lines[this.line] || '';
    let col = this.loc?.c || 0;
    let pointer = ' '.repeat(col) + '^';
    return `${currentLine}\n${pointer}`;
  }
}

export default SchemaLexer;
