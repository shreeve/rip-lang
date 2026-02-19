// Rip Language Server — direct TypeScript Language Service, no frameworks

const { createConnection, TextDocuments, ProposedFeatures, TextDocumentSyncKind } = require('vscode-languageserver/node');
const { TextDocument } = require('vscode-languageserver-textdocument');
const path = require('path');
const fs = require('fs');

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let ts, compiler, service, rootPath;

// Real .rip path → { version, source, tsContent, srcToGen, genToSrc }
const compiled = new Map();

// TypeScript sees virtual .ts paths; we translate at the boundary
function toVirtual(ripPath) { return ripPath + '.ts'; }
function fromVirtual(tsPath) { return tsPath.endsWith('.rip.ts') ? tsPath.slice(0, -3) : tsPath; }
function isVirtual(p) { return p.endsWith('.rip.ts'); }

connection.onInitialize(async (params) => {
  rootPath = params.rootPath || process.cwd();
  connection.console.log(`[rip] root: ${rootPath}`);

  compiler = await loadCompiler(rootPath);
  connection.console.log(`[rip] compiler: ${compiler ? 'loaded' : 'NOT FOUND'}`);

  ts = loadTypeScript(params);
  if (ts) connection.console.log(`[rip] TypeScript ${ts.version}`);

  if (ts && compiler) {
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
  if (fp.endsWith('.rip') && compiler) compileRip(fp, document.getText());
});

documents.onDidClose(({ document }) => compiled.delete(uriToPath(document.uri)));

function compileRip(filePath, source) {
  try {
    const result = compiler.compile(source, { sourceMap: true, types: true });
    const code = result.code || '';
    const dts = result.dts ? result.dts.trimEnd() + '\n' : '';
    const tsContent = '// @ts-nocheck\n' + dts + '\n' + code;
    const headerLines = countLines('// @ts-nocheck\n' + dts + '\n');
    const { srcToGen, genToSrc } = buildLineMap(result.reverseMap, headerLines);
    const prev = compiled.get(filePath);

    compiled.set(filePath, {
      version: (prev?.version || 0) + 1,
      source, tsContent, headerLines, srcToGen, genToSrc,
    });

    connection.console.log(`[rip] compiled ${path.basename(filePath)}: ${tsContent.length} chars, ${srcToGen.size} mapped lines`);
  } catch (e) {
    connection.console.log(`[rip] compile error ${path.basename(filePath)}: ${e.message}`);
  }
}

// ── TypeScript Language Service ────────────────────────────────────

function createService() {
  const settings = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowJs: true,
    strict: false,
    noEmit: true,
    skipLibCheck: true,
  };

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

// ── Position mapping ───────────────────────────────────────────────

function buildLineMap(reverseMap, headerLines) {
  const srcToGen = new Map();
  const genToSrc = new Map();
  if (reverseMap) {
    for (const [srcLine, { genLine }] of reverseMap) {
      const adj = genLine + headerLines;
      srcToGen.set(srcLine, adj);
      genToSrc.set(adj, srcLine);
    }
  }
  return { srcToGen, genToSrc };
}

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

function countLines(t) { let n = 0; for (let i = 0; i < t.length; i++) if (t[i] === '\n') n++; return n; }
function lineColToOffset(t, line, col) { let r = 0; for (let i = 0; i < t.length; i++) { if (r === line) return i + col; if (t[i] === '\n') r++; } return t.length; }
function offsetToLineCol(t, o) { let line = 0, ls = 0; for (let i = 0; i < o && i < t.length; i++) { if (t[i] === '\n') { line++; ls = i + 1; } } return { line, character: o - ls }; }
function uriToPath(u) { try { return decodeURIComponent(new URL(u).pathname); } catch { return u; } }
function pathToUri(p) { return 'file://' + p; }

// ── LSP handlers ───────────────────────────────────────────────────

connection.onCompletion((params) => {
  if (!service) return [];
  const fp = uriToPath(params.textDocument.uri);
  if (!fp.endsWith('.rip')) return [];
  const offset = srcToOffset(fp, params.position.line, params.position.character);
  if (offset === undefined) return [];

  connection.console.log(`[rip] completion ${params.position.line}:${params.position.character} → offset ${offset}`);
  try {
    const r = service.getCompletionsAtPosition(toVirtual(fp), offset, { includeExternalModuleExports: true, includeInsertTextCompletions: true });
    if (!r) return [];
    connection.console.log(`[rip] → ${r.entries.length} items, first 5: ${r.entries.slice(0, 5).map(e => e.name + '(' + e.kind + ')').join(', ')}`);
    return {
      isIncomplete: false,
      items: r.entries.map((e) => ({ label: e.name, kind: tsToLspKind(e.kind), detail: e.kind, sortText: e.sortText })),
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
    const info = service.getQuickInfoAtPosition(toVirtual(fp), offset);
    if (!info) return null;
    const display = ts.displayPartsToString(info.displayParts);
    const docs = ts.displayPartsToString(info.documentation || []);
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
    const defs = service.getDefinitionAtPosition(toVirtual(fp), offset);
    if (!defs) return null;
    return defs.map((d) => {
      const realPath = isVirtual(d.fileName) ? fromVirtual(d.fileName) : d.fileName;
      const pos = compiled.has(realPath)
        ? genToSrcPos(realPath, d.textSpan.start)
        : offsetToLineCol(fs.readFileSync(d.fileName, 'utf8'), d.textSpan.start);
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
  property: 10, getter: 10, setter: 10, 'JSX attribute': 10,
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
