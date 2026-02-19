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

import { Compiler } from './compiler.js';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, relative, dirname } from 'path';
import { buildLineMap } from './sourcemaps.js';

// ── Shared helpers ─────────────────────────────────────────────────

// Detect type annotations (:: followed by space or =) ignoring comments
// and prototype syntax (Class::method).
export function hasTypeAnnotations(source) {
  return source.split('\n').some(line => /::[ \t=]/.test(line.replace(/#.*$/, '')));
}

export function countLines(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) if (str[i] === '\n') n++;
  return n;
}

export function toVirtual(p) { return p + '.ts'; }
export function fromVirtual(p) { return p.endsWith('.rip.ts') ? p.slice(0, -3) : p; }

// TS error codes to skip — Rip resolves modules differently and
// treats async return types transparently.
export const SKIP_CODES = new Set([
  2307, // Cannot find module
  2304, // Cannot find name
  1064, // Return type of async function must be Promise
  2582, // Cannot find name 'test' (test runner globals)
  2593, // Cannot find name 'describe' (test runner globals)
]);

// Base TypeScript compiler settings for type-checking. Callers can
// pass overrides (e.g. { noImplicitAny: true } for the CLI).
export function createTypeCheckSettings(ts, overrides = {}) {
  return {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowJs: true,
    strict: false,
    strictNullChecks: true,
    noEmit: true,
    skipLibCheck: true,
    ...overrides,
  };
}

// ── Shared compilation pipeline ────────────────────────────────────

// Compile a .rip file for type-checking. Merges .d.ts declarations into
// the compiled JS, detects type annotations, and builds bidirectional
// source maps. Returns everything both the CLI and LSP need.
export function compileForCheck(filePath, source, compiler) {
  const result = compiler.compile(source, { sourceMap: true, types: true });
  let code = result.code || '';
  let dts = result.dts ? result.dts.trimEnd() + '\n' : '';

  // Strip .d.ts imports — compiled JS already has them
  dts = dts.replace(/^import\s.*;\s*\n/gm, '');

  // Extract well-formed function signatures and merge into JS.
  // Leaving them as bare declarations causes TypeScript to treat
  // them as overload signatures that conflict with the implementations.
  const funcSigs = new Map();
  dts = dts.replace(
    /^(?:export|declare)\s+function\s+(\w+)\(([^)]*)\):\s*(.+);\s*$/gm,
    (_m, name, params, ret) => { funcSigs.set(name, { params, ret }); return ''; },
  );
  dts = dts.replace(/^\s*\n/gm, '');

  // Strip remaining malformed multi-line declarations
  dts = dts.replace(/(?:export|declare)\s+function\s+\w+\([\s\S]*?\);\s*/g, '');
  dts = dts.replace(/^\s*\n/gm, '');

  for (const [name, { params, ret }] of funcSigs) {
    const paramTypes = new Map();
    if (params.trim()) {
      for (const p of params.split(',')) {
        const colon = p.indexOf(':');
        if (colon !== -1) paramTypes.set(p.slice(0, colon).trim(), p.slice(colon + 1).trim());
      }
    }
    const funcRe = new RegExp(
      `((?:export\\s+)?(?:async\\s+)?function\\s+${name})\\(([^)]*)\\)(\\s*\\{)`,
    );
    code = code.replace(funcRe, (_match, prefix, codeParams, brace) => {
      const typed = codeParams.split(',').map(p => {
        const n = p.trim();
        const t = paramTypes.get(n);
        return t ? `${n}: ${t}` : n;
      }).join(', ');
      return `${prefix}(${typed}): ${ret}${brace}`;
    });
  }

  // Remove bare `let x;` declarations when the DTS already declares
  // `let x: Type;` — avoids "Cannot redeclare" conflicts. Handles
  // both single (`let x;`) and comma-separated (`let x, y;`) forms.
  const dtsVars = new Set();
  for (const m of dts.matchAll(/^(?:let|var)\s+(\w+)\s*:/gm)) dtsVars.add(m[1]);
  if (dtsVars.size) {
    code = code.replace(/^(let|var)\s+([\w\s,]+);[ \t]*$/gm, (_m, kw, vars) => {
      const kept = vars.split(',').map(v => v.trim()).filter(v => !dtsVars.has(v));
      return kept.length ? `${kw} ${kept.join(', ')};` : '';
    });
  }

  // Determine if this file should be type-checked
  const hasOwnTypes = hasTypeAnnotations(source);
  let importsTyped = false;
  if (!hasOwnTypes) {
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

  const tsContent = (hasTypes ? dts + '\n' : '') + code;
  const headerLines = hasTypes ? countLines(dts + '\n') : 1;

  // Build bidirectional line maps
  const { srcToGen, genToSrc } = buildLineMap(result.reverseMap, result.map, headerLines);

  // Map DTS variable declaration lines back to their source lines.
  // TypeScript may report errors on the `let x: Type;` line in the
  // DTS header, which has no entry in genToSrc. Fix by matching
  // variable names to source lines with `x::`.
  if (hasTypes && dts) {
    const dtsLines = dts.split('\n');
    const srcLines = source.split('\n');
    for (let i = 0; i < dtsLines.length; i++) {
      const m = dtsLines[i].match(/^(?:let|var)\s+(\w+)\s*:/);
      if (!m) continue;
      const varName = m[1];
      for (let s = 0; s < srcLines.length; s++) {
        if (new RegExp('\\b' + varName + '\\s*::').test(srcLines[s])) {
          genToSrc.set(i, s);
          break;
        }
      }
    }
  }

  return { tsContent, headerLines, hasTypes, srcToGen, genToSrc, source };
}

// ── Source mapping helpers ──────────────────────────────────────────

export function offsetToLine(text, offset) {
  let line = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

// Map a TypeScript diagnostic offset back to a Rip source line number.
// Returns -1 if the offset falls in the DTS header.
export function mapToSource(entry, offset) {
  const tsLine = offsetToLine(entry.tsContent, offset);
  if (tsLine < entry.headerLines) return -1;

  if (entry.genToSrc.has(tsLine)) return entry.genToSrc.get(tsLine);
  for (let d = 1; d <= 3; d++) {
    if (entry.genToSrc.has(tsLine - d)) return entry.genToSrc.get(tsLine - d);
    if (entry.genToSrc.has(tsLine + d)) return entry.genToSrc.get(tsLine + d);
  }
  return tsLine - entry.headerLines;
}

// ── CLI batch type-checker ─────────────────────────────────────────

function findRipFiles(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) findRipFiles(full, files);
    else if (entry.name.endsWith('.rip')) files.push(full);
  }
  return files;
}

const isColor = process.stdout.isTTY !== false;
const red     = (s) => isColor ? `\x1b[31m${s}\x1b[0m` : s;
const yellow  = (s) => isColor ? `\x1b[33m${s}\x1b[0m` : s;
const cyan    = (s) => isColor ? `\x1b[36m${s}\x1b[0m` : s;
const dim     = (s) => isColor ? `\x1b[2m${s}\x1b[0m`  : s;
const bold    = (s) => isColor ? `\x1b[1m${s}\x1b[0m`  : s;

export async function runCheck(targetDir, opts = {}) {
  const ts = await import('typescript').then(m => m.default || m);
  const rootPath = resolve(targetDir);

  if (!existsSync(rootPath)) {
    console.error(red(`Error: directory not found: ${targetDir}`));
    return 1;
  }

  const allFiles = findRipFiles(rootPath);
  if (allFiles.length === 0) {
    console.error(red(`No .rip files found in ${targetDir}`));
    return 1;
  }

  // Compile all files
  const compiled = new Map();
  const compiler = new Compiler();
  let compileErrors = 0;

  for (const fp of allFiles) {
    try {
      const source = readFileSync(fp, 'utf8');
      compiled.set(fp, compileForCheck(fp, source, compiler));
    } catch (e) {
      compileErrors++;
      const rel = relative(rootPath, fp);
      console.error(`${red('error')} ${cyan(rel)}: compile error — ${e.message}`);
    }
  }

  // Also compile any .rip files imported from typed files that aren't in rootPath
  for (const [fp, entry] of [...compiled.entries()]) {
    if (!entry.hasTypes) continue;
    const ripImports = [...entry.source.matchAll(/from\s+['"]([^'"]*\.rip)['"]/g)];
    for (const m of ripImports) {
      const imported = resolve(dirname(fp), m[1]);
      if (!compiled.has(imported) && existsSync(imported)) {
        try {
          const impSrc = readFileSync(imported, 'utf8');
          compiled.set(imported, compileForCheck(imported, impSrc, compiler));
        } catch {}
      }
    }
  }

  // Create TypeScript language service
  const settings = createTypeCheckSettings(ts, { noImplicitAny: true });

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

    resolveModuleNames(names, containingFile) {
      return names.map((name) => {
        if (name.endsWith('.rip')) {
          const resolved = resolve(dirname(fromVirtual(containingFile)), name);
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

  const service = ts.createLanguageService(host, ts.createDocumentRegistry());

  // Collect diagnostics
  let totalErrors = 0;
  let totalWarnings = 0;
  const fileResults = [];

  for (const [fp, entry] of compiled) {
    if (!entry.hasTypes) continue;

    const vf = toVirtual(fp);
    let diags;
    try {
      const sem = service.getSemanticDiagnostics(vf);
      const syn = service.getSyntacticDiagnostics(vf);
      diags = [...syn, ...sem];
    } catch {
      continue;
    }

    const errors = [];
    for (const d of diags) {
      if (d.start === undefined) continue;
      if (SKIP_CODES.has(d.code)) continue;

      const srcLine = mapToSource(entry, d.start);
      if (srcLine < 0) continue;

      const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
      const severity = d.category === 1 ? 'error' : d.category === 0 ? 'warning' : 'info';

      errors.push({ line: srcLine + 1, message, severity, code: d.code });
      if (severity === 'error') totalErrors++;
      else if (severity === 'warning') totalWarnings++;
    }

    if (errors.length > 0) {
      fileResults.push({ file: fp, errors });
    }
  }

  // Print results
  for (const { file, errors } of fileResults) {
    const rel = relative(rootPath, file);
    for (const e of errors) {
      const loc = `${cyan(rel)}${dim(':')}${yellow(String(e.line))}`;
      const sev = e.severity === 'error' ? red('error') : yellow('warning');
      console.log(`${loc} ${sev} ${e.message} ${dim(`TS${e.code}`)}`);
    }
  }

  // Summary
  const typedFiles = [...compiled.values()].filter(e => e.hasTypes).length;
  const totalFiles = compiled.size;

  if (totalErrors === 0 && totalWarnings === 0) {
    console.log(`\n${bold('✓')} ${typedFiles} typed file${typedFiles !== 1 ? 's' : ''} checked, no errors found`);
    if (compileErrors > 0) {
      console.log(dim(`  (${compileErrors} file${compileErrors !== 1 ? 's' : ''} had compile errors)`));
    }
    return compileErrors > 0 ? 1 : 0;
  }

  const parts = [];
  if (totalErrors > 0) parts.push(red(`${totalErrors} error${totalErrors !== 1 ? 's' : ''}`));
  if (totalWarnings > 0) parts.push(yellow(`${totalWarnings} warning${totalWarnings !== 1 ? 's' : ''}`));
  console.log(`\n${bold('✗')} ${parts.join(', ')} in ${fileResults.length} file${fileResults.length !== 1 ? 's' : ''} (${typedFiles} typed / ${totalFiles} total)`);

  return totalErrors > 0 ? 1 : 0;
}
