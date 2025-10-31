# CoffeeScript STRING Token Properties: Complete Reference

## Overview

In CoffeeScript's lexer and parser, the STRING token carries several metadata properties that are essential for correctly transforming source strings into JavaScript output. These properties handle the complex edge cases of string literals, particularly heredocs (triple-quoted strings) and interpolated strings.

When the lexer encounters a string in source code, it doesn't just extract the raw text. It also annotates the token with metadata about HOW that string was written, which affects how it should be compiled to JavaScript.

## The STRING Token Structure

A STRING token is not just a simple string value. It's an object with these properties:
- The string content itself (after slicing off quotes with `$1.slice 1, -1`)
- `quote`: The quote delimiter used
- `initialChunk`: Boolean flag for first chunk in interpolated string
- `finalChunk`: Boolean flag for last chunk in interpolated string
- `indent`: The common indentation to strip from heredocs
- `double`: Whether backslashes should be doubled in output
- `heregex`: Object with regex flags for extended regex literals

## Property Descriptions and Usage

### 1. `quote` - Quote Delimiter Type

**Purpose:** Records which quote characters were used to delimit the string in source code.

**Possible Values:**
- `"` - double quote
- `'` - single quote
- `"""` - triple double quote (heredoc)
- `'''` - triple single quote (heredoc)
- `"///"` - heregex (extended regex literal)
- `\`` - backtick (for template literals, though less common in CoffeeScript)

**Why It Exists:**
CoffeeScript needs to know the original quote style for several reasons:
1. To determine if a string is a heredoc (`quote.length is 3`)
2. To calculate proper location data (source maps) by accounting for quote length
3. To determine the delimiter character (`quote.charAt(0)`)
4. To preserve quote style when generating output or AST

**How It's Used:**

In the `StringLiteral` constructor:
- Normalizes heregex quotes: `@quote = null if @quote is '///'`
- Sets the `fromSourceString` flag: `@fromSourceString = @quote?`
- Provides default: `@quote ?= '"'`
- Determines delimiter: `@delimiter = @quote.charAt 0`
- Detects heredocs: `heredoc = @quote.length is 3`

In `withoutQuotesInLocationData()`:
- Adjusts first_column by adding quote length
- Adjusts last_column by subtracting quote length
- Adjusts last_column_exclusive by subtracting quote length
- Adjusts range array by quote length

In `StringWithInterpolations`:
- Stored and passed through: `{@quote, @startQuote}`
- Used when converting from StringLiteral: `quote: stringLiteral.quote`

**Example:**
```coffeescript
x = "hello"      # quote: "
y = 'world'      # quote: '
z = """
  multiline
  """            # quote: """
```

### 2. `initialChunk` - First Chunk of Interpolated String

**Purpose:** Marks whether this STRING token is the very first chunk in an interpolated string.

**Possible Values:**
- `true` - This is the first string chunk
- `false` or undefined - Not the first chunk

**Why It Exists:**
Interpolated strings are broken into multiple tokens (string chunks and interpolation expressions). The first chunk has special whitespace handling rules - leading blank lines should be stripped in certain contexts.

**How It's Used:**

In heredoc processing (when `quote.length is 3`):
- If `@initialChunk` is true, `LEADING_BLANK_LINE` regex is used to strip the leading blank line
- Applied: `val = val.replace LEADING_BLANK_LINE, '' if @initialChunk`

In simple string processing:
- Combined with offset check to detect if a newline is at the very start
- If `@initialChunk and offset is 0`, convert the newline to empty string instead of a space
- This prevents unwanted leading whitespace in output

In the lexer's `mergeInterpolationTokens()`:
- Set on the token: `addTokenData token, initialChunk: yes if i is 0`
- Only set when the loop index `i` equals `0`

**Example:**
```coffeescript
x = """
    first line
    second line
    """
# The token for "    first line\n    second line\n    " has initialChunk: true
# Leading blank line stripped if present

y = "prefix #{expr}
     continuation"
# "prefix " has initialChunk: true
# "     continuation" has initialChunk: false
```

### 3. `finalChunk` - Last Chunk of Interpolated String

**Purpose:** Marks whether this STRING token is the very last chunk in an interpolated string.

**Possible Values:**
- `true` - This is the final string chunk
- `false` or undefined - Not the final chunk

