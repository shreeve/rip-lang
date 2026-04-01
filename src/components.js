import { DOM_EVENTS } from './generated/dom-events.js';
import { HTML_TAGS, SVG_TAGS, TEMPLATE_TAGS } from './generated/dom-tags.js';

// Component System — Fine-grained reactive components for Rip
//
// Architecture: installComponentSupport(CodeGenerator, Lexer) adds methods to
// both prototypes — render rewriting on the Lexer, component code generation
// on the CodeGenerator. A separate getComponentRuntime() emits runtime helpers
// only when components are used.
//
// Naming: All render-tree generators use generate* (consistent with compiler).

// ============================================================================
// Constants
// ============================================================================

const BIND_PREFIX = '__bind_';
const BIND_SUFFIX = '__';

const LIFECYCLE_HOOKS = new Set(['beforeMount', 'mounted', 'updated', 'beforeUnmount', 'unmounted', 'onError']);
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
    const key = pair[1] instanceof String ? pair[1].valueOf() : pair[1];
    const val = pair[2] instanceof String ? pair[2].valueOf() : pair[2];
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
  if (typeof target === 'string' || target instanceof String) return target.valueOf();
  if (Array.isArray(target) && target[0] === '.' && target[1] === 'this' &&
      (typeof target[2] === 'string' || target[2] instanceof String)) {
    return target[2].valueOf();
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
 * Extract type annotation from s-expression target node.
 * Type annotations are stored as .type on String objects by the type rewriter.
 */
function getMemberType(target) {
  if (target instanceof String && target.type) return target.type;
  if (Array.isArray(target) && target[2] instanceof String && target[2].type) return target[2].type;
  return null;
}

// ============================================================================
// Prototype Installation
// ============================================================================

export function installComponentSupport(CodeGenerator, Lexer) {

  let meta = (node, key) => node instanceof String ? node[key] : undefined;

  // ==========================================================================
  // Lexer: Context-sensitive 'offer'/'accept' (only inside component bodies)
  // ==========================================================================

  const origClassify = Lexer.prototype.classifyKeyword;
  Lexer.prototype.classifyKeyword = function(id, fallback, data) {
    if (id === 'offer' || id === 'accept') {
      let depth = 0;
      for (let i = this.tokens.length - 1; i >= 0; i--) {
        const tag = this.tokens[i][0];
        if (tag === 'OUTDENT') depth++;
        else if (tag === 'INDENT') depth--;
        if (depth < 0 && this.tokens[i - 1]?.[0] === 'COMPONENT') return id.toUpperCase();
      }
      return fallback;
    }
    return origClassify.call(this, id, fallback, data);
  };

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
  //   - Data attribute sigil: $open: true → "data-open": true
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

    let skipBalancedPair = (tokens, from, closer, opener) => {
      let depth = 1;
      let k = from;
      while (k >= 0 && depth > 0) {
        let kt = tokens[k][0];
        if (kt === closer) depth++;
        else if (kt === opener) depth--;
        if (depth > 0) k--;
      }
      return k;
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
            j = skipBalancedPair(tokens, j - 1, jt, jt === 'CALL_END' ? 'CALL_START' : '(');
            continue;
          }
          break;
        }
        if (pt === 'CALL_END' || pt === ')') {
          j = skipBalancedPair(tokens, j - 2, pt, pt === 'CALL_END' ? 'CALL_START' : '(');
          continue;
        }
        if (pt === 'INTERPOLATION_END') {
          j = skipBalancedPair(tokens, j - 2, 'INTERPOLATION_END', 'INTERPOLATION_START');
          continue;
        }
        if (pt === 'STRING_END') {
          j = skipBalancedPair(tokens, j - 2, 'STRING_END', 'STRING_START');
          continue;
        }
        j--;
      }
      return tokens[j] && tokens[j][0] === 'IDENTIFIER' &&
        (isTemplateTag(tokens[j][1]) ||
         (j === 0 || tokens[j - 1][0] === 'INDENT' || tokens[j - 1][0] === 'TERMINATOR' || tokens[j - 1][0] === 'RENDER'));
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
      // Expression output: = expr → synthetic text node __text__(expr)
      // ─────────────────────────────────────────────────────────────────────
      if (tag === '=' && i > 0) {
        let prev = tokens[i - 1][0];
        if (prev === 'TERMINATOR' || prev === 'INDENT' || prev === 'RENDER') {
          const textToken = gen('IDENTIFIER', '__text__', token);
          const callStart = gen('CALL_START', '(', token);
          tokens.splice(i, 1, textToken, callStart);
          this.detectEnd(i + 2,
            (t) => t[0] === 'TERMINATOR' || t[0] === 'OUTDENT',
            (t, j) => tokens.splice(j, 0, gen('CALL_END', ')', t)),
            { returnOnNegativeLevel: true }
          );
          return 2;
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // Transition modifier
      // div ~fade → div __transition__: "fade"
      // ─────────────────────────────────────────────────────────────────────
      if (tag === 'UNARY_MATH' && token[1] === '~' && nextToken && nextToken[0] === 'IDENTIFIER') {
        token[0] = 'PROPERTY';
        token[1] = '__transition__';
        let colonToken = gen(':', ':', token);
        let valueToken = gen('STRING', `"${nextToken[1]}"`, nextToken);
        tokens.splice(i + 1, 1, colonToken, valueToken);
        return 1;
      }

      // ─────────────────────────────────────────────────────────────────────
      // Data attribute sigil
      // $open: true → "data-open": true
      // ─────────────────────────────────────────────────────────────────────
      if (tag === 'PROPERTY' && token[1][0] === '$' && token[1].length > 1) {
        token[0] = 'STRING';
        token[1] = `"data-${token[1].slice(1)}"`;
        return 1;
      }

      // ─────────────────────────────────────────────────────────────────────
      // Hyphenated attributes
      // data-lucide: "search" → "data-lucide": "search"
      // $my-thing: "x" → "data-my-thing": "x"
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
          let joined = parts.join('-');
          if (joined[0] === '$') joined = 'data-' + joined.slice(1);
          token[0] = 'STRING';
          token[1] = `"${joined}"`;
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
            // Check if property is followed by : — if so, it's an attribute
            // (. foo: bar → div foo: bar), not a class (. foo → div.foo)
            let nextNext = i + 2 < tokens.length ? tokens[i + 2] : null;
            if (!nextNext || nextNext[0] !== ':') {
              let divToken = gen('IDENTIFIER', 'div', token);
              tokens.splice(i, 0, divToken);
              return 2;
            }
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
          return 0;
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
        // fromThen INDENTs are inline conditional values (if x then y else z),
        // never template nesting — normalizeLines only creates them for single-line then clauses
        if (nextToken.fromThen) return 1;
        if (tag === '->' || tag === '=>' || tag === 'CALL_START' || tag === '(') {
          return 1;
        }

        let isTemplateElement = false;
        let prevTag = i > 0 ? tokens[i - 1][0] : null;
        let isAfterControlFlow = prevTag === 'IF' || prevTag === 'UNLESS' || prevTag === 'WHILE' || prevTag === 'UNTIL' || prevTag === 'WHEN' ||
                                 prevTag === 'FORIN' || prevTag === 'FOROF' || prevTag === 'FORAS' || prevTag === 'FORASAWAIT' || prevTag === 'BY';

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

        let atLineStart = tag === 'IDENTIFIER' && (prevTag === 'INDENT' || prevTag === 'TERMINATOR' || prevTag === 'RENDER');

        if (isClsxCallEnd) {
          isTemplateElement = true;
        } else if (tag === 'IDENTIFIER' && isTemplateTag(token[1]) && !isAfterControlFlow) {
          isTemplateElement = true;
        } else if (tag === 'IDENTIFIER' && !isAfterControlFlow) {
          isTemplateElement = atLineStart || startsWithTag(tokens, i);
        } else if (tag === 'PROPERTY' || tag === 'STRING' || tag === 'STRING_END' || tag === 'NUMBER' || tag === 'BOOL' || tag === 'CALL_END' || tag === ')' || tag === 'PRESENCE') {
          isTemplateElement = startsWithTag(tokens, i);
        }

        if (isTemplateElement) {
          let isClassOrIdTail = false;
          if (tag === 'PROPERTY' && i > 0 && tokens[i - 1][0] === '.') {
            // Trace backward through the .PROPERTY chain to find its root —
            // only a CSS class tail if the chain starts from a line-starting template tag
            let j = i;
            while (j >= 2 && tokens[j - 1][0] === '.' && tokens[j - 2][0] === 'PROPERTY') j -= 2;
            if (j >= 2 && tokens[j - 1][0] === '.' && tokens[j - 2][0] === 'IDENTIFIER' && isTemplateTag(tokens[j - 2][1])) {
              let before = j >= 3 ? tokens[j - 3][0] : null;
              if (!before || before === 'INDENT' || before === 'OUTDENT' || before === 'TERMINATOR' || before === 'RENDER') {
                isClassOrIdTail = true;
              }
            }
          }
          let isBareTag = isClsxCallEnd || (tag === 'IDENTIFIER' && (isTemplateTag(token[1]) || atLineStart)) || isClassOrIdTail;

          if (isBareTag) {
            let callStartToken = gen('CALL_START', '(', token);
            let arrowToken = gen('->', '->', token);
            arrowToken.newLine = true;
            tokens.splice(i + 1, 0, callStartToken, arrowToken);
            pendingCallEnds.push(currentIndent + 1);
            return 3;
          } else {
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
    if (raw === null) return { tag: null, classes, id: undefined, base: current };
    // Split tag#id — e.g. "div#content" → tag: "div", id: "content"
    let [tag, id] = raw.split('#');
    if (!tag) tag = 'div';  // bare #id → div
    return { tag, classes, id, base: current };
  };

  // ==========================================================================
  // Member Transformation
  // ==========================================================================

  /**
   * Recursively transform s-expression to replace member identifiers with this.X.value.
   * For component context where state variables are signals.
   */
  const _str = (s) => typeof s === 'string' ? s : s instanceof String ? s.valueOf() : null;
  const _transferMeta = (from, to) => {
    if (!(from instanceof String)) return to;
    const s = new String(to);
    if (from.predicate) s.predicate = true;
    if (from.await) s.await = true;
    return (s.predicate || s.await) ? s : to;
  };

  proto.transformComponentMembers = function(sexpr, localScope = new Set()) {
    const self = this._self;
    if (!Array.isArray(sexpr)) {
      const sv = _str(sexpr);
      if (sv && localScope.has(sv)) return sexpr;
      if (sv && this.reactiveMembers && this.reactiveMembers.has(sv)) {
        return ['.', ['.', self, sv], _transferMeta(sexpr, 'value')];
      }
      if (sv && this.componentMembers && this.componentMembers.has(sv)) {
        return ['.', self, _transferMeta(sexpr, sv)];
      }
      return sexpr;
    }

    // Special case: (. this memberName) for @member syntax
    if (sexpr[0] === '.' && sexpr[1] === 'this' && _str(sexpr[2]) != null) {
      const prop = sexpr[2];
      const memberName = _str(prop);
      if (this.reactiveMembers && this.reactiveMembers.has(memberName)) {
        return ['.', ['.', self, memberName], _transferMeta(prop, 'value')];
      }
      return this._factoryMode ? ['.', self, prop] : sexpr;
    }

    // Dot access: transform the object but not the property name
    if (sexpr[0] === '.' || sexpr[0] === '?.') {
      return [sexpr[0], this.transformComponentMembers(sexpr[1]), sexpr[2]];
    }

    // Force thin arrows to fat arrows inside components to preserve this binding
    if (sexpr[0] === '->') {
      const params = sexpr[1];
      const childScope = new Set(localScope);
      if (Array.isArray(params)) {
        for (const p of params) {
          const name = _str(Array.isArray(p) && p[0] === 'default' ? p[1] : p);
          if (name) childScope.add(name);
        }
      }
      return ['=>', sexpr[1], this.transformComponentMembers(sexpr[2], childScope)];
    }

    // Object literals: transform values but leave bare string keys untouched
    if (sexpr[0] === 'object' || sexpr[0] === 'map-literal') {
      return [sexpr[0], ...sexpr.slice(1).map(pair => {
        if (Array.isArray(pair) && pair[0] === '...') {
          return ['...', this.transformComponentMembers(pair[1], localScope)];
        }
        if (Array.isArray(pair) && pair.length >= 2) {
          let key = pair[1];
          let newKey = Array.isArray(key) ? this.transformComponentMembers(key, localScope) : key;
          let newValue = this.transformComponentMembers(pair[2], localScope);
          return [pair[0], newKey, newValue];
        }
        return this.transformComponentMembers(pair, localScope);
      })];
    }

    if (sexpr[0] === 'block' || sexpr[0] === 'program') {
      const scope = new Set(localScope);
      const items = [sexpr[0]];
      for (let i = 1; i < sexpr.length; i++) {
        const item = sexpr[i];
        if (Array.isArray(item) && item[0] === '=') {
          const targetName = _str(item[1]);
          if (targetName && !(this.reactiveMembers && this.reactiveMembers.has(targetName))) {
            items.push(['=', item[1], this.transformComponentMembers(item[2], scope)]);
            scope.add(targetName);
            continue;
          }
        }
        items.push(this.transformComponentMembers(item, scope));
      }
      return items;
    }

    return sexpr.map(item => this.transformComponentMembers(item, localScope));
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

    // Extract component body statements
    const statements = this.is(body, 'block') ? body.slice(1) : [];

    // Categorize statements
    const stateVars = [];
    const derivedVars = [];
    const readonlyVars = [];
    const methods = [];
    const lifecycleHooks = [];
    const effects = [];
    const offeredVars = [];
    const acceptedVars = [];
    let renderBlock = null;

    const memberNames = new Set();
    const reactiveMembers = new Set();

    for (let stmt of statements) {
      if (!Array.isArray(stmt)) continue;
      let [op] = stmt;

      if (op === 'offer') {
        stmt = stmt[1];
        if (!Array.isArray(stmt)) continue;
        op = stmt[0];
        const varName = getMemberName(stmt[1]);
        if (varName) offeredVars.push(varName);
      }

      if (op === 'accept') {
        const varName = typeof stmt[1] === 'string' ? stmt[1] : getMemberName(stmt[1]);
        if (varName) {
          acceptedVars.push(varName);
          memberNames.add(varName);
          reactiveMembers.add(varName);
        }
      } else if (op === '.' && stmt[1] === 'this' && getMemberName(stmt)) {
        // Required prop: (. this name) — no default value
        const varName = (typeof stmt[2] === 'string' || stmt[2] instanceof String) ? stmt[2].valueOf() : null;
        if (varName) {
          stateVars.push({ name: varName, value: undefined, isPublic: true, type: stmt[2]?.type || null, required: true });
          memberNames.add(varName);
          reactiveMembers.add(varName);
        }
      } else if (op === 'state') {
        const varName = getMemberName(stmt[1]);
        if (varName) {
          stateVars.push({ name: varName, value: stmt[2], isPublic: isPublicProp(stmt[1]), type: getMemberType(stmt[1]) });
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
          readonlyVars.push({ name: varName, value: stmt[2], isPublic: isPublicProp(stmt[1]), type: getMemberType(stmt[1]) });
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
          const [, methodName, funcDef] = pair;
          if (typeof methodName === 'string' && LIFECYCLE_HOOKS.has(methodName)) {
            lifecycleHooks.push({ name: methodName, value: funcDef });
          } else if (typeof methodName === 'string') {
            methods.push({ name: methodName, func: funcDef });
            memberNames.add(methodName);
          }
        }
      }
    }

    // Auto-event map: onClick → 'click', onKeydown → 'keydown', etc.
    const autoEventHandlers = new Map();
    for (const { name } of methods) {
      if (/^on[A-Z]/.test(name) && !LIFECYCLE_HOOKS.has(name)) {
        const eventName = name[2].toLowerCase() + name.slice(3);
        if (DOM_EVENTS.has(eventName)) autoEventHandlers.set(eventName, name);
      }
    }

    const inheritsTag = rest[0]?.valueOf?.() ?? null;
    const publicPropNames = new Set();
    for (const { name, isPublic } of stateVars) if (isPublic) publicPropNames.add(name);
    for (const { name, isPublic } of readonlyVars) if (isPublic) publicPropNames.add(name);

    // Save and set component context
    const prevComponentMembers = this.componentMembers;
    const prevReactiveMembers = this.reactiveMembers;
    const prevAutoEventHandlers = this._autoEventHandlers;
    const prevInheritsTag = this._inheritsTag;
    this.componentMembers = memberNames;
    this.reactiveMembers = reactiveMembers;
    this._autoEventHandlers = autoEventHandlers.size > 0 ? autoEventHandlers : null;
    this._inheritsTag = inheritsTag || null;

    // --- Type-check stub: typed member declarations + body expressions, no DOM ---
    if (this.options.stubComponents) {
      // Inline type suffix expansion (mirrors types.js expandSuffixes)
      const expandType = (t) => t ? t.replace(/::/g, ':')
        .replace(/(\w+(?:<[^>]+>)?)\?\?/g, '$1 | null | undefined')
        .replace(/(\w+(?:<[^>]+>)?)\?(?![.:])/g, '$1 | undefined')
        .replace(/(\w+(?:<[^>]+>)?)\!/g, 'NonNullable<$1>') : null;

      const sl = [];
      sl.push('class {');
      sl.push('  declare _root: Element | null;');
      sl.push('  emit(_name: string, _detail?: any): void {}');

      // Constructor — typed props for public state/readonly (matches DTS)
      const propEntries = [];
      for (const { name, type, isPublic, required } of stateVars) {
        if (!isPublic) continue;
        const ts = expandType(type);
        const opt = required ? '' : '?';
        propEntries.push(`${name}${opt}: ${ts || 'any'}`);
        // Two-way binding: allow parent to pass Signal<T> for this prop
        propEntries.push(`__bind_${name}__?: Signal<${ts || 'any'}>`);
      }
      for (const { name, type, isPublic } of readonlyVars) {
        if (!isPublic) continue;
        const ts = expandType(type);
        propEntries.push(`${name}?: ${ts || 'any'}`);
      }
      {
        const hasRequired = propEntries.length > 0 && stateVars.some(v => v.isPublic && v.required);
        const propsOpt = hasRequired ? '' : '?';
        let propsType = propEntries.length > 0 ? `{${propEntries.join('; ')}}` : '{}';
        if (inheritsTag) propsType += ` & __RipProps<'${inheritsTag}'>`;
        sl.push(`  constructor(_props${propsOpt}: ${propsType}) {}`);
      }

      // Infer type from literal initializer when no explicit annotation
      const inferLiteralType = (v) => {
        const s = v?.valueOf?.() ?? v;
        if (typeof s !== 'string') return null;
        if (s === 'true' || s === 'false') return 'boolean';
        if (/^-?\d+(\.\d+)?$/.test(s)) return 'number';
        if (s.startsWith('"') || s.startsWith("'")) return 'string';
        return null;
      };

      // Property declarations (declare avoids definite-assignment errors)
      for (const { name, type, value } of stateVars) {
        const ts = expandType(type) || inferLiteralType(value);
        sl.push(ts ? `  declare ${name}: Signal<${ts}>;` : `  declare ${name}: Signal<any>;`);
      }
      for (const { name, type, value } of readonlyVars) {
        const ts = expandType(type) || inferLiteralType(value);
        sl.push(ts ? `  declare ${name}: ${ts};` : `  declare ${name}: any;`);
      }
      for (const { name, expr } of derivedVars) {
        if (this.is(expr, 'block')) {
          const transformed = this.transformComponentMembers(expr);
          const body = this.generateFunctionBody(transformed);
          sl.push(`  ${name} = __computed(() => ${body});`);
        } else {
          const val = this.generateInComponent(expr, 'value');
          sl.push(`  ${name} = __computed(() => ${val});`);
        }
      }

      // _init body — readonly, state, computed assignments (skip accepted/offered)
      sl.push('  _init(props) {');
      for (const { name, value, isPublic } of readonlyVars) {
        const val = this.generateInComponent(value, 'value');
        sl.push(isPublic ? `    this.${name} = props.${name} ?? ${val};` : `    this.${name} = ${val};`);
      }
      for (const { name, value, isPublic, required, type } of stateVars) {
        if (isPublic && required) {
          sl.push(`    this.${name} = __state(props.__bind_${name}__ ?? props.${name});`);
        } else if (isPublic) {
          const val = this.generateInComponent(value, 'value');
          sl.push(`    this.${name} = __state(props.__bind_${name}__ ?? props.${name} ?? ${val});`);
        } else {
          const val = this.generateInComponent(value, 'value');
          sl.push(`    this.${name} = __state(${val});`);
        }
      }

      for (const effect of effects) {
        const effectBody = effect[2];
        const isAsync = this.containsAwait(effectBody) ? 'async ' : '';
        if (this.is(effectBody, 'block')) {
          const transformed = this.transformComponentMembers(effectBody);
          const body = this.generateFunctionBody(transformed, [], true);
          sl.push(`    __effect(${isAsync}() => ${body});`);
        } else {
          const effectCode = this.generateInComponent(effectBody, 'value');
          sl.push(`    __effect(${isAsync}() => { ${effectCode}; });`);
        }
      }
      sl.push('  }');

      // Pre-scan render block for @event: @method bindings to type method params
      const eventMethodTypes = new Map();
      for (const [eventName, methodName] of autoEventHandlers) {
        eventMethodTypes.set(methodName, eventName);
      }
      if (renderBlock) {
        const scanEvents = (node) => {
          if (!Array.isArray(node)) return;
          const head = node[0]?.valueOf?.() ?? node[0];
          if (typeof head === 'string' && head !== 'object' && head !== 'switch' && TEMPLATE_TAGS.has(head.split(/[.#]/)[0])) {
            for (let i = 1; i < node.length; i++) {
              const arg = node[i];
              let obj = this.is(arg, 'object') ? arg : null;
              if (!obj && Array.isArray(arg) && (arg[0] === '->' || arg[0] === '=>') && this.is(arg[2], 'block')) {
                for (let k = 1; k < arg[2].length; k++) {
                  if (this.is(arg[2][k], 'object')) { obj = arg[2][k]; break; }
                }
              }
              if (!obj) continue;
              for (let j = 1; j < obj.length; j++) {
                const pair = obj[j];
                if (!Array.isArray(pair) || pair.length < 2) continue;
                const [, key, value] = pair;
                if (Array.isArray(key) && key[0] === '.' && key[1] === 'this' &&
                    Array.isArray(value) && value[0] === '.' && value[1] === 'this') {
                  const eventName = typeof key[2] === 'string' ? key[2] : key[2]?.valueOf?.();
                  const methodName = typeof value[2] === 'string' ? value[2] : value[2]?.valueOf?.();
                  if (eventName && methodName && !eventMethodTypes.has(methodName)) {
                    eventMethodTypes.set(methodName, eventName);
                  }
                }
              }
            }
          }
          for (let i = 1; i < node.length; i++) scanEvents(node[i]);
        };
        scanEvents(renderBlock);
      }

      // Methods
      for (const { name, func } of methods) {
        if (Array.isArray(func) && (func[0] === '->' || func[0] === '=>')) {
          let [, params, methodBody] = func;
          if ((!params || (Array.isArray(params) && params.length === 0)) && this.containsIt(methodBody)) params = ['it'];
          let paramStr = Array.isArray(params) ? params.map(p => {
            let base = this.formatParam(p);
            if (p?.type) base += `: ${p.type}`;
            return base;
          }).join(', ') : '';
          // Inject event type on untyped first param when method is bound to an event
          const boundEvent = eventMethodTypes.get(name);
          if (boundEvent && Array.isArray(params) && params.length > 0) {
            const firstParam = params[0];
            const hasType = firstParam?.type || (firstParam instanceof String && firstParam.type);
            if (!hasType && typeof (firstParam?.valueOf?.() ?? firstParam) === 'string') {
              const paramName = firstParam?.valueOf?.() ?? firstParam;
              paramStr = paramStr.replace(paramName, `${paramName}: HTMLElementEventMap['${boundEvent}']`);
            }
          }
          const transformed = this.reactiveMembers ? this.transformComponentMembers(methodBody) : methodBody;
          const isAsync = this.containsAwait(methodBody);
          const bodyCode = this.generateFunctionBody(transformed, params || []);
          sl.push(`  ${isAsync ? 'async ' : ''}${name}(${paramStr}) ${bodyCode}`);
        }
      }

      // Lifecycle hooks
      for (const { name, value } of lifecycleHooks) {
        if (Array.isArray(value) && (value[0] === '->' || value[0] === '=>')) {
          const [, params, hookBody] = value;
          const paramStr = Array.isArray(params) ? params.map(p => this.formatParam(p)).join(', ') : '';
          const transformed = this.reactiveMembers ? this.transformComponentMembers(hookBody) : hookBody;
          const isAsync = this.containsAwait(hookBody);
          const bodyCode = this.generateFunctionBody(transformed, params || []);
          sl.push(`  ${isAsync ? 'async ' : ''}${name}(${paramStr}) ${bodyCode}`);
        }
      }

      // Component instantiations from render block — emit typed variable declarations for prop type checking
      // Using `const _: Props = {...}` instead of `new X({...})` gives TS2322 on specific property names
      if (renderBlock) {
        const constructions = [];
        let constructionIdx = 0;
        const sourceLines = this.options.source?.split('\n');
        const extractProps = (args) => {
          const props = [];
          for (const arg of args) {
            let obj = null;
            if (this.is(arg, 'object')) {
              obj = arg;
            } else if (Array.isArray(arg) && (arg[0] === '->' || arg[0] === '=>') && this.is(arg[2], 'block')) {
              // Multi-line props: (-> (undefined) (block (object ...)))
              for (let k = 1; k < arg[2].length; k++) {
                if (this.is(arg[2][k], 'object')) { obj = arg[2][k]; break; }
              }
            }
            if (obj) {
              for (let j = 1; j < obj.length; j++) {
                const pair = obj[j];
                const [, key, value] = pair;
                if (typeof key === 'string' && !key.startsWith('@')) {
                  const srcLine = pair.loc?.r ?? obj.loc?.r;
                  if (key.startsWith('__bind_') && key.endsWith('__')) {
                    // Two-way binding: emit the Signal object (this.xxx), not this.xxx.value
                    const member = typeof value === 'string' && this.reactiveMembers?.has(value) ? `this.${value}` : this.generateInComponent(value, 'value');
                    props.push({ code: `${key}: ${member}`, srcLine });
                  } else {
                    const val = this.generateInComponent(value, 'value');
                    props.push({ code: `${key}: ${val}`, srcLine });
                  }
                }
              }
            }
          }
          return props;
        };
        const extractIntrinsicProps = (args) => {
          const props = [];
          for (const arg of args) {
            let obj = null;
            if (this.is(arg, 'object')) {
              obj = arg;
            } else if (Array.isArray(arg) && (arg[0] === '->' || arg[0] === '=>') && this.is(arg[2], 'block')) {
              for (let k = 1; k < arg[2].length; k++) {
                if (this.is(arg[2][k], 'object')) { obj = arg[2][k]; break; }
              }
            }
            if (obj) {
              for (let j = 1; j < obj.length; j++) {
                const pair = obj[j];
                if (!Array.isArray(pair) || pair.length < 2) continue;
                const [, key, value] = pair;
                const srcLine = pair.loc?.r ?? obj.loc?.r;
                if (Array.isArray(key) && key[0] === '.' && key[1] === 'this') {
                  let memberName = typeof key[2] === 'string' ? key[2] : key[2]?.valueOf?.();
                  if (!memberName) continue;
                  const eventKey = '@' + memberName.split('.')[0];
                  const val = this.generateInComponent(value, 'value');
                  props.push({ code: `'${eventKey}': ${val}`, srcLine });
                } else if (typeof key === 'string') {
                  if (key === 'key') continue;
                  if (key.startsWith('__bind_') && key.endsWith('__')) {
                    const propName = key.slice(7, -2);
                    const val = this.generateInComponent(value, 'value');
                    props.push({ code: `${propName}: ${val}`, srcLine });
                  } else {
                    const val = this.generateInComponent(value, 'value');
                    props.push({ code: `${key}: ${val}`, srcLine });
                  }
                }
              }
            }
          }
          return props;
        };
        const walkRender = (node) => {
          if (!Array.isArray(node)) return;
          const head = node[0]?.valueOf?.() ?? node[0];

          // Object nodes are property bags (key-value pairs) — their values
          // are code expressions (event handlers, bindings, literals), not
          // render template. extractIntrinsicProps handles them separately.
          // Walking into them would treat function bodies as template content
          // (e.g. `@blur: (e) -> p(e)` would emit `e;` and `__ripEl('p')`).
          if (head === 'object') return;

          // Emit a bare lowercase identifier as either a property access
          // (component member used as text), __ripEl (tag name check when at
          // block level), or a plain variable reference (text child of a tag).
          const emitBareIdent = (child, parentNode, isTextChild) => {
            if (typeof child !== 'string' || !/^[a-z][\w-]*$/.test(child)) return;
            if (CodeGenerator.GENERATORS[child]) return;
            if (child === 'null' || child === 'undefined' || child === 'true' || child === 'false') return;
            let srcLine = parentNode.loc?.r;
            if (srcLine != null && sourceLines) {
              const re = new RegExp(`\\b${child}\\b`);
              for (let ln = srcLine; ln < sourceLines.length; ln++) {
                if (re.test(sourceLines[ln])) { srcLine = ln; break; }
              }
            }
            const srcMarker = srcLine != null ? ` // @rip-src:${srcLine}` : '';
            if (this.componentMembers && this.componentMembers.has(child)) {
              constructions.push(`    this.${child};${srcMarker}`);
            } else if (isTextChild) {
              // Text child of a tag — emit as variable reference so TS
              // reports "Cannot find name 'x'" instead of "not a known element"
              constructions.push(`    ${child};${srcMarker}`);
            } else {
              constructions.push(`    __ripEl('${child}');${srcMarker}`);
            }
          };

          // Bare lowercase identifiers inside a block or as children of tag nodes
          // — emit __ripEl so TS catches tag typos (e.g., slotz for slot), or
          // emit this.prop for component member text references.
          const isTagHead = typeof head === 'string' && /^[a-z][\w-]*$/.test(head) &&
              !CodeGenerator.GENERATORS[head] && TEMPLATE_TAGS.has(head.split(/[.#]/)[0]);
          if (head === 'block') {
            for (let i = 1; i < node.length; i++) emitBareIdent(node[i], node, false);
          } else if (isTagHead) {
            for (let i = 1; i < node.length; i++) emitBareIdent(node[i], node, true);
          }
          for (let i = 1; i < node.length; i++) walkRender(node[i]);
          if (typeof head === 'string' && /^[A-Z]/.test(head)) {
            const props = extractProps(node.slice(1));
            const varName = `_${constructionIdx++}`;
            const propsType = `ConstructorParameters<typeof ${head}>[0] & {}`;
            if (props.length === 0) {
              const tagLine = node.loc?.r;
              constructions.push(`    const ${varName}: ${propsType} = {};` + (tagLine != null ? ` // @rip-src:${tagLine}` : ''));
            } else if (props.length === 1) {
              const srcLine = node.loc?.r ?? props[0].srcLine;
              constructions.push(`    const ${varName}: ${propsType} = {${props[0].code}};` + (srcLine != null ? ` // @rip-src:${srcLine}` : ''));
            } else {
              const tagLine = node.loc?.r;
              const distinctLines = new Set(props.map(p => p.srcLine).filter(l => l != null));
              if (distinctLines.size <= 1) {
                const srcLine = props[0].srcLine ?? tagLine;
                constructions.push(`    const ${varName}: ${propsType} = {${props.map(p => p.code).join(', ')}};` + (srcLine != null ? ` // @rip-src:${srcLine}` : ''));
              } else {
                constructions.push(`    const ${varName}: ${propsType} = {` + (tagLine != null ? ` // @rip-src:${tagLine}` : ''));
                for (const p of props) {
                  constructions.push(`      ${p.code},` + (p.srcLine != null ? ` // @rip-src:${p.srcLine}` : ''));
                }
                constructions.push(`    };`);
              }
            }
          } else if (typeof head === 'string' && !CodeGenerator.GENERATORS[head] && (TEMPLATE_TAGS.has(head.split(/[.#]/)[0]) ||
                     (/^[a-z][\w-]*$/.test(head) && node.length > 1))) {
            const tagName = head.split(/[.#]/)[0];
            const iProps = extractIntrinsicProps(node.slice(1));
            const tagLine = node.loc?.r;
            const srcMarker = tagLine != null ? ` // @rip-src:${tagLine}` : '';
            if (iProps.length === 0) {
              constructions.push(`    __ripEl('${tagName}');${srcMarker}`);
            } else if (iProps.length === 1) {
              const srcLine = iProps[0].srcLine ?? tagLine;
              const marker = srcLine != null ? ` // @rip-src:${srcLine}` : '';
              constructions.push(`    __ripEl('${tagName}', {${iProps[0].code}});${marker}`);
            } else {
              const distinctLines = new Set(iProps.map(p => p.srcLine).filter(l => l != null));
              if (distinctLines.size <= 1) {
                const srcLine = iProps[0].srcLine ?? tagLine;
                const marker = srcLine != null ? ` // @rip-src:${srcLine}` : '';
                constructions.push(`    __ripEl('${tagName}', {${iProps.map(p => p.code).join(', ')}});${marker}`);
              } else {
                constructions.push(`    __ripEl('${tagName}', {${srcMarker}`);
                for (const p of iProps) {
                  constructions.push(`      ${p.code},` + (p.srcLine != null ? ` // @rip-src:${p.srcLine}` : ''));
                }
                constructions.push(`    });`);
              }
            }
          }
        };
        walkRender(renderBlock);
        if (constructions.length > 0) {
          sl.push('  _render() {');
          for (const c of constructions) sl.push(c);
          sl.push('  }');
        }
      }

      sl.push('}');

      this.componentMembers = prevComponentMembers;
      this.reactiveMembers = prevReactiveMembers;
      this._autoEventHandlers = prevAutoEventHandlers;
      this._inheritsTag = prevInheritsTag;
      return sl.join('\n');
    }

    this.usesTemplates = true;
    this.usesReactivity = true;

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

    // Accepted vars (from ancestor context via getContext)
    for (const name of acceptedVars) {
      lines.push(`    this.${name} = getContext('${name}');`);
    }

    // State variables (__state handles signal passthrough)
    for (const { name, value, isPublic, required } of stateVars) {
      if (isPublic && required) {
        lines.push(`    this.${name} = __state(props.__bind_${name}__ ?? props.${name});`);
      } else if (isPublic) {
        const val = this.generateInComponent(value, 'value');
        lines.push(`    this.${name} = __state(props.__bind_${name}__ ?? props.${name} ?? ${val});`);
      } else {
        const val = this.generateInComponent(value, 'value');
        lines.push(`    this.${name} = __state(${val});`);
      }
    }

    if (inheritsTag) {
      lines.push('    this._rest = {};');
      lines.push('    for (const __k in props) {');
      if (publicPropNames.size > 0) {
        const checks = [...publicPropNames].map(name => `__k !== '${name}'`).join(' && ');
        lines.push(`      if (${checks} && !__k.startsWith('__bind_')) this._rest[__k] = props[__k];`);
      } else {
        lines.push("      if (!__k.startsWith('__bind_')) this._rest[__k] = props[__k];");
      }
      lines.push('    }');
    }

    // Computed (derived)
    for (const { name, expr } of derivedVars) {
      if (this.is(expr, 'block')) {
        const transformed = this.transformComponentMembers(expr);
        const body = this.generateFunctionBody(transformed);
        lines.push(`    this.${name} = __computed(() => ${body});`);
      } else {
        const val = this.generateInComponent(expr, 'value');
        lines.push(`    this.${name} = __computed(() => ${val});`);
      }
    }

    // Offered vars (share with descendants via setContext — after all members are initialized)
    for (const name of offeredVars) {
      lines.push(`    setContext('${name}', this.${name});`);
    }

    // Effects
    for (const effect of effects) {
      const effectBody = effect[2];
      const isAsync = this.containsAwait(effectBody) ? 'async ' : '';
      if (this.is(effectBody, 'block')) {
        const transformed = this.transformComponentMembers(effectBody);
        const body = this.generateFunctionBody(transformed, [], true);
        lines.push(`    __effect(${isAsync}() => ${body});`);
      } else {
        const effectCode = this.generateInComponent(effectBody, 'value');
        lines.push(`    __effect(${isAsync}() => { ${effectCode}; });`);
      }
    }

    lines.push('  }');

    if (inheritsTag) {
      lines.push('  _setRestProp(key, value) {');
      lines.push('    if (key.startsWith(\'__bind_\')) return;');
      lines.push('    this._rest || (this._rest = {});');
      lines.push('    if (value == null) delete this._rest[key];');
      lines.push('    else this._rest[key] = value;');
      lines.push('    this._applyInheritedProp(this._inheritedEl, key, value);');
      lines.push('  }');
      lines.push('  _applyRestToInheritedEl() {');
      lines.push('    if (!this._inheritedEl || !this._rest) return;');
      lines.push('    for (const key in this._rest) this._applyInheritedProp(this._inheritedEl, key, this._rest[key]);');
      lines.push('  }');
      lines.push('  _applyInheritedProp(el, key, value) {');
      lines.push('    if (!el || key === \'key\' || key === \'ref\' || key === \'children\' || key.startsWith(\'__bind_\')) return;');
      lines.push('    if (key[0] === \'@\') {');
      lines.push('      const event = key.slice(1).split(\'.\')[0];');
      lines.push('      this._restHandlers || (this._restHandlers = {});');
      lines.push('      const prev = this._restHandlers[key];');
      lines.push('      if (prev) el.removeEventListener(event, prev);');
      lines.push('      if (typeof value === \'function\') {');
      lines.push('        const next = (e) => __batch(() => value(e));');
      lines.push('        this._restHandlers[key] = next;');
      lines.push('        el.addEventListener(event, next);');
      lines.push('      } else {');
      lines.push('        delete this._restHandlers[key];');
      lines.push('      }');
      lines.push('      return;');
      lines.push('    }');
      lines.push('    if (key === \'class\' || key === \'className\') {');
      lines.push('      if (el instanceof SVGElement) el.setAttribute(\'class\', __clsx(value));');
      lines.push('      else el.className = __clsx(value);');
      lines.push('      return;');
      lines.push('    }');
      lines.push('    if (key === \'style\') {');
      lines.push('      if (value == null) { el.removeAttribute(\'style\'); return; }');
      lines.push('      if (typeof value === \'string\') { el.setAttribute(\'style\', value); return; }');
      lines.push('      if (typeof value === \'object\') { Object.assign(el.style, value); return; }');
      lines.push('    }');
      lines.push('    if (key === \'innerHTML\' || key === \'textContent\' || key === \'innerText\') {');
      lines.push('      el[key] = value ?? \'\';');
      lines.push('      return;');
      lines.push('    }');
      lines.push('    if (key in el && !key.includes(\'-\')) {');
      lines.push('      el[key] = value;');
      lines.push('      return;');
      lines.push('    }');
      lines.push('    if (value == null || value === false) {');
      lines.push('      el.removeAttribute(key);');
      lines.push('      return;');
      lines.push('    }');
      lines.push('    if (value === true) {');
      lines.push("      el.setAttribute(key, '');");
      lines.push('      return;');
      lines.push('    }');
      lines.push('    el.setAttribute(key, value);');
      lines.push('  }');
    }

    // --- Methods ---
    for (const { name, func } of methods) {
      if (Array.isArray(func) && (func[0] === '->' || func[0] === '=>')) {
        let [, params, methodBody] = func;
        if ((!params || (Array.isArray(params) && params.length === 0)) && this.containsIt(methodBody)) params = ['it'];
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
        const [, params, hookBody] = value;
        const paramStr = Array.isArray(params) ? params.map(p => this.formatParam(p)).join(', ') : '';
        const transformed = this.reactiveMembers ? this.transformComponentMembers(hookBody) : hookBody;
        const isAsync = this.containsAwait(hookBody);
        const bodyCode = this.generateFunctionBody(transformed, params || []);
        lines.push(`  ${isAsync ? 'async ' : ''}${name}(${paramStr}) ${bodyCode}`);
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
    this._autoEventHandlers = prevAutoEventHandlers;
    this._inheritsTag = prevInheritsTag;

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
      return `${this._self}.${sexpr}.value`;
    }
    if (typeof sexpr === 'string' && this.componentMembers && this.componentMembers.has(sexpr)) {
      return `${this._self}.${sexpr}`;
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

  proto.generateOffer = function(head, rest, context, sexpr) {
    throw new Error('offer can only be used inside a component');
  };

  proto.generateAccept = function(head, rest, context, sexpr) {
    throw new Error('accept can only be used inside a component');
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
    this._factoryMode = false;
    this._factoryVars = null;
    this._fragChildren = new Map();
    this._pendingAutoWire = false;
    this._autoWireEl = null;
    this._autoWireExplicit = null;
    this._inheritsTargetBound = false;

    const statements = this.is(body, 'block') ? body.slice(1) : [body];

    let rootVar;
    if (statements.length === 0) {
      rootVar = 'null';
    } else if (statements.length === 1) {
      this._pendingAutoWire = !!this._autoEventHandlers;
      rootVar = this.generateNode(statements[0]);
      this._pendingAutoWire = false;
    } else {
      rootVar = this.newElementVar('frag');
      this._createLines.push(`${rootVar} = document.createDocumentFragment();`);
      const children = [];
      for (const stmt of statements) {
        const childVar = this.generateNode(stmt);
        this._createLines.push(`${rootVar}.appendChild(${childVar});`);
        children.push(childVar);
      }
      this._fragChildren.set(rootVar, children);
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
    const name = `_${hint}${this._elementCount++}`;
    if (this._factoryVars) this._factoryVars.add(name);
    return this._factoryMode ? name : `this.${name}`;
  };

  /** Generate a unique text node variable name */
  proto.newTextVar = function() {
    const name = `_t${this._textCount++}`;
    if (this._factoryVars) this._factoryVars.add(name);
    return this._factoryMode ? name : `this.${name}`;
  };

  /** Context reference — 'this' in component body, 'ctx' in block factories */
  Object.defineProperty(proto, '_self', {
    get() { return this._factoryMode ? 'ctx' : 'this'; }
  });

  /** Push an effect line, wrapping with disposer tracking in factory mode */
  proto._pushEffect = function(body) {
    if (this._factoryMode) {
      this._setupLines.push(`disposers.push(__effect(() => { ${body} }));`);
    } else {
      this._setupLines.push(`__effect(() => { ${body} });`);
    }
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
        this._pushEffect(`${textVar}.data = ${this._self}.${str}.value;`);
        return textVar;
      }
      // Slot projection — bare <slot> tag → project @children
      if (str === 'slot' && this.componentMembers) {
        const s = this._self;
        const slotVar = this.newElementVar('slot');
        this._createLines.push(`${slotVar} = ${s}.children instanceof Node ? ${s}.children : (${s}.children != null ? document.createTextNode(String(${s}.children)) : document.createComment(''));`);
        return slotVar;
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
      this._bindInheritedTarget(actualTag, elVar);
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

    // Slot projection — replace <slot> with @children in component render
    if (headStr === 'slot' && this.componentMembers) {
      const s = this._self;
      const slotVar = this.newElementVar('slot');
      this._createLines.push(`${slotVar} = ${s}.children instanceof Node ? ${s}.children : (${s}.children != null ? document.createTextNode(String(${s}.children)) : document.createComment(''));`);
      return slotVar;
    }

    // Switch: convert to if/else-if chain for conditional rendering
    if (headStr === 'switch') {
      const disc = rest[0];
      const whens = rest[1] || [];
      const defaultCase = rest[2] || null;
      let chain = defaultCase;
      for (let i = whens.length - 1; i >= 0; i--) {
        const [, tests, body] = whens[i];
        let cond;
        if (disc === null) {
          cond = tests.length === 1 ? tests[0]
            : tests.reduce((a, t) => a ? ['||', a, t] : t, null);
        } else {
          cond = tests.length === 1 ? ['==', disc, tests[0]]
            : tests.map(t => ['==', disc, t]).reduce((a, c) => a ? ['||', a, c] : c, null);
        }
        chain = ['if', cond, body, chain];
      }
      if (chain) {
        if (Array.isArray(chain) && chain[0] === 'if') return this.generateConditional(chain);
        return this.generateTemplateBlock(chain);
      }
      const cv = this.newElementVar('c');
      this._createLines.push(`${cv} = document.createComment('switch');`);
      return cv;
    }

    // HTML tag (possibly with #id, e.g. div#content)
    if (headStr && this.isHtmlTag(headStr) && !meta(head, 'text')) {
      let [tagName, id] = headStr.split('#');
      return this.generateTag(tagName || 'div', [], rest, id);
    }

    // Property chain (div.class or item.name)
    if (headStr === '.') {
      const [, obj, prop] = sexpr;

      // Property access on this (e.g., @prop, @children)
      if (obj === 'this' && typeof prop === 'string') {
        const s = this._self;
        if (this.reactiveMembers && this.reactiveMembers.has(prop)) {
          const textVar = this.newTextVar();
          this._createLines.push(`${textVar} = document.createTextNode('');`);
          this._pushEffect(`${textVar}.data = ${s}.${prop}.value;`);
          return textVar;
        }
        const slotVar = this.newElementVar('slot');
        this._createLines.push(`${slotVar} = ${s}.${prop} instanceof Node ? ${s}.${prop} : (${s}.${prop} != null ? document.createTextNode(String(${s}.${prop})) : document.createComment(''));`);
        return slotVar;
      }

      // HTML tag with classes (div.class) — skip if base is marked .text by = prefix
      const { tag, classes, id, base } = this.collectTemplateClasses(sexpr);
      if (!meta(base, 'text') && tag && this.isHtmlTag(tag)) {
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
      // Also handles combined: (((. (. div step-card) __clsx) "classes") children)
      if (Array.isArray(head[0]) && head[0][0] === '.' &&
          (head[0][2] === '__clsx' || (head[0][2] instanceof String && head[0][2].valueOf() === '__clsx'))) {
        const tagExpr = head[0][1];
        const classExprs = head.slice(1);
        if (Array.isArray(tagExpr)) {
          const { tag, classes, id } = this.collectTemplateClasses(tagExpr);
          if (tag) {
            const staticArgs = classes.map(c => `"${c}"`);
            return this.generateDynamicTag(tag, classExprs, rest, staticArgs, id);
          }
        }
        const tag = typeof tagExpr === 'string' ? tagExpr : tagExpr.valueOf();
        return this.generateDynamicTag(tag, classExprs, rest);
      }

      const { tag, classes, id } = this.collectTemplateClasses(head);
      if (tag && this.isHtmlTag(tag)) {
        // Dynamic class syntax: div.("classes") or div.card.("classes")
        if (classes.length > 0 && classes[classes.length - 1] === '__clsx') {
          const staticClasses = classes.slice(0, -1);
          const staticArgs = staticClasses.map(c => `"${c}"`);
          return this.generateDynamicTag(tag, rest, [], staticArgs, id);
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

    // Synthetic text node inserted by rewriteRender for `= expr`
    if (headStr === '__text__') {
      const expr = rest[0] ?? 'undefined';
      const textVar = this.newTextVar();
      const exprCode = this.generateInComponent(expr, 'value');
      if (this.hasReactiveDeps(expr)) {
        this._createLines.push(`${textVar} = document.createTextNode('');`);
        this._pushEffect(`${textVar}.data = String(${exprCode});`);
      } else {
        this._createLines.push(`${textVar} = document.createTextNode(String(${exprCode}));`);
      }
      return textVar;
    }

    // General expression (computed value, function call, binary op, etc.)
    const textVar = this.newTextVar();
    const exprCode = this.generateInComponent(sexpr, 'value');
    if (this.hasReactiveDeps(sexpr)) {
      this._createLines.push(`${textVar} = document.createTextNode('');`);
      this._pushEffect(`${textVar}.data = ${exprCode};`);
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
        const val = arg.valueOf();
        // Template tag appearing as a string arg (e.g., slot after multi-line attrs)
        const baseName = val.split(/[#.]/)[0];
        if (this.isHtmlTag(baseName || 'div') || this.isComponent(baseName)) {
          const childVar = this.generateNode(arg);
          this._createLines.push(`${elVar}.appendChild(${childVar});`);
        } else {
          const textVar = this.newTextVar();
          if (val.startsWith('"') || val.startsWith("'") || val.startsWith('`')) {
            this._createLines.push(`${textVar} = document.createTextNode(${val});`);
          } else if (this.reactiveMembers && this.reactiveMembers.has(val)) {
            this._createLines.push(`${textVar} = document.createTextNode('');`);
            this._pushEffect(`${textVar}.data = ${this._self}.${val}.value;`);
          } else if (this.componentMembers && this.componentMembers.has(val)) {
            this._createLines.push(`${textVar} = document.createTextNode(String(${this._self}.${val}));`);
          } else {
            this._createLines.push(`${textVar} = document.createTextNode(${this.generateInComponent(arg, 'value')});`);
          }
          this._createLines.push(`${elVar}.appendChild(${textVar});`);
        }
      }
      else if (arg) {
        const childVar = this.generateNode(arg);
        this._createLines.push(`${elVar}.appendChild(${childVar});`);
      }
    }
  };

  // --------------------------------------------------------------------------
  // Auto-wire event handlers — claim/emit helpers for on* convention
  // --------------------------------------------------------------------------

  proto._claimAutoWire = function(elVar) {
    if (!this._pendingAutoWire || !this._autoEventHandlers?.size) return false;
    this._pendingAutoWire = false;
    this._autoWireEl = elVar;
    this._autoWireExplicit = new Set();
    return true;
  };

  proto._emitAutoWire = function(elVar, claimed) {
    if (!claimed) return;
    for (const [eventName, methodName] of this._autoEventHandlers) {
      if (!this._autoWireExplicit.has(eventName)) {
        this._createLines.push(`${elVar}.addEventListener('${eventName}', (e) => __batch(() => ${this._self}.${methodName}(e)));`);
      }
    }
    this._autoWireEl = null;
    this._autoWireExplicit = null;
  };

  proto._bindInheritedTarget = function(tag, elVar) {
    if (!this._inheritsTag || this._factoryMode || this._inheritsTargetBound) return;
    if (tag !== this._inheritsTag) return;
    this._inheritsTargetBound = true;
    this._createLines.push(`this._inheritedEl = ${elVar};`);
    this._createLines.push('this._applyRestToInheritedEl();');
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
    this._bindInheritedTarget(tag, elVar);

    if (this._componentName && this._elementCount === 1 && !this._factoryMode && !this.options.skipDataPart) {
      this._createLines.push(`${elVar}.setAttribute('data-part', '${this._componentName}');`);
    }

    const autoWireClaimed = this._claimAutoWire(elVar);

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
          this._pushEffect(`${elVar}.setAttribute('class', __clsx(${combined}));`);
        } else {
          this._pushEffect(`${elVar}.className = __clsx(${combined});`);
        }
      }
      this._pendingClassArgs = prevClassArgs;
      this._pendingClassEl = prevClassEl;
    }

    this._emitAutoWire(elVar, autoWireClaimed);

    return elVar;
  };

  // --------------------------------------------------------------------------
  // generateDynamicTag — tag with .() CLSX dynamic classes
  // --------------------------------------------------------------------------

  proto.generateDynamicTag = function(tag, classExprs, children, staticClassArgs, id) {
    const elVar = this.newElementVar();
    if (SVG_TAGS.has(tag) || this._svgDepth > 0) {
      this._createLines.push(`${elVar} = document.createElementNS('${SVG_NS}', '${tag}');`);
    } else {
      this._createLines.push(`${elVar} = document.createElement('${tag}');`);
    }
    if (id) this._createLines.push(`${elVar}.id = '${id}';`);
    this._bindInheritedTarget(tag, elVar);

    const autoWireClaimed = this._claimAutoWire(elVar);

    // Defer className emission so class: attributes can merge with .() classes
    const classArgs = [...(staticClassArgs || []), ...classExprs.map(e => this.generateInComponent(e, 'value'))];
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
        this._pushEffect(`${elVar}.setAttribute('class', __clsx(${combined}));`);
      } else {
        this._pushEffect(`${elVar}.className = __clsx(${combined});`);
      }
    }
    this._pendingClassArgs = prevClassArgs;
    this._pendingClassEl = prevClassEl;

    this._emitAutoWire(elVar, autoWireClaimed);

    return elVar;
  };

  // --------------------------------------------------------------------------
  // generateAttributes — attributes, events, and bindings on an element
  // --------------------------------------------------------------------------

  proto.generateAttributes = function(elVar, objExpr) {
    const inputType = extractInputType(objExpr.slice(1));

    for (let i = 1; i < objExpr.length; i++) {
      let [, key, value] = objExpr[i];

      // Event handler: @click or (. this eventName)
      if (this.is(key, '.') && key[1] === 'this') {
        const eventName = key[2];
        if (this._autoWireExplicit && this._autoWireEl === elVar) {
          this._autoWireExplicit.add(eventName);
        }
        if (typeof value === 'string' && this.componentMembers?.has(value)) {
          this._createLines.push(`${elVar}.addEventListener('${eventName}', (e) => __batch(() => ${this._self}.${value}(e)));`);
        } else {
          const handlerCode = this.generateInComponent(value, 'value');
          this._createLines.push(`${elVar}.addEventListener('${eventName}', (e) => __batch(() => (${handlerCode})(e)));`);
        }
        continue;
      }

      // Regular attribute
      if (typeof key === 'string' || key instanceof String) {
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
              this._pushEffect(`${elVar}.setAttribute('class', __clsx(${valueCode}));`);
            } else {
              this._pushEffect(`${elVar}.className = __clsx(${valueCode});`);
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

        // Transition: __transition__: "fade" → this._t = "fade" (on block, not DOM)
        if (key === '__transition__') {
          const transName = String(value).replace(/^["']|["']$/g, '');
          this._createLines.push(`this._t = "${transName}";`);
          continue;
        }

        // Element ref: ref: "name" → this.name = element
        if (key === 'ref') {
          const refName = String(value).replace(/^["']|["']$/g, '');
          this._createLines.push(`${this._self}.${refName} = ${elVar};`);
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

          this._pushEffect(`${elVar}.${prop} = ${valueCode};`);
          let assignCode = `${valueCode} = ${valueAccessor}`;
          const rootMember = !this.isSimpleAssignable(value) && this.findRootReactiveMember(value);
          if (rootMember) {
            assignCode += `; ${this._self}.${rootMember}.touch?.()`;
          }
          this._createLines.push(`${elVar}.addEventListener('${event}', (e) => { ${assignCode}; });`);
          continue;
        }

        const valueCode = this.generateInComponent(value, 'value');

        // value/checked with reactive deps: one-way push (use <=> for two-way)
        if ((key === 'value' || key === 'checked') && this.hasReactiveDeps(value)) {
          this._pushEffect(`${elVar}.${key} = ${valueCode};`);
          continue;
        }

        if (key === 'innerHTML' || key === 'textContent' || key === 'innerText') {
          if (this.hasReactiveDeps(value)) {
            this._pushEffect(`${elVar}.${key} = ${valueCode};`);
          } else {
            this._createLines.push(`${elVar}.${key} = ${valueCode};`);
          }
        } else if (BOOLEAN_ATTRS.has(key)) {
          if (this.hasReactiveDeps(value)) {
            this._pushEffect(`${elVar}.toggleAttribute('${key}', !!${valueCode});`);
          } else {
            this._createLines.push(`if (${valueCode}) ${elVar}.setAttribute('${key}', '');`);
          }
        } else if (this.hasReactiveDeps(value)) {
          if (Array.isArray(value) && value[0] === 'presence') {
            this._pushEffect(`{ const __v = ${valueCode}; __v == null ? ${elVar}.removeAttribute('${key}') : ${elVar}.setAttribute('${key}', __v); }`);
          } else {
            this._pushEffect(`${elVar}.setAttribute('${key}', ${valueCode});`);
          }
        } else {
          if (Array.isArray(value) && value[0] === 'presence') {
            this._createLines.push(`{ const __v = ${valueCode}; if (__v != null) ${elVar}.setAttribute('${key}', __v); }`);
          } else {
            this._createLines.push(`${elVar}.setAttribute('${key}', ${valueCode});`);
          }
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
    const children = [];
    for (const stmt of statements) {
      const childVar = this.generateNode(stmt);
      this._createLines.push(`${fragVar}.appendChild(${childVar});`);
      children.push(childVar);
    }
    this._fragChildren.set(fragVar, children);
    return fragVar;
  };

  // --------------------------------------------------------------------------
  // generateConditional — reactive if/else using block factories
  // --------------------------------------------------------------------------

  proto.generateConditional = function(sexpr) {
    this._pendingAutoWire = false;
    const [, condition, thenBlock, elseBlock] = sexpr;

    const anchorVar = this.newElementVar('anchor');
    this._createLines.push(`${anchorVar} = document.createComment('if');`);

    const condCode = this.generateInComponent(condition, 'value');

    const outerParams = this._loopVarStack.map(v => `${v.itemVar}, ${v.indexVar}`).join(', ');
    const outerExtra = outerParams ? `, ${outerParams}` : '';

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
    const effOpen = this._factoryMode ? 'disposers.push(__effect(() => {' : '__effect(() => {';
    const effClose = this._factoryMode ? '}));' : '});';
    setupLines.push(`  ${effOpen}`);
    setupLines.push(`    const show = !!(${condCode});`);
    setupLines.push(`    const want = show ? 'then' : ${elseBlock ? "'else'" : 'null'};`);
    setupLines.push(`    if (want === showing) return;`);
    setupLines.push(``);
    setupLines.push(`    if (currentBlock) {`);
    setupLines.push(`      const leaving = currentBlock;`);
    setupLines.push(`      if (leaving._t) { __transition(leaving._first, leaving._t, 'leave', () => leaving.d(true)); }`);
    setupLines.push(`      else { leaving.d(true); }`);
    setupLines.push(`      currentBlock = null;`);
    setupLines.push(`    }`);
    setupLines.push(`    showing = want;`);
    setupLines.push(``);
    setupLines.push(`    if (want === 'then') {`);
    setupLines.push(`      currentBlock = ${thenBlockName}(${this._self}${outerExtra});`);
    setupLines.push(`      currentBlock.c();`);
    setupLines.push(`      if (anchor.parentNode) currentBlock.m(anchor.parentNode, anchor.nextSibling);`);
    setupLines.push(`      currentBlock.p(${this._self}${outerExtra});`);
    setupLines.push(`      if (currentBlock._t) __transition(currentBlock._first, currentBlock._t, 'enter');`);
    setupLines.push(`    }`);
    if (elseBlock) {
      setupLines.push(`    if (want === 'else') {`);
      setupLines.push(`      currentBlock = ${elseBlockName}(${this._self}${outerExtra});`);
      setupLines.push(`      currentBlock.c();`);
      setupLines.push(`      if (anchor.parentNode) currentBlock.m(anchor.parentNode, anchor.nextSibling);`);
      setupLines.push(`      currentBlock.p(${this._self}${outerExtra});`);
      setupLines.push(`      if (currentBlock._t) __transition(currentBlock._first, currentBlock._t, 'enter');`);
      setupLines.push(`    }`);
    }
    setupLines.push(`  ${effClose}`);
    setupLines.push(`}`);

    this._setupLines.push(setupLines.join('\n    '));

    return anchorVar;
  };

  // --------------------------------------------------------------------------
  // generateConditionBranch — block factory for a conditional branch
  // --------------------------------------------------------------------------

  proto.generateConditionBranch = function(blockName, block) {
    const saved = [this._createLines, this._setupLines, this._factoryMode, this._factoryVars];

    this._createLines = [];
    this._setupLines = [];
    this._factoryMode = true;
    this._factoryVars = new Set();

    const rootVar = this.generateTemplateBlock(block);
    const createLines = this._createLines;
    const setupLines = this._setupLines;
    const factoryVars = this._factoryVars;

    [this._createLines, this._setupLines, this._factoryMode, this._factoryVars] = saved;

    const outerParams = this._loopVarStack.map(v => `${v.itemVar}, ${v.indexVar}`).join(', ');
    const extraParams = outerParams ? `, ${outerParams}` : '';

    this.emitBlockFactory(blockName, `ctx${extraParams}`, rootVar, createLines, setupLines, factoryVars);
  };

  // --------------------------------------------------------------------------
  // emitBlockFactory — shared factory generation for conditionals and loops
  // --------------------------------------------------------------------------

  proto.emitBlockFactory = function(blockName, params, rootVar, createLines, setupLines, factoryVars, isStatic) {
    const factoryLines = [];
    factoryLines.push(`function ${blockName}(${params}) {`);

    if (factoryVars.size > 0) {
      factoryLines.push(`  let ${[...factoryVars].join(', ')};`);
    }

    const hasEffects = setupLines.length > 0;
    if (hasEffects) {
      factoryLines.push(`  let disposers = [];`);
    }

    factoryLines.push(`  return {`);

    if (isStatic) {
      factoryLines.push(`    _s: true,`);
    }

    const fragChildren = this._fragChildren.get(rootVar);
    const firstNode = fragChildren ? fragChildren[0] : rootVar;

    factoryLines.push(`    c() {`);
    for (const line of createLines) {
      factoryLines.push(`      ${line}`);
    }
    factoryLines.push(`      this._first = ${firstNode};`);
    factoryLines.push(`    },`);

    factoryLines.push(`    m(target, anchor) {`);
    if (fragChildren) {
      for (const child of fragChildren) {
        factoryLines.push(`      if (target) target.insertBefore(${child}, anchor);`);
      }
    } else {
      factoryLines.push(`      if (target) target.insertBefore(${rootVar}, anchor);`);
    }
    factoryLines.push(`    },`);

    factoryLines.push(`    p(${params}) {`);
    if (hasEffects) {
      factoryLines.push(`      disposers.forEach(d => d());`);
      factoryLines.push(`      disposers = [];`);
      for (const line of setupLines) {
        factoryLines.push(`      ${line}`);
      }
    }
    factoryLines.push(`    },`);

    factoryLines.push(`    d(detaching) {`);
    if (hasEffects) {
      factoryLines.push(`      disposers.forEach(d => d());`);
    }
    if (fragChildren) {
      for (const child of fragChildren) {
        factoryLines.push(`      if (detaching && ${child}) ${child}.remove();`);
      }
    } else {
      factoryLines.push(`      if (detaching && ${rootVar}) ${rootVar}.remove();`);
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
    this._pendingAutoWire = false;
    const [head, vars, collection, guard, step, body] = sexpr;

    const blockName = this.newBlockVar();

    const anchorVar = this.newElementVar('anchor');
    this._createLines.push(`${anchorVar} = document.createComment('for');`);

    const varNames = Array.isArray(vars) ? vars : [vars];
    const itemVar = varNames[0];
    let indexVar = varNames[1] || null;
    if (!indexVar) {
      const usedNames = new Set(this._loopVarStack.flatMap(v => [v.itemVar, v.indexVar]));
      usedNames.add(itemVar);
      for (const candidate of ['i', 'j', 'k', 'l', 'm', 'n']) {
        if (!usedNames.has(candidate)) { indexVar = candidate; break; }
      }
      indexVar = indexVar || `_i${this._loopVarStack.length}`;
    }

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

    const saved = [this._createLines, this._setupLines, this._factoryMode, this._factoryVars];

    this._createLines = [];
    this._setupLines = [];
    this._factoryMode = true;
    this._factoryVars = new Set();

    const outerParams = this._loopVarStack.map(v => `${v.itemVar}, ${v.indexVar}`).join(', ');
    const outerExtra = outerParams ? `, ${outerParams}` : '';

    this._loopVarStack.push({ itemVar, indexVar });
    const itemNode = this.generateTemplateBlock(body);
    this._loopVarStack.pop();
    const itemCreateLines = this._createLines;
    const itemSetupLines = this._setupLines;
    const itemFactoryVars = this._factoryVars;

    [this._createLines, this._setupLines, this._factoryMode, this._factoryVars] = saved;

    const isStatic = itemSetupLines.length === 0;
    const loopParams = `ctx, ${itemVar}, ${indexVar}${outerExtra}`;
    this.emitBlockFactory(blockName, loopParams, itemNode, itemCreateLines, itemSetupLines, itemFactoryVars, isStatic);

    // Build key function argument (null = use item as key)
    const hasCustomKey = keyExpr !== itemVar;
    const keyFnCode = hasCustomKey ? `(${itemVar}, ${indexVar}) => ${keyExpr}` : 'null';

    // Build outer vars argument list for nested loops
    const outerArgs = outerParams ? `, ${outerParams}` : '';

    // Generate reconciliation code in _setup()
    const setupLines = [];
    setupLines.push(`// Loop: ${blockName}`);
    setupLines.push(`{`);
    setupLines.push(`  const __s = { blocks: [], keys: [] };`);
    const effOpen = this._factoryMode ? 'disposers.push(__effect(() => {' : '__effect(() => {';
    const effClose = this._factoryMode ? '}));' : '});';
    setupLines.push(`  ${effOpen}`);
    setupLines.push(`    __reconcile(${anchorVar}, __s, ${collectionCode}, ${this._self}, ${blockName}, ${keyFnCode}${outerArgs});`);
    setupLines.push(`  ${effClose}`);
    setupLines.push(`}`);

    this._setupLines.push(setupLines.join('\n    '));

    return anchorVar;
  };

  // --------------------------------------------------------------------------
  // generateChildComponent — instantiate a child component
  // --------------------------------------------------------------------------

  proto.generateChildComponent = function(componentName, args) {
    this._pendingAutoWire = false;
    const instVar = this.newElementVar('inst');
    const elVar = this.newElementVar('el');
    const { propsCode, reactiveProps, eventBindings, childrenSetupLines } = this.buildComponentProps(args);

    const s = this._self;
    this._createLines.push(`{ const __prev = __pushComponent(${s}); try {`);
    this._createLines.push(`${instVar} = new ${componentName}(${propsCode});`);
    this._createLines.push(`${elVar} = ${instVar}._root = ${instVar}._create();`);
    this._createLines.push(`(${s}._children || (${s}._children = [])).push(${instVar});`);
    this._createLines.push(`} finally { __popComponent(__prev); } }`);

    for (const { event, value } of eventBindings) {
      const handlerCode = this.generateInComponent(value, 'value');
      this._createLines.push(`${elVar}.addEventListener('${event}', (e) => __batch(() => (${handlerCode})(e)));`);
    }

    this._setupLines.push(`try { if (${instVar}._setup) ${instVar}._setup(); if (${instVar}.mounted) ${instVar}.mounted(); } catch (__e) { __handleComponentError(__e, ${instVar}); }`);

    for (const { key, valueCode } of reactiveProps) {
      this._pushEffect(`if (${instVar}.${key} && typeof ${instVar}.${key} === 'object' && 'value' in ${instVar}.${key}) ${instVar}.${key}.value = ${valueCode}; else if (${instVar}._setRestProp) ${instVar}._setRestProp('${key}', ${valueCode});`);
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
    const eventBindings = [];
    let childrenVar = null;
    const childrenSetupLines = [];

    // Simple reactive values pass the signal directly for shared reactivity;
    // complex expressions use normal .value unwrapping to compute the value.
    const addProp = (key, value) => {
      if (key.startsWith('@')) {
        eventBindings.push({ event: key.slice(1).split('.')[0], value });
        return;
      }
      const isDirectSignal = this.reactiveMembers && (
        (typeof value === 'string' && this.reactiveMembers.has(value)) ||
        (Array.isArray(value) && value[0] === '.' && value[1] === 'this' && typeof value[2] === 'string' && this.reactiveMembers.has(value[2]))
      );
      if (isDirectSignal) {
        const member = typeof value === 'string' ? value : value[2];
        props.push(`${key}: ${this._self}.${member}`);
      } else {
        const valueCode = this.generateInComponent(value, 'value');
        props.push(`${key}: ${valueCode}`);
        if (this.hasReactiveDeps(value)) {
          reactiveProps.push({ key, valueCode });
        }
      }
    };

    const addObjectProps = (objExpr) => {
      for (let i = 1; i < objExpr.length; i++) {
        const [, key, value] = objExpr[i];
        if (typeof key === 'string') {
          addProp(key, value);
        } else if (Array.isArray(key) && key[0] === '.' && key[1] === 'this' && typeof key[2] === 'string') {
          eventBindings.push({ event: key[2], value });
        }
      }
    };

    for (const arg of args) {
      if (this.is(arg, 'object')) {
        addObjectProps(arg);
      } else if (Array.isArray(arg) && (arg[0] === '->' || arg[0] === '=>')) {
        let block = arg[2];
        if (block) {
          if (this.is(block, 'block')) {
            const domChildren = [];
            for (const child of block.slice(1)) {
              if (this.is(child, 'object')) {
                addObjectProps(child);
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
      } else if (arg && !childrenVar) {
        const textVar = this.newTextVar();
        const exprCode = this.generateInComponent(arg, 'value');
        if (this.hasReactiveDeps(arg)) {
          this._createLines.push(`${textVar} = document.createTextNode('');`);
          const body = `${textVar}.data = ${exprCode};`;
          const effect = this._factoryMode
            ? `disposers.push(__effect(() => { ${body} }));`
            : `__effect(() => { ${body} });`;
          childrenSetupLines.push(effect);
        } else {
          this._createLines.push(`${textVar} = document.createTextNode(${exprCode});`);
        }
        childrenVar = textVar;
        props.push(`children: ${childrenVar}`);
      }
    }

    const propsCode = props.length > 0 ? `{ ${props.join(', ')} }` : '{}';
    return { propsCode, reactiveProps, eventBindings, childrenSetupLines };
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

    // Method call on component: [['.', 'this', method], ...args]
    // Methods may read reactive state internally — treat as reactive so the
    // call gets wrapped in __effect and re-runs when dependencies change.
    if (Array.isArray(sexpr[0]) && sexpr[0][0] === '.' && sexpr[0][1] === 'this') {
      const name = _str(sexpr[0][2]);
      if (name && this.componentMembers?.has(name)) return true;
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
  let out = '';
  for (const arg of args) {
    if (!arg) continue;
    if (typeof arg === 'string') { out && (out += ' '); out += arg; }
    else if (typeof arg === 'object') {
      if (Array.isArray(arg)) { const v = __clsx(...arg); v && (out && (out += ' '), out += v); }
      else for (const k in arg) if (arg[k]) { out && (out += ' '); out += k; }
    }
  }
  return out;
}

function __lis(arr) {
  const n = arr.length;
  if (n === 0) return [];
  const tails = [], indices = [], prev = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (arr[i] === -1) continue;
    let lo = 0, hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < arr[i]) lo = mid + 1; else hi = mid;
    }
    tails[lo] = arr[i];
    indices[lo] = i;
    if (lo > 0) prev[i] = indices[lo - 1];
  }
  const result = [];
  let k = indices[tails.length - 1];
  for (let i = tails.length - 1; i >= 0; i--) { result.push(k); k = prev[k]; }
  result.reverse();
  return result;
}

function __reconcile(anchor, state, items, ctx, factory, keyFn, ...outer) {
  const parent = anchor.parentNode;
  if (!parent) return;

  const oldKeys = state.keys;
  const oldBlocks = state.blocks;
  const oldLen = oldKeys.length;
  const newLen = items.length;
  const newBlocks = new Array(newLen);
  const hasKeyFn = keyFn != null;
  const newKeys = hasKeyFn ? items.map((item, i) => keyFn(item, i)) : items;

  // Phase 0: first render — batch create via DocumentFragment
  if (oldLen === 0) {
    if (newLen > 0) {
      const frag = document.createDocumentFragment();
      for (let i = 0; i < newLen; i++) {
        const block = factory(ctx, items[i], i, ...outer);
        block.c();
        block.m(frag, null);
        if (!block._s) block.p(ctx, items[i], i, ...outer);
        newBlocks[i] = block;
      }
      parent.insertBefore(frag, anchor);
    }
    state.keys = hasKeyFn ? newKeys : items.slice();
    state.blocks = newBlocks;
    return;
  }

  // Phase 1: prefix scan — skip p() (item+index identical, effects already live)
  let start = 0;
  const minLen = oldLen < newLen ? oldLen : newLen;
  while (start < minLen && oldKeys[start] === newKeys[start]) {
    newBlocks[start] = oldBlocks[start];
    start++;
  }

  // Phase 2: suffix scan — call p() (index may differ)
  let oldEnd = oldLen - 1;
  let newEnd = newLen - 1;
  while (oldEnd >= start && newEnd >= start && oldKeys[oldEnd] === newKeys[newEnd]) {
    const block = oldBlocks[oldEnd];
    if (!block._s) block.p(ctx, items[newEnd], newEnd, ...outer);
    newBlocks[newEnd] = block;
    oldEnd--;
    newEnd--;
  }

  // Remove old blocks in the middle that aren't in the new set
  if (start > newEnd) {
    for (let i = start; i <= oldEnd; i++) oldBlocks[i].d(true);
  } else if (start > oldEnd) {
    // Phase 3a: pure insertion — batch via DocumentFragment
    const next = newEnd + 1 < newLen ? newBlocks[newEnd + 1]._first : anchor;
    const frag = document.createDocumentFragment();
    for (let i = start; i <= newEnd; i++) {
      const block = factory(ctx, items[i], i, ...outer);
      block.c();
      block.m(frag, null);
      if (!block._s) block.p(ctx, items[i], i, ...outer);
      newBlocks[i] = block;
    }
    parent.insertBefore(frag, next);
  } else {
    // Phase 4: general case — temp Map + LIS
    const oldKeyIdx = new Map();
    for (let i = start; i <= oldEnd; i++) oldKeyIdx.set(oldKeys[i], i);

    const seq = new Array(newEnd - start + 1);
    for (let i = start; i <= newEnd; i++) {
      const key = newKeys[i];
      const oldIdx = oldKeyIdx.get(key);
      if (oldIdx !== undefined) {
        seq[i - start] = oldIdx - start;
        const block = oldBlocks[oldIdx];
        if (!block._s) block.p(ctx, items[i], i, ...outer);
        newBlocks[i] = block;
        oldKeyIdx.delete(key);
      } else {
        seq[i - start] = -1;
        const block = factory(ctx, items[i], i, ...outer);
        block.c();
        if (!block._s) block.p(ctx, items[i], i, ...outer);
        newBlocks[i] = block;
      }
    }

    for (const idx of oldKeyIdx.values()) oldBlocks[idx].d(true);

    const lis = __lis(seq);
    const lisSet = new Set(lis);
    let next = newEnd + 1 < newLen ? newBlocks[newEnd + 1]._first : anchor;
    for (let i = newEnd; i >= start; i--) {
      const block = newBlocks[i];
      if (!lisSet.has(i - start)) {
        block.m(parent, next);
      }
      next = block._first;
    }
  }

  state.keys = hasKeyFn ? newKeys : items.slice();
  state.blocks = newBlocks;
}

let __cssInjected = false;
function __transitionCSS() {
  if (__cssInjected) return;
  __cssInjected = true;
  const s = document.createElement('style');
  s.textContent = [
    '.fade-enter-active,.fade-leave-active{transition:opacity .2s ease}',
    '.fade-enter-from,.fade-leave-to{opacity:0}',
    '.slide-enter-active,.slide-leave-active{transition:opacity .2s ease,transform .2s ease}',
    '.slide-enter-from{opacity:0;transform:translateY(-8px)}',
    '.slide-leave-to{opacity:0;transform:translateY(8px)}',
    '.scale-enter-active,.scale-leave-active{transition:opacity .2s ease,transform .2s ease}',
    '.scale-enter-from,.scale-leave-to{opacity:0;transform:scale(.95)}',
    '.blur-enter-active,.blur-leave-active{transition:opacity .2s ease,filter .2s ease}',
    '.blur-enter-from,.blur-leave-to{opacity:0;filter:blur(4px)}',
    '.fly-enter-active,.fly-leave-active{transition:opacity .2s ease,transform .2s ease}',
    '.fly-enter-from{opacity:0;transform:translateY(-20px)}',
    '.fly-leave-to{opacity:0;transform:translateY(20px)}',
  ].join('');
  document.head.appendChild(s);
}

function __transition(el, name, dir, done) {
  __transitionCSS();
  const cl = el.classList;
  const from = name + '-' + dir + '-from';
  const active = name + '-' + dir + '-active';
  const to = name + '-' + dir + '-to';
  cl.add(from, active);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      cl.remove(from);
      cl.add(to);
      const end = () => { cl.remove(active, to); if (done) done(); };
      el.addEventListener('transitionend', end, { once: true });
    });
  });
}

function __handleComponentError(error, component) {
  let current = component;
  while (current) {
    if (current.onError) {
      try { current.onError(error, component); return; } catch (_) {}
    }
    current = current._parent;
  }
  throw error;
}

class __Component {
  constructor(props = {}) {
    Object.assign(this, props);
    if (!this.app && globalThis.__ripApp) this.app = globalThis.__ripApp;
    const prev = __pushComponent(this);
    try { this._init(props); } catch (e) { __popComponent(prev); __handleComponentError(e, this); return; }
    __popComponent(prev);
  }
  _init() {}
  mount(target) {
    if (typeof target === "string") target = document.querySelector(target);
    this._target = target;
    try {
      this._root = this._create();
      target.appendChild(this._root);
      if (this._setup) this._setup();
      if (this.mounted) this.mounted();
    } catch (error) {
      __handleComponentError(error, this);
    }
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
  emit(name, detail) {
    if (this._root) {
      this._root.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
    }
  }
  static mount(target = 'body') {
    return new this().mount(target);
  }
}

// Register on globalThis for runtime deduplication
if (typeof globalThis !== 'undefined') {
  globalThis.__ripComponent = { __pushComponent, __popComponent, setContext, getContext, hasContext, __clsx, __lis, __reconcile, __transition, __handleComponentError, __Component };
}

`;
  };
}
