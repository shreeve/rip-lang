// Shared type-checking infrastructure for Rip
//
// Used by both the CLI type-checker (bin/rip check) and the
// VS Code language server (packages/vscode/src/lsp.js).
//
// compileForCheck() — the shared compilation pipeline that transforms
//   .rip source into TypeScript content suitable for type-checking.
//
// runCheck() — the CLI batch type-checker that compiles all .rip files
//   in a directory, creates a TypeScript language service, and reports
//   type errors mapped back to Rip source positions.

import { Compiler, getStdlibCode } from './compiler.js';
import { STDLIB_TYPE_DECLS } from './stdlib.js';
import { INTRINSIC_TYPE_DECLS, INTRINSIC_FN_DECL, ARIA_TYPE_DECLS, SIGNAL_INTERFACE, SIGNAL_FN, COMPUTED_INTERFACE, COMPUTED_FN, EFFECT_FN, ripDestructuredNames } from './dts.js';
import './schema/loader-server.js';   // registers full schema runtime provider
import { createRequire } from 'module';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, relative, dirname, basename, sep as pathSep } from 'path';
import { buildLineMap } from './sourcemaps.js';

// ── Typed stash: project entry discovery ───────────────────────────
//
// The stash type is inferred, not declared. The user's project has a
// dedicated `<root>/app/stash.rip` file (in the client bundle) that
// contains a top-level `stash:: <Type> = ...` declaration. The type
// checker exposes that variable's type as `__RipStash` on the stash
// file's virtual module. Components splice
// `import('<rel-to-stash>').__RipStash` into their `app.data` declaration.
//
// Discovery: walk up from each file to the nearest dir that contains an
// `index.rip` AND a `package.json` (the project anchor), then look for
// `<root>/app/stash.rip`. Cached per-directory for the process lifetime.
const entryFileCache = new Map(); // dir → entryFile|null
const stashFileCache = new Map(); // root dir → stashFile|null

