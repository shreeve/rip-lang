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
    } else if (value === "<=>") {
      tag = "BIND";
    } else if (value === "~=") {
      tag = "COMPUTED_ASSIGN";
    } else if (value === ":=") {
      tag = "REACTIVE_ASSIGN";
    } else if (value === "~>") {
      tag = "REACT_ASSIGN";
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
IDENTIFIER = /^(?!\d)((?:(?!\s)[$\w\x7f-\uffff])+!?)([^\n\S]*:(?![=:]))?/;
NUMBER = /^0b[01](?:_?[01])*n?|^0o[0-7](?:_?[0-7])*n?|^0x[\da-f](?:_?[\da-f])*n?|^\d+(?:_\d+)*n|^(?:\d+(?:_\d+)*)?\.?\d+(?:_\d+)*(?:e[+-]?\d+(?:_\d+)*)?/i;
OPERATOR = /^(?:<=>|[-=]>|~>|~=|:=|=!|===|!==|!\?|\?\?|=~|[-+*\/%<>&|^!?=]=|>>>=?|([-+:])\1|([&|<>*\/%])\2=?|\?(\.|::)|\.{2,3})/;
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
  symbolIds: { $accept: 0, $end: 1, error: 2, Root: 3, Body: 4, Line: 5, TERMINATOR: 6, Expression: 7, ExpressionLine: 8, Statement: 9, Return: 10, STATEMENT: 11, Import: 12, Export: 13, Value: 14, Code: 15, Operation: 16, Assign: 17, ReactiveAssign: 18, ComputedAssign: 19, ReadonlyAssign: 20, ReactAssign: 21, If: 22, Try: 23, While: 24, For: 25, Switch: 26, Class: 27, Throw: 28, Yield: 29, Def: 30, DEF: 31, Identifier: 32, CALL_START: 33, ParamList: 34, CALL_END: 35, Block: 36, Assignable: 37, REACTIVE_ASSIGN: 38, INDENT: 39, OUTDENT: 40, COMPUTED_ASSIGN: 41, READONLY_ASSIGN: 42, REACT_ASSIGN: 43, CodeLine: 44, OperationLine: 45, YIELD: 46, Object: 47, FROM: 48, IDENTIFIER: 49, Property: 50, PROPERTY: 51, AlphaNumeric: 52, NUMBER: 53, String: 54, STRING: 55, STRING_START: 56, Interpolations: 57, STRING_END: 58, InterpolationChunk: 59, INTERPOLATION_START: 60, INTERPOLATION_END: 61, Regex: 62, REGEX: 63, REGEX_START: 64, Invocation: 65, REGEX_END: 66, RegexWithIndex: 67, ",": 68, Literal: 69, JS: 70, UNDEFINED: 71, NULL: 72, BOOL: 73, INFINITY: 74, NAN: 75, "=": 76, AssignObj: 77, ObjAssignable: 78, ObjRestValue: 79, ":": 80, SimpleObjAssignable: 81, ThisProperty: 82, "[": 83, "]": 84, "@": 85, "...": 86, ObjSpreadExpr: 87, Parenthetical: 88, Super: 89, This: 90, SUPER: 91, OptFuncExist: 92, Arguments: 93, DYNAMIC_IMPORT: 94, ".": 95, "?.": 96, "::": 97, "?::": 98, INDEX_START: 99, INDEX_END: 100, INDEX_SOAK: 101, RETURN: 102, PARAM_START: 103, PARAM_END: 104, FuncGlyph: 105, "->": 106, "=>": 107, OptComma: 108, Param: 109, ParamVar: 110, Array: 111, Splat: 112, SimpleAssignable: 113, Slice: 114, ES6_OPTIONAL_INDEX: 115, Range: 116, DoIife: 117, MetaProperty: 118, NEW_TARGET: 119, IMPORT_META: 120, "{": 121, FOR: 122, ForVariables: 123, FOROF: 124, "}": 125, WHEN: 126, OWN: 127, AssignList: 128, CLASS: 129, EXTENDS: 130, IMPORT: 131, ImportDefaultSpecifier: 132, ImportNamespaceSpecifier: 133, ImportSpecifierList: 134, ImportSpecifier: 135, AS: 136, DEFAULT: 137, IMPORT_ALL: 138, EXPORT: 139, ExportSpecifierList: 140, EXPORT_ALL: 141, ExportSpecifier: 142, ES6_OPTIONAL_CALL: 143, FUNC_EXIST: 144, ArgList: 145, THIS: 146, Elisions: 147, ArgElisionList: 148, OptElisions: 149, RangeDots: 150, "..": 151, Arg: 152, ArgElision: 153, Elision: 154, SimpleArgs: 155, TRY: 156, Catch: 157, FINALLY: 158, CATCH: 159, THROW: 160, "(": 161, ")": 162, WhileSource: 163, WHILE: 164, UNTIL: 165, Loop: 166, LOOP: 167, FORIN: 168, BY: 169, FORFROM: 170, AWAIT: 171, ForValue: 172, SWITCH: 173, Whens: 174, ELSE: 175, When: 176, LEADING_WHEN: 177, IfBlock: 178, IF: 179, UnlessBlock: 180, UNLESS: 181, POST_IF: 182, POST_UNLESS: 183, UNARY: 184, DO: 185, DO_IIFE: 186, UNARY_MATH: 187, "-": 188, "+": 189, "--": 190, "++": 191, "?": 192, MATH: 193, "**": 194, SHIFT: 195, COMPARE: 196, "&": 197, "^": 198, "|": 199, "&&": 200, "||": 201, "??": 202, "!?": 203, RELATION: 204, "SPACE?": 205, COMPOUND_ASSIGN: 206 },
  tokenNames: { 2: "error", 6: "TERMINATOR", 11: "STATEMENT", 31: "DEF", 33: "CALL_START", 35: "CALL_END", 38: "REACTIVE_ASSIGN", 39: "INDENT", 40: "OUTDENT", 41: "COMPUTED_ASSIGN", 42: "READONLY_ASSIGN", 43: "REACT_ASSIGN", 46: "YIELD", 48: "FROM", 49: "IDENTIFIER", 51: "PROPERTY", 53: "NUMBER", 55: "STRING", 56: "STRING_START", 58: "STRING_END", 60: "INTERPOLATION_START", 61: "INTERPOLATION_END", 63: "REGEX", 64: "REGEX_START", 66: "REGEX_END", 68: ",", 70: "JS", 71: "UNDEFINED", 72: "NULL", 73: "BOOL", 74: "INFINITY", 75: "NAN", 76: "=", 80: ":", 83: "[", 84: "]", 85: "@", 86: "...", 91: "SUPER", 94: "DYNAMIC_IMPORT", 95: ".", 96: "?.", 97: "::", 98: "?::", 99: "INDEX_START", 100: "INDEX_END", 101: "INDEX_SOAK", 102: "RETURN", 103: "PARAM_START", 104: "PARAM_END", 106: "->", 107: "=>", 115: "ES6_OPTIONAL_INDEX", 119: "NEW_TARGET", 120: "IMPORT_META", 121: "{", 122: "FOR", 124: "FOROF", 125: "}", 126: "WHEN", 127: "OWN", 129: "CLASS", 130: "EXTENDS", 131: "IMPORT", 136: "AS", 137: "DEFAULT", 138: "IMPORT_ALL", 139: "EXPORT", 141: "EXPORT_ALL", 143: "ES6_OPTIONAL_CALL", 144: "FUNC_EXIST", 146: "THIS", 151: "..", 156: "TRY", 158: "FINALLY", 159: "CATCH", 160: "THROW", 161: "(", 162: ")", 164: "WHILE", 165: "UNTIL", 167: "LOOP", 168: "FORIN", 169: "BY", 170: "FORFROM", 171: "AWAIT", 173: "SWITCH", 175: "ELSE", 177: "LEADING_WHEN", 179: "IF", 181: "UNLESS", 182: "POST_IF", 183: "POST_UNLESS", 184: "UNARY", 185: "DO", 186: "DO_IIFE", 187: "UNARY_MATH", 188: "-", 189: "+", 190: "--", 191: "++", 192: "?", 193: "MATH", 194: "**", 195: "SHIFT", 196: "COMPARE", 197: "&", 198: "^", 199: "|", 200: "&&", 201: "||", 202: "??", 203: "!?", 204: "RELATION", 205: "SPACE?", 206: "COMPOUND_ASSIGN" },
  parseTable: (() => {
    let d = [101, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, -1, 1, 2, 3, 4, 5, 6, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 1, 1, 0, 2, 1, 5, -2, 101, 5, 1, 5, 34, 21, 101, -3, -3, -3, -3, -3, 31, 1, 5, 29, 4, 1, 21, 7, 16, 38, 40, 1, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -6, -6, -6, -6, -6, -6, -6, -6, 121, -6, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 9, 1, 5, 29, 4, 1, 21, 7, 16, 78, -7, -7, -7, -7, -7, -7, -7, -7, -7, 14, 1, 5, 29, 4, 1, 21, 7, 16, 78, 1, 1, 1, 17, 1, -8, -8, -8, -8, -8, -8, -8, -8, -8, 124, 90, 91, 122, 123, 54, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 6, 3, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -13, -13, -250, -13, -13, -13, -250, -250, -13, -13, -13, -13, -13, 125, 127, 128, 129, 130, 131, -13, 132, -13, 133, -13, -13, -13, -13, 126, 134, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, 47, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, 135, 136, 137, 138, 139, -14, 140, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, 9, 1, 5, 29, 4, 1, 21, 7, 16, 78, -47, -47, -47, -47, -47, -47, -47, -47, -47, 9, 1, 5, 29, 4, 1, 21, 7, 16, 78, -48, -48, -48, -48, -48, -48, -48, -48, -48, 13, 1, 5, 29, 4, 1, 21, 7, 16, 78, 2, 1, 17, 1, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, 13, 1, 5, 29, 4, 1, 21, 7, 16, 78, 2, 1, 17, 1, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, 13, 1, 5, 29, 4, 1, 21, 7, 16, 78, 2, 1, 17, 1, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, 13, 1, 5, 29, 4, 1, 21, 7, 16, 78, 2, 1, 17, 1, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, 58, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -173, -173, -173, -173, 142, -173, -173, 143, 144, 145, -173, -173, -173, -173, 141, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, -174, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, -175, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, -176, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, 18, 6, 26, 2, 1, 4, 1, 7, 2, 19, 14, 1, 2, 1, 18, 5, 1, 1, 10, -127, 150, 146, -127, -127, -127, 153, 98, -127, 151, 155, 154, 149, -127, 147, 148, 152, 93, 100, 5, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 1, 2, 4, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 157, 4, 5, 6, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 156, 30, 158, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 97, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 159, 160, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 97, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 162, 163, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 164, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 170, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 171, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 172, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 173, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 45, 14, 1, 17, 5, 10, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 9, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 25, 15, 25, 175, 176, 86, 177, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 165, 166, 84, 85, 66, 174, 33, 35, 38, 82, 83, 93, 80, 76, 169, 45, 14, 1, 17, 5, 10, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 9, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 25, 15, 25, 175, 176, 86, 177, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 165, 166, 84, 85, 66, 178, 33, 35, 38, 82, 83, 93, 80, 76, 169, 61, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, 179, 180, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, 181, 96, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 183, 182, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 184, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 5, 7, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, 185, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, -358, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, -360, 2, 36, 3, 186, 158, 2, 36, 3, 187, 158, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, 14, 32, 15, 2, 33, 1, 2, 25, 1, 5, 5, 2, 4, 44, 1, 150, 153, 98, 151, 77, 154, 193, 152, 191, 93, 188, 189, 190, 192, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 194, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 195, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 88, 1, 5, 8, 1, 17, 3, 1, 1, 2, 1, 7, 2, 3, 1, 1, 1, 1, 5, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 5, 2, 1, 1, 1, 1, 2, 1, 1, 1, 3, 6, 3, 1, 1, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 2, 1, 1, 4, 16, 5, 10, 1, 2, 1, 3, 1, 1, 12, 1, 3, 2, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -197, -197, 175, 176, 86, -197, 196, 177, 158, -197, 67, 98, 68, 94, 95, 99, 100, -197, 70, 96, 97, 34, -197, 31, 69, 71, 72, 73, 74, 75, -197, 87, 77, -197, 81, -197, 32, 37, 36, 78, 79, -197, 165, -197, 166, 84, 85, 66, 198, 33, 35, 38, 82, 83, 93, -197, -197, -197, -197, 197, 80, -197, 76, -197, -197, -197, -197, -197, -197, -197, -197, 169, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 199, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 200, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 131, 1, 5, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 2, 1, 3, 3, 1, 1, 1, 3, 1, 1, 1, 1, 5, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 5, 2, 1, 1, 1, 1, 2, 1, 1, 1, 3, 6, 2, 1, 1, 1, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 2, 1, 1, 3, 2, 8, 7, 5, 5, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -49, -49, 201, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, -49, 30, 202, -49, 50, 60, 67, 203, 98, 68, 94, 95, 99, 100, -49, 70, 96, 97, 34, -49, 31, 69, 71, 72, 73, 74, 75, -49, 87, 77, -49, 81, -49, 32, 37, 36, 78, 79, -49, 63, 165, -49, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, -49, -49, -49, -49, 58, 64, 65, 80, -49, 53, 59, 76, -49, 54, -49, -49, 55, 92, -49, -49, -49, 46, 57, 51, 88, 52, 89, -49, -49, 167, 168, 169, 43, 44, 45, 47, 48, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, 2, 32, 17, 204, 98, 6, 15, 29, 59, 2, 1, 1, 206, 205, 39, 40, 84, 85, 105, 1, 5, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 2, 1, 3, 3, 1, 2, 3, 1, 1, 1, 1, 5, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 7, 1, 1, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 1, 1, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -118, -118, 207, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, -118, 30, 208, -118, 50, 60, 67, 98, 68, 94, 95, 99, 100, -118, 70, 96, 97, 34, -118, 31, 69, 71, 72, 73, 74, 75, 87, 77, -118, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, -118, 54, -118, -118, 55, 92, 46, 57, 51, 88, 52, 89, -118, -118, 167, 168, 169, 43, 44, 45, 47, 48, 9, 32, 17, 5, 1, 1, 65, 11, 1, 5, 213, 98, 209, 99, 100, 212, 210, 211, 214, 9, 27, 3, 1, 1, 17, 72, 8, 8, 4, 216, 217, 61, 218, 98, 215, 58, 219, 220, 58, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, 58, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, 100, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 221, 3, 4, 5, 6, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 222, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 107, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 1, 1, 4, 1, 1, 2, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 223, 232, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 229, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 230, 31, 69, 71, 72, 73, 74, 75, 87, 77, 224, 81, 234, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 233, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 225, 226, 231, 228, 227, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 4, 33, 60, 2, 4, 238, 235, 236, 237, 2, 33, 60, 238, 239, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, 55, 1, 5, 27, 2, 4, 1, 10, 1, 4, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -255, -255, -255, -255, -255, -255, 240, 241, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, 1, 95, 242, 1, 95, 243, 51, 11, 20, 8, 4, 3, 3, 4, 2, 1, 7, 1, 6, 1, 1, 1, 1, 1, 8, 2, 6, 3, 8, 1, 3, 1, 12, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 3, 1, 2, 4, 2, 6, 2, 3, 1, 1, 1, 1, 1, 1, 1, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, 51, 11, 20, 8, 4, 3, 3, 4, 2, 1, 7, 1, 6, 1, 1, 1, 1, 1, 8, 2, 6, 3, 8, 1, 3, 1, 12, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 3, 1, 2, 4, 2, 6, 2, 3, 1, 1, 1, 1, 1, 1, 1, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, -141, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 244, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 245, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 246, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 247, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 96, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 1, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 249, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 248, 30, 158, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 23, 6, 26, 7, 1, 9, 1, 1, 1, 1, 1, 1, 1, 12, 9, 1, 1, 2, 1, 1, 2, 1, 39, 3, -192, 257, -192, -192, 98, 258, 241, 255, 94, 95, 99, 100, -192, 256, 250, 260, 252, 259, 253, 254, 261, -192, 251, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, 45, 14, 1, 17, 5, 10, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 9, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 25, 15, 25, 175, 176, 86, 177, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 262, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 165, 166, 84, 85, 66, 263, 33, 35, 38, 82, 83, 93, 80, 76, 169, 64, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 5, 7, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 6, 7, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, 56, 1, 5, 27, 2, 4, 1, 15, 1, 2, 2, 1, 5, 2, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, 6, 54, 1, 1, 1, 2, 1, 267, 99, 100, 264, 265, 266, 103, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 3, 3, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 5, 1, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 1, 1, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, -5, 268, -5, 4, 5, 6, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, -5, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, -5, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, -5, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 269, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 270, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 271, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 272, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 273, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 274, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 275, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 276, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 277, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 278, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 279, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 280, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 281, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 282, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 283, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 284, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 285, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, 14, 32, 15, 2, 33, 1, 2, 25, 1, 5, 5, 2, 4, 44, 1, 150, 153, 98, 151, 77, 154, 193, 152, 289, 93, 286, 287, 288, 192, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 290, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 291, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, 5, 33, 21, 1, 1, 37, 238, 292, 99, 100, 293, 2, 33, 60, 238, 294, 2, 50, 1, 295, 241, 2, 50, 1, 296, 241, 64, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 7, 1, 4, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, 297, 241, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, -147, 64, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 7, 1, 4, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, 298, 241, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, -148, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 7, 1, 2, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 1, 2, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 4, 1, 5, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 299, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 300, 50, 60, 67, 98, 68, 94, 95, 99, 100, 304, 96, 97, 34, 302, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 306, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 301, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 303, 305, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 1, 99, 307, 1, 99, 308, 3, 33, 22, 1, -251, -251, -251, 2, 50, 1, 309, 241, 2, 50, 1, 310, 241, 64, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 7, 1, 4, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, 311, 241, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, -164, 64, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 7, 1, 4, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, 312, 241, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 313, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 314, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 1, 99, 315, 96, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 317, 316, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 318, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 96, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 320, 319, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 321, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 96, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 323, 322, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 324, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 96, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 326, 325, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 327, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 96, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 329, 328, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 330, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 9, 6, 29, 4, 1, 28, 16, 20, 4, 17, -125, -125, -125, -125, 332, -125, 331, 333, -125, 6, 6, 29, 4, 1, 28, 36, -128, -128, -128, -128, -128, -128, 7, 6, 29, 4, 1, 28, 8, 28, -132, -132, -132, -132, -132, 334, -132, 15, 6, 26, 3, 4, 1, 7, 2, 19, 14, 1, 2, 19, 6, 1, 10, -135, 150, -135, -135, -135, 153, 98, -135, 151, 155, 154, -135, 335, 152, 93, 10, 6, 29, 4, 1, 28, 8, 28, 20, 44, 2, -136, -136, -136, -136, -136, -136, -136, -136, -136, -136, 10, 6, 29, 4, 1, 28, 8, 28, 20, 44, 2, -137, -137, -137, -137, -137, -137, -137, -137, -137, -137, 10, 6, 29, 4, 1, 28, 8, 28, 20, 44, 2, -138, -138, -138, -138, -138, -138, -138, -138, -138, -138, 10, 6, 29, 4, 1, 28, 8, 28, 20, 44, 2, -139, -139, -139, -139, -139, -139, -139, -139, -139, -139, 2, 50, 1, 240, 241, 107, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 1, 1, 4, 1, 1, 2, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 336, 232, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 229, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 230, 31, 69, 71, 72, 73, 74, 75, 87, 77, 224, 81, 234, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 233, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 225, 226, 231, 228, 227, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, 9, 1, 5, 29, 4, 1, 21, 7, 16, 78, -122, -122, -122, -122, -122, -122, -122, -122, -122, 100, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 3, 3, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 338, 3, 4, 5, 6, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 337, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, -368, 120, -368, -368, -368, -368, -368, -368, 119, -368, -368, 102, -368, -368, -368, -368, -368, -368, -368, -368, -368, 114, 115, -368, -368, 9, 1, 5, 29, 4, 1, 21, 7, 16, 78, -365, -365, -365, -365, -365, -365, -365, -365, -365, 5, 163, 1, 1, 17, 1, 124, 90, 91, 122, 123, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, 120, -369, -369, -369, -369, -369, -369, 119, -369, -369, 102, -369, -369, -369, -369, -369, -369, -369, -369, -369, 114, 115, -369, -369, 9, 1, 5, 29, 4, 1, 21, 7, 16, 78, -366, -366, -366, -366, -366, -366, -366, -366, -366, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, 120, -370, -370, -370, -370, -370, -370, 119, -370, -370, 102, -370, 106, -370, -370, -370, -370, -370, -370, -370, 114, 115, -370, -370, 18, 6, 26, 2, 1, 4, 1, 7, 2, 19, 14, 1, 2, 1, 18, 5, 1, 1, 10, -127, 150, 339, -127, -127, -127, 153, 98, -127, 151, 155, 154, 149, -127, 147, 148, 152, 93, 2, 36, 3, 156, 158, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 159, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 162, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 5, 15, 88, 2, 1, 1, 206, 165, 166, 84, 85, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, 120, -371, -371, -371, -371, -371, -371, 119, -371, -371, 102, -371, 106, -371, -371, -371, -371, -371, -371, -371, 114, 115, -371, -371, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, 120, -372, -372, -372, -372, -372, -372, 119, -372, -372, 102, -372, 106, -372, -372, -372, -372, -372, -372, -372, 114, 115, -372, -372, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, 120, -373, -373, -373, -373, -373, -373, 119, -373, -373, 102, -373, -373, -373, -373, -373, -373, -373, -373, -373, 114, 115, -373, -373, 2, 47, 74, 340, 93, 58, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -375, -375, -170, -375, -170, -375, -375, -170, -170, -170, -170, -170, -375, -375, -170, -375, -375, -375, -170, -170, -170, -170, -170, -375, -170, -375, -170, -375, -375, -375, -375, -170, -170, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, 13, 33, 22, 1, 36, 3, 1, 1, 1, 1, 2, 14, 28, 1, -250, -250, -250, 125, 127, 128, 129, 130, 131, 132, 133, 126, 134, 6, 95, 1, 1, 1, 1, 2, 135, 136, 137, 138, 139, 140, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, -173, 58, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -376, -376, -170, -376, -170, -376, -376, -170, -170, -170, -170, -170, -376, -376, -170, -376, -376, -376, -170, -170, -170, -170, -170, -376, -170, -376, -170, -376, -376, -376, -376, -170, -170, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, 96, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 343, 341, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 342, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, 121, -44, -44, -44, -44, -44, 120, 90, 91, -44, -44, -44, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 344, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 345, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 3, 36, 3, 140, 346, 158, 347, 44, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 6, 1, 1, 3, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, 348, 349, 350, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, 3, 124, 44, 2, 352, 351, 353, 11, 32, 15, 2, 33, 1, 2, 25, 1, 10, 2, 49, 150, 153, 98, 151, 155, 154, 193, 152, 93, 354, 192, 11, 32, 15, 2, 33, 1, 2, 25, 1, 10, 2, 49, 150, 153, 98, 151, 155, 154, 193, 152, 93, 355, 192, 3, 36, 3, 130, 356, 158, 357, 4, 68, 56, 44, 2, 358, -344, -344, -344, 5, 68, 8, 48, 44, 2, -342, 359, -342, -342, -342, 23, 39, 83, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 360, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 3, 174, 2, 1, 361, 362, 363, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 364, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 60, 1, 5, 27, 2, 1, 2, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -201, -201, -170, -201, 365, -170, 158, -201, -170, -170, -170, -170, -170, -201, -201, -170, -201, -201, -201, -170, -170, -170, -170, -170, -201, -170, -201, -170, -201, -201, -201, -201, 366, -170, -170, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, -201, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, 120, -298, -298, -298, -298, -298, -298, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 2, 47, 74, 367, 93, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, 120, -50, -50, -50, -50, -50, -50, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 2, 47, 74, 368, 93, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 369, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 3, 33, 3, 3, 370, 371, 158, 9, 1, 5, 29, 4, 1, 21, 7, 16, 78, -367, -367, -367, -367, -367, -367, -367, -367, -367, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, 31, 1, 5, 29, 4, 1, 21, 7, 16, 38, 40, 1, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -116, -116, -116, -116, -116, -116, -116, -116, 121, -116, 120, -116, -116, -116, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 2, 47, 74, 372, 93, 13, 1, 5, 29, 4, 1, 21, 7, 16, 78, 2, 1, 17, 1, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, 2, 48, 20, 373, 374, 1, 48, 375, 7, 32, 7, 10, 76, 9, 1, 2, 380, 379, 98, 376, 377, 378, 381, 2, 48, 20, -221, -221, 1, 136, 382, 7, 32, 7, 10, 76, 12, 3, 2, 387, 386, 98, 383, 388, 384, 385, 13, 1, 5, 29, 4, 1, 21, 7, 16, 78, 2, 1, 17, 1, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, 13, 1, 5, 29, 4, 1, 21, 7, 16, 78, 2, 1, 17, 1, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, 1, 76, 389, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 390, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 391, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 1, 48, 392, 2, 6, 156, 101, 393, 99, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 394, 3, 4, 5, 6, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 31, 6, 29, 4, 1, 28, 16, 2, 36, 28, 1, 12, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -272, -272, -272, -272, -272, -272, 306, 121, 395, 305, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 58, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, 103, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 6, 2, 2, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 336, 232, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 230, 31, 69, 71, 72, 73, 74, 75, 87, 77, 396, 81, 234, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 233, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 398, 397, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 9, 6, 29, 4, 1, 28, 16, 24, 17, 24, -125, -125, -125, -125, 400, -125, 401, -125, 399, 56, 6, 5, 20, 8, 1, 3, 3, 3, 4, 2, 1, 7, 1, 4, 2, 1, 1, 1, 1, 1, 8, 1, 1, 1, 5, 3, 8, 1, 3, 1, 12, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 3, 1, 2, 4, 2, 6, 2, 3, 1, 1, 1, 1, 1, 1, 1, 402, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, 5, 6, 33, 1, 28, 16, -276, -276, -276, -276, -276, 106, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 7, 1, 2, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 1, 1, 4, 1, 1, 2, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 336, 232, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 229, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 230, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 234, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 233, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 404, 403, 231, 228, 227, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 56, 6, 5, 20, 8, 1, 3, 3, 3, 4, 2, 1, 7, 1, 4, 2, 1, 1, 1, 1, 1, 8, 1, 1, 1, 5, 3, 8, 1, 3, 1, 12, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 3, 1, 2, 4, 2, 6, 2, 3, 1, 1, 1, 1, 1, 1, 1, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, 5, 6, 33, 1, 28, 16, -281, -281, -281, -281, -281, 6, 6, 29, 4, 1, 28, 16, -273, -273, -273, -273, -273, -273, 6, 6, 29, 4, 1, 28, 16, -274, -274, -274, -274, -274, -274, 100, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 2, 1, 3, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 7, 1, 1, 1, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, -275, 405, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, -275, 30, -275, -275, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, -275, 31, 69, 71, 72, 73, 74, 75, 87, 77, -275, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 54, 1, 5, 27, 2, 4, 1, 15, 1, 5, 5, 2, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, 2, 50, 1, 406, 241, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 407, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 408, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 103, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 2, 4, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 6, 1, 6, 4, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 336, 232, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 409, 30, 412, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 234, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 233, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 410, 80, 411, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 54, 1, 5, 27, 2, 4, 1, 15, 1, 5, 5, 2, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, 2, 50, 1, 413, 241, 2, 50, 1, 414, 241, 24, 36, 3, 83, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 415, 158, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 24, 36, 3, 83, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 416, 158, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, 121, -302, -302, 417, -302, -302, 120, 90, 91, -302, -302, -302, -302, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, 121, -304, -304, 418, -304, -304, 120, 90, 91, -304, -304, -304, -304, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, 121, -311, -311, -311, -311, -311, 120, 90, 91, -311, -311, -311, -311, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 6, 6, 33, 1, 28, 12, 45, -82, -82, -82, -82, 419, -82, 8, 6, 29, 4, 1, 28, 16, 24, 17, -125, -125, -125, -125, 421, -125, 420, -125, 7, 6, 33, 1, 28, 8, 4, 45, -91, -91, -91, -91, 422, -91, -91, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 423, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 3, 50, 1, 32, 240, 241, 424, 6, 6, 33, 1, 28, 12, 45, -94, -94, -94, -94, -94, -94, 5, 6, 33, 1, 28, 57, -193, -193, -193, -193, -193, 15, 6, 27, 6, 1, 28, 8, 4, 15, 1, 1, 1, 1, 2, 24, 19, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, 15, 6, 27, 6, 1, 28, 8, 4, 15, 1, 1, 1, 1, 2, 24, 19, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, 15, 6, 27, 6, 1, 28, 8, 4, 15, 1, 1, 1, 1, 2, 24, 19, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, 5, 6, 33, 1, 28, 57, -83, -83, -83, -83, -83, 17, 32, 15, 2, 1, 1, 30, 1, 3, 2, 1, 1, 1, 1, 3, 27, 25, 15, 257, 427, 98, 258, 241, 425, 259, 81, 426, 428, 429, 430, 431, 432, 93, 80, 76, 54, 1, 5, 27, 2, 4, 1, 15, 1, 5, 5, 2, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -177, -177, -177, -177, -177, -177, -177, -177, -177, 433, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, -177, 58, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, 6, 54, 1, 1, 2, 1, 1, 267, 99, 100, 434, 435, 266, 4, 55, 1, 2, 2, -61, -61, -61, -61, 101, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 5, 1, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 436, 3, 4, 5, 6, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 437, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 438, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 4, 55, 1, 2, 2, -66, -66, -66, -66, 5, 1, 5, 34, 21, 101, -4, -4, -4, -4, -4, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, 120, -380, -380, -380, -380, -380, -380, 119, -380, -380, 102, 105, 106, -380, -380, -380, -380, -380, -380, -380, 114, 115, -380, -380, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, 120, -381, -381, -381, -381, -381, -381, 119, -381, -381, 102, 105, 106, -381, -381, -381, -381, -381, -381, -381, 114, 115, -381, -381, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, 120, -382, -382, -382, -382, -382, -382, 119, -382, -382, 102, -382, 106, -382, -382, -382, -382, -382, -382, -382, 114, 115, -382, -382, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, 120, -383, -383, -383, -383, -383, -383, 119, -383, -383, 102, -383, 106, -383, -383, -383, -383, -383, -383, -383, 114, 115, -383, -383, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, 120, -384, -384, -384, -384, -384, -384, 119, 104, 103, 102, 105, 106, -384, -384, -384, -384, -384, -384, -384, 114, 115, -384, -384, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, 120, -385, -385, -385, -385, -385, -385, 119, 104, 103, 102, 105, 106, 107, -385, -385, -385, -385, -385, -385, 114, 115, 116, -385, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, 120, -386, -386, -386, -386, -386, -386, 119, 104, 103, 102, 105, 106, 107, 108, -386, -386, -386, -386, -386, 114, 115, 116, -386, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, 120, -387, -387, -387, -387, -387, -387, 119, 104, 103, 102, 105, 106, 107, 108, 109, -387, -387, -387, -387, 114, 115, 116, -387, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, 120, -388, -388, -388, -388, -388, -388, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, -388, -388, -388, 114, 115, 116, -388, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, 120, -389, -389, -389, -389, -389, -389, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, -389, -389, 114, 115, 116, -389, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, 120, -390, -390, -390, -390, -390, -390, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, -390, 114, 115, 116, -390, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, 121, -391, -391, -391, -391, -391, 120, 90, 91, -391, -391, -391, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, 121, -392, -392, -392, -392, -392, 120, 90, 91, -392, -392, -392, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, 120, -393, -393, -393, -393, -393, -393, 119, 104, 103, 102, 105, 106, 107, -393, -393, -393, -393, -393, -393, 114, 115, -393, -393, 23, 80, 42, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 439, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, -362, 121, -362, -362, -362, -362, -362, 120, 90, 91, -362, -362, -362, -362, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, -364, 121, -364, -364, -364, -364, -364, 120, 90, 91, -364, -364, -364, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 3, 124, 44, 2, 441, 440, 442, 11, 32, 15, 2, 33, 1, 2, 25, 1, 10, 2, 49, 150, 153, 98, 151, 155, 154, 193, 152, 93, 443, 192, 11, 32, 15, 2, 33, 1, 2, 25, 1, 10, 2, 49, 150, 153, 98, 151, 155, 154, 193, 152, 93, 444, 192, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, 445, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, -361, 121, -361, -361, -361, -361, -361, 120, 90, 91, -361, -361, -361, -361, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, -363, 121, -363, -363, -363, -363, -363, 120, 90, 91, -363, -363, -363, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 54, 1, 5, 27, 2, 4, 1, 15, 1, 5, 5, 2, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, 54, 1, 5, 27, 2, 4, 1, 15, 1, 5, 5, 2, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, 54, 1, 5, 27, 2, 4, 1, 15, 1, 5, 5, 2, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, 26, 86, 14, 22, 28, 1, 12, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 306, 446, 121, 447, 305, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 1, 2, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 4, 1, 5, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 448, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 306, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 449, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 303, 305, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 1, 100, 450, 1, 100, 451, 96, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 3, 3, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 6, 2, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 452, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, -266, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, -266, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -73, -73, -73, -73, -73, -73, -73, -73, -73, 453, -73, -73, -73, -73, -73, -73, -73, -73, -70, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, 52, 11, 20, 9, 3, 3, 3, 4, 2, 1, 7, 1, 6, 1, 1, 1, 1, 1, 8, 2, 6, 3, 6, 2, 1, 3, 1, 12, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 3, 1, 2, 4, 2, 6, 2, 3, 1, 1, 1, 1, 1, 1, 1, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, 52, 11, 20, 9, 3, 3, 3, 4, 2, 1, 7, 1, 6, 1, 1, 1, 1, 1, 8, 2, 6, 3, 6, 2, 1, 3, 1, 12, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 3, 1, 2, 4, 2, 6, 2, 3, 1, 1, 1, 1, 1, 1, 1, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, 99, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 1, 2, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 4, 1, 5, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 454, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 455, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 306, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 456, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 303, 305, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 457, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 458, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, -161, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, -162, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, -163, 23, 100, 22, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 459, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 460, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 461, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 462, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, 120, -79, -79, -79, -79, -79, -79, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 463, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 464, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, 121, -32, -32, -32, -32, -32, 120, 90, 91, -32, -32, -32, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 465, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 466, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, 121, -35, -35, -35, -35, -35, 120, 90, 91, -35, -35, -35, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 467, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 468, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, 121, -38, -38, -38, -38, -38, 120, 90, 91, -38, -38, -38, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 469, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 470, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, 121, -41, -41, -41, -41, -41, 120, 90, 91, -41, -41, -41, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 471, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 472, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 3, 105, 1, 1, 473, 84, 85, 17, 6, 26, 3, 4, 1, 7, 2, 33, 1, 1, 1, 1, 23, 1, 1, 10, 4, -126, 150, -126, -126, -126, 153, 98, 151, 155, -126, 154, 149, 474, 148, 152, 93, -126, 2, 6, 33, 475, 476, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 477, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 6, 6, 29, 4, 1, 28, 36, -134, -134, -134, -134, -134, -134, 28, 6, 29, 4, 1, 28, 16, 38, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -272, -272, -272, -272, -272, -272, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 57, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 7, 1, 3, 2, 1, 3, 1, 1, 5, 2, 5, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, 2, 6, 34, 101, 478, 9, 6, 29, 4, 1, 28, 16, 20, 4, 17, -125, -125, -125, -125, 332, -125, 479, 333, -125, 1, 40, 480, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, 120, -395, -395, -395, -395, -395, -395, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 481, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 482, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, 121, -45, -45, -45, -45, -45, 120, 90, 91, -45, -45, -45, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 23, 40, 82, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 483, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, -359, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 484, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 7, 4, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, 485, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, 2, 36, 3, 486, 158, 6, 32, 4, 3, 8, 2, 72, 487, 489, 158, 488, 98, 93, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 490, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 491, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 492, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 1, 124, 493, 1, 170, 494, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 495, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 10, 32, 15, 2, 33, 1, 2, 25, 1, 10, 51, 150, 153, 98, 151, 155, 154, 193, 152, 93, 496, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 497, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 3, 174, 2, 1, 498, 362, 363, 4, 40, 135, 1, 1, 499, 500, 501, 363, 3, 40, 135, 2, -350, -350, -350, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 9, 1, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 503, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 502, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 43, 1, 5, 29, 1, 3, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -199, -199, -199, 504, 158, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, -199, 120, -199, -199, -199, -199, -199, -199, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, -202, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 505, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 1, 40, 506, 1, 40, 507, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, 120, -52, -52, -52, -52, -52, -52, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 18, 6, 26, 2, 1, 4, 1, 7, 2, 19, 14, 1, 2, 1, 18, 5, 1, 1, 10, -127, 150, 508, -127, -127, -127, 153, 98, -127, 151, 155, 154, 149, -127, 147, 148, 152, 93, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, 1, 40, 509, 3, 54, 1, 1, 510, 99, 100, 3, 121, 12, 5, 512, 511, 214, 3, 54, 1, 1, 513, 99, 100, 1, 48, 514, 8, 6, 29, 4, 1, 28, 16, 24, 17, -125, -125, -125, -125, 516, -125, 515, -125, 5, 6, 33, 1, 28, 57, -212, -212, -212, -212, -212, 6, 32, 7, 10, 85, 1, 2, 380, 379, 98, 517, 378, 381, 6, 6, 33, 1, 28, 57, 11, -217, -217, -217, -217, -217, 518, 6, 6, 33, 1, 28, 57, 11, -219, -219, -219, -219, -219, 519, 2, 32, 17, 520, 98, 14, 1, 5, 29, 4, 1, 8, 13, 7, 16, 78, 2, 1, 17, 1, -223, -223, -223, -223, -223, 521, -223, -223, -223, -223, -223, -223, -223, -223, 8, 6, 29, 4, 1, 28, 16, 24, 17, -125, -125, -125, -125, 523, -125, 522, -125, 5, 6, 33, 1, 28, 57, -235, -235, -235, -235, -235, 6, 32, 7, 10, 88, 3, 2, 387, 386, 98, 388, 524, 385, 6, 6, 33, 1, 28, 57, 11, -240, -240, -240, -240, -240, 525, 6, 6, 33, 1, 28, 57, 11, -243, -243, -243, -243, -243, 526, 96, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 528, 527, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 529, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 31, 1, 5, 29, 4, 1, 21, 7, 16, 38, 40, 1, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -230, -230, -230, -230, -230, -230, -230, -230, 121, -230, 120, 90, 91, -230, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 2, 47, 74, 530, 93, 3, 54, 1, 1, 531, 99, 100, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, 2, 6, 34, 101, 532, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 533, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 58, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, 56, 6, 5, 20, 8, 1, 3, 3, 3, 4, 2, 1, 7, 1, 4, 2, 1, 1, 1, 1, 1, 8, 1, 1, 1, 5, 3, 8, 1, 3, 1, 12, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 3, 1, 2, 4, 2, 6, 2, 3, 1, 1, 1, 1, 1, 1, 1, 402, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, 5, 6, 33, 1, 28, 16, -282, -282, -282, -282, -282, 2, 39, 45, 535, 534, 110, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 2, 1, 3, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 3, 4, 2, 8, 7, 1, 5, 1, 1, 2, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, -126, 336, 232, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, -126, 30, -126, -126, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 230, 31, 69, 71, 72, 73, 74, 75, 87, 77, -126, 81, 234, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 233, 49, 33, 35, 38, 82, 83, 93, 56, -126, 58, 64, 65, 80, 537, 231, 536, 227, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 4, 6, 33, 1, 44, 538, -283, -283, -283, 56, 6, 5, 20, 8, 1, 3, 3, 3, 4, 2, 1, 7, 1, 4, 2, 1, 1, 1, 1, 1, 8, 1, 1, 1, 5, 3, 8, 1, 3, 1, 12, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 3, 1, 2, 4, 2, 6, 2, 3, 1, 1, 1, 1, 1, 1, 1, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, 9, 6, 29, 4, 1, 28, 16, 24, 17, 24, -125, -125, -125, -125, 400, -125, 401, -125, 539, 102, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 7, 1, 2, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 6, 2, 2, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 336, 232, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 230, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 234, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 233, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 398, 397, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 28, 6, 29, 4, 1, 28, 16, 38, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -140, -140, -140, -140, -140, -140, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, 23, 100, 22, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 540, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 541, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 54, 1, 5, 27, 2, 4, 1, 15, 1, 5, 5, 2, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, 8, 6, 29, 4, 1, 28, 16, 24, 17, -125, -125, -125, -125, 543, -125, 542, -125, 5, 6, 29, 4, 1, 28, -267, -267, -267, -267, -267, 102, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 6, 1, 6, 4, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 336, 232, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 412, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 234, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 233, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 544, 80, 411, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 5, 7, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 5, 7, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, 545, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 546, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 547, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 548, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 549, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 3, 6, 33, 86, 551, 552, 550, 23, 6, 26, 3, 4, 1, 9, 1, 1, 1, 1, 1, 1, 1, 21, 1, 1, 2, 1, 1, 1, 1, 1, 39, -126, 257, -126, -126, -126, 98, 258, 241, 255, 94, 95, 99, 100, 553, 554, 260, 252, 259, 253, -126, 254, 261, -126, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 555, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 556, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 23, 84, 38, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 557, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 558, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 16, 6, 27, 6, 1, 15, 1, 12, 24, 3, 1, 1, 1, 1, 2, 24, 19, -95, -97, -95, -95, -250, -250, -95, 559, -97, -97, -97, -97, -97, -97, -95, 134, 16, 6, 27, 6, 1, 15, 1, 12, 24, 3, 1, 1, 1, 1, 2, 24, 19, -96, -250, -96, -96, -250, -250, -96, 560, 561, 562, 563, 564, 565, 566, -96, 134, 13, 6, 27, 6, 1, 28, 27, 1, 1, 1, 1, 2, 24, 19, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, 13, 6, 27, 6, 1, 28, 27, 1, 1, 1, 1, 2, 24, 19, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, 13, 6, 27, 6, 1, 28, 27, 1, 1, 1, 1, 2, 24, 19, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, 13, 6, 27, 6, 1, 28, 27, 1, 1, 1, 1, 2, 24, 19, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, 7, 33, 22, 1, 36, 3, 4, 45, -250, -250, -250, 567, 236, 237, 134, 2, 33, 60, 238, 568, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, 56, 1, 5, 27, 2, 4, 1, 15, 1, 2, 2, 1, 5, 2, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, -60, 4, 55, 1, 2, 2, -62, -62, -62, -62, 2, 6, 55, 101, 569, 99, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 570, 3, 4, 5, 6, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 4, 55, 1, 2, 2, -65, -65, -65, -65, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 571, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 572, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 573, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 574, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 1, 124, 575, 1, 170, 576, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 577, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, -149, 96, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 3, 3, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 6, 2, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 578, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, -264, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, -264, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 26, 40, 46, 36, 28, 1, 12, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 579, 306, 121, 447, 305, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 1, 40, 580, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, -151, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, -153, 24, 40, 60, 22, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -265, -265, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 581, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 26, 86, 14, 22, 28, 1, 12, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 306, 582, 121, 447, 305, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 98, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 1, 2, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 4, 1, 5, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 583, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 306, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 584, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 303, 305, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 1, 100, 585, 23, 100, 22, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 586, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 587, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, 23, 40, 82, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 588, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 23, 100, 22, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 589, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 590, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, 120, -80, -80, -80, -80, -80, -80, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 23, 40, 82, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 591, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, 121, -33, -33, -33, -33, -33, 120, 90, 91, -33, -33, -33, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 23, 40, 82, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 592, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, 121, -36, -36, -36, -36, -36, 120, 90, 91, -36, -36, -36, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 23, 40, 82, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 593, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, 121, -39, -39, -39, -39, -39, 120, 90, 91, -39, -39, -39, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 23, 40, 82, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 594, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, 121, -42, -42, -42, -42, -42, 120, 90, 91, -42, -42, -42, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 23, 40, 82, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 595, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 100, 5, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 1, 2, 4, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 597, 4, 5, 6, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 596, 30, 158, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 6, 6, 29, 4, 1, 28, 36, -129, -129, -129, -129, -129, -129, 11, 32, 15, 2, 33, 1, 2, 1, 23, 1, 1, 10, 150, 153, 98, 151, 155, 154, 149, 598, 148, 152, 93, 18, 6, 26, 2, 1, 4, 1, 7, 2, 19, 14, 1, 2, 1, 18, 5, 1, 1, 10, -127, 150, 599, -127, -127, -127, 153, 98, -127, 151, 155, 154, 149, -127, 147, 148, 152, 93, 28, 6, 29, 4, 1, 28, 36, 18, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -133, -133, -133, -133, -133, -133, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 57, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 7, 1, 3, 2, 1, 3, 1, 1, 5, 2, 5, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, 3, 105, 1, 1, 600, 84, 85, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, 23, 40, 82, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 601, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, 120, -397, -397, -397, -397, -397, -397, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, 24, 36, 3, 83, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 602, 158, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 2, 36, 3, 603, 158, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, 2, 36, 3, 604, 158, 2, 36, 3, 605, 158, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 7, 4, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, 26, 36, 3, 83, 4, 37, 1, 1, 4, 13, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 606, 158, 121, 607, 120, 90, 91, 608, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 25, 36, 3, 83, 4, 37, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 609, 158, 121, 610, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 25, 36, 3, 83, 4, 37, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 611, 158, 121, 612, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 613, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 614, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 24, 36, 3, 83, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 615, 158, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 3, 124, 44, 2, -345, -345, -345, 26, 68, 54, 2, 39, 1, 1, 3, 2, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -343, 121, -343, 120, 90, 91, -343, -343, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 4, 40, 135, 1, 1, 616, 617, 501, 363, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, 2, 36, 3, 618, 158, 3, 40, 135, 2, -351, -351, -351, 3, 36, 3, 29, 619, 158, 620, 24, 39, 29, 54, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -289, -289, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, -200, 43, 1, 5, 29, 1, 3, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -203, -203, -203, 621, 158, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, -203, 120, -203, -203, -203, -203, -203, -203, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, 8, 6, 29, 4, 1, 28, 16, 24, 17, -125, 622, -125, -125, 332, -125, 333, -125, 13, 1, 5, 29, 4, 1, 21, 7, 16, 78, 2, 1, 17, 1, -117, -117, -117, -117, -117, -117, -117, -117, -117, -117, -117, -117, -117, 13, 1, 5, 29, 4, 1, 21, 7, 16, 78, 2, 1, 17, 1, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, 1, 48, 623, 6, 32, 7, 10, 85, 1, 2, 380, 379, 98, 624, 378, 381, 13, 1, 5, 29, 4, 1, 21, 7, 16, 78, 2, 1, 17, 1, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, 3, 54, 1, 1, 625, 99, 100, 3, 6, 33, 86, 627, 628, 626, 10, 6, 26, 3, 4, 1, 9, 35, 41, 10, 2, -126, 380, -126, -126, -126, 98, -126, -126, 629, 381, 8, 6, 29, 4, 1, 28, 16, 24, 17, -125, -125, -125, -125, 516, -125, 630, -125, 2, 32, 17, 631, 98, 2, 32, 17, 632, 98, 1, 48, -222, 3, 54, 1, 1, 633, 99, 100, 3, 6, 33, 86, 635, 636, 634, 10, 6, 26, 3, 4, 1, 9, 35, 41, 12, 5, -126, 387, -126, -126, -126, 98, -126, -126, 388, 637, 8, 6, 29, 4, 1, 28, 16, 24, 17, -125, -125, -125, -125, 523, -125, 638, -125, 3, 32, 17, 88, 639, 98, 640, 2, 32, 17, 641, 98, 31, 1, 5, 29, 4, 1, 21, 7, 16, 38, 40, 1, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -227, -227, -227, -227, -227, -227, -227, -227, 121, -227, 120, -227, -227, -227, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 642, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 643, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 1, 40, 644, 13, 1, 5, 29, 4, 1, 21, 7, 16, 78, 2, 1, 17, 1, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, 1, 162, 645, 23, 84, 38, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 646, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 58, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, 106, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 7, 1, 2, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 1, 1, 4, 1, 1, 2, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 336, 232, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 229, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 230, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 234, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 233, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 404, 647, 231, 228, 227, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 5, 6, 33, 1, 28, 16, -277, -277, -277, -277, -277, 105, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 1, 3, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 6, 2, 2, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 336, 232, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, -284, -284, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 230, 31, 69, 71, 72, 73, 74, 75, 87, 77, -284, 81, 234, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 233, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 398, 397, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 104, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 7, 1, 2, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 1, 5, 1, 1, 2, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 336, 232, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 230, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 234, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 233, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 404, 231, 648, 227, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 2, 39, 1, 535, 649, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, 23, 40, 82, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 650, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 3, 6, 29, 4, 652, 651, 653, 106, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 2, 2, 1, 3, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 3, 4, 2, 8, 7, 6, 4, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, -126, 336, 232, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, -126, 30, -126, -126, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, -126, 81, 234, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 233, 49, 33, 35, 38, 82, 83, 93, 56, -126, 58, 64, 65, 80, 654, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 8, 6, 29, 4, 1, 28, 16, 24, 17, -125, -125, -125, -125, 543, -125, 655, -125, 2, 36, 3, 656, 158, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, 120, -303, -303, -303, -303, -303, -303, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, 120, -305, -305, -305, -305, -305, -305, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 27, 6, 33, 1, 28, 54, 3, 38, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -84, -84, -84, -84, 657, -84, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 658, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 58, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, 17, 32, 17, 1, 1, 1, 1, 1, 1, 1, 21, 1, 1, 2, 1, 1, 2, 1, 257, 98, 258, 241, 255, 94, 95, 99, 100, 659, 554, 260, 252, 259, 253, 254, 261, 23, 6, 26, 7, 1, 9, 1, 1, 1, 1, 1, 1, 1, 12, 9, 1, 1, 2, 1, 1, 2, 1, 39, 3, -192, 257, -192, -192, 98, 258, 241, 255, 94, 95, 99, 100, -192, 256, 554, 260, 252, 259, 253, 254, 261, -192, 660, 5, 6, 33, 1, 28, 57, -194, -194, -194, -194, -194, 6, 6, 33, 1, 28, 12, 45, -82, -82, -82, -82, 661, -82, 27, 6, 33, 1, 28, 54, 3, 38, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -86, -86, -86, -86, 121, -86, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 662, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 6, 6, 33, 1, 28, 12, 45, -92, -92, -92, -92, -92, -92, 23, 84, 38, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 663, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 2, 33, 60, 238, 664, 2, 33, 60, 238, 665, 2, 50, 1, 666, 241, 2, 50, 1, 667, 241, 15, 6, 27, 6, 1, 10, 1, 17, 27, 1, 1, 1, 1, 2, 24, 19, -110, -110, -110, -110, 668, 241, -110, -110, -110, -110, -110, -110, -110, -110, -110, 15, 6, 27, 6, 1, 10, 1, 17, 27, 1, 1, 1, 1, 2, 24, 19, -111, -111, -111, -111, 669, 241, -111, -111, -111, -111, -111, -111, -111, -111, -111, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 670, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 671, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 1, 99, 672, 2, 33, 60, 238, 673, 13, 6, 27, 6, 1, 28, 27, 1, 1, 1, 1, 2, 24, 19, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, 4, 55, 1, 2, 2, -63, -63, -63, -63, 2, 6, 34, 101, 674, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, 120, -394, -394, -394, -394, -394, -394, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, 675, -327, -327, 120, -327, -327, -327, 676, -327, -327, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, 677, -332, -332, 120, -332, -332, -332, -332, -332, -332, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, 678, -336, -336, 120, -336, -336, -336, -336, -336, -336, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 679, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 680, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, 120, -341, -341, -341, -341, -341, -341, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 24, 40, 60, 22, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -263, -263, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 1, 100, 681, 1, 100, 682, 23, 100, 22, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -69, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, 26, 40, 46, 36, 28, 1, 12, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 683, 306, 121, 447, 305, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 1, 40, 684, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, 23, 40, 82, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 685, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 1, 100, 686, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, 23, 40, 82, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 687, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, -34, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, -119, 9, 1, 5, 29, 4, 1, 21, 7, 16, 78, -121, -121, -121, -121, -121, -121, -121, -121, -121, 6, 6, 29, 4, 1, 28, 36, -130, -130, -130, -130, -130, -130, 8, 6, 29, 4, 1, 28, 16, 24, 17, -125, -125, -125, -125, 332, -125, 688, -125, 2, 36, 3, 596, 158, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 5, 7, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 7, 4, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 7, 4, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 689, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 690, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 691, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 692, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 25, 36, 3, 83, 4, 37, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 693, 158, 121, 694, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 25, 36, 3, 83, 4, 37, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 695, 158, 121, 696, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, -346, 2, 36, 3, 697, 158, 1, 40, 698, 4, 6, 34, 135, 2, 699, -352, -352, -352, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 700, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, -204, 2, 36, 3, 701, 158, 3, 54, 1, 1, 702, 99, 100, 8, 6, 29, 4, 1, 28, 16, 24, 17, -125, -125, -125, -125, 516, -125, 703, -125, 13, 1, 5, 29, 4, 1, 21, 7, 16, 78, 2, 1, 17, 1, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, 1, 48, 704, 4, 32, 17, 86, 2, 380, 98, 705, 381, 6, 32, 7, 10, 85, 1, 2, 380, 379, 98, 706, 378, 381, 5, 6, 33, 1, 28, 57, -213, -213, -213, -213, -213, 3, 6, 33, 1, 627, 628, 707, 5, 6, 33, 1, 28, 57, -218, -218, -218, -218, -218, 5, 6, 33, 1, 28, 57, -220, -220, -220, -220, -220, 13, 1, 5, 29, 4, 1, 21, 7, 16, 78, 2, 1, 17, 1, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, 14, 1, 5, 29, 4, 1, 8, 13, 7, 16, 78, 2, 1, 17, 1, -224, -224, -224, -224, -224, 708, -224, -224, -224, -224, -224, -224, -224, -224, 4, 32, 17, 88, 5, 387, 98, 388, 709, 6, 32, 7, 10, 88, 3, 2, 387, 386, 98, 388, 710, 385, 5, 6, 33, 1, 28, 57, -236, -236, -236, -236, -236, 3, 6, 33, 1, 635, 636, 711, 5, 6, 33, 1, 28, 57, -241, -241, -241, -241, -241, 5, 6, 33, 1, 28, 57, -242, -242, -242, -242, -242, 5, 6, 33, 1, 28, 57, -244, -244, -244, -244, -244, 31, 1, 5, 29, 4, 1, 21, 7, 16, 38, 40, 1, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -228, -228, -228, -228, -228, -228, -228, -228, 121, -228, 120, -228, -228, -228, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 23, 40, 82, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 712, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 13, 1, 5, 29, 4, 1, 21, 7, 16, 78, 2, 1, 17, 1, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, 9, 6, 29, 4, 1, 28, 16, 24, 17, 24, -125, -125, -125, -125, 400, -125, 401, -125, 713, 5, 6, 33, 1, 28, 16, -278, -278, -278, -278, -278, 5, 6, 33, 1, 28, 16, -279, -279, -279, -279, -279, 1, 100, 714, 54, 1, 5, 27, 2, 4, 1, 15, 1, 5, 5, 2, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, 100, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 6, 4, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 336, 232, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 234, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 233, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 715, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 102, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 1, 1, 1, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 1, 2, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 1, 1, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 6, 1, 6, 4, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 336, 232, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 412, 50, 24, 25, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 234, 32, 37, 36, 78, 79, 63, 39, 40, 84, 85, 66, 233, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 716, 80, 411, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 41, 42, 62, 43, 44, 45, 47, 48, 5, 6, 29, 4, 1, 28, -268, -268, -268, -268, -268, 3, 6, 33, 1, 652, 653, 717, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, 14, 32, 15, 2, 33, 1, 2, 25, 1, 5, 5, 2, 4, 44, 1, 150, 153, 98, 151, 77, 154, 193, 152, 289, 93, 718, 719, 288, 192, 23, 40, 82, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 720, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 5, 6, 33, 1, 28, 57, -195, -195, -195, -195, -195, 8, 6, 29, 4, 1, 28, 16, 24, 17, -125, -125, -125, -125, 421, -125, 721, -125, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 722, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 549, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 23, 40, 82, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 723, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 6, 6, 33, 1, 28, 12, 45, -93, -93, -93, -93, -93, -93, 13, 6, 27, 6, 1, 28, 27, 1, 1, 1, 1, 2, 24, 19, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, 13, 6, 27, 6, 1, 28, 27, 1, 1, 1, 1, 2, 24, 19, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, 13, 6, 27, 6, 1, 28, 27, 1, 1, 1, 1, 2, 24, 19, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, 13, 6, 27, 6, 1, 28, 27, 1, 1, 1, 1, 2, 24, 19, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, 13, 6, 27, 6, 1, 28, 27, 1, 1, 1, 1, 2, 24, 19, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, 13, 6, 27, 6, 1, 28, 27, 1, 1, 1, 1, 2, 24, 19, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, 23, 100, 22, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 724, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 725, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 95, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 4, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 726, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 727, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 13, 6, 27, 6, 1, 28, 27, 1, 1, 1, 1, 2, 24, 19, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, 1, 61, 728, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 729, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 730, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 731, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 732, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, 733, -334, -334, 120, -334, -334, -334, -334, -334, -334, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, 734, -338, -338, 120, -338, -338, -338, -338, -338, -338, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, -150, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, -152, 1, 100, 735, 1, 100, 736, 1, 100, 737, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, 1, 100, 738, 3, 6, 33, 1, 475, 476, 739, 25, 36, 3, 83, 41, 1, 1, 4, 13, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 740, 158, 121, 120, 90, 91, 741, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 25, 36, 3, 83, 4, 37, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 742, 158, 121, 743, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 24, 36, 3, 83, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 744, 158, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 24, 36, 3, 83, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 745, 158, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 746, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 747, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 1, 40, 748, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, 3, 40, 135, 2, -353, -353, -353, 24, 39, 29, 54, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -290, -290, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, 13, 1, 5, 29, 4, 1, 21, 7, 16, 78, 2, 1, 17, 1, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, 3, 6, 33, 86, 627, 628, 749, 3, 54, 1, 1, 750, 99, 100, 5, 6, 33, 1, 28, 57, -214, -214, -214, -214, -214, 8, 6, 29, 4, 1, 28, 16, 24, 17, -125, -125, -125, -125, 516, -125, 751, -125, 5, 6, 33, 1, 28, 57, -215, -215, -215, -215, -215, 3, 54, 1, 1, 752, 99, 100, 5, 6, 33, 1, 28, 57, -237, -237, -237, -237, -237, 8, 6, 29, 4, 1, 28, 16, 24, 17, -125, -125, -125, -125, 523, -125, 753, -125, 5, 6, 33, 1, 28, 57, -238, -238, -238, -238, -238, 13, 1, 5, 29, 4, 1, 21, 7, 16, 78, 2, 1, 17, 1, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, 2, 39, 1, 535, 754, 53, 1, 5, 27, 2, 4, 1, 15, 1, 5, 7, 12, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, 5, 6, 29, 4, 1, 28, -269, -269, -269, -269, -269, 8, 6, 29, 4, 1, 28, 16, 24, 17, -125, -125, -125, -125, 543, -125, 755, -125, 5, 6, 29, 4, 1, 28, -270, -270, -270, -270, -270, 3, 124, 44, 2, 756, 440, 442, 11, 32, 15, 2, 33, 1, 2, 25, 1, 10, 2, 49, 150, 153, 98, 151, 155, 154, 193, 152, 93, 757, 192, 5, 6, 33, 1, 28, 57, -85, -85, -85, -85, -85, 3, 6, 33, 1, 551, 552, 758, 27, 6, 33, 1, 28, 54, 3, 38, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -84, -84, -84, -84, 121, -84, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 5, 6, 33, 1, 28, 57, -87, -87, -87, -87, -87, 13, 6, 27, 6, 1, 28, 27, 1, 1, 1, 1, 2, 24, 19, -112, -112, -112, -112, -112, -112, -112, -112, -112, -112, -112, -112, -112, 23, 40, 82, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 759, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 23, 100, 22, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 760, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 761, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 4, 55, 1, 2, 2, -64, -64, -64, -64, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, -328, 120, -328, -328, -328, 762, -328, -328, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, 763, -329, -329, 120, -329, -329, -329, -329, -329, -329, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, 120, -333, -333, -333, -333, -333, -333, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, 120, -337, -337, -337, -337, -337, -337, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 764, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 765, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, 62, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 4, 13, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, 6, 6, 29, 4, 1, 28, 36, -131, -131, -131, -131, -131, -131, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 766, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 767, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, 24, 36, 3, 83, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 768, 158, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 24, 36, 3, 83, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 769, 158, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, 1, 48, 770, 13, 1, 5, 29, 4, 1, 21, 7, 16, 78, 2, 1, 17, 1, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, 3, 6, 33, 1, 627, 628, 771, 13, 1, 5, 29, 4, 1, 21, 7, 16, 78, 2, 1, 17, 1, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, 3, 6, 33, 1, 635, 636, 772, 5, 6, 33, 1, 28, 16, -280, -280, -280, -280, -280, 3, 6, 33, 1, 652, 653, 773, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 774, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 1, 124, 775, 5, 6, 33, 1, 28, 57, -196, -196, -196, -196, -196, 1, 100, 776, 13, 6, 27, 6, 1, 28, 27, 1, 1, 1, 1, 2, 24, 19, -114, -114, -114, -114, -114, -114, -114, -114, -114, -114, -114, -114, -114, 23, 40, 82, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 777, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 778, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 779, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, 120, -335, -335, -335, -335, -335, -335, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, 120, -339, -339, -339, -339, -339, -339, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 24, 36, 3, 83, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 780, 158, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 24, 36, 3, 83, 41, 1, 1, 17, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 781, 158, 121, 120, 90, 91, 118, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, 3, 54, 1, 1, 782, 99, 100, 5, 6, 33, 1, 28, 57, -216, -216, -216, -216, -216, 5, 6, 33, 1, 28, 57, -239, -239, -239, -239, -239, 5, 6, 29, 4, 1, 28, -271, -271, -271, -271, -271, 43, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 4, 14, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -332, -332, -332, -332, -332, -332, 785, -332, -332, -332, -332, -332, 783, -332, -332, -332, 784, -332, -332, 120, -332, -332, -332, -332, -332, -332, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 786, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 13, 6, 27, 6, 1, 28, 27, 1, 1, 1, 1, 2, 24, 19, -113, -113, -113, -113, -113, -113, -113, -113, -113, -113, -113, -113, -113, 1, 100, 787, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, 120, -330, -330, -330, -330, -330, -330, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 42, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, 120, -331, -331, -331, -331, -331, -331, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, 41, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 18, 2, 1, 1, 25, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, 13, 1, 5, 29, 4, 1, 21, 7, 16, 78, 2, 1, 17, 1, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, 1, 125, 788, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 789, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 6, 6, 29, 4, 1, 44, 41, -126, -126, -126, -126, -126, -126, 43, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 4, 14, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -334, -334, -334, -334, -334, -334, 785, -334, -334, -334, -334, -334, 790, -334, -334, -334, 791, -334, -334, 120, -334, -334, -334, -334, -334, -334, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 13, 6, 27, 6, 1, 28, 27, 1, 1, 1, 1, 2, 24, 19, -115, -115, -115, -115, -115, -115, -115, -115, -115, -115, -115, -115, -115, 58, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, 43, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 4, 14, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -333, -333, -333, -333, -333, -333, 785, -333, -333, -333, -333, -333, 792, -333, -333, -333, -333, -333, -333, 120, -333, -333, -333, -333, -333, -333, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 1, 125, 793, 94, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 3, 1, 2, 3, 1, 1, 1, 1, 6, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 7, 1, 2, 3, 1, 1, 1, 3, 8, 1, 2, 1, 1, 4, 2, 3, 1, 1, 1, 1, 1, 1, 7, 2, 8, 7, 10, 4, 1, 2, 1, 1, 1, 1, 4, 2, 5, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 794, 161, 26, 27, 28, 29, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 61, 86, 30, 50, 60, 67, 98, 68, 94, 95, 99, 100, 70, 96, 97, 34, 31, 69, 71, 72, 73, 74, 75, 87, 77, 81, 32, 37, 36, 78, 79, 63, 165, 166, 84, 85, 66, 49, 33, 35, 38, 82, 83, 93, 56, 58, 64, 65, 80, 53, 59, 76, 54, 90, 91, 55, 92, 46, 57, 51, 88, 52, 89, 167, 168, 169, 43, 44, 45, 47, 48, 1, 125, 795, 58, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, 43, 1, 5, 29, 4, 1, 21, 7, 12, 4, 2, 14, 4, 4, 14, 2, 1, 1, 25, 11, 1, 1, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -335, -335, -335, -335, -335, -335, 785, -335, -335, -335, -335, -335, 796, -335, -335, -335, -335, -335, -335, 120, -335, -335, -335, -335, -335, -335, 119, 104, 103, 102, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 58, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, 1, 125, 797, 58, 1, 5, 27, 2, 3, 1, 1, 1, 1, 1, 12, 1, 5, 7, 8, 4, 4, 2, 9, 1, 1, 1, 1, 1, 1, 3, 11, 7, 2, 1, 1, 17, 1, 7, 11, 2, 1, 3, 1, 1, 12, 1, 5, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190], t = [], p = 0, n, o, k2, a;
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
  ruleTable: [0, 0, 3, 0, 3, 1, 4, 1, 4, 3, 4, 2, 5, 1, 5, 1, 5, 1, 9, 1, 9, 1, 9, 1, 9, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 30, 6, 30, 3, 18, 3, 18, 4, 18, 5, 19, 3, 19, 4, 19, 5, 20, 3, 20, 4, 20, 5, 21, 3, 21, 4, 21, 5, 21, 2, 21, 3, 21, 4, 8, 1, 8, 1, 29, 1, 29, 2, 29, 4, 29, 3, 36, 2, 36, 3, 32, 1, 50, 1, 52, 1, 52, 1, 54, 1, 54, 3, 57, 1, 57, 2, 59, 3, 59, 5, 59, 2, 59, 1, 62, 1, 62, 3, 67, 3, 67, 1, 69, 1, 69, 1, 69, 1, 69, 1, 69, 1, 69, 1, 69, 1, 69, 1, 17, 3, 17, 4, 17, 5, 77, 1, 77, 1, 77, 3, 77, 5, 77, 3, 77, 5, 81, 1, 81, 1, 81, 1, 78, 1, 78, 3, 78, 4, 78, 1, 79, 2, 79, 2, 87, 1, 87, 1, 87, 1, 87, 1, 87, 1, 87, 3, 87, 2, 87, 3, 87, 3, 87, 3, 87, 3, 87, 3, 87, 3, 87, 2, 87, 2, 87, 4, 87, 6, 87, 5, 87, 7, 10, 2, 10, 4, 10, 1, 15, 5, 15, 2, 44, 5, 44, 2, 105, 1, 105, 1, 108, 0, 108, 1, 34, 0, 34, 1, 34, 3, 34, 4, 34, 6, 109, 1, 109, 3, 109, 2, 109, 1, 110, 1, 110, 1, 110, 1, 110, 1, 112, 2, 113, 1, 113, 1, 113, 3, 113, 3, 113, 3, 113, 3, 113, 2, 113, 2, 113, 4, 113, 6, 113, 4, 113, 6, 113, 4, 113, 5, 113, 7, 113, 5, 113, 7, 113, 5, 113, 7, 113, 3, 113, 3, 113, 3, 113, 3, 113, 2, 113, 2, 113, 4, 113, 6, 113, 5, 113, 7, 37, 1, 37, 1, 37, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 89, 3, 89, 4, 89, 6, 118, 3, 118, 3, 47, 10, 47, 12, 47, 11, 47, 13, 47, 4, 128, 0, 128, 1, 128, 3, 128, 4, 128, 6, 27, 1, 27, 2, 27, 3, 27, 4, 27, 2, 27, 3, 27, 4, 27, 5, 12, 2, 12, 4, 12, 4, 12, 5, 12, 7, 12, 6, 12, 9, 134, 1, 134, 3, 134, 4, 134, 4, 134, 6, 135, 1, 135, 3, 135, 1, 135, 3, 132, 1, 133, 3, 13, 3, 13, 5, 13, 2, 13, 2, 13, 4, 13, 5, 13, 6, 13, 3, 13, 5, 13, 4, 13, 5, 13, 7, 140, 1, 140, 3, 140, 4, 140, 4, 140, 6, 142, 1, 142, 3, 142, 3, 142, 1, 142, 3, 65, 3, 65, 3, 65, 3, 65, 2, 65, 2, 92, 0, 92, 1, 93, 2, 93, 4, 90, 1, 90, 1, 82, 2, 111, 2, 111, 3, 111, 4, 150, 1, 150, 1, 116, 5, 114, 3, 114, 2, 114, 2, 114, 1, 145, 1, 145, 3, 145, 4, 145, 4, 145, 6, 152, 1, 152, 1, 152, 1, 152, 1, 148, 1, 148, 3, 148, 4, 148, 4, 148, 6, 153, 1, 153, 2, 149, 1, 149, 2, 147, 1, 147, 2, 154, 1, 154, 2, 155, 1, 155, 3, 23, 2, 23, 3, 23, 4, 23, 5, 157, 3, 157, 3, 157, 2, 28, 2, 28, 4, 88, 3, 88, 5, 163, 2, 163, 4, 163, 2, 163, 4, 24, 2, 24, 2, 24, 2, 24, 1, 166, 2, 166, 2, 25, 5, 25, 7, 25, 7, 25, 9, 25, 9, 25, 5, 25, 7, 25, 6, 25, 8, 25, 5, 25, 7, 25, 6, 25, 8, 25, 3, 25, 5, 25, 5, 25, 7, 25, 7, 25, 9, 25, 9, 25, 5, 25, 7, 25, 6, 25, 8, 25, 5, 25, 7, 25, 6, 25, 8, 25, 3, 25, 5, 172, 1, 172, 3, 123, 1, 123, 3, 26, 5, 26, 7, 26, 4, 26, 6, 174, 1, 174, 2, 176, 3, 176, 4, 178, 3, 178, 5, 180, 3, 180, 5, 22, 1, 22, 3, 22, 1, 22, 3, 22, 3, 22, 3, 22, 3, 45, 2, 45, 2, 45, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 4, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 5, 16, 3, 16, 5, 16, 4, 117, 2],
  ruleActions: (rule, vals, locs, shared) => {
    const $ = vals;
    const $0 = vals.length - 1;
    switch (rule) {
      case 1:
        return ["program"];
      case 2:
        return ["program", ...$[$0]];
      case 3:
      case 61:
      case 128:
      case 193:
      case 212:
      case 235:
      case 267:
      case 281:
      case 285:
      case 344:
      case 350:
        return [$[$0]];
      case 4:
      case 129:
      case 194:
      case 213:
      case 236:
      case 268:
        return [...$[$0 - 2], $[$0]];
      case 5:
      case 63:
      case 288:
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
      case 47:
      case 48:
      case 55:
      case 56:
      case 57:
      case 58:
      case 59:
      case 66:
      case 67:
      case 71:
      case 72:
      case 73:
      case 76:
      case 77:
      case 78:
      case 83:
      case 88:
      case 89:
      case 90:
      case 91:
      case 94:
      case 97:
      case 98:
      case 99:
      case 100:
      case 101:
      case 123:
      case 124:
      case 125:
      case 126:
      case 132:
      case 136:
      case 137:
      case 138:
      case 139:
      case 141:
      case 142:
      case 170:
      case 171:
      case 172:
      case 173:
      case 174:
      case 175:
      case 176:
      case 177:
      case 178:
      case 179:
      case 180:
      case 181:
      case 217:
      case 219:
      case 221:
      case 240:
      case 243:
      case 272:
      case 273:
      case 274:
      case 276:
      case 289:
      case 309:
      case 342:
      case 358:
      case 360:
        return $[$0];
      case 30:
        return ["def", $[$0 - 4], $[$0 - 2], $[$0]];
      case 31:
        return ["def", $[$0 - 1], [], $[$0]];
      case 32:
        return ["state", $[$0 - 2], $[$0]];
      case 33:
        return ["state", $[$0 - 3], $[$0]];
      case 34:
        return ["state", $[$0 - 4], $[$0 - 1]];
      case 35:
        return ["computed", $[$0 - 2], $[$0]];
      case 36:
        return ["computed", $[$0 - 3], $[$0]];
      case 37:
        return ["computed", $[$0 - 4], $[$0 - 1]];
      case 38:
        return ["readonly", $[$0 - 2], $[$0]];
      case 39:
        return ["readonly", $[$0 - 3], $[$0]];
      case 40:
        return ["readonly", $[$0 - 4], $[$0 - 1]];
      case 41:
        return ["effect", $[$0 - 2], $[$0]];
      case 42:
        return ["effect", $[$0 - 3], $[$0]];
      case 43:
        return ["effect", $[$0 - 4], $[$0 - 1]];
      case 44:
      case 45:
        return ["effect", null, $[$0]];
      case 46:
        return ["effect", null, $[$0 - 1]];
      case 49:
        return ["yield"];
      case 50:
        return ["yield", $[$0]];
      case 51:
        return ["yield", $[$0 - 1]];
      case 52:
        return ["yield-from", $[$0]];
      case 53:
        return ["block"];
      case 54:
        return ["block", ...$[$0 - 1]];
      case 60:
        return ["str", ...$[$0 - 1]];
      case 62:
      case 282:
      case 286:
      case 351:
        return [...$[$0 - 1], $[$0]];
      case 64:
      case 215:
      case 238:
      case 253:
      case 270:
        return $[$0 - 2];
      case 65:
        return "";
      case 68:
        return ["regex", $[$0 - 1]];
      case 69:
        return ["regex-index", $[$0 - 2], $[$0]];
      case 70:
        return ["regex-index", $[$0], null];
      case 74:
        return "undefined";
      case 75:
        return "null";
      case 79:
        return ["=", $[$0 - 2], $[$0]];
      case 80:
        return ["=", $[$0 - 3], $[$0]];
      case 81:
        return ["=", $[$0 - 4], $[$0 - 1]];
      case 82:
        return [$[$0], $[$0], null];
      case 84:
        return [$[$0 - 2], $[$0], ":"];
      case 85:
        return [$[$0 - 4], $[$0 - 1], ":"];
      case 86:
        return [$[$0 - 2], $[$0], "="];
      case 87:
        return [$[$0 - 4], $[$0 - 1], "="];
      case 92:
        return ["dynamicKey", $[$0 - 1]];
      case 93:
        return ["[]", "this", $[$0 - 1]];
      case 95:
      case 96:
      case 140:
        return ["...", $[$0]];
      case 102:
      case 248:
        return ["super", ...$[$0]];
      case 103:
      case 249:
        return ["import", ...$[$0]];
      case 104:
      case 105:
        return [$[$0 - 2], ...$[$0]];
      case 106:
      case 143:
      case 160:
        return [".", $[$0 - 2], $[$0]];
      case 107:
      case 144:
      case 161:
        return ["?.", $[$0 - 2], $[$0]];
      case 108:
      case 145:
      case 162:
        return ["::", $[$0 - 2], $[$0]];
      case 109:
      case 146:
      case 163:
        return ["?::", $[$0 - 2], $[$0]];
      case 110:
      case 147:
      case 164:
        return ["::", $[$0 - 1], "prototype"];
      case 111:
      case 148:
      case 165:
        return ["?::", $[$0 - 1], "prototype"];
      case 112:
      case 149:
      case 151:
      case 166:
        return ["[]", $[$0 - 3], $[$0 - 1]];
      case 113:
      case 150:
      case 152:
      case 167:
        return ["[]", $[$0 - 5], $[$0 - 2]];
      case 114:
      case 154:
      case 156:
      case 168:
        return ["?[]", $[$0 - 4], $[$0 - 1]];
      case 115:
      case 155:
      case 157:
      case 169:
        return ["?[]", $[$0 - 6], $[$0 - 2]];
      case 116:
        return ["return", $[$0]];
      case 117:
        return ["return", $[$0 - 1]];
      case 118:
        return ["return"];
      case 119:
      case 121:
        return [$[$0 - 1], $[$0 - 3], $[$0]];
      case 120:
      case 122:
        return [$[$0 - 1], [], $[$0]];
      case 127:
      case 192:
      case 252:
      case 283:
        return [];
      case 130:
      case 195:
      case 214:
      case 237:
      case 269:
        return [...$[$0 - 3], $[$0]];
      case 131:
      case 196:
      case 216:
      case 239:
      case 271:
        return [...$[$0 - 5], ...$[$0 - 2]];
      case 133:
      case 343:
        return ["default", $[$0 - 2], $[$0]];
      case 134:
        return ["rest", $[$0]];
      case 135:
        return ["expansion"];
      case 153:
        return [$[$0 - 1][0], $[$0 - 3], ...$[$0 - 1].slice(1)];
      case 158:
        return ["optindex", $[$0 - 4], $[$0 - 1]];
      case 159:
        return ["optindex", $[$0 - 6], $[$0 - 2]];
      case 182:
        return [".", "super", $[$0]];
      case 183:
        return ["[]", "super", $[$0 - 1]];
      case 184:
        return ["[]", "super", $[$0 - 2]];
      case 185:
        return [".", "new", $[$0]];
      case 186:
        return [".", "import", $[$0]];
      case 187:
        return ["object-comprehension", $[$0 - 8], $[$0 - 6], [["for-of", $[$0 - 4], $[$0 - 2], false]], []];
      case 188:
        return ["object-comprehension", $[$0 - 10], $[$0 - 8], [["for-of", $[$0 - 6], $[$0 - 4], false]], [$[$0 - 2]]];
      case 189:
        return ["object-comprehension", $[$0 - 9], $[$0 - 7], [["for-of", $[$0 - 4], $[$0 - 2], true]], []];
      case 190:
        return ["object-comprehension", $[$0 - 11], $[$0 - 9], [["for-of", $[$0 - 6], $[$0 - 4], true]], [$[$0 - 2]]];
      case 191:
        return ["object", ...$[$0 - 2]];
      case 197:
        return ["class", null, null];
      case 198:
        return ["class", null, null, $[$0]];
      case 199:
        return ["class", null, $[$0]];
      case 200:
        return ["class", null, $[$0 - 1], $[$0]];
      case 201:
        return ["class", $[$0], null];
      case 202:
        return ["class", $[$0 - 1], null, $[$0]];
      case 203:
        return ["class", $[$0 - 2], $[$0]];
      case 204:
        return ["class", $[$0 - 3], $[$0 - 1], $[$0]];
      case 205:
      case 208:
        return ["import", "{}", $[$0]];
      case 206:
      case 207:
        return ["import", $[$0 - 2], $[$0]];
      case 209:
        return ["import", $[$0 - 4], $[$0]];
      case 210:
        return ["import", [$[$0 - 4], $[$0 - 2]], $[$0]];
      case 211:
        return ["import", [$[$0 - 7], $[$0 - 4]], $[$0]];
      case 218:
      case 220:
      case 241:
      case 242:
      case 244:
      case 345:
        return [$[$0 - 2], $[$0]];
      case 222:
        return ["*", $[$0]];
      case 223:
        return ["export", "{}"];
      case 224:
        return ["export", $[$0 - 2]];
      case 225:
      case 226:
        return ["export", $[$0]];
      case 227:
        return ["export", ["=", $[$0 - 2], $[$0]]];
      case 228:
        return ["export", ["=", $[$0 - 3], $[$0]]];
      case 229:
        return ["export", ["=", $[$0 - 4], $[$0 - 1]]];
      case 230:
        return ["export-default", $[$0]];
      case 231:
        return ["export-default", $[$0 - 1]];
      case 232:
        return ["export-all", $[$0]];
      case 233:
        return ["export-from", "{}", $[$0]];
      case 234:
        return ["export-from", $[$0 - 4], $[$0]];
      case 245:
        return ["tagged-template", $[$0 - 2], $[$0]];
      case 246:
        return $[$0 - 1] ? ["?call", $[$0 - 2], ...$[$0]] : [$[$0 - 2], ...$[$0]];
      case 247:
        return ["optcall", $[$0 - 2], ...$[$0]];
      case 250:
      case 287:
        return null;
      case 251:
        return true;
      case 254:
      case 255:
        return "this";
      case 256:
        return [".", "this", $[$0]];
      case 257:
        return ["array"];
      case 258:
        return ["array", ...$[$0 - 1]];
      case 259:
        return ["array", ...$[$0 - 2], ...$[$0 - 1]];
      case 260:
        return "..";
      case 261:
      case 275:
        return "...";
      case 262:
        return [$[$0 - 2], $[$0 - 3], $[$0 - 1]];
      case 263:
      case 382:
      case 384:
      case 385:
      case 393:
      case 395:
        return [$[$0 - 1], $[$0 - 2], $[$0]];
      case 264:
        return [$[$0], $[$0 - 1], null];
      case 265:
        return [$[$0 - 1], null, $[$0]];
      case 266:
        return [$[$0], null, null];
      case 277:
        return [...$[$0 - 2], ...$[$0]];
      case 278:
        return [...$[$0 - 3], ...$[$0]];
      case 279:
        return [...$[$0 - 2], ...$[$0 - 1]];
      case 280:
        return [...$[$0 - 5], ...$[$0 - 4], ...$[$0 - 2], ...$[$0 - 1]];
      case 284:
        return [...$[$0]];
      case 290:
        return Array.isArray($[$0 - 2]) ? [...$[$0 - 2], $[$0]] : [$[$0 - 2], $[$0]];
      case 291:
        return ["try", $[$0]];
      case 292:
        return ["try", $[$0 - 1], $[$0]];
      case 293:
        return ["try", $[$0 - 2], $[$0]];
      case 294:
        return ["try", $[$0 - 3], $[$0 - 2], $[$0]];
      case 295:
      case 296:
      case 365:
      case 368:
      case 370:
        return [$[$0 - 1], $[$0]];
      case 297:
        return [null, $[$0]];
      case 298:
        return ["throw", $[$0]];
      case 299:
        return ["throw", $[$0 - 1]];
      case 300:
        return $[$0 - 1].length === 1 ? $[$0 - 1][0] : $[$0 - 1];
      case 301:
        return $[$0 - 2].length === 1 ? $[$0 - 2][0] : $[$0 - 2];
      case 302:
        return ["while", $[$0]];
      case 303:
        return ["while", $[$0 - 2], $[$0]];
      case 304:
        return ["until", $[$0]];
      case 305:
        return ["until", $[$0 - 2], $[$0]];
      case 306:
        return $[$0 - 1].length === 2 ? [$[$0 - 1][0], $[$0 - 1][1], $[$0]] : [$[$0 - 1][0], $[$0 - 1][1], $[$0 - 1][2], $[$0]];
      case 307:
      case 308:
        return $[$0].length === 2 ? [$[$0][0], $[$0][1], [$[$0 - 1]]] : [$[$0][0], $[$0][1], $[$0][2], [$[$0 - 1]]];
      case 310:
        return ["loop", $[$0]];
      case 311:
        return ["loop", [$[$0]]];
      case 312:
        return ["for-in", $[$0 - 3], $[$0 - 1], null, null, $[$0]];
      case 313:
        return ["for-in", $[$0 - 5], $[$0 - 3], null, $[$0 - 1], $[$0]];
      case 314:
        return ["for-in", $[$0 - 5], $[$0 - 3], $[$0 - 1], null, $[$0]];
      case 315:
        return ["for-in", $[$0 - 7], $[$0 - 5], $[$0 - 1], $[$0 - 3], $[$0]];
      case 316:
        return ["for-in", $[$0 - 7], $[$0 - 5], $[$0 - 3], $[$0 - 1], $[$0]];
      case 317:
        return ["for-of", $[$0 - 3], $[$0 - 1], false, null, $[$0]];
      case 318:
        return ["for-of", $[$0 - 5], $[$0 - 3], false, $[$0 - 1], $[$0]];
      case 319:
        return ["for-of", $[$0 - 3], $[$0 - 1], true, null, $[$0]];
      case 320:
        return ["for-of", $[$0 - 5], $[$0 - 3], true, $[$0 - 1], $[$0]];
      case 321:
        return ["for-from", $[$0 - 3], $[$0 - 1], false, null, $[$0]];
      case 322:
        return ["for-from", $[$0 - 5], $[$0 - 3], false, $[$0 - 1], $[$0]];
      case 323:
        return ["for-from", $[$0 - 3], $[$0 - 1], true, null, $[$0]];
      case 324:
        return ["for-from", $[$0 - 5], $[$0 - 3], true, $[$0 - 1], $[$0]];
      case 325:
        return ["for-in", [], $[$0 - 1], null, null, $[$0]];
      case 326:
        return ["for-in", [], $[$0 - 3], $[$0 - 1], null, $[$0]];
      case 327:
        return ["comprehension", $[$0 - 4], [["for-in", $[$0 - 2], $[$0], null]], []];
      case 328:
        return ["comprehension", $[$0 - 6], [["for-in", $[$0 - 4], $[$0 - 2], null]], [$[$0]]];
      case 329:
        return ["comprehension", $[$0 - 6], [["for-in", $[$0 - 4], $[$0 - 2], $[$0]]], []];
      case 330:
        return ["comprehension", $[$0 - 8], [["for-in", $[$0 - 6], $[$0 - 4], $[$0]]], [$[$0 - 2]]];
      case 331:
        return ["comprehension", $[$0 - 8], [["for-in", $[$0 - 6], $[$0 - 4], $[$0 - 2]]], [$[$0]]];
      case 332:
        return ["comprehension", $[$0 - 4], [["for-of", $[$0 - 2], $[$0], false]], []];
      case 333:
        return ["comprehension", $[$0 - 6], [["for-of", $[$0 - 4], $[$0 - 2], false]], [$[$0]]];
      case 334:
        return ["comprehension", $[$0 - 5], [["for-of", $[$0 - 2], $[$0], true]], []];
      case 335:
        return ["comprehension", $[$0 - 7], [["for-of", $[$0 - 4], $[$0 - 2], true]], [$[$0]]];
      case 336:
        return ["comprehension", $[$0 - 4], [["for-from", $[$0 - 2], $[$0], false, null]], []];
      case 337:
        return ["comprehension", $[$0 - 6], [["for-from", $[$0 - 4], $[$0 - 2], false, null]], [$[$0]]];
      case 338:
        return ["comprehension", $[$0 - 5], [["for-from", $[$0 - 2], $[$0], true, null]], []];
      case 339:
        return ["comprehension", $[$0 - 7], [["for-from", $[$0 - 4], $[$0 - 2], true, null]], [$[$0]]];
      case 340:
        return ["comprehension", $[$0 - 2], [["for-in", [], $[$0], null]], []];
      case 341:
        return ["comprehension", $[$0 - 4], [["for-in", [], $[$0 - 2], $[$0]]], []];
      case 346:
        return ["switch", $[$0 - 3], $[$0 - 1], null];
      case 347:
        return ["switch", $[$0 - 5], $[$0 - 3], $[$0 - 1]];
      case 348:
        return ["switch", null, $[$0 - 1], null];
      case 349:
        return ["switch", null, $[$0 - 3], $[$0 - 1]];
      case 352:
        return ["when", $[$0 - 1], $[$0]];
      case 353:
        return ["when", $[$0 - 2], $[$0 - 1]];
      case 354:
        return ["if", $[$0 - 1], $[$0]];
      case 355:
        return $[$0 - 4].length === 3 ? ["if", $[$0 - 4][1], $[$0 - 4][2], ["if", $[$0 - 1], $[$0]]] : [...$[$0 - 4], ["if", $[$0 - 1], $[$0]]];
      case 356:
        return ["unless", $[$0 - 1], $[$0]];
      case 357:
        return ["if", ["!", $[$0 - 3]], $[$0 - 2], $[$0]];
      case 359:
        return $[$0 - 2].length === 3 ? ["if", $[$0 - 2][1], $[$0 - 2][2], $[$0]] : [...$[$0 - 2], $[$0]];
      case 361:
      case 362:
        return ["if", $[$0], [$[$0 - 2]]];
      case 363:
      case 364:
        return ["unless", $[$0], [$[$0 - 2]]];
      case 366:
      case 367:
      case 369:
      case 398:
        return ["do-iife", $[$0]];
      case 371:
        return ["-", $[$0]];
      case 372:
        return ["+", $[$0]];
      case 373:
        return ["await", $[$0]];
      case 374:
        return ["await", $[$0 - 1]];
      case 375:
        return ["--", $[$0], false];
      case 376:
        return ["++", $[$0], false];
      case 377:
        return ["--", $[$0 - 1], true];
      case 378:
        return ["++", $[$0 - 1], true];
      case 379:
        return ["?", $[$0 - 1]];
      case 380:
        return ["+", $[$0 - 2], $[$0]];
      case 381:
        return ["-", $[$0 - 2], $[$0]];
      case 383:
        return ["**", $[$0 - 2], $[$0]];
      case 386:
        return ["&", $[$0 - 2], $[$0]];
      case 387:
        return ["^", $[$0 - 2], $[$0]];
      case 388:
        return ["|", $[$0 - 2], $[$0]];
      case 389:
        return ["&&", $[$0 - 2], $[$0]];
      case 390:
        return ["||", $[$0 - 2], $[$0]];
      case 391:
        return ["??", $[$0 - 2], $[$0]];
      case 392:
        return ["!?", $[$0 - 2], $[$0]];
      case 394:
        return ["?:", $[$0 - 4], $[$0 - 2], $[$0]];
      case 396:
        return [$[$0 - 3], $[$0 - 4], $[$0 - 1]];
      case 397:
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
    if (head === "state" || head === "computed" || head === "readonly") {
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
  generateState(head, rest, context, sexpr) {
    const [name, expr] = rest;
    this.usesReactivity = true;
    const varName = typeof name === "string" ? name : name.valueOf();
    const exprCode = this.generate(expr, "value");
    if (!this.reactiveVars)
      this.reactiveVars = new Set;
    this.reactiveVars.add(varName);
    return `const ${varName} = __state(${exprCode})`;
  }
  generateComputed(head, rest, context, sexpr) {
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
    const [target, body] = rest;
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
      if (target) {
        const varName = typeof target === "string" ? target : this.generate(target, "value");
        return `const ${varName} = __effect(${fnCode})`;
      }
      return `__effect(${fnCode})`;
    } else {
      bodyCode = `{ ${this.generate(body, "value")}; }`;
    }
    const effectCode = `__effect(() => ${bodyCode})`;
    if (target) {
      const varName = typeof target === "string" ? target : this.generate(target, "value");
      return `const ${varName} = ${effectCode}`;
    }
    return effectCode;
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
      if (Array.isArray(key2) && key2[0] === "dynamicKey") {
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

/**
 * Create a reactive state container
 * @param {*} initialValue - The initial value
 * @returns {object} State with .value getter/setter
 */
function __state(initialValue) {
  let value = initialValue;
  const subscribers = new Set();  // Effects/computeds that depend on this state

  // State flags
  let notifying = false;  // Prevents re-entry during notification
  let locked = false;     // Prevents writes (used during SSR/hydration)
  let dead = false;       // State has been killed (cleanup)

  const state = {
    get value() {
      if (dead) return value;
      // Track this state as a dependency of the current effect/computed
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
    lock() { locked = true; return state; },    // Prevent further writes
    free() { subscribers.clear(); return state; },  // Clear all subscribers
    kill() { dead = true; subscribers.clear(); return value; },  // Cleanup

    ...__primitiveCoercion
  };
  return state;
}

/**
 * Create a computed value (lazy & cached)
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
    dependencies: new Set(),  // States/computeds this depends on

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
    dependencies: new Set(),  // States/computeds this effect depends on

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
// Error Handling
// Catch and handle errors gracefully
// ============================================================================

let __errorHandler = null;  // Current error handler

/**
 * Set the current error handler
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
var VERSION = "2.7.0";
var BUILD_DATE = "2026-01-19@02:30:49GMT";
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
