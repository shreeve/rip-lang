// Component System — Fine-grained reactive components for Rip
//
// Architecture: installComponentSupport(CodeGenerator, Lexer) adds methods to
// both prototypes — render rewriting on the Lexer, component code generation
// on the CodeGenerator. A separate getComponentRuntime() emits runtime helpers
// only when components are used.
//
// Naming: All render-tree generators use generate* (consistent with compiler).

import { TEMPLATE_TAGS, SVG_TAGS } from './tags.js';

// ============================================================================
// Constants
// ============================================================================

const BIND_PREFIX = '__bind_';
const BIND_SUFFIX = '__';

const LIFECYCLE_HOOKS = new Set(['beforeMount', 'mounted', 'updated', 'beforeUnmount', 'unmounted']);
const BOOLEAN_ATTRS = new Set([
  'disabled', 'hidden', 'readonly', 'required', 'checked', 'selected',
  'autofocus', 'autoplay', 'controls', 'loop', 'muted', 'multiple',
  'novalidate', 'open', 'reversed', 'defer', 'async', 'formnovalidate',
  'allowfullscreen', 'inert',
]);

const SVG_NS = 'http://www.w3.org/2000/svg';

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

/**
 * Check if target uses @property syntax (public prop).
 * [".", "this", name] = @prop (public), plain string = private.
 */
function isPublicProp(target) {
  return Array.isArray(target) && target[0] === '.' && target[1] === 'this';
}

/**
 * Detect fragment root and collect direct child variables for proper removal.
 * After insertBefore, a DocumentFragment is empty — .remove() is a no-op.
 * Callers must remove each child element individually.
 */
function getFragChildren(rootVar, createLines, localizeVar) {
  const root = localizeVar(rootVar);
  if (!/_frag\d+$/.test(root)) return null;
  const children = [];
  const re = new RegExp(`^${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.appendChild\\(([^)]+)\\);`);
  for (const line of createLines) {
    const m = localizeVar(line).match(re);
    if (m) children.push(m[1]);
  }
  return children.length > 0 ? children : null;
}

// ============================================================================
// Prototype Installation
// ============================================================================

