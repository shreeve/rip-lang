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

let ts, compiler, tc, rootPath, documentRegistry;

// Per-project TypeScript language services keyed by project root path.
// Files outside any detected project root share the '' bucket.  All
// services share one DocumentRegistry so parsed SourceFiles are dedup'd
// across projects (the canonical tsserver pattern).
const services = new Map();
// Programs we've already patched (uninitialized-type fix-up).  Each
// service has its own program, so a WeakSet keyed on the Program object
// avoids redoing work without us tracking per-service state.
const patchedPrograms = new WeakSet();

// Log paths relative to the workspace root so files like `index.rip` are
// distinguishable. Falls back to the basename if the path is outside root.
function relPath(filePath) {
  if (!rootPath) return path.basename(filePath);
  const r = path.relative(rootPath, filePath);
  return r.startsWith('..') ? filePath : r;
}

// Real .rip path → { version, source, tsContent, srcToGen, genToSrc, ... }
const compiled = new Map();

// Real .rip path → most recently published Diagnostic[] (used by the
// "Add all missing imports" code action to look beyond the requested range).
const lastDiagnostics = new Map();

// Project root → Map<componentName, { props, source, line, ... }>.
// Scoped per project so two unrelated apps that both define a `Button`
// component don't shadow each other across editor windows. Files outside
// any project root share the '' bucket.
const componentRegistries = new Map();
function getComponentRegistry(filePath) {
  const key = findProjectRoot(filePath) || '';
  let reg = componentRegistries.get(key);
  if (!reg) { reg = new Map(); componentRegistries.set(key, reg); }
  return reg;
}
function removeFromComponentRegistry(filePath) {
  const reg = getComponentRegistry(filePath);
  for (const [name, info] of reg) {
    if (info.source === filePath) reg.delete(name);
  }
}

// Per-directory project config cache (dir → { strict, checkAll, exclude, ... })
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
  // Synthetic — never produced by TS. The remap assigns it to a render-block
  // boolean flag (`Button disabled` on its own line) so package.json's
  // semanticTokenScopes can paint it like entity.other.attribute-name, i.e.
  // the same colour as an inline flag/`key:` that TextMate already handles.
  'attribute',      // 13
];
const LEGEND_ATTRIBUTE = 13;

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

  ts = loadTypeScript();
  connection.console.log(`[rip] TypeScript ${ts ? ts.version : 'NOT FOUND'}`);

  if (ts && compiler && tc) {
    documentRegistry = ts.createDocumentRegistry();
    connection.console.log('[rip] language services ready (lazy per-project)');
  }

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      completionProvider: {
        triggerCharacters: ['.', '"', "'", '/', ':', ' ', '@'],
        resolveProvider: true,
      },
      hoverProvider: true,
      definitionProvider: true,
      signatureHelpProvider: { triggerCharacters: ['(', ','] },
      codeActionProvider: { codeActionKinds: ['quickfix'] },
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
      { globPattern: '**/package.json' },
      { globPattern: '**/*.rip' },
    ],
  });
  connection.console.log('[rip] ready');
  if (compiler && tc) indexWorkspaceRipFiles();
});

connection.onDidChangeWatchedFiles((params) => {
  let cfgChanged = false;
  for (const change of (params.changes || [])) {
    const fp = uriToPath(change.uri);
    if (fp.endsWith('.rip')) {
      // Route file create/delete is handled by the native fs.watch
      // installed in indexWorkspaceRipFiles — VS Code's watcher delivery
      // is too slow (2–10s on macOS) to be useful for that case.
      if (change.type === 3 /* Deleted */) {
        compiled.delete(fp);
        lastDiagnostics.delete(fp);
        discoveredRipFiles.delete(fp);
        removeFromIndex(fp);
        removeFromComponentRegistry(fp);
        connection.sendDiagnostics({ uri: change.uri, diagnostics: [] });
      } else if (change.type === 1 /* Created */) {
        discoveredRipFiles.add(fp);
        if (exportIndexBuilt) updateExportIndexFor(fp);
      } else if (compiled.has(fp) && compiler && tc) {
        // Only recompile files we already have in `compiled` (i.e. open or
        // previously imported). Untouched discovered files stay lazy.
        try { compileRip(fp, fs.readFileSync(fp, 'utf8')); } catch {}
        if (exportIndexBuilt) updateExportIndexFor(fp);
      } else if (exportIndexBuilt && discoveredRipFiles.has(fp)) {
        updateExportIndexFor(fp);
      }
    } else {
      cfgChanged = true;
    }
  }
  if (cfgChanged) {
    configCache.clear();
    // Settings (strict, checkAll, ambient types) are project-scoped, so a
    // package.json change can invalidate any service. Dispose each one so
    // its DocumentRegistry refcounts drop before we drop our references.
    for (const svc of services.values()) {
      try { svc.dispose?.(); } catch {}
    }
    services.clear();
    rebuildProjectInfo();
    for (const fp of compiled.keys()) publishDiagnostics(fp);
  }
});

// Coalesce route refreshes — a single file rename fires Delete + Create,
// and watcher debouncing in VS Code can deliver them in separate batches.
let _routeRefreshTimer = null;
const _routeRefreshDirs = new Set();
function scheduleRouteRefresh(dirs) {
  for (const d of dirs) _routeRefreshDirs.add(d);
  if (_routeRefreshTimer) return;
  _routeRefreshTimer = setTimeout(() => {
    _routeRefreshTimer = null;
    const dirs = new Set(_routeRefreshDirs);
    _routeRefreshDirs.clear();
    // Only refresh files with an open editor that actually reference
    // routes (`href:` on an anchor, or `router.push/replace`). Files
    // without route references can't change their diagnostics from a
    // route rename, and recompile+TS-diagnostics each cost ~400ms.
    const ROUTE_REF_RE = /\bhref\s*:|\brouter\s*\.\s*(?:push|replace)\b/;
    const affected = [];
    for (const fp of compiled.keys()) {
      const doc = documents.get(pathToUri(fp));
      if (!doc) continue;
      const dir = tc.findRoutesDir?.(fp);
      if (!dir || !dirs.has(dir)) continue;
      if (!ROUTE_REF_RE.test(doc.getText())) continue;
      affected.push(fp);
    }
    // Put the most-recently-edited file first so the user sees its
    // diagnostic update before background files.
    affected.sort((a, b) => (lastEditAt.get(b) || 0) - (lastEditAt.get(a) || 0));
    connection.console.log(`[rip] route refresh fired: ${affected.length} route-using file(s) in ${dirs.size} project(s)`);
    for (const fp of affected) {
      try {
        const doc = documents.get(pathToUri(fp));
        compileRip(fp, doc.getText());
        publishDiagnostics(fp);
      } catch {}
    }
  }, 100);
}

// Tracks the last edit timestamp per file so route refreshes can publish
// the most-recently-edited file first. Updated by onDidChangeContent.
const lastEditAt = new Map();

// Rebuild project-root + workspace-package info by re-walking the workspace.
// Only inspects directory entries (no .rip indexing), so it's cheap.
function rebuildProjectInfo() {
  projectRoots.clear();
  projectRootCache.clear();
  bareSpecForEntry.clear();
  entryForBareSpec.clear();
  declaredDepsCache.clear();
  (function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (ent.isFile() && ent.name === 'package.json') loadPackageJson(dir);
    }
    for (const ent of entries) {
      if (INDEX_SKIP_DIRS.has(ent.name)) continue;
      if (ent.isDirectory()) walk(path.join(dir, ent.name));
    }
  })(rootPath);
  // Re-register declared node_modules .rip dependencies (a package.json edit may
  // have added or removed one). Skipping this would drop their bare-specifier
  // entries until the next restart.
  indexNodeModulesRipDeps();
}

// Workspace .rip files discovered by a fast directory walk. Stored as paths
// only — they are NOT added to the TypeScript Program (doing so would force
// TS to compile each one when building diagnostics, which dominates startup).
// Instead we maintain our own lightweight export index used to produce
// auto-import suggestions, mirroring how TS's AutoImportProviderProject works
// for .ts files.
const discoveredRipFiles = new Set();

// Map<exportedName, Set<absoluteFilePath>> — built lazily on first request and
// kept fresh by onDidChangeWatchedFiles. Built by regex-scanning .rip sources
// (no compilation), so 1000s of files take <100ms.
const exportIndex = new Map();
const exportIndexByFile = new Map(); // Map<fp, Set<name>> for incremental updates
let exportIndexBuilt = false;

// Project-scoping data — populated alongside discovery. A project root is any
// directory containing a `package.json`. Files in different
// projects may not auto-import each other via relative paths.
const projectRoots = new Set();          // Set<dir>
const projectRootCache = new Map();      // Map<dir, projectRoot|null>
// Files that are the entry point of a workspace package, mapped to the bare
// specifier callers should use (e.g. '@rip-lang/server', '@rip-lang/server/middleware').
const bareSpecForEntry = new Map();      // Map<fp, bareSpec>
const entryForBareSpec = new Map();      // Map<bareSpec, fp> — reverse of above, used to resolve bare imports

