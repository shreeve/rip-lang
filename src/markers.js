// Source-position markers — RFC 12 (Unified emitter), phase 1 bridge.
//
// Rip's emitter returns plain strings that parents compose with template
// literals (`return ${body};`), so a child's absolute *generated* position is
// unknowable at the moment it returns — which is exactly why the heuristic map
// (recordSubMappings) re-searches the output and mis-resolves repeated tokens.
//
// Markers carry position identity *through* that string concatenation without
// rewriting the emitter: a converted handler wraps the small piece of code it
// emits (an identifier reference, a param name) in a unique zero-width sentinel
// pair. The legacy concatenation carries the sentinels along untouched; one
// final `stripMarkers` pass removes them and reads the exact generated span off
// the clean stream. This sidesteps converting `emitProgram` byte-identically,
// and reordering is handled for free (a moved fragment carries its marker).
//
// Sentinels use Unicode Private-Use-Area code points that never occur in Rip
// source or generated JS. An open tag is OPEN id SEP; a close tag is SHUT id
// SEP. `stripMarkers` removes both and fails hard on any imbalance, so a marker
// swallowed by string post-processing (`.slice`/`.trim`) surfaces as a loud
// error rather than a silently wrong map.

const OPEN = '\uE000'; // start of an open tag
const SHUT = '\uE001'; // start of a close tag
const SEP  = '\uE002'; // terminates the id within either tag

export class MarkerRecorder {
  constructor() {
    this.nextId = 1;
    this.meta = new Map(); // id -> { kind, loc, data }
  }

  // Wrap `text` (a piece of generated code) so its exact generated span can be
  // recovered after the surrounding string is fully assembled. `loc` is the
  // source location ({ r, c, n }) the span maps back to. A no-op for empty text
  // or a missing loc, so callers can wrap unconditionally.
  wrap(kind, loc, text, data = null) {
    if (loc == null || text == null || text === '') return text;
    const id = this.nextId++;
    this.meta.set(id, { kind, loc, data });
    return `${OPEN}${id}${SEP}${text}${SHUT}${id}${SEP}`;
  }

  get active() { return this.nextId > 1; }
}

// Remove all markers from `markedCode` and return the clean code plus the exact
// generated spans. Each mark: { kind, loc, data, genStart, genEnd, genLine,
// genCol } where gen* are offsets/position into the CLEAN code. `recorder`
// supplies the per-id metadata recorded by `wrap`. Throws on any unbalanced or
// unknown marker — a corrupted marker means a wrong map, which must never pass
// silently.
export function stripMarkers(markedCode, recorder) {
  let out = '';
  let offset = 0, line = 0, column = 0;
  const marks = [];
  const stack = [];

  const readTag = (lead, i) => {
    // i points at `lead`; read digits until SEP. Returns { id, next }.
    let j = i + 1;
    const sepAt = markedCode.indexOf(SEP, j);
    if (sepAt < 0) throw new Error('markers: unterminated tag');
    const id = Number(markedCode.slice(j, sepAt));
    if (!Number.isInteger(id)) throw new Error('markers: malformed marker id');
    return { id, next: sepAt + 1 };
  };

  for (let i = 0; i < markedCode.length; ) {
    const ch = markedCode[i];
    if (ch === OPEN) {
      const { id, next } = readTag(OPEN, i);
      const meta = recorder.meta.get(id);
      if (!meta) throw new Error(`markers: unknown open id ${id}`);
      stack.push({ id, meta, genStart: offset, genLine: line, genCol: column });
      i = next;
      continue;
    }
    if (ch === SHUT) {
      const { id, next } = readTag(SHUT, i);
      const open = stack.pop();
      if (!open || open.id !== id) throw new Error(`markers: unbalanced close id ${id}`);
      marks.push({
        kind: open.meta.kind,
        loc: open.meta.loc,
        data: open.meta.data,
        genStart: open.genStart,
        genEnd: offset,
        genLine: open.genLine,
        genCol: open.genCol,
      });
      i = next;
      continue;
    }
    out += ch;
    if (ch === '\n') { line++; column = 0; } else { column++; }
    offset++;
    i++;
  }

  if (stack.length) throw new Error('markers: unclosed marker(s)');
  return { code: out, marks };
}
