// Component System — Fine-grained reactive components for Rip
//
// Architecture: installComponentSupport(CodeGenerator) adds methods to the
// CodeGenerator prototype, enabling component compilation. A separate
// getComponentRuntime() emits runtime helpers only when components are used.
//
// Naming: All render-tree generators use generate* (consistent with compiler).

import { TEMPLATE_TAGS } from './tags.js';

// ============================================================================
// Constants
// ============================================================================

const BIND_PREFIX = '__bind_';
const BIND_SUFFIX = '__';

const LIFECYCLE_HOOKS = new Set(['beforeMount', 'mounted', 'updated', 'beforeUnmount', 'unmounted']);

// ============================================================================
// Standalone Utilities
// ============================================================================

/**
 * Extract input type from attribute pairs for smart binding (valueAsNumber for number/range)
 * @param {Array} pairs - Array of [key, value] pairs from object expression
 * @returns {string|null} - The input type value or null
 */
function extractInputType(pairs) {
  for (const pair of pairs) {
    if (!Array.isArray(pair)) continue;
    const key = pair[0] instanceof String ? pair[0].valueOf() : pair[0];
    const val = pair[1] instanceof String ? pair[1].valueOf() : pair[1];
    if (key === 'type' && typeof val === 'string') {
      return val.replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

/**
 * Extract member name from s-expression target.
 * Handles both [".", "this", name] (@property) and plain string.
 */
function getMemberName(target) {
  if (typeof target === 'string') return target;
  if (Array.isArray(target) && target[0] === '.' && target[1] === 'this' && typeof target[2] === 'string') {
    return target[2];
  }
  return null;
}

// ============================================================================
// Prototype Installation
// ============================================================================

export function installComponentSupport(CodeGenerator) {
  const proto = CodeGenerator.prototype;

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Localize variable references for block factories.
   * Converts this._elN to _elN and this.x to ctx.x.
   */
  proto.localizeVar = function(line) {
    let result = line.replace(/this\.(_el\d+|_t\d+|_anchor\d+|_frag\d+|_slot\d+|_c\d+|_inst\d+|_empty\d+)/g, '$1');
    result = result.replace(/\bthis\./g, 'ctx.');
    return result;
  };

  /**
   * Check if name is an HTML/SVG tag
   */
  proto.isHtmlTag = function(name) {
    const tagPart = name.split('#')[0];
    return TEMPLATE_TAGS.has(tagPart.toLowerCase());
  };

  /**
   * Check if name is a component (PascalCase)
   */
  proto.isComponent = function(name) {
    if (!name || typeof name !== 'string') return false;
    return /^[A-Z]/.test(name);
  };

  /**
   * Collect tag name and static classes from dot-chain s-expression.
   * e.g. [".", [".", "div", "card"], "active"] → { tag: "div", classes: ["card", "active"] }
   */
  proto.collectTemplateClasses = function(sexpr) {
    const classes = [];
    let current = sexpr;
    while (this.is(current, '.')) {
      const prop = current[2];
      if (typeof prop === 'string' || prop instanceof String) {
        classes.unshift(prop.valueOf());
      }
      current = current[1];
    }
    let raw = typeof current === 'string' ? current : (current instanceof String ? current.valueOf() : 'div');
    // Split tag#id — e.g. "div#content" → tag: "div", id: "content"
    let [tag, id] = raw.split('#');
    if (!tag) tag = 'div';  // bare #id → div
    return { tag, classes, id };
  };

  // ==========================================================================
  // Member Transformation
  // ==========================================================================

  /**
   * Recursively transform s-expression to replace member identifiers with this.X.value.
   * For component context where state variables are signals.
   */
  proto.transformComponentMembers = function(sexpr) {
    if (!Array.isArray(sexpr)) {
      if (typeof sexpr === 'string' && this.reactiveMembers && this.reactiveMembers.has(sexpr)) {
        return ['.', ['.', 'this', sexpr], 'value'];
      }
      if (typeof sexpr === 'string' && this.componentMembers && this.componentMembers.has(sexpr)) {
        return ['.', 'this', sexpr];
      }
      return sexpr;
    }

    // Special case: (. this memberName) for @member syntax
    if (sexpr[0] === '.' && sexpr[1] === 'this' && typeof sexpr[2] === 'string') {
      const memberName = sexpr[2];
      if (this.reactiveMembers && this.reactiveMembers.has(memberName)) {
        return ['.', sexpr, 'value'];  // this.X → this.X.value
      }
      return sexpr;
    }

    // Dot access: transform the object but not the property name
    if (sexpr[0] === '.') {
      return ['.', this.transformComponentMembers(sexpr[1]), sexpr[2]];
    }

    // Force thin arrows to fat arrows inside components to preserve this binding
    if (sexpr[0] === '->') {
      return ['=>', ...sexpr.slice(1).map(item => this.transformComponentMembers(item))];
    }

    return sexpr.map(item => this.transformComponentMembers(item));
  };

  // ==========================================================================
  // Component Generation (entry points)
  // ==========================================================================

  /**
   * Generate component: produces an anonymous ES6 class expression.
   * Pattern: ["component", null, ["block", ...statements]]
   */
  proto.generateComponent = function(head, rest, context, sexpr) {
    const [, body] = rest;

    this.usesTemplates = true;
    this.usesReactivity = true;

    // Extract component body statements
    const statements = this.is(body, 'block') ? body.slice(1) : [];

    // Categorize statements
    const stateVars = [];
    const derivedVars = [];
    const readonlyVars = [];
    const methods = [];
    const lifecycleHooks = [];
    const effects = [];
    let renderBlock = null;

    const memberNames = new Set();
    const reactiveMembers = new Set();

    for (const stmt of statements) {
      if (!Array.isArray(stmt)) continue;
      const [op] = stmt;

      if (op === 'state') {
        const varName = getMemberName(stmt[1]);
        if (varName) {
          stateVars.push({ name: varName, value: stmt[2] });
          memberNames.add(varName);
          reactiveMembers.add(varName);
        }
      } else if (op === 'computed') {
        const varName = getMemberName(stmt[1]);
        if (varName) {
          derivedVars.push({ name: varName, expr: stmt[2] });
          memberNames.add(varName);
          reactiveMembers.add(varName);
        }
      } else if (op === 'readonly') {
        const varName = getMemberName(stmt[1]);
        if (varName) {
          readonlyVars.push({ name: varName, value: stmt[2] });
          memberNames.add(varName);
        }
      } else if (op === '=') {
        const varName = getMemberName(stmt[1]);
        if (varName) {
          if (LIFECYCLE_HOOKS.has(varName)) {
            lifecycleHooks.push({ name: varName, value: stmt[2] });
          } else {
            const val = stmt[2];
            if (Array.isArray(val) && (val[0] === '->' || val[0] === '=>')) {
              methods.push({ name: varName, func: val });
              memberNames.add(varName);
            } else {
              stateVars.push({ name: varName, value: val });
              memberNames.add(varName);
              reactiveMembers.add(varName);
            }
          }
        }
      } else if (op === 'effect') {
        effects.push(stmt);
      } else if (op === 'render') {
        renderBlock = stmt;
      } else if (op === 'object') {
        for (let i = 1; i < stmt.length; i++) {
          const pair = stmt[i];
          if (!Array.isArray(pair)) continue;
          const [methodName, funcDef] = pair;
          if (typeof methodName === 'string' && LIFECYCLE_HOOKS.has(methodName)) {
            lifecycleHooks.push({ name: methodName, value: funcDef });
          } else if (typeof methodName === 'string') {
            methods.push({ name: methodName, func: funcDef });
            memberNames.add(methodName);
          }
        }
      }
    }

    // Save and set component context
    const prevComponentMembers = this.componentMembers;
    const prevReactiveMembers = this.reactiveMembers;
    this.componentMembers = memberNames;
    this.reactiveMembers = reactiveMembers;

    const lines = [];
    let blockFactoriesCode = '';

    lines.push('class extends __Component {');

    // --- Init (called by __Component constructor) ---
    lines.push('  _init(props) {');

    // Constants (readonly)
    for (const { name, value } of readonlyVars) {
      const val = this.generateInComponent(value, 'value');
      lines.push(`    this.${name} = props.${name} ?? ${val};`);
    }

    // State variables (__state handles signal passthrough)
    for (const { name, value } of stateVars) {
      const val = this.generateInComponent(value, 'value');
      lines.push(`    this.${name} = __state(props.${name} ?? ${val});`);
    }

    // Computed (derived)
    for (const { name, expr } of derivedVars) {
      const val = this.generateInComponent(expr, 'value');
      lines.push(`    this.${name} = __computed(() => ${val});`);
    }

    // Effects
    for (const effect of effects) {
      const effectBody = effect[2];
      const effectCode = this.generateInComponent(effectBody, 'value');
      lines.push(`    __effect(() => { ${effectCode}; });`);
    }

    lines.push('  }');

    // --- Methods ---
    for (const { name, func } of methods) {
      if (Array.isArray(func) && (func[0] === '->' || func[0] === '=>')) {
        const [, params, methodBody] = func;
        const paramStr = Array.isArray(params) ? params.map(p => this.formatParam(p)).join(', ') : '';
        const bodyCode = this.generateInComponent(methodBody, 'value');
        lines.push(`  ${name}(${paramStr}) { return ${bodyCode}; }`);
      }
    }

    // --- Lifecycle hooks ---
    for (const { name, value } of lifecycleHooks) {
      if (Array.isArray(value) && (value[0] === '->' || value[0] === '=>')) {
        const [, , hookBody] = value;
        const bodyCode = this.generateInComponent(hookBody, 'value');
        lines.push(`  ${name}() { return ${bodyCode}; }`);
      }
    }

    // --- Render block (fine-grained) ---
    if (renderBlock) {
      const renderBody = renderBlock[1];
      const result = this.buildRender(renderBody);

      if (result.blockFactories.length > 0) {
        blockFactoriesCode = result.blockFactories.join('\n\n') + '\n\n';
      }

      lines.push('  _create() {');
      for (const line of result.createLines) {
        lines.push(`    ${line}`);
      }
      lines.push(`    return ${result.rootVar};`);
      lines.push('  }');

      if (result.setupLines.length > 0) {
        lines.push('  _setup() {');
        for (const line of result.setupLines) {
          lines.push(`    ${line}`);
        }
        lines.push('  }');
      }
    }

    lines.push('}');

    // Restore context
    this.componentMembers = prevComponentMembers;
    this.reactiveMembers = prevReactiveMembers;

    // If block factories exist, wrap in IIFE so they're in scope
    if (blockFactoriesCode) {
      return `(() => {\n${blockFactoriesCode}return ${lines.join('\n')};\n})()`;
    }

    return lines.join('\n');
  };

  /**
   * Generate code inside component context (transforms member access to this.X.value)
   */
  proto.generateInComponent = function(sexpr, context) {
    if (typeof sexpr === 'string' && this.reactiveMembers && this.reactiveMembers.has(sexpr)) {
      return `this.${sexpr}.value`;
    }
    if (typeof sexpr === 'string' && this.componentMembers && this.componentMembers.has(sexpr)) {
      return `this.${sexpr}`;
    }
    if (Array.isArray(sexpr) && this.reactiveMembers) {
      const transformed = this.transformComponentMembers(sexpr);
      return this.generate(transformed, context);
    }
    return this.generate(sexpr, context);
  };

  /**
   * Handle standalone render (outside component): error
   */
  proto.generateRender = function(head, rest, context, sexpr) {
    throw new Error('render blocks can only be used inside a component');
  };

  // ==========================================================================
  // Render Tree Emission
  // ==========================================================================

  /**
   * Build the fine-grained render output: create lines, setup lines, block factories.
   * Entry point for processing an entire render block.
   */
  proto.buildRender = function(body) {
    this._elementCount = 0;
    this._textCount = 0;
    this._blockCount = 0;
    this._createLines = [];
    this._setupLines = [];
    this._blockFactories = [];

    const statements = this.is(body, 'block') ? body.slice(1) : [body];

    let rootVar;
    if (statements.length === 0) {
      rootVar = 'null';
    } else if (statements.length === 1) {
      rootVar = this.generateNode(statements[0]);
    } else {
      rootVar = this.newElementVar('frag');
      this._createLines.push(`${rootVar} = document.createDocumentFragment();`);
      for (const stmt of statements) {
        const childVar = this.generateNode(stmt);
        this._createLines.push(`${rootVar}.appendChild(${childVar});`);
      }
    }

    return {
      createLines: this._createLines,
      setupLines: this._setupLines,
      blockFactories: this._blockFactories,
      rootVar
    };
  };

  /** Generate a unique block factory name */
  proto.newBlockVar = function() {
    return `create_block_${this._blockCount++}`;
  };

  /** Generate a unique element variable name */
  proto.newElementVar = function(hint = 'el') {
    return `this._${hint}${this._elementCount++}`;
  };

  /** Generate a unique text node variable name */
  proto.newTextVar = function() {
    return `this._t${this._textCount++}`;
  };

  // --------------------------------------------------------------------------
  // generateNode — main dispatch for all render tree nodes
  // --------------------------------------------------------------------------

  proto.generateNode = function(sexpr) {
    // String literal → text node (handle both primitive and String objects)
    if (typeof sexpr === 'string' || sexpr instanceof String) {
      const str = sexpr.valueOf();
      if (str.startsWith('"') || str.startsWith("'") || str.startsWith('`')) {
        const textVar = this.newTextVar();
        this._createLines.push(`${textVar} = document.createTextNode(${str});`);
        return textVar;
      }
      // Dynamic text binding (reactive member)
      if (this.reactiveMembers && this.reactiveMembers.has(str)) {
        const textVar = this.newTextVar();
        this._createLines.push(`${textVar} = document.createTextNode('');`);
        this._setupLines.push(`__effect(() => { ${textVar}.data = this.${str}.value; });`);
        return textVar;
      }
      // Static tag without content (possibly with #id)
      const [tagStr, idStr] = str.split('#');
      const elVar = this.newElementVar();
      this._createLines.push(`${elVar} = document.createElement('${tagStr || 'div'}');`);
      if (idStr) this._createLines.push(`${elVar}.id = '${idStr}';`);
      return elVar;
    }

    if (!Array.isArray(sexpr)) {
      const commentVar = this.newElementVar('c');
      this._createLines.push(`${commentVar} = document.createComment('unknown');`);
      return commentVar;
    }

    const [head, ...rest] = sexpr;
    const headStr = typeof head === 'string' ? head : (head instanceof String ? head.valueOf() : null);

    // Component instantiation (PascalCase)
    if (headStr && this.isComponent(headStr)) {
      return this.generateChildComponent(headStr, rest);
    }

    // HTML tag (possibly with #id, e.g. div#content)
    if (headStr && this.isHtmlTag(headStr)) {
      let [tagName, id] = headStr.split('#');
      return this.generateTag(tagName || 'div', [], rest, id);
    }

    // Property chain (div.class or item.name)
    if (headStr === '.') {
      const [, obj, prop] = sexpr;

      // Property access on this (e.g., @prop, @children)
      if (obj === 'this' && typeof prop === 'string') {
        if (this.reactiveMembers && this.reactiveMembers.has(prop)) {
          const textVar = this.newTextVar();
          this._createLines.push(`${textVar} = document.createTextNode('');`);
          this._setupLines.push(`__effect(() => { ${textVar}.data = this.${prop}.value; });`);
          return textVar;
        }
        // Slot/prop — handle DOM nodes (children) and plain values
        const slotVar = this.newElementVar('slot');
        this._createLines.push(`${slotVar} = this.${prop} instanceof Node ? this.${prop} : (this.${prop} != null ? document.createTextNode(String(this.${prop})) : document.createComment(''));`);
        return slotVar;
      }

      // HTML tag with classes (div.class) and optional #id
      const { tag, classes, id } = this.collectTemplateClasses(sexpr);
      if (tag && this.isHtmlTag(tag)) {
        return this.generateTag(tag, classes, [], id);
      }

      // General property access (e.g., item.name in a loop)
      const textVar = this.newTextVar();
      const exprCode = this.generateInComponent(sexpr, 'value');
      this._createLines.push(`${textVar} = document.createTextNode(String(${exprCode}));`);
      return textVar;
    }

    // Call expression: (tag.class args...) or ((tag.class) args...)
    if (Array.isArray(head)) {
      // Nested dynamic class call: (((. div __clsx) "classes") children)
      if (Array.isArray(head[0]) && head[0][0] === '.' &&
          (head[0][2] === '__clsx' || (head[0][2] instanceof String && head[0][2].valueOf() === '__clsx'))) {
        const tag = typeof head[0][1] === 'string' ? head[0][1] : head[0][1].valueOf();
        const classExprs = head.slice(1);
        return this.generateDynamicTag(tag, classExprs, rest);
      }

      const { tag, classes, id } = this.collectTemplateClasses(head);
      if (tag && this.isHtmlTag(tag)) {
        // Dynamic class syntax: div.("classes") → (. div __clsx) "classes"
        if (classes.length === 1 && classes[0] === '__clsx') {
          return this.generateDynamicTag(tag, rest, []);
        }
        return this.generateTag(tag, classes, rest, id);
      }
    }

    // Arrow function (children block)
    if (headStr === '->' || headStr === '=>') {
      return this.generateTemplateBlock(rest[1]);
    }

    // Conditional: if/else
    if (headStr === 'if') {
      return this.generateConditional(sexpr);
    }

    // For loop
    if (headStr === 'for' || headStr === 'for-in' || headStr === 'for-of' || headStr === 'for-as') {
      return this.generateTemplateLoop(sexpr);
    }

    // General expression (computed value, function call, binary op, etc.)
    const textVar = this.newTextVar();
    const exprCode = this.generateInComponent(sexpr, 'value');
    if (this.hasReactiveDeps(sexpr)) {
      this._createLines.push(`${textVar} = document.createTextNode('');`);
      this._setupLines.push(`__effect(() => { ${textVar}.data = ${exprCode}; });`);
    } else {
      this._createLines.push(`${textVar} = document.createTextNode(String(${exprCode}));`);
    }
    return textVar;
  };

  // --------------------------------------------------------------------------
  // generateTag — HTML element with static classes and children
  // --------------------------------------------------------------------------

  proto.generateTag = function(tag, classes, args, id) {
    const elVar = this.newElementVar();
    this._createLines.push(`${elVar} = document.createElement('${tag}');`);

    if (id) {
      this._createLines.push(`${elVar}.id = '${id}';`);
    }
    if (classes.length > 0) {
      this._createLines.push(`${elVar}.className = '${classes.join(' ')}';`);
    }

    for (const arg of args) {
      // Arrow function = children
      if (Array.isArray(arg) && (arg[0] === '->' || arg[0] === '=>')) {
        const block = arg[2];
        if (this.is(block, 'block')) {
          for (const child of block.slice(1)) {
            const childVar = this.generateNode(child);
            this._createLines.push(`${elVar}.appendChild(${childVar});`);
          }
        } else if (block) {
          const childVar = this.generateNode(block);
          this._createLines.push(`${elVar}.appendChild(${childVar});`);
        }
      }
      // Object = attributes/events
      else if (this.is(arg, 'object')) {
        this.generateAttributes(elVar, arg);
      }
      // String = text child
      else if (typeof arg === 'string') {
        const textVar = this.newTextVar();
        if (arg.startsWith('"') || arg.startsWith("'") || arg.startsWith('`')) {
          this._createLines.push(`${textVar} = document.createTextNode(${arg});`);
        } else if (this.reactiveMembers && this.reactiveMembers.has(arg)) {
          this._createLines.push(`${textVar} = document.createTextNode('');`);
          this._setupLines.push(`__effect(() => { ${textVar}.data = this.${arg}.value; });`);
        } else if (this.componentMembers && this.componentMembers.has(arg)) {
          this._createLines.push(`${textVar} = document.createTextNode(String(this.${arg}));`);
        } else {
          this._createLines.push(`${textVar} = document.createTextNode(String(${arg}));`);
        }
        this._createLines.push(`${elVar}.appendChild(${textVar});`);
      }
      // String object (from parser)
      else if (arg instanceof String) {
        const val = arg.valueOf();
        const textVar = this.newTextVar();
        if (val.startsWith('"') || val.startsWith("'") || val.startsWith('`')) {
          this._createLines.push(`${textVar} = document.createTextNode(${val});`);
        } else if (this.reactiveMembers && this.reactiveMembers.has(val)) {
          this._createLines.push(`${textVar} = document.createTextNode('');`);
          this._setupLines.push(`__effect(() => { ${textVar}.data = this.${val}.value; });`);
        } else {
          this._createLines.push(`${textVar} = document.createTextNode(String(${val}));`);
        }
        this._createLines.push(`${elVar}.appendChild(${textVar});`);
      }
      // Other = nested element
      else if (arg) {
        const childVar = this.generateNode(arg);
        this._createLines.push(`${elVar}.appendChild(${childVar});`);
      }
    }

    return elVar;
  };

  // --------------------------------------------------------------------------
  // generateDynamicTag — tag with .() CLSX dynamic classes
  // --------------------------------------------------------------------------

  proto.generateDynamicTag = function(tag, classExprs, children) {
    const elVar = this.newElementVar();
    this._createLines.push(`${elVar} = document.createElement('${tag}');`);

    if (classExprs.length > 0) {
      const classArgs = classExprs.map(e => this.generateInComponent(e, 'value')).join(', ');
      const hasReactive = classExprs.some(e => this.hasReactiveDeps(e));
      if (hasReactive) {
        this._setupLines.push(`__effect(() => { ${elVar}.className = __clsx(${classArgs}); });`);
      } else {
        this._createLines.push(`${elVar}.className = __clsx(${classArgs});`);
      }
    }

    for (const arg of children) {
      const argHead = Array.isArray(arg) ? (arg[0] instanceof String ? arg[0].valueOf() : arg[0]) : null;
      if (argHead === '->' || argHead === '=>') {
        const block = arg[2];
        const blockHead = Array.isArray(block) ? (block[0] instanceof String ? block[0].valueOf() : block[0]) : null;
        if (blockHead === 'block') {
          for (const child of block.slice(1)) {
            const childVar = this.generateNode(child);
            this._createLines.push(`${elVar}.appendChild(${childVar});`);
          }
        } else if (block) {
          const childVar = this.generateNode(block);
          this._createLines.push(`${elVar}.appendChild(${childVar});`);
        }
      }
      else if (this.is(arg, 'object')) {
        this.generateAttributes(elVar, arg);
      }
      else if (typeof arg === 'string' || arg instanceof String) {
        const textVar = this.newTextVar();
        const argStr = arg.valueOf();
        if (argStr.startsWith('"') || argStr.startsWith("'") || argStr.startsWith('`')) {
          this._createLines.push(`${textVar} = document.createTextNode(${argStr});`);
        } else if (this.reactiveMembers && this.reactiveMembers.has(argStr)) {
          this._createLines.push(`${textVar} = document.createTextNode('');`);
          this._setupLines.push(`__effect(() => { ${textVar}.data = this.${argStr}.value; });`);
        } else {
          this._createLines.push(`${textVar} = document.createTextNode(${this.generateInComponent(arg, 'value')});`);
        }
        this._createLines.push(`${elVar}.appendChild(${textVar});`);
      }
      else {
        const childVar = this.generateNode(arg);
        this._createLines.push(`${elVar}.appendChild(${childVar});`);
      }
    }

    return elVar;
  };

  // --------------------------------------------------------------------------
  // generateAttributes — attributes, events, and bindings on an element
  // --------------------------------------------------------------------------

  proto.generateAttributes = function(elVar, objExpr) {
    const inputType = extractInputType(objExpr.slice(1));

    for (let i = 1; i < objExpr.length; i++) {
      let [key, value] = objExpr[i];

      // Event handler: @click or (. this eventName)
      if (this.is(key, '.') && key[1] === 'this') {
        const eventName = key[2];
        // Bind method references to this
        if (typeof value === 'string' && this.componentMembers?.has(value)) {
          this._createLines.push(`${elVar}.addEventListener('${eventName}', (e) => this.${value}(e));`);
        } else {
          const handlerCode = this.generateInComponent(value, 'value');
          this._createLines.push(`${elVar}.addEventListener('${eventName}', (e) => (${handlerCode})(e));`);
        }
        continue;
      }

      // Regular attribute
      if (typeof key === 'string') {
        // Strip quotes from string keys (e.g., "data-slot" → data-slot)
        if (key.startsWith('"') && key.endsWith('"')) {
          key = key.slice(1, -1);
        }

        // Two-way binding: __bind_value__ pattern
        if (key.startsWith(BIND_PREFIX) && key.endsWith(BIND_SUFFIX)) {
          const prop = key.slice(BIND_PREFIX.length, -BIND_SUFFIX.length);
          const valueCode = this.generateInComponent(value, 'value');

          let event, valueAccessor;
          if (prop === 'checked') {
            event = 'change';
            valueAccessor = 'e.target.checked';
          } else {
            event = 'input';
            valueAccessor = (inputType === 'number' || inputType === 'range')
              ? 'e.target.valueAsNumber' : 'e.target.value';
          }

          this._setupLines.push(`__effect(() => { ${elVar}.${prop} = ${valueCode}; });`);
          this._createLines.push(`${elVar}.addEventListener('${event}', (e) => ${valueCode} = ${valueAccessor});`);
          continue;
        }

        const valueCode = this.generateInComponent(value, 'value');

        // Smart two-way binding for value/checked when bound to reactive state
        if ((key === 'value' || key === 'checked') && this.hasReactiveDeps(value)) {
          // Reactive effect: signal → DOM property
          this._setupLines.push(`__effect(() => { ${elVar}.${key} = ${valueCode}; });`);
          // Event listener: DOM → signal (two-way)
          const event = key === 'checked' ? 'change' : 'input';
          const accessor = key === 'checked' ? 'e.target.checked'
            : (inputType === 'number' || inputType === 'range') ? 'e.target.valueAsNumber'
            : 'e.target.value';
          this._createLines.push(`${elVar}.addEventListener('${event}', (e) => { ${valueCode} = ${accessor}; });`);
          continue;
        }

        if (this.hasReactiveDeps(value)) {
          this._setupLines.push(`__effect(() => { ${elVar}.setAttribute('${key}', ${valueCode}); });`);
        } else {
          this._createLines.push(`${elVar}.setAttribute('${key}', ${valueCode});`);
        }
      }
    }
  };

  // --------------------------------------------------------------------------
  // generateTemplateBlock — a block of template children
  // --------------------------------------------------------------------------

  proto.generateTemplateBlock = function(body) {
    if (!Array.isArray(body) || body[0] !== 'block') {
      return this.generateNode(body);
    }

    const statements = body.slice(1);
    if (statements.length === 0) {
      const commentVar = this.newElementVar('empty');
      this._createLines.push(`${commentVar} = document.createComment('');`);
      return commentVar;
    }
    if (statements.length === 1) {
      return this.generateNode(statements[0]);
    }

    const fragVar = this.newElementVar('frag');
    this._createLines.push(`${fragVar} = document.createDocumentFragment();`);
    for (const stmt of statements) {
      const childVar = this.generateNode(stmt);
      this._createLines.push(`${fragVar}.appendChild(${childVar});`);
    }
    return fragVar;
  };

  // --------------------------------------------------------------------------
  // generateConditional — reactive if/else using block factories
  // --------------------------------------------------------------------------

  proto.generateConditional = function(sexpr) {
    const [, condition, thenBlock, elseBlock] = sexpr;

    const anchorVar = this.newElementVar('anchor');
    this._createLines.push(`${anchorVar} = document.createComment('if');`);

    const condCode = this.generateInComponent(condition, 'value');

    const thenBlockName = this.newBlockVar();
    this.generateConditionBranch(thenBlockName, thenBlock);

    let elseBlockName = null;
    if (elseBlock) {
      elseBlockName = this.newBlockVar();
      this.generateConditionBranch(elseBlockName, elseBlock);
    }

    const setupLines = [];
    setupLines.push(`// Conditional: ${thenBlockName}${elseBlockName ? ' / ' + elseBlockName : ''}`);
    setupLines.push(`{`);
    setupLines.push(`  const anchor = ${anchorVar};`);
    setupLines.push(`  let currentBlock = null;`);
    setupLines.push(`  let showing = null;`);
    setupLines.push(`  __effect(() => {`);
    setupLines.push(`    const show = !!(${condCode});`);
    setupLines.push(`    const want = show ? 'then' : ${elseBlock ? "'else'" : 'null'};`);
    setupLines.push(`    if (want === showing) return;`);
    setupLines.push(``);
    setupLines.push(`    if (currentBlock) {`);
    setupLines.push(`      currentBlock.d(true);`);
    setupLines.push(`      currentBlock = null;`);
    setupLines.push(`    }`);
    setupLines.push(`    showing = want;`);
    setupLines.push(``);
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

    this._setupLines.push(setupLines.join('\n    '));

    return anchorVar;
  };

  // --------------------------------------------------------------------------
  // generateConditionBranch — block factory for a conditional branch
  // --------------------------------------------------------------------------

  proto.generateConditionBranch = function(blockName, block) {
    const savedCreateLines = this._createLines;
    const savedSetupLines = this._setupLines;

    this._createLines = [];
    this._setupLines = [];

    const rootVar = this.generateTemplateBlock(block);
    const createLines = this._createLines;
    const setupLines = this._setupLines;

    this._createLines = savedCreateLines;
    this._setupLines = savedSetupLines;

    const localizeVar = (line) => this.localizeVar(line);

    const factoryLines = [];
    factoryLines.push(`function ${blockName}(ctx) {`);

    // Declare local variables
    const localVars = new Set();
    for (const line of createLines) {
      const match = line.match(/^this\.(_(?:el|t|anchor|frag|slot|c|inst|empty)\d+)\s*=/);
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

    // p() - update/patch
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

    this._blockFactories.push(factoryLines.join('\n'));
  };

  // --------------------------------------------------------------------------
  // generateTemplateLoop — reactive for-loop with keyed reconciliation
  // --------------------------------------------------------------------------

  proto.generateTemplateLoop = function(sexpr) {
    const [head, vars, collection, guard, step, body] = sexpr;

    const blockName = this.newBlockVar();

    const anchorVar = this.newElementVar('anchor');
    this._createLines.push(`${anchorVar} = document.createComment('for');`);

    const varNames = Array.isArray(vars) ? vars : [vars];
    const itemVar = varNames[0];
    const indexVar = varNames[1] || 'i';

    const collectionCode = this.generateInComponent(collection, 'value');

    // Extract key expression from body if present
    let keyExpr = itemVar;
    if (this.is(body, 'block') && body.length > 1) {
      const firstChild = body[1];
      if (Array.isArray(firstChild)) {
        for (const arg of firstChild) {
          if (this.is(arg, 'object')) {
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
    const savedCreateLines = this._createLines;
    const savedSetupLines = this._setupLines;

    this._createLines = [];
    this._setupLines = [];

    const itemNode = this.generateTemplateBlock(body);
    const itemCreateLines = this._createLines;
    const itemSetupLines = this._setupLines;

    this._createLines = savedCreateLines;
    this._setupLines = savedSetupLines;

    const localizeVar = (line) => this.localizeVar(line);

    // Generate block factory
    const factoryLines = [];
    factoryLines.push(`function ${blockName}(ctx, ${itemVar}, ${indexVar}) {`);

    const localVars = new Set();
    for (const line of itemCreateLines) {
      const match = line.match(/^this\.(_(?:el|t|anchor|frag|slot|c|inst|empty)\d+)\s*=/);
      if (match) localVars.add(match[1]);
    }
    if (localVars.size > 0) {
      factoryLines.push(`  let ${[...localVars].join(', ')};`);
    }

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

    // p() - update
    factoryLines.push(`    p(ctx, ${itemVar}, ${indexVar}) {`);
    if (hasEffects) {
      factoryLines.push(`      disposers.forEach(d => d());`);
      factoryLines.push(`      disposers = [];`);
      for (const line of itemSetupLines) {
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

    this._blockFactories.push(factoryLines.join('\n'));

    // Generate reconciliation code in _setup()
    const setupLines = [];
    setupLines.push(`// Loop: ${blockName}`);
    setupLines.push(`{`);
    setupLines.push(`  const anchor = ${anchorVar};`);
    setupLines.push(`  const map = new Map();`);
    setupLines.push(`  __effect(() => {`);
    setupLines.push(`    const items = ${collectionCode};`);
    setupLines.push(`    const parent = anchor.parentNode;`);
    setupLines.push(`    const newMap = new Map();`);
    setupLines.push(``);
    setupLines.push(`    for (let ${indexVar} = 0; ${indexVar} < items.length; ${indexVar}++) {`);
    setupLines.push(`      const ${itemVar} = items[${indexVar}];`);
    setupLines.push(`      const key = ${keyExpr};`);
    setupLines.push(`      let block = map.get(key);`);
    setupLines.push(`      if (block) {`);
    setupLines.push(`        block.p(this, ${itemVar}, ${indexVar});`);
    setupLines.push(`      } else {`);
    setupLines.push(`        block = ${blockName}(this, ${itemVar}, ${indexVar});`);
    setupLines.push(`        block.c();`);
    setupLines.push(`        block.m(parent, anchor);`);
    setupLines.push(`        block.p(this, ${itemVar}, ${indexVar});`);
    setupLines.push(`      }`);
    setupLines.push(`      newMap.set(key, block);`);
    setupLines.push(`    }`);
    setupLines.push(``);
    setupLines.push(`    for (const [key, block] of map) {`);
    setupLines.push(`      if (!newMap.has(key)) block.d(true);`);
    setupLines.push(`    }`);
    setupLines.push(``);
    setupLines.push(`    map.clear();`);
    setupLines.push(`    for (const [k, v] of newMap) map.set(k, v);`);
    setupLines.push(`  });`);
    setupLines.push(`}`);

    this._setupLines.push(setupLines.join('\n    '));

    return anchorVar;
  };

  // --------------------------------------------------------------------------
  // generateChildComponent — instantiate a child component
  // --------------------------------------------------------------------------

  proto.generateChildComponent = function(componentName, args) {
    const instVar = this.newElementVar('inst');
    const elVar = this.newElementVar('el');
    const { propsCode, childrenSetupLines } = this.buildComponentProps(args);

    this._createLines.push(`${instVar} = new ${componentName}(${propsCode});`);
    this._createLines.push(`${elVar} = ${instVar}._create();`);

    this._setupLines.push(`if (${instVar}._setup) ${instVar}._setup();`);

    for (const line of childrenSetupLines) {
      this._setupLines.push(line);
    }

    return elVar;
  };

  // --------------------------------------------------------------------------
  // buildComponentProps — build props object for component instantiation
  // --------------------------------------------------------------------------

  proto.buildComponentProps = function(args) {
    const props = [];
    let childrenVar = null;
    const childrenSetupLines = [];

    for (const arg of args) {
      if (this.is(arg, 'object')) {
        for (let i = 1; i < arg.length; i++) {
          const [key, value] = arg[i];
          if (typeof key === 'string') {
            const valueCode = this.generateInComponent(value, 'value');
            props.push(`${key}: ${valueCode}`);
          }
        }
      } else if (Array.isArray(arg) && (arg[0] === '->' || arg[0] === '=>')) {
        const block = arg[2];
        if (block) {
          const savedCreateLines = this._createLines;
          const savedSetupLines = this._setupLines;
          this._createLines = [];
          this._setupLines = [];

          childrenVar = this.generateTemplateBlock(block);

          const childCreateLines = this._createLines;
          const childSetupLinesCopy = this._setupLines;

          this._createLines = savedCreateLines;
          this._setupLines = savedSetupLines;

          for (const line of childCreateLines) {
            this._createLines.push(line);
          }
          childrenSetupLines.push(...childSetupLinesCopy);
          props.push(`children: ${childrenVar}`);
        }
      }
    }

    const propsCode = props.length > 0 ? `{ ${props.join(', ')} }` : '{}';
    return { propsCode, childrenSetupLines };
  };

  // --------------------------------------------------------------------------
  // hasReactiveDeps — check if an s-expression references reactive members
  // --------------------------------------------------------------------------

  proto.hasReactiveDeps = function(sexpr) {
    if (!this.reactiveMembers || this.reactiveMembers.size === 0) return false;

    if (typeof sexpr === 'string') {
      return this.reactiveMembers.has(sexpr);
    }

    if (!Array.isArray(sexpr)) return false;

    if (sexpr[0] === '.' && sexpr[1] === 'this' && typeof sexpr[2] === 'string') {
      return this.reactiveMembers.has(sexpr[2]);
    }

    for (const child of sexpr) {
      if (this.hasReactiveDeps(child)) return true;
    }

    return false;
  };

  // ==========================================================================
  // Component Runtime
  // ==========================================================================

  /**
   * Returns runtime code for the component system.
   * Only emitted when `component` keyword is used (this.usesTemplates === true).
   */
  proto.getComponentRuntime = function() {
    return `
// ============================================================================
// Rip Component Runtime
// ============================================================================

let __currentComponent = null;

function __pushComponent(component) {
  component._parent = __currentComponent;
  const prev = __currentComponent;
  __currentComponent = component;
  return prev;
}

function __popComponent(prev) {
  __currentComponent = prev;
}

function setContext(key, value) {
  if (!__currentComponent) throw new Error('setContext must be called during component initialization');
  if (!__currentComponent._context) __currentComponent._context = new Map();
  __currentComponent._context.set(key, value);
}

function getContext(key) {
  let component = __currentComponent;
  while (component) {
    if (component._context && component._context.has(key)) return component._context.get(key);
    component = component._parent;
  }
  return undefined;
}

function hasContext(key) {
  let component = __currentComponent;
  while (component) {
    if (component._context && component._context.has(key)) return true;
    component = component._parent;
  }
  return false;
}

function __clsx(...args) {
  return args.filter(Boolean).join(' ');
}

class __Component {
  constructor(props = {}) {
    Object.assign(this, props);
    const prev = __pushComponent(this);
    this._init(props);
    __popComponent(prev);
  }
  _init() {}
  mount(target) {
    if (typeof target === "string") target = document.querySelector(target);
    this._target = target;
    this._root = this._create();
    target.appendChild(this._root);
    if (this._setup) this._setup();
    if (this.mounted) this.mounted();
    return this;
  }
  unmount() {
    if (this.unmounted) this.unmounted();
    if (this._root && this._root.parentNode) {
      this._root.parentNode.removeChild(this._root);
    }
  }
}

// Register on globalThis for runtime deduplication
if (typeof globalThis !== 'undefined') {
  globalThis.__ripComponent = { __pushComponent, __popComponent, setContext, getContext, hasContext, __clsx, __Component };
}

`;
  };
}
