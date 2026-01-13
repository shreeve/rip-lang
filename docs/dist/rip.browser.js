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
RIP_KEYWORDS = ["undefined", "Infinity", "NaN", "then", "unless", "until", "loop", "of", "by", "when", "def"];
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
IDENTIFIER = /^(?!\d)((?:(?!\s)[$\w\x7f-\uffff])+!?)([^\n\S]*:(?!:))?/;
NUMBER = /^0b[01](?:_?[01])*n?|^0o[0-7](?:_?[0-7])*n?|^0x[\da-f](?:_?[\da-f])*n?|^\d+(?:_\d+)*n|^(?:\d+(?:_\d+)*)?\.?\d+(?:_\d+)*(?:e[+-]?\d+(?:_\d+)*)?/i;
OPERATOR = /^(?:[-=]>|===|!==|!\?|\?\?|=~|[-+*\/%<>&|^!?=]=|>>>=?|([-+:])\1|([&|<>*\/%])\2=?|\?(\.|::)|\.{2,3})/;
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
  symbolIds: { $accept: 0, $end: 1, error: 2, Root: 3, Body: 4, Line: 5, TERMINATOR: 6, Expression: 7, ExpressionLine: 8, Statement: 9, Return: 10, STATEMENT: 11, Import: 12, Export: 13, Value: 14, Code: 15, Operation: 16, Assign: 17, If: 18, Try: 19, While: 20, For: 21, Switch: 22, Class: 23, Throw: 24, Yield: 25, Def: 26, DEF: 27, Identifier: 28, CALL_START: 29, ParamList: 30, CALL_END: 31, Block: 32, CodeLine: 33, OperationLine: 34, YIELD: 35, INDENT: 36, Object: 37, OUTDENT: 38, FROM: 39, IDENTIFIER: 40, Property: 41, PROPERTY: 42, AlphaNumeric: 43, NUMBER: 44, String: 45, STRING: 46, STRING_START: 47, Interpolations: 48, STRING_END: 49, InterpolationChunk: 50, INTERPOLATION_START: 51, INTERPOLATION_END: 52, Regex: 53, REGEX: 54, REGEX_START: 55, Invocation: 56, REGEX_END: 57, RegexWithIndex: 58, ",": 59, Literal: 60, JS: 61, UNDEFINED: 62, NULL: 63, BOOL: 64, INFINITY: 65, NAN: 66, Assignable: 67, "=": 68, AssignObj: 69, ObjAssignable: 70, ObjRestValue: 71, ":": 72, SimpleObjAssignable: 73, ThisProperty: 74, "[": 75, "]": 76, "@": 77, "...": 78, ObjSpreadExpr: 79, Parenthetical: 80, Super: 81, This: 82, SUPER: 83, OptFuncExist: 84, Arguments: 85, DYNAMIC_IMPORT: 86, ".": 87, "?.": 88, "::": 89, "?::": 90, INDEX_START: 91, INDEX_END: 92, INDEX_SOAK: 93, RETURN: 94, PARAM_START: 95, PARAM_END: 96, FuncGlyph: 97, "->": 98, "=>": 99, OptComma: 100, Param: 101, ParamVar: 102, Array: 103, Splat: 104, SimpleAssignable: 105, Slice: 106, ES6_OPTIONAL_INDEX: 107, Range: 108, DoIife: 109, MetaProperty: 110, NEW_TARGET: 111, IMPORT_META: 112, "{": 113, FOR: 114, ForVariables: 115, FOROF: 116, "}": 117, WHEN: 118, OWN: 119, AssignList: 120, CLASS: 121, EXTENDS: 122, IMPORT: 123, ImportDefaultSpecifier: 124, ImportNamespaceSpecifier: 125, ImportSpecifierList: 126, ImportSpecifier: 127, AS: 128, DEFAULT: 129, IMPORT_ALL: 130, EXPORT: 131, ExportSpecifierList: 132, EXPORT_ALL: 133, ExportSpecifier: 134, ES6_OPTIONAL_CALL: 135, FUNC_EXIST: 136, ArgList: 137, THIS: 138, Elisions: 139, ArgElisionList: 140, OptElisions: 141, RangeDots: 142, "..": 143, Arg: 144, ArgElision: 145, Elision: 146, SimpleArgs: 147, TRY: 148, Catch: 149, FINALLY: 150, CATCH: 151, THROW: 152, "(": 153, ")": 154, WhileSource: 155, WHILE: 156, UNTIL: 157, Loop: 158, LOOP: 159, FORIN: 160, BY: 161, FORFROM: 162, AWAIT: 163, ForValue: 164, SWITCH: 165, Whens: 166, ELSE: 167, When: 168, LEADING_WHEN: 169, IfBlock: 170, IF: 171, UnlessBlock: 172, UNLESS: 173, POST_IF: 174, POST_UNLESS: 175, UNARY: 176, DO: 177, DO_IIFE: 178, UNARY_MATH: 179, "-": 180, "+": 181, "--": 182, "++": 183, "?": 184, MATH: 185, "**": 186, SHIFT: 187, COMPARE: 188, "&": 189, "^": 190, "|": 191, "&&": 192, "||": 193, "??": 194, "!?": 195, RELATION: 196, "SPACE?": 197, COMPOUND_ASSIGN: 198 },
  tokenNames: { 2: "error", 6: "TERMINATOR", 11: "STATEMENT", 27: "DEF", 29: "CALL_START", 31: "CALL_END", 35: "YIELD", 36: "INDENT", 38: "OUTDENT", 39: "FROM", 40: "IDENTIFIER", 42: "PROPERTY", 44: "NUMBER", 46: "STRING", 47: "STRING_START", 49: "STRING_END", 51: "INTERPOLATION_START", 52: "INTERPOLATION_END", 54: "REGEX", 55: "REGEX_START", 57: "REGEX_END", 59: ",", 61: "JS", 62: "UNDEFINED", 63: "NULL", 64: "BOOL", 65: "INFINITY", 66: "NAN", 68: "=", 72: ":", 75: "[", 76: "]", 77: "@", 78: "...", 83: "SUPER", 86: "DYNAMIC_IMPORT", 87: ".", 88: "?.", 89: "::", 90: "?::", 91: "INDEX_START", 92: "INDEX_END", 93: "INDEX_SOAK", 94: "RETURN", 95: "PARAM_START", 96: "PARAM_END", 98: "->", 99: "=>", 107: "ES6_OPTIONAL_INDEX", 111: "NEW_TARGET", 112: "IMPORT_META", 113: "{", 114: "FOR", 116: "FOROF", 117: "}", 118: "WHEN", 119: "OWN", 121: "CLASS", 122: "EXTENDS", 123: "IMPORT", 128: "AS", 129: "DEFAULT", 130: "IMPORT_ALL", 131: "EXPORT", 133: "EXPORT_ALL", 135: "ES6_OPTIONAL_CALL", 136: "FUNC_EXIST", 138: "THIS", 143: "..", 148: "TRY", 150: "FINALLY", 151: "CATCH", 152: "THROW", 153: "(", 154: ")", 156: "WHILE", 157: "UNTIL", 159: "LOOP", 160: "FORIN", 161: "BY", 162: "FORFROM", 163: "AWAIT", 165: "SWITCH", 167: "ELSE", 169: "LEADING_WHEN", 171: "IF", 173: "UNLESS", 174: "POST_IF", 175: "POST_UNLESS", 176: "UNARY", 177: "DO", 178: "DO_IIFE", 179: "UNARY_MATH", 180: "-", 181: "+", 182: "--", 183: "++", 184: "?", 185: "MATH", 186: "**", 187: "SHIFT", 188: "COMPARE", 189: "&", 190: "^", 191: "|", 192: "&&", 193: "||", 194: "??", 195: "!?", 196: "RELATION", 197: "SPACE?", 198: "COMPOUND_ASSIGN" },
  parseTable: [{ 1: -1, 3: 1, 4: 2, 5: 3, 7: 4, 8: 5, 9: 6, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 33: 20, 34: 21, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: 0 }, { 1: -2, 6: 96 }, { 1: -3, 6: -3, 38: -3, 52: -3, 154: -3 }, { 1: -6, 6: -6, 31: -6, 36: -6, 38: -6, 52: -6, 59: -6, 76: -6, 114: 116, 154: -6, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -7, 6: -7, 31: -7, 36: -7, 38: -7, 52: -7, 59: -7, 76: -7, 154: -7 }, { 1: -8, 6: -8, 31: -8, 36: -8, 38: -8, 52: -8, 59: -8, 76: -8, 154: -8, 155: 119, 156: 85, 157: 86, 174: 117, 175: 118 }, { 1: -13, 6: -13, 29: -231, 31: -13, 36: -13, 38: -13, 46: -231, 47: -231, 52: -13, 59: -13, 72: -13, 76: -13, 78: -13, 84: 120, 87: 122, 88: 123, 89: 124, 90: 125, 91: 126, 92: -13, 93: 127, 96: -13, 107: 128, 114: -13, 116: -13, 117: -13, 118: -13, 135: 121, 136: 129, 143: -13, 154: -13, 156: -13, 157: -13, 160: -13, 161: -13, 162: -13, 174: -13, 175: -13, 180: -13, 181: -13, 184: -13, 185: -13, 186: -13, 187: -13, 188: -13, 189: -13, 190: -13, 191: -13, 192: -13, 193: -13, 194: -13, 195: -13, 196: -13, 197: -13 }, { 1: -14, 6: -14, 31: -14, 36: -14, 38: -14, 52: -14, 59: -14, 72: -14, 76: -14, 78: -14, 87: 130, 88: 131, 89: 132, 90: 133, 91: 134, 92: -14, 93: 135, 96: -14, 114: -14, 116: -14, 117: -14, 118: -14, 143: -14, 154: -14, 156: -14, 157: -14, 160: -14, 161: -14, 162: -14, 174: -14, 175: -14, 180: -14, 181: -14, 184: -14, 185: -14, 186: -14, 187: -14, 188: -14, 189: -14, 190: -14, 191: -14, 192: -14, 193: -14, 194: -14, 195: -14, 196: -14, 197: -14 }, { 1: -15, 6: -15, 31: -15, 36: -15, 38: -15, 52: -15, 59: -15, 72: -15, 76: -15, 78: -15, 92: -15, 96: -15, 114: -15, 116: -15, 117: -15, 118: -15, 143: -15, 154: -15, 156: -15, 157: -15, 160: -15, 161: -15, 162: -15, 174: -15, 175: -15, 180: -15, 181: -15, 184: -15, 185: -15, 186: -15, 187: -15, 188: -15, 189: -15, 190: -15, 191: -15, 192: -15, 193: -15, 194: -15, 195: -15, 196: -15, 197: -15 }, { 1: -16, 6: -16, 31: -16, 36: -16, 38: -16, 52: -16, 59: -16, 72: -16, 76: -16, 78: -16, 92: -16, 96: -16, 114: -16, 116: -16, 117: -16, 118: -16, 143: -16, 154: -16, 156: -16, 157: -16, 160: -16, 161: -16, 162: -16, 174: -16, 175: -16, 180: -16, 181: -16, 184: -16, 185: -16, 186: -16, 187: -16, 188: -16, 189: -16, 190: -16, 191: -16, 192: -16, 193: -16, 194: -16, 195: -16, 196: -16, 197: -16 }, { 1: -17, 6: -17, 31: -17, 36: -17, 38: -17, 52: -17, 59: -17, 72: -17, 76: -17, 78: -17, 92: -17, 96: -17, 114: -17, 116: -17, 117: -17, 118: -17, 143: -17, 154: -17, 156: -17, 157: -17, 160: -17, 161: -17, 162: -17, 174: -17, 175: -17, 180: -17, 181: -17, 184: -17, 185: -17, 186: -17, 187: -17, 188: -17, 189: -17, 190: -17, 191: -17, 192: -17, 193: -17, 194: -17, 195: -17, 196: -17, 197: -17 }, { 1: -18, 6: -18, 31: -18, 36: -18, 38: -18, 52: -18, 59: -18, 72: -18, 76: -18, 78: -18, 92: -18, 96: -18, 114: -18, 116: -18, 117: -18, 118: -18, 143: -18, 154: -18, 156: -18, 157: -18, 160: -18, 161: -18, 162: -18, 174: -18, 175: -18, 180: -18, 181: -18, 184: -18, 185: -18, 186: -18, 187: -18, 188: -18, 189: -18, 190: -18, 191: -18, 192: -18, 193: -18, 194: -18, 195: -18, 196: -18, 197: -18 }, { 1: -19, 6: -19, 31: -19, 36: -19, 38: -19, 52: -19, 59: -19, 72: -19, 76: -19, 78: -19, 92: -19, 96: -19, 114: -19, 116: -19, 117: -19, 118: -19, 143: -19, 154: -19, 156: -19, 157: -19, 160: -19, 161: -19, 162: -19, 174: -19, 175: -19, 180: -19, 181: -19, 184: -19, 185: -19, 186: -19, 187: -19, 188: -19, 189: -19, 190: -19, 191: -19, 192: -19, 193: -19, 194: -19, 195: -19, 196: -19, 197: -19 }, { 1: -20, 6: -20, 31: -20, 36: -20, 38: -20, 52: -20, 59: -20, 72: -20, 76: -20, 78: -20, 92: -20, 96: -20, 114: -20, 116: -20, 117: -20, 118: -20, 143: -20, 154: -20, 156: -20, 157: -20, 160: -20, 161: -20, 162: -20, 174: -20, 175: -20, 180: -20, 181: -20, 184: -20, 185: -20, 186: -20, 187: -20, 188: -20, 189: -20, 190: -20, 191: -20, 192: -20, 193: -20, 194: -20, 195: -20, 196: -20, 197: -20 }, { 1: -21, 6: -21, 31: -21, 36: -21, 38: -21, 52: -21, 59: -21, 72: -21, 76: -21, 78: -21, 92: -21, 96: -21, 114: -21, 116: -21, 117: -21, 118: -21, 143: -21, 154: -21, 156: -21, 157: -21, 160: -21, 161: -21, 162: -21, 174: -21, 175: -21, 180: -21, 181: -21, 184: -21, 185: -21, 186: -21, 187: -21, 188: -21, 189: -21, 190: -21, 191: -21, 192: -21, 193: -21, 194: -21, 195: -21, 196: -21, 197: -21 }, { 1: -22, 6: -22, 31: -22, 36: -22, 38: -22, 52: -22, 59: -22, 72: -22, 76: -22, 78: -22, 92: -22, 96: -22, 114: -22, 116: -22, 117: -22, 118: -22, 143: -22, 154: -22, 156: -22, 157: -22, 160: -22, 161: -22, 162: -22, 174: -22, 175: -22, 180: -22, 181: -22, 184: -22, 185: -22, 186: -22, 187: -22, 188: -22, 189: -22, 190: -22, 191: -22, 192: -22, 193: -22, 194: -22, 195: -22, 196: -22, 197: -22 }, { 1: -23, 6: -23, 31: -23, 36: -23, 38: -23, 52: -23, 59: -23, 72: -23, 76: -23, 78: -23, 92: -23, 96: -23, 114: -23, 116: -23, 117: -23, 118: -23, 143: -23, 154: -23, 156: -23, 157: -23, 160: -23, 161: -23, 162: -23, 174: -23, 175: -23, 180: -23, 181: -23, 184: -23, 185: -23, 186: -23, 187: -23, 188: -23, 189: -23, 190: -23, 191: -23, 192: -23, 193: -23, 194: -23, 195: -23, 196: -23, 197: -23 }, { 1: -24, 6: -24, 31: -24, 36: -24, 38: -24, 52: -24, 59: -24, 72: -24, 76: -24, 78: -24, 92: -24, 96: -24, 114: -24, 116: -24, 117: -24, 118: -24, 143: -24, 154: -24, 156: -24, 157: -24, 160: -24, 161: -24, 162: -24, 174: -24, 175: -24, 180: -24, 181: -24, 184: -24, 185: -24, 186: -24, 187: -24, 188: -24, 189: -24, 190: -24, 191: -24, 192: -24, 193: -24, 194: -24, 195: -24, 196: -24, 197: -24 }, { 1: -25, 6: -25, 31: -25, 36: -25, 38: -25, 52: -25, 59: -25, 72: -25, 76: -25, 78: -25, 92: -25, 96: -25, 114: -25, 116: -25, 117: -25, 118: -25, 143: -25, 154: -25, 156: -25, 157: -25, 160: -25, 161: -25, 162: -25, 174: -25, 175: -25, 180: -25, 181: -25, 184: -25, 185: -25, 186: -25, 187: -25, 188: -25, 189: -25, 190: -25, 191: -25, 192: -25, 193: -25, 194: -25, 195: -25, 196: -25, 197: -25 }, { 1: -28, 6: -28, 31: -28, 36: -28, 38: -28, 52: -28, 59: -28, 76: -28, 154: -28 }, { 1: -29, 6: -29, 31: -29, 36: -29, 38: -29, 52: -29, 59: -29, 76: -29, 154: -29 }, { 1: -9, 6: -9, 31: -9, 36: -9, 38: -9, 52: -9, 59: -9, 76: -9, 154: -9, 156: -9, 157: -9, 174: -9, 175: -9 }, { 1: -10, 6: -10, 31: -10, 36: -10, 38: -10, 52: -10, 59: -10, 76: -10, 154: -10, 156: -10, 157: -10, 174: -10, 175: -10 }, { 1: -11, 6: -11, 31: -11, 36: -11, 38: -11, 52: -11, 59: -11, 76: -11, 154: -11, 156: -11, 157: -11, 174: -11, 175: -11 }, { 1: -12, 6: -12, 31: -12, 36: -12, 38: -12, 52: -12, 59: -12, 76: -12, 154: -12, 156: -12, 157: -12, 174: -12, 175: -12 }, { 1: -154, 6: -154, 29: -154, 31: -154, 36: -154, 38: -154, 46: -154, 47: -154, 52: -154, 59: -154, 68: 136, 72: -154, 76: -154, 78: -154, 87: -154, 88: -154, 89: -154, 90: -154, 91: -154, 92: -154, 93: -154, 96: -154, 107: -154, 114: -154, 116: -154, 117: -154, 118: -154, 135: -154, 136: -154, 143: -154, 154: -154, 156: -154, 157: -154, 160: -154, 161: -154, 162: -154, 174: -154, 175: -154, 180: -154, 181: -154, 184: -154, 185: -154, 186: -154, 187: -154, 188: -154, 189: -154, 190: -154, 191: -154, 192: -154, 193: -154, 194: -154, 195: -154, 196: -154, 197: -154 }, { 1: -155, 6: -155, 29: -155, 31: -155, 36: -155, 38: -155, 46: -155, 47: -155, 52: -155, 59: -155, 72: -155, 76: -155, 78: -155, 87: -155, 88: -155, 89: -155, 90: -155, 91: -155, 92: -155, 93: -155, 96: -155, 107: -155, 114: -155, 116: -155, 117: -155, 118: -155, 135: -155, 136: -155, 143: -155, 154: -155, 156: -155, 157: -155, 160: -155, 161: -155, 162: -155, 174: -155, 175: -155, 180: -155, 181: -155, 184: -155, 185: -155, 186: -155, 187: -155, 188: -155, 189: -155, 190: -155, 191: -155, 192: -155, 193: -155, 194: -155, 195: -155, 196: -155, 197: -155 }, { 1: -156, 6: -156, 29: -156, 31: -156, 36: -156, 38: -156, 46: -156, 47: -156, 52: -156, 59: -156, 72: -156, 76: -156, 78: -156, 87: -156, 88: -156, 89: -156, 90: -156, 91: -156, 92: -156, 93: -156, 96: -156, 107: -156, 114: -156, 116: -156, 117: -156, 118: -156, 135: -156, 136: -156, 143: -156, 154: -156, 156: -156, 157: -156, 160: -156, 161: -156, 162: -156, 174: -156, 175: -156, 180: -156, 181: -156, 184: -156, 185: -156, 186: -156, 187: -156, 188: -156, 189: -156, 190: -156, 191: -156, 192: -156, 193: -156, 194: -156, 195: -156, 196: -156, 197: -156 }, { 1: -157, 6: -157, 29: -157, 31: -157, 36: -157, 38: -157, 46: -157, 47: -157, 52: -157, 59: -157, 72: -157, 76: -157, 78: -157, 87: -157, 88: -157, 89: -157, 90: -157, 91: -157, 92: -157, 93: -157, 96: -157, 107: -157, 114: -157, 116: -157, 117: -157, 118: -157, 135: -157, 136: -157, 143: -157, 154: -157, 156: -157, 157: -157, 160: -157, 161: -157, 162: -157, 174: -157, 175: -157, 180: -157, 181: -157, 184: -157, 185: -157, 186: -157, 187: -157, 188: -157, 189: -157, 190: -157, 191: -157, 192: -157, 193: -157, 194: -157, 195: -157, 196: -157, 197: -157 }, { 1: -158, 6: -158, 29: -158, 31: -158, 36: -158, 38: -158, 46: -158, 47: -158, 52: -158, 59: -158, 72: -158, 76: -158, 78: -158, 87: -158, 88: -158, 89: -158, 90: -158, 91: -158, 92: -158, 93: -158, 96: -158, 107: -158, 114: -158, 116: -158, 117: -158, 118: -158, 135: -158, 136: -158, 143: -158, 154: -158, 156: -158, 157: -158, 160: -158, 161: -158, 162: -158, 174: -158, 175: -158, 180: -158, 181: -158, 184: -158, 185: -158, 186: -158, 187: -158, 188: -158, 189: -158, 190: -158, 191: -158, 192: -158, 193: -158, 194: -158, 195: -158, 196: -158, 197: -158 }, { 1: -159, 6: -159, 29: -159, 31: -159, 36: -159, 38: -159, 46: -159, 47: -159, 52: -159, 59: -159, 72: -159, 76: -159, 78: -159, 87: -159, 88: -159, 89: -159, 90: -159, 91: -159, 92: -159, 93: -159, 96: -159, 107: -159, 114: -159, 116: -159, 117: -159, 118: -159, 135: -159, 136: -159, 143: -159, 154: -159, 156: -159, 157: -159, 160: -159, 161: -159, 162: -159, 174: -159, 175: -159, 180: -159, 181: -159, 184: -159, 185: -159, 186: -159, 187: -159, 188: -159, 189: -159, 190: -159, 191: -159, 192: -159, 193: -159, 194: -159, 195: -159, 196: -159, 197: -159 }, { 1: -160, 6: -160, 29: -160, 31: -160, 36: -160, 38: -160, 46: -160, 47: -160, 52: -160, 59: -160, 72: -160, 76: -160, 78: -160, 87: -160, 88: -160, 89: -160, 90: -160, 91: -160, 92: -160, 93: -160, 96: -160, 107: -160, 114: -160, 116: -160, 117: -160, 118: -160, 135: -160, 136: -160, 143: -160, 154: -160, 156: -160, 157: -160, 160: -160, 161: -160, 162: -160, 174: -160, 175: -160, 180: -160, 181: -160, 184: -160, 185: -160, 186: -160, 187: -160, 188: -160, 189: -160, 190: -160, 191: -160, 192: -160, 193: -160, 194: -160, 195: -160, 196: -160, 197: -160 }, { 1: -161, 6: -161, 29: -161, 31: -161, 36: -161, 38: -161, 46: -161, 47: -161, 52: -161, 59: -161, 72: -161, 76: -161, 78: -161, 87: -161, 88: -161, 89: -161, 90: -161, 91: -161, 92: -161, 93: -161, 96: -161, 107: -161, 114: -161, 116: -161, 117: -161, 118: -161, 135: -161, 136: -161, 143: -161, 154: -161, 156: -161, 157: -161, 160: -161, 161: -161, 162: -161, 174: -161, 175: -161, 180: -161, 181: -161, 184: -161, 185: -161, 186: -161, 187: -161, 188: -161, 189: -161, 190: -161, 191: -161, 192: -161, 193: -161, 194: -161, 195: -161, 196: -161, 197: -161 }, { 1: -162, 6: -162, 29: -162, 31: -162, 36: -162, 38: -162, 46: -162, 47: -162, 52: -162, 59: -162, 72: -162, 76: -162, 78: -162, 87: -162, 88: -162, 89: -162, 90: -162, 91: -162, 92: -162, 93: -162, 96: -162, 107: -162, 114: -162, 116: -162, 117: -162, 118: -162, 135: -162, 136: -162, 143: -162, 154: -162, 156: -162, 157: -162, 160: -162, 161: -162, 162: -162, 174: -162, 175: -162, 180: -162, 181: -162, 184: -162, 185: -162, 186: -162, 187: -162, 188: -162, 189: -162, 190: -162, 191: -162, 192: -162, 193: -162, 194: -162, 195: -162, 196: -162, 197: -162 }, { 6: -108, 28: 141, 30: 137, 31: -108, 36: -108, 37: 144, 38: -108, 40: 93, 59: -108, 74: 142, 75: 146, 77: 145, 78: 140, 96: -108, 101: 138, 102: 139, 103: 143, 113: 88 }, { 5: 148, 7: 4, 8: 5, 9: 6, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 32: 147, 33: 20, 34: 21, 35: 55, 36: 149, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 150, 8: 151, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 33: 20, 34: 21, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 153, 8: 154, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 33: 20, 34: 21, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 155, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 161, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 162, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 163, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 36: 164, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 14: 166, 15: 167, 28: 81, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 168, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 165, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 138: 75, 153: 71, 178: 160 }, { 14: 166, 15: 167, 28: 81, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 168, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 169, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 138: 75, 153: 71, 178: 160 }, { 1: -151, 6: -151, 29: -151, 31: -151, 36: -151, 38: -151, 46: -151, 47: -151, 52: -151, 59: -151, 68: -151, 72: -151, 76: -151, 78: -151, 87: -151, 88: -151, 89: -151, 90: -151, 91: -151, 92: -151, 93: -151, 96: -151, 107: -151, 114: -151, 116: -151, 117: -151, 118: -151, 135: -151, 136: -151, 143: -151, 154: -151, 156: -151, 157: -151, 160: -151, 161: -151, 162: -151, 174: -151, 175: -151, 180: -151, 181: -151, 182: 170, 183: 171, 184: -151, 185: -151, 186: -151, 187: -151, 188: -151, 189: -151, 190: -151, 191: -151, 192: -151, 193: -151, 194: -151, 195: -151, 196: -151, 197: -151, 198: 172 }, { 1: -339, 6: -339, 31: -339, 36: -339, 38: -339, 52: -339, 59: -339, 72: -339, 76: -339, 78: -339, 92: -339, 96: -339, 114: -339, 116: -339, 117: -339, 118: -339, 143: -339, 154: -339, 156: -339, 157: -339, 160: -339, 161: -339, 162: -339, 167: 173, 174: -339, 175: -339, 180: -339, 181: -339, 184: -339, 185: -339, 186: -339, 187: -339, 188: -339, 189: -339, 190: -339, 191: -339, 192: -339, 193: -339, 194: -339, 195: -339, 196: -339, 197: -339 }, { 1: -341, 6: -341, 31: -341, 36: -341, 38: -341, 52: -341, 59: -341, 72: -341, 76: -341, 78: -341, 92: -341, 96: -341, 114: -341, 116: -341, 117: -341, 118: -341, 143: -341, 154: -341, 156: -341, 157: -341, 160: -341, 161: -341, 162: -341, 174: -341, 175: -341, 180: -341, 181: -341, 184: -341, 185: -341, 186: -341, 187: -341, 188: -341, 189: -341, 190: -341, 191: -341, 192: -341, 193: -341, 194: -341, 195: -341, 196: -341, 197: -341 }, { 32: 174, 36: 149 }, { 32: 175, 36: 149 }, { 1: -290, 6: -290, 31: -290, 36: -290, 38: -290, 52: -290, 59: -290, 72: -290, 76: -290, 78: -290, 92: -290, 96: -290, 114: -290, 116: -290, 117: -290, 118: -290, 143: -290, 154: -290, 156: -290, 157: -290, 160: -290, 161: -290, 162: -290, 174: -290, 175: -290, 180: -290, 181: -290, 184: -290, 185: -290, 186: -290, 187: -290, 188: -290, 189: -290, 190: -290, 191: -290, 192: -290, 193: -290, 194: -290, 195: -290, 196: -290, 197: -290 }, { 28: 141, 37: 144, 40: 93, 74: 142, 75: 72, 77: 145, 102: 181, 103: 143, 108: 179, 113: 88, 115: 176, 119: 177, 163: 178, 164: 180 }, { 7: 182, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 36: 183, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -178, 6: -178, 14: 166, 15: 167, 28: 81, 31: -178, 32: 184, 36: 149, 37: 62, 38: -178, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 52: -178, 53: 65, 54: 91, 55: 92, 56: 30, 59: -178, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 168, 72: -178, 74: 82, 75: 72, 76: -178, 77: 76, 78: -178, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 92: -178, 95: 156, 96: -178, 97: 157, 98: 79, 99: 80, 103: 61, 105: 186, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: -178, 116: -178, 117: -178, 118: -178, 122: 185, 138: 75, 143: -178, 153: 71, 154: -178, 156: -178, 157: -178, 160: -178, 161: -178, 162: -178, 174: -178, 175: -178, 178: 160, 180: -178, 181: -178, 184: -178, 185: -178, 186: -178, 187: -178, 188: -178, 189: -178, 190: -178, 191: -178, 192: -178, 193: -178, 194: -178, 195: -178, 196: -178, 197: -178 }, { 7: 187, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 36: 188, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -30, 6: -30, 7: 189, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 31: -30, 35: 55, 36: 190, 37: 62, 38: -30, 39: 191, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 52: -30, 53: 65, 54: 91, 55: 92, 56: 30, 59: -30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 72: -30, 74: 82, 75: 72, 76: -30, 77: 76, 78: -30, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 92: -30, 94: 58, 95: 156, 96: -30, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: -30, 116: -30, 117: -30, 118: -30, 121: 53, 123: 59, 131: 60, 138: 75, 143: -30, 148: 48, 152: 54, 153: 71, 154: -30, 155: 49, 156: -30, 157: -30, 158: 50, 159: 87, 160: -30, 161: -30, 162: -30, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 174: -30, 175: -30, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44, 184: -30, 185: -30, 186: -30, 187: -30, 188: -30, 189: -30, 190: -30, 191: -30, 192: -30, 193: -30, 194: -30, 195: -30, 196: -30, 197: -30 }, { 28: 192, 40: 93 }, { 15: 194, 33: 193, 95: 35, 97: 36, 98: 79, 99: 80 }, { 1: -99, 6: -99, 7: 195, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 31: -99, 35: 55, 36: 196, 37: 62, 38: -99, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 52: -99, 53: 65, 54: 91, 55: 92, 56: 30, 59: -99, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 76: -99, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 154: -99, 155: 49, 156: -99, 157: -99, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 174: -99, 175: -99, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 28: 201, 40: 93, 45: 197, 46: 94, 47: 95, 113: 200, 124: 198, 125: 199, 130: 202 }, { 23: 204, 26: 205, 27: 56, 28: 206, 40: 93, 113: 203, 121: 53, 129: 207, 133: 208 }, { 1: -152, 6: -152, 29: -152, 31: -152, 36: -152, 38: -152, 46: -152, 47: -152, 52: -152, 59: -152, 68: -152, 72: -152, 76: -152, 78: -152, 87: -152, 88: -152, 89: -152, 90: -152, 91: -152, 92: -152, 93: -152, 96: -152, 107: -152, 114: -152, 116: -152, 117: -152, 118: -152, 135: -152, 136: -152, 143: -152, 154: -152, 156: -152, 157: -152, 160: -152, 161: -152, 162: -152, 174: -152, 175: -152, 180: -152, 181: -152, 184: -152, 185: -152, 186: -152, 187: -152, 188: -152, 189: -152, 190: -152, 191: -152, 192: -152, 193: -152, 194: -152, 195: -152, 196: -152, 197: -152 }, { 1: -153, 6: -153, 29: -153, 31: -153, 36: -153, 38: -153, 46: -153, 47: -153, 52: -153, 59: -153, 68: -153, 72: -153, 76: -153, 78: -153, 87: -153, 88: -153, 89: -153, 90: -153, 91: -153, 92: -153, 93: -153, 96: -153, 107: -153, 114: -153, 116: -153, 117: -153, 118: -153, 135: -153, 136: -153, 143: -153, 154: -153, 156: -153, 157: -153, 160: -153, 161: -153, 162: -153, 174: -153, 175: -153, 180: -153, 181: -153, 184: -153, 185: -153, 186: -153, 187: -153, 188: -153, 189: -153, 190: -153, 191: -153, 192: -153, 193: -153, 194: -153, 195: -153, 196: -153, 197: -153 }, { 1: -52, 6: -52, 29: -52, 31: -52, 36: -52, 38: -52, 46: -52, 47: -52, 52: -52, 59: -52, 72: -52, 76: -52, 78: -52, 87: -52, 88: -52, 89: -52, 90: -52, 91: -52, 92: -52, 93: -52, 96: -52, 107: -52, 114: -52, 116: -52, 117: -52, 118: -52, 135: -52, 136: -52, 143: -52, 154: -52, 156: -52, 157: -52, 160: -52, 161: -52, 162: -52, 174: -52, 175: -52, 180: -52, 181: -52, 184: -52, 185: -52, 186: -52, 187: -52, 188: -52, 189: -52, 190: -52, 191: -52, 192: -52, 193: -52, 194: -52, 195: -52, 196: -52, 197: -52 }, { 1: -53, 6: -53, 29: -53, 31: -53, 36: -53, 38: -53, 46: -53, 47: -53, 52: -53, 59: -53, 72: -53, 76: -53, 78: -53, 87: -53, 88: -53, 89: -53, 90: -53, 91: -53, 92: -53, 93: -53, 96: -53, 107: -53, 114: -53, 116: -53, 117: -53, 118: -53, 135: -53, 136: -53, 143: -53, 154: -53, 156: -53, 157: -53, 160: -53, 161: -53, 162: -53, 174: -53, 175: -53, 180: -53, 181: -53, 184: -53, 185: -53, 186: -53, 187: -53, 188: -53, 189: -53, 190: -53, 191: -53, 192: -53, 193: -53, 194: -53, 195: -53, 196: -53, 197: -53 }, { 1: -54, 6: -54, 29: -54, 31: -54, 36: -54, 38: -54, 46: -54, 47: -54, 52: -54, 59: -54, 72: -54, 76: -54, 78: -54, 87: -54, 88: -54, 89: -54, 90: -54, 91: -54, 92: -54, 93: -54, 96: -54, 107: -54, 114: -54, 116: -54, 117: -54, 118: -54, 135: -54, 136: -54, 143: -54, 154: -54, 156: -54, 157: -54, 160: -54, 161: -54, 162: -54, 174: -54, 175: -54, 180: -54, 181: -54, 184: -54, 185: -54, 186: -54, 187: -54, 188: -54, 189: -54, 190: -54, 191: -54, 192: -54, 193: -54, 194: -54, 195: -54, 196: -54, 197: -54 }, { 1: -55, 6: -55, 29: -55, 31: -55, 36: -55, 38: -55, 46: -55, 47: -55, 52: -55, 59: -55, 72: -55, 76: -55, 78: -55, 87: -55, 88: -55, 89: -55, 90: -55, 91: -55, 92: -55, 93: -55, 96: -55, 107: -55, 114: -55, 116: -55, 117: -55, 118: -55, 135: -55, 136: -55, 143: -55, 154: -55, 156: -55, 157: -55, 160: -55, 161: -55, 162: -55, 174: -55, 175: -55, 180: -55, 181: -55, 184: -55, 185: -55, 186: -55, 187: -55, 188: -55, 189: -55, 190: -55, 191: -55, 192: -55, 193: -55, 194: -55, 195: -55, 196: -55, 197: -55 }, { 1: -56, 6: -56, 29: -56, 31: -56, 36: -56, 38: -56, 46: -56, 47: -56, 52: -56, 59: -56, 72: -56, 76: -56, 78: -56, 87: -56, 88: -56, 89: -56, 90: -56, 91: -56, 92: -56, 93: -56, 96: -56, 107: -56, 114: -56, 116: -56, 117: -56, 118: -56, 135: -56, 136: -56, 143: -56, 154: -56, 156: -56, 157: -56, 160: -56, 161: -56, 162: -56, 174: -56, 175: -56, 180: -56, 181: -56, 184: -56, 185: -56, 186: -56, 187: -56, 188: -56, 189: -56, 190: -56, 191: -56, 192: -56, 193: -56, 194: -56, 195: -56, 196: -56, 197: -56 }, { 1: -57, 6: -57, 29: -57, 31: -57, 36: -57, 38: -57, 46: -57, 47: -57, 52: -57, 59: -57, 72: -57, 76: -57, 78: -57, 87: -57, 88: -57, 89: -57, 90: -57, 91: -57, 92: -57, 93: -57, 96: -57, 107: -57, 114: -57, 116: -57, 117: -57, 118: -57, 135: -57, 136: -57, 143: -57, 154: -57, 156: -57, 157: -57, 160: -57, 161: -57, 162: -57, 174: -57, 175: -57, 180: -57, 181: -57, 184: -57, 185: -57, 186: -57, 187: -57, 188: -57, 189: -57, 190: -57, 191: -57, 192: -57, 193: -57, 194: -57, 195: -57, 196: -57, 197: -57 }, { 1: -58, 6: -58, 29: -58, 31: -58, 36: -58, 38: -58, 46: -58, 47: -58, 52: -58, 59: -58, 72: -58, 76: -58, 78: -58, 87: -58, 88: -58, 89: -58, 90: -58, 91: -58, 92: -58, 93: -58, 96: -58, 107: -58, 114: -58, 116: -58, 117: -58, 118: -58, 135: -58, 136: -58, 143: -58, 154: -58, 156: -58, 157: -58, 160: -58, 161: -58, 162: -58, 174: -58, 175: -58, 180: -58, 181: -58, 184: -58, 185: -58, 186: -58, 187: -58, 188: -58, 189: -58, 190: -58, 191: -58, 192: -58, 193: -58, 194: -58, 195: -58, 196: -58, 197: -58 }, { 1: -59, 6: -59, 29: -59, 31: -59, 36: -59, 38: -59, 46: -59, 47: -59, 52: -59, 59: -59, 72: -59, 76: -59, 78: -59, 87: -59, 88: -59, 89: -59, 90: -59, 91: -59, 92: -59, 93: -59, 96: -59, 107: -59, 114: -59, 116: -59, 117: -59, 118: -59, 135: -59, 136: -59, 143: -59, 154: -59, 156: -59, 157: -59, 160: -59, 161: -59, 162: -59, 174: -59, 175: -59, 180: -59, 181: -59, 184: -59, 185: -59, 186: -59, 187: -59, 188: -59, 189: -59, 190: -59, 191: -59, 192: -59, 193: -59, 194: -59, 195: -59, 196: -59, 197: -59 }, { 4: 209, 5: 3, 7: 4, 8: 5, 9: 6, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 33: 20, 34: 21, 35: 55, 36: 210, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 211, 8: 220, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 33: 20, 34: 21, 35: 55, 36: 217, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 59: 218, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 76: 212, 77: 76, 78: 222, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 104: 221, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 139: 213, 140: 214, 144: 219, 145: 216, 146: 215, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 29: 226, 85: 223, 87: 224, 91: 225 }, { 29: 226, 85: 227 }, { 1: -235, 6: -235, 29: -235, 31: -235, 36: -235, 38: -235, 46: -235, 47: -235, 52: -235, 59: -235, 72: -235, 76: -235, 78: -235, 87: -235, 88: -235, 89: -235, 90: -235, 91: -235, 92: -235, 93: -235, 96: -235, 107: -235, 114: -235, 116: -235, 117: -235, 118: -235, 135: -235, 136: -235, 143: -235, 154: -235, 156: -235, 157: -235, 160: -235, 161: -235, 162: -235, 174: -235, 175: -235, 180: -235, 181: -235, 184: -235, 185: -235, 186: -235, 187: -235, 188: -235, 189: -235, 190: -235, 191: -235, 192: -235, 193: -235, 194: -235, 195: -235, 196: -235, 197: -235 }, { 1: -236, 6: -236, 29: -236, 31: -236, 36: -236, 38: -236, 41: 228, 42: 229, 46: -236, 47: -236, 52: -236, 59: -236, 72: -236, 76: -236, 78: -236, 87: -236, 88: -236, 89: -236, 90: -236, 91: -236, 92: -236, 93: -236, 96: -236, 107: -236, 114: -236, 116: -236, 117: -236, 118: -236, 135: -236, 136: -236, 143: -236, 154: -236, 156: -236, 157: -236, 160: -236, 161: -236, 162: -236, 174: -236, 175: -236, 180: -236, 181: -236, 184: -236, 185: -236, 186: -236, 187: -236, 188: -236, 189: -236, 190: -236, 191: -236, 192: -236, 193: -236, 194: -236, 195: -236, 196: -236, 197: -236 }, { 87: 230 }, { 87: 231 }, { 11: -104, 27: -104, 35: -104, 36: -104, 40: -104, 44: -104, 46: -104, 47: -104, 54: -104, 55: -104, 61: -104, 62: -104, 63: -104, 64: -104, 65: -104, 66: -104, 75: -104, 77: -104, 83: -104, 86: -104, 94: -104, 95: -104, 98: -104, 99: -104, 111: -104, 112: -104, 113: -104, 114: -104, 121: -104, 123: -104, 131: -104, 138: -104, 148: -104, 152: -104, 153: -104, 156: -104, 157: -104, 159: -104, 163: -104, 165: -104, 171: -104, 173: -104, 176: -104, 177: -104, 178: -104, 179: -104, 180: -104, 181: -104, 182: -104, 183: -104 }, { 11: -105, 27: -105, 35: -105, 36: -105, 40: -105, 44: -105, 46: -105, 47: -105, 54: -105, 55: -105, 61: -105, 62: -105, 63: -105, 64: -105, 65: -105, 66: -105, 75: -105, 77: -105, 83: -105, 86: -105, 94: -105, 95: -105, 98: -105, 99: -105, 111: -105, 112: -105, 113: -105, 114: -105, 121: -105, 123: -105, 131: -105, 138: -105, 148: -105, 152: -105, 153: -105, 156: -105, 157: -105, 159: -105, 163: -105, 165: -105, 171: -105, 173: -105, 176: -105, 177: -105, 178: -105, 179: -105, 180: -105, 181: -105, 182: -105, 183: -105 }, { 1: -122, 6: -122, 29: -122, 31: -122, 36: -122, 38: -122, 46: -122, 47: -122, 52: -122, 59: -122, 68: -122, 72: -122, 76: -122, 78: -122, 87: -122, 88: -122, 89: -122, 90: -122, 91: -122, 92: -122, 93: -122, 96: -122, 107: -122, 114: -122, 116: -122, 117: -122, 118: -122, 122: -122, 135: -122, 136: -122, 143: -122, 154: -122, 156: -122, 157: -122, 160: -122, 161: -122, 162: -122, 174: -122, 175: -122, 180: -122, 181: -122, 182: -122, 183: -122, 184: -122, 185: -122, 186: -122, 187: -122, 188: -122, 189: -122, 190: -122, 191: -122, 192: -122, 193: -122, 194: -122, 195: -122, 196: -122, 197: -122, 198: -122 }, { 1: -123, 6: -123, 29: -123, 31: -123, 36: -123, 38: -123, 46: -123, 47: -123, 52: -123, 59: -123, 68: -123, 72: -123, 76: -123, 78: -123, 87: -123, 88: -123, 89: -123, 90: -123, 91: -123, 92: -123, 93: -123, 96: -123, 107: -123, 114: -123, 116: -123, 117: -123, 118: -123, 122: -123, 135: -123, 136: -123, 143: -123, 154: -123, 156: -123, 157: -123, 160: -123, 161: -123, 162: -123, 174: -123, 175: -123, 180: -123, 181: -123, 182: -123, 183: -123, 184: -123, 185: -123, 186: -123, 187: -123, 188: -123, 189: -123, 190: -123, 191: -123, 192: -123, 193: -123, 194: -123, 195: -123, 196: -123, 197: -123, 198: -123 }, { 7: 232, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 233, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 234, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 235, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 237, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 32: 236, 35: 55, 36: 149, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 6: -173, 28: 245, 36: -173, 38: -173, 40: 93, 41: 246, 42: 229, 43: 243, 44: 89, 45: 90, 46: 94, 47: 95, 59: -173, 69: 244, 70: 238, 71: 248, 73: 240, 74: 247, 75: 241, 77: 242, 78: 249, 117: -173, 120: 239 }, { 1: -38, 6: -38, 29: -38, 31: -38, 36: -38, 38: -38, 46: -38, 47: -38, 52: -38, 59: -38, 72: -38, 76: -38, 78: -38, 87: -38, 88: -38, 89: -38, 90: -38, 91: -38, 92: -38, 93: -38, 96: -38, 107: -38, 114: -38, 116: -38, 117: -38, 118: -38, 135: -38, 136: -38, 143: -38, 154: -38, 156: -38, 157: -38, 160: -38, 161: -38, 162: -38, 174: -38, 175: -38, 180: -38, 181: -38, 184: -38, 185: -38, 186: -38, 187: -38, 188: -38, 189: -38, 190: -38, 191: -38, 192: -38, 193: -38, 194: -38, 195: -38, 196: -38, 197: -38 }, { 1: -39, 6: -39, 29: -39, 31: -39, 36: -39, 38: -39, 46: -39, 47: -39, 52: -39, 59: -39, 72: -39, 76: -39, 78: -39, 87: -39, 88: -39, 89: -39, 90: -39, 91: -39, 92: -39, 93: -39, 96: -39, 107: -39, 114: -39, 116: -39, 117: -39, 118: -39, 135: -39, 136: -39, 143: -39, 154: -39, 156: -39, 157: -39, 160: -39, 161: -39, 162: -39, 174: -39, 175: -39, 180: -39, 181: -39, 184: -39, 185: -39, 186: -39, 187: -39, 188: -39, 189: -39, 190: -39, 191: -39, 192: -39, 193: -39, 194: -39, 195: -39, 196: -39, 197: -39 }, { 1: -48, 6: -48, 29: -48, 31: -48, 36: -48, 38: -48, 46: -48, 47: -48, 52: -48, 59: -48, 72: -48, 76: -48, 78: -48, 87: -48, 88: -48, 89: -48, 90: -48, 91: -48, 92: -48, 93: -48, 96: -48, 107: -48, 114: -48, 116: -48, 117: -48, 118: -48, 135: -48, 136: -48, 143: -48, 154: -48, 156: -48, 157: -48, 160: -48, 161: -48, 162: -48, 174: -48, 175: -48, 180: -48, 181: -48, 184: -48, 185: -48, 186: -48, 187: -48, 188: -48, 189: -48, 190: -48, 191: -48, 192: -48, 193: -48, 194: -48, 195: -48, 196: -48, 197: -48 }, { 14: 166, 15: 167, 28: 81, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 250, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 168, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 251, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 138: 75, 153: 71, 178: 160 }, { 1: -36, 6: -36, 29: -36, 31: -36, 36: -36, 38: -36, 39: -36, 46: -36, 47: -36, 52: -36, 59: -36, 68: -36, 72: -36, 76: -36, 78: -36, 87: -36, 88: -36, 89: -36, 90: -36, 91: -36, 92: -36, 93: -36, 96: -36, 107: -36, 114: -36, 116: -36, 117: -36, 118: -36, 122: -36, 128: -36, 135: -36, 136: -36, 143: -36, 154: -36, 156: -36, 157: -36, 160: -36, 161: -36, 162: -36, 174: -36, 175: -36, 180: -36, 181: -36, 182: -36, 183: -36, 184: -36, 185: -36, 186: -36, 187: -36, 188: -36, 189: -36, 190: -36, 191: -36, 192: -36, 193: -36, 194: -36, 195: -36, 196: -36, 197: -36, 198: -36 }, { 1: -40, 6: -40, 29: -40, 31: -40, 36: -40, 38: -40, 46: -40, 47: -40, 49: -40, 51: -40, 52: -40, 57: -40, 59: -40, 72: -40, 76: -40, 78: -40, 87: -40, 88: -40, 89: -40, 90: -40, 91: -40, 92: -40, 93: -40, 96: -40, 107: -40, 114: -40, 116: -40, 117: -40, 118: -40, 135: -40, 136: -40, 143: -40, 154: -40, 156: -40, 157: -40, 160: -40, 161: -40, 162: -40, 174: -40, 175: -40, 180: -40, 181: -40, 184: -40, 185: -40, 186: -40, 187: -40, 188: -40, 189: -40, 190: -40, 191: -40, 192: -40, 193: -40, 194: -40, 195: -40, 196: -40, 197: -40 }, { 45: 255, 46: 94, 47: 95, 48: 252, 50: 253, 51: 254 }, { 1: -5, 5: 256, 6: -5, 7: 4, 8: 5, 9: 6, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 33: 20, 34: 21, 35: 55, 37: 62, 38: -5, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 52: -5, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 154: -5, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -360, 6: -360, 31: -360, 36: -360, 38: -360, 52: -360, 59: -360, 72: -360, 76: -360, 78: -360, 92: -360, 96: -360, 114: -360, 116: -360, 117: -360, 118: -360, 143: -360, 154: -360, 156: -360, 157: -360, 160: -360, 161: -360, 162: -360, 174: -360, 175: -360, 180: -360, 181: -360, 184: -360, 185: -360, 186: -360, 187: -360, 188: -360, 189: -360, 190: -360, 191: -360, 192: -360, 193: -360, 194: -360, 195: -360, 196: -360, 197: -360 }, { 7: 257, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 258, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 259, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 260, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 261, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 262, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 263, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 264, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 265, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 266, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 267, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 268, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 269, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 270, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 271, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 272, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 273, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -289, 6: -289, 31: -289, 36: -289, 38: -289, 52: -289, 59: -289, 72: -289, 76: -289, 78: -289, 92: -289, 96: -289, 114: -289, 116: -289, 117: -289, 118: -289, 143: -289, 154: -289, 156: -289, 157: -289, 160: -289, 161: -289, 162: -289, 174: -289, 175: -289, 180: -289, 181: -289, 184: -289, 185: -289, 186: -289, 187: -289, 188: -289, 189: -289, 190: -289, 191: -289, 192: -289, 193: -289, 194: -289, 195: -289, 196: -289, 197: -289 }, { 28: 141, 37: 144, 40: 93, 74: 142, 75: 72, 77: 145, 102: 181, 103: 143, 108: 277, 113: 88, 115: 274, 119: 275, 163: 276, 164: 180 }, { 7: 278, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 279, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -288, 6: -288, 31: -288, 36: -288, 38: -288, 52: -288, 59: -288, 72: -288, 76: -288, 78: -288, 92: -288, 96: -288, 114: -288, 116: -288, 117: -288, 118: -288, 143: -288, 154: -288, 156: -288, 157: -288, 160: -288, 161: -288, 162: -288, 174: -288, 175: -288, 180: -288, 181: -288, 184: -288, 185: -288, 186: -288, 187: -288, 188: -288, 189: -288, 190: -288, 191: -288, 192: -288, 193: -288, 194: -288, 195: -288, 196: -288, 197: -288 }, { 29: 226, 45: 280, 46: 94, 47: 95, 85: 281 }, { 29: 226, 85: 282 }, { 41: 283, 42: 229 }, { 41: 284, 42: 229 }, { 1: -128, 6: -128, 29: -128, 31: -128, 36: -128, 38: -128, 41: 285, 42: 229, 46: -128, 47: -128, 52: -128, 59: -128, 68: -128, 72: -128, 76: -128, 78: -128, 87: -128, 88: -128, 89: -128, 90: -128, 91: -128, 92: -128, 93: -128, 96: -128, 107: -128, 114: -128, 116: -128, 117: -128, 118: -128, 122: -128, 135: -128, 136: -128, 143: -128, 154: -128, 156: -128, 157: -128, 160: -128, 161: -128, 162: -128, 174: -128, 175: -128, 180: -128, 181: -128, 182: -128, 183: -128, 184: -128, 185: -128, 186: -128, 187: -128, 188: -128, 189: -128, 190: -128, 191: -128, 192: -128, 193: -128, 194: -128, 195: -128, 196: -128, 197: -128, 198: -128 }, { 1: -129, 6: -129, 29: -129, 31: -129, 36: -129, 38: -129, 41: 286, 42: 229, 46: -129, 47: -129, 52: -129, 59: -129, 68: -129, 72: -129, 76: -129, 78: -129, 87: -129, 88: -129, 89: -129, 90: -129, 91: -129, 92: -129, 93: -129, 96: -129, 107: -129, 114: -129, 116: -129, 117: -129, 118: -129, 122: -129, 135: -129, 136: -129, 143: -129, 154: -129, 156: -129, 157: -129, 160: -129, 161: -129, 162: -129, 174: -129, 175: -129, 180: -129, 181: -129, 182: -129, 183: -129, 184: -129, 185: -129, 186: -129, 187: -129, 188: -129, 189: -129, 190: -129, 191: -129, 192: -129, 193: -129, 194: -129, 195: -129, 196: -129, 197: -129, 198: -129 }, { 7: 287, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 36: 288, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 292, 54: 91, 55: 92, 56: 30, 58: 290, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 78: 294, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 106: 289, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 142: 291, 143: 293, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 91: 295 }, { 91: 296 }, { 29: -232, 46: -232, 47: -232 }, { 41: 297, 42: 229 }, { 41: 298, 42: 229 }, { 1: -145, 6: -145, 29: -145, 31: -145, 36: -145, 38: -145, 41: 299, 42: 229, 46: -145, 47: -145, 52: -145, 59: -145, 68: -145, 72: -145, 76: -145, 78: -145, 87: -145, 88: -145, 89: -145, 90: -145, 91: -145, 92: -145, 93: -145, 96: -145, 107: -145, 114: -145, 116: -145, 117: -145, 118: -145, 122: -145, 135: -145, 136: -145, 143: -145, 154: -145, 156: -145, 157: -145, 160: -145, 161: -145, 162: -145, 174: -145, 175: -145, 180: -145, 181: -145, 182: -145, 183: -145, 184: -145, 185: -145, 186: -145, 187: -145, 188: -145, 189: -145, 190: -145, 191: -145, 192: -145, 193: -145, 194: -145, 195: -145, 196: -145, 197: -145, 198: -145 }, { 1: -146, 6: -146, 29: -146, 31: -146, 36: -146, 38: -146, 41: 300, 42: 229, 46: -146, 47: -146, 52: -146, 59: -146, 68: -146, 72: -146, 76: -146, 78: -146, 87: -146, 88: -146, 89: -146, 90: -146, 91: -146, 92: -146, 93: -146, 96: -146, 107: -146, 114: -146, 116: -146, 117: -146, 118: -146, 122: -146, 135: -146, 136: -146, 143: -146, 154: -146, 156: -146, 157: -146, 160: -146, 161: -146, 162: -146, 174: -146, 175: -146, 180: -146, 181: -146, 182: -146, 183: -146, 184: -146, 185: -146, 186: -146, 187: -146, 188: -146, 189: -146, 190: -146, 191: -146, 192: -146, 193: -146, 194: -146, 195: -146, 196: -146, 197: -146, 198: -146 }, { 7: 301, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 36: 302, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 91: 303 }, { 6: 305, 7: 304, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 36: 306, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 6: -106, 31: -106, 36: -106, 38: -106, 59: 308, 76: -106, 96: 307, 100: 309, 117: -106 }, { 6: -109, 31: -109, 36: -109, 38: -109, 59: -109, 96: -109 }, { 6: -113, 31: -113, 36: -113, 38: -113, 59: -113, 68: 310, 96: -113 }, { 6: -116, 28: 141, 31: -116, 36: -116, 37: 144, 38: -116, 40: 93, 59: -116, 74: 142, 75: 146, 77: 145, 96: -116, 102: 311, 103: 143, 113: 88 }, { 6: -117, 31: -117, 36: -117, 38: -117, 59: -117, 68: -117, 96: -117, 116: -117, 160: -117, 162: -117 }, { 6: -118, 31: -118, 36: -118, 38: -118, 59: -118, 68: -118, 96: -118, 116: -118, 160: -118, 162: -118 }, { 6: -119, 31: -119, 36: -119, 38: -119, 59: -119, 68: -119, 96: -119, 116: -119, 160: -119, 162: -119 }, { 6: -120, 31: -120, 36: -120, 38: -120, 59: -120, 68: -120, 96: -120, 116: -120, 160: -120, 162: -120 }, { 41: 228, 42: 229 }, { 7: 312, 8: 220, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 33: 20, 34: 21, 35: 55, 36: 217, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 59: 218, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 76: 212, 77: 76, 78: 222, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 104: 221, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 139: 213, 140: 214, 144: 219, 145: 216, 146: 215, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -101, 6: -101, 29: -101, 31: -101, 36: -101, 38: -101, 46: -101, 47: -101, 52: -101, 59: -101, 72: -101, 76: -101, 78: -101, 87: -101, 88: -101, 89: -101, 90: -101, 91: -101, 92: -101, 93: -101, 96: -101, 107: -101, 114: -101, 116: -101, 117: -101, 118: -101, 135: -101, 136: -101, 143: -101, 154: -101, 156: -101, 157: -101, 160: -101, 161: -101, 162: -101, 174: -101, 175: -101, 180: -101, 181: -101, 184: -101, 185: -101, 186: -101, 187: -101, 188: -101, 189: -101, 190: -101, 191: -101, 192: -101, 193: -101, 194: -101, 195: -101, 196: -101, 197: -101 }, { 1: -103, 6: -103, 31: -103, 36: -103, 38: -103, 52: -103, 59: -103, 76: -103, 154: -103 }, { 4: 314, 5: 3, 7: 4, 8: 5, 9: 6, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 33: 20, 34: 21, 35: 55, 37: 62, 38: 313, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -349, 6: -349, 31: -349, 36: -349, 38: -349, 52: -349, 59: -349, 72: -349, 76: -349, 78: -349, 92: -349, 96: -349, 114: -349, 116: -349, 117: -349, 118: -349, 143: -349, 154: -349, 155: 115, 156: -349, 157: -349, 160: -349, 161: -349, 162: -349, 174: -349, 175: 114, 180: -349, 181: -349, 184: 97, 185: -349, 186: -349, 187: -349, 188: -349, 189: -349, 190: -349, 191: -349, 192: -349, 193: -349, 194: 109, 195: 110, 196: -349, 197: -349 }, { 1: -346, 6: -346, 31: -346, 36: -346, 38: -346, 52: -346, 59: -346, 76: -346, 154: -346 }, { 155: 119, 156: 85, 157: 86, 174: 117, 175: 118 }, { 1: -350, 6: -350, 31: -350, 36: -350, 38: -350, 52: -350, 59: -350, 72: -350, 76: -350, 78: -350, 92: -350, 96: -350, 114: -350, 116: -350, 117: -350, 118: -350, 143: -350, 154: -350, 155: 115, 156: -350, 157: -350, 160: -350, 161: -350, 162: -350, 174: -350, 175: 114, 180: -350, 181: -350, 184: 97, 185: -350, 186: -350, 187: -350, 188: -350, 189: -350, 190: -350, 191: -350, 192: -350, 193: -350, 194: 109, 195: 110, 196: -350, 197: -350 }, { 1: -347, 6: -347, 31: -347, 36: -347, 38: -347, 52: -347, 59: -347, 76: -347, 154: -347 }, { 1: -351, 6: -351, 31: -351, 36: -351, 38: -351, 52: -351, 59: -351, 72: -351, 76: -351, 78: -351, 92: -351, 96: -351, 114: -351, 116: -351, 117: -351, 118: -351, 143: -351, 154: -351, 155: 115, 156: -351, 157: -351, 160: -351, 161: -351, 162: -351, 174: -351, 175: 114, 180: -351, 181: -351, 184: 97, 185: -351, 186: 101, 187: -351, 188: -351, 189: -351, 190: -351, 191: -351, 192: -351, 193: -351, 194: 109, 195: 110, 196: -351, 197: -351 }, { 6: -108, 28: 141, 30: 315, 31: -108, 36: -108, 37: 144, 38: -108, 40: 93, 59: -108, 74: 142, 75: 146, 77: 145, 78: 140, 96: -108, 101: 138, 102: 139, 103: 143, 113: 88 }, { 32: 147, 36: 149 }, { 7: 150, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 153, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 15: 194, 95: 156, 97: 157, 98: 79, 99: 80 }, { 1: -352, 6: -352, 31: -352, 36: -352, 38: -352, 52: -352, 59: -352, 72: -352, 76: -352, 78: -352, 92: -352, 96: -352, 114: -352, 116: -352, 117: -352, 118: -352, 143: -352, 154: -352, 155: 115, 156: -352, 157: -352, 160: -352, 161: -352, 162: -352, 174: -352, 175: 114, 180: -352, 181: -352, 184: 97, 185: -352, 186: 101, 187: -352, 188: -352, 189: -352, 190: -352, 191: -352, 192: -352, 193: -352, 194: 109, 195: 110, 196: -352, 197: -352 }, { 1: -353, 6: -353, 31: -353, 36: -353, 38: -353, 52: -353, 59: -353, 72: -353, 76: -353, 78: -353, 92: -353, 96: -353, 114: -353, 116: -353, 117: -353, 118: -353, 143: -353, 154: -353, 155: 115, 156: -353, 157: -353, 160: -353, 161: -353, 162: -353, 174: -353, 175: 114, 180: -353, 181: -353, 184: 97, 185: -353, 186: 101, 187: -353, 188: -353, 189: -353, 190: -353, 191: -353, 192: -353, 193: -353, 194: 109, 195: 110, 196: -353, 197: -353 }, { 1: -354, 6: -354, 31: -354, 36: -354, 38: -354, 52: -354, 59: -354, 72: -354, 76: -354, 78: -354, 92: -354, 96: -354, 114: -354, 116: -354, 117: -354, 118: -354, 143: -354, 154: -354, 155: 115, 156: -354, 157: -354, 160: -354, 161: -354, 162: -354, 174: -354, 175: 114, 180: -354, 181: -354, 184: 97, 185: -354, 186: -354, 187: -354, 188: -354, 189: -354, 190: -354, 191: -354, 192: -354, 193: -354, 194: 109, 195: 110, 196: -354, 197: -354 }, { 37: 316, 113: 88 }, { 1: -356, 6: -356, 29: -151, 31: -356, 36: -356, 38: -356, 46: -151, 47: -151, 52: -356, 59: -356, 68: -151, 72: -356, 76: -356, 78: -356, 87: -151, 88: -151, 89: -151, 90: -151, 91: -151, 92: -356, 93: -151, 96: -356, 107: -151, 114: -356, 116: -356, 117: -356, 118: -356, 135: -151, 136: -151, 143: -356, 154: -356, 156: -356, 157: -356, 160: -356, 161: -356, 162: -356, 174: -356, 175: -356, 180: -356, 181: -356, 184: -356, 185: -356, 186: -356, 187: -356, 188: -356, 189: -356, 190: -356, 191: -356, 192: -356, 193: -356, 194: -356, 195: -356, 196: -356, 197: -356 }, { 29: -231, 46: -231, 47: -231, 84: 120, 87: 122, 88: 123, 89: 124, 90: 125, 91: 126, 93: 127, 107: 128, 135: 121, 136: 129 }, { 87: 130, 88: 131, 89: 132, 90: 133, 91: 134, 93: 135 }, { 1: -154, 6: -154, 29: -154, 31: -154, 36: -154, 38: -154, 46: -154, 47: -154, 52: -154, 59: -154, 72: -154, 76: -154, 78: -154, 87: -154, 88: -154, 89: -154, 90: -154, 91: -154, 92: -154, 93: -154, 96: -154, 107: -154, 114: -154, 116: -154, 117: -154, 118: -154, 135: -154, 136: -154, 143: -154, 154: -154, 156: -154, 157: -154, 160: -154, 161: -154, 162: -154, 174: -154, 175: -154, 180: -154, 181: -154, 184: -154, 185: -154, 186: -154, 187: -154, 188: -154, 189: -154, 190: -154, 191: -154, 192: -154, 193: -154, 194: -154, 195: -154, 196: -154, 197: -154 }, { 1: -357, 6: -357, 29: -151, 31: -357, 36: -357, 38: -357, 46: -151, 47: -151, 52: -357, 59: -357, 68: -151, 72: -357, 76: -357, 78: -357, 87: -151, 88: -151, 89: -151, 90: -151, 91: -151, 92: -357, 93: -151, 96: -357, 107: -151, 114: -357, 116: -357, 117: -357, 118: -357, 135: -151, 136: -151, 143: -357, 154: -357, 156: -357, 157: -357, 160: -357, 161: -357, 162: -357, 174: -357, 175: -357, 180: -357, 181: -357, 184: -357, 185: -357, 186: -357, 187: -357, 188: -357, 189: -357, 190: -357, 191: -357, 192: -357, 193: -357, 194: -357, 195: -357, 196: -357, 197: -357 }, { 1: -358, 6: -358, 31: -358, 36: -358, 38: -358, 52: -358, 59: -358, 72: -358, 76: -358, 78: -358, 92: -358, 96: -358, 114: -358, 116: -358, 117: -358, 118: -358, 143: -358, 154: -358, 156: -358, 157: -358, 160: -358, 161: -358, 162: -358, 174: -358, 175: -358, 180: -358, 181: -358, 184: -358, 185: -358, 186: -358, 187: -358, 188: -358, 189: -358, 190: -358, 191: -358, 192: -358, 193: -358, 194: -358, 195: -358, 196: -358, 197: -358 }, { 1: -359, 6: -359, 31: -359, 36: -359, 38: -359, 52: -359, 59: -359, 72: -359, 76: -359, 78: -359, 92: -359, 96: -359, 114: -359, 116: -359, 117: -359, 118: -359, 143: -359, 154: -359, 156: -359, 157: -359, 160: -359, 161: -359, 162: -359, 174: -359, 175: -359, 180: -359, 181: -359, 184: -359, 185: -359, 186: -359, 187: -359, 188: -359, 189: -359, 190: -359, 191: -359, 192: -359, 193: -359, 194: -359, 195: -359, 196: -359, 197: -359 }, { 6: 319, 7: 317, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 36: 318, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 32: 320, 36: 149, 171: 321 }, { 1: -272, 6: -272, 31: -272, 36: -272, 38: -272, 52: -272, 59: -272, 72: -272, 76: -272, 78: -272, 92: -272, 96: -272, 114: -272, 116: -272, 117: -272, 118: -272, 143: -272, 149: 322, 150: 323, 151: 324, 154: -272, 156: -272, 157: -272, 160: -272, 161: -272, 162: -272, 174: -272, 175: -272, 180: -272, 181: -272, 184: -272, 185: -272, 186: -272, 187: -272, 188: -272, 189: -272, 190: -272, 191: -272, 192: -272, 193: -272, 194: -272, 195: -272, 196: -272, 197: -272 }, { 1: -287, 6: -287, 31: -287, 36: -287, 38: -287, 52: -287, 59: -287, 72: -287, 76: -287, 78: -287, 92: -287, 96: -287, 114: -287, 116: -287, 117: -287, 118: -287, 143: -287, 154: -287, 156: -287, 157: -287, 160: -287, 161: -287, 162: -287, 174: -287, 175: -287, 180: -287, 181: -287, 184: -287, 185: -287, 186: -287, 187: -287, 188: -287, 189: -287, 190: -287, 191: -287, 192: -287, 193: -287, 194: -287, 195: -287, 196: -287, 197: -287 }, { 116: 326, 160: 325, 162: 327 }, { 28: 141, 37: 144, 40: 93, 74: 142, 75: 146, 77: 145, 102: 181, 103: 143, 113: 88, 115: 328, 164: 180 }, { 28: 141, 37: 144, 40: 93, 74: 142, 75: 146, 77: 145, 102: 181, 103: 143, 113: 88, 115: 329, 164: 180 }, { 32: 330, 36: 149, 161: 331 }, { 59: 332, 116: -325, 160: -325, 162: -325 }, { 59: -323, 68: 333, 116: -323, 160: -323, 162: -323 }, { 36: 334, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 166: 335, 168: 336, 169: 337 }, { 1: -179, 6: -179, 31: -179, 36: -179, 38: -179, 52: -179, 59: -179, 72: -179, 76: -179, 78: -179, 92: -179, 96: -179, 114: -179, 116: -179, 117: -179, 118: -179, 143: -179, 154: -179, 156: -179, 157: -179, 160: -179, 161: -179, 162: -179, 174: -179, 175: -179, 180: -179, 181: -179, 184: -179, 185: -179, 186: -179, 187: -179, 188: -179, 189: -179, 190: -179, 191: -179, 192: -179, 193: -179, 194: -179, 195: -179, 196: -179, 197: -179 }, { 7: 338, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -182, 6: -182, 29: -151, 31: -182, 32: 339, 36: 149, 38: -182, 46: -151, 47: -151, 52: -182, 59: -182, 68: -151, 72: -182, 76: -182, 78: -182, 87: -151, 88: -151, 89: -151, 90: -151, 91: -151, 92: -182, 93: -151, 96: -182, 107: -151, 114: -182, 116: -182, 117: -182, 118: -182, 122: 340, 135: -151, 136: -151, 143: -182, 154: -182, 156: -182, 157: -182, 160: -182, 161: -182, 162: -182, 174: -182, 175: -182, 180: -182, 181: -182, 184: -182, 185: -182, 186: -182, 187: -182, 188: -182, 189: -182, 190: -182, 191: -182, 192: -182, 193: -182, 194: -182, 195: -182, 196: -182, 197: -182 }, { 1: -279, 6: -279, 31: -279, 36: -279, 38: -279, 52: -279, 59: -279, 72: -279, 76: -279, 78: -279, 92: -279, 96: -279, 114: -279, 116: -279, 117: -279, 118: -279, 143: -279, 154: -279, 155: 115, 156: -279, 157: -279, 160: -279, 161: -279, 162: -279, 174: -279, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 37: 341, 113: 88 }, { 1: -31, 6: -31, 31: -31, 36: -31, 38: -31, 52: -31, 59: -31, 72: -31, 76: -31, 78: -31, 92: -31, 96: -31, 114: -31, 116: -31, 117: -31, 118: -31, 143: -31, 154: -31, 155: 115, 156: -31, 157: -31, 160: -31, 161: -31, 162: -31, 174: -31, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 37: 342, 113: 88 }, { 7: 343, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 29: 344, 32: 345, 36: 149 }, { 1: -348, 6: -348, 31: -348, 36: -348, 38: -348, 52: -348, 59: -348, 76: -348, 154: -348 }, { 1: -379, 6: -379, 29: -379, 31: -379, 36: -379, 38: -379, 46: -379, 47: -379, 52: -379, 59: -379, 72: -379, 76: -379, 78: -379, 87: -379, 88: -379, 89: -379, 90: -379, 91: -379, 92: -379, 93: -379, 96: -379, 107: -379, 114: -379, 116: -379, 117: -379, 118: -379, 135: -379, 136: -379, 143: -379, 154: -379, 156: -379, 157: -379, 160: -379, 161: -379, 162: -379, 174: -379, 175: -379, 180: -379, 181: -379, 184: -379, 185: -379, 186: -379, 187: -379, 188: -379, 189: -379, 190: -379, 191: -379, 192: -379, 193: -379, 194: -379, 195: -379, 196: -379, 197: -379 }, { 1: -97, 6: -97, 31: -97, 36: -97, 38: -97, 52: -97, 59: -97, 76: -97, 114: 116, 154: -97, 155: 115, 156: -97, 157: -97, 174: -97, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 37: 346, 113: 88 }, { 1: -186, 6: -186, 31: -186, 36: -186, 38: -186, 52: -186, 59: -186, 76: -186, 154: -186, 156: -186, 157: -186, 174: -186, 175: -186 }, { 39: 347, 59: 348 }, { 39: 349 }, { 28: 354, 36: 353, 40: 93, 117: 350, 126: 351, 127: 352, 129: 355 }, { 39: -202, 59: -202 }, { 128: 356 }, { 28: 361, 36: 360, 40: 93, 117: 357, 129: 362, 132: 358, 134: 359 }, { 1: -206, 6: -206, 31: -206, 36: -206, 38: -206, 52: -206, 59: -206, 76: -206, 154: -206, 156: -206, 157: -206, 174: -206, 175: -206 }, { 1: -207, 6: -207, 31: -207, 36: -207, 38: -207, 52: -207, 59: -207, 76: -207, 154: -207, 156: -207, 157: -207, 174: -207, 175: -207 }, { 68: 363 }, { 7: 364, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 36: 365, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 39: 366 }, { 6: 96, 154: 367 }, { 4: 368, 5: 3, 7: 4, 8: 5, 9: 6, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 33: 20, 34: 21, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 6: -253, 31: -253, 36: -253, 38: -253, 59: -253, 76: -253, 78: 294, 114: 116, 142: 369, 143: 293, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -238, 6: -238, 29: -238, 31: -238, 36: -238, 38: -238, 46: -238, 47: -238, 52: -238, 59: -238, 68: -238, 72: -238, 76: -238, 78: -238, 87: -238, 88: -238, 89: -238, 90: -238, 91: -238, 92: -238, 93: -238, 96: -238, 107: -238, 114: -238, 116: -238, 117: -238, 118: -238, 135: -238, 136: -238, 143: -238, 154: -238, 156: -238, 157: -238, 160: -238, 161: -238, 162: -238, 174: -238, 175: -238, 180: -238, 181: -238, 184: -238, 185: -238, 186: -238, 187: -238, 188: -238, 189: -238, 190: -238, 191: -238, 192: -238, 193: -238, 194: -238, 195: -238, 196: -238, 197: -238 }, { 7: 312, 8: 220, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 33: 20, 34: 21, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 59: 218, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 76: 370, 77: 76, 78: 222, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 104: 221, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 144: 372, 146: 371, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 6: -106, 31: -106, 36: -106, 38: -106, 59: 374, 76: -106, 100: 375, 117: -106, 141: 373 }, { 6: 376, 11: -266, 27: -266, 35: -266, 36: -266, 38: -266, 40: -266, 44: -266, 46: -266, 47: -266, 54: -266, 55: -266, 59: -266, 61: -266, 62: -266, 63: -266, 64: -266, 65: -266, 66: -266, 75: -266, 76: -266, 77: -266, 78: -266, 83: -266, 86: -266, 94: -266, 95: -266, 98: -266, 99: -266, 111: -266, 112: -266, 113: -266, 114: -266, 121: -266, 123: -266, 131: -266, 138: -266, 148: -266, 152: -266, 153: -266, 156: -266, 157: -266, 159: -266, 163: -266, 165: -266, 171: -266, 173: -266, 176: -266, 177: -266, 178: -266, 179: -266, 180: -266, 181: -266, 182: -266, 183: -266 }, { 6: -257, 36: -257, 38: -257, 59: -257, 76: -257 }, { 7: 312, 8: 220, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 33: 20, 34: 21, 35: 55, 36: 217, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 59: 218, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 78: 222, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 104: 221, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 139: 378, 140: 377, 144: 219, 145: 216, 146: 215, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 6: -268, 11: -268, 27: -268, 35: -268, 36: -268, 38: -268, 40: -268, 44: -268, 46: -268, 47: -268, 54: -268, 55: -268, 59: -268, 61: -268, 62: -268, 63: -268, 64: -268, 65: -268, 66: -268, 75: -268, 76: -268, 77: -268, 78: -268, 83: -268, 86: -268, 94: -268, 95: -268, 98: -268, 99: -268, 111: -268, 112: -268, 113: -268, 114: -268, 121: -268, 123: -268, 131: -268, 138: -268, 148: -268, 152: -268, 153: -268, 156: -268, 157: -268, 159: -268, 163: -268, 165: -268, 171: -268, 173: -268, 176: -268, 177: -268, 178: -268, 179: -268, 180: -268, 181: -268, 182: -268, 183: -268 }, { 6: -262, 36: -262, 38: -262, 59: -262, 76: -262 }, { 6: -254, 31: -254, 36: -254, 38: -254, 59: -254, 76: -254 }, { 6: -255, 31: -255, 36: -255, 38: -255, 59: -255, 76: -255 }, { 6: -256, 7: 379, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 31: -256, 35: 55, 36: -256, 37: 62, 38: -256, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 59: -256, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 76: -256, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -229, 6: -229, 29: -229, 31: -229, 36: -229, 38: -229, 46: -229, 47: -229, 52: -229, 57: -229, 59: -229, 72: -229, 76: -229, 78: -229, 87: -229, 88: -229, 89: -229, 90: -229, 91: -229, 92: -229, 93: -229, 96: -229, 107: -229, 114: -229, 116: -229, 117: -229, 118: -229, 135: -229, 136: -229, 143: -229, 154: -229, 156: -229, 157: -229, 160: -229, 161: -229, 162: -229, 174: -229, 175: -229, 180: -229, 181: -229, 184: -229, 185: -229, 186: -229, 187: -229, 188: -229, 189: -229, 190: -229, 191: -229, 192: -229, 193: -229, 194: -229, 195: -229, 196: -229, 197: -229 }, { 41: 380, 42: 229 }, { 7: 381, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 36: 382, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 312, 8: 220, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 31: 383, 33: 20, 34: 21, 35: 55, 36: 386, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 78: 222, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 104: 221, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 137: 384, 138: 75, 144: 385, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -230, 6: -230, 29: -230, 31: -230, 36: -230, 38: -230, 46: -230, 47: -230, 52: -230, 57: -230, 59: -230, 72: -230, 76: -230, 78: -230, 87: -230, 88: -230, 89: -230, 90: -230, 91: -230, 92: -230, 93: -230, 96: -230, 107: -230, 114: -230, 116: -230, 117: -230, 118: -230, 135: -230, 136: -230, 143: -230, 154: -230, 156: -230, 157: -230, 160: -230, 161: -230, 162: -230, 174: -230, 175: -230, 180: -230, 181: -230, 184: -230, 185: -230, 186: -230, 187: -230, 188: -230, 189: -230, 190: -230, 191: -230, 192: -230, 193: -230, 194: -230, 195: -230, 196: -230, 197: -230 }, { 1: -237, 6: -237, 29: -237, 31: -237, 36: -237, 38: -237, 46: -237, 47: -237, 52: -237, 59: -237, 68: -237, 72: -237, 76: -237, 78: -237, 87: -237, 88: -237, 89: -237, 90: -237, 91: -237, 92: -237, 93: -237, 96: -237, 107: -237, 114: -237, 116: -237, 117: -237, 118: -237, 122: -237, 135: -237, 136: -237, 143: -237, 154: -237, 156: -237, 157: -237, 160: -237, 161: -237, 162: -237, 174: -237, 175: -237, 180: -237, 181: -237, 182: -237, 183: -237, 184: -237, 185: -237, 186: -237, 187: -237, 188: -237, 189: -237, 190: -237, 191: -237, 192: -237, 193: -237, 194: -237, 195: -237, 196: -237, 197: -237, 198: -237 }, { 1: -37, 6: -37, 29: -37, 31: -37, 36: -37, 38: -37, 46: -37, 47: -37, 52: -37, 59: -37, 68: -37, 72: -37, 76: -37, 78: -37, 87: -37, 88: -37, 89: -37, 90: -37, 91: -37, 92: -37, 93: -37, 96: -37, 107: -37, 114: -37, 116: -37, 117: -37, 118: -37, 122: -37, 135: -37, 136: -37, 143: -37, 154: -37, 156: -37, 157: -37, 160: -37, 161: -37, 162: -37, 174: -37, 175: -37, 180: -37, 181: -37, 182: -37, 183: -37, 184: -37, 185: -37, 186: -37, 187: -37, 188: -37, 189: -37, 190: -37, 191: -37, 192: -37, 193: -37, 194: -37, 195: -37, 196: -37, 197: -37, 198: -37 }, { 41: 387, 42: 229 }, { 41: 388, 42: 229 }, { 32: 389, 36: 149, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 32: 390, 36: 149, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -283, 6: -283, 31: -283, 36: -283, 38: -283, 52: -283, 59: -283, 72: -283, 76: -283, 78: -283, 92: -283, 96: -283, 114: 116, 116: -283, 117: -283, 118: 391, 143: -283, 154: -283, 155: 115, 156: 85, 157: 86, 160: -283, 161: -283, 162: -283, 174: -283, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -285, 6: -285, 31: -285, 36: -285, 38: -285, 52: -285, 59: -285, 72: -285, 76: -285, 78: -285, 92: -285, 96: -285, 114: 116, 116: -285, 117: -285, 118: 392, 143: -285, 154: -285, 155: 115, 156: 85, 157: 86, 160: -285, 161: -285, 162: -285, 174: -285, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -291, 6: -291, 31: -291, 36: -291, 38: -291, 52: -291, 59: -291, 72: -291, 76: -291, 78: -291, 92: -291, 96: -291, 114: -291, 116: -291, 117: -291, 118: -291, 143: -291, 154: -291, 156: -291, 157: -291, 160: -291, 161: -291, 162: -291, 174: -291, 175: -291, 180: -291, 181: -291, 184: -291, 185: -291, 186: -291, 187: -291, 188: -291, 189: -291, 190: -291, 191: -291, 192: -291, 193: -291, 194: -291, 195: -291, 196: -291, 197: -291 }, { 1: -292, 6: -292, 31: -292, 36: -292, 38: -292, 52: -292, 59: -292, 72: -292, 76: -292, 78: -292, 92: -292, 96: -292, 114: 116, 116: -292, 117: -292, 118: -292, 143: -292, 154: -292, 155: 115, 156: 85, 157: 86, 160: -292, 161: -292, 162: -292, 174: -292, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 6: -63, 36: -63, 38: -63, 59: -63, 72: 393, 117: -63 }, { 6: -106, 31: -106, 36: -106, 38: -106, 59: 395, 76: -106, 100: 394, 117: -106 }, { 6: -72, 36: -72, 38: -72, 59: -72, 68: 396, 72: -72, 117: -72 }, { 7: 397, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 41: 228, 42: 229, 75: 398 }, { 6: -75, 36: -75, 38: -75, 59: -75, 72: -75, 117: -75 }, { 6: -174, 36: -174, 38: -174, 59: -174, 117: -174 }, { 6: -69, 29: -69, 36: -69, 38: -69, 59: -69, 68: -69, 72: -69, 87: -69, 88: -69, 89: -69, 90: -69, 91: -69, 93: -69, 117: -69, 136: -69 }, { 6: -70, 29: -70, 36: -70, 38: -70, 59: -70, 68: -70, 72: -70, 87: -70, 88: -70, 89: -70, 90: -70, 91: -70, 93: -70, 117: -70, 136: -70 }, { 6: -71, 29: -71, 36: -71, 38: -71, 59: -71, 68: -71, 72: -71, 87: -71, 88: -71, 89: -71, 90: -71, 91: -71, 93: -71, 117: -71, 136: -71 }, { 6: -64, 36: -64, 38: -64, 59: -64, 117: -64 }, { 28: 245, 37: 401, 40: 93, 41: 246, 42: 229, 73: 399, 74: 247, 77: 76, 79: 400, 80: 402, 81: 403, 82: 404, 83: 405, 86: 406, 113: 88, 138: 75, 153: 71 }, { 1: -158, 6: -158, 29: -158, 31: -158, 36: -158, 38: -158, 46: -158, 47: -158, 52: -158, 57: 407, 59: -158, 72: -158, 76: -158, 78: -158, 87: -158, 88: -158, 89: -158, 90: -158, 91: -158, 92: -158, 93: -158, 96: -158, 107: -158, 114: -158, 116: -158, 117: -158, 118: -158, 135: -158, 136: -158, 143: -158, 154: -158, 156: -158, 157: -158, 160: -158, 161: -158, 162: -158, 174: -158, 175: -158, 180: -158, 181: -158, 184: -158, 185: -158, 186: -158, 187: -158, 188: -158, 189: -158, 190: -158, 191: -158, 192: -158, 193: -158, 194: -158, 195: -158, 196: -158, 197: -158 }, { 1: -151, 6: -151, 29: -151, 31: -151, 36: -151, 38: -151, 46: -151, 47: -151, 52: -151, 59: -151, 68: -151, 72: -151, 76: -151, 78: -151, 87: -151, 88: -151, 89: -151, 90: -151, 91: -151, 92: -151, 93: -151, 96: -151, 107: -151, 114: -151, 116: -151, 117: -151, 118: -151, 135: -151, 136: -151, 143: -151, 154: -151, 156: -151, 157: -151, 160: -151, 161: -151, 162: -151, 174: -151, 175: -151, 180: -151, 181: -151, 184: -151, 185: -151, 186: -151, 187: -151, 188: -151, 189: -151, 190: -151, 191: -151, 192: -151, 193: -151, 194: -151, 195: -151, 196: -151, 197: -151 }, { 45: 255, 46: 94, 47: 95, 49: 408, 50: 409, 51: 254 }, { 46: -42, 47: -42, 49: -42, 51: -42 }, { 4: 410, 5: 3, 7: 4, 8: 5, 9: 6, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 33: 20, 34: 21, 35: 55, 36: 411, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 52: 412, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 46: -47, 47: -47, 49: -47, 51: -47 }, { 1: -4, 6: -4, 38: -4, 52: -4, 154: -4 }, { 1: -361, 6: -361, 31: -361, 36: -361, 38: -361, 52: -361, 59: -361, 72: -361, 76: -361, 78: -361, 92: -361, 96: -361, 114: -361, 116: -361, 117: -361, 118: -361, 143: -361, 154: -361, 155: 115, 156: -361, 157: -361, 160: -361, 161: -361, 162: -361, 174: -361, 175: 114, 180: -361, 181: -361, 184: 97, 185: 100, 186: 101, 187: -361, 188: -361, 189: -361, 190: -361, 191: -361, 192: -361, 193: -361, 194: 109, 195: 110, 196: -361, 197: -361 }, { 1: -362, 6: -362, 31: -362, 36: -362, 38: -362, 52: -362, 59: -362, 72: -362, 76: -362, 78: -362, 92: -362, 96: -362, 114: -362, 116: -362, 117: -362, 118: -362, 143: -362, 154: -362, 155: 115, 156: -362, 157: -362, 160: -362, 161: -362, 162: -362, 174: -362, 175: 114, 180: -362, 181: -362, 184: 97, 185: 100, 186: 101, 187: -362, 188: -362, 189: -362, 190: -362, 191: -362, 192: -362, 193: -362, 194: 109, 195: 110, 196: -362, 197: -362 }, { 1: -363, 6: -363, 31: -363, 36: -363, 38: -363, 52: -363, 59: -363, 72: -363, 76: -363, 78: -363, 92: -363, 96: -363, 114: -363, 116: -363, 117: -363, 118: -363, 143: -363, 154: -363, 155: 115, 156: -363, 157: -363, 160: -363, 161: -363, 162: -363, 174: -363, 175: 114, 180: -363, 181: -363, 184: 97, 185: -363, 186: 101, 187: -363, 188: -363, 189: -363, 190: -363, 191: -363, 192: -363, 193: -363, 194: 109, 195: 110, 196: -363, 197: -363 }, { 1: -364, 6: -364, 31: -364, 36: -364, 38: -364, 52: -364, 59: -364, 72: -364, 76: -364, 78: -364, 92: -364, 96: -364, 114: -364, 116: -364, 117: -364, 118: -364, 143: -364, 154: -364, 155: 115, 156: -364, 157: -364, 160: -364, 161: -364, 162: -364, 174: -364, 175: 114, 180: -364, 181: -364, 184: 97, 185: -364, 186: 101, 187: -364, 188: -364, 189: -364, 190: -364, 191: -364, 192: -364, 193: -364, 194: 109, 195: 110, 196: -364, 197: -364 }, { 1: -365, 6: -365, 31: -365, 36: -365, 38: -365, 52: -365, 59: -365, 72: -365, 76: -365, 78: -365, 92: -365, 96: -365, 114: -365, 116: -365, 117: -365, 118: -365, 143: -365, 154: -365, 155: 115, 156: -365, 157: -365, 160: -365, 161: -365, 162: -365, 174: -365, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: -365, 188: -365, 189: -365, 190: -365, 191: -365, 192: -365, 193: -365, 194: 109, 195: 110, 196: -365, 197: -365 }, { 1: -366, 6: -366, 31: -366, 36: -366, 38: -366, 52: -366, 59: -366, 72: -366, 76: -366, 78: -366, 92: -366, 96: -366, 114: -366, 116: -366, 117: -366, 118: -366, 143: -366, 154: -366, 155: 115, 156: -366, 157: -366, 160: -366, 161: -366, 162: -366, 174: -366, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: -366, 189: -366, 190: -366, 191: -366, 192: -366, 193: -366, 194: 109, 195: 110, 196: 111, 197: -366 }, { 1: -367, 6: -367, 31: -367, 36: -367, 38: -367, 52: -367, 59: -367, 72: -367, 76: -367, 78: -367, 92: -367, 96: -367, 114: -367, 116: -367, 117: -367, 118: -367, 143: -367, 154: -367, 155: 115, 156: -367, 157: -367, 160: -367, 161: -367, 162: -367, 174: -367, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: -367, 190: -367, 191: -367, 192: -367, 193: -367, 194: 109, 195: 110, 196: 111, 197: -367 }, { 1: -368, 6: -368, 31: -368, 36: -368, 38: -368, 52: -368, 59: -368, 72: -368, 76: -368, 78: -368, 92: -368, 96: -368, 114: -368, 116: -368, 117: -368, 118: -368, 143: -368, 154: -368, 155: 115, 156: -368, 157: -368, 160: -368, 161: -368, 162: -368, 174: -368, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: -368, 191: -368, 192: -368, 193: -368, 194: 109, 195: 110, 196: 111, 197: -368 }, { 1: -369, 6: -369, 31: -369, 36: -369, 38: -369, 52: -369, 59: -369, 72: -369, 76: -369, 78: -369, 92: -369, 96: -369, 114: -369, 116: -369, 117: -369, 118: -369, 143: -369, 154: -369, 155: 115, 156: -369, 157: -369, 160: -369, 161: -369, 162: -369, 174: -369, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: -369, 192: -369, 193: -369, 194: 109, 195: 110, 196: 111, 197: -369 }, { 1: -370, 6: -370, 31: -370, 36: -370, 38: -370, 52: -370, 59: -370, 72: -370, 76: -370, 78: -370, 92: -370, 96: -370, 114: -370, 116: -370, 117: -370, 118: -370, 143: -370, 154: -370, 155: 115, 156: -370, 157: -370, 160: -370, 161: -370, 162: -370, 174: -370, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: -370, 193: -370, 194: 109, 195: 110, 196: 111, 197: -370 }, { 1: -371, 6: -371, 31: -371, 36: -371, 38: -371, 52: -371, 59: -371, 72: -371, 76: -371, 78: -371, 92: -371, 96: -371, 114: -371, 116: -371, 117: -371, 118: -371, 143: -371, 154: -371, 155: 115, 156: -371, 157: -371, 160: -371, 161: -371, 162: -371, 174: -371, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: -371, 194: 109, 195: 110, 196: 111, 197: -371 }, { 1: -372, 6: -372, 31: -372, 36: -372, 38: -372, 52: -372, 59: -372, 72: -372, 76: -372, 78: -372, 92: -372, 96: -372, 114: 116, 116: -372, 117: -372, 118: -372, 143: -372, 154: -372, 155: 115, 156: 85, 157: 86, 160: -372, 161: -372, 162: -372, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -373, 6: -373, 31: -373, 36: -373, 38: -373, 52: -373, 59: -373, 72: -373, 76: -373, 78: -373, 92: -373, 96: -373, 114: 116, 116: -373, 117: -373, 118: -373, 143: -373, 154: -373, 155: 115, 156: 85, 157: 86, 160: -373, 161: -373, 162: -373, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -374, 6: -374, 31: -374, 36: -374, 38: -374, 52: -374, 59: -374, 72: -374, 76: -374, 78: -374, 92: -374, 96: -374, 114: -374, 116: -374, 117: -374, 118: -374, 143: -374, 154: -374, 155: 115, 156: -374, 157: -374, 160: -374, 161: -374, 162: -374, 174: -374, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: -374, 189: -374, 190: -374, 191: -374, 192: -374, 193: -374, 194: 109, 195: 110, 196: -374, 197: -374 }, { 72: 413, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -343, 6: -343, 31: -343, 36: -343, 38: -343, 52: -343, 59: -343, 72: -343, 76: -343, 78: -343, 92: -343, 96: -343, 114: 116, 116: -343, 117: -343, 118: -343, 143: -343, 154: -343, 155: 115, 156: 85, 157: 86, 160: -343, 161: -343, 162: -343, 174: -343, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -345, 6: -345, 31: -345, 36: -345, 38: -345, 52: -345, 59: -345, 72: -345, 76: -345, 78: -345, 92: -345, 96: -345, 114: 116, 116: -345, 117: -345, 118: -345, 143: -345, 154: -345, 155: 115, 156: 85, 157: 86, 160: -345, 161: -345, 162: -345, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 116: 415, 160: 414, 162: 416 }, { 28: 141, 37: 144, 40: 93, 74: 142, 75: 146, 77: 145, 102: 181, 103: 143, 113: 88, 115: 417, 164: 180 }, { 28: 141, 37: 144, 40: 93, 74: 142, 75: 146, 77: 145, 102: 181, 103: 143, 113: 88, 115: 418, 164: 180 }, { 1: -321, 6: -321, 31: -321, 36: -321, 38: -321, 52: -321, 59: -321, 72: -321, 76: -321, 78: -321, 92: -321, 96: -321, 114: -321, 116: -321, 117: -321, 118: -321, 143: -321, 154: -321, 156: -321, 157: -321, 160: -321, 161: 419, 162: -321, 174: -321, 175: -321, 180: -321, 181: -321, 184: -321, 185: -321, 186: -321, 187: -321, 188: -321, 189: -321, 190: -321, 191: -321, 192: -321, 193: -321, 194: -321, 195: -321, 196: -321, 197: -321 }, { 1: -342, 6: -342, 31: -342, 36: -342, 38: -342, 52: -342, 59: -342, 72: -342, 76: -342, 78: -342, 92: -342, 96: -342, 114: 116, 116: -342, 117: -342, 118: -342, 143: -342, 154: -342, 155: 115, 156: 85, 157: 86, 160: -342, 161: -342, 162: -342, 174: -342, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -344, 6: -344, 31: -344, 36: -344, 38: -344, 52: -344, 59: -344, 72: -344, 76: -344, 78: -344, 92: -344, 96: -344, 114: 116, 116: -344, 117: -344, 118: -344, 143: -344, 154: -344, 155: 115, 156: 85, 157: 86, 160: -344, 161: -344, 162: -344, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -226, 6: -226, 29: -226, 31: -226, 36: -226, 38: -226, 46: -226, 47: -226, 52: -226, 57: -226, 59: -226, 72: -226, 76: -226, 78: -226, 87: -226, 88: -226, 89: -226, 90: -226, 91: -226, 92: -226, 93: -226, 96: -226, 107: -226, 114: -226, 116: -226, 117: -226, 118: -226, 135: -226, 136: -226, 143: -226, 154: -226, 156: -226, 157: -226, 160: -226, 161: -226, 162: -226, 174: -226, 175: -226, 180: -226, 181: -226, 184: -226, 185: -226, 186: -226, 187: -226, 188: -226, 189: -226, 190: -226, 191: -226, 192: -226, 193: -226, 194: -226, 195: -226, 196: -226, 197: -226 }, { 1: -227, 6: -227, 29: -227, 31: -227, 36: -227, 38: -227, 46: -227, 47: -227, 52: -227, 57: -227, 59: -227, 72: -227, 76: -227, 78: -227, 87: -227, 88: -227, 89: -227, 90: -227, 91: -227, 92: -227, 93: -227, 96: -227, 107: -227, 114: -227, 116: -227, 117: -227, 118: -227, 135: -227, 136: -227, 143: -227, 154: -227, 156: -227, 157: -227, 160: -227, 161: -227, 162: -227, 174: -227, 175: -227, 180: -227, 181: -227, 184: -227, 185: -227, 186: -227, 187: -227, 188: -227, 189: -227, 190: -227, 191: -227, 192: -227, 193: -227, 194: -227, 195: -227, 196: -227, 197: -227 }, { 1: -228, 6: -228, 29: -228, 31: -228, 36: -228, 38: -228, 46: -228, 47: -228, 52: -228, 57: -228, 59: -228, 72: -228, 76: -228, 78: -228, 87: -228, 88: -228, 89: -228, 90: -228, 91: -228, 92: -228, 93: -228, 96: -228, 107: -228, 114: -228, 116: -228, 117: -228, 118: -228, 135: -228, 136: -228, 143: -228, 154: -228, 156: -228, 157: -228, 160: -228, 161: -228, 162: -228, 174: -228, 175: -228, 180: -228, 181: -228, 184: -228, 185: -228, 186: -228, 187: -228, 188: -228, 189: -228, 190: -228, 191: -228, 192: -228, 193: -228, 194: -228, 195: -228, 196: -228, 197: -228 }, { 1: -124, 6: -124, 29: -124, 31: -124, 36: -124, 38: -124, 46: -124, 47: -124, 52: -124, 59: -124, 68: -124, 72: -124, 76: -124, 78: -124, 87: -124, 88: -124, 89: -124, 90: -124, 91: -124, 92: -124, 93: -124, 96: -124, 107: -124, 114: -124, 116: -124, 117: -124, 118: -124, 122: -124, 135: -124, 136: -124, 143: -124, 154: -124, 156: -124, 157: -124, 160: -124, 161: -124, 162: -124, 174: -124, 175: -124, 180: -124, 181: -124, 182: -124, 183: -124, 184: -124, 185: -124, 186: -124, 187: -124, 188: -124, 189: -124, 190: -124, 191: -124, 192: -124, 193: -124, 194: -124, 195: -124, 196: -124, 197: -124, 198: -124 }, { 1: -125, 6: -125, 29: -125, 31: -125, 36: -125, 38: -125, 46: -125, 47: -125, 52: -125, 59: -125, 68: -125, 72: -125, 76: -125, 78: -125, 87: -125, 88: -125, 89: -125, 90: -125, 91: -125, 92: -125, 93: -125, 96: -125, 107: -125, 114: -125, 116: -125, 117: -125, 118: -125, 122: -125, 135: -125, 136: -125, 143: -125, 154: -125, 156: -125, 157: -125, 160: -125, 161: -125, 162: -125, 174: -125, 175: -125, 180: -125, 181: -125, 182: -125, 183: -125, 184: -125, 185: -125, 186: -125, 187: -125, 188: -125, 189: -125, 190: -125, 191: -125, 192: -125, 193: -125, 194: -125, 195: -125, 196: -125, 197: -125, 198: -125 }, { 1: -126, 6: -126, 29: -126, 31: -126, 36: -126, 38: -126, 46: -126, 47: -126, 52: -126, 59: -126, 68: -126, 72: -126, 76: -126, 78: -126, 87: -126, 88: -126, 89: -126, 90: -126, 91: -126, 92: -126, 93: -126, 96: -126, 107: -126, 114: -126, 116: -126, 117: -126, 118: -126, 122: -126, 135: -126, 136: -126, 143: -126, 154: -126, 156: -126, 157: -126, 160: -126, 161: -126, 162: -126, 174: -126, 175: -126, 180: -126, 181: -126, 182: -126, 183: -126, 184: -126, 185: -126, 186: -126, 187: -126, 188: -126, 189: -126, 190: -126, 191: -126, 192: -126, 193: -126, 194: -126, 195: -126, 196: -126, 197: -126, 198: -126 }, { 1: -127, 6: -127, 29: -127, 31: -127, 36: -127, 38: -127, 46: -127, 47: -127, 52: -127, 59: -127, 68: -127, 72: -127, 76: -127, 78: -127, 87: -127, 88: -127, 89: -127, 90: -127, 91: -127, 92: -127, 93: -127, 96: -127, 107: -127, 114: -127, 116: -127, 117: -127, 118: -127, 122: -127, 135: -127, 136: -127, 143: -127, 154: -127, 156: -127, 157: -127, 160: -127, 161: -127, 162: -127, 174: -127, 175: -127, 180: -127, 181: -127, 182: -127, 183: -127, 184: -127, 185: -127, 186: -127, 187: -127, 188: -127, 189: -127, 190: -127, 191: -127, 192: -127, 193: -127, 194: -127, 195: -127, 196: -127, 197: -127, 198: -127 }, { 78: 294, 92: 420, 114: 116, 142: 421, 143: 293, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 7: 422, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 78: 294, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 106: 423, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 142: 291, 143: 293, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 92: 424 }, { 92: 425 }, { 7: 426, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 38: -247, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 92: -247, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -54, 6: -54, 29: -54, 31: -54, 36: -54, 38: -54, 46: -54, 47: -54, 52: -54, 59: 427, 72: -54, 76: -54, 78: -54, 87: -54, 88: -54, 89: -54, 90: -54, 91: -54, 92: -51, 93: -54, 96: -54, 107: -54, 114: -54, 116: -54, 117: -54, 118: -54, 135: -54, 136: -54, 143: -54, 154: -54, 156: -54, 157: -54, 160: -54, 161: -54, 162: -54, 174: -54, 175: -54, 180: -54, 181: -54, 184: -54, 185: -54, 186: -54, 187: -54, 188: -54, 189: -54, 190: -54, 191: -54, 192: -54, 193: -54, 194: -54, 195: -54, 196: -54, 197: -54 }, { 11: -241, 27: -241, 35: -241, 38: -241, 40: -241, 44: -241, 46: -241, 47: -241, 54: -241, 55: -241, 61: -241, 62: -241, 63: -241, 64: -241, 65: -241, 66: -241, 75: -241, 77: -241, 83: -241, 86: -241, 92: -241, 94: -241, 95: -241, 98: -241, 99: -241, 111: -241, 112: -241, 113: -241, 114: -241, 121: -241, 123: -241, 131: -241, 138: -241, 148: -241, 152: -241, 153: -241, 156: -241, 157: -241, 159: -241, 163: -241, 165: -241, 171: -241, 173: -241, 176: -241, 177: -241, 178: -241, 179: -241, 180: -241, 181: -241, 182: -241, 183: -241 }, { 11: -242, 27: -242, 35: -242, 38: -242, 40: -242, 44: -242, 46: -242, 47: -242, 54: -242, 55: -242, 61: -242, 62: -242, 63: -242, 64: -242, 65: -242, 66: -242, 75: -242, 77: -242, 83: -242, 86: -242, 92: -242, 94: -242, 95: -242, 98: -242, 99: -242, 111: -242, 112: -242, 113: -242, 114: -242, 121: -242, 123: -242, 131: -242, 138: -242, 148: -242, 152: -242, 153: -242, 156: -242, 157: -242, 159: -242, 163: -242, 165: -242, 171: -242, 173: -242, 176: -242, 177: -242, 178: -242, 179: -242, 180: -242, 181: -242, 182: -242, 183: -242 }, { 7: 428, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 36: 429, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 78: 294, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 106: 430, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 142: 291, 143: 293, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 431, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 36: 432, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -141, 6: -141, 29: -141, 31: -141, 36: -141, 38: -141, 46: -141, 47: -141, 52: -141, 59: -141, 68: -141, 72: -141, 76: -141, 78: -141, 87: -141, 88: -141, 89: -141, 90: -141, 91: -141, 92: -141, 93: -141, 96: -141, 107: -141, 114: -141, 116: -141, 117: -141, 118: -141, 122: -141, 135: -141, 136: -141, 143: -141, 154: -141, 156: -141, 157: -141, 160: -141, 161: -141, 162: -141, 174: -141, 175: -141, 180: -141, 181: -141, 182: -141, 183: -141, 184: -141, 185: -141, 186: -141, 187: -141, 188: -141, 189: -141, 190: -141, 191: -141, 192: -141, 193: -141, 194: -141, 195: -141, 196: -141, 197: -141, 198: -141 }, { 1: -142, 6: -142, 29: -142, 31: -142, 36: -142, 38: -142, 46: -142, 47: -142, 52: -142, 59: -142, 68: -142, 72: -142, 76: -142, 78: -142, 87: -142, 88: -142, 89: -142, 90: -142, 91: -142, 92: -142, 93: -142, 96: -142, 107: -142, 114: -142, 116: -142, 117: -142, 118: -142, 122: -142, 135: -142, 136: -142, 143: -142, 154: -142, 156: -142, 157: -142, 160: -142, 161: -142, 162: -142, 174: -142, 175: -142, 180: -142, 181: -142, 182: -142, 183: -142, 184: -142, 185: -142, 186: -142, 187: -142, 188: -142, 189: -142, 190: -142, 191: -142, 192: -142, 193: -142, 194: -142, 195: -142, 196: -142, 197: -142, 198: -142 }, { 1: -143, 6: -143, 29: -143, 31: -143, 36: -143, 38: -143, 46: -143, 47: -143, 52: -143, 59: -143, 68: -143, 72: -143, 76: -143, 78: -143, 87: -143, 88: -143, 89: -143, 90: -143, 91: -143, 92: -143, 93: -143, 96: -143, 107: -143, 114: -143, 116: -143, 117: -143, 118: -143, 122: -143, 135: -143, 136: -143, 143: -143, 154: -143, 156: -143, 157: -143, 160: -143, 161: -143, 162: -143, 174: -143, 175: -143, 180: -143, 181: -143, 182: -143, 183: -143, 184: -143, 185: -143, 186: -143, 187: -143, 188: -143, 189: -143, 190: -143, 191: -143, 192: -143, 193: -143, 194: -143, 195: -143, 196: -143, 197: -143, 198: -143 }, { 1: -144, 6: -144, 29: -144, 31: -144, 36: -144, 38: -144, 46: -144, 47: -144, 52: -144, 59: -144, 68: -144, 72: -144, 76: -144, 78: -144, 87: -144, 88: -144, 89: -144, 90: -144, 91: -144, 92: -144, 93: -144, 96: -144, 107: -144, 114: -144, 116: -144, 117: -144, 118: -144, 122: -144, 135: -144, 136: -144, 143: -144, 154: -144, 156: -144, 157: -144, 160: -144, 161: -144, 162: -144, 174: -144, 175: -144, 180: -144, 181: -144, 182: -144, 183: -144, 184: -144, 185: -144, 186: -144, 187: -144, 188: -144, 189: -144, 190: -144, 191: -144, 192: -144, 193: -144, 194: -144, 195: -144, 196: -144, 197: -144, 198: -144 }, { 92: 433, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 7: 434, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 435, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 36: 436, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -60, 6: -60, 31: -60, 36: -60, 38: -60, 52: -60, 59: -60, 72: -60, 76: -60, 78: -60, 92: -60, 96: -60, 114: -60, 116: -60, 117: -60, 118: -60, 143: -60, 154: -60, 155: 115, 156: -60, 157: -60, 160: -60, 161: -60, 162: -60, 174: -60, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 7: 437, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 438, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 97: 439, 98: 79, 99: 80 }, { 6: -107, 28: 141, 31: -107, 36: -107, 37: 144, 38: -107, 40: 93, 74: 142, 75: 146, 76: -107, 77: 145, 78: 140, 101: 440, 102: 139, 103: 143, 113: 88, 117: -107 }, { 6: 441, 36: 442 }, { 7: 443, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 6: -115, 31: -115, 36: -115, 38: -115, 59: -115, 96: -115 }, { 6: -253, 31: -253, 36: -253, 38: -253, 59: -253, 76: -253, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -34, 6: -34, 29: -34, 31: -34, 36: -34, 38: -34, 46: -34, 47: -34, 52: -34, 59: -34, 72: -34, 76: -34, 78: -34, 87: -34, 88: -34, 89: -34, 90: -34, 91: -34, 92: -34, 93: -34, 96: -34, 107: -34, 114: -34, 116: -34, 117: -34, 118: -34, 135: -34, 136: -34, 143: -34, 150: -34, 151: -34, 154: -34, 156: -34, 157: -34, 160: -34, 161: -34, 162: -34, 167: -34, 169: -34, 174: -34, 175: -34, 180: -34, 181: -34, 184: -34, 185: -34, 186: -34, 187: -34, 188: -34, 189: -34, 190: -34, 191: -34, 192: -34, 193: -34, 194: -34, 195: -34, 196: -34, 197: -34 }, { 6: 96, 38: 444 }, { 6: -106, 31: -106, 36: -106, 38: -106, 59: 308, 76: -106, 96: 445, 100: 309, 117: -106 }, { 38: 446 }, { 1: -376, 6: -376, 31: -376, 36: -376, 38: -376, 52: -376, 59: -376, 72: -376, 76: -376, 78: -376, 92: -376, 96: -376, 114: -376, 116: -376, 117: -376, 118: -376, 143: -376, 154: -376, 155: 115, 156: -376, 157: -376, 160: -376, 161: -376, 162: -376, 174: -376, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 7: 447, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 448, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -340, 6: -340, 31: -340, 36: -340, 38: -340, 52: -340, 59: -340, 72: -340, 76: -340, 78: -340, 92: -340, 96: -340, 114: -340, 116: -340, 117: -340, 118: -340, 143: -340, 154: -340, 156: -340, 157: -340, 160: -340, 161: -340, 162: -340, 174: -340, 175: -340, 180: -340, 181: -340, 184: -340, 185: -340, 186: -340, 187: -340, 188: -340, 189: -340, 190: -340, 191: -340, 192: -340, 193: -340, 194: -340, 195: -340, 196: -340, 197: -340 }, { 7: 449, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -273, 6: -273, 31: -273, 36: -273, 38: -273, 52: -273, 59: -273, 72: -273, 76: -273, 78: -273, 92: -273, 96: -273, 114: -273, 116: -273, 117: -273, 118: -273, 143: -273, 150: 450, 154: -273, 156: -273, 157: -273, 160: -273, 161: -273, 162: -273, 174: -273, 175: -273, 180: -273, 181: -273, 184: -273, 185: -273, 186: -273, 187: -273, 188: -273, 189: -273, 190: -273, 191: -273, 192: -273, 193: -273, 194: -273, 195: -273, 196: -273, 197: -273 }, { 32: 451, 36: 149 }, { 28: 452, 32: 454, 36: 149, 37: 453, 40: 93, 113: 88 }, { 7: 455, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 456, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 457, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 116: 458 }, { 162: 459 }, { 1: -306, 6: -306, 31: -306, 36: -306, 38: -306, 52: -306, 59: -306, 72: -306, 76: -306, 78: -306, 92: -306, 96: -306, 114: -306, 116: -306, 117: -306, 118: -306, 143: -306, 154: -306, 156: -306, 157: -306, 160: -306, 161: -306, 162: -306, 174: -306, 175: -306, 180: -306, 181: -306, 184: -306, 185: -306, 186: -306, 187: -306, 188: -306, 189: -306, 190: -306, 191: -306, 192: -306, 193: -306, 194: -306, 195: -306, 196: -306, 197: -306 }, { 7: 460, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 28: 141, 37: 144, 40: 93, 74: 142, 75: 146, 77: 145, 102: 181, 103: 143, 113: 88, 164: 461 }, { 7: 462, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 166: 463, 168: 336, 169: 337 }, { 38: 464, 167: 465, 168: 466, 169: 337 }, { 38: -331, 167: -331, 169: -331 }, { 7: 468, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 147: 467, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -180, 6: -180, 31: -180, 32: 469, 36: 149, 38: -180, 52: -180, 59: -180, 72: -180, 76: -180, 78: -180, 92: -180, 96: -180, 114: -180, 116: -180, 117: -180, 118: -180, 143: -180, 154: -180, 155: 115, 156: -180, 157: -180, 160: -180, 161: -180, 162: -180, 174: -180, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -183, 6: -183, 31: -183, 36: -183, 38: -183, 52: -183, 59: -183, 72: -183, 76: -183, 78: -183, 92: -183, 96: -183, 114: -183, 116: -183, 117: -183, 118: -183, 143: -183, 154: -183, 156: -183, 157: -183, 160: -183, 161: -183, 162: -183, 174: -183, 175: -183, 180: -183, 181: -183, 184: -183, 185: -183, 186: -183, 187: -183, 188: -183, 189: -183, 190: -183, 191: -183, 192: -183, 193: -183, 194: -183, 195: -183, 196: -183, 197: -183 }, { 7: 470, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 38: 471 }, { 38: 472 }, { 1: -33, 6: -33, 31: -33, 36: -33, 38: -33, 52: -33, 59: -33, 72: -33, 76: -33, 78: -33, 92: -33, 96: -33, 114: -33, 116: -33, 117: -33, 118: -33, 143: -33, 154: -33, 155: 115, 156: -33, 157: -33, 160: -33, 161: -33, 162: -33, 174: -33, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 6: -108, 28: 141, 30: 473, 31: -108, 36: -108, 37: 144, 38: -108, 40: 93, 59: -108, 74: 142, 75: 146, 77: 145, 78: 140, 96: -108, 101: 138, 102: 139, 103: 143, 113: 88 }, { 1: -27, 6: -27, 31: -27, 36: -27, 38: -27, 52: -27, 59: -27, 72: -27, 76: -27, 78: -27, 92: -27, 96: -27, 114: -27, 116: -27, 117: -27, 118: -27, 143: -27, 154: -27, 156: -27, 157: -27, 160: -27, 161: -27, 162: -27, 174: -27, 175: -27, 180: -27, 181: -27, 184: -27, 185: -27, 186: -27, 187: -27, 188: -27, 189: -27, 190: -27, 191: -27, 192: -27, 193: -27, 194: -27, 195: -27, 196: -27, 197: -27 }, { 38: 474 }, { 45: 475, 46: 94, 47: 95 }, { 113: 477, 125: 476, 130: 202 }, { 45: 478, 46: 94, 47: 95 }, { 39: 479 }, { 6: -106, 31: -106, 36: -106, 38: -106, 59: 481, 76: -106, 100: 480, 117: -106 }, { 6: -193, 36: -193, 38: -193, 59: -193, 117: -193 }, { 28: 354, 36: 353, 40: 93, 126: 482, 127: 352, 129: 355 }, { 6: -198, 36: -198, 38: -198, 59: -198, 117: -198, 128: 483 }, { 6: -200, 36: -200, 38: -200, 59: -200, 117: -200, 128: 484 }, { 28: 485, 40: 93 }, { 1: -204, 6: -204, 31: -204, 36: -204, 38: -204, 39: 486, 52: -204, 59: -204, 76: -204, 154: -204, 156: -204, 157: -204, 174: -204, 175: -204 }, { 6: -106, 31: -106, 36: -106, 38: -106, 59: 488, 76: -106, 100: 487, 117: -106 }, { 6: -216, 36: -216, 38: -216, 59: -216, 117: -216 }, { 28: 361, 36: 360, 40: 93, 129: 362, 132: 489, 134: 359 }, { 6: -221, 36: -221, 38: -221, 59: -221, 117: -221, 128: 490 }, { 6: -224, 36: -224, 38: -224, 59: -224, 117: -224, 128: 491 }, { 6: 493, 7: 492, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 36: 494, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -211, 6: -211, 31: -211, 36: -211, 38: -211, 52: -211, 59: -211, 76: -211, 114: 116, 154: -211, 155: 115, 156: 85, 157: 86, 174: -211, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 37: 495, 113: 88 }, { 45: 496, 46: 94, 47: 95 }, { 1: -281, 6: -281, 29: -281, 31: -281, 36: -281, 38: -281, 46: -281, 47: -281, 52: -281, 59: -281, 72: -281, 76: -281, 78: -281, 87: -281, 88: -281, 89: -281, 90: -281, 91: -281, 92: -281, 93: -281, 96: -281, 107: -281, 114: -281, 116: -281, 117: -281, 118: -281, 135: -281, 136: -281, 143: -281, 154: -281, 156: -281, 157: -281, 160: -281, 161: -281, 162: -281, 174: -281, 175: -281, 180: -281, 181: -281, 184: -281, 185: -281, 186: -281, 187: -281, 188: -281, 189: -281, 190: -281, 191: -281, 192: -281, 193: -281, 194: -281, 195: -281, 196: -281, 197: -281 }, { 6: 96, 38: 497 }, { 7: 498, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -239, 6: -239, 29: -239, 31: -239, 36: -239, 38: -239, 46: -239, 47: -239, 52: -239, 59: -239, 68: -239, 72: -239, 76: -239, 78: -239, 87: -239, 88: -239, 89: -239, 90: -239, 91: -239, 92: -239, 93: -239, 96: -239, 107: -239, 114: -239, 116: -239, 117: -239, 118: -239, 135: -239, 136: -239, 143: -239, 154: -239, 156: -239, 157: -239, 160: -239, 161: -239, 162: -239, 174: -239, 175: -239, 180: -239, 181: -239, 184: -239, 185: -239, 186: -239, 187: -239, 188: -239, 189: -239, 190: -239, 191: -239, 192: -239, 193: -239, 194: -239, 195: -239, 196: -239, 197: -239 }, { 6: 376, 11: -267, 27: -267, 35: -267, 36: -267, 38: -267, 40: -267, 44: -267, 46: -267, 47: -267, 54: -267, 55: -267, 59: -267, 61: -267, 62: -267, 63: -267, 64: -267, 65: -267, 66: -267, 75: -267, 76: -267, 77: -267, 78: -267, 83: -267, 86: -267, 94: -267, 95: -267, 98: -267, 99: -267, 111: -267, 112: -267, 113: -267, 114: -267, 121: -267, 123: -267, 131: -267, 138: -267, 148: -267, 152: -267, 153: -267, 156: -267, 157: -267, 159: -267, 163: -267, 165: -267, 171: -267, 173: -267, 176: -267, 177: -267, 178: -267, 179: -267, 180: -267, 181: -267, 182: -267, 183: -267 }, { 6: -263, 36: -263, 38: -263, 59: -263, 76: -263 }, { 36: 500, 76: 499 }, { 6: -107, 7: 312, 8: 220, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 31: -107, 33: 20, 34: 21, 35: 55, 36: -107, 37: 62, 38: -107, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 59: 218, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 76: -107, 77: 76, 78: 222, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 104: 221, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 117: -107, 121: 53, 123: 59, 131: 60, 138: 75, 139: 502, 144: 219, 145: 501, 146: 215, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 6: 503, 36: -264, 38: -264, 76: -264 }, { 6: -269, 11: -269, 27: -269, 35: -269, 36: -269, 38: -269, 40: -269, 44: -269, 46: -269, 47: -269, 54: -269, 55: -269, 59: -269, 61: -269, 62: -269, 63: -269, 64: -269, 65: -269, 66: -269, 75: -269, 76: -269, 77: -269, 78: -269, 83: -269, 86: -269, 94: -269, 95: -269, 98: -269, 99: -269, 111: -269, 112: -269, 113: -269, 114: -269, 121: -269, 123: -269, 131: -269, 138: -269, 148: -269, 152: -269, 153: -269, 156: -269, 157: -269, 159: -269, 163: -269, 165: -269, 171: -269, 173: -269, 176: -269, 177: -269, 178: -269, 179: -269, 180: -269, 181: -269, 182: -269, 183: -269 }, { 6: -106, 31: -106, 36: -106, 38: -106, 59: 374, 76: -106, 100: 375, 117: -106, 141: 504 }, { 7: 312, 8: 220, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 33: 20, 34: 21, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 59: 218, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 78: 222, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 104: 221, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 144: 372, 146: 371, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 6: -121, 31: -121, 36: -121, 38: -121, 59: -121, 76: -121, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -163, 6: -163, 29: -163, 31: -163, 36: -163, 38: -163, 46: -163, 47: -163, 52: -163, 59: -163, 72: -163, 76: -163, 78: -163, 87: -163, 88: -163, 89: -163, 90: -163, 91: -163, 92: -163, 93: -163, 96: -163, 107: -163, 114: -163, 116: -163, 117: -163, 118: -163, 135: -163, 136: -163, 143: -163, 154: -163, 156: -163, 157: -163, 160: -163, 161: -163, 162: -163, 174: -163, 175: -163, 180: -163, 181: -163, 184: -163, 185: -163, 186: -163, 187: -163, 188: -163, 189: -163, 190: -163, 191: -163, 192: -163, 193: -163, 194: -163, 195: -163, 196: -163, 197: -163 }, { 92: 505, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 7: 506, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -233, 6: -233, 29: -233, 31: -233, 36: -233, 38: -233, 46: -233, 47: -233, 52: -233, 57: -233, 59: -233, 72: -233, 76: -233, 78: -233, 87: -233, 88: -233, 89: -233, 90: -233, 91: -233, 92: -233, 93: -233, 96: -233, 107: -233, 114: -233, 116: -233, 117: -233, 118: -233, 135: -233, 136: -233, 143: -233, 154: -233, 156: -233, 157: -233, 160: -233, 161: -233, 162: -233, 174: -233, 175: -233, 180: -233, 181: -233, 184: -233, 185: -233, 186: -233, 187: -233, 188: -233, 189: -233, 190: -233, 191: -233, 192: -233, 193: -233, 194: -233, 195: -233, 196: -233, 197: -233 }, { 6: -106, 31: -106, 36: -106, 38: -106, 59: 508, 76: -106, 100: 507, 117: -106 }, { 6: -248, 31: -248, 36: -248, 38: -248, 59: -248 }, { 7: 312, 8: 220, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 33: 20, 34: 21, 35: 55, 36: 386, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 78: 222, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 104: 221, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 137: 509, 138: 75, 144: 385, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -166, 6: -166, 29: -166, 31: -166, 36: -166, 38: -166, 46: -166, 47: -166, 52: -166, 59: -166, 72: -166, 76: -166, 78: -166, 87: -166, 88: -166, 89: -166, 90: -166, 91: -166, 92: -166, 93: -166, 96: -166, 107: -166, 114: -166, 116: -166, 117: -166, 118: -166, 135: -166, 136: -166, 143: -166, 154: -166, 156: -166, 157: -166, 160: -166, 161: -166, 162: -166, 174: -166, 175: -166, 180: -166, 181: -166, 184: -166, 185: -166, 186: -166, 187: -166, 188: -166, 189: -166, 190: -166, 191: -166, 192: -166, 193: -166, 194: -166, 195: -166, 196: -166, 197: -166 }, { 1: -167, 6: -167, 29: -167, 31: -167, 36: -167, 38: -167, 46: -167, 47: -167, 52: -167, 59: -167, 72: -167, 76: -167, 78: -167, 87: -167, 88: -167, 89: -167, 90: -167, 91: -167, 92: -167, 93: -167, 96: -167, 107: -167, 114: -167, 116: -167, 117: -167, 118: -167, 135: -167, 136: -167, 143: -167, 154: -167, 156: -167, 157: -167, 160: -167, 161: -167, 162: -167, 174: -167, 175: -167, 180: -167, 181: -167, 184: -167, 185: -167, 186: -167, 187: -167, 188: -167, 189: -167, 190: -167, 191: -167, 192: -167, 193: -167, 194: -167, 195: -167, 196: -167, 197: -167 }, { 1: -335, 6: -335, 31: -335, 36: -335, 38: -335, 52: -335, 59: -335, 72: -335, 76: -335, 78: -335, 92: -335, 96: -335, 114: -335, 116: -335, 117: -335, 118: -335, 143: -335, 154: -335, 156: -335, 157: -335, 160: -335, 161: -335, 162: -335, 167: -335, 174: -335, 175: -335, 180: -335, 181: -335, 184: -335, 185: -335, 186: -335, 187: -335, 188: -335, 189: -335, 190: -335, 191: -335, 192: -335, 193: -335, 194: -335, 195: -335, 196: -335, 197: -335 }, { 1: -337, 6: -337, 31: -337, 36: -337, 38: -337, 52: -337, 59: -337, 72: -337, 76: -337, 78: -337, 92: -337, 96: -337, 114: -337, 116: -337, 117: -337, 118: -337, 143: -337, 154: -337, 156: -337, 157: -337, 160: -337, 161: -337, 162: -337, 167: 510, 174: -337, 175: -337, 180: -337, 181: -337, 184: -337, 185: -337, 186: -337, 187: -337, 188: -337, 189: -337, 190: -337, 191: -337, 192: -337, 193: -337, 194: -337, 195: -337, 196: -337, 197: -337 }, { 7: 511, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 512, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 513, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 36: 514, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 6: 516, 36: 517, 117: 515 }, { 6: -107, 28: 245, 31: -107, 36: -107, 38: -107, 40: 93, 41: 246, 42: 229, 43: 243, 44: 89, 45: 90, 46: 94, 47: 95, 69: 518, 70: 519, 71: 248, 73: 240, 74: 247, 75: 241, 76: -107, 77: 242, 78: 249, 117: -107 }, { 7: 520, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 36: 521, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 76: 522, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 7: 523, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 6: -76, 29: -78, 36: -76, 38: -76, 46: -231, 47: -231, 59: -76, 84: 524, 87: -78, 88: -78, 89: -78, 90: -78, 91: -78, 93: -78, 117: -76, 136: 129 }, { 6: -77, 29: -231, 36: -77, 38: -77, 46: -231, 47: -231, 59: -77, 84: 525, 87: 526, 88: 527, 89: 528, 90: 529, 91: 530, 93: 531, 117: -77, 136: 129 }, { 6: -79, 29: -79, 36: -79, 38: -79, 59: -79, 87: -79, 88: -79, 89: -79, 90: -79, 91: -79, 93: -79, 117: -79, 136: -79 }, { 6: -80, 29: -80, 36: -80, 38: -80, 59: -80, 87: -80, 88: -80, 89: -80, 90: -80, 91: -80, 93: -80, 117: -80, 136: -80 }, { 6: -81, 29: -81, 36: -81, 38: -81, 59: -81, 87: -81, 88: -81, 89: -81, 90: -81, 91: -81, 93: -81, 117: -81, 136: -81 }, { 6: -82, 29: -82, 36: -82, 38: -82, 59: -82, 87: -82, 88: -82, 89: -82, 90: -82, 91: -82, 93: -82, 117: -82, 136: -82 }, { 29: -231, 46: -231, 47: -231, 84: 532, 87: 224, 91: 225, 136: 129 }, { 29: 226, 85: 533 }, { 1: -49, 6: -49, 29: -49, 31: -49, 36: -49, 38: -49, 46: -49, 47: -49, 52: -49, 59: -49, 72: -49, 76: -49, 78: -49, 87: -49, 88: -49, 89: -49, 90: -49, 91: -49, 92: -49, 93: -49, 96: -49, 107: -49, 114: -49, 116: -49, 117: -49, 118: -49, 135: -49, 136: -49, 143: -49, 154: -49, 156: -49, 157: -49, 160: -49, 161: -49, 162: -49, 174: -49, 175: -49, 180: -49, 181: -49, 184: -49, 185: -49, 186: -49, 187: -49, 188: -49, 189: -49, 190: -49, 191: -49, 192: -49, 193: -49, 194: -49, 195: -49, 196: -49, 197: -49 }, { 1: -41, 6: -41, 29: -41, 31: -41, 36: -41, 38: -41, 46: -41, 47: -41, 49: -41, 51: -41, 52: -41, 57: -41, 59: -41, 72: -41, 76: -41, 78: -41, 87: -41, 88: -41, 89: -41, 90: -41, 91: -41, 92: -41, 93: -41, 96: -41, 107: -41, 114: -41, 116: -41, 117: -41, 118: -41, 135: -41, 136: -41, 143: -41, 154: -41, 156: -41, 157: -41, 160: -41, 161: -41, 162: -41, 174: -41, 175: -41, 180: -41, 181: -41, 184: -41, 185: -41, 186: -41, 187: -41, 188: -41, 189: -41, 190: -41, 191: -41, 192: -41, 193: -41, 194: -41, 195: -41, 196: -41, 197: -41 }, { 46: -43, 47: -43, 49: -43, 51: -43 }, { 6: 96, 52: 534 }, { 4: 535, 5: 3, 7: 4, 8: 5, 9: 6, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 33: 20, 34: 21, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 46: -46, 47: -46, 49: -46, 51: -46 }, { 7: 536, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 537, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 538, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 539, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 116: 540 }, { 162: 541 }, { 7: 542, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -130, 6: -130, 29: -130, 31: -130, 36: -130, 38: -130, 46: -130, 47: -130, 52: -130, 59: -130, 68: -130, 72: -130, 76: -130, 78: -130, 87: -130, 88: -130, 89: -130, 90: -130, 91: -130, 92: -130, 93: -130, 96: -130, 107: -130, 114: -130, 116: -130, 117: -130, 118: -130, 122: -130, 135: -130, 136: -130, 143: -130, 154: -130, 156: -130, 157: -130, 160: -130, 161: -130, 162: -130, 174: -130, 175: -130, 180: -130, 181: -130, 182: -130, 183: -130, 184: -130, 185: -130, 186: -130, 187: -130, 188: -130, 189: -130, 190: -130, 191: -130, 192: -130, 193: -130, 194: -130, 195: -130, 196: -130, 197: -130, 198: -130 }, { 7: 543, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 38: -245, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 92: -245, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 38: 544, 78: 294, 114: 116, 142: 421, 143: 293, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 38: 545 }, { 1: -132, 6: -132, 29: -132, 31: -132, 36: -132, 38: -132, 46: -132, 47: -132, 52: -132, 59: -132, 68: -132, 72: -132, 76: -132, 78: -132, 87: -132, 88: -132, 89: -132, 90: -132, 91: -132, 92: -132, 93: -132, 96: -132, 107: -132, 114: -132, 116: -132, 117: -132, 118: -132, 122: -132, 135: -132, 136: -132, 143: -132, 154: -132, 156: -132, 157: -132, 160: -132, 161: -132, 162: -132, 174: -132, 175: -132, 180: -132, 181: -132, 182: -132, 183: -132, 184: -132, 185: -132, 186: -132, 187: -132, 188: -132, 189: -132, 190: -132, 191: -132, 192: -132, 193: -132, 194: -132, 195: -132, 196: -132, 197: -132, 198: -132 }, { 1: -134, 6: -134, 29: -134, 31: -134, 36: -134, 38: -134, 46: -134, 47: -134, 52: -134, 59: -134, 68: -134, 72: -134, 76: -134, 78: -134, 87: -134, 88: -134, 89: -134, 90: -134, 91: -134, 92: -134, 93: -134, 96: -134, 107: -134, 114: -134, 116: -134, 117: -134, 118: -134, 122: -134, 135: -134, 136: -134, 143: -134, 154: -134, 156: -134, 157: -134, 160: -134, 161: -134, 162: -134, 174: -134, 175: -134, 180: -134, 181: -134, 182: -134, 183: -134, 184: -134, 185: -134, 186: -134, 187: -134, 188: -134, 189: -134, 190: -134, 191: -134, 192: -134, 193: -134, 194: -134, 195: -134, 196: -134, 197: -134, 198: -134 }, { 38: -246, 92: -246, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 7: 546, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 78: 294, 92: 547, 114: 116, 142: 421, 143: 293, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 7: 548, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 78: 294, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 106: 549, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 142: 291, 143: 293, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 92: 550 }, { 92: 551, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 7: 552, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -147, 6: -147, 29: -147, 31: -147, 36: -147, 38: -147, 46: -147, 47: -147, 52: -147, 59: -147, 68: -147, 72: -147, 76: -147, 78: -147, 87: -147, 88: -147, 89: -147, 90: -147, 91: -147, 92: -147, 93: -147, 96: -147, 107: -147, 114: -147, 116: -147, 117: -147, 118: -147, 122: -147, 135: -147, 136: -147, 143: -147, 154: -147, 156: -147, 157: -147, 160: -147, 161: -147, 162: -147, 174: -147, 175: -147, 180: -147, 181: -147, 182: -147, 183: -147, 184: -147, 185: -147, 186: -147, 187: -147, 188: -147, 189: -147, 190: -147, 191: -147, 192: -147, 193: -147, 194: -147, 195: -147, 196: -147, 197: -147, 198: -147 }, { 38: 553, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 92: 554, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 7: 555, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -61, 6: -61, 31: -61, 36: -61, 38: -61, 52: -61, 59: -61, 72: -61, 76: -61, 78: -61, 92: -61, 96: -61, 114: -61, 116: -61, 117: -61, 118: -61, 143: -61, 154: -61, 155: 115, 156: -61, 157: -61, 160: -61, 161: -61, 162: -61, 174: -61, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 38: 556, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 5: 558, 7: 4, 8: 5, 9: 6, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 32: 557, 33: 20, 34: 21, 35: 55, 36: 149, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 6: -110, 31: -110, 36: -110, 38: -110, 59: -110, 96: -110 }, { 28: 141, 37: 144, 40: 93, 74: 142, 75: 146, 77: 145, 78: 140, 101: 559, 102: 139, 103: 143, 113: 88 }, { 6: -108, 28: 141, 30: 560, 31: -108, 36: -108, 37: 144, 38: -108, 40: 93, 59: -108, 74: 142, 75: 146, 77: 145, 78: 140, 96: -108, 101: 138, 102: 139, 103: 143, 113: 88 }, { 6: -114, 31: -114, 36: -114, 38: -114, 59: -114, 96: -114, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -35, 6: -35, 29: -35, 31: -35, 36: -35, 38: -35, 46: -35, 47: -35, 52: -35, 59: -35, 72: -35, 76: -35, 78: -35, 87: -35, 88: -35, 89: -35, 90: -35, 91: -35, 92: -35, 93: -35, 96: -35, 107: -35, 114: -35, 116: -35, 117: -35, 118: -35, 135: -35, 136: -35, 143: -35, 150: -35, 151: -35, 154: -35, 156: -35, 157: -35, 160: -35, 161: -35, 162: -35, 167: -35, 169: -35, 174: -35, 175: -35, 180: -35, 181: -35, 184: -35, 185: -35, 186: -35, 187: -35, 188: -35, 189: -35, 190: -35, 191: -35, 192: -35, 193: -35, 194: -35, 195: -35, 196: -35, 197: -35 }, { 97: 561, 98: 79, 99: 80 }, { 1: -355, 6: -355, 31: -355, 36: -355, 38: -355, 52: -355, 59: -355, 72: -355, 76: -355, 78: -355, 92: -355, 96: -355, 114: -355, 116: -355, 117: -355, 118: -355, 143: -355, 154: -355, 156: -355, 157: -355, 160: -355, 161: -355, 162: -355, 174: -355, 175: -355, 180: -355, 181: -355, 184: -355, 185: -355, 186: -355, 187: -355, 188: -355, 189: -355, 190: -355, 191: -355, 192: -355, 193: -355, 194: -355, 195: -355, 196: -355, 197: -355 }, { 38: 562, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -378, 6: -378, 31: -378, 36: -378, 38: -378, 52: -378, 59: -378, 72: -378, 76: -378, 78: -378, 92: -378, 96: -378, 114: -378, 116: -378, 117: -378, 118: -378, 143: -378, 154: -378, 155: 115, 156: -378, 157: -378, 160: -378, 161: -378, 162: -378, 174: -378, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 32: 563, 36: 149, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 32: 564, 36: 149 }, { 1: -274, 6: -274, 31: -274, 36: -274, 38: -274, 52: -274, 59: -274, 72: -274, 76: -274, 78: -274, 92: -274, 96: -274, 114: -274, 116: -274, 117: -274, 118: -274, 143: -274, 154: -274, 156: -274, 157: -274, 160: -274, 161: -274, 162: -274, 174: -274, 175: -274, 180: -274, 181: -274, 184: -274, 185: -274, 186: -274, 187: -274, 188: -274, 189: -274, 190: -274, 191: -274, 192: -274, 193: -274, 194: -274, 195: -274, 196: -274, 197: -274 }, { 32: 565, 36: 149 }, { 32: 566, 36: 149 }, { 1: -278, 6: -278, 31: -278, 36: -278, 38: -278, 52: -278, 59: -278, 72: -278, 76: -278, 78: -278, 92: -278, 96: -278, 114: -278, 116: -278, 117: -278, 118: -278, 143: -278, 150: -278, 154: -278, 156: -278, 157: -278, 160: -278, 161: -278, 162: -278, 174: -278, 175: -278, 180: -278, 181: -278, 184: -278, 185: -278, 186: -278, 187: -278, 188: -278, 189: -278, 190: -278, 191: -278, 192: -278, 193: -278, 194: -278, 195: -278, 196: -278, 197: -278 }, { 32: 567, 36: 149, 114: 116, 118: 568, 155: 115, 156: 85, 157: 86, 161: 569, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 32: 570, 36: 149, 114: 116, 118: 571, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 32: 572, 36: 149, 114: 116, 118: 573, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 7: 574, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 575, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 32: 576, 36: 149, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 116: -326, 160: -326, 162: -326 }, { 59: -324, 114: 116, 116: -324, 155: 115, 156: 85, 157: 86, 160: -324, 162: -324, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 38: 577, 167: 578, 168: 466, 169: 337 }, { 1: -329, 6: -329, 31: -329, 36: -329, 38: -329, 52: -329, 59: -329, 72: -329, 76: -329, 78: -329, 92: -329, 96: -329, 114: -329, 116: -329, 117: -329, 118: -329, 143: -329, 154: -329, 156: -329, 157: -329, 160: -329, 161: -329, 162: -329, 174: -329, 175: -329, 180: -329, 181: -329, 184: -329, 185: -329, 186: -329, 187: -329, 188: -329, 189: -329, 190: -329, 191: -329, 192: -329, 193: -329, 194: -329, 195: -329, 196: -329, 197: -329 }, { 32: 579, 36: 149 }, { 38: -332, 167: -332, 169: -332 }, { 32: 580, 36: 149, 59: 581 }, { 36: -270, 59: -270, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -181, 6: -181, 31: -181, 36: -181, 38: -181, 52: -181, 59: -181, 72: -181, 76: -181, 78: -181, 92: -181, 96: -181, 114: -181, 116: -181, 117: -181, 118: -181, 143: -181, 154: -181, 156: -181, 157: -181, 160: -181, 161: -181, 162: -181, 174: -181, 175: -181, 180: -181, 181: -181, 184: -181, 185: -181, 186: -181, 187: -181, 188: -181, 189: -181, 190: -181, 191: -181, 192: -181, 193: -181, 194: -181, 195: -181, 196: -181, 197: -181 }, { 1: -184, 6: -184, 31: -184, 32: 582, 36: 149, 38: -184, 52: -184, 59: -184, 72: -184, 76: -184, 78: -184, 92: -184, 96: -184, 114: -184, 116: -184, 117: -184, 118: -184, 143: -184, 154: -184, 155: 115, 156: -184, 157: -184, 160: -184, 161: -184, 162: -184, 174: -184, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -280, 6: -280, 31: -280, 36: -280, 38: -280, 52: -280, 59: -280, 72: -280, 76: -280, 78: -280, 92: -280, 96: -280, 114: -280, 116: -280, 117: -280, 118: -280, 143: -280, 154: -280, 156: -280, 157: -280, 160: -280, 161: -280, 162: -280, 174: -280, 175: -280, 180: -280, 181: -280, 184: -280, 185: -280, 186: -280, 187: -280, 188: -280, 189: -280, 190: -280, 191: -280, 192: -280, 193: -280, 194: -280, 195: -280, 196: -280, 197: -280 }, { 1: -32, 6: -32, 31: -32, 36: -32, 38: -32, 52: -32, 59: -32, 72: -32, 76: -32, 78: -32, 92: -32, 96: -32, 114: -32, 116: -32, 117: -32, 118: -32, 143: -32, 154: -32, 156: -32, 157: -32, 160: -32, 161: -32, 162: -32, 174: -32, 175: -32, 180: -32, 181: -32, 184: -32, 185: -32, 186: -32, 187: -32, 188: -32, 189: -32, 190: -32, 191: -32, 192: -32, 193: -32, 194: -32, 195: -32, 196: -32, 197: -32 }, { 6: -106, 31: 583, 36: -106, 38: -106, 59: 308, 76: -106, 100: 309, 117: -106 }, { 1: -98, 6: -98, 31: -98, 36: -98, 38: -98, 52: -98, 59: -98, 76: -98, 154: -98, 156: -98, 157: -98, 174: -98, 175: -98 }, { 1: -187, 6: -187, 31: -187, 36: -187, 38: -187, 52: -187, 59: -187, 76: -187, 154: -187, 156: -187, 157: -187, 174: -187, 175: -187 }, { 39: 584 }, { 28: 354, 36: 353, 40: 93, 126: 585, 127: 352, 129: 355 }, { 1: -188, 6: -188, 31: -188, 36: -188, 38: -188, 52: -188, 59: -188, 76: -188, 154: -188, 156: -188, 157: -188, 174: -188, 175: -188 }, { 45: 586, 46: 94, 47: 95 }, { 6: 588, 36: 589, 117: 587 }, { 6: -107, 28: 354, 31: -107, 36: -107, 38: -107, 40: 93, 76: -107, 117: -107, 127: 590, 129: 355 }, { 6: -106, 31: -106, 36: -106, 38: -106, 59: 481, 76: -106, 100: 591, 117: -106 }, { 28: 592, 40: 93 }, { 28: 593, 40: 93 }, { 39: -203 }, { 45: 594, 46: 94, 47: 95 }, { 6: 596, 36: 597, 117: 595 }, { 6: -107, 28: 361, 31: -107, 36: -107, 38: -107, 40: 93, 76: -107, 117: -107, 129: 362, 134: 598 }, { 6: -106, 31: -106, 36: -106, 38: -106, 59: 488, 76: -106, 100: 599, 117: -106 }, { 28: 600, 40: 93, 129: 601 }, { 28: 602, 40: 93 }, { 1: -208, 6: -208, 31: -208, 36: -208, 38: -208, 52: -208, 59: -208, 76: -208, 114: 116, 154: -208, 155: 115, 156: -208, 157: -208, 174: -208, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 7: 603, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 604, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 38: 605 }, { 1: -213, 6: -213, 31: -213, 36: -213, 38: -213, 52: -213, 59: -213, 76: -213, 154: -213, 156: -213, 157: -213, 174: -213, 175: -213 }, { 154: 606 }, { 76: 607, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -240, 6: -240, 29: -240, 31: -240, 36: -240, 38: -240, 46: -240, 47: -240, 52: -240, 59: -240, 68: -240, 72: -240, 76: -240, 78: -240, 87: -240, 88: -240, 89: -240, 90: -240, 91: -240, 92: -240, 93: -240, 96: -240, 107: -240, 114: -240, 116: -240, 117: -240, 118: -240, 135: -240, 136: -240, 143: -240, 154: -240, 156: -240, 157: -240, 160: -240, 161: -240, 162: -240, 174: -240, 175: -240, 180: -240, 181: -240, 184: -240, 185: -240, 186: -240, 187: -240, 188: -240, 189: -240, 190: -240, 191: -240, 192: -240, 193: -240, 194: -240, 195: -240, 196: -240, 197: -240 }, { 7: 312, 8: 220, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 33: 20, 34: 21, 35: 55, 36: 217, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 59: 218, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 78: 222, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 104: 221, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 139: 378, 140: 608, 144: 219, 145: 216, 146: 215, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 6: -258, 36: -258, 38: -258, 59: -258, 76: -258 }, { 7: 312, 8: 220, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 33: 20, 34: 21, 35: 55, 36: -265, 37: 62, 38: -265, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 59: 218, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 76: -265, 77: 76, 78: 222, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 104: 221, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 144: 372, 146: 371, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 312, 8: 220, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 33: 20, 34: 21, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 59: 218, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 78: 222, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 104: 221, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 139: 378, 144: 219, 145: 609, 146: 215, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 36: 500, 38: 610 }, { 1: -164, 6: -164, 29: -164, 31: -164, 36: -164, 38: -164, 46: -164, 47: -164, 52: -164, 59: -164, 72: -164, 76: -164, 78: -164, 87: -164, 88: -164, 89: -164, 90: -164, 91: -164, 92: -164, 93: -164, 96: -164, 107: -164, 114: -164, 116: -164, 117: -164, 118: -164, 135: -164, 136: -164, 143: -164, 154: -164, 156: -164, 157: -164, 160: -164, 161: -164, 162: -164, 174: -164, 175: -164, 180: -164, 181: -164, 184: -164, 185: -164, 186: -164, 187: -164, 188: -164, 189: -164, 190: -164, 191: -164, 192: -164, 193: -164, 194: -164, 195: -164, 196: -164, 197: -164 }, { 38: 611, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 6: 613, 31: 612, 36: 614 }, { 6: -107, 7: 312, 8: 220, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 31: -107, 33: 20, 34: 21, 35: 55, 36: -107, 37: 62, 38: -107, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 76: -107, 77: 76, 78: 222, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 104: 221, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 117: -107, 121: 53, 123: 59, 131: 60, 138: 75, 144: 615, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 6: -106, 31: -106, 36: -106, 38: -106, 59: 508, 76: -106, 100: 616, 117: -106 }, { 32: 617, 36: 149 }, { 1: -284, 6: -284, 31: -284, 36: -284, 38: -284, 52: -284, 59: -284, 72: -284, 76: -284, 78: -284, 92: -284, 96: -284, 114: -284, 116: -284, 117: -284, 118: -284, 143: -284, 154: -284, 155: 115, 156: -284, 157: -284, 160: -284, 161: -284, 162: -284, 174: -284, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -286, 6: -286, 31: -286, 36: -286, 38: -286, 52: -286, 59: -286, 72: -286, 76: -286, 78: -286, 92: -286, 96: -286, 114: -286, 116: -286, 117: -286, 118: -286, 143: -286, 154: -286, 155: 115, 156: -286, 157: -286, 160: -286, 161: -286, 162: -286, 174: -286, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 6: -65, 36: -65, 38: -65, 59: -65, 114: 618, 117: -65, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 7: 619, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -172, 6: -172, 29: -172, 31: -172, 36: -172, 38: -172, 46: -172, 47: -172, 52: -172, 59: -172, 68: -172, 72: -172, 76: -172, 78: -172, 87: -172, 88: -172, 89: -172, 90: -172, 91: -172, 92: -172, 93: -172, 96: -172, 107: -172, 114: -172, 116: -172, 117: -172, 118: -172, 135: -172, 136: -172, 143: -172, 154: -172, 156: -172, 157: -172, 160: -172, 161: -172, 162: -172, 174: -172, 175: -172, 180: -172, 181: -172, 184: -172, 185: -172, 186: -172, 187: -172, 188: -172, 189: -172, 190: -172, 191: -172, 192: -172, 193: -172, 194: -172, 195: -172, 196: -172, 197: -172 }, { 28: 245, 40: 93, 41: 246, 42: 229, 43: 243, 44: 89, 45: 90, 46: 94, 47: 95, 69: 620, 70: 519, 71: 248, 73: 240, 74: 247, 75: 241, 77: 242, 78: 249 }, { 6: -173, 28: 245, 36: -173, 38: -173, 40: 93, 41: 246, 42: 229, 43: 243, 44: 89, 45: 90, 46: 94, 47: 95, 59: -173, 69: 244, 70: 519, 71: 248, 73: 240, 74: 247, 75: 241, 77: 242, 78: 249, 117: -173, 120: 621 }, { 6: -175, 36: -175, 38: -175, 59: -175, 117: -175 }, { 6: -63, 36: -63, 38: -63, 59: -63, 72: 622, 117: -63 }, { 6: -67, 36: -67, 38: -67, 59: -67, 114: 116, 117: -67, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 7: 623, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 6: -73, 36: -73, 38: -73, 59: -73, 72: -73, 117: -73 }, { 76: 624, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 29: 226, 85: 625 }, { 29: 226, 85: 626 }, { 41: 627, 42: 229 }, { 41: 628, 42: 229 }, { 6: -91, 29: -91, 36: -91, 38: -91, 41: 629, 42: 229, 59: -91, 87: -91, 88: -91, 89: -91, 90: -91, 91: -91, 93: -91, 117: -91, 136: -91 }, { 6: -92, 29: -92, 36: -92, 38: -92, 41: 630, 42: 229, 59: -92, 87: -92, 88: -92, 89: -92, 90: -92, 91: -92, 93: -92, 117: -92, 136: -92 }, { 7: 631, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 36: 632, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 91: 633 }, { 29: 226, 85: 634 }, { 6: -84, 29: -84, 36: -84, 38: -84, 59: -84, 87: -84, 88: -84, 89: -84, 90: -84, 91: -84, 93: -84, 117: -84, 136: -84 }, { 46: -44, 47: -44, 49: -44, 51: -44 }, { 6: 96, 38: 635 }, { 1: -375, 6: -375, 31: -375, 36: -375, 38: -375, 52: -375, 59: -375, 72: -375, 76: -375, 78: -375, 92: -375, 96: -375, 114: -375, 116: -375, 117: -375, 118: -375, 143: -375, 154: -375, 155: 115, 156: -375, 157: -375, 160: -375, 161: -375, 162: -375, 174: -375, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -308, 6: -308, 31: -308, 36: -308, 38: -308, 52: -308, 59: -308, 72: -308, 76: -308, 78: -308, 92: -308, 96: -308, 114: -308, 116: -308, 117: -308, 118: 636, 143: -308, 154: -308, 155: 115, 156: -308, 157: -308, 160: -308, 161: 637, 162: -308, 174: -308, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -313, 6: -313, 31: -313, 36: -313, 38: -313, 52: -313, 59: -313, 72: -313, 76: -313, 78: -313, 92: -313, 96: -313, 114: -313, 116: -313, 117: -313, 118: 638, 143: -313, 154: -313, 155: 115, 156: -313, 157: -313, 160: -313, 161: -313, 162: -313, 174: -313, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -317, 6: -317, 31: -317, 36: -317, 38: -317, 52: -317, 59: -317, 72: -317, 76: -317, 78: -317, 92: -317, 96: -317, 114: -317, 116: -317, 117: -317, 118: 639, 143: -317, 154: -317, 155: 115, 156: -317, 157: -317, 160: -317, 161: -317, 162: -317, 174: -317, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 7: 640, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 641, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -322, 6: -322, 31: -322, 36: -322, 38: -322, 52: -322, 59: -322, 72: -322, 76: -322, 78: -322, 92: -322, 96: -322, 114: -322, 116: -322, 117: -322, 118: -322, 143: -322, 154: -322, 155: 115, 156: -322, 157: -322, 160: -322, 161: -322, 162: -322, 174: -322, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 38: -244, 92: -244, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 92: 642 }, { 92: 643 }, { 92: -50, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -135, 6: -135, 29: -135, 31: -135, 36: -135, 38: -135, 46: -135, 47: -135, 52: -135, 59: -135, 68: -135, 72: -135, 76: -135, 78: -135, 87: -135, 88: -135, 89: -135, 90: -135, 91: -135, 92: -135, 93: -135, 96: -135, 107: -135, 114: -135, 116: -135, 117: -135, 118: -135, 122: -135, 135: -135, 136: -135, 143: -135, 154: -135, 156: -135, 157: -135, 160: -135, 161: -135, 162: -135, 174: -135, 175: -135, 180: -135, 181: -135, 182: -135, 183: -135, 184: -135, 185: -135, 186: -135, 187: -135, 188: -135, 189: -135, 190: -135, 191: -135, 192: -135, 193: -135, 194: -135, 195: -135, 196: -135, 197: -135, 198: -135 }, { 38: 644, 78: 294, 114: 116, 142: 421, 143: 293, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 38: 645 }, { 1: -137, 6: -137, 29: -137, 31: -137, 36: -137, 38: -137, 46: -137, 47: -137, 52: -137, 59: -137, 68: -137, 72: -137, 76: -137, 78: -137, 87: -137, 88: -137, 89: -137, 90: -137, 91: -137, 92: -137, 93: -137, 96: -137, 107: -137, 114: -137, 116: -137, 117: -137, 118: -137, 122: -137, 135: -137, 136: -137, 143: -137, 154: -137, 156: -137, 157: -137, 160: -137, 161: -137, 162: -137, 174: -137, 175: -137, 180: -137, 181: -137, 182: -137, 183: -137, 184: -137, 185: -137, 186: -137, 187: -137, 188: -137, 189: -137, 190: -137, 191: -137, 192: -137, 193: -137, 194: -137, 195: -137, 196: -137, 197: -137, 198: -137 }, { 1: -139, 6: -139, 29: -139, 31: -139, 36: -139, 38: -139, 46: -139, 47: -139, 52: -139, 59: -139, 68: -139, 72: -139, 76: -139, 78: -139, 87: -139, 88: -139, 89: -139, 90: -139, 91: -139, 92: -139, 93: -139, 96: -139, 107: -139, 114: -139, 116: -139, 117: -139, 118: -139, 122: -139, 135: -139, 136: -139, 143: -139, 154: -139, 156: -139, 157: -139, 160: -139, 161: -139, 162: -139, 174: -139, 175: -139, 180: -139, 181: -139, 182: -139, 183: -139, 184: -139, 185: -139, 186: -139, 187: -139, 188: -139, 189: -139, 190: -139, 191: -139, 192: -139, 193: -139, 194: -139, 195: -139, 196: -139, 197: -139, 198: -139 }, { 38: 646, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 92: 647 }, { 1: -149, 6: -149, 29: -149, 31: -149, 36: -149, 38: -149, 46: -149, 47: -149, 52: -149, 59: -149, 68: -149, 72: -149, 76: -149, 78: -149, 87: -149, 88: -149, 89: -149, 90: -149, 91: -149, 92: -149, 93: -149, 96: -149, 107: -149, 114: -149, 116: -149, 117: -149, 118: -149, 122: -149, 135: -149, 136: -149, 143: -149, 154: -149, 156: -149, 157: -149, 160: -149, 161: -149, 162: -149, 174: -149, 175: -149, 180: -149, 181: -149, 182: -149, 183: -149, 184: -149, 185: -149, 186: -149, 187: -149, 188: -149, 189: -149, 190: -149, 191: -149, 192: -149, 193: -149, 194: -149, 195: -149, 196: -149, 197: -149, 198: -149 }, { 38: 648, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -62, 6: -62, 31: -62, 36: -62, 38: -62, 52: -62, 59: -62, 72: -62, 76: -62, 78: -62, 92: -62, 96: -62, 114: -62, 116: -62, 117: -62, 118: -62, 143: -62, 154: -62, 156: -62, 157: -62, 160: -62, 161: -62, 162: -62, 174: -62, 175: -62, 180: -62, 181: -62, 184: -62, 185: -62, 186: -62, 187: -62, 188: -62, 189: -62, 190: -62, 191: -62, 192: -62, 193: -62, 194: -62, 195: -62, 196: -62, 197: -62 }, { 1: -100, 6: -100, 29: -100, 31: -100, 36: -100, 38: -100, 46: -100, 47: -100, 52: -100, 59: -100, 72: -100, 76: -100, 78: -100, 87: -100, 88: -100, 89: -100, 90: -100, 91: -100, 92: -100, 93: -100, 96: -100, 107: -100, 114: -100, 116: -100, 117: -100, 118: -100, 135: -100, 136: -100, 143: -100, 154: -100, 156: -100, 157: -100, 160: -100, 161: -100, 162: -100, 174: -100, 175: -100, 180: -100, 181: -100, 184: -100, 185: -100, 186: -100, 187: -100, 188: -100, 189: -100, 190: -100, 191: -100, 192: -100, 193: -100, 194: -100, 195: -100, 196: -100, 197: -100 }, { 1: -102, 6: -102, 31: -102, 36: -102, 38: -102, 52: -102, 59: -102, 76: -102, 154: -102 }, { 6: -111, 31: -111, 36: -111, 38: -111, 59: -111, 96: -111 }, { 6: -106, 31: -106, 36: -106, 38: -106, 59: 308, 76: -106, 100: 649, 117: -106 }, { 32: 557, 36: 149 }, { 1: -377, 6: -377, 31: -377, 36: -377, 38: -377, 52: -377, 59: -377, 72: -377, 76: -377, 78: -377, 92: -377, 96: -377, 114: -377, 116: -377, 117: -377, 118: -377, 143: -377, 154: -377, 156: -377, 157: -377, 160: -377, 161: -377, 162: -377, 174: -377, 175: -377, 180: -377, 181: -377, 184: -377, 185: -377, 186: -377, 187: -377, 188: -377, 189: -377, 190: -377, 191: -377, 192: -377, 193: -377, 194: -377, 195: -377, 196: -377, 197: -377 }, { 1: -336, 6: -336, 31: -336, 36: -336, 38: -336, 52: -336, 59: -336, 72: -336, 76: -336, 78: -336, 92: -336, 96: -336, 114: -336, 116: -336, 117: -336, 118: -336, 143: -336, 154: -336, 156: -336, 157: -336, 160: -336, 161: -336, 162: -336, 167: -336, 174: -336, 175: -336, 180: -336, 181: -336, 184: -336, 185: -336, 186: -336, 187: -336, 188: -336, 189: -336, 190: -336, 191: -336, 192: -336, 193: -336, 194: -336, 195: -336, 196: -336, 197: -336 }, { 1: -275, 6: -275, 31: -275, 36: -275, 38: -275, 52: -275, 59: -275, 72: -275, 76: -275, 78: -275, 92: -275, 96: -275, 114: -275, 116: -275, 117: -275, 118: -275, 143: -275, 154: -275, 156: -275, 157: -275, 160: -275, 161: -275, 162: -275, 174: -275, 175: -275, 180: -275, 181: -275, 184: -275, 185: -275, 186: -275, 187: -275, 188: -275, 189: -275, 190: -275, 191: -275, 192: -275, 193: -275, 194: -275, 195: -275, 196: -275, 197: -275 }, { 1: -276, 6: -276, 31: -276, 36: -276, 38: -276, 52: -276, 59: -276, 72: -276, 76: -276, 78: -276, 92: -276, 96: -276, 114: -276, 116: -276, 117: -276, 118: -276, 143: -276, 150: -276, 154: -276, 156: -276, 157: -276, 160: -276, 161: -276, 162: -276, 174: -276, 175: -276, 180: -276, 181: -276, 184: -276, 185: -276, 186: -276, 187: -276, 188: -276, 189: -276, 190: -276, 191: -276, 192: -276, 193: -276, 194: -276, 195: -276, 196: -276, 197: -276 }, { 1: -277, 6: -277, 31: -277, 36: -277, 38: -277, 52: -277, 59: -277, 72: -277, 76: -277, 78: -277, 92: -277, 96: -277, 114: -277, 116: -277, 117: -277, 118: -277, 143: -277, 150: -277, 154: -277, 156: -277, 157: -277, 160: -277, 161: -277, 162: -277, 174: -277, 175: -277, 180: -277, 181: -277, 184: -277, 185: -277, 186: -277, 187: -277, 188: -277, 189: -277, 190: -277, 191: -277, 192: -277, 193: -277, 194: -277, 195: -277, 196: -277, 197: -277 }, { 1: -293, 6: -293, 31: -293, 36: -293, 38: -293, 52: -293, 59: -293, 72: -293, 76: -293, 78: -293, 92: -293, 96: -293, 114: -293, 116: -293, 117: -293, 118: -293, 143: -293, 154: -293, 156: -293, 157: -293, 160: -293, 161: -293, 162: -293, 174: -293, 175: -293, 180: -293, 181: -293, 184: -293, 185: -293, 186: -293, 187: -293, 188: -293, 189: -293, 190: -293, 191: -293, 192: -293, 193: -293, 194: -293, 195: -293, 196: -293, 197: -293 }, { 7: 650, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 651, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -298, 6: -298, 31: -298, 36: -298, 38: -298, 52: -298, 59: -298, 72: -298, 76: -298, 78: -298, 92: -298, 96: -298, 114: -298, 116: -298, 117: -298, 118: -298, 143: -298, 154: -298, 156: -298, 157: -298, 160: -298, 161: -298, 162: -298, 174: -298, 175: -298, 180: -298, 181: -298, 184: -298, 185: -298, 186: -298, 187: -298, 188: -298, 189: -298, 190: -298, 191: -298, 192: -298, 193: -298, 194: -298, 195: -298, 196: -298, 197: -298 }, { 7: 652, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -302, 6: -302, 31: -302, 36: -302, 38: -302, 52: -302, 59: -302, 72: -302, 76: -302, 78: -302, 92: -302, 96: -302, 114: -302, 116: -302, 117: -302, 118: -302, 143: -302, 154: -302, 156: -302, 157: -302, 160: -302, 161: -302, 162: -302, 174: -302, 175: -302, 180: -302, 181: -302, 184: -302, 185: -302, 186: -302, 187: -302, 188: -302, 189: -302, 190: -302, 191: -302, 192: -302, 193: -302, 194: -302, 195: -302, 196: -302, 197: -302 }, { 7: 653, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 32: 654, 36: 149, 114: 116, 118: 655, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 32: 656, 36: 149, 114: 116, 118: 657, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -307, 6: -307, 31: -307, 36: -307, 38: -307, 52: -307, 59: -307, 72: -307, 76: -307, 78: -307, 92: -307, 96: -307, 114: -307, 116: -307, 117: -307, 118: -307, 143: -307, 154: -307, 156: -307, 157: -307, 160: -307, 161: -307, 162: -307, 174: -307, 175: -307, 180: -307, 181: -307, 184: -307, 185: -307, 186: -307, 187: -307, 188: -307, 189: -307, 190: -307, 191: -307, 192: -307, 193: -307, 194: -307, 195: -307, 196: -307, 197: -307 }, { 1: -327, 6: -327, 31: -327, 36: -327, 38: -327, 52: -327, 59: -327, 72: -327, 76: -327, 78: -327, 92: -327, 96: -327, 114: -327, 116: -327, 117: -327, 118: -327, 143: -327, 154: -327, 156: -327, 157: -327, 160: -327, 161: -327, 162: -327, 174: -327, 175: -327, 180: -327, 181: -327, 184: -327, 185: -327, 186: -327, 187: -327, 188: -327, 189: -327, 190: -327, 191: -327, 192: -327, 193: -327, 194: -327, 195: -327, 196: -327, 197: -327 }, { 32: 658, 36: 149 }, { 38: 659 }, { 6: 660, 38: -333, 167: -333, 169: -333 }, { 7: 661, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -185, 6: -185, 31: -185, 36: -185, 38: -185, 52: -185, 59: -185, 72: -185, 76: -185, 78: -185, 92: -185, 96: -185, 114: -185, 116: -185, 117: -185, 118: -185, 143: -185, 154: -185, 156: -185, 157: -185, 160: -185, 161: -185, 162: -185, 174: -185, 175: -185, 180: -185, 181: -185, 184: -185, 185: -185, 186: -185, 187: -185, 188: -185, 189: -185, 190: -185, 191: -185, 192: -185, 193: -185, 194: -185, 195: -185, 196: -185, 197: -185 }, { 32: 662, 36: 149 }, { 45: 663, 46: 94, 47: 95 }, { 6: -106, 31: -106, 36: -106, 38: -106, 59: 481, 76: -106, 100: 664, 117: -106 }, { 1: -189, 6: -189, 31: -189, 36: -189, 38: -189, 52: -189, 59: -189, 76: -189, 154: -189, 156: -189, 157: -189, 174: -189, 175: -189 }, { 39: 665 }, { 28: 354, 40: 93, 127: 666, 129: 355 }, { 28: 354, 36: 353, 40: 93, 126: 667, 127: 352, 129: 355 }, { 6: -194, 36: -194, 38: -194, 59: -194, 117: -194 }, { 6: 588, 36: 589, 38: 668 }, { 6: -199, 36: -199, 38: -199, 59: -199, 117: -199 }, { 6: -201, 36: -201, 38: -201, 59: -201, 117: -201 }, { 1: -214, 6: -214, 31: -214, 36: -214, 38: -214, 52: -214, 59: -214, 76: -214, 154: -214, 156: -214, 157: -214, 174: -214, 175: -214 }, { 1: -205, 6: -205, 31: -205, 36: -205, 38: -205, 39: 669, 52: -205, 59: -205, 76: -205, 154: -205, 156: -205, 157: -205, 174: -205, 175: -205 }, { 28: 361, 40: 93, 129: 362, 134: 670 }, { 28: 361, 36: 360, 40: 93, 129: 362, 132: 671, 134: 359 }, { 6: -217, 36: -217, 38: -217, 59: -217, 117: -217 }, { 6: 596, 36: 597, 38: 672 }, { 6: -222, 36: -222, 38: -222, 59: -222, 117: -222 }, { 6: -223, 36: -223, 38: -223, 59: -223, 117: -223 }, { 6: -225, 36: -225, 38: -225, 59: -225, 117: -225 }, { 1: -209, 6: -209, 31: -209, 36: -209, 38: -209, 52: -209, 59: -209, 76: -209, 114: 116, 154: -209, 155: 115, 156: -209, 157: -209, 174: -209, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 38: 673, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -212, 6: -212, 31: -212, 36: -212, 38: -212, 52: -212, 59: -212, 76: -212, 154: -212, 156: -212, 157: -212, 174: -212, 175: -212 }, { 1: -282, 6: -282, 29: -282, 31: -282, 36: -282, 38: -282, 46: -282, 47: -282, 52: -282, 59: -282, 72: -282, 76: -282, 78: -282, 87: -282, 88: -282, 89: -282, 90: -282, 91: -282, 92: -282, 93: -282, 96: -282, 107: -282, 114: -282, 116: -282, 117: -282, 118: -282, 135: -282, 136: -282, 143: -282, 154: -282, 156: -282, 157: -282, 160: -282, 161: -282, 162: -282, 174: -282, 175: -282, 180: -282, 181: -282, 184: -282, 185: -282, 186: -282, 187: -282, 188: -282, 189: -282, 190: -282, 191: -282, 192: -282, 193: -282, 194: -282, 195: -282, 196: -282, 197: -282 }, { 1: -243, 6: -243, 29: -243, 31: -243, 36: -243, 38: -243, 46: -243, 47: -243, 52: -243, 59: -243, 72: -243, 76: -243, 78: -243, 87: -243, 88: -243, 89: -243, 90: -243, 91: -243, 92: -243, 93: -243, 96: -243, 107: -243, 114: -243, 116: -243, 117: -243, 118: -243, 135: -243, 136: -243, 143: -243, 154: -243, 156: -243, 157: -243, 160: -243, 161: -243, 162: -243, 174: -243, 175: -243, 180: -243, 181: -243, 184: -243, 185: -243, 186: -243, 187: -243, 188: -243, 189: -243, 190: -243, 191: -243, 192: -243, 193: -243, 194: -243, 195: -243, 196: -243, 197: -243 }, { 6: -106, 31: -106, 36: -106, 38: -106, 59: 374, 76: -106, 100: 375, 117: -106, 141: 674 }, { 6: -259, 36: -259, 38: -259, 59: -259, 76: -259 }, { 6: -260, 36: -260, 38: -260, 59: -260, 76: -260 }, { 92: 675 }, { 1: -234, 6: -234, 29: -234, 31: -234, 36: -234, 38: -234, 46: -234, 47: -234, 52: -234, 57: -234, 59: -234, 72: -234, 76: -234, 78: -234, 87: -234, 88: -234, 89: -234, 90: -234, 91: -234, 92: -234, 93: -234, 96: -234, 107: -234, 114: -234, 116: -234, 117: -234, 118: -234, 135: -234, 136: -234, 143: -234, 154: -234, 156: -234, 157: -234, 160: -234, 161: -234, 162: -234, 174: -234, 175: -234, 180: -234, 181: -234, 184: -234, 185: -234, 186: -234, 187: -234, 188: -234, 189: -234, 190: -234, 191: -234, 192: -234, 193: -234, 194: -234, 195: -234, 196: -234, 197: -234 }, { 7: 312, 8: 220, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 33: 20, 34: 21, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 78: 222, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 104: 221, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 144: 676, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 312, 8: 220, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 33: 20, 34: 21, 35: 55, 36: 386, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 78: 222, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 35, 97: 36, 98: 79, 99: 80, 103: 61, 104: 221, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 137: 677, 138: 75, 144: 385, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 37, 177: 38, 178: 57, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 6: -249, 31: -249, 36: -249, 38: -249, 59: -249 }, { 6: 613, 36: 614, 38: 678 }, { 1: -338, 6: -338, 31: -338, 36: -338, 38: -338, 52: -338, 59: -338, 72: -338, 76: -338, 78: -338, 92: -338, 96: -338, 114: -338, 116: -338, 117: -338, 118: -338, 143: -338, 154: -338, 156: -338, 157: -338, 160: -338, 161: -338, 162: -338, 174: -338, 175: -338, 180: -338, 181: -338, 184: -338, 185: -338, 186: -338, 187: -338, 188: -338, 189: -338, 190: -338, 191: -338, 192: -338, 193: -338, 194: -338, 195: -338, 196: -338, 197: -338 }, { 28: 141, 37: 144, 40: 93, 74: 142, 75: 72, 77: 145, 102: 181, 103: 143, 108: 277, 113: 88, 115: 679, 119: 680, 163: 276, 164: 180 }, { 38: 681, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 6: -176, 36: -176, 38: -176, 59: -176, 117: -176 }, { 6: -106, 31: -106, 36: -106, 38: -106, 59: 395, 76: -106, 100: 682, 117: -106 }, { 7: 683, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 36: 514, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 38: 684, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 6: -74, 36: -74, 38: -74, 59: -74, 72: -74, 117: -74 }, { 6: -85, 29: -85, 36: -85, 38: -85, 59: -85, 87: -85, 88: -85, 89: -85, 90: -85, 91: -85, 93: -85, 117: -85, 136: -85 }, { 6: -86, 29: -86, 36: -86, 38: -86, 59: -86, 87: -86, 88: -86, 89: -86, 90: -86, 91: -86, 93: -86, 117: -86, 136: -86 }, { 6: -87, 29: -87, 36: -87, 38: -87, 59: -87, 87: -87, 88: -87, 89: -87, 90: -87, 91: -87, 93: -87, 117: -87, 136: -87 }, { 6: -88, 29: -88, 36: -88, 38: -88, 59: -88, 87: -88, 88: -88, 89: -88, 90: -88, 91: -88, 93: -88, 117: -88, 136: -88 }, { 6: -89, 29: -89, 36: -89, 38: -89, 59: -89, 87: -89, 88: -89, 89: -89, 90: -89, 91: -89, 93: -89, 117: -89, 136: -89 }, { 6: -90, 29: -90, 36: -90, 38: -90, 59: -90, 87: -90, 88: -90, 89: -90, 90: -90, 91: -90, 93: -90, 117: -90, 136: -90 }, { 92: 685, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 7: 686, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 687, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 36: 688, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 6: -83, 29: -83, 36: -83, 38: -83, 59: -83, 87: -83, 88: -83, 89: -83, 90: -83, 91: -83, 93: -83, 117: -83, 136: -83 }, { 52: 689 }, { 7: 690, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 691, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 692, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 693, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -315, 6: -315, 31: -315, 36: -315, 38: -315, 52: -315, 59: -315, 72: -315, 76: -315, 78: -315, 92: -315, 96: -315, 114: -315, 116: -315, 117: -315, 118: 694, 143: -315, 154: -315, 155: 115, 156: -315, 157: -315, 160: -315, 161: -315, 162: -315, 174: -315, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -319, 6: -319, 31: -319, 36: -319, 38: -319, 52: -319, 59: -319, 72: -319, 76: -319, 78: -319, 92: -319, 96: -319, 114: -319, 116: -319, 117: -319, 118: 695, 143: -319, 154: -319, 155: 115, 156: -319, 157: -319, 160: -319, 161: -319, 162: -319, 174: -319, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -131, 6: -131, 29: -131, 31: -131, 36: -131, 38: -131, 46: -131, 47: -131, 52: -131, 59: -131, 68: -131, 72: -131, 76: -131, 78: -131, 87: -131, 88: -131, 89: -131, 90: -131, 91: -131, 92: -131, 93: -131, 96: -131, 107: -131, 114: -131, 116: -131, 117: -131, 118: -131, 122: -131, 135: -131, 136: -131, 143: -131, 154: -131, 156: -131, 157: -131, 160: -131, 161: -131, 162: -131, 174: -131, 175: -131, 180: -131, 181: -131, 182: -131, 183: -131, 184: -131, 185: -131, 186: -131, 187: -131, 188: -131, 189: -131, 190: -131, 191: -131, 192: -131, 193: -131, 194: -131, 195: -131, 196: -131, 197: -131, 198: -131 }, { 1: -133, 6: -133, 29: -133, 31: -133, 36: -133, 38: -133, 46: -133, 47: -133, 52: -133, 59: -133, 68: -133, 72: -133, 76: -133, 78: -133, 87: -133, 88: -133, 89: -133, 90: -133, 91: -133, 92: -133, 93: -133, 96: -133, 107: -133, 114: -133, 116: -133, 117: -133, 118: -133, 122: -133, 135: -133, 136: -133, 143: -133, 154: -133, 156: -133, 157: -133, 160: -133, 161: -133, 162: -133, 174: -133, 175: -133, 180: -133, 181: -133, 182: -133, 183: -133, 184: -133, 185: -133, 186: -133, 187: -133, 188: -133, 189: -133, 190: -133, 191: -133, 192: -133, 193: -133, 194: -133, 195: -133, 196: -133, 197: -133, 198: -133 }, { 92: 696 }, { 92: 697 }, { 92: 698 }, { 1: -148, 6: -148, 29: -148, 31: -148, 36: -148, 38: -148, 46: -148, 47: -148, 52: -148, 59: -148, 68: -148, 72: -148, 76: -148, 78: -148, 87: -148, 88: -148, 89: -148, 90: -148, 91: -148, 92: -148, 93: -148, 96: -148, 107: -148, 114: -148, 116: -148, 117: -148, 118: -148, 122: -148, 135: -148, 136: -148, 143: -148, 154: -148, 156: -148, 157: -148, 160: -148, 161: -148, 162: -148, 174: -148, 175: -148, 180: -148, 181: -148, 182: -148, 183: -148, 184: -148, 185: -148, 186: -148, 187: -148, 188: -148, 189: -148, 190: -148, 191: -148, 192: -148, 193: -148, 194: -148, 195: -148, 196: -148, 197: -148, 198: -148 }, { 92: 699 }, { 6: 441, 36: 442, 38: 700 }, { 32: 701, 36: 149, 114: 116, 155: 115, 156: 85, 157: 86, 161: 702, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 32: 703, 36: 149, 114: 116, 118: 704, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 32: 705, 36: 149, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 32: 706, 36: 149, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -300, 6: -300, 31: -300, 36: -300, 38: -300, 52: -300, 59: -300, 72: -300, 76: -300, 78: -300, 92: -300, 96: -300, 114: -300, 116: -300, 117: -300, 118: -300, 143: -300, 154: -300, 156: -300, 157: -300, 160: -300, 161: -300, 162: -300, 174: -300, 175: -300, 180: -300, 181: -300, 184: -300, 185: -300, 186: -300, 187: -300, 188: -300, 189: -300, 190: -300, 191: -300, 192: -300, 193: -300, 194: -300, 195: -300, 196: -300, 197: -300 }, { 7: 707, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -304, 6: -304, 31: -304, 36: -304, 38: -304, 52: -304, 59: -304, 72: -304, 76: -304, 78: -304, 92: -304, 96: -304, 114: -304, 116: -304, 117: -304, 118: -304, 143: -304, 154: -304, 156: -304, 157: -304, 160: -304, 161: -304, 162: -304, 174: -304, 175: -304, 180: -304, 181: -304, 184: -304, 185: -304, 186: -304, 187: -304, 188: -304, 189: -304, 190: -304, 191: -304, 192: -304, 193: -304, 194: -304, 195: -304, 196: -304, 197: -304 }, { 7: 708, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 38: 709 }, { 1: -330, 6: -330, 31: -330, 36: -330, 38: -330, 52: -330, 59: -330, 72: -330, 76: -330, 78: -330, 92: -330, 96: -330, 114: -330, 116: -330, 117: -330, 118: -330, 143: -330, 154: -330, 156: -330, 157: -330, 160: -330, 161: -330, 162: -330, 174: -330, 175: -330, 180: -330, 181: -330, 184: -330, 185: -330, 186: -330, 187: -330, 188: -330, 189: -330, 190: -330, 191: -330, 192: -330, 193: -330, 194: -330, 195: -330, 196: -330, 197: -330 }, { 38: -334, 167: -334, 169: -334 }, { 36: -271, 59: -271, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -26, 6: -26, 31: -26, 36: -26, 38: -26, 52: -26, 59: -26, 72: -26, 76: -26, 78: -26, 92: -26, 96: -26, 114: -26, 116: -26, 117: -26, 118: -26, 143: -26, 154: -26, 156: -26, 157: -26, 160: -26, 161: -26, 162: -26, 174: -26, 175: -26, 180: -26, 181: -26, 184: -26, 185: -26, 186: -26, 187: -26, 188: -26, 189: -26, 190: -26, 191: -26, 192: -26, 193: -26, 194: -26, 195: -26, 196: -26, 197: -26 }, { 1: -191, 6: -191, 31: -191, 36: -191, 38: -191, 52: -191, 59: -191, 76: -191, 154: -191, 156: -191, 157: -191, 174: -191, 175: -191 }, { 6: 588, 36: 589, 117: 710 }, { 45: 711, 46: 94, 47: 95 }, { 6: -195, 36: -195, 38: -195, 59: -195, 117: -195 }, { 6: -106, 31: -106, 36: -106, 38: -106, 59: 481, 76: -106, 100: 712, 117: -106 }, { 6: -196, 36: -196, 38: -196, 59: -196, 117: -196 }, { 45: 713, 46: 94, 47: 95 }, { 6: -218, 36: -218, 38: -218, 59: -218, 117: -218 }, { 6: -106, 31: -106, 36: -106, 38: -106, 59: 488, 76: -106, 100: 714, 117: -106 }, { 6: -219, 36: -219, 38: -219, 59: -219, 117: -219 }, { 1: -210, 6: -210, 31: -210, 36: -210, 38: -210, 52: -210, 59: -210, 76: -210, 154: -210, 156: -210, 157: -210, 174: -210, 175: -210 }, { 36: 500, 38: 715 }, { 1: -165, 6: -165, 29: -165, 31: -165, 36: -165, 38: -165, 46: -165, 47: -165, 52: -165, 59: -165, 72: -165, 76: -165, 78: -165, 87: -165, 88: -165, 89: -165, 90: -165, 91: -165, 92: -165, 93: -165, 96: -165, 107: -165, 114: -165, 116: -165, 117: -165, 118: -165, 135: -165, 136: -165, 143: -165, 154: -165, 156: -165, 157: -165, 160: -165, 161: -165, 162: -165, 174: -165, 175: -165, 180: -165, 181: -165, 184: -165, 185: -165, 186: -165, 187: -165, 188: -165, 189: -165, 190: -165, 191: -165, 192: -165, 193: -165, 194: -165, 195: -165, 196: -165, 197: -165 }, { 6: -250, 31: -250, 36: -250, 38: -250, 59: -250 }, { 6: -106, 31: -106, 36: -106, 38: -106, 59: 508, 76: -106, 100: 716, 117: -106 }, { 6: -251, 31: -251, 36: -251, 38: -251, 59: -251 }, { 116: 717, 160: 414, 162: 416 }, { 28: 141, 37: 144, 40: 93, 74: 142, 75: 146, 77: 145, 102: 181, 103: 143, 113: 88, 115: 718, 164: 180 }, { 6: -66, 36: -66, 38: -66, 59: -66, 117: -66 }, { 6: 516, 36: 517, 38: 719 }, { 6: -65, 36: -65, 38: -65, 59: -65, 114: 116, 117: -65, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 6: -68, 36: -68, 38: -68, 59: -68, 117: -68 }, { 6: -93, 29: -93, 36: -93, 38: -93, 59: -93, 87: -93, 88: -93, 89: -93, 90: -93, 91: -93, 93: -93, 117: -93, 136: -93 }, { 38: 720, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 92: 721, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 7: 722, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 46: -45, 47: -45, 49: -45, 51: -45 }, { 1: -309, 6: -309, 31: -309, 36: -309, 38: -309, 52: -309, 59: -309, 72: -309, 76: -309, 78: -309, 92: -309, 96: -309, 114: -309, 116: -309, 117: -309, 118: -309, 143: -309, 154: -309, 155: 115, 156: -309, 157: -309, 160: -309, 161: 723, 162: -309, 174: -309, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -310, 6: -310, 31: -310, 36: -310, 38: -310, 52: -310, 59: -310, 72: -310, 76: -310, 78: -310, 92: -310, 96: -310, 114: -310, 116: -310, 117: -310, 118: 724, 143: -310, 154: -310, 155: 115, 156: -310, 157: -310, 160: -310, 161: -310, 162: -310, 174: -310, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -314, 6: -314, 31: -314, 36: -314, 38: -314, 52: -314, 59: -314, 72: -314, 76: -314, 78: -314, 92: -314, 96: -314, 114: -314, 116: -314, 117: -314, 118: -314, 143: -314, 154: -314, 155: 115, 156: -314, 157: -314, 160: -314, 161: -314, 162: -314, 174: -314, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -318, 6: -318, 31: -318, 36: -318, 38: -318, 52: -318, 59: -318, 72: -318, 76: -318, 78: -318, 92: -318, 96: -318, 114: -318, 116: -318, 117: -318, 118: -318, 143: -318, 154: -318, 155: 115, 156: -318, 157: -318, 160: -318, 161: -318, 162: -318, 174: -318, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 7: 725, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 726, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -136, 6: -136, 29: -136, 31: -136, 36: -136, 38: -136, 46: -136, 47: -136, 52: -136, 59: -136, 68: -136, 72: -136, 76: -136, 78: -136, 87: -136, 88: -136, 89: -136, 90: -136, 91: -136, 92: -136, 93: -136, 96: -136, 107: -136, 114: -136, 116: -136, 117: -136, 118: -136, 122: -136, 135: -136, 136: -136, 143: -136, 154: -136, 156: -136, 157: -136, 160: -136, 161: -136, 162: -136, 174: -136, 175: -136, 180: -136, 181: -136, 182: -136, 183: -136, 184: -136, 185: -136, 186: -136, 187: -136, 188: -136, 189: -136, 190: -136, 191: -136, 192: -136, 193: -136, 194: -136, 195: -136, 196: -136, 197: -136, 198: -136 }, { 1: -138, 6: -138, 29: -138, 31: -138, 36: -138, 38: -138, 46: -138, 47: -138, 52: -138, 59: -138, 68: -138, 72: -138, 76: -138, 78: -138, 87: -138, 88: -138, 89: -138, 90: -138, 91: -138, 92: -138, 93: -138, 96: -138, 107: -138, 114: -138, 116: -138, 117: -138, 118: -138, 122: -138, 135: -138, 136: -138, 143: -138, 154: -138, 156: -138, 157: -138, 160: -138, 161: -138, 162: -138, 174: -138, 175: -138, 180: -138, 181: -138, 182: -138, 183: -138, 184: -138, 185: -138, 186: -138, 187: -138, 188: -138, 189: -138, 190: -138, 191: -138, 192: -138, 193: -138, 194: -138, 195: -138, 196: -138, 197: -138, 198: -138 }, { 1: -140, 6: -140, 29: -140, 31: -140, 36: -140, 38: -140, 46: -140, 47: -140, 52: -140, 59: -140, 68: -140, 72: -140, 76: -140, 78: -140, 87: -140, 88: -140, 89: -140, 90: -140, 91: -140, 92: -140, 93: -140, 96: -140, 107: -140, 114: -140, 116: -140, 117: -140, 118: -140, 122: -140, 135: -140, 136: -140, 143: -140, 154: -140, 156: -140, 157: -140, 160: -140, 161: -140, 162: -140, 174: -140, 175: -140, 180: -140, 181: -140, 182: -140, 183: -140, 184: -140, 185: -140, 186: -140, 187: -140, 188: -140, 189: -140, 190: -140, 191: -140, 192: -140, 193: -140, 194: -140, 195: -140, 196: -140, 197: -140, 198: -140 }, { 1: -150, 6: -150, 29: -150, 31: -150, 36: -150, 38: -150, 46: -150, 47: -150, 52: -150, 59: -150, 68: -150, 72: -150, 76: -150, 78: -150, 87: -150, 88: -150, 89: -150, 90: -150, 91: -150, 92: -150, 93: -150, 96: -150, 107: -150, 114: -150, 116: -150, 117: -150, 118: -150, 122: -150, 135: -150, 136: -150, 143: -150, 154: -150, 156: -150, 157: -150, 160: -150, 161: -150, 162: -150, 174: -150, 175: -150, 180: -150, 181: -150, 182: -150, 183: -150, 184: -150, 185: -150, 186: -150, 187: -150, 188: -150, 189: -150, 190: -150, 191: -150, 192: -150, 193: -150, 194: -150, 195: -150, 196: -150, 197: -150, 198: -150 }, { 6: -112, 31: -112, 36: -112, 38: -112, 59: -112, 96: -112 }, { 1: -294, 6: -294, 31: -294, 36: -294, 38: -294, 52: -294, 59: -294, 72: -294, 76: -294, 78: -294, 92: -294, 96: -294, 114: -294, 116: -294, 117: -294, 118: -294, 143: -294, 154: -294, 156: -294, 157: -294, 160: -294, 161: -294, 162: -294, 174: -294, 175: -294, 180: -294, 181: -294, 184: -294, 185: -294, 186: -294, 187: -294, 188: -294, 189: -294, 190: -294, 191: -294, 192: -294, 193: -294, 194: -294, 195: -294, 196: -294, 197: -294 }, { 7: 727, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -295, 6: -295, 31: -295, 36: -295, 38: -295, 52: -295, 59: -295, 72: -295, 76: -295, 78: -295, 92: -295, 96: -295, 114: -295, 116: -295, 117: -295, 118: -295, 143: -295, 154: -295, 156: -295, 157: -295, 160: -295, 161: -295, 162: -295, 174: -295, 175: -295, 180: -295, 181: -295, 184: -295, 185: -295, 186: -295, 187: -295, 188: -295, 189: -295, 190: -295, 191: -295, 192: -295, 193: -295, 194: -295, 195: -295, 196: -295, 197: -295 }, { 7: 728, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -299, 6: -299, 31: -299, 36: -299, 38: -299, 52: -299, 59: -299, 72: -299, 76: -299, 78: -299, 92: -299, 96: -299, 114: -299, 116: -299, 117: -299, 118: -299, 143: -299, 154: -299, 156: -299, 157: -299, 160: -299, 161: -299, 162: -299, 174: -299, 175: -299, 180: -299, 181: -299, 184: -299, 185: -299, 186: -299, 187: -299, 188: -299, 189: -299, 190: -299, 191: -299, 192: -299, 193: -299, 194: -299, 195: -299, 196: -299, 197: -299 }, { 1: -303, 6: -303, 31: -303, 36: -303, 38: -303, 52: -303, 59: -303, 72: -303, 76: -303, 78: -303, 92: -303, 96: -303, 114: -303, 116: -303, 117: -303, 118: -303, 143: -303, 154: -303, 156: -303, 157: -303, 160: -303, 161: -303, 162: -303, 174: -303, 175: -303, 180: -303, 181: -303, 184: -303, 185: -303, 186: -303, 187: -303, 188: -303, 189: -303, 190: -303, 191: -303, 192: -303, 193: -303, 194: -303, 195: -303, 196: -303, 197: -303 }, { 32: 729, 36: 149, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 32: 730, 36: 149, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -328, 6: -328, 31: -328, 36: -328, 38: -328, 52: -328, 59: -328, 72: -328, 76: -328, 78: -328, 92: -328, 96: -328, 114: -328, 116: -328, 117: -328, 118: -328, 143: -328, 154: -328, 156: -328, 157: -328, 160: -328, 161: -328, 162: -328, 174: -328, 175: -328, 180: -328, 181: -328, 184: -328, 185: -328, 186: -328, 187: -328, 188: -328, 189: -328, 190: -328, 191: -328, 192: -328, 193: -328, 194: -328, 195: -328, 196: -328, 197: -328 }, { 39: 731 }, { 1: -190, 6: -190, 31: -190, 36: -190, 38: -190, 52: -190, 59: -190, 76: -190, 154: -190, 156: -190, 157: -190, 174: -190, 175: -190 }, { 6: 588, 36: 589, 38: 732 }, { 1: -215, 6: -215, 31: -215, 36: -215, 38: -215, 52: -215, 59: -215, 76: -215, 154: -215, 156: -215, 157: -215, 174: -215, 175: -215 }, { 6: 596, 36: 597, 38: 733 }, { 6: -261, 36: -261, 38: -261, 59: -261, 76: -261 }, { 6: 613, 36: 614, 38: 734 }, { 7: 735, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 116: 736 }, { 6: -177, 36: -177, 38: -177, 59: -177, 117: -177 }, { 92: 737 }, { 6: -95, 29: -95, 36: -95, 38: -95, 59: -95, 87: -95, 88: -95, 89: -95, 90: -95, 91: -95, 93: -95, 117: -95, 136: -95 }, { 38: 738, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 7: 739, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 7: 740, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 1: -316, 6: -316, 31: -316, 36: -316, 38: -316, 52: -316, 59: -316, 72: -316, 76: -316, 78: -316, 92: -316, 96: -316, 114: -316, 116: -316, 117: -316, 118: -316, 143: -316, 154: -316, 155: 115, 156: -316, 157: -316, 160: -316, 161: -316, 162: -316, 174: -316, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -320, 6: -320, 31: -320, 36: -320, 38: -320, 52: -320, 59: -320, 72: -320, 76: -320, 78: -320, 92: -320, 96: -320, 114: -320, 116: -320, 117: -320, 118: -320, 143: -320, 154: -320, 155: 115, 156: -320, 157: -320, 160: -320, 161: -320, 162: -320, 174: -320, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 32: 741, 36: 149, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 32: 742, 36: 149, 114: 116, 155: 115, 156: 85, 157: 86, 174: 113, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -301, 6: -301, 31: -301, 36: -301, 38: -301, 52: -301, 59: -301, 72: -301, 76: -301, 78: -301, 92: -301, 96: -301, 114: -301, 116: -301, 117: -301, 118: -301, 143: -301, 154: -301, 156: -301, 157: -301, 160: -301, 161: -301, 162: -301, 174: -301, 175: -301, 180: -301, 181: -301, 184: -301, 185: -301, 186: -301, 187: -301, 188: -301, 189: -301, 190: -301, 191: -301, 192: -301, 193: -301, 194: -301, 195: -301, 196: -301, 197: -301 }, { 1: -305, 6: -305, 31: -305, 36: -305, 38: -305, 52: -305, 59: -305, 72: -305, 76: -305, 78: -305, 92: -305, 96: -305, 114: -305, 116: -305, 117: -305, 118: -305, 143: -305, 154: -305, 156: -305, 157: -305, 160: -305, 161: -305, 162: -305, 174: -305, 175: -305, 180: -305, 181: -305, 184: -305, 185: -305, 186: -305, 187: -305, 188: -305, 189: -305, 190: -305, 191: -305, 192: -305, 193: -305, 194: -305, 195: -305, 196: -305, 197: -305 }, { 45: 743, 46: 94, 47: 95 }, { 6: -197, 36: -197, 38: -197, 59: -197, 117: -197 }, { 6: -220, 36: -220, 38: -220, 59: -220, 117: -220 }, { 6: -252, 31: -252, 36: -252, 38: -252, 59: -252 }, { 1: -313, 6: -313, 31: -313, 36: -313, 38: -313, 52: -313, 59: 746, 72: -313, 76: -313, 78: -313, 92: -313, 96: -313, 100: 744, 114: -313, 116: -313, 117: -313, 118: 745, 143: -313, 154: -313, 155: 115, 156: -313, 157: -313, 160: -313, 161: -313, 162: -313, 174: -313, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 7: 747, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 6: -94, 29: -94, 36: -94, 38: -94, 59: -94, 87: -94, 88: -94, 89: -94, 90: -94, 91: -94, 93: -94, 117: -94, 136: -94 }, { 92: 748 }, { 1: -311, 6: -311, 31: -311, 36: -311, 38: -311, 52: -311, 59: -311, 72: -311, 76: -311, 78: -311, 92: -311, 96: -311, 114: -311, 116: -311, 117: -311, 118: -311, 143: -311, 154: -311, 155: 115, 156: -311, 157: -311, 160: -311, 161: -311, 162: -311, 174: -311, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -312, 6: -312, 31: -312, 36: -312, 38: -312, 52: -312, 59: -312, 72: -312, 76: -312, 78: -312, 92: -312, 96: -312, 114: -312, 116: -312, 117: -312, 118: -312, 143: -312, 154: -312, 155: 115, 156: -312, 157: -312, 160: -312, 161: -312, 162: -312, 174: -312, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -296, 6: -296, 31: -296, 36: -296, 38: -296, 52: -296, 59: -296, 72: -296, 76: -296, 78: -296, 92: -296, 96: -296, 114: -296, 116: -296, 117: -296, 118: -296, 143: -296, 154: -296, 156: -296, 157: -296, 160: -296, 161: -296, 162: -296, 174: -296, 175: -296, 180: -296, 181: -296, 184: -296, 185: -296, 186: -296, 187: -296, 188: -296, 189: -296, 190: -296, 191: -296, 192: -296, 193: -296, 194: -296, 195: -296, 196: -296, 197: -296 }, { 1: -297, 6: -297, 31: -297, 36: -297, 38: -297, 52: -297, 59: -297, 72: -297, 76: -297, 78: -297, 92: -297, 96: -297, 114: -297, 116: -297, 117: -297, 118: -297, 143: -297, 154: -297, 156: -297, 157: -297, 160: -297, 161: -297, 162: -297, 174: -297, 175: -297, 180: -297, 181: -297, 184: -297, 185: -297, 186: -297, 187: -297, 188: -297, 189: -297, 190: -297, 191: -297, 192: -297, 193: -297, 194: -297, 195: -297, 196: -297, 197: -297 }, { 1: -192, 6: -192, 31: -192, 36: -192, 38: -192, 52: -192, 59: -192, 76: -192, 154: -192, 156: -192, 157: -192, 174: -192, 175: -192 }, { 117: 749 }, { 7: 750, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 6: -107, 31: -107, 36: -107, 38: -107, 76: -107, 117: -107 }, { 1: -315, 6: -315, 31: -315, 36: -315, 38: -315, 52: -315, 59: 746, 72: -315, 76: -315, 78: -315, 92: -315, 96: -315, 100: 751, 114: -315, 116: -315, 117: -315, 118: 752, 143: -315, 154: -315, 155: 115, 156: -315, 157: -315, 160: -315, 161: -315, 162: -315, 174: -315, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 6: -96, 29: -96, 36: -96, 38: -96, 59: -96, 87: -96, 88: -96, 89: -96, 90: -96, 91: -96, 93: -96, 117: -96, 136: -96 }, { 1: -168, 6: -168, 29: -168, 31: -168, 36: -168, 38: -168, 46: -168, 47: -168, 52: -168, 59: -168, 68: -168, 72: -168, 76: -168, 78: -168, 87: -168, 88: -168, 89: -168, 90: -168, 91: -168, 92: -168, 93: -168, 96: -168, 107: -168, 114: -168, 116: -168, 117: -168, 118: -168, 135: -168, 136: -168, 143: -168, 154: -168, 156: -168, 157: -168, 160: -168, 161: -168, 162: -168, 174: -168, 175: -168, 180: -168, 181: -168, 184: -168, 185: -168, 186: -168, 187: -168, 188: -168, 189: -168, 190: -168, 191: -168, 192: -168, 193: -168, 194: -168, 195: -168, 196: -168, 197: -168 }, { 1: -314, 6: -314, 31: -314, 36: -314, 38: -314, 52: -314, 59: 746, 72: -314, 76: -314, 78: -314, 92: -314, 96: -314, 100: 753, 114: -314, 116: -314, 117: -314, 118: -314, 143: -314, 154: -314, 155: 115, 156: -314, 157: -314, 160: -314, 161: -314, 162: -314, 174: -314, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 117: 754 }, { 7: 755, 9: 152, 10: 22, 11: 23, 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: 56, 28: 81, 35: 55, 37: 62, 40: 93, 43: 63, 44: 89, 45: 90, 46: 94, 47: 95, 53: 65, 54: 91, 55: 92, 56: 30, 60: 27, 61: 64, 62: 66, 63: 67, 64: 68, 65: 69, 66: 70, 67: 26, 74: 82, 75: 72, 77: 76, 80: 28, 81: 33, 82: 32, 83: 73, 86: 74, 94: 58, 95: 156, 97: 157, 98: 79, 99: 80, 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: 77, 112: 78, 113: 88, 114: 51, 121: 53, 123: 59, 131: 60, 138: 75, 148: 48, 152: 54, 153: 71, 155: 49, 156: 85, 157: 86, 158: 50, 159: 87, 163: 42, 165: 52, 170: 46, 171: 83, 172: 47, 173: 84, 176: 158, 177: 159, 178: 160, 179: 39, 180: 40, 181: 41, 182: 43, 183: 44 }, { 117: 756 }, { 1: -170, 6: -170, 29: -170, 31: -170, 36: -170, 38: -170, 46: -170, 47: -170, 52: -170, 59: -170, 68: -170, 72: -170, 76: -170, 78: -170, 87: -170, 88: -170, 89: -170, 90: -170, 91: -170, 92: -170, 93: -170, 96: -170, 107: -170, 114: -170, 116: -170, 117: -170, 118: -170, 135: -170, 136: -170, 143: -170, 154: -170, 156: -170, 157: -170, 160: -170, 161: -170, 162: -170, 174: -170, 175: -170, 180: -170, 181: -170, 184: -170, 185: -170, 186: -170, 187: -170, 188: -170, 189: -170, 190: -170, 191: -170, 192: -170, 193: -170, 194: -170, 195: -170, 196: -170, 197: -170 }, { 1: -316, 6: -316, 31: -316, 36: -316, 38: -316, 52: -316, 59: 746, 72: -316, 76: -316, 78: -316, 92: -316, 96: -316, 100: 757, 114: -316, 116: -316, 117: -316, 118: -316, 143: -316, 154: -316, 155: 115, 156: -316, 157: -316, 160: -316, 161: -316, 162: -316, 174: -316, 175: 114, 180: 99, 181: 98, 184: 97, 185: 100, 186: 101, 187: 102, 188: 103, 189: 104, 190: 105, 191: 106, 192: 107, 193: 108, 194: 109, 195: 110, 196: 111, 197: 112 }, { 1: -169, 6: -169, 29: -169, 31: -169, 36: -169, 38: -169, 46: -169, 47: -169, 52: -169, 59: -169, 68: -169, 72: -169, 76: -169, 78: -169, 87: -169, 88: -169, 89: -169, 90: -169, 91: -169, 92: -169, 93: -169, 96: -169, 107: -169, 114: -169, 116: -169, 117: -169, 118: -169, 135: -169, 136: -169, 143: -169, 154: -169, 156: -169, 157: -169, 160: -169, 161: -169, 162: -169, 174: -169, 175: -169, 180: -169, 181: -169, 184: -169, 185: -169, 186: -169, 187: -169, 188: -169, 189: -169, 190: -169, 191: -169, 192: -169, 193: -169, 194: -169, 195: -169, 196: -169, 197: -169 }, { 117: 758 }, { 1: -171, 6: -171, 29: -171, 31: -171, 36: -171, 38: -171, 46: -171, 47: -171, 52: -171, 59: -171, 68: -171, 72: -171, 76: -171, 78: -171, 87: -171, 88: -171, 89: -171, 90: -171, 91: -171, 92: -171, 93: -171, 96: -171, 107: -171, 114: -171, 116: -171, 117: -171, 118: -171, 135: -171, 136: -171, 143: -171, 154: -171, 156: -171, 157: -171, 160: -171, 161: -171, 162: -171, 174: -171, 175: -171, 180: -171, 181: -171, 184: -171, 185: -171, 186: -171, 187: -171, 188: -171, 189: -171, 190: -171, 191: -171, 192: -171, 193: -171, 194: -171, 195: -171, 196: -171, 197: -171 }],
  ruleTable: [0, 0, 3, 0, 3, 1, 4, 1, 4, 3, 4, 2, 5, 1, 5, 1, 5, 1, 9, 1, 9, 1, 9, 1, 9, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 26, 6, 26, 3, 8, 1, 8, 1, 25, 1, 25, 2, 25, 4, 25, 3, 32, 2, 32, 3, 28, 1, 41, 1, 43, 1, 43, 1, 45, 1, 45, 3, 48, 1, 48, 2, 50, 3, 50, 5, 50, 2, 50, 1, 53, 1, 53, 3, 58, 3, 58, 1, 60, 1, 60, 1, 60, 1, 60, 1, 60, 1, 60, 1, 60, 1, 60, 1, 17, 3, 17, 4, 17, 5, 69, 1, 69, 1, 69, 3, 69, 5, 69, 3, 69, 5, 73, 1, 73, 1, 73, 1, 70, 1, 70, 3, 70, 4, 70, 1, 71, 2, 71, 2, 79, 1, 79, 1, 79, 1, 79, 1, 79, 1, 79, 3, 79, 2, 79, 3, 79, 3, 79, 3, 79, 3, 79, 3, 79, 3, 79, 2, 79, 2, 79, 4, 79, 6, 79, 5, 79, 7, 10, 2, 10, 4, 10, 1, 15, 5, 15, 2, 33, 5, 33, 2, 97, 1, 97, 1, 100, 0, 100, 1, 30, 0, 30, 1, 30, 3, 30, 4, 30, 6, 101, 1, 101, 3, 101, 2, 101, 1, 102, 1, 102, 1, 102, 1, 102, 1, 104, 2, 105, 1, 105, 1, 105, 3, 105, 3, 105, 3, 105, 3, 105, 2, 105, 2, 105, 4, 105, 6, 105, 4, 105, 6, 105, 4, 105, 5, 105, 7, 105, 5, 105, 7, 105, 5, 105, 7, 105, 3, 105, 3, 105, 3, 105, 3, 105, 2, 105, 2, 105, 4, 105, 6, 105, 5, 105, 7, 67, 1, 67, 1, 67, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 81, 3, 81, 4, 81, 6, 110, 3, 110, 3, 37, 10, 37, 12, 37, 11, 37, 13, 37, 4, 120, 0, 120, 1, 120, 3, 120, 4, 120, 6, 23, 1, 23, 2, 23, 3, 23, 4, 23, 2, 23, 3, 23, 4, 23, 5, 12, 2, 12, 4, 12, 4, 12, 5, 12, 7, 12, 6, 12, 9, 126, 1, 126, 3, 126, 4, 126, 4, 126, 6, 127, 1, 127, 3, 127, 1, 127, 3, 124, 1, 125, 3, 13, 3, 13, 5, 13, 2, 13, 2, 13, 4, 13, 5, 13, 6, 13, 3, 13, 5, 13, 4, 13, 5, 13, 7, 132, 1, 132, 3, 132, 4, 132, 4, 132, 6, 134, 1, 134, 3, 134, 3, 134, 1, 134, 3, 56, 3, 56, 3, 56, 3, 56, 2, 56, 2, 84, 0, 84, 1, 85, 2, 85, 4, 82, 1, 82, 1, 74, 2, 103, 2, 103, 3, 103, 4, 142, 1, 142, 1, 108, 5, 106, 3, 106, 2, 106, 2, 106, 1, 137, 1, 137, 3, 137, 4, 137, 4, 137, 6, 144, 1, 144, 1, 144, 1, 144, 1, 140, 1, 140, 3, 140, 4, 140, 4, 140, 6, 145, 1, 145, 2, 141, 1, 141, 2, 139, 1, 139, 2, 146, 1, 146, 2, 147, 1, 147, 3, 19, 2, 19, 3, 19, 4, 19, 5, 149, 3, 149, 3, 149, 2, 24, 2, 24, 4, 80, 3, 80, 5, 155, 2, 155, 4, 155, 2, 155, 4, 20, 2, 20, 2, 20, 2, 20, 1, 158, 2, 158, 2, 21, 5, 21, 7, 21, 7, 21, 9, 21, 9, 21, 5, 21, 7, 21, 6, 21, 8, 21, 5, 21, 7, 21, 6, 21, 8, 21, 3, 21, 5, 21, 5, 21, 7, 21, 7, 21, 9, 21, 9, 21, 5, 21, 7, 21, 6, 21, 8, 21, 5, 21, 7, 21, 6, 21, 8, 21, 3, 21, 5, 164, 1, 164, 3, 115, 1, 115, 3, 22, 5, 22, 7, 22, 4, 22, 6, 166, 1, 166, 2, 168, 3, 168, 4, 170, 3, 170, 5, 172, 3, 172, 5, 18, 1, 18, 3, 18, 1, 18, 3, 18, 3, 18, 3, 18, 3, 34, 2, 34, 2, 34, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 4, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 5, 16, 3, 16, 5, 16, 4, 109, 2],
  ruleActions: (rule, vals, locs, shared) => {
    const $ = vals;
    const $0 = vals.length - 1;
    switch (rule) {
      case 1:
        return ["program"];
      case 2:
        return ["program", ...$[$0]];
      case 3:
      case 42:
      case 109:
      case 174:
      case 193:
      case 216:
      case 248:
      case 262:
      case 266:
      case 325:
      case 331:
        return [$[$0]];
      case 4:
      case 110:
      case 175:
      case 194:
      case 217:
      case 249:
        return [...$[$0 - 2], $[$0]];
      case 5:
      case 44:
      case 269:
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
      case 28:
      case 29:
      case 36:
      case 37:
      case 38:
      case 39:
      case 40:
      case 47:
      case 48:
      case 52:
      case 53:
      case 54:
      case 57:
      case 58:
      case 59:
      case 64:
      case 69:
      case 70:
      case 71:
      case 72:
      case 75:
      case 78:
      case 79:
      case 80:
      case 81:
      case 82:
      case 104:
      case 105:
      case 106:
      case 107:
      case 113:
      case 117:
      case 118:
      case 119:
      case 120:
      case 122:
      case 123:
      case 151:
      case 152:
      case 153:
      case 154:
      case 155:
      case 156:
      case 157:
      case 158:
      case 159:
      case 160:
      case 161:
      case 162:
      case 198:
      case 200:
      case 202:
      case 221:
      case 224:
      case 253:
      case 254:
      case 255:
      case 257:
      case 270:
      case 290:
      case 323:
      case 339:
      case 341:
        return $[$0];
      case 26:
        return ["def", $[$0 - 4], $[$0 - 2], $[$0]];
      case 27:
        return ["def", $[$0 - 1], [], $[$0]];
      case 30:
        return ["yield"];
      case 31:
        return ["yield", $[$0]];
      case 32:
        return ["yield", $[$0 - 1]];
      case 33:
        return ["yield-from", $[$0]];
      case 34:
        return ["block"];
      case 35:
        return ["block", ...$[$0 - 1]];
      case 41:
        return ["str", ...$[$0 - 1]];
      case 43:
      case 263:
      case 267:
      case 332:
        return [...$[$0 - 1], $[$0]];
      case 45:
      case 196:
      case 219:
      case 234:
      case 251:
        return $[$0 - 2];
      case 46:
        return "";
      case 49:
        return ["regex", $[$0 - 1]];
      case 50:
        return ["regex-index", $[$0 - 2], $[$0]];
      case 51:
        return ["regex-index", $[$0], null];
      case 55:
        return "undefined";
      case 56:
        return "null";
      case 60:
        return ["=", $[$0 - 2], $[$0]];
      case 61:
        return ["=", $[$0 - 3], $[$0]];
      case 62:
        return ["=", $[$0 - 4], $[$0 - 1]];
      case 63:
        return [$[$0], $[$0], null];
      case 65:
        return [$[$0 - 2], $[$0], ":"];
      case 66:
        return [$[$0 - 4], $[$0 - 1], ":"];
      case 67:
        return [$[$0 - 2], $[$0], "="];
      case 68:
        return [$[$0 - 4], $[$0 - 1], "="];
      case 73:
        return ["computed", $[$0 - 1]];
      case 74:
        return ["[]", "this", $[$0 - 1]];
      case 76:
      case 77:
      case 121:
        return ["...", $[$0]];
      case 83:
      case 229:
        return ["super", ...$[$0]];
      case 84:
      case 230:
        return ["import", ...$[$0]];
      case 85:
      case 86:
        return [$[$0 - 2], ...$[$0]];
      case 87:
      case 124:
      case 141:
        return [".", $[$0 - 2], $[$0]];
      case 88:
      case 125:
      case 142:
        return ["?.", $[$0 - 2], $[$0]];
      case 89:
      case 126:
      case 143:
        return ["::", $[$0 - 2], $[$0]];
      case 90:
      case 127:
      case 144:
        return ["?::", $[$0 - 2], $[$0]];
      case 91:
      case 128:
      case 145:
        return ["::", $[$0 - 1], "prototype"];
      case 92:
      case 129:
      case 146:
        return ["?::", $[$0 - 1], "prototype"];
      case 93:
      case 130:
      case 132:
      case 147:
        return ["[]", $[$0 - 3], $[$0 - 1]];
      case 94:
      case 131:
      case 133:
      case 148:
        return ["[]", $[$0 - 5], $[$0 - 2]];
      case 95:
      case 135:
      case 137:
      case 149:
        return ["?[]", $[$0 - 4], $[$0 - 1]];
      case 96:
      case 136:
      case 138:
      case 150:
        return ["?[]", $[$0 - 6], $[$0 - 2]];
      case 97:
        return ["return", $[$0]];
      case 98:
        return ["return", $[$0 - 1]];
      case 99:
        return ["return"];
      case 100:
      case 102:
        return [$[$0 - 1], $[$0 - 3], $[$0]];
      case 101:
      case 103:
        return [$[$0 - 1], [], $[$0]];
      case 108:
      case 173:
      case 233:
      case 264:
        return [];
      case 111:
      case 176:
      case 195:
      case 218:
      case 250:
        return [...$[$0 - 3], $[$0]];
      case 112:
      case 177:
      case 197:
      case 220:
      case 252:
        return [...$[$0 - 5], ...$[$0 - 2]];
      case 114:
      case 324:
        return ["default", $[$0 - 2], $[$0]];
      case 115:
        return ["rest", $[$0]];
      case 116:
        return ["expansion"];
      case 134:
        return [$[$0 - 1][0], $[$0 - 3], ...$[$0 - 1].slice(1)];
      case 139:
        return ["optindex", $[$0 - 4], $[$0 - 1]];
      case 140:
        return ["optindex", $[$0 - 6], $[$0 - 2]];
      case 163:
        return [".", "super", $[$0]];
      case 164:
        return ["[]", "super", $[$0 - 1]];
      case 165:
        return ["[]", "super", $[$0 - 2]];
      case 166:
        return [".", "new", $[$0]];
      case 167:
        return [".", "import", $[$0]];
      case 168:
        return ["object-comprehension", $[$0 - 8], $[$0 - 6], [["for-of", $[$0 - 4], $[$0 - 2], false]], []];
      case 169:
        return ["object-comprehension", $[$0 - 10], $[$0 - 8], [["for-of", $[$0 - 6], $[$0 - 4], false]], [$[$0 - 2]]];
      case 170:
        return ["object-comprehension", $[$0 - 9], $[$0 - 7], [["for-of", $[$0 - 4], $[$0 - 2], true]], []];
      case 171:
        return ["object-comprehension", $[$0 - 11], $[$0 - 9], [["for-of", $[$0 - 6], $[$0 - 4], true]], [$[$0 - 2]]];
      case 172:
        return ["object", ...$[$0 - 2]];
      case 178:
        return ["class", null, null];
      case 179:
        return ["class", null, null, $[$0]];
      case 180:
        return ["class", null, $[$0]];
      case 181:
        return ["class", null, $[$0 - 1], $[$0]];
      case 182:
        return ["class", $[$0], null];
      case 183:
        return ["class", $[$0 - 1], null, $[$0]];
      case 184:
        return ["class", $[$0 - 2], $[$0]];
      case 185:
        return ["class", $[$0 - 3], $[$0 - 1], $[$0]];
      case 186:
      case 189:
        return ["import", "{}", $[$0]];
      case 187:
      case 188:
        return ["import", $[$0 - 2], $[$0]];
      case 190:
        return ["import", $[$0 - 4], $[$0]];
      case 191:
        return ["import", [$[$0 - 4], $[$0 - 2]], $[$0]];
      case 192:
        return ["import", [$[$0 - 7], $[$0 - 4]], $[$0]];
      case 199:
      case 201:
      case 222:
      case 223:
      case 225:
      case 326:
        return [$[$0 - 2], $[$0]];
      case 203:
        return ["*", $[$0]];
      case 204:
        return ["export", "{}"];
      case 205:
        return ["export", $[$0 - 2]];
      case 206:
      case 207:
        return ["export", $[$0]];
      case 208:
        return ["export", ["=", $[$0 - 2], $[$0]]];
      case 209:
        return ["export", ["=", $[$0 - 3], $[$0]]];
      case 210:
        return ["export", ["=", $[$0 - 4], $[$0 - 1]]];
      case 211:
        return ["export-default", $[$0]];
      case 212:
        return ["export-default", $[$0 - 1]];
      case 213:
        return ["export-all", $[$0]];
      case 214:
        return ["export-from", "{}", $[$0]];
      case 215:
        return ["export-from", $[$0 - 4], $[$0]];
      case 226:
        return ["tagged-template", $[$0 - 2], $[$0]];
      case 227:
        return $[$0 - 1] ? ["?call", $[$0 - 2], ...$[$0]] : [$[$0 - 2], ...$[$0]];
      case 228:
        return ["optcall", $[$0 - 2], ...$[$0]];
      case 231:
      case 268:
        return null;
      case 232:
        return true;
      case 235:
      case 236:
        return "this";
      case 237:
        return [".", "this", $[$0]];
      case 238:
        return ["array"];
      case 239:
        return ["array", ...$[$0 - 1]];
      case 240:
        return ["array", ...$[$0 - 2], ...$[$0 - 1]];
      case 241:
        return "..";
      case 242:
      case 256:
        return "...";
      case 243:
        return [$[$0 - 2], $[$0 - 3], $[$0 - 1]];
      case 244:
      case 363:
      case 365:
      case 366:
      case 374:
      case 376:
        return [$[$0 - 1], $[$0 - 2], $[$0]];
      case 245:
        return [$[$0], $[$0 - 1], null];
      case 246:
        return [$[$0 - 1], null, $[$0]];
      case 247:
        return [$[$0], null, null];
      case 258:
        return [...$[$0 - 2], ...$[$0]];
      case 259:
        return [...$[$0 - 3], ...$[$0]];
      case 260:
        return [...$[$0 - 2], ...$[$0 - 1]];
      case 261:
        return [...$[$0 - 5], ...$[$0 - 4], ...$[$0 - 2], ...$[$0 - 1]];
      case 265:
        return [...$[$0]];
      case 271:
        return Array.isArray($[$0 - 2]) ? [...$[$0 - 2], $[$0]] : [$[$0 - 2], $[$0]];
      case 272:
        return ["try", $[$0]];
      case 273:
        return ["try", $[$0 - 1], $[$0]];
      case 274:
        return ["try", $[$0 - 2], $[$0]];
      case 275:
        return ["try", $[$0 - 3], $[$0 - 2], $[$0]];
      case 276:
      case 277:
      case 346:
      case 349:
      case 351:
        return [$[$0 - 1], $[$0]];
      case 278:
        return [null, $[$0]];
      case 279:
        return ["throw", $[$0]];
      case 280:
        return ["throw", $[$0 - 1]];
      case 281:
        return $[$0 - 1].length === 1 ? $[$0 - 1][0] : $[$0 - 1];
      case 282:
        return $[$0 - 2].length === 1 ? $[$0 - 2][0] : $[$0 - 2];
      case 283:
        return ["while", $[$0]];
      case 284:
        return ["while", $[$0 - 2], $[$0]];
      case 285:
        return ["until", $[$0]];
      case 286:
        return ["until", $[$0 - 2], $[$0]];
      case 287:
        return $[$0 - 1].length === 2 ? [$[$0 - 1][0], $[$0 - 1][1], $[$0]] : [$[$0 - 1][0], $[$0 - 1][1], $[$0 - 1][2], $[$0]];
      case 288:
      case 289:
        return $[$0].length === 2 ? [$[$0][0], $[$0][1], [$[$0 - 1]]] : [$[$0][0], $[$0][1], $[$0][2], [$[$0 - 1]]];
      case 291:
        return ["loop", $[$0]];
      case 292:
        return ["loop", [$[$0]]];
      case 293:
        return ["for-in", $[$0 - 3], $[$0 - 1], null, null, $[$0]];
      case 294:
        return ["for-in", $[$0 - 5], $[$0 - 3], null, $[$0 - 1], $[$0]];
      case 295:
        return ["for-in", $[$0 - 5], $[$0 - 3], $[$0 - 1], null, $[$0]];
      case 296:
        return ["for-in", $[$0 - 7], $[$0 - 5], $[$0 - 1], $[$0 - 3], $[$0]];
      case 297:
        return ["for-in", $[$0 - 7], $[$0 - 5], $[$0 - 3], $[$0 - 1], $[$0]];
      case 298:
        return ["for-of", $[$0 - 3], $[$0 - 1], false, null, $[$0]];
      case 299:
        return ["for-of", $[$0 - 5], $[$0 - 3], false, $[$0 - 1], $[$0]];
      case 300:
        return ["for-of", $[$0 - 3], $[$0 - 1], true, null, $[$0]];
      case 301:
        return ["for-of", $[$0 - 5], $[$0 - 3], true, $[$0 - 1], $[$0]];
      case 302:
        return ["for-from", $[$0 - 3], $[$0 - 1], false, null, $[$0]];
      case 303:
        return ["for-from", $[$0 - 5], $[$0 - 3], false, $[$0 - 1], $[$0]];
      case 304:
        return ["for-from", $[$0 - 3], $[$0 - 1], true, null, $[$0]];
      case 305:
        return ["for-from", $[$0 - 5], $[$0 - 3], true, $[$0 - 1], $[$0]];
      case 306:
        return ["for-in", [], $[$0 - 1], null, null, $[$0]];
      case 307:
        return ["for-in", [], $[$0 - 3], $[$0 - 1], null, $[$0]];
      case 308:
        return ["comprehension", $[$0 - 4], [["for-in", $[$0 - 2], $[$0], null]], []];
      case 309:
        return ["comprehension", $[$0 - 6], [["for-in", $[$0 - 4], $[$0 - 2], null]], [$[$0]]];
      case 310:
        return ["comprehension", $[$0 - 6], [["for-in", $[$0 - 4], $[$0 - 2], $[$0]]], []];
      case 311:
        return ["comprehension", $[$0 - 8], [["for-in", $[$0 - 6], $[$0 - 4], $[$0]]], [$[$0 - 2]]];
      case 312:
        return ["comprehension", $[$0 - 8], [["for-in", $[$0 - 6], $[$0 - 4], $[$0 - 2]]], [$[$0]]];
      case 313:
        return ["comprehension", $[$0 - 4], [["for-of", $[$0 - 2], $[$0], false]], []];
      case 314:
        return ["comprehension", $[$0 - 6], [["for-of", $[$0 - 4], $[$0 - 2], false]], [$[$0]]];
      case 315:
        return ["comprehension", $[$0 - 5], [["for-of", $[$0 - 2], $[$0], true]], []];
      case 316:
        return ["comprehension", $[$0 - 7], [["for-of", $[$0 - 4], $[$0 - 2], true]], [$[$0]]];
      case 317:
        return ["comprehension", $[$0 - 4], [["for-from", $[$0 - 2], $[$0], false, null]], []];
      case 318:
        return ["comprehension", $[$0 - 6], [["for-from", $[$0 - 4], $[$0 - 2], false, null]], [$[$0]]];
      case 319:
        return ["comprehension", $[$0 - 5], [["for-from", $[$0 - 2], $[$0], true, null]], []];
      case 320:
        return ["comprehension", $[$0 - 7], [["for-from", $[$0 - 4], $[$0 - 2], true, null]], [$[$0]]];
      case 321:
        return ["comprehension", $[$0 - 2], [["for-in", [], $[$0], null]], []];
      case 322:
        return ["comprehension", $[$0 - 4], [["for-in", [], $[$0 - 2], $[$0]]], []];
      case 327:
        return ["switch", $[$0 - 3], $[$0 - 1], null];
      case 328:
        return ["switch", $[$0 - 5], $[$0 - 3], $[$0 - 1]];
      case 329:
        return ["switch", null, $[$0 - 1], null];
      case 330:
        return ["switch", null, $[$0 - 3], $[$0 - 1]];
      case 333:
        return ["when", $[$0 - 1], $[$0]];
      case 334:
        return ["when", $[$0 - 2], $[$0 - 1]];
      case 335:
        return ["if", $[$0 - 1], $[$0]];
      case 336:
        return $[$0 - 4].length === 3 ? ["if", $[$0 - 4][1], $[$0 - 4][2], ["if", $[$0 - 1], $[$0]]] : [...$[$0 - 4], ["if", $[$0 - 1], $[$0]]];
      case 337:
        return ["unless", $[$0 - 1], $[$0]];
      case 338:
        return ["if", ["!", $[$0 - 3]], $[$0 - 2], $[$0]];
      case 340:
        return $[$0 - 2].length === 3 ? ["if", $[$0 - 2][1], $[$0 - 2][2], $[$0]] : [...$[$0 - 2], $[$0]];
      case 342:
      case 343:
        return ["if", $[$0], [$[$0 - 2]]];
      case 344:
      case 345:
        return ["unless", $[$0], [$[$0 - 2]]];
      case 347:
      case 348:
      case 350:
      case 379:
        return ["do-iife", $[$0]];
      case 352:
        return ["-", $[$0]];
      case 353:
        return ["+", $[$0]];
      case 354:
        return ["await", $[$0]];
      case 355:
        return ["await", $[$0 - 1]];
      case 356:
        return ["--", $[$0], false];
      case 357:
        return ["++", $[$0], false];
      case 358:
        return ["--", $[$0 - 1], true];
      case 359:
        return ["++", $[$0 - 1], true];
      case 360:
        return ["?", $[$0 - 1]];
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
        return ["&&", $[$0 - 2], $[$0]];
      case 371:
        return ["||", $[$0 - 2], $[$0]];
      case 372:
        return ["??", $[$0 - 2], $[$0]];
      case 373:
        return ["!?", $[$0 - 2], $[$0]];
      case 375:
        return ["?:", $[$0 - 4], $[$0 - 2], $[$0]];
      case 377:
        return [$[$0 - 3], $[$0 - 4], $[$0 - 1]];
      case 378:
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
    if (CodeGenerator.ASSIGNMENT_OPS.has(head)) {
      const [target, value] = rest;
      if (typeof target === "string" || target instanceof String) {
        const varName = target instanceof String ? target.valueOf() : target;
        this.programVars.add(varName);
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
    } else {
      targetCode = this.generate(target, "value");
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
    const objCode = this.generate(obj, "value");
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
            console.warn("[RIP] Unexpected quoted primitive in str interpolation:", part);
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
    const generator = new CodeGenerator({ dataSection });
    let code = generator.compile(sexpr);
    return {
      tokens,
      sexpr,
      code,
      data: dataSection
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
var VERSION = "1.5.7";
var BUILD_DATE = "2025-11-16@07:41:08GMT";
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
