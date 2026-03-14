// Rip Language Server — TypeScript-powered IntelliSense for .rip files
//
// Runs as a language server process (stdio transport). Compiles .rip files
// to virtual TypeScript in memory using the shared typecheck infrastructure,
// then delegates to a TypeScript language service for diagnostics,
// completions, hover, go-to-definition, and signature help.

const { createConnection, TextDocuments, ProposedFeatures, TextDocumentSyncKind } = require('vscode-languageserver/node');
const { TextDocument } = require('vscode-languageserver-textdocument');
const path = require('path');
const fs = require('fs');

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let ts, compiler, tc, service, rootPath, lastPatchedProgram;

// Real .rip path → { version, source, tsContent, srcToGen, genToSrc, ... }
const compiled = new Map();

// Component name → { props: [{ name, type, required }], source, line }
const componentRegistry = new Map();

// TypeScript sees virtual .ts paths; we translate at the boundary
function toVirtual(p) { return p + '.ts'; }
function fromVirtual(p) { return p.endsWith('.rip.ts') ? p.slice(0, -3) : p; }
function isVirtual(p) { return p.endsWith('.rip.ts'); }

// ── Semantic token legend ──────────────────────────────────────────
// Token types and modifiers aligned with TypeScript's TwentyTwenty
// encoding from getEncodedSemanticClassifications().

const SEMANTIC_TOKEN_TYPES = [
  'namespace',      // 0
  'type',           // 1
  'class',          // 2
  'enum',           // 3
  'interface',      // 4
  'typeParameter',  // 5
  'parameter',      // 6
  'variable',       // 7
  'property',       // 8
  'enumMember',     // 9
  'function',       // 10
  'method',         // 11
  'decorator',      // 12
];

const SEMANTIC_TOKEN_MODIFIERS = [
  'declaration',     // bit 0
  'static',          // bit 1
  'async',           // bit 2
  'readonly',        // bit 3
  'defaultLibrary',  // bit 4
];

// HTML/SVG tag names from TEMPLATE_TAGS (src/components.js). When one
// of these appears as the first word on an indented line, the TextMate
// grammar assigns entity.name.tag.rip. We skip semantic tokens at
// those positions so the tag colour is preserved.
const HTML_TAG_NAMES = new Set([
  'a','abbr','address','animate','animateMotion','animateTransform','area','article','aside','audio',
  'b','base','bdi','bdo','blockquote','body','br','button','canvas','caption','circle','cite',
  'clipPath','code','col','colgroup','data','datalist','dd','defs','del','desc','details','dfn',
  'dialog','div','dl','dt','ellipse','em','embed','feBlend','feColorMatrix','feComponentTransfer',
  'feComposite','feConvolveMatrix','feDiffuseLighting','feDisplacementMap','feDistantLight',
  'feDropShadow','feFlood','feFuncA','feFuncB','feFuncG','feFuncR','feGaussianBlur','feImage',
  'feMerge','feMergeNode','feMorphology','feOffset','fePointLight','feSpecularLighting','feSpotLight',
  'feTile','feTurbulence','fieldset','figcaption','figure','filter','footer','foreignObject','form',
  'g','h1','h2','h3','h4','h5','h6','head','header','hr','html','i','iframe','image','img','input',
  'ins','kbd','label','legend','li','line','linearGradient','link','main','map','mark','marker',
  'mask','math','menu','meta','metadata','meter','mpath','nav','noscript','object','ol','optgroup',
  'option','output','p','param','path','pattern','picture','polygon','polyline','portal','pre',
  'progress','q','radialGradient','rect','rp','rt','ruby','s','samp','script','section','select',
  'set','slot','small','source','span','stop','strong','style','sub','summary','sup','svg','switch',
  'symbol','table','tbody','td','template','text','textPath','textarea','tfoot','th','thead','time',
  'title','tr','track','tspan','u','ul','use','var','video','view','wbr',
]);

// Map TS twenty-twenty classification tokenType → our legend index.
// TS encodes: class=0, enum=1, interface=2, namespace=3, typeParameter=4,
// type=5, parameter=6, variable=7, enumMember=8, property=9, function=10, member=11
const TS_TYPE_TO_LEGEND = [
  2,   // 0: class → class(2)
  3,   // 1: enum → enum(3)
  4,   // 2: interface → interface(4)
  0,   // 3: namespace → namespace(0)
  5,   // 4: typeParameter → typeParameter(5)
  1,   // 5: type → type(1)
  6,   // 6: parameter → parameter(6)
  7,   // 7: variable → variable(7)
  9,   // 8: enumMember → enumMember(9)
  8,   // 9: property → property(8)
  10,  // 10: function → function(10)
  11,  // 11: member → method(11)
];

connection.onInitialize(async (params) => {
  rootPath = params.rootPath || process.cwd();
  connection.console.log(`[rip] root: ${rootPath}`);

  compiler = await loadCompiler(rootPath);
  connection.console.log(`[rip] compiler: ${compiler ? 'loaded' : 'NOT FOUND'}`);

  tc = await loadTypecheck(rootPath);
  connection.console.log(`[rip] typecheck: ${tc ? 'loaded' : 'NOT FOUND'}`);

  ts = loadTypeScript(params);
  if (ts) connection.console.log(`[rip] TypeScript ${ts.version}`);

  if (ts && compiler && tc) {
    service = createService();
    connection.console.log('[rip] language service ready');
  }

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      completionProvider: { triggerCharacters: ['.', '"', "'", '/', ':', ' '] },
      hoverProvider: true,
      definitionProvider: true,
      signatureHelpProvider: { triggerCharacters: ['(', ','] },
      semanticTokensProvider: {
        legend: { tokenTypes: SEMANTIC_TOKEN_TYPES, tokenModifiers: SEMANTIC_TOKEN_MODIFIERS },
        full: true,
      },
    },
  };
});

connection.onInitialized(() => {
  connection.console.log('[rip] ready');
});

connection.onDidChangeConfiguration(() => {
  for (const fp of compiled.keys()) publishDiagnostics(fp);
});

// ── Document sync ──────────────────────────────────────────────────

documents.onDidChangeContent(({ document }) => {
  const fp = uriToPath(document.uri);
  if (fp.endsWith('.rip') && compiler && tc) compileRip(fp, document.getText());
});

documents.onDidClose(({ document }) => {
  const fp = uriToPath(document.uri);
  compiled.delete(fp);
  connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
});

