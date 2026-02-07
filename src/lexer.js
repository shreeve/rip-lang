// ==========================================================================
// Rip Lexer — Clean reimplementation (2026)
// ==========================================================================
//
// Tokenizes Rip source into a stream of tagged tokens, then rewrites
// the stream to insert implicit syntax (calls, objects, blocks).
//
// Design principles:
//   - Every token carries .pre (whitespace count before it)
//   - Every token carries .data (metadata: await, predicate, quote, etc.)
//   - Every token carries .loc  (location: row, col, len)
//   - Indentation is derived from .pre, not tracked during lexing
//   - Token categories use Sets for O(1) membership tests
//   - All let, no const — simplicity over ceremony
//   - Parser reads .data directly — no new String() wrapping needed
//
// Token format:
//   [tag, val]          — minimal array (compatible with parser)
//   token.pre           — whitespace characters before this token
//   token.data          — metadata object (may be null)
//   token.loc           — { r: row, c: col, n: length }
//   token.spaced        — true if preceded by whitespace (sugar for .pre > 0)
//   token.newLine       — true if preceded by a newline
//
// Identifier suffixes:
//   !  — dammit operator: fetch!() → await fetch()
//   ?  — predicate:       empty?  → isEmpty (returns boolean convention)
//
// The 9 tokenizer methods (in priority order):
//   1. identifier  — variables, keywords, properties, ! and ? suffixes
//   2. comment     — # line and ### block comments
//   3. whitespace  — spaces/tabs between tokens on a line
//   4. line        — newlines (records .pre for next line)
//   5. string      — '  "  '''  """  (with interpolation)
//   6. number      — decimal, hex, octal, binary, bigint
//   7. regex       — /pattern/flags and ///heregex///flags
//   8. js          — `embedded javascript`
//   9. literal     — operators, punctuation, everything else
//
// ==========================================================================

// ==========================================================================
// Token Category Sets
// ==========================================================================

// Keywords shared with JavaScript
let JS_KEYWORDS = new Set([
  'true', 'false', 'null', 'this',
  'new', 'delete', 'typeof', 'in', 'instanceof',
  'return', 'throw', 'break', 'continue', 'debugger',
  'yield', 'await',
  'if', 'else', 'switch', 'for', 'while', 'do',
  'try', 'catch', 'finally',
  'class', 'extends', 'super',
  'import', 'export', 'default',
]);

// Rip-only keywords
let RIP_KEYWORDS = new Set([
  'undefined', 'Infinity', 'NaN',
  'then', 'unless', 'until', 'loop', 'of', 'by', 'when', 'def',
]);

// Rip aliases: word → operator/value
let ALIASES = {
  and:  '&&',
  or:   '||',
  is:   '==',
  isnt: '!=',
  not:  '!',
  yes:  'true',
  no:   'false',
  on:   'true',
  off:  'false',
};

let ALIAS_WORDS = new Set(Object.keys(ALIASES));

// Reserved words — cannot be used as identifiers
let RESERVED = new Set([
  'case', 'function', 'var', 'void', 'with', 'const', 'let',
  'enum', 'native', 'implements', 'interface', 'package',
  'private', 'protected', 'public', 'static',
]);

// Words that become STATEMENT tokens
let STATEMENTS = new Set(['break', 'continue', 'debugger']);

// Words that become UNARY tokens
let UNARY_WORDS = new Set(['NEW', 'TYPEOF', 'DELETE']);

// Relation keywords (in, of, instanceof)
let RELATIONS = new Set(['IN', 'OF', 'INSTANCEOF']);

// Tokens that can precede a function call (implicit call detection)
let CALLABLE = new Set([
  'IDENTIFIER', 'PROPERTY', ')', ']', '@', 'THIS', 'SUPER',
  'DYNAMIC_IMPORT', '?.',
]);

// Tokens that can be indexed
let INDEXABLE = new Set([
  ...CALLABLE,
  'NUMBER', 'INFINITY', 'NAN', 'STRING', 'STRING_END',
  'REGEX', 'REGEX_END', 'BOOL', 'NULL', 'UNDEFINED', '}',
]);

// Tokens that can follow IMPLICIT_FUNC to start an implicit call
let IMPLICIT_CALL = new Set([
  'IDENTIFIER', 'PROPERTY', 'NUMBER', 'INFINITY', 'NAN',
  'STRING', 'STRING_START', 'REGEX', 'REGEX_START', 'JS',
  'NEW', 'PARAM_START', 'CLASS', 'IF', 'TRY', 'SWITCH',
  'THIS', 'DYNAMIC_IMPORT', 'IMPORT_META', 'NEW_TARGET',
  'UNDEFINED', 'NULL', 'BOOL', 'UNARY', 'DO', 'DO_IIFE',
  'YIELD', 'AWAIT', 'UNARY_MATH', 'SUPER', 'THROW',
  '@', '->', '=>', '[', '(', '{', '--', '++',
]);

// Tokens that can start an implicit call (unspaced, like +/-)
let IMPLICIT_UNSPACED_CALL = new Set(['+', '-']);

// Tokens that end an implicit call
let IMPLICIT_END = new Set([
  'POST_IF', 'POST_UNLESS', 'FOR', 'WHILE', 'UNTIL',
  'WHEN', 'BY', 'LOOP', 'TERMINATOR', '||', '&&',
]);

// Tokens that trigger implicit comma insertion before arrows
let IMPLICIT_COMMA_BEFORE_ARROW = new Set([
  'STRING', 'STRING_END', 'REGEX', 'REGEX_END', 'NUMBER',
  'BOOL', 'NULL', 'UNDEFINED', 'INFINITY', 'NAN', ']', '}',
]);

// Tokens that start/end balanced pairs
let EXPRESSION_START = new Set(['(', '[', '{', 'INDENT', 'CALL_START', 'PARAM_START', 'INDEX_START', 'STRING_START', 'INTERPOLATION_START', 'REGEX_START']);
let EXPRESSION_END   = new Set([')', ']', '}', 'OUTDENT', 'CALL_END', 'PARAM_END', 'INDEX_END', 'STRING_END', 'INTERPOLATION_END', 'REGEX_END']);

// Balanced pair inverses
let INVERSES = {
  '(': ')', ')': '(',
  '[': ']', ']': '[',
  '{': '}', '}': '{',
  'INDENT': 'OUTDENT', 'OUTDENT': 'INDENT',
  'CALL_START': 'CALL_END', 'CALL_END': 'CALL_START',
  'PARAM_START': 'PARAM_END', 'PARAM_END': 'PARAM_START',
  'INDEX_START': 'INDEX_END', 'INDEX_END': 'INDEX_START',
  'STRING_START': 'STRING_END', 'STRING_END': 'STRING_START',
  'INTERPOLATION_START': 'INTERPOLATION_END', 'INTERPOLATION_END': 'INTERPOLATION_START',
  'REGEX_START': 'REGEX_END', 'REGEX_END': 'REGEX_START',
};

// Tokens that close a clause (for normalizeLines)
let EXPRESSION_CLOSE = new Set(['CATCH', 'THEN', 'ELSE', 'FINALLY', ...EXPRESSION_END]);

// Tokens that act as implicit function call starters
let IMPLICIT_FUNC = new Set([
  'IDENTIFIER', 'PROPERTY', 'SUPER', ')', 'CALL_END', ']', 'INDEX_END', '@', 'THIS',
]);

