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
      indent = null;
      doc = function() {
        var k2, len2, results;
        results = [];
        for (i = k2 = 0, len2 = tokens.length;k2 < len2; i = ++k2) {
          token = tokens[i];
          if (token[0] === "NEOSTRING") {
            results.push(token[1]);
          }
        }
        return results;
      }().join("#{}");
      while (match = HEREDOC_INDENT.exec(doc)) {
        attempt = match[1];
        if (indent === null || 0 < (ref = attempt.length) && ref < indent.length) {
          indent = attempt;
        }
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
OPERATOR = /^(?:[-=]>|===|!==|\?\?|=~|[-+*\/%<>&|^!?=]=|>>>=?|([-+:])\1|([&|<>*\/%])\2=?|\?(\.|::)|\.{2,3})/;
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
var hasProp2 = {}.hasOwnProperty;
var parserInstance = {
  symbolIds: { $accept: 0, $end: 1, error: 2, Root: 3, Body: 4, Line: 5, TERMINATOR: 6, Expression: 7, ExpressionLine: 8, Statement: 9, Return: 10, STATEMENT: 11, Import: 12, Export: 13, Value: 14, Code: 15, Operation: 16, Assign: 17, If: 18, Try: 19, While: 20, For: 21, Switch: 22, Class: 23, Throw: 24, Yield: 25, Def: 26, DEF: 27, Identifier: 28, CALL_START: 29, ParamList: 30, CALL_END: 31, Block: 32, CodeLine: 33, OperationLine: 34, YIELD: 35, INDENT: 36, Object: 37, OUTDENT: 38, FROM: 39, IDENTIFIER: 40, Property: 41, PROPERTY: 42, AlphaNumeric: 43, NUMBER: 44, String: 45, STRING: 46, STRING_START: 47, Interpolations: 48, STRING_END: 49, InterpolationChunk: 50, INTERPOLATION_START: 51, INTERPOLATION_END: 52, Regex: 53, REGEX: 54, REGEX_START: 55, Invocation: 56, REGEX_END: 57, RegexWithIndex: 58, ",": 59, Literal: 60, JS: 61, UNDEFINED: 62, NULL: 63, BOOL: 64, INFINITY: 65, NAN: 66, Assignable: 67, "=": 68, AssignObj: 69, ObjAssignable: 70, ObjRestValue: 71, ":": 72, SimpleObjAssignable: 73, ThisProperty: 74, "[": 75, "]": 76, "@": 77, "...": 78, ObjSpreadExpr: 79, Parenthetical: 80, Super: 81, This: 82, SUPER: 83, OptFuncExist: 84, Arguments: 85, DYNAMIC_IMPORT: 86, ".": 87, "?.": 88, "::": 89, "?::": 90, INDEX_START: 91, INDEX_END: 92, INDEX_SOAK: 93, RETURN: 94, PARAM_START: 95, PARAM_END: 96, FuncGlyph: 97, "->": 98, "=>": 99, OptComma: 100, Param: 101, ParamVar: 102, Array: 103, Splat: 104, SimpleAssignable: 105, Slice: 106, ES6_OPTIONAL_INDEX: 107, Range: 108, DoIife: 109, MetaProperty: 110, NEW_TARGET: 111, IMPORT_META: 112, "{": 113, FOR: 114, ForVariables: 115, FOROF: 116, "}": 117, WHEN: 118, OWN: 119, AssignList: 120, CLASS: 121, EXTENDS: 122, IMPORT: 123, ImportDefaultSpecifier: 124, ImportNamespaceSpecifier: 125, ImportSpecifierList: 126, ImportSpecifier: 127, AS: 128, DEFAULT: 129, IMPORT_ALL: 130, EXPORT: 131, ExportSpecifierList: 132, EXPORT_ALL: 133, ExportSpecifier: 134, ES6_OPTIONAL_CALL: 135, FUNC_EXIST: 136, ArgList: 137, THIS: 138, Elisions: 139, ArgElisionList: 140, OptElisions: 141, RangeDots: 142, "..": 143, Arg: 144, ArgElision: 145, Elision: 146, SimpleArgs: 147, TRY: 148, Catch: 149, FINALLY: 150, CATCH: 151, THROW: 152, "(": 153, ")": 154, WhileSource: 155, WHILE: 156, UNTIL: 157, Loop: 158, LOOP: 159, FORIN: 160, BY: 161, FORFROM: 162, AWAIT: 163, ForValue: 164, SWITCH: 165, Whens: 166, ELSE: 167, When: 168, LEADING_WHEN: 169, IfBlock: 170, IF: 171, UnlessBlock: 172, UNLESS: 173, POST_IF: 174, POST_UNLESS: 175, UNARY: 176, DO: 177, DO_IIFE: 178, UNARY_MATH: 179, "-": 180, "+": 181, "--": 182, "++": 183, "?": 184, MATH: 185, "**": 186, SHIFT: 187, COMPARE: 188, "&": 189, "^": 190, "|": 191, "&&": 192, "||": 193, "??": 194, RELATION: 195, "SPACE?": 196, COMPOUND_ASSIGN: 197 },
  tokenNames: { 2: "error", 6: "TERMINATOR", 11: "STATEMENT", 27: "DEF", 29: "CALL_START", 31: "CALL_END", 35: "YIELD", 36: "INDENT", 38: "OUTDENT", 39: "FROM", 40: "IDENTIFIER", 42: "PROPERTY", 44: "NUMBER", 46: "STRING", 47: "STRING_START", 49: "STRING_END", 51: "INTERPOLATION_START", 52: "INTERPOLATION_END", 54: "REGEX", 55: "REGEX_START", 57: "REGEX_END", 59: ",", 61: "JS", 62: "UNDEFINED", 63: "NULL", 64: "BOOL", 65: "INFINITY", 66: "NAN", 68: "=", 72: ":", 75: "[", 76: "]", 77: "@", 78: "...", 83: "SUPER", 86: "DYNAMIC_IMPORT", 87: ".", 88: "?.", 89: "::", 90: "?::", 91: "INDEX_START", 92: "INDEX_END", 93: "INDEX_SOAK", 94: "RETURN", 95: "PARAM_START", 96: "PARAM_END", 98: "->", 99: "=>", 107: "ES6_OPTIONAL_INDEX", 111: "NEW_TARGET", 112: "IMPORT_META", 113: "{", 114: "FOR", 116: "FOROF", 117: "}", 118: "WHEN", 119: "OWN", 121: "CLASS", 122: "EXTENDS", 123: "IMPORT", 128: "AS", 129: "DEFAULT", 130: "IMPORT_ALL", 131: "EXPORT", 133: "EXPORT_ALL", 135: "ES6_OPTIONAL_CALL", 136: "FUNC_EXIST", 138: "THIS", 143: "..", 148: "TRY", 150: "FINALLY", 151: "CATCH", 152: "THROW", 153: "(", 154: ")", 156: "WHILE", 157: "UNTIL", 159: "LOOP", 160: "FORIN", 161: "BY", 162: "FORFROM", 163: "AWAIT", 165: "SWITCH", 167: "ELSE", 169: "LEADING_WHEN", 171: "IF", 173: "UNLESS", 174: "POST_IF", 175: "POST_UNLESS", 176: "UNARY", 177: "DO", 178: "DO_IIFE", 179: "UNARY_MATH", 180: "-", 181: "+", 182: "--", 183: "++", 184: "?", 185: "MATH", 186: "**", 187: "SHIFT", 188: "COMPARE", 189: "&", 190: "^", 191: "|", 192: "&&", 193: "||", 194: "??", 195: "RELATION", 196: "SPACE?", 197: "COMPOUND_ASSIGN" },
  ruleData: [0, [3, 0], [3, 1], [4, 1], [4, 3], [4, 2], [5, 1], [5, 1], [5, 1], [9, 1], [9, 1], [9, 1], [9, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [26, 6], [26, 3], [8, 1], [8, 1], [25, 1], [25, 2], [25, 4], [25, 3], [32, 2], [32, 3], [28, 1], [41, 1], [43, 1], [43, 1], [45, 1], [45, 3], [48, 1], [48, 2], [50, 3], [50, 5], [50, 2], [50, 1], [53, 1], [53, 3], [58, 3], [58, 1], [60, 1], [60, 1], [60, 1], [60, 1], [60, 1], [60, 1], [60, 1], [60, 1], [17, 3], [17, 4], [17, 5], [69, 1], [69, 1], [69, 3], [69, 5], [69, 3], [69, 5], [73, 1], [73, 1], [73, 1], [70, 1], [70, 3], [70, 4], [70, 1], [71, 2], [71, 2], [79, 1], [79, 1], [79, 1], [79, 1], [79, 1], [79, 3], [79, 2], [79, 3], [79, 3], [79, 3], [79, 3], [79, 3], [79, 3], [79, 2], [79, 2], [79, 4], [79, 6], [79, 5], [79, 7], [10, 2], [10, 4], [10, 1], [15, 5], [15, 2], [33, 5], [33, 2], [97, 1], [97, 1], [100, 0], [100, 1], [30, 0], [30, 1], [30, 3], [30, 4], [30, 6], [101, 1], [101, 2], [101, 3], [101, 1], [102, 1], [102, 1], [102, 1], [102, 1], [104, 2], [105, 1], [105, 1], [105, 3], [105, 3], [105, 3], [105, 3], [105, 2], [105, 2], [105, 4], [105, 6], [105, 4], [105, 6], [105, 4], [105, 5], [105, 7], [105, 5], [105, 7], [105, 5], [105, 7], [105, 3], [105, 3], [105, 3], [105, 3], [105, 2], [105, 2], [105, 4], [105, 6], [105, 5], [105, 7], [67, 1], [67, 1], [67, 1], [14, 1], [14, 1], [14, 1], [14, 1], [14, 1], [14, 1], [14, 1], [14, 1], [14, 1], [81, 3], [81, 4], [81, 6], [110, 3], [110, 3], [37, 10], [37, 12], [37, 11], [37, 13], [37, 4], [120, 0], [120, 1], [120, 3], [120, 4], [120, 6], [23, 1], [23, 2], [23, 3], [23, 4], [23, 2], [23, 3], [23, 4], [23, 5], [12, 2], [12, 4], [12, 4], [12, 5], [12, 7], [12, 6], [12, 9], [126, 1], [126, 3], [126, 4], [126, 4], [126, 6], [127, 1], [127, 3], [127, 1], [127, 3], [124, 1], [125, 3], [13, 3], [13, 5], [13, 2], [13, 2], [13, 4], [13, 5], [13, 6], [13, 3], [13, 5], [13, 4], [13, 5], [13, 7], [132, 1], [132, 3], [132, 4], [132, 4], [132, 6], [134, 1], [134, 3], [134, 3], [134, 1], [134, 3], [56, 3], [56, 3], [56, 3], [56, 3], [56, 2], [84, 0], [84, 1], [85, 2], [85, 4], [82, 1], [82, 1], [74, 2], [103, 2], [103, 3], [103, 4], [142, 1], [142, 1], [108, 5], [106, 3], [106, 2], [106, 2], [106, 1], [137, 1], [137, 3], [137, 4], [137, 4], [137, 6], [144, 1], [144, 1], [144, 1], [144, 1], [140, 1], [140, 3], [140, 4], [140, 4], [140, 6], [145, 1], [145, 2], [141, 1], [141, 2], [139, 1], [139, 2], [146, 1], [146, 2], [147, 1], [147, 3], [19, 2], [19, 3], [19, 4], [19, 5], [149, 3], [149, 3], [149, 2], [24, 2], [24, 4], [80, 3], [80, 5], [155, 2], [155, 4], [155, 2], [155, 4], [20, 2], [20, 2], [20, 2], [20, 1], [158, 2], [158, 2], [21, 5], [21, 7], [21, 7], [21, 9], [21, 9], [21, 5], [21, 7], [21, 6], [21, 8], [21, 5], [21, 7], [21, 6], [21, 8], [21, 3], [21, 5], [21, 5], [21, 7], [21, 7], [21, 9], [21, 9], [21, 5], [21, 7], [21, 6], [21, 8], [21, 5], [21, 7], [21, 6], [21, 8], [21, 3], [21, 5], [164, 1], [164, 1], [164, 1], [164, 1], [115, 1], [115, 3], [22, 5], [22, 7], [22, 4], [22, 6], [166, 1], [166, 2], [168, 3], [168, 4], [170, 3], [170, 5], [172, 3], [172, 5], [18, 1], [18, 3], [18, 1], [18, 3], [18, 3], [18, 3], [18, 3], [34, 2], [34, 2], [34, 2], [16, 2], [16, 2], [16, 2], [16, 2], [16, 2], [16, 2], [16, 4], [16, 2], [16, 2], [16, 2], [16, 2], [16, 2], [16, 3], [16, 3], [16, 3], [16, 3], [16, 3], [16, 3], [16, 3], [16, 3], [16, 3], [16, 3], [16, 3], [16, 3], [16, 3], [16, 5], [16, 3], [16, 5], [16, 4], [109, 2]],
  parseTable: [{ 1: [2, 1], 3: 1, 4: 2, 5: 3, 7: 4, 8: 5, 9: 6, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 33: 20, 34: 21, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [3] }, { 1: [2, 2], 6: [1, 96] }, { 1: [2, 3], 6: [2, 3], 38: [2, 3], 52: [2, 3], 154: [2, 3] }, { 1: [2, 6], 6: [2, 6], 31: [2, 6], 36: [2, 6], 38: [2, 6], 52: [2, 6], 59: [2, 6], 76: [2, 6], 114: [1, 115], 154: [2, 6], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 7], 6: [2, 7], 31: [2, 7], 36: [2, 7], 38: [2, 7], 52: [2, 7], 59: [2, 7], 76: [2, 7], 154: [2, 7] }, { 1: [2, 8], 6: [2, 8], 31: [2, 8], 36: [2, 8], 38: [2, 8], 52: [2, 8], 59: [2, 8], 76: [2, 8], 154: [2, 8], 155: 118, 156: [1, 85], 157: [1, 86], 174: [1, 116], 175: [1, 117] }, { 1: [2, 13], 6: [2, 13], 29: [2, 231], 31: [2, 13], 36: [2, 13], 38: [2, 13], 46: [2, 231], 47: [2, 231], 52: [2, 13], 59: [2, 13], 72: [2, 13], 76: [2, 13], 78: [2, 13], 84: 119, 87: [1, 121], 88: [1, 122], 89: [1, 123], 90: [1, 124], 91: [1, 125], 92: [2, 13], 93: [1, 126], 96: [2, 13], 107: [1, 127], 114: [2, 13], 117: [2, 13], 118: [2, 13], 135: [1, 120], 136: [1, 128], 143: [2, 13], 154: [2, 13], 156: [2, 13], 157: [2, 13], 161: [2, 13], 174: [2, 13], 175: [2, 13], 180: [2, 13], 181: [2, 13], 184: [2, 13], 185: [2, 13], 186: [2, 13], 187: [2, 13], 188: [2, 13], 189: [2, 13], 190: [2, 13], 191: [2, 13], 192: [2, 13], 193: [2, 13], 194: [2, 13], 195: [2, 13], 196: [2, 13] }, { 1: [2, 14], 6: [2, 14], 31: [2, 14], 36: [2, 14], 38: [2, 14], 52: [2, 14], 59: [2, 14], 72: [2, 14], 76: [2, 14], 78: [2, 14], 87: [1, 129], 88: [1, 130], 89: [1, 131], 90: [1, 132], 91: [1, 133], 92: [2, 14], 93: [1, 134], 96: [2, 14], 114: [2, 14], 117: [2, 14], 118: [2, 14], 143: [2, 14], 154: [2, 14], 156: [2, 14], 157: [2, 14], 161: [2, 14], 174: [2, 14], 175: [2, 14], 180: [2, 14], 181: [2, 14], 184: [2, 14], 185: [2, 14], 186: [2, 14], 187: [2, 14], 188: [2, 14], 189: [2, 14], 190: [2, 14], 191: [2, 14], 192: [2, 14], 193: [2, 14], 194: [2, 14], 195: [2, 14], 196: [2, 14] }, { 1: [2, 15], 6: [2, 15], 31: [2, 15], 36: [2, 15], 38: [2, 15], 52: [2, 15], 59: [2, 15], 72: [2, 15], 76: [2, 15], 78: [2, 15], 92: [2, 15], 96: [2, 15], 114: [2, 15], 117: [2, 15], 118: [2, 15], 143: [2, 15], 154: [2, 15], 156: [2, 15], 157: [2, 15], 161: [2, 15], 174: [2, 15], 175: [2, 15], 180: [2, 15], 181: [2, 15], 184: [2, 15], 185: [2, 15], 186: [2, 15], 187: [2, 15], 188: [2, 15], 189: [2, 15], 190: [2, 15], 191: [2, 15], 192: [2, 15], 193: [2, 15], 194: [2, 15], 195: [2, 15], 196: [2, 15] }, { 1: [2, 16], 6: [2, 16], 31: [2, 16], 36: [2, 16], 38: [2, 16], 52: [2, 16], 59: [2, 16], 72: [2, 16], 76: [2, 16], 78: [2, 16], 92: [2, 16], 96: [2, 16], 114: [2, 16], 117: [2, 16], 118: [2, 16], 143: [2, 16], 154: [2, 16], 156: [2, 16], 157: [2, 16], 161: [2, 16], 174: [2, 16], 175: [2, 16], 180: [2, 16], 181: [2, 16], 184: [2, 16], 185: [2, 16], 186: [2, 16], 187: [2, 16], 188: [2, 16], 189: [2, 16], 190: [2, 16], 191: [2, 16], 192: [2, 16], 193: [2, 16], 194: [2, 16], 195: [2, 16], 196: [2, 16] }, { 1: [2, 17], 6: [2, 17], 31: [2, 17], 36: [2, 17], 38: [2, 17], 52: [2, 17], 59: [2, 17], 72: [2, 17], 76: [2, 17], 78: [2, 17], 92: [2, 17], 96: [2, 17], 114: [2, 17], 117: [2, 17], 118: [2, 17], 143: [2, 17], 154: [2, 17], 156: [2, 17], 157: [2, 17], 161: [2, 17], 174: [2, 17], 175: [2, 17], 180: [2, 17], 181: [2, 17], 184: [2, 17], 185: [2, 17], 186: [2, 17], 187: [2, 17], 188: [2, 17], 189: [2, 17], 190: [2, 17], 191: [2, 17], 192: [2, 17], 193: [2, 17], 194: [2, 17], 195: [2, 17], 196: [2, 17] }, { 1: [2, 18], 6: [2, 18], 31: [2, 18], 36: [2, 18], 38: [2, 18], 52: [2, 18], 59: [2, 18], 72: [2, 18], 76: [2, 18], 78: [2, 18], 92: [2, 18], 96: [2, 18], 114: [2, 18], 117: [2, 18], 118: [2, 18], 143: [2, 18], 154: [2, 18], 156: [2, 18], 157: [2, 18], 161: [2, 18], 174: [2, 18], 175: [2, 18], 180: [2, 18], 181: [2, 18], 184: [2, 18], 185: [2, 18], 186: [2, 18], 187: [2, 18], 188: [2, 18], 189: [2, 18], 190: [2, 18], 191: [2, 18], 192: [2, 18], 193: [2, 18], 194: [2, 18], 195: [2, 18], 196: [2, 18] }, { 1: [2, 19], 6: [2, 19], 31: [2, 19], 36: [2, 19], 38: [2, 19], 52: [2, 19], 59: [2, 19], 72: [2, 19], 76: [2, 19], 78: [2, 19], 92: [2, 19], 96: [2, 19], 114: [2, 19], 117: [2, 19], 118: [2, 19], 143: [2, 19], 154: [2, 19], 156: [2, 19], 157: [2, 19], 161: [2, 19], 174: [2, 19], 175: [2, 19], 180: [2, 19], 181: [2, 19], 184: [2, 19], 185: [2, 19], 186: [2, 19], 187: [2, 19], 188: [2, 19], 189: [2, 19], 190: [2, 19], 191: [2, 19], 192: [2, 19], 193: [2, 19], 194: [2, 19], 195: [2, 19], 196: [2, 19] }, { 1: [2, 20], 6: [2, 20], 31: [2, 20], 36: [2, 20], 38: [2, 20], 52: [2, 20], 59: [2, 20], 72: [2, 20], 76: [2, 20], 78: [2, 20], 92: [2, 20], 96: [2, 20], 114: [2, 20], 117: [2, 20], 118: [2, 20], 143: [2, 20], 154: [2, 20], 156: [2, 20], 157: [2, 20], 161: [2, 20], 174: [2, 20], 175: [2, 20], 180: [2, 20], 181: [2, 20], 184: [2, 20], 185: [2, 20], 186: [2, 20], 187: [2, 20], 188: [2, 20], 189: [2, 20], 190: [2, 20], 191: [2, 20], 192: [2, 20], 193: [2, 20], 194: [2, 20], 195: [2, 20], 196: [2, 20] }, { 1: [2, 21], 6: [2, 21], 31: [2, 21], 36: [2, 21], 38: [2, 21], 52: [2, 21], 59: [2, 21], 72: [2, 21], 76: [2, 21], 78: [2, 21], 92: [2, 21], 96: [2, 21], 114: [2, 21], 117: [2, 21], 118: [2, 21], 143: [2, 21], 154: [2, 21], 156: [2, 21], 157: [2, 21], 161: [2, 21], 174: [2, 21], 175: [2, 21], 180: [2, 21], 181: [2, 21], 184: [2, 21], 185: [2, 21], 186: [2, 21], 187: [2, 21], 188: [2, 21], 189: [2, 21], 190: [2, 21], 191: [2, 21], 192: [2, 21], 193: [2, 21], 194: [2, 21], 195: [2, 21], 196: [2, 21] }, { 1: [2, 22], 6: [2, 22], 31: [2, 22], 36: [2, 22], 38: [2, 22], 52: [2, 22], 59: [2, 22], 72: [2, 22], 76: [2, 22], 78: [2, 22], 92: [2, 22], 96: [2, 22], 114: [2, 22], 117: [2, 22], 118: [2, 22], 143: [2, 22], 154: [2, 22], 156: [2, 22], 157: [2, 22], 161: [2, 22], 174: [2, 22], 175: [2, 22], 180: [2, 22], 181: [2, 22], 184: [2, 22], 185: [2, 22], 186: [2, 22], 187: [2, 22], 188: [2, 22], 189: [2, 22], 190: [2, 22], 191: [2, 22], 192: [2, 22], 193: [2, 22], 194: [2, 22], 195: [2, 22], 196: [2, 22] }, { 1: [2, 23], 6: [2, 23], 31: [2, 23], 36: [2, 23], 38: [2, 23], 52: [2, 23], 59: [2, 23], 72: [2, 23], 76: [2, 23], 78: [2, 23], 92: [2, 23], 96: [2, 23], 114: [2, 23], 117: [2, 23], 118: [2, 23], 143: [2, 23], 154: [2, 23], 156: [2, 23], 157: [2, 23], 161: [2, 23], 174: [2, 23], 175: [2, 23], 180: [2, 23], 181: [2, 23], 184: [2, 23], 185: [2, 23], 186: [2, 23], 187: [2, 23], 188: [2, 23], 189: [2, 23], 190: [2, 23], 191: [2, 23], 192: [2, 23], 193: [2, 23], 194: [2, 23], 195: [2, 23], 196: [2, 23] }, { 1: [2, 24], 6: [2, 24], 31: [2, 24], 36: [2, 24], 38: [2, 24], 52: [2, 24], 59: [2, 24], 72: [2, 24], 76: [2, 24], 78: [2, 24], 92: [2, 24], 96: [2, 24], 114: [2, 24], 117: [2, 24], 118: [2, 24], 143: [2, 24], 154: [2, 24], 156: [2, 24], 157: [2, 24], 161: [2, 24], 174: [2, 24], 175: [2, 24], 180: [2, 24], 181: [2, 24], 184: [2, 24], 185: [2, 24], 186: [2, 24], 187: [2, 24], 188: [2, 24], 189: [2, 24], 190: [2, 24], 191: [2, 24], 192: [2, 24], 193: [2, 24], 194: [2, 24], 195: [2, 24], 196: [2, 24] }, { 1: [2, 25], 6: [2, 25], 31: [2, 25], 36: [2, 25], 38: [2, 25], 52: [2, 25], 59: [2, 25], 72: [2, 25], 76: [2, 25], 78: [2, 25], 92: [2, 25], 96: [2, 25], 114: [2, 25], 117: [2, 25], 118: [2, 25], 143: [2, 25], 154: [2, 25], 156: [2, 25], 157: [2, 25], 161: [2, 25], 174: [2, 25], 175: [2, 25], 180: [2, 25], 181: [2, 25], 184: [2, 25], 185: [2, 25], 186: [2, 25], 187: [2, 25], 188: [2, 25], 189: [2, 25], 190: [2, 25], 191: [2, 25], 192: [2, 25], 193: [2, 25], 194: [2, 25], 195: [2, 25], 196: [2, 25] }, { 1: [2, 28], 6: [2, 28], 31: [2, 28], 36: [2, 28], 38: [2, 28], 52: [2, 28], 59: [2, 28], 76: [2, 28], 154: [2, 28] }, { 1: [2, 29], 6: [2, 29], 31: [2, 29], 36: [2, 29], 38: [2, 29], 52: [2, 29], 59: [2, 29], 76: [2, 29], 154: [2, 29] }, { 1: [2, 9], 6: [2, 9], 31: [2, 9], 36: [2, 9], 38: [2, 9], 52: [2, 9], 59: [2, 9], 76: [2, 9], 154: [2, 9], 156: [2, 9], 157: [2, 9], 174: [2, 9], 175: [2, 9] }, { 1: [2, 10], 6: [2, 10], 31: [2, 10], 36: [2, 10], 38: [2, 10], 52: [2, 10], 59: [2, 10], 76: [2, 10], 154: [2, 10], 156: [2, 10], 157: [2, 10], 174: [2, 10], 175: [2, 10] }, { 1: [2, 11], 6: [2, 11], 31: [2, 11], 36: [2, 11], 38: [2, 11], 52: [2, 11], 59: [2, 11], 76: [2, 11], 154: [2, 11], 156: [2, 11], 157: [2, 11], 174: [2, 11], 175: [2, 11] }, { 1: [2, 12], 6: [2, 12], 31: [2, 12], 36: [2, 12], 38: [2, 12], 52: [2, 12], 59: [2, 12], 76: [2, 12], 154: [2, 12], 156: [2, 12], 157: [2, 12], 174: [2, 12], 175: [2, 12] }, { 1: [2, 154], 6: [2, 154], 29: [2, 154], 31: [2, 154], 36: [2, 154], 38: [2, 154], 46: [2, 154], 47: [2, 154], 52: [2, 154], 59: [2, 154], 68: [1, 135], 72: [2, 154], 76: [2, 154], 78: [2, 154], 87: [2, 154], 88: [2, 154], 89: [2, 154], 90: [2, 154], 91: [2, 154], 92: [2, 154], 93: [2, 154], 96: [2, 154], 107: [2, 154], 114: [2, 154], 117: [2, 154], 118: [2, 154], 135: [2, 154], 136: [2, 154], 143: [2, 154], 154: [2, 154], 156: [2, 154], 157: [2, 154], 161: [2, 154], 174: [2, 154], 175: [2, 154], 180: [2, 154], 181: [2, 154], 184: [2, 154], 185: [2, 154], 186: [2, 154], 187: [2, 154], 188: [2, 154], 189: [2, 154], 190: [2, 154], 191: [2, 154], 192: [2, 154], 193: [2, 154], 194: [2, 154], 195: [2, 154], 196: [2, 154] }, { 1: [2, 155], 6: [2, 155], 29: [2, 155], 31: [2, 155], 36: [2, 155], 38: [2, 155], 46: [2, 155], 47: [2, 155], 52: [2, 155], 59: [2, 155], 72: [2, 155], 76: [2, 155], 78: [2, 155], 87: [2, 155], 88: [2, 155], 89: [2, 155], 90: [2, 155], 91: [2, 155], 92: [2, 155], 93: [2, 155], 96: [2, 155], 107: [2, 155], 114: [2, 155], 117: [2, 155], 118: [2, 155], 135: [2, 155], 136: [2, 155], 143: [2, 155], 154: [2, 155], 156: [2, 155], 157: [2, 155], 161: [2, 155], 174: [2, 155], 175: [2, 155], 180: [2, 155], 181: [2, 155], 184: [2, 155], 185: [2, 155], 186: [2, 155], 187: [2, 155], 188: [2, 155], 189: [2, 155], 190: [2, 155], 191: [2, 155], 192: [2, 155], 193: [2, 155], 194: [2, 155], 195: [2, 155], 196: [2, 155] }, { 1: [2, 156], 6: [2, 156], 29: [2, 156], 31: [2, 156], 36: [2, 156], 38: [2, 156], 46: [2, 156], 47: [2, 156], 52: [2, 156], 59: [2, 156], 72: [2, 156], 76: [2, 156], 78: [2, 156], 87: [2, 156], 88: [2, 156], 89: [2, 156], 90: [2, 156], 91: [2, 156], 92: [2, 156], 93: [2, 156], 96: [2, 156], 107: [2, 156], 114: [2, 156], 117: [2, 156], 118: [2, 156], 135: [2, 156], 136: [2, 156], 143: [2, 156], 154: [2, 156], 156: [2, 156], 157: [2, 156], 161: [2, 156], 174: [2, 156], 175: [2, 156], 180: [2, 156], 181: [2, 156], 184: [2, 156], 185: [2, 156], 186: [2, 156], 187: [2, 156], 188: [2, 156], 189: [2, 156], 190: [2, 156], 191: [2, 156], 192: [2, 156], 193: [2, 156], 194: [2, 156], 195: [2, 156], 196: [2, 156] }, { 1: [2, 157], 6: [2, 157], 29: [2, 157], 31: [2, 157], 36: [2, 157], 38: [2, 157], 46: [2, 157], 47: [2, 157], 52: [2, 157], 59: [2, 157], 72: [2, 157], 76: [2, 157], 78: [2, 157], 87: [2, 157], 88: [2, 157], 89: [2, 157], 90: [2, 157], 91: [2, 157], 92: [2, 157], 93: [2, 157], 96: [2, 157], 107: [2, 157], 114: [2, 157], 117: [2, 157], 118: [2, 157], 135: [2, 157], 136: [2, 157], 143: [2, 157], 154: [2, 157], 156: [2, 157], 157: [2, 157], 161: [2, 157], 174: [2, 157], 175: [2, 157], 180: [2, 157], 181: [2, 157], 184: [2, 157], 185: [2, 157], 186: [2, 157], 187: [2, 157], 188: [2, 157], 189: [2, 157], 190: [2, 157], 191: [2, 157], 192: [2, 157], 193: [2, 157], 194: [2, 157], 195: [2, 157], 196: [2, 157] }, { 1: [2, 158], 6: [2, 158], 29: [2, 158], 31: [2, 158], 36: [2, 158], 38: [2, 158], 46: [2, 158], 47: [2, 158], 52: [2, 158], 59: [2, 158], 72: [2, 158], 76: [2, 158], 78: [2, 158], 87: [2, 158], 88: [2, 158], 89: [2, 158], 90: [2, 158], 91: [2, 158], 92: [2, 158], 93: [2, 158], 96: [2, 158], 107: [2, 158], 114: [2, 158], 117: [2, 158], 118: [2, 158], 135: [2, 158], 136: [2, 158], 143: [2, 158], 154: [2, 158], 156: [2, 158], 157: [2, 158], 161: [2, 158], 174: [2, 158], 175: [2, 158], 180: [2, 158], 181: [2, 158], 184: [2, 158], 185: [2, 158], 186: [2, 158], 187: [2, 158], 188: [2, 158], 189: [2, 158], 190: [2, 158], 191: [2, 158], 192: [2, 158], 193: [2, 158], 194: [2, 158], 195: [2, 158], 196: [2, 158] }, { 1: [2, 159], 6: [2, 159], 29: [2, 159], 31: [2, 159], 36: [2, 159], 38: [2, 159], 46: [2, 159], 47: [2, 159], 52: [2, 159], 59: [2, 159], 72: [2, 159], 76: [2, 159], 78: [2, 159], 87: [2, 159], 88: [2, 159], 89: [2, 159], 90: [2, 159], 91: [2, 159], 92: [2, 159], 93: [2, 159], 96: [2, 159], 107: [2, 159], 114: [2, 159], 117: [2, 159], 118: [2, 159], 135: [2, 159], 136: [2, 159], 143: [2, 159], 154: [2, 159], 156: [2, 159], 157: [2, 159], 161: [2, 159], 174: [2, 159], 175: [2, 159], 180: [2, 159], 181: [2, 159], 184: [2, 159], 185: [2, 159], 186: [2, 159], 187: [2, 159], 188: [2, 159], 189: [2, 159], 190: [2, 159], 191: [2, 159], 192: [2, 159], 193: [2, 159], 194: [2, 159], 195: [2, 159], 196: [2, 159] }, { 1: [2, 160], 6: [2, 160], 29: [2, 160], 31: [2, 160], 36: [2, 160], 38: [2, 160], 46: [2, 160], 47: [2, 160], 52: [2, 160], 59: [2, 160], 72: [2, 160], 76: [2, 160], 78: [2, 160], 87: [2, 160], 88: [2, 160], 89: [2, 160], 90: [2, 160], 91: [2, 160], 92: [2, 160], 93: [2, 160], 96: [2, 160], 107: [2, 160], 114: [2, 160], 117: [2, 160], 118: [2, 160], 135: [2, 160], 136: [2, 160], 143: [2, 160], 154: [2, 160], 156: [2, 160], 157: [2, 160], 161: [2, 160], 174: [2, 160], 175: [2, 160], 180: [2, 160], 181: [2, 160], 184: [2, 160], 185: [2, 160], 186: [2, 160], 187: [2, 160], 188: [2, 160], 189: [2, 160], 190: [2, 160], 191: [2, 160], 192: [2, 160], 193: [2, 160], 194: [2, 160], 195: [2, 160], 196: [2, 160] }, { 1: [2, 161], 6: [2, 161], 29: [2, 161], 31: [2, 161], 36: [2, 161], 38: [2, 161], 46: [2, 161], 47: [2, 161], 52: [2, 161], 59: [2, 161], 72: [2, 161], 76: [2, 161], 78: [2, 161], 87: [2, 161], 88: [2, 161], 89: [2, 161], 90: [2, 161], 91: [2, 161], 92: [2, 161], 93: [2, 161], 96: [2, 161], 107: [2, 161], 114: [2, 161], 117: [2, 161], 118: [2, 161], 135: [2, 161], 136: [2, 161], 143: [2, 161], 154: [2, 161], 156: [2, 161], 157: [2, 161], 161: [2, 161], 174: [2, 161], 175: [2, 161], 180: [2, 161], 181: [2, 161], 184: [2, 161], 185: [2, 161], 186: [2, 161], 187: [2, 161], 188: [2, 161], 189: [2, 161], 190: [2, 161], 191: [2, 161], 192: [2, 161], 193: [2, 161], 194: [2, 161], 195: [2, 161], 196: [2, 161] }, { 1: [2, 162], 6: [2, 162], 29: [2, 162], 31: [2, 162], 36: [2, 162], 38: [2, 162], 46: [2, 162], 47: [2, 162], 52: [2, 162], 59: [2, 162], 72: [2, 162], 76: [2, 162], 78: [2, 162], 87: [2, 162], 88: [2, 162], 89: [2, 162], 90: [2, 162], 91: [2, 162], 92: [2, 162], 93: [2, 162], 96: [2, 162], 107: [2, 162], 114: [2, 162], 117: [2, 162], 118: [2, 162], 135: [2, 162], 136: [2, 162], 143: [2, 162], 154: [2, 162], 156: [2, 162], 157: [2, 162], 161: [2, 162], 174: [2, 162], 175: [2, 162], 180: [2, 162], 181: [2, 162], 184: [2, 162], 185: [2, 162], 186: [2, 162], 187: [2, 162], 188: [2, 162], 189: [2, 162], 190: [2, 162], 191: [2, 162], 192: [2, 162], 193: [2, 162], 194: [2, 162], 195: [2, 162], 196: [2, 162] }, { 6: [2, 108], 28: 140, 30: 136, 31: [2, 108], 36: [2, 108], 37: 143, 38: [2, 108], 40: [1, 93], 59: [2, 108], 74: 141, 75: [1, 145], 77: [1, 144], 78: [1, 139], 96: [2, 108], 101: 137, 102: 138, 103: 142, 113: [1, 88] }, { 5: 147, 7: 4, 8: 5, 9: 6, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 32: 146, 33: 20, 34: 21, 35: [1, 55], 36: [1, 148], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 149, 8: 150, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 33: 20, 34: 21, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 152, 8: 153, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 33: 20, 34: 21, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 154, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 160, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 161, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 162, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 36: [1, 163], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 14: 165, 15: 166, 28: 81, 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 167, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 164, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 138: [1, 75], 153: [1, 71], 178: [1, 159] }, { 14: 165, 15: 166, 28: 81, 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 167, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 168, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 138: [1, 75], 153: [1, 71], 178: [1, 159] }, { 1: [2, 151], 6: [2, 151], 29: [2, 151], 31: [2, 151], 36: [2, 151], 38: [2, 151], 46: [2, 151], 47: [2, 151], 52: [2, 151], 59: [2, 151], 68: [2, 151], 72: [2, 151], 76: [2, 151], 78: [2, 151], 87: [2, 151], 88: [2, 151], 89: [2, 151], 90: [2, 151], 91: [2, 151], 92: [2, 151], 93: [2, 151], 96: [2, 151], 107: [2, 151], 114: [2, 151], 117: [2, 151], 118: [2, 151], 135: [2, 151], 136: [2, 151], 143: [2, 151], 154: [2, 151], 156: [2, 151], 157: [2, 151], 161: [2, 151], 174: [2, 151], 175: [2, 151], 180: [2, 151], 181: [2, 151], 182: [1, 169], 183: [1, 170], 184: [2, 151], 185: [2, 151], 186: [2, 151], 187: [2, 151], 188: [2, 151], 189: [2, 151], 190: [2, 151], 191: [2, 151], 192: [2, 151], 193: [2, 151], 194: [2, 151], 195: [2, 151], 196: [2, 151], 197: [1, 171] }, { 1: [2, 341], 6: [2, 341], 31: [2, 341], 36: [2, 341], 38: [2, 341], 52: [2, 341], 59: [2, 341], 72: [2, 341], 76: [2, 341], 78: [2, 341], 92: [2, 341], 96: [2, 341], 114: [2, 341], 117: [2, 341], 118: [2, 341], 143: [2, 341], 154: [2, 341], 156: [2, 341], 157: [2, 341], 161: [2, 341], 167: [1, 172], 174: [2, 341], 175: [2, 341], 180: [2, 341], 181: [2, 341], 184: [2, 341], 185: [2, 341], 186: [2, 341], 187: [2, 341], 188: [2, 341], 189: [2, 341], 190: [2, 341], 191: [2, 341], 192: [2, 341], 193: [2, 341], 194: [2, 341], 195: [2, 341], 196: [2, 341] }, { 1: [2, 343], 6: [2, 343], 31: [2, 343], 36: [2, 343], 38: [2, 343], 52: [2, 343], 59: [2, 343], 72: [2, 343], 76: [2, 343], 78: [2, 343], 92: [2, 343], 96: [2, 343], 114: [2, 343], 117: [2, 343], 118: [2, 343], 143: [2, 343], 154: [2, 343], 156: [2, 343], 157: [2, 343], 161: [2, 343], 174: [2, 343], 175: [2, 343], 180: [2, 343], 181: [2, 343], 184: [2, 343], 185: [2, 343], 186: [2, 343], 187: [2, 343], 188: [2, 343], 189: [2, 343], 190: [2, 343], 191: [2, 343], 192: [2, 343], 193: [2, 343], 194: [2, 343], 195: [2, 343], 196: [2, 343] }, { 32: 173, 36: [1, 148] }, { 32: 174, 36: [1, 148] }, { 1: [2, 290], 6: [2, 290], 31: [2, 290], 36: [2, 290], 38: [2, 290], 52: [2, 290], 59: [2, 290], 72: [2, 290], 76: [2, 290], 78: [2, 290], 92: [2, 290], 96: [2, 290], 114: [2, 290], 117: [2, 290], 118: [2, 290], 143: [2, 290], 154: [2, 290], 156: [2, 290], 157: [2, 290], 161: [2, 290], 174: [2, 290], 175: [2, 290], 180: [2, 290], 181: [2, 290], 184: [2, 290], 185: [2, 290], 186: [2, 290], 187: [2, 290], 188: [2, 290], 189: [2, 290], 190: [2, 290], 191: [2, 290], 192: [2, 290], 193: [2, 290], 194: [2, 290], 195: [2, 290], 196: [2, 290] }, { 28: 180, 37: 183, 40: [1, 93], 74: 181, 75: [1, 72], 77: [1, 144], 103: 182, 108: 178, 113: [1, 88], 115: 175, 119: [1, 176], 163: [1, 177], 164: 179 }, { 7: 184, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 36: [1, 185], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 178], 6: [2, 178], 14: 165, 15: 166, 28: 81, 31: [2, 178], 32: 186, 36: [1, 148], 37: 62, 38: [2, 178], 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 52: [2, 178], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 59: [2, 178], 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 167, 72: [2, 178], 74: 82, 75: [1, 72], 76: [2, 178], 77: [1, 76], 78: [2, 178], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 92: [2, 178], 95: [1, 155], 96: [2, 178], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 188, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [2, 178], 117: [2, 178], 118: [2, 178], 122: [1, 187], 138: [1, 75], 143: [2, 178], 153: [1, 71], 154: [2, 178], 156: [2, 178], 157: [2, 178], 161: [2, 178], 174: [2, 178], 175: [2, 178], 178: [1, 159], 180: [2, 178], 181: [2, 178], 184: [2, 178], 185: [2, 178], 186: [2, 178], 187: [2, 178], 188: [2, 178], 189: [2, 178], 190: [2, 178], 191: [2, 178], 192: [2, 178], 193: [2, 178], 194: [2, 178], 195: [2, 178], 196: [2, 178] }, { 7: 189, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 36: [1, 190], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 30], 6: [2, 30], 7: 191, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 31: [2, 30], 35: [1, 55], 36: [1, 192], 37: 62, 38: [2, 30], 39: [1, 193], 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 52: [2, 30], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 59: [2, 30], 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 72: [2, 30], 74: 82, 75: [1, 72], 76: [2, 30], 77: [1, 76], 78: [2, 30], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 92: [2, 30], 94: [1, 58], 95: [1, 155], 96: [2, 30], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [2, 30], 117: [2, 30], 118: [2, 30], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 143: [2, 30], 148: [1, 48], 152: [1, 54], 153: [1, 71], 154: [2, 30], 155: 49, 156: [2, 30], 157: [2, 30], 158: 50, 159: [1, 87], 161: [2, 30], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 174: [2, 30], 175: [2, 30], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44], 184: [2, 30], 185: [2, 30], 186: [2, 30], 187: [2, 30], 188: [2, 30], 189: [2, 30], 190: [2, 30], 191: [2, 30], 192: [2, 30], 193: [2, 30], 194: [2, 30], 195: [2, 30], 196: [2, 30] }, { 28: 194, 40: [1, 93] }, { 15: 196, 33: 195, 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80] }, { 1: [2, 99], 6: [2, 99], 7: 197, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 31: [2, 99], 35: [1, 55], 36: [1, 198], 37: 62, 38: [2, 99], 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 52: [2, 99], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 59: [2, 99], 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 76: [2, 99], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 154: [2, 99], 155: 49, 156: [2, 99], 157: [2, 99], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 174: [2, 99], 175: [2, 99], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 28: 203, 40: [1, 93], 45: 199, 46: [1, 94], 47: [1, 95], 113: [1, 202], 124: 200, 125: 201, 130: [1, 204] }, { 23: 206, 26: 207, 27: [1, 56], 28: 208, 40: [1, 93], 113: [1, 205], 121: [1, 53], 129: [1, 209], 133: [1, 210] }, { 1: [2, 152], 6: [2, 152], 29: [2, 152], 31: [2, 152], 36: [2, 152], 38: [2, 152], 46: [2, 152], 47: [2, 152], 52: [2, 152], 59: [2, 152], 68: [2, 152], 72: [2, 152], 76: [2, 152], 78: [2, 152], 87: [2, 152], 88: [2, 152], 89: [2, 152], 90: [2, 152], 91: [2, 152], 92: [2, 152], 93: [2, 152], 96: [2, 152], 107: [2, 152], 114: [2, 152], 117: [2, 152], 118: [2, 152], 135: [2, 152], 136: [2, 152], 143: [2, 152], 154: [2, 152], 156: [2, 152], 157: [2, 152], 161: [2, 152], 174: [2, 152], 175: [2, 152], 180: [2, 152], 181: [2, 152], 184: [2, 152], 185: [2, 152], 186: [2, 152], 187: [2, 152], 188: [2, 152], 189: [2, 152], 190: [2, 152], 191: [2, 152], 192: [2, 152], 193: [2, 152], 194: [2, 152], 195: [2, 152], 196: [2, 152] }, { 1: [2, 153], 6: [2, 153], 29: [2, 153], 31: [2, 153], 36: [2, 153], 38: [2, 153], 46: [2, 153], 47: [2, 153], 52: [2, 153], 59: [2, 153], 68: [2, 153], 72: [2, 153], 76: [2, 153], 78: [2, 153], 87: [2, 153], 88: [2, 153], 89: [2, 153], 90: [2, 153], 91: [2, 153], 92: [2, 153], 93: [2, 153], 96: [2, 153], 107: [2, 153], 114: [2, 153], 117: [2, 153], 118: [2, 153], 135: [2, 153], 136: [2, 153], 143: [2, 153], 154: [2, 153], 156: [2, 153], 157: [2, 153], 161: [2, 153], 174: [2, 153], 175: [2, 153], 180: [2, 153], 181: [2, 153], 184: [2, 153], 185: [2, 153], 186: [2, 153], 187: [2, 153], 188: [2, 153], 189: [2, 153], 190: [2, 153], 191: [2, 153], 192: [2, 153], 193: [2, 153], 194: [2, 153], 195: [2, 153], 196: [2, 153] }, { 1: [2, 52], 6: [2, 52], 29: [2, 52], 31: [2, 52], 36: [2, 52], 38: [2, 52], 46: [2, 52], 47: [2, 52], 52: [2, 52], 59: [2, 52], 72: [2, 52], 76: [2, 52], 78: [2, 52], 87: [2, 52], 88: [2, 52], 89: [2, 52], 90: [2, 52], 91: [2, 52], 92: [2, 52], 93: [2, 52], 96: [2, 52], 107: [2, 52], 114: [2, 52], 117: [2, 52], 118: [2, 52], 135: [2, 52], 136: [2, 52], 143: [2, 52], 154: [2, 52], 156: [2, 52], 157: [2, 52], 161: [2, 52], 174: [2, 52], 175: [2, 52], 180: [2, 52], 181: [2, 52], 184: [2, 52], 185: [2, 52], 186: [2, 52], 187: [2, 52], 188: [2, 52], 189: [2, 52], 190: [2, 52], 191: [2, 52], 192: [2, 52], 193: [2, 52], 194: [2, 52], 195: [2, 52], 196: [2, 52] }, { 1: [2, 53], 6: [2, 53], 29: [2, 53], 31: [2, 53], 36: [2, 53], 38: [2, 53], 46: [2, 53], 47: [2, 53], 52: [2, 53], 59: [2, 53], 72: [2, 53], 76: [2, 53], 78: [2, 53], 87: [2, 53], 88: [2, 53], 89: [2, 53], 90: [2, 53], 91: [2, 53], 92: [2, 53], 93: [2, 53], 96: [2, 53], 107: [2, 53], 114: [2, 53], 117: [2, 53], 118: [2, 53], 135: [2, 53], 136: [2, 53], 143: [2, 53], 154: [2, 53], 156: [2, 53], 157: [2, 53], 161: [2, 53], 174: [2, 53], 175: [2, 53], 180: [2, 53], 181: [2, 53], 184: [2, 53], 185: [2, 53], 186: [2, 53], 187: [2, 53], 188: [2, 53], 189: [2, 53], 190: [2, 53], 191: [2, 53], 192: [2, 53], 193: [2, 53], 194: [2, 53], 195: [2, 53], 196: [2, 53] }, { 1: [2, 54], 6: [2, 54], 29: [2, 54], 31: [2, 54], 36: [2, 54], 38: [2, 54], 46: [2, 54], 47: [2, 54], 52: [2, 54], 59: [2, 54], 72: [2, 54], 76: [2, 54], 78: [2, 54], 87: [2, 54], 88: [2, 54], 89: [2, 54], 90: [2, 54], 91: [2, 54], 92: [2, 54], 93: [2, 54], 96: [2, 54], 107: [2, 54], 114: [2, 54], 117: [2, 54], 118: [2, 54], 135: [2, 54], 136: [2, 54], 143: [2, 54], 154: [2, 54], 156: [2, 54], 157: [2, 54], 161: [2, 54], 174: [2, 54], 175: [2, 54], 180: [2, 54], 181: [2, 54], 184: [2, 54], 185: [2, 54], 186: [2, 54], 187: [2, 54], 188: [2, 54], 189: [2, 54], 190: [2, 54], 191: [2, 54], 192: [2, 54], 193: [2, 54], 194: [2, 54], 195: [2, 54], 196: [2, 54] }, { 1: [2, 55], 6: [2, 55], 29: [2, 55], 31: [2, 55], 36: [2, 55], 38: [2, 55], 46: [2, 55], 47: [2, 55], 52: [2, 55], 59: [2, 55], 72: [2, 55], 76: [2, 55], 78: [2, 55], 87: [2, 55], 88: [2, 55], 89: [2, 55], 90: [2, 55], 91: [2, 55], 92: [2, 55], 93: [2, 55], 96: [2, 55], 107: [2, 55], 114: [2, 55], 117: [2, 55], 118: [2, 55], 135: [2, 55], 136: [2, 55], 143: [2, 55], 154: [2, 55], 156: [2, 55], 157: [2, 55], 161: [2, 55], 174: [2, 55], 175: [2, 55], 180: [2, 55], 181: [2, 55], 184: [2, 55], 185: [2, 55], 186: [2, 55], 187: [2, 55], 188: [2, 55], 189: [2, 55], 190: [2, 55], 191: [2, 55], 192: [2, 55], 193: [2, 55], 194: [2, 55], 195: [2, 55], 196: [2, 55] }, { 1: [2, 56], 6: [2, 56], 29: [2, 56], 31: [2, 56], 36: [2, 56], 38: [2, 56], 46: [2, 56], 47: [2, 56], 52: [2, 56], 59: [2, 56], 72: [2, 56], 76: [2, 56], 78: [2, 56], 87: [2, 56], 88: [2, 56], 89: [2, 56], 90: [2, 56], 91: [2, 56], 92: [2, 56], 93: [2, 56], 96: [2, 56], 107: [2, 56], 114: [2, 56], 117: [2, 56], 118: [2, 56], 135: [2, 56], 136: [2, 56], 143: [2, 56], 154: [2, 56], 156: [2, 56], 157: [2, 56], 161: [2, 56], 174: [2, 56], 175: [2, 56], 180: [2, 56], 181: [2, 56], 184: [2, 56], 185: [2, 56], 186: [2, 56], 187: [2, 56], 188: [2, 56], 189: [2, 56], 190: [2, 56], 191: [2, 56], 192: [2, 56], 193: [2, 56], 194: [2, 56], 195: [2, 56], 196: [2, 56] }, { 1: [2, 57], 6: [2, 57], 29: [2, 57], 31: [2, 57], 36: [2, 57], 38: [2, 57], 46: [2, 57], 47: [2, 57], 52: [2, 57], 59: [2, 57], 72: [2, 57], 76: [2, 57], 78: [2, 57], 87: [2, 57], 88: [2, 57], 89: [2, 57], 90: [2, 57], 91: [2, 57], 92: [2, 57], 93: [2, 57], 96: [2, 57], 107: [2, 57], 114: [2, 57], 117: [2, 57], 118: [2, 57], 135: [2, 57], 136: [2, 57], 143: [2, 57], 154: [2, 57], 156: [2, 57], 157: [2, 57], 161: [2, 57], 174: [2, 57], 175: [2, 57], 180: [2, 57], 181: [2, 57], 184: [2, 57], 185: [2, 57], 186: [2, 57], 187: [2, 57], 188: [2, 57], 189: [2, 57], 190: [2, 57], 191: [2, 57], 192: [2, 57], 193: [2, 57], 194: [2, 57], 195: [2, 57], 196: [2, 57] }, { 1: [2, 58], 6: [2, 58], 29: [2, 58], 31: [2, 58], 36: [2, 58], 38: [2, 58], 46: [2, 58], 47: [2, 58], 52: [2, 58], 59: [2, 58], 72: [2, 58], 76: [2, 58], 78: [2, 58], 87: [2, 58], 88: [2, 58], 89: [2, 58], 90: [2, 58], 91: [2, 58], 92: [2, 58], 93: [2, 58], 96: [2, 58], 107: [2, 58], 114: [2, 58], 117: [2, 58], 118: [2, 58], 135: [2, 58], 136: [2, 58], 143: [2, 58], 154: [2, 58], 156: [2, 58], 157: [2, 58], 161: [2, 58], 174: [2, 58], 175: [2, 58], 180: [2, 58], 181: [2, 58], 184: [2, 58], 185: [2, 58], 186: [2, 58], 187: [2, 58], 188: [2, 58], 189: [2, 58], 190: [2, 58], 191: [2, 58], 192: [2, 58], 193: [2, 58], 194: [2, 58], 195: [2, 58], 196: [2, 58] }, { 1: [2, 59], 6: [2, 59], 29: [2, 59], 31: [2, 59], 36: [2, 59], 38: [2, 59], 46: [2, 59], 47: [2, 59], 52: [2, 59], 59: [2, 59], 72: [2, 59], 76: [2, 59], 78: [2, 59], 87: [2, 59], 88: [2, 59], 89: [2, 59], 90: [2, 59], 91: [2, 59], 92: [2, 59], 93: [2, 59], 96: [2, 59], 107: [2, 59], 114: [2, 59], 117: [2, 59], 118: [2, 59], 135: [2, 59], 136: [2, 59], 143: [2, 59], 154: [2, 59], 156: [2, 59], 157: [2, 59], 161: [2, 59], 174: [2, 59], 175: [2, 59], 180: [2, 59], 181: [2, 59], 184: [2, 59], 185: [2, 59], 186: [2, 59], 187: [2, 59], 188: [2, 59], 189: [2, 59], 190: [2, 59], 191: [2, 59], 192: [2, 59], 193: [2, 59], 194: [2, 59], 195: [2, 59], 196: [2, 59] }, { 4: 211, 5: 3, 7: 4, 8: 5, 9: 6, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 33: 20, 34: 21, 35: [1, 55], 36: [1, 212], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 213, 8: 222, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 33: 20, 34: 21, 35: [1, 55], 36: [1, 219], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 59: [1, 220], 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 76: [1, 214], 77: [1, 76], 78: [1, 224], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 104: 223, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 139: 215, 140: 216, 144: 221, 145: 218, 146: 217, 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 29: [2, 231], 46: [2, 231], 47: [2, 231], 84: 225, 87: [1, 226], 91: [1, 227], 136: [1, 128] }, { 29: [1, 229], 85: 228 }, { 1: [2, 235], 6: [2, 235], 29: [2, 235], 31: [2, 235], 36: [2, 235], 38: [2, 235], 46: [2, 235], 47: [2, 235], 52: [2, 235], 59: [2, 235], 72: [2, 235], 76: [2, 235], 78: [2, 235], 87: [2, 235], 88: [2, 235], 89: [2, 235], 90: [2, 235], 91: [2, 235], 92: [2, 235], 93: [2, 235], 96: [2, 235], 107: [2, 235], 114: [2, 235], 117: [2, 235], 118: [2, 235], 135: [2, 235], 136: [2, 235], 143: [2, 235], 154: [2, 235], 156: [2, 235], 157: [2, 235], 161: [2, 235], 174: [2, 235], 175: [2, 235], 180: [2, 235], 181: [2, 235], 184: [2, 235], 185: [2, 235], 186: [2, 235], 187: [2, 235], 188: [2, 235], 189: [2, 235], 190: [2, 235], 191: [2, 235], 192: [2, 235], 193: [2, 235], 194: [2, 235], 195: [2, 235], 196: [2, 235] }, { 1: [2, 236], 6: [2, 236], 29: [2, 236], 31: [2, 236], 36: [2, 236], 38: [2, 236], 41: 230, 42: [1, 231], 46: [2, 236], 47: [2, 236], 52: [2, 236], 59: [2, 236], 72: [2, 236], 76: [2, 236], 78: [2, 236], 87: [2, 236], 88: [2, 236], 89: [2, 236], 90: [2, 236], 91: [2, 236], 92: [2, 236], 93: [2, 236], 96: [2, 236], 107: [2, 236], 114: [2, 236], 117: [2, 236], 118: [2, 236], 135: [2, 236], 136: [2, 236], 143: [2, 236], 154: [2, 236], 156: [2, 236], 157: [2, 236], 161: [2, 236], 174: [2, 236], 175: [2, 236], 180: [2, 236], 181: [2, 236], 184: [2, 236], 185: [2, 236], 186: [2, 236], 187: [2, 236], 188: [2, 236], 189: [2, 236], 190: [2, 236], 191: [2, 236], 192: [2, 236], 193: [2, 236], 194: [2, 236], 195: [2, 236], 196: [2, 236] }, { 87: [1, 232] }, { 87: [1, 233] }, { 11: [2, 104], 27: [2, 104], 35: [2, 104], 36: [2, 104], 40: [2, 104], 44: [2, 104], 46: [2, 104], 47: [2, 104], 54: [2, 104], 55: [2, 104], 61: [2, 104], 62: [2, 104], 63: [2, 104], 64: [2, 104], 65: [2, 104], 66: [2, 104], 75: [2, 104], 77: [2, 104], 83: [2, 104], 86: [2, 104], 94: [2, 104], 95: [2, 104], 98: [2, 104], 99: [2, 104], 111: [2, 104], 112: [2, 104], 113: [2, 104], 114: [2, 104], 121: [2, 104], 123: [2, 104], 131: [2, 104], 138: [2, 104], 148: [2, 104], 152: [2, 104], 153: [2, 104], 156: [2, 104], 157: [2, 104], 159: [2, 104], 163: [2, 104], 165: [2, 104], 171: [2, 104], 173: [2, 104], 176: [2, 104], 177: [2, 104], 178: [2, 104], 179: [2, 104], 180: [2, 104], 181: [2, 104], 182: [2, 104], 183: [2, 104] }, { 11: [2, 105], 27: [2, 105], 35: [2, 105], 36: [2, 105], 40: [2, 105], 44: [2, 105], 46: [2, 105], 47: [2, 105], 54: [2, 105], 55: [2, 105], 61: [2, 105], 62: [2, 105], 63: [2, 105], 64: [2, 105], 65: [2, 105], 66: [2, 105], 75: [2, 105], 77: [2, 105], 83: [2, 105], 86: [2, 105], 94: [2, 105], 95: [2, 105], 98: [2, 105], 99: [2, 105], 111: [2, 105], 112: [2, 105], 113: [2, 105], 114: [2, 105], 121: [2, 105], 123: [2, 105], 131: [2, 105], 138: [2, 105], 148: [2, 105], 152: [2, 105], 153: [2, 105], 156: [2, 105], 157: [2, 105], 159: [2, 105], 163: [2, 105], 165: [2, 105], 171: [2, 105], 173: [2, 105], 176: [2, 105], 177: [2, 105], 178: [2, 105], 179: [2, 105], 180: [2, 105], 181: [2, 105], 182: [2, 105], 183: [2, 105] }, { 1: [2, 122], 6: [2, 122], 29: [2, 122], 31: [2, 122], 36: [2, 122], 38: [2, 122], 46: [2, 122], 47: [2, 122], 52: [2, 122], 59: [2, 122], 68: [2, 122], 72: [2, 122], 76: [2, 122], 78: [2, 122], 87: [2, 122], 88: [2, 122], 89: [2, 122], 90: [2, 122], 91: [2, 122], 92: [2, 122], 93: [2, 122], 96: [2, 122], 107: [2, 122], 114: [2, 122], 117: [2, 122], 118: [2, 122], 122: [2, 122], 135: [2, 122], 136: [2, 122], 143: [2, 122], 154: [2, 122], 156: [2, 122], 157: [2, 122], 161: [2, 122], 174: [2, 122], 175: [2, 122], 180: [2, 122], 181: [2, 122], 182: [2, 122], 183: [2, 122], 184: [2, 122], 185: [2, 122], 186: [2, 122], 187: [2, 122], 188: [2, 122], 189: [2, 122], 190: [2, 122], 191: [2, 122], 192: [2, 122], 193: [2, 122], 194: [2, 122], 195: [2, 122], 196: [2, 122], 197: [2, 122] }, { 1: [2, 123], 6: [2, 123], 29: [2, 123], 31: [2, 123], 36: [2, 123], 38: [2, 123], 46: [2, 123], 47: [2, 123], 52: [2, 123], 59: [2, 123], 68: [2, 123], 72: [2, 123], 76: [2, 123], 78: [2, 123], 87: [2, 123], 88: [2, 123], 89: [2, 123], 90: [2, 123], 91: [2, 123], 92: [2, 123], 93: [2, 123], 96: [2, 123], 107: [2, 123], 114: [2, 123], 117: [2, 123], 118: [2, 123], 122: [2, 123], 135: [2, 123], 136: [2, 123], 143: [2, 123], 154: [2, 123], 156: [2, 123], 157: [2, 123], 161: [2, 123], 174: [2, 123], 175: [2, 123], 180: [2, 123], 181: [2, 123], 182: [2, 123], 183: [2, 123], 184: [2, 123], 185: [2, 123], 186: [2, 123], 187: [2, 123], 188: [2, 123], 189: [2, 123], 190: [2, 123], 191: [2, 123], 192: [2, 123], 193: [2, 123], 194: [2, 123], 195: [2, 123], 196: [2, 123], 197: [2, 123] }, { 7: 234, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 235, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 236, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 237, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 239, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 32: 238, 35: [1, 55], 36: [1, 148], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 6: [2, 173], 28: 247, 36: [2, 173], 38: [2, 173], 40: [1, 93], 41: 248, 42: [1, 231], 43: 245, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 59: [2, 173], 69: 246, 70: 240, 71: 250, 73: 242, 74: 249, 75: [1, 243], 77: [1, 244], 78: [1, 251], 117: [2, 173], 120: 241 }, { 1: [2, 38], 6: [2, 38], 29: [2, 38], 31: [2, 38], 36: [2, 38], 38: [2, 38], 46: [2, 38], 47: [2, 38], 52: [2, 38], 59: [2, 38], 72: [2, 38], 76: [2, 38], 78: [2, 38], 87: [2, 38], 88: [2, 38], 89: [2, 38], 90: [2, 38], 91: [2, 38], 92: [2, 38], 93: [2, 38], 96: [2, 38], 107: [2, 38], 114: [2, 38], 117: [2, 38], 118: [2, 38], 135: [2, 38], 136: [2, 38], 143: [2, 38], 154: [2, 38], 156: [2, 38], 157: [2, 38], 161: [2, 38], 174: [2, 38], 175: [2, 38], 180: [2, 38], 181: [2, 38], 184: [2, 38], 185: [2, 38], 186: [2, 38], 187: [2, 38], 188: [2, 38], 189: [2, 38], 190: [2, 38], 191: [2, 38], 192: [2, 38], 193: [2, 38], 194: [2, 38], 195: [2, 38], 196: [2, 38] }, { 1: [2, 39], 6: [2, 39], 29: [2, 39], 31: [2, 39], 36: [2, 39], 38: [2, 39], 46: [2, 39], 47: [2, 39], 52: [2, 39], 59: [2, 39], 72: [2, 39], 76: [2, 39], 78: [2, 39], 87: [2, 39], 88: [2, 39], 89: [2, 39], 90: [2, 39], 91: [2, 39], 92: [2, 39], 93: [2, 39], 96: [2, 39], 107: [2, 39], 114: [2, 39], 117: [2, 39], 118: [2, 39], 135: [2, 39], 136: [2, 39], 143: [2, 39], 154: [2, 39], 156: [2, 39], 157: [2, 39], 161: [2, 39], 174: [2, 39], 175: [2, 39], 180: [2, 39], 181: [2, 39], 184: [2, 39], 185: [2, 39], 186: [2, 39], 187: [2, 39], 188: [2, 39], 189: [2, 39], 190: [2, 39], 191: [2, 39], 192: [2, 39], 193: [2, 39], 194: [2, 39], 195: [2, 39], 196: [2, 39] }, { 1: [2, 48], 6: [2, 48], 29: [2, 48], 31: [2, 48], 36: [2, 48], 38: [2, 48], 46: [2, 48], 47: [2, 48], 52: [2, 48], 59: [2, 48], 72: [2, 48], 76: [2, 48], 78: [2, 48], 87: [2, 48], 88: [2, 48], 89: [2, 48], 90: [2, 48], 91: [2, 48], 92: [2, 48], 93: [2, 48], 96: [2, 48], 107: [2, 48], 114: [2, 48], 117: [2, 48], 118: [2, 48], 135: [2, 48], 136: [2, 48], 143: [2, 48], 154: [2, 48], 156: [2, 48], 157: [2, 48], 161: [2, 48], 174: [2, 48], 175: [2, 48], 180: [2, 48], 181: [2, 48], 184: [2, 48], 185: [2, 48], 186: [2, 48], 187: [2, 48], 188: [2, 48], 189: [2, 48], 190: [2, 48], 191: [2, 48], 192: [2, 48], 193: [2, 48], 194: [2, 48], 195: [2, 48], 196: [2, 48] }, { 14: 165, 15: 166, 28: 81, 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 252, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 167, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 253, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 138: [1, 75], 153: [1, 71], 178: [1, 159] }, { 1: [2, 36], 6: [2, 36], 29: [2, 36], 31: [2, 36], 36: [2, 36], 38: [2, 36], 39: [2, 36], 46: [2, 36], 47: [2, 36], 52: [2, 36], 59: [2, 36], 68: [2, 36], 72: [2, 36], 76: [2, 36], 78: [2, 36], 87: [2, 36], 88: [2, 36], 89: [2, 36], 90: [2, 36], 91: [2, 36], 92: [2, 36], 93: [2, 36], 96: [2, 36], 107: [2, 36], 114: [2, 36], 116: [2, 36], 117: [2, 36], 118: [2, 36], 122: [2, 36], 128: [2, 36], 135: [2, 36], 136: [2, 36], 143: [2, 36], 154: [2, 36], 156: [2, 36], 157: [2, 36], 160: [2, 36], 161: [2, 36], 162: [2, 36], 174: [2, 36], 175: [2, 36], 180: [2, 36], 181: [2, 36], 182: [2, 36], 183: [2, 36], 184: [2, 36], 185: [2, 36], 186: [2, 36], 187: [2, 36], 188: [2, 36], 189: [2, 36], 190: [2, 36], 191: [2, 36], 192: [2, 36], 193: [2, 36], 194: [2, 36], 195: [2, 36], 196: [2, 36], 197: [2, 36] }, { 1: [2, 40], 6: [2, 40], 29: [2, 40], 31: [2, 40], 36: [2, 40], 38: [2, 40], 46: [2, 40], 47: [2, 40], 49: [2, 40], 51: [2, 40], 52: [2, 40], 57: [2, 40], 59: [2, 40], 72: [2, 40], 76: [2, 40], 78: [2, 40], 87: [2, 40], 88: [2, 40], 89: [2, 40], 90: [2, 40], 91: [2, 40], 92: [2, 40], 93: [2, 40], 96: [2, 40], 107: [2, 40], 114: [2, 40], 117: [2, 40], 118: [2, 40], 135: [2, 40], 136: [2, 40], 143: [2, 40], 154: [2, 40], 156: [2, 40], 157: [2, 40], 161: [2, 40], 174: [2, 40], 175: [2, 40], 180: [2, 40], 181: [2, 40], 184: [2, 40], 185: [2, 40], 186: [2, 40], 187: [2, 40], 188: [2, 40], 189: [2, 40], 190: [2, 40], 191: [2, 40], 192: [2, 40], 193: [2, 40], 194: [2, 40], 195: [2, 40], 196: [2, 40] }, { 45: 257, 46: [1, 94], 47: [1, 95], 48: 254, 50: 255, 51: [1, 256] }, { 1: [2, 5], 5: 258, 6: [2, 5], 7: 4, 8: 5, 9: 6, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 33: 20, 34: 21, 35: [1, 55], 37: 62, 38: [2, 5], 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 52: [2, 5], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 154: [2, 5], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 362], 6: [2, 362], 31: [2, 362], 36: [2, 362], 38: [2, 362], 52: [2, 362], 59: [2, 362], 72: [2, 362], 76: [2, 362], 78: [2, 362], 92: [2, 362], 96: [2, 362], 114: [2, 362], 117: [2, 362], 118: [2, 362], 143: [2, 362], 154: [2, 362], 156: [2, 362], 157: [2, 362], 161: [2, 362], 174: [2, 362], 175: [2, 362], 180: [2, 362], 181: [2, 362], 184: [2, 362], 185: [2, 362], 186: [2, 362], 187: [2, 362], 188: [2, 362], 189: [2, 362], 190: [2, 362], 191: [2, 362], 192: [2, 362], 193: [2, 362], 194: [2, 362], 195: [2, 362], 196: [2, 362] }, { 7: 259, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 260, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 261, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 262, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 263, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 264, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 265, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 266, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 267, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 268, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 269, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 270, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 271, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 272, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 273, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 274, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 289], 6: [2, 289], 31: [2, 289], 36: [2, 289], 38: [2, 289], 52: [2, 289], 59: [2, 289], 72: [2, 289], 76: [2, 289], 78: [2, 289], 92: [2, 289], 96: [2, 289], 114: [2, 289], 117: [2, 289], 118: [2, 289], 143: [2, 289], 154: [2, 289], 156: [2, 289], 157: [2, 289], 161: [2, 289], 174: [2, 289], 175: [2, 289], 180: [2, 289], 181: [2, 289], 184: [2, 289], 185: [2, 289], 186: [2, 289], 187: [2, 289], 188: [2, 289], 189: [2, 289], 190: [2, 289], 191: [2, 289], 192: [2, 289], 193: [2, 289], 194: [2, 289], 195: [2, 289], 196: [2, 289] }, { 28: 180, 37: 183, 40: [1, 93], 74: 181, 75: [1, 72], 77: [1, 144], 103: 182, 108: 278, 113: [1, 88], 115: 275, 119: [1, 276], 163: [1, 277], 164: 179 }, { 7: 279, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 280, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 288], 6: [2, 288], 31: [2, 288], 36: [2, 288], 38: [2, 288], 52: [2, 288], 59: [2, 288], 72: [2, 288], 76: [2, 288], 78: [2, 288], 92: [2, 288], 96: [2, 288], 114: [2, 288], 117: [2, 288], 118: [2, 288], 143: [2, 288], 154: [2, 288], 156: [2, 288], 157: [2, 288], 161: [2, 288], 174: [2, 288], 175: [2, 288], 180: [2, 288], 181: [2, 288], 184: [2, 288], 185: [2, 288], 186: [2, 288], 187: [2, 288], 188: [2, 288], 189: [2, 288], 190: [2, 288], 191: [2, 288], 192: [2, 288], 193: [2, 288], 194: [2, 288], 195: [2, 288], 196: [2, 288] }, { 29: [1, 229], 45: 281, 46: [1, 94], 47: [1, 95], 85: 282 }, { 29: [1, 229], 85: 283 }, { 41: 284, 42: [1, 231] }, { 41: 285, 42: [1, 231] }, { 1: [2, 128], 6: [2, 128], 29: [2, 128], 31: [2, 128], 36: [2, 128], 38: [2, 128], 41: 286, 42: [1, 231], 46: [2, 128], 47: [2, 128], 52: [2, 128], 59: [2, 128], 68: [2, 128], 72: [2, 128], 76: [2, 128], 78: [2, 128], 87: [2, 128], 88: [2, 128], 89: [2, 128], 90: [2, 128], 91: [2, 128], 92: [2, 128], 93: [2, 128], 96: [2, 128], 107: [2, 128], 114: [2, 128], 117: [2, 128], 118: [2, 128], 122: [2, 128], 135: [2, 128], 136: [2, 128], 143: [2, 128], 154: [2, 128], 156: [2, 128], 157: [2, 128], 161: [2, 128], 174: [2, 128], 175: [2, 128], 180: [2, 128], 181: [2, 128], 182: [2, 128], 183: [2, 128], 184: [2, 128], 185: [2, 128], 186: [2, 128], 187: [2, 128], 188: [2, 128], 189: [2, 128], 190: [2, 128], 191: [2, 128], 192: [2, 128], 193: [2, 128], 194: [2, 128], 195: [2, 128], 196: [2, 128], 197: [2, 128] }, { 1: [2, 129], 6: [2, 129], 29: [2, 129], 31: [2, 129], 36: [2, 129], 38: [2, 129], 41: 287, 42: [1, 231], 46: [2, 129], 47: [2, 129], 52: [2, 129], 59: [2, 129], 68: [2, 129], 72: [2, 129], 76: [2, 129], 78: [2, 129], 87: [2, 129], 88: [2, 129], 89: [2, 129], 90: [2, 129], 91: [2, 129], 92: [2, 129], 93: [2, 129], 96: [2, 129], 107: [2, 129], 114: [2, 129], 117: [2, 129], 118: [2, 129], 122: [2, 129], 135: [2, 129], 136: [2, 129], 143: [2, 129], 154: [2, 129], 156: [2, 129], 157: [2, 129], 161: [2, 129], 174: [2, 129], 175: [2, 129], 180: [2, 129], 181: [2, 129], 182: [2, 129], 183: [2, 129], 184: [2, 129], 185: [2, 129], 186: [2, 129], 187: [2, 129], 188: [2, 129], 189: [2, 129], 190: [2, 129], 191: [2, 129], 192: [2, 129], 193: [2, 129], 194: [2, 129], 195: [2, 129], 196: [2, 129], 197: [2, 129] }, { 7: 288, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 36: [1, 289], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 293, 54: [1, 91], 55: [1, 92], 56: 30, 58: 291, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 78: [1, 295], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 106: 290, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 142: 292, 143: [1, 294], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 91: [1, 296] }, { 91: [1, 297] }, { 29: [2, 232], 46: [2, 232], 47: [2, 232] }, { 41: 298, 42: [1, 231] }, { 41: 299, 42: [1, 231] }, { 1: [2, 145], 6: [2, 145], 29: [2, 145], 31: [2, 145], 36: [2, 145], 38: [2, 145], 41: 300, 42: [1, 231], 46: [2, 145], 47: [2, 145], 52: [2, 145], 59: [2, 145], 68: [2, 145], 72: [2, 145], 76: [2, 145], 78: [2, 145], 87: [2, 145], 88: [2, 145], 89: [2, 145], 90: [2, 145], 91: [2, 145], 92: [2, 145], 93: [2, 145], 96: [2, 145], 107: [2, 145], 114: [2, 145], 117: [2, 145], 118: [2, 145], 122: [2, 145], 135: [2, 145], 136: [2, 145], 143: [2, 145], 154: [2, 145], 156: [2, 145], 157: [2, 145], 161: [2, 145], 174: [2, 145], 175: [2, 145], 180: [2, 145], 181: [2, 145], 182: [2, 145], 183: [2, 145], 184: [2, 145], 185: [2, 145], 186: [2, 145], 187: [2, 145], 188: [2, 145], 189: [2, 145], 190: [2, 145], 191: [2, 145], 192: [2, 145], 193: [2, 145], 194: [2, 145], 195: [2, 145], 196: [2, 145], 197: [2, 145] }, { 1: [2, 146], 6: [2, 146], 29: [2, 146], 31: [2, 146], 36: [2, 146], 38: [2, 146], 41: 301, 42: [1, 231], 46: [2, 146], 47: [2, 146], 52: [2, 146], 59: [2, 146], 68: [2, 146], 72: [2, 146], 76: [2, 146], 78: [2, 146], 87: [2, 146], 88: [2, 146], 89: [2, 146], 90: [2, 146], 91: [2, 146], 92: [2, 146], 93: [2, 146], 96: [2, 146], 107: [2, 146], 114: [2, 146], 117: [2, 146], 118: [2, 146], 122: [2, 146], 135: [2, 146], 136: [2, 146], 143: [2, 146], 154: [2, 146], 156: [2, 146], 157: [2, 146], 161: [2, 146], 174: [2, 146], 175: [2, 146], 180: [2, 146], 181: [2, 146], 182: [2, 146], 183: [2, 146], 184: [2, 146], 185: [2, 146], 186: [2, 146], 187: [2, 146], 188: [2, 146], 189: [2, 146], 190: [2, 146], 191: [2, 146], 192: [2, 146], 193: [2, 146], 194: [2, 146], 195: [2, 146], 196: [2, 146], 197: [2, 146] }, { 7: 302, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 36: [1, 303], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 91: [1, 304] }, { 6: [1, 306], 7: 305, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 36: [1, 307], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 6: [2, 106], 31: [2, 106], 36: [2, 106], 38: [2, 106], 59: [1, 309], 76: [2, 106], 96: [1, 308], 100: 310, 117: [2, 106] }, { 6: [2, 109], 31: [2, 109], 36: [2, 109], 38: [2, 109], 59: [2, 109], 96: [2, 109] }, { 6: [2, 113], 31: [2, 113], 36: [2, 113], 38: [2, 113], 59: [2, 113], 68: [1, 311], 96: [2, 113] }, { 6: [2, 116], 28: 140, 31: [2, 116], 36: [2, 116], 37: 143, 38: [2, 116], 40: [1, 93], 59: [2, 116], 74: 141, 75: [1, 145], 77: [1, 144], 96: [2, 116], 102: 312, 103: 142, 113: [1, 88] }, { 6: [2, 117], 31: [2, 117], 36: [2, 117], 38: [2, 117], 59: [2, 117], 68: [2, 117], 96: [2, 117] }, { 6: [2, 118], 31: [2, 118], 36: [2, 118], 38: [2, 118], 59: [2, 118], 68: [2, 118], 96: [2, 118] }, { 6: [2, 119], 31: [2, 119], 36: [2, 119], 38: [2, 119], 59: [2, 119], 68: [2, 119], 96: [2, 119] }, { 6: [2, 120], 31: [2, 120], 36: [2, 120], 38: [2, 120], 59: [2, 120], 68: [2, 120], 96: [2, 120] }, { 41: 230, 42: [1, 231] }, { 7: 313, 8: 222, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 33: 20, 34: 21, 35: [1, 55], 36: [1, 219], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 59: [1, 220], 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 76: [1, 214], 77: [1, 76], 78: [1, 224], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 104: 223, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 139: 215, 140: 216, 144: 221, 145: 218, 146: 217, 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 101], 6: [2, 101], 29: [2, 101], 31: [2, 101], 36: [2, 101], 38: [2, 101], 46: [2, 101], 47: [2, 101], 52: [2, 101], 59: [2, 101], 72: [2, 101], 76: [2, 101], 78: [2, 101], 87: [2, 101], 88: [2, 101], 89: [2, 101], 90: [2, 101], 91: [2, 101], 92: [2, 101], 93: [2, 101], 96: [2, 101], 107: [2, 101], 114: [2, 101], 117: [2, 101], 118: [2, 101], 135: [2, 101], 136: [2, 101], 143: [2, 101], 154: [2, 101], 156: [2, 101], 157: [2, 101], 161: [2, 101], 174: [2, 101], 175: [2, 101], 180: [2, 101], 181: [2, 101], 184: [2, 101], 185: [2, 101], 186: [2, 101], 187: [2, 101], 188: [2, 101], 189: [2, 101], 190: [2, 101], 191: [2, 101], 192: [2, 101], 193: [2, 101], 194: [2, 101], 195: [2, 101], 196: [2, 101] }, { 1: [2, 103], 6: [2, 103], 31: [2, 103], 36: [2, 103], 38: [2, 103], 52: [2, 103], 59: [2, 103], 76: [2, 103], 154: [2, 103] }, { 4: 315, 5: 3, 7: 4, 8: 5, 9: 6, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 33: 20, 34: 21, 35: [1, 55], 37: 62, 38: [1, 314], 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 351], 6: [2, 351], 31: [2, 351], 36: [2, 351], 38: [2, 351], 52: [2, 351], 59: [2, 351], 72: [2, 351], 76: [2, 351], 78: [2, 351], 92: [2, 351], 96: [2, 351], 114: [2, 351], 117: [2, 351], 118: [2, 351], 143: [2, 351], 154: [2, 351], 155: 114, 156: [2, 351], 157: [2, 351], 161: [2, 351], 174: [2, 351], 175: [1, 113], 180: [2, 351], 181: [2, 351], 184: [1, 97], 185: [2, 351], 186: [2, 351], 187: [2, 351], 188: [2, 351], 189: [2, 351], 190: [2, 351], 191: [2, 351], 192: [2, 351], 193: [2, 351], 194: [1, 109], 195: [2, 351], 196: [2, 351] }, { 1: [2, 348], 6: [2, 348], 31: [2, 348], 36: [2, 348], 38: [2, 348], 52: [2, 348], 59: [2, 348], 76: [2, 348], 154: [2, 348] }, { 155: 118, 156: [1, 85], 157: [1, 86], 174: [1, 116], 175: [1, 117] }, { 1: [2, 352], 6: [2, 352], 31: [2, 352], 36: [2, 352], 38: [2, 352], 52: [2, 352], 59: [2, 352], 72: [2, 352], 76: [2, 352], 78: [2, 352], 92: [2, 352], 96: [2, 352], 114: [2, 352], 117: [2, 352], 118: [2, 352], 143: [2, 352], 154: [2, 352], 155: 114, 156: [2, 352], 157: [2, 352], 161: [2, 352], 174: [2, 352], 175: [1, 113], 180: [2, 352], 181: [2, 352], 184: [1, 97], 185: [2, 352], 186: [2, 352], 187: [2, 352], 188: [2, 352], 189: [2, 352], 190: [2, 352], 191: [2, 352], 192: [2, 352], 193: [2, 352], 194: [1, 109], 195: [2, 352], 196: [2, 352] }, { 1: [2, 349], 6: [2, 349], 31: [2, 349], 36: [2, 349], 38: [2, 349], 52: [2, 349], 59: [2, 349], 76: [2, 349], 154: [2, 349] }, { 1: [2, 353], 6: [2, 353], 31: [2, 353], 36: [2, 353], 38: [2, 353], 52: [2, 353], 59: [2, 353], 72: [2, 353], 76: [2, 353], 78: [2, 353], 92: [2, 353], 96: [2, 353], 114: [2, 353], 117: [2, 353], 118: [2, 353], 143: [2, 353], 154: [2, 353], 155: 114, 156: [2, 353], 157: [2, 353], 161: [2, 353], 174: [2, 353], 175: [1, 113], 180: [2, 353], 181: [2, 353], 184: [1, 97], 185: [2, 353], 186: [1, 101], 187: [2, 353], 188: [2, 353], 189: [2, 353], 190: [2, 353], 191: [2, 353], 192: [2, 353], 193: [2, 353], 194: [1, 109], 195: [2, 353], 196: [2, 353] }, { 6: [2, 108], 28: 140, 30: 316, 31: [2, 108], 36: [2, 108], 37: 143, 38: [2, 108], 40: [1, 93], 59: [2, 108], 74: 141, 75: [1, 145], 77: [1, 144], 78: [1, 139], 96: [2, 108], 101: 137, 102: 138, 103: 142, 113: [1, 88] }, { 32: 146, 36: [1, 148] }, { 7: 149, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 152, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 15: 196, 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80] }, { 1: [2, 354], 6: [2, 354], 31: [2, 354], 36: [2, 354], 38: [2, 354], 52: [2, 354], 59: [2, 354], 72: [2, 354], 76: [2, 354], 78: [2, 354], 92: [2, 354], 96: [2, 354], 114: [2, 354], 117: [2, 354], 118: [2, 354], 143: [2, 354], 154: [2, 354], 155: 114, 156: [2, 354], 157: [2, 354], 161: [2, 354], 174: [2, 354], 175: [1, 113], 180: [2, 354], 181: [2, 354], 184: [1, 97], 185: [2, 354], 186: [1, 101], 187: [2, 354], 188: [2, 354], 189: [2, 354], 190: [2, 354], 191: [2, 354], 192: [2, 354], 193: [2, 354], 194: [1, 109], 195: [2, 354], 196: [2, 354] }, { 1: [2, 355], 6: [2, 355], 31: [2, 355], 36: [2, 355], 38: [2, 355], 52: [2, 355], 59: [2, 355], 72: [2, 355], 76: [2, 355], 78: [2, 355], 92: [2, 355], 96: [2, 355], 114: [2, 355], 117: [2, 355], 118: [2, 355], 143: [2, 355], 154: [2, 355], 155: 114, 156: [2, 355], 157: [2, 355], 161: [2, 355], 174: [2, 355], 175: [1, 113], 180: [2, 355], 181: [2, 355], 184: [1, 97], 185: [2, 355], 186: [1, 101], 187: [2, 355], 188: [2, 355], 189: [2, 355], 190: [2, 355], 191: [2, 355], 192: [2, 355], 193: [2, 355], 194: [1, 109], 195: [2, 355], 196: [2, 355] }, { 1: [2, 356], 6: [2, 356], 31: [2, 356], 36: [2, 356], 38: [2, 356], 52: [2, 356], 59: [2, 356], 72: [2, 356], 76: [2, 356], 78: [2, 356], 92: [2, 356], 96: [2, 356], 114: [2, 356], 117: [2, 356], 118: [2, 356], 143: [2, 356], 154: [2, 356], 155: 114, 156: [2, 356], 157: [2, 356], 161: [2, 356], 174: [2, 356], 175: [1, 113], 180: [2, 356], 181: [2, 356], 184: [1, 97], 185: [2, 356], 186: [2, 356], 187: [2, 356], 188: [2, 356], 189: [2, 356], 190: [2, 356], 191: [2, 356], 192: [2, 356], 193: [2, 356], 194: [1, 109], 195: [2, 356], 196: [2, 356] }, { 37: 317, 113: [1, 88] }, { 1: [2, 358], 6: [2, 358], 29: [2, 151], 31: [2, 358], 36: [2, 358], 38: [2, 358], 46: [2, 151], 47: [2, 151], 52: [2, 358], 59: [2, 358], 68: [2, 151], 72: [2, 358], 76: [2, 358], 78: [2, 358], 87: [2, 151], 88: [2, 151], 89: [2, 151], 90: [2, 151], 91: [2, 151], 92: [2, 358], 93: [2, 151], 96: [2, 358], 107: [2, 151], 114: [2, 358], 117: [2, 358], 118: [2, 358], 135: [2, 151], 136: [2, 151], 143: [2, 358], 154: [2, 358], 156: [2, 358], 157: [2, 358], 161: [2, 358], 174: [2, 358], 175: [2, 358], 180: [2, 358], 181: [2, 358], 184: [2, 358], 185: [2, 358], 186: [2, 358], 187: [2, 358], 188: [2, 358], 189: [2, 358], 190: [2, 358], 191: [2, 358], 192: [2, 358], 193: [2, 358], 194: [2, 358], 195: [2, 358], 196: [2, 358] }, { 29: [2, 231], 46: [2, 231], 47: [2, 231], 84: 119, 87: [1, 121], 88: [1, 122], 89: [1, 123], 90: [1, 124], 91: [1, 125], 93: [1, 126], 107: [1, 127], 135: [1, 120], 136: [1, 128] }, { 87: [1, 129], 88: [1, 130], 89: [1, 131], 90: [1, 132], 91: [1, 133], 93: [1, 134] }, { 1: [2, 154], 6: [2, 154], 29: [2, 154], 31: [2, 154], 36: [2, 154], 38: [2, 154], 46: [2, 154], 47: [2, 154], 52: [2, 154], 59: [2, 154], 72: [2, 154], 76: [2, 154], 78: [2, 154], 87: [2, 154], 88: [2, 154], 89: [2, 154], 90: [2, 154], 91: [2, 154], 92: [2, 154], 93: [2, 154], 96: [2, 154], 107: [2, 154], 114: [2, 154], 117: [2, 154], 118: [2, 154], 135: [2, 154], 136: [2, 154], 143: [2, 154], 154: [2, 154], 156: [2, 154], 157: [2, 154], 161: [2, 154], 174: [2, 154], 175: [2, 154], 180: [2, 154], 181: [2, 154], 184: [2, 154], 185: [2, 154], 186: [2, 154], 187: [2, 154], 188: [2, 154], 189: [2, 154], 190: [2, 154], 191: [2, 154], 192: [2, 154], 193: [2, 154], 194: [2, 154], 195: [2, 154], 196: [2, 154] }, { 1: [2, 359], 6: [2, 359], 29: [2, 151], 31: [2, 359], 36: [2, 359], 38: [2, 359], 46: [2, 151], 47: [2, 151], 52: [2, 359], 59: [2, 359], 68: [2, 151], 72: [2, 359], 76: [2, 359], 78: [2, 359], 87: [2, 151], 88: [2, 151], 89: [2, 151], 90: [2, 151], 91: [2, 151], 92: [2, 359], 93: [2, 151], 96: [2, 359], 107: [2, 151], 114: [2, 359], 117: [2, 359], 118: [2, 359], 135: [2, 151], 136: [2, 151], 143: [2, 359], 154: [2, 359], 156: [2, 359], 157: [2, 359], 161: [2, 359], 174: [2, 359], 175: [2, 359], 180: [2, 359], 181: [2, 359], 184: [2, 359], 185: [2, 359], 186: [2, 359], 187: [2, 359], 188: [2, 359], 189: [2, 359], 190: [2, 359], 191: [2, 359], 192: [2, 359], 193: [2, 359], 194: [2, 359], 195: [2, 359], 196: [2, 359] }, { 1: [2, 360], 6: [2, 360], 31: [2, 360], 36: [2, 360], 38: [2, 360], 52: [2, 360], 59: [2, 360], 72: [2, 360], 76: [2, 360], 78: [2, 360], 92: [2, 360], 96: [2, 360], 114: [2, 360], 117: [2, 360], 118: [2, 360], 143: [2, 360], 154: [2, 360], 156: [2, 360], 157: [2, 360], 161: [2, 360], 174: [2, 360], 175: [2, 360], 180: [2, 360], 181: [2, 360], 184: [2, 360], 185: [2, 360], 186: [2, 360], 187: [2, 360], 188: [2, 360], 189: [2, 360], 190: [2, 360], 191: [2, 360], 192: [2, 360], 193: [2, 360], 194: [2, 360], 195: [2, 360], 196: [2, 360] }, { 1: [2, 361], 6: [2, 361], 31: [2, 361], 36: [2, 361], 38: [2, 361], 52: [2, 361], 59: [2, 361], 72: [2, 361], 76: [2, 361], 78: [2, 361], 92: [2, 361], 96: [2, 361], 114: [2, 361], 117: [2, 361], 118: [2, 361], 143: [2, 361], 154: [2, 361], 156: [2, 361], 157: [2, 361], 161: [2, 361], 174: [2, 361], 175: [2, 361], 180: [2, 361], 181: [2, 361], 184: [2, 361], 185: [2, 361], 186: [2, 361], 187: [2, 361], 188: [2, 361], 189: [2, 361], 190: [2, 361], 191: [2, 361], 192: [2, 361], 193: [2, 361], 194: [2, 361], 195: [2, 361], 196: [2, 361] }, { 6: [1, 320], 7: 318, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 36: [1, 319], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 32: 321, 36: [1, 148], 171: [1, 322] }, { 1: [2, 272], 6: [2, 272], 31: [2, 272], 36: [2, 272], 38: [2, 272], 52: [2, 272], 59: [2, 272], 72: [2, 272], 76: [2, 272], 78: [2, 272], 92: [2, 272], 96: [2, 272], 114: [2, 272], 117: [2, 272], 118: [2, 272], 143: [2, 272], 149: 323, 150: [1, 324], 151: [1, 325], 154: [2, 272], 156: [2, 272], 157: [2, 272], 161: [2, 272], 174: [2, 272], 175: [2, 272], 180: [2, 272], 181: [2, 272], 184: [2, 272], 185: [2, 272], 186: [2, 272], 187: [2, 272], 188: [2, 272], 189: [2, 272], 190: [2, 272], 191: [2, 272], 192: [2, 272], 193: [2, 272], 194: [2, 272], 195: [2, 272], 196: [2, 272] }, { 1: [2, 287], 6: [2, 287], 31: [2, 287], 36: [2, 287], 38: [2, 287], 52: [2, 287], 59: [2, 287], 72: [2, 287], 76: [2, 287], 78: [2, 287], 92: [2, 287], 96: [2, 287], 114: [2, 287], 117: [2, 287], 118: [2, 287], 143: [2, 287], 154: [2, 287], 156: [2, 287], 157: [2, 287], 161: [2, 287], 174: [2, 287], 175: [2, 287], 180: [2, 287], 181: [2, 287], 184: [2, 287], 185: [2, 287], 186: [2, 287], 187: [2, 287], 188: [2, 287], 189: [2, 287], 190: [2, 287], 191: [2, 287], 192: [2, 287], 193: [2, 287], 194: [2, 287], 195: [2, 287], 196: [2, 287] }, { 116: [1, 327], 160: [1, 326], 162: [1, 328] }, { 28: 180, 37: 183, 40: [1, 93], 74: 181, 75: [1, 145], 77: [1, 144], 103: 182, 113: [1, 88], 115: 329, 164: 179 }, { 28: 180, 37: 183, 40: [1, 93], 74: 181, 75: [1, 145], 77: [1, 144], 103: 182, 113: [1, 88], 115: 330, 164: 179 }, { 32: 331, 36: [1, 148], 161: [1, 332] }, { 59: [1, 333], 116: [2, 327], 160: [2, 327], 162: [2, 327] }, { 59: [2, 323], 116: [2, 323], 160: [2, 323], 162: [2, 323] }, { 59: [2, 324], 116: [2, 324], 160: [2, 324], 162: [2, 324] }, { 59: [2, 325], 116: [2, 325], 160: [2, 325], 162: [2, 325] }, { 59: [2, 326], 116: [2, 326], 160: [2, 326], 162: [2, 326] }, { 36: [1, 334], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 166: 335, 168: 336, 169: [1, 337] }, { 1: [2, 179], 6: [2, 179], 31: [2, 179], 36: [2, 179], 38: [2, 179], 52: [2, 179], 59: [2, 179], 72: [2, 179], 76: [2, 179], 78: [2, 179], 92: [2, 179], 96: [2, 179], 114: [2, 179], 117: [2, 179], 118: [2, 179], 143: [2, 179], 154: [2, 179], 156: [2, 179], 157: [2, 179], 161: [2, 179], 174: [2, 179], 175: [2, 179], 180: [2, 179], 181: [2, 179], 184: [2, 179], 185: [2, 179], 186: [2, 179], 187: [2, 179], 188: [2, 179], 189: [2, 179], 190: [2, 179], 191: [2, 179], 192: [2, 179], 193: [2, 179], 194: [2, 179], 195: [2, 179], 196: [2, 179] }, { 7: 338, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 182], 6: [2, 182], 29: [2, 151], 31: [2, 182], 32: 339, 36: [1, 148], 38: [2, 182], 46: [2, 151], 47: [2, 151], 52: [2, 182], 59: [2, 182], 68: [2, 151], 72: [2, 182], 76: [2, 182], 78: [2, 182], 87: [2, 151], 88: [2, 151], 89: [2, 151], 90: [2, 151], 91: [2, 151], 92: [2, 182], 93: [2, 151], 96: [2, 182], 107: [2, 151], 114: [2, 182], 117: [2, 182], 118: [2, 182], 122: [1, 340], 135: [2, 151], 136: [2, 151], 143: [2, 182], 154: [2, 182], 156: [2, 182], 157: [2, 182], 161: [2, 182], 174: [2, 182], 175: [2, 182], 180: [2, 182], 181: [2, 182], 184: [2, 182], 185: [2, 182], 186: [2, 182], 187: [2, 182], 188: [2, 182], 189: [2, 182], 190: [2, 182], 191: [2, 182], 192: [2, 182], 193: [2, 182], 194: [2, 182], 195: [2, 182], 196: [2, 182] }, { 1: [2, 279], 6: [2, 279], 31: [2, 279], 36: [2, 279], 38: [2, 279], 52: [2, 279], 59: [2, 279], 72: [2, 279], 76: [2, 279], 78: [2, 279], 92: [2, 279], 96: [2, 279], 114: [2, 279], 117: [2, 279], 118: [2, 279], 143: [2, 279], 154: [2, 279], 155: 114, 156: [2, 279], 157: [2, 279], 161: [2, 279], 174: [2, 279], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 37: 341, 113: [1, 88] }, { 1: [2, 31], 6: [2, 31], 31: [2, 31], 36: [2, 31], 38: [2, 31], 52: [2, 31], 59: [2, 31], 72: [2, 31], 76: [2, 31], 78: [2, 31], 92: [2, 31], 96: [2, 31], 114: [2, 31], 117: [2, 31], 118: [2, 31], 143: [2, 31], 154: [2, 31], 155: 114, 156: [2, 31], 157: [2, 31], 161: [2, 31], 174: [2, 31], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 37: 342, 113: [1, 88] }, { 7: 343, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 29: [1, 344], 32: 345, 36: [1, 148] }, { 1: [2, 350], 6: [2, 350], 31: [2, 350], 36: [2, 350], 38: [2, 350], 52: [2, 350], 59: [2, 350], 76: [2, 350], 154: [2, 350] }, { 1: [2, 380], 6: [2, 380], 29: [2, 380], 31: [2, 380], 36: [2, 380], 38: [2, 380], 46: [2, 380], 47: [2, 380], 52: [2, 380], 59: [2, 380], 72: [2, 380], 76: [2, 380], 78: [2, 380], 87: [2, 380], 88: [2, 380], 89: [2, 380], 90: [2, 380], 91: [2, 380], 92: [2, 380], 93: [2, 380], 96: [2, 380], 107: [2, 380], 114: [2, 380], 117: [2, 380], 118: [2, 380], 135: [2, 380], 136: [2, 380], 143: [2, 380], 154: [2, 380], 156: [2, 380], 157: [2, 380], 161: [2, 380], 174: [2, 380], 175: [2, 380], 180: [2, 380], 181: [2, 380], 184: [2, 380], 185: [2, 380], 186: [2, 380], 187: [2, 380], 188: [2, 380], 189: [2, 380], 190: [2, 380], 191: [2, 380], 192: [2, 380], 193: [2, 380], 194: [2, 380], 195: [2, 380], 196: [2, 380] }, { 1: [2, 97], 6: [2, 97], 31: [2, 97], 36: [2, 97], 38: [2, 97], 52: [2, 97], 59: [2, 97], 76: [2, 97], 114: [1, 115], 154: [2, 97], 155: 114, 156: [2, 97], 157: [2, 97], 174: [2, 97], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 37: 346, 113: [1, 88] }, { 1: [2, 186], 6: [2, 186], 31: [2, 186], 36: [2, 186], 38: [2, 186], 52: [2, 186], 59: [2, 186], 76: [2, 186], 154: [2, 186], 156: [2, 186], 157: [2, 186], 174: [2, 186], 175: [2, 186] }, { 39: [1, 347], 59: [1, 348] }, { 39: [1, 349] }, { 28: 354, 36: [1, 353], 40: [1, 93], 117: [1, 350], 126: 351, 127: 352, 129: [1, 355] }, { 39: [2, 202], 59: [2, 202] }, { 128: [1, 356] }, { 28: 361, 36: [1, 360], 40: [1, 93], 117: [1, 357], 129: [1, 362], 132: 358, 134: 359 }, { 1: [2, 206], 6: [2, 206], 31: [2, 206], 36: [2, 206], 38: [2, 206], 52: [2, 206], 59: [2, 206], 76: [2, 206], 154: [2, 206], 156: [2, 206], 157: [2, 206], 174: [2, 206], 175: [2, 206] }, { 1: [2, 207], 6: [2, 207], 31: [2, 207], 36: [2, 207], 38: [2, 207], 52: [2, 207], 59: [2, 207], 76: [2, 207], 154: [2, 207], 156: [2, 207], 157: [2, 207], 174: [2, 207], 175: [2, 207] }, { 68: [1, 363] }, { 7: 364, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 36: [1, 365], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 39: [1, 366] }, { 6: [1, 96], 154: [1, 367] }, { 4: 368, 5: 3, 7: 4, 8: 5, 9: 6, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 33: 20, 34: 21, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 6: [2, 253], 31: [2, 253], 36: [2, 253], 38: [2, 253], 59: [2, 253], 76: [2, 253], 78: [1, 295], 114: [1, 115], 142: 369, 143: [1, 294], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 238], 6: [2, 238], 29: [2, 238], 31: [2, 238], 36: [2, 238], 38: [2, 238], 46: [2, 238], 47: [2, 238], 52: [2, 238], 59: [2, 238], 68: [2, 238], 72: [2, 238], 76: [2, 238], 78: [2, 238], 87: [2, 238], 88: [2, 238], 89: [2, 238], 90: [2, 238], 91: [2, 238], 92: [2, 238], 93: [2, 238], 96: [2, 238], 107: [2, 238], 114: [2, 238], 116: [2, 238], 117: [2, 238], 118: [2, 238], 135: [2, 238], 136: [2, 238], 143: [2, 238], 154: [2, 238], 156: [2, 238], 157: [2, 238], 160: [2, 238], 161: [2, 238], 162: [2, 238], 174: [2, 238], 175: [2, 238], 180: [2, 238], 181: [2, 238], 184: [2, 238], 185: [2, 238], 186: [2, 238], 187: [2, 238], 188: [2, 238], 189: [2, 238], 190: [2, 238], 191: [2, 238], 192: [2, 238], 193: [2, 238], 194: [2, 238], 195: [2, 238], 196: [2, 238] }, { 7: 313, 8: 222, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 33: 20, 34: 21, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 59: [1, 220], 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 76: [1, 370], 77: [1, 76], 78: [1, 224], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 104: 223, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 144: 372, 146: 371, 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 6: [2, 106], 31: [2, 106], 36: [2, 106], 38: [2, 106], 59: [1, 374], 76: [2, 106], 100: 375, 117: [2, 106], 141: 373 }, { 6: [1, 376], 11: [2, 266], 27: [2, 266], 35: [2, 266], 36: [2, 266], 38: [2, 266], 40: [2, 266], 44: [2, 266], 46: [2, 266], 47: [2, 266], 54: [2, 266], 55: [2, 266], 59: [2, 266], 61: [2, 266], 62: [2, 266], 63: [2, 266], 64: [2, 266], 65: [2, 266], 66: [2, 266], 75: [2, 266], 76: [2, 266], 77: [2, 266], 78: [2, 266], 83: [2, 266], 86: [2, 266], 94: [2, 266], 95: [2, 266], 98: [2, 266], 99: [2, 266], 111: [2, 266], 112: [2, 266], 113: [2, 266], 114: [2, 266], 121: [2, 266], 123: [2, 266], 131: [2, 266], 138: [2, 266], 148: [2, 266], 152: [2, 266], 153: [2, 266], 156: [2, 266], 157: [2, 266], 159: [2, 266], 163: [2, 266], 165: [2, 266], 171: [2, 266], 173: [2, 266], 176: [2, 266], 177: [2, 266], 178: [2, 266], 179: [2, 266], 180: [2, 266], 181: [2, 266], 182: [2, 266], 183: [2, 266] }, { 6: [2, 257], 36: [2, 257], 38: [2, 257], 59: [2, 257], 76: [2, 257] }, { 7: 313, 8: 222, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 33: 20, 34: 21, 35: [1, 55], 36: [1, 219], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 59: [1, 220], 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 78: [1, 224], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 104: 223, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 139: 378, 140: 377, 144: 221, 145: 218, 146: 217, 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 6: [2, 268], 11: [2, 268], 27: [2, 268], 35: [2, 268], 36: [2, 268], 38: [2, 268], 40: [2, 268], 44: [2, 268], 46: [2, 268], 47: [2, 268], 54: [2, 268], 55: [2, 268], 59: [2, 268], 61: [2, 268], 62: [2, 268], 63: [2, 268], 64: [2, 268], 65: [2, 268], 66: [2, 268], 75: [2, 268], 76: [2, 268], 77: [2, 268], 78: [2, 268], 83: [2, 268], 86: [2, 268], 94: [2, 268], 95: [2, 268], 98: [2, 268], 99: [2, 268], 111: [2, 268], 112: [2, 268], 113: [2, 268], 114: [2, 268], 121: [2, 268], 123: [2, 268], 131: [2, 268], 138: [2, 268], 148: [2, 268], 152: [2, 268], 153: [2, 268], 156: [2, 268], 157: [2, 268], 159: [2, 268], 163: [2, 268], 165: [2, 268], 171: [2, 268], 173: [2, 268], 176: [2, 268], 177: [2, 268], 178: [2, 268], 179: [2, 268], 180: [2, 268], 181: [2, 268], 182: [2, 268], 183: [2, 268] }, { 6: [2, 262], 36: [2, 262], 38: [2, 262], 59: [2, 262], 76: [2, 262] }, { 6: [2, 254], 31: [2, 254], 36: [2, 254], 38: [2, 254], 59: [2, 254], 76: [2, 254] }, { 6: [2, 255], 31: [2, 255], 36: [2, 255], 38: [2, 255], 59: [2, 255], 76: [2, 255] }, { 6: [2, 256], 7: 379, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 31: [2, 256], 35: [1, 55], 36: [2, 256], 37: 62, 38: [2, 256], 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 59: [2, 256], 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 76: [2, 256], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 29: [1, 229], 85: 380 }, { 41: 381, 42: [1, 231] }, { 7: 382, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 36: [1, 383], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 230], 6: [2, 230], 29: [2, 230], 31: [2, 230], 36: [2, 230], 38: [2, 230], 46: [2, 230], 47: [2, 230], 52: [2, 230], 57: [2, 230], 59: [2, 230], 72: [2, 230], 76: [2, 230], 78: [2, 230], 87: [2, 230], 88: [2, 230], 89: [2, 230], 90: [2, 230], 91: [2, 230], 92: [2, 230], 93: [2, 230], 96: [2, 230], 107: [2, 230], 114: [2, 230], 117: [2, 230], 118: [2, 230], 135: [2, 230], 136: [2, 230], 143: [2, 230], 154: [2, 230], 156: [2, 230], 157: [2, 230], 161: [2, 230], 174: [2, 230], 175: [2, 230], 180: [2, 230], 181: [2, 230], 184: [2, 230], 185: [2, 230], 186: [2, 230], 187: [2, 230], 188: [2, 230], 189: [2, 230], 190: [2, 230], 191: [2, 230], 192: [2, 230], 193: [2, 230], 194: [2, 230], 195: [2, 230], 196: [2, 230] }, { 7: 313, 8: 222, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 31: [1, 384], 33: 20, 34: 21, 35: [1, 55], 36: [1, 387], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 78: [1, 224], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 104: 223, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 137: 385, 138: [1, 75], 144: 386, 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 237], 6: [2, 237], 29: [2, 237], 31: [2, 237], 36: [2, 237], 38: [2, 237], 46: [2, 237], 47: [2, 237], 52: [2, 237], 59: [2, 237], 68: [2, 237], 72: [2, 237], 76: [2, 237], 78: [2, 237], 87: [2, 237], 88: [2, 237], 89: [2, 237], 90: [2, 237], 91: [2, 237], 92: [2, 237], 93: [2, 237], 96: [2, 237], 107: [2, 237], 114: [2, 237], 116: [2, 237], 117: [2, 237], 118: [2, 237], 122: [2, 237], 135: [2, 237], 136: [2, 237], 143: [2, 237], 154: [2, 237], 156: [2, 237], 157: [2, 237], 160: [2, 237], 161: [2, 237], 162: [2, 237], 174: [2, 237], 175: [2, 237], 180: [2, 237], 181: [2, 237], 182: [2, 237], 183: [2, 237], 184: [2, 237], 185: [2, 237], 186: [2, 237], 187: [2, 237], 188: [2, 237], 189: [2, 237], 190: [2, 237], 191: [2, 237], 192: [2, 237], 193: [2, 237], 194: [2, 237], 195: [2, 237], 196: [2, 237], 197: [2, 237] }, { 1: [2, 37], 6: [2, 37], 29: [2, 37], 31: [2, 37], 36: [2, 37], 38: [2, 37], 46: [2, 37], 47: [2, 37], 52: [2, 37], 59: [2, 37], 68: [2, 37], 72: [2, 37], 76: [2, 37], 78: [2, 37], 87: [2, 37], 88: [2, 37], 89: [2, 37], 90: [2, 37], 91: [2, 37], 92: [2, 37], 93: [2, 37], 96: [2, 37], 107: [2, 37], 114: [2, 37], 116: [2, 37], 117: [2, 37], 118: [2, 37], 122: [2, 37], 135: [2, 37], 136: [2, 37], 143: [2, 37], 154: [2, 37], 156: [2, 37], 157: [2, 37], 160: [2, 37], 161: [2, 37], 162: [2, 37], 174: [2, 37], 175: [2, 37], 180: [2, 37], 181: [2, 37], 182: [2, 37], 183: [2, 37], 184: [2, 37], 185: [2, 37], 186: [2, 37], 187: [2, 37], 188: [2, 37], 189: [2, 37], 190: [2, 37], 191: [2, 37], 192: [2, 37], 193: [2, 37], 194: [2, 37], 195: [2, 37], 196: [2, 37], 197: [2, 37] }, { 41: 388, 42: [1, 231] }, { 41: 389, 42: [1, 231] }, { 32: 390, 36: [1, 148], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 32: 391, 36: [1, 148], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 283], 6: [2, 283], 31: [2, 283], 36: [2, 283], 38: [2, 283], 52: [2, 283], 59: [2, 283], 72: [2, 283], 76: [2, 283], 78: [2, 283], 92: [2, 283], 96: [2, 283], 114: [1, 115], 117: [2, 283], 118: [1, 392], 143: [2, 283], 154: [2, 283], 155: 114, 156: [1, 85], 157: [1, 86], 161: [2, 283], 174: [2, 283], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 285], 6: [2, 285], 31: [2, 285], 36: [2, 285], 38: [2, 285], 52: [2, 285], 59: [2, 285], 72: [2, 285], 76: [2, 285], 78: [2, 285], 92: [2, 285], 96: [2, 285], 114: [1, 115], 117: [2, 285], 118: [1, 393], 143: [2, 285], 154: [2, 285], 155: 114, 156: [1, 85], 157: [1, 86], 161: [2, 285], 174: [2, 285], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 291], 6: [2, 291], 31: [2, 291], 36: [2, 291], 38: [2, 291], 52: [2, 291], 59: [2, 291], 72: [2, 291], 76: [2, 291], 78: [2, 291], 92: [2, 291], 96: [2, 291], 114: [2, 291], 117: [2, 291], 118: [2, 291], 143: [2, 291], 154: [2, 291], 156: [2, 291], 157: [2, 291], 161: [2, 291], 174: [2, 291], 175: [2, 291], 180: [2, 291], 181: [2, 291], 184: [2, 291], 185: [2, 291], 186: [2, 291], 187: [2, 291], 188: [2, 291], 189: [2, 291], 190: [2, 291], 191: [2, 291], 192: [2, 291], 193: [2, 291], 194: [2, 291], 195: [2, 291], 196: [2, 291] }, { 1: [2, 292], 6: [2, 292], 31: [2, 292], 36: [2, 292], 38: [2, 292], 52: [2, 292], 59: [2, 292], 72: [2, 292], 76: [2, 292], 78: [2, 292], 92: [2, 292], 96: [2, 292], 114: [1, 115], 117: [2, 292], 118: [2, 292], 143: [2, 292], 154: [2, 292], 155: 114, 156: [1, 85], 157: [1, 86], 161: [2, 292], 174: [2, 292], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 6: [2, 63], 36: [2, 63], 38: [2, 63], 59: [2, 63], 72: [1, 394], 117: [2, 63] }, { 6: [2, 106], 31: [2, 106], 36: [2, 106], 38: [2, 106], 59: [1, 396], 76: [2, 106], 100: 395, 117: [2, 106] }, { 6: [2, 72], 36: [2, 72], 38: [2, 72], 59: [2, 72], 68: [1, 397], 72: [2, 72], 117: [2, 72] }, { 7: 398, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 41: 230, 42: [1, 231], 75: [1, 399] }, { 6: [2, 75], 36: [2, 75], 38: [2, 75], 59: [2, 75], 72: [2, 75], 117: [2, 75] }, { 6: [2, 174], 36: [2, 174], 38: [2, 174], 59: [2, 174], 117: [2, 174] }, { 6: [2, 69], 29: [2, 69], 36: [2, 69], 38: [2, 69], 59: [2, 69], 68: [2, 69], 72: [2, 69], 87: [2, 69], 88: [2, 69], 89: [2, 69], 90: [2, 69], 91: [2, 69], 93: [2, 69], 117: [2, 69], 136: [2, 69] }, { 6: [2, 70], 29: [2, 70], 36: [2, 70], 38: [2, 70], 59: [2, 70], 68: [2, 70], 72: [2, 70], 87: [2, 70], 88: [2, 70], 89: [2, 70], 90: [2, 70], 91: [2, 70], 93: [2, 70], 117: [2, 70], 136: [2, 70] }, { 6: [2, 71], 29: [2, 71], 36: [2, 71], 38: [2, 71], 59: [2, 71], 68: [2, 71], 72: [2, 71], 87: [2, 71], 88: [2, 71], 89: [2, 71], 90: [2, 71], 91: [2, 71], 93: [2, 71], 117: [2, 71], 136: [2, 71] }, { 6: [2, 64], 36: [2, 64], 38: [2, 64], 59: [2, 64], 117: [2, 64] }, { 28: 247, 37: 402, 40: [1, 93], 41: 248, 42: [1, 231], 73: 400, 74: 249, 77: [1, 76], 79: 401, 80: 403, 81: 404, 82: 405, 83: [1, 406], 86: [1, 407], 113: [1, 88], 138: [1, 75], 153: [1, 71] }, { 1: [2, 158], 6: [2, 158], 29: [2, 158], 31: [2, 158], 36: [2, 158], 38: [2, 158], 46: [2, 158], 47: [2, 158], 52: [2, 158], 57: [1, 408], 59: [2, 158], 72: [2, 158], 76: [2, 158], 78: [2, 158], 87: [2, 158], 88: [2, 158], 89: [2, 158], 90: [2, 158], 91: [2, 158], 92: [2, 158], 93: [2, 158], 96: [2, 158], 107: [2, 158], 114: [2, 158], 117: [2, 158], 118: [2, 158], 135: [2, 158], 136: [2, 158], 143: [2, 158], 154: [2, 158], 156: [2, 158], 157: [2, 158], 161: [2, 158], 174: [2, 158], 175: [2, 158], 180: [2, 158], 181: [2, 158], 184: [2, 158], 185: [2, 158], 186: [2, 158], 187: [2, 158], 188: [2, 158], 189: [2, 158], 190: [2, 158], 191: [2, 158], 192: [2, 158], 193: [2, 158], 194: [2, 158], 195: [2, 158], 196: [2, 158] }, { 1: [2, 151], 6: [2, 151], 29: [2, 151], 31: [2, 151], 36: [2, 151], 38: [2, 151], 46: [2, 151], 47: [2, 151], 52: [2, 151], 59: [2, 151], 68: [2, 151], 72: [2, 151], 76: [2, 151], 78: [2, 151], 87: [2, 151], 88: [2, 151], 89: [2, 151], 90: [2, 151], 91: [2, 151], 92: [2, 151], 93: [2, 151], 96: [2, 151], 107: [2, 151], 114: [2, 151], 117: [2, 151], 118: [2, 151], 135: [2, 151], 136: [2, 151], 143: [2, 151], 154: [2, 151], 156: [2, 151], 157: [2, 151], 161: [2, 151], 174: [2, 151], 175: [2, 151], 180: [2, 151], 181: [2, 151], 184: [2, 151], 185: [2, 151], 186: [2, 151], 187: [2, 151], 188: [2, 151], 189: [2, 151], 190: [2, 151], 191: [2, 151], 192: [2, 151], 193: [2, 151], 194: [2, 151], 195: [2, 151], 196: [2, 151] }, { 45: 257, 46: [1, 94], 47: [1, 95], 49: [1, 409], 50: 410, 51: [1, 256] }, { 46: [2, 42], 47: [2, 42], 49: [2, 42], 51: [2, 42] }, { 4: 411, 5: 3, 7: 4, 8: 5, 9: 6, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 33: 20, 34: 21, 35: [1, 55], 36: [1, 412], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 52: [1, 413], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 46: [2, 47], 47: [2, 47], 49: [2, 47], 51: [2, 47] }, { 1: [2, 4], 6: [2, 4], 38: [2, 4], 52: [2, 4], 154: [2, 4] }, { 1: [2, 363], 6: [2, 363], 31: [2, 363], 36: [2, 363], 38: [2, 363], 52: [2, 363], 59: [2, 363], 72: [2, 363], 76: [2, 363], 78: [2, 363], 92: [2, 363], 96: [2, 363], 114: [2, 363], 117: [2, 363], 118: [2, 363], 143: [2, 363], 154: [2, 363], 155: 114, 156: [2, 363], 157: [2, 363], 161: [2, 363], 174: [2, 363], 175: [1, 113], 180: [2, 363], 181: [2, 363], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [2, 363], 188: [2, 363], 189: [2, 363], 190: [2, 363], 191: [2, 363], 192: [2, 363], 193: [2, 363], 194: [1, 109], 195: [2, 363], 196: [2, 363] }, { 1: [2, 364], 6: [2, 364], 31: [2, 364], 36: [2, 364], 38: [2, 364], 52: [2, 364], 59: [2, 364], 72: [2, 364], 76: [2, 364], 78: [2, 364], 92: [2, 364], 96: [2, 364], 114: [2, 364], 117: [2, 364], 118: [2, 364], 143: [2, 364], 154: [2, 364], 155: 114, 156: [2, 364], 157: [2, 364], 161: [2, 364], 174: [2, 364], 175: [1, 113], 180: [2, 364], 181: [2, 364], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [2, 364], 188: [2, 364], 189: [2, 364], 190: [2, 364], 191: [2, 364], 192: [2, 364], 193: [2, 364], 194: [1, 109], 195: [2, 364], 196: [2, 364] }, { 1: [2, 365], 6: [2, 365], 31: [2, 365], 36: [2, 365], 38: [2, 365], 52: [2, 365], 59: [2, 365], 72: [2, 365], 76: [2, 365], 78: [2, 365], 92: [2, 365], 96: [2, 365], 114: [2, 365], 117: [2, 365], 118: [2, 365], 143: [2, 365], 154: [2, 365], 155: 114, 156: [2, 365], 157: [2, 365], 161: [2, 365], 174: [2, 365], 175: [1, 113], 180: [2, 365], 181: [2, 365], 184: [1, 97], 185: [2, 365], 186: [1, 101], 187: [2, 365], 188: [2, 365], 189: [2, 365], 190: [2, 365], 191: [2, 365], 192: [2, 365], 193: [2, 365], 194: [1, 109], 195: [2, 365], 196: [2, 365] }, { 1: [2, 366], 6: [2, 366], 31: [2, 366], 36: [2, 366], 38: [2, 366], 52: [2, 366], 59: [2, 366], 72: [2, 366], 76: [2, 366], 78: [2, 366], 92: [2, 366], 96: [2, 366], 114: [2, 366], 117: [2, 366], 118: [2, 366], 143: [2, 366], 154: [2, 366], 155: 114, 156: [2, 366], 157: [2, 366], 161: [2, 366], 174: [2, 366], 175: [1, 113], 180: [2, 366], 181: [2, 366], 184: [1, 97], 185: [2, 366], 186: [1, 101], 187: [2, 366], 188: [2, 366], 189: [2, 366], 190: [2, 366], 191: [2, 366], 192: [2, 366], 193: [2, 366], 194: [1, 109], 195: [2, 366], 196: [2, 366] }, { 1: [2, 367], 6: [2, 367], 31: [2, 367], 36: [2, 367], 38: [2, 367], 52: [2, 367], 59: [2, 367], 72: [2, 367], 76: [2, 367], 78: [2, 367], 92: [2, 367], 96: [2, 367], 114: [2, 367], 117: [2, 367], 118: [2, 367], 143: [2, 367], 154: [2, 367], 155: 114, 156: [2, 367], 157: [2, 367], 161: [2, 367], 174: [2, 367], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [2, 367], 188: [2, 367], 189: [2, 367], 190: [2, 367], 191: [2, 367], 192: [2, 367], 193: [2, 367], 194: [1, 109], 195: [2, 367], 196: [2, 367] }, { 1: [2, 368], 6: [2, 368], 31: [2, 368], 36: [2, 368], 38: [2, 368], 52: [2, 368], 59: [2, 368], 72: [2, 368], 76: [2, 368], 78: [2, 368], 92: [2, 368], 96: [2, 368], 114: [2, 368], 117: [2, 368], 118: [2, 368], 143: [2, 368], 154: [2, 368], 155: 114, 156: [2, 368], 157: [2, 368], 161: [2, 368], 174: [2, 368], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [2, 368], 189: [2, 368], 190: [2, 368], 191: [2, 368], 192: [2, 368], 193: [2, 368], 194: [1, 109], 195: [1, 110], 196: [2, 368] }, { 1: [2, 369], 6: [2, 369], 31: [2, 369], 36: [2, 369], 38: [2, 369], 52: [2, 369], 59: [2, 369], 72: [2, 369], 76: [2, 369], 78: [2, 369], 92: [2, 369], 96: [2, 369], 114: [2, 369], 117: [2, 369], 118: [2, 369], 143: [2, 369], 154: [2, 369], 155: 114, 156: [2, 369], 157: [2, 369], 161: [2, 369], 174: [2, 369], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [2, 369], 190: [2, 369], 191: [2, 369], 192: [2, 369], 193: [2, 369], 194: [1, 109], 195: [1, 110], 196: [2, 369] }, { 1: [2, 370], 6: [2, 370], 31: [2, 370], 36: [2, 370], 38: [2, 370], 52: [2, 370], 59: [2, 370], 72: [2, 370], 76: [2, 370], 78: [2, 370], 92: [2, 370], 96: [2, 370], 114: [2, 370], 117: [2, 370], 118: [2, 370], 143: [2, 370], 154: [2, 370], 155: 114, 156: [2, 370], 157: [2, 370], 161: [2, 370], 174: [2, 370], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [2, 370], 191: [2, 370], 192: [2, 370], 193: [2, 370], 194: [1, 109], 195: [1, 110], 196: [2, 370] }, { 1: [2, 371], 6: [2, 371], 31: [2, 371], 36: [2, 371], 38: [2, 371], 52: [2, 371], 59: [2, 371], 72: [2, 371], 76: [2, 371], 78: [2, 371], 92: [2, 371], 96: [2, 371], 114: [2, 371], 117: [2, 371], 118: [2, 371], 143: [2, 371], 154: [2, 371], 155: 114, 156: [2, 371], 157: [2, 371], 161: [2, 371], 174: [2, 371], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [2, 371], 192: [2, 371], 193: [2, 371], 194: [1, 109], 195: [1, 110], 196: [2, 371] }, { 1: [2, 372], 6: [2, 372], 31: [2, 372], 36: [2, 372], 38: [2, 372], 52: [2, 372], 59: [2, 372], 72: [2, 372], 76: [2, 372], 78: [2, 372], 92: [2, 372], 96: [2, 372], 114: [2, 372], 117: [2, 372], 118: [2, 372], 143: [2, 372], 154: [2, 372], 155: 114, 156: [2, 372], 157: [2, 372], 161: [2, 372], 174: [2, 372], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [2, 372], 193: [2, 372], 194: [1, 109], 195: [1, 110], 196: [2, 372] }, { 1: [2, 373], 6: [2, 373], 31: [2, 373], 36: [2, 373], 38: [2, 373], 52: [2, 373], 59: [2, 373], 72: [2, 373], 76: [2, 373], 78: [2, 373], 92: [2, 373], 96: [2, 373], 114: [2, 373], 117: [2, 373], 118: [2, 373], 143: [2, 373], 154: [2, 373], 155: 114, 156: [2, 373], 157: [2, 373], 161: [2, 373], 174: [2, 373], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [2, 373], 194: [1, 109], 195: [1, 110], 196: [2, 373] }, { 1: [2, 374], 6: [2, 374], 31: [2, 374], 36: [2, 374], 38: [2, 374], 52: [2, 374], 59: [2, 374], 72: [2, 374], 76: [2, 374], 78: [2, 374], 92: [2, 374], 96: [2, 374], 114: [1, 115], 117: [2, 374], 118: [2, 374], 143: [2, 374], 154: [2, 374], 155: 114, 156: [1, 85], 157: [1, 86], 161: [2, 374], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 375], 6: [2, 375], 31: [2, 375], 36: [2, 375], 38: [2, 375], 52: [2, 375], 59: [2, 375], 72: [2, 375], 76: [2, 375], 78: [2, 375], 92: [2, 375], 96: [2, 375], 114: [2, 375], 117: [2, 375], 118: [2, 375], 143: [2, 375], 154: [2, 375], 155: 114, 156: [2, 375], 157: [2, 375], 161: [2, 375], 174: [2, 375], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [2, 375], 189: [2, 375], 190: [2, 375], 191: [2, 375], 192: [2, 375], 193: [2, 375], 194: [1, 109], 195: [2, 375], 196: [2, 375] }, { 72: [1, 414], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 345], 6: [2, 345], 31: [2, 345], 36: [2, 345], 38: [2, 345], 52: [2, 345], 59: [2, 345], 72: [2, 345], 76: [2, 345], 78: [2, 345], 92: [2, 345], 96: [2, 345], 114: [1, 115], 117: [2, 345], 118: [2, 345], 143: [2, 345], 154: [2, 345], 155: 114, 156: [1, 85], 157: [1, 86], 161: [2, 345], 174: [2, 345], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 347], 6: [2, 347], 31: [2, 347], 36: [2, 347], 38: [2, 347], 52: [2, 347], 59: [2, 347], 72: [2, 347], 76: [2, 347], 78: [2, 347], 92: [2, 347], 96: [2, 347], 114: [1, 115], 117: [2, 347], 118: [2, 347], 143: [2, 347], 154: [2, 347], 155: 114, 156: [1, 85], 157: [1, 86], 161: [2, 347], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 116: [1, 416], 160: [1, 415], 162: [1, 417] }, { 28: 180, 37: 183, 40: [1, 93], 74: 181, 75: [1, 145], 77: [1, 144], 103: 182, 113: [1, 88], 115: 418, 164: 179 }, { 28: 180, 37: 183, 40: [1, 93], 74: 181, 75: [1, 145], 77: [1, 144], 103: 182, 113: [1, 88], 115: 419, 164: 179 }, { 1: [2, 321], 6: [2, 321], 31: [2, 321], 36: [2, 321], 38: [2, 321], 52: [2, 321], 59: [2, 321], 72: [2, 321], 76: [2, 321], 78: [2, 321], 92: [2, 321], 96: [2, 321], 114: [2, 321], 117: [2, 321], 118: [2, 321], 143: [2, 321], 154: [2, 321], 156: [2, 321], 157: [2, 321], 161: [1, 420], 174: [2, 321], 175: [2, 321], 180: [2, 321], 181: [2, 321], 184: [2, 321], 185: [2, 321], 186: [2, 321], 187: [2, 321], 188: [2, 321], 189: [2, 321], 190: [2, 321], 191: [2, 321], 192: [2, 321], 193: [2, 321], 194: [2, 321], 195: [2, 321], 196: [2, 321] }, { 1: [2, 344], 6: [2, 344], 31: [2, 344], 36: [2, 344], 38: [2, 344], 52: [2, 344], 59: [2, 344], 72: [2, 344], 76: [2, 344], 78: [2, 344], 92: [2, 344], 96: [2, 344], 114: [1, 115], 117: [2, 344], 118: [2, 344], 143: [2, 344], 154: [2, 344], 155: 114, 156: [1, 85], 157: [1, 86], 161: [2, 344], 174: [2, 344], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 346], 6: [2, 346], 31: [2, 346], 36: [2, 346], 38: [2, 346], 52: [2, 346], 59: [2, 346], 72: [2, 346], 76: [2, 346], 78: [2, 346], 92: [2, 346], 96: [2, 346], 114: [1, 115], 117: [2, 346], 118: [2, 346], 143: [2, 346], 154: [2, 346], 155: 114, 156: [1, 85], 157: [1, 86], 161: [2, 346], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 226], 6: [2, 226], 29: [2, 226], 31: [2, 226], 36: [2, 226], 38: [2, 226], 46: [2, 226], 47: [2, 226], 52: [2, 226], 57: [2, 226], 59: [2, 226], 72: [2, 226], 76: [2, 226], 78: [2, 226], 87: [2, 226], 88: [2, 226], 89: [2, 226], 90: [2, 226], 91: [2, 226], 92: [2, 226], 93: [2, 226], 96: [2, 226], 107: [2, 226], 114: [2, 226], 117: [2, 226], 118: [2, 226], 135: [2, 226], 136: [2, 226], 143: [2, 226], 154: [2, 226], 156: [2, 226], 157: [2, 226], 161: [2, 226], 174: [2, 226], 175: [2, 226], 180: [2, 226], 181: [2, 226], 184: [2, 226], 185: [2, 226], 186: [2, 226], 187: [2, 226], 188: [2, 226], 189: [2, 226], 190: [2, 226], 191: [2, 226], 192: [2, 226], 193: [2, 226], 194: [2, 226], 195: [2, 226], 196: [2, 226] }, { 1: [2, 227], 6: [2, 227], 29: [2, 227], 31: [2, 227], 36: [2, 227], 38: [2, 227], 46: [2, 227], 47: [2, 227], 52: [2, 227], 57: [2, 227], 59: [2, 227], 72: [2, 227], 76: [2, 227], 78: [2, 227], 87: [2, 227], 88: [2, 227], 89: [2, 227], 90: [2, 227], 91: [2, 227], 92: [2, 227], 93: [2, 227], 96: [2, 227], 107: [2, 227], 114: [2, 227], 117: [2, 227], 118: [2, 227], 135: [2, 227], 136: [2, 227], 143: [2, 227], 154: [2, 227], 156: [2, 227], 157: [2, 227], 161: [2, 227], 174: [2, 227], 175: [2, 227], 180: [2, 227], 181: [2, 227], 184: [2, 227], 185: [2, 227], 186: [2, 227], 187: [2, 227], 188: [2, 227], 189: [2, 227], 190: [2, 227], 191: [2, 227], 192: [2, 227], 193: [2, 227], 194: [2, 227], 195: [2, 227], 196: [2, 227] }, { 1: [2, 228], 6: [2, 228], 29: [2, 228], 31: [2, 228], 36: [2, 228], 38: [2, 228], 46: [2, 228], 47: [2, 228], 52: [2, 228], 57: [2, 228], 59: [2, 228], 72: [2, 228], 76: [2, 228], 78: [2, 228], 87: [2, 228], 88: [2, 228], 89: [2, 228], 90: [2, 228], 91: [2, 228], 92: [2, 228], 93: [2, 228], 96: [2, 228], 107: [2, 228], 114: [2, 228], 117: [2, 228], 118: [2, 228], 135: [2, 228], 136: [2, 228], 143: [2, 228], 154: [2, 228], 156: [2, 228], 157: [2, 228], 161: [2, 228], 174: [2, 228], 175: [2, 228], 180: [2, 228], 181: [2, 228], 184: [2, 228], 185: [2, 228], 186: [2, 228], 187: [2, 228], 188: [2, 228], 189: [2, 228], 190: [2, 228], 191: [2, 228], 192: [2, 228], 193: [2, 228], 194: [2, 228], 195: [2, 228], 196: [2, 228] }, { 1: [2, 124], 6: [2, 124], 29: [2, 124], 31: [2, 124], 36: [2, 124], 38: [2, 124], 46: [2, 124], 47: [2, 124], 52: [2, 124], 59: [2, 124], 68: [2, 124], 72: [2, 124], 76: [2, 124], 78: [2, 124], 87: [2, 124], 88: [2, 124], 89: [2, 124], 90: [2, 124], 91: [2, 124], 92: [2, 124], 93: [2, 124], 96: [2, 124], 107: [2, 124], 114: [2, 124], 117: [2, 124], 118: [2, 124], 122: [2, 124], 135: [2, 124], 136: [2, 124], 143: [2, 124], 154: [2, 124], 156: [2, 124], 157: [2, 124], 161: [2, 124], 174: [2, 124], 175: [2, 124], 180: [2, 124], 181: [2, 124], 182: [2, 124], 183: [2, 124], 184: [2, 124], 185: [2, 124], 186: [2, 124], 187: [2, 124], 188: [2, 124], 189: [2, 124], 190: [2, 124], 191: [2, 124], 192: [2, 124], 193: [2, 124], 194: [2, 124], 195: [2, 124], 196: [2, 124], 197: [2, 124] }, { 1: [2, 125], 6: [2, 125], 29: [2, 125], 31: [2, 125], 36: [2, 125], 38: [2, 125], 46: [2, 125], 47: [2, 125], 52: [2, 125], 59: [2, 125], 68: [2, 125], 72: [2, 125], 76: [2, 125], 78: [2, 125], 87: [2, 125], 88: [2, 125], 89: [2, 125], 90: [2, 125], 91: [2, 125], 92: [2, 125], 93: [2, 125], 96: [2, 125], 107: [2, 125], 114: [2, 125], 117: [2, 125], 118: [2, 125], 122: [2, 125], 135: [2, 125], 136: [2, 125], 143: [2, 125], 154: [2, 125], 156: [2, 125], 157: [2, 125], 161: [2, 125], 174: [2, 125], 175: [2, 125], 180: [2, 125], 181: [2, 125], 182: [2, 125], 183: [2, 125], 184: [2, 125], 185: [2, 125], 186: [2, 125], 187: [2, 125], 188: [2, 125], 189: [2, 125], 190: [2, 125], 191: [2, 125], 192: [2, 125], 193: [2, 125], 194: [2, 125], 195: [2, 125], 196: [2, 125], 197: [2, 125] }, { 1: [2, 126], 6: [2, 126], 29: [2, 126], 31: [2, 126], 36: [2, 126], 38: [2, 126], 46: [2, 126], 47: [2, 126], 52: [2, 126], 59: [2, 126], 68: [2, 126], 72: [2, 126], 76: [2, 126], 78: [2, 126], 87: [2, 126], 88: [2, 126], 89: [2, 126], 90: [2, 126], 91: [2, 126], 92: [2, 126], 93: [2, 126], 96: [2, 126], 107: [2, 126], 114: [2, 126], 117: [2, 126], 118: [2, 126], 122: [2, 126], 135: [2, 126], 136: [2, 126], 143: [2, 126], 154: [2, 126], 156: [2, 126], 157: [2, 126], 161: [2, 126], 174: [2, 126], 175: [2, 126], 180: [2, 126], 181: [2, 126], 182: [2, 126], 183: [2, 126], 184: [2, 126], 185: [2, 126], 186: [2, 126], 187: [2, 126], 188: [2, 126], 189: [2, 126], 190: [2, 126], 191: [2, 126], 192: [2, 126], 193: [2, 126], 194: [2, 126], 195: [2, 126], 196: [2, 126], 197: [2, 126] }, { 1: [2, 127], 6: [2, 127], 29: [2, 127], 31: [2, 127], 36: [2, 127], 38: [2, 127], 46: [2, 127], 47: [2, 127], 52: [2, 127], 59: [2, 127], 68: [2, 127], 72: [2, 127], 76: [2, 127], 78: [2, 127], 87: [2, 127], 88: [2, 127], 89: [2, 127], 90: [2, 127], 91: [2, 127], 92: [2, 127], 93: [2, 127], 96: [2, 127], 107: [2, 127], 114: [2, 127], 117: [2, 127], 118: [2, 127], 122: [2, 127], 135: [2, 127], 136: [2, 127], 143: [2, 127], 154: [2, 127], 156: [2, 127], 157: [2, 127], 161: [2, 127], 174: [2, 127], 175: [2, 127], 180: [2, 127], 181: [2, 127], 182: [2, 127], 183: [2, 127], 184: [2, 127], 185: [2, 127], 186: [2, 127], 187: [2, 127], 188: [2, 127], 189: [2, 127], 190: [2, 127], 191: [2, 127], 192: [2, 127], 193: [2, 127], 194: [2, 127], 195: [2, 127], 196: [2, 127], 197: [2, 127] }, { 78: [1, 295], 92: [1, 421], 114: [1, 115], 142: 422, 143: [1, 294], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 7: 423, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 78: [1, 295], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 106: 424, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 142: 292, 143: [1, 294], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 92: [1, 425] }, { 92: [1, 426] }, { 7: 427, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 38: [2, 247], 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 92: [2, 247], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 54], 6: [2, 54], 29: [2, 54], 31: [2, 54], 36: [2, 54], 38: [2, 54], 46: [2, 54], 47: [2, 54], 52: [2, 54], 59: [1, 428], 72: [2, 54], 76: [2, 54], 78: [2, 54], 87: [2, 54], 88: [2, 54], 89: [2, 54], 90: [2, 54], 91: [2, 54], 92: [2, 51], 93: [2, 54], 96: [2, 54], 107: [2, 54], 114: [2, 54], 117: [2, 54], 118: [2, 54], 135: [2, 54], 136: [2, 54], 143: [2, 54], 154: [2, 54], 156: [2, 54], 157: [2, 54], 161: [2, 54], 174: [2, 54], 175: [2, 54], 180: [2, 54], 181: [2, 54], 184: [2, 54], 185: [2, 54], 186: [2, 54], 187: [2, 54], 188: [2, 54], 189: [2, 54], 190: [2, 54], 191: [2, 54], 192: [2, 54], 193: [2, 54], 194: [2, 54], 195: [2, 54], 196: [2, 54] }, { 11: [2, 241], 27: [2, 241], 35: [2, 241], 38: [2, 241], 40: [2, 241], 44: [2, 241], 46: [2, 241], 47: [2, 241], 54: [2, 241], 55: [2, 241], 61: [2, 241], 62: [2, 241], 63: [2, 241], 64: [2, 241], 65: [2, 241], 66: [2, 241], 75: [2, 241], 77: [2, 241], 83: [2, 241], 86: [2, 241], 92: [2, 241], 94: [2, 241], 95: [2, 241], 98: [2, 241], 99: [2, 241], 111: [2, 241], 112: [2, 241], 113: [2, 241], 114: [2, 241], 121: [2, 241], 123: [2, 241], 131: [2, 241], 138: [2, 241], 148: [2, 241], 152: [2, 241], 153: [2, 241], 156: [2, 241], 157: [2, 241], 159: [2, 241], 163: [2, 241], 165: [2, 241], 171: [2, 241], 173: [2, 241], 176: [2, 241], 177: [2, 241], 178: [2, 241], 179: [2, 241], 180: [2, 241], 181: [2, 241], 182: [2, 241], 183: [2, 241] }, { 11: [2, 242], 27: [2, 242], 35: [2, 242], 38: [2, 242], 40: [2, 242], 44: [2, 242], 46: [2, 242], 47: [2, 242], 54: [2, 242], 55: [2, 242], 61: [2, 242], 62: [2, 242], 63: [2, 242], 64: [2, 242], 65: [2, 242], 66: [2, 242], 75: [2, 242], 77: [2, 242], 83: [2, 242], 86: [2, 242], 92: [2, 242], 94: [2, 242], 95: [2, 242], 98: [2, 242], 99: [2, 242], 111: [2, 242], 112: [2, 242], 113: [2, 242], 114: [2, 242], 121: [2, 242], 123: [2, 242], 131: [2, 242], 138: [2, 242], 148: [2, 242], 152: [2, 242], 153: [2, 242], 156: [2, 242], 157: [2, 242], 159: [2, 242], 163: [2, 242], 165: [2, 242], 171: [2, 242], 173: [2, 242], 176: [2, 242], 177: [2, 242], 178: [2, 242], 179: [2, 242], 180: [2, 242], 181: [2, 242], 182: [2, 242], 183: [2, 242] }, { 7: 429, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 36: [1, 430], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 78: [1, 295], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 106: 431, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 142: 292, 143: [1, 294], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 432, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 36: [1, 433], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 141], 6: [2, 141], 29: [2, 141], 31: [2, 141], 36: [2, 141], 38: [2, 141], 46: [2, 141], 47: [2, 141], 52: [2, 141], 59: [2, 141], 68: [2, 141], 72: [2, 141], 76: [2, 141], 78: [2, 141], 87: [2, 141], 88: [2, 141], 89: [2, 141], 90: [2, 141], 91: [2, 141], 92: [2, 141], 93: [2, 141], 96: [2, 141], 107: [2, 141], 114: [2, 141], 117: [2, 141], 118: [2, 141], 122: [2, 141], 135: [2, 141], 136: [2, 141], 143: [2, 141], 154: [2, 141], 156: [2, 141], 157: [2, 141], 161: [2, 141], 174: [2, 141], 175: [2, 141], 180: [2, 141], 181: [2, 141], 182: [2, 141], 183: [2, 141], 184: [2, 141], 185: [2, 141], 186: [2, 141], 187: [2, 141], 188: [2, 141], 189: [2, 141], 190: [2, 141], 191: [2, 141], 192: [2, 141], 193: [2, 141], 194: [2, 141], 195: [2, 141], 196: [2, 141], 197: [2, 141] }, { 1: [2, 142], 6: [2, 142], 29: [2, 142], 31: [2, 142], 36: [2, 142], 38: [2, 142], 46: [2, 142], 47: [2, 142], 52: [2, 142], 59: [2, 142], 68: [2, 142], 72: [2, 142], 76: [2, 142], 78: [2, 142], 87: [2, 142], 88: [2, 142], 89: [2, 142], 90: [2, 142], 91: [2, 142], 92: [2, 142], 93: [2, 142], 96: [2, 142], 107: [2, 142], 114: [2, 142], 117: [2, 142], 118: [2, 142], 122: [2, 142], 135: [2, 142], 136: [2, 142], 143: [2, 142], 154: [2, 142], 156: [2, 142], 157: [2, 142], 161: [2, 142], 174: [2, 142], 175: [2, 142], 180: [2, 142], 181: [2, 142], 182: [2, 142], 183: [2, 142], 184: [2, 142], 185: [2, 142], 186: [2, 142], 187: [2, 142], 188: [2, 142], 189: [2, 142], 190: [2, 142], 191: [2, 142], 192: [2, 142], 193: [2, 142], 194: [2, 142], 195: [2, 142], 196: [2, 142], 197: [2, 142] }, { 1: [2, 143], 6: [2, 143], 29: [2, 143], 31: [2, 143], 36: [2, 143], 38: [2, 143], 46: [2, 143], 47: [2, 143], 52: [2, 143], 59: [2, 143], 68: [2, 143], 72: [2, 143], 76: [2, 143], 78: [2, 143], 87: [2, 143], 88: [2, 143], 89: [2, 143], 90: [2, 143], 91: [2, 143], 92: [2, 143], 93: [2, 143], 96: [2, 143], 107: [2, 143], 114: [2, 143], 117: [2, 143], 118: [2, 143], 122: [2, 143], 135: [2, 143], 136: [2, 143], 143: [2, 143], 154: [2, 143], 156: [2, 143], 157: [2, 143], 161: [2, 143], 174: [2, 143], 175: [2, 143], 180: [2, 143], 181: [2, 143], 182: [2, 143], 183: [2, 143], 184: [2, 143], 185: [2, 143], 186: [2, 143], 187: [2, 143], 188: [2, 143], 189: [2, 143], 190: [2, 143], 191: [2, 143], 192: [2, 143], 193: [2, 143], 194: [2, 143], 195: [2, 143], 196: [2, 143], 197: [2, 143] }, { 1: [2, 144], 6: [2, 144], 29: [2, 144], 31: [2, 144], 36: [2, 144], 38: [2, 144], 46: [2, 144], 47: [2, 144], 52: [2, 144], 59: [2, 144], 68: [2, 144], 72: [2, 144], 76: [2, 144], 78: [2, 144], 87: [2, 144], 88: [2, 144], 89: [2, 144], 90: [2, 144], 91: [2, 144], 92: [2, 144], 93: [2, 144], 96: [2, 144], 107: [2, 144], 114: [2, 144], 117: [2, 144], 118: [2, 144], 122: [2, 144], 135: [2, 144], 136: [2, 144], 143: [2, 144], 154: [2, 144], 156: [2, 144], 157: [2, 144], 161: [2, 144], 174: [2, 144], 175: [2, 144], 180: [2, 144], 181: [2, 144], 182: [2, 144], 183: [2, 144], 184: [2, 144], 185: [2, 144], 186: [2, 144], 187: [2, 144], 188: [2, 144], 189: [2, 144], 190: [2, 144], 191: [2, 144], 192: [2, 144], 193: [2, 144], 194: [2, 144], 195: [2, 144], 196: [2, 144], 197: [2, 144] }, { 92: [1, 434], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 7: 435, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 436, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 36: [1, 437], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 60], 6: [2, 60], 31: [2, 60], 36: [2, 60], 38: [2, 60], 52: [2, 60], 59: [2, 60], 72: [2, 60], 76: [2, 60], 78: [2, 60], 92: [2, 60], 96: [2, 60], 114: [2, 60], 117: [2, 60], 118: [2, 60], 143: [2, 60], 154: [2, 60], 155: 114, 156: [2, 60], 157: [2, 60], 161: [2, 60], 174: [2, 60], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 7: 438, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 439, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 97: 440, 98: [1, 79], 99: [1, 80] }, { 6: [2, 107], 28: 140, 31: [2, 107], 36: [2, 107], 37: 143, 38: [2, 107], 40: [1, 93], 74: 141, 75: [1, 145], 76: [2, 107], 77: [1, 144], 78: [1, 139], 101: 441, 102: 138, 103: 142, 113: [1, 88], 117: [2, 107] }, { 6: [1, 442], 36: [1, 443] }, { 7: 444, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 6: [2, 114], 31: [2, 114], 36: [2, 114], 38: [2, 114], 59: [2, 114], 96: [2, 114] }, { 6: [2, 253], 31: [2, 253], 36: [2, 253], 38: [2, 253], 59: [2, 253], 76: [2, 253], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 34], 6: [2, 34], 29: [2, 34], 31: [2, 34], 36: [2, 34], 38: [2, 34], 46: [2, 34], 47: [2, 34], 52: [2, 34], 59: [2, 34], 72: [2, 34], 76: [2, 34], 78: [2, 34], 87: [2, 34], 88: [2, 34], 89: [2, 34], 90: [2, 34], 91: [2, 34], 92: [2, 34], 93: [2, 34], 96: [2, 34], 107: [2, 34], 114: [2, 34], 117: [2, 34], 118: [2, 34], 135: [2, 34], 136: [2, 34], 143: [2, 34], 150: [2, 34], 151: [2, 34], 154: [2, 34], 156: [2, 34], 157: [2, 34], 161: [2, 34], 167: [2, 34], 169: [2, 34], 174: [2, 34], 175: [2, 34], 180: [2, 34], 181: [2, 34], 184: [2, 34], 185: [2, 34], 186: [2, 34], 187: [2, 34], 188: [2, 34], 189: [2, 34], 190: [2, 34], 191: [2, 34], 192: [2, 34], 193: [2, 34], 194: [2, 34], 195: [2, 34], 196: [2, 34] }, { 6: [1, 96], 38: [1, 445] }, { 6: [2, 106], 31: [2, 106], 36: [2, 106], 38: [2, 106], 59: [1, 309], 76: [2, 106], 96: [1, 446], 100: 310, 117: [2, 106] }, { 38: [1, 447] }, { 1: [2, 377], 6: [2, 377], 31: [2, 377], 36: [2, 377], 38: [2, 377], 52: [2, 377], 59: [2, 377], 72: [2, 377], 76: [2, 377], 78: [2, 377], 92: [2, 377], 96: [2, 377], 114: [2, 377], 117: [2, 377], 118: [2, 377], 143: [2, 377], 154: [2, 377], 155: 114, 156: [2, 377], 157: [2, 377], 161: [2, 377], 174: [2, 377], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 7: 448, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 449, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 342], 6: [2, 342], 31: [2, 342], 36: [2, 342], 38: [2, 342], 52: [2, 342], 59: [2, 342], 72: [2, 342], 76: [2, 342], 78: [2, 342], 92: [2, 342], 96: [2, 342], 114: [2, 342], 117: [2, 342], 118: [2, 342], 143: [2, 342], 154: [2, 342], 156: [2, 342], 157: [2, 342], 161: [2, 342], 174: [2, 342], 175: [2, 342], 180: [2, 342], 181: [2, 342], 184: [2, 342], 185: [2, 342], 186: [2, 342], 187: [2, 342], 188: [2, 342], 189: [2, 342], 190: [2, 342], 191: [2, 342], 192: [2, 342], 193: [2, 342], 194: [2, 342], 195: [2, 342], 196: [2, 342] }, { 7: 450, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 273], 6: [2, 273], 31: [2, 273], 36: [2, 273], 38: [2, 273], 52: [2, 273], 59: [2, 273], 72: [2, 273], 76: [2, 273], 78: [2, 273], 92: [2, 273], 96: [2, 273], 114: [2, 273], 117: [2, 273], 118: [2, 273], 143: [2, 273], 150: [1, 451], 154: [2, 273], 156: [2, 273], 157: [2, 273], 161: [2, 273], 174: [2, 273], 175: [2, 273], 180: [2, 273], 181: [2, 273], 184: [2, 273], 185: [2, 273], 186: [2, 273], 187: [2, 273], 188: [2, 273], 189: [2, 273], 190: [2, 273], 191: [2, 273], 192: [2, 273], 193: [2, 273], 194: [2, 273], 195: [2, 273], 196: [2, 273] }, { 32: 452, 36: [1, 148] }, { 28: 453, 32: 455, 36: [1, 148], 37: 454, 40: [1, 93], 113: [1, 88] }, { 7: 456, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 457, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 458, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 116: [1, 459] }, { 162: [1, 460] }, { 1: [2, 306], 6: [2, 306], 31: [2, 306], 36: [2, 306], 38: [2, 306], 52: [2, 306], 59: [2, 306], 72: [2, 306], 76: [2, 306], 78: [2, 306], 92: [2, 306], 96: [2, 306], 114: [2, 306], 117: [2, 306], 118: [2, 306], 143: [2, 306], 154: [2, 306], 156: [2, 306], 157: [2, 306], 161: [2, 306], 174: [2, 306], 175: [2, 306], 180: [2, 306], 181: [2, 306], 184: [2, 306], 185: [2, 306], 186: [2, 306], 187: [2, 306], 188: [2, 306], 189: [2, 306], 190: [2, 306], 191: [2, 306], 192: [2, 306], 193: [2, 306], 194: [2, 306], 195: [2, 306], 196: [2, 306] }, { 7: 461, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 28: 180, 37: 183, 40: [1, 93], 74: 181, 75: [1, 145], 77: [1, 144], 103: 182, 113: [1, 88], 164: 462 }, { 166: 463, 168: 336, 169: [1, 337] }, { 38: [1, 464], 167: [1, 465], 168: 466, 169: [1, 337] }, { 38: [2, 333], 167: [2, 333], 169: [2, 333] }, { 7: 468, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 147: 467, 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 180], 6: [2, 180], 31: [2, 180], 32: 469, 36: [1, 148], 38: [2, 180], 52: [2, 180], 59: [2, 180], 72: [2, 180], 76: [2, 180], 78: [2, 180], 92: [2, 180], 96: [2, 180], 114: [2, 180], 117: [2, 180], 118: [2, 180], 143: [2, 180], 154: [2, 180], 155: 114, 156: [2, 180], 157: [2, 180], 161: [2, 180], 174: [2, 180], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 183], 6: [2, 183], 31: [2, 183], 36: [2, 183], 38: [2, 183], 52: [2, 183], 59: [2, 183], 72: [2, 183], 76: [2, 183], 78: [2, 183], 92: [2, 183], 96: [2, 183], 114: [2, 183], 117: [2, 183], 118: [2, 183], 143: [2, 183], 154: [2, 183], 156: [2, 183], 157: [2, 183], 161: [2, 183], 174: [2, 183], 175: [2, 183], 180: [2, 183], 181: [2, 183], 184: [2, 183], 185: [2, 183], 186: [2, 183], 187: [2, 183], 188: [2, 183], 189: [2, 183], 190: [2, 183], 191: [2, 183], 192: [2, 183], 193: [2, 183], 194: [2, 183], 195: [2, 183], 196: [2, 183] }, { 7: 470, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 38: [1, 471] }, { 38: [1, 472] }, { 1: [2, 33], 6: [2, 33], 31: [2, 33], 36: [2, 33], 38: [2, 33], 52: [2, 33], 59: [2, 33], 72: [2, 33], 76: [2, 33], 78: [2, 33], 92: [2, 33], 96: [2, 33], 114: [2, 33], 117: [2, 33], 118: [2, 33], 143: [2, 33], 154: [2, 33], 155: 114, 156: [2, 33], 157: [2, 33], 161: [2, 33], 174: [2, 33], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 6: [2, 108], 28: 140, 30: 473, 31: [2, 108], 36: [2, 108], 37: 143, 38: [2, 108], 40: [1, 93], 59: [2, 108], 74: 141, 75: [1, 145], 77: [1, 144], 78: [1, 139], 96: [2, 108], 101: 137, 102: 138, 103: 142, 113: [1, 88] }, { 1: [2, 27], 6: [2, 27], 31: [2, 27], 36: [2, 27], 38: [2, 27], 52: [2, 27], 59: [2, 27], 72: [2, 27], 76: [2, 27], 78: [2, 27], 92: [2, 27], 96: [2, 27], 114: [2, 27], 117: [2, 27], 118: [2, 27], 143: [2, 27], 154: [2, 27], 156: [2, 27], 157: [2, 27], 161: [2, 27], 174: [2, 27], 175: [2, 27], 180: [2, 27], 181: [2, 27], 184: [2, 27], 185: [2, 27], 186: [2, 27], 187: [2, 27], 188: [2, 27], 189: [2, 27], 190: [2, 27], 191: [2, 27], 192: [2, 27], 193: [2, 27], 194: [2, 27], 195: [2, 27], 196: [2, 27] }, { 38: [1, 474] }, { 45: 475, 46: [1, 94], 47: [1, 95] }, { 113: [1, 477], 125: 476, 130: [1, 204] }, { 45: 478, 46: [1, 94], 47: [1, 95] }, { 39: [1, 479] }, { 6: [2, 106], 31: [2, 106], 36: [2, 106], 38: [2, 106], 59: [1, 481], 76: [2, 106], 100: 480, 117: [2, 106] }, { 6: [2, 193], 36: [2, 193], 38: [2, 193], 59: [2, 193], 117: [2, 193] }, { 28: 354, 36: [1, 353], 40: [1, 93], 126: 482, 127: 352, 129: [1, 355] }, { 6: [2, 198], 36: [2, 198], 38: [2, 198], 59: [2, 198], 117: [2, 198], 128: [1, 483] }, { 6: [2, 200], 36: [2, 200], 38: [2, 200], 59: [2, 200], 117: [2, 200], 128: [1, 484] }, { 28: 485, 40: [1, 93] }, { 1: [2, 204], 6: [2, 204], 31: [2, 204], 36: [2, 204], 38: [2, 204], 39: [1, 486], 52: [2, 204], 59: [2, 204], 76: [2, 204], 154: [2, 204], 156: [2, 204], 157: [2, 204], 174: [2, 204], 175: [2, 204] }, { 6: [2, 106], 31: [2, 106], 36: [2, 106], 38: [2, 106], 59: [1, 488], 76: [2, 106], 100: 487, 117: [2, 106] }, { 6: [2, 216], 36: [2, 216], 38: [2, 216], 59: [2, 216], 117: [2, 216] }, { 28: 361, 36: [1, 360], 40: [1, 93], 129: [1, 362], 132: 489, 134: 359 }, { 6: [2, 221], 36: [2, 221], 38: [2, 221], 59: [2, 221], 117: [2, 221], 128: [1, 490] }, { 6: [2, 224], 36: [2, 224], 38: [2, 224], 59: [2, 224], 117: [2, 224], 128: [1, 491] }, { 6: [1, 493], 7: 492, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 36: [1, 494], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 211], 6: [2, 211], 31: [2, 211], 36: [2, 211], 38: [2, 211], 52: [2, 211], 59: [2, 211], 76: [2, 211], 114: [1, 115], 154: [2, 211], 155: 114, 156: [1, 85], 157: [1, 86], 174: [2, 211], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 37: 495, 113: [1, 88] }, { 45: 496, 46: [1, 94], 47: [1, 95] }, { 1: [2, 281], 6: [2, 281], 29: [2, 281], 31: [2, 281], 36: [2, 281], 38: [2, 281], 46: [2, 281], 47: [2, 281], 52: [2, 281], 59: [2, 281], 72: [2, 281], 76: [2, 281], 78: [2, 281], 87: [2, 281], 88: [2, 281], 89: [2, 281], 90: [2, 281], 91: [2, 281], 92: [2, 281], 93: [2, 281], 96: [2, 281], 107: [2, 281], 114: [2, 281], 117: [2, 281], 118: [2, 281], 135: [2, 281], 136: [2, 281], 143: [2, 281], 154: [2, 281], 156: [2, 281], 157: [2, 281], 161: [2, 281], 174: [2, 281], 175: [2, 281], 180: [2, 281], 181: [2, 281], 184: [2, 281], 185: [2, 281], 186: [2, 281], 187: [2, 281], 188: [2, 281], 189: [2, 281], 190: [2, 281], 191: [2, 281], 192: [2, 281], 193: [2, 281], 194: [2, 281], 195: [2, 281], 196: [2, 281] }, { 6: [1, 96], 38: [1, 497] }, { 7: 498, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 239], 6: [2, 239], 29: [2, 239], 31: [2, 239], 36: [2, 239], 38: [2, 239], 46: [2, 239], 47: [2, 239], 52: [2, 239], 59: [2, 239], 68: [2, 239], 72: [2, 239], 76: [2, 239], 78: [2, 239], 87: [2, 239], 88: [2, 239], 89: [2, 239], 90: [2, 239], 91: [2, 239], 92: [2, 239], 93: [2, 239], 96: [2, 239], 107: [2, 239], 114: [2, 239], 116: [2, 239], 117: [2, 239], 118: [2, 239], 135: [2, 239], 136: [2, 239], 143: [2, 239], 154: [2, 239], 156: [2, 239], 157: [2, 239], 160: [2, 239], 161: [2, 239], 162: [2, 239], 174: [2, 239], 175: [2, 239], 180: [2, 239], 181: [2, 239], 184: [2, 239], 185: [2, 239], 186: [2, 239], 187: [2, 239], 188: [2, 239], 189: [2, 239], 190: [2, 239], 191: [2, 239], 192: [2, 239], 193: [2, 239], 194: [2, 239], 195: [2, 239], 196: [2, 239] }, { 6: [1, 376], 11: [2, 267], 27: [2, 267], 35: [2, 267], 36: [2, 267], 38: [2, 267], 40: [2, 267], 44: [2, 267], 46: [2, 267], 47: [2, 267], 54: [2, 267], 55: [2, 267], 59: [2, 267], 61: [2, 267], 62: [2, 267], 63: [2, 267], 64: [2, 267], 65: [2, 267], 66: [2, 267], 75: [2, 267], 76: [2, 267], 77: [2, 267], 78: [2, 267], 83: [2, 267], 86: [2, 267], 94: [2, 267], 95: [2, 267], 98: [2, 267], 99: [2, 267], 111: [2, 267], 112: [2, 267], 113: [2, 267], 114: [2, 267], 121: [2, 267], 123: [2, 267], 131: [2, 267], 138: [2, 267], 148: [2, 267], 152: [2, 267], 153: [2, 267], 156: [2, 267], 157: [2, 267], 159: [2, 267], 163: [2, 267], 165: [2, 267], 171: [2, 267], 173: [2, 267], 176: [2, 267], 177: [2, 267], 178: [2, 267], 179: [2, 267], 180: [2, 267], 181: [2, 267], 182: [2, 267], 183: [2, 267] }, { 6: [2, 263], 36: [2, 263], 38: [2, 263], 59: [2, 263], 76: [2, 263] }, { 36: [1, 500], 76: [1, 499] }, { 6: [2, 107], 7: 313, 8: 222, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 31: [2, 107], 33: 20, 34: 21, 35: [1, 55], 36: [2, 107], 37: 62, 38: [2, 107], 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 59: [1, 220], 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 76: [2, 107], 77: [1, 76], 78: [1, 224], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 104: 223, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 117: [2, 107], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 139: 502, 144: 221, 145: 501, 146: 217, 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 6: [1, 503], 36: [2, 264], 38: [2, 264], 76: [2, 264] }, { 6: [2, 269], 11: [2, 269], 27: [2, 269], 35: [2, 269], 36: [2, 269], 38: [2, 269], 40: [2, 269], 44: [2, 269], 46: [2, 269], 47: [2, 269], 54: [2, 269], 55: [2, 269], 59: [2, 269], 61: [2, 269], 62: [2, 269], 63: [2, 269], 64: [2, 269], 65: [2, 269], 66: [2, 269], 75: [2, 269], 76: [2, 269], 77: [2, 269], 78: [2, 269], 83: [2, 269], 86: [2, 269], 94: [2, 269], 95: [2, 269], 98: [2, 269], 99: [2, 269], 111: [2, 269], 112: [2, 269], 113: [2, 269], 114: [2, 269], 121: [2, 269], 123: [2, 269], 131: [2, 269], 138: [2, 269], 148: [2, 269], 152: [2, 269], 153: [2, 269], 156: [2, 269], 157: [2, 269], 159: [2, 269], 163: [2, 269], 165: [2, 269], 171: [2, 269], 173: [2, 269], 176: [2, 269], 177: [2, 269], 178: [2, 269], 179: [2, 269], 180: [2, 269], 181: [2, 269], 182: [2, 269], 183: [2, 269] }, { 6: [2, 106], 31: [2, 106], 36: [2, 106], 38: [2, 106], 59: [1, 374], 76: [2, 106], 100: 375, 117: [2, 106], 141: 504 }, { 7: 313, 8: 222, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 33: 20, 34: 21, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 59: [1, 220], 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 78: [1, 224], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 104: 223, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 144: 372, 146: 371, 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 6: [2, 121], 31: [2, 121], 36: [2, 121], 38: [2, 121], 59: [2, 121], 76: [2, 121], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 229], 6: [2, 229], 29: [2, 229], 31: [2, 229], 36: [2, 229], 38: [2, 229], 46: [2, 229], 47: [2, 229], 52: [2, 229], 57: [2, 229], 59: [2, 229], 72: [2, 229], 76: [2, 229], 78: [2, 229], 87: [2, 229], 88: [2, 229], 89: [2, 229], 90: [2, 229], 91: [2, 229], 92: [2, 229], 93: [2, 229], 96: [2, 229], 107: [2, 229], 114: [2, 229], 117: [2, 229], 118: [2, 229], 135: [2, 229], 136: [2, 229], 143: [2, 229], 154: [2, 229], 156: [2, 229], 157: [2, 229], 161: [2, 229], 174: [2, 229], 175: [2, 229], 180: [2, 229], 181: [2, 229], 184: [2, 229], 185: [2, 229], 186: [2, 229], 187: [2, 229], 188: [2, 229], 189: [2, 229], 190: [2, 229], 191: [2, 229], 192: [2, 229], 193: [2, 229], 194: [2, 229], 195: [2, 229], 196: [2, 229] }, { 1: [2, 163], 6: [2, 163], 29: [2, 163], 31: [2, 163], 36: [2, 163], 38: [2, 163], 46: [2, 163], 47: [2, 163], 52: [2, 163], 59: [2, 163], 72: [2, 163], 76: [2, 163], 78: [2, 163], 87: [2, 163], 88: [2, 163], 89: [2, 163], 90: [2, 163], 91: [2, 163], 92: [2, 163], 93: [2, 163], 96: [2, 163], 107: [2, 163], 114: [2, 163], 117: [2, 163], 118: [2, 163], 135: [2, 163], 136: [2, 163], 143: [2, 163], 154: [2, 163], 156: [2, 163], 157: [2, 163], 161: [2, 163], 174: [2, 163], 175: [2, 163], 180: [2, 163], 181: [2, 163], 184: [2, 163], 185: [2, 163], 186: [2, 163], 187: [2, 163], 188: [2, 163], 189: [2, 163], 190: [2, 163], 191: [2, 163], 192: [2, 163], 193: [2, 163], 194: [2, 163], 195: [2, 163], 196: [2, 163] }, { 92: [1, 505], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 7: 506, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 233], 6: [2, 233], 29: [2, 233], 31: [2, 233], 36: [2, 233], 38: [2, 233], 46: [2, 233], 47: [2, 233], 52: [2, 233], 57: [2, 233], 59: [2, 233], 72: [2, 233], 76: [2, 233], 78: [2, 233], 87: [2, 233], 88: [2, 233], 89: [2, 233], 90: [2, 233], 91: [2, 233], 92: [2, 233], 93: [2, 233], 96: [2, 233], 107: [2, 233], 114: [2, 233], 117: [2, 233], 118: [2, 233], 135: [2, 233], 136: [2, 233], 143: [2, 233], 154: [2, 233], 156: [2, 233], 157: [2, 233], 161: [2, 233], 174: [2, 233], 175: [2, 233], 180: [2, 233], 181: [2, 233], 184: [2, 233], 185: [2, 233], 186: [2, 233], 187: [2, 233], 188: [2, 233], 189: [2, 233], 190: [2, 233], 191: [2, 233], 192: [2, 233], 193: [2, 233], 194: [2, 233], 195: [2, 233], 196: [2, 233] }, { 6: [2, 106], 31: [2, 106], 36: [2, 106], 38: [2, 106], 59: [1, 508], 76: [2, 106], 100: 507, 117: [2, 106] }, { 6: [2, 248], 31: [2, 248], 36: [2, 248], 38: [2, 248], 59: [2, 248] }, { 7: 313, 8: 222, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 33: 20, 34: 21, 35: [1, 55], 36: [1, 387], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 78: [1, 224], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 104: 223, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 137: 509, 138: [1, 75], 144: 386, 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 166], 6: [2, 166], 29: [2, 166], 31: [2, 166], 36: [2, 166], 38: [2, 166], 46: [2, 166], 47: [2, 166], 52: [2, 166], 59: [2, 166], 72: [2, 166], 76: [2, 166], 78: [2, 166], 87: [2, 166], 88: [2, 166], 89: [2, 166], 90: [2, 166], 91: [2, 166], 92: [2, 166], 93: [2, 166], 96: [2, 166], 107: [2, 166], 114: [2, 166], 117: [2, 166], 118: [2, 166], 135: [2, 166], 136: [2, 166], 143: [2, 166], 154: [2, 166], 156: [2, 166], 157: [2, 166], 161: [2, 166], 174: [2, 166], 175: [2, 166], 180: [2, 166], 181: [2, 166], 184: [2, 166], 185: [2, 166], 186: [2, 166], 187: [2, 166], 188: [2, 166], 189: [2, 166], 190: [2, 166], 191: [2, 166], 192: [2, 166], 193: [2, 166], 194: [2, 166], 195: [2, 166], 196: [2, 166] }, { 1: [2, 167], 6: [2, 167], 29: [2, 167], 31: [2, 167], 36: [2, 167], 38: [2, 167], 46: [2, 167], 47: [2, 167], 52: [2, 167], 59: [2, 167], 72: [2, 167], 76: [2, 167], 78: [2, 167], 87: [2, 167], 88: [2, 167], 89: [2, 167], 90: [2, 167], 91: [2, 167], 92: [2, 167], 93: [2, 167], 96: [2, 167], 107: [2, 167], 114: [2, 167], 117: [2, 167], 118: [2, 167], 135: [2, 167], 136: [2, 167], 143: [2, 167], 154: [2, 167], 156: [2, 167], 157: [2, 167], 161: [2, 167], 174: [2, 167], 175: [2, 167], 180: [2, 167], 181: [2, 167], 184: [2, 167], 185: [2, 167], 186: [2, 167], 187: [2, 167], 188: [2, 167], 189: [2, 167], 190: [2, 167], 191: [2, 167], 192: [2, 167], 193: [2, 167], 194: [2, 167], 195: [2, 167], 196: [2, 167] }, { 1: [2, 337], 6: [2, 337], 31: [2, 337], 36: [2, 337], 38: [2, 337], 52: [2, 337], 59: [2, 337], 72: [2, 337], 76: [2, 337], 78: [2, 337], 92: [2, 337], 96: [2, 337], 114: [2, 337], 117: [2, 337], 118: [2, 337], 143: [2, 337], 154: [2, 337], 156: [2, 337], 157: [2, 337], 161: [2, 337], 167: [2, 337], 174: [2, 337], 175: [2, 337], 180: [2, 337], 181: [2, 337], 184: [2, 337], 185: [2, 337], 186: [2, 337], 187: [2, 337], 188: [2, 337], 189: [2, 337], 190: [2, 337], 191: [2, 337], 192: [2, 337], 193: [2, 337], 194: [2, 337], 195: [2, 337], 196: [2, 337] }, { 1: [2, 339], 6: [2, 339], 31: [2, 339], 36: [2, 339], 38: [2, 339], 52: [2, 339], 59: [2, 339], 72: [2, 339], 76: [2, 339], 78: [2, 339], 92: [2, 339], 96: [2, 339], 114: [2, 339], 117: [2, 339], 118: [2, 339], 143: [2, 339], 154: [2, 339], 156: [2, 339], 157: [2, 339], 161: [2, 339], 167: [1, 510], 174: [2, 339], 175: [2, 339], 180: [2, 339], 181: [2, 339], 184: [2, 339], 185: [2, 339], 186: [2, 339], 187: [2, 339], 188: [2, 339], 189: [2, 339], 190: [2, 339], 191: [2, 339], 192: [2, 339], 193: [2, 339], 194: [2, 339], 195: [2, 339], 196: [2, 339] }, { 7: 511, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 512, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 513, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 36: [1, 514], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 6: [1, 516], 36: [1, 517], 117: [1, 515] }, { 6: [2, 107], 28: 247, 31: [2, 107], 36: [2, 107], 38: [2, 107], 40: [1, 93], 41: 248, 42: [1, 231], 43: 245, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 69: 518, 70: 519, 71: 250, 73: 242, 74: 249, 75: [1, 243], 76: [2, 107], 77: [1, 244], 78: [1, 251], 117: [2, 107] }, { 7: 520, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 36: [1, 521], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 76: [1, 522], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 7: 523, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 6: [2, 76], 29: [2, 78], 36: [2, 76], 38: [2, 76], 46: [2, 231], 47: [2, 231], 59: [2, 76], 84: 524, 87: [2, 78], 88: [2, 78], 89: [2, 78], 90: [2, 78], 91: [2, 78], 93: [2, 78], 117: [2, 76], 136: [1, 128] }, { 6: [2, 77], 29: [2, 231], 36: [2, 77], 38: [2, 77], 46: [2, 231], 47: [2, 231], 59: [2, 77], 84: 525, 87: [1, 526], 88: [1, 527], 89: [1, 528], 90: [1, 529], 91: [1, 530], 93: [1, 531], 117: [2, 77], 136: [1, 128] }, { 6: [2, 79], 29: [2, 79], 36: [2, 79], 38: [2, 79], 59: [2, 79], 87: [2, 79], 88: [2, 79], 89: [2, 79], 90: [2, 79], 91: [2, 79], 93: [2, 79], 117: [2, 79], 136: [2, 79] }, { 6: [2, 80], 29: [2, 80], 36: [2, 80], 38: [2, 80], 59: [2, 80], 87: [2, 80], 88: [2, 80], 89: [2, 80], 90: [2, 80], 91: [2, 80], 93: [2, 80], 117: [2, 80], 136: [2, 80] }, { 6: [2, 81], 29: [2, 81], 36: [2, 81], 38: [2, 81], 59: [2, 81], 87: [2, 81], 88: [2, 81], 89: [2, 81], 90: [2, 81], 91: [2, 81], 93: [2, 81], 117: [2, 81], 136: [2, 81] }, { 6: [2, 82], 29: [2, 82], 36: [2, 82], 38: [2, 82], 59: [2, 82], 87: [2, 82], 88: [2, 82], 89: [2, 82], 90: [2, 82], 91: [2, 82], 93: [2, 82], 117: [2, 82], 136: [2, 82] }, { 29: [2, 231], 46: [2, 231], 47: [2, 231], 84: 532, 87: [1, 226], 91: [1, 227], 136: [1, 128] }, { 29: [1, 229], 85: 533 }, { 1: [2, 49], 6: [2, 49], 29: [2, 49], 31: [2, 49], 36: [2, 49], 38: [2, 49], 46: [2, 49], 47: [2, 49], 52: [2, 49], 59: [2, 49], 72: [2, 49], 76: [2, 49], 78: [2, 49], 87: [2, 49], 88: [2, 49], 89: [2, 49], 90: [2, 49], 91: [2, 49], 92: [2, 49], 93: [2, 49], 96: [2, 49], 107: [2, 49], 114: [2, 49], 117: [2, 49], 118: [2, 49], 135: [2, 49], 136: [2, 49], 143: [2, 49], 154: [2, 49], 156: [2, 49], 157: [2, 49], 161: [2, 49], 174: [2, 49], 175: [2, 49], 180: [2, 49], 181: [2, 49], 184: [2, 49], 185: [2, 49], 186: [2, 49], 187: [2, 49], 188: [2, 49], 189: [2, 49], 190: [2, 49], 191: [2, 49], 192: [2, 49], 193: [2, 49], 194: [2, 49], 195: [2, 49], 196: [2, 49] }, { 1: [2, 41], 6: [2, 41], 29: [2, 41], 31: [2, 41], 36: [2, 41], 38: [2, 41], 46: [2, 41], 47: [2, 41], 49: [2, 41], 51: [2, 41], 52: [2, 41], 57: [2, 41], 59: [2, 41], 72: [2, 41], 76: [2, 41], 78: [2, 41], 87: [2, 41], 88: [2, 41], 89: [2, 41], 90: [2, 41], 91: [2, 41], 92: [2, 41], 93: [2, 41], 96: [2, 41], 107: [2, 41], 114: [2, 41], 117: [2, 41], 118: [2, 41], 135: [2, 41], 136: [2, 41], 143: [2, 41], 154: [2, 41], 156: [2, 41], 157: [2, 41], 161: [2, 41], 174: [2, 41], 175: [2, 41], 180: [2, 41], 181: [2, 41], 184: [2, 41], 185: [2, 41], 186: [2, 41], 187: [2, 41], 188: [2, 41], 189: [2, 41], 190: [2, 41], 191: [2, 41], 192: [2, 41], 193: [2, 41], 194: [2, 41], 195: [2, 41], 196: [2, 41] }, { 46: [2, 43], 47: [2, 43], 49: [2, 43], 51: [2, 43] }, { 6: [1, 96], 52: [1, 534] }, { 4: 535, 5: 3, 7: 4, 8: 5, 9: 6, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 33: 20, 34: 21, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 46: [2, 46], 47: [2, 46], 49: [2, 46], 51: [2, 46] }, { 7: 536, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 537, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 538, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 539, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 116: [1, 540] }, { 162: [1, 541] }, { 7: 542, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 130], 6: [2, 130], 29: [2, 130], 31: [2, 130], 36: [2, 130], 38: [2, 130], 46: [2, 130], 47: [2, 130], 52: [2, 130], 59: [2, 130], 68: [2, 130], 72: [2, 130], 76: [2, 130], 78: [2, 130], 87: [2, 130], 88: [2, 130], 89: [2, 130], 90: [2, 130], 91: [2, 130], 92: [2, 130], 93: [2, 130], 96: [2, 130], 107: [2, 130], 114: [2, 130], 117: [2, 130], 118: [2, 130], 122: [2, 130], 135: [2, 130], 136: [2, 130], 143: [2, 130], 154: [2, 130], 156: [2, 130], 157: [2, 130], 161: [2, 130], 174: [2, 130], 175: [2, 130], 180: [2, 130], 181: [2, 130], 182: [2, 130], 183: [2, 130], 184: [2, 130], 185: [2, 130], 186: [2, 130], 187: [2, 130], 188: [2, 130], 189: [2, 130], 190: [2, 130], 191: [2, 130], 192: [2, 130], 193: [2, 130], 194: [2, 130], 195: [2, 130], 196: [2, 130], 197: [2, 130] }, { 7: 543, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 38: [2, 245], 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 92: [2, 245], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 38: [1, 544], 78: [1, 295], 114: [1, 115], 142: 422, 143: [1, 294], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 38: [1, 545] }, { 1: [2, 132], 6: [2, 132], 29: [2, 132], 31: [2, 132], 36: [2, 132], 38: [2, 132], 46: [2, 132], 47: [2, 132], 52: [2, 132], 59: [2, 132], 68: [2, 132], 72: [2, 132], 76: [2, 132], 78: [2, 132], 87: [2, 132], 88: [2, 132], 89: [2, 132], 90: [2, 132], 91: [2, 132], 92: [2, 132], 93: [2, 132], 96: [2, 132], 107: [2, 132], 114: [2, 132], 117: [2, 132], 118: [2, 132], 122: [2, 132], 135: [2, 132], 136: [2, 132], 143: [2, 132], 154: [2, 132], 156: [2, 132], 157: [2, 132], 161: [2, 132], 174: [2, 132], 175: [2, 132], 180: [2, 132], 181: [2, 132], 182: [2, 132], 183: [2, 132], 184: [2, 132], 185: [2, 132], 186: [2, 132], 187: [2, 132], 188: [2, 132], 189: [2, 132], 190: [2, 132], 191: [2, 132], 192: [2, 132], 193: [2, 132], 194: [2, 132], 195: [2, 132], 196: [2, 132], 197: [2, 132] }, { 1: [2, 134], 6: [2, 134], 29: [2, 134], 31: [2, 134], 36: [2, 134], 38: [2, 134], 46: [2, 134], 47: [2, 134], 52: [2, 134], 59: [2, 134], 68: [2, 134], 72: [2, 134], 76: [2, 134], 78: [2, 134], 87: [2, 134], 88: [2, 134], 89: [2, 134], 90: [2, 134], 91: [2, 134], 92: [2, 134], 93: [2, 134], 96: [2, 134], 107: [2, 134], 114: [2, 134], 117: [2, 134], 118: [2, 134], 122: [2, 134], 135: [2, 134], 136: [2, 134], 143: [2, 134], 154: [2, 134], 156: [2, 134], 157: [2, 134], 161: [2, 134], 174: [2, 134], 175: [2, 134], 180: [2, 134], 181: [2, 134], 182: [2, 134], 183: [2, 134], 184: [2, 134], 185: [2, 134], 186: [2, 134], 187: [2, 134], 188: [2, 134], 189: [2, 134], 190: [2, 134], 191: [2, 134], 192: [2, 134], 193: [2, 134], 194: [2, 134], 195: [2, 134], 196: [2, 134], 197: [2, 134] }, { 38: [2, 246], 92: [2, 246], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 7: 546, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 78: [1, 295], 92: [1, 547], 114: [1, 115], 142: 422, 143: [1, 294], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 7: 548, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 78: [1, 295], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 106: 549, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 142: 292, 143: [1, 294], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 92: [1, 550] }, { 92: [1, 551], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 7: 552, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 147], 6: [2, 147], 29: [2, 147], 31: [2, 147], 36: [2, 147], 38: [2, 147], 46: [2, 147], 47: [2, 147], 52: [2, 147], 59: [2, 147], 68: [2, 147], 72: [2, 147], 76: [2, 147], 78: [2, 147], 87: [2, 147], 88: [2, 147], 89: [2, 147], 90: [2, 147], 91: [2, 147], 92: [2, 147], 93: [2, 147], 96: [2, 147], 107: [2, 147], 114: [2, 147], 117: [2, 147], 118: [2, 147], 122: [2, 147], 135: [2, 147], 136: [2, 147], 143: [2, 147], 154: [2, 147], 156: [2, 147], 157: [2, 147], 161: [2, 147], 174: [2, 147], 175: [2, 147], 180: [2, 147], 181: [2, 147], 182: [2, 147], 183: [2, 147], 184: [2, 147], 185: [2, 147], 186: [2, 147], 187: [2, 147], 188: [2, 147], 189: [2, 147], 190: [2, 147], 191: [2, 147], 192: [2, 147], 193: [2, 147], 194: [2, 147], 195: [2, 147], 196: [2, 147], 197: [2, 147] }, { 38: [1, 553], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 92: [1, 554], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 7: 555, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 61], 6: [2, 61], 31: [2, 61], 36: [2, 61], 38: [2, 61], 52: [2, 61], 59: [2, 61], 72: [2, 61], 76: [2, 61], 78: [2, 61], 92: [2, 61], 96: [2, 61], 114: [2, 61], 117: [2, 61], 118: [2, 61], 143: [2, 61], 154: [2, 61], 155: 114, 156: [2, 61], 157: [2, 61], 161: [2, 61], 174: [2, 61], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 38: [1, 556], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 5: 558, 7: 4, 8: 5, 9: 6, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 32: 557, 33: 20, 34: 21, 35: [1, 55], 36: [1, 148], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 6: [2, 110], 31: [2, 110], 36: [2, 110], 38: [2, 110], 59: [2, 110], 96: [2, 110] }, { 28: 140, 37: 143, 40: [1, 93], 74: 141, 75: [1, 145], 77: [1, 144], 78: [1, 139], 101: 559, 102: 138, 103: 142, 113: [1, 88] }, { 6: [2, 108], 28: 140, 30: 560, 31: [2, 108], 36: [2, 108], 37: 143, 38: [2, 108], 40: [1, 93], 59: [2, 108], 74: 141, 75: [1, 145], 77: [1, 144], 78: [1, 139], 96: [2, 108], 101: 137, 102: 138, 103: 142, 113: [1, 88] }, { 6: [2, 115], 31: [2, 115], 36: [2, 115], 38: [2, 115], 59: [2, 115], 96: [2, 115], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 35], 6: [2, 35], 29: [2, 35], 31: [2, 35], 36: [2, 35], 38: [2, 35], 46: [2, 35], 47: [2, 35], 52: [2, 35], 59: [2, 35], 72: [2, 35], 76: [2, 35], 78: [2, 35], 87: [2, 35], 88: [2, 35], 89: [2, 35], 90: [2, 35], 91: [2, 35], 92: [2, 35], 93: [2, 35], 96: [2, 35], 107: [2, 35], 114: [2, 35], 117: [2, 35], 118: [2, 35], 135: [2, 35], 136: [2, 35], 143: [2, 35], 150: [2, 35], 151: [2, 35], 154: [2, 35], 156: [2, 35], 157: [2, 35], 161: [2, 35], 167: [2, 35], 169: [2, 35], 174: [2, 35], 175: [2, 35], 180: [2, 35], 181: [2, 35], 184: [2, 35], 185: [2, 35], 186: [2, 35], 187: [2, 35], 188: [2, 35], 189: [2, 35], 190: [2, 35], 191: [2, 35], 192: [2, 35], 193: [2, 35], 194: [2, 35], 195: [2, 35], 196: [2, 35] }, { 97: 561, 98: [1, 79], 99: [1, 80] }, { 1: [2, 357], 6: [2, 357], 31: [2, 357], 36: [2, 357], 38: [2, 357], 52: [2, 357], 59: [2, 357], 72: [2, 357], 76: [2, 357], 78: [2, 357], 92: [2, 357], 96: [2, 357], 114: [2, 357], 117: [2, 357], 118: [2, 357], 143: [2, 357], 154: [2, 357], 156: [2, 357], 157: [2, 357], 161: [2, 357], 174: [2, 357], 175: [2, 357], 180: [2, 357], 181: [2, 357], 184: [2, 357], 185: [2, 357], 186: [2, 357], 187: [2, 357], 188: [2, 357], 189: [2, 357], 190: [2, 357], 191: [2, 357], 192: [2, 357], 193: [2, 357], 194: [2, 357], 195: [2, 357], 196: [2, 357] }, { 38: [1, 562], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 379], 6: [2, 379], 31: [2, 379], 36: [2, 379], 38: [2, 379], 52: [2, 379], 59: [2, 379], 72: [2, 379], 76: [2, 379], 78: [2, 379], 92: [2, 379], 96: [2, 379], 114: [2, 379], 117: [2, 379], 118: [2, 379], 143: [2, 379], 154: [2, 379], 155: 114, 156: [2, 379], 157: [2, 379], 161: [2, 379], 174: [2, 379], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 32: 563, 36: [1, 148], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 32: 564, 36: [1, 148] }, { 1: [2, 274], 6: [2, 274], 31: [2, 274], 36: [2, 274], 38: [2, 274], 52: [2, 274], 59: [2, 274], 72: [2, 274], 76: [2, 274], 78: [2, 274], 92: [2, 274], 96: [2, 274], 114: [2, 274], 117: [2, 274], 118: [2, 274], 143: [2, 274], 154: [2, 274], 156: [2, 274], 157: [2, 274], 161: [2, 274], 174: [2, 274], 175: [2, 274], 180: [2, 274], 181: [2, 274], 184: [2, 274], 185: [2, 274], 186: [2, 274], 187: [2, 274], 188: [2, 274], 189: [2, 274], 190: [2, 274], 191: [2, 274], 192: [2, 274], 193: [2, 274], 194: [2, 274], 195: [2, 274], 196: [2, 274] }, { 32: 565, 36: [1, 148] }, { 32: 566, 36: [1, 148] }, { 1: [2, 278], 6: [2, 278], 31: [2, 278], 36: [2, 278], 38: [2, 278], 52: [2, 278], 59: [2, 278], 72: [2, 278], 76: [2, 278], 78: [2, 278], 92: [2, 278], 96: [2, 278], 114: [2, 278], 117: [2, 278], 118: [2, 278], 143: [2, 278], 150: [2, 278], 154: [2, 278], 156: [2, 278], 157: [2, 278], 161: [2, 278], 174: [2, 278], 175: [2, 278], 180: [2, 278], 181: [2, 278], 184: [2, 278], 185: [2, 278], 186: [2, 278], 187: [2, 278], 188: [2, 278], 189: [2, 278], 190: [2, 278], 191: [2, 278], 192: [2, 278], 193: [2, 278], 194: [2, 278], 195: [2, 278], 196: [2, 278] }, { 32: 567, 36: [1, 148], 114: [1, 115], 118: [1, 568], 155: 114, 156: [1, 85], 157: [1, 86], 161: [1, 569], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 32: 570, 36: [1, 148], 114: [1, 115], 118: [1, 571], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 32: 572, 36: [1, 148], 114: [1, 115], 118: [1, 573], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 7: 574, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 575, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 32: 576, 36: [1, 148], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 116: [2, 328], 160: [2, 328], 162: [2, 328] }, { 38: [1, 577], 167: [1, 578], 168: 466, 169: [1, 337] }, { 1: [2, 331], 6: [2, 331], 31: [2, 331], 36: [2, 331], 38: [2, 331], 52: [2, 331], 59: [2, 331], 72: [2, 331], 76: [2, 331], 78: [2, 331], 92: [2, 331], 96: [2, 331], 114: [2, 331], 117: [2, 331], 118: [2, 331], 143: [2, 331], 154: [2, 331], 156: [2, 331], 157: [2, 331], 161: [2, 331], 174: [2, 331], 175: [2, 331], 180: [2, 331], 181: [2, 331], 184: [2, 331], 185: [2, 331], 186: [2, 331], 187: [2, 331], 188: [2, 331], 189: [2, 331], 190: [2, 331], 191: [2, 331], 192: [2, 331], 193: [2, 331], 194: [2, 331], 195: [2, 331], 196: [2, 331] }, { 32: 579, 36: [1, 148] }, { 38: [2, 334], 167: [2, 334], 169: [2, 334] }, { 32: 580, 36: [1, 148], 59: [1, 581] }, { 36: [2, 270], 59: [2, 270], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 181], 6: [2, 181], 31: [2, 181], 36: [2, 181], 38: [2, 181], 52: [2, 181], 59: [2, 181], 72: [2, 181], 76: [2, 181], 78: [2, 181], 92: [2, 181], 96: [2, 181], 114: [2, 181], 117: [2, 181], 118: [2, 181], 143: [2, 181], 154: [2, 181], 156: [2, 181], 157: [2, 181], 161: [2, 181], 174: [2, 181], 175: [2, 181], 180: [2, 181], 181: [2, 181], 184: [2, 181], 185: [2, 181], 186: [2, 181], 187: [2, 181], 188: [2, 181], 189: [2, 181], 190: [2, 181], 191: [2, 181], 192: [2, 181], 193: [2, 181], 194: [2, 181], 195: [2, 181], 196: [2, 181] }, { 1: [2, 184], 6: [2, 184], 31: [2, 184], 32: 582, 36: [1, 148], 38: [2, 184], 52: [2, 184], 59: [2, 184], 72: [2, 184], 76: [2, 184], 78: [2, 184], 92: [2, 184], 96: [2, 184], 114: [2, 184], 117: [2, 184], 118: [2, 184], 143: [2, 184], 154: [2, 184], 155: 114, 156: [2, 184], 157: [2, 184], 161: [2, 184], 174: [2, 184], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 280], 6: [2, 280], 31: [2, 280], 36: [2, 280], 38: [2, 280], 52: [2, 280], 59: [2, 280], 72: [2, 280], 76: [2, 280], 78: [2, 280], 92: [2, 280], 96: [2, 280], 114: [2, 280], 117: [2, 280], 118: [2, 280], 143: [2, 280], 154: [2, 280], 156: [2, 280], 157: [2, 280], 161: [2, 280], 174: [2, 280], 175: [2, 280], 180: [2, 280], 181: [2, 280], 184: [2, 280], 185: [2, 280], 186: [2, 280], 187: [2, 280], 188: [2, 280], 189: [2, 280], 190: [2, 280], 191: [2, 280], 192: [2, 280], 193: [2, 280], 194: [2, 280], 195: [2, 280], 196: [2, 280] }, { 1: [2, 32], 6: [2, 32], 31: [2, 32], 36: [2, 32], 38: [2, 32], 52: [2, 32], 59: [2, 32], 72: [2, 32], 76: [2, 32], 78: [2, 32], 92: [2, 32], 96: [2, 32], 114: [2, 32], 117: [2, 32], 118: [2, 32], 143: [2, 32], 154: [2, 32], 156: [2, 32], 157: [2, 32], 161: [2, 32], 174: [2, 32], 175: [2, 32], 180: [2, 32], 181: [2, 32], 184: [2, 32], 185: [2, 32], 186: [2, 32], 187: [2, 32], 188: [2, 32], 189: [2, 32], 190: [2, 32], 191: [2, 32], 192: [2, 32], 193: [2, 32], 194: [2, 32], 195: [2, 32], 196: [2, 32] }, { 6: [2, 106], 31: [1, 583], 36: [2, 106], 38: [2, 106], 59: [1, 309], 76: [2, 106], 100: 310, 117: [2, 106] }, { 1: [2, 98], 6: [2, 98], 31: [2, 98], 36: [2, 98], 38: [2, 98], 52: [2, 98], 59: [2, 98], 76: [2, 98], 154: [2, 98], 156: [2, 98], 157: [2, 98], 174: [2, 98], 175: [2, 98] }, { 1: [2, 187], 6: [2, 187], 31: [2, 187], 36: [2, 187], 38: [2, 187], 52: [2, 187], 59: [2, 187], 76: [2, 187], 154: [2, 187], 156: [2, 187], 157: [2, 187], 174: [2, 187], 175: [2, 187] }, { 39: [1, 584] }, { 28: 354, 36: [1, 353], 40: [1, 93], 126: 585, 127: 352, 129: [1, 355] }, { 1: [2, 188], 6: [2, 188], 31: [2, 188], 36: [2, 188], 38: [2, 188], 52: [2, 188], 59: [2, 188], 76: [2, 188], 154: [2, 188], 156: [2, 188], 157: [2, 188], 174: [2, 188], 175: [2, 188] }, { 45: 586, 46: [1, 94], 47: [1, 95] }, { 6: [1, 588], 36: [1, 589], 117: [1, 587] }, { 6: [2, 107], 28: 354, 31: [2, 107], 36: [2, 107], 38: [2, 107], 40: [1, 93], 76: [2, 107], 117: [2, 107], 127: 590, 129: [1, 355] }, { 6: [2, 106], 31: [2, 106], 36: [2, 106], 38: [2, 106], 59: [1, 481], 76: [2, 106], 100: 591, 117: [2, 106] }, { 28: 592, 40: [1, 93] }, { 28: 593, 40: [1, 93] }, { 39: [2, 203] }, { 45: 594, 46: [1, 94], 47: [1, 95] }, { 6: [1, 596], 36: [1, 597], 117: [1, 595] }, { 6: [2, 107], 28: 361, 31: [2, 107], 36: [2, 107], 38: [2, 107], 40: [1, 93], 76: [2, 107], 117: [2, 107], 129: [1, 362], 134: 598 }, { 6: [2, 106], 31: [2, 106], 36: [2, 106], 38: [2, 106], 59: [1, 488], 76: [2, 106], 100: 599, 117: [2, 106] }, { 28: 600, 40: [1, 93], 129: [1, 601] }, { 28: 602, 40: [1, 93] }, { 1: [2, 208], 6: [2, 208], 31: [2, 208], 36: [2, 208], 38: [2, 208], 52: [2, 208], 59: [2, 208], 76: [2, 208], 114: [1, 115], 154: [2, 208], 155: 114, 156: [2, 208], 157: [2, 208], 174: [2, 208], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 7: 603, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 604, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 38: [1, 605] }, { 1: [2, 213], 6: [2, 213], 31: [2, 213], 36: [2, 213], 38: [2, 213], 52: [2, 213], 59: [2, 213], 76: [2, 213], 154: [2, 213], 156: [2, 213], 157: [2, 213], 174: [2, 213], 175: [2, 213] }, { 154: [1, 606] }, { 76: [1, 607], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 240], 6: [2, 240], 29: [2, 240], 31: [2, 240], 36: [2, 240], 38: [2, 240], 46: [2, 240], 47: [2, 240], 52: [2, 240], 59: [2, 240], 68: [2, 240], 72: [2, 240], 76: [2, 240], 78: [2, 240], 87: [2, 240], 88: [2, 240], 89: [2, 240], 90: [2, 240], 91: [2, 240], 92: [2, 240], 93: [2, 240], 96: [2, 240], 107: [2, 240], 114: [2, 240], 116: [2, 240], 117: [2, 240], 118: [2, 240], 135: [2, 240], 136: [2, 240], 143: [2, 240], 154: [2, 240], 156: [2, 240], 157: [2, 240], 160: [2, 240], 161: [2, 240], 162: [2, 240], 174: [2, 240], 175: [2, 240], 180: [2, 240], 181: [2, 240], 184: [2, 240], 185: [2, 240], 186: [2, 240], 187: [2, 240], 188: [2, 240], 189: [2, 240], 190: [2, 240], 191: [2, 240], 192: [2, 240], 193: [2, 240], 194: [2, 240], 195: [2, 240], 196: [2, 240] }, { 7: 313, 8: 222, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 33: 20, 34: 21, 35: [1, 55], 36: [1, 219], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 59: [1, 220], 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 78: [1, 224], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 104: 223, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 139: 378, 140: 608, 144: 221, 145: 218, 146: 217, 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 6: [2, 258], 36: [2, 258], 38: [2, 258], 59: [2, 258], 76: [2, 258] }, { 7: 313, 8: 222, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 33: 20, 34: 21, 35: [1, 55], 36: [2, 265], 37: 62, 38: [2, 265], 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 59: [1, 220], 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 76: [2, 265], 77: [1, 76], 78: [1, 224], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 104: 223, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 144: 372, 146: 371, 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 313, 8: 222, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 33: 20, 34: 21, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 59: [1, 220], 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 78: [1, 224], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 104: 223, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 139: 378, 144: 221, 145: 609, 146: 217, 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 36: [1, 500], 38: [1, 610] }, { 1: [2, 164], 6: [2, 164], 29: [2, 164], 31: [2, 164], 36: [2, 164], 38: [2, 164], 46: [2, 164], 47: [2, 164], 52: [2, 164], 59: [2, 164], 72: [2, 164], 76: [2, 164], 78: [2, 164], 87: [2, 164], 88: [2, 164], 89: [2, 164], 90: [2, 164], 91: [2, 164], 92: [2, 164], 93: [2, 164], 96: [2, 164], 107: [2, 164], 114: [2, 164], 117: [2, 164], 118: [2, 164], 135: [2, 164], 136: [2, 164], 143: [2, 164], 154: [2, 164], 156: [2, 164], 157: [2, 164], 161: [2, 164], 174: [2, 164], 175: [2, 164], 180: [2, 164], 181: [2, 164], 184: [2, 164], 185: [2, 164], 186: [2, 164], 187: [2, 164], 188: [2, 164], 189: [2, 164], 190: [2, 164], 191: [2, 164], 192: [2, 164], 193: [2, 164], 194: [2, 164], 195: [2, 164], 196: [2, 164] }, { 38: [1, 611], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 6: [1, 613], 31: [1, 612], 36: [1, 614] }, { 6: [2, 107], 7: 313, 8: 222, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 31: [2, 107], 33: 20, 34: 21, 35: [1, 55], 36: [2, 107], 37: 62, 38: [2, 107], 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 76: [2, 107], 77: [1, 76], 78: [1, 224], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 104: 223, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 117: [2, 107], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 144: 615, 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 6: [2, 106], 31: [2, 106], 36: [2, 106], 38: [2, 106], 59: [1, 508], 76: [2, 106], 100: 616, 117: [2, 106] }, { 32: 617, 36: [1, 148] }, { 1: [2, 284], 6: [2, 284], 31: [2, 284], 36: [2, 284], 38: [2, 284], 52: [2, 284], 59: [2, 284], 72: [2, 284], 76: [2, 284], 78: [2, 284], 92: [2, 284], 96: [2, 284], 114: [2, 284], 117: [2, 284], 118: [2, 284], 143: [2, 284], 154: [2, 284], 155: 114, 156: [2, 284], 157: [2, 284], 161: [2, 284], 174: [2, 284], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 286], 6: [2, 286], 31: [2, 286], 36: [2, 286], 38: [2, 286], 52: [2, 286], 59: [2, 286], 72: [2, 286], 76: [2, 286], 78: [2, 286], 92: [2, 286], 96: [2, 286], 114: [2, 286], 117: [2, 286], 118: [2, 286], 143: [2, 286], 154: [2, 286], 155: 114, 156: [2, 286], 157: [2, 286], 161: [2, 286], 174: [2, 286], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 6: [2, 65], 36: [2, 65], 38: [2, 65], 59: [2, 65], 114: [1, 618], 117: [2, 65], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 7: 619, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 172], 6: [2, 172], 29: [2, 172], 31: [2, 172], 36: [2, 172], 38: [2, 172], 46: [2, 172], 47: [2, 172], 52: [2, 172], 59: [2, 172], 68: [2, 172], 72: [2, 172], 76: [2, 172], 78: [2, 172], 87: [2, 172], 88: [2, 172], 89: [2, 172], 90: [2, 172], 91: [2, 172], 92: [2, 172], 93: [2, 172], 96: [2, 172], 107: [2, 172], 114: [2, 172], 116: [2, 172], 117: [2, 172], 118: [2, 172], 135: [2, 172], 136: [2, 172], 143: [2, 172], 154: [2, 172], 156: [2, 172], 157: [2, 172], 160: [2, 172], 161: [2, 172], 162: [2, 172], 174: [2, 172], 175: [2, 172], 180: [2, 172], 181: [2, 172], 184: [2, 172], 185: [2, 172], 186: [2, 172], 187: [2, 172], 188: [2, 172], 189: [2, 172], 190: [2, 172], 191: [2, 172], 192: [2, 172], 193: [2, 172], 194: [2, 172], 195: [2, 172], 196: [2, 172] }, { 28: 247, 40: [1, 93], 41: 248, 42: [1, 231], 43: 245, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 69: 620, 70: 519, 71: 250, 73: 242, 74: 249, 75: [1, 243], 77: [1, 244], 78: [1, 251] }, { 6: [2, 173], 28: 247, 36: [2, 173], 38: [2, 173], 40: [1, 93], 41: 248, 42: [1, 231], 43: 245, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 59: [2, 173], 69: 246, 70: 519, 71: 250, 73: 242, 74: 249, 75: [1, 243], 77: [1, 244], 78: [1, 251], 117: [2, 173], 120: 621 }, { 6: [2, 175], 36: [2, 175], 38: [2, 175], 59: [2, 175], 117: [2, 175] }, { 6: [2, 63], 36: [2, 63], 38: [2, 63], 59: [2, 63], 72: [1, 622], 117: [2, 63] }, { 6: [2, 67], 36: [2, 67], 38: [2, 67], 59: [2, 67], 114: [1, 115], 117: [2, 67], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 7: 623, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 6: [2, 73], 36: [2, 73], 38: [2, 73], 59: [2, 73], 72: [2, 73], 117: [2, 73] }, { 76: [1, 624], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 29: [1, 229], 85: 625 }, { 29: [1, 229], 85: 626 }, { 41: 627, 42: [1, 231] }, { 41: 628, 42: [1, 231] }, { 6: [2, 91], 29: [2, 91], 36: [2, 91], 38: [2, 91], 41: 629, 42: [1, 231], 59: [2, 91], 87: [2, 91], 88: [2, 91], 89: [2, 91], 90: [2, 91], 91: [2, 91], 93: [2, 91], 117: [2, 91], 136: [2, 91] }, { 6: [2, 92], 29: [2, 92], 36: [2, 92], 38: [2, 92], 41: 630, 42: [1, 231], 59: [2, 92], 87: [2, 92], 88: [2, 92], 89: [2, 92], 90: [2, 92], 91: [2, 92], 93: [2, 92], 117: [2, 92], 136: [2, 92] }, { 7: 631, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 36: [1, 632], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 91: [1, 633] }, { 29: [1, 229], 85: 634 }, { 6: [2, 84], 29: [2, 84], 36: [2, 84], 38: [2, 84], 59: [2, 84], 87: [2, 84], 88: [2, 84], 89: [2, 84], 90: [2, 84], 91: [2, 84], 93: [2, 84], 117: [2, 84], 136: [2, 84] }, { 46: [2, 44], 47: [2, 44], 49: [2, 44], 51: [2, 44] }, { 6: [1, 96], 38: [1, 635] }, { 1: [2, 376], 6: [2, 376], 31: [2, 376], 36: [2, 376], 38: [2, 376], 52: [2, 376], 59: [2, 376], 72: [2, 376], 76: [2, 376], 78: [2, 376], 92: [2, 376], 96: [2, 376], 114: [2, 376], 117: [2, 376], 118: [2, 376], 143: [2, 376], 154: [2, 376], 155: 114, 156: [2, 376], 157: [2, 376], 161: [2, 376], 174: [2, 376], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 308], 6: [2, 308], 31: [2, 308], 36: [2, 308], 38: [2, 308], 52: [2, 308], 59: [2, 308], 72: [2, 308], 76: [2, 308], 78: [2, 308], 92: [2, 308], 96: [2, 308], 114: [2, 308], 117: [2, 308], 118: [1, 636], 143: [2, 308], 154: [2, 308], 155: 114, 156: [2, 308], 157: [2, 308], 161: [1, 637], 174: [2, 308], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 313], 6: [2, 313], 31: [2, 313], 36: [2, 313], 38: [2, 313], 52: [2, 313], 59: [2, 313], 72: [2, 313], 76: [2, 313], 78: [2, 313], 92: [2, 313], 96: [2, 313], 114: [2, 313], 117: [2, 313], 118: [1, 638], 143: [2, 313], 154: [2, 313], 155: 114, 156: [2, 313], 157: [2, 313], 161: [2, 313], 174: [2, 313], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 317], 6: [2, 317], 31: [2, 317], 36: [2, 317], 38: [2, 317], 52: [2, 317], 59: [2, 317], 72: [2, 317], 76: [2, 317], 78: [2, 317], 92: [2, 317], 96: [2, 317], 114: [2, 317], 117: [2, 317], 118: [1, 639], 143: [2, 317], 154: [2, 317], 155: 114, 156: [2, 317], 157: [2, 317], 161: [2, 317], 174: [2, 317], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 7: 640, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 641, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 322], 6: [2, 322], 31: [2, 322], 36: [2, 322], 38: [2, 322], 52: [2, 322], 59: [2, 322], 72: [2, 322], 76: [2, 322], 78: [2, 322], 92: [2, 322], 96: [2, 322], 114: [2, 322], 117: [2, 322], 118: [2, 322], 143: [2, 322], 154: [2, 322], 155: 114, 156: [2, 322], 157: [2, 322], 161: [2, 322], 174: [2, 322], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 38: [2, 244], 92: [2, 244], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 92: [1, 642] }, { 92: [1, 643] }, { 92: [2, 50], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 135], 6: [2, 135], 29: [2, 135], 31: [2, 135], 36: [2, 135], 38: [2, 135], 46: [2, 135], 47: [2, 135], 52: [2, 135], 59: [2, 135], 68: [2, 135], 72: [2, 135], 76: [2, 135], 78: [2, 135], 87: [2, 135], 88: [2, 135], 89: [2, 135], 90: [2, 135], 91: [2, 135], 92: [2, 135], 93: [2, 135], 96: [2, 135], 107: [2, 135], 114: [2, 135], 117: [2, 135], 118: [2, 135], 122: [2, 135], 135: [2, 135], 136: [2, 135], 143: [2, 135], 154: [2, 135], 156: [2, 135], 157: [2, 135], 161: [2, 135], 174: [2, 135], 175: [2, 135], 180: [2, 135], 181: [2, 135], 182: [2, 135], 183: [2, 135], 184: [2, 135], 185: [2, 135], 186: [2, 135], 187: [2, 135], 188: [2, 135], 189: [2, 135], 190: [2, 135], 191: [2, 135], 192: [2, 135], 193: [2, 135], 194: [2, 135], 195: [2, 135], 196: [2, 135], 197: [2, 135] }, { 38: [1, 644], 78: [1, 295], 114: [1, 115], 142: 422, 143: [1, 294], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 38: [1, 645] }, { 1: [2, 137], 6: [2, 137], 29: [2, 137], 31: [2, 137], 36: [2, 137], 38: [2, 137], 46: [2, 137], 47: [2, 137], 52: [2, 137], 59: [2, 137], 68: [2, 137], 72: [2, 137], 76: [2, 137], 78: [2, 137], 87: [2, 137], 88: [2, 137], 89: [2, 137], 90: [2, 137], 91: [2, 137], 92: [2, 137], 93: [2, 137], 96: [2, 137], 107: [2, 137], 114: [2, 137], 117: [2, 137], 118: [2, 137], 122: [2, 137], 135: [2, 137], 136: [2, 137], 143: [2, 137], 154: [2, 137], 156: [2, 137], 157: [2, 137], 161: [2, 137], 174: [2, 137], 175: [2, 137], 180: [2, 137], 181: [2, 137], 182: [2, 137], 183: [2, 137], 184: [2, 137], 185: [2, 137], 186: [2, 137], 187: [2, 137], 188: [2, 137], 189: [2, 137], 190: [2, 137], 191: [2, 137], 192: [2, 137], 193: [2, 137], 194: [2, 137], 195: [2, 137], 196: [2, 137], 197: [2, 137] }, { 1: [2, 139], 6: [2, 139], 29: [2, 139], 31: [2, 139], 36: [2, 139], 38: [2, 139], 46: [2, 139], 47: [2, 139], 52: [2, 139], 59: [2, 139], 68: [2, 139], 72: [2, 139], 76: [2, 139], 78: [2, 139], 87: [2, 139], 88: [2, 139], 89: [2, 139], 90: [2, 139], 91: [2, 139], 92: [2, 139], 93: [2, 139], 96: [2, 139], 107: [2, 139], 114: [2, 139], 117: [2, 139], 118: [2, 139], 122: [2, 139], 135: [2, 139], 136: [2, 139], 143: [2, 139], 154: [2, 139], 156: [2, 139], 157: [2, 139], 161: [2, 139], 174: [2, 139], 175: [2, 139], 180: [2, 139], 181: [2, 139], 182: [2, 139], 183: [2, 139], 184: [2, 139], 185: [2, 139], 186: [2, 139], 187: [2, 139], 188: [2, 139], 189: [2, 139], 190: [2, 139], 191: [2, 139], 192: [2, 139], 193: [2, 139], 194: [2, 139], 195: [2, 139], 196: [2, 139], 197: [2, 139] }, { 38: [1, 646], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 92: [1, 647] }, { 1: [2, 149], 6: [2, 149], 29: [2, 149], 31: [2, 149], 36: [2, 149], 38: [2, 149], 46: [2, 149], 47: [2, 149], 52: [2, 149], 59: [2, 149], 68: [2, 149], 72: [2, 149], 76: [2, 149], 78: [2, 149], 87: [2, 149], 88: [2, 149], 89: [2, 149], 90: [2, 149], 91: [2, 149], 92: [2, 149], 93: [2, 149], 96: [2, 149], 107: [2, 149], 114: [2, 149], 117: [2, 149], 118: [2, 149], 122: [2, 149], 135: [2, 149], 136: [2, 149], 143: [2, 149], 154: [2, 149], 156: [2, 149], 157: [2, 149], 161: [2, 149], 174: [2, 149], 175: [2, 149], 180: [2, 149], 181: [2, 149], 182: [2, 149], 183: [2, 149], 184: [2, 149], 185: [2, 149], 186: [2, 149], 187: [2, 149], 188: [2, 149], 189: [2, 149], 190: [2, 149], 191: [2, 149], 192: [2, 149], 193: [2, 149], 194: [2, 149], 195: [2, 149], 196: [2, 149], 197: [2, 149] }, { 38: [1, 648], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 62], 6: [2, 62], 31: [2, 62], 36: [2, 62], 38: [2, 62], 52: [2, 62], 59: [2, 62], 72: [2, 62], 76: [2, 62], 78: [2, 62], 92: [2, 62], 96: [2, 62], 114: [2, 62], 117: [2, 62], 118: [2, 62], 143: [2, 62], 154: [2, 62], 156: [2, 62], 157: [2, 62], 161: [2, 62], 174: [2, 62], 175: [2, 62], 180: [2, 62], 181: [2, 62], 184: [2, 62], 185: [2, 62], 186: [2, 62], 187: [2, 62], 188: [2, 62], 189: [2, 62], 190: [2, 62], 191: [2, 62], 192: [2, 62], 193: [2, 62], 194: [2, 62], 195: [2, 62], 196: [2, 62] }, { 1: [2, 100], 6: [2, 100], 29: [2, 100], 31: [2, 100], 36: [2, 100], 38: [2, 100], 46: [2, 100], 47: [2, 100], 52: [2, 100], 59: [2, 100], 72: [2, 100], 76: [2, 100], 78: [2, 100], 87: [2, 100], 88: [2, 100], 89: [2, 100], 90: [2, 100], 91: [2, 100], 92: [2, 100], 93: [2, 100], 96: [2, 100], 107: [2, 100], 114: [2, 100], 117: [2, 100], 118: [2, 100], 135: [2, 100], 136: [2, 100], 143: [2, 100], 154: [2, 100], 156: [2, 100], 157: [2, 100], 161: [2, 100], 174: [2, 100], 175: [2, 100], 180: [2, 100], 181: [2, 100], 184: [2, 100], 185: [2, 100], 186: [2, 100], 187: [2, 100], 188: [2, 100], 189: [2, 100], 190: [2, 100], 191: [2, 100], 192: [2, 100], 193: [2, 100], 194: [2, 100], 195: [2, 100], 196: [2, 100] }, { 1: [2, 102], 6: [2, 102], 31: [2, 102], 36: [2, 102], 38: [2, 102], 52: [2, 102], 59: [2, 102], 76: [2, 102], 154: [2, 102] }, { 6: [2, 111], 31: [2, 111], 36: [2, 111], 38: [2, 111], 59: [2, 111], 96: [2, 111] }, { 6: [2, 106], 31: [2, 106], 36: [2, 106], 38: [2, 106], 59: [1, 309], 76: [2, 106], 100: 649, 117: [2, 106] }, { 32: 557, 36: [1, 148] }, { 1: [2, 378], 6: [2, 378], 31: [2, 378], 36: [2, 378], 38: [2, 378], 52: [2, 378], 59: [2, 378], 72: [2, 378], 76: [2, 378], 78: [2, 378], 92: [2, 378], 96: [2, 378], 114: [2, 378], 117: [2, 378], 118: [2, 378], 143: [2, 378], 154: [2, 378], 156: [2, 378], 157: [2, 378], 161: [2, 378], 174: [2, 378], 175: [2, 378], 180: [2, 378], 181: [2, 378], 184: [2, 378], 185: [2, 378], 186: [2, 378], 187: [2, 378], 188: [2, 378], 189: [2, 378], 190: [2, 378], 191: [2, 378], 192: [2, 378], 193: [2, 378], 194: [2, 378], 195: [2, 378], 196: [2, 378] }, { 1: [2, 338], 6: [2, 338], 31: [2, 338], 36: [2, 338], 38: [2, 338], 52: [2, 338], 59: [2, 338], 72: [2, 338], 76: [2, 338], 78: [2, 338], 92: [2, 338], 96: [2, 338], 114: [2, 338], 117: [2, 338], 118: [2, 338], 143: [2, 338], 154: [2, 338], 156: [2, 338], 157: [2, 338], 161: [2, 338], 167: [2, 338], 174: [2, 338], 175: [2, 338], 180: [2, 338], 181: [2, 338], 184: [2, 338], 185: [2, 338], 186: [2, 338], 187: [2, 338], 188: [2, 338], 189: [2, 338], 190: [2, 338], 191: [2, 338], 192: [2, 338], 193: [2, 338], 194: [2, 338], 195: [2, 338], 196: [2, 338] }, { 1: [2, 275], 6: [2, 275], 31: [2, 275], 36: [2, 275], 38: [2, 275], 52: [2, 275], 59: [2, 275], 72: [2, 275], 76: [2, 275], 78: [2, 275], 92: [2, 275], 96: [2, 275], 114: [2, 275], 117: [2, 275], 118: [2, 275], 143: [2, 275], 154: [2, 275], 156: [2, 275], 157: [2, 275], 161: [2, 275], 174: [2, 275], 175: [2, 275], 180: [2, 275], 181: [2, 275], 184: [2, 275], 185: [2, 275], 186: [2, 275], 187: [2, 275], 188: [2, 275], 189: [2, 275], 190: [2, 275], 191: [2, 275], 192: [2, 275], 193: [2, 275], 194: [2, 275], 195: [2, 275], 196: [2, 275] }, { 1: [2, 276], 6: [2, 276], 31: [2, 276], 36: [2, 276], 38: [2, 276], 52: [2, 276], 59: [2, 276], 72: [2, 276], 76: [2, 276], 78: [2, 276], 92: [2, 276], 96: [2, 276], 114: [2, 276], 117: [2, 276], 118: [2, 276], 143: [2, 276], 150: [2, 276], 154: [2, 276], 156: [2, 276], 157: [2, 276], 161: [2, 276], 174: [2, 276], 175: [2, 276], 180: [2, 276], 181: [2, 276], 184: [2, 276], 185: [2, 276], 186: [2, 276], 187: [2, 276], 188: [2, 276], 189: [2, 276], 190: [2, 276], 191: [2, 276], 192: [2, 276], 193: [2, 276], 194: [2, 276], 195: [2, 276], 196: [2, 276] }, { 1: [2, 277], 6: [2, 277], 31: [2, 277], 36: [2, 277], 38: [2, 277], 52: [2, 277], 59: [2, 277], 72: [2, 277], 76: [2, 277], 78: [2, 277], 92: [2, 277], 96: [2, 277], 114: [2, 277], 117: [2, 277], 118: [2, 277], 143: [2, 277], 150: [2, 277], 154: [2, 277], 156: [2, 277], 157: [2, 277], 161: [2, 277], 174: [2, 277], 175: [2, 277], 180: [2, 277], 181: [2, 277], 184: [2, 277], 185: [2, 277], 186: [2, 277], 187: [2, 277], 188: [2, 277], 189: [2, 277], 190: [2, 277], 191: [2, 277], 192: [2, 277], 193: [2, 277], 194: [2, 277], 195: [2, 277], 196: [2, 277] }, { 1: [2, 293], 6: [2, 293], 31: [2, 293], 36: [2, 293], 38: [2, 293], 52: [2, 293], 59: [2, 293], 72: [2, 293], 76: [2, 293], 78: [2, 293], 92: [2, 293], 96: [2, 293], 114: [2, 293], 117: [2, 293], 118: [2, 293], 143: [2, 293], 154: [2, 293], 156: [2, 293], 157: [2, 293], 161: [2, 293], 174: [2, 293], 175: [2, 293], 180: [2, 293], 181: [2, 293], 184: [2, 293], 185: [2, 293], 186: [2, 293], 187: [2, 293], 188: [2, 293], 189: [2, 293], 190: [2, 293], 191: [2, 293], 192: [2, 293], 193: [2, 293], 194: [2, 293], 195: [2, 293], 196: [2, 293] }, { 7: 650, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 651, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 298], 6: [2, 298], 31: [2, 298], 36: [2, 298], 38: [2, 298], 52: [2, 298], 59: [2, 298], 72: [2, 298], 76: [2, 298], 78: [2, 298], 92: [2, 298], 96: [2, 298], 114: [2, 298], 117: [2, 298], 118: [2, 298], 143: [2, 298], 154: [2, 298], 156: [2, 298], 157: [2, 298], 161: [2, 298], 174: [2, 298], 175: [2, 298], 180: [2, 298], 181: [2, 298], 184: [2, 298], 185: [2, 298], 186: [2, 298], 187: [2, 298], 188: [2, 298], 189: [2, 298], 190: [2, 298], 191: [2, 298], 192: [2, 298], 193: [2, 298], 194: [2, 298], 195: [2, 298], 196: [2, 298] }, { 7: 652, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 302], 6: [2, 302], 31: [2, 302], 36: [2, 302], 38: [2, 302], 52: [2, 302], 59: [2, 302], 72: [2, 302], 76: [2, 302], 78: [2, 302], 92: [2, 302], 96: [2, 302], 114: [2, 302], 117: [2, 302], 118: [2, 302], 143: [2, 302], 154: [2, 302], 156: [2, 302], 157: [2, 302], 161: [2, 302], 174: [2, 302], 175: [2, 302], 180: [2, 302], 181: [2, 302], 184: [2, 302], 185: [2, 302], 186: [2, 302], 187: [2, 302], 188: [2, 302], 189: [2, 302], 190: [2, 302], 191: [2, 302], 192: [2, 302], 193: [2, 302], 194: [2, 302], 195: [2, 302], 196: [2, 302] }, { 7: 653, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 32: 654, 36: [1, 148], 114: [1, 115], 118: [1, 655], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 32: 656, 36: [1, 148], 114: [1, 115], 118: [1, 657], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 307], 6: [2, 307], 31: [2, 307], 36: [2, 307], 38: [2, 307], 52: [2, 307], 59: [2, 307], 72: [2, 307], 76: [2, 307], 78: [2, 307], 92: [2, 307], 96: [2, 307], 114: [2, 307], 117: [2, 307], 118: [2, 307], 143: [2, 307], 154: [2, 307], 156: [2, 307], 157: [2, 307], 161: [2, 307], 174: [2, 307], 175: [2, 307], 180: [2, 307], 181: [2, 307], 184: [2, 307], 185: [2, 307], 186: [2, 307], 187: [2, 307], 188: [2, 307], 189: [2, 307], 190: [2, 307], 191: [2, 307], 192: [2, 307], 193: [2, 307], 194: [2, 307], 195: [2, 307], 196: [2, 307] }, { 1: [2, 329], 6: [2, 329], 31: [2, 329], 36: [2, 329], 38: [2, 329], 52: [2, 329], 59: [2, 329], 72: [2, 329], 76: [2, 329], 78: [2, 329], 92: [2, 329], 96: [2, 329], 114: [2, 329], 117: [2, 329], 118: [2, 329], 143: [2, 329], 154: [2, 329], 156: [2, 329], 157: [2, 329], 161: [2, 329], 174: [2, 329], 175: [2, 329], 180: [2, 329], 181: [2, 329], 184: [2, 329], 185: [2, 329], 186: [2, 329], 187: [2, 329], 188: [2, 329], 189: [2, 329], 190: [2, 329], 191: [2, 329], 192: [2, 329], 193: [2, 329], 194: [2, 329], 195: [2, 329], 196: [2, 329] }, { 32: 658, 36: [1, 148] }, { 38: [1, 659] }, { 6: [1, 660], 38: [2, 335], 167: [2, 335], 169: [2, 335] }, { 7: 661, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 185], 6: [2, 185], 31: [2, 185], 36: [2, 185], 38: [2, 185], 52: [2, 185], 59: [2, 185], 72: [2, 185], 76: [2, 185], 78: [2, 185], 92: [2, 185], 96: [2, 185], 114: [2, 185], 117: [2, 185], 118: [2, 185], 143: [2, 185], 154: [2, 185], 156: [2, 185], 157: [2, 185], 161: [2, 185], 174: [2, 185], 175: [2, 185], 180: [2, 185], 181: [2, 185], 184: [2, 185], 185: [2, 185], 186: [2, 185], 187: [2, 185], 188: [2, 185], 189: [2, 185], 190: [2, 185], 191: [2, 185], 192: [2, 185], 193: [2, 185], 194: [2, 185], 195: [2, 185], 196: [2, 185] }, { 32: 662, 36: [1, 148] }, { 45: 663, 46: [1, 94], 47: [1, 95] }, { 6: [2, 106], 31: [2, 106], 36: [2, 106], 38: [2, 106], 59: [1, 481], 76: [2, 106], 100: 664, 117: [2, 106] }, { 1: [2, 189], 6: [2, 189], 31: [2, 189], 36: [2, 189], 38: [2, 189], 52: [2, 189], 59: [2, 189], 76: [2, 189], 154: [2, 189], 156: [2, 189], 157: [2, 189], 174: [2, 189], 175: [2, 189] }, { 39: [1, 665] }, { 28: 354, 40: [1, 93], 127: 666, 129: [1, 355] }, { 28: 354, 36: [1, 353], 40: [1, 93], 126: 667, 127: 352, 129: [1, 355] }, { 6: [2, 194], 36: [2, 194], 38: [2, 194], 59: [2, 194], 117: [2, 194] }, { 6: [1, 588], 36: [1, 589], 38: [1, 668] }, { 6: [2, 199], 36: [2, 199], 38: [2, 199], 59: [2, 199], 117: [2, 199] }, { 6: [2, 201], 36: [2, 201], 38: [2, 201], 59: [2, 201], 117: [2, 201] }, { 1: [2, 214], 6: [2, 214], 31: [2, 214], 36: [2, 214], 38: [2, 214], 52: [2, 214], 59: [2, 214], 76: [2, 214], 154: [2, 214], 156: [2, 214], 157: [2, 214], 174: [2, 214], 175: [2, 214] }, { 1: [2, 205], 6: [2, 205], 31: [2, 205], 36: [2, 205], 38: [2, 205], 39: [1, 669], 52: [2, 205], 59: [2, 205], 76: [2, 205], 154: [2, 205], 156: [2, 205], 157: [2, 205], 174: [2, 205], 175: [2, 205] }, { 28: 361, 40: [1, 93], 129: [1, 362], 134: 670 }, { 28: 361, 36: [1, 360], 40: [1, 93], 129: [1, 362], 132: 671, 134: 359 }, { 6: [2, 217], 36: [2, 217], 38: [2, 217], 59: [2, 217], 117: [2, 217] }, { 6: [1, 596], 36: [1, 597], 38: [1, 672] }, { 6: [2, 222], 36: [2, 222], 38: [2, 222], 59: [2, 222], 117: [2, 222] }, { 6: [2, 223], 36: [2, 223], 38: [2, 223], 59: [2, 223], 117: [2, 223] }, { 6: [2, 225], 36: [2, 225], 38: [2, 225], 59: [2, 225], 117: [2, 225] }, { 1: [2, 209], 6: [2, 209], 31: [2, 209], 36: [2, 209], 38: [2, 209], 52: [2, 209], 59: [2, 209], 76: [2, 209], 114: [1, 115], 154: [2, 209], 155: 114, 156: [2, 209], 157: [2, 209], 174: [2, 209], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 38: [1, 673], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 212], 6: [2, 212], 31: [2, 212], 36: [2, 212], 38: [2, 212], 52: [2, 212], 59: [2, 212], 76: [2, 212], 154: [2, 212], 156: [2, 212], 157: [2, 212], 174: [2, 212], 175: [2, 212] }, { 1: [2, 282], 6: [2, 282], 29: [2, 282], 31: [2, 282], 36: [2, 282], 38: [2, 282], 46: [2, 282], 47: [2, 282], 52: [2, 282], 59: [2, 282], 72: [2, 282], 76: [2, 282], 78: [2, 282], 87: [2, 282], 88: [2, 282], 89: [2, 282], 90: [2, 282], 91: [2, 282], 92: [2, 282], 93: [2, 282], 96: [2, 282], 107: [2, 282], 114: [2, 282], 117: [2, 282], 118: [2, 282], 135: [2, 282], 136: [2, 282], 143: [2, 282], 154: [2, 282], 156: [2, 282], 157: [2, 282], 161: [2, 282], 174: [2, 282], 175: [2, 282], 180: [2, 282], 181: [2, 282], 184: [2, 282], 185: [2, 282], 186: [2, 282], 187: [2, 282], 188: [2, 282], 189: [2, 282], 190: [2, 282], 191: [2, 282], 192: [2, 282], 193: [2, 282], 194: [2, 282], 195: [2, 282], 196: [2, 282] }, { 1: [2, 243], 6: [2, 243], 29: [2, 243], 31: [2, 243], 36: [2, 243], 38: [2, 243], 46: [2, 243], 47: [2, 243], 52: [2, 243], 59: [2, 243], 72: [2, 243], 76: [2, 243], 78: [2, 243], 87: [2, 243], 88: [2, 243], 89: [2, 243], 90: [2, 243], 91: [2, 243], 92: [2, 243], 93: [2, 243], 96: [2, 243], 107: [2, 243], 114: [2, 243], 117: [2, 243], 118: [2, 243], 135: [2, 243], 136: [2, 243], 143: [2, 243], 154: [2, 243], 156: [2, 243], 157: [2, 243], 161: [2, 243], 174: [2, 243], 175: [2, 243], 180: [2, 243], 181: [2, 243], 184: [2, 243], 185: [2, 243], 186: [2, 243], 187: [2, 243], 188: [2, 243], 189: [2, 243], 190: [2, 243], 191: [2, 243], 192: [2, 243], 193: [2, 243], 194: [2, 243], 195: [2, 243], 196: [2, 243] }, { 6: [2, 106], 31: [2, 106], 36: [2, 106], 38: [2, 106], 59: [1, 374], 76: [2, 106], 100: 375, 117: [2, 106], 141: 674 }, { 6: [2, 259], 36: [2, 259], 38: [2, 259], 59: [2, 259], 76: [2, 259] }, { 6: [2, 260], 36: [2, 260], 38: [2, 260], 59: [2, 260], 76: [2, 260] }, { 92: [1, 675] }, { 1: [2, 234], 6: [2, 234], 29: [2, 234], 31: [2, 234], 36: [2, 234], 38: [2, 234], 46: [2, 234], 47: [2, 234], 52: [2, 234], 57: [2, 234], 59: [2, 234], 72: [2, 234], 76: [2, 234], 78: [2, 234], 87: [2, 234], 88: [2, 234], 89: [2, 234], 90: [2, 234], 91: [2, 234], 92: [2, 234], 93: [2, 234], 96: [2, 234], 107: [2, 234], 114: [2, 234], 117: [2, 234], 118: [2, 234], 135: [2, 234], 136: [2, 234], 143: [2, 234], 154: [2, 234], 156: [2, 234], 157: [2, 234], 161: [2, 234], 174: [2, 234], 175: [2, 234], 180: [2, 234], 181: [2, 234], 184: [2, 234], 185: [2, 234], 186: [2, 234], 187: [2, 234], 188: [2, 234], 189: [2, 234], 190: [2, 234], 191: [2, 234], 192: [2, 234], 193: [2, 234], 194: [2, 234], 195: [2, 234], 196: [2, 234] }, { 7: 313, 8: 222, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 33: 20, 34: 21, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 78: [1, 224], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 104: 223, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 144: 676, 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 313, 8: 222, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 33: 20, 34: 21, 35: [1, 55], 36: [1, 387], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 78: [1, 224], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 35], 97: 36, 98: [1, 79], 99: [1, 80], 103: 61, 104: 223, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 137: 677, 138: [1, 75], 144: 386, 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 37], 177: [1, 38], 178: [1, 57], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 6: [2, 249], 31: [2, 249], 36: [2, 249], 38: [2, 249], 59: [2, 249] }, { 6: [1, 613], 36: [1, 614], 38: [1, 678] }, { 1: [2, 340], 6: [2, 340], 31: [2, 340], 36: [2, 340], 38: [2, 340], 52: [2, 340], 59: [2, 340], 72: [2, 340], 76: [2, 340], 78: [2, 340], 92: [2, 340], 96: [2, 340], 114: [2, 340], 117: [2, 340], 118: [2, 340], 143: [2, 340], 154: [2, 340], 156: [2, 340], 157: [2, 340], 161: [2, 340], 174: [2, 340], 175: [2, 340], 180: [2, 340], 181: [2, 340], 184: [2, 340], 185: [2, 340], 186: [2, 340], 187: [2, 340], 188: [2, 340], 189: [2, 340], 190: [2, 340], 191: [2, 340], 192: [2, 340], 193: [2, 340], 194: [2, 340], 195: [2, 340], 196: [2, 340] }, { 28: 180, 37: 183, 40: [1, 93], 74: 181, 75: [1, 72], 77: [1, 144], 103: 182, 108: 278, 113: [1, 88], 115: 679, 119: [1, 680], 163: [1, 277], 164: 179 }, { 38: [1, 681], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 6: [2, 176], 36: [2, 176], 38: [2, 176], 59: [2, 176], 117: [2, 176] }, { 6: [2, 106], 31: [2, 106], 36: [2, 106], 38: [2, 106], 59: [1, 396], 76: [2, 106], 100: 682, 117: [2, 106] }, { 7: 683, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 36: [1, 514], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 38: [1, 684], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 6: [2, 74], 36: [2, 74], 38: [2, 74], 59: [2, 74], 72: [2, 74], 117: [2, 74] }, { 6: [2, 85], 29: [2, 85], 36: [2, 85], 38: [2, 85], 59: [2, 85], 87: [2, 85], 88: [2, 85], 89: [2, 85], 90: [2, 85], 91: [2, 85], 93: [2, 85], 117: [2, 85], 136: [2, 85] }, { 6: [2, 86], 29: [2, 86], 36: [2, 86], 38: [2, 86], 59: [2, 86], 87: [2, 86], 88: [2, 86], 89: [2, 86], 90: [2, 86], 91: [2, 86], 93: [2, 86], 117: [2, 86], 136: [2, 86] }, { 6: [2, 87], 29: [2, 87], 36: [2, 87], 38: [2, 87], 59: [2, 87], 87: [2, 87], 88: [2, 87], 89: [2, 87], 90: [2, 87], 91: [2, 87], 93: [2, 87], 117: [2, 87], 136: [2, 87] }, { 6: [2, 88], 29: [2, 88], 36: [2, 88], 38: [2, 88], 59: [2, 88], 87: [2, 88], 88: [2, 88], 89: [2, 88], 90: [2, 88], 91: [2, 88], 93: [2, 88], 117: [2, 88], 136: [2, 88] }, { 6: [2, 89], 29: [2, 89], 36: [2, 89], 38: [2, 89], 59: [2, 89], 87: [2, 89], 88: [2, 89], 89: [2, 89], 90: [2, 89], 91: [2, 89], 93: [2, 89], 117: [2, 89], 136: [2, 89] }, { 6: [2, 90], 29: [2, 90], 36: [2, 90], 38: [2, 90], 59: [2, 90], 87: [2, 90], 88: [2, 90], 89: [2, 90], 90: [2, 90], 91: [2, 90], 93: [2, 90], 117: [2, 90], 136: [2, 90] }, { 92: [1, 685], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 7: 686, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 687, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 36: [1, 688], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 6: [2, 83], 29: [2, 83], 36: [2, 83], 38: [2, 83], 59: [2, 83], 87: [2, 83], 88: [2, 83], 89: [2, 83], 90: [2, 83], 91: [2, 83], 93: [2, 83], 117: [2, 83], 136: [2, 83] }, { 52: [1, 689] }, { 7: 690, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 691, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 692, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 693, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 315], 6: [2, 315], 31: [2, 315], 36: [2, 315], 38: [2, 315], 52: [2, 315], 59: [2, 315], 72: [2, 315], 76: [2, 315], 78: [2, 315], 92: [2, 315], 96: [2, 315], 114: [2, 315], 117: [2, 315], 118: [1, 694], 143: [2, 315], 154: [2, 315], 155: 114, 156: [2, 315], 157: [2, 315], 161: [2, 315], 174: [2, 315], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 319], 6: [2, 319], 31: [2, 319], 36: [2, 319], 38: [2, 319], 52: [2, 319], 59: [2, 319], 72: [2, 319], 76: [2, 319], 78: [2, 319], 92: [2, 319], 96: [2, 319], 114: [2, 319], 117: [2, 319], 118: [1, 695], 143: [2, 319], 154: [2, 319], 155: 114, 156: [2, 319], 157: [2, 319], 161: [2, 319], 174: [2, 319], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 131], 6: [2, 131], 29: [2, 131], 31: [2, 131], 36: [2, 131], 38: [2, 131], 46: [2, 131], 47: [2, 131], 52: [2, 131], 59: [2, 131], 68: [2, 131], 72: [2, 131], 76: [2, 131], 78: [2, 131], 87: [2, 131], 88: [2, 131], 89: [2, 131], 90: [2, 131], 91: [2, 131], 92: [2, 131], 93: [2, 131], 96: [2, 131], 107: [2, 131], 114: [2, 131], 117: [2, 131], 118: [2, 131], 122: [2, 131], 135: [2, 131], 136: [2, 131], 143: [2, 131], 154: [2, 131], 156: [2, 131], 157: [2, 131], 161: [2, 131], 174: [2, 131], 175: [2, 131], 180: [2, 131], 181: [2, 131], 182: [2, 131], 183: [2, 131], 184: [2, 131], 185: [2, 131], 186: [2, 131], 187: [2, 131], 188: [2, 131], 189: [2, 131], 190: [2, 131], 191: [2, 131], 192: [2, 131], 193: [2, 131], 194: [2, 131], 195: [2, 131], 196: [2, 131], 197: [2, 131] }, { 1: [2, 133], 6: [2, 133], 29: [2, 133], 31: [2, 133], 36: [2, 133], 38: [2, 133], 46: [2, 133], 47: [2, 133], 52: [2, 133], 59: [2, 133], 68: [2, 133], 72: [2, 133], 76: [2, 133], 78: [2, 133], 87: [2, 133], 88: [2, 133], 89: [2, 133], 90: [2, 133], 91: [2, 133], 92: [2, 133], 93: [2, 133], 96: [2, 133], 107: [2, 133], 114: [2, 133], 117: [2, 133], 118: [2, 133], 122: [2, 133], 135: [2, 133], 136: [2, 133], 143: [2, 133], 154: [2, 133], 156: [2, 133], 157: [2, 133], 161: [2, 133], 174: [2, 133], 175: [2, 133], 180: [2, 133], 181: [2, 133], 182: [2, 133], 183: [2, 133], 184: [2, 133], 185: [2, 133], 186: [2, 133], 187: [2, 133], 188: [2, 133], 189: [2, 133], 190: [2, 133], 191: [2, 133], 192: [2, 133], 193: [2, 133], 194: [2, 133], 195: [2, 133], 196: [2, 133], 197: [2, 133] }, { 92: [1, 696] }, { 92: [1, 697] }, { 92: [1, 698] }, { 1: [2, 148], 6: [2, 148], 29: [2, 148], 31: [2, 148], 36: [2, 148], 38: [2, 148], 46: [2, 148], 47: [2, 148], 52: [2, 148], 59: [2, 148], 68: [2, 148], 72: [2, 148], 76: [2, 148], 78: [2, 148], 87: [2, 148], 88: [2, 148], 89: [2, 148], 90: [2, 148], 91: [2, 148], 92: [2, 148], 93: [2, 148], 96: [2, 148], 107: [2, 148], 114: [2, 148], 117: [2, 148], 118: [2, 148], 122: [2, 148], 135: [2, 148], 136: [2, 148], 143: [2, 148], 154: [2, 148], 156: [2, 148], 157: [2, 148], 161: [2, 148], 174: [2, 148], 175: [2, 148], 180: [2, 148], 181: [2, 148], 182: [2, 148], 183: [2, 148], 184: [2, 148], 185: [2, 148], 186: [2, 148], 187: [2, 148], 188: [2, 148], 189: [2, 148], 190: [2, 148], 191: [2, 148], 192: [2, 148], 193: [2, 148], 194: [2, 148], 195: [2, 148], 196: [2, 148], 197: [2, 148] }, { 92: [1, 699] }, { 6: [1, 442], 36: [1, 443], 38: [1, 700] }, { 32: 701, 36: [1, 148], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 161: [1, 702], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 32: 703, 36: [1, 148], 114: [1, 115], 118: [1, 704], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 32: 705, 36: [1, 148], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 32: 706, 36: [1, 148], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 300], 6: [2, 300], 31: [2, 300], 36: [2, 300], 38: [2, 300], 52: [2, 300], 59: [2, 300], 72: [2, 300], 76: [2, 300], 78: [2, 300], 92: [2, 300], 96: [2, 300], 114: [2, 300], 117: [2, 300], 118: [2, 300], 143: [2, 300], 154: [2, 300], 156: [2, 300], 157: [2, 300], 161: [2, 300], 174: [2, 300], 175: [2, 300], 180: [2, 300], 181: [2, 300], 184: [2, 300], 185: [2, 300], 186: [2, 300], 187: [2, 300], 188: [2, 300], 189: [2, 300], 190: [2, 300], 191: [2, 300], 192: [2, 300], 193: [2, 300], 194: [2, 300], 195: [2, 300], 196: [2, 300] }, { 7: 707, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 304], 6: [2, 304], 31: [2, 304], 36: [2, 304], 38: [2, 304], 52: [2, 304], 59: [2, 304], 72: [2, 304], 76: [2, 304], 78: [2, 304], 92: [2, 304], 96: [2, 304], 114: [2, 304], 117: [2, 304], 118: [2, 304], 143: [2, 304], 154: [2, 304], 156: [2, 304], 157: [2, 304], 161: [2, 304], 174: [2, 304], 175: [2, 304], 180: [2, 304], 181: [2, 304], 184: [2, 304], 185: [2, 304], 186: [2, 304], 187: [2, 304], 188: [2, 304], 189: [2, 304], 190: [2, 304], 191: [2, 304], 192: [2, 304], 193: [2, 304], 194: [2, 304], 195: [2, 304], 196: [2, 304] }, { 7: 708, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 38: [1, 709] }, { 1: [2, 332], 6: [2, 332], 31: [2, 332], 36: [2, 332], 38: [2, 332], 52: [2, 332], 59: [2, 332], 72: [2, 332], 76: [2, 332], 78: [2, 332], 92: [2, 332], 96: [2, 332], 114: [2, 332], 117: [2, 332], 118: [2, 332], 143: [2, 332], 154: [2, 332], 156: [2, 332], 157: [2, 332], 161: [2, 332], 174: [2, 332], 175: [2, 332], 180: [2, 332], 181: [2, 332], 184: [2, 332], 185: [2, 332], 186: [2, 332], 187: [2, 332], 188: [2, 332], 189: [2, 332], 190: [2, 332], 191: [2, 332], 192: [2, 332], 193: [2, 332], 194: [2, 332], 195: [2, 332], 196: [2, 332] }, { 38: [2, 336], 167: [2, 336], 169: [2, 336] }, { 36: [2, 271], 59: [2, 271], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 26], 6: [2, 26], 31: [2, 26], 36: [2, 26], 38: [2, 26], 52: [2, 26], 59: [2, 26], 72: [2, 26], 76: [2, 26], 78: [2, 26], 92: [2, 26], 96: [2, 26], 114: [2, 26], 117: [2, 26], 118: [2, 26], 143: [2, 26], 154: [2, 26], 156: [2, 26], 157: [2, 26], 161: [2, 26], 174: [2, 26], 175: [2, 26], 180: [2, 26], 181: [2, 26], 184: [2, 26], 185: [2, 26], 186: [2, 26], 187: [2, 26], 188: [2, 26], 189: [2, 26], 190: [2, 26], 191: [2, 26], 192: [2, 26], 193: [2, 26], 194: [2, 26], 195: [2, 26], 196: [2, 26] }, { 1: [2, 191], 6: [2, 191], 31: [2, 191], 36: [2, 191], 38: [2, 191], 52: [2, 191], 59: [2, 191], 76: [2, 191], 154: [2, 191], 156: [2, 191], 157: [2, 191], 174: [2, 191], 175: [2, 191] }, { 6: [1, 588], 36: [1, 589], 117: [1, 710] }, { 45: 711, 46: [1, 94], 47: [1, 95] }, { 6: [2, 195], 36: [2, 195], 38: [2, 195], 59: [2, 195], 117: [2, 195] }, { 6: [2, 106], 31: [2, 106], 36: [2, 106], 38: [2, 106], 59: [1, 481], 76: [2, 106], 100: 712, 117: [2, 106] }, { 6: [2, 196], 36: [2, 196], 38: [2, 196], 59: [2, 196], 117: [2, 196] }, { 45: 713, 46: [1, 94], 47: [1, 95] }, { 6: [2, 218], 36: [2, 218], 38: [2, 218], 59: [2, 218], 117: [2, 218] }, { 6: [2, 106], 31: [2, 106], 36: [2, 106], 38: [2, 106], 59: [1, 488], 76: [2, 106], 100: 714, 117: [2, 106] }, { 6: [2, 219], 36: [2, 219], 38: [2, 219], 59: [2, 219], 117: [2, 219] }, { 1: [2, 210], 6: [2, 210], 31: [2, 210], 36: [2, 210], 38: [2, 210], 52: [2, 210], 59: [2, 210], 76: [2, 210], 154: [2, 210], 156: [2, 210], 157: [2, 210], 174: [2, 210], 175: [2, 210] }, { 36: [1, 500], 38: [1, 715] }, { 1: [2, 165], 6: [2, 165], 29: [2, 165], 31: [2, 165], 36: [2, 165], 38: [2, 165], 46: [2, 165], 47: [2, 165], 52: [2, 165], 59: [2, 165], 72: [2, 165], 76: [2, 165], 78: [2, 165], 87: [2, 165], 88: [2, 165], 89: [2, 165], 90: [2, 165], 91: [2, 165], 92: [2, 165], 93: [2, 165], 96: [2, 165], 107: [2, 165], 114: [2, 165], 117: [2, 165], 118: [2, 165], 135: [2, 165], 136: [2, 165], 143: [2, 165], 154: [2, 165], 156: [2, 165], 157: [2, 165], 161: [2, 165], 174: [2, 165], 175: [2, 165], 180: [2, 165], 181: [2, 165], 184: [2, 165], 185: [2, 165], 186: [2, 165], 187: [2, 165], 188: [2, 165], 189: [2, 165], 190: [2, 165], 191: [2, 165], 192: [2, 165], 193: [2, 165], 194: [2, 165], 195: [2, 165], 196: [2, 165] }, { 6: [2, 250], 31: [2, 250], 36: [2, 250], 38: [2, 250], 59: [2, 250] }, { 6: [2, 106], 31: [2, 106], 36: [2, 106], 38: [2, 106], 59: [1, 508], 76: [2, 106], 100: 716, 117: [2, 106] }, { 6: [2, 251], 31: [2, 251], 36: [2, 251], 38: [2, 251], 59: [2, 251] }, { 116: [1, 717], 160: [1, 415], 162: [1, 417] }, { 28: 180, 37: 183, 40: [1, 93], 74: 181, 75: [1, 145], 77: [1, 144], 103: 182, 113: [1, 88], 115: 718, 164: 179 }, { 6: [2, 66], 36: [2, 66], 38: [2, 66], 59: [2, 66], 117: [2, 66] }, { 6: [1, 516], 36: [1, 517], 38: [1, 719] }, { 6: [2, 65], 36: [2, 65], 38: [2, 65], 59: [2, 65], 114: [1, 115], 117: [2, 65], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 6: [2, 68], 36: [2, 68], 38: [2, 68], 59: [2, 68], 117: [2, 68] }, { 6: [2, 93], 29: [2, 93], 36: [2, 93], 38: [2, 93], 59: [2, 93], 87: [2, 93], 88: [2, 93], 89: [2, 93], 90: [2, 93], 91: [2, 93], 93: [2, 93], 117: [2, 93], 136: [2, 93] }, { 38: [1, 720], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 92: [1, 721], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 7: 722, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 46: [2, 45], 47: [2, 45], 49: [2, 45], 51: [2, 45] }, { 1: [2, 309], 6: [2, 309], 31: [2, 309], 36: [2, 309], 38: [2, 309], 52: [2, 309], 59: [2, 309], 72: [2, 309], 76: [2, 309], 78: [2, 309], 92: [2, 309], 96: [2, 309], 114: [2, 309], 117: [2, 309], 118: [2, 309], 143: [2, 309], 154: [2, 309], 155: 114, 156: [2, 309], 157: [2, 309], 161: [1, 723], 174: [2, 309], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 310], 6: [2, 310], 31: [2, 310], 36: [2, 310], 38: [2, 310], 52: [2, 310], 59: [2, 310], 72: [2, 310], 76: [2, 310], 78: [2, 310], 92: [2, 310], 96: [2, 310], 114: [2, 310], 117: [2, 310], 118: [1, 724], 143: [2, 310], 154: [2, 310], 155: 114, 156: [2, 310], 157: [2, 310], 161: [2, 310], 174: [2, 310], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 314], 6: [2, 314], 31: [2, 314], 36: [2, 314], 38: [2, 314], 52: [2, 314], 59: [2, 314], 72: [2, 314], 76: [2, 314], 78: [2, 314], 92: [2, 314], 96: [2, 314], 114: [2, 314], 117: [2, 314], 118: [2, 314], 143: [2, 314], 154: [2, 314], 155: 114, 156: [2, 314], 157: [2, 314], 161: [2, 314], 174: [2, 314], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 318], 6: [2, 318], 31: [2, 318], 36: [2, 318], 38: [2, 318], 52: [2, 318], 59: [2, 318], 72: [2, 318], 76: [2, 318], 78: [2, 318], 92: [2, 318], 96: [2, 318], 114: [2, 318], 117: [2, 318], 118: [2, 318], 143: [2, 318], 154: [2, 318], 155: 114, 156: [2, 318], 157: [2, 318], 161: [2, 318], 174: [2, 318], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 7: 725, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 726, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 136], 6: [2, 136], 29: [2, 136], 31: [2, 136], 36: [2, 136], 38: [2, 136], 46: [2, 136], 47: [2, 136], 52: [2, 136], 59: [2, 136], 68: [2, 136], 72: [2, 136], 76: [2, 136], 78: [2, 136], 87: [2, 136], 88: [2, 136], 89: [2, 136], 90: [2, 136], 91: [2, 136], 92: [2, 136], 93: [2, 136], 96: [2, 136], 107: [2, 136], 114: [2, 136], 117: [2, 136], 118: [2, 136], 122: [2, 136], 135: [2, 136], 136: [2, 136], 143: [2, 136], 154: [2, 136], 156: [2, 136], 157: [2, 136], 161: [2, 136], 174: [2, 136], 175: [2, 136], 180: [2, 136], 181: [2, 136], 182: [2, 136], 183: [2, 136], 184: [2, 136], 185: [2, 136], 186: [2, 136], 187: [2, 136], 188: [2, 136], 189: [2, 136], 190: [2, 136], 191: [2, 136], 192: [2, 136], 193: [2, 136], 194: [2, 136], 195: [2, 136], 196: [2, 136], 197: [2, 136] }, { 1: [2, 138], 6: [2, 138], 29: [2, 138], 31: [2, 138], 36: [2, 138], 38: [2, 138], 46: [2, 138], 47: [2, 138], 52: [2, 138], 59: [2, 138], 68: [2, 138], 72: [2, 138], 76: [2, 138], 78: [2, 138], 87: [2, 138], 88: [2, 138], 89: [2, 138], 90: [2, 138], 91: [2, 138], 92: [2, 138], 93: [2, 138], 96: [2, 138], 107: [2, 138], 114: [2, 138], 117: [2, 138], 118: [2, 138], 122: [2, 138], 135: [2, 138], 136: [2, 138], 143: [2, 138], 154: [2, 138], 156: [2, 138], 157: [2, 138], 161: [2, 138], 174: [2, 138], 175: [2, 138], 180: [2, 138], 181: [2, 138], 182: [2, 138], 183: [2, 138], 184: [2, 138], 185: [2, 138], 186: [2, 138], 187: [2, 138], 188: [2, 138], 189: [2, 138], 190: [2, 138], 191: [2, 138], 192: [2, 138], 193: [2, 138], 194: [2, 138], 195: [2, 138], 196: [2, 138], 197: [2, 138] }, { 1: [2, 140], 6: [2, 140], 29: [2, 140], 31: [2, 140], 36: [2, 140], 38: [2, 140], 46: [2, 140], 47: [2, 140], 52: [2, 140], 59: [2, 140], 68: [2, 140], 72: [2, 140], 76: [2, 140], 78: [2, 140], 87: [2, 140], 88: [2, 140], 89: [2, 140], 90: [2, 140], 91: [2, 140], 92: [2, 140], 93: [2, 140], 96: [2, 140], 107: [2, 140], 114: [2, 140], 117: [2, 140], 118: [2, 140], 122: [2, 140], 135: [2, 140], 136: [2, 140], 143: [2, 140], 154: [2, 140], 156: [2, 140], 157: [2, 140], 161: [2, 140], 174: [2, 140], 175: [2, 140], 180: [2, 140], 181: [2, 140], 182: [2, 140], 183: [2, 140], 184: [2, 140], 185: [2, 140], 186: [2, 140], 187: [2, 140], 188: [2, 140], 189: [2, 140], 190: [2, 140], 191: [2, 140], 192: [2, 140], 193: [2, 140], 194: [2, 140], 195: [2, 140], 196: [2, 140], 197: [2, 140] }, { 1: [2, 150], 6: [2, 150], 29: [2, 150], 31: [2, 150], 36: [2, 150], 38: [2, 150], 46: [2, 150], 47: [2, 150], 52: [2, 150], 59: [2, 150], 68: [2, 150], 72: [2, 150], 76: [2, 150], 78: [2, 150], 87: [2, 150], 88: [2, 150], 89: [2, 150], 90: [2, 150], 91: [2, 150], 92: [2, 150], 93: [2, 150], 96: [2, 150], 107: [2, 150], 114: [2, 150], 117: [2, 150], 118: [2, 150], 122: [2, 150], 135: [2, 150], 136: [2, 150], 143: [2, 150], 154: [2, 150], 156: [2, 150], 157: [2, 150], 161: [2, 150], 174: [2, 150], 175: [2, 150], 180: [2, 150], 181: [2, 150], 182: [2, 150], 183: [2, 150], 184: [2, 150], 185: [2, 150], 186: [2, 150], 187: [2, 150], 188: [2, 150], 189: [2, 150], 190: [2, 150], 191: [2, 150], 192: [2, 150], 193: [2, 150], 194: [2, 150], 195: [2, 150], 196: [2, 150], 197: [2, 150] }, { 6: [2, 112], 31: [2, 112], 36: [2, 112], 38: [2, 112], 59: [2, 112], 96: [2, 112] }, { 1: [2, 294], 6: [2, 294], 31: [2, 294], 36: [2, 294], 38: [2, 294], 52: [2, 294], 59: [2, 294], 72: [2, 294], 76: [2, 294], 78: [2, 294], 92: [2, 294], 96: [2, 294], 114: [2, 294], 117: [2, 294], 118: [2, 294], 143: [2, 294], 154: [2, 294], 156: [2, 294], 157: [2, 294], 161: [2, 294], 174: [2, 294], 175: [2, 294], 180: [2, 294], 181: [2, 294], 184: [2, 294], 185: [2, 294], 186: [2, 294], 187: [2, 294], 188: [2, 294], 189: [2, 294], 190: [2, 294], 191: [2, 294], 192: [2, 294], 193: [2, 294], 194: [2, 294], 195: [2, 294], 196: [2, 294] }, { 7: 727, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 295], 6: [2, 295], 31: [2, 295], 36: [2, 295], 38: [2, 295], 52: [2, 295], 59: [2, 295], 72: [2, 295], 76: [2, 295], 78: [2, 295], 92: [2, 295], 96: [2, 295], 114: [2, 295], 117: [2, 295], 118: [2, 295], 143: [2, 295], 154: [2, 295], 156: [2, 295], 157: [2, 295], 161: [2, 295], 174: [2, 295], 175: [2, 295], 180: [2, 295], 181: [2, 295], 184: [2, 295], 185: [2, 295], 186: [2, 295], 187: [2, 295], 188: [2, 295], 189: [2, 295], 190: [2, 295], 191: [2, 295], 192: [2, 295], 193: [2, 295], 194: [2, 295], 195: [2, 295], 196: [2, 295] }, { 7: 728, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 299], 6: [2, 299], 31: [2, 299], 36: [2, 299], 38: [2, 299], 52: [2, 299], 59: [2, 299], 72: [2, 299], 76: [2, 299], 78: [2, 299], 92: [2, 299], 96: [2, 299], 114: [2, 299], 117: [2, 299], 118: [2, 299], 143: [2, 299], 154: [2, 299], 156: [2, 299], 157: [2, 299], 161: [2, 299], 174: [2, 299], 175: [2, 299], 180: [2, 299], 181: [2, 299], 184: [2, 299], 185: [2, 299], 186: [2, 299], 187: [2, 299], 188: [2, 299], 189: [2, 299], 190: [2, 299], 191: [2, 299], 192: [2, 299], 193: [2, 299], 194: [2, 299], 195: [2, 299], 196: [2, 299] }, { 1: [2, 303], 6: [2, 303], 31: [2, 303], 36: [2, 303], 38: [2, 303], 52: [2, 303], 59: [2, 303], 72: [2, 303], 76: [2, 303], 78: [2, 303], 92: [2, 303], 96: [2, 303], 114: [2, 303], 117: [2, 303], 118: [2, 303], 143: [2, 303], 154: [2, 303], 156: [2, 303], 157: [2, 303], 161: [2, 303], 174: [2, 303], 175: [2, 303], 180: [2, 303], 181: [2, 303], 184: [2, 303], 185: [2, 303], 186: [2, 303], 187: [2, 303], 188: [2, 303], 189: [2, 303], 190: [2, 303], 191: [2, 303], 192: [2, 303], 193: [2, 303], 194: [2, 303], 195: [2, 303], 196: [2, 303] }, { 32: 729, 36: [1, 148], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 32: 730, 36: [1, 148], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 330], 6: [2, 330], 31: [2, 330], 36: [2, 330], 38: [2, 330], 52: [2, 330], 59: [2, 330], 72: [2, 330], 76: [2, 330], 78: [2, 330], 92: [2, 330], 96: [2, 330], 114: [2, 330], 117: [2, 330], 118: [2, 330], 143: [2, 330], 154: [2, 330], 156: [2, 330], 157: [2, 330], 161: [2, 330], 174: [2, 330], 175: [2, 330], 180: [2, 330], 181: [2, 330], 184: [2, 330], 185: [2, 330], 186: [2, 330], 187: [2, 330], 188: [2, 330], 189: [2, 330], 190: [2, 330], 191: [2, 330], 192: [2, 330], 193: [2, 330], 194: [2, 330], 195: [2, 330], 196: [2, 330] }, { 39: [1, 731] }, { 1: [2, 190], 6: [2, 190], 31: [2, 190], 36: [2, 190], 38: [2, 190], 52: [2, 190], 59: [2, 190], 76: [2, 190], 154: [2, 190], 156: [2, 190], 157: [2, 190], 174: [2, 190], 175: [2, 190] }, { 6: [1, 588], 36: [1, 589], 38: [1, 732] }, { 1: [2, 215], 6: [2, 215], 31: [2, 215], 36: [2, 215], 38: [2, 215], 52: [2, 215], 59: [2, 215], 76: [2, 215], 154: [2, 215], 156: [2, 215], 157: [2, 215], 174: [2, 215], 175: [2, 215] }, { 6: [1, 596], 36: [1, 597], 38: [1, 733] }, { 6: [2, 261], 36: [2, 261], 38: [2, 261], 59: [2, 261], 76: [2, 261] }, { 6: [1, 613], 36: [1, 614], 38: [1, 734] }, { 7: 735, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 116: [1, 736] }, { 6: [2, 177], 36: [2, 177], 38: [2, 177], 59: [2, 177], 117: [2, 177] }, { 92: [1, 737] }, { 6: [2, 95], 29: [2, 95], 36: [2, 95], 38: [2, 95], 59: [2, 95], 87: [2, 95], 88: [2, 95], 89: [2, 95], 90: [2, 95], 91: [2, 95], 93: [2, 95], 117: [2, 95], 136: [2, 95] }, { 38: [1, 738], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 7: 739, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 7: 740, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 1: [2, 316], 6: [2, 316], 31: [2, 316], 36: [2, 316], 38: [2, 316], 52: [2, 316], 59: [2, 316], 72: [2, 316], 76: [2, 316], 78: [2, 316], 92: [2, 316], 96: [2, 316], 114: [2, 316], 117: [2, 316], 118: [2, 316], 143: [2, 316], 154: [2, 316], 155: 114, 156: [2, 316], 157: [2, 316], 161: [2, 316], 174: [2, 316], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 320], 6: [2, 320], 31: [2, 320], 36: [2, 320], 38: [2, 320], 52: [2, 320], 59: [2, 320], 72: [2, 320], 76: [2, 320], 78: [2, 320], 92: [2, 320], 96: [2, 320], 114: [2, 320], 117: [2, 320], 118: [2, 320], 143: [2, 320], 154: [2, 320], 155: 114, 156: [2, 320], 157: [2, 320], 161: [2, 320], 174: [2, 320], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 32: 741, 36: [1, 148], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 32: 742, 36: [1, 148], 114: [1, 115], 155: 114, 156: [1, 85], 157: [1, 86], 174: [1, 112], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 301], 6: [2, 301], 31: [2, 301], 36: [2, 301], 38: [2, 301], 52: [2, 301], 59: [2, 301], 72: [2, 301], 76: [2, 301], 78: [2, 301], 92: [2, 301], 96: [2, 301], 114: [2, 301], 117: [2, 301], 118: [2, 301], 143: [2, 301], 154: [2, 301], 156: [2, 301], 157: [2, 301], 161: [2, 301], 174: [2, 301], 175: [2, 301], 180: [2, 301], 181: [2, 301], 184: [2, 301], 185: [2, 301], 186: [2, 301], 187: [2, 301], 188: [2, 301], 189: [2, 301], 190: [2, 301], 191: [2, 301], 192: [2, 301], 193: [2, 301], 194: [2, 301], 195: [2, 301], 196: [2, 301] }, { 1: [2, 305], 6: [2, 305], 31: [2, 305], 36: [2, 305], 38: [2, 305], 52: [2, 305], 59: [2, 305], 72: [2, 305], 76: [2, 305], 78: [2, 305], 92: [2, 305], 96: [2, 305], 114: [2, 305], 117: [2, 305], 118: [2, 305], 143: [2, 305], 154: [2, 305], 156: [2, 305], 157: [2, 305], 161: [2, 305], 174: [2, 305], 175: [2, 305], 180: [2, 305], 181: [2, 305], 184: [2, 305], 185: [2, 305], 186: [2, 305], 187: [2, 305], 188: [2, 305], 189: [2, 305], 190: [2, 305], 191: [2, 305], 192: [2, 305], 193: [2, 305], 194: [2, 305], 195: [2, 305], 196: [2, 305] }, { 45: 743, 46: [1, 94], 47: [1, 95] }, { 6: [2, 197], 36: [2, 197], 38: [2, 197], 59: [2, 197], 117: [2, 197] }, { 6: [2, 220], 36: [2, 220], 38: [2, 220], 59: [2, 220], 117: [2, 220] }, { 6: [2, 252], 31: [2, 252], 36: [2, 252], 38: [2, 252], 59: [2, 252] }, { 1: [2, 313], 6: [2, 313], 31: [2, 313], 36: [2, 313], 38: [2, 313], 52: [2, 313], 59: [1, 746], 72: [2, 313], 76: [2, 313], 78: [2, 313], 92: [2, 313], 96: [2, 313], 100: 744, 114: [2, 313], 117: [2, 313], 118: [1, 745], 143: [2, 313], 154: [2, 313], 155: 114, 156: [2, 313], 157: [2, 313], 161: [2, 313], 174: [2, 313], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 7: 747, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 6: [2, 94], 29: [2, 94], 36: [2, 94], 38: [2, 94], 59: [2, 94], 87: [2, 94], 88: [2, 94], 89: [2, 94], 90: [2, 94], 91: [2, 94], 93: [2, 94], 117: [2, 94], 136: [2, 94] }, { 92: [1, 748] }, { 1: [2, 311], 6: [2, 311], 31: [2, 311], 36: [2, 311], 38: [2, 311], 52: [2, 311], 59: [2, 311], 72: [2, 311], 76: [2, 311], 78: [2, 311], 92: [2, 311], 96: [2, 311], 114: [2, 311], 117: [2, 311], 118: [2, 311], 143: [2, 311], 154: [2, 311], 155: 114, 156: [2, 311], 157: [2, 311], 161: [2, 311], 174: [2, 311], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 312], 6: [2, 312], 31: [2, 312], 36: [2, 312], 38: [2, 312], 52: [2, 312], 59: [2, 312], 72: [2, 312], 76: [2, 312], 78: [2, 312], 92: [2, 312], 96: [2, 312], 114: [2, 312], 117: [2, 312], 118: [2, 312], 143: [2, 312], 154: [2, 312], 155: 114, 156: [2, 312], 157: [2, 312], 161: [2, 312], 174: [2, 312], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 296], 6: [2, 296], 31: [2, 296], 36: [2, 296], 38: [2, 296], 52: [2, 296], 59: [2, 296], 72: [2, 296], 76: [2, 296], 78: [2, 296], 92: [2, 296], 96: [2, 296], 114: [2, 296], 117: [2, 296], 118: [2, 296], 143: [2, 296], 154: [2, 296], 156: [2, 296], 157: [2, 296], 161: [2, 296], 174: [2, 296], 175: [2, 296], 180: [2, 296], 181: [2, 296], 184: [2, 296], 185: [2, 296], 186: [2, 296], 187: [2, 296], 188: [2, 296], 189: [2, 296], 190: [2, 296], 191: [2, 296], 192: [2, 296], 193: [2, 296], 194: [2, 296], 195: [2, 296], 196: [2, 296] }, { 1: [2, 297], 6: [2, 297], 31: [2, 297], 36: [2, 297], 38: [2, 297], 52: [2, 297], 59: [2, 297], 72: [2, 297], 76: [2, 297], 78: [2, 297], 92: [2, 297], 96: [2, 297], 114: [2, 297], 117: [2, 297], 118: [2, 297], 143: [2, 297], 154: [2, 297], 156: [2, 297], 157: [2, 297], 161: [2, 297], 174: [2, 297], 175: [2, 297], 180: [2, 297], 181: [2, 297], 184: [2, 297], 185: [2, 297], 186: [2, 297], 187: [2, 297], 188: [2, 297], 189: [2, 297], 190: [2, 297], 191: [2, 297], 192: [2, 297], 193: [2, 297], 194: [2, 297], 195: [2, 297], 196: [2, 297] }, { 1: [2, 192], 6: [2, 192], 31: [2, 192], 36: [2, 192], 38: [2, 192], 52: [2, 192], 59: [2, 192], 76: [2, 192], 154: [2, 192], 156: [2, 192], 157: [2, 192], 174: [2, 192], 175: [2, 192] }, { 117: [1, 749] }, { 7: 750, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 6: [2, 107], 31: [2, 107], 36: [2, 107], 38: [2, 107], 76: [2, 107], 117: [2, 107] }, { 1: [2, 315], 6: [2, 315], 31: [2, 315], 36: [2, 315], 38: [2, 315], 52: [2, 315], 59: [1, 746], 72: [2, 315], 76: [2, 315], 78: [2, 315], 92: [2, 315], 96: [2, 315], 100: 751, 114: [2, 315], 117: [2, 315], 118: [1, 752], 143: [2, 315], 154: [2, 315], 155: 114, 156: [2, 315], 157: [2, 315], 161: [2, 315], 174: [2, 315], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 6: [2, 96], 29: [2, 96], 36: [2, 96], 38: [2, 96], 59: [2, 96], 87: [2, 96], 88: [2, 96], 89: [2, 96], 90: [2, 96], 91: [2, 96], 93: [2, 96], 117: [2, 96], 136: [2, 96] }, { 1: [2, 168], 6: [2, 168], 29: [2, 168], 31: [2, 168], 36: [2, 168], 38: [2, 168], 46: [2, 168], 47: [2, 168], 52: [2, 168], 59: [2, 168], 68: [2, 168], 72: [2, 168], 76: [2, 168], 78: [2, 168], 87: [2, 168], 88: [2, 168], 89: [2, 168], 90: [2, 168], 91: [2, 168], 92: [2, 168], 93: [2, 168], 96: [2, 168], 107: [2, 168], 114: [2, 168], 116: [2, 168], 117: [2, 168], 118: [2, 168], 135: [2, 168], 136: [2, 168], 143: [2, 168], 154: [2, 168], 156: [2, 168], 157: [2, 168], 160: [2, 168], 161: [2, 168], 162: [2, 168], 174: [2, 168], 175: [2, 168], 180: [2, 168], 181: [2, 168], 184: [2, 168], 185: [2, 168], 186: [2, 168], 187: [2, 168], 188: [2, 168], 189: [2, 168], 190: [2, 168], 191: [2, 168], 192: [2, 168], 193: [2, 168], 194: [2, 168], 195: [2, 168], 196: [2, 168] }, { 1: [2, 314], 6: [2, 314], 31: [2, 314], 36: [2, 314], 38: [2, 314], 52: [2, 314], 59: [1, 746], 72: [2, 314], 76: [2, 314], 78: [2, 314], 92: [2, 314], 96: [2, 314], 100: 753, 114: [2, 314], 117: [2, 314], 118: [2, 314], 143: [2, 314], 154: [2, 314], 155: 114, 156: [2, 314], 157: [2, 314], 161: [2, 314], 174: [2, 314], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 117: [1, 754] }, { 7: 755, 9: 151, 10: 22, 11: [1, 23], 12: 24, 13: 25, 14: 7, 15: 8, 16: 9, 17: 10, 18: 11, 19: 12, 20: 13, 21: 14, 22: 15, 23: 16, 24: 17, 25: 18, 26: 19, 27: [1, 56], 28: 81, 35: [1, 55], 37: 62, 40: [1, 93], 43: 63, 44: [1, 89], 45: 90, 46: [1, 94], 47: [1, 95], 53: 65, 54: [1, 91], 55: [1, 92], 56: 30, 60: 27, 61: [1, 64], 62: [1, 66], 63: [1, 67], 64: [1, 68], 65: [1, 69], 66: [1, 70], 67: 26, 74: 82, 75: [1, 72], 77: [1, 76], 80: 28, 81: 33, 82: 32, 83: [1, 73], 86: [1, 74], 94: [1, 58], 95: [1, 155], 97: 156, 98: [1, 79], 99: [1, 80], 103: 61, 105: 45, 108: 29, 109: 31, 110: 34, 111: [1, 77], 112: [1, 78], 113: [1, 88], 114: [1, 51], 121: [1, 53], 123: [1, 59], 131: [1, 60], 138: [1, 75], 148: [1, 48], 152: [1, 54], 153: [1, 71], 155: 49, 156: [1, 85], 157: [1, 86], 158: 50, 159: [1, 87], 163: [1, 42], 165: [1, 52], 170: 46, 171: [1, 83], 172: 47, 173: [1, 84], 176: [1, 157], 177: [1, 158], 178: [1, 159], 179: [1, 39], 180: [1, 40], 181: [1, 41], 182: [1, 43], 183: [1, 44] }, { 117: [1, 756] }, { 1: [2, 170], 6: [2, 170], 29: [2, 170], 31: [2, 170], 36: [2, 170], 38: [2, 170], 46: [2, 170], 47: [2, 170], 52: [2, 170], 59: [2, 170], 68: [2, 170], 72: [2, 170], 76: [2, 170], 78: [2, 170], 87: [2, 170], 88: [2, 170], 89: [2, 170], 90: [2, 170], 91: [2, 170], 92: [2, 170], 93: [2, 170], 96: [2, 170], 107: [2, 170], 114: [2, 170], 116: [2, 170], 117: [2, 170], 118: [2, 170], 135: [2, 170], 136: [2, 170], 143: [2, 170], 154: [2, 170], 156: [2, 170], 157: [2, 170], 160: [2, 170], 161: [2, 170], 162: [2, 170], 174: [2, 170], 175: [2, 170], 180: [2, 170], 181: [2, 170], 184: [2, 170], 185: [2, 170], 186: [2, 170], 187: [2, 170], 188: [2, 170], 189: [2, 170], 190: [2, 170], 191: [2, 170], 192: [2, 170], 193: [2, 170], 194: [2, 170], 195: [2, 170], 196: [2, 170] }, { 1: [2, 316], 6: [2, 316], 31: [2, 316], 36: [2, 316], 38: [2, 316], 52: [2, 316], 59: [1, 746], 72: [2, 316], 76: [2, 316], 78: [2, 316], 92: [2, 316], 96: [2, 316], 100: 757, 114: [2, 316], 117: [2, 316], 118: [2, 316], 143: [2, 316], 154: [2, 316], 155: 114, 156: [2, 316], 157: [2, 316], 161: [2, 316], 174: [2, 316], 175: [1, 113], 180: [1, 99], 181: [1, 98], 184: [1, 97], 185: [1, 100], 186: [1, 101], 187: [1, 102], 188: [1, 103], 189: [1, 104], 190: [1, 105], 191: [1, 106], 192: [1, 107], 193: [1, 108], 194: [1, 109], 195: [1, 110], 196: [1, 111] }, { 1: [2, 169], 6: [2, 169], 29: [2, 169], 31: [2, 169], 36: [2, 169], 38: [2, 169], 46: [2, 169], 47: [2, 169], 52: [2, 169], 59: [2, 169], 68: [2, 169], 72: [2, 169], 76: [2, 169], 78: [2, 169], 87: [2, 169], 88: [2, 169], 89: [2, 169], 90: [2, 169], 91: [2, 169], 92: [2, 169], 93: [2, 169], 96: [2, 169], 107: [2, 169], 114: [2, 169], 116: [2, 169], 117: [2, 169], 118: [2, 169], 135: [2, 169], 136: [2, 169], 143: [2, 169], 154: [2, 169], 156: [2, 169], 157: [2, 169], 160: [2, 169], 161: [2, 169], 162: [2, 169], 174: [2, 169], 175: [2, 169], 180: [2, 169], 181: [2, 169], 184: [2, 169], 185: [2, 169], 186: [2, 169], 187: [2, 169], 188: [2, 169], 189: [2, 169], 190: [2, 169], 191: [2, 169], 192: [2, 169], 193: [2, 169], 194: [2, 169], 195: [2, 169], 196: [2, 169] }, { 117: [1, 758] }, { 1: [2, 171], 6: [2, 171], 29: [2, 171], 31: [2, 171], 36: [2, 171], 38: [2, 171], 46: [2, 171], 47: [2, 171], 52: [2, 171], 59: [2, 171], 68: [2, 171], 72: [2, 171], 76: [2, 171], 78: [2, 171], 87: [2, 171], 88: [2, 171], 89: [2, 171], 90: [2, 171], 91: [2, 171], 92: [2, 171], 93: [2, 171], 96: [2, 171], 107: [2, 171], 114: [2, 171], 116: [2, 171], 117: [2, 171], 118: [2, 171], 135: [2, 171], 136: [2, 171], 143: [2, 171], 154: [2, 171], 156: [2, 171], 157: [2, 171], 160: [2, 171], 161: [2, 171], 162: [2, 171], 174: [2, 171], 175: [2, 171], 180: [2, 171], 181: [2, 171], 184: [2, 171], 185: [2, 171], 186: [2, 171], 187: [2, 171], 188: [2, 171], 189: [2, 171], 190: [2, 171], 191: [2, 171], 192: [2, 171], 193: [2, 171], 194: [2, 171], 195: [2, 171], 196: [2, 171] }],
  defaultActions: { 485: [2, 203] },
  performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$) {
    const $0 = $$.length - 1;
    switch (yystate) {
      case 1:
        return ["program"];
      case 2:
        return ["program", ...$$[$0]];
      case 3:
      case 42:
      case 109:
      case 174:
      case 193:
      case 216:
      case 248:
      case 262:
      case 266:
      case 327:
      case 333:
        return [$$[$0]];
      case 4:
      case 110:
      case 175:
      case 194:
      case 217:
      case 249:
        return [...$$[$0 - 2], $$[$0]];
      case 5:
      case 44:
      case 269:
        return $$[$0 - 1];
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
      case 324:
      case 325:
      case 326:
      case 341:
      case 343:
        return $$[$0];
      case 26:
        return ["def", $$[$0 - 4], $$[$0 - 2], $$[$0]];
      case 27:
        return ["def", $$[$0 - 1], [], $$[$0]];
      case 30:
        return ["yield"];
      case 31:
        return ["yield", $$[$0]];
      case 32:
        return ["yield", $$[$0 - 1]];
      case 33:
        return ["yield-from", $$[$0]];
      case 34:
        return ["block"];
      case 35:
        return ["block", ...$$[$0 - 1]];
      case 41:
        return ["str", ...$$[$0 - 1]];
      case 43:
      case 263:
      case 267:
      case 334:
        return [...$$[$0 - 1], $$[$0]];
      case 45:
      case 196:
      case 219:
      case 234:
      case 251:
        return $$[$0 - 2];
      case 46:
        return "";
      case 49:
        return ["regex", $$[$0 - 1]];
      case 50:
        return ["regex-index", $$[$0 - 2], $$[$0]];
      case 51:
        return ["regex-index", $$[$0], null];
      case 55:
        return "undefined";
      case 56:
        return "null";
      case 60:
        return ["=", $$[$0 - 2], $$[$0]];
      case 61:
        return ["=", $$[$0 - 3], $$[$0]];
      case 62:
        return ["=", $$[$0 - 4], $$[$0 - 1]];
      case 63:
        return [$$[$0], $$[$0], null];
      case 65:
        return [$$[$0 - 2], $$[$0], ":"];
      case 66:
        return [$$[$0 - 4], $$[$0 - 1], ":"];
      case 67:
        return [$$[$0 - 2], $$[$0], "="];
      case 68:
        return [$$[$0 - 4], $$[$0 - 1], "="];
      case 73:
        return ["computed", $$[$0 - 1]];
      case 74:
        return ["[]", "this", $$[$0 - 1]];
      case 76:
      case 77:
      case 121:
        return ["...", $$[$0]];
      case 83:
        return ["super", ...$$[$0]];
      case 84:
      case 230:
        return ["import", ...$$[$0]];
      case 85:
      case 86:
        return [$$[$0 - 2], ...$$[$0]];
      case 87:
      case 124:
      case 141:
        return [".", $$[$0 - 2], $$[$0]];
      case 88:
      case 125:
      case 142:
        return ["?.", $$[$0 - 2], $$[$0]];
      case 89:
      case 126:
      case 143:
        return ["::", $$[$0 - 2], $$[$0]];
      case 90:
      case 127:
      case 144:
        return ["?::", $$[$0 - 2], $$[$0]];
      case 91:
      case 128:
      case 145:
        return ["::", $$[$0 - 1], "prototype"];
      case 92:
      case 129:
      case 146:
        return ["?::", $$[$0 - 1], "prototype"];
      case 93:
      case 130:
      case 132:
      case 147:
        return ["[]", $$[$0 - 3], $$[$0 - 1]];
      case 94:
      case 131:
      case 133:
      case 148:
        return ["[]", $$[$0 - 5], $$[$0 - 2]];
      case 95:
      case 135:
      case 137:
      case 149:
        return ["?[]", $$[$0 - 4], $$[$0 - 1]];
      case 96:
      case 136:
      case 138:
      case 150:
        return ["?[]", $$[$0 - 6], $$[$0 - 2]];
      case 97:
        return ["return", $$[$0]];
      case 98:
        return ["return", $$[$0 - 1]];
      case 99:
        return ["return"];
      case 100:
      case 102:
        return [$$[$0 - 1], $$[$0 - 3], $$[$0]];
      case 101:
      case 103:
        return [$$[$0 - 1], [], $$[$0]];
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
        return [...$$[$0 - 3], $$[$0]];
      case 112:
      case 177:
      case 197:
      case 220:
      case 252:
        return [...$$[$0 - 5], ...$$[$0 - 2]];
      case 114:
        return ["rest", $$[$0]];
      case 115:
        return ["default", $$[$0 - 2], $$[$0]];
      case 116:
        return ["expansion"];
      case 134:
        return [$$[$0 - 1][0], $$[$0 - 3], ...$$[$0 - 1].slice(1)];
      case 139:
        return ["optindex", $$[$0 - 4], $$[$0 - 1]];
      case 140:
        return ["optindex", $$[$0 - 6], $$[$0 - 2]];
      case 163:
        return [".", "super", $$[$0]];
      case 164:
        return ["[]", "super", $$[$0 - 1]];
      case 165:
        return ["[]", "super", $$[$0 - 2]];
      case 166:
        return [".", "new", $$[$0]];
      case 167:
        return [".", "import", $$[$0]];
      case 168:
        return ["object-comprehension", $$[$0 - 8], $$[$0 - 6], [["for-of", $$[$0 - 4], $$[$0 - 2], false]], []];
      case 169:
        return ["object-comprehension", $$[$0 - 10], $$[$0 - 8], [["for-of", $$[$0 - 6], $$[$0 - 4], false]], [$$[$0 - 2]]];
      case 170:
        return ["object-comprehension", $$[$0 - 9], $$[$0 - 7], [["for-of", $$[$0 - 4], $$[$0 - 2], true]], []];
      case 171:
        return ["object-comprehension", $$[$0 - 11], $$[$0 - 9], [["for-of", $$[$0 - 6], $$[$0 - 4], true]], [$$[$0 - 2]]];
      case 172:
        return ["object", ...$$[$0 - 2]];
      case 178:
        return ["class", null, null];
      case 179:
        return ["class", null, null, $$[$0]];
      case 180:
        return ["class", null, $$[$0]];
      case 181:
        return ["class", null, $$[$0 - 1], $$[$0]];
      case 182:
        return ["class", $$[$0], null];
      case 183:
        return ["class", $$[$0 - 1], null, $$[$0]];
      case 184:
        return ["class", $$[$0 - 2], $$[$0]];
      case 185:
        return ["class", $$[$0 - 3], $$[$0 - 1], $$[$0]];
      case 186:
      case 189:
        return ["import", "{}", $$[$0]];
      case 187:
      case 188:
        return ["import", $$[$0 - 2], $$[$0]];
      case 190:
        return ["import", $$[$0 - 4], $$[$0]];
      case 191:
        return ["import", [$$[$0 - 4], $$[$0 - 2]], $$[$0]];
      case 192:
        return ["import", [$$[$0 - 7], $$[$0 - 4]], $$[$0]];
      case 199:
      case 201:
      case 222:
      case 223:
      case 225:
      case 328:
        return [$$[$0 - 2], $$[$0]];
      case 203:
        return ["*", $$[$0]];
      case 204:
        return ["export", "{}"];
      case 205:
        return ["export", $$[$0 - 2]];
      case 206:
      case 207:
        return ["export", $$[$0]];
      case 208:
        return ["export", ["=", $$[$0 - 2], $$[$0]]];
      case 209:
        return ["export", ["=", $$[$0 - 3], $$[$0]]];
      case 210:
        return ["export", ["=", $$[$0 - 4], $$[$0 - 1]]];
      case 211:
        return ["export-default", $$[$0]];
      case 212:
        return ["export-default", $$[$0 - 1]];
      case 213:
        return ["export-all", $$[$0]];
      case 214:
        return ["export-from", "{}", $$[$0]];
      case 215:
        return ["export-from", $$[$0 - 4], $$[$0]];
      case 226:
        return ["tagged-template", $$[$0 - 2], $$[$0]];
      case 227:
        return $$[$0 - 1] ? ["?call", $$[$0 - 2], ...$$[$0]] : [$$[$0 - 2], ...$$[$0]];
      case 228:
        return ["optcall", $$[$0 - 2], ...$$[$0]];
      case 229:
        return $$[$0 - 1] ? ["?super", ...$$[$0]] : ["super", ...$$[$0]];
      case 231:
      case 268:
        return null;
      case 232:
        return true;
      case 235:
      case 236:
        return "this";
      case 237:
        return [".", "this", $$[$0]];
      case 238:
        return ["array"];
      case 239:
        return ["array", ...$$[$0 - 1]];
      case 240:
        return ["array", ...$$[$0 - 2], ...$$[$0 - 1]];
      case 241:
        return "..";
      case 242:
      case 256:
        return "...";
      case 243:
        return [$$[$0 - 2], $$[$0 - 3], $$[$0 - 1]];
      case 244:
      case 365:
      case 367:
      case 368:
      case 375:
      case 377:
        return [$$[$0 - 1], $$[$0 - 2], $$[$0]];
      case 245:
        return [$$[$0], $$[$0 - 1], null];
      case 246:
        return [$$[$0 - 1], null, $$[$0]];
      case 247:
        return [$$[$0], null, null];
      case 258:
        return [...$$[$0 - 2], ...$$[$0]];
      case 259:
        return [...$$[$0 - 3], ...$$[$0]];
      case 260:
        return [...$$[$0 - 2], ...$$[$0 - 1]];
      case 261:
        return [...$$[$0 - 5], ...$$[$0 - 4], ...$$[$0 - 2], ...$$[$0 - 1]];
      case 265:
        return [...$$[$0]];
      case 271:
        return Array.isArray($$[$0 - 2]) ? [...$$[$0 - 2], $$[$0]] : [$$[$0 - 2], $$[$0]];
      case 272:
        return ["try", $$[$0]];
      case 273:
        return ["try", $$[$0 - 1], $$[$0]];
      case 274:
        return ["try", $$[$0 - 2], $$[$0]];
      case 275:
        return ["try", $$[$0 - 3], $$[$0 - 2], $$[$0]];
      case 276:
      case 277:
      case 348:
      case 351:
      case 353:
        return [$$[$0 - 1], $$[$0]];
      case 278:
        return [null, $$[$0]];
      case 279:
        return ["throw", $$[$0]];
      case 280:
        return ["throw", $$[$0 - 1]];
      case 281:
        return $$[$0 - 1].length === 1 ? $$[$0 - 1][0] : $$[$0 - 1];
      case 282:
        return $$[$0 - 2].length === 1 ? $$[$0 - 2][0] : $$[$0 - 2];
      case 283:
        return ["while", $$[$0]];
      case 284:
        return ["while", $$[$0 - 2], $$[$0]];
      case 285:
        return ["until", $$[$0]];
      case 286:
        return ["until", $$[$0 - 2], $$[$0]];
      case 287:
        return $$[$0 - 1].length === 2 ? [$$[$0 - 1][0], $$[$0 - 1][1], $$[$0]] : [$$[$0 - 1][0], $$[$0 - 1][1], $$[$0 - 1][2], $$[$0]];
      case 288:
      case 289:
        return $$[$0].length === 2 ? [$$[$0][0], $$[$0][1], [$$[$0 - 1]]] : [$$[$0][0], $$[$0][1], $$[$0][2], [$$[$0 - 1]]];
      case 291:
        return ["loop", $$[$0]];
      case 292:
        return ["loop", [$$[$0]]];
      case 293:
        return ["for-in", $$[$0 - 3], $$[$0 - 1], null, null, $$[$0]];
      case 294:
        return ["for-in", $$[$0 - 5], $$[$0 - 3], null, $$[$0 - 1], $$[$0]];
      case 295:
        return ["for-in", $$[$0 - 5], $$[$0 - 3], $$[$0 - 1], null, $$[$0]];
      case 296:
        return ["for-in", $$[$0 - 7], $$[$0 - 5], $$[$0 - 1], $$[$0 - 3], $$[$0]];
      case 297:
        return ["for-in", $$[$0 - 7], $$[$0 - 5], $$[$0 - 3], $$[$0 - 1], $$[$0]];
      case 298:
        return ["for-of", $$[$0 - 3], $$[$0 - 1], false, null, $$[$0]];
      case 299:
        return ["for-of", $$[$0 - 5], $$[$0 - 3], false, $$[$0 - 1], $$[$0]];
      case 300:
        return ["for-of", $$[$0 - 3], $$[$0 - 1], true, null, $$[$0]];
      case 301:
        return ["for-of", $$[$0 - 5], $$[$0 - 3], true, $$[$0 - 1], $$[$0]];
      case 302:
        return ["for-from", $$[$0 - 3], $$[$0 - 1], false, null, $$[$0]];
      case 303:
        return ["for-from", $$[$0 - 5], $$[$0 - 3], false, $$[$0 - 1], $$[$0]];
      case 304:
        return ["for-from", $$[$0 - 3], $$[$0 - 1], true, null, $$[$0]];
      case 305:
        return ["for-from", $$[$0 - 5], $$[$0 - 3], true, $$[$0 - 1], $$[$0]];
      case 306:
        return ["for-in", [], $$[$0 - 1], null, null, $$[$0]];
      case 307:
        return ["for-in", [], $$[$0 - 3], $$[$0 - 1], null, $$[$0]];
      case 308:
        return ["comprehension", $$[$0 - 4], [["for-in", $$[$0 - 2], $$[$0], null]], []];
      case 309:
        return ["comprehension", $$[$0 - 6], [["for-in", $$[$0 - 4], $$[$0 - 2], null]], [$$[$0]]];
      case 310:
        return ["comprehension", $$[$0 - 6], [["for-in", $$[$0 - 4], $$[$0 - 2], $$[$0]]], []];
      case 311:
        return ["comprehension", $$[$0 - 8], [["for-in", $$[$0 - 6], $$[$0 - 4], $$[$0]]], [$$[$0 - 2]]];
      case 312:
        return ["comprehension", $$[$0 - 8], [["for-in", $$[$0 - 6], $$[$0 - 4], $$[$0 - 2]]], [$$[$0]]];
      case 313:
        return ["comprehension", $$[$0 - 4], [["for-of", $$[$0 - 2], $$[$0], false]], []];
      case 314:
        return ["comprehension", $$[$0 - 6], [["for-of", $$[$0 - 4], $$[$0 - 2], false]], [$$[$0]]];
      case 315:
        return ["comprehension", $$[$0 - 5], [["for-of", $$[$0 - 2], $$[$0], true]], []];
      case 316:
        return ["comprehension", $$[$0 - 7], [["for-of", $$[$0 - 4], $$[$0 - 2], true]], [$$[$0]]];
      case 317:
        return ["comprehension", $$[$0 - 4], [["for-from", $$[$0 - 2], $$[$0], false, null]], []];
      case 318:
        return ["comprehension", $$[$0 - 6], [["for-from", $$[$0 - 4], $$[$0 - 2], false, null]], [$$[$0]]];
      case 319:
        return ["comprehension", $$[$0 - 5], [["for-from", $$[$0 - 2], $$[$0], true, null]], []];
      case 320:
        return ["comprehension", $$[$0 - 7], [["for-from", $$[$0 - 4], $$[$0 - 2], true, null]], [$$[$0]]];
      case 321:
        return ["comprehension", $$[$0 - 2], [["for-in", [], $$[$0], null]], []];
      case 322:
        return ["comprehension", $$[$0 - 4], [["for-in", [], $$[$0 - 2], $$[$0]]], []];
      case 329:
        return ["switch", $$[$0 - 3], $$[$0 - 1], null];
      case 330:
        return ["switch", $$[$0 - 5], $$[$0 - 3], $$[$0 - 1]];
      case 331:
        return ["switch", null, $$[$0 - 1], null];
      case 332:
        return ["switch", null, $$[$0 - 3], $$[$0 - 1]];
      case 335:
        return ["when", $$[$0 - 1], $$[$0]];
      case 336:
        return ["when", $$[$0 - 2], $$[$0 - 1]];
      case 337:
        return ["if", $$[$0 - 1], $$[$0]];
      case 338:
        return $$[$0 - 4].length === 3 ? ["if", $$[$0 - 4][1], $$[$0 - 4][2], ["if", $$[$0 - 1], $$[$0]]] : [...$$[$0 - 4], ["if", $$[$0 - 1], $$[$0]]];
      case 339:
        return ["unless", $$[$0 - 1], $$[$0]];
      case 340:
        return ["if", ["!", $$[$0 - 3]], $$[$0 - 2], $$[$0]];
      case 342:
        return $$[$0 - 2].length === 3 ? ["if", $$[$0 - 2][1], $$[$0 - 2][2], $$[$0]] : [...$$[$0 - 2], $$[$0]];
      case 344:
      case 345:
        return ["if", $$[$0], [$$[$0 - 2]]];
      case 346:
      case 347:
        return ["unless", $$[$0], [$$[$0 - 2]]];
      case 349:
      case 350:
      case 352:
      case 380:
        return ["do-iife", $$[$0]];
      case 354:
        return ["-", $$[$0]];
      case 355:
        return ["+", $$[$0]];
      case 356:
        return ["await", $$[$0]];
      case 357:
        return ["await", $$[$0 - 1]];
      case 358:
        return ["--", $$[$0], false];
      case 359:
        return ["++", $$[$0], false];
      case 360:
        return ["--", $$[$0 - 1], true];
      case 361:
        return ["++", $$[$0 - 1], true];
      case 362:
        return ["?", $$[$0 - 1]];
      case 363:
        return ["+", $$[$0 - 2], $$[$0]];
      case 364:
        return ["-", $$[$0 - 2], $$[$0]];
      case 366:
        return ["**", $$[$0 - 2], $$[$0]];
      case 369:
        return ["&", $$[$0 - 2], $$[$0]];
      case 370:
        return ["^", $$[$0 - 2], $$[$0]];
      case 371:
        return ["|", $$[$0 - 2], $$[$0]];
      case 372:
        return ["&&", $$[$0 - 2], $$[$0]];
      case 373:
        return ["||", $$[$0 - 2], $$[$0]];
      case 374:
        return ["??", $$[$0 - 2], $$[$0]];
      case 376:
        return ["?:", $$[$0 - 4], $$[$0 - 2], $$[$0]];
      case 378:
        return [$$[$0 - 3], $$[$0 - 4], $$[$0 - 1]];
      case 379:
        return [$$[$0 - 2], $$[$0 - 3], $$[$0]];
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
      error = new Error(message);
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
      if (this.yy.hasOwnProperty(k2)) {
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
      action = this.defaultActions[state] || (symbol == null && (symbol = lex()), parseTable[state] != null ? parseTable[state][symbol] : undefined);
      if (!(action?.length && action[0])) {
        errStr = "";
        if (!recovering)
          expected = (() => {
            const result = [];
            for (const p2 in parseTable[state]) {
              if (!parseTable[state].hasOwnProperty(p2))
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
        throw new Error(errStr);
      }
      if (action[0] instanceof Array && action.length > 1)
        throw new Error(`Parse Error: multiple actions possible at state: ${state}, token: ${symbol}`);
      switch (action[0]) {
        case 1:
          stk.push(symbol, action[1]);
          val.push(lexer.yytext);
          loc.push(lexer.yylloc);
          symbol = null;
          if (!preErrorSymbol) {
            [yyleng, yytext, yylineno, yyloc] = [lexer.yyleng, lexer.yytext, lexer.yylineno, lexer.yylloc];
            if (recovering > 0)
              recovering--;
          } else
            [symbol, preErrorSymbol] = [preErrorSymbol, null];
          break;
        case 2:
          len2 = this.ruleData[action[1]][1];
          yyval.$ = val[val.length - len2];
          [locFirst, locLast] = [loc[loc.length - (len2 || 1)], loc[loc.length - 1]];
          yyval._$ = { first_line: locFirst.first_line, last_line: locLast.last_line, first_column: locFirst.first_column, last_column: locLast.last_column };
          if (ranges)
            yyval._$.range = [locFirst.range[0], locLast.range[1]];
          r = this.performAction.apply(yyval, [yytext, yyleng, yylineno, sharedState.yy, action[1], val, loc]);
          if (r != null)
            yyval.$ = r;
          if (len2) {
            stk.length -= len2 * 2;
            val.length -= len2;
            loc.length -= len2;
          }
          stk.push(this.ruleData[action[1]][0]);
          val.push(yyval.$);
          loc.push(yyval._$);
          newState = parseTable[stk[stk.length - 2]][stk[stk.length - 1]];
          stk.push(newState);
          break;
        case 3:
          return val[val.length - 1];
      }
    }
  },
  trace() {},
  yy: {}
};
function createParser(yyInit = {}) {
  const p = Object.create(parserInstance);
  Object.defineProperty(p, "yy", {
    value: { ...yyInit },
    enumerable: false,
    writable: true,
    configurable: true
  });
  return p;
}
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
    if (head instanceof String) {
      head = head.valueOf();
    }
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
          console.warn("[RIP] Unexpected quoted primitive string (should be String object):", sexpr);
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
    switch (head) {
      case "program":
        return this.generateProgram(rest);
      case "+":
      case "-":
      case "*":
      case "/":
      case "%":
      case "**":
      case "==":
      case "===":
      case "!=":
      case "!==":
      case "<":
      case ">":
      case "<=":
      case ">=":
      case "&&":
      case "||":
      case "??":
      case "&":
      case "|":
      case "^":
      case "<<":
      case ">>":
      case ">>>": {
        if ((head === "+" || head === "-") && rest.length === 1) {
          const [operand] = rest;
          return `(${head}${this.generate(operand, "value")})`;
        }
        const [left2, right2] = rest;
        let op = head;
        if (head === "==")
          op = "===";
        if (head === "!=")
          op = "!==";
        return `(${this.generate(left2, "value")} ${op} ${this.generate(right2, "value")})`;
      }
      case "%%": {
        const [left2, right2] = rest;
        const leftCode = this.generate(left2, "value");
        const rightCode = this.generate(right2, "value");
        this.helpers.add("modulo");
        return `modulo(${leftCode}, ${rightCode})`;
      }
      case "//": {
        const [left2, right2] = rest;
        return `Math.floor(${this.generate(left2, "value")} / ${this.generate(right2, "value")})`;
      }
      case "..": {
        const [start, end] = rest;
        const startCode = this.generate(start, "value");
        const endCode = this.generate(end, "value");
        return `((s, e) => Array.from({length: Math.abs(e - s) + 1}, (_, i) => s + (i * (s <= e ? 1 : -1))))(${startCode}, ${endCode})`;
      }
      case "...": {
        if (rest.length === 2) {
          const [start, end] = rest;
          const startCode = this.generate(start, "value");
          const endCode = this.generate(end, "value");
          return `((s, e) => Array.from({length: Math.max(0, Math.abs(e - s))}, (_, i) => s + (i * (s <= e ? 1 : -1))))(${startCode}, ${endCode})`;
        }
        const [expr] = rest;
        return `...${this.generate(expr, "value")}`;
      }
      case "!": {
        const [operand] = rest;
        const operandCode = this.generate(operand, "value");
        const needsParens = operandCode.includes("(") || operandCode.includes(" ");
        return needsParens ? `(!${operandCode})` : `!${operandCode}`;
      }
      case "new": {
        const [call] = rest;
        if (Array.isArray(call) && (call[0] === "." || call[0] === "?.")) {
          const [accessType, target, prop] = call;
          if (Array.isArray(target) && !target[0].startsWith) {
            const newExpr = this.generate(["new", target], "value");
            return `(${newExpr}).${prop}`;
          }
          const targetCode = this.generate(target, "value");
          const propAccess = `${targetCode}.${prop}`;
          return `new ${propAccess}`;
        }
        if (Array.isArray(call)) {
          const [constructor, ...args] = call;
          const constructorCode = this.generate(constructor, "value");
          const argsCode = args.map((arg) => this.generate(arg, "value")).join(", ");
          return `new ${constructorCode}(${argsCode})`;
        }
        return `new ${this.generate(call, "value")}()`;
      }
      case "~": {
        const [operand] = rest;
        return `(~${this.generate(operand, "value")})`;
      }
      case "++":
      case "--": {
        const [operand, isPostfix] = rest;
        const operandCode = this.generate(operand, "value");
        if (isPostfix) {
          return `(${operandCode}${head})`;
        } else {
          return `(${head}${operandCode})`;
        }
      }
      case "instanceof": {
        const [expr, type] = rest;
        return `(${this.generate(expr, "value")} instanceof ${this.generate(type, "value")})`;
      }
      case "in": {
        const [value, container] = rest;
        const valueCode = this.generate(value, "value");
        const containerCode = this.generate(container, "value");
        return `(Array.isArray(${containerCode}) || typeof ${containerCode} === 'string' ? ${containerCode}.includes(${valueCode}) : (${valueCode} in ${containerCode}))`;
      }
      case "of": {
        const [key2, obj] = rest;
        return `(${this.generate(key2, "value")} in ${this.generate(obj, "value")})`;
      }
      case "=~": {
        const [left2, right2] = rest;
        this.helpers.add("toSearchable");
        this.programVars.add("_");
        const rightCode = this.generate(right2, "value");
        const hasMultilineFlag = rightCode.includes("/m");
        const allowNewlines = hasMultilineFlag ? ", true" : "";
        return `(_ = toSearchable(${this.generate(left2, "value")}${allowNewlines}).match(${rightCode}))`;
      }
      case "=":
      case "+=":
      case "-=":
      case "*=":
      case "/=":
      case "%=":
      case "**=":
      case "&&=":
      case "||=":
      case "?=":
      case "??=":
      case "&=":
      case "|=":
      case "^=":
      case "<<=":
      case ">>=":
      case ">>>=": {
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
            const condCode = this.generate(condition, "value");
            const valueCode2 = this.generate(unwrappedValue, "value");
            if (valueHead === "unless") {
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
        const valueCode = this.generate(value, "value");
        const needsParensForValue = context === "value";
        const needsParensForObject = context === "statement" && Array.isArray(target) && target[0] === "object";
        if (needsParensForValue || needsParensForObject) {
          return `(${targetCode} ${op} ${valueCode})`;
        }
        return `${targetCode} ${op} ${valueCode}`;
      }
      case "//=": {
        const [target, value] = rest;
        const targetCode = this.generate(target, "value");
        const valueCode = this.generate(value, "value");
        return `${targetCode} = Math.floor(${targetCode} / ${valueCode})`;
      }
      case "array": {
        const hasTrailingElision = rest.length > 0 && rest[rest.length - 1] === ",";
        const elements = rest.map((el) => {
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
        return hasTrailingElision ? `[${elements},]` : `[${elements}]`;
      }
      case "object": {
        if (rest.length === 1 && Array.isArray(rest[0]) && Array.isArray(rest[0][1]) && rest[0][1][0] === "comprehension") {
          const [keyVar, comprehensionNode] = rest[0];
          const [, valueExpr, iterators, guards] = comprehensionNode;
          return this.generate(["object-comprehension", keyVar, valueExpr, iterators, guards], context);
        }
        const pairs = rest.map((pair) => {
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
        return `{${pairs}}`;
      }
      case ".": {
        const [obj, prop] = rest;
        const objCode = this.generate(obj, "value");
        const isNumberLiteral = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(objCode);
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
      case "?.": {
        const [obj, prop] = rest;
        return `${this.generate(obj, "value")}?.${prop}`;
      }
      case "::": {
        const [obj, prop] = rest;
        const objCode = this.generate(obj, "value");
        if (prop === "prototype") {
          return `${objCode}.prototype`;
        }
        const cleanProp = prop instanceof String ? prop.valueOf() : prop;
        return `${objCode}.prototype.${cleanProp}`;
      }
      case "?::": {
        const [obj, prop] = rest;
        const objCode = this.generate(obj, "value");
        if (prop === "prototype") {
          return `(${objCode} != null ? ${objCode}.prototype : undefined)`;
        }
        return `(${objCode} != null ? ${objCode}.prototype.${prop} : undefined)`;
      }
      case "regex-index": {
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
      case "[]": {
        const [arr, index] = rest;
        if (Array.isArray(index) && (index[0] === ".." || index[0] === "...")) {
          const isInclusive = index[0] === "..";
          const arrCode = this.generate(arr, "value");
          const [start, end] = index.slice(1);
          if (start === null && end === null) {
            return `${arrCode}.slice()`;
          } else if (start === null) {
            const isNegativeOne = Array.isArray(end) && end[0] === "-" && end.length === 2 && (end[1] === "1" || end[1] === 1 || end[1] instanceof String && end[1].valueOf() === "1");
            if (isInclusive && isNegativeOne) {
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
            const isNegativeOneLiteral = Array.isArray(end) && end[0] === "-" && end.length === 2 && (end[1] === "1" || end[1] === 1 || end[1] instanceof String && end[1].valueOf() === "1");
            if (isInclusive && isNegativeOneLiteral) {
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
        return `${this.generate(arr, "value")}[${this.generate(index, "value")}]`;
      }
      case "?[]": {
        const [arr, index] = rest;
        const arrCode = this.generate(arr, "value");
        const indexCode = this.generate(index, "value");
        return `(${arrCode} != null ? ${arrCode}[${indexCode}] : undefined)`;
      }
      case "optindex": {
        const [arr, index] = rest;
        const arrCode = this.generate(arr, "value");
        const indexCode = this.generate(index, "value");
        return `${arrCode}?.[${indexCode}]`;
      }
      case "optcall": {
        const [fn, ...args] = rest;
        const fnCode = this.generate(fn, "value");
        const argsCode = args.map((arg) => this.generate(arg, "value")).join(", ");
        return `${fnCode}?.(${argsCode})`;
      }
      case "def": {
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
      case "->": {
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
      case "=>": {
        const [params, body] = rest;
        const sideEffectOnly = this.nextFunctionIsVoid || false;
        this.nextFunctionIsVoid = false;
        const paramList = this.generateParamList(params);
        const isAsync = this.containsAwait(body);
        const asyncPrefix = isAsync ? "async " : "";
        if (!sideEffectOnly) {
          if (Array.isArray(body) && body[0] === "block" && body.length === 2) {
            const expr = body[1];
            if (!Array.isArray(expr) || expr[0] !== "return") {
              return `${asyncPrefix}(${paramList}) => ${this.generate(expr, "value")}`;
            }
          }
          if (!Array.isArray(body) || body[0] !== "block") {
            return `${asyncPrefix}(${paramList}) => ${this.generate(body, "value")}`;
          }
        }
        const bodyCode = this.generateFunctionBody(body, params, sideEffectOnly);
        return `${asyncPrefix}(${paramList}) => ${bodyCode}`;
      }
      case "return": {
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
          const actualNew = ["new", body[0]];
          return this.generate(["unless", condition, [["return", actualNew]]], "statement");
        }
        return `return ${this.generate(expr, "value")}`;
      }
      case "block": {
        const stmts = this.withIndent(() => this.formatStatements(rest));
        return `{
${stmts.join(`
`)}
${this.indent()}}`;
      }
      case "if": {
        const [condition, thenBranch, ...elseBranches] = rest;
        if (context === "value") {
          return this.generateIfAsExpression(condition, thenBranch, elseBranches);
        } else {
          return this.generateIfAsStatement(condition, thenBranch, elseBranches);
        }
      }
      case "unless": {
        let [condition, body] = rest;
        if (Array.isArray(body) && body.length === 1) {
          const elem = body[0];
          if (!Array.isArray(elem) || elem[0] !== "block") {
            body = elem;
          }
        }
        if (context === "value") {
          const thenExpr = this.extractExpression(body);
          return `(!${this.generate(condition, "value")} ? ${thenExpr} : undefined)`;
        }
        let code = `if (!${this.generate(condition, "value")}) `;
        code += this.generate(body, "statement");
        return code;
      }
      case "?:": {
        const [condition, thenExpr, elseExpr] = rest;
        const condCode = this.unwrap(this.generate(condition, "value"));
        return `(${condCode} ? ${this.generate(thenExpr, "value")} : ${this.generate(elseExpr, "value")})`;
      }
      case "?": {
        const [expr] = rest;
        return `(${this.generate(expr, "value")} != null)`;
      }
      case "typeof": {
        const [expr] = rest;
        return `typeof ${this.generate(expr, "value")}`;
      }
      case "delete": {
        const [expr] = rest;
        return `delete ${this.generate(expr, "value")}`;
      }
      case "for-in": {
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
              stmts.push(...statements.map((s) => this.generate(s, "statement") + ";"));
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
            this.indentLevel++;
            const stmts = [`const ${itemVarPattern} = ${iterableCode}[${indexVar}];`];
            if (guard) {
              const guardCode = this.generate(guard, "value");
              stmts.push(`if (${guardCode}) {`);
              this.indentLevel++;
              stmts.push(...this.formatStatements(statements));
              this.indentLevel--;
              stmts.push(this.indent() + "}");
            } else {
              stmts.push(...statements.map((s) => this.generate(s, "statement") + ";"));
            }
            this.indentLevel--;
            code2 += `{
${stmts.map((s) => this.indent() + s).join(`
`)}
${this.indent()}}`;
          } else {
            if (guard) {
              const guardCode = this.generate(guard, "value");
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
      case "for-of": {
        const [vars, obj, own, guard, body] = rest;
        const [keyVar, valueVar] = Array.isArray(vars) ? vars : [vars];
        const objCode = this.generate(obj, "value");
        let code = `for (const ${keyVar} in ${objCode}) `;
        let ownCheck = null;
        let guardCheck = null;
        if (own) {
          ownCheck = [[".", obj, "hasOwnProperty"], keyVar];
        }
        if (guard) {
          guardCheck = guard;
        }
        let combinedGuard = null;
        if (!valueVar && ownCheck && guardCheck) {
          combinedGuard = ["&&", ownCheck, guardCheck];
        } else if (!valueVar && ownCheck) {
          combinedGuard = ownCheck;
        } else if (!valueVar && guardCheck) {
          combinedGuard = guardCheck;
        }
        if (valueVar) {
          if (ownCheck && guardCheck) {
            if (Array.isArray(body) && body[0] === "block") {
              const statements = body.slice(1);
              this.indentLevel++;
              const outerIndent = this.indent();
              const ownCondition = this.generate(ownCheck, "value");
              this.indentLevel++;
              const midIndent = this.indent();
              const guardCondition = this.generate(guardCheck, "value");
              this.indentLevel++;
              const innerIndent = this.indent();
              const stmts = statements.map((s) => innerIndent + this.generate(s, "statement") + ";");
              this.indentLevel -= 3;
              code += `{
${outerIndent}if (${ownCondition}) {
${midIndent}const ${valueVar} = ${objCode}[${keyVar}];
${midIndent}if (${guardCondition}) {
${stmts.join(`
`)}
${midIndent}}
${outerIndent}}
${this.indent()}}`;
            } else {
              const ownCondition = this.generate(ownCheck, "value");
              const guardCondition = this.generate(guardCheck, "value");
              code += `{ if (${ownCondition}) { const ${valueVar} = ${objCode}[${keyVar}]; if (${guardCondition}) ${this.generate(body, "statement")}; } }`;
            }
          } else if (ownCheck) {
            if (Array.isArray(body) && body[0] === "block") {
              const statements = body.slice(1);
              this.indentLevel++;
              const loopBodyIndent = this.indent();
              const condition = this.generate(ownCheck, "value");
              this.indentLevel++;
              const innerIndent = this.indent();
              const stmts = statements.map((s) => innerIndent + this.generate(s, "statement") + ";");
              this.indentLevel -= 2;
              code += `{
${loopBodyIndent}if (${condition}) {
${innerIndent}const ${valueVar} = ${objCode}[${keyVar}];
${stmts.join(`
`)}
${loopBodyIndent}}
${this.indent()}}`;
            } else {
              code += `{ if (${this.generate(ownCheck, "value")}) { const ${valueVar} = ${objCode}[${keyVar}]; ${this.generate(body, "statement")}; } }`;
            }
          } else if (guardCheck) {
            if (Array.isArray(body) && body[0] === "block") {
              const statements = body.slice(1);
              this.indentLevel++;
              const loopBodyIndent = this.indent();
              const guardCondition = this.generate(guardCheck, "value");
              this.indentLevel++;
              const innerIndent = this.indent();
              const stmts = statements.map((s) => innerIndent + this.generate(s, "statement") + ";");
              this.indentLevel -= 2;
              code += `{
${loopBodyIndent}const ${valueVar} = ${objCode}[${keyVar}];
${loopBodyIndent}if (${guardCondition}) {
${stmts.join(`
`)}
${loopBodyIndent}}
${this.indent()}}`;
            } else {
              code += `{ const ${valueVar} = ${objCode}[${keyVar}]; if (${this.generate(guardCheck, "value")}) ${this.generate(body, "statement")}; }`;
            }
          } else {
            if (Array.isArray(body) && body[0] === "block") {
              const statements = body.slice(1);
              this.indentLevel++;
              const stmts = [`const ${valueVar} = ${objCode}[${keyVar}];`, ...statements.map((s) => this.generate(s, "statement") + ";")];
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
          if (combinedGuard) {
            code += this.generateLoopBodyWithGuard(body, combinedGuard);
          } else {
            code += this.generateLoopBody(body);
          }
        }
        return code;
      }
      case "for-from": {
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
      case "while": {
        const condition = rest[0];
        const guard = rest.length === 3 ? rest[1] : null;
        const body = rest[rest.length - 1];
        let code = `while (${this.generate(condition, "value")}) `;
        if (guard) {
          code += this.generateLoopBodyWithGuard(body, guard);
        } else {
          code += this.generateLoopBody(body);
        }
        return code;
      }
      case "until": {
        const condition = rest[0];
        const guard = rest.length === 3 ? rest[1] : null;
        const body = rest[rest.length - 1];
        let code = `while (!${this.generate(condition, "value")}) `;
        if (guard) {
          code += this.generateLoopBodyWithGuard(body, guard);
        } else {
          code += this.generateLoopBody(body);
        }
        return code;
      }
      case "loop": {
        const [body] = rest;
        let code = `while (true) `;
        code += this.generateLoopBody(body);
        return code;
      }
      case "break": {
        return "break";
      }
      case "break-if": {
        const [condition] = rest;
        return `if (${this.generate(condition, "value")}) break`;
      }
      case "continue": {
        return "continue";
      }
      case "continue-if": {
        const [condition] = rest;
        return `if (${this.generate(condition, "value")}) continue`;
      }
      case "try": {
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
      case "throw": {
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
      case "switch": {
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
      case "when": {
        throw new Error("when clause should be handled by switch");
      }
      case "comprehension": {
        const [expr, iterators, guards] = rest;
        if (context === "statement") {
          return this.generateComprehensionAsLoop(expr, iterators, guards);
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
              code += this.indent() + `if (!${objCode}.hasOwnProperty(${keyVarPattern})) continue;
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
      case "object-comprehension": {
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
              code += this.indent() + `if (!${iterableCode}.hasOwnProperty(${keyVar})) continue;
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
      case "class": {
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
      case "super": {
        if (rest.length === 0) {
          if (this.currentMethodName && this.currentMethodName !== "constructor") {
            return `super.${this.currentMethodName}()`;
          }
          return "super";
        }
        const argsCode = rest.map((arg) => this.generate(arg, "value")).join(", ");
        if (this.currentMethodName && this.currentMethodName !== "constructor") {
          return `super.${this.currentMethodName}(${argsCode})`;
        }
        return `super(${argsCode})`;
      }
      case "?call": {
        const [fn, ...args] = rest;
        const fnCode = this.generate(fn, "value");
        const argsCode = args.map((arg) => this.generate(arg, "value")).join(", ");
        return `(typeof ${fnCode} === 'function' ? ${fnCode}(${argsCode}) : undefined)`;
      }
      case "?super": {
        const argsCode = rest.map((arg) => this.generate(arg, "value")).join(", ");
        if (this.currentMethodName && this.currentMethodName !== "constructor") {
          return `(typeof super.${this.currentMethodName} === 'function' ? super.${this.currentMethodName}(${argsCode}) : undefined)`;
        }
        return `super(${argsCode})`;
      }
      case "await": {
        const [expr] = rest;
        return `await ${this.generate(expr, "value")}`;
      }
      case "yield": {
        if (rest.length === 0) {
          return "yield";
        }
        const [expr] = rest;
        return `yield ${this.generate(expr, "value")}`;
      }
      case "yield-from": {
        const [expr] = rest;
        return `yield* ${this.generate(expr, "value")}`;
      }
      case "import": {
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
      case "export": {
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
      case "export-default": {
        const [expr] = rest;
        if (Array.isArray(expr) && expr[0] === "=") {
          const [, target, value] = expr;
          const assignCode = `const ${target} = ${this.generate(value, "value")}`;
          return `${assignCode};
export default ${target}`;
        }
        return `export default ${this.generate(expr, "statement")}`;
      }
      case "export-all": {
        const [source] = rest;
        const fixedSource = this.addJsExtensionAndAssertions(source);
        return `export * from ${fixedSource}`;
      }
      case "export-from": {
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
      case "do-iife": {
        const [arrowFn] = rest;
        const fnCode = this.generate(arrowFn, "statement");
        return `(${fnCode})()`;
      }
      case "regex": {
        if (rest.length === 0) {
          return head;
        }
        const [pattern] = rest;
        return this.generate(pattern, "value");
      }
      case "tagged-template": {
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
      case "str": {
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
      default: {
        if (typeof head === "string" && !head.startsWith('"') && !head.startsWith("'")) {
          const isNumberLiteral = /^-?\d/.test(head);
          if (isNumberLiteral) {
            return head;
          }
          if (head === "super" && this.currentMethodName && this.currentMethodName !== "constructor") {
            const args2 = rest.map((arg) => this.generate(arg, "value")).join(", ");
            return `super.${this.currentMethodName}(${args2})`;
          }
          const findPostfixConditional = (expr) => {
            if (!Array.isArray(expr))
              return null;
            const head2 = expr[0];
            if ((head2 === "unless" || head2 === "if") && expr.length === 3) {
              return { type: head2, condition: expr[1], value: expr[2] };
            }
            if (head2 === "+" || head2 === "-" || head2 === "*" || head2 === "/") {
              for (let i = 1;i < expr.length; i++) {
                const found = findPostfixConditional(expr[i]);
                if (found) {
                  found.parentOp = head2;
                  found.operandIndex = i;
                  found.otherOperands = expr.slice(1).filter((_, idx) => idx !== i - 1);
                  return found;
                }
              }
            }
            return null;
          };
          if (context === "statement" && rest.length === 1) {
            const conditional = findPostfixConditional(rest[0]);
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
          const args = rest.map((arg) => this.generate(arg, "value")).join(", ");
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
          const findPostfixConditional = (expr) => {
            if (!Array.isArray(expr))
              return null;
            const head2 = expr[0];
            if ((head2 === "unless" || head2 === "if") && expr.length === 3) {
              return { type: head2, condition: expr[1], value: expr[2] };
            }
            if (head2 === "+" || head2 === "-" || head2 === "*" || head2 === "/") {
              for (let i = 1;i < expr.length; i++) {
                const found = findPostfixConditional(expr[i]);
                if (found) {
                  found.parentOp = head2;
                  found.operandIndex = i;
                  found.otherOperands = expr.slice(1).filter((_, idx) => idx !== i - 1);
                  return found;
                }
              }
            }
            return null;
          };
          if (context === "statement" && rest.length === 1) {
            const conditional = findPostfixConditional(rest[0]);
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
            const isNumberLiteral = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(objCode);
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
          const args = rest.map((arg) => this.generate(arg, "value")).join(", ");
          const callStr = `${calleeCode}(${args})`;
          return needsAwait ? `await ${callStr}` : callStr;
        }
        throw new Error(`Unknown s-expression type: ${head}`);
      }
    }
  }
  generateProgram(statements) {
    let code = "";
    const imports = [];
    const exports = [];
    const otherStatements = [];
    statements.forEach((stmt) => {
      if (Array.isArray(stmt)) {
        const head = stmt[0];
        if (head === "import") {
          imports.push(stmt);
        } else if (head === "export" || head === "export-default" || head === "export-all" || head === "export-from") {
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
        const head = Array.isArray(stmt) ? stmt[0] : null;
        const controlFlowStatements = ["if", "unless", "for-in", "for-of", "while", "until", "loop", "switch", "try"];
        const isControlFlow = controlFlowStatements.includes(head);
        if (!isControlFlow || !generated.endsWith("}")) {
          return generated + ";";
        }
      }
      return generated;
    }).join(`
`);
    let needsBlankLine = false;
    if (imports.length > 0) {
      code += imports.map((stmt) => this.generate(stmt, "statement") + ";").join(`
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
` + exports.map((stmt) => this.generate(stmt, "statement") + ";").join(`
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
            code += this.indent() + stmtCode + `;
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
                const iifeCode = this.generate(value, "value");
                const unwrapped = this.unwrapComprehensionIIFE(iifeCode, target);
                if (unwrapped) {
                  code += unwrapped;
                  return;
                }
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
            code += this.indent() + stmtCode + `;
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
          return this.indent() + this.generate(stmt, "statement") + ";";
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
    if (!Array.isArray(body)) {
      return `{ if (${this.generate(guard, "value")}) ${this.generate(body, "statement")}; }`;
    }
    if (body[0] === "block" || Array.isArray(body[0])) {
      const statements = body[0] === "block" ? body.slice(1) : body;
      let guardCondition = this.generate(guard, "value");
      if (guardCondition.startsWith("(") && guardCondition.endsWith(")") && !guardCondition.includes("(", 1)) {
        guardCondition = guardCondition.slice(1, -1);
      }
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
  formatStatements(statements, context = "statement") {
    return statements.map((s) => this.indent() + this.generate(s, context) + ";");
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
  unwrapComprehensionIIFE(iifeCode, arrayVar) {
    const bodyMatch = iifeCode.match(/^\((?:async )?\(\) => \{([\s\S]*)\}\)\(\)$/);
    if (!bodyMatch)
      return null;
    let body = bodyMatch[1];
    const lines = body.split(`
`);
    let baseIndent = "";
    for (const line of lines) {
      if (line.trim()) {
        baseIndent = line.match(/^(\s*)/)[1];
        break;
      }
    }
    const currentIndent = this.indent();
    const reindentedLines = lines.map((line) => {
      if (!line.trim())
        return "";
      return line.startsWith(baseIndent) ? currentIndent + line.slice(baseIndent.length) : currentIndent + line;
    });
    return reindentedLines.join(`
`).replace(/const result = \[\];/, `${arrayVar} = [];`).replace(/return result;/, `return ${arrayVar};`).replace(/\bresult\b/g, arrayVar);
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
          code += this.indent() + `if (!${objCode}.hasOwnProperty(${keyVar})) continue;
`;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
        } else if (own && valueVar && guards?.length) {
          code += this.indent() + `if (${objCode}.hasOwnProperty(${keyVar})) {
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
          code += this.indent() + `if (${objCode}.hasOwnProperty(${keyVar})) {
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
  unwrapIfBranch(branch) {
    if (Array.isArray(branch) && branch.length === 1) {
      const elem = branch[0];
      if (!Array.isArray(elem) || elem[0] !== "block") {
        return elem;
      }
    }
    return branch;
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
    let code = `if (${this.generate(condition, "value")}) `;
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
  "\\",
  "#",
  "**",
  "_",
  "=",
  "<",
  ">",
  "[",
  "]",
  "]]",
  "!",
  "&",
  "?",
  "'",
  "not",
  "var",
  "num",
  "str",
  "global",
  "naked-global",
  "tag",
  "entryref",
  "assign",
  "pass-by-ref",
  "newline",
  "formfeed",
  "tab",
  "ascii",
  "value",
  "read-var",
  "read-newline",
  "lock-var",
  "lock-incr",
  "lock-decr",
  ".",
  "?.",
  "::",
  "?::",
  "[]",
  "?[]",
  "optindex",
  "optcall",
  "%",
  "//",
  "%%",
  "==",
  "!=",
  "<=",
  ">=",
  "===",
  "!==",
  "&&",
  "||",
  "??",
  "&",
  "|",
  "^",
  "<<",
  ">>",
  ">>>",
  "rest",
  "default",
  "...",
  "expansion"
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
  if (isInline(arr)) {
    const parts = arr.map((elem) => Array.isArray(elem) ? formatSExpr(elem, 0, false) : formatAtom(elem));
    return `(${parts.join(" ")})`;
  }
  if (isTopLevel && arr[0] === "program") {
    const secondElem = arr[1];
    const header = Array.isArray(secondElem) ? "(program" : "(program " + formatAtom(secondElem);
    const lines2 = [header];
    const startIndex = Array.isArray(secondElem) ? 1 : 2;
    for (let i = startIndex;i < arr.length; i++) {
      let childFormatted = formatSExpr(arr[i], 2, false);
      if (childFormatted[0] === "(") {
        childFormatted = "  " + childFormatted;
      }
      lines2.push(childFormatted);
    }
    lines2.push(")");
    return lines2.join(`
`);
  }
  const spaces = " ".repeat(indent);
  const lines = [];
  const head = Array.isArray(arr[0]) ? formatSExpr(arr[0], 0, false) : formatAtom(arr[0]);
  lines.push(`${spaces}(${head}`);
  for (let i = 1;i < arr.length; i++) {
    const elem = arr[i];
    if (Array.isArray(elem)) {
      const formatted = formatSExpr(elem, indent + 2, false);
      if (isInline(elem)) {
        lines[lines.length - 1] += ` ${formatted}`;
      } else {
        lines.push(formatted);
      }
    } else {
      lines[lines.length - 1] += ` ${formatAtom(elem)}`;
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
var VERSION = "1.2.0";
var BUILD_DATE = "2025-11-04@08:07:40GMT";
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