// ── Robust import extraction ───────────────────────────────────────
//
// Walk a file's `import ...` / dynamic `import(...)` specifiers via Bun's
// real parser instead of regex-scanning. This is immune to false matches
// from comments, string literals, regex bodies, and any other place a
// `from "@rip-lang/..."`-shaped sequence might appear in source.
//
// `scanText` is the compiled TS-virtual content (entry.tsContent) when
// available; we fall back to the raw .rip source for entries that
// haven't been compiled yet (the only such call site reads a freshly-
// read package file).
const _ripImportTranspiler = new Bun.Transpiler({ loader: 'ts' });
function scanRipPkgImports(scanText) {
  if (!scanText) return [];
  let imports;
  try { imports = _ripImportTranspiler.scanImports(scanText); }
  catch { return []; }
  const out = [];
  for (const imp of imports) {
    const p = imp.path;
    if (typeof p === 'string' && p.startsWith('@rip-lang/')) out.push(p);
  }
  return out;
}
// Type-position `import('@rip-lang/...')` import-types are erased by
// `scanImports` (they live in type space), so the parser-based scan above
// never sees them. The DTS pipeline injects exactly these — e.g.
// `declare router: import('@rip-lang/app').Router` and the `NavOpts` alias
// — so the referenced package must still be pulled into the TS
// program or its types silently resolve to `any` (e.g. `push`'s `opts`
// going unchecked). Used ONLY for package seeding, never the
// undeclared-import check: these are synthesized references, not source
// dependencies the user must declare in package.json.
const _ripImportTypeRe = /\bimport\(\s*(["'])(@rip-lang\/[^"']+)\1\s*\)/g;
function scanRipPkgImportTypes(scanText) {
  if (!scanText) return [];
  const out = [];
  _ripImportTypeRe.lastIndex = 0;
  let m;
  while ((m = _ripImportTypeRe.exec(scanText))) out.push(m[2]);
  return out;
}
// Extract the bare package name (`@rip-lang/foo`) from a specifier
// that may include a subpath (`@rip-lang/foo/sub/path`).
function ripPkgRoot(spec) {
  const i = spec.indexOf('/', '@rip-lang/'.length);
  return i === -1 ? spec : spec.slice(0, i);
}

export function findEntryFile(filePath) {
  let dir = dirname(filePath);
  const visited = [];
  while (true) {
    if (entryFileCache.has(dir)) {
      const cached = entryFileCache.get(dir);
      for (const v of visited) entryFileCache.set(v, cached);
      return cached;
    }
    visited.push(dir);
    const hasAnchor = existsSync(resolve(dir, 'package.json'));
    if (hasAnchor) {
      const entry = resolve(dir, 'index.rip');
      const result = existsSync(entry) ? entry : null;
      for (const v of visited) entryFileCache.set(v, result);
      return result;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      for (const v of visited) entryFileCache.set(v, null);
      return null;
    }
    dir = parent;
  }
}

// Build the relative import specifier from a file to its entry. Always uses
// posix forward slashes (TS module specifiers are not platform-dependent) and
// is guaranteed to start with './' or '../'.
function entryImportSpec(filePath, entryFile) {
  let rel = relative(dirname(filePath), entryFile);
  if (pathSep !== '/') rel = rel.split(pathSep).join('/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

// Locate the project's stash file (`<root>/app/stash.rip`). Returns the
// absolute path or null. Cached per project root.
export function findStashFile(filePath) {
  const entryFile = findEntryFile(filePath);
  if (!entryFile) return null;
  const root = dirname(entryFile);
  if (stashFileCache.has(root)) return stashFileCache.get(root);
  const stash = resolve(root, 'app', 'stash.rip');
  const result = existsSync(stash) ? stash : null;
  stashFileCache.set(root, result);
  return result;
}

// ── Static gate-path validation ────────────────────────────────────
//
// `x <~ @app.data.path` requires the path to resolve to a source key —
// the renderer enforces this with a deterministic mount-time error, and
// `rip check` mirrors it at compile time by reading the stash module's
// s-expressions: collect module-level bindings, find the `stash` object
// literal, and classify each gate path's keys. The analysis is
// CONSERVATIVE: only paths that provably land on a plain key (or on no
// key) error; anything whose source-ness isn't statically visible —
// imported cells, factory calls, spreads — stays silent and the mount
// check backstops it. False positives are the failure mode to avoid;
// false negatives just fall back to today's runtime error.

function sexprName(v) {
  return (typeof v === 'string' || v instanceof String) ? v.valueOf() : null;
}

// Walk a stash module's program s-expression into { stashObj, bindings }:
// the `stash` object literal plus every module-level `name = value`
// binding (so `orders: ordersSource` can chase `ordersSource = source …`).
export function collectStashAnalysis(sexpr) {
  if (!Array.isArray(sexpr) || sexpr[0] !== 'program') return null;
  const bindings = new Map();
  for (let stmt of sexpr.slice(1)) {
    if (!Array.isArray(stmt)) continue;
    if (stmt[0] === 'export' && Array.isArray(stmt[1])) stmt = stmt[1];
    if (stmt[0] === '=' || stmt[0] === 'readonly') {
      const name = sexprName(stmt[1]);
      if (name) bindings.set(name, stmt[2]);
    }
  }
  const stashObj = bindings.get('stash');
  if (!Array.isArray(stashObj) || sexprName(stashObj[0]) !== 'object') return null;
  return { stashObj, bindings };
}

// 'source' | 'plain' | 'unknown' | { kind: 'object', node } — what a stash
// value provably is. Identifier references chase module-level bindings.
function classifyStashValue(node, bindings, depth = 0) {
  if (depth > 8) return 'unknown';
  const name = sexprName(node);
  if (name != null) {
    if (/^["'\d]/.test(name) || name === 'true' || name === 'false' ||
        name === 'null' || name === 'undefined') return 'plain';
    if (bindings.has(name)) return classifyStashValue(bindings.get(name), bindings, depth + 1);
    return 'unknown';   // imported or otherwise invisible
  }
  if (!Array.isArray(node)) return 'unknown';
  const head = sexprName(node[0]);
  if (head === 'source') return 'source';       // application of the source() declarator
  if (head === 'object') return { kind: 'object', node };
  if (head === 'array') return 'plain';
  return 'unknown';
}

// Shared by `rip check` and the LSP: turn a file's hoisted gates into
// diagnostic records against the stash analysis. Lines/cols are 1-based
// (the LSP converts). Only provably-wrong paths produce records — see
// validateGatePath below for the conservative verdict rules.
export function collectGateDiagnostics(gates, source, analysis) {
  const out = [];
  if (!gates || !gates.length || !analysis) return out;
  const srcLines = source.split('\n');
  for (const g of gates) {
    const verdict = validateGatePath(g.path, analysis);
    if (verdict !== 'plain' && verdict !== 'missing') continue;
    const lineText = srcLines[g.line - 1] ?? '';
    const idx = lineText.indexOf('@app.data');
    const detail = verdict === 'missing'
      ? `'${g.path}' is not a key of the stash`
      : `'${g.path}' is a plain key`;
    out.push({
      line: g.line,
      col: (idx >= 0 ? idx : 0) + 1,
      len: idx >= 0 ? '@app.data.'.length + String(g.path).length : Math.max(lineText.trim().length, 1),
      message: `'${g.path} <~' does not resolve to a source (${detail}) — declare it with source() in app/stash.rip`,
      srcLine: lineText,
    });
  }
  return out;
}

// Verdict for one gate path against the stash literal:
// 'source' (ok), 'unknown' (silent), 'plain' / 'missing' (error).
// Walks segments through plain object literals; stops at the nearest
// source on the path (subpath gates bind under the loaded value).
export function validateGatePath(path, analysis) {
  let node = analysis.stashObj;
  for (const seg of String(path).split('.')) {
    const entries = new Map();
    let hasOpaqueEntries = false;
    for (const e of node.slice(1)) {
      const key = Array.isArray(e) && sexprName(e[0]) === ':' ? sexprName(e[1]) : null;
      if (key != null) entries.set(key, e[2]);
      else hasOpaqueEntries = true;   // spread / computed key — can't enumerate
    }
    if (!entries.has(seg)) return hasOpaqueEntries ? 'unknown' : 'missing';
    const c = classifyStashValue(entries.get(seg), analysis.bindings);
    if (c === 'source' || c === 'unknown' || c === 'plain') return c;
    node = c.node;   // plain object literal — walk deeper
  }
  return 'plain';    // path exhausted inside plain literals, no source found
}

// ── Route tree discovery ───────────────────────────────────────────
//
// The project's routes live under `<projectRoot>/app/routes/` — a fixed
// convention (not configurable) that matches `@rip-lang/server`'s
// `serve dir: "<root>/app"`, which mounts route files under `app/routes/`.
// Each `.rip` file there contributes one entry to a
// generated `__RipRoutes` template-literal union, used for typed
// `<a href: "...">`, typed `router.push`, and per-route `@params`
// tightening. Mirrors the runtime rules in `buildRoutes`
// (packages/app/index.rip): skip `_-prefixed` files, skip files
// inside `_-prefixed` directories, treat `index.rip` as `/`,
// `[id]` as a dynamic segment, `[...rest]` as catch-all.
const routesDirCache  = new Map(); // entryDir → absoluteRoutesDir|null
const routesTreeCache = new Map(); // routesDir → { entries, union }

// Invalidate the route-tree cache for the project containing `filePath`,
// or all projects when no path is given. Called by the LSP whenever a
// `.rip` file is added/removed/renamed so completions, hover, and
// diagnostics see the new route shape without a process restart.
export function invalidateRoutesCache(filePath) {
  if (!filePath) {
    routesDirCache.clear();
    routesTreeCache.clear();
    return;
  }
  // Cheap and correct: drop both caches. Reads are O(routes-dir scan),
  // and the caches refill on the next access. Pin-pointing the exact
  // entryDir would require re-running findEntryFile, which itself
  // caches; clearing wholesale avoids the dependency.
  routesDirCache.clear();
  routesTreeCache.clear();
}

export function findRoutesDir(filePath) {
  const entryFile = findEntryFile(filePath);
  if (!entryFile) return null;
  const root = dirname(entryFile);
  if (routesDirCache.has(root)) return routesDirCache.get(root);
  // Convention: `app/routes/`. Matches `@rip-lang/server`'s `serve dir:
  // "<root>/app"` pattern, which resolves routes under `app/routes/`.
  const dir = resolve(root, 'app/routes');
  const result = existsSync(dir) ? dir : null;
  routesDirCache.set(root, result);
  return result;
}

// Build per-route metadata and the `__RipRoutes` template-literal union.
// Each entry: { rel, file, pattern (TS expression), dynamic: [{name, catchAll}] }
export function walkRoutesDir(routesDir) {
  if (!routesDir) return { entries: [], union: 'never' };
  if (routesTreeCache.has(routesDir)) return routesTreeCache.get(routesDir);
  const entries = [];
  function walk(dir, segs) {
    let dirents;
    try { dirents = readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of dirents) {
      // Skip _-prefixed files (_layout.rip etc.) and dirs (shared
      // helpers, not pages). Same rule as runtime buildRoutes.
      if (e.name.startsWith('_')) continue;
      // Pathless route groups: a `(name)` directory organizes routes and
      // shares a _layout.rip without contributing a URL segment. Recurse
      // but don't add it to the path. Mirrors runtime fileToPattern.
      if (e.isDirectory()) walk(resolve(dir, e.name), /^\(.+\)$/.test(e.name) ? segs : [...segs, e.name]);
      else if (e.isFile() && e.name.endsWith('.rip')) {
        const base = e.name.slice(0, -'.rip'.length);
        const fileSegs = base === 'index' ? segs : [...segs, base];
        const dynamic = [];
        const displaySegs = [];
        const tsSegs = fileSegs.map(s => {
          let m = s.match(/^\[\.\.\.(\w+)\]$/);
          if (m) { dynamic.push({ name: m[1], catchAll: true }); displaySegs.push('$' + m[1]); return '${string}'; }
          m = s.match(/^\[(\w+)\]$/);
          if (m) { dynamic.push({ name: m[1], catchAll: false }); displaySegs.push('$' + m[1]); return '${string}'; }
          displaySegs.push(s);
          return s;
        });
        const path = '/' + tsSegs.join('/');
        const displayPath = '/' + displaySegs.join('/');
        const pattern = dynamic.length === 0
          ? JSON.stringify(path === '//' ? '/' : path)
          : '`' + (path === '//' ? '/' : path) + '`';
        const display = dynamic.length === 0
          ? null
          : '`' + (displayPath === '//' ? '/' : displayPath) + '`';
        entries.push({
          rel: relative(routesDir, resolve(dir, e.name)),
          file: resolve(dir, e.name),
          pattern,
          display,
          displayPath,
          dynamic,
        });
      }
    }
  }
  walk(routesDir, []);
  // Canonical order: index route ("/") first, then the rest by display
  // path, lexicographically. Filesystem walk order is undefined across
  // platforms — sorting here gives stable union order and a consistent
  // member sequence in completions, hovers, and error messages.
  entries.sort((a, b) => {
    if (a.displayPath === '/') return -1;
    if (b.displayPath === '/') return 1;
    return a.displayPath < b.displayPath ? -1 : a.displayPath > b.displayPath ? 1 : 0;
  });
  // Build union, deduping static patterns (template-literal patterns
  // are inherently distinct by structure). Catch-all routes
  // (`[...rest].rip`) are excluded — they're runtime 404 fallbacks,
  // not navigation targets, and including them as `/${string}` would
  // make the union accept any slash-prefixed string and defeat
  // typo-catching for every other route.
  const seen = new Set();
  const parts = [];
  for (const e of entries) {
    if (e.dynamic.some(d => d.catchAll)) continue;
    if (seen.has(e.pattern)) continue;
    seen.add(e.pattern);
    parts.push(e.pattern);
  }
  const union = parts.length ? parts.join(' | ') : 'never';
  const result = { entries, union };
  routesTreeCache.set(routesDir, result);
  return result;
}

// ── Shared helpers ─────────────────────────────────────────────────

// Detect type annotations (:: followed by space or =) ignoring comments,
// string literals, and prototype syntax (Class::method).
export function hasTypeAnnotations(source) {
  let inHeredoc = false;
  return source.split('\n').some(line => {
    // Track heredoc boundaries (''' or """)
    const ticks = (line.match(/'''|"""/g) || []);
    for (const t of ticks) inHeredoc = !inHeredoc;
    if (inHeredoc) return false;
    // Strip comment
    line = line.replace(/#.*$/, '');
    // Strip string literals (single and double quoted)
    line = line.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");
    return /::[ \t=]/.test(line) || /(?:^|export\s+)type\s+[A-Z]/.test(line.trimStart());
  });
}

export function countLines(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) if (str[i] === '\n') n++;
  return n;
}

// Validate a prop's default value against its declared type.
// Returns an error message string if invalid, null if OK or can't validate.
export function validatePropDefault(type, defVal) {
  // A string literal in either quote style: "a" or 'a'.
  const isStrLit = s => /^"[^"]*"$/.test(s) || /^'[^']*'$/.test(s);
  const strInner = s => s.slice(1, -1);
  const parts = type.split('|').map(s => s.trim());
  // String literal union: "a" | "b" | "c" (either quote style)
  if (parts.every(p => isStrLit(p))) {
    if (isStrLit(defVal) && !parts.some(p => strInner(p) === strInner(defVal))) {
      return `Type '${defVal}' is not assignable to type '${type}'`;
    }
    return null;
  }
  // Single type checks
  if (parts.length === 1) {
    const t = parts[0];
    if (t === 'boolean' && defVal !== 'true' && defVal !== 'false') {
      return `Type '${defVal}' is not assignable to type 'boolean'`;
    }
    if (t === 'number' && !/^-?\d+(\.\d+)?$/.test(defVal)) {
      return `Type '${defVal}' is not assignable to type 'number'`;
    }
    if (t === 'string' && !isStrLit(defVal)) {
      return `Type '${defVal}' is not assignable to type 'string'`;
    }
  }
  return null;
}

export function toVirtual(p) { return p + '.ts'; }
export function fromVirtual(p) { return p.endsWith('.rip.ts') ? p.slice(0, -3) : p; }

// Collect props used at a component usage site, including indented block lines.
// Returns { component, usedProps } or null if this line isn't a component usage.
// `componentDefs` is a Map<name, propInfo[]> (or any map with .has/.get on name).
export function collectUsageProps(srcLines, lineIndex, componentDefs) {
  const trimmed = srcLines[lineIndex].trimStart();
  const cm = trimmed.match(/^([A-Z]\w*)\b/);
  if (!cm) return null;
  const component = cm[1];
  if (/=\s*component\b/.test(trimmed)) return null;
  if (!componentDefs.has(component)) return null;

  // A prop is supplied either directly (`name: value`) or via a two-way
  // binding (`name <=> signal`, which compiles to `__bind_name__`). Both forms
  // satisfy a required prop, so both count as "used".
  const propRe = /(?:^|,)\s*(@?\w+)\s*(?::|<=>)/g;

  // Parse props on the usage line
  const rest = trimmed.substring(component.length);
  const usedProps = [];
  for (const m of rest.matchAll(propRe)) {
    usedProps.push(m[1]);
  }

  // Collect props from indented block lines below
  const baseIndent = srcLines[lineIndex].length - trimmed.length;
  for (let b = lineIndex + 1; b < srcLines.length; b++) {
    const bLine = srcLines[b];
    if (bLine.trim() === '') continue;
    const bIndent = bLine.length - bLine.trimStart().length;
    if (bIndent <= baseIndent) break;
    for (const m of bLine.trimStart().matchAll(propRe)) {
      usedProps.push(m[1]);
    }
  }

  return { component, usedProps };
}

// Parse component definitions from a DTS string.
// Returns Map<name, { props: [{ name, type, required }], hasIntrinsicProps?: boolean }>.
export function parseComponentDTS(dtsString) {
  const result = new Map();
  if (!dtsString) return result;
  const lines = dtsString.split('\n');
  let i = 0;
  while (i < lines.length) {
    // Match both `export declare class` and bare `declare class` — a non-exported
    // component is still a component, and its usage sites (same file) must be
    // prop-checked. The `^` anchor skips indented nested user classes; the
    // `constructor(props…)` check below is what actually marks a class a component.
    const cm = lines[i].match(/^(?:export )?declare class (\w+)/);
    if (!cm) { i++; continue; }
    const name = cm[1];
    const props = [];
    let hasIntrinsicProps = false;
    let inheritsTag = null;
    let isComponent = false;
    let j = i + 1;
    while (j < lines.length) {
      if (/^\}/.test(lines[j])) break;
      if (/constructor\(props\??/.test(lines[j])) {
        isComponent = true;
        if (lines[j].includes('__RipProps<')) hasIntrinsicProps = true;
        const tagMatch = lines[j].match(/__RipProps<'(\w+)'>/);
        if (tagMatch) inheritsTag = tagMatch[1];
        // Inline object type — the whole prop list lives between `{` and `}` on
        // this single line (`constructor(props?: { … });`, or `{}` when empty).
        // Parse it here; do NOT fall through to the multi-line reader, which
        // would otherwise treat the class's own reactive members as props.
        const inlineObj = lines[j].match(/constructor\(props\??:\s*\{([^}]*)\}/);
        if (inlineObj) {
          for (const seg of inlineObj[1].split(';')) {
            const pm = seg.match(/^\s*(\w+)(\?)?\s*:\s*(.+?)\s*$/);
            if (pm && !pm[1].startsWith('__bind_')) props.push({ name: pm[1], type: pm[3].trim(), required: !pm[2] });
          }
          j++;
          continue;
        }
        if (!lines[j].includes('{')) { j++; continue; }
        j++;
        while (j < lines.length) {
          if (lines[j].includes('__RipProps<')) hasIntrinsicProps = true;
          if (!inheritsTag) { const tm = lines[j].match(/__RipProps<'(\w+)'>/); if (tm) inheritsTag = tm[1]; }
          if (/^\s*\}\s*(?:&\s*.+)?\);\s*$/.test(lines[j])) { j++; break; }
          const pm = lines[j].match(/^\s+(\w+)(\?)?\s*:\s*(.+);$/);
          if (pm && !pm[1].startsWith('__bind_')) props.push({ name: pm[1], type: pm[3].trim(), required: !pm[2] });
          j++;
        }
        continue;
      }
      j++;
    }
    // A `constructor(props…)` is what makes this class a component. Register it
    // even with zero props, so a prop-less component (`constructor(props?: {});`)
    // still has its usage sites checked — passing it any prop is an error, not
    // silently accepted. Non-component classes (no props constructor) stay out.
    if (isComponent) result.set(name, { props, hasIntrinsicProps, inheritsTag });
    i = Math.max(i + 1, j);
  }
  return result;
}

// Check component prop definitions for untyped props and invalid defaults.
// Returns array of { line (0-based), col, len, message } error objects.
export function checkComponentDefs(compProps, srcLines, startLine = 0) {
  const errors = [];
  for (const prop of compProps) {
    for (let s = startLine; s < srcLines.length; s++) {
      const m = new RegExp('(@' + prop.name + ')\\??\\s*(::|([:!]?=))').exec(srcLines[s]);
      if (!m) continue;
      if (m[1 + 1] !== '::') {
        errors.push({ line: s, col: m.index, len: m[1].length, propName: prop.name, message: `Prop '${prop.name}' has no type annotation` });
      } else {
        const dm = srcLines[s].match(new RegExp('@' + prop.name + '\\??\\s*::\\s*(.+?)\\s*:=\\s*(.+)'));
        if (dm) {
          const defVal = dm[2].replace(/#.*$/, '').trim();
          const err = validatePropDefault(dm[1].trim(), defVal);
          if (err) {
            errors.push({ line: s, col: m.index, len: m[1].length, propName: prop.name, message: err });
          }
        }
      }
      break;
    }
  }
  return errors;
}

// Patch uninitialized, untyped variables with inferred types from their
// first assignment. This makes `let total; total = count + ratio;` behave
// like `let total: number;` — so a later `total = "string"` is caught.
// Called by both the LSP and the CLI type-checker to keep them aligned.
// Symbols mutated by the most recent patch pass. These are binder symbols that
// live on DocumentRegistry-shared SourceFiles, so they outlive program
// rebuilds; the `{ type }` we hang off them pins that program's entire type
// graph. We must release the previous pass's mutations before re-patching, or
// every rebuilt program leaks (~50MB/compile → GBs over an editing session).
let _patchedSyms = [];

export function patchUninitializedTypes(ts, service, compiledEntries) {
  const program = service.getProgram();
  if (!program) return;
  const checker = program.getTypeChecker();

  // Release the prior program's pinned types: restore each previously-patched
  // symbol to its original (non-transient, unresolved) state so the old program
  // becomes collectable. We re-patch against the current program below before
  // any diagnostics run, so inference is unaffected.
  for (const s of _patchedSyms) {
    try { s.flags &= ~ts.SymbolFlags.Transient; s.links = undefined; } catch {}
  }
  _patchedSyms = [];

  // Inject an inferred type onto an uninitialized local. Marking the symbol
  // Transient makes TypeScript read `symbol.links` directly (bypassing the
  // per-checker links array), so the type is visible to all checker functions.
  // Every mutated symbol is recorded so the next pass can release it.
  const setSymType = (sym, type) => {
    sym.flags |= ts.SymbolFlags.Transient;
    sym.links = { type };
    _patchedSyms.push(sym);
  };

  function patchStatements(stmts) {
    const uninitialized = new Map();
    for (const stmt of stmts) {
      if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          if (!decl.initializer && !decl.type && ts.isIdentifier(decl.name)) {
            const sym = checker.getSymbolAtLocation(decl.name);
            if (sym) uninitialized.set(decl.name.text, sym);
          }
        }
      }
      patchAssignment(stmt, uninitialized);
      // Recurse into function bodies (fresh scope)
      if (ts.isFunctionDeclaration(stmt) && stmt.body) {
        patchStatements(stmt.body.statements);
      }
      // Recurse into function expressions / arrows in known patterns:
      // - Variable initializers: const x = __computed(() => { ... })
      // - Call expression arguments: __effect(() => { ... })
      // Avoids broad ts.forEachChild to prevent patching unrelated nested scopes.
      const walkInitializersAndArgs = (node) => {
        if (!node) return;
        if ((ts.isFunctionExpression(node) || ts.isArrowFunction(node)) && node.body) {
          if (ts.isBlock(node.body)) patchStatements(node.body.statements);
          return;
        }
        // Variable declarations: recurse into each initializer
        if (ts.isVariableStatement(node)) {
          for (const decl of node.declarationList.declarations) {
            if (decl.initializer) walkInitializersAndArgs(decl.initializer);
          }
          return;
        }
        // Expression statements: recurse into the expression
        if (ts.isExpressionStatement(node)) {
          walkInitializersAndArgs(node.expression);
          return;
        }
        // Call expressions: recurse into each argument
        if (ts.isCallExpression(node)) {
          for (const arg of node.arguments) walkInitializersAndArgs(arg);
          // Also check the expression being called (e.g., chained calls)
          if (ts.isCallExpression(node.expression)) walkInitializersAndArgs(node.expression);
          return;
        }
        // Parenthesized: unwrap
        if (ts.isParenthesizedExpression(node)) {
          walkInitializersAndArgs(node.expression);
          return;
        }
        // Class declarations/expressions: recurse into property initializers and method bodies
        if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
          for (const member of node.members) {
            if (ts.isPropertyDeclaration(member) && member.initializer) {
              walkInitializersAndArgs(member.initializer);
            }
            if ((ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) && member.body) {
              patchStatements(member.body.statements);
            }
          }
          return;
        }
      };
      walkInitializersAndArgs(stmt);
    }
  }

  // Walk a statement (and nested blocks) looking for first assignments
  // to uninitialized variables. Shares the outer scope's map so that
  // assignments inside if/for/while/try/switch are discovered.
  function patchAssignment(stmt, uninitialized) {
    if (!uninitialized.size) return;
    // Unwrap parenthesized expressions: ({a, b} = ...) → {a, b} = ...
    const unwrap = (e) => ts.isParenthesizedExpression(e) ? unwrap(e.expression) : e;
    if (ts.isExpressionStatement(stmt)) {
      const expr = unwrap(stmt.expression);
      if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        if (ts.isIdentifier(expr.left)) {
          const name = expr.left.text;
          const sym = uninitialized.get(name);
          if (sym) {
            const rhsType = checker.getTypeAtLocation(expr.right);
            setSymType(sym, rhsType);
            uninitialized.delete(name);
          }
        } else if (ts.isObjectLiteralExpression(expr.left) || ts.isArrayLiteralExpression(expr.left)) {
          // Destructuring assignment: ({a, b} = {a: 1, b: "hello"})
          // Walk the LHS pattern and patch each identifier from the RHS type.
          const rhsType = checker.getTypeAtLocation(expr.right);
          const patchDestructured = (pattern, contextType) => {
            if (ts.isObjectLiteralExpression(pattern)) {
              for (const prop of pattern.properties) {
                if (ts.isShorthandPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                  const name = prop.name.text;
                  const sym = uninitialized.get(name);
                  if (sym) {
                    const propSym = contextType.getProperty(name);
                    if (propSym) {
                      const propType = checker.getTypeOfSymbol(propSym);
                      setSymType(sym, propType);
                      uninitialized.delete(name);
                    }
                  }
                } else if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.initializer)) {
                  const name = prop.initializer.text;
                  const sym = uninitialized.get(name);
                  if (sym) {
                    const key = ts.isIdentifier(prop.name) ? prop.name.text : undefined;
                    const propSym = key && contextType.getProperty(key);
                    if (propSym) {
                      const propType = checker.getTypeOfSymbol(propSym);
                      setSymType(sym, propType);
                      uninitialized.delete(name);
                    }
                  }
                }
              }
            } else if (ts.isArrayLiteralExpression(pattern)) {
              const tupleTypes = checker.getTypeArguments(contextType);
              for (let i = 0; i < pattern.elements.length; i++) {
                const el = pattern.elements[i];
                if (ts.isIdentifier(el)) {
                  const name = el.text;
                  const sym = uninitialized.get(name);
                  if (sym && tupleTypes && tupleTypes[i]) {
                    setSymType(sym, tupleTypes[i]);
                    uninitialized.delete(name);
                  }
                }
              }
            }
          };
          patchDestructured(expr.left, rhsType);
        }
      }
    }
    // Recurse into block-containing statements (but not functions — those get their own scope)
    const walkBlock = (node) => { if (node) { if (ts.isBlock(node)) node.statements.forEach(s => patchAssignment(s, uninitialized)); else patchAssignment(node, uninitialized); } };
    if (ts.isIfStatement(stmt)) { walkBlock(stmt.thenStatement); walkBlock(stmt.elseStatement); }
    if (ts.isForStatement(stmt) || ts.isForInStatement(stmt) || ts.isForOfStatement(stmt) || ts.isWhileStatement(stmt) || ts.isDoStatement(stmt)) walkBlock(stmt.statement);
    if (ts.isTryStatement(stmt)) { walkBlock(stmt.tryBlock); if (stmt.catchClause) walkBlock(stmt.catchClause.block); if (stmt.finallyBlock) walkBlock(stmt.finallyBlock); }
    if (ts.isSwitchStatement(stmt)) { for (const clause of stmt.caseBlock.clauses) clause.statements.forEach(s => patchAssignment(s, uninitialized)); }
    if (ts.isBlock(stmt)) stmt.statements.forEach(s => patchAssignment(s, uninitialized));
  }

  for (const [filePath, entry] of compiledEntries) {
    if (!entry.hasTypes) continue; // @ts-nocheck files skip diagnostics; no need to patch
    const sf = program.getSourceFile(toVirtual(filePath));
    if (!sf) continue;
    try { patchStatements(sf.statements); } catch (e) {
      console.warn(`[rip] patchTypes failed for ${filePath}: ${e.message}`);
    }
  }
}

// TS error codes to skip — structural artifacts of Rip's compilation model
// (DTS coexisting with compiled bodies, overload patterns, etc.)
export const SKIP_CODES = new Set([
  2389, // Function implementation name must match overload (DTS + compiled body)
  2391, // Function implementation is missing (DTS overload sigs separated from implementations)
  2567, // Enum declarations can only merge with namespace or other enum (DTS + compiled body)
  2842, // Unused renaming of destructured property (DTS overload has renamed param unused in declaration)
  // RFC 12 phase 2 — 1064 recovered. The async return type is now emitted
  // inline on the implementation (`async function f(): T`, src/compiler.js),
  // so TS1064 ("return type of async function must be Promise") fires on the
  // user's own annotation, position-mapped to source. It is no longer a global
  // mute: a genuinely mis-annotated async return (e.g. `:: string` instead of
  // `:: Promise<string>`) now surfaces, while a correct `:: Promise<T>` passes.
]);

// Dedup diagnostics by (start line/col, code).
// The same TS error can fire twice when the dts header and compiled body
// both contain the offending construct (e.g. an `import { X }` line that
// maps to the same source position from both copies), or when a diagnostic
// hits both an injected function overload signature and its implementation.
//
// The key intentionally excludes end position and message: the duplicates we
// want to collapse routinely differ in span length (overload sig vs impl
// token widths) and occasionally in message text (TS referencing different
// candidate signatures). Same start position + same code is the right
// invariant — distinct logical errors at the exact same (line, col, code)
// would be vanishingly rare and folding them is preferable to leaking
// structural duplicates.
//
// `getRange(d)` must return `{ startLine, startCol, endLine, endCol }`.
// Returns a new array; does not mutate the input. Preserves input object
// identity so callers can use Set membership to find which entries were
// dropped.
export function dedupDiagnostics(diags, getRange) {
  const seen = new Set();
  const out = [];
  for (const d of diags) {
    const r = getRange(d);
    const key = `${r.startLine}:${r.startCol}:${d.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}

// Codes that need conditional suppression (not blanket).
// 2300/2451: Suppress only when one endpoint is in the DTS header (structural).
//            Let through when both endpoints are in the compiled body (real shadowing).
// 2307:     Suppress only for @rip-lang/* and .rip imports (Rip resolves these).
//            Let through for genuinely broken npm/JS imports.
// 2582/2593: Suppress only in test files (test runner globals).
//            Let through in non-test files so typos like `test(...)` are caught.
export const CONDITIONAL_CODES = new Set([2300, 2451, 2307, 2582, 2593]);

// Shared conditional suppression logic — used by both CLI (runCheck) and LSP
// (publishDiagnostics). Returns true if the diagnostic should be suppressed.
//
// Parameters:
//   code       — TS diagnostic code (e.g. 2300, 2451, 2307)
//   start      — byte offset in the virtual .ts content
//   length     — byte length of the diagnostic span
//   tsContent  — the full virtual .ts content
//   headerLines — number of header lines in the virtual .ts
//   dts        — the .d.ts content (for identifier checks)
//   flatMessage — flattened diagnostic message string (only needed for 2307)
//   filePath   — original .rip file path (only needed for 2582/2593)
export function shouldSuppressConditional(code, start, length, tsContent, headerLines, dts, flatMessage, filePath, relatedInformation) {
  if (code === 2300 || code === 2451) {
    // Duplicate identifier: suppress when one endpoint is in the DTS header.
    const diagLine = offsetToLine(tsContent, start);
    if (diagLine < headerLines) return true; // diagnostic is on the header declaration

    // Body-side: if TS attached relatedInformation pointing at the other
    // declaration, trust it. When the *other* endpoint is also in the body
    // (same file), this is a real shadowing collision and must surface.
    if (Array.isArray(relatedInformation) && relatedInformation.length) {
      for (const r of relatedInformation) {
        if (r.start === undefined) continue;
        // Only consider related info in the same virtual file.
        if (r.file && r.file.text !== tsContent) continue;
        const rLine = offsetToLine(tsContent, r.start);
        if (rLine >= headerLines) return false; // body ↔ body collision — real bug
      }
      return true; // every related endpoint sits in the DTS header → structural
    }

    // Skip the dts-heuristic for import specifiers — TS doesn't double-emit
    // imports the way it does `def`/`class`, so a body-side 2300 on an import
    // name is real iff the same name is imported by 2+ body import statements.
    // (When only one body import has the name, the duplicate is the dts copy
    // that the typecheck virtual file injects, which is structural noise.)
    const lineStart = tsContent.lastIndexOf('\n', start - 1) + 1;
    const lineSoFar = tsContent.substring(lineStart, start);
    if (/^\s*import\b/.test(lineSoFar)) {
      const ident = length ? tsContent.substring(start, start + length).trim() : '';
      if (ident) {
        // Walk only body lines (past the dts header) and tally imports of `ident`.
        const bodyStart = (() => {
          let pos = 0, line = 0;
          while (line < headerLines && pos < tsContent.length) {
            const nl = tsContent.indexOf('\n', pos);
            if (nl < 0) return tsContent.length;
            pos = nl + 1; line++;
          }
          return pos;
        })();
        const body = tsContent.slice(bodyStart);
        const importRe = /^[ \t]*import\s+(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]*)\}\s+from\b/gm;
        let im, hits = 0;
        const wordRe = new RegExp('\\b' + ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
        while ((im = importRe.exec(body))) {
          if (wordRe.test(im[1])) hits++;
          if (hits > 1) break;
        }
        return hits < 2; // suppress only when there's no real body↔body collision
      }
      return false;
    }

    // Fallback when no relatedInformation: use the dts identifier heuristic.
    const ident = length ? tsContent.substring(start, start + length).trim() : '';
    if (ident && dts) {
      const escaped = ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp('\\b' + escaped + '\\b').test(dts)) return true; // structural — DTS vs body
    }
    return false; // Identifier not in DTS → real shadowing bug
  }
  if (code === 2307) {
    // Cannot find module: suppress only for @rip-lang/* and .rip imports
    const modMatch = flatMessage?.match(/Cannot find module '([^']+)'/);
    if (modMatch) {
      const mod = modMatch[1];
      if (mod.startsWith('@rip-lang/') || mod.endsWith('.rip')) return true;
    }
    return false; // Genuine broken import
  }
  if (code === 2582 || code === 2593) {
    // test/describe globals: suppress only in test files
    if (!filePath) return false;
    const base = filePath.replace(/.*[\/]/, '');
    if (/test|spec/i.test(base)) return true;
    if (/[\/](test|tests|spec|specs|__tests__)[\/]/i.test(filePath)) return true;
    return false;
  }
  return false;
}

// Maximum byte offset to scan for a `# @nocheck` comment at the top of a file.
// Long shebangs, license headers, or multi-line comments could push the directive
// further down, but 512 bytes covers typical preambles without scanning entire files.
export const NOCHECK_SCAN_LIMIT = 512;

// Check whether a diagnostic targets a compiler-generated _render() construction
// variable (_0, _1, …). These typed constants exist solely for prop type-checking
// and are never read — unused-variable diagnostics on them are spurious.
export function isRenderConstructionVar(tsContent, start, length) {
  if (!length) return false;
  const span = tsContent.substring(start, start + length);
  return /^_\d+$/.test(span.trim());
}

// Clean diagnostic messages to hide Rip compiler internals from users.
// Strips Signal<T>/Computed<T> wrappers, __bind_X__ property names, and
// removes __bind_*__ entries from inline type displays.
export function cleanDiagnosticMessage(msg) {
  // Remove __bind_*__ entries from inline type displays BEFORE unwrapping,
  // so they don't leave duplicates after the prefix is stripped.
  msg = msg.replace(/\s*__bind_\w+__\??\s*:\s*[^;}\n]+[;]\s*/g, ' ');
  // Unwrap Signal<T> and Computed<T> → T (handles nested wrappers)
  let prev;
  do {
    prev = msg;
    msg = msg.replace(/\b(Signal|Computed)<([^<>]*)>/g, '$2');
  } while (msg !== prev);
  // Strip any remaining __bind_X__ → X in property name references
  msg = msg.replace(/__bind_(\w+)__/g, '$1');
  // Clean intrinsic element type helper names from display
  msg = msg.replace(/\b__RipProps<['"](\w+)['"]>/g, '<$1> props');
  msg = msg.replace(/\s*&\s*__RipSvgAttrs\b/g, '');
  msg = msg.replace(/\b__RipElementMap\b/g, 'ElementMap');
  msg = msg.replace(/\b__rip(?:Svg)?El\b/g, 'element');
  // Rewrite verbose __ripEl tag union mismatch into a clean JSX-like message
  msg = msg.replace(
    /Argument of type '"([\w-]+)"' is not assignable to parameter of type '(?:__RipTag|[^']*\bkeyof HTMLElementTagNameMap\b[^']*)'\./,
    "'$1' is not a known element."
  );
  // Rewrite verbose __RipTag constraint error (e.g. component extends unknown element)
  msg = msg.replace(
    /Type '"([\w-]+)"' does not satisfy the constraint '(?:__RipTag|[^']*\bkeyof HTMLElementTagNameMap\b[^']*)'\./,
    "'$1' is not a known element."
  );
  // Deduplicate consecutive identical lines (unwrapping can collapse nested messages)
  msg = msg.split('\n').filter((line, i, arr) => i === 0 || line.trim() !== arr[i - 1].trim()).join('\n');
  // Remove redundant nested "Type 'X' is not assignable to type 'Y'" when
  // the parent already says "Type 'X | Z' is not assignable to type 'Y'"
  // and X is just one member of the union — the drill-down adds no information.
  const lines = msg.split('\n');
  if (lines.length >= 2) {
    const parentMatch = lines[0].match(/^Type '(.+)' is not assignable to type '(.+)'\.$/);
    if (parentMatch && parentMatch[1].includes(' | ')) {
      const members = parentMatch[1].split(' | ').map(s => s.trim());
      const filtered = lines.filter((line, i) => {
        if (i === 0) return true;
        const childMatch = line.trim().match(/^Type '(.+)' is not assignable to type '(.+)'\.$/);
        return !(childMatch && childMatch[2] === parentMatch[2] && members.includes(childMatch[1]));
      });
      msg = filtered.join('\n');
    }
  }
  return msg;
}

// Classify a route-related diagnostic so the message rewrite and the
// squiggle-snap use one consistent detection. Returns:
//   'el'    — anchor href mismatch (static __ripEl or dynamic __ripRoute)
//   'route' — programmatic router.push/replace mismatch
//   null    — unrelated diagnostic
//
// Detection is position-aware: a single source line can host both an anchor
// and an inline event handler (e.g. `a @click: () -> @router.push(...)`),
// so substring-checking the whole TS line is ambiguous. Instead we look at
// the call site immediately preceding the diagnostic's TS offset.
function classifyRouteDiagnostic(entry, start) {
  if (!entry?.tsContent || start == null) return null;
  const before = entry.tsContent.slice(Math.max(0, start - 64), start);
  if (/(?:__rip(?:Svg)?El|__ripRoute)\([^()]*$/.test(before)) return 'el';
  if (/\.(?:push|replace)\([^()]*$/.test(before)) return 'route';
  return null;
}

// Unify route diagnostics with the static __ripEl form so users see one
// consistent message shape regardless of which call site (anchor href,
// router.push, etc.) produced the error. Rewrites TS2345 "Argument of
// type 'X' is not assignable to parameter of type 'Y'." into TS2322
// "Type 'X' is not assignable to type 'Y | undefined'." Then prettifies
// `${string}` placeholders in route patterns to their source-form
// `$paramName` (from `[id].rip` → `$id`). Used by both the CLI
// (runCheck) and the LSP diagnostic publisher.
export function unifyRouteDiagnostic(code, message, entry, start, filePath) {
  const kind = classifyRouteDiagnostic(entry, start);
  const routesDir = filePath ? findRoutesDir(filePath) : null;
  const tree = routesDir ? walkRoutesDir(routesDir) : null;

  if ((kind === 'route' || kind === 'el') && code === 2345) {
    const m = message.match(/^Argument of type '([^']*(?:''[^']*)*)' is not assignable to parameter of type '([^']*(?:''[^']*)*)'\.$/);
    if (m) {
      code = 2322;
      message = `Type '${m[1]}' is not assignable to type '${m[2]} | undefined'.`;
    }
  }

  // Prettify ${string} placeholders in known route patterns.
  if (tree && message.includes('${string}')) {
    message = prettifyRoutePatterns(message, tree);
  }
  // Canonicalize route-union member order (TS normalizes unions, so the
  // order shifts between error contexts — pin to walkRoutesDir order).
  if (tree) message = canonicalizeRouteUnion(message, tree);
  return { code, message };
}

// Rewrite `${string}` placeholders in route patterns to their source-form
// `$paramName` (from `[id].rip` → `$id`). Used by diagnostics and hover.
export function prettifyRoutePatterns(text, tree) {
  if (!tree || !text || !text.includes('${string}')) return text;
  for (const e of tree.entries) {
    if (!e.display) continue;
    if (e.pattern !== e.display) text = text.split(e.pattern).join(e.display);
  }
  return text;
}

// Reorder route-union members to match walkRoutesDir order. TS normalizes
// unions internally, so the same set can render in different orders across
// hover and error contexts. Scans for runs of unioned string/template/
// undefined members, and if the run exactly covers the known route set
// (plus optional `undefined`), rewrites it in canonical order. Leaves
// unrelated unions untouched.
export function canonicalizeRouteUnion(text, tree) {
  if (!tree || !text || !text.includes(' | ')) return text;
  const canonical = [];
  const seen = new Set();
  for (const e of tree.entries) {
    if (e.dynamic.some(d => d.catchAll)) continue;
    const member = e.display || e.pattern;
    if (seen.has(member)) continue;
    seen.add(member);
    canonical.push(member);
  }
  if (canonical.length === 0) return text;
  const canonicalSet = new Set(canonical);
  const memberRe = /(?:"[^"]*"|`[^`]*`|undefined)/.source;
  const unionRe = new RegExp(`${memberRe}(?:\\s*\\|\\s*${memberRe})+`, 'g');
  return text.replace(unionRe, run => {
    const parts = run.split(/\s*\|\s*/);
    const hasUndefined = parts.includes('undefined');
    const nonUndef = parts.filter(p => p !== 'undefined');
    if (nonUndef.length !== canonical.length) return run;
    if (!nonUndef.every(p => canonicalSet.has(p))) return run;
    const ordered = hasUndefined ? [...canonical, 'undefined'] : canonical;
    return ordered.join(' | ');
  });
}

// Locate the best span for a route diagnostic in the source line. TS
// reports the span on the generated `__ripEl`/`__ripRoute` call, which
// source-maps back to imprecise positions. We snap to the meaningful
// token in the source:
//   - 'el'    → the `href` attribute name
//   - 'route' → the method name `push`/`replace`
export function locateRouteDiagnosticSpan(entry, start, srcLine) {
  const kind = classifyRouteDiagnostic(entry, start);
  if (kind === 'el') {
    const m = srcLine.match(/\bhref\b/);
    if (m) return { col: m.index, len: 4 };
  } else if (kind === 'route') {
    const m = srcLine.match(/\.(push|replace)\b/);
    if (m) return { col: m.index + 1, len: m[1].length };
  }
  return null;
}

// Base TypeScript compiler settings for type-checking. Callers can
// pass overrides (e.g. { strict: true } when a project opts in).
//
// Default `strict: false` aligns with Rip's stated philosophy
// ("optional, design scaffolding, not safety rails") and matches the
// gradual-typing default of comparable systems (Sorbet's `# typed: false`,
// mypy's permissive default, Hack's `partial`, TypeScript's own pre-strict
// default). Projects opt UP to strict via package.json's `rip.strict: true`,
// which implies noImplicitAny, strictNullChecks, and the rest of TS's strict
// family. Do NOT pin those flags to `false` here — that would shadow the
// strict-family inference when an opt-in caller passes `{ strict: true }`.
export function createTypeCheckSettings(ts, overrides = {}) {
  return {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowJs: true,
    strict: false,
    noEmit: true,
    skipLibCheck: true,
    ...overrides,
  };
}

// Collect ambient type packages (e.g. `@types/bun`, `@types/node`) by
// walking up from rootPath gathering every `node_modules/@types` dir.
// TS's default typeRoots only checks `<cwd>/node_modules/@types`, so a
// sub-package check would miss workspace-root ambients. Accepts symlinks
// because bun's nested-package layout symlinks `@types/bun` to
// `.bun/@types+bun@.../node_modules/@types/bun`.
//
// rip targets the Bun runtime, so `Bun`, `process`, `Buffer`, etc. are
// always present — rip ships `@types/bun` as a dependency and includes
// its own `node_modules/@types` last, so every project type-checks those
// globals without installing anything. A workspace that installs its own
// `@types/bun`/`@types/node` still wins: its dir is walked first and the
// name dedup below keeps that copy.
export function collectAmbientTypes(rootPath) {
  const typeRoots = [];
  const types = [];
  const scan = (cand) => {
    if (typeRoots.includes(cand) || !existsSync(cand)) return;
    typeRoots.push(cand);
    try {
      for (const entry of readdirSync(cand, { withFileTypes: true })) {
        if ((entry.isDirectory() || entry.isSymbolicLink()) && !entry.name.startsWith('.') && !types.includes(entry.name)) {
          types.push(entry.name);
        }
      }
    } catch {}
  };
  let dir = rootPath;
  while (true) {
    scan(resolve(dir, 'node_modules/@types'));
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // rip's own bundled ambients (this file lives at <rip-lang>/src/typecheck.js).
  scan(resolve(import.meta.dirname, '../node_modules/@types'));
  return { typeRoots, types };
}

// ── Param helpers ──────────────────────────────────────────────────

// Extract the text between the first balanced ( ) — handles nested parens
// so callback types like `(fn: (x: number) => void)` work correctly.
function extractFnParams(line) {
  const idx = line.indexOf('(');
  if (idx < 0) return null;
  let depth = 1, i = idx + 1;
  while (i < line.length && depth > 0) {
    if (line[i] === '(') depth++;
    else if (line[i] === ')') depth--;
    i++;
  }
  return depth === 0 ? line.slice(idx + 1, i - 1) : null;
}

// Replace the first balanced ( ) content in `line` with `newParams`.
function replaceFnParams(line, newParams) {
  const idx = line.indexOf('(');
  if (idx < 0) return line;
  let depth = 1, i = idx + 1;
  while (i < line.length && depth > 0) {
    if (line[i] === '(') depth++;
    else if (line[i] === ')') depth--;
    i++;
  }
  return depth === 0 ? line.slice(0, idx + 1) + newParams + line.slice(i - 1) : line;
}

// Depth-aware split of a parameter list on top-level commas. Respects
// nested parens, brackets, braces, and angle brackets so callback types
// like `(fn: (x: number) => void)` and generic types like `Map<K, V>`
// don't get split mid-argument.
//
// Angle brackets are tracked separately because `>` is ambiguous: it
// appears in `=>` (function-type arrow), `>=`/`>>`/`>=`, and as a
// generic-close. We only treat `<` as opening a generic when it
// follows an identifier-ending character (or another `<` for nested
// `Map<K, Set<V>>`); arrow `=>` is recognized and skipped before any
// angle handling. String/template/regex literals are skipped wholesale
// so commas inside them don't terminate a part.
function splitTopLevelParams(paramsStr) {
  const parts = [];
  let depth = 0;     // counts (), [], {}
  let angle = 0;     // counts <> when used as generics
  let start = 0;
  const isWordEnd = (i) => i > 0 && /[A-Za-z_$0-9>\]]/.test(paramsStr[i - 1]);
  const skipString = (i, quote) => {
    let k = i + 1;
    while (k < paramsStr.length && paramsStr[k] !== quote) {
      if (paramsStr[k] === '\\') k += 2; else k++;
    }
    return k;
  };
  for (let i = 0; i < paramsStr.length; i++) {
    const c = paramsStr[i];
    // Skip strings to avoid commas / brackets inside string defaults.
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(i, c);
      continue;
    }
    if (c === '(' || c === '[' || c === '{') { depth++; continue; }
    if (c === ')' || c === ']' || c === '}') { depth--; continue; }
    // Arrow `=>` — ignore the `>` so it doesn't decrement angle/depth.
    if (c === '=' && paramsStr[i + 1] === '>') { i++; continue; }
    if (c === '<' && isWordEnd(i)) { angle++; continue; }
    if (c === '>' && angle > 0) { angle--; continue; }
    if (c === ',' && depth === 0 && angle === 0) {
      parts.push(paramsStr.slice(start, i).trim());
      start = i + 1;
    }
  }
  const last = paramsStr.slice(start).trim();
  if (last.length > 0) parts.push(last);
  return parts;
}

// Find the top-level `= default` separator in a single parameter slot,
// skipping `=` inside destructured patterns (`{a = 1, b = 2}`) and inside
// type expressions. Returns the index of the `=` or -1 if none.
//
// A param shape is one of:
//   simple        — `name`, `name: T`, `name?: T`
//   rest          — `...rest`, `...rest: T[]`
//   destructured  — `{a, b}`, `{a, b}: {a: T, b: U}`, `[x, y]: [T, U]`
//
// The default arrives at the OUTERMOST level only, after the optional
// type annotation. Inside the destructured pattern's braces/brackets,
// `=` denotes per-property defaults (a JS pattern feature) and is not
// the slot's outer default — those belong to the destructured shape and
// don't survive the merge. Only the top-level `=` matters.
//
// Skips strings/templates and uses the same identifier-aware angle
// tracking as `splitTopLevelParams` so default expressions containing
// `=>`, `<`, `>`, comparisons, or generic types don't confuse depth.
function findOuterDefault(paramPart) {
  let depth = 0;
  let angle = 0;
  const isWordEnd = (i) => i > 0 && /[A-Za-z_$0-9>\]]/.test(paramPart[i - 1]);
  const skipString = (i, quote) => {
    let k = i + 1;
    while (k < paramPart.length && paramPart[k] !== quote) {
      if (paramPart[k] === '\\') k += 2; else k++;
    }
    return k;
  };
  for (let i = 0; i < paramPart.length; i++) {
    const c = paramPart[i];
    if (c === '"' || c === "'" || c === '`') { i = skipString(i, c); continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; continue; }
    if (c === ')' || c === ']' || c === '}') { depth--; continue; }
    if (c === '<' && isWordEnd(i)) { angle++; continue; }
    if (c === '>' && angle > 0) { angle--; continue; }
    if (c === '=' && depth === 0 && angle === 0) {
      // `==`, `===`, `!=`, `!==`, `>=`, `<=`, `=>` are operators, not
      // the default `=` separator.
      const prev = paramPart[i - 1];
      const next = paramPart[i + 1];
      if (next === '=' || next === '>') { i++; continue; }
      if (prev === '=' || prev === '!' || prev === '<' || prev === '>') continue;
      return i;
    }
  }
  return -1;
}

// Merge a DTS-emitted sig's params into the impl line's params, preserving
// the impl's default values. The DTS emits `name?: T` for parameters with
// JS defaults (because callers may omit them — that's the overload view),
// but inside the body the default ensures `name` is always defined, so the
// body should see `name: T = default`, not `name?: T`. This merge keeps the
// caller-facing overload `name?: T` and produces a body-facing impl where
// each defaulted slot becomes `name: T = default`. Non-defaulted impl
// params keep whatever the sig provided (`name?: T` for `?:: T` params,
// `name: T` for required typed params, bare `name` for untyped).
//
// Returns the merged param string, or `sigParams` unchanged if the impl
// has no top-level defaults to preserve.
function mergeSigWithImplDefaults(sigParams, implParams) {
  if (!implParams) return sigParams;
  const sigList = splitTopLevelParams(sigParams);
  const implList = splitTopLevelParams(implParams);
  if (sigList.length !== implList.length) return sigParams; // shape mismatch — bail
  let anyDefault = false;
  for (const p of implList) { if (findOuterDefault(p) >= 0) { anyDefault = true; break; } }
  if (!anyDefault) return sigParams;
  const merged = [];
  for (let i = 0; i < sigList.length; i++) {
    const sigPart = sigList[i];
    const implPart = implList[i];
    const eqIdx = findOuterDefault(implPart);
    if (eqIdx < 0) {
      // No top-level default in impl — use the sig form unchanged.
      merged.push(sigPart);
      continue;
    }
    const defaultExpr = implPart.slice(eqIdx + 1).trim();
    // Drop `?` from the sig param's name binding and append `= default`.
    // Pattern: NAME, NAME?: T, NAME: T, ...REST: T[], {a, b}: {...}, [x, y]: [...]
    const colonMatch = sigPart.match(/^(\s*(?:\.\.\.|))([A-Za-z_$][\w$]*|\{[\s\S]*?\}|\[[\s\S]*?\])(\?)?(\s*:\s*[\s\S]+)?$/);
    if (!colonMatch) {
      // Couldn't parse — keep sig form, append default conservatively.
      merged.push(`${sigPart} = ${defaultExpr}`);
      continue;
    }
    const prefix = colonMatch[1] || '';
    const name   = colonMatch[2];
    const tail   = colonMatch[4] || '';
    merged.push(`${prefix}${name}${tail} = ${defaultExpr}`);
  }
  return merged.join(', ');
}

// Extract the type parameter list (e.g. "<K extends string>") between the
// function name and the first `(`. Returns "" when none is present.
function extractTypeParams(sig) {
  const m = sig.match(/^(?:export\s+)?(?:async\s+)?function\s+\w+\s*(<[^(]*>)\s*\(/);
  return m ? m[1] : '';
}

// Inject `typeParams` between the function name and its `(` on an
// implementation line. No-op when `typeParams` is empty or the line
// already has type parameters.
function injectTypeParams(line, typeParams) {
  if (!typeParams) return line;
  const m = line.match(/^(\s*(?:export\s+)?(?:async\s+)?function\s+\w+)(\s*)([(<])/);
  if (!m || m[3] === '<') return line;
  return m[1] + typeParams + line.slice(m[0].length - 1);
}

// ── Shared compilation pipeline ────────────────────────────────────

// Compile a .rip file for type-checking. Prepends DTS declarations to
// compiled JS, detects type annotations, and builds bidirectional
// source maps. Returns everything both the CLI and LSP need.
// When opts.checkAll is true, all non-nocheck files are type-checked.
export function compileForCheck(filePath, source, compiler, opts = {}) {
  const result = compiler.compile(source, { sourceMap: true, types: 'emit', skipPreamble: true, stubComponents: true, inlineTypes: true, exactMarks: true });
  let code = result.code || '';
  let dts = result.dts ? result.dts.trimEnd() + '\n' : '';

  // ── Schema shadow reconciliation ──────────────────────────────────────
  // The compiled body keeps its runtime `const Name = __schema({...})`
  // bindings verbatim, so source maps stay exact. But in a `.ts` shadow that
  // body references an undeclared `__schema` (skipPreamble drops the runtime
  // import) and would also collide with the dts `declare const Name`. Rewrite
  // each schema `const` declaration into a `__schema` overload keyed on the
  // schema's `name` literal, so the body's `__schema({name:"Name",...})` call
  // resolves to the precise Schema/ModelSchema type with no duplicate binding.
  // The `type` aliases (NameValue/NameData/NameInstance) are kept untouched —
  // importers and the body both reference them.
  let usesSchemas = false;
  if (dts) {
    const overloads = [];
    const kept = [];
    for (const line of dts.split('\n')) {
      const m = line.match(/^(?:export )?declare const (\w+): (.+);\s*$/);
      if (m && /^(?:Schema<|ModelSchema<|\{ parse\()/.test(m[2])) {
        usesSchemas = true;
        overloads.push(`declare function __schema(d: { name: "${m[1]}"; [k: string]: any }): ${m[2]};`);
      } else {
        // Anonymous-schema overloads are emitted directly by the dts pass
        // (keyed on the descriptor's `__anon` marker); keep them, but they
        // still mark the file as schema-using so the `(d: any) => any`
        // fallback and registry declares are appended.
        if (/^declare function __schema\(/.test(line)) usesSchemas = true;
        kept.push(line);
      }
    }
    if (usesSchemas) {
      overloads.push('declare function __schema(d: any): any;');
      overloads.push('declare const SchemaError: any;');
      overloads.push('declare const __SchemaRegistry: any;');
      overloads.push('declare const __schemaSetAdapter: any;');
      dts = kept.join('\n').trimEnd() + '\n' + overloads.join('\n') + '\n';
    }
  }

  // Determine if this file should be type-checked.
  // A `# @nocheck` comment near the top of the file opts out entirely.
  // In strict mode, all non-nocheck files are type-checked.
  const nocheck = /^#\s*@nocheck\b/m.test(source.slice(0, NOCHECK_SCAN_LIMIT));
  // A file that declares schemas has an exportable type surface (its
  // `NameValue`/`NameInstance` aliases), so it must be checked even without
  // explicit `::`/`type` annotations — otherwise importers can't resolve those
  // names. `usesSchemas` is derived from the compiled dts, not a raw-source
  // regex, so it never false-fires on `schema` inside heredoc literals.
  const hasOwnTypes = !nocheck && (hasTypeAnnotations(source) || !!opts.checkAll || usesSchemas);
  let importsTyped = false;
  if (!hasOwnTypes && !nocheck) {
    const ripImports = [...source.matchAll(/from\s+['"]([^'"]*\.rip)['"]/g)];
    for (const m of ripImports) {
      const imported = resolve(dirname(filePath), m[1]);
      try {
        const impSrc = readFileSync(imported, 'utf8');
        if (hasTypeAnnotations(impSrc)) { importsTyped = true; break; }
      } catch {}
    }
  }
  const hasTypes = hasOwnTypes || importsTyped;
  if (!hasTypes) code = '// @ts-nocheck\n' + code;

  // Ensure every file is treated as a module (not a global script)
  if (!/\bexport\b/.test(code) && !/\bimport\b/.test(code)) code += '\nexport {};\n';

  // Interleave function overload signatures from DTS header into the code
  // section, immediately before their implementations. TypeScript requires
  // overload signatures adjacent to the implementation — without this, TS
  // reports error 2391 ("Function implementation is missing or not immediately
  // following the declaration"). Moving signatures into the code also enables
  // proper call-site type checking of function parameters.
  let headerDts = dts;
  if (hasTypes && dts && code) {
    const dl = dts.split('\n');
    const cl = code.split('\n');

    // RFC 12 phase 2 — the typed-local hoist is gone. It used to pull
    // `let X: T;` declarations out of the DTS header and merge the type onto
    // the body's function-local `let X` (a name-based, scope-ambiguous string
    // reconciliation). Inline emission made it redundant: the compiler now
    // annotates the function-top hoist for typed locals directly
    // (`collectTypedLocals`, src/compiler.js), `patchUninitializedTypes` types
    // any remaining uninitialized locals from their first assignment, and the
    // leftover header `let X: T;` lines have no source counterpart so their
    // diagnostics are already dropped. Removing the pass changes no verdict on
    // the corpus or the example apps (gated by test:types + the inference
    // cases in 11-inference.rip). True scope-shadowing of a module binding by a
    // same-named typed local stays a known name-based limitation, unchanged.

    const fnSigs = [];
    for (let i = 0; i < dl.length; i++) {
      const m = dl[i].match(/^(?:export\s+)?(?:declare\s+)?function\s+(\w+)/);
      if (m) fnSigs.push({ name: m[1], sig: dl[i], idx: i });
    }
    if (fnSigs.length > 0) {
      const injections = [];
      const moved = new Set();
      for (const fn of fnSigs) {
        // Match the impl in either of two shapes:
        //   1. top-level: `function NAME(`, `function NAME<`,
        //      `async function NAME(`, `export function NAME(`
        //   2. bare-name arrow assignment: `NAME = function(`,
        //      `NAME = async function(`, `NAME = function*(`
        // Pattern (2) is how Rip emits arrow assignments at module
        // scope: `name = (...) -> ...` becomes `name = function(...) {…}`.
        // We deliberately do NOT match `obj.NAME = function(`: the DTS
        // emits `declare function NAME(...)` only for module-scope,
        // bare-name arrow assignments. A property-style match would
        // pick up an unrelated `obj.NAME = ...` line that happens to
        // share the function name and apply the wrong signature there.
        const topLevelPat = new RegExp(`^(?:export\\s+)?(?:async\\s+)?function\\s+${fn.name}\\s*[(<]`);
        const arrowAssignPat = new RegExp(`^\\s*${fn.name}\\s*=\\s*(?:async\\s+)?function\\s*\\*?\\s*\\(`);
        for (let j = 0; j < cl.length; j++) {
          if (topLevelPat.test(cl[j]) || arrowAssignPat.test(cl[j])) {
            injections.push({ codeLine: j, sig: fn.sig });
            moved.add(fn.idx);
            break;
          }
        }
      }
      if (injections.length > 0) {
        injections.sort((a, b) => a.codeLine - b.codeLine);

        // Check if a DTS signature has an explicit return type after the params.
        function hasExplicitReturn(sig) {
          const idx = sig.indexOf('(');
          if (idx < 0) return false;
          let depth = 1, i = idx + 1;
          while (i < sig.length && depth > 0) {
            if (sig[i] === '(') depth++;
            else if (sig[i] === ')') depth--;
            i++;
          }
          return depth === 0 && sig.slice(i).includes(':');
        }

        // Check if any parameter in a DTS signature lacks a type annotation.
        // Used to suppress overload-sig injection: if a param is untyped, TS
        // will fire TS7006 on both the injected sig and the impl (same source
        // position, same code) — let it fire on the impl only.
        //
        // Each top-level param part is "typed" iff it contains a top-level `:`
        // outside of any nested (), [], {}, or <> groups. Destructured-rename
        // colons inside `{a: aliased}` don't count because they're nested.
        // Empty param lists are trivially "all typed".
        function hasUntypedParam(sig) {
          const params = extractFnParams(sig);
          if (params === null || params.trim() === '') return false;
          const parts = splitTopLevelParams(params);
          for (const part of parts) {
            if (!part) continue;
            // Skip TS `this: T` pseudo-param if it appears.
            if (/^this\s*:/.test(part)) continue;
            let depth = 0, angle = 0, hasColon = false;
            for (let i = 0; i < part.length; i++) {
              const c = part[i];
              if (c === '"' || c === "'" || c === '`') {
                // skip string literal
                const q = c; i++;
                while (i < part.length && part[i] !== q) {
                  if (part[i] === '\\') i++;
                  i++;
                }
                continue;
              }
              if (c === '(' || c === '[' || c === '{') { depth++; continue; }
              if (c === ')' || c === ']' || c === '}') { depth--; continue; }
              if (c === '=' && part[i + 1] === '>') { i++; continue; }
              if (c === '<' && i > 0 && /[A-Za-z_$0-9>\]]/.test(part[i - 1])) { angle++; continue; }
              if (c === '>' && angle > 0) { angle--; continue; }
              if (c === ':' && depth === 0 && angle === 0) { hasColon = true; break; }
            }
            if (!hasColon) return true;
          }
          return false;
        }

        // Extract the return type from a DTS signature (e.g. ": number" from
        // "function add(a: number, b: number): number;").
        function extractReturnType(sig) {
          const idx = sig.indexOf('(');
          if (idx < 0) return null;
          let depth = 1, i = idx + 1;
          while (i < sig.length && depth > 0) {
            if (sig[i] === '(') depth++;
            else if (sig[i] === ')') depth--;
            i++;
          }
          if (depth !== 0) return null;
          const rest = sig.slice(i).replace(/;?\s*$/, '').trim();
          return rest.startsWith(':') ? rest : null;
        }

        // RFC 12 phase 2 — retire the interleave for self-sufficient impls.
        // A single-signature `def` whose implementation already carries an
        // inline return type (emitted by the compiler, `inlineReturnType`) is
        // fully annotated in position: typed params come from the inline param
        // emitter and the return type sits on the impl. Such a function needs
        // neither the param/return copy nor an adjacent injected signature —
        // only the header `declare function` removed (already handled by
        // `moved`). This deletes the dual-artifact reconciliation for the
        // common case. Excluded, and thus kept on the full interleave:
        //   - true overloads (>1 signature for the name), whose adjacent
        //     signatures are load-bearing for call resolution;
        //   - generic functions (the impl does not emit `<T>` inline yet);
        //   - impls without an inline return type (e.g. arrow-assigned
        //     functions, which still ride the header).
        const sigCountByName = new Map();
        for (const inj of injections) {
          const nm = inj.sig.match(/function\s+(\w+)/)?.[1];
          if (nm) sigCountByName.set(nm, (sigCountByName.get(nm) || 0) + 1);
        }
        function isSelfSufficient(inj) {
          const nm = inj.sig.match(/function\s+(\w+)/)?.[1];
          if (!nm || sigCountByName.get(nm) !== 1) return false;
          if (extractTypeParams(inj.sig)) return false;
          const impl = cl[inj.codeLine];
          const braceIdx = impl.lastIndexOf('{');
          if (braceIdx < 0) return false;
          const head = impl.slice(0, braceIdx);
          const afterParen = head.slice(head.lastIndexOf(')') + 1).trim();
          return afterParen.startsWith(':');
        }

        // First pass: copy typed params AND return types from signatures to
        // implementations. Typed params give TS type info inside function bodies;
        // return types let TS verify the body matches the declared return.
        // When multiple sigs target the same codeLine (overloads), only apply
        // from the last one — that's the implementation signature whose types
        // should annotate the function body.
        // Self-sufficient impls (single-signature, inline-annotated, incl.
        // correctly-typed destructuring) need no copy at all — the inline
        // emitter already produced the full, valid signature. They skip both
        // the param/return copy here and the signature injection below; only
        // the header `declare` is removed (via `moved`). The copy still runs
        // for everything else (overloads, generics, arrow-assigned functions).
        const lastByLine = new Map();
        for (const inj of injections) lastByLine.set(inj.codeLine, inj);
        for (const inj of lastByLine.values()) {
          if (isSelfSufficient(inj)) continue;
          const sig = inj.sig.replace(/^declare /, '');
          const sigParams = extractFnParams(sig);
          if (sigParams !== null) {
            // Merge in the impl's default values BEFORE replacing — keeps
            // `name?: T` on the overload (caller view) but writes
            // `name: T = default` into the impl signature (body view) so
            // TypeScript sees the body's `opts` as `T`, not `T | undefined`.
            const implParams = extractFnParams(cl[inj.codeLine]);
            const merged = mergeSigWithImplDefaults(sigParams, implParams);
            cl[inj.codeLine] = replaceFnParams(cl[inj.codeLine], merged);
          }
          const typeParams = extractTypeParams(sig);
          if (typeParams) {
            cl[inj.codeLine] = injectTypeParams(cl[inj.codeLine], typeParams);
          }
          // RFC 12 phase 2: the implementation's return type is now emitted
          // inline by the compiler (`inlineReturnType`, src/compiler.js) when
          // the user wrote `def f():: T`, so the old brace-line splice that
          // re-derived `): T {` here is redundant for `def`. It is kept only
          // for impls that do NOT already carry an inline annotation (e.g.
          // arrow-assigned functions, whose return type still rides the
          // header) — guarded so it never double-annotates a `def`.
          const retType = extractReturnType(sig);
          if (retType) {
            const braceIdx = cl[inj.codeLine].lastIndexOf('{');
            if (braceIdx > 0) {
              const head = cl[inj.codeLine].slice(0, braceIdx).trimEnd();
              // Skip when the impl signature already ends in a return type —
              // the inline emitter (`def f():: T`) already annotated it. Check
              // the text after the params-closing `)` so a typed param inside
              // the list can't be mistaken for a return annotation.
              const afterParen = head.slice(head.lastIndexOf(')') + 1).trim();
              if (!afterParen.startsWith(':')) {
                cl[inj.codeLine] = head + retType + ' {';
              }
            }
          }
        }

        // Only inject overload signatures for functions with explicit return types
        // AND fully-typed params. Functions without a return type annotation let
        // TS infer the return from the implementation body — injecting an overload
        // would force it to `any`. Functions with any untyped param would fire
        // TS7006 twice (once on the injected sig, once on the impl) at the same
        // source position — skip the injection so the user sees a single error.
        const overloads = injections.filter(inj => !isSelfSufficient(inj) && hasExplicitReturn(inj.sig) && !hasUntypedParam(inj.sig));

        // Adjust reverseMap: each overload injection shifts subsequent code lines down by 1.
        // Compare against the original genLine (not genLine + offset) because bottom-up
        // splicing means only overloads at positions <= the original line shift it.
        if (result.reverseMap) {
          for (const [, entries] of result.reverseMap) {
            for (const entry of entries) {
              let offset = 0;
              for (const inj of overloads) {
                if (inj.codeLine <= entry.genLine) offset++;
              }
              entry.genLine += offset;
            }
          }
        }
        // Insert overload signatures bottom-up to preserve indices.
        // Strip 'declare ' — signatures must be non-ambient to match implementations.
        for (let k = overloads.length - 1; k >= 0; k--) {
          const sig = overloads[k].sig.replace(/^declare /, '');
          cl.splice(overloads[k].codeLine, 0, sig);
        }
        code = cl.join('\n');
        // Rebuild header DTS without the moved function signatures
        headerDts = dl.filter((_, i) => !moved.has(i)).join('\n').trimEnd() + '\n';
      }
    }
  }

  // Inject class field declarations and typed constructor params from DTS
  // into compiled class bodies. TypeScript ignores `declare class` when a
  // real `class` implementation exists, so fields must appear in the body.
  if (hasTypes && headerDts && code) {
    const dl = headerDts.split('\n');
    const cl = code.split('\n');
    // Parse declare class blocks from DTS header
    const classInfo = new Map();
    const classLineRanges = [];
    for (let i = 0; i < dl.length; i++) {
      const m = dl[i].match(/^(?:export\s+)?declare\s+class\s+(\w+)/);
      if (m) {
        const name = m[1];
        const fields = [];
        const startIdx = i;
        let j = i + 1;
        let ctorParams = null;
        const methods = [];
        while (j < dl.length && !dl[j].match(/^\}/)) {
          const fm = dl[j].match(/^\s+(\w+):\s+(.+);$/);
          if (fm) fields.push({ name: fm[1], type: fm[2] });
          const cm = dl[j].match(/^\s+constructor\((.+)\);$/);
          if (cm) ctorParams = cm[1];
          // Match method signatures like "  fetch(item: string);" or "  fetch(item: string): string;"
          const mm = dl[j].match(/^\s+(\w+)\((.+)\)(?::\s*.+)?;$/);
          if (mm && mm[1] !== 'constructor') methods.push({ name: mm[1], params: mm[2] });
          j++;
        }
        if (fields.length || ctorParams || methods.length) {
          classInfo.set(name, { fields, ctorParams, methods });
          classLineRanges.push({ start: startIdx, end: j });
        }
      }
    }
    if (classInfo.size > 0) {
      // Inject fields and typed constructor params into compiled class bodies
      const injections = [];
      for (let j = 0; j < cl.length; j++) {
        // Match `class Name {` (regular classes) and `const Name = class {` (components)
        const regularMatch = cl[j].match(/^(?:export\s+)?class\s+(\w+)/);
        const constMatch = !regularMatch && cl[j].match(/^(?:export\s+)?const\s+(\w+)\s*=\s*class\b/);
        const cm = regularMatch || constMatch;
        if (cm && classInfo.has(cm[1])) {
          const info = classInfo.get(cm[1]);
          // Inject field declarations, skipping any component fields already declared
          if (info.fields.length) {
            const existingFields = new Set();
            for (let k = j + 1; k < cl.length; k++) {
              if (cl[k].match(/^(?:export\s+)?(?:class|const)\s+\w+/) && k > j + 1) break;
              const fm = cl[k].match(/^\s+(?:declare\s+)?(\w+):\s+.+;(?:\s*\/\/.*)?$/);
              if (fm) existingFields.add(fm[1]);
              // Also match field assignments (e.g. `name = __computed(...)` in component stubs)
              const am = cl[k].match(/^\s+(\w+)\s*=\s+/);
              if (am) existingFields.add(am[1]);
              if (cl[k].match(/^\s+_init\s*\(/)) break;
            }
            const missingFields = info.fields.filter(f => !existingFields.has(f.name));
            const inj = missingFields.map(f => regularMatch
              ? `  ${f.name}: ${f.type};`
              : `  declare ${f.name}: ${f.type};`
            );
            if (inj.length) injections.push({ line: j + 1, lines: inj });
          }
          // Copy typed params into constructor (regular classes only; component constructors are already typed)
          if (regularMatch && info.ctorParams) {
            for (let k = j + 1; k < cl.length && k < j + 5; k++) {
              if (cl[k].match(/^\s+constructor\s*\(/)) {
                cl[k] = cl[k].replace(/constructor\s*\([^)]*\)/, `constructor(${info.ctorParams})`);
                break;
              }
            }
          }
          // Copy typed params into class methods (both regular and component classes)
          if (info.methods.length) {
            for (const meth of info.methods) {
              for (let k = j + 1; k < cl.length; k++) {
                if (cl[k].match(/^(?:export\s+)?(?:class|const)\s+\w+/) && k > j + 1) break;
                const re = new RegExp(`^(\\s+)${meth.name}\\s*\\([^)]*\\)`);
                if (re.test(cl[k])) {
                  cl[k] = cl[k].replace(new RegExp(`${meth.name}\\s*\\([^)]*\\)`), `${meth.name}(${meth.params})`);
                  break;
                }
              }
            }
          }
        }
      }
      // Insert field declarations bottom-up to preserve line indices
      for (let k = injections.length - 1; k >= 0; k--) {
        cl.splice(injections[k].line, 0, ...injections[k].lines);
      }
      // Remove declare class blocks from header DTS
      const removedLines = new Set();
      for (const range of classLineRanges) {
        for (let i = range.start; i <= range.end; i++) removedLines.add(i);
      }
      code = cl.join('\n');
      headerDts = dl.filter((_, i) => !removedLines.has(i)).join('\n').trimEnd() + '\n';
    }
  }

  // Remove non-exported `declare class X` blocks from the DTS header when the
  // code body has `X = class { ... }` (non-exported component stubs).  TS treats
  // `declare class X` as a class declaration and reports TS2629 when the body
  // later reassigns `X = class { ... }`.  The body's class expression already
  // contains all type info (from stubComponents), so the header block is redundant.
  if (hasTypes && headerDts && code) {
    const dl = headerDts.split('\n');
    const removedLines = new Set();
    for (let i = 0; i < dl.length; i++) {
      const m = dl[i].match(/^declare\s+class\s+(\w+)/);
      if (!m) continue;
      const name = m[1];
      if (!new RegExp('^' + name + '\\s*=\\s*class\\b', 'm').test(code)) continue;
      let j = i;
      while (j < dl.length && !dl[j].match(/^\}/)) j++;
      for (let k = i; k <= j; k++) removedLines.add(k);
    }
    if (removedLines.size > 0) {
      headerDts = dl.filter((_, i) => !removedLines.has(i)).join('\n').trimEnd() + '\n';
    }
  }

  // Copy typed constructor props parameter to _init(props) in component classes.
  // Components compile constructor(props: T) and _init(props) separately — TS
  // needs _init to have the same props type to avoid noImplicitAny.
  // The constructor type already includes __bind_xxx__ properties (typed as
  // Signal<T>), so no Record<string, any> widening is needed.
  if (hasTypes && code) {
    const cl = code.split('\n');
    let changed = false;
    for (let j = 0; j < cl.length; j++) {
      // Match: constructor(_props?: { ... }) or constructor(_props: { ... })
      const cm = cl[j].match(/^\s+constructor\(_props\??\s*:\s*(\{[^}]*\})\)/);
      if (cm) {
        const propsType = cm[1];
        // Find _init(props) in the same class
        for (let k = j + 1; k < cl.length; k++) {
          if (cl[k].match(/^((?:export\s+)?(?:const|class)\s+)/)) break;
          if (cl[k].match(/^\s+_init\(props\)\s*\{?\s*$/)) {
            // Check if the body actually uses `props`
            let usesProps = false;
            for (let m = k + 1; m < cl.length; m++) {
              if (/^\s+\}/.test(cl[m]) || /^((?:export\s+)?(?:const|class)\s+)/.test(cl[m])) break;
              if (/\bprops\b/.test(cl[m])) { usesProps = true; break; }
            }
            const paramName = usesProps ? 'props' : '_props';
            cl[k] = cl[k].replace('_init(props)', `_init(${paramName}: ${propsType})`);
            changed = true;
            break;
          }
        }
      }
      // For component classes without typed constructors, type _init(props) as any.
      // Check if the body actually uses `props` — if not, prefix with _ to suppress 6133.
      if (cl[j].match(/^\s+_init\(props\)\s*\{?\s*$/)) {
        let usesProps = false;
        for (let k = j + 1; k < cl.length; k++) {
          if (/^\s+\}/.test(cl[k]) || /^((?:export\s+)?(?:const|class)\s+)/.test(cl[k])) break;
          if (/\bprops\b/.test(cl[k])) { usesProps = true; break; }
        }
        const paramName = usesProps ? 'props' : '_props';
        cl[j] = cl[j].replace('_init(props)', `_init(${paramName}: Record<string, any>)`);
        changed = true;
      }
    }
    if (changed) code = cl.join('\n');
  }

  // RFC 12 phase 2 — the typed-param transfer for arrow-assigned functions is
  // gone. It copied params from a header `declare function name(...)` onto the
  // body's `name = function(...)` / `name = (...) =>` and dropped the header
  // line. Inline emission + the overload interleave subsume it: thin-arrow
  // assignments (`name = function(...)`) already carry inline params and have
  // their header `declare function` removed by the interleave's `moved` set,
  // while fat-arrow bindings reach the body typed via inline params and the
  // `let name: (...) => T` forward-decl (its duplicate-identifier diagnostic is
  // conditionally suppressed). Removing the pass changes no verdict across the
  // type corpus or the example apps (see the arrow-assigned negative test in
  // 06-functions.rip).

  // Annotate reactive/readonly/computed const assignments with their declared
  // types from the DTS header, and remove the corresponding `declare const`
  // from the header. This enables TypeScript to check initializer values
  // against type annotations: `const x: Signal<number> = __state("oops")`
  // produces a real type error, whereas two separate declarations
  // (`declare const x: Signal<number>` + `const x = __state("oops")`)
  // only produce a duplicate-identifier error (2451), which is suppressed.
  if (hasTypes && headerDts && code) {
    const dl = headerDts.split('\n');
    const cl = code.split('\n');
    const constTypes = new Map();

    for (let i = 0; i < dl.length; i++) {
      const m = dl[i].match(/^(?:export\s+)?declare\s+const\s+(\w+):\s+(.+);$/);
      if (m) { constTypes.set(m[1], { type: m[2], idx: i }); continue; }
      // Also merge `(export )?let X: T;` forward-decls from the DTS header
      // into matching body `(export )?const X = expr` declarations. dts.js
      // emits the `let` form for typed module-scope value bindings declared
      // via `name:: T = expr`. Without this merge, TS sees two separate
      // declarations (header `let` + body `const`) and loses the typed
      // identity on property access — e.g. `getStore()` returns `unknown`
      // instead of the declared `AsyncLocalStorage<T>`'s element type.
      const lm = dl[i].match(/^(?:export\s+)?let\s+(\w+):\s+(.+);$/);
      if (lm) constTypes.set(lm[1], { type: lm[2], idx: i });
    }

    if (constTypes.size > 0) {
      const movedDts = new Set();

      for (let j = 0; j < cl.length; j++) {
        const cm = cl[j].match(/^((?:export\s+)?const\s+)(\w+)(\s*=\s*)/);
        if (cm && constTypes.has(cm[2])) {
          const entry = constTypes.get(cm[2]);
          cl[j] = cm[1] + cm[2] + ': ' + entry.type + cm[3] + cl[j].slice(cm[0].length);
          movedDts.add(entry.idx);
        }
      }

      if (movedDts.size > 0) {
        code = cl.join('\n');
        headerDts = dl.filter((_, i) => !movedDts.has(i)).join('\n').trimEnd() + '\n';
      }
    }
  }

  // Ensure reactive preamble declarations are present when compiled code uses
  // reactive functions. emitTypes() sets the flags when typed reactive vars exist,
  // but files that import from typed modules may have untyped reactive vars whose
  // compiled code still references __state/__computed/__effect.
  if (hasTypes) {
    const bound = ripDestructuredNames(source);
    const needSignal = /\b__state\(/.test(code) && !/\bdeclare function __state\b/.test(headerDts) && !bound.has('__state');
    const needComputed = /\b__computed\(/.test(code) && !/\bdeclare function __computed\b/.test(headerDts) && !bound.has('__computed');
    const needEffect = /\b__effect\(/.test(code) && !/\bdeclare function __effect\b/.test(headerDts) && !bound.has('__effect');
    if (needSignal || needComputed || needEffect) {
      const decls = [];
      if (needSignal) {
        if (!/\binterface Signal\b/.test(headerDts)) decls.push(SIGNAL_INTERFACE);
        decls.push(SIGNAL_FN);
      }
      if (needComputed) {
        if (!/\binterface Computed\b/.test(headerDts)) decls.push(COMPUTED_INTERFACE);
        decls.push(COMPUTED_FN);
      }
      if (needEffect) decls.push(EFFECT_FN);
      headerDts = decls.join('\n') + '\n' + headerDts;
    }
    // Gated bindings (`x <~ @app.data.x`) stub as
    // `__computed(() => __ripGate(this.app.data.x))`. __ripGate is the
    // generic narrow — soundness is supplied by the runtime gate, which
    // loads the source before the component is constructed.
    if (/\b__ripGate\(/.test(code) && !/\bdeclare function __ripGate\b/.test(headerDts)) {
      headerDts = 'declare function __ripGate<T>(v: T | null | undefined): T;\n' + headerDts;
    }
  }

  // Inject declarations for Rip's stdlib globals (abort, assert, p, sleep, etc.)
  // so TypeScript doesn't report false "Cannot find name" (TS2304) errors.
  // These are normally emitted as globalThis assignments in the preamble, but
  // type-checking compiles with skipPreamble: true.
  //
  // Names are auto-derived from getStdlibCode() so new globals are picked up
  // automatically. Precise type overrides are provided where the generic
  // fallback (...args: any[]) => any would lose useful type information.
  if (hasTypes) {
    // Helper names auto-derived from getStdlibCode() so adding a stdlib
    // helper in stdlib.js automatically picks up a type declaration here.
    // The precise signatures live alongside the runtime bodies in
    // stdlib.js as STDLIB_TYPE_DECLS; helpers without an entry fall back
    // to a generic `(...args: any[]) => any` declaration.
    const names = [...getStdlibCode().matchAll(/globalThis\.(\w+)\s*\?\?=/g)].map(m => m[1]);
    const stdlibDecls = names.map(name =>
      STDLIB_TYPE_DECLS[name] || `declare function ${name}(...args: any[]): any;`
    );
    headerDts = stdlibDecls.join('\n') + '\n' + headerDts;

    // Inject declaration for toMatchable helper (emitted by =~ operator in preamble)
    if (/\btoMatchable\b/.test(code) && !/\btoMatchable\b/.test(headerDts)) {
      headerDts = 'declare function toMatchable(v: any, allowNewlines?: boolean): string;\n' + headerDts;
    }

    // Inject declaration for modulo helper (emitted by %% operator in preamble)
    if (/\bmodulo\b/.test(code) && !/\bdeclare .*\bmodulo\b/.test(headerDts)) {
      headerDts = 'declare function modulo(n: number, d: number): number;\n' + headerDts;
    }
  }

  // Inject intrinsic element type declarations for render block type-checking.
  // Uses TypeScript's built-in DOM types (HTMLElementTagNameMap, etc.) as the
  // source of truth for tag names, attribute types, and event handler types.
  // Skip type aliases if the DTS already includes them (types.js prepends for component files).
  if (hasTypes && (/\b__ripEl\b/.test(code) || /\b__RipProps\b/.test(headerDts))) {
    const alreadyHasTypes = /\btype __RipElementMap\b/.test(headerDts);
    const parts = alreadyHasTypes ? [INTRINSIC_FN_DECL] : [...INTRINSIC_TYPE_DECLS, INTRINSIC_FN_DECL];
    headerDts = parts.join('\n') + '\n' + headerDts;
  }

  if (hasTypes && /\bARIA\./.test(code) && !/\bdeclare const ARIA\b/.test(headerDts)) {
    headerDts = ARIA_TYPE_DECLS.join('\n') + '\n' + headerDts;
  }

  // Inline hoisted `let` declarations at their first assignment in the shadow
  // TS file, then merge DTS header types into the inlined declarations.
  //
  // Phase 1 — straight-line: scan same-indent lines from the hoisted `let`
  // downward, stopping at structural statements (if/for/while/etc.). This
  // handles the common case where assignment immediately follows declaration.
  //
  // Phase 2 — block-confined: for variables not resolved in phase 1, check
  // if the first assignment is inside a deeper block and ALL references to
  // the variable are confined to that block. If so, inline there. TS still
  // enforces block scoping in non-executed code, so we must verify the
  // variable isn't referenced after the block exits.
  //
  // DTS header types are merged during inlining: `let x: Type = value;`.
  // Header lines that were merged are removed afterward to avoid TS2454.
  if (hasTypes && code) {
    const cl = code.split('\n');
    const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Build DTS header type map for merging. The map is name-based,
    // and the inline-let pass below uses it to inject types into
    // function-top hoist `let X;` declarations.
    //
    // DTS-side collision: when the same name appears in multiple
    // `let X: T;` lines with different types (one per independent
    // function scope), `letTypes.set` would otherwise let the last
    // one win and silently apply the wrong type. Detect the conflict
    // and remove the name from the map so the inline-let pass leaves
    // those locals untyped (TS infers per-binding from the first
    // assignment, which is the correct fallback). The typed-local
    // hoist above also handles body-side ambiguity for the cases
    // where the inline-let pass doesn't fire.
    const letTypes = new Map();
    const ambiguousLetNames = new Set();
    const movedDts = new Set();
    let dl;
    if (headerDts) {
      dl = headerDts.split('\n');
      for (let i = 0; i < dl.length; i++) {
        const m = dl[i].match(/^(?:export\s+)?(?:declare\s+)?let\s+(\w+):\s+(.+);$/);
        if (!m) continue;
        const [, name, type] = m;
        const prev = letTypes.get(name);
        if (prev) {
          if (prev.type !== type) ambiguousLetNames.add(name);
          continue;
        }
        letTypes.set(name, { type, idx: i });
      }
      for (const name of ambiguousLetNames) letTypes.delete(name);
    }

    // Helper: inline a variable at the given line
    const doInline = (v, lineIdx, indent, rhs) => {
      const dts = letTypes.get(v);
      if (dts) {
        cl[lineIdx] = `${indent}let ${v}: ${dts.type} = ${rhs};`;
        movedDts.add(dts.idx);
      } else {
        cl[lineIdx] = `${indent}let ${v} = ${rhs};`;
      }
    };

    for (let i = 0; i < cl.length; i++) {
      const m = cl[i].match(/^(\s*)let\s+([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)\s*;\s*$/);
      if (!m) continue;
      // Only process hoist-position lets (first non-blank line after `{`, start
      // of file, or the module's import block — the compiler emits the
      // module-scope hoist right after the imports).
      let prev = null;
      for (let k = i - 1; k >= 0; k--) { if (cl[k].trim() !== '') { prev = cl[k]; break; } }
      if (prev !== null && !/\{\s*$/.test(prev) && !/^\s*import\b/.test(prev)) continue;

      const baseIndent = m[1];
      const vars = m[2].split(/\s*,\s*/);
      const inlined = new Set();
      const bailed = new Set();
      // Scope-end detection by indent: the enclosing block ends at the first
      // non-empty line whose indent is strictly less than baseIndent. This is
      // correct for compiler-generated JS where indentation reliably reflects
      // nesting. Regex-matching `}` at baseIndent was wrong because inner
      // block-closing braces (e.g. `  }` ending a nested `if`) sit at exactly
      // baseIndent and would terminate the scan prematurely. For top-level
      // hoists (baseIndent === ''), the scope is the whole file — never end.
      const baseIndentLen = baseIndent.length;
      const isScopeEnd = (line) => {
        if (baseIndentLen === 0) return false;
        if (line.trim() === '') return false;
        const li = line.match(/^(\s*)/)[1].length;
        return li < baseIndentLen;
      };

      // Phase 1: straight-line scan at base indent
      for (let j = i + 1; j < cl.length; j++) {
        const line = cl[j];
        if (line.trim() === '') continue;
        if (isScopeEnd(line)) break;
        // Skip deeper-indented lines
        if (line.startsWith(baseIndent + '  ')) continue;
        // Stop at structural statements (if/for/while/switch/try/do/function/class)
        if (/^\s*(?:if|for|while|switch|try|do|function|class)\s*[\s({]/.test(line)) break;
        if (/^\s*\} (?:else|catch|finally)/.test(line)) break;
        for (const v of vars) {
          if (inlined.has(v) || bailed.has(v)) continue;
          const ve = reEsc(v);
          const assignRe = new RegExp('^' + reEsc(baseIndent) + ve + '\\s*=(?!=)\\s*(.*);\\s*$');
          const assign = line.match(assignRe);
          if (assign) {
            doInline(v, j, baseIndent, assign[1]);
            inlined.add(v);
            continue;
          }
          if (new RegExp('\\b' + ve + '\\b').test(line)) bailed.add(v);
        }
        if (vars.every(v => inlined.has(v) || bailed.has(v))) break;
      }

      // Phase 2: block-confined scan for remaining variables
      for (const v of vars) {
        if (inlined.has(v) || bailed.has(v)) continue;
        const ve = reEsc(v);
        const vRe = new RegExp('\\b' + ve + '\\b');

        // Find the first reference and first assignment anywhere in the scope
        let firstRefLine = -1, foundAssign = null;
        for (let j = i + 1; j < cl.length; j++) {
          const line = cl[j];
          if (line.trim() === '') continue;
          if (isScopeEnd(line)) break;
          if (!vRe.test(line)) continue;
          if (firstRefLine < 0) firstRefLine = j;
          if (!foundAssign) {
            const lineIndent = line.match(/^(\s*)/)[1];
            const assignRe = new RegExp('^' + reEsc(lineIndent) + ve + '\\s*=(?!=)\\s*(.*);\\s*$');
            const am = line.match(assignRe);
            if (am) foundAssign = { line: j, indent: lineIndent, rhs: am[1] };
          }
          if (foundAssign) break;
        }

        if (!foundAssign) continue;
        if (foundAssign.indent === baseIndent) continue; // phase 1 territory
        if (firstRefLine !== foundAssign.line) continue;  // read before write

        // Find where the enclosing block exits (first line at indent < assignment indent)
        let blockEndLine = -1;
        for (let j = foundAssign.line + 1; j < cl.length; j++) {
          const line = cl[j];
          if (line.trim() === '') continue;
          if (isScopeEnd(line)) { blockEndLine = j; break; }
          const li = line.match(/^(\s*)/)[1];
          if (li.length < foundAssign.indent.length) { blockEndLine = j; break; }
        }

        // Check if the variable is referenced after the block exits
        let hasRefAfterBlock = false;
        if (blockEndLine >= 0) {
          for (let j = blockEndLine + 1; j < cl.length; j++) {
            const line = cl[j];
            if (line.trim() === '') continue;
            if (isScopeEnd(line)) break;
            if (vRe.test(line)) { hasRefAfterBlock = true; break; }
          }
        }

        if (hasRefAfterBlock) continue; // used outside the block — leave hoisted

        doInline(v, foundAssign.line, foundAssign.indent, foundAssign.rhs);
        inlined.add(v);
      }

      const remaining = vars.filter(v => !inlined.has(v));
      // Module-scope only: drop any var that still has a DTS-header decl
      // (`let name: T;`) from this untyped hoist. These are chiefly module-level
      // function bindings, whose assignment spans multiple lines
      // (`proxy = function(c) {` … `};`) and so never folds into a single
      // `let name: T = value;` line. The header decl is the single,
      // correctly-typed declaration and the body's later `name = …` assigns it;
      // leaving name in this hoist too would duplicate the module-scope binding,
      // and TS resolves to the untyped copy — dropping contextual typing for the
      // function's params and `this` (the redeclare is auto-suppressed, so the
      // symptom surfaces elsewhere). We deliberately keep the type on the header
      // decl rather than re-emitting it onto this synthetic hoist line: the
      // compiler source-maps the header's type name back to the real `name:: T`
      // annotation, so diagnostics/quick-fixes land on it — re-emitting here
      // would map them to the hoist's position instead. Function-body hoists are
      // left alone: their locals get types from the compiler's inline hoist.
      const kept = baseIndent === '' ? remaining.filter(v => !letTypes.has(v)) : remaining;
      cl[i] = kept.length ? `${baseIndent}let ${kept.join(', ')};` : '';
    }
    code = cl.join('\n');

    // Remove DTS header lines that were merged into body declarations
    if (movedDts.size > 0 && dl) {
      headerDts = dl.filter((_, i) => !movedDts.has(i)).join('\n').trimEnd() + '\n';
    }
  }

  // Typed stash: the project's `<root>/app/stash.rip` declares
  // `stash:: <Type> = ...`. We expose its inferred type as `__RipStash`
  // on the stash file's virtual module, then rewrite the per-component
  // `declare app: any` stub to point at it. Components get `app.data`
  // typed without writing anything ceremonial — just put the stash in
  // `app/stash.rip`.
  //
  // Two splices, both same-line so source maps are unaffected:
  //   1. Stash file — append `export type __RipStash = typeof stash;`
  //   2. Component files — replace `declare app: any` with the typed shape
  const stashFile = findStashFile(filePath);
  const isStash = stashFile && stashFile === filePath;

  if (isStash) {
    // For an ANNOTATED stash (`stash:: T = ...`) the DTS header hoists
    // `export let stash: <Type>;` so the type is visible everywhere. The
    // body emits either `let stash; ... stash = {...}` (no export) or
    // `export const stash = {...}` (with export). Both conflict with the
    // typed hoist — TS sees a redeclaration and the un-annotated body
    // wins, collapsing the inferred type to `{ items: never[], ... }`.
    // Rewrite both forms into a bare assignment to the already-declared
    // `stash`, preserving the contextual type.
    //
    // An UNANNOTATED stash (`export stash = ...`, the inference path —
    // source() keys carry their own types) hoists nothing, so the
    // body declaration must stay: removing it left `typeof stash` with no
    // `stash` at all.
    const stashHoisted = /(^|\n)\s*export\s+(let|const|var)\s+stash\s*:/.test(headerDts || '');
    if (stashHoisted) {
      const letRe = /^(\s*let\s+)([^;=]+);/m;
      code = code.replace(letRe, (full, prefix, names) => {
        const remaining = names.split(',').map(s => s.trim()).filter(n => n !== 'stash');
        return remaining.length ? `${prefix}${remaining.join(', ')};` : '';
      });
      code = code.replace(/^(\s*)export\s+const\s+stash\s*=/m, '$1stash =');
    }
    code += `\nexport type __RipStash = typeof stash;\n`;
  }

  if (code.includes('declare app: any')) {
    let typedApp = null;
    if (stashFile && !isStash) {
      const spec = entryImportSpec(filePath, stashFile);
      // data intersects the stash shape with the reserved stash methods
      // (inc/dec/…, peek/reset, and the source handle) so they carry
      // signatures and completion in typed projects.
      typedApp = `declare app: { data: import('${spec}').__RipStash & import('@rip-lang/app').StashMethods<import('${spec}').__RipStash>; components: any; routes: any; params: any; query: any; router: any }`;
    }
    if (typedApp) code = code.replace(/declare app: any/g, typedApp);
  }

  // `declare router: any` in the component stub is rewritten to the Router
  // type exported by @rip-lang/app. Always available — the package ships its
  // own DTS. Gated on a typed project (same `findEntryFile` check the stash
  // splice uses) to avoid touching untyped sources.
  if (code.includes('declare router: any') && findEntryFile(filePath)) {
    code = code.replace(
      /declare router: any/g,
      `declare router: import('@rip-lang/app').Router`,
    );
  }

  // ── Typed routes ─────────────────────────────────────────────────
  //
  // Three splices, all keyed off the project's `<routesDir>/` tree:
  //   1. Entry file — append `export type __RipRoutes = ...;` so every
  //      file in the project can reach it via
  //      `import('<entry>').__RipRoutes`.
  //   2. Per-route file (anything under <routesDir>/) — tighten the
  //      `params: any` slot in the typed `declare app:` line so
  //      `routes/users/[id].rip` sees `params: { id: string }`.
  //   3. Any typed file that uses `<a>` elements — override the
  //      INTRINSIC `__ripEl` declaration so anchor `href` is typed via
  //      a `const H extends string` conditional: if H is a literal
  //      starting with `/`, it must satisfy `__RipRoutes`; otherwise
  //      (external URLs `https:`/`mailto:`, fragments `#x`, dynamic
  //      `string`) it falls through to plain H. Also narrow
  //      `router.push` to `__RipRoutes` for typo-catching.
  const entryFile = findEntryFile(filePath);
  const routesDir = findRoutesDir(filePath);
  const isEntry   = entryFile && entryFile === filePath;
  const isRoute   = routesDir && filePath.startsWith(routesDir + pathSep);

  if (isEntry && routesDir) {
    const { union } = walkRoutesDir(routesDir);
    code += `\nexport type __RipRoutes = ${union};\n`;
  }

  // Per-route @params tightening: the component stub declares
  // `declare params: Record<string, string>`. For route files whose
  // filename carries dynamic segments (`[id].rip`, `[...rest].rip`),
  // replace that with a precise shape so typos like `@params.bogu`
  // are caught and `@params.id` narrows to `string` (the literal).
  if (isRoute && entryFile) {
    const { entries } = walkRoutesDir(routesDir);
    const me = entries.find(e => e.file === filePath);
    if (me && me.dynamic.length > 0) {
      const paramFields = me.dynamic
        .map(d => `${d.name}: string`)
        .join('; ');
      code = code.replace(
        /declare params: Record<string, string>/g,
        `declare params: { ${paramFields} }`,
      );
    }
  }

  // Anchor href + typed router.push/replace overrides. Spliced into the
  // DTS header (where `__RipProps` is defined) and the `declare router`
  // line (already rewritten above). Gated on the project having a
  // routes dir at all — without routes there's no `__RipRoutes` to
  // intersect with, so the default `string` href is what users get.
  if (routesDir && entryFile && findStashFile(filePath)) {
    // Reach __RipRoutes via the entry file's virtual module.
    const entrySpec = entryImportSpec(filePath, entryFile);
    const anchorRouteType = `import('${entrySpec}').__RipRoutes`;
    // Inline the routes union for diagnostics on __ripRoute (dynamic
    // interpolated hrefs). The static __ripEl path resolves the alias
    // already; for the helper-call path we inline so error messages
    // read "Argument of type '`/x/${number}`' is not assignable to
    // parameter of type '<actual route union>'" instead of '__RipRoutes'.
    const { union: inlineRoutesUnion } = walkRoutesDir(routesDir);

    // Declare a clean local alias for NavOpts so hover shows `NavOpts`
    // instead of `import("@rip-lang/app").NavOpts`. We *don't* alias
    // __RipRoutes — inlining the union directly into the push signature
    // makes hover and errors both show the actual list of routes,
    // avoiding the leak of an implementation-detail name.
    if (headerDts) {
      headerDts = `type NavOpts = import('@rip-lang/app').NavOpts;\n` + headerDts;
    }

    // Expose the route-path union under a clean, ambient `RoutePath` type so
    // app code can annotate data-driven hrefs (a nav array, props forwarded
    // to an anchor) without reaching into the internal `__RipRoutes` via the
    // entry path. Inject only when the file references `RoutePath` and does
    // not declare or import its own — a user-defined `RoutePath` always wins,
    // so there's no duplicate-identifier clash. Mirrors the conditional
    // header injection used for __state / __ripGate.
    if (headerDts
        && /\bRoutePath\b/.test(headerDts + code)
        && !/\b(?:type|interface)\s+RoutePath\b/.test(headerDts + code)
        && !/\bimport\b[^;\n]*\bRoutePath\b/.test(headerDts + code)) {
      headerDts = `type RoutePath = ${inlineRoutesUnion};\n` + headerDts;
    }

    // (a) Constrain <a href>: replace the INTRINSIC __ripEl declaration
    // with a const-H-generic version whose href slot conditionally
    // narrows to __RipRoutes for slash-prefixed literals. External
    // URLs (https:, mailto:, #frag) and dynamic `string` values fall
    // through to H. Error reads:
    //   Type '"/foo"' is not assignable to type '__RipRoutes | undefined'.
    if (headerDts) {
      const newFnDecl = `declare function __ripEl<K extends __RipTag, const H extends string = string>(tag: K, props?: __RipProps<K> & (K extends 'a' ? { href?: H extends \`/\${string}\` ? ${inlineRoutesUnion} : H } : {})): void;`;
      headerDts = headerDts.replace(
        /declare function __ripEl<K extends __RipTag>\(tag: K, props\?: __RipProps<K>\): void;/,
        newFnDecl,
      );
      // Strengthen __ripRoute: compiler wraps interpolated /-prefixed
      // anchor href values in __ripRoute(...) so TS checks the dynamic
      // template against __RipRoutes. Without this strengthening the
      // baseline passthrough lets every string through.
      headerDts = headerDts.replace(
        /declare function __ripRoute<const T extends string>\(s: T\): T;/,
        `declare function __ripRoute<const T extends ${inlineRoutesUnion}>(s: T): T;`,
      );
    }

    // (b) Route-check router.push / router.replace the same way as <a href>:
    // slash-prefixed string LITERALS must be a known route (typos caught, clean
    // route-list errors); dynamic strings and external URLs fall through. Build
    // query/hash URLs as `string` values rather than slash-prefixed literals.
    // Omit + re-add instead of intersection: intersecting overloaded methods
    // unions the parameter type (contravariance), which loses the narrowing.
    if (code.includes(`declare router: import('@rip-lang/app').Router`)) {
      const typedRouter = `declare router: Omit<import('@rip-lang/app').Router, 'push' | 'replace'> & { push<const P extends string>(url: P extends \`/\${string}\` ? ${inlineRoutesUnion} : P, opts?: NavOpts): void; replace<const U extends string>(url: U extends \`/\${string}\` ? ${inlineRoutesUnion} : U, opts?: NavOpts): void; }`;
      code = code.replace(
        /declare router: import\('@rip-lang\/app'\)\.Router(?![ &])/g,
        typedRouter,
      );
    }
  }

  // Dedupe imports: when the DTS header and the body import from the same
  // module specifier, TypeScript reports TS2300 (Duplicate identifier) for
  // every shared binding, which cascades and corrupts type resolution
  // elsewhere (e.g. `typeof <stateIdent>` collapses to `any`).
  //
  // We prefer to drop the *DTS-header* duplicate and keep the body's import:
  // the body import carries per-specifier source-map mappings (needed for
  // hover and go-to-definition on each imported name), while the DTS header
  // import has none. Dropping the body import would leave the source-map
  // entries pointing at a blanked line, breaking hover for type-only
  // imports like `import { RetryConfig } from '@rip-lang/http'`.
  //
  // Preserve line count on both sides so source maps stay aligned.
  if (hasTypes && headerDts && code) {
    const bodySpecs = new Set();
    for (const m of code.matchAll(/^\s*import\s+[^;]*?from\s+['"]([^'"]+)['"]\s*;?\s*$/gm)) {
      bodySpecs.add(m[1]);
    }
    if (bodySpecs.size > 0) {
      headerDts = headerDts.replace(/^(\s*)import\s+[^;]*?from\s+(['"])([^'"]+)\2\s*;?\s*$/gm, (full, _ws, _q, spec) => {
        return bodySpecs.has(spec) ? '' : full;
      });
    }
  }

  let tsContent = (hasTypes ? headerDts + '\n' : '') + code;
  const headerLines = hasTypes ? countLines(headerDts + '\n') : 1;

  // Build bidirectional line maps
  const { srcToGen, genToSrc, srcColToGen } = buildLineMap(result.reverseMap, result.map, headerLines);

  // Fix srcToGen entries that point to lines emptied by Phase 2 inlining.
  // When a hoisted `let` is inlined, its original line becomes empty (""), but
  // buildLineMap still maps source lines to that position.  Redirect to the
  // nearest non-empty alternative from srcColToGen.
  const tsLines = tsContent.split('\n');
  for (const [srcLine, genLine] of srcToGen) {
    if (genLine >= 0 && genLine < tsLines.length && tsLines[genLine] === '') {
      const colEntries = srcColToGen.get(srcLine);
      if (colEntries) {
        for (const e of colEntries) {
          if (e.genLine >= 0 && e.genLine < tsLines.length && tsLines[e.genLine] !== '') {
            srcToGen.set(srcLine, e.genLine);
            break;
          }
        }
      }
    }
  }

  // Snapshot code-section mappings before DTS mapping can overwrite them.
  // Needed by @ts-expect-error injection which must target code lines, not DTS.
  const codeSrcToGen = new Map(srcToGen);

  // Map DTS declaration lines back to source lines (bidirectional).
  // Covers: imports, let/var declarations, type aliases, interfaces, enums, classes.
  // This enables hover, go-to-definition, and diagnostics for type-only code.
  if (hasTypes && headerDts) {
    const dtsLines = headerDts.split('\n');
    const srcLines = source.split('\n');
    for (let i = 0; i < dtsLines.length; i++) {
      const line = dtsLines[i];

      // Map import lines by module path (from "..." or from '...')
      const importMatch = line.match(/^import\s+.+\s+from\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        const modulePath = importMatch[1];
        for (let s = 0; s < srcLines.length; s++) {
          if (srcLines[s].includes(modulePath) && /^import\s/.test(srcLines[s].trimStart())) {
            genToSrc.set(i, s);
            srcToGen.set(s, i);
            break;
          }
        }
        continue;
      }

      const m = line.match(/^(?:export\s+)?(?:declare\s+)?(?:let|var|type|interface|enum|class)\s+(\w+)/);
      if (!m) continue;
      const name = m[1];
      for (let s = 0; s < srcLines.length; s++) {
        const src = srcLines[s];
        if (new RegExp('\\b' + name + '\\s*::').test(src) ||
            new RegExp('^(?:export\\s+)?type\\s+' + name + '\\b').test(src) ||
            new RegExp('^(?:export\\s+)?interface\\s+' + name + '\\b').test(src) ||
            new RegExp('^(?:export\\s+)?enum\\s+' + name + '\\b').test(src) ||
            new RegExp('^(?:export\\s+)?' + name + '\\s*=\\s*component\\b').test(src)) {
          genToSrc.set(i, s);
          srcToGen.set(s, i);
          break;
        }
      }
    }
  }

  // Interpolate gaps — if src line A maps to gen line X and src line B maps to
  // gen line Y, fill src lines A+1..B-1 → gen lines X+1..Y-1. This gives hover
  // and diagnostics coverage for function body lines that the compiler didn't map.
  const mapped = [...srcToGen.entries()].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < mapped.length - 1; i++) {
    const [srcA, genA] = mapped[i];
    const [srcB, genB] = mapped[i + 1];
    const srcGap = srcB - srcA;
    const genGap = genB - genA;
    if (srcGap > 1 && genGap > 1 && srcGap <= genGap + 2) {
      for (let d = 1; d < srcGap; d++) {
        const gen = genA + d;
        if (!srcToGen.has(srcA + d) && gen < genB) {
          // Don't interpolate INTO the DTS header. Header lines must only
          // carry explicit DTS-back-mappings (or none); fabricating a mapping
          // here causes go-to-def to land on whatever source line happens to
          // fall in the gap (typically a doc comment).
          if (gen < headerLines) continue;
          srcToGen.set(srcA + d, gen);
          if (!genToSrc.has(gen)) {
            genToSrc.set(gen, srcA + d);
          }
        }
      }
    }
  }

  // Parse @rip-src annotations from _render() constructions.  These explicit
  // source-line markers override interpolated mappings so that per-prop type
  // errors land on the correct Rip source line.  Among multiple @rip-src
  // markers for the same source line, the first one wins (typically the
  // component constructor call rather than an __ripEl call).
  {
    const tsLines = tsContent.split('\n');
    const ripSrcSeen = new Set();
    for (let i = 0; i < tsLines.length; i++) {
      const m = tsLines[i].match(/\/\/ @rip-src:(\d+)$/);
      if (m) {
        const srcLine = parseInt(m[1], 10);
        genToSrc.set(i, srcLine);
        if (!ripSrcSeen.has(srcLine)) {
          ripSrcSeen.add(srcLine);
          srcToGen.set(srcLine, i);
        }
      }
    }
  }

  // Inject @ts-expect-error directives from Rip source into the generated
  // TypeScript.  This lets TypeScript natively suppress expected errors and
  // report TS2578 for unused directives — works in both CLI and LSP.
  if (hasTypes) {
    const srcLines = source.split('\n');
    const injects = [];
    for (let s = 0; s < srcLines.length; s++) {
      const m = srcLines[s].match(/^\s*#\s*(@ts-expect-error\b.*)/);
      if (m) {
        const nextSrc = s + 1;
        // Prefer @rip-src-enriched mapping (precise per-prop positions from
        // render stubs) when it points to the code section.  Fall back to
        // the code-section snapshot for lines without @rip-src markers.
        let genLine = srcToGen.get(nextSrc);
        if (genLine === undefined || genLine < headerLines) {
          genLine = codeSrcToGen.get(nextSrc);
        }
        if (genLine !== undefined) {
          injects.push({ genLine, srcLine: s, comment: `// ${m[1]}` });
        }
      }
    }
    if (injects.length > 0) {
      // Sort descending so bottom-up insertion doesn't shift earlier positions
      injects.sort((a, b) => b.genLine - a.genLine);
      const tsLines = tsContent.split('\n');
      for (const { genLine, srcLine, comment } of injects) {
        tsLines.splice(genLine, 0, comment);
        // Shift existing gen→src mappings at or after the insertion point
        const shifted = new Map();
        for (const [g, s] of genToSrc) shifted.set(g >= genLine ? g + 1 : g, s);
        shifted.set(genLine, srcLine);
        genToSrc.clear();
        for (const [g, s] of shifted) genToSrc.set(g, s);
        // Shift existing src→gen mappings that pointed at or past the insertion
        for (const [s, g] of srcToGen) {
          if (g >= genLine) srcToGen.set(s, g + 1);
        }
        srcToGen.set(srcLine, genLine);
        // Shift column-aware mappings
        for (const [, entries] of srcColToGen) {
          for (const e of entries) {
            if (e.genLine >= genLine) e.genLine++;
          }
        }
      }
      tsContent = tsLines.join('\n');
    }
  }

  return { tsContent, headerLines, hasTypes, srcToGen, genToSrc, srcColToGen, source, dts, sexpr: result.sexpr, gates: result.gates || [] };
}

// ── Source-position mapping helpers ────────────────────────────────
//
// These utilities turn a TypeScript-virtual-file offset (the TS language
// service hands us one per diagnostic) back into a Rip `{line, col}`
// position the user can navigate to. The virtual file has a compiler-
// injected header (declarations, intrinsics) plus the compiled body;
// each entry carries its own `genToSrc` / `srcToGen` / `srcColToGen`
// maps (built by buildLineMap in sourcemaps.js) plus the raw tsContent
// and original Rip source.
//
// Most of the complexity below is Rip-specific heuristics for cases
// where a single generated line maps to multiple source lines, or
// where the compiler injects code that has no direct source (hoisted
// `let` aggregates, overload signatures, switch-IIFE wrappers, etc.).

// When a switch expression is the implicit return of a function, the compiler
// wraps it in an IIFE: `return (() => { switch ... })()`.  Non-exhaustive
// switches produce TS2322 on the IIFE return, which source-maps to the `switch`
// line.  This helper detects that pattern and remaps the diagnostic to the
// function's return-type annotation (matching TS behaviour on the raw .ts).
// Returns { line, col, len } if remapped, or null if no adjustment needed.
export function adjustSwitchDiagnostic(source, pos, code) {
  if (code !== 2322) return null;
  const srcLines = source.split('\n');
  const line = srcLines[pos.line] || '';
  if (!/^\s*switch\b/.test(line)) return null;

  const switchIndent = line.match(/^(\s*)/)[1].length;
  for (let i = pos.line - 1; i >= 0; i--) {
    const defLine = srcLines[i];
    const defMatch = defLine.match(/^(\s*)def\b/);
    if (defMatch && defMatch[1].length < switchIndent) {
      // Found enclosing function — look for return-type annotation "):: Type"
      const retMatch = defLine.match(/\)\s*::\s*(\w+)\s*$/);
      if (retMatch) {
        const typeStart = defLine.lastIndexOf(retMatch[1]);
        return { line: i, col: typeStart, len: retMatch[1].length };
      }
      return { line: i, col: defMatch[1].length, len: 3 }; // fallback: highlight `def`
    }
    // Stop if we leave the indentation context
    if (/\S/.test(defLine) && !defLine.match(/^(\s*)/)[1].length && !/^\s*#/.test(defLine)) break;
  }
  return null;
}

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

// Check whether an offset falls on an injected function overload signature line
// (generated by compileForCheck, not from user code).  These are body lines that
// match `[export ][async ]function NAME(...): TYPE;` and are immediately followed
// by the matching implementation `[export ][async ]function NAME(...) ... {`.
//
// Note: we can't rely on `!genToSrc.has(line)` as a discriminator — the gap-fill
// interpolation in buildLineMap will fabricate a mapping for the injected line.
export function isInjectedOverload(entry, offset) {
  const tsLine = offsetToLine(entry.tsContent, offset);
  if (tsLine < entry.headerLines) return false;
  const lineText = getLineText(entry.tsContent, tsLine);
  const m = lineText.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/);
  if (!m) return false;
  if (!lineText.trimEnd().endsWith(';')) return false;
  // Confirm the next non-empty line is the implementation of the same function.
  const allLines = entry.tsContent.split('\n');
  for (let i = tsLine + 1; i < allLines.length; i++) {
    const next = allLines[i];
    if (next.trim() === '') continue;
    const nm = next.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/);
    return !!nm && nm[1] === m[1] && !next.trimEnd().endsWith(';');
  }
  return false;
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

// Detect whether `col` on a single generated line falls inside a string
// literal or a `//` line comment.  Used to penalize identifier matches
// that land inside non-code regions during source-map lookup.
function isInsideStringOrComment(text, col) {
  let inStr = false, q = '';
  for (let i = 0; i < col && i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === '`' && q === '`') { inStr = false; continue; }
      if (ch === q) inStr = false;
    } else if (ch === '/' && text[i + 1] === '/') {
      return true; // rest of line is a comment
    } else if (ch === '"' || ch === "'" || ch === '`') {
      inStr = true; q = ch;
    }
  }
  return inStr;
}

// Detect whether `col` on a Rip source line falls inside a `#` comment.
// Walks the line tracking string state (', ", """, ''') so a `#` inside a
// string literal isn't mistaken for the start of a comment. Used by the
// diagnostic remapper to reject false-positive identifier matches inside
// comments.
function isInsideRipComment(text, col) {
  let inStr = false, q = '', triple = false;
  for (let i = 0; i < col && i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (triple && ch === q && text[i + 1] === q && text[i + 2] === q) {
        inStr = false; triple = false; i += 2; continue;
      }
      if (!triple && ch === q) inStr = false;
    } else if (ch === '#') {
      return true;
    } else if (ch === '"' || ch === "'") {
      if (text[i + 1] === ch && text[i + 2] === ch) {
        inStr = true; q = ch; triple = true; i += 2;
      } else {
        inStr = true; q = ch;
      }
    }
  }
  return false;
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

    // Skip compiler-injected stdlib declarations (declare function warn, etc.)
    // — diagnostics on these lines are never user-authored and would incorrectly
    // match string literals or identifiers in the source.
    if (/^declare\s+function\s/.test(genLineText)) return null;

    // If genToSrc has a mapping for this header line (e.g. imports, declarations),
    // use it to target the correct source line for word matching.
    const mappedSrcLine = entry.genToSrc.get(tsLine);

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

      // If we have a direct line mapping, try that source line first
      if (mappedSrcLine !== undefined) {
        const m = re.exec(srcLines[mappedSrcLine]);
        if (m) return { line: mappedSrcLine, col: m.index };
        return { line: mappedSrcLine, col: genCol };
      }

      // For let/var declarations, the error word may appear on many source lines
      // (e.g. `Status` referenced in multiple variable annotations). Narrow the
      // search to the source line that declares the same variable.
      const letMatch = genLineText.match(/^(?:export\s+)?(?:declare\s+)?(?:let|var)\s+(\w+)/);
      if (letMatch) {
        const varName = letMatch[1];
        const varRe = new RegExp('\\b' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*::');
        for (let s = 0; s < srcLines.length; s++) {
          if (varRe.test(srcLines[s])) {
            const m = re.exec(srcLines[s]);
            if (m) return { line: s, col: m.index };
            return { line: s, col: 0 };
          }
        }
      }

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

  // Hoisted multi-variable `let` declaration (e.g. `let a, b, items, ...;`) —
  // the compiler aggregates variable declarations into one line with no useful
  // per-variable source mapping.  Detect the pattern (both top-level and inside
  // functions), extract the word at the offset, and find its assignment in
  // the Rip source.  Use the genToSrc mapping of the preceding TS line (the
  // function declaration) to scope the search and avoid matching a same-named
  // variable in a different function.
  const hoistLine = getLineText(entry.tsContent, tsLine);
  if (/^\s*let\s+[$\w]+\s*,/.test(hoistLine) && entry.source) {
    let hl = 0;
    for (let i = 0; i < entry.tsContent.length; i++) {
      if (hl === tsLine) { hl = i; break; }
      if (entry.tsContent[i] === '\n') hl++;
    }
    const hCol = offset - hl;
    const hWord = hoistLine.slice(hCol).match(/^[$\w]+/);
    if (hWord) {
      const word = hWord[0];
      const srcLines = entry.source.split('\n');
      const assignRe = new RegExp('^' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(?:::|=!|:=|~=|=)');

      // Scope the search: find the source line of the enclosing function by
      // checking genToSrc for the TS line just before the hoisted let.
      let searchStart = 0;
      if (entry.genToSrc) {
        for (let g = tsLine - 1; g >= 0; g--) {
          const s = entry.genToSrc.get(g);
          if (s !== undefined) { searchStart = s; break; }
        }
      }

      for (let s = searchStart; s < srcLines.length; s++) {
        if (assignRe.test(srcLines[s].trimStart())) {
          const col = srcLines[s].indexOf(word);
          if (col >= 0) return { line: s, col };
        }
      }
      // Variable is on a hoisted let but has no recognisable assignment in
      // the source (e.g. for-loop iterators, destructured names).  Return
      // null so callers skip it rather than producing a garbage mapping.
      return null;
    }
  }

  // Injected function overload signatures (e.g. `function fetchUser(id: number): Promise<User>;`)
  // have no genToSrc entry.  The backward-walk approximation below can map them to
  // wildly wrong source lines.  Extract the function name and find its `def` in the source.
  const bodyLine = getLineText(entry.tsContent, tsLine);
  if (entry.genToSrc.get(tsLine) === undefined && entry.source) {
    const overloadMatch = bodyLine.match(/^(?:async\s+)?function\s+(\w+)\s*\(/);
    if (overloadMatch && bodyLine.trimEnd().endsWith(';')) {
      const fnName = overloadMatch[1];
      const srcLines = entry.source.split('\n');
      const defRe = new RegExp('\\bdef\\s+' + fnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      for (let s = 0; s < srcLines.length; s++) {
        if (defRe.test(srcLines[s])) {
          const col = srcLines[s].indexOf(fnName);
          return { line: s, col: col >= 0 ? col : 0 };
        }
      }
    }
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
  // On ties, prefer the source line that genToSrc already identified (e.g.
  // from an @rip-src annotation) so that stub render-block expressions land
  // on their correct source lines instead of a sibling attribute line.
  if (entry.srcColToGen) {
    const origSrcLine = srcLine;
    let bestDist = Infinity;
    for (const [sl, entries] of entry.srcColToGen) {
      for (const e of entries) {
        if (e.genLine === tsLine) {
          const dist = Math.abs(e.genCol - genCol);
          if (dist < bestDist || (dist === bestDist && sl === origSrcLine)) {
            bestDist = dist;
            srcLine = sl;
            approx = e.srcCol + (genCol - e.genCol);
          }
        }
      }
    }
  }
  const srcText = entry.source ? getLineText(entry.source, srcLine) : '';
  // Synthetic anchor: `__ripRoute(...)` wraps an anchor href value for
  // dynamic route type-checking. The TS diagnostic span starts at the
  // call argument (a template literal), which has no clean source token
  // to land on — landing instead on the source `href:` keyword keeps
  // dynamic anchor diagnostics visually consistent with the static
  // `__ripEl` `href` case (TS2820 lands on the property identifier).
  // Map both the start and end offsets that fall anywhere inside a
  // `__ripRoute(...)` call to the bounds of the `href` keyword so the
  // squiggle length matches the static case (4 chars) instead of
  // spanning the whole compiled call expression.
  if (srcText) {
    const callStart = genText.lastIndexOf('__ripRoute(', genCol);
    if (callStart >= 0) {
      // Find matching `)` after the call
      let depth = 0, callEnd = -1;
      for (let i = callStart + '__ripRoute('.length - 1; i < genText.length; i++) {
        const ch = genText[i];
        if (ch === '(') depth++;
        else if (ch === ')') { depth--; if (depth === 0) { callEnd = i; break; } }
      }
      if (callEnd >= 0 && genCol <= callEnd + 1) {
        const m = srcText.match(/\bhref\b/);
        if (m) {
          // Heuristic for end offset: anchor at end of `href` (start + 4)
          // when the gen offset is inside the call body (past the opening
          // paren). For the start offset (at the opening paren or first
          // arg char), anchor at the start of `href`.
          const atOrBeforeArg = genCol <= callStart + '__ripRoute('.length;
          return { line: srcLine, col: atOrBeforeArg ? m.index : m.index + 4 };
        }
      }
    }
  }
  // Text-match: find the word at genCol in the gen line, then locate it in the source line
  if (srcText) {
    let wordAt = genText.slice(genCol).match(/^\w+/);
    // Quoted string literal (e.g. __ripEl('tag')) — peek inside the quotes
    if (!wordAt && (genText[genCol] === "'" || genText[genCol] === '"')) {
      wordAt = genText.slice(genCol + 1).match(/^\w+/);
    }
    if (wordAt) {
      let word = wordAt[0];
      // Compiler-injected `this.foo` / `ctx.foo` (component bodies, server
      // handlers): the diagnostic offset typically lands on `this`/`ctx`,
      // which doesn't exist in the Rip source. Peek past it and use the
      // member name instead so the squiggle anchors on the user-visible
      // identifier rather than falling through to a fuzzy fallback.
      if (word === 'this' || word === 'ctx') {
        const memberMatch = genText.slice(genCol).match(/^(?:this|ctx)\.([A-Za-z_$][\w$]*)\b/);
        if (memberMatch) {
          const idx = findNearestWord(srcText, memberMatch[1], approx);
          if (idx >= 0) return { line: srcLine, col: idx };
        }
      }
      let idx = findNearestWord(srcText, word, approx);
      // __bind_xxx__ → xxx: two-way binding props use mangled names in gen
      if (idx < 0 && word.startsWith('__bind_') && word.endsWith('__')) {
        word = word.slice(7, -2);
        idx = findNearestWord(srcText, word, approx);
      }
      if (idx >= 0) return { line: srcLine, col: idx };
    }
    if (genCol > 0 && (!wordAt || genCol >= genText.length)) {
      let wordBefore = genText.slice(0, genCol).match(/(\w+)$/);
      // Closing quote — peek inside to find the word (e.g. end of __ripEl('tag'))
      if (!wordBefore && (genText[genCol - 1] === "'" || genText[genCol - 1] === '"')) {
        wordBefore = genText.slice(0, genCol - 1).match(/(\w+)$/);
      }
      if (wordBefore) {
        let word = wordBefore[0];
        let idx = findNearestWord(srcText, word, approx - word.length);
        // __bind_xxx__ → xxx: two-way binding props use mangled names in gen
        if (idx < 0 && word.startsWith('__bind_') && word.endsWith('__')) {
          word = word.slice(7, -2);
          idx = findNearestWord(srcText, word, approx - word.length);
        }
        if (idx >= 0) return { line: srcLine, col: idx + word.length };
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

  // Word not found on mapped line (or line was empty) — search nearby lines
  // (handles cases where multiple source lines compress to one generated line,
  // e.g. constructor params, or srcLine is blank)
  {
    let wordFallback = genText.slice(genCol).match(/^\w+/);
    // Quoted string literal — peek inside the quotes (e.g. __RipProps<'inputz'>)
    if (!wordFallback && (genText[genCol] === "'" || genText[genCol] === '"')) {
      wordFallback = genText.slice(genCol + 1).match(/^\w+/);
    }
    if (wordFallback) {
      let word = wordFallback[0];
      if (word.startsWith('__bind_') && word.endsWith('__')) word = word.slice(7, -2);
      // Skip identifiers that exist only in generated TypeScript, never in
      // the Rip source: `this` (component bodies), `ctx` (server handlers),
      // and any `__`-prefixed runtime helper (`__state`, `__effect`,
      // `__ripEl`, ...). Searching for them across source lines reliably
      // finds false positives — most commonly the word `this` inside a `#`
      // comment. `value` is intentionally NOT skipped (it's a valid user
      // identifier; the `.value` signal-accessor case is handled by the
      // member-extraction fix in the primary word-match path above).
      // `__bind_xxx__` was already stripped to its user name above.
      if (word !== 'this' && word !== 'ctx' && !word.startsWith('__')) {
        const srcLines = entry.source.split('\n');
        const re = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
        for (let delta = 0; delta <= 10; delta++) {
          for (const d of delta === 0 ? [srcLine] : [srcLine + delta, srcLine - delta]) {
            if (d >= 0 && d < srcLines.length) {
              const m = re.exec(srcLines[d]);
              // Reject matches that fall inside a Rip `#` comment — they're
              // never the source of a type error.
              if (m && !isInsideRipComment(srcLines[d], m.index)) {
                return { line: d, col: m.index };
              }
            }
          }
        }
      }
    }
  }

  // When text matching failed entirely (generated identifier like _2 doesn't
  // exist in source), srcCol may land on whitespace or past EOL.  Fall back to
  // the first word on the source line so the diagnostic highlights something
  // meaningful (e.g. the component name on a `Button` line).
  if (srcText) {
    if (srcCol >= srcText.length || /^\s*$/.test(srcText.slice(srcCol, srcCol + 1))) {
      const firstWord = srcText.match(/^\s*(\w+)/);
      if (firstWord) return { line: srcLine, col: firstWord.index + firstWord[0].length - firstWord[1].length };
    }
  }
  return { line: srcLine, col: srcCol };
}

// Count top-level commas in `s` (depth 0 w.r.t. ()/[]/{}). Used to map a
// cursor onto the Nth argument / Nth property when retargeting completion
// offsets into object-literal call arguments.
function countTopLevelCommas(s) {
  let depth = 0, n = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) n++;
  }
  return n;
}

// Completion-offset fixup for inline object-literal call arguments, e.g.
// `@router.push('/', { ▮ })`. At a non-identifier cursor (empty slot, after
// a comma) the word-anchored `srcToOffset` has nothing to grab and lands on
// the call name, so TS returns the receiver's *members* (push, replace, …)
// instead of the object's contextually-typed *properties* (noScroll, …).
//
// Given the gen offset `srcToOffset` produced (which sits at/near the call
// name on the gen line), this walks the gen call to the same argument index
// and property slot the source cursor occupies and returns the corrected
// absolute offset. Returns the original offset unchanged when the cursor
// isn't in this situation, so callers can apply it unconditionally.
export function retargetObjectArgOffset(entry, srcLine, srcCol, genOffset) {
  if (!entry || genOffset == null || !srcLine) return genOffset;
  const before = srcLine.slice(0, srcCol);
  // On an identifier? Word-anchoring already mapped it precisely — leave it.
  if (/\w$/.test(before) || /^\w/.test(srcLine.slice(srcCol))) return genOffset;

  // Walk back to the enclosing object-literal `{`, tracking bracket depth.
  let depth = 0, objOpen = -1;
  for (let i = srcCol - 1; i >= 0; i--) {
    const ch = before[i];
    if (ch === '}' || ch === ')' || ch === ']') depth++;
    else if (ch === '{') { if (depth === 0) { objOpen = i; break; } depth--; }
    else if (ch === '(' || ch === '[') { if (depth === 0) return genOffset; depth--; }
  }
  if (objOpen < 0) return genOffset;
  // The object must be a call argument: a `name(` must precede it with only
  // argument text (no nested braces) between the `(` and this `{`.
  const head = before.slice(0, objOpen);
  const callM = head.match(/\.\s*\w+\s*\(([^(){}]*)$/);
  if (!callM) return genOffset;
  const argIndex = countTopLevelCommas(callM[1]);                 // object is this call-arg
  const propSlot = countTopLevelCommas(before.slice(objOpen + 1)); // commas before cursor in object

  // Gen side: locate the call paren near the mapped offset, then walk to the
  // same argument and the same property slot inside its object literal.
  const tsText = entry.tsContent;
  const lc = offsetToLineCol(tsText, genOffset);
  const genLine = tsText.split('\n')[lc.line];
  if (genLine == null) return genOffset;
  const callRe = /\.\s*\w+\s*\(/g;
  callRe.lastIndex = Math.max(0, lc.col - 4);
  const gm = callRe.exec(genLine);
  if (!gm) return genOffset;
  let i = gm.index + gm[0].length;  // just inside the call's `(`
  let d = 1, args = 0;
  // Advance to the start of argument `argIndex`.
  while (i < genLine.length && args < argIndex) {
    const ch = genLine[i];
    if (ch === '(' || ch === '[' || ch === '{') d++;
    else if (ch === ')' || ch === ']' || ch === '}') { d--; if (d === 0) return genOffset; }
    else if (ch === ',' && d === 1) args++;
    i++;
  }
  while (i < genLine.length && /\s/.test(genLine[i])) i++;
  if (genLine[i] !== '{') return genOffset;                       // arg isn't an object literal
  i++;                                                            // step inside the object
  // Skip `propSlot` top-level properties within the object.
  let pd = 1, props = 0;
  while (i < genLine.length && props < propSlot) {
    const ch = genLine[i];
    if (ch === '(' || ch === '[' || ch === '{') pd++;
    else if (ch === ')' || ch === ']' || ch === '}') { pd--; if (pd === 0) break; }
    else if (ch === ',' && pd === 1) props++;
    i++;
  }
  while (i < genLine.length && /\s/.test(genLine[i])) i++;
  return genOffset - lc.col + i;
}

// Completion-offset fixup for object-literal property *values* whose owning
// object spans several source lines that collapse to a single generated line.
// An implicit-object call block —
//   use serve
//     preload: '▮'
// — compiles to `use(serve({ …, preload: '' }))`, so srcToOffset maps the
// property's source line onto that one statement gen line but lands near the
// statement start, not inside the value string. Given the source line, the
// cursor column, and the gen offset srcToOffset produced, this finds the same
// `key: <quote>` on the gen line and returns the absolute gen offset at the
// matching spot inside the gen string — so TS can supply the contextually-typed
// string-literal completions. Returns genOffset unchanged outside this context.
export function retargetObjectValueOffset(entry, srcLine, srcCol, genOffset) {
  if (!entry || genOffset == null || !srcLine) return genOffset;
  const m = srcLine.match(/^(\s*)([\w$]+)(\s*:\s*)(["'])/);
  if (!m) return genOffset;
  const key = m[2];
  const strStart = m[0].length;             // src index just inside the opening quote
  if (srcCol < strStart) return genOffset;   // cursor isn't inside the value string
  const inStr = srcCol - strStart;           // characters into the string content

  const tsText = entry.tsContent;
  const lc = offsetToLineCol(tsText, genOffset);
  const genLine = tsText.split('\n')[lc.line];
  if (genLine == null) return genOffset;
  const re = new RegExp('\\b' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*["\']');
  const gm = re.exec(genLine);
  if (!gm) return genOffset;
  const genStrInside = gm.index + gm[0].length;   // just inside the gen opening quote
  return (genOffset - lc.col) + genStrInside + inStr;
}

// Map a Rip source (line, col) to a TypeScript virtual file byte offset.
// This is the forward direction: source → generated (used for hover, definition, etc.)
//
// `entry` must have: tsContent, source, srcToGen, srcColToGen (optional)
// Returns undefined if no mapping can be established.
export function srcToOffset(entry, line, col) {
  if (!entry) return undefined;
  let genLine = entry.srcToGen.get(line);
  let genColHint = -1;
  let bestSrcCol = -1;

  // Column-aware lookup
  if (entry.srcColToGen) {
    const colEntries = entry.srcColToGen.get(line);
    if (colEntries && colEntries.length > 0) {
      // Exact-column match wins regardless of genLine.  Sub-mapping anchors
      // for identifiers in arrow bodies, spreads, etc. legitimately land on
      // a different genLine than the statement's primary anchor; preferring
      // them when they line up exactly with the queried column avoids the
      // line-anchor filter (below) from discarding a precise mapping.
      const exact = colEntries.find(e => e.srcCol === col);
      if (exact) {
        genLine = exact.genLine;
        genColHint = exact.genCol;
        bestSrcCol = exact.srcCol;
      } else {
      // When srcToGen anchors this source line to a specific genLine, only
      // consider colEntries on that same genLine.  Stray entries on other
      // genLines (caused by upstream sub-mapping contamination across
      // adjacent statements) can otherwise yank the lookup into an unrelated
      // gen-line context.
      const anchoredGen = entry.srcToGen.get(line);
      const filtered = anchoredGen != null
        ? colEntries.filter(e => e.genLine === anchoredGen)
        : colEntries;
      const pool = filtered.length > 0 ? filtered : colEntries;
      let best = pool[0];
      for (const e of pool) {
        if (e.srcCol <= col && (best.srcCol > col || e.srcCol > best.srcCol)) best = e;
      }
      if (best.srcCol > col) {
        for (const e of pool) {
          if (Math.abs(e.srcCol - col) < Math.abs(best.srcCol - col)) best = e;
        }
      }
      genLine = best.genLine;
      genColHint = best.genCol;
      bestSrcCol = best.srcCol;
      }
    }
  }

  if (genLine === undefined) {
    let best = -1;
    for (const [s] of entry.srcToGen) if (s <= line && s > best) best = s;
    if (best < 0) return undefined;
    genLine = entry.srcToGen.get(best);
  }

  const srcLines = entry.source.split('\n');
  const genLines = entry.tsContent.split('\n');
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
      // When the word doesn't fall exactly on a mapped srcCol, extrapolate
      // the expected gen column from the nearest mapping entry.  This avoids
      // picking a same-named word inside a string literal that happens to be
      // closer to the raw source column.
      const expectedGenCol = useHint ? genColHint
        : genColHint >= 0 ? genColHint + (col - bestSrcCol) : col;
      // Penalize matches that fall inside string literals or line comments
      // so an identifier appearing both as a value reference and as quoted
      // text (e.g. `console.log "clicks:", clicks`) doesn't resolve into
      // the string portion — TS returns no hover for offsets inside strings.
      const STRING_PENALTY = 1e6;
      while ((m = re.exec(targetText)) !== null) {
        const inStr = isInsideStringOrComment(targetText, m.index);
        const dist = Math.abs(m.index - expectedGenCol) + (inStr ? STRING_PENALTY : 0);
        if (dist < bestDist) { bestDist = dist; bestCol = m.index; }
      }
      if (bestCol >= 0) {
        // If every match for `word` in the target line is inside a string
        // literal (so hover would return nothing) but we have a precise
        // mapping hint for this source position, prefer the hint. This is
        // what makes hover on `:foo` (which compiles to `Symbol.for("foo")`)
        // resolve to the `Symbol` identifier instead of the dead string.
        if (useHint && bestDist >= STRING_PENALTY) {
          return lineColToOffset(entry.tsContent, targetLine, genColHint);
        }
        return lineColToOffset(entry.tsContent, targetLine, bestCol);
      }

      // Fall back to original genLine if overload didn't match
      if (targetLine !== genLine) {
        const re1b = new RegExp('\\b' + escaped + '\\b', 'g');
        let m1b, bestCol1b = -1, bestDist1b = Infinity;
        while ((m1b = re1b.exec(genText)) !== null) {
          const inStr = isInsideStringOrComment(genText, m1b.index);
          const dist = Math.abs(m1b.index - expectedGenCol) + (inStr ? STRING_PENALTY : 0);
          if (dist < bestDist1b) { bestDist1b = dist; bestCol1b = m1b.index; }
        }
        if (bestCol1b >= 0) return lineColToOffset(entry.tsContent, genLine, bestCol1b);
      }

      // Word not on mapped line — search nearby generated lines
      for (let delta = 1; delta <= 5; delta++) {
        for (const tryLine of [genLine + delta, genLine - delta]) {
          if (tryLine < 0 || tryLine >= genLines.length) continue;
          const tryText = genLines[tryLine];
          const re2 = new RegExp('\\b' + escaped + '\\b', 'g');
          let m2, best2 = -1, bestDist2 = Infinity;
          while ((m2 = re2.exec(tryText)) !== null) {
            const inStr = isInsideStringOrComment(tryText, m2.index);
            const dist2 = Math.abs(m2.index - col) + (inStr ? STRING_PENALTY : 0);
            if (dist2 < bestDist2) { bestDist2 = dist2; best2 = m2.index; }
          }
          if (best2 >= 0) return lineColToOffset(entry.tsContent, tryLine, best2);
        }
      }

      // Neighbor-line fallback: when the word isn't on the mapped gen line or
      // nearby ±5 lines, check neighboring source lines for srcColToGen entries
      // that point to gen lines containing the word.  Handles multi-line
      // expressions collapsed to one gen line, bodiless overload signatures
      // mapped to wrong gen lines, etc.
      if (entry.srcColToGen) {
        const candidateGenLines = new Set();
        for (let d = 0; d <= 10; d++) {
          for (const sl of d === 0 ? [line] : [line - d, line + d]) {
            if (sl < 0) continue;
            const ce = entry.srcColToGen.get(sl);
            if (ce) {
              for (const e of ce) candidateGenLines.add(e.genLine);
            }
          }
        }
        // Also try gen lines near those candidates (overload signatures are
        // typically on the line just before the function body)
        const expanded = new Set(candidateGenLines);
        for (const gl of candidateGenLines) {
          for (let d = 1; d <= 3; d++) {
            expanded.add(gl - d);
            expanded.add(gl + d);
          }
        }
        let bestAlt = -1, bestAltCol = -1, bestAltDist = Infinity;
        for (const gl of expanded) {
          if (gl < 0 || gl >= genLines.length) continue;
          const altText = genLines[gl] || '';
          const re3 = new RegExp('\\b' + escaped + '\\b', 'g');
          let m3;
          while ((m3 = re3.exec(altText)) !== null) {
            const dist3 = Math.abs(m3.index - expectedGenCol);
            if (dist3 < bestAltDist) { bestAltDist = dist3; bestAltCol = m3.index; bestAlt = gl; }
          }
        }
        if (bestAltCol >= 0) return lineColToOffset(entry.tsContent, bestAlt, bestAltCol);
      }
    }
  }

  const genText = entry.tsContent.split('\n')[genLine] || '';
  if (col < genText.length) return lineColToOffset(entry.tsContent, genLine, col);
  return lineColToOffset(entry.tsContent, genLine, 0);
}

// Map a TypeScript diagnostic offset back to a Rip source line number.
// Returns -1 if the offset falls in the DTS header.
export function mapToSource(entry, offset) {
  const tsLine = offsetToLine(entry.tsContent, offset);
  if (tsLine < entry.headerLines) return -1;

  if (entry.genToSrc.has(tsLine)) return entry.genToSrc.get(tsLine);
  let best = -1;
  for (const [g] of entry.genToSrc) if (g <= tsLine && g > best) best = g;
  if (best >= 0) return entry.genToSrc.get(best) + (tsLine - best);
  return tsLine - entry.headerLines;
}

// ── Project config ─────────────────────────────────────────────────

// Read project config from the "rip" key in the nearest ancestor
// package.json. Returns { strict, checkAll, exclude, ... } merged from
// `package.json#rip`, plus `_configDir` marking where it was found.
//
// `strict`   — TS strictness family (noImplicitAny, strictNullChecks, …)
// `checkAll` — coverage policy: check every non-@nocheck file, not just
//              annotated ones. Independent of `strict`.
export function readProjectConfig(dir) {
  const config = {};
  try {
    let d = resolve(dir);
    while (true) {
      const pkgPath = resolve(d, 'package.json');
      if (existsSync(pkgPath)) {
        // The first package.json walking up is the project boundary — matching
        // the LSP's findProjectRoot and TypeScript's nearest-config resolution.
        // Apply its `rip` config if present, otherwise fall back to defaults;
        // either way stop here. We deliberately do NOT walk past it into
        // ancestors: a parent repo's config must not silently leak across a
        // project boundary (e.g. a standalone app nested inside a larger git
        // repo inheriting that repo's `strict`). Inheritance, if ever wanted,
        // should be opt-in and explicit rather than positional.
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        if (pkg.rip && typeof pkg.rip === 'object') Object.assign(config, pkg.rip);
        config._configDir = d;
        break;
      }
      const parent = dirname(d);
      if (parent === d) break;
      d = parent;
    }
  } catch (e) {
    console.warn(`[rip] readProjectConfig error: ${e.message}`);
  }
  return config;
}

// ── CLI batch type-checker ─────────────────────────────────────────

// Convert a simple glob pattern to a RegExp for matching relative paths.
// Supports: ** (any path segments), * (any within segment), ? (single char).
export function globToRegex(pattern) {
  let re = '';
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      re += '.*';
      i += 2;
      if (pattern[i] === '/') i++; // skip trailing slash after **
    } else if (c === '*') {
      re += '[^/]*';
      i++;
    } else if (c === '?') {
      re += '[^/]';
      i++;
    } else if (/[.\\^$+()[\]{}|]/.test(c)) {
      // Escape regex metacharacters so literal path chars match literally.
      // Matters for Rip's own route-dir syntax: `[id]`, `[...rest]`, `(app)`.
      re += '\\' + c;
      i++;
    } else {
      re += c;
      i++;
    }
  }
  return new RegExp('^' + re + '$');
}

function findRipFiles(dir, files = [], excludePatterns = [], rootDir = dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = resolve(dir, entry.name);
    if (excludePatterns.length > 0) {
      const rel = relative(rootDir, full);
      if (excludePatterns.some(p => p.test(rel))) continue;
    }
    if (entry.isDirectory()) findRipFiles(full, files, excludePatterns, rootDir);
    else if (entry.name.endsWith('.rip')) files.push(full);
  }
  return files;
}

const isColor = process.stdout.isTTY !== false;
const red     = (s) => isColor ? `\x1b[31m${s}\x1b[0m` : s;
const green   = (s) => isColor ? `\x1b[32m${s}\x1b[0m` : s;
const yellow  = (s) => isColor ? `\x1b[33m${s}\x1b[0m` : s;
const cyan    = (s) => isColor ? `\x1b[36m${s}\x1b[0m` : s;
const dim     = (s) => isColor ? `\x1b[2m${s}\x1b[0m`  : s;
const bold    = (s) => isColor ? `\x1b[1m${s}\x1b[0m`  : s;

export async function runCheck(targetDir, opts = {}) {
  const rootPath = resolve(targetDir);

  // Use rip's own catalog-pinned TypeScript (a dependency), never the
  // consumer's — so `rip check` and the editor type-check with the exact
  // same version. import('typescript') resolves from this file's location
  // (rip-lang's node_modules) regardless of the consumer's setup.
  let ts;
  try {
    ts = await import('typescript').then(m => m.default || m);
  } catch {
    console.error('TypeScript could not be loaded. Reinstall rip-lang (it ships TypeScript as a dependency).');
    return 1;
  }

  if (!existsSync(rootPath)) {
    console.error(red(`Error: directory not found: ${targetDir}`));
    return 1;
  }

  const ripConfig = readProjectConfig(rootPath);
  const strict   = ripConfig.strict   === true;
  const checkAll = ripConfig.checkAll === true;
  const excludeGlobs = Array.isArray(ripConfig.exclude) ? ripConfig.exclude : [];
  const excludePatterns = excludeGlobs.map(globToRegex);

  const allFiles = findRipFiles(rootPath, [], excludePatterns);
  if (allFiles.length === 0) {
    console.error(red(`No .rip files found in ${targetDir}`));
    return 1;
  }

  // Pre-scan: only compile files that have type annotations or are imported by typed files.
  // In strict mode, all non-nocheck files are type-checked.
  const typedFiles = new Set();
  const sourcesByPath = new Map();
  for (const fp of allFiles) {
    const source = readFileSync(fp, 'utf8');
    sourcesByPath.set(fp, source);
    const nocheck = /^#\s*@nocheck\b/m.test(source.slice(0, NOCHECK_SCAN_LIMIT));
    if (!nocheck && (hasTypeAnnotations(source) || checkAll)) typedFiles.add(fp);
  }

  // Include imports of typed files (files imported BY typed files)
  for (const fp of typedFiles) {
    const source = sourcesByPath.get(fp);
    const ripImports = [...source.matchAll(/from\s+['"]([^'"]*\.rip)['"]/g)];
    for (const m of ripImports) {
      const imported = resolve(dirname(fp), m[1]);
      if (sourcesByPath.has(imported)) typedFiles.add(imported);
      else if (existsSync(imported)) {
        const impSrc = readFileSync(imported, 'utf8');
        sourcesByPath.set(imported, impSrc);
        typedFiles.add(imported);
      }
    }
  }
  // Include files that import FROM typed files (consumers of typed modules)
  for (const [fp, source] of sourcesByPath) {
    if (typedFiles.has(fp)) continue;
    const nocheck = /^#\s*@nocheck\b/m.test(source.slice(0, NOCHECK_SCAN_LIMIT));
    if (nocheck) continue;
    const ripImports = [...source.matchAll(/from\s+['"]([^'"]*\.rip)['"]/g)];
    for (const m of ripImports) {
      const imported = resolve(dirname(fp), m[1]);
      if (typedFiles.has(imported)) { typedFiles.add(fp); break; }
    }
  }

  // Compile only typed files (and their imports)
  const compiled = new Map();
  let compileErrors = 0;

  for (const fp of typedFiles) {
    try {
      const source = sourcesByPath.get(fp);
      compiled.set(fp, compileForCheck(fp, source, new Compiler(), { checkAll }));
    } catch (e) {
      compileErrors++;
      const rel = relative(rootPath, fp);
      console.error(`${red('error')} ${cyan(rel)}: compile error — ${e.message}`);
    }
  }

  // Always compile the project's stash file (even when excluded), so its
  // `__RipStash` export is resolvable from typed components that consume it.
  // Diagnostics from the stash file are still suppressed via exclude when
  // emitting results — this only ensures cross-module type info is available.
  const seenStash = new Set();
  for (const fp of typedFiles) {
    const stashFile = findStashFile(fp);
    if (!stashFile || seenStash.has(stashFile)) continue;
    seenStash.add(stashFile);
    if (compiled.has(stashFile) || !existsSync(stashFile)) continue;
    try {
      const src = sourcesByPath.get(stashFile) ?? readFileSync(stashFile, 'utf8');
      const compiledStash = compileForCheck(stashFile, src, new Compiler(), { checkAll });
      compiledStash._typeOnly = true; // skip diagnostics — only here for cross-module types
      compiled.set(stashFile, compiledStash);
    } catch (e) {
      console.warn(`[rip] stash compile failed for ${stashFile}: ${e.message}`);
    }
  }

  // Always compile the project's entry file when routes exist, so its
  // `__RipRoutes` export is resolvable from typed route/layout files. The
  // entry file (server bin) is typically untyped — it just calls `start()` —
  // so it wouldn't otherwise be pulled into the typed set, and
  // `import('<entry>').__RipRoutes` would silently resolve to `any`,
  // disabling the route-typo check. Diagnostics from the entry are
  // suppressed via `_typeOnly` — only here as a cross-module type carrier.
  const seenEntry = new Set();
  for (const fp of typedFiles) {
    const entryFile = findEntryFile(fp);
    if (!entryFile || seenEntry.has(entryFile)) continue;
    seenEntry.add(entryFile);
    if (!findRoutesDir(fp)) continue;
    if (compiled.has(entryFile) || !existsSync(entryFile)) continue;
    try {
      const src = sourcesByPath.get(entryFile) ?? readFileSync(entryFile, 'utf8');
      const compiledEntry = compileForCheck(entryFile, src, new Compiler(), { checkAll });
      compiledEntry._typeOnly = true;
      compiled.set(entryFile, compiledEntry);
    } catch (e) {
      console.warn(`[rip] entry compile failed for ${entryFile}: ${e.message}`);
    }
  }

  // Also compile any .rip files imported from typed files that aren't yet compiled
  for (const [fp, entry] of [...compiled.entries()]) {
    if (!entry.hasTypes) continue;
    const ripImports = [...entry.source.matchAll(/from\s+['"]([^'"]*\.rip)['"]/g)];
    for (const m of ripImports) {
      const imported = resolve(dirname(fp), m[1]);
      if (!compiled.has(imported) && existsSync(imported)) {
        try {
          const impSrc = readFileSync(imported, 'utf8');
          compiled.set(imported, compileForCheck(imported, impSrc, new Compiler()));
        } catch (e) {
          console.warn(`[rip] cross-module compile failed for ${imported}: ${e.message}`);
        }
      }
    }
  }

  // ── @rip-lang/* package resolution ─────────────────────────────────
  //
  // When a typed file imports from `@rip-lang/foo` (or `@rip-lang/foo/sub`),
  // resolve the specifier via Node module resolution rooted at the project,
  // and if it lands on a `.rip` entry, compile that entry with
  // compileForCheck so its exported annotations become visible to TS as
  // a virtual `.rip.ts` module. Diagnostics from the package itself are
  // suppressed (`_typeOnly = true`) — package internals are checked when
  // the package is checked, not when its consumers are.
  const pkgRequire = createRequire(resolve(rootPath, 'package.json'));
  const pkgSpecCache = new Map(); // spec → resolved abs path | null
  function resolvePkgSpec(spec) {
    if (pkgSpecCache.has(spec)) return pkgSpecCache.get(spec);
    let resolved = null;
    try {
      const r = pkgRequire.resolve(spec);
      if (typeof r === 'string' && r.endsWith('.rip') && existsSync(r)) resolved = r;
    } catch {}
    pkgSpecCache.set(spec, resolved);
    return resolved;
  }

  // ── Undeclared-import diagnostic (`rip check` surface) ──
  // Same check as the loader and bundler — surfaced earlier when typing is on.
  // The project's own `package.json#name` is treated as a self-import (covers
  // in-package fixtures/tests like `packages/server/bench/index.rip`).
  let undeclaredCount = 0;
  try {
    const projPkgPath = resolve(rootPath, 'package.json');
    if (existsSync(projPkgPath)) {
      const projPkg = JSON.parse(readFileSync(projPkgPath, 'utf8'));
      const declared = new Set([
        ...Object.keys(projPkg.dependencies         || {}),
        ...Object.keys(projPkg.devDependencies      || {}),
        ...Object.keys(projPkg.peerDependencies     || {}),
        ...Object.keys(projPkg.optionalDependencies || {}),
      ]);
      const selfName = projPkg.name || null;
      const reported = new Set();
      for (const [fp, entry] of compiled) {
        if (entry._typeOnly) continue;
        for (const spec of scanRipPkgImports(entry.tsContent || entry.source)) {
          const pkgKey = ripPkgRoot(spec);
          if (pkgKey === selfName) continue;
          if (declared.has(pkgKey)) continue;
          const key = `${fp}::${pkgKey}`;
          if (reported.has(key)) continue;
          reported.add(key);
          const rel = relative(rootPath, fp);
          console.error(`${red('error')} ${cyan(rel)}: import of '${pkgKey}' is not declared in package.json. Run \`bun add ${pkgKey}\` (or use \`workspace:*\` inside this monorepo).`);
          undeclaredCount++;
        }
      }
    }
  } catch (e) {
    console.warn(`[rip] undeclared-import check failed: ${e.message}`);
  }
  const pendingPkgFiles = new Set();
  for (const [, entry] of compiled) {
    const text = entry.tsContent || entry.source;
    for (const spec of [...scanRipPkgImports(text), ...scanRipPkgImportTypes(text)]) {
      const r = resolvePkgSpec(spec);
      if (r && !compiled.has(r)) pendingPkgFiles.add(r);
    }
  }
  // Iterate transitively: package files may themselves import other
  // @rip-lang/* entries. Bounded by the number of unique resolved paths.
  while (pendingPkgFiles.size) {
    const next = pendingPkgFiles.values().next().value;
    pendingPkgFiles.delete(next);
    if (compiled.has(next)) continue;
    try {
      const pkgSrc = readFileSync(next, 'utf8');
      const compiledPkg = compileForCheck(next, pkgSrc, new Compiler());
      compiledPkg._typeOnly = true;
      compiled.set(next, compiledPkg);
      const pkgText = compiledPkg.tsContent || pkgSrc;
      for (const spec of [...scanRipPkgImports(pkgText), ...scanRipPkgImportTypes(pkgText)]) {
        const r = resolvePkgSpec(spec);
        if (r && !compiled.has(r)) pendingPkgFiles.add(r);
      }
    } catch (e) {
      console.warn(`[rip] @rip-lang package compile failed for ${next}: ${e.message}`);
    }
  }

  // Check for unresolved relative imports in all files (not just typed ones),
  // and validate render gates (<~) against the stash's source-key set.
  const stashAnalyses = new Map();
  const stashAnalysisFor = (fp) => {
    const stashFile = findStashFile(fp);
    if (!stashFile) return null;
    if (!stashAnalyses.has(stashFile)) {
      const entry = compiled.get(stashFile);
      stashAnalyses.set(stashFile, entry?.sexpr ? collectStashAnalysis(entry.sexpr) : null);
    }
    return stashAnalyses.get(stashFile);
  };

  const fileResults = [];
  let totalErrors = 0, totalWarnings = 0;
  for (const [fp, source] of sourcesByPath) {
    const srcLines = source.split('\n');
    const errors = [];
    for (let s = 0; s < srcLines.length; s++) {
      if (/^\s*#/.test(srcLines[s])) continue;
      const m = srcLines[s].match(/^(?:import|export)\b.*from\s+['"](\.\.?\/[^'"]+)['"]/);
      if (!m) continue;
      const imported = resolve(dirname(fp), m[1]);
      if (!existsSync(imported)) {
        const col = srcLines[s].indexOf(m[1]);
        errors.push({ line: s + 1, col: col + 1, len: m[1].length, message: `Cannot find module '${m[1]}'`, severity: 'error', code: 'rip', srcLine: srcLines[s], related: [] });
        totalErrors++;
      }
    }

    // A gate whose path provably lands on a plain key (or no key)
    // in app/stash.rip is the compile-time form of the renderer's
    // deterministic mount error. Conservative — see validateGatePath.
    const gates = compiled.get(fp)?.gates;
    if (gates && gates.length) {
      for (const d of collectGateDiagnostics(gates, source, stashAnalysisFor(fp))) {
        errors.push({ line: d.line, col: d.col, len: d.len, message: d.message, severity: 'error', code: 'rip', srcLine: d.srcLine, related: [] });
        totalErrors++;
      }
    }

    if (errors.length > 0) fileResults.push({ file: fp, errors });
  }

  // Create TypeScript language service
  //
  // Project-scope `strict` (package.json `rip.strict: true`)
  // opts the project UP to TypeScript's `strict` family, which implies
  // noImplicitAny, strictNullChecks, strictFunctionTypes, and friends.
  // With strict on: `T` excludes null/undefined, untyped params error,
  // etc. Without strict: lenient gradual-typing defaults — annotations
  // are accepted as documentation but not enforced as contracts. The
  // default is lenient to match Rip's "scaffolding, not safety rails"
  // philosophy; projects opt up when they want the contract enforced.
  // Collect `node_modules/@types` directories walking up from rootPath so
  // ambient type packages (e.g. `@types/bun`) installed at the workspace
  // root are picked up even when `rip check` runs in a sub-package. TS's
  // default `typeRoots` only looks at `<cwd>/node_modules/@types`.
  const { typeRoots, types: ambientTypes } = collectAmbientTypes(rootPath);

  const settings = createTypeCheckSettings(ts, {
    ...(strict ? { strict: true } : {}),
    ...(typeRoots.length ? { typeRoots } : {}),
    ...(ambientTypes.length ? { types: ambientTypes } : {}),
  });

  const host = {
    getScriptFileNames: () => [...compiled.keys()].map(toVirtual),
    getScriptVersion: () => '1',
    getScriptSnapshot(f) {
      const c = compiled.get(fromVirtual(f));
      if (c) return ts.ScriptSnapshot.fromString(c.tsContent);
      try { return ts.ScriptSnapshot.fromString(readFileSync(f, 'utf8')); } catch { return undefined; }
    },
    getCompilationSettings: () => settings,
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    getCurrentDirectory: () => rootPath,
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
          const resolved = resolve(dirname(fromVirtual(containingFile)), name);
          if (compiled.has(resolved)) {
            return { resolvedFileName: toVirtual(resolved), extension: '.ts', isExternalLibraryImport: false };
          }
        }
        if (name.startsWith('@rip-lang/')) {
          const r = resolvePkgSpec(name);
          if (r && compiled.has(r)) {
            return { resolvedFileName: toVirtual(r), extension: '.ts', isExternalLibraryImport: false };
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

  const service = ts.createLanguageService(host, ts.createDocumentRegistry());

  // Patch uninitialized variables with inferred types (same as LSP)
  patchUninitializedTypes(ts, service, compiled);

  // Collect diagnostics

  for (const [fp, entry] of compiled) {
    if (!entry.hasTypes) continue;
    if (entry._typeOnly) continue;

    const vf = toVirtual(fp);
    let diags;
    try {
      const sem = service.getSemanticDiagnostics(vf);
      const syn = service.getSyntacticDiagnostics(vf);
      diags = [...syn, ...sem];
    } catch (e) {
      const rel = relative(rootPath, fp);
      console.error(`${red('error')} ${cyan(rel)}: diagnostics failed — ${e.message}`);
      totalErrors++;
      continue;
    }

    const errors = [];
    const srcLines = entry.source.split('\n');
    for (const d of diags) {
      if (d.start === undefined) continue;
      if (SKIP_CODES.has(d.code)) {
        // RFC 12 phase 2 — diagnostic-equivalence gate hook. Records every
        // diagnostic dropped by the *global* mute (not the conditional/position
        // suppressions below), so the gate can snapshot which structural codes
        // a type-clean corpus still relies on and fail when that set grows
        // (a newly-masked error) or shrinks (a recovery to record). Inert
        // unless a caller opts in.
        opts.onGlobalSkip?.({ filePath: fp, code: d.code, start: d.start, entry });
        continue;
      }

      // Conditional suppression — narrowed instead of blanket
      if (CONDITIONAL_CODES.has(d.code)) {
        const flatMsg = d.code === 2307 ? ts.flattenDiagnosticMessageText(d.messageText, '\n') : null;
        if (shouldSuppressConditional(d.code, d.start, d.length, entry.tsContent, entry.headerLines, entry.dts, flatMsg, fp, d.relatedInformation)) continue;
      }

      // Skip 6133 on compiler-generated _render() construction variables (_0, _1, …)
      if ((d.code === 6133 || d.code === 6196) && isRenderConstructionVar(entry.tsContent, d.start, d.length)) continue;

      // Skip diagnostics on injected overload signatures — the real function
      // definition already carries the same diagnostic.
      if (isInjectedOverload(entry, d.start)) continue;

      const pos = mapToSourcePos(entry, d.start);
      if (!pos) continue;

      // Drop diagnostics that map beyond the source file (e.g. from component
      // stubs where the compiled line has no real source counterpart).
      if (pos.line >= srcLines.length) continue;

      // Remap IIFE-switch diagnostics to the enclosing function declaration
      const adj = adjustSwitchDiagnostic(entry.source, pos, d.code);
      if (adj) { pos.line = adj.line; pos.col = adj.col; }

      const endPos = adj ? { line: adj.line, col: adj.col + adj.len } : (d.length ? mapToSourcePos(entry, d.start + d.length) : null);
      let len = endPos && endPos.line === pos.line ? endPos.col - pos.col : 1;

      const message = cleanDiagnosticMessage(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
      const severity = d.category === 1 ? 'error' : d.category === 0 ? 'warning' : 'info';
      const srcLine = srcLines[pos.line] || '';

      const { code: finalCode, message: finalMessage } = unifyRouteDiagnostic(d.code, message, entry, d.start, fp);

      // Snap route diagnostics to the meaningful token (`href` / `push`).
      const routeSpan = locateRouteDiagnosticSpan(entry, d.start, srcLine);
      if (routeSpan) { pos.col = routeSpan.col; len = routeSpan.len; }

      // Collect related information
      const related = [];
      if (d.relatedInformation) {
        for (const ri of d.relatedInformation) {
          const riMsg = cleanDiagnosticMessage(ts.flattenDiagnosticMessageText(ri.messageText, '\n'));
          if (ri.file && ri.start !== undefined) {
            const riPath = fromVirtual(ri.file.fileName);
            const riEntry = compiled.get(riPath);
            if (riEntry) {
              const riPos = mapToSourcePos(riEntry, ri.start);
              if (riPos) {
                let riLen = ri.length || 1;
                const riTsLine = offsetToLine(riEntry.tsContent, ri.start);
                if (riTsLine >= riEntry.headerLines && ri.length) {
                  const riEnd = mapToSourcePos(riEntry, ri.start + ri.length);
                  if (riEnd && riEnd.line === riPos.line) riLen = riEnd.col - riPos.col;
                }
                const riSrcLines = riEntry.source.split('\n');
                const riRel = relative(rootPath, riPath);
                related.push({
                  file: riRel, line: riPos.line + 1, col: riPos.col + 1,
                  message: riMsg, srcLine: riSrcLines[riPos.line] || '', len: Math.max(1, riLen),
                });
              }
            } else {
              // External file (e.g. lib.es5.d.ts) — use TS positions directly
              const riLine = offsetToLine(ri.file.text, ri.start);
              let riColStart = ri.start;
              for (let i = ri.start - 1; i >= 0; i--) {
                if (ri.file.text[i] === '\n') break;
                riColStart = i;
              }
              const riCol = ri.start - riColStart;
              const riSrcLine = getLineText(ri.file.text, riLine);
              const riRel = relative(rootPath, ri.file.fileName);
              related.push({
                file: riRel, line: riLine + 1, col: riCol + 1,
                message: riMsg, srcLine: riSrcLine, len: ri.length || 1,
              });
            }
          } else {
            related.push({ message: riMsg });
          }
        }
      }

      errors.push({ line: pos.line + 1, col: pos.col + 1, len: Math.max(1, len), message: finalMessage, severity, code: finalCode, srcLine, related });
      if (severity === 'error') totalErrors++;
      else if (severity === 'warning') totalWarnings++;
    }

    // Dedup: same diagnostic can map twice when the dts header and compiled
    // body both contain the offending construct (e.g. an `import { X }` line).
    {
      const deduped = dedupDiagnostics(errors, e => ({
        startLine: e.line, startCol: e.col,
        endLine: e.line, endCol: e.col + e.len,
      }));
      if (deduped.length < errors.length) {
        const kept = new Set(deduped);
        for (const e of errors) {
          if (kept.has(e)) continue;
          if (e.severity === 'error') totalErrors--;
          else if (e.severity === 'warning') totalWarnings--;
        }
        errors.length = 0;
        errors.push(...deduped);
      }
    }

    // Untyped component prop checking — flag props without :: annotation
    if (entry.dts) {
      for (const [compName, compInfo] of parseComponentDTS(entry.dts)) {
        for (const e of checkComponentDefs(compInfo.props, srcLines)) {
          errors.push({ line: e.line + 1, col: e.col + 1, len: e.len, message: e.message.includes('type annotation') ? `Prop '${e.propName}' on component ${compName} has no type annotation` : e.message, severity: 'error', code: 'rip', srcLine: srcLines[e.line], related: [] });
          totalErrors++;
        }
      }
    }

    if (errors.length > 0) {
      fileResults.push({ file: fp, errors });
    }
  }

  // Component usage-site checks — unknown props and missing required props
  {
    // Build per-file component registry: own definitions take priority
    const globalDefs = new Map();
    const localDefs = new Map();
    for (const [fp, entry] of compiled) {
      if (!entry.dts) continue;
      const fileDefs = new Map();
      for (const [name, info] of parseComponentDTS(entry.dts)) {
        globalDefs.set(name, info);
        fileDefs.set(name, info);
      }
      localDefs.set(fp, fileDefs);
    }

    // Scan usage sites
    if (globalDefs.size > 0) {
      for (const [fp, entry] of compiled) {
        if (!entry.hasTypes) continue;
        if (entry._typeOnly) continue;
        const srcLines = entry.source.split('\n');
        const errors = fileResults.find(r => r.file === fp)?.errors || [];
        const hadEntry = errors.length > 0;
        // Merge: own file's components override global
        const fileDefs = new Map([...globalDefs, ...(localDefs.get(fp) || [])]);

        for (let s = 0; s < srcLines.length; s++) {
          const usage = collectUsageProps(srcLines, s, fileDefs);
          if (!usage) continue;
          const { component: compName, usedProps } = usage;
          const def = fileDefs.get(compName);
          const props = def?.props || [];

          // Unknown props
          if (!def?.hasIntrinsicProps) {
            for (const used of usedProps) {
              if (used.startsWith('@')) continue;
              if (used === 'class' || used === 'style') continue;
              if (!props.some(p => p.name === used)) {
                const col = srcLines[s].indexOf(used);
                errors.push({ line: s + 1, col: col + 1, len: used.length, message: `Unknown prop '${used}' on component ${compName}`, severity: 'error', code: 'rip', srcLine: srcLines[s], related: [] });
                totalErrors++;
              }
            }
          }

          // Missing required props
          for (const prop of props) {
            if (!prop.required) continue;
            if (usedProps.includes(prop.name)) continue;
            const col = srcLines[s].indexOf(compName);
            errors.push({ line: s + 1, col: col + 1, len: compName.length, message: `Missing required prop '${prop.name}' on component ${compName}`, severity: 'error', code: 'rip', srcLine: srcLines[s], related: [] });
            totalErrors++;
          }
        }

        if (!hadEntry && errors.length > 0) {
          fileResults.push({ file: fp, errors });
        }
      }
    }
  }

  // ── Source map audit ─────────────────────────────────────────────
  // Walk every identifier in each Rip source file and verify the source map
  // round-trip: srcToOffset must resolve, and getQuickInfoAtPosition must
  // return hover info for it.  Failures indicate source map gaps that make
  // hover/definition/completion silently break in the editor.
  //
  // Opt-in via `rip check --sourcemap`.  This is a compiler-development
  // diagnostic — gaps usually mean the audit's skip list is incomplete or
  // that codegen lost a binding, both compiler-side concerns rather than
  // anything a package author can fix.  Not run as part of `--audit` (which
  // is the package-author-facing public-API check).

  const AUDIT_SKIP = new Set([
    'if', 'else', 'then', 'unless', 'switch', 'when', 'for', 'while', 'until',
    'loop', 'do', 'try', 'catch', 'finally', 'throw', 'return', 'break',
    'continue', 'yield', 'await', 'new', 'delete', 'typeof', 'instanceof',
    'in', 'of', 'as', 'is', 'isnt', 'not', 'and', 'or', 'yes', 'no',
    'true', 'false', 'null', 'undefined', 'this', 'super', 'class', 'extends',
    'import', 'export', 'from', 'default', 'def', 'render', 'component',
    'type', 'interface', 'enum', 'const', 'let', 'var', 'void', 'async',
    'static', 'get', 'set', 'constructor', 'declare', 'implements', 'readonly',
    'offer', 'accept', 'it', 'stash',
    // Type keywords — never have hover info in value position
    'number', 'string', 'boolean', 'any', 'unknown', 'never', 'object',
    'symbol', 'bigint',
  ]);
  // Standard library: runtime globals injected by Rip (no TS declaration)
  const STDLIB = new Set([
    'abort', 'assert', 'exit', 'kind', 'noop', 'p', 'pp', 'raise', 'rand',
    'sleep', 'todo', 'warn', 'zip',
  ]);
  // Build string and comment regions for a source line so the audit can
  // accurately skip identifiers inside strings/comments without being fooled
  // by interpolation `#{}`, escaped quotes, or apostrophes in double-quoted
  // strings.  Returns an array of [start, end] ranges that are "non-code".
  function nonCodeRegions(line) {
    const regions = [];
    let i = 0;
    while (i < line.length) {
      const ch = line[i];
      // Single-line comment — any # outside a string starts a comment
      // (#{} interpolation only exists inside double-quoted strings)
      if (ch === '#') {
        regions.push([i, line.length]);
        return regions;
      }
      // String literal
      if (ch === '"' || ch === "'") {
        const quote = ch;
        const start = i;
        i++;
        while (i < line.length) {
          if (line[i] === '\\') { i += 2; continue; }
          if (line[i] === '#' && line[i + 1] === '{' && quote === '"') {
            // Interpolation — skip to matching }
            let depth = 1;
            i += 2;
            while (i < line.length && depth > 0) {
              if (line[i] === '{') depth++;
              else if (line[i] === '}') depth--;
              if (depth > 0) i++;
            }
            if (i < line.length) i++; // skip closing }
            continue;
          }
          if (line[i] === quote) { i++; break; }
          i++;
        }
        regions.push([start, i]);
        continue;
      }
      i++;
    }
    return regions;
  }
  let auditGaps = 0;
  const auditResults = [];

  if (opts.sourceMapAudit) for (const [fp, entry] of compiled) {
    if (!entry.hasTypes) continue;
    if (entry._typeOnly) continue;
    const srcLines = entry.source.split('\n');
    const vf = toVirtual(fp);
    const gaps = [];

    // Detect render block line ranges (indented under `render`)
    const renderLines = new Set();
    let renderIndent = -1;
    for (let i = 0; i < srcLines.length; i++) {
      const line = srcLines[i];
      const trimmed = line.trimStart();
      const indent = line.length - trimmed.length;
      if (/^render\b/.test(trimmed)) {
        renderIndent = indent;
        renderLines.add(i);
        continue;
      }
      if (renderIndent >= 0) {
        if (trimmed === '' || indent > renderIndent) { renderLines.add(i); continue; }
        renderIndent = -1;
      }
    }

    for (let line = 0; line < srcLines.length; line++) {
      const srcLine = srcLines[line];
      // Skip comments, blank lines, and render blocks
      if (/^\s*(#|$)/.test(srcLine)) continue;
      if (renderLines.has(line)) continue;

      // Build string/comment regions for accurate skipping
      const skipRegions = nonCodeRegions(srcLine);

      // Detect type-annotation region: everything after :: (but not ::=)
      // e.g. "x:: number = 42" — skip "number" but not "x"
      // e.g. "def add(a:: number, b:: number):: number" — skip all type words
      let typeRegions = [];
      const typeRe = /::\s*/g;
      let tm;
      while ((tm = typeRe.exec(srcLine)) !== null) {
        // Skip :: inside string/comment regions
        if (skipRegions.some(([s, e]) => tm.index >= s && tm.index < e)) continue;
        // Find the end of this type annotation (next = or , or ) or EOL)
        const start = tm.index + tm[0].length;
        // Walk forward to find the boundary
        let depth = 0, end = srcLine.length;
        for (let i = start; i < srcLine.length; i++) {
          const ch = srcLine[i];
          if (ch === '(' || ch === '[' || ch === '{' || ch === '<') depth++;
          else if (ch === ')' || ch === ']' || ch === '}' || ch === '>') {
            if (depth > 0) depth--;
            else { end = i; break; }
          }
          else if (depth === 0 && (ch === ',' || (ch === '=' && srcLine[i + 1] !== '>'))) { end = i; break; }
        }
        typeRegions.push([start, end]);
      }

      const re = /\b([a-zA-Z_$]\w*)\b/g;
      let m;
      while ((m = re.exec(srcLine)) !== null) {
        const word = m[1];
        if (AUDIT_SKIP.has(word)) continue;
        if (STDLIB.has(word)) continue;
        // Skip @prop references (start with @)
        if (m.index > 0 && srcLine[m.index - 1] === '@') continue;
        // Skip base element name in `component extends <element>`
        if (/\bextends\s+$/.test(srcLine.slice(0, m.index)) && /\bcomponent\b/.test(srcLine)) continue;
        // Skip words in type-annotation position
        if (typeRegions.some(([s, e]) => m.index >= s && m.index < e)) continue;
        // Skip words inside strings or comments
        if (skipRegions.some(([s, e]) => m.index >= s && m.index < e)) continue;

        const col = m.index;
        const offset = srcToOffset(entry, line, col);
        if (offset === undefined) {
          gaps.push({ line: line + 1, col: col + 1, word, issue: 'no mapping' });
          continue;
        }
        try {
          const info = service.getQuickInfoAtPosition(vf, offset);
          if (!info) {
            gaps.push({ line: line + 1, col: col + 1, word, issue: 'no hover info' });
          }
        } catch {
          gaps.push({ line: line + 1, col: col + 1, word, issue: 'hover query failed' });
        }
      }
    }

    if (gaps.length > 0) {
      auditResults.push({ file: fp, gaps });
      auditGaps += gaps.length;
    }
  }

  // Print results — tsc format with Rip source positions
  for (const { file, errors } of fileResults) {
    const rel = relative(rootPath, file);
    for (const e of errors) {
      const loc = `${cyan(rel)}${dim(':')}${yellow(String(e.line))}${dim(':')}${yellow(String(e.col))}`;
      const sev = e.severity === 'error' ? red('error') : yellow('warning');
      const code = typeof e.code === 'number' ? `TS${e.code}` : e.code || '';
      console.log(`${loc} ${dim('-')} ${sev} ${dim(code)}${dim(':')} ${e.message}`);

      if (e.srcLine) {
        console.log('');
        const lineNum = String(e.line);
        console.log(`${lineNum} ${e.srcLine}`);
        const pad = Math.max(0, e.col - 1);
        const underline = Math.max(1, e.len);
        console.log(`${' '.repeat(lineNum.length)} ${' '.repeat(pad)}${red('~'.repeat(underline))}`);
      }

      if (e.related) {
        for (const ri of e.related) {
          if (ri.file) {
            console.log('');
            console.log(`  ${cyan(ri.file)}${dim(':')}${yellow(String(ri.line))}${dim(':')}${yellow(String(ri.col))}`);
            const riLineNum = String(ri.line);
            console.log(`    ${riLineNum} ${ri.srcLine}`);
            console.log(`    ${' '.repeat(riLineNum.length)} ${' '.repeat(ri.col - 1)}${red('~'.repeat(ri.len))}`);
            console.log(`    ${ri.message}`);
          } else {
            console.log(`    ${ri.message}`);
          }
        }
      }
      console.log('');
    }
  }

  // Summary — tsc format
  const totalFound = totalErrors + totalWarnings;
  if (totalFound === 0) {
    printSourceMapAudit();
    return compileErrors > 0 || undeclaredCount > 0 ? 1 : 0;
  }

  const s = totalFound === 1 ? '' : 's';
  if (fileResults.length === 1) {
    const rel = relative(rootPath, fileResults[0].file);
    const first = fileResults[0].errors[0];
    if (totalFound === 1) {
      console.log(`Found ${totalFound} error in ${cyan(rel)}${dim(':')}${yellow(String(first.line))}\n`);
    } else {
      console.log(`Found ${totalFound} error${s} in the same file, starting at: ${cyan(rel)}${dim(':')}${yellow(String(first.line))}\n`);
    }
  } else {
    console.log(`Found ${totalFound} error${s} in ${fileResults.length} files.\n`);
    console.log(`  Errors  Files`);
    for (const { file, errors } of fileResults) {
      const rel = relative(rootPath, file);
      console.log(`  ${String(errors.length).padStart(6)}  ${cyan(rel)}${dim(':')}${yellow(String(errors[0].line))}`);
    }
    console.log('');
  }

  printSourceMapAudit();
  return totalErrors > 0 || undeclaredCount > 0 ? 1 : 0;

  function printSourceMapAudit() {
    if (!opts.sourceMapAudit || auditResults.length === 0) return;
    console.log(bold('── Source Map Audit ──\n'));
    for (const { file, gaps } of auditResults) {
      const rel = relative(rootPath, file);
      for (const g of gaps) {
        const loc = `${cyan(rel)}${dim(':')}${yellow(String(g.line))}${dim(':')}${yellow(String(g.col))}`;
        console.log(`${loc} ${dim('-')} ${yellow('warning')} ${dim('audit:')} ${g.issue} for '${g.word}'`);
      }
    }
    console.log(`\n${yellow(String(auditGaps))} source map gap${auditGaps === 1 ? '' : 's'} found\n`);
  }
}

// ── Public-surface `any` audit ─────────────────────────────────────
//
// `rip check --audit [pkgDir]` walks a package's public exports and
// flags any export whose type contains `any` (in parameters, return
// types, or own properties of types declared in the package).
// External types (e.g. lib.es5, @types/*) are treated as opaque —
// we don't dive into `Promise<Response>` looking for `any` inside
// `Response`. The package can only control its own surface; this
// audit measures exactly that.
//
// Exit code: 0 if every export is `any`-free, 1 otherwise.

// Resolve a package's public entries from its package.json. Handles
// `main`, `module`, string `exports`, and the subpath/conditional
// `exports` map. Returns [{ subpath, file }] with absolute paths.
function collectPackageEntries(pkg, pkgDir) {
  const entries = new Map(); // subpath → abs file
  const add = (subpath, p) => {
    if (typeof p !== 'string') return;
    if (entries.has(subpath)) return;
    entries.set(subpath, resolve(pkgDir, p));
  };
  const walkConditional = (subpath, v) => {
    if (typeof v === 'string') { add(subpath, v); return; }
    if (!v || typeof v !== 'object') return;
    // Prefer `import` then `default`, fall back to any string value.
    if (typeof v.import === 'string') { add(subpath, v.import); return; }
    if (typeof v.default === 'string') { add(subpath, v.default); return; }
    for (const k of Object.keys(v)) walkConditional(subpath, v[k]);
  };

  if (typeof pkg.exports === 'string') {
    add('.', pkg.exports);
  } else if (pkg.exports && typeof pkg.exports === 'object') {
    const keys = Object.keys(pkg.exports);
    const isSubpathMap = keys.some(k => k.startsWith('.'));
    if (isSubpathMap) {
      for (const sp of keys) walkConditional(sp, pkg.exports[sp]);
    } else {
      walkConditional('.', pkg.exports);
    }
  }
  if (!entries.has('.') && typeof pkg.module === 'string') add('.', pkg.module);
  if (!entries.has('.') && typeof pkg.main   === 'string') add('.', pkg.main);
  return [...entries.entries()].map(([subpath, file]) => ({ subpath, file }));
}

// True if `type`'s declarations all live outside the package's
// compiled set (i.e. it's a lib/`@types`/external type). Anonymous
// types (no symbol or no declarations) are treated as local — they
// are inline shapes from the package's own annotations.
function isExternalType(type, compiled) {
  const sym = type.aliasSymbol || type.symbol;
  if (!sym || !sym.declarations || sym.declarations.length === 0) return false;
  for (const d of sym.declarations) {
    const sf = d.getSourceFile?.();
    if (!sf) continue;
    if (compiled.has(fromVirtual(sf.fileName))) return false;
  }
  return true;
}

// Walk a TS type looking for `any`. Returns null if no leak, or a
// breadcrumb string describing where the `any` lives.
//
// Scoping rule: EXTERNAL types are fully opaque. We don't walk into
// their unions, type arguments, signatures, or properties. The
// package is only accountable for shapes it directly wrote. If a
// package's export references another local exported type, that
// referenced type gets audited on its own export — not transitively
// through every place it's referenced.
//
// Why so strict: lib.dom types like `BodyInit` resolve to unions
// including `ReadableStream<R = any>`. Walking into the expansion
// blames the package for `any` it never wrote. Same for `Promise<T>`,
// `Array<T>`, `Record<K, V>`, etc. — diving into them surfaces
// internals the package doesn't control.
//
// Trade-off: `Promise<any>` written literally in package source is
// also opaque under this rule, so we miss it. Acceptable: such a
// pattern is rare and easy to spot in review.
function findAnyLeaks(type, ts, checker, compiled, seen = new WeakSet(), depth = 0, exportedSymbols = null, rootSymbol = null) {
  if (!type || depth > 12) return null;
  if (type.flags & ts.TypeFlags.Any) return '';
  if (isExternalType(type, compiled)) return null;
  // On recursion (depth > 0), stop at any other exported symbol.
  // Each export is audited on its own line — don't double-count
  // leaks through cross-references.
  if (depth > 0 && exportedSymbols) {
    const sym = type.aliasSymbol || type.symbol;
    if (sym && sym !== rootSymbol && exportedSymbols.has(sym)) return null;
  }
  if (seen.has(type)) return null;
  seen.add(type);

  const named = (type.aliasSymbol || type.symbol)?.getName?.();
  const label = named && named !== '__type' && named !== '__object' ? named : null;

  if (type.isUnion?.() || type.isIntersection?.()) {
    for (let i = 0; i < type.types.length; i++) {
      const p = findAnyLeaks(type.types[i], ts, checker, compiled, seen, depth + 1, exportedSymbols, rootSymbol);
      if (p !== null) return joinPath(label, `|${i}`, p);
    }
  }

  const args = checker.getTypeArguments?.(type) || type.typeArguments || [];
  for (let i = 0; i < args.length; i++) {
    const p = findAnyLeaks(args[i], ts, checker, compiled, seen, depth + 1, exportedSymbols, rootSymbol);
    if (p !== null) return joinPath(label, `<${i}>`, p);
  }

  const walkParams = (sig) => {
    for (const p of sig.parameters) {
      const decl = p.valueDeclaration || p.declarations?.[0];
      if (!decl) continue;
      const pt = checker.getTypeOfSymbolAtLocation(p, decl);
      const sub = findAnyLeaks(pt, ts, checker, compiled, seen, depth + 1, exportedSymbols, rootSymbol);
      if (sub !== null) return joinPath(null, `(${p.getName()})`, sub);
    }
    return null;
  };

  for (const sig of type.getCallSignatures?.() || []) {
    const ps = walkParams(sig);
    if (ps !== null) return joinPath(label, '', ps);
    const rs = findAnyLeaks(sig.getReturnType(), ts, checker, compiled, seen, depth + 1, exportedSymbols, rootSymbol);
    if (rs !== null) return joinPath(label, '=>', rs);
  }
  for (const sig of type.getConstructSignatures?.() || []) {
    const ps = walkParams(sig);
    if (ps !== null) return joinPath(label, 'new', ps);
    const rs = findAnyLeaks(sig.getReturnType(), ts, checker, compiled, seen, depth + 1, exportedSymbols, rootSymbol);
    if (rs !== null) return joinPath(label, 'new=>', rs);
  }

  if (type.getProperties) {
    for (const p of type.getProperties()) {
      const decl = p.valueDeclaration || p.declarations?.[0];
      if (!decl) continue;
      const sf = decl.getSourceFile?.();
      if (!sf) continue;
      if (!compiled.has(fromVirtual(sf.fileName))) continue;
      const pt = checker.getTypeOfSymbolAtLocation(p, decl);
      const sub = findAnyLeaks(pt, ts, checker, compiled, seen, depth + 1, exportedSymbols, rootSymbol);
      if (sub !== null) return joinPath(label, `.${p.getName()}`, sub);
    }
  }

  return null;
}

function joinPath(label, step, rest) {
  const head = label ? `${label}${step}` : step;
  if (!rest) return head || '<any>';
  if (rest.startsWith('|') || rest.startsWith('<') || rest.startsWith('(') || rest.startsWith('.') || rest.startsWith('=>') || rest.startsWith('new')) {
    return head + rest;
  }
  return head ? `${head}.${rest}` : rest;
}

export async function runAudit(targetDir) {
  const rootPath = resolve(targetDir);

  // Use rip's own catalog-pinned TypeScript (a dependency), never the
  // consumer's — see runCheck above.
  let ts;
  try {
    ts = await import('typescript').then(m => m.default || m);
  } catch {
    console.error('TypeScript could not be loaded. Reinstall rip-lang (it ships TypeScript as a dependency).');
    return 1;
  }

  const pkgJsonPath = resolve(rootPath, 'package.json');
  if (!existsSync(pkgJsonPath)) {
    console.error(red(`No package.json found at ${rootPath}`));
    return 1;
  }
  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  const pkgName = pkg.name || basename(rootPath);

  const allEntries = collectPackageEntries(pkg, rootPath);
  const ripEntries = allEntries.filter(e => e.file.endsWith('.rip') && existsSync(e.file));
  if (ripEntries.length === 0) {
    console.error(red(`No .rip entry points found in ${pkgName}`));
    if (allEntries.length > 0) {
      console.error(dim(`  package.json declares entries, but none point to a .rip file:`));
      for (const e of allEntries) console.error(dim(`    ${e.subpath} → ${relative(rootPath, e.file)}`));
    }
    return 1;
  }

  // Compile each entry plus its transitive `.rip` imports so the
  // language service can resolve cross-module types. Only entries
  // themselves are audited; imported files exist purely so types
  // referenced from the entry can be expanded.
  const compiled = new Map();
  const queue = ripEntries.map(e => e.file);
  while (queue.length) {
    const fp = queue.shift();
    if (compiled.has(fp)) continue;
    try {
      const source = readFileSync(fp, 'utf8');
      // Compile with strict: true so every export's annotations are
      // emitted into the DTS — without strict, partially-annotated
      // exports could fall back to inferred types that look cleaner
      // than they really are.
      compiled.set(fp, compileForCheck(fp, source, new Compiler(), { checkAll: true }));
      for (const m of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1];
        if (spec.endsWith('.rip')) {
          const r = resolve(dirname(fp), spec);
          if (existsSync(r) && !compiled.has(r)) queue.push(r);
        }
      }
    } catch (e) {
      console.error(`${red('error')} ${cyan(relative(rootPath, fp))}: compile error — ${e.message}`);
      return 1;
    }
  }

  // Resolve @rip-lang/* package imports (siblings in the workspace)
  // so cross-package re-exports type correctly.
  const pkgRequire = createRequire(resolve(rootPath, 'package.json'));
  const pkgSpecCache = new Map();
  function resolvePkgSpec(spec) {
    if (pkgSpecCache.has(spec)) return pkgSpecCache.get(spec);
    let resolved = null;
    try {
      const r = pkgRequire.resolve(spec);
      if (typeof r === 'string' && r.endsWith('.rip') && existsSync(r)) resolved = r;
    } catch {}
    pkgSpecCache.set(spec, resolved);
    return resolved;
  }
  const pkgQueue = new Set();
  for (const [, entry] of compiled) {
    for (const spec of scanRipPkgImports(entry.tsContent || entry.source)) {
      const r = resolvePkgSpec(spec);
      if (r && !compiled.has(r)) pkgQueue.add(r);
    }
  }
  while (pkgQueue.size) {
    const next = pkgQueue.values().next().value;
    pkgQueue.delete(next);
    if (compiled.has(next)) continue;
    try {
      const src = readFileSync(next, 'utf8');
      const compiledPkg = compileForCheck(next, src, new Compiler());
      compiled.set(next, compiledPkg);
      for (const spec of scanRipPkgImports(compiledPkg.tsContent || src)) {
        const r = resolvePkgSpec(spec);
        if (r && !compiled.has(r)) pkgQueue.add(r);
      }
    } catch (e) {
      console.warn(`[rip] @rip-lang package compile failed for ${next}: ${e.message}`);
    }
  }

  const { typeRoots, types: ambientTypes } = collectAmbientTypes(rootPath);
  const settings = createTypeCheckSettings(ts, {
    strict: true,
    ...(typeRoots.length    ? { typeRoots }              : {}),
    ...(ambientTypes.length ? { types: ambientTypes }    : {}),
  });

  const host = {
    getScriptFileNames: () => [...compiled.keys()].map(toVirtual),
    getScriptVersion:   () => '1',
    getScriptSnapshot(f) {
      const c = compiled.get(fromVirtual(f));
      if (c) return ts.ScriptSnapshot.fromString(c.tsContent);
      try { return ts.ScriptSnapshot.fromString(readFileSync(f, 'utf8')); } catch { return undefined; }
    },
    getCompilationSettings: () => settings,
    getDefaultLibFileName:  (o) => ts.getDefaultLibFilePath(o),
    getCurrentDirectory:    () => rootPath,
    fileExists(f) { return compiled.has(fromVirtual(f)) || ts.sys.fileExists(f); },
    readFile(f)   { return compiled.get(fromVirtual(f))?.tsContent || ts.sys.readFile(f); },
    readDirectory:   (...a) => ts.sys.readDirectory(...a),
    getDirectories:  (...a) => ts.sys.getDirectories(...a),
    directoryExists: (...a) => ts.sys.directoryExists(...a),
    resolveTypeReferenceDirectives(names, containingFile, redirectedReference, options) {
      return names.map(n => {
        const name = typeof n === 'string' ? n : n.name;
        const r = ts.resolveTypeReferenceDirective(name, containingFile, options || settings, ts.sys, redirectedReference);
        return r.resolvedTypeReferenceDirective;
      });
    },
    resolveModuleNames(names, containingFile) {
      return names.map(name => {
        if (name.endsWith('.rip')) {
          const r = resolve(dirname(fromVirtual(containingFile)), name);
          if (compiled.has(r)) return { resolvedFileName: toVirtual(r), extension: '.ts', isExternalLibraryImport: false };
        }
        if (name.startsWith('@rip-lang/')) {
          const r = resolvePkgSpec(name);
          if (r && compiled.has(r)) return { resolvedFileName: toVirtual(r), extension: '.ts', isExternalLibraryImport: false };
        }
        const r = ts.resolveModuleName(name, containingFile, settings, {
          fileExists:          host.fileExists,
          readFile:            host.readFile,
          directoryExists:     host.directoryExists,
          getCurrentDirectory: host.getCurrentDirectory,
          getDirectories:      host.getDirectories,
        });
        return r.resolvedModule;
      });
    },
  };

  const service = ts.createLanguageService(host, ts.createDocumentRegistry());
  const program = service.getProgram();
  const checker = program.getTypeChecker();
  const fmtFlags = ts.TypeFormatFlags.NoTruncation
    | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope
    | ts.TypeFormatFlags.WriteArrayAsGenericType;

  let totalExports = 0, totalLeaks = 0;

  // First pass: collect ALL exported symbols across all entries.
  // The walker treats these as opaque on recursion — each export is
  // audited only on its own direct shape. If export A references
  // export B and B leaks, the leak surfaces on B's audit line, not
  // by polluting every type that mentions B.
  const exportedSymbols = new Set();
  const entryData = [];
  for (const entry of ripEntries) {
    const vf = toVirtual(entry.file);
    const sourceFile = program.getSourceFile(vf);
    if (!sourceFile) { entryData.push(null); continue; }
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) { entryData.push({ sourceFile, exports: null }); continue; }
    const exps = checker.getExportsOfModule(moduleSymbol);
    for (const s of exps) exportedSymbols.add(s);
    entryData.push({ sourceFile, exports: exps });
  }

  for (let idx = 0; idx < ripEntries.length; idx++) {
    const entry = ripEntries[idx];
    const data = entryData[idx];
    const rel = relative(rootPath, entry.file);

    if (!data) {
      console.log(`  ${red('error')} could not load ${cyan(rel)}`);
      continue;
    }
    const { sourceFile, exports } = data;
    if (!exports) {
      console.log(`  ${dim('(no exports)')}`);
      continue;
    }

    const header = entry.subpath === '.' ? rel : `${rel}  ${dim('('+entry.subpath+')')}`;
    console.log(`\n  ${cyan(header)}`);

    // Compute max name width for column alignment.
    const names = exports.map(s => s.getName());
    const colW = Math.min(28, names.reduce((m, n) => Math.max(m, n.length), 0));

    for (const sym of exports) {
      totalExports++;
      let t;
      if (sym.flags & ts.SymbolFlags.Value) {
        t = checker.getTypeOfSymbolAtLocation(sym, sourceFile);
      } else {
        t = checker.getDeclaredTypeOfSymbol(sym);
      }
      // Pass `sym` as the rootSymbol so recursion into OTHER exported
      // symbols stops, but recursion into the export's own self-named
      // type (e.g. typeof Class → the class itself) doesn't immediately
      // bail out.
      const leakPath = findAnyLeaks(t, ts, checker, compiled, new WeakSet(), 0, exportedSymbols, sym);
      const leaks = leakPath !== null;
      const typeStr = checker.typeToString(t, sourceFile, fmtFlags);
      const name = sym.getName();
      const mark = leaks ? red('✗') : green('✓');
      console.log(`    ${mark} ${name.padEnd(colW)}  ${dim(typeStr)}`);
      if (leaks) {
        totalLeaks++;
        console.log(`      ${dim('└─ any at: ')}${yellow(leakPath || '<root>')}`);
      }
    }
  }

  const typed = totalExports - totalLeaks;
  const pct = totalExports > 0 ? (100 * typed / totalExports).toFixed(1) : '100.0';

  console.log('');
  if (totalLeaks === 0) {
    console.log(`${green('✓')} ${bold(pkgName)}: ${typed}/${totalExports} exports fully typed (${pct}%).`);
  } else {
    console.log(`${red('✗')} ${bold(pkgName)}: ${typed}/${totalExports} exports fully typed (${pct}%). ${red(String(totalLeaks))} export${totalLeaks === 1 ? '' : 's'} leak \`any\`.`);
  }

  return totalLeaks > 0 ? 1 : 0;
}
