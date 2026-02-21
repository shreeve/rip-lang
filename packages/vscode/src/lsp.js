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
      completionProvider: { triggerCharacters: ['.', '"', "'", '/'] },
      hoverProvider: true,
      definitionProvider: true,
      signatureHelpProvider: { triggerCharacters: ['(', ','] },
    },
  };
});

connection.onInitialized(() => connection.console.log('[rip] ready'));

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

    connection.console.log(`[rip] compiled ${path.basename(filePath)}: hasTypes=${entry.hasTypes}, headerLines=${entry.headerLines}`);
    publishDiagnostics(filePath);
  } catch (e) {
    connection.console.log(`[rip] compile error ${path.basename(filePath)}: ${e.message}`);
  }
}

function publishDiagnostics(filePath) {
  if (!service) return;
  const c = compiled.get(filePath);
  if (!c) return;

  // Skip diagnostics entirely for untyped files — @ts-nocheck only suppresses
  // semantic errors, but syntactic errors (e.g. from component template code)
  // would still leak through.
  if (!c.hasTypes) {
    connection.sendDiagnostics({ uri: pathToUri(filePath), diagnostics: [] });
    return;
  }

  try {
    patchTypes();
    const vf = toVirtual(filePath);
    const semanticDiags = service.getSemanticDiagnostics(vf);
    const syntacticDiags = service.getSyntacticDiagnostics(vf);
    const allDiags = [...syntacticDiags, ...semanticDiags];

    const diagnostics = [];
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

    connection.sendDiagnostics({ uri: pathToUri(filePath), diagnostics });
    connection.console.log(`[rip] diagnostics ${path.basename(filePath)}: ${diagnostics.length} issues`);
  } catch (e) {
    connection.console.log(`[rip] diagnostics error: ${e.message}`);
  }
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

  const checker = program.getTypeChecker();
  for (const [filePath] of compiled) {
    const sf = program.getSourceFile(toVirtual(filePath));
    if (!sf) continue;

    const uninitialized = new Map();
    for (const stmt of sf.statements) {
      if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          // Only patch untyped declarations (e.g. `let x;` from Rip hoisting).
          // Skip declarations that already have a type annotation (e.g. `let user: User;`
          // from the DTS) — overriding those would suppress real type errors.
          if (!decl.initializer && !decl.type && ts.isIdentifier(decl.name)) {
            const sym = checker.getSymbolAtLocation(decl.name);
            if (sym) uninitialized.set(decl.name.text, sym);
          }
        }
      }
      if (ts.isExpressionStatement(stmt) && ts.isBinaryExpression(stmt.expression) &&
          stmt.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          ts.isIdentifier(stmt.expression.left)) {
        const name = stmt.expression.left.text;
        const sym = uninitialized.get(name);
        if (sym) {
          const rhsType = checker.getTypeAtLocation(stmt.expression.right);
          sym.flags |= ts.SymbolFlags.Transient;
          sym.links = { type: rhsType };
          uninitialized.delete(name);
        }
      }
    }
  }
}

// ── Position mapping ───────────────────────────────────────────────

function srcToOffset(filePath, line, col) {
  const c = compiled.get(filePath);
  if (!c) return undefined;
  let genLine = c.srcToGen.get(line);
  if (genLine === undefined) {
    let best = -1;
    for (const [s] of c.srcToGen) if (s <= line && s > best) best = s;
    if (best < 0) return undefined;
    genLine = c.srcToGen.get(best) + (line - best);
  }
  const srcLines = c.source.split('\n');
  const genLines = c.tsContent.split('\n');
  if (srcLines[line] && genLines[genLine]) {
    const srcText = srcLines[line];
    const genText = genLines[genLine];
    const wordMatch = srcText.substring(col).match(/^\w+/) || srcText.substring(0, col).match(/\w+$/);
    if (wordMatch) {
      const word = wordMatch[0];
      const genCol = genText.indexOf(word);
      if (genCol >= 0) return lineColToOffset(c.tsContent, genLine, genCol);
    }
  }
  return lineColToOffset(c.tsContent, genLine, col);
}

function genToSrcPos(filePath, offset) {
  const c = compiled.get(filePath);
  if (!c) return { line: 0, character: 0 };
  const { line: genLine, character } = offsetToLineCol(c.tsContent, offset);
  let srcLine = c.genToSrc.get(genLine);
  if (srcLine === undefined) {
    let best = -1;
    for (const [g] of c.genToSrc) if (g <= genLine && g > best) best = g;
    srcLine = best >= 0 ? c.genToSrc.get(best) + (genLine - best) : 0;
  }
  return { line: srcLine, character };
}

function lineColToOffset(t, line, col) { let r = 0; for (let i = 0; i < t.length; i++) { if (r === line) return i + col; if (t[i] === '\n') r++; } return t.length; }
function offsetToLineCol(t, o) { let line = 0, ls = 0; for (let i = 0; i < o && i < t.length; i++) { if (t[i] === '\n') { line++; ls = i + 1; } } return { line, character: o - ls }; }
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
    }
  }
  return display;
}

// ── LSP handlers ───────────────────────────────────────────────────

connection.onCompletion((params) => {
  if (!service) return [];
  const fp = uriToPath(params.textDocument.uri);
  if (!fp.endsWith('.rip')) return [];
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
  if (!service) return null;
  const fp = uriToPath(params.textDocument.uri);
  if (!fp.endsWith('.rip')) return null;
  const offset = srcToOffset(fp, params.position.line, params.position.character);
  if (offset === undefined) return null;

  try {
    patchTypes();
    const info = service.getQuickInfoAtPosition(toVirtual(fp), offset);
    if (!info) return null;
    let display = ts.displayPartsToString(info.displayParts);
    const docs = ts.displayPartsToString(info.documentation || []);
    display = unwrapReactiveType(display);
    return { contents: { kind: 'markdown', value: '```typescript\n' + (docs ? display + '\n\n' + docs : display) + '\n```' } };
  } catch { return null; }
});

connection.onDefinition((params) => {
  if (!service) return null;
  const fp = uriToPath(params.textDocument.uri);
  if (!fp.endsWith('.rip')) return null;
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
          const pat = new RegExp(`^[^#\\n]*\\b(def\\s+)?${name}\\s*(::=|=|\\()`, 'm');
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
  if (!service) return null;
  const fp = uriToPath(params.textDocument.uri);
  if (!fp.endsWith('.rip')) return null;
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
