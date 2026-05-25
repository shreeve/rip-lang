// Rip Compiler — S-expression → JavaScript
//
// Architecture: Lexer (tokenize) → Parser (parse) → CodeEmitter (compile) → JavaScript
//
// Metadata bridge: The lexer stores token metadata in .data objects. The Compiler
// class's lexer adapter reconstructs new String() wrapping so grammar actions pass
// metadata through s-expressions unchanged. Two helpers (meta/str) isolate all
// new String() awareness — when the parser gains native .data support, only these
// two functions change.

import { Lexer } from './lexer.js';
import { parser } from './parser.js';
import { installComponentSupport } from './components.js';
// Type emission is CLI/editor-only. dts.js registers itself via
// setTypesEmitter() at module load. The browser never imports dts.js,
// so _typesEmitter stays null and .d.ts output is silently skipped.
let _typesEmitter = null;
export function setTypesEmitter(fn) { _typesEmitter = fn; }
import { installSchemaSupport } from './schema/schema.js';
import { SourceMapGenerator } from './sourcemaps.js';
import { stringify, getStdlibCode } from './stdlib.js';
import { RipError, toRipError } from './error.js';

// =============================================================================
// Metadata helpers — isolate all new String() awareness here
// =============================================================================

let meta = (node, key) => node instanceof String ? node[key] : undefined;
let str  = (node) => node instanceof String ? node.valueOf() : node;

// =============================================================================
// S-Expression Pretty Printer
// =============================================================================

let INLINE_FORMS = new Set([
  '+', '-', '*', '/', '%', '//', '%%', '**',
  '==', '!=', '<', '>', '<=', '>=', '===', '!==',
  '&&', '||', '??', 'not',
  '&', '|', '^', '<<', '>>', '>>>',
  '=', '.', '?.', '[]',
  '!', 'typeof', 'void', 'delete', 'new',
  '...', 'rest', 'expansion', 'optindex', 'optcall',
]);

let STMT_ONLY = new Set([
  'def', 'class', 'if', 'unless', 'for-in', 'for-of', 'for-as',
  'while', 'until', 'loop', 'switch', 'try', 'throw',
]);

let MAP_LITERAL_KEYS = new Set(['true', 'false', 'null', 'undefined', 'Infinity', 'NaN']);

function isInline(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  let head = arr[0]?.valueOf?.() ?? arr[0];
  if (INLINE_FORMS.has(head)) return true;
  return arr.length <= 4 && !arr.some(Array.isArray);
}

