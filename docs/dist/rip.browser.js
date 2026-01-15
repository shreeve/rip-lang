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
var BALANCED_PAIRS;
var BOM;
var BOOL;
var CALLABLE;
var CALL_CLOSERS;
var CODE;
var COMMENT;
var COMPARABLE_LEFT_SIDE;
var COMPARE;
var COMPOUND_ASSIGN;
var CONTROL_IN_IMPLICIT;
var DISCARDED;
var EXPRESSION_CLOSE;
var EXPRESSION_END;
var EXPRESSION_START;
var HERECOMMENT_ILLEGAL;
var HEREDOC_DOUBLE;
var HEREDOC_INDENT;
var HEREDOC_SINGLE;
var HEREGEX;
var HEREGEX_COMMENT;
var HERE_JSTOKEN;
var IDENTIFIER;
var IMPLICIT_CALL;
var IMPLICIT_END;
var IMPLICIT_FUNC;
var IMPLICIT_UNSPACED_CALL;
var INDENTABLE_CLOSERS;
var INDEXABLE;
var INVERSES;
var JSTOKEN;
var JS_KEYWORDS;
var LINEBREAKS;
var LINE_BREAK;
var LINE_CONTINUER;
var MATH;
var MULTI_DENT;
var NOT_REGEX;
var NUMBER;
var OPERATOR;
var POSSIBLY_DIVISION;
var REGEX;
var REGEX_FLAGS;
var REGEX_ILLEGAL;
var REGEX_INVALID_ESCAPE;
var RELATION;
var RESERVED;
var RIP_ALIASES;
var RIP_ALIAS_MAP;
var RIP_KEYWORDS;
var Rewriter;
var SHIFT;
var SINGLE_CLOSERS;
var SINGLE_LINERS;
var STRICT_PROSCRIBED;
var STRING_DOUBLE;
var STRING_INVALID_ESCAPE;
var STRING_SINGLE;
var STRING_START;
var TRAILING_SPACES;
var UNARY;
var UNARY_MATH;
var UNFINISHED;
var VALID_FLAGS;
var WHITESPACE;
var addTokenData;
var generate;
var isForFrom;
var k;
var key;
var left;
var len;
var moveComments;
var right;
var indexOf = [].indexOf;
var slice = [].slice;
var hasProp = {}.hasOwnProperty;
var repeat = function(str, n) {
  var res = "";
  while (n > 0) {
    if (n & 1)
      res += str;
    n >>>= 1;
    str += str;
  }
  return res;
};
var count = function(string, substr) {
  var num = 0, pos = 0;
  if (!substr.length)
    return 1 / 0;
  while (pos = 1 + string.indexOf(substr, pos))
    num++;
  return num;
};
var extend = function(object, properties) {
  for (var key2 in properties) {
    object[key2] = properties[key2];
  }
  return object;
};
var merge = function(options, overrides) {
  return extend(extend({}, options), overrides);
};
var flatten = function(array) {
  return array.flat(Infinity);
};
var extractAllCommentTokens = function(tokens) {
  var allCommentsObj = {}, sortedKeys, results = [];
  for (var i = 0;i < tokens.length; i++) {
    var token = tokens[i];
    if (token.comments) {
      for (var j = 0;j < token.comments.length; j++) {
        var comment = token.comments[j];
        var commentKey = comment.locationData.range[0];
        allCommentsObj[commentKey] = comment;
      }
    }
  }
  sortedKeys = Object.keys(allCommentsObj).sort((a, b) => a - b);
  for (var k2 = 0;k2 < sortedKeys.length; k2++) {
    results.push(allCommentsObj[sortedKeys[k2]]);
  }
  return results;
};
var attachCommentsToNode = function(comments, node) {
  if (!comments || comments.length === 0)
    return;
  if (!node.comments)
    node.comments = [];
  node.comments.push(...comments);
};
var parseNumber = function(string) {
  if (string == null)
    return 0 / 0;
  var base = null;
  switch (string.charAt(1)) {
    case "b":
      base = 2;
      break;
    case "o":
      base = 8;
      break;
    case "x":
      base = 16;
      break;
  }
  if (base != null) {
    return parseInt(string.slice(2).replace(/_/g, ""), base);
  } else {
    return parseFloat(string.replace(/_/g, ""));
  }
};
var syntaxErrorToString = function() {
  if (!(this.code && this.location)) {
    return Error.prototype.toString.call(this);
  }
  var { first_line, first_column, last_line, last_column } = this.location;
  if (last_line == null)
    last_line = first_line;
  if (last_column == null)
    last_column = first_column;
  var filename = this.filename || "[stdin]";
  if (filename.startsWith("<anonymous"))
    filename = "[stdin]";
  var codeLine = this.code.split(`
`)[first_line];
  var start = first_column;
  var end = first_line === last_line ? last_column + 1 : codeLine.length;
  var marker = codeLine.slice(0, start).replace(/[^\s]/g, " ") + repeat("^", end - start);
  var colorsEnabled = typeof process !== "undefined" && process !== null && process.stdout?.isTTY && !process.env?.NODE_DISABLE_COLORS;
  if (this.colorful != null ? this.colorful : colorsEnabled) {
    var colorize = (str) => `\x1B[1;31m${str}\x1B[0m`;
    codeLine = codeLine.slice(0, start) + colorize(codeLine.slice(start, end)) + codeLine.slice(end);
    marker = colorize(marker);
  }
  return `${filename}:${first_line + 1}:${first_column + 1}: error: ${this.message}
${codeLine}
${marker}`;
};
var throwSyntaxError = function(message, location) {
  var error = new SyntaxError(message);
  error.location = location;
  error.toString = syntaxErrorToString;
  error.stack = error.toString();
  throw error;
};
var UNICODE_CODE_POINT_ESCAPE = /(\\\\)|\\u\{([\da-fA-F]+)\}/g;
var unicodeCodePointToUnicodeEscapes = function(codePoint) {
  var toUnicodeEscape = function(val) {
    var str = val.toString(16);
    return `\\u${repeat("0", 4 - str.length)}${str}`;
  };
  if (codePoint < 65536) {
    return toUnicodeEscape(codePoint);
  }
  var high = Math.floor((codePoint - 65536) / 1024) + 55296;
  var low = (codePoint - 65536) % 1024 + 56320;
  return `${toUnicodeEscape(high)}${toUnicodeEscape(low)}`;
};
var replaceUnicodeCodePointEscapes = function(str, { flags, error, delimiter = "" } = {}) {
  var shouldReplace = flags != null && indexOf.call(flags, "u") < 0;
  return str.replace(UNICODE_CODE_POINT_ESCAPE, function(match, escapedBackslash, codePointHex, offset) {
    if (escapedBackslash)
      return escapedBackslash;
    var codePointDecimal = parseInt(codePointHex, 16);
    if (codePointDecimal > 1114111) {
      error("unicode code point escapes greater than \\u{10ffff} are not allowed", {
        offset: offset + delimiter.length,
        length: codePointHex.length + 4
      });
    }
    if (!shouldReplace)
      return match;
    return unicodeCodePointToUnicodeEscapes(codePointDecimal);
  });
};
var Lexer = class Lexer2 {
  constructor() {
    this.error = this.error.bind(this);
  }
  tokenize(code, opts = {}) {
    var consumed, end, i, ref;
    this.indent = 0;
    this.baseIndent = 0;
    this.overIndent = 0;
    this.outdebt = 0;
    this.indents = [];
    this.indentLiteral = "";
    this.ends = [];
    this.tokens = [];
    this.seenFor = false;
    this.seenImport = false;
    this.seenExport = false;
    this.importSpecifierList = false;
    this.exportSpecifierList = false;
    this.inRender = false;
    this.renderIndent = 0;
    this.chunkLine = opts.line || 0;
    this.chunkColumn = opts.column || 0;
    this.chunkOffset = opts.offset || 0;
    this.locTweaks = opts.locTweaks || {};
    code = this.clean(code);
    i = 0;
    while (this.chunk = code.slice(i)) {
      consumed = this.identifierToken() || this.commentToken() || this.whitespaceToken() || this.lineToken() || this.stringToken() || this.numberToken() || this.regexToken() || this.jsToken() || this.literalToken();
      [this.chunkLine, this.chunkColumn, this.chunkOffset] = this.getLineAndColumnFromChunk(consumed);
      i += consumed;
      if (opts.untilBalanced && this.ends.length === 0) {
        return {
          tokens: this.tokens,
          index: i
        };
      }
    }
    this.closeIndentation();
    if (end = this.ends.pop()) {
      this.error(`missing ${end.tag}`, ((ref = end.origin) != null ? ref : end)[2]);
    }
    if (opts.rewrite === false) {
      return this.tokens;
    }
    return new Rewriter().rewrite(this.tokens);
  }
  clean(code) {
    var base, thusFar;
    thusFar = 0;
    if (code.charCodeAt(0) === BOM) {
      code = code.slice(1);
      this.locTweaks[0] = 1;
      thusFar += 1;
    }
    if (WHITESPACE.test(code)) {
      code = `
${code}`;
      this.chunkLine--;
      if ((base = this.locTweaks)[0] == null) {
        base[0] = 0;
      }
      this.locTweaks[0] -= 1;
    }
    return code.replace(/\r/g, (match, offset) => {
      this.locTweaks[thusFar + offset] = 1;
      return "";
    }).replace(TRAILING_SPACES, "");
  }
  identifierToken() {
    var afterNot, alias, colon, colonOffset, colonToken, id, idLength, input, match, poppedToken, prev, prevprev, ref, ref1, ref10, ref11, ref12, ref2, ref3, ref4, ref5, ref6, ref7, ref8, ref9, regExSuper, sup, tag, tagToken, tokenData;
    if (/^~[=>]/.test(this.chunk) || /^=!/.test(this.chunk)) {
      return 0;
    }
    if (!(match = IDENTIFIER.exec(this.chunk))) {
      return 0;
    }
    [input, id, colon] = match;
    idLength = id.length;
    poppedToken = undefined;
    if (id === "own" && this.tag() === "FOR") {
      this.token("OWN", id);
      return id.length;
    }
    if (id === "from" && this.tag() === "YIELD") {
      this.token("FROM", id);
      return id.length;
    }
    if (id === "as" && this.seenImport) {
      if (this.value() === "*") {
        this.tokens[this.tokens.length - 1][0] = "IMPORT_ALL";
      } else if (ref = this.value(true), indexOf.call(RIP_KEYWORDS, ref) >= 0) {
        prev = this.prev();
        [prev[0], prev[1]] = ["IDENTIFIER", this.value(true)];
      }
      if ((ref1 = this.tag()) === "DEFAULT" || ref1 === "IMPORT_ALL" || ref1 === "IDENTIFIER") {
        this.token("AS", id);
        return id.length;
      }
    }
    if (id === "as" && this.seenExport) {
      if ((ref2 = this.tag()) === "IDENTIFIER" || ref2 === "DEFAULT") {
        this.token("AS", id);
        return id.length;
      }
      if (ref3 = this.value(true), indexOf.call(RIP_KEYWORDS, ref3) >= 0) {
        prev = this.prev();
        [prev[0], prev[1]] = ["IDENTIFIER", this.value(true)];
        this.token("AS", id);
        return id.length;
      }
    }
    if (id === "default" && this.seenExport && ((ref4 = this.tag()) === "EXPORT" || ref4 === "AS")) {
      this.token("DEFAULT", id);
      return id.length;
    }
    if (id === "do" && (regExSuper = /^(\s*super)(?!\(\))/.exec(this.chunk.slice(3)))) {
      this.token("SUPER", "super");
      this.token("CALL_START", "(");
      this.token("CALL_END", ")");
      [input, sup] = regExSuper;
      return sup.length + 3;
    }
    prev = this.prev();
    const isHashProperty = this.inRender && prev != null && prev[0] === "#" && !prev.spaced;
    tag = colon || prev != null && ((ref5 = prev[0]) === "." || ref5 === "?." || ref5 === "::" || ref5 === "?::" || !prev.spaced && prev[0] === "@") || isHashProperty ? "PROPERTY" : "IDENTIFIER";
    tokenData = {};
    if (tag === "IDENTIFIER" && (indexOf.call(JS_KEYWORDS, id) >= 0 || indexOf.call(RIP_KEYWORDS, id) >= 0) && !(this.exportSpecifierList && indexOf.call(RIP_KEYWORDS, id) >= 0)) {
      tag = id.toUpperCase();
      if (tag === "WHEN" && (ref6 = this.tag(), indexOf.call(LINE_BREAK, ref6) >= 0)) {
        tag = "LEADING_WHEN";
      } else if (tag === "FOR") {
        this.seenFor = {
          endsLength: this.ends.length
        };
      } else if (tag === "UNLESS") {} else if (tag === "IMPORT") {
        this.seenImport = true;
      } else if (tag === "EXPORT") {
        this.seenExport = true;
      } else if (tag === "RENDER") {
        this.inRender = true;
        this.renderIndent = this.indent;
      } else if (indexOf.call(UNARY, tag) >= 0) {
        tag = "UNARY";
      } else if (indexOf.call(RELATION, tag) >= 0) {
        if (tag !== "INSTANCEOF" && this.seenFor) {
          tag = "FOR" + tag;
          this.seenFor = false;
        } else {
          tag = "RELATION";
          if (this.value() === "!") {
            poppedToken = this.tokens.pop();
            tokenData.invert = (ref7 = (ref8 = poppedToken.data) != null ? ref8.original : undefined) != null ? ref7 : poppedToken[1];
          }
        }
      }
    } else if (tag === "IDENTIFIER" && this.seenFor && id === "from" && isForFrom(prev)) {
      tag = "FORFROM";
      this.seenFor = false;
    } else if (tag === "PROPERTY" && prev) {
      if (prev.spaced && (ref9 = prev[0], indexOf.call(CALLABLE, ref9) >= 0) && /^[gs]et$/.test(prev[1]) && this.tokens.length > 1 && ((ref10 = this.tokens[this.tokens.length - 2][0]) !== "." && ref10 !== "?." && ref10 !== "@")) {
        this.error(`'${prev[1]}' cannot be used as a keyword, or as a function call without parentheses`, prev[2]);
      } else if (prev[0] === "." && this.tokens.length > 1 && (prevprev = this.tokens[this.tokens.length - 2])[0] === "UNARY" && prevprev[1] === "new") {
        prevprev[0] = "NEW_TARGET";
      } else if (prev[0] === "." && this.tokens.length > 1 && (prevprev = this.tokens[this.tokens.length - 2])[0] === "IMPORT" && prevprev[1] === "import") {
        this.seenImport = false;
        prevprev[0] = "IMPORT_META";
      } else if (this.tokens.length > 2) {
        prevprev = this.tokens[this.tokens.length - 2];
        if (((ref11 = prev[0]) === "@" || ref11 === "THIS") && prevprev && prevprev.spaced && /^[gs]et$/.test(prevprev[1]) && ((ref12 = this.tokens[this.tokens.length - 3][0]) !== "." && ref12 !== "?." && ref12 !== "@")) {
          this.error(`'${prevprev[1]}' cannot be used as a keyword, or as a function call without parentheses`, prevprev[2]);
        }
      }
    }
    if (tag === "IDENTIFIER" && indexOf.call(RESERVED, id) >= 0) {
      this.error(`reserved word '${id}'`, {
        length: id.length
      });
    }
    if (!(tag === "PROPERTY" || this.exportSpecifierList || this.importSpecifierList)) {
      if (id === "is" && this.chunk.slice(idLength, idLength + 4) === " not") {
        afterNot = this.chunk.slice(idLength + 4).trim();
        if (!afterNot.match(/^(false|true)\s+(is|isnt|==|!=)/)) {
          id = "isnt";
          idLength += 4;
        }
      }
      if (indexOf.call(RIP_ALIASES, id) >= 0) {
        alias = id;
        id = RIP_ALIAS_MAP[id];
        tokenData.original = alias;
      }
      tag = function() {
        switch (id) {
          case "!":
            return "UNARY";
          case "==":
          case "!=":
            return "COMPARE";
          case "true":
          case "false":
            return "BOOL";
          case "break":
          case "continue":
          case "debugger":
            return "STATEMENT";
          case "&&":
          case "||":
            return id;
          default:
            return tag;
        }
      }();
    }
    const originalIdLength = idLength;
    if (id.length > 1 && id.endsWith("!")) {
      tokenData.await = true;
      id = id.slice(0, -1);
    }
    tagToken = this.token(tag, id, {
      length: originalIdLength,
      data: tokenData
    });
    if (alias) {
      tagToken.origin = [tag, alias, tagToken[2]];
    }
    if (poppedToken) {
      [tagToken[2].first_line, tagToken[2].first_column, tagToken[2].range[0]] = [poppedToken[2].first_line, poppedToken[2].first_column, poppedToken[2].range[0]];
    }
    if (colon) {
      colonOffset = input.lastIndexOf(":");
      colonToken = this.token(":", ":", {
        offset: colonOffset
      });
    }
    if (colon) {
      return originalIdLength + colon.length;
    } else {
      return originalIdLength;
    }
  }
  commentToken(chunk = this.chunk, { heregex, returnCommentTokens = false, offsetInChunk = 0 } = {}) {
    var commentAttachment, commentAttachments, commentWithSurroundingWhitespace, content, contents, getIndentSize, hasSeenFirstCommentLine, hereComment, hereLeadingWhitespace, hereTrailingWhitespace, i, indentSize, leadingNewline, leadingNewlineOffset, leadingNewlines, leadingWhitespace, length, lineComment, match, matchIllegal, noIndent, nonInitial, placeholderToken, precededByBlankLine, precedingNonCommentLines, prev;
    if (this.inRender && chunk[0] === "#" && /^#[a-zA-Z_$]/.test(chunk)) {
      return 0;
    }
    if (!(match = chunk.match(COMMENT))) {
      return 0;
    }
    [commentWithSurroundingWhitespace, hereLeadingWhitespace, hereComment, hereTrailingWhitespace, lineComment] = match;
    contents = null;
    leadingNewline = /^\s*\n+\s*#/.test(commentWithSurroundingWhitespace);
    if (hereComment) {
      matchIllegal = HERECOMMENT_ILLEGAL.exec(hereComment);
      if (matchIllegal) {
        this.error(`block comments cannot contain ${matchIllegal[0]}`, {
          offset: "###".length + matchIllegal.index,
          length: matchIllegal[0].length
        });
      }
      chunk = chunk.replace(`###${hereComment}###`, "");
      chunk = chunk.replace(/^\n+/, "");
      this.lineToken({ chunk });
      content = hereComment;
      contents = [
        {
          content,
          length: commentWithSurroundingWhitespace.length - hereLeadingWhitespace.length - hereTrailingWhitespace.length,
          leadingWhitespace: hereLeadingWhitespace
        }
      ];
    } else {
      leadingNewlines = "";
      content = lineComment.replace(/^(\n*)/, function(leading) {
        leadingNewlines = leading;
        return "";
      });
      precedingNonCommentLines = "";
      hasSeenFirstCommentLine = false;
      contents = content.split(`
`).map(function(line, index) {
        var comment, leadingWhitespace2;
        if (!(line.indexOf("#") > -1)) {
          precedingNonCommentLines += `
${line}`;
          return;
        }
        leadingWhitespace2 = "";
        content = line.replace(/^([ |\t]*)#/, function(_, whitespace) {
          leadingWhitespace2 = whitespace;
          return "";
        });
        comment = {
          content,
          length: "#".length + content.length,
          leadingWhitespace: `${!hasSeenFirstCommentLine ? leadingNewlines : ""}${precedingNonCommentLines}${leadingWhitespace2}`,
          precededByBlankLine: !!precedingNonCommentLines
        };
        hasSeenFirstCommentLine = true;
        precedingNonCommentLines = "";
        return comment;
      }).filter(function(comment) {
        return comment;
      });
    }
    getIndentSize = function({ leadingWhitespace: leadingWhitespace2, nonInitial: nonInitial2 }) {
      var lastNewlineIndex;
      lastNewlineIndex = leadingWhitespace2.lastIndexOf(`
`);
      if (hereComment != null || !nonInitial2) {
        if (!(lastNewlineIndex > -1)) {
          return null;
        }
      } else {
        if (lastNewlineIndex == null) {
          lastNewlineIndex = -1;
        }
      }
      return leadingWhitespace2.length - 1 - lastNewlineIndex;
    };
    commentAttachments = function() {
      var k2, len2, results;
      results = [];
      for (i = k2 = 0, len2 = contents.length;k2 < len2; i = ++k2) {
        ({ content, length, leadingWhitespace, precededByBlankLine } = contents[i]);
        nonInitial = i !== 0;
        leadingNewlineOffset = nonInitial ? 1 : 0;
        offsetInChunk += leadingNewlineOffset + leadingWhitespace.length;
        indentSize = getIndentSize({ leadingWhitespace, nonInitial });
        noIndent = indentSize == null || indentSize === -1;
        commentAttachment = {
          content,
          here: hereComment != null,
          newLine: leadingNewline || nonInitial,
          locationData: this.makeLocationData({ offsetInChunk, length }),
          precededByBlankLine,
          indentSize,
          indented: !noIndent && indentSize > this.indent,
          outdented: !noIndent && indentSize < this.indent
        };
        if (heregex) {
          commentAttachment.heregex = true;
        }
        offsetInChunk += length;
        results.push(commentAttachment);
      }
      return results;
    }.call(this);
    prev = this.prev();
    if (!prev) {
      commentAttachments[0].newLine = true;
      this.lineToken({
        chunk: this.chunk.slice(commentWithSurroundingWhitespace.length),
        offset: commentWithSurroundingWhitespace.length
      });
      placeholderToken = this.makeToken("JS", "", {
        offset: commentWithSurroundingWhitespace.length,
        generated: true
      });
      placeholderToken.comments = commentAttachments;
      this.tokens.push(placeholderToken);
      this.newlineToken(commentWithSurroundingWhitespace.length);
    } else {
      attachCommentsToNode(commentAttachments, prev);
    }
    if (returnCommentTokens) {
      return commentAttachments;
    }
    return commentWithSurroundingWhitespace.length;
  }
  whitespaceToken() {
    var match, nline, prev;
    if (!((match = WHITESPACE.exec(this.chunk)) || (nline = this.chunk.charAt(0) === `
`))) {
      return 0;
    }
    prev = this.prev();
    if (prev) {
      prev[match ? "spaced" : "newLine"] = true;
    }
    if (match) {
      return match[0].length;
    } else {
      return 0;
    }
  }
  lineToken({ chunk = this.chunk, offset = 0 } = {}) {
    var backslash, diff, endsContinuationLineIndentation, indent, match, minLiteralLength, newIndentLiteral, noNewlines, prev, ref, size;
    if (!(match = MULTI_DENT.exec(chunk))) {
      return 0;
    }
    indent = match[0];
    prev = this.prev();
    backslash = (prev != null ? prev[0] : undefined) === "\\";
    if (!((backslash || ((ref = this.seenFor) != null ? ref.endsLength : undefined) < this.ends.length) && this.seenFor)) {
      this.seenFor = false;
    }
    if (!(backslash && this.seenImport || this.importSpecifierList)) {
      this.seenImport = false;
    }
    if (!(backslash && this.seenExport || this.exportSpecifierList)) {
      this.seenExport = false;
    }
    size = indent.length - 1 - indent.lastIndexOf(`
`);
    noNewlines = this.unfinished();
    newIndentLiteral = size > 0 ? indent.slice(-size) : "";
    if (!/^(.?)\1*$/.exec(newIndentLiteral)) {
      this.error("mixed indentation", {
        offset: indent.length
      });
      return indent.length;
    }
    minLiteralLength = Math.min(newIndentLiteral.length, this.indentLiteral.length);
    if (newIndentLiteral.slice(0, minLiteralLength) !== this.indentLiteral.slice(0, minLiteralLength)) {
      this.error("indentation mismatch", {
        offset: indent.length
      });
      return indent.length;
    }
    if (size - this.overIndent === this.indent) {
      if (noNewlines) {
        this.suppressNewlines();
      } else {
        this.newlineToken(offset);
      }
      return indent.length;
    }
    if (size > this.indent) {
      if (noNewlines) {
        if (!backslash) {
          this.overIndent = size - this.indent;
        }
        if (this.overIndent) {
          prev.continuationLineIndent = this.indent + this.overIndent;
        }
        this.suppressNewlines();
        return indent.length;
      }
      if (!this.tokens.length) {
        this.baseIndent = this.indent = size;
        this.indentLiteral = newIndentLiteral;
        return indent.length;
      }
      diff = size - this.indent + this.outdebt;
      this.token("INDENT", diff, {
        offset: offset + indent.length - size,
        length: size
      });
      this.indents.push(diff);
      this.ends.push({
        tag: "OUTDENT"
      });
      this.outdebt = this.overIndent = 0;
      this.indent = size;
      this.indentLiteral = newIndentLiteral;
    } else if (size < this.baseIndent) {
      this.error("missing indentation", {
        offset: offset + indent.length
      });
    } else {
      endsContinuationLineIndentation = this.overIndent > 0;
      this.overIndent = 0;
      this.outdentToken({
        moveOut: this.indent - size,
        noNewlines,
        outdentLength: indent.length,
        offset,
        indentSize: size,
        endsContinuationLineIndentation
      });
    }
    return indent.length;
  }
  getHeredocClosingColumn(end, quoteLength) {
    const closingPos = end - quoteLength;
    let lineStart = closingPos - 1;
    while (lineStart >= 0 && this.chunk[lineStart] !== `
`) {
      lineStart--;
    }
    lineStart++;
    const beforeClosing = this.chunk.slice(lineStart, closingPos);
    return /^\s*$/.test(beforeClosing) ? beforeClosing.length : null;
  }
  extractHeredocContent(tokens) {
    const parts = [];
    for (let i = 0;i < tokens.length; i++) {
      if (tokens[i][0] === "NEOSTRING") {
        parts.push(tokens[i][1]);
      }
    }
    return parts.join("#{}");
  }
  findMinimumIndent(doc) {
    let indent = null;
    let match;
    while (match = HEREDOC_INDENT.exec(doc)) {
      const attempt = match[1];
      if (indent === null || 0 < attempt.length && attempt.length < indent.length) {
        indent = attempt;
      }
    }
    return indent;
  }
  selectHeredocIndent(closingColumn, minIndent) {
    if (closingColumn === null) {
      return minIndent;
    }
    if (minIndent === null) {
      return " ".repeat(closingColumn);
    }
    if (closingColumn <= minIndent.length) {
      return " ".repeat(closingColumn);
    }
    return minIndent;
  }
  removeTrailingWhitespaceLine(tokens) {
    if (tokens.length === 0)
      return;
    const lastToken = tokens[tokens.length - 1];
    if (lastToken[0] !== "NEOSTRING")
      return;
    const lines = lastToken[1].split(`
`);
    const lastLine = lines[lines.length - 1];
    if (/^\s*$/.test(lastLine)) {
      lines.pop();
      lastToken[1] = lines.join(`
`);
    }
  }
  stringToken() {
    var attempt, delimiter, doc, end, heredoc, i, indent, match, prev, quote, ref, regex, token, tokens;
    [quote] = STRING_START.exec(this.chunk) || [];
    if (!quote) {
      return 0;
    }
    prev = this.prev();
    if (prev && this.value() === "from" && (this.seenImport || this.seenExport)) {
      prev[0] = "FROM";
    }
    regex = function() {
      switch (quote) {
        case "'":
          return STRING_SINGLE;
        case '"':
          return STRING_DOUBLE;
        case "'''":
          return HEREDOC_SINGLE;
        case '"""':
          return HEREDOC_DOUBLE;
      }
    }();
    ({
      tokens,
      index: end
    } = this.matchWithInterpolations(regex, quote));
    heredoc = quote.length === 3;
    if (heredoc) {
      const closingColumn = this.getHeredocClosingColumn(end, quote.length);
      doc = this.extractHeredocContent(tokens);
      indent = this.findMinimumIndent(doc);
      indent = this.selectHeredocIndent(closingColumn, indent);
      if (closingColumn !== null && indent !== null && closingColumn > indent.length) {
        this.removeTrailingWhitespaceLine(tokens);
      }
    }
    delimiter = quote.charAt(0);
    this.mergeInterpolationTokens(tokens, {
      quote,
      indent,
      endOffset: end
    }, (value) => {
      return this.validateUnicodeCodePointEscapes(value, {
        delimiter: quote
      });
    });
    return end;
  }
  numberToken() {
    var lexedLength, match, number, parsedValue, tag, tokenData;
    if (!(match = NUMBER.exec(this.chunk))) {
      return 0;
    }
    number = match[0];
    lexedLength = number.length;
    switch (false) {
      case !/^0[BOX]/.test(number):
        this.error(`radix prefix in '${number}' must be lowercase`, {
          offset: 1
        });
        break;
      case !/^0\d*[89]/.test(number):
        this.error(`decimal literal '${number}' must not be prefixed with '0'`, {
          length: lexedLength
        });
        break;
      case !/^0\d+/.test(number):
        this.error(`octal literal '${number}' must be prefixed with '0o'`, {
          length: lexedLength
        });
    }
    parsedValue = parseNumber(number);
    tokenData = { parsedValue };
    tag = parsedValue === Infinity ? "INFINITY" : "NUMBER";
    if (tag === "INFINITY") {
      tokenData.original = number;
    }
    this.token(tag, number, {
      length: lexedLength,
      data: tokenData
    });
    return lexedLength;
  }
  regexToken() {
    var body, closed, comment, commentIndex, commentOpts, commentTokens, comments, delimiter, end, flags, fullMatch, index, leadingWhitespace, match, matchedComment, origin, prev, ref, ref1, regex, tokens;
    switch (false) {
      case !(match = REGEX_ILLEGAL.exec(this.chunk)):
        this.error(`regular expressions cannot begin with ${match[2]}`, {
          offset: match.index + match[1].length
        });
        break;
      case !(match = this.matchWithInterpolations(HEREGEX, "///")):
        ({ tokens, index } = match);
        comments = [];
        while (matchedComment = HEREGEX_COMMENT.exec(this.chunk.slice(0, index))) {
          ({
            index: commentIndex
          } = matchedComment);
          [fullMatch, leadingWhitespace, comment] = matchedComment;
          comments.push({
            comment,
            offsetInChunk: commentIndex + leadingWhitespace.length
          });
        }
        commentTokens = flatten(function() {
          var k2, len2, results;
          results = [];
          for (k2 = 0, len2 = comments.length;k2 < len2; k2++) {
            commentOpts = comments[k2];
            results.push(this.commentToken(commentOpts.comment, Object.assign(commentOpts, {
              heregex: true,
              returnCommentTokens: true
            })));
          }
          return results;
        }.call(this));
        break;
      case !(match = REGEX.exec(this.chunk)):
        [regex, body, closed] = match;
        this.validateEscapes(body, {
          isRegex: true,
          offsetInChunk: 1
        });
        index = regex.length;
        prev = this.prev();
        if (prev) {
          if (prev.spaced && (ref = prev[0], indexOf.call(CALLABLE, ref) >= 0)) {
            if (!closed || POSSIBLY_DIVISION.test(regex)) {
              return 0;
            }
          } else if (ref1 = prev[0], indexOf.call(NOT_REGEX, ref1) >= 0) {
            return 0;
          }
        }
        if (!closed) {
          this.error("missing / (unclosed regex)");
        }
        break;
      default:
        return 0;
    }
    [flags] = REGEX_FLAGS.exec(this.chunk.slice(index));
    end = index + flags.length;
    origin = this.makeToken("REGEX", null, {
      length: end
    });
    switch (false) {
      case !!VALID_FLAGS.test(flags):
        this.error(`invalid regular expression flags ${flags}`, {
          offset: index,
          length: flags.length
        });
        break;
      case !(regex || tokens.length === 1):
        delimiter = body ? "/" : "///";
        if (body == null) {
          body = tokens[0][1];
        }
        this.validateUnicodeCodePointEscapes(body, { delimiter });
        const tokenData = { delimiter };
        if (delimiter === "///") {
          tokenData.heregex = { flags };
        }
        this.token("REGEX", `/${body}/${flags}`, {
          length: end,
          origin,
          data: tokenData
        });
        break;
      default:
        this.token("REGEX_START", "(", {
          length: 0,
          origin,
          generated: true
        });
        this.token("IDENTIFIER", "RegExp", {
          length: 0,
          generated: true
        });
        this.token("CALL_START", "(", {
          length: 0,
          generated: true
        });
        this.mergeInterpolationTokens(tokens, {
          double: true,
          heregex: { flags },
          endOffset: end - flags.length,
          quote: "///"
        }, (str) => {
          return this.validateUnicodeCodePointEscapes(str, { delimiter });
        });
        if (flags) {
          this.token(",", ",", {
            offset: index - 1,
            length: 0,
            generated: true
          });
          this.token("STRING", '"' + flags + '"', {
            offset: index,
            length: flags.length
          });
        }
        this.token(")", ")", {
          offset: end,
          length: 0,
          generated: true
        });
        this.token("REGEX_END", ")", {
          offset: end,
          length: 0,
          generated: true
        });
    }
    if (commentTokens != null ? commentTokens.length : undefined) {
      addTokenData(this.tokens[this.tokens.length - 1], {
        heregexCommentTokens: commentTokens
      });
    }
    return end;
  }
  jsToken() {
    var length, match, matchedHere, script;
    if (!(this.chunk.charAt(0) === "`" && (match = (matchedHere = HERE_JSTOKEN.exec(this.chunk)) || JSTOKEN.exec(this.chunk)))) {
      return 0;
    }
    script = match[1];
    ({ length } = match[0]);
    this.token("JS", script, {
      length,
      data: {
        here: !!matchedHere
      }
    });
    return length;
  }
  literalToken() {
    var match, message, origin, prev, ref, ref1, ref2, ref3, ref4, ref5, skipToken, tag, token, value;
    if (match = OPERATOR.exec(this.chunk)) {
      [value] = match;
      if (CODE.test(value)) {
        this.tagParameters();
      }
    } else {
      value = this.chunk.charAt(0);
    }
    tag = value;
    prev = this.prev();
    if (prev && indexOf.call(["=", ...COMPOUND_ASSIGN], value) >= 0) {
      skipToken = false;
      if (value === "=" && ((ref = prev[1]) === "||" || ref === "&&" || ref === "??") && !prev.spaced) {
        prev[0] = "COMPOUND_ASSIGN";
        prev[1] += "=";
        if ((ref1 = prev.data) != null ? ref1.original : undefined) {
          prev.data.original += "=";
        }
        prev[2].range = [prev[2].range[0], prev[2].range[1] + 1];
        prev[2].last_column += 1;
        prev[2].last_column_exclusive += 1;
        prev = this.tokens[this.tokens.length - 2];
        skipToken = true;
      }
      if (prev && prev[0] !== "PROPERTY") {
        origin = (ref2 = prev.origin) != null ? ref2 : prev;
        message = isUnassignable(prev[1], origin[1]);
        if (message) {
          this.error(message, origin[2]);
        }
      }
      if (skipToken) {
        return value.length;
      }
    }
    if (value === "(" && (prev != null ? prev[0] : undefined) === "IMPORT") {
      prev[0] = "DYNAMIC_IMPORT";
    }
    if (value === "{" && this.seenImport) {
      this.importSpecifierList = true;
    } else if (this.importSpecifierList && value === "}") {
      this.importSpecifierList = false;
    } else if (value === "{" && (prev != null ? prev[0] : undefined) === "EXPORT") {
      this.exportSpecifierList = true;
    } else if (this.exportSpecifierList && value === "}") {
      this.exportSpecifierList = false;
    }
    if (value === ";") {
      if (ref3 = prev != null ? prev[0] : undefined, indexOf.call(["=", ...UNFINISHED], ref3) >= 0) {
        this.error("unexpected ;");
      }
      this.seenFor = this.seenImport = this.seenExport = false;
      tag = "TERMINATOR";
    } else if (value === "*" && (prev != null ? prev[0] : undefined) === "EXPORT") {
      tag = "EXPORT_ALL";
    } else if (value === "<=>") {
      tag = "BIND";
    } else if (value === "~=") {
      tag = "DERIVED_ASSIGN";
    } else if (value === ":=") {
      tag = "REACTIVE_ASSIGN";
    } else if (value === "=!") {
      tag = "READONLY_ASSIGN";
    } else if (value === "~>") {
      tag = "EXPOSED_ARROW";
    } else if (indexOf.call(MATH, value) >= 0) {
      tag = "MATH";
    } else if (indexOf.call(COMPARE, value) >= 0) {
      tag = "COMPARE";
    } else if (indexOf.call(COMPOUND_ASSIGN, value) >= 0) {
      tag = "COMPOUND_ASSIGN";
    } else if (indexOf.call(UNARY, value) >= 0) {
      tag = "UNARY";
    } else if (indexOf.call(UNARY_MATH, value) >= 0) {
      tag = "UNARY_MATH";
    } else if (indexOf.call(SHIFT, value) >= 0) {
      tag = "SHIFT";
    } else if (value === "?" && (prev != null ? prev.spaced : undefined)) {
      tag = "SPACE?";
    } else if (prev) {
      if (value === "(" && !prev.spaced && (ref4 = prev[0], indexOf.call(CALLABLE, ref4) >= 0)) {
        if (prev[0] === "?") {
          prev[0] = "FUNC_EXIST";
        } else if (prev[0] === "?.") {
          prev[0] = "ES6_OPTIONAL_CALL";
        }
        tag = "CALL_START";
      } else if (value === "[" && ((ref5 = prev[0], indexOf.call(INDEXABLE, ref5) >= 0) && !prev.spaced || prev[0] === "::")) {
        tag = "INDEX_START";
        switch (prev[0]) {
          case "?":
            prev[0] = "INDEX_SOAK";
            break;
          case "?.":
            prev[0] = "ES6_OPTIONAL_INDEX";
            break;
        }
      }
    }
    token = this.makeToken(tag, value);
    switch (value) {
      case "(":
      case "{":
      case "[":
        this.ends.push({
          tag: INVERSES[value],
          origin: token
        });
        break;
      case ")":
      case "}":
      case "]":
        this.pair(value);
    }
    this.tokens.push(this.makeToken(tag, value));
    return value.length;
  }
  outdentToken({ moveOut, noNewlines, outdentLength = 0, offset = 0, indentSize, endsContinuationLineIndentation }) {
    var decreasedIndent, dent, lastIndent, ref, terminatorToken;
    decreasedIndent = this.indent - moveOut;
    while (moveOut > 0) {
      lastIndent = this.indents[this.indents.length - 1];
      if (!lastIndent) {
        this.outdebt = moveOut = 0;
      } else if (this.outdebt && moveOut <= this.outdebt) {
        this.outdebt -= moveOut;
        moveOut = 0;
      } else {
        dent = this.indents.pop() + this.outdebt;
        if (outdentLength && (ref = this.chunk[outdentLength], indexOf.call(INDENTABLE_CLOSERS, ref) >= 0)) {
          decreasedIndent -= dent - moveOut;
          moveOut = dent;
        }
        this.outdebt = 0;
        this.pair("OUTDENT");
        this.token("OUTDENT", moveOut, {
          length: outdentLength,
          indentSize: indentSize + moveOut - dent
        });
        moveOut -= dent;
      }
    }
    if (dent) {
      this.outdebt -= moveOut;
    }
    this.suppressSemicolons();
    if (!(this.tag() === "TERMINATOR" || noNewlines)) {
      terminatorToken = this.token("TERMINATOR", `
`, {
        offset: offset + outdentLength,
        length: 0
      });
      if (endsContinuationLineIndentation) {
        terminatorToken.endsContinuationLineIndentation = {
          preContinuationLineIndent: this.indent
        };
      }
    }
    this.indent = decreasedIndent;
    this.indentLiteral = this.indentLiteral.slice(0, decreasedIndent);
    return this;
  }
  newlineToken(offset) {
    this.suppressSemicolons();
    if (this.tag() !== "TERMINATOR") {
      this.token("TERMINATOR", `
`, {
        offset,
        length: 0
      });
    }
    return this;
  }
  suppressNewlines() {
    var prev;
    prev = this.prev();
    if (prev[1] === "\\") {
      if (prev.comments && this.tokens.length > 1) {
        attachCommentsToNode(prev.comments, this.tokens[this.tokens.length - 2]);
      }
      this.tokens.pop();
    }
    return this;
  }
  tagParameters() {
    var i, paramEndToken, stack, tok, tokens;
    if (this.tag() !== ")") {
      return this.tagDoIife();
    }
    stack = [];
    ({ tokens } = this);
    i = tokens.length;
    paramEndToken = tokens[--i];
    paramEndToken[0] = "PARAM_END";
    while (tok = tokens[--i]) {
      switch (tok[0]) {
        case ")":
          stack.push(tok);
          break;
        case "(":
        case "CALL_START":
          if (stack.length) {
            stack.pop();
          } else if (tok[0] === "(") {
            tok[0] = "PARAM_START";
            return this.tagDoIife(i - 1);
          } else {
            paramEndToken[0] = "CALL_END";
            return this;
          }
      }
    }
    return this;
  }
  tagDoIife(tokenIndex) {
    var tok;
    tok = this.tokens[tokenIndex != null ? tokenIndex : this.tokens.length - 1];
    if ((tok != null ? tok[0] : undefined) !== "DO") {
      return this;
    }
    tok[0] = "DO_IIFE";
    return this;
  }
  closeIndentation() {
    return this.outdentToken({
      moveOut: this.indent,
      indentSize: 0
    });
  }
  matchWithInterpolations(regex, delimiter, closingDelimiter = delimiter, interpolators = /^[#$]\{/) {
    var braceInterpolator, close, column, index, interpolationOffset, interpolator, line, match, nested, offset, offsetInChunk, open, ref, ref1, rest, str, strPart, tokens;
    tokens = [];
    offsetInChunk = delimiter.length;
    if (this.chunk.slice(0, offsetInChunk) !== delimiter) {
      return null;
    }
    str = this.chunk.slice(offsetInChunk);
    while (true) {
      [strPart] = regex.exec(str);
      this.validateEscapes(strPart, {
        isRegex: delimiter.charAt(0) === "/",
        offsetInChunk
      });
      tokens.push(this.makeToken("NEOSTRING", strPart, {
        offset: offsetInChunk
      }));
      str = str.slice(strPart.length);
      offsetInChunk += strPart.length;
      if (!(match = interpolators.exec(str))) {
        break;
      }
      [interpolator] = match;
      interpolationOffset = interpolator.length - 1;
      [line, column, offset] = this.getLineAndColumnFromChunk(offsetInChunk + interpolationOffset);
      rest = str.slice(interpolationOffset);
      ({
        tokens: nested,
        index
      } = new Lexer2().tokenize(rest, {
        line,
        column,
        offset,
        untilBalanced: true,
        locTweaks: this.locTweaks
      }));
      index += interpolationOffset;
      braceInterpolator = str[index - 1] === "}";
      if (braceInterpolator) {
        [open] = nested, [close] = slice.call(nested, -1);
        open[0] = "INTERPOLATION_START";
        open[1] = "(";
        open[2].first_column -= interpolationOffset;
        open[2].range = [open[2].range[0] - interpolationOffset, open[2].range[1]];
        close[0] = "INTERPOLATION_END";
        close[1] = ")";
        close.origin = ["", "end of interpolation", close[2]];
      }
      if (((ref = nested[1]) != null ? ref[0] : undefined) === "TERMINATOR") {
        nested.splice(1, 1);
      }
      if (((ref1 = nested[nested.length - 3]) != null ? ref1[0] : undefined) === "INDENT" && nested[nested.length - 2][0] === "OUTDENT") {
        nested.splice(-3, 2);
      }
      if (!braceInterpolator) {
        open = this.makeToken("INTERPOLATION_START", "(", {
          offset: offsetInChunk,
          length: 0,
          generated: true
        });
        close = this.makeToken("INTERPOLATION_END", ")", {
          offset: offsetInChunk + index,
          length: 0,
          generated: true
        });
        nested = [open, ...nested, close];
      }
      tokens.push(["TOKENS", nested]);
      str = str.slice(index);
      offsetInChunk += index;
    }
    if (str.slice(0, closingDelimiter.length) !== closingDelimiter) {
      this.error(`missing ${closingDelimiter}`, {
        length: delimiter.length
      });
    }
    return {
      tokens,
      index: offsetInChunk + closingDelimiter.length
    };
  }
  mergeInterpolationTokens(tokens, options, fn) {
    var $, converted, double, endOffset, firstIndex, heregex, i, indent, k2, l, lastToken, len2, len1, locationToken, lparen, placeholderToken, quote, ref, ref1, rparen, tag, token, tokensToPush, val, value;
    ({ quote, indent, double, heregex, endOffset } = options);
    if (tokens.length > 1) {
      lparen = this.token("STRING_START", "(", {
        length: (ref = quote != null ? quote.length : undefined) != null ? ref : 0,
        data: { quote },
        generated: !(quote != null ? quote.length : undefined)
      });
    }
    firstIndex = this.tokens.length;
    $ = tokens.length - 1;
    for (i = k2 = 0, len2 = tokens.length;k2 < len2; i = ++k2) {
      token = tokens[i];
      [tag, value] = token;
      switch (tag) {
        case "TOKENS":
          if (value.length === 2 && (value[0].comments || value[1].comments)) {
            placeholderToken = this.makeToken("JS", "", {
              generated: true
            });
            placeholderToken[2] = value[0][2];
            for (l = 0, len1 = value.length;l < len1; l++) {
              val = value[l];
              if (!val.comments) {
                continue;
              }
              if (placeholderToken.comments == null) {
                placeholderToken.comments = [];
              }
              placeholderToken.comments.push(...val.comments);
            }
            value.splice(1, 0, placeholderToken);
          }
          locationToken = value[0];
          tokensToPush = value;
          break;
        case "NEOSTRING":
          converted = fn.call(this, token[1], i);
          if (i === 0) {
            addTokenData(token, {
              initialChunk: true
            });
          }
          if (i === $) {
            addTokenData(token, {
              finalChunk: true
            });
          }
          addTokenData(token, { indent, quote, double });
          if (heregex) {
            addTokenData(token, { heregex });
          }
          token[0] = "STRING";
          token[1] = '"' + converted + '"';
          if (tokens.length === 1 && quote != null) {
            token[2].first_column -= quote.length;
            if (token[1].substr(-2, 1) === `
`) {
              token[2].last_line += 1;
              token[2].last_column = quote.length - 1;
            } else {
              token[2].last_column += quote.length;
              if (token[1].length === 2) {
                token[2].last_column -= 1;
              }
            }
            token[2].last_column_exclusive += quote.length;
            token[2].range = [token[2].range[0] - quote.length, token[2].range[1] + quote.length];
          }
          locationToken = token;
          tokensToPush = [token];
      }
      this.tokens.push(...tokensToPush);
    }
    if (lparen) {
      [lastToken] = slice.call(tokens, -1);
      lparen.origin = [
        "STRING",
        null,
        {
          first_line: lparen[2].first_line,
          first_column: lparen[2].first_column,
          last_line: lastToken[2].last_line,
          last_column: lastToken[2].last_column,
          last_line_exclusive: lastToken[2].last_line_exclusive,
          last_column_exclusive: lastToken[2].last_column_exclusive,
          range: [
            lparen[2].range[0],
            lastToken[2].range[1]
          ]
        }
      ];
      if (!(quote != null ? quote.length : undefined)) {
        lparen[2] = lparen.origin[2];
      }
      return rparen = this.token("STRING_END", ")", {
        offset: endOffset - (quote != null ? quote : "").length,
        length: (ref1 = quote != null ? quote.length : undefined) != null ? ref1 : 0,
        generated: !(quote != null ? quote.length : undefined)
      });
    }
  }
  pair(tag) {
    var lastIndent, prev, ref, ref1, wanted;
    ref = this.ends, [prev] = slice.call(ref, -1);
    if (tag !== (wanted = prev != null ? prev.tag : undefined)) {
      if (wanted !== "OUTDENT") {
        this.error(`unmatched ${tag}`);
      }
      ref1 = this.indents, [lastIndent] = slice.call(ref1, -1);
      this.outdentToken({
        moveOut: lastIndent,
        noNewlines: true
      });
      return this.pair(tag);
    }
    return this.ends.pop();
  }
  getLocationDataCompensation(start, end) {
    var compensation, current, initialEnd, totalCompensation;
    totalCompensation = 0;
    initialEnd = end;
    current = start;
    while (current <= end) {
      if (current === end && start !== initialEnd) {
        break;
      }
      compensation = this.locTweaks[current];
      if (compensation != null) {
        totalCompensation += compensation;
        end += compensation;
      }
      current++;
    }
    return totalCompensation;
  }
  getLineAndColumnFromChunk(offset) {
    var column, columnCompensation, compensation, lastLine, lineCount, previousLinesCompensation, ref, string;
    compensation = this.getLocationDataCompensation(this.chunkOffset, this.chunkOffset + offset);
    if (offset === 0) {
      return [this.chunkLine, this.chunkColumn + compensation, this.chunkOffset + compensation];
    }
    if (offset >= this.chunk.length) {
      string = this.chunk;
    } else {
      string = this.chunk.slice(0, +(offset - 1) + 1 || 9000000000);
    }
    lineCount = count(string, `
`);
    column = this.chunkColumn;
    if (lineCount > 0) {
      ref = string.split(`
`), [lastLine] = slice.call(ref, -1);
      column = lastLine.length;
      previousLinesCompensation = this.getLocationDataCompensation(this.chunkOffset, this.chunkOffset + offset - column);
      if (previousLinesCompensation < 0) {
        previousLinesCompensation = 0;
      }
      columnCompensation = this.getLocationDataCompensation(this.chunkOffset + offset + previousLinesCompensation - column, this.chunkOffset + offset + previousLinesCompensation);
    } else {
      column += string.length;
      columnCompensation = compensation;
    }
    return [this.chunkLine + lineCount, column + columnCompensation, this.chunkOffset + offset + compensation];
  }
  makeLocationData({ offsetInChunk, length }) {
    var endOffset, lastCharacter, locationData;
    locationData = {
      range: []
    };
    [locationData.first_line, locationData.first_column, locationData.range[0]] = this.getLineAndColumnFromChunk(offsetInChunk);
    lastCharacter = length > 0 ? length - 1 : 0;
    [locationData.last_line, locationData.last_column, endOffset] = this.getLineAndColumnFromChunk(offsetInChunk + lastCharacter);
    [locationData.last_line_exclusive, locationData.last_column_exclusive] = this.getLineAndColumnFromChunk(offsetInChunk + lastCharacter + (length > 0 ? 1 : 0));
    locationData.range[1] = length > 0 ? endOffset + 1 : endOffset;
    return locationData;
  }
  makeToken(tag, value, {
    offset: offsetInChunk = 0,
    length = value.length,
    origin,
    generated,
    indentSize
  } = {}) {
    var token;
    token = [tag, value, this.makeLocationData({ offsetInChunk, length })];
    if (origin) {
      token.origin = origin;
    }
    if (generated) {
      token.generated = true;
    }
    if (indentSize != null) {
      token.indentSize = indentSize;
    }
    return token;
  }
  token(tag, value, { offset, length, origin, data, generated, indentSize } = {}) {
    var token;
    token = this.makeToken(tag, value, { offset, length, origin, generated, indentSize });
    if (data) {
      addTokenData(token, data);
    }
    this.tokens.push(token);
    return token;
  }
  tag() {
    var ref, token;
    ref = this.tokens, [token] = slice.call(ref, -1);
    return token != null ? token[0] : undefined;
  }
  value(useOrigin = false) {
    var ref, token;
    ref = this.tokens, [token] = slice.call(ref, -1);
    if (useOrigin && (token != null ? token.origin : undefined) != null) {
      return token.origin[1];
    } else {
      return token != null ? token[1] : undefined;
    }
  }
  prev() {
    return this.tokens[this.tokens.length - 1];
  }
  unfinished() {
    var ref;
    if (this.tag() === "RENDER") {
      return false;
    }
    if (this.inRender && /^\s*\./.test(this.chunk)) {
      return false;
    }
    return LINE_CONTINUER.test(this.chunk) || (ref = this.tag(), indexOf.call(UNFINISHED, ref) >= 0);
  }
  validateUnicodeCodePointEscapes(str, options) {
    return replaceUnicodeCodePointEscapes(str, merge(options, { error: this.error }));
  }
  validateEscapes(str, options = {}) {
    var before, hex, invalidEscape, invalidEscapeRegex, match, message, octal, ref, unicode, unicodeCodePoint;
    invalidEscapeRegex = options.isRegex ? REGEX_INVALID_ESCAPE : STRING_INVALID_ESCAPE;
    match = invalidEscapeRegex.exec(str);
    if (!match) {
      return;
    }
    match[0], before = match[1], octal = match[2], hex = match[3], unicodeCodePoint = match[4], unicode = match[5];
    message = octal ? "octal escape sequences are not allowed" : "invalid escape sequence";
    invalidEscape = `\\${octal || hex || unicodeCodePoint || unicode}`;
    return this.error(`${message} ${invalidEscape}`, {
      offset: ((ref = options.offsetInChunk) != null ? ref : 0) + match.index + before.length,
      length: invalidEscape.length
    });
  }
  suppressSemicolons() {
    var ref, ref1, results;
    results = [];
    while (this.value() === ";") {
      this.tokens.pop();
      if (ref = (ref1 = this.prev()) != null ? ref1[0] : undefined, indexOf.call(["=", ...UNFINISHED], ref) >= 0) {
        results.push(this.error("unexpected ;"));
      } else {
        results.push(undefined);
      }
    }
    return results;
  }
  error(message, options = {}) {
    var first_column, first_line, location, ref, ref1;
    location = "first_line" in options ? options : ([first_line, first_column] = this.getLineAndColumnFromChunk((ref = options.offset) != null ? ref : 0), {
      first_line,
      first_column,
      last_column: first_column + ((ref1 = options.length) != null ? ref1 : 1) - 1
    });
    return throwSyntaxError(message, location);
  }
};
var isUnassignable = function(name, displayName = name) {
  switch (false) {
    case indexOf.call([...JS_KEYWORDS, ...RIP_KEYWORDS], name) < 0:
      return `keyword '${displayName}' can't be assigned`;
    case indexOf.call(STRICT_PROSCRIBED, name) < 0:
      return `'${displayName}' can't be assigned`;
    case indexOf.call(RESERVED, name) < 0:
      return `reserved word '${displayName}' can't be assigned`;
    default:
      return false;
  }
};
isForFrom = function(prev) {
  var ref;
  if (prev[0] === "IDENTIFIER") {
    return true;
  } else if (prev[0] === "FOR") {
    return false;
  } else if ((ref = prev[1]) === "{" || ref === "[" || ref === "," || ref === ":") {
    return false;
  } else {
    return true;
  }
};
addTokenData = function(token, data) {
  return Object.assign(token.data != null ? token.data : token.data = {}, data);
};
JS_KEYWORDS = ["true", "false", "null", "this", "new", "delete", "typeof", "in", "instanceof", "return", "throw", "break", "continue", "debugger", "yield", "await", "if", "else", "switch", "for", "while", "do", "try", "catch", "finally", "class", "extends", "super", "import", "export", "default"];
RIP_KEYWORDS = ["undefined", "Infinity", "NaN", "then", "unless", "until", "loop", "of", "by", "when", "def", "effect", "component", "render", "style", "mounted", "unmounted", "updated"];
RIP_ALIAS_MAP = {
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
RIP_ALIASES = function() {
  var results;
  results = [];
  for (key in RIP_ALIAS_MAP) {
    results.push(key);
  }
  return results;
}();
RIP_KEYWORDS = RIP_KEYWORDS.concat(RIP_ALIASES);
RESERVED = ["case", "function", "var", "void", "with", "const", "let", "enum", "native", "implements", "interface", "package", "private", "protected", "public", "static"];
STRICT_PROSCRIBED = ["arguments", "eval"];
var JS_FORBIDDEN = JS_KEYWORDS.concat(RESERVED).concat(STRICT_PROSCRIBED);
BOM = 65279;
IDENTIFIER = /^(?!\d)((?:(?!\s)[$\w\x7f-\uffff])+!?)([^\n\S]*:(?![=:]))?/;
NUMBER = /^0b[01](?:_?[01])*n?|^0o[0-7](?:_?[0-7])*n?|^0x[\da-f](?:_?[\da-f])*n?|^\d+(?:_\d+)*n|^(?:\d+(?:_\d+)*)?\.?\d+(?:_\d+)*(?:e[+-]?\d+(?:_\d+)*)?/i;
OPERATOR = /^(?:<=>|[-=~]>|~=|:=|=!|===|!==|!\?|\?\?|=~|[-+*\/%<>&|^!?=]=|>>>=?|([-+:])\1|([&|<>*\/%])\2=?|\?(\.|::)|\.{2,3})/;
WHITESPACE = /^[^\n\S]+/;
COMMENT = /^(\s*)###([^#][\s\S]*?)(?:###([^\n\S]*)|###$)|^((?:\s*#(?!##[^#]).*)+)/;
CODE = /^[-=]>/;
MULTI_DENT = /^(?:\n[^\n\S]*)+/;
JSTOKEN = /^`(?!``)((?:[^`\\]|\\[\s\S])*)`/;
HERE_JSTOKEN = /^```((?:[^`\\]|\\[\s\S]|`(?!``))*)```/;
STRING_START = /^(?:'''|"""|'|")/;
STRING_SINGLE = /^(?:[^\\']|\\[\s\S])*/;
STRING_DOUBLE = /^(?:[^\\"#$]|\\[\s\S]|\#(?!\{)|\$(?!\{))*/;
HEREDOC_SINGLE = /^(?:[^\\']|\\[\s\S]|'(?!''))*/;
HEREDOC_DOUBLE = /^(?:[^\\"#$]|\\[\s\S]|"(?!"")|\#(?!\{)|\$(?!\{))*/;
HEREDOC_INDENT = /\n+([^\n\S]*)(?=\S)/g;
REGEX = /^\/(?!\/)((?:[^[\/\n\\]|\\[^\n]|\[(?:\\[^\n]|[^\]\n\\])*\])*)(\/)?/;
REGEX_FLAGS = /^\w*/;
VALID_FLAGS = /^(?!.*(.).*\1)[gimsuy]*$/;
HEREGEX = /^(?:[^\\\/#\s]|\\[\s\S]|\/(?!\/\/)|\#(?!\{)|\s+(?:#(?!\{).*)?)*/;
HEREGEX_COMMENT = /(\s+)(#(?!{).*)/gm;
REGEX_ILLEGAL = /^(\/|\/{3}\s*)(\*)/;
POSSIBLY_DIVISION = /^\/=?\s/;
HERECOMMENT_ILLEGAL = /\*\//;
LINE_CONTINUER = /^\s*(?:,|\??\.(?![.\d])|\??::)/;
STRING_INVALID_ESCAPE = /((?:^|[^\\])(?:\\\\)*)\\(?:(0\d|[1-7])|(x(?![\da-fA-F]{2}).{0,2})|(u\{(?![\da-fA-F]{1,}\})[^}]*\}?)|(u(?!\{|[\da-fA-F]{4}).{0,4}))/;
REGEX_INVALID_ESCAPE = /((?:^|[^\\])(?:\\\\)*)\\(?:(0\d)|(x(?![\da-fA-F]{2}).{0,2})|(u\{(?![\da-fA-F]{1,}\})[^}]*\}?)|(u(?!\{|[\da-fA-F]{4}).{0,4}))/;
TRAILING_SPACES = /\s+$/;
COMPOUND_ASSIGN = ["-=", "+=", "/=", "*=", "%=", "||=", "&&=", "?=", "??=", "<<=", ">>=", ">>>=", "&=", "^=", "|=", "**=", "//=", "%%="];
UNARY = ["NEW", "TYPEOF", "DELETE"];
UNARY_MATH = ["!", "~"];
SHIFT = ["<<", ">>", ">>>"];
COMPARE = ["==", "!=", "===", "!==", "<", ">", "<=", ">=", "=~"];
MATH = ["*", "/", "%", "//", "%%"];
RELATION = ["IN", "OF", "INSTANCEOF"];
BOOL = ["TRUE", "FALSE"];
CALLABLE = ["IDENTIFIER", "PROPERTY", ")", "]", "?", "@", "THIS", "SUPER", "DYNAMIC_IMPORT", "?."];
INDEXABLE = CALLABLE.concat(["NUMBER", "INFINITY", "NAN", "STRING", "STRING_END", "REGEX", "REGEX_END", "BOOL", "NULL", "UNDEFINED", "}", "::", "?."]);
COMPARABLE_LEFT_SIDE = ["IDENTIFIER", ")", "]", "NUMBER"];
NOT_REGEX = INDEXABLE.concat(["++", "--"]);
LINE_BREAK = ["INDENT", "OUTDENT", "TERMINATOR"];
INDENTABLE_CLOSERS = [")", "}", "]"];
moveComments = function(fromToken, toToken) {
  var comment, k2, len2, ref, unshiftedComments;
  if (!fromToken.comments) {
    return;
  }
  if (toToken.comments && toToken.comments.length !== 0) {
    unshiftedComments = [];
    ref = fromToken.comments;
    for (k2 = 0, len2 = ref.length;k2 < len2; k2++) {
      comment = ref[k2];
      if (comment.unshift) {
        unshiftedComments.push(comment);
      } else {
        toToken.comments.push(comment);
      }
    }
    toToken.comments = unshiftedComments.concat(toToken.comments);
  } else {
    toToken.comments = fromToken.comments;
  }
  return delete fromToken.comments;
};
generate = function(tag, value, origin, commentsToken) {
  var token;
  token = [tag, value];
  token.generated = true;
  if (origin) {
    token.origin = origin;
  }
  if (commentsToken) {
    moveComments(commentsToken, token);
  }
  return token;
};
Rewriter = function() {

  class Rewriter2 {
    rewrite(tokens1) {
      var ref, ref1, t;
      this.tokens = tokens1;
      if (typeof process !== "undefined" && process !== null ? (ref = process.env) != null ? ref.DEBUG_TOKEN_STREAM : undefined : undefined) {
        if (process.env.DEBUG_REWRITTEN_TOKEN_STREAM) {
          console.log("Initial token stream:");
        }
        console.log(function() {
          var k2, len2, ref12, results;
          ref12 = this.tokens;
          results = [];
          for (k2 = 0, len2 = ref12.length;k2 < len2; k2++) {
            t = ref12[k2];
            results.push(t[0] + "/" + t[1] + (t.comments ? "*" : ""));
          }
          return results;
        }.call(this).join(" "));
      }
      this.removeLeadingNewlines();
      this.closeOpenCalls();
      this.closeOpenIndexes();
      this.normalizeLines();
      this.processTemplateTokens();
      this.convertLegacyExistential();
      this.convertPostfixSpreadRest();
      this.tagPostfixConditionals();
      this.addImplicitBracesAndParens();
      this.rescueStowawayComments();
      this.addLocationDataToGeneratedTokens();
      this.fixIndentationLocationData();
      this.exposeTokenDataToGrammar();
      if (typeof process !== "undefined" && process !== null ? (ref1 = process.env) != null ? ref1.DEBUG_REWRITTEN_TOKEN_STREAM : undefined : undefined) {
        if (process.env.DEBUG_TOKEN_STREAM) {
          console.log("Rewritten token stream:");
        }
        console.log(function() {
          var k2, len2, ref2, results;
          ref2 = this.tokens;
          results = [];
          for (k2 = 0, len2 = ref2.length;k2 < len2; k2++) {
            t = ref2[k2];
            results.push(t[0] + "/" + t[1] + (t.comments ? "*" : ""));
          }
          return results;
        }.call(this).join(" "));
      }
      return this.tokens;
    }
    scanTokens(block) {
      var i, token, tokens;
      ({ tokens } = this);
      i = 0;
      while (token = tokens[i]) {
        i += block.call(this, token, i, tokens);
      }
      return true;
    }
    detectEnd(i, condition, action, opts = {}) {
      var levels, ref, ref1, token, tokens;
      ({ tokens } = this);
      levels = 0;
      while (token = tokens[i]) {
        if (levels === 0 && condition.call(this, token, i)) {
          return action.call(this, token, i);
        }
        if (ref = token[0], indexOf.call(EXPRESSION_START, ref) >= 0) {
          levels += 1;
        } else if (ref1 = token[0], indexOf.call(EXPRESSION_END, ref1) >= 0) {
          levels -= 1;
        }
        if (levels < 0) {
          if (opts.returnOnNegativeLevel) {
            return;
          }
          return action.call(this, token, i);
        }
        i += 1;
      }
      return i - 1;
    }
    removeLeadingNewlines() {
      var i, k2, l, leadingNewlineToken, len2, len1, ref, ref1, tag;
      ref = this.tokens;
      for (i = k2 = 0, len2 = ref.length;k2 < len2; i = ++k2) {
        [tag] = ref[i];
        if (tag !== "TERMINATOR") {
          break;
        }
      }
      if (i === 0) {
        return;
      }
      ref1 = this.tokens.slice(0, i);
      for (l = 0, len1 = ref1.length;l < len1; l++) {
        leadingNewlineToken = ref1[l];
        moveComments(leadingNewlineToken, this.tokens[i]);
      }
      return this.tokens.splice(0, i);
    }
    closeOpenCalls() {
      var action, condition;
      condition = function(token, i) {
        var ref;
        return (ref = token[0]) === ")" || ref === "CALL_END";
      };
      action = function(token, i) {
        return token[0] = "CALL_END";
      };
      return this.scanTokens(function(token, i) {
        if (token[0] === "CALL_START") {
          this.detectEnd(i + 1, condition, action);
        }
        return 1;
      });
    }
    closeOpenIndexes() {
      var action, condition, startToken;
      startToken = null;
      condition = function(token, i) {
        var ref;
        return (ref = token[0]) === "]" || ref === "INDEX_END";
      };
      action = function(token, i) {
        if (this.tokens.length >= i && this.tokens[i + 1][0] === ":") {
          startToken[0] = "[";
          return token[0] = "]";
        } else {
          return token[0] = "INDEX_END";
        }
      };
      return this.scanTokens(function(token, i) {
        if (token[0] === "INDEX_START") {
          startToken = token;
          this.detectEnd(i + 1, condition, action);
        }
        return 1;
      });
    }
    indexOfTag(i, ...pattern) {
      var fuzz, j, k2, ref, ref1;
      fuzz = 0;
      for (j = k2 = 0, ref = pattern.length;0 <= ref ? k2 < ref : k2 > ref; j = 0 <= ref ? ++k2 : --k2) {
        if (pattern[j] == null) {
          continue;
        }
        if (typeof pattern[j] === "string") {
          pattern[j] = [pattern[j]];
        }
        if (ref1 = this.tag(i + j + fuzz), indexOf.call(pattern[j], ref1) < 0) {
          return -1;
        }
      }
      return i + j + fuzz - 1;
    }
    looksObjectish(j) {
      var end, index;
      if (this.indexOfTag(j, "@", null, ":") !== -1 || this.indexOfTag(j, null, ":") !== -1) {
        return true;
      }
      index = this.indexOfTag(j, EXPRESSION_START);
      if (index !== -1) {
        end = null;
        this.detectEnd(index + 1, function(token) {
          var ref;
          return ref = token[0], indexOf.call(EXPRESSION_END, ref) >= 0;
        }, function(token, i) {
          return end = i;
        });
        if (this.tag(end + 1) === ":") {
          return true;
        }
      }
      return false;
    }
    findTagsBackwards(i, tags) {
      var backStack, ref, ref1, ref2, ref3, ref4, ref5;
      backStack = [];
      while (i >= 0 && (backStack.length || (ref2 = this.tag(i), indexOf.call(tags, ref2) < 0) && ((ref3 = this.tag(i), indexOf.call(EXPRESSION_START, ref3) < 0) || this.tokens[i].generated) && (ref4 = this.tag(i), indexOf.call(LINEBREAKS, ref4) < 0))) {
        if (ref = this.tag(i), indexOf.call(EXPRESSION_END, ref) >= 0) {
          backStack.push(this.tag(i));
        }
        if ((ref1 = this.tag(i), indexOf.call(EXPRESSION_START, ref1) >= 0) && backStack.length) {
          backStack.pop();
        }
        i -= 1;
      }
      return ref5 = this.tag(i), indexOf.call(tags, ref5) >= 0;
    }
    addImplicitBracesAndParens() {
      var stack, start, inTernary;
      stack = [];
      start = null;
      inTernary = false;
      return this.scanTokens(function(token, i, tokens) {
        var endImplicitCall, endImplicitObject, forward, implicitObjectContinues, implicitObjectIndent, inControlFlow, inImplicit, inImplicitCall, inImplicitControl, inImplicitObject, isImplicit, isImplicitCall, isImplicitObject, k2, newLine, nextTag, nextToken, offset, preContinuationLineIndent, preObjectToken, prevTag, prevToken, ref, ref1, ref2, ref3, ref4, ref5, s, sameLine, stackIdx, stackItem, stackNext, stackTag, stackTop, startIdx, startImplicitCall, startImplicitObject, startIndex, startTag, startsLine, tag;
        [tag] = token;
        [prevTag] = prevToken = i > 0 ? tokens[i - 1] : [];
        [nextTag] = nextToken = i < tokens.length - 1 ? tokens[i + 1] : [];
        stackTop = function() {
          return stack[stack.length - 1];
        };
        startIdx = i;
        forward = function(n) {
          return i - startIdx + n;
        };
        isImplicit = function(stackItem2) {
          var ref6;
          return stackItem2 != null ? (ref6 = stackItem2[2]) != null ? ref6.ours : undefined : undefined;
        };
        isImplicitObject = function(stackItem2) {
          return isImplicit(stackItem2) && (stackItem2 != null ? stackItem2[0] : undefined) === "{";
        };
        isImplicitCall = function(stackItem2) {
          return isImplicit(stackItem2) && (stackItem2 != null ? stackItem2[0] : undefined) === "(";
        };
        inImplicit = function() {
          return isImplicit(stackTop());
        };
        inImplicitCall = function() {
          return isImplicitCall(stackTop());
        };
        inImplicitObject = function() {
          return isImplicitObject(stackTop());
        };
        inImplicitControl = function() {
          var ref6;
          return inImplicit() && ((ref6 = stackTop()) != null ? ref6[0] : undefined) === "CONTROL";
        };
        startImplicitCall = function(idx) {
          stack.push([
            "(",
            idx,
            {
              ours: true
            }
          ]);
          return tokens.splice(idx, 0, generate("CALL_START", "(", ["", "implicit function call", token[2]], prevToken));
        };
        endImplicitCall = function() {
          stack.pop();
          tokens.splice(i, 0, generate("CALL_END", ")", ["", "end of input", token[2]], prevToken));
          return i += 1;
        };
        startImplicitObject = function(idx, { startsLine: startsLine2 = true, continuationLineIndent } = {}) {
          var val;
          stack.push([
            "{",
            idx,
            {
              sameLine: true,
              startsLine: startsLine2,
              ours: true,
              continuationLineIndent
            }
          ]);
          val = new String("{");
          val.generated = true;
          return tokens.splice(idx, 0, generate("{", val, token, prevToken));
        };
        endImplicitObject = function(j) {
          j = j != null ? j : i;
          stack.pop();
          tokens.splice(j, 0, generate("}", "}", token, prevToken));
          return i += 1;
        };
        implicitObjectContinues = (j) => {
          var nextTerminatorIdx;
          nextTerminatorIdx = null;
          this.detectEnd(j, function(token2) {
            return token2[0] === "TERMINATOR";
          }, function(token2, i2) {
            return nextTerminatorIdx = i2;
          }, {
            returnOnNegativeLevel: true
          });
          if (nextTerminatorIdx == null) {
            return false;
          }
          return this.looksObjectish(nextTerminatorIdx + 1);
        };
        if ((inImplicitCall() || inImplicitObject()) && indexOf.call(CONTROL_IN_IMPLICIT, tag) >= 0 || inImplicitObject() && prevTag === ":" && tag === "FOR") {
          stack.push([
            "CONTROL",
            i,
            {
              ours: true
            }
          ]);
          return forward(1);
        }
        if (tag === "INDENT" && inImplicit()) {
          if (prevTag !== "=>" && prevTag !== "->" && prevTag !== "[" && prevTag !== "(" && prevTag !== "," && prevTag !== "{" && prevTag !== "ELSE" && prevTag !== "=") {
            while (inImplicitCall() || inImplicitObject() && prevTag !== ":") {
              if (inImplicitCall()) {
                endImplicitCall();
              } else {
                endImplicitObject();
              }
            }
          }
          if (inImplicitControl()) {
            stack.pop();
          }
          stack.push([tag, i]);
          return forward(1);
        }
        if (indexOf.call(EXPRESSION_START, tag) >= 0) {
          stack.push([tag, i]);
          return forward(1);
        }
        if (indexOf.call(EXPRESSION_END, tag) >= 0) {
          while (inImplicit()) {
            if (inImplicitCall()) {
              endImplicitCall();
            } else if (inImplicitObject()) {
              endImplicitObject();
            } else {
              stack.pop();
            }
          }
          start = stack.pop();
        }
        inControlFlow = () => {
          var controlFlow, isFunc, seenFor, tagCurrentLine;
          seenFor = this.findTagsBackwards(i, ["FOR"]) && this.findTagsBackwards(i, ["FORIN", "FOROF", "FORFROM"]);
          controlFlow = seenFor || this.findTagsBackwards(i, ["WHILE", "UNTIL", "LOOP", "LEADING_WHEN"]);
          if (!controlFlow) {
            return false;
          }
          isFunc = false;
          tagCurrentLine = token[2].first_line;
          this.detectEnd(i, function(token2, i2) {
            var ref6;
            return ref6 = token2[0], indexOf.call(LINEBREAKS, ref6) >= 0;
          }, function(token2, i2) {
            var first_line;
            [prevTag, , { first_line }] = tokens[i2 - 1] || [];
            return isFunc = tagCurrentLine === first_line && (prevTag === "->" || prevTag === "=>");
          }, {
            returnOnNegativeLevel: true
          });
          return isFunc;
        };
        if ((indexOf.call(IMPLICIT_FUNC, tag) >= 0 && token.spaced || tag === "?" && i > 0 && !tokens[i - 1].spaced) && (indexOf.call(IMPLICIT_CALL, nextTag) >= 0 || nextTag === "..." && (ref = this.tag(i + 2), indexOf.call(IMPLICIT_CALL, ref) >= 0) && !this.findTagsBackwards(i, ["INDEX_START", "["]) || indexOf.call(IMPLICIT_UNSPACED_CALL, nextTag) >= 0 && !nextToken.spaced && !nextToken.newLine) && !inControlFlow()) {
          if (tag === "?") {
            tag = token[0] = "FUNC_EXIST";
          }
          startImplicitCall(i + 1);
          return forward(2);
        }
        if (indexOf.call(IMPLICIT_FUNC, tag) >= 0 && this.indexOfTag(i + 1, "INDENT") > -1 && this.looksObjectish(i + 2) && !this.findTagsBackwards(i, ["CLASS", "COMPONENT", "EXTENDS", "IF", "CATCH", "SWITCH", "LEADING_WHEN", "FOR", "WHILE", "UNTIL"]) && !(((ref1 = s = (ref2 = stackTop()) != null ? ref2[0] : undefined) === "{" || ref1 === "[") && !isImplicit(stackTop()) && this.findTagsBackwards(i, s))) {
          startImplicitCall(i + 1);
          stack.push(["INDENT", i + 2]);
          return forward(3);
        }
        if (tag === "SPACE?") {
          inTernary = true;
        }
        if (tag === ":") {
          if (inTernary) {
            inTernary = false;
            return forward(1);
          }
          s = function() {
            var ref32;
            switch (false) {
              case (ref32 = this.tag(i - 1), indexOf.call(EXPRESSION_END, ref32) < 0):
                [startTag, startIndex] = start;
                if (startTag === "[" && startIndex > 0 && this.tag(startIndex - 1) === "@" && !tokens[startIndex - 1].spaced) {
                  return startIndex - 1;
                } else {
                  return startIndex;
                }
                break;
              case this.tag(i - 2) !== "@":
                return i - 2;
              default:
                return i - 1;
            }
          }.call(this);
          startsLine = s <= 0 || (ref3 = this.tag(s - 1), indexOf.call(LINEBREAKS, ref3) >= 0) || tokens[s - 1].newLine;
          if (stackTop()) {
            [stackTag, stackIdx] = stackTop();
            stackNext = stack[stack.length - 2];
            if ((stackTag === "{" || stackTag === "INDENT" && (stackNext != null ? stackNext[0] : undefined) === "{" && !isImplicit(stackNext) && this.findTagsBackwards(stackIdx - 1, ["{"])) && (startsLine || this.tag(s - 1) === "," || this.tag(s - 1) === "{") && (ref4 = this.tag(s - 1), indexOf.call(UNFINISHED, ref4) < 0)) {
              return forward(1);
            }
          }
          preObjectToken = i > 1 ? tokens[i - 2] : [];
          startImplicitObject(s, {
            startsLine: !!startsLine,
            continuationLineIndent: preObjectToken.continuationLineIndent
          });
          return forward(2);
        }
        if (indexOf.call(LINEBREAKS, tag) >= 0) {
          for (k2 = stack.length - 1;k2 >= 0; k2 += -1) {
            stackItem = stack[k2];
            if (!isImplicit(stackItem)) {
              break;
            }
            if (isImplicitObject(stackItem)) {
              stackItem[2].sameLine = false;
            }
          }
        }
        if (tag === "TERMINATOR" && token.endsContinuationLineIndentation) {
          ({ preContinuationLineIndent } = token.endsContinuationLineIndentation);
          while (inImplicitObject() && (implicitObjectIndent = stackTop()[2].continuationLineIndent) != null && implicitObjectIndent > preContinuationLineIndent) {
            endImplicitObject();
          }
        }
        newLine = prevTag === "OUTDENT" || prevToken.newLine;
        if (indexOf.call(IMPLICIT_END, tag) >= 0 || indexOf.call(CALL_CLOSERS, tag) >= 0 && newLine || (tag === ".." || tag === "...") && this.findTagsBackwards(i, ["INDEX_START"])) {
          while (inImplicit()) {
            [stackTag, stackIdx, { sameLine, startsLine }] = stackTop();
            if (inImplicitCall() && prevTag !== "," || prevTag === "," && tag === "TERMINATOR" && nextTag == null) {
              endImplicitCall();
            } else if (inImplicitObject() && sameLine && tag !== "TERMINATOR" && prevTag !== ":" && !((tag === "POST_IF" || tag === "FOR" || tag === "WHILE" || tag === "UNTIL") && startsLine && implicitObjectContinues(i + 1))) {
              endImplicitObject();
            } else if (inImplicitObject() && tag === "TERMINATOR" && prevTag !== "," && !(startsLine && this.looksObjectish(i + 1))) {
              endImplicitObject();
            } else if (inImplicitControl() && tokens[stackTop()[1]][0] === "CLASS" && tag === "TERMINATOR") {
              stack.pop();
            } else {
              break;
            }
          }
        }
        if (tag === "," && !this.looksObjectish(i + 1) && inImplicitObject() && !((ref5 = this.tag(i + 2)) === "FOROF" || ref5 === "FORIN") && (nextTag !== "TERMINATOR" || !this.looksObjectish(i + 2))) {
          offset = nextTag === "OUTDENT" ? 1 : 0;
          while (inImplicitObject()) {
            endImplicitObject(i + offset);
          }
        }
        return forward(1);
      });
    }
    rescueStowawayComments() {
      var dontShiftForward, insertPlaceholder, shiftCommentsBackward, shiftCommentsForward;
      insertPlaceholder = function(token, j, tokens, method) {
        if (tokens[j][0] !== "TERMINATOR") {
          tokens[method](generate("TERMINATOR", `
`, tokens[j]));
        }
        return tokens[method](generate("JS", "", tokens[j], token));
      };
      dontShiftForward = function(i, tokens) {
        var j, ref;
        j = i + 1;
        while (j !== tokens.length && (ref = tokens[j][0], indexOf.call(DISCARDED, ref) >= 0)) {
          if (tokens[j][0] === "INTERPOLATION_END") {
            return true;
          }
          j++;
        }
        return false;
      };
      shiftCommentsForward = function(token, i, tokens) {
        var comment, j, k2, len2, ref, ref1, ref2;
        j = i;
        while (j !== tokens.length && (ref = tokens[j][0], indexOf.call(DISCARDED, ref) >= 0)) {
          j++;
        }
        if (!(j === tokens.length || (ref1 = tokens[j][0], indexOf.call(DISCARDED, ref1) >= 0))) {
          ref2 = token.comments;
          for (k2 = 0, len2 = ref2.length;k2 < len2; k2++) {
            comment = ref2[k2];
            comment.unshift = true;
          }
          moveComments(token, tokens[j]);
          return 1;
        } else {
          j = tokens.length - 1;
          insertPlaceholder(token, j, tokens, "push");
          return 1;
        }
      };
      shiftCommentsBackward = function(token, i, tokens) {
        var j, ref, ref1;
        j = i;
        while (j !== -1 && (ref = tokens[j][0], indexOf.call(DISCARDED, ref) >= 0)) {
          j--;
        }
        if (!(j === -1 || (ref1 = tokens[j][0], indexOf.call(DISCARDED, ref1) >= 0))) {
          moveComments(token, tokens[j]);
          return 1;
        } else {
          insertPlaceholder(token, 0, tokens, "unshift");
          return 3;
        }
      };
      return this.scanTokens(function(token, i, tokens) {
        var dummyToken, j, ref, ref1, ret;
        if (!token.comments) {
          return 1;
        }
        ret = 1;
        if (ref = token[0], indexOf.call(DISCARDED, ref) >= 0) {
          dummyToken = {
            comments: []
          };
          j = token.comments.length - 1;
          while (j !== -1) {
            if (token.comments[j].newLine === false && token.comments[j].here === false) {
              dummyToken.comments.unshift(token.comments[j]);
              token.comments.splice(j, 1);
            }
            j--;
          }
          if (dummyToken.comments.length !== 0) {
            ret = shiftCommentsBackward(dummyToken, i - 1, tokens);
          }
          if (token.comments.length !== 0) {
            shiftCommentsForward(token, i, tokens);
          }
        } else if (!dontShiftForward(i, tokens)) {
          dummyToken = {
            comments: []
          };
          j = token.comments.length - 1;
          while (j !== -1) {
            if (token.comments[j].newLine && !token.comments[j].unshift && !(token[0] === "JS" && token.generated)) {
              dummyToken.comments.unshift(token.comments[j]);
              token.comments.splice(j, 1);
            }
            j--;
          }
          if (dummyToken.comments.length !== 0) {
            ret = shiftCommentsForward(dummyToken, i + 1, tokens);
          }
        }
        if (((ref1 = token.comments) != null ? ref1.length : undefined) === 0) {
          delete token.comments;
        }
        return ret;
      });
    }
    addLocationDataToGeneratedTokens() {
      return this.scanTokens(function(token, i, tokens) {
        var column, line, nextLocation, prevLocation, rangeIndex, ref, ref1;
        if (token[2]) {
          return 1;
        }
        if (!(token.generated || token.explicit)) {
          return 1;
        }
        if (token.fromThen && token[0] === "INDENT") {
          token[2] = token.origin[2];
          return 1;
        }
        if (token[0] === "{" && (nextLocation = (ref = tokens[i + 1]) != null ? ref[2] : undefined)) {
          ({
            first_line: line,
            first_column: column,
            range: [rangeIndex]
          } = nextLocation);
        } else if (prevLocation = (ref1 = tokens[i - 1]) != null ? ref1[2] : undefined) {
          ({
            last_line: line,
            last_column: column,
            range: [, rangeIndex]
          } = prevLocation);
          column += 1;
        } else {
          line = column = 0;
          rangeIndex = 0;
        }
        token[2] = {
          first_line: line,
          first_column: column,
          last_line: line,
          last_column: column,
          last_line_exclusive: line,
          last_column_exclusive: column,
          range: [rangeIndex, rangeIndex]
        };
        return 1;
      });
    }
    fixIndentationLocationData() {
      var findPrecedingComment;
      if (this.allComments == null) {
        this.allComments = extractAllCommentTokens(this.tokens);
      }
      findPrecedingComment = (token, { afterPosition, indentSize, first, indented }) => {
        var comment, k2, l, lastMatching, matches, ref, ref1, tokenStart;
        tokenStart = token[2].range[0];
        matches = function(comment2) {
          if (comment2.outdented) {
            if (!(indentSize != null && comment2.indentSize > indentSize)) {
              return false;
            }
          }
          if (indented && !comment2.indented) {
            return false;
          }
          if (!(comment2.locationData.range[0] < tokenStart)) {
            return false;
          }
          if (!(comment2.locationData.range[0] > afterPosition)) {
            return false;
          }
          return true;
        };
        if (first) {
          lastMatching = null;
          ref = this.allComments;
          for (k2 = ref.length - 1;k2 >= 0; k2 += -1) {
            comment = ref[k2];
            if (matches(comment)) {
              lastMatching = comment;
            } else if (lastMatching) {
              return lastMatching;
            }
          }
          return lastMatching;
        }
        ref1 = this.allComments;
        for (l = ref1.length - 1;l >= 0; l += -1) {
          comment = ref1[l];
          if (matches(comment)) {
            return comment;
          }
        }
        return null;
      };
      return this.scanTokens(function(token, i, tokens) {
        var isIndent, nextToken, nextTokenIndex, precedingComment, prevLocationData, prevToken, ref, ref1, ref2, useNextToken;
        if (!((ref = token[0]) === "INDENT" || ref === "OUTDENT" || token.generated && token[0] === "CALL_END" && !((ref1 = token.data) != null ? ref1.closingTagNameToken : undefined) || token.generated && token[0] === "}")) {
          return 1;
        }
        isIndent = token[0] === "INDENT";
        prevToken = (ref2 = token.prevToken) != null ? ref2 : tokens[i - 1];
        prevLocationData = prevToken[2];
        useNextToken = token.explicit || token.generated;
        if (useNextToken) {
          nextToken = token;
          nextTokenIndex = i;
          while ((nextToken.explicit || nextToken.generated) && nextTokenIndex !== tokens.length - 1) {
            nextToken = tokens[nextTokenIndex++];
          }
        }
        precedingComment = findPrecedingComment(useNextToken ? nextToken : token, {
          afterPosition: prevLocationData.range[0],
          indentSize: token.indentSize,
          first: isIndent,
          indented: useNextToken
        });
        if (isIndent) {
          if (!(precedingComment != null ? precedingComment.newLine : undefined)) {
            return 1;
          }
        }
        if (token.generated && token[0] === "CALL_END" && (precedingComment != null ? precedingComment.indented : undefined)) {
          return 1;
        }
        if (precedingComment != null) {
          prevLocationData = precedingComment.locationData;
        }
        token[2] = {
          first_line: precedingComment != null ? prevLocationData.first_line : prevLocationData.last_line,
          first_column: precedingComment != null ? isIndent ? 0 : prevLocationData.first_column : prevLocationData.last_column,
          last_line: prevLocationData.last_line,
          last_column: prevLocationData.last_column,
          last_line_exclusive: prevLocationData.last_line_exclusive,
          last_column_exclusive: prevLocationData.last_column_exclusive,
          range: isIndent && precedingComment != null ? [prevLocationData.range[0] - precedingComment.indentSize, prevLocationData.range[1]] : prevLocationData.range
        };
        return 1;
      });
    }
    normalizeLines() {
      var action, closeElseTag, condition, ifThens, indent, leading_if_then, leading_switch_when, outdent, starter;
      starter = indent = outdent = null;
      leading_switch_when = null;
      leading_if_then = null;
      ifThens = [];
      condition = function(token, i) {
        var ref, ref1, ref2, ref3;
        return token[1] !== ";" && (ref = token[0], indexOf.call(SINGLE_CLOSERS, ref) >= 0) && !(token[0] === "TERMINATOR" && (ref1 = this.tag(i + 1), indexOf.call(EXPRESSION_CLOSE, ref1) >= 0)) && !(token[0] === "ELSE" && (starter !== "THEN" || (leading_if_then || leading_switch_when))) && !(((ref2 = token[0]) === "CATCH" || ref2 === "FINALLY") && (starter === "->" || starter === "=>")) || (ref3 = token[0], indexOf.call(CALL_CLOSERS, ref3) >= 0) && (this.tokens[i - 1].newLine || this.tokens[i - 1][0] === "OUTDENT");
      };
      action = function(token, i) {
        if (token[0] === "ELSE" && starter === "THEN") {
          ifThens.pop();
        }
        return this.tokens.splice(this.tag(i - 1) === "," ? i - 1 : i, 0, outdent);
      };
      closeElseTag = (tokens, i) => {
        var lastThen, outdentElse, tlen;
        tlen = ifThens.length;
        if (!(tlen > 0)) {
          return i;
        }
        lastThen = ifThens.pop();
        [, outdentElse] = this.indentation(tokens[lastThen]);
        outdentElse[1] = tlen * 2;
        tokens.splice(i, 0, outdentElse);
        outdentElse[1] = 2;
        tokens.splice(i + 1, 0, outdentElse);
        this.detectEnd(i + 2, function(token, i2) {
          var ref;
          return (ref = token[0]) === "OUTDENT" || ref === "TERMINATOR";
        }, function(token, i2) {
          if (this.tag(i2) === "OUTDENT" && this.tag(i2 + 1) === "OUTDENT") {
            return tokens.splice(i2, 2);
          }
        });
        return i + 2;
      };
      return this.scanTokens(function(token, i, tokens) {
        var conditionTag, j, k2, ref, ref1, ref2, tag;
        [tag] = token;
        conditionTag = (tag === "->" || tag === "=>") && this.findTagsBackwards(i, ["IF", "WHILE", "FOR", "UNTIL", "SWITCH", "WHEN", "LEADING_WHEN", "[", "INDEX_START"]) && !this.findTagsBackwards(i, ["THEN", "..", "..."]);
        if (tag === "TERMINATOR") {
          if (this.tag(i + 1) === "ELSE" && this.tag(i - 1) !== "OUTDENT") {
            tokens.splice(i, 1, ...this.indentation());
            return 1;
          }
          if (ref = this.tag(i + 1), indexOf.call(EXPRESSION_CLOSE, ref) >= 0) {
            if (token[1] === ";" && this.tag(i + 1) === "OUTDENT") {
              tokens[i + 1].prevToken = token;
              moveComments(token, tokens[i + 1]);
            }
            tokens.splice(i, 1);
            return 0;
          }
        }
        if (tag === "CATCH") {
          for (j = k2 = 1;k2 <= 2; j = ++k2) {
            if (!((ref1 = this.tag(i + j)) === "OUTDENT" || ref1 === "TERMINATOR" || ref1 === "FINALLY")) {
              continue;
            }
            tokens.splice(i + j, 0, ...this.indentation());
            return 2 + j;
          }
        }
        if ((tag === "->" || tag === "=>") && ((ref2 = this.tag(i + 1)) === "," || ref2 === "]" || this.tag(i + 1) === "." && token.newLine)) {
          [indent, outdent] = this.indentation(tokens[i]);
          tokens.splice(i + 1, 0, indent, outdent);
          return 1;
        }
        if (indexOf.call(SINGLE_LINERS, tag) >= 0 && this.tag(i + 1) !== "INDENT" && !(tag === "ELSE" && this.tag(i + 1) === "IF") && !conditionTag) {
          starter = tag;
          [indent, outdent] = this.indentation(tokens[i]);
          if (starter === "THEN") {
            indent.fromThen = true;
          }
          if (tag === "THEN") {
            leading_switch_when = this.findTagsBackwards(i, ["LEADING_WHEN"]) && this.tag(i + 1) === "IF";
            leading_if_then = this.findTagsBackwards(i, ["IF"]) && this.tag(i + 1) === "IF";
          }
          if (tag === "THEN" && this.findTagsBackwards(i, ["IF"])) {
            ifThens.push(i);
          }
          if (tag === "ELSE" && this.tag(i - 1) !== "OUTDENT") {
            i = closeElseTag(tokens, i);
          }
          tokens.splice(i + 1, 0, indent);
          this.detectEnd(i + 2, condition, action);
          if (tag === "THEN") {
            tokens.splice(i, 1);
          }
          return 1;
        }
        return 1;
      });
    }
    processTemplateTokens() {
      let inRender = false;
      let renderIndentLevel = 0;
      let currentIndent = 0;
      let pendingCallEnds = [];
      const isHtmlTag = (name) => {
        const tagPart = name.split("#")[0];
        return TEMPLATE_TAGS.has(tagPart);
      };
      const isComponent = (name) => {
        if (!name || typeof name !== "string")
          return false;
        return /^[A-Z]/.test(name);
      };
      const isTemplateTag = (name) => {
        return isHtmlTag(name) || isComponent(name);
      };
      const startsWithHtmlTag = (tokens, i) => {
        let j = i;
        while (j > 0) {
          const pt = tokens[j - 1][0];
          if (pt === "INDENT" || pt === "OUTDENT" || pt === "TERMINATOR" || pt === "RENDER" || pt === "CALL_END" || pt === ")") {
            break;
          }
          j--;
        }
        return tokens[j] && tokens[j][0] === "IDENTIFIER" && isHtmlTag(tokens[j][1]);
      };
      return this.scanTokens(function(token, i, tokens) {
        const tag = token[0];
        const nextToken = i < tokens.length - 1 ? tokens[i + 1] : null;
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
            const callEndToken = ["CALL_END", ")", token[2]];
            callEndToken.generated = true;
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
        if (tag === ".") {
          const prevToken = i > 0 ? tokens[i - 1] : null;
          const prevTag = prevToken ? prevToken[0] : null;
          if (prevTag === "INDENT" || prevTag === "TERMINATOR") {
            if (nextToken && nextToken[0] === "PROPERTY") {
              const divToken = ["IDENTIFIER", "div", token[2]];
              divToken.generated = true;
              tokens.splice(i, 0, divToken);
              return 2;
            }
          }
        }
        if (tag === "IDENTIFIER" || tag === "PROPERTY") {
          const next = tokens[i + 1];
          const nextNext = tokens[i + 2];
          if (next && next[0] === "#" && nextNext && nextNext[0] === "PROPERTY") {
            token[1] = token[1] + "#" + nextNext[1];
            if (nextNext.spaced)
              token.spaced = true;
            tokens.splice(i + 1, 2);
            return 1;
          }
        }
        if (tag === "BIND") {
          const prevToken = i > 0 ? tokens[i - 1] : null;
          const nextBindToken = tokens[i + 1];
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
              const openBracket = ["[", "[", token[2]];
              openBracket.generated = true;
              tokens.splice(i, 0, openBracket);
              const closeBracket = ["]", "]", tokens[j + 1][2]];
              closeBracket.generated = true;
              tokens.splice(j + 1, 0, closeBracket);
              return 2;
            }
          }
        }
        if (tag === "." && nextToken && nextToken[0] === "(") {
          const prevToken = i > 0 ? tokens[i - 1] : null;
          const prevTag = prevToken ? prevToken[0] : null;
          const atLineStart = prevTag === "INDENT" || prevTag === "TERMINATOR";
          const cxToken = ["PROPERTY", "__cx__", token[2]];
          cxToken.generated = true;
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
            const divToken = ["IDENTIFIER", "div", token[2]];
            divToken.generated = true;
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
              const commaToken = [",", ",", token[2]];
              commaToken.generated = true;
              const arrowToken = ["->", "->", token[2]];
              arrowToken.newLine = true;
              tokens.splice(i + 1, 0, commaToken, arrowToken);
              return 3;
            }
          }
          if (isTemplateElement) {
            const callStartToken = ["CALL_START", "(", token[2]];
            callStartToken.generated = true;
            const arrowToken = ["->", "->", token[2]];
            arrowToken.newLine = true;
            tokens.splice(i + 1, 0, callStartToken, arrowToken);
            pendingCallEnds.push(currentIndent + 1);
            return 3;
          }
        }
        return 1;
      });
    }
    convertLegacyExistential() {
      return this.scanTokens(function(token, i, tokens) {
        var colonFound, j, nestLevel, ref, tag;
        if (token[0] !== "SPACE?") {
          return 1;
        }
        colonFound = false;
        nestLevel = 0;
        for (j = i + 1;j < tokens.length; j++) {
          tag = tokens[j][0];
          if (ref = tag, indexOf.call(EXPRESSION_START, ref) >= 0) {
            nestLevel++;
          } else if (ref = tag, indexOf.call(EXPRESSION_END, ref) >= 0) {
            nestLevel--;
          }
          if (tag === ":" && nestLevel === 0) {
            colonFound = true;
            break;
          }
          if (nestLevel === 0 && (tag === "TERMINATOR" || tag === "INDENT" || tag === "OUTDENT")) {
            break;
          }
        }
        if (!colonFound) {
          token[0] = "??";
          token[1] = "??";
        }
        return 1;
      });
    }
    convertPostfixSpreadRest() {
      return this.scanTokens(function(token, i, tokens) {
        var definiteSpreadNext, inIndexContext, lastIndexEnd, lastIndexStart, next, nextTag, prev, prevTag, ref, validPostfixTokens;
        if (token[0] !== "..." && token[0] !== "..") {
          return 1;
        }
        let bracketDepth = 0;
        for (let j = i - 1;j >= 0; j--) {
          if (tokens[j][0] === "INDEX_END") {
            bracketDepth++;
          }
          if (tokens[j][0] === "INDEX_START") {
            bracketDepth--;
          }
        }
        inIndexContext = bracketDepth < 0;
        if (inIndexContext) {
          return 1;
        }
        prev = tokens[i - 1];
        next = tokens[i + 1];
        if (!prev || !next) {
          return 1;
        }
        prevTag = prev[0];
        nextTag = next[0];
        if (prevTag === "," && nextTag === ",") {
          return 1;
        }
        if (prevTag === "NUMBER") {
          return 1;
        }
        validPostfixTokens = ["IDENTIFIER", "PROPERTY", ")", "]", "THIS", "@"];
        if (ref = prevTag, indexOf.call(validPostfixTokens, ref) >= 0) {
          definiteSpreadNext = [",", "]", ")", "}", "CALL_END", "INDEX_END", "PARAM_END", "TERMINATOR", "OUTDENT"];
          if (ref = nextTag, indexOf.call(definiteSpreadNext, ref) >= 0) {
            tokens[i - 1] = token;
            tokens[i] = prev;
            return 1;
          }
        }
        return 1;
      });
    }
    tagPostfixConditionals() {
      var action, condition, original;
      original = null;
      condition = function(token, i) {
        var prevTag, tag;
        [tag] = token;
        [prevTag] = this.tokens[i - 1];
        return tag === "TERMINATOR" || tag === "INDENT" && indexOf.call(SINGLE_LINERS, prevTag) < 0;
      };
      action = function(token, i) {
        if (token[0] !== "INDENT" || token.generated && !token.fromThen) {
          return original[0] = "POST_" + original[0];
        }
      };
      return this.scanTokens(function(token, i) {
        if (token[0] !== "IF" && token[0] !== "UNLESS") {
          return 1;
        }
        original = token;
        this.detectEnd(i + 1, condition, action);
        return 1;
      });
    }
    exposeTokenDataToGrammar() {
      return this.scanTokens(function(token, i) {
        var ref, ref1, val;
        if (token.generated || token.data && Object.keys(token.data).length !== 0) {
          token[1] = new String(token[1]);
          ref1 = (ref = token.data) != null ? ref : {};
          for (key in ref1) {
            if (!hasProp.call(ref1, key))
              continue;
            val = ref1[key];
            token[1][key] = val;
          }
          if (token.generated) {
            token[1].generated = true;
          }
        }
        return 1;
      });
    }
    indentation(origin) {
      var indent, outdent;
      indent = ["INDENT", 2];
      outdent = ["OUTDENT", 2];
      if (origin) {
        indent.generated = outdent.generated = true;
        indent.origin = outdent.origin = origin;
      } else {
        indent.explicit = outdent.explicit = true;
      }
      return [indent, outdent];
    }
    tag(i) {
      var ref;
      return (ref = this.tokens[i]) != null ? ref[0] : undefined;
    }
  }
  Rewriter2.prototype.generate = generate;
  return Rewriter2;
}.call(null);
BALANCED_PAIRS = [["(", ")"], ["[", "]"], ["{", "}"], ["INDENT", "OUTDENT"], ["CALL_START", "CALL_END"], ["PARAM_START", "PARAM_END"], ["INDEX_START", "INDEX_END"], ["STRING_START", "STRING_END"], ["INTERPOLATION_START", "INTERPOLATION_END"], ["REGEX_START", "REGEX_END"]];
INVERSES = {};
EXPRESSION_START = [];
EXPRESSION_END = [];
for (k = 0, len = BALANCED_PAIRS.length;k < len; k++) {
  [left, right] = BALANCED_PAIRS[k];
  EXPRESSION_START.push(INVERSES[right] = left);
  EXPRESSION_END.push(INVERSES[left] = right);
}
EXPRESSION_CLOSE = ["CATCH", "THEN", "ELSE", "FINALLY"].concat(EXPRESSION_END);
IMPLICIT_FUNC = ["IDENTIFIER", "PROPERTY", "SUPER", ")", "CALL_END", "]", "INDEX_END", "@", "THIS"];
IMPLICIT_CALL = ["IDENTIFIER", "PROPERTY", "NUMBER", "INFINITY", "NAN", "STRING", "STRING_START", "REGEX", "REGEX_START", "JS", "NEW", "PARAM_START", "CLASS", "IF", "TRY", "SWITCH", "THIS", "DYNAMIC_IMPORT", "IMPORT_META", "NEW_TARGET", "UNDEFINED", "NULL", "BOOL", "UNARY", "DO", "DO_IIFE", "YIELD", "AWAIT", "UNARY_MATH", "SUPER", "THROW", "@", "->", "=>", "[", "(", "{", "--", "++"];
IMPLICIT_UNSPACED_CALL = ["+", "-"];
IMPLICIT_END = ["POST_IF", "FOR", "WHILE", "UNTIL", "WHEN", "BY", "LOOP", "TERMINATOR"];
SINGLE_LINERS = ["ELSE", "->", "=>", "TRY", "FINALLY", "THEN"];
SINGLE_CLOSERS = ["TERMINATOR", "CATCH", "FINALLY", "ELSE", "OUTDENT", "LEADING_WHEN"];
LINEBREAKS = ["TERMINATOR", "INDENT", "OUTDENT"];
CALL_CLOSERS = [".", "?.", "::", "?::"];
CONTROL_IN_IMPLICIT = ["IF", "TRY", "FINALLY", "CATCH", "CLASS", "COMPONENT", "SWITCH"];
DISCARDED = ["(", ")", "[", "]", "{", "}", ":", ".", "..", "...", ",", "=", "++", "--", "?", "AS", "AWAIT", "CALL_START", "CALL_END", "DEFAULT", "DO", "DO_IIFE", "ELSE", "EXTENDS", "EXPORT", "FORIN", "FOROF", "FORFROM", "IMPORT", "INDENT", "INDEX_SOAK", "INTERPOLATION_START", "INTERPOLATION_END", "LEADING_WHEN", "OUTDENT", "PARAM_END", "REGEX_START", "REGEX_END", "RETURN", "STRING_END", "THROW", "UNARY", "YIELD"].concat(IMPLICIT_UNSPACED_CALL.concat(IMPLICIT_END.concat(CALL_CLOSERS.concat(CONTROL_IN_IMPLICIT))));
UNFINISHED = ["\\", ".", "?.", "?::", "UNARY", "DO", "DO_IIFE", "MATH", "UNARY_MATH", "+", "-", "**", "SHIFT", "RELATION", "COMPARE", "&", "^", "|", "&&", "||", "SPACE?", "EXTENDS"];
// src/parser.js
var parserInstance = {
  symbolIds: { $accept: 0, $end: 1, error: 2, Root: 3, Body: 4, Line: 5, TERMINATOR: 6, Expression: 7, ExpressionLine: 8, Statement: 9, Return: 10, STATEMENT: 11, Import: 12, Export: 13, Value: 14, Code: 15, Operation: 16, Assign: 17, ReactiveAssign: 18, DerivedAssign: 19, ReadonlyAssign: 20, ExposedMethod: 21, EffectBlock: 22, RenderBlock: 23, StyleBlock: 24, Component: 25, If: 26, Try: 27, While: 28, For: 29, Switch: 30, Class: 31, Throw: 32, Yield: 33, Def: 34, DEF: 35, Identifier: 36, CALL_START: 37, ParamList: 38, CALL_END: 39, Block: 40, Assignable: 41, REACTIVE_ASSIGN: 42, INDENT: 43, OUTDENT: 44, DERIVED_ASSIGN: 45, READONLY_ASSIGN: 46, EXPOSED_ARROW: 47, EFFECT: 48, FuncGlyph: 49, RENDER: 50, STYLE: 51, COMPONENT: 52, ComponentBody: 53, ComponentLine: 54, PropDecl: 55, "@": 56, PROPERTY: 57, "?": 58, "=": 59, "...": 60, IDENTIFIER: 61, CodeLine: 62, OperationLine: 63, YIELD: 64, Object: 65, FROM: 66, Property: 67, AlphaNumeric: 68, NUMBER: 69, String: 70, STRING: 71, STRING_START: 72, Interpolations: 73, STRING_END: 74, InterpolationChunk: 75, INTERPOLATION_START: 76, INTERPOLATION_END: 77, Regex: 78, REGEX: 79, REGEX_START: 80, Invocation: 81, REGEX_END: 82, RegexWithIndex: 83, ",": 84, Literal: 85, JS: 86, UNDEFINED: 87, NULL: 88, BOOL: 89, INFINITY: 90, NAN: 91, AssignObj: 92, ObjAssignable: 93, ObjRestValue: 94, ":": 95, SimpleObjAssignable: 96, ThisProperty: 97, "[": 98, "]": 99, ObjSpreadExpr: 100, Parenthetical: 101, Super: 102, This: 103, SUPER: 104, OptFuncExist: 105, Arguments: 106, DYNAMIC_IMPORT: 107, ".": 108, "?.": 109, "::": 110, "?::": 111, INDEX_START: 112, INDEX_END: 113, INDEX_SOAK: 114, RETURN: 115, PARAM_START: 116, PARAM_END: 117, "->": 118, "=>": 119, OptComma: 120, Param: 121, ParamVar: 122, Array: 123, Splat: 124, SimpleAssignable: 125, Slice: 126, ES6_OPTIONAL_INDEX: 127, Range: 128, DoIife: 129, MetaProperty: 130, NEW_TARGET: 131, IMPORT_META: 132, "{": 133, FOR: 134, ForVariables: 135, FOROF: 136, "}": 137, WHEN: 138, OWN: 139, AssignList: 140, CLASS: 141, EXTENDS: 142, IMPORT: 143, ImportDefaultSpecifier: 144, ImportNamespaceSpecifier: 145, ImportSpecifierList: 146, ImportSpecifier: 147, AS: 148, DEFAULT: 149, IMPORT_ALL: 150, EXPORT: 151, ExportSpecifierList: 152, EXPORT_ALL: 153, ExportSpecifier: 154, ES6_OPTIONAL_CALL: 155, FUNC_EXIST: 156, ArgList: 157, THIS: 158, Elisions: 159, ArgElisionList: 160, OptElisions: 161, RangeDots: 162, "..": 163, Arg: 164, ArgElision: 165, Elision: 166, SimpleArgs: 167, TRY: 168, Catch: 169, FINALLY: 170, CATCH: 171, THROW: 172, "(": 173, ")": 174, WhileSource: 175, WHILE: 176, UNTIL: 177, Loop: 178, LOOP: 179, FORIN: 180, BY: 181, FORFROM: 182, AWAIT: 183, ForValue: 184, SWITCH: 185, Whens: 186, ELSE: 187, When: 188, LEADING_WHEN: 189, IfBlock: 190, IF: 191, UnlessBlock: 192, UNLESS: 193, POST_IF: 194, POST_UNLESS: 195, UNARY: 196, DO: 197, DO_IIFE: 198, UNARY_MATH: 199, "-": 200, "+": 201, "--": 202, "++": 203, MATH: 204, "**": 205, SHIFT: 206, COMPARE: 207, "&": 208, "^": 209, "|": 210, "&&": 211, "||": 212, "??": 213, "!?": 214, RELATION: 215, "SPACE?": 216, COMPOUND_ASSIGN: 217 },
  tokenNames: { 2: "error", 6: "TERMINATOR", 11: "STATEMENT", 35: "DEF", 37: "CALL_START", 39: "CALL_END", 42: "REACTIVE_ASSIGN", 43: "INDENT", 44: "OUTDENT", 45: "DERIVED_ASSIGN", 46: "READONLY_ASSIGN", 47: "EXPOSED_ARROW", 48: "EFFECT", 50: "RENDER", 51: "STYLE", 52: "COMPONENT", 56: "@", 57: "PROPERTY", 58: "?", 59: "=", 60: "...", 61: "IDENTIFIER", 64: "YIELD", 66: "FROM", 69: "NUMBER", 71: "STRING", 72: "STRING_START", 74: "STRING_END", 76: "INTERPOLATION_START", 77: "INTERPOLATION_END", 79: "REGEX", 80: "REGEX_START", 82: "REGEX_END", 84: ",", 86: "JS", 87: "UNDEFINED", 88: "NULL", 89: "BOOL", 90: "INFINITY", 91: "NAN", 95: ":", 98: "[", 99: "]", 104: "SUPER", 107: "DYNAMIC_IMPORT", 108: ".", 109: "?.", 110: "::", 111: "?::", 112: "INDEX_START", 113: "INDEX_END", 114: "INDEX_SOAK", 115: "RETURN", 116: "PARAM_START", 117: "PARAM_END", 118: "->", 119: "=>", 127: "ES6_OPTIONAL_INDEX", 131: "NEW_TARGET", 132: "IMPORT_META", 133: "{", 134: "FOR", 136: "FOROF", 137: "}", 138: "WHEN", 139: "OWN", 141: "CLASS", 142: "EXTENDS", 143: "IMPORT", 148: "AS", 149: "DEFAULT", 150: "IMPORT_ALL", 151: "EXPORT", 153: "EXPORT_ALL", 155: "ES6_OPTIONAL_CALL", 156: "FUNC_EXIST", 158: "THIS", 163: "..", 168: "TRY", 170: "FINALLY", 171: "CATCH", 172: "THROW", 173: "(", 174: ")", 176: "WHILE", 177: "UNTIL", 179: "LOOP", 180: "FORIN", 181: "BY", 182: "FORFROM", 183: "AWAIT", 185: "SWITCH", 187: "ELSE", 189: "LEADING_WHEN", 191: "IF", 193: "UNLESS", 194: "POST_IF", 195: "POST_UNLESS", 196: "UNARY", 197: "DO", 198: "DO_IIFE", 199: "UNARY_MATH", 200: "-", 201: "+", 202: "--", 203: "++", 204: "MATH", 205: "**", 206: "SHIFT", 207: "COMPARE", 208: "&", 209: "^", 210: "|", 211: "&&", 212: "||", 213: "??", 214: "!?", 215: "RELATION", 216: "SPACE?", 217: "COMPOUND_ASSIGN" },
  parseTable: [{ 1: -1, 3: 1, 4: 2, 5: 3, 7: 4, 8: 5, 9: 6, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: 0 }, { 1: -2, 6: 108 }, { 1: -3, 6: -3, 44: -3, 77: -3, 174: -3 }, { 1: -6, 6: -6, 39: -6, 43: -6, 44: -6, 58: 109, 77: -6, 84: -6, 99: -6, 134: 128, 174: -6, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -7, 6: -7, 39: -7, 43: -7, 44: -7, 77: -7, 84: -7, 99: -7, 174: -7 }, { 1: -8, 6: -8, 39: -8, 43: -8, 44: -8, 77: -8, 84: -8, 99: -8, 174: -8, 175: 131, 176: 97, 177: 98, 194: 129, 195: 130 }, { 1: -13, 6: -13, 37: -267, 39: -13, 43: -13, 44: -13, 58: -13, 60: -13, 71: -267, 72: -267, 77: -13, 84: -13, 95: -13, 99: -13, 105: 132, 108: 134, 109: 135, 110: 136, 111: 137, 112: 138, 113: -13, 114: 139, 117: -13, 127: 140, 134: -13, 136: -13, 137: -13, 138: -13, 155: 133, 156: 141, 163: -13, 174: -13, 176: -13, 177: -13, 180: -13, 181: -13, 182: -13, 194: -13, 195: -13, 200: -13, 201: -13, 204: -13, 205: -13, 206: -13, 207: -13, 208: -13, 209: -13, 210: -13, 211: -13, 212: -13, 213: -13, 214: -13, 215: -13, 216: -13 }, { 1: -14, 6: -14, 39: -14, 43: -14, 44: -14, 58: -14, 60: -14, 77: -14, 84: -14, 95: -14, 99: -14, 108: 142, 109: 143, 110: 144, 111: 145, 112: 146, 113: -14, 114: 147, 117: -14, 134: -14, 136: -14, 137: -14, 138: -14, 163: -14, 174: -14, 176: -14, 177: -14, 180: -14, 181: -14, 182: -14, 194: -14, 195: -14, 200: -14, 201: -14, 204: -14, 205: -14, 206: -14, 207: -14, 208: -14, 209: -14, 210: -14, 211: -14, 212: -14, 213: -14, 214: -14, 215: -14, 216: -14 }, { 1: -15, 6: -15, 39: -15, 43: -15, 44: -15, 58: -15, 60: -15, 77: -15, 84: -15, 95: -15, 99: -15, 113: -15, 117: -15, 134: -15, 136: -15, 137: -15, 138: -15, 163: -15, 174: -15, 176: -15, 177: -15, 180: -15, 181: -15, 182: -15, 194: -15, 195: -15, 200: -15, 201: -15, 204: -15, 205: -15, 206: -15, 207: -15, 208: -15, 209: -15, 210: -15, 211: -15, 212: -15, 213: -15, 214: -15, 215: -15, 216: -15 }, { 1: -16, 6: -16, 39: -16, 43: -16, 44: -16, 58: -16, 60: -16, 77: -16, 84: -16, 95: -16, 99: -16, 113: -16, 117: -16, 134: -16, 136: -16, 137: -16, 138: -16, 163: -16, 174: -16, 176: -16, 177: -16, 180: -16, 181: -16, 182: -16, 194: -16, 195: -16, 200: -16, 201: -16, 204: -16, 205: -16, 206: -16, 207: -16, 208: -16, 209: -16, 210: -16, 211: -16, 212: -16, 213: -16, 214: -16, 215: -16, 216: -16 }, { 1: -17, 6: -17, 39: -17, 43: -17, 44: -17, 58: -17, 60: -17, 77: -17, 84: -17, 95: -17, 99: -17, 113: -17, 117: -17, 134: -17, 136: -17, 137: -17, 138: -17, 163: -17, 174: -17, 176: -17, 177: -17, 180: -17, 181: -17, 182: -17, 194: -17, 195: -17, 200: -17, 201: -17, 204: -17, 205: -17, 206: -17, 207: -17, 208: -17, 209: -17, 210: -17, 211: -17, 212: -17, 213: -17, 214: -17, 215: -17, 216: -17 }, { 1: -18, 6: -18, 39: -18, 43: -18, 44: -18, 58: -18, 60: -18, 77: -18, 84: -18, 95: -18, 99: -18, 113: -18, 117: -18, 134: -18, 136: -18, 137: -18, 138: -18, 163: -18, 174: -18, 176: -18, 177: -18, 180: -18, 181: -18, 182: -18, 194: -18, 195: -18, 200: -18, 201: -18, 204: -18, 205: -18, 206: -18, 207: -18, 208: -18, 209: -18, 210: -18, 211: -18, 212: -18, 213: -18, 214: -18, 215: -18, 216: -18 }, { 1: -19, 6: -19, 39: -19, 43: -19, 44: -19, 58: -19, 60: -19, 77: -19, 84: -19, 95: -19, 99: -19, 113: -19, 117: -19, 134: -19, 136: -19, 137: -19, 138: -19, 163: -19, 174: -19, 176: -19, 177: -19, 180: -19, 181: -19, 182: -19, 194: -19, 195: -19, 200: -19, 201: -19, 204: -19, 205: -19, 206: -19, 207: -19, 208: -19, 209: -19, 210: -19, 211: -19, 212: -19, 213: -19, 214: -19, 215: -19, 216: -19 }, { 1: -20, 6: -20, 39: -20, 43: -20, 44: -20, 58: -20, 60: -20, 77: -20, 84: -20, 95: -20, 99: -20, 113: -20, 117: -20, 134: -20, 136: -20, 137: -20, 138: -20, 163: -20, 174: -20, 176: -20, 177: -20, 180: -20, 181: -20, 182: -20, 194: -20, 195: -20, 200: -20, 201: -20, 204: -20, 205: -20, 206: -20, 207: -20, 208: -20, 209: -20, 210: -20, 211: -20, 212: -20, 213: -20, 214: -20, 215: -20, 216: -20 }, { 1: -21, 6: -21, 39: -21, 43: -21, 44: -21, 58: -21, 60: -21, 77: -21, 84: -21, 95: -21, 99: -21, 113: -21, 117: -21, 134: -21, 136: -21, 137: -21, 138: -21, 163: -21, 174: -21, 176: -21, 177: -21, 180: -21, 181: -21, 182: -21, 194: -21, 195: -21, 200: -21, 201: -21, 204: -21, 205: -21, 206: -21, 207: -21, 208: -21, 209: -21, 210: -21, 211: -21, 212: -21, 213: -21, 214: -21, 215: -21, 216: -21 }, { 1: -22, 6: -22, 39: -22, 43: -22, 44: -22, 58: -22, 60: -22, 77: -22, 84: -22, 95: -22, 99: -22, 113: -22, 117: -22, 134: -22, 136: -22, 137: -22, 138: -22, 163: -22, 174: -22, 176: -22, 177: -22, 180: -22, 181: -22, 182: -22, 194: -22, 195: -22, 200: -22, 201: -22, 204: -22, 205: -22, 206: -22, 207: -22, 208: -22, 209: -22, 210: -22, 211: -22, 212: -22, 213: -22, 214: -22, 215: -22, 216: -22 }, { 1: -23, 6: -23, 39: -23, 43: -23, 44: -23, 58: -23, 60: -23, 77: -23, 84: -23, 95: -23, 99: -23, 113: -23, 117: -23, 134: -23, 136: -23, 137: -23, 138: -23, 163: -23, 174: -23, 176: -23, 177: -23, 180: -23, 181: -23, 182: -23, 194: -23, 195: -23, 200: -23, 201: -23, 204: -23, 205: -23, 206: -23, 207: -23, 208: -23, 209: -23, 210: -23, 211: -23, 212: -23, 213: -23, 214: -23, 215: -23, 216: -23 }, { 1: -24, 6: -24, 39: -24, 43: -24, 44: -24, 58: -24, 60: -24, 77: -24, 84: -24, 95: -24, 99: -24, 113: -24, 117: -24, 134: -24, 136: -24, 137: -24, 138: -24, 163: -24, 174: -24, 176: -24, 177: -24, 180: -24, 181: -24, 182: -24, 194: -24, 195: -24, 200: -24, 201: -24, 204: -24, 205: -24, 206: -24, 207: -24, 208: -24, 209: -24, 210: -24, 211: -24, 212: -24, 213: -24, 214: -24, 215: -24, 216: -24 }, { 1: -25, 6: -25, 39: -25, 43: -25, 44: -25, 58: -25, 60: -25, 77: -25, 84: -25, 95: -25, 99: -25, 113: -25, 117: -25, 134: -25, 136: -25, 137: -25, 138: -25, 163: -25, 174: -25, 176: -25, 177: -25, 180: -25, 181: -25, 182: -25, 194: -25, 195: -25, 200: -25, 201: -25, 204: -25, 205: -25, 206: -25, 207: -25, 208: -25, 209: -25, 210: -25, 211: -25, 212: -25, 213: -25, 214: -25, 215: -25, 216: -25 }, { 1: -26, 6: -26, 39: -26, 43: -26, 44: -26, 58: -26, 60: -26, 77: -26, 84: -26, 95: -26, 99: -26, 113: -26, 117: -26, 134: -26, 136: -26, 137: -26, 138: -26, 163: -26, 174: -26, 176: -26, 177: -26, 180: -26, 181: -26, 182: -26, 194: -26, 195: -26, 200: -26, 201: -26, 204: -26, 205: -26, 206: -26, 207: -26, 208: -26, 209: -26, 210: -26, 211: -26, 212: -26, 213: -26, 214: -26, 215: -26, 216: -26 }, { 1: -27, 6: -27, 39: -27, 43: -27, 44: -27, 58: -27, 60: -27, 77: -27, 84: -27, 95: -27, 99: -27, 113: -27, 117: -27, 134: -27, 136: -27, 137: -27, 138: -27, 163: -27, 174: -27, 176: -27, 177: -27, 180: -27, 181: -27, 182: -27, 194: -27, 195: -27, 200: -27, 201: -27, 204: -27, 205: -27, 206: -27, 207: -27, 208: -27, 209: -27, 210: -27, 211: -27, 212: -27, 213: -27, 214: -27, 215: -27, 216: -27 }, { 1: -28, 6: -28, 39: -28, 43: -28, 44: -28, 58: -28, 60: -28, 77: -28, 84: -28, 95: -28, 99: -28, 113: -28, 117: -28, 134: -28, 136: -28, 137: -28, 138: -28, 163: -28, 174: -28, 176: -28, 177: -28, 180: -28, 181: -28, 182: -28, 194: -28, 195: -28, 200: -28, 201: -28, 204: -28, 205: -28, 206: -28, 207: -28, 208: -28, 209: -28, 210: -28, 211: -28, 212: -28, 213: -28, 214: -28, 215: -28, 216: -28 }, { 1: -29, 6: -29, 39: -29, 43: -29, 44: -29, 58: -29, 60: -29, 77: -29, 84: -29, 95: -29, 99: -29, 113: -29, 117: -29, 134: -29, 136: -29, 137: -29, 138: -29, 163: -29, 174: -29, 176: -29, 177: -29, 180: -29, 181: -29, 182: -29, 194: -29, 195: -29, 200: -29, 201: -29, 204: -29, 205: -29, 206: -29, 207: -29, 208: -29, 209: -29, 210: -29, 211: -29, 212: -29, 213: -29, 214: -29, 215: -29, 216: -29 }, { 1: -30, 6: -30, 39: -30, 43: -30, 44: -30, 58: -30, 60: -30, 77: -30, 84: -30, 95: -30, 99: -30, 113: -30, 117: -30, 134: -30, 136: -30, 137: -30, 138: -30, 163: -30, 174: -30, 176: -30, 177: -30, 180: -30, 181: -30, 182: -30, 194: -30, 195: -30, 200: -30, 201: -30, 204: -30, 205: -30, 206: -30, 207: -30, 208: -30, 209: -30, 210: -30, 211: -30, 212: -30, 213: -30, 214: -30, 215: -30, 216: -30 }, { 1: -31, 6: -31, 39: -31, 43: -31, 44: -31, 58: -31, 60: -31, 77: -31, 84: -31, 95: -31, 99: -31, 113: -31, 117: -31, 134: -31, 136: -31, 137: -31, 138: -31, 163: -31, 174: -31, 176: -31, 177: -31, 180: -31, 181: -31, 182: -31, 194: -31, 195: -31, 200: -31, 201: -31, 204: -31, 205: -31, 206: -31, 207: -31, 208: -31, 209: -31, 210: -31, 211: -31, 212: -31, 213: -31, 214: -31, 215: -31, 216: -31 }, { 1: -32, 6: -32, 39: -32, 43: -32, 44: -32, 58: -32, 60: -32, 77: -32, 84: -32, 95: -32, 99: -32, 113: -32, 117: -32, 134: -32, 136: -32, 137: -32, 138: -32, 163: -32, 174: -32, 176: -32, 177: -32, 180: -32, 181: -32, 182: -32, 194: -32, 195: -32, 200: -32, 201: -32, 204: -32, 205: -32, 206: -32, 207: -32, 208: -32, 209: -32, 210: -32, 211: -32, 212: -32, 213: -32, 214: -32, 215: -32, 216: -32 }, { 1: -33, 6: -33, 39: -33, 43: -33, 44: -33, 58: -33, 60: -33, 77: -33, 84: -33, 95: -33, 99: -33, 113: -33, 117: -33, 134: -33, 136: -33, 137: -33, 138: -33, 163: -33, 174: -33, 176: -33, 177: -33, 180: -33, 181: -33, 182: -33, 194: -33, 195: -33, 200: -33, 201: -33, 204: -33, 205: -33, 206: -33, 207: -33, 208: -33, 209: -33, 210: -33, 211: -33, 212: -33, 213: -33, 214: -33, 215: -33, 216: -33 }, { 1: -64, 6: -64, 39: -64, 43: -64, 44: -64, 77: -64, 84: -64, 99: -64, 174: -64 }, { 1: -65, 6: -65, 39: -65, 43: -65, 44: -65, 77: -65, 84: -65, 99: -65, 174: -65 }, { 1: -9, 6: -9, 39: -9, 43: -9, 44: -9, 77: -9, 84: -9, 99: -9, 174: -9, 176: -9, 177: -9, 194: -9, 195: -9 }, { 1: -10, 6: -10, 39: -10, 43: -10, 44: -10, 77: -10, 84: -10, 99: -10, 174: -10, 176: -10, 177: -10, 194: -10, 195: -10 }, { 1: -11, 6: -11, 39: -11, 43: -11, 44: -11, 77: -11, 84: -11, 99: -11, 174: -11, 176: -11, 177: -11, 194: -11, 195: -11 }, { 1: -12, 6: -12, 39: -12, 43: -12, 44: -12, 77: -12, 84: -12, 99: -12, 174: -12, 176: -12, 177: -12, 194: -12, 195: -12 }, { 1: -190, 6: -190, 37: -190, 39: -190, 42: 149, 43: -190, 44: -190, 45: 150, 46: 151, 47: 152, 58: -190, 59: 148, 60: -190, 71: -190, 72: -190, 77: -190, 84: -190, 95: -190, 99: -190, 108: -190, 109: -190, 110: -190, 111: -190, 112: -190, 113: -190, 114: -190, 117: -190, 127: -190, 134: -190, 136: -190, 137: -190, 138: -190, 155: -190, 156: -190, 163: -190, 174: -190, 176: -190, 177: -190, 180: -190, 181: -190, 182: -190, 194: -190, 195: -190, 200: -190, 201: -190, 204: -190, 205: -190, 206: -190, 207: -190, 208: -190, 209: -190, 210: -190, 211: -190, 212: -190, 213: -190, 214: -190, 215: -190, 216: -190 }, { 1: -191, 6: -191, 37: -191, 39: -191, 43: -191, 44: -191, 58: -191, 60: -191, 71: -191, 72: -191, 77: -191, 84: -191, 95: -191, 99: -191, 108: -191, 109: -191, 110: -191, 111: -191, 112: -191, 113: -191, 114: -191, 117: -191, 127: -191, 134: -191, 136: -191, 137: -191, 138: -191, 155: -191, 156: -191, 163: -191, 174: -191, 176: -191, 177: -191, 180: -191, 181: -191, 182: -191, 194: -191, 195: -191, 200: -191, 201: -191, 204: -191, 205: -191, 206: -191, 207: -191, 208: -191, 209: -191, 210: -191, 211: -191, 212: -191, 213: -191, 214: -191, 215: -191, 216: -191 }, { 1: -192, 6: -192, 37: -192, 39: -192, 43: -192, 44: -192, 58: -192, 60: -192, 71: -192, 72: -192, 77: -192, 84: -192, 95: -192, 99: -192, 108: -192, 109: -192, 110: -192, 111: -192, 112: -192, 113: -192, 114: -192, 117: -192, 127: -192, 134: -192, 136: -192, 137: -192, 138: -192, 155: -192, 156: -192, 163: -192, 174: -192, 176: -192, 177: -192, 180: -192, 181: -192, 182: -192, 194: -192, 195: -192, 200: -192, 201: -192, 204: -192, 205: -192, 206: -192, 207: -192, 208: -192, 209: -192, 210: -192, 211: -192, 212: -192, 213: -192, 214: -192, 215: -192, 216: -192 }, { 1: -193, 6: -193, 37: -193, 39: -193, 43: -193, 44: -193, 58: -193, 60: -193, 71: -193, 72: -193, 77: -193, 84: -193, 95: -193, 99: -193, 108: -193, 109: -193, 110: -193, 111: -193, 112: -193, 113: -193, 114: -193, 117: -193, 127: -193, 134: -193, 136: -193, 137: -193, 138: -193, 155: -193, 156: -193, 163: -193, 174: -193, 176: -193, 177: -193, 180: -193, 181: -193, 182: -193, 194: -193, 195: -193, 200: -193, 201: -193, 204: -193, 205: -193, 206: -193, 207: -193, 208: -193, 209: -193, 210: -193, 211: -193, 212: -193, 213: -193, 214: -193, 215: -193, 216: -193 }, { 1: -194, 6: -194, 37: -194, 39: -194, 43: -194, 44: -194, 58: -194, 60: -194, 71: -194, 72: -194, 77: -194, 84: -194, 95: -194, 99: -194, 108: -194, 109: -194, 110: -194, 111: -194, 112: -194, 113: -194, 114: -194, 117: -194, 127: -194, 134: -194, 136: -194, 137: -194, 138: -194, 155: -194, 156: -194, 163: -194, 174: -194, 176: -194, 177: -194, 180: -194, 181: -194, 182: -194, 194: -194, 195: -194, 200: -194, 201: -194, 204: -194, 205: -194, 206: -194, 207: -194, 208: -194, 209: -194, 210: -194, 211: -194, 212: -194, 213: -194, 214: -194, 215: -194, 216: -194 }, { 1: -195, 6: -195, 37: -195, 39: -195, 43: -195, 44: -195, 58: -195, 60: -195, 71: -195, 72: -195, 77: -195, 84: -195, 95: -195, 99: -195, 108: -195, 109: -195, 110: -195, 111: -195, 112: -195, 113: -195, 114: -195, 117: -195, 127: -195, 134: -195, 136: -195, 137: -195, 138: -195, 155: -195, 156: -195, 163: -195, 174: -195, 176: -195, 177: -195, 180: -195, 181: -195, 182: -195, 194: -195, 195: -195, 200: -195, 201: -195, 204: -195, 205: -195, 206: -195, 207: -195, 208: -195, 209: -195, 210: -195, 211: -195, 212: -195, 213: -195, 214: -195, 215: -195, 216: -195 }, { 1: -196, 6: -196, 37: -196, 39: -196, 43: -196, 44: -196, 58: -196, 60: -196, 71: -196, 72: -196, 77: -196, 84: -196, 95: -196, 99: -196, 108: -196, 109: -196, 110: -196, 111: -196, 112: -196, 113: -196, 114: -196, 117: -196, 127: -196, 134: -196, 136: -196, 137: -196, 138: -196, 155: -196, 156: -196, 163: -196, 174: -196, 176: -196, 177: -196, 180: -196, 181: -196, 182: -196, 194: -196, 195: -196, 200: -196, 201: -196, 204: -196, 205: -196, 206: -196, 207: -196, 208: -196, 209: -196, 210: -196, 211: -196, 212: -196, 213: -196, 214: -196, 215: -196, 216: -196 }, { 1: -197, 6: -197, 37: -197, 39: -197, 43: -197, 44: -197, 58: -197, 60: -197, 71: -197, 72: -197, 77: -197, 84: -197, 95: -197, 99: -197, 108: -197, 109: -197, 110: -197, 111: -197, 112: -197, 113: -197, 114: -197, 117: -197, 127: -197, 134: -197, 136: -197, 137: -197, 138: -197, 155: -197, 156: -197, 163: -197, 174: -197, 176: -197, 177: -197, 180: -197, 181: -197, 182: -197, 194: -197, 195: -197, 200: -197, 201: -197, 204: -197, 205: -197, 206: -197, 207: -197, 208: -197, 209: -197, 210: -197, 211: -197, 212: -197, 213: -197, 214: -197, 215: -197, 216: -197 }, { 1: -198, 6: -198, 37: -198, 39: -198, 43: -198, 44: -198, 58: -198, 60: -198, 71: -198, 72: -198, 77: -198, 84: -198, 95: -198, 99: -198, 108: -198, 109: -198, 110: -198, 111: -198, 112: -198, 113: -198, 114: -198, 117: -198, 127: -198, 134: -198, 136: -198, 137: -198, 138: -198, 155: -198, 156: -198, 163: -198, 174: -198, 176: -198, 177: -198, 180: -198, 181: -198, 182: -198, 194: -198, 195: -198, 200: -198, 201: -198, 204: -198, 205: -198, 206: -198, 207: -198, 208: -198, 209: -198, 210: -198, 211: -198, 212: -198, 213: -198, 214: -198, 215: -198, 216: -198 }, { 6: -144, 36: 157, 38: 153, 39: -144, 43: -144, 44: -144, 56: 161, 60: 156, 61: 105, 65: 160, 84: -144, 97: 158, 98: 162, 117: -144, 121: 154, 122: 155, 123: 159, 133: 100 }, { 5: 164, 7: 4, 8: 5, 9: 6, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 40: 163, 41: 34, 43: 165, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 166, 8: 167, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 169, 8: 170, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 171, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 177, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 178, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 179, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 180, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 14: 182, 15: 183, 36: 93, 41: 184, 49: 173, 56: 88, 61: 105, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 116: 172, 118: 91, 119: 92, 123: 73, 125: 181, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 158: 87, 173: 83, 198: 176 }, { 14: 182, 15: 183, 36: 93, 41: 184, 49: 173, 56: 88, 61: 105, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 116: 172, 118: 91, 119: 92, 123: 73, 125: 185, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 158: 87, 173: 83, 198: 176 }, { 1: -187, 6: -187, 37: -187, 39: -187, 42: -187, 43: -187, 44: -187, 45: -187, 46: -187, 47: -187, 58: -187, 59: -187, 60: -187, 71: -187, 72: -187, 77: -187, 84: -187, 95: -187, 99: -187, 108: -187, 109: -187, 110: -187, 111: -187, 112: -187, 113: -187, 114: -187, 117: -187, 127: -187, 134: -187, 136: -187, 137: -187, 138: -187, 155: -187, 156: -187, 163: -187, 174: -187, 176: -187, 177: -187, 180: -187, 181: -187, 182: -187, 194: -187, 195: -187, 200: -187, 201: -187, 202: 186, 203: 187, 204: -187, 205: -187, 206: -187, 207: -187, 208: -187, 209: -187, 210: -187, 211: -187, 212: -187, 213: -187, 214: -187, 215: -187, 216: -187, 217: 188 }, { 40: 190, 43: 165, 49: 189, 118: 91, 119: 92 }, { 40: 191, 43: 165 }, { 40: 192, 43: 165 }, { 36: 193, 61: 105 }, { 1: -375, 6: -375, 39: -375, 43: -375, 44: -375, 58: -375, 60: -375, 77: -375, 84: -375, 95: -375, 99: -375, 113: -375, 117: -375, 134: -375, 136: -375, 137: -375, 138: -375, 163: -375, 174: -375, 176: -375, 177: -375, 180: -375, 181: -375, 182: -375, 187: 194, 194: -375, 195: -375, 200: -375, 201: -375, 204: -375, 205: -375, 206: -375, 207: -375, 208: -375, 209: -375, 210: -375, 211: -375, 212: -375, 213: -375, 214: -375, 215: -375, 216: -375 }, { 1: -377, 6: -377, 39: -377, 43: -377, 44: -377, 58: -377, 60: -377, 77: -377, 84: -377, 95: -377, 99: -377, 113: -377, 117: -377, 134: -377, 136: -377, 137: -377, 138: -377, 163: -377, 174: -377, 176: -377, 177: -377, 180: -377, 181: -377, 182: -377, 194: -377, 195: -377, 200: -377, 201: -377, 204: -377, 205: -377, 206: -377, 207: -377, 208: -377, 209: -377, 210: -377, 211: -377, 212: -377, 213: -377, 214: -377, 215: -377, 216: -377 }, { 40: 195, 43: 165 }, { 40: 196, 43: 165 }, { 1: -326, 6: -326, 39: -326, 43: -326, 44: -326, 58: -326, 60: -326, 77: -326, 84: -326, 95: -326, 99: -326, 113: -326, 117: -326, 134: -326, 136: -326, 137: -326, 138: -326, 163: -326, 174: -326, 176: -326, 177: -326, 180: -326, 181: -326, 182: -326, 194: -326, 195: -326, 200: -326, 201: -326, 204: -326, 205: -326, 206: -326, 207: -326, 208: -326, 209: -326, 210: -326, 211: -326, 212: -326, 213: -326, 214: -326, 215: -326, 216: -326 }, { 36: 157, 56: 161, 61: 105, 65: 160, 97: 158, 98: 84, 122: 202, 123: 159, 128: 200, 133: 100, 135: 197, 139: 198, 183: 199, 184: 201 }, { 7: 203, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 204, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -214, 6: -214, 14: 182, 15: 183, 36: 93, 39: -214, 40: 205, 41: 184, 43: 165, 44: -214, 49: 173, 56: 88, 58: -214, 60: -214, 61: 105, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 77: -214, 78: 77, 79: 103, 80: 104, 81: 38, 84: -214, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 95: -214, 97: 94, 98: 84, 99: -214, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 113: -214, 116: 172, 117: -214, 118: 91, 119: 92, 123: 73, 125: 207, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: -214, 136: -214, 137: -214, 138: -214, 142: 206, 158: 87, 163: -214, 173: 83, 174: -214, 176: -214, 177: -214, 180: -214, 181: -214, 182: -214, 194: -214, 195: -214, 198: 176, 200: -214, 201: -214, 204: -214, 205: -214, 206: -214, 207: -214, 208: -214, 209: -214, 210: -214, 211: -214, 212: -214, 213: -214, 214: -214, 215: -214, 216: -214 }, { 7: 208, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 209, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -66, 6: -66, 7: 210, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 39: -66, 41: 34, 43: 211, 44: -66, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 58: -66, 60: -66, 61: 105, 64: 67, 65: 74, 66: 212, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 77: -66, 78: 77, 79: 103, 80: 104, 81: 38, 84: -66, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 95: -66, 97: 94, 98: 84, 99: -66, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 113: -66, 115: 70, 116: 172, 117: -66, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: -66, 136: -66, 137: -66, 138: -66, 141: 65, 143: 71, 151: 72, 158: 87, 163: -66, 168: 60, 172: 66, 173: 83, 174: -66, 175: 61, 176: -66, 177: -66, 178: 62, 179: 99, 180: -66, 181: -66, 182: -66, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 194: -66, 195: -66, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52, 204: -66, 205: -66, 206: -66, 207: -66, 208: -66, 209: -66, 210: -66, 211: -66, 212: -66, 213: -66, 214: -66, 215: -66, 216: -66 }, { 36: 213, 61: 105 }, { 15: 215, 49: 44, 62: 214, 116: 43, 118: 91, 119: 92 }, { 1: -135, 6: -135, 7: 216, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 39: -135, 41: 34, 43: 217, 44: -135, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 77: -135, 78: 77, 79: 103, 80: 104, 81: 38, 84: -135, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 99: -135, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 174: -135, 175: 61, 176: -135, 177: -135, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 194: -135, 195: -135, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 36: 222, 61: 105, 70: 218, 71: 106, 72: 107, 133: 221, 144: 219, 145: 220, 150: 223 }, { 31: 225, 34: 226, 35: 68, 36: 227, 61: 105, 133: 224, 141: 65, 149: 228, 153: 229 }, { 1: -188, 6: -188, 37: -188, 39: -188, 42: -188, 43: -188, 44: -188, 45: -188, 46: -188, 47: -188, 58: -188, 59: -188, 60: -188, 71: -188, 72: -188, 77: -188, 84: -188, 95: -188, 99: -188, 108: -188, 109: -188, 110: -188, 111: -188, 112: -188, 113: -188, 114: -188, 117: -188, 127: -188, 134: -188, 136: -188, 137: -188, 138: -188, 155: -188, 156: -188, 163: -188, 174: -188, 176: -188, 177: -188, 180: -188, 181: -188, 182: -188, 194: -188, 195: -188, 200: -188, 201: -188, 204: -188, 205: -188, 206: -188, 207: -188, 208: -188, 209: -188, 210: -188, 211: -188, 212: -188, 213: -188, 214: -188, 215: -188, 216: -188 }, { 1: -189, 6: -189, 37: -189, 39: -189, 42: -189, 43: -189, 44: -189, 45: -189, 46: -189, 47: -189, 58: -189, 59: -189, 60: -189, 71: -189, 72: -189, 77: -189, 84: -189, 95: -189, 99: -189, 108: -189, 109: -189, 110: -189, 111: -189, 112: -189, 113: -189, 114: -189, 117: -189, 127: -189, 134: -189, 136: -189, 137: -189, 138: -189, 155: -189, 156: -189, 163: -189, 174: -189, 176: -189, 177: -189, 180: -189, 181: -189, 182: -189, 194: -189, 195: -189, 200: -189, 201: -189, 204: -189, 205: -189, 206: -189, 207: -189, 208: -189, 209: -189, 210: -189, 211: -189, 212: -189, 213: -189, 214: -189, 215: -189, 216: -189 }, { 1: -88, 6: -88, 37: -88, 39: -88, 43: -88, 44: -88, 58: -88, 60: -88, 71: -88, 72: -88, 77: -88, 84: -88, 95: -88, 99: -88, 108: -88, 109: -88, 110: -88, 111: -88, 112: -88, 113: -88, 114: -88, 117: -88, 127: -88, 134: -88, 136: -88, 137: -88, 138: -88, 155: -88, 156: -88, 163: -88, 174: -88, 176: -88, 177: -88, 180: -88, 181: -88, 182: -88, 194: -88, 195: -88, 200: -88, 201: -88, 204: -88, 205: -88, 206: -88, 207: -88, 208: -88, 209: -88, 210: -88, 211: -88, 212: -88, 213: -88, 214: -88, 215: -88, 216: -88 }, { 1: -89, 6: -89, 37: -89, 39: -89, 43: -89, 44: -89, 58: -89, 60: -89, 71: -89, 72: -89, 77: -89, 84: -89, 95: -89, 99: -89, 108: -89, 109: -89, 110: -89, 111: -89, 112: -89, 113: -89, 114: -89, 117: -89, 127: -89, 134: -89, 136: -89, 137: -89, 138: -89, 155: -89, 156: -89, 163: -89, 174: -89, 176: -89, 177: -89, 180: -89, 181: -89, 182: -89, 194: -89, 195: -89, 200: -89, 201: -89, 204: -89, 205: -89, 206: -89, 207: -89, 208: -89, 209: -89, 210: -89, 211: -89, 212: -89, 213: -89, 214: -89, 215: -89, 216: -89 }, { 1: -90, 6: -90, 37: -90, 39: -90, 43: -90, 44: -90, 58: -90, 60: -90, 71: -90, 72: -90, 77: -90, 84: -90, 95: -90, 99: -90, 108: -90, 109: -90, 110: -90, 111: -90, 112: -90, 113: -90, 114: -90, 117: -90, 127: -90, 134: -90, 136: -90, 137: -90, 138: -90, 155: -90, 156: -90, 163: -90, 174: -90, 176: -90, 177: -90, 180: -90, 181: -90, 182: -90, 194: -90, 195: -90, 200: -90, 201: -90, 204: -90, 205: -90, 206: -90, 207: -90, 208: -90, 209: -90, 210: -90, 211: -90, 212: -90, 213: -90, 214: -90, 215: -90, 216: -90 }, { 1: -91, 6: -91, 37: -91, 39: -91, 43: -91, 44: -91, 58: -91, 60: -91, 71: -91, 72: -91, 77: -91, 84: -91, 95: -91, 99: -91, 108: -91, 109: -91, 110: -91, 111: -91, 112: -91, 113: -91, 114: -91, 117: -91, 127: -91, 134: -91, 136: -91, 137: -91, 138: -91, 155: -91, 156: -91, 163: -91, 174: -91, 176: -91, 177: -91, 180: -91, 181: -91, 182: -91, 194: -91, 195: -91, 200: -91, 201: -91, 204: -91, 205: -91, 206: -91, 207: -91, 208: -91, 209: -91, 210: -91, 211: -91, 212: -91, 213: -91, 214: -91, 215: -91, 216: -91 }, { 1: -92, 6: -92, 37: -92, 39: -92, 43: -92, 44: -92, 58: -92, 60: -92, 71: -92, 72: -92, 77: -92, 84: -92, 95: -92, 99: -92, 108: -92, 109: -92, 110: -92, 111: -92, 112: -92, 113: -92, 114: -92, 117: -92, 127: -92, 134: -92, 136: -92, 137: -92, 138: -92, 155: -92, 156: -92, 163: -92, 174: -92, 176: -92, 177: -92, 180: -92, 181: -92, 182: -92, 194: -92, 195: -92, 200: -92, 201: -92, 204: -92, 205: -92, 206: -92, 207: -92, 208: -92, 209: -92, 210: -92, 211: -92, 212: -92, 213: -92, 214: -92, 215: -92, 216: -92 }, { 1: -93, 6: -93, 37: -93, 39: -93, 43: -93, 44: -93, 58: -93, 60: -93, 71: -93, 72: -93, 77: -93, 84: -93, 95: -93, 99: -93, 108: -93, 109: -93, 110: -93, 111: -93, 112: -93, 113: -93, 114: -93, 117: -93, 127: -93, 134: -93, 136: -93, 137: -93, 138: -93, 155: -93, 156: -93, 163: -93, 174: -93, 176: -93, 177: -93, 180: -93, 181: -93, 182: -93, 194: -93, 195: -93, 200: -93, 201: -93, 204: -93, 205: -93, 206: -93, 207: -93, 208: -93, 209: -93, 210: -93, 211: -93, 212: -93, 213: -93, 214: -93, 215: -93, 216: -93 }, { 1: -94, 6: -94, 37: -94, 39: -94, 43: -94, 44: -94, 58: -94, 60: -94, 71: -94, 72: -94, 77: -94, 84: -94, 95: -94, 99: -94, 108: -94, 109: -94, 110: -94, 111: -94, 112: -94, 113: -94, 114: -94, 117: -94, 127: -94, 134: -94, 136: -94, 137: -94, 138: -94, 155: -94, 156: -94, 163: -94, 174: -94, 176: -94, 177: -94, 180: -94, 181: -94, 182: -94, 194: -94, 195: -94, 200: -94, 201: -94, 204: -94, 205: -94, 206: -94, 207: -94, 208: -94, 209: -94, 210: -94, 211: -94, 212: -94, 213: -94, 214: -94, 215: -94, 216: -94 }, { 1: -95, 6: -95, 37: -95, 39: -95, 43: -95, 44: -95, 58: -95, 60: -95, 71: -95, 72: -95, 77: -95, 84: -95, 95: -95, 99: -95, 108: -95, 109: -95, 110: -95, 111: -95, 112: -95, 113: -95, 114: -95, 117: -95, 127: -95, 134: -95, 136: -95, 137: -95, 138: -95, 155: -95, 156: -95, 163: -95, 174: -95, 176: -95, 177: -95, 180: -95, 181: -95, 182: -95, 194: -95, 195: -95, 200: -95, 201: -95, 204: -95, 205: -95, 206: -95, 207: -95, 208: -95, 209: -95, 210: -95, 211: -95, 212: -95, 213: -95, 214: -95, 215: -95, 216: -95 }, { 4: 230, 5: 3, 7: 4, 8: 5, 9: 6, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 231, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 232, 8: 241, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 238, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 60: 243, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 84: 239, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 99: 233, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 124: 242, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 159: 234, 160: 235, 164: 240, 165: 237, 166: 236, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 37: 247, 106: 244, 108: 245, 112: 246 }, { 37: 247, 106: 248 }, { 1: -271, 6: -271, 37: -271, 39: -271, 43: -271, 44: -271, 58: -271, 60: -271, 71: -271, 72: -271, 77: -271, 84: -271, 95: -271, 99: -271, 108: -271, 109: -271, 110: -271, 111: -271, 112: -271, 113: -271, 114: -271, 117: -271, 127: -271, 134: -271, 136: -271, 137: -271, 138: -271, 155: -271, 156: -271, 163: -271, 174: -271, 176: -271, 177: -271, 180: -271, 181: -271, 182: -271, 194: -271, 195: -271, 200: -271, 201: -271, 204: -271, 205: -271, 206: -271, 207: -271, 208: -271, 209: -271, 210: -271, 211: -271, 212: -271, 213: -271, 214: -271, 215: -271, 216: -271 }, { 1: -272, 6: -272, 37: -272, 39: -272, 43: -272, 44: -272, 57: 250, 58: -272, 60: -272, 67: 249, 71: -272, 72: -272, 77: -272, 84: -272, 95: -272, 99: -272, 108: -272, 109: -272, 110: -272, 111: -272, 112: -272, 113: -272, 114: -272, 117: -272, 127: -272, 134: -272, 136: -272, 137: -272, 138: -272, 155: -272, 156: -272, 163: -272, 174: -272, 176: -272, 177: -272, 180: -272, 181: -272, 182: -272, 194: -272, 195: -272, 200: -272, 201: -272, 204: -272, 205: -272, 206: -272, 207: -272, 208: -272, 209: -272, 210: -272, 211: -272, 212: -272, 213: -272, 214: -272, 215: -272, 216: -272 }, { 108: 251 }, { 108: 252 }, { 11: -140, 35: -140, 43: -140, 48: -140, 50: -140, 51: -140, 52: -140, 56: -140, 61: -140, 64: -140, 69: -140, 71: -140, 72: -140, 79: -140, 80: -140, 86: -140, 87: -140, 88: -140, 89: -140, 90: -140, 91: -140, 98: -140, 104: -140, 107: -140, 115: -140, 116: -140, 118: -140, 119: -140, 131: -140, 132: -140, 133: -140, 134: -140, 141: -140, 143: -140, 151: -140, 158: -140, 168: -140, 172: -140, 173: -140, 176: -140, 177: -140, 179: -140, 183: -140, 185: -140, 191: -140, 193: -140, 196: -140, 197: -140, 198: -140, 199: -140, 200: -140, 201: -140, 202: -140, 203: -140 }, { 11: -141, 35: -141, 43: -141, 48: -141, 50: -141, 51: -141, 52: -141, 56: -141, 61: -141, 64: -141, 69: -141, 71: -141, 72: -141, 79: -141, 80: -141, 86: -141, 87: -141, 88: -141, 89: -141, 90: -141, 91: -141, 98: -141, 104: -141, 107: -141, 115: -141, 116: -141, 118: -141, 119: -141, 131: -141, 132: -141, 133: -141, 134: -141, 141: -141, 143: -141, 151: -141, 158: -141, 168: -141, 172: -141, 173: -141, 176: -141, 177: -141, 179: -141, 183: -141, 185: -141, 191: -141, 193: -141, 196: -141, 197: -141, 198: -141, 199: -141, 200: -141, 201: -141, 202: -141, 203: -141 }, { 1: -158, 6: -158, 37: -158, 39: -158, 42: -158, 43: -158, 44: -158, 45: -158, 46: -158, 47: -158, 58: -158, 59: -158, 60: -158, 71: -158, 72: -158, 77: -158, 84: -158, 95: -158, 99: -158, 108: -158, 109: -158, 110: -158, 111: -158, 112: -158, 113: -158, 114: -158, 117: -158, 127: -158, 134: -158, 136: -158, 137: -158, 138: -158, 142: -158, 155: -158, 156: -158, 163: -158, 174: -158, 176: -158, 177: -158, 180: -158, 181: -158, 182: -158, 194: -158, 195: -158, 200: -158, 201: -158, 202: -158, 203: -158, 204: -158, 205: -158, 206: -158, 207: -158, 208: -158, 209: -158, 210: -158, 211: -158, 212: -158, 213: -158, 214: -158, 215: -158, 216: -158, 217: -158 }, { 1: -159, 6: -159, 37: -159, 39: -159, 42: -159, 43: -159, 44: -159, 45: -159, 46: -159, 47: -159, 58: -159, 59: -159, 60: -159, 71: -159, 72: -159, 77: -159, 84: -159, 95: -159, 99: -159, 108: -159, 109: -159, 110: -159, 111: -159, 112: -159, 113: -159, 114: -159, 117: -159, 127: -159, 134: -159, 136: -159, 137: -159, 138: -159, 142: -159, 155: -159, 156: -159, 163: -159, 174: -159, 176: -159, 177: -159, 180: -159, 181: -159, 182: -159, 194: -159, 195: -159, 200: -159, 201: -159, 202: -159, 203: -159, 204: -159, 205: -159, 206: -159, 207: -159, 208: -159, 209: -159, 210: -159, 211: -159, 212: -159, 213: -159, 214: -159, 215: -159, 216: -159, 217: -159 }, { 7: 253, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 254, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 255, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 256, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 258, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 40: 257, 41: 34, 43: 165, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: -209, 36: 266, 43: -209, 44: -209, 56: 263, 57: 250, 60: 270, 61: 105, 67: 267, 68: 264, 69: 101, 70: 102, 71: 106, 72: 107, 84: -209, 92: 265, 93: 259, 94: 269, 96: 261, 97: 268, 98: 262, 137: -209, 140: 260 }, { 1: -74, 6: -74, 37: -74, 39: -74, 43: -74, 44: -74, 58: -74, 60: -74, 71: -74, 72: -74, 77: -74, 84: -74, 95: -74, 99: -74, 108: -74, 109: -74, 110: -74, 111: -74, 112: -74, 113: -74, 114: -74, 117: -74, 127: -74, 134: -74, 136: -74, 137: -74, 138: -74, 155: -74, 156: -74, 163: -74, 174: -74, 176: -74, 177: -74, 180: -74, 181: -74, 182: -74, 194: -74, 195: -74, 200: -74, 201: -74, 204: -74, 205: -74, 206: -74, 207: -74, 208: -74, 209: -74, 210: -74, 211: -74, 212: -74, 213: -74, 214: -74, 215: -74, 216: -74 }, { 1: -75, 6: -75, 37: -75, 39: -75, 43: -75, 44: -75, 58: -75, 60: -75, 71: -75, 72: -75, 77: -75, 84: -75, 95: -75, 99: -75, 108: -75, 109: -75, 110: -75, 111: -75, 112: -75, 113: -75, 114: -75, 117: -75, 127: -75, 134: -75, 136: -75, 137: -75, 138: -75, 155: -75, 156: -75, 163: -75, 174: -75, 176: -75, 177: -75, 180: -75, 181: -75, 182: -75, 194: -75, 195: -75, 200: -75, 201: -75, 204: -75, 205: -75, 206: -75, 207: -75, 208: -75, 209: -75, 210: -75, 211: -75, 212: -75, 213: -75, 214: -75, 215: -75, 216: -75 }, { 1: -84, 6: -84, 37: -84, 39: -84, 43: -84, 44: -84, 58: -84, 60: -84, 71: -84, 72: -84, 77: -84, 84: -84, 95: -84, 99: -84, 108: -84, 109: -84, 110: -84, 111: -84, 112: -84, 113: -84, 114: -84, 117: -84, 127: -84, 134: -84, 136: -84, 137: -84, 138: -84, 155: -84, 156: -84, 163: -84, 174: -84, 176: -84, 177: -84, 180: -84, 181: -84, 182: -84, 194: -84, 195: -84, 200: -84, 201: -84, 204: -84, 205: -84, 206: -84, 207: -84, 208: -84, 209: -84, 210: -84, 211: -84, 212: -84, 213: -84, 214: -84, 215: -84, 216: -84 }, { 14: 182, 15: 183, 36: 93, 41: 184, 49: 173, 56: 88, 61: 105, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 271, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 116: 172, 118: 91, 119: 92, 123: 73, 125: 272, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 158: 87, 173: 83, 198: 176 }, { 1: -72, 6: -72, 37: -72, 39: -72, 42: -72, 43: -72, 44: -72, 45: -72, 46: -72, 47: -72, 58: -72, 59: -72, 60: -72, 66: -72, 71: -72, 72: -72, 77: -72, 84: -72, 95: -72, 99: -72, 108: -72, 109: -72, 110: -72, 111: -72, 112: -72, 113: -72, 114: -72, 117: -72, 127: -72, 134: -72, 136: -72, 137: -72, 138: -72, 142: -72, 148: -72, 155: -72, 156: -72, 163: -72, 174: -72, 176: -72, 177: -72, 180: -72, 181: -72, 182: -72, 194: -72, 195: -72, 200: -72, 201: -72, 202: -72, 203: -72, 204: -72, 205: -72, 206: -72, 207: -72, 208: -72, 209: -72, 210: -72, 211: -72, 212: -72, 213: -72, 214: -72, 215: -72, 216: -72, 217: -72 }, { 1: -76, 6: -76, 37: -76, 39: -76, 43: -76, 44: -76, 58: -76, 60: -76, 71: -76, 72: -76, 74: -76, 76: -76, 77: -76, 82: -76, 84: -76, 95: -76, 99: -76, 108: -76, 109: -76, 110: -76, 111: -76, 112: -76, 113: -76, 114: -76, 117: -76, 127: -76, 134: -76, 136: -76, 137: -76, 138: -76, 155: -76, 156: -76, 163: -76, 174: -76, 176: -76, 177: -76, 180: -76, 181: -76, 182: -76, 194: -76, 195: -76, 200: -76, 201: -76, 204: -76, 205: -76, 206: -76, 207: -76, 208: -76, 209: -76, 210: -76, 211: -76, 212: -76, 213: -76, 214: -76, 215: -76, 216: -76 }, { 70: 276, 71: 106, 72: 107, 73: 273, 75: 274, 76: 275 }, { 1: -5, 5: 277, 6: -5, 7: 4, 8: 5, 9: 6, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 44: -5, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 77: -5, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 174: -5, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -396, 6: -396, 39: -396, 43: -396, 44: -396, 58: -396, 60: -396, 77: -396, 84: -396, 95: -396, 99: -396, 113: -396, 117: -396, 134: -396, 136: -396, 137: -396, 138: -396, 163: -396, 174: -396, 176: -396, 177: -396, 180: -396, 181: -396, 182: -396, 194: -396, 195: -396, 200: -396, 201: -396, 204: -396, 205: -396, 206: -396, 207: -396, 208: -396, 209: -396, 210: -396, 211: -396, 212: -396, 213: -396, 214: -396, 215: -396, 216: -396 }, { 7: 278, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 279, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 280, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 281, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 282, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 283, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 284, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 285, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 286, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 287, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 288, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 289, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 290, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 291, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 292, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 293, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 294, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -325, 6: -325, 39: -325, 43: -325, 44: -325, 58: -325, 60: -325, 77: -325, 84: -325, 95: -325, 99: -325, 113: -325, 117: -325, 134: -325, 136: -325, 137: -325, 138: -325, 163: -325, 174: -325, 176: -325, 177: -325, 180: -325, 181: -325, 182: -325, 194: -325, 195: -325, 200: -325, 201: -325, 204: -325, 205: -325, 206: -325, 207: -325, 208: -325, 209: -325, 210: -325, 211: -325, 212: -325, 213: -325, 214: -325, 215: -325, 216: -325 }, { 36: 157, 56: 161, 61: 105, 65: 160, 97: 158, 98: 84, 122: 202, 123: 159, 128: 298, 133: 100, 135: 295, 139: 296, 183: 297, 184: 201 }, { 7: 299, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 300, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -324, 6: -324, 39: -324, 43: -324, 44: -324, 58: -324, 60: -324, 77: -324, 84: -324, 95: -324, 99: -324, 113: -324, 117: -324, 134: -324, 136: -324, 137: -324, 138: -324, 163: -324, 174: -324, 176: -324, 177: -324, 180: -324, 181: -324, 182: -324, 194: -324, 195: -324, 200: -324, 201: -324, 204: -324, 205: -324, 206: -324, 207: -324, 208: -324, 209: -324, 210: -324, 211: -324, 212: -324, 213: -324, 214: -324, 215: -324, 216: -324 }, { 37: 247, 70: 301, 71: 106, 72: 107, 106: 302 }, { 37: 247, 106: 303 }, { 57: 250, 67: 304 }, { 57: 250, 67: 305 }, { 1: -164, 6: -164, 37: -164, 39: -164, 42: -164, 43: -164, 44: -164, 45: -164, 46: -164, 47: -164, 57: 250, 58: -164, 59: -164, 60: -164, 67: 306, 71: -164, 72: -164, 77: -164, 84: -164, 95: -164, 99: -164, 108: -164, 109: -164, 110: -164, 111: -164, 112: -164, 113: -164, 114: -164, 117: -164, 127: -164, 134: -164, 136: -164, 137: -164, 138: -164, 142: -164, 155: -164, 156: -164, 163: -164, 174: -164, 176: -164, 177: -164, 180: -164, 181: -164, 182: -164, 194: -164, 195: -164, 200: -164, 201: -164, 202: -164, 203: -164, 204: -164, 205: -164, 206: -164, 207: -164, 208: -164, 209: -164, 210: -164, 211: -164, 212: -164, 213: -164, 214: -164, 215: -164, 216: -164, 217: -164 }, { 1: -165, 6: -165, 37: -165, 39: -165, 42: -165, 43: -165, 44: -165, 45: -165, 46: -165, 47: -165, 57: 250, 58: -165, 59: -165, 60: -165, 67: 307, 71: -165, 72: -165, 77: -165, 84: -165, 95: -165, 99: -165, 108: -165, 109: -165, 110: -165, 111: -165, 112: -165, 113: -165, 114: -165, 117: -165, 127: -165, 134: -165, 136: -165, 137: -165, 138: -165, 142: -165, 155: -165, 156: -165, 163: -165, 174: -165, 176: -165, 177: -165, 180: -165, 181: -165, 182: -165, 194: -165, 195: -165, 200: -165, 201: -165, 202: -165, 203: -165, 204: -165, 205: -165, 206: -165, 207: -165, 208: -165, 209: -165, 210: -165, 211: -165, 212: -165, 213: -165, 214: -165, 215: -165, 216: -165, 217: -165 }, { 7: 308, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 309, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 60: 315, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 313, 79: 103, 80: 104, 81: 38, 83: 311, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 126: 310, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 162: 312, 163: 314, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 112: 316 }, { 112: 317 }, { 37: -268, 71: -268, 72: -268 }, { 57: 250, 67: 318 }, { 57: 250, 67: 319 }, { 1: -181, 6: -181, 37: -181, 39: -181, 42: -181, 43: -181, 44: -181, 45: -181, 46: -181, 47: -181, 57: 250, 58: -181, 59: -181, 60: -181, 67: 320, 71: -181, 72: -181, 77: -181, 84: -181, 95: -181, 99: -181, 108: -181, 109: -181, 110: -181, 111: -181, 112: -181, 113: -181, 114: -181, 117: -181, 127: -181, 134: -181, 136: -181, 137: -181, 138: -181, 142: -181, 155: -181, 156: -181, 163: -181, 174: -181, 176: -181, 177: -181, 180: -181, 181: -181, 182: -181, 194: -181, 195: -181, 200: -181, 201: -181, 202: -181, 203: -181, 204: -181, 205: -181, 206: -181, 207: -181, 208: -181, 209: -181, 210: -181, 211: -181, 212: -181, 213: -181, 214: -181, 215: -181, 216: -181, 217: -181 }, { 1: -182, 6: -182, 37: -182, 39: -182, 42: -182, 43: -182, 44: -182, 45: -182, 46: -182, 47: -182, 57: 250, 58: -182, 59: -182, 60: -182, 67: 321, 71: -182, 72: -182, 77: -182, 84: -182, 95: -182, 99: -182, 108: -182, 109: -182, 110: -182, 111: -182, 112: -182, 113: -182, 114: -182, 117: -182, 127: -182, 134: -182, 136: -182, 137: -182, 138: -182, 142: -182, 155: -182, 156: -182, 163: -182, 174: -182, 176: -182, 177: -182, 180: -182, 181: -182, 182: -182, 194: -182, 195: -182, 200: -182, 201: -182, 202: -182, 203: -182, 204: -182, 205: -182, 206: -182, 207: -182, 208: -182, 209: -182, 210: -182, 211: -182, 212: -182, 213: -182, 214: -182, 215: -182, 216: -182, 217: -182 }, { 7: 322, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 323, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 112: 324 }, { 6: 326, 7: 325, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 327, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: 329, 7: 328, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 330, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: 332, 7: 331, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 333, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: 335, 7: 334, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 336, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: 338, 7: 337, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 339, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: -142, 39: -142, 43: -142, 44: -142, 84: 341, 99: -142, 117: 340, 120: 342, 137: -142 }, { 6: -145, 39: -145, 43: -145, 44: -145, 84: -145, 117: -145 }, { 6: -149, 39: -149, 43: -149, 44: -149, 59: 343, 84: -149, 117: -149 }, { 6: -152, 36: 157, 39: -152, 43: -152, 44: -152, 56: 161, 61: 105, 65: 160, 84: -152, 97: 158, 98: 162, 117: -152, 122: 344, 123: 159, 133: 100 }, { 6: -153, 39: -153, 43: -153, 44: -153, 59: -153, 84: -153, 117: -153, 136: -153, 180: -153, 182: -153 }, { 6: -154, 39: -154, 43: -154, 44: -154, 59: -154, 84: -154, 117: -154, 136: -154, 180: -154, 182: -154 }, { 6: -155, 39: -155, 43: -155, 44: -155, 59: -155, 84: -155, 117: -155, 136: -155, 180: -155, 182: -155 }, { 6: -156, 39: -156, 43: -156, 44: -156, 59: -156, 84: -156, 117: -156, 136: -156, 180: -156, 182: -156 }, { 57: 250, 67: 249 }, { 7: 345, 8: 241, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 238, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 60: 243, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 84: 239, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 99: 233, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 124: 242, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 159: 234, 160: 235, 164: 240, 165: 237, 166: 236, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -137, 6: -137, 37: -137, 39: -137, 43: -137, 44: -137, 58: -137, 60: -137, 71: -137, 72: -137, 77: -137, 84: -137, 95: -137, 99: -137, 108: -137, 109: -137, 110: -137, 111: -137, 112: -137, 113: -137, 114: -137, 117: -137, 127: -137, 134: -137, 136: -137, 137: -137, 138: -137, 155: -137, 156: -137, 163: -137, 174: -137, 176: -137, 177: -137, 180: -137, 181: -137, 182: -137, 194: -137, 195: -137, 200: -137, 201: -137, 204: -137, 205: -137, 206: -137, 207: -137, 208: -137, 209: -137, 210: -137, 211: -137, 212: -137, 213: -137, 214: -137, 215: -137, 216: -137 }, { 1: -139, 6: -139, 39: -139, 43: -139, 44: -139, 77: -139, 84: -139, 99: -139, 174: -139 }, { 4: 347, 5: 3, 7: 4, 8: 5, 9: 6, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 44: 346, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -385, 6: -385, 39: -385, 43: -385, 44: -385, 58: 109, 60: -385, 77: -385, 84: -385, 95: -385, 99: -385, 113: -385, 117: -385, 134: -385, 136: -385, 137: -385, 138: -385, 163: -385, 174: -385, 175: 127, 176: -385, 177: -385, 180: -385, 181: -385, 182: -385, 194: -385, 195: 126, 200: -385, 201: -385, 204: -385, 205: -385, 206: -385, 207: -385, 208: -385, 209: -385, 210: -385, 211: -385, 212: -385, 213: 121, 214: 122, 215: -385, 216: -385 }, { 1: -382, 6: -382, 39: -382, 43: -382, 44: -382, 77: -382, 84: -382, 99: -382, 174: -382 }, { 175: 131, 176: 97, 177: 98, 194: 129, 195: 130 }, { 1: -386, 6: -386, 39: -386, 43: -386, 44: -386, 58: 109, 60: -386, 77: -386, 84: -386, 95: -386, 99: -386, 113: -386, 117: -386, 134: -386, 136: -386, 137: -386, 138: -386, 163: -386, 174: -386, 175: 127, 176: -386, 177: -386, 180: -386, 181: -386, 182: -386, 194: -386, 195: 126, 200: -386, 201: -386, 204: -386, 205: -386, 206: -386, 207: -386, 208: -386, 209: -386, 210: -386, 211: -386, 212: -386, 213: 121, 214: 122, 215: -386, 216: -386 }, { 1: -383, 6: -383, 39: -383, 43: -383, 44: -383, 77: -383, 84: -383, 99: -383, 174: -383 }, { 1: -387, 6: -387, 39: -387, 43: -387, 44: -387, 58: 109, 60: -387, 77: -387, 84: -387, 95: -387, 99: -387, 113: -387, 117: -387, 134: -387, 136: -387, 137: -387, 138: -387, 163: -387, 174: -387, 175: 127, 176: -387, 177: -387, 180: -387, 181: -387, 182: -387, 194: -387, 195: 126, 200: -387, 201: -387, 204: -387, 205: 113, 206: -387, 207: -387, 208: -387, 209: -387, 210: -387, 211: -387, 212: -387, 213: 121, 214: 122, 215: -387, 216: -387 }, { 6: -144, 36: 157, 38: 348, 39: -144, 43: -144, 44: -144, 56: 161, 60: 156, 61: 105, 65: 160, 84: -144, 97: 158, 98: 162, 117: -144, 121: 154, 122: 155, 123: 159, 133: 100 }, { 40: 163, 43: 165 }, { 7: 166, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 169, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 15: 215, 49: 173, 116: 172, 118: 91, 119: 92 }, { 1: -388, 6: -388, 39: -388, 43: -388, 44: -388, 58: 109, 60: -388, 77: -388, 84: -388, 95: -388, 99: -388, 113: -388, 117: -388, 134: -388, 136: -388, 137: -388, 138: -388, 163: -388, 174: -388, 175: 127, 176: -388, 177: -388, 180: -388, 181: -388, 182: -388, 194: -388, 195: 126, 200: -388, 201: -388, 204: -388, 205: 113, 206: -388, 207: -388, 208: -388, 209: -388, 210: -388, 211: -388, 212: -388, 213: 121, 214: 122, 215: -388, 216: -388 }, { 1: -389, 6: -389, 39: -389, 43: -389, 44: -389, 58: 109, 60: -389, 77: -389, 84: -389, 95: -389, 99: -389, 113: -389, 117: -389, 134: -389, 136: -389, 137: -389, 138: -389, 163: -389, 174: -389, 175: 127, 176: -389, 177: -389, 180: -389, 181: -389, 182: -389, 194: -389, 195: 126, 200: -389, 201: -389, 204: -389, 205: 113, 206: -389, 207: -389, 208: -389, 209: -389, 210: -389, 211: -389, 212: -389, 213: 121, 214: 122, 215: -389, 216: -389 }, { 1: -390, 6: -390, 39: -390, 43: -390, 44: -390, 58: 109, 60: -390, 77: -390, 84: -390, 95: -390, 99: -390, 113: -390, 117: -390, 134: -390, 136: -390, 137: -390, 138: -390, 163: -390, 174: -390, 175: 127, 176: -390, 177: -390, 180: -390, 181: -390, 182: -390, 194: -390, 195: 126, 200: -390, 201: -390, 204: -390, 205: -390, 206: -390, 207: -390, 208: -390, 209: -390, 210: -390, 211: -390, 212: -390, 213: 121, 214: 122, 215: -390, 216: -390 }, { 65: 349, 133: 100 }, { 1: -392, 6: -392, 37: -187, 39: -392, 42: -187, 43: -392, 44: -392, 45: -187, 46: -187, 47: -187, 58: -392, 59: -187, 60: -392, 71: -187, 72: -187, 77: -392, 84: -392, 95: -392, 99: -392, 108: -187, 109: -187, 110: -187, 111: -187, 112: -187, 113: -392, 114: -187, 117: -392, 127: -187, 134: -392, 136: -392, 137: -392, 138: -392, 155: -187, 156: -187, 163: -392, 174: -392, 176: -392, 177: -392, 180: -392, 181: -392, 182: -392, 194: -392, 195: -392, 200: -392, 201: -392, 204: -392, 205: -392, 206: -392, 207: -392, 208: -392, 209: -392, 210: -392, 211: -392, 212: -392, 213: -392, 214: -392, 215: -392, 216: -392 }, { 37: -267, 71: -267, 72: -267, 105: 132, 108: 134, 109: 135, 110: 136, 111: 137, 112: 138, 114: 139, 127: 140, 155: 133, 156: 141 }, { 108: 142, 109: 143, 110: 144, 111: 145, 112: 146, 114: 147 }, { 1: -190, 6: -190, 37: -190, 39: -190, 43: -190, 44: -190, 58: -190, 60: -190, 71: -190, 72: -190, 77: -190, 84: -190, 95: -190, 99: -190, 108: -190, 109: -190, 110: -190, 111: -190, 112: -190, 113: -190, 114: -190, 117: -190, 127: -190, 134: -190, 136: -190, 137: -190, 138: -190, 155: -190, 156: -190, 163: -190, 174: -190, 176: -190, 177: -190, 180: -190, 181: -190, 182: -190, 194: -190, 195: -190, 200: -190, 201: -190, 204: -190, 205: -190, 206: -190, 207: -190, 208: -190, 209: -190, 210: -190, 211: -190, 212: -190, 213: -190, 214: -190, 215: -190, 216: -190 }, { 1: -393, 6: -393, 37: -187, 39: -393, 42: -187, 43: -393, 44: -393, 45: -187, 46: -187, 47: -187, 58: -393, 59: -187, 60: -393, 71: -187, 72: -187, 77: -393, 84: -393, 95: -393, 99: -393, 108: -187, 109: -187, 110: -187, 111: -187, 112: -187, 113: -393, 114: -187, 117: -393, 127: -187, 134: -393, 136: -393, 137: -393, 138: -393, 155: -187, 156: -187, 163: -393, 174: -393, 176: -393, 177: -393, 180: -393, 181: -393, 182: -393, 194: -393, 195: -393, 200: -393, 201: -393, 204: -393, 205: -393, 206: -393, 207: -393, 208: -393, 209: -393, 210: -393, 211: -393, 212: -393, 213: -393, 214: -393, 215: -393, 216: -393 }, { 1: -394, 6: -394, 39: -394, 43: -394, 44: -394, 58: -394, 60: -394, 77: -394, 84: -394, 95: -394, 99: -394, 113: -394, 117: -394, 134: -394, 136: -394, 137: -394, 138: -394, 163: -394, 174: -394, 176: -394, 177: -394, 180: -394, 181: -394, 182: -394, 194: -394, 195: -394, 200: -394, 201: -394, 204: -394, 205: -394, 206: -394, 207: -394, 208: -394, 209: -394, 210: -394, 211: -394, 212: -394, 213: -394, 214: -394, 215: -394, 216: -394 }, { 1: -395, 6: -395, 39: -395, 43: -395, 44: -395, 58: -395, 60: -395, 77: -395, 84: -395, 95: -395, 99: -395, 113: -395, 117: -395, 134: -395, 136: -395, 137: -395, 138: -395, 163: -395, 174: -395, 176: -395, 177: -395, 180: -395, 181: -395, 182: -395, 194: -395, 195: -395, 200: -395, 201: -395, 204: -395, 205: -395, 206: -395, 207: -395, 208: -395, 209: -395, 210: -395, 211: -395, 212: -395, 213: -395, 214: -395, 215: -395, 216: -395 }, { 6: 352, 7: 350, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 351, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 40: 353, 43: 165 }, { 1: -49, 6: -49, 39: -49, 43: -49, 44: -49, 58: -49, 60: -49, 77: -49, 84: -49, 95: -49, 99: -49, 113: -49, 117: -49, 134: -49, 136: -49, 137: -49, 138: -49, 163: -49, 174: -49, 176: -49, 177: -49, 180: -49, 181: -49, 182: -49, 194: -49, 195: -49, 200: -49, 201: -49, 204: -49, 205: -49, 206: -49, 207: -49, 208: -49, 209: -49, 210: -49, 211: -49, 212: -49, 213: -49, 214: -49, 215: -49, 216: -49 }, { 1: -50, 6: -50, 39: -50, 43: -50, 44: -50, 58: -50, 60: -50, 77: -50, 84: -50, 95: -50, 99: -50, 113: -50, 117: -50, 134: -50, 136: -50, 137: -50, 138: -50, 163: -50, 174: -50, 176: -50, 177: -50, 180: -50, 181: -50, 182: -50, 194: -50, 195: -50, 200: -50, 201: -50, 204: -50, 205: -50, 206: -50, 207: -50, 208: -50, 209: -50, 210: -50, 211: -50, 212: -50, 213: -50, 214: -50, 215: -50, 216: -50 }, { 1: -51, 6: -51, 39: -51, 43: -51, 44: -51, 58: -51, 60: -51, 77: -51, 84: -51, 95: -51, 99: -51, 113: -51, 117: -51, 134: -51, 136: -51, 137: -51, 138: -51, 163: -51, 174: -51, 176: -51, 177: -51, 180: -51, 181: -51, 182: -51, 194: -51, 195: -51, 200: -51, 201: -51, 204: -51, 205: -51, 206: -51, 207: -51, 208: -51, 209: -51, 210: -51, 211: -51, 212: -51, 213: -51, 214: -51, 215: -51, 216: -51 }, { 43: 354 }, { 40: 355, 43: 165, 191: 356 }, { 1: -308, 6: -308, 39: -308, 43: -308, 44: -308, 58: -308, 60: -308, 77: -308, 84: -308, 95: -308, 99: -308, 113: -308, 117: -308, 134: -308, 136: -308, 137: -308, 138: -308, 163: -308, 169: 357, 170: 358, 171: 359, 174: -308, 176: -308, 177: -308, 180: -308, 181: -308, 182: -308, 194: -308, 195: -308, 200: -308, 201: -308, 204: -308, 205: -308, 206: -308, 207: -308, 208: -308, 209: -308, 210: -308, 211: -308, 212: -308, 213: -308, 214: -308, 215: -308, 216: -308 }, { 1: -323, 6: -323, 39: -323, 43: -323, 44: -323, 58: -323, 60: -323, 77: -323, 84: -323, 95: -323, 99: -323, 113: -323, 117: -323, 134: -323, 136: -323, 137: -323, 138: -323, 163: -323, 174: -323, 176: -323, 177: -323, 180: -323, 181: -323, 182: -323, 194: -323, 195: -323, 200: -323, 201: -323, 204: -323, 205: -323, 206: -323, 207: -323, 208: -323, 209: -323, 210: -323, 211: -323, 212: -323, 213: -323, 214: -323, 215: -323, 216: -323 }, { 136: 361, 180: 360, 182: 362 }, { 36: 157, 56: 161, 61: 105, 65: 160, 97: 158, 98: 162, 122: 202, 123: 159, 133: 100, 135: 363, 184: 201 }, { 36: 157, 56: 161, 61: 105, 65: 160, 97: 158, 98: 162, 122: 202, 123: 159, 133: 100, 135: 364, 184: 201 }, { 40: 365, 43: 165, 181: 366 }, { 84: 367, 136: -361, 180: -361, 182: -361 }, { 59: 368, 84: -359, 136: -359, 180: -359, 182: -359 }, { 43: 369, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 186: 370, 188: 371, 189: 372 }, { 1: -215, 6: -215, 39: -215, 43: -215, 44: -215, 58: -215, 60: -215, 77: -215, 84: -215, 95: -215, 99: -215, 113: -215, 117: -215, 134: -215, 136: -215, 137: -215, 138: -215, 163: -215, 174: -215, 176: -215, 177: -215, 180: -215, 181: -215, 182: -215, 194: -215, 195: -215, 200: -215, 201: -215, 204: -215, 205: -215, 206: -215, 207: -215, 208: -215, 209: -215, 210: -215, 211: -215, 212: -215, 213: -215, 214: -215, 215: -215, 216: -215 }, { 7: 373, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -218, 6: -218, 37: -187, 39: -218, 40: 374, 42: -187, 43: 165, 44: -218, 45: -187, 46: -187, 47: -187, 58: -218, 59: -187, 60: -218, 71: -187, 72: -187, 77: -218, 84: -218, 95: -218, 99: -218, 108: -187, 109: -187, 110: -187, 111: -187, 112: -187, 113: -218, 114: -187, 117: -218, 127: -187, 134: -218, 136: -218, 137: -218, 138: -218, 142: 375, 155: -187, 156: -187, 163: -218, 174: -218, 176: -218, 177: -218, 180: -218, 181: -218, 182: -218, 194: -218, 195: -218, 200: -218, 201: -218, 204: -218, 205: -218, 206: -218, 207: -218, 208: -218, 209: -218, 210: -218, 211: -218, 212: -218, 213: -218, 214: -218, 215: -218, 216: -218 }, { 1: -315, 6: -315, 39: -315, 43: -315, 44: -315, 58: 109, 60: -315, 77: -315, 84: -315, 95: -315, 99: -315, 113: -315, 117: -315, 134: -315, 136: -315, 137: -315, 138: -315, 163: -315, 174: -315, 175: 127, 176: -315, 177: -315, 180: -315, 181: -315, 182: -315, 194: -315, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 65: 376, 133: 100 }, { 1: -67, 6: -67, 39: -67, 43: -67, 44: -67, 58: 109, 60: -67, 77: -67, 84: -67, 95: -67, 99: -67, 113: -67, 117: -67, 134: -67, 136: -67, 137: -67, 138: -67, 163: -67, 174: -67, 175: 127, 176: -67, 177: -67, 180: -67, 181: -67, 182: -67, 194: -67, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 65: 377, 133: 100 }, { 7: 378, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 37: 379, 40: 380, 43: 165 }, { 1: -384, 6: -384, 39: -384, 43: -384, 44: -384, 77: -384, 84: -384, 99: -384, 174: -384 }, { 1: -415, 6: -415, 37: -415, 39: -415, 43: -415, 44: -415, 58: -415, 60: -415, 71: -415, 72: -415, 77: -415, 84: -415, 95: -415, 99: -415, 108: -415, 109: -415, 110: -415, 111: -415, 112: -415, 113: -415, 114: -415, 117: -415, 127: -415, 134: -415, 136: -415, 137: -415, 138: -415, 155: -415, 156: -415, 163: -415, 174: -415, 176: -415, 177: -415, 180: -415, 181: -415, 182: -415, 194: -415, 195: -415, 200: -415, 201: -415, 204: -415, 205: -415, 206: -415, 207: -415, 208: -415, 209: -415, 210: -415, 211: -415, 212: -415, 213: -415, 214: -415, 215: -415, 216: -415 }, { 1: -133, 6: -133, 39: -133, 43: -133, 44: -133, 58: 109, 77: -133, 84: -133, 99: -133, 134: 128, 174: -133, 175: 127, 176: -133, 177: -133, 194: -133, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 65: 381, 133: 100 }, { 1: -222, 6: -222, 39: -222, 43: -222, 44: -222, 77: -222, 84: -222, 99: -222, 174: -222, 176: -222, 177: -222, 194: -222, 195: -222 }, { 66: 382, 84: 383 }, { 66: 384 }, { 36: 389, 43: 388, 61: 105, 137: 385, 146: 386, 147: 387, 149: 390 }, { 66: -238, 84: -238 }, { 148: 391 }, { 36: 396, 43: 395, 61: 105, 137: 392, 149: 397, 152: 393, 154: 394 }, { 1: -242, 6: -242, 39: -242, 43: -242, 44: -242, 77: -242, 84: -242, 99: -242, 174: -242, 176: -242, 177: -242, 194: -242, 195: -242 }, { 1: -243, 6: -243, 39: -243, 43: -243, 44: -243, 77: -243, 84: -243, 99: -243, 174: -243, 176: -243, 177: -243, 194: -243, 195: -243 }, { 59: 398 }, { 7: 399, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 400, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 66: 401 }, { 6: 108, 174: 402 }, { 4: 403, 5: 3, 7: 4, 8: 5, 9: 6, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: -289, 39: -289, 43: -289, 44: -289, 58: 109, 60: 315, 84: -289, 99: -289, 134: 128, 162: 404, 163: 314, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -274, 6: -274, 37: -274, 39: -274, 42: -274, 43: -274, 44: -274, 45: -274, 46: -274, 47: -274, 58: -274, 59: -274, 60: -274, 71: -274, 72: -274, 77: -274, 84: -274, 95: -274, 99: -274, 108: -274, 109: -274, 110: -274, 111: -274, 112: -274, 113: -274, 114: -274, 117: -274, 127: -274, 134: -274, 136: -274, 137: -274, 138: -274, 155: -274, 156: -274, 163: -274, 174: -274, 176: -274, 177: -274, 180: -274, 181: -274, 182: -274, 194: -274, 195: -274, 200: -274, 201: -274, 204: -274, 205: -274, 206: -274, 207: -274, 208: -274, 209: -274, 210: -274, 211: -274, 212: -274, 213: -274, 214: -274, 215: -274, 216: -274 }, { 7: 345, 8: 241, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 60: 243, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 84: 239, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 99: 405, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 124: 242, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 164: 407, 166: 406, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: -142, 39: -142, 43: -142, 44: -142, 84: 409, 99: -142, 120: 410, 137: -142, 161: 408 }, { 6: 411, 11: -302, 35: -302, 43: -302, 44: -302, 48: -302, 50: -302, 51: -302, 52: -302, 56: -302, 60: -302, 61: -302, 64: -302, 69: -302, 71: -302, 72: -302, 79: -302, 80: -302, 84: -302, 86: -302, 87: -302, 88: -302, 89: -302, 90: -302, 91: -302, 98: -302, 99: -302, 104: -302, 107: -302, 115: -302, 116: -302, 118: -302, 119: -302, 131: -302, 132: -302, 133: -302, 134: -302, 141: -302, 143: -302, 151: -302, 158: -302, 168: -302, 172: -302, 173: -302, 176: -302, 177: -302, 179: -302, 183: -302, 185: -302, 191: -302, 193: -302, 196: -302, 197: -302, 198: -302, 199: -302, 200: -302, 201: -302, 202: -302, 203: -302 }, { 6: -293, 43: -293, 44: -293, 84: -293, 99: -293 }, { 7: 345, 8: 241, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 238, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 60: 243, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 84: 239, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 124: 242, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 159: 413, 160: 412, 164: 240, 165: 237, 166: 236, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: -304, 11: -304, 35: -304, 43: -304, 44: -304, 48: -304, 50: -304, 51: -304, 52: -304, 56: -304, 60: -304, 61: -304, 64: -304, 69: -304, 71: -304, 72: -304, 79: -304, 80: -304, 84: -304, 86: -304, 87: -304, 88: -304, 89: -304, 90: -304, 91: -304, 98: -304, 99: -304, 104: -304, 107: -304, 115: -304, 116: -304, 118: -304, 119: -304, 131: -304, 132: -304, 133: -304, 134: -304, 141: -304, 143: -304, 151: -304, 158: -304, 168: -304, 172: -304, 173: -304, 176: -304, 177: -304, 179: -304, 183: -304, 185: -304, 191: -304, 193: -304, 196: -304, 197: -304, 198: -304, 199: -304, 200: -304, 201: -304, 202: -304, 203: -304 }, { 6: -298, 43: -298, 44: -298, 84: -298, 99: -298 }, { 6: -290, 39: -290, 43: -290, 44: -290, 84: -290, 99: -290 }, { 6: -291, 39: -291, 43: -291, 44: -291, 84: -291, 99: -291 }, { 6: -292, 7: 414, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 39: -292, 41: 34, 43: -292, 44: -292, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 84: -292, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 99: -292, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -265, 6: -265, 37: -265, 39: -265, 43: -265, 44: -265, 58: -265, 60: -265, 71: -265, 72: -265, 77: -265, 82: -265, 84: -265, 95: -265, 99: -265, 108: -265, 109: -265, 110: -265, 111: -265, 112: -265, 113: -265, 114: -265, 117: -265, 127: -265, 134: -265, 136: -265, 137: -265, 138: -265, 155: -265, 156: -265, 163: -265, 174: -265, 176: -265, 177: -265, 180: -265, 181: -265, 182: -265, 194: -265, 195: -265, 200: -265, 201: -265, 204: -265, 205: -265, 206: -265, 207: -265, 208: -265, 209: -265, 210: -265, 211: -265, 212: -265, 213: -265, 214: -265, 215: -265, 216: -265 }, { 57: 250, 67: 415 }, { 7: 416, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 417, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 345, 8: 241, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 39: 418, 41: 34, 43: 421, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 60: 243, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 124: 242, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 157: 419, 158: 87, 164: 420, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -266, 6: -266, 37: -266, 39: -266, 43: -266, 44: -266, 58: -266, 60: -266, 71: -266, 72: -266, 77: -266, 82: -266, 84: -266, 95: -266, 99: -266, 108: -266, 109: -266, 110: -266, 111: -266, 112: -266, 113: -266, 114: -266, 117: -266, 127: -266, 134: -266, 136: -266, 137: -266, 138: -266, 155: -266, 156: -266, 163: -266, 174: -266, 176: -266, 177: -266, 180: -266, 181: -266, 182: -266, 194: -266, 195: -266, 200: -266, 201: -266, 204: -266, 205: -266, 206: -266, 207: -266, 208: -266, 209: -266, 210: -266, 211: -266, 212: -266, 213: -266, 214: -266, 215: -266, 216: -266 }, { 1: -273, 6: -273, 37: -273, 39: -273, 42: -273, 43: -273, 44: -273, 45: -273, 46: -273, 47: -273, 58: -273, 59: -273, 60: -273, 71: -273, 72: -273, 77: -273, 84: -273, 95: -273, 99: -273, 108: -273, 109: -273, 110: -273, 111: -273, 112: -273, 113: -273, 114: -273, 117: -273, 127: -273, 134: -273, 136: -273, 137: -273, 138: -273, 142: -273, 155: -273, 156: -273, 163: -273, 174: -273, 176: -273, 177: -273, 180: -273, 181: -273, 182: -273, 194: -273, 195: -273, 200: -273, 201: -273, 202: -273, 203: -273, 204: -273, 205: -273, 206: -273, 207: -273, 208: -273, 209: -273, 210: -273, 211: -273, 212: -273, 213: -273, 214: -273, 215: -273, 216: -273, 217: -273 }, { 1: -73, 6: -73, 37: -73, 39: -73, 42: -73, 43: -73, 44: -73, 45: -73, 46: -73, 47: -73, 58: -73, 59: -73, 60: -73, 71: -73, 72: -73, 77: -73, 84: -73, 95: -73, 99: -73, 108: -73, 109: -73, 110: -73, 111: -73, 112: -73, 113: -73, 114: -73, 117: -73, 127: -73, 134: -73, 136: -73, 137: -73, 138: -73, 142: -73, 155: -73, 156: -73, 163: -73, 174: -73, 176: -73, 177: -73, 180: -73, 181: -73, 182: -73, 194: -73, 195: -73, 200: -73, 201: -73, 202: -73, 203: -73, 204: -73, 205: -73, 206: -73, 207: -73, 208: -73, 209: -73, 210: -73, 211: -73, 212: -73, 213: -73, 214: -73, 215: -73, 216: -73, 217: -73 }, { 57: 250, 67: 422 }, { 57: 250, 67: 423 }, { 40: 424, 43: 165, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 40: 425, 43: 165, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -319, 6: -319, 39: -319, 43: -319, 44: -319, 58: 109, 60: -319, 77: -319, 84: -319, 95: -319, 99: -319, 113: -319, 117: -319, 134: 128, 136: -319, 137: -319, 138: 426, 163: -319, 174: -319, 175: 127, 176: 97, 177: 98, 180: -319, 181: -319, 182: -319, 194: -319, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -321, 6: -321, 39: -321, 43: -321, 44: -321, 58: 109, 60: -321, 77: -321, 84: -321, 95: -321, 99: -321, 113: -321, 117: -321, 134: 128, 136: -321, 137: -321, 138: 427, 163: -321, 174: -321, 175: 127, 176: 97, 177: 98, 180: -321, 181: -321, 182: -321, 194: -321, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -327, 6: -327, 39: -327, 43: -327, 44: -327, 58: -327, 60: -327, 77: -327, 84: -327, 95: -327, 99: -327, 113: -327, 117: -327, 134: -327, 136: -327, 137: -327, 138: -327, 163: -327, 174: -327, 176: -327, 177: -327, 180: -327, 181: -327, 182: -327, 194: -327, 195: -327, 200: -327, 201: -327, 204: -327, 205: -327, 206: -327, 207: -327, 208: -327, 209: -327, 210: -327, 211: -327, 212: -327, 213: -327, 214: -327, 215: -327, 216: -327 }, { 1: -328, 6: -328, 39: -328, 43: -328, 44: -328, 58: 109, 60: -328, 77: -328, 84: -328, 95: -328, 99: -328, 113: -328, 117: -328, 134: 128, 136: -328, 137: -328, 138: -328, 163: -328, 174: -328, 175: 127, 176: 97, 177: 98, 180: -328, 181: -328, 182: -328, 194: -328, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 6: -99, 43: -99, 44: -99, 84: -99, 95: 428, 137: -99 }, { 6: -142, 39: -142, 43: -142, 44: -142, 84: 430, 99: -142, 120: 429, 137: -142 }, { 6: -108, 43: -108, 44: -108, 59: 431, 84: -108, 95: -108, 137: -108 }, { 7: 432, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 57: 250, 67: 249, 98: 433 }, { 6: -111, 43: -111, 44: -111, 84: -111, 95: -111, 137: -111 }, { 6: -210, 43: -210, 44: -210, 84: -210, 137: -210 }, { 6: -105, 37: -105, 43: -105, 44: -105, 59: -105, 84: -105, 95: -105, 108: -105, 109: -105, 110: -105, 111: -105, 112: -105, 114: -105, 137: -105, 156: -105 }, { 6: -106, 37: -106, 43: -106, 44: -106, 59: -106, 84: -106, 95: -106, 108: -106, 109: -106, 110: -106, 111: -106, 112: -106, 114: -106, 137: -106, 156: -106 }, { 6: -107, 37: -107, 43: -107, 44: -107, 59: -107, 84: -107, 95: -107, 108: -107, 109: -107, 110: -107, 111: -107, 112: -107, 114: -107, 137: -107, 156: -107 }, { 6: -100, 43: -100, 44: -100, 84: -100, 137: -100 }, { 36: 266, 56: 88, 57: 250, 61: 105, 65: 436, 67: 267, 96: 434, 97: 268, 100: 435, 101: 437, 102: 438, 103: 439, 104: 440, 107: 441, 133: 100, 158: 87, 173: 83 }, { 1: -194, 6: -194, 37: -194, 39: -194, 43: -194, 44: -194, 58: -194, 60: -194, 71: -194, 72: -194, 77: -194, 82: 442, 84: -194, 95: -194, 99: -194, 108: -194, 109: -194, 110: -194, 111: -194, 112: -194, 113: -194, 114: -194, 117: -194, 127: -194, 134: -194, 136: -194, 137: -194, 138: -194, 155: -194, 156: -194, 163: -194, 174: -194, 176: -194, 177: -194, 180: -194, 181: -194, 182: -194, 194: -194, 195: -194, 200: -194, 201: -194, 204: -194, 205: -194, 206: -194, 207: -194, 208: -194, 209: -194, 210: -194, 211: -194, 212: -194, 213: -194, 214: -194, 215: -194, 216: -194 }, { 1: -187, 6: -187, 37: -187, 39: -187, 42: -187, 43: -187, 44: -187, 45: -187, 46: -187, 47: -187, 58: -187, 59: -187, 60: -187, 71: -187, 72: -187, 77: -187, 84: -187, 95: -187, 99: -187, 108: -187, 109: -187, 110: -187, 111: -187, 112: -187, 113: -187, 114: -187, 117: -187, 127: -187, 134: -187, 136: -187, 137: -187, 138: -187, 155: -187, 156: -187, 163: -187, 174: -187, 176: -187, 177: -187, 180: -187, 181: -187, 182: -187, 194: -187, 195: -187, 200: -187, 201: -187, 204: -187, 205: -187, 206: -187, 207: -187, 208: -187, 209: -187, 210: -187, 211: -187, 212: -187, 213: -187, 214: -187, 215: -187, 216: -187 }, { 70: 276, 71: 106, 72: 107, 74: 443, 75: 444, 76: 275 }, { 71: -78, 72: -78, 74: -78, 76: -78 }, { 4: 445, 5: 3, 7: 4, 8: 5, 9: 6, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 446, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 77: 447, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 71: -83, 72: -83, 74: -83, 76: -83 }, { 1: -4, 6: -4, 44: -4, 77: -4, 174: -4 }, { 1: -397, 6: -397, 39: -397, 43: -397, 44: -397, 58: 109, 60: -397, 77: -397, 84: -397, 95: -397, 99: -397, 113: -397, 117: -397, 134: -397, 136: -397, 137: -397, 138: -397, 163: -397, 174: -397, 175: 127, 176: -397, 177: -397, 180: -397, 181: -397, 182: -397, 194: -397, 195: 126, 200: -397, 201: -397, 204: 112, 205: 113, 206: -397, 207: -397, 208: -397, 209: -397, 210: -397, 211: -397, 212: -397, 213: 121, 214: 122, 215: -397, 216: -397 }, { 1: -398, 6: -398, 39: -398, 43: -398, 44: -398, 58: 109, 60: -398, 77: -398, 84: -398, 95: -398, 99: -398, 113: -398, 117: -398, 134: -398, 136: -398, 137: -398, 138: -398, 163: -398, 174: -398, 175: 127, 176: -398, 177: -398, 180: -398, 181: -398, 182: -398, 194: -398, 195: 126, 200: -398, 201: -398, 204: 112, 205: 113, 206: -398, 207: -398, 208: -398, 209: -398, 210: -398, 211: -398, 212: -398, 213: 121, 214: 122, 215: -398, 216: -398 }, { 1: -399, 6: -399, 39: -399, 43: -399, 44: -399, 58: 109, 60: -399, 77: -399, 84: -399, 95: -399, 99: -399, 113: -399, 117: -399, 134: -399, 136: -399, 137: -399, 138: -399, 163: -399, 174: -399, 175: 127, 176: -399, 177: -399, 180: -399, 181: -399, 182: -399, 194: -399, 195: 126, 200: -399, 201: -399, 204: -399, 205: 113, 206: -399, 207: -399, 208: -399, 209: -399, 210: -399, 211: -399, 212: -399, 213: 121, 214: 122, 215: -399, 216: -399 }, { 1: -400, 6: -400, 39: -400, 43: -400, 44: -400, 58: 109, 60: -400, 77: -400, 84: -400, 95: -400, 99: -400, 113: -400, 117: -400, 134: -400, 136: -400, 137: -400, 138: -400, 163: -400, 174: -400, 175: 127, 176: -400, 177: -400, 180: -400, 181: -400, 182: -400, 194: -400, 195: 126, 200: -400, 201: -400, 204: -400, 205: 113, 206: -400, 207: -400, 208: -400, 209: -400, 210: -400, 211: -400, 212: -400, 213: 121, 214: 122, 215: -400, 216: -400 }, { 1: -401, 6: -401, 39: -401, 43: -401, 44: -401, 58: 109, 60: -401, 77: -401, 84: -401, 95: -401, 99: -401, 113: -401, 117: -401, 134: -401, 136: -401, 137: -401, 138: -401, 163: -401, 174: -401, 175: 127, 176: -401, 177: -401, 180: -401, 181: -401, 182: -401, 194: -401, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: -401, 207: -401, 208: -401, 209: -401, 210: -401, 211: -401, 212: -401, 213: 121, 214: 122, 215: -401, 216: -401 }, { 1: -402, 6: -402, 39: -402, 43: -402, 44: -402, 58: 109, 60: -402, 77: -402, 84: -402, 95: -402, 99: -402, 113: -402, 117: -402, 134: -402, 136: -402, 137: -402, 138: -402, 163: -402, 174: -402, 175: 127, 176: -402, 177: -402, 180: -402, 181: -402, 182: -402, 194: -402, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: -402, 208: -402, 209: -402, 210: -402, 211: -402, 212: -402, 213: 121, 214: 122, 215: 123, 216: -402 }, { 1: -403, 6: -403, 39: -403, 43: -403, 44: -403, 58: 109, 60: -403, 77: -403, 84: -403, 95: -403, 99: -403, 113: -403, 117: -403, 134: -403, 136: -403, 137: -403, 138: -403, 163: -403, 174: -403, 175: 127, 176: -403, 177: -403, 180: -403, 181: -403, 182: -403, 194: -403, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: -403, 209: -403, 210: -403, 211: -403, 212: -403, 213: 121, 214: 122, 215: 123, 216: -403 }, { 1: -404, 6: -404, 39: -404, 43: -404, 44: -404, 58: 109, 60: -404, 77: -404, 84: -404, 95: -404, 99: -404, 113: -404, 117: -404, 134: -404, 136: -404, 137: -404, 138: -404, 163: -404, 174: -404, 175: 127, 176: -404, 177: -404, 180: -404, 181: -404, 182: -404, 194: -404, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: -404, 210: -404, 211: -404, 212: -404, 213: 121, 214: 122, 215: 123, 216: -404 }, { 1: -405, 6: -405, 39: -405, 43: -405, 44: -405, 58: 109, 60: -405, 77: -405, 84: -405, 95: -405, 99: -405, 113: -405, 117: -405, 134: -405, 136: -405, 137: -405, 138: -405, 163: -405, 174: -405, 175: 127, 176: -405, 177: -405, 180: -405, 181: -405, 182: -405, 194: -405, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: -405, 211: -405, 212: -405, 213: 121, 214: 122, 215: 123, 216: -405 }, { 1: -406, 6: -406, 39: -406, 43: -406, 44: -406, 58: 109, 60: -406, 77: -406, 84: -406, 95: -406, 99: -406, 113: -406, 117: -406, 134: -406, 136: -406, 137: -406, 138: -406, 163: -406, 174: -406, 175: 127, 176: -406, 177: -406, 180: -406, 181: -406, 182: -406, 194: -406, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: -406, 212: -406, 213: 121, 214: 122, 215: 123, 216: -406 }, { 1: -407, 6: -407, 39: -407, 43: -407, 44: -407, 58: 109, 60: -407, 77: -407, 84: -407, 95: -407, 99: -407, 113: -407, 117: -407, 134: -407, 136: -407, 137: -407, 138: -407, 163: -407, 174: -407, 175: 127, 176: -407, 177: -407, 180: -407, 181: -407, 182: -407, 194: -407, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: -407, 213: 121, 214: 122, 215: 123, 216: -407 }, { 1: -408, 6: -408, 39: -408, 43: -408, 44: -408, 58: 109, 60: -408, 77: -408, 84: -408, 95: -408, 99: -408, 113: -408, 117: -408, 134: 128, 136: -408, 137: -408, 138: -408, 163: -408, 174: -408, 175: 127, 176: 97, 177: 98, 180: -408, 181: -408, 182: -408, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -409, 6: -409, 39: -409, 43: -409, 44: -409, 58: 109, 60: -409, 77: -409, 84: -409, 95: -409, 99: -409, 113: -409, 117: -409, 134: 128, 136: -409, 137: -409, 138: -409, 163: -409, 174: -409, 175: 127, 176: 97, 177: 98, 180: -409, 181: -409, 182: -409, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -410, 6: -410, 39: -410, 43: -410, 44: -410, 58: 109, 60: -410, 77: -410, 84: -410, 95: -410, 99: -410, 113: -410, 117: -410, 134: -410, 136: -410, 137: -410, 138: -410, 163: -410, 174: -410, 175: 127, 176: -410, 177: -410, 180: -410, 181: -410, 182: -410, 194: -410, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: -410, 208: -410, 209: -410, 210: -410, 211: -410, 212: -410, 213: 121, 214: 122, 215: -410, 216: -410 }, { 58: 109, 95: 448, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -379, 6: -379, 39: -379, 43: -379, 44: -379, 58: 109, 60: -379, 77: -379, 84: -379, 95: -379, 99: -379, 113: -379, 117: -379, 134: 128, 136: -379, 137: -379, 138: -379, 163: -379, 174: -379, 175: 127, 176: 97, 177: 98, 180: -379, 181: -379, 182: -379, 194: -379, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -381, 6: -381, 39: -381, 43: -381, 44: -381, 58: 109, 60: -381, 77: -381, 84: -381, 95: -381, 99: -381, 113: -381, 117: -381, 134: 128, 136: -381, 137: -381, 138: -381, 163: -381, 174: -381, 175: 127, 176: 97, 177: 98, 180: -381, 181: -381, 182: -381, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 136: 450, 180: 449, 182: 451 }, { 36: 157, 56: 161, 61: 105, 65: 160, 97: 158, 98: 162, 122: 202, 123: 159, 133: 100, 135: 452, 184: 201 }, { 36: 157, 56: 161, 61: 105, 65: 160, 97: 158, 98: 162, 122: 202, 123: 159, 133: 100, 135: 453, 184: 201 }, { 1: -357, 6: -357, 39: -357, 43: -357, 44: -357, 58: -357, 60: -357, 77: -357, 84: -357, 95: -357, 99: -357, 113: -357, 117: -357, 134: -357, 136: -357, 137: -357, 138: -357, 163: -357, 174: -357, 176: -357, 177: -357, 180: -357, 181: 454, 182: -357, 194: -357, 195: -357, 200: -357, 201: -357, 204: -357, 205: -357, 206: -357, 207: -357, 208: -357, 209: -357, 210: -357, 211: -357, 212: -357, 213: -357, 214: -357, 215: -357, 216: -357 }, { 1: -378, 6: -378, 39: -378, 43: -378, 44: -378, 58: 109, 60: -378, 77: -378, 84: -378, 95: -378, 99: -378, 113: -378, 117: -378, 134: 128, 136: -378, 137: -378, 138: -378, 163: -378, 174: -378, 175: 127, 176: 97, 177: 98, 180: -378, 181: -378, 182: -378, 194: -378, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -380, 6: -380, 39: -380, 43: -380, 44: -380, 58: 109, 60: -380, 77: -380, 84: -380, 95: -380, 99: -380, 113: -380, 117: -380, 134: 128, 136: -380, 137: -380, 138: -380, 163: -380, 174: -380, 175: 127, 176: 97, 177: 98, 180: -380, 181: -380, 182: -380, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -262, 6: -262, 37: -262, 39: -262, 43: -262, 44: -262, 58: -262, 60: -262, 71: -262, 72: -262, 77: -262, 82: -262, 84: -262, 95: -262, 99: -262, 108: -262, 109: -262, 110: -262, 111: -262, 112: -262, 113: -262, 114: -262, 117: -262, 127: -262, 134: -262, 136: -262, 137: -262, 138: -262, 155: -262, 156: -262, 163: -262, 174: -262, 176: -262, 177: -262, 180: -262, 181: -262, 182: -262, 194: -262, 195: -262, 200: -262, 201: -262, 204: -262, 205: -262, 206: -262, 207: -262, 208: -262, 209: -262, 210: -262, 211: -262, 212: -262, 213: -262, 214: -262, 215: -262, 216: -262 }, { 1: -263, 6: -263, 37: -263, 39: -263, 43: -263, 44: -263, 58: -263, 60: -263, 71: -263, 72: -263, 77: -263, 82: -263, 84: -263, 95: -263, 99: -263, 108: -263, 109: -263, 110: -263, 111: -263, 112: -263, 113: -263, 114: -263, 117: -263, 127: -263, 134: -263, 136: -263, 137: -263, 138: -263, 155: -263, 156: -263, 163: -263, 174: -263, 176: -263, 177: -263, 180: -263, 181: -263, 182: -263, 194: -263, 195: -263, 200: -263, 201: -263, 204: -263, 205: -263, 206: -263, 207: -263, 208: -263, 209: -263, 210: -263, 211: -263, 212: -263, 213: -263, 214: -263, 215: -263, 216: -263 }, { 1: -264, 6: -264, 37: -264, 39: -264, 43: -264, 44: -264, 58: -264, 60: -264, 71: -264, 72: -264, 77: -264, 82: -264, 84: -264, 95: -264, 99: -264, 108: -264, 109: -264, 110: -264, 111: -264, 112: -264, 113: -264, 114: -264, 117: -264, 127: -264, 134: -264, 136: -264, 137: -264, 138: -264, 155: -264, 156: -264, 163: -264, 174: -264, 176: -264, 177: -264, 180: -264, 181: -264, 182: -264, 194: -264, 195: -264, 200: -264, 201: -264, 204: -264, 205: -264, 206: -264, 207: -264, 208: -264, 209: -264, 210: -264, 211: -264, 212: -264, 213: -264, 214: -264, 215: -264, 216: -264 }, { 1: -160, 6: -160, 37: -160, 39: -160, 42: -160, 43: -160, 44: -160, 45: -160, 46: -160, 47: -160, 58: -160, 59: -160, 60: -160, 71: -160, 72: -160, 77: -160, 84: -160, 95: -160, 99: -160, 108: -160, 109: -160, 110: -160, 111: -160, 112: -160, 113: -160, 114: -160, 117: -160, 127: -160, 134: -160, 136: -160, 137: -160, 138: -160, 142: -160, 155: -160, 156: -160, 163: -160, 174: -160, 176: -160, 177: -160, 180: -160, 181: -160, 182: -160, 194: -160, 195: -160, 200: -160, 201: -160, 202: -160, 203: -160, 204: -160, 205: -160, 206: -160, 207: -160, 208: -160, 209: -160, 210: -160, 211: -160, 212: -160, 213: -160, 214: -160, 215: -160, 216: -160, 217: -160 }, { 1: -161, 6: -161, 37: -161, 39: -161, 42: -161, 43: -161, 44: -161, 45: -161, 46: -161, 47: -161, 58: -161, 59: -161, 60: -161, 71: -161, 72: -161, 77: -161, 84: -161, 95: -161, 99: -161, 108: -161, 109: -161, 110: -161, 111: -161, 112: -161, 113: -161, 114: -161, 117: -161, 127: -161, 134: -161, 136: -161, 137: -161, 138: -161, 142: -161, 155: -161, 156: -161, 163: -161, 174: -161, 176: -161, 177: -161, 180: -161, 181: -161, 182: -161, 194: -161, 195: -161, 200: -161, 201: -161, 202: -161, 203: -161, 204: -161, 205: -161, 206: -161, 207: -161, 208: -161, 209: -161, 210: -161, 211: -161, 212: -161, 213: -161, 214: -161, 215: -161, 216: -161, 217: -161 }, { 1: -162, 6: -162, 37: -162, 39: -162, 42: -162, 43: -162, 44: -162, 45: -162, 46: -162, 47: -162, 58: -162, 59: -162, 60: -162, 71: -162, 72: -162, 77: -162, 84: -162, 95: -162, 99: -162, 108: -162, 109: -162, 110: -162, 111: -162, 112: -162, 113: -162, 114: -162, 117: -162, 127: -162, 134: -162, 136: -162, 137: -162, 138: -162, 142: -162, 155: -162, 156: -162, 163: -162, 174: -162, 176: -162, 177: -162, 180: -162, 181: -162, 182: -162, 194: -162, 195: -162, 200: -162, 201: -162, 202: -162, 203: -162, 204: -162, 205: -162, 206: -162, 207: -162, 208: -162, 209: -162, 210: -162, 211: -162, 212: -162, 213: -162, 214: -162, 215: -162, 216: -162, 217: -162 }, { 1: -163, 6: -163, 37: -163, 39: -163, 42: -163, 43: -163, 44: -163, 45: -163, 46: -163, 47: -163, 58: -163, 59: -163, 60: -163, 71: -163, 72: -163, 77: -163, 84: -163, 95: -163, 99: -163, 108: -163, 109: -163, 110: -163, 111: -163, 112: -163, 113: -163, 114: -163, 117: -163, 127: -163, 134: -163, 136: -163, 137: -163, 138: -163, 142: -163, 155: -163, 156: -163, 163: -163, 174: -163, 176: -163, 177: -163, 180: -163, 181: -163, 182: -163, 194: -163, 195: -163, 200: -163, 201: -163, 202: -163, 203: -163, 204: -163, 205: -163, 206: -163, 207: -163, 208: -163, 209: -163, 210: -163, 211: -163, 212: -163, 213: -163, 214: -163, 215: -163, 216: -163, 217: -163 }, { 58: 109, 60: 315, 113: 455, 134: 128, 162: 456, 163: 314, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 457, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 60: 315, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 126: 458, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 162: 312, 163: 314, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 113: 459 }, { 113: 460 }, { 7: 461, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 44: -283, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 113: -283, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -90, 6: -90, 37: -90, 39: -90, 43: -90, 44: -90, 58: -90, 60: -90, 71: -90, 72: -90, 77: -90, 84: 462, 95: -90, 99: -90, 108: -90, 109: -90, 110: -90, 111: -90, 112: -90, 113: -87, 114: -90, 117: -90, 127: -90, 134: -90, 136: -90, 137: -90, 138: -90, 155: -90, 156: -90, 163: -90, 174: -90, 176: -90, 177: -90, 180: -90, 181: -90, 182: -90, 194: -90, 195: -90, 200: -90, 201: -90, 204: -90, 205: -90, 206: -90, 207: -90, 208: -90, 209: -90, 210: -90, 211: -90, 212: -90, 213: -90, 214: -90, 215: -90, 216: -90 }, { 11: -277, 35: -277, 44: -277, 48: -277, 50: -277, 51: -277, 52: -277, 56: -277, 61: -277, 64: -277, 69: -277, 71: -277, 72: -277, 79: -277, 80: -277, 86: -277, 87: -277, 88: -277, 89: -277, 90: -277, 91: -277, 98: -277, 104: -277, 107: -277, 113: -277, 115: -277, 116: -277, 118: -277, 119: -277, 131: -277, 132: -277, 133: -277, 134: -277, 141: -277, 143: -277, 151: -277, 158: -277, 168: -277, 172: -277, 173: -277, 176: -277, 177: -277, 179: -277, 183: -277, 185: -277, 191: -277, 193: -277, 196: -277, 197: -277, 198: -277, 199: -277, 200: -277, 201: -277, 202: -277, 203: -277 }, { 11: -278, 35: -278, 44: -278, 48: -278, 50: -278, 51: -278, 52: -278, 56: -278, 61: -278, 64: -278, 69: -278, 71: -278, 72: -278, 79: -278, 80: -278, 86: -278, 87: -278, 88: -278, 89: -278, 90: -278, 91: -278, 98: -278, 104: -278, 107: -278, 113: -278, 115: -278, 116: -278, 118: -278, 119: -278, 131: -278, 132: -278, 133: -278, 134: -278, 141: -278, 143: -278, 151: -278, 158: -278, 168: -278, 172: -278, 173: -278, 176: -278, 177: -278, 179: -278, 183: -278, 185: -278, 191: -278, 193: -278, 196: -278, 197: -278, 198: -278, 199: -278, 200: -278, 201: -278, 202: -278, 203: -278 }, { 7: 463, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 464, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 60: 315, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 126: 465, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 162: 312, 163: 314, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 466, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 467, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -177, 6: -177, 37: -177, 39: -177, 42: -177, 43: -177, 44: -177, 45: -177, 46: -177, 47: -177, 58: -177, 59: -177, 60: -177, 71: -177, 72: -177, 77: -177, 84: -177, 95: -177, 99: -177, 108: -177, 109: -177, 110: -177, 111: -177, 112: -177, 113: -177, 114: -177, 117: -177, 127: -177, 134: -177, 136: -177, 137: -177, 138: -177, 142: -177, 155: -177, 156: -177, 163: -177, 174: -177, 176: -177, 177: -177, 180: -177, 181: -177, 182: -177, 194: -177, 195: -177, 200: -177, 201: -177, 202: -177, 203: -177, 204: -177, 205: -177, 206: -177, 207: -177, 208: -177, 209: -177, 210: -177, 211: -177, 212: -177, 213: -177, 214: -177, 215: -177, 216: -177, 217: -177 }, { 1: -178, 6: -178, 37: -178, 39: -178, 42: -178, 43: -178, 44: -178, 45: -178, 46: -178, 47: -178, 58: -178, 59: -178, 60: -178, 71: -178, 72: -178, 77: -178, 84: -178, 95: -178, 99: -178, 108: -178, 109: -178, 110: -178, 111: -178, 112: -178, 113: -178, 114: -178, 117: -178, 127: -178, 134: -178, 136: -178, 137: -178, 138: -178, 142: -178, 155: -178, 156: -178, 163: -178, 174: -178, 176: -178, 177: -178, 180: -178, 181: -178, 182: -178, 194: -178, 195: -178, 200: -178, 201: -178, 202: -178, 203: -178, 204: -178, 205: -178, 206: -178, 207: -178, 208: -178, 209: -178, 210: -178, 211: -178, 212: -178, 213: -178, 214: -178, 215: -178, 216: -178, 217: -178 }, { 1: -179, 6: -179, 37: -179, 39: -179, 42: -179, 43: -179, 44: -179, 45: -179, 46: -179, 47: -179, 58: -179, 59: -179, 60: -179, 71: -179, 72: -179, 77: -179, 84: -179, 95: -179, 99: -179, 108: -179, 109: -179, 110: -179, 111: -179, 112: -179, 113: -179, 114: -179, 117: -179, 127: -179, 134: -179, 136: -179, 137: -179, 138: -179, 142: -179, 155: -179, 156: -179, 163: -179, 174: -179, 176: -179, 177: -179, 180: -179, 181: -179, 182: -179, 194: -179, 195: -179, 200: -179, 201: -179, 202: -179, 203: -179, 204: -179, 205: -179, 206: -179, 207: -179, 208: -179, 209: -179, 210: -179, 211: -179, 212: -179, 213: -179, 214: -179, 215: -179, 216: -179, 217: -179 }, { 1: -180, 6: -180, 37: -180, 39: -180, 42: -180, 43: -180, 44: -180, 45: -180, 46: -180, 47: -180, 58: -180, 59: -180, 60: -180, 71: -180, 72: -180, 77: -180, 84: -180, 95: -180, 99: -180, 108: -180, 109: -180, 110: -180, 111: -180, 112: -180, 113: -180, 114: -180, 117: -180, 127: -180, 134: -180, 136: -180, 137: -180, 138: -180, 142: -180, 155: -180, 156: -180, 163: -180, 174: -180, 176: -180, 177: -180, 180: -180, 181: -180, 182: -180, 194: -180, 195: -180, 200: -180, 201: -180, 202: -180, 203: -180, 204: -180, 205: -180, 206: -180, 207: -180, 208: -180, 209: -180, 210: -180, 211: -180, 212: -180, 213: -180, 214: -180, 215: -180, 216: -180, 217: -180 }, { 58: 109, 113: 468, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 469, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 470, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 471, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -96, 6: -96, 39: -96, 43: -96, 44: -96, 58: 109, 60: -96, 77: -96, 84: -96, 95: -96, 99: -96, 113: -96, 117: -96, 134: -96, 136: -96, 137: -96, 138: -96, 163: -96, 174: -96, 175: 127, 176: -96, 177: -96, 180: -96, 181: -96, 182: -96, 194: -96, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 472, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 473, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -36, 6: -36, 39: -36, 43: -36, 44: -36, 58: 109, 60: -36, 77: -36, 84: -36, 95: -36, 99: -36, 113: -36, 117: -36, 134: 128, 136: -36, 137: -36, 138: -36, 163: -36, 174: -36, 175: 127, 176: 97, 177: 98, 180: -36, 181: -36, 182: -36, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 474, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 475, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -39, 6: -39, 39: -39, 43: -39, 44: -39, 58: 109, 60: -39, 77: -39, 84: -39, 95: -39, 99: -39, 113: -39, 117: -39, 134: 128, 136: -39, 137: -39, 138: -39, 163: -39, 174: -39, 175: 127, 176: 97, 177: 98, 180: -39, 181: -39, 182: -39, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 476, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 477, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -42, 6: -42, 39: -42, 43: -42, 44: -42, 58: 109, 60: -42, 77: -42, 84: -42, 95: -42, 99: -42, 113: -42, 117: -42, 134: 128, 136: -42, 137: -42, 138: -42, 163: -42, 174: -42, 175: 127, 176: 97, 177: 98, 180: -42, 181: -42, 182: -42, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 478, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 479, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -45, 6: -45, 39: -45, 43: -45, 44: -45, 58: 109, 60: -45, 77: -45, 84: -45, 95: -45, 99: -45, 113: -45, 117: -45, 134: 128, 136: -45, 137: -45, 138: -45, 163: -45, 174: -45, 175: 127, 176: 97, 177: 98, 180: -45, 181: -45, 182: -45, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 480, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 481, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 49: 482, 118: 91, 119: 92 }, { 6: -143, 36: 157, 39: -143, 43: -143, 44: -143, 56: 161, 60: 156, 61: 105, 65: 160, 97: 158, 98: 162, 99: -143, 121: 483, 122: 155, 123: 159, 133: 100, 137: -143 }, { 6: 484, 43: 485 }, { 7: 486, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: -151, 39: -151, 43: -151, 44: -151, 84: -151, 117: -151 }, { 6: -289, 39: -289, 43: -289, 44: -289, 58: 109, 84: -289, 99: -289, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -70, 6: -70, 37: -70, 39: -70, 43: -70, 44: -70, 58: -70, 60: -70, 71: -70, 72: -70, 77: -70, 84: -70, 95: -70, 99: -70, 108: -70, 109: -70, 110: -70, 111: -70, 112: -70, 113: -70, 114: -70, 117: -70, 127: -70, 134: -70, 136: -70, 137: -70, 138: -70, 155: -70, 156: -70, 163: -70, 170: -70, 171: -70, 174: -70, 176: -70, 177: -70, 180: -70, 181: -70, 182: -70, 187: -70, 189: -70, 194: -70, 195: -70, 200: -70, 201: -70, 204: -70, 205: -70, 206: -70, 207: -70, 208: -70, 209: -70, 210: -70, 211: -70, 212: -70, 213: -70, 214: -70, 215: -70, 216: -70 }, { 6: 108, 44: 487 }, { 6: -142, 39: -142, 43: -142, 44: -142, 84: 341, 99: -142, 117: 488, 120: 342, 137: -142 }, { 44: 489 }, { 1: -412, 6: -412, 39: -412, 43: -412, 44: -412, 58: 109, 60: -412, 77: -412, 84: -412, 95: -412, 99: -412, 113: -412, 117: -412, 134: -412, 136: -412, 137: -412, 138: -412, 163: -412, 174: -412, 175: 127, 176: -412, 177: -412, 180: -412, 181: -412, 182: -412, 194: -412, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 490, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 491, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -48, 6: -48, 39: -48, 43: -48, 44: -48, 58: -48, 60: -48, 77: -48, 84: -48, 95: -48, 99: -48, 113: -48, 117: -48, 134: -48, 136: -48, 137: -48, 138: -48, 163: -48, 174: -48, 176: -48, 177: -48, 180: -48, 181: -48, 182: -48, 194: -48, 195: -48, 200: -48, 201: -48, 204: -48, 205: -48, 206: -48, 207: -48, 208: -48, 209: -48, 210: -48, 211: -48, 212: -48, 213: -48, 214: -48, 215: -48, 216: -48 }, { 7: 494, 8: 495, 9: 496, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 53: 492, 54: 493, 55: 497, 56: 498, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -376, 6: -376, 39: -376, 43: -376, 44: -376, 58: -376, 60: -376, 77: -376, 84: -376, 95: -376, 99: -376, 113: -376, 117: -376, 134: -376, 136: -376, 137: -376, 138: -376, 163: -376, 174: -376, 176: -376, 177: -376, 180: -376, 181: -376, 182: -376, 194: -376, 195: -376, 200: -376, 201: -376, 204: -376, 205: -376, 206: -376, 207: -376, 208: -376, 209: -376, 210: -376, 211: -376, 212: -376, 213: -376, 214: -376, 215: -376, 216: -376 }, { 7: 499, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -309, 6: -309, 39: -309, 43: -309, 44: -309, 58: -309, 60: -309, 77: -309, 84: -309, 95: -309, 99: -309, 113: -309, 117: -309, 134: -309, 136: -309, 137: -309, 138: -309, 163: -309, 170: 500, 174: -309, 176: -309, 177: -309, 180: -309, 181: -309, 182: -309, 194: -309, 195: -309, 200: -309, 201: -309, 204: -309, 205: -309, 206: -309, 207: -309, 208: -309, 209: -309, 210: -309, 211: -309, 212: -309, 213: -309, 214: -309, 215: -309, 216: -309 }, { 40: 501, 43: 165 }, { 36: 502, 40: 504, 43: 165, 61: 105, 65: 503, 133: 100 }, { 7: 505, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 506, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 507, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 136: 508 }, { 182: 509 }, { 1: -342, 6: -342, 39: -342, 43: -342, 44: -342, 58: -342, 60: -342, 77: -342, 84: -342, 95: -342, 99: -342, 113: -342, 117: -342, 134: -342, 136: -342, 137: -342, 138: -342, 163: -342, 174: -342, 176: -342, 177: -342, 180: -342, 181: -342, 182: -342, 194: -342, 195: -342, 200: -342, 201: -342, 204: -342, 205: -342, 206: -342, 207: -342, 208: -342, 209: -342, 210: -342, 211: -342, 212: -342, 213: -342, 214: -342, 215: -342, 216: -342 }, { 7: 510, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 36: 157, 56: 161, 61: 105, 65: 160, 97: 158, 98: 162, 122: 202, 123: 159, 133: 100, 184: 511 }, { 7: 512, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 186: 513, 188: 371, 189: 372 }, { 44: 514, 187: 515, 188: 516, 189: 372 }, { 44: -367, 187: -367, 189: -367 }, { 7: 518, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 167: 517, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -216, 6: -216, 39: -216, 40: 519, 43: 165, 44: -216, 58: 109, 60: -216, 77: -216, 84: -216, 95: -216, 99: -216, 113: -216, 117: -216, 134: -216, 136: -216, 137: -216, 138: -216, 163: -216, 174: -216, 175: 127, 176: -216, 177: -216, 180: -216, 181: -216, 182: -216, 194: -216, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -219, 6: -219, 39: -219, 43: -219, 44: -219, 58: -219, 60: -219, 77: -219, 84: -219, 95: -219, 99: -219, 113: -219, 117: -219, 134: -219, 136: -219, 137: -219, 138: -219, 163: -219, 174: -219, 176: -219, 177: -219, 180: -219, 181: -219, 182: -219, 194: -219, 195: -219, 200: -219, 201: -219, 204: -219, 205: -219, 206: -219, 207: -219, 208: -219, 209: -219, 210: -219, 211: -219, 212: -219, 213: -219, 214: -219, 215: -219, 216: -219 }, { 7: 520, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 44: 521 }, { 44: 522 }, { 1: -69, 6: -69, 39: -69, 43: -69, 44: -69, 58: 109, 60: -69, 77: -69, 84: -69, 95: -69, 99: -69, 113: -69, 117: -69, 134: -69, 136: -69, 137: -69, 138: -69, 163: -69, 174: -69, 175: 127, 176: -69, 177: -69, 180: -69, 181: -69, 182: -69, 194: -69, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 6: -144, 36: 157, 38: 523, 39: -144, 43: -144, 44: -144, 56: 161, 60: 156, 61: 105, 65: 160, 84: -144, 97: 158, 98: 162, 117: -144, 121: 154, 122: 155, 123: 159, 133: 100 }, { 1: -35, 6: -35, 39: -35, 43: -35, 44: -35, 58: -35, 60: -35, 77: -35, 84: -35, 95: -35, 99: -35, 113: -35, 117: -35, 134: -35, 136: -35, 137: -35, 138: -35, 163: -35, 174: -35, 176: -35, 177: -35, 180: -35, 181: -35, 182: -35, 194: -35, 195: -35, 200: -35, 201: -35, 204: -35, 205: -35, 206: -35, 207: -35, 208: -35, 209: -35, 210: -35, 211: -35, 212: -35, 213: -35, 214: -35, 215: -35, 216: -35 }, { 44: 524 }, { 70: 525, 71: 106, 72: 107 }, { 133: 527, 145: 526, 150: 223 }, { 70: 528, 71: 106, 72: 107 }, { 66: 529 }, { 6: -142, 39: -142, 43: -142, 44: -142, 84: 531, 99: -142, 120: 530, 137: -142 }, { 6: -229, 43: -229, 44: -229, 84: -229, 137: -229 }, { 36: 389, 43: 388, 61: 105, 146: 532, 147: 387, 149: 390 }, { 6: -234, 43: -234, 44: -234, 84: -234, 137: -234, 148: 533 }, { 6: -236, 43: -236, 44: -236, 84: -236, 137: -236, 148: 534 }, { 36: 535, 61: 105 }, { 1: -240, 6: -240, 39: -240, 43: -240, 44: -240, 66: 536, 77: -240, 84: -240, 99: -240, 174: -240, 176: -240, 177: -240, 194: -240, 195: -240 }, { 6: -142, 39: -142, 43: -142, 44: -142, 84: 538, 99: -142, 120: 537, 137: -142 }, { 6: -252, 43: -252, 44: -252, 84: -252, 137: -252 }, { 36: 396, 43: 395, 61: 105, 149: 397, 152: 539, 154: 394 }, { 6: -257, 43: -257, 44: -257, 84: -257, 137: -257, 148: 540 }, { 6: -260, 43: -260, 44: -260, 84: -260, 137: -260, 148: 541 }, { 6: 543, 7: 542, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 544, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -247, 6: -247, 39: -247, 43: -247, 44: -247, 58: 109, 77: -247, 84: -247, 99: -247, 134: 128, 174: -247, 175: 127, 176: 97, 177: 98, 194: -247, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 65: 545, 133: 100 }, { 70: 546, 71: 106, 72: 107 }, { 1: -317, 6: -317, 37: -317, 39: -317, 43: -317, 44: -317, 58: -317, 60: -317, 71: -317, 72: -317, 77: -317, 84: -317, 95: -317, 99: -317, 108: -317, 109: -317, 110: -317, 111: -317, 112: -317, 113: -317, 114: -317, 117: -317, 127: -317, 134: -317, 136: -317, 137: -317, 138: -317, 155: -317, 156: -317, 163: -317, 174: -317, 176: -317, 177: -317, 180: -317, 181: -317, 182: -317, 194: -317, 195: -317, 200: -317, 201: -317, 204: -317, 205: -317, 206: -317, 207: -317, 208: -317, 209: -317, 210: -317, 211: -317, 212: -317, 213: -317, 214: -317, 215: -317, 216: -317 }, { 6: 108, 44: 547 }, { 7: 548, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -275, 6: -275, 37: -275, 39: -275, 42: -275, 43: -275, 44: -275, 45: -275, 46: -275, 47: -275, 58: -275, 59: -275, 60: -275, 71: -275, 72: -275, 77: -275, 84: -275, 95: -275, 99: -275, 108: -275, 109: -275, 110: -275, 111: -275, 112: -275, 113: -275, 114: -275, 117: -275, 127: -275, 134: -275, 136: -275, 137: -275, 138: -275, 155: -275, 156: -275, 163: -275, 174: -275, 176: -275, 177: -275, 180: -275, 181: -275, 182: -275, 194: -275, 195: -275, 200: -275, 201: -275, 204: -275, 205: -275, 206: -275, 207: -275, 208: -275, 209: -275, 210: -275, 211: -275, 212: -275, 213: -275, 214: -275, 215: -275, 216: -275 }, { 6: 411, 11: -303, 35: -303, 43: -303, 44: -303, 48: -303, 50: -303, 51: -303, 52: -303, 56: -303, 60: -303, 61: -303, 64: -303, 69: -303, 71: -303, 72: -303, 79: -303, 80: -303, 84: -303, 86: -303, 87: -303, 88: -303, 89: -303, 90: -303, 91: -303, 98: -303, 99: -303, 104: -303, 107: -303, 115: -303, 116: -303, 118: -303, 119: -303, 131: -303, 132: -303, 133: -303, 134: -303, 141: -303, 143: -303, 151: -303, 158: -303, 168: -303, 172: -303, 173: -303, 176: -303, 177: -303, 179: -303, 183: -303, 185: -303, 191: -303, 193: -303, 196: -303, 197: -303, 198: -303, 199: -303, 200: -303, 201: -303, 202: -303, 203: -303 }, { 6: -299, 43: -299, 44: -299, 84: -299, 99: -299 }, { 43: 550, 99: 549 }, { 6: -143, 7: 345, 8: 241, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 39: -143, 41: 34, 43: -143, 44: -143, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 60: 243, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 84: 239, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 99: -143, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 124: 242, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 137: -143, 141: 65, 143: 71, 151: 72, 158: 87, 159: 552, 164: 240, 165: 551, 166: 236, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: 553, 43: -300, 44: -300, 99: -300 }, { 6: -305, 11: -305, 35: -305, 43: -305, 44: -305, 48: -305, 50: -305, 51: -305, 52: -305, 56: -305, 60: -305, 61: -305, 64: -305, 69: -305, 71: -305, 72: -305, 79: -305, 80: -305, 84: -305, 86: -305, 87: -305, 88: -305, 89: -305, 90: -305, 91: -305, 98: -305, 99: -305, 104: -305, 107: -305, 115: -305, 116: -305, 118: -305, 119: -305, 131: -305, 132: -305, 133: -305, 134: -305, 141: -305, 143: -305, 151: -305, 158: -305, 168: -305, 172: -305, 173: -305, 176: -305, 177: -305, 179: -305, 183: -305, 185: -305, 191: -305, 193: -305, 196: -305, 197: -305, 198: -305, 199: -305, 200: -305, 201: -305, 202: -305, 203: -305 }, { 6: -142, 39: -142, 43: -142, 44: -142, 84: 409, 99: -142, 120: 410, 137: -142, 161: 554 }, { 7: 345, 8: 241, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 60: 243, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 84: 239, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 124: 242, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 164: 407, 166: 406, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: -157, 39: -157, 43: -157, 44: -157, 58: 109, 84: -157, 99: -157, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -199, 6: -199, 37: -199, 39: -199, 43: -199, 44: -199, 58: -199, 60: -199, 71: -199, 72: -199, 77: -199, 84: -199, 95: -199, 99: -199, 108: -199, 109: -199, 110: -199, 111: -199, 112: -199, 113: -199, 114: -199, 117: -199, 127: -199, 134: -199, 136: -199, 137: -199, 138: -199, 155: -199, 156: -199, 163: -199, 174: -199, 176: -199, 177: -199, 180: -199, 181: -199, 182: -199, 194: -199, 195: -199, 200: -199, 201: -199, 204: -199, 205: -199, 206: -199, 207: -199, 208: -199, 209: -199, 210: -199, 211: -199, 212: -199, 213: -199, 214: -199, 215: -199, 216: -199 }, { 58: 109, 113: 555, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 556, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -269, 6: -269, 37: -269, 39: -269, 43: -269, 44: -269, 58: -269, 60: -269, 71: -269, 72: -269, 77: -269, 82: -269, 84: -269, 95: -269, 99: -269, 108: -269, 109: -269, 110: -269, 111: -269, 112: -269, 113: -269, 114: -269, 117: -269, 127: -269, 134: -269, 136: -269, 137: -269, 138: -269, 155: -269, 156: -269, 163: -269, 174: -269, 176: -269, 177: -269, 180: -269, 181: -269, 182: -269, 194: -269, 195: -269, 200: -269, 201: -269, 204: -269, 205: -269, 206: -269, 207: -269, 208: -269, 209: -269, 210: -269, 211: -269, 212: -269, 213: -269, 214: -269, 215: -269, 216: -269 }, { 6: -142, 39: -142, 43: -142, 44: -142, 84: 558, 99: -142, 120: 557, 137: -142 }, { 6: -284, 39: -284, 43: -284, 44: -284, 84: -284 }, { 7: 345, 8: 241, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 421, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 60: 243, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 124: 242, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 157: 559, 158: 87, 164: 420, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -202, 6: -202, 37: -202, 39: -202, 43: -202, 44: -202, 58: -202, 60: -202, 71: -202, 72: -202, 77: -202, 84: -202, 95: -202, 99: -202, 108: -202, 109: -202, 110: -202, 111: -202, 112: -202, 113: -202, 114: -202, 117: -202, 127: -202, 134: -202, 136: -202, 137: -202, 138: -202, 155: -202, 156: -202, 163: -202, 174: -202, 176: -202, 177: -202, 180: -202, 181: -202, 182: -202, 194: -202, 195: -202, 200: -202, 201: -202, 204: -202, 205: -202, 206: -202, 207: -202, 208: -202, 209: -202, 210: -202, 211: -202, 212: -202, 213: -202, 214: -202, 215: -202, 216: -202 }, { 1: -203, 6: -203, 37: -203, 39: -203, 43: -203, 44: -203, 58: -203, 60: -203, 71: -203, 72: -203, 77: -203, 84: -203, 95: -203, 99: -203, 108: -203, 109: -203, 110: -203, 111: -203, 112: -203, 113: -203, 114: -203, 117: -203, 127: -203, 134: -203, 136: -203, 137: -203, 138: -203, 155: -203, 156: -203, 163: -203, 174: -203, 176: -203, 177: -203, 180: -203, 181: -203, 182: -203, 194: -203, 195: -203, 200: -203, 201: -203, 204: -203, 205: -203, 206: -203, 207: -203, 208: -203, 209: -203, 210: -203, 211: -203, 212: -203, 213: -203, 214: -203, 215: -203, 216: -203 }, { 1: -371, 6: -371, 39: -371, 43: -371, 44: -371, 58: -371, 60: -371, 77: -371, 84: -371, 95: -371, 99: -371, 113: -371, 117: -371, 134: -371, 136: -371, 137: -371, 138: -371, 163: -371, 174: -371, 176: -371, 177: -371, 180: -371, 181: -371, 182: -371, 187: -371, 194: -371, 195: -371, 200: -371, 201: -371, 204: -371, 205: -371, 206: -371, 207: -371, 208: -371, 209: -371, 210: -371, 211: -371, 212: -371, 213: -371, 214: -371, 215: -371, 216: -371 }, { 1: -373, 6: -373, 39: -373, 43: -373, 44: -373, 58: -373, 60: -373, 77: -373, 84: -373, 95: -373, 99: -373, 113: -373, 117: -373, 134: -373, 136: -373, 137: -373, 138: -373, 163: -373, 174: -373, 176: -373, 177: -373, 180: -373, 181: -373, 182: -373, 187: 560, 194: -373, 195: -373, 200: -373, 201: -373, 204: -373, 205: -373, 206: -373, 207: -373, 208: -373, 209: -373, 210: -373, 211: -373, 212: -373, 213: -373, 214: -373, 215: -373, 216: -373 }, { 7: 561, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 562, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 563, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 564, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: 566, 43: 567, 137: 565 }, { 6: -143, 36: 266, 39: -143, 43: -143, 44: -143, 56: 263, 57: 250, 60: 270, 61: 105, 67: 267, 68: 264, 69: 101, 70: 102, 71: 106, 72: 107, 92: 568, 93: 569, 94: 269, 96: 261, 97: 268, 98: 262, 99: -143, 137: -143 }, { 7: 570, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 571, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 58: 109, 99: 572, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 573, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: -112, 37: -114, 43: -112, 44: -112, 71: -267, 72: -267, 84: -112, 105: 574, 108: -114, 109: -114, 110: -114, 111: -114, 112: -114, 114: -114, 137: -112, 156: 141 }, { 6: -113, 37: -267, 43: -113, 44: -113, 71: -267, 72: -267, 84: -113, 105: 575, 108: 576, 109: 577, 110: 578, 111: 579, 112: 580, 114: 581, 137: -113, 156: 141 }, { 6: -115, 37: -115, 43: -115, 44: -115, 84: -115, 108: -115, 109: -115, 110: -115, 111: -115, 112: -115, 114: -115, 137: -115, 156: -115 }, { 6: -116, 37: -116, 43: -116, 44: -116, 84: -116, 108: -116, 109: -116, 110: -116, 111: -116, 112: -116, 114: -116, 137: -116, 156: -116 }, { 6: -117, 37: -117, 43: -117, 44: -117, 84: -117, 108: -117, 109: -117, 110: -117, 111: -117, 112: -117, 114: -117, 137: -117, 156: -117 }, { 6: -118, 37: -118, 43: -118, 44: -118, 84: -118, 108: -118, 109: -118, 110: -118, 111: -118, 112: -118, 114: -118, 137: -118, 156: -118 }, { 37: -267, 71: -267, 72: -267, 105: 582, 108: 245, 112: 246, 156: 141 }, { 37: 247, 106: 583 }, { 1: -85, 6: -85, 37: -85, 39: -85, 43: -85, 44: -85, 58: -85, 60: -85, 71: -85, 72: -85, 77: -85, 84: -85, 95: -85, 99: -85, 108: -85, 109: -85, 110: -85, 111: -85, 112: -85, 113: -85, 114: -85, 117: -85, 127: -85, 134: -85, 136: -85, 137: -85, 138: -85, 155: -85, 156: -85, 163: -85, 174: -85, 176: -85, 177: -85, 180: -85, 181: -85, 182: -85, 194: -85, 195: -85, 200: -85, 201: -85, 204: -85, 205: -85, 206: -85, 207: -85, 208: -85, 209: -85, 210: -85, 211: -85, 212: -85, 213: -85, 214: -85, 215: -85, 216: -85 }, { 1: -77, 6: -77, 37: -77, 39: -77, 43: -77, 44: -77, 58: -77, 60: -77, 71: -77, 72: -77, 74: -77, 76: -77, 77: -77, 82: -77, 84: -77, 95: -77, 99: -77, 108: -77, 109: -77, 110: -77, 111: -77, 112: -77, 113: -77, 114: -77, 117: -77, 127: -77, 134: -77, 136: -77, 137: -77, 138: -77, 155: -77, 156: -77, 163: -77, 174: -77, 176: -77, 177: -77, 180: -77, 181: -77, 182: -77, 194: -77, 195: -77, 200: -77, 201: -77, 204: -77, 205: -77, 206: -77, 207: -77, 208: -77, 209: -77, 210: -77, 211: -77, 212: -77, 213: -77, 214: -77, 215: -77, 216: -77 }, { 71: -79, 72: -79, 74: -79, 76: -79 }, { 6: 108, 77: 584 }, { 4: 585, 5: 3, 7: 4, 8: 5, 9: 6, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 71: -82, 72: -82, 74: -82, 76: -82 }, { 7: 586, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 587, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 588, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 589, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 136: 590 }, { 182: 591 }, { 7: 592, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -166, 6: -166, 37: -166, 39: -166, 42: -166, 43: -166, 44: -166, 45: -166, 46: -166, 47: -166, 58: -166, 59: -166, 60: -166, 71: -166, 72: -166, 77: -166, 84: -166, 95: -166, 99: -166, 108: -166, 109: -166, 110: -166, 111: -166, 112: -166, 113: -166, 114: -166, 117: -166, 127: -166, 134: -166, 136: -166, 137: -166, 138: -166, 142: -166, 155: -166, 156: -166, 163: -166, 174: -166, 176: -166, 177: -166, 180: -166, 181: -166, 182: -166, 194: -166, 195: -166, 200: -166, 201: -166, 202: -166, 203: -166, 204: -166, 205: -166, 206: -166, 207: -166, 208: -166, 209: -166, 210: -166, 211: -166, 212: -166, 213: -166, 214: -166, 215: -166, 216: -166, 217: -166 }, { 7: 593, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 44: -281, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 113: -281, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 44: 594, 58: 109, 60: 315, 134: 128, 162: 456, 163: 314, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 44: 595 }, { 1: -168, 6: -168, 37: -168, 39: -168, 42: -168, 43: -168, 44: -168, 45: -168, 46: -168, 47: -168, 58: -168, 59: -168, 60: -168, 71: -168, 72: -168, 77: -168, 84: -168, 95: -168, 99: -168, 108: -168, 109: -168, 110: -168, 111: -168, 112: -168, 113: -168, 114: -168, 117: -168, 127: -168, 134: -168, 136: -168, 137: -168, 138: -168, 142: -168, 155: -168, 156: -168, 163: -168, 174: -168, 176: -168, 177: -168, 180: -168, 181: -168, 182: -168, 194: -168, 195: -168, 200: -168, 201: -168, 202: -168, 203: -168, 204: -168, 205: -168, 206: -168, 207: -168, 208: -168, 209: -168, 210: -168, 211: -168, 212: -168, 213: -168, 214: -168, 215: -168, 216: -168, 217: -168 }, { 1: -170, 6: -170, 37: -170, 39: -170, 42: -170, 43: -170, 44: -170, 45: -170, 46: -170, 47: -170, 58: -170, 59: -170, 60: -170, 71: -170, 72: -170, 77: -170, 84: -170, 95: -170, 99: -170, 108: -170, 109: -170, 110: -170, 111: -170, 112: -170, 113: -170, 114: -170, 117: -170, 127: -170, 134: -170, 136: -170, 137: -170, 138: -170, 142: -170, 155: -170, 156: -170, 163: -170, 174: -170, 176: -170, 177: -170, 180: -170, 181: -170, 182: -170, 194: -170, 195: -170, 200: -170, 201: -170, 202: -170, 203: -170, 204: -170, 205: -170, 206: -170, 207: -170, 208: -170, 209: -170, 210: -170, 211: -170, 212: -170, 213: -170, 214: -170, 215: -170, 216: -170, 217: -170 }, { 44: -282, 58: 109, 113: -282, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 596, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 58: 109, 60: 315, 113: 597, 134: 128, 162: 456, 163: 314, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 598, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 60: 315, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 126: 599, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 162: 312, 163: 314, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 113: 600 }, { 58: 109, 113: 601, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 602, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -183, 6: -183, 37: -183, 39: -183, 42: -183, 43: -183, 44: -183, 45: -183, 46: -183, 47: -183, 58: -183, 59: -183, 60: -183, 71: -183, 72: -183, 77: -183, 84: -183, 95: -183, 99: -183, 108: -183, 109: -183, 110: -183, 111: -183, 112: -183, 113: -183, 114: -183, 117: -183, 127: -183, 134: -183, 136: -183, 137: -183, 138: -183, 142: -183, 155: -183, 156: -183, 163: -183, 174: -183, 176: -183, 177: -183, 180: -183, 181: -183, 182: -183, 194: -183, 195: -183, 200: -183, 201: -183, 202: -183, 203: -183, 204: -183, 205: -183, 206: -183, 207: -183, 208: -183, 209: -183, 210: -183, 211: -183, 212: -183, 213: -183, 214: -183, 215: -183, 216: -183, 217: -183 }, { 44: 603, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 58: 109, 113: 604, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 605, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -97, 6: -97, 39: -97, 43: -97, 44: -97, 58: 109, 60: -97, 77: -97, 84: -97, 95: -97, 99: -97, 113: -97, 117: -97, 134: -97, 136: -97, 137: -97, 138: -97, 163: -97, 174: -97, 175: 127, 176: -97, 177: -97, 180: -97, 181: -97, 182: -97, 194: -97, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 44: 606, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -37, 6: -37, 39: -37, 43: -37, 44: -37, 58: 109, 60: -37, 77: -37, 84: -37, 95: -37, 99: -37, 113: -37, 117: -37, 134: 128, 136: -37, 137: -37, 138: -37, 163: -37, 174: -37, 175: 127, 176: 97, 177: 98, 180: -37, 181: -37, 182: -37, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 44: 607, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -40, 6: -40, 39: -40, 43: -40, 44: -40, 58: 109, 60: -40, 77: -40, 84: -40, 95: -40, 99: -40, 113: -40, 117: -40, 134: 128, 136: -40, 137: -40, 138: -40, 163: -40, 174: -40, 175: 127, 176: 97, 177: 98, 180: -40, 181: -40, 182: -40, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 44: 608, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -43, 6: -43, 39: -43, 43: -43, 44: -43, 58: 109, 60: -43, 77: -43, 84: -43, 95: -43, 99: -43, 113: -43, 117: -43, 134: 128, 136: -43, 137: -43, 138: -43, 163: -43, 174: -43, 175: 127, 176: 97, 177: 98, 180: -43, 181: -43, 182: -43, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 44: 609, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -46, 6: -46, 39: -46, 43: -46, 44: -46, 58: 109, 60: -46, 77: -46, 84: -46, 95: -46, 99: -46, 113: -46, 117: -46, 134: 128, 136: -46, 137: -46, 138: -46, 163: -46, 174: -46, 175: 127, 176: 97, 177: 98, 180: -46, 181: -46, 182: -46, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 44: 610, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 5: 612, 7: 4, 8: 5, 9: 6, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 40: 611, 41: 34, 43: 165, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: -146, 39: -146, 43: -146, 44: -146, 84: -146, 117: -146 }, { 36: 157, 56: 161, 60: 156, 61: 105, 65: 160, 97: 158, 98: 162, 121: 613, 122: 155, 123: 159, 133: 100 }, { 6: -144, 36: 157, 38: 614, 39: -144, 43: -144, 44: -144, 56: 161, 60: 156, 61: 105, 65: 160, 84: -144, 97: 158, 98: 162, 117: -144, 121: 154, 122: 155, 123: 159, 133: 100 }, { 6: -150, 39: -150, 43: -150, 44: -150, 58: 109, 84: -150, 117: -150, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -71, 6: -71, 37: -71, 39: -71, 43: -71, 44: -71, 58: -71, 60: -71, 71: -71, 72: -71, 77: -71, 84: -71, 95: -71, 99: -71, 108: -71, 109: -71, 110: -71, 111: -71, 112: -71, 113: -71, 114: -71, 117: -71, 127: -71, 134: -71, 136: -71, 137: -71, 138: -71, 155: -71, 156: -71, 163: -71, 170: -71, 171: -71, 174: -71, 176: -71, 177: -71, 180: -71, 181: -71, 182: -71, 187: -71, 189: -71, 194: -71, 195: -71, 200: -71, 201: -71, 204: -71, 205: -71, 206: -71, 207: -71, 208: -71, 209: -71, 210: -71, 211: -71, 212: -71, 213: -71, 214: -71, 215: -71, 216: -71 }, { 49: 615, 118: 91, 119: 92 }, { 1: -391, 6: -391, 39: -391, 43: -391, 44: -391, 58: -391, 60: -391, 77: -391, 84: -391, 95: -391, 99: -391, 113: -391, 117: -391, 134: -391, 136: -391, 137: -391, 138: -391, 163: -391, 174: -391, 176: -391, 177: -391, 180: -391, 181: -391, 182: -391, 194: -391, 195: -391, 200: -391, 201: -391, 204: -391, 205: -391, 206: -391, 207: -391, 208: -391, 209: -391, 210: -391, 211: -391, 212: -391, 213: -391, 214: -391, 215: -391, 216: -391 }, { 44: 616, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -414, 6: -414, 39: -414, 43: -414, 44: -414, 58: 109, 60: -414, 77: -414, 84: -414, 95: -414, 99: -414, 113: -414, 117: -414, 134: -414, 136: -414, 137: -414, 138: -414, 163: -414, 174: -414, 175: 127, 176: -414, 177: -414, 180: -414, 181: -414, 182: -414, 194: -414, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 6: 618, 44: 617 }, { 6: -53, 44: -53 }, { 6: -56, 44: -56, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 6: -57, 44: -57 }, { 6: -58, 44: -58, 175: 131, 176: 97, 177: 98, 194: 129, 195: 130 }, { 6: -59, 44: -59 }, { 1: -272, 6: -272, 37: -272, 39: -272, 43: -272, 44: -272, 57: 619, 58: -272, 60: 620, 67: 249, 71: -272, 72: -272, 77: -272, 84: -272, 95: -272, 99: -272, 108: -272, 109: -272, 110: -272, 111: -272, 112: -272, 113: -272, 114: -272, 117: -272, 127: -272, 134: -272, 136: -272, 137: -272, 138: -272, 155: -272, 156: -272, 163: -272, 174: -272, 176: -272, 177: -272, 180: -272, 181: -272, 182: -272, 194: -272, 195: -272, 200: -272, 201: -272, 204: -272, 205: -272, 206: -272, 207: -272, 208: -272, 209: -272, 210: -272, 211: -272, 212: -272, 213: -272, 214: -272, 215: -272, 216: -272 }, { 40: 621, 43: 165, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 40: 622, 43: 165 }, { 1: -310, 6: -310, 39: -310, 43: -310, 44: -310, 58: -310, 60: -310, 77: -310, 84: -310, 95: -310, 99: -310, 113: -310, 117: -310, 134: -310, 136: -310, 137: -310, 138: -310, 163: -310, 174: -310, 176: -310, 177: -310, 180: -310, 181: -310, 182: -310, 194: -310, 195: -310, 200: -310, 201: -310, 204: -310, 205: -310, 206: -310, 207: -310, 208: -310, 209: -310, 210: -310, 211: -310, 212: -310, 213: -310, 214: -310, 215: -310, 216: -310 }, { 40: 623, 43: 165 }, { 40: 624, 43: 165 }, { 1: -314, 6: -314, 39: -314, 43: -314, 44: -314, 58: -314, 60: -314, 77: -314, 84: -314, 95: -314, 99: -314, 113: -314, 117: -314, 134: -314, 136: -314, 137: -314, 138: -314, 163: -314, 170: -314, 174: -314, 176: -314, 177: -314, 180: -314, 181: -314, 182: -314, 194: -314, 195: -314, 200: -314, 201: -314, 204: -314, 205: -314, 206: -314, 207: -314, 208: -314, 209: -314, 210: -314, 211: -314, 212: -314, 213: -314, 214: -314, 215: -314, 216: -314 }, { 40: 625, 43: 165, 58: 109, 134: 128, 138: 626, 175: 127, 176: 97, 177: 98, 181: 627, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 40: 628, 43: 165, 58: 109, 134: 128, 138: 629, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 40: 630, 43: 165, 58: 109, 134: 128, 138: 631, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 632, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 633, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 40: 634, 43: 165, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 136: -362, 180: -362, 182: -362 }, { 58: 109, 84: -360, 134: 128, 136: -360, 175: 127, 176: 97, 177: 98, 180: -360, 182: -360, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 44: 635, 187: 636, 188: 516, 189: 372 }, { 1: -365, 6: -365, 39: -365, 43: -365, 44: -365, 58: -365, 60: -365, 77: -365, 84: -365, 95: -365, 99: -365, 113: -365, 117: -365, 134: -365, 136: -365, 137: -365, 138: -365, 163: -365, 174: -365, 176: -365, 177: -365, 180: -365, 181: -365, 182: -365, 194: -365, 195: -365, 200: -365, 201: -365, 204: -365, 205: -365, 206: -365, 207: -365, 208: -365, 209: -365, 210: -365, 211: -365, 212: -365, 213: -365, 214: -365, 215: -365, 216: -365 }, { 40: 637, 43: 165 }, { 44: -368, 187: -368, 189: -368 }, { 40: 638, 43: 165, 84: 639 }, { 43: -306, 58: 109, 84: -306, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -217, 6: -217, 39: -217, 43: -217, 44: -217, 58: -217, 60: -217, 77: -217, 84: -217, 95: -217, 99: -217, 113: -217, 117: -217, 134: -217, 136: -217, 137: -217, 138: -217, 163: -217, 174: -217, 176: -217, 177: -217, 180: -217, 181: -217, 182: -217, 194: -217, 195: -217, 200: -217, 201: -217, 204: -217, 205: -217, 206: -217, 207: -217, 208: -217, 209: -217, 210: -217, 211: -217, 212: -217, 213: -217, 214: -217, 215: -217, 216: -217 }, { 1: -220, 6: -220, 39: -220, 40: 640, 43: 165, 44: -220, 58: 109, 60: -220, 77: -220, 84: -220, 95: -220, 99: -220, 113: -220, 117: -220, 134: -220, 136: -220, 137: -220, 138: -220, 163: -220, 174: -220, 175: 127, 176: -220, 177: -220, 180: -220, 181: -220, 182: -220, 194: -220, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -316, 6: -316, 39: -316, 43: -316, 44: -316, 58: -316, 60: -316, 77: -316, 84: -316, 95: -316, 99: -316, 113: -316, 117: -316, 134: -316, 136: -316, 137: -316, 138: -316, 163: -316, 174: -316, 176: -316, 177: -316, 180: -316, 181: -316, 182: -316, 194: -316, 195: -316, 200: -316, 201: -316, 204: -316, 205: -316, 206: -316, 207: -316, 208: -316, 209: -316, 210: -316, 211: -316, 212: -316, 213: -316, 214: -316, 215: -316, 216: -316 }, { 1: -68, 6: -68, 39: -68, 43: -68, 44: -68, 58: -68, 60: -68, 77: -68, 84: -68, 95: -68, 99: -68, 113: -68, 117: -68, 134: -68, 136: -68, 137: -68, 138: -68, 163: -68, 174: -68, 176: -68, 177: -68, 180: -68, 181: -68, 182: -68, 194: -68, 195: -68, 200: -68, 201: -68, 204: -68, 205: -68, 206: -68, 207: -68, 208: -68, 209: -68, 210: -68, 211: -68, 212: -68, 213: -68, 214: -68, 215: -68, 216: -68 }, { 6: -142, 39: 641, 43: -142, 44: -142, 84: 341, 99: -142, 120: 342, 137: -142 }, { 1: -134, 6: -134, 39: -134, 43: -134, 44: -134, 77: -134, 84: -134, 99: -134, 174: -134, 176: -134, 177: -134, 194: -134, 195: -134 }, { 1: -223, 6: -223, 39: -223, 43: -223, 44: -223, 77: -223, 84: -223, 99: -223, 174: -223, 176: -223, 177: -223, 194: -223, 195: -223 }, { 66: 642 }, { 36: 389, 43: 388, 61: 105, 146: 643, 147: 387, 149: 390 }, { 1: -224, 6: -224, 39: -224, 43: -224, 44: -224, 77: -224, 84: -224, 99: -224, 174: -224, 176: -224, 177: -224, 194: -224, 195: -224 }, { 70: 644, 71: 106, 72: 107 }, { 6: 646, 43: 647, 137: 645 }, { 6: -143, 36: 389, 39: -143, 43: -143, 44: -143, 61: 105, 99: -143, 137: -143, 147: 648, 149: 390 }, { 6: -142, 39: -142, 43: -142, 44: -142, 84: 531, 99: -142, 120: 649, 137: -142 }, { 36: 650, 61: 105 }, { 36: 651, 61: 105 }, { 66: -239 }, { 70: 652, 71: 106, 72: 107 }, { 6: 654, 43: 655, 137: 653 }, { 6: -143, 36: 396, 39: -143, 43: -143, 44: -143, 61: 105, 99: -143, 137: -143, 149: 397, 154: 656 }, { 6: -142, 39: -142, 43: -142, 44: -142, 84: 538, 99: -142, 120: 657, 137: -142 }, { 36: 658, 61: 105, 149: 659 }, { 36: 660, 61: 105 }, { 1: -244, 6: -244, 39: -244, 43: -244, 44: -244, 58: 109, 77: -244, 84: -244, 99: -244, 134: 128, 174: -244, 175: 127, 176: -244, 177: -244, 194: -244, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 661, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 662, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 44: 663 }, { 1: -249, 6: -249, 39: -249, 43: -249, 44: -249, 77: -249, 84: -249, 99: -249, 174: -249, 176: -249, 177: -249, 194: -249, 195: -249 }, { 174: 664 }, { 58: 109, 99: 665, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -276, 6: -276, 37: -276, 39: -276, 42: -276, 43: -276, 44: -276, 45: -276, 46: -276, 47: -276, 58: -276, 59: -276, 60: -276, 71: -276, 72: -276, 77: -276, 84: -276, 95: -276, 99: -276, 108: -276, 109: -276, 110: -276, 111: -276, 112: -276, 113: -276, 114: -276, 117: -276, 127: -276, 134: -276, 136: -276, 137: -276, 138: -276, 155: -276, 156: -276, 163: -276, 174: -276, 176: -276, 177: -276, 180: -276, 181: -276, 182: -276, 194: -276, 195: -276, 200: -276, 201: -276, 204: -276, 205: -276, 206: -276, 207: -276, 208: -276, 209: -276, 210: -276, 211: -276, 212: -276, 213: -276, 214: -276, 215: -276, 216: -276 }, { 7: 345, 8: 241, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 238, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 60: 243, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 84: 239, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 124: 242, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 159: 413, 160: 666, 164: 240, 165: 237, 166: 236, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: -294, 43: -294, 44: -294, 84: -294, 99: -294 }, { 7: 345, 8: 241, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: -301, 44: -301, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 60: 243, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 84: 239, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 99: -301, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 124: 242, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 164: 407, 166: 406, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 345, 8: 241, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 60: 243, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 84: 239, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 124: 242, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 159: 413, 164: 240, 165: 667, 166: 236, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 43: 550, 44: 668 }, { 1: -200, 6: -200, 37: -200, 39: -200, 43: -200, 44: -200, 58: -200, 60: -200, 71: -200, 72: -200, 77: -200, 84: -200, 95: -200, 99: -200, 108: -200, 109: -200, 110: -200, 111: -200, 112: -200, 113: -200, 114: -200, 117: -200, 127: -200, 134: -200, 136: -200, 137: -200, 138: -200, 155: -200, 156: -200, 163: -200, 174: -200, 176: -200, 177: -200, 180: -200, 181: -200, 182: -200, 194: -200, 195: -200, 200: -200, 201: -200, 204: -200, 205: -200, 206: -200, 207: -200, 208: -200, 209: -200, 210: -200, 211: -200, 212: -200, 213: -200, 214: -200, 215: -200, 216: -200 }, { 44: 669, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 6: 671, 39: 670, 43: 672 }, { 6: -143, 7: 345, 8: 241, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 39: -143, 41: 34, 43: -143, 44: -143, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 60: 243, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 99: -143, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 124: 242, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 137: -143, 141: 65, 143: 71, 151: 72, 158: 87, 164: 673, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: -142, 39: -142, 43: -142, 44: -142, 84: 558, 99: -142, 120: 674, 137: -142 }, { 40: 675, 43: 165 }, { 1: -320, 6: -320, 39: -320, 43: -320, 44: -320, 58: 109, 60: -320, 77: -320, 84: -320, 95: -320, 99: -320, 113: -320, 117: -320, 134: -320, 136: -320, 137: -320, 138: -320, 163: -320, 174: -320, 175: 127, 176: -320, 177: -320, 180: -320, 181: -320, 182: -320, 194: -320, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -322, 6: -322, 39: -322, 43: -322, 44: -322, 58: 109, 60: -322, 77: -322, 84: -322, 95: -322, 99: -322, 113: -322, 117: -322, 134: -322, 136: -322, 137: -322, 138: -322, 163: -322, 174: -322, 175: 127, 176: -322, 177: -322, 180: -322, 181: -322, 182: -322, 194: -322, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 6: -101, 43: -101, 44: -101, 58: 109, 84: -101, 134: 676, 137: -101, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 677, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -208, 6: -208, 37: -208, 39: -208, 42: -208, 43: -208, 44: -208, 45: -208, 46: -208, 47: -208, 58: -208, 59: -208, 60: -208, 71: -208, 72: -208, 77: -208, 84: -208, 95: -208, 99: -208, 108: -208, 109: -208, 110: -208, 111: -208, 112: -208, 113: -208, 114: -208, 117: -208, 127: -208, 134: -208, 136: -208, 137: -208, 138: -208, 155: -208, 156: -208, 163: -208, 174: -208, 176: -208, 177: -208, 180: -208, 181: -208, 182: -208, 194: -208, 195: -208, 200: -208, 201: -208, 204: -208, 205: -208, 206: -208, 207: -208, 208: -208, 209: -208, 210: -208, 211: -208, 212: -208, 213: -208, 214: -208, 215: -208, 216: -208 }, { 36: 266, 56: 263, 57: 250, 60: 270, 61: 105, 67: 267, 68: 264, 69: 101, 70: 102, 71: 106, 72: 107, 92: 678, 93: 569, 94: 269, 96: 261, 97: 268, 98: 262 }, { 6: -209, 36: 266, 43: -209, 44: -209, 56: 263, 57: 250, 60: 270, 61: 105, 67: 267, 68: 264, 69: 101, 70: 102, 71: 106, 72: 107, 84: -209, 92: 265, 93: 569, 94: 269, 96: 261, 97: 268, 98: 262, 137: -209, 140: 679 }, { 6: -211, 43: -211, 44: -211, 84: -211, 137: -211 }, { 6: -99, 43: -99, 44: -99, 84: -99, 95: 680, 137: -99 }, { 6: -103, 43: -103, 44: -103, 58: 109, 84: -103, 134: 128, 137: -103, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 681, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: -109, 43: -109, 44: -109, 84: -109, 95: -109, 137: -109 }, { 58: 109, 99: 682, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 37: 247, 106: 683 }, { 37: 247, 106: 684 }, { 57: 250, 67: 685 }, { 57: 250, 67: 686 }, { 6: -127, 37: -127, 43: -127, 44: -127, 57: 250, 67: 687, 84: -127, 108: -127, 109: -127, 110: -127, 111: -127, 112: -127, 114: -127, 137: -127, 156: -127 }, { 6: -128, 37: -128, 43: -128, 44: -128, 57: 250, 67: 688, 84: -128, 108: -128, 109: -128, 110: -128, 111: -128, 112: -128, 114: -128, 137: -128, 156: -128 }, { 7: 689, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 690, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 112: 691 }, { 37: 247, 106: 692 }, { 6: -120, 37: -120, 43: -120, 44: -120, 84: -120, 108: -120, 109: -120, 110: -120, 111: -120, 112: -120, 114: -120, 137: -120, 156: -120 }, { 71: -80, 72: -80, 74: -80, 76: -80 }, { 6: 108, 44: 693 }, { 1: -411, 6: -411, 39: -411, 43: -411, 44: -411, 58: 109, 60: -411, 77: -411, 84: -411, 95: -411, 99: -411, 113: -411, 117: -411, 134: -411, 136: -411, 137: -411, 138: -411, 163: -411, 174: -411, 175: 127, 176: -411, 177: -411, 180: -411, 181: -411, 182: -411, 194: -411, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -344, 6: -344, 39: -344, 43: -344, 44: -344, 58: 109, 60: -344, 77: -344, 84: -344, 95: -344, 99: -344, 113: -344, 117: -344, 134: -344, 136: -344, 137: -344, 138: 694, 163: -344, 174: -344, 175: 127, 176: -344, 177: -344, 180: -344, 181: 695, 182: -344, 194: -344, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -349, 6: -349, 39: -349, 43: -349, 44: -349, 58: 109, 60: -349, 77: -349, 84: -349, 95: -349, 99: -349, 113: -349, 117: -349, 134: -349, 136: -349, 137: -349, 138: 696, 163: -349, 174: -349, 175: 127, 176: -349, 177: -349, 180: -349, 181: -349, 182: -349, 194: -349, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -353, 6: -353, 39: -353, 43: -353, 44: -353, 58: 109, 60: -353, 77: -353, 84: -353, 95: -353, 99: -353, 113: -353, 117: -353, 134: -353, 136: -353, 137: -353, 138: 697, 163: -353, 174: -353, 175: 127, 176: -353, 177: -353, 180: -353, 181: -353, 182: -353, 194: -353, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 698, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 699, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -358, 6: -358, 39: -358, 43: -358, 44: -358, 58: 109, 60: -358, 77: -358, 84: -358, 95: -358, 99: -358, 113: -358, 117: -358, 134: -358, 136: -358, 137: -358, 138: -358, 163: -358, 174: -358, 175: 127, 176: -358, 177: -358, 180: -358, 181: -358, 182: -358, 194: -358, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 44: -280, 58: 109, 113: -280, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 113: 700 }, { 113: 701 }, { 58: 109, 113: -86, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -171, 6: -171, 37: -171, 39: -171, 42: -171, 43: -171, 44: -171, 45: -171, 46: -171, 47: -171, 58: -171, 59: -171, 60: -171, 71: -171, 72: -171, 77: -171, 84: -171, 95: -171, 99: -171, 108: -171, 109: -171, 110: -171, 111: -171, 112: -171, 113: -171, 114: -171, 117: -171, 127: -171, 134: -171, 136: -171, 137: -171, 138: -171, 142: -171, 155: -171, 156: -171, 163: -171, 174: -171, 176: -171, 177: -171, 180: -171, 181: -171, 182: -171, 194: -171, 195: -171, 200: -171, 201: -171, 202: -171, 203: -171, 204: -171, 205: -171, 206: -171, 207: -171, 208: -171, 209: -171, 210: -171, 211: -171, 212: -171, 213: -171, 214: -171, 215: -171, 216: -171, 217: -171 }, { 44: 702, 58: 109, 60: 315, 134: 128, 162: 456, 163: 314, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 44: 703 }, { 1: -173, 6: -173, 37: -173, 39: -173, 42: -173, 43: -173, 44: -173, 45: -173, 46: -173, 47: -173, 58: -173, 59: -173, 60: -173, 71: -173, 72: -173, 77: -173, 84: -173, 95: -173, 99: -173, 108: -173, 109: -173, 110: -173, 111: -173, 112: -173, 113: -173, 114: -173, 117: -173, 127: -173, 134: -173, 136: -173, 137: -173, 138: -173, 142: -173, 155: -173, 156: -173, 163: -173, 174: -173, 176: -173, 177: -173, 180: -173, 181: -173, 182: -173, 194: -173, 195: -173, 200: -173, 201: -173, 202: -173, 203: -173, 204: -173, 205: -173, 206: -173, 207: -173, 208: -173, 209: -173, 210: -173, 211: -173, 212: -173, 213: -173, 214: -173, 215: -173, 216: -173, 217: -173 }, { 1: -175, 6: -175, 37: -175, 39: -175, 42: -175, 43: -175, 44: -175, 45: -175, 46: -175, 47: -175, 58: -175, 59: -175, 60: -175, 71: -175, 72: -175, 77: -175, 84: -175, 95: -175, 99: -175, 108: -175, 109: -175, 110: -175, 111: -175, 112: -175, 113: -175, 114: -175, 117: -175, 127: -175, 134: -175, 136: -175, 137: -175, 138: -175, 142: -175, 155: -175, 156: -175, 163: -175, 174: -175, 176: -175, 177: -175, 180: -175, 181: -175, 182: -175, 194: -175, 195: -175, 200: -175, 201: -175, 202: -175, 203: -175, 204: -175, 205: -175, 206: -175, 207: -175, 208: -175, 209: -175, 210: -175, 211: -175, 212: -175, 213: -175, 214: -175, 215: -175, 216: -175, 217: -175 }, { 44: 704, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 113: 705 }, { 1: -185, 6: -185, 37: -185, 39: -185, 42: -185, 43: -185, 44: -185, 45: -185, 46: -185, 47: -185, 58: -185, 59: -185, 60: -185, 71: -185, 72: -185, 77: -185, 84: -185, 95: -185, 99: -185, 108: -185, 109: -185, 110: -185, 111: -185, 112: -185, 113: -185, 114: -185, 117: -185, 127: -185, 134: -185, 136: -185, 137: -185, 138: -185, 142: -185, 155: -185, 156: -185, 163: -185, 174: -185, 176: -185, 177: -185, 180: -185, 181: -185, 182: -185, 194: -185, 195: -185, 200: -185, 201: -185, 202: -185, 203: -185, 204: -185, 205: -185, 206: -185, 207: -185, 208: -185, 209: -185, 210: -185, 211: -185, 212: -185, 213: -185, 214: -185, 215: -185, 216: -185, 217: -185 }, { 44: 706, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -98, 6: -98, 39: -98, 43: -98, 44: -98, 58: -98, 60: -98, 77: -98, 84: -98, 95: -98, 99: -98, 113: -98, 117: -98, 134: -98, 136: -98, 137: -98, 138: -98, 163: -98, 174: -98, 176: -98, 177: -98, 180: -98, 181: -98, 182: -98, 194: -98, 195: -98, 200: -98, 201: -98, 204: -98, 205: -98, 206: -98, 207: -98, 208: -98, 209: -98, 210: -98, 211: -98, 212: -98, 213: -98, 214: -98, 215: -98, 216: -98 }, { 1: -38, 6: -38, 39: -38, 43: -38, 44: -38, 58: -38, 60: -38, 77: -38, 84: -38, 95: -38, 99: -38, 113: -38, 117: -38, 134: -38, 136: -38, 137: -38, 138: -38, 163: -38, 174: -38, 176: -38, 177: -38, 180: -38, 181: -38, 182: -38, 194: -38, 195: -38, 200: -38, 201: -38, 204: -38, 205: -38, 206: -38, 207: -38, 208: -38, 209: -38, 210: -38, 211: -38, 212: -38, 213: -38, 214: -38, 215: -38, 216: -38 }, { 1: -41, 6: -41, 39: -41, 43: -41, 44: -41, 58: -41, 60: -41, 77: -41, 84: -41, 95: -41, 99: -41, 113: -41, 117: -41, 134: -41, 136: -41, 137: -41, 138: -41, 163: -41, 174: -41, 176: -41, 177: -41, 180: -41, 181: -41, 182: -41, 194: -41, 195: -41, 200: -41, 201: -41, 204: -41, 205: -41, 206: -41, 207: -41, 208: -41, 209: -41, 210: -41, 211: -41, 212: -41, 213: -41, 214: -41, 215: -41, 216: -41 }, { 1: -44, 6: -44, 39: -44, 43: -44, 44: -44, 58: -44, 60: -44, 77: -44, 84: -44, 95: -44, 99: -44, 113: -44, 117: -44, 134: -44, 136: -44, 137: -44, 138: -44, 163: -44, 174: -44, 176: -44, 177: -44, 180: -44, 181: -44, 182: -44, 194: -44, 195: -44, 200: -44, 201: -44, 204: -44, 205: -44, 206: -44, 207: -44, 208: -44, 209: -44, 210: -44, 211: -44, 212: -44, 213: -44, 214: -44, 215: -44, 216: -44 }, { 1: -47, 6: -47, 39: -47, 43: -47, 44: -47, 58: -47, 60: -47, 77: -47, 84: -47, 95: -47, 99: -47, 113: -47, 117: -47, 134: -47, 136: -47, 137: -47, 138: -47, 163: -47, 174: -47, 176: -47, 177: -47, 180: -47, 181: -47, 182: -47, 194: -47, 195: -47, 200: -47, 201: -47, 204: -47, 205: -47, 206: -47, 207: -47, 208: -47, 209: -47, 210: -47, 211: -47, 212: -47, 213: -47, 214: -47, 215: -47, 216: -47 }, { 1: -136, 6: -136, 37: -136, 39: -136, 43: -136, 44: -136, 58: -136, 60: -136, 71: -136, 72: -136, 77: -136, 84: -136, 95: -136, 99: -136, 108: -136, 109: -136, 110: -136, 111: -136, 112: -136, 113: -136, 114: -136, 117: -136, 127: -136, 134: -136, 136: -136, 137: -136, 138: -136, 155: -136, 156: -136, 163: -136, 174: -136, 176: -136, 177: -136, 180: -136, 181: -136, 182: -136, 194: -136, 195: -136, 200: -136, 201: -136, 204: -136, 205: -136, 206: -136, 207: -136, 208: -136, 209: -136, 210: -136, 211: -136, 212: -136, 213: -136, 214: -136, 215: -136, 216: -136 }, { 1: -138, 6: -138, 39: -138, 43: -138, 44: -138, 77: -138, 84: -138, 99: -138, 174: -138 }, { 6: -147, 39: -147, 43: -147, 44: -147, 84: -147, 117: -147 }, { 6: -142, 39: -142, 43: -142, 44: -142, 84: 341, 99: -142, 120: 707, 137: -142 }, { 40: 611, 43: 165 }, { 1: -413, 6: -413, 39: -413, 43: -413, 44: -413, 58: -413, 60: -413, 77: -413, 84: -413, 95: -413, 99: -413, 113: -413, 117: -413, 134: -413, 136: -413, 137: -413, 138: -413, 163: -413, 174: -413, 176: -413, 177: -413, 180: -413, 181: -413, 182: -413, 194: -413, 195: -413, 200: -413, 201: -413, 204: -413, 205: -413, 206: -413, 207: -413, 208: -413, 209: -413, 210: -413, 211: -413, 212: -413, 213: -413, 214: -413, 215: -413, 216: -413 }, { 1: -52, 6: -52, 39: -52, 43: -52, 44: -52, 58: -52, 60: -52, 77: -52, 84: -52, 95: -52, 99: -52, 113: -52, 117: -52, 134: -52, 136: -52, 137: -52, 138: -52, 163: -52, 174: -52, 176: -52, 177: -52, 180: -52, 181: -52, 182: -52, 194: -52, 195: -52, 200: -52, 201: -52, 204: -52, 205: -52, 206: -52, 207: -52, 208: -52, 209: -52, 210: -52, 211: -52, 212: -52, 213: -52, 214: -52, 215: -52, 216: -52 }, { 6: -55, 7: 494, 8: 495, 9: 496, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 44: -55, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 54: 708, 55: 497, 56: 498, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -73, 6: -60, 37: -73, 39: -73, 42: -73, 43: -73, 44: -60, 45: -73, 46: -73, 47: -73, 58: 709, 59: 710, 60: -73, 71: -73, 72: -73, 77: -73, 84: -73, 95: -73, 99: -73, 108: -73, 109: -73, 110: -73, 111: -73, 112: -73, 113: -73, 114: -73, 117: -73, 127: -73, 134: -73, 136: -73, 137: -73, 138: -73, 142: -73, 155: -73, 156: -73, 163: -73, 174: -73, 176: -73, 177: -73, 180: -73, 181: -73, 182: -73, 194: -73, 195: -73, 200: -73, 201: -73, 202: -73, 203: -73, 204: -73, 205: -73, 206: -73, 207: -73, 208: -73, 209: -73, 210: -73, 211: -73, 212: -73, 213: -73, 214: -73, 215: -73, 216: -73, 217: -73 }, { 61: 711 }, { 1: -372, 6: -372, 39: -372, 43: -372, 44: -372, 58: -372, 60: -372, 77: -372, 84: -372, 95: -372, 99: -372, 113: -372, 117: -372, 134: -372, 136: -372, 137: -372, 138: -372, 163: -372, 174: -372, 176: -372, 177: -372, 180: -372, 181: -372, 182: -372, 187: -372, 194: -372, 195: -372, 200: -372, 201: -372, 204: -372, 205: -372, 206: -372, 207: -372, 208: -372, 209: -372, 210: -372, 211: -372, 212: -372, 213: -372, 214: -372, 215: -372, 216: -372 }, { 1: -311, 6: -311, 39: -311, 43: -311, 44: -311, 58: -311, 60: -311, 77: -311, 84: -311, 95: -311, 99: -311, 113: -311, 117: -311, 134: -311, 136: -311, 137: -311, 138: -311, 163: -311, 174: -311, 176: -311, 177: -311, 180: -311, 181: -311, 182: -311, 194: -311, 195: -311, 200: -311, 201: -311, 204: -311, 205: -311, 206: -311, 207: -311, 208: -311, 209: -311, 210: -311, 211: -311, 212: -311, 213: -311, 214: -311, 215: -311, 216: -311 }, { 1: -312, 6: -312, 39: -312, 43: -312, 44: -312, 58: -312, 60: -312, 77: -312, 84: -312, 95: -312, 99: -312, 113: -312, 117: -312, 134: -312, 136: -312, 137: -312, 138: -312, 163: -312, 170: -312, 174: -312, 176: -312, 177: -312, 180: -312, 181: -312, 182: -312, 194: -312, 195: -312, 200: -312, 201: -312, 204: -312, 205: -312, 206: -312, 207: -312, 208: -312, 209: -312, 210: -312, 211: -312, 212: -312, 213: -312, 214: -312, 215: -312, 216: -312 }, { 1: -313, 6: -313, 39: -313, 43: -313, 44: -313, 58: -313, 60: -313, 77: -313, 84: -313, 95: -313, 99: -313, 113: -313, 117: -313, 134: -313, 136: -313, 137: -313, 138: -313, 163: -313, 170: -313, 174: -313, 176: -313, 177: -313, 180: -313, 181: -313, 182: -313, 194: -313, 195: -313, 200: -313, 201: -313, 204: -313, 205: -313, 206: -313, 207: -313, 208: -313, 209: -313, 210: -313, 211: -313, 212: -313, 213: -313, 214: -313, 215: -313, 216: -313 }, { 1: -329, 6: -329, 39: -329, 43: -329, 44: -329, 58: -329, 60: -329, 77: -329, 84: -329, 95: -329, 99: -329, 113: -329, 117: -329, 134: -329, 136: -329, 137: -329, 138: -329, 163: -329, 174: -329, 176: -329, 177: -329, 180: -329, 181: -329, 182: -329, 194: -329, 195: -329, 200: -329, 201: -329, 204: -329, 205: -329, 206: -329, 207: -329, 208: -329, 209: -329, 210: -329, 211: -329, 212: -329, 213: -329, 214: -329, 215: -329, 216: -329 }, { 7: 712, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 713, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -334, 6: -334, 39: -334, 43: -334, 44: -334, 58: -334, 60: -334, 77: -334, 84: -334, 95: -334, 99: -334, 113: -334, 117: -334, 134: -334, 136: -334, 137: -334, 138: -334, 163: -334, 174: -334, 176: -334, 177: -334, 180: -334, 181: -334, 182: -334, 194: -334, 195: -334, 200: -334, 201: -334, 204: -334, 205: -334, 206: -334, 207: -334, 208: -334, 209: -334, 210: -334, 211: -334, 212: -334, 213: -334, 214: -334, 215: -334, 216: -334 }, { 7: 714, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -338, 6: -338, 39: -338, 43: -338, 44: -338, 58: -338, 60: -338, 77: -338, 84: -338, 95: -338, 99: -338, 113: -338, 117: -338, 134: -338, 136: -338, 137: -338, 138: -338, 163: -338, 174: -338, 176: -338, 177: -338, 180: -338, 181: -338, 182: -338, 194: -338, 195: -338, 200: -338, 201: -338, 204: -338, 205: -338, 206: -338, 207: -338, 208: -338, 209: -338, 210: -338, 211: -338, 212: -338, 213: -338, 214: -338, 215: -338, 216: -338 }, { 7: 715, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 40: 716, 43: 165, 58: 109, 134: 128, 138: 717, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 40: 718, 43: 165, 58: 109, 134: 128, 138: 719, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -343, 6: -343, 39: -343, 43: -343, 44: -343, 58: -343, 60: -343, 77: -343, 84: -343, 95: -343, 99: -343, 113: -343, 117: -343, 134: -343, 136: -343, 137: -343, 138: -343, 163: -343, 174: -343, 176: -343, 177: -343, 180: -343, 181: -343, 182: -343, 194: -343, 195: -343, 200: -343, 201: -343, 204: -343, 205: -343, 206: -343, 207: -343, 208: -343, 209: -343, 210: -343, 211: -343, 212: -343, 213: -343, 214: -343, 215: -343, 216: -343 }, { 1: -363, 6: -363, 39: -363, 43: -363, 44: -363, 58: -363, 60: -363, 77: -363, 84: -363, 95: -363, 99: -363, 113: -363, 117: -363, 134: -363, 136: -363, 137: -363, 138: -363, 163: -363, 174: -363, 176: -363, 177: -363, 180: -363, 181: -363, 182: -363, 194: -363, 195: -363, 200: -363, 201: -363, 204: -363, 205: -363, 206: -363, 207: -363, 208: -363, 209: -363, 210: -363, 211: -363, 212: -363, 213: -363, 214: -363, 215: -363, 216: -363 }, { 40: 720, 43: 165 }, { 44: 721 }, { 6: 722, 44: -369, 187: -369, 189: -369 }, { 7: 723, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -221, 6: -221, 39: -221, 43: -221, 44: -221, 58: -221, 60: -221, 77: -221, 84: -221, 95: -221, 99: -221, 113: -221, 117: -221, 134: -221, 136: -221, 137: -221, 138: -221, 163: -221, 174: -221, 176: -221, 177: -221, 180: -221, 181: -221, 182: -221, 194: -221, 195: -221, 200: -221, 201: -221, 204: -221, 205: -221, 206: -221, 207: -221, 208: -221, 209: -221, 210: -221, 211: -221, 212: -221, 213: -221, 214: -221, 215: -221, 216: -221 }, { 40: 724, 43: 165 }, { 70: 725, 71: 106, 72: 107 }, { 6: -142, 39: -142, 43: -142, 44: -142, 84: 531, 99: -142, 120: 726, 137: -142 }, { 1: -225, 6: -225, 39: -225, 43: -225, 44: -225, 77: -225, 84: -225, 99: -225, 174: -225, 176: -225, 177: -225, 194: -225, 195: -225 }, { 66: 727 }, { 36: 389, 61: 105, 147: 728, 149: 390 }, { 36: 389, 43: 388, 61: 105, 146: 729, 147: 387, 149: 390 }, { 6: -230, 43: -230, 44: -230, 84: -230, 137: -230 }, { 6: 646, 43: 647, 44: 730 }, { 6: -235, 43: -235, 44: -235, 84: -235, 137: -235 }, { 6: -237, 43: -237, 44: -237, 84: -237, 137: -237 }, { 1: -250, 6: -250, 39: -250, 43: -250, 44: -250, 77: -250, 84: -250, 99: -250, 174: -250, 176: -250, 177: -250, 194: -250, 195: -250 }, { 1: -241, 6: -241, 39: -241, 43: -241, 44: -241, 66: 731, 77: -241, 84: -241, 99: -241, 174: -241, 176: -241, 177: -241, 194: -241, 195: -241 }, { 36: 396, 61: 105, 149: 397, 154: 732 }, { 36: 396, 43: 395, 61: 105, 149: 397, 152: 733, 154: 394 }, { 6: -253, 43: -253, 44: -253, 84: -253, 137: -253 }, { 6: 654, 43: 655, 44: 734 }, { 6: -258, 43: -258, 44: -258, 84: -258, 137: -258 }, { 6: -259, 43: -259, 44: -259, 84: -259, 137: -259 }, { 6: -261, 43: -261, 44: -261, 84: -261, 137: -261 }, { 1: -245, 6: -245, 39: -245, 43: -245, 44: -245, 58: 109, 77: -245, 84: -245, 99: -245, 134: 128, 174: -245, 175: 127, 176: -245, 177: -245, 194: -245, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 44: 735, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -248, 6: -248, 39: -248, 43: -248, 44: -248, 77: -248, 84: -248, 99: -248, 174: -248, 176: -248, 177: -248, 194: -248, 195: -248 }, { 1: -318, 6: -318, 37: -318, 39: -318, 43: -318, 44: -318, 58: -318, 60: -318, 71: -318, 72: -318, 77: -318, 84: -318, 95: -318, 99: -318, 108: -318, 109: -318, 110: -318, 111: -318, 112: -318, 113: -318, 114: -318, 117: -318, 127: -318, 134: -318, 136: -318, 137: -318, 138: -318, 155: -318, 156: -318, 163: -318, 174: -318, 176: -318, 177: -318, 180: -318, 181: -318, 182: -318, 194: -318, 195: -318, 200: -318, 201: -318, 204: -318, 205: -318, 206: -318, 207: -318, 208: -318, 209: -318, 210: -318, 211: -318, 212: -318, 213: -318, 214: -318, 215: -318, 216: -318 }, { 1: -279, 6: -279, 37: -279, 39: -279, 43: -279, 44: -279, 58: -279, 60: -279, 71: -279, 72: -279, 77: -279, 84: -279, 95: -279, 99: -279, 108: -279, 109: -279, 110: -279, 111: -279, 112: -279, 113: -279, 114: -279, 117: -279, 127: -279, 134: -279, 136: -279, 137: -279, 138: -279, 155: -279, 156: -279, 163: -279, 174: -279, 176: -279, 177: -279, 180: -279, 181: -279, 182: -279, 194: -279, 195: -279, 200: -279, 201: -279, 204: -279, 205: -279, 206: -279, 207: -279, 208: -279, 209: -279, 210: -279, 211: -279, 212: -279, 213: -279, 214: -279, 215: -279, 216: -279 }, { 6: -142, 39: -142, 43: -142, 44: -142, 84: 409, 99: -142, 120: 410, 137: -142, 161: 736 }, { 6: -295, 43: -295, 44: -295, 84: -295, 99: -295 }, { 6: -296, 43: -296, 44: -296, 84: -296, 99: -296 }, { 113: 737 }, { 1: -270, 6: -270, 37: -270, 39: -270, 43: -270, 44: -270, 58: -270, 60: -270, 71: -270, 72: -270, 77: -270, 82: -270, 84: -270, 95: -270, 99: -270, 108: -270, 109: -270, 110: -270, 111: -270, 112: -270, 113: -270, 114: -270, 117: -270, 127: -270, 134: -270, 136: -270, 137: -270, 138: -270, 155: -270, 156: -270, 163: -270, 174: -270, 176: -270, 177: -270, 180: -270, 181: -270, 182: -270, 194: -270, 195: -270, 200: -270, 201: -270, 204: -270, 205: -270, 206: -270, 207: -270, 208: -270, 209: -270, 210: -270, 211: -270, 212: -270, 213: -270, 214: -270, 215: -270, 216: -270 }, { 7: 345, 8: 241, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 60: 243, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 124: 242, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 164: 738, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 345, 8: 241, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 421, 48: 54, 49: 44, 50: 55, 51: 56, 52: 57, 56: 88, 60: 243, 61: 105, 62: 28, 63: 29, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 43, 118: 91, 119: 92, 123: 73, 124: 242, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 157: 739, 158: 87, 164: 420, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 45, 197: 46, 198: 69, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: -285, 39: -285, 43: -285, 44: -285, 84: -285 }, { 6: 671, 43: 672, 44: 740 }, { 1: -374, 6: -374, 39: -374, 43: -374, 44: -374, 58: -374, 60: -374, 77: -374, 84: -374, 95: -374, 99: -374, 113: -374, 117: -374, 134: -374, 136: -374, 137: -374, 138: -374, 163: -374, 174: -374, 176: -374, 177: -374, 180: -374, 181: -374, 182: -374, 194: -374, 195: -374, 200: -374, 201: -374, 204: -374, 205: -374, 206: -374, 207: -374, 208: -374, 209: -374, 210: -374, 211: -374, 212: -374, 213: -374, 214: -374, 215: -374, 216: -374 }, { 36: 157, 56: 161, 61: 105, 65: 160, 97: 158, 98: 84, 122: 202, 123: 159, 128: 298, 133: 100, 135: 741, 139: 742, 183: 297, 184: 201 }, { 44: 743, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 6: -212, 43: -212, 44: -212, 84: -212, 137: -212 }, { 6: -142, 39: -142, 43: -142, 44: -142, 84: 430, 99: -142, 120: 744, 137: -142 }, { 7: 745, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 564, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 44: 746, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 6: -110, 43: -110, 44: -110, 84: -110, 95: -110, 137: -110 }, { 6: -121, 37: -121, 43: -121, 44: -121, 84: -121, 108: -121, 109: -121, 110: -121, 111: -121, 112: -121, 114: -121, 137: -121, 156: -121 }, { 6: -122, 37: -122, 43: -122, 44: -122, 84: -122, 108: -122, 109: -122, 110: -122, 111: -122, 112: -122, 114: -122, 137: -122, 156: -122 }, { 6: -123, 37: -123, 43: -123, 44: -123, 84: -123, 108: -123, 109: -123, 110: -123, 111: -123, 112: -123, 114: -123, 137: -123, 156: -123 }, { 6: -124, 37: -124, 43: -124, 44: -124, 84: -124, 108: -124, 109: -124, 110: -124, 111: -124, 112: -124, 114: -124, 137: -124, 156: -124 }, { 6: -125, 37: -125, 43: -125, 44: -125, 84: -125, 108: -125, 109: -125, 110: -125, 111: -125, 112: -125, 114: -125, 137: -125, 156: -125 }, { 6: -126, 37: -126, 43: -126, 44: -126, 84: -126, 108: -126, 109: -126, 110: -126, 111: -126, 112: -126, 114: -126, 137: -126, 156: -126 }, { 58: 109, 113: 747, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 748, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 749, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 43: 750, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: -119, 37: -119, 43: -119, 44: -119, 84: -119, 108: -119, 109: -119, 110: -119, 111: -119, 112: -119, 114: -119, 137: -119, 156: -119 }, { 77: 751 }, { 7: 752, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 753, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 754, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 755, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -351, 6: -351, 39: -351, 43: -351, 44: -351, 58: 109, 60: -351, 77: -351, 84: -351, 95: -351, 99: -351, 113: -351, 117: -351, 134: -351, 136: -351, 137: -351, 138: 756, 163: -351, 174: -351, 175: 127, 176: -351, 177: -351, 180: -351, 181: -351, 182: -351, 194: -351, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -355, 6: -355, 39: -355, 43: -355, 44: -355, 58: 109, 60: -355, 77: -355, 84: -355, 95: -355, 99: -355, 113: -355, 117: -355, 134: -355, 136: -355, 137: -355, 138: 757, 163: -355, 174: -355, 175: 127, 176: -355, 177: -355, 180: -355, 181: -355, 182: -355, 194: -355, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -167, 6: -167, 37: -167, 39: -167, 42: -167, 43: -167, 44: -167, 45: -167, 46: -167, 47: -167, 58: -167, 59: -167, 60: -167, 71: -167, 72: -167, 77: -167, 84: -167, 95: -167, 99: -167, 108: -167, 109: -167, 110: -167, 111: -167, 112: -167, 113: -167, 114: -167, 117: -167, 127: -167, 134: -167, 136: -167, 137: -167, 138: -167, 142: -167, 155: -167, 156: -167, 163: -167, 174: -167, 176: -167, 177: -167, 180: -167, 181: -167, 182: -167, 194: -167, 195: -167, 200: -167, 201: -167, 202: -167, 203: -167, 204: -167, 205: -167, 206: -167, 207: -167, 208: -167, 209: -167, 210: -167, 211: -167, 212: -167, 213: -167, 214: -167, 215: -167, 216: -167, 217: -167 }, { 1: -169, 6: -169, 37: -169, 39: -169, 42: -169, 43: -169, 44: -169, 45: -169, 46: -169, 47: -169, 58: -169, 59: -169, 60: -169, 71: -169, 72: -169, 77: -169, 84: -169, 95: -169, 99: -169, 108: -169, 109: -169, 110: -169, 111: -169, 112: -169, 113: -169, 114: -169, 117: -169, 127: -169, 134: -169, 136: -169, 137: -169, 138: -169, 142: -169, 155: -169, 156: -169, 163: -169, 174: -169, 176: -169, 177: -169, 180: -169, 181: -169, 182: -169, 194: -169, 195: -169, 200: -169, 201: -169, 202: -169, 203: -169, 204: -169, 205: -169, 206: -169, 207: -169, 208: -169, 209: -169, 210: -169, 211: -169, 212: -169, 213: -169, 214: -169, 215: -169, 216: -169, 217: -169 }, { 113: 758 }, { 113: 759 }, { 113: 760 }, { 1: -184, 6: -184, 37: -184, 39: -184, 42: -184, 43: -184, 44: -184, 45: -184, 46: -184, 47: -184, 58: -184, 59: -184, 60: -184, 71: -184, 72: -184, 77: -184, 84: -184, 95: -184, 99: -184, 108: -184, 109: -184, 110: -184, 111: -184, 112: -184, 113: -184, 114: -184, 117: -184, 127: -184, 134: -184, 136: -184, 137: -184, 138: -184, 142: -184, 155: -184, 156: -184, 163: -184, 174: -184, 176: -184, 177: -184, 180: -184, 181: -184, 182: -184, 194: -184, 195: -184, 200: -184, 201: -184, 202: -184, 203: -184, 204: -184, 205: -184, 206: -184, 207: -184, 208: -184, 209: -184, 210: -184, 211: -184, 212: -184, 213: -184, 214: -184, 215: -184, 216: -184, 217: -184 }, { 113: 761 }, { 6: 484, 43: 485, 44: 762 }, { 6: -54, 44: -54 }, { 6: -61, 44: -61 }, { 7: 763, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: -63, 44: -63 }, { 40: 764, 43: 165, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 181: 765, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 40: 766, 43: 165, 58: 109, 134: 128, 138: 767, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 40: 768, 43: 165, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 40: 769, 43: 165, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -336, 6: -336, 39: -336, 43: -336, 44: -336, 58: -336, 60: -336, 77: -336, 84: -336, 95: -336, 99: -336, 113: -336, 117: -336, 134: -336, 136: -336, 137: -336, 138: -336, 163: -336, 174: -336, 176: -336, 177: -336, 180: -336, 181: -336, 182: -336, 194: -336, 195: -336, 200: -336, 201: -336, 204: -336, 205: -336, 206: -336, 207: -336, 208: -336, 209: -336, 210: -336, 211: -336, 212: -336, 213: -336, 214: -336, 215: -336, 216: -336 }, { 7: 770, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -340, 6: -340, 39: -340, 43: -340, 44: -340, 58: -340, 60: -340, 77: -340, 84: -340, 95: -340, 99: -340, 113: -340, 117: -340, 134: -340, 136: -340, 137: -340, 138: -340, 163: -340, 174: -340, 176: -340, 177: -340, 180: -340, 181: -340, 182: -340, 194: -340, 195: -340, 200: -340, 201: -340, 204: -340, 205: -340, 206: -340, 207: -340, 208: -340, 209: -340, 210: -340, 211: -340, 212: -340, 213: -340, 214: -340, 215: -340, 216: -340 }, { 7: 771, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 44: 772 }, { 1: -366, 6: -366, 39: -366, 43: -366, 44: -366, 58: -366, 60: -366, 77: -366, 84: -366, 95: -366, 99: -366, 113: -366, 117: -366, 134: -366, 136: -366, 137: -366, 138: -366, 163: -366, 174: -366, 176: -366, 177: -366, 180: -366, 181: -366, 182: -366, 194: -366, 195: -366, 200: -366, 201: -366, 204: -366, 205: -366, 206: -366, 207: -366, 208: -366, 209: -366, 210: -366, 211: -366, 212: -366, 213: -366, 214: -366, 215: -366, 216: -366 }, { 44: -370, 187: -370, 189: -370 }, { 43: -307, 58: 109, 84: -307, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -34, 6: -34, 39: -34, 43: -34, 44: -34, 58: -34, 60: -34, 77: -34, 84: -34, 95: -34, 99: -34, 113: -34, 117: -34, 134: -34, 136: -34, 137: -34, 138: -34, 163: -34, 174: -34, 176: -34, 177: -34, 180: -34, 181: -34, 182: -34, 194: -34, 195: -34, 200: -34, 201: -34, 204: -34, 205: -34, 206: -34, 207: -34, 208: -34, 209: -34, 210: -34, 211: -34, 212: -34, 213: -34, 214: -34, 215: -34, 216: -34 }, { 1: -227, 6: -227, 39: -227, 43: -227, 44: -227, 77: -227, 84: -227, 99: -227, 174: -227, 176: -227, 177: -227, 194: -227, 195: -227 }, { 6: 646, 43: 647, 137: 773 }, { 70: 774, 71: 106, 72: 107 }, { 6: -231, 43: -231, 44: -231, 84: -231, 137: -231 }, { 6: -142, 39: -142, 43: -142, 44: -142, 84: 531, 99: -142, 120: 775, 137: -142 }, { 6: -232, 43: -232, 44: -232, 84: -232, 137: -232 }, { 70: 776, 71: 106, 72: 107 }, { 6: -254, 43: -254, 44: -254, 84: -254, 137: -254 }, { 6: -142, 39: -142, 43: -142, 44: -142, 84: 538, 99: -142, 120: 777, 137: -142 }, { 6: -255, 43: -255, 44: -255, 84: -255, 137: -255 }, { 1: -246, 6: -246, 39: -246, 43: -246, 44: -246, 77: -246, 84: -246, 99: -246, 174: -246, 176: -246, 177: -246, 194: -246, 195: -246 }, { 43: 550, 44: 778 }, { 1: -201, 6: -201, 37: -201, 39: -201, 43: -201, 44: -201, 58: -201, 60: -201, 71: -201, 72: -201, 77: -201, 84: -201, 95: -201, 99: -201, 108: -201, 109: -201, 110: -201, 111: -201, 112: -201, 113: -201, 114: -201, 117: -201, 127: -201, 134: -201, 136: -201, 137: -201, 138: -201, 155: -201, 156: -201, 163: -201, 174: -201, 176: -201, 177: -201, 180: -201, 181: -201, 182: -201, 194: -201, 195: -201, 200: -201, 201: -201, 204: -201, 205: -201, 206: -201, 207: -201, 208: -201, 209: -201, 210: -201, 211: -201, 212: -201, 213: -201, 214: -201, 215: -201, 216: -201 }, { 6: -286, 39: -286, 43: -286, 44: -286, 84: -286 }, { 6: -142, 39: -142, 43: -142, 44: -142, 84: 558, 99: -142, 120: 779, 137: -142 }, { 6: -287, 39: -287, 43: -287, 44: -287, 84: -287 }, { 136: 780, 180: 449, 182: 451 }, { 36: 157, 56: 161, 61: 105, 65: 160, 97: 158, 98: 162, 122: 202, 123: 159, 133: 100, 135: 781, 184: 201 }, { 6: -102, 43: -102, 44: -102, 84: -102, 137: -102 }, { 6: 566, 43: 567, 44: 782 }, { 6: -101, 43: -101, 44: -101, 58: 109, 84: -101, 134: 128, 137: -101, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 6: -104, 43: -104, 44: -104, 84: -104, 137: -104 }, { 6: -129, 37: -129, 43: -129, 44: -129, 84: -129, 108: -129, 109: -129, 110: -129, 111: -129, 112: -129, 114: -129, 137: -129, 156: -129 }, { 44: 783, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 58: 109, 113: 784, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 785, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 71: -81, 72: -81, 74: -81, 76: -81 }, { 1: -345, 6: -345, 39: -345, 43: -345, 44: -345, 58: 109, 60: -345, 77: -345, 84: -345, 95: -345, 99: -345, 113: -345, 117: -345, 134: -345, 136: -345, 137: -345, 138: -345, 163: -345, 174: -345, 175: 127, 176: -345, 177: -345, 180: -345, 181: 786, 182: -345, 194: -345, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -346, 6: -346, 39: -346, 43: -346, 44: -346, 58: 109, 60: -346, 77: -346, 84: -346, 95: -346, 99: -346, 113: -346, 117: -346, 134: -346, 136: -346, 137: -346, 138: 787, 163: -346, 174: -346, 175: 127, 176: -346, 177: -346, 180: -346, 181: -346, 182: -346, 194: -346, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -350, 6: -350, 39: -350, 43: -350, 44: -350, 58: 109, 60: -350, 77: -350, 84: -350, 95: -350, 99: -350, 113: -350, 117: -350, 134: -350, 136: -350, 137: -350, 138: -350, 163: -350, 174: -350, 175: 127, 176: -350, 177: -350, 180: -350, 181: -350, 182: -350, 194: -350, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -354, 6: -354, 39: -354, 43: -354, 44: -354, 58: 109, 60: -354, 77: -354, 84: -354, 95: -354, 99: -354, 113: -354, 117: -354, 134: -354, 136: -354, 137: -354, 138: -354, 163: -354, 174: -354, 175: 127, 176: -354, 177: -354, 180: -354, 181: -354, 182: -354, 194: -354, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 788, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 789, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -172, 6: -172, 37: -172, 39: -172, 42: -172, 43: -172, 44: -172, 45: -172, 46: -172, 47: -172, 58: -172, 59: -172, 60: -172, 71: -172, 72: -172, 77: -172, 84: -172, 95: -172, 99: -172, 108: -172, 109: -172, 110: -172, 111: -172, 112: -172, 113: -172, 114: -172, 117: -172, 127: -172, 134: -172, 136: -172, 137: -172, 138: -172, 142: -172, 155: -172, 156: -172, 163: -172, 174: -172, 176: -172, 177: -172, 180: -172, 181: -172, 182: -172, 194: -172, 195: -172, 200: -172, 201: -172, 202: -172, 203: -172, 204: -172, 205: -172, 206: -172, 207: -172, 208: -172, 209: -172, 210: -172, 211: -172, 212: -172, 213: -172, 214: -172, 215: -172, 216: -172, 217: -172 }, { 1: -174, 6: -174, 37: -174, 39: -174, 42: -174, 43: -174, 44: -174, 45: -174, 46: -174, 47: -174, 58: -174, 59: -174, 60: -174, 71: -174, 72: -174, 77: -174, 84: -174, 95: -174, 99: -174, 108: -174, 109: -174, 110: -174, 111: -174, 112: -174, 113: -174, 114: -174, 117: -174, 127: -174, 134: -174, 136: -174, 137: -174, 138: -174, 142: -174, 155: -174, 156: -174, 163: -174, 174: -174, 176: -174, 177: -174, 180: -174, 181: -174, 182: -174, 194: -174, 195: -174, 200: -174, 201: -174, 202: -174, 203: -174, 204: -174, 205: -174, 206: -174, 207: -174, 208: -174, 209: -174, 210: -174, 211: -174, 212: -174, 213: -174, 214: -174, 215: -174, 216: -174, 217: -174 }, { 1: -176, 6: -176, 37: -176, 39: -176, 42: -176, 43: -176, 44: -176, 45: -176, 46: -176, 47: -176, 58: -176, 59: -176, 60: -176, 71: -176, 72: -176, 77: -176, 84: -176, 95: -176, 99: -176, 108: -176, 109: -176, 110: -176, 111: -176, 112: -176, 113: -176, 114: -176, 117: -176, 127: -176, 134: -176, 136: -176, 137: -176, 138: -176, 142: -176, 155: -176, 156: -176, 163: -176, 174: -176, 176: -176, 177: -176, 180: -176, 181: -176, 182: -176, 194: -176, 195: -176, 200: -176, 201: -176, 202: -176, 203: -176, 204: -176, 205: -176, 206: -176, 207: -176, 208: -176, 209: -176, 210: -176, 211: -176, 212: -176, 213: -176, 214: -176, 215: -176, 216: -176, 217: -176 }, { 1: -186, 6: -186, 37: -186, 39: -186, 42: -186, 43: -186, 44: -186, 45: -186, 46: -186, 47: -186, 58: -186, 59: -186, 60: -186, 71: -186, 72: -186, 77: -186, 84: -186, 95: -186, 99: -186, 108: -186, 109: -186, 110: -186, 111: -186, 112: -186, 113: -186, 114: -186, 117: -186, 127: -186, 134: -186, 136: -186, 137: -186, 138: -186, 142: -186, 155: -186, 156: -186, 163: -186, 174: -186, 176: -186, 177: -186, 180: -186, 181: -186, 182: -186, 194: -186, 195: -186, 200: -186, 201: -186, 202: -186, 203: -186, 204: -186, 205: -186, 206: -186, 207: -186, 208: -186, 209: -186, 210: -186, 211: -186, 212: -186, 213: -186, 214: -186, 215: -186, 216: -186, 217: -186 }, { 6: -148, 39: -148, 43: -148, 44: -148, 84: -148, 117: -148 }, { 6: -62, 44: -62, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -330, 6: -330, 39: -330, 43: -330, 44: -330, 58: -330, 60: -330, 77: -330, 84: -330, 95: -330, 99: -330, 113: -330, 117: -330, 134: -330, 136: -330, 137: -330, 138: -330, 163: -330, 174: -330, 176: -330, 177: -330, 180: -330, 181: -330, 182: -330, 194: -330, 195: -330, 200: -330, 201: -330, 204: -330, 205: -330, 206: -330, 207: -330, 208: -330, 209: -330, 210: -330, 211: -330, 212: -330, 213: -330, 214: -330, 215: -330, 216: -330 }, { 7: 790, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -331, 6: -331, 39: -331, 43: -331, 44: -331, 58: -331, 60: -331, 77: -331, 84: -331, 95: -331, 99: -331, 113: -331, 117: -331, 134: -331, 136: -331, 137: -331, 138: -331, 163: -331, 174: -331, 176: -331, 177: -331, 180: -331, 181: -331, 182: -331, 194: -331, 195: -331, 200: -331, 201: -331, 204: -331, 205: -331, 206: -331, 207: -331, 208: -331, 209: -331, 210: -331, 211: -331, 212: -331, 213: -331, 214: -331, 215: -331, 216: -331 }, { 7: 791, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -335, 6: -335, 39: -335, 43: -335, 44: -335, 58: -335, 60: -335, 77: -335, 84: -335, 95: -335, 99: -335, 113: -335, 117: -335, 134: -335, 136: -335, 137: -335, 138: -335, 163: -335, 174: -335, 176: -335, 177: -335, 180: -335, 181: -335, 182: -335, 194: -335, 195: -335, 200: -335, 201: -335, 204: -335, 205: -335, 206: -335, 207: -335, 208: -335, 209: -335, 210: -335, 211: -335, 212: -335, 213: -335, 214: -335, 215: -335, 216: -335 }, { 1: -339, 6: -339, 39: -339, 43: -339, 44: -339, 58: -339, 60: -339, 77: -339, 84: -339, 95: -339, 99: -339, 113: -339, 117: -339, 134: -339, 136: -339, 137: -339, 138: -339, 163: -339, 174: -339, 176: -339, 177: -339, 180: -339, 181: -339, 182: -339, 194: -339, 195: -339, 200: -339, 201: -339, 204: -339, 205: -339, 206: -339, 207: -339, 208: -339, 209: -339, 210: -339, 211: -339, 212: -339, 213: -339, 214: -339, 215: -339, 216: -339 }, { 40: 792, 43: 165, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 40: 793, 43: 165, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -364, 6: -364, 39: -364, 43: -364, 44: -364, 58: -364, 60: -364, 77: -364, 84: -364, 95: -364, 99: -364, 113: -364, 117: -364, 134: -364, 136: -364, 137: -364, 138: -364, 163: -364, 174: -364, 176: -364, 177: -364, 180: -364, 181: -364, 182: -364, 194: -364, 195: -364, 200: -364, 201: -364, 204: -364, 205: -364, 206: -364, 207: -364, 208: -364, 209: -364, 210: -364, 211: -364, 212: -364, 213: -364, 214: -364, 215: -364, 216: -364 }, { 66: 794 }, { 1: -226, 6: -226, 39: -226, 43: -226, 44: -226, 77: -226, 84: -226, 99: -226, 174: -226, 176: -226, 177: -226, 194: -226, 195: -226 }, { 6: 646, 43: 647, 44: 795 }, { 1: -251, 6: -251, 39: -251, 43: -251, 44: -251, 77: -251, 84: -251, 99: -251, 174: -251, 176: -251, 177: -251, 194: -251, 195: -251 }, { 6: 654, 43: 655, 44: 796 }, { 6: -297, 43: -297, 44: -297, 84: -297, 99: -297 }, { 6: 671, 43: 672, 44: 797 }, { 7: 798, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 136: 799 }, { 6: -213, 43: -213, 44: -213, 84: -213, 137: -213 }, { 113: 800 }, { 6: -131, 37: -131, 43: -131, 44: -131, 84: -131, 108: -131, 109: -131, 110: -131, 111: -131, 112: -131, 114: -131, 137: -131, 156: -131 }, { 44: 801, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 802, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 7: 803, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 1: -352, 6: -352, 39: -352, 43: -352, 44: -352, 58: 109, 60: -352, 77: -352, 84: -352, 95: -352, 99: -352, 113: -352, 117: -352, 134: -352, 136: -352, 137: -352, 138: -352, 163: -352, 174: -352, 175: 127, 176: -352, 177: -352, 180: -352, 181: -352, 182: -352, 194: -352, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -356, 6: -356, 39: -356, 43: -356, 44: -356, 58: 109, 60: -356, 77: -356, 84: -356, 95: -356, 99: -356, 113: -356, 117: -356, 134: -356, 136: -356, 137: -356, 138: -356, 163: -356, 174: -356, 175: 127, 176: -356, 177: -356, 180: -356, 181: -356, 182: -356, 194: -356, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 40: 804, 43: 165, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 40: 805, 43: 165, 58: 109, 134: 128, 175: 127, 176: 97, 177: 98, 194: 125, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -337, 6: -337, 39: -337, 43: -337, 44: -337, 58: -337, 60: -337, 77: -337, 84: -337, 95: -337, 99: -337, 113: -337, 117: -337, 134: -337, 136: -337, 137: -337, 138: -337, 163: -337, 174: -337, 176: -337, 177: -337, 180: -337, 181: -337, 182: -337, 194: -337, 195: -337, 200: -337, 201: -337, 204: -337, 205: -337, 206: -337, 207: -337, 208: -337, 209: -337, 210: -337, 211: -337, 212: -337, 213: -337, 214: -337, 215: -337, 216: -337 }, { 1: -341, 6: -341, 39: -341, 43: -341, 44: -341, 58: -341, 60: -341, 77: -341, 84: -341, 95: -341, 99: -341, 113: -341, 117: -341, 134: -341, 136: -341, 137: -341, 138: -341, 163: -341, 174: -341, 176: -341, 177: -341, 180: -341, 181: -341, 182: -341, 194: -341, 195: -341, 200: -341, 201: -341, 204: -341, 205: -341, 206: -341, 207: -341, 208: -341, 209: -341, 210: -341, 211: -341, 212: -341, 213: -341, 214: -341, 215: -341, 216: -341 }, { 70: 806, 71: 106, 72: 107 }, { 6: -233, 43: -233, 44: -233, 84: -233, 137: -233 }, { 6: -256, 43: -256, 44: -256, 84: -256, 137: -256 }, { 6: -288, 39: -288, 43: -288, 44: -288, 84: -288 }, { 1: -349, 6: -349, 39: -349, 43: -349, 44: -349, 58: 109, 60: -349, 77: -349, 84: 809, 95: -349, 99: -349, 113: -349, 117: -349, 120: 807, 134: -349, 136: -349, 137: -349, 138: 808, 163: -349, 174: -349, 175: 127, 176: -349, 177: -349, 180: -349, 181: -349, 182: -349, 194: -349, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 7: 810, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: -130, 37: -130, 43: -130, 44: -130, 84: -130, 108: -130, 109: -130, 110: -130, 111: -130, 112: -130, 114: -130, 137: -130, 156: -130 }, { 113: 811 }, { 1: -347, 6: -347, 39: -347, 43: -347, 44: -347, 58: 109, 60: -347, 77: -347, 84: -347, 95: -347, 99: -347, 113: -347, 117: -347, 134: -347, 136: -347, 137: -347, 138: -347, 163: -347, 174: -347, 175: 127, 176: -347, 177: -347, 180: -347, 181: -347, 182: -347, 194: -347, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -348, 6: -348, 39: -348, 43: -348, 44: -348, 58: 109, 60: -348, 77: -348, 84: -348, 95: -348, 99: -348, 113: -348, 117: -348, 134: -348, 136: -348, 137: -348, 138: -348, 163: -348, 174: -348, 175: 127, 176: -348, 177: -348, 180: -348, 181: -348, 182: -348, 194: -348, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -332, 6: -332, 39: -332, 43: -332, 44: -332, 58: -332, 60: -332, 77: -332, 84: -332, 95: -332, 99: -332, 113: -332, 117: -332, 134: -332, 136: -332, 137: -332, 138: -332, 163: -332, 174: -332, 176: -332, 177: -332, 180: -332, 181: -332, 182: -332, 194: -332, 195: -332, 200: -332, 201: -332, 204: -332, 205: -332, 206: -332, 207: -332, 208: -332, 209: -332, 210: -332, 211: -332, 212: -332, 213: -332, 214: -332, 215: -332, 216: -332 }, { 1: -333, 6: -333, 39: -333, 43: -333, 44: -333, 58: -333, 60: -333, 77: -333, 84: -333, 95: -333, 99: -333, 113: -333, 117: -333, 134: -333, 136: -333, 137: -333, 138: -333, 163: -333, 174: -333, 176: -333, 177: -333, 180: -333, 181: -333, 182: -333, 194: -333, 195: -333, 200: -333, 201: -333, 204: -333, 205: -333, 206: -333, 207: -333, 208: -333, 209: -333, 210: -333, 211: -333, 212: -333, 213: -333, 214: -333, 215: -333, 216: -333 }, { 1: -228, 6: -228, 39: -228, 43: -228, 44: -228, 77: -228, 84: -228, 99: -228, 174: -228, 176: -228, 177: -228, 194: -228, 195: -228 }, { 137: 812 }, { 7: 813, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 6: -143, 39: -143, 43: -143, 44: -143, 99: -143, 137: -143 }, { 1: -351, 6: -351, 39: -351, 43: -351, 44: -351, 58: 109, 60: -351, 77: -351, 84: 809, 95: -351, 99: -351, 113: -351, 117: -351, 120: 814, 134: -351, 136: -351, 137: -351, 138: 815, 163: -351, 174: -351, 175: 127, 176: -351, 177: -351, 180: -351, 181: -351, 182: -351, 194: -351, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 6: -132, 37: -132, 43: -132, 44: -132, 84: -132, 108: -132, 109: -132, 110: -132, 111: -132, 112: -132, 114: -132, 137: -132, 156: -132 }, { 1: -204, 6: -204, 37: -204, 39: -204, 42: -204, 43: -204, 44: -204, 45: -204, 46: -204, 47: -204, 58: -204, 59: -204, 60: -204, 71: -204, 72: -204, 77: -204, 84: -204, 95: -204, 99: -204, 108: -204, 109: -204, 110: -204, 111: -204, 112: -204, 113: -204, 114: -204, 117: -204, 127: -204, 134: -204, 136: -204, 137: -204, 138: -204, 155: -204, 156: -204, 163: -204, 174: -204, 176: -204, 177: -204, 180: -204, 181: -204, 182: -204, 194: -204, 195: -204, 200: -204, 201: -204, 204: -204, 205: -204, 206: -204, 207: -204, 208: -204, 209: -204, 210: -204, 211: -204, 212: -204, 213: -204, 214: -204, 215: -204, 216: -204 }, { 1: -350, 6: -350, 39: -350, 43: -350, 44: -350, 58: 109, 60: -350, 77: -350, 84: 809, 95: -350, 99: -350, 113: -350, 117: -350, 120: 816, 134: -350, 136: -350, 137: -350, 138: -350, 163: -350, 174: -350, 175: 127, 176: -350, 177: -350, 180: -350, 181: -350, 182: -350, 194: -350, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 137: 817 }, { 7: 818, 9: 168, 10: 30, 11: 31, 12: 32, 13: 33, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 27, 35: 68, 36: 93, 41: 34, 48: 54, 49: 173, 50: 55, 51: 56, 52: 57, 56: 88, 61: 105, 64: 67, 65: 74, 68: 75, 69: 101, 70: 102, 71: 106, 72: 107, 78: 77, 79: 103, 80: 104, 81: 38, 85: 35, 86: 76, 87: 78, 88: 79, 89: 80, 90: 81, 91: 82, 97: 94, 98: 84, 101: 36, 102: 41, 103: 40, 104: 85, 107: 86, 115: 70, 116: 172, 118: 91, 119: 92, 123: 73, 125: 53, 128: 37, 129: 39, 130: 42, 131: 89, 132: 90, 133: 100, 134: 63, 141: 65, 143: 71, 151: 72, 158: 87, 168: 60, 172: 66, 173: 83, 175: 61, 176: 97, 177: 98, 178: 62, 179: 99, 183: 50, 185: 64, 190: 58, 191: 95, 192: 59, 193: 96, 196: 174, 197: 175, 198: 176, 199: 47, 200: 48, 201: 49, 202: 51, 203: 52 }, { 137: 819 }, { 1: -206, 6: -206, 37: -206, 39: -206, 42: -206, 43: -206, 44: -206, 45: -206, 46: -206, 47: -206, 58: -206, 59: -206, 60: -206, 71: -206, 72: -206, 77: -206, 84: -206, 95: -206, 99: -206, 108: -206, 109: -206, 110: -206, 111: -206, 112: -206, 113: -206, 114: -206, 117: -206, 127: -206, 134: -206, 136: -206, 137: -206, 138: -206, 155: -206, 156: -206, 163: -206, 174: -206, 176: -206, 177: -206, 180: -206, 181: -206, 182: -206, 194: -206, 195: -206, 200: -206, 201: -206, 204: -206, 205: -206, 206: -206, 207: -206, 208: -206, 209: -206, 210: -206, 211: -206, 212: -206, 213: -206, 214: -206, 215: -206, 216: -206 }, { 1: -352, 6: -352, 39: -352, 43: -352, 44: -352, 58: 109, 60: -352, 77: -352, 84: 809, 95: -352, 99: -352, 113: -352, 117: -352, 120: 820, 134: -352, 136: -352, 137: -352, 138: -352, 163: -352, 174: -352, 175: 127, 176: -352, 177: -352, 180: -352, 181: -352, 182: -352, 194: -352, 195: 126, 200: 111, 201: 110, 204: 112, 205: 113, 206: 114, 207: 115, 208: 116, 209: 117, 210: 118, 211: 119, 212: 120, 213: 121, 214: 122, 215: 123, 216: 124 }, { 1: -205, 6: -205, 37: -205, 39: -205, 42: -205, 43: -205, 44: -205, 45: -205, 46: -205, 47: -205, 58: -205, 59: -205, 60: -205, 71: -205, 72: -205, 77: -205, 84: -205, 95: -205, 99: -205, 108: -205, 109: -205, 110: -205, 111: -205, 112: -205, 113: -205, 114: -205, 117: -205, 127: -205, 134: -205, 136: -205, 137: -205, 138: -205, 155: -205, 156: -205, 163: -205, 174: -205, 176: -205, 177: -205, 180: -205, 181: -205, 182: -205, 194: -205, 195: -205, 200: -205, 201: -205, 204: -205, 205: -205, 206: -205, 207: -205, 208: -205, 209: -205, 210: -205, 211: -205, 212: -205, 213: -205, 214: -205, 215: -205, 216: -205 }, { 137: 821 }, { 1: -207, 6: -207, 37: -207, 39: -207, 42: -207, 43: -207, 44: -207, 45: -207, 46: -207, 47: -207, 58: -207, 59: -207, 60: -207, 71: -207, 72: -207, 77: -207, 84: -207, 95: -207, 99: -207, 108: -207, 109: -207, 110: -207, 111: -207, 112: -207, 113: -207, 114: -207, 117: -207, 127: -207, 134: -207, 136: -207, 137: -207, 138: -207, 155: -207, 156: -207, 163: -207, 174: -207, 176: -207, 177: -207, 180: -207, 181: -207, 182: -207, 194: -207, 195: -207, 200: -207, 201: -207, 204: -207, 205: -207, 206: -207, 207: -207, 208: -207, 209: -207, 210: -207, 211: -207, 212: -207, 213: -207, 214: -207, 215: -207, 216: -207 }],
  ruleTable: [0, 0, 3, 0, 3, 1, 4, 1, 4, 3, 4, 2, 5, 1, 5, 1, 5, 1, 9, 1, 9, 1, 9, 1, 9, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 34, 6, 34, 3, 18, 3, 18, 4, 18, 5, 19, 3, 19, 4, 19, 5, 20, 3, 20, 4, 20, 5, 21, 3, 21, 4, 21, 5, 22, 3, 22, 2, 23, 2, 24, 2, 25, 5, 53, 1, 53, 3, 53, 2, 54, 1, 54, 1, 54, 1, 54, 1, 55, 2, 55, 3, 55, 4, 55, 3, 8, 1, 8, 1, 33, 1, 33, 2, 33, 4, 33, 3, 40, 2, 40, 3, 36, 1, 67, 1, 68, 1, 68, 1, 70, 1, 70, 3, 73, 1, 73, 2, 75, 3, 75, 5, 75, 2, 75, 1, 78, 1, 78, 3, 83, 3, 83, 1, 85, 1, 85, 1, 85, 1, 85, 1, 85, 1, 85, 1, 85, 1, 85, 1, 17, 3, 17, 4, 17, 5, 92, 1, 92, 1, 92, 3, 92, 5, 92, 3, 92, 5, 96, 1, 96, 1, 96, 1, 93, 1, 93, 3, 93, 4, 93, 1, 94, 2, 94, 2, 100, 1, 100, 1, 100, 1, 100, 1, 100, 1, 100, 3, 100, 2, 100, 3, 100, 3, 100, 3, 100, 3, 100, 3, 100, 3, 100, 2, 100, 2, 100, 4, 100, 6, 100, 5, 100, 7, 10, 2, 10, 4, 10, 1, 15, 5, 15, 2, 62, 5, 62, 2, 49, 1, 49, 1, 120, 0, 120, 1, 38, 0, 38, 1, 38, 3, 38, 4, 38, 6, 121, 1, 121, 3, 121, 2, 121, 1, 122, 1, 122, 1, 122, 1, 122, 1, 124, 2, 125, 1, 125, 1, 125, 3, 125, 3, 125, 3, 125, 3, 125, 2, 125, 2, 125, 4, 125, 6, 125, 4, 125, 6, 125, 4, 125, 5, 125, 7, 125, 5, 125, 7, 125, 5, 125, 7, 125, 3, 125, 3, 125, 3, 125, 3, 125, 2, 125, 2, 125, 4, 125, 6, 125, 5, 125, 7, 41, 1, 41, 1, 41, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 102, 3, 102, 4, 102, 6, 130, 3, 130, 3, 65, 10, 65, 12, 65, 11, 65, 13, 65, 4, 140, 0, 140, 1, 140, 3, 140, 4, 140, 6, 31, 1, 31, 2, 31, 3, 31, 4, 31, 2, 31, 3, 31, 4, 31, 5, 12, 2, 12, 4, 12, 4, 12, 5, 12, 7, 12, 6, 12, 9, 146, 1, 146, 3, 146, 4, 146, 4, 146, 6, 147, 1, 147, 3, 147, 1, 147, 3, 144, 1, 145, 3, 13, 3, 13, 5, 13, 2, 13, 2, 13, 4, 13, 5, 13, 6, 13, 3, 13, 5, 13, 4, 13, 5, 13, 7, 152, 1, 152, 3, 152, 4, 152, 4, 152, 6, 154, 1, 154, 3, 154, 3, 154, 1, 154, 3, 81, 3, 81, 3, 81, 3, 81, 2, 81, 2, 105, 0, 105, 1, 106, 2, 106, 4, 103, 1, 103, 1, 97, 2, 123, 2, 123, 3, 123, 4, 162, 1, 162, 1, 128, 5, 126, 3, 126, 2, 126, 2, 126, 1, 157, 1, 157, 3, 157, 4, 157, 4, 157, 6, 164, 1, 164, 1, 164, 1, 164, 1, 160, 1, 160, 3, 160, 4, 160, 4, 160, 6, 165, 1, 165, 2, 161, 1, 161, 2, 159, 1, 159, 2, 166, 1, 166, 2, 167, 1, 167, 3, 27, 2, 27, 3, 27, 4, 27, 5, 169, 3, 169, 3, 169, 2, 32, 2, 32, 4, 101, 3, 101, 5, 175, 2, 175, 4, 175, 2, 175, 4, 28, 2, 28, 2, 28, 2, 28, 1, 178, 2, 178, 2, 29, 5, 29, 7, 29, 7, 29, 9, 29, 9, 29, 5, 29, 7, 29, 6, 29, 8, 29, 5, 29, 7, 29, 6, 29, 8, 29, 3, 29, 5, 29, 5, 29, 7, 29, 7, 29, 9, 29, 9, 29, 5, 29, 7, 29, 6, 29, 8, 29, 5, 29, 7, 29, 6, 29, 8, 29, 3, 29, 5, 184, 1, 184, 3, 135, 1, 135, 3, 30, 5, 30, 7, 30, 4, 30, 6, 186, 1, 186, 2, 188, 3, 188, 4, 190, 3, 190, 5, 192, 3, 192, 5, 26, 1, 26, 3, 26, 1, 26, 3, 26, 3, 26, 3, 26, 3, 63, 2, 63, 2, 63, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 4, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 5, 16, 3, 16, 5, 16, 4, 129, 2],
  ruleActions: (rule, vals, locs, shared) => {
    const $ = vals;
    const $0 = vals.length - 1;
    switch (rule) {
      case 1:
        return ["program"];
      case 2:
        return ["program", ...$[$0]];
      case 3:
      case 53:
      case 78:
      case 145:
      case 210:
      case 229:
      case 252:
      case 284:
      case 298:
      case 302:
      case 361:
      case 367:
        return [$[$0]];
      case 4:
      case 54:
      case 146:
      case 211:
      case 230:
      case 253:
      case 285:
        return [...$[$0 - 2], $[$0]];
      case 5:
      case 55:
      case 80:
      case 305:
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
      case 56:
      case 57:
      case 58:
      case 59:
      case 64:
      case 65:
      case 72:
      case 73:
      case 74:
      case 75:
      case 76:
      case 83:
      case 84:
      case 88:
      case 89:
      case 90:
      case 93:
      case 94:
      case 95:
      case 100:
      case 105:
      case 106:
      case 107:
      case 108:
      case 111:
      case 114:
      case 115:
      case 116:
      case 117:
      case 118:
      case 140:
      case 141:
      case 142:
      case 143:
      case 149:
      case 153:
      case 154:
      case 155:
      case 156:
      case 158:
      case 159:
      case 187:
      case 188:
      case 189:
      case 190:
      case 191:
      case 192:
      case 193:
      case 194:
      case 195:
      case 196:
      case 197:
      case 198:
      case 234:
      case 236:
      case 238:
      case 257:
      case 260:
      case 289:
      case 290:
      case 291:
      case 293:
      case 306:
      case 326:
      case 359:
      case 375:
      case 377:
        return $[$0];
      case 34:
        return ["def", $[$0 - 4], $[$0 - 2], $[$0]];
      case 35:
        return ["def", $[$0 - 1], [], $[$0]];
      case 36:
        return ["signal", $[$0 - 2], $[$0]];
      case 37:
        return ["signal", $[$0 - 3], $[$0]];
      case 38:
        return ["signal", $[$0 - 4], $[$0 - 1]];
      case 39:
        return ["derived", $[$0 - 2], $[$0]];
      case 40:
        return ["derived", $[$0 - 3], $[$0]];
      case 41:
        return ["derived", $[$0 - 4], $[$0 - 1]];
      case 42:
        return ["readonly", $[$0 - 2], $[$0]];
      case 43:
        return ["readonly", $[$0 - 3], $[$0]];
      case 44:
        return ["readonly", $[$0 - 4], $[$0 - 1]];
      case 45:
        return ["exposed", $[$0 - 2], $[$0]];
      case 46:
        return ["exposed", $[$0 - 3], $[$0]];
      case 47:
        return ["exposed", $[$0 - 4], $[$0 - 1]];
      case 48:
      case 49:
        return ["effect", $[$0]];
      case 50:
        return ["render", $[$0]];
      case 51:
        return ["style", $[$0]];
      case 52:
        return ["component", $[$0 - 3], ["block", ...$[$0 - 1]]];
      case 60:
        return ["prop", $[$0]];
      case 61:
        return ["prop", $[$0 - 1], "optional"];
      case 62:
        return ["prop", $[$0 - 2], $[$0]];
      case 63:
        return ["prop-rest", $[$0]];
      case 66:
        return ["yield"];
      case 67:
        return ["yield", $[$0]];
      case 68:
        return ["yield", $[$0 - 1]];
      case 69:
        return ["yield-from", $[$0]];
      case 70:
        return ["block"];
      case 71:
        return ["block", ...$[$0 - 1]];
      case 77:
        return ["str", ...$[$0 - 1]];
      case 79:
      case 299:
      case 303:
      case 368:
        return [...$[$0 - 1], $[$0]];
      case 81:
      case 232:
      case 255:
      case 270:
      case 287:
        return $[$0 - 2];
      case 82:
        return "";
      case 85:
        return ["regex", $[$0 - 1]];
      case 86:
        return ["regex-index", $[$0 - 2], $[$0]];
      case 87:
        return ["regex-index", $[$0], null];
      case 91:
        return "undefined";
      case 92:
        return "null";
      case 96:
        return ["=", $[$0 - 2], $[$0]];
      case 97:
        return ["=", $[$0 - 3], $[$0]];
      case 98:
        return ["=", $[$0 - 4], $[$0 - 1]];
      case 99:
        return [$[$0], $[$0], null];
      case 101:
        return [$[$0 - 2], $[$0], ":"];
      case 102:
        return [$[$0 - 4], $[$0 - 1], ":"];
      case 103:
        return [$[$0 - 2], $[$0], "="];
      case 104:
        return [$[$0 - 4], $[$0 - 1], "="];
      case 109:
        return ["computed", $[$0 - 1]];
      case 110:
        return ["[]", "this", $[$0 - 1]];
      case 112:
      case 113:
      case 157:
        return ["...", $[$0]];
      case 119:
      case 265:
        return ["super", ...$[$0]];
      case 120:
      case 266:
        return ["import", ...$[$0]];
      case 121:
      case 122:
        return [$[$0 - 2], ...$[$0]];
      case 123:
      case 160:
      case 177:
        return [".", $[$0 - 2], $[$0]];
      case 124:
      case 161:
      case 178:
        return ["?.", $[$0 - 2], $[$0]];
      case 125:
      case 162:
      case 179:
        return ["::", $[$0 - 2], $[$0]];
      case 126:
      case 163:
      case 180:
        return ["?::", $[$0 - 2], $[$0]];
      case 127:
      case 164:
      case 181:
        return ["::", $[$0 - 1], "prototype"];
      case 128:
      case 165:
      case 182:
        return ["?::", $[$0 - 1], "prototype"];
      case 129:
      case 166:
      case 168:
      case 183:
        return ["[]", $[$0 - 3], $[$0 - 1]];
      case 130:
      case 167:
      case 169:
      case 184:
        return ["[]", $[$0 - 5], $[$0 - 2]];
      case 131:
      case 171:
      case 173:
      case 185:
        return ["?[]", $[$0 - 4], $[$0 - 1]];
      case 132:
      case 172:
      case 174:
      case 186:
        return ["?[]", $[$0 - 6], $[$0 - 2]];
      case 133:
        return ["return", $[$0]];
      case 134:
        return ["return", $[$0 - 1]];
      case 135:
        return ["return"];
      case 136:
      case 138:
        return [$[$0 - 1], $[$0 - 3], $[$0]];
      case 137:
      case 139:
        return [$[$0 - 1], [], $[$0]];
      case 144:
      case 209:
      case 269:
      case 300:
        return [];
      case 147:
      case 212:
      case 231:
      case 254:
      case 286:
        return [...$[$0 - 3], $[$0]];
      case 148:
      case 213:
      case 233:
      case 256:
      case 288:
        return [...$[$0 - 5], ...$[$0 - 2]];
      case 150:
      case 360:
        return ["default", $[$0 - 2], $[$0]];
      case 151:
        return ["rest", $[$0]];
      case 152:
        return ["expansion"];
      case 170:
        return [$[$0 - 1][0], $[$0 - 3], ...$[$0 - 1].slice(1)];
      case 175:
        return ["optindex", $[$0 - 4], $[$0 - 1]];
      case 176:
        return ["optindex", $[$0 - 6], $[$0 - 2]];
      case 199:
        return [".", "super", $[$0]];
      case 200:
        return ["[]", "super", $[$0 - 1]];
      case 201:
        return ["[]", "super", $[$0 - 2]];
      case 202:
        return [".", "new", $[$0]];
      case 203:
        return [".", "import", $[$0]];
      case 204:
        return ["object-comprehension", $[$0 - 8], $[$0 - 6], [["for-of", $[$0 - 4], $[$0 - 2], false]], []];
      case 205:
        return ["object-comprehension", $[$0 - 10], $[$0 - 8], [["for-of", $[$0 - 6], $[$0 - 4], false]], [$[$0 - 2]]];
      case 206:
        return ["object-comprehension", $[$0 - 9], $[$0 - 7], [["for-of", $[$0 - 4], $[$0 - 2], true]], []];
      case 207:
        return ["object-comprehension", $[$0 - 11], $[$0 - 9], [["for-of", $[$0 - 6], $[$0 - 4], true]], [$[$0 - 2]]];
      case 208:
        return ["object", ...$[$0 - 2]];
      case 214:
        return ["class", null, null];
      case 215:
        return ["class", null, null, $[$0]];
      case 216:
        return ["class", null, $[$0]];
      case 217:
        return ["class", null, $[$0 - 1], $[$0]];
      case 218:
        return ["class", $[$0], null];
      case 219:
        return ["class", $[$0 - 1], null, $[$0]];
      case 220:
        return ["class", $[$0 - 2], $[$0]];
      case 221:
        return ["class", $[$0 - 3], $[$0 - 1], $[$0]];
      case 222:
      case 225:
        return ["import", "{}", $[$0]];
      case 223:
      case 224:
        return ["import", $[$0 - 2], $[$0]];
      case 226:
        return ["import", $[$0 - 4], $[$0]];
      case 227:
        return ["import", [$[$0 - 4], $[$0 - 2]], $[$0]];
      case 228:
        return ["import", [$[$0 - 7], $[$0 - 4]], $[$0]];
      case 235:
      case 237:
      case 258:
      case 259:
      case 261:
      case 362:
        return [$[$0 - 2], $[$0]];
      case 239:
        return ["*", $[$0]];
      case 240:
        return ["export", "{}"];
      case 241:
        return ["export", $[$0 - 2]];
      case 242:
      case 243:
        return ["export", $[$0]];
      case 244:
        return ["export", ["=", $[$0 - 2], $[$0]]];
      case 245:
        return ["export", ["=", $[$0 - 3], $[$0]]];
      case 246:
        return ["export", ["=", $[$0 - 4], $[$0 - 1]]];
      case 247:
        return ["export-default", $[$0]];
      case 248:
        return ["export-default", $[$0 - 1]];
      case 249:
        return ["export-all", $[$0]];
      case 250:
        return ["export-from", "{}", $[$0]];
      case 251:
        return ["export-from", $[$0 - 4], $[$0]];
      case 262:
        return ["tagged-template", $[$0 - 2], $[$0]];
      case 263:
        return $[$0 - 1] ? ["?call", $[$0 - 2], ...$[$0]] : [$[$0 - 2], ...$[$0]];
      case 264:
        return ["optcall", $[$0 - 2], ...$[$0]];
      case 267:
      case 304:
        return null;
      case 268:
        return true;
      case 271:
      case 272:
        return "this";
      case 273:
        return [".", "this", $[$0]];
      case 274:
        return ["array"];
      case 275:
        return ["array", ...$[$0 - 1]];
      case 276:
        return ["array", ...$[$0 - 2], ...$[$0 - 1]];
      case 277:
        return "..";
      case 278:
      case 292:
        return "...";
      case 279:
        return [$[$0 - 2], $[$0 - 3], $[$0 - 1]];
      case 280:
      case 399:
      case 401:
      case 402:
      case 410:
      case 412:
        return [$[$0 - 1], $[$0 - 2], $[$0]];
      case 281:
        return [$[$0], $[$0 - 1], null];
      case 282:
        return [$[$0 - 1], null, $[$0]];
      case 283:
        return [$[$0], null, null];
      case 294:
        return [...$[$0 - 2], ...$[$0]];
      case 295:
        return [...$[$0 - 3], ...$[$0]];
      case 296:
        return [...$[$0 - 2], ...$[$0 - 1]];
      case 297:
        return [...$[$0 - 5], ...$[$0 - 4], ...$[$0 - 2], ...$[$0 - 1]];
      case 301:
        return [...$[$0]];
      case 307:
        return Array.isArray($[$0 - 2]) ? [...$[$0 - 2], $[$0]] : [$[$0 - 2], $[$0]];
      case 308:
        return ["try", $[$0]];
      case 309:
        return ["try", $[$0 - 1], $[$0]];
      case 310:
        return ["try", $[$0 - 2], $[$0]];
      case 311:
        return ["try", $[$0 - 3], $[$0 - 2], $[$0]];
      case 312:
      case 313:
      case 382:
      case 385:
      case 387:
        return [$[$0 - 1], $[$0]];
      case 314:
        return [null, $[$0]];
      case 315:
        return ["throw", $[$0]];
      case 316:
        return ["throw", $[$0 - 1]];
      case 317:
        return $[$0 - 1].length === 1 ? $[$0 - 1][0] : $[$0 - 1];
      case 318:
        return $[$0 - 2].length === 1 ? $[$0 - 2][0] : $[$0 - 2];
      case 319:
        return ["while", $[$0]];
      case 320:
        return ["while", $[$0 - 2], $[$0]];
      case 321:
        return ["until", $[$0]];
      case 322:
        return ["until", $[$0 - 2], $[$0]];
      case 323:
        return $[$0 - 1].length === 2 ? [$[$0 - 1][0], $[$0 - 1][1], $[$0]] : [$[$0 - 1][0], $[$0 - 1][1], $[$0 - 1][2], $[$0]];
      case 324:
      case 325:
        return $[$0].length === 2 ? [$[$0][0], $[$0][1], [$[$0 - 1]]] : [$[$0][0], $[$0][1], $[$0][2], [$[$0 - 1]]];
      case 327:
        return ["loop", $[$0]];
      case 328:
        return ["loop", [$[$0]]];
      case 329:
        return ["for-in", $[$0 - 3], $[$0 - 1], null, null, $[$0]];
      case 330:
        return ["for-in", $[$0 - 5], $[$0 - 3], null, $[$0 - 1], $[$0]];
      case 331:
        return ["for-in", $[$0 - 5], $[$0 - 3], $[$0 - 1], null, $[$0]];
      case 332:
        return ["for-in", $[$0 - 7], $[$0 - 5], $[$0 - 1], $[$0 - 3], $[$0]];
      case 333:
        return ["for-in", $[$0 - 7], $[$0 - 5], $[$0 - 3], $[$0 - 1], $[$0]];
      case 334:
        return ["for-of", $[$0 - 3], $[$0 - 1], false, null, $[$0]];
      case 335:
        return ["for-of", $[$0 - 5], $[$0 - 3], false, $[$0 - 1], $[$0]];
      case 336:
        return ["for-of", $[$0 - 3], $[$0 - 1], true, null, $[$0]];
      case 337:
        return ["for-of", $[$0 - 5], $[$0 - 3], true, $[$0 - 1], $[$0]];
      case 338:
        return ["for-from", $[$0 - 3], $[$0 - 1], false, null, $[$0]];
      case 339:
        return ["for-from", $[$0 - 5], $[$0 - 3], false, $[$0 - 1], $[$0]];
      case 340:
        return ["for-from", $[$0 - 3], $[$0 - 1], true, null, $[$0]];
      case 341:
        return ["for-from", $[$0 - 5], $[$0 - 3], true, $[$0 - 1], $[$0]];
      case 342:
        return ["for-in", [], $[$0 - 1], null, null, $[$0]];
      case 343:
        return ["for-in", [], $[$0 - 3], $[$0 - 1], null, $[$0]];
      case 344:
        return ["comprehension", $[$0 - 4], [["for-in", $[$0 - 2], $[$0], null]], []];
      case 345:
        return ["comprehension", $[$0 - 6], [["for-in", $[$0 - 4], $[$0 - 2], null]], [$[$0]]];
      case 346:
        return ["comprehension", $[$0 - 6], [["for-in", $[$0 - 4], $[$0 - 2], $[$0]]], []];
      case 347:
        return ["comprehension", $[$0 - 8], [["for-in", $[$0 - 6], $[$0 - 4], $[$0]]], [$[$0 - 2]]];
      case 348:
        return ["comprehension", $[$0 - 8], [["for-in", $[$0 - 6], $[$0 - 4], $[$0 - 2]]], [$[$0]]];
      case 349:
        return ["comprehension", $[$0 - 4], [["for-of", $[$0 - 2], $[$0], false]], []];
      case 350:
        return ["comprehension", $[$0 - 6], [["for-of", $[$0 - 4], $[$0 - 2], false]], [$[$0]]];
      case 351:
        return ["comprehension", $[$0 - 5], [["for-of", $[$0 - 2], $[$0], true]], []];
      case 352:
        return ["comprehension", $[$0 - 7], [["for-of", $[$0 - 4], $[$0 - 2], true]], [$[$0]]];
      case 353:
        return ["comprehension", $[$0 - 4], [["for-from", $[$0 - 2], $[$0], false, null]], []];
      case 354:
        return ["comprehension", $[$0 - 6], [["for-from", $[$0 - 4], $[$0 - 2], false, null]], [$[$0]]];
      case 355:
        return ["comprehension", $[$0 - 5], [["for-from", $[$0 - 2], $[$0], true, null]], []];
      case 356:
        return ["comprehension", $[$0 - 7], [["for-from", $[$0 - 4], $[$0 - 2], true, null]], [$[$0]]];
      case 357:
        return ["comprehension", $[$0 - 2], [["for-in", [], $[$0], null]], []];
      case 358:
        return ["comprehension", $[$0 - 4], [["for-in", [], $[$0 - 2], $[$0]]], []];
      case 363:
        return ["switch", $[$0 - 3], $[$0 - 1], null];
      case 364:
        return ["switch", $[$0 - 5], $[$0 - 3], $[$0 - 1]];
      case 365:
        return ["switch", null, $[$0 - 1], null];
      case 366:
        return ["switch", null, $[$0 - 3], $[$0 - 1]];
      case 369:
        return ["when", $[$0 - 1], $[$0]];
      case 370:
        return ["when", $[$0 - 2], $[$0 - 1]];
      case 371:
        return ["if", $[$0 - 1], $[$0]];
      case 372:
        return $[$0 - 4].length === 3 ? ["if", $[$0 - 4][1], $[$0 - 4][2], ["if", $[$0 - 1], $[$0]]] : [...$[$0 - 4], ["if", $[$0 - 1], $[$0]]];
      case 373:
        return ["unless", $[$0 - 1], $[$0]];
      case 374:
        return ["if", ["!", $[$0 - 3]], $[$0 - 2], $[$0]];
      case 376:
        return $[$0 - 2].length === 3 ? ["if", $[$0 - 2][1], $[$0 - 2][2], $[$0]] : [...$[$0 - 2], $[$0]];
      case 378:
      case 379:
        return ["if", $[$0], [$[$0 - 2]]];
      case 380:
      case 381:
        return ["unless", $[$0], [$[$0 - 2]]];
      case 383:
      case 384:
      case 386:
      case 415:
        return ["do-iife", $[$0]];
      case 388:
        return ["-", $[$0]];
      case 389:
        return ["+", $[$0]];
      case 390:
        return ["await", $[$0]];
      case 391:
        return ["await", $[$0 - 1]];
      case 392:
        return ["--", $[$0], false];
      case 393:
        return ["++", $[$0], false];
      case 394:
        return ["--", $[$0 - 1], true];
      case 395:
        return ["++", $[$0 - 1], true];
      case 396:
        return ["?", $[$0 - 1]];
      case 397:
        return ["+", $[$0 - 2], $[$0]];
      case 398:
        return ["-", $[$0 - 2], $[$0]];
      case 400:
        return ["**", $[$0 - 2], $[$0]];
      case 403:
        return ["&", $[$0 - 2], $[$0]];
      case 404:
        return ["^", $[$0 - 2], $[$0]];
      case 405:
        return ["|", $[$0 - 2], $[$0]];
      case 406:
        return ["&&", $[$0 - 2], $[$0]];
      case 407:
        return ["||", $[$0 - 2], $[$0]];
      case 408:
        return ["??", $[$0 - 2], $[$0]];
      case 409:
        return ["!?", $[$0 - 2], $[$0]];
      case 411:
        return ["?:", $[$0 - 4], $[$0 - 2], $[$0]];
      case 413:
        return [$[$0 - 3], $[$0 - 4], $[$0 - 1]];
      case 414:
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
    let EOF, TERROR, action, errStr, expected, len2, lex, lexer, loc, locFirst, locLast, newState, p, parseTable, preErrorSymbol, r, ranges, recovering, sharedState, state, stk, symbol, val, yyleng, yylineno, yyloc, yytext, yyval;
    [stk, val, loc] = [[0], [null], []];
    [parseTable, yytext, yylineno, yyleng, recovering] = [this.parseTable, "", 0, 0, 0];
    [TERROR, EOF] = [2, 1];
    lexer = Object.create(this.lexer);
    sharedState = { yy: {} };
    for (const k2 in this.yy)
      if (Object.hasOwn(this.yy, k2)) {
        const v = this.yy[k2];
        sharedState.yy[k2] = v;
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
    [symbol, preErrorSymbol, state, action, r, yyval, p, len2, newState, expected] = [null, null, null, null, null, {}, null, null, null, null];
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
        len2 = this.ruleTable[-action * 2 + 1];
        yyval.$ = val[val.length - len2];
        [locFirst, locLast] = [loc[loc.length - (len2 || 1)], loc[loc.length - 1]];
        yyval._$ = { first_line: locFirst.first_line, last_line: locLast.last_line, first_column: locFirst.first_column, last_column: locLast.last_column };
        if (ranges)
          yyval._$.range = [locFirst.range[0], locLast.range[1]];
        r = this.ruleActions.apply(yyval, [-action, val, loc, sharedState.yy]);
        if (r != null)
          yyval.$ = r;
        if (len2) {
          stk.length -= len2 * 2;
          val.length -= len2;
          loc.length -= len2;
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
// src/codegen.js
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
  static NUMBER_LITERAL_REGEX = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;
  static NUMBER_START_REGEX = /^-?\d/;
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
    "::": "generatePrototype",
    "?::": "generateOptionalPrototype",
    "[]": "generateIndexAccess",
    "?[]": "generateSoakIndex",
    optindex: "generateOptIndex",
    optcall: "generateOptCall",
    "regex-index": "generateRegexIndex",
    def: "generateDef",
    "->": "generateThinArrow",
    "=>": "generateFatArrow",
    return: "generateReturn",
    signal: "generateSignal",
    derived: "generateDerived",
    readonly: "generateReadonly",
    exposed: "generateExposed",
    effect: "generateEffect",
    render: "generateRender",
    style: "generateStyle",
    component: "generateComponent",
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
    "for-from": "generateForFrom",
    while: "generateWhile",
    until: "generateUntil",
    try: "generateTry",
    throw: "generateThrow",
    switch: "generateSwitch",
    when: "generateWhen",
    comprehension: "generateComprehension",
    "object-comprehension": "generateObjectComprehension",
    class: "generateClass",
    super: "generateSuper",
    "?call": "generateSoakCall",
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
    const code = this.generate(sexpr);
    return code;
  }
  collectProgramVariables(sexpr) {
    if (!Array.isArray(sexpr))
      return;
    let [head, ...rest] = sexpr;
    const headAwaitMetadata = head instanceof String ? head.await : undefined;
    const headInvertMetadata = head instanceof String ? head.invert : undefined;
    if (head instanceof String) {
      head = head.valueOf();
    }
    if (headAwaitMetadata !== undefined)
      sexpr[0].await = headAwaitMetadata;
    if (headInvertMetadata !== undefined)
      sexpr[0].invert = headInvertMetadata;
    if (Array.isArray(head)) {
      sexpr.forEach((item) => this.collectProgramVariables(item));
      return;
    }
    if (head === "export" || head === "export-default" || head === "export-all" || head === "export-from") {
      return;
    }
    if (head === "signal" || head === "derived" || head === "readonly") {
      const [target] = rest;
      const varName = typeof target === "string" ? target : target.valueOf();
      if (!this.reactiveVars)
        this.reactiveVars = new Set;
      this.reactiveVars.add(varName);
      return;
    }
    if (CodeGenerator.ASSIGNMENT_OPS.has(head)) {
      const [target, value] = rest;
      if (typeof target === "string" || target instanceof String) {
        const varName = target instanceof String ? target.valueOf() : target;
        if (!this.reactiveVars?.has(varName)) {
          this.programVars.add(varName);
        }
      } else if (Array.isArray(target) && target[0] === "array") {
        this.collectVarsFromArray(target, this.programVars);
      } else if (Array.isArray(target) && target[0] === "object") {
        this.collectVarsFromObject(target, this.programVars);
      }
      this.collectProgramVariables(value);
      return;
    }
    if (head === "def" || head === "->" || head === "=>") {
      return;
    }
    if (head === "component") {
      return;
    }
    if (head === "if") {
      const [condition, thenBranch, elseBranch] = rest;
      this.collectProgramVariables(condition);
      this.collectProgramVariables(thenBranch);
      if (elseBranch) {
        this.collectProgramVariables(elseBranch);
      }
      return;
    }
    if (head === "unless") {
      const [condition, body] = rest;
      this.collectProgramVariables(condition);
      this.collectProgramVariables(body);
      return;
    }
    if (head === "try") {
      this.collectProgramVariables(rest[0]);
      if (rest.length >= 2 && Array.isArray(rest[1]) && rest[1].length === 2 && rest[1][0] !== "block") {
        const [param, catchBlock] = rest[1];
        if (param && Array.isArray(param) && param[0] === "object") {
          param.slice(1).forEach((pair) => {
            if (Array.isArray(pair) && pair.length === 2) {
              const varName = pair[1];
              if (typeof varName === "string") {
                this.programVars.add(varName);
              }
            }
          });
        } else if (param && Array.isArray(param) && param[0] === "array") {
          param.slice(1).forEach((item) => {
            if (typeof item === "string") {
              this.programVars.add(item);
            }
          });
        }
        this.collectProgramVariables(catchBlock);
      }
      if (rest.length === 3) {
        this.collectProgramVariables(rest[2]);
      } else if (rest.length === 2 && (!Array.isArray(rest[1]) || rest[1][0] === "block")) {
        this.collectProgramVariables(rest[1]);
      }
      return;
    }
    rest.forEach((item) => this.collectProgramVariables(item));
  }
  collectFunctionVariables(body) {
    const vars = new Set;
    const collect = (sexpr) => {
      if (!Array.isArray(sexpr))
        return;
      let [head, ...rest] = sexpr;
      if (head instanceof String) {
        head = head.valueOf();
      }
      if (Array.isArray(head)) {
        sexpr.forEach((item) => collect(item));
        return;
      }
      if (CodeGenerator.ASSIGNMENT_OPS.has(head)) {
        const [target, value] = rest;
        if (typeof target === "string") {
          vars.add(target);
        } else if (Array.isArray(target) && target[0] === "array") {
          this.collectVarsFromArray(target, vars);
        } else if (Array.isArray(target) && target[0] === "object") {
          this.collectVarsFromObject(target, vars);
        }
        collect(value);
        return;
      }
      if (head === "def" || head === "->" || head === "=>") {
        return;
      }
      if (head === "try") {
        collect(rest[0]);
        if (rest.length >= 2 && Array.isArray(rest[1]) && rest[1].length === 2 && rest[1][0] !== "block") {
          const [param, catchBlock] = rest[1];
          if (param && Array.isArray(param) && param[0] === "object") {
            param.slice(1).forEach((pair) => {
              if (Array.isArray(pair) && pair.length === 2 && typeof pair[1] === "string") {
                vars.add(pair[1]);
              }
            });
          } else if (param && Array.isArray(param) && param[0] === "array") {
            param.slice(1).forEach((item) => {
              if (typeof item === "string") {
                vars.add(item);
              }
            });
          }
          collect(catchBlock);
        }
        if (rest.length === 3) {
          collect(rest[2]);
        } else if (rest.length === 2 && (!Array.isArray(rest[1]) || rest[1][0] === "block")) {
          collect(rest[1]);
        }
        return;
      }
      rest.forEach((item) => collect(item));
    };
    collect(body);
    return vars;
  }
  generate(sexpr, context = "statement") {
    if (sexpr instanceof String) {
      if (sexpr.await === true) {
        const cleanName = sexpr.valueOf();
        return `await ${cleanName}()`;
      }
      if (sexpr.delimiter === "///" && sexpr.heregex) {
        const primitive = sexpr.valueOf();
        const match = primitive.match(/^\/(.*)\/([gimsuvy]*)$/s);
        if (match) {
          const [, pattern, flags] = match;
          const processed = this.processHeregex(pattern);
          return `/${processed}/${flags}`;
        }
        return primitive;
      }
      if (sexpr.quote) {
        const primitive = sexpr.valueOf();
        const originalQuote = sexpr.quote;
        if (originalQuote === '"""' || originalQuote === "'''") {
          let content2 = this.extractStringContent(sexpr);
          content2 = content2.replace(/`/g, "\\`").replace(/\${/g, "\\${");
          return `\`${content2}\``;
        }
        if (primitive[0] === originalQuote) {
          return primitive;
        }
        const content = primitive.slice(1, -1);
        return `${originalQuote}${content}${originalQuote}`;
      }
      sexpr = sexpr.valueOf();
    }
    if (typeof sexpr === "string") {
      if (sexpr.startsWith('"') || sexpr.startsWith("'") || sexpr.startsWith("`")) {
        if (this.options.debug) {
          console.warn("[Rip] Unexpected quoted primitive string (should be String object):", sexpr);
        }
        const content = sexpr.slice(1, -1);
        if (content.includes(`
`)) {
          return `\`${content.replace(/`/g, "\\`").replace(/\$\{/g, "\\${")}\``;
        }
        const preferredDelimiter = content.includes("'") && !content.includes('"') ? '"' : "'";
        const escaped = content.replace(new RegExp(preferredDelimiter, "g"), `\\${preferredDelimiter}`);
        return `${preferredDelimiter}${escaped}${preferredDelimiter}`;
      }
      if (this.reactiveVars?.has(sexpr) && !this.suppressReactiveUnwrap) {
        return `${sexpr}.value`;
      }
      return sexpr;
    }
    if (typeof sexpr === "number") {
      return String(sexpr);
    }
    if (sexpr === null || sexpr === undefined) {
      return "null";
    }
    if (!Array.isArray(sexpr)) {
      throw new Error(`Invalid s-expression: ${JSON.stringify(sexpr)}`);
    }
    let [head, ...rest] = sexpr;
    const headAwaitMetadata = head instanceof String ? head.await : undefined;
    if (head instanceof String) {
      head = head.valueOf();
    }
    const generatorMethod = CodeGenerator.GENERATORS[head];
    if (generatorMethod) {
      return this[generatorMethod](head, rest, context, sexpr);
    }
    if (typeof head === "string" && !head.startsWith('"') && !head.startsWith("'")) {
      if (CodeGenerator.NUMBER_START_REGEX.test(head)) {
        return head;
      }
      if (head === "super" && this.currentMethodName && this.currentMethodName !== "constructor") {
        const args2 = rest.map((arg) => this.unwrap(this.generate(arg, "value"))).join(", ");
        return `super.${this.currentMethodName}(${args2})`;
      }
      if (context === "statement" && rest.length === 1) {
        const conditional = this.findPostfixConditional(rest[0]);
        if (conditional) {
          let argWithoutConditional;
          if (conditional.parentOp) {
            const unwrappedValue = Array.isArray(conditional.value) && conditional.value.length === 1 ? conditional.value[0] : conditional.value;
            argWithoutConditional = [conditional.parentOp, ...conditional.otherOperands, unwrappedValue];
          } else {
            argWithoutConditional = Array.isArray(conditional.value) && conditional.value.length === 1 ? conditional.value[0] : conditional.value;
          }
          const calleeName2 = this.generate(head, "value");
          const condCode = this.generate(conditional.condition, "value");
          const valueCode = this.generate(argWithoutConditional, "value");
          const callStr2 = `${calleeName2}(${valueCode})`;
          if (conditional.type === "unless") {
            return `if (!${condCode}) ${callStr2}`;
          } else {
            return `if (${condCode}) ${callStr2}`;
          }
        }
      }
      const needsAwait = headAwaitMetadata === true;
      const calleeName = this.generate(head, "value");
      const args = rest.map((arg) => this.unwrap(this.generate(arg, "value"))).join(", ");
      const callStr = `${calleeName}(${args})`;
      return needsAwait ? `await ${callStr}` : callStr;
    }
    if (Array.isArray(head) && typeof head[0] === "string") {
      const statementOps = [
        "=",
        "+=",
        "-=",
        "*=",
        "/=",
        "%=",
        "**=",
        "&&=",
        "||=",
        "??=",
        "if",
        "unless",
        "return",
        "throw"
      ];
      if (statementOps.includes(head[0])) {
        const exprs = sexpr.map((stmt) => this.generate(stmt, "value"));
        return `(${exprs.join(", ")})`;
      }
    }
    if (Array.isArray(head)) {
      if (head[0] === "." && (head[2] === "new" || head[2] instanceof String && head[2].valueOf() === "new")) {
        const constructorExpr = head[1];
        const constructorCode = this.generate(constructorExpr, "value");
        const args2 = rest.map((arg) => this.unwrap(this.generate(arg, "value"))).join(", ");
        const needsParens = Array.isArray(constructorExpr);
        const wrappedConstructor = needsParens ? `(${constructorCode})` : constructorCode;
        return `new ${wrappedConstructor}(${args2})`;
      }
      if (context === "statement" && rest.length === 1) {
        const conditional = this.findPostfixConditional(rest[0]);
        if (conditional) {
          let argWithoutConditional;
          if (conditional.parentOp) {
            const unwrappedValue = Array.isArray(conditional.value) && conditional.value.length === 1 ? conditional.value[0] : conditional.value;
            argWithoutConditional = [conditional.parentOp, ...conditional.otherOperands, unwrappedValue];
          } else {
            argWithoutConditional = Array.isArray(conditional.value) && conditional.value.length === 1 ? conditional.value[0] : conditional.value;
          }
          const calleeCode2 = this.generate(head, "value");
          const condCode = this.generate(conditional.condition, "value");
          const valueCode = this.generate(argWithoutConditional, "value");
          const callStr2 = `${calleeCode2}(${valueCode})`;
          if (conditional.type === "unless") {
            return `if (!${condCode}) ${callStr2}`;
          } else {
            return `if (${condCode}) ${callStr2}`;
          }
        }
      }
      let needsAwait = false;
      let calleeCode;
      if (Array.isArray(head) && (head[0] === "." || head[0] === "::") && head[2] instanceof String && head[2].await === true) {
        needsAwait = true;
        const [obj, prop] = head.slice(1);
        const objCode = this.generate(obj, "value");
        const isNumberLiteral = CodeGenerator.NUMBER_LITERAL_REGEX.test(objCode);
        const isObjectLiteral = Array.isArray(obj) && obj[0] === "object";
        const isAwaitOrYield = Array.isArray(obj) && (obj[0] === "await" || obj[0] === "yield");
        const needsParens = isNumberLiteral || isObjectLiteral || isAwaitOrYield;
        const base = needsParens ? `(${objCode})` : objCode;
        const cleanProp = prop.valueOf();
        if (head[0] === "::") {
          calleeCode = `${base}.prototype.${cleanProp}`;
        } else {
          calleeCode = `${base}.${cleanProp}`;
        }
      } else {
        calleeCode = this.generate(head, "value");
      }
      const args = rest.map((arg) => this.unwrap(this.generate(arg, "value"))).join(", ");
      const callStr = `${calleeCode}(${args})`;
      return needsAwait ? `await ${callStr}` : callStr;
    }
    throw new Error(`Unknown s-expression type: ${head}`);
  }
  generateProgram(head, statements, context, sexpr) {
    let code = "";
    const imports = [];
    const exports = [];
    const otherStatements = [];
    statements.forEach((stmt) => {
      if (Array.isArray(stmt)) {
        const head2 = stmt[0];
        if (head2 === "import") {
          imports.push(stmt);
        } else if (head2 === "export" || head2 === "export-default" || head2 === "export-all" || head2 === "export-from") {
          exports.push(stmt);
        } else {
          otherStatements.push(stmt);
        }
      } else {
        otherStatements.push(stmt);
      }
    });
    const statementsCode = otherStatements.map((stmt, index) => {
      const isSingleStmt = otherStatements.length === 1 && imports.length === 0 && exports.length === 0;
      const isObjectLiteral = Array.isArray(stmt) && stmt[0] === "object";
      const isObjectComprehension = isObjectLiteral && stmt.length === 2 && Array.isArray(stmt[1]) && Array.isArray(stmt[1][1]) && stmt[1][1][0] === "comprehension";
      const isAlreadyExpression = Array.isArray(stmt) && (stmt[0] === "comprehension" || stmt[0] === "object-comprehension" || stmt[0] === "do-iife");
      const hasNoVars = this.programVars.size === 0;
      const needsParens = isSingleStmt && isObjectLiteral && hasNoVars && !isAlreadyExpression && !isObjectComprehension;
      const isLastStmt = index === otherStatements.length - 1;
      const isLastComprehension = isLastStmt && isAlreadyExpression;
      let generated;
      if (needsParens) {
        generated = `(${this.generate(stmt, "value")})`;
      } else if (isLastComprehension) {
        generated = this.generate(stmt, "value");
      } else {
        generated = this.generate(stmt, "statement");
      }
      if (generated && !generated.endsWith(";")) {
        const head2 = Array.isArray(stmt) ? stmt[0] : null;
        const blockStatements = ["def", "class", "if", "unless", "for-in", "for-of", "for-from", "while", "until", "loop", "switch", "try"];
        const isBlockStatement = blockStatements.includes(head2);
        if (!isBlockStatement || !generated.endsWith("}")) {
          return generated + ";";
        }
      }
      return generated;
    }).join(`
`);
    let needsBlankLine = false;
    if (imports.length > 0) {
      code += imports.map((stmt) => this.addSemicolon(stmt, this.generate(stmt, "statement"))).join(`
`);
      needsBlankLine = true;
    }
    if (this.programVars.size > 0) {
      const vars = Array.from(this.programVars).sort().join(", ");
      if (needsBlankLine) {
        code += `
`;
      }
      code += `let ${vars};
`;
      needsBlankLine = true;
    }
    if (this.helpers.has("slice")) {
      code += `const slice = [].slice;
`;
      needsBlankLine = true;
    }
    if (this.helpers.has("modulo")) {
      code += `const modulo = (n, d) => { n = +n; d = +d; return (n % d + d) % d; };
`;
      needsBlankLine = true;
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
      needsBlankLine = true;
    }
    if (this.usesReactivity && !this.options.skipReactiveRuntime) {
      code += this.getReactiveRuntime();
      needsBlankLine = true;
    }
    if (this.dataSection !== null && this.dataSection !== undefined) {
      code += `var DATA;
`;
      code += `_setDataSection();
`;
      needsBlankLine = true;
    }
    if (needsBlankLine && code.length > 0) {
      code += `
`;
    }
    code += statementsCode;
    if (exports.length > 0) {
      code += `
` + exports.map((stmt) => this.addSemicolon(stmt, this.generate(stmt, "statement"))).join(`
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
      const [operand] = rest;
      return `(${op}${this.generate(operand, "value")})`;
    }
    const [left2, right2] = rest;
    if (op === "!?") {
      const leftCode = this.generate(left2, "value");
      const rightCode = this.generate(right2, "value");
      return `(${leftCode} !== undefined ? ${leftCode} : ${rightCode})`;
    }
    if (op === "==")
      op = "===";
    if (op === "!=")
      op = "!==";
    return `(${this.generate(left2, "value")} ${op} ${this.generate(right2, "value")})`;
  }
  generateModulo(head, rest, context, sexpr) {
    const [left2, right2] = rest;
    this.helpers.add("modulo");
    return `modulo(${this.generate(left2, "value")}, ${this.generate(right2, "value")})`;
  }
  generateFloorDiv(head, rest, context, sexpr) {
    const [left2, right2] = rest;
    return `Math.floor(${this.generate(left2, "value")} / ${this.generate(right2, "value")})`;
  }
  generateFloorDivAssign(head, rest, context, sexpr) {
    const [target, value] = rest;
    const targetCode = this.generate(target, "value");
    const valueCode = this.generate(value, "value");
    return `${targetCode} = Math.floor(${targetCode} / ${valueCode})`;
  }
  generateAssignment(head, rest, context, sexpr) {
    const [target, value] = rest;
    const op = head === "?=" ? "??=" : head;
    const isFunctionValue = Array.isArray(value) && (value[0] === "->" || value[0] === "=>" || value[0] === "def");
    if (target instanceof String && target.await !== undefined && !isFunctionValue) {
      const sigil = target.await === true ? "!" : "&";
      throw new Error(`Cannot use ${sigil} sigil in variable declaration '${target.valueOf()}'. Sigils are only for call-sites.`);
    }
    const targetHasVoidSigil = target instanceof String && target.await === true;
    if (targetHasVoidSigil && isFunctionValue) {
      this.nextFunctionIsVoid = true;
    }
    const isEmptyArray = Array.isArray(target) && target[0] === "array" && target.length === 1;
    const isEmptyObject = Array.isArray(target) && target[0] === "object" && target.length === 1;
    if (isEmptyArray || isEmptyObject) {
      const valueCode2 = this.generate(value, "value");
      if (isEmptyObject && context === "statement") {
        return `(${valueCode2})`;
      }
      return valueCode2;
    }
    if (Array.isArray(target) && target[0] === "array") {
      const restIndex = target.slice(1).findIndex((el) => Array.isArray(el) && el[0] === "..." || el === "...");
      if (restIndex !== -1 && restIndex < target.length - 2) {
        const elements = target.slice(1);
        const elementsAfterRest = elements.slice(restIndex + 1);
        const afterCount = elementsAfterRest.length;
        if (afterCount > 0) {
          const valueCode2 = this.generate(value, "value");
          const beforeRest = elements.slice(0, restIndex);
          const beforePattern = beforeRest.map((el) => {
            if (el === ",")
              return "";
            if (typeof el === "string")
              return el;
            return this.generate(el, "value");
          }).join(", ");
          const afterPattern = elementsAfterRest.map((el) => {
            if (el === ",")
              return "";
            if (typeof el === "string")
              return el;
            return this.generate(el, "value");
          }).join(", ");
          this.helpers.add("slice");
          const collectVars = (els) => {
            els.forEach((el) => {
              if (el === "," || el === "...")
                return;
              if (typeof el === "string")
                this.programVars.add(el);
              else if (Array.isArray(el) && el[0] === "...") {
                if (typeof el[1] === "string")
                  this.programVars.add(el[1]);
              }
            });
          };
          collectVars(elements);
          const restElement = elements[restIndex];
          const restVarName = Array.isArray(restElement) && restElement[0] === "..." ? restElement[1] : null;
          const statements = [];
          if (beforePattern) {
            statements.push(`[${beforePattern}] = ${valueCode2}`);
          }
          if (restVarName) {
            statements.push(`[...${restVarName}] = ${valueCode2}.slice(${restIndex}, -${afterCount})`);
          }
          statements.push(`[${afterPattern}] = slice.call(${valueCode2}, -${afterCount})`);
          return statements.join(", ");
        }
      }
    }
    if (context === "statement" && head === "=" && Array.isArray(value) && (value[0] === "||" || value[0] === "&&") && value.length === 3) {
      const [binaryOp, left2, right2] = value;
      if (Array.isArray(right2) && (right2[0] === "unless" || right2[0] === "if") && right2.length === 3) {
        const [condType, condition, wrappedValue] = right2;
        const unwrappedValue = Array.isArray(wrappedValue) && wrappedValue.length === 1 ? wrappedValue[0] : wrappedValue;
        const fullValue = [binaryOp, left2, unwrappedValue];
        const targetCode2 = this.generate(target, "value");
        const condCode = this.generate(condition, "value");
        const valueCode2 = this.generate(fullValue, "value");
        if (condType === "unless") {
          return `if (!${condCode}) ${targetCode2} = ${valueCode2}`;
        } else {
          return `if (${condCode}) ${targetCode2} = ${valueCode2}`;
        }
      }
    }
    if (context === "statement" && head === "=" && Array.isArray(value) && value.length === 3) {
      const valueHead = value[0];
      const [_, condition, actualValue] = value;
      const isPostfix = Array.isArray(actualValue) && actualValue.length === 1 && (!Array.isArray(actualValue[0]) || actualValue[0][0] !== "block");
      if ((valueHead === "unless" || valueHead === "if") && isPostfix) {
        let unwrappedValue = actualValue;
        if (Array.isArray(actualValue) && actualValue.length === 1) {
          unwrappedValue = actualValue[0];
        }
        const targetCode2 = this.generate(target, "value");
        let condCode = this.unwrapLogical(this.generate(condition, "value"));
        const valueCode2 = this.generate(unwrappedValue, "value");
        if (valueHead === "unless") {
          if (condCode.includes(" ") || condCode.includes("===") || condCode.includes("!==") || condCode.includes(">") || condCode.includes("<") || condCode.includes("&&") || condCode.includes("||")) {
            condCode = `(${condCode})`;
          }
          return `if (!${condCode}) ${targetCode2} = ${valueCode2}`;
        } else {
          return `if (${condCode}) ${targetCode2} = ${valueCode2}`;
        }
      }
    }
    let targetCode;
    if (target instanceof String && target.await !== undefined) {
      targetCode = target.valueOf();
    } else if (typeof target === "string" && this.reactiveVars?.has(target)) {
      targetCode = `${target}.value`;
    } else {
      this.suppressReactiveUnwrap = true;
      targetCode = this.generate(target, "value");
      this.suppressReactiveUnwrap = false;
    }
    let valueCode = this.generate(value, "value");
    const isObjectLiteral = Array.isArray(value) && value[0] === "object";
    if (!isObjectLiteral) {
      valueCode = this.unwrap(valueCode);
    }
    const needsParensForValue = context === "value";
    const needsParensForObject = context === "statement" && Array.isArray(target) && target[0] === "object";
    if (needsParensForValue || needsParensForObject) {
      return `(${targetCode} ${op} ${valueCode})`;
    }
    return `${targetCode} ${op} ${valueCode}`;
  }
  generatePropertyAccess(head, rest, context, sexpr) {
    const [obj, prop] = rest;
    this.suppressReactiveUnwrap = true;
    const objCode = this.generate(obj, "value");
    this.suppressReactiveUnwrap = false;
    const isNumberLiteral = CodeGenerator.NUMBER_LITERAL_REGEX.test(objCode);
    const isObjectLiteral = Array.isArray(obj) && obj[0] === "object";
    const isAwaitOrYield = Array.isArray(obj) && (obj[0] === "await" || obj[0] === "yield");
    const needsParens = isNumberLiteral || isObjectLiteral || isAwaitOrYield;
    const base = needsParens ? `(${objCode})` : objCode;
    if (prop instanceof String && prop.await === true) {
      const cleanProp2 = prop.valueOf();
      return `await ${base}.${cleanProp2}()`;
    }
    const cleanProp = prop instanceof String ? prop.valueOf() : prop;
    return `${base}.${cleanProp}`;
  }
  generateOptionalProperty(head, rest, context, sexpr) {
    const [obj, prop] = rest;
    return `${this.generate(obj, "value")}?.${prop}`;
  }
  generatePrototype(head, rest, context, sexpr) {
    const [obj, prop] = rest;
    const objCode = this.generate(obj, "value");
    if (prop === "prototype") {
      return `${objCode}.prototype`;
    }
    const cleanProp = prop instanceof String ? prop.valueOf() : prop;
    return `${objCode}.prototype.${cleanProp}`;
  }
  generateOptionalPrototype(head, rest, context, sexpr) {
    const [obj, prop] = rest;
    const objCode = this.generate(obj, "value");
    if (prop === "prototype") {
      return `(${objCode} != null ? ${objCode}.prototype : undefined)`;
    }
    return `(${objCode} != null ? ${objCode}.prototype.${prop} : undefined)`;
  }
  generateRegexIndex(head, rest, context, sexpr) {
    const [value, regex, captureIndex] = rest;
    this.helpers.add("toSearchable");
    this.programVars.add("_");
    const valueCode = this.generate(value, "value");
    const regexCode = this.generate(regex, "value");
    const indexCode = captureIndex !== null ? this.generate(captureIndex, "value") : "0";
    const hasMultilineFlag = regexCode.includes("/m");
    const allowNewlines = hasMultilineFlag ? ", true" : "";
    return `(_ = toSearchable(${valueCode}${allowNewlines}).match(${regexCode})) && _[${indexCode}]`;
  }
  generateIndexAccess(head, rest, context, sexpr) {
    const [arr, index] = rest;
    if (Array.isArray(index) && (index[0] === ".." || index[0] === "...")) {
      const isInclusive = index[0] === "..";
      const arrCode = this.generate(arr, "value");
      const [start, end] = index.slice(1);
      if (start === null && end === null) {
        return `${arrCode}.slice()`;
      } else if (start === null) {
        if (isInclusive && this.isNegativeOneLiteral(end)) {
          return `${arrCode}.slice(0)`;
        }
        const endCode = this.generate(end, "value");
        if (isInclusive) {
          return `${arrCode}.slice(0, +${endCode} + 1 || 9e9)`;
        } else {
          return `${arrCode}.slice(0, ${endCode})`;
        }
      } else if (end === null) {
        const startCode = this.generate(start, "value");
        return `${arrCode}.slice(${startCode})`;
      } else {
        const startCode = this.generate(start, "value");
        if (isInclusive && this.isNegativeOneLiteral(end)) {
          return `${arrCode}.slice(${startCode})`;
        }
        const endCode = this.generate(end, "value");
        if (isInclusive) {
          return `${arrCode}.slice(${startCode}, +${endCode} + 1 || 9e9)`;
        } else {
          return `${arrCode}.slice(${startCode}, ${endCode})`;
        }
      }
    }
    const indexCode = this.unwrap(this.generate(index, "value"));
    return `${this.generate(arr, "value")}[${indexCode}]`;
  }
  generateSoakIndex(head, rest, context, sexpr) {
    const [arr, index] = rest;
    const arrCode = this.generate(arr, "value");
    const indexCode = this.generate(index, "value");
    return `(${arrCode} != null ? ${arrCode}[${indexCode}] : undefined)`;
  }
  generateOptIndex(head, rest, context, sexpr) {
    const [arr, index] = rest;
    const arrCode = this.generate(arr, "value");
    const indexCode = this.generate(index, "value");
    return `${arrCode}?.[${indexCode}]`;
  }
  generateOptCall(head, rest, context, sexpr) {
    const [fn, ...args] = rest;
    const fnCode = this.generate(fn, "value");
    const argsCode = args.map((arg) => this.generate(arg, "value")).join(", ");
    return `${fnCode}?.(${argsCode})`;
  }
  generateDef(head, rest, context, sexpr) {
    const [name, params, body] = rest;
    const sideEffectOnly = name instanceof String && name.await === true;
    const cleanName = name instanceof String ? name.valueOf() : name;
    const paramList = this.generateParamList(params);
    const bodyCode = this.generateFunctionBody(body, params, sideEffectOnly);
    const isAsync = this.containsAwait(body);
    const isGenerator = this.containsYield(body);
    const asyncPrefix = isAsync ? "async " : "";
    const generatorSuffix = isGenerator ? "*" : "";
    return `${asyncPrefix}function${generatorSuffix} ${cleanName}(${paramList}) ${bodyCode}`;
  }
  generateThinArrow(head, rest, context, sexpr) {
    const [params, body] = rest;
    const sideEffectOnly = this.nextFunctionIsVoid || false;
    this.nextFunctionIsVoid = false;
    const paramList = this.generateParamList(params);
    const bodyCode = this.generateFunctionBody(body, params, sideEffectOnly);
    const isAsync = this.containsAwait(body);
    const isGenerator = this.containsYield(body);
    const asyncPrefix = isAsync ? "async " : "";
    const generatorSuffix = isGenerator ? "*" : "";
    const fnCode = `${asyncPrefix}function${generatorSuffix}(${paramList}) ${bodyCode}`;
    return context === "value" ? `(${fnCode})` : fnCode;
  }
  generateFatArrow(head, rest, context, sexpr) {
    const [params, body] = rest;
    const sideEffectOnly = this.nextFunctionIsVoid || false;
    this.nextFunctionIsVoid = false;
    const paramList = this.generateParamList(params);
    const isSingleSimpleParam = params.length === 1 && typeof params[0] === "string" && !paramList.includes("=") && !paramList.includes("...") && !paramList.includes("[") && !paramList.includes("{");
    const paramSyntax = isSingleSimpleParam ? paramList : `(${paramList})`;
    const isAsync = this.containsAwait(body);
    const asyncPrefix = isAsync ? "async " : "";
    if (!sideEffectOnly) {
      if (Array.isArray(body) && body[0] === "block" && body.length === 2) {
        const expr = body[1];
        if (!Array.isArray(expr) || expr[0] !== "return") {
          return `${asyncPrefix}${paramSyntax} => ${this.generate(expr, "value")}`;
        }
      }
      if (!Array.isArray(body) || body[0] !== "block") {
        return `${asyncPrefix}${paramSyntax} => ${this.generate(body, "value")}`;
      }
    }
    const bodyCode = this.generateFunctionBody(body, params, sideEffectOnly);
    return `${asyncPrefix}${paramSyntax} => ${bodyCode}`;
  }
  generateReturn(head, rest, context, sexpr) {
    if (rest.length === 0) {
      return "return";
    }
    let [expr] = rest;
    if (this.sideEffectOnly) {
      return "return";
    }
    if (Array.isArray(expr) && expr[0] === "unless") {
      const [, condition, body] = expr;
      const value = Array.isArray(body) && body.length === 1 ? body[0] : body;
      return `if (!${this.generate(condition, "value")}) return ${this.generate(value, "value")}`;
    }
    if (Array.isArray(expr) && expr[0] === "if") {
      const [, condition, body, ...elseParts] = expr;
      if (elseParts.length === 0) {
        const value = Array.isArray(body) && body.length === 1 ? body[0] : body;
        return `if (${this.generate(condition, "value")}) return ${this.generate(value, "value")}`;
      }
    }
    if (Array.isArray(expr) && expr[0] === "new" && Array.isArray(expr[1]) && expr[1][0] === "unless") {
      const [, unlessNode] = expr;
      const [, condition, body] = unlessNode;
      const value = Array.isArray(body) && body.length === 1 ? body[0] : body;
      return `if (!${this.generate(condition, "value")}) return ${this.generate(["new", value], "value")}`;
    }
    return `return ${this.generate(expr, "value")}`;
  }
  generateSignal(head, rest, context, sexpr) {
    const [name, expr] = rest;
    this.usesReactivity = true;
    const varName = typeof name === "string" ? name : name.valueOf();
    const exprCode = this.generate(expr, "value");
    if (!this.reactiveVars)
      this.reactiveVars = new Set;
    this.reactiveVars.add(varName);
    return `const ${varName} = __signal(${exprCode})`;
  }
  generateDerived(head, rest, context, sexpr) {
    const [name, expr] = rest;
    this.usesReactivity = true;
    if (!this.reactiveVars)
      this.reactiveVars = new Set;
    const varName = typeof name === "string" ? name : name.valueOf();
    this.reactiveVars.add(varName);
    const exprCode = this.generate(expr, "value");
    return `const ${varName} = __computed(() => ${exprCode})`;
  }
  generateReadonly(head, rest, context, sexpr) {
    const [name, expr] = rest;
    this.usesReactivity = true;
    const varName = Array.isArray(name) ? name[1] : name;
    const exprCode = this.generate(expr, "value");
    return `const ${varName} = __readonly(${exprCode})`;
  }
  generateExposed(head, rest, context, sexpr) {
    const [name, expr] = rest;
    const varName = typeof name === "string" ? name : name.valueOf();
    if (Array.isArray(expr) && (expr[0] === "->" || expr[0] === "=>")) {
      const funcCode = this.generate(expr, "value");
      return `const ${varName} = ${funcCode}`;
    }
    const exprCode = this.generate(expr, "value");
    return `const ${varName} = () => ${exprCode}`;
  }
  generateEffect(head, rest, context, sexpr) {
    const [body] = rest;
    this.usesReactivity = true;
    let bodyCode;
    if (Array.isArray(body) && body[0] === "block") {
      const statements = body.slice(1);
      const stmts = this.withIndent(() => this.formatStatements(statements));
      bodyCode = `{
${stmts.join(`
`)}
${this.indent()}}`;
    } else if (Array.isArray(body) && (body[0] === "->" || body[0] === "=>")) {
      const fnCode = this.generate(body, "value");
      return `__effect(${fnCode})`;
    } else {
      bodyCode = `{ ${this.generate(body, "value")}; }`;
    }
    return `__effect(() => ${bodyCode})`;
  }
  isHtmlTag(name) {
    const tagPart = name.split("#")[0];
    return HTML_TAGS.has(tagPart.toLowerCase());
  }
  isComponent(name) {
    if (!name || typeof name !== "string")
      return false;
    return /^[A-Z]/.test(name);
  }
  parseEventHandler(key2, value) {
    if (Array.isArray(key2) && key2[0] === "." && key2[1] === "this" && typeof key2[2] === "string") {
      return { eventName: key2[2], modifiers: [], handler: this.generate(value, "value") };
    }
    if (Array.isArray(key2) && key2[0] === "computed") {
      const { eventName, modifiers } = this.extractEventChain(key2[1]);
      if (eventName) {
        return { eventName, modifiers, handler: this.generate(value, "value") };
      }
    }
    return null;
  }
  extractEventChain(chain) {
    const modifiers = [];
    let current = chain;
    while (Array.isArray(current) && current[0] === ".") {
      const [, inner, prop] = current;
      if (Array.isArray(inner) && inner[0] === "." && inner[1] === "this") {
        modifiers.unshift(prop);
        return { eventName: inner[2], modifiers };
      }
      if (typeof prop === "string")
        modifiers.unshift(prop);
      current = inner;
    }
    if (Array.isArray(current) && current[0] === "." && current[1] === "this") {
      return { eventName: current[2], modifiers };
    }
    return { eventName: null, modifiers: [] };
  }
  wrapEventHandler(handler, modifiers) {
    if (modifiers.length === 0)
      return handler;
    const checks = [];
    const actions = [];
    for (const mod of modifiers) {
      switch (mod) {
        case "prevent":
          actions.push("e.preventDefault()");
          break;
        case "stop":
          actions.push("e.stopPropagation()");
          break;
        case "self":
          checks.push("if (e.target !== e.currentTarget) return");
          break;
        case "enter":
          checks.push("if (e.key !== 'Enter') return");
          break;
        case "escape":
        case "esc":
          checks.push("if (e.key !== 'Escape') return");
          break;
        case "tab":
          checks.push("if (e.key !== 'Tab') return");
          break;
        case "space":
          checks.push("if (e.key !== ' ') return");
          break;
        case "up":
          checks.push("if (e.key !== 'ArrowUp') return");
          break;
        case "down":
          checks.push("if (e.key !== 'ArrowDown') return");
          break;
        case "left":
          checks.push("if (e.key !== 'ArrowLeft') return");
          break;
        case "right":
          checks.push("if (e.key !== 'ArrowRight') return");
          break;
        case "ctrl":
          checks.push("if (!e.ctrlKey) return");
          break;
        case "alt":
          checks.push("if (!e.altKey) return");
          break;
        case "shift":
          checks.push("if (!e.shiftKey) return");
          break;
        case "meta":
          checks.push("if (!e.metaKey) return");
          break;
      }
    }
    const body = [...checks, ...actions, `(${handler})(e)`].join("; ");
    return `(e) => { ${body}; }`;
  }
  static BIND_PREFIX = "__bind_";
  static BIND_SUFFIX = "__";
  parseBindingDirective(key2, value, tag) {
    let prop;
    if (typeof key2 === "string" && key2.startsWith(CodeGenerator.BIND_PREFIX) && key2.endsWith(CodeGenerator.BIND_SUFFIX)) {
      prop = key2.slice(CodeGenerator.BIND_PREFIX.length, -CodeGenerator.BIND_SUFFIX.length);
    } else if (Array.isArray(key2) && key2[0] === "computed") {
      const chain = key2[1];
      if (!Array.isArray(chain) || chain[0] !== ".")
        return null;
      const [, inner, propName] = chain;
      if (!Array.isArray(inner) || inner[0] !== "." || inner[1] !== "this" || inner[2] !== "bind") {
        return null;
      }
      prop = typeof propName === "string" ? propName : String(propName);
    } else {
      return null;
    }
    const varName = this.generate(value, "value");
    let event, valueAccessor;
    if (prop === "checked") {
      event = "onchange";
      valueAccessor = "e.target.checked";
    } else if (prop === "value") {
      if (tag === "select") {
        event = "onchange";
      } else {
        event = "oninput";
      }
      valueAccessor = "e.target.value";
    } else {
      event = "oninput";
      valueAccessor = `e.target.${prop}`;
    }
    return {
      prop,
      event,
      valueExpr: varName,
      handler: `(e) => ${varName} = ${valueAccessor}`
    };
  }
  generateRender(head, rest, context, sexpr) {
    const [body] = rest;
    this.usesTemplates = true;
    if (!Array.isArray(body) || body[0] !== "block") {
      return this.generateTemplateElement(body);
    }
    const statements = body.slice(1);
    if (statements.length === 0)
      return "null";
    if (statements.length === 1)
      return this.generateTemplateElement(statements[0]);
    const elements = statements.map((s) => this.generateTemplateElement(s));
    return `frag(${elements.join(", ")})`;
  }
  generateStyle(head, rest, context, sexpr) {
    return "/* style block placeholder */";
  }
  generateComponent(head, rest, context, sexpr) {
    const [name, body] = rest;
    const componentName = typeof name === "string" ? name : this.generate(name, "value");
    this.usesTemplates = true;
    const statements = Array.isArray(body) && body[0] === "block" ? body.slice(1) : [];
    const props = [];
    const stateVars = [];
    const derivedVars = [];
    const readonlyVars = [];
    const exposedMethods = [];
    const methods = [];
    const lifecycleHooks = [];
    const effects = [];
    let renderBlock = null;
    let styleBlock = null;
    const memberNames = new Set;
    const reactiveMembers = new Set;
    for (const stmt of statements) {
      if (!Array.isArray(stmt))
        continue;
      const [op] = stmt;
      if (op === "prop") {
        props.push(stmt);
        memberNames.add(stmt[1]);
      } else if (op === "prop-rest") {
        props.push(stmt);
        memberNames.add(stmt[1]);
      } else if (op === "=" && typeof stmt[1] === "string") {
        const varName = stmt[1];
        if (["mounted", "unmounted", "updated"].includes(varName)) {
          lifecycleHooks.push(stmt);
        } else {
          stateVars.push(stmt);
          memberNames.add(varName);
          reactiveMembers.add(varName);
        }
      } else if (op === "signal") {
        stateVars.push(stmt);
        memberNames.add(stmt[1]);
        reactiveMembers.add(stmt[1]);
      } else if (op === "derived") {
        derivedVars.push(stmt);
        memberNames.add(stmt[1]);
        reactiveMembers.add(stmt[1]);
      } else if (op === "readonly") {
        readonlyVars.push(stmt);
        memberNames.add(stmt[1]);
      } else if (op === "exposed") {
        exposedMethods.push(stmt);
        memberNames.add(stmt[1]);
      } else if (op === "effect") {
        effects.push(stmt);
      } else if (op === "render") {
        renderBlock = stmt;
      } else if (op === "style") {
        styleBlock = stmt;
      } else if (op === "object" && stmt.length >= 2) {
        methods.push(stmt);
        for (let i = 1;i < stmt.length; i++) {
          if (Array.isArray(stmt[i]))
            memberNames.add(stmt[i][0]);
        }
      }
    }
    const prevComponentMembers = this.componentMembers;
    const prevReactiveMembers = this.reactiveMembers;
    this.componentMembers = memberNames;
    this.reactiveMembers = reactiveMembers;
    const lines = [];
    let blockFactoriesCode = "";
    lines.push(`class ${componentName} {`);
    lines.push("  constructor(props = {}) {");
    lines.push("    // Context API: track parent component");
    lines.push("    this._parent = __currentComponent;");
    lines.push("    const __prevComponent = __currentComponent;");
    lines.push("    __currentComponent = this;");
    lines.push("");
    if (props.length > 0) {
      for (const prop of props) {
        if (prop[0] === "prop") {
          const propName = prop[1];
          if (prop.length === 2) {
            lines.push(`    if (props.${propName} === undefined) throw new Error('Required prop: ${propName}');`);
            lines.push(`    this.${propName} = props.${propName};`);
          } else if (prop[2] === "optional") {
            lines.push(`    this.${propName} = props.${propName};`);
          } else {
            const defaultVal = this.generateInComponent(prop[2], "value");
            lines.push(`    this.${propName} = props.${propName} ?? ${defaultVal};`);
          }
        } else if (prop[0] === "prop-rest") {
          const restName = prop[1];
          const propNames = props.filter((p) => p[0] === "prop").map((p) => p[1]);
          lines.push(`    const { ${propNames.join(", ")}, ...${restName} } = props;`);
          lines.push(`    this.${restName} = ${restName};`);
        }
      }
    }
    for (const [, varName, value] of readonlyVars) {
      const val = this.generateInComponent(value, "value");
      lines.push(`    this.${varName} = ${val};`);
    }
    this.usesReactivity = true;
    for (const stmt of stateVars) {
      if (stmt[0] === "signal") {
        const [, varName, value] = stmt;
        const val = this.generateInComponent(value, "value");
        lines.push(`    this.${varName} = __signal(${val});`);
      } else {
        const [, varName, value] = stmt;
        const val = this.generateInComponent(value, "value");
        lines.push(`    this.${varName} = __signal(${val});`);
      }
    }
    for (const [, varName, expr] of derivedVars) {
      const val = this.generateInComponent(expr, "value");
      lines.push(`    this.${varName} = __computed(() => ${val});`);
    }
    for (const effect of effects) {
      const body2 = effect[1];
      const effectCode = this.generateInComponent(body2, "value");
      lines.push(`    __effect(${effectCode});`);
    }
    lines.push("");
    lines.push("    __currentComponent = __prevComponent;");
    lines.push("  }");
    for (const methodStmt of methods) {
      for (let i = 1;i < methodStmt.length; i++) {
        const [methodName, funcDef] = methodStmt[i];
        if (Array.isArray(funcDef) && (funcDef[0] === "->" || funcDef[0] === "=>")) {
          const [, params, body2] = funcDef;
          const paramStr = Array.isArray(params) ? params.map((p) => this.formatParam(p)).join(", ") : "";
          const bodyCode = this.generateInComponent(body2, "value");
          lines.push(`  ${methodName}(${paramStr}) { return ${bodyCode}; }`);
        }
      }
    }
    for (const [, methodName, expr] of exposedMethods) {
      if (Array.isArray(expr) && (expr[0] === "->" || expr[0] === "=>")) {
        const [, params, body2] = expr;
        const paramStr = Array.isArray(params) ? params.map((p) => this.formatParam(p)).join(", ") : "";
        const bodyCode = this.generateInComponent(body2, "value");
        lines.push(`  ${methodName}(${paramStr}) { return ${bodyCode}; }`);
      } else {
        const bodyCode = this.generateInComponent(expr, "value");
        lines.push(`  ${methodName}() { return ${bodyCode}; }`);
      }
    }
    if (exposedMethods.length > 0) {
      const exposedNames = exposedMethods.map(([, name2]) => `'${name2}'`).join(", ");
      lines.push(`  static __exposed__ = new Set([${exposedNames}]);`);
    }
    for (const [, hookName, hookValue] of lifecycleHooks) {
      if (Array.isArray(hookValue) && (hookValue[0] === "->" || hookValue[0] === "=>")) {
        const [, params, body2] = hookValue;
        const bodyCode = this.generateInComponent(body2, "value");
        lines.push(`  ${hookName}() { return ${bodyCode}; }`);
      }
    }
    if (renderBlock) {
      const renderBody = renderBlock[1];
      const fg = this.generateFineGrainedRender(renderBody);
      if (fg.blockFactories.length > 0) {
        blockFactoriesCode = fg.blockFactories.join(`

`) + `

`;
      }
      lines.push("  _create() {");
      for (const line of fg.createLines) {
        lines.push(`    ${line}`);
      }
      lines.push(`    return ${fg.rootVar};`);
      lines.push("  }");
      if (fg.setupLines.length > 0) {
        lines.push("  _setup() {");
        for (const line of fg.setupLines) {
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
    return blockFactoriesCode + lines.join(`
`);
  }
  generateInComponent(sexpr, context) {
    if (typeof sexpr === "string" && this.reactiveMembers && this.reactiveMembers.has(sexpr)) {
      return `this.${sexpr}.value`;
    }
    if (Array.isArray(sexpr) && this.reactiveMembers) {
      const transformed = this.transformComponentMembers(sexpr);
      return this.generate(transformed, context);
    }
    return this.generate(sexpr, context);
  }
  transformComponentMembers(sexpr) {
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
  }
  generateComponentRender(body) {
    if (!Array.isArray(body) || body[0] !== "block") {
      return this.generateComponentTemplateElement(body);
    }
    const statements = body.slice(1);
    if (statements.length === 0)
      return "null";
    if (statements.length === 1)
      return this.generateComponentTemplateElement(statements[0]);
    const elements = statements.map((s) => this.generateComponentTemplateElement(s));
    return `frag(${elements.join(", ")})`;
  }
  generateFineGrainedRender(body) {
    this._fgElementCount = 0;
    this._fgTextCount = 0;
    this._fgBlockCount = 0;
    this._fgCreateLines = [];
    this._fgSetupLines = [];
    this._fgBlockFactories = [];
    const statements = Array.isArray(body) && body[0] === "block" ? body.slice(1) : [body];
    let rootVar;
    if (statements.length === 0) {
      rootVar = "null";
    } else if (statements.length === 1) {
      rootVar = this.fgProcessElement(statements[0]);
    } else {
      rootVar = this.fgNewElement("frag");
      this._fgCreateLines.push(`${rootVar} = document.createDocumentFragment();`);
      for (const stmt of statements) {
        const childVar = this.fgProcessElement(stmt);
        this._fgCreateLines.push(`${rootVar}.appendChild(${childVar});`);
      }
    }
    return {
      createLines: this._fgCreateLines,
      setupLines: this._fgSetupLines,
      blockFactories: this._fgBlockFactories,
      rootVar
    };
  }
  fgNewBlock() {
    return `create_block_${this._fgBlockCount++}`;
  }
  fgNewElement(hint = "el") {
    return `this._${hint}${this._fgElementCount++}`;
  }
  fgNewText() {
    return `this._t${this._fgTextCount++}`;
  }
  fgProcessElement(sexpr) {
    if (typeof sexpr === "string" || sexpr instanceof String) {
      const str = sexpr.valueOf();
      if (str.startsWith('"') || str.startsWith("'") || str.startsWith("`")) {
        const textVar = this.fgNewText();
        this._fgCreateLines.push(`${textVar} = document.createTextNode(${str});`);
        return textVar;
      }
      if (this.reactiveMembers && this.reactiveMembers.has(str)) {
        const textVar = this.fgNewText();
        this._fgCreateLines.push(`${textVar} = document.createTextNode('');`);
        this._fgSetupLines.push(`__effect(() => { ${textVar}.data = this.${str}.value; });`);
        return textVar;
      }
      const elVar = this.fgNewElement();
      this._fgCreateLines.push(`${elVar} = document.createElement('${str}');`);
      return elVar;
    }
    if (Array.isArray(sexpr)) {
      const [head, ...rest] = sexpr;
      const headStr = typeof head === "string" ? head : head instanceof String ? head.valueOf() : null;
      if (headStr && this.isComponent(headStr)) {
        return this.fgProcessComponent(headStr, rest);
      }
      if (headStr && this.isHtmlTag(headStr)) {
        return this.fgProcessTag(headStr, [], rest);
      }
      if (headStr === ".") {
        const [, obj, prop] = sexpr;
        if (obj === "this" && typeof prop === "string") {
          if (this.reactiveMembers && this.reactiveMembers.has(prop)) {
            const textVar3 = this.fgNewText();
            this._fgCreateLines.push(`${textVar3} = document.createTextNode('');`);
            this._fgSetupLines.push(`__effect(() => { ${textVar3}.data = this.${prop}.value; });`);
            return textVar3;
          }
          if (this.componentMembers && this.componentMembers.has(prop)) {
            const slotVar = this.fgNewElement("slot");
            this._fgCreateLines.push(`${slotVar} = this.${prop} instanceof Node ? this.${prop} : (this.${prop} != null ? document.createTextNode(String(this.${prop})) : document.createComment(''));`);
            return slotVar;
          }
        }
        const { tag, classes } = this.collectTemplateClasses(sexpr);
        if (tag && this.isHtmlTag(tag)) {
          return this.fgProcessTag(tag, classes, []);
        }
        const textVar2 = this.fgNewText();
        const exprCode2 = this.generateInComponent(sexpr, "value");
        this._fgCreateLines.push(`${textVar2} = document.createTextNode(String(${exprCode2}));`);
        return textVar2;
      }
      if (Array.isArray(head)) {
        if (Array.isArray(head[0]) && head[0][0] === "." && (head[0][2] === "__cx__" || head[0][2] instanceof String && head[0][2].valueOf() === "__cx__")) {
          const tag2 = typeof head[0][1] === "string" ? head[0][1] : head[0][1].valueOf();
          const classExprs = head.slice(1);
          return this.fgProcessTagWithDynamicClass(tag2, classExprs, rest);
        }
        const { tag, classes } = this.collectTemplateClasses(head);
        if (tag && this.isHtmlTag(tag)) {
          if (classes.length === 1 && classes[0] === "__cx__") {
            return this.fgProcessTagWithDynamicClass(tag, rest, []);
          }
          return this.fgProcessTag(tag, classes, rest);
        }
      }
      if (headStr === "->" || headStr === "=>") {
        const [params, body] = rest;
        return this.fgProcessBlock(body);
      }
      if (headStr === "if") {
        return this.fgProcessConditional(sexpr);
      }
      if (headStr === "for" || headStr === "for-in" || headStr === "for-of") {
        return this.fgProcessLoop(sexpr);
      }
      const textVar = this.fgNewText();
      const exprCode = this.generateInComponent(sexpr, "value");
      if (this.fgHasReactiveDeps(sexpr)) {
        this._fgCreateLines.push(`${textVar} = document.createTextNode('');`);
        this._fgSetupLines.push(`__effect(() => { ${textVar}.data = ${exprCode}; });`);
      } else {
        this._fgCreateLines.push(`${textVar} = document.createTextNode(String(${exprCode}));`);
      }
      return textVar;
    }
    const commentVar = this.fgNewElement("c");
    this._fgCreateLines.push(`${commentVar} = document.createComment('unknown');`);
    return commentVar;
  }
  fgProcessTagWithDynamicClass(tag, classExprs, children) {
    const elVar = this.fgNewElement();
    this._fgCreateLines.push(`${elVar} = document.createElement('${tag}');`);
    if (classExprs.length > 0) {
      const classCode = classExprs.map((e) => this.generateInComponent(e, "value")).join(' + " " + ');
      const hasReactiveDeps = classExprs.some((e) => this.fgHasReactiveDeps(e));
      if (hasReactiveDeps) {
        this._fgSetupLines.push(`__effect(() => { ${elVar}.className = ${classCode}; });`);
      } else {
        this._fgCreateLines.push(`${elVar}.className = ${classCode};`);
      }
    }
    for (const arg of children) {
      const argHead = Array.isArray(arg) ? arg[0] instanceof String ? arg[0].valueOf() : arg[0] : null;
      if (argHead === "->" || argHead === "=>") {
        const block = arg[2];
        const blockHead = Array.isArray(block) ? block[0] instanceof String ? block[0].valueOf() : block[0] : null;
        if (blockHead === "block") {
          for (const child of block.slice(1)) {
            const childVar = this.fgProcessElement(child);
            this._fgCreateLines.push(`${elVar}.appendChild(${childVar});`);
          }
        } else if (block) {
          const childVar = this.fgProcessElement(block);
          this._fgCreateLines.push(`${elVar}.appendChild(${childVar});`);
        }
      } else if (Array.isArray(arg) && arg[0] === "object") {
        this.fgProcessAttributes(elVar, arg);
      } else if (typeof arg === "string" || arg instanceof String) {
        const textVar = this.fgNewText();
        const argStr = arg.valueOf();
        if (argStr.startsWith('"') || argStr.startsWith("'") || argStr.startsWith("`")) {
          this._fgCreateLines.push(`${textVar} = document.createTextNode(${argStr});`);
        } else if (this.reactiveMembers && this.reactiveMembers.has(argStr)) {
          this._fgCreateLines.push(`${textVar} = document.createTextNode('');`);
          this._fgSetupLines.push(`__effect(() => { ${textVar}.data = this.${argStr}.value; });`);
        } else {
          this._fgCreateLines.push(`${textVar} = document.createTextNode(${this.generateInComponent(arg, "value")});`);
        }
        this._fgCreateLines.push(`${elVar}.appendChild(${textVar});`);
      } else {
        const childVar = this.fgProcessElement(arg);
        this._fgCreateLines.push(`${elVar}.appendChild(${childVar});`);
      }
    }
    return elVar;
  }
  fgProcessTag(tag, classes, args) {
    const elVar = this.fgNewElement();
    this._fgCreateLines.push(`${elVar} = document.createElement('${tag}');`);
    if (classes.length > 0) {
      this._fgCreateLines.push(`${elVar}.className = '${classes.join(" ")}';`);
    }
    for (const arg of args) {
      if (Array.isArray(arg) && (arg[0] === "->" || arg[0] === "=>")) {
        const block = arg[2];
        if (Array.isArray(block) && block[0] === "block") {
          for (const child of block.slice(1)) {
            const childVar = this.fgProcessElement(child);
            this._fgCreateLines.push(`${elVar}.appendChild(${childVar});`);
          }
        } else if (block) {
          const childVar = this.fgProcessElement(block);
          this._fgCreateLines.push(`${elVar}.appendChild(${childVar});`);
        }
      } else if (Array.isArray(arg) && arg[0] === "object") {
        this.fgProcessAttributes(elVar, arg);
      } else if (typeof arg === "string") {
        const textVar = this.fgNewText();
        if (arg.startsWith('"') || arg.startsWith("'") || arg.startsWith("`")) {
          this._fgCreateLines.push(`${textVar} = document.createTextNode(${arg});`);
        } else if (this.reactiveMembers && this.reactiveMembers.has(arg)) {
          this._fgCreateLines.push(`${textVar} = document.createTextNode('');`);
          this._fgSetupLines.push(`__effect(() => { ${textVar}.data = this.${arg}.value; });`);
        } else if (this.componentMembers && this.componentMembers.has(arg)) {
          this._fgCreateLines.push(`${textVar} = document.createTextNode(String(this.${arg}));`);
        } else {
          this._fgCreateLines.push(`${textVar} = document.createTextNode(String(${arg}));`);
        }
        this._fgCreateLines.push(`${elVar}.appendChild(${textVar});`);
      } else if (arg instanceof String) {
        const val = arg.valueOf();
        const textVar = this.fgNewText();
        if (val.startsWith('"') || val.startsWith("'") || val.startsWith("`")) {
          this._fgCreateLines.push(`${textVar} = document.createTextNode(${val});`);
        } else if (this.reactiveMembers && this.reactiveMembers.has(val)) {
          this._fgCreateLines.push(`${textVar} = document.createTextNode('');`);
          this._fgSetupLines.push(`__effect(() => { ${textVar}.data = this.${val}.value; });`);
        } else {
          this._fgCreateLines.push(`${textVar} = document.createTextNode(String(${val}));`);
        }
        this._fgCreateLines.push(`${elVar}.appendChild(${textVar});`);
      } else if (arg) {
        const childVar = this.fgProcessElement(arg);
        this._fgCreateLines.push(`${elVar}.appendChild(${childVar});`);
      }
    }
    return elVar;
  }
  fgHasReactiveDeps(sexpr) {
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
      if (this.fgHasReactiveDeps(child))
        return true;
    }
    return false;
  }
  fgProcessAttributes(elVar, objExpr) {
    for (let i = 1;i < objExpr.length; i++) {
      const [key2, value] = objExpr[i];
      if (Array.isArray(key2) && key2[0] === "." && key2[1] === "this") {
        const eventName = key2[2];
        const handlerCode = this.generateInComponent(value, "value");
        this._fgCreateLines.push(`${elVar}.addEventListener('${eventName}', (e) => (${handlerCode})(e));`);
        continue;
      }
      if (typeof key2 === "string") {
        if (key2.startsWith("__bind_") && key2.endsWith("__")) {
          const prop = key2.slice(7, -2);
          const valueCode = this.generateInComponent(value, "value");
          let event, valueAccessor;
          if (prop === "checked") {
            event = "change";
            valueAccessor = "e.target.checked";
          } else {
            event = "input";
            valueAccessor = "e.target.value";
          }
          this._fgSetupLines.push(`__effect(() => { ${elVar}.${prop} = ${valueCode}; });`);
          this._fgCreateLines.push(`${elVar}.addEventListener('${event}', (e) => ${valueCode} = ${valueAccessor});`);
          continue;
        }
        const hasReactiveDeps = this.fgHasReactiveDeps(value);
        if (hasReactiveDeps) {
          const valueCode = this.generateInComponent(value, "value");
          this._fgSetupLines.push(`__effect(() => { ${elVar}.setAttribute('${key2}', ${valueCode}); });`);
        } else {
          const valueCode = this.generateInComponent(value, "value");
          this._fgCreateLines.push(`${elVar}.setAttribute('${key2}', ${valueCode});`);
        }
      }
    }
  }
  fgProcessBlock(body) {
    if (!Array.isArray(body) || body[0] !== "block") {
      return this.fgProcessElement(body);
    }
    const statements = body.slice(1);
    if (statements.length === 0) {
      const commentVar = this.fgNewElement("empty");
      this._fgCreateLines.push(`${commentVar} = document.createComment('');`);
      return commentVar;
    }
    if (statements.length === 1) {
      return this.fgProcessElement(statements[0]);
    }
    const fragVar = this.fgNewElement("frag");
    this._fgCreateLines.push(`${fragVar} = document.createDocumentFragment();`);
    for (const stmt of statements) {
      const childVar = this.fgProcessElement(stmt);
      this._fgCreateLines.push(`${fragVar}.appendChild(${childVar});`);
    }
    return fragVar;
  }
  fgProcessConditional(sexpr) {
    const [, condition, thenBlock, elseBlock] = sexpr;
    const anchorVar = this.fgNewElement("anchor");
    this._fgCreateLines.push(`${anchorVar} = document.createComment('if');`);
    const condCode = this.generateInComponent(condition, "value");
    const thenBlockName = this.fgNewBlock();
    this.fgGenerateConditionBlock(thenBlockName, thenBlock);
    let elseBlockName = null;
    if (elseBlock) {
      elseBlockName = this.fgNewBlock();
      this.fgGenerateConditionBlock(elseBlockName, elseBlock);
    }
    const setupLines = [];
    setupLines.push(`// Conditional: ${thenBlockName}${elseBlockName ? " / " + elseBlockName : ""}`);
    setupLines.push(`{`);
    setupLines.push(`  const anchor = ${anchorVar};`);
    setupLines.push(`  let currentBlock = null;`);
    setupLines.push(`  let showing = null;  // 'then', 'else', or null`);
    setupLines.push(`  __effect(() => {`);
    setupLines.push(`    const show = !!(${condCode});`);
    setupLines.push(`    const want = show ? 'then' : ${elseBlock ? "'else'" : "null"};`);
    setupLines.push(`    if (want === showing) return;`);
    setupLines.push(``);
    setupLines.push(`    // Destroy old block`);
    setupLines.push(`    if (currentBlock) {`);
    setupLines.push(`      currentBlock.d(true);`);
    setupLines.push(`      currentBlock = null;`);
    setupLines.push(`    }`);
    setupLines.push(`    showing = want;`);
    setupLines.push(``);
    setupLines.push(`    // Create new block`);
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
    this._fgSetupLines.push(setupLines.join(`
    `));
    return anchorVar;
  }
  fgGenerateConditionBlock(blockName, block) {
    const savedCreateLines = this._fgCreateLines;
    const savedSetupLines = this._fgSetupLines;
    this._fgCreateLines = [];
    this._fgSetupLines = [];
    const rootVar = this.fgProcessBlock(block);
    const createLines = this._fgCreateLines;
    const setupLines = this._fgSetupLines;
    this._fgCreateLines = savedCreateLines;
    this._fgSetupLines = savedSetupLines;
    const localizeVar = (line) => {
      return line.replace(/this\.(_el\d+|_t\d+|_anchor\d+|_frag\d+|_slot\d+|_c\d+|_inst\d+)/g, "$1");
    };
    const factoryLines = [];
    factoryLines.push(`function ${blockName}(ctx) {`);
    factoryLines.push(`  // Local DOM references`);
    const localVars = new Set;
    for (const line of createLines) {
      const match = line.match(/^this\.(_(?:el|t|anchor|frag|slot|c|inst)\d+)\s*=/);
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
    this._fgBlockFactories.push(factoryLines.join(`
`));
  }
  fgProcessLoop(sexpr) {
    const [head, vars, collection, guard, step, body] = sexpr;
    const blockName = this.fgNewBlock();
    const anchorVar = this.fgNewElement("anchor");
    this._fgCreateLines.push(`${anchorVar} = document.createComment('for');`);
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
              const [k2, v] = arg[i];
              if (k2 === "key") {
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
    const savedCreateLines = this._fgCreateLines;
    const savedSetupLines = this._fgSetupLines;
    const savedBlockFactories = this._fgBlockFactories;
    this._fgCreateLines = [];
    this._fgSetupLines = [];
    const itemNode = this.fgProcessBlock(body);
    const itemCreateLines = this._fgCreateLines;
    const itemSetupLines = this._fgSetupLines;
    this._fgCreateLines = savedCreateLines;
    this._fgSetupLines = savedSetupLines;
    const localizeVar = (line) => {
      return line.replace(/this\.(_el\d+|_t\d+|_anchor\d+|_frag\d+|_slot\d+|_c\d+|_inst\d+)/g, "$1");
    };
    const factoryLines = [];
    factoryLines.push(`function ${blockName}(ctx, ${itemVar}, ${indexVar}) {`);
    factoryLines.push(`  // Local DOM references (not on this)`);
    const localVars = new Set;
    for (const line of itemCreateLines) {
      const match = line.match(/^this\.(_(?:el|t|anchor|frag|slot|c|inst)\d+)\s*=/);
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
      factoryLines.push(`      // Dispose old effects and create new ones with updated values`);
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
    this._fgBlockFactories.push(factoryLines.join(`
`));
    const setupLines = [];
    setupLines.push(`// Loop: ${blockName}`);
    setupLines.push(`{`);
    setupLines.push(`  const anchor = ${anchorVar};`);
    setupLines.push(`  const map = new Map();  // key -> block`);
    setupLines.push(`  let keys = [];`);
    setupLines.push(`  __effect(() => {`);
    setupLines.push(`    const items = ${collectionCode};`);
    setupLines.push(`    const parent = anchor.parentNode;`);
    setupLines.push(`    const newKeys = [];`);
    setupLines.push(`    const newMap = new Map();`);
    setupLines.push(``);
    setupLines.push(`    // Create/update blocks`);
    setupLines.push(`    for (let ${indexVar} = 0; ${indexVar} < items.length; ${indexVar}++) {`);
    setupLines.push(`      const ${itemVar} = items[${indexVar}];`);
    setupLines.push(`      const key = ${keyExpr};`);
    setupLines.push(`      newKeys.push(key);`);
    setupLines.push(`      let block = map.get(key);`);
    setupLines.push(`      if (block) {`);
    setupLines.push(`        // Update existing block`);
    setupLines.push(`        block.p(this, ${itemVar}, ${indexVar});`);
    setupLines.push(`      } else {`);
    setupLines.push(`        // Create new block`);
    setupLines.push(`        block = ${blockName}(this, ${itemVar}, ${indexVar});`);
    setupLines.push(`        block.c();`);
    setupLines.push(`        block.m(parent, anchor);`);
    setupLines.push(`        block.p(this, ${itemVar}, ${indexVar});  // Wire up effects`);
    setupLines.push(`      }`);
    setupLines.push(`      newMap.set(key, block);`);
    setupLines.push(`    }`);
    setupLines.push(``);
    setupLines.push(`    // Remove deleted blocks`);
    setupLines.push(`    for (const [key, block] of map) {`);
    setupLines.push(`      if (!newMap.has(key)) block.d(true);`);
    setupLines.push(`    }`);
    setupLines.push(``);
    setupLines.push(`    // Update tracking (simple swap)`);
    setupLines.push(`    map.clear();`);
    setupLines.push(`    for (const [k, v] of newMap) map.set(k, v);`);
    setupLines.push(`    keys = newKeys;`);
    setupLines.push(`  });`);
    setupLines.push(`}`);
    this._fgSetupLines.push(setupLines.join(`
    `));
    return anchorVar;
  }
  fgProcessComponent(componentName, args) {
    const instVar = this.fgNewElement("inst");
    const elVar = this.fgNewElement("el");
    const { propsCode, childrenVar, childrenSetupLines } = this.fgBuildComponentProps(args);
    this._fgCreateLines.push(`${instVar} = new ${componentName}(${propsCode});`);
    this._fgCreateLines.push(`${elVar} = ${instVar}._create();`);
    this._fgSetupLines.push(`if (${instVar}._setup) ${instVar}._setup();`);
    for (const line of childrenSetupLines) {
      this._fgSetupLines.push(line);
    }
    return elVar;
  }
  fgBuildComponentProps(args) {
    const props = [];
    let childrenVar = null;
    const childrenSetupLines = [];
    for (const arg of args) {
      if (Array.isArray(arg) && arg[0] === "object") {
        for (let i = 1;i < arg.length; i++) {
          const [key2, value] = arg[i];
          if (typeof key2 === "string") {
            const valueCode = this.generateInComponent(value, "value");
            props.push(`${key2}: ${valueCode}`);
          }
        }
      } else if (Array.isArray(arg) && (arg[0] === "->" || arg[0] === "=>")) {
        const block = arg[2];
        if (block) {
          const savedCreateLines = this._fgCreateLines;
          const savedSetupLines = this._fgSetupLines;
          this._fgCreateLines = [];
          this._fgSetupLines = [];
          childrenVar = this.fgProcessBlock(block);
          const childCreateLines = this._fgCreateLines;
          const childSetupLinesCopy = this._fgSetupLines;
          this._fgCreateLines = savedCreateLines;
          this._fgSetupLines = savedSetupLines;
          for (const line of childCreateLines) {
            this._fgCreateLines.push(line);
          }
          childrenSetupLines.push(...childSetupLinesCopy);
          props.push(`children: ${childrenVar}`);
        }
      }
    }
    const propsCode = props.length > 0 ? `{ ${props.join(", ")} }` : "{}";
    return { propsCode, childrenVar, childrenSetupLines };
  }
  generateComponentTemplateElement(sexpr) {
    if (typeof sexpr === "string") {
      if (this.componentMembers && this.componentMembers.has(sexpr)) {
        return `this.${sexpr}.value`;
      }
      if (sexpr.startsWith('"') || sexpr.startsWith("'") || sexpr.startsWith("`")) {
        return sexpr;
      }
      return `h('${sexpr}', 0)`;
    }
    if (sexpr instanceof String) {
      const val = sexpr.valueOf();
      if (this.componentMembers && this.componentMembers.has(val)) {
        return `this.${val}.value`;
      }
    }
    if (Array.isArray(sexpr)) {
      const [head, ...rest] = sexpr;
      const headStr = typeof head === "string" ? head : head instanceof String ? head.valueOf() : null;
      if (headStr && this.isComponent(headStr)) {
        return this.generateComponentInstance(headStr, rest);
      }
      if (headStr && this.isHtmlTag && this.isHtmlTag(headStr)) {
        return this.generateComponentH(headStr, [], rest);
      }
      if (headStr === ".") {
        const [, obj, prop] = sexpr;
        if (obj === "this" && prop === "children") {
          return `this.children`;
        }
        const { tag, classes } = this.collectTemplateClasses(sexpr);
        if (tag && this.isHtmlTag && this.isHtmlTag(tag)) {
          return this.generateComponentH(tag, classes, []);
        }
      }
      if (Array.isArray(head)) {
        const { tag, classes } = this.collectTemplateClasses(head);
        if (tag && this.isHtmlTag && this.isHtmlTag(tag)) {
          return this.generateComponentH(tag, classes, rest);
        }
      }
      if (headStr === "->" || headStr === "=>") {
        const [params, body] = rest;
        return this.generateComponentRender(body);
      }
      return this.generateTemplateElement(sexpr);
    }
    return this.generateTemplateElement(sexpr);
  }
  generateComponentH(tag, classes, args) {
    this.usesTemplates = true;
    const props = {};
    const spreads = [];
    const children = [];
    let refVar = null;
    for (const arg of args) {
      if (Array.isArray(arg) && (arg[0] === "->" || arg[0] === "=>")) {
        const block = arg[2];
        if (Array.isArray(block) && block[0] === "block") {
          children.push(...block.slice(1).map((s) => this.generateComponentTemplateElement(s)));
        } else {
          children.push(this.generateComponentTemplateElement(block));
        }
      } else if (Array.isArray(arg) && arg[0] === "...") {
        spreads.push(this.generateInComponent(arg[1], "value"));
      } else if (Array.isArray(arg) && arg[0] === "object") {
        for (const pair of arg.slice(1)) {
          if (Array.isArray(pair) && pair.length >= 2) {
            const [key2, value] = pair;
            const bindInfo = this.parseBindingDirective(key2, value, tag);
            if (bindInfo) {
              props[bindInfo.prop] = bindInfo.valueExpr;
              props[bindInfo.event] = bindInfo.handler;
              continue;
            }
            const eventInfo = this.parseEventHandler(key2, value);
            if (eventInfo) {
              const handler = eventInfo.modifiers.length > 0 ? this.wrapEventHandler(eventInfo.handler, eventInfo.modifiers) : eventInfo.handler;
              props[`on${eventInfo.eventName}`] = handler;
            } else {
              const keyStr = typeof key2 === "string" ? key2 : this.generate(key2, "value");
              if (keyStr === "ref") {
                refVar = typeof value === "string" ? value : this.generate(value, "value");
              } else if (keyStr === "key") {
                props.key = this.generateInComponent(value, "value");
              } else {
                props[keyStr] = this.generateInComponent(value, "value");
              }
            }
          }
        }
      } else if (typeof arg === "string") {
        if (this.componentMembers && this.componentMembers.has(arg)) {
          children.push(`this.${arg}.value`);
        } else if (arg.startsWith('"') || arg.startsWith("'") || arg.startsWith("`")) {
          children.push(arg);
        } else {
          children.push(`String(${arg})`);
        }
      } else {
        children.push(this.generateComponentTemplateElement(arg));
      }
    }
    const tagStr = classes.length > 0 ? `${tag}.${classes.join(".")}` : tag;
    const propsStr = this.buildPropsString(props, spreads);
    const childrenStr = this.buildChildrenString(children);
    let result = `h('${tagStr}', ${propsStr}${childrenStr})`;
    if (refVar) {
      result = `(${refVar} = ${result})`;
    }
    return result;
  }
  generateComponentInstance(componentName, args) {
    const props = {};
    const children = [];
    for (const arg of args) {
      if (Array.isArray(arg) && arg[0] === "object") {
        for (let i = 1;i < arg.length; i++) {
          const [key2, value] = arg[i];
          if (typeof key2 === "string") {
            props[key2] = this.generateInComponent(value, "value");
          }
        }
      } else if (Array.isArray(arg) && (arg[0] === "->" || arg[0] === "=>")) {
        const block = arg[2];
        if (Array.isArray(block) && block[0] === "block") {
          children.push(...block.slice(1).map((s) => this.generateComponentTemplateElement(s)));
        } else {
          children.push(this.generateComponentTemplateElement(block));
        }
      } else if (typeof arg === "string") {
        if (arg.startsWith('"') || arg.startsWith("'") || arg.startsWith("`")) {
          children.push(arg);
        } else if (this.reactiveMembers && this.reactiveMembers.has(arg)) {
          children.push(`this.${arg}.value`);
        } else {
          children.push(`String(${arg})`);
        }
      } else {
        children.push(this.generateComponentTemplateElement(arg));
      }
    }
    const propsEntries = Object.entries(props);
    let propsStr = "{}";
    if (propsEntries.length > 0 || children.length > 0) {
      const entries = propsEntries.map(([k2, v]) => `${k2}: ${v}`);
      if (children.length > 0) {
        const childrenStr = children.length === 1 ? children[0] : `[${children.join(", ")}]`;
        entries.push(`children: ${childrenStr}`);
      }
      propsStr = entries.length > 0 ? `{ ${entries.join(", ")} }` : "{}";
    }
    return `new ${componentName}(${propsStr}).render()`;
  }
  generateTemplateElement(sexpr) {
    if (typeof sexpr === "string") {
      if (sexpr.startsWith('"') || sexpr.startsWith("'") || sexpr.startsWith("`")) {
        return sexpr;
      }
      return `h('${sexpr}', 0)`;
    }
    if (sexpr instanceof String) {
      return this.generate(sexpr, "value");
    }
    if (!Array.isArray(sexpr)) {
      return `txt(${this.generate(sexpr, "value")})`;
    }
    const [head, ...rest] = sexpr;
    if (head === "str") {
      return this.generate(sexpr, "value");
    }
    if (head === "block") {
      if (rest.length === 0)
        return "null";
      if (rest.length === 1)
        return this.generateTemplateElement(rest[0]);
      const elements = rest.map((s) => this.generateTemplateElement(s));
      return `frag(${elements.join(", ")})`;
    }
    if (head === "if" || head === "unless") {
      return this.generateTemplateConditional(sexpr);
    }
    if (head === "for-in" || head === "for-of") {
      return this.generateTemplateLoop(sexpr);
    }
    if (head === ".") {
      const [obj, prop] = rest;
      if (typeof obj === "string" && typeof prop === "string") {
        if (this.isHtmlTag(obj)) {
          return `h('${obj}.${prop}', 0)`;
        }
        return `txt(${this.generate(sexpr, "value")})`;
      }
      if (Array.isArray(obj) && obj[0] === ".") {
        const { tag, classes } = this.collectTemplateClasses(sexpr);
        if (this.isHtmlTag(tag)) {
          return `h('${tag}.${classes.join(".")}', 0)`;
        }
        return `txt(${this.generate(sexpr, "value")})`;
      }
    }
    if (typeof head === "string" && !CodeGenerator.GENERATORS[head]) {
      return this.generateH(head, [], rest);
    }
    if (Array.isArray(head) && head[0] === ".") {
      if (head.length === 3 && head[2] == "__cx__") {
        const baseTag = head[1];
        let tag2, classes2;
        if (Array.isArray(baseTag) && baseTag[0] === ".") {
          ({ tag: tag2, classes: classes2 } = this.collectTemplateClasses(baseTag));
        } else {
          tag2 = baseTag;
          classes2 = [];
        }
        const cxArgsStr = rest.map((arg) => this.generate(arg, "value")).join(", ");
        return this.generateH(tag2, classes2, [], cxArgsStr);
      }
      const { tag, classes } = this.collectTemplateClasses(head);
      return this.generateH(tag, classes, rest);
    }
    if (Array.isArray(head) && Array.isArray(head[0]) && head[0][0] === "." && head[0][2] == "__cx__") {
      const propAccess = head[0];
      const cxArgs = head.slice(1);
      const baseTag = propAccess[1];
      let tag, classes;
      if (Array.isArray(baseTag) && baseTag[0] === ".") {
        ({ tag, classes } = this.collectTemplateClasses(baseTag));
      } else {
        tag = baseTag;
        classes = [];
      }
      const cxArgsStr = cxArgs.map((arg) => this.generate(arg, "value")).join(", ");
      return this.generateH(tag, classes, rest, cxArgsStr);
    }
    return `txt(${this.generate(sexpr, "value")})`;
  }
  parseTemplateArgs(args, tag) {
    const props = {};
    const spreads = [];
    const children = [];
    let refVar = null;
    for (const arg of args) {
      if (Array.isArray(arg) && (arg[0] === "->" || arg[0] === "=>")) {
        const block = arg[2];
        if (Array.isArray(block) && block[0] === "block") {
          children.push(...block.slice(1).map((s) => this.generateTemplateElement(s)));
        } else {
          children.push(this.generateTemplateElement(block));
        }
      } else if (Array.isArray(arg) && arg[0] === "...") {
        spreads.push(this.generate(arg[1], "value"));
      } else if (Array.isArray(arg) && arg[0] === "object") {
        for (const pair of arg.slice(1)) {
          if (Array.isArray(pair) && pair.length >= 2) {
            const [key2, value] = pair;
            const bindInfo = this.parseBindingDirective(key2, value, tag);
            if (bindInfo) {
              props[bindInfo.prop] = bindInfo.valueExpr;
              props[bindInfo.event] = bindInfo.handler;
              continue;
            }
            const eventInfo = this.parseEventHandler(key2, value);
            if (eventInfo) {
              const handler = eventInfo.modifiers.length > 0 ? this.wrapEventHandler(eventInfo.handler, eventInfo.modifiers) : eventInfo.handler;
              props[`on${eventInfo.eventName}`] = handler;
            } else {
              const keyStr = typeof key2 === "string" ? key2 : this.generate(key2, "value");
              if (keyStr === "ref") {
                refVar = typeof value === "string" ? value : this.generate(value, "value");
              } else if (keyStr === "key") {
                props.key = this.generate(value, "value");
              } else if (keyStr === "class") {
                props.class = this.generate(value, "value");
              } else {
                props[keyStr] = this.generate(value, "value");
              }
            }
          }
        }
      } else if (typeof arg === "string") {
        if (arg.startsWith('"') || arg.startsWith("'") || arg.startsWith("`")) {
          children.push(arg);
        } else {
          children.push(`String(${arg})`);
        }
      } else {
        children.push(this.generateTemplateElement(arg));
      }
    }
    return { props, spreads, children, refVar };
  }
  buildPropsString(props, spreads, classExpr = null) {
    const hasProps = Object.keys(props).length > 0;
    const hasSpreads = spreads.length > 0;
    const hasClass = classExpr !== null;
    if (!hasProps && !hasSpreads && !hasClass) {
      return "0";
    }
    const parts = [];
    if (hasClass) {
      parts.push(`class: ${classExpr}`);
    }
    for (const spread of spreads) {
      parts.push(`...${spread}`);
    }
    for (const [k2, v] of Object.entries(props)) {
      parts.push(`${k2}: ${v}`);
    }
    return `{ ${parts.join(", ")} }`;
  }
  buildChildrenString(children) {
    if (children.length === 0)
      return "";
    if (children.length === 1)
      return `, ${children[0]}`;
    return `, [${children.join(", ")}]`;
  }
  generateH(tag, classes, args, cxArgs = null) {
    this.usesTemplates = true;
    const { props, spreads, children, refVar } = this.parseTemplateArgs(args, tag);
    const tagStr = classes.length > 0 ? `${tag}.${classes.join(".")}` : tag;
    const classExpr = cxArgs ? `cx(${cxArgs})` : null;
    const propsStr = this.buildPropsString(props, spreads, classExpr);
    const childrenStr = this.buildChildrenString(children);
    let result = `h('${tagStr}', ${propsStr}${childrenStr})`;
    if (refVar) {
      result = `(${refVar} = ${result})`;
    }
    return result;
  }
  collectTemplateClasses(sexpr) {
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
  }
  generateTemplateConditional(sexpr) {
    const [head, condition, thenBlock, elseBlock] = sexpr;
    const cond = this.generate(condition, "value");
    const condExpr = head === "unless" ? `!(${cond})` : cond;
    let actualThen = thenBlock;
    if (Array.isArray(thenBlock) && thenBlock.length === 1 && Array.isArray(thenBlock[0]) && thenBlock[0][0] !== "block") {
      actualThen = thenBlock[0];
    }
    const thenCode = this.generateTemplateElement(actualThen);
    if (elseBlock) {
      let actualElse = elseBlock;
      if (Array.isArray(elseBlock) && elseBlock.length === 1 && Array.isArray(elseBlock[0]) && elseBlock[0][0] !== "block") {
        actualElse = elseBlock[0];
      }
      return `(${condExpr} ? ${thenCode} : ${this.generateTemplateElement(actualElse)})`;
    }
    return `(${condExpr} ? ${thenCode} : null)`;
  }
  generateTemplateLoop(sexpr) {
    const [head] = sexpr;
    if (head === "for-in")
      return this.generateTemplateForIn(sexpr);
    if (head === "for-of")
      return this.generateTemplateForOf(sexpr);
    return "null";
  }
  generateTemplateForIn(sexpr) {
    const [, vars, iterable, , guard, body] = sexpr;
    const itemVar = Array.isArray(vars) && vars[0] ? typeof vars[0] === "string" ? vars[0] : this.generate(vars[0], "value") : "__item";
    const indexVar = Array.isArray(vars) && vars[1] ? typeof vars[1] === "string" ? vars[1] : "__i" : "__i";
    const iterCode = this.generate(iterable, "value");
    const bodyCode = this.generateTemplateElement(body);
    const guardCode = guard ? `if (!(${this.generate(guard, "value")})) continue; ` : "";
    return `frag(...${iterCode}.map((${itemVar}, ${indexVar}) => ${guardCode ? `{ ${guardCode}return ${bodyCode}; }` : bodyCode}))`;
  }
  generateTemplateForOf(sexpr) {
    const [, vars, object, own, guard, body] = sexpr;
    const keyVar = Array.isArray(vars) && vars[0] ? typeof vars[0] === "string" ? vars[0] : "__k" : "__k";
    const valVar = Array.isArray(vars) && vars[1] ? typeof vars[1] === "string" ? vars[1] : null : null;
    const objCode = this.generate(object, "value");
    const bodyCode = this.generateTemplateElement(body);
    const entries = own ? `Object.entries(${objCode})` : `Object.entries(${objCode})`;
    const destructure = valVar ? `[${keyVar}, ${valVar}]` : `[${keyVar}]`;
    const guardCode = guard ? `if (!(${this.generate(guard, "value")})) continue; ` : "";
    return `frag(...${entries}.map((${destructure}) => ${guardCode ? `{ ${guardCode}return ${bodyCode}; }` : bodyCode}))`;
  }
  generateBreak(head, rest, context, sexpr) {
    return "break";
  }
  generateBreakIf(head, rest, context, sexpr) {
    const [condition] = rest;
    return `if (${this.generate(condition, "value")}) break`;
  }
  generateContinue(head, rest, context, sexpr) {
    return "continue";
  }
  generateContinueIf(head, rest, context, sexpr) {
    const [condition] = rest;
    return `if (${this.generate(condition, "value")}) continue`;
  }
  generateExistential(head, rest, context, sexpr) {
    const [expr] = rest;
    return `(${this.generate(expr, "value")} != null)`;
  }
  generateTernary(head, rest, context, sexpr) {
    const [condition, thenExpr, elseExpr] = rest;
    const condCode = this.unwrap(this.generate(condition, "value"));
    return `(${condCode} ? ${this.generate(thenExpr, "value")} : ${this.generate(elseExpr, "value")})`;
  }
  generateLoop(head, rest, context, sexpr) {
    const [body] = rest;
    const bodyCode = this.generateLoopBody(body);
    return `while (true) ${bodyCode}`;
  }
  generateAwait(head, rest, context, sexpr) {
    const [expr] = rest;
    return `await ${this.generate(expr, "value")}`;
  }
  generateYield(head, rest, context, sexpr) {
    if (rest.length === 0) {
      return "yield";
    }
    const [expr] = rest;
    return `yield ${this.generate(expr, "value")}`;
  }
  generateYieldFrom(head, rest, context, sexpr) {
    const [expr] = rest;
    return `yield* ${this.generate(expr, "value")}`;
  }
  generateIf(head, rest, context, sexpr) {
    if (head === "unless") {
      let [condition2, body] = rest;
      if (Array.isArray(body) && body.length === 1) {
        const elem = body[0];
        if (!Array.isArray(elem) || elem[0] !== "block") {
          body = elem;
        }
      }
      if (context === "value") {
        const thenExpr = this.extractExpression(body);
        return `(!${this.generate(condition2, "value")} ? ${thenExpr} : undefined)`;
      }
      let condCode = this.unwrap(this.generate(condition2, "value"));
      if (condCode.includes(" ") || condCode.includes("===") || condCode.includes("!==") || condCode.includes(">") || condCode.includes("<") || condCode.includes("&&") || condCode.includes("||")) {
        condCode = `(${condCode})`;
      }
      return `if (!${condCode}) ` + this.generate(body, "statement");
    }
    const [condition, thenBranch, ...elseBranches] = rest;
    if (context === "value") {
      return this.generateIfAsExpression(condition, thenBranch, elseBranches);
    } else {
      return this.generateIfAsStatement(condition, thenBranch, elseBranches);
    }
  }
  generateForIn(head, rest, context, sexpr) {
    const [vars, iterable, step, guard, body] = rest;
    if (context === "value" && this.comprehensionDepth === 0) {
      const iterator = ["for-in", vars, iterable, step];
      const guards = guard ? [guard] : [];
      return this.generate(["comprehension", body, [iterator], guards], context);
    }
    const varsArray = Array.isArray(vars) ? vars : [vars];
    const noVar = varsArray.length === 0;
    const [itemVar, indexVar] = noVar ? ["_i", null] : varsArray;
    let itemVarPattern = itemVar;
    if (Array.isArray(itemVar) && (itemVar[0] === "array" || itemVar[0] === "object")) {
      itemVarPattern = this.generateDestructuringPattern(itemVar);
    }
    if (step && step !== null) {
      const iterableCode = this.generate(iterable, "value");
      const indexVarName2 = indexVar || "_i";
      const stepCode = this.generate(step, "value");
      const isNegativeStep = this.isNegativeStep(step);
      const isMinusOne = isNegativeStep && (step[1] === "1" || step[1] === 1 || step[1] instanceof String && step[1].valueOf() === "1");
      const isPlusOne = !isNegativeStep && (step === "1" || step === 1 || step instanceof String && step.valueOf() === "1");
      let loopHeader;
      if (isMinusOne) {
        loopHeader = `for (let ${indexVarName2} = ${iterableCode}.length - 1; ${indexVarName2} >= 0; ${indexVarName2}--) `;
      } else if (isPlusOne) {
        loopHeader = `for (let ${indexVarName2} = 0; ${indexVarName2} < ${iterableCode}.length; ${indexVarName2}++) `;
      } else if (isNegativeStep) {
        loopHeader = `for (let ${indexVarName2} = ${iterableCode}.length - 1; ${indexVarName2} >= 0; ${indexVarName2} += ${stepCode}) `;
      } else {
        loopHeader = `for (let ${indexVarName2} = 0; ${indexVarName2} < ${iterableCode}.length; ${indexVarName2} += ${stepCode}) `;
      }
      if (Array.isArray(body) && body[0] === "block") {
        const statements = body.slice(1);
        this.indentLevel++;
        const stmts = [];
        if (!noVar) {
          stmts.push(`const ${itemVarPattern} = ${iterableCode}[${indexVarName2}];`);
        }
        if (guard) {
          const guardCode = this.generate(guard, "value");
          stmts.push(`if (${guardCode}) {`);
          this.indentLevel++;
          stmts.push(...this.formatStatements(statements));
          this.indentLevel--;
          stmts.push(this.indent() + "}");
        } else {
          stmts.push(...statements.map((s) => this.addSemicolon(s, this.generate(s, "statement"))));
        }
        this.indentLevel--;
        return loopHeader + `{
${stmts.map((s) => this.indent() + s).join(`
`)}
${this.indent()}}`;
      } else {
        if (noVar) {
          if (guard) {
            const guardCode = this.generate(guard, "value");
            return loopHeader + `{ if (${guardCode}) ${this.generate(body, "statement")}; }`;
          } else {
            return loopHeader + `{ ${this.generate(body, "statement")}; }`;
          }
        } else {
          if (guard) {
            const guardCode = this.generate(guard, "value");
            return loopHeader + `{ const ${itemVarPattern} = ${iterableCode}[${indexVarName2}]; if (${guardCode}) ${this.generate(body, "statement")}; }`;
          } else {
            return loopHeader + `{ const ${itemVarPattern} = ${iterableCode}[${indexVarName2}]; ${this.generate(body, "statement")}; }`;
          }
        }
      }
    }
    if (indexVar) {
      const iterableCode = this.generate(iterable, "value");
      let code2 = `for (let ${indexVar} = 0; ${indexVar} < ${iterableCode}.length; ${indexVar}++) `;
      if (Array.isArray(body) && body[0] === "block") {
        const statements = body.slice(1);
        code2 += `{
`;
        this.indentLevel++;
        code2 += this.indent() + `const ${itemVarPattern} = ${iterableCode}[${indexVar}];
`;
        if (guard) {
          const guardCode = this.unwrap(this.generate(guard, "value"));
          code2 += this.indent() + `if (${guardCode}) {
`;
          this.indentLevel++;
          code2 += this.formatStatements(statements).join(`
`) + `
`;
          this.indentLevel--;
          code2 += this.indent() + `}
`;
        } else {
          code2 += this.formatStatements(statements).join(`
`) + `
`;
        }
        this.indentLevel--;
        code2 += this.indent() + "}";
      } else {
        if (guard) {
          const guardCode = this.unwrap(this.generate(guard, "value"));
          code2 += `{ const ${itemVarPattern} = ${iterableCode}[${indexVar}]; if (${guardCode}) ${this.generate(body, "statement")}; }`;
        } else {
          code2 += `{ const ${itemVarPattern} = ${iterableCode}[${indexVar}]; ${this.generate(body, "statement")}; }`;
        }
      }
      return code2;
    }
    let iterableHead = Array.isArray(iterable) && iterable[0];
    if (iterableHead instanceof String) {
      iterableHead = iterableHead.valueOf();
    }
    const isRange = iterableHead === ".." || iterableHead === "...";
    if (isRange) {
      const isExclusive = iterableHead === "...";
      const [start, end] = iterable.slice(1);
      const isSimple = (expr) => {
        if (typeof expr === "number")
          return true;
        if (expr instanceof String) {
          const val = expr.valueOf();
          return !val.includes("(");
        }
        if (typeof expr === "string" && !expr.includes("("))
          return true;
        if (Array.isArray(expr) && expr[0] === ".")
          return true;
        return false;
      };
      if (isSimple(start) && isSimple(end)) {
        const startCode = this.generate(start, "value");
        const endCode = this.generate(end, "value");
        const comparison = isExclusive ? "<" : "<=";
        let increment = `${itemVarPattern}++`;
        if (step && step !== null) {
          const stepCode = this.generate(step, "value");
          increment = `${itemVarPattern} += ${stepCode}`;
        }
        let code2 = `for (let ${itemVarPattern} = ${startCode}; ${itemVarPattern} ${comparison} ${endCode}; ${increment}) `;
        if (guard) {
          code2 += this.generateLoopBodyWithGuard(body, guard);
        } else {
          code2 += this.generateLoopBody(body);
        }
        return code2;
      }
    }
    let code = `for (const ${itemVarPattern} of ${this.generate(iterable, "value")}) `;
    if (guard) {
      code += this.generateLoopBodyWithGuard(body, guard);
    } else {
      code += this.generateLoopBody(body);
    }
    return code;
  }
  generateForOf(head, rest, context, sexpr) {
    const [vars, obj, own, guard, body] = rest;
    const [keyVar, valueVar] = Array.isArray(vars) ? vars : [vars];
    const objCode = this.generate(obj, "value");
    let code = `for (const ${keyVar} in ${objCode}) `;
    if (own && !valueVar && !guard) {
      if (Array.isArray(body) && body[0] === "block") {
        const statements = body.slice(1);
        this.indentLevel++;
        const stmts = [
          `if (!Object.hasOwn(${objCode}, ${keyVar})) continue;`,
          ...statements.map((s) => this.addSemicolon(s, this.generate(s, "statement")))
        ];
        this.indentLevel--;
        code += `{
${stmts.map((s) => this.indent() + s).join(`
`)}
${this.indent()}}`;
      } else {
        code += `{ if (!Object.hasOwn(${objCode}, ${keyVar})) continue; ${this.generate(body, "statement")}; }`;
      }
      return code;
    }
    if (valueVar) {
      if (own && guard) {
        if (Array.isArray(body) && body[0] === "block") {
          const statements = body.slice(1);
          this.indentLevel++;
          const outerIndent = this.indent();
          const guardCondition = this.generate(guard, "value");
          this.indentLevel++;
          const innerIndent = this.indent();
          const stmts = statements.map((s) => innerIndent + this.addSemicolon(s, this.generate(s, "statement")));
          this.indentLevel -= 2;
          code += `{
${outerIndent}if (!Object.hasOwn(${objCode}, ${keyVar})) continue;
${outerIndent}const ${valueVar} = ${objCode}[${keyVar}];
${outerIndent}if (${guardCondition}) {
${stmts.join(`
`)}
${outerIndent}}
${this.indent()}}`;
        } else {
          const guardCondition = this.generate(guard, "value");
          code += `{ if (!Object.hasOwn(${objCode}, ${keyVar})) continue; const ${valueVar} = ${objCode}[${keyVar}]; if (${guardCondition}) ${this.generate(body, "statement")}; }`;
        }
      } else if (own) {
        if (Array.isArray(body) && body[0] === "block") {
          const statements = body.slice(1);
          this.indentLevel++;
          const stmts = [
            `if (!Object.hasOwn(${objCode}, ${keyVar})) continue;`,
            `const ${valueVar} = ${objCode}[${keyVar}];`,
            ...statements.map((s) => this.addSemicolon(s, this.generate(s, "statement")))
          ];
          this.indentLevel--;
          code += `{
${stmts.map((s) => this.indent() + s).join(`
`)}
${this.indent()}}`;
        } else {
          code += `{ if (!Object.hasOwn(${objCode}, ${keyVar})) continue; const ${valueVar} = ${objCode}[${keyVar}]; ${this.generate(body, "statement")}; }`;
        }
      } else if (guard) {
        if (Array.isArray(body) && body[0] === "block") {
          const statements = body.slice(1);
          this.indentLevel++;
          const loopBodyIndent = this.indent();
          const guardCondition = this.generate(guard, "value");
          this.indentLevel++;
          const innerIndent = this.indent();
          const stmts = statements.map((s) => innerIndent + this.addSemicolon(s, this.generate(s, "statement")));
          this.indentLevel -= 2;
          code += `{
${loopBodyIndent}const ${valueVar} = ${objCode}[${keyVar}];
${loopBodyIndent}if (${guardCondition}) {
${stmts.join(`
`)}
${loopBodyIndent}}
${this.indent()}}`;
        } else {
          code += `{ const ${valueVar} = ${objCode}[${keyVar}]; if (${this.generate(guard, "value")}) ${this.generate(body, "statement")}; }`;
        }
      } else {
        if (Array.isArray(body) && body[0] === "block") {
          const statements = body.slice(1);
          this.indentLevel++;
          const stmts = [`const ${valueVar} = ${objCode}[${keyVar}];`, ...statements.map((s) => this.addSemicolon(s, this.generate(s, "statement")))];
          this.indentLevel--;
          code += `{
${stmts.map((s) => this.indent() + s).join(`
`)}
${this.indent()}}`;
        } else {
          code += `{ const ${valueVar} = ${objCode}[${keyVar}]; ${this.generate(body, "statement")}; }`;
        }
      }
    } else {
      if (guard) {
        code += this.generateLoopBodyWithGuard(body, guard);
      } else {
        code += this.generateLoopBody(body);
      }
    }
    return code;
  }
  generateForFrom(head, rest, context, sexpr) {
    const varsArray = Array.isArray(rest[0]) ? rest[0] : [rest[0]];
    const [firstVar] = varsArray;
    const iterable = rest[1];
    const isAwait = rest[2];
    const guard = rest[3];
    const body = rest[4];
    let needsTempVar = false;
    let destructuringStatements = [];
    if (Array.isArray(firstVar) && firstVar[0] === "array") {
      const elements = firstVar.slice(1);
      const restIndex = elements.findIndex((el) => Array.isArray(el) && el[0] === "..." || el === "...");
      if (restIndex !== -1 && restIndex < elements.length - 1) {
        needsTempVar = true;
        const elementsAfterRest = elements.slice(restIndex + 1);
        const afterCount = elementsAfterRest.length;
        const beforeRest = elements.slice(0, restIndex);
        const restEl = elements[restIndex];
        const restVar = Array.isArray(restEl) && restEl[0] === "..." ? restEl[1] : "_rest";
        const beforePattern = beforeRest.map((el) => {
          if (el === ",")
            return "";
          if (typeof el === "string")
            return el;
          return this.generate(el, "value");
        }).join(", ");
        const firstPattern = beforePattern ? `${beforePattern}, ...${restVar}` : `...${restVar}`;
        const afterPattern = elementsAfterRest.map((el) => {
          if (el === ",")
            return "";
          if (typeof el === "string")
            return el;
          return this.generate(el, "value");
        }).join(", ");
        destructuringStatements.push(`[${firstPattern}] = _item`);
        destructuringStatements.push(`[${afterPattern}] = ${restVar}.splice(-${afterCount})`);
        this.helpers.add("slice");
        const collectVarsFromPattern = (arr) => {
          arr.slice(1).forEach((el) => {
            if (el === "," || el === "...")
              return;
            if (typeof el === "string")
              this.programVars.add(el);
            else if (Array.isArray(el) && el[0] === "...") {
              if (typeof el[1] === "string")
                this.programVars.add(el[1]);
            }
          });
        };
        collectVarsFromPattern(firstVar);
      }
    }
    const iterableCode = this.generate(iterable, "value");
    const awaitKeyword = isAwait ? "await " : "";
    let itemVarPattern;
    if (needsTempVar) {
      itemVarPattern = "_item";
    } else if (Array.isArray(firstVar) && (firstVar[0] === "array" || firstVar[0] === "object")) {
      itemVarPattern = this.generateDestructuringPattern(firstVar);
    } else {
      itemVarPattern = firstVar;
    }
    let code = `for ${awaitKeyword}(const ${itemVarPattern} of ${iterableCode}) `;
    if (needsTempVar && destructuringStatements.length > 0) {
      const statements = this.unwrapBlock(body);
      const allStmts = this.withIndent(() => [
        ...destructuringStatements.map((s) => this.indent() + s + ";"),
        ...this.formatStatements(statements)
      ]);
      code += `{
${allStmts.join(`
`)}
${this.indent()}}`;
    } else {
      if (guard) {
        code += this.generateLoopBodyWithGuard(body, guard);
      } else {
        code += this.generateLoopBody(body);
      }
    }
    return code;
  }
  generateWhile(head, rest, context, sexpr) {
    const condition = rest[0];
    const guard = rest.length === 3 ? rest[1] : null;
    const body = rest[rest.length - 1];
    const condCode = this.unwrap(this.generate(condition, "value"));
    let code = `while (${condCode}) `;
    if (guard) {
      code += this.generateLoopBodyWithGuard(body, guard);
    } else {
      code += this.generateLoopBody(body);
    }
    return code;
  }
  generateUntil(head, rest, context, sexpr) {
    const [condition, body] = rest;
    const condCode = this.unwrap(this.generate(condition, "value"));
    let code = `while (!(${condCode})) `;
    code += this.generateLoopBody(body);
    return code;
  }
  generateRange(head, rest, context, sexpr) {
    if (head === "...") {
      if (rest.length === 1) {
        const [expr] = rest;
        return `...${this.generate(expr, "value")}`;
      }
      const [start2, end2] = rest;
      const startCode2 = this.generate(start2, "value");
      const endCode2 = this.generate(end2, "value");
      return `((s, e) => Array.from({length: Math.max(0, Math.abs(e - s))}, (_, i) => s + (i * (s <= e ? 1 : -1))))(${startCode2}, ${endCode2})`;
    }
    const [start, end] = rest;
    const startCode = this.generate(start, "value");
    const endCode = this.generate(end, "value");
    return `((s, e) => Array.from({length: Math.abs(e - s) + 1}, (_, i) => s + (i * (s <= e ? 1 : -1))))(${startCode}, ${endCode})`;
  }
  generateNot(head, rest, context, sexpr) {
    const [operand] = rest;
    if (typeof operand === "string" || operand instanceof String) {
      return `!${this.generate(operand, "value")}`;
    }
    if (Array.isArray(operand)) {
      const type = operand[0];
      const highPrecedence = [".", "?.", "::", "?::", "[]", "?[]", "optindex", "optcall"];
      if (highPrecedence.includes(type)) {
        return `!${this.generate(operand, "value")}`;
      }
    }
    const operandCode = this.generate(operand, "value");
    if (operandCode.startsWith("(")) {
      return `!${operandCode}`;
    }
    return `(!${operandCode})`;
  }
  generateBitwiseNot(head, rest, context, sexpr) {
    const [operand] = rest;
    return `(~${this.generate(operand, "value")})`;
  }
  generateIncDec(head, rest, context, sexpr) {
    const [operand, isPostfix] = rest;
    const operandCode = this.generate(operand, "value");
    if (isPostfix) {
      return `(${operandCode}${head})`;
    } else {
      return `(${head}${operandCode})`;
    }
  }
  generateTypeof(head, rest, context, sexpr) {
    const [operand] = rest;
    return `typeof ${this.generate(operand, "value")}`;
  }
  generateDelete(head, rest, context, sexpr) {
    const [operand] = rest;
    return `(delete ${this.generate(operand, "value")})`;
  }
  generateInstanceof(head, rest, context, sexpr) {
    const [expr, type] = rest;
    const isNegated = sexpr[0]?.invert;
    const result = `(${this.generate(expr, "value")} instanceof ${this.generate(type, "value")})`;
    return isNegated ? `(!${result})` : result;
  }
  generateIn(head, rest, context, sexpr) {
    const [key2, container] = rest;
    const keyCode = this.generate(key2, "value");
    const isNegated = sexpr[0]?.invert;
    if (Array.isArray(container) && container[0] === "object") {
      const objCode = this.generate(container, "value");
      const result2 = `(${keyCode} in ${objCode})`;
      return isNegated ? `(!${result2})` : result2;
    }
    const containerCode = this.generate(container, "value");
    const result = `(Array.isArray(${containerCode}) || typeof ${containerCode} === 'string' ? ${containerCode}.includes(${keyCode}) : (${keyCode} in ${containerCode}))`;
    return isNegated ? `(!${result})` : result;
  }
  generateOf(head, rest, context, sexpr) {
    const [value, container] = rest;
    const valueCode = this.generate(value, "value");
    const containerCode = this.generate(container, "value");
    const isNegated = sexpr[0]?.invert;
    const result = `(${valueCode} in ${containerCode})`;
    return isNegated ? `(!${result})` : result;
  }
  generateRegexMatch(head, rest, context, sexpr) {
    const [left2, right2] = rest;
    this.helpers.add("toSearchable");
    this.programVars.add("_");
    const rightCode = this.generate(right2, "value");
    const hasMultilineFlag = rightCode.includes("/m");
    const allowNewlines = hasMultilineFlag ? ", true" : "";
    return `(_ = toSearchable(${this.generate(left2, "value")}${allowNewlines}).match(${rightCode}))`;
  }
  generateNew(head, rest, context, sexpr) {
    const [call] = rest;
    if (Array.isArray(call) && (call[0] === "." || call[0] === "?.")) {
      const [accessType, target, prop] = call;
      if (Array.isArray(target) && !target[0].startsWith) {
        const newExpr = this.generate(["new", target], "value");
        return `(${newExpr}).${prop}`;
      }
      const targetCode = this.generate(target, "value");
      return `new ${targetCode}.${prop}`;
    }
    if (Array.isArray(call)) {
      const [constructor, ...args] = call;
      const constructorCode = this.generate(constructor, "value");
      const argsCode = args.map((arg) => this.unwrap(this.generate(arg, "value"))).join(", ");
      return `new ${constructorCode}(${argsCode})`;
    }
    return `new ${this.generate(call, "value")}()`;
  }
  generateLogicalAnd(head, rest, context, sexpr) {
    const flattened = this.flattenBinaryChain(sexpr);
    const operands = flattened.slice(1);
    if (operands.length === 0)
      return "true";
    if (operands.length === 1)
      return this.generate(operands[0], "value");
    const parts = operands.map((op) => this.generate(op, "value"));
    return `(${parts.join(" && ")})`;
  }
  generateLogicalOr(head, rest, context, sexpr) {
    const flattened = this.flattenBinaryChain(sexpr);
    const operands = flattened.slice(1);
    if (operands.length === 0)
      return "true";
    if (operands.length === 1)
      return this.generate(operands[0], "value");
    const parts = operands.map((op) => this.generate(op, "value"));
    return `(${parts.join(" || ")})`;
  }
  generateArray(head, elements, context, sexpr) {
    const hasTrailingElision = elements.length > 0 && elements[elements.length - 1] === ",";
    const elementCodes = elements.map((el) => {
      if (el === ",") {
        return "";
      }
      if (el === "...") {
        return "";
      }
      if (Array.isArray(el) && el[0] === "...") {
        return `...${this.generate(el[1], "value")}`;
      }
      return this.generate(el, "value");
    }).join(", ");
    return hasTrailingElision ? `[${elementCodes},]` : `[${elementCodes}]`;
  }
  generateObject(head, pairs, context, sexpr) {
    if (pairs.length === 1 && Array.isArray(pairs[0]) && Array.isArray(pairs[0][1]) && pairs[0][1][0] === "comprehension") {
      const [keyVar, comprehensionNode] = pairs[0];
      const [, valueExpr, iterators, guards] = comprehensionNode;
      return this.generate(["object-comprehension", keyVar, valueExpr, iterators, guards], context);
    }
    const pairCodes = pairs.map((pair) => {
      if (Array.isArray(pair) && pair[0] === "...") {
        return `...${this.generate(pair[1], "value")}`;
      }
      const [key2, value, operator] = pair;
      let keyCode;
      if (Array.isArray(key2) && key2[0] === "computed") {
        const expr = key2[1];
        keyCode = `[${this.generate(expr, "value")}]`;
      } else {
        keyCode = this.generate(key2, "value");
      }
      const valueCode = this.generate(value, "value");
      if (operator === "=") {
        return `${keyCode} = ${valueCode}`;
      } else if (operator === ":") {
        return `${keyCode}: ${valueCode}`;
      } else {
        if (keyCode === valueCode && !Array.isArray(key2)) {
          return keyCode;
        }
        return `${keyCode}: ${valueCode}`;
      }
    }).join(", ");
    return `{${pairCodes}}`;
  }
  generateBlock(head, statements, context, sexpr) {
    if (context === "statement") {
      const stmts = this.withIndent(() => this.formatStatements(statements));
      return `{
${stmts.join(`
`)}
${this.indent()}}`;
    }
    return this.formatStatements(statements, context);
  }
  generateTry(head, rest, context, sexpr) {
    const needsReturns = context === "value";
    let tryCode = "try ";
    const tryBlock = rest[0];
    if (needsReturns && Array.isArray(tryBlock) && tryBlock[0] === "block") {
      tryCode += this.generateBlockWithReturns(tryBlock);
    } else {
      tryCode += this.generate(tryBlock, "statement");
    }
    if (rest.length >= 2 && Array.isArray(rest[1]) && rest[1].length === 2 && rest[1][0] !== "block") {
      let [param, catchBlock] = rest[1];
      tryCode += " catch";
      if (param && Array.isArray(param) && (param[0] === "object" || param[0] === "array")) {
        const tempVar = "error";
        tryCode += ` (${tempVar})`;
        const destructPattern = this.generate(param, "value");
        const destructStmt = `(${destructPattern} = ${tempVar})`;
        if (Array.isArray(catchBlock) && catchBlock[0] === "block") {
          catchBlock = ["block", destructStmt, ...catchBlock.slice(1)];
        } else {
          catchBlock = ["block", destructStmt, catchBlock];
        }
      } else if (param) {
        tryCode += ` (${param})`;
      }
      if (needsReturns && Array.isArray(catchBlock) && catchBlock[0] === "block") {
        tryCode += " " + this.generateBlockWithReturns(catchBlock);
      } else {
        tryCode += " " + this.generate(catchBlock, "statement");
      }
    } else if (rest.length === 2) {
      tryCode += " finally " + this.generate(rest[1], "statement");
    }
    if (rest.length === 3) {
      tryCode += " finally " + this.generate(rest[2], "statement");
    }
    if (needsReturns) {
      const isAsync = this.containsAwait(rest[0]) || rest[1] && this.containsAwait(rest[1]);
      const asyncPrefix = isAsync ? "async " : "";
      return `(${asyncPrefix}() => { ${tryCode} })()`;
    }
    return tryCode;
  }
  generateThrow(head, rest, context, sexpr) {
    let [expr] = rest;
    let extractedCond = null;
    if (Array.isArray(expr)) {
      let checkExpr = expr;
      let wrapperType = null;
      if (expr[0] === "new" && Array.isArray(expr[1]) && (expr[1][0] === "if" || expr[1][0] === "unless")) {
        wrapperType = "new";
        checkExpr = expr[1];
      } else if (expr[0] === "if" || expr[0] === "unless") {
        checkExpr = expr;
      }
      if (checkExpr[0] === "if" || checkExpr[0] === "unless") {
        const [condType, condition, body] = checkExpr;
        const isUnless = condType === "unless";
        let unwrappedBody = body;
        if (Array.isArray(body) && body.length === 1) {
          unwrappedBody = body[0];
        }
        if (wrapperType === "new") {
          expr = ["new", unwrappedBody];
        } else {
          expr = unwrappedBody;
        }
        const condCode = this.generate(condition, "value");
        const throwCode = `throw ${this.generate(expr, "value")}`;
        if (isUnless) {
          return `if (!(${condCode})) {
${this.indent()}  ${throwCode};
${this.indent()}}`;
        } else {
          return `if (${condCode}) {
${this.indent()}  ${throwCode};
${this.indent()}}`;
        }
      }
    }
    const throwStmt = `throw ${this.generate(expr, "value")}`;
    if (context === "value") {
      return `(() => { ${throwStmt}; })()`;
    }
    return throwStmt;
  }
  generateSwitch(head, rest, context, sexpr) {
    const [discriminant, whens, defaultCase] = rest;
    if (discriminant === null) {
      return this.generateSwitchAsIfChain(whens, defaultCase, context);
    }
    let switchBody = `switch (${this.generate(discriminant, "value")}) {
`;
    this.indentLevel++;
    const normalize = (v) => v instanceof String ? v.valueOf() : v;
    for (const whenClause of whens) {
      const [, test, body] = whenClause;
      const firstTest = normalize(Array.isArray(test) && test.length > 0 ? test[0] : null);
      const isTestList = Array.isArray(test) && test.length > 0 && typeof firstTest === "string" && !firstTest.match(/^[-+*\/%<>=!&|^~]$|^(typeof|delete|new|not|await|yield)$/);
      const tests = isTestList ? test : [test];
      for (const t of tests) {
        const tValue = normalize(t);
        let caseValue;
        if (Array.isArray(tValue)) {
          caseValue = this.generate(tValue, "value");
        } else if (typeof tValue === "string" && (tValue.startsWith('"') || tValue.startsWith("'"))) {
          caseValue = `'${tValue.slice(1, -1)}'`;
        } else {
          caseValue = this.generate(tValue, "value");
        }
        switchBody += this.indent() + `case ${caseValue}:
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
      const containsAwait = whens.some((w) => this.containsAwait(w[2])) || defaultCase && this.containsAwait(defaultCase);
      const asyncPrefix = containsAwait ? "async " : "";
      return `(${asyncPrefix}() => { ${switchBody} })()`;
    }
    return switchBody;
  }
  generateWhen(head, rest, context, sexpr) {
    throw new Error("when clause should be handled by switch");
  }
  generateComprehension(head, rest, context, sexpr) {
    const [expr, iterators, guards] = rest;
    if (context === "statement") {
      return this.generateComprehensionAsLoop(expr, iterators, guards);
    }
    if (this.comprehensionTarget) {
      const code2 = this.generateComprehensionWithTarget(expr, iterators, guards, this.comprehensionTarget);
      return code2;
    }
    const hasAwait = this.containsAwait(expr);
    const asyncPrefix = hasAwait ? "async " : "";
    let code = `(${asyncPrefix}() => {
`;
    this.indentLevel++;
    this.comprehensionDepth++;
    code += this.indent() + `const result = [];
`;
    for (const iterator of iterators) {
      const [iterType, vars, iterable, stepOrOwn] = iterator;
      if (iterType === "for-in") {
        const step = stepOrOwn;
        const varsArray = Array.isArray(vars) ? vars : [vars];
        const noVar = varsArray.length === 0;
        const [firstVar, indexVar] = noVar ? ["_i", null] : varsArray;
        let itemVarPattern = firstVar;
        if (Array.isArray(firstVar) && (firstVar[0] === "array" || firstVar[0] === "object")) {
          itemVarPattern = this.generateDestructuringPattern(firstVar);
        }
        if (step && step !== null) {
          let iterableHead = Array.isArray(iterable) && iterable[0];
          if (iterableHead instanceof String) {
            iterableHead = iterableHead.valueOf();
          }
          const isRange = iterableHead === ".." || iterableHead === "...";
          if (isRange) {
            const isExclusive = iterableHead === "...";
            const [start, end] = iterable.slice(1);
            const startCode = this.generate(start, "value");
            const endCode = this.generate(end, "value");
            const stepCode = this.generate(step, "value");
            const comparison = isExclusive ? "<" : "<=";
            code += this.indent() + `for (let ${itemVarPattern} = ${startCode}; ${itemVarPattern} ${comparison} ${endCode}; ${itemVarPattern} += ${stepCode}) {
`;
            this.indentLevel++;
          } else {
            const iterableCode = this.generate(iterable, "value");
            const indexVarName2 = indexVar || "_i";
            const stepCode = this.generate(step, "value");
            const isNegativeStep = this.isNegativeStep(step);
            if (isNegativeStep) {
              code += this.indent() + `for (let ${indexVarName2} = ${iterableCode}.length - 1; ${indexVarName2} >= 0; ${indexVarName2} += ${stepCode}) {
`;
            } else {
              code += this.indent() + `for (let ${indexVarName2} = 0; ${indexVarName2} < ${iterableCode}.length; ${indexVarName2} += ${stepCode}) {
`;
            }
            this.indentLevel++;
            if (!noVar) {
              code += this.indent() + `const ${itemVarPattern} = ${iterableCode}[${indexVarName2}];
`;
            }
          }
        } else if (indexVar) {
          const iterableCode = this.generate(iterable, "value");
          code += this.indent() + `for (let ${indexVar} = 0; ${indexVar} < ${iterableCode}.length; ${indexVar}++) {
`;
          this.indentLevel++;
          code += this.indent() + `const ${itemVarPattern} = ${iterableCode}[${indexVar}];
`;
        } else {
          code += this.indent() + `for (const ${itemVarPattern} of ${this.generate(iterable, "value")}) {
`;
          this.indentLevel++;
        }
      } else if (iterType === "for-of") {
        const own = stepOrOwn;
        const varsArray = Array.isArray(vars) ? vars : [vars];
        const [firstVar, secondVar] = varsArray;
        let keyVarPattern = firstVar;
        if (Array.isArray(firstVar) && (firstVar[0] === "array" || firstVar[0] === "object")) {
          keyVarPattern = this.generateDestructuringPattern(firstVar);
        }
        const objCode = this.generate(iterable, "value");
        code += this.indent() + `for (const ${keyVarPattern} in ${objCode}) {
`;
        this.indentLevel++;
        if (own) {
          code += this.indent() + `if (!Object.hasOwn(${objCode}, ${keyVarPattern})) continue;
`;
        }
        if (secondVar) {
          code += this.indent() + `const ${secondVar} = ${objCode}[${keyVarPattern}];
`;
        }
      } else if (iterType === "for-from") {
        const isAwait = iterator[3];
        const varsArray = Array.isArray(vars) ? vars : [vars];
        const [firstVar] = varsArray;
        let itemVarPattern = firstVar;
        if (Array.isArray(firstVar) && (firstVar[0] === "array" || firstVar[0] === "object")) {
          itemVarPattern = this.generateDestructuringPattern(firstVar);
        }
        const awaitKeyword = isAwait ? "await " : "";
        code += this.indent() + `for ${awaitKeyword}(const ${itemVarPattern} of ${this.generate(iterable, "value")}) {
`;
        this.indentLevel++;
      }
    }
    for (const guard of guards) {
      code += this.indent() + `if (${this.generate(guard, "value")}) {
`;
      this.indentLevel++;
    }
    const hasControlFlow = (node) => {
      if (typeof node === "string" && (node === "break" || node === "continue")) {
        return true;
      }
      if (!Array.isArray(node))
        return false;
      if (node[0] === "break" || node[0] === "continue" || node[0] === "break-if" || node[0] === "continue-if" || node[0] === "return" || node[0] === "throw")
        return true;
      if (node[0] === "if" || node[0] === "unless") {
        return node.slice(1).some((child) => hasControlFlow(child));
      }
      return node.some((child) => hasControlFlow(child));
    };
    if (Array.isArray(expr) && expr[0] === "block") {
      const statements = expr.slice(1);
      for (let i = 0;i < statements.length; i++) {
        const stmt = statements[i];
        const isLast = i === statements.length - 1;
        const stmtHasControlFlow = hasControlFlow(stmt);
        if (!isLast || stmtHasControlFlow) {
          code += this.indent() + this.generate(stmt, "statement") + `;
`;
        } else {
          const isLoopStmt = Array.isArray(stmt) && ["for-in", "for-of", "for-from", "while", "until", "loop"].includes(stmt[0]);
          if (isLoopStmt) {
            code += this.indent() + this.generate(stmt, "statement") + `;
`;
          } else {
            code += this.indent() + `result.push(${this.generate(stmt, "value")});
`;
          }
        }
      }
    } else {
      if (hasControlFlow(expr)) {
        code += this.indent() + this.generate(expr, "statement") + `;
`;
      } else {
        const isLoopStmt = Array.isArray(expr) && ["for-in", "for-of", "for-from", "while", "until", "loop"].includes(expr[0]);
        if (isLoopStmt) {
          code += this.indent() + this.generate(expr, "statement") + `;
`;
        } else {
          code += this.indent() + `result.push(${this.generate(expr, "value")});
`;
        }
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
  generateObjectComprehension(head, rest, context, sexpr) {
    const [keyExpr, valueExpr, iterators, guards] = rest;
    let code = `(() => {
`;
    this.indentLevel++;
    code += this.indent() + `const result = {};
`;
    for (const iterator of iterators) {
      const [iterType, vars, iterable, own] = iterator;
      if (iterType === "for-of") {
        const [keyVar, valueVar] = vars;
        const iterableCode = this.generate(iterable, "value");
        code += this.indent() + `for (const ${keyVar} in ${iterableCode}) {
`;
        this.indentLevel++;
        if (own) {
          code += this.indent() + `if (!Object.hasOwn(${iterableCode}, ${keyVar})) continue;
`;
        }
        if (valueVar) {
          code += this.indent() + `const ${valueVar} = ${iterableCode}[${keyVar}];
`;
        }
      }
    }
    for (const guard of guards) {
      code += this.indent() + `if (${this.generate(guard, "value")}) {
`;
      this.indentLevel++;
    }
    const key2 = this.generate(keyExpr, "value");
    const value = this.generate(valueExpr, "value");
    code += this.indent() + `result[${key2}] = ${value};
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
  generateClass(head, rest, context, sexpr) {
    const [className, parentClass, ...bodyParts] = rest;
    let code = className ? `class ${className}` : "class";
    if (parentClass) {
      code += ` extends ${this.generate(parentClass, "value")}`;
    }
    code += ` {
`;
    if (bodyParts.length > 0 && Array.isArray(bodyParts[0])) {
      const bodyBlock = bodyParts[0];
      if (bodyBlock[0] === "block") {
        const bodyStatements = bodyBlock.slice(1);
        const hasObjectFirst = bodyStatements.length > 0 && Array.isArray(bodyStatements[0]) && bodyStatements[0][0] === "object";
        if (hasObjectFirst && bodyStatements.length === 1) {
          const objectLiteral = bodyStatements[0];
          const members = objectLiteral.slice(1);
          this.indentLevel++;
          const boundMethods = [];
          for (const [memberKey, memberValue] of members) {
            const isStatic = this.isStaticMember(memberKey);
            const isComputed = this.isComputedMember(memberKey);
            const methodName = this.extractMemberName(memberKey);
            if (this.isBoundMethod(memberValue) && !isStatic && !isComputed && methodName !== "constructor") {
              boundMethods.push(methodName);
            }
          }
          for (const [memberKey, memberValue] of members) {
            const isStatic = this.isStaticMember(memberKey);
            const isComputed = this.isComputedMember(memberKey);
            const methodName = this.extractMemberName(memberKey);
            if (Array.isArray(memberValue) && (memberValue[0] === "->" || memberValue[0] === "=>")) {
              const [arrowType, params, body] = memberValue;
              const containsAwait = this.containsAwait(body);
              const containsYield = this.containsYield(body);
              let cleanParams = params;
              let autoAssignments = [];
              if (methodName === "constructor") {
                cleanParams = params.map((param) => {
                  if (Array.isArray(param) && param[0] === "." && param[1] === "this") {
                    const propName = param[2];
                    autoAssignments.push(`this.${propName} = ${propName}`);
                    return propName;
                  }
                  return param;
                });
                for (const boundMethod of boundMethods) {
                  autoAssignments.unshift(`this.${boundMethod} = this.${boundMethod}.bind(this)`);
                }
              }
              const paramList = this.generateParamList(cleanParams);
              const asyncPrefix = containsAwait ? "async " : "";
              const generatorSuffix = containsYield ? "*" : "";
              if (isStatic) {
                code += this.indent() + `static ${asyncPrefix}${generatorSuffix}${methodName}(${paramList}) `;
              } else {
                code += this.indent() + `${asyncPrefix}${generatorSuffix}${methodName}(${paramList}) `;
              }
              const isConstructorMethod = methodName === "constructor";
              if (!isComputed) {
                this.currentMethodName = methodName;
              }
              code += this.generateMethodBody(body, autoAssignments, isConstructorMethod, cleanParams);
              this.currentMethodName = null;
              code += `
`;
            } else if (isStatic) {
              const propValue = this.generate(memberValue, "value");
              code += this.indent() + `static ${methodName} = ${propValue};
`;
            } else {
              const propValue = this.generate(memberValue, "value");
              code += this.indent() + `${methodName} = ${propValue};
`;
            }
          }
          this.indentLevel--;
        } else if (hasObjectFirst) {
          const objectLiteral = bodyStatements[0];
          const members = objectLiteral.slice(1);
          const additionalStatements = bodyStatements.slice(1);
          this.indentLevel++;
          for (const [memberKey, memberValue] of members) {
            const isStatic = this.isStaticMember(memberKey);
            const isComputed = this.isComputedMember(memberKey);
            const methodName = this.extractMemberName(memberKey);
            if (Array.isArray(memberValue) && (memberValue[0] === "->" || memberValue[0] === "=>")) {
              const [arrowType, params, body] = memberValue;
              const containsAwait = this.containsAwait(body);
              const containsYield = this.containsYield(body);
              const paramList = this.generateParamList(params);
              const asyncPrefix = containsAwait ? "async " : "";
              const generatorSuffix = containsYield ? "*" : "";
              if (isStatic) {
                code += this.indent() + `static ${asyncPrefix}${generatorSuffix}${methodName}(${paramList}) `;
              } else {
                code += this.indent() + `${asyncPrefix}${generatorSuffix}${methodName}(${paramList}) `;
              }
              this.currentMethodName = methodName;
              code += this.generateMethodBody(body, [], methodName === "constructor", params);
              this.currentMethodName = null;
              code += `
`;
            } else if (isStatic) {
              const propValue = this.generate(memberValue, "value");
              code += this.indent() + `static ${methodName} = ${propValue};
`;
            } else {
              const propValue = this.generate(memberValue, "value");
              code += this.indent() + `${methodName} = ${propValue};
`;
            }
          }
          for (const stmt of additionalStatements) {
            if (Array.isArray(stmt) && stmt[0] === "class") {
              const [, nestedName, parent, ...nestedBody] = stmt;
              if (Array.isArray(nestedName) && nestedName[0] === "." && nestedName[1] === "this") {
                const innerName = nestedName[2];
                code += this.indent() + `static ${innerName} = `;
                const classCode = this.generate(["class", null, parent, ...nestedBody], "value");
                code += classCode + `;
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
          for (const stmt of bodyStatements) {
            if (Array.isArray(stmt) && stmt[0] === "=" && Array.isArray(stmt[1]) && stmt[1][0] === "." && stmt[1][1] === "this") {
              const propName = stmt[1][2];
              const value = this.generate(stmt[2], "value");
              code += this.indent() + `static ${propName} = ${value};
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
  generateSuper(head, rest, context, sexpr) {
    if (rest.length === 0) {
      if (this.currentMethodName && this.currentMethodName !== "constructor") {
        return `super.${this.currentMethodName}()`;
      }
      return "super";
    }
    const argsCode = rest.map((arg) => this.unwrap(this.generate(arg, "value"))).join(", ");
    if (this.currentMethodName && this.currentMethodName !== "constructor") {
      return `super.${this.currentMethodName}(${argsCode})`;
    }
    return `super(${argsCode})`;
  }
  generateSoakCall(head, rest, context, sexpr) {
    const [fn, ...args] = rest;
    const fnCode = this.generate(fn, "value");
    const argsCode = args.map((arg) => this.generate(arg, "value")).join(", ");
    return `(typeof ${fnCode} === 'function' ? ${fnCode}(${argsCode}) : undefined)`;
  }
  generateImport(head, rest, context, sexpr) {
    if (rest.length === 1) {
      const [urlExpr] = rest;
      return `import(${this.generate(urlExpr, "value")})`;
    }
    const [specifier, source] = rest;
    const fixedSource = this.addJsExtensionAndAssertions(source);
    if (typeof specifier === "string") {
      return `import ${specifier} from ${fixedSource}`;
    }
    if (Array.isArray(specifier)) {
      if (specifier[0] === "*" && specifier.length === 2) {
        return `import * as ${specifier[1]} from ${fixedSource}`;
      }
      if (typeof specifier[0] === "string" && Array.isArray(specifier[1])) {
        const defaultImport = specifier[0];
        const secondPart = specifier[1];
        if (secondPart[0] === "*" && secondPart.length === 2) {
          return `import ${defaultImport}, * as ${secondPart[1]} from ${fixedSource}`;
        }
        const names2 = (Array.isArray(secondPart) ? secondPart : [secondPart]).map((item) => {
          if (Array.isArray(item) && item.length === 2) {
            return `${item[0]} as ${item[1]}`;
          }
          return item;
        }).join(", ");
        return `import ${defaultImport}, { ${names2} } from ${fixedSource}`;
      }
      const names = specifier.map((item) => {
        if (Array.isArray(item) && item.length === 2) {
          return `${item[0]} as ${item[1]}`;
        }
        return item;
      }).join(", ");
      return `import { ${names} } from ${fixedSource}`;
    }
    return `import ${this.generate(specifier, "value")} from ${fixedSource}`;
  }
  generateExport(head, rest, context, sexpr) {
    const [declaration] = rest;
    if (Array.isArray(declaration) && declaration.every((item) => typeof item === "string")) {
      const names = declaration.join(", ");
      return `export { ${names} }`;
    }
    if (Array.isArray(declaration) && declaration[0] === "=") {
      const [, target, value] = declaration;
      return `export const ${target} = ${this.generate(value, "value")}`;
    }
    return `export ${this.generate(declaration, "statement")}`;
  }
  generateExportDefault(head, rest, context, sexpr) {
    const [expr] = rest;
    if (Array.isArray(expr) && expr[0] === "=") {
      const [, target, value] = expr;
      const assignCode = `const ${target} = ${this.generate(value, "value")}`;
      return `${assignCode};
export default ${target}`;
    }
    return `export default ${this.generate(expr, "statement")}`;
  }
  generateExportAll(head, rest, context, sexpr) {
    const [source] = rest;
    const fixedSource = this.addJsExtensionAndAssertions(source);
    return `export * from ${fixedSource}`;
  }
  generateExportFrom(head, rest, context, sexpr) {
    const [specifiers, source] = rest;
    const fixedSource = this.addJsExtensionAndAssertions(source);
    if (Array.isArray(specifiers)) {
      const names = specifiers.map((item) => {
        if (Array.isArray(item) && item.length === 2) {
          return `${item[0]} as ${item[1]}`;
        }
        return item;
      }).join(", ");
      return `export { ${names} } from ${fixedSource}`;
    }
    return `export ${specifiers} from ${fixedSource}`;
  }
  generateDoIIFE(head, rest, context, sexpr) {
    const [arrowFn] = rest;
    const fnCode = this.generate(arrowFn, "statement");
    return `(${fnCode})()`;
  }
  generateRegex(head, rest, context, sexpr) {
    if (rest.length === 0) {
      return head;
    }
    const [pattern] = rest;
    return this.generate(pattern, "value");
  }
  generateTaggedTemplate(head, rest, context, sexpr) {
    const [tag, str] = rest;
    const tagCode = this.generate(tag, "value");
    let templateContent = this.generate(str, "value");
    if (templateContent.startsWith("`")) {
      return `${tagCode}${templateContent}`;
    }
    if (templateContent.startsWith('"') || templateContent.startsWith("'")) {
      const content = templateContent.slice(1, -1);
      return `${tagCode}\`${content}\``;
    }
    return `${tagCode}\`${templateContent}\``;
  }
  generateString(head, rest, context, sexpr) {
    let result = "`";
    for (let i = 0;i < rest.length; i++) {
      const part = rest[i];
      if (part instanceof String) {
        result += this.extractStringContent(part);
      } else if (typeof part === "string") {
        if (part.startsWith('"') || part.startsWith("'")) {
          if (this.options.debug) {
            console.warn("[Rip] Unexpected quoted primitive in str interpolation:", part);
          }
          result += part.slice(1, -1);
        } else {
          result += part;
        }
      } else if (Array.isArray(part)) {
        if (part.length === 1 && typeof part[0] === "string" && !Array.isArray(part[0])) {
          const value = part[0];
          const isLiteral = /^[\d"']/.test(value);
          if (isLiteral) {
            result += "${" + this.generate(value, "value") + "}";
          } else {
            result += "${" + value + "}";
          }
        } else {
          let expr = part;
          if (part.length === 1 && Array.isArray(part[0])) {
            expr = part[0];
          }
          result += "${" + this.generate(expr, "value") + "}";
        }
      }
    }
    result += "`";
    return result;
  }
  findPostfixConditional(expr) {
    if (!Array.isArray(expr))
      return null;
    const head = expr[0];
    if ((head === "unless" || head === "if") && expr.length === 3) {
      return { type: head, condition: expr[1], value: expr[2] };
    }
    if (head === "+" || head === "-" || head === "*" || head === "/") {
      for (let i = 1;i < expr.length; i++) {
        const found = this.findPostfixConditional(expr[i]);
        if (found) {
          found.parentOp = head;
          found.operandIndex = i;
          found.otherOperands = expr.slice(1).filter((_, idx) => idx !== i - 1);
          return found;
        }
      }
    }
    return null;
  }
  generateDestructuringPattern(pattern) {
    return this.formatParam(pattern);
  }
  generateParamList(params) {
    const expansionIndex = params.findIndex((p) => Array.isArray(p) && p[0] === "expansion");
    if (expansionIndex !== -1) {
      const beforeExpansion = params.slice(0, expansionIndex);
      const afterExpansion = params.slice(expansionIndex + 1);
      const regularParams = beforeExpansion.map((p) => this.formatParam(p)).join(", ");
      const paramList = regularParams ? `${regularParams}, ..._rest` : "..._rest";
      this.expansionAfterParams = afterExpansion;
      return paramList;
    }
    const restIndex = params.findIndex((p) => Array.isArray(p) && p[0] === "rest");
    if (restIndex !== -1 && restIndex < params.length - 1) {
      const beforeRest = params.slice(0, restIndex);
      const restParam = params[restIndex];
      const afterRest = params.slice(restIndex + 1);
      const beforeParams = beforeRest.map((p) => this.formatParam(p));
      const paramList = beforeParams.length > 0 ? `${beforeParams.join(", ")}, ...${restParam[1]}` : `...${restParam[1]}`;
      this.restMiddleParam = {
        restName: restParam[1],
        afterParams: afterRest,
        beforeCount: beforeRest.length
      };
      return paramList;
    }
    this.expansionAfterParams = null;
    this.restMiddleParam = null;
    return params.map((p) => this.formatParam(p)).join(", ");
  }
  formatParam(param) {
    if (typeof param === "string") {
      return param;
    }
    if (Array.isArray(param) && param[0] === "rest") {
      return `...${param[1]}`;
    }
    if (Array.isArray(param) && param[0] === "default") {
      const [, varName, defaultValue] = param;
      return `${varName} = ${this.generate(defaultValue, "value")}`;
    }
    if (Array.isArray(param) && param[0] === "." && param[1] === "this") {
      return param[2];
    }
    if (Array.isArray(param) && param[0] === "array") {
      const elements = param.slice(1).map((el) => {
        if (el === ",")
          return "";
        if (el === "...")
          return "";
        if (Array.isArray(el) && el[0] === "...") {
          return `...${el[1]}`;
        }
        if (Array.isArray(el) && el[0] === "=" && typeof el[1] === "string") {
          const [, varName, defaultValue] = el;
          return `${varName} = ${this.generate(defaultValue, "value")}`;
        }
        if (typeof el === "string")
          return el;
        return this.formatParam(el);
      });
      return `[${elements.join(", ")}]`;
    }
    if (Array.isArray(param) && param[0] === "object") {
      const pairs = param.slice(1).map((pair) => {
        if (Array.isArray(pair) && pair[0] === "...") {
          return `...${pair[1]}`;
        }
        if (Array.isArray(pair) && pair[0] === "default") {
          const [, key3, defaultValue] = pair;
          const defaultCode = this.generate(defaultValue, "value");
          return `${key3} = ${defaultCode}`;
        }
        const [key2, value] = pair;
        if (key2 === value)
          return key2;
        return `${key2}: ${value}`;
      });
      return `{${pairs.join(", ")}}`;
    }
    return JSON.stringify(param);
  }
  generateBodyWithReturns(body, params = [], options = {}) {
    const {
      sideEffectOnly = false,
      autoAssignments = [],
      isConstructor = false,
      hasExpansionParams = false
    } = options;
    const prevSideEffectOnly = this.sideEffectOnly;
    this.sideEffectOnly = sideEffectOnly;
    const paramNames = new Set;
    const extractParamNames = (param) => {
      if (typeof param === "string") {
        paramNames.add(param);
      } else if (Array.isArray(param)) {
        if (param[0] === "rest" || param[0] === "...") {
          if (typeof param[1] === "string")
            paramNames.add(param[1]);
        } else if (param[0] === "default") {
          if (typeof param[1] === "string")
            paramNames.add(param[1]);
        } else if (param[0] === "array" || param[0] === "object") {
          this.collectVarsFromArray(param, paramNames);
        }
      }
    };
    if (Array.isArray(params)) {
      params.forEach(extractParamNames);
    }
    const bodyVars = this.collectFunctionVariables(body);
    const newVars = new Set([...bodyVars].filter((v) => !this.programVars.has(v) && !this.reactiveVars?.has(v) && !paramNames.has(v)));
    const noReturnStatements = ["return", "throw", "break", "continue"];
    const loopStatements = ["for-in", "for-of", "for-from", "while", "until", "loop"];
    if (Array.isArray(body) && body[0] === "block") {
      let statements = this.unwrapBlock(body);
      if (hasExpansionParams && this.expansionAfterParams && this.expansionAfterParams.length > 0) {
        const extractions = this.expansionAfterParams.map((param, idx) => {
          const paramName = typeof param === "string" ? param : JSON.stringify(param);
          return `const ${paramName} = _rest[_rest.length - ${this.expansionAfterParams.length - idx}]`;
        });
        statements = [...extractions, ...statements];
        this.expansionAfterParams = null;
      }
      if (this.restMiddleParam) {
        const { restName, afterParams } = this.restMiddleParam;
        const afterCount = afterParams.length;
        const extractions = [];
        afterParams.forEach((param, idx) => {
          const paramName = typeof param === "string" ? param : Array.isArray(param) && param[0] === "default" ? param[1] : JSON.stringify(param);
          const position = afterCount - idx;
          extractions.push(`const ${paramName} = ${restName}[${restName}.length - ${position}]`);
        });
        if (afterCount > 0) {
          extractions.push(`${restName} = ${restName}.slice(0, -${afterCount})`);
        }
        statements = [...extractions, ...statements];
        this.restMiddleParam = null;
      }
      this.indentLevel++;
      let code = `{
`;
      if (newVars.size > 0) {
        const vars = Array.from(newVars).sort().join(", ");
        code += this.indent() + `let ${vars};
`;
      }
      const firstIsSuper = autoAssignments.length > 0 && statements.length > 0 && Array.isArray(statements[0]) && statements[0][0] === "super";
      if (firstIsSuper) {
        const isSuperOnly = statements.length === 1;
        if (isSuperOnly && !isConstructor) {
          code += this.indent() + "return " + this.generate(statements[0], "value") + `;
`;
        } else {
          code += this.indent() + this.generate(statements[0], "statement") + `;
`;
        }
        for (const assignment of autoAssignments) {
          code += this.indent() + assignment + `;
`;
        }
        statements.slice(1).forEach((stmt, index) => {
          const isLast = index === statements.length - 2;
          const head = Array.isArray(stmt) ? stmt[0] : null;
          if (!isLast && head === "comprehension") {
            const [, expr, iterators, guards] = stmt;
            code += this.indent() + this.generateComprehensionAsLoop(expr, iterators, guards) + `
`;
            return;
          }
          if (!isConstructor && isLast && (head === "if" || head === "unless")) {
            const [condition, thenBranch, ...elseBranches] = stmt.slice(1);
            const hasMultipleStatements = (branch) => {
              return Array.isArray(branch) && branch[0] === "block" && branch.length > 2;
            };
            if (hasMultipleStatements(thenBranch) || elseBranches.some(hasMultipleStatements)) {
              code += this.generateIfElseWithEarlyReturns(stmt);
              return;
            }
          }
          const needsReturn = !isConstructor && !sideEffectOnly && isLast && !noReturnStatements.includes(head) && !loopStatements.includes(head) && !this.hasExplicitControlFlow(stmt);
          const context = needsReturn ? "value" : "statement";
          const stmtCode = this.generate(stmt, context);
          if (needsReturn) {
            code += this.indent() + "return " + stmtCode + `;
`;
          } else {
            code += this.indent() + this.addSemicolon(stmt, stmtCode) + `
`;
          }
        });
      } else {
        for (const assignment of autoAssignments) {
          code += this.indent() + assignment + `;
`;
        }
        statements.forEach((stmt, index) => {
          const isLast = index === statements.length - 1;
          const head = Array.isArray(stmt) ? stmt[0] : null;
          if (!isLast && head === "comprehension") {
            const [, expr, iterators, guards] = stmt;
            code += this.indent() + this.generateComprehensionAsLoop(expr, iterators, guards) + `
`;
            return;
          }
          if (!isConstructor && !sideEffectOnly && isLast && (head === "if" || head === "unless")) {
            const [condition, thenBranch, ...elseBranches] = stmt.slice(1);
            const hasMultipleStatements = (branch) => {
              return Array.isArray(branch) && branch[0] === "block" && branch.length > 2;
            };
            if (hasMultipleStatements(thenBranch) || elseBranches.some(hasMultipleStatements)) {
              code += this.generateIfElseWithEarlyReturns(stmt);
              return;
            }
          }
          if (!isConstructor && !sideEffectOnly && isLast && head === "=") {
            const [target, value] = stmt.slice(1);
            if (typeof target === "string" && Array.isArray(value)) {
              const valueHead = value[0];
              if (valueHead === "comprehension" || valueHead === "for-in") {
                this.comprehensionTarget = target;
                code += this.generate(value, "value");
                this.comprehensionTarget = null;
                code += this.indent() + `return ${target};
`;
                return;
              }
            }
          }
          const needsReturn = !isConstructor && !sideEffectOnly && isLast && !noReturnStatements.includes(head) && !loopStatements.includes(head) && !this.hasExplicitControlFlow(stmt);
          const context = needsReturn ? "value" : "statement";
          const stmtCode = this.generate(stmt, context);
          if (needsReturn) {
            code += this.indent() + "return " + stmtCode + `;
`;
          } else {
            code += this.indent() + this.addSemicolon(stmt, stmtCode) + `
`;
          }
        });
      }
      if (sideEffectOnly && statements.length > 0) {
        const lastStmt = statements[statements.length - 1];
        const lastStmtType = Array.isArray(lastStmt) ? lastStmt[0] : null;
        if (!noReturnStatements.includes(lastStmtType)) {
          code += this.indent() + `return;
`;
        }
      }
      this.indentLevel--;
      code += this.indent() + "}";
      this.sideEffectOnly = prevSideEffectOnly;
      return code;
    }
    if (isConstructor || this.hasExplicitControlFlow(body)) {
      this.sideEffectOnly = prevSideEffectOnly;
      return `{ ${this.generate(body, "statement")}; }`;
    }
    if (Array.isArray(body) && (noReturnStatements.includes(body[0]) || loopStatements.includes(body[0]))) {
      this.sideEffectOnly = prevSideEffectOnly;
      return `{ ${this.generate(body, "statement")}; }`;
    }
    this.sideEffectOnly = prevSideEffectOnly;
    if (sideEffectOnly) {
      const stmtCode = this.generate(body, "statement");
      return `{ ${stmtCode}; return; }`;
    }
    return `{ return ${this.generate(body, "value")}; }`;
  }
  generateFunctionBody(body, params = [], sideEffectOnly = false) {
    const hasExpansionParams = this.expansionAfterParams?.length > 0;
    return this.generateBodyWithReturns(body, params, {
      sideEffectOnly,
      hasExpansionParams
    });
  }
  generateBlockWithReturns(block) {
    if (!Array.isArray(block) || block[0] !== "block") {
      return this.generate(block, "statement");
    }
    const statements = this.unwrapBlock(block);
    const stmts = this.withIndent(() => {
      return statements.map((stmt, index) => {
        const isLast = index === statements.length - 1;
        const head = Array.isArray(stmt) ? stmt[0] : null;
        const noReturnStatements = ["return", "throw", "break", "continue"];
        const needsReturn = isLast && !noReturnStatements.includes(head);
        const context = needsReturn ? "value" : "statement";
        const code = this.generate(stmt, context);
        if (needsReturn) {
          return this.indent() + "return " + code + ";";
        }
        return this.indent() + code + ";";
      });
    });
    return `{
${stmts.join(`
`)}
${this.indent()}}`;
  }
  extractExpression(branch) {
    const statements = this.unwrapBlock(branch);
    if (statements.length > 0) {
      return this.generate(statements[statements.length - 1], "value");
    }
    return "undefined";
  }
  generateMethodBody(body, autoAssignments = [], isConstructor = false, params = []) {
    return this.generateBodyWithReturns(body, params, {
      autoAssignments,
      isConstructor
    });
  }
  generateLoopBody(body) {
    if (!Array.isArray(body)) {
      if (Array.isArray(body) && body[0] === "comprehension") {
        const [, expr, iterators, guards] = body;
        return `{ ${this.generateComprehensionAsLoop(expr, iterators, guards)} }`;
      }
      return `{ ${this.generate(body, "statement")}; }`;
    }
    if (body[0] === "block" || Array.isArray(body[0])) {
      const statements = body[0] === "block" ? body.slice(1) : body;
      const stmts = this.withIndent(() => {
        return statements.map((stmt) => {
          if (Array.isArray(stmt) && stmt[0] === "comprehension") {
            const [, expr, iterators, guards] = stmt;
            return this.indent() + this.generateComprehensionAsLoop(expr, iterators, guards);
          }
          return this.indent() + this.addSemicolon(stmt, this.generate(stmt, "statement"));
        });
      });
      return `{
${stmts.join(`
`)}
${this.indent()}}`;
    }
    return `{ ${this.generate(body, "statement")}; }`;
  }
  generateLoopBodyWithGuard(body, guard) {
    const guardCondition = this.unwrap(this.generate(guard, "value"));
    if (!Array.isArray(body)) {
      return `{ if (${guardCondition}) ${this.generate(body, "statement")}; }`;
    }
    if (body[0] === "block" || Array.isArray(body[0])) {
      const statements = body[0] === "block" ? body.slice(1) : body;
      const loopBodyIndent = this.withIndent(() => this.indent());
      const guardCode = `if (${guardCondition}) {
`;
      const stmts = this.withIndent(() => {
        this.indentLevel++;
        const result = this.formatStatements(statements);
        this.indentLevel--;
        return result;
      });
      const closeBrace = this.withIndent(() => this.indent() + "}");
      return `{
${loopBodyIndent}${guardCode}${stmts.join(`
`)}
${closeBrace}
${this.indent()}}`;
    }
    return `{ if (${this.generate(guard, "value")}) ${this.generate(body, "statement")}; }`;
  }
  addJsExtensionAndAssertions(source) {
    if (source instanceof String) {
      source = source.valueOf();
    }
    if (typeof source !== "string") {
      return source;
    }
    const hasQuotes = source.startsWith('"') || source.startsWith("'");
    const path = hasQuotes ? source.slice(1, -1) : source;
    const isLocal = path.startsWith("./") || path.startsWith("../");
    let finalPath = path;
    let assertion = "";
    if (isLocal) {
      const lastSlash = path.lastIndexOf("/");
      const fileName = lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
      const hasExtension = fileName.includes(".");
      if (hasExtension) {
        if (fileName.endsWith(".json")) {
          assertion = " with { type: 'json' }";
        }
      } else {
        finalPath = path + ".js";
      }
    }
    const result = `'${finalPath}'`;
    return result + assertion;
  }
  shouldAwaitCall(identifier) {
    if (identifier instanceof String && identifier.await !== undefined) {
      return identifier.await === true;
    }
    return false;
  }
  containsAwait(sexpr) {
    if (!sexpr)
      return false;
    if (sexpr instanceof String && sexpr.await === true) {
      return true;
    }
    if (typeof sexpr !== "object")
      return false;
    if (Array.isArray(sexpr) && sexpr[0] === "await") {
      return true;
    }
    if (Array.isArray(sexpr) && sexpr[0] === "for-from" && sexpr[3] === true) {
      return true;
    }
    if (Array.isArray(sexpr) && (sexpr[0] === "def" || sexpr[0] === "->" || sexpr[0] === "=>" || sexpr[0] === "class")) {
      return false;
    }
    if (Array.isArray(sexpr)) {
      return sexpr.some((item) => this.containsAwait(item));
    }
    return false;
  }
  containsYield(sexpr) {
    if (!sexpr)
      return false;
    if (typeof sexpr !== "object")
      return false;
    if (Array.isArray(sexpr) && (sexpr[0] === "yield" || sexpr[0] === "yield-from")) {
      return true;
    }
    if (Array.isArray(sexpr) && (sexpr[0] === "def" || sexpr[0] === "->" || sexpr[0] === "=>" || sexpr[0] === "class")) {
      return false;
    }
    if (Array.isArray(sexpr)) {
      return sexpr.some((item) => this.containsYield(item));
    }
    return false;
  }
  extractStringContent(strObj) {
    let content = strObj.valueOf().slice(1, -1);
    if (strObj.indent) {
      const indentRegex = new RegExp(`\\n${strObj.indent}`, "g");
      content = content.replace(indentRegex, `
`);
    }
    if (strObj.initialChunk && content.startsWith(`
`)) {
      content = content.slice(1);
    }
    if (strObj.finalChunk && content.endsWith(`
`)) {
      content = content.slice(0, -1);
    }
    return content;
  }
  processHeregex(content) {
    let result = "";
    let inCharClass = false;
    let i = 0;
    while (i < content.length) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : null;
      const nextChar = content[i + 1];
      const isEscaped = () => {
        let backslashCount = 0;
        let j = i - 1;
        while (j >= 0 && content[j] === "\\") {
          backslashCount++;
          j--;
        }
        return backslashCount % 2 === 1;
      };
      if (char === "[" && !isEscaped()) {
        inCharClass = true;
        result += char;
        i++;
        continue;
      }
      if (char === "]" && inCharClass && !isEscaped()) {
        inCharClass = false;
        result += char;
        i++;
        continue;
      }
      if (inCharClass) {
        result += char;
        i++;
        continue;
      }
      if (/\s/.test(char)) {
        i++;
        continue;
      }
      if (char === "#") {
        if (isEscaped()) {
          result += char;
          i++;
          continue;
        }
        let j = i - 1;
        while (j >= 0 && content[j] === "\\") {
          j--;
        }
        const hasBackslash = j < i - 1;
        if (hasBackslash) {
          result += char;
          i++;
          continue;
        }
        while (i < content.length && content[i] !== `
`) {
          i++;
        }
        continue;
      }
      result += char;
      i++;
    }
    return result;
  }
  collectVarsFromArray(arr, varSet) {
    arr.slice(1).forEach((item) => {
      if (item === ",")
        return;
      if (item === "...")
        return;
      if (typeof item === "string") {
        varSet.add(item);
      } else if (Array.isArray(item)) {
        if (item[0] === "...") {
          if (typeof item[1] === "string") {
            varSet.add(item[1]);
          }
        } else if (item[0] === "array") {
          this.collectVarsFromArray(item, varSet);
        } else if (item[0] === "object") {
          this.collectVarsFromObject(item, varSet);
        }
      }
    });
  }
  collectVarsFromObject(obj, varSet) {
    obj.slice(1).forEach((pair) => {
      if (Array.isArray(pair)) {
        if (pair[0] === "...") {
          if (typeof pair[1] === "string") {
            varSet.add(pair[1]);
          }
        } else if (pair.length >= 2) {
          const [key2, value, operator] = pair;
          if (operator === "=") {
            if (typeof key2 === "string") {
              varSet.add(key2);
            }
          } else {
            if (typeof value === "string") {
              varSet.add(value);
            } else if (Array.isArray(value)) {
              if (value[0] === "array")
                this.collectVarsFromArray(value, varSet);
              else if (value[0] === "object")
                this.collectVarsFromObject(value, varSet);
            }
          }
        }
      }
    });
  }
  indent() {
    return this.indentString.repeat(this.indentLevel);
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
  needsSemicolon(stmt, generated) {
    if (!generated || generated.endsWith(";"))
      return false;
    if (!generated.endsWith("}"))
      return true;
    const head = Array.isArray(stmt) ? stmt[0] : null;
    const blockStatements = ["def", "class", "if", "unless", "for-in", "for-of", "for-from", "while", "until", "loop", "switch", "try"];
    return !blockStatements.includes(head);
  }
  addSemicolon(stmt, generated) {
    return generated + (this.needsSemicolon(stmt, generated) ? ";" : "");
  }
  formatStatements(statements, context = "statement") {
    return statements.map((s) => this.indent() + this.addSemicolon(s, this.generate(s, context)));
  }
  hasExplicitControlFlow(body) {
    if (!Array.isArray(body))
      return false;
    const type = body[0];
    if (type === "return" || type === "throw" || type === "break" || type === "continue") {
      return true;
    }
    if (type === "block") {
      const statements = body.slice(1);
      if (statements.length === 0)
        return false;
      return statements.some((stmt) => Array.isArray(stmt) && (stmt[0] === "return" || stmt[0] === "throw" || stmt[0] === "break" || stmt[0] === "continue"));
    }
    if (type === "switch") {
      const [, , whens] = body;
      return whens && whens.some((w) => {
        const caseBody = w[2];
        const statements = this.unwrapBlock(caseBody);
        return statements.some((stmt) => Array.isArray(stmt) && (stmt[0] === "return" || stmt[0] === "throw" || stmt[0] === "break" || stmt[0] === "continue"));
      });
    }
    if (type === "if" || type === "unless") {
      const [, , thenBranch, elseBranch] = body;
      const thenHas = this.branchHasControlFlow(thenBranch);
      const elseHas = elseBranch && this.branchHasControlFlow(elseBranch);
      return thenHas && elseHas;
    }
    return false;
  }
  branchHasControlFlow(branch) {
    if (!Array.isArray(branch))
      return false;
    const statements = this.unwrapBlock(branch);
    if (statements.length === 0)
      return false;
    const stmt = statements[statements.length - 1];
    return Array.isArray(stmt) && (stmt[0] === "return" || stmt[0] === "throw" || stmt[0] === "break" || stmt[0] === "continue");
  }
  withIndent(callback) {
    this.indentLevel++;
    const result = callback();
    this.indentLevel--;
    return result;
  }
  isNegativeStep(step) {
    if (!Array.isArray(step))
      return false;
    if (step.length !== 2)
      return false;
    const head = step[0] instanceof String ? step[0].valueOf() : step[0];
    return head === "-";
  }
  generateBranchWithReturn(branch) {
    const statements = this.unwrapBlock(branch);
    let code = "";
    for (let i = 0;i < statements.length; i++) {
      const isLast = i === statements.length - 1;
      const stmt = statements[i];
      const head = Array.isArray(stmt) ? stmt[0] : null;
      const hasControlFlow = head === "return" || head === "throw" || head === "break" || head === "continue";
      if (isLast && !hasControlFlow) {
        code += this.indent() + `return ${this.generate(stmt, "value")};
`;
      } else {
        code += this.indent() + this.generate(stmt, "statement") + `;
`;
      }
    }
    return code;
  }
  generateComprehensionWithTarget(expr, iterators, guards, targetVar) {
    let code = "";
    code += this.indent() + `${targetVar} = [];
`;
    let unwrappedExpr = expr;
    if (Array.isArray(expr) && expr[0] === "block" && expr.length === 2) {
      unwrappedExpr = expr[1];
    }
    if (iterators.length === 1) {
      const iterator = iterators[0];
      const [iterType, vars, iterable, stepOrOwn] = iterator;
      if (iterType === "for-in") {
        const step = stepOrOwn;
        const varsArray = Array.isArray(vars) ? vars : [vars];
        const noVar = varsArray.length === 0;
        const [itemVar, indexVar] = noVar ? ["_i", null] : varsArray;
        let itemVarPattern = itemVar;
        if (Array.isArray(itemVar) && (itemVar[0] === "array" || itemVar[0] === "object")) {
          itemVarPattern = this.generateDestructuringPattern(itemVar);
        }
        if (step && step !== null) {
          let iterableHead = Array.isArray(iterable) && iterable[0];
          if (iterableHead instanceof String)
            iterableHead = iterableHead.valueOf();
          const isRange = iterableHead === ".." || iterableHead === "...";
          if (isRange) {
            const isExclusive = iterableHead === "...";
            const [start, end] = iterable.slice(1);
            const startCode = this.generate(start, "value");
            const endCode = this.generate(end, "value");
            const stepCode = this.generate(step, "value");
            const comparison = isExclusive ? "<" : "<=";
            code += this.indent() + `for (let ${itemVarPattern} = ${startCode}; ${itemVarPattern} ${comparison} ${endCode}; ${itemVarPattern} += ${stepCode}) {
`;
          } else {
            const iterableCode = this.generate(iterable, "value");
            const indexVarName2 = indexVar || "_i";
            const stepCode = this.generate(step, "value");
            const isNegativeStep = this.isNegativeStep(step);
            if (isNegativeStep) {
              code += this.indent() + `for (let ${indexVarName2} = ${iterableCode}.length - 1; ${indexVarName2} >= 0; ${indexVarName2} += ${stepCode}) {
`;
            } else {
              code += this.indent() + `for (let ${indexVarName2} = 0; ${indexVarName2} < ${iterableCode}.length; ${indexVarName2} += ${stepCode}) {
`;
            }
            this.indentLevel++;
            if (!noVar) {
              code += this.indent() + `const ${itemVarPattern} = ${iterableCode}[${indexVarName2}];
`;
            }
          }
        } else {
          const iterableCode = this.generate(iterable, "value");
          code += this.indent() + `for (const ${itemVarPattern} of ${iterableCode}) {
`;
        }
        this.indentLevel++;
        if (guards && guards.length > 0) {
          code += this.indent() + `if (${guards.map((g) => this.generate(g, "value")).join(" && ")}) {
`;
          this.indentLevel++;
        }
        const exprCode = this.unwrap(this.generate(unwrappedExpr, "value"));
        code += this.indent() + `${targetVar}.push(${exprCode});
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
    const hasAwait = this.containsAwait(expr);
    const asyncPrefix = hasAwait ? "async " : "";
    return this.indent() + `${targetVar} = (${asyncPrefix}() => { /* complex comprehension */ })();
`;
  }
  generateComprehensionAsLoop(expr, iterators, guards) {
    let code = "";
    if (iterators.length === 1) {
      const iterator = iterators[0];
      const [iterType, vars, iterable, stepOrOwn] = iterator;
      if (iterType === "for-in") {
        const step = stepOrOwn;
        const varsArray = Array.isArray(vars) ? vars : [vars];
        const noVar = varsArray.length === 0;
        const [itemVar, indexVar] = noVar ? ["_i", null] : varsArray;
        let itemVarPattern = itemVar;
        if (Array.isArray(itemVar) && (itemVar[0] === "array" || itemVar[0] === "object")) {
          itemVarPattern = this.generateDestructuringPattern(itemVar);
        }
        if (step && step !== null) {
          let iterableHead = Array.isArray(iterable) && iterable[0];
          if (iterableHead instanceof String) {
            iterableHead = iterableHead.valueOf();
          }
          const isRange = iterableHead === ".." || iterableHead === "...";
          if (isRange) {
            const isExclusive = iterableHead === "...";
            const [start, end] = iterable.slice(1);
            const startCode = this.generate(start, "value");
            const endCode = this.generate(end, "value");
            const stepCode = this.generate(step, "value");
            const comparison = isExclusive ? "<" : "<=";
            code += `for (let ${itemVarPattern} = ${startCode}; ${itemVarPattern} ${comparison} ${endCode}; ${itemVarPattern} += ${stepCode}) `;
          } else {
            const iterableCode = this.generate(iterable, "value");
            const indexVarName2 = indexVar || "_i";
            const stepCode = this.generate(step, "value");
            const isNegativeStep = this.isNegativeStep(step);
            const isMinusOne = isNegativeStep && (step[1] === "1" || step[1] === 1 || step[1] instanceof String && step[1].valueOf() === "1");
            const isPlusOne = !isNegativeStep && (step === "1" || step === 1 || step instanceof String && step.valueOf() === "1");
            if (isMinusOne) {
              code += `for (let ${indexVarName2} = ${iterableCode}.length - 1; ${indexVarName2} >= 0; ${indexVarName2}--) `;
            } else if (isPlusOne) {
              code += `for (let ${indexVarName2} = 0; ${indexVarName2} < ${iterableCode}.length; ${indexVarName2}++) `;
            } else if (isNegativeStep) {
              code += `for (let ${indexVarName2} = ${iterableCode}.length - 1; ${indexVarName2} >= 0; ${indexVarName2} += ${stepCode}) `;
            } else {
              code += `for (let ${indexVarName2} = 0; ${indexVarName2} < ${iterableCode}.length; ${indexVarName2} += ${stepCode}) `;
            }
            code += `{
`;
            this.indentLevel++;
            if (!noVar) {
              code += this.indent() + `const ${itemVarPattern} = ${iterableCode}[${indexVarName2}];
`;
            }
          }
          if (guards && guards.length > 0) {
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
        } else if (indexVar) {
          const iterableCode = this.generate(iterable, "value");
          code += `for (let ${indexVar} = 0; ${indexVar} < ${iterableCode}.length; ${indexVar}++) `;
          code += `{
`;
          this.indentLevel++;
          code += this.indent() + `const ${itemVarPattern} = ${iterableCode}[${indexVarName}];
`;
        } else {
          code += `for (const ${itemVarPattern} of ${this.generate(iterable, "value")}) `;
          if (guards && guards.length > 0) {
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
      } else if (iterType === "for-from") {
        const varsArray = Array.isArray(vars) ? vars : [vars];
        const [itemVar] = varsArray;
        let itemVarPattern = itemVar;
        if (Array.isArray(itemVar) && (itemVar[0] === "array" || itemVar[0] === "object")) {
          itemVarPattern = this.generateDestructuringPattern(itemVar);
        }
        code += `for (const ${itemVarPattern} of ${this.generate(iterable, "value")}) `;
        if (guards && guards.length > 0) {
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
      } else if (iterType === "for-of") {
        const varsArray = Array.isArray(vars) ? vars : [vars];
        const [keyVar, valueVar] = varsArray;
        const own = stepOrOwn;
        const objCode = this.generate(iterable, "value");
        code += `for (const ${keyVar} in ${objCode}) `;
        code += `{
`;
        this.indentLevel++;
        if (own && !valueVar && !guards?.length) {
          code += this.indent() + `if (!Object.hasOwn(${objCode}, ${keyVar})) continue;
`;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
        } else if (own && valueVar && guards?.length) {
          code += this.indent() + `if (Object.hasOwn(${objCode}, ${keyVar})) {
`;
          this.indentLevel++;
          code += this.indent() + `const ${valueVar} = ${objCode}[${keyVar}];
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
        } else if (own && valueVar) {
          code += this.indent() + `if (Object.hasOwn(${objCode}, ${keyVar})) {
`;
          this.indentLevel++;
          code += this.indent() + `const ${valueVar} = ${objCode}[${keyVar}];
`;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
          this.indentLevel--;
          code += this.indent() + `}
`;
        } else if (valueVar && guards?.length) {
          code += this.indent() + `const ${valueVar} = ${objCode}[${keyVar}];
`;
          code += this.indent() + `if (${guards.map((g) => this.generate(g, "value")).join(" && ")}) {
`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
          this.indentLevel--;
          code += this.indent() + `}
`;
        } else if (valueVar) {
          code += this.indent() + `const ${valueVar} = ${objCode}[${keyVar}];
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
    const [head, condition, thenBranch, ...elseBranches] = ifStmt;
    let code = "";
    const condCode = head === "unless" ? `!${this.generate(condition, "value")}` : this.generate(condition, "value");
    code += this.indent() + `if (${condCode}) {
`;
    code += this.withIndent(() => this.generateBranchWithReturn(thenBranch));
    code += this.indent() + "}";
    for (const elseBranch of elseBranches) {
      code += " else ";
      if (Array.isArray(elseBranch) && elseBranch[0] === "if") {
        const [, nestedCond, nestedThen, ...nestedElse] = elseBranch;
        code += `if (${this.generate(nestedCond, "value")}) {
`;
        code += this.withIndent(() => this.generateBranchWithReturn(nestedThen));
        code += this.indent() + "}";
        if (nestedElse.length > 0) {
          for (const remainingBranch of nestedElse) {
            code += ` else {
`;
            code += this.withIndent(() => this.generateBranchWithReturn(remainingBranch));
            code += this.indent() + "}";
          }
        }
      } else {
        code += `{
`;
        code += this.withIndent(() => this.generateBranchWithReturn(elseBranch));
        code += this.indent() + "}";
      }
    }
    return code;
  }
  unwrap(code) {
    if (typeof code !== "string")
      return code;
    while (code.startsWith("(") && code.endsWith(")")) {
      let depth = 0;
      let canUnwrap = true;
      for (let i = 0;i < code.length; i++) {
        if (code[i] === "(")
          depth++;
        if (code[i] === ")")
          depth--;
        if (depth === 0 && i < code.length - 1) {
          canUnwrap = false;
          break;
        }
      }
      if (canUnwrap) {
        code = code.slice(1, -1);
      } else {
        break;
      }
    }
    return code;
  }
  flattenBinaryChain(sexpr) {
    if (!Array.isArray(sexpr) || sexpr.length < 3) {
      return sexpr;
    }
    const [head, ...rest] = sexpr;
    if (head !== "&&" && head !== "||") {
      return sexpr;
    }
    const operands = [];
    const collect = (expr) => {
      if (Array.isArray(expr) && expr[0] === head) {
        for (let i = 1;i < expr.length; i++) {
          collect(expr[i]);
        }
      } else {
        operands.push(expr);
      }
    };
    for (const operand of rest) {
      collect(operand);
    }
    return [head, ...operands];
  }
  unwrapLogical(code) {
    if (typeof code !== "string")
      return code;
    while (code.startsWith("(") && code.endsWith(")")) {
      let depth = 0;
      let minDepth = Infinity;
      for (let i = 1;i < code.length - 1; i++) {
        if (code[i] === "(")
          depth++;
        if (code[i] === ")")
          depth--;
        minDepth = Math.min(minDepth, depth);
      }
      if (minDepth >= 0) {
        code = code.slice(1, -1);
      } else {
        break;
      }
    }
    return code;
  }
  unwrapIfBranch(branch) {
    if (Array.isArray(branch) && branch.length === 1) {
      const elem = branch[0];
      if (!Array.isArray(elem) || elem[0] !== "block") {
        return elem;
      }
    }
    return branch;
  }
  isNegativeOneLiteral(sexpr) {
    return Array.isArray(sexpr) && sexpr[0] === "-" && sexpr.length === 2 && (sexpr[1] === "1" || sexpr[1] === 1 || sexpr[1] instanceof String && sexpr[1].valueOf() === "1");
  }
  hasStatementInBranch(branch) {
    if (!Array.isArray(branch))
      return false;
    const head = branch[0];
    if (head === "return" || head === "throw" || head === "break" || head === "continue") {
      return true;
    }
    if (head === "block") {
      const statements = branch.slice(1);
      return statements.some((stmt) => this.hasStatementInBranch(stmt));
    }
    return false;
  }
  isMultiStatementBlock(branch) {
    return Array.isArray(branch) && branch[0] === "block" && branch.length > 2;
  }
  hasNestedMultiStatement(branch) {
    if (!Array.isArray(branch))
      return false;
    if (branch[0] === "if") {
      const [_, cond, then, ...elseBranches] = branch;
      return this.isMultiStatementBlock(then) || elseBranches.some((b) => this.hasNestedMultiStatement(b));
    }
    return false;
  }
  buildTernaryChain(branches) {
    if (branches.length === 0)
      return "undefined";
    if (branches.length === 1) {
      return this.extractExpression(this.unwrapIfBranch(branches[0]));
    }
    const first = branches[0];
    if (Array.isArray(first) && first[0] === "if") {
      const [_, cond, then, ...rest] = first;
      const thenPart = this.extractExpression(this.unwrapIfBranch(then));
      const elsePart = this.buildTernaryChain([...rest, ...branches.slice(1)]);
      return `(${this.generate(cond, "value")} ? ${thenPart} : ${elsePart})`;
    }
    return this.extractExpression(this.unwrapIfBranch(first));
  }
  generateIfAsExpression(condition, thenBranch, elseBranches) {
    const needsIIFE = this.isMultiStatementBlock(thenBranch) || this.hasStatementInBranch(thenBranch) || elseBranches.some((b) => this.isMultiStatementBlock(b) || this.hasStatementInBranch(b) || this.hasNestedMultiStatement(b));
    if (needsIIFE) {
      const containsAwait = this.containsAwait(condition) || this.containsAwait(thenBranch) || elseBranches.some((b) => this.containsAwait(b));
      const asyncPrefix = containsAwait ? "async " : "";
      const awaitPrefix = containsAwait ? "await " : "";
      let code = `${awaitPrefix}(${asyncPrefix}() => { `;
      code += `if (${this.generate(condition, "value")}) `;
      code += this.generateBlockWithReturns(thenBranch);
      for (const branch of elseBranches) {
        code += " else ";
        if (Array.isArray(branch) && branch[0] === "if") {
          const [_, nestedCond, nestedThen, ...nestedElse] = branch;
          code += `if (${this.generate(nestedCond, "value")}) `;
          code += this.generateBlockWithReturns(nestedThen);
          for (const nestedBranch of nestedElse) {
            code += " else ";
            if (Array.isArray(nestedBranch) && nestedBranch[0] === "if") {
              const [__, nnCond, nnThen, ...nnElse] = nestedBranch;
              code += `if (${this.generate(nnCond, "value")}) `;
              code += this.generateBlockWithReturns(nnThen);
              elseBranches.push(...nnElse);
            } else {
              code += this.generateBlockWithReturns(nestedBranch);
            }
          }
        } else {
          code += this.generateBlockWithReturns(branch);
        }
      }
      code += " })()";
      return code;
    }
    const thenExpr = this.extractExpression(this.unwrapIfBranch(thenBranch));
    const elseExpr = this.buildTernaryChain(elseBranches);
    let condCode = this.generate(condition, "value");
    if (Array.isArray(condition) && (condition[0] === "yield" || condition[0] === "await")) {
      condCode = `(${condCode})`;
    }
    return `(${condCode} ? ${thenExpr} : ${elseExpr})`;
  }
  generateIfAsStatement(condition, thenBranch, elseBranches) {
    const condCode = this.unwrap(this.generate(condition, "value"));
    let code = `if (${condCode}) `;
    code += this.generate(this.unwrapIfBranch(thenBranch), "statement");
    for (const branch of elseBranches) {
      code += ` else `;
      code += this.generate(this.unwrapIfBranch(branch), "statement");
    }
    return code;
  }
  isStaticMember(memberKey) {
    return Array.isArray(memberKey) && memberKey[0] === "." && memberKey[1] === "this";
  }
  isComputedMember(memberKey) {
    return Array.isArray(memberKey) && memberKey[0] === "computed";
  }
  extractMemberName(memberKey) {
    if (this.isStaticMember(memberKey)) {
      return memberKey[2];
    } else if (this.isComputedMember(memberKey)) {
      return `[${this.generate(memberKey[1], "value")}]`;
    } else {
      return memberKey;
    }
  }
  isBoundMethod(memberValue) {
    return Array.isArray(memberValue) && memberValue[0] === "=>";
  }
  generateSwitchCaseBody(body, context) {
    let code = "";
    const hasExplicitFlow = this.hasExplicitControlFlow(body);
    if (hasExplicitFlow) {
      const statements = this.unwrapBlock(body);
      for (const stmt of statements) {
        code += this.indent() + this.generate(stmt, "statement") + `;
`;
      }
    } else {
      if (context === "value") {
        if (Array.isArray(body) && body[0] === "block" && body.length > 2) {
          const statements = body.slice(1);
          for (let i = 0;i < statements.length; i++) {
            const isLast = i === statements.length - 1;
            if (isLast) {
              const lastExpr = this.generate(statements[i], "value");
              code += this.indent() + `return ${lastExpr};
`;
            } else {
              code += this.indent() + this.generate(statements[i], "statement") + `;
`;
            }
          }
        } else {
          const bodyExpr = this.extractExpression(body);
          code += this.indent() + `return ${bodyExpr};
`;
        }
      } else {
        if (Array.isArray(body) && body[0] === "block" && body.length > 1) {
          const statements = body.slice(1);
          for (const stmt of statements) {
            code += this.indent() + this.generate(stmt, "statement") + `;
`;
          }
        } else {
          const bodyStmt = this.generate(body, "statement");
          code += this.indent() + bodyStmt + `;
`;
        }
        code += this.indent() + `break;
`;
      }
    }
    return code;
  }
  generateSwitchAsIfChain(whens, defaultCase, context) {
    let code = "";
    for (let i = 0;i < whens.length; i++) {
      const whenClause = whens[i];
      const [, test, body] = whenClause;
      if (i === 0) {
        code += `if (${this.generate(test, "value")}) {
`;
      } else {
        code += ` else if (${this.generate(test, "value")}) {
`;
      }
      this.indentLevel++;
      if (context === "value") {
        const bodyExpr = this.extractExpression(body);
        code += this.indent() + `return ${bodyExpr};
`;
      } else {
        const statements = this.unwrapBlock(body);
        for (const stmt of statements) {
          code += this.indent() + this.generate(stmt, "statement") + `;
`;
        }
      }
      this.indentLevel--;
      code += this.indent() + "}";
    }
    if (defaultCase) {
      code += ` else {
`;
      this.indentLevel++;
      if (context === "value") {
        const defaultExpr = this.extractExpression(defaultCase);
        code += this.indent() + `return ${defaultExpr};
`;
      } else {
        const statements = this.unwrapBlock(defaultCase);
        for (const stmt of statements) {
          code += this.indent() + this.generate(stmt, "statement") + `;
`;
        }
      }
      this.indentLevel--;
      code += this.indent() + "}";
    }
    if (context === "value") {
      return `(() => { ${code} })()`;
    }
    return code;
  }
  getReactiveRuntime() {
    return `// ============================================================================
// Rip Reactive Runtime
// A minimal, fine-grained reactivity system
//
// Reactivity:
//   __signal(value)    - Reactive state container
//   __computed(fn)     - Derived value (lazy, cached)
//   __effect(fn)       - Side effect that re-runs when dependencies change
//   __batch(fn)        - Group multiple updates into one flush
//   __readonly(value)  - Immutable value wrapper
//
// Context API:
//   setContext(key, value)  - Set context in current component
//   getContext(key)         - Get context from nearest ancestor
//   hasContext(key)         - Check if context exists
//
// Error Handling:
//   __catchErrors(fn)       - Wrap function to route errors to boundary
//   __handleError(error)    - Route error to nearest boundary
//
// How reactivity works:
//   - Reading a signal/computed inside an effect tracks it as a dependency
//   - Writing to a signal notifies all subscribers
//   - Batching defers effect execution until the batch completes
// ============================================================================

// Global state for dependency tracking
let __currentEffect = null;   // The effect/computed currently being evaluated
let __pendingEffects = new Set();  // Effects queued to run
let __batching = false;       // Are we inside a batch()?

// Flush all pending effects (called after signal updates, or at end of batch)
function __flushEffects() {
  const effects = [...__pendingEffects];
  __pendingEffects.clear();
  for (const effect of effects) effect.run();
}

// Shared primitive coercion (used by signal and computed)
const __primitiveCoercion = {
  valueOf() { return this.value; },
  toString() { return String(this.value); },
  [Symbol.toPrimitive](hint) { return hint === 'string' ? this.toString() : this.valueOf(); }
};

/**
 * Create a reactive signal (state container)
 * @param {*} initialValue - The initial value
 * @returns {object} Signal with .value getter/setter
 */
function __signal(initialValue) {
  let value = initialValue;
  const subscribers = new Set();  // Effects/computeds that depend on this signal
  
  // State flags
  let notifying = false;  // Prevents re-entry during notification
  let locked = false;     // Prevents writes (used during SSR/hydration)
  let dead = false;       // Signal has been killed (cleanup)

  const signal = {
    get value() {
      if (dead) return value;
      // Track this signal as a dependency of the current effect/computed
      if (__currentEffect) {
        subscribers.add(__currentEffect);
        __currentEffect.dependencies.add(subscribers);
      }
      return value;
    },
    
    set value(newValue) {
      // Skip if: dead, locked, same value, or already notifying
      if (dead || locked || newValue === value || notifying) return;
      value = newValue;
      notifying = true;
      
      // Notify subscribers: computeds mark dirty, effects get queued
      for (const sub of subscribers) {
        if (sub.markDirty) sub.markDirty();  // Computed
        else __pendingEffects.add(sub);      // Effect
      }
      
      // Flush immediately unless we're batching
      if (!__batching) __flushEffects();
      notifying = false;
    },
    
    read() { return value; },                    // Read without tracking
    lock() { locked = true; return signal; },    // Prevent further writes
    free() { subscribers.clear(); return signal; },  // Clear all subscribers
    kill() { dead = true; subscribers.clear(); return value; },  // Cleanup
    
    ...__primitiveCoercion
  };
  return signal;
}

/**
 * Create a computed value (derived state, lazy & cached)
 * @param {function} fn - Function that computes the value
 * @returns {object} Computed with .value getter
 */
function __computed(fn) {
  let value;
  let dirty = true;           // Needs recomputation?
  const subscribers = new Set();  // Things that depend on this computed
  
  // State flags
  let locked = false;  // Prevents recomputation
  let dead = false;    // Computed has been killed

  const computed = {
    dependencies: new Set(),  // Signals/computeds this depends on
    
    // Called by dependencies when they change
    markDirty() {
      if (dead || locked || dirty) return;
      dirty = true;
      // Propagate dirty status to our subscribers
      for (const sub of subscribers) {
        if (sub.markDirty) sub.markDirty();
        else __pendingEffects.add(sub);
      }
    },
    
    get value() {
      if (dead) return value;
      // Track this computed as a dependency
      if (__currentEffect) {
        subscribers.add(__currentEffect);
        __currentEffect.dependencies.add(subscribers);
      }
      // Recompute if dirty (lazy evaluation)
      if (dirty && !locked) {
        // Clear old dependencies
        for (const dep of computed.dependencies) dep.delete(computed);
        computed.dependencies.clear();
        // Evaluate with this computed as the current effect (to track deps)
        const prev = __currentEffect;
        __currentEffect = computed;
        try { value = fn(); } finally { __currentEffect = prev; }
        dirty = false;
      }
      return value;
    },
    
    read() { return value; },  // Return cached value without tracking or recomputing
    lock() { locked = true; computed.value; return computed; },  // Lock after computing
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

/**
 * Create a reactive effect (side effect that re-runs on dependency changes)
 * @param {function} fn - The effect function
 * @returns {function} Dispose function to stop the effect
 */
function __effect(fn) {
  const effect = {
    dependencies: new Set(),  // Signals/computeds this effect depends on
    
    run() {
      // Clear old dependencies before re-running
      for (const dep of effect.dependencies) dep.delete(effect);
      effect.dependencies.clear();
      // Run with this effect as current (to track deps)
      const prev = __currentEffect;
      __currentEffect = effect;
      try { fn(); } finally { __currentEffect = prev; }
    },
    
    dispose() {
      for (const dep of effect.dependencies) dep.delete(effect);
      effect.dependencies.clear();
    }
  };
  
  effect.run();  // Run immediately to establish dependencies
  return () => effect.dispose();
}

/**
 * Batch multiple state updates into a single effect flush
 * @param {function} fn - Function containing multiple state updates
 * @returns {*} The return value of fn
 */
function __batch(fn) {
  if (__batching) return fn();  // Already batching, just run
  __batching = true;
  try {
    return fn();
  } finally {
    __batching = false;
    __flushEffects();  // Flush all effects once at the end
  }
}

/**
 * Create a readonly value (immutable, no reactivity)
 * @param {*} value - The value to wrap
 * @returns {object} Frozen object with .value property
 */
function __readonly(value) {
  return Object.freeze({ value });
}

// ============================================================================
// Context API
// Pass data down the component tree without prop drilling
//
// Usage:
//   // In parent component constructor or methods:
//   setContext('theme', { dark: true })
//   
//   // In any descendant component:
//   theme = getContext('theme')
// ============================================================================

let __currentComponent = null;  // The component currently being initialized

/**
 * Set a context value in the current component
 * @param {*} key - The context key (usually a string or symbol)
 * @param {*} value - The value to store
 */
function setContext(key, value) {
  if (!__currentComponent) {
    throw new Error('setContext must be called during component initialization');
  }
  if (!__currentComponent._context) {
    __currentComponent._context = new Map();
  }
  __currentComponent._context.set(key, value);
}

/**
 * Get a context value from the nearest ancestor that set it
 * @param {*} key - The context key to look up
 * @returns {*} The context value, or undefined if not found
 */
function getContext(key) {
  let component = __currentComponent;
  while (component) {
    if (component._context && component._context.has(key)) {
      return component._context.get(key);
    }
    component = component._parent;
  }
  return undefined;
}

/**
 * Check if a context key exists in any ancestor
 * @param {*} key - The context key to check
 * @returns {boolean} True if the key exists
 */
function hasContext(key) {
  let component = __currentComponent;
  while (component) {
    if (component._context && component._context.has(key)) return true;
    component = component._parent;
  }
  return false;
}

// ============================================================================
// Error Boundaries
// Catch and handle errors in component trees gracefully
//
// Usage in component:
//   error: (err) -> console.error "Caught:", err
// ============================================================================

let __errorHandler = null;  // Current error handler (set by nearest error boundary)

/**
 * Set the current error handler (called by components with error: handler)
 * @param {function} handler - Error handler function
 * @returns {function} Previous handler (for restoration)
 */
function __setErrorHandler(handler) {
  const prev = __errorHandler;
  __errorHandler = handler;
  return prev;
}

/**
 * Handle an error - calls nearest error boundary or rethrows
 * @param {Error} error - The error to handle
 */
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

/**
 * Wrap a function to catch errors and route to error boundary
 * @param {function} fn - Function to wrap
 * @returns {function} Wrapped function
 */
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
// src/compiler.js
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
  "?[]",
  "::",
  "?::",
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
  const head = arr[0]?.valueOf?.() ?? arr[0];
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
  const str = String(elem);
  if (str[0] === "/" && str.indexOf(`
`) >= 0) {
    const match = str.match(/\/([gimsuvy]*)$/);
    const flags = match ? match[1] : "";
    let content = str.slice(1);
    if (flags) {
      content = content.slice(0, -flags.length - 1);
    } else {
      content = content.slice(0, -1);
    }
    const lines = content.split(`
`);
    const cleaned = lines.map((line) => line.replace(/#.*$/, "").trim());
    const processed = cleaned.join("");
    return `"/${processed}/${flags}"`;
  }
  return str;
}
function formatSExpr(arr, indent = 0, isTopLevel = false) {
  if (!Array.isArray(arr))
    return formatAtom(arr);
  if (isTopLevel && arr[0] === "program") {
    const secondElem = arr[1];
    const header = Array.isArray(secondElem) ? "(program" : "(program " + formatAtom(secondElem);
    const lines2 = [header];
    const startIndex = Array.isArray(secondElem) ? 1 : 2;
    for (let i = startIndex;i < arr.length; i++) {
      const child = formatSExpr(arr[i], 2, false);
      lines2.push(child[0] === "(" ? "  " + child : child);
    }
    lines2.push(")");
    return lines2.join(`
`);
  }
  const head = arr[0];
  const canBeInline = isInline(arr) && arr.slice(1).every((elem) => !Array.isArray(elem) || isInline(elem));
  if (canBeInline) {
    const parts = arr.map((elem) => Array.isArray(elem) ? formatSExpr(elem, 0, false) : formatAtom(elem));
    const inline = `(${parts.join(" ")})`;
    if (!inline.includes(`
`)) {
      return " ".repeat(indent) + inline;
    }
  }
  const spaces = " ".repeat(indent);
  let formattedHead;
  if (Array.isArray(head)) {
    formattedHead = formatSExpr(head, 0, false);
    if (formattedHead.includes(`
`)) {
      const headLines = formattedHead.split(`
`);
      formattedHead = headLines.map((line, i) => i === 0 ? line : " ".repeat(indent + 2) + line).join(`
`);
    }
  } else {
    formattedHead = formatAtom(head);
  }
  const lines = [`${spaces}(${formattedHead}`];
  const forceChildrenOnNewLines = head === "block";
  for (let i = 1;i < arr.length; i++) {
    const elem = arr[i];
    if (!Array.isArray(elem)) {
      lines[lines.length - 1] += " " + formatAtom(elem);
    } else {
      const childInline = isInline(elem) && elem.every((e) => !Array.isArray(e) || isInline(e));
      if (!forceChildrenOnNewLines && childInline) {
        const formatted2 = formatSExpr(elem, 0, false);
        if (!formatted2.includes(`
`)) {
          lines[lines.length - 1] += " " + formatted2;
          continue;
        }
      }
      const formatted = formatSExpr(elem, indent + 2, false);
      lines.push(formatted);
    }
  }
  lines[lines.length - 1] += ")";
  return lines.join(`
`);
}

class Compiler {
  constructor(options = {}) {
    this.options = {
      showTokens: false,
      showSExpr: false,
      ...options
    };
  }
  compile(source) {
    let dataSection = null;
    const lines = source.split(`
`);
    const dataLineIndex = lines.findIndex((line) => line === "__DATA__");
    if (dataLineIndex !== -1) {
      const dataLines = lines.slice(dataLineIndex + 1);
      dataSection = dataLines.length > 0 ? dataLines.join(`
`) + `
` : "";
      source = lines.slice(0, dataLineIndex).join(`
`);
    }
    const lexer = new Lexer;
    const tokens = lexer.tokenize(source);
    if (this.options.showTokens) {
      tokens.forEach((t) => {
        console.log(`${t[0].padEnd(12)} ${JSON.stringify(t[1])}`);
      });
      console.log();
    }
    parser.lexer = {
      tokens,
      pos: 0,
      setInput: function(input, yy) {},
      lex: function() {
        if (this.pos >= this.tokens.length)
          return 1;
        const token = this.tokens[this.pos++];
        this.yytext = token[1];
        this.yylloc = token[2];
        return token[0];
      }
    };
    let sexpr;
    try {
      sexpr = parser.parse(source);
    } catch (parseError) {
      if (/\?\s*\([^)]*\?[^)]*:[^)]*\)\s*:/.test(source) || /\?\s+\w+\s+\?\s+/.test(source)) {
        throw new Error(`Nested ternary operators are not supported. Use if/else statements instead:
` + `  Instead of: x ? (y ? a : b) : c
` + "  Use: if x then (if y then a else b) else c");
      }
      throw parseError;
    }
    if (this.options.showSExpr) {
      console.log(formatSExpr(sexpr, 0, true));
      console.log();
    }
    const generator = new CodeGenerator({
      dataSection,
      skipReactiveRuntime: this.options.skipReactiveRuntime,
      reactiveVars: this.options.reactiveVars
    });
    let code = generator.compile(sexpr);
    return {
      tokens,
      sexpr,
      code,
      data: dataSection,
      reactiveVars: generator.reactiveVars
    };
  }
  compileToJS(source) {
    return this.compile(source).code;
  }
  compileToSExpr(source) {
    return this.compile(source).sexpr;
  }
}
function compile(source, options = {}) {
  const compiler = new Compiler(options);
  return compiler.compile(source);
}
function compileToJS(source, options = {}) {
  const compiler = new Compiler(options);
  return compiler.compileToJS(source);
}
// src/browser.js
var VERSION = "2.2.2";
var BUILD_DATE = "2026-01-15@22:49:25GMT";
var dedent = (s) => {
  const m = s.match(/^[ \t]*(?=\S)/gm);
  const i = Math.min(...(m || []).map((x) => x.length));
  return s.replace(RegExp(`^[ 	]{${i}}`, "gm"), "").trim();
};
async function processRipScripts() {
  const scripts = document.querySelectorAll('script[type="text/rip"]');
  for (const script of scripts) {
    if (script.hasAttribute("data-rip-processed")) {
      continue;
    }
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
    if (result !== undefined) {
      globalThis._ = result;
    }
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
