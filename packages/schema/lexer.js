// ==============================================================================
// Schema Lexer - Tokenizer for Rip Schema Files
//
// A clean, standalone lexer for the schema language.
// Handles indentation-based syntax (INDENT/OUTDENT tokens).
//
// Author: Steve Shreeve <steve.shreeve@gmail.com>
//   Date: January 2026
// ==============================================================================

// Keywords that require @ prefix (definition and directive keywords)
const AT_KEYWORDS = {
  // Definition keywords
  'enum':       'ENUM',
  'type':       'TYPE',
  'model':      'MODEL',
  'mixin':      'MIXIN',
  'widget':     'WIDGET',
  'form':       'FORM',
  'state':      'STATE',
  'import':     'IMPORT',

  // Directive keywords
  'timestamps':  'TIMESTAMPS',
  'softDelete':  'SOFT_DELETE',
  'include':     'INCLUDE',
  'computed':    'COMPUTED',
  'validate':    'VALIDATE',
  'index':       'INDEX',
  'pattern':     'PATTERN',
  'belongs_to':  'BELONGS_TO',
  'has_one':     'HAS_ONE',
  'has_many':    'HAS_MANY',
  'events':      'EVENTS',
  'actions':     'ACTIONS',
};

// Regular keywords (no @ prefix needed)
const KEYWORDS = {
  // Boolean literals
  'true':        'BOOL',
  'false':       'BOOL',

  // Null/undefined
  'null':        'NULL',
  'undefined':   'UNDEFINED',

  // Operators
  'is':          'IS',
  'isnt':        'ISNT',
  'not':         'NOT',
  'and':         'AND',
  'or':          'OR',
};

// Regex patterns for tokens
const IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*/;
const NUMBER = /^-?(?:0x[\da-f]+|0b[01]+|0o[0-7]+|\d*\.?\d+(?:e[+-]?\d+)?)/i;
const STRING_DOUBLE = /^"(?:[^"\\]|\\.)*"/;
const STRING_SINGLE = /^'(?:[^'\\]|\\.)*'/;
const REGEX_LITERAL = /^\/(?:[^\/\\]|\\.)+\/[gimsuy]*/;
const WHITESPACE = /^[^\n\S]+/;
const COMMENT = /^#.*/;
const NEWLINE = /^\n/;

export class SchemaLexer {
  constructor() {
    this.input = '';
    this.pos = 0;
    this.line = 0;
    this.column = 0;
    this.indentStack = [0];
    this.tokens = [];
    this.tokenIndex = 0;
    this.yytext = '';
    this.yylineno = 0;
    this.yyleng = 0;
    this.yylloc = {};
    this.match = '';
  }

  setInput(input, yy = {}) {
    this.input = input;
    this.pos = 0;
    this.line = 0;
    this.column = 0;
    this.indentStack = [0];
    this.tokens = [];
    this.tokenIndex = 0;
    this.yy = yy;

    // Tokenize all at once (simpler for indentation handling)
    this._tokenize();
  }

