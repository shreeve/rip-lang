var BALANCED_PAIRS, BOM, BOOL, CALLABLE, CALL_CLOSERS, CODE, COMMENT, COMPARABLE_LEFT_SIDE, COMPARE, COMPOUND_ASSIGN, CONTROL_IN_IMPLICIT, DISCARDED, EXPRESSION_CLOSE, EXPRESSION_END, EXPRESSION_START, HERECOMMENT_ILLEGAL, HEREDOC_DOUBLE, HEREDOC_INDENT, HEREDOC_SINGLE, HEREGEX, HEREGEX_COMMENT, HERE_JSTOKEN, IDENTIFIER, IMPLICIT_CALL, IMPLICIT_END, IMPLICIT_FUNC, IMPLICIT_UNSPACED_CALL, INDENTABLE_CLOSERS, INDEXABLE, INVERSES, JSTOKEN, JS_KEYWORDS, LINEBREAKS, LINE_BREAK, LINE_CONTINUER, MATH, MULTI_DENT, NOT_REGEX, NUMBER, OPERATOR, POSSIBLY_DIVISION, REGEX, REGEX_FLAGS, REGEX_ILLEGAL, REGEX_INVALID_ESCAPE, RELATION, RESERVED, RIP_ALIASES, RIP_ALIAS_MAP, RIP_KEYWORDS, Rewriter, SHIFT, SINGLE_CLOSERS, SINGLE_LINERS, STRICT_PROSCRIBED, STRING_DOUBLE, STRING_INVALID_ESCAPE, STRING_SINGLE, STRING_START, TRAILING_SPACES, UNARY, UNARY_MATH, UNFINISHED, VALID_FLAGS, WHITESPACE, addTokenData, generate, isForFrom, k, key, left, len, moveComments, right, indexOf = [].indexOf, slice = [].slice, hasProp = {}.hasOwnProperty;

// The Rip Lexer. Uses a series of token-matching regexes to attempt
// matches against the beginning of the source code. When a match is found,
// a token is produced, we consume the match, and start again. Tokens are in the
// form:
//
//     [tag, value, locationData]
//
// where locationData is {first_line, first_column, last_line, last_column, last_line_exclusive, last_column_exclusive}.
// These are read by the parser in the `parser.lexer` function defined in rip.rip.

// Helper Functions (inlined from helpers.js)
// --------------------------------------------

// Repeat a string `n` times.
var repeat = function(str, n) {
  var res = '';
  while (n > 0) {
    if (n & 1) res += str;
    n >>>= 1;
    str += str;
  }
  return res;
};

// Count the number of occurrences of a string in a string.
var count = function(string, substr) {
  var num = 0, pos = 0;
  if (!substr.length) return 1 / 0;
  while (pos = 1 + string.indexOf(substr, pos)) num++;
  return num;
};

// Extend a source object with the properties of another object (shallow copy).
var extend = function(object, properties) {
  for (var key in properties) {
    object[key] = properties[key];
  }
  return object;
};

// Merge objects, returning a fresh copy with attributes from both sides.
var merge = function(options, overrides) {
  return extend(extend({}, options), overrides);
};

// Return a flattened version of an array.
var flatten = function(array) {
  return array.flat(2e308);
};

// Build a list of all comments attached to tokens.
var extractAllCommentTokens = function(tokens) {
  var allCommentsObj = {}, sortedKeys, results = [];
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    if (token.comments) {
      for (var j = 0; j < token.comments.length; j++) {
        var comment = token.comments[j];
        var commentKey = comment.locationData.range[0];
        allCommentsObj[commentKey] = comment;
      }
    }
  }
  sortedKeys = Object.keys(allCommentsObj).sort((a, b) => a - b);
  for (var k = 0; k < sortedKeys.length; k++) {
    results.push(allCommentsObj[sortedKeys[k]]);
  }
  return results;
};

// Attach comments to a node.
var attachCommentsToNode = function(comments, node) {
  if (!comments || comments.length === 0) return;
  if (!node.comments) node.comments = [];
  node.comments.push(...comments);
};

// Parse number literals including binary, octal, hex.
var parseNumber = function(string) {
  if (string == null) return 0/0;
  var base = null;
  switch (string.charAt(1)) {
    case 'b': base = 2; break;
    case 'o': base = 8; break;
    case 'x': base = 16; break;
  }
  if (base != null) {
    return parseInt(string.slice(2).replace(/_/g, ''), base);
  } else {
    return parseFloat(string.replace(/_/g, ''));
  }
};

// Syntax error formatting and throwing.
var syntaxErrorToString = function() {
  if (!(this.code && this.location)) {
    return Error.prototype.toString.call(this);
  }
  var {first_line, first_column, last_line, last_column} = this.location;
  if (last_line == null) last_line = first_line;
  if (last_column == null) last_column = first_column;

  var filename = this.filename || '[stdin]';
  if (filename.startsWith('<anonymous')) filename = '[stdin]';

  var codeLine = this.code.split('\n')[first_line];
  var start = first_column;
  var end = first_line === last_line ? last_column + 1 : codeLine.length;
  var marker = codeLine.slice(0, start).replace(/[^\s]/g, ' ') + repeat('^', end - start);

  // Check for color support
  var colorsEnabled = typeof process !== "undefined" && process !== null &&
                      process.stdout?.isTTY && !process.env?.NODE_DISABLE_COLORS;

  if (this.colorful != null ? this.colorful : colorsEnabled) {
    var colorize = (str) => `\x1B[1;31m${str}\x1B[0m`;
    codeLine = codeLine.slice(0, start) + colorize(codeLine.slice(start, end)) + codeLine.slice(end);
    marker = colorize(marker);
  }

  return `${filename}:${first_line + 1}:${first_column + 1}: error: ${this.message}\n${codeLine}\n${marker}`;
};

var throwSyntaxError = function(message, location) {
  var error = new SyntaxError(message);
  error.location = location;
  error.toString = syntaxErrorToString;
  error.stack = error.toString();
  throw error;
};

// Unicode code point handling for regex.
var UNICODE_CODE_POINT_ESCAPE = /(\\\\)|\\u\{([\da-fA-F]+)\}/g;

var unicodeCodePointToUnicodeEscapes = function(codePoint) {
  var toUnicodeEscape = function(val) {
    var str = val.toString(16);
    return `\\u${repeat('0', 4 - str.length)}${str}`;
  };
  if (codePoint < 0x10000) {
    return toUnicodeEscape(codePoint);
  }
  // surrogate pair
  var high = Math.floor((codePoint - 0x10000) / 0x400) + 0xD800;
  var low = (codePoint - 0x10000) % 0x400 + 0xDC00;
  return `${toUnicodeEscape(high)}${toUnicodeEscape(low)}`;
};

var replaceUnicodeCodePointEscapes = function(str, {flags, error, delimiter = ''} = {}) {
  var shouldReplace = (flags != null) && indexOf.call(flags, 'u') < 0;
  return str.replace(UNICODE_CODE_POINT_ESCAPE, function(match, escapedBackslash, codePointHex, offset) {
    if (escapedBackslash) return escapedBackslash;
    var codePointDecimal = parseInt(codePointHex, 16);
    if (codePointDecimal > 0x10ffff) {
      error("unicode code point escapes greater than \\u{10ffff} are not allowed", {
        offset: offset + delimiter.length,
        length: codePointHex.length + 4
      });
    }
    if (!shouldReplace) return match;
    return unicodeCodePointToUnicodeEscapes(codePointDecimal);
  });
};

// The Lexer Class
// ---------------

  // The Lexer class reads a stream of Rip and divvies it up into tagged
