/**
 * Rip Code Generator (Clean-room Implementation)
 *
 * Generates JavaScript from CoffeeScript grammar s-expressions.
 *
 * Architecture:
 * - CoffeeScript Lexer (3,146 LOC) → Tokens
 * - Solar Parser (340 LOC) → S-expressions
 * - This Codegen (5,221 LOC) → JavaScript
 */

import { HTML_TAGS } from './tags.js';

/*
 * Pattern Reference:
 * See CODEGEN.md for complete mapping of grammar → sexp → code
 *
 * @version 1.0.0
 */

export class CodeGenerator {
  // Assignment operators (used in multiple places for variable tracking)
  static ASSIGNMENT_OPS = new Set([
    '=',
    '+=', '-=', '*=', '/=', '?=', '&=', '|=', '^=', '%=',
    '**=', '??=', '&&=', '||=', '<<=', '>>=',
    '>>>='
  ]);

  // Regular expressions for code analysis
  static NUMBER_LITERAL_REGEX = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;
  static NUMBER_START_REGEX = /^-?\d/;

  // Generator dispatch table (O(1) lookup instead of O(n) switch)
  // Maps s-expression head → method name
  static GENERATORS = {
    // Top level
    'program': 'generateProgram',

    // Logical operators (special - flatten chains)
    '&&': 'generateLogicalAnd',
    '||': 'generateLogicalOr',

    // Binary operators (shared method)
    '+': 'generateBinaryOp', '-': 'generateBinaryOp', '*': 'generateBinaryOp',
    '/': 'generateBinaryOp', '%': 'generateBinaryOp', '**': 'generateBinaryOp',
    '==': 'generateBinaryOp', '===': 'generateBinaryOp', '!=': 'generateBinaryOp',
    '!==': 'generateBinaryOp', '<': 'generateBinaryOp', '>': 'generateBinaryOp',
    '<=': 'generateBinaryOp', '>=': 'generateBinaryOp', '??': 'generateBinaryOp',
    '!?': 'generateBinaryOp', '&': 'generateBinaryOp', '|': 'generateBinaryOp',
    '^': 'generateBinaryOp', '<<': 'generateBinaryOp', '>>': 'generateBinaryOp',
    '>>>': 'generateBinaryOp',

    // Special operators (extracted)
    '%%': 'generateModulo',
    '//': 'generateFloorDiv',
    '//=': 'generateFloorDivAssign',
    '..': 'generateRange',

    // Assignment operators (shared method)
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
    '::': 'generatePrototype',
    '?::': 'generateOptionalPrototype',
    '[]': 'generateIndexAccess',
    '?[]': 'generateSoakIndex',
    'optindex': 'generateOptIndex',
    'optcall': 'generateOptCall',
    'regex-index': 'generateRegexIndex',

    // Functions
    'def': 'generateDef',
    '->': 'generateThinArrow',
    '=>': 'generateFatArrow',
    'return': 'generateReturn',

    // Reactive primitives
    'signal': 'generateSignal',
    'derived': 'generateDerived',
    'readonly': 'generateReadonly',
    'effect': 'generateEffect',

    // Templates
    'render': 'generateRender',
    'style': 'generateStyle',
    'component': 'generateComponent',

    // Control flow - Simple statements
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

    // Control flow - Complex
    'if': 'generateIf',
    'unless': 'generateIf',
    'for-in': 'generateForIn',
    'for-of': 'generateForOf',
    'for-from': 'generateForFrom',
    'while': 'generateWhile',
    'until': 'generateUntil',
    'try': 'generateTry',
    'throw': 'generateThrow',
    'switch': 'generateSwitch',
    'when': 'generateWhen',

    // Comprehensions
    'comprehension': 'generateComprehension',
    'object-comprehension': 'generateObjectComprehension',

    // Classes
    'class': 'generateClass',
    'super': 'generateSuper',
    '?call': 'generateSoakCall',

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
    this.indentString = '  '; // 2 spaces
    this.comprehensionDepth = 0; // Track nesting to avoid wasteful nested IIFEs
    this.dataSection = options.dataSection; // __DATA__ content if present
    // Initialize reactiveVars from options (for REPL persistence across lines)
    if (options.reactiveVars) {
      this.reactiveVars = new Set(options.reactiveVars);
    }
  }

  /**
   * Main entry point: Compile s-expression to JavaScript
   */
  compile(sexpr) {
    // Track variables: program-level + per-function
    this.programVars = new Set();
    this.functionVars = new Map(); // sexpr → Set of variable names
    this.helpers = new Set(); // Track needed helper functions (modulo, etc.)

    // First pass: collect program-level variables
    this.collectProgramVariables(sexpr);

    // Generate code
    const code = this.generate(sexpr);

    return code;
  }

  /**
   * Collect program-level variables (don't recurse into functions)
   */
  collectProgramVariables(sexpr) {
    if (!Array.isArray(sexpr)) return;

    let [head, ...rest] = sexpr;

    // Preserve async sigil metadata and invert flag before converting to primitive
    const headAwaitMetadata = (head instanceof String) ? head.await : undefined;
    const headInvertMetadata = (head instanceof String) ? head.invert : undefined;

    // Convert head to primitive
    if (head instanceof String) {
      head = head.valueOf();
    }

    // Restore metadata on the primitive sexpr[0] (mutation is OK - we own this sexpr)
    if (headAwaitMetadata !== undefined) sexpr[0].await = headAwaitMetadata;
    if (headInvertMetadata !== undefined) sexpr[0].invert = headInvertMetadata;

    // If head is an array (branch containing multiple statements), recurse into each
    if (Array.isArray(head)) {
      sexpr.forEach(item => this.collectProgramVariables(item));
      return;
    }

    // Export - don't collect variables from export assignments (they're declared inline)
    if (head === 'export' || head === 'export-default' || head === 'export-all' || head === 'export-from') {
      return; // Don't collect vars from exports
    }

    // Reactive assignments declare their own const - track them but don't add to programVars
    if (head === 'signal' || head === 'derived' || head === 'readonly') {
      const [target] = rest;
      const varName = typeof target === 'string' ? target : target.valueOf();
      if (!this.reactiveVars) this.reactiveVars = new Set();
      this.reactiveVars.add(varName);
      return; // These generate const declarations
    }

    // Assignment - track the target at program level
    if (CodeGenerator.ASSIGNMENT_OPS.has(head)) {
      const [target, value] = rest;

      // Simple variable assignment (including String objects with sigils)
      // Skip if it's a reactive variable (already declared as const)
      if (typeof target === 'string' || target instanceof String) {
        const varName = target instanceof String ? target.valueOf() : target;
        if (!this.reactiveVars?.has(varName)) {
          this.programVars.add(varName);
        }
      }
      // Array destructuring: ["array", item1, item2, ...]
      else if (Array.isArray(target) && target[0] === 'array') {
        this.collectVarsFromArray(target, this.programVars);
      }
      // Object destructuring: ["object", [key, value, operator], ...]
      else if (Array.isArray(target) && target[0] === 'object') {
        this.collectVarsFromObject(target, this.programVars);
      }

      // Recurse into value expression only
      this.collectProgramVariables(value);
      return;
    }

    // def/arrow functions - DON'T recurse (they have their own scope)
    if (head === 'def' || head === '->' || head === '=>') {
      return; // Stop - don't collect from function bodies
    }

    // component - DON'T recurse (components have their own scope)
    if (head === 'component') {
      return; // Stop - don't collect from component bodies
    }

    // If/unless - recurse into branches (assignments in conditionals still need hoisting)
    if (head === 'if') {
      const [condition, thenBranch, elseBranch] = rest;
      this.collectProgramVariables(condition);
      this.collectProgramVariables(thenBranch);
      if (elseBranch) {
        this.collectProgramVariables(elseBranch);
      }
      return;
    }

    if (head === 'unless') {
      const [condition, body] = rest;
      this.collectProgramVariables(condition);
      this.collectProgramVariables(body);
      return;
    }

    // Try-catch - program-level try blocks (extract catch destructuring vars)
    if (head === 'try') {
      this.collectProgramVariables(rest[0]);

      // Check for catch clause with destructuring
      if (rest.length >= 2 && Array.isArray(rest[1]) && rest[1].length === 2 && rest[1][0] !== 'block') {
        const [param, catchBlock] = rest[1];

        // Extract vars from catch destructuring patterns
        if (param && Array.isArray(param) && param[0] === 'object') {
          param.slice(1).forEach(pair => {
            if (Array.isArray(pair) && pair.length === 2) {
              const varName = pair[1];
              if (typeof varName === 'string') {
                this.programVars.add(varName);
              }
            }
          });
        } else if (param && Array.isArray(param) && param[0] === 'array') {
          param.slice(1).forEach(item => {
            if (typeof item === 'string') {
              this.programVars.add(item);
            }
          });
        }

        this.collectProgramVariables(catchBlock);
      }

      // Finally block
      if (rest.length === 3) {
        this.collectProgramVariables(rest[2]);
      } else if (rest.length === 2 && (!Array.isArray(rest[1]) || rest[1][0] === 'block')) {
        this.collectProgramVariables(rest[1]);
      }

      return;
    }

    // Recursively process all sub-expressions (except functions)
    rest.forEach(item => this.collectProgramVariables(item));
  }

  /**
   * Collect variables from a function body
   * Returns Set of variable names to hoist
   */
  collectFunctionVariables(body) {
    const vars = new Set();

    const collect = (sexpr) => {
      if (!Array.isArray(sexpr)) return;

      let [head, ...rest] = sexpr;

      // Convert head to primitive
      if (head instanceof String) {
        head = head.valueOf();
      }

      // If head is an array (wrapped statements/expressions), recurse into each
      if (Array.isArray(head)) {
        sexpr.forEach(item => collect(item));
        return;
      }

      // Assignment - track variable
      if (CodeGenerator.ASSIGNMENT_OPS.has(head)) {
        const [target, value] = rest;

        // Simple variable assignment
        if (typeof target === 'string') {
          vars.add(target);
        }
        // Array destructuring
        else if (Array.isArray(target) && target[0] === 'array') {
          this.collectVarsFromArray(target, vars);
        }
        // Object destructuring
        else if (Array.isArray(target) && target[0] === 'object') {
          this.collectVarsFromObject(target, vars);
        }

        collect(value);
        return;
      }

      // Nested functions - STOP (they have their own scope)
      if (head === 'def' || head === '->' || head === '=>') {
        return;
      }

      // Try-catch in function
      if (head === 'try') {
        collect(rest[0]);

        // Catch destructuring variables
        if (rest.length >= 2 && Array.isArray(rest[1]) && rest[1].length === 2 && rest[1][0] !== 'block') {
          const [param, catchBlock] = rest[1];

          if (param && Array.isArray(param) && param[0] === 'object') {
            param.slice(1).forEach(pair => {
              if (Array.isArray(pair) && pair.length === 2 && typeof pair[1] === 'string') {
                vars.add(pair[1]);
              }
            });
          } else if (param && Array.isArray(param) && param[0] === 'array') {
            param.slice(1).forEach(item => {
              if (typeof item === 'string') {
                vars.add(item);
              }
            });
          }

          collect(catchBlock);
        }

        if (rest.length === 3) {
          collect(rest[2]);
        } else if (rest.length === 2 && (!Array.isArray(rest[1]) || rest[1][0] === 'block')) {
          collect(rest[1]);
        }

        return;
      }

      // Recurse into all sub-expressions
      rest.forEach(item => collect(item));
    };

    collect(body);
    return vars;
  }

