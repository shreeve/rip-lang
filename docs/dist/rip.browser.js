// src/tags.js
var HTML_TAGS = new Set([
  "html",
  "head",
  "title",
  "base",
  "link",
  "meta",
  "style",
  "body",
  "address",
  "article",
  "aside",
  "footer",
  "header",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "main",
  "nav",
  "section",
  "blockquote",
  "dd",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "ul",
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "br",
  "cite",
  "code",
  "data",
  "dfn",
  "em",
  "i",
  "kbd",
  "mark",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
  "area",
  "audio",
  "img",
  "map",
  "track",
  "video",
  "embed",
  "iframe",
  "object",
  "param",
  "picture",
  "portal",
  "source",
  "svg",
  "math",
  "canvas",
  "noscript",
  "script",
  "del",
  "ins",
  "caption",
  "col",
  "colgroup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "button",
  "datalist",
  "fieldset",
  "form",
  "input",
  "label",
  "legend",
  "meter",
  "optgroup",
  "option",
  "output",
  "progress",
  "select",
  "textarea",
  "details",
  "dialog",
  "menu",
  "summary",
  "slot",
  "template"
]);
var SVG_TAGS = new Set([
  "svg",
  "g",
  "defs",
  "symbol",
  "use",
  "marker",
  "clipPath",
  "mask",
  "pattern",
  "circle",
  "ellipse",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect",
  "text",
  "textPath",
  "tspan",
  "linearGradient",
  "radialGradient",
  "stop",
  "filter",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feDropShadow",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence",
  "animate",
  "animateMotion",
  "animateTransform",
  "set",
  "mpath",
  "desc",
  "foreignObject",
  "image",
  "metadata",
  "switch",
  "title",
  "view"
]);
var TEMPLATE_TAGS = new Set([...HTML_TAGS, ...SVG_TAGS]);

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
  "def",
  "component",
  "render"
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
var CONTROL_IN_IMPLICIT = new Set(["IF", "TRY", "FINALLY", "CATCH", "CLASS", "SWITCH", "COMPONENT"]);
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
    this.inRenderBlock = false;
    this.renderIndent = 0;
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
      if (this.inRenderBlock && prev && prev[0] === "." && !colon) {
        let rest = this.chunk.slice(idLen);
        while (rest[0] === "-" && /^-[a-zA-Z]/.test(rest)) {
          let m = /^-([a-zA-Z][\w]*)/.exec(rest);
          if (!m)
            break;
          id += "-" + m[1];
          idLen += 1 + m[1].length;
          rest = this.chunk.slice(idLen);
        }
      }
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
    if (tag === "RENDER") {
      this.inRenderBlock = true;
      this.renderIndent = this.indent;
    }
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
      if (size < this.indent && /^\s*,/.test(this.chunk) && !UNFINISHED.has(this.prevTag())) {
        this.outdentTo(size, indent.length);
        if (this.prevTag() === "TERMINATOR")
          this.tokens.pop();
        return indent.length;
      }
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
    if (this.inRenderBlock && targetSize <= this.renderIndent) {
      this.inRenderBlock = false;
    }
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
    if (this.inRenderBlock && LINE_CONTINUER_RE.test(this.chunk) && /^\s*\./.test(this.chunk)) {
      return false;
    }
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
    else if (val === "<=>")
      tag = "BIND";
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
    else if (val === "?" && (this.chunk[1] === "[" || this.chunk[1] === "("))
      tag = "?.";
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
    this.rewriteRender();
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
      return token[1] !== ";" && SINGLE_CLOSERS.has(token[0]) && !(token[0] === "TERMINATOR" && EXPRESSION_CLOSE.has(this.tokens[i + 1]?.[0])) && !(token[0] === "ELSE" && starter !== "THEN") || token[0] === "INDENT" && !token.generated && (starter === "->" || starter === "=>") || token[0] === "," && (starter === "->" || starter === "=>") && !this.commaInImplicitCall(i) || CALL_CLOSERS.has(token[0]) && (this.tokens[i - 1]?.newLine || this.tokens[i - 1]?.[0] === "OUTDENT");
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
  rewriteRender() {
    let inRender = false;
    let renderIndentLevel = 0;
    let currentIndent = 0;
    let pendingCallEnds = [];
    let isHtmlTag = (name) => {
      let tagPart = name.split("#")[0];
      return TEMPLATE_TAGS.has(tagPart);
    };
    let isComponent = (name) => {
      if (!name || typeof name !== "string")
        return false;
      return /^[A-Z]/.test(name);
    };
    let isTemplateTag = (name) => {
      return isHtmlTag(name) || isComponent(name);
    };
    let startsWithHtmlTag = (tokens, i) => {
      let j = i;
      while (j > 0) {
        let pt = tokens[j - 1][0];
        if (pt === "INDENT" || pt === "OUTDENT" || pt === "TERMINATOR" || pt === "RENDER" || pt === "CALL_END" || pt === ")") {
          break;
        }
        j--;
      }
      return tokens[j] && tokens[j][0] === "IDENTIFIER" && isHtmlTag(tokens[j][1]);
    };
    this.scanTokens(function(token, i, tokens) {
      let tag = token[0];
      let nextToken = i < tokens.length - 1 ? tokens[i + 1] : null;
      if (tag === "RENDER") {
        inRender = true;
        renderIndentLevel = currentIndent + 1;
        return 1;
      }
      if (tag === "INDENT") {
        currentIndent++;
        return 1;
      }
      if (tag === "OUTDENT") {
        currentIndent--;
        let inserted = 0;
        while (pendingCallEnds.length > 0 && pendingCallEnds[pendingCallEnds.length - 1] > currentIndent) {
          let callEndToken = gen("CALL_END", ")", token);
          tokens.splice(i + 1 + inserted, 0, callEndToken);
          pendingCallEnds.pop();
          inserted++;
        }
        if (inRender && currentIndent < renderIndentLevel) {
          inRender = false;
        }
        return 1 + inserted;
      }
      if (!inRender)
        return 1;
      if (tag === "IDENTIFIER" && !token.spaced) {
        let parts = [token[1]];
        let j = i + 1;
        while (j + 1 < tokens.length) {
          let hyphen = tokens[j];
          let nextPart = tokens[j + 1];
          if (hyphen[0] === "-" && !hyphen.spaced && (nextPart[0] === "IDENTIFIER" || nextPart[0] === "PROPERTY")) {
            parts.push(nextPart[1]);
            j += 2;
            if (nextPart[0] === "PROPERTY")
              break;
          } else {
            break;
          }
        }
        if (parts.length > 1 && j > i + 1 && tokens[j - 1][0] === "PROPERTY") {
          token[0] = "STRING";
          token[1] = `"${parts.join("-")}"`;
          tokens.splice(i + 1, j - i - 1);
          return 1;
        }
      }
      if (tag === ".") {
        let prevToken = i > 0 ? tokens[i - 1] : null;
        let prevTag = prevToken ? prevToken[0] : null;
        if (prevTag === "INDENT" || prevTag === "TERMINATOR") {
          if (nextToken && nextToken[0] === "PROPERTY") {
            let divToken = gen("IDENTIFIER", "div", token);
            tokens.splice(i, 0, divToken);
            return 2;
          }
        }
      }
      if (tag === "IDENTIFIER" || tag === "PROPERTY") {
        let next = tokens[i + 1];
        let nextNext = tokens[i + 2];
        if (next && next[0] === "#" && nextNext && nextNext[0] === "PROPERTY") {
          token[1] = token[1] + "#" + nextNext[1];
          if (nextNext.spaced)
            token.spaced = true;
          tokens.splice(i + 1, 2);
          return 1;
        }
      }
      if (tag === "BIND") {
        let prevToken = i > 0 ? tokens[i - 1] : null;
        let nextBindToken = tokens[i + 1];
        if (prevToken && (prevToken[0] === "IDENTIFIER" || prevToken[0] === "PROPERTY") && nextBindToken && nextBindToken[0] === "IDENTIFIER") {
          prevToken[1] = `__bind_${prevToken[1]}__`;
          token[0] = ":";
          token[1] = ":";
          return 1;
        }
      }
      if (tag === "@") {
        let j = i + 1;
        if (j < tokens.length && tokens[j][0] === "PROPERTY") {
          j++;
          while (j + 1 < tokens.length && tokens[j][0] === "." && tokens[j + 1][0] === "PROPERTY") {
            j += 2;
          }
          if (j > i + 2 && j < tokens.length && tokens[j][0] === ":") {
            let openBracket = gen("[", "[", token);
            tokens.splice(i, 0, openBracket);
            let closeBracket = gen("]", "]", tokens[j + 1]);
            tokens.splice(j + 1, 0, closeBracket);
            return 2;
          }
        }
      }
      if (tag === "." && nextToken && nextToken[0] === "(") {
        let prevToken = i > 0 ? tokens[i - 1] : null;
        let prevTag = prevToken ? prevToken[0] : null;
        let atLineStart = prevTag === "INDENT" || prevTag === "TERMINATOR";
        let cxToken = gen("PROPERTY", "__cx__", token);
        nextToken[0] = "CALL_START";
        let depth = 1;
        for (let j = i + 2;j < tokens.length && depth > 0; j++) {
          if (tokens[j][0] === "(" || tokens[j][0] === "CALL_START")
            depth++;
          else if (tokens[j][0] === ")") {
            depth--;
            if (depth === 0)
              tokens[j][0] = "CALL_END";
          } else if (tokens[j][0] === "CALL_END")
            depth--;
        }
        if (atLineStart) {
          let divToken = gen("IDENTIFIER", "div", token);
          tokens.splice(i, 0, divToken);
          tokens.splice(i + 2, 0, cxToken);
          return 3;
        } else {
          tokens.splice(i + 1, 0, cxToken);
          return 2;
        }
      }
      if (nextToken && nextToken[0] === "INDENT") {
        if (tag === "->" || tag === "=>" || tag === "CALL_START" || tag === "(") {
          return 1;
        }
        let isTemplateElement = false;
        if (tag === "IDENTIFIER" && isTemplateTag(token[1])) {
          isTemplateElement = true;
        } else if (tag === "PROPERTY" || tag === "STRING" || tag === "CALL_END" || tag === ")") {
          isTemplateElement = startsWithHtmlTag(tokens, i);
        } else if (tag === "IDENTIFIER" && i > 1 && tokens[i - 1][0] === "...") {
          if (startsWithHtmlTag(tokens, i)) {
            let commaToken = gen(",", ",", token);
            let arrowToken = gen("->", "->", token);
            arrowToken.newLine = true;
            tokens.splice(i + 1, 0, commaToken, arrowToken);
            return 3;
          }
        }
        if (isTemplateElement) {
          let callStartToken = gen("CALL_START", "(", token);
          let arrowToken = gen("->", "->", token);
          arrowToken.newLine = true;
          tokens.splice(i + 1, 0, callStartToken, arrowToken);
          pendingCallEnds.push(currentIndent + 1);
          return 3;
        }
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
  commaInImplicitCall(i) {
    let levels = 0;
    for (let j = i - 1;j >= 0; j--) {
      let tag = this.tokens[j][0];
      if (EXPRESSION_END.has(tag)) {
        levels++;
        continue;
      }
      if (EXPRESSION_START.has(tag)) {
        if (tag === "INDENT")
          return false;
        levels--;
        if (levels < 0)
          return false;
        continue;
      }
      if (levels > 0)
        continue;
      if (IMPLICIT_FUNC.has(tag) && this.tokens[j].spaced) {
        let nt = this.tokens[j + 1]?.[0];
        return IMPLICIT_CALL.has(nt) || nt === "..." && IMPLICIT_CALL.has(this.tokens[j + 2]?.[0]);
      }
    }
    return false;
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
  symbolIds: { $accept: 0, $end: 1, error: 2, Root: 3, Body: 4, Line: 5, TERMINATOR: 6, Expression: 7, ExpressionLine: 8, Statement: 9, Return: 10, STATEMENT: 11, Import: 12, Export: 13, Value: 14, Code: 15, Operation: 16, Assign: 17, ReactiveAssign: 18, ComputedAssign: 19, ReadonlyAssign: 20, ReactAssign: 21, If: 22, Try: 23, While: 24, For: 25, Switch: 26, Class: 27, Component: 28, Render: 29, Throw: 30, Yield: 31, Def: 32, CodeLine: 33, OperationLine: 34, Assignable: 35, Literal: 36, Parenthetical: 37, Range: 38, Invocation: 39, DoIife: 40, This: 41, Super: 42, MetaProperty: 43, AlphaNumeric: 44, JS: 45, Regex: 46, UNDEFINED: 47, NULL: 48, BOOL: 49, INFINITY: 50, NAN: 51, NUMBER: 52, String: 53, Identifier: 54, IDENTIFIER: 55, Property: 56, PROPERTY: 57, STRING: 58, STRING_START: 59, Interpolations: 60, STRING_END: 61, InterpolationChunk: 62, INTERPOLATION_START: 63, INTERPOLATION_END: 64, INDENT: 65, OUTDENT: 66, REGEX: 67, REGEX_START: 68, REGEX_END: 69, RegexWithIndex: 70, ",": 71, "=": 72, REACTIVE_ASSIGN: 73, COMPUTED_ASSIGN: 74, READONLY_ASSIGN: 75, REACT_ASSIGN: 76, SimpleAssignable: 77, Array: 78, Object: 79, ThisProperty: 80, ".": 81, "?.": 82, INDEX_START: 83, INDEX_END: 84, Slice: 85, ES6_OPTIONAL_INDEX: 86, "{": 87, ObjAssignable: 88, ":": 89, FOR: 90, ForVariables: 91, FOROF: 92, OptComma: 93, "}": 94, WHEN: 95, OWN: 96, AssignList: 97, AssignObj: 98, ObjRestValue: 99, SimpleObjAssignable: 100, "[": 101, "]": 102, "@": 103, "...": 104, ObjSpreadExpr: 105, SUPER: 106, Arguments: 107, DYNAMIC_IMPORT: 108, Elisions: 109, ArgElisionList: 110, OptElisions: 111, ArgElision: 112, Arg: 113, Elision: 114, RangeDots: 115, "..": 116, DEF: 117, CALL_START: 118, ParamList: 119, CALL_END: 120, Block: 121, PARAM_START: 122, PARAM_END: 123, FuncGlyph: 124, "->": 125, "=>": 126, Param: 127, ParamVar: 128, Splat: 129, ES6_OPTIONAL_CALL: 130, ArgList: 131, SimpleArgs: 132, THIS: 133, NEW_TARGET: 134, IMPORT_META: 135, "(": 136, ")": 137, RETURN: 138, THROW: 139, YIELD: 140, FROM: 141, IfBlock: 142, IF: 143, ELSE: 144, UnlessBlock: 145, UNLESS: 146, POST_IF: 147, POST_UNLESS: 148, TRY: 149, Catch: 150, FINALLY: 151, CATCH: 152, SWITCH: 153, Whens: 154, When: 155, LEADING_WHEN: 156, WhileSource: 157, WHILE: 158, UNTIL: 159, Loop: 160, LOOP: 161, FORIN: 162, BY: 163, FORAS: 164, AWAIT: 165, FORASAWAIT: 166, ForValue: 167, CLASS: 168, EXTENDS: 169, COMPONENT: 170, ComponentBody: 171, ComponentLine: 172, RENDER: 173, IMPORT: 174, ImportDefaultSpecifier: 175, ImportNamespaceSpecifier: 176, ImportSpecifierList: 177, ImportSpecifier: 178, AS: 179, DEFAULT: 180, IMPORT_ALL: 181, EXPORT: 182, ExportSpecifierList: 183, EXPORT_ALL: 184, ExportSpecifier: 185, UNARY: 186, DO: 187, DO_IIFE: 188, UNARY_MATH: 189, "-": 190, "+": 191, "?": 192, "--": 193, "++": 194, MATH: 195, "**": 196, SHIFT: 197, COMPARE: 198, "&": 199, "^": 200, "|": 201, "||": 202, "??": 203, "&&": 204, "!?": 205, RELATION: 206, "SPACE?": 207, COMPOUND_ASSIGN: 208 },
  tokenNames: { 2: "error", 6: "TERMINATOR", 11: "STATEMENT", 45: "JS", 47: "UNDEFINED", 48: "NULL", 49: "BOOL", 50: "INFINITY", 51: "NAN", 52: "NUMBER", 55: "IDENTIFIER", 57: "PROPERTY", 58: "STRING", 59: "STRING_START", 61: "STRING_END", 63: "INTERPOLATION_START", 64: "INTERPOLATION_END", 65: "INDENT", 66: "OUTDENT", 67: "REGEX", 68: "REGEX_START", 69: "REGEX_END", 71: ",", 72: "=", 73: "REACTIVE_ASSIGN", 74: "COMPUTED_ASSIGN", 75: "READONLY_ASSIGN", 76: "REACT_ASSIGN", 81: ".", 82: "?.", 83: "INDEX_START", 84: "INDEX_END", 86: "ES6_OPTIONAL_INDEX", 87: "{", 89: ":", 90: "FOR", 92: "FOROF", 94: "}", 95: "WHEN", 96: "OWN", 101: "[", 102: "]", 103: "@", 104: "...", 106: "SUPER", 108: "DYNAMIC_IMPORT", 116: "..", 117: "DEF", 118: "CALL_START", 120: "CALL_END", 122: "PARAM_START", 123: "PARAM_END", 125: "->", 126: "=>", 130: "ES6_OPTIONAL_CALL", 133: "THIS", 134: "NEW_TARGET", 135: "IMPORT_META", 136: "(", 137: ")", 138: "RETURN", 139: "THROW", 140: "YIELD", 141: "FROM", 143: "IF", 144: "ELSE", 146: "UNLESS", 147: "POST_IF", 148: "POST_UNLESS", 149: "TRY", 151: "FINALLY", 152: "CATCH", 153: "SWITCH", 156: "LEADING_WHEN", 158: "WHILE", 159: "UNTIL", 161: "LOOP", 162: "FORIN", 163: "BY", 164: "FORAS", 165: "AWAIT", 166: "FORASAWAIT", 168: "CLASS", 169: "EXTENDS", 170: "COMPONENT", 173: "RENDER", 174: "IMPORT", 179: "AS", 180: "DEFAULT", 181: "IMPORT_ALL", 182: "EXPORT", 184: "EXPORT_ALL", 186: "UNARY", 187: "DO", 188: "DO_IIFE", 189: "UNARY_MATH", 190: "-", 191: "+", 192: "?", 193: "--", 194: "++", 195: "MATH", 196: "**", 197: "SHIFT", 198: "COMPARE", 199: "&", 200: "^", 201: "|", 202: "||", 203: "??", 204: "&&", 205: "!?", 206: "RELATION", 207: "SPACE?", 208: "COMPOUND_ASSIGN" },
  parseTable: (() => {
    let d = [105, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -1, 1, 2, 3, 4, 5, 6, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 41, 42, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 1, 1, 0, 2, 1, 5, -2, 105, 5, 1, 5, 58, 2, 71, -3, -3, -3, -3, -3, 30, 1, 5, 58, 1, 1, 5, 19, 12, 18, 17, 10, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -6, -6, -6, -6, -6, -6, 124, -6, -6, -6, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 9, 1, 5, 58, 1, 1, 5, 31, 18, 17, -7, -7, -7, -7, -7, -7, -7, -7, -7, 14, 1, 5, 58, 1, 1, 5, 31, 18, 17, 10, 1, 9, 1, 1, -8, -8, -8, -8, -8, -8, -8, -8, -8, 125, 126, 127, 94, 95, 52, 1, 5, 47, 5, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 3, 9, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -13, -13, 129, 103, 104, -13, -13, -13, -13, 132, 133, 134, -13, 135, -13, -13, -13, -13, -13, -13, -13, 130, -13, 136, -13, -13, 131, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, 128, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, 44, 1, 5, 58, 1, 1, 5, 10, 1, 1, 1, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -14, -14, -14, -14, -14, -14, 137, 138, 139, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, 9, 1, 5, 58, 1, 1, 5, 31, 18, 17, -32, -32, -32, -32, -32, -32, -32, -32, -32, 9, 1, 5, 58, 1, 1, 5, 31, 18, 17, -33, -33, -33, -33, -33, -33, -33, -33, -33, 13, 1, 5, 58, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, 13, 1, 5, 58, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, 13, 1, 5, 58, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, 13, 1, 5, 58, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, 55, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -34, -34, -34, -34, -34, -34, -34, -34, 140, 141, 142, 143, 144, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, 18, 6, 48, 1, 10, 1, 5, 7, 1, 1, 7, 14, 2, 1, 15, 1, 3, 4, 1, -172, 149, 102, -172, -172, -172, 151, 152, 150, 97, 154, 153, 148, 145, -172, -172, 146, 147, 104, 5, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 4, 1, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 156, 4, 5, 6, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 157, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 155, 41, 42, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 101, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 158, 159, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 41, 42, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 101, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 161, 162, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 41, 42, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 163, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 169, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 170, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 99, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 171, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 172, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 45, 14, 1, 20, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 7, 14, 2, 3, 2, 14, 2, 1, 1, 7, 1, 1, 1, 52, 174, 175, 176, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 173, 70, 71, 91, 97, 81, 85, 82, 83, 164, 165, 88, 89, 84, 86, 87, 80, 168, 45, 14, 1, 20, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 7, 14, 2, 3, 2, 14, 2, 1, 1, 7, 1, 1, 1, 52, 174, 175, 176, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 177, 70, 71, 91, 97, 81, 85, 82, 83, 164, 165, 88, 89, 84, 86, 87, 80, 168, 58, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, 178, 179, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, 180, 100, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 182, 181, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 183, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, 184, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, 2, 65, 56, 157, 185, 2, 65, 56, 157, 186, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, 14, 38, 16, 1, 23, 1, 1, 7, 4, 5, 5, 2, 25, 37, 2, 190, 149, 102, 151, 152, 150, 97, 187, 188, 81, 153, 192, 189, 191, 99, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 193, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 194, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 88, 1, 5, 8, 1, 20, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 1, 1, 1, 1, 3, 6, 1, 1, 1, 4, 3, 2, 1, 2, 2, 1, 6, 1, 1, 1, 2, 2, 8, 4, 1, 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 10, 1, 10, 1, 3, 1, 1, 2, 3, 19, 2, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -301, -301, 174, 175, 176, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, -301, 157, -301, 100, 101, -301, 197, 70, 71, 91, -301, 97, -301, -301, -301, -301, -301, 81, -301, 85, -301, 82, 83, -301, -301, 195, 164, -301, 165, 88, 89, 84, 86, 87, 80, -301, -301, -301, -301, -301, -301, -301, -301, -301, 196, 168, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, 1, 65, 198, 2, 65, 56, 157, 199, 99, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 200, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 201, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 135, 1, 5, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 1, 1, 1, 1, 3, 5, 1, 1, 1, 1, 4, 3, 2, 1, 2, 2, 1, 6, 1, 1, 1, 2, 2, 8, 1, 3, 2, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -223, -223, 202, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, -223, 203, -223, 100, 101, -223, 52, 51, 70, 71, 91, -223, 97, -223, -223, -223, -223, -223, 81, -223, 85, -223, 82, 83, -223, 65, -223, 164, -223, 165, 88, 89, 84, 86, 87, 80, -223, 67, 63, 64, 204, 53, 92, 54, 93, -223, -223, 55, 59, 56, -223, -223, 57, 96, -223, -223, -223, 48, -223, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, 2, 54, 1, 205, 102, 6, 15, 18, 89, 2, 1, 1, 207, 206, 41, 42, 88, 89, 134, 1, 5, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 1, 1, 1, 1, 3, 5, 1, 1, 1, 1, 4, 3, 2, 1, 2, 2, 1, 6, 1, 1, 1, 2, 2, 8, 1, 3, 2, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -220, -220, 208, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, -220, 209, -220, 100, 101, -220, 52, 51, 70, 71, 91, -220, 97, -220, -220, -220, -220, -220, 81, -220, 85, -220, 82, 83, -220, 65, -220, 164, -220, 165, 88, 89, 84, 86, 87, 80, -220, 67, 63, 64, 53, 92, 54, 93, -220, -220, 55, 59, 56, -220, -220, 57, 96, -220, -220, -220, 48, -220, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, 9, 53, 1, 1, 3, 1, 28, 88, 1, 5, 210, 214, 102, 103, 104, 213, 211, 212, 215, 11, 27, 1, 4, 22, 1, 32, 30, 51, 2, 10, 4, 217, 218, 219, 220, 102, 216, 65, 60, 61, 221, 222, 55, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, 55, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, 104, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 223, 3, 4, 5, 6, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 224, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 41, 42, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 111, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 1, 1, 1, 2, 2, 1, 1, 2, 1, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 225, 234, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 231, 100, 101, 232, 52, 51, 70, 71, 91, 97, 58, 81, 226, 85, 236, 82, 83, 227, 228, 230, 233, 229, 65, 41, 42, 88, 89, 235, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 4, 81, 2, 24, 11, 238, 239, 237, 136, 2, 107, 11, 240, 136, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, 52, 1, 5, 50, 1, 1, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -205, -205, 241, 242, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, 1, 81, 243, 1, 81, 244, 53, 11, 34, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 2, 1, 8, 11, 3, 11, 2, 3, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, 53, 11, 34, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 2, 1, 8, 11, 3, 11, 2, 3, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, 59, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, 59, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 245, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 246, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 247, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 248, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 4, 1, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 250, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 157, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 249, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 23, 6, 38, 8, 1, 1, 1, 1, 1, 1, 1, 6, 1, 5, 9, 8, 6, 3, 1, 1, 1, 1, 2, 1, -108, 256, 98, 99, 258, 102, 259, 242, 103, 104, -108, -108, -108, 260, 251, -108, 252, 257, 261, 253, 254, 255, 262, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, 45, 14, 1, 20, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 7, 14, 2, 3, 2, 14, 2, 1, 1, 7, 1, 1, 1, 52, 174, 175, 176, 33, 34, 35, 263, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 264, 70, 71, 91, 97, 81, 85, 82, 83, 164, 165, 88, 89, 84, 86, 87, 80, 168, 61, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 4, 6, 1, 10, 1, 3, 1, 1, 2, 3, 10, 11, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, 53, 1, 5, 52, 1, 2, 2, 1, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, 6, 53, 5, 1, 1, 2, 1, 268, 103, 104, 265, 266, 267, 107, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 2, 1, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -5, 269, -5, 4, 5, 6, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, -5, -5, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 41, 42, 88, 89, 84, 86, 87, 80, -5, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 270, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 271, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 272, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 273, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 274, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 275, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 276, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 277, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 278, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 281, 160, 279, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 280, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 284, 160, 282, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 283, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 287, 160, 285, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 286, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 288, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 289, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 290, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 291, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 292, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, 14, 38, 16, 1, 23, 1, 1, 7, 4, 5, 5, 2, 25, 37, 2, 296, 149, 102, 151, 152, 150, 97, 293, 294, 81, 153, 192, 295, 191, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 297, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 298, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, -366, 51, 1, 5, 52, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, 51, 1, 5, 52, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, 2, 107, 11, 299, 136, 2, 56, 1, 300, 242, 2, 56, 1, 301, 242, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 2, 6, 1, 1, 1, 1, 5, 2, 3, 11, 2, 1, 2, 2, 7, 1, 1, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 302, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 307, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 303, 100, 101, 305, 52, 51, 70, 71, 91, 304, 97, 58, 81, 85, 309, 82, 83, 306, 308, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 1, 83, 310, 107, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 5, 4, 3, 2, 2, 1, 1, 3, 2, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 315, 234, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 314, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 236, 82, 83, 313, 65, 311, 41, 42, 88, 89, 235, 312, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 2, 56, 1, 316, 242, 2, 56, 1, 317, 242, 99, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 318, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 319, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 100, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 321, 320, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 322, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 100, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 324, 323, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 325, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 100, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 327, 326, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 328, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 100, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 330, 329, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 331, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 100, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 333, 332, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 334, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 9, 6, 59, 1, 5, 22, 1, 8, 18, 3, -216, -216, -216, 336, 337, -216, -216, -216, 335, 6, 6, 59, 1, 5, 49, 3, -173, -173, -173, -173, -173, -173, 7, 6, 59, 1, 5, 1, 48, 3, -177, -177, -177, -177, 338, -177, -177, 15, 6, 48, 1, 10, 1, 5, 7, 1, 1, 7, 14, 2, 17, 3, 5, -180, 149, 102, -180, -180, -180, 151, 152, 150, 97, 154, 153, -180, -180, 339, 11, 6, 59, 1, 5, 1, 20, 28, 3, 39, 2, 2, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, 11, 6, 59, 1, 5, 1, 20, 28, 3, 39, 2, 2, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, 11, 6, 59, 1, 5, 1, 20, 28, 3, 39, 2, 2, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, 11, 6, 59, 1, 5, 1, 20, 28, 3, 39, 2, 2, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, 2, 56, 1, 241, 242, 111, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 1, 1, 1, 2, 2, 1, 1, 2, 1, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 315, 234, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 231, 100, 101, 232, 52, 51, 70, 71, 91, 97, 58, 81, 226, 85, 236, 82, 83, 227, 228, 230, 233, 229, 65, 41, 42, 88, 89, 235, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, 9, 1, 5, 58, 1, 1, 5, 31, 18, 17, -169, -169, -169, -169, -169, -169, -169, -169, -169, 104, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 7, 1, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 341, 3, 4, 5, 6, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 340, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 41, 42, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, 122, 123, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, 116, -361, 118, -361, -361, 9, 1, 5, 58, 1, 1, 5, 31, 18, 17, -358, -358, -358, -358, -358, -358, -358, -358, -358, 5, 147, 1, 9, 1, 1, 125, 126, 127, 94, 95, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, 122, 123, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, 116, -362, 118, -362, -362, 9, 1, 5, 58, 1, 1, 5, 31, 18, 17, -359, -359, -359, -359, -359, -359, -359, -359, -359, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, 122, 123, -363, -363, -363, -363, -363, -363, -363, -363, -363, 109, -363, -363, -363, -363, -363, -363, 116, -363, 118, -363, -363, 18, 6, 48, 1, 10, 1, 5, 7, 1, 1, 7, 14, 2, 1, 15, 1, 3, 4, 1, -172, 149, 102, -172, -172, -172, 151, 152, 150, 97, 154, 153, 148, 342, -172, -172, 146, 147, 2, 65, 56, 157, 155, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 158, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 161, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 5, 15, 107, 2, 1, 1, 207, 164, 165, 88, 89, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, 122, 123, -364, -364, -364, -364, -364, -364, -364, -364, -364, 109, -364, -364, -364, -364, -364, -364, 116, -364, 118, -364, -364, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -365, -365, -365, -365, -365, -365, -365, -365, -365, -365, -365, -365, -365, -365, -365, -365, -365, -365, -365, 122, 123, -365, -365, -365, -365, -365, -365, -365, -365, -365, 109, -365, -365, -365, -365, -365, -365, 116, -365, 118, -365, -365, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, 122, 123, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, 116, -367, 118, -367, -367, 2, 79, 8, 343, 97, 55, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -369, -369, -85, -85, -369, -369, -369, -369, -85, -85, -85, -85, -85, -85, -85, -85, -369, -85, -369, -369, -369, -369, -369, -369, -369, -369, -85, -369, -369, -85, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -85, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, 10, 53, 5, 1, 22, 1, 1, 3, 21, 11, 12, 129, 103, 104, 132, 133, 134, 135, 130, 136, 131, 3, 81, 1, 1, 137, 138, 139, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, 55, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -370, -370, -85, -85, -370, -370, -370, -370, -85, -85, -85, -85, -85, -85, -85, -85, -370, -85, -370, -370, -370, -370, -370, -370, -370, -370, -85, -370, -370, -85, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -85, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, 100, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 346, 344, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 345, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -82, -82, -82, -82, -82, -82, -82, -82, 124, -82, -82, -82, -82, -82, -82, -82, -82, -82, 121, 122, 123, 94, 95, -82, -82, -82, -82, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 347, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 348, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 3, 65, 56, 22, 157, 349, 350, 44, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 2, 1, 1, 6, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, 351, 352, 353, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, 4, 92, 70, 2, 2, 355, 354, 356, 357, 11, 54, 1, 23, 1, 1, 7, 4, 10, 2, 25, 39, 149, 102, 151, 152, 150, 97, 358, 154, 153, 192, 191, 11, 54, 1, 23, 1, 1, 7, 4, 10, 2, 25, 39, 149, 102, 151, 152, 150, 97, 359, 154, 153, 192, 191, 3, 65, 56, 42, 157, 360, 361, 5, 71, 21, 70, 2, 2, 362, -299, -299, -299, -299, 6, 71, 1, 20, 70, 2, 2, -297, 363, -297, -297, -297, -297, 22, 65, 25, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 364, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 3, 154, 1, 1, 365, 366, 367, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 368, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 57, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 1, 2, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 21, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -305, -305, -85, -85, -305, 157, -305, -305, -85, -85, -85, -85, -85, -85, -85, -85, -305, -85, -305, -305, -305, -305, -305, -305, -305, -305, -85, -305, 369, -305, -85, -305, -305, -305, -305, -305, -305, -305, -305, -305, 370, -305, -305, -85, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, 103, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 1, 1, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 373, 374, 375, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 41, 42, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 371, 372, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, 122, 123, -221, -221, -221, -221, -221, -221, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 2, 79, 8, 376, 97, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, 122, 123, -224, -224, -224, -224, -224, -224, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 2, 79, 8, 377, 97, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 378, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 3, 65, 53, 3, 157, 379, 380, 9, 1, 5, 58, 1, 1, 5, 31, 18, 17, -360, -360, -360, -360, -360, -360, -360, -360, -360, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, 122, 123, -218, -218, -218, -218, -218, -218, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 2, 79, 8, 381, 97, 13, 1, 5, 58, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, 2, 71, 70, 383, 382, 1, 141, 384, 7, 54, 1, 10, 29, 83, 1, 2, 389, 102, 388, 385, 386, 387, 390, 2, 71, 70, -333, -333, 1, 179, 391, 7, 54, 1, 10, 29, 86, 3, 2, 396, 102, 395, 392, 397, 393, 394, 13, 1, 5, 58, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, 13, 1, 5, 58, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, 13, 1, 5, 58, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, 1, 72, 398, 99, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 399, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 400, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 1, 141, 401, 2, 6, 131, 105, 402, 103, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 403, 3, 4, 5, 6, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 41, 42, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 30, 6, 59, 1, 5, 19, 12, 2, 11, 1, 4, 27, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -198, -198, -198, -198, 124, -198, 309, 404, 308, -198, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 55, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, 107, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 1, 1, 1, 2, 2, 5, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 315, 234, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 232, 52, 51, 70, 71, 91, 97, 58, 81, 405, 85, 236, 82, 83, 407, 406, 65, 41, 42, 88, 89, 235, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 9, 6, 59, 1, 5, 22, 1, 8, 9, 9, -216, -216, -216, 409, 410, -216, -216, 408, -216, 58, 6, 5, 34, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 1, 1, 1, 3, 5, 11, 3, 11, 1, 1, 1, 2, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 411, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, 5, 6, 59, 1, 5, 31, -144, -144, -144, -144, -144, 110, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 1, 2, 1, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 315, 234, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 231, 100, 101, 232, 52, 51, 70, 71, 91, 97, 58, 81, 85, 236, 82, 83, 413, 412, 230, 233, 229, 65, 41, 42, 88, 89, 235, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 58, 6, 5, 34, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 1, 1, 1, 3, 5, 11, 3, 11, 1, 1, 1, 2, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, 5, 6, 59, 1, 5, 31, -149, -149, -149, -149, -149, 6, 6, 59, 1, 5, 31, 18, -199, -199, -199, -199, -199, -199, 6, 6, 59, 1, 5, 31, 18, -200, -200, -200, -200, -200, -200, 104, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 1, 1, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 1, 1, 3, 2, 9, 3, 2, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -201, 414, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, -201, -201, 100, 101, -201, 52, 51, 70, 71, 91, 97, 58, 81, -201, 85, 82, 83, 65, -201, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 51, 1, 5, 52, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, 2, 56, 1, 415, 242, 99, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 416, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 417, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 51, 1, 5, 52, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, 59, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, 59, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, 2, 56, 1, 418, 242, 2, 56, 1, 419, 242, 23, 65, 25, 31, 26, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 157, 124, 420, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 23, 65, 25, 31, 26, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 157, 124, 421, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -253, -253, -253, -253, -253, -253, -253, -253, 124, -253, -253, 422, -253, -253, -253, -253, -253, -253, -253, 122, 123, 94, 95, -253, -253, -253, -253, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -255, -255, -255, -255, -255, -255, -255, -255, 124, -255, -255, 423, -255, -255, -255, -255, -255, -255, -255, 122, 123, 94, 95, -255, -255, -255, -255, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -262, -262, -262, -262, -262, -262, -262, -262, 124, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, 122, 123, 94, 95, -262, -262, -262, -262, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 6, 6, 59, 1, 5, 18, 5, -113, -113, -113, -113, 424, -113, 8, 6, 59, 1, 5, 22, 1, 8, 18, -216, -216, -216, 426, 425, -216, -216, -216, 7, 6, 59, 1, 5, 1, 17, 5, -122, -122, -122, -122, 427, -122, -122, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 428, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 3, 56, 1, 44, 241, 242, 429, 6, 6, 59, 1, 5, 18, 5, -125, -125, -125, -125, -125, -125, 5, 6, 59, 1, 5, 23, -109, -109, -109, -109, -109, 11, 6, 59, 1, 5, 1, 9, 1, 1, 6, 5, 24, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, 11, 6, 59, 1, 5, 1, 9, 1, 1, 6, 5, 24, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, 11, 6, 59, 1, 5, 1, 9, 1, 1, 6, 5, 24, -121, -121, -121, -121, -121, -121, -121, -121, -121, -121, -121, 5, 6, 59, 1, 5, 23, -114, -114, -114, -114, -114, 17, 37, 4, 1, 12, 1, 1, 1, 22, 1, 7, 13, 3, 2, 1, 2, 25, 3, 433, 435, 434, 258, 102, 259, 242, 432, 260, 97, 430, 85, 431, 436, 437, 84, 80, 51, 1, 5, 52, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -38, -38, -38, -38, -38, -38, -38, 438, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, 55, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, 6, 53, 5, 1, 2, 1, 1, 268, 103, 104, 439, 440, 267, 4, 58, 1, 2, 2, -57, -57, -57, -57, 105, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 1, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 441, 3, 4, 5, 6, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 443, 442, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 41, 42, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 4, 58, 1, 2, 2, -62, -62, -62, -62, 5, 1, 5, 58, 2, 71, -4, -4, -4, -4, -4, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, 122, 123, -373, -373, -373, -373, -373, -373, -373, -373, 108, 109, -373, -373, -373, -373, -373, -373, 116, -373, 118, -373, -373, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, 122, 123, -374, -374, -374, -374, -374, -374, -374, -374, 108, 109, -374, -374, -374, -374, -374, -374, 116, -374, 118, -374, -374, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, 122, 123, -375, -375, -375, -375, -375, -375, -375, -375, -375, 109, -375, -375, -375, -375, -375, -375, 116, -375, 118, -375, -375, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, 122, 123, -376, -376, -376, -376, -376, -376, -376, -376, -376, 109, -376, -376, -376, -376, -376, -376, 116, -376, 118, -376, -376, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, 122, 123, -377, -377, -377, -377, -377, -377, 107, 106, 108, 109, -377, -377, -377, -377, -377, -377, 116, -377, 118, -377, -377, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, 122, 123, -378, -378, -378, -378, -378, -378, 107, 106, 108, 109, 110, -378, -378, -378, -378, -378, 116, -378, 118, 119, -378, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, 122, 123, -379, -379, -379, -379, -379, -379, 107, 106, 108, 109, 110, 111, -379, -379, -379, -379, 116, -379, 118, 119, -379, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, 122, 123, -380, -380, -380, -380, -380, -380, 107, 106, 108, 109, 110, 111, 112, -380, -380, -380, 116, -380, 118, 119, -380, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, 122, 123, -381, -381, -381, -381, -381, -381, 107, 106, 108, 109, 110, 111, 112, 113, -381, -381, 116, -381, 118, 119, -381, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, 122, 123, -389, -389, -389, -389, -389, -389, 107, 106, 108, 109, 110, 111, 112, 113, 114, -389, 116, 117, 118, 119, -389, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -390, -390, -390, -390, -390, -390, -390, -390, 124, -390, -390, -390, -390, -390, -390, -390, -390, -390, 121, 122, 123, 94, 95, -390, -390, -390, -390, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, 122, 123, -388, -388, -388, -388, -388, -388, 107, 106, 108, 109, 110, 111, 112, 113, 114, -388, 116, -388, 118, 119, -388, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -391, -391, -391, -391, -391, -391, -391, -391, 124, -391, -391, -391, -391, -391, -391, -391, -391, -391, 121, 122, 123, 94, 95, -391, -391, -391, -391, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, 122, 123, -392, -392, -392, -392, -392, -392, 107, 106, 108, 109, 110, -392, -392, -392, -392, -392, 116, -392, 118, -392, -392, 22, 89, 1, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 444, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -235, -235, -235, -235, -235, -235, -235, -235, 124, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, 122, 123, 94, 95, -235, -235, -235, -235, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -237, -237, -237, -237, -237, -237, -237, -237, 124, -237, -237, -237, -237, -237, -237, -237, -237, -237, 121, 122, 123, 94, 95, -237, -237, -237, -237, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 4, 92, 70, 2, 2, 446, 445, 447, 448, 11, 54, 1, 23, 1, 1, 7, 4, 10, 2, 25, 39, 149, 102, 151, 152, 150, 97, 449, 154, 153, 192, 191, 11, 54, 1, 23, 1, 1, 7, 4, 10, 2, 25, 39, 149, 102, 151, 152, 150, 97, 450, 154, 153, 192, 191, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, 451, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -234, -234, -234, -234, -234, -234, -234, -234, 124, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, 122, 123, 94, 95, -234, -234, -234, -234, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -236, -236, -236, -236, -236, -236, -236, -236, 124, -236, -236, -236, -236, -236, -236, -236, -236, -236, 121, 122, 123, 94, 95, -236, -236, -236, -236, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 51, 1, 5, 52, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, 59, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, 59, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, 25, 84, 6, 14, 11, 1, 31, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 452, 124, 309, 453, 308, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 5, 2, 3, 11, 2, 1, 2, 2, 7, 1, 1, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 454, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 455, 97, 58, 81, 85, 309, 82, 83, 306, 308, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 1, 84, 456, 1, 84, 457, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 7, 1, 1, 8, 1, 1, 1, 1, 4, 3, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 458, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, -163, 100, 101, 52, 51, 70, 71, 91, -163, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -45, -45, -45, -45, -45, -45, -45, 459, -45, -45, -45, -66, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, 54, 11, 34, 2, 1, 1, 1, 1, 1, 3, 3, 1, 7, 1, 1, 8, 8, 3, 3, 11, 2, 3, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, 54, 11, 34, 2, 1, 1, 1, 1, 1, 3, 3, 1, 7, 1, 1, 8, 8, 3, 3, 11, 2, 3, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, 99, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 460, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 461, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 51, 1, 5, 52, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, 8, 6, 59, 1, 5, 22, 1, 8, 18, -216, -216, -216, 463, 462, -216, -216, -216, 5, 6, 59, 1, 5, 49, -193, -193, -193, -193, -193, 106, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 5, 4, 5, 2, 1, 1, 3, 2, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 315, 234, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 314, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 236, 82, 83, 313, 65, 41, 42, 88, 89, 235, 464, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 27, 6, 59, 1, 5, 19, 12, 18, 27, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -198, -198, -198, -198, 124, -198, -198, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 59, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, 59, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, 22, 84, 6, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 465, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 466, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, 122, 123, -67, -67, -67, -67, -67, -67, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 467, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 468, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -70, -70, -70, -70, -70, -70, -70, -70, 124, -70, -70, -70, -70, -70, -70, -70, -70, -70, 121, 122, 123, 94, 95, -70, -70, -70, -70, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 469, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 470, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -73, -73, -73, -73, -73, -73, -73, -73, 124, -73, -73, -73, -73, -73, -73, -73, -73, -73, 121, 122, 123, 94, 95, -73, -73, -73, -73, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 471, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 472, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -76, -76, -76, -76, -76, -76, -76, -76, 124, -76, -76, -76, -76, -76, -76, -76, -76, -76, 121, 122, 123, 94, 95, -76, -76, -76, -76, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 473, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 474, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -79, -79, -79, -79, -79, -79, -79, -79, 124, -79, -79, -79, -79, -79, -79, -79, -79, -79, 121, 122, 123, 94, 95, -79, -79, -79, -79, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 475, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 476, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 3, 124, 1, 1, 477, 88, 89, 17, 6, 48, 1, 10, 1, 12, 1, 1, 7, 7, 7, 1, 1, 1, 16, 7, 1, -217, 149, 102, -217, -217, 151, 152, 150, 97, -217, 154, -217, 153, 148, -217, 478, 147, 2, 6, 59, 479, 480, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 481, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 6, 6, 59, 1, 5, 49, 3, -179, -179, -179, -179, -179, -179, 54, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 3, 1, 4, 2, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, 2, 6, 60, 105, 482, 9, 6, 59, 1, 5, 22, 1, 8, 18, 3, -216, -216, -216, 336, 337, -216, -216, -216, 483, 1, 66, 484, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, 122, 123, -394, -394, -394, -394, -394, -394, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 485, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 486, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -83, -83, -83, -83, -83, -83, -83, -83, 124, -83, -83, -83, -83, -83, -83, -83, -83, -83, 121, 122, 123, 94, 95, -83, -83, -83, -83, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 22, 66, 24, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 487, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 488, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 3, 7, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, 489, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, 2, 65, 56, 157, 490, 6, 54, 1, 10, 14, 8, 34, 491, 102, 157, 492, 97, 493, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 494, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 495, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 496, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 497, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 1, 92, 498, 1, 164, 499, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 500, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 10, 54, 1, 23, 1, 1, 7, 14, 2, 25, 39, 149, 102, 151, 152, 150, 97, 154, 153, 192, 501, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 502, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 3, 154, 1, 1, 503, 366, 367, 4, 66, 78, 11, 1, 504, 505, 506, 367, 3, 66, 78, 12, -249, -249, -249, 99, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 6, 1, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 508, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 507, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 43, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 1, 2, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -303, -303, -303, 157, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, 509, -303, -303, -303, 122, 123, -303, -303, -303, -303, -303, -303, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 510, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 2, 6, 60, 512, 511, 2, 6, 60, -310, -310, 23, 6, 60, 24, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -313, -313, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 2, 6, 60, -314, -314, 7, 6, 60, 81, 1, 9, 1, 1, -315, -315, 125, 126, 127, 94, 95, 1, 66, 513, 1, 66, 514, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, 122, 123, -226, -226, -226, -226, -226, -226, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 18, 6, 48, 1, 10, 1, 5, 7, 1, 1, 7, 14, 2, 1, 15, 1, 3, 4, 1, -172, 149, 102, -172, -172, -172, 151, 152, 150, 97, 154, 153, 148, 515, -172, -172, 146, 147, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, 1, 66, 516, 3, 53, 5, 1, 517, 103, 104, 3, 87, 89, 5, 519, 518, 215, 3, 53, 5, 1, 520, 103, 104, 1, 141, 521, 8, 6, 59, 1, 5, 22, 1, 8, 18, -216, -216, -216, 523, 522, -216, -216, -216, 5, 6, 59, 1, 5, 23, -324, -324, -324, -324, -324, 6, 54, 1, 10, 112, 1, 2, 389, 102, 388, 524, 387, 390, 6, 6, 59, 1, 5, 23, 85, -329, -329, -329, -329, -329, 525, 6, 6, 59, 1, 5, 23, 85, -331, -331, -331, -331, -331, 526, 2, 54, 1, 527, 102, 14, 1, 5, 58, 1, 1, 5, 31, 18, 17, 4, 6, 1, 10, 1, -335, -335, -335, -335, -335, -335, -335, -335, -335, 528, -335, -335, -335, -335, 8, 6, 59, 1, 5, 22, 1, 8, 18, -216, -216, -216, 530, 529, -216, -216, -216, 5, 6, 59, 1, 5, 23, -348, -348, -348, -348, -348, 6, 54, 1, 10, 115, 3, 2, 396, 102, 395, 397, 531, 394, 6, 6, 59, 1, 5, 23, 85, -353, -353, -353, -353, -353, 532, 6, 6, 59, 1, 5, 23, 85, -356, -356, -356, -356, -356, 533, 100, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 535, 534, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 536, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 30, 1, 5, 58, 1, 1, 5, 19, 12, 18, 17, 10, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -343, -343, -343, -343, -343, -343, 124, -343, -343, -343, -343, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 2, 79, 8, 537, 97, 3, 53, 5, 1, 538, 103, 104, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, 2, 6, 60, 105, 539, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 540, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 55, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, 58, 6, 5, 34, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 1, 1, 1, 3, 5, 11, 3, 11, 1, 1, 1, 2, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 411, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, 5, 6, 59, 1, 5, 31, -150, -150, -150, -150, -150, 2, 65, 37, 542, 541, 114, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 1, 1, 1, 3, 5, 1, 1, 1, 1, 7, 3, 4, 7, 1, 1, 1, 2, 2, 1, 3, 1, 1, 3, 3, 2, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -217, 315, 234, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, -217, -217, 100, 101, 232, 52, 51, 70, 71, 91, 97, 58, -217, 81, -217, 85, 236, 82, 83, 544, 543, 233, 229, 65, -217, 41, 42, 88, 89, 235, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 4, 6, 59, 1, 36, 545, -151, -151, -151, 58, 6, 5, 34, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 1, 1, 1, 3, 5, 11, 3, 11, 1, 1, 1, 2, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, 9, 6, 59, 1, 5, 22, 1, 8, 9, 9, -216, -216, -216, 409, 410, -216, -216, 546, -216, 106, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 5, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 315, 234, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 232, 52, 51, 70, 71, 91, 97, 58, 81, 85, 236, 82, 83, 407, 406, 65, 41, 42, 88, 89, 235, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 27, 6, 59, 1, 5, 19, 12, 18, 27, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -185, -185, -185, -185, 124, -185, -185, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, 22, 84, 6, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 547, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 548, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, 549, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 550, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 551, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 99, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 552, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 553, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 3, 6, 59, 29, 555, 556, 554, 23, 6, 38, 8, 1, 1, 1, 1, 1, 1, 1, 6, 1, 14, 8, 6, 4, 1, 1, 1, 1, 1, 1, 16, -217, 256, 98, 99, 258, 102, 259, 242, 103, 104, -217, -217, 260, 558, -217, 557, 261, 253, 254, -217, 255, 262, -217, 99, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 559, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 560, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 22, 90, 12, 45, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 124, 561, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 562, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 10, 6, 59, 1, 5, 10, 1, 1, 11, 13, 11, -126, -126, -126, -126, -128, -128, -128, -126, 563, 136, 10, 6, 59, 1, 5, 10, 1, 1, 11, 13, 11, -127, -127, -127, -127, 565, 566, 567, -127, 564, 136, 9, 6, 59, 1, 5, 10, 1, 1, 11, 24, -129, -129, -129, -129, -129, -129, -129, -129, -129, 9, 6, 59, 1, 5, 10, 1, 1, 11, 24, -130, -130, -130, -130, -130, -130, -130, -130, -130, 9, 6, 59, 1, 5, 10, 1, 1, 11, 24, -131, -131, -131, -131, -131, -131, -131, -131, -131, 9, 6, 59, 1, 5, 10, 1, 1, 11, 24, -132, -132, -132, -132, -132, -132, -132, -132, -132, 4, 81, 2, 24, 11, 238, 239, 568, 136, 2, 107, 11, 569, 136, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, 53, 1, 5, 52, 1, 2, 2, 1, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, 4, 58, 1, 2, 2, -58, -58, -58, -58, 2, 6, 58, 105, 570, 103, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 571, 3, 4, 5, 6, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 41, 42, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 4, 58, 1, 2, 2, -61, -61, -61, -61, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 572, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 573, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 574, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 575, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 576, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 1, 92, 577, 1, 164, 578, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 579, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 59, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 7, 1, 1, 8, 1, 1, 1, 1, 4, 3, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 580, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, -161, 100, 101, 52, 51, 70, 71, 91, -161, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 25, 66, 24, 14, 11, 1, 31, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 581, 124, 309, 453, 308, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 1, 66, 582, 59, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, 59, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, 23, 66, 18, 6, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -162, -162, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 583, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 22, 84, 6, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 584, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 585, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 3, 6, 59, 55, 587, 588, 586, 110, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 1, 1, 1, 8, 1, 1, 1, 1, 7, 3, 4, 7, 1, 1, 1, 2, 2, 5, 4, 3, 2, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -217, 315, 234, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, -217, -217, 100, 101, 52, 51, 70, 71, 91, 97, 58, -217, 81, -217, 85, 236, 82, 83, 589, 65, -217, 41, 42, 88, 89, 235, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 8, 6, 59, 1, 5, 22, 1, 8, 18, -216, -216, -216, 463, 590, -216, -216, -216, 59, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, 22, 66, 24, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 591, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, 122, 123, -68, -68, -68, -68, -68, -68, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 22, 66, 24, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 592, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -71, -71, -71, -71, -71, -71, -71, -71, 124, -71, -71, -71, -71, -71, -71, -71, -71, -71, 121, 122, 123, 94, 95, -71, -71, -71, -71, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 22, 66, 24, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 593, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -74, -74, -74, -74, -74, -74, -74, -74, 124, -74, -74, -74, -74, -74, -74, -74, -74, -74, 121, 122, 123, 94, 95, -74, -74, -74, -74, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 22, 66, 24, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 594, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -77, -77, -77, -77, -77, -77, -77, -77, 124, -77, -77, -77, -77, -77, -77, -77, -77, -77, 121, 122, 123, 94, 95, -77, -77, -77, -77, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 22, 66, 24, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 595, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -80, -80, -80, -80, -80, -80, -80, -80, 124, -80, -80, -80, -80, -80, -80, -80, -80, -80, 121, 122, 123, 94, 95, -80, -80, -80, -80, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 22, 66, 24, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 596, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 104, 5, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 4, 1, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 598, 4, 5, 6, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 157, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 597, 41, 42, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 6, 6, 59, 1, 5, 49, 3, -174, -174, -174, -174, -174, -174, 11, 54, 1, 23, 1, 1, 7, 14, 2, 1, 23, 1, 149, 102, 151, 152, 150, 97, 154, 153, 148, 599, 147, 18, 6, 48, 1, 10, 1, 5, 7, 1, 1, 7, 14, 2, 1, 15, 1, 3, 4, 1, -172, 149, 102, -172, -172, -172, 151, 152, 150, 97, 154, 153, 148, 600, -172, -172, 146, 147, 27, 6, 59, 1, 5, 19, 30, 3, 24, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -178, -178, -178, -178, 124, -178, -178, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 54, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 3, 1, 4, 2, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, 3, 124, 1, 1, 601, 88, 89, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, 22, 66, 24, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 602, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, 122, 123, -396, -396, -396, -396, -396, -396, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, 23, 65, 25, 31, 26, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 157, 124, 603, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 2, 65, 56, 157, 604, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, 2, 65, 56, 157, 605, 2, 65, 56, 157, 606, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 3, 7, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, 25, 65, 25, 5, 26, 26, 1, 9, 1, 1, 4, 27, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 157, 124, 608, 607, 121, 122, 123, 94, 95, 609, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 24, 65, 25, 5, 26, 26, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 157, 124, 611, 610, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 24, 65, 25, 5, 26, 26, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 157, 124, 613, 612, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 24, 65, 25, 5, 26, 26, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 157, 124, 615, 614, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 616, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 617, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 23, 65, 25, 31, 26, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 157, 124, 618, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 4, 92, 70, 2, 2, -300, -300, -300, -300, 26, 71, 19, 2, 55, 1, 9, 1, 1, 3, 2, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -298, 124, -298, 121, 122, 123, 94, 95, -298, -298, -298, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 4, 66, 78, 11, 1, 619, 620, 506, 367, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, 2, 65, 56, 157, 621, 3, 66, 78, 12, -250, -250, -250, 3, 65, 6, 50, 157, 623, 622, 23, 65, 6, 19, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -202, -202, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, 43, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 1, 2, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -307, -307, -307, 157, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, 624, -307, -307, -307, 122, 123, -307, -307, -307, -307, -307, -307, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, 104, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 7, 1, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 2, 1, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -312, 373, 374, 375, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, -312, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 41, 42, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 625, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, 8, 6, 59, 1, 5, 22, 1, 8, 18, -216, -216, -216, 336, 337, -216, -216, 626, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, 13, 1, 5, 58, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, 1, 141, 627, 6, 54, 1, 10, 112, 1, 2, 389, 102, 388, 628, 387, 390, 13, 1, 5, 58, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, 3, 53, 5, 1, 629, 103, 104, 3, 6, 59, 29, 631, 632, 630, 10, 6, 48, 1, 10, 1, 28, 8, 18, 58, 2, -217, 389, 102, -217, -217, -217, -217, -217, 633, 390, 8, 6, 59, 1, 5, 22, 1, 8, 18, -216, -216, -216, 523, 634, -216, -216, -216, 2, 54, 1, 635, 102, 2, 54, 1, 636, 102, 1, 141, -334, 3, 53, 5, 1, 637, 103, 104, 3, 6, 59, 29, 639, 640, 638, 10, 6, 48, 1, 10, 1, 28, 8, 18, 60, 5, -217, 396, 102, -217, -217, -217, -217, -217, 397, 641, 8, 6, 59, 1, 5, 22, 1, 8, 18, -216, -216, -216, 530, 642, -216, -216, -216, 3, 54, 1, 125, 643, 102, 644, 2, 54, 1, 645, 102, 30, 1, 5, 58, 1, 1, 5, 19, 12, 18, 17, 10, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -340, -340, -340, -340, -340, -340, 124, -340, -340, -340, -340, 122, 123, -340, -340, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 646, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 647, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 1, 66, 648, 13, 1, 5, 58, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -345, -345, -345, -345, -345, -345, -345, -345, -345, -345, -345, -345, -345, 1, 137, 649, 22, 90, 12, 45, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 124, 650, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 55, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, 110, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 1, 2, 1, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 315, 234, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 231, 100, 101, 232, 52, 51, 70, 71, 91, 97, 58, 81, 85, 236, 82, 83, 413, 651, 230, 233, 229, 65, 41, 42, 88, 89, 235, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 5, 6, 59, 1, 5, 31, -145, -145, -145, -145, -145, 109, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 1, 1, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 1, 1, 1, 2, 2, 5, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 315, 234, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, -152, -152, 100, 101, 232, 52, 51, 70, 71, 91, 97, 58, 81, -152, 85, 236, 82, 83, 407, 406, 65, 41, 42, 88, 89, 235, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 108, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 3, 1, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 315, 234, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 232, 52, 51, 70, 71, 91, 97, 58, 81, 85, 236, 82, 83, 413, 652, 233, 229, 65, 41, 42, 88, 89, 235, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 2, 65, 1, 542, 653, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, 22, 66, 24, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 654, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 2, 65, 56, 157, 655, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, 122, 123, -254, -254, -254, -254, -254, -254, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, 122, 123, -256, -256, -256, -256, -256, -256, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 26, 6, 59, 1, 5, 19, 4, 53, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -115, -115, -115, -115, 656, -115, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 657, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 55, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, 17, 44, 8, 1, 1, 1, 1, 1, 1, 1, 21, 8, 10, 1, 1, 1, 2, 1, 256, 98, 99, 258, 102, 259, 242, 103, 104, 260, 558, 658, 261, 253, 254, 255, 262, 23, 6, 38, 8, 1, 1, 1, 1, 1, 1, 1, 6, 1, 5, 9, 8, 6, 3, 1, 1, 1, 1, 2, 1, -108, 256, 98, 99, 258, 102, 259, 242, 103, 104, -108, -108, -108, 260, 558, -108, 659, 257, 261, 253, 254, 255, 262, 5, 6, 59, 1, 5, 23, -110, -110, -110, -110, -110, 6, 6, 59, 1, 5, 18, 5, -113, -113, -113, -113, 660, -113, 26, 6, 59, 1, 5, 19, 4, 53, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -117, -117, -117, -117, 124, -117, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 661, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 6, 6, 59, 1, 5, 18, 5, -123, -123, -123, -123, -123, -123, 22, 90, 12, 45, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 124, 662, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 9, 6, 59, 1, 5, 10, 1, 1, 11, 24, -135, -135, -135, -135, -135, -135, -135, -135, -135, 9, 6, 59, 1, 5, 10, 1, 1, 11, 24, -136, -136, -136, -136, -136, -136, -136, -136, -136, 2, 56, 1, 663, 242, 2, 56, 1, 664, 242, 99, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 665, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 666, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 9, 6, 59, 1, 5, 10, 1, 1, 11, 24, -133, -133, -133, -133, -133, -133, -133, -133, -133, 9, 6, 59, 1, 5, 10, 1, 1, 11, 24, -134, -134, -134, -134, -134, -134, -134, -134, -134, 4, 58, 1, 2, 2, -59, -59, -59, -59, 2, 6, 60, 105, 667, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, 122, 123, -393, -393, -393, -393, -393, -393, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, 668, -280, -280, -280, -280, -280, -280, -280, 122, 123, -280, -280, -280, 669, -280, -280, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, 670, -285, -285, -285, -285, -285, -285, -285, 122, 123, -285, -285, -285, -285, -285, -285, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, 671, -289, -289, -289, -289, -289, -289, -289, 122, 123, -289, -289, -289, -289, -289, -289, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, 672, -293, -293, -293, -293, -293, -293, -293, 122, 123, -293, -293, -293, -293, -293, -293, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 673, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 674, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, 122, 123, -296, -296, -296, -296, -296, -296, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 23, 66, 18, 6, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -160, -160, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 1, 84, 675, 1, 84, 676, 22, 84, 6, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -65, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 59, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, 22, 66, 24, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 677, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 51, 1, 5, 52, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, 104, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 5, 4, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 315, 234, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 236, 82, 83, 678, 65, 41, 42, 88, 89, 235, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 106, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 5, 4, 5, 2, 1, 1, 3, 2, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 315, 234, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 314, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 236, 82, 83, 313, 65, 41, 42, 88, 89, 235, 679, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 43, 44, 66, 45, 46, 47, 49, 50, 5, 6, 59, 1, 5, 49, -194, -194, -194, -194, -194, 3, 6, 59, 1, 587, 588, 680, 1, 84, 681, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, 9, 1, 5, 58, 1, 1, 5, 31, 18, 17, -168, -168, -168, -168, -168, -168, -168, -168, -168, 6, 6, 59, 1, 5, 49, 3, -175, -175, -175, -175, -175, -175, 8, 6, 59, 1, 5, 22, 1, 8, 18, -216, -216, -216, 336, 682, -216, -216, -216, 2, 65, 56, 157, 597, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 3, 7, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 3, 7, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 683, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 684, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 685, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 686, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 687, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 24, 65, 25, 5, 26, 26, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 157, 124, 689, 688, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 24, 65, 25, 5, 26, 26, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 157, 124, 691, 690, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, 2, 65, 56, 157, 692, 1, 66, 693, 4, 6, 60, 78, 12, 694, -251, -251, -251, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 695, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, 2, 6, 60, -311, -311, 2, 65, 56, 157, 696, 3, 53, 5, 1, 697, 103, 104, 8, 6, 59, 1, 5, 22, 1, 8, 18, -216, -216, -216, 523, 698, -216, -216, -216, 13, 1, 5, 58, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, 1, 141, 699, 4, 54, 1, 123, 2, 389, 102, 700, 390, 6, 54, 1, 10, 112, 1, 2, 389, 102, 388, 701, 387, 390, 5, 6, 59, 1, 5, 23, -325, -325, -325, -325, -325, 3, 6, 59, 1, 631, 632, 702, 5, 6, 59, 1, 5, 23, -330, -330, -330, -330, -330, 5, 6, 59, 1, 5, 23, -332, -332, -332, -332, -332, 13, 1, 5, 58, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, 14, 1, 5, 58, 1, 1, 5, 31, 18, 17, 4, 6, 1, 10, 1, -336, -336, -336, -336, -336, -336, -336, -336, -336, 703, -336, -336, -336, -336, 4, 54, 1, 125, 5, 396, 102, 397, 704, 6, 54, 1, 10, 115, 3, 2, 396, 102, 395, 397, 705, 394, 5, 6, 59, 1, 5, 23, -349, -349, -349, -349, -349, 3, 6, 59, 1, 639, 640, 706, 5, 6, 59, 1, 5, 23, -354, -354, -354, -354, -354, 5, 6, 59, 1, 5, 23, -355, -355, -355, -355, -355, 5, 6, 59, 1, 5, 23, -357, -357, -357, -357, -357, 30, 1, 5, 58, 1, 1, 5, 19, 12, 18, 17, 10, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -341, -341, -341, -341, -341, -341, 124, -341, -341, -341, -341, 122, 123, -341, -341, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 22, 66, 24, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 707, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 13, 1, 5, 58, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -344, -344, -344, -344, -344, -344, -344, -344, -344, -344, -344, -344, -344, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, 9, 6, 59, 1, 5, 22, 1, 8, 9, 9, -216, -216, -216, 409, 410, -216, -216, 708, -216, 5, 6, 59, 1, 5, 31, -146, -146, -146, -146, -146, 5, 6, 59, 1, 5, 31, -147, -147, -147, -147, -147, 1, 84, 709, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, 14, 38, 16, 1, 23, 1, 1, 7, 4, 5, 5, 2, 25, 37, 2, 296, 149, 102, 151, 152, 150, 97, 710, 711, 81, 153, 192, 295, 191, 22, 66, 24, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 712, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 5, 6, 59, 1, 5, 23, -111, -111, -111, -111, -111, 8, 6, 59, 1, 5, 22, 1, 8, 18, -216, -216, -216, 426, 713, -216, -216, -216, 99, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 714, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 553, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 22, 66, 24, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 715, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 6, 6, 59, 1, 5, 18, 5, -124, -124, -124, -124, -124, -124, 9, 6, 59, 1, 5, 10, 1, 1, 11, 24, -137, -137, -137, -137, -137, -137, -137, -137, -137, 9, 6, 59, 1, 5, 10, 1, 1, 11, 24, -138, -138, -138, -138, -138, -138, -138, -138, -138, 22, 84, 6, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 716, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 717, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 1, 64, 718, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 719, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 720, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 721, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 722, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 723, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, 724, -287, -287, -287, -287, -287, -287, -287, 122, 123, -287, -287, -287, -287, -287, -287, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, 725, -291, -291, -291, -291, -291, -291, -291, 122, 123, -291, -291, -291, -291, -291, -291, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 59, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, 59, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, 1, 84, 726, 5, 6, 59, 1, 5, 49, -195, -195, -195, -195, -195, 8, 6, 59, 1, 5, 22, 1, 8, 18, -216, -216, -216, 463, 727, -216, -216, -216, 5, 6, 59, 1, 5, 49, -196, -196, -196, -196, -196, 59, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, 3, 6, 59, 1, 479, 480, 728, 24, 65, 25, 31, 26, 1, 9, 1, 1, 4, 27, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 157, 124, 729, 121, 122, 123, 94, 95, 730, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 24, 65, 25, 5, 26, 26, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 157, 124, 732, 731, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 23, 65, 25, 31, 26, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 157, 124, 733, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 23, 65, 25, 31, 26, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 157, 124, 734, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 23, 65, 25, 31, 26, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 157, 124, 735, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 736, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 737, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 1, 66, 738, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, 3, 66, 78, 12, -252, -252, -252, 23, 65, 6, 19, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -203, -203, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, 13, 1, 5, 58, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, 3, 6, 59, 29, 631, 632, 739, 3, 53, 5, 1, 740, 103, 104, 5, 6, 59, 1, 5, 23, -326, -326, -326, -326, -326, 8, 6, 59, 1, 5, 22, 1, 8, 18, -216, -216, -216, 523, 741, -216, -216, -216, 5, 6, 59, 1, 5, 23, -327, -327, -327, -327, -327, 3, 53, 5, 1, 742, 103, 104, 5, 6, 59, 1, 5, 23, -350, -350, -350, -350, -350, 8, 6, 59, 1, 5, 22, 1, 8, 18, -216, -216, -216, 530, 743, -216, -216, -216, 5, 6, 59, 1, 5, 23, -351, -351, -351, -351, -351, 13, 1, 5, 58, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -342, -342, -342, -342, -342, -342, -342, -342, -342, -342, -342, -342, -342, 2, 65, 1, 542, 744, 50, 1, 5, 52, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, 4, 92, 70, 2, 2, 745, 445, 447, 448, 11, 54, 1, 23, 1, 1, 7, 4, 10, 2, 25, 39, 149, 102, 151, 152, 150, 97, 746, 154, 153, 192, 191, 5, 6, 59, 1, 5, 23, -116, -116, -116, -116, -116, 3, 6, 59, 1, 555, 556, 747, 26, 6, 59, 1, 5, 19, 4, 53, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -115, -115, -115, -115, 124, -115, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 5, 6, 59, 1, 5, 23, -118, -118, -118, -118, -118, 9, 6, 59, 1, 5, 10, 1, 1, 11, 24, -139, -139, -139, -139, -139, -139, -139, -139, -139, 22, 66, 24, 57, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 748, 124, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 4, 58, 1, 2, 2, -60, -60, -60, -60, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, 122, 123, -281, -281, -281, 749, -281, -281, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, 750, -282, -282, -282, -282, -282, -282, -282, 122, 123, -282, -282, -282, -282, -282, -282, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, 122, 123, -286, -286, -286, -286, -286, -286, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, 122, 123, -290, -290, -290, -290, -290, -290, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, 122, 123, -294, -294, -294, -294, -294, -294, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 751, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 752, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 59, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 3, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, 3, 6, 59, 1, 587, 588, 753, 6, 6, 59, 1, 5, 49, 3, -176, -176, -176, -176, -176, -176, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 754, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 755, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, 23, 65, 25, 31, 26, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 157, 124, 756, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 23, 65, 25, 31, 26, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 157, 124, 757, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, 1, 141, 758, 13, 1, 5, 58, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, 3, 6, 59, 1, 631, 632, 759, 13, 1, 5, 58, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, 3, 6, 59, 1, 639, 640, 760, 5, 6, 59, 1, 5, 31, -148, -148, -148, -148, -148, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 761, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 1, 92, 762, 5, 6, 59, 1, 5, 23, -112, -112, -112, -112, -112, 1, 84, 763, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 764, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 765, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, 122, 123, -288, -288, -288, -288, -288, -288, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, 122, 123, -292, -292, -292, -292, -292, -292, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 5, 6, 59, 1, 5, 49, -197, -197, -197, -197, -197, 23, 65, 25, 31, 26, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 157, 124, 766, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 23, 65, 25, 31, 26, 1, 9, 1, 1, 31, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 157, 124, 767, 121, 122, 123, 94, 95, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, 3, 53, 5, 1, 768, 103, 104, 5, 6, 59, 1, 5, 23, -328, -328, -328, -328, -328, 5, 6, 59, 1, 5, 23, -352, -352, -352, -352, -352, 43, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 1, 1, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -285, -285, -285, -285, -285, 771, -285, -285, -285, -285, 769, -285, 770, -285, -285, -285, -285, -285, -285, -285, 122, 123, -285, -285, -285, -285, -285, -285, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 772, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 9, 6, 59, 1, 5, 10, 1, 1, 11, 24, -140, -140, -140, -140, -140, -140, -140, -140, -140, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, 122, 123, -283, -283, -283, -283, -283, -283, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 42, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, 122, 123, -284, -284, -284, -284, -284, -284, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, 41, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, 13, 1, 5, 58, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, 1, 94, 773, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 774, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 6, 6, 59, 1, 28, 8, 18, -217, -217, -217, -217, -217, -217, 43, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 1, 1, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -287, -287, -287, -287, -287, 771, -287, -287, -287, -287, 775, -287, 776, -287, -287, -287, -287, -287, -287, -287, 122, 123, -287, -287, -287, -287, -287, -287, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 55, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, 43, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 1, 1, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -286, -286, -286, -286, -286, 771, -286, -286, -286, -286, 777, -286, -286, -286, -286, -286, -286, -286, -286, -286, 122, 123, -286, -286, -286, -286, -286, -286, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 1, 94, 778, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 779, 160, 28, 29, 30, 31, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 34, 35, 36, 37, 38, 39, 40, 72, 73, 74, 75, 76, 77, 78, 79, 98, 99, 90, 102, 103, 104, 100, 101, 52, 51, 70, 71, 91, 97, 58, 81, 85, 82, 83, 65, 164, 165, 88, 89, 84, 86, 87, 80, 67, 63, 64, 53, 92, 54, 93, 55, 59, 56, 94, 95, 57, 96, 48, 60, 61, 62, 68, 69, 166, 167, 168, 45, 46, 47, 49, 50, 1, 94, 780, 55, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, 43, 1, 5, 58, 1, 1, 5, 13, 5, 1, 2, 1, 1, 1, 7, 2, 12, 4, 3, 14, 10, 1, 9, 1, 1, 3, 1, 1, 2, 24, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -288, -288, -288, -288, -288, 771, -288, -288, -288, -288, 781, -288, -288, -288, -288, -288, -288, -288, -288, -288, 122, 123, -288, -288, -288, -288, -288, -288, 107, 106, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 55, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, 1, 94, 782, 55, 1, 5, 52, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 10, 1, 10, 1, 3, 1, 1, 2, 24, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106], t = [], p = 0, n, o, k, a;
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
  ruleTable: [0, 0, 3, 0, 3, 1, 4, 1, 4, 3, 4, 2, 5, 1, 5, 1, 5, 1, 9, 1, 9, 1, 9, 1, 9, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 8, 1, 8, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 36, 1, 36, 1, 36, 1, 36, 1, 36, 1, 36, 1, 36, 1, 36, 1, 44, 1, 44, 1, 54, 1, 56, 1, 53, 1, 53, 3, 60, 1, 60, 2, 62, 3, 62, 5, 62, 2, 62, 1, 46, 1, 46, 3, 70, 3, 70, 1, 17, 3, 17, 4, 17, 5, 18, 3, 18, 4, 18, 5, 19, 3, 19, 4, 19, 5, 20, 3, 20, 4, 20, 5, 21, 3, 21, 4, 21, 5, 21, 2, 21, 3, 21, 4, 35, 1, 35, 1, 35, 1, 77, 1, 77, 1, 77, 3, 77, 3, 77, 4, 77, 6, 77, 4, 77, 6, 77, 4, 77, 5, 77, 7, 77, 3, 77, 3, 77, 4, 77, 6, 79, 10, 79, 12, 79, 11, 79, 13, 79, 4, 97, 0, 97, 1, 97, 3, 97, 4, 97, 6, 98, 1, 98, 1, 98, 3, 98, 5, 98, 3, 98, 5, 100, 1, 100, 1, 100, 1, 88, 1, 88, 3, 88, 4, 88, 1, 99, 2, 99, 2, 105, 1, 105, 1, 105, 1, 105, 1, 105, 1, 105, 2, 105, 2, 105, 2, 105, 2, 105, 3, 105, 3, 105, 4, 105, 6, 78, 2, 78, 3, 78, 4, 110, 1, 110, 3, 110, 4, 110, 4, 110, 6, 112, 1, 112, 2, 111, 1, 111, 2, 109, 1, 109, 2, 114, 1, 114, 2, 115, 1, 115, 1, 38, 5, 85, 3, 85, 2, 85, 2, 85, 1, 32, 6, 32, 3, 15, 5, 15, 2, 33, 5, 33, 2, 124, 1, 124, 1, 119, 0, 119, 1, 119, 3, 119, 4, 119, 6, 127, 1, 127, 3, 127, 2, 127, 1, 128, 1, 128, 1, 128, 1, 128, 1, 129, 2, 39, 2, 39, 2, 39, 3, 39, 2, 39, 2, 107, 2, 107, 4, 131, 1, 131, 3, 131, 4, 131, 4, 131, 6, 113, 1, 113, 1, 113, 1, 113, 1, 132, 1, 132, 3, 41, 1, 41, 1, 80, 2, 42, 3, 42, 4, 42, 6, 43, 3, 43, 3, 121, 2, 121, 3, 37, 3, 37, 5, 93, 0, 93, 1, 10, 2, 10, 4, 10, 1, 30, 2, 30, 4, 31, 1, 31, 2, 31, 4, 31, 3, 142, 3, 142, 5, 145, 3, 145, 5, 22, 1, 22, 3, 22, 1, 22, 3, 22, 3, 22, 3, 22, 3, 23, 2, 23, 3, 23, 4, 23, 5, 150, 3, 150, 3, 150, 2, 26, 5, 26, 7, 26, 4, 26, 6, 154, 1, 154, 2, 155, 3, 155, 4, 157, 2, 157, 4, 157, 2, 157, 4, 24, 2, 24, 2, 24, 2, 24, 1, 160, 2, 160, 2, 25, 5, 25, 7, 25, 7, 25, 9, 25, 9, 25, 5, 25, 7, 25, 6, 25, 8, 25, 5, 25, 7, 25, 6, 25, 8, 25, 5, 25, 7, 25, 3, 25, 5, 25, 5, 25, 7, 25, 7, 25, 9, 25, 9, 25, 5, 25, 7, 25, 6, 25, 8, 25, 5, 25, 7, 25, 6, 25, 8, 25, 5, 25, 7, 25, 3, 25, 5, 167, 1, 167, 3, 91, 1, 91, 3, 27, 1, 27, 2, 27, 3, 27, 4, 27, 2, 27, 3, 27, 4, 27, 5, 28, 4, 171, 1, 171, 3, 171, 2, 172, 1, 172, 1, 172, 1, 29, 2, 12, 2, 12, 4, 12, 4, 12, 5, 12, 7, 12, 6, 12, 9, 177, 1, 177, 3, 177, 4, 177, 4, 177, 6, 178, 1, 178, 3, 178, 1, 178, 3, 175, 1, 176, 3, 13, 3, 13, 5, 13, 2, 13, 2, 13, 2, 13, 4, 13, 5, 13, 6, 13, 3, 13, 5, 13, 4, 13, 5, 13, 7, 183, 1, 183, 3, 183, 4, 183, 4, 183, 6, 185, 1, 185, 3, 185, 3, 185, 1, 185, 3, 34, 2, 34, 2, 34, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 4, 16, 2, 16, 2, 16, 2, 16, 2, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 5, 16, 3, 16, 5, 16, 4, 40, 2],
  ruleActions: (rule, vals, locs, shared) => {
    const $ = vals;
    const $0 = vals.length - 1;
    switch (rule) {
      case 1:
        return ["program"];
      case 2:
        return ["program", ...$[$0]];
      case 3:
      case 57:
      case 109:
      case 149:
      case 153:
      case 173:
      case 193:
      case 202:
      case 249:
      case 299:
      case 310:
      case 324:
      case 348:
        return [$[$0]];
      case 4:
      case 110:
      case 174:
      case 194:
      case 203:
      case 311:
      case 325:
      case 349:
        return [...$[$0 - 2], $[$0]];
      case 5:
      case 59:
      case 156:
      case 312:
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
      case 44:
      case 45:
      case 48:
      case 49:
      case 50:
      case 51:
      case 52:
      case 53:
      case 54:
      case 55:
      case 62:
      case 63:
      case 85:
      case 86:
      case 87:
      case 88:
      case 89:
      case 114:
      case 119:
      case 120:
      case 121:
      case 122:
      case 125:
      case 128:
      case 129:
      case 130:
      case 131:
      case 132:
      case 144:
      case 170:
      case 171:
      case 177:
      case 181:
      case 182:
      case 183:
      case 184:
      case 198:
      case 199:
      case 200:
      case 216:
      case 217:
      case 231:
      case 233:
      case 260:
      case 297:
      case 313:
      case 314:
      case 315:
      case 329:
      case 331:
      case 333:
      case 353:
      case 356:
        return $[$0];
      case 46:
        return "undefined";
      case 47:
        return "null";
      case 56:
        return ["str", ...$[$0 - 1]];
      case 58:
      case 150:
      case 154:
      case 250:
        return [...$[$0 - 1], $[$0]];
      case 60:
      case 192:
      case 196:
      case 327:
      case 351:
        return $[$0 - 2];
      case 61:
        return "";
      case 64:
        return ["regex", $[$0 - 1]];
      case 65:
        return ["regex-index", $[$0 - 2], $[$0]];
      case 66:
        return ["regex-index", $[$0], null];
      case 67:
        return ["=", $[$0 - 2], $[$0]];
      case 68:
        return ["=", $[$0 - 3], $[$0]];
      case 69:
        return ["=", $[$0 - 4], $[$0 - 1]];
      case 70:
        return ["state", $[$0 - 2], $[$0]];
      case 71:
        return ["state", $[$0 - 3], $[$0]];
      case 72:
        return ["state", $[$0 - 4], $[$0 - 1]];
      case 73:
        return ["computed", $[$0 - 2], $[$0]];
      case 74:
        return ["computed", $[$0 - 3], $[$0]];
      case 75:
        return ["computed", $[$0 - 4], $[$0 - 1]];
      case 76:
        return ["readonly", $[$0 - 2], $[$0]];
      case 77:
        return ["readonly", $[$0 - 3], $[$0]];
      case 78:
        return ["readonly", $[$0 - 4], $[$0 - 1]];
      case 79:
        return ["effect", $[$0 - 2], $[$0]];
      case 80:
        return ["effect", $[$0 - 3], $[$0]];
      case 81:
        return ["effect", $[$0 - 4], $[$0 - 1]];
      case 82:
      case 83:
        return ["effect", null, $[$0]];
      case 84:
        return ["effect", null, $[$0 - 1]];
      case 90:
      case 99:
      case 137:
        return [".", $[$0 - 2], $[$0]];
      case 91:
      case 100:
      case 138:
        return ["?.", $[$0 - 2], $[$0]];
      case 92:
      case 94:
      case 101:
      case 139:
        return ["[]", $[$0 - 3], $[$0 - 1]];
      case 93:
      case 95:
      case 102:
      case 140:
        return ["[]", $[$0 - 5], $[$0 - 2]];
      case 96:
        return [$[$0 - 1][0], $[$0 - 3], ...$[$0 - 1].slice(1)];
      case 97:
        return ["optindex", $[$0 - 4], $[$0 - 1]];
      case 98:
        return ["optindex", $[$0 - 6], $[$0 - 2]];
      case 103:
        return ["object-comprehension", $[$0 - 8], $[$0 - 6], [["for-of", $[$0 - 4], $[$0 - 2], false]], []];
      case 104:
        return ["object-comprehension", $[$0 - 10], $[$0 - 8], [["for-of", $[$0 - 6], $[$0 - 4], false]], [$[$0 - 2]]];
      case 105:
        return ["object-comprehension", $[$0 - 9], $[$0 - 7], [["for-of", $[$0 - 4], $[$0 - 2], true]], []];
      case 106:
        return ["object-comprehension", $[$0 - 11], $[$0 - 9], [["for-of", $[$0 - 6], $[$0 - 4], true]], [$[$0 - 2]]];
      case 107:
        return ["object", ...$[$0 - 2]];
      case 108:
      case 151:
      case 172:
      case 191:
        return [];
      case 111:
      case 175:
      case 195:
      case 326:
      case 350:
        return [...$[$0 - 3], $[$0]];
      case 112:
      case 176:
      case 197:
      case 328:
      case 352:
        return [...$[$0 - 5], ...$[$0 - 2]];
      case 113:
        return [$[$0], $[$0], null];
      case 115:
        return [$[$0 - 2], $[$0], ":"];
      case 116:
        return [$[$0 - 4], $[$0 - 1], ":"];
      case 117:
        return [$[$0 - 2], $[$0], "="];
      case 118:
        return [$[$0 - 4], $[$0 - 1], "="];
      case 123:
        return ["dynamicKey", $[$0 - 1]];
      case 124:
        return ["[]", "this", $[$0 - 1]];
      case 126:
      case 127:
      case 185:
        return ["...", $[$0]];
      case 133:
      case 189:
        return ["super", ...$[$0]];
      case 134:
      case 135:
      case 136:
      case 187:
      case 190:
        return [$[$0 - 1], ...$[$0]];
      case 141:
        return ["array"];
      case 142:
        return ["array", ...$[$0 - 1]];
      case 143:
        return ["array", ...$[$0 - 2], ...$[$0 - 1]];
      case 145:
        return [...$[$0 - 2], ...$[$0]];
      case 146:
        return [...$[$0 - 3], ...$[$0]];
      case 147:
        return [...$[$0 - 2], ...$[$0 - 1]];
      case 148:
        return [...$[$0 - 5], ...$[$0 - 4], ...$[$0 - 2], ...$[$0 - 1]];
      case 152:
        return [...$[$0]];
      case 155:
        return null;
      case 157:
        return "..";
      case 158:
      case 201:
        return "...";
      case 159:
        return [$[$0 - 2], $[$0 - 3], $[$0 - 1]];
      case 160:
      case 375:
      case 377:
      case 378:
      case 392:
      case 394:
        return [$[$0 - 1], $[$0 - 2], $[$0]];
      case 161:
        return [$[$0], $[$0 - 1], null];
      case 162:
        return [$[$0 - 1], null, $[$0]];
      case 163:
        return [$[$0], null, null];
      case 164:
        return ["def", $[$0 - 4], $[$0 - 2], $[$0]];
      case 165:
        return ["def", $[$0 - 1], [], $[$0]];
      case 166:
      case 168:
        return [$[$0 - 1], $[$0 - 3], $[$0]];
      case 167:
      case 169:
        return [$[$0 - 1], [], $[$0]];
      case 178:
      case 298:
        return ["default", $[$0 - 2], $[$0]];
      case 179:
        return ["rest", $[$0]];
      case 180:
        return ["expansion"];
      case 186:
        return ["tagged-template", $[$0 - 1], $[$0]];
      case 188:
        return ["optcall", $[$0 - 2], ...$[$0]];
      case 204:
      case 205:
        return "this";
      case 206:
        return [".", "this", $[$0]];
      case 207:
        return [".", "super", $[$0]];
      case 208:
        return ["[]", "super", $[$0 - 1]];
      case 209:
        return ["[]", "super", $[$0 - 2]];
      case 210:
        return [".", "new", $[$0]];
      case 211:
        return [".", "import", $[$0]];
      case 212:
        return ["block"];
      case 213:
        return ["block", ...$[$0 - 1]];
      case 214:
        return $[$0 - 1].length === 1 ? $[$0 - 1][0] : ["block", ...$[$0 - 1]];
      case 215:
        return $[$0 - 2].length === 1 ? $[$0 - 2][0] : ["block", ...$[$0 - 2]];
      case 218:
        return ["return", $[$0]];
      case 219:
        return ["return", $[$0 - 1]];
      case 220:
        return ["return"];
      case 221:
        return ["throw", $[$0]];
      case 222:
        return ["throw", $[$0 - 1]];
      case 223:
        return ["yield"];
      case 224:
        return ["yield", $[$0]];
      case 225:
        return ["yield", $[$0 - 1]];
      case 226:
        return ["yield-from", $[$0]];
      case 227:
        return ["if", $[$0 - 1], $[$0]];
      case 228:
        return $[$0 - 4].length === 3 ? ["if", $[$0 - 4][1], $[$0 - 4][2], ["if", $[$0 - 1], $[$0]]] : [...$[$0 - 4], ["if", $[$0 - 1], $[$0]]];
      case 229:
        return ["unless", $[$0 - 1], $[$0]];
      case 230:
        return ["if", ["!", $[$0 - 3]], $[$0 - 2], $[$0]];
      case 232:
        return $[$0 - 2].length === 3 ? ["if", $[$0 - 2][1], $[$0 - 2][2], $[$0]] : [...$[$0 - 2], $[$0]];
      case 234:
      case 235:
        return ["if", $[$0], [$[$0 - 2]]];
      case 236:
      case 237:
        return ["unless", $[$0], [$[$0 - 2]]];
      case 238:
        return ["try", $[$0]];
      case 239:
        return ["try", $[$0 - 1], $[$0]];
      case 240:
        return ["try", $[$0 - 2], $[$0]];
      case 241:
        return ["try", $[$0 - 3], $[$0 - 2], $[$0]];
      case 242:
      case 243:
      case 358:
      case 361:
      case 363:
        return [$[$0 - 1], $[$0]];
      case 244:
        return [null, $[$0]];
      case 245:
        return ["switch", $[$0 - 3], $[$0 - 1], null];
      case 246:
        return ["switch", $[$0 - 5], $[$0 - 3], $[$0 - 1]];
      case 247:
        return ["switch", null, $[$0 - 1], null];
      case 248:
        return ["switch", null, $[$0 - 3], $[$0 - 1]];
      case 251:
        return ["when", $[$0 - 1], $[$0]];
      case 252:
        return ["when", $[$0 - 2], $[$0 - 1]];
      case 253:
        return ["while", $[$0]];
      case 254:
        return ["while", $[$0 - 2], $[$0]];
      case 255:
        return ["until", $[$0]];
      case 256:
        return ["until", $[$0 - 2], $[$0]];
      case 257:
        return $[$0 - 1].length === 2 ? [$[$0 - 1][0], $[$0 - 1][1], $[$0]] : [$[$0 - 1][0], $[$0 - 1][1], $[$0 - 1][2], $[$0]];
      case 258:
      case 259:
        return $[$0].length === 2 ? [$[$0][0], $[$0][1], [$[$0 - 1]]] : [$[$0][0], $[$0][1], $[$0][2], [$[$0 - 1]]];
      case 261:
        return ["loop", $[$0]];
      case 262:
        return ["loop", [$[$0]]];
      case 263:
        return ["for-in", $[$0 - 3], $[$0 - 1], null, null, $[$0]];
      case 264:
        return ["for-in", $[$0 - 5], $[$0 - 3], null, $[$0 - 1], $[$0]];
      case 265:
        return ["for-in", $[$0 - 5], $[$0 - 3], $[$0 - 1], null, $[$0]];
      case 266:
        return ["for-in", $[$0 - 7], $[$0 - 5], $[$0 - 1], $[$0 - 3], $[$0]];
      case 267:
        return ["for-in", $[$0 - 7], $[$0 - 5], $[$0 - 3], $[$0 - 1], $[$0]];
      case 268:
        return ["for-of", $[$0 - 3], $[$0 - 1], false, null, $[$0]];
      case 269:
        return ["for-of", $[$0 - 5], $[$0 - 3], false, $[$0 - 1], $[$0]];
      case 270:
        return ["for-of", $[$0 - 3], $[$0 - 1], true, null, $[$0]];
      case 271:
        return ["for-of", $[$0 - 5], $[$0 - 3], true, $[$0 - 1], $[$0]];
      case 272:
        return ["for-as", $[$0 - 3], $[$0 - 1], false, null, $[$0]];
      case 273:
        return ["for-as", $[$0 - 5], $[$0 - 3], false, $[$0 - 1], $[$0]];
      case 274:
      case 276:
        return ["for-as", $[$0 - 3], $[$0 - 1], true, null, $[$0]];
      case 275:
      case 277:
        return ["for-as", $[$0 - 5], $[$0 - 3], true, $[$0 - 1], $[$0]];
      case 278:
        return ["for-in", [], $[$0 - 1], null, null, $[$0]];
      case 279:
        return ["for-in", [], $[$0 - 3], $[$0 - 1], null, $[$0]];
      case 280:
        return ["comprehension", $[$0 - 4], [["for-in", $[$0 - 2], $[$0], null]], []];
      case 281:
        return ["comprehension", $[$0 - 6], [["for-in", $[$0 - 4], $[$0 - 2], null]], [$[$0]]];
      case 282:
        return ["comprehension", $[$0 - 6], [["for-in", $[$0 - 4], $[$0 - 2], $[$0]]], []];
      case 283:
        return ["comprehension", $[$0 - 8], [["for-in", $[$0 - 6], $[$0 - 4], $[$0]]], [$[$0 - 2]]];
      case 284:
        return ["comprehension", $[$0 - 8], [["for-in", $[$0 - 6], $[$0 - 4], $[$0 - 2]]], [$[$0]]];
      case 285:
        return ["comprehension", $[$0 - 4], [["for-of", $[$0 - 2], $[$0], false]], []];
      case 286:
        return ["comprehension", $[$0 - 6], [["for-of", $[$0 - 4], $[$0 - 2], false]], [$[$0]]];
      case 287:
        return ["comprehension", $[$0 - 5], [["for-of", $[$0 - 2], $[$0], true]], []];
      case 288:
        return ["comprehension", $[$0 - 7], [["for-of", $[$0 - 4], $[$0 - 2], true]], [$[$0]]];
      case 289:
        return ["comprehension", $[$0 - 4], [["for-as", $[$0 - 2], $[$0], false, null]], []];
      case 290:
        return ["comprehension", $[$0 - 6], [["for-as", $[$0 - 4], $[$0 - 2], false, null]], [$[$0]]];
      case 291:
        return ["comprehension", $[$0 - 5], [["for-as", $[$0 - 2], $[$0], true, null]], []];
      case 292:
        return ["comprehension", $[$0 - 7], [["for-as", $[$0 - 4], $[$0 - 2], true, null]], [$[$0]]];
      case 293:
        return ["comprehension", $[$0 - 4], [["for-as", $[$0 - 2], $[$0], true, null]], []];
      case 294:
        return ["comprehension", $[$0 - 6], [["for-as", $[$0 - 4], $[$0 - 2], true, null]], [$[$0]]];
      case 295:
        return ["comprehension", $[$0 - 2], [["for-in", [], $[$0], null]], []];
      case 296:
        return ["comprehension", $[$0 - 4], [["for-in", [], $[$0 - 2], $[$0]]], []];
      case 300:
      case 330:
      case 332:
      case 354:
      case 355:
      case 357:
        return [$[$0 - 2], $[$0]];
      case 301:
        return ["class", null, null];
      case 302:
        return ["class", null, null, $[$0]];
      case 303:
        return ["class", null, $[$0]];
      case 304:
        return ["class", null, $[$0 - 1], $[$0]];
      case 305:
        return ["class", $[$0], null];
      case 306:
        return ["class", $[$0 - 1], null, $[$0]];
      case 307:
        return ["class", $[$0 - 2], $[$0]];
      case 308:
        return ["class", $[$0 - 3], $[$0 - 1], $[$0]];
      case 309:
        return ["component", null, ["block", ...$[$0 - 1]]];
      case 316:
        return ["render", $[$0]];
      case 317:
      case 320:
        return ["import", "{}", $[$0]];
      case 318:
      case 319:
        return ["import", $[$0 - 2], $[$0]];
      case 321:
        return ["import", $[$0 - 4], $[$0]];
      case 322:
        return ["import", [$[$0 - 4], $[$0 - 2]], $[$0]];
      case 323:
        return ["import", [$[$0 - 7], $[$0 - 4]], $[$0]];
      case 334:
        return ["*", $[$0]];
      case 335:
        return ["export", "{}"];
      case 336:
        return ["export", $[$0 - 2]];
      case 337:
      case 338:
      case 339:
        return ["export", $[$0]];
      case 340:
        return ["export", ["=", $[$0 - 2], $[$0]]];
      case 341:
        return ["export", ["=", $[$0 - 3], $[$0]]];
      case 342:
        return ["export", ["=", $[$0 - 4], $[$0 - 1]]];
      case 343:
        return ["export-default", $[$0]];
      case 344:
        return ["export-default", $[$0 - 1]];
      case 345:
        return ["export-all", $[$0]];
      case 346:
        return ["export-from", "{}", $[$0]];
      case 347:
        return ["export-from", $[$0 - 4], $[$0]];
      case 359:
      case 360:
      case 362:
      case 397:
        return ["do-iife", $[$0]];
      case 364:
        return ["-", $[$0]];
      case 365:
        return ["+", $[$0]];
      case 366:
        return ["?", $[$0 - 1]];
      case 367:
        return ["await", $[$0]];
      case 368:
        return ["await", $[$0 - 1]];
      case 369:
        return ["--", $[$0], false];
      case 370:
        return ["++", $[$0], false];
      case 371:
        return ["--", $[$0 - 1], true];
      case 372:
        return ["++", $[$0 - 1], true];
      case 373:
        return ["+", $[$0 - 2], $[$0]];
      case 374:
        return ["-", $[$0 - 2], $[$0]];
      case 376:
        return ["**", $[$0 - 2], $[$0]];
      case 379:
        return ["&", $[$0 - 2], $[$0]];
      case 380:
        return ["^", $[$0 - 2], $[$0]];
      case 381:
        return ["|", $[$0 - 2], $[$0]];
      case 382:
      case 383:
      case 384:
      case 385:
      case 386:
      case 387:
        return ["control", $[$0 - 1], $[$0 - 2], $[$0]];
      case 388:
        return ["&&", $[$0 - 2], $[$0]];
      case 389:
        return ["||", $[$0 - 2], $[$0]];
      case 390:
        return ["??", $[$0 - 2], $[$0]];
      case 391:
        return ["!?", $[$0 - 2], $[$0]];
      case 393:
        return ["?:", $[$0 - 4], $[$0 - 2], $[$0]];
      case 395:
        return [$[$0 - 3], $[$0 - 4], $[$0 - 1]];
      case 396:
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
      action = parseTable[state]?.[symbol];
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
// src/components.js
var BIND_PREFIX = "__bind_";
var BIND_SUFFIX = "__";
var LIFECYCLE_HOOKS = new Set(["mounted", "unmounted", "updated"]);
function extractInputType(pairs) {
  for (const pair of pairs) {
    if (!Array.isArray(pair))
      continue;
    const key = pair[0] instanceof String ? pair[0].valueOf() : pair[0];
    const val = pair[1] instanceof String ? pair[1].valueOf() : pair[1];
    if (key === "type" && typeof val === "string") {
      return val.replace(/^["']|["']$/g, "");
    }
  }
  return null;
}
function getMemberName(target) {
  if (typeof target === "string")
    return target;
  if (Array.isArray(target) && target[0] === "." && target[1] === "this" && typeof target[2] === "string") {
    return target[2];
  }
  return null;
}
function installComponentSupport(CodeGenerator) {
  const proto = CodeGenerator.prototype;
  proto.isHtmlTag = function(name) {
    const tagPart = name.split("#")[0];
    return TEMPLATE_TAGS.has(tagPart.toLowerCase());
  };
  proto.isComponent = function(name) {
    if (!name || typeof name !== "string")
      return false;
    return /^[A-Z]/.test(name);
  };
  proto.collectTemplateClasses = function(sexpr) {
    const classes = [];
    let current = sexpr;
    while (Array.isArray(current) && current[0] === ".") {
      const prop = current[2];
      if (typeof prop === "string" || prop instanceof String) {
        classes.unshift(prop.valueOf());
      }
      current = current[1];
    }
    const tag = typeof current === "string" ? current : current instanceof String ? current.valueOf() : "div";
    return { tag, classes };
  };
  proto.transformComponentMembers = function(sexpr) {
    if (!Array.isArray(sexpr)) {
      if (typeof sexpr === "string" && this.reactiveMembers && this.reactiveMembers.has(sexpr)) {
        return [".", [".", "this", sexpr], "value"];
      }
      return sexpr;
    }
    if (sexpr[0] === "." && sexpr[1] === "this" && typeof sexpr[2] === "string") {
      const memberName = sexpr[2];
      if (this.reactiveMembers && this.reactiveMembers.has(memberName)) {
        return [".", sexpr, "value"];
      }
      return sexpr;
    }
    return sexpr.map((item) => this.transformComponentMembers(item));
  };
  proto.generateComponent = function(head, rest, context, sexpr) {
    const [, body] = rest;
    this.usesTemplates = true;
    this.usesReactivity = true;
    const statements = Array.isArray(body) && body[0] === "block" ? body.slice(1) : [];
    const stateVars = [];
    const derivedVars = [];
    const readonlyVars = [];
    const methods = [];
    const lifecycleHooks = [];
    const effects = [];
    let renderBlock = null;
    const memberNames = new Set;
    const reactiveMembers = new Set;
    for (const stmt of statements) {
      if (!Array.isArray(stmt))
        continue;
      const [op] = stmt;
      if (op === "state") {
        const varName = getMemberName(stmt[1]);
        if (varName) {
          stateVars.push({ name: varName, value: stmt[2] });
          memberNames.add(varName);
          reactiveMembers.add(varName);
        }
      } else if (op === "computed") {
        const varName = getMemberName(stmt[1]);
        if (varName) {
          derivedVars.push({ name: varName, expr: stmt[2] });
          memberNames.add(varName);
          reactiveMembers.add(varName);
        }
      } else if (op === "readonly") {
        const varName = getMemberName(stmt[1]);
        if (varName) {
          readonlyVars.push({ name: varName, value: stmt[2] });
          memberNames.add(varName);
        }
      } else if (op === "=") {
        const varName = getMemberName(stmt[1]);
        if (varName) {
          if (LIFECYCLE_HOOKS.has(varName)) {
            lifecycleHooks.push({ name: varName, value: stmt[2] });
          } else {
            const val = stmt[2];
            if (Array.isArray(val) && (val[0] === "->" || val[0] === "=>")) {
              methods.push({ name: varName, func: val });
              memberNames.add(varName);
            } else {
              stateVars.push({ name: varName, value: val });
              memberNames.add(varName);
              reactiveMembers.add(varName);
            }
          }
        }
      } else if (op === "effect") {
        effects.push(stmt);
      } else if (op === "render") {
        renderBlock = stmt;
      } else if (op === "object") {
        for (let i = 1;i < stmt.length; i++) {
          const pair = stmt[i];
          if (!Array.isArray(pair))
            continue;
          const [methodName, funcDef] = pair;
          if (typeof methodName === "string" && LIFECYCLE_HOOKS.has(methodName)) {
            lifecycleHooks.push({ name: methodName, value: funcDef });
          } else if (typeof methodName === "string") {
            methods.push({ name: methodName, func: funcDef });
            memberNames.add(methodName);
          }
        }
      }
    }
    const prevComponentMembers = this.componentMembers;
    const prevReactiveMembers = this.reactiveMembers;
    this.componentMembers = memberNames;
    this.reactiveMembers = reactiveMembers;
    const lines = [];
    let blockFactoriesCode = "";
    lines.push("class {");
    lines.push("  constructor(props = {}) {");
    lines.push("    this._parent = __currentComponent;");
    lines.push("    const __prevComponent = __currentComponent;");
    lines.push("    __currentComponent = this;");
    lines.push("");
    for (const { name, value } of readonlyVars) {
      const val = this.generateInComponent(value, "value");
      lines.push(`    this.${name} = props.${name} ?? ${val};`);
    }
    for (const { name, value } of stateVars) {
      const val = this.generateInComponent(value, "value");
      lines.push(`    this.${name} = isSignal(props.${name}) ? props.${name} : __state(props.${name} ?? ${val});`);
    }
    for (const { name, expr } of derivedVars) {
      const val = this.generateInComponent(expr, "value");
      lines.push(`    this.${name} = __computed(() => ${val});`);
    }
    for (const effect of effects) {
      const effectBody = effect[1];
      const effectCode = this.generateInComponent(effectBody, "value");
      lines.push(`    __effect(${effectCode});`);
    }
    lines.push("");
    lines.push("    __currentComponent = __prevComponent;");
    lines.push("  }");
    for (const { name, func } of methods) {
      if (Array.isArray(func) && (func[0] === "->" || func[0] === "=>")) {
        const [, params, methodBody] = func;
        const paramStr = Array.isArray(params) ? params.map((p) => this.formatParam(p)).join(", ") : "";
        const bodyCode = this.generateInComponent(methodBody, "value");
        lines.push(`  ${name}(${paramStr}) { return ${bodyCode}; }`);
      }
    }
    for (const { name, value } of lifecycleHooks) {
      if (Array.isArray(value) && (value[0] === "->" || value[0] === "=>")) {
        const [, , hookBody] = value;
        const bodyCode = this.generateInComponent(hookBody, "value");
        lines.push(`  ${name}() { return ${bodyCode}; }`);
      }
    }
    if (renderBlock) {
      const renderBody = renderBlock[1];
      const result = this.buildRender(renderBody);
      if (result.blockFactories.length > 0) {
        blockFactoriesCode = result.blockFactories.join(`

`) + `

`;
      }
      lines.push("  _create() {");
      for (const line of result.createLines) {
        lines.push(`    ${line}`);
      }
      lines.push(`    return ${result.rootVar};`);
      lines.push("  }");
      if (result.setupLines.length > 0) {
        lines.push("  _setup() {");
        for (const line of result.setupLines) {
          lines.push(`    ${line}`);
        }
        lines.push("  }");
      }
    }
    lines.push("  mount(target) {");
    lines.push('    if (typeof target === "string") target = document.querySelector(target);');
    lines.push("    this._target = target;");
    lines.push("    this._root = this._create();");
    lines.push("    target.appendChild(this._root);");
    lines.push("    if (this._setup) this._setup();");
    lines.push("    if (this.mounted) this.mounted();");
    lines.push("    return this;");
    lines.push("  }");
    lines.push("  unmount() {");
    lines.push("    if (this.unmounted) this.unmounted();");
    lines.push("    if (this._root && this._root.parentNode) {");
    lines.push("      this._root.parentNode.removeChild(this._root);");
    lines.push("    }");
    lines.push("  }");
    lines.push("}");
    this.componentMembers = prevComponentMembers;
    this.reactiveMembers = prevReactiveMembers;
    if (blockFactoriesCode) {
      return `(() => {
${blockFactoriesCode}return ${lines.join(`
`)};
})()`;
    }
    return lines.join(`
`);
  };
  proto.generateInComponent = function(sexpr, context) {
    if (typeof sexpr === "string" && this.reactiveMembers && this.reactiveMembers.has(sexpr)) {
      return `this.${sexpr}.value`;
    }
    if (Array.isArray(sexpr) && this.reactiveMembers) {
      const transformed = this.transformComponentMembers(sexpr);
      return this.generate(transformed, context);
    }
    return this.generate(sexpr, context);
  };
  proto.generateRender = function(head, rest, context, sexpr) {
    throw new Error("render blocks can only be used inside a component");
  };
  proto.buildRender = function(body) {
    this._emitElementCount = 0;
    this._emitTextCount = 0;
    this._emitBlockCount = 0;
    this._emitCreateLines = [];
    this._emitSetupLines = [];
    this._emitBlockFactories = [];
    const statements = Array.isArray(body) && body[0] === "block" ? body.slice(1) : [body];
    let rootVar;
    if (statements.length === 0) {
      rootVar = "null";
    } else if (statements.length === 1) {
      rootVar = this.emitNode(statements[0]);
    } else {
      rootVar = this.newElementVar("frag");
      this._emitCreateLines.push(`${rootVar} = document.createDocumentFragment();`);
      for (const stmt of statements) {
        const childVar = this.emitNode(stmt);
        this._emitCreateLines.push(`${rootVar}.appendChild(${childVar});`);
      }
    }
    return {
      createLines: this._emitCreateLines,
      setupLines: this._emitSetupLines,
      blockFactories: this._emitBlockFactories,
      rootVar
    };
  };
  proto.newBlockVar = function() {
    return `create_block_${this._emitBlockCount++}`;
  };
  proto.newElementVar = function(hint = "el") {
    return `this._${hint}${this._emitElementCount++}`;
  };
  proto.newTextVar = function() {
    return `this._t${this._emitTextCount++}`;
  };
  proto.emitNode = function(sexpr) {
    if (typeof sexpr === "string" || sexpr instanceof String) {
      const str = sexpr.valueOf();
      if (str.startsWith('"') || str.startsWith("'") || str.startsWith("`")) {
        const textVar2 = this.newTextVar();
        this._emitCreateLines.push(`${textVar2} = document.createTextNode(${str});`);
        return textVar2;
      }
      if (this.reactiveMembers && this.reactiveMembers.has(str)) {
        const textVar2 = this.newTextVar();
        this._emitCreateLines.push(`${textVar2} = document.createTextNode('');`);
        this._emitSetupLines.push(`__effect(() => { ${textVar2}.data = this.${str}.value; });`);
        return textVar2;
      }
      const elVar = this.newElementVar();
      this._emitCreateLines.push(`${elVar} = document.createElement('${str}');`);
      return elVar;
    }
    if (!Array.isArray(sexpr)) {
      const commentVar = this.newElementVar("c");
      this._emitCreateLines.push(`${commentVar} = document.createComment('unknown');`);
      return commentVar;
    }
    const [head, ...rest] = sexpr;
    const headStr = typeof head === "string" ? head : head instanceof String ? head.valueOf() : null;
    if (headStr && this.isComponent(headStr)) {
      return this.emitChildComponent(headStr, rest);
    }
    if (headStr && this.isHtmlTag(headStr)) {
      return this.emitTag(headStr, [], rest);
    }
    if (headStr === ".") {
      const [, obj, prop] = sexpr;
      if (obj === "this" && typeof prop === "string") {
        if (this.reactiveMembers && this.reactiveMembers.has(prop)) {
          const textVar3 = this.newTextVar();
          this._emitCreateLines.push(`${textVar3} = document.createTextNode('');`);
          this._emitSetupLines.push(`__effect(() => { ${textVar3}.data = this.${prop}.value; });`);
          return textVar3;
        }
        if (this.componentMembers && this.componentMembers.has(prop)) {
          const slotVar = this.newElementVar("slot");
          this._emitCreateLines.push(`${slotVar} = this.${prop} instanceof Node ? this.${prop} : (this.${prop} != null ? document.createTextNode(String(this.${prop})) : document.createComment(''));`);
          return slotVar;
        }
      }
      const { tag, classes } = this.collectTemplateClasses(sexpr);
      if (tag && this.isHtmlTag(tag)) {
        return this.emitTag(tag, classes, []);
      }
      const textVar2 = this.newTextVar();
      const exprCode2 = this.generateInComponent(sexpr, "value");
      this._emitCreateLines.push(`${textVar2} = document.createTextNode(String(${exprCode2}));`);
      return textVar2;
    }
    if (Array.isArray(head)) {
      if (Array.isArray(head[0]) && head[0][0] === "." && (head[0][2] === "__cx__" || head[0][2] instanceof String && head[0][2].valueOf() === "__cx__")) {
        const tag2 = typeof head[0][1] === "string" ? head[0][1] : head[0][1].valueOf();
        const classExprs = head.slice(1);
        return this.emitDynamicTag(tag2, classExprs, rest);
      }
      const { tag, classes } = this.collectTemplateClasses(head);
      if (tag && this.isHtmlTag(tag)) {
        if (classes.length === 1 && classes[0] === "__cx__") {
          return this.emitDynamicTag(tag, rest, []);
        }
        return this.emitTag(tag, classes, rest);
      }
    }
    if (headStr === "->" || headStr === "=>") {
      return this.emitBlock(rest[1]);
    }
    if (headStr === "if") {
      return this.emitConditional(sexpr);
    }
    if (headStr === "for" || headStr === "for-in" || headStr === "for-of" || headStr === "for-as") {
      return this.emitLoop(sexpr);
    }
    const textVar = this.newTextVar();
    const exprCode = this.generateInComponent(sexpr, "value");
    if (this.hasReactiveDeps(sexpr)) {
      this._emitCreateLines.push(`${textVar} = document.createTextNode('');`);
      this._emitSetupLines.push(`__effect(() => { ${textVar}.data = ${exprCode}; });`);
    } else {
      this._emitCreateLines.push(`${textVar} = document.createTextNode(String(${exprCode}));`);
    }
    return textVar;
  };
  proto.emitTag = function(tag, classes, args) {
    const elVar = this.newElementVar();
    this._emitCreateLines.push(`${elVar} = document.createElement('${tag}');`);
    if (classes.length > 0) {
      this._emitCreateLines.push(`${elVar}.className = '${classes.join(" ")}';`);
    }
    for (const arg of args) {
      if (Array.isArray(arg) && (arg[0] === "->" || arg[0] === "=>")) {
        const block = arg[2];
        if (Array.isArray(block) && block[0] === "block") {
          for (const child of block.slice(1)) {
            const childVar = this.emitNode(child);
            this._emitCreateLines.push(`${elVar}.appendChild(${childVar});`);
          }
        } else if (block) {
          const childVar = this.emitNode(block);
          this._emitCreateLines.push(`${elVar}.appendChild(${childVar});`);
        }
      } else if (Array.isArray(arg) && arg[0] === "object") {
        this.emitAttributes(elVar, arg);
      } else if (typeof arg === "string") {
        const textVar = this.newTextVar();
        if (arg.startsWith('"') || arg.startsWith("'") || arg.startsWith("`")) {
          this._emitCreateLines.push(`${textVar} = document.createTextNode(${arg});`);
        } else if (this.reactiveMembers && this.reactiveMembers.has(arg)) {
          this._emitCreateLines.push(`${textVar} = document.createTextNode('');`);
          this._emitSetupLines.push(`__effect(() => { ${textVar}.data = this.${arg}.value; });`);
        } else if (this.componentMembers && this.componentMembers.has(arg)) {
          this._emitCreateLines.push(`${textVar} = document.createTextNode(String(this.${arg}));`);
        } else {
          this._emitCreateLines.push(`${textVar} = document.createTextNode(String(${arg}));`);
        }
        this._emitCreateLines.push(`${elVar}.appendChild(${textVar});`);
      } else if (arg instanceof String) {
        const val = arg.valueOf();
        const textVar = this.newTextVar();
        if (val.startsWith('"') || val.startsWith("'") || val.startsWith("`")) {
          this._emitCreateLines.push(`${textVar} = document.createTextNode(${val});`);
        } else if (this.reactiveMembers && this.reactiveMembers.has(val)) {
          this._emitCreateLines.push(`${textVar} = document.createTextNode('');`);
          this._emitSetupLines.push(`__effect(() => { ${textVar}.data = this.${val}.value; });`);
        } else {
          this._emitCreateLines.push(`${textVar} = document.createTextNode(String(${val}));`);
        }
        this._emitCreateLines.push(`${elVar}.appendChild(${textVar});`);
      } else if (arg) {
        const childVar = this.emitNode(arg);
        this._emitCreateLines.push(`${elVar}.appendChild(${childVar});`);
      }
    }
    return elVar;
  };
  proto.emitDynamicTag = function(tag, classExprs, children) {
    const elVar = this.newElementVar();
    this._emitCreateLines.push(`${elVar} = document.createElement('${tag}');`);
    if (classExprs.length > 0) {
      const classArgs = classExprs.map((e) => this.generateInComponent(e, "value")).join(", ");
      const hasReactive = classExprs.some((e) => this.hasReactiveDeps(e));
      if (hasReactive) {
        this._emitSetupLines.push(`__effect(() => { ${elVar}.className = __cx__(${classArgs}); });`);
      } else {
        this._emitCreateLines.push(`${elVar}.className = __cx__(${classArgs});`);
      }
    }
    for (const arg of children) {
      const argHead = Array.isArray(arg) ? arg[0] instanceof String ? arg[0].valueOf() : arg[0] : null;
      if (argHead === "->" || argHead === "=>") {
        const block = arg[2];
        const blockHead = Array.isArray(block) ? block[0] instanceof String ? block[0].valueOf() : block[0] : null;
        if (blockHead === "block") {
          for (const child of block.slice(1)) {
            const childVar = this.emitNode(child);
            this._emitCreateLines.push(`${elVar}.appendChild(${childVar});`);
          }
        } else if (block) {
          const childVar = this.emitNode(block);
          this._emitCreateLines.push(`${elVar}.appendChild(${childVar});`);
        }
      } else if (Array.isArray(arg) && arg[0] === "object") {
        this.emitAttributes(elVar, arg);
      } else if (typeof arg === "string" || arg instanceof String) {
        const textVar = this.newTextVar();
        const argStr = arg.valueOf();
        if (argStr.startsWith('"') || argStr.startsWith("'") || argStr.startsWith("`")) {
          this._emitCreateLines.push(`${textVar} = document.createTextNode(${argStr});`);
        } else if (this.reactiveMembers && this.reactiveMembers.has(argStr)) {
          this._emitCreateLines.push(`${textVar} = document.createTextNode('');`);
          this._emitSetupLines.push(`__effect(() => { ${textVar}.data = this.${argStr}.value; });`);
        } else {
          this._emitCreateLines.push(`${textVar} = document.createTextNode(${this.generateInComponent(arg, "value")});`);
        }
        this._emitCreateLines.push(`${elVar}.appendChild(${textVar});`);
      } else {
        const childVar = this.emitNode(arg);
        this._emitCreateLines.push(`${elVar}.appendChild(${childVar});`);
      }
    }
    return elVar;
  };
  proto.emitAttributes = function(elVar, objExpr) {
    const inputType = extractInputType(objExpr.slice(1));
    for (let i = 1;i < objExpr.length; i++) {
      const [key, value] = objExpr[i];
      if (Array.isArray(key) && key[0] === "." && key[1] === "this") {
        const eventName = key[2];
        const handlerCode = this.generateInComponent(value, "value");
        this._emitCreateLines.push(`${elVar}.addEventListener('${eventName}', (e) => (${handlerCode})(e));`);
        continue;
      }
      if (typeof key === "string") {
        if (key.startsWith(BIND_PREFIX) && key.endsWith(BIND_SUFFIX)) {
          const prop = key.slice(BIND_PREFIX.length, -BIND_SUFFIX.length);
          const valueCode2 = this.generateInComponent(value, "value");
          let event, valueAccessor;
          if (prop === "checked") {
            event = "change";
            valueAccessor = "e.target.checked";
          } else {
            event = "input";
            valueAccessor = inputType === "number" || inputType === "range" ? "e.target.valueAsNumber" : "e.target.value";
          }
          this._emitSetupLines.push(`__effect(() => { ${elVar}.${prop} = ${valueCode2}; });`);
          this._emitCreateLines.push(`${elVar}.addEventListener('${event}', (e) => ${valueCode2} = ${valueAccessor});`);
          continue;
        }
        const valueCode = this.generateInComponent(value, "value");
        if (this.hasReactiveDeps(value)) {
          this._emitSetupLines.push(`__effect(() => { ${elVar}.setAttribute('${key}', ${valueCode}); });`);
        } else {
          this._emitCreateLines.push(`${elVar}.setAttribute('${key}', ${valueCode});`);
        }
      }
    }
  };
  proto.emitBlock = function(body) {
    if (!Array.isArray(body) || body[0] !== "block") {
      return this.emitNode(body);
    }
    const statements = body.slice(1);
    if (statements.length === 0) {
      const commentVar = this.newElementVar("empty");
      this._emitCreateLines.push(`${commentVar} = document.createComment('');`);
      return commentVar;
    }
    if (statements.length === 1) {
      return this.emitNode(statements[0]);
    }
    const fragVar = this.newElementVar("frag");
    this._emitCreateLines.push(`${fragVar} = document.createDocumentFragment();`);
    for (const stmt of statements) {
      const childVar = this.emitNode(stmt);
      this._emitCreateLines.push(`${fragVar}.appendChild(${childVar});`);
    }
    return fragVar;
  };
  proto.emitConditional = function(sexpr) {
    const [, condition, thenBlock, elseBlock] = sexpr;
    const anchorVar = this.newElementVar("anchor");
    this._emitCreateLines.push(`${anchorVar} = document.createComment('if');`);
    const condCode = this.generateInComponent(condition, "value");
    const thenBlockName = this.newBlockVar();
    this.emitConditionBranch(thenBlockName, thenBlock);
    let elseBlockName = null;
    if (elseBlock) {
      elseBlockName = this.newBlockVar();
      this.emitConditionBranch(elseBlockName, elseBlock);
    }
    const setupLines = [];
    setupLines.push(`// Conditional: ${thenBlockName}${elseBlockName ? " / " + elseBlockName : ""}`);
    setupLines.push(`{`);
    setupLines.push(`  const anchor = ${anchorVar};`);
    setupLines.push(`  let currentBlock = null;`);
    setupLines.push(`  let showing = null;`);
    setupLines.push(`  __effect(() => {`);
    setupLines.push(`    const show = !!(${condCode});`);
    setupLines.push(`    const want = show ? 'then' : ${elseBlock ? "'else'" : "null"};`);
    setupLines.push(`    if (want === showing) return;`);
    setupLines.push(``);
    setupLines.push(`    if (currentBlock) {`);
    setupLines.push(`      currentBlock.d(true);`);
    setupLines.push(`      currentBlock = null;`);
    setupLines.push(`    }`);
    setupLines.push(`    showing = want;`);
    setupLines.push(``);
    setupLines.push(`    if (want === 'then') {`);
    setupLines.push(`      currentBlock = ${thenBlockName}(this);`);
    setupLines.push(`      currentBlock.c();`);
    setupLines.push(`      currentBlock.m(anchor.parentNode, anchor.nextSibling);`);
    setupLines.push(`      currentBlock.p(this);`);
    setupLines.push(`    }`);
    if (elseBlock) {
      setupLines.push(`    if (want === 'else') {`);
      setupLines.push(`      currentBlock = ${elseBlockName}(this);`);
      setupLines.push(`      currentBlock.c();`);
      setupLines.push(`      currentBlock.m(anchor.parentNode, anchor.nextSibling);`);
      setupLines.push(`      currentBlock.p(this);`);
      setupLines.push(`    }`);
    }
    setupLines.push(`  });`);
    setupLines.push(`}`);
    this._emitSetupLines.push(setupLines.join(`
    `));
    return anchorVar;
  };
  proto.emitConditionBranch = function(blockName, block) {
    const savedCreateLines = this._emitCreateLines;
    const savedSetupLines = this._emitSetupLines;
    this._emitCreateLines = [];
    this._emitSetupLines = [];
    const rootVar = this.emitBlock(block);
    const createLines = this._emitCreateLines;
    const setupLines = this._emitSetupLines;
    this._emitCreateLines = savedCreateLines;
    this._emitSetupLines = savedSetupLines;
    const localizeVar = (line) => {
      return line.replace(/this\.(_el\d+|_t\d+|_anchor\d+|_frag\d+|_slot\d+|_c\d+|_inst\d+|_empty\d+)/g, "$1");
    };
    const factoryLines = [];
    factoryLines.push(`function ${blockName}(ctx) {`);
    const localVars = new Set;
    for (const line of createLines) {
      const match = line.match(/^this\.(_(?:el|t|anchor|frag|slot|c|inst|empty)\d+)\s*=/);
      if (match)
        localVars.add(match[1]);
    }
    if (localVars.size > 0) {
      factoryLines.push(`  let ${[...localVars].join(", ")};`);
    }
    const hasEffects = setupLines.length > 0;
    if (hasEffects) {
      factoryLines.push(`  let disposers = [];`);
    }
    factoryLines.push(`  return {`);
    factoryLines.push(`    c() {`);
    for (const line of createLines) {
      factoryLines.push(`      ${localizeVar(line)}`);
    }
    factoryLines.push(`    },`);
    factoryLines.push(`    m(target, anchor) {`);
    factoryLines.push(`      target.insertBefore(${localizeVar(rootVar)}, anchor);`);
    factoryLines.push(`    },`);
    factoryLines.push(`    p(ctx) {`);
    if (hasEffects) {
      factoryLines.push(`      disposers.forEach(d => d());`);
      factoryLines.push(`      disposers = [];`);
      for (const line of setupLines) {
        const localizedLine = localizeVar(line);
        const wrappedLine = localizedLine.replace(/__effect\(\(\) => \{/g, "disposers.push(__effect(() => {").replace(/\}\);$/g, "}));");
        factoryLines.push(`      ${wrappedLine}`);
      }
    }
    factoryLines.push(`    },`);
    factoryLines.push(`    d(detaching) {`);
    if (hasEffects) {
      factoryLines.push(`      disposers.forEach(d => d());`);
    }
    factoryLines.push(`      if (detaching) ${localizeVar(rootVar)}.remove();`);
    factoryLines.push(`    }`);
    factoryLines.push(`  };`);
    factoryLines.push(`}`);
    this._emitBlockFactories.push(factoryLines.join(`
`));
  };
  proto.emitLoop = function(sexpr) {
    const [head, vars, collection, guard, step, body] = sexpr;
    const blockName = this.newBlockVar();
    const anchorVar = this.newElementVar("anchor");
    this._emitCreateLines.push(`${anchorVar} = document.createComment('for');`);
    const varNames = Array.isArray(vars) ? vars : [vars];
    const itemVar = varNames[0];
    const indexVar = varNames[1] || "i";
    const collectionCode = this.generateInComponent(collection, "value");
    let keyExpr = itemVar;
    if (Array.isArray(body) && body[0] === "block" && body.length > 1) {
      const firstChild = body[1];
      if (Array.isArray(firstChild)) {
        for (const arg of firstChild) {
          if (Array.isArray(arg) && arg[0] === "object") {
            for (let i = 1;i < arg.length; i++) {
              const [k, v] = arg[i];
              if (k === "key") {
                keyExpr = this.generate(v, "value");
                break;
              }
            }
          }
          if (keyExpr !== itemVar)
            break;
        }
      }
    }
    const savedCreateLines = this._emitCreateLines;
    const savedSetupLines = this._emitSetupLines;
    this._emitCreateLines = [];
    this._emitSetupLines = [];
    const itemNode = this.emitBlock(body);
    const itemCreateLines = this._emitCreateLines;
    const itemSetupLines = this._emitSetupLines;
    this._emitCreateLines = savedCreateLines;
    this._emitSetupLines = savedSetupLines;
    const localizeVar = (line) => {
      return line.replace(/this\.(_el\d+|_t\d+|_anchor\d+|_frag\d+|_slot\d+|_c\d+|_inst\d+|_empty\d+)/g, "$1");
    };
    const factoryLines = [];
    factoryLines.push(`function ${blockName}(ctx, ${itemVar}, ${indexVar}) {`);
    const localVars = new Set;
    for (const line of itemCreateLines) {
      const match = line.match(/^this\.(_(?:el|t|anchor|frag|slot|c|inst|empty)\d+)\s*=/);
      if (match)
        localVars.add(match[1]);
    }
    if (localVars.size > 0) {
      factoryLines.push(`  let ${[...localVars].join(", ")};`);
    }
    const hasEffects = itemSetupLines.length > 0;
    if (hasEffects) {
      factoryLines.push(`  let disposers = [];`);
    }
    factoryLines.push(`  return {`);
    factoryLines.push(`    c() {`);
    for (const line of itemCreateLines) {
      factoryLines.push(`      ${localizeVar(line)}`);
    }
    factoryLines.push(`    },`);
    factoryLines.push(`    m(target, anchor) {`);
    factoryLines.push(`      target.insertBefore(${localizeVar(itemNode)}, anchor);`);
    factoryLines.push(`    },`);
    factoryLines.push(`    p(ctx, ${itemVar}, ${indexVar}) {`);
    if (hasEffects) {
      factoryLines.push(`      disposers.forEach(d => d());`);
      factoryLines.push(`      disposers = [];`);
      for (const line of itemSetupLines) {
        const localizedLine = localizeVar(line);
        const wrappedLine = localizedLine.replace(/__effect\(\(\) => \{/g, "disposers.push(__effect(() => {").replace(/\}\);$/g, "}));");
        factoryLines.push(`      ${wrappedLine}`);
      }
    }
    factoryLines.push(`    },`);
    factoryLines.push(`    d(detaching) {`);
    if (hasEffects) {
      factoryLines.push(`      disposers.forEach(d => d());`);
    }
    factoryLines.push(`      if (detaching) ${localizeVar(itemNode)}.remove();`);
    factoryLines.push(`    }`);
    factoryLines.push(`  };`);
    factoryLines.push(`}`);
    this._emitBlockFactories.push(factoryLines.join(`
`));
    const setupLines = [];
    setupLines.push(`// Loop: ${blockName}`);
    setupLines.push(`{`);
    setupLines.push(`  const anchor = ${anchorVar};`);
    setupLines.push(`  const map = new Map();`);
    setupLines.push(`  __effect(() => {`);
    setupLines.push(`    const items = ${collectionCode};`);
    setupLines.push(`    const parent = anchor.parentNode;`);
    setupLines.push(`    const newMap = new Map();`);
    setupLines.push(``);
    setupLines.push(`    for (let ${indexVar} = 0; ${indexVar} < items.length; ${indexVar}++) {`);
    setupLines.push(`      const ${itemVar} = items[${indexVar}];`);
    setupLines.push(`      const key = ${keyExpr};`);
    setupLines.push(`      let block = map.get(key);`);
    setupLines.push(`      if (block) {`);
    setupLines.push(`        block.p(this, ${itemVar}, ${indexVar});`);
    setupLines.push(`      } else {`);
    setupLines.push(`        block = ${blockName}(this, ${itemVar}, ${indexVar});`);
    setupLines.push(`        block.c();`);
    setupLines.push(`        block.m(parent, anchor);`);
    setupLines.push(`        block.p(this, ${itemVar}, ${indexVar});`);
    setupLines.push(`      }`);
    setupLines.push(`      newMap.set(key, block);`);
    setupLines.push(`    }`);
    setupLines.push(``);
    setupLines.push(`    for (const [key, block] of map) {`);
    setupLines.push(`      if (!newMap.has(key)) block.d(true);`);
    setupLines.push(`    }`);
    setupLines.push(``);
    setupLines.push(`    map.clear();`);
    setupLines.push(`    for (const [k, v] of newMap) map.set(k, v);`);
    setupLines.push(`  });`);
    setupLines.push(`}`);
    this._emitSetupLines.push(setupLines.join(`
    `));
    return anchorVar;
  };
  proto.emitChildComponent = function(componentName, args) {
    const instVar = this.newElementVar("inst");
    const elVar = this.newElementVar("el");
    const { propsCode, childrenSetupLines } = this.buildComponentProps(args);
    this._emitCreateLines.push(`${instVar} = new ${componentName}(${propsCode});`);
    this._emitCreateLines.push(`${elVar} = ${instVar}._create();`);
    this._emitSetupLines.push(`if (${instVar}._setup) ${instVar}._setup();`);
    for (const line of childrenSetupLines) {
      this._emitSetupLines.push(line);
    }
    return elVar;
  };
  proto.buildComponentProps = function(args) {
    const props = [];
    let childrenVar = null;
    const childrenSetupLines = [];
    for (const arg of args) {
      if (Array.isArray(arg) && arg[0] === "object") {
        for (let i = 1;i < arg.length; i++) {
          const [key, value] = arg[i];
          if (typeof key === "string") {
            const valueCode = this.generateInComponent(value, "value");
            props.push(`${key}: ${valueCode}`);
          }
        }
      } else if (Array.isArray(arg) && (arg[0] === "->" || arg[0] === "=>")) {
        const block = arg[2];
        if (block) {
          const savedCreateLines = this._emitCreateLines;
          const savedSetupLines = this._emitSetupLines;
          this._emitCreateLines = [];
          this._emitSetupLines = [];
          childrenVar = this.emitBlock(block);
          const childCreateLines = this._emitCreateLines;
          const childSetupLinesCopy = this._emitSetupLines;
          this._emitCreateLines = savedCreateLines;
          this._emitSetupLines = savedSetupLines;
          for (const line of childCreateLines) {
            this._emitCreateLines.push(line);
          }
          childrenSetupLines.push(...childSetupLinesCopy);
          props.push(`children: ${childrenVar}`);
        }
      }
    }
    const propsCode = props.length > 0 ? `{ ${props.join(", ")} }` : "{}";
    return { propsCode, childrenSetupLines };
  };
  proto.hasReactiveDeps = function(sexpr) {
    if (!this.reactiveMembers || this.reactiveMembers.size === 0)
      return false;
    if (typeof sexpr === "string") {
      return this.reactiveMembers.has(sexpr);
    }
    if (!Array.isArray(sexpr))
      return false;
    if (sexpr[0] === "." && sexpr[1] === "this" && typeof sexpr[2] === "string") {
      return this.reactiveMembers.has(sexpr[2]);
    }
    for (const child of sexpr) {
      if (this.hasReactiveDeps(child))
        return true;
    }
    return false;
  };
  proto.getComponentRuntime = function() {
    return `
// ============================================================================
// Rip Component Runtime
// ============================================================================

function isSignal(v) {
  return v != null && typeof v === 'object' && typeof v.read === 'function';
}

let __currentComponent = null;

function setContext(key, value) {
  if (!__currentComponent) throw new Error('setContext must be called during component initialization');
  if (!__currentComponent._context) __currentComponent._context = new Map();
  __currentComponent._context.set(key, value);
}

function getContext(key) {
  let component = __currentComponent;
  while (component) {
    if (component._context && component._context.has(key)) return component._context.get(key);
    component = component._parent;
  }
  return undefined;
}

function hasContext(key) {
  let component = __currentComponent;
  while (component) {
    if (component._context && component._context.has(key)) return true;
    component = component._parent;
  }
  return false;
}

function __cx__(...args) {
  return args.filter(Boolean).join(' ');
}

`;
  };
}

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
    component: "generateComponent",
    render: "generateRender",
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
    if (this.usesTemplates) {
      code += this.getComponentRuntime();
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
installComponentSupport(CodeGenerator);
function compile(source, options = {}) {
  return new Compiler(options).compile(source);
}
function compileToJS(source, options = {}) {
  return new Compiler(options).compileToJS(source);
}
// src/browser.js
var VERSION = "3.1.0";
var BUILD_DATE = "2026-02-08@09:46:39GMT";
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
