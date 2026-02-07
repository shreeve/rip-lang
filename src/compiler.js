// Rip Compiler — S-expression → JavaScript
//
// Architecture: Lexer (tokenize) → Parser (parse) → CodeGenerator (compile) → JavaScript
//
// Metadata bridge: The lexer stores token metadata in .data objects. The Compiler
// class's lexer adapter reconstructs new String() wrapping so grammar actions pass
// metadata through s-expressions unchanged. Two helpers (meta/str) isolate all
// new String() awareness — when the parser gains native .data support, only these
// two functions change.

import { Lexer } from './lexer.js';
import { parser } from './parser.js';

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
  '&&', '||', '??', '!?', 'not',
  '&', '|', '^', '<<', '>>', '>>>',
  '=', '.', '?.', '[]',
  '!', 'typeof', 'void', 'delete', 'new',
  '...', 'rest', 'expansion', 'optindex', 'optcall',
]);

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

export class CodeGenerator {

  static ASSIGNMENT_OPS = new Set([
    '=', '+=', '-=', '*=', '/=', '?=', '&=', '|=', '^=', '%=',
    '**=', '??=', '&&=', '||=', '<<=', '>>=', '>>>='
  ]);

  static NUMBER_LITERAL_RE = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;
  static NUMBER_START_RE = /^-?\d/;

  // Dispatch table: s-expression head → method name
  static GENERATORS = {
    'program': 'generateProgram',

    // Logical (flatten chains)
    '&&': 'generateLogicalAnd',
    '||': 'generateLogicalOr',

    // Binary operators (shared)
    '+': 'generateBinaryOp', '-': 'generateBinaryOp', '*': 'generateBinaryOp',
    '/': 'generateBinaryOp', '%': 'generateBinaryOp', '**': 'generateBinaryOp',
    '==': 'generateBinaryOp', '===': 'generateBinaryOp', '!=': 'generateBinaryOp',
    '!==': 'generateBinaryOp', '<': 'generateBinaryOp', '>': 'generateBinaryOp',
    '<=': 'generateBinaryOp', '>=': 'generateBinaryOp', '??': 'generateBinaryOp',
    '!?': 'generateBinaryOp', '&': 'generateBinaryOp', '|': 'generateBinaryOp',
    '^': 'generateBinaryOp', '<<': 'generateBinaryOp', '>>': 'generateBinaryOp',
    '>>>': 'generateBinaryOp',

    // Special operators
    '%%': 'generateModulo',
    '//': 'generateFloorDiv',
    '//=': 'generateFloorDivAssign',
    '..': 'generateRange',

    // Assignment (shared)
    '=': 'generateAssignment',
    '+=': 'generateAssignment', '-=': 'generateAssignment', '*=': 'generateAssignment',
    '/=': 'generateAssignment', '%=': 'generateAssignment', '**=': 'generateAssignment',
    '&&=': 'generateAssignment', '||=': 'generateAssignment', '??=': 'generateAssignment',
    '?=': 'generateAssignment', '&=': 'generateAssignment', '|=': 'generateAssignment',
    '^=': 'generateAssignment', '<<=': 'generateAssignment', '>>=': 'generateAssignment',
    '>>>=': 'generateAssignment',

    '...': 'generateRange',
    '!': 'generateNot',
    '~': 'generateBitwiseNot',
    '++': 'generateIncDec',
    '--': 'generateIncDec',
    '=~': 'generateRegexMatch',
    'instanceof': 'generateInstanceof',
    'in': 'generateIn',
    'of': 'generateOf',
    'typeof': 'generateTypeof',
    'delete': 'generateDelete',
    'new': 'generateNew',

    // Data structures
    'array': 'generateArray',
    'object': 'generateObject',
    'block': 'generateBlock',

    // Property access
    '.': 'generatePropertyAccess',
    '?.': 'generateOptionalProperty',
    '[]': 'generateIndexAccess',
    'optindex': 'generateOptIndex',
    'optcall': 'generateOptCall',
    'regex-index': 'generateRegexIndex',

    // Functions
    'def': 'generateDef',
    '->': 'generateThinArrow',
    '=>': 'generateFatArrow',
    'return': 'generateReturn',

    // Reactive
    'state': 'generateState',
    'computed': 'generateComputed',
    'readonly': 'generateReadonly',
    'effect': 'generateEffect',

    // Control flow — simple
    'break': 'generateBreak',
    'break-if': 'generateBreakIf',
    'continue': 'generateContinue',
    'continue-if': 'generateContinueIf',
    '?': 'generateExistential',
    '?:': 'generateTernary',
    'loop': 'generateLoop',
    'await': 'generateAwait',
    'yield': 'generateYield',
    'yield-from': 'generateYieldFrom',

    // Control flow — complex
    'if': 'generateIf',
    'unless': 'generateIf',
    'for-in': 'generateForIn',
    'for-of': 'generateForOf',
    'for-as': 'generateForAs',
    'while': 'generateWhile',
    'until': 'generateUntil',
    'try': 'generateTry',
    'throw': 'generateThrow',
    'control': 'generateControl',
    'switch': 'generateSwitch',
    'when': 'generateWhen',

    // Comprehensions
    'comprehension': 'generateComprehension',
    'object-comprehension': 'generateObjectComprehension',

    // Classes
    'class': 'generateClass',
    'super': 'generateSuper',

    // Modules
    'import': 'generateImport',
    'export': 'generateExport',
    'export-default': 'generateExportDefault',
    'export-all': 'generateExportAll',
    'export-from': 'generateExportFrom',

    // Special forms
    'do-iife': 'generateDoIIFE',
    'regex': 'generateRegex',
    'tagged-template': 'generateTaggedTemplate',
    'str': 'generateString',
  };

  constructor(options = {}) {
    this.options = options;
    this.indentLevel = 0;
    this.indentString = '  ';
    this.comprehensionDepth = 0;
    this.dataSection = options.dataSection;
    if (options.reactiveVars) {
      this.reactiveVars = new Set(options.reactiveVars);
    }
  }

  // ---------------------------------------------------------------------------
  // Entry point
  // ---------------------------------------------------------------------------

