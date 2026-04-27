// Source Map V3 — multi-chunk merger.
//
// Concatenates N JS chunks (each with its own inline source map) into one
// JS string + one merged source map. Used by `processRipScripts` to produce
// a single eval'd chunk that DevTools can map back to multiple original
// `.rip` files.
//
// Why this exists: DevTools only honours the LAST `//# sourceMappingURL`
// inside one eval'd chunk. So when N chunks share lexical scope (concat
// + single eval, the bundle-no-router execution model), we must produce
// ONE map that covers all N sources. Source Map V3 supports this natively
// via a multi-entry `sources` / `sourcesContent` array and source-index
// fields in the VLQ mappings — every production JS bundler does this.
//
// Algorithm:
//   1. Strip per-chunk `//# sourceMappingURL=` pragmas from each chunk's JS
//   2. Decode each chunk's `mappings` to absolute coordinates
//   3. Concatenate JS with `\n;\n` separators (statement-safe, +2 newlines
//      between chunks)
//   4. Offset each chunk's generated line numbers by the cumulative line
//      count of preceding chunks + separators
//   5. Dedupe `sources`, `sourcesContent`, `names` into merged arrays;
//      remap each chunk's source-index / name-index fields
//   6. Re-encode as relative VLQ across the full concatenated mapping
//
// Returns { js, mapJSON } where mapJSON is a JSON string ready to embed
// as a base64 data URL via a single `//# sourceMappingURL=` at the end.

import { vlqEncode, vlqDecode } from './sourcemaps.js';

// `\n;\n` is statement-safe between chunks (the `;` ensures the previous
// line's expression is terminated). Counts as 2 newlines for line-offset.
const SEPARATOR = '\n;\n';
const SEPARATOR_LINES = 2;