  /**
   * Generate code from s-expression
   *
   * @param {*} sexpr - S-expression from parser
   * @param {string} context - 'statement' or 'value' (for context-aware generation)
   * @returns {string} Generated JavaScript code
   */
  generate(sexpr, context = 'statement') {
    // IMPORTANT: Parser can emit String objects (not primitives)
    // String literals have .quote property - preserve original quote type
    if (sexpr instanceof String) {
      // DAMMIT OPERATOR (!): Check if identifier has .await = true
      // The ! operator ALWAYS calls the function (even without parens)
      // The ! operator USUALLY adds await (unless & punt operator overrides)
      // Examples:
      //   fetchData! → await fetchData() (.await = true)
      //   &fetchData! → fetchData() (.await = false from &, but ! still forces call)
      if (sexpr.await === true) {
        const cleanName = sexpr.valueOf();
        return `await ${cleanName}()`;
      }

      // TODO: PUNT OPERATOR (&): When implemented
      // if (sexpr.await === false) {
      //   const cleanName = sexpr.valueOf();
      //   // & on bare identifier with ! → call without await
      //   // & on bare identifier without ! → just a reference (no call)
      //   // For now, & is not implemented, so this won't trigger
      //   return `${cleanName}()`;  // when ! is also present
      // }

      // HEREGEX SUPPORT: Check if this is a heregex (extended regex with comments/whitespace)
      if (sexpr.delimiter === '///' && sexpr.heregex) {
        // Heregex: value is "/pattern/flags", extract and process
        const primitive = sexpr.valueOf();
        const match = primitive.match(/^\/(.*)\/([gimsuvy]*)$/s);
        if (match) {
          const [, pattern, flags] = match;
          // Process heregex: strip whitespace and comments (inline for clarity)
          const processed = this.processHeregex(pattern);
          return `/${processed}/${flags}`;
        }
        // Fallback: return as-is
        return primitive;
      }

      if (sexpr.quote) {
        const primitive = sexpr.valueOf();
        const originalQuote = sexpr.quote;

        // Heredoc (triple-quoted strings) - convert to template literal
        if (originalQuote === '"""' || originalQuote === "'''") {
          let content = this.extractStringContent(sexpr);

          // Escape for template literal
          content = content.replace(/`/g, '\\`').replace(/\${/g, '\\${');
          return `\`${content}\``;
        }

        // Regular quotes - preserve original quote type
        if (primitive[0] === originalQuote) {
          return primitive;
        }

        // Swap quotes (lexer normalized)
        const content = primitive.slice(1, -1);
        return `${originalQuote}${content}${originalQuote}`;
      }

      // No quote metadata - convert to primitive
      sexpr = sexpr.valueOf();
    }

    // Primitives (literals that parser emits as strings/numbers)
    if (typeof sexpr === 'string') {
      // String literals should be String objects with metadata
      // If we get a quoted primitive, something unexpected happened
      if (sexpr.startsWith('"') || sexpr.startsWith("'") || sexpr.startsWith('`')) {
        // Warn but handle gracefully
        if (this.options.debug) {
          console.warn('[Rip] Unexpected quoted primitive string (should be String object):', sexpr);
        }

        // Fallback to simple processing
        const content = sexpr.slice(1, -1);

        // Multi-line: use template literal
        if (content.includes('\n')) {
          return `\`${content.replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\``;
        }

        // Single-line: prefer single quotes
        const preferredDelimiter = content.includes("'") && !content.includes('"') ? '"' : "'";
        const escaped = content.replace(new RegExp(preferredDelimiter, 'g'), `\\${preferredDelimiter}`);
        return `${preferredDelimiter}${escaped}${preferredDelimiter}`;
      }

      // Keywords and identifiers (true, false, null, undefined, this, variable names)
      // Note: This is NOT where we check for dammit operator (!)
      // The ! is only meaningful at CALL sites, not identifier references
      // e.g., `x = fetchData` assigns the function, `x = fetchData!` calls it

      // Auto-unwrap reactive variables (signals/computed) by adding .value
      if (this.reactiveVars?.has(sexpr) && !this.suppressReactiveUnwrap) {
        return `${sexpr}.value`;
      }
      return sexpr;
    }

    if (typeof sexpr === 'number') {
      return String(sexpr);
    }

    if (sexpr === null || sexpr === undefined) {
      return 'null';
    }

    // Must be an array (s-expression)
    if (!Array.isArray(sexpr)) {
      throw new Error(`Invalid s-expression: ${JSON.stringify(sexpr)}`);
    }

    let [head, ...rest] = sexpr;

    // Preserve async sigil metadata before converting to primitive
    const headAwaitMetadata = (head instanceof String) ? head.await : undefined;

    // Convert head to primitive if it's a String object (for switch matching)
    if (head instanceof String) {
      head = head.valueOf();
    }

    // Dispatch table lookup (O(1) instead of O(n) switch)
    const generatorMethod = CodeGenerator.GENERATORS[head];
    if (generatorMethod) {
      return this[generatorMethod](head, rest, context, sexpr);
    }

    // Fallback: Handle function calls
    // All 110 operations handled by dispatch table above

    //=========================================================================
    // FUNCTION CALLS (Dynamic - can't use dispatch table)
    //=========================================================================

    // If we get here with an array, it might be a function call
    // Function calls: [callee, ...args] where callee is identifier or expression

    // Check if this looks like a function call
    // (array where first element is not a known operator/keyword)
    if (typeof head === 'string' && !head.startsWith('"') && !head.startsWith("'")) {
      // Check if it's a number literal (would start with digit or -)
      if (CodeGenerator.NUMBER_START_REGEX.test(head)) {
        // It's a number literal, not a function call - just return it
        return head;
      }

      // Special case: super() in a method → super.methodName()
      if (head === 'super' && this.currentMethodName && this.currentMethodName !== 'constructor') {
        const args = rest.map(arg => this.unwrap(this.generate(arg, 'value'))).join(', ');
        return `super.${this.currentMethodName}(${args})`;
      }

      // Check if any argument has postfix unless/if (including nested in binary ops)
      // Pattern: f(val unless cond) → if (!cond) f(val)
      // Pattern: f(x + val unless cond) → if (!cond) f(x + val)
      if (context === 'statement' && rest.length === 1) {
        const conditional = this.findPostfixConditional(rest[0]);
        if (conditional) {
          // Rebuild the argument without the conditional
          let argWithoutConditional;
          if (conditional.parentOp) {
            // Nested in binary op: x + (val unless cond) → x + val
            const unwrappedValue = Array.isArray(conditional.value) && conditional.value.length === 1
              ? conditional.value[0] : conditional.value;
            argWithoutConditional = [conditional.parentOp, ...conditional.otherOperands, unwrappedValue];
          } else {
            // Direct: val unless cond → val
            argWithoutConditional = Array.isArray(conditional.value) && conditional.value.length === 1
              ? conditional.value[0] : conditional.value;
          }

          const calleeName = this.generate(head, 'value');
          const condCode = this.generate(conditional.condition, 'value');
          const valueCode = this.generate(argWithoutConditional, 'value');
          const callStr = `${calleeName}(${valueCode})`;

          if (conditional.type === 'unless') {
            return `if (!${condCode}) ${callStr}`;
          } else {
            return `if (${condCode}) ${callStr}`;
          }
        }
      }

      // It's an identifier - treat as function call
      // Use the preserved metadata from before head was converted to primitive
      const needsAwait = headAwaitMetadata === true;

      // Generate identifier (name already has sigils stripped by lexer)
      const calleeName = this.generate(head, 'value');
      const args = rest.map(arg => this.unwrap(this.generate(arg, 'value'))).join(', ');
      const callStr = `${calleeName}(${args})`;

      return needsAwait ? `await ${callStr}` : callStr;
    }

    // Check if this is a parenthetical statement sequence (comma operator)
    // Pattern: [stmt1, stmt2] where head is a statement (not a callable expression)
    // Example: (x = 1; y = 2) → [["=", "x", "1"], ["=", "y", "2"]]
    if (Array.isArray(head) && typeof head[0] === 'string') {
      // Head has an operator - check if it's a statement operator
      const statementOps = ['=', '+=', '-=', '*=', '/=', '%=', '**=', '&&=', '||=', '??=',
                            'if', 'unless', 'return', 'throw'];
      if (statementOps.includes(head[0])) {
        // It's a statement sequence - use comma operator
        const exprs = sexpr.map(stmt => this.generate(stmt, 'value'));
        return `(${exprs.join(', ')})`;
      }
    }

    // Also handle case where head is itself an expression (like property access)
    if (Array.isArray(head)) {
      // Check if any argument has postfix unless/if (including nested)
      // Pattern: obj.method(val unless cond) → if (!cond) obj.method(val)
      // Pattern: obj.method(x + val unless cond) → if (!cond) obj.method(x + val)
      if (context === 'statement' && rest.length === 1) {
        const conditional = this.findPostfixConditional(rest[0]);
        if (conditional) {
          // Rebuild the argument without the conditional
          let argWithoutConditional;
          if (conditional.parentOp) {
            const unwrappedValue = Array.isArray(conditional.value) && conditional.value.length === 1
              ? conditional.value[0] : conditional.value;
            argWithoutConditional = [conditional.parentOp, ...conditional.otherOperands, unwrappedValue];
          } else {
            argWithoutConditional = Array.isArray(conditional.value) && conditional.value.length === 1
              ? conditional.value[0] : conditional.value;
          }

          const calleeCode = this.generate(head, 'value');
          const condCode = this.generate(conditional.condition, 'value');
          const valueCode = this.generate(argWithoutConditional, 'value');
          const callStr = `${calleeCode}(${valueCode})`;

          if (conditional.type === 'unless') {
            return `if (!${condCode}) ${callStr}`;
          } else {
            return `if (${condCode}) ${callStr}`;
          }
        }
      }

      // Complex callee like obj.method! or arr[0]
      // For property access, check if the property has .await metadata
      let needsAwait = false;
      let calleeCode;

      // Check if it's property access with await sigil on the property
      if (Array.isArray(head) && (head[0] === '.' || head[0] === '::') && head[2] instanceof String && head[2].await === true) {
        // Property has dammit operator - need to await the call
        needsAwait = true;

        // Generate property access without calling it (just the reference)
        // We'll add the call with args below
        const [obj, prop] = head.slice(1);
        const objCode = this.generate(obj, 'value');
        const isNumberLiteral = CodeGenerator.NUMBER_LITERAL_REGEX.test(objCode);
        const isObjectLiteral = Array.isArray(obj) && obj[0] === 'object';
        const isAwaitOrYield = Array.isArray(obj) && (obj[0] === 'await' || obj[0] === 'yield');
        const needsParens = isNumberLiteral || isObjectLiteral || isAwaitOrYield;
        const base = needsParens ? `(${objCode})` : objCode;
        const cleanProp = prop.valueOf();

        if (head[0] === '::') {
          calleeCode = `${base}.prototype.${cleanProp}`;
        } else {
          calleeCode = `${base}.${cleanProp}`;
        }
      } else {
        // Normal callee - just generate it
        calleeCode = this.generate(head, 'value');
      }

      const args = rest.map(arg => this.unwrap(this.generate(arg, 'value'))).join(', ');
      const callStr = `${calleeCode}(${args})`;

      return needsAwait ? `await ${callStr}` : callStr;
    }

    throw new Error(`Unknown s-expression type: ${head}`);
  }

  /**
   * Generate program (top-level)
   * Pattern: ["program", ...statements]
   */

  generateProgram(head, statements, context, sexpr) {
    let code = '';

    // Separate imports/exports from other statements (ES6 modules require imports at top)
    const imports = [];
    const exports = [];
    const otherStatements = [];

    statements.forEach(stmt => {
      if (Array.isArray(stmt)) {
        const head = stmt[0];
        if (head === 'import') {
          imports.push(stmt);
        } else if (head === 'export' || head === 'export-default' || head === 'export-all' || head === 'export-from') {
          exports.push(stmt);
        } else {
          otherStatements.push(stmt);
        }
      } else {
        otherStatements.push(stmt);
      }
    });

    // Generate statements FIRST (into temp variable) to detect what helpers are needed
    const statementsCode = otherStatements
      .map((stmt, index) => {
        // For single-statement programs with object literals AND no var declarations,
        // wrap in parens to avoid ambiguity with labeled statements in eval() contexts
        // BUT only if there are no variable declarations (which would disambiguate)
        // AND exclude comprehensions/do-iife which are already expressions
        const isSingleStmt = otherStatements.length === 1 && imports.length === 0 && exports.length === 0;
        const isObjectLiteral = Array.isArray(stmt) && stmt[0] === 'object';

        // Check if it's actually an object comprehension (disguised as object with comprehension inside)
        const isObjectComprehension = isObjectLiteral && stmt.length === 2 &&
          Array.isArray(stmt[1]) && Array.isArray(stmt[1][1]) && stmt[1][1][0] === 'comprehension';

        const isAlreadyExpression = Array.isArray(stmt) &&
          (stmt[0] === 'comprehension' || stmt[0] === 'object-comprehension' || stmt[0] === 'do-iife');
        const hasNoVars = this.programVars.size === 0;

        const needsParens = isSingleStmt && isObjectLiteral && hasNoVars && !isAlreadyExpression && !isObjectComprehension;

        // Special case: comprehension as last statement (REPL/test mode) should return array
        // Comprehensions at the end of a program should collect results
        const isLastStmt = index === otherStatements.length - 1;
        const isLastComprehension = isLastStmt && isAlreadyExpression;

        // Generate with appropriate context
        let generated;
        if (needsParens) {
          generated = `(${this.generate(stmt, 'value')})`;
        } else if (isLastComprehension) {
          // Last comprehension at program level - generate as value (builds array for REPL/testing)
          generated = this.generate(stmt, 'value');
        } else {
          generated = this.generate(stmt, 'statement');
        }

        // Add semicolon if not already present and not empty
        if (generated && !generated.endsWith(';')) {
          // Check if this statement type needs a semicolon
          const head = Array.isArray(stmt) ? stmt[0] : null;
          // Block statements ending with } don't need semicolons
          const blockStatements = ['def', 'class', 'if', 'unless', 'for-in', 'for-of', 'for-from', 'while', 'until', 'loop', 'switch', 'try'];
          const isBlockStatement = blockStatements.includes(head);

          if (!isBlockStatement || !generated.endsWith('}')) {
            return generated + ';';
          }
        }
        return generated;
      })
      .join('\n');

    // Now assemble in proper order (statements already generated to detect helpers)
    let needsBlankLine = false;

    // 1. Generate imports first (ES6 requirement)
    if (imports.length > 0) {
      code += imports.map(stmt => this.addSemicolon(stmt, this.generate(stmt, 'statement'))).join('\n');
      needsBlankLine = true;
    }

    // 2. Emit variable declarations (after imports)
    if (this.programVars.size > 0) {
      const vars = Array.from(this.programVars).sort().join(', ');
      if (needsBlankLine) {
        code += '\n';  // Blank line after imports
      }
      code += `let ${vars};\n`;
      needsBlankLine = true;
    }

    // 3. Emit helper functions (after let declarations, before statements)
    if (this.helpers.has('slice')) {
      code += 'const slice = [].slice;\n';
      needsBlankLine = true;
    }
    if (this.helpers.has('modulo')) {
      code += 'const modulo = (n, d) => { n = +n; d = +d; return (n % d + d) % d; };\n';
      needsBlankLine = true;
    }
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
      needsBlankLine = true;
    }

    // 3b. Emit reactive runtime if used (unless skipRuntime option is set)
    if (this.usesReactivity && !this.options.skipReactiveRuntime) {
      code += this.getReactiveRuntime();
      needsBlankLine = true;
    }

    // 4. Initialize DATA if __DATA__ section present
    if (this.dataSection !== null && this.dataSection !== undefined) {
      code += 'var DATA;\n';
      code += '_setDataSection();\n';
      needsBlankLine = true;
    }

    // 5. Space between generated header and body (only if we generated a header)
    if (needsBlankLine && code.length > 0) {
      code += '\n';
    }

    // 6. Add statements
    code += statementsCode;

    // 7. Generate exports (after statements)
    if (exports.length > 0) {
      code += '\n' + exports.map(stmt => this.addSemicolon(stmt, this.generate(stmt, 'statement'))).join('\n');
    }

    // 8. Define DATA initialization function at the end
    if (this.dataSection !== null && this.dataSection !== undefined) {
      code += `\n\nfunction _setDataSection() {\n  DATA = ${JSON.stringify(this.dataSection)};\n}`;
    }

    return code;
  }

  //-------------------------------------------------------------------------
  // OPERATORS - Binary
  //-------------------------------------------------------------------------

  /**
   * Generate binary operators (arithmetic, comparison, bitwise, coalescing)
   * Shared method for: +, -, *, /, %, **, ==, !=, <, >, <=, >=, ??, !?, &, |, ^, <<, >>, >>>
   * Pattern: [op, left, right] → (left op right)
   */
  generateBinaryOp(op, rest, context, sexpr) {
    // Special case: +/- can also be unary
    if ((op === '+' || op === '-') && rest.length === 1) {
      const [operand] = rest;
      return `(${op}${this.generate(operand, 'value')})`;
    }

    // Binary operation
    const [left, right] = rest;

    // Special case: Otherwise operator (!?) - undefined-only coalescing
    // Pattern: a !? b → (a !== undefined ? a : b)
    if (op === '!?') {
      const leftCode = this.generate(left, 'value');
      const rightCode = this.generate(right, 'value');
      return `(${leftCode} !== undefined ? ${leftCode} : ${rightCode})`;
    }

    // Always use strict equality (CoffeeScript compatibility)
    // == → ===, != → !==
    if (op === '==') op = '===';
    if (op === '!=') op = '!==';

    return `(${this.generate(left, 'value')} ${op} ${this.generate(right, 'value')})`;
  }

  /**
   * Generate modulo operator (%%)
   * Pattern: ["%%", left, right] → modulo(left, right)
   */
  generateModulo(head, rest, context, sexpr) {
    const [left, right] = rest;
    this.helpers.add('modulo');
    return `modulo(${this.generate(left, 'value')}, ${this.generate(right, 'value')})`;
  }

  /**
   * Generate floor division (//)
   * Pattern: ["//", left, right] → Math.floor(left / right)
   */
  generateFloorDiv(head, rest, context, sexpr) {
    const [left, right] = rest;
    return `Math.floor(${this.generate(left, 'value')} / ${this.generate(right, 'value')})`;
  }

  /**
   * Generate floor division assignment (//=)
   * Pattern: ["//=", target, value] → target = Math.floor(target / value)
   */
  generateFloorDivAssign(head, rest, context, sexpr) {
    const [target, value] = rest;
    const targetCode = this.generate(target, 'value');
    const valueCode = this.generate(value, 'value');
    return `${targetCode} = Math.floor(${targetCode} / ${valueCode})`;
  }

  //-------------------------------------------------------------------------
  // ASSIGNMENT OPERATORS
  //-------------------------------------------------------------------------

  /**
   * Generate assignment operators (=, +=, -=, etc.)
   * Pattern: ["=", target, value] or ["+=", target, value], etc.
   * This is one of the most complex generators due to special cases
   */
  generateAssignment(head, rest, context, sexpr) {
    const [target, value] = rest;
    // Map ?= to ??= for simplicity (close semantics)
    const op = head === '?=' ? '??=' : head;

    // VALIDATION: Prevent async sigils in assignment targets
    // ! and & are for call-sites only, not variable names
    // EXCEPTION: Allow ! sigil when assigning a function (void function syntax)
    const isFunctionValue = Array.isArray(value) && (value[0] === '->' || value[0] === '=>' || value[0] === 'def');
    if (target instanceof String && target.await !== undefined && !isFunctionValue) {
      const sigil = target.await === true ? '!' : '&';
      throw new Error(`Cannot use ${sigil} sigil in variable declaration '${target.valueOf()}'. Sigils are only for call-sites.`);
    }

    // If target has ! sigil and value is a function, mark it as side-effect only
    const targetHasVoidSigil = target instanceof String && target.await === true;
    if (targetHasVoidSigil && isFunctionValue) {
      // Store the void flag so arrow functions can pick it up
      this.nextFunctionIsVoid = true;
    }

    // Check for empty destructuring patterns - just evaluate RHS
    const isEmptyArray = Array.isArray(target) && target[0] === 'array' && target.length === 1;
    const isEmptyObject = Array.isArray(target) && target[0] === 'object' && target.length === 1;

    if (isEmptyArray || isEmptyObject) {
      // Empty destructuring: just evaluate the value for side effects
      const valueCode = this.generate(value, 'value');
      // Wrap objects in parens to avoid being interpreted as block statement
      if (isEmptyObject && context === 'statement') {
        return `(${valueCode})`;
      }
      return valueCode;
    }

    // Check for middle/leading rest in array destructuring
    if (Array.isArray(target) && target[0] === 'array') {
      const restIndex = target.slice(1).findIndex(el =>
        Array.isArray(el) && el[0] === '...' ||
        el === '...'  // Bare rest marker
      );

      if (restIndex !== -1 && restIndex < target.length - 2) {
        // Rest is not at end - need splice approach
        const elements = target.slice(1);
        const elementsAfterRest = elements.slice(restIndex + 1);

        // Count how many elements (including elisions) after rest
        const afterCount = elementsAfterRest.length;

        if (afterCount > 0) {
          // Generate multi-statement destructuring
          const valueCode = this.generate(value, 'value');

          // Build pattern for everything UP TO rest (not including it)
          const beforeRest = elements.slice(0, restIndex);
          const beforePattern = beforeRest.map(el => {
            if (el === ',') return '';
            if (typeof el === 'string') return el;
            return this.generate(el, 'value');
          }).join(', ');

          // Build pattern for elements after rest
          const afterPattern = elementsAfterRest.map(el => {
            if (el === ',') return '';
            if (typeof el === 'string') return el;
            return this.generate(el, 'value');
          }).join(', ');

          // Need slice helper
          this.helpers.add('slice');

          // Collect variables from destructuring pattern for hoisting
          const collectVars = (els) => {
            els.forEach(el => {
              if (el === ',' || el === '...') return;
              if (typeof el === 'string') this.programVars.add(el);
              else if (Array.isArray(el) && el[0] === '...') {
                if (typeof el[1] === 'string') this.programVars.add(el[1]);
              }
            });
          };
          collectVars(elements);

          // Get the rest variable name
          const restElement = elements[restIndex];
          const restVarName = Array.isArray(restElement) && restElement[0] === '...'
            ? restElement[1]
            : null;

          const statements = [];

          // First: destructure before rest (if any)
          if (beforePattern) {
            statements.push(`[${beforePattern}] = ${valueCode}`);
          }

          // Second: assign rest variable (the middle portion)
          if (restVarName) {
            statements.push(`[...${restVarName}] = ${valueCode}.slice(${restIndex}, -${afterCount})`);
          }

          // Third: destructure after rest
          statements.push(`[${afterPattern}] = slice.call(${valueCode}, -${afterCount})`);

          // Return comma-separated statements
          return statements.join(', ');
        }
      }
    }

    // Special case: postfix if/unless on assignment with || operator
    // Pattern: x = a or b unless cond → parser groups as: x = (a || (b unless cond))
    // Should generate: if (!cond) { x = a || b }
    // Not: x = a || (unless cond then b else undefined)
    if (context === 'statement' && head === '=' && Array.isArray(value) &&
        (value[0] === '||' || value[0] === '&&') && value.length === 3) {
      const [binaryOp, left, right] = value;

      // Check if right operand is postfix unless/if
      if (Array.isArray(right) && (right[0] === 'unless' || right[0] === 'if') && right.length === 3) {
        const [condType, condition, wrappedValue] = right;
        // Unwrap the value
        const unwrappedValue = Array.isArray(wrappedValue) && wrappedValue.length === 1 ? wrappedValue[0] : wrappedValue;

        // Reconstruct the full binary expression without the conditional
        const fullValue = [binaryOp, left, unwrappedValue];
        const targetCode = this.generate(target, 'value');
        const condCode = this.generate(condition, 'value');
        const valueCode = this.generate(fullValue, 'value');

        if (condType === 'unless') {
          return `if (!${condCode}) ${targetCode} = ${valueCode}`;
        } else {
          return `if (${condCode}) ${targetCode} = ${valueCode}`;
        }
      }
    }

    // Special case: postfix if/unless on assignment (WITHOUT else clause)
    // Pattern: x = 5 unless cond → if (!cond) x = 5;
    // This prevents the broken ternary: x = (!cond ? 5 : undefined)
    // IMPORTANT: Only for POSTFIX (simple body) - prefix if/else should use ternary!
    if (context === 'statement' && head === '=' && Array.isArray(value) && value.length === 3) {
      const valueHead = value[0];
      const [_, condition, actualValue] = value;

      // Check if this is POSTFIX (simple body, not a block)
      // Postfix: x = 5 if cond → ["unless", cond, ["5"]] (array wrapping single value)
      // Prefix:  x = if cond then 5 → ["if", cond, ["block", "5"]] (block wrapper)
      const isPostfix = Array.isArray(actualValue) &&
                       actualValue.length === 1 &&
                       (!Array.isArray(actualValue[0]) || actualValue[0][0] !== 'block');

      if ((valueHead === 'unless' || valueHead === 'if') && isPostfix) {
        // Unwrap array body (postfix wraps value in array)
        let unwrappedValue = actualValue;
        // Unwrap one level: [["object"]] → ["object"], ["5"] → "5"
        if (Array.isArray(actualValue) && actualValue.length === 1) {
          unwrappedValue = actualValue[0];
        }

        const targetCode = this.generate(target, 'value');
        let condCode = this.unwrapLogical(this.generate(condition, 'value'));
        const valueCode = this.generate(unwrappedValue, 'value');

        if (valueHead === 'unless') {
          // Re-wrap for negation if needed for precedence
          if (condCode.includes(' ') || condCode.includes('===') || condCode.includes('!==') ||
              condCode.includes('>') || condCode.includes('<') || condCode.includes('&&') || condCode.includes('||')) {
            condCode = `(${condCode})`;
          }
          return `if (!${condCode}) ${targetCode} = ${valueCode}`;
        } else {
          return `if (${condCode}) ${targetCode} = ${valueCode}`;
        }
      }
    }

    // Generate target code (strip ! sigil metadata for assignment LHS)
    // Handle reactive variable assignments: count = 20 → count.value = 20
    let targetCode;
    if (target instanceof String && target.await !== undefined) {
      // Target has sigil - just use the clean name (don't apply dammit operator)
      targetCode = target.valueOf();
    } else if (typeof target === 'string' && this.reactiveVars?.has(target)) {
      // Simple reactive variable assignment: count = 20 → count.value = 20
      targetCode = `${target}.value`;
    } else {
      // Suppress reactive unwrap for other assignment targets (property access, etc.)
      // This prevents count.value = 20 from becoming count.value.value = 20
      this.suppressReactiveUnwrap = true;
      targetCode = this.generate(target, 'value');
      this.suppressReactiveUnwrap = false;
    }

    let valueCode = this.generate(value, 'value');

    // Unwrap value in assignment context (= is already a delimiter)
    // BUT keep parens for object literals to avoid ambiguity with blocks
    const isObjectLiteral = Array.isArray(value) && value[0] === 'object';
    if (!isObjectLiteral) {
      valueCode = this.unwrap(valueCode);
    }

    // Assignments need parens when used as sub-expressions (in value context)
    // Exception: Top-level assignment in assignment chain (a = b = c) doesn't need parens
    const needsParensForValue = context === 'value';

    // Object destructuring requires parens in statement context
    // ({x, y} = obj) not {x, y} = obj
    const needsParensForObject = context === 'statement' && Array.isArray(target) && target[0] === 'object';

    if (needsParensForValue || needsParensForObject) {
      return `(${targetCode} ${op} ${valueCode})`;
    }

    return `${targetCode} ${op} ${valueCode}`;
  }

  //-------------------------------------------------------------------------
  // PROPERTY ACCESS
  //-------------------------------------------------------------------------

  /**
   * Generate property access (.)
   * Pattern: [".", object, "property"]
   */
  generatePropertyAccess(head, rest, context, sexpr) {
    const [obj, prop] = rest;

    // Don't auto-unwrap reactive vars when accessing their methods/properties
    // e.g., count.read() should NOT become count.value.read()
    this.suppressReactiveUnwrap = true;
    const objCode = this.generate(obj, 'value');
    this.suppressReactiveUnwrap = false;

    // Wrap numeric literals, object literals, await, and yield in parens
    const isNumberLiteral = CodeGenerator.NUMBER_LITERAL_REGEX.test(objCode);
    const isObjectLiteral = Array.isArray(obj) && obj[0] === 'object';
    const isAwaitOrYield = Array.isArray(obj) && (obj[0] === 'await' || obj[0] === 'yield');
    const needsParens = isNumberLiteral || isObjectLiteral || isAwaitOrYield;
    const base = needsParens ? `(${objCode})` : objCode;

    // DAMMIT OPERATOR on property: obj.method!
    if (prop instanceof String && prop.await === true) {
      const cleanProp = prop.valueOf();
      return `await ${base}.${cleanProp}()`;
    }

    const cleanProp = prop instanceof String ? prop.valueOf() : prop;
    return `${base}.${cleanProp}`;
  }

  /**
   * Generate optional property access (?.)
   * Pattern: ["?.", object, "property"]
   */
  generateOptionalProperty(head, rest, context, sexpr) {
    const [obj, prop] = rest;
    return `${this.generate(obj, 'value')}?.${prop}`;
  }

  /**
   * Generate prototype access (::)
   * Pattern: ["::", object, "property"]
   */
  generatePrototype(head, rest, context, sexpr) {
    const [obj, prop] = rest;
    const objCode = this.generate(obj, 'value');

    if (prop === 'prototype') {
      return `${objCode}.prototype`;
    }

    const cleanProp = prop instanceof String ? prop.valueOf() : prop;
    return `${objCode}.prototype.${cleanProp}`;
  }

  /**
   * Generate soak prototype (?::)
   * Pattern: ["?::", object, "property"]
   */
  generateOptionalPrototype(head, rest, context, sexpr) {
    const [obj, prop] = rest;
    const objCode = this.generate(obj, 'value');

    if (prop === 'prototype') {
      return `(${objCode} != null ? ${objCode}.prototype : undefined)`;
    }
    return `(${objCode} != null ? ${objCode}.prototype.${prop} : undefined)`;
  }

  /**
   * Generate regex index
   * Pattern: ["regex-index", value, regex, captureIndex]
   */
  generateRegexIndex(head, rest, context, sexpr) {
    const [value, regex, captureIndex] = rest;

    this.helpers.add('toSearchable');
    this.programVars.add('_');

    const valueCode = this.generate(value, 'value');
    const regexCode = this.generate(regex, 'value');
    const indexCode = captureIndex !== null ? this.generate(captureIndex, 'value') : '0';

    const hasMultilineFlag = regexCode.includes('/m');
    const allowNewlines = hasMultilineFlag ? ', true' : '';

    return `(_ = toSearchable(${valueCode}${allowNewlines}).match(${regexCode})) && _[${indexCode}]`;
  }

  /**
   * Generate index access ([])
   * Pattern: ["[]", array, index] or ["[]", array, range]
   */
  generateIndexAccess(head, rest, context, sexpr) {
    const [arr, index] = rest;

    // Check if index is a range (slicing operation)
    if (Array.isArray(index) && (index[0] === '..' || index[0] === '...')) {
      const isInclusive = index[0] === '..';
      const arrCode = this.generate(arr, 'value');
      const [start, end] = index.slice(1);

      // Handle different slice patterns
      if (start === null && end === null) {
        return `${arrCode}.slice()`;
      } else if (start === null) {
        if (isInclusive && this.isNegativeOneLiteral(end)) {
          return `${arrCode}.slice(0)`;
        }

        const endCode = this.generate(end, 'value');
        if (isInclusive) {
          return `${arrCode}.slice(0, +${endCode} + 1 || 9e9)`;
        } else {
          return `${arrCode}.slice(0, ${endCode})`;
        }
      } else if (end === null) {
        const startCode = this.generate(start, 'value');
        return `${arrCode}.slice(${startCode})`;
      } else {
        const startCode = this.generate(start, 'value');

        if (isInclusive && this.isNegativeOneLiteral(end)) {
          return `${arrCode}.slice(${startCode})`;
        }

        const endCode = this.generate(end, 'value');
        if (isInclusive) {
          return `${arrCode}.slice(${startCode}, +${endCode} + 1 || 9e9)`;
        } else {
          return `${arrCode}.slice(${startCode}, ${endCode})`;
        }
      }
    }

    // Regular indexing
    const indexCode = this.unwrap(this.generate(index, 'value'));
    return `${this.generate(arr, 'value')}[${indexCode}]`;
  }

  /**
   * Generate soak index (?[])
   * Pattern: ["?[]", array, index]
   */
  generateSoakIndex(head, rest, context, sexpr) {
    const [arr, index] = rest;
    const arrCode = this.generate(arr, 'value');
    const indexCode = this.generate(index, 'value');
    return `(${arrCode} != null ? ${arrCode}[${indexCode}] : undefined)`;
  }

  /**
   * Generate optional index (optindex)
   * Pattern: ["optindex", array, index]
   */
  generateOptIndex(head, rest, context, sexpr) {
    const [arr, index] = rest;
    const arrCode = this.generate(arr, 'value');
    const indexCode = this.generate(index, 'value');
    return `${arrCode}?.[${indexCode}]`;
  }

  /**
   * Generate optional call (optcall)
   * Pattern: ["optcall", fn, ...args]
   */
  generateOptCall(head, rest, context, sexpr) {
    const [fn, ...args] = rest;
    const fnCode = this.generate(fn, 'value');
    const argsCode = args.map(arg => this.generate(arg, 'value')).join(', ');
    return `${fnCode}?.(${argsCode})`;
  }

  //-------------------------------------------------------------------------
  // FUNCTIONS
  //-------------------------------------------------------------------------

  /**
   * Generate function definition (def)
   * Pattern: ["def", name, params, body]
   */
  generateDef(head, rest, context, sexpr) {
    const [name, params, body] = rest;

    // Check for ! sigil: suppresses implicit returns (side-effect only function)
    const sideEffectOnly = name instanceof String && name.await === true;
    const cleanName = name instanceof String ? name.valueOf() : name;

    const paramList = this.generateParamList(params);
    const bodyCode = this.generateFunctionBody(body, params, sideEffectOnly);

    // Check if body contains await or yield
    const isAsync = this.containsAwait(body);
    const isGenerator = this.containsYield(body);
    const asyncPrefix = isAsync ? 'async ' : '';
    const generatorSuffix = isGenerator ? '*' : '';

    return `${asyncPrefix}function${generatorSuffix} ${cleanName}(${paramList}) ${bodyCode}`;
  }

  /**
   * Generate thin arrow (->)
   * Pattern: ["->", params, body]
   */
  generateThinArrow(head, rest, context, sexpr) {
    const [params, body] = rest;

    // Check for void function flag (set by assignment with ! sigil)
    const sideEffectOnly = this.nextFunctionIsVoid || false;
    this.nextFunctionIsVoid = false;

    const paramList = this.generateParamList(params);
    const bodyCode = this.generateFunctionBody(body, params, sideEffectOnly);

    // Check if body contains await or yield
    const isAsync = this.containsAwait(body);
    const isGenerator = this.containsYield(body);
    const asyncPrefix = isAsync ? 'async ' : '';
    const generatorSuffix = isGenerator ? '*' : '';

    const fnCode = `${asyncPrefix}function${generatorSuffix}(${paramList}) ${bodyCode}`;

    // In value context, wrap in parens
    return context === 'value' ? `(${fnCode})` : fnCode;
  }

  /**
   * Generate fat arrow (=>)
   * Pattern: ["=>", params, body]
   */
  generateFatArrow(head, rest, context, sexpr) {
    const [params, body] = rest;

    // Check for void function flag
    const sideEffectOnly = this.nextFunctionIsVoid || false;
    this.nextFunctionIsVoid = false;

    const paramList = this.generateParamList(params);

    // Check if we can omit parens (single simple parameter)
    const isSingleSimpleParam = params.length === 1 &&
                               typeof params[0] === 'string' &&
                               !paramList.includes('=') &&
                               !paramList.includes('...') &&
                               !paramList.includes('[') &&
                               !paramList.includes('{');
    const paramSyntax = isSingleSimpleParam ? paramList : `(${paramList})`;

    // Check if body contains await
    const isAsync = this.containsAwait(body);
    const asyncPrefix = isAsync ? 'async ' : '';

    // If sideEffectOnly, always use block form
    if (!sideEffectOnly) {
      // Check if body is a block with single expression
      if (Array.isArray(body) && body[0] === 'block' && body.length === 2) {
        const expr = body[1];
        if (!Array.isArray(expr) || expr[0] !== 'return') {
          return `${asyncPrefix}${paramSyntax} => ${this.generate(expr, 'value')}`;
        }
      }

      // Single expression not in block
      if (!Array.isArray(body) || body[0] !== 'block') {
        return `${asyncPrefix}${paramSyntax} => ${this.generate(body, 'value')}`;
      }
    }

    // Multi-statement block
    const bodyCode = this.generateFunctionBody(body, params, sideEffectOnly);
    return `${asyncPrefix}${paramSyntax} => ${bodyCode}`;
  }

  /**
   * Generate return statement
   * Pattern: ["return"] or ["return", expr]
   */
  generateReturn(head, rest, context, sexpr) {
    if (rest.length === 0) {
      return 'return';
    }

    let [expr] = rest;

    // If in a void function, convert "return expr" to just "return"
    if (this.sideEffectOnly) {
      return 'return';
    }

    // Handle postfix unless/if with return
    if (Array.isArray(expr) && expr[0] === 'unless') {
      const [, condition, body] = expr;
      const value = Array.isArray(body) && body.length === 1 ? body[0] : body;
      return `if (!${this.generate(condition, 'value')}) return ${this.generate(value, 'value')}`;
    }

    if (Array.isArray(expr) && expr[0] === 'if') {
      const [, condition, body, ...elseParts] = expr;
      if (elseParts.length === 0) {
        const value = Array.isArray(body) && body.length === 1 ? body[0] : body;
        return `if (${this.generate(condition, 'value')}) return ${this.generate(value, 'value')}`;
      }
    }

    // Handle special case: return new X unless condition
    if (Array.isArray(expr) && expr[0] === 'new' &&
        Array.isArray(expr[1]) && expr[1][0] === 'unless') {
      const [, unlessNode] = expr;
      const [, condition, body] = unlessNode;
      const value = Array.isArray(body) && body.length === 1 ? body[0] : body;
      return `if (!${this.generate(condition, 'value')}) return ${this.generate(['new', value], 'value')}`;
    }

    return `return ${this.generate(expr, 'value')}`;
  }

  //-------------------------------------------------------------------------
  // REACTIVE PRIMITIVES
  //-------------------------------------------------------------------------

  /**
   * Generate reactive signal (:=)
   * Pattern: ["signal", name, expression]
   * Output: const name = __signal(expression)
   */
  generateSignal(head, rest, context, sexpr) {
    const [name, expr] = rest;
    this.usesReactivity = true;
    // Use raw name (don't auto-unwrap for declaration)
    const varName = typeof name === 'string' ? name : name.valueOf();
    const exprCode = this.generate(expr, 'value');
    // Track this variable as reactive for auto-unwrapping (already done in collectProgramVariables)
    if (!this.reactiveVars) this.reactiveVars = new Set();
    this.reactiveVars.add(varName);
    return `const ${varName} = __signal(${exprCode})`;
  }

  /**
   * Generate derived value (~=)
   * Pattern: ["derived", name, expression]
   * Output: const name = __computed(() => expression)
   */
  generateDerived(head, rest, context, sexpr) {
    const [name, expr] = rest;
    this.usesReactivity = true;
    // Track this variable as reactive for auto-unwrapping
    if (!this.reactiveVars) this.reactiveVars = new Set();
    const varName = typeof name === 'string' ? name : name.valueOf();
    this.reactiveVars.add(varName);
    const exprCode = this.generate(expr, 'value');
    return `const ${varName} = __computed(() => ${exprCode})`;
  }

  /**
   * Generate readonly value (=!)
   * Pattern: ["readonly", name, expression]
   * Output: const name = __readonly(expression)
   */
  generateReadonly(head, rest, context, sexpr) {
    const [name, expr] = rest;
    this.usesReactivity = true;
    // Use raw variable name (don't auto-unwrap)
    const varName = Array.isArray(name) ? name[1] : name;
    const exprCode = this.generate(expr, 'value');
    return `const ${varName} = __readonly(${exprCode})`;
  }

  /**
   * Generate effect (reactive side effect)
   * Pattern: ["effect", block]
   * Output: __effect(() => { block })
   */
  generateEffect(head, rest, context, sexpr) {
    const [body] = rest;
    this.usesReactivity = true;

    // Generate the body
    let bodyCode;
    if (Array.isArray(body) && body[0] === 'block') {
      const statements = body.slice(1);
      const stmts = this.withIndent(() => this.formatStatements(statements));
      bodyCode = `{\n${stmts.join('\n')}\n${this.indent()}}`;
    } else if (Array.isArray(body) && (body[0] === '->' || body[0] === '=>')) {
      // It's already a function, just generate it
      const fnCode = this.generate(body, 'value');
      return `__effect(${fnCode})`;
    } else {
      bodyCode = `{ ${this.generate(body, 'value')}; }`;
    }

    return `__effect(() => ${bodyCode})`;
  }

  //-------------------------------------------------------------------------
  // TEMPLATES - Runtime-based DOM generation using h(), frag(), txt()
  //-------------------------------------------------------------------------

  /**
   * Check if identifier is an HTML tag (handles div#id syntax)
   */
  isHtmlTag(name) {
    // Handle div#main syntax - extract just the tag part
    const tagPart = name.split('#')[0];
    return HTML_TAGS.has(tagPart.toLowerCase());
  }

  /**
   * Check if name is a component (PascalCase)
   * PascalCase names are always components, even if lowercase matches an HTML tag
   * e.g., Button is a component, button is an HTML tag
   */
  isComponent(name) {
    if (!name || typeof name !== 'string') return false;
    // PascalCase = starts with uppercase letter
    return /^[A-Z]/.test(name);
  }

  /**
   * Parse event handler from object key
   * Returns { eventName, modifiers, handler } or null
   */
  parseEventHandler(key, value) {
    // Pattern 1: Simple @event → [".", "this", "eventName"]
    if (Array.isArray(key) && key[0] === '.' && key[1] === 'this' && typeof key[2] === 'string') {
      return { eventName: key[2], modifiers: [], handler: this.generate(value, 'value') };
    }
    // Pattern 2: [@event.modifier] → ["computed", propertyChain]
    if (Array.isArray(key) && key[0] === 'computed') {
      const { eventName, modifiers } = this.extractEventChain(key[1]);
      if (eventName) {
        return { eventName, modifiers, handler: this.generate(value, 'value') };
      }
    }
    return null;
  }

  /**
   * Extract event name and modifiers from property chain
   */
  extractEventChain(chain) {
    const modifiers = [];
    let current = chain;
    while (Array.isArray(current) && current[0] === '.') {
      const [, inner, prop] = current;
      if (Array.isArray(inner) && inner[0] === '.' && inner[1] === 'this') {
        modifiers.unshift(prop);
        return { eventName: inner[2], modifiers };
      }
      if (typeof prop === 'string') modifiers.unshift(prop);
      current = inner;
    }
    if (Array.isArray(current) && current[0] === '.' && current[1] === 'this') {
      return { eventName: current[2], modifiers };
    }
    return { eventName: null, modifiers: [] };
  }

  /**
   * Wrap event handler with modifier code
   */
  wrapEventHandler(handler, modifiers) {
    if (modifiers.length === 0) return handler;

    const checks = [];
    const actions = [];

    for (const mod of modifiers) {
      switch (mod) {
        case 'prevent': actions.push('e.preventDefault()'); break;
        case 'stop': actions.push('e.stopPropagation()'); break;
        case 'self': checks.push('if (e.target !== e.currentTarget) return'); break;
        case 'enter': checks.push("if (e.key !== 'Enter') return"); break;
        case 'escape': case 'esc': checks.push("if (e.key !== 'Escape') return"); break;
        case 'tab': checks.push("if (e.key !== 'Tab') return"); break;
        case 'space': checks.push("if (e.key !== ' ') return"); break;
        case 'up': checks.push("if (e.key !== 'ArrowUp') return"); break;
        case 'down': checks.push("if (e.key !== 'ArrowDown') return"); break;
        case 'left': checks.push("if (e.key !== 'ArrowLeft') return"); break;
        case 'right': checks.push("if (e.key !== 'ArrowRight') return"); break;
        case 'ctrl': checks.push('if (!e.ctrlKey) return'); break;
        case 'alt': checks.push('if (!e.altKey) return'); break;
        case 'shift': checks.push('if (!e.shiftKey) return'); break;
        case 'meta': checks.push('if (!e.metaKey) return'); break;
        // once, capture, passive are handled via addEventListener options
      }
    }

    const body = [...checks, ...actions, `(${handler})(e)`].join('; ');
    return `(e) => { ${body}; }`;
  }

  // =========================================================================
  // BINDING PREFIX: __bind_<prop>__
  // The rewriter transforms "value <=> var" into "__bind_value__: var"
  // This prefix signals two-way binding to the codegen.
  // =========================================================================
  static BIND_PREFIX = '__bind_';
  static BIND_SUFFIX = '__';

  /**
   * Parse binding directive: prop <=> var (new) or [@bind.prop]: var (legacy)
   * Returns { prop, event, valueExpr, handler } or null
   */
  parseBindingDirective(key, value, tag) {
    let prop;
    
    // Pattern 1 (new): __bind_propName__ (from: prop <=> var)
    if (typeof key === 'string' && 
        key.startsWith(CodeGenerator.BIND_PREFIX) && 
        key.endsWith(CodeGenerator.BIND_SUFFIX)) {
      prop = key.slice(CodeGenerator.BIND_PREFIX.length, -CodeGenerator.BIND_SUFFIX.length);
    }
    // Pattern 2 (legacy): ["computed", [".", [".", "this", "bind"], "propName"]]
    else if (Array.isArray(key) && key[0] === 'computed') {
      const chain = key[1];
      if (!Array.isArray(chain) || chain[0] !== '.') return null;
      
      const [, inner, propName] = chain;
      if (!Array.isArray(inner) || inner[0] !== '.' || inner[1] !== 'this' || inner[2] !== 'bind') {
        return null;
      }
      prop = typeof propName === 'string' ? propName : String(propName);
    }
    else {
      return null;
    }
    
    // Generate variable expression
    const varName = this.generate(value, 'value');
    
    // Determine the right event and value accessor based on prop/tag
    let event, valueAccessor;
    
    if (prop === 'checked') {
      // Checkbox/radio: use 'change' event and 'checked' property
      event = 'onchange';
      valueAccessor = 'e.target.checked';
    } else if (prop === 'value') {
      // Text inputs/textareas: use 'input' event
      // Selects: use 'change' event
      if (tag === 'select') {
        event = 'onchange';
      } else {
        event = 'oninput';
      }
      valueAccessor = 'e.target.value';
    } else {
      // Generic: use 'input' event
      event = 'oninput';
      valueAccessor = `e.target.${prop}`;
    }
    
    return {
      prop,
      event,
      valueExpr: varName,
      handler: `(e) => ${varName} = ${valueAccessor}`
    };
  }

  /**
   * Generate render block using h() runtime helper
   * Pattern: ["render", block]
   */
  generateRender(head, rest, context, sexpr) {
    const [body] = rest;
    this.usesTemplates = true;

    if (!Array.isArray(body) || body[0] !== 'block') {
      return this.generateTemplateElement(body);
    }

    const statements = body.slice(1);
    if (statements.length === 0) return 'null';
    if (statements.length === 1) return this.generateTemplateElement(statements[0]);

    // Multiple roots - use frag()
    const elements = statements.map(s => this.generateTemplateElement(s));
    return `frag(${elements.join(', ')})`;
  }

  /**
   * Generate style block (scoped CSS)
   * Pattern: ["style", block] or ["style", "global", block]
   * Note: Style blocks are currently a stub - CSS processing TBD
   */
  generateStyle(head, rest, context, sexpr) {
    // For now, style blocks are ignored (CSS would need separate handling)
    // TODO: Implement CSS extraction and scoping
    return '/* style block placeholder */';
  }

  /**
   * Generate a component definition
   * Pattern: ["component", name, block]
   * 
   * Components compile to ES6 classes with:
   * - State as reactive signals
   * - Derived as computed values  
   * - render() method returning DOM
   * - Lifecycle methods (mounted, unmounted, updated)
   */
  generateComponent(head, rest, context, sexpr) {
    const [name, body] = rest;
    const componentName = typeof name === 'string' ? name : this.generate(name, 'value');
    
    this.usesTemplates = true;
    
    // Extract component body statements
    const statements = Array.isArray(body) && body[0] === 'block' ? body.slice(1) : [];
    
    // Categorize statements
    const props = [];          // @prop declarations
    const stateVars = [];      // Regular assignments (reactive state)
    const derivedVars = [];    // ~= (computed)
    const readonlyVars = [];   // =! (constants)
    const methods = [];        // Method definitions
    const lifecycleHooks = []; // mounted:, unmounted:, updated:
    const effects = [];        // effect blocks
    let renderBlock = null;    // render block
    let styleBlock = null;     // style block
    
    // Track component member names for this.X transformation
    const memberNames = new Set();      // All members (for identifier → this.X)
    const reactiveMembers = new Set();  // State/derived only (need .value)
    
    for (const stmt of statements) {
      if (!Array.isArray(stmt)) continue;
      
      const [op] = stmt;
      
      if (op === 'prop') {
        props.push(stmt);
        memberNames.add(stmt[1]);
        // Props are NOT reactive - no .value needed
      } else if (op === 'prop-rest') {
        props.push(stmt);
        memberNames.add(stmt[1]);
      } else if (op === '=' && typeof stmt[1] === 'string') {
        // Check for lifecycle hooks: mounted:, unmounted:, updated:
        const varName = stmt[1];
        if (['mounted', 'unmounted', 'updated'].includes(varName)) {
          lifecycleHooks.push(stmt);
        } else {
          stateVars.push(stmt);
          memberNames.add(varName);
          reactiveMembers.add(varName);  // State needs .value
        }
      } else if (op === 'signal') {
        stateVars.push(stmt);
        memberNames.add(stmt[1]);
        reactiveMembers.add(stmt[1]);  // Signal needs .value
      } else if (op === 'derived') {
        derivedVars.push(stmt);
        memberNames.add(stmt[1]);
        reactiveMembers.add(stmt[1]);  // Derived needs .value
      } else if (op === 'readonly') {
        readonlyVars.push(stmt);
        memberNames.add(stmt[1]);
        // Readonly is NOT reactive - no .value needed
      } else if (op === 'effect') {
        effects.push(stmt);
      } else if (op === 'render') {
        renderBlock = stmt;
      } else if (op === 'style') {
        styleBlock = stmt;
      } else if (op === 'object' && stmt.length >= 2) {
        // Method definition: methodName: -> body
        methods.push(stmt);
        // Add method names
        for (let i = 1; i < stmt.length; i++) {
          if (Array.isArray(stmt[i])) memberNames.add(stmt[i][0]);
        }
      }
    }
    
    // Save current component context
    const prevComponentMembers = this.componentMembers;
    const prevReactiveMembers = this.reactiveMembers;
    this.componentMembers = memberNames;
    this.reactiveMembers = reactiveMembers;
    
    // Generate class
    const lines = [];
    let blockFactoriesCode = '';  // Will be populated if render block has loops/conditionals
    lines.push(`class ${componentName} {`);
    
    // Constructor
    lines.push('  constructor(props = {}) {');
    lines.push('    // Context API: track parent component');
    lines.push('    this._parent = __currentComponent;');
    lines.push('    const __prevComponent = __currentComponent;');
    lines.push('    __currentComponent = this;');
    lines.push('');
    
    // Props handling
    if (props.length > 0) {
      for (const prop of props) {
        if (prop[0] === 'prop') {
          const propName = prop[1];
          if (prop.length === 2) {
            // Required prop
            lines.push(`    if (props.${propName} === undefined) throw new Error('Required prop: ${propName}');`);
            lines.push(`    this.${propName} = props.${propName};`);
          } else if (prop[2] === 'optional') {
            // Optional prop
            lines.push(`    this.${propName} = props.${propName};`);
          } else {
            // Prop with default
            const defaultVal = this.generateInComponent(prop[2], 'value');
            lines.push(`    this.${propName} = props.${propName} ?? ${defaultVal};`);
          }
        } else if (prop[0] === 'prop-rest') {
          const restName = prop[1];
          const propNames = props.filter(p => p[0] === 'prop').map(p => p[1]);
          lines.push(`    const { ${propNames.join(', ')}, ...${restName} } = props;`);
          lines.push(`    this.${restName} = ${restName};`);
        }
      }
    }
    
    // Constants
    for (const [, varName, value] of readonlyVars) {
      const val = this.generateInComponent(value, 'value');
      lines.push(`    this.${varName} = ${val};`);
    }
    
    // Components always use reactivity (mount uses __effect for reactive re-rendering)
    this.usesReactivity = true;
    
    for (const stmt of stateVars) {
      if (stmt[0] === 'signal') {
        const [, varName, value] = stmt;
        const val = this.generateInComponent(value, 'value');
        lines.push(`    this.${varName} = __signal(${val});`);
      } else {
        // Regular assignment becomes signal
        const [, varName, value] = stmt;
        const val = this.generateInComponent(value, 'value');
        lines.push(`    this.${varName} = __signal(${val});`);
      }
    }
    
    // Derived (computed)
    for (const [, varName, expr] of derivedVars) {
      const val = this.generateInComponent(expr, 'value');
      lines.push(`    this.${varName} = __computed(() => ${val});`);
    }
    
    // Effects
    for (const effect of effects) {
      const body = effect[1];
      const effectCode = this.generateInComponent(body, 'value');
      lines.push(`    __effect(${effectCode});`);
    }
    
    // Restore previous component context
    lines.push('');
    lines.push('    __currentComponent = __prevComponent;');
    lines.push('  }');
    
    // Methods
    for (const methodStmt of methods) {
      // methodStmt is ['object', [methodName, funcDef], ...]
      for (let i = 1; i < methodStmt.length; i++) {
        const [methodName, funcDef] = methodStmt[i];
        if (Array.isArray(funcDef) && (funcDef[0] === '->' || funcDef[0] === '=>')) {
          const [, params, body] = funcDef;
          const paramStr = Array.isArray(params) ? params.map(p => this.formatParam(p)).join(', ') : '';
          const bodyCode = this.generateInComponent(body, 'value');
          lines.push(`  ${methodName}(${paramStr}) { return ${bodyCode}; }`);
        }
      }
    }
    
    // Lifecycle hooks
    for (const [, hookName, hookValue] of lifecycleHooks) {
      if (Array.isArray(hookValue) && (hookValue[0] === '->' || hookValue[0] === '=>')) {
        const [, params, body] = hookValue;
        const bodyCode = this.generateInComponent(body, 'value');
        lines.push(`  ${hookName}() { return ${bodyCode}; }`);
      }
    }
    
    // Fine-grained rendering: _create() and _setup() methods
    if (renderBlock) {
      const renderBody = renderBlock[1];
      const fg = this.generateFineGrainedRender(renderBody);
      
      // Block factories go BEFORE the class (Svelte-style)
      if (fg.blockFactories.length > 0) {
        blockFactoriesCode = fg.blockFactories.join('\n\n') + '\n\n';
      }
      
      // _create() - builds static DOM structure once
      lines.push('  _create() {');
      for (const line of fg.createLines) {
        lines.push(`    ${line}`);
      }
      lines.push(`    return ${fg.rootVar};`);
      lines.push('  }');
      
      // _setup() - wires up fine-grained reactive effects
      if (fg.setupLines.length > 0) {
        lines.push('  _setup() {');
        for (const line of fg.setupLines) {
          lines.push(`    ${line}`);
        }
        lines.push('  }');
      }
    }
    
    // Mount method - creates DOM once, then sets up effects
    lines.push('  mount(target) {');
    lines.push('    this._target = target;');
    lines.push('    this._root = this._create();');
    lines.push('    target.appendChild(this._root);');
    lines.push('    if (this._setup) this._setup();');
    lines.push('    if (this.mounted) this.mounted();');
    lines.push('    return this;');
    lines.push('  }');
    
    // Unmount method
    lines.push('  unmount() {');
    lines.push('    if (this.unmounted) this.unmounted();');
    lines.push('    if (this._root && this._root.parentNode) {');
    lines.push('      this._root.parentNode.removeChild(this._root);');
    lines.push('    }');
    lines.push('  }');
    
    lines.push('}');
    
    // Restore previous context
    this.componentMembers = prevComponentMembers;
    this.reactiveMembers = prevReactiveMembers;

    // Block factories go before the class
    return blockFactoriesCode + lines.join('\n');
  }

  /**
   * Generate code inside component context (transforms member access to this.X.value)
   */
  generateInComponent(sexpr, context) {
    // Simple identifier that's a reactive member (state/derived) → this.X.value
    if (typeof sexpr === 'string' && this.reactiveMembers && this.reactiveMembers.has(sexpr)) {
      return `this.${sexpr}.value`;
    }
    
    // For arrays, we need to transform member references recursively
    // Transform the s-expression before generating
    if (Array.isArray(sexpr) && this.reactiveMembers) {
      const transformed = this.transformComponentMembers(sexpr);
      return this.generate(transformed, context);
    }
    
    // Otherwise use regular generation
    return this.generate(sexpr, context);
  }

  /**
   * Recursively transform s-expression to replace member identifiers with this.X.value
   * For component context where state variables are signals
   * 
   * Handles:
   * - Simple identifiers: count → this.count.value (only if reactive)
   * - Property access @X: (. this X) → (. (. this X) value) (only if X is reactive)
   */
  transformComponentMembers(sexpr) {
    if (!Array.isArray(sexpr)) {
      // Transform simple member identifiers that are reactive to this.member.value
      if (typeof sexpr === 'string' && this.reactiveMembers && this.reactiveMembers.has(sexpr)) {
        return ['.', ['.', 'this', sexpr], 'value'];  // Transform to this.member.value
      }
      return sexpr;
    }
    
    // Special case: (. this memberName) for @member syntax
    // Transform to (. (. this memberName) value) only if member is reactive
    if (sexpr[0] === '.' && sexpr[1] === 'this' && typeof sexpr[2] === 'string') {
      const memberName = sexpr[2];
      if (this.reactiveMembers && this.reactiveMembers.has(memberName)) {
        return ['.', sexpr, 'value'];  // this.X → this.X.value
      }
      return sexpr;  // Props/readonly/methods stay as this.X
    }
    
    // Recursively transform array elements
    return sexpr.map(item => this.transformComponentMembers(item));
  }

  /**
   * Generate render block in component context
   */
  generateComponentRender(body) {
    if (!Array.isArray(body) || body[0] !== 'block') {
      return this.generateComponentTemplateElement(body);
    }

    const statements = body.slice(1);
    if (statements.length === 0) return 'null';
    if (statements.length === 1) return this.generateComponentTemplateElement(statements[0]);

    // Multiple roots - use frag()
    const elements = statements.map(s => this.generateComponentTemplateElement(s));
    return `frag(${elements.join(', ')})`;
  }

  //===========================================================================
  // FINE-GRAINED RENDERING
  // Generate surgical DOM updates instead of full re-renders
  //===========================================================================

  /**
   * Generate fine-grained _create() and _setup() methods for a render block
   * Returns { createLines, setupLines, rootVar, blockFactories }
   */
  generateFineGrainedRender(body) {
    // Reset counters for this render
    this._fgElementCount = 0;
    this._fgTextCount = 0;
    this._fgBlockCount = 0;
    this._fgCreateLines = [];
    this._fgSetupLines = [];
    this._fgBlockFactories = [];  // Block factory functions (Svelte-style)
    
    // Parse the body
    const statements = Array.isArray(body) && body[0] === 'block' ? body.slice(1) : [body];
    
    let rootVar;
    if (statements.length === 0) {
      rootVar = 'null';
    } else if (statements.length === 1) {
      rootVar = this.fgProcessElement(statements[0]);
    } else {
      // Multiple roots - create fragment
      rootVar = this.fgNewElement('frag');
      this._fgCreateLines.push(`${rootVar} = document.createDocumentFragment();`);
      for (const stmt of statements) {
        const childVar = this.fgProcessElement(stmt);
        this._fgCreateLines.push(`${rootVar}.appendChild(${childVar});`);
      }
    }
    
    return {
      createLines: this._fgCreateLines,
      setupLines: this._fgSetupLines,
      blockFactories: this._fgBlockFactories,
      rootVar
    };
  }
  
  /**
   * Generate a unique block factory name
   */
  fgNewBlock() {
    return `create_block_${this._fgBlockCount++}`;
  }

  /**
   * Generate a unique element variable name
   */
  fgNewElement(hint = 'el') {
    return `this._${hint}${this._fgElementCount++}`;
  }

  /**
   * Generate a unique text node variable name
   */
  fgNewText() {
    return `this._t${this._fgTextCount++}`;
  }

  /**
   * Process a template element for fine-grained rendering
   * Returns the variable name holding this element
   */
  fgProcessElement(sexpr) {
    // String literal → text node (handle both primitive and String objects)
    if (typeof sexpr === 'string' || sexpr instanceof String) {
      const str = sexpr.valueOf();
      if (str.startsWith('"') || str.startsWith("'") || str.startsWith('`')) {
        // Static text
        const textVar = this.fgNewText();
        this._fgCreateLines.push(`${textVar} = document.createTextNode(${str});`);
        return textVar;
      }
      // Dynamic text binding (reactive member)
      if (this.reactiveMembers && this.reactiveMembers.has(str)) {
        const textVar = this.fgNewText();
        this._fgCreateLines.push(`${textVar} = document.createTextNode('');`);
        this._fgSetupLines.push(`__effect(() => { ${textVar}.data = this.${str}.value; });`);
        return textVar;
      }
      // Static tag without content
      const elVar = this.fgNewElement();
      this._fgCreateLines.push(`${elVar} = document.createElement('${str}');`);
      return elVar;
    }

    // Array - could be element with children/attrs, property chain, etc.
    if (Array.isArray(sexpr)) {
      const [head, ...rest] = sexpr;
      const headStr = typeof head === 'string' ? head : (head instanceof String ? head.valueOf() : null);

      // Component instantiation (PascalCase)
      if (headStr && this.isComponent(headStr)) {
        return this.fgProcessComponent(headStr, rest);
      }

      // HTML tag
      if (headStr && this.isHtmlTag(headStr)) {
        return this.fgProcessTag(headStr, [], rest);
      }

      // Property chain (div.class or div.class1.class2 or item.name)
      if (headStr === '.') {
        const [, obj, prop] = sexpr;
        
        // Property access on this (e.g., @prop, @children)
        if (obj === 'this' && typeof prop === 'string') {
          // Reactive member → dynamic text
          if (this.reactiveMembers && this.reactiveMembers.has(prop)) {
            const textVar = this.fgNewText();
            this._fgCreateLines.push(`${textVar} = document.createTextNode('');`);
            this._fgSetupLines.push(`__effect(() => { ${textVar}.data = this.${prop}.value; });`);
            return textVar;
          }
          // Non-reactive member (prop) - could be DOM (slot) or text
          if (this.componentMembers && this.componentMembers.has(prop)) {
            const slotVar = this.fgNewElement('slot');
            // At runtime, check if it's a DOM node or convert to text
            this._fgCreateLines.push(`${slotVar} = this.${prop} instanceof Node ? this.${prop} : (this.${prop} != null ? document.createTextNode(String(this.${prop})) : document.createComment(''));`);
            return slotVar;
          }
        }
        
        // Check if it's an HTML tag with classes (div.class)
        const { tag, classes } = this.collectTemplateClasses(sexpr);
        if (tag && this.isHtmlTag(tag)) {
          return this.fgProcessTag(tag, classes, []);
        }
        
        // General property access (e.g., item.name in a loop)
        // Generate the expression - it will be in scope when embedded in loops
        const textVar = this.fgNewText();
        const exprCode = this.generateInComponent(sexpr, 'value');
        this._fgCreateLines.push(`${textVar} = document.createTextNode(String(${exprCode}));`);
        return textVar;
      }

      // Call expression: (tag.class args...) or ((tag.class) args...)
      if (Array.isArray(head)) {
        // Check for nested dynamic class call with children/text:
        // (((. div __cx__) "classes") "text" or (-> children)) 
        // head = [(. div __cx__), "classes"], rest = ["text"] or [(-> children)]
        if (Array.isArray(head[0]) && head[0][0] === '.' && 
            (head[0][2] === '__cx__' || (head[0][2] instanceof String && head[0][2].valueOf() === '__cx__'))) {
          const tag = typeof head[0][1] === 'string' ? head[0][1] : head[0][1].valueOf();
          const classExprs = head.slice(1);  // Class expressions from the __cx__ call only
          // rest contains children/text, NOT more class expressions
          return this.fgProcessTagWithDynamicClass(tag, classExprs, rest);
        }
        
        const { tag, classes } = this.collectTemplateClasses(head);
        if (tag && this.isHtmlTag(tag)) {
          // Check for dynamic class syntax: div.("classes") → (. div __cx__) "classes"
          // In this case, classes will be ["__cx__"] and rest will contain the class expressions
          if (classes.length === 1 && classes[0] === '__cx__') {
            // Dynamic classes - rest contains class expressions (no children at this level)
            return this.fgProcessTagWithDynamicClass(tag, rest, []);
          }
          return this.fgProcessTag(tag, classes, rest);
        }
      }

      // Arrow function (children block)
      if (headStr === '->' || headStr === '=>') {
        const [params, body] = rest;
        return this.fgProcessBlock(body);
      }

      // Conditional: if/else
      if (headStr === 'if') {
        return this.fgProcessConditional(sexpr);
      }

      // For loop
      if (headStr === 'for' || headStr === 'for-in' || headStr === 'for-of') {
        return this.fgProcessLoop(sexpr);
      }

      // General expression (computed value, function call, binary op, etc.)
      // This handles cases like (a + b), item.method(), etc.
      const textVar = this.fgNewText();
      const exprCode = this.generateInComponent(sexpr, 'value');
      if (this.fgHasReactiveDeps(sexpr)) {
        // Reactive expression - wrap in effect
        this._fgCreateLines.push(`${textVar} = document.createTextNode('');`);
        this._fgSetupLines.push(`__effect(() => { ${textVar}.data = ${exprCode}; });`);
      } else {
        // Static expression
        this._fgCreateLines.push(`${textVar} = document.createTextNode(String(${exprCode}));`);
      }
      return textVar;
    }

    // Fallback for non-array, non-string values
    const commentVar = this.fgNewElement('c');
    this._fgCreateLines.push(`${commentVar} = document.createComment('unknown');`);
    return commentVar;
  }

  /**
   * Process an HTML tag with dynamic classes from .() syntax
   * @param {string} tag - HTML tag name
   * @param {Array} classExprs - Class expression arguments from .(...)
   * @param {Array} children - Children/text following the .() call
   */
  fgProcessTagWithDynamicClass(tag, classExprs, children) {
    const elVar = this.fgNewElement();
    
    // Create element
    this._fgCreateLines.push(`${elVar} = document.createElement('${tag}');`);
    
    // Generate class expression
    if (classExprs.length > 0) {
      const classCode = classExprs.map(e => this.generateInComponent(e, 'value')).join(' + " " + ');
      // Check if any class expr has reactive deps
      const hasReactiveDeps = classExprs.some(e => this.fgHasReactiveDeps(e));
      if (hasReactiveDeps) {
        this._fgSetupLines.push(`__effect(() => { ${elVar}.className = ${classCode}; });`);
      } else {
        this._fgCreateLines.push(`${elVar}.className = ${classCode};`);
      }
    }
    
    // Process children
    for (const arg of children) {
      // Arrow function = children block (handle String objects too)
      const argHead = Array.isArray(arg) ? (arg[0] instanceof String ? arg[0].valueOf() : arg[0]) : null;
      if (argHead === '->' || argHead === '=>') {
        const block = arg[2];
        const blockHead = Array.isArray(block) ? (block[0] instanceof String ? block[0].valueOf() : block[0]) : null;
        if (blockHead === 'block') {
          for (const child of block.slice(1)) {
            const childVar = this.fgProcessElement(child);
            this._fgCreateLines.push(`${elVar}.appendChild(${childVar});`);
          }
        } else if (block) {
          const childVar = this.fgProcessElement(block);
          this._fgCreateLines.push(`${elVar}.appendChild(${childVar});`);
        }
      }
      // Object = attributes/events
      else if (Array.isArray(arg) && arg[0] === 'object') {
        this.fgProcessAttributes(elVar, arg);
      }
      // String = text child (handle both primitive and String objects)
      else if (typeof arg === 'string' || arg instanceof String) {
        const textVar = this.fgNewText();
        const argStr = arg.valueOf();
        if (argStr.startsWith('"') || argStr.startsWith("'") || argStr.startsWith('`')) {
          this._fgCreateLines.push(`${textVar} = document.createTextNode(${argStr});`);
        } else if (this.reactiveMembers && this.reactiveMembers.has(argStr)) {
          this._fgCreateLines.push(`${textVar} = document.createTextNode('');`);
          this._fgSetupLines.push(`__effect(() => { ${textVar}.data = this.${argStr}.value; });`);
        } else {
          this._fgCreateLines.push(`${textVar} = document.createTextNode(${this.generateInComponent(arg, 'value')});`);
        }
        this._fgCreateLines.push(`${elVar}.appendChild(${textVar});`);
      }
      // Other expression = dynamic child
      else {
        const childVar = this.fgProcessElement(arg);
        this._fgCreateLines.push(`${elVar}.appendChild(${childVar});`);
      }
    }
    
    return elVar;
  }

  /**
   * Process an HTML tag with classes and children/attributes
   */
  fgProcessTag(tag, classes, args) {
    const elVar = this.fgNewElement();
    
    // Create element
    this._fgCreateLines.push(`${elVar} = document.createElement('${tag}');`);
    
    // Add static classes
    if (classes.length > 0) {
      this._fgCreateLines.push(`${elVar}.className = '${classes.join(' ')}';`);
    }
    
    // Process arguments (attributes, events, children)
    for (const arg of args) {
      // Arrow function = children
      if (Array.isArray(arg) && (arg[0] === '->' || arg[0] === '=>')) {
        const block = arg[2];
        if (Array.isArray(block) && block[0] === 'block') {
          for (const child of block.slice(1)) {
            const childVar = this.fgProcessElement(child);
            this._fgCreateLines.push(`${elVar}.appendChild(${childVar});`);
          }
        } else if (block) {
          const childVar = this.fgProcessElement(block);
          this._fgCreateLines.push(`${elVar}.appendChild(${childVar});`);
        }
      }
      // Object = attributes/events
      else if (Array.isArray(arg) && arg[0] === 'object') {
        this.fgProcessAttributes(elVar, arg);
      }
      // String = text child
      else if (typeof arg === 'string') {
        const textVar = this.fgNewText();
        if (arg.startsWith('"') || arg.startsWith("'") || arg.startsWith('`')) {
          // Static text - use the quoted string directly
          this._fgCreateLines.push(`${textVar} = document.createTextNode(${arg});`);
        } else if (this.reactiveMembers && this.reactiveMembers.has(arg)) {
          // Dynamic text - reactive binding
          this._fgCreateLines.push(`${textVar} = document.createTextNode('');`);
          this._fgSetupLines.push(`__effect(() => { ${textVar}.data = this.${arg}.value; });`);
        } else if (this.componentMembers && this.componentMembers.has(arg)) {
          // Non-reactive member (prop)
          this._fgCreateLines.push(`${textVar} = document.createTextNode(String(this.${arg}));`);
        } else {
          // Other identifier
          this._fgCreateLines.push(`${textVar} = document.createTextNode(String(${arg}));`);
        }
        this._fgCreateLines.push(`${elVar}.appendChild(${textVar});`);
      }
      // String object (from parser)
      else if (arg instanceof String) {
        const val = arg.valueOf();
        const textVar = this.fgNewText();
        if (val.startsWith('"') || val.startsWith("'") || val.startsWith('`')) {
          this._fgCreateLines.push(`${textVar} = document.createTextNode(${val});`);
        } else if (this.reactiveMembers && this.reactiveMembers.has(val)) {
          this._fgCreateLines.push(`${textVar} = document.createTextNode('');`);
          this._fgSetupLines.push(`__effect(() => { ${textVar}.data = this.${val}.value; });`);
        } else {
          this._fgCreateLines.push(`${textVar} = document.createTextNode(String(${val}));`);
        }
        this._fgCreateLines.push(`${elVar}.appendChild(${textVar});`);
      }
      // Other = nested element
      else if (arg) {
        const childVar = this.fgProcessElement(arg);
        this._fgCreateLines.push(`${elVar}.appendChild(${childVar});`);
      }
    }
    
    return elVar;
  }

  /**
   * Check if an s-expression contains any reactive member references
   */
  fgHasReactiveDeps(sexpr) {
    if (!this.reactiveMembers || this.reactiveMembers.size === 0) return false;
    
    if (typeof sexpr === 'string') {
      return this.reactiveMembers.has(sexpr);
    }
    
    if (!Array.isArray(sexpr)) return false;
    
    // Check for (. this reactiveMember) pattern
    if (sexpr[0] === '.' && sexpr[1] === 'this' && typeof sexpr[2] === 'string') {
      return this.reactiveMembers.has(sexpr[2]);
    }
    
    // Recursively check children
    for (const child of sexpr) {
      if (this.fgHasReactiveDeps(child)) return true;
    }
    
    return false;
  }

  /**
   * Process attributes and events for an element
   */
  fgProcessAttributes(elVar, objExpr) {
    // objExpr = ['object', [key, value], [key, value], ...]
    for (let i = 1; i < objExpr.length; i++) {
      const [key, value] = objExpr[i];

      // Event handler: @click or (. this eventName)
      if (Array.isArray(key) && key[0] === '.' && key[1] === 'this') {
        const eventName = key[2];
        const handlerCode = this.generateInComponent(value, 'value');
        // Bind handler to this context
        this._fgCreateLines.push(`${elVar}.addEventListener('${eventName}', (e) => (${handlerCode})(e));`);
        continue;
      }

      // Regular attribute
      if (typeof key === 'string') {
        // Two-way binding: __bind_value__ pattern (from value <=> var)
        if (key.startsWith('__bind_') && key.endsWith('__')) {
          const prop = key.slice(7, -2);  // Extract property name
          const valueCode = this.generateInComponent(value, 'value');
          
          // Determine event and value accessor based on property
          let event, valueAccessor;
          if (prop === 'checked') {
            event = 'change';
            valueAccessor = 'e.target.checked';
          } else {
            event = 'input';
            valueAccessor = 'e.target.value';
          }
          
          // Set up two-way binding: value → element and element → value
          this._fgSetupLines.push(`__effect(() => { ${elVar}.${prop} = ${valueCode}; });`);
          this._fgCreateLines.push(`${elVar}.addEventListener('${event}', (e) => ${valueCode} = ${valueAccessor});`);
          continue;
        }
        
        // Check if value contains any reactive dependencies
        const hasReactiveDeps = this.fgHasReactiveDeps(value);
        
        if (hasReactiveDeps) {
          // Dynamic attribute - wrap in effect
          const valueCode = this.generateInComponent(value, 'value');
          this._fgSetupLines.push(`__effect(() => { ${elVar}.setAttribute('${key}', ${valueCode}); });`);
        } else {
          // Static attribute
          const valueCode = this.generateInComponent(value, 'value');
          this._fgCreateLines.push(`${elVar}.setAttribute('${key}', ${valueCode});`);
        }
      }
    }
  }

  /**
   * Process a block of children
   */
  fgProcessBlock(body) {
    if (!Array.isArray(body) || body[0] !== 'block') {
      return this.fgProcessElement(body);
    }
    
    const statements = body.slice(1);
    if (statements.length === 0) {
      const commentVar = this.fgNewElement('empty');
      this._fgCreateLines.push(`${commentVar} = document.createComment('');`);
      return commentVar;
    }
    if (statements.length === 1) {
      return this.fgProcessElement(statements[0]);
    }
    
    // Multiple children - wrap in fragment
    const fragVar = this.fgNewElement('frag');
    this._fgCreateLines.push(`${fragVar} = document.createDocumentFragment();`);
    for (const stmt of statements) {
      const childVar = this.fgProcessElement(stmt);
      this._fgCreateLines.push(`${fragVar}.appendChild(${childVar});`);
    }
    return fragVar;
  }

  /**
   * Process a conditional (if/else) using Svelte-style block factories
   * Pattern: ['if', condition, thenBlock, elseBlock?]
   * 
   * Generates:
   * 1. Block factory for then-branch with c(), m(), p(), d()
   * 2. Block factory for else-branch (if present)
   * 3. Local state management in _setup() (no this._ pollution)
   */
  fgProcessConditional(sexpr) {
    const [, condition, thenBlock, elseBlock] = sexpr;
    
    // Create anchor comment (only this goes on this._)
    const anchorVar = this.fgNewElement('anchor');
    this._fgCreateLines.push(`${anchorVar} = document.createComment('if');`);
    
    // Generate condition expression
    const condCode = this.generateInComponent(condition, 'value');
    
    // Generate block factory for then-branch
    const thenBlockName = this.fgNewBlock();
    this.fgGenerateConditionBlock(thenBlockName, thenBlock);
    
    // Generate block factory for else-branch if present
    let elseBlockName = null;
    if (elseBlock) {
      elseBlockName = this.fgNewBlock();
      this.fgGenerateConditionBlock(elseBlockName, elseBlock);
    }
    
    // Generate setup code with LOCAL state management
    const setupLines = [];
    setupLines.push(`// Conditional: ${thenBlockName}${elseBlockName ? ' / ' + elseBlockName : ''}`);
    setupLines.push(`{`);
    setupLines.push(`  const anchor = ${anchorVar};`);
    setupLines.push(`  let currentBlock = null;`);
    setupLines.push(`  let showing = null;  // 'then', 'else', or null`);
    setupLines.push(`  __effect(() => {`);
    setupLines.push(`    const show = !!(${condCode});`);
    setupLines.push(`    const want = show ? 'then' : ${elseBlock ? "'else'" : 'null'};`);
    setupLines.push(`    if (want === showing) return;`);
    setupLines.push(``);
    setupLines.push(`    // Destroy old block`);
    setupLines.push(`    if (currentBlock) {`);
    setupLines.push(`      currentBlock.d(true);`);
    setupLines.push(`      currentBlock = null;`);
    setupLines.push(`    }`);
    setupLines.push(`    showing = want;`);
    setupLines.push(``);
    setupLines.push(`    // Create new block`);
    setupLines.push(`    if (want === 'then') {`);
    setupLines.push(`      currentBlock = ${thenBlockName}(this);`);
    setupLines.push(`      currentBlock.c();`);
    setupLines.push(`      currentBlock.m(anchor.parentNode, anchor.nextSibling);`);
    setupLines.push(`      currentBlock.p(this);`);
    setupLines.push(`    }`);
    if (elseBlock) {
      setupLines.push(`    if (want === 'else') {`);
      setupLines.push(`      currentBlock = ${elseBlockName}(this);`);
      setupLines.push(`      currentBlock.c();`);
      setupLines.push(`      currentBlock.m(anchor.parentNode, anchor.nextSibling);`);
      setupLines.push(`      currentBlock.p(this);`);
      setupLines.push(`    }`);
    }
    setupLines.push(`  });`);
    setupLines.push(`}`);
    
    this._fgSetupLines.push(setupLines.join('\n    '));
    
    return anchorVar;
  }
  
  /**
   * Generate a block factory for a conditional branch
   */
  fgGenerateConditionBlock(blockName, block) {
    // Save state
    const savedCreateLines = this._fgCreateLines;
    const savedSetupLines = this._fgSetupLines;
    
    this._fgCreateLines = [];
    this._fgSetupLines = [];
    
    const rootVar = this.fgProcessBlock(block);
    const createLines = this._fgCreateLines;
    const setupLines = this._fgSetupLines;
    
    // Restore
    this._fgCreateLines = savedCreateLines;
    this._fgSetupLines = savedSetupLines;
    
    // Convert this._ references to local variables
    const localizeVar = (line) => {
      return line.replace(/this\.(_el\d+|_t\d+|_anchor\d+|_frag\d+|_slot\d+|_c\d+|_inst\d+)/g, '$1');
    };
    
    // Generate block factory
    const factoryLines = [];
    factoryLines.push(`function ${blockName}(ctx) {`);
    factoryLines.push(`  // Local DOM references`);
    
    // Declare local variables
    const localVars = new Set();
    for (const line of createLines) {
      const match = line.match(/^this\.(_(?:el|t|anchor|frag|slot|c|inst)\d+)\s*=/);
      if (match) localVars.add(match[1]);
    }
    if (localVars.size > 0) {
      factoryLines.push(`  let ${[...localVars].join(', ')};`);
    }
    
    const hasEffects = setupLines.length > 0;
    if (hasEffects) {
      factoryLines.push(`  let disposers = [];`);
    }
    
    factoryLines.push(`  return {`);
    
    // c() - create
    factoryLines.push(`    c() {`);
    for (const line of createLines) {
      factoryLines.push(`      ${localizeVar(line)}`);
    }
    factoryLines.push(`    },`);
    
    // m() - mount
    factoryLines.push(`    m(target, anchor) {`);
    factoryLines.push(`      target.insertBefore(${localizeVar(rootVar)}, anchor);`);
    factoryLines.push(`    },`);
    
    // p() - update/patch (wire up effects)
    factoryLines.push(`    p(ctx) {`);
    if (hasEffects) {
      factoryLines.push(`      disposers.forEach(d => d());`);
      factoryLines.push(`      disposers = [];`);
      for (const line of setupLines) {
        const localizedLine = localizeVar(line);
        const wrappedLine = localizedLine.replace(
          /__effect\(\(\) => \{/g,
          'disposers.push(__effect(() => {'
        ).replace(
          /\}\);$/g,
          '}));'
        );
        factoryLines.push(`      ${wrappedLine}`);
      }
    }
    factoryLines.push(`    },`);
    
    // d() - destroy
    factoryLines.push(`    d(detaching) {`);
    if (hasEffects) {
      factoryLines.push(`      disposers.forEach(d => d());`);
    }
    factoryLines.push(`      if (detaching) ${localizeVar(rootVar)}.remove();`);
    factoryLines.push(`    }`);
    
    factoryLines.push(`  };`);
    factoryLines.push(`}`);
    
    this._fgBlockFactories.push(factoryLines.join('\n'));
  }

  /**
   * Process a for loop using Svelte-style block factories
   * Pattern: ['for-in', [vars], collection, guard?, step?, body]
   * 
   * Generates:
   * 1. A block factory function with c(), m(), p(), d() methods
   * 2. Local reconciliation state in _setup() (no this._ pollution)
   */
  fgProcessLoop(sexpr) {
    const [head, vars, collection, guard, step, body] = sexpr;
    
    // Generate unique block factory name
    const blockName = this.fgNewBlock();
    
    // Create anchor comment (only this goes on this._)
    const anchorVar = this.fgNewElement('anchor');
    this._fgCreateLines.push(`${anchorVar} = document.createComment('for');`);
    
    // Get variable names
    const varNames = Array.isArray(vars) ? vars : [vars];
    const itemVar = varNames[0];
    const indexVar = varNames[1] || 'i';
    
    // Generate collection expression
    const collectionCode = this.generateInComponent(collection, 'value');
    
    // Extract key expression from body if present
    let keyExpr = itemVar;  // Default: use item itself as key
    if (Array.isArray(body) && body[0] === 'block' && body.length > 1) {
      const firstChild = body[1];
      if (Array.isArray(firstChild)) {
        for (const arg of firstChild) {
          if (Array.isArray(arg) && arg[0] === 'object') {
            for (let i = 1; i < arg.length; i++) {
              const [k, v] = arg[i];
              if (k === 'key') {
                keyExpr = this.generate(v, 'value');
                break;
              }
            }
          }
          if (keyExpr !== itemVar) break;
        }
      }
    }
    
    // Save state and generate item template in isolation
    const savedCreateLines = this._fgCreateLines;
    const savedSetupLines = this._fgSetupLines;
    const savedBlockFactories = this._fgBlockFactories;
    
    this._fgCreateLines = [];
    this._fgSetupLines = [];
    // Keep block factories shared so nested loops add to same array
    
    const itemNode = this.fgProcessBlock(body);
    const itemCreateLines = this._fgCreateLines;
    const itemSetupLines = this._fgSetupLines;
    
    // Restore
    this._fgCreateLines = savedCreateLines;
    this._fgSetupLines = savedSetupLines;
    
    // Convert this._ references to local variables for the block factory
    // In block factories, we use local vars, not this._
    const localizeVar = (line) => {
      // Replace this._elX, this._tX with local el, t variables
      return line.replace(/this\.(_el\d+|_t\d+|_anchor\d+|_frag\d+|_slot\d+|_c\d+|_inst\d+)/g, '$1');
    };
    
    // Generate block factory function
    const factoryLines = [];
    factoryLines.push(`function ${blockName}(ctx, ${itemVar}, ${indexVar}) {`);
    factoryLines.push(`  // Local DOM references (not on this)`);
    
    // Declare local variables for DOM elements
    const localVars = new Set();
    for (const line of itemCreateLines) {
      const match = line.match(/^this\.(_(?:el|t|anchor|frag|slot|c|inst)\d+)\s*=/);
      if (match) localVars.add(match[1]);
    }
    if (localVars.size > 0) {
      factoryLines.push(`  let ${[...localVars].join(', ')};`);
    }
    
    // Add any nested block's disposers tracking
    const hasEffects = itemSetupLines.length > 0;
    if (hasEffects) {
      factoryLines.push(`  let disposers = [];`);
    }
    
    factoryLines.push(`  return {`);
    
    // c() - create
    factoryLines.push(`    c() {`);
    for (const line of itemCreateLines) {
      factoryLines.push(`      ${localizeVar(line)}`);
    }
    factoryLines.push(`    },`);
    
    // m() - mount
    factoryLines.push(`    m(target, anchor) {`);
    factoryLines.push(`      target.insertBefore(${localizeVar(itemNode)}, anchor);`);
    factoryLines.push(`    },`);
    
    // p() - update (patch)
    factoryLines.push(`    p(ctx, ${itemVar}, ${indexVar}) {`);
    if (hasEffects) {
      factoryLines.push(`      // Dispose old effects and create new ones with updated values`);
      factoryLines.push(`      disposers.forEach(d => d());`);
      factoryLines.push(`      disposers = [];`);
      for (const line of itemSetupLines) {
        // Wrap effects to collect disposers, and localize references
        const localizedLine = localizeVar(line);
        const wrappedLine = localizedLine.replace(
          /__effect\(\(\) => \{/g, 
          'disposers.push(__effect(() => {'
        ).replace(
          /\}\);$/g,
          '}));'
        );
        factoryLines.push(`      ${wrappedLine}`);
      }
    }
    factoryLines.push(`    },`);
    
    // d() - destroy
    factoryLines.push(`    d(detaching) {`);
    if (hasEffects) {
      factoryLines.push(`      disposers.forEach(d => d());`);
    }
    factoryLines.push(`      if (detaching) ${localizeVar(itemNode)}.remove();`);
    factoryLines.push(`    }`);
    
    factoryLines.push(`  };`);
    factoryLines.push(`}`);
    
    // Add factory to the list
    this._fgBlockFactories.push(factoryLines.join('\n'));
    
    // Generate reconciliation code in _setup() using LOCAL variables
    const setupLines = [];
    setupLines.push(`// Loop: ${blockName}`);
    setupLines.push(`{`);
    setupLines.push(`  const anchor = ${anchorVar};`);
    setupLines.push(`  const map = new Map();  // key -> block`);
    setupLines.push(`  let keys = [];`);
    setupLines.push(`  __effect(() => {`);
    setupLines.push(`    const items = ${collectionCode};`);
    setupLines.push(`    const parent = anchor.parentNode;`);
    setupLines.push(`    const newKeys = [];`);
    setupLines.push(`    const newMap = new Map();`);
    setupLines.push(``);
    setupLines.push(`    // Create/update blocks`);
    setupLines.push(`    for (let ${indexVar} = 0; ${indexVar} < items.length; ${indexVar}++) {`);
    setupLines.push(`      const ${itemVar} = items[${indexVar}];`);
    setupLines.push(`      const key = ${keyExpr};`);
    setupLines.push(`      newKeys.push(key);`);
    setupLines.push(`      let block = map.get(key);`);
    setupLines.push(`      if (block) {`);
    setupLines.push(`        // Update existing block`);
    setupLines.push(`        block.p(this, ${itemVar}, ${indexVar});`);
    setupLines.push(`      } else {`);
    setupLines.push(`        // Create new block`);
    setupLines.push(`        block = ${blockName}(this, ${itemVar}, ${indexVar});`);
    setupLines.push(`        block.c();`);
    setupLines.push(`        block.m(parent, anchor);`);
    setupLines.push(`        block.p(this, ${itemVar}, ${indexVar});  // Wire up effects`);
    setupLines.push(`      }`);
    setupLines.push(`      newMap.set(key, block);`);
    setupLines.push(`    }`);
    setupLines.push(``);
    setupLines.push(`    // Remove deleted blocks`);
    setupLines.push(`    for (const [key, block] of map) {`);
    setupLines.push(`      if (!newMap.has(key)) block.d(true);`);
    setupLines.push(`    }`);
    setupLines.push(``);
    setupLines.push(`    // Update tracking (simple swap)`);
    setupLines.push(`    map.clear();`);
    setupLines.push(`    for (const [k, v] of newMap) map.set(k, v);`);
    setupLines.push(`    keys = newKeys;`);
    setupLines.push(`  });`);
    setupLines.push(`}`);
    
    this._fgSetupLines.push(setupLines.join('\n    '));
    
    return anchorVar;
  }

  /**
   * Process a component instantiation
   */
  fgProcessComponent(componentName, args) {
    // Store the component instance so we can call _setup() on it
    const instVar = this.fgNewElement('inst');
    const elVar = this.fgNewElement('el');
    const { propsCode, childrenVar, childrenSetupLines } = this.fgBuildComponentProps(args);
    
    this._fgCreateLines.push(`${instVar} = new ${componentName}(${propsCode});`);
    this._fgCreateLines.push(`${elVar} = ${instVar}._create();`);
    
    // Wire up child component's effects
    this._fgSetupLines.push(`if (${instVar}._setup) ${instVar}._setup();`);
    
    // Add any setup lines from children processing
    for (const line of childrenSetupLines) {
      this._fgSetupLines.push(line);
    }
    
    return elVar;
  }

  /**
   * Build props object for component instantiation
   * Returns { propsCode, childrenVar, childrenSetupLines }
   */
  fgBuildComponentProps(args) {
    const props = [];
    let childrenVar = null;
    const childrenSetupLines = [];
    
    for (const arg of args) {
      if (Array.isArray(arg) && arg[0] === 'object') {
        for (let i = 1; i < arg.length; i++) {
          const [key, value] = arg[i];
          if (typeof key === 'string') {
            const valueCode = this.generateInComponent(value, 'value');
            props.push(`${key}: ${valueCode}`);
          }
        }
      } else if (Array.isArray(arg) && (arg[0] === '->' || arg[0] === '=>')) {
        // Children - process as DOM nodes
        const block = arg[2];
        if (block) {
          // Save state
          const savedCreateLines = this._fgCreateLines;
          const savedSetupLines = this._fgSetupLines;
          this._fgCreateLines = [];
          this._fgSetupLines = [];
          
          // Process children block
          childrenVar = this.fgProcessBlock(block);
          
          // Collect the create and setup lines
          const childCreateLines = this._fgCreateLines;
          const childSetupLinesCopy = this._fgSetupLines;
          
          // Restore
          this._fgCreateLines = savedCreateLines;
          this._fgSetupLines = savedSetupLines;
          
          // Add child create lines to parent
          for (const line of childCreateLines) {
            this._fgCreateLines.push(line);
          }
          
          // Save setup lines for later
          childrenSetupLines.push(...childSetupLinesCopy);
          
          // Add children to props
          props.push(`children: ${childrenVar}`);
        }
      }
    }
    
    const propsCode = props.length > 0 ? `{ ${props.join(', ')} }` : '{}';
    return { propsCode, childrenVar, childrenSetupLines };
  }

  /**
   * Generate template element in component context (uses this.X for members)
   */
  generateComponentTemplateElement(sexpr) {
    // String literal → text or tag
    if (typeof sexpr === 'string') {
      // Check if it's a member reference
      if (this.componentMembers && this.componentMembers.has(sexpr)) {
        return `this.${sexpr}.value`;
      }
      if (sexpr.startsWith('"') || sexpr.startsWith("'") || sexpr.startsWith('`')) {
        return sexpr;
      }
      // Plain tag
      return `h('${sexpr}', 0)`;
    }
    
    // String object → same handling
    if (sexpr instanceof String) {
      const val = sexpr.valueOf();
      if (this.componentMembers && this.componentMembers.has(val)) {
        return `this.${val}.value`;
      }
    }

    // Arrays need component-aware processing
    if (Array.isArray(sexpr)) {
      const [head, ...rest] = sexpr;
      const headStr = typeof head === 'string' ? head : (head instanceof String ? head.valueOf() : null);
      
      // Component instantiation (PascalCase names) - check BEFORE HTML tags
      if (headStr && this.isComponent(headStr)) {
        return this.generateComponentInstance(headStr, rest);
      }
      
      // HTML tags - use h() with component-aware children
      if (headStr && this.isHtmlTag && this.isHtmlTag(headStr)) {
        return this.generateComponentH(headStr, [], rest);
      }
      
      // Property access (div.class or this.member)
      if (headStr === '.') {
        const [, obj, prop] = sexpr;
        // Handle @children → this.children (it's already DOM content, no txt() wrapper)
        if (obj === 'this' && prop === 'children') {
          return `this.children`;
        }
        const { tag, classes } = this.collectTemplateClasses(sexpr);
        if (tag && this.isHtmlTag && this.isHtmlTag(tag)) {
          return this.generateComponentH(tag, classes, []);
        }
      }
      
      // Call (div args...)
      if (Array.isArray(head)) {
        const { tag, classes } = this.collectTemplateClasses(head);
        if (tag && this.isHtmlTag && this.isHtmlTag(tag)) {
          return this.generateComponentH(tag, classes, rest);
        }
      }
      
      // Arrow function for children
      if (headStr === '->' || headStr === '=>') {
        const [params, body] = rest;
        return this.generateComponentRender(body);
      }
      
      // For other s-expressions, use regular template generation
      // but wrap identifiers appropriately
      return this.generateTemplateElement(sexpr);
    }
    
    return this.generateTemplateElement(sexpr);
  }

  /**
   * Generate h() call in component context
   */
  generateComponentH(tag, classes, args) {
    this.usesTemplates = true;
    
    const props = {};
    const spreads = [];
    const children = [];
    let refVar = null;

    for (const arg of args) {
      // Arrow function = children
      if (Array.isArray(arg) && (arg[0] === '->' || arg[0] === '=>')) {
        const block = arg[2];
        if (Array.isArray(block) && block[0] === 'block') {
          children.push(...block.slice(1).map(s => this.generateComponentTemplateElement(s)));
        } else {
          children.push(this.generateComponentTemplateElement(block));
        }
      }
      // Spread = ...props
      else if (Array.isArray(arg) && arg[0] === '...') {
        spreads.push(this.generateInComponent(arg[1], 'value'));
      }
      // Object = attributes/events
      else if (Array.isArray(arg) && arg[0] === 'object') {
        for (const pair of arg.slice(1)) {
          if (Array.isArray(pair) && pair.length >= 2) {
            const [key, value] = pair;
            
            // Check for binding directive
            const bindInfo = this.parseBindingDirective(key, value, tag);
            if (bindInfo) {
              props[bindInfo.prop] = bindInfo.valueExpr;
              props[bindInfo.event] = bindInfo.handler;
              continue;
            }
            
            // Check for event handler
            const eventInfo = this.parseEventHandler(key, value);
            if (eventInfo) {
              const handler = eventInfo.modifiers.length > 0
                ? this.wrapEventHandler(eventInfo.handler, eventInfo.modifiers)
                : eventInfo.handler;
              props[`on${eventInfo.eventName}`] = handler;
            } else {
              const keyStr = typeof key === 'string' ? key : this.generate(key, 'value');
              if (keyStr === 'ref') {
                refVar = typeof value === 'string' ? value : this.generate(value, 'value');
              } else if (keyStr === 'key') {
                props.key = this.generateInComponent(value, 'value');
              } else {
                props[keyStr] = this.generateInComponent(value, 'value');
              }
            }
          }
        }
      }
      // String = text child  
      else if (typeof arg === 'string') {
        if (this.componentMembers && this.componentMembers.has(arg)) {
          children.push(`this.${arg}.value`);
        } else if (arg.startsWith('"') || arg.startsWith("'") || arg.startsWith('`')) {
          children.push(arg);
        } else {
          children.push(`String(${arg})`);
        }
      }
      // Other = nested element
      else {
        children.push(this.generateComponentTemplateElement(arg));
      }
    }

    // Build tag string with classes
    const tagStr = classes.length > 0 ? `${tag}.${classes.join('.')}` : tag;
    
    // Build props string
    const propsStr = this.buildPropsString(props, spreads);
    const childrenStr = this.buildChildrenString(children);
    let result = `h('${tagStr}', ${propsStr}${childrenStr})`;

    if (refVar) {
      result = `(${refVar} = ${result})`;
    }

    return result;
  }

  /**
   * Generate component instantiation in template context
   * Button label: "Click" → new Button({ label: "Click" }).render()
   */
  generateComponentInstance(componentName, args) {
    const props = {};
    const children = [];
    
    for (const arg of args) {
      // Object = props
      if (Array.isArray(arg) && arg[0] === 'object') {
        for (let i = 1; i < arg.length; i++) {
          const [key, value] = arg[i];
          if (typeof key === 'string') {
            props[key] = this.generateInComponent(value, 'value');
          }
        }
      }
      // Arrow function = children
      else if (Array.isArray(arg) && (arg[0] === '->' || arg[0] === '=>')) {
        const block = arg[2];
        if (Array.isArray(block) && block[0] === 'block') {
          children.push(...block.slice(1).map(s => this.generateComponentTemplateElement(s)));
        } else {
          children.push(this.generateComponentTemplateElement(block));
        }
      }
      // String = text child or prop shorthand
      else if (typeof arg === 'string') {
        if (arg.startsWith('"') || arg.startsWith("'") || arg.startsWith('`')) {
          children.push(arg);
        } else if (this.reactiveMembers && this.reactiveMembers.has(arg)) {
          children.push(`this.${arg}.value`);
        } else {
          children.push(`String(${arg})`);
        }
      }
      // Other = nested element
      else {
        children.push(this.generateComponentTemplateElement(arg));
      }
    }
    
    // Build props object
    const propsEntries = Object.entries(props);
    let propsStr = '{}';
    if (propsEntries.length > 0 || children.length > 0) {
      const entries = propsEntries.map(([k, v]) => `${k}: ${v}`);
      // Pass children as special prop if present
      if (children.length > 0) {
        const childrenStr = children.length === 1 ? children[0] : `[${children.join(', ')}]`;
        entries.push(`children: ${childrenStr}`);
      }
      propsStr = entries.length > 0 ? `{ ${entries.join(', ')} }` : '{}';
    }
    
    return `new ${componentName}(${propsStr}).render()`;
  }

  /**
   * Generate a single template element as h() call
   */
  generateTemplateElement(sexpr) {
    // String literal → text
    if (typeof sexpr === 'string') {
      if (sexpr.startsWith('"') || sexpr.startsWith("'") || sexpr.startsWith('`')) {
        return sexpr; // h() will convert strings to text nodes
      }
      // Plain tag (runtime h() handles #id and .class parsing)
      return `h('${sexpr}', 0)`;
    }

    // String object → text
    if (sexpr instanceof String) {
      return this.generate(sexpr, 'value');
    }

    // Not an array → expression text
    if (!Array.isArray(sexpr)) {
      return `txt(${this.generate(sexpr, 'value')})`;
    }

    const [head, ...rest] = sexpr;

    // String interpolation → text
    if (head === 'str') {
      return this.generate(sexpr, 'value');
    }

    // Block → multiple children (frag)
    if (head === 'block') {
      if (rest.length === 0) return 'null';
      if (rest.length === 1) return this.generateTemplateElement(rest[0]);
      const elements = rest.map(s => this.generateTemplateElement(s));
      return `frag(${elements.join(', ')})`;
    }

    // Control flow
    if (head === 'if' || head === 'unless') {
      return this.generateTemplateConditional(sexpr);
    }
    if (head === 'for-in' || head === 'for-of') {
      return this.generateTemplateLoop(sexpr);
    }

    // Property chain: div.class or user.name
    if (head === '.') {
      const [obj, prop] = rest;
      if (typeof obj === 'string' && typeof prop === 'string') {
        if (this.isHtmlTag(obj)) {
          return `h('${obj}.${prop}', 0)`;
        }
        return `txt(${this.generate(sexpr, 'value')})`;
      }
      if (Array.isArray(obj) && obj[0] === '.') {
        const { tag, classes } = this.collectTemplateClasses(sexpr);
        if (this.isHtmlTag(tag)) {
          return `h('${tag}.${classes.join('.')}', 0)`;
        }
        return `txt(${this.generate(sexpr, 'value')})`;
      }
    }

    // Tag with args: tag attr: val, "text", -> children
    if (typeof head === 'string' && !CodeGenerator.GENERATORS[head]) {
      return this.generateH(head, [], rest);
    }

    // Property chain with args: div.card -> children
    if (Array.isArray(head) && head[0] === '.') {
      // Check for dynamic class: div.__cx__('card', x && 'active')
      // Note: head[2] may be a String object, so use == for coercion
      if (head.length === 3 && head[2] == '__cx__') {
        const baseTag = head[1];
        // Collect tag and static classes if baseTag is a property chain
        let tag, classes;
        if (Array.isArray(baseTag) && baseTag[0] === '.') {
          ({ tag, classes } = this.collectTemplateClasses(baseTag));
        } else {
          tag = baseTag;
          classes = [];
        }
        // Generate cx() call for dynamic classes
        const cxArgsStr = rest.map(arg => this.generate(arg, 'value')).join(', ');
        return this.generateH(tag, classes, [], cxArgsStr);
      }
      const { tag, classes } = this.collectTemplateClasses(head);
      return this.generateH(tag, classes, rest);
    }

    // Dynamic class call with children: div.card.(x && 'active') -> children
    // head = [['.', [...], '__cx__'], ...cxArgs]  (the .__cx__ call)
    // rest = [arrow with children]
    if (Array.isArray(head) && Array.isArray(head[0]) && head[0][0] === '.' && head[0][2] == '__cx__') {
      const propAccess = head[0];  // ['.', baseTag, '__cx__']
      const cxArgs = head.slice(1);  // args to cx()
      const baseTag = propAccess[1];
      
      // Collect tag and static classes
      let tag, classes;
      if (Array.isArray(baseTag) && baseTag[0] === '.') {
        ({ tag, classes } = this.collectTemplateClasses(baseTag));
      } else {
        tag = baseTag;
        classes = [];
      }
      
      // Generate cx args and pass children through
      const cxArgsStr = cxArgs.map(arg => this.generate(arg, 'value')).join(', ');
      return this.generateH(tag, classes, rest, cxArgsStr);
    }

    // Default: expression as text
    return `txt(${this.generate(sexpr, 'value')})`;
  }

  /**
   * Parse template arguments into props, spreads, children, and ref.
   * 
   * This is the shared logic for processing template element arguments,
   * used by both generateH() and generateHWithDynamicClassAndChildren().
   * 
   * @param {Array} args - S-expression arguments
   * @param {string} tag - Element tag name (for binding event selection)
   * @returns {{ props: Object, spreads: string[], children: string[], refVar: string|null }}
   */
  parseTemplateArgs(args, tag) {
    const props = {};
    const spreads = [];
    const children = [];
    let refVar = null;

    for (const arg of args) {
      // Arrow function = children
      if (Array.isArray(arg) && (arg[0] === '->' || arg[0] === '=>')) {
        const block = arg[2];
        if (Array.isArray(block) && block[0] === 'block') {
          children.push(...block.slice(1).map(s => this.generateTemplateElement(s)));
        } else {
          children.push(this.generateTemplateElement(block));
        }
      }
      // Spread = ...props
      else if (Array.isArray(arg) && arg[0] === '...') {
        spreads.push(this.generate(arg[1], 'value'));
      }
      // Object = attributes/events
      else if (Array.isArray(arg) && arg[0] === 'object') {
        for (const pair of arg.slice(1)) {
          if (Array.isArray(pair) && pair.length >= 2) {
            const [key, value] = pair;
            
            // Check for binding directive (value <=> var)
            const bindInfo = this.parseBindingDirective(key, value, tag);
            if (bindInfo) {
              props[bindInfo.prop] = bindInfo.valueExpr;
              props[bindInfo.event] = bindInfo.handler;
              continue;
            }
            
            // Check for event handler (@click: fn)
            const eventInfo = this.parseEventHandler(key, value);
            if (eventInfo) {
              const handler = eventInfo.modifiers.length > 0
                ? this.wrapEventHandler(eventInfo.handler, eventInfo.modifiers)
                : eventInfo.handler;
              props[`on${eventInfo.eventName}`] = handler;
            } else {
              // Regular attribute
              const keyStr = typeof key === 'string' ? key : this.generate(key, 'value');
              if (keyStr === 'ref') {
                refVar = typeof value === 'string' ? value : this.generate(value, 'value');
              } else if (keyStr === 'key') {
                props.key = this.generate(value, 'value');
              } else if (keyStr === 'class') {
                props.class = this.generate(value, 'value');
              } else {
                props[keyStr] = this.generate(value, 'value');
              }
            }
          }
        }
      }
      // String = text child
      else if (typeof arg === 'string') {
        if (arg.startsWith('"') || arg.startsWith("'") || arg.startsWith('`')) {
          children.push(arg);
        } else {
          children.push(`String(${arg})`);
        }
      }
      // Other = nested element
      else {
        children.push(this.generateTemplateElement(arg));
      }
    }

    return { props, spreads, children, refVar };
  }

  /**
   * Build props string from parsed template args.
   * @param {Object} props - Property key-value pairs
   * @param {string[]} spreads - Spread expressions
   * @param {string} [classExpr] - Optional class expression (for dynamic classes)
   * @returns {string} Props object literal or '0' if empty
   */
  buildPropsString(props, spreads, classExpr = null) {
    const hasProps = Object.keys(props).length > 0;
    const hasSpreads = spreads.length > 0;
    const hasClass = classExpr !== null;
    
    if (!hasProps && !hasSpreads && !hasClass) {
      return '0';
    }
    
    const parts = [];
    // Add class expression first if present
    if (hasClass) {
      parts.push(`class: ${classExpr}`);
    }
    // Add spreads
    for (const spread of spreads) {
      parts.push(`...${spread}`);
    }
    // Add explicit props (override spreads)
    for (const [k, v] of Object.entries(props)) {
      parts.push(`${k}: ${v}`);
    }
    return `{ ${parts.join(', ')} }`;
  }

  /**
   * Build children string from array of generated children.
   * @param {string[]} children - Generated child expressions
   * @returns {string} Children argument string (including leading comma) or ''
   */
  buildChildrenString(children) {
    if (children.length === 0) return '';
    if (children.length === 1) return `, ${children[0]}`;
    return `, [${children.join(', ')}]`;
  }

  /**
   * Generate h() call with tag, classes, args, and optional dynamic class expression.
   * @param {string} tag - Element tag name
   * @param {string[]} classes - Static class names
   * @param {Array} args - S-expression arguments (attrs, children, etc.)
   * @param {string|null} cxArgs - Dynamic class args for cx(), or null for static-only
   */
  generateH(tag, classes, args, cxArgs = null) {
    this.usesTemplates = true;
    
    const { props, spreads, children, refVar } = this.parseTemplateArgs(args, tag);
    const tagStr = classes.length > 0 ? `${tag}.${classes.join('.')}` : tag;
    const classExpr = cxArgs ? `cx(${cxArgs})` : null;
    const propsStr = this.buildPropsString(props, spreads, classExpr);
    const childrenStr = this.buildChildrenString(children);
    let result = `h('${tagStr}', ${propsStr}${childrenStr})`;

    if (refVar) {
      result = `(${refVar} = ${result})`;
    }

    return result;
  }

  /**
   * Collect classes from property chain: (. (. div card) active) → {tag: "div", classes: ["card", "active"]}
   */
  collectTemplateClasses(sexpr) {
    const classes = [];
    let current = sexpr;
    while (Array.isArray(current) && current[0] === '.') {
      const prop = current[2];
      // Handle both primitive strings and String objects
      if (typeof prop === 'string' || prop instanceof String) {
        classes.unshift(prop.valueOf());
      }
      current = current[1];
    }
    const tag = typeof current === 'string' ? current : (current instanceof String ? current.valueOf() : 'div');
    return { tag, classes };
  }

  /**
   * Generate conditional in template
   */
  generateTemplateConditional(sexpr) {
    const [head, condition, thenBlock, elseBlock] = sexpr;
    const cond = this.generate(condition, 'value');
    const condExpr = head === 'unless' ? `!(${cond})` : cond;

    // Unwrap single-element arrays (postfix if)
    let actualThen = thenBlock;
    if (Array.isArray(thenBlock) && thenBlock.length === 1 && Array.isArray(thenBlock[0]) && thenBlock[0][0] !== 'block') {
      actualThen = thenBlock[0];
    }
    const thenCode = this.generateTemplateElement(actualThen);

    if (elseBlock) {
      let actualElse = elseBlock;
      if (Array.isArray(elseBlock) && elseBlock.length === 1 && Array.isArray(elseBlock[0]) && elseBlock[0][0] !== 'block') {
        actualElse = elseBlock[0];
      }
      return `(${condExpr} ? ${thenCode} : ${this.generateTemplateElement(actualElse)})`;
    }
    return `(${condExpr} ? ${thenCode} : null)`;
  }

  /**
   * Generate loop in template
   */
  generateTemplateLoop(sexpr) {
    const [head] = sexpr;
    if (head === 'for-in') return this.generateTemplateForIn(sexpr);
    if (head === 'for-of') return this.generateTemplateForOf(sexpr);
    return 'null';
  }

  /**
   * Generate for-in loop: for item in items
   */
  generateTemplateForIn(sexpr) {
    const [, vars, iterable, , guard, body] = sexpr;
    const itemVar = Array.isArray(vars) && vars[0] ? (typeof vars[0] === 'string' ? vars[0] : this.generate(vars[0], 'value')) : '__item';
    const indexVar = Array.isArray(vars) && vars[1] ? (typeof vars[1] === 'string' ? vars[1] : '__i') : '__i';
    const iterCode = this.generate(iterable, 'value');
    const bodyCode = this.generateTemplateElement(body);
    const guardCode = guard ? `if (!(${this.generate(guard, 'value')})) continue; ` : '';

    return `frag(...${iterCode}.map((${itemVar}, ${indexVar}) => ${guardCode ? `{ ${guardCode}return ${bodyCode}; }` : bodyCode}))`;
  }

  /**
   * Generate for-of loop: for key, val of obj
   */
  generateTemplateForOf(sexpr) {
    const [, vars, object, own, guard, body] = sexpr;
    const keyVar = Array.isArray(vars) && vars[0] ? (typeof vars[0] === 'string' ? vars[0] : '__k') : '__k';
    const valVar = Array.isArray(vars) && vars[1] ? (typeof vars[1] === 'string' ? vars[1] : null) : null;
    const objCode = this.generate(object, 'value');
    const bodyCode = this.generateTemplateElement(body);

    const entries = own ? `Object.entries(${objCode})` : `Object.entries(${objCode})`;
    const destructure = valVar ? `[${keyVar}, ${valVar}]` : `[${keyVar}]`;
    const guardCode = guard ? `if (!(${this.generate(guard, 'value')})) continue; ` : '';

    return `frag(...${entries}.map((${destructure}) => ${guardCode ? `{ ${guardCode}return ${bodyCode}; }` : bodyCode}))`;
  }

  //-------------------------------------------------------------------------
  // CONTROL FLOW - Simple Statements
  //-------------------------------------------------------------------------

  /**
   * Generate break statement
   * Pattern: ["break"]
   */
  generateBreak(head, rest, context, sexpr) {
    return 'break';
  }

  /**
   * Generate conditional break
   * Pattern: ["break-if", condition]
   */
  generateBreakIf(head, rest, context, sexpr) {
    const [condition] = rest;
    return `if (${this.generate(condition, 'value')}) break`;
  }

  /**
   * Generate continue statement
   * Pattern: ["continue"]
   */
  generateContinue(head, rest, context, sexpr) {
    return 'continue';
  }

  /**
   * Generate conditional continue
   * Pattern: ["continue-if", condition]
   */
  generateContinueIf(head, rest, context, sexpr) {
    const [condition] = rest;
    return `if (${this.generate(condition, 'value')}) continue`;
  }

  /**
   * Generate existential check (?)
   * Pattern: ["?", expr] → (expr != null)
   */
  generateExistential(head, rest, context, sexpr) {
    const [expr] = rest;
    return `(${this.generate(expr, 'value')} != null)`;
  }

  /**
   * Generate ternary operator (?:)
   * Pattern: ["?:", condition, thenExpr, elseExpr]
   */
  generateTernary(head, rest, context, sexpr) {
    const [condition, thenExpr, elseExpr] = rest;
    const condCode = this.unwrap(this.generate(condition, 'value'));
    return `(${condCode} ? ${this.generate(thenExpr, 'value')} : ${this.generate(elseExpr, 'value')})`;
  }

  /**
   * Generate infinite loop
   * Pattern: ["loop", body]
   */
  generateLoop(head, rest, context, sexpr) {
    const [body] = rest;
    const bodyCode = this.generateLoopBody(body);
    return `while (true) ${bodyCode}`;
  }

  /**
   * Generate await expression
   * Pattern: ["await", expr]
   */
  generateAwait(head, rest, context, sexpr) {
    const [expr] = rest;
    return `await ${this.generate(expr, 'value')}`;
  }

  /**
   * Generate yield expression
   * Pattern: ["yield"] or ["yield", expr]
   */
  generateYield(head, rest, context, sexpr) {
    if (rest.length === 0) {
      return 'yield';
    }
    const [expr] = rest;
    return `yield ${this.generate(expr, 'value')}`;
  }

  /**
   * Generate yield* delegation
   * Pattern: ["yield-from", expr]
   */
  generateYieldFrom(head, rest, context, sexpr) {
    const [expr] = rest;
    return `yield* ${this.generate(expr, 'value')}`;
  }

  //-------------------------------------------------------------------------
  // CONTROL FLOW - Conditionals
  //-------------------------------------------------------------------------

  /**
   * Generate if/unless statement
   * Pattern: ["if", condition, thenBranch, ...elseBranches] or ["unless", condition, body]
   */
  generateIf(head, rest, context, sexpr) {
    if (head === 'unless') {
      // Unless statement
      let [condition, body] = rest;

      // Unwrap single-element array body
      if (Array.isArray(body) && body.length === 1) {
        const elem = body[0];
        if (!Array.isArray(elem) || elem[0] !== 'block') {
          body = elem;
        }
      }

      // Context-aware generation
      if (context === 'value') {
        const thenExpr = this.extractExpression(body);
        return `(!${this.generate(condition, 'value')} ? ${thenExpr} : undefined)`;
      }

      // Statement context
      let condCode = this.unwrap(this.generate(condition, 'value'));
      if (condCode.includes(' ') || condCode.includes('===') || condCode.includes('!==') ||
          condCode.includes('>') || condCode.includes('<') || condCode.includes('&&') || condCode.includes('||')) {
        condCode = `(${condCode})`;
      }
      return `if (!${condCode}) ` + this.generate(body, 'statement');
    }

    // If statement
    const [condition, thenBranch, ...elseBranches] = rest;

    if (context === 'value') {
      return this.generateIfAsExpression(condition, thenBranch, elseBranches);
    } else {
      return this.generateIfAsStatement(condition, thenBranch, elseBranches);
    }
  }

  //-------------------------------------------------------------------------
  // CONTROL FLOW - Loops
  //-------------------------------------------------------------------------

  /**
   * Generate for-in loop (MASSIVE - 203 lines)
   * Pattern: ["for-in", vars, iterable, step, guard, body]
   */
  generateForIn(head, rest, context, sexpr) {
    const [vars, iterable, step, guard, body] = rest;

    // In value context, convert to comprehension
    if (context === 'value' && this.comprehensionDepth === 0) {
      const iterator = ['for-in', vars, iterable, step];
      const guards = guard ? [guard] : [];
      return this.generate(['comprehension', body, [iterator], guards], context);
    }

    const varsArray = Array.isArray(vars) ? vars : [vars];
    const noVar = varsArray.length === 0;
    const [itemVar, indexVar] = noVar ? ['_i', null] : varsArray;

    let itemVarPattern = itemVar;
    if (Array.isArray(itemVar) && (itemVar[0] === 'array' || itemVar[0] === 'object')) {
      itemVarPattern = this.generateDestructuringPattern(itemVar);
    }

    // Handle step
    if (step && step !== null) {
      const iterableCode = this.generate(iterable, 'value');
      const indexVarName = indexVar || '_i';
      const stepCode = this.generate(step, 'value');

      const isNegativeStep = this.isNegativeStep(step);
      const isMinusOne = isNegativeStep && (step[1] === '1' || step[1] === 1 || (step[1] instanceof String && step[1].valueOf() === '1'));
      const isPlusOne = !isNegativeStep && (step === '1' || step === 1 || (step instanceof String && step.valueOf() === '1'));

      let loopHeader;
      if (isMinusOne) {
        loopHeader = `for (let ${indexVarName} = ${iterableCode}.length - 1; ${indexVarName} >= 0; ${indexVarName}--) `;
      } else if (isPlusOne) {
        loopHeader = `for (let ${indexVarName} = 0; ${indexVarName} < ${iterableCode}.length; ${indexVarName}++) `;
      } else if (isNegativeStep) {
        loopHeader = `for (let ${indexVarName} = ${iterableCode}.length - 1; ${indexVarName} >= 0; ${indexVarName} += ${stepCode}) `;
      } else {
        loopHeader = `for (let ${indexVarName} = 0; ${indexVarName} < ${iterableCode}.length; ${indexVarName} += ${stepCode}) `;
      }

      if (Array.isArray(body) && body[0] === 'block') {
        const statements = body.slice(1);
        this.indentLevel++;
        const stmts = [];

        if (!noVar) {
          stmts.push(`const ${itemVarPattern} = ${iterableCode}[${indexVarName}];`);
        }

        if (guard) {
          const guardCode = this.generate(guard, 'value');
          stmts.push(`if (${guardCode}) {`);
          this.indentLevel++;
          stmts.push(...this.formatStatements(statements));
          this.indentLevel--;
          stmts.push(this.indent() + '}');
        } else {
          stmts.push(...statements.map(s => this.addSemicolon(s, this.generate(s, 'statement'))));
        }

        this.indentLevel--;
        return loopHeader + `{\n${stmts.map(s => this.indent() + s).join('\n')}\n${this.indent()}}`;
      } else {
        if (noVar) {
          if (guard) {
            const guardCode = this.generate(guard, 'value');
            return loopHeader + `{ if (${guardCode}) ${this.generate(body, 'statement')}; }`;
          } else {
            return loopHeader + `{ ${this.generate(body, 'statement')}; }`;
          }
        } else {
          if (guard) {
            const guardCode = this.generate(guard, 'value');
            return loopHeader + `{ const ${itemVarPattern} = ${iterableCode}[${indexVarName}]; if (${guardCode}) ${this.generate(body, 'statement')}; }`;
          } else {
            return loopHeader + `{ const ${itemVarPattern} = ${iterableCode}[${indexVarName}]; ${this.generate(body, 'statement')}; }`;
          }
        }
      }
    }

    // If index variable, use traditional for loop
    if (indexVar) {
      const iterableCode = this.generate(iterable, 'value');
      let code = `for (let ${indexVar} = 0; ${indexVar} < ${iterableCode}.length; ${indexVar}++) `;

      if (Array.isArray(body) && body[0] === 'block') {
        const statements = body.slice(1);
        code += '{\n';
        this.indentLevel++;
        code += this.indent() + `const ${itemVarPattern} = ${iterableCode}[${indexVar}];\n`;

        if (guard) {
          const guardCode = this.unwrap(this.generate(guard, 'value'));
          code += this.indent() + `if (${guardCode}) {\n`;
          this.indentLevel++;
          code += this.formatStatements(statements).join('\n') + '\n';
          this.indentLevel--;
          code += this.indent() + '}\n';
        } else {
          code += this.formatStatements(statements).join('\n') + '\n';
        }

        this.indentLevel--;
        code += this.indent() + '}';
      } else {
        if (guard) {
          const guardCode = this.unwrap(this.generate(guard, 'value'));
          code += `{ const ${itemVarPattern} = ${iterableCode}[${indexVar}]; if (${guardCode}) ${this.generate(body, 'statement')}; }`;
        } else {
          code += `{ const ${itemVarPattern} = ${iterableCode}[${indexVar}]; ${this.generate(body, 'statement')}; }`;
        }
      }

      return code;
    }

    // Optimize range iteration
    let iterableHead = Array.isArray(iterable) && iterable[0];
    if (iterableHead instanceof String) {
      iterableHead = iterableHead.valueOf();
    }
    const isRange = iterableHead === '..' || iterableHead === '...';

    if (isRange) {
      const isExclusive = iterableHead === '...';
      const [start, end] = iterable.slice(1);

      const isSimple = (expr) => {
        if (typeof expr === 'number') return true;
        if (expr instanceof String) {
          const val = expr.valueOf();
          return !val.includes('(');
        }
        if (typeof expr === 'string' && !expr.includes('(')) return true;
        if (Array.isArray(expr) && expr[0] === '.') return true;
        return false;
      };

      if (isSimple(start) && isSimple(end)) {
        const startCode = this.generate(start, 'value');
        const endCode = this.generate(end, 'value');
        const comparison = isExclusive ? '<' : '<=';

        let increment = `${itemVarPattern}++`;
        if (step && step !== null) {
          const stepCode = this.generate(step, 'value');
          increment = `${itemVarPattern} += ${stepCode}`;
        }

        let code = `for (let ${itemVarPattern} = ${startCode}; ${itemVarPattern} ${comparison} ${endCode}; ${increment}) `;

        if (guard) {
          code += this.generateLoopBodyWithGuard(body, guard);
        } else {
          code += this.generateLoopBody(body);
        }

        return code;
      }
    }

    // Default: use for-of
    let code = `for (const ${itemVarPattern} of ${this.generate(iterable, 'value')}) `;

    if (guard) {
      code += this.generateLoopBodyWithGuard(body, guard);
    } else {
      code += this.generateLoopBody(body);
    }

    return code;
  }

  /**
   * Generate for-of loop (object iteration) - 113 lines
   * Pattern: ["for-of", vars, object, own, guard, body]
   */
  generateForOf(head, rest, context, sexpr) {
    const [vars, obj, own, guard, body] = rest;
    const [keyVar, valueVar] = Array.isArray(vars) ? vars : [vars];

    const objCode = this.generate(obj, 'value');
    let code = `for (const ${keyVar} in ${objCode}) `;

    // Simple case: own without valueVar and without guards
    if (own && !valueVar && !guard) {
      if (Array.isArray(body) && body[0] === 'block') {
        const statements = body.slice(1);
        this.indentLevel++;
        const stmts = [
          `if (!Object.hasOwn(${objCode}, ${keyVar})) continue;`,
          ...statements.map(s => this.addSemicolon(s, this.generate(s, 'statement')))
        ];
        this.indentLevel--;
        code += `{\n${stmts.map(s => this.indent() + s).join('\n')}\n${this.indent()}}`;
      } else {
        code += `{ if (!Object.hasOwn(${objCode}, ${keyVar})) continue; ${this.generate(body, 'statement')}; }`;
      }
      return code;
    }

    // If valueVar is provided
    if (valueVar) {
      if (own && guard) {
        // Both own and guard
        if (Array.isArray(body) && body[0] === 'block') {
          const statements = body.slice(1);
          this.indentLevel++;
          const outerIndent = this.indent();
          const guardCondition = this.generate(guard, 'value');
          this.indentLevel++;
          const innerIndent = this.indent();
          const stmts = statements.map(s => innerIndent + this.addSemicolon(s, this.generate(s, 'statement')));
          this.indentLevel -= 2;
          code += `{\n${outerIndent}if (!Object.hasOwn(${objCode}, ${keyVar})) continue;\n${outerIndent}const ${valueVar} = ${objCode}[${keyVar}];\n${outerIndent}if (${guardCondition}) {\n${stmts.join('\n')}\n${outerIndent}}\n${this.indent()}}`;
        } else {
          const guardCondition = this.generate(guard, 'value');
          code += `{ if (!Object.hasOwn(${objCode}, ${keyVar})) continue; const ${valueVar} = ${objCode}[${keyVar}]; if (${guardCondition}) ${this.generate(body, 'statement')}; }`;
        }
      } else if (own) {
        // Just own (no guard) with valueVar
        if (Array.isArray(body) && body[0] === 'block') {
          const statements = body.slice(1);
          this.indentLevel++;
          const stmts = [
            `if (!Object.hasOwn(${objCode}, ${keyVar})) continue;`,
            `const ${valueVar} = ${objCode}[${keyVar}];`,
            ...statements.map(s => this.addSemicolon(s, this.generate(s, 'statement')))
          ];
          this.indentLevel--;
          code += `{\n${stmts.map(s => this.indent() + s).join('\n')}\n${this.indent()}}`;
        } else {
          code += `{ if (!Object.hasOwn(${objCode}, ${keyVar})) continue; const ${valueVar} = ${objCode}[${keyVar}]; ${this.generate(body, 'statement')}; }`;
        }
      } else if (guard) {
        // Just guard (no own) with valueVar
        if (Array.isArray(body) && body[0] === 'block') {
          const statements = body.slice(1);
          this.indentLevel++;
          const loopBodyIndent = this.indent();
          const guardCondition = this.generate(guard, 'value');
          this.indentLevel++;
          const innerIndent = this.indent();
          const stmts = statements.map(s => innerIndent + this.addSemicolon(s, this.generate(s, 'statement')));
          this.indentLevel -= 2;
          code += `{\n${loopBodyIndent}const ${valueVar} = ${objCode}[${keyVar}];\n${loopBodyIndent}if (${guardCondition}) {\n${stmts.join('\n')}\n${loopBodyIndent}}\n${this.indent()}}`;
        } else {
          code += `{ const ${valueVar} = ${objCode}[${keyVar}]; if (${this.generate(guard, 'value')}) ${this.generate(body, 'statement')}; }`;
        }
      } else {
        // No checks, just valueVar assignment
        if (Array.isArray(body) && body[0] === 'block') {
          const statements = body.slice(1);
          this.indentLevel++;
          const stmts = [`const ${valueVar} = ${objCode}[${keyVar}];`, ...statements.map(s => this.addSemicolon(s, this.generate(s, 'statement')))];
          this.indentLevel--;
          code += `{\n${stmts.map(s => this.indent() + s).join('\n')}\n${this.indent()}}`;
        } else {
          code += `{ const ${valueVar} = ${objCode}[${keyVar}]; ${this.generate(body, 'statement')}; }`;
        }
      }
    } else {
      // No value variable
      if (guard) {
        code += this.generateLoopBodyWithGuard(body, guard);
      } else {
        code += this.generateLoopBody(body);
      }
    }

    return code;
  }

  /**
   * Generate for-from loop - 100 lines
   * Pattern: ["for-from", vars, iterable, isAwait, guard, body]
   */
  generateForFrom(head, rest, context, sexpr) {
    const varsArray = Array.isArray(rest[0]) ? rest[0] : [rest[0]];
    const [firstVar] = varsArray;
    const iterable = rest[1];
    const isAwait = rest[2];
    const guard = rest[3];
    const body = rest[4];

    // Check if firstVar is array destructuring with middle/leading rest
    let needsTempVar = false;
    let destructuringStatements = [];

    if (Array.isArray(firstVar) && firstVar[0] === 'array') {
      const elements = firstVar.slice(1);
      const restIndex = elements.findIndex(el =>
        Array.isArray(el) && el[0] === '...' || el === '...'
      );

      if (restIndex !== -1 && restIndex < elements.length - 1) {
        needsTempVar = true;
        const elementsAfterRest = elements.slice(restIndex + 1);
        const afterCount = elementsAfterRest.length;

        const beforeRest = elements.slice(0, restIndex);
        const restEl = elements[restIndex];
        const restVar = Array.isArray(restEl) && restEl[0] === '...' ? restEl[1] : '_rest';

        const beforePattern = beforeRest.map(el => {
          if (el === ',') return '';
          if (typeof el === 'string') return el;
          return this.generate(el, 'value');
        }).join(', ');

        const firstPattern = beforePattern ? `${beforePattern}, ...${restVar}` : `...${restVar}`;
        const afterPattern = elementsAfterRest.map(el => {
          if (el === ',') return '';
          if (typeof el === 'string') return el;
          return this.generate(el, 'value');
        }).join(', ');

        destructuringStatements.push(`[${firstPattern}] = _item`);
        destructuringStatements.push(`[${afterPattern}] = ${restVar}.splice(-${afterCount})`);

        this.helpers.add('slice');

        const collectVarsFromPattern = (arr) => {
          arr.slice(1).forEach(el => {
            if (el === ',' || el === '...') return;
            if (typeof el === 'string') this.programVars.add(el);
            else if (Array.isArray(el) && el[0] === '...') {
              if (typeof el[1] === 'string') this.programVars.add(el[1]);
            }
          });
        };
        collectVarsFromPattern(firstVar);
      }
    }

    const iterableCode = this.generate(iterable, 'value');
    const awaitKeyword = isAwait ? 'await ' : '';

    let itemVarPattern;
    if (needsTempVar) {
      itemVarPattern = '_item';
    } else if (Array.isArray(firstVar) && (firstVar[0] === 'array' || firstVar[0] === 'object')) {
      itemVarPattern = this.generateDestructuringPattern(firstVar);
    } else {
      itemVarPattern = firstVar;
    }

    let code = `for ${awaitKeyword}(const ${itemVarPattern} of ${iterableCode}) `;

    if (needsTempVar && destructuringStatements.length > 0) {
      const statements = this.unwrapBlock(body);
      const allStmts = this.withIndent(() => [
        ...destructuringStatements.map(s => this.indent() + s + ';'),
        ...this.formatStatements(statements)
      ]);
      code += `{\n${allStmts.join('\n')}\n${this.indent()}}`;
    } else {
      if (guard) {
        code += this.generateLoopBodyWithGuard(body, guard);
      } else {
        code += this.generateLoopBody(body);
      }
    }

    return code;
  }

  /**
   * Generate while loop
   * Pattern: ["while", condition, guard?, body]
   */
  generateWhile(head, rest, context, sexpr) {
    const condition = rest[0];
    const guard = rest.length === 3 ? rest[1] : null;
    const body = rest[rest.length - 1];

    const condCode = this.unwrap(this.generate(condition, 'value'));
    let code = `while (${condCode}) `;

    if (guard) {
      code += this.generateLoopBodyWithGuard(body, guard);
    } else {
      code += this.generateLoopBody(body);
    }

    return code;
  }

  /**
   * Generate until loop
   * Pattern: ["until", condition, body]
   */
  generateUntil(head, rest, context, sexpr) {
    const [condition, body] = rest;
    const condCode = this.unwrap(this.generate(condition, 'value'));
    let code = `while (!(${condCode})) `;
    code += this.generateLoopBody(body);
    return code;
  }

  /**
   * Generate range (.. or ...)
   * Pattern: ["..", start, end] or ["...", start, end] or ["...", expr] (spread)
   */
  generateRange(head, rest, context, sexpr) {
    if (head === '...') {
      if (rest.length === 1) {
        // Spread operator
        const [expr] = rest;
        return `...${this.generate(expr, 'value')}`;
      }
      // Exclusive range
      const [start, end] = rest;
      const startCode = this.generate(start, 'value');
      const endCode = this.generate(end, 'value');
      return `((s, e) => Array.from({length: Math.max(0, Math.abs(e - s))}, (_, i) => s + (i * (s <= e ? 1 : -1))))(${startCode}, ${endCode})`;
    }
    // Inclusive range
    const [start, end] = rest;
    const startCode = this.generate(start, 'value');
    const endCode = this.generate(end, 'value');
    return `((s, e) => Array.from({length: Math.abs(e - s) + 1}, (_, i) => s + (i * (s <= e ? 1 : -1))))(${startCode}, ${endCode})`;
  }

  /**
   * Generate logical NOT (!)
   * Pattern: ["!", operand] → !operand
   * S-expression approach: Check operand TYPE (IR level, not generated string)
   */
  generateNot(head, rest, context, sexpr) {
    const [operand] = rest;

    // Check operand TYPE at s-expression level (following Rip philosophy)

    // Primitives (identifiers, numbers, keywords) - no parens needed
    if (typeof operand === 'string' || operand instanceof String) {
      return `!${this.generate(operand, 'value')}`;  // !x, !1, !true, !null
    }

    // High-precedence s-expressions (property/array access) - no parens
    if (Array.isArray(operand)) {
      const type = operand[0];
      const highPrecedence = ['.', '?.', '::', '?::', '[]', '?[]', 'optindex', 'optcall'];
      if (highPrecedence.includes(type)) {
        return `!${this.generate(operand, 'value')}`;  // !obj.prop, !arr[0]
      }
    }

    // Everything else - conservative (add parens for safety)
    const operandCode = this.generate(operand, 'value');
    if (operandCode.startsWith('(')) {
      return `!${operandCode}`;  // Already has parens: !(a + b)
    }
    return `(!${operandCode})`;
  }

  /**
   * Generate bitwise NOT (~)
   * Pattern: ["~", operand] → ~operand
   */
  generateBitwiseNot(head, rest, context, sexpr) {
    const [operand] = rest;
    return `(~${this.generate(operand, 'value')})`;
  }

  /**
   * Generate increment/decrement (++ or --)
   * Pattern: ["++", operand, isPostfix] or ["--", operand, isPostfix]
   */
  generateIncDec(head, rest, context, sexpr) {
    const [operand, isPostfix] = rest;
    const operandCode = this.generate(operand, 'value');

    if (isPostfix) {
      return `(${operandCode}${head})`;  // x++
    } else {
      return `(${head}${operandCode})`;  // ++x
    }
  }

  /**
   * Generate typeof operator
   * Pattern: ["typeof", operand] → typeof operand
   */
  generateTypeof(head, rest, context, sexpr) {
    const [operand] = rest;
    return `typeof ${this.generate(operand, 'value')}`;
  }

  /**
   * Generate delete operator
   * Pattern: ["delete", operand] → delete operand
   */
  generateDelete(head, rest, context, sexpr) {
    const [operand] = rest;
    return `(delete ${this.generate(operand, 'value')})`;
  }

  /**
   * Generate instanceof operator
   * Pattern: ["instanceof", expr, type] → expr instanceof type
   */
  generateInstanceof(head, rest, context, sexpr) {
    const [expr, type] = rest;
    const isNegated = sexpr[0]?.invert;
    const result = `(${this.generate(expr, 'value')} instanceof ${this.generate(type, 'value')})`;
    return isNegated ? `(!${result})` : result;
  }

  /**
   * Generate 'in' operator
   * Pattern: ["in", key, container] → membership check
   *
   * JavaScript's 'in' checks INDICES in arrays, not VALUES!
   * So we need to dispatch based on container type:
   * - Arrays/strings → .includes() (check values)
   * - Objects → 'in' operator (check properties)
   *
   * Strategy:
   * - Object literals: Use JavaScript 'in' directly
   * - Everything else: Runtime check with .includes() for arrays/strings
   *
   * Issue #60: Previous implementation only handled string literal in variable
   */
  generateIn(head, rest, context, sexpr) {
    const [key, container] = rest;
    const keyCode = this.generate(key, 'value');
    const isNegated = sexpr[0]?.invert;

    // Object literal → Use JavaScript 'in' for property checks
    // Pattern: ["in", key, ["object", ...pairs]]
    if (Array.isArray(container) && container[0] === 'object') {
      const objCode = this.generate(container, 'value');
      const result = `(${keyCode} in ${objCode})`;
      return isNegated ? `(!${result})` : result;
    }

    // Everything else (arrays, strings, variables) → Runtime check
    // This handles:
    // - Array literals: 'x' in ['a', 'b']
    // - Array variables: val in list
    // - String variables: 'e' in str
    // Runtime dispatches to:
    // - .includes() for arrays/strings (checks values)
    // - 'in' for objects (checks properties)
    const containerCode = this.generate(container, 'value');
    const result = `(Array.isArray(${containerCode}) || typeof ${containerCode} === 'string' ? ${containerCode}.includes(${keyCode}) : (${keyCode} in ${containerCode}))`;
    return isNegated ? `(!${result})` : result;
  }

  /**
   * Generate 'of' operator (existence check)
   * Pattern: ["of", value, container] → value in container
   */
  generateOf(head, rest, context, sexpr) {
    const [value, container] = rest;
    const valueCode = this.generate(value, 'value');
    const containerCode = this.generate(container, 'value');
    const isNegated = sexpr[0]?.invert;
    const result = `(${valueCode} in ${containerCode})`;
    return isNegated ? `(!${result})` : result;
  }

  /**
   * Generate regex match operator (=~)
   * Pattern: ["=~", left, right] → (_ = toSearchable(left).match(right))
   */
  generateRegexMatch(head, rest, context, sexpr) {
    const [left, right] = rest;

    // Mark that we need the toSearchable helper and _ variable
    this.helpers.add('toSearchable');
    this.programVars.add('_');

    // Check if regex has 'm' flag (multiline) to allow newlines in toSearchable
    const rightCode = this.generate(right, 'value');
    const hasMultilineFlag = rightCode.includes('/m');
    const allowNewlines = hasMultilineFlag ? ', true' : '';

    return `(_ = toSearchable(${this.generate(left, 'value')}${allowNewlines}).match(${rightCode}))`;
  }

  /**
   * Generate new operator
   * Pattern: ["new", [constructor, ...args]]
   */
  generateNew(head, rest, context, sexpr) {
    const [call] = rest;

    // Check if call is a property access
    if (Array.isArray(call) && (call[0] === '.' || call[0] === '?.')) {
      const [accessType, target, prop] = call;

      // Check if target is itself a function call
      if (Array.isArray(target) && !target[0].startsWith) {
        // Pattern: new fn().prop → (new fn()).prop
        const newExpr = this.generate(['new', target], 'value');
        return `(${newExpr}).${prop}`;
      }

      // Pattern: new obj.klass → new obj.klass
      const targetCode = this.generate(target, 'value');
      return `new ${targetCode}.${prop}`;
    }

    if (Array.isArray(call)) {
      const [constructor, ...args] = call;
      const constructorCode = this.generate(constructor, 'value');
      const argsCode = args.map(arg => this.unwrap(this.generate(arg, 'value'))).join(', ');
      return `new ${constructorCode}(${argsCode})`;
    }

    // Fallback: just the constructor without args
    return `new ${this.generate(call, 'value')}()`;
  }

  /**
   * Generate logical AND operator
   * Pattern: ["&&", left, right, ...]
   * Flattens nested chains: ["&&", ["&&", a, b], c] → a && b && c
   */
  generateLogicalAnd(head, rest, context, sexpr) {
    const flattened = this.flattenBinaryChain(sexpr);
    const operands = flattened.slice(1);

    if (operands.length === 0) return 'true';
    if (operands.length === 1) return this.generate(operands[0], 'value');

    const parts = operands.map(op => this.generate(op, 'value'));
    return `(${parts.join(' && ')})`;
  }

  /**
   * Generate logical OR operator
   * Pattern: ["||", left, right, ...]
   * Flattens nested chains: ["||", ["||", a, b], c] → a || b || c
   */
  generateLogicalOr(head, rest, context, sexpr) {
    const flattened = this.flattenBinaryChain(sexpr);
    const operands = flattened.slice(1);

    if (operands.length === 0) return 'true';
    if (operands.length === 1) return this.generate(operands[0], 'value');

    const parts = operands.map(op => this.generate(op, 'value'));
    return `(${parts.join(' || ')})`;
  }

  //-------------------------------------------------------------------------
  // DATA STRUCTURES
  //-------------------------------------------------------------------------

  /**
   * Generate array literal
   * Pattern: ["array", ...elements]
   */
  generateArray(head, elements, context, sexpr) {
    // Check if last element is an elision that needs to be preserved
    const hasTrailingElision = elements.length > 0 && elements[elements.length - 1] === ',';

    const elementCodes = elements.map(el => {
      // Comma token represents elision (hole) - preserve as empty
      if (el === ',') {
        return '';  // Empty string will create elision when joined
      }
      // Bare spread marker without variable (expansion marker) - skip in output
      if (el === '...') {
        return '';  // Will create hole, but that's intentional for expansion
      }
      // Check for spread with variable: ["...", expr]
      if (Array.isArray(el) && el[0] === '...') {
        return `...${this.generate(el[1], 'value')}`;
      }
      return this.generate(el, 'value');
    }).join(', ');

    // If the last element was an elision, we need to add an extra comma
    // because join() creates a trailing comma that JavaScript ignores
    return hasTrailingElision ? `[${elementCodes},]` : `[${elementCodes}]`;
  }

  /**
   * Generate object literal
   * Pattern: ["object", [key, value, operator], ...]
   */
  generateObject(head, pairs, context, sexpr) {
    // Check if this is actually an object comprehension
    if (pairs.length === 1 && Array.isArray(pairs[0]) &&
        Array.isArray(pairs[0][1]) && pairs[0][1][0] === 'comprehension') {
      // Object comprehension pattern: ["object", [keyVar, ["comprehension", valueExpr, iterators, guards]]]
      const [keyVar, comprehensionNode] = pairs[0];
      const [, valueExpr, iterators, guards] = comprehensionNode;

      // Convert to object-comprehension
      return this.generate(['object-comprehension', keyVar, valueExpr, iterators, guards], context);
    }

    // Regular object literal
    const pairCodes = pairs.map(pair => {
      // Check for spread/rest: ["...", expr] (not a key-value pair)
      if (Array.isArray(pair) && pair[0] === '...') {
        // Spread/rest operator
        return `...${this.generate(pair[1], 'value')}`;
      }

      // All regular pairs now have format: [key, value, operator]
      const [key, value, operator] = pair;

      // Check if key is computed: ["computed", expression]
      let keyCode;
      if (Array.isArray(key) && key[0] === 'computed') {
        // Computed property: [expr] syntax
        const expr = key[1];
        keyCode = `[${this.generate(expr, 'value')}]`;
      } else {
        // Regular key (string or identifier)
        keyCode = this.generate(key, 'value');
      }

      const valueCode = this.generate(value, 'value');

      // Handle different operators
      if (operator === '=') {
        // Destructuring with default: {a = 5}
        return `${keyCode} = ${valueCode}`;
      } else if (operator === ':') {
        // Explicit property: {a: 5}
        return `${keyCode}: ${valueCode}`;
      } else {
        // operator is null/undefined - shorthand or inferred
        // Shorthand property syntax: {name} instead of {name: name}
        if (keyCode === valueCode && !Array.isArray(key)) {
          return keyCode;
        }
        return `${keyCode}: ${valueCode}`;
      }
    }).join(', ');

    return `{${pairCodes}}`;
  }

  /**
   * Generate block (sequence of statements)
   * Pattern: ["block", ...statements]
   */
  generateBlock(head, statements, context, sexpr) {
    // In statement context, generate as block with braces
    if (context === 'statement') {
      const stmts = this.withIndent(() => this.formatStatements(statements));
      return `{\n${stmts.join('\n')}\n${this.indent()}}`;
    }
    // In value context, just format statements
    return this.formatStatements(statements, context);
  }

  /**
   * Generate try/catch/finally statement
   * Pattern: ["try", tryBlock, catchClause?, finallyBlock?]
   */
  generateTry(head, rest, context, sexpr) {
    // In value context, need implicit returns
    const needsReturns = context === 'value';

    // Build try statement
    let tryCode = 'try ';

    // Generate try block with implicit return if needed
    const tryBlock = rest[0];
    if (needsReturns && Array.isArray(tryBlock) && tryBlock[0] === 'block') {
      tryCode += this.generateBlockWithReturns(tryBlock);
    } else {
      tryCode += this.generate(tryBlock, 'statement');
    }

    // Check for catch clause (distinguish from finally block)
    // Catch: [param, block] where param is a string or null or destructuring pattern
    // Finally: ["block", ...] directly
    if (rest.length >= 2 && Array.isArray(rest[1]) && rest[1].length === 2 && rest[1][0] !== 'block') {
      // Has catch: [param, block]
      let [param, catchBlock] = rest[1];
      tryCode += ' catch';

      // Check if param is a destructuring pattern (object or array)
      if (param && Array.isArray(param) && (param[0] === 'object' || param[0] === 'array')) {
        // Destructuring: catch (error) { ({code} = error); ... }
        const tempVar = 'error';
        tryCode += ` (${tempVar})`;

        // Create destructuring statement (needs parens for object destructuring)
        const destructPattern = this.generate(param, 'value');
        const destructStmt = `(${destructPattern} = ${tempVar})`;

        // Prepend to catch block
        if (Array.isArray(catchBlock) && catchBlock[0] === 'block') {
          catchBlock = ['block', destructStmt, ...catchBlock.slice(1)];
        } else {
          catchBlock = ['block', destructStmt, catchBlock];
        }
      } else if (param) {
        // Simple param
        tryCode += ` (${param})`;
      }

      // Generate catch block with implicit return if needed
      if (needsReturns && Array.isArray(catchBlock) && catchBlock[0] === 'block') {
        tryCode += ' ' + this.generateBlockWithReturns(catchBlock);
      } else {
        tryCode += ' ' + this.generate(catchBlock, 'statement');
      }
    } else if (rest.length === 2) {
      // Just finally (no catch)
      tryCode += ' finally ' + this.generate(rest[1], 'statement');
    }

    // Check for finally (after catch)
    if (rest.length === 3) {
      tryCode += ' finally ' + this.generate(rest[2], 'statement');
    }

    // In value context, wrap in IIFE
    if (needsReturns) {
      // Check if try block contains await - if so, make IIFE async
      const isAsync = this.containsAwait(rest[0]) ||
                     (rest[1] && this.containsAwait(rest[1]));
      const asyncPrefix = isAsync ? 'async ' : '';
      return `(${asyncPrefix}() => { ${tryCode} })()`;
    }

    return tryCode;
  }

  /**
   * Generate throw statement
   * Pattern: ["throw", expression]
   */
  generateThrow(head, rest, context, sexpr) {
    let [expr] = rest;

    // Check if we need to extract a conditional wrapper
    // Pattern: ["throw", ["new", ["unless", condition, body]]]
    let extractedCond = null;

    if (Array.isArray(expr)) {
      // Check if the expression contains if/unless at the top level or nested in new
      let checkExpr = expr;
      let wrapperType = null;

      // If it's new, check what new wraps
      if (expr[0] === 'new' && Array.isArray(expr[1]) && (expr[1][0] === 'if' || expr[1][0] === 'unless')) {
        wrapperType = 'new';
        checkExpr = expr[1];
      } else if (expr[0] === 'if' || expr[0] === 'unless') {
        checkExpr = expr;
      }

      if (checkExpr[0] === 'if' || checkExpr[0] === 'unless') {
        const [condType, condition, body] = checkExpr;
        const isUnless = condType === 'unless';

        // Unwrap the body from the conditional
        let unwrappedBody = body;
        // Body might be wrapped in array
        if (Array.isArray(body) && body.length === 1) {
          unwrappedBody = body[0];
        }

        // Reconstruct the throw expression without the conditional
        if (wrapperType === 'new') {
          expr = ['new', unwrappedBody];
        } else {
          expr = unwrappedBody;
        }

        // Generate the throw wrapped in conditional
        const condCode = this.generate(condition, 'value');
        const throwCode = `throw ${this.generate(expr, 'value')}`;

        if (isUnless) {
          return `if (!(${condCode})) {\n${this.indent()}  ${throwCode};\n${this.indent()}}`;
        } else {
          return `if (${condCode}) {\n${this.indent()}  ${throwCode};\n${this.indent()}}`;
        }
      }
    }

    // Generate throw statement
    const throwStmt = `throw ${this.generate(expr, 'value')}`;

    // In value context, wrap in IIFE (throw is a statement, not an expression)
    if (context === 'value') {
      return `(() => { ${throwStmt}; })()`;
    }

    return throwStmt;
  }

  /**
   * Generate switch statement
   * Pattern: ["switch", discriminant, whens, defaultCase]
   */
  generateSwitch(head, rest, context, sexpr) {
    const [discriminant, whens, defaultCase] = rest;

    // No discriminant: use if/else if instead
    if (discriminant === null) {
      return this.generateSwitchAsIfChain(whens, defaultCase, context);
    }

    // Build switch body
    let switchBody = `switch (${this.generate(discriminant, 'value')}) {\n`;
    this.indentLevel++;

    // Helper: Normalize String objects to primitives
    const normalize = (v) => v instanceof String ? v.valueOf() : v;

    // Generate when clauses
    for (const whenClause of whens) {
      const [, test, body] = whenClause;

      // Handle multiple test values (when 1, 2, 3)
      // Need to distinguish:
      //   ["-", "1"] → single s-expression (unary minus)
      //   ["a", "b"] → multiple string/number values
      // Check if first element is an operator (s-expression) or a value (list)
      const firstTest = normalize(Array.isArray(test) && test.length > 0 ? test[0] : null);
      const isTestList = Array.isArray(test) && test.length > 0 &&
                        typeof firstTest === 'string' &&
                        !firstTest.match(/^[-+*\/%<>=!&|^~]$|^(typeof|delete|new|not|await|yield)$/);
      const tests = isTestList ? test : [test];

      for (const t of tests) {
        const tValue = normalize(t);
        let caseValue;

        if (Array.isArray(tValue)) {
          // S-expression (like unary minus: ["-", "1"])
          caseValue = this.generate(tValue, 'value');
        } else if (typeof tValue === 'string' && (tValue.startsWith('"') || tValue.startsWith("'"))) {
          // Quoted string from parser (like "\"a\"")
          caseValue = `'${tValue.slice(1, -1)}'`;  // Extract content, requote
        } else {
          // Numbers, identifiers, etc.
          caseValue = this.generate(tValue, 'value');
        }

        switchBody += this.indent() + `case ${caseValue}:\n`;
      }

      this.indentLevel++;
      switchBody += this.generateSwitchCaseBody(body, context);
      this.indentLevel--;
    }

    // Generate default case
    if (defaultCase) {
      switchBody += this.indent() + 'default:\n';
      this.indentLevel++;
      switchBody += this.generateSwitchCaseBody(defaultCase, context);
      this.indentLevel--;
    }

    this.indentLevel--;
    switchBody += this.indent() + '}';

    // In value context, wrap in IIFE
    if (context === 'value') {
      // Check if switch contains await - if so, make IIFE async
      const containsAwait = whens.some(w => this.containsAwait(w[2])) ||
                           (defaultCase && this.containsAwait(defaultCase));
      const asyncPrefix = containsAwait ? 'async ' : '';
      return `(${asyncPrefix}() => { ${switchBody} })()`;
    }

    return switchBody;
  }

  /**
   * Generate when clause (error - should be handled by switch)
   * Pattern: ["when", ...] - standalone when is an error
   */
  generateWhen(head, rest, context, sexpr) {
    throw new Error('when clause should be handled by switch');
  }

  /**
   * Generate array comprehension
   * Pattern: ["comprehension", expr, iterators, guards]
   */
  generateComprehension(head, rest, context, sexpr) {
    const [expr, iterators, guards] = rest;

    // OPTIMIZATION: If in statement context, generate plain loop (result unused)
    if (context === 'statement') {
      return this.generateComprehensionAsLoop(expr, iterators, guards);
    }

    // OPTIMIZATION: If targetVar is provided (from generateFunctionBody), generate direct array building
    if (this.comprehensionTarget) {
      const code = this.generateComprehensionWithTarget(expr, iterators, guards, this.comprehensionTarget);
      return code;
    }

    // Value context: Generate IIFE that builds and returns array
    // Check if expression contains await - if so, make IIFE async
    const hasAwait = this.containsAwait(expr);
    const asyncPrefix = hasAwait ? 'async ' : '';

    // Generate IIFE that builds array
    let code = `(${asyncPrefix}() => {\n`;
    this.indentLevel++;
    this.comprehensionDepth++; // Track that we're inside IIFE
    code += this.indent() + 'const result = [];\n';

    // Generate nested loops
    for (const iterator of iterators) {
      const [iterType, vars, iterable, stepOrOwn] = iterator;

      if (iterType === 'for-in') {
        const step = stepOrOwn;  // For for-in, 4th param is step
        const varsArray = Array.isArray(vars) ? vars : [vars];

        // Check if no loop variable (range repetition: for [1...N])
        const noVar = varsArray.length === 0;
        const [firstVar, indexVar] = noVar ? ['_i', null] : varsArray;

        // Check if first var is a destructuring pattern
        let itemVarPattern = firstVar;
        if (Array.isArray(firstVar) && (firstVar[0] === 'array' || firstVar[0] === 'object')) {
          // Generate destructuring pattern
          itemVarPattern = this.generateDestructuringPattern(firstVar);
        }

        // Handle step (any value: positive, negative, or null)
        if (step && step !== null) {
          // Check if iterable is a range for optimization
          let iterableHead = Array.isArray(iterable) && iterable[0];
          if (iterableHead instanceof String) {
            iterableHead = iterableHead.valueOf();
          }
          const isRange = iterableHead === '..' || iterableHead === '...';

          if (isRange) {
            // Optimize range with step: for i in [0...10] by 2 or by -1
            const isExclusive = iterableHead === '...';
            const [start, end] = iterable.slice(1);
            const startCode = this.generate(start, 'value');
            const endCode = this.generate(end, 'value');
            const stepCode = this.generate(step, 'value');
            const comparison = isExclusive ? '<' : '<=';
            code += this.indent() + `for (let ${itemVarPattern} = ${startCode}; ${itemVarPattern} ${comparison} ${endCode}; ${itemVarPattern} += ${stepCode}) {\n`;
            this.indentLevel++;
          } else {
            // Non-range with step: use index-based loop
            const iterableCode = this.generate(iterable, 'value');
            const indexVarName = indexVar || '_i';
            const stepCode = this.generate(step, 'value');

            // Detect if step is negative (reverse iteration)
            const isNegativeStep = this.isNegativeStep(step);
            if (isNegativeStep) {
              // Reverse: start from end
              code += this.indent() + `for (let ${indexVarName} = ${iterableCode}.length - 1; ${indexVarName} >= 0; ${indexVarName} += ${stepCode}) {\n`;
            } else {
              // Forward: start from beginning
              code += this.indent() + `for (let ${indexVarName} = 0; ${indexVarName} < ${iterableCode}.length; ${indexVarName} += ${stepCode}) {\n`;
            }
            this.indentLevel++;
            // Only extract item if we have an actual loop variable (not throwaway _i for noVar)
            if (!noVar) {
              code += this.indent() + `const ${itemVarPattern} = ${iterableCode}[${indexVarName}];\n`;
            }
          }
        } else if (indexVar) {
          // Use traditional for loop with index
          const iterableCode = this.generate(iterable, 'value');
          code += this.indent() + `for (let ${indexVar} = 0; ${indexVar} < ${iterableCode}.length; ${indexVar}++) {\n`;
          this.indentLevel++;
          code += this.indent() + `const ${itemVarPattern} = ${iterableCode}[${indexVar}];\n`;
        } else {
          // Use for-of
          code += this.indent() + `for (const ${itemVarPattern} of ${this.generate(iterable, 'value')}) {\n`;
          this.indentLevel++;
        }
      } else if (iterType === 'for-of') {
        const own = stepOrOwn;  // For for-of, 4th param is own flag
        const varsArray = Array.isArray(vars) ? vars : [vars];
        const [firstVar, secondVar] = varsArray;

        // Check if first var is a destructuring pattern
        let keyVarPattern = firstVar;
        if (Array.isArray(firstVar) && (firstVar[0] === 'array' || firstVar[0] === 'object')) {
          // Generate destructuring pattern for the key variable
          keyVarPattern = this.generateDestructuringPattern(firstVar);
        }

        const objCode = this.generate(iterable, 'value');
        code += this.indent() + `for (const ${keyVarPattern} in ${objCode}) {\n`;
        this.indentLevel++;

        // Add own check if needed
        if (own) {
          code += this.indent() + `if (!Object.hasOwn(${objCode}, ${keyVarPattern})) continue;\n`;
        }

        if (secondVar) {
          code += this.indent() + `const ${secondVar} = ${objCode}[${keyVarPattern}];\n`;
        }
      } else if (iterType === 'for-from') {
        // For-from iteration (may or may not be async)
        // iterator structure: ["for-from", vars, iterable, isAwait, guard]
        const isAwait = iterator[3];
        const varsArray = Array.isArray(vars) ? vars : [vars];
        const [firstVar] = varsArray;

        // Check if first var is a destructuring pattern
        let itemVarPattern = firstVar;
        if (Array.isArray(firstVar) && (firstVar[0] === 'array' || firstVar[0] === 'object')) {
          itemVarPattern = this.generateDestructuringPattern(firstVar);
        }

        const awaitKeyword = isAwait ? 'await ' : '';
        code += this.indent() + `for ${awaitKeyword}(const ${itemVarPattern} of ${this.generate(iterable, 'value')}) {\n`;
        this.indentLevel++;
      }
    }

    // Generate guard conditions
    for (const guard of guards) {
      code += this.indent() + `if (${this.generate(guard, 'value')}) {\n`;
      this.indentLevel++;
    }

    // Helper: Recursively check if node contains control flow
    const hasControlFlow = (node) => {
      // Check if node itself is a control flow keyword (string)
      if (typeof node === 'string' && (node === 'break' || node === 'continue')) {
        return true;
      }

      if (!Array.isArray(node)) return false;

      // Direct control flow (array form)
      if (node[0] === 'break' || node[0] === 'continue' ||
          node[0] === 'break-if' || node[0] === 'continue-if' ||
          node[0] === 'return' || node[0] === 'throw') return true;

      // Check if if/unless contains control flow in branches
      if (node[0] === 'if' || node[0] === 'unless') {
        return node.slice(1).some(child => hasControlFlow(child));
      }

      // Recursively check children
      return node.some(child => hasControlFlow(child));
    };

    // Handle expression - could be single expression or block with statements
    if (Array.isArray(expr) && expr[0] === 'block') {
      // Multi-statement block - execute all, push last (unless it has control flow)
      const statements = expr.slice(1);
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        const isLast = i === statements.length - 1;
        const stmtHasControlFlow = hasControlFlow(stmt);

        if (!isLast || stmtHasControlFlow) {
          // Not last, or has control flow - execute as statement (don't push)
          code += this.indent() + this.generate(stmt, 'statement') + ';\n';
        } else {
          // Last statement and no control flow - push its value
          // Check if statement is a loop (for-in, for-of, while, etc.) - execute, don't push
          const isLoopStmt = Array.isArray(stmt) && ['for-in', 'for-of', 'for-from', 'while', 'until', 'loop'].includes(stmt[0]);
          if (isLoopStmt) {
            code += this.indent() + this.generate(stmt, 'statement') + ';\n';
          } else {
            code += this.indent() + `result.push(${this.generate(stmt, 'value')});\n`;
          }
        }
      }
    } else {
      // Single expression - use the helper to check for control flow
      if (hasControlFlow(expr)) {
        // Has control flow - just execute as statement (don't push)
        code += this.indent() + this.generate(expr, 'statement') + ';\n';
      } else {
        // Check if expression is a loop - execute, don't push
        const isLoopStmt = Array.isArray(expr) && ['for-in', 'for-of', 'for-from', 'while', 'until', 'loop'].includes(expr[0]);
        if (isLoopStmt) {
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
        } else {
          // Normal expression - push it
          code += this.indent() + `result.push(${this.generate(expr, 'value')});\n`;
        }
      }
    }

    // Close guards
    for (let i = 0; i < guards.length; i++) {
      this.indentLevel--;
      code += this.indent() + '}\n';
    }

    // Close loops
    for (let i = 0; i < iterators.length; i++) {
      this.indentLevel--;
      code += this.indent() + '}\n';
    }

    code += this.indent() + 'return result;\n';
    this.indentLevel--;
    this.comprehensionDepth--; // Exit IIFE nesting
    code += this.indent() + '})()';

    return code;
  }

