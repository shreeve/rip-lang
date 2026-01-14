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
    if (/^[∞~][=>]/.test(this.chunk) || /^=!/.test(this.chunk)) {
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
    tag = colon || prev != null && ((ref5 = prev[0]) === "." || ref5 === "?." || ref5 === "::" || ref5 === "?::" || !prev.spaced && prev[0] === "@") ? "PROPERTY" : "IDENTIFIER";
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
    } else if (value === "∞=" || value === "~=") {
      tag = "DERIVED_ASSIGN";
    } else if (value === ":=") {
      tag = "REACTIVE_ASSIGN";
    } else if (value === "=!") {
      tag = "READONLY_ASSIGN";
    } else if (value === "∞>" || value === "~>") {
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
OPERATOR = /^(?:[-=∞~]>|∞=|~=|:=|=!|===|!==|!\?|\?\?|=~|[-+*\/%<>&|^!?=]=|>>>=?|([-+:])\1|([&|<>*\/%])\2=?|\?(\.|::)|\.{2,3})/;
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
        if (indexOf.call(IMPLICIT_FUNC, tag) >= 0 && this.indexOfTag(i + 1, "INDENT") > -1 && this.looksObjectish(i + 2) && !this.findTagsBackwards(i, ["CLASS", "EXTENDS", "IF", "CATCH", "SWITCH", "LEADING_WHEN", "FOR", "WHILE", "UNTIL"]) && !(((ref1 = s = (ref2 = stackTop()) != null ? ref2[0] : undefined) === "{" || ref1 === "[") && !isImplicit(stackTop()) && this.findTagsBackwards(i, s))) {
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
CONTROL_IN_IMPLICIT = ["IF", "TRY", "FINALLY", "CATCH", "CLASS", "SWITCH"];
DISCARDED = ["(", ")", "[", "]", "{", "}", ":", ".", "..", "...", ",", "=", "++", "--", "?", "AS", "AWAIT", "CALL_START", "CALL_END", "DEFAULT", "DO", "DO_IIFE", "ELSE", "EXTENDS", "EXPORT", "FORIN", "FOROF", "FORFROM", "IMPORT", "INDENT", "INDEX_SOAK", "INTERPOLATION_START", "INTERPOLATION_END", "LEADING_WHEN", "OUTDENT", "PARAM_END", "REGEX_START", "REGEX_END", "RETURN", "STRING_END", "THROW", "UNARY", "YIELD"].concat(IMPLICIT_UNSPACED_CALL.concat(IMPLICIT_END.concat(CALL_CLOSERS.concat(CONTROL_IN_IMPLICIT))));
UNFINISHED = ["\\", ".", "?.", "?::", "UNARY", "DO", "DO_IIFE", "MATH", "UNARY_MATH", "+", "-", "**", "SHIFT", "RELATION", "COMPARE", "&", "^", "|", "&&", "||", "SPACE?", "EXTENDS"];
// src/parser.js
var parserInstance = {
  symbolIds: { $accept: 0, $end: 1, error: 2, Root: 3, Body: 4, Line: 5, TERMINATOR: 6, Expression: 7, ExpressionLine: 8, Statement: 9, Return: 10, STATEMENT: 11, Import: 12, Export: 13, Value: 14, Code: 15, Operation: 16, Assign: 17, ReactiveAssign: 18, DerivedAssign: 19, ReadonlyAssign: 20, EffectBlock: 21, If: 22, Try: 23, While: 24, For: 25, Switch: 26, Class: 27, Throw: 28, Yield: 29, Def: 30, DEF: 31, Identifier: 32, CALL_START: 33, ParamList: 34, CALL_END: 35, Block: 36, Assignable: 37, REACTIVE_ASSIGN: 38, INDENT: 39, OUTDENT: 40, DERIVED_ASSIGN: 41, READONLY_ASSIGN: 42, EFFECT: 43, FuncGlyph: 44, CodeLine: 45, OperationLine: 46, YIELD: 47, Object: 48, FROM: 49, IDENTIFIER: 50, Property: 51, PROPERTY: 52, AlphaNumeric: 53, NUMBER: 54, String: 55, STRING: 56, STRING_START: 57, Interpolations: 58, STRING_END: 59, InterpolationChunk: 60, INTERPOLATION_START: 61, INTERPOLATION_END: 62, Regex: 63, REGEX: 64, REGEX_START: 65, Invocation: 66, REGEX_END: 67, RegexWithIndex: 68, ",": 69, Literal: 70, JS: 71, UNDEFINED: 72, NULL: 73, BOOL: 74, INFINITY: 75, NAN: 76, "=": 77, AssignObj: 78, ObjAssignable: 79, ObjRestValue: 80, ":": 81, SimpleObjAssignable: 82, ThisProperty: 83, "[": 84, "]": 85, "@": 86, "...": 87, ObjSpreadExpr: 88, Parenthetical: 89, Super: 90, This: 91, SUPER: 92, OptFuncExist: 93, Arguments: 94, DYNAMIC_IMPORT: 95, ".": 96, "?.": 97, "::": 98, "?::": 99, INDEX_START: 100, INDEX_END: 101, INDEX_SOAK: 102, RETURN: 103, PARAM_START: 104, PARAM_END: 105, "->": 106, "=>": 107, OptComma: 108, Param: 109, ParamVar: 110, Array: 111, Splat: 112, SimpleAssignable: 113, Slice: 114, ES6_OPTIONAL_INDEX: 115, Range: 116, DoIife: 117, MetaProperty: 118, NEW_TARGET: 119, IMPORT_META: 120, "{": 121, FOR: 122, ForVariables: 123, FOROF: 124, "}": 125, WHEN: 126, OWN: 127, AssignList: 128, CLASS: 129, EXTENDS: 130, IMPORT: 131, ImportDefaultSpecifier: 132, ImportNamespaceSpecifier: 133, ImportSpecifierList: 134, ImportSpecifier: 135, AS: 136, DEFAULT: 137, IMPORT_ALL: 138, EXPORT: 139, ExportSpecifierList: 140, EXPORT_ALL: 141, ExportSpecifier: 142, ES6_OPTIONAL_CALL: 143, FUNC_EXIST: 144, ArgList: 145, THIS: 146, Elisions: 147, ArgElisionList: 148, OptElisions: 149, RangeDots: 150, "..": 151, Arg: 152, ArgElision: 153, Elision: 154, SimpleArgs: 155, TRY: 156, Catch: 157, FINALLY: 158, CATCH: 159, THROW: 160, "(": 161, ")": 162, WhileSource: 163, WHILE: 164, UNTIL: 165, Loop: 166, LOOP: 167, FORIN: 168, BY: 169, FORFROM: 170, AWAIT: 171, ForValue: 172, SWITCH: 173, Whens: 174, ELSE: 175, When: 176, LEADING_WHEN: 177, IfBlock: 178, IF: 179, UnlessBlock: 180, UNLESS: 181, POST_IF: 182, POST_UNLESS: 183, UNARY: 184, DO: 185, DO_IIFE: 186, UNARY_MATH: 187, "-": 188, "+": 189, "--": 190, "++": 191, "?": 192, MATH: 193, "**": 194, SHIFT: 195, COMPARE: 196, "&": 197, "^": 198, "|": 199, "&&": 200, "||": 201, "??": 202, "!?": 203, RELATION: 204, "SPACE?": 205, COMPOUND_ASSIGN: 206 },
  tokenNames: { 2: "error", 6: "TERMINATOR", 11: "STATEMENT", 31: "DEF", 33: "CALL_START", 35: "CALL_END", 38: "REACTIVE_ASSIGN", 39: "INDENT", 40: "OUTDENT", 41: "DERIVED_ASSIGN", 42: "READONLY_ASSIGN", 43: "EFFECT", 47: "YIELD", 49: "FROM", 50: "IDENTIFIER", 52: "PROPERTY", 54: "NUMBER", 56: "STRING", 57: "STRING_START", 59: "STRING_END", 61: "INTERPOLATION_START", 62: "INTERPOLATION_END", 64: "REGEX", 65: "REGEX_START", 67: "REGEX_END", 69: ",", 71: "JS", 72: "UNDEFINED", 73: "NULL", 74: "BOOL", 75: "INFINITY", 76: "NAN", 77: "=", 81: ":", 84: "[", 85: "]", 86: "@", 87: "...", 92: "SUPER", 95: "DYNAMIC_IMPORT", 96: ".", 97: "?.", 98: "::", 99: "?::", 100: "INDEX_START", 101: "INDEX_END", 102: "INDEX_SOAK", 103: "RETURN", 104: "PARAM_START", 105: "PARAM_END", 106: "->", 107: "=>", 115: "ES6_OPTIONAL_INDEX", 119: "NEW_TARGET", 120: "IMPORT_META", 121: "{", 122: "FOR", 124: "FOROF", 125: "}", 126: "WHEN", 127: "OWN", 129: "CLASS", 130: "EXTENDS", 131: "IMPORT", 136: "AS", 137: "DEFAULT", 138: "IMPORT_ALL", 139: "EXPORT", 141: "EXPORT_ALL", 143: "ES6_OPTIONAL_CALL", 144: "FUNC_EXIST", 146: "THIS", 151: "..", 156: "TRY", 158: "FINALLY", 159: "CATCH", 160: "THROW", 161: "(", 162: ")", 164: "WHILE", 165: "UNTIL", 167: "LOOP", 168: "FORIN", 169: "BY", 170: "FORFROM", 171: "AWAIT", 173: "SWITCH", 175: "ELSE", 177: "LEADING_WHEN", 179: "IF", 181: "UNLESS", 182: "POST_IF", 183: "POST_UNLESS", 184: "UNARY", 185: "DO", 186: "DO_IIFE", 187: "UNARY_MATH", 188: "-", 189: "+", 190: "--", 191: "++", 192: "?", 193: "MATH", 194: "**", 195: "SHIFT", 196: "COMPARE", 197: "&", 198: "^", 199: "|", 200: "&&", 201: "||", 202: "??", 203: "!?", 204: "RELATION", 205: "SPACE?", 206: "COMPOUND_ASSIGN" },
  parseTable: [{ 1: -1, 3: 1, 4: 2, 5: 3, 7: 4, 8: 5, 9: 6, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: 0 }, { 1: -2, 6: 101 }, { 1: -3, 6: -3, 40: -3, 62: -3, 162: -3 }, { 1: -6, 6: -6, 35: -6, 39: -6, 40: -6, 62: -6, 69: -6, 85: -6, 122: 121, 162: -6, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -7, 6: -7, 35: -7, 39: -7, 40: -7, 62: -7, 69: -7, 85: -7, 162: -7 }, { 1: -8, 6: -8, 35: -8, 39: -8, 40: -8, 62: -8, 69: -8, 85: -8, 162: -8, 163: 124, 164: 90, 165: 91, 182: 122, 183: 123 }, { 1: -13, 6: -13, 33: -246, 35: -13, 39: -13, 40: -13, 56: -246, 57: -246, 62: -13, 69: -13, 81: -13, 85: -13, 87: -13, 93: 125, 96: 127, 97: 128, 98: 129, 99: 130, 100: 131, 101: -13, 102: 132, 105: -13, 115: 133, 122: -13, 124: -13, 125: -13, 126: -13, 143: 126, 144: 134, 151: -13, 162: -13, 164: -13, 165: -13, 168: -13, 169: -13, 170: -13, 182: -13, 183: -13, 188: -13, 189: -13, 192: -13, 193: -13, 194: -13, 195: -13, 196: -13, 197: -13, 198: -13, 199: -13, 200: -13, 201: -13, 202: -13, 203: -13, 204: -13, 205: -13 }, { 1: -14, 6: -14, 35: -14, 39: -14, 40: -14, 62: -14, 69: -14, 81: -14, 85: -14, 87: -14, 96: 135, 97: 136, 98: 137, 99: 138, 100: 139, 101: -14, 102: 140, 105: -14, 122: -14, 124: -14, 125: -14, 126: -14, 151: -14, 162: -14, 164: -14, 165: -14, 168: -14, 169: -14, 170: -14, 182: -14, 183: -14, 188: -14, 189: -14, 192: -14, 193: -14, 194: -14, 195: -14, 196: -14, 197: -14, 198: -14, 199: -14, 200: -14, 201: -14, 202: -14, 203: -14, 204: -14, 205: -14 }, { 1: -15, 6: -15, 35: -15, 39: -15, 40: -15, 62: -15, 69: -15, 81: -15, 85: -15, 87: -15, 101: -15, 105: -15, 122: -15, 124: -15, 125: -15, 126: -15, 151: -15, 162: -15, 164: -15, 165: -15, 168: -15, 169: -15, 170: -15, 182: -15, 183: -15, 188: -15, 189: -15, 192: -15, 193: -15, 194: -15, 195: -15, 196: -15, 197: -15, 198: -15, 199: -15, 200: -15, 201: -15, 202: -15, 203: -15, 204: -15, 205: -15 }, { 1: -16, 6: -16, 35: -16, 39: -16, 40: -16, 62: -16, 69: -16, 81: -16, 85: -16, 87: -16, 101: -16, 105: -16, 122: -16, 124: -16, 125: -16, 126: -16, 151: -16, 162: -16, 164: -16, 165: -16, 168: -16, 169: -16, 170: -16, 182: -16, 183: -16, 188: -16, 189: -16, 192: -16, 193: -16, 194: -16, 195: -16, 196: -16, 197: -16, 198: -16, 199: -16, 200: -16, 201: -16, 202: -16, 203: -16, 204: -16, 205: -16 }, { 1: -17, 6: -17, 35: -17, 39: -17, 40: -17, 62: -17, 69: -17, 81: -17, 85: -17, 87: -17, 101: -17, 105: -17, 122: -17, 124: -17, 125: -17, 126: -17, 151: -17, 162: -17, 164: -17, 165: -17, 168: -17, 169: -17, 170: -17, 182: -17, 183: -17, 188: -17, 189: -17, 192: -17, 193: -17, 194: -17, 195: -17, 196: -17, 197: -17, 198: -17, 199: -17, 200: -17, 201: -17, 202: -17, 203: -17, 204: -17, 205: -17 }, { 1: -18, 6: -18, 35: -18, 39: -18, 40: -18, 62: -18, 69: -18, 81: -18, 85: -18, 87: -18, 101: -18, 105: -18, 122: -18, 124: -18, 125: -18, 126: -18, 151: -18, 162: -18, 164: -18, 165: -18, 168: -18, 169: -18, 170: -18, 182: -18, 183: -18, 188: -18, 189: -18, 192: -18, 193: -18, 194: -18, 195: -18, 196: -18, 197: -18, 198: -18, 199: -18, 200: -18, 201: -18, 202: -18, 203: -18, 204: -18, 205: -18 }, { 1: -19, 6: -19, 35: -19, 39: -19, 40: -19, 62: -19, 69: -19, 81: -19, 85: -19, 87: -19, 101: -19, 105: -19, 122: -19, 124: -19, 125: -19, 126: -19, 151: -19, 162: -19, 164: -19, 165: -19, 168: -19, 169: -19, 170: -19, 182: -19, 183: -19, 188: -19, 189: -19, 192: -19, 193: -19, 194: -19, 195: -19, 196: -19, 197: -19, 198: -19, 199: -19, 200: -19, 201: -19, 202: -19, 203: -19, 204: -19, 205: -19 }, { 1: -20, 6: -20, 35: -20, 39: -20, 40: -20, 62: -20, 69: -20, 81: -20, 85: -20, 87: -20, 101: -20, 105: -20, 122: -20, 124: -20, 125: -20, 126: -20, 151: -20, 162: -20, 164: -20, 165: -20, 168: -20, 169: -20, 170: -20, 182: -20, 183: -20, 188: -20, 189: -20, 192: -20, 193: -20, 194: -20, 195: -20, 196: -20, 197: -20, 198: -20, 199: -20, 200: -20, 201: -20, 202: -20, 203: -20, 204: -20, 205: -20 }, { 1: -21, 6: -21, 35: -21, 39: -21, 40: -21, 62: -21, 69: -21, 81: -21, 85: -21, 87: -21, 101: -21, 105: -21, 122: -21, 124: -21, 125: -21, 126: -21, 151: -21, 162: -21, 164: -21, 165: -21, 168: -21, 169: -21, 170: -21, 182: -21, 183: -21, 188: -21, 189: -21, 192: -21, 193: -21, 194: -21, 195: -21, 196: -21, 197: -21, 198: -21, 199: -21, 200: -21, 201: -21, 202: -21, 203: -21, 204: -21, 205: -21 }, { 1: -22, 6: -22, 35: -22, 39: -22, 40: -22, 62: -22, 69: -22, 81: -22, 85: -22, 87: -22, 101: -22, 105: -22, 122: -22, 124: -22, 125: -22, 126: -22, 151: -22, 162: -22, 164: -22, 165: -22, 168: -22, 169: -22, 170: -22, 182: -22, 183: -22, 188: -22, 189: -22, 192: -22, 193: -22, 194: -22, 195: -22, 196: -22, 197: -22, 198: -22, 199: -22, 200: -22, 201: -22, 202: -22, 203: -22, 204: -22, 205: -22 }, { 1: -23, 6: -23, 35: -23, 39: -23, 40: -23, 62: -23, 69: -23, 81: -23, 85: -23, 87: -23, 101: -23, 105: -23, 122: -23, 124: -23, 125: -23, 126: -23, 151: -23, 162: -23, 164: -23, 165: -23, 168: -23, 169: -23, 170: -23, 182: -23, 183: -23, 188: -23, 189: -23, 192: -23, 193: -23, 194: -23, 195: -23, 196: -23, 197: -23, 198: -23, 199: -23, 200: -23, 201: -23, 202: -23, 203: -23, 204: -23, 205: -23 }, { 1: -24, 6: -24, 35: -24, 39: -24, 40: -24, 62: -24, 69: -24, 81: -24, 85: -24, 87: -24, 101: -24, 105: -24, 122: -24, 124: -24, 125: -24, 126: -24, 151: -24, 162: -24, 164: -24, 165: -24, 168: -24, 169: -24, 170: -24, 182: -24, 183: -24, 188: -24, 189: -24, 192: -24, 193: -24, 194: -24, 195: -24, 196: -24, 197: -24, 198: -24, 199: -24, 200: -24, 201: -24, 202: -24, 203: -24, 204: -24, 205: -24 }, { 1: -25, 6: -25, 35: -25, 39: -25, 40: -25, 62: -25, 69: -25, 81: -25, 85: -25, 87: -25, 101: -25, 105: -25, 122: -25, 124: -25, 125: -25, 126: -25, 151: -25, 162: -25, 164: -25, 165: -25, 168: -25, 169: -25, 170: -25, 182: -25, 183: -25, 188: -25, 189: -25, 192: -25, 193: -25, 194: -25, 195: -25, 196: -25, 197: -25, 198: -25, 199: -25, 200: -25, 201: -25, 202: -25, 203: -25, 204: -25, 205: -25 }, { 1: -26, 6: -26, 35: -26, 39: -26, 40: -26, 62: -26, 69: -26, 81: -26, 85: -26, 87: -26, 101: -26, 105: -26, 122: -26, 124: -26, 125: -26, 126: -26, 151: -26, 162: -26, 164: -26, 165: -26, 168: -26, 169: -26, 170: -26, 182: -26, 183: -26, 188: -26, 189: -26, 192: -26, 193: -26, 194: -26, 195: -26, 196: -26, 197: -26, 198: -26, 199: -26, 200: -26, 201: -26, 202: -26, 203: -26, 204: -26, 205: -26 }, { 1: -27, 6: -27, 35: -27, 39: -27, 40: -27, 62: -27, 69: -27, 81: -27, 85: -27, 87: -27, 101: -27, 105: -27, 122: -27, 124: -27, 125: -27, 126: -27, 151: -27, 162: -27, 164: -27, 165: -27, 168: -27, 169: -27, 170: -27, 182: -27, 183: -27, 188: -27, 189: -27, 192: -27, 193: -27, 194: -27, 195: -27, 196: -27, 197: -27, 198: -27, 199: -27, 200: -27, 201: -27, 202: -27, 203: -27, 204: -27, 205: -27 }, { 1: -28, 6: -28, 35: -28, 39: -28, 40: -28, 62: -28, 69: -28, 81: -28, 85: -28, 87: -28, 101: -28, 105: -28, 122: -28, 124: -28, 125: -28, 126: -28, 151: -28, 162: -28, 164: -28, 165: -28, 168: -28, 169: -28, 170: -28, 182: -28, 183: -28, 188: -28, 189: -28, 192: -28, 193: -28, 194: -28, 195: -28, 196: -28, 197: -28, 198: -28, 199: -28, 200: -28, 201: -28, 202: -28, 203: -28, 204: -28, 205: -28 }, { 1: -29, 6: -29, 35: -29, 39: -29, 40: -29, 62: -29, 69: -29, 81: -29, 85: -29, 87: -29, 101: -29, 105: -29, 122: -29, 124: -29, 125: -29, 126: -29, 151: -29, 162: -29, 164: -29, 165: -29, 168: -29, 169: -29, 170: -29, 182: -29, 183: -29, 188: -29, 189: -29, 192: -29, 193: -29, 194: -29, 195: -29, 196: -29, 197: -29, 198: -29, 199: -29, 200: -29, 201: -29, 202: -29, 203: -29, 204: -29, 205: -29 }, { 1: -43, 6: -43, 35: -43, 39: -43, 40: -43, 62: -43, 69: -43, 85: -43, 162: -43 }, { 1: -44, 6: -44, 35: -44, 39: -44, 40: -44, 62: -44, 69: -44, 85: -44, 162: -44 }, { 1: -9, 6: -9, 35: -9, 39: -9, 40: -9, 62: -9, 69: -9, 85: -9, 162: -9, 164: -9, 165: -9, 182: -9, 183: -9 }, { 1: -10, 6: -10, 35: -10, 39: -10, 40: -10, 62: -10, 69: -10, 85: -10, 162: -10, 164: -10, 165: -10, 182: -10, 183: -10 }, { 1: -11, 6: -11, 35: -11, 39: -11, 40: -11, 62: -11, 69: -11, 85: -11, 162: -11, 164: -11, 165: -11, 182: -11, 183: -11 }, { 1: -12, 6: -12, 35: -12, 39: -12, 40: -12, 62: -12, 69: -12, 85: -12, 162: -12, 164: -12, 165: -12, 182: -12, 183: -12 }, { 1: -169, 6: -169, 33: -169, 35: -169, 38: 142, 39: -169, 40: -169, 41: 143, 42: 144, 56: -169, 57: -169, 62: -169, 69: -169, 77: 141, 81: -169, 85: -169, 87: -169, 96: -169, 97: -169, 98: -169, 99: -169, 100: -169, 101: -169, 102: -169, 105: -169, 115: -169, 122: -169, 124: -169, 125: -169, 126: -169, 143: -169, 144: -169, 151: -169, 162: -169, 164: -169, 165: -169, 168: -169, 169: -169, 170: -169, 182: -169, 183: -169, 188: -169, 189: -169, 192: -169, 193: -169, 194: -169, 195: -169, 196: -169, 197: -169, 198: -169, 199: -169, 200: -169, 201: -169, 202: -169, 203: -169, 204: -169, 205: -169 }, { 1: -170, 6: -170, 33: -170, 35: -170, 39: -170, 40: -170, 56: -170, 57: -170, 62: -170, 69: -170, 81: -170, 85: -170, 87: -170, 96: -170, 97: -170, 98: -170, 99: -170, 100: -170, 101: -170, 102: -170, 105: -170, 115: -170, 122: -170, 124: -170, 125: -170, 126: -170, 143: -170, 144: -170, 151: -170, 162: -170, 164: -170, 165: -170, 168: -170, 169: -170, 170: -170, 182: -170, 183: -170, 188: -170, 189: -170, 192: -170, 193: -170, 194: -170, 195: -170, 196: -170, 197: -170, 198: -170, 199: -170, 200: -170, 201: -170, 202: -170, 203: -170, 204: -170, 205: -170 }, { 1: -171, 6: -171, 33: -171, 35: -171, 39: -171, 40: -171, 56: -171, 57: -171, 62: -171, 69: -171, 81: -171, 85: -171, 87: -171, 96: -171, 97: -171, 98: -171, 99: -171, 100: -171, 101: -171, 102: -171, 105: -171, 115: -171, 122: -171, 124: -171, 125: -171, 126: -171, 143: -171, 144: -171, 151: -171, 162: -171, 164: -171, 165: -171, 168: -171, 169: -171, 170: -171, 182: -171, 183: -171, 188: -171, 189: -171, 192: -171, 193: -171, 194: -171, 195: -171, 196: -171, 197: -171, 198: -171, 199: -171, 200: -171, 201: -171, 202: -171, 203: -171, 204: -171, 205: -171 }, { 1: -172, 6: -172, 33: -172, 35: -172, 39: -172, 40: -172, 56: -172, 57: -172, 62: -172, 69: -172, 81: -172, 85: -172, 87: -172, 96: -172, 97: -172, 98: -172, 99: -172, 100: -172, 101: -172, 102: -172, 105: -172, 115: -172, 122: -172, 124: -172, 125: -172, 126: -172, 143: -172, 144: -172, 151: -172, 162: -172, 164: -172, 165: -172, 168: -172, 169: -172, 170: -172, 182: -172, 183: -172, 188: -172, 189: -172, 192: -172, 193: -172, 194: -172, 195: -172, 196: -172, 197: -172, 198: -172, 199: -172, 200: -172, 201: -172, 202: -172, 203: -172, 204: -172, 205: -172 }, { 1: -173, 6: -173, 33: -173, 35: -173, 39: -173, 40: -173, 56: -173, 57: -173, 62: -173, 69: -173, 81: -173, 85: -173, 87: -173, 96: -173, 97: -173, 98: -173, 99: -173, 100: -173, 101: -173, 102: -173, 105: -173, 115: -173, 122: -173, 124: -173, 125: -173, 126: -173, 143: -173, 144: -173, 151: -173, 162: -173, 164: -173, 165: -173, 168: -173, 169: -173, 170: -173, 182: -173, 183: -173, 188: -173, 189: -173, 192: -173, 193: -173, 194: -173, 195: -173, 196: -173, 197: -173, 198: -173, 199: -173, 200: -173, 201: -173, 202: -173, 203: -173, 204: -173, 205: -173 }, { 1: -174, 6: -174, 33: -174, 35: -174, 39: -174, 40: -174, 56: -174, 57: -174, 62: -174, 69: -174, 81: -174, 85: -174, 87: -174, 96: -174, 97: -174, 98: -174, 99: -174, 100: -174, 101: -174, 102: -174, 105: -174, 115: -174, 122: -174, 124: -174, 125: -174, 126: -174, 143: -174, 144: -174, 151: -174, 162: -174, 164: -174, 165: -174, 168: -174, 169: -174, 170: -174, 182: -174, 183: -174, 188: -174, 189: -174, 192: -174, 193: -174, 194: -174, 195: -174, 196: -174, 197: -174, 198: -174, 199: -174, 200: -174, 201: -174, 202: -174, 203: -174, 204: -174, 205: -174 }, { 1: -175, 6: -175, 33: -175, 35: -175, 39: -175, 40: -175, 56: -175, 57: -175, 62: -175, 69: -175, 81: -175, 85: -175, 87: -175, 96: -175, 97: -175, 98: -175, 99: -175, 100: -175, 101: -175, 102: -175, 105: -175, 115: -175, 122: -175, 124: -175, 125: -175, 126: -175, 143: -175, 144: -175, 151: -175, 162: -175, 164: -175, 165: -175, 168: -175, 169: -175, 170: -175, 182: -175, 183: -175, 188: -175, 189: -175, 192: -175, 193: -175, 194: -175, 195: -175, 196: -175, 197: -175, 198: -175, 199: -175, 200: -175, 201: -175, 202: -175, 203: -175, 204: -175, 205: -175 }, { 1: -176, 6: -176, 33: -176, 35: -176, 39: -176, 40: -176, 56: -176, 57: -176, 62: -176, 69: -176, 81: -176, 85: -176, 87: -176, 96: -176, 97: -176, 98: -176, 99: -176, 100: -176, 101: -176, 102: -176, 105: -176, 115: -176, 122: -176, 124: -176, 125: -176, 126: -176, 143: -176, 144: -176, 151: -176, 162: -176, 164: -176, 165: -176, 168: -176, 169: -176, 170: -176, 182: -176, 183: -176, 188: -176, 189: -176, 192: -176, 193: -176, 194: -176, 195: -176, 196: -176, 197: -176, 198: -176, 199: -176, 200: -176, 201: -176, 202: -176, 203: -176, 204: -176, 205: -176 }, { 1: -177, 6: -177, 33: -177, 35: -177, 39: -177, 40: -177, 56: -177, 57: -177, 62: -177, 69: -177, 81: -177, 85: -177, 87: -177, 96: -177, 97: -177, 98: -177, 99: -177, 100: -177, 101: -177, 102: -177, 105: -177, 115: -177, 122: -177, 124: -177, 125: -177, 126: -177, 143: -177, 144: -177, 151: -177, 162: -177, 164: -177, 165: -177, 168: -177, 169: -177, 170: -177, 182: -177, 183: -177, 188: -177, 189: -177, 192: -177, 193: -177, 194: -177, 195: -177, 196: -177, 197: -177, 198: -177, 199: -177, 200: -177, 201: -177, 202: -177, 203: -177, 204: -177, 205: -177 }, { 6: -123, 32: 149, 34: 145, 35: -123, 39: -123, 40: -123, 48: 152, 50: 98, 69: -123, 83: 150, 84: 154, 86: 153, 87: 148, 105: -123, 109: 146, 110: 147, 111: 151, 121: 93 }, { 5: 156, 7: 4, 8: 5, 9: 6, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 36: 155, 37: 30, 39: 157, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 158, 8: 159, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 161, 8: 162, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 163, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 169, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 170, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 171, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 172, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 14: 174, 15: 175, 32: 86, 37: 176, 44: 165, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 104: 164, 106: 84, 107: 85, 111: 66, 113: 173, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 146: 80, 161: 76, 186: 168 }, { 14: 174, 15: 175, 32: 86, 37: 176, 44: 165, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 104: 164, 106: 84, 107: 85, 111: 66, 113: 177, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 146: 80, 161: 76, 186: 168 }, { 1: -166, 6: -166, 33: -166, 35: -166, 38: -166, 39: -166, 40: -166, 41: -166, 42: -166, 56: -166, 57: -166, 62: -166, 69: -166, 77: -166, 81: -166, 85: -166, 87: -166, 96: -166, 97: -166, 98: -166, 99: -166, 100: -166, 101: -166, 102: -166, 105: -166, 115: -166, 122: -166, 124: -166, 125: -166, 126: -166, 143: -166, 144: -166, 151: -166, 162: -166, 164: -166, 165: -166, 168: -166, 169: -166, 170: -166, 182: -166, 183: -166, 188: -166, 189: -166, 190: 178, 191: 179, 192: -166, 193: -166, 194: -166, 195: -166, 196: -166, 197: -166, 198: -166, 199: -166, 200: -166, 201: -166, 202: -166, 203: -166, 204: -166, 205: -166, 206: 180 }, { 36: 182, 39: 157, 44: 181, 106: 84, 107: 85 }, { 1: -354, 6: -354, 35: -354, 39: -354, 40: -354, 62: -354, 69: -354, 81: -354, 85: -354, 87: -354, 101: -354, 105: -354, 122: -354, 124: -354, 125: -354, 126: -354, 151: -354, 162: -354, 164: -354, 165: -354, 168: -354, 169: -354, 170: -354, 175: 183, 182: -354, 183: -354, 188: -354, 189: -354, 192: -354, 193: -354, 194: -354, 195: -354, 196: -354, 197: -354, 198: -354, 199: -354, 200: -354, 201: -354, 202: -354, 203: -354, 204: -354, 205: -354 }, { 1: -356, 6: -356, 35: -356, 39: -356, 40: -356, 62: -356, 69: -356, 81: -356, 85: -356, 87: -356, 101: -356, 105: -356, 122: -356, 124: -356, 125: -356, 126: -356, 151: -356, 162: -356, 164: -356, 165: -356, 168: -356, 169: -356, 170: -356, 182: -356, 183: -356, 188: -356, 189: -356, 192: -356, 193: -356, 194: -356, 195: -356, 196: -356, 197: -356, 198: -356, 199: -356, 200: -356, 201: -356, 202: -356, 203: -356, 204: -356, 205: -356 }, { 36: 184, 39: 157 }, { 36: 185, 39: 157 }, { 1: -305, 6: -305, 35: -305, 39: -305, 40: -305, 62: -305, 69: -305, 81: -305, 85: -305, 87: -305, 101: -305, 105: -305, 122: -305, 124: -305, 125: -305, 126: -305, 151: -305, 162: -305, 164: -305, 165: -305, 168: -305, 169: -305, 170: -305, 182: -305, 183: -305, 188: -305, 189: -305, 192: -305, 193: -305, 194: -305, 195: -305, 196: -305, 197: -305, 198: -305, 199: -305, 200: -305, 201: -305, 202: -305, 203: -305, 204: -305, 205: -305 }, { 32: 149, 48: 152, 50: 98, 83: 150, 84: 77, 86: 153, 110: 191, 111: 151, 116: 189, 121: 93, 123: 186, 127: 187, 171: 188, 172: 190 }, { 7: 192, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 193, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -193, 6: -193, 14: 174, 15: 175, 32: 86, 35: -193, 36: 194, 37: 176, 39: 157, 40: -193, 44: 165, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 62: -193, 63: 70, 64: 96, 65: 97, 66: 34, 69: -193, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 81: -193, 83: 87, 84: 77, 85: -193, 86: 81, 87: -193, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 101: -193, 104: 164, 105: -193, 106: 84, 107: 85, 111: 66, 113: 196, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: -193, 124: -193, 125: -193, 126: -193, 130: 195, 146: 80, 151: -193, 161: 76, 162: -193, 164: -193, 165: -193, 168: -193, 169: -193, 170: -193, 182: -193, 183: -193, 186: 168, 188: -193, 189: -193, 192: -193, 193: -193, 194: -193, 195: -193, 196: -193, 197: -193, 198: -193, 199: -193, 200: -193, 201: -193, 202: -193, 203: -193, 204: -193, 205: -193 }, { 7: 197, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 198, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -45, 6: -45, 7: 199, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 35: -45, 37: 30, 39: 200, 40: -45, 43: 50, 44: 165, 47: 60, 48: 67, 49: 201, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 62: -45, 63: 70, 64: 96, 65: 97, 66: 34, 69: -45, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 81: -45, 83: 87, 84: 77, 85: -45, 86: 81, 87: -45, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 101: -45, 103: 63, 104: 164, 105: -45, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: -45, 124: -45, 125: -45, 126: -45, 129: 58, 131: 64, 139: 65, 146: 80, 151: -45, 156: 53, 160: 59, 161: 76, 162: -45, 163: 54, 164: -45, 165: -45, 166: 55, 167: 92, 168: -45, 169: -45, 170: -45, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 182: -45, 183: -45, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48, 192: -45, 193: -45, 194: -45, 195: -45, 196: -45, 197: -45, 198: -45, 199: -45, 200: -45, 201: -45, 202: -45, 203: -45, 204: -45, 205: -45 }, { 32: 202, 50: 98 }, { 15: 204, 44: 40, 45: 203, 104: 39, 106: 84, 107: 85 }, { 1: -114, 6: -114, 7: 205, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 35: -114, 37: 30, 39: 206, 40: -114, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 62: -114, 63: 70, 64: 96, 65: 97, 66: 34, 69: -114, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 85: -114, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 162: -114, 163: 54, 164: -114, 165: -114, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 182: -114, 183: -114, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 32: 211, 50: 98, 55: 207, 56: 99, 57: 100, 121: 210, 132: 208, 133: 209, 138: 212 }, { 27: 214, 30: 215, 31: 61, 32: 216, 50: 98, 121: 213, 129: 58, 137: 217, 141: 218 }, { 1: -167, 6: -167, 33: -167, 35: -167, 38: -167, 39: -167, 40: -167, 41: -167, 42: -167, 56: -167, 57: -167, 62: -167, 69: -167, 77: -167, 81: -167, 85: -167, 87: -167, 96: -167, 97: -167, 98: -167, 99: -167, 100: -167, 101: -167, 102: -167, 105: -167, 115: -167, 122: -167, 124: -167, 125: -167, 126: -167, 143: -167, 144: -167, 151: -167, 162: -167, 164: -167, 165: -167, 168: -167, 169: -167, 170: -167, 182: -167, 183: -167, 188: -167, 189: -167, 192: -167, 193: -167, 194: -167, 195: -167, 196: -167, 197: -167, 198: -167, 199: -167, 200: -167, 201: -167, 202: -167, 203: -167, 204: -167, 205: -167 }, { 1: -168, 6: -168, 33: -168, 35: -168, 38: -168, 39: -168, 40: -168, 41: -168, 42: -168, 56: -168, 57: -168, 62: -168, 69: -168, 77: -168, 81: -168, 85: -168, 87: -168, 96: -168, 97: -168, 98: -168, 99: -168, 100: -168, 101: -168, 102: -168, 105: -168, 115: -168, 122: -168, 124: -168, 125: -168, 126: -168, 143: -168, 144: -168, 151: -168, 162: -168, 164: -168, 165: -168, 168: -168, 169: -168, 170: -168, 182: -168, 183: -168, 188: -168, 189: -168, 192: -168, 193: -168, 194: -168, 195: -168, 196: -168, 197: -168, 198: -168, 199: -168, 200: -168, 201: -168, 202: -168, 203: -168, 204: -168, 205: -168 }, { 1: -67, 6: -67, 33: -67, 35: -67, 39: -67, 40: -67, 56: -67, 57: -67, 62: -67, 69: -67, 81: -67, 85: -67, 87: -67, 96: -67, 97: -67, 98: -67, 99: -67, 100: -67, 101: -67, 102: -67, 105: -67, 115: -67, 122: -67, 124: -67, 125: -67, 126: -67, 143: -67, 144: -67, 151: -67, 162: -67, 164: -67, 165: -67, 168: -67, 169: -67, 170: -67, 182: -67, 183: -67, 188: -67, 189: -67, 192: -67, 193: -67, 194: -67, 195: -67, 196: -67, 197: -67, 198: -67, 199: -67, 200: -67, 201: -67, 202: -67, 203: -67, 204: -67, 205: -67 }, { 1: -68, 6: -68, 33: -68, 35: -68, 39: -68, 40: -68, 56: -68, 57: -68, 62: -68, 69: -68, 81: -68, 85: -68, 87: -68, 96: -68, 97: -68, 98: -68, 99: -68, 100: -68, 101: -68, 102: -68, 105: -68, 115: -68, 122: -68, 124: -68, 125: -68, 126: -68, 143: -68, 144: -68, 151: -68, 162: -68, 164: -68, 165: -68, 168: -68, 169: -68, 170: -68, 182: -68, 183: -68, 188: -68, 189: -68, 192: -68, 193: -68, 194: -68, 195: -68, 196: -68, 197: -68, 198: -68, 199: -68, 200: -68, 201: -68, 202: -68, 203: -68, 204: -68, 205: -68 }, { 1: -69, 6: -69, 33: -69, 35: -69, 39: -69, 40: -69, 56: -69, 57: -69, 62: -69, 69: -69, 81: -69, 85: -69, 87: -69, 96: -69, 97: -69, 98: -69, 99: -69, 100: -69, 101: -69, 102: -69, 105: -69, 115: -69, 122: -69, 124: -69, 125: -69, 126: -69, 143: -69, 144: -69, 151: -69, 162: -69, 164: -69, 165: -69, 168: -69, 169: -69, 170: -69, 182: -69, 183: -69, 188: -69, 189: -69, 192: -69, 193: -69, 194: -69, 195: -69, 196: -69, 197: -69, 198: -69, 199: -69, 200: -69, 201: -69, 202: -69, 203: -69, 204: -69, 205: -69 }, { 1: -70, 6: -70, 33: -70, 35: -70, 39: -70, 40: -70, 56: -70, 57: -70, 62: -70, 69: -70, 81: -70, 85: -70, 87: -70, 96: -70, 97: -70, 98: -70, 99: -70, 100: -70, 101: -70, 102: -70, 105: -70, 115: -70, 122: -70, 124: -70, 125: -70, 126: -70, 143: -70, 144: -70, 151: -70, 162: -70, 164: -70, 165: -70, 168: -70, 169: -70, 170: -70, 182: -70, 183: -70, 188: -70, 189: -70, 192: -70, 193: -70, 194: -70, 195: -70, 196: -70, 197: -70, 198: -70, 199: -70, 200: -70, 201: -70, 202: -70, 203: -70, 204: -70, 205: -70 }, { 1: -71, 6: -71, 33: -71, 35: -71, 39: -71, 40: -71, 56: -71, 57: -71, 62: -71, 69: -71, 81: -71, 85: -71, 87: -71, 96: -71, 97: -71, 98: -71, 99: -71, 100: -71, 101: -71, 102: -71, 105: -71, 115: -71, 122: -71, 124: -71, 125: -71, 126: -71, 143: -71, 144: -71, 151: -71, 162: -71, 164: -71, 165: -71, 168: -71, 169: -71, 170: -71, 182: -71, 183: -71, 188: -71, 189: -71, 192: -71, 193: -71, 194: -71, 195: -71, 196: -71, 197: -71, 198: -71, 199: -71, 200: -71, 201: -71, 202: -71, 203: -71, 204: -71, 205: -71 }, { 1: -72, 6: -72, 33: -72, 35: -72, 39: -72, 40: -72, 56: -72, 57: -72, 62: -72, 69: -72, 81: -72, 85: -72, 87: -72, 96: -72, 97: -72, 98: -72, 99: -72, 100: -72, 101: -72, 102: -72, 105: -72, 115: -72, 122: -72, 124: -72, 125: -72, 126: -72, 143: -72, 144: -72, 151: -72, 162: -72, 164: -72, 165: -72, 168: -72, 169: -72, 170: -72, 182: -72, 183: -72, 188: -72, 189: -72, 192: -72, 193: -72, 194: -72, 195: -72, 196: -72, 197: -72, 198: -72, 199: -72, 200: -72, 201: -72, 202: -72, 203: -72, 204: -72, 205: -72 }, { 1: -73, 6: -73, 33: -73, 35: -73, 39: -73, 40: -73, 56: -73, 57: -73, 62: -73, 69: -73, 81: -73, 85: -73, 87: -73, 96: -73, 97: -73, 98: -73, 99: -73, 100: -73, 101: -73, 102: -73, 105: -73, 115: -73, 122: -73, 124: -73, 125: -73, 126: -73, 143: -73, 144: -73, 151: -73, 162: -73, 164: -73, 165: -73, 168: -73, 169: -73, 170: -73, 182: -73, 183: -73, 188: -73, 189: -73, 192: -73, 193: -73, 194: -73, 195: -73, 196: -73, 197: -73, 198: -73, 199: -73, 200: -73, 201: -73, 202: -73, 203: -73, 204: -73, 205: -73 }, { 1: -74, 6: -74, 33: -74, 35: -74, 39: -74, 40: -74, 56: -74, 57: -74, 62: -74, 69: -74, 81: -74, 85: -74, 87: -74, 96: -74, 97: -74, 98: -74, 99: -74, 100: -74, 101: -74, 102: -74, 105: -74, 115: -74, 122: -74, 124: -74, 125: -74, 126: -74, 143: -74, 144: -74, 151: -74, 162: -74, 164: -74, 165: -74, 168: -74, 169: -74, 170: -74, 182: -74, 183: -74, 188: -74, 189: -74, 192: -74, 193: -74, 194: -74, 195: -74, 196: -74, 197: -74, 198: -74, 199: -74, 200: -74, 201: -74, 202: -74, 203: -74, 204: -74, 205: -74 }, { 4: 219, 5: 3, 7: 4, 8: 5, 9: 6, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 220, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 221, 8: 230, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 227, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 69: 228, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 85: 222, 86: 81, 87: 232, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 112: 231, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 147: 223, 148: 224, 152: 229, 153: 226, 154: 225, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 33: 236, 94: 233, 96: 234, 100: 235 }, { 33: 236, 94: 237 }, { 1: -250, 6: -250, 33: -250, 35: -250, 39: -250, 40: -250, 56: -250, 57: -250, 62: -250, 69: -250, 81: -250, 85: -250, 87: -250, 96: -250, 97: -250, 98: -250, 99: -250, 100: -250, 101: -250, 102: -250, 105: -250, 115: -250, 122: -250, 124: -250, 125: -250, 126: -250, 143: -250, 144: -250, 151: -250, 162: -250, 164: -250, 165: -250, 168: -250, 169: -250, 170: -250, 182: -250, 183: -250, 188: -250, 189: -250, 192: -250, 193: -250, 194: -250, 195: -250, 196: -250, 197: -250, 198: -250, 199: -250, 200: -250, 201: -250, 202: -250, 203: -250, 204: -250, 205: -250 }, { 1: -251, 6: -251, 33: -251, 35: -251, 39: -251, 40: -251, 51: 238, 52: 239, 56: -251, 57: -251, 62: -251, 69: -251, 81: -251, 85: -251, 87: -251, 96: -251, 97: -251, 98: -251, 99: -251, 100: -251, 101: -251, 102: -251, 105: -251, 115: -251, 122: -251, 124: -251, 125: -251, 126: -251, 143: -251, 144: -251, 151: -251, 162: -251, 164: -251, 165: -251, 168: -251, 169: -251, 170: -251, 182: -251, 183: -251, 188: -251, 189: -251, 192: -251, 193: -251, 194: -251, 195: -251, 196: -251, 197: -251, 198: -251, 199: -251, 200: -251, 201: -251, 202: -251, 203: -251, 204: -251, 205: -251 }, { 96: 240 }, { 96: 241 }, { 11: -119, 31: -119, 39: -119, 43: -119, 47: -119, 50: -119, 54: -119, 56: -119, 57: -119, 64: -119, 65: -119, 71: -119, 72: -119, 73: -119, 74: -119, 75: -119, 76: -119, 84: -119, 86: -119, 92: -119, 95: -119, 103: -119, 104: -119, 106: -119, 107: -119, 119: -119, 120: -119, 121: -119, 122: -119, 129: -119, 131: -119, 139: -119, 146: -119, 156: -119, 160: -119, 161: -119, 164: -119, 165: -119, 167: -119, 171: -119, 173: -119, 179: -119, 181: -119, 184: -119, 185: -119, 186: -119, 187: -119, 188: -119, 189: -119, 190: -119, 191: -119 }, { 11: -120, 31: -120, 39: -120, 43: -120, 47: -120, 50: -120, 54: -120, 56: -120, 57: -120, 64: -120, 65: -120, 71: -120, 72: -120, 73: -120, 74: -120, 75: -120, 76: -120, 84: -120, 86: -120, 92: -120, 95: -120, 103: -120, 104: -120, 106: -120, 107: -120, 119: -120, 120: -120, 121: -120, 122: -120, 129: -120, 131: -120, 139: -120, 146: -120, 156: -120, 160: -120, 161: -120, 164: -120, 165: -120, 167: -120, 171: -120, 173: -120, 179: -120, 181: -120, 184: -120, 185: -120, 186: -120, 187: -120, 188: -120, 189: -120, 190: -120, 191: -120 }, { 1: -137, 6: -137, 33: -137, 35: -137, 38: -137, 39: -137, 40: -137, 41: -137, 42: -137, 56: -137, 57: -137, 62: -137, 69: -137, 77: -137, 81: -137, 85: -137, 87: -137, 96: -137, 97: -137, 98: -137, 99: -137, 100: -137, 101: -137, 102: -137, 105: -137, 115: -137, 122: -137, 124: -137, 125: -137, 126: -137, 130: -137, 143: -137, 144: -137, 151: -137, 162: -137, 164: -137, 165: -137, 168: -137, 169: -137, 170: -137, 182: -137, 183: -137, 188: -137, 189: -137, 190: -137, 191: -137, 192: -137, 193: -137, 194: -137, 195: -137, 196: -137, 197: -137, 198: -137, 199: -137, 200: -137, 201: -137, 202: -137, 203: -137, 204: -137, 205: -137, 206: -137 }, { 1: -138, 6: -138, 33: -138, 35: -138, 38: -138, 39: -138, 40: -138, 41: -138, 42: -138, 56: -138, 57: -138, 62: -138, 69: -138, 77: -138, 81: -138, 85: -138, 87: -138, 96: -138, 97: -138, 98: -138, 99: -138, 100: -138, 101: -138, 102: -138, 105: -138, 115: -138, 122: -138, 124: -138, 125: -138, 126: -138, 130: -138, 143: -138, 144: -138, 151: -138, 162: -138, 164: -138, 165: -138, 168: -138, 169: -138, 170: -138, 182: -138, 183: -138, 188: -138, 189: -138, 190: -138, 191: -138, 192: -138, 193: -138, 194: -138, 195: -138, 196: -138, 197: -138, 198: -138, 199: -138, 200: -138, 201: -138, 202: -138, 203: -138, 204: -138, 205: -138, 206: -138 }, { 7: 242, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 243, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 244, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 245, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 247, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 36: 246, 37: 30, 39: 157, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: -188, 32: 255, 39: -188, 40: -188, 50: 98, 51: 256, 52: 239, 53: 253, 54: 94, 55: 95, 56: 99, 57: 100, 69: -188, 78: 254, 79: 248, 80: 258, 82: 250, 83: 257, 84: 251, 86: 252, 87: 259, 125: -188, 128: 249 }, { 1: -53, 6: -53, 33: -53, 35: -53, 39: -53, 40: -53, 56: -53, 57: -53, 62: -53, 69: -53, 81: -53, 85: -53, 87: -53, 96: -53, 97: -53, 98: -53, 99: -53, 100: -53, 101: -53, 102: -53, 105: -53, 115: -53, 122: -53, 124: -53, 125: -53, 126: -53, 143: -53, 144: -53, 151: -53, 162: -53, 164: -53, 165: -53, 168: -53, 169: -53, 170: -53, 182: -53, 183: -53, 188: -53, 189: -53, 192: -53, 193: -53, 194: -53, 195: -53, 196: -53, 197: -53, 198: -53, 199: -53, 200: -53, 201: -53, 202: -53, 203: -53, 204: -53, 205: -53 }, { 1: -54, 6: -54, 33: -54, 35: -54, 39: -54, 40: -54, 56: -54, 57: -54, 62: -54, 69: -54, 81: -54, 85: -54, 87: -54, 96: -54, 97: -54, 98: -54, 99: -54, 100: -54, 101: -54, 102: -54, 105: -54, 115: -54, 122: -54, 124: -54, 125: -54, 126: -54, 143: -54, 144: -54, 151: -54, 162: -54, 164: -54, 165: -54, 168: -54, 169: -54, 170: -54, 182: -54, 183: -54, 188: -54, 189: -54, 192: -54, 193: -54, 194: -54, 195: -54, 196: -54, 197: -54, 198: -54, 199: -54, 200: -54, 201: -54, 202: -54, 203: -54, 204: -54, 205: -54 }, { 1: -63, 6: -63, 33: -63, 35: -63, 39: -63, 40: -63, 56: -63, 57: -63, 62: -63, 69: -63, 81: -63, 85: -63, 87: -63, 96: -63, 97: -63, 98: -63, 99: -63, 100: -63, 101: -63, 102: -63, 105: -63, 115: -63, 122: -63, 124: -63, 125: -63, 126: -63, 143: -63, 144: -63, 151: -63, 162: -63, 164: -63, 165: -63, 168: -63, 169: -63, 170: -63, 182: -63, 183: -63, 188: -63, 189: -63, 192: -63, 193: -63, 194: -63, 195: -63, 196: -63, 197: -63, 198: -63, 199: -63, 200: -63, 201: -63, 202: -63, 203: -63, 204: -63, 205: -63 }, { 14: 174, 15: 175, 32: 86, 37: 176, 44: 165, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 260, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 104: 164, 106: 84, 107: 85, 111: 66, 113: 261, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 146: 80, 161: 76, 186: 168 }, { 1: -51, 6: -51, 33: -51, 35: -51, 38: -51, 39: -51, 40: -51, 41: -51, 42: -51, 49: -51, 56: -51, 57: -51, 62: -51, 69: -51, 77: -51, 81: -51, 85: -51, 87: -51, 96: -51, 97: -51, 98: -51, 99: -51, 100: -51, 101: -51, 102: -51, 105: -51, 115: -51, 122: -51, 124: -51, 125: -51, 126: -51, 130: -51, 136: -51, 143: -51, 144: -51, 151: -51, 162: -51, 164: -51, 165: -51, 168: -51, 169: -51, 170: -51, 182: -51, 183: -51, 188: -51, 189: -51, 190: -51, 191: -51, 192: -51, 193: -51, 194: -51, 195: -51, 196: -51, 197: -51, 198: -51, 199: -51, 200: -51, 201: -51, 202: -51, 203: -51, 204: -51, 205: -51, 206: -51 }, { 1: -55, 6: -55, 33: -55, 35: -55, 39: -55, 40: -55, 56: -55, 57: -55, 59: -55, 61: -55, 62: -55, 67: -55, 69: -55, 81: -55, 85: -55, 87: -55, 96: -55, 97: -55, 98: -55, 99: -55, 100: -55, 101: -55, 102: -55, 105: -55, 115: -55, 122: -55, 124: -55, 125: -55, 126: -55, 143: -55, 144: -55, 151: -55, 162: -55, 164: -55, 165: -55, 168: -55, 169: -55, 170: -55, 182: -55, 183: -55, 188: -55, 189: -55, 192: -55, 193: -55, 194: -55, 195: -55, 196: -55, 197: -55, 198: -55, 199: -55, 200: -55, 201: -55, 202: -55, 203: -55, 204: -55, 205: -55 }, { 55: 265, 56: 99, 57: 100, 58: 262, 60: 263, 61: 264 }, { 1: -5, 5: 266, 6: -5, 7: 4, 8: 5, 9: 6, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 40: -5, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 62: -5, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 162: -5, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -375, 6: -375, 35: -375, 39: -375, 40: -375, 62: -375, 69: -375, 81: -375, 85: -375, 87: -375, 101: -375, 105: -375, 122: -375, 124: -375, 125: -375, 126: -375, 151: -375, 162: -375, 164: -375, 165: -375, 168: -375, 169: -375, 170: -375, 182: -375, 183: -375, 188: -375, 189: -375, 192: -375, 193: -375, 194: -375, 195: -375, 196: -375, 197: -375, 198: -375, 199: -375, 200: -375, 201: -375, 202: -375, 203: -375, 204: -375, 205: -375 }, { 7: 267, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 268, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 269, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 270, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 271, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 272, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 273, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 274, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 275, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 276, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 277, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 278, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 279, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 280, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 281, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 282, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 283, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -304, 6: -304, 35: -304, 39: -304, 40: -304, 62: -304, 69: -304, 81: -304, 85: -304, 87: -304, 101: -304, 105: -304, 122: -304, 124: -304, 125: -304, 126: -304, 151: -304, 162: -304, 164: -304, 165: -304, 168: -304, 169: -304, 170: -304, 182: -304, 183: -304, 188: -304, 189: -304, 192: -304, 193: -304, 194: -304, 195: -304, 196: -304, 197: -304, 198: -304, 199: -304, 200: -304, 201: -304, 202: -304, 203: -304, 204: -304, 205: -304 }, { 32: 149, 48: 152, 50: 98, 83: 150, 84: 77, 86: 153, 110: 191, 111: 151, 116: 287, 121: 93, 123: 284, 127: 285, 171: 286, 172: 190 }, { 7: 288, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 289, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -303, 6: -303, 35: -303, 39: -303, 40: -303, 62: -303, 69: -303, 81: -303, 85: -303, 87: -303, 101: -303, 105: -303, 122: -303, 124: -303, 125: -303, 126: -303, 151: -303, 162: -303, 164: -303, 165: -303, 168: -303, 169: -303, 170: -303, 182: -303, 183: -303, 188: -303, 189: -303, 192: -303, 193: -303, 194: -303, 195: -303, 196: -303, 197: -303, 198: -303, 199: -303, 200: -303, 201: -303, 202: -303, 203: -303, 204: -303, 205: -303 }, { 33: 236, 55: 290, 56: 99, 57: 100, 94: 291 }, { 33: 236, 94: 292 }, { 51: 293, 52: 239 }, { 51: 294, 52: 239 }, { 1: -143, 6: -143, 33: -143, 35: -143, 38: -143, 39: -143, 40: -143, 41: -143, 42: -143, 51: 295, 52: 239, 56: -143, 57: -143, 62: -143, 69: -143, 77: -143, 81: -143, 85: -143, 87: -143, 96: -143, 97: -143, 98: -143, 99: -143, 100: -143, 101: -143, 102: -143, 105: -143, 115: -143, 122: -143, 124: -143, 125: -143, 126: -143, 130: -143, 143: -143, 144: -143, 151: -143, 162: -143, 164: -143, 165: -143, 168: -143, 169: -143, 170: -143, 182: -143, 183: -143, 188: -143, 189: -143, 190: -143, 191: -143, 192: -143, 193: -143, 194: -143, 195: -143, 196: -143, 197: -143, 198: -143, 199: -143, 200: -143, 201: -143, 202: -143, 203: -143, 204: -143, 205: -143, 206: -143 }, { 1: -144, 6: -144, 33: -144, 35: -144, 38: -144, 39: -144, 40: -144, 41: -144, 42: -144, 51: 296, 52: 239, 56: -144, 57: -144, 62: -144, 69: -144, 77: -144, 81: -144, 85: -144, 87: -144, 96: -144, 97: -144, 98: -144, 99: -144, 100: -144, 101: -144, 102: -144, 105: -144, 115: -144, 122: -144, 124: -144, 125: -144, 126: -144, 130: -144, 143: -144, 144: -144, 151: -144, 162: -144, 164: -144, 165: -144, 168: -144, 169: -144, 170: -144, 182: -144, 183: -144, 188: -144, 189: -144, 190: -144, 191: -144, 192: -144, 193: -144, 194: -144, 195: -144, 196: -144, 197: -144, 198: -144, 199: -144, 200: -144, 201: -144, 202: -144, 203: -144, 204: -144, 205: -144, 206: -144 }, { 7: 297, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 298, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 302, 64: 96, 65: 97, 66: 34, 68: 300, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 87: 304, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 114: 299, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 150: 301, 151: 303, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 100: 305 }, { 100: 306 }, { 33: -247, 56: -247, 57: -247 }, { 51: 307, 52: 239 }, { 51: 308, 52: 239 }, { 1: -160, 6: -160, 33: -160, 35: -160, 38: -160, 39: -160, 40: -160, 41: -160, 42: -160, 51: 309, 52: 239, 56: -160, 57: -160, 62: -160, 69: -160, 77: -160, 81: -160, 85: -160, 87: -160, 96: -160, 97: -160, 98: -160, 99: -160, 100: -160, 101: -160, 102: -160, 105: -160, 115: -160, 122: -160, 124: -160, 125: -160, 126: -160, 130: -160, 143: -160, 144: -160, 151: -160, 162: -160, 164: -160, 165: -160, 168: -160, 169: -160, 170: -160, 182: -160, 183: -160, 188: -160, 189: -160, 190: -160, 191: -160, 192: -160, 193: -160, 194: -160, 195: -160, 196: -160, 197: -160, 198: -160, 199: -160, 200: -160, 201: -160, 202: -160, 203: -160, 204: -160, 205: -160, 206: -160 }, { 1: -161, 6: -161, 33: -161, 35: -161, 38: -161, 39: -161, 40: -161, 41: -161, 42: -161, 51: 310, 52: 239, 56: -161, 57: -161, 62: -161, 69: -161, 77: -161, 81: -161, 85: -161, 87: -161, 96: -161, 97: -161, 98: -161, 99: -161, 100: -161, 101: -161, 102: -161, 105: -161, 115: -161, 122: -161, 124: -161, 125: -161, 126: -161, 130: -161, 143: -161, 144: -161, 151: -161, 162: -161, 164: -161, 165: -161, 168: -161, 169: -161, 170: -161, 182: -161, 183: -161, 188: -161, 189: -161, 190: -161, 191: -161, 192: -161, 193: -161, 194: -161, 195: -161, 196: -161, 197: -161, 198: -161, 199: -161, 200: -161, 201: -161, 202: -161, 203: -161, 204: -161, 205: -161, 206: -161 }, { 7: 311, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 312, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 100: 313 }, { 6: 315, 7: 314, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 316, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: 318, 7: 317, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 319, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: 321, 7: 320, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 322, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: 324, 7: 323, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 325, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: -121, 35: -121, 39: -121, 40: -121, 69: 327, 85: -121, 105: 326, 108: 328, 125: -121 }, { 6: -124, 35: -124, 39: -124, 40: -124, 69: -124, 105: -124 }, { 6: -128, 35: -128, 39: -128, 40: -128, 69: -128, 77: 329, 105: -128 }, { 6: -131, 32: 149, 35: -131, 39: -131, 40: -131, 48: 152, 50: 98, 69: -131, 83: 150, 84: 154, 86: 153, 105: -131, 110: 330, 111: 151, 121: 93 }, { 6: -132, 35: -132, 39: -132, 40: -132, 69: -132, 77: -132, 105: -132, 124: -132, 168: -132, 170: -132 }, { 6: -133, 35: -133, 39: -133, 40: -133, 69: -133, 77: -133, 105: -133, 124: -133, 168: -133, 170: -133 }, { 6: -134, 35: -134, 39: -134, 40: -134, 69: -134, 77: -134, 105: -134, 124: -134, 168: -134, 170: -134 }, { 6: -135, 35: -135, 39: -135, 40: -135, 69: -135, 77: -135, 105: -135, 124: -135, 168: -135, 170: -135 }, { 51: 238, 52: 239 }, { 7: 331, 8: 230, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 227, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 69: 228, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 85: 222, 86: 81, 87: 232, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 112: 231, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 147: 223, 148: 224, 152: 229, 153: 226, 154: 225, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -116, 6: -116, 33: -116, 35: -116, 39: -116, 40: -116, 56: -116, 57: -116, 62: -116, 69: -116, 81: -116, 85: -116, 87: -116, 96: -116, 97: -116, 98: -116, 99: -116, 100: -116, 101: -116, 102: -116, 105: -116, 115: -116, 122: -116, 124: -116, 125: -116, 126: -116, 143: -116, 144: -116, 151: -116, 162: -116, 164: -116, 165: -116, 168: -116, 169: -116, 170: -116, 182: -116, 183: -116, 188: -116, 189: -116, 192: -116, 193: -116, 194: -116, 195: -116, 196: -116, 197: -116, 198: -116, 199: -116, 200: -116, 201: -116, 202: -116, 203: -116, 204: -116, 205: -116 }, { 1: -118, 6: -118, 35: -118, 39: -118, 40: -118, 62: -118, 69: -118, 85: -118, 162: -118 }, { 4: 333, 5: 3, 7: 4, 8: 5, 9: 6, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 40: 332, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -364, 6: -364, 35: -364, 39: -364, 40: -364, 62: -364, 69: -364, 81: -364, 85: -364, 87: -364, 101: -364, 105: -364, 122: -364, 124: -364, 125: -364, 126: -364, 151: -364, 162: -364, 163: 120, 164: -364, 165: -364, 168: -364, 169: -364, 170: -364, 182: -364, 183: 119, 188: -364, 189: -364, 192: 102, 193: -364, 194: -364, 195: -364, 196: -364, 197: -364, 198: -364, 199: -364, 200: -364, 201: -364, 202: 114, 203: 115, 204: -364, 205: -364 }, { 1: -361, 6: -361, 35: -361, 39: -361, 40: -361, 62: -361, 69: -361, 85: -361, 162: -361 }, { 163: 124, 164: 90, 165: 91, 182: 122, 183: 123 }, { 1: -365, 6: -365, 35: -365, 39: -365, 40: -365, 62: -365, 69: -365, 81: -365, 85: -365, 87: -365, 101: -365, 105: -365, 122: -365, 124: -365, 125: -365, 126: -365, 151: -365, 162: -365, 163: 120, 164: -365, 165: -365, 168: -365, 169: -365, 170: -365, 182: -365, 183: 119, 188: -365, 189: -365, 192: 102, 193: -365, 194: -365, 195: -365, 196: -365, 197: -365, 198: -365, 199: -365, 200: -365, 201: -365, 202: 114, 203: 115, 204: -365, 205: -365 }, { 1: -362, 6: -362, 35: -362, 39: -362, 40: -362, 62: -362, 69: -362, 85: -362, 162: -362 }, { 1: -366, 6: -366, 35: -366, 39: -366, 40: -366, 62: -366, 69: -366, 81: -366, 85: -366, 87: -366, 101: -366, 105: -366, 122: -366, 124: -366, 125: -366, 126: -366, 151: -366, 162: -366, 163: 120, 164: -366, 165: -366, 168: -366, 169: -366, 170: -366, 182: -366, 183: 119, 188: -366, 189: -366, 192: 102, 193: -366, 194: 106, 195: -366, 196: -366, 197: -366, 198: -366, 199: -366, 200: -366, 201: -366, 202: 114, 203: 115, 204: -366, 205: -366 }, { 6: -123, 32: 149, 34: 334, 35: -123, 39: -123, 40: -123, 48: 152, 50: 98, 69: -123, 83: 150, 84: 154, 86: 153, 87: 148, 105: -123, 109: 146, 110: 147, 111: 151, 121: 93 }, { 36: 155, 39: 157 }, { 7: 158, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 161, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 15: 204, 44: 165, 104: 164, 106: 84, 107: 85 }, { 1: -367, 6: -367, 35: -367, 39: -367, 40: -367, 62: -367, 69: -367, 81: -367, 85: -367, 87: -367, 101: -367, 105: -367, 122: -367, 124: -367, 125: -367, 126: -367, 151: -367, 162: -367, 163: 120, 164: -367, 165: -367, 168: -367, 169: -367, 170: -367, 182: -367, 183: 119, 188: -367, 189: -367, 192: 102, 193: -367, 194: 106, 195: -367, 196: -367, 197: -367, 198: -367, 199: -367, 200: -367, 201: -367, 202: 114, 203: 115, 204: -367, 205: -367 }, { 1: -368, 6: -368, 35: -368, 39: -368, 40: -368, 62: -368, 69: -368, 81: -368, 85: -368, 87: -368, 101: -368, 105: -368, 122: -368, 124: -368, 125: -368, 126: -368, 151: -368, 162: -368, 163: 120, 164: -368, 165: -368, 168: -368, 169: -368, 170: -368, 182: -368, 183: 119, 188: -368, 189: -368, 192: 102, 193: -368, 194: 106, 195: -368, 196: -368, 197: -368, 198: -368, 199: -368, 200: -368, 201: -368, 202: 114, 203: 115, 204: -368, 205: -368 }, { 1: -369, 6: -369, 35: -369, 39: -369, 40: -369, 62: -369, 69: -369, 81: -369, 85: -369, 87: -369, 101: -369, 105: -369, 122: -369, 124: -369, 125: -369, 126: -369, 151: -369, 162: -369, 163: 120, 164: -369, 165: -369, 168: -369, 169: -369, 170: -369, 182: -369, 183: 119, 188: -369, 189: -369, 192: 102, 193: -369, 194: -369, 195: -369, 196: -369, 197: -369, 198: -369, 199: -369, 200: -369, 201: -369, 202: 114, 203: 115, 204: -369, 205: -369 }, { 48: 335, 121: 93 }, { 1: -371, 6: -371, 33: -166, 35: -371, 38: -166, 39: -371, 40: -371, 41: -166, 42: -166, 56: -166, 57: -166, 62: -371, 69: -371, 77: -166, 81: -371, 85: -371, 87: -371, 96: -166, 97: -166, 98: -166, 99: -166, 100: -166, 101: -371, 102: -166, 105: -371, 115: -166, 122: -371, 124: -371, 125: -371, 126: -371, 143: -166, 144: -166, 151: -371, 162: -371, 164: -371, 165: -371, 168: -371, 169: -371, 170: -371, 182: -371, 183: -371, 188: -371, 189: -371, 192: -371, 193: -371, 194: -371, 195: -371, 196: -371, 197: -371, 198: -371, 199: -371, 200: -371, 201: -371, 202: -371, 203: -371, 204: -371, 205: -371 }, { 33: -246, 56: -246, 57: -246, 93: 125, 96: 127, 97: 128, 98: 129, 99: 130, 100: 131, 102: 132, 115: 133, 143: 126, 144: 134 }, { 96: 135, 97: 136, 98: 137, 99: 138, 100: 139, 102: 140 }, { 1: -169, 6: -169, 33: -169, 35: -169, 39: -169, 40: -169, 56: -169, 57: -169, 62: -169, 69: -169, 81: -169, 85: -169, 87: -169, 96: -169, 97: -169, 98: -169, 99: -169, 100: -169, 101: -169, 102: -169, 105: -169, 115: -169, 122: -169, 124: -169, 125: -169, 126: -169, 143: -169, 144: -169, 151: -169, 162: -169, 164: -169, 165: -169, 168: -169, 169: -169, 170: -169, 182: -169, 183: -169, 188: -169, 189: -169, 192: -169, 193: -169, 194: -169, 195: -169, 196: -169, 197: -169, 198: -169, 199: -169, 200: -169, 201: -169, 202: -169, 203: -169, 204: -169, 205: -169 }, { 1: -372, 6: -372, 33: -166, 35: -372, 38: -166, 39: -372, 40: -372, 41: -166, 42: -166, 56: -166, 57: -166, 62: -372, 69: -372, 77: -166, 81: -372, 85: -372, 87: -372, 96: -166, 97: -166, 98: -166, 99: -166, 100: -166, 101: -372, 102: -166, 105: -372, 115: -166, 122: -372, 124: -372, 125: -372, 126: -372, 143: -166, 144: -166, 151: -372, 162: -372, 164: -372, 165: -372, 168: -372, 169: -372, 170: -372, 182: -372, 183: -372, 188: -372, 189: -372, 192: -372, 193: -372, 194: -372, 195: -372, 196: -372, 197: -372, 198: -372, 199: -372, 200: -372, 201: -372, 202: -372, 203: -372, 204: -372, 205: -372 }, { 1: -373, 6: -373, 35: -373, 39: -373, 40: -373, 62: -373, 69: -373, 81: -373, 85: -373, 87: -373, 101: -373, 105: -373, 122: -373, 124: -373, 125: -373, 126: -373, 151: -373, 162: -373, 164: -373, 165: -373, 168: -373, 169: -373, 170: -373, 182: -373, 183: -373, 188: -373, 189: -373, 192: -373, 193: -373, 194: -373, 195: -373, 196: -373, 197: -373, 198: -373, 199: -373, 200: -373, 201: -373, 202: -373, 203: -373, 204: -373, 205: -373 }, { 1: -374, 6: -374, 35: -374, 39: -374, 40: -374, 62: -374, 69: -374, 81: -374, 85: -374, 87: -374, 101: -374, 105: -374, 122: -374, 124: -374, 125: -374, 126: -374, 151: -374, 162: -374, 164: -374, 165: -374, 168: -374, 169: -374, 170: -374, 182: -374, 183: -374, 188: -374, 189: -374, 192: -374, 193: -374, 194: -374, 195: -374, 196: -374, 197: -374, 198: -374, 199: -374, 200: -374, 201: -374, 202: -374, 203: -374, 204: -374, 205: -374 }, { 6: 338, 7: 336, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 337, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 36: 339, 39: 157 }, { 1: -42, 6: -42, 35: -42, 39: -42, 40: -42, 62: -42, 69: -42, 81: -42, 85: -42, 87: -42, 101: -42, 105: -42, 122: -42, 124: -42, 125: -42, 126: -42, 151: -42, 162: -42, 164: -42, 165: -42, 168: -42, 169: -42, 170: -42, 182: -42, 183: -42, 188: -42, 189: -42, 192: -42, 193: -42, 194: -42, 195: -42, 196: -42, 197: -42, 198: -42, 199: -42, 200: -42, 201: -42, 202: -42, 203: -42, 204: -42, 205: -42 }, { 36: 340, 39: 157, 179: 341 }, { 1: -287, 6: -287, 35: -287, 39: -287, 40: -287, 62: -287, 69: -287, 81: -287, 85: -287, 87: -287, 101: -287, 105: -287, 122: -287, 124: -287, 125: -287, 126: -287, 151: -287, 157: 342, 158: 343, 159: 344, 162: -287, 164: -287, 165: -287, 168: -287, 169: -287, 170: -287, 182: -287, 183: -287, 188: -287, 189: -287, 192: -287, 193: -287, 194: -287, 195: -287, 196: -287, 197: -287, 198: -287, 199: -287, 200: -287, 201: -287, 202: -287, 203: -287, 204: -287, 205: -287 }, { 1: -302, 6: -302, 35: -302, 39: -302, 40: -302, 62: -302, 69: -302, 81: -302, 85: -302, 87: -302, 101: -302, 105: -302, 122: -302, 124: -302, 125: -302, 126: -302, 151: -302, 162: -302, 164: -302, 165: -302, 168: -302, 169: -302, 170: -302, 182: -302, 183: -302, 188: -302, 189: -302, 192: -302, 193: -302, 194: -302, 195: -302, 196: -302, 197: -302, 198: -302, 199: -302, 200: -302, 201: -302, 202: -302, 203: -302, 204: -302, 205: -302 }, { 124: 346, 168: 345, 170: 347 }, { 32: 149, 48: 152, 50: 98, 83: 150, 84: 154, 86: 153, 110: 191, 111: 151, 121: 93, 123: 348, 172: 190 }, { 32: 149, 48: 152, 50: 98, 83: 150, 84: 154, 86: 153, 110: 191, 111: 151, 121: 93, 123: 349, 172: 190 }, { 36: 350, 39: 157, 169: 351 }, { 69: 352, 124: -340, 168: -340, 170: -340 }, { 69: -338, 77: 353, 124: -338, 168: -338, 170: -338 }, { 39: 354, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 174: 355, 176: 356, 177: 357 }, { 1: -194, 6: -194, 35: -194, 39: -194, 40: -194, 62: -194, 69: -194, 81: -194, 85: -194, 87: -194, 101: -194, 105: -194, 122: -194, 124: -194, 125: -194, 126: -194, 151: -194, 162: -194, 164: -194, 165: -194, 168: -194, 169: -194, 170: -194, 182: -194, 183: -194, 188: -194, 189: -194, 192: -194, 193: -194, 194: -194, 195: -194, 196: -194, 197: -194, 198: -194, 199: -194, 200: -194, 201: -194, 202: -194, 203: -194, 204: -194, 205: -194 }, { 7: 358, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -197, 6: -197, 33: -166, 35: -197, 36: 359, 38: -166, 39: 157, 40: -197, 41: -166, 42: -166, 56: -166, 57: -166, 62: -197, 69: -197, 77: -166, 81: -197, 85: -197, 87: -197, 96: -166, 97: -166, 98: -166, 99: -166, 100: -166, 101: -197, 102: -166, 105: -197, 115: -166, 122: -197, 124: -197, 125: -197, 126: -197, 130: 360, 143: -166, 144: -166, 151: -197, 162: -197, 164: -197, 165: -197, 168: -197, 169: -197, 170: -197, 182: -197, 183: -197, 188: -197, 189: -197, 192: -197, 193: -197, 194: -197, 195: -197, 196: -197, 197: -197, 198: -197, 199: -197, 200: -197, 201: -197, 202: -197, 203: -197, 204: -197, 205: -197 }, { 1: -294, 6: -294, 35: -294, 39: -294, 40: -294, 62: -294, 69: -294, 81: -294, 85: -294, 87: -294, 101: -294, 105: -294, 122: -294, 124: -294, 125: -294, 126: -294, 151: -294, 162: -294, 163: 120, 164: -294, 165: -294, 168: -294, 169: -294, 170: -294, 182: -294, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 48: 361, 121: 93 }, { 1: -46, 6: -46, 35: -46, 39: -46, 40: -46, 62: -46, 69: -46, 81: -46, 85: -46, 87: -46, 101: -46, 105: -46, 122: -46, 124: -46, 125: -46, 126: -46, 151: -46, 162: -46, 163: 120, 164: -46, 165: -46, 168: -46, 169: -46, 170: -46, 182: -46, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 48: 362, 121: 93 }, { 7: 363, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 33: 364, 36: 365, 39: 157 }, { 1: -363, 6: -363, 35: -363, 39: -363, 40: -363, 62: -363, 69: -363, 85: -363, 162: -363 }, { 1: -394, 6: -394, 33: -394, 35: -394, 39: -394, 40: -394, 56: -394, 57: -394, 62: -394, 69: -394, 81: -394, 85: -394, 87: -394, 96: -394, 97: -394, 98: -394, 99: -394, 100: -394, 101: -394, 102: -394, 105: -394, 115: -394, 122: -394, 124: -394, 125: -394, 126: -394, 143: -394, 144: -394, 151: -394, 162: -394, 164: -394, 165: -394, 168: -394, 169: -394, 170: -394, 182: -394, 183: -394, 188: -394, 189: -394, 192: -394, 193: -394, 194: -394, 195: -394, 196: -394, 197: -394, 198: -394, 199: -394, 200: -394, 201: -394, 202: -394, 203: -394, 204: -394, 205: -394 }, { 1: -112, 6: -112, 35: -112, 39: -112, 40: -112, 62: -112, 69: -112, 85: -112, 122: 121, 162: -112, 163: 120, 164: -112, 165: -112, 182: -112, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 48: 366, 121: 93 }, { 1: -201, 6: -201, 35: -201, 39: -201, 40: -201, 62: -201, 69: -201, 85: -201, 162: -201, 164: -201, 165: -201, 182: -201, 183: -201 }, { 49: 367, 69: 368 }, { 49: 369 }, { 32: 374, 39: 373, 50: 98, 125: 370, 134: 371, 135: 372, 137: 375 }, { 49: -217, 69: -217 }, { 136: 376 }, { 32: 381, 39: 380, 50: 98, 125: 377, 137: 382, 140: 378, 142: 379 }, { 1: -221, 6: -221, 35: -221, 39: -221, 40: -221, 62: -221, 69: -221, 85: -221, 162: -221, 164: -221, 165: -221, 182: -221, 183: -221 }, { 1: -222, 6: -222, 35: -222, 39: -222, 40: -222, 62: -222, 69: -222, 85: -222, 162: -222, 164: -222, 165: -222, 182: -222, 183: -222 }, { 77: 383 }, { 7: 384, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 385, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 49: 386 }, { 6: 101, 162: 387 }, { 4: 388, 5: 3, 7: 4, 8: 5, 9: 6, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: -268, 35: -268, 39: -268, 40: -268, 69: -268, 85: -268, 87: 304, 122: 121, 150: 389, 151: 303, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -253, 6: -253, 33: -253, 35: -253, 38: -253, 39: -253, 40: -253, 41: -253, 42: -253, 56: -253, 57: -253, 62: -253, 69: -253, 77: -253, 81: -253, 85: -253, 87: -253, 96: -253, 97: -253, 98: -253, 99: -253, 100: -253, 101: -253, 102: -253, 105: -253, 115: -253, 122: -253, 124: -253, 125: -253, 126: -253, 143: -253, 144: -253, 151: -253, 162: -253, 164: -253, 165: -253, 168: -253, 169: -253, 170: -253, 182: -253, 183: -253, 188: -253, 189: -253, 192: -253, 193: -253, 194: -253, 195: -253, 196: -253, 197: -253, 198: -253, 199: -253, 200: -253, 201: -253, 202: -253, 203: -253, 204: -253, 205: -253 }, { 7: 331, 8: 230, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 69: 228, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 85: 390, 86: 81, 87: 232, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 112: 231, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 152: 392, 154: 391, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: -121, 35: -121, 39: -121, 40: -121, 69: 394, 85: -121, 108: 395, 125: -121, 149: 393 }, { 6: 396, 11: -281, 31: -281, 39: -281, 40: -281, 43: -281, 47: -281, 50: -281, 54: -281, 56: -281, 57: -281, 64: -281, 65: -281, 69: -281, 71: -281, 72: -281, 73: -281, 74: -281, 75: -281, 76: -281, 84: -281, 85: -281, 86: -281, 87: -281, 92: -281, 95: -281, 103: -281, 104: -281, 106: -281, 107: -281, 119: -281, 120: -281, 121: -281, 122: -281, 129: -281, 131: -281, 139: -281, 146: -281, 156: -281, 160: -281, 161: -281, 164: -281, 165: -281, 167: -281, 171: -281, 173: -281, 179: -281, 181: -281, 184: -281, 185: -281, 186: -281, 187: -281, 188: -281, 189: -281, 190: -281, 191: -281 }, { 6: -272, 39: -272, 40: -272, 69: -272, 85: -272 }, { 7: 331, 8: 230, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 227, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 69: 228, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 87: 232, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 112: 231, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 147: 398, 148: 397, 152: 229, 153: 226, 154: 225, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: -283, 11: -283, 31: -283, 39: -283, 40: -283, 43: -283, 47: -283, 50: -283, 54: -283, 56: -283, 57: -283, 64: -283, 65: -283, 69: -283, 71: -283, 72: -283, 73: -283, 74: -283, 75: -283, 76: -283, 84: -283, 85: -283, 86: -283, 87: -283, 92: -283, 95: -283, 103: -283, 104: -283, 106: -283, 107: -283, 119: -283, 120: -283, 121: -283, 122: -283, 129: -283, 131: -283, 139: -283, 146: -283, 156: -283, 160: -283, 161: -283, 164: -283, 165: -283, 167: -283, 171: -283, 173: -283, 179: -283, 181: -283, 184: -283, 185: -283, 186: -283, 187: -283, 188: -283, 189: -283, 190: -283, 191: -283 }, { 6: -277, 39: -277, 40: -277, 69: -277, 85: -277 }, { 6: -269, 35: -269, 39: -269, 40: -269, 69: -269, 85: -269 }, { 6: -270, 35: -270, 39: -270, 40: -270, 69: -270, 85: -270 }, { 6: -271, 7: 399, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 35: -271, 37: 30, 39: -271, 40: -271, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 69: -271, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 85: -271, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -244, 6: -244, 33: -244, 35: -244, 39: -244, 40: -244, 56: -244, 57: -244, 62: -244, 67: -244, 69: -244, 81: -244, 85: -244, 87: -244, 96: -244, 97: -244, 98: -244, 99: -244, 100: -244, 101: -244, 102: -244, 105: -244, 115: -244, 122: -244, 124: -244, 125: -244, 126: -244, 143: -244, 144: -244, 151: -244, 162: -244, 164: -244, 165: -244, 168: -244, 169: -244, 170: -244, 182: -244, 183: -244, 188: -244, 189: -244, 192: -244, 193: -244, 194: -244, 195: -244, 196: -244, 197: -244, 198: -244, 199: -244, 200: -244, 201: -244, 202: -244, 203: -244, 204: -244, 205: -244 }, { 51: 400, 52: 239 }, { 7: 401, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 402, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 331, 8: 230, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 35: 403, 37: 30, 39: 406, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 87: 232, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 112: 231, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 145: 404, 146: 80, 152: 405, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -245, 6: -245, 33: -245, 35: -245, 39: -245, 40: -245, 56: -245, 57: -245, 62: -245, 67: -245, 69: -245, 81: -245, 85: -245, 87: -245, 96: -245, 97: -245, 98: -245, 99: -245, 100: -245, 101: -245, 102: -245, 105: -245, 115: -245, 122: -245, 124: -245, 125: -245, 126: -245, 143: -245, 144: -245, 151: -245, 162: -245, 164: -245, 165: -245, 168: -245, 169: -245, 170: -245, 182: -245, 183: -245, 188: -245, 189: -245, 192: -245, 193: -245, 194: -245, 195: -245, 196: -245, 197: -245, 198: -245, 199: -245, 200: -245, 201: -245, 202: -245, 203: -245, 204: -245, 205: -245 }, { 1: -252, 6: -252, 33: -252, 35: -252, 38: -252, 39: -252, 40: -252, 41: -252, 42: -252, 56: -252, 57: -252, 62: -252, 69: -252, 77: -252, 81: -252, 85: -252, 87: -252, 96: -252, 97: -252, 98: -252, 99: -252, 100: -252, 101: -252, 102: -252, 105: -252, 115: -252, 122: -252, 124: -252, 125: -252, 126: -252, 130: -252, 143: -252, 144: -252, 151: -252, 162: -252, 164: -252, 165: -252, 168: -252, 169: -252, 170: -252, 182: -252, 183: -252, 188: -252, 189: -252, 190: -252, 191: -252, 192: -252, 193: -252, 194: -252, 195: -252, 196: -252, 197: -252, 198: -252, 199: -252, 200: -252, 201: -252, 202: -252, 203: -252, 204: -252, 205: -252, 206: -252 }, { 1: -52, 6: -52, 33: -52, 35: -52, 38: -52, 39: -52, 40: -52, 41: -52, 42: -52, 56: -52, 57: -52, 62: -52, 69: -52, 77: -52, 81: -52, 85: -52, 87: -52, 96: -52, 97: -52, 98: -52, 99: -52, 100: -52, 101: -52, 102: -52, 105: -52, 115: -52, 122: -52, 124: -52, 125: -52, 126: -52, 130: -52, 143: -52, 144: -52, 151: -52, 162: -52, 164: -52, 165: -52, 168: -52, 169: -52, 170: -52, 182: -52, 183: -52, 188: -52, 189: -52, 190: -52, 191: -52, 192: -52, 193: -52, 194: -52, 195: -52, 196: -52, 197: -52, 198: -52, 199: -52, 200: -52, 201: -52, 202: -52, 203: -52, 204: -52, 205: -52, 206: -52 }, { 51: 407, 52: 239 }, { 51: 408, 52: 239 }, { 36: 409, 39: 157, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 36: 410, 39: 157, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -298, 6: -298, 35: -298, 39: -298, 40: -298, 62: -298, 69: -298, 81: -298, 85: -298, 87: -298, 101: -298, 105: -298, 122: 121, 124: -298, 125: -298, 126: 411, 151: -298, 162: -298, 163: 120, 164: 90, 165: 91, 168: -298, 169: -298, 170: -298, 182: -298, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -300, 6: -300, 35: -300, 39: -300, 40: -300, 62: -300, 69: -300, 81: -300, 85: -300, 87: -300, 101: -300, 105: -300, 122: 121, 124: -300, 125: -300, 126: 412, 151: -300, 162: -300, 163: 120, 164: 90, 165: 91, 168: -300, 169: -300, 170: -300, 182: -300, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -306, 6: -306, 35: -306, 39: -306, 40: -306, 62: -306, 69: -306, 81: -306, 85: -306, 87: -306, 101: -306, 105: -306, 122: -306, 124: -306, 125: -306, 126: -306, 151: -306, 162: -306, 164: -306, 165: -306, 168: -306, 169: -306, 170: -306, 182: -306, 183: -306, 188: -306, 189: -306, 192: -306, 193: -306, 194: -306, 195: -306, 196: -306, 197: -306, 198: -306, 199: -306, 200: -306, 201: -306, 202: -306, 203: -306, 204: -306, 205: -306 }, { 1: -307, 6: -307, 35: -307, 39: -307, 40: -307, 62: -307, 69: -307, 81: -307, 85: -307, 87: -307, 101: -307, 105: -307, 122: 121, 124: -307, 125: -307, 126: -307, 151: -307, 162: -307, 163: 120, 164: 90, 165: 91, 168: -307, 169: -307, 170: -307, 182: -307, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 6: -78, 39: -78, 40: -78, 69: -78, 81: 413, 125: -78 }, { 6: -121, 35: -121, 39: -121, 40: -121, 69: 415, 85: -121, 108: 414, 125: -121 }, { 6: -87, 39: -87, 40: -87, 69: -87, 77: 416, 81: -87, 125: -87 }, { 7: 417, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 51: 238, 52: 239, 84: 418 }, { 6: -90, 39: -90, 40: -90, 69: -90, 81: -90, 125: -90 }, { 6: -189, 39: -189, 40: -189, 69: -189, 125: -189 }, { 6: -84, 33: -84, 39: -84, 40: -84, 69: -84, 77: -84, 81: -84, 96: -84, 97: -84, 98: -84, 99: -84, 100: -84, 102: -84, 125: -84, 144: -84 }, { 6: -85, 33: -85, 39: -85, 40: -85, 69: -85, 77: -85, 81: -85, 96: -85, 97: -85, 98: -85, 99: -85, 100: -85, 102: -85, 125: -85, 144: -85 }, { 6: -86, 33: -86, 39: -86, 40: -86, 69: -86, 77: -86, 81: -86, 96: -86, 97: -86, 98: -86, 99: -86, 100: -86, 102: -86, 125: -86, 144: -86 }, { 6: -79, 39: -79, 40: -79, 69: -79, 125: -79 }, { 32: 255, 48: 421, 50: 98, 51: 256, 52: 239, 82: 419, 83: 257, 86: 81, 88: 420, 89: 422, 90: 423, 91: 424, 92: 425, 95: 426, 121: 93, 146: 80, 161: 76 }, { 1: -173, 6: -173, 33: -173, 35: -173, 39: -173, 40: -173, 56: -173, 57: -173, 62: -173, 67: 427, 69: -173, 81: -173, 85: -173, 87: -173, 96: -173, 97: -173, 98: -173, 99: -173, 100: -173, 101: -173, 102: -173, 105: -173, 115: -173, 122: -173, 124: -173, 125: -173, 126: -173, 143: -173, 144: -173, 151: -173, 162: -173, 164: -173, 165: -173, 168: -173, 169: -173, 170: -173, 182: -173, 183: -173, 188: -173, 189: -173, 192: -173, 193: -173, 194: -173, 195: -173, 196: -173, 197: -173, 198: -173, 199: -173, 200: -173, 201: -173, 202: -173, 203: -173, 204: -173, 205: -173 }, { 1: -166, 6: -166, 33: -166, 35: -166, 38: -166, 39: -166, 40: -166, 41: -166, 42: -166, 56: -166, 57: -166, 62: -166, 69: -166, 77: -166, 81: -166, 85: -166, 87: -166, 96: -166, 97: -166, 98: -166, 99: -166, 100: -166, 101: -166, 102: -166, 105: -166, 115: -166, 122: -166, 124: -166, 125: -166, 126: -166, 143: -166, 144: -166, 151: -166, 162: -166, 164: -166, 165: -166, 168: -166, 169: -166, 170: -166, 182: -166, 183: -166, 188: -166, 189: -166, 192: -166, 193: -166, 194: -166, 195: -166, 196: -166, 197: -166, 198: -166, 199: -166, 200: -166, 201: -166, 202: -166, 203: -166, 204: -166, 205: -166 }, { 55: 265, 56: 99, 57: 100, 59: 428, 60: 429, 61: 264 }, { 56: -57, 57: -57, 59: -57, 61: -57 }, { 4: 430, 5: 3, 7: 4, 8: 5, 9: 6, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 431, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 62: 432, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 56: -62, 57: -62, 59: -62, 61: -62 }, { 1: -4, 6: -4, 40: -4, 62: -4, 162: -4 }, { 1: -376, 6: -376, 35: -376, 39: -376, 40: -376, 62: -376, 69: -376, 81: -376, 85: -376, 87: -376, 101: -376, 105: -376, 122: -376, 124: -376, 125: -376, 126: -376, 151: -376, 162: -376, 163: 120, 164: -376, 165: -376, 168: -376, 169: -376, 170: -376, 182: -376, 183: 119, 188: -376, 189: -376, 192: 102, 193: 105, 194: 106, 195: -376, 196: -376, 197: -376, 198: -376, 199: -376, 200: -376, 201: -376, 202: 114, 203: 115, 204: -376, 205: -376 }, { 1: -377, 6: -377, 35: -377, 39: -377, 40: -377, 62: -377, 69: -377, 81: -377, 85: -377, 87: -377, 101: -377, 105: -377, 122: -377, 124: -377, 125: -377, 126: -377, 151: -377, 162: -377, 163: 120, 164: -377, 165: -377, 168: -377, 169: -377, 170: -377, 182: -377, 183: 119, 188: -377, 189: -377, 192: 102, 193: 105, 194: 106, 195: -377, 196: -377, 197: -377, 198: -377, 199: -377, 200: -377, 201: -377, 202: 114, 203: 115, 204: -377, 205: -377 }, { 1: -378, 6: -378, 35: -378, 39: -378, 40: -378, 62: -378, 69: -378, 81: -378, 85: -378, 87: -378, 101: -378, 105: -378, 122: -378, 124: -378, 125: -378, 126: -378, 151: -378, 162: -378, 163: 120, 164: -378, 165: -378, 168: -378, 169: -378, 170: -378, 182: -378, 183: 119, 188: -378, 189: -378, 192: 102, 193: -378, 194: 106, 195: -378, 196: -378, 197: -378, 198: -378, 199: -378, 200: -378, 201: -378, 202: 114, 203: 115, 204: -378, 205: -378 }, { 1: -379, 6: -379, 35: -379, 39: -379, 40: -379, 62: -379, 69: -379, 81: -379, 85: -379, 87: -379, 101: -379, 105: -379, 122: -379, 124: -379, 125: -379, 126: -379, 151: -379, 162: -379, 163: 120, 164: -379, 165: -379, 168: -379, 169: -379, 170: -379, 182: -379, 183: 119, 188: -379, 189: -379, 192: 102, 193: -379, 194: 106, 195: -379, 196: -379, 197: -379, 198: -379, 199: -379, 200: -379, 201: -379, 202: 114, 203: 115, 204: -379, 205: -379 }, { 1: -380, 6: -380, 35: -380, 39: -380, 40: -380, 62: -380, 69: -380, 81: -380, 85: -380, 87: -380, 101: -380, 105: -380, 122: -380, 124: -380, 125: -380, 126: -380, 151: -380, 162: -380, 163: 120, 164: -380, 165: -380, 168: -380, 169: -380, 170: -380, 182: -380, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: -380, 196: -380, 197: -380, 198: -380, 199: -380, 200: -380, 201: -380, 202: 114, 203: 115, 204: -380, 205: -380 }, { 1: -381, 6: -381, 35: -381, 39: -381, 40: -381, 62: -381, 69: -381, 81: -381, 85: -381, 87: -381, 101: -381, 105: -381, 122: -381, 124: -381, 125: -381, 126: -381, 151: -381, 162: -381, 163: 120, 164: -381, 165: -381, 168: -381, 169: -381, 170: -381, 182: -381, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: -381, 197: -381, 198: -381, 199: -381, 200: -381, 201: -381, 202: 114, 203: 115, 204: 116, 205: -381 }, { 1: -382, 6: -382, 35: -382, 39: -382, 40: -382, 62: -382, 69: -382, 81: -382, 85: -382, 87: -382, 101: -382, 105: -382, 122: -382, 124: -382, 125: -382, 126: -382, 151: -382, 162: -382, 163: 120, 164: -382, 165: -382, 168: -382, 169: -382, 170: -382, 182: -382, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: -382, 198: -382, 199: -382, 200: -382, 201: -382, 202: 114, 203: 115, 204: 116, 205: -382 }, { 1: -383, 6: -383, 35: -383, 39: -383, 40: -383, 62: -383, 69: -383, 81: -383, 85: -383, 87: -383, 101: -383, 105: -383, 122: -383, 124: -383, 125: -383, 126: -383, 151: -383, 162: -383, 163: 120, 164: -383, 165: -383, 168: -383, 169: -383, 170: -383, 182: -383, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: -383, 199: -383, 200: -383, 201: -383, 202: 114, 203: 115, 204: 116, 205: -383 }, { 1: -384, 6: -384, 35: -384, 39: -384, 40: -384, 62: -384, 69: -384, 81: -384, 85: -384, 87: -384, 101: -384, 105: -384, 122: -384, 124: -384, 125: -384, 126: -384, 151: -384, 162: -384, 163: 120, 164: -384, 165: -384, 168: -384, 169: -384, 170: -384, 182: -384, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: -384, 200: -384, 201: -384, 202: 114, 203: 115, 204: 116, 205: -384 }, { 1: -385, 6: -385, 35: -385, 39: -385, 40: -385, 62: -385, 69: -385, 81: -385, 85: -385, 87: -385, 101: -385, 105: -385, 122: -385, 124: -385, 125: -385, 126: -385, 151: -385, 162: -385, 163: 120, 164: -385, 165: -385, 168: -385, 169: -385, 170: -385, 182: -385, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: -385, 201: -385, 202: 114, 203: 115, 204: 116, 205: -385 }, { 1: -386, 6: -386, 35: -386, 39: -386, 40: -386, 62: -386, 69: -386, 81: -386, 85: -386, 87: -386, 101: -386, 105: -386, 122: -386, 124: -386, 125: -386, 126: -386, 151: -386, 162: -386, 163: 120, 164: -386, 165: -386, 168: -386, 169: -386, 170: -386, 182: -386, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: -386, 202: 114, 203: 115, 204: 116, 205: -386 }, { 1: -387, 6: -387, 35: -387, 39: -387, 40: -387, 62: -387, 69: -387, 81: -387, 85: -387, 87: -387, 101: -387, 105: -387, 122: 121, 124: -387, 125: -387, 126: -387, 151: -387, 162: -387, 163: 120, 164: 90, 165: 91, 168: -387, 169: -387, 170: -387, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -388, 6: -388, 35: -388, 39: -388, 40: -388, 62: -388, 69: -388, 81: -388, 85: -388, 87: -388, 101: -388, 105: -388, 122: 121, 124: -388, 125: -388, 126: -388, 151: -388, 162: -388, 163: 120, 164: 90, 165: 91, 168: -388, 169: -388, 170: -388, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -389, 6: -389, 35: -389, 39: -389, 40: -389, 62: -389, 69: -389, 81: -389, 85: -389, 87: -389, 101: -389, 105: -389, 122: -389, 124: -389, 125: -389, 126: -389, 151: -389, 162: -389, 163: 120, 164: -389, 165: -389, 168: -389, 169: -389, 170: -389, 182: -389, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: -389, 197: -389, 198: -389, 199: -389, 200: -389, 201: -389, 202: 114, 203: 115, 204: -389, 205: -389 }, { 81: 433, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -358, 6: -358, 35: -358, 39: -358, 40: -358, 62: -358, 69: -358, 81: -358, 85: -358, 87: -358, 101: -358, 105: -358, 122: 121, 124: -358, 125: -358, 126: -358, 151: -358, 162: -358, 163: 120, 164: 90, 165: 91, 168: -358, 169: -358, 170: -358, 182: -358, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -360, 6: -360, 35: -360, 39: -360, 40: -360, 62: -360, 69: -360, 81: -360, 85: -360, 87: -360, 101: -360, 105: -360, 122: 121, 124: -360, 125: -360, 126: -360, 151: -360, 162: -360, 163: 120, 164: 90, 165: 91, 168: -360, 169: -360, 170: -360, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 124: 435, 168: 434, 170: 436 }, { 32: 149, 48: 152, 50: 98, 83: 150, 84: 154, 86: 153, 110: 191, 111: 151, 121: 93, 123: 437, 172: 190 }, { 32: 149, 48: 152, 50: 98, 83: 150, 84: 154, 86: 153, 110: 191, 111: 151, 121: 93, 123: 438, 172: 190 }, { 1: -336, 6: -336, 35: -336, 39: -336, 40: -336, 62: -336, 69: -336, 81: -336, 85: -336, 87: -336, 101: -336, 105: -336, 122: -336, 124: -336, 125: -336, 126: -336, 151: -336, 162: -336, 164: -336, 165: -336, 168: -336, 169: 439, 170: -336, 182: -336, 183: -336, 188: -336, 189: -336, 192: -336, 193: -336, 194: -336, 195: -336, 196: -336, 197: -336, 198: -336, 199: -336, 200: -336, 201: -336, 202: -336, 203: -336, 204: -336, 205: -336 }, { 1: -357, 6: -357, 35: -357, 39: -357, 40: -357, 62: -357, 69: -357, 81: -357, 85: -357, 87: -357, 101: -357, 105: -357, 122: 121, 124: -357, 125: -357, 126: -357, 151: -357, 162: -357, 163: 120, 164: 90, 165: 91, 168: -357, 169: -357, 170: -357, 182: -357, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -359, 6: -359, 35: -359, 39: -359, 40: -359, 62: -359, 69: -359, 81: -359, 85: -359, 87: -359, 101: -359, 105: -359, 122: 121, 124: -359, 125: -359, 126: -359, 151: -359, 162: -359, 163: 120, 164: 90, 165: 91, 168: -359, 169: -359, 170: -359, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -241, 6: -241, 33: -241, 35: -241, 39: -241, 40: -241, 56: -241, 57: -241, 62: -241, 67: -241, 69: -241, 81: -241, 85: -241, 87: -241, 96: -241, 97: -241, 98: -241, 99: -241, 100: -241, 101: -241, 102: -241, 105: -241, 115: -241, 122: -241, 124: -241, 125: -241, 126: -241, 143: -241, 144: -241, 151: -241, 162: -241, 164: -241, 165: -241, 168: -241, 169: -241, 170: -241, 182: -241, 183: -241, 188: -241, 189: -241, 192: -241, 193: -241, 194: -241, 195: -241, 196: -241, 197: -241, 198: -241, 199: -241, 200: -241, 201: -241, 202: -241, 203: -241, 204: -241, 205: -241 }, { 1: -242, 6: -242, 33: -242, 35: -242, 39: -242, 40: -242, 56: -242, 57: -242, 62: -242, 67: -242, 69: -242, 81: -242, 85: -242, 87: -242, 96: -242, 97: -242, 98: -242, 99: -242, 100: -242, 101: -242, 102: -242, 105: -242, 115: -242, 122: -242, 124: -242, 125: -242, 126: -242, 143: -242, 144: -242, 151: -242, 162: -242, 164: -242, 165: -242, 168: -242, 169: -242, 170: -242, 182: -242, 183: -242, 188: -242, 189: -242, 192: -242, 193: -242, 194: -242, 195: -242, 196: -242, 197: -242, 198: -242, 199: -242, 200: -242, 201: -242, 202: -242, 203: -242, 204: -242, 205: -242 }, { 1: -243, 6: -243, 33: -243, 35: -243, 39: -243, 40: -243, 56: -243, 57: -243, 62: -243, 67: -243, 69: -243, 81: -243, 85: -243, 87: -243, 96: -243, 97: -243, 98: -243, 99: -243, 100: -243, 101: -243, 102: -243, 105: -243, 115: -243, 122: -243, 124: -243, 125: -243, 126: -243, 143: -243, 144: -243, 151: -243, 162: -243, 164: -243, 165: -243, 168: -243, 169: -243, 170: -243, 182: -243, 183: -243, 188: -243, 189: -243, 192: -243, 193: -243, 194: -243, 195: -243, 196: -243, 197: -243, 198: -243, 199: -243, 200: -243, 201: -243, 202: -243, 203: -243, 204: -243, 205: -243 }, { 1: -139, 6: -139, 33: -139, 35: -139, 38: -139, 39: -139, 40: -139, 41: -139, 42: -139, 56: -139, 57: -139, 62: -139, 69: -139, 77: -139, 81: -139, 85: -139, 87: -139, 96: -139, 97: -139, 98: -139, 99: -139, 100: -139, 101: -139, 102: -139, 105: -139, 115: -139, 122: -139, 124: -139, 125: -139, 126: -139, 130: -139, 143: -139, 144: -139, 151: -139, 162: -139, 164: -139, 165: -139, 168: -139, 169: -139, 170: -139, 182: -139, 183: -139, 188: -139, 189: -139, 190: -139, 191: -139, 192: -139, 193: -139, 194: -139, 195: -139, 196: -139, 197: -139, 198: -139, 199: -139, 200: -139, 201: -139, 202: -139, 203: -139, 204: -139, 205: -139, 206: -139 }, { 1: -140, 6: -140, 33: -140, 35: -140, 38: -140, 39: -140, 40: -140, 41: -140, 42: -140, 56: -140, 57: -140, 62: -140, 69: -140, 77: -140, 81: -140, 85: -140, 87: -140, 96: -140, 97: -140, 98: -140, 99: -140, 100: -140, 101: -140, 102: -140, 105: -140, 115: -140, 122: -140, 124: -140, 125: -140, 126: -140, 130: -140, 143: -140, 144: -140, 151: -140, 162: -140, 164: -140, 165: -140, 168: -140, 169: -140, 170: -140, 182: -140, 183: -140, 188: -140, 189: -140, 190: -140, 191: -140, 192: -140, 193: -140, 194: -140, 195: -140, 196: -140, 197: -140, 198: -140, 199: -140, 200: -140, 201: -140, 202: -140, 203: -140, 204: -140, 205: -140, 206: -140 }, { 1: -141, 6: -141, 33: -141, 35: -141, 38: -141, 39: -141, 40: -141, 41: -141, 42: -141, 56: -141, 57: -141, 62: -141, 69: -141, 77: -141, 81: -141, 85: -141, 87: -141, 96: -141, 97: -141, 98: -141, 99: -141, 100: -141, 101: -141, 102: -141, 105: -141, 115: -141, 122: -141, 124: -141, 125: -141, 126: -141, 130: -141, 143: -141, 144: -141, 151: -141, 162: -141, 164: -141, 165: -141, 168: -141, 169: -141, 170: -141, 182: -141, 183: -141, 188: -141, 189: -141, 190: -141, 191: -141, 192: -141, 193: -141, 194: -141, 195: -141, 196: -141, 197: -141, 198: -141, 199: -141, 200: -141, 201: -141, 202: -141, 203: -141, 204: -141, 205: -141, 206: -141 }, { 1: -142, 6: -142, 33: -142, 35: -142, 38: -142, 39: -142, 40: -142, 41: -142, 42: -142, 56: -142, 57: -142, 62: -142, 69: -142, 77: -142, 81: -142, 85: -142, 87: -142, 96: -142, 97: -142, 98: -142, 99: -142, 100: -142, 101: -142, 102: -142, 105: -142, 115: -142, 122: -142, 124: -142, 125: -142, 126: -142, 130: -142, 143: -142, 144: -142, 151: -142, 162: -142, 164: -142, 165: -142, 168: -142, 169: -142, 170: -142, 182: -142, 183: -142, 188: -142, 189: -142, 190: -142, 191: -142, 192: -142, 193: -142, 194: -142, 195: -142, 196: -142, 197: -142, 198: -142, 199: -142, 200: -142, 201: -142, 202: -142, 203: -142, 204: -142, 205: -142, 206: -142 }, { 87: 304, 101: 440, 122: 121, 150: 441, 151: 303, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 442, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 87: 304, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 114: 443, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 150: 301, 151: 303, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 101: 444 }, { 101: 445 }, { 7: 446, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 40: -262, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 101: -262, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -69, 6: -69, 33: -69, 35: -69, 39: -69, 40: -69, 56: -69, 57: -69, 62: -69, 69: 447, 81: -69, 85: -69, 87: -69, 96: -69, 97: -69, 98: -69, 99: -69, 100: -69, 101: -66, 102: -69, 105: -69, 115: -69, 122: -69, 124: -69, 125: -69, 126: -69, 143: -69, 144: -69, 151: -69, 162: -69, 164: -69, 165: -69, 168: -69, 169: -69, 170: -69, 182: -69, 183: -69, 188: -69, 189: -69, 192: -69, 193: -69, 194: -69, 195: -69, 196: -69, 197: -69, 198: -69, 199: -69, 200: -69, 201: -69, 202: -69, 203: -69, 204: -69, 205: -69 }, { 11: -256, 31: -256, 40: -256, 43: -256, 47: -256, 50: -256, 54: -256, 56: -256, 57: -256, 64: -256, 65: -256, 71: -256, 72: -256, 73: -256, 74: -256, 75: -256, 76: -256, 84: -256, 86: -256, 92: -256, 95: -256, 101: -256, 103: -256, 104: -256, 106: -256, 107: -256, 119: -256, 120: -256, 121: -256, 122: -256, 129: -256, 131: -256, 139: -256, 146: -256, 156: -256, 160: -256, 161: -256, 164: -256, 165: -256, 167: -256, 171: -256, 173: -256, 179: -256, 181: -256, 184: -256, 185: -256, 186: -256, 187: -256, 188: -256, 189: -256, 190: -256, 191: -256 }, { 11: -257, 31: -257, 40: -257, 43: -257, 47: -257, 50: -257, 54: -257, 56: -257, 57: -257, 64: -257, 65: -257, 71: -257, 72: -257, 73: -257, 74: -257, 75: -257, 76: -257, 84: -257, 86: -257, 92: -257, 95: -257, 101: -257, 103: -257, 104: -257, 106: -257, 107: -257, 119: -257, 120: -257, 121: -257, 122: -257, 129: -257, 131: -257, 139: -257, 146: -257, 156: -257, 160: -257, 161: -257, 164: -257, 165: -257, 167: -257, 171: -257, 173: -257, 179: -257, 181: -257, 184: -257, 185: -257, 186: -257, 187: -257, 188: -257, 189: -257, 190: -257, 191: -257 }, { 7: 448, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 449, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 87: 304, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 114: 450, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 150: 301, 151: 303, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 451, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 452, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -156, 6: -156, 33: -156, 35: -156, 38: -156, 39: -156, 40: -156, 41: -156, 42: -156, 56: -156, 57: -156, 62: -156, 69: -156, 77: -156, 81: -156, 85: -156, 87: -156, 96: -156, 97: -156, 98: -156, 99: -156, 100: -156, 101: -156, 102: -156, 105: -156, 115: -156, 122: -156, 124: -156, 125: -156, 126: -156, 130: -156, 143: -156, 144: -156, 151: -156, 162: -156, 164: -156, 165: -156, 168: -156, 169: -156, 170: -156, 182: -156, 183: -156, 188: -156, 189: -156, 190: -156, 191: -156, 192: -156, 193: -156, 194: -156, 195: -156, 196: -156, 197: -156, 198: -156, 199: -156, 200: -156, 201: -156, 202: -156, 203: -156, 204: -156, 205: -156, 206: -156 }, { 1: -157, 6: -157, 33: -157, 35: -157, 38: -157, 39: -157, 40: -157, 41: -157, 42: -157, 56: -157, 57: -157, 62: -157, 69: -157, 77: -157, 81: -157, 85: -157, 87: -157, 96: -157, 97: -157, 98: -157, 99: -157, 100: -157, 101: -157, 102: -157, 105: -157, 115: -157, 122: -157, 124: -157, 125: -157, 126: -157, 130: -157, 143: -157, 144: -157, 151: -157, 162: -157, 164: -157, 165: -157, 168: -157, 169: -157, 170: -157, 182: -157, 183: -157, 188: -157, 189: -157, 190: -157, 191: -157, 192: -157, 193: -157, 194: -157, 195: -157, 196: -157, 197: -157, 198: -157, 199: -157, 200: -157, 201: -157, 202: -157, 203: -157, 204: -157, 205: -157, 206: -157 }, { 1: -158, 6: -158, 33: -158, 35: -158, 38: -158, 39: -158, 40: -158, 41: -158, 42: -158, 56: -158, 57: -158, 62: -158, 69: -158, 77: -158, 81: -158, 85: -158, 87: -158, 96: -158, 97: -158, 98: -158, 99: -158, 100: -158, 101: -158, 102: -158, 105: -158, 115: -158, 122: -158, 124: -158, 125: -158, 126: -158, 130: -158, 143: -158, 144: -158, 151: -158, 162: -158, 164: -158, 165: -158, 168: -158, 169: -158, 170: -158, 182: -158, 183: -158, 188: -158, 189: -158, 190: -158, 191: -158, 192: -158, 193: -158, 194: -158, 195: -158, 196: -158, 197: -158, 198: -158, 199: -158, 200: -158, 201: -158, 202: -158, 203: -158, 204: -158, 205: -158, 206: -158 }, { 1: -159, 6: -159, 33: -159, 35: -159, 38: -159, 39: -159, 40: -159, 41: -159, 42: -159, 56: -159, 57: -159, 62: -159, 69: -159, 77: -159, 81: -159, 85: -159, 87: -159, 96: -159, 97: -159, 98: -159, 99: -159, 100: -159, 101: -159, 102: -159, 105: -159, 115: -159, 122: -159, 124: -159, 125: -159, 126: -159, 130: -159, 143: -159, 144: -159, 151: -159, 162: -159, 164: -159, 165: -159, 168: -159, 169: -159, 170: -159, 182: -159, 183: -159, 188: -159, 189: -159, 190: -159, 191: -159, 192: -159, 193: -159, 194: -159, 195: -159, 196: -159, 197: -159, 198: -159, 199: -159, 200: -159, 201: -159, 202: -159, 203: -159, 204: -159, 205: -159, 206: -159 }, { 101: 453, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 454, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 455, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 456, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -75, 6: -75, 35: -75, 39: -75, 40: -75, 62: -75, 69: -75, 81: -75, 85: -75, 87: -75, 101: -75, 105: -75, 122: -75, 124: -75, 125: -75, 126: -75, 151: -75, 162: -75, 163: 120, 164: -75, 165: -75, 168: -75, 169: -75, 170: -75, 182: -75, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 457, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 458, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -32, 6: -32, 35: -32, 39: -32, 40: -32, 62: -32, 69: -32, 81: -32, 85: -32, 87: -32, 101: -32, 105: -32, 122: 121, 124: -32, 125: -32, 126: -32, 151: -32, 162: -32, 163: 120, 164: 90, 165: 91, 168: -32, 169: -32, 170: -32, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 459, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 460, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -35, 6: -35, 35: -35, 39: -35, 40: -35, 62: -35, 69: -35, 81: -35, 85: -35, 87: -35, 101: -35, 105: -35, 122: 121, 124: -35, 125: -35, 126: -35, 151: -35, 162: -35, 163: 120, 164: 90, 165: 91, 168: -35, 169: -35, 170: -35, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 461, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 462, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -38, 6: -38, 35: -38, 39: -38, 40: -38, 62: -38, 69: -38, 81: -38, 85: -38, 87: -38, 101: -38, 105: -38, 122: 121, 124: -38, 125: -38, 126: -38, 151: -38, 162: -38, 163: 120, 164: 90, 165: 91, 168: -38, 169: -38, 170: -38, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 463, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 464, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 44: 465, 106: 84, 107: 85 }, { 6: -122, 32: 149, 35: -122, 39: -122, 40: -122, 48: 152, 50: 98, 83: 150, 84: 154, 85: -122, 86: 153, 87: 148, 109: 466, 110: 147, 111: 151, 121: 93, 125: -122 }, { 6: 467, 39: 468 }, { 7: 469, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: -130, 35: -130, 39: -130, 40: -130, 69: -130, 105: -130 }, { 6: -268, 35: -268, 39: -268, 40: -268, 69: -268, 85: -268, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -49, 6: -49, 33: -49, 35: -49, 39: -49, 40: -49, 56: -49, 57: -49, 62: -49, 69: -49, 81: -49, 85: -49, 87: -49, 96: -49, 97: -49, 98: -49, 99: -49, 100: -49, 101: -49, 102: -49, 105: -49, 115: -49, 122: -49, 124: -49, 125: -49, 126: -49, 143: -49, 144: -49, 151: -49, 158: -49, 159: -49, 162: -49, 164: -49, 165: -49, 168: -49, 169: -49, 170: -49, 175: -49, 177: -49, 182: -49, 183: -49, 188: -49, 189: -49, 192: -49, 193: -49, 194: -49, 195: -49, 196: -49, 197: -49, 198: -49, 199: -49, 200: -49, 201: -49, 202: -49, 203: -49, 204: -49, 205: -49 }, { 6: 101, 40: 470 }, { 6: -121, 35: -121, 39: -121, 40: -121, 69: 327, 85: -121, 105: 471, 108: 328, 125: -121 }, { 40: 472 }, { 1: -391, 6: -391, 35: -391, 39: -391, 40: -391, 62: -391, 69: -391, 81: -391, 85: -391, 87: -391, 101: -391, 105: -391, 122: -391, 124: -391, 125: -391, 126: -391, 151: -391, 162: -391, 163: 120, 164: -391, 165: -391, 168: -391, 169: -391, 170: -391, 182: -391, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 473, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 474, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -41, 6: -41, 35: -41, 39: -41, 40: -41, 62: -41, 69: -41, 81: -41, 85: -41, 87: -41, 101: -41, 105: -41, 122: -41, 124: -41, 125: -41, 126: -41, 151: -41, 162: -41, 164: -41, 165: -41, 168: -41, 169: -41, 170: -41, 182: -41, 183: -41, 188: -41, 189: -41, 192: -41, 193: -41, 194: -41, 195: -41, 196: -41, 197: -41, 198: -41, 199: -41, 200: -41, 201: -41, 202: -41, 203: -41, 204: -41, 205: -41 }, { 1: -355, 6: -355, 35: -355, 39: -355, 40: -355, 62: -355, 69: -355, 81: -355, 85: -355, 87: -355, 101: -355, 105: -355, 122: -355, 124: -355, 125: -355, 126: -355, 151: -355, 162: -355, 164: -355, 165: -355, 168: -355, 169: -355, 170: -355, 182: -355, 183: -355, 188: -355, 189: -355, 192: -355, 193: -355, 194: -355, 195: -355, 196: -355, 197: -355, 198: -355, 199: -355, 200: -355, 201: -355, 202: -355, 203: -355, 204: -355, 205: -355 }, { 7: 475, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -288, 6: -288, 35: -288, 39: -288, 40: -288, 62: -288, 69: -288, 81: -288, 85: -288, 87: -288, 101: -288, 105: -288, 122: -288, 124: -288, 125: -288, 126: -288, 151: -288, 158: 476, 162: -288, 164: -288, 165: -288, 168: -288, 169: -288, 170: -288, 182: -288, 183: -288, 188: -288, 189: -288, 192: -288, 193: -288, 194: -288, 195: -288, 196: -288, 197: -288, 198: -288, 199: -288, 200: -288, 201: -288, 202: -288, 203: -288, 204: -288, 205: -288 }, { 36: 477, 39: 157 }, { 32: 478, 36: 480, 39: 157, 48: 479, 50: 98, 121: 93 }, { 7: 481, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 482, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 483, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 124: 484 }, { 170: 485 }, { 1: -321, 6: -321, 35: -321, 39: -321, 40: -321, 62: -321, 69: -321, 81: -321, 85: -321, 87: -321, 101: -321, 105: -321, 122: -321, 124: -321, 125: -321, 126: -321, 151: -321, 162: -321, 164: -321, 165: -321, 168: -321, 169: -321, 170: -321, 182: -321, 183: -321, 188: -321, 189: -321, 192: -321, 193: -321, 194: -321, 195: -321, 196: -321, 197: -321, 198: -321, 199: -321, 200: -321, 201: -321, 202: -321, 203: -321, 204: -321, 205: -321 }, { 7: 486, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 32: 149, 48: 152, 50: 98, 83: 150, 84: 154, 86: 153, 110: 191, 111: 151, 121: 93, 172: 487 }, { 7: 488, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 174: 489, 176: 356, 177: 357 }, { 40: 490, 175: 491, 176: 492, 177: 357 }, { 40: -346, 175: -346, 177: -346 }, { 7: 494, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 155: 493, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -195, 6: -195, 35: -195, 36: 495, 39: 157, 40: -195, 62: -195, 69: -195, 81: -195, 85: -195, 87: -195, 101: -195, 105: -195, 122: -195, 124: -195, 125: -195, 126: -195, 151: -195, 162: -195, 163: 120, 164: -195, 165: -195, 168: -195, 169: -195, 170: -195, 182: -195, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -198, 6: -198, 35: -198, 39: -198, 40: -198, 62: -198, 69: -198, 81: -198, 85: -198, 87: -198, 101: -198, 105: -198, 122: -198, 124: -198, 125: -198, 126: -198, 151: -198, 162: -198, 164: -198, 165: -198, 168: -198, 169: -198, 170: -198, 182: -198, 183: -198, 188: -198, 189: -198, 192: -198, 193: -198, 194: -198, 195: -198, 196: -198, 197: -198, 198: -198, 199: -198, 200: -198, 201: -198, 202: -198, 203: -198, 204: -198, 205: -198 }, { 7: 496, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 40: 497 }, { 40: 498 }, { 1: -48, 6: -48, 35: -48, 39: -48, 40: -48, 62: -48, 69: -48, 81: -48, 85: -48, 87: -48, 101: -48, 105: -48, 122: -48, 124: -48, 125: -48, 126: -48, 151: -48, 162: -48, 163: 120, 164: -48, 165: -48, 168: -48, 169: -48, 170: -48, 182: -48, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 6: -123, 32: 149, 34: 499, 35: -123, 39: -123, 40: -123, 48: 152, 50: 98, 69: -123, 83: 150, 84: 154, 86: 153, 87: 148, 105: -123, 109: 146, 110: 147, 111: 151, 121: 93 }, { 1: -31, 6: -31, 35: -31, 39: -31, 40: -31, 62: -31, 69: -31, 81: -31, 85: -31, 87: -31, 101: -31, 105: -31, 122: -31, 124: -31, 125: -31, 126: -31, 151: -31, 162: -31, 164: -31, 165: -31, 168: -31, 169: -31, 170: -31, 182: -31, 183: -31, 188: -31, 189: -31, 192: -31, 193: -31, 194: -31, 195: -31, 196: -31, 197: -31, 198: -31, 199: -31, 200: -31, 201: -31, 202: -31, 203: -31, 204: -31, 205: -31 }, { 40: 500 }, { 55: 501, 56: 99, 57: 100 }, { 121: 503, 133: 502, 138: 212 }, { 55: 504, 56: 99, 57: 100 }, { 49: 505 }, { 6: -121, 35: -121, 39: -121, 40: -121, 69: 507, 85: -121, 108: 506, 125: -121 }, { 6: -208, 39: -208, 40: -208, 69: -208, 125: -208 }, { 32: 374, 39: 373, 50: 98, 134: 508, 135: 372, 137: 375 }, { 6: -213, 39: -213, 40: -213, 69: -213, 125: -213, 136: 509 }, { 6: -215, 39: -215, 40: -215, 69: -215, 125: -215, 136: 510 }, { 32: 511, 50: 98 }, { 1: -219, 6: -219, 35: -219, 39: -219, 40: -219, 49: 512, 62: -219, 69: -219, 85: -219, 162: -219, 164: -219, 165: -219, 182: -219, 183: -219 }, { 6: -121, 35: -121, 39: -121, 40: -121, 69: 514, 85: -121, 108: 513, 125: -121 }, { 6: -231, 39: -231, 40: -231, 69: -231, 125: -231 }, { 32: 381, 39: 380, 50: 98, 137: 382, 140: 515, 142: 379 }, { 6: -236, 39: -236, 40: -236, 69: -236, 125: -236, 136: 516 }, { 6: -239, 39: -239, 40: -239, 69: -239, 125: -239, 136: 517 }, { 6: 519, 7: 518, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 520, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -226, 6: -226, 35: -226, 39: -226, 40: -226, 62: -226, 69: -226, 85: -226, 122: 121, 162: -226, 163: 120, 164: 90, 165: 91, 182: -226, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 48: 521, 121: 93 }, { 55: 522, 56: 99, 57: 100 }, { 1: -296, 6: -296, 33: -296, 35: -296, 39: -296, 40: -296, 56: -296, 57: -296, 62: -296, 69: -296, 81: -296, 85: -296, 87: -296, 96: -296, 97: -296, 98: -296, 99: -296, 100: -296, 101: -296, 102: -296, 105: -296, 115: -296, 122: -296, 124: -296, 125: -296, 126: -296, 143: -296, 144: -296, 151: -296, 162: -296, 164: -296, 165: -296, 168: -296, 169: -296, 170: -296, 182: -296, 183: -296, 188: -296, 189: -296, 192: -296, 193: -296, 194: -296, 195: -296, 196: -296, 197: -296, 198: -296, 199: -296, 200: -296, 201: -296, 202: -296, 203: -296, 204: -296, 205: -296 }, { 6: 101, 40: 523 }, { 7: 524, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -254, 6: -254, 33: -254, 35: -254, 38: -254, 39: -254, 40: -254, 41: -254, 42: -254, 56: -254, 57: -254, 62: -254, 69: -254, 77: -254, 81: -254, 85: -254, 87: -254, 96: -254, 97: -254, 98: -254, 99: -254, 100: -254, 101: -254, 102: -254, 105: -254, 115: -254, 122: -254, 124: -254, 125: -254, 126: -254, 143: -254, 144: -254, 151: -254, 162: -254, 164: -254, 165: -254, 168: -254, 169: -254, 170: -254, 182: -254, 183: -254, 188: -254, 189: -254, 192: -254, 193: -254, 194: -254, 195: -254, 196: -254, 197: -254, 198: -254, 199: -254, 200: -254, 201: -254, 202: -254, 203: -254, 204: -254, 205: -254 }, { 6: 396, 11: -282, 31: -282, 39: -282, 40: -282, 43: -282, 47: -282, 50: -282, 54: -282, 56: -282, 57: -282, 64: -282, 65: -282, 69: -282, 71: -282, 72: -282, 73: -282, 74: -282, 75: -282, 76: -282, 84: -282, 85: -282, 86: -282, 87: -282, 92: -282, 95: -282, 103: -282, 104: -282, 106: -282, 107: -282, 119: -282, 120: -282, 121: -282, 122: -282, 129: -282, 131: -282, 139: -282, 146: -282, 156: -282, 160: -282, 161: -282, 164: -282, 165: -282, 167: -282, 171: -282, 173: -282, 179: -282, 181: -282, 184: -282, 185: -282, 186: -282, 187: -282, 188: -282, 189: -282, 190: -282, 191: -282 }, { 6: -278, 39: -278, 40: -278, 69: -278, 85: -278 }, { 39: 526, 85: 525 }, { 6: -122, 7: 331, 8: 230, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 35: -122, 37: 30, 39: -122, 40: -122, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 69: 228, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 85: -122, 86: 81, 87: 232, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 112: 231, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 125: -122, 129: 58, 131: 64, 139: 65, 146: 80, 147: 528, 152: 229, 153: 527, 154: 225, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: 529, 39: -279, 40: -279, 85: -279 }, { 6: -284, 11: -284, 31: -284, 39: -284, 40: -284, 43: -284, 47: -284, 50: -284, 54: -284, 56: -284, 57: -284, 64: -284, 65: -284, 69: -284, 71: -284, 72: -284, 73: -284, 74: -284, 75: -284, 76: -284, 84: -284, 85: -284, 86: -284, 87: -284, 92: -284, 95: -284, 103: -284, 104: -284, 106: -284, 107: -284, 119: -284, 120: -284, 121: -284, 122: -284, 129: -284, 131: -284, 139: -284, 146: -284, 156: -284, 160: -284, 161: -284, 164: -284, 165: -284, 167: -284, 171: -284, 173: -284, 179: -284, 181: -284, 184: -284, 185: -284, 186: -284, 187: -284, 188: -284, 189: -284, 190: -284, 191: -284 }, { 6: -121, 35: -121, 39: -121, 40: -121, 69: 394, 85: -121, 108: 395, 125: -121, 149: 530 }, { 7: 331, 8: 230, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 69: 228, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 87: 232, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 112: 231, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 152: 392, 154: 391, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: -136, 35: -136, 39: -136, 40: -136, 69: -136, 85: -136, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -178, 6: -178, 33: -178, 35: -178, 39: -178, 40: -178, 56: -178, 57: -178, 62: -178, 69: -178, 81: -178, 85: -178, 87: -178, 96: -178, 97: -178, 98: -178, 99: -178, 100: -178, 101: -178, 102: -178, 105: -178, 115: -178, 122: -178, 124: -178, 125: -178, 126: -178, 143: -178, 144: -178, 151: -178, 162: -178, 164: -178, 165: -178, 168: -178, 169: -178, 170: -178, 182: -178, 183: -178, 188: -178, 189: -178, 192: -178, 193: -178, 194: -178, 195: -178, 196: -178, 197: -178, 198: -178, 199: -178, 200: -178, 201: -178, 202: -178, 203: -178, 204: -178, 205: -178 }, { 101: 531, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 532, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -248, 6: -248, 33: -248, 35: -248, 39: -248, 40: -248, 56: -248, 57: -248, 62: -248, 67: -248, 69: -248, 81: -248, 85: -248, 87: -248, 96: -248, 97: -248, 98: -248, 99: -248, 100: -248, 101: -248, 102: -248, 105: -248, 115: -248, 122: -248, 124: -248, 125: -248, 126: -248, 143: -248, 144: -248, 151: -248, 162: -248, 164: -248, 165: -248, 168: -248, 169: -248, 170: -248, 182: -248, 183: -248, 188: -248, 189: -248, 192: -248, 193: -248, 194: -248, 195: -248, 196: -248, 197: -248, 198: -248, 199: -248, 200: -248, 201: -248, 202: -248, 203: -248, 204: -248, 205: -248 }, { 6: -121, 35: -121, 39: -121, 40: -121, 69: 534, 85: -121, 108: 533, 125: -121 }, { 6: -263, 35: -263, 39: -263, 40: -263, 69: -263 }, { 7: 331, 8: 230, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 406, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 87: 232, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 112: 231, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 145: 535, 146: 80, 152: 405, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -181, 6: -181, 33: -181, 35: -181, 39: -181, 40: -181, 56: -181, 57: -181, 62: -181, 69: -181, 81: -181, 85: -181, 87: -181, 96: -181, 97: -181, 98: -181, 99: -181, 100: -181, 101: -181, 102: -181, 105: -181, 115: -181, 122: -181, 124: -181, 125: -181, 126: -181, 143: -181, 144: -181, 151: -181, 162: -181, 164: -181, 165: -181, 168: -181, 169: -181, 170: -181, 182: -181, 183: -181, 188: -181, 189: -181, 192: -181, 193: -181, 194: -181, 195: -181, 196: -181, 197: -181, 198: -181, 199: -181, 200: -181, 201: -181, 202: -181, 203: -181, 204: -181, 205: -181 }, { 1: -182, 6: -182, 33: -182, 35: -182, 39: -182, 40: -182, 56: -182, 57: -182, 62: -182, 69: -182, 81: -182, 85: -182, 87: -182, 96: -182, 97: -182, 98: -182, 99: -182, 100: -182, 101: -182, 102: -182, 105: -182, 115: -182, 122: -182, 124: -182, 125: -182, 126: -182, 143: -182, 144: -182, 151: -182, 162: -182, 164: -182, 165: -182, 168: -182, 169: -182, 170: -182, 182: -182, 183: -182, 188: -182, 189: -182, 192: -182, 193: -182, 194: -182, 195: -182, 196: -182, 197: -182, 198: -182, 199: -182, 200: -182, 201: -182, 202: -182, 203: -182, 204: -182, 205: -182 }, { 1: -350, 6: -350, 35: -350, 39: -350, 40: -350, 62: -350, 69: -350, 81: -350, 85: -350, 87: -350, 101: -350, 105: -350, 122: -350, 124: -350, 125: -350, 126: -350, 151: -350, 162: -350, 164: -350, 165: -350, 168: -350, 169: -350, 170: -350, 175: -350, 182: -350, 183: -350, 188: -350, 189: -350, 192: -350, 193: -350, 194: -350, 195: -350, 196: -350, 197: -350, 198: -350, 199: -350, 200: -350, 201: -350, 202: -350, 203: -350, 204: -350, 205: -350 }, { 1: -352, 6: -352, 35: -352, 39: -352, 40: -352, 62: -352, 69: -352, 81: -352, 85: -352, 87: -352, 101: -352, 105: -352, 122: -352, 124: -352, 125: -352, 126: -352, 151: -352, 162: -352, 164: -352, 165: -352, 168: -352, 169: -352, 170: -352, 175: 536, 182: -352, 183: -352, 188: -352, 189: -352, 192: -352, 193: -352, 194: -352, 195: -352, 196: -352, 197: -352, 198: -352, 199: -352, 200: -352, 201: -352, 202: -352, 203: -352, 204: -352, 205: -352 }, { 7: 537, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 538, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 539, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 540, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: 542, 39: 543, 125: 541 }, { 6: -122, 32: 255, 35: -122, 39: -122, 40: -122, 50: 98, 51: 256, 52: 239, 53: 253, 54: 94, 55: 95, 56: 99, 57: 100, 78: 544, 79: 545, 80: 258, 82: 250, 83: 257, 84: 251, 85: -122, 86: 252, 87: 259, 125: -122 }, { 7: 546, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 547, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 85: 548, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 549, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: -91, 33: -93, 39: -91, 40: -91, 56: -246, 57: -246, 69: -91, 93: 550, 96: -93, 97: -93, 98: -93, 99: -93, 100: -93, 102: -93, 125: -91, 144: 134 }, { 6: -92, 33: -246, 39: -92, 40: -92, 56: -246, 57: -246, 69: -92, 93: 551, 96: 552, 97: 553, 98: 554, 99: 555, 100: 556, 102: 557, 125: -92, 144: 134 }, { 6: -94, 33: -94, 39: -94, 40: -94, 69: -94, 96: -94, 97: -94, 98: -94, 99: -94, 100: -94, 102: -94, 125: -94, 144: -94 }, { 6: -95, 33: -95, 39: -95, 40: -95, 69: -95, 96: -95, 97: -95, 98: -95, 99: -95, 100: -95, 102: -95, 125: -95, 144: -95 }, { 6: -96, 33: -96, 39: -96, 40: -96, 69: -96, 96: -96, 97: -96, 98: -96, 99: -96, 100: -96, 102: -96, 125: -96, 144: -96 }, { 6: -97, 33: -97, 39: -97, 40: -97, 69: -97, 96: -97, 97: -97, 98: -97, 99: -97, 100: -97, 102: -97, 125: -97, 144: -97 }, { 33: -246, 56: -246, 57: -246, 93: 558, 96: 234, 100: 235, 144: 134 }, { 33: 236, 94: 559 }, { 1: -64, 6: -64, 33: -64, 35: -64, 39: -64, 40: -64, 56: -64, 57: -64, 62: -64, 69: -64, 81: -64, 85: -64, 87: -64, 96: -64, 97: -64, 98: -64, 99: -64, 100: -64, 101: -64, 102: -64, 105: -64, 115: -64, 122: -64, 124: -64, 125: -64, 126: -64, 143: -64, 144: -64, 151: -64, 162: -64, 164: -64, 165: -64, 168: -64, 169: -64, 170: -64, 182: -64, 183: -64, 188: -64, 189: -64, 192: -64, 193: -64, 194: -64, 195: -64, 196: -64, 197: -64, 198: -64, 199: -64, 200: -64, 201: -64, 202: -64, 203: -64, 204: -64, 205: -64 }, { 1: -56, 6: -56, 33: -56, 35: -56, 39: -56, 40: -56, 56: -56, 57: -56, 59: -56, 61: -56, 62: -56, 67: -56, 69: -56, 81: -56, 85: -56, 87: -56, 96: -56, 97: -56, 98: -56, 99: -56, 100: -56, 101: -56, 102: -56, 105: -56, 115: -56, 122: -56, 124: -56, 125: -56, 126: -56, 143: -56, 144: -56, 151: -56, 162: -56, 164: -56, 165: -56, 168: -56, 169: -56, 170: -56, 182: -56, 183: -56, 188: -56, 189: -56, 192: -56, 193: -56, 194: -56, 195: -56, 196: -56, 197: -56, 198: -56, 199: -56, 200: -56, 201: -56, 202: -56, 203: -56, 204: -56, 205: -56 }, { 56: -58, 57: -58, 59: -58, 61: -58 }, { 6: 101, 62: 560 }, { 4: 561, 5: 3, 7: 4, 8: 5, 9: 6, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 56: -61, 57: -61, 59: -61, 61: -61 }, { 7: 562, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 563, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 564, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 565, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 124: 566 }, { 170: 567 }, { 7: 568, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -145, 6: -145, 33: -145, 35: -145, 38: -145, 39: -145, 40: -145, 41: -145, 42: -145, 56: -145, 57: -145, 62: -145, 69: -145, 77: -145, 81: -145, 85: -145, 87: -145, 96: -145, 97: -145, 98: -145, 99: -145, 100: -145, 101: -145, 102: -145, 105: -145, 115: -145, 122: -145, 124: -145, 125: -145, 126: -145, 130: -145, 143: -145, 144: -145, 151: -145, 162: -145, 164: -145, 165: -145, 168: -145, 169: -145, 170: -145, 182: -145, 183: -145, 188: -145, 189: -145, 190: -145, 191: -145, 192: -145, 193: -145, 194: -145, 195: -145, 196: -145, 197: -145, 198: -145, 199: -145, 200: -145, 201: -145, 202: -145, 203: -145, 204: -145, 205: -145, 206: -145 }, { 7: 569, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 40: -260, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 101: -260, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 40: 570, 87: 304, 122: 121, 150: 441, 151: 303, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 40: 571 }, { 1: -147, 6: -147, 33: -147, 35: -147, 38: -147, 39: -147, 40: -147, 41: -147, 42: -147, 56: -147, 57: -147, 62: -147, 69: -147, 77: -147, 81: -147, 85: -147, 87: -147, 96: -147, 97: -147, 98: -147, 99: -147, 100: -147, 101: -147, 102: -147, 105: -147, 115: -147, 122: -147, 124: -147, 125: -147, 126: -147, 130: -147, 143: -147, 144: -147, 151: -147, 162: -147, 164: -147, 165: -147, 168: -147, 169: -147, 170: -147, 182: -147, 183: -147, 188: -147, 189: -147, 190: -147, 191: -147, 192: -147, 193: -147, 194: -147, 195: -147, 196: -147, 197: -147, 198: -147, 199: -147, 200: -147, 201: -147, 202: -147, 203: -147, 204: -147, 205: -147, 206: -147 }, { 1: -149, 6: -149, 33: -149, 35: -149, 38: -149, 39: -149, 40: -149, 41: -149, 42: -149, 56: -149, 57: -149, 62: -149, 69: -149, 77: -149, 81: -149, 85: -149, 87: -149, 96: -149, 97: -149, 98: -149, 99: -149, 100: -149, 101: -149, 102: -149, 105: -149, 115: -149, 122: -149, 124: -149, 125: -149, 126: -149, 130: -149, 143: -149, 144: -149, 151: -149, 162: -149, 164: -149, 165: -149, 168: -149, 169: -149, 170: -149, 182: -149, 183: -149, 188: -149, 189: -149, 190: -149, 191: -149, 192: -149, 193: -149, 194: -149, 195: -149, 196: -149, 197: -149, 198: -149, 199: -149, 200: -149, 201: -149, 202: -149, 203: -149, 204: -149, 205: -149, 206: -149 }, { 40: -261, 101: -261, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 572, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 87: 304, 101: 573, 122: 121, 150: 441, 151: 303, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 574, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 87: 304, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 114: 575, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 150: 301, 151: 303, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 101: 576 }, { 101: 577, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 578, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -162, 6: -162, 33: -162, 35: -162, 38: -162, 39: -162, 40: -162, 41: -162, 42: -162, 56: -162, 57: -162, 62: -162, 69: -162, 77: -162, 81: -162, 85: -162, 87: -162, 96: -162, 97: -162, 98: -162, 99: -162, 100: -162, 101: -162, 102: -162, 105: -162, 115: -162, 122: -162, 124: -162, 125: -162, 126: -162, 130: -162, 143: -162, 144: -162, 151: -162, 162: -162, 164: -162, 165: -162, 168: -162, 169: -162, 170: -162, 182: -162, 183: -162, 188: -162, 189: -162, 190: -162, 191: -162, 192: -162, 193: -162, 194: -162, 195: -162, 196: -162, 197: -162, 198: -162, 199: -162, 200: -162, 201: -162, 202: -162, 203: -162, 204: -162, 205: -162, 206: -162 }, { 40: 579, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 101: 580, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 581, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -76, 6: -76, 35: -76, 39: -76, 40: -76, 62: -76, 69: -76, 81: -76, 85: -76, 87: -76, 101: -76, 105: -76, 122: -76, 124: -76, 125: -76, 126: -76, 151: -76, 162: -76, 163: 120, 164: -76, 165: -76, 168: -76, 169: -76, 170: -76, 182: -76, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 40: 582, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -33, 6: -33, 35: -33, 39: -33, 40: -33, 62: -33, 69: -33, 81: -33, 85: -33, 87: -33, 101: -33, 105: -33, 122: 121, 124: -33, 125: -33, 126: -33, 151: -33, 162: -33, 163: 120, 164: 90, 165: 91, 168: -33, 169: -33, 170: -33, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 40: 583, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -36, 6: -36, 35: -36, 39: -36, 40: -36, 62: -36, 69: -36, 81: -36, 85: -36, 87: -36, 101: -36, 105: -36, 122: 121, 124: -36, 125: -36, 126: -36, 151: -36, 162: -36, 163: 120, 164: 90, 165: 91, 168: -36, 169: -36, 170: -36, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 40: 584, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -39, 6: -39, 35: -39, 39: -39, 40: -39, 62: -39, 69: -39, 81: -39, 85: -39, 87: -39, 101: -39, 105: -39, 122: 121, 124: -39, 125: -39, 126: -39, 151: -39, 162: -39, 163: 120, 164: 90, 165: 91, 168: -39, 169: -39, 170: -39, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 40: 585, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 5: 587, 7: 4, 8: 5, 9: 6, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 36: 586, 37: 30, 39: 157, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: -125, 35: -125, 39: -125, 40: -125, 69: -125, 105: -125 }, { 32: 149, 48: 152, 50: 98, 83: 150, 84: 154, 86: 153, 87: 148, 109: 588, 110: 147, 111: 151, 121: 93 }, { 6: -123, 32: 149, 34: 589, 35: -123, 39: -123, 40: -123, 48: 152, 50: 98, 69: -123, 83: 150, 84: 154, 86: 153, 87: 148, 105: -123, 109: 146, 110: 147, 111: 151, 121: 93 }, { 6: -129, 35: -129, 39: -129, 40: -129, 69: -129, 105: -129, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -50, 6: -50, 33: -50, 35: -50, 39: -50, 40: -50, 56: -50, 57: -50, 62: -50, 69: -50, 81: -50, 85: -50, 87: -50, 96: -50, 97: -50, 98: -50, 99: -50, 100: -50, 101: -50, 102: -50, 105: -50, 115: -50, 122: -50, 124: -50, 125: -50, 126: -50, 143: -50, 144: -50, 151: -50, 158: -50, 159: -50, 162: -50, 164: -50, 165: -50, 168: -50, 169: -50, 170: -50, 175: -50, 177: -50, 182: -50, 183: -50, 188: -50, 189: -50, 192: -50, 193: -50, 194: -50, 195: -50, 196: -50, 197: -50, 198: -50, 199: -50, 200: -50, 201: -50, 202: -50, 203: -50, 204: -50, 205: -50 }, { 44: 590, 106: 84, 107: 85 }, { 1: -370, 6: -370, 35: -370, 39: -370, 40: -370, 62: -370, 69: -370, 81: -370, 85: -370, 87: -370, 101: -370, 105: -370, 122: -370, 124: -370, 125: -370, 126: -370, 151: -370, 162: -370, 164: -370, 165: -370, 168: -370, 169: -370, 170: -370, 182: -370, 183: -370, 188: -370, 189: -370, 192: -370, 193: -370, 194: -370, 195: -370, 196: -370, 197: -370, 198: -370, 199: -370, 200: -370, 201: -370, 202: -370, 203: -370, 204: -370, 205: -370 }, { 40: 591, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -393, 6: -393, 35: -393, 39: -393, 40: -393, 62: -393, 69: -393, 81: -393, 85: -393, 87: -393, 101: -393, 105: -393, 122: -393, 124: -393, 125: -393, 126: -393, 151: -393, 162: -393, 163: 120, 164: -393, 165: -393, 168: -393, 169: -393, 170: -393, 182: -393, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 36: 592, 39: 157, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 36: 593, 39: 157 }, { 1: -289, 6: -289, 35: -289, 39: -289, 40: -289, 62: -289, 69: -289, 81: -289, 85: -289, 87: -289, 101: -289, 105: -289, 122: -289, 124: -289, 125: -289, 126: -289, 151: -289, 162: -289, 164: -289, 165: -289, 168: -289, 169: -289, 170: -289, 182: -289, 183: -289, 188: -289, 189: -289, 192: -289, 193: -289, 194: -289, 195: -289, 196: -289, 197: -289, 198: -289, 199: -289, 200: -289, 201: -289, 202: -289, 203: -289, 204: -289, 205: -289 }, { 36: 594, 39: 157 }, { 36: 595, 39: 157 }, { 1: -293, 6: -293, 35: -293, 39: -293, 40: -293, 62: -293, 69: -293, 81: -293, 85: -293, 87: -293, 101: -293, 105: -293, 122: -293, 124: -293, 125: -293, 126: -293, 151: -293, 158: -293, 162: -293, 164: -293, 165: -293, 168: -293, 169: -293, 170: -293, 182: -293, 183: -293, 188: -293, 189: -293, 192: -293, 193: -293, 194: -293, 195: -293, 196: -293, 197: -293, 198: -293, 199: -293, 200: -293, 201: -293, 202: -293, 203: -293, 204: -293, 205: -293 }, { 36: 596, 39: 157, 122: 121, 126: 597, 163: 120, 164: 90, 165: 91, 169: 598, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 36: 599, 39: 157, 122: 121, 126: 600, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 36: 601, 39: 157, 122: 121, 126: 602, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 603, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 604, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 36: 605, 39: 157, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 124: -341, 168: -341, 170: -341 }, { 69: -339, 122: 121, 124: -339, 163: 120, 164: 90, 165: 91, 168: -339, 170: -339, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 40: 606, 175: 607, 176: 492, 177: 357 }, { 1: -344, 6: -344, 35: -344, 39: -344, 40: -344, 62: -344, 69: -344, 81: -344, 85: -344, 87: -344, 101: -344, 105: -344, 122: -344, 124: -344, 125: -344, 126: -344, 151: -344, 162: -344, 164: -344, 165: -344, 168: -344, 169: -344, 170: -344, 182: -344, 183: -344, 188: -344, 189: -344, 192: -344, 193: -344, 194: -344, 195: -344, 196: -344, 197: -344, 198: -344, 199: -344, 200: -344, 201: -344, 202: -344, 203: -344, 204: -344, 205: -344 }, { 36: 608, 39: 157 }, { 40: -347, 175: -347, 177: -347 }, { 36: 609, 39: 157, 69: 610 }, { 39: -285, 69: -285, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -196, 6: -196, 35: -196, 39: -196, 40: -196, 62: -196, 69: -196, 81: -196, 85: -196, 87: -196, 101: -196, 105: -196, 122: -196, 124: -196, 125: -196, 126: -196, 151: -196, 162: -196, 164: -196, 165: -196, 168: -196, 169: -196, 170: -196, 182: -196, 183: -196, 188: -196, 189: -196, 192: -196, 193: -196, 194: -196, 195: -196, 196: -196, 197: -196, 198: -196, 199: -196, 200: -196, 201: -196, 202: -196, 203: -196, 204: -196, 205: -196 }, { 1: -199, 6: -199, 35: -199, 36: 611, 39: 157, 40: -199, 62: -199, 69: -199, 81: -199, 85: -199, 87: -199, 101: -199, 105: -199, 122: -199, 124: -199, 125: -199, 126: -199, 151: -199, 162: -199, 163: 120, 164: -199, 165: -199, 168: -199, 169: -199, 170: -199, 182: -199, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -295, 6: -295, 35: -295, 39: -295, 40: -295, 62: -295, 69: -295, 81: -295, 85: -295, 87: -295, 101: -295, 105: -295, 122: -295, 124: -295, 125: -295, 126: -295, 151: -295, 162: -295, 164: -295, 165: -295, 168: -295, 169: -295, 170: -295, 182: -295, 183: -295, 188: -295, 189: -295, 192: -295, 193: -295, 194: -295, 195: -295, 196: -295, 197: -295, 198: -295, 199: -295, 200: -295, 201: -295, 202: -295, 203: -295, 204: -295, 205: -295 }, { 1: -47, 6: -47, 35: -47, 39: -47, 40: -47, 62: -47, 69: -47, 81: -47, 85: -47, 87: -47, 101: -47, 105: -47, 122: -47, 124: -47, 125: -47, 126: -47, 151: -47, 162: -47, 164: -47, 165: -47, 168: -47, 169: -47, 170: -47, 182: -47, 183: -47, 188: -47, 189: -47, 192: -47, 193: -47, 194: -47, 195: -47, 196: -47, 197: -47, 198: -47, 199: -47, 200: -47, 201: -47, 202: -47, 203: -47, 204: -47, 205: -47 }, { 6: -121, 35: 612, 39: -121, 40: -121, 69: 327, 85: -121, 108: 328, 125: -121 }, { 1: -113, 6: -113, 35: -113, 39: -113, 40: -113, 62: -113, 69: -113, 85: -113, 162: -113, 164: -113, 165: -113, 182: -113, 183: -113 }, { 1: -202, 6: -202, 35: -202, 39: -202, 40: -202, 62: -202, 69: -202, 85: -202, 162: -202, 164: -202, 165: -202, 182: -202, 183: -202 }, { 49: 613 }, { 32: 374, 39: 373, 50: 98, 134: 614, 135: 372, 137: 375 }, { 1: -203, 6: -203, 35: -203, 39: -203, 40: -203, 62: -203, 69: -203, 85: -203, 162: -203, 164: -203, 165: -203, 182: -203, 183: -203 }, { 55: 615, 56: 99, 57: 100 }, { 6: 617, 39: 618, 125: 616 }, { 6: -122, 32: 374, 35: -122, 39: -122, 40: -122, 50: 98, 85: -122, 125: -122, 135: 619, 137: 375 }, { 6: -121, 35: -121, 39: -121, 40: -121, 69: 507, 85: -121, 108: 620, 125: -121 }, { 32: 621, 50: 98 }, { 32: 622, 50: 98 }, { 49: -218 }, { 55: 623, 56: 99, 57: 100 }, { 6: 625, 39: 626, 125: 624 }, { 6: -122, 32: 381, 35: -122, 39: -122, 40: -122, 50: 98, 85: -122, 125: -122, 137: 382, 142: 627 }, { 6: -121, 35: -121, 39: -121, 40: -121, 69: 514, 85: -121, 108: 628, 125: -121 }, { 32: 629, 50: 98, 137: 630 }, { 32: 631, 50: 98 }, { 1: -223, 6: -223, 35: -223, 39: -223, 40: -223, 62: -223, 69: -223, 85: -223, 122: 121, 162: -223, 163: 120, 164: -223, 165: -223, 182: -223, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 632, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 633, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 40: 634 }, { 1: -228, 6: -228, 35: -228, 39: -228, 40: -228, 62: -228, 69: -228, 85: -228, 162: -228, 164: -228, 165: -228, 182: -228, 183: -228 }, { 162: 635 }, { 85: 636, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -255, 6: -255, 33: -255, 35: -255, 38: -255, 39: -255, 40: -255, 41: -255, 42: -255, 56: -255, 57: -255, 62: -255, 69: -255, 77: -255, 81: -255, 85: -255, 87: -255, 96: -255, 97: -255, 98: -255, 99: -255, 100: -255, 101: -255, 102: -255, 105: -255, 115: -255, 122: -255, 124: -255, 125: -255, 126: -255, 143: -255, 144: -255, 151: -255, 162: -255, 164: -255, 165: -255, 168: -255, 169: -255, 170: -255, 182: -255, 183: -255, 188: -255, 189: -255, 192: -255, 193: -255, 194: -255, 195: -255, 196: -255, 197: -255, 198: -255, 199: -255, 200: -255, 201: -255, 202: -255, 203: -255, 204: -255, 205: -255 }, { 7: 331, 8: 230, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 227, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 69: 228, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 87: 232, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 112: 231, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 147: 398, 148: 637, 152: 229, 153: 226, 154: 225, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: -273, 39: -273, 40: -273, 69: -273, 85: -273 }, { 7: 331, 8: 230, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: -280, 40: -280, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 69: 228, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 85: -280, 86: 81, 87: 232, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 112: 231, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 152: 392, 154: 391, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 331, 8: 230, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 69: 228, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 87: 232, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 112: 231, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 147: 398, 152: 229, 153: 638, 154: 225, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 39: 526, 40: 639 }, { 1: -179, 6: -179, 33: -179, 35: -179, 39: -179, 40: -179, 56: -179, 57: -179, 62: -179, 69: -179, 81: -179, 85: -179, 87: -179, 96: -179, 97: -179, 98: -179, 99: -179, 100: -179, 101: -179, 102: -179, 105: -179, 115: -179, 122: -179, 124: -179, 125: -179, 126: -179, 143: -179, 144: -179, 151: -179, 162: -179, 164: -179, 165: -179, 168: -179, 169: -179, 170: -179, 182: -179, 183: -179, 188: -179, 189: -179, 192: -179, 193: -179, 194: -179, 195: -179, 196: -179, 197: -179, 198: -179, 199: -179, 200: -179, 201: -179, 202: -179, 203: -179, 204: -179, 205: -179 }, { 40: 640, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 6: 642, 35: 641, 39: 643 }, { 6: -122, 7: 331, 8: 230, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 35: -122, 37: 30, 39: -122, 40: -122, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 85: -122, 86: 81, 87: 232, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 112: 231, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 125: -122, 129: 58, 131: 64, 139: 65, 146: 80, 152: 644, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: -121, 35: -121, 39: -121, 40: -121, 69: 534, 85: -121, 108: 645, 125: -121 }, { 36: 646, 39: 157 }, { 1: -299, 6: -299, 35: -299, 39: -299, 40: -299, 62: -299, 69: -299, 81: -299, 85: -299, 87: -299, 101: -299, 105: -299, 122: -299, 124: -299, 125: -299, 126: -299, 151: -299, 162: -299, 163: 120, 164: -299, 165: -299, 168: -299, 169: -299, 170: -299, 182: -299, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -301, 6: -301, 35: -301, 39: -301, 40: -301, 62: -301, 69: -301, 81: -301, 85: -301, 87: -301, 101: -301, 105: -301, 122: -301, 124: -301, 125: -301, 126: -301, 151: -301, 162: -301, 163: 120, 164: -301, 165: -301, 168: -301, 169: -301, 170: -301, 182: -301, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 6: -80, 39: -80, 40: -80, 69: -80, 122: 647, 125: -80, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 648, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -187, 6: -187, 33: -187, 35: -187, 38: -187, 39: -187, 40: -187, 41: -187, 42: -187, 56: -187, 57: -187, 62: -187, 69: -187, 77: -187, 81: -187, 85: -187, 87: -187, 96: -187, 97: -187, 98: -187, 99: -187, 100: -187, 101: -187, 102: -187, 105: -187, 115: -187, 122: -187, 124: -187, 125: -187, 126: -187, 143: -187, 144: -187, 151: -187, 162: -187, 164: -187, 165: -187, 168: -187, 169: -187, 170: -187, 182: -187, 183: -187, 188: -187, 189: -187, 192: -187, 193: -187, 194: -187, 195: -187, 196: -187, 197: -187, 198: -187, 199: -187, 200: -187, 201: -187, 202: -187, 203: -187, 204: -187, 205: -187 }, { 32: 255, 50: 98, 51: 256, 52: 239, 53: 253, 54: 94, 55: 95, 56: 99, 57: 100, 78: 649, 79: 545, 80: 258, 82: 250, 83: 257, 84: 251, 86: 252, 87: 259 }, { 6: -188, 32: 255, 39: -188, 40: -188, 50: 98, 51: 256, 52: 239, 53: 253, 54: 94, 55: 95, 56: 99, 57: 100, 69: -188, 78: 254, 79: 545, 80: 258, 82: 250, 83: 257, 84: 251, 86: 252, 87: 259, 125: -188, 128: 650 }, { 6: -190, 39: -190, 40: -190, 69: -190, 125: -190 }, { 6: -78, 39: -78, 40: -78, 69: -78, 81: 651, 125: -78 }, { 6: -82, 39: -82, 40: -82, 69: -82, 122: 121, 125: -82, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 652, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: -88, 39: -88, 40: -88, 69: -88, 81: -88, 125: -88 }, { 85: 653, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 33: 236, 94: 654 }, { 33: 236, 94: 655 }, { 51: 656, 52: 239 }, { 51: 657, 52: 239 }, { 6: -106, 33: -106, 39: -106, 40: -106, 51: 658, 52: 239, 69: -106, 96: -106, 97: -106, 98: -106, 99: -106, 100: -106, 102: -106, 125: -106, 144: -106 }, { 6: -107, 33: -107, 39: -107, 40: -107, 51: 659, 52: 239, 69: -107, 96: -107, 97: -107, 98: -107, 99: -107, 100: -107, 102: -107, 125: -107, 144: -107 }, { 7: 660, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 661, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 100: 662 }, { 33: 236, 94: 663 }, { 6: -99, 33: -99, 39: -99, 40: -99, 69: -99, 96: -99, 97: -99, 98: -99, 99: -99, 100: -99, 102: -99, 125: -99, 144: -99 }, { 56: -59, 57: -59, 59: -59, 61: -59 }, { 6: 101, 40: 664 }, { 1: -390, 6: -390, 35: -390, 39: -390, 40: -390, 62: -390, 69: -390, 81: -390, 85: -390, 87: -390, 101: -390, 105: -390, 122: -390, 124: -390, 125: -390, 126: -390, 151: -390, 162: -390, 163: 120, 164: -390, 165: -390, 168: -390, 169: -390, 170: -390, 182: -390, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -323, 6: -323, 35: -323, 39: -323, 40: -323, 62: -323, 69: -323, 81: -323, 85: -323, 87: -323, 101: -323, 105: -323, 122: -323, 124: -323, 125: -323, 126: 665, 151: -323, 162: -323, 163: 120, 164: -323, 165: -323, 168: -323, 169: 666, 170: -323, 182: -323, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -328, 6: -328, 35: -328, 39: -328, 40: -328, 62: -328, 69: -328, 81: -328, 85: -328, 87: -328, 101: -328, 105: -328, 122: -328, 124: -328, 125: -328, 126: 667, 151: -328, 162: -328, 163: 120, 164: -328, 165: -328, 168: -328, 169: -328, 170: -328, 182: -328, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -332, 6: -332, 35: -332, 39: -332, 40: -332, 62: -332, 69: -332, 81: -332, 85: -332, 87: -332, 101: -332, 105: -332, 122: -332, 124: -332, 125: -332, 126: 668, 151: -332, 162: -332, 163: 120, 164: -332, 165: -332, 168: -332, 169: -332, 170: -332, 182: -332, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 669, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 670, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -337, 6: -337, 35: -337, 39: -337, 40: -337, 62: -337, 69: -337, 81: -337, 85: -337, 87: -337, 101: -337, 105: -337, 122: -337, 124: -337, 125: -337, 126: -337, 151: -337, 162: -337, 163: 120, 164: -337, 165: -337, 168: -337, 169: -337, 170: -337, 182: -337, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 40: -259, 101: -259, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 101: 671 }, { 101: 672 }, { 101: -65, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -150, 6: -150, 33: -150, 35: -150, 38: -150, 39: -150, 40: -150, 41: -150, 42: -150, 56: -150, 57: -150, 62: -150, 69: -150, 77: -150, 81: -150, 85: -150, 87: -150, 96: -150, 97: -150, 98: -150, 99: -150, 100: -150, 101: -150, 102: -150, 105: -150, 115: -150, 122: -150, 124: -150, 125: -150, 126: -150, 130: -150, 143: -150, 144: -150, 151: -150, 162: -150, 164: -150, 165: -150, 168: -150, 169: -150, 170: -150, 182: -150, 183: -150, 188: -150, 189: -150, 190: -150, 191: -150, 192: -150, 193: -150, 194: -150, 195: -150, 196: -150, 197: -150, 198: -150, 199: -150, 200: -150, 201: -150, 202: -150, 203: -150, 204: -150, 205: -150, 206: -150 }, { 40: 673, 87: 304, 122: 121, 150: 441, 151: 303, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 40: 674 }, { 1: -152, 6: -152, 33: -152, 35: -152, 38: -152, 39: -152, 40: -152, 41: -152, 42: -152, 56: -152, 57: -152, 62: -152, 69: -152, 77: -152, 81: -152, 85: -152, 87: -152, 96: -152, 97: -152, 98: -152, 99: -152, 100: -152, 101: -152, 102: -152, 105: -152, 115: -152, 122: -152, 124: -152, 125: -152, 126: -152, 130: -152, 143: -152, 144: -152, 151: -152, 162: -152, 164: -152, 165: -152, 168: -152, 169: -152, 170: -152, 182: -152, 183: -152, 188: -152, 189: -152, 190: -152, 191: -152, 192: -152, 193: -152, 194: -152, 195: -152, 196: -152, 197: -152, 198: -152, 199: -152, 200: -152, 201: -152, 202: -152, 203: -152, 204: -152, 205: -152, 206: -152 }, { 1: -154, 6: -154, 33: -154, 35: -154, 38: -154, 39: -154, 40: -154, 41: -154, 42: -154, 56: -154, 57: -154, 62: -154, 69: -154, 77: -154, 81: -154, 85: -154, 87: -154, 96: -154, 97: -154, 98: -154, 99: -154, 100: -154, 101: -154, 102: -154, 105: -154, 115: -154, 122: -154, 124: -154, 125: -154, 126: -154, 130: -154, 143: -154, 144: -154, 151: -154, 162: -154, 164: -154, 165: -154, 168: -154, 169: -154, 170: -154, 182: -154, 183: -154, 188: -154, 189: -154, 190: -154, 191: -154, 192: -154, 193: -154, 194: -154, 195: -154, 196: -154, 197: -154, 198: -154, 199: -154, 200: -154, 201: -154, 202: -154, 203: -154, 204: -154, 205: -154, 206: -154 }, { 40: 675, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 101: 676 }, { 1: -164, 6: -164, 33: -164, 35: -164, 38: -164, 39: -164, 40: -164, 41: -164, 42: -164, 56: -164, 57: -164, 62: -164, 69: -164, 77: -164, 81: -164, 85: -164, 87: -164, 96: -164, 97: -164, 98: -164, 99: -164, 100: -164, 101: -164, 102: -164, 105: -164, 115: -164, 122: -164, 124: -164, 125: -164, 126: -164, 130: -164, 143: -164, 144: -164, 151: -164, 162: -164, 164: -164, 165: -164, 168: -164, 169: -164, 170: -164, 182: -164, 183: -164, 188: -164, 189: -164, 190: -164, 191: -164, 192: -164, 193: -164, 194: -164, 195: -164, 196: -164, 197: -164, 198: -164, 199: -164, 200: -164, 201: -164, 202: -164, 203: -164, 204: -164, 205: -164, 206: -164 }, { 40: 677, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -77, 6: -77, 35: -77, 39: -77, 40: -77, 62: -77, 69: -77, 81: -77, 85: -77, 87: -77, 101: -77, 105: -77, 122: -77, 124: -77, 125: -77, 126: -77, 151: -77, 162: -77, 164: -77, 165: -77, 168: -77, 169: -77, 170: -77, 182: -77, 183: -77, 188: -77, 189: -77, 192: -77, 193: -77, 194: -77, 195: -77, 196: -77, 197: -77, 198: -77, 199: -77, 200: -77, 201: -77, 202: -77, 203: -77, 204: -77, 205: -77 }, { 1: -34, 6: -34, 35: -34, 39: -34, 40: -34, 62: -34, 69: -34, 81: -34, 85: -34, 87: -34, 101: -34, 105: -34, 122: -34, 124: -34, 125: -34, 126: -34, 151: -34, 162: -34, 164: -34, 165: -34, 168: -34, 169: -34, 170: -34, 182: -34, 183: -34, 188: -34, 189: -34, 192: -34, 193: -34, 194: -34, 195: -34, 196: -34, 197: -34, 198: -34, 199: -34, 200: -34, 201: -34, 202: -34, 203: -34, 204: -34, 205: -34 }, { 1: -37, 6: -37, 35: -37, 39: -37, 40: -37, 62: -37, 69: -37, 81: -37, 85: -37, 87: -37, 101: -37, 105: -37, 122: -37, 124: -37, 125: -37, 126: -37, 151: -37, 162: -37, 164: -37, 165: -37, 168: -37, 169: -37, 170: -37, 182: -37, 183: -37, 188: -37, 189: -37, 192: -37, 193: -37, 194: -37, 195: -37, 196: -37, 197: -37, 198: -37, 199: -37, 200: -37, 201: -37, 202: -37, 203: -37, 204: -37, 205: -37 }, { 1: -40, 6: -40, 35: -40, 39: -40, 40: -40, 62: -40, 69: -40, 81: -40, 85: -40, 87: -40, 101: -40, 105: -40, 122: -40, 124: -40, 125: -40, 126: -40, 151: -40, 162: -40, 164: -40, 165: -40, 168: -40, 169: -40, 170: -40, 182: -40, 183: -40, 188: -40, 189: -40, 192: -40, 193: -40, 194: -40, 195: -40, 196: -40, 197: -40, 198: -40, 199: -40, 200: -40, 201: -40, 202: -40, 203: -40, 204: -40, 205: -40 }, { 1: -115, 6: -115, 33: -115, 35: -115, 39: -115, 40: -115, 56: -115, 57: -115, 62: -115, 69: -115, 81: -115, 85: -115, 87: -115, 96: -115, 97: -115, 98: -115, 99: -115, 100: -115, 101: -115, 102: -115, 105: -115, 115: -115, 122: -115, 124: -115, 125: -115, 126: -115, 143: -115, 144: -115, 151: -115, 162: -115, 164: -115, 165: -115, 168: -115, 169: -115, 170: -115, 182: -115, 183: -115, 188: -115, 189: -115, 192: -115, 193: -115, 194: -115, 195: -115, 196: -115, 197: -115, 198: -115, 199: -115, 200: -115, 201: -115, 202: -115, 203: -115, 204: -115, 205: -115 }, { 1: -117, 6: -117, 35: -117, 39: -117, 40: -117, 62: -117, 69: -117, 85: -117, 162: -117 }, { 6: -126, 35: -126, 39: -126, 40: -126, 69: -126, 105: -126 }, { 6: -121, 35: -121, 39: -121, 40: -121, 69: 327, 85: -121, 108: 678, 125: -121 }, { 36: 586, 39: 157 }, { 1: -392, 6: -392, 35: -392, 39: -392, 40: -392, 62: -392, 69: -392, 81: -392, 85: -392, 87: -392, 101: -392, 105: -392, 122: -392, 124: -392, 125: -392, 126: -392, 151: -392, 162: -392, 164: -392, 165: -392, 168: -392, 169: -392, 170: -392, 182: -392, 183: -392, 188: -392, 189: -392, 192: -392, 193: -392, 194: -392, 195: -392, 196: -392, 197: -392, 198: -392, 199: -392, 200: -392, 201: -392, 202: -392, 203: -392, 204: -392, 205: -392 }, { 1: -351, 6: -351, 35: -351, 39: -351, 40: -351, 62: -351, 69: -351, 81: -351, 85: -351, 87: -351, 101: -351, 105: -351, 122: -351, 124: -351, 125: -351, 126: -351, 151: -351, 162: -351, 164: -351, 165: -351, 168: -351, 169: -351, 170: -351, 175: -351, 182: -351, 183: -351, 188: -351, 189: -351, 192: -351, 193: -351, 194: -351, 195: -351, 196: -351, 197: -351, 198: -351, 199: -351, 200: -351, 201: -351, 202: -351, 203: -351, 204: -351, 205: -351 }, { 1: -290, 6: -290, 35: -290, 39: -290, 40: -290, 62: -290, 69: -290, 81: -290, 85: -290, 87: -290, 101: -290, 105: -290, 122: -290, 124: -290, 125: -290, 126: -290, 151: -290, 162: -290, 164: -290, 165: -290, 168: -290, 169: -290, 170: -290, 182: -290, 183: -290, 188: -290, 189: -290, 192: -290, 193: -290, 194: -290, 195: -290, 196: -290, 197: -290, 198: -290, 199: -290, 200: -290, 201: -290, 202: -290, 203: -290, 204: -290, 205: -290 }, { 1: -291, 6: -291, 35: -291, 39: -291, 40: -291, 62: -291, 69: -291, 81: -291, 85: -291, 87: -291, 101: -291, 105: -291, 122: -291, 124: -291, 125: -291, 126: -291, 151: -291, 158: -291, 162: -291, 164: -291, 165: -291, 168: -291, 169: -291, 170: -291, 182: -291, 183: -291, 188: -291, 189: -291, 192: -291, 193: -291, 194: -291, 195: -291, 196: -291, 197: -291, 198: -291, 199: -291, 200: -291, 201: -291, 202: -291, 203: -291, 204: -291, 205: -291 }, { 1: -292, 6: -292, 35: -292, 39: -292, 40: -292, 62: -292, 69: -292, 81: -292, 85: -292, 87: -292, 101: -292, 105: -292, 122: -292, 124: -292, 125: -292, 126: -292, 151: -292, 158: -292, 162: -292, 164: -292, 165: -292, 168: -292, 169: -292, 170: -292, 182: -292, 183: -292, 188: -292, 189: -292, 192: -292, 193: -292, 194: -292, 195: -292, 196: -292, 197: -292, 198: -292, 199: -292, 200: -292, 201: -292, 202: -292, 203: -292, 204: -292, 205: -292 }, { 1: -308, 6: -308, 35: -308, 39: -308, 40: -308, 62: -308, 69: -308, 81: -308, 85: -308, 87: -308, 101: -308, 105: -308, 122: -308, 124: -308, 125: -308, 126: -308, 151: -308, 162: -308, 164: -308, 165: -308, 168: -308, 169: -308, 170: -308, 182: -308, 183: -308, 188: -308, 189: -308, 192: -308, 193: -308, 194: -308, 195: -308, 196: -308, 197: -308, 198: -308, 199: -308, 200: -308, 201: -308, 202: -308, 203: -308, 204: -308, 205: -308 }, { 7: 679, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 680, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -313, 6: -313, 35: -313, 39: -313, 40: -313, 62: -313, 69: -313, 81: -313, 85: -313, 87: -313, 101: -313, 105: -313, 122: -313, 124: -313, 125: -313, 126: -313, 151: -313, 162: -313, 164: -313, 165: -313, 168: -313, 169: -313, 170: -313, 182: -313, 183: -313, 188: -313, 189: -313, 192: -313, 193: -313, 194: -313, 195: -313, 196: -313, 197: -313, 198: -313, 199: -313, 200: -313, 201: -313, 202: -313, 203: -313, 204: -313, 205: -313 }, { 7: 681, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -317, 6: -317, 35: -317, 39: -317, 40: -317, 62: -317, 69: -317, 81: -317, 85: -317, 87: -317, 101: -317, 105: -317, 122: -317, 124: -317, 125: -317, 126: -317, 151: -317, 162: -317, 164: -317, 165: -317, 168: -317, 169: -317, 170: -317, 182: -317, 183: -317, 188: -317, 189: -317, 192: -317, 193: -317, 194: -317, 195: -317, 196: -317, 197: -317, 198: -317, 199: -317, 200: -317, 201: -317, 202: -317, 203: -317, 204: -317, 205: -317 }, { 7: 682, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 36: 683, 39: 157, 122: 121, 126: 684, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 36: 685, 39: 157, 122: 121, 126: 686, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -322, 6: -322, 35: -322, 39: -322, 40: -322, 62: -322, 69: -322, 81: -322, 85: -322, 87: -322, 101: -322, 105: -322, 122: -322, 124: -322, 125: -322, 126: -322, 151: -322, 162: -322, 164: -322, 165: -322, 168: -322, 169: -322, 170: -322, 182: -322, 183: -322, 188: -322, 189: -322, 192: -322, 193: -322, 194: -322, 195: -322, 196: -322, 197: -322, 198: -322, 199: -322, 200: -322, 201: -322, 202: -322, 203: -322, 204: -322, 205: -322 }, { 1: -342, 6: -342, 35: -342, 39: -342, 40: -342, 62: -342, 69: -342, 81: -342, 85: -342, 87: -342, 101: -342, 105: -342, 122: -342, 124: -342, 125: -342, 126: -342, 151: -342, 162: -342, 164: -342, 165: -342, 168: -342, 169: -342, 170: -342, 182: -342, 183: -342, 188: -342, 189: -342, 192: -342, 193: -342, 194: -342, 195: -342, 196: -342, 197: -342, 198: -342, 199: -342, 200: -342, 201: -342, 202: -342, 203: -342, 204: -342, 205: -342 }, { 36: 687, 39: 157 }, { 40: 688 }, { 6: 689, 40: -348, 175: -348, 177: -348 }, { 7: 690, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -200, 6: -200, 35: -200, 39: -200, 40: -200, 62: -200, 69: -200, 81: -200, 85: -200, 87: -200, 101: -200, 105: -200, 122: -200, 124: -200, 125: -200, 126: -200, 151: -200, 162: -200, 164: -200, 165: -200, 168: -200, 169: -200, 170: -200, 182: -200, 183: -200, 188: -200, 189: -200, 192: -200, 193: -200, 194: -200, 195: -200, 196: -200, 197: -200, 198: -200, 199: -200, 200: -200, 201: -200, 202: -200, 203: -200, 204: -200, 205: -200 }, { 36: 691, 39: 157 }, { 55: 692, 56: 99, 57: 100 }, { 6: -121, 35: -121, 39: -121, 40: -121, 69: 507, 85: -121, 108: 693, 125: -121 }, { 1: -204, 6: -204, 35: -204, 39: -204, 40: -204, 62: -204, 69: -204, 85: -204, 162: -204, 164: -204, 165: -204, 182: -204, 183: -204 }, { 49: 694 }, { 32: 374, 50: 98, 135: 695, 137: 375 }, { 32: 374, 39: 373, 50: 98, 134: 696, 135: 372, 137: 375 }, { 6: -209, 39: -209, 40: -209, 69: -209, 125: -209 }, { 6: 617, 39: 618, 40: 697 }, { 6: -214, 39: -214, 40: -214, 69: -214, 125: -214 }, { 6: -216, 39: -216, 40: -216, 69: -216, 125: -216 }, { 1: -229, 6: -229, 35: -229, 39: -229, 40: -229, 62: -229, 69: -229, 85: -229, 162: -229, 164: -229, 165: -229, 182: -229, 183: -229 }, { 1: -220, 6: -220, 35: -220, 39: -220, 40: -220, 49: 698, 62: -220, 69: -220, 85: -220, 162: -220, 164: -220, 165: -220, 182: -220, 183: -220 }, { 32: 381, 50: 98, 137: 382, 142: 699 }, { 32: 381, 39: 380, 50: 98, 137: 382, 140: 700, 142: 379 }, { 6: -232, 39: -232, 40: -232, 69: -232, 125: -232 }, { 6: 625, 39: 626, 40: 701 }, { 6: -237, 39: -237, 40: -237, 69: -237, 125: -237 }, { 6: -238, 39: -238, 40: -238, 69: -238, 125: -238 }, { 6: -240, 39: -240, 40: -240, 69: -240, 125: -240 }, { 1: -224, 6: -224, 35: -224, 39: -224, 40: -224, 62: -224, 69: -224, 85: -224, 122: 121, 162: -224, 163: 120, 164: -224, 165: -224, 182: -224, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 40: 702, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -227, 6: -227, 35: -227, 39: -227, 40: -227, 62: -227, 69: -227, 85: -227, 162: -227, 164: -227, 165: -227, 182: -227, 183: -227 }, { 1: -297, 6: -297, 33: -297, 35: -297, 39: -297, 40: -297, 56: -297, 57: -297, 62: -297, 69: -297, 81: -297, 85: -297, 87: -297, 96: -297, 97: -297, 98: -297, 99: -297, 100: -297, 101: -297, 102: -297, 105: -297, 115: -297, 122: -297, 124: -297, 125: -297, 126: -297, 143: -297, 144: -297, 151: -297, 162: -297, 164: -297, 165: -297, 168: -297, 169: -297, 170: -297, 182: -297, 183: -297, 188: -297, 189: -297, 192: -297, 193: -297, 194: -297, 195: -297, 196: -297, 197: -297, 198: -297, 199: -297, 200: -297, 201: -297, 202: -297, 203: -297, 204: -297, 205: -297 }, { 1: -258, 6: -258, 33: -258, 35: -258, 39: -258, 40: -258, 56: -258, 57: -258, 62: -258, 69: -258, 81: -258, 85: -258, 87: -258, 96: -258, 97: -258, 98: -258, 99: -258, 100: -258, 101: -258, 102: -258, 105: -258, 115: -258, 122: -258, 124: -258, 125: -258, 126: -258, 143: -258, 144: -258, 151: -258, 162: -258, 164: -258, 165: -258, 168: -258, 169: -258, 170: -258, 182: -258, 183: -258, 188: -258, 189: -258, 192: -258, 193: -258, 194: -258, 195: -258, 196: -258, 197: -258, 198: -258, 199: -258, 200: -258, 201: -258, 202: -258, 203: -258, 204: -258, 205: -258 }, { 6: -121, 35: -121, 39: -121, 40: -121, 69: 394, 85: -121, 108: 395, 125: -121, 149: 703 }, { 6: -274, 39: -274, 40: -274, 69: -274, 85: -274 }, { 6: -275, 39: -275, 40: -275, 69: -275, 85: -275 }, { 101: 704 }, { 1: -249, 6: -249, 33: -249, 35: -249, 39: -249, 40: -249, 56: -249, 57: -249, 62: -249, 67: -249, 69: -249, 81: -249, 85: -249, 87: -249, 96: -249, 97: -249, 98: -249, 99: -249, 100: -249, 101: -249, 102: -249, 105: -249, 115: -249, 122: -249, 124: -249, 125: -249, 126: -249, 143: -249, 144: -249, 151: -249, 162: -249, 164: -249, 165: -249, 168: -249, 169: -249, 170: -249, 182: -249, 183: -249, 188: -249, 189: -249, 192: -249, 193: -249, 194: -249, 195: -249, 196: -249, 197: -249, 198: -249, 199: -249, 200: -249, 201: -249, 202: -249, 203: -249, 204: -249, 205: -249 }, { 7: 331, 8: 230, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 87: 232, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 112: 231, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 152: 705, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 331, 8: 230, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 406, 43: 50, 44: 40, 45: 24, 46: 25, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 87: 232, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 39, 106: 84, 107: 85, 111: 66, 112: 231, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 145: 706, 146: 80, 152: 405, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 41, 185: 42, 186: 62, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: -264, 35: -264, 39: -264, 40: -264, 69: -264 }, { 6: 642, 39: 643, 40: 707 }, { 1: -353, 6: -353, 35: -353, 39: -353, 40: -353, 62: -353, 69: -353, 81: -353, 85: -353, 87: -353, 101: -353, 105: -353, 122: -353, 124: -353, 125: -353, 126: -353, 151: -353, 162: -353, 164: -353, 165: -353, 168: -353, 169: -353, 170: -353, 182: -353, 183: -353, 188: -353, 189: -353, 192: -353, 193: -353, 194: -353, 195: -353, 196: -353, 197: -353, 198: -353, 199: -353, 200: -353, 201: -353, 202: -353, 203: -353, 204: -353, 205: -353 }, { 32: 149, 48: 152, 50: 98, 83: 150, 84: 77, 86: 153, 110: 191, 111: 151, 116: 287, 121: 93, 123: 708, 127: 709, 171: 286, 172: 190 }, { 40: 710, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 6: -191, 39: -191, 40: -191, 69: -191, 125: -191 }, { 6: -121, 35: -121, 39: -121, 40: -121, 69: 415, 85: -121, 108: 711, 125: -121 }, { 7: 712, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 540, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 40: 713, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 6: -89, 39: -89, 40: -89, 69: -89, 81: -89, 125: -89 }, { 6: -100, 33: -100, 39: -100, 40: -100, 69: -100, 96: -100, 97: -100, 98: -100, 99: -100, 100: -100, 102: -100, 125: -100, 144: -100 }, { 6: -101, 33: -101, 39: -101, 40: -101, 69: -101, 96: -101, 97: -101, 98: -101, 99: -101, 100: -101, 102: -101, 125: -101, 144: -101 }, { 6: -102, 33: -102, 39: -102, 40: -102, 69: -102, 96: -102, 97: -102, 98: -102, 99: -102, 100: -102, 102: -102, 125: -102, 144: -102 }, { 6: -103, 33: -103, 39: -103, 40: -103, 69: -103, 96: -103, 97: -103, 98: -103, 99: -103, 100: -103, 102: -103, 125: -103, 144: -103 }, { 6: -104, 33: -104, 39: -104, 40: -104, 69: -104, 96: -104, 97: -104, 98: -104, 99: -104, 100: -104, 102: -104, 125: -104, 144: -104 }, { 6: -105, 33: -105, 39: -105, 40: -105, 69: -105, 96: -105, 97: -105, 98: -105, 99: -105, 100: -105, 102: -105, 125: -105, 144: -105 }, { 101: 714, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 715, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 716, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 39: 717, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: -98, 33: -98, 39: -98, 40: -98, 69: -98, 96: -98, 97: -98, 98: -98, 99: -98, 100: -98, 102: -98, 125: -98, 144: -98 }, { 62: 718 }, { 7: 719, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 720, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 721, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 722, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -330, 6: -330, 35: -330, 39: -330, 40: -330, 62: -330, 69: -330, 81: -330, 85: -330, 87: -330, 101: -330, 105: -330, 122: -330, 124: -330, 125: -330, 126: 723, 151: -330, 162: -330, 163: 120, 164: -330, 165: -330, 168: -330, 169: -330, 170: -330, 182: -330, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -334, 6: -334, 35: -334, 39: -334, 40: -334, 62: -334, 69: -334, 81: -334, 85: -334, 87: -334, 101: -334, 105: -334, 122: -334, 124: -334, 125: -334, 126: 724, 151: -334, 162: -334, 163: 120, 164: -334, 165: -334, 168: -334, 169: -334, 170: -334, 182: -334, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -146, 6: -146, 33: -146, 35: -146, 38: -146, 39: -146, 40: -146, 41: -146, 42: -146, 56: -146, 57: -146, 62: -146, 69: -146, 77: -146, 81: -146, 85: -146, 87: -146, 96: -146, 97: -146, 98: -146, 99: -146, 100: -146, 101: -146, 102: -146, 105: -146, 115: -146, 122: -146, 124: -146, 125: -146, 126: -146, 130: -146, 143: -146, 144: -146, 151: -146, 162: -146, 164: -146, 165: -146, 168: -146, 169: -146, 170: -146, 182: -146, 183: -146, 188: -146, 189: -146, 190: -146, 191: -146, 192: -146, 193: -146, 194: -146, 195: -146, 196: -146, 197: -146, 198: -146, 199: -146, 200: -146, 201: -146, 202: -146, 203: -146, 204: -146, 205: -146, 206: -146 }, { 1: -148, 6: -148, 33: -148, 35: -148, 38: -148, 39: -148, 40: -148, 41: -148, 42: -148, 56: -148, 57: -148, 62: -148, 69: -148, 77: -148, 81: -148, 85: -148, 87: -148, 96: -148, 97: -148, 98: -148, 99: -148, 100: -148, 101: -148, 102: -148, 105: -148, 115: -148, 122: -148, 124: -148, 125: -148, 126: -148, 130: -148, 143: -148, 144: -148, 151: -148, 162: -148, 164: -148, 165: -148, 168: -148, 169: -148, 170: -148, 182: -148, 183: -148, 188: -148, 189: -148, 190: -148, 191: -148, 192: -148, 193: -148, 194: -148, 195: -148, 196: -148, 197: -148, 198: -148, 199: -148, 200: -148, 201: -148, 202: -148, 203: -148, 204: -148, 205: -148, 206: -148 }, { 101: 725 }, { 101: 726 }, { 101: 727 }, { 1: -163, 6: -163, 33: -163, 35: -163, 38: -163, 39: -163, 40: -163, 41: -163, 42: -163, 56: -163, 57: -163, 62: -163, 69: -163, 77: -163, 81: -163, 85: -163, 87: -163, 96: -163, 97: -163, 98: -163, 99: -163, 100: -163, 101: -163, 102: -163, 105: -163, 115: -163, 122: -163, 124: -163, 125: -163, 126: -163, 130: -163, 143: -163, 144: -163, 151: -163, 162: -163, 164: -163, 165: -163, 168: -163, 169: -163, 170: -163, 182: -163, 183: -163, 188: -163, 189: -163, 190: -163, 191: -163, 192: -163, 193: -163, 194: -163, 195: -163, 196: -163, 197: -163, 198: -163, 199: -163, 200: -163, 201: -163, 202: -163, 203: -163, 204: -163, 205: -163, 206: -163 }, { 101: 728 }, { 6: 467, 39: 468, 40: 729 }, { 36: 730, 39: 157, 122: 121, 163: 120, 164: 90, 165: 91, 169: 731, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 36: 732, 39: 157, 122: 121, 126: 733, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 36: 734, 39: 157, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 36: 735, 39: 157, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -315, 6: -315, 35: -315, 39: -315, 40: -315, 62: -315, 69: -315, 81: -315, 85: -315, 87: -315, 101: -315, 105: -315, 122: -315, 124: -315, 125: -315, 126: -315, 151: -315, 162: -315, 164: -315, 165: -315, 168: -315, 169: -315, 170: -315, 182: -315, 183: -315, 188: -315, 189: -315, 192: -315, 193: -315, 194: -315, 195: -315, 196: -315, 197: -315, 198: -315, 199: -315, 200: -315, 201: -315, 202: -315, 203: -315, 204: -315, 205: -315 }, { 7: 736, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -319, 6: -319, 35: -319, 39: -319, 40: -319, 62: -319, 69: -319, 81: -319, 85: -319, 87: -319, 101: -319, 105: -319, 122: -319, 124: -319, 125: -319, 126: -319, 151: -319, 162: -319, 164: -319, 165: -319, 168: -319, 169: -319, 170: -319, 182: -319, 183: -319, 188: -319, 189: -319, 192: -319, 193: -319, 194: -319, 195: -319, 196: -319, 197: -319, 198: -319, 199: -319, 200: -319, 201: -319, 202: -319, 203: -319, 204: -319, 205: -319 }, { 7: 737, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 40: 738 }, { 1: -345, 6: -345, 35: -345, 39: -345, 40: -345, 62: -345, 69: -345, 81: -345, 85: -345, 87: -345, 101: -345, 105: -345, 122: -345, 124: -345, 125: -345, 126: -345, 151: -345, 162: -345, 164: -345, 165: -345, 168: -345, 169: -345, 170: -345, 182: -345, 183: -345, 188: -345, 189: -345, 192: -345, 193: -345, 194: -345, 195: -345, 196: -345, 197: -345, 198: -345, 199: -345, 200: -345, 201: -345, 202: -345, 203: -345, 204: -345, 205: -345 }, { 40: -349, 175: -349, 177: -349 }, { 39: -286, 69: -286, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -30, 6: -30, 35: -30, 39: -30, 40: -30, 62: -30, 69: -30, 81: -30, 85: -30, 87: -30, 101: -30, 105: -30, 122: -30, 124: -30, 125: -30, 126: -30, 151: -30, 162: -30, 164: -30, 165: -30, 168: -30, 169: -30, 170: -30, 182: -30, 183: -30, 188: -30, 189: -30, 192: -30, 193: -30, 194: -30, 195: -30, 196: -30, 197: -30, 198: -30, 199: -30, 200: -30, 201: -30, 202: -30, 203: -30, 204: -30, 205: -30 }, { 1: -206, 6: -206, 35: -206, 39: -206, 40: -206, 62: -206, 69: -206, 85: -206, 162: -206, 164: -206, 165: -206, 182: -206, 183: -206 }, { 6: 617, 39: 618, 125: 739 }, { 55: 740, 56: 99, 57: 100 }, { 6: -210, 39: -210, 40: -210, 69: -210, 125: -210 }, { 6: -121, 35: -121, 39: -121, 40: -121, 69: 507, 85: -121, 108: 741, 125: -121 }, { 6: -211, 39: -211, 40: -211, 69: -211, 125: -211 }, { 55: 742, 56: 99, 57: 100 }, { 6: -233, 39: -233, 40: -233, 69: -233, 125: -233 }, { 6: -121, 35: -121, 39: -121, 40: -121, 69: 514, 85: -121, 108: 743, 125: -121 }, { 6: -234, 39: -234, 40: -234, 69: -234, 125: -234 }, { 1: -225, 6: -225, 35: -225, 39: -225, 40: -225, 62: -225, 69: -225, 85: -225, 162: -225, 164: -225, 165: -225, 182: -225, 183: -225 }, { 39: 526, 40: 744 }, { 1: -180, 6: -180, 33: -180, 35: -180, 39: -180, 40: -180, 56: -180, 57: -180, 62: -180, 69: -180, 81: -180, 85: -180, 87: -180, 96: -180, 97: -180, 98: -180, 99: -180, 100: -180, 101: -180, 102: -180, 105: -180, 115: -180, 122: -180, 124: -180, 125: -180, 126: -180, 143: -180, 144: -180, 151: -180, 162: -180, 164: -180, 165: -180, 168: -180, 169: -180, 170: -180, 182: -180, 183: -180, 188: -180, 189: -180, 192: -180, 193: -180, 194: -180, 195: -180, 196: -180, 197: -180, 198: -180, 199: -180, 200: -180, 201: -180, 202: -180, 203: -180, 204: -180, 205: -180 }, { 6: -265, 35: -265, 39: -265, 40: -265, 69: -265 }, { 6: -121, 35: -121, 39: -121, 40: -121, 69: 534, 85: -121, 108: 745, 125: -121 }, { 6: -266, 35: -266, 39: -266, 40: -266, 69: -266 }, { 124: 746, 168: 434, 170: 436 }, { 32: 149, 48: 152, 50: 98, 83: 150, 84: 154, 86: 153, 110: 191, 111: 151, 121: 93, 123: 747, 172: 190 }, { 6: -81, 39: -81, 40: -81, 69: -81, 125: -81 }, { 6: 542, 39: 543, 40: 748 }, { 6: -80, 39: -80, 40: -80, 69: -80, 122: 121, 125: -80, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 6: -83, 39: -83, 40: -83, 69: -83, 125: -83 }, { 6: -108, 33: -108, 39: -108, 40: -108, 69: -108, 96: -108, 97: -108, 98: -108, 99: -108, 100: -108, 102: -108, 125: -108, 144: -108 }, { 40: 749, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 101: 750, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 751, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 56: -60, 57: -60, 59: -60, 61: -60 }, { 1: -324, 6: -324, 35: -324, 39: -324, 40: -324, 62: -324, 69: -324, 81: -324, 85: -324, 87: -324, 101: -324, 105: -324, 122: -324, 124: -324, 125: -324, 126: -324, 151: -324, 162: -324, 163: 120, 164: -324, 165: -324, 168: -324, 169: 752, 170: -324, 182: -324, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -325, 6: -325, 35: -325, 39: -325, 40: -325, 62: -325, 69: -325, 81: -325, 85: -325, 87: -325, 101: -325, 105: -325, 122: -325, 124: -325, 125: -325, 126: 753, 151: -325, 162: -325, 163: 120, 164: -325, 165: -325, 168: -325, 169: -325, 170: -325, 182: -325, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -329, 6: -329, 35: -329, 39: -329, 40: -329, 62: -329, 69: -329, 81: -329, 85: -329, 87: -329, 101: -329, 105: -329, 122: -329, 124: -329, 125: -329, 126: -329, 151: -329, 162: -329, 163: 120, 164: -329, 165: -329, 168: -329, 169: -329, 170: -329, 182: -329, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -333, 6: -333, 35: -333, 39: -333, 40: -333, 62: -333, 69: -333, 81: -333, 85: -333, 87: -333, 101: -333, 105: -333, 122: -333, 124: -333, 125: -333, 126: -333, 151: -333, 162: -333, 163: 120, 164: -333, 165: -333, 168: -333, 169: -333, 170: -333, 182: -333, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 754, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 755, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -151, 6: -151, 33: -151, 35: -151, 38: -151, 39: -151, 40: -151, 41: -151, 42: -151, 56: -151, 57: -151, 62: -151, 69: -151, 77: -151, 81: -151, 85: -151, 87: -151, 96: -151, 97: -151, 98: -151, 99: -151, 100: -151, 101: -151, 102: -151, 105: -151, 115: -151, 122: -151, 124: -151, 125: -151, 126: -151, 130: -151, 143: -151, 144: -151, 151: -151, 162: -151, 164: -151, 165: -151, 168: -151, 169: -151, 170: -151, 182: -151, 183: -151, 188: -151, 189: -151, 190: -151, 191: -151, 192: -151, 193: -151, 194: -151, 195: -151, 196: -151, 197: -151, 198: -151, 199: -151, 200: -151, 201: -151, 202: -151, 203: -151, 204: -151, 205: -151, 206: -151 }, { 1: -153, 6: -153, 33: -153, 35: -153, 38: -153, 39: -153, 40: -153, 41: -153, 42: -153, 56: -153, 57: -153, 62: -153, 69: -153, 77: -153, 81: -153, 85: -153, 87: -153, 96: -153, 97: -153, 98: -153, 99: -153, 100: -153, 101: -153, 102: -153, 105: -153, 115: -153, 122: -153, 124: -153, 125: -153, 126: -153, 130: -153, 143: -153, 144: -153, 151: -153, 162: -153, 164: -153, 165: -153, 168: -153, 169: -153, 170: -153, 182: -153, 183: -153, 188: -153, 189: -153, 190: -153, 191: -153, 192: -153, 193: -153, 194: -153, 195: -153, 196: -153, 197: -153, 198: -153, 199: -153, 200: -153, 201: -153, 202: -153, 203: -153, 204: -153, 205: -153, 206: -153 }, { 1: -155, 6: -155, 33: -155, 35: -155, 38: -155, 39: -155, 40: -155, 41: -155, 42: -155, 56: -155, 57: -155, 62: -155, 69: -155, 77: -155, 81: -155, 85: -155, 87: -155, 96: -155, 97: -155, 98: -155, 99: -155, 100: -155, 101: -155, 102: -155, 105: -155, 115: -155, 122: -155, 124: -155, 125: -155, 126: -155, 130: -155, 143: -155, 144: -155, 151: -155, 162: -155, 164: -155, 165: -155, 168: -155, 169: -155, 170: -155, 182: -155, 183: -155, 188: -155, 189: -155, 190: -155, 191: -155, 192: -155, 193: -155, 194: -155, 195: -155, 196: -155, 197: -155, 198: -155, 199: -155, 200: -155, 201: -155, 202: -155, 203: -155, 204: -155, 205: -155, 206: -155 }, { 1: -165, 6: -165, 33: -165, 35: -165, 38: -165, 39: -165, 40: -165, 41: -165, 42: -165, 56: -165, 57: -165, 62: -165, 69: -165, 77: -165, 81: -165, 85: -165, 87: -165, 96: -165, 97: -165, 98: -165, 99: -165, 100: -165, 101: -165, 102: -165, 105: -165, 115: -165, 122: -165, 124: -165, 125: -165, 126: -165, 130: -165, 143: -165, 144: -165, 151: -165, 162: -165, 164: -165, 165: -165, 168: -165, 169: -165, 170: -165, 182: -165, 183: -165, 188: -165, 189: -165, 190: -165, 191: -165, 192: -165, 193: -165, 194: -165, 195: -165, 196: -165, 197: -165, 198: -165, 199: -165, 200: -165, 201: -165, 202: -165, 203: -165, 204: -165, 205: -165, 206: -165 }, { 6: -127, 35: -127, 39: -127, 40: -127, 69: -127, 105: -127 }, { 1: -309, 6: -309, 35: -309, 39: -309, 40: -309, 62: -309, 69: -309, 81: -309, 85: -309, 87: -309, 101: -309, 105: -309, 122: -309, 124: -309, 125: -309, 126: -309, 151: -309, 162: -309, 164: -309, 165: -309, 168: -309, 169: -309, 170: -309, 182: -309, 183: -309, 188: -309, 189: -309, 192: -309, 193: -309, 194: -309, 195: -309, 196: -309, 197: -309, 198: -309, 199: -309, 200: -309, 201: -309, 202: -309, 203: -309, 204: -309, 205: -309 }, { 7: 756, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -310, 6: -310, 35: -310, 39: -310, 40: -310, 62: -310, 69: -310, 81: -310, 85: -310, 87: -310, 101: -310, 105: -310, 122: -310, 124: -310, 125: -310, 126: -310, 151: -310, 162: -310, 164: -310, 165: -310, 168: -310, 169: -310, 170: -310, 182: -310, 183: -310, 188: -310, 189: -310, 192: -310, 193: -310, 194: -310, 195: -310, 196: -310, 197: -310, 198: -310, 199: -310, 200: -310, 201: -310, 202: -310, 203: -310, 204: -310, 205: -310 }, { 7: 757, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -314, 6: -314, 35: -314, 39: -314, 40: -314, 62: -314, 69: -314, 81: -314, 85: -314, 87: -314, 101: -314, 105: -314, 122: -314, 124: -314, 125: -314, 126: -314, 151: -314, 162: -314, 164: -314, 165: -314, 168: -314, 169: -314, 170: -314, 182: -314, 183: -314, 188: -314, 189: -314, 192: -314, 193: -314, 194: -314, 195: -314, 196: -314, 197: -314, 198: -314, 199: -314, 200: -314, 201: -314, 202: -314, 203: -314, 204: -314, 205: -314 }, { 1: -318, 6: -318, 35: -318, 39: -318, 40: -318, 62: -318, 69: -318, 81: -318, 85: -318, 87: -318, 101: -318, 105: -318, 122: -318, 124: -318, 125: -318, 126: -318, 151: -318, 162: -318, 164: -318, 165: -318, 168: -318, 169: -318, 170: -318, 182: -318, 183: -318, 188: -318, 189: -318, 192: -318, 193: -318, 194: -318, 195: -318, 196: -318, 197: -318, 198: -318, 199: -318, 200: -318, 201: -318, 202: -318, 203: -318, 204: -318, 205: -318 }, { 36: 758, 39: 157, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 36: 759, 39: 157, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -343, 6: -343, 35: -343, 39: -343, 40: -343, 62: -343, 69: -343, 81: -343, 85: -343, 87: -343, 101: -343, 105: -343, 122: -343, 124: -343, 125: -343, 126: -343, 151: -343, 162: -343, 164: -343, 165: -343, 168: -343, 169: -343, 170: -343, 182: -343, 183: -343, 188: -343, 189: -343, 192: -343, 193: -343, 194: -343, 195: -343, 196: -343, 197: -343, 198: -343, 199: -343, 200: -343, 201: -343, 202: -343, 203: -343, 204: -343, 205: -343 }, { 49: 760 }, { 1: -205, 6: -205, 35: -205, 39: -205, 40: -205, 62: -205, 69: -205, 85: -205, 162: -205, 164: -205, 165: -205, 182: -205, 183: -205 }, { 6: 617, 39: 618, 40: 761 }, { 1: -230, 6: -230, 35: -230, 39: -230, 40: -230, 62: -230, 69: -230, 85: -230, 162: -230, 164: -230, 165: -230, 182: -230, 183: -230 }, { 6: 625, 39: 626, 40: 762 }, { 6: -276, 39: -276, 40: -276, 69: -276, 85: -276 }, { 6: 642, 39: 643, 40: 763 }, { 7: 764, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 124: 765 }, { 6: -192, 39: -192, 40: -192, 69: -192, 125: -192 }, { 101: 766 }, { 6: -110, 33: -110, 39: -110, 40: -110, 69: -110, 96: -110, 97: -110, 98: -110, 99: -110, 100: -110, 102: -110, 125: -110, 144: -110 }, { 40: 767, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 768, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 7: 769, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 1: -331, 6: -331, 35: -331, 39: -331, 40: -331, 62: -331, 69: -331, 81: -331, 85: -331, 87: -331, 101: -331, 105: -331, 122: -331, 124: -331, 125: -331, 126: -331, 151: -331, 162: -331, 163: 120, 164: -331, 165: -331, 168: -331, 169: -331, 170: -331, 182: -331, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -335, 6: -335, 35: -335, 39: -335, 40: -335, 62: -335, 69: -335, 81: -335, 85: -335, 87: -335, 101: -335, 105: -335, 122: -335, 124: -335, 125: -335, 126: -335, 151: -335, 162: -335, 163: 120, 164: -335, 165: -335, 168: -335, 169: -335, 170: -335, 182: -335, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 36: 770, 39: 157, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 36: 771, 39: 157, 122: 121, 163: 120, 164: 90, 165: 91, 182: 118, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -316, 6: -316, 35: -316, 39: -316, 40: -316, 62: -316, 69: -316, 81: -316, 85: -316, 87: -316, 101: -316, 105: -316, 122: -316, 124: -316, 125: -316, 126: -316, 151: -316, 162: -316, 164: -316, 165: -316, 168: -316, 169: -316, 170: -316, 182: -316, 183: -316, 188: -316, 189: -316, 192: -316, 193: -316, 194: -316, 195: -316, 196: -316, 197: -316, 198: -316, 199: -316, 200: -316, 201: -316, 202: -316, 203: -316, 204: -316, 205: -316 }, { 1: -320, 6: -320, 35: -320, 39: -320, 40: -320, 62: -320, 69: -320, 81: -320, 85: -320, 87: -320, 101: -320, 105: -320, 122: -320, 124: -320, 125: -320, 126: -320, 151: -320, 162: -320, 164: -320, 165: -320, 168: -320, 169: -320, 170: -320, 182: -320, 183: -320, 188: -320, 189: -320, 192: -320, 193: -320, 194: -320, 195: -320, 196: -320, 197: -320, 198: -320, 199: -320, 200: -320, 201: -320, 202: -320, 203: -320, 204: -320, 205: -320 }, { 55: 772, 56: 99, 57: 100 }, { 6: -212, 39: -212, 40: -212, 69: -212, 125: -212 }, { 6: -235, 39: -235, 40: -235, 69: -235, 125: -235 }, { 6: -267, 35: -267, 39: -267, 40: -267, 69: -267 }, { 1: -328, 6: -328, 35: -328, 39: -328, 40: -328, 62: -328, 69: 775, 81: -328, 85: -328, 87: -328, 101: -328, 105: -328, 108: 773, 122: -328, 124: -328, 125: -328, 126: 774, 151: -328, 162: -328, 163: 120, 164: -328, 165: -328, 168: -328, 169: -328, 170: -328, 182: -328, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 7: 776, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: -109, 33: -109, 39: -109, 40: -109, 69: -109, 96: -109, 97: -109, 98: -109, 99: -109, 100: -109, 102: -109, 125: -109, 144: -109 }, { 101: 777 }, { 1: -326, 6: -326, 35: -326, 39: -326, 40: -326, 62: -326, 69: -326, 81: -326, 85: -326, 87: -326, 101: -326, 105: -326, 122: -326, 124: -326, 125: -326, 126: -326, 151: -326, 162: -326, 163: 120, 164: -326, 165: -326, 168: -326, 169: -326, 170: -326, 182: -326, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -327, 6: -327, 35: -327, 39: -327, 40: -327, 62: -327, 69: -327, 81: -327, 85: -327, 87: -327, 101: -327, 105: -327, 122: -327, 124: -327, 125: -327, 126: -327, 151: -327, 162: -327, 163: 120, 164: -327, 165: -327, 168: -327, 169: -327, 170: -327, 182: -327, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -311, 6: -311, 35: -311, 39: -311, 40: -311, 62: -311, 69: -311, 81: -311, 85: -311, 87: -311, 101: -311, 105: -311, 122: -311, 124: -311, 125: -311, 126: -311, 151: -311, 162: -311, 164: -311, 165: -311, 168: -311, 169: -311, 170: -311, 182: -311, 183: -311, 188: -311, 189: -311, 192: -311, 193: -311, 194: -311, 195: -311, 196: -311, 197: -311, 198: -311, 199: -311, 200: -311, 201: -311, 202: -311, 203: -311, 204: -311, 205: -311 }, { 1: -312, 6: -312, 35: -312, 39: -312, 40: -312, 62: -312, 69: -312, 81: -312, 85: -312, 87: -312, 101: -312, 105: -312, 122: -312, 124: -312, 125: -312, 126: -312, 151: -312, 162: -312, 164: -312, 165: -312, 168: -312, 169: -312, 170: -312, 182: -312, 183: -312, 188: -312, 189: -312, 192: -312, 193: -312, 194: -312, 195: -312, 196: -312, 197: -312, 198: -312, 199: -312, 200: -312, 201: -312, 202: -312, 203: -312, 204: -312, 205: -312 }, { 1: -207, 6: -207, 35: -207, 39: -207, 40: -207, 62: -207, 69: -207, 85: -207, 162: -207, 164: -207, 165: -207, 182: -207, 183: -207 }, { 125: 778 }, { 7: 779, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 6: -122, 35: -122, 39: -122, 40: -122, 85: -122, 125: -122 }, { 1: -330, 6: -330, 35: -330, 39: -330, 40: -330, 62: -330, 69: 775, 81: -330, 85: -330, 87: -330, 101: -330, 105: -330, 108: 780, 122: -330, 124: -330, 125: -330, 126: 781, 151: -330, 162: -330, 163: 120, 164: -330, 165: -330, 168: -330, 169: -330, 170: -330, 182: -330, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 6: -111, 33: -111, 39: -111, 40: -111, 69: -111, 96: -111, 97: -111, 98: -111, 99: -111, 100: -111, 102: -111, 125: -111, 144: -111 }, { 1: -183, 6: -183, 33: -183, 35: -183, 38: -183, 39: -183, 40: -183, 41: -183, 42: -183, 56: -183, 57: -183, 62: -183, 69: -183, 77: -183, 81: -183, 85: -183, 87: -183, 96: -183, 97: -183, 98: -183, 99: -183, 100: -183, 101: -183, 102: -183, 105: -183, 115: -183, 122: -183, 124: -183, 125: -183, 126: -183, 143: -183, 144: -183, 151: -183, 162: -183, 164: -183, 165: -183, 168: -183, 169: -183, 170: -183, 182: -183, 183: -183, 188: -183, 189: -183, 192: -183, 193: -183, 194: -183, 195: -183, 196: -183, 197: -183, 198: -183, 199: -183, 200: -183, 201: -183, 202: -183, 203: -183, 204: -183, 205: -183 }, { 1: -329, 6: -329, 35: -329, 39: -329, 40: -329, 62: -329, 69: 775, 81: -329, 85: -329, 87: -329, 101: -329, 105: -329, 108: 782, 122: -329, 124: -329, 125: -329, 126: -329, 151: -329, 162: -329, 163: 120, 164: -329, 165: -329, 168: -329, 169: -329, 170: -329, 182: -329, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 125: 783 }, { 7: 784, 9: 160, 10: 26, 11: 27, 12: 28, 13: 29, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 20, 28: 21, 29: 22, 30: 23, 31: 61, 32: 86, 37: 30, 43: 50, 44: 165, 47: 60, 48: 67, 50: 98, 53: 68, 54: 94, 55: 95, 56: 99, 57: 100, 63: 70, 64: 96, 65: 97, 66: 34, 70: 31, 71: 69, 72: 71, 73: 72, 74: 73, 75: 74, 76: 75, 83: 87, 84: 77, 86: 81, 89: 32, 90: 37, 91: 36, 92: 78, 95: 79, 103: 63, 104: 164, 106: 84, 107: 85, 111: 66, 113: 49, 116: 33, 117: 35, 118: 38, 119: 82, 120: 83, 121: 93, 122: 56, 129: 58, 131: 64, 139: 65, 146: 80, 156: 53, 160: 59, 161: 76, 163: 54, 164: 90, 165: 91, 166: 55, 167: 92, 171: 46, 173: 57, 178: 51, 179: 88, 180: 52, 181: 89, 184: 166, 185: 167, 186: 168, 187: 43, 188: 44, 189: 45, 190: 47, 191: 48 }, { 125: 785 }, { 1: -185, 6: -185, 33: -185, 35: -185, 38: -185, 39: -185, 40: -185, 41: -185, 42: -185, 56: -185, 57: -185, 62: -185, 69: -185, 77: -185, 81: -185, 85: -185, 87: -185, 96: -185, 97: -185, 98: -185, 99: -185, 100: -185, 101: -185, 102: -185, 105: -185, 115: -185, 122: -185, 124: -185, 125: -185, 126: -185, 143: -185, 144: -185, 151: -185, 162: -185, 164: -185, 165: -185, 168: -185, 169: -185, 170: -185, 182: -185, 183: -185, 188: -185, 189: -185, 192: -185, 193: -185, 194: -185, 195: -185, 196: -185, 197: -185, 198: -185, 199: -185, 200: -185, 201: -185, 202: -185, 203: -185, 204: -185, 205: -185 }, { 1: -331, 6: -331, 35: -331, 39: -331, 40: -331, 62: -331, 69: 775, 81: -331, 85: -331, 87: -331, 101: -331, 105: -331, 108: 786, 122: -331, 124: -331, 125: -331, 126: -331, 151: -331, 162: -331, 163: 120, 164: -331, 165: -331, 168: -331, 169: -331, 170: -331, 182: -331, 183: 119, 188: 104, 189: 103, 192: 102, 193: 105, 194: 106, 195: 107, 196: 108, 197: 109, 198: 110, 199: 111, 200: 112, 201: 113, 202: 114, 203: 115, 204: 116, 205: 117 }, { 1: -184, 6: -184, 33: -184, 35: -184, 38: -184, 39: -184, 40: -184, 41: -184, 42: -184, 56: -184, 57: -184, 62: -184, 69: -184, 77: -184, 81: -184, 85: -184, 87: -184, 96: -184, 97: -184, 98: -184, 99: -184, 100: -184, 101: -184, 102: -184, 105: -184, 115: -184, 122: -184, 124: -184, 125: -184, 126: -184, 143: -184, 144: -184, 151: -184, 162: -184, 164: -184, 165: -184, 168: -184, 169: -184, 170: -184, 182: -184, 183: -184, 188: -184, 189: -184, 192: -184, 193: -184, 194: -184, 195: -184, 196: -184, 197: -184, 198: -184, 199: -184, 200: -184, 201: -184, 202: -184, 203: -184, 204: -184, 205: -184 }, { 125: 787 }, { 1: -186, 6: -186, 33: -186, 35: -186, 38: -186, 39: -186, 40: -186, 41: -186, 42: -186, 56: -186, 57: -186, 62: -186, 69: -186, 77: -186, 81: -186, 85: -186, 87: -186, 96: -186, 97: -186, 98: -186, 99: -186, 100: -186, 101: -186, 102: -186, 105: -186, 115: -186, 122: -186, 124: -186, 125: -186, 126: -186, 143: -186, 144: -186, 151: -186, 162: -186, 164: -186, 165: -186, 168: -186, 169: -186, 170: -186, 182: -186, 183: -186, 188: -186, 189: -186, 192: -186, 193: -186, 194: -186, 195: -186, 196: -186, 197: -186, 198: -186, 199: -186, 200: -186, 201: -186, 202: -186, 203: -186, 204: -186, 205: -186 }],
  ruleTable: [0, 0, 3, 0, 3, 1, 4, 1, 4, 3, 4, 2, 5, 1, 5, 1, 5, 1, 9, 1, 9, 1, 9, 1, 9, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 30, 6, 30, 3, 18, 3, 18, 4, 18, 5, 19, 3, 19, 4, 19, 5, 20, 3, 20, 4, 20, 5, 21, 3, 21, 2, 8, 1, 8, 1, 29, 1, 29, 2, 29, 4, 29, 3, 36, 2, 36, 3, 32, 1, 51, 1, 53, 1, 53, 1, 55, 1, 55, 3, 58, 1, 58, 2, 60, 3, 60, 5, 60, 2, 60, 1, 63, 1, 63, 3, 68, 3, 68, 1, 70, 1, 70, 1, 70, 1, 70, 1, 70, 1, 70, 1, 70, 1, 70, 1, 17, 3, 17, 4, 17, 5, 78, 1, 78, 1, 78, 3, 78, 5, 78, 3, 78, 5, 82, 1, 82, 1, 82, 1, 79, 1, 79, 3, 79, 4, 79, 1, 80, 2, 80, 2, 88, 1, 88, 1, 88, 1, 88, 1, 88, 1, 88, 3, 88, 2, 88, 3, 88, 3, 88, 3, 88, 3, 88, 3, 88, 3, 88, 2, 88, 2, 88, 4, 88, 6, 88, 5, 88, 7, 10, 2, 10, 4, 10, 1, 15, 5, 15, 2, 45, 5, 45, 2, 44, 1, 44, 1, 108, 0, 108, 1, 34, 0, 34, 1, 34, 3, 34, 4, 34, 6, 109, 1, 109, 3, 109, 2, 109, 1, 110, 1, 110, 1, 110, 1, 110, 1, 112, 2, 113, 1, 113, 1, 113, 3, 113, 3, 113, 3, 113, 3, 113, 2, 113, 2, 113, 4, 113, 6, 113, 4, 113, 6, 113, 4, 113, 5, 113, 7, 113, 5, 113, 7, 113, 5, 113, 7, 113, 3, 113, 3, 113, 3, 113, 3, 113, 2, 113, 2, 113, 4, 113, 6, 113, 5, 113, 7, 37, 1, 37, 1, 37, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 90, 3, 90, 4, 90, 6, 118, 3, 118, 3, 48, 10, 48, 12, 48, 11, 48, 13, 48, 4, 128, 0, 128, 1, 128, 3, 128, 4, 128, 6, 27, 1, 27, 2, 27, 3, 27, 4, 27, 2, 27, 3, 27, 4, 27, 5, 12, 2, 12, 4, 12, 4, 12, 5, 12, 7, 12, 6, 12, 9, 134, 1, 134, 3, 134, 4, 134, 4, 134, 6, 135, 1, 135, 3, 135, 1, 135, 3, 132, 1, 133, 3, 13, 3, 13, 5, 13, 2, 13, 2, 13, 4, 13, 5, 13, 6, 13, 3, 13, 5, 13, 4, 13, 5, 13, 7, 140, 1, 140, 3, 140, 4, 140, 4, 140, 6, 142, 1, 142, 3, 142, 3, 142, 1, 142, 3, 66, 3, 66, 3, 66, 3, 66, 2, 66, 2, 93, 0, 93, 1, 94, 2, 94, 4, 91, 1, 91, 1, 83, 2, 111, 2, 111, 3, 111, 4, 150, 1, 150, 1, 116, 5, 114, 3, 114, 2, 114, 2, 114, 1, 145, 1, 145, 3, 145, 4, 145, 4, 145, 6, 152, 1, 152, 1, 152, 1, 152, 1, 148, 1, 148, 3, 148, 4, 148, 4, 148, 6, 153, 1, 153, 2, 149, 1, 149, 2, 147, 1, 147, 2, 154, 1, 154, 2, 155, 1, 155, 3, 23, 2, 23, 3, 23, 4, 23, 5, 157, 3, 157, 3, 157, 2, 28, 2, 28, 4, 89, 3, 89, 5, 163, 2, 163, 4, 163, 2, 163, 4, 24, 2, 24, 2, 24, 2, 24, 1, 166, 2, 166, 2, 25, 5, 25, 7, 25, 7, 25, 9, 25, 9, 25, 5, 25, 7, 25, 6, 25, 8, 25, 5, 25, 7, 25, 6, 25, 8, 25, 3, 25, 5, 25, 5, 25, 7, 25, 7, 25, 9, 25, 9, 25, 5, 25, 7, 25, 6, 25, 8, 25, 5, 25, 7, 25, 6, 25, 8, 25, 3, 25, 5, 172, 1, 172, 3, 123, 1, 123, 3, 26, 5, 26, 7, 26, 4, 26, 6, 174, 1, 174, 2, 176, 3, 176, 4, 178, 3, 178, 5, 180, 3, 180, 5, 22, 1, 22, 3, 22, 1, 22, 3, 22, 3, 22, 3, 22, 3, 46, 2, 46, 2, 46, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 4, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 5, 16, 3, 16, 5, 16, 4, 117, 2],
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
      case 124:
      case 189:
      case 208:
      case 231:
      case 263:
      case 277:
      case 281:
      case 340:
      case 346:
        return [$[$0]];
      case 4:
      case 125:
      case 190:
      case 209:
      case 232:
      case 264:
        return [...$[$0 - 2], $[$0]];
      case 5:
      case 59:
      case 284:
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
      case 43:
      case 44:
      case 51:
      case 52:
      case 53:
      case 54:
      case 55:
      case 62:
      case 63:
      case 67:
      case 68:
      case 69:
      case 72:
      case 73:
      case 74:
      case 79:
      case 84:
      case 85:
      case 86:
      case 87:
      case 90:
      case 93:
      case 94:
      case 95:
      case 96:
      case 97:
      case 119:
      case 120:
      case 121:
      case 122:
      case 128:
      case 132:
      case 133:
      case 134:
      case 135:
      case 137:
      case 138:
      case 166:
      case 167:
      case 168:
      case 169:
      case 170:
      case 171:
      case 172:
      case 173:
      case 174:
      case 175:
      case 176:
      case 177:
      case 213:
      case 215:
      case 217:
      case 236:
      case 239:
      case 268:
      case 269:
      case 270:
      case 272:
      case 285:
      case 305:
      case 338:
      case 354:
      case 356:
        return $[$0];
      case 30:
        return ["def", $[$0 - 4], $[$0 - 2], $[$0]];
      case 31:
        return ["def", $[$0 - 1], [], $[$0]];
      case 32:
        return ["signal", $[$0 - 2], $[$0]];
      case 33:
        return ["signal", $[$0 - 3], $[$0]];
      case 34:
        return ["signal", $[$0 - 4], $[$0 - 1]];
      case 35:
        return ["derived", $[$0 - 2], $[$0]];
      case 36:
        return ["derived", $[$0 - 3], $[$0]];
      case 37:
        return ["derived", $[$0 - 4], $[$0 - 1]];
      case 38:
        return ["readonly", $[$0 - 2], $[$0]];
      case 39:
        return ["readonly", $[$0 - 3], $[$0]];
      case 40:
        return ["readonly", $[$0 - 4], $[$0 - 1]];
      case 41:
      case 42:
        return ["effect", $[$0]];
      case 45:
        return ["yield"];
      case 46:
        return ["yield", $[$0]];
      case 47:
        return ["yield", $[$0 - 1]];
      case 48:
        return ["yield-from", $[$0]];
      case 49:
        return ["block"];
      case 50:
        return ["block", ...$[$0 - 1]];
      case 56:
        return ["str", ...$[$0 - 1]];
      case 58:
      case 278:
      case 282:
      case 347:
        return [...$[$0 - 1], $[$0]];
      case 60:
      case 211:
      case 234:
      case 249:
      case 266:
        return $[$0 - 2];
      case 61:
        return "";
      case 64:
        return ["regex", $[$0 - 1]];
      case 65:
        return ["regex-index", $[$0 - 2], $[$0]];
      case 66:
        return ["regex-index", $[$0], null];
      case 70:
        return "undefined";
      case 71:
        return "null";
      case 75:
        return ["=", $[$0 - 2], $[$0]];
      case 76:
        return ["=", $[$0 - 3], $[$0]];
      case 77:
        return ["=", $[$0 - 4], $[$0 - 1]];
      case 78:
        return [$[$0], $[$0], null];
      case 80:
        return [$[$0 - 2], $[$0], ":"];
      case 81:
        return [$[$0 - 4], $[$0 - 1], ":"];
      case 82:
        return [$[$0 - 2], $[$0], "="];
      case 83:
        return [$[$0 - 4], $[$0 - 1], "="];
      case 88:
        return ["computed", $[$0 - 1]];
      case 89:
        return ["[]", "this", $[$0 - 1]];
      case 91:
      case 92:
      case 136:
        return ["...", $[$0]];
      case 98:
      case 244:
        return ["super", ...$[$0]];
      case 99:
      case 245:
        return ["import", ...$[$0]];
      case 100:
      case 101:
        return [$[$0 - 2], ...$[$0]];
      case 102:
      case 139:
      case 156:
        return [".", $[$0 - 2], $[$0]];
      case 103:
      case 140:
      case 157:
        return ["?.", $[$0 - 2], $[$0]];
      case 104:
      case 141:
      case 158:
        return ["::", $[$0 - 2], $[$0]];
      case 105:
      case 142:
      case 159:
        return ["?::", $[$0 - 2], $[$0]];
      case 106:
      case 143:
      case 160:
        return ["::", $[$0 - 1], "prototype"];
      case 107:
      case 144:
      case 161:
        return ["?::", $[$0 - 1], "prototype"];
      case 108:
      case 145:
      case 147:
      case 162:
        return ["[]", $[$0 - 3], $[$0 - 1]];
      case 109:
      case 146:
      case 148:
      case 163:
        return ["[]", $[$0 - 5], $[$0 - 2]];
      case 110:
      case 150:
      case 152:
      case 164:
        return ["?[]", $[$0 - 4], $[$0 - 1]];
      case 111:
      case 151:
      case 153:
      case 165:
        return ["?[]", $[$0 - 6], $[$0 - 2]];
      case 112:
        return ["return", $[$0]];
      case 113:
        return ["return", $[$0 - 1]];
      case 114:
        return ["return"];
      case 115:
      case 117:
        return [$[$0 - 1], $[$0 - 3], $[$0]];
      case 116:
      case 118:
        return [$[$0 - 1], [], $[$0]];
      case 123:
      case 188:
      case 248:
      case 279:
        return [];
      case 126:
      case 191:
      case 210:
      case 233:
      case 265:
        return [...$[$0 - 3], $[$0]];
      case 127:
      case 192:
      case 212:
      case 235:
      case 267:
        return [...$[$0 - 5], ...$[$0 - 2]];
      case 129:
      case 339:
        return ["default", $[$0 - 2], $[$0]];
      case 130:
        return ["rest", $[$0]];
      case 131:
        return ["expansion"];
      case 149:
        return [$[$0 - 1][0], $[$0 - 3], ...$[$0 - 1].slice(1)];
      case 154:
        return ["optindex", $[$0 - 4], $[$0 - 1]];
      case 155:
        return ["optindex", $[$0 - 6], $[$0 - 2]];
      case 178:
        return [".", "super", $[$0]];
      case 179:
        return ["[]", "super", $[$0 - 1]];
      case 180:
        return ["[]", "super", $[$0 - 2]];
      case 181:
        return [".", "new", $[$0]];
      case 182:
        return [".", "import", $[$0]];
      case 183:
        return ["object-comprehension", $[$0 - 8], $[$0 - 6], [["for-of", $[$0 - 4], $[$0 - 2], false]], []];
      case 184:
        return ["object-comprehension", $[$0 - 10], $[$0 - 8], [["for-of", $[$0 - 6], $[$0 - 4], false]], [$[$0 - 2]]];
      case 185:
        return ["object-comprehension", $[$0 - 9], $[$0 - 7], [["for-of", $[$0 - 4], $[$0 - 2], true]], []];
      case 186:
        return ["object-comprehension", $[$0 - 11], $[$0 - 9], [["for-of", $[$0 - 6], $[$0 - 4], true]], [$[$0 - 2]]];
      case 187:
        return ["object", ...$[$0 - 2]];
      case 193:
        return ["class", null, null];
      case 194:
        return ["class", null, null, $[$0]];
      case 195:
        return ["class", null, $[$0]];
      case 196:
        return ["class", null, $[$0 - 1], $[$0]];
      case 197:
        return ["class", $[$0], null];
      case 198:
        return ["class", $[$0 - 1], null, $[$0]];
      case 199:
        return ["class", $[$0 - 2], $[$0]];
      case 200:
        return ["class", $[$0 - 3], $[$0 - 1], $[$0]];
      case 201:
      case 204:
        return ["import", "{}", $[$0]];
      case 202:
      case 203:
        return ["import", $[$0 - 2], $[$0]];
      case 205:
        return ["import", $[$0 - 4], $[$0]];
      case 206:
        return ["import", [$[$0 - 4], $[$0 - 2]], $[$0]];
      case 207:
        return ["import", [$[$0 - 7], $[$0 - 4]], $[$0]];
      case 214:
      case 216:
      case 237:
      case 238:
      case 240:
      case 341:
        return [$[$0 - 2], $[$0]];
      case 218:
        return ["*", $[$0]];
      case 219:
        return ["export", "{}"];
      case 220:
        return ["export", $[$0 - 2]];
      case 221:
      case 222:
        return ["export", $[$0]];
      case 223:
        return ["export", ["=", $[$0 - 2], $[$0]]];
      case 224:
        return ["export", ["=", $[$0 - 3], $[$0]]];
      case 225:
        return ["export", ["=", $[$0 - 4], $[$0 - 1]]];
      case 226:
        return ["export-default", $[$0]];
      case 227:
        return ["export-default", $[$0 - 1]];
      case 228:
        return ["export-all", $[$0]];
      case 229:
        return ["export-from", "{}", $[$0]];
      case 230:
        return ["export-from", $[$0 - 4], $[$0]];
      case 241:
        return ["tagged-template", $[$0 - 2], $[$0]];
      case 242:
        return $[$0 - 1] ? ["?call", $[$0 - 2], ...$[$0]] : [$[$0 - 2], ...$[$0]];
      case 243:
        return ["optcall", $[$0 - 2], ...$[$0]];
      case 246:
      case 283:
        return null;
      case 247:
        return true;
      case 250:
      case 251:
        return "this";
      case 252:
        return [".", "this", $[$0]];
      case 253:
        return ["array"];
      case 254:
        return ["array", ...$[$0 - 1]];
      case 255:
        return ["array", ...$[$0 - 2], ...$[$0 - 1]];
      case 256:
        return "..";
      case 257:
      case 271:
        return "...";
      case 258:
        return [$[$0 - 2], $[$0 - 3], $[$0 - 1]];
      case 259:
      case 378:
      case 380:
      case 381:
      case 389:
      case 391:
        return [$[$0 - 1], $[$0 - 2], $[$0]];
      case 260:
        return [$[$0], $[$0 - 1], null];
      case 261:
        return [$[$0 - 1], null, $[$0]];
      case 262:
        return [$[$0], null, null];
      case 273:
        return [...$[$0 - 2], ...$[$0]];
      case 274:
        return [...$[$0 - 3], ...$[$0]];
      case 275:
        return [...$[$0 - 2], ...$[$0 - 1]];
      case 276:
        return [...$[$0 - 5], ...$[$0 - 4], ...$[$0 - 2], ...$[$0 - 1]];
      case 280:
        return [...$[$0]];
      case 286:
        return Array.isArray($[$0 - 2]) ? [...$[$0 - 2], $[$0]] : [$[$0 - 2], $[$0]];
      case 287:
        return ["try", $[$0]];
      case 288:
        return ["try", $[$0 - 1], $[$0]];
      case 289:
        return ["try", $[$0 - 2], $[$0]];
      case 290:
        return ["try", $[$0 - 3], $[$0 - 2], $[$0]];
      case 291:
      case 292:
      case 361:
      case 364:
      case 366:
        return [$[$0 - 1], $[$0]];
      case 293:
        return [null, $[$0]];
      case 294:
        return ["throw", $[$0]];
      case 295:
        return ["throw", $[$0 - 1]];
      case 296:
        return $[$0 - 1].length === 1 ? $[$0 - 1][0] : $[$0 - 1];
      case 297:
        return $[$0 - 2].length === 1 ? $[$0 - 2][0] : $[$0 - 2];
      case 298:
        return ["while", $[$0]];
      case 299:
        return ["while", $[$0 - 2], $[$0]];
      case 300:
        return ["until", $[$0]];
      case 301:
        return ["until", $[$0 - 2], $[$0]];
      case 302:
        return $[$0 - 1].length === 2 ? [$[$0 - 1][0], $[$0 - 1][1], $[$0]] : [$[$0 - 1][0], $[$0 - 1][1], $[$0 - 1][2], $[$0]];
      case 303:
      case 304:
        return $[$0].length === 2 ? [$[$0][0], $[$0][1], [$[$0 - 1]]] : [$[$0][0], $[$0][1], $[$0][2], [$[$0 - 1]]];
      case 306:
        return ["loop", $[$0]];
      case 307:
        return ["loop", [$[$0]]];
      case 308:
        return ["for-in", $[$0 - 3], $[$0 - 1], null, null, $[$0]];
      case 309:
        return ["for-in", $[$0 - 5], $[$0 - 3], null, $[$0 - 1], $[$0]];
      case 310:
        return ["for-in", $[$0 - 5], $[$0 - 3], $[$0 - 1], null, $[$0]];
      case 311:
        return ["for-in", $[$0 - 7], $[$0 - 5], $[$0 - 1], $[$0 - 3], $[$0]];
      case 312:
        return ["for-in", $[$0 - 7], $[$0 - 5], $[$0 - 3], $[$0 - 1], $[$0]];
      case 313:
        return ["for-of", $[$0 - 3], $[$0 - 1], false, null, $[$0]];
      case 314:
        return ["for-of", $[$0 - 5], $[$0 - 3], false, $[$0 - 1], $[$0]];
      case 315:
        return ["for-of", $[$0 - 3], $[$0 - 1], true, null, $[$0]];
      case 316:
        return ["for-of", $[$0 - 5], $[$0 - 3], true, $[$0 - 1], $[$0]];
      case 317:
        return ["for-from", $[$0 - 3], $[$0 - 1], false, null, $[$0]];
      case 318:
        return ["for-from", $[$0 - 5], $[$0 - 3], false, $[$0 - 1], $[$0]];
      case 319:
        return ["for-from", $[$0 - 3], $[$0 - 1], true, null, $[$0]];
      case 320:
        return ["for-from", $[$0 - 5], $[$0 - 3], true, $[$0 - 1], $[$0]];
      case 321:
        return ["for-in", [], $[$0 - 1], null, null, $[$0]];
      case 322:
        return ["for-in", [], $[$0 - 3], $[$0 - 1], null, $[$0]];
      case 323:
        return ["comprehension", $[$0 - 4], [["for-in", $[$0 - 2], $[$0], null]], []];
      case 324:
        return ["comprehension", $[$0 - 6], [["for-in", $[$0 - 4], $[$0 - 2], null]], [$[$0]]];
      case 325:
        return ["comprehension", $[$0 - 6], [["for-in", $[$0 - 4], $[$0 - 2], $[$0]]], []];
      case 326:
        return ["comprehension", $[$0 - 8], [["for-in", $[$0 - 6], $[$0 - 4], $[$0]]], [$[$0 - 2]]];
      case 327:
        return ["comprehension", $[$0 - 8], [["for-in", $[$0 - 6], $[$0 - 4], $[$0 - 2]]], [$[$0]]];
      case 328:
        return ["comprehension", $[$0 - 4], [["for-of", $[$0 - 2], $[$0], false]], []];
      case 329:
        return ["comprehension", $[$0 - 6], [["for-of", $[$0 - 4], $[$0 - 2], false]], [$[$0]]];
      case 330:
        return ["comprehension", $[$0 - 5], [["for-of", $[$0 - 2], $[$0], true]], []];
      case 331:
        return ["comprehension", $[$0 - 7], [["for-of", $[$0 - 4], $[$0 - 2], true]], [$[$0]]];
      case 332:
        return ["comprehension", $[$0 - 4], [["for-from", $[$0 - 2], $[$0], false, null]], []];
      case 333:
        return ["comprehension", $[$0 - 6], [["for-from", $[$0 - 4], $[$0 - 2], false, null]], [$[$0]]];
      case 334:
        return ["comprehension", $[$0 - 5], [["for-from", $[$0 - 2], $[$0], true, null]], []];
      case 335:
        return ["comprehension", $[$0 - 7], [["for-from", $[$0 - 4], $[$0 - 2], true, null]], [$[$0]]];
      case 336:
        return ["comprehension", $[$0 - 2], [["for-in", [], $[$0], null]], []];
      case 337:
        return ["comprehension", $[$0 - 4], [["for-in", [], $[$0 - 2], $[$0]]], []];
      case 342:
        return ["switch", $[$0 - 3], $[$0 - 1], null];
      case 343:
        return ["switch", $[$0 - 5], $[$0 - 3], $[$0 - 1]];
      case 344:
        return ["switch", null, $[$0 - 1], null];
      case 345:
        return ["switch", null, $[$0 - 3], $[$0 - 1]];
      case 348:
        return ["when", $[$0 - 1], $[$0]];
      case 349:
        return ["when", $[$0 - 2], $[$0 - 1]];
      case 350:
        return ["if", $[$0 - 1], $[$0]];
      case 351:
        return $[$0 - 4].length === 3 ? ["if", $[$0 - 4][1], $[$0 - 4][2], ["if", $[$0 - 1], $[$0]]] : [...$[$0 - 4], ["if", $[$0 - 1], $[$0]]];
      case 352:
        return ["unless", $[$0 - 1], $[$0]];
      case 353:
        return ["if", ["!", $[$0 - 3]], $[$0 - 2], $[$0]];
      case 355:
        return $[$0 - 2].length === 3 ? ["if", $[$0 - 2][1], $[$0 - 2][2], $[$0]] : [...$[$0 - 2], $[$0]];
      case 357:
      case 358:
        return ["if", $[$0], [$[$0 - 2]]];
      case 359:
      case 360:
        return ["unless", $[$0], [$[$0 - 2]]];
      case 362:
      case 363:
      case 365:
      case 394:
        return ["do-iife", $[$0]];
      case 367:
        return ["-", $[$0]];
      case 368:
        return ["+", $[$0]];
      case 369:
        return ["await", $[$0]];
      case 370:
        return ["await", $[$0 - 1]];
      case 371:
        return ["--", $[$0], false];
      case 372:
        return ["++", $[$0], false];
      case 373:
        return ["--", $[$0 - 1], true];
      case 374:
        return ["++", $[$0 - 1], true];
      case 375:
        return ["?", $[$0 - 1]];
      case 376:
        return ["+", $[$0 - 2], $[$0]];
      case 377:
        return ["-", $[$0 - 2], $[$0]];
      case 379:
        return ["**", $[$0 - 2], $[$0]];
      case 382:
        return ["&", $[$0 - 2], $[$0]];
      case 383:
        return ["^", $[$0 - 2], $[$0]];
      case 384:
        return ["|", $[$0 - 2], $[$0]];
      case 385:
        return ["&&", $[$0 - 2], $[$0]];
      case 386:
        return ["||", $[$0 - 2], $[$0]];
      case 387:
        return ["??", $[$0 - 2], $[$0]];
      case 388:
        return ["!?", $[$0 - 2], $[$0]];
      case 390:
        return ["?:", $[$0 - 4], $[$0 - 2], $[$0]];
      case 392:
        return [$[$0 - 3], $[$0 - 4], $[$0 - 1]];
      case 393:
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
    const newVars = new Set([...bodyVars].filter((v) => !this.programVars.has(v) && !paramNames.has(v)));
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
    return `// === Rip Reactive Runtime ===
let __currentEffect = null, __pendingEffects = new Set();
function __signal(v) {
  const subs = new Set();
  let notifying = false, locked = false, dead = false;
  const s = {
    get value() { if (dead) return v; if (__currentEffect) { subs.add(__currentEffect); __currentEffect.dependencies.add(subs); } return v; },
    set value(n) {
      if (dead || locked || n === v || notifying) return;
      v = n;
      notifying = true;
      for (const sub of subs) if (sub.markDirty) sub.markDirty();
      for (const sub of subs) if (!sub.markDirty) __pendingEffects.add(sub);
      const fx = [...__pendingEffects]; __pendingEffects.clear();
      for (const e of fx) e.run();
      notifying = false;
    },
    read() { return v; },
    lock() { locked = true; return s; },
    free() { subs.clear(); return s; },
    kill() { dead = true; subs.clear(); return v; },
    valueOf() { return this.value; },
    toString() { return String(this.value); },
    [Symbol.toPrimitive](hint) { return hint === 'string' ? this.toString() : this.valueOf(); }
  };
  return s;
}
function __computed(fn) {
  let v, dirty = true, locked = false, dead = false;
  const subs = new Set();
  const c = {
    dependencies: new Set(),
    markDirty() {
      if (dead || locked || !dirty) { if (!dead && !locked && !dirty) { dirty = true; for (const s of subs) if (s.markDirty) s.markDirty(); for (const s of subs) if (!s.markDirty) __pendingEffects.add(s); } }
    },
    get value() {
      if (dead) return v;
      if (__currentEffect) { subs.add(__currentEffect); __currentEffect.dependencies.add(subs); }
      if (dirty && !locked) {
        for (const d of c.dependencies) d.delete(c); c.dependencies.clear();
        const prev = __currentEffect; __currentEffect = c;
        try { v = fn(); } finally { __currentEffect = prev; }
        dirty = false;
      }
      return v;
    },
    read() { return dead ? v : c.value; },
    lock() { locked = true; c.value; return c; },
    free() { for (const d of c.dependencies) d.delete(c); c.dependencies.clear(); subs.clear(); return c; },
    kill() { dead = true; const result = v; c.free(); return result; },
    valueOf() { return this.value; },
    toString() { return String(this.value); },
    [Symbol.toPrimitive](hint) { return hint === 'string' ? this.toString() : this.valueOf(); }
  };
  return c;
}
function __effect(fn) {
  const e = {
    dependencies: new Set(),
    run() {
      for (const d of e.dependencies) d.delete(e); e.dependencies.clear();
      const prev = __currentEffect; __currentEffect = e;
      try { fn(); } finally { __currentEffect = prev; }
    },
    dispose() { for (const d of e.dependencies) d.delete(e); e.dependencies.clear(); }
  };
  e.run();
  return () => e.dispose();
}
function __batch(fn) {
  // Simple batch - just run the function, signals handle their own notifications
  fn();
}
function __readonly(v) { return Object.freeze({ value: v }); }
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
var VERSION = "2.0.0";
var BUILD_DATE = "2026-01-14@19:28:21GMT";
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