// Control flow tokens that don't end implicit calls/objects
let CONTROL_IN_IMPLICIT = new Set(['IF', 'TRY', 'FINALLY', 'CATCH', 'CLASS', 'SWITCH']);

// Single-liner keywords that get implicit INDENT/OUTDENT
let SINGLE_LINERS = new Set(['ELSE', '->', '=>', 'TRY', 'FINALLY', 'THEN']);

// Tokens that close a single-liner
let SINGLE_CLOSERS = new Set(['TERMINATOR', 'CATCH', 'FINALLY', 'ELSE', 'OUTDENT', 'LEADING_WHEN']);

// Tokens that indicate end-of-line
let LINE_BREAK = new Set(['INDENT', 'OUTDENT', 'TERMINATOR']);

// Tokens that close implicit calls when following a newline
let CALL_CLOSERS = new Set(['.', '?.']);

// Tokens that suppress a following TERMINATOR/INDENT
let UNFINISHED = new Set([
  '\\', '.', '?.', 'UNARY', 'DO', 'DO_IIFE',
  'MATH', 'UNARY_MATH', '+', '-', '**', 'SHIFT', 'RELATION',
  'COMPARE', '&', '^', '|', '&&', '||', 'SPACE?', 'EXTENDS',
]);

// Tokens that are not followed by regex (division context)
let NOT_REGEX = new Set([...INDEXABLE, '++', '--']);

// Compound assignment operators
let COMPOUND_ASSIGN = new Set([
  '-=', '+=', '/=', '*=', '%=', '||=', '&&=', '?=', '??=',
  '<<=', '>>=', '>>>=', '&=', '^=', '|=', '**=', '//=', '%%=',
]);

// Math operators
let MATH = new Set(['*', '/', '%', '//', '%%']);

// Comparison operators
let COMPARE = new Set(['==', '!=', '===', '!==', '<', '>', '<=', '>=', '=~']);

// Shift operators
let SHIFT = new Set(['<<', '>>', '>>>']);

// Unary non-word operators
let UNARY_MATH = new Set(['!', '~']);

// ==========================================================================
// Regex Patterns
// ==========================================================================

