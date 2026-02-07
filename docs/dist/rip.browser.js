// src/lexer.js
var JS_KEYWORDS = new Set([
  "true",
  "false",
  "null",
  "this",
  "new",
  "delete",
  "typeof",
  "in",
  "instanceof",
  "return",
  "throw",
  "break",
  "continue",
  "debugger",
  "yield",
  "await",
  "if",
  "else",
  "switch",
  "for",
  "while",
  "do",
  "try",
  "catch",
  "finally",
  "class",
  "extends",
  "super",
  "import",
  "export",
  "default"
]);
var RIP_KEYWORDS = new Set([
  "undefined",
  "Infinity",
  "NaN",
  "then",
  "unless",
  "until",
  "loop",
  "of",
  "by",
  "when",
  "def"
]);
var ALIASES = {
  and: "&&",
  or: "||",
  is: "==",
  isnt: "!=",
  not: "!",
  yes: "true",
  no: "false",
  on: "true",
  off: "false"
};
var ALIAS_WORDS = new Set(Object.keys(ALIASES));
var RESERVED = new Set([
  "case",
  "function",
  "var",
  "void",
  "with",
  "const",
  "let",
  "enum",
  "native",
  "implements",
  "interface",
  "package",
  "private",
  "protected",
  "public",
  "static"
]);
var STATEMENTS = new Set(["break", "continue", "debugger"]);
var UNARY_WORDS = new Set(["NEW", "TYPEOF", "DELETE"]);
var RELATIONS = new Set(["IN", "OF", "INSTANCEOF"]);
var CALLABLE = new Set([
  "IDENTIFIER",
  "PROPERTY",
  ")",
  "]",
  "@",
  "THIS",
  "SUPER",
  "DYNAMIC_IMPORT",
  "?."
]);
var INDEXABLE = new Set([
  ...CALLABLE,
  "NUMBER",
  "INFINITY",
  "NAN",
  "STRING",
  "STRING_END",
  "REGEX",
  "REGEX_END",
  "BOOL",
  "NULL",
  "UNDEFINED",
  "}"
]);
var IMPLICIT_CALL = new Set([
  "IDENTIFIER",
  "PROPERTY",
  "NUMBER",
  "INFINITY",
  "NAN",
  "STRING",
  "STRING_START",
  "REGEX",
  "REGEX_START",
  "JS",
  "NEW",
  "PARAM_START",
  "CLASS",
  "IF",
  "TRY",
  "SWITCH",
  "THIS",
  "DYNAMIC_IMPORT",
  "IMPORT_META",
  "NEW_TARGET",
  "UNDEFINED",
  "NULL",
  "BOOL",
  "UNARY",
  "DO",
  "DO_IIFE",
  "YIELD",
  "AWAIT",
  "UNARY_MATH",
  "SUPER",
  "THROW",
  "@",
  "->",
  "=>",
  "[",
  "(",
  "{",
  "--",
  "++"
]);
var IMPLICIT_UNSPACED_CALL = new Set(["+", "-"]);
var IMPLICIT_END = new Set([
  "POST_IF",
  "POST_UNLESS",
  "FOR",
  "WHILE",
  "UNTIL",
  "WHEN",
  "BY",
  "LOOP",
  "TERMINATOR",
  "||",
  "&&"
]);
var IMPLICIT_COMMA_BEFORE_ARROW = new Set([
  "STRING",
  "STRING_END",
  "REGEX",
  "REGEX_END",
  "NUMBER",
  "BOOL",
  "NULL",
  "UNDEFINED",
  "INFINITY",
  "NAN",
  "]",
  "}"
]);
var EXPRESSION_START = new Set(["(", "[", "{", "INDENT", "CALL_START", "PARAM_START", "INDEX_START", "STRING_START", "INTERPOLATION_START", "REGEX_START"]);
var EXPRESSION_END = new Set([")", "]", "}", "OUTDENT", "CALL_END", "PARAM_END", "INDEX_END", "STRING_END", "INTERPOLATION_END", "REGEX_END"]);
var INVERSES = {
  "(": ")",
  ")": "(",
  "[": "]",
  "]": "[",
  "{": "}",
  "}": "{",
  INDENT: "OUTDENT",
  OUTDENT: "INDENT",
  CALL_START: "CALL_END",
  CALL_END: "CALL_START",
  PARAM_START: "PARAM_END",
  PARAM_END: "PARAM_START",
  INDEX_START: "INDEX_END",
  INDEX_END: "INDEX_START",
  STRING_START: "STRING_END",
  STRING_END: "STRING_START",
  INTERPOLATION_START: "INTERPOLATION_END",
  INTERPOLATION_END: "INTERPOLATION_START",
  REGEX_START: "REGEX_END",
  REGEX_END: "REGEX_START"
};
var EXPRESSION_CLOSE = new Set(["CATCH", "THEN", "ELSE", "FINALLY", ...EXPRESSION_END]);
var IMPLICIT_FUNC = new Set([
  "IDENTIFIER",
  "PROPERTY",
  "SUPER",
  ")",
  "CALL_END",
  "]",
  "INDEX_END",
  "@",
  "THIS"
]);
var CONTROL_IN_IMPLICIT = new Set(["IF", "TRY", "FINALLY", "CATCH", "CLASS", "SWITCH"]);
var SINGLE_LINERS = new Set(["ELSE", "->", "=>", "TRY", "FINALLY", "THEN"]);
var SINGLE_CLOSERS = new Set(["TERMINATOR", "CATCH", "FINALLY", "ELSE", "OUTDENT", "LEADING_WHEN"]);
var LINE_BREAK = new Set(["INDENT", "OUTDENT", "TERMINATOR"]);
var CALL_CLOSERS = new Set([".", "?."]);
var UNFINISHED = new Set([
  "\\",
  ".",
  "?.",
  "UNARY",
  "DO",
  "DO_IIFE",
  "MATH",
  "UNARY_MATH",
  "+",
  "-",
  "**",
  "SHIFT",
  "RELATION",
  "COMPARE",
  "&",
  "^",
  "|",
  "&&",
  "||",
  "SPACE?",
  "EXTENDS"
]);
var NOT_REGEX = new Set([...INDEXABLE, "++", "--"]);
var COMPOUND_ASSIGN = new Set([
  "-=",
  "+=",
  "/=",
  "*=",
  "%=",
  "||=",
  "&&=",
  "?=",
  "??=",
  "<<=",
  ">>=",
  ">>>=",
  "&=",
  "^=",
  "|=",
  "**=",
  "//=",
  "%%="
]);
var MATH = new Set(["*", "/", "%", "//", "%%"]);
var COMPARE = new Set(["==", "!=", "===", "!==", "<", ">", "<=", ">=", "=~"]);
var SHIFT = new Set(["<<", ">>", ">>>"]);
var UNARY_MATH = new Set(["!", "~"]);
var IDENTIFIER_RE = /^(?!\d)((?:(?!\s)[$\w\x7f-\uffff])+(?:!|[?](?![.?[(]))?)([^\n\S]*:(?![=:]))?/;
var NUMBER_RE = /^0b[01](?:_?[01])*n?|^0o[0-7](?:_?[0-7])*n?|^0x[\da-f](?:_?[\da-f])*n?|^\d+(?:_\d+)*n|^(?:\d+(?:_\d+)*)?\.?\d+(?:_\d+)*(?:e[+-]?\d+(?:_\d+)*)?/i;
var OPERATOR_RE = /^(?:<=>|[-=]>|~>|~=|:=|=!|===|!==|!\?|\?\?|=~|[-+*\/%<>&|^!?=]=|>>>=?|([-+:])\1|([&|<>*\/%])\2=?|\?\.?|\.{2,3})/;
var WHITESPACE_RE = /^[^\n\S]+/;
var NEWLINE_RE = /^(?:\n[^\n\S]*)+/;
var COMMENT_RE = /^(\s*)###([^#][\s\S]*?)(?:###([^\n\S]*)|###$)|^((?:\s*#(?!##[^#]).*)+)/;
var CODE_RE = /^[-=]>/;
var REACTIVE_RE = /^(?:~[=>]|=!)/;
var STRING_START_RE = /^(?:'''|"""|'|")/;
var STRING_SINGLE_RE = /^(?:[^\\']|\\[\s\S])*/;
var STRING_DOUBLE_RE = /^(?:[^\\"#$]|\\[\s\S]|\#(?!\{)|\$(?!\{))*/;
var HEREDOC_SINGLE_RE = /^(?:[^\\']|\\[\s\S]|'(?!''))*/;
var HEREDOC_DOUBLE_RE = /^(?:[^\\"#$]|\\[\s\S]|"(?!"")|\#(?!\{)|\$(?!\{))*/;
var HEREDOC_INDENT_RE = /\n+([^\n\S]*)(?=\S)/g;
var REGEX_RE = /^\/(?!\/)((?:[^[\/\n\\]|\\[^\n]|\[(?:\\[^\n]|[^\]\n\\])*\])*)(\/)?/;
var REGEX_FLAGS_RE = /^\w*/;
var VALID_FLAGS_RE = /^(?!.*(.).*\1)[gimsuy]*$/;
var HEREGEX_RE = /^(?:[^\\\/#\s]|\\[\s\S]|\/(?!\/\/)|\#(?!\{)|\s+(?:#(?!\{).*)?)*/;
var JSTOKEN_RE = /^`(?!``)((?:[^`\\]|\\[\s\S])*)`/;
var HERE_JSTOKEN_RE = /^```((?:[^`\\]|\\[\s\S]|`(?!``))*)```/;
var TRAILING_SPACES_RE = /\s+$/;
var LINE_CONTINUER_RE = /^\s*(?:,|\??\.(?![.\d]))/;
var BOM = 65279;
function tok(tag, val, { pre = 0, row = 0, col = 0, len = 0, data = null } = {}) {
  let t = [tag, val];
  t.pre = pre;
  t.data = data;
  t.loc = { r: row, c: col, n: len };
  t.spaced = pre > 0;
  t.newLine = false;
  return t;
}
function gen(tag, val, origin) {
  let t = tok(tag, val);
  t.generated = true;
  if (origin)
    t.origin = origin;
  return t;
}
function syntaxError(message, { row = 0, col = 0, len = 1 } = {}) {
  let err = new SyntaxError(message);
  err.location = { first_line: row, first_column: col, last_column: col + len - 1 };
  throw err;
}
function parseNumber(str) {
  if (str == null)
    return NaN;
  switch (str.charAt(1)) {
    case "b":
      return parseInt(str.slice(2).replace(/_/g, ""), 2);
    case "o":
      return parseInt(str.slice(2).replace(/_/g, ""), 8);
    case "x":
      return parseInt(str.slice(2).replace(/_/g, ""), 16);
    default:
      return parseFloat(str.replace(/_/g, ""));
  }
}

class Lexer {
  tokenize(code, opts = {}) {
    this.code = code;
    this.tokens = [];
    this.ends = [];
    this.chunk = "";
    this.pos = 0;
    this.row = opts.row || 0;
    this.col = opts.col || 0;
    this.indent = 0;
    this.indents = [];
    this.seenFor = false;
    this.seenImport = false;
    this.seenExport = false;
    this.importSpecifierList = false;
    this.exportSpecifierList = false;
    code = this.clean(code);
    this.code = code;
    while (this.pos < code.length) {
      this.chunk = code.slice(this.pos);
      let consumed = this.identifierToken() || this.commentToken() || this.whitespaceToken() || this.lineToken() || this.stringToken() || this.numberToken() || this.regexToken() || this.jsToken() || this.literalToken();
      if (consumed === 0) {
        syntaxError(`unexpected character: ${this.chunk.charAt(0)}`, {
          row: this.row,
          col: this.col
        });
      }
      this.advance(consumed);
      if (opts.untilBalanced && this.ends.length === 0) {
        return { tokens: this.tokens, index: this.pos };
      }
    }
    this.closeIndentation();
    if (this.ends.length > 0) {
      let unclosed = this.ends[this.ends.length - 1];
      syntaxError(`missing ${unclosed.tag}`, { row: this.row, col: this.col });
    }
    if (opts.rewrite === false)
      return this.tokens;
    return this.rewrite(this.tokens);
  }
  clean(code) {
    if (code.charCodeAt(0) === BOM)
      code = code.slice(1);
    code = code.replace(/\r\n?/g, `
`);
    code = code.replace(TRAILING_SPACES_RE, "");
    if (/^[^\n\S]/.test(code))
      code = `
` + code;
    return code;
  }
  advance(n) {
    let consumed = this.code.slice(this.pos, this.pos + n);
    for (let i = 0;i < consumed.length; i++) {
      if (consumed[i] === `
`) {
        this.row++;
        this.col = 0;
      } else {
        this.col++;
      }
    }
    this.pos += n;
  }
  emit(tag, val, { len, data, pre } = {}) {
    let t = tok(tag, val, {
      pre: pre ?? 0,
      row: this.row,
      col: this.col,
      len: len ?? (typeof val === "string" ? val.length : 0),
      data
    });
    this.tokens.push(t);
    return t;
  }
  prev() {
    return this.tokens[this.tokens.length - 1];
  }
  prevTag() {
    let p = this.prev();
    return p ? p[0] : undefined;
  }
  prevVal() {
    let p = this.prev();
    return p ? p[1] : undefined;
  }
  identifierToken() {
    if (REACTIVE_RE.test(this.chunk))
      return 0;
    let match = IDENTIFIER_RE.exec(this.chunk);
    if (!match)
      return 0;
    let [input, id, colon] = match;
    let idLen = id.length;
    let data = {};
    let tag;
    if (id === "own" && this.prevTag() === "FOR") {
      this.emit("OWN", id, { len: idLen });
      return idLen;
    }
    if (id === "from" && this.prevTag() === "YIELD") {
      this.emit("FROM", id, { len: idLen });
      return idLen;
    }
    if (id === "as" && !this.seenFor && (this.seenImport || this.seenExport)) {
      if (this.seenImport) {
        if (this.prevVal() === "*")
          this.prev()[0] = "IMPORT_ALL";
      }
      let pt = this.prevTag();
      if (pt === "DEFAULT" || pt === "IMPORT_ALL" || pt === "IDENTIFIER") {
        this.emit("AS", id, { len: idLen });
        return idLen;
      }
    }
    if ((id === "as" || id === "as!") && this.seenFor) {
      this.seenFor = false;
      this.emit(id === "as!" ? "FORASAWAIT" : "FORAS", "as", { len: idLen });
      return idLen;
    }
    if (id === "default" && this.seenExport && (this.prevTag() === "EXPORT" || this.prevTag() === "AS")) {
      this.emit("DEFAULT", id, { len: idLen });
      return idLen;
    }
    if (id === "do" && /^(\s*super)(?!\(\))/.test(this.chunk.slice(3))) {
      let m = /^(\s*super)(?!\(\))/.exec(this.chunk.slice(3));
      this.emit("SUPER", "super");
      this.emit("CALL_START", "(");
      this.emit("CALL_END", ")");
      return m[1].length + 3;
    }
    let prev = this.prev();
    if (colon && prev && prev[0] === "SPACE?")
      colon = null;
    if (colon || prev && (prev[0] === "." || prev[0] === "?." || !prev.spaced && prev[0] === "@")) {
      tag = "PROPERTY";
    } else {
      tag = "IDENTIFIER";
    }
    let baseId = id.endsWith("!") || id.endsWith("?") ? id.slice(0, -1) : id;
    if (tag === "IDENTIFIER" && !id.endsWith("!") && !id.endsWith("?") && (JS_KEYWORDS.has(id) || RIP_KEYWORDS.has(id) || ALIAS_WORDS.has(id)) && !(this.exportSpecifierList && ALIAS_WORDS.has(id))) {
      if (ALIASES[id] !== undefined) {
        data.original = id;
        id = ALIASES[id];
      }
      tag = this.classifyKeyword(id, tag, data);
    }
    if (tag === "IDENTIFIER" && RESERVED.has(baseId)) {
      syntaxError(`reserved word '${baseId}'`, { row: this.row, col: this.col, len: idLen });
    }
    if (tag === "PROPERTY" && prev) {
      if (prev[0] === "." && this.tokens.length > 1) {
        let pp = this.tokens[this.tokens.length - 2];
        if (pp[0] === "UNARY" && pp[1] === "new")
          pp[0] = "NEW_TARGET";
        if (pp[0] === "IMPORT" && pp[1] === "import") {
          this.seenImport = false;
          pp[0] = "IMPORT_META";
        }
      }
    }
    if (id.length > 1 && id.endsWith("!")) {
      data.await = true;
      id = id.slice(0, -1);
    }
    if (id.length > 1 && id.endsWith("?")) {
      data.predicate = true;
      id = id.slice(0, -1);
    }
    let t = this.emit(tag, id, { len: idLen, data: Object.keys(data).length ? data : null });
    if (colon) {
      this.emit(":", ":", { len: 1 });
      return idLen + colon.length;
    }
    return idLen;
  }
  classifyKeyword(id, fallback, data) {
    switch (id) {
      case "!":
        return "UNARY";
      case "==":
      case "!=":
        return "COMPARE";
      case "true":
      case "false":
        return "BOOL";
      case "&&":
      case "||":
        return id;
    }
    if (STATEMENTS.has(id))
      return "STATEMENT";
    let upper = id.toUpperCase();
    if (upper === "WHEN" && LINE_BREAK.has(this.prevTag()))
      return "LEADING_WHEN";
    if (upper === "FOR") {
      this.seenFor = { endsLength: this.ends.length };
      return "FOR";
    }
    if (upper === "UNLESS")
      return "UNLESS";
    if (upper === "IMPORT") {
      this.seenImport = true;
      return "IMPORT";
    }
    if (upper === "EXPORT") {
      this.seenExport = true;
      return "EXPORT";
    }
    if (UNARY_WORDS.has(upper))
      return "UNARY";
    if (RELATIONS.has(upper)) {
      if (upper !== "INSTANCEOF" && this.seenFor) {
        this.seenFor = false;
        return "FOR" + upper;
      }
      if (this.prevVal() === "!") {
        let popped = this.tokens.pop();
        data.invert = popped.data?.original || popped[1];
      }
      return "RELATION";
    }
    if (JS_KEYWORDS.has(id) || RIP_KEYWORDS.has(id))
      return upper;
    return fallback;
  }
  commentToken() {
    let match = COMMENT_RE.exec(this.chunk);
    if (!match)
      return 0;
    return match[0].length;
  }
  whitespaceToken() {
    let match = WHITESPACE_RE.exec(this.chunk);
    if (!match && this.chunk[0] !== `
`)
      return 0;
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
  lineToken() {
    let match = NEWLINE_RE.exec(this.chunk);
    if (!match)
      return 0;
    let indent = match[0];
    let size = indent.length - 1 - indent.lastIndexOf(`
`);
    if (this.isUnfinished()) {
      return indent.length;
    }
    if (this.seenFor && !(this.seenFor.endsLength < this.ends.length)) {
      this.seenFor = false;
    }
    if (!this.importSpecifierList)
      this.seenImport = false;
    if (!this.exportSpecifierList)
      this.seenExport = false;
    if (size === this.indent) {
      this.emitNewline();
      return indent.length;
    }
    if (size > this.indent) {
      if (!this.tokens.length) {
        this.indent = size;
        return indent.length;
      }
      let diff = size - this.indent;
      this.emit("INDENT", diff, { len: size });
      this.indents.push(diff);
      this.ends.push({ tag: "OUTDENT" });
      this.indent = size;
      return indent.length;
    }
    this.outdentTo(size, indent.length);
    return indent.length;
  }
  outdentTo(targetSize, outdentLength = 0) {
    let moveOut = this.indent - targetSize;
    while (moveOut > 0) {
      let lastIndent = this.indents[this.indents.length - 1];
      if (!lastIndent) {
        moveOut = 0;
      } else {
        this.indents.pop();
        this.pair("OUTDENT");
        this.emit("OUTDENT", moveOut, { len: outdentLength });
        moveOut -= lastIndent;
      }
    }
    this.emitNewline();
    this.indent = targetSize;
  }
  closeIndentation() {
    this.outdentTo(0);
  }
  emitNewline() {
    if (this.prevTag() !== "TERMINATOR") {
      this.emit("TERMINATOR", `
`, { len: 0 });
    }
  }
  isUnfinished() {
    return LINE_CONTINUER_RE.test(this.chunk) || UNFINISHED.has(this.prevTag());
  }
  pair(tag) {
    let expected = this.ends[this.ends.length - 1];
    if (!expected || tag !== expected.tag) {
      if (expected?.tag === "OUTDENT") {
        let lastIndent = this.indents[this.indents.length - 1];
        if (lastIndent) {
          this.outdentTo(this.indent - lastIndent);
        }
        return this.pair(tag);
      }
      syntaxError(`unmatched ${tag}`, { row: this.row, col: this.col });
    }
    return this.ends.pop();
  }
  stringToken() {
    let m = STRING_START_RE.exec(this.chunk);
    if (!m)
      return 0;
    let quote = m[0];
    let prev = this.prev();
    if (prev && this.prevVal() === "from" && (this.seenImport || this.seenExport)) {
      prev[0] = "FROM";
    }
    let regex;
    switch (quote) {
      case "'":
        regex = STRING_SINGLE_RE;
        break;
      case '"':
        regex = STRING_DOUBLE_RE;
        break;
      case "'''":
        regex = HEREDOC_SINGLE_RE;
        break;
      case '"""':
        regex = HEREDOC_DOUBLE_RE;
        break;
    }
    let { tokens: parts, index: end } = this.matchWithInterpolations(regex, quote);
    let heredoc = quote.length === 3;
    let indent = null;
    if (heredoc) {
      indent = this.processHeredocIndent(end, quote, parts);
    }
    this.mergeInterpolationTokens(parts, { quote, indent, endOffset: end });
    return end;
  }
  processHeredocIndent(end, quote, tokens) {
    let closingPos = end - quote.length;
    let lineStart = closingPos - 1;
    while (lineStart >= 0 && this.chunk[lineStart] !== `
`)
      lineStart--;
    lineStart++;
    let beforeClosing = this.chunk.slice(lineStart, closingPos);
    let closingColumn = /^\s*$/.test(beforeClosing) ? beforeClosing.length : null;
    let doc = "";
    for (let t of tokens) {
      if (t[0] === "NEOSTRING")
        doc += t[1];
    }
    let minIndent = null;
    let m;
    HEREDOC_INDENT_RE.lastIndex = 0;
    while (m = HEREDOC_INDENT_RE.exec(doc)) {
      if (minIndent === null || m[1].length > 0 && m[1].length < minIndent.length) {
        minIndent = m[1];
      }
    }
    if (closingColumn === null)
      return minIndent;
    if (minIndent === null)
      return " ".repeat(closingColumn);
    if (closingColumn <= minIndent.length)
      return " ".repeat(closingColumn);
    return minIndent;
  }
  matchWithInterpolations(regex, delimiter, closingDelimiter, interpolators) {
    if (!closingDelimiter)
      closingDelimiter = delimiter;
    if (!interpolators)
      interpolators = /^[#$]\{/;
    let tokens = [];
    let offset = delimiter.length;
    if (this.chunk.slice(0, offset) !== delimiter)
      return null;
    let str = this.chunk.slice(offset);
    while (true) {
      let [strPart] = regex.exec(str);
      tokens.push(["NEOSTRING", strPart, { offset }]);
      str = str.slice(strPart.length);
      offset += strPart.length;
      let m = interpolators.exec(str);
      if (!m)
        break;
      let interpolator = m[0];
      let interpOffset = interpolator.length - 1;
      let rest = str.slice(interpOffset);
      let nested = new Lexer().tokenize(rest, {
        row: this.row,
        col: this.col + offset + interpOffset,
        untilBalanced: true,
        rewrite: false
      });
      let index = nested.index + interpOffset;
      if (str[index - 1] === "}") {
        let open = nested.tokens[0];
        let close = nested.tokens[nested.tokens.length - 1];
        open[0] = "INTERPOLATION_START";
        open[1] = "(";
        close[0] = "INTERPOLATION_END";
        close[1] = ")";
      }
      if (nested.tokens[1]?.[0] === "TERMINATOR")
        nested.tokens.splice(1, 1);
      let ntl = nested.tokens.length;
      if (ntl > 2 && nested.tokens[ntl - 3]?.[0] === "INDENT" && nested.tokens[ntl - 2]?.[0] === "OUTDENT") {
        nested.tokens.splice(ntl - 3, 2);
      }
      tokens.push(["TOKENS", nested.tokens]);
      str = str.slice(index);
      offset += index;
    }
    if (str.slice(0, closingDelimiter.length) !== closingDelimiter) {
      syntaxError(`missing ${closingDelimiter}`, { row: this.row, col: this.col });
    }
    return { tokens, index: offset + closingDelimiter.length };
  }
  mergeInterpolationTokens(tokens, { quote, indent, endOffset }) {
    if (tokens.length > 1) {
      this.emit("STRING_START", "(", { len: quote?.length || 0, data: { quote } });
    }
    for (let i = 0;i < tokens.length; i++) {
      let [tag, val] = tokens[i];
      if (tag === "TOKENS") {
        for (let nested of val)
          this.tokens.push(nested);
      } else if (tag === "NEOSTRING") {
        let processed = val;
        if (indent) {
          let indentRe = new RegExp("\\n" + indent, "g");
          processed = processed.replace(indentRe, `
`);
        }
        if (i === 0 && quote?.length === 3) {
          processed = processed.replace(/^\n/, "");
        }
        if (i === tokens.length - 1 && quote?.length === 3) {
          processed = processed.replace(/\n[^\S\n]*$/, "");
        }
        this.emit("STRING", `"${processed}"`, { len: val.length, data: { quote } });
      }
    }
    if (tokens.length > 1) {
      this.emit("STRING_END", ")", { len: quote?.length || 0 });
    }
    return endOffset;
  }
  numberToken() {
    let match = NUMBER_RE.exec(this.chunk);
    if (!match)
      return 0;
    let number = match[0];
    let len = number.length;
    let loc = { row: this.row, col: this.col };
    if (/^0[BOX]/.test(number)) {
      syntaxError(`radix prefix in '${number}' must be lowercase`, { ...loc, col: loc.col + 1 });
    }
    if (/^0\d*[89]/.test(number)) {
      syntaxError(`decimal literal '${number}' must not be prefixed with '0'`, { ...loc, len });
    }
    if (/^0\d+/.test(number)) {
      syntaxError(`octal literal '${number}' must be prefixed with '0o'`, { ...loc, len });
    }
    let parsed = parseNumber(number);
    let tag = parsed === Infinity ? "INFINITY" : "NUMBER";
    let data = { parsedValue: parsed };
    if (tag === "INFINITY")
      data.original = number;
    this.emit(tag, number, { len, data });
    return len;
  }
  regexToken() {
    let hm = this.matchWithInterpolations(HEREGEX_RE, "///");
    if (hm) {
      let { tokens: parts, index: index2 } = hm;
      let [flags2] = REGEX_FLAGS_RE.exec(this.chunk.slice(index2));
      let end2 = index2 + flags2.length;
      if (parts.length === 1 || !parts.some((p) => p[0] === "TOKENS")) {
        let body2 = parts[0]?.[1] || "";
        this.emit("REGEX", `/${body2}/${flags2}`, { len: end2, data: { delimiter: "///", heregex: { flags: flags2 } } });
      } else {
        this.emit("REGEX_START", "(", { len: 0 });
        this.emit("IDENTIFIER", "RegExp", { len: 0 });
        this.emit("CALL_START", "(", { len: 0 });
        this.mergeInterpolationTokens(parts, { quote: "///", endOffset: end2 - flags2.length });
        if (flags2) {
          this.emit(",", ",", { len: 0 });
          this.emit("STRING", `"${flags2}"`, { len: flags2.length });
        }
        this.emit(")", ")", { len: 0 });
        this.emit("REGEX_END", ")", { len: 0 });
      }
      return end2;
    }
    let match = REGEX_RE.exec(this.chunk);
    if (!match)
      return 0;
    let [regex, body, closed] = match;
    let prev = this.prev();
    if (prev) {
      if (prev.spaced && CALLABLE.has(prev[0]) && (!closed || /^\/=?\s/.test(regex)))
        return 0;
      if (NOT_REGEX.has(prev[0]) && !(prev.spaced && CALLABLE.has(prev[0])))
        return 0;
    }
    if (!closed)
      syntaxError("missing / (unclosed regex)", { row: this.row, col: this.col });
    let index = regex.length;
    let [flags] = REGEX_FLAGS_RE.exec(this.chunk.slice(index));
    let end = index + flags.length;
    if (!VALID_FLAGS_RE.test(flags)) {
      syntaxError(`invalid regular expression flags ${flags}`, { row: this.row, col: this.col + index, len: flags.length });
    }
    this.emit("REGEX", `/${body}/${flags}`, { len: end, data: { delimiter: "/" } });
    return end;
  }
  jsToken() {
    if (this.chunk[0] !== "`")
      return 0;
    let match = HERE_JSTOKEN_RE.exec(this.chunk) || JSTOKEN_RE.exec(this.chunk);
    if (!match)
      return 0;
    let script = match[1];
    let len = match[0].length;
    this.emit("JS", script, { len, data: { here: match[0].startsWith("```") } });
    return len;
  }
  literalToken() {
    let match = OPERATOR_RE.exec(this.chunk);
    let val = match ? match[0] : this.chunk.charAt(0);
    let tag = val;
    let prev = this.prev();
    if (CODE_RE.test(val))
      this.tagParameters();
    if (prev && (val === "=" || COMPOUND_ASSIGN.has(val))) {
      if (val === "=" && (prev[1] === "||" || prev[1] === "&&" || prev[1] === "??") && !prev.spaced) {
        prev[0] = "COMPOUND_ASSIGN";
        prev[1] += "=";
        return val.length;
      }
    }
    if (val === "(" && prev?.[0] === "IMPORT")
      prev[0] = "DYNAMIC_IMPORT";
    if (val === "{" && this.seenImport)
      this.importSpecifierList = true;
    if (val === "}" && this.importSpecifierList)
      this.importSpecifierList = false;
    if (val === "{" && prev?.[0] === "EXPORT")
      this.exportSpecifierList = true;
    if (val === "}" && this.exportSpecifierList)
      this.exportSpecifierList = false;
    if (val === ";") {
      this.seenFor = this.seenImport = this.seenExport = false;
      tag = "TERMINATOR";
    } else if (val === "~=")
      tag = "COMPUTED_ASSIGN";
    else if (val === ":=")
      tag = "REACTIVE_ASSIGN";
    else if (val === "~>")
      tag = "REACT_ASSIGN";
    else if (val === "=!")
      tag = "READONLY_ASSIGN";
    else if (val === "*" && prev?.[0] === "EXPORT")
      tag = "EXPORT_ALL";
    else if (MATH.has(val))
      tag = "MATH";
    else if (COMPARE.has(val))
      tag = "COMPARE";
    else if (COMPOUND_ASSIGN.has(val))
      tag = "COMPOUND_ASSIGN";
    else if (UNARY_MATH.has(val))
      tag = "UNARY_MATH";
    else if (SHIFT.has(val))
      tag = "SHIFT";
    else if (val === "?" && prev?.spaced)
      tag = "SPACE?";
    else if (prev) {
      if (val === "(" && !prev.spaced && CALLABLE.has(prev[0])) {
        if (prev[0] === "?.")
          prev[0] = "ES6_OPTIONAL_CALL";
        tag = "CALL_START";
      }
      if (val === "[" && !prev.spaced && INDEXABLE.has(prev[0])) {
        tag = "INDEX_START";
        if (prev[0] === "?.")
          prev[0] = "ES6_OPTIONAL_INDEX";
      }
    }
    if (val === "(" || val === "{" || val === "[") {
      this.ends.push({ tag: INVERSES[val], origin: [tag, val] });
    } else if (val === ")" || val === "}" || val === "]") {
      this.pair(val);
    }
    this.emit(tag, val, { len: val.length });
    return val.length;
  }
  tagParameters() {
    if (this.prevTag() !== ")")
      return this.tagDoIife();
    let i = this.tokens.length - 1;
    let stack = [];
    this.tokens[i][0] = "PARAM_END";
    while (i-- > 0) {
      let tok2 = this.tokens[i];
      if (tok2[0] === ")") {
        stack.push(tok2);
      } else if (tok2[0] === "(" || tok2[0] === "CALL_START") {
        if (stack.length) {
          stack.pop();
        } else if (tok2[0] === "(") {
          tok2[0] = "PARAM_START";
          return this.tagDoIife(i - 1);
        } else {
          this.tokens[this.tokens.length - 1][0] = "CALL_END";
          return;
        }
      }
    }
  }
  tagDoIife(index) {
    let t = this.tokens[index ?? this.tokens.length - 1];
    if (t?.[0] === "DO")
      t[0] = "DO_IIFE";
  }
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
  removeLeadingNewlines() {
    let i = 0;
    while (this.tokens[i]?.[0] === "TERMINATOR")
      i++;
    if (i > 0)
      this.tokens.splice(0, i);
  }
  closeOpenCalls() {
    this.scanTokens((token, i) => {
      if (token[0] === "CALL_START") {
        this.detectEnd(i + 1, (t) => t[0] === ")" || t[0] === "CALL_END", (t) => t[0] = "CALL_END");
      }
      return 1;
    });
  }
  closeOpenIndexes() {
    this.scanTokens((token, i) => {
      if (token[0] === "INDEX_START") {
        this.detectEnd(i + 1, (t) => t[0] === "]" || t[0] === "INDEX_END", (t, idx) => {
          if (this.tokens[idx + 1]?.[0] === ":") {
            token[0] = "[";
            t[0] = "]";
          } else {
            t[0] = "INDEX_END";
          }
        });
      }
      return 1;
    });
  }
  normalizeLines() {
    let starter = null;
    let indent = null;
    let outdent = null;
    let condition = (token, i) => {
      return token[1] !== ";" && SINGLE_CLOSERS.has(token[0]) && !(token[0] === "TERMINATOR" && EXPRESSION_CLOSE.has(this.tokens[i + 1]?.[0])) && !(token[0] === "ELSE" && starter !== "THEN") || token[0] === "," && (starter === "->" || starter === "=>") || CALL_CLOSERS.has(token[0]) && (this.tokens[i - 1]?.newLine || this.tokens[i - 1]?.[0] === "OUTDENT");
    };
    let action = (token, i) => {
      let idx = this.tokens[i - 1]?.[0] === "," ? i - 1 : i;
      this.tokens.splice(idx, 0, outdent);
    };
    this.scanTokens((token, i, tokens) => {
      let [tag] = token;
      if (tag === "TERMINATOR") {
        if (this.tokens[i + 1]?.[0] === "ELSE" && this.tokens[i - 1]?.[0] !== "OUTDENT") {
          tokens.splice(i, 1, ...this.makeIndentation());
          return 1;
        }
        if (EXPRESSION_CLOSE.has(this.tokens[i + 1]?.[0])) {
          tokens.splice(i, 1);
          return 0;
        }
      }
      if (tag === "CATCH") {
        for (let j = 1;j <= 2; j++) {
          let nextTag = this.tokens[i + j]?.[0];
          if (nextTag === "OUTDENT" || nextTag === "TERMINATOR" || nextTag === "FINALLY") {
            tokens.splice(i + j, 0, ...this.makeIndentation());
            return 2 + j;
          }
        }
      }
      if ((tag === "->" || tag === "=>") && (this.tokens[i + 1]?.[0] === "," || this.tokens[i + 1]?.[0] === "]")) {
        [indent, outdent] = this.makeIndentation();
        tokens.splice(i + 1, 0, indent, outdent);
        return 1;
      }
      if (SINGLE_LINERS.has(tag) && this.tokens[i + 1]?.[0] !== "INDENT" && !(tag === "ELSE" && this.tokens[i + 1]?.[0] === "IF")) {
        starter = tag;
        [indent, outdent] = this.makeIndentation();
        if (tag === "THEN")
          indent.fromThen = true;
        tokens.splice(i + 1, 0, indent);
        this.detectEnd(i + 2, condition, action);
        if (tag === "THEN")
          tokens.splice(i, 1);
        return 1;
      }
      return 1;
    });
  }
  tagPostfixConditionals() {
    let original = null;
    let condition = (token, i) => {
      return token[0] === "TERMINATOR" || token[0] === "INDENT" && !SINGLE_LINERS.has(this.tokens[i - 1]?.[0]);
    };
    let action = (token) => {
      if (token[0] !== "INDENT" || token.generated && !token.fromThen) {
        original[0] = "POST_" + original[0];
      }
    };
    this.scanTokens((token, i) => {
      if (token[0] !== "IF" && token[0] !== "UNLESS")
        return 1;
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
      let inImplicitCall = () => isImplicit(stackTop()) && stackTop()?.[0] === "(";
      let inImplicitObject = () => isImplicit(stackTop()) && stackTop()?.[0] === "{";
      let startImplicitCall = (idx) => {
        stack.push(["(", idx, { ours: true }]);
        tokens.splice(idx, 0, gen("CALL_START", "("));
      };
      let endImplicitCall = () => {
        stack.pop();
        tokens.splice(i, 0, gen("CALL_END", ")"));
        i += 1;
      };
      let startImplicitObject = (idx, opts = {}) => {
        stack.push(["{", idx, { sameLine: true, startsLine: opts.startsLine ?? true, ours: true }]);
        let t = gen("{", "{");
        if (!t.data)
          t.data = {};
        t.data.generated = true;
        tokens.splice(idx, 0, t);
      };
      let endImplicitObject = (j) => {
        j = j ?? i;
        stack.pop();
        tokens.splice(j, 0, gen("}", "}"));
        i += 1;
      };
      if ((inImplicitCall() || inImplicitObject()) && CONTROL_IN_IMPLICIT.has(tag)) {
        stack.push(["CONTROL", i, { ours: true }]);
        return forward(1);
      }
      if (tag === "INDENT" && isImplicit(stackTop())) {
        if (prevTag !== "=>" && prevTag !== "->" && prevTag !== "[" && prevTag !== "(" && prevTag !== "," && prevTag !== "{" && prevTag !== "ELSE" && prevTag !== "=") {
          while (inImplicitCall() || inImplicitObject() && prevTag !== ":") {
            if (inImplicitCall())
              endImplicitCall();
            else
              endImplicitObject();
          }
        }
        if (stackTop()?.[2]?.ours && stackTop()[0] === "CONTROL")
          stack.pop();
        stack.push([tag, i]);
        return forward(1);
      }
      if (EXPRESSION_START.has(tag)) {
        stack.push([tag, i]);
        return forward(1);
      }
      if (EXPRESSION_END.has(tag)) {
        while (isImplicit(stackTop())) {
          if (inImplicitCall())
            endImplicitCall();
          else if (inImplicitObject())
            endImplicitObject();
          else
            stack.pop();
        }
        stack.pop();
      }
      if (IMPLICIT_FUNC.has(tag) && token.spaced && (IMPLICIT_CALL.has(nextTag) || nextTag === "..." && IMPLICIT_CALL.has(tokens[i + 2]?.[0]) || IMPLICIT_UNSPACED_CALL.has(nextTag) && !nextToken.spaced && !nextToken.newLine) && !((tag === "]" || tag === "}") && (nextTag === "->" || nextTag === "=>"))) {
        startImplicitCall(i + 1);
        return forward(2);
      }
      if (IMPLICIT_FUNC.has(tag) && this.tokens[i + 1]?.[0] === "INDENT" && this.looksObjectish(i + 2) && !this.findTagsBackwards(i, ["CLASS", "EXTENDS", "IF", "CATCH", "SWITCH", "LEADING_WHEN", "FOR", "WHILE", "UNTIL"])) {
        startImplicitCall(i + 1);
        stack.push(["INDENT", i + 2]);
        return forward(3);
      }
      if (tag === "SPACE?")
        inTernary = true;
      if (tag === ":") {
        if (inTernary) {
          inTernary = false;
          return forward(1);
        }
        let s = EXPRESSION_END.has(this.tokens[i - 1]?.[0]) ? stack[stack.length - 1]?.[1] ?? i - 1 : i - 1;
        if (this.tokens[i - 2]?.[0] === "@")
          s = i - 2;
        let startsLine = s <= 0 || LINE_BREAK.has(this.tokens[s - 1]?.[0]) || this.tokens[s - 1]?.newLine;
        if (stackTop()) {
          let [stackTag, stackIdx] = stackTop();
          let stackNext = stack[stack.length - 2];
          if ((stackTag === "{" || stackTag === "INDENT" && stackNext?.[0] === "{" && !isImplicit(stackNext)) && (startsLine || this.tokens[s - 1]?.[0] === "," || this.tokens[s - 1]?.[0] === "{" || this.tokens[s]?.[0] === "{")) {
            return forward(1);
          }
        }
        startImplicitObject(s, { startsLine: !!startsLine });
        return forward(2);
      }
      if (LINE_BREAK.has(tag)) {
        for (let k = stack.length - 1;k >= 0; k--) {
          if (!isImplicit(stack[k]))
            break;
          if (stack[k][0] === "{")
            stack[k][2].sameLine = false;
        }
      }
      let newLine = prevTag === "OUTDENT" || prevToken.newLine;
      let isLogicalOp = tag === "||" || tag === "&&";
      let logicalKeep = false;
      if (isLogicalOp) {
        let j = i + 1, t = tokens[j]?.[0];
        if (t === "(" || t === "[" || t === "{") {
          for (let d = 1;++j < tokens.length && d > 0; ) {
            t = tokens[j][0];
            if (t === "(" || t === "[" || t === "{")
              d++;
            else if (t === ")" || t === "]" || t === "}")
              d--;
          }
        } else if (t && t !== "TERMINATOR" && t !== "OUTDENT" && t !== ",")
          j++;
        logicalKeep = tokens[j]?.[0] === ",";
      }
      if (IMPLICIT_END.has(tag) && !logicalKeep || CALL_CLOSERS.has(tag) && newLine) {
        while (isImplicit(stackTop())) {
          let [stackTag, , { sameLine, startsLine }] = stackTop();
          if (inImplicitCall() && prevTag !== ",") {
            endImplicitCall();
          } else if (inImplicitObject() && !isLogicalOp && sameLine && tag !== "TERMINATOR" && prevTag !== ":") {
            endImplicitObject();
          } else if (inImplicitObject() && tag === "TERMINATOR" && prevTag !== "," && !(startsLine && this.looksObjectish(i + 1))) {
            endImplicitObject();
          } else if (stackTop()?.[2]?.ours && stackTop()[0] === "CONTROL" && tokens[stackTop()[1]]?.[0] === "CLASS" && tag === "TERMINATOR") {
            stack.pop();
          } else {
            break;
          }
        }
      }
      if (tag === "," && !this.looksObjectish(i + 1) && inImplicitObject() && (nextTag !== "TERMINATOR" || !this.looksObjectish(i + 2))) {
        let offset = nextTag === "OUTDENT" ? 1 : 0;
        while (inImplicitObject())
          endImplicitObject(i + offset);
      }
      return forward(1);
    });
  }
  addImplicitCallCommas() {
    let callDepth = 0;
    let i = 0;
    let tokens = this.tokens;
    while (i < tokens.length) {
      let tag = tokens[i][0];
      let prevTag = i > 0 ? tokens[i - 1][0] : null;
      if (tag === "CALL_START" || tag === "(")
        callDepth++;
      if (tag === "CALL_END" || tag === ")")
        callDepth--;
      if (callDepth > 0 && (tag === "->" || tag === "=>") && IMPLICIT_COMMA_BEFORE_ARROW.has(prevTag)) {
        tokens.splice(i, 0, gen(",", ","));
        i++;
      }
      i++;
    }
  }
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
      if (EXPRESSION_START.has(token[0]))
        levels++;
      if (EXPRESSION_END.has(token[0]))
        levels--;
      if (levels < 0) {
        if (opts.returnOnNegativeLevel)
          return;
        return action.call(this, token, i);
      }
      i++;
    }
  }
  looksObjectish(j) {
    if (!this.tokens[j])
      return false;
    if (this.tokens[j]?.[0] === "@" && this.tokens[j + 2]?.[0] === ":")
      return true;
    if (this.tokens[j + 1]?.[0] === ":")
      return true;
    if (EXPRESSION_START.has(this.tokens[j]?.[0])) {
      let end = null;
      this.detectEnd(j + 1, (t) => EXPRESSION_END.has(t[0]), (t, i) => end = i);
      if (end && this.tokens[end + 1]?.[0] === ":")
        return true;
    }
    return false;
  }
  findTagsBackwards(i, tags) {
    let tagSet = new Set(tags);
    let backStack = [];
    while (i >= 0) {
      let tag = this.tokens[i]?.[0];
      if (!backStack.length && tagSet.has(tag))
        return true;
      if (EXPRESSION_END.has(tag))
        backStack.push(tag);
      if (EXPRESSION_START.has(tag) && backStack.length)
        backStack.pop();
      if (!backStack.length && (EXPRESSION_START.has(tag) && !this.tokens[i]?.generated || LINE_BREAK.has(tag)))
        break;
      i--;
    }
    return false;
  }
  makeIndentation(origin) {
    let indent = gen("INDENT", 2);
    let outdent = gen("OUTDENT", 2);
    if (origin) {
      indent.generated = outdent.generated = true;
      indent.origin = outdent.origin = origin;
    } else {
      indent.explicit = outdent.explicit = true;
    }
    return [indent, outdent];
  }
}
// src/parser.js
var parserInstance = {
  symbolIds: { $accept: 0, $end: 1, error: 2, Root: 3, Body: 4, Line: 5, TERMINATOR: 6, Expression: 7, ExpressionLine: 8, Statement: 9, Return: 10, STATEMENT: 11, Import: 12, Export: 13, Value: 14, Code: 15, Operation: 16, Assign: 17, ReactiveAssign: 18, ComputedAssign: 19, ReadonlyAssign: 20, ReactAssign: 21, If: 22, Try: 23, While: 24, For: 25, Switch: 26, Class: 27, Throw: 28, Yield: 29, Def: 30, CodeLine: 31, OperationLine: 32, Assignable: 33, Literal: 34, Parenthetical: 35, Range: 36, Invocation: 37, DoIife: 38, This: 39, Super: 40, MetaProperty: 41, AlphaNumeric: 42, JS: 43, Regex: 44, UNDEFINED: 45, NULL: 46, BOOL: 47, INFINITY: 48, NAN: 49, NUMBER: 50, String: 51, Identifier: 52, IDENTIFIER: 53, Property: 54, PROPERTY: 55, STRING: 56, STRING_START: 57, Interpolations: 58, STRING_END: 59, InterpolationChunk: 60, INTERPOLATION_START: 61, INTERPOLATION_END: 62, INDENT: 63, OUTDENT: 64, REGEX: 65, REGEX_START: 66, REGEX_END: 67, RegexWithIndex: 68, ",": 69, "=": 70, REACTIVE_ASSIGN: 71, COMPUTED_ASSIGN: 72, READONLY_ASSIGN: 73, REACT_ASSIGN: 74, SimpleAssignable: 75, Array: 76, Object: 77, ThisProperty: 78, ".": 79, "?.": 80, INDEX_START: 81, INDEX_END: 82, Slice: 83, ES6_OPTIONAL_INDEX: 84, "{": 85, ObjAssignable: 86, ":": 87, FOR: 88, ForVariables: 89, FOROF: 90, OptComma: 91, "}": 92, WHEN: 93, OWN: 94, AssignList: 95, AssignObj: 96, ObjRestValue: 97, SimpleObjAssignable: 98, "[": 99, "]": 100, "@": 101, "...": 102, ObjSpreadExpr: 103, SUPER: 104, Arguments: 105, DYNAMIC_IMPORT: 106, Elisions: 107, ArgElisionList: 108, OptElisions: 109, ArgElision: 110, Arg: 111, Elision: 112, RangeDots: 113, "..": 114, DEF: 115, CALL_START: 116, ParamList: 117, CALL_END: 118, Block: 119, PARAM_START: 120, PARAM_END: 121, FuncGlyph: 122, "->": 123, "=>": 124, Param: 125, ParamVar: 126, Splat: 127, ES6_OPTIONAL_CALL: 128, ArgList: 129, SimpleArgs: 130, THIS: 131, NEW_TARGET: 132, IMPORT_META: 133, "(": 134, ")": 135, RETURN: 136, THROW: 137, YIELD: 138, FROM: 139, IfBlock: 140, IF: 141, ELSE: 142, UnlessBlock: 143, UNLESS: 144, POST_IF: 145, POST_UNLESS: 146, TRY: 147, Catch: 148, FINALLY: 149, CATCH: 150, SWITCH: 151, Whens: 152, When: 153, LEADING_WHEN: 154, WhileSource: 155, WHILE: 156, UNTIL: 157, Loop: 158, LOOP: 159, FORIN: 160, BY: 161, FORAS: 162, AWAIT: 163, FORASAWAIT: 164, ForValue: 165, CLASS: 166, EXTENDS: 167, IMPORT: 168, ImportDefaultSpecifier: 169, ImportNamespaceSpecifier: 170, ImportSpecifierList: 171, ImportSpecifier: 172, AS: 173, DEFAULT: 174, IMPORT_ALL: 175, EXPORT: 176, ExportSpecifierList: 177, EXPORT_ALL: 178, ExportSpecifier: 179, UNARY: 180, DO: 181, DO_IIFE: 182, UNARY_MATH: 183, "-": 184, "+": 185, "--": 186, "++": 187, MATH: 188, "**": 189, SHIFT: 190, COMPARE: 191, "&": 192, "^": 193, "|": 194, "||": 195, "??": 196, "&&": 197, "!?": 198, RELATION: 199, "SPACE?": 200, COMPOUND_ASSIGN: 201 },
  tokenNames: { 2: "error", 6: "TERMINATOR", 11: "STATEMENT", 43: "JS", 45: "UNDEFINED", 46: "NULL", 47: "BOOL", 48: "INFINITY", 49: "NAN", 50: "NUMBER", 53: "IDENTIFIER", 55: "PROPERTY", 56: "STRING", 57: "STRING_START", 59: "STRING_END", 61: "INTERPOLATION_START", 62: "INTERPOLATION_END", 63: "INDENT", 64: "OUTDENT", 65: "REGEX", 66: "REGEX_START", 67: "REGEX_END", 69: ",", 70: "=", 71: "REACTIVE_ASSIGN", 72: "COMPUTED_ASSIGN", 73: "READONLY_ASSIGN", 74: "REACT_ASSIGN", 79: ".", 80: "?.", 81: "INDEX_START", 82: "INDEX_END", 84: "ES6_OPTIONAL_INDEX", 85: "{", 87: ":", 88: "FOR", 90: "FOROF", 92: "}", 93: "WHEN", 94: "OWN", 99: "[", 100: "]", 101: "@", 102: "...", 104: "SUPER", 106: "DYNAMIC_IMPORT", 114: "..", 115: "DEF", 116: "CALL_START", 118: "CALL_END", 120: "PARAM_START", 121: "PARAM_END", 123: "->", 124: "=>", 128: "ES6_OPTIONAL_CALL", 131: "THIS", 132: "NEW_TARGET", 133: "IMPORT_META", 134: "(", 135: ")", 136: "RETURN", 137: "THROW", 138: "YIELD", 139: "FROM", 141: "IF", 142: "ELSE", 144: "UNLESS", 145: "POST_IF", 146: "POST_UNLESS", 147: "TRY", 149: "FINALLY", 150: "CATCH", 151: "SWITCH", 154: "LEADING_WHEN", 156: "WHILE", 157: "UNTIL", 159: "LOOP", 160: "FORIN", 161: "BY", 162: "FORAS", 163: "AWAIT", 164: "FORASAWAIT", 166: "CLASS", 167: "EXTENDS", 168: "IMPORT", 173: "AS", 174: "DEFAULT", 175: "IMPORT_ALL", 176: "EXPORT", 178: "EXPORT_ALL", 180: "UNARY", 181: "DO", 182: "DO_IIFE", 183: "UNARY_MATH", 184: "-", 185: "+", 186: "--", 187: "++", 188: "MATH", 189: "**", 190: "SHIFT", 191: "COMPARE", 192: "&", 193: "^", 194: "|", 195: "||", 196: "??", 197: "&&", 198: "!?", 199: "RELATION", 200: "SPACE?", 201: "COMPOUND_ASSIGN" },
  parseTable: (() => {
    let d = [101, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, -1, 1, 2, 3, 4, 5, 6, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 39, 40, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 1, 1, 0, 2, 1, 5, -2, 101, 5, 1, 5, 56, 2, 71, -3, -3, -3, -3, -3, 30, 1, 5, 56, 1, 1, 5, 19, 12, 18, 17, 10, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -6, -6, -6, -6, -6, -6, 120, -6, -6, -6, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 9, 1, 5, 56, 1, 1, 5, 31, 18, 17, -7, -7, -7, -7, -7, -7, -7, -7, -7, 14, 1, 5, 56, 1, 1, 5, 31, 18, 17, 10, 1, 9, 1, 1, -8, -8, -8, -8, -8, -8, -8, -8, -8, 121, 122, 123, 90, 91, 51, 1, 5, 45, 5, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 3, 9, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -13, -13, 124, 99, 100, -13, -13, -13, -13, 127, 128, 129, -13, 130, -13, -13, -13, -13, -13, -13, -13, 125, -13, 131, -13, -13, 126, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, 44, 1, 5, 56, 1, 1, 5, 10, 1, 1, 1, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -14, -14, -14, -14, -14, -14, 132, 133, 134, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, 9, 1, 5, 56, 1, 1, 5, 31, 18, 17, -30, -30, -30, -30, -30, -30, -30, -30, -30, 9, 1, 5, 56, 1, 1, 5, 31, 18, 17, -31, -31, -31, -31, -31, -31, -31, -31, -31, 13, 1, 5, 56, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, 13, 1, 5, 56, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, 13, 1, 5, 56, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, 13, 1, 5, 56, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, 54, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -32, -32, -32, -32, -32, -32, -32, -32, 135, 136, 137, 138, 139, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, 18, 6, 46, 1, 10, 1, 5, 7, 1, 1, 7, 14, 2, 1, 15, 1, 3, 4, 1, -170, 144, 98, -170, -170, -170, 146, 147, 145, 93, 149, 148, 143, 140, -170, -170, 141, 142, 100, 5, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 4, 1, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 151, 4, 5, 6, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 152, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 150, 39, 40, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 97, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 153, 154, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 39, 40, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 97, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 156, 157, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 39, 40, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 158, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 164, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 165, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 166, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 167, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 45, 14, 1, 18, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 7, 14, 2, 3, 2, 14, 2, 1, 1, 7, 1, 1, 1, 48, 169, 170, 171, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 168, 66, 67, 87, 93, 77, 81, 78, 79, 159, 160, 84, 85, 80, 82, 83, 76, 163, 45, 14, 1, 18, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 7, 14, 2, 3, 2, 14, 2, 1, 1, 7, 1, 1, 1, 48, 169, 170, 171, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 172, 66, 67, 87, 93, 77, 81, 78, 79, 159, 160, 84, 85, 80, 82, 83, 76, 163, 57, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, 173, 174, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, 175, 96, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 177, 176, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 178, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, 179, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, 2, 63, 56, 152, 180, 2, 63, 56, 152, 181, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, 14, 36, 16, 1, 23, 1, 1, 7, 4, 5, 5, 2, 25, 37, 2, 185, 144, 98, 146, 147, 145, 93, 182, 183, 77, 148, 187, 184, 186, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 188, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 189, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 88, 1, 5, 8, 1, 18, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 1, 1, 1, 1, 3, 6, 1, 1, 1, 4, 3, 2, 1, 2, 2, 1, 6, 1, 1, 1, 2, 2, 8, 4, 1, 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 10, 1, 10, 1, 3, 1, 1, 2, 3, 15, 2, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -299, -299, 169, 170, 171, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, -299, 152, -299, 96, 97, -299, 192, 66, 67, 87, -299, 93, -299, -299, -299, -299, -299, 77, -299, 81, -299, 78, 79, -299, -299, 190, 159, -299, 160, 84, 85, 80, 82, 83, 76, -299, -299, -299, -299, -299, -299, -299, -299, -299, 191, 163, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 193, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 194, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 131, 1, 5, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 1, 1, 1, 1, 3, 5, 1, 1, 1, 1, 4, 3, 2, 1, 2, 2, 1, 6, 1, 1, 1, 2, 2, 8, 1, 3, 2, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -221, -221, 195, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, -221, 196, -221, 96, 97, -221, 50, 49, 66, 67, 87, -221, 93, -221, -221, -221, -221, -221, 77, -221, 81, -221, 78, 79, -221, 61, -221, 159, -221, 160, 84, 85, 80, 82, 83, 76, -221, 63, 59, 60, 197, 51, 88, 52, 89, -221, -221, 53, 57, 54, -221, -221, 55, 92, -221, -221, -221, 46, -221, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, 2, 52, 1, 198, 98, 6, 15, 16, 89, 2, 1, 1, 200, 199, 39, 40, 84, 85, 130, 1, 5, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 1, 1, 1, 1, 3, 5, 1, 1, 1, 1, 4, 3, 2, 1, 2, 2, 1, 6, 1, 1, 1, 2, 2, 8, 1, 3, 2, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -218, -218, 201, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, -218, 202, -218, 96, 97, -218, 50, 49, 66, 67, 87, -218, 93, -218, -218, -218, -218, -218, 77, -218, 81, -218, 78, 79, -218, 61, -218, 159, -218, 160, 84, 85, 80, 82, 83, 76, -218, 63, 59, 60, 51, 88, 52, 89, -218, -218, 53, 57, 54, -218, -218, 55, 92, -218, -218, -218, 46, -218, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, 9, 51, 1, 1, 3, 1, 28, 84, 1, 5, 203, 207, 98, 99, 100, 206, 204, 205, 208, 9, 27, 3, 22, 1, 32, 30, 51, 8, 4, 210, 211, 212, 98, 209, 61, 58, 213, 214, 54, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, 54, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, 100, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 215, 3, 4, 5, 6, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 216, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 39, 40, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 107, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 1, 1, 1, 2, 2, 1, 1, 2, 1, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 217, 226, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 223, 96, 97, 224, 50, 49, 66, 67, 87, 93, 56, 77, 218, 81, 228, 78, 79, 219, 220, 222, 225, 221, 61, 39, 40, 84, 85, 227, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 4, 79, 2, 24, 11, 230, 231, 229, 131, 2, 105, 11, 232, 131, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, 51, 1, 5, 48, 1, 1, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -203, -203, 233, 234, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, 1, 79, 235, 1, 79, 236, 51, 11, 32, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 2, 1, 8, 11, 3, 11, 2, 3, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, 51, 11, 32, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 2, 1, 8, 11, 3, 11, 2, 3, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, 58, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 17, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, 58, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 17, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 237, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 238, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 239, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 240, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 96, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 4, 1, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 242, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 152, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 241, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 23, 6, 36, 8, 1, 1, 1, 1, 1, 1, 1, 6, 1, 5, 9, 8, 6, 3, 1, 1, 1, 1, 2, 1, -106, 248, 94, 95, 250, 98, 251, 234, 99, 100, -106, -106, -106, 252, 243, -106, 244, 249, 253, 245, 246, 247, 254, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, -61, 45, 14, 1, 18, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 7, 14, 2, 3, 2, 14, 2, 1, 1, 7, 1, 1, 1, 48, 169, 170, 171, 31, 32, 33, 255, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 256, 66, 67, 87, 93, 77, 81, 78, 79, 159, 160, 84, 85, 80, 82, 83, 76, 163, 60, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 4, 6, 1, 10, 1, 3, 1, 1, 2, 3, 6, 11, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, 52, 1, 5, 50, 1, 2, 2, 1, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, 6, 51, 5, 1, 1, 2, 1, 260, 99, 100, 257, 258, 259, 103, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 2, 1, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, -5, 261, -5, 4, 5, 6, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, -5, -5, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 39, 40, 84, 85, 80, 82, 83, 76, -5, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 262, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 263, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 264, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 265, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 266, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 267, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 268, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 269, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 270, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 273, 155, 271, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 272, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 276, 155, 274, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 275, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 279, 155, 277, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 278, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 280, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 281, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 282, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 283, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 284, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, 14, 36, 16, 1, 23, 1, 1, 7, 4, 5, 5, 2, 25, 37, 2, 288, 144, 98, 146, 147, 145, 93, 285, 286, 77, 148, 187, 287, 186, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 289, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 290, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, 50, 1, 5, 50, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, 50, 1, 5, 50, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, 2, 105, 11, 291, 131, 2, 54, 1, 292, 234, 2, 54, 1, 293, 234, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 2, 6, 1, 1, 1, 1, 5, 2, 3, 11, 2, 1, 2, 2, 7, 1, 1, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 294, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 299, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 295, 96, 97, 297, 50, 49, 66, 67, 87, 296, 93, 56, 77, 81, 301, 78, 79, 298, 300, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 1, 81, 302, 103, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 5, 4, 3, 2, 2, 1, 1, 3, 2, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 307, 226, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 306, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 228, 78, 79, 305, 61, 303, 39, 40, 84, 85, 227, 304, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 2, 54, 1, 308, 234, 2, 54, 1, 309, 234, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 310, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 311, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 96, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 313, 312, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 314, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 96, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 316, 315, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 317, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 96, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 319, 318, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 320, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 96, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 322, 321, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 323, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 96, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 325, 324, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 326, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 9, 6, 57, 1, 5, 22, 1, 8, 18, 3, -214, -214, -214, 328, 329, -214, -214, -214, 327, 6, 6, 57, 1, 5, 49, 3, -171, -171, -171, -171, -171, -171, 7, 6, 57, 1, 5, 1, 48, 3, -175, -175, -175, -175, 330, -175, -175, 15, 6, 46, 1, 10, 1, 5, 7, 1, 1, 7, 14, 2, 17, 3, 5, -178, 144, 98, -178, -178, -178, 146, 147, 145, 93, 149, 148, -178, -178, 331, 11, 6, 57, 1, 5, 1, 20, 28, 3, 39, 2, 2, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, 11, 6, 57, 1, 5, 1, 20, 28, 3, 39, 2, 2, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, 11, 6, 57, 1, 5, 1, 20, 28, 3, 39, 2, 2, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, 11, 6, 57, 1, 5, 1, 20, 28, 3, 39, 2, 2, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, 2, 54, 1, 233, 234, 107, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 1, 1, 1, 2, 2, 1, 1, 2, 1, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 307, 226, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 223, 96, 97, 224, 50, 49, 66, 67, 87, 93, 56, 77, 218, 81, 228, 78, 79, 219, 220, 222, 225, 221, 61, 39, 40, 84, 85, 227, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, 9, 1, 5, 56, 1, 1, 5, 31, 18, 17, -167, -167, -167, -167, -167, -167, -167, -167, -167, 100, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 7, 1, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 333, 3, 4, 5, 6, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 332, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 39, 40, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, 118, 119, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, 112, -350, 114, -350, -350, 9, 1, 5, 56, 1, 1, 5, 31, 18, 17, -347, -347, -347, -347, -347, -347, -347, -347, -347, 5, 145, 1, 9, 1, 1, 121, 122, 123, 90, 91, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, 118, 119, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, 112, -351, 114, -351, -351, 9, 1, 5, 56, 1, 1, 5, 31, 18, 17, -348, -348, -348, -348, -348, -348, -348, -348, -348, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, 118, 119, -352, -352, -352, -352, -352, -352, -352, -352, -352, 105, -352, -352, -352, -352, -352, -352, 112, -352, 114, -352, -352, 18, 6, 46, 1, 10, 1, 5, 7, 1, 1, 7, 14, 2, 1, 15, 1, 3, 4, 1, -170, 144, 98, -170, -170, -170, 146, 147, 145, 93, 149, 148, 143, 334, -170, -170, 141, 142, 2, 63, 56, 152, 150, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 153, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 156, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 5, 15, 105, 2, 1, 1, 200, 159, 160, 84, 85, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, 118, 119, -353, -353, -353, -353, -353, -353, -353, -353, -353, 105, -353, -353, -353, -353, -353, -353, 112, -353, 114, -353, -353, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, 118, 119, -354, -354, -354, -354, -354, -354, -354, -354, -354, 105, -354, -354, -354, -354, -354, -354, 112, -354, 114, -354, -354, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, 118, 119, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, 112, -355, 114, -355, -355, 2, 77, 8, 335, 93, 54, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -357, -357, -83, -83, -357, -357, -357, -357, -83, -83, -83, -83, -83, -83, -83, -83, -357, -83, -357, -357, -357, -357, -357, -357, -357, -357, -83, -357, -357, -83, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, 10, 51, 5, 1, 22, 1, 1, 3, 21, 11, 12, 124, 99, 100, 127, 128, 129, 130, 125, 131, 126, 3, 79, 1, 1, 132, 133, 134, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, 54, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -358, -358, -83, -83, -358, -358, -358, -358, -83, -83, -83, -83, -83, -83, -83, -83, -358, -83, -358, -358, -358, -358, -358, -358, -358, -358, -83, -358, -358, -83, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, 96, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 338, 336, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 337, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -80, -80, -80, -80, -80, -80, -80, -80, 120, -80, -80, -80, -80, -80, -80, -80, -80, -80, 117, 118, 119, 90, 91, -80, -80, -80, -80, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 339, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 340, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 3, 63, 56, 22, 152, 341, 342, 44, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 2, 1, 1, 6, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, 343, 344, 345, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, 4, 90, 70, 2, 2, 347, 346, 348, 349, 11, 52, 1, 23, 1, 1, 7, 4, 10, 2, 25, 39, 144, 98, 146, 147, 145, 93, 350, 149, 148, 187, 186, 11, 52, 1, 23, 1, 1, 7, 4, 10, 2, 25, 39, 144, 98, 146, 147, 145, 93, 351, 149, 148, 187, 186, 3, 63, 56, 42, 152, 352, 353, 5, 69, 21, 70, 2, 2, 354, -297, -297, -297, -297, 6, 69, 1, 20, 70, 2, 2, -295, 355, -295, -295, -295, -295, 22, 63, 25, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 356, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 3, 152, 1, 1, 357, 358, 359, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 360, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 56, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 1, 2, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 17, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -303, -303, -83, -83, -303, 152, -303, -303, -83, -83, -83, -83, -83, -83, -83, -83, -303, -83, -303, -303, -303, -303, -303, -303, -303, -303, -83, -303, 361, -303, -83, -303, -303, -303, -303, -303, -303, -303, -303, -303, 362, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, 118, 119, -219, -219, -219, -219, -219, -219, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 2, 77, 8, 363, 93, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, 118, 119, -222, -222, -222, -222, -222, -222, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 2, 77, 8, 364, 93, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 365, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 3, 63, 53, 3, 152, 366, 367, 9, 1, 5, 56, 1, 1, 5, 31, 18, 17, -349, -349, -349, -349, -349, -349, -349, -349, -349, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, 118, 119, -216, -216, -216, -216, -216, -216, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 2, 77, 8, 368, 93, 13, 1, 5, 56, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, 2, 69, 70, 370, 369, 1, 139, 371, 7, 52, 1, 10, 29, 79, 1, 2, 376, 98, 375, 372, 373, 374, 377, 2, 69, 70, -323, -323, 1, 173, 378, 7, 52, 1, 10, 29, 82, 3, 2, 383, 98, 382, 379, 384, 380, 381, 13, 1, 5, 56, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, 13, 1, 5, 56, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, 1, 70, 385, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 386, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 387, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 1, 139, 388, 2, 6, 129, 101, 389, 99, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 390, 3, 4, 5, 6, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 39, 40, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 30, 6, 57, 1, 5, 19, 12, 2, 11, 1, 4, 27, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -196, -196, -196, -196, 120, -196, 301, 391, 300, -196, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 54, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, 103, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 1, 1, 1, 2, 2, 5, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 307, 226, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 224, 50, 49, 66, 67, 87, 93, 56, 77, 392, 81, 228, 78, 79, 394, 393, 61, 39, 40, 84, 85, 227, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 9, 6, 57, 1, 5, 22, 1, 8, 9, 9, -214, -214, -214, 396, 397, -214, -214, 395, -214, 56, 6, 5, 32, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 1, 1, 1, 3, 5, 11, 3, 11, 1, 1, 1, 2, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 398, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, 5, 6, 57, 1, 5, 31, -142, -142, -142, -142, -142, 106, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 1, 2, 1, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 307, 226, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 223, 96, 97, 224, 50, 49, 66, 67, 87, 93, 56, 77, 81, 228, 78, 79, 400, 399, 222, 225, 221, 61, 39, 40, 84, 85, 227, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 56, 6, 5, 32, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 1, 1, 1, 3, 5, 11, 3, 11, 1, 1, 1, 2, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, 5, 6, 57, 1, 5, 31, -147, -147, -147, -147, -147, 6, 6, 57, 1, 5, 31, 18, -197, -197, -197, -197, -197, -197, 6, 6, 57, 1, 5, 31, 18, -198, -198, -198, -198, -198, -198, 100, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 1, 1, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 1, 1, 3, 2, 9, 3, 2, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, -199, 401, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, -199, -199, 96, 97, -199, 50, 49, 66, 67, 87, 93, 56, 77, -199, 81, 78, 79, 61, -199, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 50, 1, 5, 50, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, 2, 54, 1, 402, 234, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 403, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 404, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 50, 1, 5, 50, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, 58, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 17, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, 58, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 17, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, 2, 54, 1, 405, 234, 2, 54, 1, 406, 234, 23, 63, 25, 31, 26, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 152, 120, 407, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 23, 63, 25, 31, 26, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 152, 120, 408, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -251, -251, -251, -251, -251, -251, -251, -251, 120, -251, -251, 409, -251, -251, -251, -251, -251, -251, -251, 118, 119, 90, 91, -251, -251, -251, -251, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -253, -253, -253, -253, -253, -253, -253, -253, 120, -253, -253, 410, -253, -253, -253, -253, -253, -253, -253, 118, 119, 90, 91, -253, -253, -253, -253, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -260, -260, -260, -260, -260, -260, -260, -260, 120, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, 118, 119, 90, 91, -260, -260, -260, -260, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 6, 6, 57, 1, 5, 18, 5, -111, -111, -111, -111, 411, -111, 8, 6, 57, 1, 5, 22, 1, 8, 18, -214, -214, -214, 413, 412, -214, -214, -214, 7, 6, 57, 1, 5, 1, 17, 5, -120, -120, -120, -120, 414, -120, -120, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 415, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 3, 54, 1, 44, 233, 234, 416, 6, 6, 57, 1, 5, 18, 5, -123, -123, -123, -123, -123, -123, 5, 6, 57, 1, 5, 23, -107, -107, -107, -107, -107, 11, 6, 57, 1, 5, 1, 9, 1, 1, 6, 5, 24, -117, -117, -117, -117, -117, -117, -117, -117, -117, -117, -117, 11, 6, 57, 1, 5, 1, 9, 1, 1, 6, 5, 24, -118, -118, -118, -118, -118, -118, -118, -118, -118, -118, -118, 11, 6, 57, 1, 5, 1, 9, 1, 1, 6, 5, 24, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, 5, 6, 57, 1, 5, 23, -112, -112, -112, -112, -112, 17, 35, 4, 1, 12, 1, 1, 1, 22, 1, 7, 13, 3, 2, 1, 2, 25, 3, 420, 422, 421, 250, 98, 251, 234, 419, 252, 93, 417, 81, 418, 423, 424, 80, 76, 50, 1, 5, 50, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -36, -36, -36, -36, -36, -36, -36, 425, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, 54, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, 6, 51, 5, 1, 2, 1, 1, 260, 99, 100, 426, 427, 259, 4, 56, 1, 2, 2, -55, -55, -55, -55, 101, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 1, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 428, 3, 4, 5, 6, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 430, 429, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 39, 40, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 4, 56, 1, 2, 2, -60, -60, -60, -60, 5, 1, 5, 56, 2, 71, -4, -4, -4, -4, -4, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, 118, 119, -361, -361, -361, -361, -361, -361, -361, -361, 104, 105, -361, -361, -361, -361, -361, -361, 112, -361, 114, -361, -361, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, 118, 119, -362, -362, -362, -362, -362, -362, -362, -362, 104, 105, -362, -362, -362, -362, -362, -362, 112, -362, 114, -362, -362, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, 118, 119, -363, -363, -363, -363, -363, -363, -363, -363, -363, 105, -363, -363, -363, -363, -363, -363, 112, -363, 114, -363, -363, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, 118, 119, -364, -364, -364, -364, -364, -364, -364, -364, -364, 105, -364, -364, -364, -364, -364, -364, 112, -364, 114, -364, -364, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -365, -365, -365, -365, -365, -365, -365, -365, -365, -365, -365, -365, -365, -365, -365, -365, -365, -365, -365, 118, 119, -365, -365, -365, -365, -365, -365, 103, 102, 104, 105, -365, -365, -365, -365, -365, -365, 112, -365, 114, -365, -365, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, 118, 119, -366, -366, -366, -366, -366, -366, 103, 102, 104, 105, 106, -366, -366, -366, -366, -366, 112, -366, 114, 115, -366, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, 118, 119, -367, -367, -367, -367, -367, -367, 103, 102, 104, 105, 106, 107, -367, -367, -367, -367, 112, -367, 114, 115, -367, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, 118, 119, -368, -368, -368, -368, -368, -368, 103, 102, 104, 105, 106, 107, 108, -368, -368, -368, 112, -368, 114, 115, -368, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, 118, 119, -369, -369, -369, -369, -369, -369, 103, 102, 104, 105, 106, 107, 108, 109, -369, -369, 112, -369, 114, 115, -369, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, 118, 119, -377, -377, -377, -377, -377, -377, 103, 102, 104, 105, 106, 107, 108, 109, 110, -377, 112, 113, 114, 115, -377, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -378, -378, -378, -378, -378, -378, -378, -378, 120, -378, -378, -378, -378, -378, -378, -378, -378, -378, 117, 118, 119, 90, 91, -378, -378, -378, -378, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, 118, 119, -376, -376, -376, -376, -376, -376, 103, 102, 104, 105, 106, 107, 108, 109, 110, -376, 112, -376, 114, 115, -376, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -379, -379, -379, -379, -379, -379, -379, -379, 120, -379, -379, -379, -379, -379, -379, -379, -379, -379, 117, 118, 119, 90, 91, -379, -379, -379, -379, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, 118, 119, -380, -380, -380, -380, -380, -380, 103, 102, 104, 105, 106, -380, -380, -380, -380, -380, 112, -380, 114, -380, -380, 22, 87, 1, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 431, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -233, -233, -233, -233, -233, -233, -233, -233, 120, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, 118, 119, 90, 91, -233, -233, -233, -233, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -235, -235, -235, -235, -235, -235, -235, -235, 120, -235, -235, -235, -235, -235, -235, -235, -235, -235, 117, 118, 119, 90, 91, -235, -235, -235, -235, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 4, 90, 70, 2, 2, 433, 432, 434, 435, 11, 52, 1, 23, 1, 1, 7, 4, 10, 2, 25, 39, 144, 98, 146, 147, 145, 93, 436, 149, 148, 187, 186, 11, 52, 1, 23, 1, 1, 7, 4, 10, 2, 25, 39, 144, 98, 146, 147, 145, 93, 437, 149, 148, 187, 186, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, 438, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -232, -232, -232, -232, -232, -232, -232, -232, 120, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, 118, 119, 90, 91, -232, -232, -232, -232, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -234, -234, -234, -234, -234, -234, -234, -234, 120, -234, -234, -234, -234, -234, -234, -234, -234, -234, 117, 118, 119, 90, 91, -234, -234, -234, -234, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 50, 1, 5, 50, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, 58, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 17, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, 58, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 17, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, 25, 82, 6, 14, 11, 1, 31, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 439, 120, 301, 440, 300, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 5, 2, 3, 11, 2, 1, 2, 2, 7, 1, 1, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 441, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 442, 93, 56, 77, 81, 301, 78, 79, 298, 300, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 1, 82, 443, 1, 82, 444, 96, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 7, 1, 1, 8, 1, 1, 1, 1, 4, 3, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 445, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, -161, 96, 97, 50, 49, 66, 67, 87, -161, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -43, -43, -43, -43, -43, -43, -43, 446, -43, -43, -43, -64, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, 52, 11, 32, 2, 1, 1, 1, 1, 1, 3, 3, 1, 7, 1, 1, 8, 8, 3, 3, 11, 2, 3, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, 52, 11, 32, 2, 1, 1, 1, 1, 1, 3, 3, 1, 7, 1, 1, 8, 8, 3, 3, 11, 2, 3, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 447, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 448, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 50, 1, 5, 50, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, 8, 6, 57, 1, 5, 22, 1, 8, 18, -214, -214, -214, 450, 449, -214, -214, -214, 5, 6, 57, 1, 5, 49, -191, -191, -191, -191, -191, 102, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 5, 4, 5, 2, 1, 1, 3, 2, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 307, 226, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 306, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 228, 78, 79, 305, 61, 39, 40, 84, 85, 227, 451, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 27, 6, 57, 1, 5, 19, 12, 18, 27, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -196, -196, -196, -196, 120, -196, -196, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 58, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 17, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, 58, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 17, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, 22, 82, 6, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 452, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 453, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, 118, 119, -65, -65, -65, -65, -65, -65, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 454, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 455, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -68, -68, -68, -68, -68, -68, -68, -68, 120, -68, -68, -68, -68, -68, -68, -68, -68, -68, 117, 118, 119, 90, 91, -68, -68, -68, -68, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 456, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 457, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -71, -71, -71, -71, -71, -71, -71, -71, 120, -71, -71, -71, -71, -71, -71, -71, -71, -71, 117, 118, 119, 90, 91, -71, -71, -71, -71, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 458, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 459, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -74, -74, -74, -74, -74, -74, -74, -74, 120, -74, -74, -74, -74, -74, -74, -74, -74, -74, 117, 118, 119, 90, 91, -74, -74, -74, -74, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 460, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 461, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -77, -77, -77, -77, -77, -77, -77, -77, 120, -77, -77, -77, -77, -77, -77, -77, -77, -77, 117, 118, 119, 90, 91, -77, -77, -77, -77, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 462, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 463, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 3, 122, 1, 1, 464, 84, 85, 17, 6, 46, 1, 10, 1, 12, 1, 1, 7, 7, 7, 1, 1, 1, 16, 7, 1, -215, 144, 98, -215, -215, 146, 147, 145, 93, -215, 149, -215, 148, 143, -215, 465, 142, 2, 6, 57, 466, 467, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 468, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 6, 6, 57, 1, 5, 49, 3, -177, -177, -177, -177, -177, -177, 53, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 3, 1, 4, 2, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, 2, 6, 58, 101, 469, 9, 6, 57, 1, 5, 22, 1, 8, 18, 3, -214, -214, -214, 328, 329, -214, -214, -214, 470, 1, 64, 471, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, 118, 119, -382, -382, -382, -382, -382, -382, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 472, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 473, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -81, -81, -81, -81, -81, -81, -81, -81, 120, -81, -81, -81, -81, -81, -81, -81, -81, -81, 117, 118, 119, 90, 91, -81, -81, -81, -81, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 22, 64, 24, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 474, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 475, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 3, 7, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, 476, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, 2, 63, 56, 152, 477, 6, 52, 1, 10, 14, 8, 34, 478, 98, 152, 479, 93, 480, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 481, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 482, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 483, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 484, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 1, 90, 485, 1, 162, 486, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 487, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 10, 52, 1, 23, 1, 1, 7, 14, 2, 25, 39, 144, 98, 146, 147, 145, 93, 149, 148, 187, 488, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 489, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 3, 152, 1, 1, 490, 358, 359, 4, 64, 78, 11, 1, 491, 492, 493, 359, 3, 64, 78, 12, -247, -247, -247, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 6, 1, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 495, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 494, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 43, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 1, 2, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -301, -301, -301, 152, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, 496, -301, -301, -301, 118, 119, -301, -301, -301, -301, -301, -301, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 497, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 1, 64, 498, 1, 64, 499, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, 118, 119, -224, -224, -224, -224, -224, -224, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 18, 6, 46, 1, 10, 1, 5, 7, 1, 1, 7, 14, 2, 1, 15, 1, 3, 4, 1, -170, 144, 98, -170, -170, -170, 146, 147, 145, 93, 149, 148, 143, 500, -170, -170, 141, 142, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, 1, 64, 501, 3, 51, 5, 1, 502, 99, 100, 3, 85, 85, 5, 504, 503, 208, 3, 51, 5, 1, 505, 99, 100, 1, 139, 506, 8, 6, 57, 1, 5, 22, 1, 8, 18, -214, -214, -214, 508, 507, -214, -214, -214, 5, 6, 57, 1, 5, 23, -314, -314, -314, -314, -314, 6, 52, 1, 10, 108, 1, 2, 376, 98, 375, 509, 374, 377, 6, 6, 57, 1, 5, 23, 81, -319, -319, -319, -319, -319, 510, 6, 6, 57, 1, 5, 23, 81, -321, -321, -321, -321, -321, 511, 2, 52, 1, 512, 98, 14, 1, 5, 56, 1, 1, 5, 31, 18, 17, 4, 6, 1, 10, 1, -325, -325, -325, -325, -325, -325, -325, -325, -325, 513, -325, -325, -325, -325, 8, 6, 57, 1, 5, 22, 1, 8, 18, -214, -214, -214, 515, 514, -214, -214, -214, 5, 6, 57, 1, 5, 23, -337, -337, -337, -337, -337, 6, 52, 1, 10, 111, 3, 2, 383, 98, 382, 384, 516, 381, 6, 6, 57, 1, 5, 23, 81, -342, -342, -342, -342, -342, 517, 6, 6, 57, 1, 5, 23, 81, -345, -345, -345, -345, -345, 518, 96, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 520, 519, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 521, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 30, 1, 5, 56, 1, 1, 5, 19, 12, 18, 17, 10, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -332, -332, -332, -332, -332, -332, 120, -332, -332, -332, -332, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 2, 77, 8, 522, 93, 3, 51, 5, 1, 523, 99, 100, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, 2, 6, 58, 101, 524, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 525, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 54, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, -140, 56, 6, 5, 32, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 1, 1, 1, 3, 5, 11, 3, 11, 1, 1, 1, 2, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 398, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, 5, 6, 57, 1, 5, 31, -148, -148, -148, -148, -148, 2, 63, 37, 527, 526, 110, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 1, 1, 1, 3, 5, 1, 1, 1, 1, 7, 3, 4, 7, 1, 1, 1, 2, 2, 1, 3, 1, 1, 3, 3, 2, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, -215, 307, 226, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, -215, -215, 96, 97, 224, 50, 49, 66, 67, 87, 93, 56, -215, 77, -215, 81, 228, 78, 79, 529, 528, 225, 221, 61, -215, 39, 40, 84, 85, 227, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 4, 6, 57, 1, 36, 530, -149, -149, -149, 56, 6, 5, 32, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 1, 1, 1, 3, 5, 11, 3, 11, 1, 1, 1, 2, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, 9, 6, 57, 1, 5, 22, 1, 8, 9, 9, -214, -214, -214, 396, 397, -214, -214, 531, -214, 102, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 5, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 307, 226, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 224, 50, 49, 66, 67, 87, 93, 56, 77, 81, 228, 78, 79, 394, 393, 61, 39, 40, 84, 85, 227, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 27, 6, 57, 1, 5, 19, 12, 18, 27, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -183, -183, -183, -183, 120, -183, -183, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, 22, 82, 6, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 532, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 533, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, 534, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 535, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 536, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 537, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 538, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 3, 6, 57, 29, 540, 541, 539, 23, 6, 36, 8, 1, 1, 1, 1, 1, 1, 1, 6, 1, 14, 8, 6, 4, 1, 1, 1, 1, 1, 1, 16, -215, 248, 94, 95, 250, 98, 251, 234, 99, 100, -215, -215, 252, 543, -215, 542, 253, 245, 246, -215, 247, 254, -215, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 544, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 545, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 22, 88, 12, 45, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 120, 546, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 547, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 10, 6, 57, 1, 5, 10, 1, 1, 11, 13, 11, -124, -124, -124, -124, -126, -126, -126, -124, 548, 131, 10, 6, 57, 1, 5, 10, 1, 1, 11, 13, 11, -125, -125, -125, -125, 550, 551, 552, -125, 549, 131, 9, 6, 57, 1, 5, 10, 1, 1, 11, 24, -127, -127, -127, -127, -127, -127, -127, -127, -127, 9, 6, 57, 1, 5, 10, 1, 1, 11, 24, -128, -128, -128, -128, -128, -128, -128, -128, -128, 9, 6, 57, 1, 5, 10, 1, 1, 11, 24, -129, -129, -129, -129, -129, -129, -129, -129, -129, 9, 6, 57, 1, 5, 10, 1, 1, 11, 24, -130, -130, -130, -130, -130, -130, -130, -130, -130, 4, 79, 2, 24, 11, 230, 231, 553, 131, 2, 105, 11, 554, 131, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, 52, 1, 5, 50, 1, 2, 2, 1, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, 4, 56, 1, 2, 2, -56, -56, -56, -56, 2, 6, 56, 101, 555, 99, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 556, 3, 4, 5, 6, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 39, 40, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 4, 56, 1, 2, 2, -59, -59, -59, -59, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 557, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 558, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 559, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 560, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 561, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 1, 90, 562, 1, 162, 563, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 564, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 58, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 17, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, 96, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 7, 1, 1, 8, 1, 1, 1, 1, 4, 3, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 565, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, -159, 96, 97, 50, 49, 66, 67, 87, -159, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 25, 64, 24, 14, 11, 1, 31, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 566, 120, 301, 440, 300, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 1, 64, 567, 58, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 17, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, 58, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 17, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, 23, 64, 18, 6, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -160, -160, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 568, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 22, 82, 6, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 569, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 570, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 3, 6, 57, 55, 572, 573, 571, 106, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 1, 1, 1, 8, 1, 1, 1, 1, 7, 3, 4, 7, 1, 1, 1, 2, 2, 5, 4, 3, 2, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, -215, 307, 226, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, -215, -215, 96, 97, 50, 49, 66, 67, 87, 93, 56, -215, 77, -215, 81, 228, 78, 79, 574, 61, -215, 39, 40, 84, 85, 227, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 8, 6, 57, 1, 5, 22, 1, 8, 18, -214, -214, -214, 450, 575, -214, -214, -214, 58, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 17, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, 22, 64, 24, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 576, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, 118, 119, -66, -66, -66, -66, -66, -66, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 22, 64, 24, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 577, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -69, -69, -69, -69, -69, -69, -69, -69, 120, -69, -69, -69, -69, -69, -69, -69, -69, -69, 117, 118, 119, 90, 91, -69, -69, -69, -69, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 22, 64, 24, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 578, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -72, -72, -72, -72, -72, -72, -72, -72, 120, -72, -72, -72, -72, -72, -72, -72, -72, -72, 117, 118, 119, 90, 91, -72, -72, -72, -72, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 22, 64, 24, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 579, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -75, -75, -75, -75, -75, -75, -75, -75, 120, -75, -75, -75, -75, -75, -75, -75, -75, -75, 117, 118, 119, 90, 91, -75, -75, -75, -75, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 22, 64, 24, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 580, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -78, -78, -78, -78, -78, -78, -78, -78, 120, -78, -78, -78, -78, -78, -78, -78, -78, -78, 117, 118, 119, 90, 91, -78, -78, -78, -78, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 22, 64, 24, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 581, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 100, 5, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 4, 1, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 583, 4, 5, 6, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 152, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 582, 39, 40, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 6, 6, 57, 1, 5, 49, 3, -172, -172, -172, -172, -172, -172, 11, 52, 1, 23, 1, 1, 7, 14, 2, 1, 23, 1, 144, 98, 146, 147, 145, 93, 149, 148, 143, 584, 142, 18, 6, 46, 1, 10, 1, 5, 7, 1, 1, 7, 14, 2, 1, 15, 1, 3, 4, 1, -170, 144, 98, -170, -170, -170, 146, 147, 145, 93, 149, 148, 143, 585, -170, -170, 141, 142, 27, 6, 57, 1, 5, 19, 30, 3, 24, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -176, -176, -176, -176, 120, -176, -176, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 53, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 3, 1, 4, 2, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, 3, 122, 1, 1, 586, 84, 85, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, 22, 64, 24, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 587, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, 118, 119, -384, -384, -384, -384, -384, -384, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, 23, 63, 25, 31, 26, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 152, 120, 588, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 2, 63, 56, 152, 589, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, 2, 63, 56, 152, 590, 2, 63, 56, 152, 591, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 3, 7, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, 25, 63, 25, 5, 26, 26, 1, 9, 1, 1, 4, 23, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 152, 120, 593, 592, 117, 118, 119, 90, 91, 594, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 24, 63, 25, 5, 26, 26, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 152, 120, 596, 595, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 24, 63, 25, 5, 26, 26, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 152, 120, 598, 597, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 24, 63, 25, 5, 26, 26, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 152, 120, 600, 599, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 601, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 602, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 23, 63, 25, 31, 26, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 152, 120, 603, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 4, 90, 70, 2, 2, -298, -298, -298, -298, 26, 69, 19, 2, 55, 1, 9, 1, 1, 3, 2, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -296, 120, -296, 117, 118, 119, 90, 91, -296, -296, -296, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 4, 64, 78, 11, 1, 604, 605, 493, 359, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, 2, 63, 56, 152, 606, 3, 64, 78, 12, -248, -248, -248, 3, 63, 6, 50, 152, 608, 607, 23, 63, 6, 19, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -200, -200, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, 43, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 1, 2, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -305, -305, -305, 152, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, 609, -305, -305, -305, 118, 119, -305, -305, -305, -305, -305, -305, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, 8, 6, 57, 1, 5, 22, 1, 8, 18, -214, -214, -214, 328, 329, -214, -214, 610, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, 13, 1, 5, 56, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, 1, 139, 611, 6, 52, 1, 10, 108, 1, 2, 376, 98, 375, 612, 374, 377, 13, 1, 5, 56, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, 3, 51, 5, 1, 613, 99, 100, 3, 6, 57, 29, 615, 616, 614, 10, 6, 46, 1, 10, 1, 28, 8, 18, 54, 2, -215, 376, 98, -215, -215, -215, -215, -215, 617, 377, 8, 6, 57, 1, 5, 22, 1, 8, 18, -214, -214, -214, 508, 618, -214, -214, -214, 2, 52, 1, 619, 98, 2, 52, 1, 620, 98, 1, 139, -324, 3, 51, 5, 1, 621, 99, 100, 3, 6, 57, 29, 623, 624, 622, 10, 6, 46, 1, 10, 1, 28, 8, 18, 56, 5, -215, 383, 98, -215, -215, -215, -215, -215, 384, 625, 8, 6, 57, 1, 5, 22, 1, 8, 18, -214, -214, -214, 515, 626, -214, -214, -214, 3, 52, 1, 121, 627, 98, 628, 2, 52, 1, 629, 98, 30, 1, 5, 56, 1, 1, 5, 19, 12, 18, 17, 10, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -329, -329, -329, -329, -329, -329, 120, -329, -329, -329, -329, 118, 119, -329, -329, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 630, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 631, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 1, 64, 632, 13, 1, 5, 56, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, 1, 135, 633, 22, 88, 12, 45, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 120, 634, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 54, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, 106, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 1, 2, 1, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 307, 226, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 223, 96, 97, 224, 50, 49, 66, 67, 87, 93, 56, 77, 81, 228, 78, 79, 400, 635, 222, 225, 221, 61, 39, 40, 84, 85, 227, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 5, 6, 57, 1, 5, 31, -143, -143, -143, -143, -143, 105, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 1, 1, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 1, 1, 1, 2, 2, 5, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 307, 226, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, -150, -150, 96, 97, 224, 50, 49, 66, 67, 87, 93, 56, 77, -150, 81, 228, 78, 79, 394, 393, 61, 39, 40, 84, 85, 227, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 104, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 3, 1, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 307, 226, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 224, 50, 49, 66, 67, 87, 93, 56, 77, 81, 228, 78, 79, 400, 636, 225, 221, 61, 39, 40, 84, 85, 227, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 2, 63, 1, 527, 637, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, 22, 64, 24, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 638, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 2, 63, 56, 152, 639, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, 118, 119, -252, -252, -252, -252, -252, -252, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, 118, 119, -254, -254, -254, -254, -254, -254, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 26, 6, 57, 1, 5, 19, 4, 53, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -113, -113, -113, -113, 640, -113, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 641, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 54, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, 17, 42, 8, 1, 1, 1, 1, 1, 1, 1, 21, 8, 10, 1, 1, 1, 2, 1, 248, 94, 95, 250, 98, 251, 234, 99, 100, 252, 543, 642, 253, 245, 246, 247, 254, 23, 6, 36, 8, 1, 1, 1, 1, 1, 1, 1, 6, 1, 5, 9, 8, 6, 3, 1, 1, 1, 1, 2, 1, -106, 248, 94, 95, 250, 98, 251, 234, 99, 100, -106, -106, -106, 252, 543, -106, 643, 249, 253, 245, 246, 247, 254, 5, 6, 57, 1, 5, 23, -108, -108, -108, -108, -108, 6, 6, 57, 1, 5, 18, 5, -111, -111, -111, -111, 644, -111, 26, 6, 57, 1, 5, 19, 4, 53, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -115, -115, -115, -115, 120, -115, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 645, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 6, 6, 57, 1, 5, 18, 5, -121, -121, -121, -121, -121, -121, 22, 88, 12, 45, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 120, 646, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 9, 6, 57, 1, 5, 10, 1, 1, 11, 24, -133, -133, -133, -133, -133, -133, -133, -133, -133, 9, 6, 57, 1, 5, 10, 1, 1, 11, 24, -134, -134, -134, -134, -134, -134, -134, -134, -134, 2, 54, 1, 647, 234, 2, 54, 1, 648, 234, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 649, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 650, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 9, 6, 57, 1, 5, 10, 1, 1, 11, 24, -131, -131, -131, -131, -131, -131, -131, -131, -131, 9, 6, 57, 1, 5, 10, 1, 1, 11, 24, -132, -132, -132, -132, -132, -132, -132, -132, -132, 4, 56, 1, 2, 2, -57, -57, -57, -57, 2, 6, 58, 101, 651, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, 118, 119, -381, -381, -381, -381, -381, -381, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, 652, -278, -278, -278, -278, -278, -278, -278, 118, 119, -278, -278, -278, 653, -278, -278, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, 654, -283, -283, -283, -283, -283, -283, -283, 118, 119, -283, -283, -283, -283, -283, -283, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, 655, -287, -287, -287, -287, -287, -287, -287, 118, 119, -287, -287, -287, -287, -287, -287, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, 656, -291, -291, -291, -291, -291, -291, -291, 118, 119, -291, -291, -291, -291, -291, -291, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 657, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 658, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, 118, 119, -294, -294, -294, -294, -294, -294, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 23, 64, 18, 6, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -158, -158, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 1, 82, 659, 1, 82, 660, 22, 82, 6, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -63, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 58, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 17, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, 22, 64, 24, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 661, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 50, 1, 5, 50, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, 100, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 5, 4, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 307, 226, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 228, 78, 79, 662, 61, 39, 40, 84, 85, 227, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 102, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 5, 4, 5, 2, 1, 1, 3, 2, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 307, 226, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 306, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 228, 78, 79, 305, 61, 39, 40, 84, 85, 227, 663, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 41, 42, 62, 43, 44, 45, 47, 48, 5, 6, 57, 1, 5, 49, -192, -192, -192, -192, -192, 3, 6, 57, 1, 572, 573, 664, 1, 82, 665, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, 9, 1, 5, 56, 1, 1, 5, 31, 18, 17, -166, -166, -166, -166, -166, -166, -166, -166, -166, 6, 6, 57, 1, 5, 49, 3, -173, -173, -173, -173, -173, -173, 8, 6, 57, 1, 5, 22, 1, 8, 18, -214, -214, -214, 328, 666, -214, -214, -214, 2, 63, 56, 152, 582, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 3, 7, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 3, 7, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 667, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 668, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 669, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 670, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 671, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 24, 63, 25, 5, 26, 26, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 152, 120, 673, 672, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 24, 63, 25, 5, 26, 26, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 152, 120, 675, 674, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, 2, 63, 56, 152, 676, 1, 64, 677, 4, 6, 58, 78, 12, 678, -249, -249, -249, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 679, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, 2, 63, 56, 152, 680, 3, 51, 5, 1, 681, 99, 100, 8, 6, 57, 1, 5, 22, 1, 8, 18, -214, -214, -214, 508, 682, -214, -214, -214, 13, 1, 5, 56, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, 1, 139, 683, 4, 52, 1, 119, 2, 376, 98, 684, 377, 6, 52, 1, 10, 108, 1, 2, 376, 98, 375, 685, 374, 377, 5, 6, 57, 1, 5, 23, -315, -315, -315, -315, -315, 3, 6, 57, 1, 615, 616, 686, 5, 6, 57, 1, 5, 23, -320, -320, -320, -320, -320, 5, 6, 57, 1, 5, 23, -322, -322, -322, -322, -322, 13, 1, 5, 56, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, 14, 1, 5, 56, 1, 1, 5, 31, 18, 17, 4, 6, 1, 10, 1, -326, -326, -326, -326, -326, -326, -326, -326, -326, 687, -326, -326, -326, -326, 4, 52, 1, 121, 5, 383, 98, 384, 688, 6, 52, 1, 10, 111, 3, 2, 383, 98, 382, 384, 689, 381, 5, 6, 57, 1, 5, 23, -338, -338, -338, -338, -338, 3, 6, 57, 1, 623, 624, 690, 5, 6, 57, 1, 5, 23, -343, -343, -343, -343, -343, 5, 6, 57, 1, 5, 23, -344, -344, -344, -344, -344, 5, 6, 57, 1, 5, 23, -346, -346, -346, -346, -346, 30, 1, 5, 56, 1, 1, 5, 19, 12, 18, 17, 10, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -330, -330, -330, -330, -330, -330, 120, -330, -330, -330, -330, 118, 119, -330, -330, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 22, 64, 24, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 691, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 13, 1, 5, 56, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, 9, 6, 57, 1, 5, 22, 1, 8, 9, 9, -214, -214, -214, 396, 397, -214, -214, 692, -214, 5, 6, 57, 1, 5, 31, -144, -144, -144, -144, -144, 5, 6, 57, 1, 5, 31, -145, -145, -145, -145, -145, 1, 82, 693, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, 14, 36, 16, 1, 23, 1, 1, 7, 4, 5, 5, 2, 25, 37, 2, 288, 144, 98, 146, 147, 145, 93, 694, 695, 77, 148, 187, 287, 186, 22, 64, 24, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 696, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 5, 6, 57, 1, 5, 23, -109, -109, -109, -109, -109, 8, 6, 57, 1, 5, 22, 1, 8, 18, -214, -214, -214, 413, 697, -214, -214, -214, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 698, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 538, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 22, 64, 24, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 699, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 6, 6, 57, 1, 5, 18, 5, -122, -122, -122, -122, -122, -122, 9, 6, 57, 1, 5, 10, 1, 1, 11, 24, -135, -135, -135, -135, -135, -135, -135, -135, -135, 9, 6, 57, 1, 5, 10, 1, 1, 11, 24, -136, -136, -136, -136, -136, -136, -136, -136, -136, 22, 82, 6, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 700, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 701, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 1, 62, 702, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 703, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 704, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 705, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 706, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 707, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, 708, -285, -285, -285, -285, -285, -285, -285, 118, 119, -285, -285, -285, -285, -285, -285, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, 709, -289, -289, -289, -289, -289, -289, -289, 118, 119, -289, -289, -289, -289, -289, -289, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 58, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 17, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, 58, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 17, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, 1, 82, 710, 5, 6, 57, 1, 5, 49, -193, -193, -193, -193, -193, 8, 6, 57, 1, 5, 22, 1, 8, 18, -214, -214, -214, 450, 711, -214, -214, -214, 5, 6, 57, 1, 5, 49, -194, -194, -194, -194, -194, 58, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 17, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, 3, 6, 57, 1, 466, 467, 712, 24, 63, 25, 31, 26, 1, 9, 1, 1, 4, 23, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 152, 120, 713, 117, 118, 119, 90, 91, 714, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 24, 63, 25, 5, 26, 26, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 152, 120, 716, 715, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 23, 63, 25, 31, 26, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 152, 120, 717, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 23, 63, 25, 31, 26, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 152, 120, 718, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 23, 63, 25, 31, 26, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 152, 120, 719, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 720, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 721, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 1, 64, 722, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, 3, 64, 78, 12, -250, -250, -250, 23, 63, 6, 19, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -201, -201, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, 13, 1, 5, 56, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, 3, 6, 57, 29, 615, 616, 723, 3, 51, 5, 1, 724, 99, 100, 5, 6, 57, 1, 5, 23, -316, -316, -316, -316, -316, 8, 6, 57, 1, 5, 22, 1, 8, 18, -214, -214, -214, 508, 725, -214, -214, -214, 5, 6, 57, 1, 5, 23, -317, -317, -317, -317, -317, 3, 51, 5, 1, 726, 99, 100, 5, 6, 57, 1, 5, 23, -339, -339, -339, -339, -339, 8, 6, 57, 1, 5, 22, 1, 8, 18, -214, -214, -214, 515, 727, -214, -214, -214, 5, 6, 57, 1, 5, 23, -340, -340, -340, -340, -340, 13, 1, 5, 56, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, 2, 63, 1, 527, 728, 49, 1, 5, 50, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, 4, 90, 70, 2, 2, 729, 432, 434, 435, 11, 52, 1, 23, 1, 1, 7, 4, 10, 2, 25, 39, 144, 98, 146, 147, 145, 93, 730, 149, 148, 187, 186, 5, 6, 57, 1, 5, 23, -114, -114, -114, -114, -114, 3, 6, 57, 1, 540, 541, 731, 26, 6, 57, 1, 5, 19, 4, 53, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -113, -113, -113, -113, 120, -113, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 5, 6, 57, 1, 5, 23, -116, -116, -116, -116, -116, 9, 6, 57, 1, 5, 10, 1, 1, 11, 24, -137, -137, -137, -137, -137, -137, -137, -137, -137, 22, 64, 24, 57, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 732, 120, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 4, 56, 1, 2, 2, -58, -58, -58, -58, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, 118, 119, -279, -279, -279, 733, -279, -279, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, 734, -280, -280, -280, -280, -280, -280, -280, 118, 119, -280, -280, -280, -280, -280, -280, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, 118, 119, -284, -284, -284, -284, -284, -284, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, 118, 119, -288, -288, -288, -288, -288, -288, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, 118, 119, -292, -292, -292, -292, -292, -292, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 735, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 736, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 58, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 17, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, 3, 6, 57, 1, 572, 573, 737, 6, 6, 57, 1, 5, 49, 3, -174, -174, -174, -174, -174, -174, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 738, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 739, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, 23, 63, 25, 31, 26, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 152, 120, 740, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 23, 63, 25, 31, 26, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 152, 120, 741, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, 1, 139, 742, 13, 1, 5, 56, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, 3, 6, 57, 1, 615, 616, 743, 13, 1, 5, 56, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, 3, 6, 57, 1, 623, 624, 744, 5, 6, 57, 1, 5, 31, -146, -146, -146, -146, -146, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 745, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 1, 90, 746, 5, 6, 57, 1, 5, 23, -110, -110, -110, -110, -110, 1, 82, 747, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 748, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 749, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, 118, 119, -286, -286, -286, -286, -286, -286, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, 118, 119, -290, -290, -290, -290, -290, -290, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 5, 6, 57, 1, 5, 49, -195, -195, -195, -195, -195, 23, 63, 25, 31, 26, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 152, 120, 750, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 23, 63, 25, 31, 26, 1, 9, 1, 1, 27, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 152, 120, 751, 117, 118, 119, 90, 91, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, 3, 51, 5, 1, 752, 99, 100, 5, 6, 57, 1, 5, 23, -318, -318, -318, -318, -318, 5, 6, 57, 1, 5, 23, -341, -341, -341, -341, -341, 43, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 1, 1, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -283, -283, -283, -283, -283, 755, -283, -283, -283, -283, 753, -283, 754, -283, -283, -283, -283, -283, -283, -283, 118, 119, -283, -283, -283, -283, -283, -283, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 756, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 9, 6, 57, 1, 5, 10, 1, 1, 11, 24, -138, -138, -138, -138, -138, -138, -138, -138, -138, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, 118, 119, -281, -281, -281, -281, -281, -281, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 42, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, 118, 119, -282, -282, -282, -282, -282, -282, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, 41, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, 13, 1, 5, 56, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, 1, 92, 757, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 758, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 6, 6, 57, 1, 28, 8, 18, -215, -215, -215, -215, -215, -215, 43, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 1, 1, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -285, -285, -285, -285, -285, 755, -285, -285, -285, -285, 759, -285, 760, -285, -285, -285, -285, -285, -285, -285, 118, 119, -285, -285, -285, -285, -285, -285, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 54, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, 43, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 1, 1, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -284, -284, -284, -284, -284, 755, -284, -284, -284, -284, 761, -284, -284, -284, -284, -284, -284, -284, -284, -284, 118, 119, -284, -284, -284, -284, -284, -284, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 1, 92, 762, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 8, 4, 1, 1, 1, 1, 1, 1, 1, 763, 155, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 36, 37, 38, 68, 69, 70, 71, 72, 73, 74, 75, 94, 95, 86, 98, 99, 100, 96, 97, 50, 49, 66, 67, 87, 93, 56, 77, 81, 78, 79, 61, 159, 160, 84, 85, 80, 82, 83, 76, 63, 59, 60, 51, 88, 52, 89, 53, 57, 54, 90, 91, 55, 92, 46, 58, 64, 65, 161, 162, 163, 43, 44, 45, 47, 48, 1, 92, 764, 54, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, 43, 1, 5, 56, 1, 1, 5, 13, 5, 1, 2, 1, 1, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -286, -286, -286, -286, -286, 755, -286, -286, -286, -286, 765, -286, -286, -286, -286, -286, -286, -286, -286, -286, 118, 119, -286, -286, -286, -286, -286, -286, 103, 102, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 54, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, 1, 92, 766, 54, 1, 5, 50, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 20, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104], t = [], p = 0, n, o, k, a;
    while (p < d.length) {
      n = d[p++];
      o = {};
      k = 0;
      a = [];
      while (n--)
        k += d[p++], a.push(k);
      for (k of a)
        o[k] = d[p++];
      t.push(o);
    }
    return t;
  })(),
  ruleTable: [0, 0, 3, 0, 3, 1, 4, 1, 4, 3, 4, 2, 5, 1, 5, 1, 5, 1, 9, 1, 9, 1, 9, 1, 9, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 8, 1, 8, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 34, 1, 34, 1, 34, 1, 34, 1, 34, 1, 34, 1, 34, 1, 34, 1, 42, 1, 42, 1, 52, 1, 54, 1, 51, 1, 51, 3, 58, 1, 58, 2, 60, 3, 60, 5, 60, 2, 60, 1, 44, 1, 44, 3, 68, 3, 68, 1, 17, 3, 17, 4, 17, 5, 18, 3, 18, 4, 18, 5, 19, 3, 19, 4, 19, 5, 20, 3, 20, 4, 20, 5, 21, 3, 21, 4, 21, 5, 21, 2, 21, 3, 21, 4, 33, 1, 33, 1, 33, 1, 75, 1, 75, 1, 75, 3, 75, 3, 75, 4, 75, 6, 75, 4, 75, 6, 75, 4, 75, 5, 75, 7, 75, 3, 75, 3, 75, 4, 75, 6, 77, 10, 77, 12, 77, 11, 77, 13, 77, 4, 95, 0, 95, 1, 95, 3, 95, 4, 95, 6, 96, 1, 96, 1, 96, 3, 96, 5, 96, 3, 96, 5, 98, 1, 98, 1, 98, 1, 86, 1, 86, 3, 86, 4, 86, 1, 97, 2, 97, 2, 103, 1, 103, 1, 103, 1, 103, 1, 103, 1, 103, 2, 103, 2, 103, 2, 103, 2, 103, 3, 103, 3, 103, 4, 103, 6, 76, 2, 76, 3, 76, 4, 108, 1, 108, 3, 108, 4, 108, 4, 108, 6, 110, 1, 110, 2, 109, 1, 109, 2, 107, 1, 107, 2, 112, 1, 112, 2, 113, 1, 113, 1, 36, 5, 83, 3, 83, 2, 83, 2, 83, 1, 30, 6, 30, 3, 15, 5, 15, 2, 31, 5, 31, 2, 122, 1, 122, 1, 117, 0, 117, 1, 117, 3, 117, 4, 117, 6, 125, 1, 125, 3, 125, 2, 125, 1, 126, 1, 126, 1, 126, 1, 126, 1, 127, 2, 37, 2, 37, 2, 37, 3, 37, 2, 37, 2, 105, 2, 105, 4, 129, 1, 129, 3, 129, 4, 129, 4, 129, 6, 111, 1, 111, 1, 111, 1, 111, 1, 130, 1, 130, 3, 39, 1, 39, 1, 78, 2, 40, 3, 40, 4, 40, 6, 41, 3, 41, 3, 119, 2, 119, 3, 35, 3, 35, 5, 91, 0, 91, 1, 10, 2, 10, 4, 10, 1, 28, 2, 28, 4, 29, 1, 29, 2, 29, 4, 29, 3, 140, 3, 140, 5, 143, 3, 143, 5, 22, 1, 22, 3, 22, 1, 22, 3, 22, 3, 22, 3, 22, 3, 23, 2, 23, 3, 23, 4, 23, 5, 148, 3, 148, 3, 148, 2, 26, 5, 26, 7, 26, 4, 26, 6, 152, 1, 152, 2, 153, 3, 153, 4, 155, 2, 155, 4, 155, 2, 155, 4, 24, 2, 24, 2, 24, 2, 24, 1, 158, 2, 158, 2, 25, 5, 25, 7, 25, 7, 25, 9, 25, 9, 25, 5, 25, 7, 25, 6, 25, 8, 25, 5, 25, 7, 25, 6, 25, 8, 25, 5, 25, 7, 25, 3, 25, 5, 25, 5, 25, 7, 25, 7, 25, 9, 25, 9, 25, 5, 25, 7, 25, 6, 25, 8, 25, 5, 25, 7, 25, 6, 25, 8, 25, 5, 25, 7, 25, 3, 25, 5, 165, 1, 165, 3, 89, 1, 89, 3, 27, 1, 27, 2, 27, 3, 27, 4, 27, 2, 27, 3, 27, 4, 27, 5, 12, 2, 12, 4, 12, 4, 12, 5, 12, 7, 12, 6, 12, 9, 171, 1, 171, 3, 171, 4, 171, 4, 171, 6, 172, 1, 172, 3, 172, 1, 172, 3, 169, 1, 170, 3, 13, 3, 13, 5, 13, 2, 13, 2, 13, 4, 13, 5, 13, 6, 13, 3, 13, 5, 13, 4, 13, 5, 13, 7, 177, 1, 177, 3, 177, 4, 177, 4, 177, 6, 179, 1, 179, 3, 179, 3, 179, 1, 179, 3, 32, 2, 32, 2, 32, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 4, 16, 2, 16, 2, 16, 2, 16, 2, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 5, 16, 3, 16, 5, 16, 4, 38, 2],
  ruleActions: (rule, vals, locs, shared) => {
    const $ = vals;
    const $0 = vals.length - 1;
    switch (rule) {
      case 1:
        return ["program"];
      case 2:
        return ["program", ...$[$0]];
      case 3:
      case 55:
      case 107:
      case 147:
      case 151:
      case 171:
      case 191:
      case 200:
      case 247:
      case 297:
      case 314:
      case 337:
        return [$[$0]];
      case 4:
      case 108:
      case 172:
      case 192:
      case 201:
      case 315:
      case 338:
        return [...$[$0 - 2], $[$0]];
      case 5:
      case 57:
      case 154:
        return $[$0 - 1];
      case 6:
      case 7:
      case 8:
      case 9:
      case 10:
      case 11:
      case 12:
      case 13:
      case 14:
      case 15:
      case 16:
      case 17:
      case 18:
      case 19:
      case 20:
      case 21:
      case 22:
      case 23:
      case 24:
      case 25:
      case 26:
      case 27:
      case 28:
      case 29:
      case 30:
      case 31:
      case 32:
      case 33:
      case 34:
      case 35:
      case 36:
      case 37:
      case 38:
      case 39:
      case 40:
      case 41:
      case 42:
      case 43:
      case 46:
      case 47:
      case 48:
      case 49:
      case 50:
      case 51:
      case 52:
      case 53:
      case 60:
      case 61:
      case 83:
      case 84:
      case 85:
      case 86:
      case 87:
      case 112:
      case 117:
      case 118:
      case 119:
      case 120:
      case 123:
      case 126:
      case 127:
      case 128:
      case 129:
      case 130:
      case 142:
      case 168:
      case 169:
      case 175:
      case 179:
      case 180:
      case 181:
      case 182:
      case 196:
      case 197:
      case 198:
      case 214:
      case 215:
      case 229:
      case 231:
      case 258:
      case 295:
      case 319:
      case 321:
      case 323:
      case 342:
      case 345:
        return $[$0];
      case 44:
        return "undefined";
      case 45:
        return "null";
      case 54:
        return ["str", ...$[$0 - 1]];
      case 56:
      case 148:
      case 152:
      case 248:
        return [...$[$0 - 1], $[$0]];
      case 58:
      case 190:
      case 194:
      case 317:
      case 340:
        return $[$0 - 2];
      case 59:
        return "";
      case 62:
        return ["regex", $[$0 - 1]];
      case 63:
        return ["regex-index", $[$0 - 2], $[$0]];
      case 64:
        return ["regex-index", $[$0], null];
      case 65:
        return ["=", $[$0 - 2], $[$0]];
      case 66:
        return ["=", $[$0 - 3], $[$0]];
      case 67:
        return ["=", $[$0 - 4], $[$0 - 1]];
      case 68:
        return ["state", $[$0 - 2], $[$0]];
      case 69:
        return ["state", $[$0 - 3], $[$0]];
      case 70:
        return ["state", $[$0 - 4], $[$0 - 1]];
      case 71:
        return ["computed", $[$0 - 2], $[$0]];
      case 72:
        return ["computed", $[$0 - 3], $[$0]];
      case 73:
        return ["computed", $[$0 - 4], $[$0 - 1]];
      case 74:
        return ["readonly", $[$0 - 2], $[$0]];
      case 75:
        return ["readonly", $[$0 - 3], $[$0]];
      case 76:
        return ["readonly", $[$0 - 4], $[$0 - 1]];
      case 77:
        return ["effect", $[$0 - 2], $[$0]];
      case 78:
        return ["effect", $[$0 - 3], $[$0]];
      case 79:
        return ["effect", $[$0 - 4], $[$0 - 1]];
      case 80:
      case 81:
        return ["effect", null, $[$0]];
      case 82:
        return ["effect", null, $[$0 - 1]];
      case 88:
      case 97:
      case 135:
        return [".", $[$0 - 2], $[$0]];
      case 89:
      case 98:
      case 136:
        return ["?.", $[$0 - 2], $[$0]];
      case 90:
      case 92:
      case 99:
      case 137:
        return ["[]", $[$0 - 3], $[$0 - 1]];
      case 91:
      case 93:
      case 100:
      case 138:
        return ["[]", $[$0 - 5], $[$0 - 2]];
      case 94:
        return [$[$0 - 1][0], $[$0 - 3], ...$[$0 - 1].slice(1)];
      case 95:
        return ["optindex", $[$0 - 4], $[$0 - 1]];
      case 96:
        return ["optindex", $[$0 - 6], $[$0 - 2]];
      case 101:
        return ["object-comprehension", $[$0 - 8], $[$0 - 6], [["for-of", $[$0 - 4], $[$0 - 2], false]], []];
      case 102:
        return ["object-comprehension", $[$0 - 10], $[$0 - 8], [["for-of", $[$0 - 6], $[$0 - 4], false]], [$[$0 - 2]]];
      case 103:
        return ["object-comprehension", $[$0 - 9], $[$0 - 7], [["for-of", $[$0 - 4], $[$0 - 2], true]], []];
      case 104:
        return ["object-comprehension", $[$0 - 11], $[$0 - 9], [["for-of", $[$0 - 6], $[$0 - 4], true]], [$[$0 - 2]]];
      case 105:
        return ["object", ...$[$0 - 2]];
      case 106:
      case 149:
      case 170:
      case 189:
        return [];
      case 109:
      case 173:
      case 193:
      case 316:
      case 339:
        return [...$[$0 - 3], $[$0]];
      case 110:
      case 174:
      case 195:
      case 318:
      case 341:
        return [...$[$0 - 5], ...$[$0 - 2]];
      case 111:
        return [$[$0], $[$0], null];
      case 113:
        return [$[$0 - 2], $[$0], ":"];
      case 114:
        return [$[$0 - 4], $[$0 - 1], ":"];
      case 115:
        return [$[$0 - 2], $[$0], "="];
      case 116:
        return [$[$0 - 4], $[$0 - 1], "="];
      case 121:
        return ["dynamicKey", $[$0 - 1]];
      case 122:
        return ["[]", "this", $[$0 - 1]];
      case 124:
      case 125:
      case 183:
        return ["...", $[$0]];
      case 131:
      case 187:
        return ["super", ...$[$0]];
      case 132:
      case 133:
      case 134:
      case 185:
      case 188:
        return [$[$0 - 1], ...$[$0]];
      case 139:
        return ["array"];
      case 140:
        return ["array", ...$[$0 - 1]];
      case 141:
        return ["array", ...$[$0 - 2], ...$[$0 - 1]];
      case 143:
        return [...$[$0 - 2], ...$[$0]];
      case 144:
        return [...$[$0 - 3], ...$[$0]];
      case 145:
        return [...$[$0 - 2], ...$[$0 - 1]];
      case 146:
        return [...$[$0 - 5], ...$[$0 - 4], ...$[$0 - 2], ...$[$0 - 1]];
      case 150:
        return [...$[$0]];
      case 153:
        return null;
      case 155:
        return "..";
      case 156:
      case 199:
        return "...";
      case 157:
        return [$[$0 - 2], $[$0 - 3], $[$0 - 1]];
      case 158:
      case 363:
      case 365:
      case 366:
      case 380:
      case 382:
        return [$[$0 - 1], $[$0 - 2], $[$0]];
      case 159:
        return [$[$0], $[$0 - 1], null];
      case 160:
        return [$[$0 - 1], null, $[$0]];
      case 161:
        return [$[$0], null, null];
      case 162:
        return ["def", $[$0 - 4], $[$0 - 2], $[$0]];
      case 163:
        return ["def", $[$0 - 1], [], $[$0]];
      case 164:
      case 166:
        return [$[$0 - 1], $[$0 - 3], $[$0]];
      case 165:
      case 167:
        return [$[$0 - 1], [], $[$0]];
      case 176:
      case 296:
        return ["default", $[$0 - 2], $[$0]];
      case 177:
        return ["rest", $[$0]];
      case 178:
        return ["expansion"];
      case 184:
        return ["tagged-template", $[$0 - 1], $[$0]];
      case 186:
        return ["optcall", $[$0 - 2], ...$[$0]];
      case 202:
      case 203:
        return "this";
      case 204:
        return [".", "this", $[$0]];
      case 205:
        return [".", "super", $[$0]];
      case 206:
        return ["[]", "super", $[$0 - 1]];
      case 207:
        return ["[]", "super", $[$0 - 2]];
      case 208:
        return [".", "new", $[$0]];
      case 209:
        return [".", "import", $[$0]];
      case 210:
        return ["block"];
      case 211:
        return ["block", ...$[$0 - 1]];
      case 212:
        return $[$0 - 1].length === 1 ? $[$0 - 1][0] : ["block", ...$[$0 - 1]];
      case 213:
        return $[$0 - 2].length === 1 ? $[$0 - 2][0] : ["block", ...$[$0 - 2]];
      case 216:
        return ["return", $[$0]];
      case 217:
        return ["return", $[$0 - 1]];
      case 218:
        return ["return"];
      case 219:
        return ["throw", $[$0]];
      case 220:
        return ["throw", $[$0 - 1]];
      case 221:
        return ["yield"];
      case 222:
        return ["yield", $[$0]];
      case 223:
        return ["yield", $[$0 - 1]];
      case 224:
        return ["yield-from", $[$0]];
      case 225:
        return ["if", $[$0 - 1], $[$0]];
      case 226:
        return $[$0 - 4].length === 3 ? ["if", $[$0 - 4][1], $[$0 - 4][2], ["if", $[$0 - 1], $[$0]]] : [...$[$0 - 4], ["if", $[$0 - 1], $[$0]]];
      case 227:
        return ["unless", $[$0 - 1], $[$0]];
      case 228:
        return ["if", ["!", $[$0 - 3]], $[$0 - 2], $[$0]];
      case 230:
        return $[$0 - 2].length === 3 ? ["if", $[$0 - 2][1], $[$0 - 2][2], $[$0]] : [...$[$0 - 2], $[$0]];
      case 232:
      case 233:
        return ["if", $[$0], [$[$0 - 2]]];
      case 234:
      case 235:
        return ["unless", $[$0], [$[$0 - 2]]];
      case 236:
        return ["try", $[$0]];
      case 237:
        return ["try", $[$0 - 1], $[$0]];
      case 238:
        return ["try", $[$0 - 2], $[$0]];
      case 239:
        return ["try", $[$0 - 3], $[$0 - 2], $[$0]];
      case 240:
      case 241:
      case 347:
      case 350:
      case 352:
        return [$[$0 - 1], $[$0]];
      case 242:
        return [null, $[$0]];
      case 243:
        return ["switch", $[$0 - 3], $[$0 - 1], null];
      case 244:
        return ["switch", $[$0 - 5], $[$0 - 3], $[$0 - 1]];
      case 245:
        return ["switch", null, $[$0 - 1], null];
      case 246:
        return ["switch", null, $[$0 - 3], $[$0 - 1]];
      case 249:
        return ["when", $[$0 - 1], $[$0]];
      case 250:
        return ["when", $[$0 - 2], $[$0 - 1]];
      case 251:
        return ["while", $[$0]];
      case 252:
        return ["while", $[$0 - 2], $[$0]];
      case 253:
        return ["until", $[$0]];
      case 254:
        return ["until", $[$0 - 2], $[$0]];
      case 255:
        return $[$0 - 1].length === 2 ? [$[$0 - 1][0], $[$0 - 1][1], $[$0]] : [$[$0 - 1][0], $[$0 - 1][1], $[$0 - 1][2], $[$0]];
      case 256:
      case 257:
        return $[$0].length === 2 ? [$[$0][0], $[$0][1], [$[$0 - 1]]] : [$[$0][0], $[$0][1], $[$0][2], [$[$0 - 1]]];
      case 259:
        return ["loop", $[$0]];
      case 260:
        return ["loop", [$[$0]]];
      case 261:
        return ["for-in", $[$0 - 3], $[$0 - 1], null, null, $[$0]];
      case 262:
        return ["for-in", $[$0 - 5], $[$0 - 3], null, $[$0 - 1], $[$0]];
      case 263:
        return ["for-in", $[$0 - 5], $[$0 - 3], $[$0 - 1], null, $[$0]];
      case 264:
        return ["for-in", $[$0 - 7], $[$0 - 5], $[$0 - 1], $[$0 - 3], $[$0]];
      case 265:
        return ["for-in", $[$0 - 7], $[$0 - 5], $[$0 - 3], $[$0 - 1], $[$0]];
      case 266:
        return ["for-of", $[$0 - 3], $[$0 - 1], false, null, $[$0]];
      case 267:
        return ["for-of", $[$0 - 5], $[$0 - 3], false, $[$0 - 1], $[$0]];
      case 268:
        return ["for-of", $[$0 - 3], $[$0 - 1], true, null, $[$0]];
      case 269:
        return ["for-of", $[$0 - 5], $[$0 - 3], true, $[$0 - 1], $[$0]];
      case 270:
        return ["for-as", $[$0 - 3], $[$0 - 1], false, null, $[$0]];
      case 271:
        return ["for-as", $[$0 - 5], $[$0 - 3], false, $[$0 - 1], $[$0]];
      case 272:
      case 274:
        return ["for-as", $[$0 - 3], $[$0 - 1], true, null, $[$0]];
      case 273:
      case 275:
        return ["for-as", $[$0 - 5], $[$0 - 3], true, $[$0 - 1], $[$0]];
      case 276:
        return ["for-in", [], $[$0 - 1], null, null, $[$0]];
      case 277:
        return ["for-in", [], $[$0 - 3], $[$0 - 1], null, $[$0]];
      case 278:
        return ["comprehension", $[$0 - 4], [["for-in", $[$0 - 2], $[$0], null]], []];
      case 279:
        return ["comprehension", $[$0 - 6], [["for-in", $[$0 - 4], $[$0 - 2], null]], [$[$0]]];
      case 280:
        return ["comprehension", $[$0 - 6], [["for-in", $[$0 - 4], $[$0 - 2], $[$0]]], []];
      case 281:
        return ["comprehension", $[$0 - 8], [["for-in", $[$0 - 6], $[$0 - 4], $[$0]]], [$[$0 - 2]]];
      case 282:
        return ["comprehension", $[$0 - 8], [["for-in", $[$0 - 6], $[$0 - 4], $[$0 - 2]]], [$[$0]]];
      case 283:
        return ["comprehension", $[$0 - 4], [["for-of", $[$0 - 2], $[$0], false]], []];
      case 284:
        return ["comprehension", $[$0 - 6], [["for-of", $[$0 - 4], $[$0 - 2], false]], [$[$0]]];
      case 285:
        return ["comprehension", $[$0 - 5], [["for-of", $[$0 - 2], $[$0], true]], []];
      case 286:
        return ["comprehension", $[$0 - 7], [["for-of", $[$0 - 4], $[$0 - 2], true]], [$[$0]]];
      case 287:
        return ["comprehension", $[$0 - 4], [["for-as", $[$0 - 2], $[$0], false, null]], []];
      case 288:
        return ["comprehension", $[$0 - 6], [["for-as", $[$0 - 4], $[$0 - 2], false, null]], [$[$0]]];
      case 289:
        return ["comprehension", $[$0 - 5], [["for-as", $[$0 - 2], $[$0], true, null]], []];
      case 290:
        return ["comprehension", $[$0 - 7], [["for-as", $[$0 - 4], $[$0 - 2], true, null]], [$[$0]]];
      case 291:
        return ["comprehension", $[$0 - 4], [["for-as", $[$0 - 2], $[$0], true, null]], []];
      case 292:
        return ["comprehension", $[$0 - 6], [["for-as", $[$0 - 4], $[$0 - 2], true, null]], [$[$0]]];
      case 293:
        return ["comprehension", $[$0 - 2], [["for-in", [], $[$0], null]], []];
      case 294:
        return ["comprehension", $[$0 - 4], [["for-in", [], $[$0 - 2], $[$0]]], []];
      case 298:
      case 320:
      case 322:
      case 343:
      case 344:
      case 346:
        return [$[$0 - 2], $[$0]];
      case 299:
        return ["class", null, null];
      case 300:
        return ["class", null, null, $[$0]];
      case 301:
        return ["class", null, $[$0]];
      case 302:
        return ["class", null, $[$0 - 1], $[$0]];
      case 303:
        return ["class", $[$0], null];
      case 304:
        return ["class", $[$0 - 1], null, $[$0]];
      case 305:
        return ["class", $[$0 - 2], $[$0]];
      case 306:
        return ["class", $[$0 - 3], $[$0 - 1], $[$0]];
      case 307:
      case 310:
        return ["import", "{}", $[$0]];
      case 308:
      case 309:
        return ["import", $[$0 - 2], $[$0]];
      case 311:
        return ["import", $[$0 - 4], $[$0]];
      case 312:
        return ["import", [$[$0 - 4], $[$0 - 2]], $[$0]];
      case 313:
        return ["import", [$[$0 - 7], $[$0 - 4]], $[$0]];
      case 324:
        return ["*", $[$0]];
      case 325:
        return ["export", "{}"];
      case 326:
        return ["export", $[$0 - 2]];
      case 327:
      case 328:
        return ["export", $[$0]];
      case 329:
        return ["export", ["=", $[$0 - 2], $[$0]]];
      case 330:
        return ["export", ["=", $[$0 - 3], $[$0]]];
      case 331:
        return ["export", ["=", $[$0 - 4], $[$0 - 1]]];
      case 332:
        return ["export-default", $[$0]];
      case 333:
        return ["export-default", $[$0 - 1]];
      case 334:
        return ["export-all", $[$0]];
      case 335:
        return ["export-from", "{}", $[$0]];
      case 336:
        return ["export-from", $[$0 - 4], $[$0]];
      case 348:
      case 349:
      case 351:
      case 385:
        return ["do-iife", $[$0]];
      case 353:
        return ["-", $[$0]];
      case 354:
        return ["+", $[$0]];
      case 355:
        return ["await", $[$0]];
      case 356:
        return ["await", $[$0 - 1]];
      case 357:
        return ["--", $[$0], false];
      case 358:
        return ["++", $[$0], false];
      case 359:
        return ["--", $[$0 - 1], true];
      case 360:
        return ["++", $[$0 - 1], true];
      case 361:
        return ["+", $[$0 - 2], $[$0]];
      case 362:
        return ["-", $[$0 - 2], $[$0]];
      case 364:
        return ["**", $[$0 - 2], $[$0]];
      case 367:
        return ["&", $[$0 - 2], $[$0]];
      case 368:
        return ["^", $[$0 - 2], $[$0]];
      case 369:
        return ["|", $[$0 - 2], $[$0]];
      case 370:
      case 371:
      case 372:
      case 373:
      case 374:
      case 375:
        return ["control", $[$0 - 1], $[$0 - 2], $[$0]];
      case 376:
        return ["&&", $[$0 - 2], $[$0]];
      case 377:
        return ["||", $[$0 - 2], $[$0]];
      case 378:
        return ["??", $[$0 - 2], $[$0]];
      case 379:
        return ["!?", $[$0 - 2], $[$0]];
      case 381:
        return ["?:", $[$0 - 4], $[$0 - 2], $[$0]];
      case 383:
        return [$[$0 - 3], $[$0 - 4], $[$0 - 1]];
      case 384:
        return [$[$0 - 2], $[$0 - 3], $[$0]];
    }
  },
  parseError(str, hash) {
    let col, error, line, location, message, text, token;
    if (hash.recoverable)
      return this.trace(str);
    else {
      line = (hash.line || 0) + 1;
      col = hash.loc?.first_column || 0;
      token = hash.token ? ` (token: ${hash.token})` : "";
      text = hash.text ? ` near '${hash.text}'` : "";
      location = `line ${line}, column ${col}`;
      message = `Parse error at ${location}${token}${text}: ${str}`;
      error = Error(message);
      error.hash = hash;
      throw error;
    }
  },
  parse(input) {
    let EOF, TERROR, action, errStr, expected, len, lex, lexer, loc, locFirst, locLast, newState, p, parseTable, preErrorSymbol, r, ranges, recovering, sharedState, state, stk, symbol, val, yyleng, yylineno, yyloc, yytext, yyval;
    [stk, val, loc] = [[0], [null], []];
    [parseTable, yytext, yylineno, yyleng, recovering] = [this.parseTable, "", 0, 0, 0];
    [TERROR, EOF] = [2, 1];
    lexer = Object.create(this.lexer);
    sharedState = { yy: {} };
    for (const k in this.yy)
      if (Object.hasOwn(this.yy, k)) {
        const v = this.yy[k];
        sharedState.yy[k] = v;
      }
    lexer.setInput(input, sharedState.yy);
    [sharedState.yy.lexer, sharedState.yy.parser] = [lexer, this];
    if (lexer.yylloc == null)
      lexer.yylloc = {};
    yyloc = lexer.yylloc;
    loc.push(yyloc);
    ranges = lexer.options?.ranges;
    this.parseError = typeof sharedState.yy.parseError === "function" ? sharedState.yy.parseError : Object.getPrototypeOf(this).parseError;
    lex = () => {
      let token;
      token = lexer.lex() || EOF;
      if (typeof token !== "number")
        token = this.symbolIds[token] || token;
      return token;
    };
    [symbol, preErrorSymbol, state, action, r, yyval, p, len, newState, expected] = [null, null, null, null, null, {}, null, null, null, null];
    while (true) {
      state = stk[stk.length - 1];
      if (symbol == null)
        symbol = lex();
      action = parseTable[state] != null ? parseTable[state][symbol] : undefined;
      if (action == null) {
        errStr = "";
        if (!recovering)
          expected = (() => {
            const result = [];
            for (const p2 in parseTable[state]) {
              if (!Object.hasOwn(parseTable[state], p2))
                continue;
              if (this.tokenNames[p2] && p2 > TERROR)
                result.push(`'${this.tokenNames[p2]}'`);
            }
            return result;
          })();
        errStr = (() => {
          if (lexer.showPosition)
            return `Parse error on line ${yylineno + 1}:
${lexer.showPosition()}
Expecting ${expected.join(", ")}, got '${this.tokenNames[symbol] || symbol}'`;
          else {
            `Parse error on line ${yylineno + 1}: Unexpected ${symbol === EOF ? "end of input" : `'${this.tokenNames[symbol] || symbol}'`}`;
            return this.parseError(errStr, { text: lexer.match, token: this.tokenNames[symbol] || symbol, line: lexer.yylineno, loc: yyloc, expected });
          }
        })();
        throw Error(errStr);
      }
      if (action > 0) {
        stk.push(symbol, action);
        val.push(lexer.yytext);
        loc.push(lexer.yylloc);
        symbol = null;
        if (!preErrorSymbol) {
          [yyleng, yytext, yylineno, yyloc] = [lexer.yyleng, lexer.yytext, lexer.yylineno, lexer.yylloc];
          if (recovering > 0)
            recovering--;
        } else
          [symbol, preErrorSymbol] = [preErrorSymbol, null];
      } else if (action < 0) {
        len = this.ruleTable[-action * 2 + 1];
        yyval.$ = val[val.length - len];
        [locFirst, locLast] = [loc[loc.length - (len || 1)], loc[loc.length - 1]];
        yyval._$ = { first_line: locFirst.first_line, last_line: locLast.last_line, first_column: locFirst.first_column, last_column: locLast.last_column };
        if (ranges)
          yyval._$.range = [locFirst.range[0], locLast.range[1]];
        r = this.ruleActions.apply(yyval, [-action, val, loc, sharedState.yy]);
        if (r != null)
          yyval.$ = r;
        if (len) {
          stk.length -= len * 2;
          val.length -= len;
          loc.length -= len;
        }
        stk.push(this.ruleTable[-action * 2]);
        val.push(yyval.$);
        loc.push(yyval._$);
        newState = parseTable[stk[stk.length - 2]][stk[stk.length - 1]];
        stk.push(newState);
      } else if (action === 0)
        return val[val.length - 1];
    }
  },
  trace() {},
  yy: {}
};
var createParser = (yyInit = {}) => {
  const p = Object.create(parserInstance);
  Object.defineProperty(p, "yy", {
    value: { ...yyInit },
    enumerable: false,
    writable: true,
    configurable: true
  });
  return p;
};
var parser = /* @__PURE__ */ createParser();
var parse = parser.parse.bind(parser);
// src/compiler.js
var meta = (node, key) => node instanceof String ? node[key] : undefined;
var str = (node) => node instanceof String ? node.valueOf() : node;
var INLINE_FORMS = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "//",
  "%%",
  "**",
  "==",
  "!=",
  "<",
  ">",
  "<=",
  ">=",
  "===",
  "!==",
  "&&",
  "||",
  "??",
  "!?",
  "not",
  "&",
  "|",
  "^",
  "<<",
  ">>",
  ">>>",
  "=",
  ".",
  "?.",
  "[]",
  "!",
  "typeof",
  "void",
  "delete",
  "new",
  "...",
  "rest",
  "expansion",
  "optindex",
  "optcall"
]);
function isInline(arr) {
  if (!Array.isArray(arr) || arr.length === 0)
    return false;
  let head = arr[0]?.valueOf?.() ?? arr[0];
  if (INLINE_FORMS.has(head))
    return true;
  return arr.length <= 4 && !arr.some(Array.isArray);
}
function formatAtom(elem) {
  if (Array.isArray(elem))
    return "(???)";
  if (typeof elem === "number")
    return String(elem);
  if (elem === null)
    return "null";
  if (elem === "")
    return '""';
  let s = String(elem);
  if (s[0] === "/" && s.indexOf(`
`) >= 0) {
    let match = s.match(/\/([gimsuvy]*)$/);
    let flags = match ? match[1] : "";
    let content = s.slice(1);
    content = flags ? content.slice(0, -flags.length - 1) : content.slice(0, -1);
    let lines = content.split(`
`);
    let cleaned = lines.map((line) => line.replace(/#.*$/, "").trim());
    return `"/${cleaned.join("")}/${flags}"`;
  }
  return s;
}
function formatSExpr(arr, indent = 0, isTopLevel = false) {
  if (!Array.isArray(arr))
    return formatAtom(arr);
  if (isTopLevel && arr[0] === "program") {
    let secondElem = arr[1];
    let header = Array.isArray(secondElem) ? "(program" : "(program " + formatAtom(secondElem);
    let lines2 = [header];
    let startIndex = Array.isArray(secondElem) ? 1 : 2;
    for (let i = startIndex;i < arr.length; i++) {
      let child = formatSExpr(arr[i], 2, false);
      lines2.push(child[0] === "(" ? "  " + child : child);
    }
    lines2.push(")");
    return lines2.join(`
`);
  }
  let head = arr[0];
  let canBeInline = isInline(arr) && arr.slice(1).every((elem) => !Array.isArray(elem) || isInline(elem));
  if (canBeInline) {
    let parts = arr.map((elem) => Array.isArray(elem) ? formatSExpr(elem, 0, false) : formatAtom(elem));
    let inline = `(${parts.join(" ")})`;
    if (!inline.includes(`
`))
      return " ".repeat(indent) + inline;
  }
  let spaces = " ".repeat(indent);
  let formattedHead;
  if (Array.isArray(head)) {
    formattedHead = formatSExpr(head, 0, false);
    if (formattedHead.includes(`
`)) {
      let headLines = formattedHead.split(`
`);
      formattedHead = headLines.map((line, i) => i === 0 ? line : " ".repeat(indent + 2) + line).join(`
`);
    }
  } else {
    formattedHead = formatAtom(head);
  }
  let lines = [`${spaces}(${formattedHead}`];
  let forceChildrenOnNewLines = head === "block";
  for (let i = 1;i < arr.length; i++) {
    let elem = arr[i];
    if (!Array.isArray(elem)) {
      lines[lines.length - 1] += " " + formatAtom(elem);
    } else {
      let childInline = isInline(elem) && elem.every((e) => !Array.isArray(e) || isInline(e));
      if (!forceChildrenOnNewLines && childInline) {
        let formatted = formatSExpr(elem, 0, false);
        if (!formatted.includes(`
`)) {
          lines[lines.length - 1] += " " + formatted;
          continue;
        }
      }
      lines.push(formatSExpr(elem, indent + 2, false));
    }
  }
  lines[lines.length - 1] += ")";
  return lines.join(`
`);
}

class CodeGenerator {
  static ASSIGNMENT_OPS = new Set([
    "=",
    "+=",
    "-=",
    "*=",
    "/=",
    "?=",
    "&=",
    "|=",
    "^=",
    "%=",
    "**=",
    "??=",
    "&&=",
    "||=",
    "<<=",
    ">>=",
    ">>>="
  ]);
  static NUMBER_LITERAL_RE = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;
  static NUMBER_START_RE = /^-?\d/;
  static GENERATORS = {
    program: "generateProgram",
    "&&": "generateLogicalAnd",
    "||": "generateLogicalOr",
    "+": "generateBinaryOp",
    "-": "generateBinaryOp",
    "*": "generateBinaryOp",
    "/": "generateBinaryOp",
    "%": "generateBinaryOp",
    "**": "generateBinaryOp",
    "==": "generateBinaryOp",
    "===": "generateBinaryOp",
    "!=": "generateBinaryOp",
    "!==": "generateBinaryOp",
    "<": "generateBinaryOp",
    ">": "generateBinaryOp",
    "<=": "generateBinaryOp",
    ">=": "generateBinaryOp",
    "??": "generateBinaryOp",
    "!?": "generateBinaryOp",
    "&": "generateBinaryOp",
    "|": "generateBinaryOp",
    "^": "generateBinaryOp",
    "<<": "generateBinaryOp",
    ">>": "generateBinaryOp",
    ">>>": "generateBinaryOp",
    "%%": "generateModulo",
    "//": "generateFloorDiv",
    "//=": "generateFloorDivAssign",
    "..": "generateRange",
    "=": "generateAssignment",
    "+=": "generateAssignment",
    "-=": "generateAssignment",
    "*=": "generateAssignment",
    "/=": "generateAssignment",
    "%=": "generateAssignment",
    "**=": "generateAssignment",
    "&&=": "generateAssignment",
    "||=": "generateAssignment",
    "??=": "generateAssignment",
    "?=": "generateAssignment",
    "&=": "generateAssignment",
    "|=": "generateAssignment",
    "^=": "generateAssignment",
    "<<=": "generateAssignment",
    ">>=": "generateAssignment",
    ">>>=": "generateAssignment",
    "...": "generateRange",
    "!": "generateNot",
    "~": "generateBitwiseNot",
    "++": "generateIncDec",
    "--": "generateIncDec",
    "=~": "generateRegexMatch",
    instanceof: "generateInstanceof",
    in: "generateIn",
    of: "generateOf",
    typeof: "generateTypeof",
    delete: "generateDelete",
    new: "generateNew",
    array: "generateArray",
    object: "generateObject",
    block: "generateBlock",
    ".": "generatePropertyAccess",
    "?.": "generateOptionalProperty",
    "[]": "generateIndexAccess",
    optindex: "generateOptIndex",
    optcall: "generateOptCall",
    "regex-index": "generateRegexIndex",
    def: "generateDef",
    "->": "generateThinArrow",
    "=>": "generateFatArrow",
    return: "generateReturn",
    state: "generateState",
    computed: "generateComputed",
    readonly: "generateReadonly",
    effect: "generateEffect",
    break: "generateBreak",
    "break-if": "generateBreakIf",
    continue: "generateContinue",
    "continue-if": "generateContinueIf",
    "?": "generateExistential",
    "?:": "generateTernary",
    loop: "generateLoop",
    await: "generateAwait",
    yield: "generateYield",
    "yield-from": "generateYieldFrom",
    if: "generateIf",
    unless: "generateIf",
    "for-in": "generateForIn",
    "for-of": "generateForOf",
    "for-as": "generateForAs",
    while: "generateWhile",
    until: "generateUntil",
    try: "generateTry",
    throw: "generateThrow",
    control: "generateControl",
    switch: "generateSwitch",
    when: "generateWhen",
    comprehension: "generateComprehension",
    "object-comprehension": "generateObjectComprehension",
    class: "generateClass",
    super: "generateSuper",
    import: "generateImport",
    export: "generateExport",
    "export-default": "generateExportDefault",
    "export-all": "generateExportAll",
    "export-from": "generateExportFrom",
    "do-iife": "generateDoIIFE",
    regex: "generateRegex",
    "tagged-template": "generateTaggedTemplate",
    str: "generateString"
  };
  constructor(options = {}) {
    this.options = options;
    this.indentLevel = 0;
    this.indentString = "  ";
    this.comprehensionDepth = 0;
    this.dataSection = options.dataSection;
    if (options.reactiveVars) {
      this.reactiveVars = new Set(options.reactiveVars);
    }
  }
  compile(sexpr) {
    this.programVars = new Set;
    this.functionVars = new Map;
    this.helpers = new Set;
    this.collectProgramVariables(sexpr);
    return this.generate(sexpr);
  }
  collectProgramVariables(sexpr) {
    if (!Array.isArray(sexpr))
      return;
    let [head, ...rest] = sexpr;
    head = str(head);
    if (Array.isArray(head)) {
      sexpr.forEach((item) => this.collectProgramVariables(item));
      return;
    }
    if (head === "export" || head === "export-default" || head === "export-all" || head === "export-from")
      return;
    if (head === "state" || head === "computed") {
      let [target] = rest;
      let varName = str(target) ?? target;
      if (!this.reactiveVars)
        this.reactiveVars = new Set;
      this.reactiveVars.add(varName);
      return;
    }
    if (head === "readonly")
      return;
    if (CodeGenerator.ASSIGNMENT_OPS.has(head)) {
      let [target, value] = rest;
      if (typeof target === "string" || target instanceof String) {
        let varName = str(target);
        if (!this.reactiveVars?.has(varName))
          this.programVars.add(varName);
      } else if (Array.isArray(target) && target[0] === "array") {
        this.collectVarsFromArray(target, this.programVars);
      } else if (Array.isArray(target) && target[0] === "object") {
        this.collectVarsFromObject(target, this.programVars);
      }
      this.collectProgramVariables(value);
      return;
    }
    if (head === "def" || head === "->" || head === "=>")
      return;
    if (head === "if") {
      let [condition, thenBranch, elseBranch] = rest;
      this.collectProgramVariables(condition);
      this.collectProgramVariables(thenBranch);
      if (elseBranch)
        this.collectProgramVariables(elseBranch);
      return;
    }
    if (head === "unless") {
      let [condition, body] = rest;
      this.collectProgramVariables(condition);
      this.collectProgramVariables(body);
      return;
    }
    if (head === "try") {
      this.collectProgramVariables(rest[0]);
      if (rest.length >= 2 && Array.isArray(rest[1]) && rest[1].length === 2 && rest[1][0] !== "block") {
        let [param, catchBlock] = rest[1];
        if (param && Array.isArray(param) && param[0] === "object") {
          param.slice(1).forEach((pair) => {
            if (Array.isArray(pair) && pair.length === 2 && typeof pair[1] === "string") {
              this.programVars.add(pair[1]);
            }
          });
        } else if (param && Array.isArray(param) && param[0] === "array") {
          param.slice(1).forEach((item) => {
            if (typeof item === "string")
              this.programVars.add(item);
          });
        }
        this.collectProgramVariables(catchBlock);
      }
      if (rest.length === 3)
        this.collectProgramVariables(rest[2]);
      else if (rest.length === 2 && (!Array.isArray(rest[1]) || rest[1][0] === "block")) {
        this.collectProgramVariables(rest[1]);
      }
      return;
    }
    rest.forEach((item) => this.collectProgramVariables(item));
  }
  collectFunctionVariables(body) {
    let vars = new Set;
    let collect = (sexpr) => {
      if (!Array.isArray(sexpr))
        return;
      let [head, ...rest] = sexpr;
      head = str(head);
      if (Array.isArray(head)) {
        sexpr.forEach((item) => collect(item));
        return;
      }
      if (CodeGenerator.ASSIGNMENT_OPS.has(head)) {
        let [target, value] = rest;
        if (typeof target === "string")
          vars.add(target);
        else if (Array.isArray(target) && target[0] === "array")
          this.collectVarsFromArray(target, vars);
        else if (Array.isArray(target) && target[0] === "object")
          this.collectVarsFromObject(target, vars);
        collect(value);
        return;
      }
      if (head === "def" || head === "->" || head === "=>")
        return;
      if (head === "try") {
        collect(rest[0]);
        if (rest.length >= 2 && Array.isArray(rest[1]) && rest[1].length === 2 && rest[1][0] !== "block") {
          let [param, catchBlock] = rest[1];
          if (param && Array.isArray(param) && param[0] === "object") {
            param.slice(1).forEach((pair) => {
              if (Array.isArray(pair) && pair.length === 2 && typeof pair[1] === "string")
                vars.add(pair[1]);
            });
          } else if (param && Array.isArray(param) && param[0] === "array") {
            param.slice(1).forEach((item) => {
              if (typeof item === "string")
                vars.add(item);
            });
          }
          collect(catchBlock);
        }
        if (rest.length === 3)
          collect(rest[2]);
        else if (rest.length === 2 && (!Array.isArray(rest[1]) || rest[1][0] === "block"))
          collect(rest[1]);
        return;
      }
      rest.forEach((item) => collect(item));
    };
    collect(body);
    return vars;
  }
  generate(sexpr, context = "statement") {
    if (sexpr instanceof String) {
      if (meta(sexpr, "await") === true) {
        return `await ${str(sexpr)}()`;
      }
      if (meta(sexpr, "predicate")) {
        return `(${str(sexpr)} != null)`;
      }
      if (meta(sexpr, "delimiter") === "///" && meta(sexpr, "heregex")) {
        let primitive = str(sexpr);
        let match = primitive.match(/^\/(.*)\/([gimsuvy]*)$/s);
        if (match) {
          let [, pattern, flags] = match;
          return `/${this.processHeregex(pattern)}/${flags}`;
        }
        return primitive;
      }
      let quote = meta(sexpr, "quote");
      if (quote) {
        let primitive = str(sexpr);
        if (quote === '"""' || quote === "'''") {
          let content2 = this.extractStringContent(sexpr);
          content2 = content2.replace(/`/g, "\\`").replace(/\${/g, "\\${");
          return `\`${content2}\``;
        }
        if (primitive[0] === quote)
          return primitive;
        let content = primitive.slice(1, -1);
        return `${quote}${content}${quote}`;
      }
      sexpr = str(sexpr);
    }
    if (typeof sexpr === "string") {
      if (sexpr.startsWith('"') || sexpr.startsWith("'") || sexpr.startsWith("`")) {
        if (this.options.debug)
          console.warn("[Rip] Unexpected quoted primitive:", sexpr);
        let content = sexpr.slice(1, -1);
        if (content.includes(`
`)) {
          return `\`${content.replace(/`/g, "\\`").replace(/\$\{/g, "\\${")}\``;
        }
        let delim = content.includes("'") && !content.includes('"') ? '"' : "'";
        let escaped = content.replace(new RegExp(delim, "g"), `\\${delim}`);
        return `${delim}${escaped}${delim}`;
      }
      if (this.reactiveVars?.has(sexpr) && !this.suppressReactiveUnwrap) {
        return `${sexpr}.value`;
      }
      return sexpr;
    }
    if (typeof sexpr === "number")
      return String(sexpr);
    if (sexpr === null || sexpr === undefined)
      return "null";
    if (!Array.isArray(sexpr))
      throw new Error(`Invalid s-expression: ${JSON.stringify(sexpr)}`);
    let [head, ...rest] = sexpr;
    let headAwaitMeta = meta(head, "await");
    head = str(head);
    let method = CodeGenerator.GENERATORS[head];
    if (method)
      return this[method](head, rest, context, sexpr);
    if (typeof head === "string" && !head.startsWith('"') && !head.startsWith("'")) {
      if (CodeGenerator.NUMBER_START_RE.test(head))
        return head;
      if (head === "super" && this.currentMethodName && this.currentMethodName !== "constructor") {
        let args2 = rest.map((arg) => this.unwrap(this.generate(arg, "value"))).join(", ");
        return `super.${this.currentMethodName}(${args2})`;
      }
      if (context === "statement" && rest.length === 1) {
        let cond = this.findPostfixConditional(rest[0]);
        if (cond) {
          let argWithout = this.rebuildWithoutConditional(cond);
          let callee = this.generate(head, "value");
          let condCode = this.generate(cond.condition, "value");
          let valCode = this.generate(argWithout, "value");
          let callStr2 = `${callee}(${valCode})`;
          return cond.type === "unless" ? `if (!${condCode}) ${callStr2}` : `if (${condCode}) ${callStr2}`;
        }
      }
      let needsAwait = headAwaitMeta === true;
      let calleeName = this.generate(head, "value");
      let args = rest.map((arg) => this.unwrap(this.generate(arg, "value"))).join(", ");
      let callStr = `${calleeName}(${args})`;
      return needsAwait ? `await ${callStr}` : callStr;
    }
    if (Array.isArray(head) && typeof head[0] === "string") {
      let stmtOps = ["=", "+=", "-=", "*=", "/=", "%=", "**=", "&&=", "||=", "??=", "if", "unless", "return", "throw"];
      if (stmtOps.includes(head[0])) {
        let exprs = sexpr.map((stmt) => this.generate(stmt, "value"));
        return `(${exprs.join(", ")})`;
      }
    }
    if (Array.isArray(head)) {
      if (head[0] === "." && (head[2] === "new" || str(head[2]) === "new")) {
        let ctorExpr = head[1];
        let ctorCode = this.generate(ctorExpr, "value");
        let args2 = rest.map((arg) => this.unwrap(this.generate(arg, "value"))).join(", ");
        let needsParens = Array.isArray(ctorExpr);
        return `new ${needsParens ? `(${ctorCode})` : ctorCode}(${args2})`;
      }
      if (context === "statement" && rest.length === 1) {
        let cond = this.findPostfixConditional(rest[0]);
        if (cond) {
          let argWithout = this.rebuildWithoutConditional(cond);
          let calleeCode2 = this.generate(head, "value");
          let condCode = this.generate(cond.condition, "value");
          let valCode = this.generate(argWithout, "value");
          let callStr2 = `${calleeCode2}(${valCode})`;
          return cond.type === "unless" ? `if (!${condCode}) ${callStr2}` : `if (${condCode}) ${callStr2}`;
        }
      }
      let needsAwait = false;
      let calleeCode;
      if (head[0] === "." && meta(head[2], "await") === true) {
        needsAwait = true;
        let [obj, prop] = head.slice(1);
        let objCode = this.generate(obj, "value");
        let needsParens = CodeGenerator.NUMBER_LITERAL_RE.test(objCode) || Array.isArray(obj) && (obj[0] === "object" || obj[0] === "await" || obj[0] === "yield");
        let base = needsParens ? `(${objCode})` : objCode;
        calleeCode = `${base}.${str(prop)}`;
      } else {
        calleeCode = this.generate(head, "value");
      }
      let args = rest.map((arg) => this.unwrap(this.generate(arg, "value"))).join(", ");
      let callStr = `${calleeCode}(${args})`;
      return needsAwait ? `await ${callStr}` : callStr;
    }
    throw new Error(`Unknown s-expression type: ${head}`);
  }
  generateProgram(head, statements, context, sexpr) {
    let code = "";
    let imports = [], exports = [], other = [];
    for (let stmt of statements) {
      if (!Array.isArray(stmt)) {
        other.push(stmt);
        continue;
      }
      let h = stmt[0];
      if (h === "import")
        imports.push(stmt);
      else if (h === "export" || h === "export-default" || h === "export-all" || h === "export-from")
        exports.push(stmt);
      else
        other.push(stmt);
    }
    let blockStmts = ["def", "class", "if", "unless", "for-in", "for-of", "for-as", "while", "until", "loop", "switch", "try"];
    let statementsCode = other.map((stmt, index) => {
      let isSingle = other.length === 1 && imports.length === 0 && exports.length === 0;
      let isObj = Array.isArray(stmt) && stmt[0] === "object";
      let isObjComp = isObj && stmt.length === 2 && Array.isArray(stmt[1]) && Array.isArray(stmt[1][1]) && stmt[1][1][0] === "comprehension";
      let isAlreadyExpr = Array.isArray(stmt) && (stmt[0] === "comprehension" || stmt[0] === "object-comprehension" || stmt[0] === "do-iife");
      let hasNoVars = this.programVars.size === 0;
      let needsParens = isSingle && isObj && hasNoVars && !isAlreadyExpr && !isObjComp;
      let isLast = index === other.length - 1;
      let isLastComp = isLast && isAlreadyExpr;
      let generated;
      if (needsParens)
        generated = `(${this.generate(stmt, "value")})`;
      else if (isLastComp)
        generated = this.generate(stmt, "value");
      else
        generated = this.generate(stmt, "statement");
      if (generated && !generated.endsWith(";")) {
        let h = Array.isArray(stmt) ? stmt[0] : null;
        if (!blockStmts.includes(h) || !generated.endsWith("}"))
          return generated + ";";
      }
      return generated;
    }).join(`
`);
    let needsBlank = false;
    if (imports.length > 0) {
      code += imports.map((s) => this.addSemicolon(s, this.generate(s, "statement"))).join(`
`);
      needsBlank = true;
    }
    if (this.programVars.size > 0) {
      let vars = Array.from(this.programVars).sort().join(", ");
      if (needsBlank)
        code += `
`;
      code += `let ${vars};
`;
      needsBlank = true;
    }
    if (this.helpers.has("slice")) {
      code += `const slice = [].slice;
`;
      needsBlank = true;
    }
    if (this.helpers.has("modulo")) {
      code += `const modulo = (n, d) => { n = +n; d = +d; return (n % d + d) % d; };
`;
      needsBlank = true;
    }
    if (this.helpers.has("toSearchable")) {
      code += `const toSearchable = (v, allowNewlines) => {
`;
      code += `  if (typeof v === "string") return !allowNewlines && /[\\n\\r]/.test(v) ? null : v;
`;
      code += `  if (v == null) return "";
`;
      code += `  if (typeof v === "number" || typeof v === "bigint" || typeof v === "boolean") return String(v);
`;
      code += `  if (typeof v === "symbol") return v.description || "";
`;
      code += `  if (v instanceof Uint8Array || v instanceof ArrayBuffer) {
`;
      code += `    return new TextDecoder().decode(v instanceof Uint8Array ? v : new Uint8Array(v));
`;
      code += `  }
`;
      code += `  if (Array.isArray(v)) return v.join(",");
`;
      code += `  if (typeof v.toString === "function" && v.toString !== Object.prototype.toString) {
`;
      code += `    try { return v.toString(); } catch { return ""; }
`;
      code += `  }
`;
      code += `  return "";
`;
      code += `};
`;
      needsBlank = true;
    }
    if (this.usesReactivity && !this.options.skipReactiveRuntime) {
      code += this.getReactiveRuntime();
      needsBlank = true;
    }
    if (this.dataSection !== null && this.dataSection !== undefined) {
      code += `var DATA;
_setDataSection();
`;
      needsBlank = true;
    }
    if (needsBlank && code.length > 0)
      code += `
`;
    code += statementsCode;
    if (exports.length > 0) {
      code += `
` + exports.map((s) => this.addSemicolon(s, this.generate(s, "statement"))).join(`
`);
    }
    if (this.dataSection !== null && this.dataSection !== undefined) {
      code += `

function _setDataSection() {
  DATA = ${JSON.stringify(this.dataSection)};
}`;
    }
    return code;
  }
  generateBinaryOp(op, rest, context, sexpr) {
    if ((op === "+" || op === "-") && rest.length === 1) {
      return `(${op}${this.generate(rest[0], "value")})`;
    }
    let [left, right] = rest;
    if (op === "!?") {
      let l = this.generate(left, "value"), r = this.generate(right, "value");
      return `(${l} !== undefined ? ${l} : ${r})`;
    }
    if (op === "==")
      op = "===";
    if (op === "!=")
      op = "!==";
    return `(${this.generate(left, "value")} ${op} ${this.generate(right, "value")})`;
  }
  generateModulo(head, rest) {
    let [left, right] = rest;
    this.helpers.add("modulo");
    return `modulo(${this.generate(left, "value")}, ${this.generate(right, "value")})`;
  }
  generateFloorDiv(head, rest) {
    let [left, right] = rest;
    return `Math.floor(${this.generate(left, "value")} / ${this.generate(right, "value")})`;
  }
  generateFloorDivAssign(head, rest) {
    let [target, value] = rest;
    let t = this.generate(target, "value"), v = this.generate(value, "value");
    return `${t} = Math.floor(${t} / ${v})`;
  }
  generateAssignment(head, rest, context, sexpr) {
    let [target, value] = rest;
    let op = head === "?=" ? "??=" : head;
    let isFnValue = Array.isArray(value) && (value[0] === "->" || value[0] === "=>" || value[0] === "def");
    if (target instanceof String && meta(target, "await") !== undefined && !isFnValue) {
      let sigil = meta(target, "await") === true ? "!" : "&";
      throw new Error(`Cannot use ${sigil} sigil in variable declaration '${str(target)}'.`);
    }
    if (target instanceof String && meta(target, "await") === true && isFnValue) {
      this.nextFunctionIsVoid = true;
    }
    let isEmptyArr = Array.isArray(target) && target[0] === "array" && target.length === 1;
    let isEmptyObj = Array.isArray(target) && target[0] === "object" && target.length === 1;
    if (isEmptyArr || isEmptyObj) {
      let v = this.generate(value, "value");
      return isEmptyObj && context === "statement" ? `(${v})` : v;
    }
    if (Array.isArray(value) && op === "=" && value[0] === "control") {
      let [, rawCtrlOp, expr, ctrlSexpr] = value;
      let ctrlOp = str(rawCtrlOp);
      let isReturn = ctrlSexpr[0] === "return";
      let targetCode2 = this.generate(target, "value");
      if (typeof target === "string")
        this.programVars.add(target);
      let exprCode = this.generate(expr, "value");
      let ctrlValue = ctrlSexpr.length > 1 ? ctrlSexpr[1] : null;
      let ctrlCode = isReturn ? ctrlValue ? `return ${this.generate(ctrlValue, "value")}` : "return" : ctrlValue ? `throw ${this.generate(ctrlValue, "value")}` : "throw new Error()";
      if (context === "value") {
        if (ctrlOp === "??")
          return `(() => { const __v = ${exprCode}; if (__v == null) ${ctrlCode}; return (${targetCode2} = __v); })()`;
        if (ctrlOp === "||")
          return `(() => { const __v = ${exprCode}; if (!__v) ${ctrlCode}; return (${targetCode2} = __v); })()`;
        return `(() => { const __v = ${exprCode}; if (__v) ${ctrlCode}; return (${targetCode2} = __v); })()`;
      }
      if (ctrlOp === "??")
        return `if ((${targetCode2} = ${exprCode}) == null) ${ctrlCode}`;
      if (ctrlOp === "||")
        return `if (!(${targetCode2} = ${exprCode})) ${ctrlCode}`;
      return `if ((${targetCode2} = ${exprCode})) ${ctrlCode}`;
    }
    if (Array.isArray(target) && target[0] === "array") {
      let restIdx = target.slice(1).findIndex((el) => Array.isArray(el) && el[0] === "..." || el === "...");
      if (restIdx !== -1 && restIdx < target.length - 2) {
        let elements = target.slice(1);
        let afterRest = elements.slice(restIdx + 1);
        let afterCount = afterRest.length;
        if (afterCount > 0) {
          let valueCode2 = this.generate(value, "value");
          let beforeRest = elements.slice(0, restIdx);
          let beforePattern = beforeRest.map((el) => el === "," ? "" : typeof el === "string" ? el : this.generate(el, "value")).join(", ");
          let afterPattern = afterRest.map((el) => el === "," ? "" : typeof el === "string" ? el : this.generate(el, "value")).join(", ");
          this.helpers.add("slice");
          elements.forEach((el) => {
            if (el === "," || el === "...")
              return;
            if (typeof el === "string")
              this.programVars.add(el);
            else if (Array.isArray(el) && el[0] === "..." && typeof el[1] === "string")
              this.programVars.add(el[1]);
          });
          let restEl = elements[restIdx];
          let restVar = Array.isArray(restEl) && restEl[0] === "..." ? restEl[1] : null;
          let stmts = [];
          if (beforePattern)
            stmts.push(`[${beforePattern}] = ${valueCode2}`);
          if (restVar)
            stmts.push(`[...${restVar}] = ${valueCode2}.slice(${restIdx}, -${afterCount})`);
          stmts.push(`[${afterPattern}] = slice.call(${valueCode2}, -${afterCount})`);
          return stmts.join(", ");
        }
      }
    }
    if (context === "statement" && head === "=" && Array.isArray(value) && (value[0] === "||" || value[0] === "&&") && value.length === 3) {
      let [binOp, left, right] = value;
      if (Array.isArray(right) && (right[0] === "unless" || right[0] === "if") && right.length === 3) {
        let [condType, condition, wrappedValue] = right;
        let unwrapped = Array.isArray(wrappedValue) && wrappedValue.length === 1 ? wrappedValue[0] : wrappedValue;
        let fullValue = [binOp, left, unwrapped];
        let t = this.generate(target, "value"), c = this.generate(condition, "value"), v = this.generate(fullValue, "value");
        return condType === "unless" ? `if (!${c}) ${t} = ${v}` : `if (${c}) ${t} = ${v}`;
      }
    }
    if (context === "statement" && head === "=" && Array.isArray(value) && value.length === 3) {
      let [valHead, condition, actualValue] = value;
      let isPostfix = Array.isArray(actualValue) && actualValue.length === 1 && (!Array.isArray(actualValue[0]) || actualValue[0][0] !== "block");
      if ((valHead === "unless" || valHead === "if") && isPostfix) {
        let unwrapped = Array.isArray(actualValue) && actualValue.length === 1 ? actualValue[0] : actualValue;
        let t = this.generate(target, "value");
        let condCode = this.unwrapLogical(this.generate(condition, "value"));
        let v = this.generate(unwrapped, "value");
        if (valHead === "unless") {
          if (condCode.includes(" ") || /[<>=&|]/.test(condCode))
            condCode = `(${condCode})`;
          return `if (!${condCode}) ${t} = ${v}`;
        }
        return `if (${condCode}) ${t} = ${v}`;
      }
    }
    let targetCode;
    if (target instanceof String && meta(target, "await") !== undefined) {
      targetCode = str(target);
    } else if (typeof target === "string" && this.reactiveVars?.has(target)) {
      targetCode = `${target}.value`;
    } else {
      this.suppressReactiveUnwrap = true;
      targetCode = this.generate(target, "value");
      this.suppressReactiveUnwrap = false;
    }
    let valueCode = this.generate(value, "value");
    let isObjLit = Array.isArray(value) && value[0] === "object";
    if (!isObjLit)
      valueCode = this.unwrap(valueCode);
    let needsParensVal = context === "value";
    let needsParensObj = context === "statement" && Array.isArray(target) && target[0] === "object";
    if (needsParensVal || needsParensObj)
      return `(${targetCode} ${op} ${valueCode})`;
    return `${targetCode} ${op} ${valueCode}`;
  }
  generatePropertyAccess(head, rest, context, sexpr) {
    let [obj, prop] = rest;
    this.suppressReactiveUnwrap = true;
    let objCode = this.generate(obj, "value");
    this.suppressReactiveUnwrap = false;
    let needsParens = CodeGenerator.NUMBER_LITERAL_RE.test(objCode) || Array.isArray(obj) && (obj[0] === "object" || obj[0] === "await" || obj[0] === "yield");
    let base = needsParens ? `(${objCode})` : objCode;
    if (meta(prop, "await") === true)
      return `await ${base}.${str(prop)}()`;
    if (meta(prop, "predicate"))
      return `(${base}.${str(prop)} != null)`;
    return `${base}.${str(prop)}`;
  }
  generateOptionalProperty(head, rest) {
    let [obj, prop] = rest;
    return `${this.generate(obj, "value")}?.${prop}`;
  }
  generateRegexIndex(head, rest) {
    let [value, regex, captureIndex] = rest;
    this.helpers.add("toSearchable");
    this.programVars.add("_");
    let v = this.generate(value, "value"), r = this.generate(regex, "value");
    let idx = captureIndex !== null ? this.generate(captureIndex, "value") : "0";
    let allowNL = r.includes("/m") ? ", true" : "";
    return `(_ = toSearchable(${v}${allowNL}).match(${r})) && _[${idx}]`;
  }
  generateIndexAccess(head, rest) {
    let [arr, index] = rest;
    if (Array.isArray(index) && (index[0] === ".." || index[0] === "...")) {
      let isIncl = index[0] === "..";
      let arrCode = this.generate(arr, "value");
      let [start, end] = index.slice(1);
      if (start === null && end === null)
        return `${arrCode}.slice()`;
      if (start === null) {
        if (isIncl && this.isNegativeOneLiteral(end))
          return `${arrCode}.slice(0)`;
        let e2 = this.generate(end, "value");
        return isIncl ? `${arrCode}.slice(0, +${e2} + 1 || 9e9)` : `${arrCode}.slice(0, ${e2})`;
      }
      if (end === null)
        return `${arrCode}.slice(${this.generate(start, "value")})`;
      let s = this.generate(start, "value");
      if (isIncl && this.isNegativeOneLiteral(end))
        return `${arrCode}.slice(${s})`;
      let e = this.generate(end, "value");
      return isIncl ? `${arrCode}.slice(${s}, +${e} + 1 || 9e9)` : `${arrCode}.slice(${s}, ${e})`;
    }
    return `${this.generate(arr, "value")}[${this.unwrap(this.generate(index, "value"))}]`;
  }
  generateOptIndex(head, rest) {
    let [arr, index] = rest;
    return `${this.generate(arr, "value")}?.[${this.generate(index, "value")}]`;
  }
  generateOptCall(head, rest) {
    let [fn, ...args] = rest;
    return `${this.generate(fn, "value")}?.(${args.map((a) => this.generate(a, "value")).join(", ")})`;
  }
  generateDef(head, rest, context, sexpr) {
    let [name, params, body] = rest;
    let sideEffectOnly = meta(name, "await") === true;
    let cleanName = str(name);
    let paramList = this.generateParamList(params);
    let bodyCode = this.generateFunctionBody(body, params, sideEffectOnly);
    let isAsync = this.containsAwait(body);
    let isGen = this.containsYield(body);
    return `${isAsync ? "async " : ""}function${isGen ? "*" : ""} ${cleanName}(${paramList}) ${bodyCode}`;
  }
  generateThinArrow(head, rest, context, sexpr) {
    let [params, body] = rest;
    let sideEffectOnly = this.nextFunctionIsVoid || false;
    this.nextFunctionIsVoid = false;
    let paramList = this.generateParamList(params);
    let bodyCode = this.generateFunctionBody(body, params, sideEffectOnly);
    let isAsync = this.containsAwait(body);
    let isGen = this.containsYield(body);
    let fn = `${isAsync ? "async " : ""}function${isGen ? "*" : ""}(${paramList}) ${bodyCode}`;
    return context === "value" ? `(${fn})` : fn;
  }
  generateFatArrow(head, rest, context, sexpr) {
    let [params, body] = rest;
    let sideEffectOnly = this.nextFunctionIsVoid || false;
    this.nextFunctionIsVoid = false;
    let paramList = this.generateParamList(params);
    let isSingle = params.length === 1 && typeof params[0] === "string" && !paramList.includes("=") && !paramList.includes("...") && !paramList.includes("[") && !paramList.includes("{");
    let paramSyntax = isSingle ? paramList : `(${paramList})`;
    let isAsync = this.containsAwait(body);
    let prefix = isAsync ? "async " : "";
    if (!sideEffectOnly) {
      if (Array.isArray(body) && body[0] === "block" && body.length === 2) {
        let expr = body[1];
        if (!Array.isArray(expr) || expr[0] !== "return") {
          return `${prefix}${paramSyntax} => ${this.generate(expr, "value")}`;
        }
      }
      if (!Array.isArray(body) || body[0] !== "block") {
        return `${prefix}${paramSyntax} => ${this.generate(body, "value")}`;
      }
    }
    let bodyCode = this.generateFunctionBody(body, params, sideEffectOnly);
    return `${prefix}${paramSyntax} => ${bodyCode}`;
  }
  generateReturn(head, rest, context, sexpr) {
    if (rest.length === 0)
      return "return";
    let [expr] = rest;
    if (this.sideEffectOnly)
      return "return";
    if (Array.isArray(expr) && expr[0] === "unless") {
      let [, condition, body] = expr;
      let val = Array.isArray(body) && body.length === 1 ? body[0] : body;
      return `if (!${this.generate(condition, "value")}) return ${this.generate(val, "value")}`;
    }
    if (Array.isArray(expr) && expr[0] === "if") {
      let [, condition, body, ...elseParts] = expr;
      if (elseParts.length === 0) {
        let val = Array.isArray(body) && body.length === 1 ? body[0] : body;
        return `if (${this.generate(condition, "value")}) return ${this.generate(val, "value")}`;
      }
    }
    if (Array.isArray(expr) && expr[0] === "new" && Array.isArray(expr[1]) && expr[1][0] === "unless") {
      let [, unlessNode] = expr;
      let [, condition, body] = unlessNode;
      let val = Array.isArray(body) && body.length === 1 ? body[0] : body;
      return `if (!${this.generate(condition, "value")}) return ${this.generate(["new", val], "value")}`;
    }
    return `return ${this.generate(expr, "value")}`;
  }
  generateState(head, rest) {
    let [name, expr] = rest;
    this.usesReactivity = true;
    let varName = str(name) ?? name;
    if (!this.reactiveVars)
      this.reactiveVars = new Set;
    this.reactiveVars.add(varName);
    return `const ${varName} = __state(${this.generate(expr, "value")})`;
  }
  generateComputed(head, rest) {
    let [name, expr] = rest;
    this.usesReactivity = true;
    if (!this.reactiveVars)
      this.reactiveVars = new Set;
    let varName = str(name) ?? name;
    this.reactiveVars.add(varName);
    return `const ${varName} = __computed(() => ${this.generate(expr, "value")})`;
  }
  generateReadonly(head, rest) {
    let [name, expr] = rest;
    return `const ${str(name) ?? name} = ${this.generate(expr, "value")}`;
  }
  generateEffect(head, rest) {
    let [target, body] = rest;
    this.usesReactivity = true;
    let bodyCode;
    if (Array.isArray(body) && body[0] === "block") {
      let stmts = this.withIndent(() => this.formatStatements(body.slice(1)));
      bodyCode = `{
${stmts.join(`
`)}
${this.indent()}}`;
    } else if (Array.isArray(body) && (body[0] === "->" || body[0] === "=>")) {
      let fnCode = this.generate(body, "value");
      if (target)
        return `const ${str(target) ?? this.generate(target, "value")} = __effect(${fnCode})`;
      return `__effect(${fnCode})`;
    } else {
      bodyCode = `{ ${this.generate(body, "value")}; }`;
    }
    let effectCode = `__effect(() => ${bodyCode})`;
    if (target)
      return `const ${str(target) ?? this.generate(target, "value")} = ${effectCode}`;
    return effectCode;
  }
  generateBreak() {
    return "break";
  }
  generateBreakIf(head, rest) {
    return `if (${this.generate(rest[0], "value")}) break`;
  }
  generateContinue() {
    return "continue";
  }
  generateContinueIf(head, rest) {
    return `if (${this.generate(rest[0], "value")}) continue`;
  }
  generateExistential(head, rest) {
    return `(${this.generate(rest[0], "value")} != null)`;
  }
  generateTernary(head, rest) {
    let [cond, then_, else_] = rest;
    return `(${this.unwrap(this.generate(cond, "value"))} ? ${this.generate(then_, "value")} : ${this.generate(else_, "value")})`;
  }
  generateLoop(head, rest) {
    return `while (true) ${this.generateLoopBody(rest[0])}`;
  }
  generateAwait(head, rest) {
    return `await ${this.generate(rest[0], "value")}`;
  }
  generateYield(head, rest) {
    return rest.length === 0 ? "yield" : `yield ${this.generate(rest[0], "value")}`;
  }
  generateYieldFrom(head, rest) {
    return `yield* ${this.generate(rest[0], "value")}`;
  }
  generateIf(head, rest, context, sexpr) {
    if (head === "unless") {
      let [condition2, body] = rest;
      if (Array.isArray(body) && body.length === 1 && (!Array.isArray(body[0]) || body[0][0] !== "block"))
        body = body[0];
      if (context === "value") {
        return `(!${this.generate(condition2, "value")} ? ${this.extractExpression(body)} : undefined)`;
      }
      let condCode = this.unwrap(this.generate(condition2, "value"));
      if (/[ <>=&|]/.test(condCode))
        condCode = `(${condCode})`;
      return `if (!${condCode}) ` + this.generate(body, "statement");
    }
    let [condition, thenBranch, ...elseBranches] = rest;
    return context === "value" ? this.generateIfAsExpression(condition, thenBranch, elseBranches) : this.generateIfAsStatement(condition, thenBranch, elseBranches);
  }
  generateForIn(head, rest, context, sexpr) {
    let [vars, iterable, step, guard, body] = rest;
    if (context === "value" && this.comprehensionDepth === 0) {
      let iterator = ["for-in", vars, iterable, step];
      return this.generate(["comprehension", body, [iterator], guard ? [guard] : []], context);
    }
    let varsArray = Array.isArray(vars) ? vars : [vars];
    let noVar = varsArray.length === 0;
    let [itemVar, indexVar] = noVar ? ["_i", null] : varsArray;
    let itemVarPattern = Array.isArray(itemVar) && (itemVar[0] === "array" || itemVar[0] === "object") ? this.generateDestructuringPattern(itemVar) : itemVar;
    if (step && step !== null) {
      let iterCode = this.generate(iterable, "value");
      let idxName = indexVar || "_i";
      let stepCode = this.generate(step, "value");
      let isNeg = this.isNegativeStep(step);
      let isMinus1 = isNeg && (step[1] === "1" || step[1] === 1 || str(step[1]) === "1");
      let isPlus1 = !isNeg && (step === "1" || step === 1 || str(step) === "1");
      let loopHeader;
      if (isMinus1)
        loopHeader = `for (let ${idxName} = ${iterCode}.length - 1; ${idxName} >= 0; ${idxName}--) `;
      else if (isPlus1)
        loopHeader = `for (let ${idxName} = 0; ${idxName} < ${iterCode}.length; ${idxName}++) `;
      else if (isNeg)
        loopHeader = `for (let ${idxName} = ${iterCode}.length - 1; ${idxName} >= 0; ${idxName} += ${stepCode}) `;
      else
        loopHeader = `for (let ${idxName} = 0; ${idxName} < ${iterCode}.length; ${idxName} += ${stepCode}) `;
      if (Array.isArray(body) && body[0] === "block") {
        let stmts = body.slice(1);
        this.indentLevel++;
        let lines = [];
        if (!noVar)
          lines.push(`const ${itemVarPattern} = ${iterCode}[${idxName}];`);
        if (guard) {
          lines.push(`if (${this.generate(guard, "value")}) {`);
          this.indentLevel++;
          lines.push(...this.formatStatements(stmts));
          this.indentLevel--;
          lines.push(this.indent() + "}");
        } else {
          lines.push(...stmts.map((s) => this.addSemicolon(s, this.generate(s, "statement"))));
        }
        this.indentLevel--;
        return loopHeader + `{
${lines.map((s) => this.indent() + s).join(`
`)}
${this.indent()}}`;
      }
      if (noVar) {
        return guard ? loopHeader + `{ if (${this.generate(guard, "value")}) ${this.generate(body, "statement")}; }` : loopHeader + `{ ${this.generate(body, "statement")}; }`;
      }
      return guard ? loopHeader + `{ const ${itemVarPattern} = ${iterCode}[${idxName}]; if (${this.generate(guard, "value")}) ${this.generate(body, "statement")}; }` : loopHeader + `{ const ${itemVarPattern} = ${iterCode}[${idxName}]; ${this.generate(body, "statement")}; }`;
    }
    if (indexVar) {
      let iterCode = this.generate(iterable, "value");
      let code2 = `for (let ${indexVar} = 0; ${indexVar} < ${iterCode}.length; ${indexVar}++) `;
      if (Array.isArray(body) && body[0] === "block") {
        code2 += `{
`;
        this.indentLevel++;
        code2 += this.indent() + `const ${itemVarPattern} = ${iterCode}[${indexVar}];
`;
        if (guard) {
          code2 += this.indent() + `if (${this.unwrap(this.generate(guard, "value"))}) {
`;
          this.indentLevel++;
          code2 += this.formatStatements(body.slice(1)).join(`
`) + `
`;
          this.indentLevel--;
          code2 += this.indent() + `}
`;
        } else {
          code2 += this.formatStatements(body.slice(1)).join(`
`) + `
`;
        }
        this.indentLevel--;
        code2 += this.indent() + "}";
      } else {
        code2 += guard ? `{ const ${itemVarPattern} = ${iterCode}[${indexVar}]; if (${this.unwrap(this.generate(guard, "value"))}) ${this.generate(body, "statement")}; }` : `{ const ${itemVarPattern} = ${iterCode}[${indexVar}]; ${this.generate(body, "statement")}; }`;
      }
      return code2;
    }
    let iterHead = Array.isArray(iterable) && iterable[0];
    if (iterHead instanceof String)
      iterHead = str(iterHead);
    if (iterHead === ".." || iterHead === "...") {
      let isExcl = iterHead === "...";
      let [start, end] = iterable.slice(1);
      let isSimple = (e) => typeof e === "number" || typeof e === "string" && !e.includes("(") || e instanceof String && !str(e).includes("(") || Array.isArray(e) && e[0] === ".";
      if (isSimple(start) && isSimple(end)) {
        let s = this.generate(start, "value"), e = this.generate(end, "value");
        let cmp = isExcl ? "<" : "<=";
        let inc = step ? `${itemVarPattern} += ${this.generate(step, "value")}` : `${itemVarPattern}++`;
        let code2 = `for (let ${itemVarPattern} = ${s}; ${itemVarPattern} ${cmp} ${e}; ${inc}) `;
        code2 += guard ? this.generateLoopBodyWithGuard(body, guard) : this.generateLoopBody(body);
        return code2;
      }
    }
    let code = `for (const ${itemVarPattern} of ${this.generate(iterable, "value")}) `;
    code += guard ? this.generateLoopBodyWithGuard(body, guard) : this.generateLoopBody(body);
    return code;
  }
  generateForOf(head, rest, context, sexpr) {
    let [vars, obj, own, guard, body] = rest;
    let [keyVar, valueVar] = Array.isArray(vars) ? vars : [vars];
    let objCode = this.generate(obj, "value");
    let code = `for (const ${keyVar} in ${objCode}) `;
    if (own && !valueVar && !guard) {
      if (Array.isArray(body) && body[0] === "block") {
        this.indentLevel++;
        let stmts = [`if (!Object.hasOwn(${objCode}, ${keyVar})) continue;`, ...body.slice(1).map((s) => this.addSemicolon(s, this.generate(s, "statement")))];
        this.indentLevel--;
        return code + `{
${stmts.map((s) => this.indent() + s).join(`
`)}
${this.indent()}}`;
      }
      return code + `{ if (!Object.hasOwn(${objCode}, ${keyVar})) continue; ${this.generate(body, "statement")}; }`;
    }
    if (valueVar) {
      if (Array.isArray(body) && body[0] === "block") {
        let stmts = body.slice(1);
        this.indentLevel++;
        let lines = [];
        if (own)
          lines.push(`if (!Object.hasOwn(${objCode}, ${keyVar})) continue;`);
        lines.push(`const ${valueVar} = ${objCode}[${keyVar}];`);
        if (guard) {
          lines.push(`if (${this.generate(guard, "value")}) {`);
          this.indentLevel++;
          lines.push(...stmts.map((s) => this.addSemicolon(s, this.generate(s, "statement"))));
          this.indentLevel--;
          lines.push(this.indent() + "}");
        } else {
          lines.push(...stmts.map((s) => this.addSemicolon(s, this.generate(s, "statement"))));
        }
        this.indentLevel--;
        return code + `{
${lines.map((s) => this.indent() + s).join(`
`)}
${this.indent()}}`;
      }
      let inline = "";
      if (own)
        inline += `if (!Object.hasOwn(${objCode}, ${keyVar})) continue; `;
      inline += `const ${valueVar} = ${objCode}[${keyVar}]; `;
      if (guard)
        inline += `if (${this.generate(guard, "value")}) `;
      inline += `${this.generate(body, "statement")};`;
      return code + `{ ${inline} }`;
    }
    code += guard ? this.generateLoopBodyWithGuard(body, guard) : this.generateLoopBody(body);
    return code;
  }
  generateForAs(head, rest, context, sexpr) {
    let varsArray = Array.isArray(rest[0]) ? rest[0] : [rest[0]];
    let [firstVar] = varsArray;
    let iterable = rest[1], isAwait = rest[2], guard = rest[3], body = rest[4];
    let needsTempVar = false, destructStmts = [];
    if (Array.isArray(firstVar) && firstVar[0] === "array") {
      let elements = firstVar.slice(1);
      let restIdx = elements.findIndex((el) => Array.isArray(el) && el[0] === "..." || el === "...");
      if (restIdx !== -1 && restIdx < elements.length - 1) {
        needsTempVar = true;
        let afterRest = elements.slice(restIdx + 1), afterCount = afterRest.length;
        let beforeRest = elements.slice(0, restIdx);
        let restEl = elements[restIdx];
        let restVar = Array.isArray(restEl) && restEl[0] === "..." ? restEl[1] : "_rest";
        let beforePattern = beforeRest.map((el) => el === "," ? "" : typeof el === "string" ? el : this.generate(el, "value")).join(", ");
        let firstPattern = beforePattern ? `${beforePattern}, ...${restVar}` : `...${restVar}`;
        let afterPattern = afterRest.map((el) => el === "," ? "" : typeof el === "string" ? el : this.generate(el, "value")).join(", ");
        destructStmts.push(`[${firstPattern}] = _item`);
        destructStmts.push(`[${afterPattern}] = ${restVar}.splice(-${afterCount})`);
        this.helpers.add("slice");
        elements.forEach((el) => {
          if (el === "," || el === "...")
            return;
          if (typeof el === "string")
            this.programVars.add(el);
          else if (Array.isArray(el) && el[0] === "..." && typeof el[1] === "string")
            this.programVars.add(el[1]);
        });
      }
    }
    let iterCode = this.generate(iterable, "value");
    let awaitKw = isAwait ? "await " : "";
    let itemVarPattern;
    if (needsTempVar)
      itemVarPattern = "_item";
    else if (Array.isArray(firstVar) && (firstVar[0] === "array" || firstVar[0] === "object"))
      itemVarPattern = this.generateDestructuringPattern(firstVar);
    else
      itemVarPattern = firstVar;
    let code = `for ${awaitKw}(const ${itemVarPattern} of ${iterCode}) `;
    if (needsTempVar && destructStmts.length > 0) {
      let stmts = this.unwrapBlock(body);
      let allStmts = this.withIndent(() => [
        ...destructStmts.map((s) => this.indent() + s + ";"),
        ...this.formatStatements(stmts)
      ]);
      code += `{
${allStmts.join(`
`)}
${this.indent()}}`;
    } else {
      code += guard ? this.generateLoopBodyWithGuard(body, guard) : this.generateLoopBody(body);
    }
    return code;
  }
  generateWhile(head, rest) {
    let cond = rest[0], guard = rest.length === 3 ? rest[1] : null, body = rest[rest.length - 1];
    let code = `while (${this.unwrap(this.generate(cond, "value"))}) `;
    return code + (guard ? this.generateLoopBodyWithGuard(body, guard) : this.generateLoopBody(body));
  }
  generateUntil(head, rest) {
    let [cond, body] = rest;
    return `while (!(${this.unwrap(this.generate(cond, "value"))})) ` + this.generateLoopBody(body);
  }
  generateRange(head, rest) {
    if (head === "...") {
      if (rest.length === 1)
        return `...${this.generate(rest[0], "value")}`;
      let [s2, e2] = rest;
      let sc2 = this.generate(s2, "value"), ec2 = this.generate(e2, "value");
      return `((s, e) => Array.from({length: Math.max(0, Math.abs(e - s))}, (_, i) => s + (i * (s <= e ? 1 : -1))))(${sc2}, ${ec2})`;
    }
    let [s, e] = rest;
    let sc = this.generate(s, "value"), ec = this.generate(e, "value");
    return `((s, e) => Array.from({length: Math.abs(e - s) + 1}, (_, i) => s + (i * (s <= e ? 1 : -1))))(${sc}, ${ec})`;
  }
  generateNot(head, rest) {
    let [operand] = rest;
    if (typeof operand === "string" || operand instanceof String)
      return `!${this.generate(operand, "value")}`;
    if (Array.isArray(operand)) {
      let highPrec = [".", "?.", "[]", "optindex", "optcall"];
      if (highPrec.includes(operand[0]))
        return `!${this.generate(operand, "value")}`;
    }
    let code = this.generate(operand, "value");
    return code.startsWith("(") ? `!${code}` : `(!${code})`;
  }
  generateBitwiseNot(head, rest) {
    return `(~${this.generate(rest[0], "value")})`;
  }
  generateIncDec(head, rest) {
    let [operand, isPostfix] = rest;
    let code = this.generate(operand, "value");
    return isPostfix ? `(${code}${head})` : `(${head}${code})`;
  }
  generateTypeof(head, rest) {
    return `typeof ${this.generate(rest[0], "value")}`;
  }
  generateDelete(head, rest) {
    return `(delete ${this.generate(rest[0], "value")})`;
  }
  generateInstanceof(head, rest, context, sexpr) {
    let [expr, type] = rest;
    let isNeg = meta(sexpr[0], "invert");
    let result = `(${this.generate(expr, "value")} instanceof ${this.generate(type, "value")})`;
    return isNeg ? `(!${result})` : result;
  }
  generateIn(head, rest, context, sexpr) {
    let [key, container] = rest;
    let keyCode = this.generate(key, "value");
    let isNeg = meta(sexpr[0], "invert");
    if (Array.isArray(container) && container[0] === "object") {
      let result2 = `(${keyCode} in ${this.generate(container, "value")})`;
      return isNeg ? `(!${result2})` : result2;
    }
    let c = this.generate(container, "value");
    let result = `(Array.isArray(${c}) || typeof ${c} === 'string' ? ${c}.includes(${keyCode}) : (${keyCode} in ${c}))`;
    return isNeg ? `(!${result})` : result;
  }
  generateOf(head, rest, context, sexpr) {
    let [value, container] = rest;
    let v = this.generate(value, "value"), c = this.generate(container, "value");
    let isNeg = meta(sexpr[0], "invert");
    let result = `(${v} in ${c})`;
    return isNeg ? `(!${result})` : result;
  }
  generateRegexMatch(head, rest) {
    let [left, right] = rest;
    this.helpers.add("toSearchable");
    this.programVars.add("_");
    let r = this.generate(right, "value");
    let allowNL = r.includes("/m") ? ", true" : "";
    return `(_ = toSearchable(${this.generate(left, "value")}${allowNL}).match(${r}))`;
  }
  generateNew(head, rest) {
    let [call] = rest;
    if (Array.isArray(call) && (call[0] === "." || call[0] === "?.")) {
      let [accType, target, prop] = call;
      if (Array.isArray(target) && !target[0].startsWith) {
        return `(${this.generate(["new", target], "value")}).${prop}`;
      }
      return `new ${this.generate(target, "value")}.${prop}`;
    }
    if (Array.isArray(call)) {
      let [ctor, ...args] = call;
      return `new ${this.generate(ctor, "value")}(${args.map((a) => this.unwrap(this.generate(a, "value"))).join(", ")})`;
    }
    return `new ${this.generate(call, "value")}()`;
  }
  generateLogicalAnd(head, rest, context, sexpr) {
    let ops = this.flattenBinaryChain(sexpr).slice(1);
    if (ops.length === 0)
      return "true";
    if (ops.length === 1)
      return this.generate(ops[0], "value");
    return `(${ops.map((o) => this.generate(o, "value")).join(" && ")})`;
  }
  generateLogicalOr(head, rest, context, sexpr) {
    let ops = this.flattenBinaryChain(sexpr).slice(1);
    if (ops.length === 0)
      return "true";
    if (ops.length === 1)
      return this.generate(ops[0], "value");
    return `(${ops.map((o) => this.generate(o, "value")).join(" || ")})`;
  }
  generateArray(head, elements) {
    let hasTrailingElision = elements.length > 0 && elements[elements.length - 1] === ",";
    let codes = elements.map((el) => {
      if (el === ",")
        return "";
      if (el === "...")
        return "";
      if (Array.isArray(el) && el[0] === "...")
        return `...${this.generate(el[1], "value")}`;
      return this.generate(el, "value");
    }).join(", ");
    return hasTrailingElision ? `[${codes},]` : `[${codes}]`;
  }
  generateObject(head, pairs, context) {
    if (pairs.length === 1 && Array.isArray(pairs[0]) && Array.isArray(pairs[0][1]) && pairs[0][1][0] === "comprehension") {
      let [keyVar, compNode] = pairs[0];
      let [, valueExpr, iterators, guards] = compNode;
      return this.generate(["object-comprehension", keyVar, valueExpr, iterators, guards], context);
    }
    let codes = pairs.map((pair) => {
      if (Array.isArray(pair) && pair[0] === "...")
        return `...${this.generate(pair[1], "value")}`;
      let [key, value, operator] = pair;
      let keyCode;
      if (Array.isArray(key) && key[0] === "dynamicKey")
        keyCode = `[${this.generate(key[1], "value")}]`;
      else if (Array.isArray(key) && key[0] === "str")
        keyCode = `[${this.generate(key, "value")}]`;
      else
        keyCode = this.generate(key, "value");
      let valCode = this.generate(value, "value");
      if (operator === "=")
        return `${keyCode} = ${valCode}`;
      if (operator === ":")
        return `${keyCode}: ${valCode}`;
      if (keyCode === valCode && !Array.isArray(key))
        return keyCode;
      return `${keyCode}: ${valCode}`;
    }).join(", ");
    return `{${codes}}`;
  }
  generateBlock(head, statements, context) {
    if (context === "statement") {
      let stmts = this.withIndent(() => this.formatStatements(statements));
      return `{
${stmts.join(`
`)}
${this.indent()}}`;
    }
    if (statements.length === 0)
      return "undefined";
    if (statements.length === 1)
      return this.generate(statements[0], context);
    let last = statements[statements.length - 1];
    let lastIsCtrl = Array.isArray(last) && ["break", "continue", "return", "throw"].includes(last[0]);
    if (lastIsCtrl) {
      let parts = statements.map((s) => this.addSemicolon(s, this.generate(s, "statement")));
      return `{
${this.withIndent(() => parts.map((p) => this.indent() + p).join(`
`))}
${this.indent()}}`;
    }
    return `(${statements.map((s) => this.generate(s, "value")).join(", ")})`;
  }
  generateTry(head, rest, context) {
    let needsReturns = context === "value";
    let tryCode = "try ";
    let tryBlock = rest[0];
    tryCode += needsReturns && Array.isArray(tryBlock) && tryBlock[0] === "block" ? this.generateBlockWithReturns(tryBlock) : this.generate(tryBlock, "statement");
    if (rest.length >= 2 && Array.isArray(rest[1]) && rest[1].length === 2 && rest[1][0] !== "block") {
      let [param, catchBlock] = rest[1];
      tryCode += " catch";
      if (param && Array.isArray(param) && (param[0] === "object" || param[0] === "array")) {
        tryCode += " (error)";
        let destructStmt = `(${this.generate(param, "value")} = error)`;
        catchBlock = Array.isArray(catchBlock) && catchBlock[0] === "block" ? ["block", destructStmt, ...catchBlock.slice(1)] : ["block", destructStmt, catchBlock];
      } else if (param) {
        tryCode += ` (${param})`;
      }
      tryCode += " " + (needsReturns && Array.isArray(catchBlock) && catchBlock[0] === "block" ? this.generateBlockWithReturns(catchBlock) : this.generate(catchBlock, "statement"));
    } else if (rest.length === 2) {
      tryCode += " finally " + this.generate(rest[1], "statement");
    }
    if (rest.length === 3)
      tryCode += " finally " + this.generate(rest[2], "statement");
    if (needsReturns) {
      let isAsync = this.containsAwait(rest[0]) || rest[1] && this.containsAwait(rest[1]);
      return `(${isAsync ? "async " : ""}() => { ${tryCode} })()`;
    }
    return tryCode;
  }
  generateThrow(head, rest, context) {
    let [expr] = rest;
    if (Array.isArray(expr)) {
      let checkExpr = expr, wrapperType = null;
      if (expr[0] === "new" && Array.isArray(expr[1]) && (expr[1][0] === "if" || expr[1][0] === "unless")) {
        wrapperType = "new";
        checkExpr = expr[1];
      } else if (expr[0] === "if" || expr[0] === "unless") {
        checkExpr = expr;
      }
      if (checkExpr[0] === "if" || checkExpr[0] === "unless") {
        let [condType, condition, body] = checkExpr;
        let unwrapped = Array.isArray(body) && body.length === 1 ? body[0] : body;
        expr = wrapperType === "new" ? ["new", unwrapped] : unwrapped;
        let condCode = this.generate(condition, "value");
        let throwCode = `throw ${this.generate(expr, "value")}`;
        return condType === "unless" ? `if (!(${condCode})) {
${this.indent()}  ${throwCode};
${this.indent()}}` : `if (${condCode}) {
${this.indent()}  ${throwCode};
${this.indent()}}`;
      }
    }
    let throwStmt = `throw ${this.generate(expr, "value")}`;
    return context === "value" ? `(() => { ${throwStmt}; })()` : throwStmt;
  }
  generateControl(head, rest, context) {
    let [rawOp, expr, ctrlSexpr] = rest;
    let op = str(rawOp);
    let isReturn = ctrlSexpr[0] === "return";
    let exprCode = this.generate(expr, "value");
    let ctrlValue = ctrlSexpr.length > 1 ? ctrlSexpr[1] : null;
    let ctrlCode = isReturn ? ctrlValue ? `return ${this.generate(ctrlValue, "value")}` : "return" : ctrlValue ? `throw ${this.generate(ctrlValue, "value")}` : "throw new Error()";
    let wrapped = this.wrapForCondition(exprCode);
    if (context === "value") {
      if (op === "??")
        return `(() => { const __v = ${exprCode}; if (__v == null) ${ctrlCode}; return __v; })()`;
      if (op === "||")
        return `(() => { const __v = ${exprCode}; if (!__v) ${ctrlCode}; return __v; })()`;
      return `(() => { const __v = ${exprCode}; if (__v) ${ctrlCode}; return __v; })()`;
    }
    if (op === "??")
      return `if (${wrapped} == null) ${ctrlCode}`;
    if (op === "||")
      return `if (!${wrapped}) ${ctrlCode}`;
    return `if (${wrapped}) ${ctrlCode}`;
  }
  generateSwitch(head, rest, context) {
    let [disc, whens, defaultCase] = rest;
    if (disc === null)
      return this.generateSwitchAsIfChain(whens, defaultCase, context);
    let switchBody = `switch (${this.generate(disc, "value")}) {
`;
    this.indentLevel++;
    for (let clause of whens) {
      let [, test, body] = clause;
      for (let t of test) {
        let tv = str(t) ?? t;
        let cv;
        if (Array.isArray(tv))
          cv = this.generate(tv, "value");
        else if (typeof tv === "string" && (tv.startsWith('"') || tv.startsWith("'")))
          cv = `'${tv.slice(1, -1)}'`;
        else
          cv = this.generate(tv, "value");
        switchBody += this.indent() + `case ${cv}:
`;
      }
      this.indentLevel++;
      switchBody += this.generateSwitchCaseBody(body, context);
      this.indentLevel--;
    }
    if (defaultCase) {
      switchBody += this.indent() + `default:
`;
      this.indentLevel++;
      switchBody += this.generateSwitchCaseBody(defaultCase, context);
      this.indentLevel--;
    }
    this.indentLevel--;
    switchBody += this.indent() + "}";
    if (context === "value") {
      let hasAwait = whens.some((w) => this.containsAwait(w[2])) || defaultCase && this.containsAwait(defaultCase);
      return `(${hasAwait ? "async " : ""}() => { ${switchBody} })()`;
    }
    return switchBody;
  }
  generateWhen() {
    throw new Error("when clause should be handled by switch");
  }
  generateComprehension(head, rest, context) {
    let [expr, iterators, guards] = rest;
    if (context === "statement")
      return this.generateComprehensionAsLoop(expr, iterators, guards);
    if (this.comprehensionTarget)
      return this.generateComprehensionWithTarget(expr, iterators, guards, this.comprehensionTarget);
    let hasAwait = this.containsAwait(expr);
    let code = `(${hasAwait ? "async " : ""}() => {
`;
    this.indentLevel++;
    this.comprehensionDepth++;
    code += this.indent() + `const result = [];
`;
    for (let iter of iterators) {
      let [iterType, vars, iterable, stepOrOwn] = iter;
      if (iterType === "for-in") {
        let step = stepOrOwn;
        let va = Array.isArray(vars) ? vars : [vars];
        let noVar = va.length === 0;
        let [itemVar, indexVar] = noVar ? ["_i", null] : va;
        let ivp = Array.isArray(itemVar) && (itemVar[0] === "array" || itemVar[0] === "object") ? this.generateDestructuringPattern(itemVar) : itemVar;
        if (step && step !== null) {
          let ih = Array.isArray(iterable) && iterable[0];
          if (ih instanceof String)
            ih = str(ih);
          let isRange = ih === ".." || ih === "...";
          if (isRange) {
            let isExcl = ih === "...";
            let [s, e] = iterable.slice(1);
            let sc = this.generate(s, "value"), ec = this.generate(e, "value"), stc = this.generate(step, "value");
            code += this.indent() + `for (let ${ivp} = ${sc}; ${ivp} ${isExcl ? "<" : "<="} ${ec}; ${ivp} += ${stc}) {
`;
            this.indentLevel++;
          } else {
            let ic = this.generate(iterable, "value"), idxN = indexVar || "_i", stc = this.generate(step, "value");
            let isNeg = this.isNegativeStep(step);
            code += isNeg ? this.indent() + `for (let ${idxN} = ${ic}.length - 1; ${idxN} >= 0; ${idxN} += ${stc}) {
` : this.indent() + `for (let ${idxN} = 0; ${idxN} < ${ic}.length; ${idxN} += ${stc}) {
`;
            this.indentLevel++;
            if (!noVar)
              code += this.indent() + `const ${ivp} = ${ic}[${idxN}];
`;
          }
        } else if (indexVar) {
          let ic = this.generate(iterable, "value");
          code += this.indent() + `for (let ${indexVar} = 0; ${indexVar} < ${ic}.length; ${indexVar}++) {
`;
          this.indentLevel++;
          code += this.indent() + `const ${ivp} = ${ic}[${indexVar}];
`;
        } else {
          code += this.indent() + `for (const ${ivp} of ${this.generate(iterable, "value")}) {
`;
          this.indentLevel++;
        }
      } else if (iterType === "for-of") {
        let own = stepOrOwn;
        let va = Array.isArray(vars) ? vars : [vars];
        let [kv, vv] = va;
        let kvp = Array.isArray(kv) && (kv[0] === "array" || kv[0] === "object") ? this.generateDestructuringPattern(kv) : kv;
        let oc = this.generate(iterable, "value");
        code += this.indent() + `for (const ${kvp} in ${oc}) {
`;
        this.indentLevel++;
        if (own)
          code += this.indent() + `if (!Object.hasOwn(${oc}, ${kvp})) continue;
`;
        if (vv)
          code += this.indent() + `const ${vv} = ${oc}[${kvp}];
`;
      } else if (iterType === "for-as") {
        let isAwait = iter[3];
        let va = Array.isArray(vars) ? vars : [vars];
        let [fv] = va;
        let ivp = Array.isArray(fv) && (fv[0] === "array" || fv[0] === "object") ? this.generateDestructuringPattern(fv) : fv;
        code += this.indent() + `for ${isAwait ? "await " : ""}(const ${ivp} of ${this.generate(iterable, "value")}) {
`;
        this.indentLevel++;
      }
    }
    for (let guard of guards) {
      code += this.indent() + `if (${this.generate(guard, "value")}) {
`;
      this.indentLevel++;
    }
    let hasCtrl = (node) => {
      if (typeof node === "string" && (node === "break" || node === "continue"))
        return true;
      if (!Array.isArray(node))
        return false;
      if (["break", "continue", "break-if", "continue-if", "return", "throw"].includes(node[0]))
        return true;
      if (node[0] === "if" || node[0] === "unless")
        return node.slice(1).some(hasCtrl);
      return node.some(hasCtrl);
    };
    let loopStmts = ["for-in", "for-of", "for-as", "while", "until", "loop"];
    if (Array.isArray(expr) && expr[0] === "block") {
      for (let i = 0;i < expr.length - 1; i++) {
        let s = expr[i + 1], isLast = i === expr.length - 2;
        if (!isLast || hasCtrl(s)) {
          code += this.indent() + this.generate(s, "statement") + `;
`;
        } else if (Array.isArray(s) && loopStmts.includes(s[0])) {
          code += this.indent() + this.generate(s, "statement") + `;
`;
        } else {
          code += this.indent() + `result.push(${this.generate(s, "value")});
`;
        }
      }
    } else {
      if (hasCtrl(expr)) {
        code += this.indent() + this.generate(expr, "statement") + `;
`;
      } else if (Array.isArray(expr) && loopStmts.includes(expr[0])) {
        code += this.indent() + this.generate(expr, "statement") + `;
`;
      } else {
        code += this.indent() + `result.push(${this.generate(expr, "value")});
`;
      }
    }
    for (let i = 0;i < guards.length; i++) {
      this.indentLevel--;
      code += this.indent() + `}
`;
    }
    for (let i = 0;i < iterators.length; i++) {
      this.indentLevel--;
      code += this.indent() + `}
`;
    }
    code += this.indent() + `return result;
`;
    this.indentLevel--;
    this.comprehensionDepth--;
    code += this.indent() + "})()";
    return code;
  }
  generateObjectComprehension(head, rest, context) {
    let [keyExpr, valueExpr, iterators, guards] = rest;
    let code = `(() => {
`;
    this.indentLevel++;
    code += this.indent() + `const result = {};
`;
    for (let iter of iterators) {
      let [iterType, vars, iterable, own] = iter;
      if (iterType === "for-of") {
        let [kv, vv] = vars;
        let oc = this.generate(iterable, "value");
        code += this.indent() + `for (const ${kv} in ${oc}) {
`;
        this.indentLevel++;
        if (own)
          code += this.indent() + `if (!Object.hasOwn(${oc}, ${kv})) continue;
`;
        if (vv)
          code += this.indent() + `const ${vv} = ${oc}[${kv}];
`;
      }
    }
    for (let guard of guards) {
      code += this.indent() + `if (${this.generate(guard, "value")}) {
`;
      this.indentLevel++;
    }
    code += this.indent() + `result[${this.generate(keyExpr, "value")}] = ${this.generate(valueExpr, "value")};
`;
    for (let i = 0;i < guards.length; i++) {
      this.indentLevel--;
      code += this.indent() + `}
`;
    }
    for (let i = 0;i < iterators.length; i++) {
      this.indentLevel--;
      code += this.indent() + `}
`;
    }
    code += this.indent() + `return result;
`;
    this.indentLevel--;
    code += this.indent() + "})()";
    return code;
  }
  generateClass(head, rest, context) {
    let [className, parentClass, ...bodyParts] = rest;
    let code = className ? `class ${className}` : "class";
    if (parentClass)
      code += ` extends ${this.generate(parentClass, "value")}`;
    code += ` {
`;
    if (bodyParts.length > 0 && Array.isArray(bodyParts[0])) {
      let bodyBlock = bodyParts[0];
      if (bodyBlock[0] === "block") {
        let bodyStmts = bodyBlock.slice(1);
        let hasObjFirst = bodyStmts.length > 0 && Array.isArray(bodyStmts[0]) && bodyStmts[0][0] === "object";
        if (hasObjFirst && bodyStmts.length === 1) {
          let members = bodyStmts[0].slice(1);
          this.indentLevel++;
          let boundMethods = [];
          for (let [mk, mv] of members) {
            let isStatic = this.isStaticMember(mk);
            let isComputed = this.isComputedMember(mk);
            let mName = this.extractMemberName(mk);
            if (this.isBoundMethod(mv) && !isStatic && !isComputed && mName !== "constructor")
              boundMethods.push(mName);
          }
          for (let [mk, mv] of members) {
            let isStatic = this.isStaticMember(mk);
            let isComputed = this.isComputedMember(mk);
            let mName = this.extractMemberName(mk);
            if (Array.isArray(mv) && (mv[0] === "->" || mv[0] === "=>")) {
              let [, params, body] = mv;
              let hasAwait = this.containsAwait(body), hasYield = this.containsYield(body);
              let cleanParams = params, autoAssign = [];
              if (mName === "constructor") {
                cleanParams = params.map((p) => {
                  if (Array.isArray(p) && p[0] === "." && p[1] === "this") {
                    autoAssign.push(`this.${p[2]} = ${p[2]}`);
                    return p[2];
                  }
                  return p;
                });
                for (let bm of boundMethods)
                  autoAssign.unshift(`this.${bm} = this.${bm}.bind(this)`);
              }
              let pList = this.generateParamList(cleanParams);
              let prefix = (isStatic ? "static " : "") + (hasAwait ? "async " : "") + (hasYield ? "*" : "");
              code += this.indent() + `${prefix}${mName}(${pList}) `;
              if (!isComputed)
                this.currentMethodName = mName;
              code += this.generateMethodBody(body, autoAssign, mName === "constructor", cleanParams);
              this.currentMethodName = null;
              code += `
`;
            } else if (isStatic) {
              code += this.indent() + `static ${mName} = ${this.generate(mv, "value")};
`;
            } else {
              code += this.indent() + `${mName} = ${this.generate(mv, "value")};
`;
            }
          }
          this.indentLevel--;
        } else if (hasObjFirst) {
          let members = bodyStmts[0].slice(1);
          let additionalStmts = bodyStmts.slice(1);
          this.indentLevel++;
          for (let [mk, mv] of members) {
            let isStatic = this.isStaticMember(mk), mName = this.extractMemberName(mk);
            if (Array.isArray(mv) && (mv[0] === "->" || mv[0] === "=>")) {
              let [, params, body] = mv;
              let pList = this.generateParamList(params);
              let prefix = (isStatic ? "static " : "") + (this.containsAwait(body) ? "async " : "") + (this.containsYield(body) ? "*" : "");
              code += this.indent() + `${prefix}${mName}(${pList}) `;
              this.currentMethodName = mName;
              code += this.generateMethodBody(body, [], mName === "constructor", params);
              this.currentMethodName = null;
              code += `
`;
            } else if (isStatic) {
              code += this.indent() + `static ${mName} = ${this.generate(mv, "value")};
`;
            } else {
              code += this.indent() + `${mName} = ${this.generate(mv, "value")};
`;
            }
          }
          for (let stmt of additionalStmts) {
            if (Array.isArray(stmt) && stmt[0] === "class") {
              let [, nestedName, parent, ...nestedBody] = stmt;
              if (Array.isArray(nestedName) && nestedName[0] === "." && nestedName[1] === "this") {
                code += this.indent() + `static ${nestedName[2]} = ${this.generate(["class", null, parent, ...nestedBody], "value")};
`;
              }
            } else {
              code += this.indent() + this.generate(stmt, "statement") + `;
`;
            }
          }
          this.indentLevel--;
        } else {
          this.indentLevel++;
          for (let stmt of bodyStmts) {
            if (Array.isArray(stmt) && stmt[0] === "=" && Array.isArray(stmt[1]) && stmt[1][0] === "." && stmt[1][1] === "this") {
              code += this.indent() + `static ${stmt[1][2]} = ${this.generate(stmt[2], "value")};
`;
            } else {
              code += this.indent() + this.generate(stmt, "statement") + `;
`;
            }
          }
          this.indentLevel--;
        }
      }
    }
    code += this.indent() + "}";
    return code;
  }
  generateSuper(head, rest) {
    if (rest.length === 0) {
      if (this.currentMethodName && this.currentMethodName !== "constructor")
        return `super.${this.currentMethodName}()`;
      return "super";
    }
    let args = rest.map((a) => this.unwrap(this.generate(a, "value"))).join(", ");
    if (this.currentMethodName && this.currentMethodName !== "constructor")
      return `super.${this.currentMethodName}(${args})`;
    return `super(${args})`;
  }
  generateImport(head, rest, context, sexpr) {
    if (rest.length === 1) {
      let importExpr = `import(${this.generate(rest[0], "value")})`;
      if (meta(sexpr[0], "await") === true)
        return `(await ${importExpr})`;
      return importExpr;
    }
    let [specifier, source] = rest;
    let fixedSource = this.addJsExtensionAndAssertions(source);
    if (typeof specifier === "string")
      return `import ${specifier} from ${fixedSource}`;
    if (Array.isArray(specifier)) {
      if (specifier[0] === "*" && specifier.length === 2)
        return `import * as ${specifier[1]} from ${fixedSource}`;
      if (typeof specifier[0] === "string" && Array.isArray(specifier[1])) {
        let def = specifier[0], second = specifier[1];
        if (second[0] === "*" && second.length === 2)
          return `import ${def}, * as ${second[1]} from ${fixedSource}`;
        let names2 = (Array.isArray(second) ? second : [second]).map((i) => Array.isArray(i) && i.length === 2 ? `${i[0]} as ${i[1]}` : i).join(", ");
        return `import ${def}, { ${names2} } from ${fixedSource}`;
      }
      let names = specifier.map((i) => Array.isArray(i) && i.length === 2 ? `${i[0]} as ${i[1]}` : i).join(", ");
      return `import { ${names} } from ${fixedSource}`;
    }
    return `import ${this.generate(specifier, "value")} from ${fixedSource}`;
  }
  generateExport(head, rest) {
    let [decl] = rest;
    if (Array.isArray(decl) && decl.every((i) => typeof i === "string"))
      return `export { ${decl.join(", ")} }`;
    if (Array.isArray(decl) && decl[0] === "=")
      return `export const ${decl[1]} = ${this.generate(decl[2], "value")}`;
    return `export ${this.generate(decl, "statement")}`;
  }
  generateExportDefault(head, rest) {
    let [expr] = rest;
    if (Array.isArray(expr) && expr[0] === "=") {
      return `const ${expr[1]} = ${this.generate(expr[2], "value")};
export default ${expr[1]}`;
    }
    return `export default ${this.generate(expr, "statement")}`;
  }
  generateExportAll(head, rest) {
    return `export * from ${this.addJsExtensionAndAssertions(rest[0])}`;
  }
  generateExportFrom(head, rest) {
    let [specifiers, source] = rest;
    let fixedSource = this.addJsExtensionAndAssertions(source);
    if (Array.isArray(specifiers)) {
      let names = specifiers.map((i) => Array.isArray(i) && i.length === 2 ? `${i[0]} as ${i[1]}` : i).join(", ");
      return `export { ${names} } from ${fixedSource}`;
    }
    return `export ${specifiers} from ${fixedSource}`;
  }
  generateDoIIFE(head, rest) {
    return `(${this.generate(rest[0], "statement")})()`;
  }
  generateRegex(head, rest) {
    return rest.length === 0 ? head : this.generate(rest[0], "value");
  }
  generateTaggedTemplate(head, rest) {
    let [tag, s] = rest;
    let tagCode = this.generate(tag, "value");
    let content = this.generate(s, "value");
    if (content.startsWith("`"))
      return `${tagCode}${content}`;
    if (content.startsWith('"') || content.startsWith("'"))
      return `${tagCode}\`${content.slice(1, -1)}\``;
    return `${tagCode}\`${content}\``;
  }
  generateString(head, rest) {
    let result = "`";
    for (let part of rest) {
      if (part instanceof String) {
        result += this.extractStringContent(part);
      } else if (typeof part === "string") {
        if (part.startsWith('"') || part.startsWith("'")) {
          if (this.options.debug)
            console.warn("[Rip] Unexpected quoted primitive in str:", part);
          result += part.slice(1, -1);
        } else {
          result += part;
        }
      } else if (Array.isArray(part)) {
        if (part.length === 1 && typeof part[0] === "string" && !Array.isArray(part[0])) {
          let v = part[0];
          result += /^[\d"']/.test(v) ? "${" + this.generate(v, "value") + "}" : "${" + v + "}";
        } else {
          let expr = part.length === 1 && Array.isArray(part[0]) ? part[0] : part;
          result += "${" + this.generate(expr, "value") + "}";
        }
      }
    }
    return result + "`";
  }
  findPostfixConditional(expr) {
    if (!Array.isArray(expr))
      return null;
    let h = expr[0];
    if ((h === "unless" || h === "if") && expr.length === 3)
      return { type: h, condition: expr[1], value: expr[2] };
    if (h === "+" || h === "-" || h === "*" || h === "/") {
      for (let i = 1;i < expr.length; i++) {
        let found = this.findPostfixConditional(expr[i]);
        if (found) {
          found.parentOp = h;
          found.operandIndex = i;
          found.otherOperands = expr.slice(1).filter((_, idx) => idx !== i - 1);
          return found;
        }
      }
    }
    return null;
  }
  rebuildWithoutConditional(cond) {
    let val = Array.isArray(cond.value) && cond.value.length === 1 ? cond.value[0] : cond.value;
    if (cond.parentOp)
      return [cond.parentOp, ...cond.otherOperands, val];
    return val;
  }
  generateDestructuringPattern(pattern) {
    return this.formatParam(pattern);
  }
  generateParamList(params) {
    let expIdx = params.findIndex((p) => Array.isArray(p) && p[0] === "expansion");
    if (expIdx !== -1) {
      let before = params.slice(0, expIdx), after = params.slice(expIdx + 1);
      let regular = before.map((p) => this.formatParam(p)).join(", ");
      this.expansionAfterParams = after;
      return regular ? `${regular}, ..._rest` : "..._rest";
    }
    let restIdx = params.findIndex((p) => Array.isArray(p) && p[0] === "rest");
    if (restIdx !== -1 && restIdx < params.length - 1) {
      let before = params.slice(0, restIdx), restP = params[restIdx], after = params.slice(restIdx + 1);
      let beforeP = before.map((p) => this.formatParam(p));
      this.restMiddleParam = { restName: restP[1], afterParams: after, beforeCount: before.length };
      return beforeP.length > 0 ? `${beforeP.join(", ")}, ...${restP[1]}` : `...${restP[1]}`;
    }
    this.expansionAfterParams = null;
    this.restMiddleParam = null;
    return params.map((p) => this.formatParam(p)).join(", ");
  }
  formatParam(param) {
    if (typeof param === "string")
      return param;
    if (Array.isArray(param) && param[0] === "rest")
      return `...${param[1]}`;
    if (Array.isArray(param) && param[0] === "default")
      return `${param[1]} = ${this.generate(param[2], "value")}`;
    if (Array.isArray(param) && param[0] === "." && param[1] === "this")
      return param[2];
    if (Array.isArray(param) && param[0] === "array") {
      let els = param.slice(1).map((el) => {
        if (el === ",")
          return "";
        if (el === "...")
          return "";
        if (Array.isArray(el) && el[0] === "...")
          return `...${el[1]}`;
        if (Array.isArray(el) && el[0] === "=" && typeof el[1] === "string")
          return `${el[1]} = ${this.generate(el[2], "value")}`;
        if (typeof el === "string")
          return el;
        return this.formatParam(el);
      });
      return `[${els.join(", ")}]`;
    }
    if (Array.isArray(param) && param[0] === "object") {
      let pairs = param.slice(1).map((pair) => {
        if (Array.isArray(pair) && pair[0] === "...")
          return `...${pair[1]}`;
        if (Array.isArray(pair) && pair[0] === "default")
          return `${pair[1]} = ${this.generate(pair[2], "value")}`;
        let [key, value] = pair;
        if (key === value)
          return key;
        return `${key}: ${value}`;
      });
      return `{${pairs.join(", ")}}`;
    }
    return JSON.stringify(param);
  }
  generateBodyWithReturns(body, params = [], options = {}) {
    let { sideEffectOnly = false, autoAssignments = [], isConstructor = false, hasExpansionParams = false } = options;
    let prevSEO = this.sideEffectOnly;
    this.sideEffectOnly = sideEffectOnly;
    let paramNames = new Set;
    let extractPN = (p) => {
      if (typeof p === "string")
        paramNames.add(p);
      else if (Array.isArray(p)) {
        if (p[0] === "rest" || p[0] === "...") {
          if (typeof p[1] === "string")
            paramNames.add(p[1]);
        } else if (p[0] === "default") {
          if (typeof p[1] === "string")
            paramNames.add(p[1]);
        } else if (p[0] === "array" || p[0] === "object")
          this.collectVarsFromArray(p, paramNames);
      }
    };
    if (Array.isArray(params))
      params.forEach(extractPN);
    let bodyVars = this.collectFunctionVariables(body);
    let newVars = new Set([...bodyVars].filter((v) => !this.programVars.has(v) && !this.reactiveVars?.has(v) && !paramNames.has(v)));
    let noRetStmts = ["return", "throw", "break", "continue"];
    let loopStmts = ["for-in", "for-of", "for-as", "while", "until", "loop"];
    if (Array.isArray(body) && body[0] === "block") {
      let statements = this.unwrapBlock(body);
      if (hasExpansionParams && this.expansionAfterParams?.length > 0) {
        let extr = this.expansionAfterParams.map((p, i) => {
          let pn = typeof p === "string" ? p : JSON.stringify(p);
          return `const ${pn} = _rest[_rest.length - ${this.expansionAfterParams.length - i}]`;
        });
        statements = [...extr, ...statements];
        this.expansionAfterParams = null;
      }
      if (this.restMiddleParam) {
        let { restName, afterParams } = this.restMiddleParam;
        let afterCount = afterParams.length;
        let extr = [];
        afterParams.forEach((p, i) => {
          let pn = typeof p === "string" ? p : Array.isArray(p) && p[0] === "default" ? p[1] : JSON.stringify(p);
          extr.push(`const ${pn} = ${restName}[${restName}.length - ${afterCount - i}]`);
        });
        if (afterCount > 0)
          extr.push(`${restName} = ${restName}.slice(0, -${afterCount})`);
        statements = [...extr, ...statements];
        this.restMiddleParam = null;
      }
      this.indentLevel++;
      let code = `{
`;
      if (newVars.size > 0)
        code += this.indent() + `let ${Array.from(newVars).sort().join(", ")};
`;
      let firstIsSuper = autoAssignments.length > 0 && statements.length > 0 && Array.isArray(statements[0]) && statements[0][0] === "super";
      let genStatements = (stmts) => {
        stmts.forEach((stmt, index) => {
          let isLast = index === stmts.length - 1;
          let h = Array.isArray(stmt) ? stmt[0] : null;
          if (!isLast && h === "comprehension") {
            let [, expr, iters, guards] = stmt;
            code += this.indent() + this.generateComprehensionAsLoop(expr, iters, guards) + `
`;
            return;
          }
          if (!isConstructor && !sideEffectOnly && isLast && (h === "if" || h === "unless")) {
            let [cond, thenB, ...elseB] = stmt.slice(1);
            let hasMulti = (b) => Array.isArray(b) && b[0] === "block" && b.length > 2;
            if (hasMulti(thenB) || elseB.some(hasMulti)) {
              code += this.generateIfElseWithEarlyReturns(stmt);
              return;
            }
          }
          if (!isConstructor && !sideEffectOnly && isLast && h === "=") {
            let [target, value] = stmt.slice(1);
            if (typeof target === "string" && Array.isArray(value)) {
              let vh = value[0];
              if (vh === "comprehension" || vh === "for-in") {
                this.comprehensionTarget = target;
                code += this.generate(value, "value");
                this.comprehensionTarget = null;
                code += this.indent() + `return ${target};
`;
                return;
              }
            }
          }
          let needsReturn = !isConstructor && !sideEffectOnly && isLast && !noRetStmts.includes(h) && !loopStmts.includes(h) && !this.hasExplicitControlFlow(stmt);
          let ctx = needsReturn ? "value" : "statement";
          let sc = this.generate(stmt, ctx);
          if (needsReturn)
            code += this.indent() + "return " + sc + `;
`;
          else
            code += this.indent() + this.addSemicolon(stmt, sc) + `
`;
        });
      };
      if (firstIsSuper) {
        let isSuperOnly = statements.length === 1;
        if (isSuperOnly && !isConstructor)
          code += this.indent() + "return " + this.generate(statements[0], "value") + `;
`;
        else
          code += this.indent() + this.generate(statements[0], "statement") + `;
`;
        for (let a of autoAssignments)
          code += this.indent() + a + `;
`;
        genStatements(statements.slice(1));
      } else {
        for (let a of autoAssignments)
          code += this.indent() + a + `;
`;
        genStatements(statements);
      }
      if (sideEffectOnly && statements.length > 0) {
        let lastH = Array.isArray(statements[statements.length - 1]) ? statements[statements.length - 1][0] : null;
        if (!noRetStmts.includes(lastH))
          code += this.indent() + `return;
`;
      }
      this.indentLevel--;
      code += this.indent() + "}";
      this.sideEffectOnly = prevSEO;
      return code;
    }
    this.sideEffectOnly = prevSEO;
    if (isConstructor || this.hasExplicitControlFlow(body))
      return `{ ${this.generate(body, "statement")}; }`;
    if (Array.isArray(body) && (noRetStmts.includes(body[0]) || loopStmts.includes(body[0])))
      return `{ ${this.generate(body, "statement")}; }`;
    if (sideEffectOnly)
      return `{ ${this.generate(body, "statement")}; return; }`;
    return `{ return ${this.generate(body, "value")}; }`;
  }
  generateFunctionBody(body, params = [], sideEffectOnly = false) {
    return this.generateBodyWithReturns(body, params, { sideEffectOnly, hasExpansionParams: this.expansionAfterParams?.length > 0 });
  }
  generateMethodBody(body, autoAssignments = [], isConstructor = false, params = []) {
    return this.generateBodyWithReturns(body, params, { autoAssignments, isConstructor });
  }
  generateBlockWithReturns(block) {
    if (!Array.isArray(block) || block[0] !== "block")
      return this.generate(block, "statement");
    let stmts = this.unwrapBlock(block);
    let lines = this.withIndent(() => stmts.map((stmt, i) => {
      let isLast = i === stmts.length - 1;
      let h = Array.isArray(stmt) ? stmt[0] : null;
      let needsReturn = isLast && !["return", "throw", "break", "continue"].includes(h);
      let code = this.generate(stmt, needsReturn ? "value" : "statement");
      return needsReturn ? this.indent() + "return " + code + ";" : this.indent() + code + ";";
    }));
    return `{
${lines.join(`
`)}
${this.indent()}}`;
  }
  generateLoopBody(body) {
    if (!Array.isArray(body))
      return `{ ${this.generate(body, "statement")}; }`;
    if (body[0] === "block" || Array.isArray(body[0])) {
      let stmts = body[0] === "block" ? body.slice(1) : body;
      let lines = this.withIndent(() => stmts.map((s) => {
        if (Array.isArray(s) && s[0] === "comprehension") {
          let [, expr, iters, guards] = s;
          return this.indent() + this.generateComprehensionAsLoop(expr, iters, guards);
        }
        return this.indent() + this.addSemicolon(s, this.generate(s, "statement"));
      }));
      return `{
${lines.join(`
`)}
${this.indent()}}`;
    }
    return `{ ${this.generate(body, "statement")}; }`;
  }
  generateLoopBodyWithGuard(body, guard) {
    let guardCond = this.unwrap(this.generate(guard, "value"));
    if (!Array.isArray(body))
      return `{ if (${guardCond}) ${this.generate(body, "statement")}; }`;
    if (body[0] === "block" || Array.isArray(body[0])) {
      let stmts = body[0] === "block" ? body.slice(1) : body;
      let loopIndent = this.withIndent(() => this.indent());
      let guardCode = `if (${guardCond}) {
`;
      let innerStmts = this.withIndent(() => {
        this.indentLevel++;
        let r = this.formatStatements(stmts);
        this.indentLevel--;
        return r;
      });
      let close = this.withIndent(() => this.indent() + "}");
      return `{
${loopIndent}${guardCode}${innerStmts.join(`
`)}
${close}
${this.indent()}}`;
    }
    return `{ if (${this.generate(guard, "value")}) ${this.generate(body, "statement")}; }`;
  }
  generateComprehensionWithTarget(expr, iterators, guards, targetVar) {
    let code = "";
    code += this.indent() + `${targetVar} = [];
`;
    let unwrappedExpr = Array.isArray(expr) && expr[0] === "block" && expr.length === 2 ? expr[1] : expr;
    if (iterators.length === 1) {
      let [iterType, vars, iterable, stepOrOwn] = iterators[0];
      if (iterType === "for-in") {
        let step = stepOrOwn;
        let va = Array.isArray(vars) ? vars : [vars];
        let noVar = va.length === 0;
        let [itemVar, indexVar] = noVar ? ["_i", null] : va;
        let ivp = Array.isArray(itemVar) && (itemVar[0] === "array" || itemVar[0] === "object") ? this.generateDestructuringPattern(itemVar) : itemVar;
        if (step && step !== null) {
          let ih = Array.isArray(iterable) && iterable[0];
          if (ih instanceof String)
            ih = str(ih);
          let isRange = ih === ".." || ih === "...";
          if (isRange) {
            let isExcl = ih === "...";
            let [s, e] = iterable.slice(1);
            code += this.indent() + `for (let ${ivp} = ${this.generate(s, "value")}; ${ivp} ${isExcl ? "<" : "<="} ${this.generate(e, "value")}; ${ivp} += ${this.generate(step, "value")}) {
`;
          } else {
            let ic = this.generate(iterable, "value"), idxN = indexVar || "_i", stc = this.generate(step, "value");
            let isNeg = this.isNegativeStep(step);
            code += isNeg ? this.indent() + `for (let ${idxN} = ${ic}.length - 1; ${idxN} >= 0; ${idxN} += ${stc}) {
` : this.indent() + `for (let ${idxN} = 0; ${idxN} < ${ic}.length; ${idxN} += ${stc}) {
`;
            this.indentLevel++;
            if (!noVar)
              code += this.indent() + `const ${ivp} = ${ic}[${idxN}];
`;
          }
        } else {
          code += this.indent() + `for (const ${ivp} of ${this.generate(iterable, "value")}) {
`;
        }
        this.indentLevel++;
        if (guards && guards.length > 0) {
          code += this.indent() + `if (${guards.map((g) => this.generate(g, "value")).join(" && ")}) {
`;
          this.indentLevel++;
        }
        code += this.indent() + `${targetVar}.push(${this.unwrap(this.generate(unwrappedExpr, "value"))});
`;
        if (guards && guards.length > 0) {
          this.indentLevel--;
          code += this.indent() + `}
`;
        }
        this.indentLevel--;
        code += this.indent() + `}
`;
        return code;
      }
    }
    return this.indent() + `${targetVar} = (() => { /* complex comprehension */ })();
`;
  }
  generateComprehensionAsLoop(expr, iterators, guards) {
    let code = "";
    if (iterators.length === 1) {
      let [iterType, vars, iterable, stepOrOwn] = iterators[0];
      if (iterType === "for-in") {
        let step = stepOrOwn;
        let va = Array.isArray(vars) ? vars : [vars];
        let noVar = va.length === 0;
        let [itemVar, indexVar] = noVar ? ["_i", null] : va;
        let ivp = Array.isArray(itemVar) && (itemVar[0] === "array" || itemVar[0] === "object") ? this.generateDestructuringPattern(itemVar) : itemVar;
        if (step && step !== null) {
          let ih = Array.isArray(iterable) && iterable[0];
          if (ih instanceof String)
            ih = str(ih);
          let isRange = ih === ".." || ih === "...";
          if (isRange) {
            let isExcl = ih === "...";
            let [s, e] = iterable.slice(1);
            code += `for (let ${ivp} = ${this.generate(s, "value")}; ${ivp} ${isExcl ? "<" : "<="} ${this.generate(e, "value")}; ${ivp} += ${this.generate(step, "value")}) `;
          } else {
            let ic = this.generate(iterable, "value"), idxN = indexVar || "_i", stc = this.generate(step, "value");
            let isNeg = this.isNegativeStep(step);
            let isMinus1 = isNeg && (step[1] === "1" || step[1] === 1 || str(step[1]) === "1");
            let isPlus1 = !isNeg && (step === "1" || step === 1 || str(step) === "1");
            if (isMinus1)
              code += `for (let ${idxN} = ${ic}.length - 1; ${idxN} >= 0; ${idxN}--) `;
            else if (isPlus1)
              code += `for (let ${idxN} = 0; ${idxN} < ${ic}.length; ${idxN}++) `;
            else if (isNeg)
              code += `for (let ${idxN} = ${ic}.length - 1; ${idxN} >= 0; ${idxN} += ${stc}) `;
            else
              code += `for (let ${idxN} = 0; ${idxN} < ${ic}.length; ${idxN} += ${stc}) `;
            code += `{
`;
            this.indentLevel++;
            if (!noVar)
              code += this.indent() + `const ${ivp} = ${ic}[${idxN}];
`;
          }
          if (guards?.length) {
            if (!isRange)
              code += this.indent();
            code += `{
`;
            this.indentLevel++;
            code += this.indent() + `if (${guards.map((g) => this.generate(g, "value")).join(" && ")}) {
`;
            this.indentLevel++;
            code += this.indent() + this.generate(expr, "statement") + `;
`;
            this.indentLevel--;
            code += this.indent() + `}
`;
            this.indentLevel--;
            code += this.indent() + "}";
          } else {
            if (!isRange)
              code += this.indent();
            code += `{
`;
            this.indentLevel++;
            code += this.indent() + this.generate(expr, "statement") + `;
`;
            this.indentLevel--;
            code += this.indent() + "}";
          }
          if (!isRange) {
            this.indentLevel--;
            code += `
` + this.indent() + "}";
          }
          return code;
        }
        if (indexVar) {
          let ic = this.generate(iterable, "value");
          code += `for (let ${indexVar} = 0; ${indexVar} < ${ic}.length; ${indexVar}++) `;
          code += `{
`;
          this.indentLevel++;
          code += this.indent() + `const ${ivp} = ${ic}[${indexVar}];
`;
        } else {
          code += `for (const ${ivp} of ${this.generate(iterable, "value")}) `;
          if (guards?.length) {
            code += `{
`;
            this.indentLevel++;
            code += this.indent() + `if (${guards.map((g) => this.generate(g, "value")).join(" && ")}) {
`;
            this.indentLevel++;
            code += this.indent() + this.generate(expr, "statement") + `;
`;
            this.indentLevel--;
            code += this.indent() + `}
`;
            this.indentLevel--;
            code += this.indent() + "}";
          } else {
            code += `{
`;
            this.indentLevel++;
            code += this.indent() + this.generate(expr, "statement") + `;
`;
            this.indentLevel--;
            code += this.indent() + "}";
          }
          return code;
        }
        if (guards?.length) {
          code += this.indent() + `if (${guards.map((g) => this.generate(g, "value")).join(" && ")}) {
`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
          this.indentLevel--;
          code += this.indent() + `}
`;
        } else {
          code += this.indent() + this.generate(expr, "statement") + `;
`;
        }
        this.indentLevel--;
        code += this.indent() + "}";
        return code;
      }
      if (iterType === "for-as") {
        let va = Array.isArray(vars) ? vars : [vars];
        let [fv] = va;
        let ivp = Array.isArray(fv) && (fv[0] === "array" || fv[0] === "object") ? this.generateDestructuringPattern(fv) : fv;
        code += `for (const ${ivp} of ${this.generate(iterable, "value")}) `;
        if (guards?.length) {
          code += `{
`;
          this.indentLevel++;
          code += this.indent() + `if (${guards.map((g) => this.generate(g, "value")).join(" && ")}) {
`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
          this.indentLevel--;
          code += this.indent() + `}
`;
          this.indentLevel--;
          code += this.indent() + "}";
        } else {
          code += `{
`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
          this.indentLevel--;
          code += this.indent() + "}";
        }
        return code;
      }
      if (iterType === "for-of") {
        let va = Array.isArray(vars) ? vars : [vars];
        let [kv, vv] = va;
        let own = stepOrOwn;
        let oc = this.generate(iterable, "value");
        code += `for (const ${kv} in ${oc}) {
`;
        this.indentLevel++;
        if (own && !vv && !guards?.length) {
          code += this.indent() + `if (!Object.hasOwn(${oc}, ${kv})) continue;
`;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
        } else if (own && vv && guards?.length) {
          code += this.indent() + `if (Object.hasOwn(${oc}, ${kv})) {
`;
          this.indentLevel++;
          code += this.indent() + `const ${vv} = ${oc}[${kv}];
`;
          code += this.indent() + `if (${guards.map((g) => this.generate(g, "value")).join(" && ")}) {
`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
          this.indentLevel--;
          code += this.indent() + `}
`;
          this.indentLevel--;
          code += this.indent() + `}
`;
        } else if (own && vv) {
          code += this.indent() + `if (Object.hasOwn(${oc}, ${kv})) {
`;
          this.indentLevel++;
          code += this.indent() + `const ${vv} = ${oc}[${kv}];
`;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
          this.indentLevel--;
          code += this.indent() + `}
`;
        } else if (vv && guards?.length) {
          code += this.indent() + `const ${vv} = ${oc}[${kv}];
`;
          code += this.indent() + `if (${guards.map((g) => this.generate(g, "value")).join(" && ")}) {
`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
          this.indentLevel--;
          code += this.indent() + `}
`;
        } else if (vv) {
          code += this.indent() + `const ${vv} = ${oc}[${kv}];
`;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
        } else if (guards?.length) {
          code += this.indent() + `if (${guards.map((g) => this.generate(g, "value")).join(" && ")}) {
`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
          this.indentLevel--;
          code += this.indent() + `}
`;
        } else {
          code += this.indent() + this.generate(expr, "statement") + `;
`;
        }
        this.indentLevel--;
        code += this.indent() + "}";
        return code;
      }
    }
    return this.generate(["comprehension", expr, iterators, guards], "value");
  }
  generateIfElseWithEarlyReturns(ifStmt) {
    let [head, condition, thenBranch, ...elseBranches] = ifStmt;
    let code = "";
    let condCode = head === "unless" ? `!${this.generate(condition, "value")}` : this.generate(condition, "value");
    code += this.indent() + `if (${condCode}) {
`;
    code += this.withIndent(() => this.generateBranchWithReturn(thenBranch));
    code += this.indent() + "}";
    for (let branch of elseBranches) {
      code += " else ";
      if (Array.isArray(branch) && branch[0] === "if") {
        let [, nc, nt, ...ne] = branch;
        code += `if (${this.generate(nc, "value")}) {
`;
        code += this.withIndent(() => this.generateBranchWithReturn(nt));
        code += this.indent() + "}";
        for (let rb of ne) {
          code += ` else {
`;
          code += this.withIndent(() => this.generateBranchWithReturn(rb));
          code += this.indent() + "}";
        }
      } else {
        code += `{
`;
        code += this.withIndent(() => this.generateBranchWithReturn(branch));
        code += this.indent() + "}";
      }
    }
    return code;
  }
  generateBranchWithReturn(branch) {
    let stmts = this.unwrapBlock(branch);
    let code = "";
    for (let i = 0;i < stmts.length; i++) {
      let isLast = i === stmts.length - 1, s = stmts[i];
      let h = Array.isArray(s) ? s[0] : null;
      let hasCtrl = h === "return" || h === "throw" || h === "break" || h === "continue";
      if (isLast && !hasCtrl)
        code += this.indent() + `return ${this.generate(s, "value")};
`;
      else
        code += this.indent() + this.generate(s, "statement") + `;
`;
    }
    return code;
  }
  generateIfAsExpression(condition, thenBranch, elseBranches) {
    let needsIIFE = this.isMultiStatementBlock(thenBranch) || this.hasStatementInBranch(thenBranch) || elseBranches.some((b) => this.isMultiStatementBlock(b) || this.hasStatementInBranch(b) || this.hasNestedMultiStatement(b));
    if (needsIIFE) {
      let hasAwait = this.containsAwait(condition) || this.containsAwait(thenBranch) || elseBranches.some((b) => this.containsAwait(b));
      let code = `${hasAwait ? "await " : ""}(${hasAwait ? "async " : ""}() => { `;
      code += `if (${this.generate(condition, "value")}) `;
      code += this.generateBlockWithReturns(thenBranch);
      for (let branch of elseBranches) {
        code += " else ";
        if (Array.isArray(branch) && branch[0] === "if") {
          let [_, nc, nt, ...ne] = branch;
          code += `if (${this.generate(nc, "value")}) `;
          code += this.generateBlockWithReturns(nt);
          for (let nb of ne) {
            code += " else ";
            if (Array.isArray(nb) && nb[0] === "if") {
              let [__, nnc, nnt, ...nne] = nb;
              code += `if (${this.generate(nnc, "value")}) `;
              code += this.generateBlockWithReturns(nnt);
              elseBranches.push(...nne);
            } else {
              code += this.generateBlockWithReturns(nb);
            }
          }
        } else {
          code += this.generateBlockWithReturns(branch);
        }
      }
      return code + " })()";
    }
    let thenExpr = this.extractExpression(this.unwrapIfBranch(thenBranch));
    let elseExpr = this.buildTernaryChain(elseBranches);
    let condCode = this.generate(condition, "value");
    if (Array.isArray(condition) && (condition[0] === "yield" || condition[0] === "await"))
      condCode = `(${condCode})`;
    return `(${condCode} ? ${thenExpr} : ${elseExpr})`;
  }
  generateIfAsStatement(condition, thenBranch, elseBranches) {
    let code = `if (${this.unwrap(this.generate(condition, "value"))}) `;
    code += this.generate(this.unwrapIfBranch(thenBranch), "statement");
    for (let branch of elseBranches)
      code += ` else ` + this.generate(this.unwrapIfBranch(branch), "statement");
    return code;
  }
  generateSwitchCaseBody(body, context) {
    let code = "";
    let hasFlow = this.hasExplicitControlFlow(body);
    if (hasFlow) {
      for (let s of this.unwrapBlock(body))
        code += this.indent() + this.generate(s, "statement") + `;
`;
    } else if (context === "value") {
      if (Array.isArray(body) && body[0] === "block" && body.length > 2) {
        let stmts = body.slice(1);
        for (let i = 0;i < stmts.length; i++) {
          if (i === stmts.length - 1)
            code += this.indent() + `return ${this.generate(stmts[i], "value")};
`;
          else
            code += this.indent() + this.generate(stmts[i], "statement") + `;
`;
        }
      } else {
        code += this.indent() + `return ${this.extractExpression(body)};
`;
      }
    } else {
      if (Array.isArray(body) && body[0] === "block" && body.length > 1) {
        for (let s of body.slice(1))
          code += this.indent() + this.generate(s, "statement") + `;
`;
      } else {
        code += this.indent() + this.generate(body, "statement") + `;
`;
      }
      code += this.indent() + `break;
`;
    }
    return code;
  }
  generateSwitchAsIfChain(whens, defaultCase, context) {
    let code = "";
    for (let i = 0;i < whens.length; i++) {
      let [, test, body] = whens[i];
      let cond = Array.isArray(test) ? test[0] : test;
      code += (i === 0 ? "" : " else ") + `if (${this.generate(cond, "value")}) {
`;
      this.indentLevel++;
      if (context === "value")
        code += this.indent() + `return ${this.extractExpression(body)};
`;
      else
        for (let s of this.unwrapBlock(body))
          code += this.indent() + this.generate(s, "statement") + `;
`;
      this.indentLevel--;
      code += this.indent() + "}";
    }
    if (defaultCase) {
      code += ` else {
`;
      this.indentLevel++;
      if (context === "value")
        code += this.indent() + `return ${this.extractExpression(defaultCase)};
`;
      else
        for (let s of this.unwrapBlock(defaultCase))
          code += this.indent() + this.generate(s, "statement") + `;
`;
      this.indentLevel--;
      code += this.indent() + "}";
    }
    return context === "value" ? `(() => { ${code} })()` : code;
  }
  extractExpression(branch) {
    let stmts = this.unwrapBlock(branch);
    return stmts.length > 0 ? this.generate(stmts[stmts.length - 1], "value") : "undefined";
  }
  unwrapBlock(body) {
    if (!Array.isArray(body))
      return [body];
    if (body[0] === "block")
      return body.slice(1);
    if (Array.isArray(body[0]))
      return body;
    return [body];
  }
  indent() {
    return this.indentString.repeat(this.indentLevel);
  }
  needsSemicolon(stmt, generated) {
    if (!generated || generated.endsWith(";"))
      return false;
    if (!generated.endsWith("}"))
      return true;
    let h = Array.isArray(stmt) ? stmt[0] : null;
    return !["def", "class", "if", "unless", "for-in", "for-of", "for-as", "while", "until", "loop", "switch", "try"].includes(h);
  }
  addSemicolon(stmt, generated) {
    return generated + (this.needsSemicolon(stmt, generated) ? ";" : "");
  }
  formatStatements(stmts, context = "statement") {
    return stmts.map((s) => this.indent() + this.addSemicolon(s, this.generate(s, context)));
  }
  wrapForCondition(code) {
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(code))
      return code;
    if (code.startsWith("(") && code.endsWith(")"))
      return code;
    return `(${code})`;
  }
  hasExplicitControlFlow(body) {
    if (!Array.isArray(body))
      return false;
    let t = body[0];
    if (t === "return" || t === "throw" || t === "break" || t === "continue")
      return true;
    if (t === "block")
      return body.slice(1).some((s) => Array.isArray(s) && ["return", "throw", "break", "continue"].includes(s[0]));
    if (t === "switch") {
      let [, , whens] = body;
      return whens?.some((w) => {
        let stmts = this.unwrapBlock(w[2]);
        return stmts.some((s) => Array.isArray(s) && ["return", "throw", "break", "continue"].includes(s[0]));
      });
    }
    if (t === "if" || t === "unless") {
      let [, , thenB, elseB] = body;
      return this.branchHasControlFlow(thenB) && elseB && this.branchHasControlFlow(elseB);
    }
    return false;
  }
  branchHasControlFlow(branch) {
    if (!Array.isArray(branch))
      return false;
    let stmts = this.unwrapBlock(branch);
    if (stmts.length === 0)
      return false;
    let last = stmts[stmts.length - 1];
    return Array.isArray(last) && ["return", "throw", "break", "continue"].includes(last[0]);
  }
  withIndent(callback) {
    this.indentLevel++;
    let result = callback();
    this.indentLevel--;
    return result;
  }
  isNegativeStep(step) {
    if (!Array.isArray(step) || step.length !== 2)
      return false;
    return (str(step[0]) ?? step[0]) === "-";
  }
  isNegativeOneLiteral(sexpr) {
    return Array.isArray(sexpr) && sexpr[0] === "-" && sexpr.length === 2 && (sexpr[1] === "1" || sexpr[1] === 1 || str(sexpr[1]) === "1");
  }
  unwrap(code) {
    if (typeof code !== "string")
      return code;
    while (code.startsWith("(") && code.endsWith(")")) {
      let pd = 0, bd = 0, canUnwrap = true, hasComma = false;
      for (let i = 0;i < code.length; i++) {
        if (code[i] === "(")
          pd++;
        if (code[i] === ")")
          pd--;
        if (code[i] === "[" || code[i] === "{")
          bd++;
        if (code[i] === "]" || code[i] === "}")
          bd--;
        if (code[i] === "," && pd === 1 && bd === 0)
          hasComma = true;
        if (pd === 0 && i < code.length - 1) {
          canUnwrap = false;
          break;
        }
      }
      if (hasComma)
        canUnwrap = false;
      if (canUnwrap)
        code = code.slice(1, -1);
      else
        break;
    }
    return code;
  }
  unwrapLogical(code) {
    if (typeof code !== "string")
      return code;
    while (code.startsWith("(") && code.endsWith(")")) {
      let depth = 0, minDepth = Infinity;
      for (let i = 1;i < code.length - 1; i++) {
        if (code[i] === "(")
          depth++;
        if (code[i] === ")")
          depth--;
        minDepth = Math.min(minDepth, depth);
      }
      if (minDepth >= 0)
        code = code.slice(1, -1);
      else
        break;
    }
    return code;
  }
  unwrapIfBranch(branch) {
    if (Array.isArray(branch) && branch.length === 1 && (!Array.isArray(branch[0]) || branch[0][0] !== "block"))
      return branch[0];
    return branch;
  }
  flattenBinaryChain(sexpr) {
    if (!Array.isArray(sexpr) || sexpr.length < 3)
      return sexpr;
    let [head, ...rest] = sexpr;
    if (head !== "&&" && head !== "||")
      return sexpr;
    let ops = [];
    let collect = (expr) => {
      if (Array.isArray(expr) && expr[0] === head) {
        for (let i = 1;i < expr.length; i++)
          collect(expr[i]);
      } else
        ops.push(expr);
    };
    for (let op of rest)
      collect(op);
    return [head, ...ops];
  }
  hasStatementInBranch(branch) {
    if (!Array.isArray(branch))
      return false;
    let h = branch[0];
    if (h === "return" || h === "throw" || h === "break" || h === "continue")
      return true;
    if (h === "block")
      return branch.slice(1).some((s) => this.hasStatementInBranch(s));
    return false;
  }
  isMultiStatementBlock(branch) {
    return Array.isArray(branch) && branch[0] === "block" && branch.length > 2;
  }
  hasNestedMultiStatement(branch) {
    if (!Array.isArray(branch))
      return false;
    if (branch[0] === "if") {
      let [_, cond, then_, ...elseB] = branch;
      return this.isMultiStatementBlock(then_) || elseB.some((b) => this.hasNestedMultiStatement(b));
    }
    return false;
  }
  buildTernaryChain(branches) {
    if (branches.length === 0)
      return "undefined";
    if (branches.length === 1)
      return this.extractExpression(this.unwrapIfBranch(branches[0]));
    let first = branches[0];
    if (Array.isArray(first) && first[0] === "if") {
      let [_, cond, then_, ...rest] = first;
      let thenPart = this.extractExpression(this.unwrapIfBranch(then_));
      let elsePart = this.buildTernaryChain([...rest, ...branches.slice(1)]);
      return `(${this.generate(cond, "value")} ? ${thenPart} : ${elsePart})`;
    }
    return this.extractExpression(this.unwrapIfBranch(first));
  }
  collectVarsFromArray(arr, varSet) {
    arr.slice(1).forEach((item) => {
      if (item === "," || item === "...")
        return;
      if (typeof item === "string") {
        varSet.add(item);
        return;
      }
      if (Array.isArray(item)) {
        if (item[0] === "..." && typeof item[1] === "string")
          varSet.add(item[1]);
        else if (item[0] === "array")
          this.collectVarsFromArray(item, varSet);
        else if (item[0] === "object")
          this.collectVarsFromObject(item, varSet);
      }
    });
  }
  collectVarsFromObject(obj, varSet) {
    obj.slice(1).forEach((pair) => {
      if (!Array.isArray(pair))
        return;
      if (pair[0] === "..." && typeof pair[1] === "string") {
        varSet.add(pair[1]);
        return;
      }
      if (pair.length >= 2) {
        let [key, value, operator] = pair;
        if (operator === "=") {
          if (typeof key === "string")
            varSet.add(key);
        } else {
          if (typeof value === "string")
            varSet.add(value);
          else if (Array.isArray(value)) {
            if (value[0] === "array")
              this.collectVarsFromArray(value, varSet);
            else if (value[0] === "object")
              this.collectVarsFromObject(value, varSet);
          }
        }
      }
    });
  }
  extractStringContent(strObj) {
    let content = str(strObj).slice(1, -1);
    let indent = meta(strObj, "indent");
    if (indent)
      content = content.replace(new RegExp(`\\n${indent}`, "g"), `
`);
    if (meta(strObj, "initialChunk") && content.startsWith(`
`))
      content = content.slice(1);
    if (meta(strObj, "finalChunk") && content.endsWith(`
`))
      content = content.slice(0, -1);
    return content;
  }
  processHeregex(content) {
    let result = "", inCharClass = false, i = 0;
    let isEscaped = () => {
      let c = 0, j = i - 1;
      while (j >= 0 && content[j] === "\\") {
        c++;
        j--;
      }
      return c % 2 === 1;
    };
    while (i < content.length) {
      let ch = content[i];
      if (ch === "[" && !isEscaped()) {
        inCharClass = true;
        result += ch;
        i++;
        continue;
      }
      if (ch === "]" && inCharClass && !isEscaped()) {
        inCharClass = false;
        result += ch;
        i++;
        continue;
      }
      if (inCharClass) {
        result += ch;
        i++;
        continue;
      }
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if (ch === "#") {
        if (isEscaped()) {
          result += ch;
          i++;
          continue;
        }
        let j = i - 1;
        while (j >= 0 && content[j] === "\\")
          j--;
        if (j < i - 1) {
          result += ch;
          i++;
          continue;
        }
        while (i < content.length && content[i] !== `
`)
          i++;
        continue;
      }
      result += ch;
      i++;
    }
    return result;
  }
  addJsExtensionAndAssertions(source) {
    if (source instanceof String)
      source = str(source);
    if (typeof source !== "string")
      return source;
    let hasQuotes = source.startsWith('"') || source.startsWith("'");
    let path = hasQuotes ? source.slice(1, -1) : source;
    let isLocal = path.startsWith("./") || path.startsWith("../");
    let finalPath = path, assertion = "";
    if (isLocal) {
      let lastSlash = path.lastIndexOf("/");
      let fileName = lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
      let hasExt = fileName.includes(".");
      if (hasExt) {
        if (fileName.endsWith(".json"))
          assertion = " with { type: 'json' }";
      } else
        finalPath = path + ".js";
    }
    return `'${finalPath}'` + assertion;
  }
  containsAwait(sexpr) {
    if (!sexpr)
      return false;
    if (sexpr instanceof String && meta(sexpr, "await") === true)
      return true;
    if (typeof sexpr !== "object")
      return false;
    if (Array.isArray(sexpr) && sexpr[0] === "await")
      return true;
    if (Array.isArray(sexpr) && sexpr[0] === "for-as" && sexpr[3] === true)
      return true;
    if (Array.isArray(sexpr) && (sexpr[0] === "def" || sexpr[0] === "->" || sexpr[0] === "=>" || sexpr[0] === "class"))
      return false;
    if (Array.isArray(sexpr))
      return sexpr.some((item) => this.containsAwait(item));
    return false;
  }
  containsYield(sexpr) {
    if (!sexpr)
      return false;
    if (typeof sexpr !== "object")
      return false;
    if (Array.isArray(sexpr) && (sexpr[0] === "yield" || sexpr[0] === "yield-from"))
      return true;
    if (Array.isArray(sexpr) && (sexpr[0] === "def" || sexpr[0] === "->" || sexpr[0] === "=>" || sexpr[0] === "class"))
      return false;
    if (Array.isArray(sexpr))
      return sexpr.some((item) => this.containsYield(item));
    return false;
  }
  isStaticMember(mk) {
    return Array.isArray(mk) && mk[0] === "." && mk[1] === "this";
  }
  isComputedMember(mk) {
    return Array.isArray(mk) && mk[0] === "computed";
  }
  extractMemberName(mk) {
    if (this.isStaticMember(mk))
      return mk[2];
    if (this.isComputedMember(mk))
      return `[${this.generate(mk[1], "value")}]`;
    return mk;
  }
  isBoundMethod(mv) {
    return Array.isArray(mv) && mv[0] === "=>";
  }
  getReactiveRuntime() {
    return `// ============================================================================
// Rip Reactive Runtime
// A minimal, fine-grained reactivity system
//
// Reactivity:
//   __state(value)     - Reactive state container
//   __computed(fn)     - Computed value (lazy, cached)
//   __effect(fn)       - Side effect that re-runs when dependencies change
//   __batch(fn)        - Group multiple updates into one flush
//   __readonly(value)  - Immutable value wrapper
//
// Error Handling:
//   __catchErrors(fn)  - Wrap function to route errors to handler
//   __handleError(err) - Route error to handler
//
// How reactivity works:
//   - Reading a state/computed inside an effect tracks it as a dependency
//   - Writing to a state notifies all subscribers
//   - Batching defers effect execution until the batch completes
// ============================================================================

// Global state for dependency tracking
let __currentEffect = null;   // The effect/computed currently being evaluated
let __pendingEffects = new Set();  // Effects queued to run
let __batching = false;       // Are we inside a batch()?

// Flush all pending effects (called after state updates, or at end of batch)
function __flushEffects() {
  const effects = [...__pendingEffects];
  __pendingEffects.clear();
  for (const effect of effects) effect.run();
}

// Shared primitive coercion (used by state and computed)
const __primitiveCoercion = {
  valueOf() { return this.value; },
  toString() { return String(this.value); },
  [Symbol.toPrimitive](hint) { return hint === 'string' ? this.toString() : this.valueOf(); }
};

function __state(initialValue) {
  let value = initialValue;
  const subscribers = new Set();
  let notifying = false;
  let locked = false;
  let dead = false;

  const state = {
    get value() {
      if (dead) return value;
      if (__currentEffect) {
        subscribers.add(__currentEffect);
        __currentEffect.dependencies.add(subscribers);
      }
      return value;
    },

    set value(newValue) {
      if (dead || locked || newValue === value || notifying) return;
      value = newValue;
      notifying = true;
      for (const sub of subscribers) {
        if (sub.markDirty) sub.markDirty();
        else __pendingEffects.add(sub);
      }
      if (!__batching) __flushEffects();
      notifying = false;
    },

    read() { return value; },
    lock() { locked = true; return state; },
    free() { subscribers.clear(); return state; },
    kill() { dead = true; subscribers.clear(); return value; },

    ...__primitiveCoercion
  };
  return state;
}

function __computed(fn) {
  let value;
  let dirty = true;
  const subscribers = new Set();
  let locked = false;
  let dead = false;

  const computed = {
    dependencies: new Set(),

    markDirty() {
      if (dead || locked || dirty) return;
      dirty = true;
      for (const sub of subscribers) {
        if (sub.markDirty) sub.markDirty();
        else __pendingEffects.add(sub);
      }
    },

    get value() {
      if (dead) return value;
      if (__currentEffect) {
        subscribers.add(__currentEffect);
        __currentEffect.dependencies.add(subscribers);
      }
      if (dirty && !locked) {
        for (const dep of computed.dependencies) dep.delete(computed);
        computed.dependencies.clear();
        const prev = __currentEffect;
        __currentEffect = computed;
        try { value = fn(); } finally { __currentEffect = prev; }
        dirty = false;
      }
      return value;
    },

    read() { return value; },
    lock() { locked = true; computed.value; return computed; },
    free() {
      for (const dep of computed.dependencies) dep.delete(computed);
      computed.dependencies.clear();
      subscribers.clear();
      return computed;
    },
    kill() {
      dead = true;
      const result = value;
      computed.free();
      return result;
    },

    ...__primitiveCoercion
  };
  return computed;
}

function __effect(fn) {
  const effect = {
    dependencies: new Set(),

    run() {
      for (const dep of effect.dependencies) dep.delete(effect);
      effect.dependencies.clear();
      const prev = __currentEffect;
      __currentEffect = effect;
      try { fn(); } finally { __currentEffect = prev; }
    },

    dispose() {
      for (const dep of effect.dependencies) dep.delete(effect);
      effect.dependencies.clear();
    }
  };

  effect.run();
  return () => effect.dispose();
}

function __batch(fn) {
  if (__batching) return fn();
  __batching = true;
  try {
    return fn();
  } finally {
    __batching = false;
    __flushEffects();
  }
}

function __readonly(value) {
  return Object.freeze({ value });
}

// ============================================================================
// Error Handling
// ============================================================================

let __errorHandler = null;

function __setErrorHandler(handler) {
  const prev = __errorHandler;
  __errorHandler = handler;
  return prev;
}

function __handleError(error) {
  if (__errorHandler) {
    try {
      __errorHandler(error);
    } catch (handlerError) {
      console.error('Error in error handler:', handlerError);
      console.error('Original error:', error);
    }
  } else {
    throw error;
  }
}

function __catchErrors(fn) {
  return function(...args) {
    try {
      return fn.apply(this, args);
    } catch (error) {
      __handleError(error);
    }
  };
}

// === End Reactive Runtime ===
`;
  }
}

class Compiler {
  constructor(options = {}) {
    this.options = { showTokens: false, showSExpr: false, ...options };
  }
  compile(source) {
    let dataSection = null;
    let lines = source.split(`
`);
    let dataLineIndex = lines.findIndex((line) => line === "__DATA__");
    if (dataLineIndex !== -1) {
      let dataLines = lines.slice(dataLineIndex + 1);
      dataSection = dataLines.length > 0 ? dataLines.join(`
`) + `
` : "";
      source = lines.slice(0, dataLineIndex).join(`
`);
    }
    let lexer = new Lexer;
    let tokens = lexer.tokenize(source);
    if (this.options.showTokens) {
      tokens.forEach((t) => console.log(`${t[0].padEnd(12)} ${JSON.stringify(t[1])}`));
      console.log();
    }
    parser.lexer = {
      tokens,
      pos: 0,
      setInput: function() {},
      lex: function() {
        if (this.pos >= this.tokens.length)
          return 1;
        let token = this.tokens[this.pos++];
        let val = token[1];
        if (token.data) {
          val = new String(val);
          Object.assign(val, token.data);
        }
        this.yytext = val;
        this.yylloc = token.loc;
        return token[0];
      }
    };
    let sexpr;
    try {
      sexpr = parser.parse(source);
    } catch (parseError) {
      if (/\?\s*\([^)]*\?[^)]*:[^)]*\)\s*:/.test(source) || /\?\s+\w+\s+\?\s+/.test(source)) {
        throw new Error("Nested ternary operators are not supported. Use if/else statements instead.");
      }
      throw parseError;
    }
    if (this.options.showSExpr) {
      console.log(formatSExpr(sexpr, 0, true));
      console.log();
    }
    let generator = new CodeGenerator({
      dataSection,
      skipReactiveRuntime: this.options.skipReactiveRuntime,
      reactiveVars: this.options.reactiveVars
    });
    let code = generator.compile(sexpr);
    return { tokens, sexpr, code, data: dataSection, reactiveVars: generator.reactiveVars };
  }
  compileToJS(source) {
    return this.compile(source).code;
  }
  compileToSExpr(source) {
    return this.compile(source).sexpr;
  }
}
function compile(source, options = {}) {
  return new Compiler(options).compile(source);
}
function compileToJS(source, options = {}) {
  return new Compiler(options).compileToJS(source);
}
// src/browser.js
var VERSION = "3.0.0";
var BUILD_DATE = "2026-02-07@13:13:24GMT";
var dedent = (s) => {
  const m = s.match(/^[ \t]*(?=\S)/gm);
  const i = Math.min(...(m || []).map((x) => x.length));
  return s.replace(RegExp(`^[ 	]{${i}}`, "gm"), "").trim();
};
async function processRipScripts() {
  const scripts = document.querySelectorAll('script[type="text/rip"]');
  for (const script of scripts) {
    if (script.hasAttribute("data-rip-processed"))
      continue;
    try {
      const ripCode = dedent(script.textContent);
      const jsCode = compileToJS(ripCode);
      (0, eval)(jsCode);
      script.setAttribute("data-rip-processed", "true");
    } catch (error) {
      console.error("Error compiling Rip script:", error);
      console.error("Script content:", script.textContent);
    }
  }
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", processRipScripts);
  } else {
    processRipScripts();
  }
}
function rip(code) {
  try {
    const js = compileToJS(code);
    let persistentJs = js.replace(/^let\s+[^;]+;\s*\n\s*/m, "");
    persistentJs = persistentJs.replace(/^const\s+/gm, "var ");
    const result = (1, eval)(persistentJs);
    if (result !== undefined)
      globalThis._ = result;
    return result;
  } catch (error) {
    console.error("Rip compilation error:", error.message);
    return;
  }
}
if (typeof globalThis !== "undefined") {
  globalThis.rip = rip;
}
export {
  rip,
  processRipScripts,
  parser,
  formatSExpr,
  compileToJS,
  compile,
  VERSION,
  Lexer,
  Compiler,
  CodeGenerator,
  BUILD_DATE
};
