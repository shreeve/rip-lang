// EmitBuilder — a position-tracking output accumulator for the code emitter.
//
// RFC 12 (Unified emitter), phase 1. The current emitter is a string-returning
// recursive function: `emit(node)` returns a JS string and callers compose those
// returns with template literals. The source map is then reconstructed AFTER
// codegen by `recordSubMappings` (src/compiler.js), which regex-searches the
// generated text for each identifier and guesses its column — the root of
// fault B (mis-positioned hover / definition / semantic tokens).
//
// The builder replaces "guess positions after the fact" with "record positions
// as you write." A single builder is the one output accumulator for a compile:
// `write(text)` appends and advances a running offset/line/column, and
// `mark(loc)` / `span(loc, fn)` record an exact source→generated correspondence
// at the current cursor. Because the cursor is global to the whole output, a
// handler can record a mark without knowing how much was emitted before it —
// precisely what the string emitter cannot do.
//
// This module is the foundation. Handlers are converted to write through it
// incrementally (behind `emitTo` + the byte-equivalence gate in src/compiler.js).
// Until a handler is converted, `emitTo` falls back to `write(emit(node))`, which
// is byte-identical and advances the cursor but records no interior marks. The
// builder records the position-bearing marks; once enough handlers are converted,
// those marks replace the heuristic map and the LSP spill search (see the RFC).

export class EmitBuilder {
  constructor() {
    this.chunks = [];  // output fragments, joined on demand
    this.offset = 0;   // 0-based char offset into the output so far
    this.line   = 0;   // 0-based line of the cursor
    this.column = 0;   // 0-based column (chars since the last newline)
    this.marks  = [];  // recorded source→generated correspondences
  }

  // Append text and advance the cursor. Every byte of output flows through
  // here, so offset/line/column always describe the true end of the output.
  write(text) {
    if (text == null || text === '') return this;
    text = String(text);
    this.chunks.push(text);
    let newlines = 0, lastNl = -1;
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) { newlines++; lastNl = i; }
    }
    if (newlines === 0) {
      this.column += text.length;
    } else {
      this.line += newlines;
      this.column = text.length - lastNl - 1;
    }
    this.offset += text.length;
    return this;
  }

  // Record a source location (lexer/parser `.loc` = {r, c, n}) at the CURRENT
  // generated cursor — i.e. the position of whatever is written next.
  mark(loc, kind = null) {
    if (!loc) return this;
    this.marks.push({
      srcLine: loc.r ?? 0, srcCol: loc.c ?? 0, srcLen: loc.n ?? 0,
      genOffset: this.offset, genLine: this.line, genCol: this.column,
      genEndOffset: this.offset,
      kind,
    });
    return this;
  }

  // Mark a span: capture the cursor, run fn() (which writes the construct), then
  // record a mark covering [start, end) of the generated output. Use when the
  // mark should describe the whole emitted range, not just its start.
  span(loc, fn, kind = null) {
    const o = this.offset, l = this.line, c = this.column;
    fn();
    if (loc) {
      this.marks.push({
        srcLine: loc.r ?? 0, srcCol: loc.c ?? 0, srcLen: loc.n ?? 0,
        genOffset: o, genLine: l, genCol: c,
        genEndOffset: this.offset,
        kind,
      });
    }
    return this;
  }

  toString() { return this.chunks.join(''); }

  result() { return { code: this.toString(), marks: this.marks }; }
}