// Identifier: word chars + optional trailing ! (await) or ? (predicate)
// The ? suffix is only captured when NOT followed by . ? [ ( to avoid
// conflict with ?. (optional chaining), ?? (nullish), ?.( and ?.[
let IDENTIFIER_RE = /^(?!\d)((?:(?!\s)[$\w\x7f-\uffff])+(?:!|[?](?![.?[(]))?)([^\n\S]*:(?![=:]))?/;
let NUMBER_RE     = /^0b[01](?:_?[01])*n?|^0o[0-7](?:_?[0-7])*n?|^0x[\da-f](?:_?[\da-f])*n?|^\d+(?:_\d+)*n|^(?:\d+(?:_\d+)*)?\.?\d+(?:_\d+)*(?:e[+-]?\d+(?:_\d+)*)?/i;
let OPERATOR_RE   = /^(?:<=>|[-=]>|~>|~=|:=|=!|===|!==|!\?|\?\?|=~|[-+*\/%<>&|^!?=]=|>>>=?|([-+:])\1|([&|<>*\/%])\2=?|\?\.?|\.{2,3})/;
let WHITESPACE_RE = /^[^\n\S]+/;
let NEWLINE_RE    = /^(?:\n[^\n\S]*)+/;
let COMMENT_RE    = /^(\s*)###([^#][\s\S]*?)(?:###([^\n\S]*)|###$)|^((?:\s*#(?!##[^#]).*)+)/;
let CODE_RE       = /^[-=]>/;
let REACTIVE_RE   = /^(?:~[=>]|=!)/;
let STRING_START_RE   = /^(?:'''|"""|'|")/;
let STRING_SINGLE_RE  = /^(?:[^\\']|\\[\s\S])*/;
let STRING_DOUBLE_RE  = /^(?:[^\\"#$]|\\[\s\S]|\#(?!\{)|\$(?!\{))*/;
let HEREDOC_SINGLE_RE = /^(?:[^\\']|\\[\s\S]|'(?!''))*/;
let HEREDOC_DOUBLE_RE = /^(?:[^\\"#$]|\\[\s\S]|"(?!"")|\#(?!\{)|\$(?!\{))*/;
let HEREDOC_INDENT_RE = /\n+([^\n\S]*)(?=\S)/g;
let REGEX_RE      = /^\/(?!\/)((?:[^[\/\n\\]|\\[^\n]|\[(?:\\[^\n]|[^\]\n\\])*\])*)(\/)?/;
let REGEX_FLAGS_RE = /^\w*/;
let VALID_FLAGS_RE = /^(?!.*(.).*\1)[gimsuy]*$/;
let HEREGEX_RE    = /^(?:[^\\\/#\s]|\\[\s\S]|\/(?!\/\/)|\#(?!\{)|\s+(?:#(?!\{).*)?)*/;
let JSTOKEN_RE    = /^`(?!``)((?:[^`\\]|\\[\s\S])*)`/;
let HERE_JSTOKEN_RE = /^```((?:[^`\\]|\\[\s\S]|`(?!``))*)```/;
let TRAILING_SPACES_RE = /\s+$/;
let LINE_CONTINUER_RE  = /^\s*(?:,|\??\.(?![.\d]))/;
let BOM = 65279;

// ==========================================================================
// Helpers
// ==========================================================================

// Create a token: [tag, val] with .pre, .data, .loc, .spaced, .newLine
function tok(tag, val, {pre = 0, row = 0, col = 0, len = 0, data = null} = {}) {
  let t = [tag, val];
  t.pre     = pre;
  t.data    = data;
  t.loc     = {r: row, c: col, n: len};
  t.spaced  = pre > 0;
  t.newLine = false;
  return t;
}

// Create a generated token (for rewriter insertions)
function gen(tag, val, origin) {
  let t = tok(tag, val);
  t.generated = true;
  if (origin) t.origin = origin;
  return t;
}

// Throw a syntax error with location info
function syntaxError(message, {row = 0, col = 0, len = 1} = {}) {
  let err = new SyntaxError(message);
  err.location = {first_line: row, first_column: col, last_column: col + len - 1};
  throw err;
}

// Parse a number literal to its numeric value
function parseNumber(str) {
  if (str == null) return NaN;
  switch (str.charAt(1)) {
    case 'b': return parseInt(str.slice(2).replace(/_/g, ''), 2);
    case 'o': return parseInt(str.slice(2).replace(/_/g, ''), 8);
    case 'x': return parseInt(str.slice(2).replace(/_/g, ''), 16);
    default:  return parseFloat(str.replace(/_/g, ''));
  }
}

// ==========================================================================
// Lexer
// ==========================================================================

export class Lexer {

  // --------------------------------------------------------------------------
  // Main entry point
  // --------------------------------------------------------------------------

  tokenize(code, opts = {}) {
    this.code    = code;
    this.tokens  = [];
    this.ends    = [];       // Balanced pair stack
    this.chunk   = '';       // Remaining source
    this.pos     = 0;        // Current position in source
    this.row     = opts.row  || 0;
    this.col     = opts.col  || 0;
    this.indent  = 0;        // Current indentation level (derived from .pre)
    this.indents = [];       // Indent stack for INDENT/OUTDENT
    this.seenFor    = false;
    this.seenImport = false;
    this.seenExport = false;
    this.importSpecifierList = false;
    this.exportSpecifierList = false;

    // Clean source
    code = this.clean(code);
    this.code = code;

    // Main tokenization loop
    while (this.pos < code.length) {
      this.chunk = code.slice(this.pos);
      let consumed =
        this.identifierToken() ||
        this.commentToken()    ||
        this.whitespaceToken() ||
        this.lineToken()       ||
        this.stringToken()     ||
        this.numberToken()     ||
        this.regexToken()      ||
        this.jsToken()         ||
        this.literalToken();

      if (consumed === 0) {
        syntaxError(`unexpected character: ${this.chunk.charAt(0)}`, {
          row: this.row, col: this.col,
        });
      }

      this.advance(consumed);

      // Support untilBalanced mode (for string interpolation sub-lexing)
      if (opts.untilBalanced && this.ends.length === 0) {
        return { tokens: this.tokens, index: this.pos };
      }
    }

    // Close any remaining indentation
    this.closeIndentation();

    // Check for unclosed pairs
    if (this.ends.length > 0) {
      let unclosed = this.ends[this.ends.length - 1];
      syntaxError(`missing ${unclosed.tag}`, {row: this.row, col: this.col});
    }

    // Rewrite (unless disabled)
    if (opts.rewrite === false) return this.tokens;
    return this.rewrite(this.tokens);
  }

  // --------------------------------------------------------------------------
  // Source preprocessing
  // --------------------------------------------------------------------------

  clean(code) {
    // Strip BOM
    if (code.charCodeAt(0) === BOM) code = code.slice(1);
    // Normalize line endings
    code = code.replace(/\r\n?/g, '\n');
    // Strip trailing whitespace
    code = code.replace(TRAILING_SPACES_RE, '');
    // Ensure leading newline if code starts with whitespace
    if (/^[^\n\S]/.test(code)) code = '\n' + code;
    return code;
  }

  // --------------------------------------------------------------------------
  // Position tracking
  // --------------------------------------------------------------------------

  advance(n) {
    let consumed = this.code.slice(this.pos, this.pos + n);
    for (let i = 0; i < consumed.length; i++) {
      if (consumed[i] === '\n') {
        this.row++;
        this.col = 0;
      } else {
        this.col++;
      }
    }
    this.pos += n;
  }

  // --------------------------------------------------------------------------
  // Token helpers
  // --------------------------------------------------------------------------

  // Push a token onto the stream
  emit(tag, val, {len, data, pre} = {}) {
    let t = tok(tag, val, {
      pre:  pre ?? 0,
      row:  this.row,
      col:  this.col,
      len:  len ?? (typeof val === 'string' ? val.length : 0),
      data: data,
    });
    this.tokens.push(t);
    return t;
  }

  // Get the previous token (or undefined)
  prev() {
    return this.tokens[this.tokens.length - 1];
  }

  // Get the previous token's tag
  prevTag() {
    let p = this.prev();
    return p ? p[0] : undefined;
  }

  // Get the previous token's value
  prevVal() {
    let p = this.prev();
    return p ? p[1] : undefined;
  }

  // --------------------------------------------------------------------------
  // 1. Identifier Token
  // --------------------------------------------------------------------------
  //
  // Handles: variables, keywords, properties, aliases
  //
  // Suffix operators on identifiers:
  //   !  → dammit operator (await): fetch!() → await fetch()
  //   ?  → predicate (boolean):     empty?   → isEmpty
  //
  // The ? suffix is captured by IDENTIFIER_RE only when NOT followed by
  // . ? [ ( — so x?.y (optional chaining) and x?? (nullish coalescing)
  // are never ambiguous.
  //
  // --------------------------------------------------------------------------

  identifierToken() {
    // Reactive operators — let literalToken handle these
    if (REACTIVE_RE.test(this.chunk)) return 0;

    let match = IDENTIFIER_RE.exec(this.chunk);
    if (!match) return 0;

    let [input, id, colon] = match;
    let idLen = id.length;
    let data = {};
    let tag;

    // --- Contextual keyword handling ---

    // 'own' after FOR
    if (id === 'own' && this.prevTag() === 'FOR') {
      this.emit('OWN', id, {len: idLen});
      return idLen;
    }

    // 'from' after YIELD
    if (id === 'from' && this.prevTag() === 'YIELD') {
      this.emit('FROM', id, {len: idLen});
      return idLen;
    }

    // 'as' in import/export context (not in for-loop context)
    if (id === 'as' && !this.seenFor && (this.seenImport || this.seenExport)) {
      if (this.seenImport) {
        if (this.prevVal() === '*') this.prev()[0] = 'IMPORT_ALL';
      }
      let pt = this.prevTag();
      if (pt === 'DEFAULT' || pt === 'IMPORT_ALL' || pt === 'IDENTIFIER') {
        this.emit('AS', id, {len: idLen});
        return idLen;
      }
    }

    // 'as' in for loops → FORAS (for x as iterable — ES6 for-of iteration)
    // 'as!' in for loops → FORASAWAIT (for x as! iterable — async iteration shorthand)
    if ((id === 'as' || id === 'as!') && this.seenFor) {
      this.seenFor = false;
      this.emit(id === 'as!' ? 'FORASAWAIT' : 'FORAS', 'as', {len: idLen});
      return idLen;
    }

    // 'default' in export
    if (id === 'default' && this.seenExport && (this.prevTag() === 'EXPORT' || this.prevTag() === 'AS')) {
      this.emit('DEFAULT', id, {len: idLen});
      return idLen;
    }

    // 'do super' shorthand
    if (id === 'do' && /^(\s*super)(?!\(\))/.test(this.chunk.slice(3))) {
      let m = /^(\s*super)(?!\(\))/.exec(this.chunk.slice(3));
      this.emit('SUPER', 'super');
      this.emit('CALL_START', '(');
      this.emit('CALL_END', ')');
      return m[1].length + 3;
    }

    // --- Determine tag ---

    let prev = this.prev();

    // Don't treat colon as property when in ternary context
    if (colon && prev && prev[0] === 'SPACE?') colon = null;

    // Property vs identifier
    if (colon || (prev && (prev[0] === '.' || prev[0] === '?.' || (!prev.spaced && prev[0] === '@')))) {
      tag = 'PROPERTY';
    } else {
      tag = 'IDENTIFIER';
    }

    // Keyword classification (skip for words with ! or ? suffix)
    let baseId = id.endsWith('!') || id.endsWith('?') ? id.slice(0, -1) : id;
    if (tag === 'IDENTIFIER' && !id.endsWith('!') && !id.endsWith('?') &&
        (JS_KEYWORDS.has(id) || RIP_KEYWORDS.has(id) || ALIAS_WORDS.has(id)) &&
        !(this.exportSpecifierList && ALIAS_WORDS.has(id))) {

      // Apply aliases
      if (ALIASES[id] !== undefined) {
        data.original = id;
        id = ALIASES[id];
      }

      // Map aliased values to their token types
      tag = this.classifyKeyword(id, tag, data);
    }

    // Reserved words (check the base form, not the suffixed form)
    if (tag === 'IDENTIFIER' && RESERVED.has(baseId)) {
      syntaxError(`reserved word '${baseId}'`, {row: this.row, col: this.col, len: idLen});
    }

    // Property-specific checks (new.target, import.meta)
    if (tag === 'PROPERTY' && prev) {
      if (prev[0] === '.' && this.tokens.length > 1) {
        let pp = this.tokens[this.tokens.length - 2];
        if (pp[0] === 'UNARY' && pp[1] === 'new') pp[0] = 'NEW_TARGET';
        if (pp[0] === 'IMPORT' && pp[1] === 'import') {
          this.seenImport = false;
          pp[0] = 'IMPORT_META';
        }
      }
    }

    // --- Dammit operator: trailing ! → await ---
    if (id.length > 1 && id.endsWith('!')) {
      data.await = true;
      id = id.slice(0, -1);
    }

    // --- Predicate operator: trailing ? → boolean convention ---
    // empty? → isEmpty, active? → isActive, valid? → isValid
    if (id.length > 1 && id.endsWith('?')) {
      data.predicate = true;
      id = id.slice(0, -1);
    }

    // --- Emit ---
    let t = this.emit(tag, id, {len: idLen, data: Object.keys(data).length ? data : null});

    if (colon) {
      this.emit(':', ':', {len: 1});
      return idLen + colon.length;
    }

    return idLen;
  }

  // Classify a keyword/alias into its token tag
  classifyKeyword(id, fallback, data) {
    switch (id) {
      case '!':            return 'UNARY';
      case '==': case '!=': return 'COMPARE';
      case 'true': case 'false': return 'BOOL';
      case '&&': case '||': return id;
    }
    if (STATEMENTS.has(id)) return 'STATEMENT';

    // Uppercase keyword mapping
    let upper = id.toUpperCase();
    if (upper === 'WHEN' && LINE_BREAK.has(this.prevTag())) return 'LEADING_WHEN';
    if (upper === 'FOR') { this.seenFor = {endsLength: this.ends.length}; return 'FOR'; }
    if (upper === 'UNLESS') return 'UNLESS';
    if (upper === 'IMPORT') { this.seenImport = true; return 'IMPORT'; }
    if (upper === 'EXPORT') { this.seenExport = true; return 'EXPORT'; }
    if (UNARY_WORDS.has(upper)) return 'UNARY';

    if (RELATIONS.has(upper)) {
      if (upper !== 'INSTANCEOF' && this.seenFor) {
        this.seenFor = false;
        return 'FOR' + upper;
      }
      // Handle 'not in', 'not of', 'not instanceof' — pop the '!' and record inversion
      if (this.prevVal() === '!') {
        let popped = this.tokens.pop();
        data.invert = popped.data?.original || popped[1];
      }
      return 'RELATION';
    }

    // If it's a known JS/Rip keyword, uppercase it
    if (JS_KEYWORDS.has(id) || RIP_KEYWORDS.has(id)) return upper;

    return fallback;
  }

  // --------------------------------------------------------------------------
  // 2. Comment Token
  // --------------------------------------------------------------------------

  commentToken() {
    let match = COMMENT_RE.exec(this.chunk);
    if (!match) return 0;
    // For now, consume the comment and discard it
    // TODO: attach comments to adjacent tokens for source map support
    return match[0].length;
  }

  // --------------------------------------------------------------------------
  // 3. Whitespace Token
  // --------------------------------------------------------------------------

  whitespaceToken() {
    let match = WHITESPACE_RE.exec(this.chunk);
    if (!match && this.chunk[0] !== '\n') return 0;

    let prev = this.prev();
    if (prev) {
      if (match) {
        prev.spaced = true;
        prev.pre = match[0].length;
      } else {
        prev.newLine = true;
      }
    }

    return match ? match[0].length : 0;
  }

  // --------------------------------------------------------------------------
  // 4. Line Token (newlines and indentation)
  // --------------------------------------------------------------------------

  lineToken() {
    let match = NEWLINE_RE.exec(this.chunk);
    if (!match) return 0;

    let indent = match[0];
    let size = indent.length - 1 - indent.lastIndexOf('\n');

    // If we're in an unfinished expression, suppress the newline
    if (this.isUnfinished()) {
      // Exception: comma at a lower indent continues the outer call, not the block
      if (size < this.indent && /^\s*,/.test(this.chunk) && !UNFINISHED.has(this.prevTag())) {
        this.outdentTo(size, indent.length);
        if (this.prevTag() === 'TERMINATOR') this.tokens.pop();
        return indent.length;
      }
      return indent.length;
    }

    // Reset for-loop state on newlines (unless inside brackets)
    if (this.seenFor && !(this.seenFor.endsLength < this.ends.length)) {
      this.seenFor = false;
    }
    if (!this.importSpecifierList) this.seenImport = false;
    if (!this.exportSpecifierList) this.seenExport = false;

    // Same indentation → emit TERMINATOR
    if (size === this.indent) {
      this.emitNewline();
      return indent.length;
    }

    // Increased indentation → emit INDENT
    if (size > this.indent) {
      if (!this.tokens.length) {
        // First line — set base indent
        this.indent = size;
        return indent.length;
      }
      let diff = size - this.indent;
      this.emit('INDENT', diff, {len: size});
      this.indents.push(diff);
      this.ends.push({tag: 'OUTDENT'});
      this.indent = size;
      return indent.length;
    }

    // Decreased indentation → emit OUTDENT(s)
    this.outdentTo(size, indent.length);
    return indent.length;
  }

  // Emit OUTDENT tokens to reach target indent level
  outdentTo(targetSize, outdentLength = 0) {
    let moveOut = this.indent - targetSize;
    while (moveOut > 0) {
      let lastIndent = this.indents[this.indents.length - 1];
      if (!lastIndent) {
        moveOut = 0;
      } else {
        this.indents.pop();
        this.pair('OUTDENT');
        this.emit('OUTDENT', moveOut, {len: outdentLength});
        moveOut -= lastIndent;
      }
    }
    this.emitNewline();
    this.indent = targetSize;
  }

  // Close all remaining indentation at end of file
  closeIndentation() {
    this.outdentTo(0);
  }

  // Emit a TERMINATOR if one isn't already there
  emitNewline() {
    if (this.prevTag() !== 'TERMINATOR') {
      this.emit('TERMINATOR', '\n', {len: 0});
    }
  }

  // Check if the current line is unfinished (continuation)
  isUnfinished() {
    return LINE_CONTINUER_RE.test(this.chunk) || UNFINISHED.has(this.prevTag());
  }

  // Match balanced pairs
  pair(tag) {
    let expected = this.ends[this.ends.length - 1];
    if (!expected || tag !== expected.tag) {
      if (expected?.tag === 'OUTDENT') {
        // Auto-close INDENT
        let lastIndent = this.indents[this.indents.length - 1];
        if (lastIndent) {
          this.outdentTo(this.indent - lastIndent);
        }
        return this.pair(tag);
      }
      syntaxError(`unmatched ${tag}`, {row: this.row, col: this.col});
    }
    return this.ends.pop();
  }

  // --------------------------------------------------------------------------
  // 5. String Token
  // --------------------------------------------------------------------------

  stringToken() {
    let m = STRING_START_RE.exec(this.chunk);
    if (!m) return 0;

    let quote = m[0];
    let prev = this.prev();

    // Tag 'from' in import/export context
    if (prev && this.prevVal() === 'from' && (this.seenImport || this.seenExport)) {
      prev[0] = 'FROM';
    }

    let regex;
    switch (quote) {
      case "'":   regex = STRING_SINGLE_RE; break;
      case '"':   regex = STRING_DOUBLE_RE; break;
      case "'''": regex = HEREDOC_SINGLE_RE; break;
      case '"""': regex = HEREDOC_DOUBLE_RE; break;
    }

    let {tokens: parts, index: end} = this.matchWithInterpolations(regex, quote);
    let heredoc = quote.length === 3;

    // Heredoc indent processing
    let indent = null;
    if (heredoc) {
      indent = this.processHeredocIndent(end, quote, parts);
    }

    // Merge interpolation tokens into the stream
    this.mergeInterpolationTokens(parts, {quote, indent, endOffset: end});

    return end;
  }

  // Process heredoc indentation based on closing delimiter position
  processHeredocIndent(end, quote, tokens) {
    // Find closing delimiter column
    let closingPos = end - quote.length;
    let lineStart = closingPos - 1;
    while (lineStart >= 0 && this.chunk[lineStart] !== '\n') lineStart--;
    lineStart++;

    let beforeClosing = this.chunk.slice(lineStart, closingPos);
    let closingColumn = /^\s*$/.test(beforeClosing) ? beforeClosing.length : null;

    // Get content for minimum indent analysis
    let doc = '';
    for (let t of tokens) {
      if (t[0] === 'NEOSTRING') doc += t[1];
    }

    // Find minimum indent in content
    let minIndent = null;
    let m;
    HEREDOC_INDENT_RE.lastIndex = 0;
    while (m = HEREDOC_INDENT_RE.exec(doc)) {
      if (minIndent === null || (m[1].length > 0 && m[1].length < minIndent.length)) {
        minIndent = m[1];
      }
    }

    // Choose indent baseline
    if (closingColumn === null) return minIndent;
    if (minIndent === null) return ' '.repeat(closingColumn);
    if (closingColumn <= minIndent.length) return ' '.repeat(closingColumn);
    return minIndent;
  }

  // Match string/regex content with interpolation support
  matchWithInterpolations(regex, delimiter, closingDelimiter, interpolators) {
    if (!closingDelimiter) closingDelimiter = delimiter;
    if (!interpolators) interpolators = /^[#$]\{/;

    let tokens = [];
    let offset = delimiter.length;

    if (this.chunk.slice(0, offset) !== delimiter) return null;

    let str = this.chunk.slice(offset);

    while (true) {
      let [strPart] = regex.exec(str);

      tokens.push(['NEOSTRING', strPart, {offset}]);
      str = str.slice(strPart.length);
      offset += strPart.length;

      // Check for interpolation start
      let m = interpolators.exec(str);
      if (!m) break;

      let interpolator = m[0];
      let interpOffset = interpolator.length - 1;

      // Recursively lex the interpolated expression
      let rest = str.slice(interpOffset);
      let nested = new Lexer().tokenize(rest, {
        row:  this.row,
        col:  this.col + offset + interpOffset,
        untilBalanced: true,
        rewrite: false,
      });

      let index = nested.index + interpOffset;

      // Tag opening/closing as interpolation markers
      if (str[index - 1] === '}') {
        let open = nested.tokens[0];
        let close = nested.tokens[nested.tokens.length - 1];
        open[0] = 'INTERPOLATION_START';
        open[1] = '(';
        close[0] = 'INTERPOLATION_END';
        close[1] = ')';
      }

      // Clean up leading TERMINATOR and trailing INDENT/OUTDENT
      if (nested.tokens[1]?.[0] === 'TERMINATOR') nested.tokens.splice(1, 1);
      let ntl = nested.tokens.length;
      if (ntl > 2 && nested.tokens[ntl - 3]?.[0] === 'INDENT' && nested.tokens[ntl - 2]?.[0] === 'OUTDENT') {
        nested.tokens.splice(ntl - 3, 2);
      }

      tokens.push(['TOKENS', nested.tokens]);
      str = str.slice(index);
      offset += index;
    }

    if (str.slice(0, closingDelimiter.length) !== closingDelimiter) {
      syntaxError(`missing ${closingDelimiter}`, {row: this.row, col: this.col});
    }

    return { tokens, index: offset + closingDelimiter.length };
  }

  // Merge NEOSTRING/TOKENS into the real token stream
  mergeInterpolationTokens(tokens, {quote, indent, endOffset}) {
    if (tokens.length > 1) {
      this.emit('STRING_START', '(', {len: quote?.length || 0, data: {quote}});
    }

    for (let i = 0; i < tokens.length; i++) {
      let [tag, val] = tokens[i];

      if (tag === 'TOKENS') {
        for (let nested of val) this.tokens.push(nested);
      } else if (tag === 'NEOSTRING') {
        let processed = val;

        // Strip heredoc indent
        if (indent) {
          let indentRe = new RegExp('\\n' + indent, 'g');
          processed = processed.replace(indentRe, '\n');
        }

        // Strip leading newline for heredocs
        if (i === 0 && quote?.length === 3) {
          processed = processed.replace(/^\n/, '');
        }

        // Strip trailing newline for heredocs
        if (i === tokens.length - 1 && quote?.length === 3) {
          processed = processed.replace(/\n[^\S\n]*$/, '');
        }

        this.emit('STRING', `"${processed}"`, {len: val.length, data: {quote}});
      }
    }

    if (tokens.length > 1) {
      this.emit('STRING_END', ')', {len: quote?.length || 0});
    }

    return endOffset;
  }

  // --------------------------------------------------------------------------
  // 6. Number Token
  // --------------------------------------------------------------------------

  numberToken() {
    let match = NUMBER_RE.exec(this.chunk);
    if (!match) return 0;

    let number = match[0];
    let len = number.length;

    // Validate
    let loc = {row: this.row, col: this.col};

    if (/^0[BOX]/.test(number)) {
      syntaxError(`radix prefix in '${number}' must be lowercase`, {...loc, col: loc.col + 1});
    }
    if (/^0\d*[89]/.test(number)) {
      syntaxError(`decimal literal '${number}' must not be prefixed with '0'`, {...loc, len});
    }
    if (/^0\d+/.test(number)) {
      syntaxError(`octal literal '${number}' must be prefixed with '0o'`, {...loc, len});
    }

    let parsed = parseNumber(number);
    let tag = parsed === Infinity ? 'INFINITY' : 'NUMBER';
    let data = {parsedValue: parsed};
    if (tag === 'INFINITY') data.original = number;

    this.emit(tag, number, {len, data});
    return len;
  }

  // --------------------------------------------------------------------------
  // 7. Regex Token
  // --------------------------------------------------------------------------

  regexToken() {
    // Try heregex first (///)
    let hm = this.matchWithInterpolations(HEREGEX_RE, '///');
    if (hm) {
      let {tokens: parts, index} = hm;
      let [flags] = REGEX_FLAGS_RE.exec(this.chunk.slice(index));
      let end = index + flags.length;

      if (parts.length === 1 || !parts.some(p => p[0] === 'TOKENS')) {
        // Simple heregex (no interpolations)
        let body = parts[0]?.[1] || '';
        this.emit('REGEX', `/${body}/${flags}`, {len: end, data: {delimiter: '///', heregex: {flags}}});
      } else {
        // Complex heregex with interpolations
        this.emit('REGEX_START', '(', {len: 0});
        this.emit('IDENTIFIER', 'RegExp', {len: 0});
        this.emit('CALL_START', '(', {len: 0});
        this.mergeInterpolationTokens(parts, {quote: '///', endOffset: end - flags.length});
        if (flags) {
          this.emit(',', ',', {len: 0});
          this.emit('STRING', `"${flags}"`, {len: flags.length});
        }
        this.emit(')', ')', {len: 0});
        this.emit('REGEX_END', ')', {len: 0});
      }
      return end;
    }

    // Try simple regex
    let match = REGEX_RE.exec(this.chunk);
    if (!match) return 0;

    let [regex, body, closed] = match;
    let prev = this.prev();

    // Division disambiguation
    if (prev) {
      if (prev.spaced && CALLABLE.has(prev[0]) && (!closed || /^\/=?\s/.test(regex))) return 0;
      if (NOT_REGEX.has(prev[0]) && !(prev.spaced && CALLABLE.has(prev[0]))) return 0;
    }

    if (!closed) syntaxError('missing / (unclosed regex)', {row: this.row, col: this.col});

    let index = regex.length;
    let [flags] = REGEX_FLAGS_RE.exec(this.chunk.slice(index));
    let end = index + flags.length;

    if (!VALID_FLAGS_RE.test(flags)) {
      syntaxError(`invalid regular expression flags ${flags}`, {row: this.row, col: this.col + index, len: flags.length});
    }

    this.emit('REGEX', `/${body}/${flags}`, {len: end, data: {delimiter: '/'}});
    return end;
  }

  // --------------------------------------------------------------------------
  // 8. JS Token (embedded JavaScript)
  // --------------------------------------------------------------------------

  jsToken() {
    if (this.chunk[0] !== '`') return 0;

    let match = HERE_JSTOKEN_RE.exec(this.chunk) || JSTOKEN_RE.exec(this.chunk);
    if (!match) return 0;

    let script = match[1];
    let len = match[0].length;
    this.emit('JS', script, {len, data: {here: match[0].startsWith('```')}});
    return len;
  }

  // --------------------------------------------------------------------------
  // 9. Literal Token (operators, punctuation, everything else)
  // --------------------------------------------------------------------------

  literalToken() {
    let match = OPERATOR_RE.exec(this.chunk);
    let val = match ? match[0] : this.chunk.charAt(0);
    let tag = val;
    let prev = this.prev();

    // Arrow functions → tag parameters
    if (CODE_RE.test(val)) this.tagParameters();

    // Compound assignment merging: ||= &&= ??=
    if (prev && (val === '=' || COMPOUND_ASSIGN.has(val))) {
      if (val === '=' && (prev[1] === '||' || prev[1] === '&&' || prev[1] === '??') && !prev.spaced) {
        prev[0] = 'COMPOUND_ASSIGN';
        prev[1] += '=';
        return val.length;
      }
    }

    // Dynamic import
    if (val === '(' && prev?.[0] === 'IMPORT') prev[0] = 'DYNAMIC_IMPORT';

    // Import/export specifier list tracking
    if (val === '{' && this.seenImport)         this.importSpecifierList = true;
    if (val === '}' && this.importSpecifierList) this.importSpecifierList = false;
    if (val === '{' && prev?.[0] === 'EXPORT')  this.exportSpecifierList = true;
    if (val === '}' && this.exportSpecifierList) this.exportSpecifierList = false;

    // Semicolons → TERMINATOR
    if (val === ';') {
      this.seenFor = this.seenImport = this.seenExport = false;
      tag = 'TERMINATOR';
    }
    // Reactive operators
    else if (val === '~=') tag = 'COMPUTED_ASSIGN';
    else if (val === ':=') tag = 'REACTIVE_ASSIGN';
    else if (val === '~>') tag = 'REACT_ASSIGN';
    else if (val === '=!') tag = 'READONLY_ASSIGN';
    // Export all
    else if (val === '*' && prev?.[0] === 'EXPORT') tag = 'EXPORT_ALL';
    // Operator classification
    else if (MATH.has(val))            tag = 'MATH';
    else if (COMPARE.has(val))         tag = 'COMPARE';
    else if (COMPOUND_ASSIGN.has(val)) tag = 'COMPOUND_ASSIGN';
    else if (UNARY_MATH.has(val))      tag = 'UNARY_MATH';
    else if (SHIFT.has(val))           tag = 'SHIFT';
    // Spaced ? → SPACE? (ternary)
    else if (val === '?' && prev?.spaced) tag = 'SPACE?';
    // ?[ and ?( without dot → treat as optional chaining (?.)
    else if (val === '?' && (this.chunk[1] === '[' || this.chunk[1] === '(')) tag = '?.';
    // Call/index context (ES6 optional chaining only)
    else if (prev) {
      if (val === '(' && !prev.spaced && CALLABLE.has(prev[0])) {
        if (prev[0] === '?.') prev[0] = 'ES6_OPTIONAL_CALL';
        tag = 'CALL_START';
      }
      if (val === '[' && !prev.spaced && INDEXABLE.has(prev[0])) {
        tag = 'INDEX_START';
        if (prev[0] === '?.') prev[0] = 'ES6_OPTIONAL_INDEX';
      }
    }

    // Balanced pair tracking
    if (val === '(' || val === '{' || val === '[') {
      this.ends.push({tag: INVERSES[val], origin: [tag, val]});
    } else if (val === ')' || val === '}' || val === ']') {
      this.pair(val);
    }

    this.emit(tag, val, {len: val.length});
    return val.length;
  }

  // Walk back to tag parameters for arrow functions
  tagParameters() {
    if (this.prevTag() !== ')') return this.tagDoIife();

    let i = this.tokens.length - 1;
    let stack = [];
    this.tokens[i][0] = 'PARAM_END';

    while (i-- > 0) {
      let tok = this.tokens[i];
      if (tok[0] === ')') {
        stack.push(tok);
      } else if (tok[0] === '(' || tok[0] === 'CALL_START') {
        if (stack.length) {
          stack.pop();
        } else if (tok[0] === '(') {
          tok[0] = 'PARAM_START';
          return this.tagDoIife(i - 1);
        } else {
          this.tokens[this.tokens.length - 1][0] = 'CALL_END';
          return;
        }
      }
    }
  }

  // Tag 'do' before function as DO_IIFE
  tagDoIife(index) {
    let t = this.tokens[index ?? this.tokens.length - 1];
    if (t?.[0] === 'DO') t[0] = 'DO_IIFE';
  }

  // ==========================================================================
  // Rewriter — 7 passes
  // ==========================================================================

  rewrite(tokens) {
    this.tokens = tokens;
    this.removeLeadingNewlines();
    this.closeOpenCalls();
    this.closeOpenIndexes();
    this.normalizeLines();
    this.tagPostfixConditionals();
    this.addImplicitBracesAndParens();
    this.addImplicitCallCommas();
    return this.tokens;
  }

  // --- Rewriter passes ---

  removeLeadingNewlines() {
    let i = 0;
    while (this.tokens[i]?.[0] === 'TERMINATOR') i++;
    if (i > 0) this.tokens.splice(0, i);
  }

  closeOpenCalls() {
    this.scanTokens((token, i) => {
      if (token[0] === 'CALL_START') {
        this.detectEnd(i + 1,
          t => t[0] === ')' || t[0] === 'CALL_END',
          t => t[0] = 'CALL_END'
        );
      }
      return 1;
    });
  }

  closeOpenIndexes() {
    this.scanTokens((token, i) => {
      if (token[0] === 'INDEX_START') {
        this.detectEnd(i + 1,
          t => t[0] === ']' || t[0] === 'INDEX_END',
          (t, idx) => {
            if (this.tokens[idx + 1]?.[0] === ':') {
              token[0] = '[';
              t[0] = ']';
            } else {
              t[0] = 'INDEX_END';
            }
          }
        );
      }
      return 1;
    });
  }

  normalizeLines() {
    let starter = null;
    let indent = null;
    let outdent = null;
    let condition = (token, i) => {
      return token[1] !== ';' && SINGLE_CLOSERS.has(token[0]) &&
        !(token[0] === 'TERMINATOR' && EXPRESSION_CLOSE.has(this.tokens[i + 1]?.[0])) &&
        !(token[0] === 'ELSE' && starter !== 'THEN') ||
        token[0] === ',' && (starter === '->' || starter === '=>') && !this.commaInImplicitCall(i) ||
        CALL_CLOSERS.has(token[0]) && (this.tokens[i - 1]?.newLine || this.tokens[i - 1]?.[0] === 'OUTDENT');
    };

    let action = (token, i) => {
      let idx = this.tokens[i - 1]?.[0] === ',' ? i - 1 : i;
      this.tokens.splice(idx, 0, outdent);
    };

    this.scanTokens((token, i, tokens) => {
      let [tag] = token;

      if (tag === 'TERMINATOR') {
        if (this.tokens[i + 1]?.[0] === 'ELSE' && this.tokens[i - 1]?.[0] !== 'OUTDENT') {
          tokens.splice(i, 1, ...this.makeIndentation());
          return 1;
        }
        if (EXPRESSION_CLOSE.has(this.tokens[i + 1]?.[0])) {
          tokens.splice(i, 1);
          return 0;
        }
      }

      if (tag === 'CATCH') {
        for (let j = 1; j <= 2; j++) {
          let nextTag = this.tokens[i + j]?.[0];
          if (nextTag === 'OUTDENT' || nextTag === 'TERMINATOR' || nextTag === 'FINALLY') {
            tokens.splice(i + j, 0, ...this.makeIndentation());
            return 2 + j;
          }
        }
      }

      if ((tag === '->' || tag === '=>') && (this.tokens[i + 1]?.[0] === ',' || this.tokens[i + 1]?.[0] === ']')) {
        [indent, outdent] = this.makeIndentation();
        tokens.splice(i + 1, 0, indent, outdent);
        return 1;
      }

      if (SINGLE_LINERS.has(tag) && this.tokens[i + 1]?.[0] !== 'INDENT' &&
          !(tag === 'ELSE' && this.tokens[i + 1]?.[0] === 'IF')) {
        starter = tag;
        [indent, outdent] = this.makeIndentation();
        if (tag === 'THEN') indent.fromThen = true;
        tokens.splice(i + 1, 0, indent);
        this.detectEnd(i + 2, condition, action);
        if (tag === 'THEN') tokens.splice(i, 1);
        return 1;
      }

      return 1;
    });
  }

  tagPostfixConditionals() {
    let original = null;

    let condition = (token, i) => {
      return token[0] === 'TERMINATOR' ||
        (token[0] === 'INDENT' && !SINGLE_LINERS.has(this.tokens[i - 1]?.[0]));
    };

    let action = (token) => {
      if (token[0] !== 'INDENT' || (token.generated && !token.fromThen)) {
        original[0] = 'POST_' + original[0];
      }
    };

    this.scanTokens((token, i) => {
      if (token[0] !== 'IF' && token[0] !== 'UNLESS') return 1;
      original = token;
      this.detectEnd(i + 1, condition, action);
      return 1;
    });
  }

  addImplicitBracesAndParens() {
    let stack = [];
    let inTernary = false;

    this.scanTokens((token, i, tokens) => {
      let [tag] = token;
      let prevToken = tokens[i - 1] || [];
      let nextToken = tokens[i + 1] || [];
      let [prevTag] = prevToken;
      let [nextTag] = nextToken;
      let startIdx = i;

      let forward = (n) => i - startIdx + n;
      let stackTop = () => stack[stack.length - 1];
      let isImplicit = (s) => s?.[2]?.ours;
      let inImplicitCall = () => isImplicit(stackTop()) && stackTop()?.[0] === '(';
      let inImplicitObject = () => isImplicit(stackTop()) && stackTop()?.[0] === '{';

      let startImplicitCall = (idx) => {
        stack.push(['(', idx, {ours: true}]);
        tokens.splice(idx, 0, gen('CALL_START', '('));
      };

      let endImplicitCall = () => {
        stack.pop();
        tokens.splice(i, 0, gen('CALL_END', ')'));
        i += 1;
      };

      let startImplicitObject = (idx, opts = {}) => {
        stack.push(['{', idx, {sameLine: true, startsLine: opts.startsLine ?? true, ours: true}]);
        let t = gen('{', '{');
        if (!t.data) t.data = {};
        t.data.generated = true;
        tokens.splice(idx, 0, t);
      };

      let endImplicitObject = (j) => {
        j = j ?? i;
        stack.pop();
        tokens.splice(j, 0, gen('}', '}'));
        i += 1;
      };

      // Don't end implicit on INDENT for control flow inside implicit
      if ((inImplicitCall() || inImplicitObject()) && CONTROL_IN_IMPLICIT.has(tag)) {
        stack.push(['CONTROL', i, {ours: true}]);
        return forward(1);
      }

      // INDENT closes implicit call (usually)
      if (tag === 'INDENT' && isImplicit(stackTop())) {
        if (prevTag !== '=>' && prevTag !== '->' && prevTag !== '[' && prevTag !== '(' && prevTag !== ',' && prevTag !== '{' && prevTag !== 'ELSE' && prevTag !== '=') {
          while (inImplicitCall() || (inImplicitObject() && prevTag !== ':')) {
            if (inImplicitCall()) endImplicitCall();
            else endImplicitObject();
          }
        }
        if (stackTop()?.[2]?.ours && stackTop()[0] === 'CONTROL') stack.pop();
        stack.push([tag, i]);
        return forward(1);
      }

      // Explicit expression start
      if (EXPRESSION_START.has(tag)) {
        stack.push([tag, i]);
        return forward(1);
      }

      // Explicit expression end — close all implicit inside
      if (EXPRESSION_END.has(tag)) {
        while (isImplicit(stackTop())) {
          if (inImplicitCall()) endImplicitCall();
          else if (inImplicitObject()) endImplicitObject();
          else stack.pop();
        }
        stack.pop();
      }

      // Detect implicit function calls
      if (IMPLICIT_FUNC.has(tag) && token.spaced &&
          (IMPLICIT_CALL.has(nextTag) || (nextTag === '...' && IMPLICIT_CALL.has(tokens[i + 2]?.[0])) ||
           (IMPLICIT_UNSPACED_CALL.has(nextTag) && !nextToken.spaced && !nextToken.newLine)) &&
          !((tag === ']' || tag === '}') && (nextTag === '->' || nextTag === '=>'))) {
        startImplicitCall(i + 1);
        return forward(2);
      }

      // Detect implicit function call with indented object
      if (IMPLICIT_FUNC.has(tag) && this.tokens[i + 1]?.[0] === 'INDENT' &&
          this.looksObjectish(i + 2) &&
          !this.findTagsBackwards(i, ['CLASS', 'EXTENDS', 'IF', 'CATCH', 'SWITCH', 'LEADING_WHEN', 'FOR', 'WHILE', 'UNTIL'])) {
        startImplicitCall(i + 1);
        stack.push(['INDENT', i + 2]);
        return forward(3);
      }

      // Track ternary
      if (tag === 'SPACE?') inTernary = true;

      // Implicit objects start at ':'
      if (tag === ':') {
        if (inTernary) {
          inTernary = false;
          return forward(1);
        }

        // Find the start of this key
        let s = EXPRESSION_END.has(this.tokens[i - 1]?.[0]) ? stack[stack.length - 1]?.[1] ?? i - 1 : i - 1;
        if (this.tokens[i - 2]?.[0] === '@') s = i - 2;

        let startsLine = s <= 0 || LINE_BREAK.has(this.tokens[s - 1]?.[0]) || this.tokens[s - 1]?.newLine;

        // Check if we're continuing an existing object
        if (stackTop()) {
          let [stackTag, stackIdx] = stackTop();
          let stackNext = stack[stack.length - 2];
          if ((stackTag === '{' || (stackTag === 'INDENT' && stackNext?.[0] === '{' && !isImplicit(stackNext))) &&
              (startsLine || this.tokens[s - 1]?.[0] === ',' || this.tokens[s - 1]?.[0] === '{' || this.tokens[s]?.[0] === '{')) {
            return forward(1);
          }
        }

        startImplicitObject(s, {startsLine: !!startsLine});
        return forward(2);
      }

      // Mark implicit objects as not sameLine on newlines
      if (LINE_BREAK.has(tag)) {
        for (let k = stack.length - 1; k >= 0; k--) {
          if (!isImplicit(stack[k])) break;
          if (stack[k][0] === '{') stack[k][2].sameLine = false;
        }
      }

      // End implicit calls/objects
      let newLine = prevTag === 'OUTDENT' || prevToken.newLine;
      let isLogicalOp = tag === '||' || tag === '&&';
      let logicalKeep = false;
      if (isLogicalOp) {
        // Don't close implicit call when more comma-separated args follow
        let j = i + 1, t = tokens[j]?.[0];
        if (t === '(' || t === '[' || t === '{') {
          for (let d = 1; ++j < tokens.length && d > 0;) {
            t = tokens[j][0];
            if (t === '(' || t === '[' || t === '{') d++;
            else if (t === ')' || t === ']' || t === '}') d--;
          }
        } else if (t && t !== 'TERMINATOR' && t !== 'OUTDENT' && t !== ',') j++;
        logicalKeep = tokens[j]?.[0] === ',';
      }
      if ((IMPLICIT_END.has(tag) && !logicalKeep) || (CALL_CLOSERS.has(tag) && newLine)) {
        while (isImplicit(stackTop())) {
          let [stackTag, , {sameLine, startsLine}] = stackTop();
          if (inImplicitCall() && prevTag !== ',') {
            endImplicitCall();
          } else if (inImplicitObject() && !isLogicalOp && sameLine && tag !== 'TERMINATOR' && prevTag !== ':') {
            endImplicitObject();
          } else if (inImplicitObject() && tag === 'TERMINATOR' && prevTag !== ',' && !(startsLine && this.looksObjectish(i + 1))) {
            endImplicitObject();
          } else if (stackTop()?.[2]?.ours && stackTop()[0] === 'CONTROL' && tokens[stackTop()[1]]?.[0] === 'CLASS' && tag === 'TERMINATOR') {
            stack.pop();
          } else {
            break;
          }
        }
      }

      // Close implicit object on comma when next doesn't look objectish
      if (tag === ',' && !this.looksObjectish(i + 1) && inImplicitObject() &&
          (nextTag !== 'TERMINATOR' || !this.looksObjectish(i + 2))) {
        let offset = nextTag === 'OUTDENT' ? 1 : 0;
        while (inImplicitObject()) endImplicitObject(i + offset);
      }

      return forward(1);
    });
  }

  // Insert commas before arrows inside implicit calls: fn "arg" -> body
  addImplicitCallCommas() {
    let callDepth = 0;
    let i = 0;
    let tokens = this.tokens;

    while (i < tokens.length) {
      let tag = tokens[i][0];
      let prevTag = i > 0 ? tokens[i - 1][0] : null;

      if (tag === 'CALL_START' || tag === '(') callDepth++;
      if (tag === 'CALL_END' || tag === ')') callDepth--;

      if (callDepth > 0 && (tag === '->' || tag === '=>') && IMPLICIT_COMMA_BEFORE_ARROW.has(prevTag)) {
        tokens.splice(i, 0, gen(',', ','));
        i++;
      }
      i++;
    }
  }

  // --- Rewriter helpers ---

  scanTokens(fn) {
    let i = 0;
    while (i < this.tokens.length) {
      i += fn.call(this, this.tokens[i], i, this.tokens);
    }
  }

  detectEnd(i, condition, action, opts = {}) {
    let levels = 0;
    while (i < this.tokens.length) {
      let token = this.tokens[i];
      if (levels === 0 && condition.call(this, token, i)) {
        return action.call(this, token, i);
      }
      if (EXPRESSION_START.has(token[0])) levels++;
      if (EXPRESSION_END.has(token[0])) levels--;
      if (levels < 0) {
        if (opts.returnOnNegativeLevel) return;
        return action.call(this, token, i);
      }
      i++;
    }
  }

  // Scan backward from comma to see if it's inside an implicit function call
  commaInImplicitCall(i) {
    let levels = 0;
    for (let j = i - 1; j >= 0; j--) {
      let tag = this.tokens[j][0];
      if (EXPRESSION_END.has(tag)) { levels++; continue; }
      if (EXPRESSION_START.has(tag)) {
        if (tag === 'INDENT') return false;
        levels--;
        if (levels < 0) return false;
        continue;
      }
      if (levels > 0) continue;
      if (IMPLICIT_FUNC.has(tag) && this.tokens[j].spaced) {
        let nt = this.tokens[j + 1]?.[0];
        return IMPLICIT_CALL.has(nt) || (nt === '...' && IMPLICIT_CALL.has(this.tokens[j + 2]?.[0]));
      }
    }
    return false;
  }

  looksObjectish(j) {
    if (!this.tokens[j]) return false;
    if (this.tokens[j]?.[0] === '@' && this.tokens[j + 2]?.[0] === ':') return true;
    if (this.tokens[j + 1]?.[0] === ':') return true;
    if (EXPRESSION_START.has(this.tokens[j]?.[0])) {
      let end = null;
      this.detectEnd(j + 1,
        t => EXPRESSION_END.has(t[0]),
        (t, i) => end = i
      );
      if (end && this.tokens[end + 1]?.[0] === ':') return true;
    }
    return false;
  }

  findTagsBackwards(i, tags) {
    let tagSet = new Set(tags);
    let backStack = [];
    while (i >= 0) {
      let tag = this.tokens[i]?.[0];
      if (!backStack.length && tagSet.has(tag)) return true;
      if (EXPRESSION_END.has(tag)) backStack.push(tag);
      if (EXPRESSION_START.has(tag) && backStack.length) backStack.pop();
      if (!backStack.length && (EXPRESSION_START.has(tag) && !this.tokens[i]?.generated || LINE_BREAK.has(tag))) break;
      i--;
    }
    return false;
  }

  makeIndentation(origin) {
    let indent = gen('INDENT', 2);
    let outdent = gen('OUTDENT', 2);
    if (origin) {
      indent.generated = outdent.generated = true;
      indent.origin = outdent.origin = origin;
    } else {
      indent.explicit = outdent.explicit = true;
    }
    return [indent, outdent];
  }
}

// ==========================================================================
// Convenience export
// ==========================================================================

export function tokenize(code, opts) {
  return new Lexer().tokenize(code, opts);
}