function compileRip(filePath, source) {
  try {
    const entry = tc.compileForCheck(filePath, source, compiler);
    const prev = compiled.get(filePath);

    compiled.set(filePath, {
      version: (prev?.version || 0) + 1,
      ...entry,
    });

    if (entry.dts) {
      updateComponentRegistry(filePath, source, entry.dts);
    }

    connection.console.log(`[rip] compiled ${path.basename(filePath)}: hasTypes=${entry.hasTypes}, headerLines=${entry.headerLines}`);
    publishDiagnostics(filePath);
  } catch (e) {
    compiled.delete(filePath);

    // Surface parse/syntax errors as diagnostics
    const diagnostics = [];
    let line = 0, col = 0, endCol = 1;
    if (e.hash?.loc) {
      // Parser error: loc may be Rip format {r, c, n} or Jison format {first_line, first_column, ...}
      const loc = e.hash.loc;
      if (loc.r != null) {
        line = loc.r;
        col = loc.c || 0;
        endCol = loc.n ? col + loc.n : col + 1;
      } else {
        line = loc.first_line ?? 0;
        col = loc.first_column ?? 0;
        endCol = loc.last_column != null ? loc.last_column + 1 : col + 1;
      }
    } else if (e.location) {
      // Lexer SyntaxError: {first_line, first_column, last_column}
      line = e.location.first_line || 0;
      col = e.location.first_column || 0;
      endCol = e.location.last_column != null ? e.location.last_column + 1 : col + 1;
    }

    // Extract a clean message from the double-wrapped parse error format:
    // "Parse error at line X, column Y (token: T): Parse error on line N: Unexpected 'TOKEN'"
    let message = e.message || 'Compilation error';
    const innerIdx = message.indexOf('): ');
    if (innerIdx >= 0) message = message.slice(innerIdx + 3);
    message = message.replace(/^Parse error on line \d+:\s*/, '');
    if (!message.trim()) message = e.message || 'Compilation error';

    diagnostics.push({
      severity: 1, // Error
      range: { start: { line, character: col }, end: { line, character: endCol } },
      message,
      source: 'rip',
    });
    connection.sendDiagnostics({ uri: pathToUri(filePath), diagnostics });
    connection.console.log(`[rip] compile error ${path.basename(filePath)}: ${e.message}`);
  }
}

