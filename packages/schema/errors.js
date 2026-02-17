// ==============================================================================
// errors.js - Beautiful parse error messages for Rip Schema
//
// Intercepts raw SLR parser errors and reformats them with:
//   - Source context with line numbers
//   - Humanized token names
//   - Contextual hints based on what was expected vs found
//   - Filename and location
//
// Usage:
//   import { formatParseError } from './errors.js'
//   try { parse(source) } catch (err) { throw formatParseError(err, source, 'app.schema') }
//
// Author: Steve Shreeve <steve.shreeve@gmail.com>
//   Date: February 2026
// ==============================================================================

// =============================================================================
// Token name humanization
// =============================================================================

const FRIENDLY = {
  'TERMINATOR':  'end of line',
  'IDENTIFIER':  'a name',
  'STRING':      'a string',
  'NUMBER':      'a number',
  'BOOL':        'true/false',
  'NULL':        'null',
  'UNDEFINED':   'undefined',
  'INDENT':      'an indented block',
  'OUTDENT':     'end of block',
  'REGEX':       'a regex',
  'TIMESTAMPS':  '@timestamps',
  'SOFT_DELETE':  '@softDelete',
  'INCLUDE':     '@include',
  'PATTERN':     '@pattern',
  'BELONGS_TO':  '@belongs_to',
  'HAS_ONE':     '@has_one',
  'HAS_MANY':    '@has_many',
  'INDEX':       '@index',
  'COMPUTED':    '@computed',
  'VALIDATE':    '@validate',
  'EVENTS':      '@events',
  'ACTIONS':     '@actions',
  'ENUM':        '@enum',
  'TYPE':        '@type',
  'MODEL':       '@model',
  'MIXIN':       '@mixin',
  'WIDGET':      '@widget',
  'FORM':        '@form',
  'STATE':       '@state',
  'IMPORT':      '@import',
  'IS':          'is',
  'ISNT':        'isnt',
  'NOT':         'not',
  'AND':         'and',
  'OR':          'or',
  '$end':        'end of file',
}

function humanize(token) {
  if (FRIENDLY[token]) return FRIENDLY[token]
  if (token.length === 1) return `'${token}'`
  if (token.startsWith("'") && token.endsWith("'")) return token
  return `'${token}'`
}

function humanizeList(tokens) {
  const items = tokens.map(humanize)
  if (items.length <= 2) return items.join(' or ')
  return items.slice(0, -1).join(', ') + ', or ' + items[items.length - 1]
}

// =============================================================================
// Known directives (for "did you mean?" suggestions)
// =============================================================================

const DIRECTIVES = [
  '@timestamps', '@softDelete', '@belongs_to', '@has_one',
  '@has_many', '@index', '@computed', '@validate',
  '@include', '@pattern', '@events', '@actions',
]

function didYouMean(word, candidates, maxDist = 2) {
  let best = null, bestDist = Infinity
  const lower = word.toLowerCase()
  for (const c of candidates) {
    const d = levenshtein(lower, c.toLowerCase())
    if (d < bestDist && d <= maxDist) {
      best = c
      bestDist = d
    }
  }
  return best
}

function levenshtein(a, b) {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }
  return matrix[b.length][a.length]
}

// =============================================================================
// Error message extraction
// =============================================================================

