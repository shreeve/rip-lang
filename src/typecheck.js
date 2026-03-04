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
import { createRequire } from 'module';
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
  2300, // Duplicate identifier (DTS declarations coexist with compiled class bodies)
  2304, // Cannot find name
  2307, // Cannot find module
  2389, // Function implementation name must match overload (DTS + compiled body)
  2391, // Function implementation is missing (DTS overload sigs separated from implementations)
  2393, // Duplicate function implementation
  2394, // Overload signature not compatible with implementation (untyped compiled params)
  2451, // Cannot redeclare block-scoped variable
  2567, // Enum declarations can only merge with namespace or other enum (DTS + compiled body)
  1064, // Return type of async function must be Promise
  2582, // Cannot find name 'test' (test runner globals)
  2593, // Cannot find name 'describe' (test runner globals)
  7005, // Variable implicitly has an 'any' type (compiler-generated locals)
  7006, // Parameter implicitly has an 'any' type (compiler-generated params)
  7034, // Variable implicitly has type 'any' in some locations (compiler-generated)
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

// Compile a .rip file for type-checking. Prepends DTS declarations to
// compiled JS, detects type annotations, and builds bidirectional
// source maps. Returns everything both the CLI and LSP need.
export function compileForCheck(filePath, source, compiler) {
  const result = compiler.compile(source, { sourceMap: true, types: 'emit', skipPreamble: true, stubComponents: true });
  let code = result.code || '';
  const dts = result.dts ? result.dts.trimEnd() + '\n' : '';

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
    const fnSigs = [];
    for (let i = 0; i < dl.length; i++) {
      const m = dl[i].match(/^(?:export\s+)?(?:declare\s+)?function\s+(\w+)/);
      if (m) fnSigs.push({ name: m[1], sig: dl[i], idx: i });
    }
    if (fnSigs.length > 0) {
      const injections = [];
      const moved = new Set();
      for (const fn of fnSigs) {
        const pat = new RegExp(`^(?:export\\s+)?(?:async\\s+)?function\\s+${fn.name}\\s*[(<]`);
        for (let j = 0; j < cl.length; j++) {
          if (pat.test(cl[j])) {
            injections.push({ codeLine: j, sig: fn.sig });
            moved.add(fn.idx);
            break;
          }
        }
      }
      if (injections.length > 0) {
        injections.sort((a, b) => a.codeLine - b.codeLine);
        // Adjust reverseMap: each injection shifts subsequent code lines down by 1
        if (result.reverseMap) {
          for (const [, entry] of result.reverseMap) {
            let offset = 0;
            for (const inj of injections) {
              if (inj.codeLine <= entry.genLine + offset) offset++;
            }
            entry.genLine += offset;
          }
        }
        // Insert signatures bottom-up to preserve indices.
        // Strip 'declare ' — signatures must be non-ambient to match implementations.
        for (let k = injections.length - 1; k >= 0; k--) {
          cl.splice(injections[k].codeLine, 0, injections[k].sig.replace(/^declare /, ''));
        }
        code = cl.join('\n');
        // Rebuild header DTS without the moved function signatures
        headerDts = dl.filter((_, i) => !moved.has(i)).join('\n').trimEnd() + '\n';
      }
    }
  }

  let tsContent = (hasTypes ? headerDts + '\n' : '') + code;
  const headerLines = hasTypes ? countLines(headerDts + '\n') : 1;

  // Build bidirectional line maps
  const { srcToGen, genToSrc } = buildLineMap(result.reverseMap, result.map, headerLines);

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

      const m = line.match(/^(?:export\s+)?(?:declare\s+)?(?:let|var|type|interface|enum|class)\s+(\w+)/);
      if (!m) continue;
      const name = m[1];
      for (let s = 0; s < srcLines.length; s++) {
        const src = srcLines[s];
        if (new RegExp('\\b' + name + '\\s*(?:::=|::)').test(src) ||
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
        if (!srcToGen.has(srcA + d) && genA + d < genB) {
          srcToGen.set(srcA + d, genA + d);
          genToSrc.set(genA + d, srcA + d);
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
        // Prefer code-section line (where the assignment lives and TS reports
        // the error) over the DTS declaration line.
        let genLine = codeSrcToGen.get(nextSrc);
        if (genLine === undefined) {
          genLine = srcToGen.get(nextSrc);
          if (genLine !== undefined && genLine < headerLines) genLine = undefined;
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
      }
      tsContent = tsLines.join('\n');
    }
  }

  return { tsContent, headerLines, hasTypes, srcToGen, genToSrc, source, dts };
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
  const rootPath = resolve(targetDir);

  let ts;
  try {
    const req = createRequire(resolve(rootPath, 'package.json'));
    ts = req('typescript');
  } catch {
    try { ts = await import('typescript').then(m => m.default || m); } catch {
      console.error('TypeScript is required for type checking. Install with: bun add -d typescript');
      return 1;
    }
  }

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
  const settings = createTypeCheckSettings(ts);

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

    // Untyped component prop checking — flag props without :: annotation
    if (!opts.allowAny && entry.dts) {
      const dtsLines = entry.dts.split('\n');
      const srcLines = entry.source.split('\n');
      for (let d = 0; d < dtsLines.length; d++) {
        const cm = dtsLines[d].match(/^export declare class (\w+)/);
        if (!cm) continue;
        for (let p = d + 1; p < dtsLines.length; p++) {
          if (/^\}/.test(dtsLines[p])) break;
          const pm = dtsLines[p].match(/^\s+(\w+)\??\s*:/);
          if (!pm) continue;
          const propName = pm[1];
          for (let s = 0; s < srcLines.length; s++) {
            const m = new RegExp('@' + propName + '\\s*(::|([:!]?=))').exec(srcLines[s]);
            if (m) {
              if (m[1] !== '::') {
                errors.push({ line: s + 1, message: `Prop '${propName}' on component ${cm[1]} has no type annotation`, severity: 'error', code: 'rip' });
                totalErrors++;
              }
              break;
            }
          }
        }
      }
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
      console.log(`${loc} ${sev} ${e.message} ${dim(typeof e.code === 'number' ? `TS${e.code}` : '')}`);
    }
  }

  // Summary
  const typedFiles = [...compiled.values()].filter(e => e.hasTypes).length;
  const totalFiles = compiled.size;

  if (totalErrors === 0 && totalWarnings === 0) {
    const summary = typedFiles > 0
      ? `${typedFiles} typed file${typedFiles !== 1 ? 's' : ''} checked, no errors found`
      : `${totalFiles} file${totalFiles !== 1 ? 's' : ''} found, none have type annotations`;
    console.log(`\n${bold('✓')} ${summary}`);
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