function publishDiagnostics(filePath) {
  const c = compiled.get(filePath);
  if (!c) return;

  const diagnostics = [];

  // TypeScript diagnostics (typed files with TS service)
  if (service && c.hasTypes) {
    try {
      patchTypes();
      const vf = toVirtual(filePath);
      const semanticDiags = service.getSemanticDiagnostics(vf);
      const syntacticDiags = service.getSyntacticDiagnostics(vf);
      const allDiags = [...syntacticDiags, ...semanticDiags];

      for (const d of allDiags) {
        if (d.start === undefined) continue;
        if (tc.SKIP_CODES.has(d.code)) continue;

        const startPos = genToSrcPos(filePath, d.start);
        const endPos = genToSrcPos(filePath, d.start + (d.length || 1));

        if (startPos.line < 0) continue;

        const message = tc.cleanDiagnosticMessage(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
        const tags = [];
        if (d.reportsUnnecessary) tags.push(1);
        if (d.reportsDeprecated) tags.push(2);
        diagnostics.push({
          range: { start: startPos, end: endPos },
          severity: d.category === 1 ? 1 : d.category === 0 ? 2 : d.category === 2 ? 4 : 3,
          code: d.code,
          source: 'rip',
          message,
          tags: tags.length > 0 ? tags : undefined,
        });
      }
    } catch (e) {
      connection.console.log(`[rip] diagnostics error: ${e.message}`);
    }
  }

  // Component prop diagnostics (typed files only)
  if (c.hasTypes && c.source && componentRegistry.size > 0) {
    const srcLines = c.source.split('\n');
    for (let i = 0; i < srcLines.length; i++) {
      const usage = tc.collectUsageProps(srcLines, i, componentRegistry);
      if (!usage) continue;
      const info = componentRegistry.get(usage.component);
      if (!info) continue;

      for (const prop of usage.usedProps) {
        if (prop.startsWith('@')) continue;
        if (prop === 'class' || prop === 'style') continue;
        if (!info.props.some(p => p.name === prop)) {
          const col = srcLines[i].indexOf(prop);
          if (col >= 0) {
            diagnostics.push({
              range: { start: { line: i, character: col }, end: { line: i, character: col + prop.length } },
              severity: 1,
              source: 'rip',
              message: `Unknown prop '${prop}' on component ${usage.component}`,
            });
          }
        }
      }

      // Required prop checking
      for (const prop of info.props) {
        if (!prop.required) continue;
        if (usage.usedProps.includes(prop.name)) continue;
        const col = srcLines[i].indexOf(usage.component);
        if (col >= 0) {
          diagnostics.push({
            range: { start: { line: i, character: col }, end: { line: i, character: col + usage.component.length } },
            severity: 1,
            source: 'rip',
            message: `Missing required prop '${prop.name}' on component ${usage.component}`,
          });
        }
      }
    }

    // Untyped prop errors (at component definitions, not usage sites)
    for (const [name, compDef] of componentRegistry) {
      if (compDef.source !== filePath) continue;
      for (const e of tc.checkComponentDefs(compDef.props, srcLines, compDef.line)) {
        diagnostics.push({
          range: { start: { line: e.line, character: e.col }, end: { line: e.line, character: e.col + e.len } },
          severity: 1,
          source: 'rip',
          message: e.message,
        });
      }
    }
  }

  connection.sendDiagnostics({ uri: pathToUri(filePath), diagnostics });
  connection.console.log(`[rip] diagnostics ${path.basename(filePath)}: ${diagnostics.length} issues`);
}

// ── TypeScript Language Service ────────────────────────────────────

function createService() {
  const settings = tc.createTypeCheckSettings(ts);

  const host = {
    getScriptFileNames: () => [...compiled.keys()].map(toVirtual),
    getScriptVersion: (f) => String(compiled.get(fromVirtual(f))?.version || 0),
    getScriptSnapshot(f) {
      const c = compiled.get(fromVirtual(f));
      if (c) return ts.ScriptSnapshot.fromString(c.tsContent);
      try { return ts.ScriptSnapshot.fromString(fs.readFileSync(f, 'utf8')); } catch { return undefined; }
    },
    getCompilationSettings: () => settings,
    getDefaultLibFileName: (opts) => ts.getDefaultLibFilePath(opts),
    getCurrentDirectory: () => rootPath,
    fileExists(f) { return compiled.has(fromVirtual(f)) || ts.sys.fileExists(f); },
    readFile(f) { return compiled.get(fromVirtual(f))?.tsContent || ts.sys.readFile(f); },
    readDirectory: (...a) => ts.sys.readDirectory(...a),
    getDirectories: (...a) => ts.sys.getDirectories(...a),
    directoryExists: (...a) => ts.sys.directoryExists(...a),

    resolveModuleNames(names, containingFile) {
      return names.map((name) => {
        if (name.endsWith('.rip')) {
          const resolved = path.resolve(path.dirname(fromVirtual(containingFile)), name);
          if (!compiled.has(resolved) && fs.existsSync(resolved)) {
            compileRip(resolved, fs.readFileSync(resolved, 'utf8'));
          }
          if (compiled.has(resolved)) {
            return { resolvedFileName: toVirtual(resolved), extension: '.ts', isExternalLibraryImport: false };
          }
        }
        const r = ts.resolveModuleName(name, containingFile, settings, {
          fileExists: host.fileExists,
          readFile: host.readFile,
          directoryExists: host.directoryExists,
          getCurrentDirectory: host.getCurrentDirectory,
          getDirectories: host.getDirectories,
        });
        return r.resolvedModule;
      });
    },
  };

  return ts.createLanguageService(host, ts.createDocumentRegistry());
}

// ── Type inference patching ────────────────────────────────────────
// Rip hoists locals as `let x; x = expr;` which TypeScript infers as `any`.
// We exploit the Transient flag: getSymbolLinks(symbol) returns symbol.links
// directly when symbol.flags & Transient, bypassing the closured symbolLinks
// array. Setting symbol.links = { type } before any type resolution makes
// TypeScript see the correct type through all 67+ internal checker functions.

function patchTypes() {
  if (!service) return;
  const program = service.getProgram();
  if (!program || program === lastPatchedProgram) return;
  lastPatchedProgram = program;
  tc.patchUninitializedTypes(ts, service, compiled);
}

// ── Position mapping ───────────────────────────────────────────────

function srcToOffset(filePath, line, col) {
  const c = compiled.get(filePath);
  if (!c) return undefined;
  let genLine = c.srcToGen.get(line);
  let genColHint = -1;  // column hint from source map, -1 = no hint
  let bestSrcCol = -1;  // srcCol of the best column-aware entry

  // Column-aware lookup: when sub-expression mappings exist for this source
  // line, pick the entry whose srcCol is closest to (but ≤) the cursor column.
  // This selects the right generated line AND provides a column hint.
  if (c.srcColToGen) {
    const colEntries = c.srcColToGen.get(line);
    if (colEntries && colEntries.length > 0) {
      let best = colEntries[0];
      for (const e of colEntries) {
        if (e.srcCol <= col && (best.srcCol > col || e.srcCol > best.srcCol)) {
          best = e;
        }
      }
      // If no entry has srcCol ≤ col, use the one closest overall
      if (best.srcCol > col) {
        for (const e of colEntries) {
          if (Math.abs(e.srcCol - col) < Math.abs(best.srcCol - col)) best = e;
        }
      }
      genLine = best.genLine;
      genColHint = best.genCol;
      bestSrcCol = best.srcCol;
    }
  }

  if (genLine === undefined) {
    let best = -1;
    for (const [s] of c.srcToGen) if (s <= line && s > best) best = s;
    if (best < 0) return undefined;
    genLine = c.srcToGen.get(best);
  }
  const srcLines = c.source.split('\n');
  const genLines = c.tsContent.split('\n');
  const KEYWORDS = new Set(['interface', 'type', 'enum', 'class', 'export', 'declare', 'extends', 'implements', 'import', 'from', 'def', 'const', 'let', 'var']);
  if (srcLines[line] && genLines[genLine]) {
    const srcText = srcLines[line];
    const genText = genLines[genLine];
    const leftPart = srcText.substring(0, col).match(/\w*$/)?.[0] || '';
    const rightPart = srcText.substring(col).match(/^\w*/)?.[0] || '';
    let wordMatch = (leftPart + rightPart) ? [leftPart + rightPart] : null;
    if (wordMatch && KEYWORDS.has(wordMatch[0])) {
      const after = srcText.substring(col + wordMatch[0].length).match(/\s+(\w+)/);
      if (after) wordMatch = [after[1]];
    }
    if (wordMatch) {
      const word = wordMatch[0];
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Only trust genColHint when the source-map entry's srcCol is close to
      // the word being hovered. A line-level entry (srcCol=0) far from the
      // cursor gives a misleading hint that biases toward the line start.
      const wordStart = col - leftPart.length;
      const useHint = genColHint >= 0 && bestSrcCol >= wordStart && bestSrcCol < wordStart + word.length;

      // Prefer the overload signature line (genLine-1) when it exists and
      // contains the same identifier — overloads carry typed parameters.
      let targetLine = genLine;
      let targetText = genText;
      if (genLine > 0) {
        const prevText = genLines[genLine - 1] || '';
        if (/^(?:export\s+)?function\s+\w+\(.*\).*;\s*$/.test(prevText)) {
          const re0 = new RegExp('\\b' + escaped + '\\b');
          if (re0.test(prevText)) { targetLine = genLine - 1; targetText = prevText; }
        }
      }

      const re = new RegExp('\\b' + escaped + '\\b', 'g');
      let m, bestCol = -1, bestDist = Infinity;
      while ((m = re.exec(targetText)) !== null) {
        const dist = useHint
          ? Math.abs(m.index - genColHint)
          : Math.abs(m.index - col);
        if (dist < bestDist) { bestDist = dist; bestCol = m.index; }
      }
      if (bestCol >= 0) return lineColToOffset(c.tsContent, targetLine, bestCol);

      // Fall back to the original genLine if overload didn't match
      if (targetLine !== genLine) {
        const re1b = new RegExp('\\b' + escaped + '\\b', 'g');
        let m1b, bestCol1b = -1, bestDist1b = Infinity;
        while ((m1b = re1b.exec(genText)) !== null) {
          const dist = useHint ? Math.abs(m1b.index - genColHint) : Math.abs(m1b.index - col);
          if (dist < bestDist1b) { bestDist1b = dist; bestCol1b = m1b.index; }
        }
        if (bestCol1b >= 0) return lineColToOffset(c.tsContent, genLine, bestCol1b);
      }

      // Word not on mapped line — search nearby generated lines
      for (let delta = 1; delta <= 3; delta++) {
        for (const tryLine of [genLine + delta, genLine - delta]) {
          if (tryLine < 0 || tryLine >= genLines.length) continue;
          const tryText = genLines[tryLine];
          const re2 = new RegExp('\\b' + escaped + '\\b', 'g');
          let m2, best2 = -1, bestDist2 = Infinity;
          while ((m2 = re2.exec(tryText)) !== null) {
            const dist2 = Math.abs(m2.index - col);
            if (dist2 < bestDist2) { bestDist2 = dist2; best2 = m2.index; }
          }
          if (best2 >= 0) return lineColToOffset(c.tsContent, tryLine, best2);
        }
      }
    }
  }
  const genText = c.tsContent.split('\n')[genLine] || '';
  if (col < genText.length) return lineColToOffset(c.tsContent, genLine, col);
  return lineColToOffset(c.tsContent, genLine, 0);
}

function genToSrcPos(filePath, offset) {
  const c = compiled.get(filePath);
  if (!c) return { line: 0, character: 0 };
  const pos = tc.mapToSourcePos(c, offset);
  if (!pos) return { line: 0, character: 0 };
  return { line: pos.line, character: pos.col };
}

function lineColToOffset(t, line, col) { return tc.lineColToOffset(t, line, col); }
function offsetToLineCol(t, o) { const p = tc.offsetToLineCol(t, o); return { line: p.line, character: p.col }; }
function uriToPath(u) { try { return decodeURIComponent(new URL(u).pathname); } catch { return u; } }
function pathToUri(p) { return 'file://' + p; }

// Check whether a column position falls inside a string literal or comment.
// Scans left-to-right tracking quote state and comment markers.
function isInsideStringOrComment(line, col) {
  let quote = null;
  let interpDepth = 0;
  for (let i = 0; i < col; i++) {
    const ch = line[i];
    if (interpDepth > 0) {
      if (ch === '{') interpDepth++;
      else if (ch === '}') { interpDepth--; if (interpDepth === 0) quote = '"'; }
      else if (ch === '"' || ch === "'") {
        // nested string inside interpolation — skip it
        const q = ch;
        i++;
        while (i < col && line[i] !== q) { if (line[i] === '\\') i++; i++; }
      }
      continue;
    }
    if (quote) {
      if (ch === '\\') { i++; continue; }
      if (quote === '"' && ch === '#' && line[i + 1] === '{') {
        interpDepth = 1;
        quote = null;
        i++; // skip '{'
        continue;
      }
      if (ch === quote) quote = null;
    } else {
      if (ch === '#') return true;  // Rip line comment
      if (ch === '"' || ch === "'") quote = ch;
    }
  }
  return !!quote && interpDepth === 0;
}

// Find an unused word-boundary occurrence of `word` near `centerLine`.
// Searches outward ±5 lines, skipping positions already in `used`.
// Calls `assign(line, col)` and returns true on success.
function findUnusedOccurrence(srcLines, word, len, centerLine, used, assign) {
  for (let delta = 0; delta <= 5; delta++) {
    const tryLines = delta === 0 ? [centerLine] : [centerLine - delta, centerLine + delta];
    for (const ln of tryLines) {
      if (ln < 0 || ln >= srcLines.length) continue;
      const s = srcLines[ln];
      let idx = -1;
      while ((idx = s.indexOf(word, idx + 1)) !== -1) {
        if ((idx === 0 || !/\w/.test(s[idx - 1])) &&
            (idx + len >= s.length || !/\w/.test(s[idx + len])) &&
            !used.has(ln + ':' + idx) &&
            !isInsideStringOrComment(s, idx)) {
          assign(ln, idx);
          return true;
        }
      }
    }
  }
  return false;
}

// ── Reactive type unwrapping ────────────────────────────────────────
// Rip's reactive operators (:=, ~=) compile to Signal<T> / Computed<T>
// wrappers. On hover, show the inner type T instead — users write and
// think in terms of the value type, not the wrapper.

function unwrapReactiveType(display) {
  for (const wrapper of ['Signal', 'Computed']) {
    const tag = wrapper + '<';
    const idx = display.indexOf(tag);
    if (idx < 0) continue;
    const start = idx + tag.length;
    let depth = 1, end = start;
    while (end < display.length && depth > 0) {
      if (display[end] === '<') depth++;
      else if (display[end] === '>') depth--;
      end++;
    }
    if (depth === 0) {
      const inner = display.slice(start, end - 1);
      display = display.slice(0, idx) + inner + display.slice(end);
      // Signal → let (mutable state), Computed → const (derived, read-only)
      if (wrapper === 'Signal') display = display.replace(/\bconst\b/, 'let');
    }
  }
  display = display.replace(/\b__RipProps<['"](\w+)['"]>/g, '<$1> props');
  display = display.replace(/\b__RipElementMap\b/g, 'ElementMap');
  display = display.replace(/\b__RipEvents\b/g, 'EventHandlers');
  display = display.replace(/\b__ripEl\b/g, 'element');
  return display;
}

// ── Component IntelliSense infrastructure ──────────────────────────

function updateComponentRegistry(filePath, source, dts) {
  for (const [name, info] of componentRegistry) {
    if (info.source === filePath) componentRegistry.delete(name);
  }

  const parsed = tc.parseComponentDTS(dts);
  const srcLines = source.split('\n');

  for (const [name, info] of parsed) {
    let defLine = 0;
    for (let s = 0; s < srcLines.length; s++) {
      if (new RegExp('^(?:export\\s+)?' + name + '\\s*=\\s*component\\b').test(srcLines[s].trimStart())) {
        defLine = s;
        break;
      }
    }
    componentRegistry.set(name, { ...info, source: filePath, line: defLine });
  }
}

function extractUnionValues(typeStr) {
  if (typeStr === 'boolean') return ['true', 'false'];
  const values = [];
  for (const part of typeStr.split('|').map(s => s.trim())) {
    if (/^["']/.test(part)) values.push(part);
  }
  return values;
}

// Resolve a type name to its definition string from all compiled DTS.
// e.g. "Status" → '"pending" | "active" | "done"'
function resolveTypeFromDTS(typeName) {
  for (const [, entry] of compiled) {
    if (!entry.dts) continue;
    const re = new RegExp('^(?:export\\s+)?type\\s+' + typeName + '\\s*=\\s*(.+?)\\s*;?$', 'm');
    const m = entry.dts.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

function getWordAtPosition(text, position) {
  const lines = text.split('\n');
  const line = lines[position.line];
  if (!line) return null;
  const col = position.character;
  let start = col, end = col;
  while (start > 0 && /\w/.test(line[start - 1])) start--;
  while (end < line.length && /\w/.test(line[end])) end++;
  return start < end ? line.substring(start, end) : null;
}

function splitProps(str) {
  const segments = [];
  let start = 0, depth = 0, quote = null, colon = -1;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (quote) {
      if (ch === '\\') { i++; continue; }
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
    } else if (ch === ':' && depth === 0 && colon < 0) {
      colon = i - start;
    } else if (ch === ',' && depth === 0) {
      segments.push({ start, end: i, text: str.substring(start, i), colon });
      start = i + 1;
      colon = -1;
    }
  }
  segments.push({ start, end: str.length, text: str.substring(start), colon });
  return segments;
}

// Detect component context for block-style usage. Walks up from the current
// line to find a parent component, then builds context from the current line.
function detectBlockComponentContext(srcLines, lineIndex, col) {
  // First try the current line directly
  const direct = detectComponentContext(srcLines[lineIndex], col);
  if (direct) {
    // Also collect props from indented block lines below for existingProps
    const baseIndent = srcLines[lineIndex].length - srcLines[lineIndex].trimStart().length;
    for (let b = lineIndex + 1; b < srcLines.length; b++) {
      const bLine = srcLines[b];
      if (bLine.trim() === '') continue;
      const bIndent = bLine.length - bLine.trimStart().length;
      if (bIndent <= baseIndent) break;
      for (const m of bLine.trimStart().matchAll(/(?:^|,)\s*(\w+)\s*:/g)) {
        if (!direct.existingProps.includes(m[1])) direct.existingProps.push(m[1]);
      }
    }
    return direct;
  }

  // Walk up to find parent component
  const curLine = srcLines[lineIndex];
  if (!curLine) return null;
  const curIndent = curLine.length - curLine.trimStart().length;

  let parentLine = -1;
  for (let i = lineIndex - 1; i >= 0; i--) {
    const line = srcLines[i];
    if (line.trim() === '') continue;
    const indent = line.length - line.trimStart().length;
    if (indent < curIndent) {
      parentLine = i;
      break;
    }
  }
  if (parentLine < 0) return null;

  const parentTrimmed = srcLines[parentLine].trimStart();
  const compMatch = parentTrimmed.match(/^([A-Z]\w*)\b/);
  if (!compMatch) return null;
  const component = compMatch[1];
  if (/=\s*component\b/.test(parentTrimmed)) return null;
  if (!componentRegistry.has(component)) return null;

  // Collect all existing props from inline (parent line) + block lines
  const existingProps = [];
  const propValues = new Map();
  const parentRest = parentTrimmed.substring(component.length);
  for (const m of parentRest.matchAll(/(?:^|,)\s*(@?\w+)\s*:/g)) {
    existingProps.push(m[1].replace(/^@/, ''));
  }
  const baseIndent = srcLines[parentLine].length - parentTrimmed.length;
  for (let b = parentLine + 1; b < srcLines.length; b++) {
    const bLine = srcLines[b];
    if (bLine.trim() === '') continue;
    const bIndent = bLine.length - bLine.trimStart().length;
    if (bIndent <= baseIndent) break;
    for (const m of bLine.trimStart().matchAll(/(?:^|,)\s*(@?\w+)\s*:/g)) {
      const key = m[1].replace(/^@/, '');
      if (!existingProps.includes(key)) existingProps.push(key);
    }
  }

  // Parse the current line as a prop line
  const trimmed = curLine.trimStart();
  const cursorInTrimmed = col - curIndent;

  // Detect prop: value pattern on this line
  const propLineMatch = trimmed.match(/^(@?\w+)\s*:\s*/);
  if (propLineMatch) {
    const propName = propLineMatch[1].replace(/^@/, '');
    const afterColon = propLineMatch[0].length;
    if (cursorInTrimmed < propLineMatch[1].length) {
      return { component, existingProps, propValues, currentProp: propName, wantValues: false, wantProps: true };
    }
    if (cursorInTrimmed >= afterColon) {
      const valStr = trimmed.substring(afterColon);
      propValues.set(propName, valStr);
      return { component, existingProps, propValues, currentProp: propName, wantValues: true, wantProps: false };
    }
  }

  // Cursor on a blank/incomplete line — offer prop completions
  return { component, existingProps, propValues, currentProp: null, wantValues: false, wantProps: true };
}

function detectComponentContext(srcLine, col) {
  if (!srcLine) return null;

  const trimmed = srcLine.trimStart();
  const indent = srcLine.length - trimmed.length;

  const compMatch = trimmed.match(/^([A-Z]\w*)\b/);
  if (!compMatch) return null;
  const component = compMatch[1];

  if (/=\s*component\b/.test(trimmed)) return null;
  if (!componentRegistry.has(component)) return null;

  const rest = trimmed.substring(component.length);
  if (rest.length > 0 && rest[0] !== ' ' && rest[0] !== '\t') return null;

  const cursorInTrimmed = col - indent;

  if (cursorInTrimmed <= component.length) {
    return { component, existingProps: [], propValues: new Map(), currentProp: null, wantValues: false, wantProps: false };
  }

  const cursorInRest = cursorInTrimmed - component.length;
  const segments = splitProps(rest);

  const existingProps = [];
  const propValues = new Map();
  let currentProp = null;
  let wantValues = false;
  let wantProps = false;

  for (const seg of segments) {
    const inThisSeg = cursorInRest >= seg.start && cursorInRest <= seg.end;
    const beforeCursor = seg.end < cursorInRest;

    if (seg.colon >= 0) {
      const key = seg.text.substring(0, seg.colon).trim();
      const propName = key.replace(/^@/, '');

      if (beforeCursor) {
        existingProps.push(key.startsWith('@') ? key : propName);
        if (!key.startsWith('@')) propValues.set(propName, seg.text.substring(seg.colon + 1).trim());
      } else if (inThisSeg) {
        const posInSeg = cursorInRest - seg.start;
        if (posInSeg <= seg.colon) {
          wantProps = true;
          currentProp = propName;
        } else {
          wantValues = true;
          currentProp = propName;
          existingProps.push(key.startsWith('@') ? key : propName);
          if (!key.startsWith('@')) propValues.set(propName, seg.text.substring(seg.colon + 1).trim());
        }
      }
    } else {
      if (inThisSeg) wantProps = true;
    }
  }

  if (!wantValues && !wantProps) wantProps = true;

  return { component, existingProps, propValues, currentProp, wantValues, wantProps };
}

// Detect whether the cursor is inside a render block. Walks up from the
// current line to find an ancestor `render` keyword at lower indentation.
function isInRenderBlock(srcLines, lineIndex) {
  const line = srcLines[lineIndex];
  if (!line) return false;
  const curIndent = line.length - line.trimStart().length;
  for (let i = lineIndex - 1; i >= 0; i--) {
    const prev = srcLines[i];
    if (!prev || prev.trim() === '') continue;
    const prevIndent = prev.length - prev.trimStart().length;
    if (prevIndent < curIndent && /^\s*render\s*$/.test(prev)) return true;
    if (prevIndent === 0) break;
  }
  return false;
}

// ── Semantic tokens ────────────────────────────────────────────────
// Bridges TypeScript's semantic classification to Rip source positions.
// TS analyzes the compiled virtual .ts file; we map each classified token
// back to the .rip source and emit it if the identifier text matches.

connection.onRequest('textDocument/semanticTokens/full', (params) => {
  const fp = uriToPath(params.textDocument.uri);
  if (!fp.endsWith('.rip') || !service) return { data: [] };

  const c = compiled.get(fp);
  if (!c || !c.hasTypes) return { data: [] };

  try {
    patchTypes();
    const vf = toVirtual(fp);
    const format = ts.SemanticClassificationFormat?.TwentyTwenty || '2020';
    const result = service.getEncodedSemanticClassifications(vf, { start: 0, length: c.tsContent.length }, format);
    if (!result?.spans) return { data: [] };

    const srcLines = c.source.split('\n');
    const tokens = [];
    const usedPositions = new Set();

    // Collect reactive variable names (:= and ~= declarations) so we
    // can strip the readonly modifier from all their references — TS
    // sees `const` but these are semantically mutable.
    const reactiveNames = new Set();
    for (const sl of srcLines) {
      const m = sl.match(/^\s*(\w+)\b[^=~]*(?::=|~=|~>)/);
      if (m) reactiveNames.add(m[1]);
    }

    // Pre-compute which lines are inside render blocks so we only
    // suppress semantic tokens for tags/attributes in render context.
    const renderBlockLines = new Set();
    for (let ri = 0; ri < srcLines.length; ri++) {
      const rl = srcLines[ri];
      const rt = rl.trimStart();
      if (/^render\s*(?:#.*)?$/.test(rt)) {
        const rIndent = rl.length - rt.length;
        for (let rj = ri + 1; rj < srcLines.length; rj++) {
          const jl = srcLines[rj];
          const jt = jl.trimStart();
          if (jt === '') { renderBlockLines.add(rj); continue; }
          if (jl.length - jt.length > rIndent) { renderBlockLines.add(rj); }
          else break;
        }
      }
    }

    // Compute byte offset where DTS header ends in the virtual file.
    // Body spans have accurate source maps; header spans use heuristic
    // text search. Processing body first lets accurate mappings claim
    // positions before header text search can mis-map them.
    let headerEndOffset = 0;
    if (c.headerLines > 0) {
      let nl = 0;
      for (let j = 0; j < c.tsContent.length; j++) {
        if (c.tsContent[j] === '\n' && ++nl === c.headerLines) { headerEndOffset = j + 1; break; }
      }
    }

    // Two-pass: body spans first (accurate source maps), then header spans
    // (heuristic text search fills remaining positions).
    const bodySpans = [];
    const headerSpans = [];
    for (let i = 0; i < result.spans.length; i += 3) {
      const entry = [result.spans[i], result.spans[i + 1], result.spans[i + 2]];
      if (entry[0] >= headerEndOffset) bodySpans.push(entry);
      else headerSpans.push(entry);
    }
    const orderedSpans = bodySpans.concat(headerSpans);

    // Cache per-line function-signature detection for body tokens.
    // Overload signatures (ending with `;`) and injected type annotations
    // (from replaceFnParams) produce phantom property tokens that steal
    // source positions from the actual body tokens.
    const fnSigLineCache = new Map(); // tsLine → { isFnSig, isOverload, typeAnnotRanges }
    function getFnSigInfo(tsLine) {
      if (fnSigLineCache.has(tsLine)) return fnSigLineCache.get(tsLine);
      const lineText = tc.getLineText(c.tsContent, tsLine);
      const isFnSig = /^\s*(?:export\s+)?(?:async\s+)?function\s/.test(lineText);
      const isOverload = isFnSig && /;\s*$/.test(lineText);
      // Find column ranges of type annotation blocks in destructured params.
      // e.g. in `function foo({name: userName}: {name: string})`
      //       the `{name: string}` after `}: ` is a type annotation range.
      const typeAnnotRanges = [];
      if (isFnSig && !isOverload) {
        const re = /\}:\s*\{/g;
        let m;
        while ((m = re.exec(lineText)) !== null) {
          const start = m.index + m[0].length - 1; // position of `{`
          let depth = 1, end = start + 1;
          while (end < lineText.length && depth > 0) {
            if (lineText[end] === '{') depth++;
            else if (lineText[end] === '}') depth--;
            end++;
          }
          typeAnnotRanges.push([start, end]);
        }
      }
      const info = { isFnSig, isOverload, typeAnnotRanges };
      fnSigLineCache.set(tsLine, info);
      return info;
    }

    for (const [tsOffset, tsLength, classification] of orderedSpans) {
      const tsTokenType = ((classification >> 8) & 0xFF) - 1;
      const tsModifiers = classification & 0xFF;
      if (tsTokenType >= TS_TYPE_TO_LEGEND.length) continue;

      // Reclassify DTS header tokens: TS classifies function params in
      // declaration files as 'variable' instead of 'parameter'. Detect
      // by checking if the token is on a function signature line.
      let finalType = tsTokenType;
      if (tsTokenType === 7 && tsOffset < headerEndOffset) {
        const tsLine = tc.offsetToLine(c.tsContent, tsOffset);
        const lineText = tc.getLineText(c.tsContent, tsLine);
        if (/^\s*(?:export\s+)?(?:declare\s+)?(?:async\s+)?function\s/.test(lineText)) {
          finalType = 6; // parameter
        }
      }

      // Skip phantom tokens from injected overload signatures and type
      // annotations in the body section. compileForCheck injects overload
      // lines (function sig ending with `;`) and replaceFnParams injects
      // typed params (`{name: string}`) into implementation lines. TS
      // classifies property names in these type annotations as `property`,
      // which steal source positions from actual body tokens via text search.
      if (tsOffset >= headerEndOffset) {
        const tsLine = tc.offsetToLine(c.tsContent, tsOffset);
        const info = getFnSigInfo(tsLine);
        // Skip ALL tokens from overload signature lines (duplicates)
        if (info.isOverload) continue;
        // Skip `property` tokens inside type annotation ranges on
        // implementation signature lines. Binding-pattern properties
        // (e.g. `name` in `{name: userName}`) are kept; only the phantom
        // properties from injected type annotations (e.g. `{name: string}`)
        // are filtered out.
        if (info.isFnSig && tsTokenType === 9 && info.typeAnnotRanges.length) {
          const lineStart = c.tsContent.lastIndexOf('\n', tsOffset - 1) + 1;
          const col = tsOffset - lineStart;
          if (info.typeAnnotRanges.some(([s, e]) => col >= s && col < e)) continue;
        }
      }

      // Map generated TS offset to Rip source position
      const srcPos = tc.mapToSourcePos(c, tsOffset);
      if (!srcPos) continue;

      // Verify the identifier text matches at the mapped position
      const tsText = c.tsContent.substring(tsOffset, tsOffset + tsLength);
      let matchLine = srcPos.line;
      let matchCol = srcPos.col;
      const srcLine = srcLines[matchLine];
      if (!srcLine) continue;

      if (srcLine.substring(matchCol, matchCol + tsLength) !== tsText) {
        // Multiline expressions compile to one gen line — search nearby source lines
        if (!findUnusedOccurrence(srcLines, tsText, tsLength, srcPos.line, usedPositions, (l, c) => { matchLine = l; matchCol = c; })) continue;
      }

      // Collision: multiple TS tokens mapped to the same source position
      // (common in multi-line object literals compiled to one JS line).
      // Find the next unused occurrence of this word nearby.
      const posKey = matchLine + ':' + matchCol;
      if (usedPositions.has(posKey)) {
        if (!findUnusedOccurrence(srcLines, tsText, tsLength, matchLine, usedPositions, (l, c) => { matchLine = l; matchCol = c; })) continue;
      }

      // Skip tokens that land inside string literals or comments
      if (isInsideStringOrComment(srcLines[matchLine], matchCol)) continue;

      // Skip tokens inside render blocks where TextMate provides
      // entity.name.tag.rip or entity.other.attribute-name.rip scopes.
      if (renderBlockLines.has(matchLine)) {
        const sl = srcLines[matchLine];
        const slIndent = sl.length - sl.trimStart().length;
        const firstWord = sl.substring(slIndent).match(/^([a-zA-Z]\w*)\b/);
        const isTagLine = firstWord && HTML_TAG_NAMES.has(firstWord[1]);
        const isComponentLine = firstWord && /^[A-Z]/.test(firstWord[1]);

        // Skip HTML tag name at first-word position
        if (isTagLine && matchCol === slIndent) {
          const after = sl.charAt(matchCol + tsLength);
          if (!after || after === ' ' || after === '\t') continue;
        }

        // Skip attribute names: identifier followed by `:`
        // (not `::` or `:=`) or `<=>` (two-way binding).
        const afterToken = sl.substring(matchCol + tsLength);
        const colonMatch = afterToken.match(/^\s*:/);
        if (colonMatch && afterToken.charAt(colonMatch[0].length) !== ':' && afterToken.charAt(colonMatch[0].length) !== '=') {
          if (matchCol === slIndent || isTagLine || isComponentLine) continue;
        }
        if (/^\s*<=>/.test(afterToken)) {
          if (matchCol === slIndent || isTagLine || isComponentLine) continue;
        }
      }

      usedPositions.add(matchLine + ':' + matchCol);
      let mods = tsModifiers & 0x1F; // keep bits 0-4, mask off 'local' (bit 5)
      // Reactive state (:=) and computed (~=) compile to `const`, so TS
      // flags every reference as readonly. Strip that bit for reactive
      // variables so the editor doesn't color them as constants.
      if ((mods & 0x08) && finalType === 7 && reactiveNames.has(tsText)) mods &= ~0x08;
      tokens.push({
        line: matchLine,
        char: matchCol,
        length: tsLength,
        type: TS_TYPE_TO_LEGEND[finalType],
        modifiers: mods,
      });
    }

    // Sort by position and deduplicate
    tokens.sort((a, b) => a.line - b.line || a.char - b.char);

    // Delta-encode for LSP
    const data = [];
    let prevLine = 0, prevChar = 0;
    for (let j = 0; j < tokens.length; j++) {
      const t = tokens[j];
      // Skip duplicate positions (can happen with overlapping mappings)
      if (j > 0 && t.line === tokens[j - 1].line && t.char === tokens[j - 1].char) continue;
      const deltaLine = t.line - prevLine;
      const deltaChar = deltaLine === 0 ? t.char - prevChar : t.char;
      data.push(deltaLine, deltaChar, t.length, t.type, t.modifiers);
      prevLine = t.line;
      prevChar = t.char;
    }

    connection.console.log(`[rip] semantic tokens ${path.basename(fp)}: ${data.length / 5} tokens`);
    return { data };
  } catch (e) {
    connection.console.log(`[rip] semantic tokens error: ${e.message}`);
    return { data: [] };
  }
});

// ── LSP handlers ───────────────────────────────────────────────────

connection.onCompletion((params) => {
  const fp = uriToPath(params.textDocument.uri);
  if (!fp.endsWith('.rip')) return [];

  // Component prop completions
  const doc = documents.get(params.textDocument.uri);
  if (doc) {
    const srcLines = doc.getText().split('\n');
    const srcLine = srcLines[params.position.line];
    const ctx = detectBlockComponentContext(srcLines, params.position.line, params.position.character);
    if (ctx) {
      const info = componentRegistry.get(ctx.component);
      if (info) {
        if (ctx.wantProps) {
          return info.props
            .filter(p => !ctx.existingProps.includes(p.name))
            .map(p => ({
              label: p.name + ':',
              kind: 5,
              detail: p.type,
              insertText: p.name + ': ',
              sortText: p.required ? '0' + p.name : '1' + p.name,
            }));
        }
        if (ctx.wantValues && ctx.currentProp) {
          const prop = info.props.find(p => p.name === ctx.currentProp);
          if (prop) {
            const values = extractUnionValues(prop.type);
            if (values.length > 0) {
              const ch = srcLine[params.position.character] || '';
              const prevCh = params.position.character > 0 ? srcLine[params.position.character - 1] : '';
              const inQuotes = (prevCh === '"' || prevCh === "'") || (ch === '"' || ch === "'");
              return values.map((v, i) => {
                const bare = v.replace(/^["']|["']$/g, '');
                return {
                  label: bare,
                  kind: 12,
                  insertText: inQuotes ? bare : v.startsWith('"') ? v : `"${v}"`,
                  sortText: String(i).padStart(3, '0'),
                };
              });
            }
          }
        }
      }
    }
    // Prop default value completions — @prop:: "a" | "b" := |
    const defMatch = srcLine.match(/^\s*@(\w+)\s*::\s*(.+?)\s*:=\s*/);
    if (defMatch && params.position.character >= srcLine.indexOf(':=') + 2) {
      const values = extractUnionValues(defMatch[2].trim());
      if (values.length > 0) {
        // Check if cursor is already inside quotes
        const afterEq = srcLine.slice(srcLine.indexOf(':=') + 2).trimStart();
        const inQuotes = /^["']/.test(afterEq);
        return values.map((v, i) => {
          const bare = v.replace(/^["']|["']$/g, '');
          return {
            label: bare,
            kind: 12,
            insertText: inQuotes ? bare : v.startsWith('"') ? v : `"${v}"`,
            sortText: String(i).padStart(3, '0'),
          };
        });
      }
    }

    // Typed variable completions — name:: Type = "|"
    const varMatch = srcLine.match(/^\s*(\w+)\s*::\s*(.+?)\s*=\s*/);
    if (varMatch && params.position.character >= srcLine.indexOf('=') + 1) {
      let typeStr = varMatch[2].trim();
      // Resolve named type aliases
      if (/^\w+$/.test(typeStr)) {
        const resolved = resolveTypeFromDTS(typeStr);
        if (resolved) typeStr = resolved;
      }
      const values = extractUnionValues(typeStr);
      if (values.length > 0) {
        const afterEq = srcLine.slice(srcLine.indexOf('=') + 1).trimStart();
        const inQuotes = /^["']/.test(afterEq);
        return values.map((v, i) => {
          const bare = v.replace(/^["']|["']$/g, '');
          return {
            label: bare,
            kind: 12,
            insertText: inQuotes ? bare : v.startsWith('"') ? v : `"${v}"`,
            sortText: String(i).padStart(3, '0'),
          };
        });
      }
    }

    // Space/colon triggered outside component/render context — don't fall through to TS
    if (params.context?.triggerCharacter === ' ' || params.context?.triggerCharacter === ':') {
      if (!isInRenderBlock(srcLines, params.position.line)) return [];
    }
  }

  // TypeScript completions
  if (!service) return [];
  const offset = srcToOffset(fp, params.position.line, params.position.character);
  if (offset === undefined) return [];

  try {
    patchTypes();
    const r = service.getCompletionsAtPosition(toVirtual(fp), offset, { includeExternalModuleExports: true, includeInsertTextCompletions: true });
    if (!r) return [];
    const vf = toVirtual(fp);
    return {
      isIncomplete: false,
      items: r.entries.map((e) => {
        const item = {
          label: e.name,
          kind: tsToLspKind(e.kind),
          sortText: e.sortText,
        };
        try {
          const d = service.getCompletionEntryDetails(vf, offset, e.name, undefined, undefined, undefined, undefined);
          if (d) {
            const display = unwrapReactiveType(ts.displayPartsToString(d.displayParts));
            item.detail = display.replace(/\((\w+)\)\s*\S+\./, '($1) ');
            if (display.includes('?:')) item.label = e.name + '?';
            if (d.documentation?.length) {
              item.documentation = ts.displayPartsToString(d.documentation);
            }
          }
        } catch {}
        return item;
      }),
    };
  } catch (e) { connection.console.log(`[rip] completion error: ${e.message}`); return []; }
});

connection.onHover((params) => {
  const fp = uriToPath(params.textDocument.uri);
  if (!fp.endsWith('.rip')) return null;

  // Skip hover inside string literals and comments (e.g. Tailwind classes)
  const doc = documents.get(params.textDocument.uri);
  const srcLines = doc ? doc.getText().split('\n') : null;
  if (srcLines) {
    const srcLine = srcLines[params.position.line];
    if (srcLine && isInsideStringOrComment(srcLine, params.position.character)) return null;
  }

  // Component prop hover
  if (srcLines) {
    const ctx = detectBlockComponentContext(srcLines, params.position.line, params.position.character);
    if (ctx?.component) {
      const compInfo = componentRegistry.get(ctx.component);
      if (compInfo) {
        if (ctx.currentProp) {
          const prop = compInfo.props.find(p => p.name === ctx.currentProp);
          if (prop) {
            return { contents: { kind: 'markdown', value: `\`\`\`typescript\n(property) ${prop.name}${prop.required ? '' : '?'}: ${prop.type}\n\`\`\`` } };
          }
        }
        const word = getWordAtPosition(doc.getText(), params.position);
        if (word === ctx.component) {
          const propsStr = compInfo.props.filter(p => !p.name.startsWith('__bind_')).map(p => `  ${p.name}${p.required ? '' : '?'}: ${p.type}`).join('\n');
          return { contents: { kind: 'markdown', value: `\`\`\`typescript\nclass ${ctx.component}\nProps: {\n${propsStr}\n}\n\`\`\`` } };
        }
      }
    }
  }

  // TypeScript hover
  if (!service) return null;
  const offset = srcToOffset(fp, params.position.line, params.position.character);
  if (offset === undefined) return null;

  try {
    patchTypes();
    const info = service.getQuickInfoAtPosition(toVirtual(fp), offset);
    if (!info) return null;
    let display = ts.displayPartsToString(info.displayParts);
    const docs = ts.displayPartsToString(info.documentation || []);
    display = unwrapReactiveType(display);
    display = display.replace(/\b__bind_(\w+)__\b/g, '$1');
    let value = '```typescript\n' + display + '\n```';
    if (docs) value += '\n\n' + docs;
    return { contents: { kind: 'markdown', value } };
  } catch { return null; }
});

connection.onDefinition((params) => {
  const fp = uriToPath(params.textDocument.uri);
  if (!fp.endsWith('.rip')) return null;

  // Component go-to-definition
  const doc = documents.get(params.textDocument.uri);
  if (doc) {
    const word = getWordAtPosition(doc.getText(), params.position);
    if (word && componentRegistry.has(word)) {
      const compInfo = componentRegistry.get(word);
      return [{
        uri: pathToUri(compInfo.source),
        range: { start: { line: compInfo.line, character: 0 }, end: { line: compInfo.line, character: 0 } },
      }];
    }
  }

  // TypeScript go-to-definition
  if (!service) return null;
  const offset = srcToOffset(fp, params.position.line, params.position.character);
  if (offset === undefined) return null;

  try {
    patchTypes();
    const defs = service.getDefinitionAtPosition(toVirtual(fp), offset);
    if (!defs) return null;
    return defs.map((d) => {
      const realPath = isVirtual(d.fileName) ? fromVirtual(d.fileName) : d.fileName;
      const c = compiled.get(realPath);
      if (c) {
        const { line: genLine } = offsetToLineCol(c.tsContent, d.textSpan.start);
        if (!c.genToSrc.has(genLine)) {
          const name = c.tsContent.substring(d.textSpan.start, d.textSpan.start + d.textSpan.length);
          const pat = new RegExp(`^[^#\\n]*\\b(def\\s+|type\\s+)?${name}\\s*(=|\\()`, 'm');
          const m = pat.exec(c.source);
          if (m) {
            const pos = offsetToLineCol(c.source, m.index + m[0].indexOf(name));
            return { uri: pathToUri(realPath), range: { start: pos, end: pos } };
          }
        }
        const pos = genToSrcPos(realPath, d.textSpan.start);
        return { uri: pathToUri(realPath), range: { start: pos, end: pos } };
      }
      const pos = offsetToLineCol(fs.readFileSync(d.fileName, 'utf8'), d.textSpan.start);
      return { uri: pathToUri(realPath), range: { start: pos, end: pos } };
    });
  } catch { return null; }
});

connection.onSignatureHelp((params) => {
  const fp = uriToPath(params.textDocument.uri);
  if (!fp.endsWith('.rip')) return null;

  // Component signature help
  const doc = documents.get(params.textDocument.uri);
  if (doc) {
    const srcLines = doc.getText().split('\n');
    const srcLine = srcLines[params.position.line];
    const ctx = detectBlockComponentContext(srcLines, params.position.line, params.position.character);
    if (ctx?.component) {
      const compInfo = componentRegistry.get(ctx.component);
      if (compInfo && compInfo.props.length > 0) {
        const label = `${ctx.component}(${compInfo.props.map(p => `${p.name}${p.required ? '' : '?'}: ${p.type}`).join(', ')})`;
        return {
          signatures: [{
            label,
            parameters: compInfo.props.map(p => ({
              label: `${p.name}${p.required ? '' : '?'}: ${p.type}`,
            })),
          }],
          activeSignature: 0,
          activeParameter: ctx.existingProps.length,
        };
      }
    }
  }

  // TypeScript signature help
  if (!service) return null;
  const offset = srcToOffset(fp, params.position.line, params.position.character);
  if (offset === undefined) return null;

  try {
    patchTypes();
    const sig = service.getSignatureHelpItems(toVirtual(fp), offset, {});
    if (!sig) return null;
    return {
      signatures: sig.items.map((item) => ({
        label: ts.displayPartsToString(item.prefixDisplayParts) +
          item.parameters.map(p => ts.displayPartsToString(p.displayParts)).join(', ') +
          ts.displayPartsToString(item.suffixDisplayParts),
        parameters: item.parameters.map(p => ({ label: ts.displayPartsToString(p.displayParts) })),
      })),
      activeSignature: sig.selectedItemIndex,
      activeParameter: sig.argumentIndex,
    };
  } catch { return null; }
});

const KIND = {
  keyword: 14, method: 2, function: 3, 'local function': 3, constructor: 4,
  property: 5, getter: 5, setter: 5, 'JSX attribute': 5,
  'var': 6, variable: 6, 'local var': 6, let: 6, parameter: 6,
  'const': 21, 'enum member': 20,
  class: 7, 'local class': 7,
  interface: 8, alias: 8, type: 25, 'type parameter': 25, 'primitive type': 14,
  module: 9, 'external module name': 9,
  enum: 13, string: 6, directory: 19, script: 9, warning: 1,
};
function tsToLspKind(k) { return KIND[k] || 6; }

// ── Loaders ────────────────────────────────────────────────────────

async function loadCompiler(root) {
  for (const p of [path.join(root, 'src', 'compiler.js'), path.join(root, 'node_modules', 'rip-lang', 'src', 'compiler.js')]) {
    if (fs.existsSync(p)) {
      try { return await import(p); } catch (e) { connection.console.log(`[rip] compiler failed: ${e.message}`); }
    }
  }
  return null;
}

async function loadTypecheck(root) {
  for (const p of [path.join(root, 'src', 'typecheck.js'), path.join(root, 'node_modules', 'rip-lang', 'src', 'typecheck.js')]) {
    if (fs.existsSync(p)) {
      try { return await import(p); } catch (e) { connection.console.log(`[rip] typecheck failed: ${e.message}`); }
    }
  }
  return null;
}

function loadTypeScript(params) {
  const dirs = [rootPath];
  if (params.initializationOptions?.typescript?.tsdk) dirs.unshift(params.initializationOptions.typescript.tsdk);
  dirs.push(__dirname);
  for (const d of dirs) { try { return require(require.resolve('typescript', { paths: [d] })); } catch {} }
  try { return require('typescript'); } catch {}
  return null;
}

documents.listen(connection);
connection.listen();