  compile(sexpr) {
    this.programVars = new Set();
    this.functionVars = new Map();
    this.helpers = new Set();
    this.collectProgramVariables(sexpr);
    return this.generate(sexpr);
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

    if (head === 'readonly') return;

    if (CodeGenerator.ASSIGNMENT_OPS.has(head)) {
      let [target, value] = rest;
      if (typeof target === 'string' || target instanceof String) {
        let varName = str(target);
        if (!this.reactiveVars?.has(varName)) this.programVars.add(varName);
      } else if (Array.isArray(target) && target[0] === 'array') {
        this.collectVarsFromArray(target, this.programVars);
      } else if (Array.isArray(target) && target[0] === 'object') {
        this.collectVarsFromObject(target, this.programVars);
      }
      this.collectProgramVariables(value);
      return;
    }

    if (head === 'def' || head === '->' || head === '=>') return;

    if (head === 'if') {
      let [condition, thenBranch, elseBranch] = rest;
      this.collectProgramVariables(condition);
      this.collectProgramVariables(thenBranch);
      if (elseBranch) this.collectProgramVariables(elseBranch);
      return;
    }

    if (head === 'unless') {
      let [condition, body] = rest;
      this.collectProgramVariables(condition);
      this.collectProgramVariables(body);
      return;
    }

    if (head === 'try') {
      this.collectProgramVariables(rest[0]);
      if (rest.length >= 2 && Array.isArray(rest[1]) && rest[1].length === 2 && rest[1][0] !== 'block') {
        let [param, catchBlock] = rest[1];
        if (param && Array.isArray(param) && param[0] === 'object') {
          param.slice(1).forEach(pair => {
            if (Array.isArray(pair) && pair.length === 2 && typeof pair[1] === 'string') {
              this.programVars.add(pair[1]);
            }
          });
        } else if (param && Array.isArray(param) && param[0] === 'array') {
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
      if (CodeGenerator.ASSIGNMENT_OPS.has(head)) {
        let [target, value] = rest;
        if (typeof target === 'string') vars.add(target);
        else if (Array.isArray(target) && target[0] === 'array') this.collectVarsFromArray(target, vars);
        else if (Array.isArray(target) && target[0] === 'object') this.collectVarsFromObject(target, vars);
        collect(value);
        return;
      }
      if (head === 'def' || head === '->' || head === '=>') return;
      if (head === 'try') {
        collect(rest[0]);
        if (rest.length >= 2 && Array.isArray(rest[1]) && rest[1].length === 2 && rest[1][0] !== 'block') {
          let [param, catchBlock] = rest[1];
          if (param && Array.isArray(param) && param[0] === 'object') {
            param.slice(1).forEach(pair => {
              if (Array.isArray(pair) && pair.length === 2 && typeof pair[1] === 'string') vars.add(pair[1]);
            });
          } else if (param && Array.isArray(param) && param[0] === 'array') {
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

  // ---------------------------------------------------------------------------
  // Main dispatch
  // ---------------------------------------------------------------------------

  generate(sexpr, context = 'statement') {
    // String object with metadata (quote, await, predicate, heregex, etc.)
    if (sexpr instanceof String) {
      // Dammit operator (!)
      if (meta(sexpr, 'await') === true) {
        return `await ${str(sexpr)}()`;
      }

      // Existence check (?)
      if (meta(sexpr, 'predicate')) {
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
    if (!Array.isArray(sexpr)) throw new Error(`Invalid s-expression: ${JSON.stringify(sexpr)}`);

    let [head, ...rest] = sexpr;

    // Preserve await metadata before converting head to primitive
    let headAwaitMeta = meta(head, 'await');
    head = str(head);

    // Dispatch table
    let method = CodeGenerator.GENERATORS[head];
    if (method) return this[method](head, rest, context, sexpr);

    // ---- Function calls (dynamic — not in dispatch table) ----

    if (typeof head === 'string' && !head.startsWith('"') && !head.startsWith("'")) {
      if (CodeGenerator.NUMBER_START_RE.test(head)) return head;

      // super.methodName() in non-constructor methods
      if (head === 'super' && this.currentMethodName && this.currentMethodName !== 'constructor') {
        let args = rest.map(arg => this.unwrap(this.generate(arg, 'value'))).join(', ');
        return `super.${this.currentMethodName}(${args})`;
      }

      // Postfix if/unless on single-arg call
      if (context === 'statement' && rest.length === 1) {
        let cond = this.findPostfixConditional(rest[0]);
        if (cond) {
          let argWithout = this.rebuildWithoutConditional(cond);
          let callee = this.generate(head, 'value');
          let condCode = this.generate(cond.condition, 'value');
          let valCode = this.generate(argWithout, 'value');
          let callStr = `${callee}(${valCode})`;
          return cond.type === 'unless' ? `if (!${condCode}) ${callStr}` : `if (${condCode}) ${callStr}`;
        }
      }

      let needsAwait = headAwaitMeta === true;
      let calleeName = this.generate(head, 'value');
      let args = rest.map(arg => this.unwrap(this.generate(arg, 'value'))).join(', ');
      let callStr = `${calleeName}(${args})`;
      return needsAwait ? `await ${callStr}` : callStr;
    }

    // Statement sequence (comma operator)
    if (Array.isArray(head) && typeof head[0] === 'string') {
      let stmtOps = ['=', '+=', '-=', '*=', '/=', '%=', '**=', '&&=', '||=', '??=', 'if', 'unless', 'return', 'throw'];
      if (stmtOps.includes(head[0])) {
        let exprs = sexpr.map(stmt => this.generate(stmt, 'value'));
        return `(${exprs.join(', ')})`;
      }
    }

    // Complex callee (property access, index, etc.)
    if (Array.isArray(head)) {
      // Ruby-style: XXX.new(args) → new XXX(args)
      if (head[0] === '.' && (head[2] === 'new' || str(head[2]) === 'new')) {
        let ctorExpr = head[1];
        let ctorCode = this.generate(ctorExpr, 'value');
        let args = rest.map(arg => this.unwrap(this.generate(arg, 'value'))).join(', ');
        let needsParens = Array.isArray(ctorExpr);
        return `new ${needsParens ? `(${ctorCode})` : ctorCode}(${args})`;
      }

      // Postfix if/unless on single-arg method call
      if (context === 'statement' && rest.length === 1) {
        let cond = this.findPostfixConditional(rest[0]);
        if (cond) {
          let argWithout = this.rebuildWithoutConditional(cond);
          let calleeCode = this.generate(head, 'value');
          let condCode = this.generate(cond.condition, 'value');
          let valCode = this.generate(argWithout, 'value');
          let callStr = `${calleeCode}(${valCode})`;
          return cond.type === 'unless' ? `if (!${condCode}) ${callStr}` : `if (${condCode}) ${callStr}`;
        }
      }

      // Property access with await sigil on property
      let needsAwait = false;
      let calleeCode;
      if (head[0] === '.' && meta(head[2], 'await') === true) {
        needsAwait = true;
        let [obj, prop] = head.slice(1);
        let objCode = this.generate(obj, 'value');
        let needsParens = CodeGenerator.NUMBER_LITERAL_RE.test(objCode) ||
                          (Array.isArray(obj) && (obj[0] === 'object' || obj[0] === 'await' || obj[0] === 'yield'));
        let base = needsParens ? `(${objCode})` : objCode;
        calleeCode = `${base}.${str(prop)}`;
      } else {
        calleeCode = this.generate(head, 'value');
      }

      let args = rest.map(arg => this.unwrap(this.generate(arg, 'value'))).join(', ');
      let callStr = `${calleeCode}(${args})`;
      return needsAwait ? `await ${callStr}` : callStr;
    }

    throw new Error(`Unknown s-expression type: ${head}`);
  }

  // ---------------------------------------------------------------------------
  // Program
  // ---------------------------------------------------------------------------

  generateProgram(head, statements, context, sexpr) {
    let code = '';
    let imports = [], exports = [], other = [];

    for (let stmt of statements) {
      if (!Array.isArray(stmt)) { other.push(stmt); continue; }
      let h = stmt[0];
      if (h === 'import') imports.push(stmt);
      else if (h === 'export' || h === 'export-default' || h === 'export-all' || h === 'export-from') exports.push(stmt);
      else other.push(stmt);
    }

    // Generate body first to detect needed helpers
    let blockStmts = ['def', 'class', 'if', 'unless', 'for-in', 'for-of', 'for-as', 'while', 'until', 'loop', 'switch', 'try'];
    let statementsCode = other.map((stmt, index) => {
      let isSingle = other.length === 1 && imports.length === 0 && exports.length === 0;
      let isObj = Array.isArray(stmt) && stmt[0] === 'object';
      let isObjComp = isObj && stmt.length === 2 && Array.isArray(stmt[1]) && Array.isArray(stmt[1][1]) && stmt[1][1][0] === 'comprehension';
      let isAlreadyExpr = Array.isArray(stmt) && (stmt[0] === 'comprehension' || stmt[0] === 'object-comprehension' || stmt[0] === 'do-iife');
      let hasNoVars = this.programVars.size === 0;
      let needsParens = isSingle && isObj && hasNoVars && !isAlreadyExpr && !isObjComp;
      let isLast = index === other.length - 1;
      let isLastComp = isLast && isAlreadyExpr;

      let generated;
      if (needsParens) generated = `(${this.generate(stmt, 'value')})`;
      else if (isLastComp) generated = this.generate(stmt, 'value');
      else generated = this.generate(stmt, 'statement');

      if (generated && !generated.endsWith(';')) {
        let h = Array.isArray(stmt) ? stmt[0] : null;
        if (!blockStmts.includes(h) || !generated.endsWith('}')) return generated + ';';
      }
      return generated;
    }).join('\n');

    let needsBlank = false;

    if (imports.length > 0) {
      code += imports.map(s => this.addSemicolon(s, this.generate(s, 'statement'))).join('\n');
      needsBlank = true;
    }

    if (this.programVars.size > 0) {
      let vars = Array.from(this.programVars).sort().join(', ');
      if (needsBlank) code += '\n';
      code += `let ${vars};\n`;
      needsBlank = true;
    }

    if (this.helpers.has('slice'))      { code += 'const slice = [].slice;\n'; needsBlank = true; }
    if (this.helpers.has('modulo'))     { code += 'const modulo = (n, d) => { n = +n; d = +d; return (n % d + d) % d; };\n'; needsBlank = true; }
    if (this.helpers.has('toSearchable')) {
      code += 'const toSearchable = (v, allowNewlines) => {\n';
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

    if (this.usesReactivity && !this.options.skipReactiveRuntime) {
      code += this.getReactiveRuntime();
      needsBlank = true;
    }

    if (this.dataSection !== null && this.dataSection !== undefined) {
      code += 'var DATA;\n_setDataSection();\n';
      needsBlank = true;
    }

    if (needsBlank && code.length > 0) code += '\n';
    code += statementsCode;

    if (exports.length > 0) {
      code += '\n' + exports.map(s => this.addSemicolon(s, this.generate(s, 'statement'))).join('\n');
    }

    if (this.dataSection !== null && this.dataSection !== undefined) {
      code += `\n\nfunction _setDataSection() {\n  DATA = ${JSON.stringify(this.dataSection)};\n}`;
    }

    return code;
  }

  // ---------------------------------------------------------------------------
  // Binary operators
  // ---------------------------------------------------------------------------

  generateBinaryOp(op, rest, context, sexpr) {
    if ((op === '+' || op === '-') && rest.length === 1) {
      return `(${op}${this.generate(rest[0], 'value')})`;
    }
    let [left, right] = rest;
    if (op === '!?') {
      let l = this.generate(left, 'value'), r = this.generate(right, 'value');
      return `(${l} !== undefined ? ${l} : ${r})`;
    }
    if (op === '==') op = '===';
    if (op === '!=') op = '!==';
    return `(${this.generate(left, 'value')} ${op} ${this.generate(right, 'value')})`;
  }

  generateModulo(head, rest) {
    let [left, right] = rest;
    this.helpers.add('modulo');
    return `modulo(${this.generate(left, 'value')}, ${this.generate(right, 'value')})`;
  }

  generateFloorDiv(head, rest) {
    let [left, right] = rest;
    return `Math.floor(${this.generate(left, 'value')} / ${this.generate(right, 'value')})`;
  }

  generateFloorDivAssign(head, rest) {
    let [target, value] = rest;
    let t = this.generate(target, 'value'), v = this.generate(value, 'value');
    return `${t} = Math.floor(${t} / ${v})`;
  }

  // ---------------------------------------------------------------------------
  // Assignment
  // ---------------------------------------------------------------------------

  generateAssignment(head, rest, context, sexpr) {
    let [target, value] = rest;
    let op = head === '?=' ? '??=' : head;

    // Validate: no sigils in assignment targets (except void function syntax)
    let isFnValue = Array.isArray(value) && (value[0] === '->' || value[0] === '=>' || value[0] === 'def');
    if (target instanceof String && meta(target, 'await') !== undefined && !isFnValue) {
      let sigil = meta(target, 'await') === true ? '!' : '&';
      throw new Error(`Cannot use ${sigil} sigil in variable declaration '${str(target)}'.`);
    }

    if (target instanceof String && meta(target, 'await') === true && isFnValue) {
      this.nextFunctionIsVoid = true;
    }

    // Empty destructuring — just evaluate RHS
    let isEmptyArr = Array.isArray(target) && target[0] === 'array' && target.length === 1;
    let isEmptyObj = Array.isArray(target) && target[0] === 'object' && target.length === 1;
    if (isEmptyArr || isEmptyObj) {
      let v = this.generate(value, 'value');
      return (isEmptyObj && context === 'statement') ? `(${v})` : v;
    }

    // Control flow short-circuits: x = expr or return/throw
    if (Array.isArray(value) && op === '=' && value[0] === 'control') {
      let [, rawCtrlOp, expr, ctrlSexpr] = value;
      let ctrlOp = str(rawCtrlOp);
      let isReturn = ctrlSexpr[0] === 'return';
      let targetCode = this.generate(target, 'value');
      if (typeof target === 'string') this.programVars.add(target);
      let exprCode = this.generate(expr, 'value');
      let ctrlValue = ctrlSexpr.length > 1 ? ctrlSexpr[1] : null;
      let ctrlCode = isReturn
        ? (ctrlValue ? `return ${this.generate(ctrlValue, 'value')}` : 'return')
        : (ctrlValue ? `throw ${this.generate(ctrlValue, 'value')}` : 'throw new Error()');
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
    if (Array.isArray(target) && target[0] === 'array') {
      let restIdx = target.slice(1).findIndex(el => (Array.isArray(el) && el[0] === '...') || el === '...');
      if (restIdx !== -1 && restIdx < target.length - 2) {
        let elements = target.slice(1);
        let afterRest = elements.slice(restIdx + 1);
        let afterCount = afterRest.length;
        if (afterCount > 0) {
          let valueCode = this.generate(value, 'value');
          let beforeRest = elements.slice(0, restIdx);
          let beforePattern = beforeRest.map(el => el === ',' ? '' : typeof el === 'string' ? el : this.generate(el, 'value')).join(', ');
          let afterPattern = afterRest.map(el => el === ',' ? '' : typeof el === 'string' ? el : this.generate(el, 'value')).join(', ');
          this.helpers.add('slice');
          elements.forEach(el => {
            if (el === ',' || el === '...') return;
            if (typeof el === 'string') this.programVars.add(el);
            else if (Array.isArray(el) && el[0] === '...' && typeof el[1] === 'string') this.programVars.add(el[1]);
          });
          let restEl = elements[restIdx];
          let restVar = Array.isArray(restEl) && restEl[0] === '...' ? restEl[1] : null;
          let stmts = [];
          if (beforePattern) stmts.push(`[${beforePattern}] = ${valueCode}`);
          if (restVar) stmts.push(`[...${restVar}] = ${valueCode}.slice(${restIdx}, -${afterCount})`);
          stmts.push(`[${afterPattern}] = slice.call(${valueCode}, -${afterCount})`);
          return stmts.join(', ');
        }
      }
    }

    // Postfix if/unless on assignment with || operator
    if (context === 'statement' && head === '=' && Array.isArray(value) &&
        (value[0] === '||' || value[0] === '&&') && value.length === 3) {
      let [binOp, left, right] = value;
      if (Array.isArray(right) && (right[0] === 'unless' || right[0] === 'if') && right.length === 3) {
        let [condType, condition, wrappedValue] = right;
        let unwrapped = Array.isArray(wrappedValue) && wrappedValue.length === 1 ? wrappedValue[0] : wrappedValue;
        let fullValue = [binOp, left, unwrapped];
        let t = this.generate(target, 'value'), c = this.generate(condition, 'value'), v = this.generate(fullValue, 'value');
        return condType === 'unless' ? `if (!${c}) ${t} = ${v}` : `if (${c}) ${t} = ${v}`;
      }
    }

    // Postfix if/unless on simple assignment
    if (context === 'statement' && head === '=' && Array.isArray(value) && value.length === 3) {
      let [valHead, condition, actualValue] = value;
      let isPostfix = Array.isArray(actualValue) && actualValue.length === 1 &&
                      (!Array.isArray(actualValue[0]) || actualValue[0][0] !== 'block');
      if ((valHead === 'unless' || valHead === 'if') && isPostfix) {
        let unwrapped = Array.isArray(actualValue) && actualValue.length === 1 ? actualValue[0] : actualValue;
        let t = this.generate(target, 'value');
        let condCode = this.unwrapLogical(this.generate(condition, 'value'));
        let v = this.generate(unwrapped, 'value');
        if (valHead === 'unless') {
          if (condCode.includes(' ') || /[<>=&|]/.test(condCode)) condCode = `(${condCode})`;
          return `if (!${condCode}) ${t} = ${v}`;
        }
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
      this.suppressReactiveUnwrap = true;
      targetCode = this.generate(target, 'value');
      this.suppressReactiveUnwrap = false;
    }

    let valueCode = this.generate(value, 'value');
    let isObjLit = Array.isArray(value) && value[0] === 'object';
    if (!isObjLit) valueCode = this.unwrap(valueCode);

    let needsParensVal = context === 'value';
    let needsParensObj = context === 'statement' && Array.isArray(target) && target[0] === 'object';
    if (needsParensVal || needsParensObj) return `(${targetCode} ${op} ${valueCode})`;
    return `${targetCode} ${op} ${valueCode}`;
  }

  // ---------------------------------------------------------------------------
  // Property access
  // ---------------------------------------------------------------------------

  generatePropertyAccess(head, rest, context, sexpr) {
    let [obj, prop] = rest;
    this.suppressReactiveUnwrap = true;
    let objCode = this.generate(obj, 'value');
    this.suppressReactiveUnwrap = false;
    let needsParens = CodeGenerator.NUMBER_LITERAL_RE.test(objCode) ||
                      (Array.isArray(obj) && (obj[0] === 'object' || obj[0] === 'await' || obj[0] === 'yield'));
    let base = needsParens ? `(${objCode})` : objCode;
    if (meta(prop, 'await') === true) return `await ${base}.${str(prop)}()`;
    if (meta(prop, 'predicate')) return `(${base}.${str(prop)} != null)`;
    return `${base}.${str(prop)}`;
  }

  generateOptionalProperty(head, rest) {
    let [obj, prop] = rest;
    return `${this.generate(obj, 'value')}?.${prop}`;
  }

  generateRegexIndex(head, rest) {
    let [value, regex, captureIndex] = rest;
    this.helpers.add('toSearchable');
    this.programVars.add('_');
    let v = this.generate(value, 'value'), r = this.generate(regex, 'value');
    let idx = captureIndex !== null ? this.generate(captureIndex, 'value') : '0';
    let allowNL = r.includes('/m') ? ', true' : '';
    return `(_ = toSearchable(${v}${allowNL}).match(${r})) && _[${idx}]`;
  }

  generateIndexAccess(head, rest) {
    let [arr, index] = rest;
    if (Array.isArray(index) && (index[0] === '..' || index[0] === '...')) {
      let isIncl = index[0] === '..';
      let arrCode = this.generate(arr, 'value');
      let [start, end] = index.slice(1);
      if (start === null && end === null) return `${arrCode}.slice()`;
      if (start === null) {
        if (isIncl && this.isNegativeOneLiteral(end)) return `${arrCode}.slice(0)`;
        let e = this.generate(end, 'value');
        return isIncl ? `${arrCode}.slice(0, +${e} + 1 || 9e9)` : `${arrCode}.slice(0, ${e})`;
      }
      if (end === null) return `${arrCode}.slice(${this.generate(start, 'value')})`;
      let s = this.generate(start, 'value');
      if (isIncl && this.isNegativeOneLiteral(end)) return `${arrCode}.slice(${s})`;
      let e = this.generate(end, 'value');
      return isIncl ? `${arrCode}.slice(${s}, +${e} + 1 || 9e9)` : `${arrCode}.slice(${s}, ${e})`;
    }
    return `${this.generate(arr, 'value')}[${this.unwrap(this.generate(index, 'value'))}]`;
  }

  generateOptIndex(head, rest) {
    let [arr, index] = rest;
    return `${this.generate(arr, 'value')}?.[${this.generate(index, 'value')}]`;
  }

  generateOptCall(head, rest) {
    let [fn, ...args] = rest;
    return `${this.generate(fn, 'value')}?.(${args.map(a => this.generate(a, 'value')).join(', ')})`;
  }

  // ---------------------------------------------------------------------------
  // Functions
  // ---------------------------------------------------------------------------

  generateDef(head, rest, context, sexpr) {
    let [name, params, body] = rest;
    let sideEffectOnly = meta(name, 'await') === true;
    let cleanName = str(name);
    let paramList = this.generateParamList(params);
    let bodyCode = this.generateFunctionBody(body, params, sideEffectOnly);
    let isAsync = this.containsAwait(body);
    let isGen = this.containsYield(body);
    return `${isAsync ? 'async ' : ''}function${isGen ? '*' : ''} ${cleanName}(${paramList}) ${bodyCode}`;
  }

  generateThinArrow(head, rest, context, sexpr) {
    let [params, body] = rest;
    let sideEffectOnly = this.nextFunctionIsVoid || false;
    this.nextFunctionIsVoid = false;
    let paramList = this.generateParamList(params);
    let bodyCode = this.generateFunctionBody(body, params, sideEffectOnly);
    let isAsync = this.containsAwait(body);
    let isGen = this.containsYield(body);
    let fn = `${isAsync ? 'async ' : ''}function${isGen ? '*' : ''}(${paramList}) ${bodyCode}`;
    return context === 'value' ? `(${fn})` : fn;
  }

  generateFatArrow(head, rest, context, sexpr) {
    let [params, body] = rest;
    let sideEffectOnly = this.nextFunctionIsVoid || false;
    this.nextFunctionIsVoid = false;
    let paramList = this.generateParamList(params);
    let isSingle = params.length === 1 && typeof params[0] === 'string' &&
                   !paramList.includes('=') && !paramList.includes('...') &&
                   !paramList.includes('[') && !paramList.includes('{');
    let paramSyntax = isSingle ? paramList : `(${paramList})`;
    let isAsync = this.containsAwait(body);
    let prefix = isAsync ? 'async ' : '';

    if (!sideEffectOnly) {
      if (Array.isArray(body) && body[0] === 'block' && body.length === 2) {
        let expr = body[1];
        if (!Array.isArray(expr) || expr[0] !== 'return') {
          return `${prefix}${paramSyntax} => ${this.generate(expr, 'value')}`;
        }
      }
      if (!Array.isArray(body) || body[0] !== 'block') {
        return `${prefix}${paramSyntax} => ${this.generate(body, 'value')}`;
      }
    }

    let bodyCode = this.generateFunctionBody(body, params, sideEffectOnly);
    return `${prefix}${paramSyntax} => ${bodyCode}`;
  }

  generateReturn(head, rest, context, sexpr) {
    if (rest.length === 0) return 'return';
    let [expr] = rest;
    if (this.sideEffectOnly) return 'return';

    if (Array.isArray(expr) && expr[0] === 'unless') {
      let [, condition, body] = expr;
      let val = Array.isArray(body) && body.length === 1 ? body[0] : body;
      return `if (!${this.generate(condition, 'value')}) return ${this.generate(val, 'value')}`;
    }
    if (Array.isArray(expr) && expr[0] === 'if') {
      let [, condition, body, ...elseParts] = expr;
      if (elseParts.length === 0) {
        let val = Array.isArray(body) && body.length === 1 ? body[0] : body;
        return `if (${this.generate(condition, 'value')}) return ${this.generate(val, 'value')}`;
      }
    }
    if (Array.isArray(expr) && expr[0] === 'new' && Array.isArray(expr[1]) && expr[1][0] === 'unless') {
      let [, unlessNode] = expr;
      let [, condition, body] = unlessNode;
      let val = Array.isArray(body) && body.length === 1 ? body[0] : body;
      return `if (!${this.generate(condition, 'value')}) return ${this.generate(['new', val], 'value')}`;
    }
    return `return ${this.generate(expr, 'value')}`;
  }

  // ---------------------------------------------------------------------------
  // Reactive
  // ---------------------------------------------------------------------------

  generateState(head, rest) {
    let [name, expr] = rest;
    this.usesReactivity = true;
    let varName = str(name) ?? name;
    if (!this.reactiveVars) this.reactiveVars = new Set();
    this.reactiveVars.add(varName);
    return `const ${varName} = __state(${this.generate(expr, 'value')})`;
  }

  generateComputed(head, rest) {
    let [name, expr] = rest;
    this.usesReactivity = true;
    if (!this.reactiveVars) this.reactiveVars = new Set();
    let varName = str(name) ?? name;
    this.reactiveVars.add(varName);
    return `const ${varName} = __computed(() => ${this.generate(expr, 'value')})`;
  }

  generateReadonly(head, rest) {
    let [name, expr] = rest;
    return `const ${str(name) ?? name} = ${this.generate(expr, 'value')}`;
  }

  generateEffect(head, rest) {
    let [target, body] = rest;
    this.usesReactivity = true;
    let bodyCode;
    if (Array.isArray(body) && body[0] === 'block') {
      let stmts = this.withIndent(() => this.formatStatements(body.slice(1)));
      bodyCode = `{\n${stmts.join('\n')}\n${this.indent()}}`;
    } else if (Array.isArray(body) && (body[0] === '->' || body[0] === '=>')) {
      let fnCode = this.generate(body, 'value');
      if (target) return `const ${str(target) ?? this.generate(target, 'value')} = __effect(${fnCode})`;
      return `__effect(${fnCode})`;
    } else {
      bodyCode = `{ ${this.generate(body, 'value')}; }`;
    }
    let effectCode = `__effect(() => ${bodyCode})`;
    if (target) return `const ${str(target) ?? this.generate(target, 'value')} = ${effectCode}`;
    return effectCode;
  }

  // ---------------------------------------------------------------------------
  // Control flow — simple
  // ---------------------------------------------------------------------------

  generateBreak()    { return 'break'; }
  generateBreakIf(head, rest)    { return `if (${this.generate(rest[0], 'value')}) break`; }
  generateContinue() { return 'continue'; }
  generateContinueIf(head, rest) { return `if (${this.generate(rest[0], 'value')}) continue`; }

  generateExistential(head, rest) {
    return `(${this.generate(rest[0], 'value')} != null)`;
  }

  generateTernary(head, rest) {
    let [cond, then_, else_] = rest;
    return `(${this.unwrap(this.generate(cond, 'value'))} ? ${this.generate(then_, 'value')} : ${this.generate(else_, 'value')})`;
  }

  generateLoop(head, rest) {
    return `while (true) ${this.generateLoopBody(rest[0])}`;
  }

  generateAwait(head, rest) { return `await ${this.generate(rest[0], 'value')}`; }

  generateYield(head, rest) {
    return rest.length === 0 ? 'yield' : `yield ${this.generate(rest[0], 'value')}`;
  }

  generateYieldFrom(head, rest) { return `yield* ${this.generate(rest[0], 'value')}`; }

  // ---------------------------------------------------------------------------
  // Conditionals
  // ---------------------------------------------------------------------------

  generateIf(head, rest, context, sexpr) {
    if (head === 'unless') {
      let [condition, body] = rest;
      if (Array.isArray(body) && body.length === 1 && (!Array.isArray(body[0]) || body[0][0] !== 'block')) body = body[0];
      if (context === 'value') {
        return `(!${this.generate(condition, 'value')} ? ${this.extractExpression(body)} : undefined)`;
      }
      let condCode = this.unwrap(this.generate(condition, 'value'));
      if (/[ <>=&|]/.test(condCode)) condCode = `(${condCode})`;
      return `if (!${condCode}) ` + this.generate(body, 'statement');
    }
    let [condition, thenBranch, ...elseBranches] = rest;
    return context === 'value'
      ? this.generateIfAsExpression(condition, thenBranch, elseBranches)
      : this.generateIfAsStatement(condition, thenBranch, elseBranches);
  }

  // ---------------------------------------------------------------------------
  // Loops
  // ---------------------------------------------------------------------------

  generateForIn(head, rest, context, sexpr) {
    let [vars, iterable, step, guard, body] = rest;

    if (context === 'value' && this.comprehensionDepth === 0) {
      let iterator = ['for-in', vars, iterable, step];
      return this.generate(['comprehension', body, [iterator], guard ? [guard] : []], context);
    }

    let varsArray = Array.isArray(vars) ? vars : [vars];
    let noVar = varsArray.length === 0;
    let [itemVar, indexVar] = noVar ? ['_i', null] : varsArray;
    let itemVarPattern = (Array.isArray(itemVar) && (itemVar[0] === 'array' || itemVar[0] === 'object'))
      ? this.generateDestructuringPattern(itemVar) : itemVar;

    // Stepped iteration
    if (step && step !== null) {
      let iterCode = this.generate(iterable, 'value');
      let idxName = indexVar || '_i';
      let stepCode = this.generate(step, 'value');
      let isNeg = this.isNegativeStep(step);
      let isMinus1 = isNeg && (step[1] === '1' || step[1] === 1 || str(step[1]) === '1');
      let isPlus1 = !isNeg && (step === '1' || step === 1 || str(step) === '1');

      let loopHeader;
      if (isMinus1) loopHeader = `for (let ${idxName} = ${iterCode}.length - 1; ${idxName} >= 0; ${idxName}--) `;
      else if (isPlus1) loopHeader = `for (let ${idxName} = 0; ${idxName} < ${iterCode}.length; ${idxName}++) `;
      else if (isNeg) loopHeader = `for (let ${idxName} = ${iterCode}.length - 1; ${idxName} >= 0; ${idxName} += ${stepCode}) `;
      else loopHeader = `for (let ${idxName} = 0; ${idxName} < ${iterCode}.length; ${idxName} += ${stepCode}) `;

      if (Array.isArray(body) && body[0] === 'block') {
        let stmts = body.slice(1);
        this.indentLevel++;
        let lines = [];
        if (!noVar) lines.push(`const ${itemVarPattern} = ${iterCode}[${idxName}];`);
        if (guard) {
          lines.push(`if (${this.generate(guard, 'value')}) {`);
          this.indentLevel++;
          lines.push(...this.formatStatements(stmts));
          this.indentLevel--;
          lines.push(this.indent() + '}');
        } else {
          lines.push(...stmts.map(s => this.addSemicolon(s, this.generate(s, 'statement'))));
        }
        this.indentLevel--;
        return loopHeader + `{\n${lines.map(s => this.indent() + s).join('\n')}\n${this.indent()}}`;
      }

      if (noVar) {
        return guard
          ? loopHeader + `{ if (${this.generate(guard, 'value')}) ${this.generate(body, 'statement')}; }`
          : loopHeader + `{ ${this.generate(body, 'statement')}; }`;
      }
      return guard
        ? loopHeader + `{ const ${itemVarPattern} = ${iterCode}[${idxName}]; if (${this.generate(guard, 'value')}) ${this.generate(body, 'statement')}; }`
        : loopHeader + `{ const ${itemVarPattern} = ${iterCode}[${idxName}]; ${this.generate(body, 'statement')}; }`;
    }

    // Index variable → traditional for loop
    if (indexVar) {
      let iterCode = this.generate(iterable, 'value');
      let code = `for (let ${indexVar} = 0; ${indexVar} < ${iterCode}.length; ${indexVar}++) `;
      if (Array.isArray(body) && body[0] === 'block') {
        code += '{\n';
        this.indentLevel++;
        code += this.indent() + `const ${itemVarPattern} = ${iterCode}[${indexVar}];\n`;
        if (guard) {
          code += this.indent() + `if (${this.unwrap(this.generate(guard, 'value'))}) {\n`;
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
          ? `{ const ${itemVarPattern} = ${iterCode}[${indexVar}]; if (${this.unwrap(this.generate(guard, 'value'))}) ${this.generate(body, 'statement')}; }`
          : `{ const ${itemVarPattern} = ${iterCode}[${indexVar}]; ${this.generate(body, 'statement')}; }`;
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
                            (e instanceof String && !str(e).includes('(')) || (Array.isArray(e) && e[0] === '.');
      if (isSimple(start) && isSimple(end)) {
        let s = this.generate(start, 'value'), e = this.generate(end, 'value');
        let cmp = isExcl ? '<' : '<=';
        let inc = step ? `${itemVarPattern} += ${this.generate(step, 'value')}` : `${itemVarPattern}++`;
        let code = `for (let ${itemVarPattern} = ${s}; ${itemVarPattern} ${cmp} ${e}; ${inc}) `;
        code += guard ? this.generateLoopBodyWithGuard(body, guard) : this.generateLoopBody(body);
        return code;
      }
    }

    // Default: for-of
    let code = `for (const ${itemVarPattern} of ${this.generate(iterable, 'value')}) `;
    code += guard ? this.generateLoopBodyWithGuard(body, guard) : this.generateLoopBody(body);
    return code;
  }

  generateForOf(head, rest, context, sexpr) {
    let [vars, obj, own, guard, body] = rest;
    let [keyVar, valueVar] = Array.isArray(vars) ? vars : [vars];
    let objCode = this.generate(obj, 'value');
    let code = `for (const ${keyVar} in ${objCode}) `;

    if (own && !valueVar && !guard) {
      if (Array.isArray(body) && body[0] === 'block') {
        this.indentLevel++;
        let stmts = [`if (!Object.hasOwn(${objCode}, ${keyVar})) continue;`, ...body.slice(1).map(s => this.addSemicolon(s, this.generate(s, 'statement')))];
        this.indentLevel--;
        return code + `{\n${stmts.map(s => this.indent() + s).join('\n')}\n${this.indent()}}`;
      }
      return code + `{ if (!Object.hasOwn(${objCode}, ${keyVar})) continue; ${this.generate(body, 'statement')}; }`;
    }

    if (valueVar) {
      if (Array.isArray(body) && body[0] === 'block') {
        let stmts = body.slice(1);
        this.indentLevel++;
        let lines = [];
        if (own) lines.push(`if (!Object.hasOwn(${objCode}, ${keyVar})) continue;`);
        lines.push(`const ${valueVar} = ${objCode}[${keyVar}];`);
        if (guard) {
          lines.push(`if (${this.generate(guard, 'value')}) {`);
          this.indentLevel++;
          lines.push(...stmts.map(s => this.addSemicolon(s, this.generate(s, 'statement'))));
          this.indentLevel--;
          lines.push(this.indent() + '}');
        } else {
          lines.push(...stmts.map(s => this.addSemicolon(s, this.generate(s, 'statement'))));
        }
        this.indentLevel--;
        return code + `{\n${lines.map(s => this.indent() + s).join('\n')}\n${this.indent()}}`;
      }
      let inline = '';
      if (own) inline += `if (!Object.hasOwn(${objCode}, ${keyVar})) continue; `;
      inline += `const ${valueVar} = ${objCode}[${keyVar}]; `;
      if (guard) inline += `if (${this.generate(guard, 'value')}) `;
      inline += `${this.generate(body, 'statement')};`;
      return code + `{ ${inline} }`;
    }

    code += guard ? this.generateLoopBodyWithGuard(body, guard) : this.generateLoopBody(body);
    return code;
  }

  generateForAs(head, rest, context, sexpr) {
    let varsArray = Array.isArray(rest[0]) ? rest[0] : [rest[0]];
    let [firstVar] = varsArray;
    let iterable = rest[1], isAwait = rest[2], guard = rest[3], body = rest[4];

    let needsTempVar = false, destructStmts = [];
    if (Array.isArray(firstVar) && firstVar[0] === 'array') {
      let elements = firstVar.slice(1);
      let restIdx = elements.findIndex(el => (Array.isArray(el) && el[0] === '...') || el === '...');
      if (restIdx !== -1 && restIdx < elements.length - 1) {
        needsTempVar = true;
        let afterRest = elements.slice(restIdx + 1), afterCount = afterRest.length;
        let beforeRest = elements.slice(0, restIdx);
        let restEl = elements[restIdx];
        let restVar = Array.isArray(restEl) && restEl[0] === '...' ? restEl[1] : '_rest';
        let beforePattern = beforeRest.map(el => el === ',' ? '' : typeof el === 'string' ? el : this.generate(el, 'value')).join(', ');
        let firstPattern = beforePattern ? `${beforePattern}, ...${restVar}` : `...${restVar}`;
        let afterPattern = afterRest.map(el => el === ',' ? '' : typeof el === 'string' ? el : this.generate(el, 'value')).join(', ');
        destructStmts.push(`[${firstPattern}] = _item`);
        destructStmts.push(`[${afterPattern}] = ${restVar}.splice(-${afterCount})`);
        this.helpers.add('slice');
        elements.forEach(el => {
          if (el === ',' || el === '...') return;
          if (typeof el === 'string') this.programVars.add(el);
          else if (Array.isArray(el) && el[0] === '...' && typeof el[1] === 'string') this.programVars.add(el[1]);
        });
      }
    }

    let iterCode = this.generate(iterable, 'value');
    let awaitKw = isAwait ? 'await ' : '';
    let itemVarPattern;
    if (needsTempVar) itemVarPattern = '_item';
    else if (Array.isArray(firstVar) && (firstVar[0] === 'array' || firstVar[0] === 'object'))
      itemVarPattern = this.generateDestructuringPattern(firstVar);
    else itemVarPattern = firstVar;

    let code = `for ${awaitKw}(const ${itemVarPattern} of ${iterCode}) `;

    if (needsTempVar && destructStmts.length > 0) {
      let stmts = this.unwrapBlock(body);
      let allStmts = this.withIndent(() => [
        ...destructStmts.map(s => this.indent() + s + ';'),
        ...this.formatStatements(stmts)
      ]);
      code += `{\n${allStmts.join('\n')}\n${this.indent()}}`;
    } else {
      code += guard ? this.generateLoopBodyWithGuard(body, guard) : this.generateLoopBody(body);
    }
    return code;
  }

  generateWhile(head, rest) {
    let cond = rest[0], guard = rest.length === 3 ? rest[1] : null, body = rest[rest.length - 1];
    let code = `while (${this.unwrap(this.generate(cond, 'value'))}) `;
    return code + (guard ? this.generateLoopBodyWithGuard(body, guard) : this.generateLoopBody(body));
  }

  generateUntil(head, rest) {
    let [cond, body] = rest;
    return `while (!(${this.unwrap(this.generate(cond, 'value'))})) ` + this.generateLoopBody(body);
  }

  generateRange(head, rest) {
    if (head === '...') {
      if (rest.length === 1) return `...${this.generate(rest[0], 'value')}`;
      let [s, e] = rest;
      let sc = this.generate(s, 'value'), ec = this.generate(e, 'value');
      return `((s, e) => Array.from({length: Math.max(0, Math.abs(e - s))}, (_, i) => s + (i * (s <= e ? 1 : -1))))(${sc}, ${ec})`;
    }
    let [s, e] = rest;
    let sc = this.generate(s, 'value'), ec = this.generate(e, 'value');
    return `((s, e) => Array.from({length: Math.abs(e - s) + 1}, (_, i) => s + (i * (s <= e ? 1 : -1))))(${sc}, ${ec})`;
  }

  // ---------------------------------------------------------------------------
  // Unary operators
  // ---------------------------------------------------------------------------

  generateNot(head, rest) {
    let [operand] = rest;
    if (typeof operand === 'string' || operand instanceof String) return `!${this.generate(operand, 'value')}`;
    if (Array.isArray(operand)) {
      let highPrec = ['.', '?.', '[]', 'optindex', 'optcall'];
      if (highPrec.includes(operand[0])) return `!${this.generate(operand, 'value')}`;
    }
    let code = this.generate(operand, 'value');
    return code.startsWith('(') ? `!${code}` : `(!${code})`;
  }

  generateBitwiseNot(head, rest) { return `(~${this.generate(rest[0], 'value')})`; }

  generateIncDec(head, rest) {
    let [operand, isPostfix] = rest;
    let code = this.generate(operand, 'value');
    return isPostfix ? `(${code}${head})` : `(${head}${code})`;
  }

  generateTypeof(head, rest) { return `typeof ${this.generate(rest[0], 'value')}`; }
  generateDelete(head, rest) { return `(delete ${this.generate(rest[0], 'value')})`; }

  generateInstanceof(head, rest, context, sexpr) {
    let [expr, type] = rest;
    let isNeg = meta(sexpr[0], 'invert');
    let result = `(${this.generate(expr, 'value')} instanceof ${this.generate(type, 'value')})`;
    return isNeg ? `(!${result})` : result;
  }

  generateIn(head, rest, context, sexpr) {
    let [key, container] = rest;
    let keyCode = this.generate(key, 'value');
    let isNeg = meta(sexpr[0], 'invert');
    if (Array.isArray(container) && container[0] === 'object') {
      let result = `(${keyCode} in ${this.generate(container, 'value')})`;
      return isNeg ? `(!${result})` : result;
    }
    let c = this.generate(container, 'value');
    let result = `(Array.isArray(${c}) || typeof ${c} === 'string' ? ${c}.includes(${keyCode}) : (${keyCode} in ${c}))`;
    return isNeg ? `(!${result})` : result;
  }

  generateOf(head, rest, context, sexpr) {
    let [value, container] = rest;
    let v = this.generate(value, 'value'), c = this.generate(container, 'value');
    let isNeg = meta(sexpr[0], 'invert');
    let result = `(${v} in ${c})`;
    return isNeg ? `(!${result})` : result;
  }

  generateRegexMatch(head, rest) {
    let [left, right] = rest;
    this.helpers.add('toSearchable');
    this.programVars.add('_');
    let r = this.generate(right, 'value');
    let allowNL = r.includes('/m') ? ', true' : '';
    return `(_ = toSearchable(${this.generate(left, 'value')}${allowNL}).match(${r}))`;
  }

  generateNew(head, rest) {
    let [call] = rest;
    if (Array.isArray(call) && (call[0] === '.' || call[0] === '?.')) {
      let [accType, target, prop] = call;
      if (Array.isArray(target) && !target[0].startsWith) {
        return `(${this.generate(['new', target], 'value')}).${prop}`;
      }
      return `new ${this.generate(target, 'value')}.${prop}`;
    }
    if (Array.isArray(call)) {
      let [ctor, ...args] = call;
      return `new ${this.generate(ctor, 'value')}(${args.map(a => this.unwrap(this.generate(a, 'value'))).join(', ')})`;
    }
    return `new ${this.generate(call, 'value')}()`;
  }

  // ---------------------------------------------------------------------------
  // Logical operators
  // ---------------------------------------------------------------------------

  generateLogicalAnd(head, rest, context, sexpr) {
    let ops = this.flattenBinaryChain(sexpr).slice(1);
    if (ops.length === 0) return 'true';
    if (ops.length === 1) return this.generate(ops[0], 'value');
    return `(${ops.map(o => this.generate(o, 'value')).join(' && ')})`;
  }

  generateLogicalOr(head, rest, context, sexpr) {
    let ops = this.flattenBinaryChain(sexpr).slice(1);
    if (ops.length === 0) return 'true';
    if (ops.length === 1) return this.generate(ops[0], 'value');
    return `(${ops.map(o => this.generate(o, 'value')).join(' || ')})`;
  }

  // ---------------------------------------------------------------------------
  // Data structures
  // ---------------------------------------------------------------------------

  generateArray(head, elements) {
    let hasTrailingElision = elements.length > 0 && elements[elements.length - 1] === ',';
    let codes = elements.map(el => {
      if (el === ',') return '';
      if (el === '...') return '';
      if (Array.isArray(el) && el[0] === '...') return `...${this.generate(el[1], 'value')}`;
      return this.generate(el, 'value');
    }).join(', ');
    return hasTrailingElision ? `[${codes},]` : `[${codes}]`;
  }

  generateObject(head, pairs, context) {
    if (pairs.length === 1 && Array.isArray(pairs[0]) &&
        Array.isArray(pairs[0][1]) && pairs[0][1][0] === 'comprehension') {
      let [keyVar, compNode] = pairs[0];
      let [, valueExpr, iterators, guards] = compNode;
      return this.generate(['object-comprehension', keyVar, valueExpr, iterators, guards], context);
    }

    let codes = pairs.map(pair => {
      if (Array.isArray(pair) && pair[0] === '...') return `...${this.generate(pair[1], 'value')}`;
      let [key, value, operator] = pair;
      let keyCode;
      if (Array.isArray(key) && key[0] === 'dynamicKey') keyCode = `[${this.generate(key[1], 'value')}]`;
      else if (Array.isArray(key) && key[0] === 'str') keyCode = `[${this.generate(key, 'value')}]`;
      else keyCode = this.generate(key, 'value');
      let valCode = this.generate(value, 'value');
      if (operator === '=') return `${keyCode} = ${valCode}`;
      if (operator === ':') return `${keyCode}: ${valCode}`;
      if (keyCode === valCode && !Array.isArray(key)) return keyCode;
      return `${keyCode}: ${valCode}`;
    }).join(', ');
    return `{${codes}}`;
  }

  generateBlock(head, statements, context) {
    if (context === 'statement') {
      let stmts = this.withIndent(() => this.formatStatements(statements));
      return `{\n${stmts.join('\n')}\n${this.indent()}}`;
    }
    if (statements.length === 0) return 'undefined';
    if (statements.length === 1) return this.generate(statements[0], context);
    let last = statements[statements.length - 1];
    let lastIsCtrl = Array.isArray(last) && ['break', 'continue', 'return', 'throw'].includes(last[0]);
    if (lastIsCtrl) {
      let parts = statements.map(s => this.addSemicolon(s, this.generate(s, 'statement')));
      return `{\n${this.withIndent(() => parts.map(p => this.indent() + p).join('\n'))}\n${this.indent()}}`;
    }
    return `(${statements.map(s => this.generate(s, 'value')).join(', ')})`;
  }

  // ---------------------------------------------------------------------------
  // Exception handling
  // ---------------------------------------------------------------------------

  generateTry(head, rest, context) {
    let needsReturns = context === 'value';
    let tryCode = 'try ';
    let tryBlock = rest[0];
    tryCode += (needsReturns && Array.isArray(tryBlock) && tryBlock[0] === 'block')
      ? this.generateBlockWithReturns(tryBlock) : this.generate(tryBlock, 'statement');

    if (rest.length >= 2 && Array.isArray(rest[1]) && rest[1].length === 2 && rest[1][0] !== 'block') {
      let [param, catchBlock] = rest[1];
      tryCode += ' catch';
      if (param && Array.isArray(param) && (param[0] === 'object' || param[0] === 'array')) {
        tryCode += ' (error)';
        let destructStmt = `(${this.generate(param, 'value')} = error)`;
        catchBlock = Array.isArray(catchBlock) && catchBlock[0] === 'block'
          ? ['block', destructStmt, ...catchBlock.slice(1)]
          : ['block', destructStmt, catchBlock];
      } else if (param) {
        tryCode += ` (${param})`;
      }
      tryCode += ' ' + ((needsReturns && Array.isArray(catchBlock) && catchBlock[0] === 'block')
        ? this.generateBlockWithReturns(catchBlock) : this.generate(catchBlock, 'statement'));
    } else if (rest.length === 2) {
      tryCode += ' finally ' + this.generate(rest[1], 'statement');
    }

    if (rest.length === 3) tryCode += ' finally ' + this.generate(rest[2], 'statement');

    if (needsReturns) {
      let isAsync = this.containsAwait(rest[0]) || (rest[1] && this.containsAwait(rest[1]));
      return `(${isAsync ? 'async ' : ''}() => { ${tryCode} })()`;
    }
    return tryCode;
  }

  generateThrow(head, rest, context) {
    let [expr] = rest;
    if (Array.isArray(expr)) {
      let checkExpr = expr, wrapperType = null;
      if (expr[0] === 'new' && Array.isArray(expr[1]) && (expr[1][0] === 'if' || expr[1][0] === 'unless')) {
        wrapperType = 'new'; checkExpr = expr[1];
      } else if (expr[0] === 'if' || expr[0] === 'unless') {
        checkExpr = expr;
      }
      if (checkExpr[0] === 'if' || checkExpr[0] === 'unless') {
        let [condType, condition, body] = checkExpr;
        let unwrapped = Array.isArray(body) && body.length === 1 ? body[0] : body;
        expr = wrapperType === 'new' ? ['new', unwrapped] : unwrapped;
        let condCode = this.generate(condition, 'value');
        let throwCode = `throw ${this.generate(expr, 'value')}`;
        return condType === 'unless'
          ? `if (!(${condCode})) {\n${this.indent()}  ${throwCode};\n${this.indent()}}`
          : `if (${condCode}) {\n${this.indent()}  ${throwCode};\n${this.indent()}}`;
      }
    }
    let throwStmt = `throw ${this.generate(expr, 'value')}`;
    return context === 'value' ? `(() => { ${throwStmt}; })()` : throwStmt;
  }

  generateControl(head, rest, context) {
    let [rawOp, expr, ctrlSexpr] = rest;
    let op = str(rawOp);
    let isReturn = ctrlSexpr[0] === 'return';
    let exprCode = this.generate(expr, 'value');
    let ctrlValue = ctrlSexpr.length > 1 ? ctrlSexpr[1] : null;
    let ctrlCode = isReturn
      ? (ctrlValue ? `return ${this.generate(ctrlValue, 'value')}` : 'return')
      : (ctrlValue ? `throw ${this.generate(ctrlValue, 'value')}` : 'throw new Error()');
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

  generateSwitch(head, rest, context) {
    let [disc, whens, defaultCase] = rest;
    if (disc === null) return this.generateSwitchAsIfChain(whens, defaultCase, context);

    let switchBody = `switch (${this.generate(disc, 'value')}) {\n`;
    this.indentLevel++;
    for (let clause of whens) {
      let [, test, body] = clause;
      for (let t of test) {
        let tv = str(t) ?? t;
        let cv;
        if (Array.isArray(tv)) cv = this.generate(tv, 'value');
        else if (typeof tv === 'string' && (tv.startsWith('"') || tv.startsWith("'"))) cv = `'${tv.slice(1, -1)}'`;
        else cv = this.generate(tv, 'value');
        switchBody += this.indent() + `case ${cv}:\n`;
      }
      this.indentLevel++;
      switchBody += this.generateSwitchCaseBody(body, context);
      this.indentLevel--;
    }
    if (defaultCase) {
      switchBody += this.indent() + 'default:\n';
      this.indentLevel++;
      switchBody += this.generateSwitchCaseBody(defaultCase, context);
      this.indentLevel--;
    }
    this.indentLevel--;
    switchBody += this.indent() + '}';

    if (context === 'value') {
      let hasAwait = whens.some(w => this.containsAwait(w[2])) || (defaultCase && this.containsAwait(defaultCase));
      return `(${hasAwait ? 'async ' : ''}() => { ${switchBody} })()`;
    }
    return switchBody;
  }

  generateWhen() { throw new Error('when clause should be handled by switch'); }

  // ---------------------------------------------------------------------------
  // Comprehensions
  // ---------------------------------------------------------------------------

  generateComprehension(head, rest, context) {
    let [expr, iterators, guards] = rest;
    if (context === 'statement') return this.generateComprehensionAsLoop(expr, iterators, guards);
    if (this.comprehensionTarget) return this.generateComprehensionWithTarget(expr, iterators, guards, this.comprehensionTarget);

    let hasAwait = this.containsAwait(expr);
    let code = `(${hasAwait ? 'async ' : ''}() => {\n`;
    this.indentLevel++;
    this.comprehensionDepth++;
    code += this.indent() + 'const result = [];\n';

    for (let iter of iterators) {
      let [iterType, vars, iterable, stepOrOwn] = iter;
      if (iterType === 'for-in') {
        let step = stepOrOwn;
        let va = Array.isArray(vars) ? vars : [vars];
        let noVar = va.length === 0;
        let [itemVar, indexVar] = noVar ? ['_i', null] : va;
        let ivp = (Array.isArray(itemVar) && (itemVar[0] === 'array' || itemVar[0] === 'object'))
          ? this.generateDestructuringPattern(itemVar) : itemVar;

        if (step && step !== null) {
          let ih = Array.isArray(iterable) && iterable[0];
          if (ih instanceof String) ih = str(ih);
          let isRange = ih === '..' || ih === '...';
          if (isRange) {
            let isExcl = ih === '...';
            let [s, e] = iterable.slice(1);
            let sc = this.generate(s, 'value'), ec = this.generate(e, 'value'), stc = this.generate(step, 'value');
            code += this.indent() + `for (let ${ivp} = ${sc}; ${ivp} ${isExcl ? '<' : '<='} ${ec}; ${ivp} += ${stc}) {\n`;
            this.indentLevel++;
          } else {
            let ic = this.generate(iterable, 'value'), idxN = indexVar || '_i', stc = this.generate(step, 'value');
            let isNeg = this.isNegativeStep(step);
            code += isNeg
              ? this.indent() + `for (let ${idxN} = ${ic}.length - 1; ${idxN} >= 0; ${idxN} += ${stc}) {\n`
              : this.indent() + `for (let ${idxN} = 0; ${idxN} < ${ic}.length; ${idxN} += ${stc}) {\n`;
            this.indentLevel++;
            if (!noVar) code += this.indent() + `const ${ivp} = ${ic}[${idxN}];\n`;
          }
        } else if (indexVar) {
          let ic = this.generate(iterable, 'value');
          code += this.indent() + `for (let ${indexVar} = 0; ${indexVar} < ${ic}.length; ${indexVar}++) {\n`;
          this.indentLevel++;
          code += this.indent() + `const ${ivp} = ${ic}[${indexVar}];\n`;
        } else {
          code += this.indent() + `for (const ${ivp} of ${this.generate(iterable, 'value')}) {\n`;
          this.indentLevel++;
        }
      } else if (iterType === 'for-of') {
        let own = stepOrOwn;
        let va = Array.isArray(vars) ? vars : [vars];
        let [kv, vv] = va;
        let kvp = (Array.isArray(kv) && (kv[0] === 'array' || kv[0] === 'object'))
          ? this.generateDestructuringPattern(kv) : kv;
        let oc = this.generate(iterable, 'value');
        code += this.indent() + `for (const ${kvp} in ${oc}) {\n`;
        this.indentLevel++;
        if (own) code += this.indent() + `if (!Object.hasOwn(${oc}, ${kvp})) continue;\n`;
        if (vv) code += this.indent() + `const ${vv} = ${oc}[${kvp}];\n`;
      } else if (iterType === 'for-as') {
        let isAwait = iter[3];
        let va = Array.isArray(vars) ? vars : [vars];
        let [fv] = va;
        let ivp = (Array.isArray(fv) && (fv[0] === 'array' || fv[0] === 'object'))
          ? this.generateDestructuringPattern(fv) : fv;
        code += this.indent() + `for ${isAwait ? 'await ' : ''}(const ${ivp} of ${this.generate(iterable, 'value')}) {\n`;
        this.indentLevel++;
      }
    }

    for (let guard of guards) {
      code += this.indent() + `if (${this.generate(guard, 'value')}) {\n`;
      this.indentLevel++;
    }

    let hasCtrl = (node) => {
      if (typeof node === 'string' && (node === 'break' || node === 'continue')) return true;
      if (!Array.isArray(node)) return false;
      if (['break', 'continue', 'break-if', 'continue-if', 'return', 'throw'].includes(node[0])) return true;
      if (node[0] === 'if' || node[0] === 'unless') return node.slice(1).some(hasCtrl);
      return node.some(hasCtrl);
    };

    let loopStmts = ['for-in', 'for-of', 'for-as', 'while', 'until', 'loop'];
    if (Array.isArray(expr) && expr[0] === 'block') {
      for (let i = 0; i < expr.length - 1; i++) {
        let s = expr[i + 1], isLast = i === expr.length - 2;
        if (!isLast || hasCtrl(s)) {
          code += this.indent() + this.generate(s, 'statement') + ';\n';
        } else if (Array.isArray(s) && loopStmts.includes(s[0])) {
          code += this.indent() + this.generate(s, 'statement') + ';\n';
        } else {
          code += this.indent() + `result.push(${this.generate(s, 'value')});\n`;
        }
      }
    } else {
      if (hasCtrl(expr)) {
        code += this.indent() + this.generate(expr, 'statement') + ';\n';
      } else if (Array.isArray(expr) && loopStmts.includes(expr[0])) {
        code += this.indent() + this.generate(expr, 'statement') + ';\n';
      } else {
        code += this.indent() + `result.push(${this.generate(expr, 'value')});\n`;
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

  generateObjectComprehension(head, rest, context) {
    let [keyExpr, valueExpr, iterators, guards] = rest;
    let code = '(() => {\n';
    this.indentLevel++;
    code += this.indent() + 'const result = {};\n';
    for (let iter of iterators) {
      let [iterType, vars, iterable, own] = iter;
      if (iterType === 'for-of') {
        let [kv, vv] = vars;
        let oc = this.generate(iterable, 'value');
        code += this.indent() + `for (const ${kv} in ${oc}) {\n`;
        this.indentLevel++;
        if (own) code += this.indent() + `if (!Object.hasOwn(${oc}, ${kv})) continue;\n`;
        if (vv) code += this.indent() + `const ${vv} = ${oc}[${kv}];\n`;
      }
    }
    for (let guard of guards) { code += this.indent() + `if (${this.generate(guard, 'value')}) {\n`; this.indentLevel++; }
    code += this.indent() + `result[${this.generate(keyExpr, 'value')}] = ${this.generate(valueExpr, 'value')};\n`;
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

  generateClass(head, rest, context) {
    let [className, parentClass, ...bodyParts] = rest;
    let code = className ? `class ${className}` : 'class';
    if (parentClass) code += ` extends ${this.generate(parentClass, 'value')}`;
    code += ' {\n';

    if (bodyParts.length > 0 && Array.isArray(bodyParts[0])) {
      let bodyBlock = bodyParts[0];
      if (bodyBlock[0] === 'block') {
        let bodyStmts = bodyBlock.slice(1);
        let hasObjFirst = bodyStmts.length > 0 && Array.isArray(bodyStmts[0]) && bodyStmts[0][0] === 'object';

        if (hasObjFirst && bodyStmts.length === 1) {
          let members = bodyStmts[0].slice(1);
          this.indentLevel++;

          // First pass: identify bound methods
          let boundMethods = [];
          for (let [mk, mv] of members) {
            let isStatic = this.isStaticMember(mk);
            let isComputed = this.isComputedMember(mk);
            let mName = this.extractMemberName(mk);
            if (this.isBoundMethod(mv) && !isStatic && !isComputed && mName !== 'constructor') boundMethods.push(mName);
          }

          // Second pass: generate members
          for (let [mk, mv] of members) {
            let isStatic = this.isStaticMember(mk);
            let isComputed = this.isComputedMember(mk);
            let mName = this.extractMemberName(mk);
            if (Array.isArray(mv) && (mv[0] === '->' || mv[0] === '=>')) {
              let [, params, body] = mv;
              let hasAwait = this.containsAwait(body), hasYield = this.containsYield(body);
              let cleanParams = params, autoAssign = [];
              if (mName === 'constructor') {
                cleanParams = params.map(p => {
                  if (Array.isArray(p) && p[0] === '.' && p[1] === 'this') { autoAssign.push(`this.${p[2]} = ${p[2]}`); return p[2]; }
                  return p;
                });
                for (let bm of boundMethods) autoAssign.unshift(`this.${bm} = this.${bm}.bind(this)`);
              }
              let pList = this.generateParamList(cleanParams);
              let prefix = (isStatic ? 'static ' : '') + (hasAwait ? 'async ' : '') + (hasYield ? '*' : '');
              code += this.indent() + `${prefix}${mName}(${pList}) `;
              if (!isComputed) this.currentMethodName = mName;
              code += this.generateMethodBody(body, autoAssign, mName === 'constructor', cleanParams);
              this.currentMethodName = null;
              code += '\n';
            } else if (isStatic) {
              code += this.indent() + `static ${mName} = ${this.generate(mv, 'value')};\n`;
            } else {
              code += this.indent() + `${mName} = ${this.generate(mv, 'value')};\n`;
            }
          }
          this.indentLevel--;
        } else if (hasObjFirst) {
          let members = bodyStmts[0].slice(1);
          let additionalStmts = bodyStmts.slice(1);
          this.indentLevel++;
          for (let [mk, mv] of members) {
            let isStatic = this.isStaticMember(mk), mName = this.extractMemberName(mk);
            if (Array.isArray(mv) && (mv[0] === '->' || mv[0] === '=>')) {
              let [, params, body] = mv;
              let pList = this.generateParamList(params);
              let prefix = (isStatic ? 'static ' : '') + (this.containsAwait(body) ? 'async ' : '') + (this.containsYield(body) ? '*' : '');
              code += this.indent() + `${prefix}${mName}(${pList}) `;
              this.currentMethodName = mName;
              code += this.generateMethodBody(body, [], mName === 'constructor', params);
              this.currentMethodName = null;
              code += '\n';
            } else if (isStatic) {
              code += this.indent() + `static ${mName} = ${this.generate(mv, 'value')};\n`;
            } else {
              code += this.indent() + `${mName} = ${this.generate(mv, 'value')};\n`;
            }
          }
          for (let stmt of additionalStmts) {
            if (Array.isArray(stmt) && stmt[0] === 'class') {
              let [, nestedName, parent, ...nestedBody] = stmt;
              if (Array.isArray(nestedName) && nestedName[0] === '.' && nestedName[1] === 'this') {
                code += this.indent() + `static ${nestedName[2]} = ${this.generate(['class', null, parent, ...nestedBody], 'value')};\n`;
              }
            } else {
              code += this.indent() + this.generate(stmt, 'statement') + ';\n';
            }
          }
          this.indentLevel--;
        } else {
          this.indentLevel++;
          for (let stmt of bodyStmts) {
            if (Array.isArray(stmt) && stmt[0] === '=' && Array.isArray(stmt[1]) && stmt[1][0] === '.' && stmt[1][1] === 'this') {
              code += this.indent() + `static ${stmt[1][2]} = ${this.generate(stmt[2], 'value')};\n`;
            } else {
              code += this.indent() + this.generate(stmt, 'statement') + ';\n';
            }
          }
          this.indentLevel--;
        }
      }
    }

    code += this.indent() + '}';
    return code;
  }

  generateSuper(head, rest) {
    if (rest.length === 0) {
      if (this.currentMethodName && this.currentMethodName !== 'constructor') return `super.${this.currentMethodName}()`;
      return 'super';
    }
    let args = rest.map(a => this.unwrap(this.generate(a, 'value'))).join(', ');
    if (this.currentMethodName && this.currentMethodName !== 'constructor') return `super.${this.currentMethodName}(${args})`;
    return `super(${args})`;
  }

  // ---------------------------------------------------------------------------
  // Modules
  // ---------------------------------------------------------------------------

  generateImport(head, rest, context, sexpr) {
    if (rest.length === 1) {
      let importExpr = `import(${this.generate(rest[0], 'value')})`;
      if (meta(sexpr[0], 'await') === true) return `(await ${importExpr})`;
      return importExpr;
    }
    let [specifier, source] = rest;
    let fixedSource = this.addJsExtensionAndAssertions(source);
    if (typeof specifier === 'string') return `import ${specifier} from ${fixedSource}`;
    if (Array.isArray(specifier)) {
      if (specifier[0] === '*' && specifier.length === 2) return `import * as ${specifier[1]} from ${fixedSource}`;
      if (typeof specifier[0] === 'string' && Array.isArray(specifier[1])) {
        let def = specifier[0], second = specifier[1];
        if (second[0] === '*' && second.length === 2) return `import ${def}, * as ${second[1]} from ${fixedSource}`;
        let names = (Array.isArray(second) ? second : [second]).map(i => Array.isArray(i) && i.length === 2 ? `${i[0]} as ${i[1]}` : i).join(', ');
        return `import ${def}, { ${names} } from ${fixedSource}`;
      }
      let names = specifier.map(i => Array.isArray(i) && i.length === 2 ? `${i[0]} as ${i[1]}` : i).join(', ');
      return `import { ${names} } from ${fixedSource}`;
    }
    return `import ${this.generate(specifier, 'value')} from ${fixedSource}`;
  }

  generateExport(head, rest) {
    let [decl] = rest;
    if (Array.isArray(decl) && decl.every(i => typeof i === 'string')) return `export { ${decl.join(', ')} }`;
    if (Array.isArray(decl) && decl[0] === '=') return `export const ${decl[1]} = ${this.generate(decl[2], 'value')}`;
    return `export ${this.generate(decl, 'statement')}`;
  }

  generateExportDefault(head, rest) {
    let [expr] = rest;
    if (Array.isArray(expr) && expr[0] === '=') {
      return `const ${expr[1]} = ${this.generate(expr[2], 'value')};\nexport default ${expr[1]}`;
    }
    return `export default ${this.generate(expr, 'statement')}`;
  }

  generateExportAll(head, rest) {
    return `export * from ${this.addJsExtensionAndAssertions(rest[0])}`;
  }

  generateExportFrom(head, rest) {
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

  generateDoIIFE(head, rest) {
    return `(${this.generate(rest[0], 'statement')})()`;
  }

  generateRegex(head, rest) {
    return rest.length === 0 ? head : this.generate(rest[0], 'value');
  }

  generateTaggedTemplate(head, rest) {
    let [tag, s] = rest;
    let tagCode = this.generate(tag, 'value');
    let content = this.generate(s, 'value');
    if (content.startsWith('`')) return `${tagCode}${content}`;
    if (content.startsWith('"') || content.startsWith("'")) return `${tagCode}\`${content.slice(1, -1)}\``;
    return `${tagCode}\`${content}\``;
  }

  generateString(head, rest) {
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
          result += /^[\d"']/.test(v) ? '${' + this.generate(v, 'value') + '}' : '${' + v + '}';
        } else {
          let expr = part.length === 1 && Array.isArray(part[0]) ? part[0] : part;
          result += '${' + this.generate(expr, 'value') + '}';
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
    if ((h === 'unless' || h === 'if') && expr.length === 3) return {type: h, condition: expr[1], value: expr[2]};
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

  generateDestructuringPattern(pattern) { return this.formatParam(pattern); }

  generateParamList(params) {
    let expIdx = params.findIndex(p => Array.isArray(p) && p[0] === 'expansion');
    if (expIdx !== -1) {
      let before = params.slice(0, expIdx), after = params.slice(expIdx + 1);
      let regular = before.map(p => this.formatParam(p)).join(', ');
      this.expansionAfterParams = after;
      return regular ? `${regular}, ..._rest` : '..._rest';
    }
    let restIdx = params.findIndex(p => Array.isArray(p) && p[0] === 'rest');
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
    if (Array.isArray(param) && param[0] === 'rest') return `...${param[1]}`;
    if (Array.isArray(param) && param[0] === 'default') return `${param[1]} = ${this.generate(param[2], 'value')}`;
    if (Array.isArray(param) && param[0] === '.' && param[1] === 'this') return param[2];
    if (Array.isArray(param) && param[0] === 'array') {
      let els = param.slice(1).map(el => {
        if (el === ',') return '';
        if (el === '...') return '';
        if (Array.isArray(el) && el[0] === '...') return `...${el[1]}`;
        if (Array.isArray(el) && el[0] === '=' && typeof el[1] === 'string') return `${el[1]} = ${this.generate(el[2], 'value')}`;
        if (typeof el === 'string') return el;
        return this.formatParam(el);
      });
      return `[${els.join(', ')}]`;
    }
    if (Array.isArray(param) && param[0] === 'object') {
      let pairs = param.slice(1).map(pair => {
        if (Array.isArray(pair) && pair[0] === '...') return `...${pair[1]}`;
        if (Array.isArray(pair) && pair[0] === 'default') return `${pair[1]} = ${this.generate(pair[2], 'value')}`;
        let [key, value] = pair;
        if (key === value) return key;
        return `${key}: ${value}`;
      });
      return `{${pairs.join(', ')}}`;
    }
    return JSON.stringify(param);
  }

  // ---------------------------------------------------------------------------
  // Body generation
  // ---------------------------------------------------------------------------

  generateBodyWithReturns(body, params = [], options = {}) {
    let {sideEffectOnly = false, autoAssignments = [], isConstructor = false, hasExpansionParams = false} = options;
    let prevSEO = this.sideEffectOnly;
    this.sideEffectOnly = sideEffectOnly;

    let paramNames = new Set();
    let extractPN = (p) => {
      if (typeof p === 'string') paramNames.add(p);
      else if (Array.isArray(p)) {
        if (p[0] === 'rest' || p[0] === '...') { if (typeof p[1] === 'string') paramNames.add(p[1]); }
        else if (p[0] === 'default') { if (typeof p[1] === 'string') paramNames.add(p[1]); }
        else if (p[0] === 'array' || p[0] === 'object') this.collectVarsFromArray(p, paramNames);
      }
    };
    if (Array.isArray(params)) params.forEach(extractPN);

    let bodyVars = this.collectFunctionVariables(body);
    let newVars = new Set([...bodyVars].filter(v => !this.programVars.has(v) && !this.reactiveVars?.has(v) && !paramNames.has(v)));
    let noRetStmts = ['return', 'throw', 'break', 'continue'];
    let loopStmts = ['for-in', 'for-of', 'for-as', 'while', 'until', 'loop'];

    if (Array.isArray(body) && body[0] === 'block') {
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
          let pn = typeof p === 'string' ? p : (Array.isArray(p) && p[0] === 'default') ? p[1] : JSON.stringify(p);
          extr.push(`const ${pn} = ${restName}[${restName}.length - ${afterCount - i}]`);
        });
        if (afterCount > 0) extr.push(`${restName} = ${restName}.slice(0, -${afterCount})`);
        statements = [...extr, ...statements];
        this.restMiddleParam = null;
      }

      this.indentLevel++;
      let code = '{\n';
      if (newVars.size > 0) code += this.indent() + `let ${Array.from(newVars).sort().join(', ')};\n`;

      let firstIsSuper = autoAssignments.length > 0 && statements.length > 0 &&
                         Array.isArray(statements[0]) && statements[0][0] === 'super';

      let genStatements = (stmts) => {
        stmts.forEach((stmt, index) => {
          let isLast = index === stmts.length - 1;
          let h = Array.isArray(stmt) ? stmt[0] : null;

          if (!isLast && h === 'comprehension') {
            let [, expr, iters, guards] = stmt;
            code += this.indent() + this.generateComprehensionAsLoop(expr, iters, guards) + '\n';
            return;
          }

          if (!isConstructor && !sideEffectOnly && isLast && (h === 'if' || h === 'unless')) {
            let [cond, thenB, ...elseB] = stmt.slice(1);
            let hasMulti = (b) => Array.isArray(b) && b[0] === 'block' && b.length > 2;
            if (hasMulti(thenB) || elseB.some(hasMulti)) {
              code += this.generateIfElseWithEarlyReturns(stmt);
              return;
            }
          }

          if (!isConstructor && !sideEffectOnly && isLast && h === '=') {
            let [target, value] = stmt.slice(1);
            if (typeof target === 'string' && Array.isArray(value)) {
              let vh = value[0];
              if (vh === 'comprehension' || vh === 'for-in') {
                this.comprehensionTarget = target;
                code += this.generate(value, 'value');
                this.comprehensionTarget = null;
                code += this.indent() + `return ${target};\n`;
                return;
              }
            }
          }

          let needsReturn = !isConstructor && !sideEffectOnly && isLast &&
                           !noRetStmts.includes(h) && !loopStmts.includes(h) &&
                           !this.hasExplicitControlFlow(stmt);
          let ctx = needsReturn ? 'value' : 'statement';
          let sc = this.generate(stmt, ctx);
          if (needsReturn) code += this.indent() + 'return ' + sc + ';\n';
          else code += this.indent() + this.addSemicolon(stmt, sc) + '\n';
        });
      };

      if (firstIsSuper) {
        let isSuperOnly = statements.length === 1;
        if (isSuperOnly && !isConstructor) code += this.indent() + 'return ' + this.generate(statements[0], 'value') + ';\n';
        else code += this.indent() + this.generate(statements[0], 'statement') + ';\n';
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
      this.sideEffectOnly = prevSEO;
      return code;
    }

    // Single expression
    this.sideEffectOnly = prevSEO;
    if (isConstructor || this.hasExplicitControlFlow(body)) return `{ ${this.generate(body, 'statement')}; }`;
    if (Array.isArray(body) && (noRetStmts.includes(body[0]) || loopStmts.includes(body[0]))) return `{ ${this.generate(body, 'statement')}; }`;
    if (sideEffectOnly) return `{ ${this.generate(body, 'statement')}; return; }`;
    return `{ return ${this.generate(body, 'value')}; }`;
  }

  generateFunctionBody(body, params = [], sideEffectOnly = false) {
    return this.generateBodyWithReturns(body, params, {sideEffectOnly, hasExpansionParams: this.expansionAfterParams?.length > 0});
  }

  generateMethodBody(body, autoAssignments = [], isConstructor = false, params = []) {
    return this.generateBodyWithReturns(body, params, {autoAssignments, isConstructor});
  }

  generateBlockWithReturns(block) {
    if (!Array.isArray(block) || block[0] !== 'block') return this.generate(block, 'statement');
    let stmts = this.unwrapBlock(block);
    let lines = this.withIndent(() => stmts.map((stmt, i) => {
      let isLast = i === stmts.length - 1;
      let h = Array.isArray(stmt) ? stmt[0] : null;
      let needsReturn = isLast && !['return', 'throw', 'break', 'continue'].includes(h);
      let code = this.generate(stmt, needsReturn ? 'value' : 'statement');
      return needsReturn ? this.indent() + 'return ' + code + ';' : this.indent() + code + ';';
    }));
    return `{\n${lines.join('\n')}\n${this.indent()}}`;
  }

  // ---------------------------------------------------------------------------
  // Loop body helpers
  // ---------------------------------------------------------------------------

  generateLoopBody(body) {
    if (!Array.isArray(body)) return `{ ${this.generate(body, 'statement')}; }`;
    if (body[0] === 'block' || Array.isArray(body[0])) {
      let stmts = body[0] === 'block' ? body.slice(1) : body;
      let lines = this.withIndent(() => stmts.map(s => {
        if (Array.isArray(s) && s[0] === 'comprehension') {
          let [, expr, iters, guards] = s;
          return this.indent() + this.generateComprehensionAsLoop(expr, iters, guards);
        }
        return this.indent() + this.addSemicolon(s, this.generate(s, 'statement'));
      }));
      return `{\n${lines.join('\n')}\n${this.indent()}}`;
    }
    return `{ ${this.generate(body, 'statement')}; }`;
  }

  generateLoopBodyWithGuard(body, guard) {
    let guardCond = this.unwrap(this.generate(guard, 'value'));
    if (!Array.isArray(body)) return `{ if (${guardCond}) ${this.generate(body, 'statement')}; }`;
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
    return `{ if (${this.generate(guard, 'value')}) ${this.generate(body, 'statement')}; }`;
  }

  // ---------------------------------------------------------------------------
  // Comprehension helpers
  // ---------------------------------------------------------------------------

  generateComprehensionWithTarget(expr, iterators, guards, targetVar) {
    let code = '';
    code += this.indent() + `${targetVar} = [];\n`;
    let unwrappedExpr = (Array.isArray(expr) && expr[0] === 'block' && expr.length === 2) ? expr[1] : expr;

    if (iterators.length === 1) {
      let [iterType, vars, iterable, stepOrOwn] = iterators[0];
      if (iterType === 'for-in') {
        let step = stepOrOwn;
        let va = Array.isArray(vars) ? vars : [vars];
        let noVar = va.length === 0;
        let [itemVar, indexVar] = noVar ? ['_i', null] : va;
        let ivp = (Array.isArray(itemVar) && (itemVar[0] === 'array' || itemVar[0] === 'object'))
          ? this.generateDestructuringPattern(itemVar) : itemVar;

        if (step && step !== null) {
          let ih = Array.isArray(iterable) && iterable[0];
          if (ih instanceof String) ih = str(ih);
          let isRange = ih === '..' || ih === '...';
          if (isRange) {
            let isExcl = ih === '...';
            let [s, e] = iterable.slice(1);
            code += this.indent() + `for (let ${ivp} = ${this.generate(s, 'value')}; ${ivp} ${isExcl ? '<' : '<='} ${this.generate(e, 'value')}; ${ivp} += ${this.generate(step, 'value')}) {\n`;
          } else {
            let ic = this.generate(iterable, 'value'), idxN = indexVar || '_i', stc = this.generate(step, 'value');
            let isNeg = this.isNegativeStep(step);
            code += isNeg
              ? this.indent() + `for (let ${idxN} = ${ic}.length - 1; ${idxN} >= 0; ${idxN} += ${stc}) {\n`
              : this.indent() + `for (let ${idxN} = 0; ${idxN} < ${ic}.length; ${idxN} += ${stc}) {\n`;
            this.indentLevel++;
            if (!noVar) code += this.indent() + `const ${ivp} = ${ic}[${idxN}];\n`;
          }
        } else {
          code += this.indent() + `for (const ${ivp} of ${this.generate(iterable, 'value')}) {\n`;
        }
        this.indentLevel++;
        if (guards && guards.length > 0) {
          code += this.indent() + `if (${guards.map(g => this.generate(g, 'value')).join(' && ')}) {\n`;
          this.indentLevel++;
        }
        code += this.indent() + `${targetVar}.push(${this.unwrap(this.generate(unwrappedExpr, 'value'))});\n`;
        if (guards && guards.length > 0) { this.indentLevel--; code += this.indent() + '}\n'; }
        this.indentLevel--;
        code += this.indent() + '}\n';
        return code;
      }
    }
    return this.indent() + `${targetVar} = (() => { /* complex comprehension */ })();\n`;
  }

  generateComprehensionAsLoop(expr, iterators, guards) {
    let code = '';
    if (iterators.length === 1) {
      let [iterType, vars, iterable, stepOrOwn] = iterators[0];

      if (iterType === 'for-in') {
        let step = stepOrOwn;
        let va = Array.isArray(vars) ? vars : [vars];
        let noVar = va.length === 0;
        let [itemVar, indexVar] = noVar ? ['_i', null] : va;
        let ivp = (Array.isArray(itemVar) && (itemVar[0] === 'array' || itemVar[0] === 'object'))
          ? this.generateDestructuringPattern(itemVar) : itemVar;

        if (step && step !== null) {
          let ih = Array.isArray(iterable) && iterable[0];
          if (ih instanceof String) ih = str(ih);
          let isRange = ih === '..' || ih === '...';
          if (isRange) {
            let isExcl = ih === '...';
            let [s, e] = iterable.slice(1);
            code += `for (let ${ivp} = ${this.generate(s, 'value')}; ${ivp} ${isExcl ? '<' : '<='} ${this.generate(e, 'value')}; ${ivp} += ${this.generate(step, 'value')}) `;
          } else {
            let ic = this.generate(iterable, 'value'), idxN = indexVar || '_i', stc = this.generate(step, 'value');
            let isNeg = this.isNegativeStep(step);
            let isMinus1 = isNeg && (step[1] === '1' || step[1] === 1 || str(step[1]) === '1');
            let isPlus1 = !isNeg && (step === '1' || step === 1 || str(step) === '1');
            if (isMinus1) code += `for (let ${idxN} = ${ic}.length - 1; ${idxN} >= 0; ${idxN}--) `;
            else if (isPlus1) code += `for (let ${idxN} = 0; ${idxN} < ${ic}.length; ${idxN}++) `;
            else if (isNeg) code += `for (let ${idxN} = ${ic}.length - 1; ${idxN} >= 0; ${idxN} += ${stc}) `;
            else code += `for (let ${idxN} = 0; ${idxN} < ${ic}.length; ${idxN} += ${stc}) `;
            code += '{\n';
            this.indentLevel++;
            if (!noVar) code += this.indent() + `const ${ivp} = ${ic}[${idxN}];\n`;
          }
          if (guards?.length) {
            if (!isRange) code += this.indent();
            code += '{\n'; this.indentLevel++;
            code += this.indent() + `if (${guards.map(g => this.generate(g, 'value')).join(' && ')}) {\n`;
            this.indentLevel++;
            code += this.indent() + this.generate(expr, 'statement') + ';\n';
            this.indentLevel--; code += this.indent() + '}\n';
            this.indentLevel--; code += this.indent() + '}';
          } else {
            if (!isRange) code += this.indent();
            code += '{\n'; this.indentLevel++;
            code += this.indent() + this.generate(expr, 'statement') + ';\n';
            this.indentLevel--; code += this.indent() + '}';
          }
          if (!isRange) { this.indentLevel--; code += '\n' + this.indent() + '}'; }
          return code;
        }

        if (indexVar) {
          let ic = this.generate(iterable, 'value');
          code += `for (let ${indexVar} = 0; ${indexVar} < ${ic}.length; ${indexVar}++) `;
          code += '{\n'; this.indentLevel++;
          code += this.indent() + `const ${ivp} = ${ic}[${indexVar}];\n`;
        } else {
          code += `for (const ${ivp} of ${this.generate(iterable, 'value')}) `;
          if (guards?.length) {
            code += '{\n'; this.indentLevel++;
            code += this.indent() + `if (${guards.map(g => this.generate(g, 'value')).join(' && ')}) {\n`;
            this.indentLevel++;
            code += this.indent() + this.generate(expr, 'statement') + ';\n';
            this.indentLevel--; code += this.indent() + '}\n';
            this.indentLevel--; code += this.indent() + '}';
          } else {
            code += '{\n'; this.indentLevel++;
            code += this.indent() + this.generate(expr, 'statement') + ';\n';
            this.indentLevel--; code += this.indent() + '}';
          }
          return code;
        }

        // Fall through for indexVar case
        if (guards?.length) {
          code += this.indent() + `if (${guards.map(g => this.generate(g, 'value')).join(' && ')}) {\n`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
          this.indentLevel--; code += this.indent() + '}\n';
        } else {
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
        }
        this.indentLevel--;
        code += this.indent() + '}';
        return code;
      }

      if (iterType === 'for-as') {
        let va = Array.isArray(vars) ? vars : [vars];
        let [fv] = va;
        let ivp = (Array.isArray(fv) && (fv[0] === 'array' || fv[0] === 'object'))
          ? this.generateDestructuringPattern(fv) : fv;
        code += `for (const ${ivp} of ${this.generate(iterable, 'value')}) `;
        if (guards?.length) {
          code += '{\n'; this.indentLevel++;
          code += this.indent() + `if (${guards.map(g => this.generate(g, 'value')).join(' && ')}) {\n`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
          this.indentLevel--; code += this.indent() + '}\n';
          this.indentLevel--; code += this.indent() + '}';
        } else {
          code += '{\n'; this.indentLevel++;
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
          this.indentLevel--; code += this.indent() + '}';
        }
        return code;
      }

      if (iterType === 'for-of') {
        let va = Array.isArray(vars) ? vars : [vars];
        let [kv, vv] = va;
        let own = stepOrOwn;
        let oc = this.generate(iterable, 'value');
        code += `for (const ${kv} in ${oc}) {\n`;
        this.indentLevel++;
        if (own && !vv && !guards?.length) {
          code += this.indent() + `if (!Object.hasOwn(${oc}, ${kv})) continue;\n`;
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
        } else if (own && vv && guards?.length) {
          code += this.indent() + `if (Object.hasOwn(${oc}, ${kv})) {\n`;
          this.indentLevel++;
          code += this.indent() + `const ${vv} = ${oc}[${kv}];\n`;
          code += this.indent() + `if (${guards.map(g => this.generate(g, 'value')).join(' && ')}) {\n`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
          this.indentLevel--; code += this.indent() + '}\n';
          this.indentLevel--; code += this.indent() + '}\n';
        } else if (own && vv) {
          code += this.indent() + `if (Object.hasOwn(${oc}, ${kv})) {\n`;
          this.indentLevel++;
          code += this.indent() + `const ${vv} = ${oc}[${kv}];\n`;
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
          this.indentLevel--; code += this.indent() + '}\n';
        } else if (vv && guards?.length) {
          code += this.indent() + `const ${vv} = ${oc}[${kv}];\n`;
          code += this.indent() + `if (${guards.map(g => this.generate(g, 'value')).join(' && ')}) {\n`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
          this.indentLevel--; code += this.indent() + '}\n';
        } else if (vv) {
          code += this.indent() + `const ${vv} = ${oc}[${kv}];\n`;
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
        } else if (guards?.length) {
          code += this.indent() + `if (${guards.map(g => this.generate(g, 'value')).join(' && ')}) {\n`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
          this.indentLevel--; code += this.indent() + '}\n';
        } else {
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
        }
        this.indentLevel--;
        code += this.indent() + '}';
        return code;
      }
    }

    return this.generate(['comprehension', expr, iterators, guards], 'value');
  }

  // ---------------------------------------------------------------------------
  // If/switch expression helpers
  // ---------------------------------------------------------------------------

  generateIfElseWithEarlyReturns(ifStmt) {
    let [head, condition, thenBranch, ...elseBranches] = ifStmt;
    let code = '';
    let condCode = head === 'unless' ? `!${this.generate(condition, 'value')}` : this.generate(condition, 'value');
    code += this.indent() + `if (${condCode}) {\n`;
    code += this.withIndent(() => this.generateBranchWithReturn(thenBranch));
    code += this.indent() + '}';
    for (let branch of elseBranches) {
      code += ' else ';
      if (Array.isArray(branch) && branch[0] === 'if') {
        let [, nc, nt, ...ne] = branch;
        code += `if (${this.generate(nc, 'value')}) {\n`;
        code += this.withIndent(() => this.generateBranchWithReturn(nt));
        code += this.indent() + '}';
        for (let rb of ne) { code += ' else {\n'; code += this.withIndent(() => this.generateBranchWithReturn(rb)); code += this.indent() + '}'; }
      } else {
        code += '{\n';
        code += this.withIndent(() => this.generateBranchWithReturn(branch));
        code += this.indent() + '}';
      }
    }
    return code;
  }

  generateBranchWithReturn(branch) {
    let stmts = this.unwrapBlock(branch);
    let code = '';
    for (let i = 0; i < stmts.length; i++) {
      let isLast = i === stmts.length - 1, s = stmts[i];
      let h = Array.isArray(s) ? s[0] : null;
      let hasCtrl = h === 'return' || h === 'throw' || h === 'break' || h === 'continue';
      if (isLast && !hasCtrl) code += this.indent() + `return ${this.generate(s, 'value')};\n`;
      else code += this.indent() + this.generate(s, 'statement') + ';\n';
    }
    return code;
  }

  generateIfAsExpression(condition, thenBranch, elseBranches) {
    let needsIIFE = this.isMultiStatementBlock(thenBranch) || this.hasStatementInBranch(thenBranch) ||
                   elseBranches.some(b => this.isMultiStatementBlock(b) || this.hasStatementInBranch(b) || this.hasNestedMultiStatement(b));
    if (needsIIFE) {
      let hasAwait = this.containsAwait(condition) || this.containsAwait(thenBranch) || elseBranches.some(b => this.containsAwait(b));
      let code = `${hasAwait ? 'await ' : ''}(${hasAwait ? 'async ' : ''}() => { `;
      code += `if (${this.generate(condition, 'value')}) `;
      code += this.generateBlockWithReturns(thenBranch);
      for (let branch of elseBranches) {
        code += ' else ';
        if (Array.isArray(branch) && branch[0] === 'if') {
          let [_, nc, nt, ...ne] = branch;
          code += `if (${this.generate(nc, 'value')}) `;
          code += this.generateBlockWithReturns(nt);
          for (let nb of ne) {
            code += ' else ';
            if (Array.isArray(nb) && nb[0] === 'if') {
              let [__, nnc, nnt, ...nne] = nb;
              code += `if (${this.generate(nnc, 'value')}) `;
              code += this.generateBlockWithReturns(nnt);
              elseBranches.push(...nne);
            } else {
              code += this.generateBlockWithReturns(nb);
            }
          }
        } else {
          code += this.generateBlockWithReturns(branch);
        }
      }
      return code + ' })()';
    }
    let thenExpr = this.extractExpression(this.unwrapIfBranch(thenBranch));
    let elseExpr = this.buildTernaryChain(elseBranches);
    let condCode = this.generate(condition, 'value');
    if (Array.isArray(condition) && (condition[0] === 'yield' || condition[0] === 'await')) condCode = `(${condCode})`;
    return `(${condCode} ? ${thenExpr} : ${elseExpr})`;
  }

  generateIfAsStatement(condition, thenBranch, elseBranches) {
    let code = `if (${this.unwrap(this.generate(condition, 'value'))}) `;
    code += this.generate(this.unwrapIfBranch(thenBranch), 'statement');
    for (let branch of elseBranches) code += ` else ` + this.generate(this.unwrapIfBranch(branch), 'statement');
    return code;
  }

  generateSwitchCaseBody(body, context) {
    let code = '';
    let hasFlow = this.hasExplicitControlFlow(body);
    if (hasFlow) {
      for (let s of this.unwrapBlock(body)) code += this.indent() + this.generate(s, 'statement') + ';\n';
    } else if (context === 'value') {
      if (Array.isArray(body) && body[0] === 'block' && body.length > 2) {
        let stmts = body.slice(1);
        for (let i = 0; i < stmts.length; i++) {
          if (i === stmts.length - 1) code += this.indent() + `return ${this.generate(stmts[i], 'value')};\n`;
          else code += this.indent() + this.generate(stmts[i], 'statement') + ';\n';
        }
      } else {
        code += this.indent() + `return ${this.extractExpression(body)};\n`;
      }
    } else {
      if (Array.isArray(body) && body[0] === 'block' && body.length > 1) {
        for (let s of body.slice(1)) code += this.indent() + this.generate(s, 'statement') + ';\n';
      } else {
        code += this.indent() + this.generate(body, 'statement') + ';\n';
      }
      code += this.indent() + 'break;\n';
    }
    return code;
  }

  generateSwitchAsIfChain(whens, defaultCase, context) {
    let code = '';
    for (let i = 0; i < whens.length; i++) {
      let [, test, body] = whens[i];
      let cond = Array.isArray(test) ? test[0] : test;
      code += (i === 0 ? '' : ' else ') + `if (${this.generate(cond, 'value')}) {\n`;
      this.indentLevel++;
      if (context === 'value') code += this.indent() + `return ${this.extractExpression(body)};\n`;
      else for (let s of this.unwrapBlock(body)) code += this.indent() + this.generate(s, 'statement') + ';\n';
      this.indentLevel--;
      code += this.indent() + '}';
    }
    if (defaultCase) {
      code += ' else {\n';
      this.indentLevel++;
      if (context === 'value') code += this.indent() + `return ${this.extractExpression(defaultCase)};\n`;
      else for (let s of this.unwrapBlock(defaultCase)) code += this.indent() + this.generate(s, 'statement') + ';\n';
      this.indentLevel--;
      code += this.indent() + '}';
    }
    return context === 'value' ? `(() => { ${code} })()` : code;
  }

  // ---------------------------------------------------------------------------
  // Utility methods
  // ---------------------------------------------------------------------------

  extractExpression(branch) {
    let stmts = this.unwrapBlock(branch);
    return stmts.length > 0 ? this.generate(stmts[stmts.length - 1], 'value') : 'undefined';
  }

  unwrapBlock(body) {
    if (!Array.isArray(body)) return [body];
    if (body[0] === 'block') return body.slice(1);
    if (Array.isArray(body[0])) return body;
    return [body];
  }

  indent() { return this.indentString.repeat(this.indentLevel); }

  needsSemicolon(stmt, generated) {
    if (!generated || generated.endsWith(';')) return false;
    if (!generated.endsWith('}')) return true;
    let h = Array.isArray(stmt) ? stmt[0] : null;
    return !['def', 'class', 'if', 'unless', 'for-in', 'for-of', 'for-as', 'while', 'until', 'loop', 'switch', 'try'].includes(h);
  }

  addSemicolon(stmt, generated) { return generated + (this.needsSemicolon(stmt, generated) ? ';' : ''); }

  formatStatements(stmts, context = 'statement') {
    return stmts.map(s => this.indent() + this.addSemicolon(s, this.generate(s, context)));
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
    if (t === 'if' || t === 'unless') {
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

  isNegativeStep(step) {
    if (!Array.isArray(step) || step.length !== 2) return false;
    return (str(step[0]) ?? step[0]) === '-';
  }

  isNegativeOneLiteral(sexpr) {
    return Array.isArray(sexpr) && sexpr[0] === '-' && sexpr.length === 2 &&
           (sexpr[1] === '1' || sexpr[1] === 1 || str(sexpr[1]) === '1');
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
    let h = branch[0];
    if (h === 'return' || h === 'throw' || h === 'break' || h === 'continue') return true;
    if (h === 'block') return branch.slice(1).some(s => this.hasStatementInBranch(s));
    return false;
  }

  isMultiStatementBlock(branch) { return Array.isArray(branch) && branch[0] === 'block' && branch.length > 2; }

  hasNestedMultiStatement(branch) {
    if (!Array.isArray(branch)) return false;
    if (branch[0] === 'if') {
      let [_, cond, then_, ...elseB] = branch;
      return this.isMultiStatementBlock(then_) || elseB.some(b => this.hasNestedMultiStatement(b));
    }
    return false;
  }

  buildTernaryChain(branches) {
    if (branches.length === 0) return 'undefined';
    if (branches.length === 1) return this.extractExpression(this.unwrapIfBranch(branches[0]));
    let first = branches[0];
    if (Array.isArray(first) && first[0] === 'if') {
      let [_, cond, then_, ...rest] = first;
      let thenPart = this.extractExpression(this.unwrapIfBranch(then_));
      let elsePart = this.buildTernaryChain([...rest, ...branches.slice(1)]);
      return `(${this.generate(cond, 'value')} ? ${thenPart} : ${elsePart})`;
    }
    return this.extractExpression(this.unwrapIfBranch(first));
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
        else if (item[0] === 'array') this.collectVarsFromArray(item, varSet);
        else if (item[0] === 'object') this.collectVarsFromObject(item, varSet);
      }
    });
  }

  collectVarsFromObject(obj, varSet) {
    obj.slice(1).forEach(pair => {
      if (!Array.isArray(pair)) return;
      if (pair[0] === '...' && typeof pair[1] === 'string') { varSet.add(pair[1]); return; }
      if (pair.length >= 2) {
        let [key, value, operator] = pair;
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

  containsAwait(sexpr) {
    if (!sexpr) return false;
    if (sexpr instanceof String && meta(sexpr, 'await') === true) return true;
    if (typeof sexpr !== 'object') return false;
    if (Array.isArray(sexpr) && sexpr[0] === 'await') return true;
    if (Array.isArray(sexpr) && sexpr[0] === 'for-as' && sexpr[3] === true) return true;
    if (Array.isArray(sexpr) && (sexpr[0] === 'def' || sexpr[0] === '->' || sexpr[0] === '=>' || sexpr[0] === 'class')) return false;
    if (Array.isArray(sexpr)) return sexpr.some(item => this.containsAwait(item));
    return false;
  }

  containsYield(sexpr) {
    if (!sexpr) return false;
    if (typeof sexpr !== 'object') return false;
    if (Array.isArray(sexpr) && (sexpr[0] === 'yield' || sexpr[0] === 'yield-from')) return true;
    if (Array.isArray(sexpr) && (sexpr[0] === 'def' || sexpr[0] === '->' || sexpr[0] === '=>' || sexpr[0] === 'class')) return false;
    if (Array.isArray(sexpr)) return sexpr.some(item => this.containsYield(item));
    return false;
  }

  // Class helpers
  isStaticMember(mk) { return Array.isArray(mk) && mk[0] === '.' && mk[1] === 'this'; }
  isComputedMember(mk) { return Array.isArray(mk) && mk[0] === 'computed'; }
  extractMemberName(mk) {
    if (this.isStaticMember(mk)) return mk[2];
    if (this.isComputedMember(mk)) return `[${this.generate(mk[1], 'value')}]`;
    return mk;
  }
  isBoundMethod(mv) { return Array.isArray(mv) && mv[0] === '=>'; }

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
function __flushEffects() {
  const effects = [...__pendingEffects];
  __pendingEffects.clear();
  for (const effect of effects) effect.run();
}

// Shared primitive coercion (used by state and computed)
const __primitiveCoercion = {
  valueOf() { return this.value; },
  toString() { return String(this.value); },
  [Symbol.toPrimitive](hint) { return hint === 'string' ? this.toString() : this.valueOf(); }
};

function __state(initialValue) {
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

function __effect(fn) {
  const effect = {
    dependencies: new Set(),

    run() {
      for (const dep of effect.dependencies) dep.delete(effect);
      effect.dependencies.clear();
      const prev = __currentEffect;
      __currentEffect = effect;
      try { fn(); } finally { __currentEffect = prev; }
    },

    dispose() {
      for (const dep of effect.dependencies) dep.delete(effect);
      effect.dependencies.clear();
    }
  };

  effect.run();
  return () => effect.dispose();
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

  compile(source) {
    // Handle __DATA__ marker
    let dataSection = null;
    let lines = source.split('\n');
    let dataLineIndex = lines.findIndex(line => line === '__DATA__');
    if (dataLineIndex !== -1) {
      let dataLines = lines.slice(dataLineIndex + 1);
      dataSection = dataLines.length > 0 ? dataLines.join('\n') + '\n' : '';
      source = lines.slice(0, dataLineIndex).join('\n');
    }

    // Step 1: Tokenize
    let lexer = new Lexer();
    let tokens = lexer.tokenize(source);
    if (this.options.showTokens) {
      tokens.forEach(t => console.log(`${t[0].padEnd(12)} ${JSON.stringify(t[1])}`));
      console.log();
    }

    // Step 2: Parse — shim adapter wraps token values with metadata
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
        this.yytext = val;
        this.yylloc = token.loc;
        return token[0];
      }
    };

    let sexpr;
    try {
      sexpr = parser.parse(source);
    } catch (parseError) {
      if (/\?\s*\([^)]*\?[^)]*:[^)]*\)\s*:/.test(source) || /\?\s+\w+\s+\?\s+/.test(source)) {
        throw new Error('Nested ternary operators are not supported. Use if/else statements instead.');
      }
      throw parseError;
    }

    if (this.options.showSExpr) {
      console.log(formatSExpr(sexpr, 0, true));
      console.log();
    }

    // Step 3: Generate JavaScript
    let generator = new CodeGenerator({
      dataSection,
      skipReactiveRuntime: this.options.skipReactiveRuntime,
      reactiveVars: this.options.reactiveVars
    });
    let code = generator.compile(sexpr);

    return { tokens, sexpr, code, data: dataSection, reactiveVars: generator.reactiveVars };
  }

  compileToJS(source) { return this.compile(source).code; }
  compileToSExpr(source) { return this.compile(source).sexpr; }
}

// =============================================================================
// Convenience Functions
// =============================================================================

export function compile(source, options = {}) {
  return new Compiler(options).compile(source);
}

export function compileToJS(source, options = {}) {
  return new Compiler(options).compileToJS(source);
}

export function generate(sexpr, options = {}) {
  return new CodeGenerator(options).compile(sexpr);
}

export { formatSExpr };
