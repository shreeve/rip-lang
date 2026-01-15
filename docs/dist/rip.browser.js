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
  symbolIds: { $accept: 0, $end: 1, error: 2, Root: 3, Body: 4, Line: 5, TERMINATOR: 6, Expression: 7, ExpressionLine: 8, Statement: 9, Return: 10, STATEMENT: 11, Import: 12, Export: 13, Value: 14, Code: 15, Operation: 16, Assign: 17, ReactiveAssign: 18, DerivedAssign: 19, ReadonlyAssign: 20, EffectBlock: 21, RenderBlock: 22, StyleBlock: 23, Component: 24, If: 25, Try: 26, While: 27, For: 28, Switch: 29, Class: 30, Throw: 31, Yield: 32, Def: 33, DEF: 34, Identifier: 35, CALL_START: 36, ParamList: 37, CALL_END: 38, Block: 39, Assignable: 40, REACTIVE_ASSIGN: 41, INDENT: 42, OUTDENT: 43, DERIVED_ASSIGN: 44, READONLY_ASSIGN: 45, EFFECT: 46, FuncGlyph: 47, RENDER: 48, STYLE: 49, COMPONENT: 50, ComponentBody: 51, ComponentLine: 52, PropDecl: 53, "@": 54, PROPERTY: 55, "?": 56, "=": 57, "...": 58, IDENTIFIER: 59, CodeLine: 60, OperationLine: 61, YIELD: 62, Object: 63, FROM: 64, Property: 65, AlphaNumeric: 66, NUMBER: 67, String: 68, STRING: 69, STRING_START: 70, Interpolations: 71, STRING_END: 72, InterpolationChunk: 73, INTERPOLATION_START: 74, INTERPOLATION_END: 75, Regex: 76, REGEX: 77, REGEX_START: 78, Invocation: 79, REGEX_END: 80, RegexWithIndex: 81, ",": 82, Literal: 83, JS: 84, UNDEFINED: 85, NULL: 86, BOOL: 87, INFINITY: 88, NAN: 89, AssignObj: 90, ObjAssignable: 91, ObjRestValue: 92, ":": 93, SimpleObjAssignable: 94, ThisProperty: 95, "[": 96, "]": 97, ObjSpreadExpr: 98, Parenthetical: 99, Super: 100, This: 101, SUPER: 102, OptFuncExist: 103, Arguments: 104, DYNAMIC_IMPORT: 105, ".": 106, "?.": 107, "::": 108, "?::": 109, INDEX_START: 110, INDEX_END: 111, INDEX_SOAK: 112, RETURN: 113, PARAM_START: 114, PARAM_END: 115, "->": 116, "=>": 117, OptComma: 118, Param: 119, ParamVar: 120, Array: 121, Splat: 122, SimpleAssignable: 123, Slice: 124, ES6_OPTIONAL_INDEX: 125, Range: 126, DoIife: 127, MetaProperty: 128, NEW_TARGET: 129, IMPORT_META: 130, "{": 131, FOR: 132, ForVariables: 133, FOROF: 134, "}": 135, WHEN: 136, OWN: 137, AssignList: 138, CLASS: 139, EXTENDS: 140, IMPORT: 141, ImportDefaultSpecifier: 142, ImportNamespaceSpecifier: 143, ImportSpecifierList: 144, ImportSpecifier: 145, AS: 146, DEFAULT: 147, IMPORT_ALL: 148, EXPORT: 149, ExportSpecifierList: 150, EXPORT_ALL: 151, ExportSpecifier: 152, ES6_OPTIONAL_CALL: 153, FUNC_EXIST: 154, ArgList: 155, THIS: 156, Elisions: 157, ArgElisionList: 158, OptElisions: 159, RangeDots: 160, "..": 161, Arg: 162, ArgElision: 163, Elision: 164, SimpleArgs: 165, TRY: 166, Catch: 167, FINALLY: 168, CATCH: 169, THROW: 170, "(": 171, ")": 172, WhileSource: 173, WHILE: 174, UNTIL: 175, Loop: 176, LOOP: 177, FORIN: 178, BY: 179, FORFROM: 180, AWAIT: 181, ForValue: 182, SWITCH: 183, Whens: 184, ELSE: 185, When: 186, LEADING_WHEN: 187, IfBlock: 188, IF: 189, UnlessBlock: 190, UNLESS: 191, POST_IF: 192, POST_UNLESS: 193, UNARY: 194, DO: 195, DO_IIFE: 196, UNARY_MATH: 197, "-": 198, "+": 199, "--": 200, "++": 201, MATH: 202, "**": 203, SHIFT: 204, COMPARE: 205, "&": 206, "^": 207, "|": 208, "&&": 209, "||": 210, "??": 211, "!?": 212, RELATION: 213, "SPACE?": 214, COMPOUND_ASSIGN: 215 },
  tokenNames: { 2: "error", 6: "TERMINATOR", 11: "STATEMENT", 34: "DEF", 36: "CALL_START", 38: "CALL_END", 41: "REACTIVE_ASSIGN", 42: "INDENT", 43: "OUTDENT", 44: "DERIVED_ASSIGN", 45: "READONLY_ASSIGN", 46: "EFFECT", 48: "RENDER", 49: "STYLE", 50: "COMPONENT", 54: "@", 55: "PROPERTY", 56: "?", 57: "=", 58: "...", 59: "IDENTIFIER", 62: "YIELD", 64: "FROM", 67: "NUMBER", 69: "STRING", 70: "STRING_START", 72: "STRING_END", 74: "INTERPOLATION_START", 75: "INTERPOLATION_END", 77: "REGEX", 78: "REGEX_START", 80: "REGEX_END", 82: ",", 84: "JS", 85: "UNDEFINED", 86: "NULL", 87: "BOOL", 88: "INFINITY", 89: "NAN", 93: ":", 96: "[", 97: "]", 102: "SUPER", 105: "DYNAMIC_IMPORT", 106: ".", 107: "?.", 108: "::", 109: "?::", 110: "INDEX_START", 111: "INDEX_END", 112: "INDEX_SOAK", 113: "RETURN", 114: "PARAM_START", 115: "PARAM_END", 116: "->", 117: "=>", 125: "ES6_OPTIONAL_INDEX", 129: "NEW_TARGET", 130: "IMPORT_META", 131: "{", 132: "FOR", 134: "FOROF", 135: "}", 136: "WHEN", 137: "OWN", 139: "CLASS", 140: "EXTENDS", 141: "IMPORT", 146: "AS", 147: "DEFAULT", 148: "IMPORT_ALL", 149: "EXPORT", 151: "EXPORT_ALL", 153: "ES6_OPTIONAL_CALL", 154: "FUNC_EXIST", 156: "THIS", 161: "..", 166: "TRY", 168: "FINALLY", 169: "CATCH", 170: "THROW", 171: "(", 172: ")", 174: "WHILE", 175: "UNTIL", 177: "LOOP", 178: "FORIN", 179: "BY", 180: "FORFROM", 181: "AWAIT", 183: "SWITCH", 185: "ELSE", 187: "LEADING_WHEN", 189: "IF", 191: "UNLESS", 192: "POST_IF", 193: "POST_UNLESS", 194: "UNARY", 195: "DO", 196: "DO_IIFE", 197: "UNARY_MATH", 198: "-", 199: "+", 200: "--", 201: "++", 202: "MATH", 203: "**", 204: "SHIFT", 205: "COMPARE", 206: "&", 207: "^", 208: "|", 209: "&&", 210: "||", 211: "??", 212: "!?", 213: "RELATION", 214: "SPACE?", 215: "COMPOUND_ASSIGN" },
  parseTable: [{ 1: -1, 3: 1, 4: 2, 5: 3, 7: 4, 8: 5, 9: 6, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: 0 }, { 1: -2, 6: 107 }, { 1: -3, 6: -3, 43: -3, 75: -3, 172: -3 }, { 1: -6, 6: -6, 38: -6, 42: -6, 43: -6, 56: 108, 75: -6, 82: -6, 97: -6, 132: 127, 172: -6, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -7, 6: -7, 38: -7, 42: -7, 43: -7, 75: -7, 82: -7, 97: -7, 172: -7 }, { 1: -8, 6: -8, 38: -8, 42: -8, 43: -8, 75: -8, 82: -8, 97: -8, 172: -8, 173: 130, 174: 96, 175: 97, 192: 128, 193: 129 }, { 1: -13, 6: -13, 36: -263, 38: -13, 42: -13, 43: -13, 56: -13, 58: -13, 69: -263, 70: -263, 75: -13, 82: -13, 93: -13, 97: -13, 103: 131, 106: 133, 107: 134, 108: 135, 109: 136, 110: 137, 111: -13, 112: 138, 115: -13, 125: 139, 132: -13, 134: -13, 135: -13, 136: -13, 153: 132, 154: 140, 161: -13, 172: -13, 174: -13, 175: -13, 178: -13, 179: -13, 180: -13, 192: -13, 193: -13, 198: -13, 199: -13, 202: -13, 203: -13, 204: -13, 205: -13, 206: -13, 207: -13, 208: -13, 209: -13, 210: -13, 211: -13, 212: -13, 213: -13, 214: -13 }, { 1: -14, 6: -14, 38: -14, 42: -14, 43: -14, 56: -14, 58: -14, 75: -14, 82: -14, 93: -14, 97: -14, 106: 141, 107: 142, 108: 143, 109: 144, 110: 145, 111: -14, 112: 146, 115: -14, 132: -14, 134: -14, 135: -14, 136: -14, 161: -14, 172: -14, 174: -14, 175: -14, 178: -14, 179: -14, 180: -14, 192: -14, 193: -14, 198: -14, 199: -14, 202: -14, 203: -14, 204: -14, 205: -14, 206: -14, 207: -14, 208: -14, 209: -14, 210: -14, 211: -14, 212: -14, 213: -14, 214: -14 }, { 1: -15, 6: -15, 38: -15, 42: -15, 43: -15, 56: -15, 58: -15, 75: -15, 82: -15, 93: -15, 97: -15, 111: -15, 115: -15, 132: -15, 134: -15, 135: -15, 136: -15, 161: -15, 172: -15, 174: -15, 175: -15, 178: -15, 179: -15, 180: -15, 192: -15, 193: -15, 198: -15, 199: -15, 202: -15, 203: -15, 204: -15, 205: -15, 206: -15, 207: -15, 208: -15, 209: -15, 210: -15, 211: -15, 212: -15, 213: -15, 214: -15 }, { 1: -16, 6: -16, 38: -16, 42: -16, 43: -16, 56: -16, 58: -16, 75: -16, 82: -16, 93: -16, 97: -16, 111: -16, 115: -16, 132: -16, 134: -16, 135: -16, 136: -16, 161: -16, 172: -16, 174: -16, 175: -16, 178: -16, 179: -16, 180: -16, 192: -16, 193: -16, 198: -16, 199: -16, 202: -16, 203: -16, 204: -16, 205: -16, 206: -16, 207: -16, 208: -16, 209: -16, 210: -16, 211: -16, 212: -16, 213: -16, 214: -16 }, { 1: -17, 6: -17, 38: -17, 42: -17, 43: -17, 56: -17, 58: -17, 75: -17, 82: -17, 93: -17, 97: -17, 111: -17, 115: -17, 132: -17, 134: -17, 135: -17, 136: -17, 161: -17, 172: -17, 174: -17, 175: -17, 178: -17, 179: -17, 180: -17, 192: -17, 193: -17, 198: -17, 199: -17, 202: -17, 203: -17, 204: -17, 205: -17, 206: -17, 207: -17, 208: -17, 209: -17, 210: -17, 211: -17, 212: -17, 213: -17, 214: -17 }, { 1: -18, 6: -18, 38: -18, 42: -18, 43: -18, 56: -18, 58: -18, 75: -18, 82: -18, 93: -18, 97: -18, 111: -18, 115: -18, 132: -18, 134: -18, 135: -18, 136: -18, 161: -18, 172: -18, 174: -18, 175: -18, 178: -18, 179: -18, 180: -18, 192: -18, 193: -18, 198: -18, 199: -18, 202: -18, 203: -18, 204: -18, 205: -18, 206: -18, 207: -18, 208: -18, 209: -18, 210: -18, 211: -18, 212: -18, 213: -18, 214: -18 }, { 1: -19, 6: -19, 38: -19, 42: -19, 43: -19, 56: -19, 58: -19, 75: -19, 82: -19, 93: -19, 97: -19, 111: -19, 115: -19, 132: -19, 134: -19, 135: -19, 136: -19, 161: -19, 172: -19, 174: -19, 175: -19, 178: -19, 179: -19, 180: -19, 192: -19, 193: -19, 198: -19, 199: -19, 202: -19, 203: -19, 204: -19, 205: -19, 206: -19, 207: -19, 208: -19, 209: -19, 210: -19, 211: -19, 212: -19, 213: -19, 214: -19 }, { 1: -20, 6: -20, 38: -20, 42: -20, 43: -20, 56: -20, 58: -20, 75: -20, 82: -20, 93: -20, 97: -20, 111: -20, 115: -20, 132: -20, 134: -20, 135: -20, 136: -20, 161: -20, 172: -20, 174: -20, 175: -20, 178: -20, 179: -20, 180: -20, 192: -20, 193: -20, 198: -20, 199: -20, 202: -20, 203: -20, 204: -20, 205: -20, 206: -20, 207: -20, 208: -20, 209: -20, 210: -20, 211: -20, 212: -20, 213: -20, 214: -20 }, { 1: -21, 6: -21, 38: -21, 42: -21, 43: -21, 56: -21, 58: -21, 75: -21, 82: -21, 93: -21, 97: -21, 111: -21, 115: -21, 132: -21, 134: -21, 135: -21, 136: -21, 161: -21, 172: -21, 174: -21, 175: -21, 178: -21, 179: -21, 180: -21, 192: -21, 193: -21, 198: -21, 199: -21, 202: -21, 203: -21, 204: -21, 205: -21, 206: -21, 207: -21, 208: -21, 209: -21, 210: -21, 211: -21, 212: -21, 213: -21, 214: -21 }, { 1: -22, 6: -22, 38: -22, 42: -22, 43: -22, 56: -22, 58: -22, 75: -22, 82: -22, 93: -22, 97: -22, 111: -22, 115: -22, 132: -22, 134: -22, 135: -22, 136: -22, 161: -22, 172: -22, 174: -22, 175: -22, 178: -22, 179: -22, 180: -22, 192: -22, 193: -22, 198: -22, 199: -22, 202: -22, 203: -22, 204: -22, 205: -22, 206: -22, 207: -22, 208: -22, 209: -22, 210: -22, 211: -22, 212: -22, 213: -22, 214: -22 }, { 1: -23, 6: -23, 38: -23, 42: -23, 43: -23, 56: -23, 58: -23, 75: -23, 82: -23, 93: -23, 97: -23, 111: -23, 115: -23, 132: -23, 134: -23, 135: -23, 136: -23, 161: -23, 172: -23, 174: -23, 175: -23, 178: -23, 179: -23, 180: -23, 192: -23, 193: -23, 198: -23, 199: -23, 202: -23, 203: -23, 204: -23, 205: -23, 206: -23, 207: -23, 208: -23, 209: -23, 210: -23, 211: -23, 212: -23, 213: -23, 214: -23 }, { 1: -24, 6: -24, 38: -24, 42: -24, 43: -24, 56: -24, 58: -24, 75: -24, 82: -24, 93: -24, 97: -24, 111: -24, 115: -24, 132: -24, 134: -24, 135: -24, 136: -24, 161: -24, 172: -24, 174: -24, 175: -24, 178: -24, 179: -24, 180: -24, 192: -24, 193: -24, 198: -24, 199: -24, 202: -24, 203: -24, 204: -24, 205: -24, 206: -24, 207: -24, 208: -24, 209: -24, 210: -24, 211: -24, 212: -24, 213: -24, 214: -24 }, { 1: -25, 6: -25, 38: -25, 42: -25, 43: -25, 56: -25, 58: -25, 75: -25, 82: -25, 93: -25, 97: -25, 111: -25, 115: -25, 132: -25, 134: -25, 135: -25, 136: -25, 161: -25, 172: -25, 174: -25, 175: -25, 178: -25, 179: -25, 180: -25, 192: -25, 193: -25, 198: -25, 199: -25, 202: -25, 203: -25, 204: -25, 205: -25, 206: -25, 207: -25, 208: -25, 209: -25, 210: -25, 211: -25, 212: -25, 213: -25, 214: -25 }, { 1: -26, 6: -26, 38: -26, 42: -26, 43: -26, 56: -26, 58: -26, 75: -26, 82: -26, 93: -26, 97: -26, 111: -26, 115: -26, 132: -26, 134: -26, 135: -26, 136: -26, 161: -26, 172: -26, 174: -26, 175: -26, 178: -26, 179: -26, 180: -26, 192: -26, 193: -26, 198: -26, 199: -26, 202: -26, 203: -26, 204: -26, 205: -26, 206: -26, 207: -26, 208: -26, 209: -26, 210: -26, 211: -26, 212: -26, 213: -26, 214: -26 }, { 1: -27, 6: -27, 38: -27, 42: -27, 43: -27, 56: -27, 58: -27, 75: -27, 82: -27, 93: -27, 97: -27, 111: -27, 115: -27, 132: -27, 134: -27, 135: -27, 136: -27, 161: -27, 172: -27, 174: -27, 175: -27, 178: -27, 179: -27, 180: -27, 192: -27, 193: -27, 198: -27, 199: -27, 202: -27, 203: -27, 204: -27, 205: -27, 206: -27, 207: -27, 208: -27, 209: -27, 210: -27, 211: -27, 212: -27, 213: -27, 214: -27 }, { 1: -28, 6: -28, 38: -28, 42: -28, 43: -28, 56: -28, 58: -28, 75: -28, 82: -28, 93: -28, 97: -28, 111: -28, 115: -28, 132: -28, 134: -28, 135: -28, 136: -28, 161: -28, 172: -28, 174: -28, 175: -28, 178: -28, 179: -28, 180: -28, 192: -28, 193: -28, 198: -28, 199: -28, 202: -28, 203: -28, 204: -28, 205: -28, 206: -28, 207: -28, 208: -28, 209: -28, 210: -28, 211: -28, 212: -28, 213: -28, 214: -28 }, { 1: -29, 6: -29, 38: -29, 42: -29, 43: -29, 56: -29, 58: -29, 75: -29, 82: -29, 93: -29, 97: -29, 111: -29, 115: -29, 132: -29, 134: -29, 135: -29, 136: -29, 161: -29, 172: -29, 174: -29, 175: -29, 178: -29, 179: -29, 180: -29, 192: -29, 193: -29, 198: -29, 199: -29, 202: -29, 203: -29, 204: -29, 205: -29, 206: -29, 207: -29, 208: -29, 209: -29, 210: -29, 211: -29, 212: -29, 213: -29, 214: -29 }, { 1: -30, 6: -30, 38: -30, 42: -30, 43: -30, 56: -30, 58: -30, 75: -30, 82: -30, 93: -30, 97: -30, 111: -30, 115: -30, 132: -30, 134: -30, 135: -30, 136: -30, 161: -30, 172: -30, 174: -30, 175: -30, 178: -30, 179: -30, 180: -30, 192: -30, 193: -30, 198: -30, 199: -30, 202: -30, 203: -30, 204: -30, 205: -30, 206: -30, 207: -30, 208: -30, 209: -30, 210: -30, 211: -30, 212: -30, 213: -30, 214: -30 }, { 1: -31, 6: -31, 38: -31, 42: -31, 43: -31, 56: -31, 58: -31, 75: -31, 82: -31, 93: -31, 97: -31, 111: -31, 115: -31, 132: -31, 134: -31, 135: -31, 136: -31, 161: -31, 172: -31, 174: -31, 175: -31, 178: -31, 179: -31, 180: -31, 192: -31, 193: -31, 198: -31, 199: -31, 202: -31, 203: -31, 204: -31, 205: -31, 206: -31, 207: -31, 208: -31, 209: -31, 210: -31, 211: -31, 212: -31, 213: -31, 214: -31 }, { 1: -32, 6: -32, 38: -32, 42: -32, 43: -32, 56: -32, 58: -32, 75: -32, 82: -32, 93: -32, 97: -32, 111: -32, 115: -32, 132: -32, 134: -32, 135: -32, 136: -32, 161: -32, 172: -32, 174: -32, 175: -32, 178: -32, 179: -32, 180: -32, 192: -32, 193: -32, 198: -32, 199: -32, 202: -32, 203: -32, 204: -32, 205: -32, 206: -32, 207: -32, 208: -32, 209: -32, 210: -32, 211: -32, 212: -32, 213: -32, 214: -32 }, { 1: -60, 6: -60, 38: -60, 42: -60, 43: -60, 75: -60, 82: -60, 97: -60, 172: -60 }, { 1: -61, 6: -61, 38: -61, 42: -61, 43: -61, 75: -61, 82: -61, 97: -61, 172: -61 }, { 1: -9, 6: -9, 38: -9, 42: -9, 43: -9, 75: -9, 82: -9, 97: -9, 172: -9, 174: -9, 175: -9, 192: -9, 193: -9 }, { 1: -10, 6: -10, 38: -10, 42: -10, 43: -10, 75: -10, 82: -10, 97: -10, 172: -10, 174: -10, 175: -10, 192: -10, 193: -10 }, { 1: -11, 6: -11, 38: -11, 42: -11, 43: -11, 75: -11, 82: -11, 97: -11, 172: -11, 174: -11, 175: -11, 192: -11, 193: -11 }, { 1: -12, 6: -12, 38: -12, 42: -12, 43: -12, 75: -12, 82: -12, 97: -12, 172: -12, 174: -12, 175: -12, 192: -12, 193: -12 }, { 1: -186, 6: -186, 36: -186, 38: -186, 41: 148, 42: -186, 43: -186, 44: 149, 45: 150, 56: -186, 57: 147, 58: -186, 69: -186, 70: -186, 75: -186, 82: -186, 93: -186, 97: -186, 106: -186, 107: -186, 108: -186, 109: -186, 110: -186, 111: -186, 112: -186, 115: -186, 125: -186, 132: -186, 134: -186, 135: -186, 136: -186, 153: -186, 154: -186, 161: -186, 172: -186, 174: -186, 175: -186, 178: -186, 179: -186, 180: -186, 192: -186, 193: -186, 198: -186, 199: -186, 202: -186, 203: -186, 204: -186, 205: -186, 206: -186, 207: -186, 208: -186, 209: -186, 210: -186, 211: -186, 212: -186, 213: -186, 214: -186 }, { 1: -187, 6: -187, 36: -187, 38: -187, 42: -187, 43: -187, 56: -187, 58: -187, 69: -187, 70: -187, 75: -187, 82: -187, 93: -187, 97: -187, 106: -187, 107: -187, 108: -187, 109: -187, 110: -187, 111: -187, 112: -187, 115: -187, 125: -187, 132: -187, 134: -187, 135: -187, 136: -187, 153: -187, 154: -187, 161: -187, 172: -187, 174: -187, 175: -187, 178: -187, 179: -187, 180: -187, 192: -187, 193: -187, 198: -187, 199: -187, 202: -187, 203: -187, 204: -187, 205: -187, 206: -187, 207: -187, 208: -187, 209: -187, 210: -187, 211: -187, 212: -187, 213: -187, 214: -187 }, { 1: -188, 6: -188, 36: -188, 38: -188, 42: -188, 43: -188, 56: -188, 58: -188, 69: -188, 70: -188, 75: -188, 82: -188, 93: -188, 97: -188, 106: -188, 107: -188, 108: -188, 109: -188, 110: -188, 111: -188, 112: -188, 115: -188, 125: -188, 132: -188, 134: -188, 135: -188, 136: -188, 153: -188, 154: -188, 161: -188, 172: -188, 174: -188, 175: -188, 178: -188, 179: -188, 180: -188, 192: -188, 193: -188, 198: -188, 199: -188, 202: -188, 203: -188, 204: -188, 205: -188, 206: -188, 207: -188, 208: -188, 209: -188, 210: -188, 211: -188, 212: -188, 213: -188, 214: -188 }, { 1: -189, 6: -189, 36: -189, 38: -189, 42: -189, 43: -189, 56: -189, 58: -189, 69: -189, 70: -189, 75: -189, 82: -189, 93: -189, 97: -189, 106: -189, 107: -189, 108: -189, 109: -189, 110: -189, 111: -189, 112: -189, 115: -189, 125: -189, 132: -189, 134: -189, 135: -189, 136: -189, 153: -189, 154: -189, 161: -189, 172: -189, 174: -189, 175: -189, 178: -189, 179: -189, 180: -189, 192: -189, 193: -189, 198: -189, 199: -189, 202: -189, 203: -189, 204: -189, 205: -189, 206: -189, 207: -189, 208: -189, 209: -189, 210: -189, 211: -189, 212: -189, 213: -189, 214: -189 }, { 1: -190, 6: -190, 36: -190, 38: -190, 42: -190, 43: -190, 56: -190, 58: -190, 69: -190, 70: -190, 75: -190, 82: -190, 93: -190, 97: -190, 106: -190, 107: -190, 108: -190, 109: -190, 110: -190, 111: -190, 112: -190, 115: -190, 125: -190, 132: -190, 134: -190, 135: -190, 136: -190, 153: -190, 154: -190, 161: -190, 172: -190, 174: -190, 175: -190, 178: -190, 179: -190, 180: -190, 192: -190, 193: -190, 198: -190, 199: -190, 202: -190, 203: -190, 204: -190, 205: -190, 206: -190, 207: -190, 208: -190, 209: -190, 210: -190, 211: -190, 212: -190, 213: -190, 214: -190 }, { 1: -191, 6: -191, 36: -191, 38: -191, 42: -191, 43: -191, 56: -191, 58: -191, 69: -191, 70: -191, 75: -191, 82: -191, 93: -191, 97: -191, 106: -191, 107: -191, 108: -191, 109: -191, 110: -191, 111: -191, 112: -191, 115: -191, 125: -191, 132: -191, 134: -191, 135: -191, 136: -191, 153: -191, 154: -191, 161: -191, 172: -191, 174: -191, 175: -191, 178: -191, 179: -191, 180: -191, 192: -191, 193: -191, 198: -191, 199: -191, 202: -191, 203: -191, 204: -191, 205: -191, 206: -191, 207: -191, 208: -191, 209: -191, 210: -191, 211: -191, 212: -191, 213: -191, 214: -191 }, { 1: -192, 6: -192, 36: -192, 38: -192, 42: -192, 43: -192, 56: -192, 58: -192, 69: -192, 70: -192, 75: -192, 82: -192, 93: -192, 97: -192, 106: -192, 107: -192, 108: -192, 109: -192, 110: -192, 111: -192, 112: -192, 115: -192, 125: -192, 132: -192, 134: -192, 135: -192, 136: -192, 153: -192, 154: -192, 161: -192, 172: -192, 174: -192, 175: -192, 178: -192, 179: -192, 180: -192, 192: -192, 193: -192, 198: -192, 199: -192, 202: -192, 203: -192, 204: -192, 205: -192, 206: -192, 207: -192, 208: -192, 209: -192, 210: -192, 211: -192, 212: -192, 213: -192, 214: -192 }, { 1: -193, 6: -193, 36: -193, 38: -193, 42: -193, 43: -193, 56: -193, 58: -193, 69: -193, 70: -193, 75: -193, 82: -193, 93: -193, 97: -193, 106: -193, 107: -193, 108: -193, 109: -193, 110: -193, 111: -193, 112: -193, 115: -193, 125: -193, 132: -193, 134: -193, 135: -193, 136: -193, 153: -193, 154: -193, 161: -193, 172: -193, 174: -193, 175: -193, 178: -193, 179: -193, 180: -193, 192: -193, 193: -193, 198: -193, 199: -193, 202: -193, 203: -193, 204: -193, 205: -193, 206: -193, 207: -193, 208: -193, 209: -193, 210: -193, 211: -193, 212: -193, 213: -193, 214: -193 }, { 1: -194, 6: -194, 36: -194, 38: -194, 42: -194, 43: -194, 56: -194, 58: -194, 69: -194, 70: -194, 75: -194, 82: -194, 93: -194, 97: -194, 106: -194, 107: -194, 108: -194, 109: -194, 110: -194, 111: -194, 112: -194, 115: -194, 125: -194, 132: -194, 134: -194, 135: -194, 136: -194, 153: -194, 154: -194, 161: -194, 172: -194, 174: -194, 175: -194, 178: -194, 179: -194, 180: -194, 192: -194, 193: -194, 198: -194, 199: -194, 202: -194, 203: -194, 204: -194, 205: -194, 206: -194, 207: -194, 208: -194, 209: -194, 210: -194, 211: -194, 212: -194, 213: -194, 214: -194 }, { 6: -140, 35: 155, 37: 151, 38: -140, 42: -140, 43: -140, 54: 159, 58: 154, 59: 104, 63: 158, 82: -140, 95: 156, 96: 160, 115: -140, 119: 152, 120: 153, 121: 157, 131: 99 }, { 5: 162, 7: 4, 8: 5, 9: 6, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 39: 161, 40: 33, 42: 163, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 164, 8: 165, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 167, 8: 168, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 169, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 175, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 176, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 177, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 178, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 14: 180, 15: 181, 35: 92, 40: 182, 47: 171, 54: 87, 59: 104, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 114: 170, 116: 90, 117: 91, 121: 72, 123: 179, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 156: 86, 171: 82, 196: 174 }, { 14: 180, 15: 181, 35: 92, 40: 182, 47: 171, 54: 87, 59: 104, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 114: 170, 116: 90, 117: 91, 121: 72, 123: 183, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 156: 86, 171: 82, 196: 174 }, { 1: -183, 6: -183, 36: -183, 38: -183, 41: -183, 42: -183, 43: -183, 44: -183, 45: -183, 56: -183, 57: -183, 58: -183, 69: -183, 70: -183, 75: -183, 82: -183, 93: -183, 97: -183, 106: -183, 107: -183, 108: -183, 109: -183, 110: -183, 111: -183, 112: -183, 115: -183, 125: -183, 132: -183, 134: -183, 135: -183, 136: -183, 153: -183, 154: -183, 161: -183, 172: -183, 174: -183, 175: -183, 178: -183, 179: -183, 180: -183, 192: -183, 193: -183, 198: -183, 199: -183, 200: 184, 201: 185, 202: -183, 203: -183, 204: -183, 205: -183, 206: -183, 207: -183, 208: -183, 209: -183, 210: -183, 211: -183, 212: -183, 213: -183, 214: -183, 215: 186 }, { 39: 188, 42: 163, 47: 187, 116: 90, 117: 91 }, { 39: 189, 42: 163 }, { 39: 190, 42: 163 }, { 35: 191, 59: 104 }, { 1: -371, 6: -371, 38: -371, 42: -371, 43: -371, 56: -371, 58: -371, 75: -371, 82: -371, 93: -371, 97: -371, 111: -371, 115: -371, 132: -371, 134: -371, 135: -371, 136: -371, 161: -371, 172: -371, 174: -371, 175: -371, 178: -371, 179: -371, 180: -371, 185: 192, 192: -371, 193: -371, 198: -371, 199: -371, 202: -371, 203: -371, 204: -371, 205: -371, 206: -371, 207: -371, 208: -371, 209: -371, 210: -371, 211: -371, 212: -371, 213: -371, 214: -371 }, { 1: -373, 6: -373, 38: -373, 42: -373, 43: -373, 56: -373, 58: -373, 75: -373, 82: -373, 93: -373, 97: -373, 111: -373, 115: -373, 132: -373, 134: -373, 135: -373, 136: -373, 161: -373, 172: -373, 174: -373, 175: -373, 178: -373, 179: -373, 180: -373, 192: -373, 193: -373, 198: -373, 199: -373, 202: -373, 203: -373, 204: -373, 205: -373, 206: -373, 207: -373, 208: -373, 209: -373, 210: -373, 211: -373, 212: -373, 213: -373, 214: -373 }, { 39: 193, 42: 163 }, { 39: 194, 42: 163 }, { 1: -322, 6: -322, 38: -322, 42: -322, 43: -322, 56: -322, 58: -322, 75: -322, 82: -322, 93: -322, 97: -322, 111: -322, 115: -322, 132: -322, 134: -322, 135: -322, 136: -322, 161: -322, 172: -322, 174: -322, 175: -322, 178: -322, 179: -322, 180: -322, 192: -322, 193: -322, 198: -322, 199: -322, 202: -322, 203: -322, 204: -322, 205: -322, 206: -322, 207: -322, 208: -322, 209: -322, 210: -322, 211: -322, 212: -322, 213: -322, 214: -322 }, { 35: 155, 54: 159, 59: 104, 63: 158, 95: 156, 96: 83, 120: 200, 121: 157, 126: 198, 131: 99, 133: 195, 137: 196, 181: 197, 182: 199 }, { 7: 201, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 202, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -210, 6: -210, 14: 180, 15: 181, 35: 92, 38: -210, 39: 203, 40: 182, 42: 163, 43: -210, 47: 171, 54: 87, 56: -210, 58: -210, 59: 104, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 75: -210, 76: 76, 77: 102, 78: 103, 79: 37, 82: -210, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 93: -210, 95: 93, 96: 83, 97: -210, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 111: -210, 114: 170, 115: -210, 116: 90, 117: 91, 121: 72, 123: 205, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: -210, 134: -210, 135: -210, 136: -210, 140: 204, 156: 86, 161: -210, 171: 82, 172: -210, 174: -210, 175: -210, 178: -210, 179: -210, 180: -210, 192: -210, 193: -210, 196: 174, 198: -210, 199: -210, 202: -210, 203: -210, 204: -210, 205: -210, 206: -210, 207: -210, 208: -210, 209: -210, 210: -210, 211: -210, 212: -210, 213: -210, 214: -210 }, { 7: 206, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 207, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -62, 6: -62, 7: 208, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 38: -62, 40: 33, 42: 209, 43: -62, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 56: -62, 58: -62, 59: 104, 62: 66, 63: 73, 64: 210, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 75: -62, 76: 76, 77: 102, 78: 103, 79: 37, 82: -62, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 93: -62, 95: 93, 96: 83, 97: -62, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 111: -62, 113: 69, 114: 170, 115: -62, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: -62, 134: -62, 135: -62, 136: -62, 139: 64, 141: 70, 149: 71, 156: 86, 161: -62, 166: 59, 170: 65, 171: 82, 172: -62, 173: 60, 174: -62, 175: -62, 176: 61, 177: 98, 178: -62, 179: -62, 180: -62, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 192: -62, 193: -62, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51, 202: -62, 203: -62, 204: -62, 205: -62, 206: -62, 207: -62, 208: -62, 209: -62, 210: -62, 211: -62, 212: -62, 213: -62, 214: -62 }, { 35: 211, 59: 104 }, { 15: 213, 47: 43, 60: 212, 114: 42, 116: 90, 117: 91 }, { 1: -131, 6: -131, 7: 214, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 38: -131, 40: 33, 42: 215, 43: -131, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 75: -131, 76: 76, 77: 102, 78: 103, 79: 37, 82: -131, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 97: -131, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 172: -131, 173: 60, 174: -131, 175: -131, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 192: -131, 193: -131, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 35: 220, 59: 104, 68: 216, 69: 105, 70: 106, 131: 219, 142: 217, 143: 218, 148: 221 }, { 30: 223, 33: 224, 34: 67, 35: 225, 59: 104, 131: 222, 139: 64, 147: 226, 151: 227 }, { 1: -184, 6: -184, 36: -184, 38: -184, 41: -184, 42: -184, 43: -184, 44: -184, 45: -184, 56: -184, 57: -184, 58: -184, 69: -184, 70: -184, 75: -184, 82: -184, 93: -184, 97: -184, 106: -184, 107: -184, 108: -184, 109: -184, 110: -184, 111: -184, 112: -184, 115: -184, 125: -184, 132: -184, 134: -184, 135: -184, 136: -184, 153: -184, 154: -184, 161: -184, 172: -184, 174: -184, 175: -184, 178: -184, 179: -184, 180: -184, 192: -184, 193: -184, 198: -184, 199: -184, 202: -184, 203: -184, 204: -184, 205: -184, 206: -184, 207: -184, 208: -184, 209: -184, 210: -184, 211: -184, 212: -184, 213: -184, 214: -184 }, { 1: -185, 6: -185, 36: -185, 38: -185, 41: -185, 42: -185, 43: -185, 44: -185, 45: -185, 56: -185, 57: -185, 58: -185, 69: -185, 70: -185, 75: -185, 82: -185, 93: -185, 97: -185, 106: -185, 107: -185, 108: -185, 109: -185, 110: -185, 111: -185, 112: -185, 115: -185, 125: -185, 132: -185, 134: -185, 135: -185, 136: -185, 153: -185, 154: -185, 161: -185, 172: -185, 174: -185, 175: -185, 178: -185, 179: -185, 180: -185, 192: -185, 193: -185, 198: -185, 199: -185, 202: -185, 203: -185, 204: -185, 205: -185, 206: -185, 207: -185, 208: -185, 209: -185, 210: -185, 211: -185, 212: -185, 213: -185, 214: -185 }, { 1: -84, 6: -84, 36: -84, 38: -84, 42: -84, 43: -84, 56: -84, 58: -84, 69: -84, 70: -84, 75: -84, 82: -84, 93: -84, 97: -84, 106: -84, 107: -84, 108: -84, 109: -84, 110: -84, 111: -84, 112: -84, 115: -84, 125: -84, 132: -84, 134: -84, 135: -84, 136: -84, 153: -84, 154: -84, 161: -84, 172: -84, 174: -84, 175: -84, 178: -84, 179: -84, 180: -84, 192: -84, 193: -84, 198: -84, 199: -84, 202: -84, 203: -84, 204: -84, 205: -84, 206: -84, 207: -84, 208: -84, 209: -84, 210: -84, 211: -84, 212: -84, 213: -84, 214: -84 }, { 1: -85, 6: -85, 36: -85, 38: -85, 42: -85, 43: -85, 56: -85, 58: -85, 69: -85, 70: -85, 75: -85, 82: -85, 93: -85, 97: -85, 106: -85, 107: -85, 108: -85, 109: -85, 110: -85, 111: -85, 112: -85, 115: -85, 125: -85, 132: -85, 134: -85, 135: -85, 136: -85, 153: -85, 154: -85, 161: -85, 172: -85, 174: -85, 175: -85, 178: -85, 179: -85, 180: -85, 192: -85, 193: -85, 198: -85, 199: -85, 202: -85, 203: -85, 204: -85, 205: -85, 206: -85, 207: -85, 208: -85, 209: -85, 210: -85, 211: -85, 212: -85, 213: -85, 214: -85 }, { 1: -86, 6: -86, 36: -86, 38: -86, 42: -86, 43: -86, 56: -86, 58: -86, 69: -86, 70: -86, 75: -86, 82: -86, 93: -86, 97: -86, 106: -86, 107: -86, 108: -86, 109: -86, 110: -86, 111: -86, 112: -86, 115: -86, 125: -86, 132: -86, 134: -86, 135: -86, 136: -86, 153: -86, 154: -86, 161: -86, 172: -86, 174: -86, 175: -86, 178: -86, 179: -86, 180: -86, 192: -86, 193: -86, 198: -86, 199: -86, 202: -86, 203: -86, 204: -86, 205: -86, 206: -86, 207: -86, 208: -86, 209: -86, 210: -86, 211: -86, 212: -86, 213: -86, 214: -86 }, { 1: -87, 6: -87, 36: -87, 38: -87, 42: -87, 43: -87, 56: -87, 58: -87, 69: -87, 70: -87, 75: -87, 82: -87, 93: -87, 97: -87, 106: -87, 107: -87, 108: -87, 109: -87, 110: -87, 111: -87, 112: -87, 115: -87, 125: -87, 132: -87, 134: -87, 135: -87, 136: -87, 153: -87, 154: -87, 161: -87, 172: -87, 174: -87, 175: -87, 178: -87, 179: -87, 180: -87, 192: -87, 193: -87, 198: -87, 199: -87, 202: -87, 203: -87, 204: -87, 205: -87, 206: -87, 207: -87, 208: -87, 209: -87, 210: -87, 211: -87, 212: -87, 213: -87, 214: -87 }, { 1: -88, 6: -88, 36: -88, 38: -88, 42: -88, 43: -88, 56: -88, 58: -88, 69: -88, 70: -88, 75: -88, 82: -88, 93: -88, 97: -88, 106: -88, 107: -88, 108: -88, 109: -88, 110: -88, 111: -88, 112: -88, 115: -88, 125: -88, 132: -88, 134: -88, 135: -88, 136: -88, 153: -88, 154: -88, 161: -88, 172: -88, 174: -88, 175: -88, 178: -88, 179: -88, 180: -88, 192: -88, 193: -88, 198: -88, 199: -88, 202: -88, 203: -88, 204: -88, 205: -88, 206: -88, 207: -88, 208: -88, 209: -88, 210: -88, 211: -88, 212: -88, 213: -88, 214: -88 }, { 1: -89, 6: -89, 36: -89, 38: -89, 42: -89, 43: -89, 56: -89, 58: -89, 69: -89, 70: -89, 75: -89, 82: -89, 93: -89, 97: -89, 106: -89, 107: -89, 108: -89, 109: -89, 110: -89, 111: -89, 112: -89, 115: -89, 125: -89, 132: -89, 134: -89, 135: -89, 136: -89, 153: -89, 154: -89, 161: -89, 172: -89, 174: -89, 175: -89, 178: -89, 179: -89, 180: -89, 192: -89, 193: -89, 198: -89, 199: -89, 202: -89, 203: -89, 204: -89, 205: -89, 206: -89, 207: -89, 208: -89, 209: -89, 210: -89, 211: -89, 212: -89, 213: -89, 214: -89 }, { 1: -90, 6: -90, 36: -90, 38: -90, 42: -90, 43: -90, 56: -90, 58: -90, 69: -90, 70: -90, 75: -90, 82: -90, 93: -90, 97: -90, 106: -90, 107: -90, 108: -90, 109: -90, 110: -90, 111: -90, 112: -90, 115: -90, 125: -90, 132: -90, 134: -90, 135: -90, 136: -90, 153: -90, 154: -90, 161: -90, 172: -90, 174: -90, 175: -90, 178: -90, 179: -90, 180: -90, 192: -90, 193: -90, 198: -90, 199: -90, 202: -90, 203: -90, 204: -90, 205: -90, 206: -90, 207: -90, 208: -90, 209: -90, 210: -90, 211: -90, 212: -90, 213: -90, 214: -90 }, { 1: -91, 6: -91, 36: -91, 38: -91, 42: -91, 43: -91, 56: -91, 58: -91, 69: -91, 70: -91, 75: -91, 82: -91, 93: -91, 97: -91, 106: -91, 107: -91, 108: -91, 109: -91, 110: -91, 111: -91, 112: -91, 115: -91, 125: -91, 132: -91, 134: -91, 135: -91, 136: -91, 153: -91, 154: -91, 161: -91, 172: -91, 174: -91, 175: -91, 178: -91, 179: -91, 180: -91, 192: -91, 193: -91, 198: -91, 199: -91, 202: -91, 203: -91, 204: -91, 205: -91, 206: -91, 207: -91, 208: -91, 209: -91, 210: -91, 211: -91, 212: -91, 213: -91, 214: -91 }, { 4: 228, 5: 3, 7: 4, 8: 5, 9: 6, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 229, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 230, 8: 239, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 236, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 58: 241, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 82: 237, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 97: 231, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 122: 240, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 157: 232, 158: 233, 162: 238, 163: 235, 164: 234, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 36: 245, 104: 242, 106: 243, 110: 244 }, { 36: 245, 104: 246 }, { 1: -267, 6: -267, 36: -267, 38: -267, 42: -267, 43: -267, 56: -267, 58: -267, 69: -267, 70: -267, 75: -267, 82: -267, 93: -267, 97: -267, 106: -267, 107: -267, 108: -267, 109: -267, 110: -267, 111: -267, 112: -267, 115: -267, 125: -267, 132: -267, 134: -267, 135: -267, 136: -267, 153: -267, 154: -267, 161: -267, 172: -267, 174: -267, 175: -267, 178: -267, 179: -267, 180: -267, 192: -267, 193: -267, 198: -267, 199: -267, 202: -267, 203: -267, 204: -267, 205: -267, 206: -267, 207: -267, 208: -267, 209: -267, 210: -267, 211: -267, 212: -267, 213: -267, 214: -267 }, { 1: -268, 6: -268, 36: -268, 38: -268, 42: -268, 43: -268, 55: 248, 56: -268, 58: -268, 65: 247, 69: -268, 70: -268, 75: -268, 82: -268, 93: -268, 97: -268, 106: -268, 107: -268, 108: -268, 109: -268, 110: -268, 111: -268, 112: -268, 115: -268, 125: -268, 132: -268, 134: -268, 135: -268, 136: -268, 153: -268, 154: -268, 161: -268, 172: -268, 174: -268, 175: -268, 178: -268, 179: -268, 180: -268, 192: -268, 193: -268, 198: -268, 199: -268, 202: -268, 203: -268, 204: -268, 205: -268, 206: -268, 207: -268, 208: -268, 209: -268, 210: -268, 211: -268, 212: -268, 213: -268, 214: -268 }, { 106: 249 }, { 106: 250 }, { 11: -136, 34: -136, 42: -136, 46: -136, 48: -136, 49: -136, 50: -136, 54: -136, 59: -136, 62: -136, 67: -136, 69: -136, 70: -136, 77: -136, 78: -136, 84: -136, 85: -136, 86: -136, 87: -136, 88: -136, 89: -136, 96: -136, 102: -136, 105: -136, 113: -136, 114: -136, 116: -136, 117: -136, 129: -136, 130: -136, 131: -136, 132: -136, 139: -136, 141: -136, 149: -136, 156: -136, 166: -136, 170: -136, 171: -136, 174: -136, 175: -136, 177: -136, 181: -136, 183: -136, 189: -136, 191: -136, 194: -136, 195: -136, 196: -136, 197: -136, 198: -136, 199: -136, 200: -136, 201: -136 }, { 11: -137, 34: -137, 42: -137, 46: -137, 48: -137, 49: -137, 50: -137, 54: -137, 59: -137, 62: -137, 67: -137, 69: -137, 70: -137, 77: -137, 78: -137, 84: -137, 85: -137, 86: -137, 87: -137, 88: -137, 89: -137, 96: -137, 102: -137, 105: -137, 113: -137, 114: -137, 116: -137, 117: -137, 129: -137, 130: -137, 131: -137, 132: -137, 139: -137, 141: -137, 149: -137, 156: -137, 166: -137, 170: -137, 171: -137, 174: -137, 175: -137, 177: -137, 181: -137, 183: -137, 189: -137, 191: -137, 194: -137, 195: -137, 196: -137, 197: -137, 198: -137, 199: -137, 200: -137, 201: -137 }, { 1: -154, 6: -154, 36: -154, 38: -154, 41: -154, 42: -154, 43: -154, 44: -154, 45: -154, 56: -154, 57: -154, 58: -154, 69: -154, 70: -154, 75: -154, 82: -154, 93: -154, 97: -154, 106: -154, 107: -154, 108: -154, 109: -154, 110: -154, 111: -154, 112: -154, 115: -154, 125: -154, 132: -154, 134: -154, 135: -154, 136: -154, 140: -154, 153: -154, 154: -154, 161: -154, 172: -154, 174: -154, 175: -154, 178: -154, 179: -154, 180: -154, 192: -154, 193: -154, 198: -154, 199: -154, 200: -154, 201: -154, 202: -154, 203: -154, 204: -154, 205: -154, 206: -154, 207: -154, 208: -154, 209: -154, 210: -154, 211: -154, 212: -154, 213: -154, 214: -154, 215: -154 }, { 1: -155, 6: -155, 36: -155, 38: -155, 41: -155, 42: -155, 43: -155, 44: -155, 45: -155, 56: -155, 57: -155, 58: -155, 69: -155, 70: -155, 75: -155, 82: -155, 93: -155, 97: -155, 106: -155, 107: -155, 108: -155, 109: -155, 110: -155, 111: -155, 112: -155, 115: -155, 125: -155, 132: -155, 134: -155, 135: -155, 136: -155, 140: -155, 153: -155, 154: -155, 161: -155, 172: -155, 174: -155, 175: -155, 178: -155, 179: -155, 180: -155, 192: -155, 193: -155, 198: -155, 199: -155, 200: -155, 201: -155, 202: -155, 203: -155, 204: -155, 205: -155, 206: -155, 207: -155, 208: -155, 209: -155, 210: -155, 211: -155, 212: -155, 213: -155, 214: -155, 215: -155 }, { 7: 251, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 252, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 253, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 254, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 256, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 39: 255, 40: 33, 42: 163, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: -205, 35: 264, 42: -205, 43: -205, 54: 261, 55: 248, 58: 268, 59: 104, 65: 265, 66: 262, 67: 100, 68: 101, 69: 105, 70: 106, 82: -205, 90: 263, 91: 257, 92: 267, 94: 259, 95: 266, 96: 260, 135: -205, 138: 258 }, { 1: -70, 6: -70, 36: -70, 38: -70, 42: -70, 43: -70, 56: -70, 58: -70, 69: -70, 70: -70, 75: -70, 82: -70, 93: -70, 97: -70, 106: -70, 107: -70, 108: -70, 109: -70, 110: -70, 111: -70, 112: -70, 115: -70, 125: -70, 132: -70, 134: -70, 135: -70, 136: -70, 153: -70, 154: -70, 161: -70, 172: -70, 174: -70, 175: -70, 178: -70, 179: -70, 180: -70, 192: -70, 193: -70, 198: -70, 199: -70, 202: -70, 203: -70, 204: -70, 205: -70, 206: -70, 207: -70, 208: -70, 209: -70, 210: -70, 211: -70, 212: -70, 213: -70, 214: -70 }, { 1: -71, 6: -71, 36: -71, 38: -71, 42: -71, 43: -71, 56: -71, 58: -71, 69: -71, 70: -71, 75: -71, 82: -71, 93: -71, 97: -71, 106: -71, 107: -71, 108: -71, 109: -71, 110: -71, 111: -71, 112: -71, 115: -71, 125: -71, 132: -71, 134: -71, 135: -71, 136: -71, 153: -71, 154: -71, 161: -71, 172: -71, 174: -71, 175: -71, 178: -71, 179: -71, 180: -71, 192: -71, 193: -71, 198: -71, 199: -71, 202: -71, 203: -71, 204: -71, 205: -71, 206: -71, 207: -71, 208: -71, 209: -71, 210: -71, 211: -71, 212: -71, 213: -71, 214: -71 }, { 1: -80, 6: -80, 36: -80, 38: -80, 42: -80, 43: -80, 56: -80, 58: -80, 69: -80, 70: -80, 75: -80, 82: -80, 93: -80, 97: -80, 106: -80, 107: -80, 108: -80, 109: -80, 110: -80, 111: -80, 112: -80, 115: -80, 125: -80, 132: -80, 134: -80, 135: -80, 136: -80, 153: -80, 154: -80, 161: -80, 172: -80, 174: -80, 175: -80, 178: -80, 179: -80, 180: -80, 192: -80, 193: -80, 198: -80, 199: -80, 202: -80, 203: -80, 204: -80, 205: -80, 206: -80, 207: -80, 208: -80, 209: -80, 210: -80, 211: -80, 212: -80, 213: -80, 214: -80 }, { 14: 180, 15: 181, 35: 92, 40: 182, 47: 171, 54: 87, 59: 104, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 269, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 114: 170, 116: 90, 117: 91, 121: 72, 123: 270, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 156: 86, 171: 82, 196: 174 }, { 1: -68, 6: -68, 36: -68, 38: -68, 41: -68, 42: -68, 43: -68, 44: -68, 45: -68, 56: -68, 57: -68, 58: -68, 64: -68, 69: -68, 70: -68, 75: -68, 82: -68, 93: -68, 97: -68, 106: -68, 107: -68, 108: -68, 109: -68, 110: -68, 111: -68, 112: -68, 115: -68, 125: -68, 132: -68, 134: -68, 135: -68, 136: -68, 140: -68, 146: -68, 153: -68, 154: -68, 161: -68, 172: -68, 174: -68, 175: -68, 178: -68, 179: -68, 180: -68, 192: -68, 193: -68, 198: -68, 199: -68, 200: -68, 201: -68, 202: -68, 203: -68, 204: -68, 205: -68, 206: -68, 207: -68, 208: -68, 209: -68, 210: -68, 211: -68, 212: -68, 213: -68, 214: -68, 215: -68 }, { 1: -72, 6: -72, 36: -72, 38: -72, 42: -72, 43: -72, 56: -72, 58: -72, 69: -72, 70: -72, 72: -72, 74: -72, 75: -72, 80: -72, 82: -72, 93: -72, 97: -72, 106: -72, 107: -72, 108: -72, 109: -72, 110: -72, 111: -72, 112: -72, 115: -72, 125: -72, 132: -72, 134: -72, 135: -72, 136: -72, 153: -72, 154: -72, 161: -72, 172: -72, 174: -72, 175: -72, 178: -72, 179: -72, 180: -72, 192: -72, 193: -72, 198: -72, 199: -72, 202: -72, 203: -72, 204: -72, 205: -72, 206: -72, 207: -72, 208: -72, 209: -72, 210: -72, 211: -72, 212: -72, 213: -72, 214: -72 }, { 68: 274, 69: 105, 70: 106, 71: 271, 73: 272, 74: 273 }, { 1: -5, 5: 275, 6: -5, 7: 4, 8: 5, 9: 6, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 43: -5, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 75: -5, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 172: -5, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -392, 6: -392, 38: -392, 42: -392, 43: -392, 56: -392, 58: -392, 75: -392, 82: -392, 93: -392, 97: -392, 111: -392, 115: -392, 132: -392, 134: -392, 135: -392, 136: -392, 161: -392, 172: -392, 174: -392, 175: -392, 178: -392, 179: -392, 180: -392, 192: -392, 193: -392, 198: -392, 199: -392, 202: -392, 203: -392, 204: -392, 205: -392, 206: -392, 207: -392, 208: -392, 209: -392, 210: -392, 211: -392, 212: -392, 213: -392, 214: -392 }, { 7: 276, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 277, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 278, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 279, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 280, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 281, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 282, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 283, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 284, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 285, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 286, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 287, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 288, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 289, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 290, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 291, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 292, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -321, 6: -321, 38: -321, 42: -321, 43: -321, 56: -321, 58: -321, 75: -321, 82: -321, 93: -321, 97: -321, 111: -321, 115: -321, 132: -321, 134: -321, 135: -321, 136: -321, 161: -321, 172: -321, 174: -321, 175: -321, 178: -321, 179: -321, 180: -321, 192: -321, 193: -321, 198: -321, 199: -321, 202: -321, 203: -321, 204: -321, 205: -321, 206: -321, 207: -321, 208: -321, 209: -321, 210: -321, 211: -321, 212: -321, 213: -321, 214: -321 }, { 35: 155, 54: 159, 59: 104, 63: 158, 95: 156, 96: 83, 120: 200, 121: 157, 126: 296, 131: 99, 133: 293, 137: 294, 181: 295, 182: 199 }, { 7: 297, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 298, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -320, 6: -320, 38: -320, 42: -320, 43: -320, 56: -320, 58: -320, 75: -320, 82: -320, 93: -320, 97: -320, 111: -320, 115: -320, 132: -320, 134: -320, 135: -320, 136: -320, 161: -320, 172: -320, 174: -320, 175: -320, 178: -320, 179: -320, 180: -320, 192: -320, 193: -320, 198: -320, 199: -320, 202: -320, 203: -320, 204: -320, 205: -320, 206: -320, 207: -320, 208: -320, 209: -320, 210: -320, 211: -320, 212: -320, 213: -320, 214: -320 }, { 36: 245, 68: 299, 69: 105, 70: 106, 104: 300 }, { 36: 245, 104: 301 }, { 55: 248, 65: 302 }, { 55: 248, 65: 303 }, { 1: -160, 6: -160, 36: -160, 38: -160, 41: -160, 42: -160, 43: -160, 44: -160, 45: -160, 55: 248, 56: -160, 57: -160, 58: -160, 65: 304, 69: -160, 70: -160, 75: -160, 82: -160, 93: -160, 97: -160, 106: -160, 107: -160, 108: -160, 109: -160, 110: -160, 111: -160, 112: -160, 115: -160, 125: -160, 132: -160, 134: -160, 135: -160, 136: -160, 140: -160, 153: -160, 154: -160, 161: -160, 172: -160, 174: -160, 175: -160, 178: -160, 179: -160, 180: -160, 192: -160, 193: -160, 198: -160, 199: -160, 200: -160, 201: -160, 202: -160, 203: -160, 204: -160, 205: -160, 206: -160, 207: -160, 208: -160, 209: -160, 210: -160, 211: -160, 212: -160, 213: -160, 214: -160, 215: -160 }, { 1: -161, 6: -161, 36: -161, 38: -161, 41: -161, 42: -161, 43: -161, 44: -161, 45: -161, 55: 248, 56: -161, 57: -161, 58: -161, 65: 305, 69: -161, 70: -161, 75: -161, 82: -161, 93: -161, 97: -161, 106: -161, 107: -161, 108: -161, 109: -161, 110: -161, 111: -161, 112: -161, 115: -161, 125: -161, 132: -161, 134: -161, 135: -161, 136: -161, 140: -161, 153: -161, 154: -161, 161: -161, 172: -161, 174: -161, 175: -161, 178: -161, 179: -161, 180: -161, 192: -161, 193: -161, 198: -161, 199: -161, 200: -161, 201: -161, 202: -161, 203: -161, 204: -161, 205: -161, 206: -161, 207: -161, 208: -161, 209: -161, 210: -161, 211: -161, 212: -161, 213: -161, 214: -161, 215: -161 }, { 7: 306, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 307, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 58: 313, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 311, 77: 102, 78: 103, 79: 37, 81: 309, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 124: 308, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 160: 310, 161: 312, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 110: 314 }, { 110: 315 }, { 36: -264, 69: -264, 70: -264 }, { 55: 248, 65: 316 }, { 55: 248, 65: 317 }, { 1: -177, 6: -177, 36: -177, 38: -177, 41: -177, 42: -177, 43: -177, 44: -177, 45: -177, 55: 248, 56: -177, 57: -177, 58: -177, 65: 318, 69: -177, 70: -177, 75: -177, 82: -177, 93: -177, 97: -177, 106: -177, 107: -177, 108: -177, 109: -177, 110: -177, 111: -177, 112: -177, 115: -177, 125: -177, 132: -177, 134: -177, 135: -177, 136: -177, 140: -177, 153: -177, 154: -177, 161: -177, 172: -177, 174: -177, 175: -177, 178: -177, 179: -177, 180: -177, 192: -177, 193: -177, 198: -177, 199: -177, 200: -177, 201: -177, 202: -177, 203: -177, 204: -177, 205: -177, 206: -177, 207: -177, 208: -177, 209: -177, 210: -177, 211: -177, 212: -177, 213: -177, 214: -177, 215: -177 }, { 1: -178, 6: -178, 36: -178, 38: -178, 41: -178, 42: -178, 43: -178, 44: -178, 45: -178, 55: 248, 56: -178, 57: -178, 58: -178, 65: 319, 69: -178, 70: -178, 75: -178, 82: -178, 93: -178, 97: -178, 106: -178, 107: -178, 108: -178, 109: -178, 110: -178, 111: -178, 112: -178, 115: -178, 125: -178, 132: -178, 134: -178, 135: -178, 136: -178, 140: -178, 153: -178, 154: -178, 161: -178, 172: -178, 174: -178, 175: -178, 178: -178, 179: -178, 180: -178, 192: -178, 193: -178, 198: -178, 199: -178, 200: -178, 201: -178, 202: -178, 203: -178, 204: -178, 205: -178, 206: -178, 207: -178, 208: -178, 209: -178, 210: -178, 211: -178, 212: -178, 213: -178, 214: -178, 215: -178 }, { 7: 320, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 321, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 110: 322 }, { 6: 324, 7: 323, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 325, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: 327, 7: 326, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 328, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: 330, 7: 329, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 331, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: 333, 7: 332, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 334, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: -138, 38: -138, 42: -138, 43: -138, 82: 336, 97: -138, 115: 335, 118: 337, 135: -138 }, { 6: -141, 38: -141, 42: -141, 43: -141, 82: -141, 115: -141 }, { 6: -145, 38: -145, 42: -145, 43: -145, 57: 338, 82: -145, 115: -145 }, { 6: -148, 35: 155, 38: -148, 42: -148, 43: -148, 54: 159, 59: 104, 63: 158, 82: -148, 95: 156, 96: 160, 115: -148, 120: 339, 121: 157, 131: 99 }, { 6: -149, 38: -149, 42: -149, 43: -149, 57: -149, 82: -149, 115: -149, 134: -149, 178: -149, 180: -149 }, { 6: -150, 38: -150, 42: -150, 43: -150, 57: -150, 82: -150, 115: -150, 134: -150, 178: -150, 180: -150 }, { 6: -151, 38: -151, 42: -151, 43: -151, 57: -151, 82: -151, 115: -151, 134: -151, 178: -151, 180: -151 }, { 6: -152, 38: -152, 42: -152, 43: -152, 57: -152, 82: -152, 115: -152, 134: -152, 178: -152, 180: -152 }, { 55: 248, 65: 247 }, { 7: 340, 8: 239, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 236, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 58: 241, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 82: 237, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 97: 231, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 122: 240, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 157: 232, 158: 233, 162: 238, 163: 235, 164: 234, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -133, 6: -133, 36: -133, 38: -133, 42: -133, 43: -133, 56: -133, 58: -133, 69: -133, 70: -133, 75: -133, 82: -133, 93: -133, 97: -133, 106: -133, 107: -133, 108: -133, 109: -133, 110: -133, 111: -133, 112: -133, 115: -133, 125: -133, 132: -133, 134: -133, 135: -133, 136: -133, 153: -133, 154: -133, 161: -133, 172: -133, 174: -133, 175: -133, 178: -133, 179: -133, 180: -133, 192: -133, 193: -133, 198: -133, 199: -133, 202: -133, 203: -133, 204: -133, 205: -133, 206: -133, 207: -133, 208: -133, 209: -133, 210: -133, 211: -133, 212: -133, 213: -133, 214: -133 }, { 1: -135, 6: -135, 38: -135, 42: -135, 43: -135, 75: -135, 82: -135, 97: -135, 172: -135 }, { 4: 342, 5: 3, 7: 4, 8: 5, 9: 6, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 43: 341, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -381, 6: -381, 38: -381, 42: -381, 43: -381, 56: 108, 58: -381, 75: -381, 82: -381, 93: -381, 97: -381, 111: -381, 115: -381, 132: -381, 134: -381, 135: -381, 136: -381, 161: -381, 172: -381, 173: 126, 174: -381, 175: -381, 178: -381, 179: -381, 180: -381, 192: -381, 193: 125, 198: -381, 199: -381, 202: -381, 203: -381, 204: -381, 205: -381, 206: -381, 207: -381, 208: -381, 209: -381, 210: -381, 211: 120, 212: 121, 213: -381, 214: -381 }, { 1: -378, 6: -378, 38: -378, 42: -378, 43: -378, 75: -378, 82: -378, 97: -378, 172: -378 }, { 173: 130, 174: 96, 175: 97, 192: 128, 193: 129 }, { 1: -382, 6: -382, 38: -382, 42: -382, 43: -382, 56: 108, 58: -382, 75: -382, 82: -382, 93: -382, 97: -382, 111: -382, 115: -382, 132: -382, 134: -382, 135: -382, 136: -382, 161: -382, 172: -382, 173: 126, 174: -382, 175: -382, 178: -382, 179: -382, 180: -382, 192: -382, 193: 125, 198: -382, 199: -382, 202: -382, 203: -382, 204: -382, 205: -382, 206: -382, 207: -382, 208: -382, 209: -382, 210: -382, 211: 120, 212: 121, 213: -382, 214: -382 }, { 1: -379, 6: -379, 38: -379, 42: -379, 43: -379, 75: -379, 82: -379, 97: -379, 172: -379 }, { 1: -383, 6: -383, 38: -383, 42: -383, 43: -383, 56: 108, 58: -383, 75: -383, 82: -383, 93: -383, 97: -383, 111: -383, 115: -383, 132: -383, 134: -383, 135: -383, 136: -383, 161: -383, 172: -383, 173: 126, 174: -383, 175: -383, 178: -383, 179: -383, 180: -383, 192: -383, 193: 125, 198: -383, 199: -383, 202: -383, 203: 112, 204: -383, 205: -383, 206: -383, 207: -383, 208: -383, 209: -383, 210: -383, 211: 120, 212: 121, 213: -383, 214: -383 }, { 6: -140, 35: 155, 37: 343, 38: -140, 42: -140, 43: -140, 54: 159, 58: 154, 59: 104, 63: 158, 82: -140, 95: 156, 96: 160, 115: -140, 119: 152, 120: 153, 121: 157, 131: 99 }, { 39: 161, 42: 163 }, { 7: 164, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 167, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 15: 213, 47: 171, 114: 170, 116: 90, 117: 91 }, { 1: -384, 6: -384, 38: -384, 42: -384, 43: -384, 56: 108, 58: -384, 75: -384, 82: -384, 93: -384, 97: -384, 111: -384, 115: -384, 132: -384, 134: -384, 135: -384, 136: -384, 161: -384, 172: -384, 173: 126, 174: -384, 175: -384, 178: -384, 179: -384, 180: -384, 192: -384, 193: 125, 198: -384, 199: -384, 202: -384, 203: 112, 204: -384, 205: -384, 206: -384, 207: -384, 208: -384, 209: -384, 210: -384, 211: 120, 212: 121, 213: -384, 214: -384 }, { 1: -385, 6: -385, 38: -385, 42: -385, 43: -385, 56: 108, 58: -385, 75: -385, 82: -385, 93: -385, 97: -385, 111: -385, 115: -385, 132: -385, 134: -385, 135: -385, 136: -385, 161: -385, 172: -385, 173: 126, 174: -385, 175: -385, 178: -385, 179: -385, 180: -385, 192: -385, 193: 125, 198: -385, 199: -385, 202: -385, 203: 112, 204: -385, 205: -385, 206: -385, 207: -385, 208: -385, 209: -385, 210: -385, 211: 120, 212: 121, 213: -385, 214: -385 }, { 1: -386, 6: -386, 38: -386, 42: -386, 43: -386, 56: 108, 58: -386, 75: -386, 82: -386, 93: -386, 97: -386, 111: -386, 115: -386, 132: -386, 134: -386, 135: -386, 136: -386, 161: -386, 172: -386, 173: 126, 174: -386, 175: -386, 178: -386, 179: -386, 180: -386, 192: -386, 193: 125, 198: -386, 199: -386, 202: -386, 203: -386, 204: -386, 205: -386, 206: -386, 207: -386, 208: -386, 209: -386, 210: -386, 211: 120, 212: 121, 213: -386, 214: -386 }, { 63: 344, 131: 99 }, { 1: -388, 6: -388, 36: -183, 38: -388, 41: -183, 42: -388, 43: -388, 44: -183, 45: -183, 56: -388, 57: -183, 58: -388, 69: -183, 70: -183, 75: -388, 82: -388, 93: -388, 97: -388, 106: -183, 107: -183, 108: -183, 109: -183, 110: -183, 111: -388, 112: -183, 115: -388, 125: -183, 132: -388, 134: -388, 135: -388, 136: -388, 153: -183, 154: -183, 161: -388, 172: -388, 174: -388, 175: -388, 178: -388, 179: -388, 180: -388, 192: -388, 193: -388, 198: -388, 199: -388, 202: -388, 203: -388, 204: -388, 205: -388, 206: -388, 207: -388, 208: -388, 209: -388, 210: -388, 211: -388, 212: -388, 213: -388, 214: -388 }, { 36: -263, 69: -263, 70: -263, 103: 131, 106: 133, 107: 134, 108: 135, 109: 136, 110: 137, 112: 138, 125: 139, 153: 132, 154: 140 }, { 106: 141, 107: 142, 108: 143, 109: 144, 110: 145, 112: 146 }, { 1: -186, 6: -186, 36: -186, 38: -186, 42: -186, 43: -186, 56: -186, 58: -186, 69: -186, 70: -186, 75: -186, 82: -186, 93: -186, 97: -186, 106: -186, 107: -186, 108: -186, 109: -186, 110: -186, 111: -186, 112: -186, 115: -186, 125: -186, 132: -186, 134: -186, 135: -186, 136: -186, 153: -186, 154: -186, 161: -186, 172: -186, 174: -186, 175: -186, 178: -186, 179: -186, 180: -186, 192: -186, 193: -186, 198: -186, 199: -186, 202: -186, 203: -186, 204: -186, 205: -186, 206: -186, 207: -186, 208: -186, 209: -186, 210: -186, 211: -186, 212: -186, 213: -186, 214: -186 }, { 1: -389, 6: -389, 36: -183, 38: -389, 41: -183, 42: -389, 43: -389, 44: -183, 45: -183, 56: -389, 57: -183, 58: -389, 69: -183, 70: -183, 75: -389, 82: -389, 93: -389, 97: -389, 106: -183, 107: -183, 108: -183, 109: -183, 110: -183, 111: -389, 112: -183, 115: -389, 125: -183, 132: -389, 134: -389, 135: -389, 136: -389, 153: -183, 154: -183, 161: -389, 172: -389, 174: -389, 175: -389, 178: -389, 179: -389, 180: -389, 192: -389, 193: -389, 198: -389, 199: -389, 202: -389, 203: -389, 204: -389, 205: -389, 206: -389, 207: -389, 208: -389, 209: -389, 210: -389, 211: -389, 212: -389, 213: -389, 214: -389 }, { 1: -390, 6: -390, 38: -390, 42: -390, 43: -390, 56: -390, 58: -390, 75: -390, 82: -390, 93: -390, 97: -390, 111: -390, 115: -390, 132: -390, 134: -390, 135: -390, 136: -390, 161: -390, 172: -390, 174: -390, 175: -390, 178: -390, 179: -390, 180: -390, 192: -390, 193: -390, 198: -390, 199: -390, 202: -390, 203: -390, 204: -390, 205: -390, 206: -390, 207: -390, 208: -390, 209: -390, 210: -390, 211: -390, 212: -390, 213: -390, 214: -390 }, { 1: -391, 6: -391, 38: -391, 42: -391, 43: -391, 56: -391, 58: -391, 75: -391, 82: -391, 93: -391, 97: -391, 111: -391, 115: -391, 132: -391, 134: -391, 135: -391, 136: -391, 161: -391, 172: -391, 174: -391, 175: -391, 178: -391, 179: -391, 180: -391, 192: -391, 193: -391, 198: -391, 199: -391, 202: -391, 203: -391, 204: -391, 205: -391, 206: -391, 207: -391, 208: -391, 209: -391, 210: -391, 211: -391, 212: -391, 213: -391, 214: -391 }, { 6: 347, 7: 345, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 346, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 39: 348, 42: 163 }, { 1: -45, 6: -45, 38: -45, 42: -45, 43: -45, 56: -45, 58: -45, 75: -45, 82: -45, 93: -45, 97: -45, 111: -45, 115: -45, 132: -45, 134: -45, 135: -45, 136: -45, 161: -45, 172: -45, 174: -45, 175: -45, 178: -45, 179: -45, 180: -45, 192: -45, 193: -45, 198: -45, 199: -45, 202: -45, 203: -45, 204: -45, 205: -45, 206: -45, 207: -45, 208: -45, 209: -45, 210: -45, 211: -45, 212: -45, 213: -45, 214: -45 }, { 1: -46, 6: -46, 38: -46, 42: -46, 43: -46, 56: -46, 58: -46, 75: -46, 82: -46, 93: -46, 97: -46, 111: -46, 115: -46, 132: -46, 134: -46, 135: -46, 136: -46, 161: -46, 172: -46, 174: -46, 175: -46, 178: -46, 179: -46, 180: -46, 192: -46, 193: -46, 198: -46, 199: -46, 202: -46, 203: -46, 204: -46, 205: -46, 206: -46, 207: -46, 208: -46, 209: -46, 210: -46, 211: -46, 212: -46, 213: -46, 214: -46 }, { 1: -47, 6: -47, 38: -47, 42: -47, 43: -47, 56: -47, 58: -47, 75: -47, 82: -47, 93: -47, 97: -47, 111: -47, 115: -47, 132: -47, 134: -47, 135: -47, 136: -47, 161: -47, 172: -47, 174: -47, 175: -47, 178: -47, 179: -47, 180: -47, 192: -47, 193: -47, 198: -47, 199: -47, 202: -47, 203: -47, 204: -47, 205: -47, 206: -47, 207: -47, 208: -47, 209: -47, 210: -47, 211: -47, 212: -47, 213: -47, 214: -47 }, { 42: 349 }, { 39: 350, 42: 163, 189: 351 }, { 1: -304, 6: -304, 38: -304, 42: -304, 43: -304, 56: -304, 58: -304, 75: -304, 82: -304, 93: -304, 97: -304, 111: -304, 115: -304, 132: -304, 134: -304, 135: -304, 136: -304, 161: -304, 167: 352, 168: 353, 169: 354, 172: -304, 174: -304, 175: -304, 178: -304, 179: -304, 180: -304, 192: -304, 193: -304, 198: -304, 199: -304, 202: -304, 203: -304, 204: -304, 205: -304, 206: -304, 207: -304, 208: -304, 209: -304, 210: -304, 211: -304, 212: -304, 213: -304, 214: -304 }, { 1: -319, 6: -319, 38: -319, 42: -319, 43: -319, 56: -319, 58: -319, 75: -319, 82: -319, 93: -319, 97: -319, 111: -319, 115: -319, 132: -319, 134: -319, 135: -319, 136: -319, 161: -319, 172: -319, 174: -319, 175: -319, 178: -319, 179: -319, 180: -319, 192: -319, 193: -319, 198: -319, 199: -319, 202: -319, 203: -319, 204: -319, 205: -319, 206: -319, 207: -319, 208: -319, 209: -319, 210: -319, 211: -319, 212: -319, 213: -319, 214: -319 }, { 134: 356, 178: 355, 180: 357 }, { 35: 155, 54: 159, 59: 104, 63: 158, 95: 156, 96: 160, 120: 200, 121: 157, 131: 99, 133: 358, 182: 199 }, { 35: 155, 54: 159, 59: 104, 63: 158, 95: 156, 96: 160, 120: 200, 121: 157, 131: 99, 133: 359, 182: 199 }, { 39: 360, 42: 163, 179: 361 }, { 82: 362, 134: -357, 178: -357, 180: -357 }, { 57: 363, 82: -355, 134: -355, 178: -355, 180: -355 }, { 42: 364, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 184: 365, 186: 366, 187: 367 }, { 1: -211, 6: -211, 38: -211, 42: -211, 43: -211, 56: -211, 58: -211, 75: -211, 82: -211, 93: -211, 97: -211, 111: -211, 115: -211, 132: -211, 134: -211, 135: -211, 136: -211, 161: -211, 172: -211, 174: -211, 175: -211, 178: -211, 179: -211, 180: -211, 192: -211, 193: -211, 198: -211, 199: -211, 202: -211, 203: -211, 204: -211, 205: -211, 206: -211, 207: -211, 208: -211, 209: -211, 210: -211, 211: -211, 212: -211, 213: -211, 214: -211 }, { 7: 368, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -214, 6: -214, 36: -183, 38: -214, 39: 369, 41: -183, 42: 163, 43: -214, 44: -183, 45: -183, 56: -214, 57: -183, 58: -214, 69: -183, 70: -183, 75: -214, 82: -214, 93: -214, 97: -214, 106: -183, 107: -183, 108: -183, 109: -183, 110: -183, 111: -214, 112: -183, 115: -214, 125: -183, 132: -214, 134: -214, 135: -214, 136: -214, 140: 370, 153: -183, 154: -183, 161: -214, 172: -214, 174: -214, 175: -214, 178: -214, 179: -214, 180: -214, 192: -214, 193: -214, 198: -214, 199: -214, 202: -214, 203: -214, 204: -214, 205: -214, 206: -214, 207: -214, 208: -214, 209: -214, 210: -214, 211: -214, 212: -214, 213: -214, 214: -214 }, { 1: -311, 6: -311, 38: -311, 42: -311, 43: -311, 56: 108, 58: -311, 75: -311, 82: -311, 93: -311, 97: -311, 111: -311, 115: -311, 132: -311, 134: -311, 135: -311, 136: -311, 161: -311, 172: -311, 173: 126, 174: -311, 175: -311, 178: -311, 179: -311, 180: -311, 192: -311, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 63: 371, 131: 99 }, { 1: -63, 6: -63, 38: -63, 42: -63, 43: -63, 56: 108, 58: -63, 75: -63, 82: -63, 93: -63, 97: -63, 111: -63, 115: -63, 132: -63, 134: -63, 135: -63, 136: -63, 161: -63, 172: -63, 173: 126, 174: -63, 175: -63, 178: -63, 179: -63, 180: -63, 192: -63, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 63: 372, 131: 99 }, { 7: 373, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 36: 374, 39: 375, 42: 163 }, { 1: -380, 6: -380, 38: -380, 42: -380, 43: -380, 75: -380, 82: -380, 97: -380, 172: -380 }, { 1: -411, 6: -411, 36: -411, 38: -411, 42: -411, 43: -411, 56: -411, 58: -411, 69: -411, 70: -411, 75: -411, 82: -411, 93: -411, 97: -411, 106: -411, 107: -411, 108: -411, 109: -411, 110: -411, 111: -411, 112: -411, 115: -411, 125: -411, 132: -411, 134: -411, 135: -411, 136: -411, 153: -411, 154: -411, 161: -411, 172: -411, 174: -411, 175: -411, 178: -411, 179: -411, 180: -411, 192: -411, 193: -411, 198: -411, 199: -411, 202: -411, 203: -411, 204: -411, 205: -411, 206: -411, 207: -411, 208: -411, 209: -411, 210: -411, 211: -411, 212: -411, 213: -411, 214: -411 }, { 1: -129, 6: -129, 38: -129, 42: -129, 43: -129, 56: 108, 75: -129, 82: -129, 97: -129, 132: 127, 172: -129, 173: 126, 174: -129, 175: -129, 192: -129, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 63: 376, 131: 99 }, { 1: -218, 6: -218, 38: -218, 42: -218, 43: -218, 75: -218, 82: -218, 97: -218, 172: -218, 174: -218, 175: -218, 192: -218, 193: -218 }, { 64: 377, 82: 378 }, { 64: 379 }, { 35: 384, 42: 383, 59: 104, 135: 380, 144: 381, 145: 382, 147: 385 }, { 64: -234, 82: -234 }, { 146: 386 }, { 35: 391, 42: 390, 59: 104, 135: 387, 147: 392, 150: 388, 152: 389 }, { 1: -238, 6: -238, 38: -238, 42: -238, 43: -238, 75: -238, 82: -238, 97: -238, 172: -238, 174: -238, 175: -238, 192: -238, 193: -238 }, { 1: -239, 6: -239, 38: -239, 42: -239, 43: -239, 75: -239, 82: -239, 97: -239, 172: -239, 174: -239, 175: -239, 192: -239, 193: -239 }, { 57: 393 }, { 7: 394, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 395, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 64: 396 }, { 6: 107, 172: 397 }, { 4: 398, 5: 3, 7: 4, 8: 5, 9: 6, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: -285, 38: -285, 42: -285, 43: -285, 56: 108, 58: 313, 82: -285, 97: -285, 132: 127, 160: 399, 161: 312, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -270, 6: -270, 36: -270, 38: -270, 41: -270, 42: -270, 43: -270, 44: -270, 45: -270, 56: -270, 57: -270, 58: -270, 69: -270, 70: -270, 75: -270, 82: -270, 93: -270, 97: -270, 106: -270, 107: -270, 108: -270, 109: -270, 110: -270, 111: -270, 112: -270, 115: -270, 125: -270, 132: -270, 134: -270, 135: -270, 136: -270, 153: -270, 154: -270, 161: -270, 172: -270, 174: -270, 175: -270, 178: -270, 179: -270, 180: -270, 192: -270, 193: -270, 198: -270, 199: -270, 202: -270, 203: -270, 204: -270, 205: -270, 206: -270, 207: -270, 208: -270, 209: -270, 210: -270, 211: -270, 212: -270, 213: -270, 214: -270 }, { 7: 340, 8: 239, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 58: 241, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 82: 237, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 97: 400, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 122: 240, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 162: 402, 164: 401, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: -138, 38: -138, 42: -138, 43: -138, 82: 404, 97: -138, 118: 405, 135: -138, 159: 403 }, { 6: 406, 11: -298, 34: -298, 42: -298, 43: -298, 46: -298, 48: -298, 49: -298, 50: -298, 54: -298, 58: -298, 59: -298, 62: -298, 67: -298, 69: -298, 70: -298, 77: -298, 78: -298, 82: -298, 84: -298, 85: -298, 86: -298, 87: -298, 88: -298, 89: -298, 96: -298, 97: -298, 102: -298, 105: -298, 113: -298, 114: -298, 116: -298, 117: -298, 129: -298, 130: -298, 131: -298, 132: -298, 139: -298, 141: -298, 149: -298, 156: -298, 166: -298, 170: -298, 171: -298, 174: -298, 175: -298, 177: -298, 181: -298, 183: -298, 189: -298, 191: -298, 194: -298, 195: -298, 196: -298, 197: -298, 198: -298, 199: -298, 200: -298, 201: -298 }, { 6: -289, 42: -289, 43: -289, 82: -289, 97: -289 }, { 7: 340, 8: 239, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 236, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 58: 241, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 82: 237, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 122: 240, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 157: 408, 158: 407, 162: 238, 163: 235, 164: 234, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: -300, 11: -300, 34: -300, 42: -300, 43: -300, 46: -300, 48: -300, 49: -300, 50: -300, 54: -300, 58: -300, 59: -300, 62: -300, 67: -300, 69: -300, 70: -300, 77: -300, 78: -300, 82: -300, 84: -300, 85: -300, 86: -300, 87: -300, 88: -300, 89: -300, 96: -300, 97: -300, 102: -300, 105: -300, 113: -300, 114: -300, 116: -300, 117: -300, 129: -300, 130: -300, 131: -300, 132: -300, 139: -300, 141: -300, 149: -300, 156: -300, 166: -300, 170: -300, 171: -300, 174: -300, 175: -300, 177: -300, 181: -300, 183: -300, 189: -300, 191: -300, 194: -300, 195: -300, 196: -300, 197: -300, 198: -300, 199: -300, 200: -300, 201: -300 }, { 6: -294, 42: -294, 43: -294, 82: -294, 97: -294 }, { 6: -286, 38: -286, 42: -286, 43: -286, 82: -286, 97: -286 }, { 6: -287, 38: -287, 42: -287, 43: -287, 82: -287, 97: -287 }, { 6: -288, 7: 409, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 38: -288, 40: 33, 42: -288, 43: -288, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 82: -288, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 97: -288, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -261, 6: -261, 36: -261, 38: -261, 42: -261, 43: -261, 56: -261, 58: -261, 69: -261, 70: -261, 75: -261, 80: -261, 82: -261, 93: -261, 97: -261, 106: -261, 107: -261, 108: -261, 109: -261, 110: -261, 111: -261, 112: -261, 115: -261, 125: -261, 132: -261, 134: -261, 135: -261, 136: -261, 153: -261, 154: -261, 161: -261, 172: -261, 174: -261, 175: -261, 178: -261, 179: -261, 180: -261, 192: -261, 193: -261, 198: -261, 199: -261, 202: -261, 203: -261, 204: -261, 205: -261, 206: -261, 207: -261, 208: -261, 209: -261, 210: -261, 211: -261, 212: -261, 213: -261, 214: -261 }, { 55: 248, 65: 410 }, { 7: 411, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 412, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 340, 8: 239, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 38: 413, 40: 33, 42: 416, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 58: 241, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 122: 240, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 155: 414, 156: 86, 162: 415, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -262, 6: -262, 36: -262, 38: -262, 42: -262, 43: -262, 56: -262, 58: -262, 69: -262, 70: -262, 75: -262, 80: -262, 82: -262, 93: -262, 97: -262, 106: -262, 107: -262, 108: -262, 109: -262, 110: -262, 111: -262, 112: -262, 115: -262, 125: -262, 132: -262, 134: -262, 135: -262, 136: -262, 153: -262, 154: -262, 161: -262, 172: -262, 174: -262, 175: -262, 178: -262, 179: -262, 180: -262, 192: -262, 193: -262, 198: -262, 199: -262, 202: -262, 203: -262, 204: -262, 205: -262, 206: -262, 207: -262, 208: -262, 209: -262, 210: -262, 211: -262, 212: -262, 213: -262, 214: -262 }, { 1: -269, 6: -269, 36: -269, 38: -269, 41: -269, 42: -269, 43: -269, 44: -269, 45: -269, 56: -269, 57: -269, 58: -269, 69: -269, 70: -269, 75: -269, 82: -269, 93: -269, 97: -269, 106: -269, 107: -269, 108: -269, 109: -269, 110: -269, 111: -269, 112: -269, 115: -269, 125: -269, 132: -269, 134: -269, 135: -269, 136: -269, 140: -269, 153: -269, 154: -269, 161: -269, 172: -269, 174: -269, 175: -269, 178: -269, 179: -269, 180: -269, 192: -269, 193: -269, 198: -269, 199: -269, 200: -269, 201: -269, 202: -269, 203: -269, 204: -269, 205: -269, 206: -269, 207: -269, 208: -269, 209: -269, 210: -269, 211: -269, 212: -269, 213: -269, 214: -269, 215: -269 }, { 1: -69, 6: -69, 36: -69, 38: -69, 41: -69, 42: -69, 43: -69, 44: -69, 45: -69, 56: -69, 57: -69, 58: -69, 69: -69, 70: -69, 75: -69, 82: -69, 93: -69, 97: -69, 106: -69, 107: -69, 108: -69, 109: -69, 110: -69, 111: -69, 112: -69, 115: -69, 125: -69, 132: -69, 134: -69, 135: -69, 136: -69, 140: -69, 153: -69, 154: -69, 161: -69, 172: -69, 174: -69, 175: -69, 178: -69, 179: -69, 180: -69, 192: -69, 193: -69, 198: -69, 199: -69, 200: -69, 201: -69, 202: -69, 203: -69, 204: -69, 205: -69, 206: -69, 207: -69, 208: -69, 209: -69, 210: -69, 211: -69, 212: -69, 213: -69, 214: -69, 215: -69 }, { 55: 248, 65: 417 }, { 55: 248, 65: 418 }, { 39: 419, 42: 163, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 39: 420, 42: 163, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -315, 6: -315, 38: -315, 42: -315, 43: -315, 56: 108, 58: -315, 75: -315, 82: -315, 93: -315, 97: -315, 111: -315, 115: -315, 132: 127, 134: -315, 135: -315, 136: 421, 161: -315, 172: -315, 173: 126, 174: 96, 175: 97, 178: -315, 179: -315, 180: -315, 192: -315, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -317, 6: -317, 38: -317, 42: -317, 43: -317, 56: 108, 58: -317, 75: -317, 82: -317, 93: -317, 97: -317, 111: -317, 115: -317, 132: 127, 134: -317, 135: -317, 136: 422, 161: -317, 172: -317, 173: 126, 174: 96, 175: 97, 178: -317, 179: -317, 180: -317, 192: -317, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -323, 6: -323, 38: -323, 42: -323, 43: -323, 56: -323, 58: -323, 75: -323, 82: -323, 93: -323, 97: -323, 111: -323, 115: -323, 132: -323, 134: -323, 135: -323, 136: -323, 161: -323, 172: -323, 174: -323, 175: -323, 178: -323, 179: -323, 180: -323, 192: -323, 193: -323, 198: -323, 199: -323, 202: -323, 203: -323, 204: -323, 205: -323, 206: -323, 207: -323, 208: -323, 209: -323, 210: -323, 211: -323, 212: -323, 213: -323, 214: -323 }, { 1: -324, 6: -324, 38: -324, 42: -324, 43: -324, 56: 108, 58: -324, 75: -324, 82: -324, 93: -324, 97: -324, 111: -324, 115: -324, 132: 127, 134: -324, 135: -324, 136: -324, 161: -324, 172: -324, 173: 126, 174: 96, 175: 97, 178: -324, 179: -324, 180: -324, 192: -324, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 6: -95, 42: -95, 43: -95, 82: -95, 93: 423, 135: -95 }, { 6: -138, 38: -138, 42: -138, 43: -138, 82: 425, 97: -138, 118: 424, 135: -138 }, { 6: -104, 42: -104, 43: -104, 57: 426, 82: -104, 93: -104, 135: -104 }, { 7: 427, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 55: 248, 65: 247, 96: 428 }, { 6: -107, 42: -107, 43: -107, 82: -107, 93: -107, 135: -107 }, { 6: -206, 42: -206, 43: -206, 82: -206, 135: -206 }, { 6: -101, 36: -101, 42: -101, 43: -101, 57: -101, 82: -101, 93: -101, 106: -101, 107: -101, 108: -101, 109: -101, 110: -101, 112: -101, 135: -101, 154: -101 }, { 6: -102, 36: -102, 42: -102, 43: -102, 57: -102, 82: -102, 93: -102, 106: -102, 107: -102, 108: -102, 109: -102, 110: -102, 112: -102, 135: -102, 154: -102 }, { 6: -103, 36: -103, 42: -103, 43: -103, 57: -103, 82: -103, 93: -103, 106: -103, 107: -103, 108: -103, 109: -103, 110: -103, 112: -103, 135: -103, 154: -103 }, { 6: -96, 42: -96, 43: -96, 82: -96, 135: -96 }, { 35: 264, 54: 87, 55: 248, 59: 104, 63: 431, 65: 265, 94: 429, 95: 266, 98: 430, 99: 432, 100: 433, 101: 434, 102: 435, 105: 436, 131: 99, 156: 86, 171: 82 }, { 1: -190, 6: -190, 36: -190, 38: -190, 42: -190, 43: -190, 56: -190, 58: -190, 69: -190, 70: -190, 75: -190, 80: 437, 82: -190, 93: -190, 97: -190, 106: -190, 107: -190, 108: -190, 109: -190, 110: -190, 111: -190, 112: -190, 115: -190, 125: -190, 132: -190, 134: -190, 135: -190, 136: -190, 153: -190, 154: -190, 161: -190, 172: -190, 174: -190, 175: -190, 178: -190, 179: -190, 180: -190, 192: -190, 193: -190, 198: -190, 199: -190, 202: -190, 203: -190, 204: -190, 205: -190, 206: -190, 207: -190, 208: -190, 209: -190, 210: -190, 211: -190, 212: -190, 213: -190, 214: -190 }, { 1: -183, 6: -183, 36: -183, 38: -183, 41: -183, 42: -183, 43: -183, 44: -183, 45: -183, 56: -183, 57: -183, 58: -183, 69: -183, 70: -183, 75: -183, 82: -183, 93: -183, 97: -183, 106: -183, 107: -183, 108: -183, 109: -183, 110: -183, 111: -183, 112: -183, 115: -183, 125: -183, 132: -183, 134: -183, 135: -183, 136: -183, 153: -183, 154: -183, 161: -183, 172: -183, 174: -183, 175: -183, 178: -183, 179: -183, 180: -183, 192: -183, 193: -183, 198: -183, 199: -183, 202: -183, 203: -183, 204: -183, 205: -183, 206: -183, 207: -183, 208: -183, 209: -183, 210: -183, 211: -183, 212: -183, 213: -183, 214: -183 }, { 68: 274, 69: 105, 70: 106, 72: 438, 73: 439, 74: 273 }, { 69: -74, 70: -74, 72: -74, 74: -74 }, { 4: 440, 5: 3, 7: 4, 8: 5, 9: 6, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 441, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 75: 442, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 69: -79, 70: -79, 72: -79, 74: -79 }, { 1: -4, 6: -4, 43: -4, 75: -4, 172: -4 }, { 1: -393, 6: -393, 38: -393, 42: -393, 43: -393, 56: 108, 58: -393, 75: -393, 82: -393, 93: -393, 97: -393, 111: -393, 115: -393, 132: -393, 134: -393, 135: -393, 136: -393, 161: -393, 172: -393, 173: 126, 174: -393, 175: -393, 178: -393, 179: -393, 180: -393, 192: -393, 193: 125, 198: -393, 199: -393, 202: 111, 203: 112, 204: -393, 205: -393, 206: -393, 207: -393, 208: -393, 209: -393, 210: -393, 211: 120, 212: 121, 213: -393, 214: -393 }, { 1: -394, 6: -394, 38: -394, 42: -394, 43: -394, 56: 108, 58: -394, 75: -394, 82: -394, 93: -394, 97: -394, 111: -394, 115: -394, 132: -394, 134: -394, 135: -394, 136: -394, 161: -394, 172: -394, 173: 126, 174: -394, 175: -394, 178: -394, 179: -394, 180: -394, 192: -394, 193: 125, 198: -394, 199: -394, 202: 111, 203: 112, 204: -394, 205: -394, 206: -394, 207: -394, 208: -394, 209: -394, 210: -394, 211: 120, 212: 121, 213: -394, 214: -394 }, { 1: -395, 6: -395, 38: -395, 42: -395, 43: -395, 56: 108, 58: -395, 75: -395, 82: -395, 93: -395, 97: -395, 111: -395, 115: -395, 132: -395, 134: -395, 135: -395, 136: -395, 161: -395, 172: -395, 173: 126, 174: -395, 175: -395, 178: -395, 179: -395, 180: -395, 192: -395, 193: 125, 198: -395, 199: -395, 202: -395, 203: 112, 204: -395, 205: -395, 206: -395, 207: -395, 208: -395, 209: -395, 210: -395, 211: 120, 212: 121, 213: -395, 214: -395 }, { 1: -396, 6: -396, 38: -396, 42: -396, 43: -396, 56: 108, 58: -396, 75: -396, 82: -396, 93: -396, 97: -396, 111: -396, 115: -396, 132: -396, 134: -396, 135: -396, 136: -396, 161: -396, 172: -396, 173: 126, 174: -396, 175: -396, 178: -396, 179: -396, 180: -396, 192: -396, 193: 125, 198: -396, 199: -396, 202: -396, 203: 112, 204: -396, 205: -396, 206: -396, 207: -396, 208: -396, 209: -396, 210: -396, 211: 120, 212: 121, 213: -396, 214: -396 }, { 1: -397, 6: -397, 38: -397, 42: -397, 43: -397, 56: 108, 58: -397, 75: -397, 82: -397, 93: -397, 97: -397, 111: -397, 115: -397, 132: -397, 134: -397, 135: -397, 136: -397, 161: -397, 172: -397, 173: 126, 174: -397, 175: -397, 178: -397, 179: -397, 180: -397, 192: -397, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: -397, 205: -397, 206: -397, 207: -397, 208: -397, 209: -397, 210: -397, 211: 120, 212: 121, 213: -397, 214: -397 }, { 1: -398, 6: -398, 38: -398, 42: -398, 43: -398, 56: 108, 58: -398, 75: -398, 82: -398, 93: -398, 97: -398, 111: -398, 115: -398, 132: -398, 134: -398, 135: -398, 136: -398, 161: -398, 172: -398, 173: 126, 174: -398, 175: -398, 178: -398, 179: -398, 180: -398, 192: -398, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: -398, 206: -398, 207: -398, 208: -398, 209: -398, 210: -398, 211: 120, 212: 121, 213: 122, 214: -398 }, { 1: -399, 6: -399, 38: -399, 42: -399, 43: -399, 56: 108, 58: -399, 75: -399, 82: -399, 93: -399, 97: -399, 111: -399, 115: -399, 132: -399, 134: -399, 135: -399, 136: -399, 161: -399, 172: -399, 173: 126, 174: -399, 175: -399, 178: -399, 179: -399, 180: -399, 192: -399, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: -399, 207: -399, 208: -399, 209: -399, 210: -399, 211: 120, 212: 121, 213: 122, 214: -399 }, { 1: -400, 6: -400, 38: -400, 42: -400, 43: -400, 56: 108, 58: -400, 75: -400, 82: -400, 93: -400, 97: -400, 111: -400, 115: -400, 132: -400, 134: -400, 135: -400, 136: -400, 161: -400, 172: -400, 173: 126, 174: -400, 175: -400, 178: -400, 179: -400, 180: -400, 192: -400, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: -400, 208: -400, 209: -400, 210: -400, 211: 120, 212: 121, 213: 122, 214: -400 }, { 1: -401, 6: -401, 38: -401, 42: -401, 43: -401, 56: 108, 58: -401, 75: -401, 82: -401, 93: -401, 97: -401, 111: -401, 115: -401, 132: -401, 134: -401, 135: -401, 136: -401, 161: -401, 172: -401, 173: 126, 174: -401, 175: -401, 178: -401, 179: -401, 180: -401, 192: -401, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: -401, 209: -401, 210: -401, 211: 120, 212: 121, 213: 122, 214: -401 }, { 1: -402, 6: -402, 38: -402, 42: -402, 43: -402, 56: 108, 58: -402, 75: -402, 82: -402, 93: -402, 97: -402, 111: -402, 115: -402, 132: -402, 134: -402, 135: -402, 136: -402, 161: -402, 172: -402, 173: 126, 174: -402, 175: -402, 178: -402, 179: -402, 180: -402, 192: -402, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: -402, 210: -402, 211: 120, 212: 121, 213: 122, 214: -402 }, { 1: -403, 6: -403, 38: -403, 42: -403, 43: -403, 56: 108, 58: -403, 75: -403, 82: -403, 93: -403, 97: -403, 111: -403, 115: -403, 132: -403, 134: -403, 135: -403, 136: -403, 161: -403, 172: -403, 173: 126, 174: -403, 175: -403, 178: -403, 179: -403, 180: -403, 192: -403, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: -403, 211: 120, 212: 121, 213: 122, 214: -403 }, { 1: -404, 6: -404, 38: -404, 42: -404, 43: -404, 56: 108, 58: -404, 75: -404, 82: -404, 93: -404, 97: -404, 111: -404, 115: -404, 132: 127, 134: -404, 135: -404, 136: -404, 161: -404, 172: -404, 173: 126, 174: 96, 175: 97, 178: -404, 179: -404, 180: -404, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -405, 6: -405, 38: -405, 42: -405, 43: -405, 56: 108, 58: -405, 75: -405, 82: -405, 93: -405, 97: -405, 111: -405, 115: -405, 132: 127, 134: -405, 135: -405, 136: -405, 161: -405, 172: -405, 173: 126, 174: 96, 175: 97, 178: -405, 179: -405, 180: -405, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -406, 6: -406, 38: -406, 42: -406, 43: -406, 56: 108, 58: -406, 75: -406, 82: -406, 93: -406, 97: -406, 111: -406, 115: -406, 132: -406, 134: -406, 135: -406, 136: -406, 161: -406, 172: -406, 173: 126, 174: -406, 175: -406, 178: -406, 179: -406, 180: -406, 192: -406, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: -406, 206: -406, 207: -406, 208: -406, 209: -406, 210: -406, 211: 120, 212: 121, 213: -406, 214: -406 }, { 56: 108, 93: 443, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -375, 6: -375, 38: -375, 42: -375, 43: -375, 56: 108, 58: -375, 75: -375, 82: -375, 93: -375, 97: -375, 111: -375, 115: -375, 132: 127, 134: -375, 135: -375, 136: -375, 161: -375, 172: -375, 173: 126, 174: 96, 175: 97, 178: -375, 179: -375, 180: -375, 192: -375, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -377, 6: -377, 38: -377, 42: -377, 43: -377, 56: 108, 58: -377, 75: -377, 82: -377, 93: -377, 97: -377, 111: -377, 115: -377, 132: 127, 134: -377, 135: -377, 136: -377, 161: -377, 172: -377, 173: 126, 174: 96, 175: 97, 178: -377, 179: -377, 180: -377, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 134: 445, 178: 444, 180: 446 }, { 35: 155, 54: 159, 59: 104, 63: 158, 95: 156, 96: 160, 120: 200, 121: 157, 131: 99, 133: 447, 182: 199 }, { 35: 155, 54: 159, 59: 104, 63: 158, 95: 156, 96: 160, 120: 200, 121: 157, 131: 99, 133: 448, 182: 199 }, { 1: -353, 6: -353, 38: -353, 42: -353, 43: -353, 56: -353, 58: -353, 75: -353, 82: -353, 93: -353, 97: -353, 111: -353, 115: -353, 132: -353, 134: -353, 135: -353, 136: -353, 161: -353, 172: -353, 174: -353, 175: -353, 178: -353, 179: 449, 180: -353, 192: -353, 193: -353, 198: -353, 199: -353, 202: -353, 203: -353, 204: -353, 205: -353, 206: -353, 207: -353, 208: -353, 209: -353, 210: -353, 211: -353, 212: -353, 213: -353, 214: -353 }, { 1: -374, 6: -374, 38: -374, 42: -374, 43: -374, 56: 108, 58: -374, 75: -374, 82: -374, 93: -374, 97: -374, 111: -374, 115: -374, 132: 127, 134: -374, 135: -374, 136: -374, 161: -374, 172: -374, 173: 126, 174: 96, 175: 97, 178: -374, 179: -374, 180: -374, 192: -374, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -376, 6: -376, 38: -376, 42: -376, 43: -376, 56: 108, 58: -376, 75: -376, 82: -376, 93: -376, 97: -376, 111: -376, 115: -376, 132: 127, 134: -376, 135: -376, 136: -376, 161: -376, 172: -376, 173: 126, 174: 96, 175: 97, 178: -376, 179: -376, 180: -376, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -258, 6: -258, 36: -258, 38: -258, 42: -258, 43: -258, 56: -258, 58: -258, 69: -258, 70: -258, 75: -258, 80: -258, 82: -258, 93: -258, 97: -258, 106: -258, 107: -258, 108: -258, 109: -258, 110: -258, 111: -258, 112: -258, 115: -258, 125: -258, 132: -258, 134: -258, 135: -258, 136: -258, 153: -258, 154: -258, 161: -258, 172: -258, 174: -258, 175: -258, 178: -258, 179: -258, 180: -258, 192: -258, 193: -258, 198: -258, 199: -258, 202: -258, 203: -258, 204: -258, 205: -258, 206: -258, 207: -258, 208: -258, 209: -258, 210: -258, 211: -258, 212: -258, 213: -258, 214: -258 }, { 1: -259, 6: -259, 36: -259, 38: -259, 42: -259, 43: -259, 56: -259, 58: -259, 69: -259, 70: -259, 75: -259, 80: -259, 82: -259, 93: -259, 97: -259, 106: -259, 107: -259, 108: -259, 109: -259, 110: -259, 111: -259, 112: -259, 115: -259, 125: -259, 132: -259, 134: -259, 135: -259, 136: -259, 153: -259, 154: -259, 161: -259, 172: -259, 174: -259, 175: -259, 178: -259, 179: -259, 180: -259, 192: -259, 193: -259, 198: -259, 199: -259, 202: -259, 203: -259, 204: -259, 205: -259, 206: -259, 207: -259, 208: -259, 209: -259, 210: -259, 211: -259, 212: -259, 213: -259, 214: -259 }, { 1: -260, 6: -260, 36: -260, 38: -260, 42: -260, 43: -260, 56: -260, 58: -260, 69: -260, 70: -260, 75: -260, 80: -260, 82: -260, 93: -260, 97: -260, 106: -260, 107: -260, 108: -260, 109: -260, 110: -260, 111: -260, 112: -260, 115: -260, 125: -260, 132: -260, 134: -260, 135: -260, 136: -260, 153: -260, 154: -260, 161: -260, 172: -260, 174: -260, 175: -260, 178: -260, 179: -260, 180: -260, 192: -260, 193: -260, 198: -260, 199: -260, 202: -260, 203: -260, 204: -260, 205: -260, 206: -260, 207: -260, 208: -260, 209: -260, 210: -260, 211: -260, 212: -260, 213: -260, 214: -260 }, { 1: -156, 6: -156, 36: -156, 38: -156, 41: -156, 42: -156, 43: -156, 44: -156, 45: -156, 56: -156, 57: -156, 58: -156, 69: -156, 70: -156, 75: -156, 82: -156, 93: -156, 97: -156, 106: -156, 107: -156, 108: -156, 109: -156, 110: -156, 111: -156, 112: -156, 115: -156, 125: -156, 132: -156, 134: -156, 135: -156, 136: -156, 140: -156, 153: -156, 154: -156, 161: -156, 172: -156, 174: -156, 175: -156, 178: -156, 179: -156, 180: -156, 192: -156, 193: -156, 198: -156, 199: -156, 200: -156, 201: -156, 202: -156, 203: -156, 204: -156, 205: -156, 206: -156, 207: -156, 208: -156, 209: -156, 210: -156, 211: -156, 212: -156, 213: -156, 214: -156, 215: -156 }, { 1: -157, 6: -157, 36: -157, 38: -157, 41: -157, 42: -157, 43: -157, 44: -157, 45: -157, 56: -157, 57: -157, 58: -157, 69: -157, 70: -157, 75: -157, 82: -157, 93: -157, 97: -157, 106: -157, 107: -157, 108: -157, 109: -157, 110: -157, 111: -157, 112: -157, 115: -157, 125: -157, 132: -157, 134: -157, 135: -157, 136: -157, 140: -157, 153: -157, 154: -157, 161: -157, 172: -157, 174: -157, 175: -157, 178: -157, 179: -157, 180: -157, 192: -157, 193: -157, 198: -157, 199: -157, 200: -157, 201: -157, 202: -157, 203: -157, 204: -157, 205: -157, 206: -157, 207: -157, 208: -157, 209: -157, 210: -157, 211: -157, 212: -157, 213: -157, 214: -157, 215: -157 }, { 1: -158, 6: -158, 36: -158, 38: -158, 41: -158, 42: -158, 43: -158, 44: -158, 45: -158, 56: -158, 57: -158, 58: -158, 69: -158, 70: -158, 75: -158, 82: -158, 93: -158, 97: -158, 106: -158, 107: -158, 108: -158, 109: -158, 110: -158, 111: -158, 112: -158, 115: -158, 125: -158, 132: -158, 134: -158, 135: -158, 136: -158, 140: -158, 153: -158, 154: -158, 161: -158, 172: -158, 174: -158, 175: -158, 178: -158, 179: -158, 180: -158, 192: -158, 193: -158, 198: -158, 199: -158, 200: -158, 201: -158, 202: -158, 203: -158, 204: -158, 205: -158, 206: -158, 207: -158, 208: -158, 209: -158, 210: -158, 211: -158, 212: -158, 213: -158, 214: -158, 215: -158 }, { 1: -159, 6: -159, 36: -159, 38: -159, 41: -159, 42: -159, 43: -159, 44: -159, 45: -159, 56: -159, 57: -159, 58: -159, 69: -159, 70: -159, 75: -159, 82: -159, 93: -159, 97: -159, 106: -159, 107: -159, 108: -159, 109: -159, 110: -159, 111: -159, 112: -159, 115: -159, 125: -159, 132: -159, 134: -159, 135: -159, 136: -159, 140: -159, 153: -159, 154: -159, 161: -159, 172: -159, 174: -159, 175: -159, 178: -159, 179: -159, 180: -159, 192: -159, 193: -159, 198: -159, 199: -159, 200: -159, 201: -159, 202: -159, 203: -159, 204: -159, 205: -159, 206: -159, 207: -159, 208: -159, 209: -159, 210: -159, 211: -159, 212: -159, 213: -159, 214: -159, 215: -159 }, { 56: 108, 58: 313, 111: 450, 132: 127, 160: 451, 161: 312, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 452, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 58: 313, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 124: 453, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 160: 310, 161: 312, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 111: 454 }, { 111: 455 }, { 7: 456, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 43: -279, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 111: -279, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -86, 6: -86, 36: -86, 38: -86, 42: -86, 43: -86, 56: -86, 58: -86, 69: -86, 70: -86, 75: -86, 82: 457, 93: -86, 97: -86, 106: -86, 107: -86, 108: -86, 109: -86, 110: -86, 111: -83, 112: -86, 115: -86, 125: -86, 132: -86, 134: -86, 135: -86, 136: -86, 153: -86, 154: -86, 161: -86, 172: -86, 174: -86, 175: -86, 178: -86, 179: -86, 180: -86, 192: -86, 193: -86, 198: -86, 199: -86, 202: -86, 203: -86, 204: -86, 205: -86, 206: -86, 207: -86, 208: -86, 209: -86, 210: -86, 211: -86, 212: -86, 213: -86, 214: -86 }, { 11: -273, 34: -273, 43: -273, 46: -273, 48: -273, 49: -273, 50: -273, 54: -273, 59: -273, 62: -273, 67: -273, 69: -273, 70: -273, 77: -273, 78: -273, 84: -273, 85: -273, 86: -273, 87: -273, 88: -273, 89: -273, 96: -273, 102: -273, 105: -273, 111: -273, 113: -273, 114: -273, 116: -273, 117: -273, 129: -273, 130: -273, 131: -273, 132: -273, 139: -273, 141: -273, 149: -273, 156: -273, 166: -273, 170: -273, 171: -273, 174: -273, 175: -273, 177: -273, 181: -273, 183: -273, 189: -273, 191: -273, 194: -273, 195: -273, 196: -273, 197: -273, 198: -273, 199: -273, 200: -273, 201: -273 }, { 11: -274, 34: -274, 43: -274, 46: -274, 48: -274, 49: -274, 50: -274, 54: -274, 59: -274, 62: -274, 67: -274, 69: -274, 70: -274, 77: -274, 78: -274, 84: -274, 85: -274, 86: -274, 87: -274, 88: -274, 89: -274, 96: -274, 102: -274, 105: -274, 111: -274, 113: -274, 114: -274, 116: -274, 117: -274, 129: -274, 130: -274, 131: -274, 132: -274, 139: -274, 141: -274, 149: -274, 156: -274, 166: -274, 170: -274, 171: -274, 174: -274, 175: -274, 177: -274, 181: -274, 183: -274, 189: -274, 191: -274, 194: -274, 195: -274, 196: -274, 197: -274, 198: -274, 199: -274, 200: -274, 201: -274 }, { 7: 458, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 459, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 58: 313, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 124: 460, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 160: 310, 161: 312, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 461, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 462, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -173, 6: -173, 36: -173, 38: -173, 41: -173, 42: -173, 43: -173, 44: -173, 45: -173, 56: -173, 57: -173, 58: -173, 69: -173, 70: -173, 75: -173, 82: -173, 93: -173, 97: -173, 106: -173, 107: -173, 108: -173, 109: -173, 110: -173, 111: -173, 112: -173, 115: -173, 125: -173, 132: -173, 134: -173, 135: -173, 136: -173, 140: -173, 153: -173, 154: -173, 161: -173, 172: -173, 174: -173, 175: -173, 178: -173, 179: -173, 180: -173, 192: -173, 193: -173, 198: -173, 199: -173, 200: -173, 201: -173, 202: -173, 203: -173, 204: -173, 205: -173, 206: -173, 207: -173, 208: -173, 209: -173, 210: -173, 211: -173, 212: -173, 213: -173, 214: -173, 215: -173 }, { 1: -174, 6: -174, 36: -174, 38: -174, 41: -174, 42: -174, 43: -174, 44: -174, 45: -174, 56: -174, 57: -174, 58: -174, 69: -174, 70: -174, 75: -174, 82: -174, 93: -174, 97: -174, 106: -174, 107: -174, 108: -174, 109: -174, 110: -174, 111: -174, 112: -174, 115: -174, 125: -174, 132: -174, 134: -174, 135: -174, 136: -174, 140: -174, 153: -174, 154: -174, 161: -174, 172: -174, 174: -174, 175: -174, 178: -174, 179: -174, 180: -174, 192: -174, 193: -174, 198: -174, 199: -174, 200: -174, 201: -174, 202: -174, 203: -174, 204: -174, 205: -174, 206: -174, 207: -174, 208: -174, 209: -174, 210: -174, 211: -174, 212: -174, 213: -174, 214: -174, 215: -174 }, { 1: -175, 6: -175, 36: -175, 38: -175, 41: -175, 42: -175, 43: -175, 44: -175, 45: -175, 56: -175, 57: -175, 58: -175, 69: -175, 70: -175, 75: -175, 82: -175, 93: -175, 97: -175, 106: -175, 107: -175, 108: -175, 109: -175, 110: -175, 111: -175, 112: -175, 115: -175, 125: -175, 132: -175, 134: -175, 135: -175, 136: -175, 140: -175, 153: -175, 154: -175, 161: -175, 172: -175, 174: -175, 175: -175, 178: -175, 179: -175, 180: -175, 192: -175, 193: -175, 198: -175, 199: -175, 200: -175, 201: -175, 202: -175, 203: -175, 204: -175, 205: -175, 206: -175, 207: -175, 208: -175, 209: -175, 210: -175, 211: -175, 212: -175, 213: -175, 214: -175, 215: -175 }, { 1: -176, 6: -176, 36: -176, 38: -176, 41: -176, 42: -176, 43: -176, 44: -176, 45: -176, 56: -176, 57: -176, 58: -176, 69: -176, 70: -176, 75: -176, 82: -176, 93: -176, 97: -176, 106: -176, 107: -176, 108: -176, 109: -176, 110: -176, 111: -176, 112: -176, 115: -176, 125: -176, 132: -176, 134: -176, 135: -176, 136: -176, 140: -176, 153: -176, 154: -176, 161: -176, 172: -176, 174: -176, 175: -176, 178: -176, 179: -176, 180: -176, 192: -176, 193: -176, 198: -176, 199: -176, 200: -176, 201: -176, 202: -176, 203: -176, 204: -176, 205: -176, 206: -176, 207: -176, 208: -176, 209: -176, 210: -176, 211: -176, 212: -176, 213: -176, 214: -176, 215: -176 }, { 56: 108, 111: 463, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 464, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 465, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 466, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -92, 6: -92, 38: -92, 42: -92, 43: -92, 56: 108, 58: -92, 75: -92, 82: -92, 93: -92, 97: -92, 111: -92, 115: -92, 132: -92, 134: -92, 135: -92, 136: -92, 161: -92, 172: -92, 173: 126, 174: -92, 175: -92, 178: -92, 179: -92, 180: -92, 192: -92, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 467, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 468, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -35, 6: -35, 38: -35, 42: -35, 43: -35, 56: 108, 58: -35, 75: -35, 82: -35, 93: -35, 97: -35, 111: -35, 115: -35, 132: 127, 134: -35, 135: -35, 136: -35, 161: -35, 172: -35, 173: 126, 174: 96, 175: 97, 178: -35, 179: -35, 180: -35, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 469, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 470, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -38, 6: -38, 38: -38, 42: -38, 43: -38, 56: 108, 58: -38, 75: -38, 82: -38, 93: -38, 97: -38, 111: -38, 115: -38, 132: 127, 134: -38, 135: -38, 136: -38, 161: -38, 172: -38, 173: 126, 174: 96, 175: 97, 178: -38, 179: -38, 180: -38, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 471, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 472, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -41, 6: -41, 38: -41, 42: -41, 43: -41, 56: 108, 58: -41, 75: -41, 82: -41, 93: -41, 97: -41, 111: -41, 115: -41, 132: 127, 134: -41, 135: -41, 136: -41, 161: -41, 172: -41, 173: 126, 174: 96, 175: 97, 178: -41, 179: -41, 180: -41, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 473, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 474, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 47: 475, 116: 90, 117: 91 }, { 6: -139, 35: 155, 38: -139, 42: -139, 43: -139, 54: 159, 58: 154, 59: 104, 63: 158, 95: 156, 96: 160, 97: -139, 119: 476, 120: 153, 121: 157, 131: 99, 135: -139 }, { 6: 477, 42: 478 }, { 7: 479, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: -147, 38: -147, 42: -147, 43: -147, 82: -147, 115: -147 }, { 6: -285, 38: -285, 42: -285, 43: -285, 56: 108, 82: -285, 97: -285, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -66, 6: -66, 36: -66, 38: -66, 42: -66, 43: -66, 56: -66, 58: -66, 69: -66, 70: -66, 75: -66, 82: -66, 93: -66, 97: -66, 106: -66, 107: -66, 108: -66, 109: -66, 110: -66, 111: -66, 112: -66, 115: -66, 125: -66, 132: -66, 134: -66, 135: -66, 136: -66, 153: -66, 154: -66, 161: -66, 168: -66, 169: -66, 172: -66, 174: -66, 175: -66, 178: -66, 179: -66, 180: -66, 185: -66, 187: -66, 192: -66, 193: -66, 198: -66, 199: -66, 202: -66, 203: -66, 204: -66, 205: -66, 206: -66, 207: -66, 208: -66, 209: -66, 210: -66, 211: -66, 212: -66, 213: -66, 214: -66 }, { 6: 107, 43: 480 }, { 6: -138, 38: -138, 42: -138, 43: -138, 82: 336, 97: -138, 115: 481, 118: 337, 135: -138 }, { 43: 482 }, { 1: -408, 6: -408, 38: -408, 42: -408, 43: -408, 56: 108, 58: -408, 75: -408, 82: -408, 93: -408, 97: -408, 111: -408, 115: -408, 132: -408, 134: -408, 135: -408, 136: -408, 161: -408, 172: -408, 173: 126, 174: -408, 175: -408, 178: -408, 179: -408, 180: -408, 192: -408, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 483, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 484, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -44, 6: -44, 38: -44, 42: -44, 43: -44, 56: -44, 58: -44, 75: -44, 82: -44, 93: -44, 97: -44, 111: -44, 115: -44, 132: -44, 134: -44, 135: -44, 136: -44, 161: -44, 172: -44, 174: -44, 175: -44, 178: -44, 179: -44, 180: -44, 192: -44, 193: -44, 198: -44, 199: -44, 202: -44, 203: -44, 204: -44, 205: -44, 206: -44, 207: -44, 208: -44, 209: -44, 210: -44, 211: -44, 212: -44, 213: -44, 214: -44 }, { 7: 487, 8: 488, 9: 489, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 51: 485, 52: 486, 53: 490, 54: 491, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -372, 6: -372, 38: -372, 42: -372, 43: -372, 56: -372, 58: -372, 75: -372, 82: -372, 93: -372, 97: -372, 111: -372, 115: -372, 132: -372, 134: -372, 135: -372, 136: -372, 161: -372, 172: -372, 174: -372, 175: -372, 178: -372, 179: -372, 180: -372, 192: -372, 193: -372, 198: -372, 199: -372, 202: -372, 203: -372, 204: -372, 205: -372, 206: -372, 207: -372, 208: -372, 209: -372, 210: -372, 211: -372, 212: -372, 213: -372, 214: -372 }, { 7: 492, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -305, 6: -305, 38: -305, 42: -305, 43: -305, 56: -305, 58: -305, 75: -305, 82: -305, 93: -305, 97: -305, 111: -305, 115: -305, 132: -305, 134: -305, 135: -305, 136: -305, 161: -305, 168: 493, 172: -305, 174: -305, 175: -305, 178: -305, 179: -305, 180: -305, 192: -305, 193: -305, 198: -305, 199: -305, 202: -305, 203: -305, 204: -305, 205: -305, 206: -305, 207: -305, 208: -305, 209: -305, 210: -305, 211: -305, 212: -305, 213: -305, 214: -305 }, { 39: 494, 42: 163 }, { 35: 495, 39: 497, 42: 163, 59: 104, 63: 496, 131: 99 }, { 7: 498, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 499, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 500, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 134: 501 }, { 180: 502 }, { 1: -338, 6: -338, 38: -338, 42: -338, 43: -338, 56: -338, 58: -338, 75: -338, 82: -338, 93: -338, 97: -338, 111: -338, 115: -338, 132: -338, 134: -338, 135: -338, 136: -338, 161: -338, 172: -338, 174: -338, 175: -338, 178: -338, 179: -338, 180: -338, 192: -338, 193: -338, 198: -338, 199: -338, 202: -338, 203: -338, 204: -338, 205: -338, 206: -338, 207: -338, 208: -338, 209: -338, 210: -338, 211: -338, 212: -338, 213: -338, 214: -338 }, { 7: 503, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 35: 155, 54: 159, 59: 104, 63: 158, 95: 156, 96: 160, 120: 200, 121: 157, 131: 99, 182: 504 }, { 7: 505, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 184: 506, 186: 366, 187: 367 }, { 43: 507, 185: 508, 186: 509, 187: 367 }, { 43: -363, 185: -363, 187: -363 }, { 7: 511, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 165: 510, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -212, 6: -212, 38: -212, 39: 512, 42: 163, 43: -212, 56: 108, 58: -212, 75: -212, 82: -212, 93: -212, 97: -212, 111: -212, 115: -212, 132: -212, 134: -212, 135: -212, 136: -212, 161: -212, 172: -212, 173: 126, 174: -212, 175: -212, 178: -212, 179: -212, 180: -212, 192: -212, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -215, 6: -215, 38: -215, 42: -215, 43: -215, 56: -215, 58: -215, 75: -215, 82: -215, 93: -215, 97: -215, 111: -215, 115: -215, 132: -215, 134: -215, 135: -215, 136: -215, 161: -215, 172: -215, 174: -215, 175: -215, 178: -215, 179: -215, 180: -215, 192: -215, 193: -215, 198: -215, 199: -215, 202: -215, 203: -215, 204: -215, 205: -215, 206: -215, 207: -215, 208: -215, 209: -215, 210: -215, 211: -215, 212: -215, 213: -215, 214: -215 }, { 7: 513, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 43: 514 }, { 43: 515 }, { 1: -65, 6: -65, 38: -65, 42: -65, 43: -65, 56: 108, 58: -65, 75: -65, 82: -65, 93: -65, 97: -65, 111: -65, 115: -65, 132: -65, 134: -65, 135: -65, 136: -65, 161: -65, 172: -65, 173: 126, 174: -65, 175: -65, 178: -65, 179: -65, 180: -65, 192: -65, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 6: -140, 35: 155, 37: 516, 38: -140, 42: -140, 43: -140, 54: 159, 58: 154, 59: 104, 63: 158, 82: -140, 95: 156, 96: 160, 115: -140, 119: 152, 120: 153, 121: 157, 131: 99 }, { 1: -34, 6: -34, 38: -34, 42: -34, 43: -34, 56: -34, 58: -34, 75: -34, 82: -34, 93: -34, 97: -34, 111: -34, 115: -34, 132: -34, 134: -34, 135: -34, 136: -34, 161: -34, 172: -34, 174: -34, 175: -34, 178: -34, 179: -34, 180: -34, 192: -34, 193: -34, 198: -34, 199: -34, 202: -34, 203: -34, 204: -34, 205: -34, 206: -34, 207: -34, 208: -34, 209: -34, 210: -34, 211: -34, 212: -34, 213: -34, 214: -34 }, { 43: 517 }, { 68: 518, 69: 105, 70: 106 }, { 131: 520, 143: 519, 148: 221 }, { 68: 521, 69: 105, 70: 106 }, { 64: 522 }, { 6: -138, 38: -138, 42: -138, 43: -138, 82: 524, 97: -138, 118: 523, 135: -138 }, { 6: -225, 42: -225, 43: -225, 82: -225, 135: -225 }, { 35: 384, 42: 383, 59: 104, 144: 525, 145: 382, 147: 385 }, { 6: -230, 42: -230, 43: -230, 82: -230, 135: -230, 146: 526 }, { 6: -232, 42: -232, 43: -232, 82: -232, 135: -232, 146: 527 }, { 35: 528, 59: 104 }, { 1: -236, 6: -236, 38: -236, 42: -236, 43: -236, 64: 529, 75: -236, 82: -236, 97: -236, 172: -236, 174: -236, 175: -236, 192: -236, 193: -236 }, { 6: -138, 38: -138, 42: -138, 43: -138, 82: 531, 97: -138, 118: 530, 135: -138 }, { 6: -248, 42: -248, 43: -248, 82: -248, 135: -248 }, { 35: 391, 42: 390, 59: 104, 147: 392, 150: 532, 152: 389 }, { 6: -253, 42: -253, 43: -253, 82: -253, 135: -253, 146: 533 }, { 6: -256, 42: -256, 43: -256, 82: -256, 135: -256, 146: 534 }, { 6: 536, 7: 535, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 537, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -243, 6: -243, 38: -243, 42: -243, 43: -243, 56: 108, 75: -243, 82: -243, 97: -243, 132: 127, 172: -243, 173: 126, 174: 96, 175: 97, 192: -243, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 63: 538, 131: 99 }, { 68: 539, 69: 105, 70: 106 }, { 1: -313, 6: -313, 36: -313, 38: -313, 42: -313, 43: -313, 56: -313, 58: -313, 69: -313, 70: -313, 75: -313, 82: -313, 93: -313, 97: -313, 106: -313, 107: -313, 108: -313, 109: -313, 110: -313, 111: -313, 112: -313, 115: -313, 125: -313, 132: -313, 134: -313, 135: -313, 136: -313, 153: -313, 154: -313, 161: -313, 172: -313, 174: -313, 175: -313, 178: -313, 179: -313, 180: -313, 192: -313, 193: -313, 198: -313, 199: -313, 202: -313, 203: -313, 204: -313, 205: -313, 206: -313, 207: -313, 208: -313, 209: -313, 210: -313, 211: -313, 212: -313, 213: -313, 214: -313 }, { 6: 107, 43: 540 }, { 7: 541, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -271, 6: -271, 36: -271, 38: -271, 41: -271, 42: -271, 43: -271, 44: -271, 45: -271, 56: -271, 57: -271, 58: -271, 69: -271, 70: -271, 75: -271, 82: -271, 93: -271, 97: -271, 106: -271, 107: -271, 108: -271, 109: -271, 110: -271, 111: -271, 112: -271, 115: -271, 125: -271, 132: -271, 134: -271, 135: -271, 136: -271, 153: -271, 154: -271, 161: -271, 172: -271, 174: -271, 175: -271, 178: -271, 179: -271, 180: -271, 192: -271, 193: -271, 198: -271, 199: -271, 202: -271, 203: -271, 204: -271, 205: -271, 206: -271, 207: -271, 208: -271, 209: -271, 210: -271, 211: -271, 212: -271, 213: -271, 214: -271 }, { 6: 406, 11: -299, 34: -299, 42: -299, 43: -299, 46: -299, 48: -299, 49: -299, 50: -299, 54: -299, 58: -299, 59: -299, 62: -299, 67: -299, 69: -299, 70: -299, 77: -299, 78: -299, 82: -299, 84: -299, 85: -299, 86: -299, 87: -299, 88: -299, 89: -299, 96: -299, 97: -299, 102: -299, 105: -299, 113: -299, 114: -299, 116: -299, 117: -299, 129: -299, 130: -299, 131: -299, 132: -299, 139: -299, 141: -299, 149: -299, 156: -299, 166: -299, 170: -299, 171: -299, 174: -299, 175: -299, 177: -299, 181: -299, 183: -299, 189: -299, 191: -299, 194: -299, 195: -299, 196: -299, 197: -299, 198: -299, 199: -299, 200: -299, 201: -299 }, { 6: -295, 42: -295, 43: -295, 82: -295, 97: -295 }, { 42: 543, 97: 542 }, { 6: -139, 7: 340, 8: 239, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 38: -139, 40: 33, 42: -139, 43: -139, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 58: 241, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 82: 237, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 97: -139, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 122: 240, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 135: -139, 139: 64, 141: 70, 149: 71, 156: 86, 157: 545, 162: 238, 163: 544, 164: 234, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: 546, 42: -296, 43: -296, 97: -296 }, { 6: -301, 11: -301, 34: -301, 42: -301, 43: -301, 46: -301, 48: -301, 49: -301, 50: -301, 54: -301, 58: -301, 59: -301, 62: -301, 67: -301, 69: -301, 70: -301, 77: -301, 78: -301, 82: -301, 84: -301, 85: -301, 86: -301, 87: -301, 88: -301, 89: -301, 96: -301, 97: -301, 102: -301, 105: -301, 113: -301, 114: -301, 116: -301, 117: -301, 129: -301, 130: -301, 131: -301, 132: -301, 139: -301, 141: -301, 149: -301, 156: -301, 166: -301, 170: -301, 171: -301, 174: -301, 175: -301, 177: -301, 181: -301, 183: -301, 189: -301, 191: -301, 194: -301, 195: -301, 196: -301, 197: -301, 198: -301, 199: -301, 200: -301, 201: -301 }, { 6: -138, 38: -138, 42: -138, 43: -138, 82: 404, 97: -138, 118: 405, 135: -138, 159: 547 }, { 7: 340, 8: 239, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 58: 241, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 82: 237, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 122: 240, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 162: 402, 164: 401, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: -153, 38: -153, 42: -153, 43: -153, 56: 108, 82: -153, 97: -153, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -195, 6: -195, 36: -195, 38: -195, 42: -195, 43: -195, 56: -195, 58: -195, 69: -195, 70: -195, 75: -195, 82: -195, 93: -195, 97: -195, 106: -195, 107: -195, 108: -195, 109: -195, 110: -195, 111: -195, 112: -195, 115: -195, 125: -195, 132: -195, 134: -195, 135: -195, 136: -195, 153: -195, 154: -195, 161: -195, 172: -195, 174: -195, 175: -195, 178: -195, 179: -195, 180: -195, 192: -195, 193: -195, 198: -195, 199: -195, 202: -195, 203: -195, 204: -195, 205: -195, 206: -195, 207: -195, 208: -195, 209: -195, 210: -195, 211: -195, 212: -195, 213: -195, 214: -195 }, { 56: 108, 111: 548, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 549, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -265, 6: -265, 36: -265, 38: -265, 42: -265, 43: -265, 56: -265, 58: -265, 69: -265, 70: -265, 75: -265, 80: -265, 82: -265, 93: -265, 97: -265, 106: -265, 107: -265, 108: -265, 109: -265, 110: -265, 111: -265, 112: -265, 115: -265, 125: -265, 132: -265, 134: -265, 135: -265, 136: -265, 153: -265, 154: -265, 161: -265, 172: -265, 174: -265, 175: -265, 178: -265, 179: -265, 180: -265, 192: -265, 193: -265, 198: -265, 199: -265, 202: -265, 203: -265, 204: -265, 205: -265, 206: -265, 207: -265, 208: -265, 209: -265, 210: -265, 211: -265, 212: -265, 213: -265, 214: -265 }, { 6: -138, 38: -138, 42: -138, 43: -138, 82: 551, 97: -138, 118: 550, 135: -138 }, { 6: -280, 38: -280, 42: -280, 43: -280, 82: -280 }, { 7: 340, 8: 239, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 416, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 58: 241, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 122: 240, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 155: 552, 156: 86, 162: 415, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -198, 6: -198, 36: -198, 38: -198, 42: -198, 43: -198, 56: -198, 58: -198, 69: -198, 70: -198, 75: -198, 82: -198, 93: -198, 97: -198, 106: -198, 107: -198, 108: -198, 109: -198, 110: -198, 111: -198, 112: -198, 115: -198, 125: -198, 132: -198, 134: -198, 135: -198, 136: -198, 153: -198, 154: -198, 161: -198, 172: -198, 174: -198, 175: -198, 178: -198, 179: -198, 180: -198, 192: -198, 193: -198, 198: -198, 199: -198, 202: -198, 203: -198, 204: -198, 205: -198, 206: -198, 207: -198, 208: -198, 209: -198, 210: -198, 211: -198, 212: -198, 213: -198, 214: -198 }, { 1: -199, 6: -199, 36: -199, 38: -199, 42: -199, 43: -199, 56: -199, 58: -199, 69: -199, 70: -199, 75: -199, 82: -199, 93: -199, 97: -199, 106: -199, 107: -199, 108: -199, 109: -199, 110: -199, 111: -199, 112: -199, 115: -199, 125: -199, 132: -199, 134: -199, 135: -199, 136: -199, 153: -199, 154: -199, 161: -199, 172: -199, 174: -199, 175: -199, 178: -199, 179: -199, 180: -199, 192: -199, 193: -199, 198: -199, 199: -199, 202: -199, 203: -199, 204: -199, 205: -199, 206: -199, 207: -199, 208: -199, 209: -199, 210: -199, 211: -199, 212: -199, 213: -199, 214: -199 }, { 1: -367, 6: -367, 38: -367, 42: -367, 43: -367, 56: -367, 58: -367, 75: -367, 82: -367, 93: -367, 97: -367, 111: -367, 115: -367, 132: -367, 134: -367, 135: -367, 136: -367, 161: -367, 172: -367, 174: -367, 175: -367, 178: -367, 179: -367, 180: -367, 185: -367, 192: -367, 193: -367, 198: -367, 199: -367, 202: -367, 203: -367, 204: -367, 205: -367, 206: -367, 207: -367, 208: -367, 209: -367, 210: -367, 211: -367, 212: -367, 213: -367, 214: -367 }, { 1: -369, 6: -369, 38: -369, 42: -369, 43: -369, 56: -369, 58: -369, 75: -369, 82: -369, 93: -369, 97: -369, 111: -369, 115: -369, 132: -369, 134: -369, 135: -369, 136: -369, 161: -369, 172: -369, 174: -369, 175: -369, 178: -369, 179: -369, 180: -369, 185: 553, 192: -369, 193: -369, 198: -369, 199: -369, 202: -369, 203: -369, 204: -369, 205: -369, 206: -369, 207: -369, 208: -369, 209: -369, 210: -369, 211: -369, 212: -369, 213: -369, 214: -369 }, { 7: 554, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 555, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 556, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 557, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: 559, 42: 560, 135: 558 }, { 6: -139, 35: 264, 38: -139, 42: -139, 43: -139, 54: 261, 55: 248, 58: 268, 59: 104, 65: 265, 66: 262, 67: 100, 68: 101, 69: 105, 70: 106, 90: 561, 91: 562, 92: 267, 94: 259, 95: 266, 96: 260, 97: -139, 135: -139 }, { 7: 563, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 564, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 56: 108, 97: 565, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 566, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: -108, 36: -110, 42: -108, 43: -108, 69: -263, 70: -263, 82: -108, 103: 567, 106: -110, 107: -110, 108: -110, 109: -110, 110: -110, 112: -110, 135: -108, 154: 140 }, { 6: -109, 36: -263, 42: -109, 43: -109, 69: -263, 70: -263, 82: -109, 103: 568, 106: 569, 107: 570, 108: 571, 109: 572, 110: 573, 112: 574, 135: -109, 154: 140 }, { 6: -111, 36: -111, 42: -111, 43: -111, 82: -111, 106: -111, 107: -111, 108: -111, 109: -111, 110: -111, 112: -111, 135: -111, 154: -111 }, { 6: -112, 36: -112, 42: -112, 43: -112, 82: -112, 106: -112, 107: -112, 108: -112, 109: -112, 110: -112, 112: -112, 135: -112, 154: -112 }, { 6: -113, 36: -113, 42: -113, 43: -113, 82: -113, 106: -113, 107: -113, 108: -113, 109: -113, 110: -113, 112: -113, 135: -113, 154: -113 }, { 6: -114, 36: -114, 42: -114, 43: -114, 82: -114, 106: -114, 107: -114, 108: -114, 109: -114, 110: -114, 112: -114, 135: -114, 154: -114 }, { 36: -263, 69: -263, 70: -263, 103: 575, 106: 243, 110: 244, 154: 140 }, { 36: 245, 104: 576 }, { 1: -81, 6: -81, 36: -81, 38: -81, 42: -81, 43: -81, 56: -81, 58: -81, 69: -81, 70: -81, 75: -81, 82: -81, 93: -81, 97: -81, 106: -81, 107: -81, 108: -81, 109: -81, 110: -81, 111: -81, 112: -81, 115: -81, 125: -81, 132: -81, 134: -81, 135: -81, 136: -81, 153: -81, 154: -81, 161: -81, 172: -81, 174: -81, 175: -81, 178: -81, 179: -81, 180: -81, 192: -81, 193: -81, 198: -81, 199: -81, 202: -81, 203: -81, 204: -81, 205: -81, 206: -81, 207: -81, 208: -81, 209: -81, 210: -81, 211: -81, 212: -81, 213: -81, 214: -81 }, { 1: -73, 6: -73, 36: -73, 38: -73, 42: -73, 43: -73, 56: -73, 58: -73, 69: -73, 70: -73, 72: -73, 74: -73, 75: -73, 80: -73, 82: -73, 93: -73, 97: -73, 106: -73, 107: -73, 108: -73, 109: -73, 110: -73, 111: -73, 112: -73, 115: -73, 125: -73, 132: -73, 134: -73, 135: -73, 136: -73, 153: -73, 154: -73, 161: -73, 172: -73, 174: -73, 175: -73, 178: -73, 179: -73, 180: -73, 192: -73, 193: -73, 198: -73, 199: -73, 202: -73, 203: -73, 204: -73, 205: -73, 206: -73, 207: -73, 208: -73, 209: -73, 210: -73, 211: -73, 212: -73, 213: -73, 214: -73 }, { 69: -75, 70: -75, 72: -75, 74: -75 }, { 6: 107, 75: 577 }, { 4: 578, 5: 3, 7: 4, 8: 5, 9: 6, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 69: -78, 70: -78, 72: -78, 74: -78 }, { 7: 579, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 580, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 581, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 582, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 134: 583 }, { 180: 584 }, { 7: 585, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -162, 6: -162, 36: -162, 38: -162, 41: -162, 42: -162, 43: -162, 44: -162, 45: -162, 56: -162, 57: -162, 58: -162, 69: -162, 70: -162, 75: -162, 82: -162, 93: -162, 97: -162, 106: -162, 107: -162, 108: -162, 109: -162, 110: -162, 111: -162, 112: -162, 115: -162, 125: -162, 132: -162, 134: -162, 135: -162, 136: -162, 140: -162, 153: -162, 154: -162, 161: -162, 172: -162, 174: -162, 175: -162, 178: -162, 179: -162, 180: -162, 192: -162, 193: -162, 198: -162, 199: -162, 200: -162, 201: -162, 202: -162, 203: -162, 204: -162, 205: -162, 206: -162, 207: -162, 208: -162, 209: -162, 210: -162, 211: -162, 212: -162, 213: -162, 214: -162, 215: -162 }, { 7: 586, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 43: -277, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 111: -277, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 43: 587, 56: 108, 58: 313, 132: 127, 160: 451, 161: 312, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 43: 588 }, { 1: -164, 6: -164, 36: -164, 38: -164, 41: -164, 42: -164, 43: -164, 44: -164, 45: -164, 56: -164, 57: -164, 58: -164, 69: -164, 70: -164, 75: -164, 82: -164, 93: -164, 97: -164, 106: -164, 107: -164, 108: -164, 109: -164, 110: -164, 111: -164, 112: -164, 115: -164, 125: -164, 132: -164, 134: -164, 135: -164, 136: -164, 140: -164, 153: -164, 154: -164, 161: -164, 172: -164, 174: -164, 175: -164, 178: -164, 179: -164, 180: -164, 192: -164, 193: -164, 198: -164, 199: -164, 200: -164, 201: -164, 202: -164, 203: -164, 204: -164, 205: -164, 206: -164, 207: -164, 208: -164, 209: -164, 210: -164, 211: -164, 212: -164, 213: -164, 214: -164, 215: -164 }, { 1: -166, 6: -166, 36: -166, 38: -166, 41: -166, 42: -166, 43: -166, 44: -166, 45: -166, 56: -166, 57: -166, 58: -166, 69: -166, 70: -166, 75: -166, 82: -166, 93: -166, 97: -166, 106: -166, 107: -166, 108: -166, 109: -166, 110: -166, 111: -166, 112: -166, 115: -166, 125: -166, 132: -166, 134: -166, 135: -166, 136: -166, 140: -166, 153: -166, 154: -166, 161: -166, 172: -166, 174: -166, 175: -166, 178: -166, 179: -166, 180: -166, 192: -166, 193: -166, 198: -166, 199: -166, 200: -166, 201: -166, 202: -166, 203: -166, 204: -166, 205: -166, 206: -166, 207: -166, 208: -166, 209: -166, 210: -166, 211: -166, 212: -166, 213: -166, 214: -166, 215: -166 }, { 43: -278, 56: 108, 111: -278, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 589, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 56: 108, 58: 313, 111: 590, 132: 127, 160: 451, 161: 312, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 591, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 58: 313, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 124: 592, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 160: 310, 161: 312, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 111: 593 }, { 56: 108, 111: 594, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 595, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -179, 6: -179, 36: -179, 38: -179, 41: -179, 42: -179, 43: -179, 44: -179, 45: -179, 56: -179, 57: -179, 58: -179, 69: -179, 70: -179, 75: -179, 82: -179, 93: -179, 97: -179, 106: -179, 107: -179, 108: -179, 109: -179, 110: -179, 111: -179, 112: -179, 115: -179, 125: -179, 132: -179, 134: -179, 135: -179, 136: -179, 140: -179, 153: -179, 154: -179, 161: -179, 172: -179, 174: -179, 175: -179, 178: -179, 179: -179, 180: -179, 192: -179, 193: -179, 198: -179, 199: -179, 200: -179, 201: -179, 202: -179, 203: -179, 204: -179, 205: -179, 206: -179, 207: -179, 208: -179, 209: -179, 210: -179, 211: -179, 212: -179, 213: -179, 214: -179, 215: -179 }, { 43: 596, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 56: 108, 111: 597, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 598, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -93, 6: -93, 38: -93, 42: -93, 43: -93, 56: 108, 58: -93, 75: -93, 82: -93, 93: -93, 97: -93, 111: -93, 115: -93, 132: -93, 134: -93, 135: -93, 136: -93, 161: -93, 172: -93, 173: 126, 174: -93, 175: -93, 178: -93, 179: -93, 180: -93, 192: -93, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 43: 599, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -36, 6: -36, 38: -36, 42: -36, 43: -36, 56: 108, 58: -36, 75: -36, 82: -36, 93: -36, 97: -36, 111: -36, 115: -36, 132: 127, 134: -36, 135: -36, 136: -36, 161: -36, 172: -36, 173: 126, 174: 96, 175: 97, 178: -36, 179: -36, 180: -36, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 43: 600, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -39, 6: -39, 38: -39, 42: -39, 43: -39, 56: 108, 58: -39, 75: -39, 82: -39, 93: -39, 97: -39, 111: -39, 115: -39, 132: 127, 134: -39, 135: -39, 136: -39, 161: -39, 172: -39, 173: 126, 174: 96, 175: 97, 178: -39, 179: -39, 180: -39, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 43: 601, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -42, 6: -42, 38: -42, 42: -42, 43: -42, 56: 108, 58: -42, 75: -42, 82: -42, 93: -42, 97: -42, 111: -42, 115: -42, 132: 127, 134: -42, 135: -42, 136: -42, 161: -42, 172: -42, 173: 126, 174: 96, 175: 97, 178: -42, 179: -42, 180: -42, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 43: 602, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 5: 604, 7: 4, 8: 5, 9: 6, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 39: 603, 40: 33, 42: 163, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: -142, 38: -142, 42: -142, 43: -142, 82: -142, 115: -142 }, { 35: 155, 54: 159, 58: 154, 59: 104, 63: 158, 95: 156, 96: 160, 119: 605, 120: 153, 121: 157, 131: 99 }, { 6: -140, 35: 155, 37: 606, 38: -140, 42: -140, 43: -140, 54: 159, 58: 154, 59: 104, 63: 158, 82: -140, 95: 156, 96: 160, 115: -140, 119: 152, 120: 153, 121: 157, 131: 99 }, { 6: -146, 38: -146, 42: -146, 43: -146, 56: 108, 82: -146, 115: -146, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -67, 6: -67, 36: -67, 38: -67, 42: -67, 43: -67, 56: -67, 58: -67, 69: -67, 70: -67, 75: -67, 82: -67, 93: -67, 97: -67, 106: -67, 107: -67, 108: -67, 109: -67, 110: -67, 111: -67, 112: -67, 115: -67, 125: -67, 132: -67, 134: -67, 135: -67, 136: -67, 153: -67, 154: -67, 161: -67, 168: -67, 169: -67, 172: -67, 174: -67, 175: -67, 178: -67, 179: -67, 180: -67, 185: -67, 187: -67, 192: -67, 193: -67, 198: -67, 199: -67, 202: -67, 203: -67, 204: -67, 205: -67, 206: -67, 207: -67, 208: -67, 209: -67, 210: -67, 211: -67, 212: -67, 213: -67, 214: -67 }, { 47: 607, 116: 90, 117: 91 }, { 1: -387, 6: -387, 38: -387, 42: -387, 43: -387, 56: -387, 58: -387, 75: -387, 82: -387, 93: -387, 97: -387, 111: -387, 115: -387, 132: -387, 134: -387, 135: -387, 136: -387, 161: -387, 172: -387, 174: -387, 175: -387, 178: -387, 179: -387, 180: -387, 192: -387, 193: -387, 198: -387, 199: -387, 202: -387, 203: -387, 204: -387, 205: -387, 206: -387, 207: -387, 208: -387, 209: -387, 210: -387, 211: -387, 212: -387, 213: -387, 214: -387 }, { 43: 608, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -410, 6: -410, 38: -410, 42: -410, 43: -410, 56: 108, 58: -410, 75: -410, 82: -410, 93: -410, 97: -410, 111: -410, 115: -410, 132: -410, 134: -410, 135: -410, 136: -410, 161: -410, 172: -410, 173: 126, 174: -410, 175: -410, 178: -410, 179: -410, 180: -410, 192: -410, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 6: 610, 43: 609 }, { 6: -49, 43: -49 }, { 6: -52, 43: -52, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 6: -53, 43: -53 }, { 6: -54, 43: -54, 173: 130, 174: 96, 175: 97, 192: 128, 193: 129 }, { 6: -55, 43: -55 }, { 1: -268, 6: -268, 36: -268, 38: -268, 42: -268, 43: -268, 55: 611, 56: -268, 58: 612, 65: 247, 69: -268, 70: -268, 75: -268, 82: -268, 93: -268, 97: -268, 106: -268, 107: -268, 108: -268, 109: -268, 110: -268, 111: -268, 112: -268, 115: -268, 125: -268, 132: -268, 134: -268, 135: -268, 136: -268, 153: -268, 154: -268, 161: -268, 172: -268, 174: -268, 175: -268, 178: -268, 179: -268, 180: -268, 192: -268, 193: -268, 198: -268, 199: -268, 202: -268, 203: -268, 204: -268, 205: -268, 206: -268, 207: -268, 208: -268, 209: -268, 210: -268, 211: -268, 212: -268, 213: -268, 214: -268 }, { 39: 613, 42: 163, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 39: 614, 42: 163 }, { 1: -306, 6: -306, 38: -306, 42: -306, 43: -306, 56: -306, 58: -306, 75: -306, 82: -306, 93: -306, 97: -306, 111: -306, 115: -306, 132: -306, 134: -306, 135: -306, 136: -306, 161: -306, 172: -306, 174: -306, 175: -306, 178: -306, 179: -306, 180: -306, 192: -306, 193: -306, 198: -306, 199: -306, 202: -306, 203: -306, 204: -306, 205: -306, 206: -306, 207: -306, 208: -306, 209: -306, 210: -306, 211: -306, 212: -306, 213: -306, 214: -306 }, { 39: 615, 42: 163 }, { 39: 616, 42: 163 }, { 1: -310, 6: -310, 38: -310, 42: -310, 43: -310, 56: -310, 58: -310, 75: -310, 82: -310, 93: -310, 97: -310, 111: -310, 115: -310, 132: -310, 134: -310, 135: -310, 136: -310, 161: -310, 168: -310, 172: -310, 174: -310, 175: -310, 178: -310, 179: -310, 180: -310, 192: -310, 193: -310, 198: -310, 199: -310, 202: -310, 203: -310, 204: -310, 205: -310, 206: -310, 207: -310, 208: -310, 209: -310, 210: -310, 211: -310, 212: -310, 213: -310, 214: -310 }, { 39: 617, 42: 163, 56: 108, 132: 127, 136: 618, 173: 126, 174: 96, 175: 97, 179: 619, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 39: 620, 42: 163, 56: 108, 132: 127, 136: 621, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 39: 622, 42: 163, 56: 108, 132: 127, 136: 623, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 624, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 625, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 39: 626, 42: 163, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 134: -358, 178: -358, 180: -358 }, { 56: 108, 82: -356, 132: 127, 134: -356, 173: 126, 174: 96, 175: 97, 178: -356, 180: -356, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 43: 627, 185: 628, 186: 509, 187: 367 }, { 1: -361, 6: -361, 38: -361, 42: -361, 43: -361, 56: -361, 58: -361, 75: -361, 82: -361, 93: -361, 97: -361, 111: -361, 115: -361, 132: -361, 134: -361, 135: -361, 136: -361, 161: -361, 172: -361, 174: -361, 175: -361, 178: -361, 179: -361, 180: -361, 192: -361, 193: -361, 198: -361, 199: -361, 202: -361, 203: -361, 204: -361, 205: -361, 206: -361, 207: -361, 208: -361, 209: -361, 210: -361, 211: -361, 212: -361, 213: -361, 214: -361 }, { 39: 629, 42: 163 }, { 43: -364, 185: -364, 187: -364 }, { 39: 630, 42: 163, 82: 631 }, { 42: -302, 56: 108, 82: -302, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -213, 6: -213, 38: -213, 42: -213, 43: -213, 56: -213, 58: -213, 75: -213, 82: -213, 93: -213, 97: -213, 111: -213, 115: -213, 132: -213, 134: -213, 135: -213, 136: -213, 161: -213, 172: -213, 174: -213, 175: -213, 178: -213, 179: -213, 180: -213, 192: -213, 193: -213, 198: -213, 199: -213, 202: -213, 203: -213, 204: -213, 205: -213, 206: -213, 207: -213, 208: -213, 209: -213, 210: -213, 211: -213, 212: -213, 213: -213, 214: -213 }, { 1: -216, 6: -216, 38: -216, 39: 632, 42: 163, 43: -216, 56: 108, 58: -216, 75: -216, 82: -216, 93: -216, 97: -216, 111: -216, 115: -216, 132: -216, 134: -216, 135: -216, 136: -216, 161: -216, 172: -216, 173: 126, 174: -216, 175: -216, 178: -216, 179: -216, 180: -216, 192: -216, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -312, 6: -312, 38: -312, 42: -312, 43: -312, 56: -312, 58: -312, 75: -312, 82: -312, 93: -312, 97: -312, 111: -312, 115: -312, 132: -312, 134: -312, 135: -312, 136: -312, 161: -312, 172: -312, 174: -312, 175: -312, 178: -312, 179: -312, 180: -312, 192: -312, 193: -312, 198: -312, 199: -312, 202: -312, 203: -312, 204: -312, 205: -312, 206: -312, 207: -312, 208: -312, 209: -312, 210: -312, 211: -312, 212: -312, 213: -312, 214: -312 }, { 1: -64, 6: -64, 38: -64, 42: -64, 43: -64, 56: -64, 58: -64, 75: -64, 82: -64, 93: -64, 97: -64, 111: -64, 115: -64, 132: -64, 134: -64, 135: -64, 136: -64, 161: -64, 172: -64, 174: -64, 175: -64, 178: -64, 179: -64, 180: -64, 192: -64, 193: -64, 198: -64, 199: -64, 202: -64, 203: -64, 204: -64, 205: -64, 206: -64, 207: -64, 208: -64, 209: -64, 210: -64, 211: -64, 212: -64, 213: -64, 214: -64 }, { 6: -138, 38: 633, 42: -138, 43: -138, 82: 336, 97: -138, 118: 337, 135: -138 }, { 1: -130, 6: -130, 38: -130, 42: -130, 43: -130, 75: -130, 82: -130, 97: -130, 172: -130, 174: -130, 175: -130, 192: -130, 193: -130 }, { 1: -219, 6: -219, 38: -219, 42: -219, 43: -219, 75: -219, 82: -219, 97: -219, 172: -219, 174: -219, 175: -219, 192: -219, 193: -219 }, { 64: 634 }, { 35: 384, 42: 383, 59: 104, 144: 635, 145: 382, 147: 385 }, { 1: -220, 6: -220, 38: -220, 42: -220, 43: -220, 75: -220, 82: -220, 97: -220, 172: -220, 174: -220, 175: -220, 192: -220, 193: -220 }, { 68: 636, 69: 105, 70: 106 }, { 6: 638, 42: 639, 135: 637 }, { 6: -139, 35: 384, 38: -139, 42: -139, 43: -139, 59: 104, 97: -139, 135: -139, 145: 640, 147: 385 }, { 6: -138, 38: -138, 42: -138, 43: -138, 82: 524, 97: -138, 118: 641, 135: -138 }, { 35: 642, 59: 104 }, { 35: 643, 59: 104 }, { 64: -235 }, { 68: 644, 69: 105, 70: 106 }, { 6: 646, 42: 647, 135: 645 }, { 6: -139, 35: 391, 38: -139, 42: -139, 43: -139, 59: 104, 97: -139, 135: -139, 147: 392, 152: 648 }, { 6: -138, 38: -138, 42: -138, 43: -138, 82: 531, 97: -138, 118: 649, 135: -138 }, { 35: 650, 59: 104, 147: 651 }, { 35: 652, 59: 104 }, { 1: -240, 6: -240, 38: -240, 42: -240, 43: -240, 56: 108, 75: -240, 82: -240, 97: -240, 132: 127, 172: -240, 173: 126, 174: -240, 175: -240, 192: -240, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 653, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 654, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 43: 655 }, { 1: -245, 6: -245, 38: -245, 42: -245, 43: -245, 75: -245, 82: -245, 97: -245, 172: -245, 174: -245, 175: -245, 192: -245, 193: -245 }, { 172: 656 }, { 56: 108, 97: 657, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -272, 6: -272, 36: -272, 38: -272, 41: -272, 42: -272, 43: -272, 44: -272, 45: -272, 56: -272, 57: -272, 58: -272, 69: -272, 70: -272, 75: -272, 82: -272, 93: -272, 97: -272, 106: -272, 107: -272, 108: -272, 109: -272, 110: -272, 111: -272, 112: -272, 115: -272, 125: -272, 132: -272, 134: -272, 135: -272, 136: -272, 153: -272, 154: -272, 161: -272, 172: -272, 174: -272, 175: -272, 178: -272, 179: -272, 180: -272, 192: -272, 193: -272, 198: -272, 199: -272, 202: -272, 203: -272, 204: -272, 205: -272, 206: -272, 207: -272, 208: -272, 209: -272, 210: -272, 211: -272, 212: -272, 213: -272, 214: -272 }, { 7: 340, 8: 239, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 236, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 58: 241, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 82: 237, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 122: 240, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 157: 408, 158: 658, 162: 238, 163: 235, 164: 234, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: -290, 42: -290, 43: -290, 82: -290, 97: -290 }, { 7: 340, 8: 239, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: -297, 43: -297, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 58: 241, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 82: 237, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 97: -297, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 122: 240, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 162: 402, 164: 401, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 340, 8: 239, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 58: 241, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 82: 237, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 122: 240, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 157: 408, 162: 238, 163: 659, 164: 234, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 42: 543, 43: 660 }, { 1: -196, 6: -196, 36: -196, 38: -196, 42: -196, 43: -196, 56: -196, 58: -196, 69: -196, 70: -196, 75: -196, 82: -196, 93: -196, 97: -196, 106: -196, 107: -196, 108: -196, 109: -196, 110: -196, 111: -196, 112: -196, 115: -196, 125: -196, 132: -196, 134: -196, 135: -196, 136: -196, 153: -196, 154: -196, 161: -196, 172: -196, 174: -196, 175: -196, 178: -196, 179: -196, 180: -196, 192: -196, 193: -196, 198: -196, 199: -196, 202: -196, 203: -196, 204: -196, 205: -196, 206: -196, 207: -196, 208: -196, 209: -196, 210: -196, 211: -196, 212: -196, 213: -196, 214: -196 }, { 43: 661, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 6: 663, 38: 662, 42: 664 }, { 6: -139, 7: 340, 8: 239, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 38: -139, 40: 33, 42: -139, 43: -139, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 58: 241, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 97: -139, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 122: 240, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 135: -139, 139: 64, 141: 70, 149: 71, 156: 86, 162: 665, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: -138, 38: -138, 42: -138, 43: -138, 82: 551, 97: -138, 118: 666, 135: -138 }, { 39: 667, 42: 163 }, { 1: -316, 6: -316, 38: -316, 42: -316, 43: -316, 56: 108, 58: -316, 75: -316, 82: -316, 93: -316, 97: -316, 111: -316, 115: -316, 132: -316, 134: -316, 135: -316, 136: -316, 161: -316, 172: -316, 173: 126, 174: -316, 175: -316, 178: -316, 179: -316, 180: -316, 192: -316, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -318, 6: -318, 38: -318, 42: -318, 43: -318, 56: 108, 58: -318, 75: -318, 82: -318, 93: -318, 97: -318, 111: -318, 115: -318, 132: -318, 134: -318, 135: -318, 136: -318, 161: -318, 172: -318, 173: 126, 174: -318, 175: -318, 178: -318, 179: -318, 180: -318, 192: -318, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 6: -97, 42: -97, 43: -97, 56: 108, 82: -97, 132: 668, 135: -97, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 669, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -204, 6: -204, 36: -204, 38: -204, 41: -204, 42: -204, 43: -204, 44: -204, 45: -204, 56: -204, 57: -204, 58: -204, 69: -204, 70: -204, 75: -204, 82: -204, 93: -204, 97: -204, 106: -204, 107: -204, 108: -204, 109: -204, 110: -204, 111: -204, 112: -204, 115: -204, 125: -204, 132: -204, 134: -204, 135: -204, 136: -204, 153: -204, 154: -204, 161: -204, 172: -204, 174: -204, 175: -204, 178: -204, 179: -204, 180: -204, 192: -204, 193: -204, 198: -204, 199: -204, 202: -204, 203: -204, 204: -204, 205: -204, 206: -204, 207: -204, 208: -204, 209: -204, 210: -204, 211: -204, 212: -204, 213: -204, 214: -204 }, { 35: 264, 54: 261, 55: 248, 58: 268, 59: 104, 65: 265, 66: 262, 67: 100, 68: 101, 69: 105, 70: 106, 90: 670, 91: 562, 92: 267, 94: 259, 95: 266, 96: 260 }, { 6: -205, 35: 264, 42: -205, 43: -205, 54: 261, 55: 248, 58: 268, 59: 104, 65: 265, 66: 262, 67: 100, 68: 101, 69: 105, 70: 106, 82: -205, 90: 263, 91: 562, 92: 267, 94: 259, 95: 266, 96: 260, 135: -205, 138: 671 }, { 6: -207, 42: -207, 43: -207, 82: -207, 135: -207 }, { 6: -95, 42: -95, 43: -95, 82: -95, 93: 672, 135: -95 }, { 6: -99, 42: -99, 43: -99, 56: 108, 82: -99, 132: 127, 135: -99, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 673, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: -105, 42: -105, 43: -105, 82: -105, 93: -105, 135: -105 }, { 56: 108, 97: 674, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 36: 245, 104: 675 }, { 36: 245, 104: 676 }, { 55: 248, 65: 677 }, { 55: 248, 65: 678 }, { 6: -123, 36: -123, 42: -123, 43: -123, 55: 248, 65: 679, 82: -123, 106: -123, 107: -123, 108: -123, 109: -123, 110: -123, 112: -123, 135: -123, 154: -123 }, { 6: -124, 36: -124, 42: -124, 43: -124, 55: 248, 65: 680, 82: -124, 106: -124, 107: -124, 108: -124, 109: -124, 110: -124, 112: -124, 135: -124, 154: -124 }, { 7: 681, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 682, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 110: 683 }, { 36: 245, 104: 684 }, { 6: -116, 36: -116, 42: -116, 43: -116, 82: -116, 106: -116, 107: -116, 108: -116, 109: -116, 110: -116, 112: -116, 135: -116, 154: -116 }, { 69: -76, 70: -76, 72: -76, 74: -76 }, { 6: 107, 43: 685 }, { 1: -407, 6: -407, 38: -407, 42: -407, 43: -407, 56: 108, 58: -407, 75: -407, 82: -407, 93: -407, 97: -407, 111: -407, 115: -407, 132: -407, 134: -407, 135: -407, 136: -407, 161: -407, 172: -407, 173: 126, 174: -407, 175: -407, 178: -407, 179: -407, 180: -407, 192: -407, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -340, 6: -340, 38: -340, 42: -340, 43: -340, 56: 108, 58: -340, 75: -340, 82: -340, 93: -340, 97: -340, 111: -340, 115: -340, 132: -340, 134: -340, 135: -340, 136: 686, 161: -340, 172: -340, 173: 126, 174: -340, 175: -340, 178: -340, 179: 687, 180: -340, 192: -340, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -345, 6: -345, 38: -345, 42: -345, 43: -345, 56: 108, 58: -345, 75: -345, 82: -345, 93: -345, 97: -345, 111: -345, 115: -345, 132: -345, 134: -345, 135: -345, 136: 688, 161: -345, 172: -345, 173: 126, 174: -345, 175: -345, 178: -345, 179: -345, 180: -345, 192: -345, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -349, 6: -349, 38: -349, 42: -349, 43: -349, 56: 108, 58: -349, 75: -349, 82: -349, 93: -349, 97: -349, 111: -349, 115: -349, 132: -349, 134: -349, 135: -349, 136: 689, 161: -349, 172: -349, 173: 126, 174: -349, 175: -349, 178: -349, 179: -349, 180: -349, 192: -349, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 690, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 691, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -354, 6: -354, 38: -354, 42: -354, 43: -354, 56: 108, 58: -354, 75: -354, 82: -354, 93: -354, 97: -354, 111: -354, 115: -354, 132: -354, 134: -354, 135: -354, 136: -354, 161: -354, 172: -354, 173: 126, 174: -354, 175: -354, 178: -354, 179: -354, 180: -354, 192: -354, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 43: -276, 56: 108, 111: -276, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 111: 692 }, { 111: 693 }, { 56: 108, 111: -82, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -167, 6: -167, 36: -167, 38: -167, 41: -167, 42: -167, 43: -167, 44: -167, 45: -167, 56: -167, 57: -167, 58: -167, 69: -167, 70: -167, 75: -167, 82: -167, 93: -167, 97: -167, 106: -167, 107: -167, 108: -167, 109: -167, 110: -167, 111: -167, 112: -167, 115: -167, 125: -167, 132: -167, 134: -167, 135: -167, 136: -167, 140: -167, 153: -167, 154: -167, 161: -167, 172: -167, 174: -167, 175: -167, 178: -167, 179: -167, 180: -167, 192: -167, 193: -167, 198: -167, 199: -167, 200: -167, 201: -167, 202: -167, 203: -167, 204: -167, 205: -167, 206: -167, 207: -167, 208: -167, 209: -167, 210: -167, 211: -167, 212: -167, 213: -167, 214: -167, 215: -167 }, { 43: 694, 56: 108, 58: 313, 132: 127, 160: 451, 161: 312, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 43: 695 }, { 1: -169, 6: -169, 36: -169, 38: -169, 41: -169, 42: -169, 43: -169, 44: -169, 45: -169, 56: -169, 57: -169, 58: -169, 69: -169, 70: -169, 75: -169, 82: -169, 93: -169, 97: -169, 106: -169, 107: -169, 108: -169, 109: -169, 110: -169, 111: -169, 112: -169, 115: -169, 125: -169, 132: -169, 134: -169, 135: -169, 136: -169, 140: -169, 153: -169, 154: -169, 161: -169, 172: -169, 174: -169, 175: -169, 178: -169, 179: -169, 180: -169, 192: -169, 193: -169, 198: -169, 199: -169, 200: -169, 201: -169, 202: -169, 203: -169, 204: -169, 205: -169, 206: -169, 207: -169, 208: -169, 209: -169, 210: -169, 211: -169, 212: -169, 213: -169, 214: -169, 215: -169 }, { 1: -171, 6: -171, 36: -171, 38: -171, 41: -171, 42: -171, 43: -171, 44: -171, 45: -171, 56: -171, 57: -171, 58: -171, 69: -171, 70: -171, 75: -171, 82: -171, 93: -171, 97: -171, 106: -171, 107: -171, 108: -171, 109: -171, 110: -171, 111: -171, 112: -171, 115: -171, 125: -171, 132: -171, 134: -171, 135: -171, 136: -171, 140: -171, 153: -171, 154: -171, 161: -171, 172: -171, 174: -171, 175: -171, 178: -171, 179: -171, 180: -171, 192: -171, 193: -171, 198: -171, 199: -171, 200: -171, 201: -171, 202: -171, 203: -171, 204: -171, 205: -171, 206: -171, 207: -171, 208: -171, 209: -171, 210: -171, 211: -171, 212: -171, 213: -171, 214: -171, 215: -171 }, { 43: 696, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 111: 697 }, { 1: -181, 6: -181, 36: -181, 38: -181, 41: -181, 42: -181, 43: -181, 44: -181, 45: -181, 56: -181, 57: -181, 58: -181, 69: -181, 70: -181, 75: -181, 82: -181, 93: -181, 97: -181, 106: -181, 107: -181, 108: -181, 109: -181, 110: -181, 111: -181, 112: -181, 115: -181, 125: -181, 132: -181, 134: -181, 135: -181, 136: -181, 140: -181, 153: -181, 154: -181, 161: -181, 172: -181, 174: -181, 175: -181, 178: -181, 179: -181, 180: -181, 192: -181, 193: -181, 198: -181, 199: -181, 200: -181, 201: -181, 202: -181, 203: -181, 204: -181, 205: -181, 206: -181, 207: -181, 208: -181, 209: -181, 210: -181, 211: -181, 212: -181, 213: -181, 214: -181, 215: -181 }, { 43: 698, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -94, 6: -94, 38: -94, 42: -94, 43: -94, 56: -94, 58: -94, 75: -94, 82: -94, 93: -94, 97: -94, 111: -94, 115: -94, 132: -94, 134: -94, 135: -94, 136: -94, 161: -94, 172: -94, 174: -94, 175: -94, 178: -94, 179: -94, 180: -94, 192: -94, 193: -94, 198: -94, 199: -94, 202: -94, 203: -94, 204: -94, 205: -94, 206: -94, 207: -94, 208: -94, 209: -94, 210: -94, 211: -94, 212: -94, 213: -94, 214: -94 }, { 1: -37, 6: -37, 38: -37, 42: -37, 43: -37, 56: -37, 58: -37, 75: -37, 82: -37, 93: -37, 97: -37, 111: -37, 115: -37, 132: -37, 134: -37, 135: -37, 136: -37, 161: -37, 172: -37, 174: -37, 175: -37, 178: -37, 179: -37, 180: -37, 192: -37, 193: -37, 198: -37, 199: -37, 202: -37, 203: -37, 204: -37, 205: -37, 206: -37, 207: -37, 208: -37, 209: -37, 210: -37, 211: -37, 212: -37, 213: -37, 214: -37 }, { 1: -40, 6: -40, 38: -40, 42: -40, 43: -40, 56: -40, 58: -40, 75: -40, 82: -40, 93: -40, 97: -40, 111: -40, 115: -40, 132: -40, 134: -40, 135: -40, 136: -40, 161: -40, 172: -40, 174: -40, 175: -40, 178: -40, 179: -40, 180: -40, 192: -40, 193: -40, 198: -40, 199: -40, 202: -40, 203: -40, 204: -40, 205: -40, 206: -40, 207: -40, 208: -40, 209: -40, 210: -40, 211: -40, 212: -40, 213: -40, 214: -40 }, { 1: -43, 6: -43, 38: -43, 42: -43, 43: -43, 56: -43, 58: -43, 75: -43, 82: -43, 93: -43, 97: -43, 111: -43, 115: -43, 132: -43, 134: -43, 135: -43, 136: -43, 161: -43, 172: -43, 174: -43, 175: -43, 178: -43, 179: -43, 180: -43, 192: -43, 193: -43, 198: -43, 199: -43, 202: -43, 203: -43, 204: -43, 205: -43, 206: -43, 207: -43, 208: -43, 209: -43, 210: -43, 211: -43, 212: -43, 213: -43, 214: -43 }, { 1: -132, 6: -132, 36: -132, 38: -132, 42: -132, 43: -132, 56: -132, 58: -132, 69: -132, 70: -132, 75: -132, 82: -132, 93: -132, 97: -132, 106: -132, 107: -132, 108: -132, 109: -132, 110: -132, 111: -132, 112: -132, 115: -132, 125: -132, 132: -132, 134: -132, 135: -132, 136: -132, 153: -132, 154: -132, 161: -132, 172: -132, 174: -132, 175: -132, 178: -132, 179: -132, 180: -132, 192: -132, 193: -132, 198: -132, 199: -132, 202: -132, 203: -132, 204: -132, 205: -132, 206: -132, 207: -132, 208: -132, 209: -132, 210: -132, 211: -132, 212: -132, 213: -132, 214: -132 }, { 1: -134, 6: -134, 38: -134, 42: -134, 43: -134, 75: -134, 82: -134, 97: -134, 172: -134 }, { 6: -143, 38: -143, 42: -143, 43: -143, 82: -143, 115: -143 }, { 6: -138, 38: -138, 42: -138, 43: -138, 82: 336, 97: -138, 118: 699, 135: -138 }, { 39: 603, 42: 163 }, { 1: -409, 6: -409, 38: -409, 42: -409, 43: -409, 56: -409, 58: -409, 75: -409, 82: -409, 93: -409, 97: -409, 111: -409, 115: -409, 132: -409, 134: -409, 135: -409, 136: -409, 161: -409, 172: -409, 174: -409, 175: -409, 178: -409, 179: -409, 180: -409, 192: -409, 193: -409, 198: -409, 199: -409, 202: -409, 203: -409, 204: -409, 205: -409, 206: -409, 207: -409, 208: -409, 209: -409, 210: -409, 211: -409, 212: -409, 213: -409, 214: -409 }, { 1: -48, 6: -48, 38: -48, 42: -48, 43: -48, 56: -48, 58: -48, 75: -48, 82: -48, 93: -48, 97: -48, 111: -48, 115: -48, 132: -48, 134: -48, 135: -48, 136: -48, 161: -48, 172: -48, 174: -48, 175: -48, 178: -48, 179: -48, 180: -48, 192: -48, 193: -48, 198: -48, 199: -48, 202: -48, 203: -48, 204: -48, 205: -48, 206: -48, 207: -48, 208: -48, 209: -48, 210: -48, 211: -48, 212: -48, 213: -48, 214: -48 }, { 6: -51, 7: 487, 8: 488, 9: 489, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 43: -51, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 52: 700, 53: 490, 54: 491, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -69, 6: -56, 36: -69, 38: -69, 41: -69, 42: -69, 43: -56, 44: -69, 45: -69, 56: 701, 57: 702, 58: -69, 69: -69, 70: -69, 75: -69, 82: -69, 93: -69, 97: -69, 106: -69, 107: -69, 108: -69, 109: -69, 110: -69, 111: -69, 112: -69, 115: -69, 125: -69, 132: -69, 134: -69, 135: -69, 136: -69, 140: -69, 153: -69, 154: -69, 161: -69, 172: -69, 174: -69, 175: -69, 178: -69, 179: -69, 180: -69, 192: -69, 193: -69, 198: -69, 199: -69, 200: -69, 201: -69, 202: -69, 203: -69, 204: -69, 205: -69, 206: -69, 207: -69, 208: -69, 209: -69, 210: -69, 211: -69, 212: -69, 213: -69, 214: -69, 215: -69 }, { 59: 703 }, { 1: -368, 6: -368, 38: -368, 42: -368, 43: -368, 56: -368, 58: -368, 75: -368, 82: -368, 93: -368, 97: -368, 111: -368, 115: -368, 132: -368, 134: -368, 135: -368, 136: -368, 161: -368, 172: -368, 174: -368, 175: -368, 178: -368, 179: -368, 180: -368, 185: -368, 192: -368, 193: -368, 198: -368, 199: -368, 202: -368, 203: -368, 204: -368, 205: -368, 206: -368, 207: -368, 208: -368, 209: -368, 210: -368, 211: -368, 212: -368, 213: -368, 214: -368 }, { 1: -307, 6: -307, 38: -307, 42: -307, 43: -307, 56: -307, 58: -307, 75: -307, 82: -307, 93: -307, 97: -307, 111: -307, 115: -307, 132: -307, 134: -307, 135: -307, 136: -307, 161: -307, 172: -307, 174: -307, 175: -307, 178: -307, 179: -307, 180: -307, 192: -307, 193: -307, 198: -307, 199: -307, 202: -307, 203: -307, 204: -307, 205: -307, 206: -307, 207: -307, 208: -307, 209: -307, 210: -307, 211: -307, 212: -307, 213: -307, 214: -307 }, { 1: -308, 6: -308, 38: -308, 42: -308, 43: -308, 56: -308, 58: -308, 75: -308, 82: -308, 93: -308, 97: -308, 111: -308, 115: -308, 132: -308, 134: -308, 135: -308, 136: -308, 161: -308, 168: -308, 172: -308, 174: -308, 175: -308, 178: -308, 179: -308, 180: -308, 192: -308, 193: -308, 198: -308, 199: -308, 202: -308, 203: -308, 204: -308, 205: -308, 206: -308, 207: -308, 208: -308, 209: -308, 210: -308, 211: -308, 212: -308, 213: -308, 214: -308 }, { 1: -309, 6: -309, 38: -309, 42: -309, 43: -309, 56: -309, 58: -309, 75: -309, 82: -309, 93: -309, 97: -309, 111: -309, 115: -309, 132: -309, 134: -309, 135: -309, 136: -309, 161: -309, 168: -309, 172: -309, 174: -309, 175: -309, 178: -309, 179: -309, 180: -309, 192: -309, 193: -309, 198: -309, 199: -309, 202: -309, 203: -309, 204: -309, 205: -309, 206: -309, 207: -309, 208: -309, 209: -309, 210: -309, 211: -309, 212: -309, 213: -309, 214: -309 }, { 1: -325, 6: -325, 38: -325, 42: -325, 43: -325, 56: -325, 58: -325, 75: -325, 82: -325, 93: -325, 97: -325, 111: -325, 115: -325, 132: -325, 134: -325, 135: -325, 136: -325, 161: -325, 172: -325, 174: -325, 175: -325, 178: -325, 179: -325, 180: -325, 192: -325, 193: -325, 198: -325, 199: -325, 202: -325, 203: -325, 204: -325, 205: -325, 206: -325, 207: -325, 208: -325, 209: -325, 210: -325, 211: -325, 212: -325, 213: -325, 214: -325 }, { 7: 704, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 705, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -330, 6: -330, 38: -330, 42: -330, 43: -330, 56: -330, 58: -330, 75: -330, 82: -330, 93: -330, 97: -330, 111: -330, 115: -330, 132: -330, 134: -330, 135: -330, 136: -330, 161: -330, 172: -330, 174: -330, 175: -330, 178: -330, 179: -330, 180: -330, 192: -330, 193: -330, 198: -330, 199: -330, 202: -330, 203: -330, 204: -330, 205: -330, 206: -330, 207: -330, 208: -330, 209: -330, 210: -330, 211: -330, 212: -330, 213: -330, 214: -330 }, { 7: 706, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -334, 6: -334, 38: -334, 42: -334, 43: -334, 56: -334, 58: -334, 75: -334, 82: -334, 93: -334, 97: -334, 111: -334, 115: -334, 132: -334, 134: -334, 135: -334, 136: -334, 161: -334, 172: -334, 174: -334, 175: -334, 178: -334, 179: -334, 180: -334, 192: -334, 193: -334, 198: -334, 199: -334, 202: -334, 203: -334, 204: -334, 205: -334, 206: -334, 207: -334, 208: -334, 209: -334, 210: -334, 211: -334, 212: -334, 213: -334, 214: -334 }, { 7: 707, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 39: 708, 42: 163, 56: 108, 132: 127, 136: 709, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 39: 710, 42: 163, 56: 108, 132: 127, 136: 711, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -339, 6: -339, 38: -339, 42: -339, 43: -339, 56: -339, 58: -339, 75: -339, 82: -339, 93: -339, 97: -339, 111: -339, 115: -339, 132: -339, 134: -339, 135: -339, 136: -339, 161: -339, 172: -339, 174: -339, 175: -339, 178: -339, 179: -339, 180: -339, 192: -339, 193: -339, 198: -339, 199: -339, 202: -339, 203: -339, 204: -339, 205: -339, 206: -339, 207: -339, 208: -339, 209: -339, 210: -339, 211: -339, 212: -339, 213: -339, 214: -339 }, { 1: -359, 6: -359, 38: -359, 42: -359, 43: -359, 56: -359, 58: -359, 75: -359, 82: -359, 93: -359, 97: -359, 111: -359, 115: -359, 132: -359, 134: -359, 135: -359, 136: -359, 161: -359, 172: -359, 174: -359, 175: -359, 178: -359, 179: -359, 180: -359, 192: -359, 193: -359, 198: -359, 199: -359, 202: -359, 203: -359, 204: -359, 205: -359, 206: -359, 207: -359, 208: -359, 209: -359, 210: -359, 211: -359, 212: -359, 213: -359, 214: -359 }, { 39: 712, 42: 163 }, { 43: 713 }, { 6: 714, 43: -365, 185: -365, 187: -365 }, { 7: 715, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -217, 6: -217, 38: -217, 42: -217, 43: -217, 56: -217, 58: -217, 75: -217, 82: -217, 93: -217, 97: -217, 111: -217, 115: -217, 132: -217, 134: -217, 135: -217, 136: -217, 161: -217, 172: -217, 174: -217, 175: -217, 178: -217, 179: -217, 180: -217, 192: -217, 193: -217, 198: -217, 199: -217, 202: -217, 203: -217, 204: -217, 205: -217, 206: -217, 207: -217, 208: -217, 209: -217, 210: -217, 211: -217, 212: -217, 213: -217, 214: -217 }, { 39: 716, 42: 163 }, { 68: 717, 69: 105, 70: 106 }, { 6: -138, 38: -138, 42: -138, 43: -138, 82: 524, 97: -138, 118: 718, 135: -138 }, { 1: -221, 6: -221, 38: -221, 42: -221, 43: -221, 75: -221, 82: -221, 97: -221, 172: -221, 174: -221, 175: -221, 192: -221, 193: -221 }, { 64: 719 }, { 35: 384, 59: 104, 145: 720, 147: 385 }, { 35: 384, 42: 383, 59: 104, 144: 721, 145: 382, 147: 385 }, { 6: -226, 42: -226, 43: -226, 82: -226, 135: -226 }, { 6: 638, 42: 639, 43: 722 }, { 6: -231, 42: -231, 43: -231, 82: -231, 135: -231 }, { 6: -233, 42: -233, 43: -233, 82: -233, 135: -233 }, { 1: -246, 6: -246, 38: -246, 42: -246, 43: -246, 75: -246, 82: -246, 97: -246, 172: -246, 174: -246, 175: -246, 192: -246, 193: -246 }, { 1: -237, 6: -237, 38: -237, 42: -237, 43: -237, 64: 723, 75: -237, 82: -237, 97: -237, 172: -237, 174: -237, 175: -237, 192: -237, 193: -237 }, { 35: 391, 59: 104, 147: 392, 152: 724 }, { 35: 391, 42: 390, 59: 104, 147: 392, 150: 725, 152: 389 }, { 6: -249, 42: -249, 43: -249, 82: -249, 135: -249 }, { 6: 646, 42: 647, 43: 726 }, { 6: -254, 42: -254, 43: -254, 82: -254, 135: -254 }, { 6: -255, 42: -255, 43: -255, 82: -255, 135: -255 }, { 6: -257, 42: -257, 43: -257, 82: -257, 135: -257 }, { 1: -241, 6: -241, 38: -241, 42: -241, 43: -241, 56: 108, 75: -241, 82: -241, 97: -241, 132: 127, 172: -241, 173: 126, 174: -241, 175: -241, 192: -241, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 43: 727, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -244, 6: -244, 38: -244, 42: -244, 43: -244, 75: -244, 82: -244, 97: -244, 172: -244, 174: -244, 175: -244, 192: -244, 193: -244 }, { 1: -314, 6: -314, 36: -314, 38: -314, 42: -314, 43: -314, 56: -314, 58: -314, 69: -314, 70: -314, 75: -314, 82: -314, 93: -314, 97: -314, 106: -314, 107: -314, 108: -314, 109: -314, 110: -314, 111: -314, 112: -314, 115: -314, 125: -314, 132: -314, 134: -314, 135: -314, 136: -314, 153: -314, 154: -314, 161: -314, 172: -314, 174: -314, 175: -314, 178: -314, 179: -314, 180: -314, 192: -314, 193: -314, 198: -314, 199: -314, 202: -314, 203: -314, 204: -314, 205: -314, 206: -314, 207: -314, 208: -314, 209: -314, 210: -314, 211: -314, 212: -314, 213: -314, 214: -314 }, { 1: -275, 6: -275, 36: -275, 38: -275, 42: -275, 43: -275, 56: -275, 58: -275, 69: -275, 70: -275, 75: -275, 82: -275, 93: -275, 97: -275, 106: -275, 107: -275, 108: -275, 109: -275, 110: -275, 111: -275, 112: -275, 115: -275, 125: -275, 132: -275, 134: -275, 135: -275, 136: -275, 153: -275, 154: -275, 161: -275, 172: -275, 174: -275, 175: -275, 178: -275, 179: -275, 180: -275, 192: -275, 193: -275, 198: -275, 199: -275, 202: -275, 203: -275, 204: -275, 205: -275, 206: -275, 207: -275, 208: -275, 209: -275, 210: -275, 211: -275, 212: -275, 213: -275, 214: -275 }, { 6: -138, 38: -138, 42: -138, 43: -138, 82: 404, 97: -138, 118: 405, 135: -138, 159: 728 }, { 6: -291, 42: -291, 43: -291, 82: -291, 97: -291 }, { 6: -292, 42: -292, 43: -292, 82: -292, 97: -292 }, { 111: 729 }, { 1: -266, 6: -266, 36: -266, 38: -266, 42: -266, 43: -266, 56: -266, 58: -266, 69: -266, 70: -266, 75: -266, 80: -266, 82: -266, 93: -266, 97: -266, 106: -266, 107: -266, 108: -266, 109: -266, 110: -266, 111: -266, 112: -266, 115: -266, 125: -266, 132: -266, 134: -266, 135: -266, 136: -266, 153: -266, 154: -266, 161: -266, 172: -266, 174: -266, 175: -266, 178: -266, 179: -266, 180: -266, 192: -266, 193: -266, 198: -266, 199: -266, 202: -266, 203: -266, 204: -266, 205: -266, 206: -266, 207: -266, 208: -266, 209: -266, 210: -266, 211: -266, 212: -266, 213: -266, 214: -266 }, { 7: 340, 8: 239, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 58: 241, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 122: 240, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 162: 730, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 340, 8: 239, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 416, 46: 53, 47: 43, 48: 54, 49: 55, 50: 56, 54: 87, 58: 241, 59: 104, 60: 27, 61: 28, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 42, 116: 90, 117: 91, 121: 72, 122: 240, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 155: 731, 156: 86, 162: 415, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 44, 195: 45, 196: 68, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: -281, 38: -281, 42: -281, 43: -281, 82: -281 }, { 6: 663, 42: 664, 43: 732 }, { 1: -370, 6: -370, 38: -370, 42: -370, 43: -370, 56: -370, 58: -370, 75: -370, 82: -370, 93: -370, 97: -370, 111: -370, 115: -370, 132: -370, 134: -370, 135: -370, 136: -370, 161: -370, 172: -370, 174: -370, 175: -370, 178: -370, 179: -370, 180: -370, 192: -370, 193: -370, 198: -370, 199: -370, 202: -370, 203: -370, 204: -370, 205: -370, 206: -370, 207: -370, 208: -370, 209: -370, 210: -370, 211: -370, 212: -370, 213: -370, 214: -370 }, { 35: 155, 54: 159, 59: 104, 63: 158, 95: 156, 96: 83, 120: 200, 121: 157, 126: 296, 131: 99, 133: 733, 137: 734, 181: 295, 182: 199 }, { 43: 735, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 6: -208, 42: -208, 43: -208, 82: -208, 135: -208 }, { 6: -138, 38: -138, 42: -138, 43: -138, 82: 425, 97: -138, 118: 736, 135: -138 }, { 7: 737, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 557, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 43: 738, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 6: -106, 42: -106, 43: -106, 82: -106, 93: -106, 135: -106 }, { 6: -117, 36: -117, 42: -117, 43: -117, 82: -117, 106: -117, 107: -117, 108: -117, 109: -117, 110: -117, 112: -117, 135: -117, 154: -117 }, { 6: -118, 36: -118, 42: -118, 43: -118, 82: -118, 106: -118, 107: -118, 108: -118, 109: -118, 110: -118, 112: -118, 135: -118, 154: -118 }, { 6: -119, 36: -119, 42: -119, 43: -119, 82: -119, 106: -119, 107: -119, 108: -119, 109: -119, 110: -119, 112: -119, 135: -119, 154: -119 }, { 6: -120, 36: -120, 42: -120, 43: -120, 82: -120, 106: -120, 107: -120, 108: -120, 109: -120, 110: -120, 112: -120, 135: -120, 154: -120 }, { 6: -121, 36: -121, 42: -121, 43: -121, 82: -121, 106: -121, 107: -121, 108: -121, 109: -121, 110: -121, 112: -121, 135: -121, 154: -121 }, { 6: -122, 36: -122, 42: -122, 43: -122, 82: -122, 106: -122, 107: -122, 108: -122, 109: -122, 110: -122, 112: -122, 135: -122, 154: -122 }, { 56: 108, 111: 739, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 740, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 741, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 42: 742, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: -115, 36: -115, 42: -115, 43: -115, 82: -115, 106: -115, 107: -115, 108: -115, 109: -115, 110: -115, 112: -115, 135: -115, 154: -115 }, { 75: 743 }, { 7: 744, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 745, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 746, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 747, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -347, 6: -347, 38: -347, 42: -347, 43: -347, 56: 108, 58: -347, 75: -347, 82: -347, 93: -347, 97: -347, 111: -347, 115: -347, 132: -347, 134: -347, 135: -347, 136: 748, 161: -347, 172: -347, 173: 126, 174: -347, 175: -347, 178: -347, 179: -347, 180: -347, 192: -347, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -351, 6: -351, 38: -351, 42: -351, 43: -351, 56: 108, 58: -351, 75: -351, 82: -351, 93: -351, 97: -351, 111: -351, 115: -351, 132: -351, 134: -351, 135: -351, 136: 749, 161: -351, 172: -351, 173: 126, 174: -351, 175: -351, 178: -351, 179: -351, 180: -351, 192: -351, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -163, 6: -163, 36: -163, 38: -163, 41: -163, 42: -163, 43: -163, 44: -163, 45: -163, 56: -163, 57: -163, 58: -163, 69: -163, 70: -163, 75: -163, 82: -163, 93: -163, 97: -163, 106: -163, 107: -163, 108: -163, 109: -163, 110: -163, 111: -163, 112: -163, 115: -163, 125: -163, 132: -163, 134: -163, 135: -163, 136: -163, 140: -163, 153: -163, 154: -163, 161: -163, 172: -163, 174: -163, 175: -163, 178: -163, 179: -163, 180: -163, 192: -163, 193: -163, 198: -163, 199: -163, 200: -163, 201: -163, 202: -163, 203: -163, 204: -163, 205: -163, 206: -163, 207: -163, 208: -163, 209: -163, 210: -163, 211: -163, 212: -163, 213: -163, 214: -163, 215: -163 }, { 1: -165, 6: -165, 36: -165, 38: -165, 41: -165, 42: -165, 43: -165, 44: -165, 45: -165, 56: -165, 57: -165, 58: -165, 69: -165, 70: -165, 75: -165, 82: -165, 93: -165, 97: -165, 106: -165, 107: -165, 108: -165, 109: -165, 110: -165, 111: -165, 112: -165, 115: -165, 125: -165, 132: -165, 134: -165, 135: -165, 136: -165, 140: -165, 153: -165, 154: -165, 161: -165, 172: -165, 174: -165, 175: -165, 178: -165, 179: -165, 180: -165, 192: -165, 193: -165, 198: -165, 199: -165, 200: -165, 201: -165, 202: -165, 203: -165, 204: -165, 205: -165, 206: -165, 207: -165, 208: -165, 209: -165, 210: -165, 211: -165, 212: -165, 213: -165, 214: -165, 215: -165 }, { 111: 750 }, { 111: 751 }, { 111: 752 }, { 1: -180, 6: -180, 36: -180, 38: -180, 41: -180, 42: -180, 43: -180, 44: -180, 45: -180, 56: -180, 57: -180, 58: -180, 69: -180, 70: -180, 75: -180, 82: -180, 93: -180, 97: -180, 106: -180, 107: -180, 108: -180, 109: -180, 110: -180, 111: -180, 112: -180, 115: -180, 125: -180, 132: -180, 134: -180, 135: -180, 136: -180, 140: -180, 153: -180, 154: -180, 161: -180, 172: -180, 174: -180, 175: -180, 178: -180, 179: -180, 180: -180, 192: -180, 193: -180, 198: -180, 199: -180, 200: -180, 201: -180, 202: -180, 203: -180, 204: -180, 205: -180, 206: -180, 207: -180, 208: -180, 209: -180, 210: -180, 211: -180, 212: -180, 213: -180, 214: -180, 215: -180 }, { 111: 753 }, { 6: 477, 42: 478, 43: 754 }, { 6: -50, 43: -50 }, { 6: -57, 43: -57 }, { 7: 755, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: -59, 43: -59 }, { 39: 756, 42: 163, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 179: 757, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 39: 758, 42: 163, 56: 108, 132: 127, 136: 759, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 39: 760, 42: 163, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 39: 761, 42: 163, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -332, 6: -332, 38: -332, 42: -332, 43: -332, 56: -332, 58: -332, 75: -332, 82: -332, 93: -332, 97: -332, 111: -332, 115: -332, 132: -332, 134: -332, 135: -332, 136: -332, 161: -332, 172: -332, 174: -332, 175: -332, 178: -332, 179: -332, 180: -332, 192: -332, 193: -332, 198: -332, 199: -332, 202: -332, 203: -332, 204: -332, 205: -332, 206: -332, 207: -332, 208: -332, 209: -332, 210: -332, 211: -332, 212: -332, 213: -332, 214: -332 }, { 7: 762, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -336, 6: -336, 38: -336, 42: -336, 43: -336, 56: -336, 58: -336, 75: -336, 82: -336, 93: -336, 97: -336, 111: -336, 115: -336, 132: -336, 134: -336, 135: -336, 136: -336, 161: -336, 172: -336, 174: -336, 175: -336, 178: -336, 179: -336, 180: -336, 192: -336, 193: -336, 198: -336, 199: -336, 202: -336, 203: -336, 204: -336, 205: -336, 206: -336, 207: -336, 208: -336, 209: -336, 210: -336, 211: -336, 212: -336, 213: -336, 214: -336 }, { 7: 763, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 43: 764 }, { 1: -362, 6: -362, 38: -362, 42: -362, 43: -362, 56: -362, 58: -362, 75: -362, 82: -362, 93: -362, 97: -362, 111: -362, 115: -362, 132: -362, 134: -362, 135: -362, 136: -362, 161: -362, 172: -362, 174: -362, 175: -362, 178: -362, 179: -362, 180: -362, 192: -362, 193: -362, 198: -362, 199: -362, 202: -362, 203: -362, 204: -362, 205: -362, 206: -362, 207: -362, 208: -362, 209: -362, 210: -362, 211: -362, 212: -362, 213: -362, 214: -362 }, { 43: -366, 185: -366, 187: -366 }, { 42: -303, 56: 108, 82: -303, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -33, 6: -33, 38: -33, 42: -33, 43: -33, 56: -33, 58: -33, 75: -33, 82: -33, 93: -33, 97: -33, 111: -33, 115: -33, 132: -33, 134: -33, 135: -33, 136: -33, 161: -33, 172: -33, 174: -33, 175: -33, 178: -33, 179: -33, 180: -33, 192: -33, 193: -33, 198: -33, 199: -33, 202: -33, 203: -33, 204: -33, 205: -33, 206: -33, 207: -33, 208: -33, 209: -33, 210: -33, 211: -33, 212: -33, 213: -33, 214: -33 }, { 1: -223, 6: -223, 38: -223, 42: -223, 43: -223, 75: -223, 82: -223, 97: -223, 172: -223, 174: -223, 175: -223, 192: -223, 193: -223 }, { 6: 638, 42: 639, 135: 765 }, { 68: 766, 69: 105, 70: 106 }, { 6: -227, 42: -227, 43: -227, 82: -227, 135: -227 }, { 6: -138, 38: -138, 42: -138, 43: -138, 82: 524, 97: -138, 118: 767, 135: -138 }, { 6: -228, 42: -228, 43: -228, 82: -228, 135: -228 }, { 68: 768, 69: 105, 70: 106 }, { 6: -250, 42: -250, 43: -250, 82: -250, 135: -250 }, { 6: -138, 38: -138, 42: -138, 43: -138, 82: 531, 97: -138, 118: 769, 135: -138 }, { 6: -251, 42: -251, 43: -251, 82: -251, 135: -251 }, { 1: -242, 6: -242, 38: -242, 42: -242, 43: -242, 75: -242, 82: -242, 97: -242, 172: -242, 174: -242, 175: -242, 192: -242, 193: -242 }, { 42: 543, 43: 770 }, { 1: -197, 6: -197, 36: -197, 38: -197, 42: -197, 43: -197, 56: -197, 58: -197, 69: -197, 70: -197, 75: -197, 82: -197, 93: -197, 97: -197, 106: -197, 107: -197, 108: -197, 109: -197, 110: -197, 111: -197, 112: -197, 115: -197, 125: -197, 132: -197, 134: -197, 135: -197, 136: -197, 153: -197, 154: -197, 161: -197, 172: -197, 174: -197, 175: -197, 178: -197, 179: -197, 180: -197, 192: -197, 193: -197, 198: -197, 199: -197, 202: -197, 203: -197, 204: -197, 205: -197, 206: -197, 207: -197, 208: -197, 209: -197, 210: -197, 211: -197, 212: -197, 213: -197, 214: -197 }, { 6: -282, 38: -282, 42: -282, 43: -282, 82: -282 }, { 6: -138, 38: -138, 42: -138, 43: -138, 82: 551, 97: -138, 118: 771, 135: -138 }, { 6: -283, 38: -283, 42: -283, 43: -283, 82: -283 }, { 134: 772, 178: 444, 180: 446 }, { 35: 155, 54: 159, 59: 104, 63: 158, 95: 156, 96: 160, 120: 200, 121: 157, 131: 99, 133: 773, 182: 199 }, { 6: -98, 42: -98, 43: -98, 82: -98, 135: -98 }, { 6: 559, 42: 560, 43: 774 }, { 6: -97, 42: -97, 43: -97, 56: 108, 82: -97, 132: 127, 135: -97, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 6: -100, 42: -100, 43: -100, 82: -100, 135: -100 }, { 6: -125, 36: -125, 42: -125, 43: -125, 82: -125, 106: -125, 107: -125, 108: -125, 109: -125, 110: -125, 112: -125, 135: -125, 154: -125 }, { 43: 775, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 56: 108, 111: 776, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 777, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 69: -77, 70: -77, 72: -77, 74: -77 }, { 1: -341, 6: -341, 38: -341, 42: -341, 43: -341, 56: 108, 58: -341, 75: -341, 82: -341, 93: -341, 97: -341, 111: -341, 115: -341, 132: -341, 134: -341, 135: -341, 136: -341, 161: -341, 172: -341, 173: 126, 174: -341, 175: -341, 178: -341, 179: 778, 180: -341, 192: -341, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -342, 6: -342, 38: -342, 42: -342, 43: -342, 56: 108, 58: -342, 75: -342, 82: -342, 93: -342, 97: -342, 111: -342, 115: -342, 132: -342, 134: -342, 135: -342, 136: 779, 161: -342, 172: -342, 173: 126, 174: -342, 175: -342, 178: -342, 179: -342, 180: -342, 192: -342, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -346, 6: -346, 38: -346, 42: -346, 43: -346, 56: 108, 58: -346, 75: -346, 82: -346, 93: -346, 97: -346, 111: -346, 115: -346, 132: -346, 134: -346, 135: -346, 136: -346, 161: -346, 172: -346, 173: 126, 174: -346, 175: -346, 178: -346, 179: -346, 180: -346, 192: -346, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -350, 6: -350, 38: -350, 42: -350, 43: -350, 56: 108, 58: -350, 75: -350, 82: -350, 93: -350, 97: -350, 111: -350, 115: -350, 132: -350, 134: -350, 135: -350, 136: -350, 161: -350, 172: -350, 173: 126, 174: -350, 175: -350, 178: -350, 179: -350, 180: -350, 192: -350, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 780, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 781, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -168, 6: -168, 36: -168, 38: -168, 41: -168, 42: -168, 43: -168, 44: -168, 45: -168, 56: -168, 57: -168, 58: -168, 69: -168, 70: -168, 75: -168, 82: -168, 93: -168, 97: -168, 106: -168, 107: -168, 108: -168, 109: -168, 110: -168, 111: -168, 112: -168, 115: -168, 125: -168, 132: -168, 134: -168, 135: -168, 136: -168, 140: -168, 153: -168, 154: -168, 161: -168, 172: -168, 174: -168, 175: -168, 178: -168, 179: -168, 180: -168, 192: -168, 193: -168, 198: -168, 199: -168, 200: -168, 201: -168, 202: -168, 203: -168, 204: -168, 205: -168, 206: -168, 207: -168, 208: -168, 209: -168, 210: -168, 211: -168, 212: -168, 213: -168, 214: -168, 215: -168 }, { 1: -170, 6: -170, 36: -170, 38: -170, 41: -170, 42: -170, 43: -170, 44: -170, 45: -170, 56: -170, 57: -170, 58: -170, 69: -170, 70: -170, 75: -170, 82: -170, 93: -170, 97: -170, 106: -170, 107: -170, 108: -170, 109: -170, 110: -170, 111: -170, 112: -170, 115: -170, 125: -170, 132: -170, 134: -170, 135: -170, 136: -170, 140: -170, 153: -170, 154: -170, 161: -170, 172: -170, 174: -170, 175: -170, 178: -170, 179: -170, 180: -170, 192: -170, 193: -170, 198: -170, 199: -170, 200: -170, 201: -170, 202: -170, 203: -170, 204: -170, 205: -170, 206: -170, 207: -170, 208: -170, 209: -170, 210: -170, 211: -170, 212: -170, 213: -170, 214: -170, 215: -170 }, { 1: -172, 6: -172, 36: -172, 38: -172, 41: -172, 42: -172, 43: -172, 44: -172, 45: -172, 56: -172, 57: -172, 58: -172, 69: -172, 70: -172, 75: -172, 82: -172, 93: -172, 97: -172, 106: -172, 107: -172, 108: -172, 109: -172, 110: -172, 111: -172, 112: -172, 115: -172, 125: -172, 132: -172, 134: -172, 135: -172, 136: -172, 140: -172, 153: -172, 154: -172, 161: -172, 172: -172, 174: -172, 175: -172, 178: -172, 179: -172, 180: -172, 192: -172, 193: -172, 198: -172, 199: -172, 200: -172, 201: -172, 202: -172, 203: -172, 204: -172, 205: -172, 206: -172, 207: -172, 208: -172, 209: -172, 210: -172, 211: -172, 212: -172, 213: -172, 214: -172, 215: -172 }, { 1: -182, 6: -182, 36: -182, 38: -182, 41: -182, 42: -182, 43: -182, 44: -182, 45: -182, 56: -182, 57: -182, 58: -182, 69: -182, 70: -182, 75: -182, 82: -182, 93: -182, 97: -182, 106: -182, 107: -182, 108: -182, 109: -182, 110: -182, 111: -182, 112: -182, 115: -182, 125: -182, 132: -182, 134: -182, 135: -182, 136: -182, 140: -182, 153: -182, 154: -182, 161: -182, 172: -182, 174: -182, 175: -182, 178: -182, 179: -182, 180: -182, 192: -182, 193: -182, 198: -182, 199: -182, 200: -182, 201: -182, 202: -182, 203: -182, 204: -182, 205: -182, 206: -182, 207: -182, 208: -182, 209: -182, 210: -182, 211: -182, 212: -182, 213: -182, 214: -182, 215: -182 }, { 6: -144, 38: -144, 42: -144, 43: -144, 82: -144, 115: -144 }, { 6: -58, 43: -58, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -326, 6: -326, 38: -326, 42: -326, 43: -326, 56: -326, 58: -326, 75: -326, 82: -326, 93: -326, 97: -326, 111: -326, 115: -326, 132: -326, 134: -326, 135: -326, 136: -326, 161: -326, 172: -326, 174: -326, 175: -326, 178: -326, 179: -326, 180: -326, 192: -326, 193: -326, 198: -326, 199: -326, 202: -326, 203: -326, 204: -326, 205: -326, 206: -326, 207: -326, 208: -326, 209: -326, 210: -326, 211: -326, 212: -326, 213: -326, 214: -326 }, { 7: 782, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -327, 6: -327, 38: -327, 42: -327, 43: -327, 56: -327, 58: -327, 75: -327, 82: -327, 93: -327, 97: -327, 111: -327, 115: -327, 132: -327, 134: -327, 135: -327, 136: -327, 161: -327, 172: -327, 174: -327, 175: -327, 178: -327, 179: -327, 180: -327, 192: -327, 193: -327, 198: -327, 199: -327, 202: -327, 203: -327, 204: -327, 205: -327, 206: -327, 207: -327, 208: -327, 209: -327, 210: -327, 211: -327, 212: -327, 213: -327, 214: -327 }, { 7: 783, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -331, 6: -331, 38: -331, 42: -331, 43: -331, 56: -331, 58: -331, 75: -331, 82: -331, 93: -331, 97: -331, 111: -331, 115: -331, 132: -331, 134: -331, 135: -331, 136: -331, 161: -331, 172: -331, 174: -331, 175: -331, 178: -331, 179: -331, 180: -331, 192: -331, 193: -331, 198: -331, 199: -331, 202: -331, 203: -331, 204: -331, 205: -331, 206: -331, 207: -331, 208: -331, 209: -331, 210: -331, 211: -331, 212: -331, 213: -331, 214: -331 }, { 1: -335, 6: -335, 38: -335, 42: -335, 43: -335, 56: -335, 58: -335, 75: -335, 82: -335, 93: -335, 97: -335, 111: -335, 115: -335, 132: -335, 134: -335, 135: -335, 136: -335, 161: -335, 172: -335, 174: -335, 175: -335, 178: -335, 179: -335, 180: -335, 192: -335, 193: -335, 198: -335, 199: -335, 202: -335, 203: -335, 204: -335, 205: -335, 206: -335, 207: -335, 208: -335, 209: -335, 210: -335, 211: -335, 212: -335, 213: -335, 214: -335 }, { 39: 784, 42: 163, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 39: 785, 42: 163, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -360, 6: -360, 38: -360, 42: -360, 43: -360, 56: -360, 58: -360, 75: -360, 82: -360, 93: -360, 97: -360, 111: -360, 115: -360, 132: -360, 134: -360, 135: -360, 136: -360, 161: -360, 172: -360, 174: -360, 175: -360, 178: -360, 179: -360, 180: -360, 192: -360, 193: -360, 198: -360, 199: -360, 202: -360, 203: -360, 204: -360, 205: -360, 206: -360, 207: -360, 208: -360, 209: -360, 210: -360, 211: -360, 212: -360, 213: -360, 214: -360 }, { 64: 786 }, { 1: -222, 6: -222, 38: -222, 42: -222, 43: -222, 75: -222, 82: -222, 97: -222, 172: -222, 174: -222, 175: -222, 192: -222, 193: -222 }, { 6: 638, 42: 639, 43: 787 }, { 1: -247, 6: -247, 38: -247, 42: -247, 43: -247, 75: -247, 82: -247, 97: -247, 172: -247, 174: -247, 175: -247, 192: -247, 193: -247 }, { 6: 646, 42: 647, 43: 788 }, { 6: -293, 42: -293, 43: -293, 82: -293, 97: -293 }, { 6: 663, 42: 664, 43: 789 }, { 7: 790, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 134: 791 }, { 6: -209, 42: -209, 43: -209, 82: -209, 135: -209 }, { 111: 792 }, { 6: -127, 36: -127, 42: -127, 43: -127, 82: -127, 106: -127, 107: -127, 108: -127, 109: -127, 110: -127, 112: -127, 135: -127, 154: -127 }, { 43: 793, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 794, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 7: 795, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 1: -348, 6: -348, 38: -348, 42: -348, 43: -348, 56: 108, 58: -348, 75: -348, 82: -348, 93: -348, 97: -348, 111: -348, 115: -348, 132: -348, 134: -348, 135: -348, 136: -348, 161: -348, 172: -348, 173: 126, 174: -348, 175: -348, 178: -348, 179: -348, 180: -348, 192: -348, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -352, 6: -352, 38: -352, 42: -352, 43: -352, 56: 108, 58: -352, 75: -352, 82: -352, 93: -352, 97: -352, 111: -352, 115: -352, 132: -352, 134: -352, 135: -352, 136: -352, 161: -352, 172: -352, 173: 126, 174: -352, 175: -352, 178: -352, 179: -352, 180: -352, 192: -352, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 39: 796, 42: 163, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 39: 797, 42: 163, 56: 108, 132: 127, 173: 126, 174: 96, 175: 97, 192: 124, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -333, 6: -333, 38: -333, 42: -333, 43: -333, 56: -333, 58: -333, 75: -333, 82: -333, 93: -333, 97: -333, 111: -333, 115: -333, 132: -333, 134: -333, 135: -333, 136: -333, 161: -333, 172: -333, 174: -333, 175: -333, 178: -333, 179: -333, 180: -333, 192: -333, 193: -333, 198: -333, 199: -333, 202: -333, 203: -333, 204: -333, 205: -333, 206: -333, 207: -333, 208: -333, 209: -333, 210: -333, 211: -333, 212: -333, 213: -333, 214: -333 }, { 1: -337, 6: -337, 38: -337, 42: -337, 43: -337, 56: -337, 58: -337, 75: -337, 82: -337, 93: -337, 97: -337, 111: -337, 115: -337, 132: -337, 134: -337, 135: -337, 136: -337, 161: -337, 172: -337, 174: -337, 175: -337, 178: -337, 179: -337, 180: -337, 192: -337, 193: -337, 198: -337, 199: -337, 202: -337, 203: -337, 204: -337, 205: -337, 206: -337, 207: -337, 208: -337, 209: -337, 210: -337, 211: -337, 212: -337, 213: -337, 214: -337 }, { 68: 798, 69: 105, 70: 106 }, { 6: -229, 42: -229, 43: -229, 82: -229, 135: -229 }, { 6: -252, 42: -252, 43: -252, 82: -252, 135: -252 }, { 6: -284, 38: -284, 42: -284, 43: -284, 82: -284 }, { 1: -345, 6: -345, 38: -345, 42: -345, 43: -345, 56: 108, 58: -345, 75: -345, 82: 801, 93: -345, 97: -345, 111: -345, 115: -345, 118: 799, 132: -345, 134: -345, 135: -345, 136: 800, 161: -345, 172: -345, 173: 126, 174: -345, 175: -345, 178: -345, 179: -345, 180: -345, 192: -345, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 7: 802, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: -126, 36: -126, 42: -126, 43: -126, 82: -126, 106: -126, 107: -126, 108: -126, 109: -126, 110: -126, 112: -126, 135: -126, 154: -126 }, { 111: 803 }, { 1: -343, 6: -343, 38: -343, 42: -343, 43: -343, 56: 108, 58: -343, 75: -343, 82: -343, 93: -343, 97: -343, 111: -343, 115: -343, 132: -343, 134: -343, 135: -343, 136: -343, 161: -343, 172: -343, 173: 126, 174: -343, 175: -343, 178: -343, 179: -343, 180: -343, 192: -343, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -344, 6: -344, 38: -344, 42: -344, 43: -344, 56: 108, 58: -344, 75: -344, 82: -344, 93: -344, 97: -344, 111: -344, 115: -344, 132: -344, 134: -344, 135: -344, 136: -344, 161: -344, 172: -344, 173: 126, 174: -344, 175: -344, 178: -344, 179: -344, 180: -344, 192: -344, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -328, 6: -328, 38: -328, 42: -328, 43: -328, 56: -328, 58: -328, 75: -328, 82: -328, 93: -328, 97: -328, 111: -328, 115: -328, 132: -328, 134: -328, 135: -328, 136: -328, 161: -328, 172: -328, 174: -328, 175: -328, 178: -328, 179: -328, 180: -328, 192: -328, 193: -328, 198: -328, 199: -328, 202: -328, 203: -328, 204: -328, 205: -328, 206: -328, 207: -328, 208: -328, 209: -328, 210: -328, 211: -328, 212: -328, 213: -328, 214: -328 }, { 1: -329, 6: -329, 38: -329, 42: -329, 43: -329, 56: -329, 58: -329, 75: -329, 82: -329, 93: -329, 97: -329, 111: -329, 115: -329, 132: -329, 134: -329, 135: -329, 136: -329, 161: -329, 172: -329, 174: -329, 175: -329, 178: -329, 179: -329, 180: -329, 192: -329, 193: -329, 198: -329, 199: -329, 202: -329, 203: -329, 204: -329, 205: -329, 206: -329, 207: -329, 208: -329, 209: -329, 210: -329, 211: -329, 212: -329, 213: -329, 214: -329 }, { 1: -224, 6: -224, 38: -224, 42: -224, 43: -224, 75: -224, 82: -224, 97: -224, 172: -224, 174: -224, 175: -224, 192: -224, 193: -224 }, { 135: 804 }, { 7: 805, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 6: -139, 38: -139, 42: -139, 43: -139, 97: -139, 135: -139 }, { 1: -347, 6: -347, 38: -347, 42: -347, 43: -347, 56: 108, 58: -347, 75: -347, 82: 801, 93: -347, 97: -347, 111: -347, 115: -347, 118: 806, 132: -347, 134: -347, 135: -347, 136: 807, 161: -347, 172: -347, 173: 126, 174: -347, 175: -347, 178: -347, 179: -347, 180: -347, 192: -347, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 6: -128, 36: -128, 42: -128, 43: -128, 82: -128, 106: -128, 107: -128, 108: -128, 109: -128, 110: -128, 112: -128, 135: -128, 154: -128 }, { 1: -200, 6: -200, 36: -200, 38: -200, 41: -200, 42: -200, 43: -200, 44: -200, 45: -200, 56: -200, 57: -200, 58: -200, 69: -200, 70: -200, 75: -200, 82: -200, 93: -200, 97: -200, 106: -200, 107: -200, 108: -200, 109: -200, 110: -200, 111: -200, 112: -200, 115: -200, 125: -200, 132: -200, 134: -200, 135: -200, 136: -200, 153: -200, 154: -200, 161: -200, 172: -200, 174: -200, 175: -200, 178: -200, 179: -200, 180: -200, 192: -200, 193: -200, 198: -200, 199: -200, 202: -200, 203: -200, 204: -200, 205: -200, 206: -200, 207: -200, 208: -200, 209: -200, 210: -200, 211: -200, 212: -200, 213: -200, 214: -200 }, { 1: -346, 6: -346, 38: -346, 42: -346, 43: -346, 56: 108, 58: -346, 75: -346, 82: 801, 93: -346, 97: -346, 111: -346, 115: -346, 118: 808, 132: -346, 134: -346, 135: -346, 136: -346, 161: -346, 172: -346, 173: 126, 174: -346, 175: -346, 178: -346, 179: -346, 180: -346, 192: -346, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 135: 809 }, { 7: 810, 9: 166, 10: 29, 11: 30, 12: 31, 13: 32, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 24, 32: 25, 33: 26, 34: 67, 35: 92, 40: 33, 46: 53, 47: 171, 48: 54, 49: 55, 50: 56, 54: 87, 59: 104, 62: 66, 63: 73, 66: 74, 67: 100, 68: 101, 69: 105, 70: 106, 76: 76, 77: 102, 78: 103, 79: 37, 83: 34, 84: 75, 85: 77, 86: 78, 87: 79, 88: 80, 89: 81, 95: 93, 96: 83, 99: 35, 100: 40, 101: 39, 102: 84, 105: 85, 113: 69, 114: 170, 116: 90, 117: 91, 121: 72, 123: 52, 126: 36, 127: 38, 128: 41, 129: 88, 130: 89, 131: 99, 132: 62, 139: 64, 141: 70, 149: 71, 156: 86, 166: 59, 170: 65, 171: 82, 173: 60, 174: 96, 175: 97, 176: 61, 177: 98, 181: 49, 183: 63, 188: 57, 189: 94, 190: 58, 191: 95, 194: 172, 195: 173, 196: 174, 197: 46, 198: 47, 199: 48, 200: 50, 201: 51 }, { 135: 811 }, { 1: -202, 6: -202, 36: -202, 38: -202, 41: -202, 42: -202, 43: -202, 44: -202, 45: -202, 56: -202, 57: -202, 58: -202, 69: -202, 70: -202, 75: -202, 82: -202, 93: -202, 97: -202, 106: -202, 107: -202, 108: -202, 109: -202, 110: -202, 111: -202, 112: -202, 115: -202, 125: -202, 132: -202, 134: -202, 135: -202, 136: -202, 153: -202, 154: -202, 161: -202, 172: -202, 174: -202, 175: -202, 178: -202, 179: -202, 180: -202, 192: -202, 193: -202, 198: -202, 199: -202, 202: -202, 203: -202, 204: -202, 205: -202, 206: -202, 207: -202, 208: -202, 209: -202, 210: -202, 211: -202, 212: -202, 213: -202, 214: -202 }, { 1: -348, 6: -348, 38: -348, 42: -348, 43: -348, 56: 108, 58: -348, 75: -348, 82: 801, 93: -348, 97: -348, 111: -348, 115: -348, 118: 812, 132: -348, 134: -348, 135: -348, 136: -348, 161: -348, 172: -348, 173: 126, 174: -348, 175: -348, 178: -348, 179: -348, 180: -348, 192: -348, 193: 125, 198: 110, 199: 109, 202: 111, 203: 112, 204: 113, 205: 114, 206: 115, 207: 116, 208: 117, 209: 118, 210: 119, 211: 120, 212: 121, 213: 122, 214: 123 }, { 1: -201, 6: -201, 36: -201, 38: -201, 41: -201, 42: -201, 43: -201, 44: -201, 45: -201, 56: -201, 57: -201, 58: -201, 69: -201, 70: -201, 75: -201, 82: -201, 93: -201, 97: -201, 106: -201, 107: -201, 108: -201, 109: -201, 110: -201, 111: -201, 112: -201, 115: -201, 125: -201, 132: -201, 134: -201, 135: -201, 136: -201, 153: -201, 154: -201, 161: -201, 172: -201, 174: -201, 175: -201, 178: -201, 179: -201, 180: -201, 192: -201, 193: -201, 198: -201, 199: -201, 202: -201, 203: -201, 204: -201, 205: -201, 206: -201, 207: -201, 208: -201, 209: -201, 210: -201, 211: -201, 212: -201, 213: -201, 214: -201 }, { 135: 813 }, { 1: -203, 6: -203, 36: -203, 38: -203, 41: -203, 42: -203, 43: -203, 44: -203, 45: -203, 56: -203, 57: -203, 58: -203, 69: -203, 70: -203, 75: -203, 82: -203, 93: -203, 97: -203, 106: -203, 107: -203, 108: -203, 109: -203, 110: -203, 111: -203, 112: -203, 115: -203, 125: -203, 132: -203, 134: -203, 135: -203, 136: -203, 153: -203, 154: -203, 161: -203, 172: -203, 174: -203, 175: -203, 178: -203, 179: -203, 180: -203, 192: -203, 193: -203, 198: -203, 199: -203, 202: -203, 203: -203, 204: -203, 205: -203, 206: -203, 207: -203, 208: -203, 209: -203, 210: -203, 211: -203, 212: -203, 213: -203, 214: -203 }],
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
var BUILD_DATE = "2026-01-15@18:49:23GMT";
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
