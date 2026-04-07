// RipError — structured diagnostics for the Rip compiler
//
// Unifies error reporting across lexer, parser, and codegen with source
// locations, contextual snippets, and carets. Consumers (CLI, loader, browser,
// REPL, server) call format() for terminal output or formatHTML() for browser.

export class RipError extends Error {
  constructor(message, {
    code   = null,   // e.g. 'E_SYNTAX', 'E_CODEGEN', 'E_PARSE'
    file   = null,   // source filename
    line   = null,   // 0-based line number
    column = null,   // 0-based column number
    length = 1,      // length of the offending span
    source = null,   // full original source text
    suggestion = null,
    phase  = null,   // 'lexer', 'parser', 'codegen'
  } = {}) {
    super(message);
    this.name       = 'RipError';
    this.code       = code;
    this.file       = file;
    this.line       = line;
    this.column     = column;
    this.length     = length;
    this.source     = source;
    this.suggestion = suggestion;
    this.phase      = phase;
  }

  // Construct from a lexer SyntaxError (has .location)
  static fromLexer(err, source, file) {
    let loc = err.location || {};
    return new RipError(err.message, {
      code: 'E_SYNTAX',
      file,
      line: loc.first_line ?? null,
      column: loc.first_column ?? null,
      length: loc.last_column != null && loc.first_column != null
        ? loc.last_column - loc.first_column + 1 : 1,
      source,
      phase: 'lexer',
    });
  }

