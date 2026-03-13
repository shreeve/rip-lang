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
import { createRequire } from 'module';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { mapToSourcePos, offsetToLine, getLineText, findNearestWord, lineColToOffset, offsetToLineCol } from './sourcemap-utils.js';
import { resolve, relative, dirname } from 'path';
import { buildLineMap } from './sourcemaps.js';

// ── Shared helpers ─────────────────────────────────────────────────

// Detect type annotations (:: followed by space or =) ignoring comments,
// string literals, and prototype syntax (Class::method).
export function hasTypeAnnotations(source) {
  return source.split('\n').some(line => {
    // Strip comment
    line = line.replace(/#.*$/, '');
    // Strip string literals (single and double quoted)
    line = line.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");
    return /::[ \t=]/.test(line);
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
  const parts = type.split('|').map(s => s.trim());
  // String literal union: "a" | "b" | "c"
  if (parts.every(p => /^"[^"]*"$/.test(p))) {
    if (/^"[^"]*"$/.test(defVal) && !parts.includes(defVal)) {
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
    if (t === 'string' && !/^"[^"]*"$/.test(defVal)) {
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

  // Parse props on the usage line
  const rest = trimmed.substring(component.length);
  const usedProps = [];
  for (const m of rest.matchAll(/(?:^|,)\s*(@?\w+)\s*:/g)) {
    usedProps.push(m[1]);
  }

  // Collect props from indented block lines below
  const baseIndent = srcLines[lineIndex].length - trimmed.length;
  for (let b = lineIndex + 1; b < srcLines.length; b++) {
    const bLine = srcLines[b];
    if (bLine.trim() === '') continue;
    const bIndent = bLine.length - bLine.trimStart().length;
    if (bIndent <= baseIndent) break;
    for (const m of bLine.trimStart().matchAll(/(?:^|,)\s*(@?\w+)\s*:/g)) {
      usedProps.push(m[1]);
    }
  }

  return { component, usedProps };
}

// Parse component definitions from a DTS string.
// Returns Map<name, { props: [{ name, type, required }] }>.
export function parseComponentDTS(dtsString) {
  const result = new Map();
  if (!dtsString) return result;
  const lines = dtsString.split('\n');
  let i = 0;
  while (i < lines.length) {
    const cm = lines[i].match(/^export declare class (\w+)/);
    if (!cm) { i++; continue; }
    const name = cm[1];
    const props = [];
    let j = i + 1;
    while (j < lines.length) {
      if (/^\}/.test(lines[j])) break;
      if (/constructor\(props\??/.test(lines[j])) {
        j++;
        while (j < lines.length) {
          if (/^\s*\}\);/.test(lines[j])) { j++; break; }
          const pm = lines[j].match(/^\s+(\w+)(\?)?\s*:\s*(.+);$/);
          if (pm) props.push({ name: pm[1], type: pm[3].trim(), required: !pm[2] });
          j++;
        }
        continue;
      }
      j++;
    }
    if (props.length) result.set(name, { props });
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
      const m = new RegExp('(@' + prop.name + ')\\s*(::|([:!]?=))').exec(srcLines[s]);
      if (!m) continue;
      if (m[1 + 1] !== '::') {
        errors.push({ line: s, col: m.index, len: m[1].length, propName: prop.name, message: `Prop '${prop.name}' has no type annotation` });
      } else {
        const dm = srcLines[s].match(new RegExp('@' + prop.name + '\\s*::\\s*(.+?)\\s*:=\\s*(.+)'));
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
export function patchUninitializedTypes(ts, service, compiledEntries) {
  const program = service.getProgram();
  if (!program) return;
  const checker = program.getTypeChecker();

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
      // Recurse into function bodies
      if (ts.isFunctionDeclaration(stmt) && stmt.body) {
        patchStatements(stmt.body.statements);
      }
    }
  }

  for (const [filePath] of compiledEntries) {
    const sf = program.getSourceFile(toVirtual(filePath));
    if (!sf) continue;
    patchStatements(sf.statements);
  }
}

// TS error codes to skip — Rip resolves modules differently and
// treats async return types transparently.
export const SKIP_CODES = new Set([
  2300, // Duplicate identifier (DTS declarations coexist with compiled class bodies)
  2307, // Cannot find module
  2389, // Function implementation name must match overload (DTS + compiled body)
  2391, // Function implementation is missing (DTS overload sigs separated from implementations)
  2393, // Duplicate function implementation
  2394, // Overload signature not compatible with implementation (untyped compiled params)
  2451, // Cannot redeclare block-scoped variable
  2567, // Enum declarations can only merge with namespace or other enum (DTS + compiled body)
  2842, // Unused renaming of destructured property (DTS overload has renamed param unused in declaration)
  1064, // Return type of async function must be Promise
  2582, // Cannot find name 'test' (test runner globals)
  2593, // Cannot find name 'describe' (test runner globals)
]);

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
  // Deduplicate consecutive identical lines (unwrapping can collapse nested messages)
  msg = msg.split('\n').filter((line, i, arr) => i === 0 || line.trim() !== arr[i - 1].trim()).join('\n');
  return msg;
}

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

// ── Shared compilation pipeline ────────────────────────────────────

// Compile a .rip file for type-checking. Prepends DTS declarations to
// compiled JS, detects type annotations, and builds bidirectional
// source maps. Returns everything both the CLI and LSP need.
export function compileForCheck(filePath, source, compiler) {
  const result = compiler.compile(source, { sourceMap: true, types: 'emit', skipPreamble: true, stubComponents: true });
  let code = result.code || '';
  const dts = result.dts ? result.dts.trimEnd() + '\n' : '';

  // Determine if this file should be type-checked.
  // A `# @nocheck` comment near the top of the file opts out entirely.
  const nocheck = /^#\s*@nocheck\b/m.test(source.slice(0, 256));
  const hasOwnTypes = !nocheck && hasTypeAnnotations(source);
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

        // First pass: copy typed params AND return types from signatures to
        // implementations. Typed params give TS type info inside function bodies;
        // return types let TS verify the body matches the declared return.
        for (const inj of injections) {
          const sig = inj.sig.replace(/^declare /, '');
          const sigParams = extractFnParams(sig);
          if (sigParams !== null) {
            cl[inj.codeLine] = replaceFnParams(cl[inj.codeLine], sigParams);
          }
          const retType = extractReturnType(sig);
          if (retType) {
            const braceIdx = cl[inj.codeLine].lastIndexOf('{');
            if (braceIdx > 0) {
              cl[inj.codeLine] = cl[inj.codeLine].slice(0, braceIdx).trimEnd() + retType + ' {';
            }
          }
        }

        // Only inject overload signatures for functions with explicit return types.
        // Functions without a return type annotation let TS infer the return from
        // the implementation body — injecting an overload would force it to `any`.
        const overloads = injections.filter(inj => hasExplicitReturn(inj.sig));

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
          // Inject field declarations only for regular classes (components already have declare fields)
          if (regularMatch && info.fields.length) {
            const inj = info.fields.map(f => `  ${f.name}: ${f.type};`);
            injections.push({ line: j + 1, lines: inj });
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

  // Copy typed constructor props parameter to _init(props) in component classes.
  // Components compile constructor(props: T) and _init(props) separately — TS
  // needs _init to have the same props type to avoid noImplicitAny.
  // The constructor type already includes __bind_xxx__ properties (typed as
  // Signal<T>), so no Record<string, any> widening is needed.
  if (hasTypes && code) {
    const cl = code.split('\n');
    let changed = false;
    for (let j = 0; j < cl.length; j++) {
      // Match: constructor(props?: { ... }) or constructor(props: { ... })
      const cm = cl[j].match(/^\s+constructor\((props)\??\s*:\s*(\{[^}]*\})\)/);
      if (cm) {
        const propsType = `${cm[1]}: ${cm[2]}`;
        // Find _init(props) in the same class
        for (let k = j + 1; k < cl.length; k++) {
          if (cl[k].match(/^((?:export\s+)?(?:const|class)\s+)/)) break;
          if (cl[k].match(/^\s+_init\(props\)\s*\{?\s*$/)) {
            cl[k] = cl[k].replace('_init(props)', `_init(${propsType})`);
            changed = true;
            break;
          }
        }
      }
      // For component classes without typed constructors, type _init(props) as any
      if (cl[j].match(/^\s+_init\(props\)\s*\{?\s*$/)) {
        cl[j] = cl[j].replace('_init(props)', '_init(props: Record<string, any>)');
        changed = true;
      }
    }
    if (changed) code = cl.join('\n');
  }

  // Transfer typed params from `declare function name(...)` into function
  // expressions assigned to variables: `name = function(x) {}` → `name = function(x: T) {}`.
  // Also replace `declare function` with `declare var` so TS doesn't clash
  // with the `let name; name = function(...)` pattern (TS2630).
  if (hasTypes && headerDts && code) {
    const dl = headerDts.split('\n');
    const cl = code.split('\n');
    const funcDecls = new Map();

    for (let i = 0; i < dl.length; i++) {
      const m = dl[i].match(/^(?:export\s+)?declare\s+function\s+(\w+)\((.+)\)(?::\s*(.+))?;$/);
      if (m) funcDecls.set(m[1], { params: m[2], ret: m[3] || null, idx: i });
    }

    if (funcDecls.size > 0) {
      const movedDts = new Set();

      for (let j = 0; j < cl.length; j++) {
        // Match: name = function(args) { or name = (args) => (
        const fm = cl[j].match(/^(\w+)\s*=\s*function\s*\([^)]*\)/);
        const am = !fm && cl[j].match(/^(\w+)\s*=\s*\([^)]*\)\s*=>/);
        const match = fm || am;
        if (match && funcDecls.has(match[1])) {
          const entry = funcDecls.get(match[1]);
          if (fm) {
            cl[j] = cl[j].replace(/function\s*\([^)]*\)/, `function(${entry.params})`);
          } else {
            cl[j] = cl[j].replace(/\([^)]*\)\s*=>/, `(${entry.params}) =>`);
          }
          movedDts.add(entry.idx);
        }
      }

      if (movedDts.size > 0) {
        code = cl.join('\n');
        headerDts = dl.filter((_, i) => !movedDts.has(i)).join('\n').trimEnd() + '\n';
      }
    }
  }

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
      if (m) constTypes.set(m[1], { type: m[2], idx: i });
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
    const needSignal = /\b__state\(/.test(code) && !/\bdeclare function __state\b/.test(headerDts);
    const needComputed = /\b__computed\(/.test(code) && !/\bdeclare function __computed\b/.test(headerDts);
    const needEffect = /\b__effect\(/.test(code) && !/\bdeclare function __effect\b/.test(headerDts);
    if (needSignal || needComputed || needEffect) {
      const decls = [];
      if (needSignal) {
        if (!/\binterface Signal\b/.test(headerDts)) decls.push('interface Signal<T> { value: T; read(): T; lock(): Signal<T>; free(): Signal<T>; kill(): T; }');
        decls.push('declare function __state<T>(value: T | Signal<T>): Signal<T>;');
      }
      if (needComputed) {
        if (!/\binterface Computed\b/.test(headerDts)) decls.push('interface Computed<T> { readonly value: T; read(): T; lock(): Computed<T>; free(): Computed<T>; kill(): T; }');
        decls.push('declare function __computed<T>(fn: () => T): Computed<T>;');
      }
      if (needEffect) decls.push('declare function __effect(fn: () => void | (() => void)): () => void;');
      headerDts = decls.join('\n') + '\n' + headerDts;
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
    const preciseTypes = {
      abort:  'declare function abort(msg?: string): never;',
      assert: 'declare function assert(v: any, msg?: string): asserts v;',
      exit:   'declare function exit(code?: number): never;',
      kind:   'declare function kind(v: any): string;',
      noop:   'declare function noop(): void;',
      p:      'declare function p(...args: any[]): void;',
      pp:     'declare function pp(v: any): any;',
      raise:  'declare function raise(a: any, b?: any): never;',
      rand:   'declare function rand(a?: number, b?: number): number;',
      sleep:  'declare function sleep(ms: number): Promise<void>;',
      todo:   'declare function todo(msg?: string): never;',
      warn:   'declare function warn(...args: any[]): void;',
      zip:    'declare function zip(...arrays: any[][]): any[][];',
    };
    const names = [...getStdlibCode().matchAll(/globalThis\.(\w+)\s*\?\?=/g)].map(m => m[1]);
    const stdlibDecls = names.map(name =>
      preciseTypes[name] || `declare function ${name}(...args: any[]): any;`
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

  let tsContent = (hasTypes ? headerDts + '\n' : '') + code;
  const headerLines = hasTypes ? countLines(headerDts + '\n') : 1;

  // Build bidirectional line maps
  const { srcToGen, genToSrc, srcColToGen } = buildLineMap(result.reverseMap, result.map, headerLines);

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
        if (!srcToGen.has(srcA + d) && genA + d < genB) {
          srcToGen.set(srcA + d, genA + d);
          if (!genToSrc.has(genA + d)) {
            genToSrc.set(genA + d, srcA + d);
          }
        }
      }
    }
  }

  // Parse @rip-src annotations from _render() constructions.  These explicit
  // source-line markers override interpolated mappings so that per-prop type
  // errors land on the correct Rip source line.
  {
    const tsLines = tsContent.split('\n');
    for (let i = 0; i < tsLines.length; i++) {
      const m = tsLines[i].match(/\/\/ @rip-src:(\d+)$/);
      if (m) {
        const srcLine = parseInt(m[1], 10);
        genToSrc.set(i, srcLine);
        if (!srcToGen.has(srcLine)) srcToGen.set(srcLine, i);
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

  return { tsContent, headerLines, hasTypes, srcToGen, genToSrc, srcColToGen, source, dts };
}

// ── Source mapping helpers (delegated to sourcemap-utils.js) ───────

export { mapToSourcePos, offsetToLine, getLineText, findNearestWord, lineColToOffset, offsetToLineCol } from './sourcemap-utils.js';

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
  let compileErrors = 0;

  for (const fp of allFiles) {
    try {
      const source = readFileSync(fp, 'utf8');
      compiled.set(fp, compileForCheck(fp, source, new Compiler()));
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
          compiled.set(imported, compileForCheck(imported, impSrc, new Compiler()));
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

  // Patch uninitialized variables with inferred types (same as LSP)
  patchUninitializedTypes(ts, service, compiled);

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
    const srcLines = entry.source.split('\n');
    for (const d of diags) {
      if (d.start === undefined) continue;
      if (SKIP_CODES.has(d.code)) continue;

      const pos = mapToSourcePos(entry, d.start);
      if (!pos) continue;

      const endPos = d.length ? mapToSourcePos(entry, d.start + d.length) : null;
      const len = endPos && endPos.line === pos.line ? endPos.col - pos.col : 1;

      const message = cleanDiagnosticMessage(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
      const severity = d.category === 1 ? 'error' : d.category === 0 ? 'warning' : 'info';
      const srcLine = srcLines[pos.line] || '';

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

      errors.push({ line: pos.line + 1, col: pos.col + 1, len: Math.max(1, len), message, severity, code: d.code, srcLine, related });
      if (severity === 'error') totalErrors++;
      else if (severity === 'warning') totalWarnings++;
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
        globalDefs.set(name, info.props);
        fileDefs.set(name, info.props);
      }
      localDefs.set(fp, fileDefs);
    }

    // Scan usage sites
    if (globalDefs.size > 0) {
      for (const [fp, entry] of compiled) {
        if (!entry.hasTypes) continue;
        const srcLines = entry.source.split('\n');
        const errors = fileResults.find(r => r.file === fp)?.errors || [];
        const hadEntry = errors.length > 0;
        // Merge: own file's components override global
        const fileDefs = new Map([...globalDefs, ...(localDefs.get(fp) || [])]);

        for (let s = 0; s < srcLines.length; s++) {
          const usage = collectUsageProps(srcLines, s, fileDefs);
          if (!usage) continue;
          const { component: compName, usedProps } = usage;
          const props = fileDefs.get(compName);

          // Unknown props
          for (const used of usedProps) {
            if (used.startsWith('@')) continue;
            if (used === 'class' || used === 'style') continue;
            if (!props.some(p => p.name === used)) {
              const col = srcLines[s].indexOf(used);
              errors.push({ line: s + 1, col: col + 1, len: used.length, message: `Unknown prop '${used}' on component ${compName}`, severity: 'error', code: 'rip', srcLine: srcLines[s], related: [] });
              totalErrors++;
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
        console.log(`${' '.repeat(lineNum.length)} ${' '.repeat(e.col - 1)}${red('~'.repeat(e.len))}`);
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
    return compileErrors > 0 ? 1 : 0;
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

  return totalErrors > 0 ? 1 : 0;
}
