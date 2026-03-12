// Shared source-map position utilities used by both the CLI type-checker
// (src/typecheck.js) and the VS Code language server (packages/vscode/src/lsp.js).

export function getLineText(text, lineNum) {
  let start = 0, line = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === '\n') {
      if (line === lineNum) return text.slice(start, i);
      start = i + 1;
      line++;
    }
  }
  return '';
}

export function findNearestWord(text, word, approx) {
  let bestIdx = -1, bestDist = Infinity, idx = 0;
  while ((idx = text.indexOf(word, idx)) >= 0) {
    const before = idx === 0 || /\W/.test(text[idx - 1]);
    const after = idx + word.length >= text.length || /\W/.test(text[idx + word.length]);
    if (before && after) {
      const dist = Math.abs(idx - approx);
      if (dist < bestDist) { bestDist = dist; bestIdx = idx; }
    }
    idx++;
  }
  return bestIdx;
}

export function offsetToLine(text, offset) {
  let line = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

export function lineColToOffset(text, line, col) {
  let r = 0;
  for (let i = 0; i < text.length; i++) {
    if (r === line) return i + col;
    if (text[i] === '\n') r++;
  }
  return text.length;
}

export function offsetToLineCol(text, offset) {
  let line = 0, ls = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') { line++; ls = i + 1; }
  }
  return { line, col: offset - ls };
}

// Map a TypeScript offset back to a Rip source { line, col } (0-based).
// Returns null if the offset falls in the DTS header (and no match is found).
//
// `entry` must have: tsContent, headerLines, genToSrc, source, srcColToGen (optional)
export function mapToSourcePos(entry, offset) {
  const tsLine = offsetToLine(entry.tsContent, offset);
  if (tsLine < entry.headerLines) {
    // DTS preamble — find the identifier at the offset and locate it in the source
    const genLineText = getLineText(entry.tsContent, tsLine);
    let lineStart = 0, curLine = 0;
    for (let i = 0; i < entry.tsContent.length; i++) {
      if (curLine === tsLine) { lineStart = i; break; }
      if (entry.tsContent[i] === '\n') curLine++;
    }
    const genCol = offset - lineStart;
    const wordMatch = genLineText.slice(genCol).match(/^\w+/);
    if (wordMatch && entry.source) {
      const word = wordMatch[0];
      const srcLines = entry.source.split('\n');
      const re = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');

      // Find enclosing type/interface from DTS context to narrow search —
      // without this, duplicate member names (e.g. "host" in two types) always
      // resolve to the first occurrence in the source.
      let searchStart = 0;
      for (let t = tsLine; t >= 0; t--) {
        const tl = getLineText(entry.tsContent, t);
        const tm = tl.match(/^(?:type|interface)\s+(\w+)/);
        if (tm) {
          const typeRe = new RegExp('(?:type|interface)\\s+' + tm[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
          for (let s = 0; s < srcLines.length; s++) {
            if (typeRe.test(srcLines[s])) { searchStart = s; break; }
          }
          break;
        }
        if (/^\}/.test(tl.trim())) break; // exited a type block — not inside one
      }

      for (let s = searchStart; s < srcLines.length; s++) {
        const m = re.exec(srcLines[s]);
        if (m) return { line: s, col: m.index };
      }
    }
    return null;
  }

  // Resolve source line from genToSrc
  let srcLine = entry.genToSrc.get(tsLine);
  if (srcLine === undefined) {
    // Walk backward to find nearest mapped gen line
    let best = -1;
    for (const [g] of entry.genToSrc) if (g <= tsLine && g > best) best = g;
    if (best >= 0) {
      srcLine = entry.genToSrc.get(best) + (tsLine - best);
    } else {
      srcLine = tsLine - entry.headerLines;
    }
  }

  // Compute generated column
  let lineStart = 0, curLine = 0;
  for (let i = 0; i < entry.tsContent.length; i++) {
    if (curLine === tsLine) { lineStart = i; break; }
    if (entry.tsContent[i] === '\n') curLine++;
  }
  const genCol = offset - lineStart;

  // Remap column via text matching
  const genText = getLineText(entry.tsContent, tsLine);
  let srcCol = genCol;
  let approx = genCol;  // default: assume same column
  // Scan ALL source lines for mappings to this gen line — a multi-line Rip
  // expression (e.g. object literal) may compile to a single gen line, so
  // multiple source lines can share one gen line.  Pick the closest genCol.
  if (entry.srcColToGen) {
    let bestDist = Infinity;
    for (const [sl, entries] of entry.srcColToGen) {
      for (const e of entries) {
        if (e.genLine === tsLine) {
          const dist = Math.abs(e.genCol - genCol);
          if (dist < bestDist) {
            bestDist = dist;
            srcLine = sl;
            approx = e.srcCol + (genCol - e.genCol);
          }
        }
      }
    }
  }
  const srcText = entry.source ? getLineText(entry.source, srcLine) : '';
  // Text-match: find the word at genCol in the gen line, then locate it in the source line
  if (srcText) {
    const wordAt = genText.slice(genCol).match(/^\w+/);
    if (wordAt) {
      const idx = findNearestWord(srcText, wordAt[0], approx);
      if (idx >= 0) return { line: srcLine, col: idx };
    }
    if (genCol > 0 && (!wordAt || genCol >= genText.length)) {
      const wordBefore = genText.slice(0, genCol).match(/(\w+)$/);
      if (wordBefore) {
        const idx = findNearestWord(srcText, wordBefore[0], approx - wordBefore[0].length);
        if (idx >= 0) return { line: srcLine, col: idx + wordBefore[0].length };
        // Injected property access (e.g. clicks.value from clicks :=) — map to end of object identifier
        const dotMatch = genText.slice(0, genCol - wordBefore[0].length).match(/(\w+)\.$/);
        if (dotMatch) {
          const objIdx = findNearestWord(srcText, dotMatch[1], approx - wordBefore[0].length - dotMatch[1].length - 1);
          if (objIdx >= 0) return { line: srcLine, col: objIdx + dotMatch[1].length };
        }
      }
    }
    srcCol = Math.max(0, approx);
  }
  return { line: srcLine, col: srcCol };
}