  _tokenize() {
    const input = this.input;
    const tokens = this.tokens;
    let pos = 0;
    let line = 0;
    let column = 0;
    let indentStack = [0];
    let atLineStart = true;
    let lastSignificantToken = null;

    const makeLocation = (startLine, startCol, endLine, endCol) => ({
      first_line: startLine,
      first_column: startCol,
      last_line: endLine,
      last_column: endCol,
      range: [pos, pos]  // Simplified range
    });

    const addToken = (type, value, loc) => {
      tokens.push({ type, value, loc });
      if (type !== 'TERMINATOR' && type !== 'INDENT' && type !== 'OUTDENT') {
        lastSignificantToken = type;
      }
    };

    while (pos < input.length) {
      const remaining = input.slice(pos);
      const startLine = line;
      const startCol = column;
      let match;

      // Handle newlines and indentation
      if (match = remaining.match(NEWLINE)) {
        pos += 1;
        line += 1;
        column = 0;
        atLineStart = true;

        // Add TERMINATOR if we had meaningful content
        if (lastSignificantToken && lastSignificantToken !== 'TERMINATOR') {
          addToken('TERMINATOR', '\n', makeLocation(startLine, startCol, line, 0));
        }
        continue;
      }

      // Handle indentation at line start
      if (atLineStart) {
        match = remaining.match(/^[ \t]*/);
        const indent = match[0].length;
        pos += indent;
        column += indent;
        atLineStart = false;

        // Check if this is a blank line or comment-only line
        const restOfLine = input.slice(pos);
        const blankOrCommentMatch = restOfLine.match(/^(#[^\n]*)?(\n|$)/);

        // For blank/comment lines, skip the entire line (including comment and newline)
        if (blankOrCommentMatch) {
          const currentIndent = indentStack[indentStack.length - 1];

          // Only process outdent for blank/comment lines at column 0
          if (indent === 0 && indent < currentIndent) {
            while (indentStack.length > 1) {
              indentStack.pop();
              addToken('OUTDENT', indent, makeLocation(line, 0, line, indent));
            }
            if (lastSignificantToken && lastSignificantToken !== 'TERMINATOR') {
              addToken('TERMINATOR', '\n', makeLocation(line, 0, line, 0));
            }
          }

          // Skip the entire blank/comment line (including the newline)
          const skipLen = blankOrCommentMatch[0].length;
          pos += skipLen;
          if (blankOrCommentMatch[2] === '\n') {
            line += 1;
            column = 0;
            atLineStart = true;
          }
          continue;
        }

        // Real content line - process indent changes
        const currentIndent = indentStack[indentStack.length - 1];

        if (indent > currentIndent) {
          indentStack.push(indent);
          addToken('INDENT', indent, makeLocation(line, 0, line, indent));
        } else if (indent < currentIndent) {
          while (indentStack.length > 1 && indentStack[indentStack.length - 1] > indent) {
            indentStack.pop();
            addToken('OUTDENT', indent, makeLocation(line, 0, line, indent));
          }
          // After OUTDENT, add TERMINATOR to separate the completed block from next item
          if (lastSignificantToken && lastSignificantToken !== 'TERMINATOR') {
            addToken('TERMINATOR', '\n', makeLocation(line, 0, line, 0));
          }
        }
        continue;
      }

      // Skip whitespace (not at line start)
      if (match = remaining.match(WHITESPACE)) {
        pos += match[0].length;
        column += match[0].length;
        continue;
      }

      // Skip comments (# only starts a comment if preceded by whitespace or at line start)
      // In field definitions like `email!#: email`, the # is a modifier not a comment
      if (remaining[0] === '#') {
        // Check if previous character was whitespace or we're at line start after indentation
        const prevChar = input[pos - 1];
        const isCommentStart = !prevChar || /\s/.test(prevChar);

        if (isCommentStart) {
          match = remaining.match(COMMENT);
          pos += match[0].length;
          column += match[0].length;
          continue;
        }
        // Otherwise, fall through to single char token handling below
      }

      // @ prefix for keywords/directives
      if (remaining[0] === '@') {
        pos += 1;
        column += 1;
        const identMatch = input.slice(pos).match(IDENTIFIER);
        if (identMatch) {
          const word = identMatch[0];
          const tokenType = AT_KEYWORDS[word];
          if (tokenType) {
            pos += word.length;
            column += word.length;
            addToken(tokenType, word, makeLocation(startLine, startCol, line, column));
            continue;
          }
          // @ followed by identifier that's not a keyword = @property access
          // Don't consume the identifier, just emit @
          addToken('@', '@', makeLocation(startLine, startCol, startLine, startCol + 1));
          continue;
        }
        addToken('@', '@', makeLocation(startLine, startCol, startLine, startCol + 1));
        continue;
      }

      // Multi-character operators (check before single char)
      const multiOps = ['...', '?.', '->', '==', '!=', '<=', '>=', '&&', '||', '??'];
      let foundMultiOp = false;
      for (const op of multiOps) {
        if (remaining.startsWith(op)) {
          pos += op.length;
          column += op.length;
          addToken(op, op, makeLocation(startLine, startCol, line, column));
          foundMultiOp = true;
          break;
        }
      }
      if (foundMultiOp) continue;

      // Identifiers and keywords
      if (match = remaining.match(IDENTIFIER)) {
        const word = match[0];
        pos += word.length;
        column += word.length;

        const tokenType = KEYWORDS[word] || 'IDENTIFIER';
        const value = (tokenType === 'BOOL') ? (word === 'true') : word;
        addToken(tokenType, value, makeLocation(startLine, startCol, line, column));
        continue;
      }

      // Numbers
      if (match = remaining.match(NUMBER)) {
        pos += match[0].length;
        column += match[0].length;
        addToken('NUMBER', parseFloat(match[0]), makeLocation(startLine, startCol, line, column));
        continue;
      }

      // Strings
      if (match = remaining.match(STRING_DOUBLE) || remaining.match(STRING_SINGLE)) {
        const str = match[0];
        pos += str.length;
        // Count newlines in string
        const newlines = (str.match(/\n/g) || []).length;
        if (newlines > 0) {
          line += newlines;
          column = str.length - str.lastIndexOf('\n') - 1;
        } else {
          column += str.length;
        }
        // Remove quotes and unescape
        const value = str.slice(1, -1).replace(/\\(.)/g, (_, c) => {
          switch (c) {
            case 'n': return '\n';
            case 't': return '\t';
            case 'r': return '\r';
            case '\\': return '\\';
            case '"': return '"';
            case "'": return "'";
            default: return c;
          }
        });
        addToken('STRING', value, makeLocation(startLine, startCol, line, column));
        continue;
      }

      // Regex literals (only after certain tokens to avoid confusion with division)
      // Regex can follow: ( [ { , : = ! && || ?? -> etc.
      const canBeRegex = !lastSignificantToken ||
        [':', ',', '(', '[', '{', '=', '!', '->', '&&', '||', '??', 'TERMINATOR',
         'INDENT', 'PATTERN', 'RETURN'].includes(lastSignificantToken);

      if (canBeRegex && (match = remaining.match(REGEX_LITERAL))) {
        const regex = match[0];
        pos += regex.length;
        column += regex.length;
        addToken('REGEX', regex, makeLocation(startLine, startCol, line, column));
        continue;
      }

      // Single character tokens
      const char = remaining[0];
      pos += 1;
      column += 1;

      // Map single chars to token types
      const singleCharTokens = {
        ':': ':',
        ',': ',',
        '.': '.',
        '(': '(',
        ')': ')',
        '[': '[',
        ']': ']',
        '{': '{',
        '}': '}',
        '!': '!',
        '#': '#',
        '?': '?',
        '+': '+',
        '-': '-',
        '*': '*',
        '/': '/',
        '<': '<',
        '>': '>',
        '=': '=',
        '&': '&',
        '|': '|',
        '^': '^',
      };

      if (singleCharTokens[char]) {
        addToken(singleCharTokens[char], char, makeLocation(startLine, startCol, line, column));
        continue;
      }

      // Unknown character - error
      throw new Error(`Unexpected character '${char}' at line ${line + 1}, column ${column}`);
    }

    // Close any remaining indents
    while (indentStack.length > 1) {
      indentStack.pop();
      addToken('OUTDENT', 0, makeLocation(line, column, line, column));
    }

    // Add final terminator if needed
    if (lastSignificantToken && lastSignificantToken !== 'TERMINATOR') {
      addToken('TERMINATOR', '\n', makeLocation(line, column, line, column));
    }
  }

  lex() {
    if (this.tokenIndex >= this.tokens.length) {
      return false; // EOF
    }

    const token = this.tokens[this.tokenIndex++];
    this.yytext = token.value;
    this.yyleng = typeof token.value === 'string' ? token.value.length : 1;
    this.yylineno = token.loc.first_line;
    this.yylloc = token.loc;
    this.match = String(token.value);

    return token.type;
  }

  showPosition() {
    const lines = this.input.split('\n');
    const line = lines[this.yylineno] || '';
    const col = this.yylloc?.first_column || 0;
    const pointer = ' '.repeat(col) + '^';
    return `${line}\n${pointer}`;
  }
}

export default SchemaLexer;