export function installComponentSupport(CodeGenerator, Lexer) {

  // ==========================================================================
  // Lexer: Render block rewriter
  // ==========================================================================
  // Transforms template syntax inside render blocks:
  //   - Implicit div for class-only selectors: .card → div.card
  //   - Combine #id selectors: div # main → div#main
  //   - Two-way binding: value <=> username → __bind_value__: username
  //   - Event modifiers: @click.prevent: → [@click.prevent]:
  //   - Dynamic classes: div.('card', x && 'active') → div.__clsx(...)
  //   - Implicit nesting: inject -> before INDENT for template elements
  //   - Hyphenated attributes: data-foo: "x" → "data-foo": "x"
  // ==========================================================================

  Lexer.prototype.rewriteRender = function() {
    let gen = (tag, val, origin) => {
      let t = [tag, val];
      t.pre = 0;
      t.data = null;
      t.loc = origin?.loc ?? {r: 0, c: 0, n: 0};
      t.spaced = false;
      t.newLine = false;
      t.generated = true;
      if (origin) t.origin = origin;
      return t;
    };

    let inRender = false;
    let renderIndentLevel = 0;
    let currentIndent = 0;
    let pendingCallEnds = [];

    let isHtmlTag = (name) => {
      let tagPart = name.split('#')[0];
      return TEMPLATE_TAGS.has(tagPart);
    };

    let isComponent = (name) => {
      if (!name || typeof name !== 'string') return false;
      return /^[A-Z]/.test(name);
    };

    let isTemplateTag = (name) => {
      return isHtmlTag(name) || isComponent(name);
    };

    let startsWithTag = (tokens, i) => {
      let j = i;
      while (j > 0) {
        let pt = tokens[j - 1][0];
        if (pt === 'TERMINATOR' || pt === 'RENDER') {
          break;
        }
        if (pt === 'INDENT' || pt === 'OUTDENT') {
          let jt = tokens[j][0];
          if (jt === 'CALL_END' || jt === ')') {
            let open = jt === 'CALL_END' ? 'CALL_START' : '(';
            let depth = 1;
            let k = j - 1;
            while (k >= 0 && depth > 0) {
              let kt = tokens[k][0];
              if (kt === jt) depth++;
              else if (kt === open) depth--;
              if (depth > 0) k--;
            }
            j = k;
            continue;
          }
          break;
        }
        if (pt === 'CALL_END' || pt === ')') {
          let open = pt === 'CALL_END' ? 'CALL_START' : '(';
          let depth = 1;
          let k = j - 2;
          while (k >= 0 && depth > 0) {
            let kt = tokens[k][0];
            if (kt === 'CALL_END' || kt === ')') depth++;
            else if (kt === 'CALL_START' || kt === '(') depth--;
            if (depth > 0) k--;
          }
          j = k;
          continue;
        }
        j--;
      }
      return tokens[j] && tokens[j][0] === 'IDENTIFIER' && isTemplateTag(tokens[j][1]);
    };

    this.scanTokens(function(token, i, tokens) {
      let tag = token[0];
      let nextToken = i < tokens.length - 1 ? tokens[i + 1] : null;

      // Track entering render blocks
      if (tag === 'RENDER') {
        inRender = true;
        renderIndentLevel = currentIndent + 1;
        return 1;
      }

      // Track indentation
      if (tag === 'INDENT') {
        currentIndent++;
        return 1;
      }

      if (tag === 'OUTDENT') {
        currentIndent--;

        // Insert pending CALL_END(s) after this OUTDENT
        let inserted = 0;
        while (pendingCallEnds.length > 0 && pendingCallEnds[pendingCallEnds.length - 1] > currentIndent) {
          let callEndToken = gen('CALL_END', ')', token);
          tokens.splice(i + 1 + inserted, 0, callEndToken);
          pendingCallEnds.pop();
          inserted++;
        }

        // Exit render block when we outdent past where it started
        if (inRender && currentIndent < renderIndentLevel) {
          inRender = false;
        }
        return 1 + inserted;
      }

      // Only process if we're inside a render block
      if (!inRender) return 1;

      // ─────────────────────────────────────────────────────────────────────
      // Hyphenated attributes
      // data-lucide: "search" → "data-lucide": "search"
      // ─────────────────────────────────────────────────────────────────────
      if (tag === 'IDENTIFIER' && !token.spaced) {
        let parts = [token[1]];
        let j = i + 1;
        while (j + 1 < tokens.length) {
          let hyphen = tokens[j];
          let nextPart = tokens[j + 1];
          if (hyphen[0] === '-' && !hyphen.spaced &&
              (nextPart[0] === 'IDENTIFIER' || nextPart[0] === 'PROPERTY')) {
            parts.push(nextPart[1]);
            j += 2;
            if (nextPart[0] === 'PROPERTY') break;
          } else {
            break;
          }
        }
        if (parts.length > 1 && j > i + 1 && tokens[j - 1][0] === 'PROPERTY') {
          token[0] = 'STRING';
          token[1] = `"${parts.join('-')}"`;
          tokens.splice(i + 1, j - i - 1);
          return 1;
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // Implicit div for class-only or bare dot selectors
      // .card → div.card    |  . (with children) → div
      // ─────────────────────────────────────────────────────────────────────
      if (tag === '.') {
        let prevToken = i > 0 ? tokens[i - 1] : null;
        let prevTag = prevToken ? prevToken[0] : null;
        if (prevTag === 'INDENT' || prevTag === 'TERMINATOR') {
          if (nextToken && nextToken[0] === 'PROPERTY') {
            let divToken = gen('IDENTIFIER', 'div', token);
            tokens.splice(i, 0, divToken);
            return 2;
          }
          // Skip .('classes') — handled by dynamic classes handler below
          if (!nextToken || nextToken[0] !== '(') {
            token[0] = 'IDENTIFIER';
            token[1] = 'div';
            return 0;
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // Combine #id selectors
      // div # main → div#main
      // ─────────────────────────────────────────────────────────────────────
      if (tag === 'IDENTIFIER' || tag === 'PROPERTY') {
        let next = tokens[i + 1];
        let nextNext = tokens[i + 2];
        if (next && next[0] === '#' && nextNext && (nextNext[0] === 'PROPERTY' || nextNext[0] === 'IDENTIFIER')) {
          token[1] = token[1] + '#' + nextNext[1];
          if (nextNext.spaced) token.spaced = true;
          tokens.splice(i + 1, 2);
          return 1;
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // Two-way binding
      // value <=> username → __bind_value__: username
      // ─────────────────────────────────────────────────────────────────────
      if (tag === 'BIND') {
        let prevToken = i > 0 ? tokens[i - 1] : null;
        let nextBindToken = tokens[i + 1];
        if (prevToken && (prevToken[0] === 'IDENTIFIER' || prevToken[0] === 'PROPERTY') &&
            nextBindToken && nextBindToken[0] === 'IDENTIFIER') {
          prevToken[1] = `__bind_${prevToken[1]}__`;
          token[0] = ':';
          token[1] = ':';
          return 1;
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // Event modifiers
      // @click.prevent: handler → [@click.prevent]: handler
      // ─────────────────────────────────────────────────────────────────────
      if (tag === '@') {
        let j = i + 1;
        if (j < tokens.length && tokens[j][0] === 'PROPERTY') {
          j++;
          while (j + 1 < tokens.length && tokens[j][0] === '.' && tokens[j + 1][0] === 'PROPERTY') {
            j += 2;
          }
          if (j > i + 2 && j < tokens.length && tokens[j][0] === ':') {
            let openBracket = gen('[', '[', token);
            tokens.splice(i, 0, openBracket);
            let closeBracket = gen(']', ']', tokens[j + 1]);
            tokens.splice(j + 1, 0, closeBracket);
            return 2;
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // Dynamic classes
      // div.('card', x && 'active') → div.__clsx('card', x && 'active')
      // .('card') → div.__clsx('card')
      // ─────────────────────────────────────────────────────────────────────
      if (tag === '.' && nextToken && nextToken[0] === '(') {
        let prevToken = i > 0 ? tokens[i - 1] : null;
        let prevTag = prevToken ? prevToken[0] : null;
        let atLineStart = prevTag === 'INDENT' || prevTag === 'TERMINATOR';

        let cxToken = gen('PROPERTY', '__clsx', token);
        nextToken[0] = 'CALL_START';
        let depth = 1;
        for (let j = i + 2; j < tokens.length && depth > 0; j++) {
          if (tokens[j][0] === '(' || tokens[j][0] === 'CALL_START') depth++;
          else if (tokens[j][0] === ')') {
            depth--;
            if (depth === 0) tokens[j][0] = 'CALL_END';
          } else if (tokens[j][0] === 'CALL_END') depth--;
        }

        if (atLineStart) {
          let divToken = gen('IDENTIFIER', 'div', token);
          tokens.splice(i, 0, divToken);
          tokens.splice(i + 2, 0, cxToken);
          return 3;
        } else if (prevTag === ':') {
          // class: .('active', ...) → class: __clsx('active', ...)
          tokens[i] = gen('IDENTIFIER', '__clsx', token);
          return 1;
        } else {
          tokens.splice(i + 1, 0, cxToken);
          return 2;
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // Implicit nesting (inject -> before INDENT)
      // ─────────────────────────────────────────────────────────────────────
      if (nextToken && nextToken[0] === 'INDENT') {
        if (tag === '->' || tag === '=>' || tag === 'CALL_START' || tag === '(') {
          return 1;
        }

        let isTemplateElement = false;
        let prevTag = i > 0 ? tokens[i - 1][0] : null;
        let isAfterControlFlow = prevTag === 'IF' || prevTag === 'UNLESS' || prevTag === 'WHILE' || prevTag === 'UNTIL' || prevTag === 'WHEN';

        // Detect __clsx CALL_END early — OUTDENT tokens inside multi-line .()
        // args prevent startsWithTag from seeing the template tag, so we check
        // for __clsx ownership first by counting balanced CALL_START/CALL_END.
        let isClsxCallEnd = false;
        if (tag === 'CALL_END') {
          let depth = 1;
          for (let j = i - 1; j >= 0 && depth > 0; j--) {
            if (tokens[j][0] === 'CALL_END') depth++;
            else if (tokens[j][0] === 'CALL_START') {
              depth--;
              if (depth === 0 && j > 0 && tokens[j - 1][0] === 'PROPERTY' && tokens[j - 1][1] === '__clsx') {
                isClsxCallEnd = true;
              }
            }
          }
        }

        if (isClsxCallEnd) {
          isTemplateElement = true;
        } else if (tag === 'IDENTIFIER' && isTemplateTag(token[1]) && !isAfterControlFlow) {
          isTemplateElement = true;
        } else if (tag === 'PROPERTY' || tag === 'STRING' || tag === 'STRING_END' || tag === 'CALL_END' || tag === ')') {
          isTemplateElement = startsWithTag(tokens, i);
        }
        else if (tag === 'IDENTIFIER' && i > 1 && tokens[i - 1][0] === '...') {
          if (startsWithTag(tokens, i)) {
            let commaToken = gen(',', ',', token);
            let arrowToken = gen('->', '->', token);
            arrowToken.newLine = true;
            tokens.splice(i + 1, 0, commaToken, arrowToken);
            return 3;
          }
        }

        if (isTemplateElement) {
          let isClassOrIdTail = tag === 'PROPERTY' && i > 0 && (tokens[i - 1][0] === '.' || tokens[i - 1][0] === '#');

          if (isClsxCallEnd) {
            let callStartToken = gen('CALL_START', '(', token);
            let arrowToken = gen('->', '->', token);
            arrowToken.newLine = true;
            tokens.splice(i + 1, 0, callStartToken, arrowToken);
            pendingCallEnds.push(currentIndent + 1);
            return 3;
          } else if ((tag === 'IDENTIFIER' && isTemplateTag(token[1])) || isClassOrIdTail) {
            // Bare tag or tag.class/tag#id (no other args): inject CALL_START -> and manage CALL_END
            let callStartToken = gen('CALL_START', '(', token);
            let arrowToken = gen('->', '->', token);
            arrowToken.newLine = true;
            tokens.splice(i + 1, 0, callStartToken, arrowToken);
            pendingCallEnds.push(currentIndent + 1);
            return 3;
          } else {
            // Tag with args: inject , -> (call wrapping handled by addImplicitBracesAndParens)
            let commaToken = gen(',', ',', token);
            let arrowToken = gen('->', '->', token);
            arrowToken.newLine = true;
            tokens.splice(i + 1, 0, commaToken, arrowToken);
            return 3;
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // Bare component reference (PascalCase, no children, no args)
      // Counter → Counter() so it gets treated as a component instantiation
      // ─────────────────────────────────────────────────────────────────────
      if (tag === 'IDENTIFIER' && isComponent(token[1]) &&
          nextToken && (nextToken[0] === 'OUTDENT' || nextToken[0] === 'TERMINATOR')) {
        tokens.splice(i + 1, 0, gen('CALL_START', '(', token), gen('CALL_END', ')', token));
        return 3;
      }

      return 1;
    });
  };

  // ==========================================================================
  // CodeGenerator: Component compilation
  // ==========================================================================

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
    result = result.replace(/\bthis\b/g, 'ctx');
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
    let raw = typeof current === 'string' ? current : (current instanceof String ? current.valueOf() : null);
    if (raw === null) return { tag: null, classes, id: undefined };
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

    // Object literals: transform values but leave bare string keys untouched
    if (sexpr[0] === 'object') {
      return ['object', ...sexpr.slice(1).map(pair => {
        if (Array.isArray(pair) && pair.length >= 2) {
          let key = pair[0];
          let newKey = Array.isArray(key) ? this.transformComponentMembers(key) : key;
          let newValue = this.transformComponentMembers(pair[1]);
          return [newKey, newValue, pair[2]];
        }
        return this.transformComponentMembers(pair);
      })];
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
          stateVars.push({ name: varName, value: stmt[2], isPublic: isPublicProp(stmt[1]) });
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
          readonlyVars.push({ name: varName, value: stmt[2], isPublic: isPublicProp(stmt[1]) });
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
              stateVars.push({ name: varName, value: val, isPublic: isPublicProp(stmt[1]) });
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
    for (const { name, value, isPublic } of readonlyVars) {
      const val = this.generateInComponent(value, 'value');
      lines.push(isPublic
        ? `    this.${name} = props.${name} ?? ${val};`
        : `    this.${name} = ${val};`);
    }

    // State variables (__state handles signal passthrough)
    for (const { name, value, isPublic } of stateVars) {
      const val = this.generateInComponent(value, 'value');
      lines.push(isPublic
        ? `    this.${name} = __state(props.${name} ?? ${val});`
        : `    this.${name} = __state(${val});`);
    }

    // Computed (derived)
    for (const { name, expr } of derivedVars) {
      if (this.is(expr, 'block') && expr.length > 2) {
        const transformed = this.transformComponentMembers(expr);
        const body = this.generateFunctionBody(transformed);
        lines.push(`    this.${name} = __computed(() => ${body});`);
      } else {
        const val = this.generateInComponent(expr, 'value');
        lines.push(`    this.${name} = __computed(() => ${val});`);
      }
    }

    // Effects
    for (const effect of effects) {
      const effectBody = effect[2];
      if (this.is(effectBody, 'block') && effectBody.length > 2) {
        const transformed = this.transformComponentMembers(effectBody);
        const body = this.generateFunctionBody(transformed, [], true);
        lines.push(`    __effect(() => ${body});`);
      } else {
        const effectCode = this.generateInComponent(effectBody, 'value');
        lines.push(`    __effect(() => { ${effectCode}; });`);
      }
    }

    lines.push('  }');

    // --- Methods ---
    for (const { name, func } of methods) {
      if (Array.isArray(func) && (func[0] === '->' || func[0] === '=>')) {
        const [, params, methodBody] = func;
        const paramStr = Array.isArray(params) ? params.map(p => this.formatParam(p)).join(', ') : '';
        const transformed = this.reactiveMembers ? this.transformComponentMembers(methodBody) : methodBody;
        const isAsync = this.containsAwait(methodBody);
        const bodyCode = this.generateFunctionBody(transformed, params || []);
        lines.push(`  ${isAsync ? 'async ' : ''}${name}(${paramStr}) ${bodyCode}`);
      }
    }

    // --- Lifecycle hooks ---
    for (const { name, value } of lifecycleHooks) {
      if (Array.isArray(value) && (value[0] === '->' || value[0] === '=>')) {
        const [, , hookBody] = value;
        const transformed = this.reactiveMembers ? this.transformComponentMembers(hookBody) : hookBody;
        const isAsync = this.containsAwait(hookBody);
        const bodyCode = this.generateFunctionBody(transformed, []);
        lines.push(`  ${isAsync ? 'async ' : ''}${name}() ${bodyCode}`);
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
    this._loopVarStack = [];

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
      const actualTag = tagStr || 'div';
      if (SVG_TAGS.has(actualTag) || this._svgDepth > 0) {
        this._createLines.push(`${elVar} = document.createElementNS('${SVG_NS}', '${actualTag}');`);
      } else {
        this._createLines.push(`${elVar} = document.createElement('${actualTag}');`);
      }
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
  // appendChildren — shared child-processing loop for generateTag/generateDynamicTag
  // --------------------------------------------------------------------------

  proto.appendChildren = function(elVar, args) {
    for (const arg of args) {
      if (this.is(arg, '->') || this.is(arg, '=>')) {
        const block = arg[2];
        if (this.is(block, 'block')) {
          for (const child of block.slice(1)) {
            if (this.is(child, 'object')) {
              this.generateAttributes(elVar, child);
            } else {
              const childVar = this.generateNode(child);
              this._createLines.push(`${elVar}.appendChild(${childVar});`);
            }
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
        const val = arg.valueOf();
        if (val.startsWith('"') || val.startsWith("'") || val.startsWith('`')) {
          this._createLines.push(`${textVar} = document.createTextNode(${val});`);
        } else if (this.reactiveMembers && this.reactiveMembers.has(val)) {
          this._createLines.push(`${textVar} = document.createTextNode('');`);
          this._setupLines.push(`__effect(() => { ${textVar}.data = this.${val}.value; });`);
        } else if (this.componentMembers && this.componentMembers.has(val)) {
          this._createLines.push(`${textVar} = document.createTextNode(String(this.${val}));`);
        } else {
          this._createLines.push(`${textVar} = document.createTextNode(${this.generateInComponent(arg, 'value')});`);
        }
        this._createLines.push(`${elVar}.appendChild(${textVar});`);
      }
      else if (arg) {
        const childVar = this.generateNode(arg);
        this._createLines.push(`${elVar}.appendChild(${childVar});`);
      }
    }
  };

  // --------------------------------------------------------------------------
  // generateTag — HTML element with static classes and children
  // --------------------------------------------------------------------------

  proto.generateTag = function(tag, classes, args, id) {
    const elVar = this.newElementVar();
    const isSvg = SVG_TAGS.has(tag) || this._svgDepth > 0;
    if (isSvg) {
      this._createLines.push(`${elVar} = document.createElementNS('${SVG_NS}', '${tag}');`);
    } else {
      this._createLines.push(`${elVar} = document.createElement('${tag}');`);
    }

    if (id) {
      this._createLines.push(`${elVar}.id = '${id}';`);
    }

    // Defer class emission when selector classes exist so class: attributes merge
    const prevClassArgs = this._pendingClassArgs;
    const prevClassEl = this._pendingClassEl;
    if (classes.length > 0) {
      this._pendingClassArgs = [`'${classes.join(' ')}'`];
      this._pendingClassEl = elVar;
    }

    if (tag === 'svg') this._svgDepth = (this._svgDepth || 0) + 1;
    this.appendChildren(elVar, args);
    if (tag === 'svg') this._svgDepth--;

    // Emit final class: if only selector classes (no dynamic additions), set statically
    if (classes.length > 0) {
      if (this._pendingClassArgs.length === 1) {
        if (isSvg) {
          this._createLines.push(`${elVar}.setAttribute('class', '${classes.join(' ')}');`);
        } else {
          this._createLines.push(`${elVar}.className = '${classes.join(' ')}';`);
        }
      } else {
        const combined = this._pendingClassArgs.join(', ');
        if (isSvg) {
          this._setupLines.push(`__effect(() => { ${elVar}.setAttribute('class', __clsx(${combined})); });`);
        } else {
          this._setupLines.push(`__effect(() => { ${elVar}.className = __clsx(${combined}); });`);
        }
      }
      this._pendingClassArgs = prevClassArgs;
      this._pendingClassEl = prevClassEl;
    }

    return elVar;
  };

  // --------------------------------------------------------------------------
  // generateDynamicTag — tag with .() CLSX dynamic classes
  // --------------------------------------------------------------------------

  proto.generateDynamicTag = function(tag, classExprs, children) {
    const elVar = this.newElementVar();
    if (SVG_TAGS.has(tag) || this._svgDepth > 0) {
      this._createLines.push(`${elVar} = document.createElementNS('${SVG_NS}', '${tag}');`);
    } else {
      this._createLines.push(`${elVar} = document.createElement('${tag}');`);
    }

    // Defer className emission so class: attributes can merge with .() classes
    const classArgs = classExprs.map(e => this.generateInComponent(e, 'value'));
    const prevClassArgs = this._pendingClassArgs;
    const prevClassEl = this._pendingClassEl;
    this._pendingClassArgs = classArgs;
    this._pendingClassEl = elVar;

    if (tag === 'svg') this._svgDepth = (this._svgDepth || 0) + 1;
    this.appendChildren(elVar, children);
    if (tag === 'svg') this._svgDepth--;

    if (this._pendingClassArgs.length > 0) {
      const combined = this._pendingClassArgs.join(', ');
      const isSvg = SVG_TAGS.has(tag) || this._svgDepth > 0;
      if (isSvg) {
        this._setupLines.push(`__effect(() => { ${elVar}.setAttribute('class', __clsx(${combined})); });`);
      } else {
        this._setupLines.push(`__effect(() => { ${elVar}.className = __clsx(${combined}); });`);
      }
    }
    this._pendingClassArgs = prevClassArgs;
    this._pendingClassEl = prevClassEl;

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
          this._createLines.push(`${elVar}.addEventListener('${eventName}', (e) => __batch(() => this.${value}(e)));`);
        } else {
          const handlerCode = this.generateInComponent(value, 'value');
          this._createLines.push(`${elVar}.addEventListener('${eventName}', (e) => __batch(() => (${handlerCode})(e)));`);
        }
        continue;
      }

      // Regular attribute
      if (typeof key === 'string') {
        // Strip quotes from string keys (e.g., "data-slot" → data-slot)
        if (key.startsWith('"') && key.endsWith('"')) {
          key = key.slice(1, -1);
        }

        // Class merging: class: values merge with .() dynamic classes
        if (key === 'class' || key === 'className') {
          const valueCode = this.generateInComponent(value, 'value');
          if (this._pendingClassArgs && this._pendingClassEl === elVar) {
            this._pendingClassArgs.push(valueCode);
          } else if (this.hasReactiveDeps(value)) {
            if (this._svgDepth > 0) {
              this._setupLines.push(`__effect(() => { ${elVar}.setAttribute('class', __clsx(${valueCode})); });`);
            } else {
              this._setupLines.push(`__effect(() => { ${elVar}.className = __clsx(${valueCode}); });`);
            }
          } else {
            if (this._svgDepth > 0) {
              this._createLines.push(`${elVar}.setAttribute('class', ${valueCode});`);
            } else {
              this._createLines.push(`${elVar}.className = ${valueCode};`);
            }
          }
          continue;
        }

        // Element ref: ref: "name" → this.name = element
        if (key === 'ref') {
          const refName = String(value).replace(/^["']|["']$/g, '');
          this._createLines.push(`this.${refName} = ${elVar};`);
          continue;
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
          let assignCode = `${valueCode} = ${valueAccessor}`;
          const rootMember = !this.isSimpleAssignable(value) && this.findRootReactiveMember(value);
          if (rootMember) {
            assignCode += `; this.${rootMember}.touch?.()`;
          }
          this._createLines.push(`${elVar}.addEventListener('${event}', (e) => { ${assignCode}; });`);
          continue;
        }

        const valueCode = this.generateInComponent(value, 'value');

        // Smart two-way binding for value/checked when bound to reactive state
        if ((key === 'value' || key === 'checked') && this.hasReactiveDeps(value)) {
          this._setupLines.push(`__effect(() => { ${elVar}.${key} = ${valueCode}; });`);
          // Generate reverse binding for simple assignable targets or nested
          // reactive paths (with touch() for Svelte-style invalidation)
          const rootMemberImplicit = !this.isSimpleAssignable(value) && this.findRootReactiveMember(value);
          if (this.isSimpleAssignable(value) || rootMemberImplicit) {
            const event = key === 'checked' ? 'change' : 'input';
            const accessor = key === 'checked' ? 'e.target.checked'
              : (inputType === 'number' || inputType === 'range') ? 'e.target.valueAsNumber'
              : 'e.target.value';
            let assignCode = `${valueCode} = ${accessor}`;
            if (rootMemberImplicit) {
              assignCode += `; this.${rootMemberImplicit}.touch?.()`;
            }
            this._createLines.push(`${elVar}.addEventListener('${event}', (e) => { ${assignCode}; });`);
          }
          continue;
        }

        if (key === 'innerHTML' || key === 'textContent' || key === 'innerText') {
          if (this.hasReactiveDeps(value)) {
            this._setupLines.push(`__effect(() => { ${elVar}.${key} = ${valueCode}; });`);
          } else {
            this._createLines.push(`${elVar}.${key} = ${valueCode};`);
          }
        } else if (BOOLEAN_ATTRS.has(key)) {
          if (this.hasReactiveDeps(value)) {
            this._setupLines.push(`__effect(() => { ${elVar}.toggleAttribute('${key}', !!${valueCode}); });`);
          } else {
            this._createLines.push(`if (${valueCode}) ${elVar}.setAttribute('${key}', '');`);
          }
        } else if (this.hasReactiveDeps(value)) {
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

    // Collect loop variables from enclosing for-loops
    const loopParams = this._loopVarStack.map(v => `${v.itemVar}, ${v.indexVar}`).join(', ');
    const extraArgs = loopParams ? `, ${loopParams}` : '';

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
    setupLines.push(`      currentBlock = ${thenBlockName}(this${extraArgs});`);
    setupLines.push(`      currentBlock.c();`);
    setupLines.push(`      currentBlock.m(anchor.parentNode, anchor.nextSibling);`);
    setupLines.push(`      currentBlock.p(this${extraArgs});`);
    setupLines.push(`    }`);
    if (elseBlock) {
      setupLines.push(`    if (want === 'else') {`);
      setupLines.push(`      currentBlock = ${elseBlockName}(this${extraArgs});`);
      setupLines.push(`      currentBlock.c();`);
      setupLines.push(`      currentBlock.m(anchor.parentNode, anchor.nextSibling);`);
      setupLines.push(`      currentBlock.p(this${extraArgs});`);
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

    // Include enclosing loop variables in the factory signature
    const loopParams = this._loopVarStack.map(v => `${v.itemVar}, ${v.indexVar}`).join(', ');
    const extraParams = loopParams ? `, ${loopParams}` : '';

    const factoryLines = [];
    factoryLines.push(`function ${blockName}(ctx${extraParams}) {`);

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
    factoryLines.push(`    p(ctx${extraParams}) {`);
    if (hasEffects) {
      factoryLines.push(`      disposers.forEach(d => d());`);
      factoryLines.push(`      disposers = [];`);
      for (const line of setupLines) {
        const localizedLine = localizeVar(line);
        const wrappedLine = localizedLine.replace(
          /__effect\(\(\) => \{/g,
          'disposers.push(__effect(() => {'
        ).replace(
          /\}\);$/gm,
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
    const condFragChildren = getFragChildren(rootVar, createLines, localizeVar);
    if (condFragChildren) {
      for (const child of condFragChildren) {
        factoryLines.push(`      if (detaching) ${child}.remove();`);
      }
    } else {
      factoryLines.push(`      if (detaching) ${localizeVar(rootVar)}.remove();`);
    }
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

    this._loopVarStack.push({ itemVar, indexVar });
    const itemNode = this.generateTemplateBlock(body);
    this._loopVarStack.pop();
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

    // m() - mount (also repositions already-mounted blocks)
    const loopFragChildren = getFragChildren(itemNode, itemCreateLines, localizeVar);
    factoryLines.push(`    m(target, anchor) {`);
    if (loopFragChildren) {
      for (const child of loopFragChildren) {
        factoryLines.push(`      target.insertBefore(${child}, anchor);`);
      }
    } else {
      factoryLines.push(`      target.insertBefore(${localizeVar(itemNode)}, anchor);`);
    }
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
          /\}\);$/gm,
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
    if (loopFragChildren) {
      for (const child of loopFragChildren) {
        factoryLines.push(`      if (detaching) ${child}.remove();`);
      }
    } else {
      factoryLines.push(`      if (detaching) ${localizeVar(itemNode)}.remove();`);
    }
    factoryLines.push(`    }`);

    factoryLines.push(`  };`);
    factoryLines.push(`}`);

    this._blockFactories.push(factoryLines.join('\n'));

    // Generate reconciliation code in _setup()
    const setupLines = [];
    setupLines.push(`// Loop: ${blockName}`);
    setupLines.push(`{`);
    setupLines.push(`  const __anchor = ${anchorVar};`);
    setupLines.push(`  const __map = new Map();`);
    setupLines.push(`  __effect(() => {`);
    setupLines.push(`    const __items = ${collectionCode};`);
    setupLines.push(`    const __parent = __anchor.parentNode;`);
    setupLines.push(`    const __newMap = new Map();`);
    setupLines.push(``);
    setupLines.push(`    for (let ${indexVar} = 0; ${indexVar} < __items.length; ${indexVar}++) {`);
    setupLines.push(`      const ${itemVar} = __items[${indexVar}];`);
    setupLines.push(`      const __key = ${keyExpr};`);
    setupLines.push(`      let __block = __map.get(__key);`);
    setupLines.push(`      if (!__block) {`);
    setupLines.push(`        __block = ${blockName}(this, ${itemVar}, ${indexVar});`);
    setupLines.push(`        __block.c();`);
    setupLines.push(`      }`);
    setupLines.push(`      __block.m(__parent, __anchor);`);
    setupLines.push(`      __block.p(this, ${itemVar}, ${indexVar});`);
    setupLines.push(`      __newMap.set(__key, __block);`);
    setupLines.push(`    }`);
    setupLines.push(``);
    setupLines.push(`    for (const [__k, __b] of __map) {`);
    setupLines.push(`      if (!__newMap.has(__k)) __b.d(true);`);
    setupLines.push(`    }`);
    setupLines.push(``);
    setupLines.push(`    __map.clear();`);
    setupLines.push(`    for (const [__k, __v] of __newMap) __map.set(__k, __v);`);
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
    const { propsCode, reactiveProps, childrenSetupLines } = this.buildComponentProps(args);

    this._createLines.push(`${instVar} = new ${componentName}(${propsCode});`);
    this._createLines.push(`${elVar} = ${instVar}._create();`);
    this._createLines.push(`(this._children || (this._children = [])).push(${instVar});`);

    this._setupLines.push(`if (${instVar}._setup) ${instVar}._setup();`);

    for (const { key, valueCode } of reactiveProps) {
      this._setupLines.push(`__effect(() => { if (${instVar}.${key}) ${instVar}.${key}.value = ${valueCode}; });`);
    }

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
    const reactiveProps = [];
    let childrenVar = null;
    const childrenSetupLines = [];

    for (const arg of args) {
      if (this.is(arg, 'object')) {
        for (let i = 1; i < arg.length; i++) {
          const [key, value] = arg[i];
          if (typeof key === 'string') {
            // Simple reactive identifier — pass signal directly for shared reactivity.
            // Complex expressions — use normal .value unwrapping to compute the value.
            const isSimpleReactive = this.reactiveMembers && (
              (typeof value === 'string' && this.reactiveMembers.has(value)) ||
              (Array.isArray(value) && value[0] === '.' && value[1] === 'this' && typeof value[2] === 'string' && this.reactiveMembers.has(value[2]))
            );
            if (isSimpleReactive) {
              const member = typeof value === 'string' ? value : value[2];
              props.push(`${key}: this.${member}`);
            } else {
              const valueCode = this.generateInComponent(value, 'value');
              props.push(`${key}: ${valueCode}`);
              if (this.hasReactiveDeps(value)) {
                reactiveProps.push({ key, valueCode });
              }
            }
          }
        }
      } else if (Array.isArray(arg) && (arg[0] === '->' || arg[0] === '=>')) {
        let block = arg[2];
        if (block) {
          // Indented attributes: extract object nodes from block as props
          if (this.is(block, 'block')) {
            const domChildren = [];
            for (const child of block.slice(1)) {
              if (this.is(child, 'object')) {
                for (let i = 1; i < child.length; i++) {
                  const [key, value] = child[i];
                  if (typeof key === 'string') {
                    const isSimpleReactive = this.reactiveMembers && (
                      (typeof value === 'string' && this.reactiveMembers.has(value)) ||
                      (Array.isArray(value) && value[0] === '.' && value[1] === 'this' && typeof value[2] === 'string' && this.reactiveMembers.has(value[2]))
                    );
                    if (isSimpleReactive) {
                      const member = typeof value === 'string' ? value : value[2];
                      props.push(`${key}: this.${member}`);
                    } else {
                      const valueCode = this.generateInComponent(value, 'value');
                      props.push(`${key}: ${valueCode}`);
                      if (this.hasReactiveDeps(value)) {
                        reactiveProps.push({ key, valueCode });
                      }
                    }
                  }
                }
              } else {
                domChildren.push(child);
              }
            }
            block = domChildren.length > 0 ? ['block', ...domChildren] : null;
          }

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
    }

    const propsCode = props.length > 0 ? `{ ${props.join(', ')} }` : '{}';
    return { propsCode, reactiveProps, childrenSetupLines };
  };

  // --------------------------------------------------------------------------
  // hasReactiveDeps — check if an s-expression references reactive members
  // --------------------------------------------------------------------------

  proto.hasReactiveDeps = function(sexpr) {
    if (typeof sexpr === 'string') {
      return !!(this.reactiveMembers && this.reactiveMembers.has(sexpr));
    }

    if (!Array.isArray(sexpr)) return false;

    // Direct this.X — check reactive members
    if (sexpr[0] === '.' && sexpr[1] === 'this' && typeof sexpr[2] === 'string') {
      return !!(this.reactiveMembers && this.reactiveMembers.has(sexpr[2]));
    }

    // Property chain through this (e.g., this.router.path, this.app.data.count)
    // Props and members may hold reactive objects with signal-backed getters,
    // so treat deeper this.X.Y chains as potentially reactive. The effect
    // system handles actual tracking at runtime — wrapping a non-reactive
    // chain in __effect just means it runs once with no overhead.
    if (sexpr[0] === '.' && this._rootsAtThis(sexpr[1])) {
      return true;
    }

    for (const child of sexpr) {
      if (this.hasReactiveDeps(child)) return true;
    }

    return false;
  };

  // isSimpleAssignable — check if value is a plain reactive member (assignable target)
  // --------------------------------------------------------------------------

  proto.isSimpleAssignable = function(sexpr) {
    if (typeof sexpr === 'string') {
      return !!(this.reactiveMembers && this.reactiveMembers.has(sexpr));
    }
    if (Array.isArray(sexpr) && sexpr[0] === '.' && sexpr[1] === 'this' && typeof sexpr[2] === 'string') {
      return !!(this.reactiveMembers && this.reactiveMembers.has(sexpr[2]));
    }
    return false;
  };

  // findRootReactiveMember — walk a nested access chain to find the root reactive member
  // e.g. (. ([] history 0) triglycerides) → 'history'
  // --------------------------------------------------------------------------

  proto.findRootReactiveMember = function(sexpr) {
    if (typeof sexpr === 'string') {
      return this.reactiveMembers?.has(sexpr) ? sexpr : null;
    }
    if (!Array.isArray(sexpr)) return null;
    if (sexpr[0] === '.' && sexpr[1] === 'this' && typeof sexpr[2] === 'string') {
      return this.reactiveMembers?.has(sexpr[2]) ? sexpr[2] : null;
    }
    if (sexpr[0] === '.' || sexpr[0] === '[]') {
      return this.findRootReactiveMember(sexpr[1]);
    }
    return null;
  };

  // _rootsAtThis — check if a property-access chain is rooted at 'this'
  // --------------------------------------------------------------------------

  proto._rootsAtThis = function(sexpr) {
    if (typeof sexpr === 'string') return sexpr === 'this';
    if (!Array.isArray(sexpr) || sexpr[0] !== '.') return false;
    return this._rootsAtThis(sexpr[1]);
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
    if (this._children) {
      for (const child of this._children) {
        child.unmount();
      }
    }
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