  // Construct from a parser Error (has .hash with line, loc, token, expected)
  static fromParser(err, source, file) {
    let h = err.hash || {};
    let loc = h.loc || {};
    let line = h.line ?? loc.r ?? null;
    let column = loc.first_column ?? loc.c ?? null;
    let suggestion = null;
    if (h.expected?.length) {
      let first5 = h.expected.slice(0, 5).map(e => e.replace(/'/g, ''));
      suggestion = `Expected ${first5.join(', ')}`;
      if (h.expected.length > 5) suggestion += `, ... (${h.expected.length} total)`;
    }
    // Build a clean message from the hash instead of using the parser's pre-formatted string
    let token = h.token || 'token';
    let near = h.text ? ` near '${h.text}'` : '';
    let message = `Unexpected ${token}${near}`;
    return new RipError(message, {
      code: 'E_PARSE',
      file,
      line,
      column,
      length: h.text?.length || 1,
      source,
      suggestion,
      phase: 'parser',
    });
  }

  // Construct from an s-expression node's .loc in the codegen phase
  static fromSExpr(message, sexpr, source, file, suggestion) {
    let loc = sexpr?.loc || {};
    return new RipError(message, {
      code: 'E_CODEGEN',
      file,
      line: loc.r ?? null,
      column: loc.c ?? null,
      length: loc.n ?? 1,
      source,
      suggestion,
      phase: 'codegen',
    });
  }

  // Human-readable location string: "file.rip:3:5" or "3:5" or ""
  get locationString() {
    let parts = [];
    if (this.file) parts.push(this.file);
    if (this.line != null) {
      parts.push(`${this.line + 1}:${(this.column ?? 0) + 1}`);
    }
    return parts.join(':');
  }

  // ---- Terminal formatter ----

  format({ color = true } = {}) {
    let c = color ? {
      red:     '\x1b[31m',
      yellow:  '\x1b[33m',
      cyan:    '\x1b[36m',
      dim:     '\x1b[2m',
      bold:    '\x1b[1m',
      reset:   '\x1b[0m',
    } : { red: '', yellow: '', cyan: '', dim: '', bold: '', reset: '' };

    let lines = [];

    // Header: error message
    let loc = this.locationString;
    let header = loc ? `${c.cyan}${loc}${c.reset} ` : '';
    lines.push(`${header}${c.red}${c.bold}error${c.reset}${c.bold}: ${this.message}${c.reset}`);

    // Source snippet with caret
    let snippet = this._snippet();
    if (snippet) {
      lines.push('');
      for (let s of snippet) {
        if (s.type === 'source') {
          lines.push(`${c.dim}${s.gutter}${c.reset}${s.text}`);
        } else if (s.type === 'caret') {
          lines.push(`${c.dim}${s.gutter}${c.reset}${c.red}${c.bold}${s.text}${c.reset}`);
        }
      }
    }

    // Suggestion
    if (this.suggestion) {
      lines.push('');
      lines.push(`${c.yellow}hint${c.reset}: ${this.suggestion}`);
    }

    return lines.join('\n');
  }

  // ---- HTML formatter ----

  formatHTML() {
    let lines = [];
    lines.push('<div class="rip-error">');
    lines.push('<style>');
    lines.push(`.rip-error { font-family: ui-monospace, "SF Mono", Menlo, Monaco, monospace; font-size: 13px; line-height: 1.5; padding: 16px 20px; background: #1e1e2e; color: #cdd6f4; border-radius: 8px; overflow-x: auto; }`);
    lines.push(`.rip-error .re-header { color: #f38ba8; font-weight: 600; }`);
    lines.push(`.rip-error .re-loc { color: #89b4fa; }`);
    lines.push(`.rip-error .re-gutter { color: #585b70; user-select: none; }`);
    lines.push(`.rip-error .re-caret { color: #f38ba8; font-weight: 700; }`);
    lines.push(`.rip-error .re-hint { color: #f9e2af; }`);
    lines.push(`.rip-error .re-snippet { margin: 8px 0; }`);
    lines.push('</style>');

    let loc = this.locationString;
    let locSpan = loc ? `<span class="re-loc">${esc(loc)}</span> ` : '';
    lines.push(`<div class="re-header">${locSpan}error: ${esc(this.message)}</div>`);

    let snippet = this._snippet();
    if (snippet) {
      lines.push('<pre class="re-snippet">');
      for (let s of snippet) {
        if (s.type === 'source') {
          lines.push(`<span class="re-gutter">${esc(s.gutter)}</span>${esc(s.text)}`);
        } else if (s.type === 'caret') {
          lines.push(`<span class="re-gutter">${esc(s.gutter)}</span><span class="re-caret">${esc(s.text)}</span>`);
        }
      }
      lines.push('</pre>');
    }

    if (this.suggestion) {
      lines.push(`<div class="re-hint">hint: ${esc(this.suggestion)}</div>`);
    }

    lines.push('</div>');
    return lines.join('\n');
  }

  // ---- Snippet builder (shared by format and formatHTML) ----

  _snippet() {
    if (this.source == null || this.line == null) return null;

    let sourceLines = this.source.split('\n');
    let errLine = this.line;
    if (errLine < 0 || errLine >= sourceLines.length) return null;

    let contextRadius = 2;
    let start = Math.max(0, errLine - contextRadius);
    let end = Math.min(sourceLines.length - 1, errLine + contextRadius);
    let gutterWidth = String(end + 1).length;

    let result = [];

    for (let i = start; i <= end; i++) {
      let lineNum = String(i + 1).padStart(gutterWidth);
      let gutter = ` ${lineNum} │ `;
      result.push({ type: 'source', gutter, text: sourceLines[i] });

      if (i === errLine && this.column != null) {
        let pad = ' '.repeat(this.column);
        let caretLen = Math.max(1, Math.min(this.length || 1, sourceLines[i].length - this.column));
        let carets = '^'.repeat(caretLen);
        let emptyGutter = ' '.repeat(gutterWidth + 2) + '│ ';
        result.push({ type: 'caret', gutter: emptyGutter, text: `${pad}${carets}` });
      }
    }

    return result;
  }
}

// Detect whether an error is a lexer SyntaxError with .location
export function isLexerError(err) {
  return err instanceof SyntaxError && err.location != null;
}

// Detect whether an error is a parser error with .hash
export function isParserError(err) {
  return !(err instanceof SyntaxError) && err.hash != null;
}

// Upgrade any error to RipError (idempotent on RipError instances)
export function toRipError(err, source, file) {
  if (err instanceof RipError) {
    if (file && !err.file) err.file = file;
    if (source && !err.source) err.source = source;
    return err;
  }
  if (isLexerError(err))  return RipError.fromLexer(err, source, file);
  if (isParserError(err))  return RipError.fromParser(err, source, file);
  // Unknown error — wrap with no location
  return new RipError(err.message, { file, source, phase: 'unknown' });
}

// Format any error for terminal display (works on RipError and plain Error)
export function formatError(err, { source, file, color = true } = {}) {
  let re = (err instanceof RipError) ? err : toRipError(err, source, file);
  return re.format({ color });
}

// Format any error for HTML display
export function formatErrorHTML(err, { source, file } = {}) {
  let re = (err instanceof RipError) ? err : toRipError(err, source, file);
  return re.formatHTML();
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
