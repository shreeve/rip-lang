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

// Debug logging — toggle via the "rip.debug" setting in VS Code,
// or launch with RIP_DEBUG=1 to enable from startup.
// Output goes to the VS Code "Rip Language Server" output channel.
let ripDebug = process.env.RIP_DEBUG === '1';
function debugLog(...args) { if (ripDebug) connection.console.log('[rip:debug] ' + args.join(' ')); }

// Real .rip path → { version, source, tsContent, srcToGen, genToSrc, ... }
const compiled = new Map();

// Component name → { props: [{ name, type, required }], source, line }
const componentRegistry = new Map();

// Per-directory project config cache (dir → { strict, exclude, ... })
const configCache = new Map();
function getProjectConfig(filePath) {
  const dir = path.dirname(filePath);
  if (configCache.has(dir)) return configCache.get(dir);
  const config = tc?.readProjectConfig?.(dir) || {};
  configCache.set(dir, config);
  return config;
}

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
  if (ripDebug) connection.console.log(`[rip] debug logging enabled (RIP_DEBUG=${process.env.RIP_DEBUG})`);

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
      completionProvider: { triggerCharacters: ['.', '"', "'", '/', ':', ' ', '@'] },
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

connection.onInitialized(async () => {
  connection.client.register(require('vscode-languageserver').DidChangeWatchedFilesNotification.type, {
    watchers: [
      { globPattern: '**/rip.json' },
      { globPattern: '**/package.json' },
    ],
  });
  try {
    const settings = await connection.workspace.getConfiguration('rip');
    if (settings?.debug === true) {
      ripDebug = true;
      connection.console.log('[rip] debug logging enabled (rip.debug setting)');
    }
  } catch {}
  connection.console.log('[rip] ready');
});

connection.onDidChangeWatchedFiles(() => {
  configCache.clear();
  for (const fp of compiled.keys()) publishDiagnostics(fp);
});

connection.onDidChangeConfiguration(async () => {
  try {
    const settings = await connection.workspace.getConfiguration('rip');
    if (settings) {
      const prev = ripDebug;
      ripDebug = settings.debug === true || process.env.RIP_DEBUG === '1';
      if (ripDebug !== prev) connection.console.log(`[rip] debug logging ${ripDebug ? 'enabled' : 'disabled'}`);
    }
  } catch {}
  for (const fp of compiled.keys()) publishDiagnostics(fp);
});