function findProjectRoot(fp) {
  const dir = path.dirname(fp);
  if (projectRootCache.has(dir)) return projectRootCache.get(dir);
  let cur = dir;
  while (cur && cur.length >= rootPath.length) {
    if (projectRoots.has(cur)) {
      projectRootCache.set(dir, cur);
      return cur;
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  projectRootCache.set(dir, null);
  return null;
}

// Read a package.json and register its entry points (from `exports` or `main`)
// as bare-specifier targets. Subpath exports become `name + subpath.slice(1)`,
// e.g. exports['./middleware'] of '@rip-lang/server' -> '@rip-lang/server/middleware'.
function loadPackageJson(dir) {
  projectRoots.add(dir);
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch { return; }
  if (!pkg.name) return;
  const addEntry = (sub, target) => {
    if (typeof target !== 'string') {
      // Conditional exports object — prefer default/import/require.
      target = target?.default || target?.import || target?.require;
    }
    if (typeof target !== 'string' || !target.endsWith('.rip')) return;
    const full = path.resolve(dir, target);
    const spec = sub === '.' ? pkg.name : pkg.name + sub.slice(1);
    bareSpecForEntry.set(full, spec);
    entryForBareSpec.set(spec, full);
  };
  if (pkg.exports && typeof pkg.exports === 'object') {
    for (const [sub, target] of Object.entries(pkg.exports)) addEntry(sub, target);
  } else if (typeof pkg.exports === 'string') {
    addEntry('.', pkg.exports);
  } else if (typeof pkg.main === 'string') {
    addEntry('.', pkg.main);
  }
}

// Resolve a bare specifier (`@rip-lang/server`, `@rip-lang/server/middleware`,
// or an unscoped `foo/bar`) to a `.rip` entry installed under node_modules.
// Discovery skips node_modules (INDEX_SKIP_DIRS), so packages installed there as
// declared dependencies (rather than workspace members) never land in
// entryForBareSpec. Resolve them on demand by walking up from the importing file,
// mirroring loadPackageJson's exports/main → `.rip` mapping for a single subpath.
// Returns an absolute `.rip` path, or null if nothing resolves (so the caller
// falls through to ordinary TypeScript module resolution).
function resolveNodeModulesRipEntry(name, containingFile) {
  const parts = name.split('/');
  const pkgName = name.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  const sub = name.length > pkgName.length ? '.' + name.slice(pkgName.length) : '.';

  let dir = path.dirname(containingFile);
  while (true) {
    const pkgDir = path.join(dir, 'node_modules', pkgName);
    const pkgJsonPath = path.join(pkgDir, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      let pkg;
      try { pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')); } catch { return null; }
      let target;
      if (pkg.exports && typeof pkg.exports === 'object') {
        let t = pkg.exports[sub];
        if (t && typeof t !== 'string') t = t.default || t.import || t.require;
        target = t;
      } else if (sub === '.' && typeof pkg.exports === 'string') {
        target = pkg.exports;
      } else if (sub === '.' && typeof pkg.main === 'string') {
        target = pkg.main;
      }
      if (typeof target !== 'string' || !target.endsWith('.rip')) return null;
      const full = path.resolve(pkgDir, target);
      return fs.existsSync(full) ? full : null;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null; // reached filesystem root
    dir = parent;
  }
}

function scanExports(source) {
  const names = new Set();
  const lines = source.split('\n');
  for (const raw of lines) {
    // Strip trailing `#` comments, but ignore `#` inside string literals.
    let line = raw;
    let inS = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inS) {
        if (ch === '\\') { i++; continue; }
        if (ch === inS) inS = null;
      } else if (ch === '"' || ch === "'") {
        inS = ch;
      } else if (ch === '#') {
        line = line.slice(0, i);
        break;
      }
    }
    let m;
    if ((m = /^\s*export\s+def\s+([A-Za-z_$][\w$]*)!?/.exec(line))) names.add(m[1]);
    else if ((m = /^\s*export\s+class\s+([A-Za-z_$][\w$]*)/.exec(line))) names.add(m[1]);
    else if ((m = /^\s*export\s+(?:abstract\s+)?(?:async\s+)?(?:function|const|let|var|type|interface|enum)\s+([A-Za-z_$][\w$]*)/.exec(line))) names.add(m[1]);
    else if ((m = /^\s*export\s+([A-Za-z_$][\w$]*)\s*(?:<[^=]*>)?\s*=/.exec(line))) names.add(m[1]);
    else if ((m = /^\s*export\s*\{([^}]+)\}/.exec(line))) {
      for (const part of m[1].split(',')) {
        const id = part.trim().split(/\s+as\s+/i).pop();
        if (id && /^[A-Za-z_$][\w$]*$/.test(id)) names.add(id);
      }
    }
  }
  return names;
}

function removeFromIndex(fp) {
  const old = exportIndexByFile.get(fp);
  if (!old) return;
  for (const name of old) {
    const set = exportIndex.get(name);
    if (!set) continue;
    set.delete(fp);
    if (!set.size) exportIndex.delete(name);
  }
  exportIndexByFile.delete(fp);
}

function addToIndex(fp, names) {
  exportIndexByFile.set(fp, names);
  for (const name of names) {
    let set = exportIndex.get(name);
    if (!set) { set = new Set(); exportIndex.set(name, set); }
    set.add(fp);
  }
}

function updateExportIndexFor(fp) {
  removeFromIndex(fp);
  let source;
  try { source = fs.readFileSync(fp, 'utf8'); } catch { return; }
  addToIndex(fp, scanExports(source));
}

function ensureExportIndex() {
  if (exportIndexBuilt) return;
  exportIndexBuilt = true;
  const start = Date.now();
  for (const fp of discoveredRipFiles) updateExportIndexFor(fp);
  connection.console.log(`[rip] export index built: ${exportIndex.size} symbol(s) across ${discoveredRipFiles.size} file(s) in ${Date.now() - start}ms`);
}
const INDEX_SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.cache', '.next', 'out',
  'coverage', '.turbo', '.parcel-cache', '.bun', 'tmp', 'temp',
]);
function indexWorkspaceRipFiles() {
  const start = Date.now();
  let count = 0;
  (function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (ent.isFile() && ent.name === 'package.json') loadPackageJson(dir);
    }
    for (const ent of entries) {
      if (INDEX_SKIP_DIRS.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && ent.name.endsWith('.rip')) {
        discoveredRipFiles.add(full);
        count++;
      }
    }
  })(rootPath);
  indexNodeModulesRipDeps();
  connection.console.log(`[rip] discovered ${count} .rip file(s), ${projectRoots.size} project(s), ${bareSpecForEntry.size} package entrypoint(s) in ${Date.now() - start}ms`);
  // Install native fs.watch on every discovered routes dir. VS Code's
  // workspace/didChangeWatchedFiles can take 2–10s on macOS to deliver
  // a rename — FSEvents via fs.watch delivers in <100ms.
  for (const fp of discoveredRipFiles) {
    if (/[/\\]app[/\\]routes[/\\]/.test(fp)) {
      const dir = tc.findRoutesDir?.(fp);
      if (dir) watchRoutesDir(dir);
    }
  }
}

// Index the entry-point `.rip` files of declared dependencies installed under
// node_modules. The workspace walk skips node_modules (INDEX_SKIP_DIRS) for
// speed, so `.rip` packages installed as ordinary dependencies — rather than
// workspace members living in the tree — never reach the export index, and
// their public symbols can't be auto-imported (e.g. `RouteHandler` from
// `@rip-lang/server`). For each project's declared deps that ship a `.rip`
// entry point, register its bare specifier and index that entry's exports.
function indexNodeModulesRipDeps() {
  const seen = new Set();
  for (const projRoot of [...projectRoots]) {
    const deps = declaredDepsFor(projRoot);
    if (!deps) continue;
    for (const depName of deps) {
      // Resolve node_modules/<depName> by walking up from the project root.
      let dir = projRoot, pkgDir = null;
      while (true) {
        const cand = path.join(dir, 'node_modules', depName);
        if (fs.existsSync(path.join(cand, 'package.json'))) { pkgDir = cand; break; }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      // Keep the symlink path (under rootPath) rather than its realpath so
      // findProjectRoot — which walks up checking projectRoots — still resolves.
      if (!pkgDir || !pkgDir.startsWith(rootPath) || seen.has(pkgDir)) continue;
      seen.add(pkgDir);
      // Skip workspace members already indexed via their real path (a monorepo
      // node_modules entry symlinked back into the tree); only external deps
      // whose source lives outside the workspace need this pass.
      let real;
      try { real = fs.realpathSync(pkgDir); } catch { real = pkgDir; }
      if (real.startsWith(rootPath) && !real.includes(`${path.sep}node_modules${path.sep}`)) continue;
      let depPkg;
      try { depPkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')); } catch { continue; }
      // Collect `.rip` entry-point files from exports/main.
      const entryFiles = new Set();
      const collect = (target) => {
        if (target && typeof target !== 'string') target = target.default || target.import || target.require;
        if (typeof target === 'string' && target.endsWith('.rip')) {
          const full = path.resolve(pkgDir, target);
          if (fs.existsSync(full)) entryFiles.add(full);
        }
      };
      if (depPkg.exports && typeof depPkg.exports === 'object') for (const t of Object.values(depPkg.exports)) collect(t);
      else if (typeof depPkg.exports === 'string') collect(depPkg.exports);
      else if (typeof depPkg.main === 'string') collect(depPkg.main);
      if (!entryFiles.size) continue;
      loadPackageJson(pkgDir);                 // register bare specifiers for entries
      for (const f of entryFiles) {
        discoveredRipFiles.add(f);
        // At startup the index isn't built yet (ensureExportIndex scans
        // discoveredRipFiles lazily); on a package.json-driven rebuild it is,
        // so index the newly-registered entry immediately.
        if (exportIndexBuilt) updateExportIndexFor(f);
      }
    }
  }
}

// Native fs.watch on each known routes dir. Keyed by dir so we install
// at most one watcher per project even if many files map to it.
const routesWatchers = new Map();
function watchRoutesDir(dir) {
  if (routesWatchers.has(dir)) return;
  try {
    const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
      if (!filename || !filename.endsWith('.rip')) return;
      const full = path.join(dir, filename);
      // Mirror the bookkeeping that onDidChangeWatchedFiles does for
      // route file create/delete, then schedule the refresh. We don't
      // know create vs delete from fs.watch — checking existence is
      // cheap and reliable.
      const exists = fs.existsSync(full);
      if (exists) {
        discoveredRipFiles.add(full);
      } else {
        compiled.delete(full);
        lastDiagnostics.delete(full);
        discoveredRipFiles.delete(full);
        removeFromIndex(full);
        removeFromComponentRegistry(full);
        connection.sendDiagnostics({ uri: pathToUri(full), diagnostics: [] });
      }
      tc.invalidateRoutesCache?.();
      connection.console.log(`[rip] fs.watch route change: ${path.relative(rootPath, full)} (${exists ? 'create/modify' : 'delete'})`);
      scheduleRouteRefresh(new Set([dir]));
    });
    watcher.on('error', () => { routesWatchers.delete(dir); });
    routesWatchers.set(dir, watcher);
  } catch {}
}


// Lazily compile a .rip file for the TS Program without publishing diagnostics
// (used when TS asks for a snapshot of a file the user isn't editing).
connection.onDidChangeConfiguration(async () => {
  for (const fp of compiled.keys()) publishDiagnostics(fp);
});

// ── Document sync ──────────────────────────────────────────────────

documents.onDidChangeContent(({ document }) => {
  const fp = uriToPath(document.uri);
  if (fp.endsWith('.rip') && compiler && tc) {
    lastEditAt.set(fp, Date.now());
    compileRip(fp, document.getText());
  }
});

documents.onDidClose(({ document }) => {
  const fp = uriToPath(document.uri);
  compiled.delete(fp);
  lastDiagnostics.delete(fp);
  lastEditAt.delete(fp);
  connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
});

// Effective per-file strict/checkAll, honoring the project's exclude globs.
// Both flags collapse to false for excluded files.
function getFileProfile(filePath) {
  const config = getProjectConfig(filePath);
  const strict   = config.strict === true;
  const checkAll = config.checkAll === true;
  if (!strict && !checkAll) return { strict: false, checkAll: false };
  if (config._configDir && Array.isArray(config.exclude)) {
    const rel = path.relative(config._configDir, filePath);
    if (config.exclude.some(glob => tc.globToRegex(glob).test(rel))) {
      return { strict: false, checkAll: false };
    }
  }
  return { strict, checkAll };
}

function compileRip(filePath, source) {
  try {
    const profile = getFileProfile(filePath);
    const entry = tc.compileForCheck(filePath, source, compiler, profile);
    const prev = compiled.get(filePath);
    // A file's "type surface" is normally its emitted .d.ts — changing a
    // function body leaves it identical, so dependents needn't refresh. The
    // unannotated stash is the exception: consumers get its type via
    // `export type __RipStash = typeof stash`, which resolves against the
    // stash's tsContent (its runtime shape), NOT its .d.ts. Editing a source's
    // param/return type changes that shape but leaves the .d.ts text constant,
    // so gate the stash's dependent-refresh on its tsContent too — otherwise
    // open dependents keep TypeScript's cached `typeof stash` resolution until
    // a full window reload.
    const isStashFile = tc.findStashFile?.(filePath) === filePath;
    const surfaceChanged = (prev?.dts || '') !== (entry.dts || '')
      || (isStashFile && (prev?.tsContent || '') !== (entry.tsContent || ''));

    compiled.set(filePath, {
      version: (prev?.version || 0) + 1,
      ...entry,
    });

    if (entry.dts) {
      const reg = getComponentRegistry(filePath);
      updateComponentRegistry(reg, filePath, source, entry.dts);
      // Eagerly populate intrinsic props cache so value completions work
      // even after later compilation failures (e.g. `type:` with no value).
      try {
        for (const [name, info] of reg) {
          if (info.source === filePath && info.inheritsTag) {
            const ownPropNames = new Set(info.props.map(p => p.name));
            resolveIntrinsicProps(reg, name, ownPropNames);
          }
        }
      } catch (e) {
        connection.console.log(`[rip] intrinsic props error ${relPath(filePath)}: ${e.message}`);
      }
    }

    connection.console.log(`[rip] compiled ${relPath(filePath)}: hasTypes=${entry.hasTypes}, headerLines=${entry.headerLines}`);
    publishDiagnostics(filePath);

    // Republish dependents only when this file's public surface (dts) actually
    // changed — typing inside a function body leaves the dts identical, so the
    // common case skips the loop entirely.  When it does change, schedule a
    // debounced pass over *open* documents only (closed files don't need
    // squiggles refreshed; the next open will recompute).
    if (surfaceChanged) scheduleDependentRepublish(filePath);
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
    if (!isInNodeModules(filePath)) connection.sendDiagnostics({ uri: pathToUri(filePath), diagnostics });
    connection.console.log(`[rip] compile error ${relPath(filePath)}: ${e.message}`);
  }
}

// Trailing-debounced republish of dependent files.  When a file's dts changes
// we want other open files to revalidate, but a rapid burst of keystrokes
// shouldn't trigger N full diagnostics passes.
//
// Pull-based: only files that are *open* in the editor are republished.
// Closed files don't show squiggles anyway and will recompute on next open.
//
// We recompile (not just republish) dependents so their version bumps and
// TypeScript invalidates its cached cross-file symbol resolution. Without
// the version bump, TS reuses stale parse/binder state built against the
// previous version of the changed file, which has been observed to produce
// spurious diagnostics ("Cannot find name 'retur'" etc.) until the user
// manually edits the dependent.
const DEPENDENT_REPUBLISH_DELAY_MS = 250;
const pendingRepublish = new Set(); // Set<changedFilePath>
let republishTimer = null;
function scheduleDependentRepublish(changedPath) {
  pendingRepublish.add(changedPath);
  if (republishTimer) return;
  republishTimer = setTimeout(() => {
    republishTimer = null;
    const changed = new Set(pendingRepublish);
    pendingRepublish.clear();
    for (const doc of documents.all()) {
      const fp = uriToPath(doc.uri);
      if (changed.has(fp)) continue; // already published immediately
      if (!compiled.has(fp)) continue;
      if (fp.endsWith('.rip') && compiler && tc) {
        compileRip(fp, doc.getText()); // bumps version, invalidates TS caches
      } else {
        publishDiagnostics(fp);
      }
    }
  }, DEPENDENT_REPUBLISH_DELAY_MS);
}

