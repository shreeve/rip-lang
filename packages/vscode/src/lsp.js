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

        const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
        diagnostics.push({
          range: { start: startPos, end: endPos },
          severity: d.category === 1 ? 1 : d.category === 0 ? 2 : d.category === 2 ? 4 : 3,
          code: d.code,
          source: 'rip',
          message,
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
      const ctx = detectComponentContext(srcLines[i], srcLines[i].length);
      if (!ctx?.component) continue;
      const info = componentRegistry.get(ctx.component);
      if (!info) continue;

      for (const prop of ctx.existingProps) {
        if (prop.startsWith('@')) continue;
        if (prop === 'class' || prop === 'style') continue;
        if (!info.props.some(p => p.name === prop)) {
          const col = srcLines[i].indexOf(prop);
          if (col >= 0) {
            diagnostics.push({
              range: { start: { line: i, character: col }, end: { line: i, character: col + prop.length } },
              severity: 1,
              source: 'rip',
              message: `Unknown prop '${prop}' on component ${ctx.component}`,
            });
          }
        }
      }

      // Required prop checking
      for (const prop of info.props) {
        if (!prop.required) continue;
        if (ctx.existingProps.includes(prop.name)) continue;
        const col = srcLines[i].indexOf(ctx.component);
        if (col >= 0) {
          diagnostics.push({
            range: { start: { line: i, character: col }, end: { line: i, character: col + ctx.component.length } },
            severity: 1,
            source: 'rip',
            message: `Missing required prop '${prop.name}' on component ${ctx.component}`,
          });
        }
      }
    }

    // Untyped prop errors (at component definitions, not usage sites)
    for (const [name, compDef] of componentRegistry) {
      if (compDef.source !== filePath) continue;
      for (const prop of compDef.props) {
        for (let s = compDef.line; s < srcLines.length; s++) {
          const match = srcLines[s].match(new RegExp('(@' + prop.name + ')\\s*(::|([:!]?=))'));
          if (match) {
            if (match[2] !== '::') {
              const col = srcLines[s].indexOf(match[1]);
              diagnostics.push({
                range: { start: { line: s, character: col }, end: { line: s, character: col + match[1].length } },
                severity: 1,
                source: 'rip',
                message: `Prop '${prop.name}' has no type annotation`,
              });
            } else {
              // Typed prop — validate default value against declared type
              const dm = srcLines[s].match(new RegExp('@' + prop.name + '\\s*::\\s*(.+?)\\s*:=\\s*(.+)'));
              if (dm) {
                const defVal = dm[2].replace(/#.*$/, '').trim();
                const err = tc.validatePropDefault(dm[1].trim(), defVal);
                if (err) {
                  const col = srcLines[s].indexOf(match[1]);
                  diagnostics.push({
                    range: { start: { line: s, character: col }, end: { line: s, character: col + match[1].length } },
                    severity: 1,
                    source: 'rip',
                    message: err,
                  });
                }
              }
            }
            break;
          }
        }
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
  return display;
}

// ── Component IntelliSense infrastructure ──────────────────────────

function parseDTS(dtsString) {
  const result = new Map();
  if (!dtsString) return result;

  const lines = dtsString.split('\n');
  let i = 0;

  while (i < lines.length) {
    const classMatch = lines[i].match(/^export declare class (\w+)/);
    if (!classMatch) { i++; continue; }

    const name = classMatch[1];
    const props = [];
    let j = i + 1;
    let foundProps = false;

    while (j < lines.length) {
      if (/^\}/.test(lines[j])) break;

      if (/constructor\(props\??/.test(lines[j])) {
        foundProps = true;
        j++;
        while (j < lines.length) {
          if (/^\s*\}\);/.test(lines[j])) { j++; break; }
          const propMatch = lines[j].match(/^\s+(\w+)(\?)?\s*:\s*(.+);$/);
          if (propMatch) {
            props.push({ name: propMatch[1], type: propMatch[3].trim(), required: !propMatch[2] });
          }
          j++;
        }
        continue;
      }
      j++;
    }

    if (foundProps) {
      result.set(name, { props, source: null, line: 0 });
    }

    i = Math.max(i + 1, j);
  }

  return result;
}

function updateComponentRegistry(filePath, source, dts) {
  for (const [name, info] of componentRegistry) {
    if (info.source === filePath) componentRegistry.delete(name);
  }

  const parsed = parseDTS(dts);
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

// ── LSP handlers ───────────────────────────────────────────────────

connection.onCompletion((params) => {
  const fp = uriToPath(params.textDocument.uri);
  if (!fp.endsWith('.rip')) return [];

  // Component prop completions
  const doc = documents.get(params.textDocument.uri);
  if (doc) {
    const srcLine = doc.getText().split('\n')[params.position.line];
    const ctx = detectComponentContext(srcLine, params.position.character);
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

    // Space/colon triggered outside component context — don't fall through to TS
    if (params.context?.triggerCharacter === ' ' || params.context?.triggerCharacter === ':') return [];
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

  // Component prop hover
  const doc = documents.get(params.textDocument.uri);
  if (doc) {
    const srcLine = doc.getText().split('\n')[params.position.line];
    const ctx = detectComponentContext(srcLine, params.position.character);
    if (ctx?.component) {
      const compInfo = componentRegistry.get(ctx.component);
      if (compInfo) {
        if (ctx.currentProp) {
          const prop = compInfo.props.find(p => p.name === ctx.currentProp);
          if (prop) {
            return { contents: { kind: 'markdown', value: `\`\`\`typescript\n(prop) ${prop.name}${prop.required ? '' : '?'}: ${prop.type}\n\`\`\`` } };
          }
        }
        const word = getWordAtPosition(doc.getText(), params.position);
        if (word === ctx.component) {
          const propsStr = compInfo.props.map(p => `  ${p.name}${p.required ? '' : '?'}: ${p.type}`).join('\n');
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
    const srcLine = doc.getText().split('\n')[params.position.line];
    const ctx = detectComponentContext(srcLine, params.position.character);
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