**Why It Exists:**
Similar to `initialChunk`, the final chunk has special whitespace handling - trailing blank lines should be stripped in certain contexts.

**How It's Used:**

In heredoc processing:
- If `@finalChunk` is true, `TRAILING_BLANK_LINE` regex is used to strip the trailing blank line
- Applied: `val = val.replace TRAILING_BLANK_LINE, '' if @finalChunk`

In simple string processing:
- Combined with position check to detect if a newline is at the very end
- If `@finalChunk and offset + match.length is val.length`, convert the newline to empty string
- Prevents unwanted trailing whitespace

In the lexer's `mergeInterpolationTokens()`:
- Set on the token: `addTokenData token, finalChunk: yes if i is $`
- Where `$` is the last index in the tokens array (`tokens.length - 1`)

**Example:**
```coffeescript
x = """
    some text

    """
# The string token has finalChunk: true
# Trailing blank line stripped

y = "start #{x} end"
# "start " has finalChunk: false
# " end" has finalChunk: true
```

### 4. `indent` - Common Indentation to Strip

**Purpose:** Records the common leading whitespace found across all lines of a heredoc that should be stripped during compilation.

**Possible Values:**
- A string of whitespace characters (spaces/tabs)
- `null` or undefined if no common indentation

**Why It Exists:**
Heredocs allow you to write multiline strings with proper indentation in your source code. The compiler needs to strip this "code indentation" to produce the actual intended string content. This enables readable code without affecting the runtime string value.

**How It's Used:**

In heredoc processing:
- If `@indent` exists, create a regex pattern: `indentRegex = /// \n#{@indent} ///g`
- Apply the regex to strip the indent: `val = val.replace indentRegex, '\n' if indentRegex`
- This replaces every occurrence of `\n` followed by the indent string with just `\n`

In the lexer's string processing:
- The lexer scans all lines in a heredoc
- Finds the minimum indentation across all non-empty lines
- Stores this as the `indent` value: `indent = attempt if indent is null or 0 < attempt.length < indent.length`
- Passed to `mergeInterpolationTokens` for attachment to tokens

**Example:**
```coffeescript
x = """
    Line 1
    Line 2
      Indented more
    """
# indent would be "    " (4 spaces)
# After processing:
# "Line 1\nLine 2\n  Indented more"
# Note: The extra indent on line 3 is preserved

# With irregular indentation:
y = """
  First (2 spaces)
      Second (6 spaces)
    Third (4 spaces)
  """
# indent would be "  " (2 spaces - the minimum)
# After processing:
# "First (2 spaces)\n    Second (6 spaces)\n  Third (4 spaces)"
```

### 5. `double` - Backslash Doubling Flag

**Purpose:** Indicates whether backslash characters in the string should be doubled when generating JavaScript output.

**Possible Values:**
- `true` - Double backslashes
- `false` or undefined - Don't double backslashes

**Why It Exists:**
JavaScript requires different levels of escaping depending on the context. When CoffeeScript generates string literals, it needs to ensure backslashes are properly escaped. The `double` flag controls whether `\` becomes `\\` in the output.

**How It's Used:**

Passed to the `makeDelimitedLiteral()` helper function in two contexts:

1. **Main value generation:**
   ```coffeescript
   @value = makeDelimitedLiteral val, {
     @delimiter
     @double
   }
   ```

2. **Template literal conversion:**
   ```coffeescript
   @unquotedValueForTemplateLiteral = makeDelimitedLiteral val, {
     delimiter: '`'
     @double
     escapeNewlines: no
     includeDelimiters: no
     convertTrailingNullEscapes: yes
   }
   ```

Inside `makeDelimitedLiteral()`:
- When processing a backslash: `when backslash then (if double then backslash + backslash else backslash)`
- When processing other escapes: `when other then (if double then "\\#{other}" else other)`
- This ensures proper escape sequences in the generated JavaScript

**Example:**
```coffeescript
# If double is true:
"\n" → "\\n" (in generated JS)
"\\" → "\\\\" (in generated JS)