connection.onNotification('rip/toggleDebug', () => {
  ripDebug = !ripDebug;
  connection.console.log(`[rip] debug logging ${ripDebug ? 'enabled' : 'disabled'}`);
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

function isStrictFile(filePath) {
  const config = getProjectConfig(filePath);
  if (!config.strict) return false;
  if (config._configDir && Array.isArray(config.exclude)) {
    const rel = path.relative(config._configDir, filePath);
    if (config.exclude.some(glob => tc.globToRegex(glob).test(rel))) return false;
  }
  return true;
}

function compileRip(filePath, source) {
  try {
    const strict = isStrictFile(filePath);
    const entry = tc.compileForCheck(filePath, source, compiler, { strict });
    const prev = compiled.get(filePath);

    compiled.set(filePath, {
      version: (prev?.version || 0) + 1,
      ...entry,
    });

    if (entry.dts) {
      updateComponentRegistry(filePath, source, entry.dts);
      // Eagerly populate intrinsic props cache so value completions work
      // even after later compilation failures (e.g. `type:` with no value).
      try {
        for (const [name, info] of componentRegistry) {
          if (info.source === filePath && info.inheritsTag) {
            const ownPropNames = new Set(info.props.map(p => p.name));
            resolveIntrinsicProps(name, ownPropNames);
          }
        }
      } catch (e) {
        connection.console.log(`[rip] intrinsic props error ${path.basename(filePath)}: ${e.message}`);
      }
    }

    connection.console.log(`[rip] compiled ${path.basename(filePath)}: hasTypes=${entry.hasTypes}, headerLines=${entry.headerLines}`);
    publishDiagnostics(filePath);
  } catch (e) {
    // Keep the previous compiled version for completions/hover during
    // transient parse errors.  Dot-recovery (trailing `.` triggers) is
    // handled in the completion handler where the cursor line is known.

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
      const suggestionDiags = service.getSuggestionDiagnostics(vf);
      const allDiags = [...syntacticDiags, ...semanticDiags, ...suggestionDiags];

      for (const d of allDiags) {
        if (d.start === undefined) continue;
        if (tc.SKIP_CODES.has(d.code)) continue;

        // Conditional suppression — narrowed instead of blanket
        if (tc.CONDITIONAL_CODES?.has(d.code)) {
          const flatMsg = d.code === 2307 ? ts.flattenDiagnosticMessageText(d.messageText, '\n') : null;
          if (tc.shouldSuppressConditional(d.code, d.start, d.length, c.tsContent, c.headerLines, c.dts, flatMsg, filePath)) continue;
        }

        // Skip 6133 on compiler-generated _render() construction variables (_0, _1, …)
        if ((d.code === 6133 || d.code === 6196) && tc.isRenderConstructionVar(c.tsContent, d.start, d.length)) continue;

        // Skip diagnostics on injected overload signatures — the real function
        // definition already carries the same diagnostic.
        if (tc.isInjectedOverload?.(c, d.start)) continue;

        // Expand 6199 (all declarations unused) on hoisted multi-var `let` into
        // individual per-variable diagnostics so each one dims independently.
        if (d.code === 6199 && d.length > 0) {
          const span = c.tsContent.substring(d.start, d.start + d.length);
          if (/^\s*let\s+[$\w]+\s*,/.test(span)) {
            const varRe = /[$\w]+/g;
            let vm;
            while ((vm = varRe.exec(span)) !== null) {
              if (vm[0] === 'let') continue;
              const pos = tc.mapToSourcePos(c, d.start + vm.index);
              if (!pos) continue;
              diagnostics.push({
                range: {
                  start: { line: pos.line, character: pos.col },
                  end: { line: pos.line, character: pos.col + vm[0].length },
                },
                severity: d.category === 1 ? 1 : d.category === 0 ? 2 : d.category === 2 ? 4 : 3,
                code: 6133,
                source: 'rip',
                message: `'${vm[0]}' is declared but its value is never read.`,
                tags: [1],
              });
            }
            continue;
          }
        }

        const startRaw = tc.mapToSourcePos(c, d.start);
        if (!startRaw) {
          debugLog(`diagnostic dropped: TS${d.code} at offset ${d.start} — mapToSourcePos returned null (${path.basename(filePath)}, genLine ${tc.offsetToLine(c.tsContent, d.start)})`);
          continue;
        }

        // Drop diagnostics that map beyond the source file (e.g. from component
        // stubs where the compiled line has no real source counterpart).
        if (c.source) {
          const sourceLineCount = c.source.split('\n').length;
          if (startRaw.line >= sourceLineCount) {
            debugLog(`diagnostic dropped: TS${d.code} mapped to srcLine ${startRaw.line + 1} but file has ${sourceLineCount} lines (${path.basename(filePath)})`);
            continue;
          }
        }

        const startPos = { line: startRaw.line, character: startRaw.col };

        // Compute end position: try mapping the end offset, and fall back to
        // using the error length from the start position when the end can't be
        // resolved (e.g. errors in the DTS header where only the word maps).
        const endRaw = tc.mapToSourcePos(c, d.start + (d.length || 1));
        let endPos;
        if (endRaw && endRaw.line === startRaw.line && endRaw.col > startRaw.col) {
          endPos = { line: endRaw.line, character: endRaw.col };
        } else {
          endPos = { line: startPos.line, character: startPos.character + (d.length || 1) };
        }

        // For unused-import diagnostics (6133/6196), TS spans the entire import
        // statement but the message names the specific binding.  Extract it and
        // target just that identifier on the source line.
        if ((d.code === 6133 || d.code === 6196) && c.source) {
          const srcLineText = tc.getLineText(c.source, startPos.line);
          if (/^\s*import\s/.test(srcLineText)) {
            const msg = typeof d.messageText === 'string' ? d.messageText : d.messageText?.messageText;
            const nameMatch = msg && msg.match(/^'(\w+)'/);
            if (nameMatch) {
              const re = new RegExp('\\b' + nameMatch[1] + '\\b');
              const m = re.exec(srcLineText);
              if (m) {
                startPos.character = m.index;
                endPos = { line: startPos.line, character: m.index + nameMatch[1].length };
              }
            }
          }
        }

        // Snap end to the word at startPos — the TS diagnostic length may not
        // match the source identifier (e.g. generated _2 → Button).
        if (c.source) {
          const srcLineText = tc.getLineText(c.source, startPos.line);
          const wordMatch = srcLineText.slice(startPos.character).match(/^\w+/);
          if (wordMatch) {
            const wordEnd = startPos.character + wordMatch[0].length;
            if (endPos.line === startPos.line) {
              endPos.character = wordEnd;
            }
          }
        }

        // Remap IIFE-switch diagnostics to the enclosing function declaration
        const adj = tc.adjustSwitchDiagnostic?.(c.source, { line: startPos.line, col: startPos.character }, d.code);
        if (adj) {
          startPos.line = adj.line; startPos.character = adj.col;
          endPos.line = adj.line; endPos.character = adj.col + adj.len;
        }

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

      if (!info.hasIntrinsicProps) {
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

  // Unresolved relative import check (all files, not just typed)
  if (c.source) {
    const srcLines = c.source.split('\n');
    for (let i = 0; i < srcLines.length; i++) {
      if (/^\s*#/.test(srcLines[i])) continue;
      const m = srcLines[i].match(/^(?:import|export)\b.*from\s+['"](\.\.?\/[^'"]+)['"]/);
      if (!m) continue;
      const imported = path.resolve(path.dirname(filePath), m[1]);
      if (!fs.existsSync(imported)) {
        const col = srcLines[i].indexOf(m[1]);
        diagnostics.push({
          range: { start: { line: i, character: col }, end: { line: i, character: col + m[1].length } },
          severity: 1,
          source: 'rip',
          message: `Cannot find module '${m[1]}'`,
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
      try { return ts.ScriptSnapshot.fromString(fs.readFileSync(f, 'utf8')); } catch { debugLog(`getScriptSnapshot: could not read ${f}`); return undefined; }
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
  // Don't clear intrinsicPropsCache — DOM element types are stable across
  // program changes and must survive compilation failures so that value
  // completions still work when the user is mid-edit (e.g. `type:` with
  // no value yet causes a parse error, deleting compiled data).
  tc.patchUninitializedTypes(ts, service, compiled);
}

// ── Position mapping ───────────────────────────────────────────────

function srcToOffset(filePath, line, col) {
  const c = compiled.get(filePath);
  if (!c) { debugLog(`srcToOffset: no compiled entry for ${path.basename(filePath)}`); return undefined; }
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
    if (best < 0) { debugLog(`srcToOffset: no srcToGen entry for ${path.basename(filePath)}:${line + 1}`); return undefined; }
    debugLog(`srcToOffset: ${path.basename(filePath)}:${line + 1} — no exact srcToGen, falling back to nearest line ${best + 1}`);
    genLine = c.srcToGen.get(best);
  }
  const srcLines = c.source.split('\n');
  const genLines = c.tsContent.split('\n');
  const KEYWORDS = new Set(['interface', 'type', 'enum', 'class', 'export', 'declare', 'extends', 'implements', 'import', 'from', 'def', 'const', 'let', 'var']);
  if (srcLines[line] != null && genLines[genLine] != null) {
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
      debugLog(`srcToOffset: '${word}' not on mapped genLine ${genLine} — searching ±5 nearby lines`);
      for (let delta = 1; delta <= 5; delta++) {
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
  debugLog(`srcToOffset: ${path.basename(filePath)}:${line + 1}:${col + 1} — word not found in ±5 range, falling back to raw genLine ${genLine}`);
  const genText = c.tsContent.split('\n')[genLine] || '';
  if (col < genText.length) return lineColToOffset(c.tsContent, genLine, col);
  return lineColToOffset(c.tsContent, genLine, 0);
}

function genToSrcPos(filePath, offset) {
  const c = compiled.get(filePath);
  if (!c) return null;
  const pos = tc.mapToSourcePos(c, offset);
  if (!pos) return null;
  return { line: pos.line, character: pos.col };
}

function lineColToOffset(t, line, col) { return tc.lineColToOffset(t, line, col); }
function offsetToLineCol(t, o) { const p = tc.offsetToLineCol(t, o); return { line: p.line, character: p.col }; }
function uriToPath(u) { try { return decodeURIComponent(new URL(u).pathname); } catch { return u; } }
function pathToUri(p) { return 'file://' + p.replace(/#/g, '%23').replace(/%(?![0-9A-Fa-f]{2})/g, '%25').replace(/ /g, '%20'); }

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

// DOM event names resolved from HTMLElementEventMap via the TS checker.
// Lazy-initialized on first use; falls back to empty (no @event completions
// until TS service is ready, then populates on next request).
let domEventNamesCache = null;

function getDomEventNames() {
  if (domEventNamesCache) return domEventNamesCache;
  if (!service || !ts) return [];
  patchTypes();
  const program = service.getProgram();
  if (!program) return [];
  const checker = program.getTypeChecker();
  // HTMLElementEventMap is declared in lib.dom.d.ts
  const symbol = checker.resolveName('HTMLElementEventMap', undefined, ts.SymbolFlags.Type, false);
  if (!symbol) return [];
  const type = checker.getDeclaredTypeOfSymbol(symbol);
  if (!type) return [];
  const names = type.getProperties().map(p => p.name).sort();
  if (names.length > 0) domEventNamesCache = names;
  return names;
}

// Cache resolved intrinsic element props by tag name (e.g. 'button' → [{name, type}...])
const intrinsicPropsCache = new Map();

// Resolve HTML/SVG element attributes for a tag by finding a __ripEl('tag') call in the
// compiled TS sources and reading the resolved __RipProps<'tag'> type from the call signature.
// Returns [{name, type, required}] for all non-internal, non-readonly, non-constant props.
function resolveTagProps(tag, skipNames) {
  if (intrinsicPropsCache.has(tag)) {
    const cached = intrinsicPropsCache.get(tag);
    if (!skipNames || skipNames.size === 0) return cached;
    return cached.filter(p => !skipNames.has(p.name));
  }
  if (!service || !ts) return [];
  patchTypes();
  const program = service.getProgram();
  if (!program) { return []; }
  const checker = program.getTypeChecker();

  // Strategy 1: Find an existing __ripEl('tag') call and resolve the full
  // __RipProps<'tag'> intersection type from the call's resolved signature.
  let sfCount = 0;
  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile) continue;
    sfCount++;
    let found = null;
    ts.forEachChild(sf, function visit(node) {
      if (found) return;
      if (ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === '__ripEl' &&
          node.arguments.length >= 1 &&
          ts.isStringLiteral(node.arguments[0]) &&
          node.arguments[0].text === tag) {
        found = node;
        return;
      }
      ts.forEachChild(node, visit);
    });
    if (!found) continue;

    const callSig = checker.getResolvedSignature(found);
    if (!callSig || callSig.parameters.length < 2) continue;
    const propsParam = callSig.parameters[1];
    const propsType = checker.getNonNullableType(
      checker.getTypeOfSymbolAtLocation(propsParam, found));
    if (!propsType) continue;

    const props = collectFilteredProps(checker, propsType, found);
    // The __RipAttrKeys conditional type trick works for type-checking but
    // TypeScript's checker API cannot enumerate its members via getProperties().
    // When only the Rip extras (ref, class, style) survive, the mapped type
    // contributed nothing — fall through to Strategy 2 which resolves the raw
    // DOM element type and filters properties directly.
    const RIP_EXTRAS = new Set(['ref', 'class', 'style']);
    const hasDomProps = props.some(p => !RIP_EXTRAS.has(p.name));
    if (hasDomProps && props.length > 0) {
      intrinsicPropsCache.set(tag, props);
      if (!skipNames || skipNames.size === 0) return props;
      return props.filter(p => !skipNames.has(p.name));
    }
  }

  // Strategy 2: Resolve the element type from __RipElementMap directly.
  // This works even when no __ripEl('tag') call exists in any compiled file.
  // We look up the element type and apply the same __RipAttrKeys filter
  // (skip methods, skip 'style' as a property), then add the Rip-specific
  // extras (class, style, ref).
  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile) continue;
    let mapDecl = null;
    for (const stmt of sf.statements) {
      if (ts.isTypeAliasDeclaration(stmt) && stmt.name.text === '__RipElementMap') {
        mapDecl = stmt;
        break;
      }
    }
    if (!mapDecl) continue;

    const mapSymbol = checker.getSymbolAtLocation(mapDecl.name);
    if (!mapSymbol) continue;
    const mapType = checker.getDeclaredTypeOfSymbol(mapSymbol);
    const tagProp = mapType.getProperty(tag);
    if (!tagProp) continue;

    const elemType = checker.getTypeOfSymbolAtLocation(tagProp, mapDecl);
    if (!elemType) continue;

    // Mirror the __RipAttrKeys type-level filter in JavaScript:
    // skip style/classList/className/nodeValue/textContent/innerHTML/innerText/
    // outerHTML/outerText/scrollLeft/scrollTop, on* handlers, aria*Element(s),
    // methods, and readonly properties.
    const SKIP_PROPS = new Set([
      'style', 'classList', 'className', 'nodeValue', 'textContent',
      'innerHTML', 'innerText', 'outerHTML', 'outerText', 'scrollLeft', 'scrollTop',
    ]);
    const props = [];
    for (const prop of elemType.getProperties()) {
      if (SKIP_PROPS.has(prop.name)) continue;
      if (prop.name.startsWith('on')) continue;
      if (/^aria.+Elements?$/.test(prop.name)) continue;
      if (prop.name.startsWith('__') || prop.name.startsWith('@')) continue;
      if (/^[A-Z][A-Z_0-9]+$/.test(prop.name)) continue;
      const propType = checker.getTypeOfSymbolAtLocation(prop, mapDecl);
      if (propType.getCallSignatures().length > 0) continue;
      const decls = prop.getDeclarations();
      if (decls?.length > 0) {
        const allReadonly = decls.every(d =>
          (ts.getCombinedModifierFlags(d) & ts.ModifierFlags.Readonly) !== 0);
        if (allReadonly) continue;
      }
      props.push({
        name: prop.name,
        type: checker.typeToString(propType),
        required: false,
      });
    }
    // Add Rip-specific props from __RipProps (class, style, ref)
    props.push({ name: 'class', type: 'string | string[]', required: false });
    props.push({ name: 'style', type: 'string', required: false });
    props.push({ name: 'ref', type: 'string', required: false });
    if (props.length > 0) {
      intrinsicPropsCache.set(tag, props);
      if (!skipNames || skipNames.size === 0) return props;
      return props.filter(p => !skipNames.has(p.name));
    }
  }

  return [];
}

function collectFilteredProps(checker, propsType, contextNode) {
  const props = [];
  for (const prop of propsType.getProperties()) {
    if (prop.name.startsWith('__bind_') || prop.name.startsWith('@')) continue;
    if (/^[A-Z][A-Z_0-9]+$/.test(prop.name)) continue;
    const decls = prop.getDeclarations();
    if (decls?.length > 0) {
      const allReadonly = decls.every(d =>
        (ts.getCombinedModifierFlags(d) & ts.ModifierFlags.Readonly) !== 0);
      if (allReadonly) continue;
    }
    const propType = checker.getTypeOfSymbolAtLocation(prop, contextNode);
    props.push({
      name: prop.name,
      type: checker.typeToString(propType),
      required: false,
    });
  }
  return props;
}

// Resolve intrinsic element attributes for a component that extends an HTML element.
// Delegates to resolveTagProps and filters out the component's own props.
function resolveIntrinsicProps(componentName, ownPropNames) {
  const info = componentRegistry.get(componentName);
  if (!info?.inheritsTag) return [];
  return resolveTagProps(info.inheritsTag, ownPropNames);
}

// Resolve a type name to its definition string from all compiled DTS.
// e.g. "Status" → '"pending" | "active" | "done"'
// Handles both single-line (`type X = A | B;`) and multi-line (`type X = {\n...\n};`) DTS.
function resolveTypeFromDTS(typeName) {
  for (const [, entry] of compiled) {
    if (!entry.dts) continue;
    const re = new RegExp('^(?:export\\s+)?type\\s+' + typeName + '\\s*=\\s*', 'm');
    const m = entry.dts.match(re);
    if (!m) continue;
    const start = m.index + m[0].length;
    // Collect the type body, tracking brace/bracket depth
    let depth = 0, i = start;
    const dts = entry.dts;
    while (i < dts.length) {
      const ch = dts[i];
      if (ch === '{' || ch === '<' || ch === '(') depth++;
      else if (ch === '}' || ch === '>' || ch === ')') {
        depth--;
        if (depth < 0) break;
      }
      else if (ch === ';' && depth === 0) break;
      i++;
    }
    // Include the closing brace if we stopped at depth going below zero
    if (i < dts.length && dts[i] === '}') i++;
    return dts.slice(start, i).trim().replace(/;\s*$/, '');
  }
  return null;
}

// Resolve a property's string literal union values from a discriminant
// expression like "shape.kind", using source-level type annotations and DTS.
// Returns string literal values like ['"circle"', '"rect"'] or [].
function resolveDiscriminantValues(srcLines, switchLine, switchExpr) {
  // Parse discriminant: e.g. "shape.kind" → varName="shape", propChain=["kind"]
  const parts = switchExpr.split('.');
  if (parts.length < 2) return [];
  const varName = parts[0];
  const propChain = parts.slice(1);

  // Walk backwards from the switch line to find the variable's type annotation
  let varType = null;
  for (let i = switchLine; i >= 0; i--) {
    const li = srcLines[i];
    // Match parameter: (name:: Type) or name:: Type
    const paramRe = new RegExp('\\b' + varName + '\\s*::\\s*([\\w.]+)');
    const pm = li.match(paramRe);
    if (pm) { varType = pm[1].trim(); break; }
  }
  if (!varType) return [];

  // Try DTS first, then fall back to source-level type definitions
  let typeDef = resolveTypeFromDTS(varType) || resolveTypeFromSource(srcLines, varType);
  if (!typeDef) return [];

  // Expand named union members: "Circle | Rect" → individual type bodies
  // Split on top-level | (not inside braces)
  const members = splitTopLevelUnion(typeDef);

  // For each member, resolve if it's a named type, then extract the property
  const propValues = new Set();
  for (let member of members) {
    member = member.trim();
    // If it's a named type reference, resolve it
    if (/^\w+$/.test(member)) {
      const resolved = resolveTypeFromDTS(member) || resolveTypeFromSource(srcLines, member);
      if (resolved) member = resolved;
    }
    // Extract the property value from object type: { kind: "circle", ... }
    const propName = propChain[propChain.length - 1];
    const propRe = new RegExp('\\b' + propName + '\\s*:\\s*(["\'][^"\']*["\'])');
    const pm = member.match(propRe);
    if (pm) propValues.add(pm[1]);
  }

  return [...propValues];
}

// Resolve a type name from Rip source lines (fallback when DTS unavailable).
// Handles: type X = { ... } and type X = A | B
function resolveTypeFromSource(srcLines, typeName) {
  const re = new RegExp('^type\\s+' + typeName + '\\s*=\\s*(.*)');
  for (let i = 0; i < srcLines.length; i++) {
    const m = srcLines[i].match(re);
    if (!m) continue;
    let body = m[1].trim();
    // Single-line type: type X = A | B
    if (!body.startsWith('{') || (body.includes('}') && body.indexOf('}') < body.length)) {
      // Check if it's a complete single-line definition
      if (!body.startsWith('{') || body.includes('}')) return body.replace(/\s*$/, '');
    }
    // Multi-line object type: collect until matching }
    let depth = 0;
    for (let j = i; j < srcLines.length; j++) {
      for (const ch of srcLines[j]) {
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }
      if (depth <= 0) {
        // Join all lines from i to j
        const full = srcLines.slice(i, j + 1).join(' ');
        const fm = full.match(re);
        return fm ? fm[1].trim() : body;
      }
    }
    return body;
  }
  return null;
}

// Split a type string on top-level | (not inside { } or < >)
function splitTopLevelUnion(typeStr) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < typeStr.length; i++) {
    const ch = typeStr[i];
    if (ch === '{' || ch === '<' || ch === '(') depth++;
    else if (ch === '}' || ch === '>' || ch === ')') depth--;
    else if (ch === '|' && depth === 0) {
      parts.push(typeStr.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(typeStr.slice(start));
  return parts;
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
  const direct = detectComponentContext(srcLines[lineIndex], col, srcLines, lineIndex);
  if (direct) {
    // Also collect props from indented block lines below for existingProps
    const baseIndent = srcLines[lineIndex].length - srcLines[lineIndex].trimStart().length;
    for (let b = lineIndex + 1; b < srcLines.length; b++) {
      const bLine = srcLines[b];
      if (bLine.trim() === '') continue;
      const bIndent = bLine.length - bLine.trimStart().length;
      if (bIndent <= baseIndent) break;
      for (const m of bLine.trimStart().matchAll(/(?:^|,)\s*(@?\w+)\s*:/g)) {
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
  let component = null;
  let htmlTag = null;
  if (compMatch) {
    if (/=\s*component\b/.test(parentTrimmed)) return null;
    if (!componentRegistry.has(compMatch[1])) return null;
    component = compMatch[1];
  } else {
    // Check for HTML element tag (lowercase identifier starting a line in a render block)
    const tagMatch = parentTrimmed.match(/^([a-z]\w*)\b/);
    if (tagMatch && isInRenderBlock(srcLines, parentLine)) {
      htmlTag = tagMatch[1];
    } else {
      return null;
    }
  }
  const tagOrComp = component || htmlTag;

  // Collect all existing props from inline (parent line) + block lines
  const existingProps = [];
  const propValues = new Map();
  const parentRest = parentTrimmed.substring(tagOrComp.length);
  for (const m of parentRest.matchAll(/(?:^|,)\s*(@?\w+)\s*:/g)) {
    existingProps.push(m[1]);
  }
  const baseIndent = srcLines[parentLine].length - parentTrimmed.length;
  for (let b = parentLine + 1; b < srcLines.length; b++) {
    const bLine = srcLines[b];
    if (bLine.trim() === '') continue;
    const bIndent = bLine.length - bLine.trimStart().length;
    if (bIndent <= baseIndent) break;
    for (const m of bLine.trimStart().matchAll(/(?:^|,)\s*(@?\w+)\s*:/g)) {
      const key = m[1];
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
      return { component, htmlTag, existingProps, propValues, currentProp: propName, wantValues: false, wantProps: true };
    }
    if (cursorInTrimmed >= afterColon) {
      const valStr = trimmed.substring(afterColon);
      propValues.set(propName, valStr);
      return { component, htmlTag, existingProps, propValues, currentProp: propName, wantValues: true, wantProps: false };
    }
  }

  // Cursor on a blank/incomplete line — offer prop completions
  return { component, htmlTag, existingProps, propValues, currentProp: null, wantValues: false, wantProps: true };
}

function detectComponentContext(srcLine, col, srcLines, lineIndex) {
  if (!srcLine) return null;

  const trimmed = srcLine.trimStart();
  const indent = srcLine.length - trimmed.length;

  const compMatch = trimmed.match(/^([A-Z]\w*)\b/);
  let component = null;
  let htmlTag = null;
  if (compMatch) {
    if (/=\s*component\b/.test(trimmed)) return null;
    if (!componentRegistry.has(compMatch[1])) return null;
    component = compMatch[1];
  } else if (srcLines && lineIndex != null) {
    // Check for inline HTML tag (lowercase identifier) inside a render block
    const tagMatch = trimmed.match(/^([a-z][\w-]*)\b/);
    if (tagMatch && isInRenderBlock(srcLines, lineIndex)) {
      htmlTag = tagMatch[1];
    }
  }
  if (!component && !htmlTag) return null;
  const tagOrComp = component || htmlTag;

  const rest = trimmed.substring(tagOrComp.length);
  if (rest.length > 0 && rest[0] !== ' ' && rest[0] !== '\t') return null;

  const cursorInTrimmed = col - indent;

  if (cursorInTrimmed <= tagOrComp.length) {
    return { component, htmlTag, existingProps: [], propValues: new Map(), currentProp: null, wantValues: false, wantProps: false };
  }

  const cursorInRest = cursorInTrimmed - tagOrComp.length;
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

  return { component, htmlTag, existingProps, propValues, currentProp, wantValues, wantProps };
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

    // Pre-compute ARIA declaration block line range (if injected) so its
    // parameter tokens (open, event, trigger, etc.) don't mis-map.
    let ariaBlockStart = -1, ariaBlockEnd = -1;
    if (headerEndOffset > 0) {
      for (let h = 0; h < c.headerLines; h++) {
        const hl = tc.getLineText(c.tsContent, h);
        if (ariaBlockStart < 0 && /^\s*declare\s+const\s+ARIA\b/.test(hl)) ariaBlockStart = h;
        if (ariaBlockStart >= 0 && /^\};/.test(hl)) { ariaBlockEnd = h; break; }
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

      // DTS header token handling: reclassify and skip synthetic lines.
      let finalType = tsTokenType;
      if (tsOffset < headerEndOffset) {
        const tsLine = tc.offsetToLine(c.tsContent, tsOffset);
        const lineText = tc.getLineText(c.tsContent, tsLine);
        // Skip tokens from synthetic `declare function` lines. User
        // function sigs are moved to the body during interleaving —
        // only stdlib globals (kind, p, pp, etc.) and reactive helpers
        // (__state, __computed) remain. These have no source counterpart,
        // and text-search mapping mis-maps them to identically named
        // properties or variables (e.g. `kind` in a type block gets
        // colored as a function).
        if (/^\s*declare\s+function\s/.test(lineText)) continue;
        // Skip tokens from synthetic framework type definitions without
        // source counterparts (__RipBrowserElement, Signal, etc.).
        // Identifiers in their method signatures (e.g. `value` in
        // setAttribute) can text-search mis-map to user identifiers,
        // overriding TextMate scopes with incorrect semantic token types.
        if (/^\s*(?:type\s+__\w|interface\s+(?:Signal|Computed)\b)/.test(lineText)) continue;
        // Skip tokens inside the ARIA declaration block (declare const ARIA: {...}).
        if (ariaBlockStart >= 0 && tsLine >= ariaBlockStart && tsLine <= ariaBlockEnd) continue;
        // TS classifies function params in declaration files as
        // 'variable' instead of 'parameter'. Reclassify when on a
        // function signature line.
        if (tsTokenType === 7 && /^\s*(?:export\s+)?(?:declare\s+)?(?:async\s+)?function\s/.test(lineText)) {
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

      // When the initial mapping lands inside a string literal or comment,
      // reserve that position and try to find the real occurrence outside.
      // This commonly happens when a variable name also appears as a string
      // value on the same source line (e.g. `console.log "total:", total`).
      if (isInsideStringOrComment(srcLines[matchLine], matchCol)) {
        usedPositions.add(matchLine + ':' + matchCol);
        if (!findUnusedOccurrence(srcLines, tsText, tsLength, matchLine, usedPositions, (l, c) => { matchLine = l; matchCol = c; })) continue;
      }

      // Skip tokens inside render blocks where TextMate provides
      // entity.name.tag.rip or entity.other.attribute-name.rip scopes.
      if (renderBlockLines.has(matchLine)) {
        const sl = srcLines[matchLine];
        const slIndent = sl.length - sl.trimStart().length;
        const firstWord = sl.substring(slIndent).match(/^([a-zA-Z]\w*)\b/);
        const isTagLine = firstWord && HTML_TAG_NAMES.has(firstWord[1]);
        const isComponentLine = firstWord && /^[A-Z]/.test(firstWord[1]);

        // When the semantic token lands on an HTML tag at the first-word
        // position (e.g. `label label` — first is the <label> tag),
        // reserve that position and redirect to the next occurrence
        // (the reactive prop reference). TextMate's entity.name.tag.rip
        // scope is correct for the tag; the semantic token belongs on
        // the prop.
        if (isTagLine && matchCol === slIndent) {
          const after = sl.charAt(matchCol + tsLength);
          if (!after || after === ' ' || after === '\t') {
            // Try to redirect to the next occurrence (e.g. `label label` →
            // keep tag, token on prop). If no second occurrence exists
            // (bare `label` as text child), keep token here to override
            // the incorrect TextMate tag scope with property scope.
            const savedKey = posKey;
            usedPositions.add(posKey);
            if (!findUnusedOccurrence(srcLines, tsText, tsLength, matchLine, usedPositions, (l, c) => { matchLine = l; matchCol = c; })) {
              // No redirect target — restore position and emit here
              usedPositions.delete(savedKey);
            }
          }
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
      connection.console.log(`[rip] completion ctx: component=${ctx.component}, htmlTag=${ctx.htmlTag}, wantProps=${ctx.wantProps}, wantValues=${ctx.wantValues}, currentProp=${ctx.currentProp}`);
      const info = ctx.component ? componentRegistry.get(ctx.component) : null;

      // Build the unified props list for either components or raw HTML elements
      let ownProps = [];
      let ownPropNames = new Set();
      let allProps = [];

      if (info) {
        // Component with registered props
        ownProps = info.props;
        ownPropNames = new Set(ownProps.map(p => p.name));
        allProps = [...ownProps];
        if (info.inheritsTag) {
          for (const ip of resolveIntrinsicProps(ctx.component, ownPropNames)) {
            allProps.push(ip);
          }
        }
      } else if (ctx.htmlTag) {
        // Raw HTML element — all props come from the DOM type
        allProps = resolveTagProps(ctx.htmlTag);
        connection.console.log(`[rip] resolveTagProps('${ctx.htmlTag}') returned ${allProps.length} props`);
      }

      if (allProps.length > 0 || ctx.htmlTag || (info && info.inheritsTag)) {
        if (ctx.wantProps) {
          // When the user is typing an @event name, return only @event: completions.
          // Detect by checking if the current word starts with '@' (covers both
          // the initial trigger character and continued typing like @bl).
          const wordStart = srcLine.slice(0, params.position.character).search(/@\w*$/);
          const typingAtEvent = wordStart >= 0;

          const attrItems = typingAtEvent ? [] : allProps
            .filter(p => !ctx.existingProps.includes(p.name))
            .map(p => {
              const isOwn = ownPropNames.has(p.name);
              return {
                label: p.name + ':',
                kind: 5,
                detail: p.type,
                insertText: p.name + ': ',
                sortText: p.required ? '0' + p.name : isOwn ? '1' + p.name : '2' + p.name,
              };
            });
          // Add @event: completions for elements in render blocks
          if (ctx.htmlTag || (info && info.inheritsTag)) {
            // Compute the replacement range starting from the '@' so VS Code
            // matches the full @event prefix (@ isn't a word character, so
            // without an explicit range VS Code would only see 'b' for '@b').
            const atStart = typingAtEvent ? wordStart : params.position.character;
            const replaceRange = {
              start: { line: params.position.line, character: atStart },
              end: params.position,
            };
            for (const ev of getDomEventNames()) {
              if (ctx.existingProps.includes('@' + ev)) continue;
              attrItems.push({
                label: '@' + ev + ':',
                kind: 23,
                detail: '(event handler)',
                textEdit: { range: replaceRange, newText: '@' + ev + ': ' },
                filterText: '@' + ev,
                sortText: typingAtEvent ? '0' + ev : '3' + ev,
              });
            }
          }
          return attrItems;
        }
        if (ctx.wantValues && ctx.currentProp) {
          const prop = allProps.find(p => p.name === ctx.currentProp);
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

    // When-clause completions — discriminated union values for switch/when
    const whenMatch = srcLine.match(/^\s*when\s+(["'])/);
    if (whenMatch) {
      const quote = whenMatch[1];
      const whenIdx = srcLine.indexOf('when');
      const quoteStart = srcLine.indexOf(quote, whenIdx + 4);
      const quoteEnd = srcLine.indexOf(quote, quoteStart + 1);
      const col = params.position.character;
      // Only trigger when cursor is inside the when-clause string literal
      if (col > quoteStart && (quoteEnd < 0 || col <= quoteEnd)) {
        // Walk backwards to find parent switch at a lower indent level
        const indent = srcLine.match(/^\s*/)[0].length;
        let switchLine = -1, switchExpr = null;
        for (let i = params.position.line - 1; i >= 0; i--) {
          const li = srcLines[i];
          const liIndent = li.match(/^\s*/)[0].length;
          if (liIndent < indent) {
            const sm = li.match(/^\s*switch\s+(.+)/);
            if (sm) { switchLine = i; switchExpr = sm[1].trim(); }
            break;
          }
        }
        if (switchExpr && switchLine >= 0) {
          const values = resolveDiscriminantValues(srcLines, switchLine, switchExpr);
          if (values.length > 0) {
            // Collect existing when values to exclude
            const existing = new Set();
            for (let i = params.position.line - 1; i >= 0; i--) {
              const wm = srcLines[i].match(/^\s*when\s+["']([^"']*)["']/);
              if (wm) existing.add(wm[1]);
              else if (/^\s*switch\b/.test(srcLines[i])) break;
            }
            for (let i = params.position.line + 1; i < srcLines.length; i++) {
              const wm = srcLines[i].match(/^\s*when\s+["']([^"']*)["']/);
              if (wm) existing.add(wm[1]);
              else if (!/^\s*(when|else|$|#)/.test(srcLines[i])) break;
            }
            const prevCh = col > 0 ? srcLine[col - 1] : '';
            const inQuotes = prevCh === '"' || prevCh === "'";
            return values
              .filter(v => !existing.has(v.replace(/^["']|["']$/g, '')))
              .map((v, i) => {
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

    // Space/colon triggered outside component/render context — don't fall through to TS
    if (params.context?.triggerCharacter === ' ' || params.context?.triggerCharacter === ':') {
      if (!isInRenderBlock(srcLines, params.position.line)) return [];
    }
  }

  // TypeScript completions
  if (!service) return [];

  // Dot-recovery: when cursor follows a trailing dot (e.g. `obj.`), the lexer
  // treats `.` at EOL as line-continuation and compilation fails.  Patch only
  // the cursor line with a placeholder property so TS sees a member-access.
  if (doc) {
    const curLine = (doc.getText().split('\n')[params.position.line]) || '';
    const before = curLine.slice(0, params.position.character);
    if (/\w\.\s*$/.test(before)) {
      const docLines = doc.getText().split('\n');
      docLines[params.position.line] = before.replace(/(\w)\.\s*$/, '$1.__rip__') + curLine.slice(params.position.character);
      try {
        const strict = isStrictFile(fp);
        const entry = tc.compileForCheck(fp, docLines.join('\n'), compiler, { strict });
        const prev = compiled.get(fp);
        compiled.set(fp, { version: (prev?.version || 0) + 1, ...entry });
      } catch (e) { debugLog(`dot-recovery compile failed: ${e.message}`); } // recovery failed — continue with stale data
    }
  }

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

  // Import path hover — show module info like TypeScript does
  const doc = documents.get(params.textDocument.uri);
  const srcLines = doc ? doc.getText().split('\n') : null;
  if (srcLines) {
    const srcLine = srcLines[params.position.line];
    if (srcLine) {
      const fromMatch = srcLine.match(/from\s+['"]([^'"]+)['"]/);
      if (fromMatch) {
        const pathStart = fromMatch.index + fromMatch[0].indexOf(fromMatch[1]) - 1;
        const pathEnd = pathStart + fromMatch[1].length + 2;
        const col = params.position.character;
        if (col >= pathStart && col < pathEnd) {
          let importPath = fromMatch[1];
          if (!path.isAbsolute(importPath)) importPath = path.resolve(path.dirname(fp), importPath);
          if (!importPath.endsWith('.rip') && fs.existsSync(importPath + '.rip')) importPath += '.rip';
          if (fs.existsSync(importPath)) {
            return { contents: { kind: 'markdown', value: `\`\`\`typescript\nmodule "${importPath}"\n\`\`\`` } };
          }
        }
      }
    }
  }

  // Skip hover inside string literals and comments (e.g. Tailwind classes)
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
          const ownPropNames = new Set(compInfo.props.map(p => p.name));
          const allProps = compInfo.inheritsTag ? [...compInfo.props, ...resolveIntrinsicProps(ctx.component, ownPropNames)] : compInfo.props;
          const prop = allProps.find(p => p.name === ctx.currentProp);
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
    } else if (ctx?.htmlTag && ctx.currentProp) {
      const allProps = resolveTagProps(ctx.htmlTag);
      const prop = allProps.find(p => p.name === ctx.currentProp);
      if (prop) {
        return { contents: { kind: 'markdown', value: `\`\`\`typescript\n(property) ${prop.name}?: ${prop.type}\n\`\`\`` } };
      }
    }
  }

  // TypeScript hover
  if (!service) return null;
  const offset = srcToOffset(fp, params.position.line, params.position.character);
  if (offset === undefined) {
    debugLog(`hover: srcToOffset returned undefined for ${path.basename(fp)}:${params.position.line + 1}:${params.position.character + 1}`);
    return null;
  }

  try {
    patchTypes();
    const info = service.getQuickInfoAtPosition(toVirtual(fp), offset);
    if (!info) {
      debugLog(`hover: getQuickInfoAtPosition returned null at offset ${offset} (${path.basename(fp)}:${params.position.line + 1}:${params.position.character + 1})`);
      return null;
    }
    let display = ts.displayPartsToString(info.displayParts);
    const docs = ts.displayPartsToString(info.documentation || []);
    display = unwrapReactiveType(display);
    display = display.replace(/\b__bind_(\w+)__\b/g, '$1');
    let value = '```typescript\n' + display + '\n```';
    if (docs) value += '\n\n' + docs;
    if (info.tags?.length) {
      for (const tag of info.tags) {
        const text = ts.displayPartsToString(tag.text || []);
        value += `\n\n*@${tag.name}*` + (text ? ` — ${text}` : '');
      }
    }
    return { contents: { kind: 'markdown', value } };
  } catch (e) { connection.console.log(`[rip] hover error: ${e.message}`); return null; }
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

    // Import go-to-definition — resolve import paths directly
    const srcLine = doc.getText().split('\n')[params.position.line];
    const fromMatch = srcLine?.match(/from\s+['"]([^'"]+)['"]/);
    if (fromMatch) {
      let importPath = fromMatch[1];
      if (!path.isAbsolute(importPath)) importPath = path.resolve(path.dirname(fp), importPath);
      if (!importPath.endsWith('.rip') && fs.existsSync(importPath + '.rip')) importPath += '.rip';
      if (fs.existsSync(importPath)) {
        // Check if cursor is on the module path string (quote to quote)
        const pathStart = fromMatch.index + fromMatch[0].indexOf(fromMatch[1]) - 1;
        const pathEnd = pathStart + fromMatch[1].length + 2;
        const col = params.position.character;
        const line = params.position.line;
        const originRange = { start: { line, character: pathStart }, end: { line, character: pathEnd } };
        const target = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
        if (col >= pathStart && col < pathEnd) {
          return [{ targetUri: pathToUri(importPath), targetRange: target, targetSelectionRange: target, originSelectionRange: originRange }];
        }
        if (word && word !== 'from' && word !== 'import') {
          const targetSrc = fs.readFileSync(importPath, 'utf8');
          const targetLines = targetSrc.split('\n');
          const pat = new RegExp(`(?:^|export\\s+)(?:def\\s+|type\\s+|interface\\s+)?${word}\\s*[=(:]`);
          for (let i = 0; i < targetLines.length; i++) {
            if (pat.test(targetLines[i])) {
              const symCol = targetLines[i].indexOf(word);
              const symRange = { start: { line: i, character: Math.max(0, symCol) }, end: { line: i, character: Math.max(0, symCol) + word.length } };
              return [{ targetUri: pathToUri(importPath), targetRange: symRange, targetSelectionRange: symRange }];
            }
          }
          // Symbol not found in target — navigate to file
          return [{ targetUri: pathToUri(importPath), targetRange: target, targetSelectionRange: target }];
        }
      }
    }
  }

  // TypeScript go-to-definition
  if (!service) return null;
  const offset = srcToOffset(fp, params.position.line, params.position.character);
  if (offset === undefined) {
    debugLog(`definition: srcToOffset returned undefined for ${path.basename(fp)}:${params.position.line + 1}:${params.position.character + 1}`);
    return null;
  }

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
        if (!pos) return null;
        return { uri: pathToUri(realPath), range: { start: pos, end: pos } };
      }
      const pos = offsetToLineCol(fs.readFileSync(d.fileName, 'utf8'), d.textSpan.start);
      return { uri: pathToUri(realPath), range: { start: pos, end: pos } };
    });
  } catch (e) { connection.console.log(`[rip] definition error: ${e.message}`); return null; }
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
  } catch (e) { connection.console.log(`[rip] signature help error: ${e.message}`); return null; }
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
  for (const d of [root, __dirname]) { try { return await import(require.resolve('rip-lang', { paths: [d] })); } catch {} }
  try { return await import(require.resolve('rip-lang')); } catch {}
  return null;
}

async function loadTypecheck(root) {
  for (const p of [path.join(root, 'src', 'typecheck.js'), path.join(root, 'node_modules', 'rip-lang', 'src', 'typecheck.js')]) {
    if (fs.existsSync(p)) {
      try { return await import(p); } catch (e) { connection.console.log(`[rip] typecheck failed: ${e.message}`); }
    }
  }
  for (const d of [root, __dirname]) {
    try {
      const resolved = require.resolve('rip-lang', { paths: [d] });
      return await import(path.join(path.dirname(resolved), 'typecheck.js'));
    } catch {}
  }
  try { return await import(path.join(path.dirname(require.resolve('rip-lang')), 'typecheck.js')); } catch {}
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