function formatAtom(elem) {
  if (Array.isArray(elem)) return '(???)';
  if (typeof elem === 'number') return String(elem);
  if (elem === null) return 'null';
  if (elem === '') return '""';
  let s = String(elem);
  if (s[0] === '/' && s.indexOf('\n') >= 0) {
    let match = s.match(/\/([gimsuvy]*)$/);
    let flags = match ? match[1] : '';
    let content = s.slice(1);
    content = flags ? content.slice(0, -flags.length - 1) : content.slice(0, -1);
    let lines = content.split('\n');
    let cleaned = lines.map(line => line.replace(/#.*$/, '').trim());
    return `"/${cleaned.join('')}/${flags}"`;
  }
  return s;
}

function formatSExpr(arr, indent = 0, isTopLevel = false) {
  if (!Array.isArray(arr)) return formatAtom(arr);
  if (isTopLevel && arr[0] === 'program') {
    let secondElem = arr[1];
    let header = Array.isArray(secondElem) ? '(program' : '(program ' + formatAtom(secondElem);
    let lines = [header];
    let startIndex = Array.isArray(secondElem) ? 1 : 2;
    for (let i = startIndex; i < arr.length; i++) {
      let child = formatSExpr(arr[i], 2, false);
      lines.push(child[0] === '(' ? '  ' + child : child);
    }
    lines.push(')');
    return lines.join('\n');
  }
  let head = arr[0];
  let canBeInline = isInline(arr) && arr.slice(1).every(elem => !Array.isArray(elem) || isInline(elem));
  if (canBeInline) {
    let parts = arr.map(elem => Array.isArray(elem) ? formatSExpr(elem, 0, false) : formatAtom(elem));
    let inline = `(${parts.join(' ')})`;
    if (!inline.includes('\n')) return ' '.repeat(indent) + inline;
  }
  let spaces = ' '.repeat(indent);
  let formattedHead;
  if (Array.isArray(head)) {
    formattedHead = formatSExpr(head, 0, false);
    if (formattedHead.includes('\n')) {
      let headLines = formattedHead.split('\n');
      formattedHead = headLines.map((line, i) => i === 0 ? line : ' '.repeat(indent + 2) + line).join('\n');
    }
  } else {
    formattedHead = formatAtom(head);
  }
  let lines = [`${spaces}(${formattedHead}`];
  let forceChildrenOnNewLines = head === 'block';
  for (let i = 1; i < arr.length; i++) {
    let elem = arr[i];
    if (!Array.isArray(elem)) {
      lines[lines.length - 1] += ' ' + formatAtom(elem);
    } else {
      let childInline = isInline(elem) && elem.every(e => !Array.isArray(e) || isInline(e));
      if (!forceChildrenOnNewLines && childInline) {
        let formatted = formatSExpr(elem, 0, false);
        if (!formatted.includes('\n')) {
          lines[lines.length - 1] += ' ' + formatted;
          continue;
        }
      }
      lines.push(formatSExpr(elem, indent + 2, false));
    }
  }
  lines[lines.length - 1] += ')';
  return lines.join('\n');
}

// =============================================================================
// Code Generator
// =============================================================================

export class CodeEmitter {

  static ASSIGNMENT_OPS = new Set([
    '=', '+=', '-=', '*=', '/=', '?=', '&=', '|=', '^=', '%=',
    '**=', '??=', '&&=', '||=', '<<=', '>>=', '>>>='
  ]);

  static NUMBER_LITERAL_RE = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;
  static NUMBER_START_RE = /^-?\d/;

  // Dispatch table: s-expression head → method name
  static GENERATORS = {
    'program': 'emitProgram',

    // Logical (flatten chains)
    '&&': 'emitLogicalAnd',
    '||': 'emitLogicalOr',

    // Binary operators (shared)
    '+': 'emitBinaryOp', '-': 'emitBinaryOp', '*': 'emitBinaryOp',
    '/': 'emitBinaryOp', '%': 'emitBinaryOp', '**': 'emitBinaryOp',
    '==': 'emitBinaryOp', '===': 'emitBinaryOp', '!=': 'emitBinaryOp',
    '!==': 'emitBinaryOp', '<': 'emitBinaryOp', '>': 'emitBinaryOp',
    '<=': 'emitBinaryOp', '>=': 'emitBinaryOp', '??': 'emitBinaryOp',
    '&': 'emitBinaryOp', '|': 'emitBinaryOp',
    '^': 'emitBinaryOp', '<<': 'emitBinaryOp', '>>': 'emitBinaryOp',
    '>>>': 'emitBinaryOp',

    // Special operators
    '%%': 'emitModulo',
    '%%=': 'emitModuloAssign',
    '//': 'emitFloorDiv',
    '//=': 'emitFloorDivAssign',
    '..': 'emitRange',

    // Assignment (shared)
    '=': 'emitAssignment',
    '+=': 'emitAssignment', '-=': 'emitAssignment', '*=': 'emitAssignment',
    '/=': 'emitAssignment', '%=': 'emitAssignment', '**=': 'emitAssignment',
    '&&=': 'emitAssignment', '||=': 'emitAssignment', '??=': 'emitAssignment',
    '?=': 'emitAssignment', '&=': 'emitAssignment', '|=': 'emitAssignment',
    '^=': 'emitAssignment', '<<=': 'emitAssignment', '>>=': 'emitAssignment',
    '>>>=': 'emitAssignment',

    '...': 'emitRange',
    '!': 'emitNot',
    '~': 'emitBitwiseNot',
    '++': 'emitIncDec',
    '--': 'emitIncDec',
    '=~': 'emitRegexMatch',
    'instanceof': 'emitInstanceof',
    'in': 'emitIn',
    'of': 'emitOf',
    'typeof': 'emitTypeof',
    'delete': 'emitDelete',
    'new': 'emitNew',

    // Data structures
    'array': 'emitArray',
    'object': 'emitObject',
    'map-literal': 'emitMap',
    'block': 'emitBlock',

    // Property access
    '.': 'emitPropertyAccess',
    '?.': 'emitOptionalProperty',
    '[]': 'emitIndexAccess',
    'optindex': 'emitOptIndex',
    'optcall': 'emitOptCall',
    'regex-index': 'emitRegexIndex',

    // Pick operator — obj.{a, b: c, d = default}
    // Heads are non-identifier shapes so they can't collide with a user
    // function named `pick` (e.g. `pick = (x) -> ...; pick(false)`).
    '.{}':  'emitPick',
    '?.{}': 'emitOptPick',

    // Functions
    'def': 'emitDef',
    '->': 'emitThinArrow',
    '=>': 'emitFatArrow',
    'return': 'emitReturn',

    // Reactive
    'state': 'emitState',
    'computed': 'emitComputed',
    'readonly': 'emitReadonly',
    'effect': 'emitEffect',

    // Control flow — simple
    'break': 'emitBreak',
    'continue': 'emitContinue',
    '?': 'emitExistential',
    'presence': 'emitPresence',
    '?:': 'emitTernary',
    '|>': 'emitPipe',
    'loop': 'emitLoop',
    'loop-n': 'emitLoopN',
    'await': 'emitAwait',
    'yield': 'emitYield',
    'yield-from': 'emitYieldFrom',

    // Control flow — complex
    'if': 'emitIf',
    'for-in': 'emitForIn',
    'for-of': 'emitForOf',
    'for-as': 'emitForAs',
    'while': 'emitWhile',
    'try': 'emitTry',
    'throw': 'emitThrow',
    'control': 'emitControl',
    'switch': 'emitSwitch',
    'when': 'emitWhen',

    // Comprehensions
    'comprehension': 'emitComprehension',
    'object-comprehension': 'emitObjectComprehension',

    // Classes
    'class': 'emitClass',
    'super': 'emitSuper',

    // Components
    'component': 'emitComponent',
    'render': 'emitRender',
    'offer': 'emitOffer',
    'accept': 'emitAccept',

    // Types
    'enum': 'emitEnum',

    // Schema
    'schema': 'emitSchema',

    // Modules
    'import': 'emitImport',
    'export': 'emitExport',
    'export-default': 'emitExportDefault',
    'export-all': 'emitExportAll',
    'export-from': 'emitExportFrom',

    // Special forms
    'do-iife': 'emitDoIIFE',
    'regex': 'emitRegex',
    'tagged-template': 'emitTaggedTemplate',
    'str': 'emitString',

    // Symbol literals
    'symbol': 'emitSymbol',
  };

  constructor(options = {}) {
    this.options = options;
    this.indentLevel = 0;
    this.indentString = '  ';
    this.comprehensionDepth = 0;
    this.dataSection = options.dataSection;
    this.sourceMap = options.sourceMap || null;
    if (options.reactiveVars) {
      this.reactiveVars = new Set(options.reactiveVars);
    }
  }

  // Throw a RipError with source location from the nearest s-expression node
  error(message, sexpr, { suggestion } = {}) {
    throw RipError.fromSExpr(message, sexpr, this.options.source, this.options.filename, suggestion);
  }

  // ---------------------------------------------------------------------------
  // Entry point
  // ---------------------------------------------------------------------------

  compile(sexpr) {
    this.programVars = new Set();
    this.functionVars = new Map();
    this.helpers = new Set();
    this.scopeStack = [];  // Track enclosing function scopes for proper variable hoisting
    this.collectProgramVariables(sexpr);
    let code = this.emit(sexpr);

    // Build source map mappings from generation-time recorded entries
    if (this.sourceMap) this.buildMappings();

    return code;
  }

  // Build source map from generation-time recorded entries.
  // Each entry pairs a statement's generated code with its source loc.
  // Output line positions are computed by exact arithmetic — no heuristics.
  buildMappings() {
    if (!this._stmtEntries) return;
    let lineOffset = this._preambleLines;
    for (let entry of this._stmtEntries) {
      if (entry.loc) {
        this.sourceMap.addMapping(lineOffset, 0, entry.loc.r, entry.loc.c);
      }
      // Record sub-expression mappings for finer-grained source positions
      if (entry.sexpr && entry.loc) {
        this.recordSubMappings(entry.code, entry.sexpr, lineOffset);
      }
      lineOffset += entry.code.split('\n').length;
    }
  }

  // Check whether a column position falls inside a string literal on a line of
  // generated JavaScript/TypeScript.  Used by recordSubMappings to skip false
  // matches (e.g. identifiers appearing as values inside union type strings).
  static _isColInsideString(line, col) {
    let inStr = false, quote = '';
    // When inside a template literal (`...`), `${...}` opens an interpolation
    // expression that is NOT part of the string.  Track interp depth so
    // identifiers inside `${expr}` aren't incorrectly classified as strings.
    let interpDepth = 0;
    for (let i = 0; i < line.length && i < col; i++) {
      let ch = line[i];
      if (inStr) {
        if (ch === '\\') { i++; continue; }
        if (quote === '`' && ch === '$' && line[i + 1] === '{') {
          interpDepth = 1;
          inStr = false;
          i++; // skip `{`
          continue;
        }
        if (ch === quote) inStr = false;
      } else if (interpDepth > 0) {
        if (ch === '{') interpDepth++;
        else if (ch === '}') {
          interpDepth--;
          if (interpDepth === 0) { inStr = true; quote = '`'; }
        } else if (ch === '"' || ch === "'" || ch === '`') {
          // Nested string inside interpolation — recurse via inStr handling
          inStr = true; quote = ch;
        }
      } else if (ch === '"' || ch === "'" || ch === '`') {
        inStr = true; quote = ch;
      }
    }
    return inStr;
  }

  // Walk the s-expression tree and record source map entries for
  // sub-expressions that carry .loc, giving column-level precision.
  //
  // Performance: the inner loop runs M × N times where M = sub-expressions
  // and N = regex matches per sub-expression. Computing genLine/genCol via
  // `code.substring(0, m.index).split('\n')` was O(N) per match, making
  // the function O(M × N²) overall and catastrophic on large generated
  // blocks (a 100KB statement was taking 36 seconds in the browser).
  //
  // Fix: precompute a sorted `lineStarts` array (offset of each line's
  // first character), then binary-search to convert offset → line/col in
  // O(log N) per match. Brings the inline-gallery compile from 36s → ~30ms.
  recordSubMappings(code, sexpr, lineOffset) {
    let stmtOrigLine = sexpr.loc ? sexpr.loc.r : 0;
    let subs = [];
    this.collectSubExprs(sexpr, subs);
    let codeLines = code.split('\n');
    // lineStarts[i] = offset in `code` of the first char on line i.
    // Length is codeLines.length; lineStarts[0] is 0.
    const lineStarts = [0];
    for (let i = 0; i < code.length; i++) {
      if (code.charCodeAt(i) === 10) lineStarts.push(i + 1);
    }
    // Binary-search the largest lineStart <= offset; that gives the line.
    const offsetToLine = (offset) => {
      let lo = 0, hi = lineStarts.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (lineStarts[mid] <= offset) lo = mid + 1;
        else hi = mid - 1;
      }
      return hi;
    };
    // Track generated positions already claimed by an earlier sub-expression
    // in this statement, so distinct source positions (e.g. `a` in two
    // adjacent arrow functions) can't all collapse onto the first match.
    // Without this, identical identifiers in repeated structures get
    // mis-mapped — e.g. `else if` branches inheriting the `if` branch's
    // generated coordinates, leaving the real branch unmapped.
    const usedGenPositions = new Set();
    // Cache `// @rip-src:N` annotations per generated line so render-block
    // stub mappings can be honored over unrelated heuristic matches.
    const ripSrcCache = new Map();
    const getRipSrcAnnot = (genLineInStmt) => {
      if (ripSrcCache.has(genLineInStmt)) return ripSrcCache.get(genLineInStmt);
      const lt = codeLines[genLineInStmt];
      const m = lt && lt.match(/\/\/ @rip-src:(\d+)\s*$/);
      const v = m ? parseInt(m[1], 10) : null;
      ripSrcCache.set(genLineInStmt, v);
      return v;
    };
    // Inline type annotations (emitted when `inlineTypes: true`) inject
    // identifiers into function-signature lines that have no source
    // counterpart — e.g. `header(name, value, opts: { append?: boolean })`.
    // Their identifiers (`append`, `boolean`, etc.) would otherwise compete
    // with real body identifiers in the regex matcher below, mis-mapping
    // source positions onto the type literal. Detect those brace ranges
    // per line and skip matches inside them.
    const inlineTypeRangesCache = new Map();
    const getInlineTypeRanges = (genLineInStmt) => {
      if (inlineTypeRangesCache.has(genLineInStmt)) return inlineTypeRangesCache.get(genLineInStmt);
      const lt = codeLines[genLineInStmt];
      const ranges = [];
      // Only look at function-signature shaped lines: contain `(...) {` or `(...) =>`.
      if (lt && /\)\s*(\{|=>)\s*$/.test(lt)) {
        // Find `: {` after an identifier (with optional `?` and whitespace).
        const annotRe = /\b[a-zA-Z_$][\w$]*\??\s*:\s*\{/g;
        let am;
        while ((am = annotRe.exec(lt)) !== null) {
          const braceStart = am.index + am[0].length - 1; // position of `{`
          // Skip inside strings (defensive — unlikely here)
          if (CodeEmitter._isColInsideString(lt, braceStart)) continue;
          // Walk to matching `}` honoring brace depth and strings
          let depth = 1, j = braceStart + 1, inStr = false, quote = '';
          while (j < lt.length && depth > 0) {
            const ch = lt[j];
            if (inStr) {
              if (ch === '\\') { j += 2; continue; }
              if (ch === quote) inStr = false;
            } else if (ch === '"' || ch === "'" || ch === '`') {
              inStr = true; quote = ch;
            } else if (ch === '{') depth++;
            else if (ch === '}') depth--;
            j++;
          }
          ranges.push([braceStart, j]); // exclude positions [braceStart, j)
          annotRe.lastIndex = j;
        }
      }
      inlineTypeRangesCache.set(genLineInStmt, ranges);
      return ranges;
    };
    for (let { name, origLine, origCol } of subs) {
      let escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let re = new RegExp('\\b' + escaped + '\\b', 'g');
      let m;
      let bestMatch = null, bestDist = Infinity;
      let bestUnused = null, bestUnusedDist = Infinity;
      let origLineInStmt = origLine - stmtOrigLine;
      while ((m = re.exec(code)) !== null) {
        const genLineInStmt = offsetToLine(m.index);
        const genCol = m.index - lineStarts[genLineInStmt];
        let lineText = codeLines[genLineInStmt];
        // A `// @rip-src:N` annotation tags the generated line as derived
        // from source line N (used by render-block stubs). When N matches
        // the sub-expression's origLine, accept matches here even if they
        // fall inside string literals — render stubs emit tag names as
        // `'p'` and interpolations as `${...}` inside template strings.
        const annotSrc = getRipSrcAnnot(genLineInStmt);
        const annotMatches = annotSrc != null && annotSrc === origLine;
        if (lineText && CodeEmitter._isColInsideString(lineText, genCol) && !annotMatches) continue;
        // Skip matches inside inline type annotation brace ranges (e.g.
        // `opts: { append?: boolean }`) — those identifiers are emitted
        // for TS type-checking only and have no real source counterpart.
        const itRanges = getInlineTypeRanges(genLineInStmt);
        if (itRanges.length && itRanges.some(([s, e]) => genCol >= s && genCol < e)) continue;
        let genLine = lineOffset + genLineInStmt;
        // Annotation-matched lines are the authoritative gen position for
        // their source line — score them as a perfect line match so they
        // beat any heuristic match elsewhere in the statement.
        let dist = annotMatches
          ? Math.abs(genCol - origCol)
          : Math.abs(genLineInStmt - origLineInStmt) * 10000 + Math.abs(genCol - origCol);
        if (dist < bestDist) { bestDist = dist; bestMatch = { genLine, genCol }; }
        const key = genLine + ':' + genCol;
        if (!usedGenPositions.has(key) && dist < bestUnusedDist) {
          bestUnusedDist = dist; bestUnused = { genLine, genCol };
        }
      }
      const chosen = bestUnused || bestMatch;
      if (chosen) {
        this.sourceMap.addMapping(chosen.genLine, chosen.genCol, origLine, origCol);
        usedGenPositions.add(chosen.genLine + ':' + chosen.genCol);
      }
    }
  }

  // Collect identifier anchors from sub-expression nodes with .loc.
  collectSubExprs(node, result) {
    if (!Array.isArray(node)) return;
    // If node[0] is not a string-like head (e.g. array-of-arrays like the cases
    // list in a switch), recurse into ALL children including index 0.
    let head = node[0];
    if (Array.isArray(head) || (head != null && typeof head !== 'string' && !(head instanceof String))) {
      for (let i = 0; i < node.length; i++) {
        if (Array.isArray(node[i])) this.collectSubExprs(node[i], result);
      }
      // Also honor side-channel anchors attached to nodes whose head is an
      // array (e.g. tag-shorthand `[(. p error), error]` where the tag
      // node's head is itself an access expression). Without this, anchors
      // attached by walkRender to such nodes are silently dropped.
      if (Array.isArray(node._anchors)) {
        for (const a of node._anchors) result.push(a);
      }
      return;
    }
    if (node.loc) {
      head = str(head);
      let ident = null;
      let identCol = node.loc.c;
      // Property access: anchor is the property name (check BEFORE operators
      // because the operator regex also matches '.' via ^\.\.?$)
      if (head === '.') {
        if (typeof node[2] === 'string') {
          ident = node[2];
          // Adjust origCol to point at the property name itself, not the start
          // of the access expression. node.loc.c marks the object start;
          // shift past it and the `.` so source-mapping anchors land on the
          // property identifier (e.g. `image` in `product.image`).
          if (typeof node[1] === 'string') {
            identCol = node.loc.c + node[1].length + 1;
          }
        }
      }
      // Operators/keywords: anchor is the subject at index 1
      else if (typeof head === 'string' && /^[=+\-*/%<>!&|?~^]|^\.\.?$|^def$|^class$|^state$|^computed$|^readonly$|^for-/.test(head)) {
        if (typeof node[1] === 'string' && /^[a-zA-Z_$]/.test(node[1])) ident = node[1];
      }
      // Function call (head is identifier)
      else if (typeof head === 'string' && /^[a-zA-Z_$]/.test(head)) {
        ident = head;
      }
      if (ident) result.push({ name: ident, origLine: node.loc.r, origCol: identCol });
    }
    // Side-channel anchors attached by walkRender for bare-identifier
    // children of template-tag nodes (e.g. `error` in `p.error error`).
    // The s-expression child is a plain string atom with no .loc, so the
    // walk would otherwise miss it; the anchor carries the source position
    // computed from the parent's loc plus a regex scan over source lines.
    if (Array.isArray(node._anchors)) {
      for (const a of node._anchors) result.push(a);
    }
    // Recurse into children (skip head at index 0 — already processed via parent).
    // For arrow functions (-> / =>), skip index 1 (params array) — parameter
    // names are not call expressions and would produce incorrect mappings via
    // the distance heuristic when the same identifier appears in other methods.
    let start = (head === '->' || head === '=>') ? 2 : 1;
    for (let i = start; i < node.length; i++) {
      if (Array.isArray(node[i])) this.collectSubExprs(node[i], result);
    }
  }

  // ---------------------------------------------------------------------------
  // Variable collection
  // ---------------------------------------------------------------------------

  collectProgramVariables(sexpr) {
    if (!Array.isArray(sexpr)) return;
    let [head, ...rest] = sexpr;
    head = str(head);

    if (Array.isArray(head)) {
      sexpr.forEach(item => this.collectProgramVariables(item));
      return;
    }

    if (head === 'export' || head === 'export-default' || head === 'export-all' || head === 'export-from') return;

    if (head === 'state' || head === 'computed') {
      let [target] = rest;
      let varName = str(target) ?? target;
      if (!this.reactiveVars) this.reactiveVars = new Set();
      this.reactiveVars.add(varName);
      return;
    }

    if (head === 'readonly') {
      let [name] = rest;
      let varName = str(name) ?? name;
      if (!this.readonlyVars) this.readonlyVars = new Set();
      this.readonlyVars.add(varName);
      return;
    }
    if (head === 'component') return;  // Component body has its own scope
    if (head === 'enum') return;       // Enum members are not top-level variables

    if (CodeEmitter.ASSIGNMENT_OPS.has(head)) {
      let [target, value] = rest;
      if (typeof target === 'string' || target instanceof String) {
        let varName = str(target);
        if (!this.reactiveVars?.has(varName) && !this.readonlyVars?.has(varName)) this.programVars.add(varName);
      } else if (this.is(target, 'array')) {
        this.collectVarsFromArray(target, this.programVars);
      } else if (this.is(target, 'object')) {
        this.collectVarsFromObject(target, this.programVars);
      }
      this.collectProgramVariables(value);
      return;
    }

    if (head === 'for-in' || head === 'for-of' || head === 'for-as') {
      this.collectVarsFromLoopHead(rest[0], this.programVars);
      rest.slice(1).forEach(item => this.collectProgramVariables(item));
      return;
    }

    if (head === 'def' || head === '->' || head === '=>' || head === 'effect') return;

    if (head === 'if') {
      let [condition, thenBranch, elseBranch] = rest;
      this.collectProgramVariables(condition);
      this.collectProgramVariables(thenBranch);
      if (elseBranch) this.collectProgramVariables(elseBranch);
      return;
    }

    if (head === 'try') {
      this.collectProgramVariables(rest[0]);
      if (rest.length >= 2 && Array.isArray(rest[1]) && rest[1].length === 2 && rest[1][0] !== 'block') {
        let [param, catchBlock] = rest[1];
        if (param && this.is(param, 'object')) {
          param.slice(1).forEach(pair => {
            if (Array.isArray(pair) && pair.length === 2 && typeof pair[1] === 'string') {
              this.programVars.add(pair[1]);
            }
          });
        } else if (param && this.is(param, 'array')) {
          param.slice(1).forEach(item => {
            if (typeof item === 'string') this.programVars.add(item);
          });
        }
        this.collectProgramVariables(catchBlock);
      }
      if (rest.length === 3) this.collectProgramVariables(rest[2]);
      else if (rest.length === 2 && (!Array.isArray(rest[1]) || rest[1][0] === 'block')) {
        this.collectProgramVariables(rest[1]);
      }
      return;
    }

    rest.forEach(item => this.collectProgramVariables(item));
  }

  collectFunctionVariables(body) {
    let vars = new Set();
    let collect = (sexpr) => {
      if (!Array.isArray(sexpr)) return;
      let [head, ...rest] = sexpr;
      head = str(head);
      if (Array.isArray(head)) { sexpr.forEach(item => collect(item)); return; }
      if (CodeEmitter.ASSIGNMENT_OPS.has(head)) {
        let [target, value] = rest;
        // Match collectProgramVariables: identifier targets may arrive as
        // String wrappers when types.js attaches `.data.type` metadata
        // to a typed local. Without unwrapping the wrapper, typed locals
        // skip the function-top `let` declaration and silently leak to
        // the global scope.
        if (typeof target === 'string' || target instanceof String) vars.add(str(target));
        else if (this.is(target, 'array')) this.collectVarsFromArray(target, vars);
        else if (this.is(target, 'object')) this.collectVarsFromObject(target, vars);
        collect(value);
        return;
      }
      if (head === 'for-in' || head === 'for-of' || head === 'for-as') {
        this.collectVarsFromLoopHead(rest[0], vars);
        rest.slice(1).forEach(collect);
        return;
      }
      if (head === 'def' || head === '->' || head === '=>' || head === 'effect') return;
      if (head === 'try') {
        collect(rest[0]);
        if (rest.length >= 2 && Array.isArray(rest[1]) && rest[1].length === 2 && rest[1][0] !== 'block') {
          let [param, catchBlock] = rest[1];
          if (param && this.is(param, 'object')) {
            param.slice(1).forEach(pair => {
              if (Array.isArray(pair) && pair.length === 2 && typeof pair[1] === 'string') vars.add(pair[1]);
            });
          } else if (param && this.is(param, 'array')) {
            param.slice(1).forEach(item => { if (typeof item === 'string') vars.add(item); });
          }
          collect(catchBlock);
        }
        if (rest.length === 3) collect(rest[2]);
        else if (rest.length === 2 && (!Array.isArray(rest[1]) || rest[1][0] === 'block')) collect(rest[1]);
        return;
      }
      rest.forEach(item => collect(item));
    };
    collect(body);
    return vars;
  }

  // Walk a function body and collect typed local assignments. Returns a
  // Map<name, typeString> for every `name:: T = value` whose target is a
  // String-wrapped identifier carrying `data.type` (attached by types.js).
  //
  // Used by `emitBodyWithReturns` in `inlineTypes` mode to annotate the
  // function-top hoist (`let a, y: boolean, b;`) so shadow-TS sees the
  // intended type instead of inferring a literal from the first RHS. Stops
  // at nested function boundaries — each function owns its own typed locals.
  //
  // Conflict policy: first annotation wins. Same-name re-annotations are
  // silently ignored; mixing different types on the same local is an
  // unusual pattern best surfaced by TS itself once the hoist carries the
  // first annotation.
  collectTypedLocals(body) {
    let typed = new Map();
    let walk = (sexpr) => {
      if (!Array.isArray(sexpr)) return;
      let [head, ...rest] = sexpr;
      head = str(head);
      if (Array.isArray(head)) { sexpr.forEach(walk); return; }
      if (CodeEmitter.ASSIGNMENT_OPS.has(head)) {
        let [target, value] = rest;
        if (target instanceof String && target.type && !typed.has(str(target))) {
          typed.set(str(target), target.type);
        }
        walk(value);
        return;
      }
      if (head === 'def' || head === '->' || head === '=>' || head === 'effect') return;
      rest.forEach(walk);
    };
    walk(body);
    return typed;
  }

  // ---------------------------------------------------------------------------
  // Main dispatch
  // ---------------------------------------------------------------------------

  emit(sexpr, context = 'statement') {
    // String object with metadata (quote, await, optional, heregex, etc.)
    if (sexpr instanceof String) {
      // Dammit operator (!)
      if (meta(sexpr, 'await') === true) {
        return `await ${str(sexpr)}()`;
      }

      // Existence check (?)
      if (meta(sexpr, 'optional')) {
        return `(${str(sexpr)} != null)`;
      }

      // Heregex
      if (meta(sexpr, 'delimiter') === '///' && meta(sexpr, 'heregex')) {
        let primitive = str(sexpr);
        let match = primitive.match(/^\/(.*)\/([gimsuvy]*)$/s);
        if (match) {
          let [, pattern, flags] = match;
          return `/${this.processHeregex(pattern)}/${flags}`;
        }
        return primitive;
      }

      // Quoted string
      let quote = meta(sexpr, 'quote');
      if (quote) {
        let primitive = str(sexpr);
        if (quote === '"""' || quote === "'''") {
          let content = this.extractStringContent(sexpr);
          content = content.replace(/`/g, '\\`').replace(/\${/g, '\\${');
          return `\`${content}\``;
        }
        if (primitive[0] === quote) return primitive;
        let content = primitive.slice(1, -1);
        return `${quote}${content}${quote}`;
      }

      sexpr = str(sexpr);
    }

    // Plain string (identifier, keyword, literal)
    if (typeof sexpr === 'string') {
      if (sexpr.startsWith('"') || sexpr.startsWith("'") || sexpr.startsWith('`')) {
        if (this.options.debug) console.warn('[Rip] Unexpected quoted primitive:', sexpr);
        let content = sexpr.slice(1, -1);
        if (content.includes('\n')) {
          return `\`${content.replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\``;
        }
        let delim = content.includes("'") && !content.includes('"') ? '"' : "'";
        let escaped = content.replace(new RegExp(delim, 'g'), `\\${delim}`);
        return `${delim}${escaped}${delim}`;
      }
      if (this.reactiveVars?.has(sexpr) && !this.suppressReactiveUnwrap) {
        return `${sexpr}.value`;
      }
      return sexpr;
    }

    if (typeof sexpr === 'number') return String(sexpr);
    if (sexpr === null || sexpr === undefined) return 'null';
    if (!Array.isArray(sexpr)) this.error(`Invalid s-expression: ${JSON.stringify(sexpr)}`, sexpr);

    let [head, ...rest] = sexpr;

    // Preserve await metadata before converting head to primitive
    let headAwaitMeta = meta(head, 'await');
    head = str(head);

    // Dispatch table
    let method = CodeEmitter.GENERATORS[head];
    if (method) return this[method](head, rest, context, sexpr);

    // ---- Function calls (dynamic — not in dispatch table) ----

    if (typeof head === 'string' && !head.startsWith('"') && !head.startsWith("'")) {
      if (CodeEmitter.NUMBER_START_RE.test(head)) return head;

      // super.methodName() in non-constructor methods
      if (head === 'super' && this.currentMethodName && this.currentMethodName !== 'constructor') {
        return `super.${this.currentMethodName}(${this._emitArgs(rest)})`;
      }

      let postfix = this._tryPostfixCall(head, rest, context);
      if (postfix) return postfix;

      let needsAwait = headAwaitMeta === true;
      let callStr = `${this.emit(head, 'value')}(${this._emitArgs(rest)})`;
      return needsAwait ? `await ${callStr}` : callStr;
    }

    // Statement sequence (comma operator)
    if (Array.isArray(head) && typeof head[0] === 'string') {
      let stmtOps = ['=', '+=', '-=', '*=', '/=', '%=', '**=', '&&=', '||=', '??=', 'if', 'return', 'throw'];
      if (stmtOps.includes(head[0])) {
        return `(${sexpr.map(stmt => this.emit(stmt, 'value')).join(', ')})`;
      }
    }

    // Complex callee (property access, index, etc.)
    if (Array.isArray(head)) {
      // Ruby-style: XXX.new(args) → new XXX(args)
      if (head[0] === '.' && (head[2] === 'new' || str(head[2]) === 'new')) {
        let ctorExpr = head[1];
        let ctorCode = this.emit(ctorExpr, 'value');
        let needsParens = Array.isArray(ctorExpr);
        return `new ${needsParens ? `(${ctorCode})` : ctorCode}(${this._emitArgs(rest)})`;
      }

      let postfix = this._tryPostfixCall(head, rest, context);
      if (postfix) return postfix;

      // Property access with await sigil on property
      let needsAwait = false;
      let calleeCode;
      if (head[0] === '.' && meta(head[2], 'await') === true) {
        needsAwait = true;
        let [obj, prop] = head.slice(1);
        let objCode = this.emit(obj, 'value');
        let needsParens = CodeEmitter.NUMBER_LITERAL_RE.test(objCode) ||
                          ((this.is(obj, 'object') || this.is(obj, 'await') || this.is(obj, 'yield')));
        let base = needsParens ? `(${objCode})` : objCode;
        calleeCode = `${base}.${str(prop)}`;
      } else {
        calleeCode = this.emit(head, 'value');
      }

      let callStr = `${calleeCode}(${this._emitArgs(rest)})`;
      return needsAwait ? `await ${callStr}` : callStr;
    }

    this.error(`Unknown s-expression type: ${head}`, sexpr);
  }

  // ---------------------------------------------------------------------------
  // Program
  // ---------------------------------------------------------------------------

  emitProgram(head, statements, context, sexpr) {
    let code = '';
    let imports = [], body = [];

    for (let stmt of statements) {
      if (!Array.isArray(stmt)) { body.push(stmt); continue; }
      let h = stmt[0];
      if (h === 'import') imports.push(stmt);
      else body.push(stmt);
    }

    // Generate body first to detect needed helpers
    let blockStmts = ['def', 'class', 'if', 'for-in', 'for-of', 'for-as', 'while', 'loop', 'switch', 'try'];
    let stmtEntries = body.map((stmt, index) => {
      let isSingle = body.length === 1 && imports.length === 0;
      let isObj = this.is(stmt, 'object');
      let isObjComp = isObj && stmt.length === 2 && Array.isArray(stmt[1]) && Array.isArray(stmt[1][2]) && stmt[1][2][0] === 'comprehension';
      let isAlreadyExpr = (this.is(stmt, 'comprehension') || this.is(stmt, 'object-comprehension') || this.is(stmt, 'do-iife'));
      let hasNoVars = this.programVars.size === 0;
      let needsParens = isSingle && isObj && hasNoVars && !isAlreadyExpr && !isObjComp;
      let isLast = index === body.length - 1;
      let isLastComp = isLast && isAlreadyExpr;

      let generated;
      if (needsParens) generated = `(${this.emit(stmt, 'value')})`;
      else if (isLastComp) generated = this.emit(stmt, 'value');
      else generated = this.emit(stmt, 'statement');

      if (generated && !generated.endsWith(';')) {
        let h = Array.isArray(stmt) ? stmt[0] : null;
        if (!blockStmts.includes(h) || !generated.endsWith('}')) generated += ';';
      }
      let loc = Array.isArray(stmt) ? stmt.loc : null;
      return { code: generated, loc, sexpr: Array.isArray(stmt) ? stmt : null };
    });
    let statementsCode = stmtEntries.map(e => e.code).join('\n');

    let needsBlank = false;

    if (imports.length > 0) {
      code += imports.map(s => this.addSemicolon(s, this.emit(s, 'statement'))).join('\n');
      needsBlank = true;
    }

    if (this.programVars.size > 0) {
      let hasUnderscore = this.programVars.has('_');
      if (hasUnderscore) this.programVars.delete('_');
      if (this.programVars.size > 0) {
        let vars = Array.from(this.programVars).sort().join(', ');
        if (vars) {
          if (needsBlank) code += '\n';
          code += `let ${vars};\n`;
          needsBlank = true;
        }
      }
      if (hasUnderscore) {
        if (needsBlank) code += '\n';
        code += `var _;\n`;
        needsBlank = true;
      }
    }

    let skip = this.options.skipPreamble;
    let skipRT = this.options.skipRuntimes;

    if (!skip) {

      // Standard library — always available, override by redeclaring
      if (needsBlank) code += '\n';
      code += getStdlibCode();
      needsBlank = true;

      // On-demand helpers — only emitted when referenced
      // Use var when skipRuntimes is set so helpers can be safely re-emitted across concatenated files
      let helperDecl = skipRT ? 'var' : 'const';
      if (this.helpers.has('slice'      )) { code += `${helperDecl} slice = [].slice;\n`; needsBlank = true; }
      if (this.helpers.has('modulo'     )) { code += `${helperDecl} modulo = (n, d) => { n = +n; d = +d; return (n % d + d) % d; };\n`; needsBlank = true; }
      if (this.helpers.has('toMatchable')) {
        code += `${helperDecl} toMatchable = (v, allowNewlines) => {\n`;
        code += '  if (typeof v === "string") return !allowNewlines && /[\\n\\r]/.test(v) ? null : v;\n';
        code += '  if (v == null) return "";\n';
        code += '  if (typeof v === "number" || typeof v === "bigint" || typeof v === "boolean") return String(v);\n';
        code += '  if (typeof v === "symbol") return v.description || "";\n';
        code += '  if (v instanceof Uint8Array || v instanceof ArrayBuffer) {\n';
        code += '    return new TextDecoder().decode(v instanceof Uint8Array ? v : new Uint8Array(v));\n';
        code += '  }\n';
        code += '  if (Array.isArray(v)) return v.join(",");\n';
        code += '  if (typeof v.toString === "function" && v.toString !== Object.prototype.toString) {\n';
        code += '    try { return v.toString(); } catch { return ""; }\n';
        code += '  }\n';
        code += '  return "";\n';
        code += '};\n';
        needsBlank = true;
      }
    }

    if (this.usesReactivity && !skip) {
      if (skipRT) {
        code += 'var { __state, __computed, __effect, __batch, __readonly, __setErrorHandler, __handleError, __catchErrors } = globalThis.__rip;\n';
      } else if (typeof globalThis !== 'undefined' && globalThis.__rip) {
        code += 'const { __state, __computed, __effect, __batch, __readonly, __setErrorHandler, __handleError, __catchErrors } = globalThis.__rip;\n';
      } else {
        code += this.getReactiveRuntime();
      }
      needsBlank = true;
    }

    if (this.usesTemplates && !skip) {
      if (skipRT) {
        code += 'var { __pushComponent, __popComponent, setContext, getContext, hasContext, __clsx, __lis, __reconcile, __transition, __handleComponentError, __Component } = globalThis.__ripComponent;\n';
      } else if (typeof globalThis !== 'undefined' && globalThis.__ripComponent) {
        code += 'const { __pushComponent, __popComponent, setContext, getContext, hasContext, __clsx, __lis, __reconcile, __transition, __handleComponentError, __Component } = globalThis.__ripComponent;\n';
      } else {
        code += this.getComponentRuntime();
      }
      needsBlank = true;
    }

    if (this.usesSchemas && !skip) {
      if (skipRT) {
        code += 'var { __schema, SchemaError, __SchemaRegistry, __schemaSetAdapter } = globalThis.__ripSchema;\n';
      } else if (typeof globalThis !== 'undefined' && globalThis.__ripSchema) {
        code += 'const { __schema, SchemaError, __SchemaRegistry, __schemaSetAdapter } = globalThis.__ripSchema;\n';
      } else {
        code += this.getSchemaRuntime();
      }
      needsBlank = true;
    }

    if (this.dataSection !== null && this.dataSection !== undefined && !skip) {
      code += 'var DATA;\n_setDataSection();\n';
      needsBlank = true;
    }

    if (needsBlank && code.length > 0) code += '\n';
    this._stmtEntries = stmtEntries;
    this._preambleLines = code.length === 0 ? 0 : code.split('\n').length - 1;
    code += statementsCode;

    if (this.dataSection !== null && this.dataSection !== undefined) {
      code += `\n\nfunction _setDataSection() {\n  DATA = ${JSON.stringify(this.dataSection)};\n}`;
    }

    return code;
  }

  // ---------------------------------------------------------------------------
  // Binary operators
  // ---------------------------------------------------------------------------

  emitBinaryOp(op, rest, context, sexpr) {
    if ((op === '+' || op === '-') && rest.length === 1) {
      return `(${op}${this.emit(rest[0], 'value')})`;
    }
    let [left, right] = rest;
    // String repeat: "str" * n → "str".repeat(n)
    if (op === '*') {
      let leftStr = left?.valueOf?.() ?? left;
      if (typeof leftStr === 'string' && /^["']/.test(leftStr)) {
        return `${this.emit(left, 'value')}.repeat(${this.emit(right, 'value')})`;
      }
    }
    // Chained comparisons: (< (< a b) c) → ((a < b) && (b < c))
    let COMPARE_OPS = new Set(['<', '>', '<=', '>=']);
    if (COMPARE_OPS.has(op) && Array.isArray(left)) {
      let leftOp = left[0]?.valueOf?.() ?? left[0];
      if (COMPARE_OPS.has(leftOp)) {
        let a = this.emit(left[1], 'value');
        let b = this.emit(left[2], 'value');
        let c = this.emit(right, 'value');
        return `((${a} ${leftOp} ${b}) && (${b} ${op} ${c}))`;
      }
    }
    if (op === '==') op = '===';
    if (op === '!=') op = '!==';
    return `(${this.emit(left, 'value')} ${op} ${this.emit(right, 'value')})`;
  }

  emitModulo(head, rest) {
    let [left, right] = rest;
    this.helpers.add('modulo');
    return `modulo(${this.emit(left, 'value')}, ${this.emit(right, 'value')})`;
  }

  emitModuloAssign(head, rest) {
    let [target, value] = rest;
    this.helpers.add('modulo');
    let t = this.emit(target, 'value'), v = this.emit(value, 'value');
    return `${t} = modulo(${t}, ${v})`;
  }

  emitFloorDiv(head, rest) {
    let [left, right] = rest;
    return `Math.floor(${this.emit(left, 'value')} / ${this.emit(right, 'value')})`;
  }

  emitFloorDivAssign(head, rest) {
    let [target, value] = rest;
    let t = this.emit(target, 'value'), v = this.emit(value, 'value');
    return `${t} = Math.floor(${t} / ${v})`;
  }

  // ---------------------------------------------------------------------------
  // Assignment
  // ---------------------------------------------------------------------------

  emitAssignment(head, rest, context, sexpr) {
    let [target, value] = rest;
    let op = head === '?=' ? '??=' : head;

    // Reject destructuring shapes that aren't valid binding patterns. The
    // grammar accepts the full Array / Object expression on the LHS of `=`,
    // so things like `[a + b] = src` and `{x: y for x in arr} = src` parse
    // and used to either silently produce broken JS or crash the compiler
    // with an obscure error. This walk catches them with a clear message.
    if (this.is(target, 'array') || this.is(target, 'object')) {
      this._validateBindingPattern(target, sexpr);
    }

    // Optional chain assignment: x?.prop = val → if (x != null) x.prop = val
    let optInfo = this._findOptionalInTarget(target);
    if (optInfo) {
      let guardCode = this.emit(optInfo.guard, 'value');
      let targetCode = this.emit(optInfo.rewritten, 'value');
      let valueCode = this.emit(value, 'value');
      if (context === 'value') {
        return `(${guardCode} != null ? (${targetCode} ${op} ${valueCode}) : undefined)`;
      }
      return `if (${guardCode} != null) ${targetCode} ${op} ${valueCode}`;
    }

    // Validate: no sigils in assignment targets (except void function syntax)
    let isFnValue = (this.is(value, '->') || this.is(value, '=>') || this.is(value, 'def'));
    if (target instanceof String && meta(target, 'await') !== undefined && !isFnValue) {
      let sigil = meta(target, 'await') === true ? '!' : '&';
      this.error(`Cannot use ${sigil} sigil in variable declaration '${str(target)}'`, sexpr);
    }

    if (target instanceof String && meta(target, 'await') === true && isFnValue) {
      this.nextFunctionIsVoid = true;
    }

    // Empty destructuring — just evaluate RHS
    let isEmptyArr = this.is(target, 'array', 0);
    let isEmptyObj = this.is(target, 'object', 0);
    if (isEmptyArr || isEmptyObj) {
      let v = this.emit(value, 'value');
      return (isEmptyObj && context === 'statement') ? `(${v})` : v;
    }

    // Control flow short-circuits: x = expr or return/throw
    if (Array.isArray(value) && op === '=' && value[0] === 'control') {
      let [, rawCtrlOp, expr, ctrlSexpr] = value;
      let ctrlOp = str(rawCtrlOp);
      let isReturn = ctrlSexpr[0] === 'return';
      let targetCode = this.emit(target, 'value');
      let exprCode = this.emit(expr, 'value');
      let ctrlValue = ctrlSexpr.length > 1 ? ctrlSexpr[1] : null;
      let ctrlCode = isReturn
        ? (ctrlValue ? `return ${this.emit(ctrlValue, 'value')}` : 'return')
        : (ctrlValue ? `throw ${this.emit(ctrlValue, 'value')}` : 'throw new Error()');
      if (context === 'value') {
        if (ctrlOp === '??') return `(() => { const __v = ${exprCode}; if (__v == null) ${ctrlCode}; return (${targetCode} = __v); })()`;
        if (ctrlOp === '||') return `(() => { const __v = ${exprCode}; if (!__v) ${ctrlCode}; return (${targetCode} = __v); })()`;
        return `(() => { const __v = ${exprCode}; if (__v) ${ctrlCode}; return (${targetCode} = __v); })()`;
      }
      if (ctrlOp === '??') return `if ((${targetCode} = ${exprCode}) == null) ${ctrlCode}`;
      if (ctrlOp === '||') return `if (!(${targetCode} = ${exprCode})) ${ctrlCode}`;
      return `if ((${targetCode} = ${exprCode})) ${ctrlCode}`;
    }

    // Middle/leading rest in array destructuring
    if (this.is(target, 'array')) {
      let restIdx = target.slice(1).findIndex(el => (this.is(el, '...')) || el === '...');
      if (restIdx !== -1 && restIdx < target.length - 2) {
        let elements = target.slice(1);
        let afterRest = elements.slice(restIdx + 1);
        let afterCount = afterRest.length;
        if (afterCount > 0) {
          let valueCode = this.emit(value, 'value');
          let beforeRest = elements.slice(0, restIdx);
          let beforePattern = beforeRest.map(el => el === ',' ? '' : typeof el === 'string' ? el : this.emit(el, 'value')).join(', ');
          let afterPattern = afterRest.map(el => el === ',' ? '' : typeof el === 'string' ? el : this.emit(el, 'value')).join(', ');
          this.helpers.add('slice');
          elements.forEach(el => {
            if (el === ',' || el === '...') return;
            if (typeof el === 'string') this.programVars.add(el);
            else if (this.is(el, '...') && typeof el[1] === 'string') this.programVars.add(el[1]);
          });
          let restEl = elements[restIdx];
          let restVar = this.is(restEl, '...') ? restEl[1] : null;
          let stmts = [];
          if (beforePattern) stmts.push(`[${beforePattern}] = ${valueCode}`);
          if (restVar) stmts.push(`[...${restVar}] = ${valueCode}.slice(${restIdx}, -${afterCount})`);
          stmts.push(`[${afterPattern}] = slice.call(${valueCode}, -${afterCount})`);
          return stmts.join(', ');
        }
      }
    }

    // Postfix if on assignment with || operator
    if (context === 'statement' && head === '=' && Array.isArray(value) &&
        (value[0] === '||' || value[0] === '&&') && value.length === 3) {
      let [binOp, left, right] = value;
      if (this.is(right, 'if') && right.length === 3) {
        let [, condition, wrappedValue] = right;
        let unwrapped = Array.isArray(wrappedValue) && wrappedValue.length === 1 ? wrappedValue[0] : wrappedValue;
        let fullValue = [binOp, left, unwrapped];
        let t = this.emit(target, 'value'), c = this.emit(condition, 'value'), v = this.emit(fullValue, 'value');
        return `if (${c}) ${t} = ${v}`;
      }
    }

    // Postfix if on simple assignment
    if (context === 'statement' && head === '=' && Array.isArray(value) && value.length === 3) {
      let [valHead, condition, actualValue] = value;
      let isPostfix = Array.isArray(actualValue) && actualValue.length === 1 &&
                      (!Array.isArray(actualValue[0]) || actualValue[0][0] !== 'block');
      if (valHead === 'if' && isPostfix) {
        let unwrapped = Array.isArray(actualValue) && actualValue.length === 1 ? actualValue[0] : actualValue;
        let t = this.emit(target, 'value');
        let condCode = this.unwrapLogical(this.emit(condition, 'value'));
        let v = this.emit(unwrapped, 'value');
        return `if (${condCode}) ${t} = ${v}`;
      }
    }

    // Generate target (handle reactive, sigils)
    let targetCode;
    if (target instanceof String && meta(target, 'await') !== undefined) {
      targetCode = str(target);
    } else if (typeof target === 'string' && this.reactiveVars?.has(target)) {
      targetCode = `${target}.value`;
    } else {
      targetCode = this.emit(target, 'value');
    }

    const prevComponentName = this._componentName;
    const prevComponentTypeParams = this._componentTypeParams;
    const prevSchemaName = this._schemaName;
    if (this.is(value, 'component') && (typeof target === 'string' || target instanceof String)) {
      this._componentName = str(target);
      this._componentTypeParams = target.typeParams || '';
    }
    if (this.is(value, 'schema') && (typeof target === 'string' || target instanceof String)) {
      this._schemaName = str(target);
    }
    let valueCode = this.emit(value, 'value');
    this._componentName = prevComponentName;
    this._componentTypeParams = prevComponentTypeParams;
    this._schemaName = prevSchemaName;
    let isObjLit = this.is(value, 'object') || this.is(value, '.{}') || this.is(value, '?.{}');
    if (!isObjLit) valueCode = this.unwrap(valueCode);

    let needsParensVal = context === 'value';
    let needsParensObj = context === 'statement' && this.is(target, 'object');
    if (needsParensVal || needsParensObj) return `(${targetCode} ${op} ${valueCode})`;
    return `${targetCode} ${op} ${valueCode}`;
  }

  // ---------------------------------------------------------------------------
  // Property access
  // ---------------------------------------------------------------------------

  emitPropertyAccess(head, rest, context, sexpr) {
    let [obj, prop] = rest;
    // In subclass constructors, rewrite @param refs (this.x) to _x for super() safety
    if (this._atParamMap && obj === 'this') {
      let mapped = this._atParamMap.get(str(prop));
      if (mapped) return mapped;
    }
    let objCode = this.emit(obj, 'value');
    let needsParens = CodeEmitter.NUMBER_LITERAL_RE.test(objCode) ||
                      objCode.startsWith('await ') ||
                      ((this.is(obj, 'object') || this.is(obj, 'yield')));
    let base = needsParens ? `(${objCode})` : objCode;
    if (meta(prop, 'await') === true) return `await ${base}.${str(prop)}()`;
    if (meta(prop, 'optional')) return `(${base}.${str(prop)} != null)`;
    return `${base}.${str(prop)}`;
  }

  emitOptionalProperty(head, rest) {
    let [obj, prop] = rest;
    return `${this.emit(obj, 'value')}?.${prop}`;
  }

  // Pick operator: obj.{a, b: c, d = default}
  //
  // Semantics:
  //   - missing key → `undefined` (source.key just reads as undefined)
  //   - default fires on nullish (`??`), deliberately broader than JS
  //     destructure's undefined-only defaults, to match DB NULL reality.
  //   - rename `a: b` emits `b: source.a` (inverse of destructure pattern)
  //
  // Codegen strategy:
  //   - Simple source (bare identifier, `this`) → inline, no function alloc
  //   - Complex source (call, member, indexed, etc.) → arrow IIFE binds
  //     a single-letter temp to ensure single evaluation and avoid
  //     repeating getter reads.
  //
  // AST: [".{}", source, [srcKey, dstKey, defaultOrNull], ...]
  emitPick(head, rest, context, sexpr) {
    let [source, ...items] = rest;
    let sourceCode = this.emit(source, 'value');
    let simple = this._isSimplePickSource(source);
    let ref = simple ? sourceCode : '_';

    let body = items.map(([srcKey, dstKey, def]) => {
      let access = `${ref}.${str(srcKey)}`;
      if (def !== null && def !== undefined) {
        access = `(${access} ?? ${this.emit(def, 'value')})`;
      }
      return `${str(dstKey)}: ${access}`;
    }).join(', ');

    // Always parenthesize the object literal so at statement position it
    // parses as an expression, not a block. `x = ({a:...})` is harmless;
    // bare `{a:...}` at statement-top would parse as a block in JS.
    if (simple) return `({${body}})`;
    return `((_) => ({${body}}))(${sourceCode})`;
  }

  // Optional-chain pick: obj?.{a, b}
  //   - If source is null/undefined, result is `undefined` (not `{}`)
  //   - Otherwise identical to pick semantics above
  emitOptPick(head, rest, context, sexpr) {
    let [source, ...items] = rest;
    let sourceCode = this.emit(source, 'value');
    let simple = this._isSimplePickSource(source);
    let ref = simple ? sourceCode : '_';

    let body = items.map(([srcKey, dstKey, def]) => {
      let access = `${ref}.${str(srcKey)}`;
      if (def !== null && def !== undefined) {
        access = `(${access} ?? ${this.emit(def, 'value')})`;
      }
      return `${str(dstKey)}: ${access}`;
    }).join(', ');

    if (simple) return `(${sourceCode} == null ? undefined : {${body}})`;
    return `((_) => _ == null ? undefined : ({${body}}))(${sourceCode})`;
  }

  // A pick source is "simple" only when it's safe to reference multiple
  // times with no observable difference from a single-evaluation form.
  // Restricted to AST shapes that are atomically identifier-like:
  //   - bare identifier  (AST is a plain string like "whom")
  //   - `this`           (AST is the literal string "this")
  //   - `@`              (AST is the literal string "@")
  // Member access like `this.x` or `obj.y` is NOT simple: getters and
  // reactive tracking can observe each read, so we force an IIFE to
  // evaluate the source exactly once.
  _isSimplePickSource(node) {
    if (typeof node !== 'string') return false;
    // Identifier-shape or `@`/`this` only. Rejects string-typed AST nodes
    // that happen to carry non-identifier content (defensive; current AST
    // doesn't produce such strings but future shape changes are bounded).
    return node === 'this' || node === '@' ||
      /^[A-Za-z_$][\w$]*$/.test(node);
  }

  emitRegexIndex(head, rest) {
    let [value, regex, captureIndex] = rest;
    this.helpers.add('toMatchable');
    this.programVars.add('_');
    let v = this.emit(value, 'value'), r = this.emit(regex, 'value');
    let idx = captureIndex !== null ? this.emit(captureIndex, 'value') : '0';
    let allowNL = r.includes('/m') ? ', true' : '';
    return `(_ = toMatchable(${v}${allowNL}).match(${r})) && _[${idx}]`;
  }

  emitIndexAccess(head, rest) {
    let [arr, index] = rest;
    if ((this.is(index, '..') || this.is(index, '...'))) {
      let isIncl = index[0] === '..';
      let arrCode = this.emit(arr, 'value');
      let [start, end] = index.slice(1);

      // Detect compile-time numeric literals (positive, negative, String objects)
      let numericLiteral = (node) => {
        if (node === null) return null;
        let v = str(node) ?? node;
        if (typeof v === 'number') return v;
        if ((typeof v === 'string') && /^\d+$/.test(v)) return +v;
        if (Array.isArray(node) && node[0] === '-' && node.length === 2) {
          let inner = str(node[1]) ?? node[1];
          if (typeof inner === 'number') return -inner;
          if ((typeof inner === 'string') && /^\d+$/.test(inner)) return -inner;
        }
        return null;
      };

      let inclEnd = (s, e, endNode) => {
        let n = numericLiteral(endNode);
        if (n !== null && n !== -1) return `${arrCode}.slice(${s}, ${n + 1})`;
        return `${arrCode}.slice(${s}, +${e} + 1 || 9e9)`;
      };

      if (start === null && end === null) return `${arrCode}.slice()`;
      if (start === null) {
        if (isIncl && this.is(end, '-', 1) && (str(end[1]) ?? end[1]) == 1) return `${arrCode}.slice(0)`;
        let e = this.emit(end, 'value');
        return isIncl ? inclEnd('0', e, end) : `${arrCode}.slice(0, ${e})`;
      }
      if (end === null) return `${arrCode}.slice(${this.emit(start, 'value')})`;
      let s = this.emit(start, 'value');
      if (isIncl && this.is(end, '-', 1) && (str(end[1]) ?? end[1]) == 1) return `${arrCode}.slice(${s})`;
      let e = this.emit(end, 'value');
      return isIncl ? inclEnd(s, e, end) : `${arrCode}.slice(${s}, ${e})`;
    }
    // Negative literal index: arr[-1] → arr.at(-1)
    if (this.is(index, '-', 1)) {
      let n = str(index[1]) ?? index[1];
      if (typeof n === 'number' || (typeof n === 'string' && /^\d+$/.test(n))) {
        return `${this.emit(arr, 'value')}.at(-${n})`;
      }
    }
    return `${this.emit(arr, 'value')}[${this.unwrap(this.emit(index, 'value'))}]`;
  }

  emitOptIndex(head, rest) {
    let [arr, index] = rest;
    // Negative literal index: arr?[-1] → arr?.at(-1)
    if (this.is(index, '-', 1)) {
      let n = str(index[1]) ?? index[1];
      if (typeof n === 'number' || (typeof n === 'string' && /^\d+$/.test(n))) {
        return `${this.emit(arr, 'value')}?.at(-${n})`;
      }
    }
    return `${this.emit(arr, 'value')}?.[${this.emit(index, 'value')}]`;
  }

  emitOptCall(head, rest) {
    let [fn, ...args] = rest;
    return `${this.emit(fn, 'value')}?.(${args.map(a => this.emit(a, 'value')).join(', ')})`;
  }

  // ---------------------------------------------------------------------------
  // Functions
  // ---------------------------------------------------------------------------

  emitDef(head, rest, context, sexpr) {
    let [name, params, body] = rest;
    let sideEffectOnly = meta(name, 'await') === true;
    let cleanName = str(name);
    let paramList = this.emitParamList(params);
    let bodyCode = this.emitFunctionBody(body, params, sideEffectOnly);
    let isAsync = this.containsAwait(body);
    let isGen = this.containsYield(body);
    return `${isAsync ? 'async ' : ''}function${isGen ? '*' : ''} ${cleanName}(${paramList}) ${bodyCode}`;
  }

  emitThinArrow(head, rest, context, sexpr) {
    let [params, body] = rest;
    if ((!params || (Array.isArray(params) && params.length === 0)) && this.containsIt(body)) params = ['it'];
    let sideEffectOnly = this.nextFunctionIsVoid || false;
    this.nextFunctionIsVoid = false;
    let paramList = this.emitParamList(params);
    let bodyCode = this.emitFunctionBody(body, params, sideEffectOnly);
    let isAsync = this.containsAwait(body);
    let isGen = this.containsYield(body);
    let fn = `${isAsync ? 'async ' : ''}function${isGen ? '*' : ''}(${paramList}) ${bodyCode}`;
    return context === 'value' ? `(${fn})` : fn;
  }

  emitFatArrow(head, rest, context, sexpr) {
    let [params, body] = rest;
    if ((!params || (Array.isArray(params) && params.length === 0)) && this.containsIt(body)) params = ['it'];
    let sideEffectOnly = this.nextFunctionIsVoid || false;
    this.nextFunctionIsVoid = false;
    let paramList = this.emitParamList(params);
    let isSingle = params.length === 1 && typeof params[0] === 'string' &&
                   !paramList.includes('=') && !paramList.includes('...') &&
                   !paramList.includes('[') && !paramList.includes('{');
    let paramSyntax = isSingle ? paramList : `(${paramList})`;
    let isAsync = this.containsAwait(body);
    let prefix = isAsync ? 'async ' : '';

    if (!sideEffectOnly) {
      if (this.is(body, 'block') && body.length === 2) {
        let expr = body[1];
        let exprHead = Array.isArray(expr) ? expr[0] : null;
        if (exprHead !== 'return' && !STMT_ONLY.has(exprHead)) {
          let code = this.emit(expr, 'value');
          if (code[0] === '{') code = `(${code})`;
          return `${prefix}${paramSyntax} => ${code}`;
        }
      }
      if (!Array.isArray(body) || body[0] !== 'block') {
        let code = this.emit(body, 'value');
        if (code[0] === '{') code = `(${code})`;
        return `${prefix}${paramSyntax} => ${code}`;
      }
    }

    let bodyCode = this.emitFunctionBody(body, params, sideEffectOnly);
    return `${prefix}${paramSyntax} => ${bodyCode}`;
  }

  emitReturn(head, rest, context, sexpr) {
    if (rest.length === 0) return 'return';
    let [expr] = rest;
    if (this.sideEffectOnly && !(this.is(expr, '->') || this.is(expr, '=>'))) {
      this.error('Cannot return a value from a void function (declared with !)', sexpr);
    }

    if (this.is(expr, 'if')) {
      let [, condition, body, ...elseParts] = expr;
      if (elseParts.length === 0) {
        let val = Array.isArray(body) && body.length === 1 ? body[0] : body;
        return `if (${this.emit(condition, 'value')}) return ${this.emit(val, 'value')}`;
      }
    }
    if (this.is(expr, 'new') && Array.isArray(expr[1]) && expr[1][0] === 'if') {
      let [, condition, body] = expr[1];
      let val = Array.isArray(body) && body.length === 1 ? body[0] : body;
      return `if (${this.emit(condition, 'value')}) return ${this.emit(['new', val], 'value')}`;
    }
    return `return ${this.emit(expr, 'value')}`;
  }

  // ---------------------------------------------------------------------------
  // Reactive
  // ---------------------------------------------------------------------------

  emitState(head, rest) {
    let [name, expr] = rest;
    this.usesReactivity = true;
    let varName = str(name) ?? name;
    if (!this.reactiveVars) this.reactiveVars = new Set();
    this.reactiveVars.add(varName);
    return `const ${varName} = __state(${this.emit(expr, 'value')})`;
  }

  emitComputed(head, rest) {
    let [name, expr] = rest;
    this.usesReactivity = true;
    if (!this.reactiveVars) this.reactiveVars = new Set();
    let varName = str(name) ?? name;
    this.reactiveVars.add(varName);
    if (this.is(expr, 'block') && expr.length > 2) {
      return `const ${varName} = __computed(() => ${this.emitFunctionBody(expr)})`;
    }
    return `const ${varName} = __computed(() => ${this.emit(expr, 'value')})`;
  }

  emitReadonly(head, rest) {
    let [name, expr] = rest;
    return `const ${str(name) ?? name} = ${this.emit(expr, 'value')}`;
  }

  emitEffect(head, rest) {
    let [target, body] = rest;
    this.usesReactivity = true;
    let bodyCode;
    if (this.is(body, 'block')) {
      bodyCode = this.emitFunctionBody(body);
    } else if ((this.is(body, '->') || this.is(body, '=>'))) {
      let fnCode = this.emit(body, 'value');
      if (target) return `const ${str(target) ?? this.emit(target, 'value')} = __effect(${fnCode})`;
      return `__effect(${fnCode})`;
    } else {
      bodyCode = `{ ${this.emit(body, 'value')}; }`;
    }
    let effectCode = `__effect(() => ${bodyCode})`;
    if (target) return `const ${str(target) ?? this.emit(target, 'value')} = ${effectCode}`;
    return effectCode;
  }

  // ---------------------------------------------------------------------------
  // Control flow — simple
  // ---------------------------------------------------------------------------

  emitBreak()    { return 'break'; }
  emitContinue() { return 'continue'; }

  emitExistential(head, rest) {
    return `(${this.emit(rest[0], 'value')} != null)`;
  }

  emitPresence(head, rest) {
    return `(${this.emit(rest[0], 'value')} ? true : undefined)`;
  }

  emitTernary(head, rest, context) {
    let [cond, then_, else_] = rest;

    // Hoist assignment: (cond ? (x = a) : b) → x = (cond ? a : b)
    // Enables the Python-style postfix-ternary idiom:
    //   x = "admin" if cond else "member"  →  x = (cond ? "admin" : "member")
    // Skip when the assignment is parenthesized — the parser tags those via
    // `.parenthesized = true` so we can preserve "only assign when cond"
    // semantics for the explicit form `(x = "a") if cond else "b"`.
    let thenHead = then_?.[0]?.valueOf?.() ?? then_?.[0];
    if (thenHead === '=' && Array.isArray(then_) && !then_.parenthesized) {
      let target = this.emit(then_[1], 'value');
      let thenVal = this.emit(then_[2], 'value');
      let elseVal = this.emit(else_, 'value');
      return `${target} = (${this.unwrap(this.emit(cond, 'value'))} ? ${thenVal} : ${elseVal})`;
    }

    return `(${this.unwrap(this.emit(cond, 'value'))} ? ${this.emit(then_, 'value')} : ${this.emit(else_, 'value')})`;
  }

  emitPipe(head, rest) {
    let [left, right] = rest;
    let leftCode = this.emit(left, 'value');
    // Detect function calls: [fn, ...args] where fn is an identifier or accessor
    if (Array.isArray(right) && right.length > 1) {
      let fn = right[0];
      let isCall = Array.isArray(fn) || (typeof fn === 'string' && /^[a-zA-Z_$]/.test(fn));
      if (isCall) {
        let fnCode = this.emit(fn, 'value');
        let args = right.slice(1).map(a => this.emit(a, 'value'));
        return `${fnCode}(${leftCode}, ${args.join(', ')})`;
      }
    }
    // Simple reference or property access — call with left as sole arg
    return `${this.emit(right, 'value')}(${leftCode})`;
  }

  emitLoop(head, rest) {
    return `while (true) ${this.emitLoopBody(rest[0])}`;
  }

  emitLoopN(head, rest) {
    let [count, body] = rest;
    let n = this.emit(count, 'value');
    return `for (let it = 0; it < ${n}; it++) ${this.emitLoopBody(body)}`;
  }

  emitAwait(head, rest) { return `await ${this.emit(rest[0], 'value')}`; }

  emitYield(head, rest) {
    return rest.length === 0 ? 'yield' : `yield ${this.emit(rest[0], 'value')}`;
  }

  emitYieldFrom(head, rest) { return `yield* ${this.emit(rest[0], 'value')}`; }

  // ---------------------------------------------------------------------------
  // Conditionals
  // ---------------------------------------------------------------------------

  emitIf(head, rest, context, sexpr) {
    let [condition, thenBranch, ...elseBranches] = rest;
    return context === 'value'
      ? this.emitIfAsExpression(condition, thenBranch, elseBranches)
      : this.emitIfAsStatement(condition, thenBranch, elseBranches);
  }

  // ---------------------------------------------------------------------------
  // Loops
  // ---------------------------------------------------------------------------

  emitForIn(head, rest, context, sexpr) {
    let [vars, iterable, step, guard, body] = rest;

    if (context === 'value' && this.comprehensionDepth === 0) {
      let iterator = ['for-in', vars, iterable, step];
      return this.emit(['comprehension', body, [iterator], guard ? [guard] : []], context);
    }

    let varsArray = Array.isArray(vars) ? vars : [vars];
    let noVar = varsArray.length === 0;
    let [itemVar, indexVar] = noVar ? ['_i', null] : varsArray;
    let itemVarPattern = ((this.is(itemVar, 'array') || this.is(itemVar, 'object')))
      ? this.emitDestructuringPattern(itemVar) : itemVar;

    // Stepped iteration
    if (step && step !== null) {
      let iterCode = this.emit(iterable, 'value');
      let idxName = indexVar || '_i';
      let stepCode = this.emit(step, 'value');
      let isNeg = this.is(step, '-', 1);
      let isMinus1 = isNeg && (step[1] === '1' || step[1] === 1 || str(step[1]) === '1');
      let isPlus1 = !isNeg && (step === '1' || step === 1 || str(step) === '1');

      let loopHeader;
      if (isMinus1) loopHeader = `for (let ${idxName} = ${iterCode}.length - 1; ${idxName} >= 0; ${idxName}--) `;
      else if (isPlus1) loopHeader = `for (let ${idxName} = 0; ${idxName} < ${iterCode}.length; ${idxName}++) `;
      else if (isNeg) loopHeader = `for (let ${idxName} = ${iterCode}.length - 1; ${idxName} >= 0; ${idxName} += ${stepCode}) `;
      else loopHeader = `for (let ${idxName} = 0; ${idxName} < ${iterCode}.length; ${idxName} += ${stepCode}) `;

      if (this.is(body, 'block')) {
        let stmts = body.slice(1);
        this.indentLevel++;
        let lines = [];
        if (!noVar) lines.push(`let ${itemVarPattern} = ${iterCode}[${idxName}];`);
        if (guard) {
          lines.push(`if (${this.emit(guard, 'value')}) {`);
          this.indentLevel++;
          lines.push(...this.formatStatements(stmts));
          this.indentLevel--;
          lines.push(this.indent() + '}');
        } else {
          lines.push(...stmts.map(s => this.addSemicolon(s, this.emit(s, 'statement'))));
        }
        this.indentLevel--;
        return loopHeader + `{\n${lines.map(s => this.indent() + s).join('\n')}\n${this.indent()}}`;
      }

      if (noVar) {
        return guard
          ? loopHeader + `{ if (${this.emit(guard, 'value')}) ${this.emit(body, 'statement')}; }`
          : loopHeader + `{ ${this.emit(body, 'statement')}; }`;
      }
      return guard
        ? loopHeader + `{ let ${itemVarPattern} = ${iterCode}[${idxName}]; if (${this.emit(guard, 'value')}) ${this.emit(body, 'statement')}; }`
        : loopHeader + `{ let ${itemVarPattern} = ${iterCode}[${idxName}]; ${this.emit(body, 'statement')}; }`;
    }

    // Index variable → traditional for loop
    if (indexVar) {
      let iterCode = this.emit(iterable, 'value');
      let code = `for (let ${indexVar} = 0; ${indexVar} < ${iterCode}.length; ${indexVar}++) `;
      if (this.is(body, 'block')) {
        code += '{\n';
        this.indentLevel++;
        code += this.indent() + `let ${itemVarPattern} = ${iterCode}[${indexVar}];\n`;
        if (guard) {
          code += this.indent() + `if (${this.unwrap(this.emit(guard, 'value'))}) {\n`;
          this.indentLevel++;
          code += this.formatStatements(body.slice(1)).join('\n') + '\n';
          this.indentLevel--;
          code += this.indent() + '}\n';
        } else {
          code += this.formatStatements(body.slice(1)).join('\n') + '\n';
        }
        this.indentLevel--;
        code += this.indent() + '}';
      } else {
        code += guard
          ? `{ let ${itemVarPattern} = ${iterCode}[${indexVar}]; if (${this.unwrap(this.emit(guard, 'value'))}) ${this.emit(body, 'statement')}; }`
          : `{ let ${itemVarPattern} = ${iterCode}[${indexVar}]; ${this.emit(body, 'statement')}; }`;
      }
      return code;
    }

    // Range optimization
    let iterHead = Array.isArray(iterable) && iterable[0];
    if (iterHead instanceof String) iterHead = str(iterHead);
    if (iterHead === '..' || iterHead === '...') {
      let isExcl = iterHead === '...';
      let [start, end] = iterable.slice(1);
      let isSimple = (e) => typeof e === 'number' || typeof e === 'string' && !e.includes('(') ||
                            (e instanceof String && !str(e).includes('(')) || (this.is(e, '.'));
      if (isSimple(start) && isSimple(end)) {
        let s = this.emit(start, 'value'), e = this.emit(end, 'value');
        let cmp = isExcl ? '<' : '<=';
        let inc = step ? `${itemVarPattern} += ${this.emit(step, 'value')}` : `${itemVarPattern}++`;
        let code = `for (let ${itemVarPattern} = ${s}; ${itemVarPattern} ${cmp} ${e}; ${inc}) `;
        code += guard ? this.emitLoopBodyWithGuard(body, guard) : this.emitLoopBody(body);
        return code;
      }
    }

    // Default: for-of
    let code = `for (let ${itemVarPattern} of ${this.emit(iterable, 'value')}) `;
    code += guard ? this.emitLoopBodyWithGuard(body, guard) : this.emitLoopBody(body);
    return code;
  }

  emitForOf(head, rest, context, sexpr) {
    let [vars, obj, own, guard, body] = rest;

    if (context === 'value' && this.comprehensionDepth === 0) {
      let iterator = ['for-of', vars, obj, own];
      return this.emit(['comprehension', body, [iterator], guard ? [guard] : []], context);
    }

    let [keyVar, valueVar] = Array.isArray(vars) ? vars : [vars];
    let objCode = this.emit(obj, 'value');
    let code = `for (let ${keyVar} in ${objCode}) `;

    if (own && !valueVar && !guard) {
      if (this.is(body, 'block')) {
        this.indentLevel++;
        let stmts = [`if (!Object.hasOwn(${objCode}, ${keyVar})) continue;`, ...body.slice(1).map(s => this.addSemicolon(s, this.emit(s, 'statement')))];
        this.indentLevel--;
        return code + `{\n${stmts.map(s => this.indent() + s).join('\n')}\n${this.indent()}}`;
      }
      return code + `{ if (!Object.hasOwn(${objCode}, ${keyVar})) continue; ${this.emit(body, 'statement')}; }`;
    }

    if (valueVar) {
      if (this.is(body, 'block')) {
        let stmts = body.slice(1);
        this.indentLevel++;
        let lines = [];
        if (own) lines.push(`if (!Object.hasOwn(${objCode}, ${keyVar})) continue;`);
        lines.push(`let ${valueVar} = ${objCode}[${keyVar}];`);
        if (guard) {
          lines.push(`if (${this.emit(guard, 'value')}) {`);
          this.indentLevel++;
          lines.push(...stmts.map(s => this.addSemicolon(s, this.emit(s, 'statement'))));
          this.indentLevel--;
          lines.push(this.indent() + '}');
        } else {
          lines.push(...stmts.map(s => this.addSemicolon(s, this.emit(s, 'statement'))));
        }
        this.indentLevel--;
        return code + `{\n${lines.map(s => this.indent() + s).join('\n')}\n${this.indent()}}`;
      }
      let inline = '';
      if (own) inline += `if (!Object.hasOwn(${objCode}, ${keyVar})) continue; `;
      inline += `let ${valueVar} = ${objCode}[${keyVar}]; `;
      if (guard) inline += `if (${this.emit(guard, 'value')}) `;
      inline += `${this.emit(body, 'statement')};`;
      return code + `{ ${inline} }`;
    }

    code += guard ? this.emitLoopBodyWithGuard(body, guard) : this.emitLoopBody(body);
    return code;
  }

  emitForAs(head, rest, context, sexpr) {
    let varsArray = Array.isArray(rest[0]) ? rest[0] : [rest[0]];
    let [firstVar] = varsArray;
    let iterable = rest[1], isAwait = rest[2], guard = rest[3], body = rest[4];

    let needsTempVar = false, destructStmts = [];
    if (this.is(firstVar, 'array')) {
      let elements = firstVar.slice(1);
      let restIdx = elements.findIndex(el => (this.is(el, '...')) || el === '...');
      if (restIdx !== -1 && restIdx < elements.length - 1) {
        needsTempVar = true;
        let afterRest = elements.slice(restIdx + 1), afterCount = afterRest.length;
        let beforeRest = elements.slice(0, restIdx);
        let restEl = elements[restIdx];
        let restVar = this.is(restEl, '...') ? restEl[1] : '_rest';
        let beforePattern = beforeRest.map(el => el === ',' ? '' : typeof el === 'string' ? el : this.emit(el, 'value')).join(', ');
        let firstPattern = beforePattern ? `${beforePattern}, ...${restVar}` : `...${restVar}`;
        let afterPattern = afterRest.map(el => el === ',' ? '' : typeof el === 'string' ? el : this.emit(el, 'value')).join(', ');
        destructStmts.push(`[${firstPattern}] = _item`);
        destructStmts.push(`[${afterPattern}] = ${restVar}.splice(-${afterCount})`);
        this.helpers.add('slice');
        elements.forEach(el => {
          if (el === ',' || el === '...') return;
          if (typeof el === 'string') this.programVars.add(el);
          else if (this.is(el, '...') && typeof el[1] === 'string') this.programVars.add(el[1]);
        });
      }
    }

    let iterCode = this.emit(iterable, 'value');
    let awaitKw = isAwait ? 'await ' : '';
    let itemVarPattern;
    if (needsTempVar) itemVarPattern = '_item';
    else if ((this.is(firstVar, 'array') || this.is(firstVar, 'object')))
      itemVarPattern = this.emitDestructuringPattern(firstVar);
    else itemVarPattern = firstVar;

    let code = `for ${awaitKw}(let ${itemVarPattern} of ${iterCode}) `;

    if (needsTempVar && destructStmts.length > 0) {
      let stmts = this.unwrapBlock(body);
      let allStmts = this.withIndent(() => [
        ...destructStmts.map(s => this.indent() + s + ';'),
        ...this.formatStatements(stmts)
      ]);
      code += `{\n${allStmts.join('\n')}\n${this.indent()}}`;
    } else {
      code += guard ? this.emitLoopBodyWithGuard(body, guard) : this.emitLoopBody(body);
    }
    return code;
  }

  emitWhile(head, rest) {
    let cond = rest[0], guard = rest.length === 3 ? rest[1] : null, body = rest[rest.length - 1];
    let code = `while (${this.unwrap(this.emit(cond, 'value'))}) `;
    return code + (guard ? this.emitLoopBodyWithGuard(body, guard) : this.emitLoopBody(body));
  }

  emitRange(head, rest) {
    if (head === '...') {
      if (rest.length === 1) return `...${this.emit(rest[0], 'value')}`;
      let [s, e] = rest;
      let sc = this.emit(s, 'value'), ec = this.emit(e, 'value');
      return `((s, e) => Array.from({length: Math.max(0, Math.abs(e - s))}, (_, i) => s + (i * (s <= e ? 1 : -1))))(${sc}, ${ec})`;
    }
    let [s, e] = rest;
    let sc = this.emit(s, 'value'), ec = this.emit(e, 'value');
    return `((s, e) => Array.from({length: Math.abs(e - s) + 1}, (_, i) => s + (i * (s <= e ? 1 : -1))))(${sc}, ${ec})`;
  }

  // ---------------------------------------------------------------------------
  // Unary operators
  // ---------------------------------------------------------------------------

  emitNot(head, rest) {
    let [operand] = rest;
    if (typeof operand === 'string' || operand instanceof String) return `!${this.emit(operand, 'value')}`;
    if (Array.isArray(operand)) {
      let highPrec = ['.', '?.', '[]', 'optindex', 'optcall'];
      if (highPrec.includes(operand[0])) return `!${this.emit(operand, 'value')}`;
    }
    let code = this.emit(operand, 'value');
    return code.startsWith('(') ? `!${code}` : `(!${code})`;
  }

  emitBitwiseNot(head, rest) { return `(~${this.emit(rest[0], 'value')})`; }

  emitIncDec(head, rest) {
    let [operand, isPostfix] = rest;
    let code = this.emit(operand, 'value');
    return isPostfix ? `(${code}${head})` : `(${head}${code})`;
  }

  emitTypeof(head, rest) { return `typeof ${this.emit(rest[0], 'value')}`; }
  emitDelete(head, rest) { return `(delete ${this.emit(rest[0], 'value')})`; }

  emitInstanceof(head, rest, context, sexpr) {
    let [expr, type] = rest;
    let isNeg = meta(sexpr[0], 'invert');
    let result = `(${this.emit(expr, 'value')} instanceof ${this.emit(type, 'value')})`;
    return isNeg ? `(!${result})` : result;
  }

  emitIn(head, rest, context, sexpr) {
    let [key, container] = rest;
    let keyCode = this.emit(key, 'value');
    let isNeg = meta(sexpr[0], 'invert');
    if (this.is(container, 'object')) {
      let result = `(${keyCode} in ${this.emit(container, 'value')})`;
      return isNeg ? `(!${result})` : result;
    }
    let c = this.emit(container, 'value');
    let result = `(Array.isArray(${c}) || typeof ${c} === 'string' ? ${c}.includes(${keyCode}) : (${keyCode} in ${c}))`;
    return isNeg ? `(!${result})` : result;
  }

  emitOf(head, rest, context, sexpr) {
    let [value, container] = rest;
    let v = this.emit(value, 'value'), c = this.emit(container, 'value');
    let isNeg = meta(sexpr[0], 'invert');
    let result = `(${v} in ${c})`;
    return isNeg ? `(!${result})` : result;
  }

  emitRegexMatch(head, rest) {
    let [left, right] = rest;
    this.helpers.add('toMatchable');
    this.programVars.add('_');
    let r = this.emit(right, 'value');
    let allowNL = r.includes('/m') ? ', true' : '';
    return `(_ = toMatchable(${this.emit(left, 'value')}${allowNL}).match(${r}))`;
  }

  emitNew(head, rest) {
    let [call] = rest;
    if ((this.is(call, '.') || this.is(call, '?.'))) {
      let [accType, target, prop] = call;
      if (Array.isArray(target) && !target[0].startsWith) {
        return `(${this.emit(['new', target], 'value')}).${prop}`;
      }
      return `new ${this.emit(target, 'value')}.${prop}`;
    }
    if (Array.isArray(call)) {
      let [ctor, ...args] = call;
      return `new ${this.emit(ctor, 'value')}(${args.map(a => this.unwrap(this.emit(a, 'value'))).join(', ')})`;
    }
    return `new ${this.emit(call, 'value')}()`;
  }

  // ---------------------------------------------------------------------------
  // Logical operators
  // ---------------------------------------------------------------------------

  emitLogicalAnd(head, rest, context, sexpr) {
    let ops = this.flattenBinaryChain(sexpr).slice(1);
    if (ops.length === 0) return 'true';
    if (ops.length === 1) return this.emit(ops[0], 'value');
    return `(${ops.map(o => this.emit(o, 'value')).join(' && ')})`;
  }

  emitLogicalOr(head, rest, context, sexpr) {
    let ops = this.flattenBinaryChain(sexpr).slice(1);
    if (ops.length === 0) return 'true';
    if (ops.length === 1) return this.emit(ops[0], 'value');
    return `(${ops.map(o => this.emit(o, 'value')).join(' || ')})`;
  }

  // ---------------------------------------------------------------------------
  // Symbol literals
  // ---------------------------------------------------------------------------

  emitSymbol(head, rest) { return `Symbol.for(${JSON.stringify(rest[0])})`; }

  // ---------------------------------------------------------------------------
  // Data structures
  // ---------------------------------------------------------------------------

  emitArray(head, elements) {
    let hasTrailingElision = elements.length > 0 && elements[elements.length - 1] === ',';
    let codes = elements.map(el => {
      if (el === ',') return '';
      if (el === '...') return '';
      if (this.is(el, '...')) return `...${this.emit(el[1], 'value')}`;
      return this.emit(el, 'value');
    }).join(', ');
    return hasTrailingElision ? `[${codes},]` : `[${codes}]`;
  }

  emitObject(head, pairs, context) {
    if (pairs.length === 1 && Array.isArray(pairs[0]) &&
        Array.isArray(pairs[0][2]) && pairs[0][2][0] === 'comprehension') {
      let [, keyVar, compNode] = pairs[0];
      let [, valueExpr, iterators, guards] = compNode;
      return this.emit(['object-comprehension', keyVar, valueExpr, iterators, guards], context);
    }

    // Helper: scan source line for an identifier name within [fromCol, toCol).
    // Used to attach _anchors so identifiers that the parser dropped position
    // info from (method-shorthand params, property shorthand keys) can still
    // produce source-map mappings.
    const scanIdentCol = (srcRow, name, fromCol = 0, toCol = Infinity) => {
      const source = this.options && this.options.source;
      if (!source || typeof name !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(name)) return -1;
      const lines = this._sourceLinesCache || (this._sourceLinesCache = source.split('\n'));
      const line = lines[srcRow];
      if (!line) return -1;
      const re = new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
      re.lastIndex = Math.max(0, fromCol);
      let m;
      while ((m = re.exec(line)) !== null) {
        if (m.index >= toCol) return -1;
        return m.index;
      }
      return -1;
    };

    // Same as scanIdentCol but returns the LAST match in [fromCol, toCol).
    // Property-shorthand pairs only carry .loc for the *end* of the pair,
    // so to find the key's actual column we walk all occurrences and take
    // the rightmost one (the param with the same name appears earlier on
    // the line and would otherwise win).
    const scanIdentColLast = (srcRow, name, fromCol = 0, toCol = Infinity) => {
      const source = this.options && this.options.source;
      if (!source || typeof name !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(name)) return -1;
      const lines = this._sourceLinesCache || (this._sourceLinesCache = source.split('\n'));
      const line = lines[srcRow];
      if (!line) return -1;
      const re = new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
      re.lastIndex = Math.max(0, fromCol);
      let m, last = -1;
      while ((m = re.exec(line)) !== null) {
        if (m.index >= toCol) break;
        last = m.index;
      }
      return last;
    };

    // Track which pairs emit as method-shorthand so we can format the
    // object multi-line. Joining sibling methods with `, ` collapses
    // `}, name(args) {` onto the same generated line as the previous
    // method's closing brace, which makes per-line source-map mappings
    // ambiguous (the LSP can't tell which source line owns that gen line,
    // so parameter classifications get attributed to the wrong source
    // position). Putting each method on its own gen line keeps the
    // line→source mapping one-to-one.
    let hasMethod = false;
    let isMethod = new Array(pairs.length).fill(false);

    let codes = pairs.map((pair, idx) => {
      if (this.is(pair, '...')) return `...${this.emit(pair[1], 'value')}`;
      let [operator, key, value] = pair;
      let keyCode;
      let isSimpleKey = false;
      if (this.is(key, 'dynamicKey')) keyCode = `[${this.emit(key[1], 'value')}]`;
      else if (this.is(key, 'str')) keyCode = `[${this.emit(key, 'value')}]`;
      else {
        this.suppressReactiveUnwrap = true;
        keyCode = this.emit(key, 'value');
        this.suppressReactiveUnwrap = false;
        isSimpleKey = !Array.isArray(key) && typeof keyCode === 'string'
                      && /^[A-Za-z_$][\w$]*$/.test(keyCode);
      }

      // Method-shorthand: `key: -> body` → `key(args) { body }`. Enables
      // TypeScript contextual `this` binding when the object is assigned to
      // a method-shorthand-typed slot, and produces cleaner JS output.
      // Only for thin-arrow (`->`) — fat arrow has lexical `this` semantics.
      // Skip when the value carries side-effect (`!`) or non-trivial meta.
      if (operator === ':' && isSimpleKey && this.is(value, '->')) {
        let [, mParams, mBody] = value;
        if ((!mParams || (Array.isArray(mParams) && mParams.length === 0)) && this.containsIt(mBody)) mParams = ['it'];
        let mSideEffect = this.nextFunctionIsVoid || false;
        this.nextFunctionIsVoid = false;
        let mParamList = this.emitParamList(mParams);
        let mBodyCode = this.emitFunctionBody(mBody, mParams, mSideEffect);
        let mIsAsync = this.containsAwait(mBody);
        let mIsGen = this.containsYield(mBody);
        let prefix = mIsAsync ? 'async ' : '';
        let star = mIsGen ? '*' : '';
        // Inject source-map anchors for plain-string params (e.g. `quantity`
        // in `(product, quantity) ->`). The parser drops .loc from non-data
        // identifier tokens and collectSubExprs intentionally skips the
        // params slot of arrow nodes, so without these the param positions
        // produce no source mapping and the LSP's gen→src lookup falls back
        // to a nearby unrelated identifier — typically classifying the
        // param as `property`.
        if (value && value.loc && Array.isArray(mParams) && mParams.length) {
          const srcRow  = value.loc.r;
          // value.loc.c marks the start of the params group (the `(` for
          // parenthesized params, or the first param's column for bare
          // single-param arrows). Scan forward from there for each param
          // in declaration order.
          const paramsStart = value.loc.c;
          const anchors = [];
          let cursor = paramsStart;
          for (const p of mParams) {
            if (typeof p !== 'string') continue;
            const col = scanIdentCol(srcRow, p, cursor);
            if (col >= 0) {
              anchors.push({ name: p, origLine: srcRow, origCol: col });
              cursor = col + p.length;
            }
          }
          if (anchors.length) {
            value._anchors = (value._anchors || []).concat(anchors);
          }
        }
        hasMethod = true;
        isMethod[idx] = true;
        return `${prefix}${star}${keyCode}(${mParamList}) ${mBodyCode}`;
      }

      let valCode = this.emit(value, 'value');
      // Anchor the key for simple `key: value` pairs so the source-map
      // heuristic has one anchor per source occurrence (otherwise pairs
      // like `quantity: 1` are silent and downstream same-named anchors
      // get stolen by the wrong gen position).
      if (operator === ':' && isSimpleKey && Array.isArray(pair) && pair.loc &&
          typeof key === 'string') {
        const col = scanIdentCol(pair.loc.r, key, 0, pair.loc.c + key.length + 1);
        if (col >= 0) {
          pair._anchors = (pair._anchors || []).concat([
            { name: key, origLine: pair.loc.r, origCol: col }
          ]);
        }
      }
      if (operator === '=') return `${keyCode} = ${valCode}`;
      if (operator === ':') return `${keyCode}: ${valCode}`;
      if (keyCode === valCode && !Array.isArray(key)) {
        // Property shorthand `{ ...i, quantity }` → pair is [null, "quantity",
        // "quantity"] with the *pair* carrying .loc but the key/value strings
        // having none. Without an anchor the heuristic gives the gen position
        // to whichever same-named identifier in the statement happens to be
        // closest by line distance.
        if (Array.isArray(pair) && pair.loc && typeof key === 'string') {
          const col = scanIdentColLast(pair.loc.r, key, 0, pair.loc.c + 1);
          if (col >= 0) {
            pair._anchors = (pair._anchors || []).concat([
              { name: key, origLine: pair.loc.r, origCol: col }
            ]);
          }
        }
        return keyCode;
      }
      return `${keyCode}: ${valCode}`;
    });

    if (!hasMethod) return `{${codes.join(', ')}}`;

    // Multi-line output when any pair is a method. Pairs preceding the
    // first method may stay on the opening-brace line, then each method
    // (and any pair following a method) starts on its own line.
    let parts = [];
    let onOpenLine = [];
    for (let i = 0; i < codes.length; i++) {
      if (isMethod[i] || (i > 0 && isMethod[i - 1])) {
        if (onOpenLine.length && parts.length === 0) {
          parts.push(onOpenLine.join(', '));
          onOpenLine = [];
        }
        parts.push(codes[i]);
      } else if (parts.length === 0) {
        onOpenLine.push(codes[i]);
      } else {
        parts.push(codes[i]);
      }
    }
    if (onOpenLine.length && parts.length === 0) parts.push(onOpenLine.join(', '));
    let head0 = parts[0];
    let rest = parts.slice(1);
    return rest.length === 0 ? `{${head0}}` : `{${head0},\n${rest.join(',\n')}}`;
  }

  emitMap(head, pairs, context) {
    if (pairs.length === 0) return 'new Map()';
    let entries = pairs.map(pair => {
      if (this.is(pair, '...')) return `...${this.emit(pair[1], 'value')}`;
      let [, key, value] = pair;
      let keyCode;
      if (Array.isArray(key)) {
        keyCode = this.emit(key, 'value');
      } else {
        let k = str(key) ?? key;
        let isIdentifier = !k.startsWith('"') && !k.startsWith("'") && !k.startsWith('/') &&
          !CodeEmitter.NUMBER_START_RE.test(k) && !MAP_LITERAL_KEYS.has(k);
        keyCode = isIdentifier ? `"${k}"` : this.emit(key, 'value');
      }
      let valCode = this.emit(value, 'value');
      return `[${keyCode}, ${valCode}]`;
    }).join(', ');
    return `new Map([${entries}])`;
  }

  emitBlock(head, statements, context) {
    if (context === 'statement') {
      let stmts = this.withIndent(() => this.formatStatements(statements));
      return `{\n${stmts.join('\n')}\n${this.indent()}}`;
    }
    if (statements.length === 0) return 'undefined';
    if (statements.length === 1) return this.emit(statements[0], context);
    let last = statements[statements.length - 1];
    let lastIsCtrl = Array.isArray(last) && ['break', 'continue', 'return', 'throw'].includes(last[0]);
    if (lastIsCtrl) {
      let parts = statements.map(s => this.addSemicolon(s, this.emit(s, 'statement')));
      return `{\n${this.withIndent(() => parts.map(p => this.indent() + p).join('\n'))}\n${this.indent()}}`;
    }
    return `(${statements.map(s => this.emit(s, 'value')).join(', ')})`;
  }

  // ---------------------------------------------------------------------------
  // Exception handling
  // ---------------------------------------------------------------------------

  emitTry(head, rest, context) {
    let needsReturns = context === 'value';
    let tryCode = 'try ';
    let tryBlock = rest[0];
    tryCode += (needsReturns && this.is(tryBlock, 'block'))
      ? this.emitBlockWithReturns(tryBlock) : this.emit(tryBlock, 'statement');

    if (rest.length >= 2 && Array.isArray(rest[1]) && rest[1].length === 2 && rest[1][0] !== 'block') {
      let [param, catchBlock] = rest[1];
      tryCode += ' catch';
      if (param && (this.is(param, 'object') || this.is(param, 'array'))) {
        tryCode += ' (error)';
        let destructStmt = `(${this.emit(param, 'value')} = error)`;
        catchBlock = this.is(catchBlock, 'block')
          ? ['block', destructStmt, ...catchBlock.slice(1)]
          : ['block', destructStmt, catchBlock];
      } else if (param) {
        tryCode += ` (${param})`;
      }
      tryCode += ' ' + ((needsReturns && this.is(catchBlock, 'block'))
        ? this.emitBlockWithReturns(catchBlock) : this.emit(catchBlock, 'statement'));
    } else if (rest.length === 2) {
      tryCode += ' finally ' + this.emit(rest[1], 'statement');
    }

    if (rest.length === 3) tryCode += ' finally ' + this.emit(rest[2], 'statement');

    if (rest.length === 1) tryCode += ' catch {}';

    if (needsReturns) {
      // Enclosed: rest[0] (try body), rest[1] (catch clause), rest[2] (finally block)
      let hasAwait = this.containsAwait(rest[0]) || (rest[1] && this.containsAwait(rest[1])) || (rest[2] && this.containsAwait(rest[2]));
      return this.asyncIIFE(hasAwait, tryCode);
    }
    return tryCode;
  }

  emitThrow(head, rest, context) {
    let [expr] = rest;
    if (Array.isArray(expr)) {
      let checkExpr = expr, wrapperType = null;
      if (expr[0] === 'new' && Array.isArray(expr[1]) && expr[1][0] === 'if') {
        wrapperType = 'new'; checkExpr = expr[1];
      } else if (expr[0] === 'if') {
        checkExpr = expr;
      }
      if (checkExpr[0] === 'if') {
        let [, condition, body] = checkExpr;
        let unwrapped = Array.isArray(body) && body.length === 1 ? body[0] : body;
        expr = wrapperType === 'new' ? ['new', unwrapped] : unwrapped;
        let condCode = this.emit(condition, 'value');
        let throwCode = `throw ${this.emit(expr, 'value')}`;
        return `if (${condCode}) {\n${this.indent()}  ${throwCode};\n${this.indent()}}`;
      }
    }
    let throwStmt = `throw ${this.emit(expr, 'value')}`;
    return context === 'value' ? `(() => { ${throwStmt}; })()` : throwStmt;
  }

  emitControl(head, rest, context) {
    let [rawOp, expr, ctrlSexpr] = rest;
    let op = str(rawOp);
    let isReturn = ctrlSexpr[0] === 'return';
    let exprCode = this.emit(expr, 'value');
    let ctrlValue = ctrlSexpr.length > 1 ? ctrlSexpr[1] : null;
    let ctrlCode = isReturn
      ? (ctrlValue ? `return ${this.emit(ctrlValue, 'value')}` : 'return')
      : (ctrlValue ? `throw ${this.emit(ctrlValue, 'value')}` : 'throw new Error()');
    let wrapped = this.wrapForCondition(exprCode);

    if (context === 'value') {
      if (op === '??') return `(() => { const __v = ${exprCode}; if (__v == null) ${ctrlCode}; return __v; })()`;
      if (op === '||') return `(() => { const __v = ${exprCode}; if (!__v) ${ctrlCode}; return __v; })()`;
      return `(() => { const __v = ${exprCode}; if (__v) ${ctrlCode}; return __v; })()`;
    }
    if (op === '??') return `if (${wrapped} == null) ${ctrlCode}`;
    if (op === '||') return `if (!${wrapped}) ${ctrlCode}`;
    return `if (${wrapped}) ${ctrlCode}`;
  }

  // ---------------------------------------------------------------------------
  // Switch
  // ---------------------------------------------------------------------------

  emitSwitch(head, rest, context) {
    let [disc, whens, defaultCase] = rest;
    if (disc === null) return this.emitSwitchAsIfChain(whens, defaultCase, context);

    let switchBody = `switch (${this.emit(disc, 'value')}) {\n`;
    this.indentLevel++;
    for (let clause of whens) {
      let [, test, body] = clause;
      for (let t of test) {
        let tv = str(t) ?? t;
        let cv;
        if (Array.isArray(tv)) cv = this.emit(tv, 'value');
        else if (typeof tv === 'string' && (tv.startsWith('"') || tv.startsWith("'"))) cv = `'${tv.slice(1, -1)}'`;
        else cv = this.emit(tv, 'value');
        switchBody += this.indent() + `case ${cv}:\n`;
      }
      this.indentLevel++;
      switchBody += this.emitSwitchCaseBody(body, context);
      this.indentLevel--;
    }
    if (defaultCase) {
      switchBody += this.indent() + 'default:\n';
      this.indentLevel++;
      switchBody += this.emitSwitchCaseBody(defaultCase, context);
      this.indentLevel--;
    }
    this.indentLevel--;
    switchBody += this.indent() + '}';

    if (context === 'value') {
      // Enclosed: disc (discriminant), w[1] (case labels), w[2] (case bodies), defaultCase
      let hasAwait = this.containsAwait(disc) || whens.some(w => this.containsAwait(w[1]) || this.containsAwait(w[2])) || (defaultCase && this.containsAwait(defaultCase));
      return this.asyncIIFE(hasAwait, switchBody);
    }
    return switchBody;
  }

  emitWhen(head, rest, context, sexpr) { this.error('when clause should be handled by switch', sexpr); }

  // ---------------------------------------------------------------------------
  // Comprehensions
  // ---------------------------------------------------------------------------

  // Shared: parse a for-in iterator and return { header, setup }.
  //   header: the for(...) clause (no trailing brace)
  //   setup:  any `const x = arr[i]` preamble line, or null
  _forInHeader(vars, iterable, step) {
    let va = Array.isArray(vars) ? vars : [vars];
    let noVar = va.length === 0;
    let [itemVar, indexVar] = noVar ? ['_i', null] : va;
    let ivp = (this.is(itemVar, 'array') || this.is(itemVar, 'object'))
      ? this.emitDestructuringPattern(itemVar) : itemVar;

    if (step && step !== null) {
      let ih = Array.isArray(iterable) && iterable[0];
      if (ih instanceof String) ih = str(ih);
      let isRange = ih === '..' || ih === '...';
      if (isRange) {
        let isExcl = ih === '...';
        let [s, e] = iterable.slice(1);
        let sc = this.emit(s, 'value'), ec = this.emit(e, 'value'), stc = this.emit(step, 'value');
        return { header: `for (let ${ivp} = ${sc}; ${ivp} ${isExcl ? '<' : '<='} ${ec}; ${ivp} += ${stc})`, setup: null };
      }
      let ic = this.emit(iterable, 'value'), idxN = indexVar || '_i', stc = this.emit(step, 'value');
      let isNeg = this.is(step, '-', 1);
      let isMinus1 = isNeg && (step[1] === '1' || step[1] === 1 || str(step[1]) === '1');
      let isPlus1 = !isNeg && (step === '1' || step === 1 || str(step) === '1');
      let update = isMinus1 ? `${idxN}--` : isPlus1 ? `${idxN}++` : `${idxN} += ${stc}`;
      let header = isNeg
        ? `for (let ${idxN} = ${ic}.length - 1; ${idxN} >= 0; ${update})`
        : `for (let ${idxN} = 0; ${idxN} < ${ic}.length; ${update})`;
      return { header, setup: noVar ? null : `let ${ivp} = ${ic}[${idxN}];` };
    }
    if (indexVar) {
      let ic = this.emit(iterable, 'value');
      return {
        header: `for (let ${indexVar} = 0; ${indexVar} < ${ic}.length; ${indexVar}++)`,
        setup: `let ${ivp} = ${ic}[${indexVar}];`,
      };
    }
    return { header: `for (let ${ivp} of ${this.emit(iterable, 'value')})`, setup: null };
  }

  // Shared: parse a for-of (object) iterator and return { header, own, vv, oc, kvp }.
  _forOfHeader(vars, iterable, own) {
    let va = Array.isArray(vars) ? vars : [vars];
    let [kv, vv] = va;
    let kvp = (this.is(kv, 'array') || this.is(kv, 'object'))
      ? this.emitDestructuringPattern(kv) : kv;
    let oc = this.emit(iterable, 'value');
    return { header: `for (let ${kvp} in ${oc})`, own, vv, oc, kvp };
  }

  // Shared: parse a for-as (iterator) spec and return { header }.
  _forAsHeader(vars, iterable, isAwait) {
    let va = Array.isArray(vars) ? vars : [vars];
    let [fv] = va;
    let ivp = (this.is(fv, 'array') || this.is(fv, 'object'))
      ? this.emitDestructuringPattern(fv) : fv;
    return { header: `for ${isAwait ? 'await ' : ''}(let ${ivp} of ${this.emit(iterable, 'value')})` };
  }

  emitComprehension(head, rest, context) {
    let [expr, iterators, guards] = rest;
    if (context === 'statement') return this.emitComprehensionAsLoop(expr, iterators, guards);
    if (this.comprehensionTarget) {
      // Consume-and-clear: the auto-return-loop logic sets comprehensionTarget
      // expecting ONE consumer (the direct value-context comprehension being
      // routed to the named target). Without clearing here, nested
      // comprehensions inside this comprehension's body (call args, RHS
      // expressions) would inherit the target and skip their own IIFE,
      // producing malformed JS or wrong semantics. The body's own emit calls
      // see comprehensionTarget = null and correctly produce IIFEs.
      let target = this.comprehensionTarget;
      this.comprehensionTarget = null;
      try {
        return this.emitComprehensionWithTarget(expr, iterators, guards, target);
      } finally {
        this.comprehensionTarget = target;
      }
    }

    // Enclosed: expr, iterators (iterable expressions), guards
    let hasAwait = this.containsAwait(expr) || iterators.some(i => this.containsAwait(i)) || guards.some(g => this.containsAwait(g));
    let code = this.asyncIIFEOpen(hasAwait) + '\n';
    this.indentLevel++;
    this.comprehensionDepth++;
    code += this.indent() + 'const result = [];\n';

    for (let iter of iterators) {
      let [iterType, vars, iterable, stepOrOwn] = iter;
      if (iterType === 'for-in') {
        let { header, setup } = this._forInHeader(vars, iterable, stepOrOwn);
        code += this.indent() + header + ' {\n';
        this.indentLevel++;
        if (setup) code += this.indent() + setup + '\n';
      } else if (iterType === 'for-of') {
        let { header, own, vv, oc, kvp } = this._forOfHeader(vars, iterable, stepOrOwn);
        code += this.indent() + header + ' {\n';
        this.indentLevel++;
        if (own) code += this.indent() + `if (!Object.hasOwn(${oc}, ${kvp})) continue;\n`;
        if (vv) code += this.indent() + `let ${vv} = ${oc}[${kvp}];\n`;
      } else if (iterType === 'for-as') {
        let { header } = this._forAsHeader(vars, iterable, iter[3]);
        code += this.indent() + header + ' {\n';
        this.indentLevel++;
      }
    }

    for (let guard of guards) {
      code += this.indent() + `if (${this.emit(guard, 'value')}) {\n`;
      this.indentLevel++;
    }

    let hasCtrl = (node) => {
      if (typeof node === 'string' && (node === 'break' || node === 'continue')) return true;
      if (!Array.isArray(node)) return false;
      if (['break', 'continue', 'return', 'throw'].includes(node[0])) return true;
      if (node[0] === 'if') return node.slice(1).some(hasCtrl);
      return node.some(hasCtrl);
    };

    let loopStmts = ['for-in', 'for-of', 'for-as', 'while', 'loop'];
    if (this.is(expr, 'block')) {
      for (let i = 0; i < expr.length - 1; i++) {
        let s = expr[i + 1], isLast = i === expr.length - 2;
        if (!isLast || hasCtrl(s)) {
          code += this.indent() + this.emit(s, 'statement') + ';\n';
        } else if (Array.isArray(s) && loopStmts.includes(s[0])) {
          code += this.indent() + this.emit(s, 'statement') + ';\n';
        } else {
          code += this.indent() + `result.push(${this.emit(s, 'value')});\n`;
        }
      }
    } else {
      if (hasCtrl(expr)) {
        code += this.indent() + this.emit(expr, 'statement') + ';\n';
      } else if (Array.isArray(expr) && loopStmts.includes(expr[0])) {
        code += this.indent() + this.emit(expr, 'statement') + ';\n';
      } else {
        code += this.indent() + `result.push(${this.emit(expr, 'value')});\n`;
      }
    }

    for (let i = 0; i < guards.length; i++) { this.indentLevel--; code += this.indent() + '}\n'; }
    for (let i = 0; i < iterators.length; i++) { this.indentLevel--; code += this.indent() + '}\n'; }
    code += this.indent() + 'return result;\n';
    this.indentLevel--;
    this.comprehensionDepth--;
    code += this.indent() + '})()';
    return code;
  }

  emitObjectComprehension(head, rest, context) {
    let [keyExpr, valueExpr, iterators, guards] = rest;
    // Enclosed: keyExpr, valueExpr, iterators (iterable expressions), guards
    let hasAwait = this.containsAwait(keyExpr) || this.containsAwait(valueExpr) || iterators.some(i => this.containsAwait(i)) || guards.some(g => this.containsAwait(g));
    let code = this.asyncIIFEOpen(hasAwait) + '\n';
    this.indentLevel++;
    code += this.indent() + 'const result = {};\n';
    for (let iter of iterators) {
      let [iterType, vars, iterable, own] = iter;
      if (iterType === 'for-of') {
        let [kv, vv] = vars;
        let oc = this.emit(iterable, 'value');
        code += this.indent() + `for (let ${kv} in ${oc}) {\n`;
        this.indentLevel++;
        if (own) code += this.indent() + `if (!Object.hasOwn(${oc}, ${kv})) continue;\n`;
        if (vv) code += this.indent() + `let ${vv} = ${oc}[${kv}];\n`;
      }
    }
    for (let guard of guards) { code += this.indent() + `if (${this.emit(guard, 'value')}) {\n`; this.indentLevel++; }
    code += this.indent() + `result[${this.emit(keyExpr, 'value')}] = ${this.emit(valueExpr, 'value')};\n`;
    for (let i = 0; i < guards.length; i++) { this.indentLevel--; code += this.indent() + '}\n'; }
    for (let i = 0; i < iterators.length; i++) { this.indentLevel--; code += this.indent() + '}\n'; }
    code += this.indent() + 'return result;\n';
    this.indentLevel--;
    code += this.indent() + '})()';
    return code;
  }

  // ---------------------------------------------------------------------------
  // Classes
  // ---------------------------------------------------------------------------

  emitClass(head, rest, context) {
    let [className, parentClass, ...bodyParts] = rest;
    let code = className ? `class ${className}` : 'class';
    if (parentClass) code += ` extends ${this.emit(parentClass, 'value')}`;
    code += ' {\n';

    if (bodyParts.length > 0 && Array.isArray(bodyParts[0])) {
      let bodyBlock = bodyParts[0];
      if (bodyBlock[0] === 'block') {
        let bodyStmts = bodyBlock.slice(1);
        let hasObjFirst = bodyStmts.length > 0 && Array.isArray(bodyStmts[0]) && bodyStmts[0][0] === 'object';

        if (hasObjFirst) {
          let members = bodyStmts[0].slice(1);
          this.indentLevel++;
          code += this._emitClassMembers(members, parentClass);
          for (let stmt of bodyStmts.slice(1)) {
            if (this.is(stmt, 'class')) {
              let [, nestedName, parent, ...nestedBody] = stmt;
              if (this.is(nestedName, '.') && nestedName[1] === 'this') {
                code += this.indent() + `static ${nestedName[2]} = ${this.emit(['class', null, parent, ...nestedBody], 'value')};\n`;
              } else {
                code += this.indent() + this.emit(stmt, 'statement') + ';\n';
              }
            } else {
              code += this.indent() + this.emit(stmt, 'statement') + ';\n';
            }
          }
          this.indentLevel--;
        } else {
          this.indentLevel++;
          for (let stmt of bodyStmts) {
            if (this.is(stmt, '=') && Array.isArray(stmt[1]) && stmt[1][0] === '.' && stmt[1][1] === 'this') {
              code += this.indent() + `static ${stmt[1][2]} = ${this.emit(stmt[2], 'value')};\n`;
            } else {
              code += this.indent() + this.emit(stmt, 'statement') + ';\n';
            }
          }
          this.indentLevel--;
        }
      }
    }

    code += this.indent() + '}';
    return code;
  }

  _emitClassMembers(members, parentClass) {
    let code = '';

    let boundMethods = [];
    for (let [, mk, mv] of members) {
      let isStatic = this.is(mk, '.') && mk[1] === 'this';
      let isComputed = this.is(mk, 'computed');
      let mName = this.extractMemberName(mk);
      if (this.is(mv, '=>') && !isStatic && !isComputed && mName !== 'constructor') boundMethods.push(mName);
    }

    for (let [, mk, mv] of members) {
      let isStatic = this.is(mk, '.') && mk[1] === 'this';
      let isComputed = this.is(mk, 'computed');
      let mName = this.extractMemberName(mk);

      if (this.is(mv, '->') || this.is(mv, '=>')) {
        let [, params, body] = mv;
        let hasAwait = this.containsAwait(body), hasYield = this.containsYield(body);
        let cleanParams = params, autoAssign = [];

        if (mName === 'constructor') {
          let isSubclass = !!parentClass;
          let atParamMap = isSubclass ? new Map() : null;
          cleanParams = params.map(p => {
            if (this.is(p, '.') && p[1] === 'this') {
              // Unwrap String-wrapper identifiers — typed @field params
              // arrive with their type metadata attached as `.data.type`
              // and would otherwise miss the atParamMap key match (the
              // map is queried with primitive strings via `str(prop)`).
              let name = str(p[2]);
              let param = isSubclass ? `_${name}` : name;
              autoAssign.push(`this.${name} = ${param}`);
              if (isSubclass) atParamMap.set(name, param);
              return param;
            }
            if (this.is(p, 'default') && this.is(p[1], '.') && p[1][1] === 'this') {
              let name = str(p[1][2]);
              let param = isSubclass ? `_${name}` : name;
              autoAssign.push(`this.${name} = ${param}`);
              if (isSubclass) atParamMap.set(name, param);
              return ['default', param, p[2]];
            }
            return p;
          });
          for (let bm of boundMethods) autoAssign.unshift(`this.${bm} = this.${bm}.bind(this)`);
          if (atParamMap?.size > 0) this._atParamMap = atParamMap;
        }

        let pList = this.emitParamList(cleanParams);
        let prefix = (isStatic ? 'static ' : '') + (hasAwait ? 'async ' : '') + (hasYield ? '*' : '');
        code += this.indent() + `${prefix}${mName}(${pList}) `;
        if (!isComputed) this.currentMethodName = mName;
        code += this.emitMethodBody(body, autoAssign, mName === 'constructor', cleanParams);
        this._atParamMap = null;
        this.currentMethodName = null;
        code += '\n';
      } else if (isStatic) {
        code += this.indent() + `static ${mName} = ${this.emit(mv, 'value')};\n`;
      } else {
        code += this.indent() + `${mName} = ${this.emit(mv, 'value')};\n`;
      }
    }

    return code;
  }

  emitSuper(head, rest) {
    if (rest.length === 0) {
      if (this.currentMethodName && this.currentMethodName !== 'constructor') return `super.${this.currentMethodName}()`;
      return 'super';
    }
    let args = rest.map(a => this.unwrap(this.emit(a, 'value'))).join(', ');
    if (this.currentMethodName && this.currentMethodName !== 'constructor') return `super.${this.currentMethodName}(${args})`;
    return `super(${args})`;
  }

  // ---------------------------------------------------------------------------
  // Modules
  // ---------------------------------------------------------------------------

  emitImport(head, rest, context, sexpr) {
    if (rest.length === 1) {
      let importExpr = `import(${this.emit(rest[0], 'value')})`;
      if (meta(sexpr[0], 'await') === true) return `(await ${importExpr})`;
      return importExpr;
    }
    if (this.options.skipImports) return '';
    if (rest.length === 3) {
      let [def, named, source] = rest;
      let fixedSource = this.addJsExtensionAndAssertions(source);
      if (named[0] === '*' && named.length === 2) return `import ${def}, * as ${named[1]} from ${fixedSource}`;
      let names = named.map(i => Array.isArray(i) && i.length === 2 ? `${i[0]} as ${i[1]}` : i).join(', ');
      return `import ${def}, { ${names} } from ${fixedSource}`;
    }
    let [specifier, source] = rest;
    let fixedSource = this.addJsExtensionAndAssertions(source);
    if (typeof specifier === 'string') return `import ${specifier} from ${fixedSource}`;
    if (Array.isArray(specifier)) {
      if (specifier[0] === '*' && specifier.length === 2) return `import * as ${specifier[1]} from ${fixedSource}`;
      let names = specifier.map(i => Array.isArray(i) && i.length === 2 ? `${i[0]} as ${i[1]}` : i).join(', ');
      return `import { ${names} } from ${fixedSource}`;
    }
    return `import ${this.emit(specifier, 'value')} from ${fixedSource}`;
  }

  emitExport(head, rest) {
    let [decl] = rest;
    if (this.options.skipExports) {
      if (this.is(decl, '=')) {
        const prev = this._componentName;
        const prevTP = this._componentTypeParams;
        const prevSchema = this._schemaName;
        if (this.is(decl[2], 'component')) {
          this._componentName = str(decl[1]);
          this._componentTypeParams = decl[1]?.typeParams || '';
        }
        if (this.is(decl[2], 'schema')) this._schemaName = str(decl[1]);
        const result = `const ${decl[1]} = ${this.emit(decl[2], 'value')}`;
        this._componentName = prev;
        this._componentTypeParams = prevTP;
        this._schemaName = prevSchema;
        return result;
      }
      if (Array.isArray(decl) && decl.every(i => typeof i === 'string')) return '';
      return this.emit(decl, 'statement');
    }
    if (this.is(decl, '=')) {
      const prev = this._componentName;
      const prevTP = this._componentTypeParams;
      const prevSchema = this._schemaName;
      if (this.is(decl[2], 'component')) {
        this._componentName = str(decl[1]);
        this._componentTypeParams = decl[1]?.typeParams || '';
      }
      if (this.is(decl[2], 'schema')) this._schemaName = str(decl[1]);
      const result = `export const ${decl[1]} = ${this.emit(decl[2], 'value')}`;
      this._componentName = prev;
      this._componentTypeParams = prevTP;
      this._schemaName = prevSchema;
      return result;
    }
    if (Array.isArray(decl) && decl.every(i => typeof i === 'string')) return `export { ${decl.join(', ')} }`;
    return `export ${this.emit(decl, 'statement')}`;
  }

  emitExportDefault(head, rest) {
    let [expr] = rest;
    if (this.options.skipExports) {
      if (this.is(expr, '=')) return `const ${expr[1]} = ${this.emit(expr[2], 'value')}`;
      return this.emit(expr, 'statement');
    }
    if (this.is(expr, '=')) {
      return `const ${expr[1]} = ${this.emit(expr[2], 'value')};\nexport default ${expr[1]}`;
    }
    return `export default ${this.emit(expr, 'statement')}`;
  }

  emitExportAll(head, rest) {
    if (this.options.skipExports) return '';
    return `export * from ${this.addJsExtensionAndAssertions(rest[0])}`;
  }

  emitExportFrom(head, rest) {
    if (this.options.skipExports) return '';
    let [specifiers, source] = rest;
    let fixedSource = this.addJsExtensionAndAssertions(source);
    if (Array.isArray(specifiers)) {
      let names = specifiers.map(i => Array.isArray(i) && i.length === 2 ? `${i[0]} as ${i[1]}` : i).join(', ');
      return `export { ${names} } from ${fixedSource}`;
    }
    return `export ${specifiers} from ${fixedSource}`;
  }

  // ---------------------------------------------------------------------------
  // Special forms
  // ---------------------------------------------------------------------------

  emitDoIIFE(head, rest) {
    return `(${this.emit(rest[0], 'statement')})()`;
  }

  emitRegex(head, rest) {
    return rest.length === 0 ? head : this.emit(rest[0], 'value');
  }

  emitTaggedTemplate(head, rest) {
    let [tag, s] = rest;
    let tagCode = this.emit(tag, 'value');
    let content = this.emit(s, 'value');
    if (content.startsWith('`')) return `${tagCode}${content}`;
    if (content.startsWith('"') || content.startsWith("'")) return `${tagCode}\`${content.slice(1, -1)}\``;
    return `${tagCode}\`${content}\``;
  }

  emitString(head, rest) {
    let result = '`';
    for (let part of rest) {
      if (part instanceof String) {
        result += this.extractStringContent(part);
      } else if (typeof part === 'string') {
        if (part.startsWith('"') || part.startsWith("'")) {
          if (this.options.debug) console.warn('[Rip] Unexpected quoted primitive in str:', part);
          result += part.slice(1, -1);
        } else {
          result += part;
        }
      } else if (Array.isArray(part)) {
        if (part.length === 1 && typeof part[0] === 'string' && !Array.isArray(part[0])) {
          let v = part[0];
          result += /^[\d"']/.test(v) ? '${' + this.emit(v, 'value') + '}' : '${' + v + '}';
        } else {
          let expr = part.length === 1 && Array.isArray(part[0]) ? part[0] : part;
          result += '${' + this.emit(expr, 'value') + '}';
        }
      }
    }
    return result + '`';
  }

  // ---------------------------------------------------------------------------
  // Helper methods
  // ---------------------------------------------------------------------------

  findPostfixConditional(expr) {
    if (!Array.isArray(expr)) return null;
    let h = expr[0];
    if (h === 'if' && expr.length === 3) return {type: h, condition: expr[1], value: expr[2]};
    if (h === '+' || h === '-' || h === '*' || h === '/') {
      for (let i = 1; i < expr.length; i++) {
        let found = this.findPostfixConditional(expr[i]);
        if (found) { found.parentOp = h; found.operandIndex = i; found.otherOperands = expr.slice(1).filter((_, idx) => idx !== i - 1); return found; }
      }
    }
    return null;
  }

  rebuildWithoutConditional(cond) {
    let val = Array.isArray(cond.value) && cond.value.length === 1 ? cond.value[0] : cond.value;
    if (cond.parentOp) return [cond.parentOp, ...cond.otherOperands, val];
    return val;
  }

  _tryPostfixCall(head, rest, context) {
    if (context !== 'statement' || rest.length !== 1) return null;
    let cond = this.findPostfixConditional(rest[0]);
    if (!cond) return null;
    let argWithout = this.rebuildWithoutConditional(cond);
    let calleeCode = this.emit(head, 'value');
    let condCode = this.emit(cond.condition, 'value');
    let valCode = this.emit(argWithout, 'value');
    return `if (${condCode}) ${calleeCode}(${valCode})`;
  }

  _emitArgs(rest) {
    return rest.map(arg => this.unwrap(this.emit(arg, 'value'))).join(', ');
  }

  emitDestructuringPattern(pattern) { return this.formatParam(pattern); }

  emitParamList(params) {
    let expIdx = params.findIndex(p => this.is(p, 'expansion'));
    if (expIdx !== -1) {
      let before = params.slice(0, expIdx), after = params.slice(expIdx + 1);
      let regular = before.map(p => this.formatParam(p)).join(', ');
      this.expansionAfterParams = after;
      return regular ? `${regular}, ..._rest` : '..._rest';
    }
    let restIdx = params.findIndex(p => this.is(p, 'rest'));
    if (restIdx !== -1 && restIdx < params.length - 1) {
      let before = params.slice(0, restIdx), restP = params[restIdx], after = params.slice(restIdx + 1);
      let beforeP = before.map(p => this.formatParam(p));
      this.restMiddleParam = {restName: restP[1], afterParams: after, beforeCount: before.length};
      return beforeP.length > 0 ? `${beforeP.join(', ')}, ...${restP[1]}` : `...${restP[1]}`;
    }
    this.expansionAfterParams = null;
    this.restMiddleParam = null;
    return params.map(p => this.formatParam(p)).join(', ');
  }

  formatParam(param) {
    if (typeof param === 'string') return param;
    if (param instanceof String) {
      // In `inlineTypes` mode (set by typecheck.compileForCheck), emit the
      // type annotation inline so shadow TS sees `name: T` for typed params
      // in every function-like position — top-level arrows, class methods,
      // object-literal method shorthand, nested functions, etc. The user-
      // facing `-c` output stays untouched because this flag is off by
      // default. `.type` carries the raw Rip type string (with `::`),
      // which converts to TS form by swapping `::` → `:`.
      if (this.options.inlineTypes && param.type) {
        return `${param.valueOf()}: ${param.type.replace(/::/g, ':')}`;
      }
      return param.valueOf();
    }
    if (this.is(param, 'rest')) {
      // Rest param: `...name`. When the name is a String wrapper carrying
      // a type, emit `...name: T` so shadow TS sees the rest tuple/array.
      let restName = param[1];
      if (this.options.inlineTypes && restName instanceof String && restName.type) {
        return `...${restName.valueOf()}: ${restName.type.replace(/::/g, ':')}`;
      }
      return `...${restName}`;
    }
    if (this.is(param, 'default')) {
      // `param[1]` is either a plain identifier string (e.g. `x = 5`) or a
      // destructuring pattern AST node (e.g. `{a, b} = {}`). Recurse via
      // `formatParam` so patterns emit as `{a, b}` / `[x, y]` instead of
      // being coerced to a string via `Array.prototype.toString`, which
      // produced the famous `(object,,a,a,,b,b = {})` mis-rendering.
      // The recursion also picks up any inline type annotation on the
      // name in `inlineTypes` mode, yielding `name: T = default`.
      return `${this.formatParam(param[1])} = ${this.emit(param[2], 'value')}`;
    }
    if (this.is(param, '.') && param[1] === 'this') return param[2];
    if (this.is(param, 'array')) {
      let els = param.slice(1).map(el => {
        if (el === ',') return '';
        if (el === '...') return '';
        if (this.is(el, '...')) return `...${el[1]}`;
        if (this.is(el, '=') && typeof el[1] === 'string') return `${el[1]} = ${this.emit(el[2], 'value')}`;
        if (typeof el === 'string') return el;
        return this.formatParam(el);
      });
      return `[${els.join(', ')}]`;
    }
    if (this.is(param, 'object')) {
      let pairs = param.slice(1).map(pair => {
        if (this.is(pair, '...')) return `...${pair[1]}`;
        if (this.is(pair, 'default')) return `${pair[1]} = ${this.emit(pair[2], 'value')}`;
        let [operator, key, value] = pair;
        if (operator === '=') return `${key} = ${this.emit(value, 'value')}`;
        if (key === value) return key;
        return `${key}: ${this.formatParam(value)}`;
      });
      return `{${pairs.join(', ')}}`;
    }
    return JSON.stringify(param);
  }

  // ---------------------------------------------------------------------------
  // Body generation
  // ---------------------------------------------------------------------------

  emitBodyWithReturns(body, params = [], options = {}) {
    let {sideEffectOnly = false, autoAssignments = [], isConstructor = false, hasExpansionParams = false} = options;
    let prevSEO = this.sideEffectOnly;
    this.sideEffectOnly = sideEffectOnly;

    let paramNames = new Set();
    let extractPN = (p) => {
      // Unwrap String wrappers — typed params arrive as `new String('name')`
      // with `.data.type` metadata. Without unwrapping, `paramNames.has('name')`
      // misses (Set compares wrappers by identity), causing the param name to
      // be re-hoisted as a local `let`, producing duplicate-declaration errors.
      if (typeof p === 'string' || p instanceof String) paramNames.add(str(p));
      else if (Array.isArray(p)) {
        if (p[0] === 'rest' || p[0] === '...') { if (typeof p[1] === 'string' || p[1] instanceof String) paramNames.add(str(p[1])); }
        else if (p[0] === 'default') { if (typeof p[1] === 'string' || p[1] instanceof String) paramNames.add(str(p[1])); }
        else if (p[0] === 'array' || p[0] === 'object') this.collectVarsFromArray(p, paramNames);
      }
    };
    if (Array.isArray(params)) params.forEach(extractPN);

    let bodyVars = this.collectFunctionVariables(body);
    let newVars = new Set([...bodyVars].filter(v =>
      !this.programVars.has(v) && !this.reactiveVars?.has(v) && !paramNames.has(v) &&
      !this.scopeStack.some(s => s.has(v))  // don't re-declare variables from enclosing scopes
    ));
    let noRetStmts = ['return', 'throw', 'break', 'continue'];
    let loopStmts = ['for-in', 'for-of', 'for-as', 'while', 'loop'];

    // Track this function's scope so nested functions don't re-declare its variables
    this.scopeStack.push(new Set([...newVars, ...paramNames]));

    if (this.is(body, 'block')) {
      let statements = this.unwrapBlock(body);

      if (hasExpansionParams && this.expansionAfterParams?.length > 0) {
        let extr = this.expansionAfterParams.map((p, i) => {
          let pn = typeof p === 'string' ? p : JSON.stringify(p);
          return `const ${pn} = _rest[_rest.length - ${this.expansionAfterParams.length - i}]`;
        });
        statements = [...extr, ...statements];
        this.expansionAfterParams = null;
      }

      if (this.restMiddleParam) {
        let {restName, afterParams} = this.restMiddleParam;
        let afterCount = afterParams.length;
        let extr = [];
        afterParams.forEach((p, i) => {
          let pn = typeof p === 'string' ? p : (this.is(p, 'default')) ? p[1] : JSON.stringify(p);
          extr.push(`const ${pn} = ${restName}[${restName}.length - ${afterCount - i}]`);
        });
        if (afterCount > 0) extr.push(`${restName} = ${restName}.slice(0, -${afterCount})`);
        statements = [...extr, ...statements];
        this.restMiddleParam = null;
      }

      this.indentLevel++;
      let code = '{\n';
      if (newVars.size > 0) {
        // In `inlineTypes` mode, propagate `name:: T = value` annotations from
        // body-level typed assignments onto the hoisted `let`. Without this,
        // the hoist emits `let y;` (no type), shadow-TS infers from the first
        // RHS literal (`y = true` → `y: true`), and any later `y = false`
        // fails TS2322. With this, the hoist emits `let y: boolean;` and the
        // body's `y = true` / `y = false` both check cleanly.
        let typedLocals = this.options.inlineTypes ? this.collectTypedLocals(body) : null;
        let names = Array.from(newVars).sort().map(n => {
          let t = typedLocals?.get(n);
          return t ? `${n}: ${t}` : n;
        });
        code += this.indent() + `let ${names.join(', ')};\n`;
      }

      let firstIsSuper = autoAssignments.length > 0 && statements.length > 0 &&
                         Array.isArray(statements[0]) && statements[0][0] === 'super';

      let genStatements = (stmts) => {
        stmts.forEach((stmt, index) => {
          let isLast = index === stmts.length - 1;
          let h = Array.isArray(stmt) ? stmt[0] : null;

          if (!isLast && h === 'comprehension') {
            let [, expr, iters, guards] = stmt;
            code += this.indent() + this.emitComprehensionAsLoop(expr, iters, guards) + '\n';
            return;
          }

          if (!isConstructor && !sideEffectOnly && isLast && h === 'if') {
            let [cond, thenB, ...elseB] = stmt.slice(1);
            let hasMulti = (b) => this.is(b, 'block') && b.length > 2;
            let hasCtrlStmt = this.hasStatementInBranch(thenB) || elseB.some(b => this.hasStatementInBranch(b));
            if (hasCtrlStmt || hasMulti(thenB) || elseB.some(hasMulti)) {
              code += this.emitIfElseWithEarlyReturns(stmt) + '\n';
              return;
            }
          }

          if (!isConstructor && !sideEffectOnly && isLast && h === '=') {
            let [target, value] = stmt.slice(1);
            if (typeof target === 'string' && Array.isArray(value)) {
              let vh = value[0];
              if (vh === 'comprehension' || vh === 'for-in') {
                this.comprehensionTarget = target;
                code += this.emit(value, 'value');
                this.comprehensionTarget = null;
                code += this.indent() + `return ${target};\n`;
                return;
              }
            }
          }

          if (!isConstructor && !sideEffectOnly && isLast && loopStmts.includes(h)) {
            if (this.containsYield(stmt)) {
              code += this.indent() + this.addSemicolon(stmt, this.emit(stmt, 'statement')) + '\n';
              return;
            }
            // Auto-return-loop: only for-in/for-of/for-as auto-collect into
            // _result, because emitForIn/emitForOf/emitForAs at value-context
            // wrap themselves in a comprehension that consumes
            // comprehensionTarget. `loop` and `while` have no such wrapping —
            // emitLoop/emitWhile just emit `while(...) { body }` and any
            // comprehensionTarget set here would LEAK into nested
            // expression-context comprehensions inside the body (causing
            // them to be routed to the wrong target and skip their own
            // IIFE). Loops with explicit `return X` inside their body
            // already work correctly; emit them as plain statements.
            let isCollectibleLoop = h === 'for-in' || h === 'for-of' || h === 'for-as';
            if (!isCollectibleLoop) {
              code += this.indent() + this.addSemicolon(stmt, this.emit(stmt, 'statement')) + '\n';
              return;
            }
            code += this.indent() + 'const _result = [];\n';
            this.comprehensionTarget = '_result';
            let saved = this._skipCompTargetInit;
            this._skipCompTargetInit = true;
            code += this.emit(stmt, 'value');
            this._skipCompTargetInit = saved;
            this.comprehensionTarget = null;
            code += this.indent() + 'return _result;\n';
            return;
          }

          let needsReturn = !isConstructor && !sideEffectOnly && isLast &&
                           !noRetStmts.includes(h) &&
                           !this.hasExplicitControlFlow(stmt);
          let ctx = needsReturn ? 'value' : 'statement';
          let sc = this.emit(stmt, ctx);
          if (needsReturn) code += this.indent() + 'return ' + sc + ';\n';
          else code += this.indent() + this.addSemicolon(stmt, sc) + '\n';
        });
      };

      if (firstIsSuper) {
        let isSuperOnly = statements.length === 1;
        if (isSuperOnly && !isConstructor) code += this.indent() + 'return ' + this.emit(statements[0], 'value') + ';\n';
        else code += this.indent() + this.emit(statements[0], 'statement') + ';\n';
        for (let a of autoAssignments) code += this.indent() + a + ';\n';
        genStatements(statements.slice(1));
      } else {
        for (let a of autoAssignments) code += this.indent() + a + ';\n';
        genStatements(statements);
      }

      if (sideEffectOnly && statements.length > 0) {
        let lastH = Array.isArray(statements[statements.length - 1]) ? statements[statements.length - 1][0] : null;
        if (!noRetStmts.includes(lastH)) code += this.indent() + 'return;\n';
      }

      this.indentLevel--;
      code += this.indent() + '}';
      this.scopeStack.pop();
      this.sideEffectOnly = prevSEO;
      return code;
    }

    // Single expression
    this.sideEffectOnly = prevSEO;
    let result;
    if (isConstructor && autoAssignments.length > 0) {
      // Constructor with @params as a single expression — need to emit autoAssignments
      let isSuper = Array.isArray(body) && body[0] === 'super';
      let bodyCode = this.emit(body, 'statement');
      let assigns = autoAssignments.map(a => `${a};`).join(' ');
      result = isSuper ? `{ ${bodyCode}; ${assigns} }` : `{ ${assigns} ${bodyCode}; }`;
    } else if (isConstructor || this.hasExplicitControlFlow(body)) result = `{ ${this.emit(body, 'statement')}; }`;
    else if (Array.isArray(body) && (noRetStmts.includes(body[0]) || loopStmts.includes(body[0]))) result = `{ ${this.emit(body, 'statement')}; }`;
    else if (sideEffectOnly) result = `{ ${this.emit(body, 'statement')}; return; }`;
    else result = `{ return ${this.emit(body, 'value')}; }`;
    this.scopeStack.pop();
    return result;
  }

  emitFunctionBody(body, params = [], sideEffectOnly = false) {
    return this.emitBodyWithReturns(body, params, {sideEffectOnly, hasExpansionParams: this.expansionAfterParams?.length > 0});
  }

  emitMethodBody(body, autoAssignments = [], isConstructor = false, params = []) {
    return this.emitBodyWithReturns(body, params, {autoAssignments, isConstructor});
  }

  emitBlockWithReturns(block) {
    if (!Array.isArray(block) || block[0] !== 'block') return this.emit(block, 'statement');
    let stmts = this.unwrapBlock(block);
    let lines = this.withIndent(() => stmts.map((stmt, i) => {
      let isLast = i === stmts.length - 1;
      let h = Array.isArray(stmt) ? stmt[0] : null;
      let needsReturn = isLast && !['return', 'throw', 'break', 'continue'].includes(h);
      let code = this.emit(stmt, needsReturn ? 'value' : 'statement');
      return needsReturn ? this.indent() + 'return ' + code + ';' : this.indent() + code + ';';
    }));
    return `{\n${lines.join('\n')}\n${this.indent()}}`;
  }

  // ---------------------------------------------------------------------------
  // Loop body helpers
  // ---------------------------------------------------------------------------

  emitLoopBody(body) {
    if (!Array.isArray(body)) return `{ ${this.emit(body, 'statement')}; }`;
    if (body[0] === 'block' || Array.isArray(body[0])) {
      let stmts = body[0] === 'block' ? body.slice(1) : body;
      let lines = this.withIndent(() => stmts.map(s => {
        if (this.is(s, 'comprehension')) {
          let [, expr, iters, guards] = s;
          return this.indent() + this.emitComprehensionAsLoop(expr, iters, guards);
        }
        return this.indent() + this.addSemicolon(s, this.emit(s, 'statement'));
      }));
      return `{\n${lines.join('\n')}\n${this.indent()}}`;
    }
    return `{ ${this.emit(body, 'statement')}; }`;
  }

  emitLoopBodyWithGuard(body, guard) {
    let guardCond = this.unwrap(this.emit(guard, 'value'));
    if (!Array.isArray(body)) return `{ if (${guardCond}) ${this.emit(body, 'statement')}; }`;
    if (body[0] === 'block' || Array.isArray(body[0])) {
      let stmts = body[0] === 'block' ? body.slice(1) : body;
      let loopIndent = this.withIndent(() => this.indent());
      let guardCode = `if (${guardCond}) {\n`;
      let innerStmts = this.withIndent(() => {
        this.indentLevel++;
        let r = this.formatStatements(stmts);
        this.indentLevel--;
        return r;
      });
      let close = this.withIndent(() => this.indent() + '}');
      return `{\n${loopIndent}${guardCode}${innerStmts.join('\n')}\n${close}\n${this.indent()}}`;
    }
    return `{ if (${this.emit(guard, 'value')}) ${this.emit(body, 'statement')}; }`;
  }

  // ---------------------------------------------------------------------------
  // Comprehension helpers
  // ---------------------------------------------------------------------------

  emitComprehensionWithTarget(expr, iterators, guards, targetVar) {
    let code = '';
    if (!this._skipCompTargetInit) code += this.indent() + `${targetVar} = [];\n`;

    let hasCtrl = (node) => {
      if (typeof node === 'string' && (node === 'break' || node === 'continue')) return true;
      if (!Array.isArray(node)) return false;
      if (['break', 'continue', 'return', 'throw'].includes(node[0])) return true;
      if (node[0] === 'if') return node.slice(1).some(hasCtrl);
      return node.some(hasCtrl);
    };

    let emitBody = () => {
      let loopTypes = ['for-in', 'for-of', 'for-as', 'while', 'loop'];
      if (this.is(expr, 'block')) {
        for (let i = 0; i < expr.length - 1; i++) {
          let s = expr[i + 1], isLast = i === expr.length - 2;
          if (!isLast || hasCtrl(s) || (Array.isArray(s) && loopTypes.includes(s[0]))) {
            code += this.indent() + this.emit(s, 'statement') + ';\n';
          } else {
            code += this.indent() + `${targetVar}.push(${this.emit(s, 'value')});\n`;
          }
        }
      } else if (hasCtrl(expr)) {
        code += this.indent() + this.emit(expr, 'statement') + ';\n';
      } else {
        code += this.indent() + `${targetVar}.push(${this.emit(expr, 'value')});\n`;
      }
    };

    if (iterators.length === 1) {
      let [iterType, vars, iterable, stepOrOwn] = iterators[0];

      if (iterType === 'for-in') {
        let { header, setup } = this._forInHeader(vars, iterable, stepOrOwn);
        code += this.indent() + header + ' {\n';
        this.indentLevel++;
        if (setup) code += this.indent() + setup + '\n';
        if (guards?.length > 0) { code += this.indent() + `if (${guards.map(g => this.emit(g, 'value')).join(' && ')}) {\n`; this.indentLevel++; }
        emitBody();
        if (guards?.length > 0) { this.indentLevel--; code += this.indent() + '}\n'; }
        this.indentLevel--;
        code += this.indent() + '}\n';
        return code;
      }

      if (iterType === 'for-of') {
        let { header, own, vv, oc, kvp } = this._forOfHeader(vars, iterable, stepOrOwn);
        code += this.indent() + header + ' {\n';
        this.indentLevel++;
        if (own) code += this.indent() + `if (!Object.hasOwn(${oc}, ${kvp})) continue;\n`;
        if (vv) code += this.indent() + `let ${vv} = ${oc}[${kvp}];\n`;
        if (guards?.length > 0) { code += this.indent() + `if (${guards.map(g => this.emit(g, 'value')).join(' && ')}) {\n`; this.indentLevel++; }
        emitBody();
        if (guards?.length > 0) { this.indentLevel--; code += this.indent() + '}\n'; }
        this.indentLevel--;
        code += this.indent() + '}\n';
        return code;
      }

      if (iterType === 'for-as') {
        let { header } = this._forAsHeader(vars, iterable, stepOrOwn);
        code += this.indent() + header + ' {\n';
        this.indentLevel++;
        if (guards?.length > 0) { code += this.indent() + `if (${guards.map(g => this.emit(g, 'value')).join(' && ')}) {\n`; this.indentLevel++; }
        emitBody();
        if (guards?.length > 0) { this.indentLevel--; code += this.indent() + '}\n'; }
        this.indentLevel--;
        code += this.indent() + '}\n';
        return code;
      }
    }

    code = '';
    code += this.indent() + `${targetVar} = ${this.emit(['comprehension', expr, iterators, guards || []], 'value')};\n`;
    return code;
  }

  emitComprehensionAsLoop(expr, iterators, guards) {
    let code = '';
    let guardCond = guards?.length ? guards.map(g => this.emit(g, 'value')).join(' && ') : null;

    // Helper: emit the loop body with optional guard wrapping
    let emitBody = () => {
      if (guardCond) {
        code += this.indent() + `if (${guardCond}) {\n`;
        this.indentLevel++;
        code += this.indent() + this.emit(expr, 'statement') + ';\n';
        this.indentLevel--; code += this.indent() + '}\n';
      } else {
        code += this.indent() + this.emit(expr, 'statement') + ';\n';
      }
    };

    if (iterators.length === 1) {
      let [iterType, vars, iterable, stepOrOwn] = iterators[0];

      if (iterType === 'for-in') {
        let { header, setup } = this._forInHeader(vars, iterable, stepOrOwn);
        code += header + ' {\n';
        this.indentLevel++;
        if (setup) code += this.indent() + setup + '\n';
        emitBody();
        this.indentLevel--;
        code += this.indent() + '}';
        return code;
      }

      if (iterType === 'for-as') {
        let { header } = this._forAsHeader(vars, iterable, stepOrOwn);
        code += header + ' {\n';
        this.indentLevel++;
        emitBody();
        this.indentLevel--;
        code += this.indent() + '}';
        return code;
      }

      if (iterType === 'for-of') {
        let { header, own, vv, oc, kvp } = this._forOfHeader(vars, iterable, stepOrOwn);
        code += header + ' {\n';
        this.indentLevel++;
        if (own) code += this.indent() + `if (!Object.hasOwn(${oc}, ${kvp})) continue;\n`;
        if (vv) code += this.indent() + `let ${vv} = ${oc}[${kvp}];\n`;
        emitBody();
        this.indentLevel--;
        code += this.indent() + '}';
        return code;
      }
    }

    return this.emit(['comprehension', expr, iterators, guards], 'value');
  }

  // ---------------------------------------------------------------------------
  // If/switch expression helpers
  // ---------------------------------------------------------------------------

  emitIfElseWithEarlyReturns(ifStmt) {
    let [, condition, thenBranch, ...elseBranches] = ifStmt;
    return this.indent() + this.emitIfElseEarlyReturnsChain(condition, thenBranch, elseBranches);
  }

  // Recursive companion to emitIfElseWithEarlyReturns. Each branch body
  // is wrapped in braces with the last expression promoted to a return.
  emitIfElseEarlyReturnsChain(condition, thenBranch, elseBranches) {
    let code = `if (${this.emit(condition, 'value')}) {\n`;
    code += this.withIndent(() => this.emitBranchWithReturn(thenBranch));
    code += this.indent() + '}';
    for (let branch of elseBranches) {
      code += ' else ';
      if (this.is(branch, 'if')) {
        let [, nc, nt, ...ne] = branch;
        code += this.emitIfElseEarlyReturnsChain(nc, nt, ne);
      } else {
        code += '{\n';
        code += this.withIndent(() => this.emitBranchWithReturn(branch));
        code += this.indent() + '}';
      }
    }
    return code;
  }

  emitBranchWithReturn(branch) {
    branch = this.unwrapIfBranch(branch);
    let stmts = this.unwrapBlock(branch);
    let code = '';
    for (let i = 0; i < stmts.length; i++) {
      let isLast = i === stmts.length - 1, s = stmts[i];
      let h = Array.isArray(s) ? s[0] : null;
      let hasCtrl = h === 'return' || h === 'throw' || h === 'break' || h === 'continue';
      if (isLast && !hasCtrl) code += this.indent() + `return ${this.emit(s, 'value')};\n`;
      else code += this.indent() + this.emit(s, 'statement') + ';\n';
    }
    return code;
  }

  emitIfAsExpression(condition, thenBranch, elseBranches) {
    let needsIIFE = this.is(thenBranch, 'block') && thenBranch.length > 2 || this.hasStatementInBranch(thenBranch) ||
                   elseBranches.some(b => this.is(b, 'block') && b.length > 2 || this.hasStatementInBranch(b) || this.hasNestedMultiStatement(b));
    if (needsIIFE) {
      // Enclosed: condition, thenBranch, elseBranches
      let hasAwait = this.containsAwait(condition) || this.containsAwait(thenBranch) || elseBranches.some(b => this.containsAwait(b));
      return this.asyncIIFEOpen(hasAwait) + ' ' + this.emitIfChain(condition, thenBranch, elseBranches) + ' })()';
    }
    let thenExpr = this.extractExpression(this.unwrapIfBranch(thenBranch));
    let elseExpr = this.buildTernaryChain(elseBranches);
    let condCode = this.emit(condition, 'value');
    if ((this.is(condition, 'yield') || this.is(condition, 'await'))) condCode = `(${condCode})`;
    return `(${condCode} ? ${thenExpr} : ${elseExpr})`;
  }

  // Recursive emitter for `if / else if / else` chains in IIFE/value contexts.
  // Walks the right-recursive AST: ["if", cond, then, else?] where `else` may
  // itself be another `["if", ...]` for an elseif chain.
  emitIfChain(condition, thenBranch, elseBranches) {
    let code = `if (${this.emit(condition, 'value')}) ` + this.emitBlockWithReturns(thenBranch);
    for (let branch of elseBranches) {
      code += ' else ';
      if (this.is(branch, 'if')) {
        let [, nc, nt, ...ne] = branch;
        code += this.emitIfChain(nc, nt, ne);
      } else {
        code += this.emitBlockWithReturns(branch);
      }
    }
    return code;
  }

  emitIfAsStatement(condition, thenBranch, elseBranches) {
    let code = `if (${this.unwrap(this.emit(condition, 'value'))}) `;
    code += this.emit(this.unwrapIfBranch(thenBranch), 'statement');
    for (let branch of elseBranches) code += ` else ` + this.emit(this.unwrapIfBranch(branch), 'statement');
    return code;
  }

  emitSwitchCaseBody(body, context) {
    let code = '';
    let hasFlow = this.hasExplicitControlFlow(body);
    let stmts = this.unwrapBlock(body);
    if (hasFlow) {
      for (let s of stmts) code += this.indent() + this.emit(s, 'statement') + ';\n';
    } else if (context === 'value') {
      if (this.is(body, 'block') && body.length > 2) {
        for (let i = 0; i < stmts.length; i++) {
          if (i === stmts.length - 1) code += this.indent() + `return ${this.emit(stmts[i], 'value')};\n`;
          else code += this.indent() + this.emit(stmts[i], 'statement') + ';\n';
        }
      } else {
        code += this.indent() + `return ${this.extractExpression(body)};\n`;
      }
    } else {
      if (stmts.length === 1 && this.is(stmts[0], 'if') && !this.hasStatementInBranch(stmts[0]) && !this.hasNestedMultiStatement(stmts[0])) {
        let [_, condition, thenBranch, ...elseBranches] = stmts[0];
        let thenExpr = this.extractExpression(this.unwrapIfBranch(thenBranch));
        let elseExpr = this.buildTernaryChain(elseBranches);
        code += this.indent() + `(${this.unwrap(this.emit(condition, 'value'))} ? ${thenExpr} : ${elseExpr});\n`;
      } else if (this.is(body, 'block') && body.length > 1) {
        for (let s of stmts) code += this.indent() + this.emit(s, 'statement') + ';\n';
      } else {
        code += this.indent() + this.emit(body, 'statement') + ';\n';
      }
      code += this.indent() + 'break;\n';
    }
    return code;
  }

  emitSwitchAsIfChain(whens, defaultCase, context) {
    let code = '';
    for (let i = 0; i < whens.length; i++) {
      let [, test, body] = whens[i];
      let cond = Array.isArray(test) ? test[0] : test;
      code += (i === 0 ? '' : ' else ') + `if (${this.emit(cond, 'value')}) {\n`;
      this.indentLevel++;
      if (context === 'value') code += this.indent() + `return ${this.extractExpression(body)};\n`;
      else for (let s of this.unwrapBlock(body)) code += this.indent() + this.emit(s, 'statement') + ';\n';
      this.indentLevel--;
      code += this.indent() + '}';
    }
    if (defaultCase) {
      code += ' else {\n';
      this.indentLevel++;
      if (context === 'value') code += this.indent() + `return ${this.extractExpression(defaultCase)};\n`;
      else for (let s of this.unwrapBlock(defaultCase)) code += this.indent() + this.emit(s, 'statement') + ';\n';
      this.indentLevel--;
      code += this.indent() + '}';
    }
    if (context === 'value') {
      let hasAwait = whens.some(w => this.containsAwait(w[1]) || this.containsAwait(w[2])) || (defaultCase && this.containsAwait(defaultCase));
      return this.asyncIIFE(hasAwait, code);
    }
    return code;
  }

  // ---------------------------------------------------------------------------
  // Async IIFE helpers
  // ---------------------------------------------------------------------------

  asyncIIFE(hasAwait, body) {
    let prefix = hasAwait ? 'await ' : '';
    let async_ = hasAwait ? 'async ' : '';
    return `${prefix}(${async_}() => { ${body} })()`;
  }

  asyncIIFEOpen(hasAwait) {
    let prefix = hasAwait ? 'await ' : '';
    let async_ = hasAwait ? 'async ' : '';
    return `${prefix}(${async_}() => {`;
  }

  // ---------------------------------------------------------------------------
  // Utility methods
  // ---------------------------------------------------------------------------

  extractExpression(branch) {
    let stmts = this.unwrapBlock(branch);
    return stmts.length > 0 ? this.emit(stmts[stmts.length - 1], 'value') : 'undefined';
  }

  unwrapBlock(body) {
    if (!Array.isArray(body)) return [body];
    if (body[0] === 'block') return body.slice(1);
    if (Array.isArray(body[0])) {
      if (typeof body[0][0] === 'string') return [body];
      return body;
    }
    return [body];
  }

  indent() { return this.indentString.repeat(this.indentLevel); }

  needsSemicolon(stmt, generated) {
    if (!generated || generated.endsWith(';')) return false;
    if (!generated.endsWith('}')) return true;
    let h = Array.isArray(stmt) ? stmt[0] : null;
    return !['def', 'class', 'if', 'for-in', 'for-of', 'for-as', 'while', 'loop', 'switch', 'try'].includes(h);
  }

  addSemicolon(stmt, generated) { return generated + (this.needsSemicolon(stmt, generated) ? ';' : ''); }

  formatStatements(stmts, context = 'statement') {
    return stmts.map(s => this.indent() + this.addSemicolon(s, this.emit(s, context)));
  }

  wrapForCondition(code) {
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(code)) return code;
    if (code.startsWith('(') && code.endsWith(')')) return code;
    return `(${code})`;
  }

  hasExplicitControlFlow(body) {
    if (!Array.isArray(body)) return false;
    let t = body[0];
    if (t === 'return' || t === 'throw' || t === 'break' || t === 'continue') return true;
    if (t === 'block') return body.slice(1).some(s => Array.isArray(s) && ['return', 'throw', 'break', 'continue'].includes(s[0]));
    if (t === 'switch') {
      let [, , whens] = body;
      return whens?.some(w => {
        let stmts = this.unwrapBlock(w[2]);
        return stmts.some(s => Array.isArray(s) && ['return', 'throw', 'break', 'continue'].includes(s[0]));
      });
    }
    if (t === 'if') {
      let [, , thenB, elseB] = body;
      return this.branchHasControlFlow(thenB) && elseB && this.branchHasControlFlow(elseB);
    }
    return false;
  }

  branchHasControlFlow(branch) {
    if (!Array.isArray(branch)) return false;
    let stmts = this.unwrapBlock(branch);
    if (stmts.length === 0) return false;
    let last = stmts[stmts.length - 1];
    return Array.isArray(last) && ['return', 'throw', 'break', 'continue'].includes(last[0]);
  }

  withIndent(callback) {
    this.indentLevel++;
    let result = callback();
    this.indentLevel--;
    return result;
  }

  // S-expression pattern match: is(node, op, arity?) → args or null
  // is(node, '-', 1) on ["-", 5]         → [5]
  // is(node, '[]', 2) on ["[]", a, b]    → [a, b]
  // is(node, 'block') on ["block", ...]   → [...]
  // is("x", '-', 1)                       → null
  is(node, op, arity) {
    if (!Array.isArray(node)) return null;
    if ((str(node[0]) ?? node[0]) !== op) return null;
    let args = node.slice(1);
    if (arity != null && args.length !== arity) return null;
    return args;
  }

  unwrap(code) {
    if (typeof code !== 'string') return code;
    while (code.startsWith('(') && code.endsWith(')')) {
      let pd = 0, bd = 0, canUnwrap = true, hasComma = false;
      for (let i = 0; i < code.length; i++) {
        if (code[i] === '(') pd++;
        if (code[i] === ')') pd--;
        if (code[i] === '[' || code[i] === '{') bd++;
        if (code[i] === ']' || code[i] === '}') bd--;
        if (code[i] === ',' && pd === 1 && bd === 0) hasComma = true;
        if (pd === 0 && i < code.length - 1) { canUnwrap = false; break; }
      }
      if (hasComma) canUnwrap = false;
      if (canUnwrap) code = code.slice(1, -1);
      else break;
    }
    return code;
  }

  _findOptionalInTarget(node) {
    if (!Array.isArray(node)) return null;
    if (node[0] === '?.') return { guard: node[1], rewritten: ['.', node[1], node[2]] };
    if (node[0] === 'optindex') return { guard: node[1], rewritten: ['[]', node[1], node[2]] };
    if (node[0] === '.' || node[0] === '[]') {
      let inner = this._findOptionalInTarget(node[1]);
      if (inner) return { guard: inner.guard, rewritten: [node[0], inner.rewritten, node[2]] };
    }
    return null;
  }

  // Walk a destructuring LHS and reject shapes that aren't valid binding
  // patterns. `null` array elements are elision (valid). Identifiers are
  // strings and parse as leaves. Member-access (`obj.x`) and bracket-index
  // (`arr[i]`) shapes are valid as assignment targets. Optional chains
  // (`obj?.x`, `arr?.[i]`) are NOT valid in JS destructuring assignment
  // targets, so we reject them. Comprehensions, arithmetic, calls, etc.
  // are unconditionally rejected.
  _validateBindingPattern(node, sexpr) {
    if (!Array.isArray(node)) return;
    let head = node[0];
    if (head === 'comprehension' || head === 'object-comprehension') {
      this.error(`Cannot use ${head} as a destructuring target`, sexpr);
    }
    if (head === 'array') {
      for (let elem of node.slice(1)) this._validateBindingPattern(elem, sexpr);
      return;
    }
    if (head === 'object') {
      // Object entry shapes used by the grammar:
      //   [null, k, k]      — shorthand {x}; both slots are the same identifier
      //   [":", k, target]  — rename {a: target}; recurse into target
      //   ["=", k, default] — default {a = 5}; key is identifier, default is RHS
      //   ["...", target]   — rest {...rest}; recurse into target
      // Anything else is unexpected; fail loudly so future grammar additions
      // can't silently pass through unvalidated.
      for (let entry of node.slice(1)) {
        if (!Array.isArray(entry)) continue;
        let h = entry[0];
        if (h === null) {
          // Shorthand {x}: target is entry[2], which must be a bare identifier
          // (validated by the array-leaf rules below).
          this._validateBindingPattern(entry[2], sexpr);
        } else if (h === ':') {
          this._validateBindingPattern(entry[2], sexpr);
        } else if (h === '=') {
          // Default {a = 5}: key (entry[1]) is the binding target.
          this._validateBindingPattern(entry[1], sexpr);
        } else if (h === '...') {
          this._validateBindingPattern(entry[1], sexpr);
        } else {
          this.error(`Unexpected object entry '${h}' in destructuring target`, sexpr);
        }
      }
      return;
    }
    // Wrapper shapes that contain a nested target.
    if (head === '...' || head === 'default' || head === '=') {
      this._validateBindingPattern(node[1], sexpr);
      return;
    }
    // Member access and bracket index are valid assignment targets.
    if (head === '.' || head === '[]') return;
    // Optional chains are NOT valid in JS destructuring-assignment context
    // (only in optional-chain GET expressions). Reject explicitly.
    if (head === '?.' || head === 'optindex' || head === 'optcall') {
      this.error(`Cannot use optional chain as a destructuring target`, sexpr);
    }
    // Anything else is an expression that isn't a destructuring shape.
    this.error(`Cannot use '${head}' expression as a destructuring target`, sexpr);
  }

  unwrapLogical(code) {
    if (typeof code !== 'string') return code;
    while (code.startsWith('(') && code.endsWith(')')) {
      let depth = 0, minDepth = Infinity;
      for (let i = 1; i < code.length - 1; i++) {
        if (code[i] === '(') depth++;
        if (code[i] === ')') depth--;
        minDepth = Math.min(minDepth, depth);
      }
      if (minDepth >= 0) code = code.slice(1, -1);
      else break;
    }
    return code;
  }

  unwrapIfBranch(branch) {
    if (Array.isArray(branch) && branch.length === 1 && (!Array.isArray(branch[0]) || branch[0][0] !== 'block')) return branch[0];
    return branch;
  }

  flattenBinaryChain(sexpr) {
    if (!Array.isArray(sexpr) || sexpr.length < 3) return sexpr;
    let [head, ...rest] = sexpr;
    if (head !== '&&' && head !== '||') return sexpr;
    let ops = [];
    let collect = (expr) => {
      if (Array.isArray(expr) && expr[0] === head) { for (let i = 1; i < expr.length; i++) collect(expr[i]); }
      else ops.push(expr);
    };
    for (let op of rest) collect(op);
    return [head, ...ops];
  }

  hasStatementInBranch(branch) {
    if (!Array.isArray(branch)) return false;
    if (branch.length === 1 && Array.isArray(branch[0])) return this.hasStatementInBranch(branch[0]);
    let h = branch[0];
    if (h === 'return' || h === 'throw' || h === 'break' || h === 'continue') return true;
    if (h === 'block') return branch.slice(1).some(s => this.hasStatementInBranch(s));
    return false;
  }

  hasNestedMultiStatement(branch) {
    if (!Array.isArray(branch)) return false;
    if (branch[0] === 'if') {
      let [_, cond, then_, ...elseB] = branch;
      return this.is(then_, 'block') && then_.length > 2 || elseB.some(b => this.hasNestedMultiStatement(b));
    }
    return false;
  }

  // Walk the right-recursive AST emitting nested ternaries. `branches` is the
  // tail of an `if` s-expression — either empty (no else) or one element
  // (the else, which may itself be another `["if", ...]`).
  buildTernaryChain(branches) {
    if (branches.length === 0) return 'undefined';
    let branch = this.unwrapIfBranch(branches[0]);
    if (this.is(branch, 'if')) {
      let [, cond, then_, ...rest] = branch;
      let thenPart = this.extractExpression(this.unwrapIfBranch(then_));
      let elsePart = this.buildTernaryChain(rest);
      return `(${this.emit(cond, 'value')} ? ${thenPart} : ${elsePart})`;
    }
    return this.extractExpression(branch);
  }

  // ---------------------------------------------------------------------------
  // Variable collection helpers
  // ---------------------------------------------------------------------------

  collectVarsFromArray(arr, varSet) {
    arr.slice(1).forEach(item => {
      if (item === ',' || item === '...') return;
      if (typeof item === 'string') { varSet.add(item); return; }
      if (Array.isArray(item)) {
        if (item[0] === '...' && typeof item[1] === 'string') varSet.add(item[1]);
        else if (item[0] === '=' && typeof item[1] === 'string') varSet.add(item[1]);
        else if (item[0] === 'array') this.collectVarsFromArray(item, varSet);
        else if (item[0] === 'object') this.collectVarsFromObject(item, varSet);
      }
    });
  }

  // Collect names bound by a for-in / for-of / for-as head. `vars` is the
  // second slot of the loop s-expression and always arrives as an array of
  // entries — e.g. ['x'], ['x', 'i'], ['k', 'v'], [['array', 'a', 'b']],
  // or [undefined] for no-var range loops.
  collectVarsFromLoopHead(vars, varSet) {
    if (!Array.isArray(vars)) return;
    vars.forEach(v => {
      if (v == null) return;
      if (typeof v === 'string') { varSet.add(v); return; }
      if (Array.isArray(v)) {
        if (v[0] === 'array') this.collectVarsFromArray(v, varSet);
        else if (v[0] === 'object') this.collectVarsFromObject(v, varSet);
      }
    });
  }

  collectVarsFromObject(obj, varSet) {
    obj.slice(1).forEach(pair => {
      if (!Array.isArray(pair)) return;
      if (pair[0] === '...' && typeof pair[1] === 'string') { varSet.add(pair[1]); return; }
      if (pair.length >= 2) {
        let [operator, key, value] = pair;
        if (operator === '=') { if (typeof key === 'string') varSet.add(key); }
        else {
          if (typeof value === 'string') varSet.add(value);
          else if (Array.isArray(value)) {
            if (value[0] === 'array') this.collectVarsFromArray(value, varSet);
            else if (value[0] === 'object') this.collectVarsFromObject(value, varSet);
          }
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // String processing
  // ---------------------------------------------------------------------------

  extractStringContent(strObj) {
    let content = str(strObj).slice(1, -1);
    let indent = meta(strObj, 'indent');
    if (indent) content = content.replace(new RegExp(`\\n${indent}`, 'g'), '\n');
    if (meta(strObj, 'initialChunk') && content.startsWith('\n')) content = content.slice(1);
    if (meta(strObj, 'finalChunk') && content.endsWith('\n')) content = content.slice(0, -1);
    return content;
  }

  processHeregex(content) {
    let result = '', inCharClass = false, i = 0;
    let isEscaped = () => {
      let c = 0, j = i - 1;
      while (j >= 0 && content[j] === '\\') { c++; j--; }
      return c % 2 === 1;
    };
    while (i < content.length) {
      let ch = content[i];
      if (ch === '[' && !isEscaped()) { inCharClass = true; result += ch; i++; continue; }
      if (ch === ']' && inCharClass && !isEscaped()) { inCharClass = false; result += ch; i++; continue; }
      if (inCharClass) { result += ch; i++; continue; }
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '#') {
        if (isEscaped()) { result += ch; i++; continue; }
        let j = i - 1;
        while (j >= 0 && content[j] === '\\') j--;
        if (j < i - 1) { result += ch; i++; continue; }
        while (i < content.length && content[i] !== '\n') i++;
        continue;
      }
      result += ch; i++;
    }
    return result;
  }

  addJsExtensionAndAssertions(source) {
    if (source instanceof String) source = str(source);
    if (typeof source !== 'string') return source;
    let hasQuotes = source.startsWith('"') || source.startsWith("'");
    let path = hasQuotes ? source.slice(1, -1) : source;
    let isLocal = path.startsWith('./') || path.startsWith('../');
    let finalPath = path, assertion = '';
    if (isLocal) {
      let lastSlash = path.lastIndexOf('/');
      let fileName = lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
      let hasExt = fileName.includes('.');
      if (hasExt) { if (fileName.endsWith('.json')) assertion = " with { type: 'json' }"; }
      else finalPath = path + '.js';
    }
    return `'${finalPath}'` + assertion;
  }

  containsIt(sexpr) {
    if (!sexpr) return false;
    if (sexpr === 'it' || (sexpr instanceof String && str(sexpr) === 'it')) return true;
    if (typeof sexpr !== 'object') return false;
    if (this.is(sexpr, 'def') || this.is(sexpr, '->') || this.is(sexpr, '=>')) return false;
    if (Array.isArray(sexpr)) return sexpr.some(item => this.containsIt(item));
    return false;
  }

  containsAwait(sexpr) {
    if (!sexpr) return false;
    if (sexpr instanceof String && meta(sexpr, 'await') === true) return true;
    if (typeof sexpr !== 'object') return false;
    if (this.is(sexpr, 'await')) return true;
    if (this.is(sexpr, 'for-as') && sexpr[3] === true) return true;
    if ((this.is(sexpr, 'def') || this.is(sexpr, '->') || this.is(sexpr, '=>') || this.is(sexpr, 'class'))) return false;
    if (Array.isArray(sexpr)) return sexpr.some(item => this.containsAwait(item));
    return false;
  }

  containsYield(sexpr) {
    if (!sexpr) return false;
    if (typeof sexpr !== 'object') return false;
    if ((this.is(sexpr, 'yield') || this.is(sexpr, 'yield-from'))) return true;
    if ((this.is(sexpr, 'def') || this.is(sexpr, '->') || this.is(sexpr, '=>') || this.is(sexpr, 'class'))) return false;
    if (Array.isArray(sexpr)) return sexpr.some(item => this.containsYield(item));
    return false;
  }

  // Class helpers
  extractMemberName(mk) {
    if (this.is(mk, '.') && mk[1] === 'this') return mk[2];
    if (this.is(mk, 'computed')) return `[${this.emit(mk[1], 'value')}]`;
    return mk;
  }

  // ---------------------------------------------------------------------------
  // Reactive Runtime (injected inline when reactive operators are used)
  // ---------------------------------------------------------------------------

  getReactiveRuntime() {
    return `// ============================================================================
// Rip Reactive Runtime
// A minimal, fine-grained reactivity system
//
// Reactivity:
//   __state(value)     - Reactive state container
//   __computed(fn)     - Computed value (lazy, cached)
//   __effect(fn)       - Side effect that re-runs when dependencies change
//   __batch(fn)        - Group multiple updates into one flush
//   __readonly(value)  - Immutable value wrapper
//
// Error Handling:
//   __catchErrors(fn)  - Wrap function to route errors to handler
//   __handleError(err) - Route error to handler
//
// How reactivity works:
//   - Reading a state/computed inside an effect tracks it as a dependency
//   - Writing to a state notifies all subscribers
//   - Batching defers effect execution until the batch completes
// ============================================================================

// Global state for dependency tracking
let __currentEffect = null;   // The effect/computed currently being evaluated
let __pendingEffects = new Set();  // Effects queued to run
let __batching = false;       // Are we inside a batch()?

// Flush all pending effects (called after state updates, or at end of batch)
// Defense in depth: skip disposed effects. The primary guard is in
// effect.run() itself — but filtering here avoids even calling .run() on
// a known-dead effect, which is faster and clearer in stack traces.
function __flushEffects() {
  const effects = [...__pendingEffects];
  __pendingEffects.clear();
  for (const effect of effects) {
    if (!effect._disposed) effect.run();
  }
}

// Shared primitive coercion (used by state and computed)
const __primitiveCoercion = {
  valueOf() { return this.value; },
  toString() { return String(this.value); },
  [Symbol.toPrimitive](hint) { return hint === 'string' ? this.toString() : this.valueOf(); }
};

function __state(initialValue) {
  if (initialValue != null && typeof initialValue === 'object' && typeof initialValue.read === 'function') return initialValue;
  let value = initialValue;
  const subscribers = new Set();
  let notifying = false;
  let locked = false;
  let dead = false;

  const state = {
    get value() {
      if (dead) return value;
      if (__currentEffect) {
        subscribers.add(__currentEffect);
        __currentEffect.dependencies.add(subscribers);
      }
      return value;
    },

    set value(newValue) {
      if (dead || locked || newValue === value || notifying) return;
      value = newValue;
      notifying = true;
      for (const sub of subscribers) {
        if (sub.markDirty) sub.markDirty();
        else __pendingEffects.add(sub);
      }
      if (!__batching) __flushEffects();
      notifying = false;
    },

    read() { return value; },
    touch() {
      if (dead || notifying) return;
      notifying = true;
      for (const sub of subscribers) {
        if (sub.markDirty) sub.markDirty();
        else __pendingEffects.add(sub);
      }
      if (!__batching) __flushEffects();
      notifying = false;
    },
    lock() { locked = true; return state; },
    free() { subscribers.clear(); return state; },
    kill() { dead = true; subscribers.clear(); return value; },

    ...__primitiveCoercion
  };
  return state;
}

function __computed(fn) {
  let value;
  let dirty = true;
  const subscribers = new Set();
  let locked = false;
  let dead = false;

  const computed = {
    dependencies: new Set(),

    markDirty() {
      if (dead || locked || dirty) return;
      dirty = true;
      for (const sub of subscribers) {
        if (sub.markDirty) sub.markDirty();
        else __pendingEffects.add(sub);
      }
    },

    get value() {
      if (dead) return value;
      if (__currentEffect) {
        subscribers.add(__currentEffect);
        __currentEffect.dependencies.add(subscribers);
      }
      if (dirty && !locked) {
        for (const dep of computed.dependencies) dep.delete(computed);
        computed.dependencies.clear();
        const prev = __currentEffect;
        __currentEffect = computed;
        try { value = fn(); } finally { __currentEffect = prev; }
        dirty = false;
      }
      return value;
    },

    read() { return value; },
    lock() { locked = true; computed.value; return computed; },
    free() {
      for (const dep of computed.dependencies) dep.delete(computed);
      computed.dependencies.clear();
      subscribers.clear();
      return computed;
    },
    kill() {
      dead = true;
      const result = value;
      computed.free();
      return result;
    },

    ...__primitiveCoercion
  };
  return computed;
}

function __effect(fn, opts) {
  let controller = null;
  let runId = 0;        // increments per run; async resolutions check this to drop stale results
  const effect = {
    dependencies: new Set(),
    _disposed: false,
    signal: null,    // AbortSignal for the current run; aborts on re-run / dispose

    run() {
      // Zombie-run guard. An effect can be queued in __pendingEffects
      // (when a signal it subscribes to changes) and then disposed
      // before the flush reaches it — e.g. its parent block was
      // destroyed by an earlier effect in the same flush, and that
      // destruction's disposers ran effect.dispose(). Without this
      // guard, run() would execute fn() with __currentEffect = effect,
      // and any signal .value read inside fn() would re-subscribe the
      // effect by adding it back to the signal's subscribers Set —
      // accumulating one leaked subscriber per flush cycle that hits
      // this race. Symptom: each navigation creates one more component
      // instance than the previous (N visits => N synchronous mounts
      // on visit N).
      if (effect._disposed) return;
      // Abort the previous run's signal before allocating a new one.
      // Any async work from the previous run that's still mid-flight
      // (an await fetch with the signal, for example) sees its signal
      // go aborted and can bail. This also fires the 'abort' event on
      // the previous signal so user code subscribed via
      // signal.addEventListener can run.
      if (controller) {
        try { controller.abort(); } catch {}
      }
      controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      effect.signal = controller ? controller.signal : null;
      // Per-run id captured by the closures below. When the effect
      // re-runs (signal changed) while a prior async body is still
      // awaiting, the prior body's eventual resolution sees myRun !==
      // runId and bails — preventing stale cleanup from overwriting
      // the current run's cleanup.
      const myRun = ++runId;

      if (effect._cleanup) { effect._cleanup(); effect._cleanup = null; }
      for (const dep of effect.dependencies) dep.delete(effect);
      effect.dependencies.clear();
      const prev = __currentEffect;
      __currentEffect = effect;
      try {
        const result = fn();
        if (typeof result === 'function') {
          effect._cleanup = result;
        } else if (result && typeof result.then === 'function') {
          // Async effect body. We can't unwind a pending await, but we
          // CAN intercept the eventual resolution and decide whether
          // to honor any cleanup it returned. Two failure modes are
          // handled:
          //   - Effect disposed while body was awaiting: run cleanup
          //     immediately so resources release, but don't store it.
          //   - Effect re-ran (newer run superseded this one): same.
          // In both cases we do NOT touch effect._cleanup, which now
          // belongs to a different run.
          result.then(
            (cleanup) => {
              if (myRun !== runId || effect._disposed) {
                if (typeof cleanup === 'function') {
                  try { cleanup(); }
                  catch (e) { console.error('[Rip] superseded async cleanup error:', e); }
                }
                return;
              }
              if (typeof cleanup === 'function') effect._cleanup = cleanup;
            },
            (err) => {
              // AbortError from a dispose or supersede is expected
              // (the user passed our signal to fetch/etc. and it
              // aborted). Swallow silently.
              if (err && err.name === 'AbortError') return;
              // Stale rejection from a superseded run: caller has
              // already moved on, no point surfacing.
              if (myRun !== runId || effect._disposed) return;
              console.error('[Rip] async effect error:', err);
            }
          );
        }
      } finally { __currentEffect = prev; }
    },

    dispose() {
      // Idempotent: a parent disposer chain may legitimately reach the
      // same effect twice in tangled cleanup paths. Quick exit avoids
      // re-running cleanup and re-walking already-empty dependencies.
      if (effect._disposed) return;
      effect._disposed = true;
      // Proactive pending-set eviction. The flush-time guard in
      // __flushEffects also handles this, but pulling the effect out
      // of __pendingEffects here keeps the set bounded across long
      // batched cycles and makes disposal semantics direct rather
      // than dependent on flush ordering.
      __pendingEffects.delete(effect);
      // Abort the current signal so any in-flight async work (a
      // user's fetch with the signal, a setTimeout-via-signal, etc.)
      // unwinds via AbortError and the body can bail without mutating
      // signals on a destroyed component.
      if (controller) {
        try { controller.abort(); } catch {}
      }
      if (effect._cleanup) { effect._cleanup(); effect._cleanup = null; }
      for (const dep of effect.dependencies) dep.delete(effect);
      effect.dependencies.clear();
    }
  };

  effect.run();
  const dispose = () => effect.dispose();
  // Auto-register with the current component (if any) so disposers fire
  // on component unmount. Without this, every __effect created inside a
  // component's _init / _setup / _create lived forever — its callback
  // stayed subscribed to its signals, the closure pinned the component,
  // and any DOM/event-listener cleanup the effect had returned never
  // fired. The bridge is intentionally cross-module: the reactive
  // runtime (this file) doesn't depend on components.js, but components.js
  // exposes a getter on globalThis.__ripComponent at registration time
  // and we read it lazily so module-load order is irrelevant.
  //
  // {skipRegister: true} opts out of auto-registration. Used by factory
  // blocks (for-loops, if-blocks in render) that maintain their own
  // local disposers array and call them via the d(detaching) hook.
  // Without skipRegister, those effects would be registered TWICE — once
  // in the local factory disposers and again on the parent component's
  // _disposers — leaking stale disposer references on every block
  // re-render until the parent itself unmounts.
  if (!opts || !opts.skipRegister) {
    const cur = globalThis.__ripComponent?.__getCurrentComponent?.();
    if (cur) (cur._disposers ??= []).push(dispose);
  }
  return dispose;
}

function __batch(fn) {
  if (__batching) return fn();
  __batching = true;
  try {
    return fn();
  } finally {
    __batching = false;
    __flushEffects();
  }
}

// Returns the AbortSignal of the currently-running effect, or null if
// called outside an effect or before AbortController is available.
// Designed for async-aware effect bodies — capture the signal BEFORE
// any await so it stays valid for the duration of the body:
//
//   (in Rip source)
//     ~>
//       signal = getEffectSignal()
//       data = fetch! url, {signal}
//       this.data = data
//
// On effect re-run or component unmount, the signal aborts; the
// fetch rejects with AbortError; the body unwinds without touching
// signals on a destroyed component.
function __getEffectSignal() {
  return __currentEffect ? __currentEffect.signal : null;
}

function __readonly(value) {
  return Object.freeze({ value });
}

// ============================================================================
// Error Handling
// ============================================================================

let __errorHandler = null;

function __setErrorHandler(handler) {
  const prev = __errorHandler;
  __errorHandler = handler;
  return prev;
}

function __handleError(error) {
  if (__errorHandler) {
    try {
      __errorHandler(error);
    } catch (handlerError) {
      console.error('Error in error handler:', handlerError);
      console.error('Original error:', error);
    }
  } else {
    throw error;
  }
}

function __catchErrors(fn) {
  return function(...args) {
    try {
      return fn.apply(this, args);
    } catch (error) {
      __handleError(error);
    }
  };
}

// Register on globalThis for runtime deduplication
if (typeof globalThis !== 'undefined') {
  globalThis.__rip = { __state, __computed, __effect, __batch, __readonly, __setErrorHandler, __handleError, __catchErrors, __getEffectSignal };
  // Stdlib-style global so user code can call getEffectSignal() in a
  // ~> body without importing or destructuring. Mirrors how p, pp,
  // assert, etc. are registered for ergonomic use.
  globalThis.getEffectSignal ??= __getEffectSignal;
}

// === End Reactive Runtime ===
`;
  }
}

// =============================================================================
// Compiler Class — Orchestrates the full pipeline
// =============================================================================

export class Compiler {
  constructor(options = {}) {
    this.options = { showTokens: false, showSExpr: false, ...options };
  }

  compile(source, options) {
    if (options) this.options = { ...this.options, ...options };

    // Handle __DATA__ marker
    let dataSection = null;
    let lines = source.split('\n');
    let dataLineIndex = lines.findIndex(line => line === '__DATA__');
    if (dataLineIndex !== -1) {
      let dataLines = lines.slice(dataLineIndex + 1);
      dataSection = dataLines.length > 0 ? dataLines.join('\n') + '\n' : '';
      source = lines.slice(0, dataLineIndex).join('\n');
    }

    // Step 1: Tokenize (includes rewriteTypes() via installTypeSupport)
    let lexer = new Lexer();
    let tokens;
    try {
      tokens = lexer.tokenize(source);
    } catch (err) {
      throw toRipError(err, source, this.options.filename);
    }
    if (this.options.showTokens) {
      tokens.forEach(t => console.log(`${t[0].padEnd(12)} ${JSON.stringify(t[1])}`));
      console.log();
    }

    // Save annotated tokens for deferred .d.ts emission (after parsing)
    let dts = null;
    let typeTokens = null;
    if (this.options.types === 'emit' || this.options.types === 'check' || this.options.types === true) {
      typeTokens = [...tokens];
    }

    // Remove TYPE_DECL markers — the parser doesn't know about them
    tokens = tokens.filter(t => t[0] !== 'TYPE_DECL');

    // Elide type-only imports — after type stripping, imported names that were
    // only used in type annotations no longer appear in the token stream.
    // The elision is per-specifier, not per-import: a single declaration like
    // `import { ApiErrors, parseError } from 'm'` where only `ApiErrors` is
    // type-only becomes `import { parseError } from 'm'`. If all named
    // specifiers drop and no default/namespace specifier remains, the whole
    // import is removed.
    //
    // A named specifier is "type-only" from the importing file's point of view
    // when its local binding is unused at runtime. That catches both
    // (a) names referenced solely in this file's type annotations (now in
    // typeRefNames) and (b) names imported only as types but never referenced
    // in this file at all — the exporting module strips its `export type` to
    // nothing, so leaving the specifier in place would cause a runtime
    // "module does not provide an export named X" error.
    if (lexer.typeRefNames?.size > 0) {
      let usedNames = new Set();
      let inImport = false;
      for (let t of tokens) {
        if (t[0] === 'IMPORT') { inImport = true; continue; }
        if (inImport && t[0] === 'TERMINATOR') { inImport = false; continue; }
        if (inImport) continue;
        if (t[0] === 'IDENTIFIER') usedNames.add(t[1]);
      }
      let isTypeOnly = (local) => !usedNames.has(local);
      for (let i = tokens.length - 1; i >= 0; i--) {
        if (tokens[i][0] !== 'IMPORT') continue;
        let j = i + 1;
        if (j >= tokens.length) continue;
        // Skip dynamic imports: import(expr)
        if (tokens[j][0] === 'CALL_START' || tokens[j][0] === '(') continue;
        // Skip side-effect imports: import 'module'
        if (tokens[j][0] === 'STRING') continue;
        // Find FROM / TERMINATOR bounds
        let fromIdx = -1, endIdx = j;
        while (endIdx < tokens.length && tokens[endIdx][0] !== 'TERMINATOR') {
          if (fromIdx === -1 && tokens[endIdx][0] === 'FROM') fromIdx = endIdx;
          endIdx++;
        }
        if (fromIdx === -1) continue;
        // Locate `{` / `}` for named specifiers
        let lbIdx = -1, rbIdx = -1;
        for (let k = i + 1; k < fromIdx; k++) {
          if (tokens[k][0] === '{') { lbIdx = k; break; }
        }
        if (lbIdx !== -1) {
          for (let k = lbIdx + 1; k < fromIdx; k++) {
            if (tokens[k][0] === '}') { rbIdx = k; break; }
          }
        }
        // Determine whether a default or namespace specifier exists outside the braces
        let hasOtherSpec = false;
        let scanEnd = lbIdx !== -1 ? lbIdx : fromIdx;
        for (let k = i + 1; k < scanEnd; k++) {
          let tag = tokens[k][0];
          if (tag === 'IDENTIFIER' || tag === '*') { hasOtherSpec = true; break; }
        }
        // No named specifiers — fall back to whole-import elision
        if (lbIdx === -1 || rbIdx === -1) {
          if (hasOtherSpec) {
            // Default / namespace import: collect outer local names
            let names = [];
            let k = i + 1;
            while (k < fromIdx) {
              if (tokens[k][0] === 'AS' && k + 1 < fromIdx && tokens[k + 1][0] === 'IDENTIFIER') {
                names.push(tokens[k + 1][1]); k += 2;
              } else if (tokens[k][0] === 'IDENTIFIER') {
                names.push(tokens[k][1]); k++;
              } else { k++; }
            }
            if (names.length === 0 || !names.every(isTypeOnly)) continue;
            let end = endIdx < tokens.length ? endIdx + 1 : endIdx;
            tokens.splice(i, end - i);
          }
          continue;
        }
        // Split brace contents into specifier ranges (start inclusive, end exclusive)
        // Each specifier is delimited by `,` at depth 0 (the `{}` themselves).
        let specs = [];
        let s = lbIdx + 1;
        while (s < rbIdx) {
          let e = s;
          while (e < rbIdx && tokens[e][0] !== ',') e++;
          if (e > s) specs.push({ start: s, end: e });
          s = e + 1;
        }
        // Determine local name per specifier (after `as` if present)
        for (let spec of specs) {
          let local = null;
          for (let k = spec.start; k < spec.end; k++) {
            if (tokens[k][0] !== 'IDENTIFIER') continue;
            if (local === null) local = tokens[k][1];
            else if (tokens[k - 1]?.[0] === 'AS') local = tokens[k][1];
          }
          spec.local = local;
          spec.drop = local != null && isTypeOnly(local);
        }
        let droppedAny = specs.some(s => s.drop);
        if (!droppedAny) continue;
        let allDropped = specs.every(s => s.drop);
        // Outer (default / namespace) local names — needed when all named drop
        let outerNames = [];
        if (allDropped && hasOtherSpec) {
          let k = i + 1;
          while (k < lbIdx) {
            if (tokens[k][0] === 'AS' && k + 1 < lbIdx && tokens[k + 1][0] === 'IDENTIFIER') {
              outerNames.push(tokens[k + 1][1]); k += 2;
            } else if (tokens[k][0] === 'IDENTIFIER') {
              outerNames.push(tokens[k][1]); k++;
            } else { k++; }
          }
        }
        // Splice from right to left to preserve indices
        if (allDropped) {
          if (!hasOtherSpec) {
            // Drop entire import
            let end = endIdx < tokens.length ? endIdx + 1 : endIdx;
            tokens.splice(i, end - i);
          } else if (outerNames.length > 0 && outerNames.every(isTypeOnly)) {
            // Outer specifiers are also type-only → drop whole import
            let end = endIdx < tokens.length ? endIdx + 1 : endIdx;
            tokens.splice(i, end - i);
          } else {
            // Remove `{ ... }` and the comma between default and `{`
            let removeStart = lbIdx, removeEnd = rbIdx + 1;
            // Strip a leading comma that separated default from `{`
            let k = lbIdx - 1;
            while (k > i && tokens[k][0] !== ',' && tokens[k][0] !== 'IDENTIFIER' && tokens[k][0] !== '*') k--;
            if (k > i && tokens[k][0] === ',') removeStart = k;
            tokens.splice(removeStart, removeEnd - removeStart);
          }
        } else {
          // Remove dropped specifiers individually, right-to-left, taking one adjacent comma
          for (let idx = specs.length - 1; idx >= 0; idx--) {
            let spec = specs[idx];
            if (!spec.drop) continue;
            let removeStart = spec.start, removeEnd = spec.end;
            // Prefer trailing comma; otherwise take leading comma
            if (removeEnd < rbIdx && tokens[removeEnd][0] === ',') {
              removeEnd++;
            } else if (removeStart > lbIdx + 1 && tokens[removeStart - 1][0] === ',') {
              removeStart--;
            }
            tokens.splice(removeStart, removeEnd - removeStart);
          }
        }
      }
    }

    // Strip leading terminators that may result from removed type declarations
    while (tokens.length > 0 && tokens[0][0] === 'TERMINATOR') {
      tokens.shift();
    }

    // If only terminators remain (type-only source), emit types and return early
    if (tokens.every(t => t[0] === 'TERMINATOR')) {
      if (typeTokens && _typesEmitter) dts = _typesEmitter(typeTokens, ['program'], source);
      return { tokens, sexpr: ['program'], code: '', dts, data: dataSection, reactiveVars: {} };
    }

    // Step 3: Parse — shim adapter wraps token values with metadata
    let lastLexedLoc = null;
    parser.lexer = {
      tokens, pos: 0,
      setInput: function() {},
      lex: function() {
        if (this.pos >= this.tokens.length) return 1;
        let token = this.tokens[this.pos++];
        let val = token[1];
        // Reconstruct new String() wrapping from .data for grammar compatibility
        if (token.data) {
          val = new String(val);
          Object.assign(val, token.data);
        }
        this.text = val;
        this.loc  = token.loc;
        this.line = token.loc?.r;
        lastLexedLoc = token.loc;
        return token[0];
      }
    };

    let sexpr;
    try {
      sexpr = parser.parse(source);
    } catch (err) {
      if (/\?\s*\([^)]*\?[^)]*:[^)]*\)\s*:/.test(source) || /\?\s+\w+\s+\?\s+/.test(source)) {
        throw new RipError('Nested ternary operators are not supported', {
          code: 'E_PARSE', source, file: this.options.filename,
          suggestion: 'Use if/else statements instead.',
          phase: 'parser',
        });
      }
      let re = toRipError(err, source, this.options.filename);
      if (re.phase === 'parser' && lastLexedLoc) {
        re.line = lastLexedLoc.r ?? re.line;
        re.column = lastLexedLoc.c ?? re.column;
        re.length = lastLexedLoc.n || 1;
      }
      throw re;
    }

    if (this.options.showSExpr) {
      console.log(formatSExpr(sexpr, 0, true));
      console.log();
    }

    // Step 4: Generate JavaScript
    let sourceMap = null;
    if (this.options.sourceMap) {
      let file = (this.options.filename || 'output') + '.js';
      let sourceFile = this.options.filename || 'input.rip';
      sourceMap = new SourceMapGenerator(file, sourceFile, source);
    }

    let generator = new CodeEmitter({
      dataSection,
      source,
      filename: this.options.filename,
      skipPreamble: this.options.skipPreamble,
      skipRuntimes: this.options.skipRuntimes,
      skipExports: this.options.skipExports,
      skipImports: this.options.skipImports,
      skipDataPart: this.options.skipDataPart,
      stubComponents: this.options.stubComponents,
      reactiveVars: this.options.reactiveVars,
      // Emit `name: T` inline on typed params so shadow TS in compileForCheck
      // sees annotations on every function-like position (top-level arrows,
      // class methods, object-literal method shorthand, nested functions).
      // Off by default — only set when producing input for the shadow TS pass.
      inlineTypes: this.options.inlineTypes,
      // Schema runtime mode: 'browser' / 'validate' / 'server' / 'migration'.
      // Default 'migration' covers the common case (CLI, server, tests) where
      // the user might call any schema feature including .toSQL(). The browser
      // bundle build script overrides to 'browser' for size reduction.
      schemaMode: this.options.schemaMode,
      sourceMap,
    });
    let code = generator.compile(sexpr);

    let map = sourceMap ? sourceMap.toJSON() : null;
    let reverseMap = sourceMap ? sourceMap.toReverseMap() : null;
    if (map && this.options.sourceMap === 'inline') {
      // map is already a JSON string (sourceMaps.toJSON() stringifies). UTF-8
      // safe encode: btoa() only handles Latin-1, so pre-encode non-ASCII via
      // TextEncoder before base64 in browsers. Bun's Buffer handles utf-8
      // directly. Source files containing emoji, em-dashes, accented chars,
      // etc. would otherwise break with `Failed to execute 'btoa'`.
      let b64;
      if (typeof Buffer !== 'undefined') {
        b64 = Buffer.from(map, 'utf8').toString('base64');
      } else {
        const bytes = new TextEncoder().encode(map);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        b64 = btoa(bin);
      }
      code += `\n//# sourceMappingURL=data:application/json;base64,${b64}`;
    } else if (map && this.options.filename) {
      code += `\n//# sourceMappingURL=${this.options.filename}.js.map`;
    }

    // Step 5: Emit .d.ts from annotated tokens + parsed s-expression
    if (typeTokens && _typesEmitter) {
      dts = _typesEmitter(typeTokens, sexpr, source);
    }

    return { tokens, sexpr, code, dts, map, reverseMap, data: dataSection, reactiveVars: generator.reactiveVars };
  }

  compileToJS(source) { return this.compile(source).code; }
  compileToSExpr(source) { return this.compile(source).sexpr; }
}

// =============================================================================
// Component Support (prototype installation)
// =============================================================================

installComponentSupport(CodeEmitter, Lexer);

// =============================================================================
// Enum Codegen (CodeEmitter method)
// =============================================================================
// `enum` blocks compile to a runtime JavaScript object that maps both
// forward (key → value) and reverse (value → key). This is real codegen,
// not type machinery, so it lives with the rest of the emitter dispatch.

CodeEmitter.prototype.emitEnum = function emitEnum(head, rest, context) {
  let [name, body] = rest;
  let enumName = name?.valueOf?.() ?? name;

  let pairs = [];
  if (Array.isArray(body)) {
    let items = body[0] === 'block' ? body.slice(1) : [body];
    for (let item of items) {
      if (Array.isArray(item)) {
        if (item[0]?.valueOf?.() === '=') {
          let key = item[1]?.valueOf?.() ?? item[1];
          let val = item[2]?.valueOf?.() ?? item[2];
          pairs.push([key, val]);
        }
      }
    }
  }

  if (pairs.length === 0) return `const ${enumName} = {}`;

  let forward = pairs.map(([k, v]) => `${k}: ${v}`).join(', ');
  let reverse = pairs.map(([k, v]) => `${v}: "${k}"`).join(', ');
  return `const ${enumName} = {${forward}, ${reverse}}`;
};

// =============================================================================
// Schema Support (prototype installation)
// =============================================================================

installSchemaSupport(null, CodeEmitter);

// =============================================================================
// Convenience Functions
// =============================================================================

export function compile(source, options = {}) {
  return new Compiler(options).compile(source);
}

export function compileToJS(source, options = {}) {
  return new Compiler(options).compileToJS(source);
}

export function emit(sexpr, options = {}) {
  return new CodeEmitter(options).compile(sexpr);
}

export function getReactiveRuntime() {
  return new CodeEmitter({}).getReactiveRuntime();
}

export function getComponentRuntime() {
  return new CodeEmitter({}).getComponentRuntime();
}

export { formatSExpr };
export { stringify, getStdlibCode };
export { RipError, toRipError, formatError, formatErrorHTML } from './error.js';