# If double is false:
"\n" → "\n" (preserved)
"\\" → "\\" (preserved)
```

### 6. `heregex` - Extended Regex Metadata

**Purpose:** Contains metadata about extended regular expression (heregex) literals, including flags.

**Possible Values:**
- An object with a `flags` property containing regex flags
- `undefined` if not a heregex

**Why It Exists:**
CoffeeScript supports "heregexes" - extended regular expressions that allow whitespace and comments for readability. These are delimited with `///` and need special processing. The flags (like `g`, `i`, `m`) need to be tracked and preserved.

**How It's Used:**

In the `StringLiteral` constructor:
- Detects heregex mode: `if @heregex`
- Applies heregex-specific transformations:
  - Removes whitespace and comments: `val = val.replace HEREGEX_OMIT, '$1$2'`
  - Processes unicode escapes with flags: `val = replaceUnicodeCodePointEscapes val, flags: @heregex.flags`

In the lexer:
- When tokenizing a heregex, comment tokens are marked: `heregex: yes`
- The flags are extracted and stored in the heregex object
- Passed through in `mergeInterpolationTokens`: `addTokenData token, {heregex} if heregex`

**Example:**
```coffeescript
pattern = ///
  ^ \d+      # starts with digits
  \s*        # optional whitespace
  [a-z]+     # followed by letters
  $          # end of string
///i         # case-insensitive flag

# heregex: { flags: 'i' }
# The whitespace and comments are stripped
# The 'i' flag is preserved for the output regex
```

## How These Properties Work Together

### Interpolated String Processing

When an interpolated string is lexed:

1. The lexer identifies quote type → sets `quote`
2. For heredocs, calculates common indent → sets `indent`
3. Breaks string into chunks around interpolations
4. Marks first chunk → sets `initialChunk: true`
5. Marks last chunk → sets `finalChunk: true`
6. Determines escape context → sets `double`

When the string is compiled to JavaScript:

1. Check `quote.length is 3` to detect heredoc
2. If heredoc and `indent` exists, strip common indentation
3. If `initialChunk`, strip leading blank line
4. If `finalChunk`, strip trailing blank line
5. Use `double` to control backslash escaping
6. Use `quote` for location data adjustments

### Heregex Processing

1. Lexer detects `///` → sets `quote: '///'`
2. Flags are parsed → sets `heregex: { flags: '...' }`
3. In compilation, apply special regex transformations
4. Preserve flags in output

## Why This Matters

Without these properties, it would be impossible to:

1. **Correctly handle heredoc indentation:** You wouldn't know what common indent to strip
2. **Properly trim whitespace:** You wouldn't know which chunks are first/last
3. **Generate accurate source maps:** Quote length affects column positions
4. **Preserve semantic meaning:** Different quote styles have different escaping rules
5. **Support readable regex:** Heregex flags and content need special processing
6. **Match JavaScript semantics:** Backslash doubling must match the output context

## Common Pitfalls Without This Information

When implementing a string processor without understanding these properties:

- **Indentation errors:** Heredocs include unwanted leading whitespace
- **Newline handling:** Extra blank lines appear at start/end of strings
- **Escape sequence bugs:** Backslashes aren't properly doubled or preserved
- **Source map misalignment:** Location data doesn't account for quote characters
- **Regex compilation failures:** Heregex content isn't properly stripped

## Summary

The STRING token is not just a value - it's a rich data structure that captures the INTENT and CONTEXT of how a string was written in source code. Each property serves a specific purpose in the transformation pipeline from CoffeeScript source to JavaScript output. Understanding these properties is essential for correctly implementing string handling in any CoffeeScript-like compiler.

## REGEX Tokens (Rip Extension)

While STRING tokens have properties directly on the String object, **REGEX tokens store metadata in `token.data`**:

```javascript
// REGEX token structure:
token = ['REGEX', String("/pattern/flags"), location]
token.data = {
  delimiter: '///',      // '/' for normal regex, '///' for heregex
  heregex: {flags: 'gi'} // Only for heregex
}
```

**The Rewriter's `exposeTokenDataToGrammar()` copies these to the String object:**
```javascript
token[1].delimiter = token.data.delimiter;
token[1].heregex = token.data.heregex;
```

This allows Rip's codegen to detect and process heregex (extended regex with whitespace/comments) by checking:
```javascript
if (strObj.delimiter === '///' && strObj.heregex) {
  // Process heregex: strip whitespace and comments
}
```