  /**
   * Generate object comprehension
   * Pattern: ["object-comprehension", keyExpr, valueExpr, iterators, guards]
   */
  generateObjectComprehension(head, rest, context, sexpr) {
    const [keyExpr, valueExpr, iterators, guards] = rest;

    // Generate IIFE that builds object
    let code = '(() => {\n';
    this.indentLevel++;
    code += this.indent() + 'const result = {};\n';

    // Generate nested loops (typically just one for object comprehensions)
    for (const iterator of iterators) {
      const [iterType, vars, iterable, own] = iterator;

      if (iterType === 'for-of') {
        const [keyVar, valueVar] = vars;
        const iterableCode = this.generate(iterable, 'value');
        code += this.indent() + `for (const ${keyVar} in ${iterableCode}) {\n`;
        this.indentLevel++;

        // Add own check if needed
        if (own) {
          code += this.indent() + `if (!Object.hasOwn(${iterableCode}, ${keyVar})) continue;\n`;
        }

        if (valueVar) {
          code += this.indent() + `const ${valueVar} = ${iterableCode}[${keyVar}];\n`;
        }
      }
    }

    // Generate guard conditions
    for (const guard of guards) {
      code += this.indent() + `if (${this.generate(guard, 'value')}) {\n`;
      this.indentLevel++;
    }

    // Add to result object
    const key = this.generate(keyExpr, 'value');
    const value = this.generate(valueExpr, 'value');
    code += this.indent() + `result[${key}] = ${value};\n`;

    // Close guards
    for (let i = 0; i < guards.length; i++) {
      this.indentLevel--;
      code += this.indent() + '}\n';
    }

    // Close loops
    for (let i = 0; i < iterators.length; i++) {
      this.indentLevel--;
      code += this.indent() + '}\n';
    }

    code += this.indent() + 'return result;\n';
    this.indentLevel--;
    code += this.indent() + '})()';

    return code;
  }

