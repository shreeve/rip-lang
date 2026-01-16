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
OPERATOR = /^(?:<=>|[-=]>|~=|:=|=!|===|!==|!\?|\?\?|=~|[-+*\/%<>&|^!?=]=|>>>=?|([-+:])\1|([&|<>*\/%])\2=?|\?(\.|::)|\.{2,3})/;
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
        if (tag === "IDENTIFIER" && !token.spaced) {
          let parts = [token[1]];
          let j = i + 1;
          while (j + 1 < tokens.length) {
            const hyphen = tokens[j];
            const nextPart = tokens[j + 1];
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
  symbolIds: { $accept: 0, $end: 1, error: 2, Root: 3, Body: 4, Line: 5, TERMINATOR: 6, Expression: 7, ExpressionLine: 8, Statement: 9, Return: 10, STATEMENT: 11, Import: 12, Export: 13, Value: 14, Code: 15, Operation: 16, Assign: 17, ReactiveAssign: 18, DerivedAssign: 19, ReadonlyAssign: 20, EffectBlock: 21, RenderBlock: 22, StyleBlock: 23, Component: 24, If: 25, Try: 26, While: 27, For: 28, Switch: 29, Class: 30, Throw: 31, Yield: 32, Def: 33, DEF: 34, Identifier: 35, CALL_START: 36, ParamList: 37, CALL_END: 38, Block: 39, Assignable: 40, REACTIVE_ASSIGN: 41, INDENT: 42, OUTDENT: 43, DERIVED_ASSIGN: 44, READONLY_ASSIGN: 45, EFFECT: 46, FuncGlyph: 47, RENDER: 48, STYLE: 49, COMPONENT: 50, ComponentBody: 51, ComponentLine: 52, PropDecl: 53, "@": 54, PROPERTY: 55, "?": 56, "=": 57, "...": 58, IDENTIFIER: 59, CodeLine: 60, OperationLine: 61, YIELD: 62, Object: 63, FROM: 64, Property: 65, AlphaNumeric: 66, NUMBER: 67, String: 68, STRING: 69, STRING_START: 70, Interpolations: 71, STRING_END: 72, InterpolationChunk: 73, INTERPOLATION_START: 74, INTERPOLATION_END: 75, Regex: 76, REGEX: 77, REGEX_START: 78, Invocation: 79, REGEX_END: 80, RegexWithIndex: 81, ",": 82, Literal: 83, JS: 84, UNDEFINED: 85, NULL: 86, BOOL: 87, INFINITY: 88, NAN: 89, AssignObj: 90, ObjAssignable: 91, ObjRestValue: 92, ":": 93, SimpleObjAssignable: 94, ThisProperty: 95, "[": 96, "]": 97, ObjSpreadExpr: 98, Parenthetical: 99, Super: 100, This: 101, SUPER: 102, OptFuncExist: 103, Arguments: 104, DYNAMIC_IMPORT: 105, ".": 106, "?.": 107, "::": 108, "?::": 109, INDEX_START: 110, INDEX_END: 111, INDEX_SOAK: 112, RETURN: 113, PARAM_START: 114, PARAM_END: 115, "->": 116, "=>": 117, OptComma: 118, Param: 119, ParamVar: 120, Array: 121, Splat: 122, SimpleAssignable: 123, Slice: 124, ES6_OPTIONAL_INDEX: 125, Range: 126, DoIife: 127, MetaProperty: 128, NEW_TARGET: 129, IMPORT_META: 130, "{": 131, FOR: 132, ForVariables: 133, FOROF: 134, "}": 135, WHEN: 136, OWN: 137, AssignList: 138, CLASS: 139, EXTENDS: 140, IMPORT: 141, ImportDefaultSpecifier: 142, ImportNamespaceSpecifier: 143, ImportSpecifierList: 144, ImportSpecifier: 145, AS: 146, DEFAULT: 147, IMPORT_ALL: 148, EXPORT: 149, ExportSpecifierList: 150, EXPORT_ALL: 151, ExportSpecifier: 152, ES6_OPTIONAL_CALL: 153, FUNC_EXIST: 154, ArgList: 155, THIS: 156, Elisions: 157, ArgElisionList: 158, OptElisions: 159, RangeDots: 160, "..": 161, Arg: 162, ArgElision: 163, Elision: 164, SimpleArgs: 165, TRY: 166, Catch: 167, FINALLY: 168, CATCH: 169, THROW: 170, "(": 171, ")": 172, WhileSource: 173, WHILE: 174, UNTIL: 175, Loop: 176, LOOP: 177, FORIN: 178, BY: 179, FORFROM: 180, AWAIT: 181, ForValue: 182, SWITCH: 183, Whens: 184, ELSE: 185, When: 186, LEADING_WHEN: 187, IfBlock: 188, IF: 189, UnlessBlock: 190, UNLESS: 191, POST_IF: 192, POST_UNLESS: 193, UNARY: 194, DO: 195, DO_IIFE: 196, UNARY_MATH: 197, "-": 198, "+": 199, "--": 200, "++": 201, MATH: 202, "**": 203, SHIFT: 204, COMPARE: 205, "&": 206, "^": 207, "|": 208, "&&": 209, "||": 210, "??": 211, "!?": 212, RELATION: 213, "SPACE?": 214, COMPOUND_ASSIGN: 215 },
  tokenNames: { 2: "error", 6: "TERMINATOR", 11: "STATEMENT", 34: "DEF", 36: "CALL_START", 38: "CALL_END", 41: "REACTIVE_ASSIGN", 42: "INDENT", 43: "OUTDENT", 44: "DERIVED_ASSIGN", 45: "READONLY_ASSIGN", 46: "EFFECT", 48: "RENDER", 49: "STYLE", 50: "COMPONENT", 54: "@", 55: "PROPERTY", 56: "?", 57: "=", 58: "...", 59: "IDENTIFIER", 62: "YIELD", 64: "FROM", 67: "NUMBER", 69: "STRING", 70: "STRING_START", 72: "STRING_END", 74: "INTERPOLATION_START", 75: "INTERPOLATION_END", 77: "REGEX", 78: "REGEX_START", 80: "REGEX_END", 82: ",", 84: "JS", 85: "UNDEFINED", 86: "NULL", 87: "BOOL", 88: "INFINITY", 89: "NAN", 93: ":", 96: "[", 97: "]", 102: "SUPER", 105: "DYNAMIC_IMPORT", 106: ".", 107: "?.", 108: "::", 109: "?::", 110: "INDEX_START", 111: "INDEX_END", 112: "INDEX_SOAK", 113: "RETURN", 114: "PARAM_START", 115: "PARAM_END", 116: "->", 117: "=>", 125: "ES6_OPTIONAL_INDEX", 129: "NEW_TARGET", 130: "IMPORT_META", 131: "{", 132: "FOR", 134: "FOROF", 135: "}", 136: "WHEN", 137: "OWN", 139: "CLASS", 140: "EXTENDS", 141: "IMPORT", 146: "AS", 147: "DEFAULT", 148: "IMPORT_ALL", 149: "EXPORT", 151: "EXPORT_ALL", 153: "ES6_OPTIONAL_CALL", 154: "FUNC_EXIST", 156: "THIS", 161: "..", 166: "TRY", 168: "FINALLY", 169: "CATCH", 170: "THROW", 171: "(", 172: ")", 174: "WHILE", 175: "UNTIL", 177: "LOOP", 178: "FORIN", 179: "BY", 180: "FORFROM", 181: "AWAIT", 183: "SWITCH", 185: "ELSE", 187: "LEADING_WHEN", 189: "IF", 191: "UNLESS", 192: "POST_IF", 193: "POST_UNLESS", 194: "UNARY", 195: "DO", 196: "DO_IIFE", 197: "UNARY_MATH", 198: "-", 199: "+", 200: "--", 201: "++", 202: "MATH", 203: "**", 204: "SHIFT", 205: "COMPARE", 206: "&", 207: "^", 208: "|", 209: "&&", 210: "||", 211: "??", 212: "!?", 213: "RELATION", 214: "SPACE?", 215: "COMPOUND_ASSIGN" },
  parseTable: (() => {
    let d = [107, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, -1, 1, 2, 3, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 43, 54, 55, 56, 87, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 1, 1, 0, 2, 1, 5, -2, 107, 5, 1, 5, 37, 32, 97, -3, -3, -3, -3, -3, 31, 1, 5, 32, 4, 1, 13, 19, 7, 15, 35, 40, 1, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -6, -6, -6, -6, -6, 108, -6, -6, -6, 127, -6, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 9, 1, 5, 32, 4, 1, 32, 7, 15, 75, -7, -7, -7, -7, -7, -7, -7, -7, -7, 14, 1, 5, 32, 4, 1, 32, 7, 15, 75, 1, 1, 1, 17, 1, -8, -8, -8, -8, -8, -8, -8, -8, -8, 130, 96, 97, 128, 129, 54, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 6, 3, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -13, -13, -263, -13, -13, -13, -13, -13, -263, -263, -13, -13, -13, -13, 131, 133, 134, 135, 136, 137, -13, 138, -13, 139, -13, -13, -13, -13, 132, 140, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, 47, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, 141, 142, 143, 144, 145, -14, 146, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, 9, 1, 5, 32, 4, 1, 32, 7, 15, 75, -60, -60, -60, -60, -60, -60, -60, -60, -60, 9, 1, 5, 32, 4, 1, 32, 7, 15, 75, -61, -61, -61, -61, -61, -61, -61, -61, -61, 13, 1, 5, 32, 4, 1, 32, 7, 15, 75, 2, 1, 17, 1, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, 13, 1, 5, 32, 4, 1, 32, 7, 15, 75, 2, 1, 17, 1, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, 13, 1, 5, 32, 4, 1, 32, 7, 15, 75, 2, 1, 17, 1, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, 13, 1, 5, 32, 4, 1, 32, 7, 15, 75, 2, 1, 17, 1, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, 57, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -186, -186, -186, -186, 148, -186, -186, 149, 150, -186, 147, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, 18, 6, 29, 2, 1, 4, 1, 11, 4, 1, 4, 19, 13, 1, 19, 4, 1, 1, 10, -140, 155, 151, -140, -140, -140, 159, 154, 104, 158, -140, 156, 160, -140, 152, 153, 157, 99, 106, 5, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 1, 2, 4, 1, 1, 1, 1, 4, 5, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 162, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 161, 33, 163, 53, 43, 54, 55, 56, 87, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 103, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 164, 165, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 43, 54, 55, 56, 87, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 103, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 167, 168, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 43, 54, 55, 56, 87, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 169, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 175, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 176, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 177, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 178, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 45, 14, 1, 20, 5, 7, 7, 5, 4, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 9, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 25, 15, 25, 180, 181, 92, 182, 171, 87, 104, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 170, 90, 91, 72, 179, 36, 38, 41, 88, 89, 99, 86, 82, 174, 45, 14, 1, 20, 5, 7, 7, 5, 4, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 9, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 25, 15, 25, 180, 181, 92, 182, 171, 87, 104, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 170, 90, 91, 72, 183, 36, 38, 41, 88, 89, 99, 86, 82, 174, 60, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, 184, 185, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, 186, 5, 39, 3, 5, 69, 1, 188, 163, 187, 90, 91, 2, 39, 3, 189, 163, 2, 39, 3, 190, 163, 2, 35, 24, 191, 104, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 5, 7, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, 192, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, 2, 39, 3, 193, 163, 2, 39, 3, 194, 163, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, 14, 35, 19, 5, 4, 32, 1, 24, 1, 5, 5, 2, 4, 44, 1, 155, 159, 104, 158, 156, 83, 200, 157, 198, 99, 195, 196, 197, 199, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 201, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 202, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 88, 1, 5, 8, 1, 20, 3, 1, 1, 2, 1, 4, 7, 2, 2, 1, 4, 3, 1, 1, 1, 1, 5, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 4, 2, 1, 1, 2, 1, 1, 1, 3, 6, 3, 1, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 2, 1, 1, 4, 16, 5, 10, 1, 2, 1, 3, 1, 1, 12, 1, 3, 2, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -210, -210, 180, 181, 92, -210, 203, 182, 163, -210, 171, 87, -210, -210, 104, 73, 74, 100, 101, 105, 106, -210, 76, 102, 103, 37, -210, 34, 75, 77, 78, 79, 80, 81, -210, 93, 83, -210, 35, 40, 39, 84, 85, -210, 170, -210, 90, 91, 72, 205, 36, 38, 41, 88, 89, 99, -210, -210, -210, -210, 204, 86, -210, 82, -210, -210, -210, -210, -210, -210, -210, -210, 174, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 206, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 207, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 137, 1, 5, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 2, 1, 3, 1, 1, 1, 1, 4, 2, 2, 1, 3, 1, 1, 2, 1, 1, 1, 1, 5, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 4, 2, 1, 1, 2, 1, 1, 1, 3, 6, 2, 1, 1, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 2, 1, 1, 3, 2, 8, 7, 5, 5, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -62, -62, 208, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, -62, 33, 209, -62, 53, 171, 54, 55, 56, 87, -62, -62, 104, 66, 73, 210, 74, 100, 101, 105, 106, -62, 76, 102, 103, 37, -62, 34, 75, 77, 78, 79, 80, 81, -62, 93, 83, -62, 35, 40, 39, 84, 85, -62, 69, 170, -62, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, -62, -62, -62, -62, 64, 70, 71, 86, -62, 59, 65, 82, -62, 60, -62, -62, 61, 98, -62, -62, -62, 49, 63, 57, 94, 58, 95, -62, -62, 172, 173, 174, 46, 47, 48, 50, 51, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, -62, 2, 35, 24, 211, 104, 6, 15, 32, 13, 54, 2, 1, 213, 43, 212, 42, 90, 91, 111, 1, 5, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 2, 1, 3, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 5, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 6, 1, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 1, 1, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -131, -131, 214, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, -131, 33, 215, -131, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, -131, 76, 102, 103, 37, -131, 34, 75, 77, 78, 79, 80, 81, 93, 83, -131, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, -131, 60, -131, -131, 61, 98, 49, 63, 57, 94, 58, 95, -131, -131, 172, 173, 174, 46, 47, 48, 50, 51, 9, 35, 24, 9, 1, 1, 61, 11, 1, 5, 220, 104, 216, 105, 106, 219, 217, 218, 221, 9, 30, 3, 1, 1, 24, 72, 8, 8, 4, 223, 224, 67, 225, 104, 222, 64, 226, 227, 57, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, 57, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, 106, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 228, 3, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 229, 53, 43, 54, 55, 56, 87, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 113, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 6, 1, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 1, 1, 4, 1, 1, 2, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 230, 239, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 236, 53, 43, 54, 55, 56, 87, 241, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 237, 34, 75, 77, 78, 79, 80, 81, 93, 83, 231, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 240, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 232, 233, 238, 235, 234, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 4, 36, 68, 2, 4, 245, 242, 243, 244, 2, 36, 68, 245, 246, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, 55, 1, 5, 30, 2, 4, 1, 12, 1, 2, 7, 4, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -268, -268, -268, -268, -268, -268, 248, -268, -268, 247, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, 1, 106, 249, 1, 106, 250, 54, 11, 23, 8, 4, 2, 1, 1, 4, 5, 3, 5, 2, 1, 7, 1, 6, 1, 1, 1, 1, 1, 7, 6, 3, 8, 1, 2, 1, 12, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 3, 1, 2, 4, 2, 6, 2, 3, 1, 1, 1, 1, 1, 1, 1, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, 54, 11, 23, 8, 4, 2, 1, 1, 4, 5, 3, 5, 2, 1, 7, 1, 6, 1, 1, 1, 1, 1, 7, 6, 3, 8, 1, 2, 1, 12, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 3, 1, 2, 4, 2, 6, 2, 3, 1, 1, 1, 1, 1, 1, 1, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 251, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 252, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 253, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 254, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 1, 2, 4, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 256, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 255, 33, 163, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 23, 6, 29, 7, 1, 11, 1, 3, 1, 6, 1, 1, 1, 1, 1, 12, 8, 1, 1, 2, 1, 1, 39, 3, -205, 264, -205, -205, 261, 248, 268, 104, 265, 262, 100, 101, 105, 106, -205, 263, 257, 267, 259, 266, 260, -205, 258, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, 45, 14, 1, 20, 5, 7, 7, 5, 4, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 9, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 25, 15, 25, 180, 181, 92, 182, 171, 87, 104, 73, 74, 100, 101, 105, 106, 76, 102, 103, 269, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 170, 90, 91, 72, 270, 36, 38, 41, 88, 89, 99, 86, 82, 174, 63, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 6, 5, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 6, 7, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, 56, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 2, 2, 1, 5, 2, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, 6, 68, 1, 1, 1, 2, 1, 274, 105, 106, 271, 272, 273, 109, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 3, 3, 1, 1, 1, 1, 4, 5, 1, 1, 1, 1, 3, 1, 1, 1, 1, 5, 1, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 1, 1, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, -5, 275, -5, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, -5, 53, 43, 54, 55, 56, 87, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, -5, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, -5, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 276, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 277, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 278, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 279, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 280, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 281, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 282, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 283, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 284, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 285, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 286, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 287, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 288, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 289, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 290, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 291, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 292, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, 14, 35, 19, 5, 4, 32, 1, 24, 1, 5, 5, 2, 4, 44, 1, 155, 159, 104, 158, 156, 83, 200, 157, 296, 99, 293, 294, 295, 199, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 297, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 298, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, 5, 36, 32, 1, 1, 34, 245, 299, 105, 106, 300, 2, 36, 68, 245, 301, 2, 55, 10, 248, 302, 2, 55, 10, 248, 303, 63, 1, 5, 30, 2, 3, 1, 1, 1, 1, 10, 1, 1, 1, 7, 4, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -160, -160, -160, -160, -160, -160, -160, -160, -160, 248, -160, -160, -160, 304, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, 63, 1, 5, 30, 2, 3, 1, 1, 1, 1, 10, 1, 1, 1, 7, 4, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -161, -161, -161, -161, -161, -161, -161, -161, -161, 248, -161, -161, -161, 305, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, 106, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 4, 1, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 1, 2, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 4, 1, 5, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 306, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 307, 53, 171, 54, 55, 56, 87, 313, 104, 66, 73, 74, 100, 101, 105, 106, 311, 102, 103, 37, 309, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 308, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 310, 312, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 1, 110, 314, 1, 110, 315, 3, 36, 33, 1, -264, -264, -264, 2, 55, 10, 248, 316, 2, 55, 10, 248, 317, 63, 1, 5, 30, 2, 3, 1, 1, 1, 1, 10, 1, 1, 1, 7, 4, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -177, -177, -177, -177, -177, -177, -177, -177, -177, 248, -177, -177, -177, 318, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, 63, 1, 5, 30, 2, 3, 1, 1, 1, 1, 10, 1, 1, 1, 7, 4, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -178, -178, -178, -178, -178, -178, -178, -178, -178, 248, -178, -178, -178, 319, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 320, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 321, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 1, 110, 322, 102, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 324, 323, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 325, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 102, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 327, 326, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 328, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 102, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 330, 329, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 331, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 102, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 333, 332, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 334, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 9, 6, 32, 4, 1, 39, 15, 18, 3, 17, -138, -138, -138, -138, 336, -138, 335, 337, -138, 6, 6, 32, 4, 1, 39, 33, -141, -141, -141, -141, -141, -141, 7, 6, 32, 4, 1, 14, 25, 33, -145, -145, -145, -145, 338, -145, -145, 15, 6, 29, 3, 4, 1, 11, 5, 4, 19, 13, 1, 19, 5, 1, 10, -148, 155, -148, -148, -148, 159, 104, 158, -148, 156, 160, -148, 339, 157, 99, 10, 6, 32, 4, 1, 14, 25, 33, 19, 44, 2, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, 10, 6, 32, 4, 1, 14, 25, 33, 19, 44, 2, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, 10, 6, 32, 4, 1, 14, 25, 33, 19, 44, 2, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, 10, 6, 32, 4, 1, 14, 25, 33, 19, 44, 2, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, 2, 55, 10, 248, 247, 113, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 6, 1, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 1, 1, 4, 1, 1, 2, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 340, 239, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 236, 53, 43, 54, 55, 56, 87, 241, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 237, 34, 75, 77, 78, 79, 80, 81, 93, 83, 231, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 240, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 232, 233, 238, 235, 234, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, -133, 9, 1, 5, 32, 4, 1, 32, 7, 15, 75, -135, -135, -135, -135, -135, -135, -135, -135, -135, 106, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 3, 3, 1, 1, 1, 1, 4, 5, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 342, 3, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 341, 53, 43, 54, 55, 56, 87, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -381, -381, -381, -381, -381, 108, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, 126, -381, -381, -381, -381, -381, -381, 125, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, 120, 121, -381, -381, 9, 1, 5, 32, 4, 1, 32, 7, 15, 75, -378, -378, -378, -378, -378, -378, -378, -378, -378, 5, 173, 1, 1, 17, 1, 130, 96, 97, 128, 129, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -382, -382, -382, -382, -382, 108, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, 126, -382, -382, -382, -382, -382, -382, 125, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, 120, 121, -382, -382, 9, 1, 5, 32, 4, 1, 32, 7, 15, 75, -379, -379, -379, -379, -379, -379, -379, -379, -379, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -383, -383, -383, -383, -383, 108, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, 126, -383, -383, -383, -383, -383, -383, 125, -383, -383, -383, 112, -383, -383, -383, -383, -383, -383, -383, 120, 121, -383, -383, 18, 6, 29, 2, 1, 4, 1, 11, 4, 1, 4, 19, 13, 1, 19, 4, 1, 1, 10, -140, 155, 343, -140, -140, -140, 159, 154, 104, 158, -140, 156, 160, -140, 152, 153, 157, 99, 2, 39, 3, 161, 163, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 164, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 167, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 5, 15, 32, 67, 2, 1, 213, 171, 170, 90, 91, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -384, -384, -384, -384, -384, 108, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, 126, -384, -384, -384, -384, -384, -384, 125, -384, -384, -384, 112, -384, -384, -384, -384, -384, -384, -384, 120, 121, -384, -384, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -385, -385, -385, -385, -385, 108, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, 126, -385, -385, -385, -385, -385, -385, 125, -385, -385, -385, 112, -385, -385, -385, -385, -385, -385, -385, 120, 121, -385, -385, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -386, -386, -386, -386, -386, 108, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, 126, -386, -386, -386, -386, -386, -386, 125, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, 120, 121, -386, -386, 2, 63, 68, 344, 99, 57, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -388, -388, -183, -388, -183, -388, -388, -183, -183, -388, -183, -388, -183, -183, -388, -388, -388, -388, -183, -183, -183, -183, -183, -388, -183, -388, -183, -388, -388, -388, -388, -183, -183, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, 13, 36, 33, 1, 33, 3, 1, 1, 1, 1, 2, 13, 28, 1, -263, -263, -263, 131, 133, 134, 135, 136, 137, 138, 139, 132, 140, 6, 106, 1, 1, 1, 1, 2, 141, 142, 143, 144, 145, 146, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, 57, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -389, -389, -183, -389, -183, -389, -389, -183, -183, -389, -183, -389, -183, -183, -389, -389, -389, -389, -183, -183, -183, -183, -183, -389, -183, -389, -183, -389, -389, -389, -389, -183, -183, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, 102, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 347, 345, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 346, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 2, 39, 3, 348, 163, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, 1, 42, 349, 3, 39, 3, 147, 350, 163, 351, 44, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 6, 1, 1, 3, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, 352, 353, 354, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, 3, 134, 44, 2, 356, 355, 357, 11, 35, 19, 5, 4, 32, 1, 24, 1, 10, 2, 49, 155, 159, 104, 158, 156, 160, 200, 157, 99, 358, 199, 11, 35, 19, 5, 4, 32, 1, 24, 1, 10, 2, 49, 155, 159, 104, 158, 156, 160, 200, 157, 99, 359, 199, 3, 39, 3, 137, 360, 163, 361, 4, 82, 52, 44, 2, 362, -357, -357, -357, 5, 57, 25, 52, 44, 2, 363, -355, -355, -355, -355, 23, 42, 14, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 364, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 3, 184, 2, 1, 365, 366, 367, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 368, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 59, 1, 5, 30, 2, 1, 2, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -214, -214, -183, -214, 369, -183, 163, -214, -183, -183, -214, -183, -214, -183, -183, -214, -214, -214, -214, -183, -183, -183, -183, -183, -214, -183, -214, -183, -214, -214, -214, -214, 370, -183, -183, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -311, -311, -311, -311, -311, 108, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, 126, -311, -311, -311, -311, -311, -311, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 2, 63, 68, 371, 99, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -63, -63, -63, -63, -63, 108, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, -63, 126, -63, -63, -63, -63, -63, -63, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 2, 63, 68, 372, 99, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 373, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 3, 36, 3, 3, 374, 375, 163, 9, 1, 5, 32, 4, 1, 32, 7, 15, 75, -380, -380, -380, -380, -380, -380, -380, -380, -380, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, 31, 1, 5, 32, 4, 1, 13, 19, 7, 15, 35, 40, 1, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -129, -129, -129, -129, -129, 108, -129, -129, -129, 127, -129, 126, -129, -129, -129, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 2, 63, 68, 376, 99, 13, 1, 5, 32, 4, 1, 32, 7, 15, 75, 2, 1, 17, 1, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, 2, 64, 18, 377, 378, 1, 64, 379, 7, 35, 7, 17, 76, 9, 1, 2, 384, 383, 104, 380, 381, 382, 385, 2, 64, 18, -234, -234, 1, 146, 386, 7, 35, 7, 17, 76, 12, 3, 2, 391, 390, 104, 387, 392, 388, 389, 13, 1, 5, 32, 4, 1, 32, 7, 15, 75, 2, 1, 17, 1, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, 13, 1, 5, 32, 4, 1, 32, 7, 15, 75, 2, 1, 17, 1, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, 1, 57, 393, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 394, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 395, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 1, 64, 396, 2, 6, 166, 107, 397, 105, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 398, 3, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 43, 54, 55, 56, 87, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 31, 6, 32, 4, 1, 13, 2, 24, 15, 35, 28, 1, 12, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -285, -285, -285, -285, 108, 313, -285, -285, 127, 399, 312, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 57, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, 109, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 6, 1, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 6, 2, 2, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 340, 239, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 43, 54, 55, 56, 87, 241, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 237, 34, 75, 77, 78, 79, 80, 81, 93, 83, 400, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 240, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 402, 401, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 9, 6, 32, 4, 1, 39, 15, 21, 17, 24, -138, -138, -138, -138, 404, -138, 405, -138, 403, 59, 6, 5, 23, 8, 1, 3, 2, 1, 1, 4, 4, 1, 3, 5, 2, 1, 7, 1, 4, 2, 1, 1, 1, 1, 1, 7, 1, 5, 3, 8, 1, 2, 1, 12, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 3, 1, 2, 4, 2, 6, 2, 3, 1, 1, 1, 1, 1, 1, 1, 406, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, 5, 6, 36, 1, 39, 15, -289, -289, -289, -289, -289, 112, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 1, 1, 4, 1, 1, 2, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 340, 239, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 236, 53, 43, 54, 55, 56, 87, 241, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 237, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 240, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 408, 407, 238, 235, 234, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 59, 6, 5, 23, 8, 1, 3, 2, 1, 1, 4, 4, 1, 3, 5, 2, 1, 7, 1, 4, 2, 1, 1, 1, 1, 1, 7, 1, 5, 3, 8, 1, 2, 1, 12, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 3, 1, 2, 4, 2, 6, 2, 3, 1, 1, 1, 1, 1, 1, 1, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, 5, 6, 36, 1, 39, 15, -294, -294, -294, -294, -294, 6, 6, 32, 4, 1, 39, 15, -286, -286, -286, -286, -286, -286, 6, 6, 32, 4, 1, 39, 15, -287, -287, -287, -287, -287, -287, 106, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 2, 1, 3, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 6, 1, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, -288, 409, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, -288, 33, -288, -288, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, -288, 34, 75, 77, 78, 79, 80, 81, 93, 83, -288, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 54, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 5, 2, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, 2, 55, 10, 248, 410, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 411, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 412, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 109, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 2, 4, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 6, 1, 6, 4, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 340, 239, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 413, 33, 416, 53, 43, 54, 55, 56, 87, 241, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 240, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 414, 86, 415, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 54, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 5, 2, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, 2, 55, 10, 248, 417, 2, 55, 10, 248, 418, 24, 39, 3, 14, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 419, 163, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 24, 39, 3, 14, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 420, 163, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -315, -315, -315, -315, -315, 108, -315, -315, -315, -315, -315, -315, -315, 127, -315, -315, 421, -315, -315, 126, 96, 97, -315, -315, -315, -315, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -317, -317, -317, -317, -317, 108, -317, -317, -317, -317, -317, -317, -317, 127, -317, -317, 422, -317, -317, 126, 96, 97, -317, -317, -317, -317, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -324, -324, -324, -324, -324, 108, -324, -324, -324, -324, -324, -324, -324, 127, -324, -324, -324, -324, -324, 126, 96, 97, -324, -324, -324, -324, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 6, 6, 36, 1, 39, 11, 42, -95, -95, -95, -95, 423, -95, 8, 6, 32, 4, 1, 39, 15, 21, 17, -138, -138, -138, -138, 425, -138, 424, -138, 7, 6, 36, 1, 14, 25, 11, 42, -104, -104, -104, 426, -104, -104, -104, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 427, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 3, 55, 10, 31, 248, 247, 428, 6, 6, 36, 1, 39, 11, 42, -107, -107, -107, -107, -107, -107, 5, 6, 36, 1, 39, 53, -206, -206, -206, -206, -206, 15, 6, 30, 6, 1, 14, 25, 11, 13, 1, 1, 1, 1, 2, 23, 19, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, 15, 6, 30, 6, 1, 14, 25, 11, 13, 1, 1, 1, 1, 2, 23, 19, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, 15, 6, 30, 6, 1, 14, 25, 11, 13, 1, 1, 1, 1, 2, 23, 19, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, 5, 6, 36, 1, 39, 53, -96, -96, -96, -96, -96, 17, 35, 19, 1, 4, 4, 2, 29, 1, 3, 1, 1, 1, 1, 3, 26, 25, 15, 264, 87, 248, 104, 431, 265, 429, 266, 430, 432, 433, 434, 435, 436, 99, 86, 82, 54, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 5, 2, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, 437, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, 57, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, 6, 68, 1, 1, 2, 1, 1, 274, 105, 106, 438, 439, 273, 4, 69, 1, 2, 2, -74, -74, -74, -74, 107, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 1, 1, 1, 1, 3, 1, 1, 1, 1, 5, 1, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 440, 3, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 441, 53, 43, 54, 55, 56, 87, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 442, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 4, 69, 1, 2, 2, -79, -79, -79, -79, 5, 1, 5, 37, 32, 97, -4, -4, -4, -4, -4, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -393, -393, -393, -393, -393, 108, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, 126, -393, -393, -393, -393, -393, -393, 125, -393, -393, 111, 112, -393, -393, -393, -393, -393, -393, -393, 120, 121, -393, -393, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -394, -394, -394, -394, -394, 108, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, 126, -394, -394, -394, -394, -394, -394, 125, -394, -394, 111, 112, -394, -394, -394, -394, -394, -394, -394, 120, 121, -394, -394, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -395, -395, -395, -395, -395, 108, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, 126, -395, -395, -395, -395, -395, -395, 125, -395, -395, -395, 112, -395, -395, -395, -395, -395, -395, -395, 120, 121, -395, -395, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -396, -396, -396, -396, -396, 108, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, 126, -396, -396, -396, -396, -396, -396, 125, -396, -396, -396, 112, -396, -396, -396, -396, -396, -396, -396, 120, 121, -396, -396, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -397, -397, -397, -397, -397, 108, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, 126, -397, -397, -397, -397, -397, -397, 125, 110, 109, 111, 112, -397, -397, -397, -397, -397, -397, -397, 120, 121, -397, -397, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -398, -398, -398, -398, -398, 108, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, 126, -398, -398, -398, -398, -398, -398, 125, 110, 109, 111, 112, 113, -398, -398, -398, -398, -398, -398, 120, 121, 122, -398, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -399, -399, -399, -399, -399, 108, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, 126, -399, -399, -399, -399, -399, -399, 125, 110, 109, 111, 112, 113, 114, -399, -399, -399, -399, -399, 120, 121, 122, -399, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -400, -400, -400, -400, -400, 108, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, 126, -400, -400, -400, -400, -400, -400, 125, 110, 109, 111, 112, 113, 114, 115, -400, -400, -400, -400, 120, 121, 122, -400, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -401, -401, -401, -401, -401, 108, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, 126, -401, -401, -401, -401, -401, -401, 125, 110, 109, 111, 112, 113, 114, 115, 116, -401, -401, -401, 120, 121, 122, -401, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -402, -402, -402, -402, -402, 108, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, 126, -402, -402, -402, -402, -402, -402, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, -402, -402, 120, 121, 122, -402, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -403, -403, -403, -403, -403, 108, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, 126, -403, -403, -403, -403, -403, -403, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, -403, 120, 121, 122, -403, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -404, -404, -404, -404, -404, 108, -404, -404, -404, -404, -404, -404, -404, 127, -404, -404, -404, -404, -404, 126, 96, 97, -404, -404, -404, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -405, -405, -405, -405, -405, 108, -405, -405, -405, -405, -405, -405, -405, 127, -405, -405, -405, -405, -405, 126, 96, 97, -405, -405, -405, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -406, -406, -406, -406, -406, 108, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, 126, -406, -406, -406, -406, -406, -406, 125, 110, 109, 111, 112, 113, -406, -406, -406, -406, -406, -406, 120, 121, -406, -406, 23, 56, 37, 39, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 108, 443, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -375, -375, -375, -375, -375, 108, -375, -375, -375, -375, -375, -375, -375, 127, -375, -375, -375, -375, -375, 126, 96, 97, -375, -375, -375, -375, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -377, -377, -377, -377, -377, 108, -377, -377, -377, -377, -377, -377, -377, 127, -377, -377, -377, -377, -377, 126, 96, 97, -377, -377, -377, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 3, 134, 44, 2, 445, 444, 446, 11, 35, 19, 5, 4, 32, 1, 24, 1, 10, 2, 49, 155, 159, 104, 158, 156, 160, 200, 157, 99, 447, 199, 11, 35, 19, 5, 4, 32, 1, 24, 1, 10, 2, 49, 155, 159, 104, 158, 156, 160, 200, 157, 99, 448, 199, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, 449, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -374, -374, -374, -374, -374, 108, -374, -374, -374, -374, -374, -374, -374, 127, -374, -374, -374, -374, -374, 126, 96, 97, -374, -374, -374, -374, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -376, -376, -376, -376, -376, 108, -376, -376, -376, -376, -376, -376, -376, 127, -376, -376, -376, -376, -376, 126, 96, 97, -376, -376, -376, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 54, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 5, 2, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, 54, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 5, 2, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, 54, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 5, 2, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, 26, 56, 2, 53, 21, 28, 1, 12, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 108, 313, 450, 127, 451, 312, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 4, 1, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 1, 2, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 4, 1, 5, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 452, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 313, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 453, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 310, 312, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 1, 111, 454, 1, 111, 455, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 3, 3, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 6, 2, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 456, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, -279, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, -279, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, 457, -86, -86, -86, -86, -86, -86, -86, -83, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, 55, 11, 23, 9, 3, 2, 1, 1, 4, 5, 3, 5, 2, 1, 7, 1, 6, 1, 1, 1, 1, 1, 7, 6, 3, 6, 2, 1, 2, 1, 12, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 3, 1, 2, 4, 2, 6, 2, 3, 1, 1, 1, 1, 1, 1, 1, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, 55, 11, 23, 9, 3, 2, 1, 1, 4, 5, 3, 5, 2, 1, 7, 1, 6, 1, 1, 1, 1, 1, 7, 6, 3, 6, 2, 1, 2, 1, 12, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 3, 1, 2, 4, 2, 6, 2, 3, 1, 1, 1, 1, 1, 1, 1, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, 105, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 4, 1, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 1, 2, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 4, 1, 5, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 458, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 459, 53, 171, 54, 55, 56, 87, 313, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 460, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 310, 312, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 461, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 462, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, 23, 56, 55, 21, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 108, 463, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 464, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 465, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 466, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -92, -92, -92, -92, -92, 108, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, 126, -92, -92, -92, -92, -92, -92, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 467, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 468, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -35, -35, -35, -35, -35, 108, -35, -35, -35, -35, -35, -35, -35, 127, -35, -35, -35, -35, -35, 126, 96, 97, -35, -35, -35, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 469, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 470, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -38, -38, -38, -38, -38, 108, -38, -38, -38, -38, -38, -38, -38, 127, -38, -38, -38, -38, -38, 126, 96, 97, -38, -38, -38, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 471, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 472, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -41, -41, -41, -41, -41, 108, -41, -41, -41, -41, -41, -41, -41, 127, -41, -41, -41, -41, -41, 126, 96, 97, -41, -41, -41, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 473, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 474, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 3, 47, 69, 1, 475, 90, 91, 17, 6, 29, 3, 4, 1, 11, 4, 1, 4, 32, 1, 1, 22, 1, 1, 10, 4, -139, 155, -139, -139, -139, 159, 154, 104, 158, 156, 160, -139, 476, 153, 157, 99, -139, 2, 6, 36, 477, 478, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 479, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 6, 6, 32, 4, 1, 39, 33, -147, -147, -147, -147, -147, -147, 28, 6, 32, 4, 1, 13, 26, 15, 35, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -285, -285, -285, -285, 108, -285, -285, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 57, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 7, 1, 3, 2, 1, 3, 1, 1, 5, 2, 5, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, 2, 6, 37, 107, 480, 9, 6, 32, 4, 1, 39, 15, 18, 3, 17, -138, -138, -138, -138, 336, -138, 481, 337, -138, 1, 43, 482, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -408, -408, -408, -408, -408, 108, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, 126, -408, -408, -408, -408, -408, -408, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 483, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 484, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, 106, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 1, 1, 1, 1, 5, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 487, 488, 489, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 43, 54, 55, 56, 485, 486, 490, 491, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 492, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 7, 4, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, 493, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, 2, 39, 3, 494, 163, 6, 35, 4, 3, 17, 4, 68, 495, 497, 163, 104, 496, 99, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 498, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 499, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 500, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 1, 134, 501, 1, 180, 502, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 503, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 10, 35, 19, 5, 4, 32, 1, 24, 1, 10, 51, 155, 159, 104, 158, 156, 160, 200, 157, 99, 504, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 505, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 3, 184, 2, 1, 506, 366, 367, 4, 43, 142, 1, 1, 507, 508, 509, 367, 3, 43, 142, 2, -363, -363, -363, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 9, 1, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 511, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 510, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 43, 1, 5, 32, 1, 3, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -212, -212, -212, 512, 163, -212, 108, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, 126, -212, -212, -212, -212, -212, -212, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 513, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 1, 43, 514, 1, 43, 515, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -65, -65, -65, -65, -65, 108, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, 126, -65, -65, -65, -65, -65, -65, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 18, 6, 29, 2, 1, 4, 1, 11, 4, 1, 4, 19, 13, 1, 19, 4, 1, 1, 10, -140, 155, 516, -140, -140, -140, 159, 154, 104, 158, -140, 156, 160, -140, 152, 153, 157, 99, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, 1, 43, 517, 3, 68, 1, 1, 518, 105, 106, 3, 131, 12, 5, 520, 519, 221, 3, 68, 1, 1, 521, 105, 106, 1, 64, 522, 8, 6, 32, 4, 1, 39, 15, 21, 17, -138, -138, -138, -138, 524, -138, 523, -138, 5, 6, 36, 1, 39, 53, -225, -225, -225, -225, -225, 6, 35, 7, 17, 85, 1, 2, 384, 383, 104, 525, 382, 385, 6, 6, 36, 1, 39, 53, 11, -230, -230, -230, -230, -230, 526, 6, 6, 36, 1, 39, 53, 11, -232, -232, -232, -232, -232, 527, 2, 35, 24, 528, 104, 14, 1, 5, 32, 4, 1, 21, 11, 7, 15, 75, 2, 1, 17, 1, -236, -236, -236, -236, -236, 529, -236, -236, -236, -236, -236, -236, -236, -236, 8, 6, 32, 4, 1, 39, 15, 21, 17, -138, -138, -138, -138, 531, -138, 530, -138, 5, 6, 36, 1, 39, 53, -248, -248, -248, -248, -248, 6, 35, 7, 17, 88, 3, 2, 391, 390, 104, 392, 532, 389, 6, 6, 36, 1, 39, 53, 11, -253, -253, -253, -253, -253, 533, 6, 6, 36, 1, 39, 53, 11, -256, -256, -256, -256, -256, 534, 102, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 536, 535, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 537, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 31, 1, 5, 32, 4, 1, 13, 19, 7, 15, 35, 40, 1, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -243, -243, -243, -243, -243, 108, -243, -243, -243, 127, -243, 126, 96, 97, -243, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 2, 63, 68, 538, 99, 3, 68, 1, 1, 539, 105, 106, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, 2, 6, 37, 107, 540, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 541, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 57, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, 59, 6, 5, 23, 8, 1, 3, 2, 1, 1, 4, 4, 1, 3, 5, 2, 1, 7, 1, 4, 2, 1, 1, 1, 1, 1, 7, 1, 5, 3, 8, 1, 2, 1, 12, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 3, 1, 2, 4, 2, 6, 2, 3, 1, 1, 1, 1, 1, 1, 1, 406, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, 5, 6, 36, 1, 39, 15, -295, -295, -295, -295, -295, 2, 42, 55, 543, 542, 116, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 2, 1, 3, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 6, 1, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 3, 4, 2, 8, 7, 1, 5, 1, 1, 2, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, -139, 340, 239, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, -139, 33, -139, -139, 53, 43, 54, 55, 56, 87, 241, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 237, 34, 75, 77, 78, 79, 80, 81, 93, 83, -139, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 240, 52, 36, 38, 41, 88, 89, 99, 62, -139, 64, 70, 71, 86, 545, 238, 544, 234, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 4, 6, 36, 1, 54, 546, -296, -296, -296, 59, 6, 5, 23, 8, 1, 3, 2, 1, 1, 4, 4, 1, 3, 5, 2, 1, 7, 1, 4, 2, 1, 1, 1, 1, 1, 7, 1, 5, 3, 8, 1, 2, 1, 12, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 3, 1, 2, 4, 2, 6, 2, 3, 1, 1, 1, 1, 1, 1, 1, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, 9, 6, 32, 4, 1, 39, 15, 21, 17, 24, -138, -138, -138, -138, 404, -138, 405, -138, 547, 108, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 6, 2, 2, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 340, 239, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 43, 54, 55, 56, 87, 241, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 237, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 240, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 402, 401, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 28, 6, 32, 4, 1, 13, 26, 15, 35, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -153, -153, -153, -153, 108, -153, -153, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, 23, 56, 55, 21, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 108, 548, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 549, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 54, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 5, 2, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, 8, 6, 32, 4, 1, 39, 15, 21, 17, -138, -138, -138, -138, 551, -138, 550, -138, 5, 6, 32, 4, 1, 39, -280, -280, -280, -280, -280, 108, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 6, 1, 6, 4, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 340, 239, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 416, 53, 43, 54, 55, 56, 87, 241, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 240, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 552, 86, 415, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 5, 7, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, -367, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 5, 7, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, 553, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 554, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 555, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 556, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 557, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 3, 6, 36, 93, 559, 560, 558, 23, 6, 29, 3, 4, 1, 11, 1, 3, 1, 6, 1, 1, 1, 1, 1, 20, 1, 1, 2, 1, 1, 1, 38, -139, 264, -139, -139, -139, 261, 248, 268, 104, 265, 262, 100, 101, 105, 106, 561, 562, 267, 259, 266, 260, -139, -139, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 563, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 564, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 23, 56, 41, 35, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 108, 565, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 566, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 16, 6, 30, 6, 1, 26, 1, 12, 21, 3, 1, 1, 1, 1, 2, 23, 19, -108, -110, -108, -108, -263, -263, -108, 567, -110, -110, -110, -110, -110, -110, -108, 140, 16, 6, 30, 6, 1, 26, 1, 12, 21, 3, 1, 1, 1, 1, 2, 23, 19, -109, -263, -109, -109, -263, -263, -109, 568, 569, 570, 571, 572, 573, 574, -109, 140, 13, 6, 30, 6, 1, 39, 24, 1, 1, 1, 1, 2, 23, 19, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, 13, 6, 30, 6, 1, 39, 24, 1, 1, 1, 1, 2, 23, 19, -112, -112, -112, -112, -112, -112, -112, -112, -112, -112, -112, -112, -112, 13, 6, 30, 6, 1, 39, 24, 1, 1, 1, 1, 2, 23, 19, -113, -113, -113, -113, -113, -113, -113, -113, -113, -113, -113, -113, -113, 13, 6, 30, 6, 1, 39, 24, 1, 1, 1, 1, 2, 23, 19, -114, -114, -114, -114, -114, -114, -114, -114, -114, -114, -114, -114, -114, 7, 36, 33, 1, 33, 3, 4, 44, -263, -263, -263, 575, 243, 244, 140, 2, 36, 68, 245, 576, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, 56, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 2, 2, 1, 5, 2, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, 4, 69, 1, 2, 2, -75, -75, -75, -75, 2, 6, 69, 107, 577, 105, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 578, 3, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 43, 54, 55, 56, 87, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 4, 69, 1, 2, 2, -78, -78, -78, -78, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 579, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 580, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 581, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 582, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 1, 134, 583, 1, 180, 584, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 585, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 3, 3, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 6, 2, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 586, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, -277, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, -277, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 26, 43, 13, 2, 74, 28, 1, 12, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 587, 108, 313, 127, 451, 312, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 1, 43, 588, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, 24, 43, 13, 55, 21, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -278, 108, -278, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 589, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 26, 56, 2, 53, 21, 28, 1, 12, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 108, 313, 590, 127, 451, 312, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 4, 1, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 1, 2, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 4, 1, 5, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 591, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 313, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 592, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 310, 312, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 1, 111, 593, 23, 56, 55, 21, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 108, 594, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 595, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, 23, 43, 13, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 596, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 23, 56, 55, 21, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 108, 597, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 598, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -93, -93, -93, -93, -93, 108, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, 126, -93, -93, -93, -93, -93, -93, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 23, 43, 13, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 599, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -36, -36, -36, -36, -36, 108, -36, -36, -36, -36, -36, -36, -36, 127, -36, -36, -36, -36, -36, 126, 96, 97, -36, -36, -36, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 23, 43, 13, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 600, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -39, -39, -39, -39, -39, 108, -39, -39, -39, -39, -39, -39, -39, 127, -39, -39, -39, -39, -39, 126, 96, 97, -39, -39, -39, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 23, 43, 13, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 601, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -42, -42, -42, -42, -42, 108, -42, -42, -42, -42, -42, -42, -42, 127, -42, -42, -42, -42, -42, 126, 96, 97, -42, -42, -42, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 23, 43, 13, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 602, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 106, 5, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 1, 2, 4, 1, 1, 1, 1, 4, 5, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 604, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 603, 33, 163, 53, 43, 54, 55, 56, 87, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 6, 6, 32, 4, 1, 39, 33, -142, -142, -142, -142, -142, -142, 11, 35, 19, 4, 1, 4, 32, 1, 23, 1, 1, 10, 155, 159, 154, 104, 158, 156, 160, 605, 153, 157, 99, 18, 6, 29, 2, 1, 4, 1, 11, 4, 1, 4, 19, 13, 1, 19, 4, 1, 1, 10, -140, 155, 606, -140, -140, -140, 159, 154, 104, 158, -140, 156, 160, -140, 152, 153, 157, 99, 28, 6, 32, 4, 1, 13, 26, 33, 17, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -146, -146, -146, -146, 108, -146, -146, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 57, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 7, 1, 3, 2, 1, 3, 1, 1, 5, 2, 5, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, 3, 47, 69, 1, 607, 90, 91, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, 23, 43, 13, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 608, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -410, -410, -410, -410, -410, 108, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, 126, -410, -410, -410, -410, -410, -410, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 2, 6, 37, 610, 609, 2, 6, 37, -49, -49, 24, 6, 37, 13, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -52, -52, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 2, 6, 37, -53, -53, 7, 6, 37, 130, 1, 1, 17, 1, -54, -54, 130, 96, 97, 128, 129, 2, 6, 37, -55, -55, 55, 1, 5, 30, 2, 4, 1, 12, 1, 2, 7, 4, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -268, -268, -268, -268, -268, -268, 611, -268, 612, 247, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, 24, 39, 3, 14, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 613, 163, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 2, 39, 3, 614, 163, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, 2, 39, 3, 615, 163, 2, 39, 3, 616, 163, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 7, 4, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, 26, 39, 3, 14, 76, 4, 37, 1, 1, 4, 13, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 617, 163, 108, 127, 618, 126, 96, 97, 619, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 25, 39, 3, 14, 76, 4, 37, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 620, 163, 108, 127, 621, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 25, 39, 3, 14, 76, 4, 37, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 622, 163, 108, 127, 623, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 624, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 625, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 24, 39, 3, 14, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 626, 163, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 3, 134, 44, 2, -358, -358, -358, 26, 56, 26, 50, 2, 39, 1, 1, 3, 2, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 108, -356, 127, -356, 126, 96, 97, -356, -356, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 4, 43, 142, 1, 1, 627, 628, 509, 367, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, 2, 39, 3, 629, 163, 3, 43, 142, 2, -364, -364, -364, 3, 39, 3, 40, 630, 163, 631, 24, 42, 14, 26, 50, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -302, 108, -302, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, 43, 1, 5, 32, 1, 3, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -216, -216, -216, 632, 163, -216, 108, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, 126, -216, -216, -216, -216, -216, -216, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, 8, 6, 32, 4, 1, 39, 15, 21, 17, -138, 633, -138, -138, 336, -138, 337, -138, 13, 1, 5, 32, 4, 1, 32, 7, 15, 75, 2, 1, 17, 1, -130, -130, -130, -130, -130, -130, -130, -130, -130, -130, -130, -130, -130, 13, 1, 5, 32, 4, 1, 32, 7, 15, 75, 2, 1, 17, 1, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, 1, 64, 634, 6, 35, 7, 17, 85, 1, 2, 384, 383, 104, 635, 382, 385, 13, 1, 5, 32, 4, 1, 32, 7, 15, 75, 2, 1, 17, 1, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, 3, 68, 1, 1, 636, 105, 106, 3, 6, 36, 93, 638, 639, 637, 10, 6, 29, 3, 4, 1, 16, 38, 38, 10, 2, -139, 384, -139, -139, -139, 104, -139, -139, 640, 385, 8, 6, 32, 4, 1, 39, 15, 21, 17, -138, -138, -138, -138, 524, -138, 641, -138, 2, 35, 24, 642, 104, 2, 35, 24, 643, 104, 1, 64, -235, 3, 68, 1, 1, 644, 105, 106, 3, 6, 36, 93, 646, 647, 645, 10, 6, 29, 3, 4, 1, 16, 38, 38, 12, 5, -139, 391, -139, -139, -139, 104, -139, -139, 392, 648, 8, 6, 32, 4, 1, 39, 15, 21, 17, -138, -138, -138, -138, 531, -138, 649, -138, 3, 35, 24, 88, 650, 104, 651, 2, 35, 24, 652, 104, 31, 1, 5, 32, 4, 1, 13, 19, 7, 15, 35, 40, 1, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -240, -240, -240, -240, -240, 108, -240, -240, -240, 127, -240, 126, -240, -240, -240, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 653, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 654, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 1, 43, 655, 13, 1, 5, 32, 4, 1, 32, 7, 15, 75, 2, 1, 17, 1, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, 1, 172, 656, 23, 56, 41, 35, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 108, 657, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 57, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, 112, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 1, 1, 4, 1, 1, 2, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 340, 239, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 236, 53, 43, 54, 55, 56, 87, 241, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 237, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 240, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 408, 658, 238, 235, 234, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 5, 6, 36, 1, 39, 15, -290, -290, -290, -290, -290, 111, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 1, 3, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 6, 1, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 6, 2, 2, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 340, 239, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, -297, -297, 53, 43, 54, 55, 56, 87, 241, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 237, 34, 75, 77, 78, 79, 80, 81, 93, 83, -297, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 240, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 402, 401, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 110, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 1, 5, 1, 1, 2, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 340, 239, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 43, 54, 55, 56, 87, 241, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 237, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 240, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 408, 238, 659, 234, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 2, 42, 1, 543, 660, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, 23, 43, 13, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 661, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 3, 6, 32, 4, 663, 662, 664, 112, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 2, 1, 3, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 3, 4, 2, 8, 7, 6, 4, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, -139, 340, 239, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, -139, 33, -139, -139, 53, 43, 54, 55, 56, 87, 241, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, -139, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 240, 52, 36, 38, 41, 88, 89, 99, 62, -139, 64, 70, 71, 86, 665, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 8, 6, 32, 4, 1, 39, 15, 21, 17, -138, -138, -138, -138, 551, -138, 666, -138, 2, 39, 3, 667, 163, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -316, -316, -316, -316, -316, 108, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, 126, -316, -316, -316, -316, -316, -316, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -318, -318, -318, -318, -318, 108, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, 126, -318, -318, -318, -318, -318, -318, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 27, 6, 36, 1, 13, 26, 50, 3, 38, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -97, -97, -97, 108, -97, 668, -97, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 669, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 57, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, 17, 35, 19, 1, 3, 1, 6, 1, 1, 1, 1, 1, 20, 1, 1, 2, 1, 1, 264, 261, 248, 268, 104, 265, 262, 100, 101, 105, 106, 670, 562, 267, 259, 266, 260, 23, 6, 29, 7, 1, 11, 1, 3, 1, 6, 1, 1, 1, 1, 1, 12, 8, 1, 1, 2, 1, 1, 39, 3, -205, 264, -205, -205, 261, 248, 268, 104, 265, 262, 100, 101, 105, 106, -205, 263, 562, 267, 259, 266, 260, -205, 671, 5, 6, 36, 1, 39, 53, -207, -207, -207, -207, -207, 6, 6, 36, 1, 39, 11, 42, -95, -95, -95, -95, 672, -95, 27, 6, 36, 1, 13, 26, 50, 3, 38, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -99, -99, -99, 108, -99, 127, -99, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 673, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 6, 6, 36, 1, 39, 11, 42, -105, -105, -105, -105, -105, -105, 23, 56, 41, 35, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 108, 674, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 2, 36, 68, 245, 675, 2, 36, 68, 245, 676, 2, 55, 10, 248, 677, 2, 55, 10, 248, 678, 15, 6, 30, 6, 1, 12, 10, 17, 24, 1, 1, 1, 1, 2, 23, 19, -123, -123, -123, -123, 248, 679, -123, -123, -123, -123, -123, -123, -123, -123, -123, 15, 6, 30, 6, 1, 12, 10, 17, 24, 1, 1, 1, 1, 2, 23, 19, -124, -124, -124, -124, 248, 680, -124, -124, -124, -124, -124, -124, -124, -124, -124, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 681, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 682, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 1, 110, 683, 2, 36, 68, 245, 684, 13, 6, 30, 6, 1, 39, 24, 1, 1, 1, 1, 2, 23, 19, -116, -116, -116, -116, -116, -116, -116, -116, -116, -116, -116, -116, -116, 4, 69, 1, 2, 2, -76, -76, -76, -76, 2, 6, 37, 107, 685, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -407, -407, -407, -407, -407, 108, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, 126, -407, -407, -407, -407, -407, -407, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -340, -340, -340, -340, -340, 108, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, 686, -340, -340, 126, -340, -340, -340, 687, -340, -340, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -345, -345, -345, -345, -345, 108, -345, -345, -345, -345, -345, -345, -345, -345, -345, -345, 688, -345, -345, 126, -345, -345, -345, -345, -345, -345, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -349, -349, -349, -349, -349, 108, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, 689, -349, -349, 126, -349, -349, -349, -349, -349, -349, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 690, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 691, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -354, -354, -354, -354, -354, 108, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, 126, -354, -354, -354, -354, -354, -354, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 24, 43, 13, 55, 21, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -276, 108, -276, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 1, 111, 692, 1, 111, 693, 23, 56, 55, 21, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 108, -82, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, 26, 43, 13, 2, 74, 28, 1, 12, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 694, 108, 313, 127, 451, 312, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 1, 43, 695, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, 23, 43, 13, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 696, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 1, 111, 697, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, 23, 43, 13, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 698, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, -132, 9, 1, 5, 32, 4, 1, 32, 7, 15, 75, -134, -134, -134, -134, -134, -134, -134, -134, -134, 6, 6, 32, 4, 1, 39, 33, -143, -143, -143, -143, -143, -143, 8, 6, 32, 4, 1, 39, 15, 21, 17, -138, -138, -138, -138, 336, -138, 699, -138, 2, 39, 3, 603, 163, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, 107, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 3, 3, 1, 1, 1, 1, 2, 1, 1, 5, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, -51, 487, 488, 489, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, -51, 53, 43, 54, 55, 56, 700, 490, 491, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -69, -56, -69, -69, -69, -69, -56, -69, -69, 701, 702, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, 1, 59, 703, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 5, 7, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 7, 4, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 7, 4, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 704, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 705, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 706, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 707, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 25, 39, 3, 14, 76, 4, 37, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 708, 163, 108, 127, 709, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 25, 39, 3, 14, 76, 4, 37, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 710, 163, 108, 127, 711, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, 2, 39, 3, 712, 163, 1, 43, 713, 4, 6, 37, 142, 2, 714, -365, -365, -365, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 715, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, 2, 39, 3, 716, 163, 3, 68, 1, 1, 717, 105, 106, 8, 6, 32, 4, 1, 39, 15, 21, 17, -138, -138, -138, -138, 524, -138, 718, -138, 13, 1, 5, 32, 4, 1, 32, 7, 15, 75, 2, 1, 17, 1, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, 1, 64, 719, 4, 35, 24, 86, 2, 384, 104, 720, 385, 6, 35, 7, 17, 85, 1, 2, 384, 383, 104, 721, 382, 385, 5, 6, 36, 1, 39, 53, -226, -226, -226, -226, -226, 3, 6, 36, 1, 638, 639, 722, 5, 6, 36, 1, 39, 53, -231, -231, -231, -231, -231, 5, 6, 36, 1, 39, 53, -233, -233, -233, -233, -233, 13, 1, 5, 32, 4, 1, 32, 7, 15, 75, 2, 1, 17, 1, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, 14, 1, 5, 32, 4, 1, 21, 11, 7, 15, 75, 2, 1, 17, 1, -237, -237, -237, -237, -237, 723, -237, -237, -237, -237, -237, -237, -237, -237, 4, 35, 24, 88, 5, 391, 104, 392, 724, 6, 35, 7, 17, 88, 3, 2, 391, 390, 104, 392, 725, 389, 5, 6, 36, 1, 39, 53, -249, -249, -249, -249, -249, 3, 6, 36, 1, 646, 647, 726, 5, 6, 36, 1, 39, 53, -254, -254, -254, -254, -254, 5, 6, 36, 1, 39, 53, -255, -255, -255, -255, -255, 5, 6, 36, 1, 39, 53, -257, -257, -257, -257, -257, 31, 1, 5, 32, 4, 1, 13, 19, 7, 15, 35, 40, 1, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -241, -241, -241, -241, -241, 108, -241, -241, -241, 127, -241, 126, -241, -241, -241, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 23, 43, 13, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 727, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 13, 1, 5, 32, 4, 1, 32, 7, 15, 75, 2, 1, 17, 1, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, 9, 6, 32, 4, 1, 39, 15, 21, 17, 24, -138, -138, -138, -138, 404, -138, 405, -138, 728, 5, 6, 36, 1, 39, 15, -291, -291, -291, -291, -291, 5, 6, 36, 1, 39, 15, -292, -292, -292, -292, -292, 1, 111, 729, 54, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 5, 2, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, 106, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 6, 4, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 340, 239, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 43, 54, 55, 56, 87, 241, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 240, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 730, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 108, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 6, 1, 6, 4, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 340, 239, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 416, 53, 43, 54, 55, 56, 87, 241, 104, 27, 28, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 42, 90, 91, 72, 240, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 731, 86, 415, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 44, 45, 68, 46, 47, 48, 50, 51, 5, 6, 32, 4, 1, 39, -281, -281, -281, -281, -281, 3, 6, 36, 1, 663, 664, 732, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, 14, 35, 19, 5, 4, 32, 1, 24, 1, 5, 5, 2, 4, 44, 1, 155, 159, 104, 158, 156, 83, 200, 157, 296, 99, 733, 734, 295, 199, 23, 43, 13, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 735, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 5, 6, 36, 1, 39, 53, -208, -208, -208, -208, -208, 8, 6, 32, 4, 1, 39, 15, 21, 17, -138, -138, -138, -138, 425, -138, 736, -138, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 737, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 557, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 23, 43, 13, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 738, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 6, 6, 36, 1, 39, 11, 42, -106, -106, -106, -106, -106, -106, 13, 6, 30, 6, 1, 39, 24, 1, 1, 1, 1, 2, 23, 19, -117, -117, -117, -117, -117, -117, -117, -117, -117, -117, -117, -117, -117, 13, 6, 30, 6, 1, 39, 24, 1, 1, 1, 1, 2, 23, 19, -118, -118, -118, -118, -118, -118, -118, -118, -118, -118, -118, -118, -118, 13, 6, 30, 6, 1, 39, 24, 1, 1, 1, 1, 2, 23, 19, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, 13, 6, 30, 6, 1, 39, 24, 1, 1, 1, 1, 2, 23, 19, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, 13, 6, 30, 6, 1, 39, 24, 1, 1, 1, 1, 2, 23, 19, -121, -121, -121, -121, -121, -121, -121, -121, -121, -121, -121, -121, -121, 13, 6, 30, 6, 1, 39, 24, 1, 1, 1, 1, 2, 23, 19, -122, -122, -122, -122, -122, -122, -122, -122, -122, -122, -122, -122, -122, 23, 56, 55, 21, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 108, 739, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 740, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 741, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 742, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 13, 6, 30, 6, 1, 39, 24, 1, 1, 1, 1, 2, 23, 19, -115, -115, -115, -115, -115, -115, -115, -115, -115, -115, -115, -115, -115, 1, 75, 743, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 744, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 745, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 746, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 747, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -347, -347, -347, -347, -347, 108, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, 748, -347, -347, 126, -347, -347, -347, -347, -347, -347, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -351, -351, -351, -351, -351, 108, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, 749, -351, -351, 126, -351, -351, -351, -351, -351, -351, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, 1, 111, 750, 1, 111, 751, 1, 111, 752, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, 1, 111, 753, 3, 6, 36, 1, 477, 478, 754, 2, 6, 37, -50, -50, 2, 6, 37, -57, -57, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 755, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 2, 6, 37, -59, -59, 25, 39, 3, 14, 76, 41, 1, 1, 4, 13, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 756, 163, 108, 127, 126, 96, 97, 757, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 25, 39, 3, 14, 76, 4, 37, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 758, 163, 108, 127, 759, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 24, 39, 3, 14, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 760, 163, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 24, 39, 3, 14, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 761, 163, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 762, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 763, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 1, 43, 764, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, 3, 43, 142, 2, -366, -366, -366, 24, 42, 14, 26, 50, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -303, 108, -303, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, 13, 1, 5, 32, 4, 1, 32, 7, 15, 75, 2, 1, 17, 1, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, 3, 6, 36, 93, 638, 639, 765, 3, 68, 1, 1, 766, 105, 106, 5, 6, 36, 1, 39, 53, -227, -227, -227, -227, -227, 8, 6, 32, 4, 1, 39, 15, 21, 17, -138, -138, -138, -138, 524, -138, 767, -138, 5, 6, 36, 1, 39, 53, -228, -228, -228, -228, -228, 3, 68, 1, 1, 768, 105, 106, 5, 6, 36, 1, 39, 53, -250, -250, -250, -250, -250, 8, 6, 32, 4, 1, 39, 15, 21, 17, -138, -138, -138, -138, 531, -138, 769, -138, 5, 6, 36, 1, 39, 53, -251, -251, -251, -251, -251, 13, 1, 5, 32, 4, 1, 32, 7, 15, 75, 2, 1, 17, 1, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, 2, 42, 1, 543, 770, 53, 1, 5, 30, 2, 4, 1, 13, 2, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, 5, 6, 32, 4, 1, 39, -282, -282, -282, -282, -282, 8, 6, 32, 4, 1, 39, 15, 21, 17, -138, -138, -138, -138, 551, -138, 771, -138, 5, 6, 32, 4, 1, 39, -283, -283, -283, -283, -283, 3, 134, 44, 2, 772, 444, 446, 11, 35, 19, 5, 4, 32, 1, 24, 1, 10, 2, 49, 155, 159, 104, 158, 156, 160, 200, 157, 99, 773, 199, 5, 6, 36, 1, 39, 53, -98, -98, -98, -98, -98, 3, 6, 36, 1, 559, 560, 774, 27, 6, 36, 1, 13, 26, 50, 3, 38, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -97, -97, -97, 108, -97, 127, -97, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 5, 6, 36, 1, 39, 53, -100, -100, -100, -100, -100, 13, 6, 30, 6, 1, 39, 24, 1, 1, 1, 1, 2, 23, 19, -125, -125, -125, -125, -125, -125, -125, -125, -125, -125, -125, -125, -125, 23, 43, 13, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 775, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 23, 56, 55, 21, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 108, 776, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 777, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 4, 69, 1, 2, 2, -77, -77, -77, -77, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -341, -341, -341, -341, -341, 108, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, 126, -341, -341, -341, 778, -341, -341, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -342, -342, -342, -342, -342, 108, -342, -342, -342, -342, -342, -342, -342, -342, -342, -342, 779, -342, -342, 126, -342, -342, -342, -342, -342, -342, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -346, -346, -346, -346, -346, 108, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, 126, -346, -346, -346, -346, -346, -346, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -350, -350, -350, -350, -350, 108, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, 126, -350, -350, -350, -350, -350, -350, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 780, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 781, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, 61, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, 6, 6, 32, 4, 1, 39, 33, -144, -144, -144, -144, -144, -144, 24, 6, 37, 13, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -58, -58, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 782, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 783, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, 24, 39, 3, 14, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 784, 163, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 24, 39, 3, 14, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 785, 163, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, 1, 64, 786, 13, 1, 5, 32, 4, 1, 32, 7, 15, 75, 2, 1, 17, 1, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, 3, 6, 36, 1, 638, 639, 787, 13, 1, 5, 32, 4, 1, 32, 7, 15, 75, 2, 1, 17, 1, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, 3, 6, 36, 1, 646, 647, 788, 5, 6, 36, 1, 39, 15, -293, -293, -293, -293, -293, 3, 6, 36, 1, 663, 664, 789, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 790, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 1, 134, 791, 5, 6, 36, 1, 39, 53, -209, -209, -209, -209, -209, 1, 111, 792, 13, 6, 30, 6, 1, 39, 24, 1, 1, 1, 1, 2, 23, 19, -127, -127, -127, -127, -127, -127, -127, -127, -127, -127, -127, -127, -127, 23, 43, 13, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 793, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 794, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 795, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -348, -348, -348, -348, -348, 108, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, 126, -348, -348, -348, -348, -348, -348, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -352, -352, -352, -352, -352, 108, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, 126, -352, -352, -352, -352, -352, -352, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 24, 39, 3, 14, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 796, 163, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 24, 39, 3, 14, 76, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 797, 163, 108, 127, 126, 96, 97, 124, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, 3, 68, 1, 1, 798, 105, 106, 5, 6, 36, 1, 39, 53, -229, -229, -229, -229, -229, 5, 6, 36, 1, 39, 53, -252, -252, -252, -252, -252, 5, 6, 32, 4, 1, 39, -284, -284, -284, -284, -284, 43, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 3, 14, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -345, -345, -345, -345, -345, 108, -345, -345, 801, -345, -345, -345, -345, 799, -345, -345, -345, 800, -345, -345, 126, -345, -345, -345, -345, -345, -345, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 802, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 13, 6, 30, 6, 1, 39, 24, 1, 1, 1, 1, 2, 23, 19, -126, -126, -126, -126, -126, -126, -126, -126, -126, -126, -126, -126, -126, 1, 111, 803, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -343, -343, -343, -343, -343, 108, -343, -343, -343, -343, -343, -343, -343, -343, -343, -343, -343, -343, -343, 126, -343, -343, -343, -343, -343, -343, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 42, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -344, -344, -344, -344, -344, 108, -344, -344, -344, -344, -344, -344, -344, -344, -344, -344, -344, -344, -344, 126, -344, -344, -344, -344, -344, -344, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, 41, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 17, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, 13, 1, 5, 32, 4, 1, 32, 7, 15, 75, 2, 1, 17, 1, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, 1, 135, 804, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 805, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 6, 6, 32, 4, 1, 54, 38, -139, -139, -139, -139, -139, -139, 43, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 3, 14, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -347, -347, -347, -347, -347, 108, -347, -347, 801, -347, -347, -347, -347, 806, -347, -347, -347, 807, -347, -347, 126, -347, -347, -347, -347, -347, -347, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 13, 6, 30, 6, 1, 39, 24, 1, 1, 1, 1, 2, 23, 19, -128, -128, -128, -128, -128, -128, -128, -128, -128, -128, -128, -128, -128, 57, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, 43, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 3, 14, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -346, -346, -346, -346, -346, 108, -346, -346, 801, -346, -346, -346, -346, 808, -346, -346, -346, -346, -346, -346, 126, -346, -346, -346, -346, -346, -346, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 1, 135, 809, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 4, 5, 3, 1, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 6, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 810, 166, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 67, 92, 33, 53, 171, 54, 55, 56, 87, 104, 66, 73, 74, 100, 101, 105, 106, 76, 102, 103, 37, 34, 75, 77, 78, 79, 80, 81, 93, 83, 35, 40, 39, 84, 85, 69, 170, 90, 91, 72, 52, 36, 38, 41, 88, 89, 99, 62, 64, 70, 71, 86, 59, 65, 82, 60, 96, 97, 61, 98, 49, 63, 57, 94, 58, 95, 172, 173, 174, 46, 47, 48, 50, 51, 1, 135, 811, 57, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, 43, 1, 5, 32, 4, 1, 13, 2, 17, 7, 11, 4, 14, 4, 3, 14, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -348, -348, -348, -348, -348, 108, -348, -348, 801, -348, -348, -348, -348, 812, -348, -348, -348, -348, -348, -348, 126, -348, -348, -348, -348, -348, -348, 125, 110, 109, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 57, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, 1, 135, 813, 57, 1, 5, 30, 2, 3, 1, 1, 1, 1, 11, 1, 1, 11, 1, 5, 7, 11, 4, 9, 1, 1, 1, 1, 1, 1, 3, 10, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203], t = [], p = 0, n, o, k2, a;
    while (p < d.length) {
      n = d[p++];
      o = {};
      k2 = 0;
      a = [];
      while (n--)
        k2 += d[p++], a.push(k2);
      for (k2 of a)
        o[k2] = d[p++];
      t.push(o);
    }
    return t;
  })(),
  ruleTable: [0, 0, 3, 0, 3, 1, 4, 1, 4, 3, 4, 2, 5, 1, 5, 1, 5, 1, 9, 1, 9, 1, 9, 1, 9, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 33, 6, 33, 3, 18, 3, 18, 4, 18, 5, 19, 3, 19, 4, 19, 5, 20, 3, 20, 4, 20, 5, 21, 3, 21, 2, 22, 2, 23, 2, 24, 5, 51, 1, 51, 3, 51, 2, 52, 1, 52, 1, 52, 1, 52, 1, 53, 2, 53, 3, 53, 4, 53, 3, 8, 1, 8, 1, 32, 1, 32, 2, 32, 4, 32, 3, 39, 2, 39, 3, 35, 1, 65, 1, 66, 1, 66, 1, 68, 1, 68, 3, 71, 1, 71, 2, 73, 3, 73, 5, 73, 2, 73, 1, 76, 1, 76, 3, 81, 3, 81, 1, 83, 1, 83, 1, 83, 1, 83, 1, 83, 1, 83, 1, 83, 1, 83, 1, 17, 3, 17, 4, 17, 5, 90, 1, 90, 1, 90, 3, 90, 5, 90, 3, 90, 5, 94, 1, 94, 1, 94, 1, 91, 1, 91, 3, 91, 4, 91, 1, 92, 2, 92, 2, 98, 1, 98, 1, 98, 1, 98, 1, 98, 1, 98, 3, 98, 2, 98, 3, 98, 3, 98, 3, 98, 3, 98, 3, 98, 3, 98, 2, 98, 2, 98, 4, 98, 6, 98, 5, 98, 7, 10, 2, 10, 4, 10, 1, 15, 5, 15, 2, 60, 5, 60, 2, 47, 1, 47, 1, 118, 0, 118, 1, 37, 0, 37, 1, 37, 3, 37, 4, 37, 6, 119, 1, 119, 3, 119, 2, 119, 1, 120, 1, 120, 1, 120, 1, 120, 1, 122, 2, 123, 1, 123, 1, 123, 3, 123, 3, 123, 3, 123, 3, 123, 2, 123, 2, 123, 4, 123, 6, 123, 4, 123, 6, 123, 4, 123, 5, 123, 7, 123, 5, 123, 7, 123, 5, 123, 7, 123, 3, 123, 3, 123, 3, 123, 3, 123, 2, 123, 2, 123, 4, 123, 6, 123, 5, 123, 7, 40, 1, 40, 1, 40, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 100, 3, 100, 4, 100, 6, 128, 3, 128, 3, 63, 10, 63, 12, 63, 11, 63, 13, 63, 4, 138, 0, 138, 1, 138, 3, 138, 4, 138, 6, 30, 1, 30, 2, 30, 3, 30, 4, 30, 2, 30, 3, 30, 4, 30, 5, 12, 2, 12, 4, 12, 4, 12, 5, 12, 7, 12, 6, 12, 9, 144, 1, 144, 3, 144, 4, 144, 4, 144, 6, 145, 1, 145, 3, 145, 1, 145, 3, 142, 1, 143, 3, 13, 3, 13, 5, 13, 2, 13, 2, 13, 4, 13, 5, 13, 6, 13, 3, 13, 5, 13, 4, 13, 5, 13, 7, 150, 1, 150, 3, 150, 4, 150, 4, 150, 6, 152, 1, 152, 3, 152, 3, 152, 1, 152, 3, 79, 3, 79, 3, 79, 3, 79, 2, 79, 2, 103, 0, 103, 1, 104, 2, 104, 4, 101, 1, 101, 1, 95, 2, 121, 2, 121, 3, 121, 4, 160, 1, 160, 1, 126, 5, 124, 3, 124, 2, 124, 2, 124, 1, 155, 1, 155, 3, 155, 4, 155, 4, 155, 6, 162, 1, 162, 1, 162, 1, 162, 1, 158, 1, 158, 3, 158, 4, 158, 4, 158, 6, 163, 1, 163, 2, 159, 1, 159, 2, 157, 1, 157, 2, 164, 1, 164, 2, 165, 1, 165, 3, 26, 2, 26, 3, 26, 4, 26, 5, 167, 3, 167, 3, 167, 2, 31, 2, 31, 4, 99, 3, 99, 5, 173, 2, 173, 4, 173, 2, 173, 4, 27, 2, 27, 2, 27, 2, 27, 1, 176, 2, 176, 2, 28, 5, 28, 7, 28, 7, 28, 9, 28, 9, 28, 5, 28, 7, 28, 6, 28, 8, 28, 5, 28, 7, 28, 6, 28, 8, 28, 3, 28, 5, 28, 5, 28, 7, 28, 7, 28, 9, 28, 9, 28, 5, 28, 7, 28, 6, 28, 8, 28, 5, 28, 7, 28, 6, 28, 8, 28, 3, 28, 5, 182, 1, 182, 3, 133, 1, 133, 3, 29, 5, 29, 7, 29, 4, 29, 6, 184, 1, 184, 2, 186, 3, 186, 4, 188, 3, 188, 5, 190, 3, 190, 5, 25, 1, 25, 3, 25, 1, 25, 3, 25, 3, 25, 3, 25, 3, 61, 2, 61, 2, 61, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 4, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 5, 16, 3, 16, 5, 16, 4, 127, 2],
  ruleActions: (rule, vals, locs, shared) => {
    const $ = vals;
    const $0 = vals.length - 1;
    switch (rule) {
      case 1:
        return ["program"];
      case 2:
        return ["program", ...$[$0]];
      case 3:
      case 49:
      case 74:
      case 141:
      case 206:
      case 225:
      case 248:
      case 280:
      case 294:
      case 298:
      case 357:
      case 363:
        return [$[$0]];
      case 4:
      case 50:
      case 142:
      case 207:
      case 226:
      case 249:
      case 281:
        return [...$[$0 - 2], $[$0]];
      case 5:
      case 51:
      case 76:
      case 301:
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
      case 52:
      case 53:
      case 54:
      case 55:
      case 60:
      case 61:
      case 68:
      case 69:
      case 70:
      case 71:
      case 72:
      case 79:
      case 80:
      case 84:
      case 85:
      case 86:
      case 89:
      case 90:
      case 91:
      case 96:
      case 101:
      case 102:
      case 103:
      case 104:
      case 107:
      case 110:
      case 111:
      case 112:
      case 113:
      case 114:
      case 136:
      case 137:
      case 138:
      case 139:
      case 145:
      case 149:
      case 150:
      case 151:
      case 152:
      case 154:
      case 155:
      case 183:
      case 184:
      case 185:
      case 186:
      case 187:
      case 188:
      case 189:
      case 190:
      case 191:
      case 192:
      case 193:
      case 194:
      case 230:
      case 232:
      case 234:
      case 253:
      case 256:
      case 285:
      case 286:
      case 287:
      case 289:
      case 302:
      case 322:
      case 355:
      case 371:
      case 373:
        return $[$0];
      case 33:
        return ["def", $[$0 - 4], $[$0 - 2], $[$0]];
      case 34:
        return ["def", $[$0 - 1], [], $[$0]];
      case 35:
        return ["signal", $[$0 - 2], $[$0]];
      case 36:
        return ["signal", $[$0 - 3], $[$0]];
      case 37:
        return ["signal", $[$0 - 4], $[$0 - 1]];
      case 38:
        return ["derived", $[$0 - 2], $[$0]];
      case 39:
        return ["derived", $[$0 - 3], $[$0]];
      case 40:
        return ["derived", $[$0 - 4], $[$0 - 1]];
      case 41:
        return ["readonly", $[$0 - 2], $[$0]];
      case 42:
        return ["readonly", $[$0 - 3], $[$0]];
      case 43:
        return ["readonly", $[$0 - 4], $[$0 - 1]];
      case 44:
      case 45:
        return ["effect", $[$0]];
      case 46:
        return ["render", $[$0]];
      case 47:
        return ["style", $[$0]];
      case 48:
        return ["component", $[$0 - 3], ["block", ...$[$0 - 1]]];
      case 56:
        return ["prop", $[$0]];
      case 57:
        return ["prop", $[$0 - 1], "optional"];
      case 58:
        return ["prop", $[$0 - 2], $[$0]];
      case 59:
        return ["prop-rest", $[$0]];
      case 62:
        return ["yield"];
      case 63:
        return ["yield", $[$0]];
      case 64:
        return ["yield", $[$0 - 1]];
      case 65:
        return ["yield-from", $[$0]];
      case 66:
        return ["block"];
      case 67:
        return ["block", ...$[$0 - 1]];
      case 73:
        return ["str", ...$[$0 - 1]];
      case 75:
      case 295:
      case 299:
      case 364:
        return [...$[$0 - 1], $[$0]];
      case 77:
      case 228:
      case 251:
      case 266:
      case 283:
        return $[$0 - 2];
      case 78:
        return "";
      case 81:
        return ["regex", $[$0 - 1]];
      case 82:
        return ["regex-index", $[$0 - 2], $[$0]];
      case 83:
        return ["regex-index", $[$0], null];
      case 87:
        return "undefined";
      case 88:
        return "null";
      case 92:
        return ["=", $[$0 - 2], $[$0]];
      case 93:
        return ["=", $[$0 - 3], $[$0]];
      case 94:
        return ["=", $[$0 - 4], $[$0 - 1]];
      case 95:
        return [$[$0], $[$0], null];
      case 97:
        return [$[$0 - 2], $[$0], ":"];
      case 98:
        return [$[$0 - 4], $[$0 - 1], ":"];
      case 99:
        return [$[$0 - 2], $[$0], "="];
      case 100:
        return [$[$0 - 4], $[$0 - 1], "="];
      case 105:
        return ["computed", $[$0 - 1]];
      case 106:
        return ["[]", "this", $[$0 - 1]];
      case 108:
      case 109:
      case 153:
        return ["...", $[$0]];
      case 115:
      case 261:
        return ["super", ...$[$0]];
      case 116:
      case 262:
        return ["import", ...$[$0]];
      case 117:
      case 118:
        return [$[$0 - 2], ...$[$0]];
      case 119:
      case 156:
      case 173:
        return [".", $[$0 - 2], $[$0]];
      case 120:
      case 157:
      case 174:
        return ["?.", $[$0 - 2], $[$0]];
      case 121:
      case 158:
      case 175:
        return ["::", $[$0 - 2], $[$0]];
      case 122:
      case 159:
      case 176:
        return ["?::", $[$0 - 2], $[$0]];
      case 123:
      case 160:
      case 177:
        return ["::", $[$0 - 1], "prototype"];
      case 124:
      case 161:
      case 178:
        return ["?::", $[$0 - 1], "prototype"];
      case 125:
      case 162:
      case 164:
      case 179:
        return ["[]", $[$0 - 3], $[$0 - 1]];
      case 126:
      case 163:
      case 165:
      case 180:
        return ["[]", $[$0 - 5], $[$0 - 2]];
      case 127:
      case 167:
      case 169:
      case 181:
        return ["?[]", $[$0 - 4], $[$0 - 1]];
      case 128:
      case 168:
      case 170:
      case 182:
        return ["?[]", $[$0 - 6], $[$0 - 2]];
      case 129:
        return ["return", $[$0]];
      case 130:
        return ["return", $[$0 - 1]];
      case 131:
        return ["return"];
      case 132:
      case 134:
        return [$[$0 - 1], $[$0 - 3], $[$0]];
      case 133:
      case 135:
        return [$[$0 - 1], [], $[$0]];
      case 140:
      case 205:
      case 265:
      case 296:
        return [];
      case 143:
      case 208:
      case 227:
      case 250:
      case 282:
        return [...$[$0 - 3], $[$0]];
      case 144:
      case 209:
      case 229:
      case 252:
      case 284:
        return [...$[$0 - 5], ...$[$0 - 2]];
      case 146:
      case 356:
        return ["default", $[$0 - 2], $[$0]];
      case 147:
        return ["rest", $[$0]];
      case 148:
        return ["expansion"];
      case 166:
        return [$[$0 - 1][0], $[$0 - 3], ...$[$0 - 1].slice(1)];
      case 171:
        return ["optindex", $[$0 - 4], $[$0 - 1]];
      case 172:
        return ["optindex", $[$0 - 6], $[$0 - 2]];
      case 195:
        return [".", "super", $[$0]];
      case 196:
        return ["[]", "super", $[$0 - 1]];
      case 197:
        return ["[]", "super", $[$0 - 2]];
      case 198:
        return [".", "new", $[$0]];
      case 199:
        return [".", "import", $[$0]];
      case 200:
        return ["object-comprehension", $[$0 - 8], $[$0 - 6], [["for-of", $[$0 - 4], $[$0 - 2], false]], []];
      case 201:
        return ["object-comprehension", $[$0 - 10], $[$0 - 8], [["for-of", $[$0 - 6], $[$0 - 4], false]], [$[$0 - 2]]];
      case 202:
        return ["object-comprehension", $[$0 - 9], $[$0 - 7], [["for-of", $[$0 - 4], $[$0 - 2], true]], []];
      case 203:
        return ["object-comprehension", $[$0 - 11], $[$0 - 9], [["for-of", $[$0 - 6], $[$0 - 4], true]], [$[$0 - 2]]];
      case 204:
        return ["object", ...$[$0 - 2]];
      case 210:
        return ["class", null, null];
      case 211:
        return ["class", null, null, $[$0]];
      case 212:
        return ["class", null, $[$0]];
      case 213:
        return ["class", null, $[$0 - 1], $[$0]];
      case 214:
        return ["class", $[$0], null];
      case 215:
        return ["class", $[$0 - 1], null, $[$0]];
      case 216:
        return ["class", $[$0 - 2], $[$0]];
      case 217:
        return ["class", $[$0 - 3], $[$0 - 1], $[$0]];
      case 218:
      case 221:
        return ["import", "{}", $[$0]];
      case 219:
      case 220:
        return ["import", $[$0 - 2], $[$0]];
      case 222:
        return ["import", $[$0 - 4], $[$0]];
      case 223:
        return ["import", [$[$0 - 4], $[$0 - 2]], $[$0]];
      case 224:
        return ["import", [$[$0 - 7], $[$0 - 4]], $[$0]];
      case 231:
      case 233:
      case 254:
      case 255:
      case 257:
      case 358:
        return [$[$0 - 2], $[$0]];
      case 235:
        return ["*", $[$0]];
      case 236:
        return ["export", "{}"];
      case 237:
        return ["export", $[$0 - 2]];
      case 238:
      case 239:
        return ["export", $[$0]];
      case 240:
        return ["export", ["=", $[$0 - 2], $[$0]]];
      case 241:
        return ["export", ["=", $[$0 - 3], $[$0]]];
      case 242:
        return ["export", ["=", $[$0 - 4], $[$0 - 1]]];
      case 243:
        return ["export-default", $[$0]];
      case 244:
        return ["export-default", $[$0 - 1]];
      case 245:
        return ["export-all", $[$0]];
      case 246:
        return ["export-from", "{}", $[$0]];
      case 247:
        return ["export-from", $[$0 - 4], $[$0]];
      case 258:
        return ["tagged-template", $[$0 - 2], $[$0]];
      case 259:
        return $[$0 - 1] ? ["?call", $[$0 - 2], ...$[$0]] : [$[$0 - 2], ...$[$0]];
      case 260:
        return ["optcall", $[$0 - 2], ...$[$0]];
      case 263:
      case 300:
        return null;
      case 264:
        return true;
      case 267:
      case 268:
        return "this";
      case 269:
        return [".", "this", $[$0]];
      case 270:
        return ["array"];
      case 271:
        return ["array", ...$[$0 - 1]];
      case 272:
        return ["array", ...$[$0 - 2], ...$[$0 - 1]];
      case 273:
        return "..";
      case 274:
      case 288:
        return "...";
      case 275:
        return [$[$0 - 2], $[$0 - 3], $[$0 - 1]];
      case 276:
      case 395:
      case 397:
      case 398:
      case 406:
      case 408:
        return [$[$0 - 1], $[$0 - 2], $[$0]];
      case 277:
        return [$[$0], $[$0 - 1], null];
      case 278:
        return [$[$0 - 1], null, $[$0]];
      case 279:
        return [$[$0], null, null];
      case 290:
        return [...$[$0 - 2], ...$[$0]];
      case 291:
        return [...$[$0 - 3], ...$[$0]];
      case 292:
        return [...$[$0 - 2], ...$[$0 - 1]];
      case 293:
        return [...$[$0 - 5], ...$[$0 - 4], ...$[$0 - 2], ...$[$0 - 1]];
      case 297:
        return [...$[$0]];
      case 303:
        return Array.isArray($[$0 - 2]) ? [...$[$0 - 2], $[$0]] : [$[$0 - 2], $[$0]];
      case 304:
        return ["try", $[$0]];
      case 305:
        return ["try", $[$0 - 1], $[$0]];
      case 306:
        return ["try", $[$0 - 2], $[$0]];
      case 307:
        return ["try", $[$0 - 3], $[$0 - 2], $[$0]];
      case 308:
      case 309:
      case 378:
      case 381:
      case 383:
        return [$[$0 - 1], $[$0]];
      case 310:
        return [null, $[$0]];
      case 311:
        return ["throw", $[$0]];
      case 312:
        return ["throw", $[$0 - 1]];
      case 313:
        return $[$0 - 1].length === 1 ? $[$0 - 1][0] : $[$0 - 1];
      case 314:
        return $[$0 - 2].length === 1 ? $[$0 - 2][0] : $[$0 - 2];
      case 315:
        return ["while", $[$0]];
      case 316:
        return ["while", $[$0 - 2], $[$0]];
      case 317:
        return ["until", $[$0]];
      case 318:
        return ["until", $[$0 - 2], $[$0]];
      case 319:
        return $[$0 - 1].length === 2 ? [$[$0 - 1][0], $[$0 - 1][1], $[$0]] : [$[$0 - 1][0], $[$0 - 1][1], $[$0 - 1][2], $[$0]];
      case 320:
      case 321:
        return $[$0].length === 2 ? [$[$0][0], $[$0][1], [$[$0 - 1]]] : [$[$0][0], $[$0][1], $[$0][2], [$[$0 - 1]]];
      case 323:
        return ["loop", $[$0]];
      case 324:
        return ["loop", [$[$0]]];
      case 325:
        return ["for-in", $[$0 - 3], $[$0 - 1], null, null, $[$0]];
      case 326:
        return ["for-in", $[$0 - 5], $[$0 - 3], null, $[$0 - 1], $[$0]];
      case 327:
        return ["for-in", $[$0 - 5], $[$0 - 3], $[$0 - 1], null, $[$0]];
      case 328:
        return ["for-in", $[$0 - 7], $[$0 - 5], $[$0 - 1], $[$0 - 3], $[$0]];
      case 329:
        return ["for-in", $[$0 - 7], $[$0 - 5], $[$0 - 3], $[$0 - 1], $[$0]];
      case 330:
        return ["for-of", $[$0 - 3], $[$0 - 1], false, null, $[$0]];
      case 331:
        return ["for-of", $[$0 - 5], $[$0 - 3], false, $[$0 - 1], $[$0]];
      case 332:
        return ["for-of", $[$0 - 3], $[$0 - 1], true, null, $[$0]];
      case 333:
        return ["for-of", $[$0 - 5], $[$0 - 3], true, $[$0 - 1], $[$0]];
      case 334:
        return ["for-from", $[$0 - 3], $[$0 - 1], false, null, $[$0]];
      case 335:
        return ["for-from", $[$0 - 5], $[$0 - 3], false, $[$0 - 1], $[$0]];
      case 336:
        return ["for-from", $[$0 - 3], $[$0 - 1], true, null, $[$0]];
      case 337:
        return ["for-from", $[$0 - 5], $[$0 - 3], true, $[$0 - 1], $[$0]];
      case 338:
        return ["for-in", [], $[$0 - 1], null, null, $[$0]];
      case 339:
        return ["for-in", [], $[$0 - 3], $[$0 - 1], null, $[$0]];
      case 340:
        return ["comprehension", $[$0 - 4], [["for-in", $[$0 - 2], $[$0], null]], []];
      case 341:
        return ["comprehension", $[$0 - 6], [["for-in", $[$0 - 4], $[$0 - 2], null]], [$[$0]]];
      case 342:
        return ["comprehension", $[$0 - 6], [["for-in", $[$0 - 4], $[$0 - 2], $[$0]]], []];
      case 343:
        return ["comprehension", $[$0 - 8], [["for-in", $[$0 - 6], $[$0 - 4], $[$0]]], [$[$0 - 2]]];
      case 344:
        return ["comprehension", $[$0 - 8], [["for-in", $[$0 - 6], $[$0 - 4], $[$0 - 2]]], [$[$0]]];
      case 345:
        return ["comprehension", $[$0 - 4], [["for-of", $[$0 - 2], $[$0], false]], []];
      case 346:
        return ["comprehension", $[$0 - 6], [["for-of", $[$0 - 4], $[$0 - 2], false]], [$[$0]]];
      case 347:
        return ["comprehension", $[$0 - 5], [["for-of", $[$0 - 2], $[$0], true]], []];
      case 348:
        return ["comprehension", $[$0 - 7], [["for-of", $[$0 - 4], $[$0 - 2], true]], [$[$0]]];
      case 349:
        return ["comprehension", $[$0 - 4], [["for-from", $[$0 - 2], $[$0], false, null]], []];
      case 350:
        return ["comprehension", $[$0 - 6], [["for-from", $[$0 - 4], $[$0 - 2], false, null]], [$[$0]]];
      case 351:
        return ["comprehension", $[$0 - 5], [["for-from", $[$0 - 2], $[$0], true, null]], []];
      case 352:
        return ["comprehension", $[$0 - 7], [["for-from", $[$0 - 4], $[$0 - 2], true, null]], [$[$0]]];
      case 353:
        return ["comprehension", $[$0 - 2], [["for-in", [], $[$0], null]], []];
      case 354:
        return ["comprehension", $[$0 - 4], [["for-in", [], $[$0 - 2], $[$0]]], []];
      case 359:
        return ["switch", $[$0 - 3], $[$0 - 1], null];
      case 360:
        return ["switch", $[$0 - 5], $[$0 - 3], $[$0 - 1]];
      case 361:
        return ["switch", null, $[$0 - 1], null];
      case 362:
        return ["switch", null, $[$0 - 3], $[$0 - 1]];
      case 365:
        return ["when", $[$0 - 1], $[$0]];
      case 366:
        return ["when", $[$0 - 2], $[$0 - 1]];
      case 367:
        return ["if", $[$0 - 1], $[$0]];
      case 368:
        return $[$0 - 4].length === 3 ? ["if", $[$0 - 4][1], $[$0 - 4][2], ["if", $[$0 - 1], $[$0]]] : [...$[$0 - 4], ["if", $[$0 - 1], $[$0]]];
      case 369:
        return ["unless", $[$0 - 1], $[$0]];
      case 370:
        return ["if", ["!", $[$0 - 3]], $[$0 - 2], $[$0]];
      case 372:
        return $[$0 - 2].length === 3 ? ["if", $[$0 - 2][1], $[$0 - 2][2], $[$0]] : [...$[$0 - 2], $[$0]];
      case 374:
      case 375:
        return ["if", $[$0], [$[$0 - 2]]];
      case 376:
      case 377:
        return ["unless", $[$0], [$[$0 - 2]]];
      case 379:
      case 380:
      case 382:
      case 411:
        return ["do-iife", $[$0]];
      case 384:
        return ["-", $[$0]];
      case 385:
        return ["+", $[$0]];
      case 386:
        return ["await", $[$0]];
      case 387:
        return ["await", $[$0 - 1]];
      case 388:
        return ["--", $[$0], false];
      case 389:
        return ["++", $[$0], false];
      case 390:
        return ["--", $[$0 - 1], true];
      case 391:
        return ["++", $[$0 - 1], true];
      case 392:
        return ["?", $[$0 - 1]];
      case 393:
        return ["+", $[$0 - 2], $[$0]];
      case 394:
        return ["-", $[$0 - 2], $[$0]];
      case 396:
        return ["**", $[$0 - 2], $[$0]];
      case 399:
        return ["&", $[$0 - 2], $[$0]];
      case 400:
        return ["^", $[$0 - 2], $[$0]];
      case 401:
        return ["|", $[$0 - 2], $[$0]];
      case 402:
        return ["&&", $[$0 - 2], $[$0]];
      case 403:
        return ["||", $[$0 - 2], $[$0]];
      case 404:
        return ["??", $[$0 - 2], $[$0]];
      case 405:
        return ["!?", $[$0 - 2], $[$0]];
      case 407:
        return ["?:", $[$0 - 4], $[$0 - 2], $[$0]];
      case 409:
        return [$[$0 - 3], $[$0 - 4], $[$0 - 1]];
      case 410:
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
    if (flags)
      content = content.slice(0, -flags.length - 1);
    else
      content = content.slice(0, -1);
    const lines = content.split(`
`);
    const cleaned = lines.map((line) => line.replace(/#.*$/, "").trim());
    return `"/${cleaned.join("")}/${flags}"`;
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
`))
      return " ".repeat(indent) + inline;
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
        const formatted = formatSExpr(elem, 0, false);
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
    const varName = typeof name === "string" ? name : name.valueOf();
    const exprCode = this.generate(expr, "value");
    return `const ${varName} = ${exprCode}`;
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
  static extractInputType(pairs) {
    for (const pair of pairs) {
      if (!Array.isArray(pair))
        continue;
      const key2 = pair[0] instanceof String ? pair[0].valueOf() : pair[0];
      const val = pair[1] instanceof String ? pair[1].valueOf() : pair[1];
      if (key2 === "type" && typeof val === "string") {
        return val.replace(/^["']|["']$/g, "");
      }
    }
    return null;
  }
  parseBindingDirective(key2, value, tag, inputType) {
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
      if (inputType === "number" || inputType === "range") {
        valueAccessor = "e.target.valueAsNumber";
      } else {
        valueAccessor = "e.target.value";
      }
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
    const inputType = CodeGenerator.extractInputType(objExpr.slice(1));
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
            if (inputType === "number" || inputType === "range") {
              valueAccessor = "e.target.valueAsNumber";
            } else {
              valueAccessor = "e.target.value";
            }
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
        const inputType = CodeGenerator.extractInputType(arg.slice(1));
        for (const pair of arg.slice(1)) {
          if (Array.isArray(pair) && pair.length >= 2) {
            const [key2, value] = pair;
            const bindInfo = this.parseBindingDirective(key2, value, tag, inputType);
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
        const inputType = CodeGenerator.extractInputType(arg.slice(1));
        for (const pair of arg.slice(1)) {
          if (Array.isArray(pair) && pair.length >= 2) {
            const [key2, value] = pair;
            const bindInfo = this.parseBindingDirective(key2, value, tag, inputType);
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

class Compiler {
  constructor(options = {}) {
    this.options = { showTokens: false, showSExpr: false, ...options };
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
        throw new Error("Nested ternary operators are not supported. Use if/else statements instead.");
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
    const code = generator.compile(sexpr);
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
var VERSION = "2.5.1";
var BUILD_DATE = "2026-01-16@07:47:41GMT";
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