// Strip a trailing `//# sourceMappingURL=...` pragma from a JS string so
// concatenated chunks don't carry stray maps that DevTools would honor
// in unexpected order. Returns { js, mapJSON } where mapJSON is the
// JSON string extracted from the inline data URL (or null if no pragma).
function extractMap(js) {
  const re = /\n?\/\/# sourceMappingURL=data:application\/json(?:;charset=[^;,]+)?;base64,([A-Za-z0-9+/=]+)\s*$/;
  const m = js.match(re);
  if (!m) return { js, mapJSON: null };
  let mapJSON;
  try {
    // UTF-8-safe decode (counterpart of the encode in compiler.js).
    const bin = atob(m[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    mapJSON = new TextDecoder().decode(bytes);
  } catch {
    return { js: js.slice(0, m.index), mapJSON: null };
  }
  return { js: js.slice(0, m.index), mapJSON };
}

// Count the number of newline characters in a string. Used for line-offset
// math when concatenating chunks; one chunk's line count = newline count
// (a chunk starting at line offset L and containing N newlines occupies
// generated lines [L, L+N], so the next chunk starts at L+N+1 if the
// chunk had a trailing newline, or L+N if not — handled via SEPARATOR).
function countNewlines(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) if (str.charCodeAt(i) === 10) n++;
  return n;
}

// Decode a Source Map V3 `mappings` field into an array of arrays of
// absolute-coordinate segments. Each segment is one of:
//   { genCol }                              — unmapped (1 field)
//   { genCol, src, origLine, origCol }      — mapped (4 fields)
//   { genCol, src, origLine, origCol, name } — mapped + name (5 fields)
// State: genCol resets to 0 at each line; src/origLine/origCol/name
// persist across lines per the V3 spec.
function decodeMappings(mappingsStr) {
  const lines = mappingsStr.split(';');
  const result = [];
  let src = 0, origLine = 0, origCol = 0, nameIdx = 0;
  for (const line of lines) {
    const segs = [];
    let genCol = 0;
    if (line.length > 0) {
      for (const segStr of line.split(',')) {
        if (segStr.length === 0) continue;
        const fields = vlqDecode(segStr);
        genCol += fields[0];
        if (fields.length === 1) {
          segs.push({ genCol });
        } else {
          src += fields[1];
          origLine += fields[2];
          origCol += fields[3];
          const seg = { genCol, src, origLine, origCol };
          if (fields.length >= 5) {
            nameIdx += fields[4];
            seg.name = nameIdx;
          }
          segs.push(seg);
        }
      }
    }
    result.push(segs);
  }
  return result;
}

// Re-encode an array of arrays of absolute-coordinate segments back to
// V3 `mappings` string. Counterpart of decodeMappings.
function encodeMappings(perLineSegs) {
  let prevGenCol = 0; // resets per line
  let prevSrc = 0, prevOrigLine = 0, prevOrigCol = 0, prevNameIdx = 0;
  const out = [];
  for (const segs of perLineSegs) {
    prevGenCol = 0;
    const lineParts = [];
    for (const seg of segs) {
      if (seg.src == null) {
        lineParts.push(vlqEncode(seg.genCol - prevGenCol));
      } else {
        let s = vlqEncode(seg.genCol - prevGenCol);
        s += vlqEncode(seg.src - prevSrc);
        s += vlqEncode(seg.origLine - prevOrigLine);
        s += vlqEncode(seg.origCol - prevOrigCol);
        if (seg.name != null) {
          s += vlqEncode(seg.name - prevNameIdx);
          prevNameIdx = seg.name;
        }
        prevSrc = seg.src;
        prevOrigLine = seg.origLine;
        prevOrigCol = seg.origCol;
        lineParts.push(s);
      }
      prevGenCol = seg.genCol;
    }
    out.push(lineParts.join(','));
  }
  return out.join(';');
}

// Given an array of `{js, mapJSON}` chunks (where mapJSON is the source-map
// V3 JSON string for that chunk, or null/undefined if the chunk has no
// map), produce a single merged result.
//
// Returns:
//   {
//     js,        // concatenated JS, with all per-chunk sourceMappingURL
//                // pragmas stripped — caller appends ONE merged pragma
//     mapJSON,   // V3 source-map JSON string covering all chunks, or
//                // null if no chunk had a map
//   }
//
// The chunks must be in the order they should be eval'd. Each chunk's JS
// is treated as opaque — we don't parse it, we only count newlines for
// line-offset math.
export function mergeChunks(chunks) {
  // Strip per-chunk pragmas first; we'll append exactly one at the end.
  const stripped = chunks.map((c) => {
    if (c.mapJSON !== undefined) return { js: c.js, mapJSON: c.mapJSON };
    return extractMap(c.js);
  });

  // If no chunk has a map, the merged JS is just concatenated; no map.
  const anyMap = stripped.some((c) => c.mapJSON);
  const mergedJS = stripped.map((c) => c.js).join(SEPARATOR);
  if (!anyMap) return { js: mergedJS, mapJSON: null };

  // Build merged sources / sourcesContent / names with deduplication
  // by string identity. Per-chunk remap tables let us rewrite each
  // chunk's source-index / name-index fields into the merged arrays.
  const mergedSources = [];
  const mergedSourcesContent = [];
  const sourceIndexByName = new Map();
  const mergedNames = [];
  const nameIndexByName = new Map();

  function addSource(name, content) {
    if (sourceIndexByName.has(name)) return sourceIndexByName.get(name);
    const idx = mergedSources.length;
    mergedSources.push(name);
    mergedSourcesContent.push(content ?? null);
    sourceIndexByName.set(name, idx);
    return idx;
  }
  function addName(name) {
    if (nameIndexByName.has(name)) return nameIndexByName.get(name);
    const idx = mergedNames.length;
    mergedNames.push(name);
    nameIndexByName.set(name, idx);
    return idx;
  }

  // Per-chunk: line offset (cumulative gen-line shift), source-index
  // remap, name-index remap, decoded segments.
  const chunkInfos = [];
  let lineOffset = 0;
  for (let i = 0; i < stripped.length; i++) {
    const c = stripped[i];
    const info = { lineOffset, srcRemap: [], nameRemap: [], perLineSegs: null };

    if (c.mapJSON) {
      let map;
      try { map = JSON.parse(c.mapJSON); }
      catch { map = null; }
      if (map && typeof map.mappings === 'string') {
        const sources = map.sources || [];
        const sourcesContent = map.sourcesContent || [];
        info.srcRemap = sources.map((s, idx) => addSource(s, sourcesContent[idx]));
        const names = map.names || [];
        info.nameRemap = names.map((n) => addName(n));
        info.perLineSegs = decodeMappings(map.mappings);
      }
    }

    chunkInfos.push(info);

    // Advance lineOffset by this chunk's line count + separator (except
    // after the last chunk). Use the JS string we'll actually emit so
    // line counts stay consistent with the merged output.
    const chunkLines = countNewlines(c.js);
    const sepLines = (i < stripped.length - 1) ? SEPARATOR_LINES : 0;
    lineOffset += chunkLines + sepLines;
  }

  // Walk all chunks and emit their segments into the merged per-line
  // segment array, with each chunk's gen-line indices shifted by the
  // chunk's lineOffset and source/name indices remapped.
  const totalLines = lineOffset + 1; // last chunk's lines fit within
  const mergedPerLineSegs = new Array(totalLines).fill(null).map(() => []);

  for (const info of chunkInfos) {
    if (!info.perLineSegs) continue;
    for (let li = 0; li < info.perLineSegs.length; li++) {
      const target = info.lineOffset + li;
      if (target >= mergedPerLineSegs.length) {
        // Defensive: extend if a chunk has more lines than we counted.
        while (mergedPerLineSegs.length <= target) mergedPerLineSegs.push([]);
      }
      for (const seg of info.perLineSegs[li]) {
        if (seg.src == null) {
          mergedPerLineSegs[target].push({ genCol: seg.genCol });
        } else {
          const remapped = {
            genCol: seg.genCol,
            src: info.srcRemap[seg.src],
            origLine: seg.origLine,
            origCol: seg.origCol,
          };
          if (seg.name != null) remapped.name = info.nameRemap[seg.name];
          mergedPerLineSegs[target].push(remapped);
        }
      }
    }
  }

  const mergedMappings = encodeMappings(mergedPerLineSegs);
  const mergedMap = {
    version: 3,
    sources: mergedSources,
    sourcesContent: mergedSourcesContent,
    names: mergedNames,
    mappings: mergedMappings,
  };
  return { js: mergedJS, mapJSON: JSON.stringify(mergedMap) };
}

// UTF-8-safe base64 encode for embedding mapJSON as a data URL pragma.
// Counterpart of the encode used in src/compiler.js.
function utf8ToBase64(str) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf8').toString('base64');
  }
  // Browser path: TextEncoder + btoa over latin1 bytes.
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// Convenience: take chunks, run mergeChunks, append a single
// `//# sourceMappingURL=` data-URL pragma to the merged JS, return it.
// If no chunk had a map, returns the concat'd JS unchanged.
export function mergeChunksWithInlineMap(chunks) {
  const { js, mapJSON } = mergeChunks(chunks);
  if (!mapJSON) return js;
  const b64 = utf8ToBase64(mapJSON);
  return js + '\n//# sourceMappingURL=data:application/json;base64,' + b64 + '\n';
}
