/**
 * Rip Code Generator (Clean-room Implementation)
 *
 * Generates JavaScript from CoffeeScript grammar s-expressions.
 *
 * Architecture:
 * - CoffeeScript Lexer (3,146 LOC) → Tokens
 * - Solar Parser (340 LOC) → S-expressions
 * - This Codegen (4,567 LOC) → JavaScript
 *
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

  constructor(options = {}) {
    this.options = options;
    this.indentLevel = 0;
    this.indentString = '  '; // 2 spaces
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

    // Preserve async sigil metadata before converting to primitive
    const headAwaitMetadata = (head instanceof String) ? head.await : undefined;

    // Convert head to primitive
    if (head instanceof String) {
      head = head.valueOf();
    }

    // If head is an array (branch containing multiple statements), recurse into each
    if (Array.isArray(head)) {
      sexpr.forEach(item => this.collectProgramVariables(item));
      return;
    }

    // Export - don't collect variables from export assignments (they're declared inline)
    if (head === 'export' || head === 'export-default' || head === 'export-all' || head === 'export-from') {
      return; // Don't collect vars from exports
    }

    // Assignment - track the target at program level
    if (CodeGenerator.ASSIGNMENT_OPS.has(head)) {
      const [target, value] = rest;

      // Simple variable assignment (including String objects with sigils)
      if (typeof target === 'string' || target instanceof String) {
        const varName = target instanceof String ? target.valueOf() : target;
        this.programVars.add(varName);
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
          console.warn('[RIP] Unexpected quoted primitive string (should be String object):', sexpr);
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

    // Pattern matching on s-expression head
    switch (head) {
      //=====================================================================
      // TOP LEVEL
      //=====================================================================

      case 'program':
        return this.generateProgram(rest);

      //=====================================================================
      // OPERATORS - Binary (Arithmetic, Comparison, Logical, Bitwise)
      //=====================================================================

      case '+':
      case '-':
      case '*':
      case '/':
      case '%':
      case '**':
      case '==':
      case '===':  // Allow explicit strict equality
      case '!=':
      case '!==':  // Allow explicit strict inequality
      case '<':
      case '>':
      case '<=':
      case '>=':
      case '&&':
      case '||':
      case '??':
      case '&':
      case '|':
      case '^':
      case '<<':
      case '>>':
      case '>>>': {
        // Binary operators: [op, left, right] → (left op right)
        // Special case: +/- can also be unary
        if ((head === '+' || head === '-') && rest.length === 1) {
          // Unary plus or minus
          const [operand] = rest;
          return `(${head}${this.generate(operand, 'value')})`;
        }

        // Binary operation (all operators)
        const [left, right] = rest;

        // Always use strict equality (CoffeeScript compatibility)
        // == → ===, != → !==, === → ===, !== → !==
        let op = head;
        if (head === '==') op = '===';
        if (head === '!=') op = '!==';
        // === and !== pass through as-is

        return `(${this.generate(left, 'value')} ${op} ${this.generate(right, 'value')})`;
      }

      case '%%': {
        // Modulo operator (different from %)
        // % is remainder (preserves sign): -7 % 5 = -2
        // %% is modulo (always positive): -7 %% 5 = 3
        // Uses helper function: modulo(n, d) = (n % d + d) % d with type coercion
        const [left, right] = rest;
        const leftCode = this.generate(left, 'value');
        const rightCode = this.generate(right, 'value');

        // Mark that we need the modulo helper function
        this.helpers.add('modulo');

        return `modulo(${leftCode}, ${rightCode})`;
      }

      case '//': {
        // Floor division: 7 // 2 → Math.floor(7 / 2)
        const [left, right] = rest;
        return `Math.floor(${this.generate(left, 'value')} / ${this.generate(right, 'value')})`;
      }

      //=====================================================================
      // OPERATORS - Ranges
      //=====================================================================

      case '..': {
        // Inclusive range: ["..", start, end]
        const [start, end] = rest;
        const startCode = this.generate(start, 'value');
        const endCode = this.generate(end, 'value');
        // Handle both forward and reverse ranges
        return `((s, e) => Array.from({length: Math.abs(e - s) + 1}, (_, i) => s + (i * (s <= e ? 1 : -1))))(${startCode}, ${endCode})`;
      }

      case '...': {
        // Two uses of ...:
        // 1. Exclusive range: ["...", start, end] (2 args)
        // 2. Spread operator: ["...", expression] (1 arg)
        if (rest.length === 2) {
          // Exclusive range - handle both forward and reverse
          const [start, end] = rest;
          const startCode = this.generate(start, 'value');
          const endCode = this.generate(end, 'value');
          return `((s, e) => Array.from({length: Math.max(0, Math.abs(e - s))}, (_, i) => s + (i * (s <= e ? 1 : -1))))(${startCode}, ${endCode})`;
        }
        // Spread operator
        const [expr] = rest;
        return `...${this.generate(expr, 'value')}`;
      }


      case '!': {
        // Logical NOT (unary)
        const [operand] = rest;
        const operandCode = this.generate(operand, 'value');

        // Add parens only if operand is complex (already has parens or is an expression)
        // Simple identifier/literal: !x, !true
        // Complex expression: !(x < 5), !(a && b)
        const needsParens = operandCode.includes('(') || operandCode.includes(' ');

        return needsParens ? `(!${operandCode})` : `!${operandCode}`;
      }

      case 'new': {
        // New operator: ["new", [constructor, ...args]]
        // Special case: parser may give ["new", [".", ["Constructor"], "prop"]]
        // for "new Constructor().prop" which should be "(new Constructor()).prop"
        const [call] = rest;

        // Check if call is a property access
        // Pattern: ["new", [".", "obj", "klass"]] → new obj.klass
        // Need to determine if this is:
        //   1. new obj.klass - instantiate the class at obj.klass
        //   2. (new obj()).klass - instantiate obj, then access klass property
        // Parser gives us pattern 1, which is what we want most of the time
        if (Array.isArray(call) && (call[0] === '.' || call[0] === '?.')) {
          const [accessType, target, prop] = call;

          // Check if target is itself a function call
          if (Array.isArray(target) && !target[0].startsWith) {
            // Target is a function call like ["fn", args]
            // Pattern: new fn().prop → (new fn()).prop
            const newExpr = this.generate(['new', target], 'value');
            return `(${newExpr}).${prop}`;
          }

          // Target is simple (identifier or property access)
          // Pattern: new obj.klass → new (obj.klass) or new obj.klass
          const targetCode = this.generate(target, 'value');
          const propAccess = `${targetCode}.${prop}`;
          return `new ${propAccess}`;
        }

        if (Array.isArray(call)) {
          const [constructor, ...args] = call;
          const constructorCode = this.generate(constructor, 'value');
          const argsCode = args.map(arg => this.generate(arg, 'value')).join(', ');
          return `new ${constructorCode}(${argsCode})`;
        }
        // Fallback: just the constructor without args
        return `new ${this.generate(call, 'value')}()`;
      }

      //=====================================================================
      // OPERATORS - Unary
      //=====================================================================

      case '~': {
        // Bitwise NOT (unary)
        const [operand] = rest;
        return `(~${this.generate(operand, 'value')})`;
      }

      case '++':
      case '--': {
        // Increment/Decrement: ["++", operand, isPostfix]
        // Prefix: ["++", x, false] → ++x
        // Postfix: ["++", x, true] → x++
        const [operand, isPostfix] = rest;
        const operandCode = this.generate(operand, 'value');

        if (isPostfix) {
          return `(${operandCode}${head})`;  // x++
        } else {
          return `(${head}${operandCode})`;  // ++x
        }
      }

      case 'instanceof': {
        // Instanceof operator: ["instanceof", expr, type]
        const [expr, type] = rest;
        return `(${this.generate(expr, 'value')} instanceof ${this.generate(type, 'value')})`;
      }

      case 'in': {
        // CoffeeScript 'in' operator has dual behavior:
        // - value in array → array.includes(value)
        // - value in string → string.includes(value)
        // - prop in object → (prop in object)
        // Use runtime check to determine which approach
        const [value, container] = rest;
        const valueCode = this.generate(value, 'value');
        const containerCode = this.generate(container, 'value');

        // Runtime check: if array or string, use .includes(), otherwise use JavaScript's 'in'
        return `(Array.isArray(${containerCode}) || typeof ${containerCode} === 'string' ? ${containerCode}.includes(${valueCode}) : (${valueCode} in ${containerCode}))`;
      }

      case 'of': {
        // CoffeeScript 'of' operator: check if property is in object
        // Pattern: key of object → key in object (JavaScript's 'in')
        const [key, obj] = rest;
        return `(${this.generate(key, 'value')} in ${this.generate(obj, 'value')})`;
      }

      case '=~': {
        // Regex match operator: text =~ /pattern/
        // Executes: (_ = toSearchable(text).match(/pattern/))
        // Stores match result in _ for further use
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

      //=====================================================================
      // ASSIGNMENT
      //=====================================================================

      case '=':
      case '+=':
      case '-=':
      case '*=':
      case '/=':
      case '%=':
      case '**=':
      case '&&=':
      case '||=':
      case '?=':
      case '??=':
      case '&=':
      case '|=':
      case '^=':
      case '<<=':
      case '>>=':
      case '>>>=': {
        // Assignment operators
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

              const firstDestructure = `[${beforePattern}] = ${valueCode}`;
              const secondDestructure = `[${afterPattern}] = slice.call(${valueCode}, -${afterCount})`;

              // Return comma-separated statements
              return `${firstDestructure}, ${secondDestructure}`;
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
            const condCode = this.generate(condition, 'value');
            const valueCode = this.generate(unwrappedValue, 'value');

            if (valueHead === 'unless') {
              return `if (!${condCode}) ${targetCode} = ${valueCode}`;
            } else {
              return `if (${condCode}) ${targetCode} = ${valueCode}`;
            }
          }
        }

        // Generate target code (strip ! sigil metadata for assignment LHS)
        let targetCode;
        if (target instanceof String && target.await !== undefined) {
          // Target has sigil - just use the clean name (don't apply dammit operator)
          targetCode = target.valueOf();
        } else {
          targetCode = this.generate(target, 'value');
        }

        const valueCode = this.generate(value, 'value');

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

      case '//=': {
        // Floor division assignment: x //= 2 → x = Math.floor(x / 2)
        const [target, value] = rest;
        const targetCode = this.generate(target, 'value');
        const valueCode = this.generate(value, 'value');
        return `${targetCode} = Math.floor(${targetCode} / ${valueCode})`;
      }

      //=====================================================================
      // DATA STRUCTURES
      //=====================================================================

      case 'array': {
        // Array literal: ["array", ...elements]
        // Check if last element is an elision that needs to be preserved
        const hasTrailingElision = rest.length > 0 && rest[rest.length - 1] === ',';

        const elements = rest.map(el => {
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
        return hasTrailingElision ? `[${elements},]` : `[${elements}]`;
      }

      case 'object': {
        // Object literal: ["object", [key, value, operator], [key, value, operator], ...]
        // OR Object comprehension (disguised): ["object", [key, ["comprehension", ...]]]
        // operator can be: ':', '=', or null (for shorthand)

        // Check if this is actually an object comprehension
        if (rest.length === 1 && Array.isArray(rest[0]) &&
            Array.isArray(rest[0][1]) && rest[0][1][0] === 'comprehension') {
          // Object comprehension pattern: ["object", [keyVar, ["comprehension", valueExpr, iterators, guards]]]
          const [keyVar, comprehensionNode] = rest[0];
          const [, valueExpr, iterators, guards] = comprehensionNode;

          // Convert to object-comprehension
          return this.generate(['object-comprehension', keyVar, valueExpr, iterators, guards], context);
        }

        // Regular object literal
        const pairs = rest.map(pair => {
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

        return `{${pairs}}`;
      }

      //=====================================================================
      // PROPERTY ACCESS
      //=====================================================================

      case '.': {
        // Property access: [".", object, "property"]
        const [obj, prop] = rest;
        const objCode = this.generate(obj, 'value');

        // Wrap numeric literals, object literals, await, and yield in parens
        // - 42.toString() → (42).toString()
        // - {a: 1}.hasOwnProperty() → ({a: 1}).hasOwnProperty()
        // - (await promise).value → (await promise).value
        const isNumberLiteral = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(objCode);
        const isObjectLiteral = Array.isArray(obj) && obj[0] === 'object';
        const isAwaitOrYield = Array.isArray(obj) && (obj[0] === 'await' || obj[0] === 'yield');
        const needsParens = isNumberLiteral || isObjectLiteral || isAwaitOrYield;
        const base = needsParens ? `(${objCode})` : objCode;

        // DAMMIT OPERATOR on property: obj.method!
        // When property has .await metadata, it's the dammit operator (!)
        // The ! operator always calls (even without args) and awaits
        // This applies whether standalone or last expression in a function
        if (prop instanceof String && prop.await === true) {
          const cleanProp = prop.valueOf();
          return `await ${base}.${cleanProp}()`;
        }

        const cleanProp = prop instanceof String ? prop.valueOf() : prop;
        return `${base}.${cleanProp}`;
      }

      case '?.': {
        // Optional chaining: ["?.", object, "property"]
        const [obj, prop] = rest;
        return `${this.generate(obj, 'value')}?.${prop}`;
      }

      case '::': {
        // Prototype access: ["::", object, "property"]
        const [obj, prop] = rest;
        const objCode = this.generate(obj, 'value');

        if (prop === 'prototype') {
          // Shorthand obj:: → obj.prototype
          return `${objCode}.prototype`;
        }

        // DAMMIT OPERATOR on prototype method: Only applies when NOT being called
        // If this property access is the callee of a function call, let the call case handle it
        const cleanProp = prop instanceof String ? prop.valueOf() : prop;
        return `${objCode}.prototype.${cleanProp}`;
      }

      case '?::': {
        // Soak prototype (CoffeeScript style): ["?::", object, "property"]
        // Pattern: obj?::method → (obj != null ? obj.prototype.method : undefined)
        const [obj, prop] = rest;
        const objCode = this.generate(obj, 'value');

        if (prop === 'prototype') {
          // Shorthand obj?:: → (obj != null ? obj.prototype : undefined)
          return `(${objCode} != null ? ${objCode}.prototype : undefined)`;
        }
        return `(${objCode} != null ? ${objCode}.prototype.${prop} : undefined)`;
      }

      case 'regex-index': {
        // Regex indexing: value[/pattern/] or value[/pattern/, n]
        // S-expr: ["regex-index", value, regex, captureIndex]
        // captureIndex is null for default (0), or a number for specific capture
        const [value, regex, captureIndex] = rest;

        // Mark helpers and _ variable needed
        this.helpers.add('toSearchable');
        this.programVars.add('_');

        const valueCode = this.generate(value, 'value');
        const regexCode = this.generate(regex, 'value');

        // Determine capture index (default to 0 if null)
        const indexCode = captureIndex !== null ? this.generate(captureIndex, 'value') : '0';

        // Check if regex has 'm' flag (multiline) to allow newlines
        const hasMultilineFlag = regexCode.includes('/m');
        const allowNewlines = hasMultilineFlag ? ', true' : '';

        return `(_ = toSearchable(${valueCode}${allowNewlines}).match(${regexCode})) && _[${indexCode}]`;
      }

      case '[]': {
        // Array indexing or slicing: ["[]", array, index_or_range]
        const [arr, index] = rest;

        // Check if index is a range (slicing operation)
        if (Array.isArray(index) && (index[0] === '..' || index[0] === '...')) {
          const isInclusive = index[0] === '..';
          const arrCode = this.generate(arr, 'value');
          const [start, end] = index.slice(1);

          // Handle different slice patterns
          if (start === null && end === null) {
            // arr[..] or arr[...] - copy entire array
            return `${arrCode}.slice()`;
          } else if (start === null) {
            // arr[..end] or arr[...end] - from beginning to index
            // Special case: [..-1] means entire array
            const isNegativeOne = Array.isArray(end) && end[0] === '-' &&
                                  end.length === 2 &&
                                  (end[1] === '1' || end[1] === 1 || (end[1] instanceof String && end[1].valueOf() === '1'));

            if (isInclusive && isNegativeOne) {
              return `${arrCode}.slice(0)`;
            }

            const endCode = this.generate(end, 'value');
            if (isInclusive) {
              // Use CoffeeScript's pattern: +end + 1 || 9e9
              return `${arrCode}.slice(0, +${endCode} + 1 || 9e9)`;
            } else {
              return `${arrCode}.slice(0, ${endCode})`;
            }
          } else if (end === null) {
            // arr[start..] or arr[start...] - from index to end
            const startCode = this.generate(start, 'value');
            return `${arrCode}.slice(${startCode})`;
          } else {
            // arr[start..end] or arr[start...end] - full range
            const startCode = this.generate(start, 'value');

            // Special case: inclusive range to literal -1 means "to end"
            // CoffeeScript treats arr[x..-1] as arr.slice(x) not arr.slice(x, -1+1)
            // Check if end is ["-", "1"] (unary minus 1)
            const isNegativeOneLiteral = Array.isArray(end) && end[0] === '-' &&
                                  end.length === 2 &&
                                  (end[1] === '1' || end[1] === 1 || (end[1] instanceof String && end[1].valueOf() === '1'));

            if (isInclusive && isNegativeOneLiteral) {
              return `${arrCode}.slice(${startCode})`;
            }

            const endCode = this.generate(end, 'value');

            if (isInclusive) {
              // Inclusive: slice(start, end + 1)
              // For variables, CoffeeScript uses: +end + 1 || 9e9 to handle -1 case
              // We'll use the simpler approach for now
              return `${arrCode}.slice(${startCode}, +${endCode} + 1 || 9e9)`;
            } else {
              // Exclusive: slice(start, end)
              return `${arrCode}.slice(${startCode}, ${endCode})`;
            }
          }
        }

        // Regular indexing
        return `${this.generate(arr, 'value')}[${this.generate(index, 'value')}]`;
      }

      case '?[]': {
        // Soak indexing (CoffeeScript style): ["?[]", array, index]
        // Pattern: arr?[index] → (arr != null ? arr[index] : undefined)
        const [arr, index] = rest;
        const arrCode = this.generate(arr, 'value');
        const indexCode = this.generate(index, 'value');
        return `(${arrCode} != null ? ${arrCode}[${indexCode}] : undefined)`;
      }

      case 'optindex': {
        // ES6 optional indexing: ["optindex", array, index]
        // Pattern: arr?.[index] → arr?.[index] (native ES6)
        const [arr, index] = rest;
        const arrCode = this.generate(arr, 'value');
        const indexCode = this.generate(index, 'value');
        return `${arrCode}?.[${indexCode}]`;
      }

      case 'optcall': {
        // ES6 optional call: ["optcall", fn, ...args]
        // Pattern: fn?.(arg) → fn?.(arg) (native ES6)
        const [fn, ...args] = rest;
        const fnCode = this.generate(fn, 'value');
        const argsCode = args.map(arg => this.generate(arg, 'value')).join(', ');
        return `${fnCode}?.(${argsCode})`;
      }

      //=====================================================================
      // FUNCTIONS
      //=====================================================================

      case 'def': {
        // Function definition: ["def", name, params, body]
        const [name, params, body] = rest;

        // Check for ! sigil: suppresses implicit returns (side-effect only function)
        // def process!() -> ... means no implicit return from last statement
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

      case '->': {
        // Thin arrow (unbound this): ["->", params, body]
        const [params, body] = rest;

        // Check for void function flag (set by assignment with ! sigil)
        const sideEffectOnly = this.nextFunctionIsVoid || false;
        this.nextFunctionIsVoid = false; // Reset flag after use

        const paramList = this.generateParamList(params);
        const bodyCode = this.generateFunctionBody(body, params, sideEffectOnly);

        // Check if body contains await or yield
        const isAsync = this.containsAwait(body);
        const isGenerator = this.containsYield(body);
        const asyncPrefix = isAsync ? 'async ' : '';
        const generatorSuffix = isGenerator ? '*' : '';

        const fnCode = `${asyncPrefix}function${generatorSuffix}(${paramList}) ${bodyCode}`;

        // In value context (like IIFE), wrap in parens to make it a function expression
        // This prevents "function statements require a name" errors
        return context === 'value' ? `(${fnCode})` : fnCode;
      }

      case '=>': {
        // Fat arrow (bound this): ["=>", params, body]
        const [params, body] = rest;

        // Check for void function flag (set by assignment with ! sigil)
        const sideEffectOnly = this.nextFunctionIsVoid || false;
        this.nextFunctionIsVoid = false; // Reset flag after use

        const paramList = this.generateParamList(params);

        // Check if body contains await
        const isAsync = this.containsAwait(body);
        const asyncPrefix = isAsync ? 'async ' : '';

        // If sideEffectOnly, always use block form (can't use concise arrow with void return)
        if (!sideEffectOnly) {
          // Check if body is a block with single expression
          if (Array.isArray(body) && body[0] === 'block' && body.length === 2) {
            // Single statement block - use concise arrow syntax
            const expr = body[1];
            if (!Array.isArray(expr) || expr[0] !== 'return') {
              // Not already a return - use concise syntax
              return `${asyncPrefix}(${paramList}) => ${this.generate(expr, 'value')}`;
            }
          }

          // Single expression not in block
          if (!Array.isArray(body) || body[0] !== 'block') {
            // Single expression - use concise arrow syntax
            return `${asyncPrefix}(${paramList}) => ${this.generate(body, 'value')}`;
          }
        }

        // Multi-statement block - need braces with returns
        const bodyCode = this.generateFunctionBody(body, params, sideEffectOnly);
        return `${asyncPrefix}(${paramList}) => ${bodyCode}`;
      }

      case 'return': {
        // Return statement: ["return"] or ["return", expr]
        if (rest.length === 0) {
          return 'return';
        }
        let [expr] = rest;

        // If in a void function (sideEffectOnly), convert "return expr" to just "return"
        if (this.sideEffectOnly) {
          return 'return';
        }

        // Handle postfix unless/if with return: "return X unless Y"
        // Parser creates: ["return", ["unless", condition, [value]]]
        // Should generate: if (!condition) return value;
        // NOT: return (!condition ? value : undefined);
        if (Array.isArray(expr) && expr[0] === 'unless') {
          const [, condition, body] = expr;
          const value = Array.isArray(body) && body.length === 1 ? body[0] : body;
          return `if (!${this.generate(condition, 'value')}) return ${this.generate(value, 'value')}`;
        }

        // Handle postfix if with return: "return X if Y"
        // Parser creates: ["return", ["if", condition, [value]]]
        // Should generate: if (condition) return value;
        if (Array.isArray(expr) && expr[0] === 'if') {
          const [, condition, body, ...elseParts] = expr;
          // Only handle simple postfix if (no else branches)
          if (elseParts.length === 0) {
            const value = Array.isArray(body) && body.length === 1 ? body[0] : body;
            return `if (${this.generate(condition, 'value')}) return ${this.generate(value, 'value')}`;
          }
        }

        // Handle special case: return new X unless condition
        // Parser creates: ["return", ["new", ["unless", cond, [[X, args]]]]]
        // Should be: if (!cond) { return new X(args); }
        if (Array.isArray(expr) && expr[0] === 'new' &&
            Array.isArray(expr[1]) && expr[1][0] === 'unless') {
          const [, unlessNode] = expr;
          const [, condition, body] = unlessNode;
          // Reconstruct as: unless condition; return new body
          const actualNew = ['new', body[0]];  // body is array with one element (the constructor call)
          return this.generate(['unless', condition, [['return', actualNew]]], 'statement');
        }

        return `return ${this.generate(expr, 'value')}`;
      }

      case 'block': {
        // Statement block: ["block", ...statements]
        const stmts = this.withIndent(() => this.formatStatements(rest));
        return `{\n${stmts.join('\n')}\n${this.indent()}}`;
      }

      //=====================================================================
      // CONTROL FLOW
      //=====================================================================

      case 'if': {
        // If statement: ["if", condition, thenBranch, ...elseBranches]
        const [condition, thenBranch, ...elseBranches] = rest;

        if (context === 'value') {
          return this.generateIfAsExpression(condition, thenBranch, elseBranches);
        } else {
          return this.generateIfAsStatement(condition, thenBranch, elseBranches);
        }
      }

      case 'unless': {
        // Unless statement: ["unless", condition, body]
        let [condition, body] = rest;

        // Unwrap single-element array body (postfix unless wraps body in array)
        // Unwrap if it's a single primitive OR a single statement (block nodes stay wrapped)
        if (Array.isArray(body) && body.length === 1) {
          const elem = body[0];
          // Unwrap if NOT a block (blocks need their wrapper)
          if (!Array.isArray(elem) || elem[0] !== 'block') {
            body = elem;
          }
        }

        // Context-aware: in value context, generate ternary with negation
        if (context === 'value') {
          const thenExpr = this.extractExpression(body);
          return `(!${this.generate(condition, 'value')} ? ${thenExpr} : undefined)`;
        }

        // Statement context: generate if (!cond)
        let code = `if (!${this.generate(condition, 'value')}) `;
        code += this.generate(body, 'statement');

        return code;
      }

      case '?:': {
        // Ternary operator: ["?:", condition, thenExpr, elseExpr]
        const [condition, thenExpr, elseExpr] = rest;
        // Unwrap excessive parens from condition (e.g., ((a || b)) → a || b)
        const condCode = this.unwrap(this.generate(condition, 'value'));
        return `(${condCode} ? ${this.generate(thenExpr, 'value')} : ${this.generate(elseExpr, 'value')})`;
      }

      case '?': {
        // Existence check (postfix): ["?", expr]
        const [expr] = rest;
        return `(${this.generate(expr, 'value')} != null)`;
      }

      case 'typeof': {
        // Typeof operator: ["typeof", expr]
        const [expr] = rest;
        return `typeof ${this.generate(expr, 'value')}`;
      }

      case 'delete': {
        // Delete operator: ["delete", expr]
        const [expr] = rest;
        return `delete ${this.generate(expr, 'value')}`;
      }

      //=====================================================================
      // LOOPS
      //=====================================================================

      case 'for-in': {
        // For-in loop: ["for-in", vars, iterable, step, guard, body]
        const [vars, iterable, step, guard, body] = rest;

        // In value context, convert to comprehension (collect results)
        if (context === 'value') {
          // For-in in value context becomes a comprehension that collects results
          // Note: Comprehensions can have break/continue (they just stop collecting)
          const iterator = ['for-in', vars, iterable, step];
          const guards = guard ? [guard] : [];
          return this.generate(['comprehension', body, [iterator], guards], context);
        }

        const varsArray = Array.isArray(vars) ? vars : [vars];
        
        // Check if no loop variable (range repetition: for [1...N])
        const noVar = varsArray.length === 0;
        const [itemVar, indexVar] = noVar ? ['_i', null] : varsArray;

        // Check if itemVar is a destructuring pattern
        let itemVarPattern = itemVar;
        if (Array.isArray(itemVar) && (itemVar[0] === 'array' || itemVar[0] === 'object')) {
          itemVarPattern = this.generateDestructuringPattern(itemVar);
        }

        // Handle step (unified for both positive and negative steps)
        if (step && step !== null) {
          const iterableCode = this.generate(iterable, 'value');
          const indexVarName = indexVar || '_i';
          const stepCode = this.generate(step, 'value');
          
          // Detect if step is negative (reverse iteration)
          const isNegativeStep = this.isNegativeStep(step);
          
          // Special case: -1 and 1 generate cleaner ++ and -- operators
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

          // Generate body with item variable assignment
          if (Array.isArray(body) && body[0] === 'block') {
            const statements = body.slice(1);
            this.indentLevel++;
            const stmts = [];
            
            // Only extract item if we have an actual loop variable (not throwaway _i for noVar)
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
              stmts.push(...statements.map(s => this.generate(s, 'statement') + ';'));
            }

            this.indentLevel--;
            return loopHeader + `{\n${stmts.map(s => this.indent() + s).join('\n')}\n${this.indent()}}`;
          } else {
            // Single statement body
            if (noVar) {
              // No variable to extract
              if (guard) {
                const guardCode = this.generate(guard, 'value');
                return loopHeader + `{ if (${guardCode}) ${this.generate(body, 'statement')}; }`;
              } else {
                return loopHeader + `{ ${this.generate(body, 'statement')}; }`;
              }
            } else {
              // Extract item variable
              if (guard) {
                const guardCode = this.generate(guard, 'value');
                return loopHeader + `{ const ${itemVarPattern} = ${iterableCode}[${indexVarName}]; if (${guardCode}) ${this.generate(body, 'statement')}; }`;
              } else {
                return loopHeader + `{ const ${itemVarPattern} = ${iterableCode}[${indexVarName}]; ${this.generate(body, 'statement')}; }`;
              }
            }
          }
        }

        // If index variable is provided (no step), use traditional for loop
        if (indexVar) {
          const iterableCode = this.generate(iterable, 'value');
          let code = `for (let ${indexVar} = 0; ${indexVar} < ${iterableCode}.length; ${indexVar}++) `;

          // Generate body with item variable assignment
          if (Array.isArray(body) && body[0] === 'block') {
            const statements = body.slice(1);
            this.indentLevel++;
            const stmts = [`const ${itemVarPattern} = ${iterableCode}[${indexVar}];`];

            if (guard) {
              const guardCode = this.generate(guard, 'value');
              stmts.push(`if (${guardCode}) {`);
              this.indentLevel++;
              stmts.push(...this.formatStatements(statements));
              this.indentLevel--;
              stmts.push(this.indent() + '}');
            } else {
              stmts.push(...statements.map(s => this.generate(s, 'statement') + ';'));
            }

            this.indentLevel--;
            code += `{\n${stmts.map(s => this.indent() + s).join('\n')}\n${this.indent()}}`;
          } else {
            // Single statement body
            if (guard) {
              const guardCode = this.generate(guard, 'value');
              code += `{ const ${itemVarPattern} = ${iterableCode}[${indexVar}]; if (${guardCode}) ${this.generate(body, 'statement')}; }`;
            } else {
              code += `{ const ${itemVarPattern} = ${iterableCode}[${indexVar}]; ${this.generate(body, 'statement')}; }`;
            }
          }

          return code;
        }

        // No index variable - check if we can optimize range iteration
        // Optimize: for k in [1...n] → for (let k = 1; k < n; k++)
        let iterableHead = Array.isArray(iterable) && iterable[0];
        // Convert String objects to primitives for comparison
        if (iterableHead instanceof String) {
          iterableHead = iterableHead.valueOf();
        }
        const isRange = iterableHead === '..' || iterableHead === '...';

        if (isRange) {
          const isExclusive = iterableHead === '...';
          const [start, end] = iterable.slice(1);

          // Only optimize simple numeric ranges (not expressions that might have side effects)
          // Simple cases: numbers, identifiers, property access
          const isSimple = (expr) => {
            if (typeof expr === 'number') return true;
            // Handle both primitive strings and String objects
            if (expr instanceof String) {
              const val = expr.valueOf();
              // Number literal or simple identifier (no function calls)
              return !val.includes('(');
            }
            if (typeof expr === 'string' && !expr.includes('(')) return true;
            if (Array.isArray(expr) && expr[0] === '.') return true; // property access
            return false;
          };

          if (isSimple(start) && isSimple(end)) {
            // Generate traditional for loop
            const startCode = this.generate(start, 'value');
            const endCode = this.generate(end, 'value');
            const comparison = isExclusive ? '<' : '<=';
            
            // Handle step if present
            let increment = `${itemVarPattern}++`;
            if (step && step !== null) {
              const stepCode = this.generate(step, 'value');
              increment = `${itemVarPattern} += ${stepCode}`;
            }

            let code = `for (let ${itemVarPattern} = ${startCode}; ${itemVarPattern} ${comparison} ${endCode}; ${increment}) `;

            // Generate body with guard if present
            if (guard) {
              code += this.generateLoopBodyWithGuard(body, guard);
            } else {
              code += this.generateLoopBody(body);
            }

            return code;
          }
        }

        // No index variable - use for-of
        let code = `for (const ${itemVarPattern} of ${this.generate(iterable, 'value')}) `;

        // Generate body with guard if present
        if (guard) {
          code += this.generateLoopBodyWithGuard(body, guard);
        } else {
          code += this.generateLoopBody(body);
        }

        return code;
      }

      case 'for-of': {
        // For-of loop (object iteration): ["for-of", vars, object, own, guard, body]
        const [vars, obj, own, guard, body] = rest;
        const [keyVar, valueVar] = Array.isArray(vars) ? vars : [vars];

        const objCode = this.generate(obj, 'value');
        let code = `for (const ${keyVar} in ${objCode}) `;

        // Build the combined condition: own check + guard
        // IMPORTANT: When valueVar is present, we CANNOT combine own and guard checks
        // because the guard may reference valueVar which isn't defined yet!
        // Example: for own k, v of obj when v > 5
        // Bad:  if (obj.hasOwnProperty(k) && (v > 5)) { const v = obj[k]; ... }  // v undefined!
        // Good: if (obj.hasOwnProperty(k)) { const v = obj[k]; if (v > 5) { ... } }

        let ownCheck = null;
        let guardCheck = null;

        if (own) {
          ownCheck = [['.', obj, 'hasOwnProperty'], keyVar];
        }

        if (guard) {
          guardCheck = guard;
        }

        // Only combine own and guard if there's NO valueVar (to avoid use-before-declaration)
        let combinedGuard = null;
        if (!valueVar && ownCheck && guardCheck) {
          // Safe to combine: no value variable that guard might reference
          combinedGuard = ['&&', ownCheck, guardCheck];
        } else if (!valueVar && ownCheck) {
          combinedGuard = ownCheck;
        } else if (!valueVar && guardCheck) {
          combinedGuard = guardCheck;
        }

        // If valueVar is provided, add it as first statement in body
        if (valueVar) {
          // When valueVar exists, we must be careful about check ordering:
          // 1. Check own first (if needed)
          // 2. Assign valueVar
          // 3. Check guard (if needed) - may reference valueVar!

          if (ownCheck && guardCheck) {
            // Both own and guard: nest them with valueVar assignment in between
            if (Array.isArray(body) && body[0] === 'block') {
              const statements = body.slice(1);
              this.indentLevel++;
              const outerIndent = this.indent();
              const ownCondition = this.generate(ownCheck, 'value');
              this.indentLevel++;
              const midIndent = this.indent();
              const guardCondition = this.generate(guardCheck, 'value');
              this.indentLevel++;
              const innerIndent = this.indent();
              const stmts = statements.map(s => innerIndent + this.generate(s, 'statement') + ';');
              this.indentLevel -= 3;
              // Structure: if (own) { const v = obj[k]; if (guard) { body } }
              code += `{\n${outerIndent}if (${ownCondition}) {\n${midIndent}const ${valueVar} = ${objCode}[${keyVar}];\n${midIndent}if (${guardCondition}) {\n${stmts.join('\n')}\n${midIndent}}\n${outerIndent}}\n${this.indent()}}`;
            } else {
              const ownCondition = this.generate(ownCheck, 'value');
              const guardCondition = this.generate(guardCheck, 'value');
              code += `{ if (${ownCondition}) { const ${valueVar} = ${objCode}[${keyVar}]; if (${guardCondition}) ${this.generate(body, 'statement')}; } }`;
            }
          } else if (ownCheck) {
            // Just own (no guard) with valueVar
            if (Array.isArray(body) && body[0] === 'block') {
              const statements = body.slice(1);
              this.indentLevel++;
              const loopBodyIndent = this.indent();
              const condition = this.generate(ownCheck, 'value');
              this.indentLevel++;
              const innerIndent = this.indent();
              const stmts = statements.map(s => innerIndent + this.generate(s, 'statement') + ';');
              this.indentLevel -= 2;
              // valueVar assignment INSIDE the own-check
              code += `{\n${loopBodyIndent}if (${condition}) {\n${innerIndent}const ${valueVar} = ${objCode}[${keyVar}];\n${stmts.join('\n')}\n${loopBodyIndent}}\n${this.indent()}}`;
            } else {
              code += `{ if (${this.generate(ownCheck, 'value')}) { const ${valueVar} = ${objCode}[${keyVar}]; ${this.generate(body, 'statement')}; } }`;
            }
          } else if (guardCheck) {
            // Just guard (no own) with valueVar
            // IMPORTANT: Assign valueVar FIRST, then check guard (guard may reference valueVar!)
            if (Array.isArray(body) && body[0] === 'block') {
              const statements = body.slice(1);
              this.indentLevel++;
              const loopBodyIndent = this.indent();
              const guardCondition = this.generate(guardCheck, 'value');
              this.indentLevel++;
              const innerIndent = this.indent();
              const stmts = statements.map(s => innerIndent + this.generate(s, 'statement') + ';');
              this.indentLevel -= 2;
              // valueVar assignment BEFORE guard check
              code += `{\n${loopBodyIndent}const ${valueVar} = ${objCode}[${keyVar}];\n${loopBodyIndent}if (${guardCondition}) {\n${stmts.join('\n')}\n${loopBodyIndent}}\n${this.indent()}}`;
            } else {
              code += `{ const ${valueVar} = ${objCode}[${keyVar}]; if (${this.generate(guardCheck, 'value')}) ${this.generate(body, 'statement')}; }`;
            }
          } else {
            // No checks, just valueVar assignment
            if (Array.isArray(body) && body[0] === 'block') {
              const statements = body.slice(1);
              this.indentLevel++;
              const stmts = [`const ${valueVar} = ${objCode}[${keyVar}];`, ...statements.map(s => this.generate(s, 'statement') + ';')];
              this.indentLevel--;
              code += `{\n${stmts.map(s => this.indent() + s).join('\n')}\n${this.indent()}}`;
            } else {
              code += `{ const ${valueVar} = ${objCode}[${keyVar}]; ${this.generate(body, 'statement')}; }`;
            }
          }
        } else {
          // No value variable - generate body with combined guard if present
          if (combinedGuard) {
            code += this.generateLoopBodyWithGuard(body, combinedGuard);
          } else {
            code += this.generateLoopBody(body);
          }
        }

        return code;
      }

      case 'for-from': {
        // For-from loop: ["for-from", vars, iterable, isAwait, guard, body]
        // from is CoffeeScript alias for 'of'
        // isAwait determines if we generate 'for await'
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
            // Has middle/leading rest - need temp variable approach
            needsTempVar = true;
            const elementsAfterRest = elements.slice(restIndex + 1);
            const afterCount = elementsAfterRest.length;

            // Build first destructure (up to rest)
            const beforeRest = elements.slice(0, restIndex);
            const restEl = elements[restIndex];
            const restVar = Array.isArray(restEl) && restEl[0] === '...' ? restEl[1] : '_rest';

            const beforePattern = beforeRest.map(el => {
              if (el === ',') return '';
              if (typeof el === 'string') return el;
              return this.generate(el, 'value');
            }).join(', ');

            const firstPattern = beforePattern ? `${beforePattern}, ...${restVar}` : `...${restVar}`;

            // Build second destructure (from rest)
            const afterPattern = elementsAfterRest.map(el => {
              if (el === ',') return '';
              if (typeof el === 'string') return el;
              return this.generate(el, 'value');
            }).join(', ');

            destructuringStatements.push(`[${firstPattern}] = _item`);
            destructuringStatements.push(`[${afterPattern}] = ${restVar}.splice(-${afterCount})`);

            this.helpers.add('slice'); // Will be used

            // Collect variables from the destructuring pattern for hoisting
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

        // Generate loop
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

        // If we need temp var, inject destructuring statements at start of body
        if (needsTempVar && destructuringStatements.length > 0) {
          const statements = this.unwrapBlock(body);
          const allStmts = this.withIndent(() => [
            ...destructuringStatements.map(s => this.indent() + s + ';'),
            ...this.formatStatements(statements)
          ]);
          code += `{\n${allStmts.join('\n')}\n${this.indent()}}`;
        } else {
          // Normal body generation
          if (guard) {
            code += this.generateLoopBodyWithGuard(body, guard);
          } else {
            code += this.generateLoopBody(body);
          }
        }

        return code;
      }

      case 'while': {
        // While loop: ["while", condition, guard?, body]
        const condition = rest[0];
        const guard = rest.length === 3 ? rest[1] : null;
        const body = rest[rest.length - 1];

        let code = `while (${this.generate(condition, 'value')}) `;

        // If there's a guard, wrap body in if statement
        if (guard) {
          code += this.generateLoopBodyWithGuard(body, guard);
        } else {
          code += this.generateLoopBody(body);
        }

        return code;
      }

      case 'until': {
        // Until loop: ["until", condition, guard?, body]
        const condition = rest[0];
        const guard = rest.length === 3 ? rest[1] : null;
        const body = rest[rest.length - 1];

        let code = `while (!${this.generate(condition, 'value')}) `;

        // If there's a guard, wrap body in if statement
        if (guard) {
          code += this.generateLoopBodyWithGuard(body, guard);
        } else {
          code += this.generateLoopBody(body);
        }

        return code;
      }

      case 'loop': {
        // Infinite loop: ["loop", body]
        const [body] = rest;

        let code = `while (true) `;
        code += this.generateLoopBody(body);

        return code;
      }

      case 'break': {
        // Break statement: ["break"] or ["break-if", condition]
        return 'break';
      }

      case 'break-if': {
        // Conditional break: ["break-if", condition]
        const [condition] = rest;
        return `if (${this.generate(condition, 'value')}) break`;
      }

      case 'continue': {
        // Continue statement: ["continue"] or ["continue-if", condition]
        return 'continue';
      }

      case 'continue-if': {
        // Conditional continue: ["continue-if", condition]
        const [condition] = rest;
        return `if (${this.generate(condition, 'value')}) continue`;
      }

      //=====================================================================
      // EXCEPTIONS
      //=====================================================================

      case 'try': {
        // Try/catch/finally: ["try", tryBlock, catchClause?, finallyBlock?]
        // Catch clause is [param, catchBlock] or [null, catchBlock]

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

      case 'throw': {
        // Throw statement: ["throw", expression]
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

        return `throw ${this.generate(expr, 'value')}`;
      }

      case 'switch': {
        // Switch statement: ["switch", discriminant, whens, defaultCase]
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

      case 'when': {
        // When clause (handled by switch, shouldn't appear standalone)
        throw new Error('when clause should be handled by switch');
      }

      //=====================================================================
      // COMPREHENSIONS
      //=====================================================================

      case 'comprehension': {
        // Array comprehension: ["comprehension", expr, iterators, guards]
        const [expr, iterators, guards] = rest;

        // OPTIMIZATION: If in statement context, generate plain loop (result unused)
        if (context === 'statement') {
          return this.generateComprehensionAsLoop(expr, iterators, guards);
        }

        // Value context: Generate IIFE that builds and returns array
        // Check if expression contains await - if so, make IIFE async
        const hasAwait = this.containsAwait(expr);
        const asyncPrefix = hasAwait ? 'async ' : '';

        // Generate IIFE that builds array
        let code = `(${asyncPrefix}() => {\n`;
        this.indentLevel++;
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
              code += this.indent() + `if (!${objCode}.hasOwnProperty(${keyVarPattern})) continue;\n`;
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
              code += this.indent() + `result.push(${this.generate(stmt, 'value')});\n`;
            }
          }
        } else {
          // Single expression - use the helper to check for control flow
          if (hasControlFlow(expr)) {
            // Has control flow - just execute as statement (don't push)
            code += this.indent() + this.generate(expr, 'statement') + ';\n';
          } else {
            // Normal expression - push it
            code += this.indent() + `result.push(${this.generate(expr, 'value')});\n`;
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
        code += this.indent() + '})()';

        return code;
      }

      case 'object-comprehension': {
        // Object comprehension: ["object-comprehension", keyExpr, valueExpr, iterators, guards]
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
              code += this.indent() + `if (!${iterableCode}.hasOwnProperty(${keyVar})) continue;\n`;
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

      //=====================================================================
      // CLASSES
      //=====================================================================

      case 'class': {
        // Class: ["class", name, parent, body]
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

      case 'super': {
        // Super call/access: ["super", ...args]
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
        const argsCode = rest.map(arg => this.generate(arg, 'value')).join(', ');

        // If we're in a method (not constructor) and super is called with args,
        // it's calling the parent's method: super() → super.methodName()
        if (this.currentMethodName && this.currentMethodName !== 'constructor') {
          return `super.${this.currentMethodName}(${argsCode})`;
        }

        // In constructor or standalone: super(args)
        return `super(${argsCode})`;
      }

      case '?call': {
        // Soak call (CoffeeScript style): ["?call", fn, ...args]
        // Pattern: fn?(arg) → (typeof fn === 'function' ? fn(arg) : undefined)
        const [fn, ...args] = rest;
        const fnCode = this.generate(fn, 'value');
        const argsCode = args.map(arg => this.generate(arg, 'value')).join(', ');
        return `(typeof ${fnCode} === 'function' ? ${fnCode}(${argsCode}) : undefined)`;
      }

      case '?super': {
        // Soak super call: ["?super", ...args]
        // In methods: super?() → typeof super.method === 'function' ? super.method() : undefined
        const argsCode = rest.map(arg => this.generate(arg, 'value')).join(', ');

        if (this.currentMethodName && this.currentMethodName !== 'constructor') {
          // In a method - check if parent method exists
          return `(typeof super.${this.currentMethodName} === 'function' ? super.${this.currentMethodName}(${argsCode}) : undefined)`;
        }

        // In constructor or standalone - can't really soak super
        return `super(${argsCode})`;
      }

      //=====================================================================
      // ASYNC/GENERATORS
      //=====================================================================

      case 'await': {
        // Await expression: ["await", expression]
        const [expr] = rest;
        return `await ${this.generate(expr, 'value')}`;
      }

      case 'yield': {
        // Yield expression: ["yield"] or ["yield", expression]
        if (rest.length === 0) {
          return 'yield';
        }
        const [expr] = rest;
        return `yield ${this.generate(expr, 'value')}`;
      }

      case 'yield-from': {
        // Generator delegation: ["yield-from", expression]
        // Compiles to: yield* expression
        const [expr] = rest;
        return `yield* ${this.generate(expr, 'value')}`;
      }

      //=====================================================================
      // MODULES
      //=====================================================================

      case 'import': {
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

      case 'export': {
        // Export statement: ["export", declaration]
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

      case 'export-default': {
        // Export default: ["export-default", expression]
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

      case 'export-all': {
        // Export all: ["export-all", source]
        const [source] = rest;
        const fixedSource = this.addJsExtensionAndAssertions(source);
        return `export * from ${fixedSource}`;
      }

      case 'export-from': {
        // Export from: ["export-from", specifiers, source]
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

      //=====================================================================
      // SPECIAL
      //=====================================================================

      case 'do-iife': {
        // Do expression (IIFE): ["do-iife", arrowFn]
        const [arrowFn] = rest;
        // Generate the arrow function (in statement context to avoid double-wrapping)
        // then wrap it ourselves for the IIFE
        const fnCode = this.generate(arrowFn, 'statement');
        return `(${fnCode})()`;
      }

      case 'regex': {
        // Regex literal: just pass through
        // Parser emits regex as string with slashes
        if (rest.length === 0) {
          // Simple regex from REGEX token
          return head; // Shouldn't happen, but fallback
        }
        const [pattern] = rest;
        return this.generate(pattern, 'value');
      }

      case 'tagged-template': {
        // Tagged template literal: ["tagged-template", tag, string]
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

      case 'str': {
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
                console.warn('[RIP] Unexpected quoted primitive in str interpolation:', part);
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

      //=====================================================================
      // FUNCTION CALLS
      //=====================================================================

      // If we get here with an array, it might be a function call
      // Function calls: [callee, ...args] where callee is identifier or expression
      default: {
        // Check if this looks like a function call
        // (array where first element is not a known operator/keyword)
        if (typeof head === 'string' && !head.startsWith('"') && !head.startsWith("'")) {
          // Check if it's a number literal (would start with digit or -)
          const isNumberLiteral = /^-?\d/.test(head);
          if (isNumberLiteral) {
            // It's a number literal, not a function call - just return it
            return head;
          }

          // Special case: super() in a method → super.methodName()
          if (head === 'super' && this.currentMethodName && this.currentMethodName !== 'constructor') {
            const args = rest.map(arg => this.generate(arg, 'value')).join(', ');
            return `super.${this.currentMethodName}(${args})`;
          }

          // Helper: find postfix unless/if in an expression tree
          const findPostfixConditional = (expr) => {
            if (!Array.isArray(expr)) return null;
            const head = expr[0];

            // Direct postfix unless/if (length 3, no else clause)
            if ((head === 'unless' || head === 'if') && expr.length === 3) {
              return {type: head, condition: expr[1], value: expr[2]};
            }

            // Recursively check binary operations
            if (head === '+' || head === '-' || head === '*' || head === '/') {
              for (let i = 1; i < expr.length; i++) {
                const found = findPostfixConditional(expr[i]);
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
          };

          // Check if any argument has postfix unless/if (including nested in binary ops)
          // Pattern: f(val unless cond) → if (!cond) f(val)
          // Pattern: f(x + val unless cond) → if (!cond) f(x + val)
          if (context === 'statement' && rest.length === 1) {
            const conditional = findPostfixConditional(rest[0]);
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
          const args = rest.map(arg => this.generate(arg, 'value')).join(', ');
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
          // Helper: find postfix unless/if in an expression tree (same as above)
          const findPostfixConditional = (expr) => {
            if (!Array.isArray(expr)) return null;
            const head = expr[0];

            // Direct postfix unless/if (length 3, no else clause)
            if ((head === 'unless' || head === 'if') && expr.length === 3) {
              return {type: head, condition: expr[1], value: expr[2]};
            }

            // Recursively check binary operations
            if (head === '+' || head === '-' || head === '*' || head === '/') {
              for (let i = 1; i < expr.length; i++) {
                const found = findPostfixConditional(expr[i]);
                if (found) {
                  found.parentOp = head;
                  found.operandIndex = i;
                  found.otherOperands = expr.slice(1).filter((_, idx) => idx !== i - 1);
                  return found;
                }
              }
            }

            return null;
          };

          // Check if any argument has postfix unless/if (including nested)
          // Pattern: obj.method(val unless cond) → if (!cond) obj.method(val)
          // Pattern: obj.method(x + val unless cond) → if (!cond) obj.method(x + val)
          if (context === 'statement' && rest.length === 1) {
            const conditional = findPostfixConditional(rest[0]);
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
            const isNumberLiteral = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(objCode);
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

          const args = rest.map(arg => this.generate(arg, 'value')).join(', ');
          const callStr = `${calleeCode}(${args})`;

          return needsAwait ? `await ${callStr}` : callStr;
        }

        throw new Error(`Unknown s-expression type: ${head}`);
      }
    }
  }

  /**
   * Generate program (top-level)
   * Pattern: ["program", ...statements]
   */
  generateProgram(statements) {
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
          // Control flow statements (if, for, while, switch, try) ending with } don't need semicolons
          const controlFlowStatements = ['if', 'unless', 'for-in', 'for-of', 'while', 'until', 'loop', 'switch', 'try'];
          const isControlFlow = controlFlowStatements.includes(head);

          if (!isControlFlow || !generated.endsWith('}')) {
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
      code += imports.map(stmt => this.generate(stmt, 'statement') + ';').join('\n');
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

    // 4. Space between generated header and body
    if (needsBlankLine) {
      code += '\n';
    }

    // 5. Add statements
    code += statementsCode;

    // 6. Generate exports last (after all code)
    if (exports.length > 0) {
      code += '\n' + exports.map(stmt => this.generate(stmt, 'statement') + ';').join('\n');
    }

    return code;
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

    // No expansion - normal processing
    this.expansionAfterParams = null;
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
    // 2. Function/method parameters (already declared in signature)
    const newVars = new Set([...bodyVars].filter(v =>
      !this.programVars.has(v) && !paramNames.has(v)
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
            code += this.indent() + stmtCode + ';\n';
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
            code += this.indent() + stmtCode + ';\n';
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
          return this.indent() + this.generate(stmt, 'statement') + ';';
        });
      });
      return `{\n${stmts.join('\n')}\n${this.indent()}}`;
    }

    return `{ ${this.generate(body, 'statement')}; }`;
  }

  generateLoopBodyWithGuard(body, guard) {
    // Wrap body in if (guard) { body }
    // IMPORTANT: Everything in loop bodies is in statement context (loops don't have implicit returns)
    if (!Array.isArray(body)) {
      return `{ if (${this.generate(guard, 'value')}) ${this.generate(body, 'statement')}; }`;
    }

    if (body[0] === 'block' || Array.isArray(body[0])) {
      // Unwrap block or array of statements
      const statements = body[0] === 'block' ? body.slice(1) : body;

      // Generate guard condition without extra parens for simple comparisons
      let guardCondition = this.generate(guard, 'value');
      if (guardCondition.startsWith('(') && guardCondition.endsWith(')') &&
          !guardCondition.includes('(', 1)) {
        guardCondition = guardCondition.slice(1, -1);
      }

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
   * Helper: Format array of statements with indentation
   */
  formatStatements(statements, context = 'statement') {
    return statements.map(s =>
      this.indent() + this.generate(s, context) + ';'
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
          code += this.indent() + `if (!${objCode}.hasOwnProperty(${keyVar})) continue;\n`;
          code += this.indent() + this.generate(expr, 'statement') + ';\n';
        } else if (own && valueVar && guards?.length) {
          // Own + valueVar + guards: nest properly
          code += this.indent() + `if (${objCode}.hasOwnProperty(${keyVar})) {\n`;
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
          code += this.indent() + `if (${objCode}.hasOwnProperty(${keyVar})) {\n`;
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
    let code = `if (${this.generate(condition, 'value')}) `;
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
   */
  generateSwitchAsIfChain(whens, defaultCase, context) {
    let code = '';
    for (let i = 0; i < whens.length; i++) {
      const whenClause = whens[i];
      const [, test, body] = whenClause;
      const bodyExpr = this.extractExpression(body);

      if (i === 0) {
        code += `if (${this.generate(test, 'value')}) {\n`;
      } else {
        code += ` else if (${this.generate(test, 'value')}) {\n`;
      }
      this.indentLevel++;
      code += this.indent() + `return ${bodyExpr};\n`;
      this.indentLevel--;
      code += this.indent() + '}';
    }

    if (defaultCase) {
      code += ' else {\n';
      this.indentLevel++;
      const defaultExpr = this.extractExpression(defaultCase);
      code += this.indent() + `return ${defaultExpr};\n`;
      this.indentLevel--;
      code += this.indent() + '}';
    }

    // In value context, wrap in IIFE
    if (context === 'value') {
      return `(() => { ${code} })()`;
    }
    return code;
  }
}

/**
 * Convenience function for direct compilation
 */
export function generate(sexpr, options = {}) {
  const generator = new CodeGenerator(options);
  return generator.compile(sexpr);
}
