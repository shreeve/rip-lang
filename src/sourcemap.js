// Source Map V3 Generator — zero dependencies
//
// Implements the ECMA-426 Source Map specification (V3).
// Generates .map JSON files that map compiled JavaScript
// back to original Rip source positions.

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Encode a signed integer as a Base64-VLQ string
function vlqEncode(value) {
  let result = '';
  let vlq = value < 0 ? ((-value) << 1) | 1 : value << 1;
  do {
    let digit = vlq & 0x1F;
    vlq >>>= 5;
    if (vlq > 0) digit |= 0x20;
    result += B64[digit];
  } while (vlq > 0);
  return result;
}

class SourceMapGenerator {
  constructor(file, source, sourceContent = null) {
    this.file = file;
    this.source = source;
    this.sourceContent = sourceContent;
    this.names = [];
    this.nameIndex = new Map();
    this.lines = [];    // array of arrays (one per generated line)
    this.mappings = [];  // raw mapping pairs for reverse lookup

    // Running state for relative VLQ encoding
    this.prevGenCol = 0;
    this.prevOrigLine = 0;
    this.prevOrigCol = 0;
    this.prevNameIdx = 0;
    this.currentLine = -1;
  }

  // Ensure we have enough lines in the mappings array
  ensureLine(line) {
    while (this.lines.length <= line) this.lines.push([]);
  }

  // Add a name to the names list, return its index
  addName(name) {
    if (this.nameIndex.has(name)) return this.nameIndex.get(name);
    let idx = this.names.length;
    this.names.push(name);
    this.nameIndex.set(name, idx);
    return idx;
  }

  // Record a mapping from generated position to original position
  //   genLine, genCol   — 0-based position in generated file
  //   origLine, origCol — 0-based position in original file (omit for unmapped)
  //   name              — optional symbol name
  addMapping(genLine, genCol, origLine, origCol, name) {
    this.ensureLine(genLine);

    // Reset generated column tracking on new lines
    if (this.currentLine !== genLine) {
      this.prevGenCol = 0;
      this.currentLine = genLine;
    }

    // Unmapped segment (1 field) — generated code with no source
    if (origLine == null) {
      this.lines[genLine].push(vlqEncode(genCol - this.prevGenCol));
      this.prevGenCol = genCol;
      return;
    }

    // Store raw pair for reverse lookup
    this.mappings.push({ genLine, genCol, origLine, origCol });

    // Mapped segment (4 or 5 fields)
    let segment = vlqEncode(genCol - this.prevGenCol);
    this.prevGenCol = genCol;

    segment += vlqEncode(0);  // source index (always 0 for single-source)

    segment += vlqEncode(origLine - this.prevOrigLine);
    this.prevOrigLine = origLine;

    segment += vlqEncode(origCol - this.prevOrigCol);
    this.prevOrigCol = origCol;

    // Optional: name index
    if (name != null) {
      let idx = this.addName(name);
      segment += vlqEncode(idx - this.prevNameIdx);
      this.prevNameIdx = idx;
    }

    this.lines[genLine].push(segment);
  }

  // Build reverse lookup: original position → generated position.
  // Returns a Map keyed by original line number, each value is { genLine, genCol }.
  // For lines with multiple mappings, uses the first (leftmost) one.
  toReverseMap() {
    let reverse = new Map();
    for (let m of this.mappings) {
      if (!reverse.has(m.origLine)) {
        reverse.set(m.origLine, { genLine: m.genLine, genCol: m.genCol });
      }
    }
    return reverse;
  }

  // Generate the Source Map V3 JSON
  toJSON() {
    let mappings = this.lines.map(segs => segs.join(',')).join(';');
    let map = { version: 3, file: this.file, sources: [this.source], names: this.names, mappings };
    if (this.sourceContent != null) map.sourcesContent = [this.sourceContent];
    return JSON.stringify(map);
  }
}

export { SourceMapGenerator, vlqEncode };