  /**
   * Generate class declaration
   * Pattern: ["class", name, parent, body]
   */
  generateClass(head, rest, context, sexpr) {
    const [className, parentClass, ...bodyParts] = rest;

    // Anonymous class if className is null
    let code = className ? `class ${className}` : 'class';
    if (parentClass) {
      code += ` extends ${this.generate(parentClass, 'value')}`;
    }
    code += ' {\n';

    // Unwrap body: ["block", ...]
    if (bodyParts.length > 0 && Array.isArray(bodyParts[0])) {
      const bodyBlock = bodyParts[0];
      if (bodyBlock[0] === 'block') {
        const bodyStatements = bodyBlock.slice(1); // Skip 'block' tag

        // Check if first statement is an object literal (standard class with methods)
        const hasObjectFirst = bodyStatements.length > 0 &&
                               Array.isArray(bodyStatements[0]) &&
                               bodyStatements[0][0] === 'object';

        if (hasObjectFirst && bodyStatements.length === 1) {
          // Simple case: ["block", ["object", ...]]
          const objectLiteral = bodyStatements[0];
          const members = objectLiteral.slice(1); // Skip 'object' tag

          this.indentLevel++;

        // First pass: identify bound methods (fat arrow =>)
        const boundMethods = [];
        for (const [memberKey, memberValue] of members) {
          const isStatic = this.isStaticMember(memberKey);
          const isComputed = this.isComputedMember(memberKey);
          const methodName = this.extractMemberName(memberKey);

          // Only track non-computed bound methods (need static name for .bind)
          if (this.isBoundMethod(memberValue) && !isStatic && !isComputed && methodName !== 'constructor') {
            boundMethods.push(methodName);
          }
        }

        // Second pass: generate members
        for (const [memberKey, memberValue] of members) {
          const isStatic = this.isStaticMember(memberKey);
          const isComputed = this.isComputedMember(memberKey);
          const methodName = this.extractMemberName(memberKey);

          // Check if memberValue is a function or a property value
          if (Array.isArray(memberValue) && (memberValue[0] === '->' || memberValue[0] === '=>')) {
            // It's a method
            const [arrowType, params, body] = memberValue;

            // Check if method contains await or yield
            const containsAwait = this.containsAwait(body);
            const containsYield = this.containsYield(body);

            // Handle @ parameters in constructor
            let cleanParams = params;
            let autoAssignments = [];

            if (methodName === 'constructor') {
              cleanParams = params.map(param => {
                if (Array.isArray(param) && param[0] === '.' && param[1] === 'this') {
                  // @ parameter: [".", "this", "name"]
                  const propName = param[2];
                  autoAssignments.push(`this.${propName} = ${propName}`);
                  return propName; // Clean param name
                }
                return param;
              });

              // Add .bind(this) calls for bound methods at start of constructor
              for (const boundMethod of boundMethods) {
                autoAssignments.unshift(`this.${boundMethod} = this.${boundMethod}.bind(this)`);
              }
            }

            const paramList = this.generateParamList(cleanParams);

            // Generate method with async/generator prefix
            const asyncPrefix = containsAwait ? 'async ' : '';
            const generatorSuffix = containsYield ? '*' : '';

            // Generate method
            if (isStatic) {
              code += this.indent() + `static ${asyncPrefix}${generatorSuffix}${methodName}(${paramList}) `;
            } else {
              code += this.indent() + `${asyncPrefix}${generatorSuffix}${methodName}(${paramList}) `;
            }

            // Generate body with @ assignments
            // Constructors never get implicit returns
            const isConstructorMethod = methodName === 'constructor';

            // Track current method name for super() calls (only for non-computed)
            if (!isComputed) {
              this.currentMethodName = methodName;
            }
            code += this.generateMethodBody(body, autoAssignments, isConstructorMethod, cleanParams);
            this.currentMethodName = null;

            code += '\n';
          } else if (isStatic) {
            // Static property (not a method)
            // @count: 0 → static count = 0;
            const propValue = this.generate(memberValue, 'value');
            code += this.indent() + `static ${methodName} = ${propValue};\n`;
          } else {
            // Instance property (ES2022 class field)
            // prop: value → prop = value;
            const propValue = this.generate(memberValue, 'value');
            code += this.indent() + `${methodName} = ${propValue};\n`;
          }
        }

        this.indentLevel--;
        } else if (hasObjectFirst) {
          // Mixed body: object with methods + other statements (like nested classes)
          // Process the object first, then additional statements
          const objectLiteral = bodyStatements[0];
          const members = objectLiteral.slice(1);
          const additionalStatements = bodyStatements.slice(1);

          this.indentLevel++;

          // Generate methods from the object
          for (const [memberKey, memberValue] of members) {
            const isStatic = this.isStaticMember(memberKey);
            const isComputed = this.isComputedMember(memberKey);
            const methodName = this.extractMemberName(memberKey);

            if (Array.isArray(memberValue) && (memberValue[0] === '->' || memberValue[0] === '=>')) {
              // Generate method (simplified - no bound method tracking for mixed bodies)
              const [arrowType, params, body] = memberValue;
              const containsAwait = this.containsAwait(body);
              const containsYield = this.containsYield(body);
              const paramList = this.generateParamList(params);
              const asyncPrefix = containsAwait ? 'async ' : '';
              const generatorSuffix = containsYield ? '*' : '';

              if (isStatic) {
                code += this.indent() + `static ${asyncPrefix}${generatorSuffix}${methodName}(${paramList}) `;
              } else {
                code += this.indent() + `${asyncPrefix}${generatorSuffix}${methodName}(${paramList}) `;
              }

              this.currentMethodName = methodName;
              code += this.generateMethodBody(body, [], methodName === 'constructor', params);
              this.currentMethodName = null;
              code += '\n';
            } else if (isStatic) {
              const propValue = this.generate(memberValue, 'value');
              code += this.indent() + `static ${methodName} = ${propValue};\n`;
            } else {
              const propValue = this.generate(memberValue, 'value');
              code += this.indent() + `${methodName} = ${propValue};\n`;
            }
          }

          // Generate additional statements (like nested classes)
          for (const stmt of additionalStatements) {
            if (Array.isArray(stmt) && stmt[0] === 'class') {
              // Nested class: class @Inner → static Inner = class { }
              const [, nestedName, parent, ...nestedBody] = stmt;
              if (Array.isArray(nestedName) && nestedName[0] === '.' && nestedName[1] === 'this') {
                // Static nested class
                const innerName = nestedName[2];
                code += this.indent() + `static ${innerName} = `;
                // Generate the class without the name (anonymous)
                const classCode = this.generate(['class', null, parent, ...nestedBody], 'value');
                code += classCode + ';\n';
              }
            } else {
              // Other statements
              code += this.indent() + this.generate(stmt, 'statement') + ';\n';
            }
          }

          this.indentLevel--;
        } else {
          // Executable class body - contains statements like @static = {...}
          // These become static initializers or assignments
          this.indentLevel++;
          for (const stmt of bodyStatements) {
            // Check if it's a static assignment: ["=", [".", "this", "propName"], value]
            if (Array.isArray(stmt) && stmt[0] === '=' &&
                Array.isArray(stmt[1]) && stmt[1][0] === '.' && stmt[1][1] === 'this') {
              // Static property assignment
              const propName = stmt[1][2];
              const value = this.generate(stmt[2], 'value');
              code += this.indent() + `static ${propName} = ${value};\n`;
            } else {
              // Other statement - generate as-is
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

  /**
   * Generate super call or access
   * Pattern: ["super", ...args]
   */
  generateSuper(head, rest, context, sexpr) {
    // No args: super (for property access like super.method())
    // With args: super(...args) (for constructor calls OR parent method calls)
    if (rest.length === 0) {
      // No arguments - could be super.method() or just super keyword
      // If we're in a method context, this is likely super() being called
      // CoffeeScript converts super() → super.methodName()
      if (this.currentMethodName && this.currentMethodName !== 'constructor') {
        return `super.${this.currentMethodName}()`;
      }
      return 'super';
    }

    // Super with arguments
    const argsCode = rest.map(arg => this.unwrap(this.generate(arg, 'value'))).join(', ');

    // If we're in a method (not constructor) and super is called with args,
    // it's calling the parent's method: super() → super.methodName()
    if (this.currentMethodName && this.currentMethodName !== 'constructor') {
      return `super.${this.currentMethodName}(${argsCode})`;
    }

    // In constructor or standalone: super(args)
    return `super(${argsCode})`;
  }

  /**
   * Generate soak call (CoffeeScript style)
   * Pattern: ["?call", fn, ...args]
   */
  generateSoakCall(head, rest, context, sexpr) {
    // Pattern: fn?(arg) → (typeof fn === 'function' ? fn(arg) : undefined)
    const [fn, ...args] = rest;
    const fnCode = this.generate(fn, 'value');
    const argsCode = args.map(arg => this.generate(arg, 'value')).join(', ');
    return `(typeof ${fnCode} === 'function' ? ${fnCode}(${argsCode}) : undefined)`;
  }

  /**
   * Generate import statement
   * Pattern: ["import", specifier, source] or ["import", url] (dynamic)
   */
  generateImport(head, rest, context, sexpr) {
    // Two forms:
    // 1. Dynamic import (expression): ["import", url] → import(url)
    // 2. Import statement: ["import", specifier, source] → import X from "Y"

    // Dynamic import - single argument (from DYNAMIC_IMPORT in grammar)
    if (rest.length === 1) {
      const [urlExpr] = rest;
      return `import(${this.generate(urlExpr, 'value')})`;
    }

    // Import statement: ["import", specifier, source]
    // Patterns:
    // - Default: ["import", "React", "\"react\""]
    // - Named: ["import", ["useState"], "\"react\""]
    // - Namespace: ["import", ["*", "Utils"], "\"react\""]
    const [specifier, source] = rest;

    // Add .js extension to local paths and JSON assertions if needed
    const fixedSource = this.addJsExtensionAndAssertions(source);

    // Default import
    if (typeof specifier === 'string') {
      return `import ${specifier} from ${fixedSource}`;
    }

    // Named or namespace import
    if (Array.isArray(specifier)) {
      // Namespace: ["*", "alias"]
      if (specifier[0] === '*' && specifier.length === 2) {
        return `import * as ${specifier[1]} from ${fixedSource}`;
      }

      // Mixed default + something: ["React", [...]]
      if (typeof specifier[0] === 'string' && Array.isArray(specifier[1])) {
        const defaultImport = specifier[0];
        const secondPart = specifier[1];

        // Check if second part is namespace: ["*", "alias"]
        if (secondPart[0] === '*' && secondPart.length === 2) {
          return `import ${defaultImport}, * as ${secondPart[1]} from ${fixedSource}`;
        }

        // Otherwise it's named imports (might have aliases)
        const names = (Array.isArray(secondPart) ? secondPart : [secondPart]).map(item => {
          if (Array.isArray(item) && item.length === 2) {
            return `${item[0]} as ${item[1]}`;
          }
          return item;
        }).join(', ');

        return `import ${defaultImport}, { ${names} } from ${fixedSource}`;
      }

      // Named imports: check if we have aliases
      // Simple: ["useState", "useEffect"]
      // With alias: [["useState", "useS"], ["useEffect", "useE"]]
      const names = specifier.map(item => {
        if (Array.isArray(item) && item.length === 2) {
          // Import with alias: ["useState", "useS"] → "useState as useS"
          return `${item[0]} as ${item[1]}`;
        }
        // Simple import
        return item;
      }).join(', ');

      return `import { ${names} } from ${fixedSource}`;
    }

    return `import ${this.generate(specifier, 'value')} from ${fixedSource}`;
  }

  /**
   * Generate export statement
   * Pattern: ["export", declaration]
   */
  generateExport(head, rest, context, sexpr) {
    // Patterns:
    // - Export declaration: ["export", ["=", "x", 42]]
    // - Named exports: ["export", ["x", "y"]]
    const [declaration] = rest;

    // If declaration is array of strings, it's named exports: { x, y }
    if (Array.isArray(declaration) && declaration.every(item => typeof item === 'string')) {
      const names = declaration.join(', ');
      return `export { ${names} }`;
    }

    // Check if it's an assignment (export x = 42)
    if (Array.isArray(declaration) && declaration[0] === '=') {
      const [, target, value] = declaration;
      return `export const ${target} = ${this.generate(value, 'value')}`;
    }

    // Otherwise it's an export declaration (class, function, etc.)
    return `export ${this.generate(declaration, 'statement')}`;
  }

  /**
   * Generate export default
   * Pattern: ["export-default", expression]
   */
  generateExportDefault(head, rest, context, sexpr) {
    const [expr] = rest;

    // Check if it's an assignment (export default x = {...})
    if (Array.isArray(expr) && expr[0] === '=') {
      const [, target, value] = expr;
      // Generate as: const x = ...; export default x;
      const assignCode = `const ${target} = ${this.generate(value, 'value')}`;
      return `${assignCode};\nexport default ${target}`;
    }

    return `export default ${this.generate(expr, 'statement')}`;
  }

  /**
   * Generate export all
   * Pattern: ["export-all", source]
   */
  generateExportAll(head, rest, context, sexpr) {
    const [source] = rest;
    const fixedSource = this.addJsExtensionAndAssertions(source);
    return `export * from ${fixedSource}`;
  }

  /**
   * Generate export from
   * Pattern: ["export-from", specifiers, source]
   */
  generateExportFrom(head, rest, context, sexpr) {
    // Pattern: export { add, multiply } from "./math"
    // With alias: [["add", "sum"]] → export { add as sum }
    const [specifiers, source] = rest;
    const fixedSource = this.addJsExtensionAndAssertions(source);

    if (Array.isArray(specifiers)) {
      const names = specifiers.map(item => {
        if (Array.isArray(item) && item.length === 2) {
          // Export with alias: ["add", "sum"] → "add as sum"
          return `${item[0]} as ${item[1]}`;
        }
        // Simple export
        return item;
      }).join(', ');

      return `export { ${names} } from ${fixedSource}`;
    }

    return `export ${specifiers} from ${fixedSource}`;
  }

  /**
   * Generate do-iife expression
   * Pattern: ["do-iife", arrowFn]
   */
  generateDoIIFE(head, rest, context, sexpr) {
    const [arrowFn] = rest;
    // Generate the arrow function (in statement context to avoid double-wrapping)
    // then wrap it ourselves for the IIFE
    const fnCode = this.generate(arrowFn, 'statement');
    return `(${fnCode})()`;
  }

  /**
   * Generate regex literal
   * Pattern: ["regex", pattern]
   */
  generateRegex(head, rest, context, sexpr) {
    // Regex literal: just pass through
    // Parser emits regex as string with slashes
    if (rest.length === 0) {
      // Simple regex from REGEX token
      return head; // Shouldn't happen, but fallback
    }
    const [pattern] = rest;
    return this.generate(pattern, 'value');
  }

  /**
   * Generate tagged template literal
   * Pattern: ["tagged-template", tag, string]
   */
  generateTaggedTemplate(head, rest, context, sexpr) {
    // Pattern: tag"hello #{name}" → tag`hello ${name}`
    const [tag, str] = rest;
    const tagCode = this.generate(tag, 'value');

    // The string might be a regular string or an interpolated str node
    let templateContent = this.generate(str, 'value');

    // If it's already a template literal from str interpolation, use as-is
    if (templateContent.startsWith('`')) {
      return `${tagCode}${templateContent}`;
    }

    // If it's a quoted string, convert quotes to backticks
    if (templateContent.startsWith('"') || templateContent.startsWith("'")) {
      const content = templateContent.slice(1, -1);
      return `${tagCode}\`${content}\``;
    }

    // Fallback: wrap in backticks
    return `${tagCode}\`${templateContent}\``;
  }

  /**
   * Generate string interpolation
   * Pattern: ["str", ...parts]
   */
  generateString(head, rest, context, sexpr) {
    // String interpolation: ["str", ...parts]
    // Parts are either String objects (with metadata), primitive strings, or expression arrays
    // This is the ONLY place we build template literals from parts
    let result = '`';

    for (let i = 0; i < rest.length; i++) {
      const part = rest[i];

      // String object - extract content using helper
      if (part instanceof String) {
        result += this.extractStringContent(part);
      }
      // Primitive string (shouldn't have quotes - already processed)
      else if (typeof part === 'string') {
        // Should be bare content without quotes
        // If it has quotes, warn and strip them
        if (part.startsWith('"') || part.startsWith("'")) {
          if (this.options.debug) {
            console.warn('[Rip] Unexpected quoted primitive in str interpolation:', part);
          }
          result += part.slice(1, -1);
        } else {
          result += part;
        }
      }
      // Expression to interpolate
      else if (Array.isArray(part)) {
        // Expression wrapped in ${}
        // Special case: single-element array with string = simple identifier
        // Don't generate() it or it becomes a function call!
        if (part.length === 1 && typeof part[0] === 'string' && !Array.isArray(part[0])) {
          const value = part[0];
          // Check if it's a literal (number or quoted string)
          const isLiteral = /^[\d"']/.test(value);
          if (isLiteral) {
            // Generate it properly (handles numbers, string literals, etc.)
            result += '${' + this.generate(value, 'value') + '}';
          } else {
            // Simple identifier - use as-is (don't call generate or it becomes a function call)
            result += '${' + value + '}';
          }
        } else {
          // Complex expression or function call
          // Unwrap if it's a single-element array containing another array (parser wraps expressions)
          let expr = part;
          if (part.length === 1 && Array.isArray(part[0])) {
            expr = part[0];
          }

          // Generate the expression
          result += '${' + this.generate(expr, 'value') + '}';
        }
      }
    }

    result += '`';
    return result;
  }

  //-------------------------------------------------------------------------
  // HELPER METHODS
  //-------------------------------------------------------------------------

  /**
   * Find postfix conditional (if/unless) in an expression tree
   * Used for extracting postfix conditionals from function call arguments
   * Pattern: f(val unless cond) → if (!cond) f(val)
   * Pattern: f(x + val unless cond) → if (!cond) f(x + val)
   */
  findPostfixConditional(expr) {
    if (!Array.isArray(expr)) return null;
    const head = expr[0];

    // Direct postfix unless/if (length 3, no else clause)
    if ((head === 'unless' || head === 'if') && expr.length === 3) {
      return {type: head, condition: expr[1], value: expr[2]};
    }

    // Recursively check binary operations
    if (head === '+' || head === '-' || head === '*' || head === '/') {
      for (let i = 1; i < expr.length; i++) {
        const found = this.findPostfixConditional(expr[i]);
        if (found) {
          // Return with info about which operand has the conditional
          found.parentOp = head;
          found.operandIndex = i;
          found.otherOperands = expr.slice(1).filter((_, idx) => idx !== i - 1);
          return found;
        }
      }
    }

    return null;
  }

  /**
   * Generate destructuring pattern for use in for loops, etc.
   */
  generateDestructuringPattern(pattern) {
    return this.formatParam(pattern);
  }

  /**
   * Generate parameter list, handling rest, default, expansion, and @ parameters
   */
  generateParamList(params) {
    // Check for expansion marker: (a, ..., b)
    const expansionIndex = params.findIndex(p => Array.isArray(p) && p[0] === 'expansion');

    if (expansionIndex !== -1) {
      // Has expansion marker
      const beforeExpansion = params.slice(0, expansionIndex);
      const afterExpansion = params.slice(expansionIndex + 1);

      // Generate: (a, ..._rest)
      const regularParams = beforeExpansion.map(p => this.formatParam(p)).join(', ');
      const paramList = regularParams ? `${regularParams}, ..._rest` : '..._rest';

      // Store after-expansion params for body injection
      this.expansionAfterParams = afterExpansion;

      return paramList;
    }

    // Check for rest parameter in middle position: (first, middle..., last)
    const restIndex = params.findIndex(p => Array.isArray(p) && p[0] === 'rest');
    if (restIndex !== -1 && restIndex < params.length - 1) {
      // Rest parameter is NOT last - need to use arguments slicing
      const beforeRest = params.slice(0, restIndex);
      const restParam = params[restIndex];
      const afterRest = params.slice(restIndex + 1);

      // Generate: (first, ...args) then destructure in body
      const beforeParams = beforeRest.map(p => this.formatParam(p));
      const paramList = beforeParams.length > 0
        ? `${beforeParams.join(', ')}, ...${restParam[1]}`
        : `...${restParam[1]}`;

      // Store rest and after params for body injection
      this.restMiddleParam = {
        restName: restParam[1],
        afterParams: afterRest,
        beforeCount: beforeRest.length
      };

      return paramList;
    }

    // No expansion - normal processing
    this.expansionAfterParams = null;
    this.restMiddleParam = null;
    return params.map(p => this.formatParam(p)).join(', ');
  }

  /**
   * Format a single parameter
   */
  formatParam(param) {
    // String parameter (simple)
    if (typeof param === 'string') {
      return param;
    }

    // Rest parameter: ["rest", "varName"]
    if (Array.isArray(param) && param[0] === 'rest') {
      return `...${param[1]}`;
    }

    // Default parameter: ["default", "varName", defaultValue]
    if (Array.isArray(param) && param[0] === 'default') {
      const [, varName, defaultValue] = param;
      return `${varName} = ${this.generate(defaultValue, 'value')}`;
    }

    // @ parameter in classes: [".", "this", "propName"]
    if (Array.isArray(param) && param[0] === '.' && param[1] === 'this') {
      return param[2]; // Just the property name
    }

    // Array destructuring: ["array", item1, item2, ...]
    if (Array.isArray(param) && param[0] === 'array') {
      const elements = param.slice(1).map(el => {
        if (el === ',') return '';  // Elision
        if (el === '...') return '';  // Bare expansion marker
        if (Array.isArray(el) && el[0] === '...') {
          return `...${el[1]}`;  // Rest
        }
        // Handle assignment as default value in destructuring (for-loop support)
        // Pattern: ["=", "varName", value] → varName = value
        if (Array.isArray(el) && el[0] === '=' && typeof el[1] === 'string') {
          const [, varName, defaultValue] = el;
          return `${varName} = ${this.generate(defaultValue, 'value')}`;
        }
        if (typeof el === 'string') return el;
        return this.formatParam(el);  // Nested destructuring
      });
      return `[${elements.join(', ')}]`;
    }

    // Object destructuring: ["object", [key, value], ...]
    if (Array.isArray(param) && param[0] === 'object') {
      const pairs = param.slice(1).map(pair => {
        if (Array.isArray(pair) && pair[0] === '...') {
          return `...${pair[1]}`;  // Rest
        }
        if (Array.isArray(pair) && pair[0] === 'default') {
          // Default pattern: ["default", key, defaultValue]
          const [, key, defaultValue] = pair;
          const defaultCode = this.generate(defaultValue, 'value');
          return `${key} = ${defaultCode}`;
        }
        const [key, value] = pair;
        // Shorthand if key equals value
        if (key === value) return key;
        return `${key}: ${value}`;
      });
      return `{${pairs.join(', ')}}`;
    }

    // Fallback
    return JSON.stringify(param);
  }

  /**
   * Generate function body with implicit returns
   * Handles both blocks and single expressions
   * @param {Array} body - The function body s-expression
   * @param {Array} params - The function parameters (to exclude from variable declarations)
   * @param {boolean} sideEffectOnly - If true, no implicit returns (side-effect only function)
   */
  /**
   * Unified body generation for functions and methods with implicit returns
   * Consolidates generateFunctionBody and generateMethodBody logic
   */
  generateBodyWithReturns(body, params = [], options = {}) {
    const {
      sideEffectOnly = false,      // Void functions (!) - no implicit returns
      autoAssignments = [],        // Method @ parameter assignments
      isConstructor = false,       // Constructor methods - no implicit returns
      hasExpansionParams = false   // Function has expansion params to inject
    } = options;

    // Store sideEffectOnly in instance for use in 'return' case
    const prevSideEffectOnly = this.sideEffectOnly;
    this.sideEffectOnly = sideEffectOnly;

    // Extract parameter names to exclude from variable declarations
    const paramNames = new Set();
    const extractParamNames = (param) => {
      if (typeof param === 'string') {
        paramNames.add(param);
      } else if (Array.isArray(param)) {
        if (param[0] === 'rest' || param[0] === '...') {
          if (typeof param[1] === 'string') paramNames.add(param[1]);
        } else if (param[0] === 'default') {
          if (typeof param[1] === 'string') paramNames.add(param[1]);
        } else if (param[0] === 'array' || param[0] === 'object') {
          // Destructuring - collect nested names
          this.collectVarsFromArray(param, paramNames);
        }
      }
    };

    if (Array.isArray(params)) {
      params.forEach(extractParamNames);
    }

    // Collect variables from body
    const bodyVars = this.collectFunctionVariables(body);

    // Remove variables that are:
    // 1. Already declared at program level (CoffeeScript semantics - access outer vars)
    // 2. Reactive variables (signals/computed) - these must not be shadowed
    // 3. Function/method parameters (already declared in signature)
    const newVars = new Set([...bodyVars].filter(v =>
      !this.programVars.has(v) && !this.reactiveVars?.has(v) && !paramNames.has(v)
    ));

    // Define statement type lists (used throughout)
    const noReturnStatements = ['return', 'throw', 'break', 'continue'];
    const loopStatements = ['for-in', 'for-of', 'for-from', 'while', 'until', 'loop'];

    // Check if it's a block
    if (Array.isArray(body) && body[0] === 'block') {
      // Block: ["block", ...statements]
      let statements = this.unwrapBlock(body);

      // FUNCTION-ONLY: Inject expansion parameter extraction if needed
      if (hasExpansionParams && this.expansionAfterParams && this.expansionAfterParams.length > 0) {
        const extractions = this.expansionAfterParams.map((param, idx) => {
          const paramName = typeof param === 'string' ? param : JSON.stringify(param);
          return `const ${paramName} = _rest[_rest.length - ${this.expansionAfterParams.length - idx}]`;
        });
        statements = [...extractions, ...statements];
        this.expansionAfterParams = null; // Clear after use
      }

      // Handle rest parameter in middle position: (first, middle..., last)
      if (this.restMiddleParam) {
        const {restName, afterParams} = this.restMiddleParam;
        // Use slice to extract rest and trailing params
        // Example: (first, middle..., b, c) with args [1,2,3,4,5]
        // middle should be [2,3], b=4, c=5
        const afterCount = afterParams.length;
        const extractions = [];

        // Extract trailing params from end of rest array FIRST
        afterParams.forEach((param, idx) => {
          const paramName = typeof param === 'string' ? param :
                           (Array.isArray(param) && param[0] === 'default') ? param[1] :
                           JSON.stringify(param);
          const position = afterCount - idx;
          extractions.push(`const ${paramName} = ${restName}[${restName}.length - ${position}]`);
        });

        // THEN slice the rest param to exclude trailing params
        if (afterCount > 0) {
          extractions.push(`${restName} = ${restName}.slice(0, -${afterCount})`);
        }

        statements = [...extractions, ...statements];
        this.restMiddleParam = null; // Clear after use
      }

      this.indentLevel++;
      let code = '{\n';

      // Emit let declarations for NEW variables only (not outer scope vars)
      if (newVars.size > 0) {
        const vars = Array.from(newVars).sort().join(', ');
        code += this.indent() + `let ${vars};\n`;
      }

      // METHOD-ONLY: Handle super() call ordering
      const firstIsSuper = autoAssignments.length > 0 &&
                          statements.length > 0 &&
                          Array.isArray(statements[0]) &&
                          statements[0][0] === 'super';

      if (firstIsSuper) {
        // Super must come first, then @ assignments, then rest of body
        const isSuperOnly = statements.length === 1;
        if (isSuperOnly && !isConstructor) {
          // Single super() in method (not constructor) needs return
          code += this.indent() + 'return ' + this.generate(statements[0], 'value') + ';\n';
        } else {
          code += this.indent() + this.generate(statements[0], 'statement') + ';\n';
        }

        // Then @ parameter auto-assignments
        for (const assignment of autoAssignments) {
          code += this.indent() + assignment + ';\n';
        }

        // Then remaining statements (skip first, which was super)
        statements.slice(1).forEach((stmt, index) => {
          const isLast = index === statements.length - 2; // -2 because we skipped first
          const head = Array.isArray(stmt) ? stmt[0] : null;

          // OPTIMIZATION: Non-last comprehension = plain loop (result unused)
          if (!isLast && head === 'comprehension') {
            const [, expr, iterators, guards] = stmt;
            code += this.indent() + this.generateComprehensionAsLoop(expr, iterators, guards) + '\n';
            return;
          }

          // OPTIMIZATION: If last statement is if/else with multi-statement blocks,
          // generate with early returns instead of IIFE wrapper
          if (!isConstructor && isLast && (head === 'if' || head === 'unless')) {
            const [condition, thenBranch, ...elseBranches] = stmt.slice(1);

            const hasMultipleStatements = (branch) => {
              return Array.isArray(branch) && branch[0] === 'block' && branch.length > 2;
            };

            if (hasMultipleStatements(thenBranch) || elseBranches.some(hasMultipleStatements)) {
              code += this.generateIfElseWithEarlyReturns(stmt);
              return;
            }
          }

          // Constructors and void functions never get implicit returns
          const needsReturn = !isConstructor && !sideEffectOnly && isLast &&
                             !noReturnStatements.includes(head) &&
                             !loopStatements.includes(head) &&
                             !this.hasExplicitControlFlow(stmt);

          const context = needsReturn ? 'value' : 'statement';
          const stmtCode = this.generate(stmt, context);

          if (needsReturn) {
            code += this.indent() + 'return ' + stmtCode + ';\n';
          } else {
            code += this.indent() + this.addSemicolon(stmt, stmtCode) + '\n';
          }
        });
      } else {
        // No super call - add @ assignments first (if any), then statements
        for (const assignment of autoAssignments) {
          code += this.indent() + assignment + ';\n';
        }

        // Generate body statements
        statements.forEach((stmt, index) => {
          const isLast = index === statements.length - 1;
          const head = Array.isArray(stmt) ? stmt[0] : null;

          // OPTIMIZATION: Non-last comprehension = plain loop (result unused)
          if (!isLast && head === 'comprehension') {
            const [, expr, iterators, guards] = stmt;
            code += this.indent() + this.generateComprehensionAsLoop(expr, iterators, guards) + '\n';
            return;
          }

          // OPTIMIZATION: If last statement is if/else with multi-statement blocks,
          // generate with early returns instead of IIFE wrapper
          if (!isConstructor && !sideEffectOnly && isLast && (head === 'if' || head === 'unless')) {
            const [condition, thenBranch, ...elseBranches] = stmt.slice(1);

            const hasMultipleStatements = (branch) => {
              return Array.isArray(branch) && branch[0] === 'block' && branch.length > 2;
            };

            if (hasMultipleStatements(thenBranch) || elseBranches.some(hasMultipleStatements)) {
              code += this.generateIfElseWithEarlyReturns(stmt);
              return;
            }
          }

          // OPTIMIZATION: Last statement assignment to comprehension
          // Transform: return (x = (() => { const result = []; ...; return result; })())
          // Into: x = []; ...; return x;
          // This eliminates IIFE overhead for the common pattern: fn = -> x = (for ...)
          if (!isConstructor && !sideEffectOnly && isLast && head === '=') {
            const [target, value] = stmt.slice(1);

            // Only optimize simple variable assignments (not destructuring)
            if (typeof target === 'string' && Array.isArray(value)) {
              const valueHead = value[0];

              // Handle comprehensions and for-in (which converts to comprehension in value context)
              // Note: for-of and for-from don't convert to comprehensions, so exclude them
              if (valueHead === 'comprehension' || valueHead === 'for-in') {
                // S-EXPRESSION APPROACH: Set target var and generate directly (no IIFE!)
                this.comprehensionTarget = target;
                code += this.generate(value, 'value');
                this.comprehensionTarget = null;
                // Add return statement
                code += this.indent() + `return ${target};\n`;
                return;
              }
            }
          }

          // Constructors and void functions never get implicit returns
          const needsReturn = !isConstructor && !sideEffectOnly && isLast &&
                             !noReturnStatements.includes(head) &&
                             !loopStatements.includes(head) &&
                             !this.hasExplicitControlFlow(stmt);

          const context = needsReturn ? 'value' : 'statement';
          const stmtCode = this.generate(stmt, context);

          if (needsReturn) {
            code += this.indent() + 'return ' + stmtCode + ';\n';
          } else {
            code += this.indent() + this.addSemicolon(stmt, stmtCode) + '\n';
          }
        });
      }

      // FUNCTION-ONLY: For void functions, add explicit return at the end
      if (sideEffectOnly && statements.length > 0) {
        const lastStmt = statements[statements.length - 1];
        const lastStmtType = Array.isArray(lastStmt) ? lastStmt[0] : null;

        // Don't add return if last statement is already return/throw/break/continue
        if (!noReturnStatements.includes(lastStmtType)) {
          code += this.indent() + 'return;\n';
        }
      }

      this.indentLevel--;
      code += this.indent() + '}';

      // Restore previous sideEffectOnly flag
      this.sideEffectOnly = prevSideEffectOnly;

      return code;
    }

    // Single expression - handle constructors and explicit control flow
    if (isConstructor || this.hasExplicitControlFlow(body)) {
      this.sideEffectOnly = prevSideEffectOnly;
      return `{ ${this.generate(body, 'statement')}; }`;
    }

    // Single expression - check if it's a statement that can't have return added
    if (Array.isArray(body) && (noReturnStatements.includes(body[0]) || loopStatements.includes(body[0]))) {
      this.sideEffectOnly = prevSideEffectOnly;
      return `{ ${this.generate(body, 'statement')}; }`;
    }

    // Single expression - add implicit return (unless side-effect only)
    this.sideEffectOnly = prevSideEffectOnly;
    if (sideEffectOnly) {
      // For void functions: execute the expression for side effects, then return
      const stmtCode = this.generate(body, 'statement');
      return `{ ${stmtCode}; return; }`;
    }
    return `{ return ${this.generate(body, 'value')}; }`;
  }

  generateFunctionBody(body, params = [], sideEffectOnly = false) {
    const hasExpansionParams = this.expansionAfterParams?.length > 0;
    return this.generateBodyWithReturns(body, params, {
      sideEffectOnly,
      hasExpansionParams
    });
  }

  /**
   * Generate block with implicit returns on last statement
   */
  generateBlockWithReturns(block) {
    if (!Array.isArray(block) || block[0] !== 'block') {
      return this.generate(block, 'statement');
    }

    const statements = this.unwrapBlock(block);
    const stmts = this.withIndent(() => {
      return statements.map((stmt, index) => {
        const isLast = index === statements.length - 1;
        const head = Array.isArray(stmt) ? stmt[0] : null;

        // Statements that can't have return added
        const noReturnStatements = ['return', 'throw', 'break', 'continue'];
        const needsReturn = isLast && !noReturnStatements.includes(head);

        const context = needsReturn ? 'value' : 'statement';
        const code = this.generate(stmt, context);

        if (needsReturn) {
          return this.indent() + 'return ' + code + ';';
        }

        return this.indent() + code + ';';
      });
    });

    return `{\n${stmts.join('\n')}\n${this.indent()}}`;
  }

  /**
   * Extract expression from a branch (for context-aware if/unless)
   * Handles blocks and single expressions
   */
  extractExpression(branch) {
    const statements = this.unwrapBlock(branch);
    if (statements.length > 0) {
      return this.generate(statements[statements.length - 1], 'value');
    }
    return 'undefined';
  }

  /**
   * Generate class method body with @ parameter assignments
   */
  generateMethodBody(body, autoAssignments = [], isConstructor = false, params = []) {
    return this.generateBodyWithReturns(body, params, {
      autoAssignments,
      isConstructor
    });
  }

  /**
   * Generate loop body (unwraps blocks, no implicit returns)
   */
  generateLoopBody(body) {
    if (!Array.isArray(body)) {
      // OPTIMIZATION: Single comprehension in loop body = plain loop (no IIFE)
      if (Array.isArray(body) && body[0] === 'comprehension') {
        const [, expr, iterators, guards] = body;
        return `{ ${this.generateComprehensionAsLoop(expr, iterators, guards)} }`;
      }
      return `{ ${this.generate(body, 'statement')}; }`;
    }

    if (body[0] === 'block' || Array.isArray(body[0])) {
      // Unwrap block or array of statements
      const statements = body[0] === 'block' ? body.slice(1) : body;
      const stmts = this.withIndent(() => {
        return statements.map(stmt => {
          // OPTIMIZATION: Comprehension in loop body = plain loop
          if (Array.isArray(stmt) && stmt[0] === 'comprehension') {
            const [, expr, iterators, guards] = stmt;
            return this.indent() + this.generateComprehensionAsLoop(expr, iterators, guards);
          }
          return this.indent() + this.addSemicolon(stmt, this.generate(stmt, 'statement'));
        });
      });
      return `{\n${stmts.join('\n')}\n${this.indent()}}`;
    }

    return `{ ${this.generate(body, 'statement')}; }`;
  }

  generateLoopBodyWithGuard(body, guard) {
    // Wrap body in if (guard) { body }
    // IMPORTANT: Everything in loop bodies is in statement context (loops don't have implicit returns)
    const guardCondition = this.unwrap(this.generate(guard, 'value'));

    if (!Array.isArray(body)) {
      return `{ if (${guardCondition}) ${this.generate(body, 'statement')}; }`;
    }

    if (body[0] === 'block' || Array.isArray(body[0])) {
      // Unwrap block or array of statements
      const statements = body[0] === 'block' ? body.slice(1) : body;

      const loopBodyIndent = this.withIndent(() => this.indent());
      const guardCode = `if (${guardCondition}) {\n`;
      const stmts = this.withIndent(() => {
        this.indentLevel++;  // Nested indent for statements inside guard
        const result = this.formatStatements(statements);
        this.indentLevel--;
        return result;
      });
      const closeBrace = this.withIndent(() => this.indent() + '}');

      return `{\n${loopBodyIndent}${guardCode}${stmts.join('\n')}\n${closeBrace}\n${this.indent()}}`;
    }

    return `{ if (${this.generate(guard, 'value')}) ${this.generate(body, 'statement')}; }`;
  }

  /**
   * Add .js extension to local module paths and JSON import assertions
   * - Local paths (./ or ../) without extension get .js added
   * - .json files get 'with { type: "json" }' assertion added
   * - Existing extensions preserved
   * - NPM packages unchanged
   * - Always uses single quotes for cleaner output
   */
  addJsExtensionAndAssertions(source) {
    // Convert String objects to primitives (parser emits String objects)
    if (source instanceof String) {
      source = source.valueOf();
    }

    if (typeof source !== 'string') {
      return source;
    }

    // Remove quotes to check path (parser gives double quotes, we'll output single)
    const hasQuotes = source.startsWith('"') || source.startsWith("'");
    const path = hasQuotes ? source.slice(1, -1) : source;

    // Check if it's a local path (./ or ../)
    const isLocal = path.startsWith('./') || path.startsWith('../');

    let finalPath = path;
    let assertion = '';

    if (isLocal) {
      // Local path - check extension handling
      const lastSlash = path.lastIndexOf('/');
      const fileName = lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
      const hasExtension = fileName.includes('.');

      if (hasExtension) {
        // Check if it's a .json file - add import assertion
        if (fileName.endsWith('.json')) {
          assertion = " with { type: 'json' }";
        }
      } else {
        // No extension - add .js
        finalPath = path + '.js';
      }
    }

    // Always use single quotes for module paths (cleaner than double quotes)
    const result = `'${finalPath}'`;
    return result + assertion;
  }

  /**
   * Helper to determine if a function call should be awaited
   *
   * Handles .await property on identifiers (set by lexer):
   * - .await = true: Force await (dammit operator !)
   * - .await = false: Prevent await (punt operator &) - future feature
   * - .await = undefined: Use default mode (currently no await, future: implicit await mode)
   *
   * @param {*} identifier - The identifier (may be String object with .await property)
   * @returns {boolean} - Whether to prepend await
   */
  shouldAwaitCall(identifier) {
    // Check for .await property (set by lexer based on ! or & sigils)
    if (identifier instanceof String && identifier.await !== undefined) {
      return identifier.await === true;
    }

    // TODO: When implicit await mode is enabled, return true by default here
    // if (this.implicitAwaitMode === true) {
    //   return true;  // In implicit mode, await by default unless .await = false
    // }

    return false;  // Default: no implicit await (explicit await required)
  }

  /**
   * Check if sexpr contains await expressions (for async function detection)
   */
  containsAwait(sexpr) {
    if (!sexpr) return false;

    // String object with .await = true means dammit operator (!)
    // This will generate await, so function needs to be async
    if (sexpr instanceof String && sexpr.await === true) {
      return true;
    }

    // String or primitive - no await
    if (typeof sexpr !== 'object') return false;

    // Check if this is an await node
    if (Array.isArray(sexpr) && sexpr[0] === 'await') {
      return true;
    }

    // Check if this is a for-from with isAwait flag
    // ["for-from", vars, iterable, isAwait, guard, body]
    if (Array.isArray(sexpr) && sexpr[0] === 'for-from' && sexpr[3] === true) {
      return true;  // isAwait flag is true
    }

    // Stop at function boundaries - don't recurse into nested functions
    // Nested functions have their own async/generator detection
    if (Array.isArray(sexpr) && (sexpr[0] === 'def' || sexpr[0] === '->' || sexpr[0] === '=>' || sexpr[0] === 'class')) {
      return false;
    }

    // Recursively check array elements
    if (Array.isArray(sexpr)) {
      return sexpr.some(item => this.containsAwait(item));
    }

    return false;
  }

  /**
   * Check if sexpr contains yield expressions (for generator function detection)
   */
  containsYield(sexpr) {
    if (!sexpr) return false;

    // String or primitive - no yield
    if (typeof sexpr !== 'object') return false;

    // Check if this is a yield or yield-from node
    if (Array.isArray(sexpr) && (sexpr[0] === 'yield' || sexpr[0] === 'yield-from')) {
      return true;
    }

    // Stop at function boundaries - don't recurse into nested functions
    // Nested functions have their own async/generator detection
    if (Array.isArray(sexpr) && (sexpr[0] === 'def' || sexpr[0] === '->' || sexpr[0] === '=>' || sexpr[0] === 'class')) {
      return false;
    }

    // Recursively check array elements
    if (Array.isArray(sexpr)) {
      return sexpr.some(item => this.containsYield(item));
    }

    return false;
  }

  /**
   * Extract string content from a String object
   * Handles quote stripping, indentation, and chunk trimming
   *
   * @param {String} strObj - String object from parser (STRING tokens always have quotes)
   * @returns {string} Extracted content (without quotes, processed)
   */
  extractStringContent(strObj) {
    // Strip outer quotes (lexer always includes them for STRING tokens)
    let content = strObj.valueOf().slice(1, -1);

    // Handle heredoc indentation stripping (only set for heredocs)
    if (strObj.indent) {
      const indentRegex = new RegExp(`\\n${strObj.indent}`, 'g');
      content = content.replace(indentRegex, '\n');
    }

    // Handle heredoc chunk trimming (only set for interpolated heredocs)
    if (strObj.initialChunk && content.startsWith('\n')) {
      content = content.slice(1);
    }
    if (strObj.finalChunk && content.endsWith('\n')) {
      content = content.slice(0, -1);
    }

    return content;
  }

  /**
   * Process heregex content
   * Strips whitespace and comments from extended regex literals
   * Matches CoffeeScript's HEREGEX_OMIT pattern behavior
   *
   * @param {string} content - Heregex content
   * @returns {string} Processed regex pattern
   */
  processHeregex(content) {
    // CoffeeScript's HEREGEX_OMIT pattern removes:
    // 1. Whitespace (spaces, tabs, newlines) outside character classes
    // 2. Comments starting with # (but not inside character classes or escaped)

    let result = '';
    let inCharClass = false;
    let i = 0;

    while (i < content.length) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : null;
      const nextChar = content[i + 1];

      // Check if current position is escaped (preceded by odd number of backslashes)
      const isEscaped = () => {
        let backslashCount = 0;
        let j = i - 1;
        while (j >= 0 && content[j] === '\\') {
          backslashCount++;
          j--;
        }
        return backslashCount % 2 === 1;
      };

      // Track if we're inside a character class [...]
      if (char === '[' && !isEscaped()) {
        inCharClass = true;
        result += char;
        i++;
        continue;
      }

      if (char === ']' && inCharClass && !isEscaped()) {
        inCharClass = false;
        result += char;
        i++;
        continue;
      }

      // Inside character class: preserve everything
      if (inCharClass) {
        result += char;
        i++;
        continue;
      }

      // Outside character class: strip whitespace and comments
      if (/\s/.test(char)) {
        // Skip whitespace
        i++;
        continue;
      }

      if (char === '#') {
        // Check if preceded by backslash(es) - in regex, \# is NOT a comment
        // Even \\# (two backslashes + hash) in the source means literal \ and literal #
        if (isEscaped()) {
          // Escaped hash - preserve it (not a comment in regex terms)
          result += char;
          i++;
          continue;
        }
        // Check if preceded by even number of backslashes - still not a comment if any backslashes
        // Because in regex, any \# sequence is literal
        let j = i - 1;
        while (j >= 0 && content[j] === '\\') {
          j--;
        }
        const hasBackslash = j < i - 1;
        if (hasBackslash) {
          // Any backslashes before # means it's part of regex escape, not a comment
          result += char;
          i++;
          continue;
        }
        // No backslashes before # - it's a comment, skip until end of line
        while (i < content.length && content[i] !== '\n') {
          i++;
        }
        continue;
      }

      // Preserve everything else (including escaped chars)
      result += char;
      i++;
    }

    return result;
  }

  /**
   * Collect variables from array destructuring pattern
   * Shared by collectProgramVariables and collectFunctionVariables
   *
   * @param {Array} arr - Array destructuring pattern: ["array", item1, item2, ...]
   * @param {Set} varSet - Set to add variables to
   */
  collectVarsFromArray(arr, varSet) {
    arr.slice(1).forEach(item => {
      if (item === ',') return; // Skip elision markers
      if (item === '...') return; // Skip bare spread marker
      if (typeof item === 'string') {
        varSet.add(item);
      } else if (Array.isArray(item)) {
        if (item[0] === '...') {
          // Rest pattern: ["...", "varName"]
          if (typeof item[1] === 'string') {
            varSet.add(item[1]);
          }
        } else if (item[0] === 'array') {
          // Nested array destructuring
          this.collectVarsFromArray(item, varSet);
        } else if (item[0] === 'object') {
          // Nested object destructuring
          this.collectVarsFromObject(item, varSet);
        }
      }
    });
  }

  /**
   * Collect variables from object destructuring pattern
   * Shared by collectProgramVariables and collectFunctionVariables
   *
   * @param {Array} obj - Object destructuring pattern: ["object", [key, value, operator], ...]
   * @param {Set} varSet - Set to add variables to
   */
  collectVarsFromObject(obj, varSet) {
    obj.slice(1).forEach(pair => {
      if (Array.isArray(pair)) {
        if (pair[0] === '...') {
          // Rest pattern
          if (typeof pair[1] === 'string') {
            varSet.add(pair[1]);
          }
        } else if (pair.length >= 2) {
          // Format: [key, value, operator] where operator can be ':', '=', or null
          const [key, value, operator] = pair;

          if (operator === '=') {
            // Default: {b = 5} - collect 'b' from key
            if (typeof key === 'string') {
              varSet.add(key);
            }
          } else {
            // Property or shorthand - collect from value
            if (typeof value === 'string') {
              varSet.add(value);
            } else if (Array.isArray(value)) {
              if (value[0] === 'array') this.collectVarsFromArray(value, varSet);
              else if (value[0] === 'object') this.collectVarsFromObject(value, varSet);
            }
          }
        }
      }
    });
  }

  indent() {
    return this.indentString.repeat(this.indentLevel);
  }

  /**
   * Helper: Unwrap block to get statements array
   * Handles both block nodes and single statements
   */
  unwrapBlock(body) {
    if (!Array.isArray(body)) return [body];
    if (body[0] === 'block') return body.slice(1);
    if (Array.isArray(body[0])) return body;  // Array of statements
    return [body];  // Single statement
  }

  /**
   * Helper: Check if a statement needs a semicolon
   * Block statements ending with } don't need semicolons
   */
  needsSemicolon(stmt, generated) {
    if (!generated || generated.endsWith(';')) return false;
    if (!generated.endsWith('}')) return true;

    // Block statements ending with } don't need semicolons
    const head = Array.isArray(stmt) ? stmt[0] : null;
    const blockStatements = ['def', 'class', 'if', 'unless', 'for-in', 'for-of', 'for-from', 'while', 'until', 'loop', 'switch', 'try'];
    return !blockStatements.includes(head);
  }

  /**
   * Helper: Add semicolon to statement if needed
   */
  addSemicolon(stmt, generated) {
    return generated + (this.needsSemicolon(stmt, generated) ? ';' : '');
  }

  /**
   * Helper: Format array of statements with indentation
   */
  formatStatements(statements, context = 'statement') {
    return statements.map(s =>
      this.indent() + this.addSemicolon(s, this.generate(s, context))
    );
  }

  /**
   * Helper: Check if body has explicit control flow (return/throw/break/continue)
   * In switch context: detects any explicit control flow to avoid adding break
   * In function context: detects return/throw to avoid implicit return
   */
  hasExplicitControlFlow(body) {
    if (!Array.isArray(body)) return false;

    const type = body[0];
    if (type === 'return' || type === 'throw' || type === 'break' || type === 'continue') {
      return true;
    }

    // Check if it's a block with statements
    if (type === 'block') {
      const statements = body.slice(1);
      if (statements.length === 0) return false;
      // Check if ANY statement is explicit control flow
      return statements.some(stmt =>
        Array.isArray(stmt) && (stmt[0] === 'return' || stmt[0] === 'throw' ||
                               stmt[0] === 'break' || stmt[0] === 'continue')
      );
    }

    if (type === 'switch') {
      const [, , whens] = body;
      return whens && whens.some(w => {
        const caseBody = w[2];
        const statements = this.unwrapBlock(caseBody);
        return statements.some(stmt =>
          Array.isArray(stmt) && (stmt[0] === 'return' || stmt[0] === 'throw' ||
                                 stmt[0] === 'break' || stmt[0] === 'continue')
        );
      });
    }

    if (type === 'if' || type === 'unless') {
      const [, , thenBranch, elseBranch] = body;
      const thenHas = this.branchHasControlFlow(thenBranch);
      const elseHas = elseBranch && this.branchHasControlFlow(elseBranch);
      return thenHas && elseHas;
    }

    return false;
  }

  /**
   * Helper: Check if a branch has control flow
   */
  branchHasControlFlow(branch) {
    if (!Array.isArray(branch)) return false;
    const statements = this.unwrapBlock(branch);
    if (statements.length === 0) return false;
    const stmt = statements[statements.length - 1];  // Check last statement
    return Array.isArray(stmt) && (stmt[0] === 'return' || stmt[0] === 'throw' ||
                                   stmt[0] === 'break' || stmt[0] === 'continue');
  }

  /**
   * Helper: Execute callback with incremented indent level
   */
  withIndent(callback) {
    this.indentLevel++;
    const result = callback();
    this.indentLevel--;
    return result;
  }

  /**
   * Check if step is negative (for reverse iteration)
   * Handles any negative step: -1, -2, -3, etc.
   */
  isNegativeStep(step) {
    if (!Array.isArray(step)) return false;
    if (step.length !== 2) return false;

    // Check if it's a unary minus operation
    const head = step[0] instanceof String ? step[0].valueOf() : step[0];
    return head === '-';
  }

  /**
   * Helper: Generate branch with early return (for if/else with multi-statement blocks)
   */
  generateBranchWithReturn(branch) {
    const statements = this.unwrapBlock(branch);
    let code = '';
    for (let i = 0; i < statements.length; i++) {
      const isLast = i === statements.length - 1;
      const stmt = statements[i];
      const head = Array.isArray(stmt) ? stmt[0] : null;
      const hasControlFlow = head === 'return' || head === 'throw' || head === 'break' || head === 'continue';

      if (isLast && !hasControlFlow) {
        code += this.indent() + `return ${this.generate(stmt, 'value')};\n`;
      } else {
        code += this.indent() + this.generate(stmt, 'statement') + ';\n';
      }
    }
    return code;
  }

  /**
   * Generate comprehension with direct target variable (no IIFE)
   * Used when comprehension is assigned to a variable in a function
   */
  generateComprehensionWithTarget(expr, iterators, guards, targetVar) {
    let code = '';

    // Initialize the array
    code += this.indent() + `${targetVar} = [];\n`;

    // Unwrap block if expr is wrapped
    let unwrappedExpr = expr;
    if (Array.isArray(expr) && expr[0] === 'block' && expr.length === 2) {
      unwrappedExpr = expr[1]; // Extract single statement from block
    }

    // Generate loops that push to targetVar
    // For now, handle simple single iterator case
    if (iterators.length === 1) {
      const iterator = iterators[0];
      const [iterType, vars, iterable, stepOrOwn] = iterator;

      if (iterType === 'for-in') {
        const step = stepOrOwn;
        const varsArray = Array.isArray(vars) ? vars : [vars];
        const noVar = varsArray.length === 0;
        const [itemVar, indexVar] = noVar ? ['_i', null] : varsArray;

        let itemVarPattern = itemVar;
        if (Array.isArray(itemVar) && (itemVar[0] === 'array' || itemVar[0] === 'object')) {
          itemVarPattern = this.generateDestructuringPattern(itemVar);
        }

        // Generate appropriate loop
        if (step && step !== null) {
          // Handle step cases (same as generateComprehensionAsLoop)
          let iterableHead = Array.isArray(iterable) && iterable[0];
          if (iterableHead instanceof String) iterableHead = iterableHead.valueOf();
          const isRange = iterableHead === '..' || iterableHead === '...';

          if (isRange) {
            const isExclusive = iterableHead === '...';
            const [start, end] = iterable.slice(1);
            const startCode = this.generate(start, 'value');
            const endCode = this.generate(end, 'value');
            const stepCode = this.generate(step, 'value');
            const comparison = isExclusive ? '<' : '<=';
            code += this.indent() + `for (let ${itemVarPattern} = ${startCode}; ${itemVarPattern} ${comparison} ${endCode}; ${itemVarPattern} += ${stepCode}) {\n`;
          } else {
            const iterableCode = this.generate(iterable, 'value');
            const indexVarName = indexVar || '_i';
            const stepCode = this.generate(step, 'value');
            const isNegativeStep = this.isNegativeStep(step);

            if (isNegativeStep) {
              code += this.indent() + `for (let ${indexVarName} = ${iterableCode}.length - 1; ${indexVarName} >= 0; ${indexVarName} += ${stepCode}) {\n`;
            } else {
              code += this.indent() + `for (let ${indexVarName} = 0; ${indexVarName} < ${iterableCode}.length; ${indexVarName} += ${stepCode}) {\n`;
            }
            this.indentLevel++;
            if (!noVar) {
              code += this.indent() + `const ${itemVarPattern} = ${iterableCode}[${indexVarName}];\n`;
            }
          }
        } else {
          // Simple for-of loop
          const iterableCode = this.generate(iterable, 'value');
          code += this.indent() + `for (const ${itemVarPattern} of ${iterableCode}) {\n`;
        }

        this.indentLevel++;

        // Handle guards
        if (guards && guards.length > 0) {
          code += this.indent() + `if (${guards.map(g => this.generate(g, 'value')).join(' && ')}) {\n`;
          this.indentLevel++;
        }

        // Push expression to array (using unwrapped expression)
        const exprCode = this.unwrap(this.generate(unwrappedExpr, 'value'));
        code += this.indent() + `${targetVar}.push(${exprCode});\n`;

        if (guards && guards.length > 0) {
          this.indentLevel--;
          code += this.indent() + '}\n';
        }

        this.indentLevel--;
        code += this.indent() + '}\n';

        return code;
      }
    }

    // Fallback: generate IIFE and assign (shouldn't happen in practice)
    const hasAwait = this.containsAwait(expr);
    const asyncPrefix = hasAwait ? 'async ' : '';
    return this.indent() + `${targetVar} = (${asyncPrefix}() => { /* complex comprehension */ })();\n`;
  }

  /**
   * Generate comprehension as plain loop (for statement context - result unused)
   * Used when comprehension is in statement context (side effects only)
   */
  generateComprehensionAsLoop(expr, iterators, guards) {
    let code = '';

    // For now, handle simple single iterator case
    // TODO: Handle nested iterators
    if (iterators.length === 1) {
      const iterator = iterators[0];
      const [iterType, vars, iterable, stepOrOwn] = iterator;

      if (iterType === 'for-in') {
        const step = stepOrOwn;  // For for-in, 4th param is step
        const varsArray = Array.isArray(vars) ? vars : [vars];

        // Check if no loop variable (range repetition: for [1...N])
        const noVar = varsArray.length === 0;
        const [itemVar, indexVar] = noVar ? ['_i', null] : varsArray;

        // Check if itemVar is destructuring
        let itemVarPattern = itemVar;
        if (Array.isArray(itemVar) && (itemVar[0] === 'array' || itemVar[0] === 'object')) {
          itemVarPattern = this.generateDestructuringPattern(itemVar);
        }

        // Handle step (any value: positive, negative, or null)
        if (step && step !== null) {
          // Check if iterable is a range for optimization
          let iterableHead = Array.isArray(iterable) && iterable[0];
          if (iterableHead instanceof String) {
            iterableHead = iterableHead.valueOf();
          }
          const isRange = iterableHead === '..' || iterableHead === '...';

          if (isRange) {
            // Optimize range with step
            const isExclusive = iterableHead === '...';
            const [start, end] = iterable.slice(1);
            const startCode = this.generate(start, 'value');
            const endCode = this.generate(end, 'value');
            const stepCode = this.generate(step, 'value');
            const comparison = isExclusive ? '<' : '<=';
            code += `for (let ${itemVarPattern} = ${startCode}; ${itemVarPattern} ${comparison} ${endCode}; ${itemVarPattern} += ${stepCode}) `;
          } else {
            // Non-range with step: use index-based loop
            const iterableCode = this.generate(iterable, 'value');
            const indexVarName = indexVar || '_i';
            const stepCode = this.generate(step, 'value');

            // Detect if step is negative (reverse iteration)
            const isNegativeStep = this.isNegativeStep(step);

            // Special case: -1 and 1 generate cleaner ++ and -- operators
            const isMinusOne = isNegativeStep && (step[1] === '1' || step[1] === 1 || (step[1] instanceof String && step[1].valueOf() === '1'));
            const isPlusOne = !isNegativeStep && (step === '1' || step === 1 || (step instanceof String && step.valueOf() === '1'));

            if (isMinusOne) {
              code += `for (let ${indexVarName} = ${iterableCode}.length - 1; ${indexVarName} >= 0; ${indexVarName}--) `;
            } else if (isPlusOne) {
              code += `for (let ${indexVarName} = 0; ${indexVarName} < ${iterableCode}.length; ${indexVarName}++) `;
            } else if (isNegativeStep) {
              code += `for (let ${indexVarName} = ${iterableCode}.length - 1; ${indexVarName} >= 0; ${indexVarName} += ${stepCode}) `;
            } else {
              code += `for (let ${indexVarName} = 0; ${indexVarName} < ${iterableCode}.length; ${indexVarName} += ${stepCode}) `;
            }
            code += '{\n';
            this.indentLevel++;
            // Only extract item if we have an actual loop variable (not throwaway _i for noVar)
            if (!noVar) {
              code += this.indent() + `const ${itemVarPattern} = ${iterableCode}[${indexVarName}];\n`;
            }
          }

          // Handle guards and body
          if (guards && guards.length > 0) {
            if (!isRange) code += this.indent();
            code += '{\n';
            this.indentLevel++;
            code += this.indent() + `if (${guards.map(g => this.generate(g, 'value')).join(' && ')}) {\n`;
            this.indentLevel++;
            code += this.indent() + this.generate(expr, 'statement') + ';\n';
            this.indentLevel--;
            code += this.indent() + '}\n';
            this.indentLevel--;
            code += this.indent() + '}';
          } else {
            if (!isRange) code += this.indent();
            code += '{\n';
            this.indentLevel++;
            code += this.indent() + this.generate(expr, 'statement') + ';\n';
            this.indentLevel--;
            code += this.indent() + '}';
          }

          if (!isRange) {
            this.indentLevel--;
            code += '\n' + this.indent() + '}';
          }
          return code;
        } else if (indexVar) {
          // Use traditional for loop with index
          const iterableCode = this.generate(iterable, 'value');
          code += `for (let ${indexVar} = 0; ${indexVar} < ${iterableCode}.length; ${indexVar}++) `;
          code += '{\n';
          this.indentLevel++;
          code += this.indent() + `const ${itemVarPattern} = ${iterableCode}[${indexVarName}];\n`;
        } else {
          // No step: use for-of loop
          code += `for (const ${itemVarPattern} of ${this.generate(iterable, 'value')}) `;

          // Handle guards
          if (guards && guards.length > 0) {
            code += '{\n';
            this.indentLevel++;
            code += this.indent() + `if (${guards.map(g => this.generate(g, 'value')).join(' && ')}) {\n`;
            this.indentLevel++;
            code += this.indent() + this.generate(expr, 'statement') + ';\n';
            this.indentLevel--;
            code += this.indent() + '}\n';
            this.indentLevel--;
            code += this.indent() + '}';
          } else {
            code += '{\n';
            this.indentLevel++;
            code += this.indent() + this.generate(expr, 'statement') + ';\n';
            this.indentLevel--;
            code += this.indent() + '}';
          }

          return code;
        }
      } else if (iterType === 'for-from') {
        // For-from (for-of in ES6) - same as for-in but uses different syntax
        const varsArray = Array.isArray(vars) ? vars : [vars];
        const [itemVar] = varsArray;

        // Check if itemVar is destructuring
        let itemVarPattern = itemVar;
        if (Array.isArray(itemVar) && (itemVar[0] === 'array' || itemVar[0] === 'object')) {
          itemVarPattern = this.generateDestructuringPattern(itemVar);
        }

        // Use for-of loop
        code += `for (const ${itemVarPattern} of ${this.generate(iterable, 'value')}) `;

        // Handle guards
        if (guards && guards.length > 0) {
          code += '{\n';
          this.indentLevel++;
          code += this.indent() + `if (${guards.map(g => this.generate(g, 'value')).join(' && ')}) {\n`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
          this.indentLevel--;
          code += this.indent() + '}\n';
          this.indentLevel--;
          code += this.indent() + '}';
        } else {
          code += '{\n';
          this.indentLevel++;
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
          this.indentLevel--;
          code += this.indent() + '}';
        }

        return code;
      } else if (iterType === 'for-of') {
        // For-of (object iteration)
        const varsArray = Array.isArray(vars) ? vars : [vars];
        const [keyVar, valueVar] = varsArray;
        const own = stepOrOwn;

        const objCode = this.generate(iterable, 'value');
        code += `for (const ${keyVar} in ${objCode}) `;
        code += '{\n';
        this.indentLevel++;

        // IMPORTANT: Check ordering when valueVar + guard
        // 1. Own check (if needed)
        // 2. Assign valueVar (if needed)
        // 3. Guard check (if needed) - may reference valueVar!

        if (own && !valueVar && !guards?.length) {
          // Just own check, no valueVar, no guards - simple continue
          code += this.indent() + `if (!Object.hasOwn(${objCode}, ${keyVar})) continue;\n`;
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
        } else if (own && valueVar && guards?.length) {
          // Own + valueVar + guards: nest properly
          code += this.indent() + `if (Object.hasOwn(${objCode}, ${keyVar})) {\n`;
          this.indentLevel++;
          code += this.indent() + `const ${valueVar} = ${objCode}[${keyVar}];\n`;
          code += this.indent() + `if (${guards.map(g => this.generate(g, 'value')).join(' && ')}) {\n`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
          this.indentLevel--;
          code += this.indent() + '}\n';
          this.indentLevel--;
          code += this.indent() + '}\n';
        } else if (own && valueVar) {
          // Own + valueVar, no guards
          code += this.indent() + `if (Object.hasOwn(${objCode}, ${keyVar})) {\n`;
          this.indentLevel++;
          code += this.indent() + `const ${valueVar} = ${objCode}[${keyVar}];\n`;
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
          this.indentLevel--;
          code += this.indent() + '}\n';
        } else if (valueVar && guards?.length) {
          // ValueVar + guards, no own
          code += this.indent() + `const ${valueVar} = ${objCode}[${keyVar}];\n`;
          code += this.indent() + `if (${guards.map(g => this.generate(g, 'value')).join(' && ')}) {\n`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
          this.indentLevel--;
          code += this.indent() + '}\n';
        } else if (valueVar) {
          // Just valueVar, no guards, no own
          code += this.indent() + `const ${valueVar} = ${objCode}[${keyVar}];\n`;
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
        } else if (guards?.length) {
          // Just guards, no valueVar, no own
          code += this.indent() + `if (${guards.map(g => this.generate(g, 'value')).join(' && ')}) {\n`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
          this.indentLevel--;
          code += this.indent() + '}\n';
        } else {
          // No own, no valueVar, no guards - simple body
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
        }

        this.indentLevel--;
        code += this.indent() + '}';
        return code;
      }
    }

    // Fallback for complex cases (multiple iterators, etc.)
    // These are rare and can fall back to IIFE safely
    return this.generate(['comprehension', expr, iterators, guards], 'value');
  }

  /**
   * Generate if/else with early returns (for implicit return context)
   * Used when if/else is the last statement in a function with multi-statement branches
   */
  generateIfElseWithEarlyReturns(ifStmt) {
    const [head, condition, thenBranch, ...elseBranches] = ifStmt;

    let code = '';
    const condCode = head === 'unless' ?
      `!${this.generate(condition, 'value')}` :
      this.generate(condition, 'value');

    code += this.indent() + `if (${condCode}) {\n`;
    code += this.withIndent(() => this.generateBranchWithReturn(thenBranch));
    code += this.indent() + '}';

    // Generate else branches
    for (const elseBranch of elseBranches) {
      code += ' else ';

      // Check if it's another if statement
      if (Array.isArray(elseBranch) && elseBranch[0] === 'if') {
        // Recursive if - generate it inline
        const [, nestedCond, nestedThen, ...nestedElse] = elseBranch;
        code += `if (${this.generate(nestedCond, 'value')}) {\n`;
        code += this.withIndent(() => this.generateBranchWithReturn(nestedThen));
        code += this.indent() + '}';

        // Continue with remaining else branches if any
        if (nestedElse.length > 0) {
          for (const remainingBranch of nestedElse) {
            code += ' else {\n';
            code += this.withIndent(() => this.generateBranchWithReturn(remainingBranch));
            code += this.indent() + '}';
          }
        }
      } else {
        // Regular else branch
        code += '{\n';
        code += this.withIndent(() => this.generateBranchWithReturn(elseBranch));
        code += this.indent() + '}';
      }
    }

    return code;
  }

  /**
   * Unwrap unnecessary outer parentheses from generated code
   * Useful for cleaning up nested expressions like (((x === 3))) → (x === 3)
   *
   * For logical operators in conditions, be more aggressive:
   * ((a && b) && c) → a && b && c (all outer parens removed)
   */
  unwrap(code) {
    if (typeof code !== 'string') return code;

    // Only unwrap if the ENTIRE expression is wrapped
    // Don't unwrap if there are operators or multiple parts outside the parens
    while (code.startsWith('(') && code.endsWith(')')) {
      // Check if these parens wrap the entire expression
      let depth = 0;
      let canUnwrap = true;

      for (let i = 0; i < code.length; i++) {
        if (code[i] === '(') depth++;
        if (code[i] === ')') depth--;

        // If we hit depth 0 before the end, parens don't wrap everything
        if (depth === 0 && i < code.length - 1) {
          canUnwrap = false;
          break;
        }
      }

      if (canUnwrap) {
        code = code.slice(1, -1);
      } else {
        break;
      }
    }

    return code;
  }

  /**
   * Flatten nested binary operator chains in s-expressions
   * Example: ["&&", ["&&", a, b], c] → ["&&", a, b, c]
   *
   * This handles deeply nested same-operator chains that result from
   * the parser's left-associative binary operator handling.
   * Only flattens pure chains (all && or all ||), preserving mixed operators.
   */
  flattenBinaryChain(sexpr) {
    if (!Array.isArray(sexpr) || sexpr.length < 3) {
      return sexpr;
    }

    const [head, ...rest] = sexpr;

    // Only flatten && and || chains
    if (head !== '&&' && head !== '||') {
      return sexpr;
    }

    // Recursively collect all operands in this chain
    const operands = [];

    const collect = (expr) => {
      if (Array.isArray(expr) && expr[0] === head) {
        // Same operator - flatten it
        for (let i = 1; i < expr.length; i++) {
          collect(expr[i]);
        }
      } else {
        // Different operator or leaf - keep as-is
        operands.push(expr);
      }
    };

    // Collect all operands
    for (const operand of rest) {
      collect(operand);
    }

    // Return flattened chain
    return [head, ...operands];
  }

  /**
   * Unwrap outer parens from generated code when safe
   * Used for cleaner condition generation in if/while statements
   */
  unwrapLogical(code) {
    if (typeof code !== 'string') return code;

    // Remove outer parens layers
    while (code.startsWith('(') && code.endsWith(')')) {
      let depth = 0;
      let minDepth = Infinity;

      for (let i = 1; i < code.length - 1; i++) {
        if (code[i] === '(') depth++;
        if (code[i] === ')') depth--;
        minDepth = Math.min(minDepth, depth);
      }

      // If minDepth >= 0, the outer parens wrap the whole expression
      if (minDepth >= 0) {
        code = code.slice(1, -1);
      } else {
        break;
      }
    }

    return code;
  }

  /**
   * Unwrap single-element array branches for cleaner if/else generation
   */
  unwrapIfBranch(branch) {
    if (Array.isArray(branch) && branch.length === 1) {
      const elem = branch[0];
      if (!Array.isArray(elem) || elem[0] !== 'block') {
        return elem;
      }
    }
    return branch;
  }

  /**
   * Check if s-expression represents literal -1
   * Pattern: ["-", "1"] or ["-", 1] or ["-", String("1")]
   * Used for range optimizations: arr[0..-1] → arr.slice(0)
   */
  isNegativeOneLiteral(sexpr) {
    return Array.isArray(sexpr) && sexpr[0] === '-' &&
           sexpr.length === 2 &&
           (sexpr[1] === '1' || sexpr[1] === 1 || (sexpr[1] instanceof String && sexpr[1].valueOf() === '1'));
  }

  /**
   * Check if branch contains control flow statements
   */
  hasStatementInBranch(branch) {
    if (!Array.isArray(branch)) return false;

    const head = branch[0];
    if (head === 'return' || head === 'throw' || head === 'break' || head === 'continue') {
      return true;
    }

    if (head === 'block') {
      const statements = branch.slice(1);
      return statements.some(stmt => this.hasStatementInBranch(stmt));
    }

    return false;
  }

  /**
   * Check if branch is a multi-statement block
   */
  isMultiStatementBlock(branch) {
    return Array.isArray(branch) && branch[0] === 'block' && branch.length > 2;
  }

  /**
   * Check if branch contains nested if with multi-statement blocks
   */
  hasNestedMultiStatement(branch) {
    if (!Array.isArray(branch)) return false;
    if (branch[0] === 'if') {
      const [_, cond, then, ...elseBranches] = branch;
      return this.isMultiStatementBlock(then) || elseBranches.some(b => this.hasNestedMultiStatement(b));
    }
    return false;
  }

  /**
   * Build nested ternary chain for multiple else-if branches
   */
  buildTernaryChain(branches) {
    if (branches.length === 0) return 'undefined';
    if (branches.length === 1) {
      return this.extractExpression(this.unwrapIfBranch(branches[0]));
    }

    const first = branches[0];
    if (Array.isArray(first) && first[0] === 'if') {
      const [_, cond, then, ...rest] = first;
      const thenPart = this.extractExpression(this.unwrapIfBranch(then));
      const elsePart = this.buildTernaryChain([...rest, ...branches.slice(1)]);
      return `(${this.generate(cond, 'value')} ? ${thenPart} : ${elsePart})`;
    }

    return this.extractExpression(this.unwrapIfBranch(first));
  }

  /**
   * Generate if statement in value context (ternary or IIFE)
   */
  generateIfAsExpression(condition, thenBranch, elseBranches) {
    // Check if any branch needs IIFE
    const needsIIFE = this.isMultiStatementBlock(thenBranch) || this.hasStatementInBranch(thenBranch) ||
                     elseBranches.some(b => this.isMultiStatementBlock(b) || this.hasStatementInBranch(b) || this.hasNestedMultiStatement(b));

    if (needsIIFE) {
      // Check if if statement contains await (need async IIFE)
      const containsAwait = this.containsAwait(condition) ||
                           this.containsAwait(thenBranch) ||
                           elseBranches.some(b => this.containsAwait(b));

      const asyncPrefix = containsAwait ? 'async ' : '';
      const awaitPrefix = containsAwait ? 'await ' : '';

      // Use IIFE for complex blocks
      let code = `${awaitPrefix}(${asyncPrefix}() => { `;
      code += `if (${this.generate(condition, 'value')}) `;
      code += this.generateBlockWithReturns(thenBranch);

      // Handle all else branches
      for (const branch of elseBranches) {
        code += ' else ';
        if (Array.isArray(branch) && branch[0] === 'if') {
          const [_, nestedCond, nestedThen, ...nestedElse] = branch;
          code += `if (${this.generate(nestedCond, 'value')}) `;
          code += this.generateBlockWithReturns(nestedThen);

          for (const nestedBranch of nestedElse) {
            code += ' else ';
            if (Array.isArray(nestedBranch) && nestedBranch[0] === 'if') {
              const [__, nnCond, nnThen, ...nnElse] = nestedBranch;
              code += `if (${this.generate(nnCond, 'value')}) `;
              code += this.generateBlockWithReturns(nnThen);
              elseBranches.push(...nnElse);
            } else {
              code += this.generateBlockWithReturns(nestedBranch);
            }
          }
        } else {
          code += this.generateBlockWithReturns(branch);
        }
      }

      code += ' })()';
      return code;
    }

    // Simple expression - build nested ternary
    const thenExpr = this.extractExpression(this.unwrapIfBranch(thenBranch));
    const elseExpr = this.buildTernaryChain(elseBranches);

    // Check if condition needs extra parens (yield/await have low precedence)
    let condCode = this.generate(condition, 'value');
    if (Array.isArray(condition) && (condition[0] === 'yield' || condition[0] === 'await')) {
      condCode = `(${condCode})`;
    }

    return `(${condCode} ? ${thenExpr} : ${elseExpr})`;
  }

  /**
   * Generate if statement in statement context
   */
  generateIfAsStatement(condition, thenBranch, elseBranches) {
    const condCode = this.unwrap(this.generate(condition, 'value'));
    let code = `if (${condCode}) `;
    code += this.generate(this.unwrapIfBranch(thenBranch), 'statement');

    for (const branch of elseBranches) {
      code += ` else `;
      code += this.generate(this.unwrapIfBranch(branch), 'statement');
    }

    return code;
  }

  /**
   * Check if class member key represents a static member
   */
  isStaticMember(memberKey) {
    return Array.isArray(memberKey) && memberKey[0] === '.' && memberKey[1] === 'this';
  }

  /**
   * Check if class member key represents a computed property
   */
  isComputedMember(memberKey) {
    return Array.isArray(memberKey) && memberKey[0] === 'computed';
  }

  /**
   * Extract member name from class member key
   * Handles static (@method), computed ([expr]), and regular (method) cases
   */
  extractMemberName(memberKey) {
    if (this.isStaticMember(memberKey)) {
      return memberKey[2];
    } else if (this.isComputedMember(memberKey)) {
      return `[${this.generate(memberKey[1], 'value')}]`;
    } else {
      return memberKey;
    }
  }

  /**
   * Check if member value is a bound method (fat arrow =>)
   */
  isBoundMethod(memberValue) {
    return Array.isArray(memberValue) && memberValue[0] === '=>';
  }

  /**
   * Generate switch case body (when clause or default)
   * Handles value vs statement context and explicit control flow
   */
  generateSwitchCaseBody(body, context) {
    let code = '';

    // Check if body has explicit control flow (return/throw)
    const hasExplicitFlow = this.hasExplicitControlFlow(body);

    if (hasExplicitFlow) {
      // Body has explicit control flow - unwrap and generate statements
      const statements = this.unwrapBlock(body);
      for (const stmt of statements) {
        code += this.indent() + this.generate(stmt, 'statement') + ';\n';
      }
    } else {
      // Normal expression - behavior depends on context
      if (context === 'value') {
        // Value context (will be wrapped in IIFE) - add return
        if (Array.isArray(body) && body[0] === 'block' && body.length > 2) {
          // Multi-statement block - generate all statements with implicit return on last
          const statements = body.slice(1);
          for (let i = 0; i < statements.length; i++) {
            const isLast = i === statements.length - 1;
            if (isLast) {
              const lastExpr = this.generate(statements[i], 'value');
              code += this.indent() + `return ${lastExpr};\n`;
            } else {
              code += this.indent() + this.generate(statements[i], 'statement') + ';\n';
            }
          }
        } else {
          // Single expression - add implicit return
          const bodyExpr = this.extractExpression(body);
          code += this.indent() + `return ${bodyExpr};\n`;
        }
      } else {
        // Statement context - no returns, just statements + break
        if (Array.isArray(body) && body[0] === 'block' && body.length > 1) {
          // Multi-statement block - generate all statements, then break
          const statements = body.slice(1);
          for (const stmt of statements) {
            code += this.indent() + this.generate(stmt, 'statement') + ';\n';
          }
        } else {
          // Single expression - generate as statement
          const bodyStmt = this.generate(body, 'statement');
          code += this.indent() + bodyStmt + ';\n';
        }
        code += this.indent() + 'break;\n';
      }
    }

    return code;
  }

  /**
   * Generate switch without discriminant as if/else chain
   * Context-aware: adds returns in value context, plain statements in statement context
   */
  generateSwitchAsIfChain(whens, defaultCase, context) {
    let code = '';
    for (let i = 0; i < whens.length; i++) {
      const whenClause = whens[i];
      const [, test, body] = whenClause;

      if (i === 0) {
        code += `if (${this.generate(test, 'value')}) {\n`;
      } else {
        code += ` else if (${this.generate(test, 'value')}) {\n`;
      }
      this.indentLevel++;

      // VALUE CONTEXT: Add return (switch as expression)
      if (context === 'value') {
        const bodyExpr = this.extractExpression(body);
        code += this.indent() + `return ${bodyExpr};\n`;
      }
      // STATEMENT CONTEXT: Just execute statements (switch for side effects)
      else {
        const statements = this.unwrapBlock(body);
        for (const stmt of statements) {
          code += this.indent() + this.generate(stmt, 'statement') + ';\n';
        }
      }

      this.indentLevel--;
      code += this.indent() + '}';
    }

    // Handle default case with same context awareness
    if (defaultCase) {
      code += ' else {\n';
      this.indentLevel++;

      if (context === 'value') {
        const defaultExpr = this.extractExpression(defaultCase);
        code += this.indent() + `return ${defaultExpr};\n`;
      } else {
        const statements = this.unwrapBlock(defaultCase);
        for (const stmt of statements) {
          code += this.indent() + this.generate(stmt, 'statement') + ';\n';
        }
      }

      this.indentLevel--;
      code += this.indent() + '}';
    }

    // Only wrap in IIFE if in value context
    if (context === 'value') {
      return `(() => { ${code} })()`;
    }
    return code;
  }

  //-------------------------------------------------------------------------
  // REACTIVE RUNTIME
  //-------------------------------------------------------------------------

  /**
   * Get the reactive runtime code to inject
   * Returns minified inline runtime for signal/computed/effect/batch
   */
  getReactiveRuntime() {
    return `// ============================================================================
// Rip Reactive Runtime
// A minimal, fine-grained reactivity system
//
// Reactivity:
//   __signal(value)    - Reactive state container
//   __computed(fn)     - Derived value (lazy, cached)
//   __effect(fn)       - Side effect that re-runs when dependencies change
//   __batch(fn)        - Group multiple updates into one flush
//   __readonly(value)  - Immutable value wrapper
//
// Context API:
//   setContext(key, value)  - Set context in current component
//   getContext(key)         - Get context from nearest ancestor
//   hasContext(key)         - Check if context exists
//
// Error Handling:
//   __catchErrors(fn)       - Wrap function to route errors to boundary
//   __handleError(error)    - Route error to nearest boundary
//
// How reactivity works:
//   - Reading a signal/computed inside an effect tracks it as a dependency
//   - Writing to a signal notifies all subscribers
//   - Batching defers effect execution until the batch completes
// ============================================================================

// Global state for dependency tracking
let __currentEffect = null;   // The effect/computed currently being evaluated
let __pendingEffects = new Set();  // Effects queued to run
let __batching = false;       // Are we inside a batch()?

// Flush all pending effects (called after signal updates, or at end of batch)
function __flushEffects() {
  const effects = [...__pendingEffects];
  __pendingEffects.clear();
  for (const effect of effects) effect.run();
}

// Shared primitive coercion (used by signal and computed)
const __primitiveCoercion = {
  valueOf() { return this.value; },
  toString() { return String(this.value); },
  [Symbol.toPrimitive](hint) { return hint === 'string' ? this.toString() : this.valueOf(); }
};

/**
 * Create a reactive signal (state container)
 * @param {*} initialValue - The initial value
 * @returns {object} Signal with .value getter/setter
 */
function __signal(initialValue) {
  let value = initialValue;
  const subscribers = new Set();  // Effects/computeds that depend on this signal
  
  // State flags
  let notifying = false;  // Prevents re-entry during notification
  let locked = false;     // Prevents writes (used during SSR/hydration)
  let dead = false;       // Signal has been killed (cleanup)

  const signal = {
    get value() {
      if (dead) return value;
      // Track this signal as a dependency of the current effect/computed
      if (__currentEffect) {
        subscribers.add(__currentEffect);
        __currentEffect.dependencies.add(subscribers);
      }
      return value;
    },
    
    set value(newValue) {
      // Skip if: dead, locked, same value, or already notifying
      if (dead || locked || newValue === value || notifying) return;
      value = newValue;
      notifying = true;
      
      // Notify subscribers: computeds mark dirty, effects get queued
      for (const sub of subscribers) {
        if (sub.markDirty) sub.markDirty();  // Computed
        else __pendingEffects.add(sub);      // Effect
      }
      
      // Flush immediately unless we're batching
      if (!__batching) __flushEffects();
      notifying = false;
    },
    
    read() { return value; },                    // Read without tracking
    lock() { locked = true; return signal; },    // Prevent further writes
    free() { subscribers.clear(); return signal; },  // Clear all subscribers
    kill() { dead = true; subscribers.clear(); return value; },  // Cleanup
    
    ...__primitiveCoercion
  };
  return signal;
}

/**
 * Create a computed value (derived state, lazy & cached)
 * @param {function} fn - Function that computes the value
 * @returns {object} Computed with .value getter
 */
function __computed(fn) {
  let value;
  let dirty = true;           // Needs recomputation?
  const subscribers = new Set();  // Things that depend on this computed
  
  // State flags
  let locked = false;  // Prevents recomputation
  let dead = false;    // Computed has been killed

  const computed = {
    dependencies: new Set(),  // Signals/computeds this depends on
    
    // Called by dependencies when they change
    markDirty() {
      if (dead || locked || dirty) return;
      dirty = true;
      // Propagate dirty status to our subscribers
      for (const sub of subscribers) {
        if (sub.markDirty) sub.markDirty();
        else __pendingEffects.add(sub);
      }
    },
    
    get value() {
      if (dead) return value;
      // Track this computed as a dependency
      if (__currentEffect) {
        subscribers.add(__currentEffect);
        __currentEffect.dependencies.add(subscribers);
      }
      // Recompute if dirty (lazy evaluation)
      if (dirty && !locked) {
        // Clear old dependencies
        for (const dep of computed.dependencies) dep.delete(computed);
        computed.dependencies.clear();
        // Evaluate with this computed as the current effect (to track deps)
        const prev = __currentEffect;
        __currentEffect = computed;
        try { value = fn(); } finally { __currentEffect = prev; }
        dirty = false;
      }
      return value;
    },
    
    read() { return value; },  // Return cached value without tracking or recomputing
    lock() { locked = true; computed.value; return computed; },  // Lock after computing
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

/**
 * Create a reactive effect (side effect that re-runs on dependency changes)
 * @param {function} fn - The effect function
 * @returns {function} Dispose function to stop the effect
 */
function __effect(fn) {
  const effect = {
    dependencies: new Set(),  // Signals/computeds this effect depends on
    
    run() {
      // Clear old dependencies before re-running
      for (const dep of effect.dependencies) dep.delete(effect);
      effect.dependencies.clear();
      // Run with this effect as current (to track deps)
      const prev = __currentEffect;
      __currentEffect = effect;
      try { fn(); } finally { __currentEffect = prev; }
    },
    
    dispose() {
      for (const dep of effect.dependencies) dep.delete(effect);
      effect.dependencies.clear();
    }
  };
  
  effect.run();  // Run immediately to establish dependencies
  return () => effect.dispose();
}

/**
 * Batch multiple state updates into a single effect flush
 * @param {function} fn - Function containing multiple state updates
 * @returns {*} The return value of fn
 */
function __batch(fn) {
  if (__batching) return fn();  // Already batching, just run
  __batching = true;
  try {
    return fn();
  } finally {
    __batching = false;
    __flushEffects();  // Flush all effects once at the end
  }
}

/**
 * Create a readonly value (immutable, no reactivity)
 * @param {*} value - The value to wrap
 * @returns {object} Frozen object with .value property
 */
function __readonly(value) {
  return Object.freeze({ value });
}

// ============================================================================
// Context API
// Pass data down the component tree without prop drilling
//
// Usage:
//   // In parent component constructor or methods:
//   setContext('theme', { dark: true })
//   
//   // In any descendant component:
//   theme = getContext('theme')
// ============================================================================

let __currentComponent = null;  // The component currently being initialized

/**
 * Set a context value in the current component
 * @param {*} key - The context key (usually a string or symbol)
 * @param {*} value - The value to store
 */
function setContext(key, value) {
  if (!__currentComponent) {
    throw new Error('setContext must be called during component initialization');
  }
  if (!__currentComponent._context) {
    __currentComponent._context = new Map();
  }
  __currentComponent._context.set(key, value);
}

/**
 * Get a context value from the nearest ancestor that set it
 * @param {*} key - The context key to look up
 * @returns {*} The context value, or undefined if not found
 */
function getContext(key) {
  let component = __currentComponent;
  while (component) {
    if (component._context && component._context.has(key)) {
      return component._context.get(key);
    }
    component = component._parent;
  }
  return undefined;
}

/**
 * Check if a context key exists in any ancestor
 * @param {*} key - The context key to check
 * @returns {boolean} True if the key exists
 */
function hasContext(key) {
  let component = __currentComponent;
  while (component) {
    if (component._context && component._context.has(key)) return true;
    component = component._parent;
  }
  return false;
}

// ============================================================================
// Error Boundaries
// Catch and handle errors in component trees gracefully
//
// Usage in component:
//   error: (err) -> console.error "Caught:", err
// ============================================================================

let __errorHandler = null;  // Current error handler (set by nearest error boundary)

/**
 * Set the current error handler (called by components with error: handler)
 * @param {function} handler - Error handler function
 * @returns {function} Previous handler (for restoration)
 */
function __setErrorHandler(handler) {
  const prev = __errorHandler;
  __errorHandler = handler;
  return prev;
}

/**
 * Handle an error - calls nearest error boundary or rethrows
 * @param {Error} error - The error to handle
 */
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

/**
 * Wrap a function to catch errors and route to error boundary
 * @param {function} fn - Function to wrap
 * @returns {function} Wrapped function
 */
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

/**
 * Convenience function for direct compilation
 */
export function generate(sexpr, options = {}) {
  const generator = new CodeGenerator(options);
  return generator.compile(sexpr);
}