function extractInfo(message, sourceLines) {
  // Format: "Parse error on line N:\nSOURCE_LINE\n CARET\nExpecting X, Y, got 'Z'"
  const lineMatch = message.match(/(?:line|Line)\s+(\d+)/)
  let lineNum = lineMatch ? parseInt(lineMatch[1]) : null

  // The parser's "line N" can be off by one because tokenLine tracks the last
  // shifted token, not the lookahead that caused the error. Cross-reference
  // the embedded source line to find the actual line number.
  if (lineNum && sourceLines) {
    const msgLines = message.split('\n')
    const embeddedSrc = msgLines[1]?.trimStart()
    if (embeddedSrc && sourceLines[lineNum - 1]?.trim() !== embeddedSrc) {
      // Check the next line
      if (sourceLines[lineNum]?.trim() === embeddedSrc) lineNum += 1
    }
  }

  // Extract expected tokens and got token
  const expectMatch = message.match(/Expecting\s+(.+),\s+got\s+'([^']+)'/)
  let expected = [], got = null
  if (expectMatch) {
    expected = expectMatch[1].split(/,\s*/).map(t => t.replace(/'/g, ''))
    got = expectMatch[2]
  } else {
    const unexpMatch = message.match(/Unexpected\s+(.+)/)
    if (unexpMatch) got = unexpMatch[1].replace(/'/g, '')
  }

  // Format 2: "Parse error at line N, column C (token: TOKEN) near 'TEXT': ..."
  const hashMatch = message.match(/column\s+(\d+)/)
  const col = hashMatch ? parseInt(hashMatch[1]) : null

  return { lineNum, expected, got, col }
}

// =============================================================================
// Context-specific hints
// =============================================================================

function buildHint(expected, got, sourceLine) {
  if (!expected.length || !got) return null

  // Missing name after definition keyword
  if (expected.includes('IDENTIFIER') && got === 'TERMINATOR') {
    if (sourceLine?.match(/@(model|type|enum|mixin|widget|form|state)\s*$/)) {
      const kw = sourceLine.match(/@(\w+)/)[1]
      return `Missing name after @${kw}. Example: @${kw} MyName`
    }
    // Missing type after field modifiers
    if (sourceLine?.match(/\w+[!#?]+\s*$/)) {
      const field = sourceLine.match(/(\w+)[!#?]/)?.[1]
      return `Missing type for field '${field}'. Example: ${field}! string`
    }
    // Generic: expected identifier, got newline
    return 'Expected a name, but the line ended. Did you forget a type or value?'
  }

  // Expected colon (enum member, key-value pair)
  if (expected.includes(':') && got === 'TERMINATOR') {
    return "Expected ':' to define a value. In valued enums, each member needs a colon: admin: \"admin\""
  }

  // Unknown @ directive
  if (got === '@' && expected.some(t => t === 'IDENTIFIER' || FRIENDLY[t]?.startsWith('@'))) {
    const word = sourceLine?.match(/@(\w+)/)?.[1]
    if (word) {
      const suggestion = didYouMean(`@${word}`, DIRECTIVES)
      if (suggestion) return `Unknown directive '@${word}'. Did you mean ${suggestion}?`
      return `Unknown directive '@${word}'. Valid directives: ${DIRECTIVES.join(', ')}`
    }
    return `Unknown directive. Valid directives: ${DIRECTIVES.join(', ')}`
  }

  // Expected value in constraints
  if (got === ']' && expected.some(t => ['STRING', 'NUMBER', 'BOOL', 'IDENTIFIER'].includes(t))) {
    return 'Expected a value inside the constraints. Example: [1, 100] or ["default"]'
  }

  // Expected field or directive inside model body
  if (expected.includes('IDENTIFIER') && expected.includes('OUTDENT') && got === 'INDENT') {
    return 'Unexpected indentation. Check that your fields are aligned consistently.'
  }

  return null
}

// =============================================================================
// Source context formatting
// =============================================================================

function formatContext(lines, lineNum, col) {
  const start = Math.max(0, lineNum - 3)
  const end = Math.min(lines.length, lineNum + 1)
  const gutterWidth = String(end).length
  const prefix = 7 + gutterWidth  // "  > " + num + " | "

  const result = []
  for (let i = start; i < end; i++) {
    const num = String(i + 1).padStart(gutterWidth)
    const marker = (i === lineNum - 1) ? '>' : ' '
    result.push(`  ${marker} ${num} | ${lines[i]}`)

    // Place caret immediately after the error line
    if (i === lineNum - 1 && col != null) {
      result.push(' '.repeat(prefix + col) + '^')
    }
  }

  return result.join('\n')
}

// =============================================================================
// Main entry point
// =============================================================================

/**
 * Format a raw parser/lexer error into a beautiful, contextual message.
 *
 * @param {Error} err - The original error thrown by the parser or lexer
 * @param {string} source - The full schema source text
 * @param {string} [filename] - Optional filename for the error header
 * @returns {Error} A new error with a formatted message
 */
export function formatParseError(err, source, filename) {
  const message = err.message || String(err)
  const lines = source.split('\n')
  const info = extractInfo(message, lines)
  const lineNum = info.lineNum ?? (err.location?.r != null ? err.location.r + 1 : null)
  const col = info.col ?? err.location?.c ?? null

  // Header
  const loc = filename ? `${filename}:${lineNum || '?'}` : `line ${lineNum || '?'}`
  const parts = [`Schema error in ${loc}`]

  // Source context
  if (lineNum && lineNum <= lines.length) {
    parts.push('')
    parts.push(formatContext(lines, lineNum, col))
  }

  // Contextual hint
  const sourceLine = lineNum ? lines[lineNum - 1] : null
  const hint = buildHint(info.expected, info.got, sourceLine)
  const isLexerError = message.includes('unexpected character')
  if (hint) {
    parts.push('')
    parts.push(`  ${hint}`)
  } else if (isLexerError) {
    const charMatch = message.match(/unexpected character '(.+)'/)
    if (charMatch) {
      parts.push('')
      parts.push(`  Unexpected character '${charMatch[1]}'. Schema files use # for comments, not // or /*.`)
    }
  } else if (info.expected.length && info.got) {
    // Fallback: humanized expected/got
    parts.push('')
    const friendly = humanizeList(info.expected)
    const gotFriendly = humanize(info.got)
    parts.push(`  Expected ${friendly}, but found ${gotFriendly}.`)
  }

  parts.push('')

  const newErr = new Error(parts.join('\n'))
  newErr.originalError = err
  newErr.line = lineNum
  newErr.column = col
  return newErr
}

export default formatParseError
