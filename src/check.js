// rip check — CLI type-checker for Rip projects
//
// Compiles all .rip files with type annotations, creates an in-process
// TypeScript language service, and reports type errors mapped back to
// Rip source positions.

import { Compiler } from './compiler.js';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { resolve, relative, dirname, basename } from 'path';

// ── Helpers ────────────────────────────────────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function vlqDecode(str) {
  const values = [];
  let i = 0;
  while (i < str.length) {
    let value = 0, shift = 0, digit;
    do {
      digit = B64.indexOf(str[i++]);
      value |= (digit & 0x1F) << shift;
      shift += 5;
    } while (digit & 0x20);
    values.push(value & 1 ? -(value >> 1) : value >> 1);
  }
  return values;
}

function parseSourceMap(mapJSON) {
  const map = JSON.parse(mapJSON);
  const genToSrc = new Map();
  let srcLine = 0, srcCol = 0, genCol = 0;

  const lines = map.mappings.split(';');
  for (let genLine = 0; genLine < lines.length; genLine++) {
    genCol = 0;
    if (!lines[genLine]) continue;
    for (const seg of lines[genLine].split(',')) {
      const fields = vlqDecode(seg);
      if (fields.length < 4) continue;
      genCol += fields[0];
      srcLine += fields[2];
      srcCol += fields[3];
      if (!genToSrc.has(genLine)) genToSrc.set(genLine, srcLine);
    }
  }
  return genToSrc;
}

function findRipFiles(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) findRipFiles(full, files);
    else if (entry.name.endsWith('.rip')) files.push(full);
  }
  return files;
}

function countLines(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) if (str[i] === '\n') n++;
  return n;
}

// Detect type annotations (:: followed by space or =) ignoring comments
// and prototype syntax (Class::method).
function hasTypeAnnotations(source) {
  return source.split('\n').some(line => /::[ \t=]/.test(line.replace(/#.*$/, '')));
}

// ── Compilation (mirrors server.js logic) ──────────────────────────

function compileFile(filePath, source, compiler, allFiles) {
  const result = compiler.compile(source, { sourceMap: true, types: true });
  let code = result.code || '';
  let dts = result.dts ? result.dts.trimEnd() + '\n' : '';

  // Strip .d.ts imports — compiled JS already has them
  dts = dts.replace(/^import\s.*;\s*\n/gm, '');

  // Extract well-formed function signatures and merge into JS
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
    code = code.replace(funcRe, (match, prefix, codeParams, brace) => {
      const typed = codeParams.split(',').map(p => {
        const n = p.trim();
        const t = paramTypes.get(n);
        return t ? `${n}: ${t}` : n;
      }).join(', ');
      return `${prefix}(${typed}): ${ret}${brace}`;
    });
  }

  // Remove bare `let x;` declarations from code when the DTS already
  // declares `let x: Type;` — avoids "Cannot redeclare" conflicts.
  const dtsVars = new Set();
  for (const m of dts.matchAll(/^(?:let|var)\s+(\w+)\s*:/gm)) dtsVars.add(m[1]);
  if (dtsVars.size) {
    const varPat = new RegExp(`^(let|var)\\s+(${[...dtsVars].join('|')})\\s*;[ \\t]*$`, 'gm');
    code = code.replace(varPat, '');
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

  // Parse source map for gen→src line mapping
  const genToSrc = result.map ? parseSourceMap(result.map) : new Map();

  return { tsContent, headerLines, hasTypes, genToSrc, source };
}

// ── Source mapping ─────────────────────────────────────────────────

function offsetToLine(text, offset) {
  let line = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

function mapToSource(entry, offset) {
  const tsLine = offsetToLine(entry.tsContent, offset);
  if (tsLine < entry.headerLines) return -1;

  // Generated code line (0-based, relative to code portion)
  const codeLine = tsLine - entry.headerLines;

  // Look up in source map
  if (entry.genToSrc.has(codeLine)) return entry.genToSrc.get(codeLine);
  // Search nearby lines
  for (let d = 1; d <= 3; d++) {
    if (entry.genToSrc.has(codeLine - d)) return entry.genToSrc.get(codeLine - d);
    if (entry.genToSrc.has(codeLine + d)) return entry.genToSrc.get(codeLine + d);
  }
  // Fallback: use the code line directly
  return codeLine;
}

// ── ANSI colors ────────────────────────────────────────────────────

const isColor = process.stdout.isTTY !== false;
const red     = (s) => isColor ? `\x1b[31m${s}\x1b[0m` : s;
const yellow  = (s) => isColor ? `\x1b[33m${s}\x1b[0m` : s;
const cyan    = (s) => isColor ? `\x1b[36m${s}\x1b[0m` : s;
const dim     = (s) => isColor ? `\x1b[2m${s}\x1b[0m`  : s;
const bold    = (s) => isColor ? `\x1b[1m${s}\x1b[0m`  : s;

// ── Main ───────────────────────────────────────────────────────────

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
      compiled.set(fp, compileFile(fp, source, compiler, allFiles));
    } catch (e) {
      compileErrors++;
      const rel = relative(rootPath, fp);
      console.error(`${red('error')} ${cyan(rel)}: compile error — ${e.message}`);
    }
  }

  // Also compile any .rip files imported from typed files that aren't in rootPath
  for (const [fp, entry] of [...compiled.entries()]) {
    if (!entry.hasTypes) continue;
    const source = entry.source;
    const ripImports = [...source.matchAll(/from\s+['"]([^'"]*\.rip)['"]/g)];
    for (const m of ripImports) {
      const imported = resolve(dirname(fp), m[1]);
      if (!compiled.has(imported) && existsSync(imported)) {
        try {
          const impSrc = readFileSync(imported, 'utf8');
          compiled.set(imported, compileFile(imported, impSrc, compiler, allFiles));
        } catch {}
      }
    }
  }

  // Create TypeScript language service
  const toVirtual = (p) => p + '.ts';
  const fromVirtual = (p) => p.endsWith('.rip.ts') ? p.slice(0, -3) : p;

  const settings = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowJs: true,
    strict: false,
    strictNullChecks: true,
    noImplicitAny: true,
    noEmit: true,
    skipLibCheck: true,
  };

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

  // Skipped TS error codes
  const skipCodes = new Set([
    2307, // Cannot find module
    2304, // Cannot find name
    1064, // Return type of async function must be Promise
    2582, // Cannot find name 'test' (test runner globals)
    2593, // Cannot find name 'describe' (test runner globals)
  ]);

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
      if (skipCodes.has(d.code)) continue;

      const srcLine = mapToSource(entry, d.start);
      if (srcLine < 0) continue; // mapped to header

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
  const relRoot = relative(process.cwd(), rootPath) || '.';

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