// tokens. Some potential ambiguity in the grammar has been avoided by
// pushing some extra smarts into the Lexer.
export var Lexer = class Lexer {
  constructor() {
    // Throws an error at either a given offset from the current chunk or at the
    // location of a token (`token[2]`).
    this.error = this.error.bind(this);
  }

  // **tokenize** is the Lexer's main method. Scan by attempting to match tokens
  // one at a time, using a regular expression anchored at the start of the
  // remaining code, or a custom recursive token-matching method
  // (for interpolations). When the next token has been recorded, we move forward
  // within the code past the token, and begin again.
  //
  // Each tokenizing method is responsible for returning the number of characters
  // it has consumed.
  //
  // Before returning the token stream, run it through the [Rewriter](rewriter.html).
  tokenize(code, opts = {}) {
    var consumed, end, i, ref;
    this.indent = 0; // The current indentation level.
    this.baseIndent = 0; // The overall minimum indentation level.
    this.overIndent = 0; // The over-indentation at the current level.
    this.outdebt = 0; // The under-outdentation at the current level.
    this.indents = []; // The stack of all current indentation levels.
    this.indentLiteral = ''; // The indentation.
    this.ends = []; // The stack for pairing up tokens.
    this.tokens = []; // Stream of parsed tokens in the form `['TYPE', value, location data]`.
    this.seenFor = false; // Used to recognize `FORIN`, `FOROF` and `FORFROM` tokens.
    this.seenImport = false; // Used to recognize `IMPORT FROM? AS?` tokens.
    this.seenExport = false; // Used to recognize `EXPORT FROM? AS?` tokens.
    this.importSpecifierList = false; // Used to identify when in an `IMPORT {...} FROM? ...`.
    this.exportSpecifierList = false; // Used to identify when in an `EXPORT {...} FROM? ...`.
    this.chunkLine = opts.line || 0; // The start line for the current @chunk.
    this.chunkColumn = opts.column || 0; // The start column of the current @chunk.
    this.chunkOffset = opts.offset || 0; // The start offset for the current @chunk.
    this.locTweaks = opts.locTweaks || {};
    code = this.clean(code); // The stripped, cleaned original source code.

    // At every position, run through this list of attempted matches,
    // short-circuiting if any of them succeed. Their order determines precedence:
    // `@literalToken` is the fallback catch-all.
    i = 0;
    while (this.chunk = code.slice(i)) {
      consumed = this.identifierToken() || this.commentToken() || this.whitespaceToken() || this.lineToken() || this.stringToken() || this.numberToken() || this.regexToken() || this.jsToken() || this.literalToken();
      // Update position.
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
    return (new Rewriter()).rewrite(this.tokens);
  }

  // Preprocess the code to remove leading and trailing whitespace, carriage
  // returns, etc.
  clean(code) {
    var base, thusFar;
    thusFar = 0;
    if (code.charCodeAt(0) === BOM) {
      code = code.slice(1);
      this.locTweaks[0] = 1;
      thusFar += 1;
    }
    if (WHITESPACE.test(code)) {
      code = `\n${code}`;
      this.chunkLine--;
      if ((base = this.locTweaks)[0] == null) {
        base[0] = 0;
      }
      this.locTweaks[0] -= 1;
    }
    return code.replace(/\r/g, (match, offset) => {
      this.locTweaks[thusFar + offset] = 1;
      return '';
    }).replace(TRAILING_SPACES, '');
  }

  // Tokenizers
  // ----------

    // Matches identifying literals: variables, keywords, method names, etc.
  // Check to ensure that JavaScript reserved words aren't being used as
  // identifiers. Because Rip reserves a handful of keywords that are
  // allowed in JavaScript, we're careful not to tag them as keywords when
  // referenced as property names here, so you can still do `jQuery.is()` even
  // though `is` means `===` otherwise.
  identifierToken() {
    var afterNot, alias, colon, colonOffset, colonToken, id, idLength, input, match, poppedToken, prev, prevprev, ref, ref1, ref10, ref11, ref12, ref2, ref3, ref4, ref5, ref6, ref7, ref8, ref9, regExSuper, sup, tag, tagToken, tokenData;
    if (!(match = IDENTIFIER.exec(this.chunk))) {
      return 0;
    }
    [input, id, colon] = match;
    // Preserve length of id for location data
    idLength = id.length;
    poppedToken = void 0;
    if (id === 'own' && this.tag() === 'FOR') {
      this.token('OWN', id);
      return id.length;
    }
    if (id === 'from' && this.tag() === 'YIELD') {
      this.token('FROM', id);
      return id.length;
    }
    if (id === 'as' && this.seenImport) {
      if (this.value() === '*') {
        this.tokens[this.tokens.length - 1][0] = 'IMPORT_ALL';
      } else if (ref = this.value(true), indexOf.call(RIP_KEYWORDS, ref) >= 0) {
        prev = this.prev();
        [prev[0], prev[1]] = ['IDENTIFIER', this.value(true)];
      }
      if ((ref1 = this.tag()) === 'DEFAULT' || ref1 === 'IMPORT_ALL' || ref1 === 'IDENTIFIER') {
        this.token('AS', id);
        return id.length;
      }
    }
    if (id === 'as' && this.seenExport) {
      if ((ref2 = this.tag()) === 'IDENTIFIER' || ref2 === 'DEFAULT') {
        this.token('AS', id);
        return id.length;
      }
      if (ref3 = this.value(true), indexOf.call(RIP_KEYWORDS, ref3) >= 0) {
        prev = this.prev();
        [prev[0], prev[1]] = ['IDENTIFIER', this.value(true)];
        this.token('AS', id);
        return id.length;
      }
    }
    if (id === 'default' && this.seenExport && ((ref4 = this.tag()) === 'EXPORT' || ref4 === 'AS')) {
      this.token('DEFAULT', id);
      return id.length;
    }
    // REMOVED: assert keyword handling
    // Modern JS uses 'with' for import attributes, not 'assert'
    // Codegen auto-adds 'with { type: "json" }' for .json files
    // So grammar doesn't need ASSERT token at all
    if (id === 'do' && (regExSuper = /^(\s*super)(?!\(\))/.exec(this.chunk.slice(3)))) {
      this.token('SUPER', 'super');
      this.token('CALL_START', '(');
      this.token('CALL_END', ')');
      [input, sup] = regExSuper;
      return sup.length + 3;
    }
    prev = this.prev();
    tag = colon || (prev != null) && (((ref5 = prev[0]) === '.' || ref5 === '?.' || ref5 === '::' || ref5 === '?::') || !prev.spaced && prev[0] === '@') ? 'PROPERTY' : 'IDENTIFIER';
    tokenData = {};
    if (tag === 'IDENTIFIER' && (indexOf.call(JS_KEYWORDS, id) >= 0 || indexOf.call(RIP_KEYWORDS, id) >= 0) && !(this.exportSpecifierList && indexOf.call(RIP_KEYWORDS, id) >= 0)) {
      tag = id.toUpperCase();
      if (tag === 'WHEN' && (ref6 = this.tag(), indexOf.call(LINE_BREAK, ref6) >= 0)) {
        tag = 'LEADING_WHEN';
      } else if (tag === 'FOR') {
        this.seenFor = {
          endsLength: this.ends.length
        };
      } else if (tag === 'UNLESS') {
        // Keep UNLESS as-is (don't convert to IF)
        // Rip's grammar and codegen handle unless properly with negation
        // tag = 'IF';  // ← DISABLED - was losing negation!
      } else if (tag === 'IMPORT') {
        this.seenImport = true;
      } else if (tag === 'EXPORT') {
        this.seenExport = true;
      } else if (indexOf.call(UNARY, tag) >= 0) {
        tag = 'UNARY';
      } else if (indexOf.call(RELATION, tag) >= 0) {
        if (tag !== 'INSTANCEOF' && this.seenFor) {
          tag = 'FOR' + tag;
          this.seenFor = false;
        } else {
          tag = 'RELATION';
          if (this.value() === '!') {
            poppedToken = this.tokens.pop();
            tokenData.invert = (ref7 = (ref8 = poppedToken.data) != null ? ref8.original : void 0) != null ? ref7 : poppedToken[1];
          }
        }
      }
    } else if (tag === 'IDENTIFIER' && this.seenFor && id === 'from' && isForFrom(prev)) {
      tag = 'FORFROM';
      this.seenFor = false;
    // Throw an error on attempts to use `get` or `set` as keywords, or
    // what Rip would normally interpret as calls to functions named
    // `get` or `set`, i.e. `get({foo: function () {}})`.
    } else if (tag === 'PROPERTY' && prev) {
      if (prev.spaced && (ref9 = prev[0], indexOf.call(CALLABLE, ref9) >= 0) && /^[gs]et$/.test(prev[1]) && this.tokens.length > 1 && ((ref10 = this.tokens[this.tokens.length - 2][0]) !== '.' && ref10 !== '?.' && ref10 !== '@')) {
        this.error(`'${prev[1]}' cannot be used as a keyword, or as a function call without parentheses`, prev[2]);
      } else if (prev[0] === '.' && this.tokens.length > 1 && (prevprev = this.tokens[this.tokens.length - 2])[0] === 'UNARY' && prevprev[1] === 'new') {
        prevprev[0] = 'NEW_TARGET';
      } else if (prev[0] === '.' && this.tokens.length > 1 && (prevprev = this.tokens[this.tokens.length - 2])[0] === 'IMPORT' && prevprev[1] === 'import') {
        this.seenImport = false;
        prevprev[0] = 'IMPORT_META';
      } else if (this.tokens.length > 2) {
        prevprev = this.tokens[this.tokens.length - 2];
        if (((ref11 = prev[0]) === '@' || ref11 === 'THIS') && prevprev && prevprev.spaced && /^[gs]et$/.test(prevprev[1]) && ((ref12 = this.tokens[this.tokens.length - 3][0]) !== '.' && ref12 !== '?.' && ref12 !== '@')) {
          this.error(`'${prevprev[1]}' cannot be used as a keyword, or as a function call without parentheses`, prevprev[2]);
        }
      }
    }
    if (tag === 'IDENTIFIER' && indexOf.call(RESERVED, id) >= 0) {
      this.error(`reserved word '${id}'`, {
        length: id.length
      });
    }
    if (!(tag === 'PROPERTY' || this.exportSpecifierList || this.importSpecifierList)) {
      // Transform 'is not' → 'isnt' for cleaner syntax (before alias processing)
      // Only transform when 'not' is followed by a non-boolean value to avoid breaking chains
      if (id === 'is' && this.chunk.slice(idLength, idLength + 4) === ' not') {
        // Look ahead to see what comes after ' not '
        afterNot = this.chunk.slice(idLength + 4).trim();
        // Only transform if NOT followed by 'false', 'true' (which could be part of chains)
        if (!afterNot.match(/^(false|true)\s+(is|isnt|==|!=)/)) {
          id = 'isnt';
          idLength += 4; // Consume ' not' as well
        }
      }
      if (indexOf.call(RIP_ALIASES, id) >= 0) {
        alias = id;
        id = RIP_ALIAS_MAP[id];
        tokenData.original = alias;
      }
      tag = (function() {
        switch (id) {
          case '!':
            return 'UNARY';
          case '==':
          case '!=':
            return 'COMPARE';
          case 'true':
          case 'false':
            return 'BOOL';
          case 'break':
          case 'continue':
          case 'debugger':
            return 'STATEMENT';
          case '&&':
          case '||':
            return id;
          default:
            return tag;
        }
      })();
    }

    // Check for async sigils on identifiers
    // Trailing ! (dammit operator) - forces await on call (.await = true)
    // Leading & (punt operator) - prevents await on call (.await = false) (future feature)
    // No sigil - use default mode (.await = undefined)
    const originalIdLength = idLength;  // Keep original length for consumption

    // Only check for trailing ! if id is more than just '!' (to avoid aliased 'not')
    if (id.length > 1 && id.endsWith('!')) {
      tokenData.await = true;  // Force await
      id = id.slice(0, -1);    // Strip ! from identifier name
    }
    // TODO: Punt operator (when implemented)
    // if (id.startsWith('&')) {
    //   tokenData.await = false;  // Prevent await
    //   id = id.slice(1);
    // }

    tagToken = this.token(tag, id, {
      length: originalIdLength,  // Use original length (includes sigils)
      data: tokenData
    });
    if (alias) {
      tagToken.origin = [tag, alias, tagToken[2]];
    }
    if (poppedToken) {
      [tagToken[2].first_line, tagToken[2].first_column, tagToken[2].range[0]] = [poppedToken[2].first_line, poppedToken[2].first_column, poppedToken[2].range[0]];
    }
    if (colon) {
      colonOffset = input.lastIndexOf(':');
      colonToken = this.token(':', ':', {
        offset: colonOffset
      });
    }
    // Return the actual consumed length (accounts for 'is not' → 'isnt' transformation and sigils)
    if (colon) {
      return originalIdLength + colon.length;
    } else {
      return originalIdLength;
    }
  }

  // Matches and consumes comments. The comments are taken out of the token
  // stream and saved for later, to be reinserted into the output after
  // everything has been parsed and the JavaScript code generated.
  commentToken(chunk = this.chunk, {heregex, returnCommentTokens = false, offsetInChunk = 0} = {}) {
    var commentAttachment, commentAttachments, commentWithSurroundingWhitespace, content, contents, getIndentSize, hasSeenFirstCommentLine, hereComment, hereLeadingWhitespace, hereTrailingWhitespace, i, indentSize, leadingNewline, leadingNewlineOffset, leadingNewlines, leadingWhitespace, length, lineComment, match, matchIllegal, noIndent, nonInitial, placeholderToken, precededByBlankLine, precedingNonCommentLines, prev;
    if (!(match = chunk.match(COMMENT))) {
      return 0;
    }
    [commentWithSurroundingWhitespace, hereLeadingWhitespace, hereComment, hereTrailingWhitespace, lineComment] = match;
    contents = null;
    // Does this comment follow code on the same line?
    leadingNewline = /^\s*\n+\s*#/.test(commentWithSurroundingWhitespace);
    if (hereComment) {
      matchIllegal = HERECOMMENT_ILLEGAL.exec(hereComment);
      if (matchIllegal) {
        this.error(`block comments cannot contain ${matchIllegal[0]}`, {
          offset: '###'.length + matchIllegal.index,
          length: matchIllegal[0].length
        });
      }
      // Parse indentation or outdentation as if this block comment didn't exist.
      chunk = chunk.replace(`###${hereComment}###`, '');
      // Remove leading newlines, like `Rewriter::removeLeadingNewlines`, to
      // avoid the creation of unwanted `TERMINATOR` tokens.
      chunk = chunk.replace(/^\n+/, '');
      this.lineToken({chunk});
      // Pull out the ###-style comment's content, and format it.
      content = hereComment;
      contents = [
        {
          content,
          length: commentWithSurroundingWhitespace.length - hereLeadingWhitespace.length - hereTrailingWhitespace.length,
          leadingWhitespace: hereLeadingWhitespace
        }
      ];
    } else {
      // The `COMMENT` regex captures successive line comments as one token.
      // Remove any leading newlines before the first comment, but preserve
      // blank lines between line comments.
      leadingNewlines = '';
      content = lineComment.replace(/^(\n*)/, function(leading) {
        leadingNewlines = leading;
        return '';
      });
      precedingNonCommentLines = '';
      hasSeenFirstCommentLine = false;
      contents = content.split('\n').map(function(line, index) {
        var comment, leadingWhitespace;
        if (!(line.indexOf('#') > -1)) {
          precedingNonCommentLines += `\n${line}`;
          return;
        }
        leadingWhitespace = '';
        content = line.replace(/^([ |\t]*)#/, function(_, whitespace) {
          leadingWhitespace = whitespace;
          return '';
        });
        comment = {
          content,
          length: '#'.length + content.length,
          leadingWhitespace: `${!hasSeenFirstCommentLine ? leadingNewlines : ''}${precedingNonCommentLines}${leadingWhitespace}`,
          precededByBlankLine: !!precedingNonCommentLines
        };
        hasSeenFirstCommentLine = true;
        precedingNonCommentLines = '';
        return comment;
      }).filter(function(comment) {
        return comment;
      });
    }
    getIndentSize = function({leadingWhitespace, nonInitial}) {
      var lastNewlineIndex;
      lastNewlineIndex = leadingWhitespace.lastIndexOf('\n');
      if ((hereComment != null) || !nonInitial) {
        if (!(lastNewlineIndex > -1)) {
          return null;
        }
      } else {
        if (lastNewlineIndex == null) {
          lastNewlineIndex = -1;
        }
      }
      return leadingWhitespace.length - 1 - lastNewlineIndex;
    };
    commentAttachments = (function() {
      var k, len, results;
      results = [];
      for (i = k = 0, len = contents.length; k < len; i = ++k) {
        ({content, length, leadingWhitespace, precededByBlankLine} = contents[i]);
        nonInitial = i !== 0;
        leadingNewlineOffset = nonInitial ? 1 : 0;
        offsetInChunk += leadingNewlineOffset + leadingWhitespace.length;
        indentSize = getIndentSize({leadingWhitespace, nonInitial});
        noIndent = (indentSize == null) || indentSize === -1;
        commentAttachment = {
          content,
          here: hereComment != null,
          newLine: leadingNewline || nonInitial, // Line comments after the first one start new lines, by definition.
          locationData: this.makeLocationData({offsetInChunk, length}),
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
    }).call(this);
    prev = this.prev();
    if (!prev) {
      // If there's no previous token, create a placeholder token to attach
      // this comment to; and follow with a newline.
      commentAttachments[0].newLine = true;
      this.lineToken({
        chunk: this.chunk.slice(commentWithSurroundingWhitespace.length),
        offset: commentWithSurroundingWhitespace.length // Set the indent.
      });
      placeholderToken = this.makeToken('JS', '', {
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

  // Matches and consumes non-meaningful whitespace. Tag the previous token
  // as being "spaced", because there are some cases where it makes a difference.
  whitespaceToken() {
    var match, nline, prev;
    if (!((match = WHITESPACE.exec(this.chunk)) || (nline = this.chunk.charAt(0) === '\n'))) {
      return 0;
    }
    prev = this.prev();
    if (prev) {
      prev[match ? 'spaced' : 'newLine'] = true;
    }
    if (match) {
      return match[0].length;
    } else {
      return 0;
    }
  }

  // Matches newlines, indents, and outdents, and determines which is which.
  // If we can detect that the current line is continued onto the next line,
  // then the newline is suppressed:
  //
  //     elements
  //       .each( ... )
  //       .map( ... )
  //
  // Keeps track of the level of indentation, because a single outdent token
  // can close multiple indents, so we need to know how far in we happen to be.
  lineToken({chunk = this.chunk, offset = 0} = {}) {
    var backslash, diff, endsContinuationLineIndentation, indent, match, minLiteralLength, newIndentLiteral, noNewlines, prev, ref, size;
    if (!(match = MULTI_DENT.exec(chunk))) {
      return 0;
    }
    indent = match[0];
    prev = this.prev();
    backslash = (prev != null ? prev[0] : void 0) === '\\';
    if (!((backslash || ((ref = this.seenFor) != null ? ref.endsLength : void 0) < this.ends.length) && this.seenFor)) {
      this.seenFor = false;
    }
    if (!((backslash && this.seenImport) || this.importSpecifierList)) {
      this.seenImport = false;
    }
    if (!((backslash && this.seenExport) || this.exportSpecifierList)) {
      this.seenExport = false;
    }
    size = indent.length - 1 - indent.lastIndexOf('\n');
    noNewlines = this.unfinished();
    newIndentLiteral = size > 0 ? indent.slice(-size) : '';
    if (!/^(.?)\1*$/.exec(newIndentLiteral)) {
      this.error('mixed indentation', {
        offset: indent.length
      });
      return indent.length;
    }
    minLiteralLength = Math.min(newIndentLiteral.length, this.indentLiteral.length);
    if (newIndentLiteral.slice(0, minLiteralLength) !== this.indentLiteral.slice(0, minLiteralLength)) {
      this.error('indentation mismatch', {
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
      this.token('INDENT', diff, {
        offset: offset + indent.length - size,
        length: size
      });
      this.indents.push(diff);
      this.ends.push({
        tag: 'OUTDENT'
      });
      this.outdebt = this.overIndent = 0;
      this.indent = size;
      this.indentLiteral = newIndentLiteral;
    } else if (size < this.baseIndent) {
      this.error('missing indentation', {
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

  // Helper: Get closing delimiter column position if it has only whitespace before it
  getHeredocClosingColumn(end, quoteLength) {
    const closingPos = end - quoteLength;

    // Find line start
    let lineStart = closingPos - 1;
    while (lineStart >= 0 && this.chunk[lineStart] !== '\n') {
      lineStart--;
    }
    lineStart++;

    // Check if only whitespace before closing
    const beforeClosing = this.chunk.slice(lineStart, closingPos);
    return /^\s*$/.test(beforeClosing) ? beforeClosing.length : null;
  }

  // Helper: Extract heredoc content from tokens
  extractHeredocContent(tokens) {
    const parts = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i][0] === 'NEOSTRING') {
        parts.push(tokens[i][1]);
      }
    }
    return parts.join('#{}');
  }

  // Helper: Find minimum indentation in heredoc content
  findMinimumIndent(doc) {
    let indent = null;
    let match;
    while (match = HEREDOC_INDENT.exec(doc)) {
      const attempt = match[1];
      if (indent === null || (0 < attempt.length && attempt.length < indent.length)) {
        indent = attempt;
      }
    }
    return indent;
  }

  // Helper: Choose between closing column and minimum indent
  selectHeredocIndent(closingColumn, minIndent) {
    if (closingColumn === null) {
      // No closing column detected, use minimum
      return minIndent;
    }

    if (minIndent === null) {
      // No content indent (empty or whitespace-only), use closing
      return ' '.repeat(closingColumn);
    }

    if (closingColumn <= minIndent.length) {
      // Closing at or left of content minimum - use closing
      return ' '.repeat(closingColumn);
    }

    // Closing right of content - use minimum (old behavior)
    return minIndent;
  }

  // Helper: Remove trailing whitespace-only line from tokens
  removeTrailingWhitespaceLine(tokens) {
    if (tokens.length === 0) return;

    const lastToken = tokens[tokens.length - 1];
    if (lastToken[0] !== 'NEOSTRING') return;

    // Check if last line is whitespace-only
    const lines = lastToken[1].split('\n');
    const lastLine = lines[lines.length - 1];

    if (/^\s*$/.test(lastLine)) {
      // Remove the trailing whitespace line
      lines.pop();
      lastToken[1] = lines.join('\n');
    }
  }

  // Matches strings, including multiline strings, as well as heredocs, with or without
  // interpolation.
  stringToken() {
    var attempt, delimiter, doc, end, heredoc, i, indent, match, prev, quote, ref, regex, token, tokens;
    [quote] = STRING_START.exec(this.chunk) || [];
    if (!quote) {
      return 0;
    }
    // If the preceding token is `from` and this is an import or export statement,
    // properly tag the `from`.
    prev = this.prev();
    if (prev && this.value() === 'from' && (this.seenImport || this.seenExport)) {
      prev[0] = 'FROM';
    }
    regex = (function() {
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
    })();
    ({
      tokens,
      index: end
    } = this.matchWithInterpolations(regex, quote));
    heredoc = quote.length === 3;
    if (heredoc) {
      // Detect closing delimiter position for visual baseline control
      const closingColumn = this.getHeredocClosingColumn(end, quote.length);

      // Get document content for analysis
      doc = this.extractHeredocContent(tokens);

      // Calculate minimum indentation from content
      indent = this.findMinimumIndent(doc);

      // Choose dedenting baseline intelligently
      indent = this.selectHeredocIndent(closingColumn, indent);

      // Clean up trailing whitespace when using minimum indent
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

  // Matches numbers, including decimals, hex, and exponential notation.
  // Be careful not to interfere with ranges in progress.
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
    tokenData = {parsedValue};
    tag = parsedValue === 2e308 ? 'INFINITY' : 'NUMBER';
    if (tag === 'INFINITY') {
      tokenData.original = number;
    }
    this.token(tag, number, {
      length: lexedLength,
      data: tokenData
    });
    return lexedLength;
  }

  // Matches regular expression literals, as well as multiline extended ones.
  // Lexing regular expressions is difficult to distinguish from division, so we
  // borrow some basic heuristics from JavaScript and Ruby.
  regexToken() {
    var body, closed, comment, commentIndex, commentOpts, commentTokens, comments, delimiter, end, flags, fullMatch, index, leadingWhitespace, match, matchedComment, origin, prev, ref, ref1, regex, tokens;
    switch (false) {
      case !(match = REGEX_ILLEGAL.exec(this.chunk)):
        this.error(`regular expressions cannot begin with ${match[2]}`, {
          offset: match.index + match[1].length
        });
        break;
      case !(match = this.matchWithInterpolations(HEREGEX, '///')):
        ({tokens, index} = match);
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
        commentTokens = flatten((function() {
          var k, len, results;
          results = [];
          for (k = 0, len = comments.length; k < len; k++) {
            commentOpts = comments[k];
            results.push(this.commentToken(commentOpts.comment, Object.assign(commentOpts, {
              heregex: true,
              returnCommentTokens: true
            })));
          }
          return results;
        }).call(this));
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
          this.error('missing / (unclosed regex)');
        }
        break;
      default:
        return 0;
    }
    [flags] = REGEX_FLAGS.exec(this.chunk.slice(index));
    end = index + flags.length;
    origin = this.makeToken('REGEX', null, {
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
        delimiter = body ? '/' : '///';
        if (body == null) {
          body = tokens[0][1];
        }
        this.validateUnicodeCodePointEscapes(body, {delimiter});
        // For heregex (delimiter === '///'), mark it with heregex metadata
        const tokenData = {delimiter};
        if (delimiter === '///') {
          tokenData.heregex = {flags};
        }
        this.token('REGEX', `/${body}/${flags}`, {
          length: end,
          origin,
          data: tokenData
        });
        break;
      default:
        this.token('REGEX_START', '(', {
          length: 0,
          origin,
          generated: true
        });
        this.token('IDENTIFIER', 'RegExp', {
          length: 0,
          generated: true
        });
        this.token('CALL_START', '(', {
          length: 0,
          generated: true
        });
        this.mergeInterpolationTokens(tokens, {
          double: true,
          heregex: {flags},
          endOffset: end - flags.length,
          quote: '///'
        }, (str) => {
          return this.validateUnicodeCodePointEscapes(str, {delimiter});
        });
        if (flags) {
          this.token(',', ',', {
            offset: index - 1,
            length: 0,
            generated: true
          });
          this.token('STRING', '"' + flags + '"', {
            offset: index,
            length: flags.length
          });
        }
        this.token(')', ')', {
          offset: end,
          length: 0,
          generated: true
        });
        this.token('REGEX_END', ')', {
          offset: end,
          length: 0,
          generated: true
        });
    }
    // Explicitly attach any heregex comments to the REGEX/REGEX_END token.
    if (commentTokens != null ? commentTokens.length : void 0) {
      addTokenData(this.tokens[this.tokens.length - 1], {
        heregexCommentTokens: commentTokens
      });
    }
    return end;
  }

  // Matches JavaScript interpolated directly into the source via backticks.
  jsToken() {
    var length, match, matchedHere, script;
    if (!(this.chunk.charAt(0) === '`' && (match = (matchedHere = HERE_JSTOKEN.exec(this.chunk)) || JSTOKEN.exec(this.chunk)))) {
      return 0;
    }
    // Convert escaped backticks to backticks, and escaped backslashes
    // just before escaped backticks to backslashes
    script = match[1];
    ({length} = match[0]);
    this.token('JS', script, {
      length,
      data: {
        here: !!matchedHere
      }
    });
    return length;
  }

  // We treat all other single characters as a token. E.g.: `( ) , . !`
  // Multi-character operators are also literal tokens, so that the parser can assign
  // the proper order of operations. There are some symbols that we tag specially
  // here. `;` and newlines are both treated as a `TERMINATOR`, we distinguish
  // parentheses that indicate a method call from regular parentheses, and so on.
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
    if (prev && indexOf.call(['=', ...COMPOUND_ASSIGN], value) >= 0) {
      skipToken = false;
      if (value === '=' && ((ref = prev[1]) === '||' || ref === '&&' || ref === '??') && !prev.spaced) {
        prev[0] = 'COMPOUND_ASSIGN';
        prev[1] += '=';
        if ((ref1 = prev.data) != null ? ref1.original : void 0) {
          prev.data.original += '=';
        }
        prev[2].range = [prev[2].range[0], prev[2].range[1] + 1];
        prev[2].last_column += 1;
        prev[2].last_column_exclusive += 1;
        prev = this.tokens[this.tokens.length - 2];
        skipToken = true;
      }
      if (prev && prev[0] !== 'PROPERTY') {
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
    if (value === '(' && (prev != null ? prev[0] : void 0) === 'IMPORT') {
      prev[0] = 'DYNAMIC_IMPORT';
    }
    if (value === '{' && this.seenImport) {
      this.importSpecifierList = true;
    } else if (this.importSpecifierList && value === '}') {
      this.importSpecifierList = false;
    } else if (value === '{' && (prev != null ? prev[0] : void 0) === 'EXPORT') {
      this.exportSpecifierList = true;
    } else if (this.exportSpecifierList && value === '}') {
      this.exportSpecifierList = false;
    }
    if (value === ';') {
      if (ref3 = prev != null ? prev[0] : void 0, indexOf.call(['=', ...UNFINISHED], ref3) >= 0) {
        this.error('unexpected ;');
      }
      this.seenFor = this.seenImport = this.seenExport = false;
      tag = 'TERMINATOR';
    } else if (value === '*' && (prev != null ? prev[0] : void 0) === 'EXPORT') {
      tag = 'EXPORT_ALL';
    } else if (indexOf.call(MATH, value) >= 0) {
      tag = 'MATH';
    } else if (indexOf.call(COMPARE, value) >= 0) {
      tag = 'COMPARE';
    } else if (indexOf.call(COMPOUND_ASSIGN, value) >= 0) {
      tag = 'COMPOUND_ASSIGN';
    } else if (indexOf.call(UNARY, value) >= 0) {
      tag = 'UNARY';
    } else if (indexOf.call(UNARY_MATH, value) >= 0) {
      tag = 'UNARY_MATH';
    } else if (indexOf.call(SHIFT, value) >= 0) {
      tag = 'SHIFT';
    } else if (value === '?' && (prev != null ? prev.spaced : void 0)) {
      tag = 'SPACE?';  // ? with space before it (ie - 'x ?' not 'x?')
    } else if (prev) {
      if (value === '(' && !prev.spaced && (ref4 = prev[0], indexOf.call(CALLABLE, ref4) >= 0)) {
        if (prev[0] === '?') {
          prev[0] = 'FUNC_EXIST';
        } else if (prev[0] === '?.') {
          prev[0] = 'ES6_OPTIONAL_CALL';
        }
        tag = 'CALL_START';
      } else if (value === '[' && (((ref5 = prev[0], indexOf.call(INDEXABLE, ref5) >= 0) && !prev.spaced) || (prev[0] === '::'))) { // `.prototype` can't be a method you can call.
        tag = 'INDEX_START';
        switch (prev[0]) {
          case '?':
            prev[0] = 'INDEX_SOAK';
            break;
          case '?.':
            prev[0] = 'ES6_OPTIONAL_INDEX';
            break;
        }
      }
    }
    token = this.makeToken(tag, value);
    switch (value) {
      case '(':
      case '{':
      case '[':
        this.ends.push({
          tag: INVERSES[value],
          origin: token
        });
        break;
      case ')':
      case '}':
      case ']':
        this.pair(value);
    }
    this.tokens.push(this.makeToken(tag, value));
    return value.length;
  }

  // Record an outdent token or multiple tokens, if we happen to be moving back
  // inwards past several recorded indents. Sets new @indent value.
  outdentToken({moveOut, noNewlines, outdentLength = 0, offset = 0, indentSize, endsContinuationLineIndentation}) {
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
        // pair might call outdentToken, so preserve decreasedIndent
        this.pair('OUTDENT');
        this.token('OUTDENT', moveOut, {
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
    if (!(this.tag() === 'TERMINATOR' || noNewlines)) {
      terminatorToken = this.token('TERMINATOR', '\n', {
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

  // Generate a newline token. Consecutive newlines get merged together.
  newlineToken(offset) {
    this.suppressSemicolons();
    if (this.tag() !== 'TERMINATOR') {
      this.token('TERMINATOR', '\n', {
        offset,
        length: 0
      });
    }
    return this;
  }

  // Use a `\` at a line-ending to suppress the newline.
  // The slash is removed here once its job is done.
  suppressNewlines() {
    var prev;
    prev = this.prev();
    if (prev[1] === '\\') {
      if (prev.comments && this.tokens.length > 1) {
        // `@tokens.length` should be at least 2 (some code, then `\`).
        // If something puts a `\` after nothing, they deserve to lose any
        // comments that trail it.
        attachCommentsToNode(prev.comments, this.tokens[this.tokens.length - 2]);
      }
      this.tokens.pop();
    }
    return this;
  }

  // Token Manipulators
  // ------------------

    // A source of ambiguity in our grammar used to be parameter lists in function
  // definitions versus argument lists in function calls. Walk backwards, tagging
  // parameters specially in order to make things easier for the parser.
  tagParameters() {
    var i, paramEndToken, stack, tok, tokens;
    if (this.tag() !== ')') {
      return this.tagDoIife();
    }
    stack = [];
    ({tokens} = this);
    i = tokens.length;
    paramEndToken = tokens[--i];
    paramEndToken[0] = 'PARAM_END';
    while (tok = tokens[--i]) {
      switch (tok[0]) {
        case ')':
          stack.push(tok);
          break;
        case '(':
        case 'CALL_START':
          if (stack.length) {
            stack.pop();
          } else if (tok[0] === '(') {
            tok[0] = 'PARAM_START';
            return this.tagDoIife(i - 1);
          } else {
            paramEndToken[0] = 'CALL_END';
            return this;
          }
      }
    }
    return this;
  }

  // Tag `do` followed by a function differently than `do` followed by eg an
  // identifier to allow for different grammar precedence
  tagDoIife(tokenIndex) {
    var tok;
    tok = this.tokens[tokenIndex != null ? tokenIndex : this.tokens.length - 1];
    if ((tok != null ? tok[0] : void 0) !== 'DO') {
      return this;
    }
    tok[0] = 'DO_IIFE';
    return this;
  }

  // Close up all remaining open blocks at the end of the file.
  closeIndentation() {
    return this.outdentToken({
      moveOut: this.indent,
      indentSize: 0
    });
  }

  // Match the contents of a delimited token and expand variables and expressions
  // inside it using Ruby-like notation for substitution of arbitrary
  // expressions.
  //
  //     "Hello #{name.capitalize()}."
  //
  // If it encounters an interpolation, this method will recursively create a new
  // Lexer and tokenize until the `{` of `#{` is balanced with a `}`.
  //
  //  - `regex` matches the contents of a token (but not `delimiter`, and not
  //    `#{` if interpolations are desired).
  //  - `delimiter` is the delimiter of the token. Examples are `'`, `"`, `'''`,
  //    `"""` and `///`.
  //  - `closingDelimiter` can be customized
  //  - `interpolators` matches the start of an interpolation
  //
  // This method allows us to have strings within interpolations within strings,
  // ad infinitum.
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
        isRegex: delimiter.charAt(0) === '/',
        offsetInChunk
      });
      // Push a fake `'NEOSTRING'` token, which will get turned into a real string later.
      tokens.push(this.makeToken('NEOSTRING', strPart, {
        offset: offsetInChunk
      }));
      str = str.slice(strPart.length);
      offsetInChunk += strPart.length;
      if (!(match = interpolators.exec(str))) {
        break;
      }
      [interpolator] = match;
      // To remove the `#` in `#{`.
      interpolationOffset = interpolator.length - 1;
      [line, column, offset] = this.getLineAndColumnFromChunk(offsetInChunk + interpolationOffset);
      rest = str.slice(interpolationOffset);
      ({
        tokens: nested,
        index
      } = new Lexer().tokenize(rest, {
        line,
        column,
        offset,
        untilBalanced: true,
        locTweaks: this.locTweaks
      }));
      // Account for the `#` in `#{`.
      index += interpolationOffset;
      braceInterpolator = str[index - 1] === '}';
      if (braceInterpolator) {
        // Turn the leading and trailing `{` and `}` into parentheses. Unnecessary
        // parentheses will be removed later.
        [open] = nested, [close] = slice.call(nested, -1);
        open[0] = 'INTERPOLATION_START';
        open[1] = '(';
        open[2].first_column -= interpolationOffset;
        open[2].range = [open[2].range[0] - interpolationOffset, open[2].range[1]];
        close[0] = 'INTERPOLATION_END';
        close[1] = ')';
        close.origin = ['', 'end of interpolation', close[2]];
      }
      if (((ref = nested[1]) != null ? ref[0] : void 0) === 'TERMINATOR') {
        // Remove leading `'TERMINATOR'` (if any).
        nested.splice(1, 1);
      }
      if (((ref1 = nested[nested.length - 3]) != null ? ref1[0] : void 0) === 'INDENT' && nested[nested.length - 2][0] === 'OUTDENT') {
        // Remove trailing `'INDENT'/'OUTDENT'` pair (if any).
        nested.splice(-3, 2);
      }
      if (!braceInterpolator) {
        // We are not using `{` and `}`, so wrap the interpolated tokens instead.
        open = this.makeToken('INTERPOLATION_START', '(', {
          offset: offsetInChunk,
          length: 0,
          generated: true
        });
        close = this.makeToken('INTERPOLATION_END', ')', {
          offset: offsetInChunk + index,
          length: 0,
          generated: true
        });
        nested = [open, ...nested, close];
      }
      // Push a fake `'TOKENS'` token, which will get turned into real tokens later.
      tokens.push(['TOKENS', nested]);
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

  // Merge the array `tokens` of the fake token types `'TOKENS'` and `'NEOSTRING'`
  // (as returned by `matchWithInterpolations`) into the token stream. The value
  // of `'NEOSTRING'`s are converted using `fn` and turned into strings using
  // `options` first.
  mergeInterpolationTokens(tokens, options, fn) {
    var $, converted, double, endOffset, firstIndex, heregex, i, indent, k, l, lastToken, len, len1, locationToken, lparen, placeholderToken, quote, ref, ref1, rparen, tag, token, tokensToPush, val, value;
    ({quote, indent, double, heregex, endOffset} = options);
    if (tokens.length > 1) {
      lparen = this.token('STRING_START', '(', {
        length: (ref = quote != null ? quote.length : void 0) != null ? ref : 0,
        data: {quote},
        generated: !(quote != null ? quote.length : void 0)
      });
    }
    firstIndex = this.tokens.length;
    $ = tokens.length - 1;
    for (i = k = 0, len = tokens.length; k < len; i = ++k) {
      token = tokens[i];
      [tag, value] = token;
      switch (tag) {
        case 'TOKENS':
          // There are comments (and nothing else) in this interpolation.
          if (value.length === 2 && (value[0].comments || value[1].comments)) {
            placeholderToken = this.makeToken('JS', '', {
              generated: true
            });
            // Use the same location data as the first parenthesis.
            placeholderToken[2] = value[0][2];
            for (l = 0, len1 = value.length; l < len1; l++) {
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
          // Push all the tokens in the fake `'TOKENS'` token. These already have
          // sane location data.
          locationToken = value[0];
          tokensToPush = value;
          break;
        case 'NEOSTRING':
          // Convert `'NEOSTRING'` into `'STRING'`.
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
          addTokenData(token, {indent, quote, double});
          if (heregex) {
            addTokenData(token, {heregex});
          }
          token[0] = 'STRING';
          token[1] = '"' + converted + '"';
          if (tokens.length === 1 && (quote != null)) {
            token[2].first_column -= quote.length;
            if (token[1].substr(-2, 1) === '\n') {
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
        'STRING',
        null,
        {
          first_line: lparen[2].first_line,
          first_column: lparen[2].first_column,
          last_line: lastToken[2].last_line,
          last_column: lastToken[2].last_column,
          last_line_exclusive: lastToken[2].last_line_exclusive,
          last_column_exclusive: lastToken[2].last_column_exclusive,
          range: [lparen[2].range[0],
        lastToken[2].range[1]]
        }
      ];
      if (!(quote != null ? quote.length : void 0)) {
        lparen[2] = lparen.origin[2];
      }
      return rparen = this.token('STRING_END', ')', {
        offset: endOffset - (quote != null ? quote : '').length,
        length: (ref1 = quote != null ? quote.length : void 0) != null ? ref1 : 0,
        generated: !(quote != null ? quote.length : void 0)
      });
    }
  }

  // Pairs up a closing token, ensuring that all listed pairs of tokens are
  // correctly balanced throughout the course of the token stream.
  pair(tag) {
    var lastIndent, prev, ref, ref1, wanted;
    ref = this.ends, [prev] = slice.call(ref, -1);
    if (tag !== (wanted = prev != null ? prev.tag : void 0)) {
      if ('OUTDENT' !== wanted) {
        this.error(`unmatched ${tag}`);
      }
      // Auto-close `INDENT` to support syntax like this:
      //
      //     el.click((event) ->
      //       el.hide())
      //
      ref1 = this.indents, [lastIndent] = slice.call(ref1, -1);
      this.outdentToken({
        moveOut: lastIndent,
        noNewlines: true
      });
      return this.pair(tag);
    }
    return this.ends.pop();
  }

  // Helpers
  // -------

    // Compensate for the things we strip out initially (e.g. carriage returns)
  // so that location data stays accurate with respect to the original source file.
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

  // Returns the line and column number from an offset into the current chunk.
  //
  // `offset` is a number of characters into `@chunk`.
  getLineAndColumnFromChunk(offset) {
    var column, columnCompensation, compensation, lastLine, lineCount, previousLinesCompensation, ref, string;
    compensation = this.getLocationDataCompensation(this.chunkOffset, this.chunkOffset + offset);
    if (offset === 0) {
      return [this.chunkLine, this.chunkColumn + compensation, this.chunkOffset + compensation];
    }
    if (offset >= this.chunk.length) {
      string = this.chunk;
    } else {
      string = this.chunk.slice(0, +(offset - 1) + 1 || 9e9);
    }
    lineCount = count(string, '\n');
    column = this.chunkColumn;
    if (lineCount > 0) {
      ref = string.split('\n'), [lastLine] = slice.call(ref, -1);
      column = lastLine.length;
      previousLinesCompensation = this.getLocationDataCompensation(this.chunkOffset, this.chunkOffset + offset - column);
      if (previousLinesCompensation < 0) {
        // Don't recompensate for initially inserted newline.
        previousLinesCompensation = 0;
      }
      columnCompensation = this.getLocationDataCompensation(this.chunkOffset + offset + previousLinesCompensation - column, this.chunkOffset + offset + previousLinesCompensation);
    } else {
      column += string.length;
      columnCompensation = compensation;
    }
    return [this.chunkLine + lineCount, column + columnCompensation, this.chunkOffset + offset + compensation];
  }

  makeLocationData({offsetInChunk, length}) {
    var endOffset, lastCharacter, locationData;
    locationData = {
      range: []
    };
    [locationData.first_line, locationData.first_column, locationData.range[0]] = this.getLineAndColumnFromChunk(offsetInChunk);
    // Use length - 1 for the final offset - we're supplying the last_line and the last_column,
    // so if last_column == first_column, then we're looking at a character of length 1.
    lastCharacter = length > 0 ? length - 1 : 0;
    [locationData.last_line, locationData.last_column, endOffset] = this.getLineAndColumnFromChunk(offsetInChunk + lastCharacter);
    [locationData.last_line_exclusive, locationData.last_column_exclusive] = this.getLineAndColumnFromChunk(offsetInChunk + lastCharacter + (length > 0 ? 1 : 0));
    locationData.range[1] = length > 0 ? endOffset + 1 : endOffset;
    return locationData;
  }

  // Same as `token`, except this just returns the token without adding it
  // to the results.
  makeToken(tag, value, {
      offset: offsetInChunk = 0,
      length = value.length,
      origin,
      generated,
      indentSize
    } = {}) {
    var token;
    token = [tag, value, this.makeLocationData({offsetInChunk, length})];
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

  // Add a token to the results.
  // `offset` is the offset into the current `@chunk` where the token starts.
  // `length` is the length of the token in the `@chunk`, after the offset.  If
  // not specified, the length of `value` will be used.
  //
  // Returns the new token.
  token(tag, value, {offset, length, origin, data, generated, indentSize} = {}) {
    var token;
    token = this.makeToken(tag, value, {offset, length, origin, generated, indentSize});
    if (data) {
      addTokenData(token, data);
    }
    this.tokens.push(token);
    return token;
  }

  // Peek at the last tag in the token stream.
  tag() {
    var ref, token;
    ref = this.tokens, [token] = slice.call(ref, -1);
    return token != null ? token[0] : void 0;
  }

  // Peek at the last value in the token stream.
  value(useOrigin = false) {
    var ref, token;
    ref = this.tokens, [token] = slice.call(ref, -1);
    if (useOrigin && ((token != null ? token.origin : void 0) != null)) {
      return token.origin[1];
    } else {
      return token != null ? token[1] : void 0;
    }
  }

  // Get the previous token in the token stream.
  prev() {
    return this.tokens[this.tokens.length - 1];
  }

  // Are we in the midst of an unfinished expression?
  unfinished() {
    var ref;
    return LINE_CONTINUER.test(this.chunk) || (ref = this.tag(), indexOf.call(UNFINISHED, ref) >= 0);
  }

  validateUnicodeCodePointEscapes(str, options) {
    return replaceUnicodeCodePointEscapes(str, merge(options, {error: this.error}));
  }

  // Validates escapes in strings and regexes.
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
    while (this.value() === ';') {
      this.tokens.pop();
      if (ref = (ref1 = this.prev()) != null ? ref1[0] : void 0, indexOf.call(['=', ...UNFINISHED], ref) >= 0) {
        results.push(this.error('unexpected ;'));
      } else {
        results.push(void 0);
      }
    }
    return results;
  }

  error(message, options = {}) {
    var first_column, first_line, location, ref, ref1;
    location = 'first_line' in options ? options : ([first_line, first_column] = this.getLineAndColumnFromChunk((ref = options.offset) != null ? ref : 0), {
      first_line,
      first_column,
      last_column: first_column + ((ref1 = options.length) != null ? ref1 : 1) - 1
    });
    return throwSyntaxError(message, location);
  }

};

// Helper functions
// ----------------
export var isUnassignable = function(name, displayName = name) {
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

// `from` isn't a Rip keyword, but it behaves like one in `import` and
// `export` statements (handled above) and in the declaration line of a `for`
// loop. Try to detect when `from` is a variable identifier and when it is this
// "sometimes" keyword.
isForFrom = function(prev) {
  var ref;
  // `for i from iterable`
  if (prev[0] === 'IDENTIFIER') {
    return true;
  // `for from…`
  } else if (prev[0] === 'FOR') {
    return false;
  // `for {from}…`, `for [from]…`, `for {a, from}…`, `for {a: from}…`
  } else if ((ref = prev[1]) === '{' || ref === '[' || ref === ',' || ref === ':') {
    return false;
  } else {
    return true;
  }
};

addTokenData = function(token, data) {
  return Object.assign((token.data != null ? token.data : token.data = {}), data);
};

// Constants
// ---------

// Keywords that Rip shares in common with JavaScript.
JS_KEYWORDS = ['true', 'false', 'null', 'this', 'new', 'delete', 'typeof', 'in', 'instanceof', 'return', 'throw', 'break', 'continue', 'debugger', 'yield', 'await', 'if', 'else', 'switch', 'for', 'while', 'do', 'try', 'catch', 'finally', 'class', 'extends', 'super', 'import', 'export', 'default'];

// Rip-only keywords.
RIP_KEYWORDS = ['undefined', 'Infinity', 'NaN', 'then', 'unless', 'until', 'loop', 'of', 'by', 'when', 'def'];

RIP_ALIAS_MAP = {
  and: '&&',
  or: '||',
  is: '==',     // Lexer maps to ==, codegen converts to === (strict)
  isnt: '!=',   // Lexer maps to !=, codegen converts to !== (strict)
  not: '!',
  yes: 'true',
  no: 'false',
  on: 'true',
  off: 'false'
};

RIP_ALIASES = (function() {
  var results;
  results = [];
  for (key in RIP_ALIAS_MAP) {
    results.push(key);
  }
  return results;
})();

RIP_KEYWORDS = RIP_KEYWORDS.concat(RIP_ALIASES);

// The list of keywords that are reserved by JavaScript, but not used, or are
// used by Rip internally. We throw an error when these are encountered,
// to avoid having a JavaScript error at runtime.
RESERVED = ['case', 'function', 'var', 'void', 'with', 'const', 'let', 'enum', 'native', 'implements', 'interface', 'package', 'private', 'protected', 'public', 'static'];

STRICT_PROSCRIBED = ['arguments', 'eval'];

// The superset of both JavaScript keywords and reserved words, none of which may
// be used as identifiers or properties.
export var JS_FORBIDDEN = JS_KEYWORDS.concat(RESERVED).concat(STRICT_PROSCRIBED);

// The character code of the nasty Microsoft madness otherwise known as the BOM.
BOM = 65279;

// Token matching regexes.
IDENTIFIER = /^(?!\d)((?:(?!\s)[$\w\x7f-\uffff])+!?)([^\n\S]*:(?!:))?/; // rip: allow optional trailing ! for async calls
// Is this a property name?

NUMBER = /^0b[01](?:_?[01])*n?|^0o[0-7](?:_?[0-7])*n?|^0x[\da-f](?:_?[\da-f])*n?|^\d+(?:_\d+)*n|^(?:\d+(?:_\d+)*)?\.?\d+(?:_\d+)*(?:e[+-]?\d+(?:_\d+)*)?/i; // binary
// octal
// hex
// decimal bigint
// decimal
// decimal without support for numeric literal separators for reference:
// \d*\.?\d+ (?:e[+-]?\d+)?

OPERATOR = /^(?:[-=]>|===|!==|!\?|\?\?|=~|[-+*\/%<>&|^!?=]=|>>>=?|([-+:])\1|([&|<>*\/%])\2=?|\?(\.|::)|\.{2,3})/; // function
// Added === and !== for explicit strict equality (compiles same as == and !=)
// !? (otherwise operator) must come before ?? and before !=
// ?? must come before single ? to match correctly
// regex match operator
// compound assign / compare / strict equality
// zero-fill right shift
// doubles
// logic / shift / power / floor division / modulo
// soak access
// range or splat

WHITESPACE = /^[^\n\S]+/;

COMMENT = /^(\s*)###([^#][\s\S]*?)(?:###([^\n\S]*)|###$)|^((?:\s*#(?!##[^#]).*)+)/;

CODE = /^[-=]>/;

MULTI_DENT = /^(?:\n[^\n\S]*)+/;

JSTOKEN = /^`(?!``)((?:[^`\\]|\\[\s\S])*)`/;

HERE_JSTOKEN = /^```((?:[^`\\]|\\[\s\S]|`(?!``))*)```/;

// String-matching-regexes.
STRING_START = /^(?:'''|"""|'|")/;

STRING_SINGLE = /^(?:[^\\']|\\[\s\S])*/;

STRING_DOUBLE = /^(?:[^\\"#$]|\\[\s\S]|\#(?!\{)|\$(?!\{))*/;

HEREDOC_SINGLE = /^(?:[^\\']|\\[\s\S]|'(?!''))*/;

HEREDOC_DOUBLE = /^(?:[^\\"#$]|\\[\s\S]|"(?!"")|\#(?!\{)|\$(?!\{))*/;

HEREDOC_INDENT = /\n+([^\n\S]*)(?=\S)/g;

// Regex-matching-regexes.
REGEX = /^\/(?!\/)((?:[^[\/\n\\]|\\[^\n]|\[(?:\\[^\n]|[^\]\n\\])*\])*)(\/)?/; // Every other thing.
// Anything but newlines escaped.
// Character class.

REGEX_FLAGS = /^\w*/;

VALID_FLAGS = /^(?!.*(.).*\1)[gimsuy]*$/;

HEREGEX = /^(?:[^\\\/#\s]|\\[\s\S]|\/(?!\/\/)|\#(?!\{)|\s+(?:#(?!\{).*)?)*/; // Match any character, except those that need special handling below.
// Match `\` followed by any character.
// Match any `/` except `///`.
// Match `#` which is not part of interpolation, e.g. `#{}`.
// Comments consume everything until the end of the line, including `///`.

HEREGEX_COMMENT = /(\s+)(#(?!{).*)/gm;

REGEX_ILLEGAL = /^(\/|\/{3}\s*)(\*)/;

POSSIBLY_DIVISION = /^\/=?\s/;

// Other regexes.
HERECOMMENT_ILLEGAL = /\*\//;

LINE_CONTINUER = /^\s*(?:,|\??\.(?![.\d])|\??::)/;

STRING_INVALID_ESCAPE = /((?:^|[^\\])(?:\\\\)*)\\(?:(0\d|[1-7])|(x(?![\da-fA-F]{2}).{0,2})|(u\{(?![\da-fA-F]{1,}\})[^}]*\}?)|(u(?!\{|[\da-fA-F]{4}).{0,4}))/; // Make sure the escape isn't escaped.
// octal escape
// hex escape
// unicode code point escape
// unicode escape

REGEX_INVALID_ESCAPE = /((?:^|[^\\])(?:\\\\)*)\\(?:(0\d)|(x(?![\da-fA-F]{2}).{0,2})|(u\{(?![\da-fA-F]{1,}\})[^}]*\}?)|(u(?!\{|[\da-fA-F]{4}).{0,4}))/; // Make sure the escape isn't escaped.
// octal escape
// hex escape
// unicode code point escape
// unicode escape

TRAILING_SPACES = /\s+$/;

// Compound assignment tokens.
COMPOUND_ASSIGN = ['-=', '+=', '/=', '*=', '%=', '||=', '&&=', '?=', '??=', '<<=', '>>=', '>>>=', '&=', '^=', '|=', '**=', '//=', '%%='];

// Unary tokens.
UNARY = ['NEW', 'TYPEOF', 'DELETE'];

UNARY_MATH = ['!', '~'];

// Bit-shifting tokens.
SHIFT = ['<<', '>>', '>>>'];

// Comparison tokens.
COMPARE = ['==', '!=', '===', '!==', '<', '>', '<=', '>=', '=~'];

// Mathematical tokens.
MATH = ['*', '/', '%', '//', '%%'];

// Relational tokens that are negatable with `not` prefix.
RELATION = ['IN', 'OF', 'INSTANCEOF'];

// Boolean tokens.
BOOL = ['TRUE', 'FALSE'];

// Tokens which could legitimately be invoked or indexed. An opening
// parentheses or bracket following these tokens will be recorded as the start
// of a function invocation or indexing operation.
CALLABLE = ['IDENTIFIER', 'PROPERTY', ')', ']', '?', '@', 'THIS', 'SUPER', 'DYNAMIC_IMPORT', '?.'];

INDEXABLE = CALLABLE.concat(['NUMBER', 'INFINITY', 'NAN', 'STRING', 'STRING_END', 'REGEX', 'REGEX_END', 'BOOL', 'NULL', 'UNDEFINED', '}', '::', '?.']);

// Tokens which can be the left-hand side of a less-than comparison, i.e. `a<b`.
COMPARABLE_LEFT_SIDE = ['IDENTIFIER', ')', ']', 'NUMBER'];

// Tokens which a regular expression will never immediately follow (except spaced
// CALLABLEs in some cases), but which a division operator can.
//
// See: http://www-archive.mozilla.org/js/language/js20-2002-04/rationale/syntax.html#regular-expressions
NOT_REGEX = INDEXABLE.concat(['++', '--']);

// Tokens that, when immediately preceding a `WHEN`, indicate that the `WHEN`
// occurs at the start of a line. We disambiguate these from trailing whens to
// avoid an ambiguity in the grammar.
LINE_BREAK = ['INDENT', 'OUTDENT', 'TERMINATOR'];

// Additional indent in front of these is ignored.
INDENTABLE_CLOSERS = [')', '}', ']'];

// ==============================================================================
// Rewriter
// ==============================================================================

// The Rip language has a good deal of optional syntax, implicit syntax,
// and shorthand syntax. This can greatly complicate a grammar and bloat
// the resulting parse table. Instead of making the parser handle it all, we take
// a series of passes over the token stream, using this **Rewriter** to convert
// shorthand into the unambiguous long form, add implicit indentation and
// parentheses, and generally clean things up.

// Move attached comments from one token to another.
moveComments = function(fromToken, toToken) {
  var comment, k, len, ref, unshiftedComments;
  if (!fromToken.comments) {
    return;
  }
  if (toToken.comments && toToken.comments.length !== 0) {
    unshiftedComments = [];
    ref = fromToken.comments;
    for (k = 0, len = ref.length; k < len; k++) {
      comment = ref[k];
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

// Create a generated token: one that exists due to a use of implicit syntax.
// Optionally have this new token take the attached comments from another token.
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

Rewriter = (function() {
  // The **Rewriter** class is used by the [Lexer](lexer.html), directly against
  // its internal array of tokens.
  class Rewriter {
    // Rewrite the token stream in multiple passes, one logical filter at
    // a time. This could certainly be changed into a single pass through the
    // stream, with a big ol' efficient switch, but it's much nicer to work with
    // like this. The order of these passes matters—indentation must be
    // corrected before implicit parentheses can be wrapped around blocks of code.
    rewrite(tokens1) {
      var ref, ref1, t;
      this.tokens = tokens1;
      // Set environment variable `DEBUG_TOKEN_STREAM` to `true` to output token
      // debugging info. Also set `DEBUG_REWRITTEN_TOKEN_STREAM` to `true` to
      // output the token stream after it has been rewritten by this file.
      if (typeof process !== "undefined" && process !== null ? (ref = process.env) != null ? ref.DEBUG_TOKEN_STREAM : void 0 : void 0) {
        if (process.env.DEBUG_REWRITTEN_TOKEN_STREAM) {
          console.log('Initial token stream:');
        }
        console.log(((function() {
          var k, len, ref1, results;
          ref1 = this.tokens;
          results = [];
          for (k = 0, len = ref1.length; k < len; k++) {
            t = ref1[k];
            results.push(t[0] + '/' + t[1] + (t.comments ? '*' : ''));
          }
          return results;
        }).call(this)).join(' '));
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
      if (typeof process !== "undefined" && process !== null ? (ref1 = process.env) != null ? ref1.DEBUG_REWRITTEN_TOKEN_STREAM : void 0 : void 0) {
        if (process.env.DEBUG_TOKEN_STREAM) {
          console.log('Rewritten token stream:');
        }
        console.log(((function() {
          var k, len, ref2, results;
          ref2 = this.tokens;
          results = [];
          for (k = 0, len = ref2.length; k < len; k++) {
            t = ref2[k];
            results.push(t[0] + '/' + t[1] + (t.comments ? '*' : ''));
          }
          return results;
        }).call(this)).join(' '));
      }
      return this.tokens;
    }

    // Rewrite the token stream, looking one token ahead and behind.
    // Allow the return value of the block to tell us how many tokens to move
    // forwards (or backwards) in the stream, to make sure we don't miss anything
    // as tokens are inserted and removed, and the stream changes length under
    // our feet.
    scanTokens(block) {
      var i, token, tokens;
      ({tokens} = this);
      i = 0;
      while (token = tokens[i]) {
        i += block.call(this, token, i, tokens);
      }
      return true;
    }

    detectEnd(i, condition, action, opts = {}) {
      var levels, ref, ref1, token, tokens;
      ({tokens} = this);
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

    // Leading newlines would introduce an ambiguity in the grammar, so we
    // dispatch them here.
    removeLeadingNewlines() {
      var i, k, l, leadingNewlineToken, len, len1, ref, ref1, tag;
      ref = this.tokens;
      for (i = k = 0, len = ref.length; k < len; i = ++k) {
        [tag] = ref[i];
        if (tag !== 'TERMINATOR') {
          // Find the index of the first non-`TERMINATOR` token.
          break;
        }
      }
      if (i === 0) {
        return;
      }
      ref1 = this.tokens.slice(0, i);
      // If there are any comments attached to the tokens we're about to discard,
      // shift them forward to what will become the new first token.
      for (l = 0, len1 = ref1.length; l < len1; l++) {
        leadingNewlineToken = ref1[l];
        moveComments(leadingNewlineToken, this.tokens[i]);
      }
      // Discard all the leading newline tokens.
      return this.tokens.splice(0, i);
    }

    // The lexer has tagged the opening parenthesis of a method call. Match it with
    // its paired close.
    closeOpenCalls() {
      var action, condition;
      condition = function(token, i) {
        var ref;
        return (ref = token[0]) === ')' || ref === 'CALL_END';
      };
      action = function(token, i) {
        return token[0] = 'CALL_END';
      };
      return this.scanTokens(function(token, i) {
        if (token[0] === 'CALL_START') {
          this.detectEnd(i + 1, condition, action);
        }
        return 1;
      });
    }

    // The lexer has tagged the opening bracket of an indexing operation call.
    // Match it with its paired close.
    closeOpenIndexes() {
      var action, condition, startToken;
      startToken = null;
      condition = function(token, i) {
        var ref;
        return (ref = token[0]) === ']' || ref === 'INDEX_END';
      };
      action = function(token, i) {
        if (this.tokens.length >= i && this.tokens[i + 1][0] === ':') {
          startToken[0] = '[';
          return token[0] = ']';
        } else {
          return token[0] = 'INDEX_END';
        }
      };
      return this.scanTokens(function(token, i) {
        if (token[0] === 'INDEX_START') {
          startToken = token;
          this.detectEnd(i + 1, condition, action);
        }
        return 1;
      });
    }

    // Match tags in token stream starting at `i` with `pattern`.
    // `pattern` may consist of strings (equality), an array of strings (one of)
    // or null (wildcard). Returns the index of the match or -1 if no match.
    indexOfTag(i, ...pattern) {
      var fuzz, j, k, ref, ref1;
      fuzz = 0;
      for (j = k = 0, ref = pattern.length; (0 <= ref ? k < ref : k > ref); j = 0 <= ref ? ++k : --k) {
        if (pattern[j] == null) {
          continue;
        }
        if (typeof pattern[j] === 'string') {
          pattern[j] = [pattern[j]];
        }
        if (ref1 = this.tag(i + j + fuzz), indexOf.call(pattern[j], ref1) < 0) {
          return -1;
        }
      }
      return i + j + fuzz - 1;
    }

    // Returns `yes` if standing in front of something looking like
    // `@<x>:`, `<x>:` or `<EXPRESSION_START><x>...<EXPRESSION_END>:`.
    looksObjectish(j) {
      var end, index;
      if (this.indexOfTag(j, '@', null, ':') !== -1 || this.indexOfTag(j, null, ':') !== -1) {
        return true;
      }
      index = this.indexOfTag(j, EXPRESSION_START);
      if (index !== -1) {
        end = null;
        this.detectEnd(index + 1, (function(token) {
          var ref;
          return ref = token[0], indexOf.call(EXPRESSION_END, ref) >= 0;
        }), (function(token, i) {
          return end = i;
        }));
        if (this.tag(end + 1) === ':') {
          return true;
        }
      }
      return false;
    }

    // Returns `yes` if current line of tokens contain an element of tags on same
    // expression level. Stop searching at `LINEBREAKS` or explicit start of
    // containing balanced expression.
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

    // Look for signs of implicit calls and objects in the token stream and
    // add them.
    addImplicitBracesAndParens() {
      var stack, start, inTernary;
      // Track current balancing depth (both implicit and explicit) on stack.
      stack = [];
      start = null;
      // Track if we're in ternary mode (saw ? waiting for :)
      inTernary = false;
      return this.scanTokens(function(token, i, tokens) {
        var endImplicitCall, endImplicitObject, forward, implicitObjectContinues, implicitObjectIndent, inControlFlow, inImplicit, inImplicitCall, inImplicitControl, inImplicitObject, isImplicit, isImplicitCall, isImplicitObject, k, newLine, nextTag, nextToken, offset, preContinuationLineIndent, preObjectToken, prevTag, prevToken, ref, ref1, ref2, ref3, ref4, ref5, s, sameLine, stackIdx, stackItem, stackNext, stackTag, stackTop, startIdx, startImplicitCall, startImplicitObject, startIndex, startTag, startsLine, tag;
        [tag] = token;
        [prevTag] = prevToken = i > 0 ? tokens[i - 1] : [];
        [nextTag] = nextToken = i < tokens.length - 1 ? tokens[i + 1] : [];
        stackTop = function() {
          return stack[stack.length - 1];
        };
        startIdx = i;
        // Helper function, used for keeping track of the number of tokens consumed
        // and spliced, when returning for getting a new token.
        forward = function(n) {
          return i - startIdx + n;
        };
        // Helper functions
        isImplicit = function(stackItem) {
          var ref;
          return stackItem != null ? (ref = stackItem[2]) != null ? ref.ours : void 0 : void 0;
        };
        isImplicitObject = function(stackItem) {
          return isImplicit(stackItem) && (stackItem != null ? stackItem[0] : void 0) === '{';
        };
        isImplicitCall = function(stackItem) {
          return isImplicit(stackItem) && (stackItem != null ? stackItem[0] : void 0) === '(';
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
        // Unclosed control statement inside implicit parens (like
        // class declaration or if-conditionals).
        inImplicitControl = function() {
          var ref;
          return inImplicit() && ((ref = stackTop()) != null ? ref[0] : void 0) === 'CONTROL';
        };
        startImplicitCall = function(idx) {
          stack.push([
            '(',
            idx,
            {
              ours: true
            }
          ]);
          return tokens.splice(idx, 0, generate('CALL_START', '(', ['', 'implicit function call', token[2]], prevToken));
        };
        endImplicitCall = function() {
          stack.pop();
          tokens.splice(i, 0, generate('CALL_END', ')', ['', 'end of input', token[2]], prevToken));
          return i += 1;
        };
        startImplicitObject = function(idx, {startsLine = true, continuationLineIndent} = {}) {
          var val;
          stack.push([
            '{',
            idx,
            {
              sameLine: true,
              startsLine: startsLine,
              ours: true,
              continuationLineIndent: continuationLineIndent
            }
          ]);
          val = new String('{');
          val.generated = true;
          return tokens.splice(idx, 0, generate('{', val, token, prevToken));
        };
        endImplicitObject = function(j) {
          j = j != null ? j : i;
          stack.pop();
          tokens.splice(j, 0, generate('}', '}', token, prevToken));
          return i += 1;
        };
        implicitObjectContinues = (j) => {
          var nextTerminatorIdx;
          nextTerminatorIdx = null;
          this.detectEnd(j, function(token) {
            return token[0] === 'TERMINATOR';
          }, function(token, i) {
            return nextTerminatorIdx = i;
          }, {
            returnOnNegativeLevel: true
          });
          if (nextTerminatorIdx == null) {
            return false;
          }
          return this.looksObjectish(nextTerminatorIdx + 1);
        };
        // Don't end an implicit call/object on next indent if any of these are in an argument/value.
        if ((inImplicitCall() || inImplicitObject()) && indexOf.call(CONTROL_IN_IMPLICIT, tag) >= 0 || inImplicitObject() && prevTag === ':' && tag === 'FOR') {
          stack.push([
            'CONTROL',
            i,
            {
              ours: true
            }
          ]);
          return forward(1);
        }
        if (tag === 'INDENT' && inImplicit()) {
          // An `INDENT` closes an implicit call unless
          //
          //  1. We have seen a `CONTROL` argument on the line.
          //  2. The last token before the indent is part of the list below.
          if (prevTag !== '=>' && prevTag !== '->' && prevTag !== '[' && prevTag !== '(' && prevTag !== ',' && prevTag !== '{' && prevTag !== 'ELSE' && prevTag !== '=') {
            while (inImplicitCall() || inImplicitObject() && prevTag !== ':') {
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
        // Straightforward start of explicit expression.
        if (indexOf.call(EXPRESSION_START, tag) >= 0) {
          stack.push([tag, i]);
          return forward(1);
        }
        // Close all implicit expressions inside of explicitly closed expressions.
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
          seenFor = this.findTagsBackwards(i, ['FOR']) && this.findTagsBackwards(i, ['FORIN', 'FOROF', 'FORFROM']);
          controlFlow = seenFor || this.findTagsBackwards(i, ['WHILE', 'UNTIL', 'LOOP', 'LEADING_WHEN']);
          if (!controlFlow) {
            return false;
          }
          isFunc = false;
          tagCurrentLine = token[2].first_line;
          this.detectEnd(i, function(token, i) {
            var ref;
            return ref = token[0], indexOf.call(LINEBREAKS, ref) >= 0;
          }, function(token, i) {
            var first_line;
            [prevTag, , {first_line}] = tokens[i - 1] || [];
            return isFunc = tagCurrentLine === first_line && (prevTag === '->' || prevTag === '=>');
          }, {
            returnOnNegativeLevel: true
          });
          return isFunc;
        };
        // Recognize standard implicit calls like
        // f a, f() b, f? c, h[0] d etc.
        // Added support for spread dots on the left side: f ...a
        if ((indexOf.call(IMPLICIT_FUNC, tag) >= 0 && token.spaced || tag === '?' && i > 0 && !tokens[i - 1].spaced) && (indexOf.call(IMPLICIT_CALL, nextTag) >= 0 || (nextTag === '...' && (ref = this.tag(i + 2), indexOf.call(IMPLICIT_CALL, ref) >= 0) && !this.findTagsBackwards(i, ['INDEX_START', '['])) || indexOf.call(IMPLICIT_UNSPACED_CALL, nextTag) >= 0 && !nextToken.spaced && !nextToken.newLine) && !inControlFlow()) {
          if (tag === '?') {
            tag = token[0] = 'FUNC_EXIST';
          }
          startImplicitCall(i + 1);
          return forward(2);
        }
        // Implicit call taking an implicit indented object as first argument.
        //
        //     f
        //       a: b
        //       c: d
        //
        // Don't accept implicit calls of this type, when on the same line
        // as the control structures below as that may misinterpret constructs like:
        //
        //     if f
        //        a: 1
        // as
        //
        //     if f(a: 1)
        //
        // which is probably always unintended.
        // Furthermore don't allow this in the first line of a literal array
        // or explicit object, as that creates grammatical ambiguities (#5368).
        if (indexOf.call(IMPLICIT_FUNC, tag) >= 0 && this.indexOfTag(i + 1, 'INDENT') > -1 && this.looksObjectish(i + 2) && !this.findTagsBackwards(i, ['CLASS', 'EXTENDS', 'IF', 'CATCH', 'SWITCH', 'LEADING_WHEN', 'FOR', 'WHILE', 'UNTIL']) && !(((ref1 = (s = (ref2 = stackTop()) != null ? ref2[0] : void 0)) === '{' || ref1 === '[') && !isImplicit(stackTop()) && this.findTagsBackwards(i, s))) {
          startImplicitCall(i + 1);
          stack.push(['INDENT', i + 2]);
          return forward(3);
        }
        // Track ternary operator: when we see SPACE?, next : is part of ternary
        if (tag === 'SPACE?') {
          inTernary = true;
        }
        // Implicit objects start here.
        if (tag === ':') {
          // If in ternary mode, skip implicit object creation
          if (inTernary) {
            inTernary = false;  // Reset for next statement
            return forward(1);
          }
          // Go back to the (implicit) start of the object.
          s = (function() {
            var ref3;
            switch (false) {
              case ref3 = this.tag(i - 1), indexOf.call(EXPRESSION_END, ref3) < 0:
                [startTag, startIndex] = start;
                if (startTag === '[' && startIndex > 0 && this.tag(startIndex - 1) === '@' && !tokens[startIndex - 1].spaced) {
                  return startIndex - 1;
                } else {
                  return startIndex;
                }
                break;
              case this.tag(i - 2) !== '@':
                return i - 2;
              default:
                return i - 1;
            }
          }).call(this);
          startsLine = s <= 0 || (ref3 = this.tag(s - 1), indexOf.call(LINEBREAKS, ref3) >= 0) || tokens[s - 1].newLine;
          // Are we just continuing an already declared object?
          // Including the case where we indent on the line after an explicit '{'.
          if (stackTop()) {
            [stackTag, stackIdx] = stackTop();
            stackNext = stack[stack.length - 2];
            if ((stackTag === '{' || stackTag === 'INDENT' && (stackNext != null ? stackNext[0] : void 0) === '{' && !isImplicit(stackNext) && this.findTagsBackwards(stackIdx - 1, ['{'])) && (startsLine || this.tag(s - 1) === ',' || this.tag(s - 1) === '{') && (ref4 = this.tag(s - 1), indexOf.call(UNFINISHED, ref4) < 0)) {
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
        // End implicit calls when chaining method calls
        // like e.g.:
        //
        //     f ->
        //       a
        //     .g b, ->
        //       c
        //     .h a
        //
        // and also
        //
        //     f a
        //     .g b
        //     .h a

        // Mark all enclosing objects as not sameLine
        if (indexOf.call(LINEBREAKS, tag) >= 0) {
          for (k = stack.length - 1; k >= 0; k += -1) {
            stackItem = stack[k];
            if (!isImplicit(stackItem)) {
              break;
            }
            if (isImplicitObject(stackItem)) {
              stackItem[2].sameLine = false;
            }
          }
        }
        // End indented-continuation-line implicit objects once that indentation is over.
        if (tag === 'TERMINATOR' && token.endsContinuationLineIndentation) {
          ({preContinuationLineIndent} = token.endsContinuationLineIndentation);
          while (inImplicitObject() && ((implicitObjectIndent = stackTop()[2].continuationLineIndent) != null) && implicitObjectIndent > preContinuationLineIndent) {
            endImplicitObject();
          }
        }
        newLine = prevTag === 'OUTDENT' || prevToken.newLine;
        if (indexOf.call(IMPLICIT_END, tag) >= 0 || (indexOf.call(CALL_CLOSERS, tag) >= 0 && newLine) || ((tag === '..' || tag === '...') && this.findTagsBackwards(i, ["INDEX_START"]))) {
          while (inImplicit()) {
            [stackTag, stackIdx, {sameLine, startsLine}] = stackTop();
            // Close implicit calls when reached end of argument list
            if (inImplicitCall() && prevTag !== ',' || (prevTag === ',' && tag === 'TERMINATOR' && (nextTag == null))) {
              endImplicitCall();
            // Close implicit objects such as:
            // return a: 1, b: 2 unless true
            } else if (inImplicitObject() && sameLine && tag !== 'TERMINATOR' && prevTag !== ':' && !((tag === 'POST_IF' || tag === 'FOR' || tag === 'WHILE' || tag === 'UNTIL') && startsLine && implicitObjectContinues(i + 1))) {
              endImplicitObject();
            // Close implicit objects when at end of line, line didn't end with a comma
            // and the implicit object didn't start the line or the next line doesn't look like
            // the continuation of an object.
            } else if (inImplicitObject() && tag === 'TERMINATOR' && prevTag !== ',' && !(startsLine && this.looksObjectish(i + 1))) {
              endImplicitObject();
            } else if (inImplicitControl() && tokens[stackTop()[1]][0] === 'CLASS' && tag === 'TERMINATOR') {
              stack.pop();
            } else {
              break;
            }
          }
        }
        // Close implicit object if comma is the last character
        // and what comes after doesn't look like it belongs.
        // This is used for trailing commas and calls, like:
        //
        //     x =
        //         a: b,
        //         c: d,
        //     e = 2
        //
        // and
        //
        //     f a, b: c, d: e, f, g: h: i, j
        //
        if (tag === ',' && !this.looksObjectish(i + 1) && inImplicitObject() && !((ref5 = this.tag(i + 2)) === 'FOROF' || ref5 === 'FORIN') && (nextTag !== 'TERMINATOR' || !this.looksObjectish(i + 2))) {
          // When nextTag is OUTDENT the comma is insignificant and
          // should just be ignored so embed it in the implicit object.
          //
          // When it isn't the comma go on to play a role in a call or
          // array further up the stack, so give it a chance.
          offset = nextTag === 'OUTDENT' ? 1 : 0;
          while (inImplicitObject()) {
            endImplicitObject(i + offset);
          }
        }
        return forward(1);
      });
    }

    // Not all tokens survive processing by the parser. To avoid comments getting
    // lost into the ether, find comments attached to doomed tokens and move them
    // to a token that will make it to the other side.
    rescueStowawayComments() {
      var dontShiftForward, insertPlaceholder, shiftCommentsBackward, shiftCommentsForward;
      insertPlaceholder = function(token, j, tokens, method) {
        if (tokens[j][0] !== 'TERMINATOR') {
          tokens[method](generate('TERMINATOR', '\n', tokens[j]));
        }
        return tokens[method](generate('JS', '', tokens[j], token));
      };
      dontShiftForward = function(i, tokens) {
        var j, ref;
        j = i + 1;
        while (j !== tokens.length && (ref = tokens[j][0], indexOf.call(DISCARDED, ref) >= 0)) {
          if (tokens[j][0] === 'INTERPOLATION_END') {
            return true;
          }
          j++;
        }
        return false;
      };
      shiftCommentsForward = function(token, i, tokens) {
        var comment, j, k, len, ref, ref1, ref2;
        // Find the next surviving token and attach this token's comments to it,
        // with a flag that we know to output such comments *before* that
        // token's own compilation. (Otherwise comments are output following
        // the token they're attached to.)
        j = i;
        while (j !== tokens.length && (ref = tokens[j][0], indexOf.call(DISCARDED, ref) >= 0)) {
          j++;
        }
        if (!(j === tokens.length || (ref1 = tokens[j][0], indexOf.call(DISCARDED, ref1) >= 0))) {
          ref2 = token.comments;
          for (k = 0, len = ref2.length; k < len; k++) {
            comment = ref2[k];
            comment.unshift = true;
          }
          moveComments(token, tokens[j]);
          return 1; // All following tokens are doomed!
        } else {
          j = tokens.length - 1;
          insertPlaceholder(token, j, tokens, 'push');
          // The generated tokens were added to the end, not inline, so we don't skip.
          return 1;
        }
      };
      shiftCommentsBackward = function(token, i, tokens) {
        var j, ref, ref1;
        // Find the last surviving token and attach this token's comments to it.
        j = i;
        while (j !== -1 && (ref = tokens[j][0], indexOf.call(DISCARDED, ref) >= 0)) {
          j--;
        }
        if (!(j === -1 || (ref1 = tokens[j][0], indexOf.call(DISCARDED, ref1) >= 0))) {
          moveComments(token, tokens[j]);
          return 1; // All previous tokens are doomed!
        } else {
          insertPlaceholder(token, 0, tokens, 'unshift');
          // We added two tokens, so shift forward to account for the insertion.
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
          // This token won't survive passage through the parser, so we need to
          // rescue its attached tokens and redistribute them to nearby tokens.
          // Comments that don't start a new line can shift backwards to the last
          // safe token, while other tokens should shift forward.
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
          // If any of this token's comments start a line—there's only
          // whitespace between the preceding newline and the start of the
          // comment—and this isn't one of the special `JS` tokens, then
          // shift this comment forward to precede the next valid token.
          // `Block.compileComments` also has logic to make sure that
          // "starting new line" comments follow or precede the nearest
          // newline relative to the token that the comment is attached to,
          // but that newline might be inside a `}` or `)` or other generated
          // token that we really want this comment to output after. Therefore
          // we need to shift the comments here, avoiding such generated and
          // discarded tokens.
          dummyToken = {
            comments: []
          };
          j = token.comments.length - 1;
          while (j !== -1) {
            if (token.comments[j].newLine && !token.comments[j].unshift && !(token[0] === 'JS' && token.generated)) {
              dummyToken.comments.unshift(token.comments[j]);
              token.comments.splice(j, 1);
            }
            j--;
          }
          if (dummyToken.comments.length !== 0) {
            ret = shiftCommentsForward(dummyToken, i + 1, tokens);
          }
        }
        if (((ref1 = token.comments) != null ? ref1.length : void 0) === 0) {
          delete token.comments;
        }
        return ret;
      });
    }

    // Add location data to all tokens generated by the rewriter.
    addLocationDataToGeneratedTokens() {
      return this.scanTokens(function(token, i, tokens) {
        var column, line, nextLocation, prevLocation, rangeIndex, ref, ref1;
        if (token[2]) {
          return 1;
        }
        if (!(token.generated || token.explicit)) {
          return 1;
        }
        if (token.fromThen && token[0] === 'INDENT') {
          token[2] = token.origin[2];
          return 1;
        }
        if (token[0] === '{' && (nextLocation = (ref = tokens[i + 1]) != null ? ref[2] : void 0)) {
          ({
            first_line: line,
            first_column: column,
            range: [rangeIndex]
          } = nextLocation);
        } else if (prevLocation = (ref1 = tokens[i - 1]) != null ? ref1[2] : void 0) {
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

    // `OUTDENT` tokens should always be positioned at the last character of the
    // previous token, so that AST nodes ending in an `OUTDENT` token end up with a
    // location corresponding to the last "real" token under the node.
    fixIndentationLocationData() {
      var findPrecedingComment;
      if (this.allComments == null) {
        this.allComments = extractAllCommentTokens(this.tokens);
      }
      findPrecedingComment = (token, {afterPosition, indentSize, first, indented}) => {
        var comment, k, l, lastMatching, matches, ref, ref1, tokenStart;
        tokenStart = token[2].range[0];
        matches = function(comment) {
          if (comment.outdented) {
            if (!((indentSize != null) && comment.indentSize > indentSize)) {
              return false;
            }
          }
          if (indented && !comment.indented) {
            return false;
          }
          if (!(comment.locationData.range[0] < tokenStart)) {
            return false;
          }
          if (!(comment.locationData.range[0] > afterPosition)) {
            return false;
          }
          return true;
        };
        if (first) {
          lastMatching = null;
          ref = this.allComments;
          for (k = ref.length - 1; k >= 0; k += -1) {
            comment = ref[k];
            if (matches(comment)) {
              lastMatching = comment;
            } else if (lastMatching) {
              return lastMatching;
            }
          }
          return lastMatching;
        }
        ref1 = this.allComments;
        for (l = ref1.length - 1; l >= 0; l += -1) {
          comment = ref1[l];
          if (matches(comment)) {
            return comment;
          }
        }
        return null;
      };
      return this.scanTokens(function(token, i, tokens) {
        var isIndent, nextToken, nextTokenIndex, precedingComment, prevLocationData, prevToken, ref, ref1, ref2, useNextToken;
        if (!(((ref = token[0]) === 'INDENT' || ref === 'OUTDENT') || (token.generated && token[0] === 'CALL_END' && !((ref1 = token.data) != null ? ref1.closingTagNameToken : void 0)) || (token.generated && token[0] === '}'))) {
          return 1;
        }
        isIndent = token[0] === 'INDENT';
        prevToken = (ref2 = token.prevToken) != null ? ref2 : tokens[i - 1];
        prevLocationData = prevToken[2];
        // addLocationDataToGeneratedTokens() set the outdent's location data
        // to the preceding token's, but in order to detect comments inside an
        // empty "block" we want to look for comments preceding the next token.
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
          if (!(precedingComment != null ? precedingComment.newLine : void 0)) {
            return 1;
          }
        }
        if (token.generated && token[0] === 'CALL_END' && (precedingComment != null ? precedingComment.indented : void 0)) {
          // We don't want e.g. an implicit call at the end of an `if` condition to
          // include a following indented comment.
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
          range: isIndent && (precedingComment != null) ? [prevLocationData.range[0] - precedingComment.indentSize, prevLocationData.range[1]] : prevLocationData.range
        };
        return 1;
      });
    }

    // Because our grammar is LALR(1), it can't handle some single-line
    // expressions that lack ending delimiters. The **Rewriter** adds the implicit
    // blocks, so it doesn't need to. To keep the grammar clean and tidy, trailing
    // newlines within expressions are removed and the indentation tokens of empty
    // blocks are added.
    normalizeLines() {
      var action, closeElseTag, condition, ifThens, indent, leading_if_then, leading_switch_when, outdent, starter;
      starter = indent = outdent = null;
      leading_switch_when = null;
      leading_if_then = null;
      // Count `THEN` tags
      ifThens = [];
      condition = function(token, i) {
        var ref, ref1, ref2, ref3;
        return token[1] !== ';' && (ref = token[0], indexOf.call(SINGLE_CLOSERS, ref) >= 0) && !(token[0] === 'TERMINATOR' && (ref1 = this.tag(i + 1), indexOf.call(EXPRESSION_CLOSE, ref1) >= 0)) && !(token[0] === 'ELSE' && (starter !== 'THEN' || (leading_if_then || leading_switch_when))) && !(((ref2 = token[0]) === 'CATCH' || ref2 === 'FINALLY') && (starter === '->' || starter === '=>')) || (ref3 = token[0], indexOf.call(CALL_CLOSERS, ref3) >= 0) && (this.tokens[i - 1].newLine || this.tokens[i - 1][0] === 'OUTDENT');
      };
      action = function(token, i) {
        if (token[0] === 'ELSE' && starter === 'THEN') {
          ifThens.pop();
        }
        return this.tokens.splice((this.tag(i - 1) === ',' ? i - 1 : i), 0, outdent);
      };
      closeElseTag = (tokens, i) => {
        var lastThen, outdentElse, tlen;
        tlen = ifThens.length;
        if (!(tlen > 0)) {
          return i;
        }
        lastThen = ifThens.pop();
        [, outdentElse] = this.indentation(tokens[lastThen]);
        // Insert `OUTDENT` to close inner `IF`.
        outdentElse[1] = tlen * 2;
        tokens.splice(i, 0, outdentElse);
        // Insert `OUTDENT` to close outer `IF`.
        outdentElse[1] = 2;
        tokens.splice(i + 1, 0, outdentElse);
        // Remove outdents from the end.
        this.detectEnd(i + 2, function(token, i) {
          var ref;
          return (ref = token[0]) === 'OUTDENT' || ref === 'TERMINATOR';
        }, function(token, i) {
          if (this.tag(i) === 'OUTDENT' && this.tag(i + 1) === 'OUTDENT') {
            return tokens.splice(i, 2);
          }
        });
        return i + 2;
      };
      return this.scanTokens(function(token, i, tokens) {
        var conditionTag, j, k, ref, ref1, ref2, tag;
        [tag] = token;
        conditionTag = (tag === '->' || tag === '=>') && this.findTagsBackwards(i, ['IF', 'WHILE', 'FOR', 'UNTIL', 'SWITCH', 'WHEN', 'LEADING_WHEN', '[', 'INDEX_START']) && !(this.findTagsBackwards(i, ['THEN', '..', '...']));
        if (tag === 'TERMINATOR') {
          if (this.tag(i + 1) === 'ELSE' && this.tag(i - 1) !== 'OUTDENT') {
            tokens.splice(i, 1, ...this.indentation());
            return 1;
          }
          if (ref = this.tag(i + 1), indexOf.call(EXPRESSION_CLOSE, ref) >= 0) {
            if (token[1] === ';' && this.tag(i + 1) === 'OUTDENT') {
              tokens[i + 1].prevToken = token;
              moveComments(token, tokens[i + 1]);
            }
            tokens.splice(i, 1);
            return 0;
          }
        }
        if (tag === 'CATCH') {
          for (j = k = 1; k <= 2; j = ++k) {
            if (!((ref1 = this.tag(i + j)) === 'OUTDENT' || ref1 === 'TERMINATOR' || ref1 === 'FINALLY')) {
              continue;
            }
            tokens.splice(i + j, 0, ...this.indentation());
            return 2 + j;
          }
        }
        if ((tag === '->' || tag === '=>') && (((ref2 = this.tag(i + 1)) === ',' || ref2 === ']') || this.tag(i + 1) === '.' && token.newLine)) {
          [indent, outdent] = this.indentation(tokens[i]);
          tokens.splice(i + 1, 0, indent, outdent);
          return 1;
        }
        if (indexOf.call(SINGLE_LINERS, tag) >= 0 && this.tag(i + 1) !== 'INDENT' && !(tag === 'ELSE' && this.tag(i + 1) === 'IF') && !conditionTag) {
          starter = tag;
          [indent, outdent] = this.indentation(tokens[i]);
          if (starter === 'THEN') {
            indent.fromThen = true;
          }
          if (tag === 'THEN') {
            leading_switch_when = this.findTagsBackwards(i, ['LEADING_WHEN']) && this.tag(i + 1) === 'IF';
            leading_if_then = this.findTagsBackwards(i, ['IF']) && this.tag(i + 1) === 'IF';
          }
          if (tag === 'THEN' && this.findTagsBackwards(i, ['IF'])) {
            ifThens.push(i);
          }
          // `ELSE` tag is not closed.
          if (tag === 'ELSE' && this.tag(i - 1) !== 'OUTDENT') {
            i = closeElseTag(tokens, i);
          }
          tokens.splice(i + 1, 0, indent);
          this.detectEnd(i + 2, condition, action);
          if (tag === 'THEN') {
            tokens.splice(i, 1);
          }
          return 1;
        }
        return 1;
      });
    }

    // =========================================================================
    // BACKWARDS COMPATIBILITY / TRANSITION SUPPORT
    // =========================================================================
    // Convert legacy CoffeeScript existential operator syntax to Rip's nullish
    // coalescing operator. In CoffeeScript, "SPACE?" (a question mark with a
    // space before it, e.g., "x ? y") was used as an existential operator.
    // Rip uses ES6's "??" for this purpose instead.
    //
    // This rewriter converts standalone "SPACE?" tokens (those NOT part of
    // ternary expressions) into "??" operators to ease migration of old code.
    //
    // Examples:
    //   x ? y        →  x ?? y     (legacy existential, converted)
    //   x ? y : z    →  x ? y : z  (ternary, left unchanged)
    //
    // NOTE: This is for COMPATIBILITY and TRANSITION purposes only.
    // New code should use "??" explicitly instead of relying on this conversion.
    // =========================================================================
    convertLegacyExistential() {
      return this.scanTokens(function(token, i, tokens) {
        var colonFound, j, nestLevel, ref, tag;
        // Only process SPACE? tokens
        if (token[0] !== 'SPACE?') {
          return 1;
        }
        // Look ahead to determine if this is part of a ternary expression
        // A ternary has the pattern: Expression SPACE? Expression : Expression
        // If we find a ':' at the same nesting level, it's a ternary
        colonFound = false;
        nestLevel = 0;
        for (j = i + 1; j < tokens.length; j++) {
          tag = tokens[j][0];
          // Track nesting level (parentheses, brackets, braces)
          if (ref = tag, indexOf.call(EXPRESSION_START, ref) >= 0) {
            nestLevel++;
          } else if (ref = tag, indexOf.call(EXPRESSION_END, ref) >= 0) {
            nestLevel--;
          }
          // Found colon at same level = it's a ternary operator
          if (tag === ':' && nestLevel === 0) {
            colonFound = true;
            break;
          }
          // Hit statement boundary without finding colon = not a ternary
          if (nestLevel === 0 && (tag === 'TERMINATOR' || tag === 'INDENT' || tag === 'OUTDENT')) {
            break;
          }
        }
        // No colon found = legacy existential operator, convert to ??
        if (!colonFound) {
          token[0] = '??';
          token[1] = '??';
        }
        // Otherwise leave as SPACE? for ternary handling
        return 1;
      });
    }

    // =========================================================================
    // BACKWARDS COMPATIBILITY / TRANSITION SUPPORT
    // =========================================================================
    // Convert CoffeeScript postfix spread/rest to ES6 prefix syntax.
    // In CoffeeScript, spread/rest can appear AFTER the identifier (e.g.,
    // "args..." for rest params, "arr..." for spread). ES6 requires the prefix
    // form ("...args", "...arr").
    //
    // This rewriter converts postfix spread/rest tokens to prefix form by
    // swapping token positions, while carefully preserving range operators
    // (which also use ... but in different contexts).
    //
    // Examples:
    //   [a, rest...]       →  [a, ...rest]    (destructuring rest, converted)
    //   (args...) ->       →  (...args) =>    (rest params, converted)
    //   [arr...]           →  [...arr]        (array spread, converted)
    //   fn(arr...)         →  fn(...arr)      (call spread, converted)
    //   [1...10]           →  [1...10]        (range operator, unchanged)
    //   arr[0...5]         →  arr[0...5]      (slice operator, unchanged)
    //
    // NOTE: This is for COMPATIBILITY and TRANSITION purposes only.
    // New code should use ES6 prefix syntax (...x) for clarity and consistency.
    // =========================================================================
    convertPostfixSpreadRest() {
      return this.scanTokens(function(token, i, tokens) {
        var definiteSpreadNext, inIndexContext, lastIndexEnd, lastIndexStart, next, nextTag, prev, prevTag, ref, validPostfixTokens;
        // Only process ... and .. tokens
        if (token[0] !== '...' && token[0] !== '..') {
          return 1;
        }
        // Check if we're inside an OPEN (unmatched) INDEX_START...INDEX_END context
        // Count bracket depth to handle nested cases like arr[_[0].length..]
        // where the inner _[0] has matching brackets but we're still inside the outer [...]
        let bracketDepth = 0;
        for (let j = i - 1; j >= 0; j--) {
          if (tokens[j][0] === 'INDEX_END') {
            bracketDepth++;  // Closing bracket adds to depth (going backwards)
          }
          if (tokens[j][0] === 'INDEX_START') {
            bracketDepth--;  // Opening bracket reduces depth
          }
        }
        // If bracketDepth < 0, we have more INDEX_START than INDEX_END = we're inside [...]
        inIndexContext = bracketDepth < 0;
        if (inIndexContext) {
          return 1; // It's a range/slice operator, leave unchanged
        }
        prev = tokens[i - 1];
        next = tokens[i + 1];
        if (!prev || !next) {
          return 1;
        }
        prevTag = prev[0];
        nextTag = next[0];
        // Skip standalone expansion marker: , ... ,
        // This is used in function params like (a, ..., b) for expansion
        if (prevTag === ',' && nextTag === ',') {
          return 1; // Expansion marker, leave unchanged
        }
        // Don't transform if previous token is NUMBER (that's a range)
        // Examples: [1...10], arr[5...], for i in [0...10]
        if (prevTag === 'NUMBER') {
          return 1; // Range operator, leave unchanged
        }
        // Don't transform if already in prefix position
        // Check if next token is what would follow in prefix form
        // Example: [...arr] should not be transformed (already prefix)
        validPostfixTokens = ['IDENTIFIER', 'PROPERTY', ')', ']', 'THIS', '@'];
        // If previous token can have postfix spread, check if next confirms it
        if (ref = prevTag, indexOf.call(validPostfixTokens, ref) >= 0) {
          // Check if next token confirms this is spread (not range)
          // After spread, we expect: , (separator), ) (end param/call), ] (end array), } (end object)
          definiteSpreadNext = [',', ']', ')', '}', 'CALL_END', 'INDEX_END', 'PARAM_END', 'TERMINATOR', 'OUTDENT'];
          if (ref = nextTag, indexOf.call(definiteSpreadNext, ref) >= 0) {
            // This is postfix spread/rest - TRANSFORM by swapping tokens
            tokens[i - 1] = token; // Move ... to before
            tokens[i] = prev; // Move identifier to after
            return 1;
          }
          // If next is IDENTIFIER or NUMBER, it's likely a range (x...y)
          // Don't transform
        }
        return 1;
      });
    }

    // Tag postfix conditionals as such, so that we can parse them with a
    // different precedence.
    tagPostfixConditionals() {
      var action, condition, original;
      original = null;
      condition = function(token, i) {
        var prevTag, tag;
        [tag] = token;
        [prevTag] = this.tokens[i - 1];
        return tag === 'TERMINATOR' || (tag === 'INDENT' && indexOf.call(SINGLE_LINERS, prevTag) < 0);
      };
      action = function(token, i) {
        if (token[0] !== 'INDENT' || (token.generated && !token.fromThen)) {
          return original[0] = 'POST_' + original[0];
        }
      };
      return this.scanTokens(function(token, i) {
        if (token[0] !== 'IF' && token[0] !== 'UNLESS') {
          return 1;
        }
        original = token;
        this.detectEnd(i + 1, condition, action);
        return 1;
      });
    }

    // For tokens with extra data, we want to make that data visible to the grammar
    // by wrapping the token value as a String() object and setting the data as
    // properties of that object. The grammar should then be responsible for
    // cleaning this up for the node constructor: unwrapping the token value to a
    // primitive string and separately passing any expected token data properties
    exposeTokenDataToGrammar() {
      return this.scanTokens(function(token, i) {
        var ref, ref1, val;
        if (token.generated || (token.data && Object.keys(token.data).length !== 0)) {
          token[1] = new String(token[1]);
          ref1 = (ref = token.data) != null ? ref : {};
          for (key in ref1) {
            if (!hasProp.call(ref1, key)) continue;
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

    // Generate the indentation tokens, based on another token on the same line.
    indentation(origin) {
      var indent, outdent;
      indent = ['INDENT', 2];
      outdent = ['OUTDENT', 2];
      if (origin) {
        indent.generated = outdent.generated = true;
        indent.origin = outdent.origin = origin;
      } else {
        indent.explicit = outdent.explicit = true;
      }
      return [indent, outdent];
    }

    // Look up a tag by token index.
    tag(i) {
      var ref;
      return (ref = this.tokens[i]) != null ? ref[0] : void 0;
    }

  };

  Rewriter.prototype.generate = generate;

  return Rewriter;

}).call(this);

// Constants
// ---------

// List of the token pairs that must be balanced.
BALANCED_PAIRS = [['(', ')'], ['[', ']'], ['{', '}'], ['INDENT', 'OUTDENT'], ['CALL_START', 'CALL_END'], ['PARAM_START', 'PARAM_END'], ['INDEX_START', 'INDEX_END'], ['STRING_START', 'STRING_END'], ['INTERPOLATION_START', 'INTERPOLATION_END'], ['REGEX_START', 'REGEX_END']];

// The inverse mappings of `BALANCED_PAIRS` we're trying to fix up, so we can
// look things up from either end.
INVERSES = {};

// The tokens that signal the start/end of a balanced pair.
EXPRESSION_START = [];

EXPRESSION_END = [];

for (k = 0, len = BALANCED_PAIRS.length; k < len; k++) {
  [left, right] = BALANCED_PAIRS[k];
  EXPRESSION_START.push(INVERSES[right] = left);
  EXPRESSION_END.push(INVERSES[left] = right);
}

// Tokens that indicate the close of a clause of an expression.
EXPRESSION_CLOSE = ['CATCH', 'THEN', 'ELSE', 'FINALLY'].concat(EXPRESSION_END);

// Tokens that, if followed by an `IMPLICIT_CALL`, indicate a function invocation.
IMPLICIT_FUNC = ['IDENTIFIER', 'PROPERTY', 'SUPER', ')', 'CALL_END', ']', 'INDEX_END', '@', 'THIS'];

// If preceded by an `IMPLICIT_FUNC`, indicates a function invocation.
IMPLICIT_CALL = ['IDENTIFIER', 'PROPERTY', 'NUMBER', 'INFINITY', 'NAN', 'STRING', 'STRING_START', 'REGEX', 'REGEX_START', 'JS', 'NEW', 'PARAM_START', 'CLASS', 'IF', 'TRY', 'SWITCH', 'THIS', 'DYNAMIC_IMPORT', 'IMPORT_META', 'NEW_TARGET', 'UNDEFINED', 'NULL', 'BOOL', 'UNARY', 'DO', 'DO_IIFE', 'YIELD', 'AWAIT', 'UNARY_MATH', 'SUPER', 'THROW', '@', '->', '=>', '[', '(', '{', '--', '++'];

IMPLICIT_UNSPACED_CALL = ['+', '-'];

// Tokens that always mark the end of an implicit call for single-liners.
IMPLICIT_END = ['POST_IF', 'FOR', 'WHILE', 'UNTIL', 'WHEN', 'BY', 'LOOP', 'TERMINATOR'];

// Single-line flavors of block expressions that have unclosed endings.
// The grammar can't disambiguate them, so we insert the implicit indentation.
SINGLE_LINERS = ['ELSE', '->', '=>', 'TRY', 'FINALLY', 'THEN'];

SINGLE_CLOSERS = ['TERMINATOR', 'CATCH', 'FINALLY', 'ELSE', 'OUTDENT', 'LEADING_WHEN'];

// Tokens that end a line.
LINEBREAKS = ['TERMINATOR', 'INDENT', 'OUTDENT'];

// Tokens that close open calls when they follow a newline.
CALL_CLOSERS = ['.', '?.', '::', '?::'];

// Tokens that prevent a subsequent indent from ending implicit calls/objects
CONTROL_IN_IMPLICIT = ['IF', 'TRY', 'FINALLY', 'CATCH', 'CLASS', 'SWITCH'];

// Tokens that are swallowed up by the parser, never leading to code generation.
// You can spot these in `grammar.rip` because the `o` function second
// argument doesn't contain a `new` call for these tokens.
// `STRING_START` isn't on this list because its `locationData` matches that of
// the node that becomes `StringWithInterpolations`, and therefore
// `addDataToNode` attaches `STRING_START`'s tokens to that node.
DISCARDED = ['(', ')', '[', ']', '{', '}', ':', '.', '..', '...', ',', '=', '++', '--', '?', 'AS', 'AWAIT', 'CALL_START', 'CALL_END', 'DEFAULT', 'DO', 'DO_IIFE', 'ELSE', 'EXTENDS', 'EXPORT', 'FORIN', 'FOROF', 'FORFROM', 'IMPORT', 'INDENT', 'INDEX_SOAK', 'INTERPOLATION_START', 'INTERPOLATION_END', 'LEADING_WHEN', 'OUTDENT', 'PARAM_END', 'REGEX_START', 'REGEX_END', 'RETURN', 'STRING_END', 'THROW', 'UNARY', 'YIELD'].concat(IMPLICIT_UNSPACED_CALL.concat(IMPLICIT_END.concat(CALL_CLOSERS.concat(CONTROL_IN_IMPLICIT))));

// Tokens that, when appearing at the end of a line, suppress a following TERMINATOR/INDENT token
UNFINISHED = ['\\', '.', '?.', '?::', 'UNARY', 'DO', 'DO_IIFE', 'MATH', 'UNARY_MATH', '+', '-', '**', 'SHIFT', 'RELATION', 'COMPARE', '&', '^', '|', '&&', '||', 'SPACE?', 'EXTENDS'];