// Dependency sources (anything under a node_modules segment) are compiled so
// imports resolve to their types, but they are external code — never report
// diagnostics for them, nor check them under the consuming project's config.
function isInNodeModules(filePath) {
  return /[\\/]node_modules[\\/]/.test(filePath);
}

function publishDiagnostics(filePath) {
  if (isInNodeModules(filePath)) return;
  const c = compiled.get(filePath);
  if (!c) return;

  const diagnostics = [];

  // TypeScript diagnostics (typed files with TS service)
  const svc = c.hasTypes ? getServiceFor(filePath) : null;
  if (svc && c.hasTypes) {
    try {
      patchTypes(svc);
      const vf = toVirtual(filePath);
      const semanticDiags = svc.getSemanticDiagnostics(vf);
      const syntacticDiags = svc.getSyntacticDiagnostics(vf);
      const suggestionDiags = svc.getSuggestionDiagnostics(vf);
      const allDiags = [...syntacticDiags, ...semanticDiags, ...suggestionDiags];

      // Byte offset where the injected DTS header ends. The header declares
      // ambient globals (abort, schema, SchemaError, …) that a given file
      // usually doesn't reference, so TS's suggestion pass flags each as
      // "declared but never read". They're compiler-injected, not user code,
      // and stay silent only because the source has no matching token to map
      // them onto — until an injected name collides with a real one (e.g. the
      // `schema` keyword), where the text-search mapper lands the hint on it.
      let headerEndOffset = 0;
      if (c.headerLines > 0) {
        let nl = 0;
        for (let j = 0; j < c.tsContent.length; j++) {
          if (c.tsContent[j] === '\n' && ++nl === c.headerLines) { headerEndOffset = j + 1; break; }
        }
      }

      for (const d of allDiags) {
        if (d.start === undefined) continue;
        if (tc.SKIP_CODES.has(d.code)) continue;

        // Drop unused-declaration suggestions originating in the injected DTS
        // header — those declarations are synthetic ambients, never user code.
        if ((d.code === 6133 || d.code === 6196) && d.start < headerEndOffset) continue;

        // Conditional suppression — narrowed instead of blanket
        if (tc.CONDITIONAL_CODES?.has(d.code)) {
          const flatMsg = d.code === 2307 ? ts.flattenDiagnosticMessageText(d.messageText, '\n') : null;
          if (tc.shouldSuppressConditional(d.code, d.start, d.length, c.tsContent, c.headerLines, c.dts, flatMsg, filePath, d.relatedInformation)) continue;
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
        if (!startRaw) continue;

        // Drop diagnostics that map beyond the source file (e.g. from component
        // stubs where the compiled line has no real source counterpart).
        if (c.source) {
          const sourceLineCount = c.source.split('\n').length;
          if (startRaw.line >= sourceLineCount) continue;
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

        // 2300/2451 (Duplicate identifier) on import lines: the compiler does
        // not emit per-name source-map entries for import specifiers, so every
        // duplicate imported name collapses onto the same source position and
        // gets deduped away. Remap by finding the Nth body-import in tsContent
        // and the matching Nth import in the source, then locating the named
        // identifier inside that statement's `{ ... }` list.
        if ((d.code === 2300 || d.code === 2451) && c.source && d.length) {
          const tsLineStart = c.tsContent.lastIndexOf('\n', d.start - 1) + 1;
          const tsLineEnd = c.tsContent.indexOf('\n', d.start);
          const tsLine = c.tsContent.slice(tsLineStart, tsLineEnd === -1 ? undefined : tsLineEnd);
          if (/^\s*import\b/.test(tsLine)) {
            const ident = c.tsContent.substring(d.start, d.start + d.length);
            // Count body-imports preceding this one (1-based index).
            let bodyImportIdx = 0;
            const tsLineNum = tc.offsetToLine(c.tsContent, d.start);
            const tsLines = c.tsContent.split('\n');
            for (let i = c.headerLines; i <= tsLineNum; i++) {
              if (/^\s*import\b/.test(tsLines[i] || '')) bodyImportIdx++;
            }
            // Walk the source for the Nth import and find the identifier within
            // the multi-line spec list.
            const srcImportRe = /^[ \t]*import\s+(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([\s\S]*?)\}\s+from\s+['"][^'"]+['"]/gm;
            let sm, srcImportIdx = 0;
            while ((sm = srcImportRe.exec(c.source))) {
              srcImportIdx++;
              if (srcImportIdx !== bodyImportIdx) continue;
              const bracesStart = sm.index + sm[0].indexOf('{') + 1;
              const bracesEnd = bracesStart + sm[1].length;
              const inner = c.source.substring(bracesStart, bracesEnd);
              const nameRe = new RegExp('\\b' + ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
              const im = inner.match(nameRe);
              if (im) {
                const absOffset = bracesStart + im.index;
                const before = c.source.slice(0, absOffset);
                const newlineCount = (before.match(/\n/g) || []).length;
                const lastNewline = before.lastIndexOf('\n');
                const newLine = newlineCount;
                const newCol = absOffset - (lastNewline + 1);
                startPos.line = newLine;
                startPos.character = newCol;
                endPos.line = newLine;
                endPos.character = newCol + ident.length;
              }
              break;
            }
          }
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

        const rawMessage = tc.cleanDiagnosticMessage(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
        const { code, message } = tc.unifyRouteDiagnostic(d.code, rawMessage, c, d.start, filePath);

        // Snap route diagnostics to the meaningful token (`href` / `push`).
        if (c.source && tc.locateRouteDiagnosticSpan) {
          const srcLineText = tc.getLineText(c.source, startPos.line);
          const routeSpan = tc.locateRouteDiagnosticSpan(c, d.start, srcLineText);
          if (routeSpan) {
            startPos.character = routeSpan.col;
            endPos.line = startPos.line;
            endPos.character = routeSpan.col + routeSpan.len;
          }
        }
        const tags = [];
        if (d.reportsUnnecessary) tags.push(1);
        if (d.reportsDeprecated) tags.push(2);
        diagnostics.push({
          range: { start: startPos, end: endPos },
          severity: d.category === 1 ? 1 : d.category === 0 ? 2 : d.category === 2 ? 4 : 3,
          code,
          source: 'rip',
          message,
          tags: tags.length > 0 ? tags : undefined,
        });
      }
    } catch (e) {
      connection.console.log(`[rip] diagnostics error: ${e.message}`);
    }
  }

  // Component prop diagnostics (typed files only). Use the per-project
  // registry so a Button defined in another project (open in another tab)
  // can't shadow this file's Button.
  const projectRegistry = getComponentRegistry(filePath);
  if (c.hasTypes && c.source && projectRegistry.size > 0) {
    const srcLines = c.source.split('\n');
    for (let i = 0; i < srcLines.length; i++) {
      const usage = tc.collectUsageProps(srcLines, i, projectRegistry);
      if (!usage) continue;
      const info = projectRegistry.get(usage.component);
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
    for (const [name, compDef] of projectRegistry) {
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

  // Render gates (<~) must resolve to source() keys in app/stash.rip —
  // the same validation `rip check` runs (collectGateDiagnostics), live
  // in the editor. The stash compiles lazily here if TS hasn't already
  // pulled it in via module resolution.
  if (c.gates?.length && c.source && tc.collectGateDiagnostics && tc.collectStashAnalysis) {
    try {
      const stashFile = tc.findStashFile(filePath);
      if (stashFile && stashFile !== filePath) {
        if (!compiled.has(stashFile) && fs.existsSync(stashFile)) {
          compileRip(stashFile, fs.readFileSync(stashFile, 'utf8'));
        }
        const stashEntry = compiled.get(stashFile);
        const analysis = stashEntry?.sexpr ? tc.collectStashAnalysis(stashEntry.sexpr) : null;
        for (const d of tc.collectGateDiagnostics(c.gates, c.source, analysis)) {
          diagnostics.push({
            range: {
              start: { line: d.line - 1, character: d.col - 1 },
              end: { line: d.line - 1, character: d.col - 1 + d.len },
            },
            severity: 1,
            source: 'rip',
            message: d.message,
          });
        }
      }
    } catch (e) {
      connection.console.log(`[rip] gate validation error ${relPath(filePath)}: ${e.message}`);
    }
  }

  // Dedup: same diagnostic can map twice when the dts header and compiled
  // body both contain the offending construct (e.g. an `import { X }` line).
  const deduped = tc.dedupDiagnostics(diagnostics, d => ({
    startLine: d.range.start.line, startCol: d.range.start.character,
    endLine: d.range.end.line, endCol: d.range.end.character,
  }));

  connection.sendDiagnostics({ uri: pathToUri(filePath), diagnostics: deduped });
  lastDiagnostics.set(filePath, deduped);
  connection.console.log(`[rip] diagnostics ${relPath(filePath)}: ${diagnostics.length} issues`);
}

// ── TypeScript Language Service ────────────────────────────────────
//
// One LanguageService per project root (nearest ancestor package.json).
// Settings — most importantly `strict` — are read from the project's
// `package.json#rip` block, so a strict project surfaces noImplicitAny /
// strictNullChecks the same way `rip check` does, while a sibling lenient
// project keeps its quieter editor experience. All services share one
// DocumentRegistry so duplicate SourceFiles aren't parsed twice.
//
// Files outside any detected project root land in the '' bucket and use
// a lenient (non-strict) default service.

// Look up (or lazy-create) the service responsible for `filePath`.
//
// Each service carries its own TypeScript type-checker. SourceFiles are shared
// via the DocumentRegistry, so the JS heap per extra service is small, but each
// still costs ~0.6 GB RSS (mapped lib/DOM/@types). Left unbounded, a service
// accumulates per project the user visits, so browsing a large monorepo holds
// several GB of RSS. We cap that footprint: services whose project has an open
// editor tab are never evicted (evicting them would re-typecheck on every
// cross-tab operation); among truly-idle services we keep MAX_IDLE_SERVICES
// warm and dispose the rest, LRU-first. The warm buffer trades that RSS for
// instant switching back to a recently-used project (a cold re-create costs a
// ~1s re-typecheck).
const MAX_IDLE_SERVICES = 2;
function getServiceFor(filePath) {
  if (!ts || !compiler || !tc) return null;
  const key = (filePath && findProjectRoot(filePath)) || '';
  let svc = services.get(key);
  if (svc) {
    // Bump to most-recently-used (Map preserves insertion order).
    services.delete(key);
    services.set(key, svc);
    return svc;
  }
  svc = createService(key || null);
  services.set(key, svc);
  evictIdleServices(key);
  return svc;
}

// Dispose idle services (no open file in their project) beyond the warm buffer,
// LRU-first. `keepKey` is the just-accessed service, never evicted.
function evictIdleServices(keepKey) {
  if (services.size <= MAX_IDLE_SERVICES + 1) return;
  const openRoots = new Set();
  for (const doc of documents.all()) {
    openRoots.add(findProjectRoot(uriToPath(doc.uri)) || '');
  }
  let idleKept = 0;
  // Iterate LRU→MRU (insertion order); evict idle services past the buffer.
  for (const k of [...services.keys()]) {
    if (k === keepKey || openRoots.has(k)) continue; // active — never evict
    if (idleKept < MAX_IDLE_SERVICES) { idleKept++; continue; }
    const s = services.get(k);
    try { s.dispose?.(); } catch {}
    services.delete(k);
    connection.console.log(`[rip] evicted idle service: ${k || '(default)'}`);
  }
}

// Return any existing service, lazy-creating a default if none exist.
// Used by project-agnostic lookups (DOM event names, intrinsic tag props)
// where any program with lib.dom loaded will do.
function getAnyService() {
  for (const svc of services.values()) return svc;
  return getServiceFor(rootPath);
}

function createService(projectRoot) {
  if (!documentRegistry) documentRegistry = ts.createDocumentRegistry();
  const cfgDir = projectRoot || rootPath;
  const config = (projectRoot && tc.readProjectConfig?.(projectRoot)) || {};
  const strict = config.strict === true;
  const { typeRoots, types: ambientTypes } = tc.collectAmbientTypes(cfgDir);
  const settings = tc.createTypeCheckSettings(ts, {
    ...(strict ? { strict: true } : {}),
    ...(typeRoots.length ? { typeRoots } : {}),
    ...(ambientTypes.length ? { types: ambientTypes } : {}),
  });

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
    getCurrentDirectory: () => cfgDir,
    fileExists(f) { return compiled.has(fromVirtual(f)) || ts.sys.fileExists(f); },
    readFile(f) { return compiled.get(fromVirtual(f))?.tsContent || ts.sys.readFile(f); },
    readDirectory: (...a) => ts.sys.readDirectory(...a),
    getDirectories: (...a) => ts.sys.getDirectories(...a),
    directoryExists: (...a) => ts.sys.directoryExists(...a),

    resolveTypeReferenceDirectives(typeDirectiveNames, containingFile, redirectedReference, options) {
      return typeDirectiveNames.map((name) => {
        const n = typeof name === 'string' ? name : name.name;
        const r = ts.resolveTypeReferenceDirective(n, containingFile, options || settings, ts.sys, redirectedReference);
        return r.resolvedTypeReferenceDirective;
      });
    },

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
        // @rip-lang/* (and any workspace package) bare-spec resolution: if the
        // spec resolves to a `.rip` entry, compile it and return a virtual
        // .rip.ts so TS sees its exports. Prefer a discovered workspace-member
        // entry; otherwise fall back to a node_modules-installed package (which
        // discovery skips) so the editor types it the same way `rip check` does.
        if (name.startsWith('@') || !name.startsWith('.')) {
          const resolved = entryForBareSpec.get(name)
            || resolveNodeModulesRipEntry(name, fromVirtual(containingFile));
          if (resolved && fs.existsSync(resolved)) {
            if (!compiled.has(resolved)) compileRip(resolved, fs.readFileSync(resolved, 'utf8'));
            if (compiled.has(resolved)) {
              return { resolvedFileName: toVirtual(resolved), extension: '.ts', isExternalLibraryImport: false };
            }
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

  return ts.createLanguageService(host, documentRegistry);
}

// ── Type inference patching ────────────────────────────────────────
// Rip hoists locals as `let x; x = expr;` which TypeScript infers as `any`.
// We exploit the Transient flag: getSymbolLinks(symbol) returns symbol.links
// directly when symbol.flags & Transient, bypassing the closured symbolLinks
// array. Setting symbol.links = { type } before any type resolution makes
// TypeScript see the correct type through all 67+ internal checker functions.

function patchTypes(svc) {
  svc = svc || getAnyService();
  if (!svc) return;
  const program = svc.getProgram();
  if (!program || patchedPrograms.has(program)) return;
  patchedPrograms.add(program);
  // Don't clear intrinsicPropsCache — DOM element types are stable across
  // program changes and must survive compilation failures so that value
  // completions still work when the user is mid-edit (e.g. `type:` with
  // no value yet causes a parse error, deleting compiled data).
  tc.patchUninitializedTypes(ts, svc, compiled);
}

// ── Position mapping ───────────────────────────────────────────────

function srcToOffset(filePath, line, col) {
  const c = compiled.get(filePath);
  return tc.srcToOffset(c, line, col);
}

function genToSrcPos(filePath, offset) {
  const c = compiled.get(filePath);
  if (!c) return null;
  const pos = tc.mapToSourcePos(c, offset);
  if (!pos) return null;
  return { line: pos.line, character: pos.col };
}

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
// `isExcluded(line, col)` (optional) rejects otherwise-valid positions —
// used to keep spilled tokens off import specifiers (see caller).
// Calls `assign(line, col)` and returns true on success.
function findUnusedOccurrence(srcLines, word, len, centerLine, used, assign, isExcluded) {
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
            !isInsideStringOrComment(s, idx) &&
            !(isExcluded && isExcluded(ln, idx))) {
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

function updateComponentRegistry(registry, filePath, source, dts) {
  for (const [name, info] of registry) {
    if (info.source === filePath) registry.delete(name);
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
    registry.set(name, { ...info, source: filePath, line: defLine });
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

// Build a completion item for a union value (string literal, boolean, number).
// String literals are inserted with their quotes; non-string values (true, 42)
// are inserted bare so they keep their JS type. When `range` is provided, the
// item uses a textEdit so picking the suggestion REPLACES the current string
// contents — otherwise typing `"/` and picking `/cart` would append, giving
// `"//cart"` (VS Code's default word-boundary doesn't include `/`).
function unionValueCompletion(v, i, inQuotes, range) {
  const isStr = v.startsWith('"') || v.startsWith("'");
  const bare = isStr ? v.slice(1, -1) : v;
  const newText = inQuotes ? bare : (isStr ? v : bare);
  const item = {
    label: bare,
    kind: 21,
    sortText: String(i).padStart(3, '0'),
  };
  if (range) {
    item.textEdit = { range, newText };
    item.filterText = bare;
  } else {
    item.insertText = newText;
  }
  return item;
}

// Locate the string-literal content range around a cursor position on a line.
// Returns an LSP Range covering everything between the opening quote and the
// closing quote (or end-of-line if unterminated). Used so union-value
// completions inside quotes REPLACE the current text instead of inserting at
// the cursor.
function stringContentRange(line, lineNumber, col) {
  let start = -1, quote = null;
  for (let i = col - 1; i >= 0; i--) {
    const c = line[i];
    if (c === '"' || c === "'") { start = i; quote = c; break; }
  }
  if (start < 0) return null;
  let end = -1;
  for (let i = col; i < line.length; i++) {
    if (line[i] === quote) { end = i; break; }
  }
  if (end < 0) end = line.length;
  return {
    start: { line: lineNumber, character: start + 1 },
    end:   { line: lineNumber, character: end },
  };
}

// DOM event names resolved from HTMLElementEventMap via the TS checker.
// Lazy-initialized on first use; falls back to empty (no @event completions
// until TS service is ready, then populates on next request).
let domEventNamesCache = null;

function getDomEventNames() {
  if (domEventNamesCache) return domEventNamesCache;
  if (!ts) return [];
  const svc = getAnyService();
  if (!svc) return [];
  patchTypes(svc);
  const program = svc.getProgram();
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
  if (!ts) return [];
  const svc = getAnyService();
  if (!svc) return [];
  patchTypes(svc);
  const program = svc.getProgram();
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
function resolveIntrinsicProps(registry, componentName, ownPropNames) {
  const info = registry.get(componentName);
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

// Walks `line` up to `col` tracking string-literal and `#{...}` interpolation
// state. Returns:
//   { inString: true,  inInterpolation: false }  cursor is inside string text
//   { inString: true,  inInterpolation: true  }  cursor is inside #{...} expr
//   { inString: false, inInterpolation: false }  cursor is in plain code
// Unterminated strings (mid-typing) still count as "in string" past the open.
function scanStringState(line, col) {
  if (!line || col <= 0) return { inString: false, inInterpolation: false };
  let quote = null;        // null | '"' | "'"
  let interpDepth = 0;     // depth of `{` since last `#{` while inside string
  for (let i = 0; i < col; i++) {
    const ch = line[i];
    if (quote) {
      if (interpDepth > 0) {
        if (ch === '{') interpDepth++;
        else if (ch === '}') interpDepth--;
        continue;
      }
      if (ch === '\\') { i++; continue; }
      if (ch === '#' && line[i + 1] === '{') { interpDepth = 1; i++; continue; }
      if (ch === quote) quote = null;
    } else {
      if (ch === '#') break;             // start of a Rip comment — bail
      if (ch === '"' || ch === "'") quote = ch;
    }
  }
  return { inString: quote !== null, inInterpolation: interpDepth > 0 };
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
function detectBlockComponentContext(srcLines, lineIndex, col, registry) {
  // First try the current line directly
  const direct = detectComponentContext(srcLines[lineIndex], col, srcLines, lineIndex, registry);
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
    if (!registry.has(compMatch[1])) return null;
    component = compMatch[1];
  } else {
    // Check for HTML element tag (lowercase identifier starting a line in a
    // render block). Restrict to the known HTML/SVG tag set so control
    // keywords and ordinary identifiers don't masquerade as tags.
    const tagMatch = parentTrimmed.match(/^([a-z]\w*)\b/);
    if (tagMatch && HTML_TAG_NAMES.has(tagMatch[1]) && isInRenderBlock(srcLines, parentLine)) {
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

  // Cursor on a blank/incomplete line — offer prop completions, unless the
  // cursor is inside string text (e.g. a positional `"text content"` child
  // line under a parent tag) where ARIA prop completions are noise.
  const lineState = scanStringState(curLine, col);
  if (lineState.inString || lineState.inInterpolation) return null;
  // A real prop slot looks like `<indent>@?\w*` with nothing else before
  // the cursor. Any whitespace, operator, or dot before the cursor means
  // we're in an expression / statement (e.g. `for item in cart.`,
  // `if cond`, `x = y`) — not a prop name slot.
  const beforeCursor = curLine.slice(curIndent, col);
  if (!/^@?\w*$/.test(beforeCursor)) return null;
  return { component, htmlTag, existingProps, propValues, currentProp: null, wantValues: false, wantProps: true };
}

function detectComponentContext(srcLine, col, srcLines, lineIndex, registry) {
  if (!srcLine) return null;

  const trimmed = srcLine.trimStart();
  const indent = srcLine.length - trimmed.length;

  const compMatch = trimmed.match(/^([A-Z]\w*)\b/);
  let component = null;
  let htmlTag = null;
  if (compMatch) {
    if (/=\s*component\b/.test(trimmed)) return null;
    if (!registry.has(compMatch[1])) return null;
    component = compMatch[1];
  } else if (srcLines && lineIndex != null) {
    // Check for inline HTML tag (lowercase identifier) inside a render block.
    // Only treat the leading word as a tag when it's actually in the known
    // HTML/SVG tag set — otherwise control keywords (`if`, `else`, `for`,
    // `unless`, `switch`, `not`, etc.) and ordinary variables (`cart`,
    // `result`, `term`, …) get mistaken for tags and trigger spurious
    // attribute completions.
    const tagMatch = trimmed.match(/^([a-z][\w-]*)\b/);
    if (tagMatch && HTML_TAG_NAMES.has(tagMatch[1]) && isInRenderBlock(srcLines, lineIndex)) {
      htmlTag = tagMatch[1];
    }
  }
  if (!component && !htmlTag) return null;
  const tagOrComp = component || htmlTag;

  // Skip CSS-like shorthand chain (.class, #id) immediately after the tag
  // so `button.outline @click: …` is recognized as `button` followed by
  // a space-separated prop slot.
  let tagSpan = tagOrComp.length;
  const shorthandMatch = trimmed.slice(tagSpan).match(/^[.#][\w.#-]*/);
  if (shorthandMatch) tagSpan += shorthandMatch[0].length;

  const rest = trimmed.substring(tagSpan);
  if (rest.length > 0 && rest[0] !== ' ' && rest[0] !== '\t') return null;

  const cursorInTrimmed = col - indent;

  if (cursorInTrimmed <= tagSpan) {
    return { component, htmlTag, existingProps: [], propValues: new Map(), currentProp: null, wantValues: false, wantProps: false };
  }

  const cursorInRest = cursorInTrimmed - tagSpan;
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
      // Positional segment (no colon). Only offer prop completions if the
      // cursor is in plain code — being inside a string literal here means
      // the segment is text content (or an unquoted expression), not a
      // prop slot. Showing ARIA props in that context is just noise.
      if (inThisSeg) {
        const segCol = cursorInRest - seg.start;
        const segState = scanStringState(seg.text, segCol);
        if (!segState.inString && !segState.inInterpolation) wantProps = true;
      }
    }
  }

  if (!wantValues && !wantProps) {
    // Don't fall back to wantProps when the cursor sits inside string text —
    // that's positional content (or a half-typed expression), not a prop slot.
    const restState = scanStringState(rest, cursorInRest);
    if (!restState.inString && !restState.inInterpolation) wantProps = true;
  }

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
  const svc = fp.endsWith('.rip') ? getServiceFor(fp) : null;
  if (!svc) return { data: [] };

  const c = compiled.get(fp);
  if (!c || !c.hasTypes) return { data: [] };

  try {
    patchTypes(svc);
    const vf = toVirtual(fp);
    const format = ts.SemanticClassificationFormat?.TwentyTwenty || '2020';
    const result = svc.getEncodedSemanticClassifications(vf, { start: 0, length: c.tsContent.length }, format);
    if (!result?.spans) return { data: [] };

    const srcLines = c.source.split('\n');
    const tokens = [];
    const usedPositions = new Set();

    // Pre-compute source ranges inside import/export `{ … }` specifier lists.
    // TypeScript never emits a semantic classification for an import specifier
    // name, so any token that maps onto one is a mis-mapped (spilled) usage
    // token — e.g. when a type is used N times but every usage collapses onto
    // a single source position, the surplus tokens spill via findUnusedOccurrence
    // and one can land on the same name in an `import { … }` line. Excluding
    // these positions lets the spill continue to the next real usage instead.
    const importSpecRanges = new Map(); // srcLine → [[startCol, endCol], …]
    {
      const srcText = c.source;
      const lineStarts = [0];
      for (let i = 0; i < srcText.length; i++) if (srcText[i] === '\n') lineStarts.push(i + 1);
      const offToLC = (off) => {
        let lo = 0, hi = lineStarts.length - 1;
        while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= off) lo = mid; else hi = mid - 1; }
        return { line: lo, col: off - lineStarts[lo] };
      };
      const importRe = /(?:^|\n)[ \t]*(?:import|export)\b[^\n{]*\{([\s\S]*?)\}[^\n]*?\bfrom\b/g;
      let im;
      while ((im = importRe.exec(srcText)) !== null) {
        const contentStart = im.index + im[0].indexOf('{') + 1;
        const contentEnd = contentStart + im[1].length;
        const a = offToLC(contentStart), b = offToLC(contentEnd);
        for (let ln = a.line; ln <= b.line; ln++) {
          const startCol = ln === a.line ? a.col : 0;
          const endCol = ln === b.line ? b.col : (srcLines[ln]?.length ?? 0);
          if (!importSpecRanges.has(ln)) importSpecRanges.set(ln, []);
          importSpecRanges.get(ln).push([startCol, endCol]);
        }
      }
    }
    const inImportSpecifier = (ln, col) => {
      const ranges = importSpecRanges.get(ln);
      return ranges ? ranges.some(([s, e]) => col >= s && col < e) : false;
    };

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

    // Pre-compute positions of the `schema` keyword on schema-head lines
    // (`Name = schema [:kind]`, mirroring the grammar's schema-block begin).
    // The keyword compiles to a call of the runtime `schema` helper, so TS
    // classifies it as a readonly const variable; without this the variable
    // token overrides the grammar's keyword.control.schema.rip scope and
    // paints the keyword like a constant — and inconsistently, since the
    // occurrence-search resolves the duplicate `schema` tokens unevenly.
    // Suppress the token here and let the grammar own the keyword.
    const schemaHeadPositions = new Set();
    for (let si = 0; si < srcLines.length; si++) {
      const m = srcLines[si].match(/\bschema\b[ \t]*(?::[a-z][A-Za-z0-9_]*)?[ \t]*$/);
      if (m) schemaHeadPositions.add(si + ':' + m.index);
    }

    // Pre-compute the indented body lines of each schema block (following a
    // `= schema [:kind]` head until a line dedents to column 0 — mirroring the
    // grammar's schema-block end `^(?=\S)`). Schema fields compile to
    // string-literal data with no real symbols, and their names / types /
    // directives are fully scoped by the grammar. But the header type-defs
    // (`email: string`) and compiled object keys (`unique: true`) still get
    // `property` classifications, which the heuristic text-search lands on
    // schema source tokens — painting a field's type or an `@directive` as a
    // property. The grammar owns the whole body, so suppress tokens there.
    const schemaBodyLines = new Set();
    for (let si = 0; si < srcLines.length; si++) {
      if (!/\bschema\b[ \t]*(?::[a-z][A-Za-z0-9_]*)?[ \t]*$/.test(srcLines[si])) continue;
      for (let sj = si + 1; sj < srcLines.length; sj++) {
        const ch = srcLines[sj][0];
        if (srcLines[sj].trim() === '' || ch === ' ' || ch === '\t') { schemaBodyLines.add(sj); continue; }
        break;
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

    // Recognize compiler-injected component-stub lines (emitted by the
    // `stubComponents` pass: the synthetic `this` shape, the optional
    // lifecycle-hook signatures, `emit`, and the props constructor). These
    // declarations have no source counterpart, so the text-search mapper
    // interpolates their identifiers onto real nearby source names — e.g. the
    // `err` param of a synthesized `onError?(err: …)` stub lands on a user
    // `catch err` binding or an `errors` state var, painting it with the
    // `parameter` scope. Their signatures are stable compiler output, so match
    // them exactly and skip every token they produce. Keep in sync with the
    // stubComponents emission in src/components.js.
    function isComponentStubLine(lineText) {
      const s = lineText.trim();
      return /^declare _root: Element \| null; declare app:/.test(s)
        || /^(?:(?:beforeMount|mounted|beforeUnmount|unmounted)\?\(\): void;\s*|onError\?\(err: \{[^}]*\}\): void;\s*)+$/.test(s)
        || /^emit\(_name: string, _detail\?: any\): void \{\}$/.test(s)
        || /^constructor\(_props\?:/.test(s);
    }

    for (const [tsOffset, tsLength, classification] of orderedSpans) {
      const tsTokenType = ((classification >> 8) & 0xFF) - 1;
      const tsModifiers = classification & 0xFF;
      if (tsTokenType >= TS_TYPE_TO_LEGEND.length) continue;

      // DTS header token handling: reclassify and skip synthetic lines.
      let finalType = tsTokenType;
      // Render-block boolean flag: the stub emits `({ flag: true });` for a
      // bare flag on its own line (where TextMate gives it no scope). Repaint
      // its property key as the synthetic `attribute` type so it matches an
      // inline flag's colour. Detected by the distinctive generated line.
      let forcedLegendType = null;
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
        const tsLineText = tc.getLineText(c.tsContent, tsLine);
        // Skip ALL tokens from compiler-injected component-stub lines —
        // they have no source counterpart and mis-map onto real identifiers.
        if (isComponentStubLine(tsLineText)) continue;
        if (tsTokenType === 9 && /^\s*\(\{\s*[\w$]+:\s*true\s*\}\);/.test(tsLineText)) {
          forcedLegendType = LEGEND_ATTRIBUTE;
        }
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

      // Accept the mapped position only if it covers the WHOLE identifier, not
      // just a prefix/substring of a longer one. A semantic token classifies an
      // identifier, so it must align to a word boundary on both sides. Without
      // this, a mis-mapped token whose text is a prefix of the real source
      // identifier (e.g. the `err` param of a synthesized `onError?(err:…)`
      // lifecycle stub landing on `errors`) passes a plain substring check and
      // paints the wrong scope over part of an unrelated name.
      const beforeOk = matchCol === 0 || !/\w/.test(srcLine[matchCol - 1]);
      const afterOk = matchCol + tsLength >= srcLine.length || !/\w/.test(srcLine[matchCol + tsLength]);
      if (srcLine.substring(matchCol, matchCol + tsLength) !== tsText || !beforeOk || !afterOk) {
        // Multiline expressions compile to one gen line — search nearby source lines
        if (!findUnusedOccurrence(srcLines, tsText, tsLength, srcPos.line, usedPositions, (l, c) => { matchLine = l; matchCol = c; }, inImportSpecifier)) continue;
      }

      // Collision: multiple TS tokens mapped to the same source position
      // (common in multi-line object literals compiled to one JS line).
      // Find the next unused occurrence of this word nearby.
      const posKey = matchLine + ':' + matchCol;
      if (usedPositions.has(posKey)) {
        if (!findUnusedOccurrence(srcLines, tsText, tsLength, matchLine, usedPositions, (l, c) => { matchLine = l; matchCol = c; }, inImportSpecifier)) continue;
      }

      // When the initial mapping lands inside a string literal or comment,
      // reserve that position and try to find the real occurrence outside.
      // This commonly happens when a variable name also appears as a string
      // value on the same source line (e.g. `console.log "total:", total`).
      if (isInsideStringOrComment(srcLines[matchLine], matchCol)) {
        usedPositions.add(matchLine + ':' + matchCol);
        if (!findUnusedOccurrence(srcLines, tsText, tsLength, matchLine, usedPositions, (l, c) => { matchLine = l; matchCol = c; }, inImportSpecifier)) continue;
      }

      // Skip tokens inside render blocks where TextMate provides
      // entity.name.tag.rip or entity.other.attribute-name.rip scopes.
      if (renderBlockLines.has(matchLine)) {
        const sl = srcLines[matchLine];
        const slIndent = sl.length - sl.trimStart().length;
        const firstWord = sl.substring(slIndent).match(/^([a-zA-Z]\w*)\b/);
        const isTagLine = firstWord && HTML_TAG_NAMES.has(firstWord[1]);
        const isComponentLine = firstWord && /^[A-Z]/.test(firstWord[1]);

        // `slot` is a reserved render keyword (children projection), not a
        // variable or prop, and the grammar already paints it entity.name.tag.rip.
        // It compiles to `this.children`/`__ripEl('slot')`, so it has no token of
        // its own — but a component that also declares a reactive member named
        // `slot` would let the spill remap paint the keyword use with that
        // member's `property` classification, overriding the tag scope. Suppress
        // the keyword use so the grammar scope stands (slot renders like any tag).
        if (firstWord && firstWord[1] === 'slot' && matchCol === slIndent) continue;

        // Skip tokens that fall inside a tag-shorthand chain
        // (`div.cart-actions`, `button.outline.secondary`).  TextMate
        // already paints the class portion; without this guard a class
        // name like `cart-actions` whose `cart` segment matches a real
        // identifier elsewhere in the file gets mis-mapped here by the
        // text-search fallback and overrides the TextMate scope.
        if ((isTagLine || isComponentLine) && matchCol > slIndent + firstWord[1].length) {
          const between = sl.slice(slIndent + firstWord[1].length, matchCol);
          if (/^[.#][\w.#-]*$/.test(between)) continue;
        }
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
          // Inline render head (`if cond then Bar tone: …`): the line starts
          // with a control keyword, so the checks above miss the prop key, and
          // the grammar only scopes it meta.object-literal.key (not
          // attribute-name) — so the property token would paint it as a member.
          // If a tag/component head precedes the key on the line, repaint the
          // key as the synthetic attribute type to match every other prop.
          const heads = sl.slice(slIndent, matchCol).match(/[A-Za-z][\w-]*(?=\s)/g);
          if (heads && heads.some(w => /^[A-Z]/.test(w) || HTML_TAG_NAMES.has(w))) {
            forcedLegendType = LEGEND_ATTRIBUTE;
          }
        }
        if (/^\s*<=>/.test(afterToken)) {
          if (matchCol === slIndent || isTagLine || isComponentLine) continue;
        }
      }

      // The `schema` keyword is owned by the TextMate grammar
      // (keyword.control.schema.rip); skip TS's variable classification of the
      // compiled `schema(...)` helper so it doesn't repaint the keyword.
      if (tsText === 'schema' && schemaHeadPositions.has(matchLine + ':' + matchCol)) continue;

      // Schema block bodies are entirely grammar-scoped (fields are
      // string-literal data, no real symbols); drop heuristic property/type
      // tokens that would repaint a field type or `@directive`.
      if (schemaBodyLines.has(matchLine)) continue;

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
        type: forcedLegendType != null ? forcedLegendType : TS_TYPE_TO_LEGEND[finalType],
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

    connection.console.log(`[rip] semantic tokens ${relPath(fp)}: ${data.length / 5} tokens`);
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
  ensureExportIndex();
  const registry = getComponentRegistry(fp);

  // Component prop completions
  const doc = documents.get(params.textDocument.uri);
  if (doc) {
    const srcLines = doc.getText().split('\n');
    const srcLine = srcLines[params.position.line];
    // Skip the component-prop completion path when the cursor sits inside a
    // `#{...}` interpolation — that's a TS expression, not a prop slot.
    // Plain string positional args (`a "text content"`) are handled inside
    // detectComponentContext so that quoted prop values still get value
    // completions (e.g. `type: "|"` → "text"|"button"|...).
    const strState = scanStringState(srcLine, params.position.character);
    // Tag/component shorthand zone — `div.|`, `button.foo#|`, `Layout#bar.|`
    // are CSS class / id shorthands, not prop slots. Suppress all
    // completions here so VS Code doesn't surface attribute or @event
    // suggestions while the user is typing a class name. Only applies
    // inside a render block — `cart.` in a method body is member access,
    // not a tag shorthand.
    if (isInRenderBlock(srcLines, params.position.line)) {
      const trimmed = srcLine.trimStart();
      const tagStart = srcLine.length - trimmed.length;
      const cur = params.position.character;
      const tagMatch = trimmed.match(/^([A-Za-z][\w-]*)/);
      if (tagMatch && cur > tagStart + tagMatch[1].length) {
        const word = tagMatch[1];
        const isTagOrComp = HTML_TAG_NAMES.has(word) || (/^[A-Z]/.test(word) && registry.has(word));
        if (isTagOrComp) {
          const between = srcLine.slice(tagStart + word.length, cur);
          if (/^[.#][\w.#-]*$/.test(between)) return [];
        }
      }
    }
    const ctx = strState.inInterpolation ? null : detectBlockComponentContext(srcLines, params.position.line, params.position.character, registry);
    if (ctx) {
      connection.console.log(`[rip] completion ctx: component=${ctx.component}, htmlTag=${ctx.htmlTag}, wantProps=${ctx.wantProps}, wantValues=${ctx.wantValues}, currentProp=${ctx.currentProp}`);
      const info = ctx.component ? registry.get(ctx.component) : null;

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
          for (const ip of resolveIntrinsicProps(registry, ctx.component, ownPropNames)) {
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
          // Route completions for `<a href: "|">` — surface every route in
          // the project, with dynamic segments inserted as tab-stop snippets
          // (e.g. `/orders/${1:orderId}`). TanStack-router-style.
          if (ctx.currentProp === 'href' && ctx.htmlTag === 'a' && tc.findRoutesDir && tc.walkRoutesDir) {
            const routesDir = tc.findRoutesDir(fp);
            if (routesDir) {
              const { entries } = tc.walkRoutesDir(routesDir);
              if (entries.length > 0) {
                const ch = srcLine[params.position.character] || '';
                const prevCh = params.position.character > 0 ? srcLine[params.position.character - 1] : '';
                const inQuotes = (prevCh === '"' || prevCh === "'") || (ch === '"' || ch === "'");
                const range = inQuotes ? stringContentRange(srcLine, params.position.line, params.position.character) : null;
                return entries
                  .filter(e => !e.dynamic.some(d => d.catchAll))
                  .map((e, i) => {
                    let tab = 1;
                    const segs = e.rel.replace(/\.rip$/, '').split('/').filter(s => s && s !== 'index');
                    const labelSegs = segs.map(s => {
                      const m = s.match(/^\[(\w+)\]$/);
                      return m ? '$' + m[1] : s;
                    });
                    const label = '/' + labelSegs.join('/');
                    const snippetSegs = segs.map(s => {
                      const m = s.match(/^\[(\w+)\]$/);
                      return m ? '${' + (tab++) + ':' + m[1] + '}' : s;
                    });
                    const snippet = '/' + snippetSegs.join('/');
                    const item = {
                      label: label || '/',
                      kind: 14, // Keyword (gets a distinct icon)
                      sortText: String(i).padStart(3, '0'),
                      insertTextFormat: 2, // Snippet
                    };
                    const text = snippet || '/';
                    if (range) {
                      item.textEdit = { range, newText: text };
                      item.filterText = label || '/';
                    } else {
                      item.insertText = text;
                    }
                    return item;
                  });
              }
            }
          }
          const prop = allProps.find(p => p.name === ctx.currentProp);
          if (prop) {
            const values = extractUnionValues(prop.type);
            if (values.length > 0) {
              const ch = srcLine[params.position.character] || '';
              const prevCh = params.position.character > 0 ? srcLine[params.position.character - 1] : '';
              const inQuotes = (prevCh === '"' || prevCh === "'") || (ch === '"' || ch === "'");
              const range = inQuotes ? stringContentRange(srcLine, params.position.line, params.position.character) : null;
              return values.map((v, i) => unionValueCompletion(v, i, inQuotes, range));
            }
          }
          // Cursor is in a prop value slot (after `prop: `) but the prop has
          // no enum/union to suggest. Suppress TS fallback only when the
          // cursor is inside a string literal — otherwise (e.g. inside an
          // event handler arrow body `@click: (-> |)`) we want regular TS
          // completions for variables and functions in scope.
          if (strState.inString) return [];
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
        const range = inQuotes ? stringContentRange(srcLine, params.position.line, params.position.character) : null;
        return values.map((v, i) => unionValueCompletion(v, i, inQuotes, range));
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
        const range = inQuotes ? stringContentRange(srcLine, params.position.line, params.position.character) : null;
        return values.map((v, i) => unionValueCompletion(v, i, inQuotes, range));
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
            const range = inQuotes ? stringContentRange(srcLine, params.position.line, col) : null;
            return values
              .filter(v => !existing.has(v.replace(/^["']|["']$/g, '')))
              .map((v, i) => unionValueCompletion(v, i, inQuotes, range));
          }
        }
      }
    }

    // Object-literal property value — `key: "▮"` whose type comes from a
    // contextually-typed call argument (e.g. `preload: '▮'` under `use serve`,
    // typed against serve's opts param). The implicit-object block collapses to
    // a single generated line, so srcToOffset can't reach the value string and
    // the generic in-string bail-out below would suppress the list. Retarget
    // into the gen string and let TS supply the literal-union values, rebuilt
    // as in-quote replacements (so picking one replaces the string contents).
    if (strState.inString && !strState.inInterpolation && tc.retargetObjectValueOffset
        && /^\s*[\w$]+\s*:\s*["']/.test(srcLine)) {
      const c2 = compiled.get(fp);
      const svc = getServiceFor(fp);
      const genOff = srcToOffset(fp, params.position.line, params.position.character);
      if (c2 && svc && genOff !== undefined) {
        const rt = tc.retargetObjectValueOffset(c2, srcLine, params.position.character, genOff);
        if (rt !== genOff) {
          patchTypes(svc);
          const r = svc.getCompletionsAtPosition(toVirtual(fp), rt, { includeInsertTextCompletions: true });
          const lits = (r?.entries || []).filter(e => e.kind === 'string');
          if (lits.length > 0) {
            const range = stringContentRange(srcLine, params.position.line, params.position.character);
            return lits.map((e, i) => unionValueCompletion(e.name, i, true, range));
          }
        }
      }
    }

    // Space/colon triggered outside component/render context — don't fall through to TS
    if (params.context?.triggerCharacter === ' ' || params.context?.triggerCharacter === ':') {
      if (!isInRenderBlock(srcLines, params.position.line)) return [];
    }

    // Cursor inside a plain string literal (not a `#{...}` interpolation):
    // identifier completions are noise. Any prop-value path that wanted to
    // offer in-quote suggestions has already returned above. Inside `#{...}`
    // we still want TS completions for variables/functions in scope.
    if (strState.inString && !strState.inInterpolation) return [];
  }

  // TypeScript completions
  const svc = getServiceFor(fp);
  if (!svc) return [];

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
        const entry = tc.compileForCheck(fp, docLines.join('\n'), compiler, getFileProfile(fp));
        const prev = compiled.get(fp);
        compiled.set(fp, { version: (prev?.version || 0) + 1, ...entry });
      } catch {} // recovery failed — continue with stale data
    }
  }

  // Object-key recovery: when the cursor sits on a property name being typed —
  // or a blank slot — on its own line inside an implicit-object block (e.g.
  // under `use serve` where sibling lines are `dir: …`, `watch: …`), the
  // compiler reads a bareword as a *positional* call argument — `serve({…},
  // prel)` — and an empty line offers nothing object-related, so TS surfaces
  // global identifiers instead of the object's contextually-typed property
  // names. Patch the line to `<word>: 0` (using a placeholder when no word has
  // been typed yet) so it folds into the object literal, then recompile; TS
  // then surfaces the remaining property names (filtered by any prefix →
  // `preload`). Gated on a contiguous sibling `key:` line at the same indent,
  // the signature of an implicit-object block.
  let objectKeyRecovery = false;
  if (doc) {
    const docLines = doc.getText().split('\n');
    const curLine = docLines[params.position.line] || '';
    const before = curLine.slice(0, params.position.character);
    const after = curLine.slice(params.position.character);
    // Indent + optional partial identifier up to the cursor, nothing but
    // whitespace after it. The optional partial covers the blank-slot case.
    const m = before.match(/^(\s+)([A-Za-z_$][\w$]*)?$/);
    if (m && /^\s*$/.test(after)) {
      const indent = m[1].length;
      let inObjectBlock = false;
      for (let ln = params.position.line - 1; ln >= 0; ln--) {
        const t = docLines[ln];
        const trimmed = t.trimStart();
        if (trimmed === '' || trimmed.startsWith('#')) continue;  // skip blanks/comments
        const lead = t.length - trimmed.length;
        if (lead < indent) break;                 // reached the block header
        if (lead === indent) {                    // contiguous sibling line
          inObjectBlock = /^\s*[\w$]+\s*:/.test(t);
          break;
        }
      }
      if (inObjectBlock) {
        docLines[params.position.line] = m[1] + (m[2] || '__rip__') + ': 0' + after;
        try {
          const entry = tc.compileForCheck(fp, docLines.join('\n'), compiler, getFileProfile(fp));
          const prev = compiled.get(fp);
          compiled.set(fp, { version: (prev?.version || 0) + 1, ...entry });
          objectKeyRecovery = true;
        } catch {} // recovery failed — continue with stale data
      }
    }
  }

  let offset = srcToOffset(fp, params.position.line, params.position.character);
  if (offset === undefined) return [];

  // Retarget completions requested inside an inline object-literal call
  // argument (e.g. `@router.push('/', { ▮ })`). The word-anchored mapper
  // lands on the call name there, so TS would offer the receiver's members
  // (push, replace, …) instead of the object's contextually-typed
  // properties (noScroll, …). No-op outside that context.
  if (tc.retargetObjectArgOffset && doc) {
    const c2 = compiled.get(fp);
    const lineText = (doc.getText().split('\n')[params.position.line]) || '';
    if (c2) offset = tc.retargetObjectArgOffset(c2, lineText, params.position.character, offset);
  }

  try {
    patchTypes(svc);
    const r = svc.getCompletionsAtPosition(toVirtual(fp), offset, { includeExternalModuleExports: true, includeInsertTextCompletions: true });
    if (!r) return [];
    const vf = toVirtual(fp);
    const result = {
      isIncomplete: false,
      items: r.entries.map((e) => ({
        label: e.name,
        kind: tsToLspKind(e.kind),
        sortText: e.sortText,
        // Defer the expensive getCompletionEntryDetails() call to
        // onCompletionResolve — it only runs for the focused item, not
        // for every entry on every keystroke.
        data: { vf, offset, name: e.name },
      })),
    };

    // Augment with auto-import suggestions from our export index for any
    // exported symbol not already imported. TS will surface symbols from any
    // file in its Program (transitive imports), but it doesn't attach import
    // edits — we add those here. For symbols TS doesn't know about at all
    // (workspace .rip files outside the Program), we add a fresh item.
    const c = compiled.get(fp);
    if (c) {
      // Filter the index by the identifier prefix the user is typing. Without
      // this we'd construct an item (and run buildImportEdit) for every
      // exported name in the workspace on every keystroke. If there's no
      // prefix (cold open of completion menu), cap the list so we don't
      // produce thousands of items.
      const lineTextPrefix = (c.source.split('\n')[params.position.line] || '').slice(0, params.position.character);
      const partialMatch = lineTextPrefix.match(/[A-Za-z_$][\w$]*$/);
      const partial = partialMatch ? partialMatch[0] : '';
      const partialLc = partial.toLowerCase();
      const MAX_AUGMENT = partial ? Infinity : 50;

      // Skip auto-import augmentation when the cursor is on a member-access
      // (e.g. `cart.|` or `cart.it|`). Those completions should only show
      // members of the receiver, not arbitrary workspace exports.
      const beforePartial = lineTextPrefix.slice(0, lineTextPrefix.length - partial.length);
      const isMemberAccess = /[.?!]\s*$/.test(beforePartial);
      if (isMemberAccess) return result;

      // Object-key recovery produced a contextually-typed property-name list;
      // workspace export suggestions would only be noise in that slot.
      if (objectKeyRecovery) return result;

      const existingImports = collectImportedNames(c.source);
      const itemsByLabel = new Map();
      for (const it of result.items) itemsByLabel.set(it.label.replace(/\?$/, ''), it);
      let added = 0;
      for (const [name, sources] of exportIndex) {
        if (added >= MAX_AUGMENT) break;
        if (existingImports.has(name)) continue;
        if (partial && !name.toLowerCase().startsWith(partialLc)) continue;
        for (const targetFp of sources) {
          if (targetFp === fp) continue;
          const spec = resolveSpecForTarget(fp, targetFp);
          if (!spec) continue;
          const edit = buildImportEdit(c.source, spec, name);
          if (!edit) continue;
          const verb = edit.update ? 'Update' : 'Add';
          delete edit.update;
          const existing = itemsByLabel.get(name);
          if (existing) {
            // TS already suggested this symbol — attach the import edit.
            existing.labelDetails = { description: spec };
            existing.detail = `${verb} import from "${spec}"\n${existing.detail || ''}`.trim();
            existing.additionalTextEdits = [edit];
          } else {
            // Workspace symbol TS doesn't know about — add a new item.
            result.items.push({
              label: name,
              kind: 9 /* Module */,
              sortText: 'z' + name,
              labelDetails: { description: spec },
              detail: `${verb} import from "${spec}"`,
              additionalTextEdits: [edit],
            });
          }
          added++;
          break; // first match wins
        }
      }
    }

    return result;
  } catch (e) { connection.console.log(`[rip] completion error: ${e.message}`); return []; }
});

// Collect names of identifiers already imported in `source` so we don't suggest
// importing them again. Handles single-line and multi-line forms:
//   import { a, b } from 'm'
//   import x from 'm'
//   import x, { y } from 'm'
//   import {
//     a,
//     b,
//   } from 'm'
function collectImportedNames(source) {
  const names = new Set();
  const re = /^\s*import\s+(?:(?:([A-Za-z_$][\w$]*)\s*,\s*)?\{([\s\S]*?)\}|([A-Za-z_$][\w$]*))\s+from\s+['"][^'"]+['"]/gm;
  let m;
  while ((m = re.exec(source))) {
    if (m[1]) names.add(m[1]);
    if (m[3]) names.add(m[3]);
    if (m[2]) {
      for (const part of m[2].split(',')) {
        const id = part.trim().split(/\s+as\s+/i).pop();
        if (id && /^[A-Za-z_$][\w$]*$/.test(id)) names.add(id);
      }
    }
  }
  return names;
}

// Compute the relative module specifier from `fromFp` to `toFp`, preserving
// the `.rip` extension and prefixing `./` when needed.
function relativeRipSpecifier(fromFp, toFp) {
  let spec = path.relative(path.dirname(fromFp), toFp);
  if (!spec.startsWith('.') && !path.isAbsolute(spec)) spec = './' + spec;
  return spec.split(path.sep).join('/');
}

// The package name carried by a bare specifier: `@scope/name` or `@scope/name
// /sub` -> `@scope/name`; `name` or `name/sub` -> `name`.
function pkgNameFromSpec(spec) {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

// Declared dependency names for a project, cached. Cleared by
// rebuildProjectInfo on any package.json change.
const declaredDepsCache = new Map(); // projectRoot -> Set<pkgName>
function declaredDepsFor(projectRoot) {
  if (!projectRoot) return null;
  let set = declaredDepsCache.get(projectRoot);
  if (set) return set;
  set = new Set();
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const name of Object.keys(pkg[field] || {})) set.add(name);
    }
  } catch {}
  declaredDepsCache.set(projectRoot, set);
  return set;
}

// Decide what specifier to use when importing `targetFp` from `fromFp`, or
// null if the target shouldn't be suggested.
//   - same project root  -> relative `.rip` path
//   - cross-project, target is a package entry the consumer DECLARES -> bare spec
//   - otherwise -> null (different project and not a declared dependency)
//
// The export index spans the whole workspace (one shared cache for every file
// you might open), so a name can resolve to an entry in some sibling package
// the current project doesn't depend on. Suggesting that import would produce
// code that fails the undeclared-import check (at `rip check`, the loader,
// and the bundler), so cross-project suggestions are gated on the consuming
// project's declared dependencies — the suggestion surface for any file is its
// own project's files plus what its package.json actually pulls in.
function resolveSpecForTarget(fromFp, targetFp) {
  const fromRoot = findProjectRoot(fromFp);
  const toRoot = findProjectRoot(targetFp);
  if (fromRoot && toRoot && fromRoot === toRoot) return relativeRipSpecifier(fromFp, targetFp);
  const spec = bareSpecForEntry.get(targetFp);
  if (!spec) return null;
  const deps = declaredDepsFor(fromRoot);
  return deps && deps.has(pkgNameFromSpec(spec)) ? spec : null;
}

// Build an LSP TextEdit that adds `name` to an import from `spec` in `source`.
// If an import statement already exists for that specifier (single- or multi-
// line), augment its braces; otherwise insert a fresh
// `import { name } from 'spec'` line at the top (after any leading shebang
// or file-header comment block).
function buildImportEdit(source, spec, name) {
  // Find any existing `import ... from 'spec'` (single or multi-line).
  const re = /^([ \t]*)import\s+(?:(?:([A-Za-z_$][\w$]*)\s*,\s*)?\{([\s\S]*?)\}|([A-Za-z_$][\w$]*))\s+from\s+(['"])([^'"]+)\5[ \t]*$/gm;
  let m;
  while ((m = re.exec(source))) {
    if (m[6] !== spec) continue;
    const indent = m[1], quote = m[5];
    const def = m[2] || m[4];
    const startLineCol = offsetToLineCol(source, m.index);
    const endLineCol = offsetToLineCol(source, m.index + m[0].length);
    if (m[3] !== undefined) {
      // Named import — add to braces if not present.
      const existing = m[3].split(',').map(s => s.trim()).filter(Boolean);
      if (existing.includes(name)) return null;
      existing.push(name);
      const head = def ? `${def}, ` : '';
      const newText = `${indent}import ${head}{ ${existing.join(', ')} } from ${quote}${spec}${quote}`;
      return {
        range: { start: startLineCol, end: endLineCol },
        newText,
        update: true,
      };
    } else {
      // Bare default import — convert to `default, { name }`.
      if (def === name) return null;
      const newText = `${indent}import ${def}, { ${name} } from ${quote}${spec}${quote}`;
      return {
        range: { start: startLineCol, end: endLineCol },
        newText,
        update: true,
      };
    }
  }

  // No matching import — insert a new one. Mirror TypeScript: after the
  // shebang and the leading file-header comment block (the first contiguous
  // run of `#` lines starting at line 0), and after any existing imports.
  // Don't skip comments deeper in the file — those belong to the code below.
  const lines = source.split('\n');
  let insertAt = 0;
  let i = 0;
  if (lines[0]?.startsWith('#!')) { insertAt = 1; i = 1; }
  while (i < lines.length && /^\s*#/.test(lines[i])) { insertAt = i + 1; i++; }
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*$/.test(l)) { i++; continue; }
    if (/^\s*import\b/.test(l)) { insertAt = i + 1; i++; continue; }
    break;
  }
  const needsBlankAfter = lines[insertAt] !== undefined && !/^\s*(import\b|$)/.test(lines[insertAt]);
  const prev = insertAt > 0 ? lines[insertAt - 1] : '';
  const needsBlankBefore = insertAt > 0 && !/^\s*(import\b|$)/.test(prev);
  return {
    range: { start: { line: insertAt, character: 0 }, end: { line: insertAt, character: 0 } },
    newText: `${needsBlankBefore ? '\n' : ''}import { ${name} } from '${spec}'\n${needsBlankAfter ? '\n' : ''}`,
  };
}

// Lazy detail resolution. The editor only calls this for items the user
// focuses in the completion list, so we can afford the expensive
// getCompletionEntryDetails call here without blocking every keystroke.
connection.onCompletionResolve((item) => {
  const data = item.data;
  if (!data) return item;
  const svc = getServiceFor(fromVirtual(data.vf));
  if (!svc) return item;
  try {
    patchTypes(svc);
    const d = svc.getCompletionEntryDetails(data.vf, data.offset, data.name, undefined, undefined, undefined, undefined);
    if (d) {
      const display = unwrapReactiveType(ts.displayPartsToString(d.displayParts));
      item.detail = (item.detail ? item.detail + '\n' : '') + display.replace(/\((\w+)\)\s*\S+\./, '($1) ');
      if (display.includes('?:') && !item.label.endsWith('?')) item.label = data.name + '?';
      if (d.documentation?.length) {
        item.documentation = ts.displayPartsToString(d.documentation);
      }
    }
  } catch {}
  return item;
});

connection.onHover((params) => {
  const fp = uriToPath(params.textDocument.uri);
  if (!fp.endsWith('.rip')) return null;
  const registry = getComponentRegistry(fp);

  // Import path / import-name hover — handle both single-line and multi-line
  // imports, since the Rip compiler doesn't emit per-name source map entries
  // for import specifiers, so the default TS hover path can't find them.
  const doc = documents.get(params.textDocument.uri);
  const srcLines = doc ? doc.getText().split('\n') : null;
  if (srcLines) {
    const fullText = doc.getText();
    // Locate any import statement containing the cursor's line.
    const importRe = /^[ \t]*import\s+(?:(?:[A-Za-z_$][\w$]*\s*,\s*)?\{[\s\S]*?\}|[A-Za-z_$][\w$]*)\s+from\s+(['"])([^'"]+)\1/gm;
    let imp;
    while ((imp = importRe.exec(fullText))) {
      const startLine = fullText.slice(0, imp.index).split('\n').length - 1;
      const endLine = fullText.slice(0, imp.index + imp[0].length).split('\n').length - 1;
      if (params.position.line < startLine || params.position.line > endLine) continue;

      // Cursor is inside this import. Resolve the target file once.
      let importPath = imp[2];
      if (!path.isAbsolute(importPath)) importPath = path.resolve(path.dirname(fp), importPath);
      if (!importPath.endsWith('.rip') && fs.existsSync(importPath + '.rip')) importPath += '.rip';
      // Display the specifier as written (matches TypeScript hover style),
      // but resolve to verify the file exists before showing module info.
      const moduleHover = fs.existsSync(importPath)
        ? { contents: { kind: 'markdown', value: `\`\`\`typescript\nmodule "${imp[2]}"\n\`\`\`` } }
        : null;

      // If the cursor sits on the path string (always on the `from` line), show module info.
      const srcLine = srcLines[params.position.line];
      const fromMatch = srcLine?.match(/from\s+['"]([^'"]+)['"]/);
      if (fromMatch) {
        const pathStart = fromMatch.index + fromMatch[0].indexOf(fromMatch[1]) - 1;
        const pathEnd = pathStart + fromMatch[1].length + 2;
        const col = params.position.character;
        if (col >= pathStart && col < pathEnd) return moduleHover;
      }

      // Otherwise see if the cursor is on an imported identifier and ask the
      // TS service for the equivalent quick info from the collapsed import line.
      const word = getWordAtPosition(fullText, params.position);
      if (word && word !== 'import' && word !== 'from' && word !== 'as') {
        const c = compiled.get(fp);
        if (c?.tsContent) {
          const tsLines = c.tsContent.split('\n');
          // Find the collapsed `import ... from '<path>'` line in tsContent
          // matching this import's source path (the post-compile path may have
          // a `.js`/`.rip.js` extension appended; match by basename).
          const baseSpec = imp[2].replace(/\.[^./]+$/, '');
          const escBase = baseSpec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const lineRe = new RegExp(`^\\s*import\\b[^\\n]*from\\s+['"]${escBase}(?:\\.(?:rip|js|ts|mjs|cjs))?['"]`);
          for (let li = 0; li < tsLines.length; li++) {
            if (!lineRe.test(tsLines[li])) continue;
            const wordRe = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
            const m = tsLines[li].match(wordRe);
            if (!m) break;
            const lineOffset = tsLines.slice(0, li).join('\n').length + (li > 0 ? 1 : 0);
            const offset = lineOffset + m.index;
            try {
              const svc = getServiceFor(fp);
              if (!svc) break;
              patchTypes(svc);
              const info = svc.getQuickInfoAtPosition(toVirtual(fp), offset);
              if (info) {
                let display = ts.displayPartsToString(info.displayParts);
                display = unwrapReactiveType(display);
                display = display.replace(/\b__bind_(\w+)__\b/g, '$1');
                const docs = ts.displayPartsToString(info.documentation || []);
                let value = '```typescript\n' + display + '\n```';
                if (docs) value += '\n\n' + docs;
                return { contents: { kind: 'markdown', value } };
              }
            } catch {}
            break;
          }
        }
      }
      break;
    }
  }

  // Skip hover inside string literals and comments (e.g. Tailwind classes)
  if (srcLines) {
    const srcLine = srcLines[params.position.line];
    if (srcLine && isInsideStringOrComment(srcLine, params.position.character)) return null;
  }

  // Component prop hover
  if (srcLines) {
    const ctx = detectBlockComponentContext(srcLines, params.position.line, params.position.character, registry);
    if (ctx?.component) {
      const compInfo = registry.get(ctx.component);
      if (compInfo) {
        if (ctx.currentProp) {
          const ownPropNames = new Set(compInfo.props.map(p => p.name));
          const allProps = compInfo.inheritsTag ? [...compInfo.props, ...resolveIntrinsicProps(registry, ctx.component, ownPropNames)] : compInfo.props;
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
        let propType = prop.type;
        const routesDir = tc.findRoutesDir?.(fp);
        if (routesDir && (propType.includes('${string}') || propType.includes(' | '))) {
          const tree = tc.walkRoutesDir(routesDir);
          propType = tc.prettifyRoutePatterns(propType, tree);
          propType = tc.canonicalizeRouteUnion(propType, tree);
        }
        return { contents: { kind: 'markdown', value: `\`\`\`typescript\n(property) ${prop.name}?: ${propType}\n\`\`\`` } };
      }
    }
  }

  // TypeScript hover
  const svc = getServiceFor(fp);
  if (!svc) return null;
  const offset = srcToOffset(fp, params.position.line, params.position.character);
  if (offset === undefined) {
    return null;
  }

  try {
    patchTypes(svc);
    const info = svc.getQuickInfoAtPosition(toVirtual(fp), offset);
    if (!info) {
      return null;
    }
    let display = ts.displayPartsToString(info.displayParts);
    const docs = ts.displayPartsToString(info.documentation || []);
    display = unwrapReactiveType(display);
    display = display.replace(/\b__bind_(\w+)__\b/g, '$1');
    // Prettify `${string}` placeholders in route patterns (matches diagnostics).
    if (display.includes('${string}') || display.includes(' | ')) {
      const routesDir = tc.findRoutesDir?.(fp);
      if (routesDir) {
        const tree = tc.walkRoutesDir(routesDir);
        display = tc.prettifyRoutePatterns(display, tree);
        display = tc.canonicalizeRouteUnion(display, tree);
      }
    }
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
  const registry = getComponentRegistry(fp);

  // Component go-to-definition
  const doc = documents.get(params.textDocument.uri);
  if (doc) {
    const word = getWordAtPosition(doc.getText(), params.position);
    if (word && registry.has(word)) {
      const compInfo = registry.get(word);
      return [{
        uri: pathToUri(compInfo.source),
        range: { start: { line: compInfo.line, character: 0 }, end: { line: compInfo.line, character: 0 } },
      }];
    }

    // Import go-to-definition — resolve import paths directly. Handles both
    // single-line `import { x } from '...'` and multi-line forms where the
    // cursor is on a name inside a `{ ... }` list spanning several lines.
    const fullText = doc.getText();
    const srcLines = fullText.split('\n');
    const srcLine = srcLines[params.position.line];

    // First try the same-line `from '...'` match (covers single-line imports
    // and the `from` line itself in a multi-line import).
    let fromMatch = srcLine?.match(/from\s+['"]([^'"]+)['"]/);
    let fromLine = params.position.line;

    // If not on the `from` line, locate the enclosing multi-line import by
    // walking the file's `import` statements and seeing which one the cursor
    // falls inside.
    if (!fromMatch) {
      const importRe = /^[ \t]*import\s+(?:(?:[A-Za-z_$][\w$]*\s*,\s*)?\{[\s\S]*?\}|[A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/gm;
      let m;
      while ((m = importRe.exec(fullText))) {
        const startOffset = m.index;
        const endOffset = m.index + m[0].length;
        const startLine = fullText.slice(0, startOffset).split('\n').length - 1;
        const endLine = fullText.slice(0, endOffset).split('\n').length - 1;
        if (params.position.line >= startLine && params.position.line <= endLine) {
          // Synthesize a fromMatch with index pointing into the `from` line.
          const fromIdx = m[0].lastIndexOf('from ');
          const absFromOffset = startOffset + fromIdx;
          fromLine = fullText.slice(0, absFromOffset).split('\n').length - 1;
          const lineStart = fullText.lastIndexOf('\n', absFromOffset - 1) + 1;
          const localFromIdx = absFromOffset - lineStart;
          fromMatch = m[0].slice(fromIdx).match(/from\s+['"]([^'"]+)['"]/);
          if (fromMatch) fromMatch.index = localFromIdx;
          break;
        }
      }
    }

    if (fromMatch) {
      let importPath = fromMatch[1];
      if (!path.isAbsolute(importPath)) importPath = path.resolve(path.dirname(fp), importPath);
      if (!importPath.endsWith('.rip') && fs.existsSync(importPath + '.rip')) importPath += '.rip';
      if (fs.existsSync(importPath)) {
        // Check if cursor is on the module path string (quote to quote) — only
        // meaningful when the cursor is actually on the `from` line.
        const onFromLine = params.position.line === fromLine;
        const pathStart = onFromLine ? fromMatch.index + fromMatch[0].indexOf(fromMatch[1]) - 1 : -1;
        const pathEnd = onFromLine ? pathStart + fromMatch[1].length + 2 : -1;
        const col = params.position.character;
        const originRange = onFromLine
          ? { start: { line: fromLine, character: pathStart }, end: { line: fromLine, character: pathEnd } }
          : null;
        const target = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
        if (onFromLine && col >= pathStart && col < pathEnd) {
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
  const svc = getServiceFor(fp);
  if (!svc) return null;
  const offset = srcToOffset(fp, params.position.line, params.position.character);
  if (offset === undefined) {
    return null;
  }

  try {
    patchTypes(svc);
    const defs = svc.getDefinitionAtPosition(toVirtual(fp), offset);
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

// codeAction — auto-import quick fix for "Cannot find name" diagnostics
// (TS2304, TS2552, TS2503). Uses our own export index instead of TS's
// code-fix machinery so it does not require workspace .rip files to be in
// the TS Program (which would massively slow down startup).
const AUTO_IMPORT_CODES = new Set([2304, 2552, 2503]);
connection.onCodeAction((params) => {
  const fp = uriToPath(params.textDocument.uri);
  if (!fp.endsWith('.rip')) return [];
  const c = compiled.get(fp);
  if (!c) return [];

  const diags = (params.context?.diagnostics || []).filter((d) => {
    const code = typeof d.code === 'string' ? Number(d.code) : d.code;
    return AUTO_IMPORT_CODES.has(code);
  });
  if (!diags.length) return [];
  ensureExportIndex();

  const srcLines = c.source.split('\n');
  const actions = [];

  // Pick the first viable target file for `name` from this file's perspective.
  const pickTarget = (name) => {
    const sources = exportIndex.get(name);
    if (!sources) return null;
    for (const targetFp of sources) {
      if (targetFp === fp) continue;
      const spec = resolveSpecForTarget(fp, targetFp);
      if (spec) return { spec };
    }
    return null;
  };

  // Per-diagnostic quick fixes (one action per source file that exports `name`).
  for (const diag of diags) {
    const line = srcLines[diag.range.start.line] || '';
    const name = line.slice(diag.range.start.character, diag.range.end.character).trim();
    if (!name || !/^[A-Za-z_$][\w$]*$/.test(name)) continue;
    const sources = exportIndex.get(name);
    if (!sources) continue;
    for (const targetFp of sources) {
      if (targetFp === fp) continue;
      const spec = resolveSpecForTarget(fp, targetFp);
      if (!spec) continue;
      const edit = buildImportEdit(c.source, spec, name);
      if (!edit) continue;
      const verb = edit.update ? 'Update' : 'Add';
      delete edit.update;
      actions.push({
        title: `${verb} import { ${name} } from "${spec}"`,
        kind: 'quickfix',
        diagnostics: [diag],
        edit: { changes: { [pathToUri(fp)]: [edit] } },
      });
    }
  }

  // "Add all missing imports" — aggregate every unresolved name in the file
  // (not just those in the requested range), pick the first viable target for
  // each, and emit one combined edit. Only offer when 2+ names are fixable so
  // we don't duplicate the per-name action.
  const allDiags = (lastDiagnostics.get(fp) || []).filter((d) => {
    const code = typeof d.code === 'string' ? Number(d.code) : d.code;
    return AUTO_IMPORT_CODES.has(code);
  });
  if (allDiags.length >= 2) {
    const seen = new Set();
    const picks = []; // [{ name, spec }]
    for (const d of allDiags) {
      const ln = srcLines[d.range.start.line] || '';
      const name = ln.slice(d.range.start.character, d.range.end.character).trim();
      if (!name || !/^[A-Za-z_$][\w$]*$/.test(name)) continue;
      if (seen.has(name)) continue;
      seen.add(name);
      const t = pickTarget(name);
      if (!t) continue;
      picks.push({ name, spec: t.spec });
    }
    if (picks.length >= 2) {
      // Apply each import sequentially to a working source buffer, then emit a
      // single full-document replacement so all line numbers stay consistent.
      let working = c.source;
      let mutated = false;
      const posToOffset = (text, line, character) => {
        let off = 0, ln = 0;
        while (ln < line) {
          const i = text.indexOf('\n', off);
          if (i < 0) return text.length;
          off = i + 1;
          ln++;
        }
        return off + character;
      };
      for (const { name, spec } of picks) {
        const edit = buildImportEdit(working, spec, name);
        if (!edit) continue;
        const start = posToOffset(working, edit.range.start.line, edit.range.start.character);
        const end = posToOffset(working, edit.range.end.line, edit.range.end.character);
        working = working.slice(0, start) + edit.newText + working.slice(end);
        mutated = true;
      }
      if (mutated && working !== c.source) {
        const endLine = srcLines.length - 1;
        const endChar = (srcLines[endLine] || '').length;
        actions.push({
          title: `Add all missing imports`,
          kind: 'quickfix',
          diagnostics: allDiags,
          edit: {
            changes: {
              [pathToUri(fp)]: [{
                range: { start: { line: 0, character: 0 }, end: { line: endLine, character: endChar } },
                newText: working,
              }],
            },
          },
        });
      }
    }
  }

  return actions;
});

connection.onSignatureHelp((params) => {
  const fp = uriToPath(params.textDocument.uri);
  if (!fp.endsWith('.rip')) return null;

  // Component signature help
  //
  // Intentionally minimal. Rip components take **named** props in any
  // order, so a positional "you're at param N of M" popup doesn't really
  // apply — and the existing prop *completions* already surface the same
  // info (name, type, optional/required) in a filterable, insertable form.
  // Showing the component signature popup also leaked into nested
  // expressions like `@click: (-> |)` where it was actively wrong. So
  // for any cursor inside a render-block component or HTML tag we simply
  // suppress signature help and let completions do the talking. Real
  // function/method signature help (TS branch below) is unaffected and
  // still fires for `cart.addItem(|)`, `arr.map(|)`, etc.
  const doc = documents.get(params.textDocument.uri);
  if (doc) {
    const srcLines = doc.getText().split('\n');
    const srcLine = srcLines[params.position.line];
    // Suppress when cursor sits inside a plain string literal (typing
    // string content shouldn't pop signature help at all).
    const strState = scanStringState(srcLine, params.position.character);
    if (strState.inString && !strState.inInterpolation) return null;
    const ctx = detectBlockComponentContext(srcLines, params.position.line, params.position.character, getComponentRegistry(fp));
    // Suppress for both Components and intrinsic HTML tags — the synthetic
    // `__ripEl(tag, props?)` stub for HTML tags would otherwise leak
    // compiler internals into the popup.
    if (ctx?.component || ctx?.htmlTag) return null;
  }

  // TypeScript signature help
  const svc = getServiceFor(fp);
  if (!svc) return null;
  const offset = srcToOffset(fp, params.position.line, params.position.character);
  if (offset === undefined) return null;

  try {
    patchTypes(svc);
    const sig = svc.getSignatureHelpItems(toVirtual(fp), offset, {});
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

function loadTypeScript() {
  // Only the TypeScript the extension ships (catalog-pinned, in lockstep with
  // rip-lang) so the editor matches `rip check` — never the workspace's own TS.
  // Missing bundled copy → return null (logged "NOT FOUND"), don't guess.
  try { return require(require.resolve('typescript', { paths: [__dirname] })); } catch {}
  return null;
}

documents.listen(connection);
connection.listen();
