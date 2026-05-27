import { DOM_EVENTS } from './generated/dom-events.js';
import { HTML_TAGS, SVG_TAGS, TEMPLATE_TAGS } from './generated/dom-tags.js';

// Component System — Fine-grained reactive components for Rip
//
// Architecture: installComponentSupport(CodeEmitter, Lexer) adds methods to
// both prototypes — render rewriting on the Lexer, component code generation
// on the CodeEmitter. A separate getComponentRuntime() emits runtime helpers
// only when components are used.
//
// Naming: All render-tree generators use generate* (consistent with compiler).

// ============================================================================
// Constants
// ============================================================================

const BIND_PREFIX = '__bind_';
const BIND_SUFFIX = '__';

const LIFECYCLE_HOOKS = new Set(['beforeMount', 'mounted', 'beforeUnmount', 'unmounted', 'onError']);
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

/**
 * Extract `?` optionality flag from s-expression target node.
 * Set by the lexer as `.optional` on the prop-name String wrapper when
 * the source wrote `@label?:: T` or similar.
 */
function getMemberOptional(target) {
  if (target instanceof String && target.optional) return true;
  if (Array.isArray(target) && target[2] instanceof String && target[2].optional) return true;
  return false;
}

// ============================================================================
// Prototype Installation
// ============================================================================

export function installComponentSupport(CodeEmitter, Lexer) {

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
      return /^[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*$/.test(name);
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
  // CodeEmitter: Component compilation
  // ==========================================================================

  const proto = CodeEmitter.prototype;

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
    return /^[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*$/.test(name);
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
    if (from.optional) s.optional = true;
    if (from.await) s.await = true;
    return (s.optional || s.await) ? s : to;
  };

  // Inject `// @rip-src:N` markers onto each statement line of a method body
  // emitted into a component stub.  The emitter doesn't carry source-map data
  // for stub method bodies, so without explicit markers, typecheck.js falls
  // back to linear gap-fill interpolation which silently misaligns when stub
  // sizes change.  Walks the body s-expression to recover statement source
  // lines and pairs them with the rendered body's non-trivial lines.
  proto.addBodyRipSrcMarkers = function(bodyCode, bodySexpr) {
    if (typeof bodyCode !== 'string' || !bodyCode) return bodyCode;
    const stmts = Array.isArray(bodySexpr) && bodySexpr[0] === 'block'
      ? bodySexpr.slice(1)
      : (Array.isArray(bodySexpr) ? [bodySexpr] : []);
    if (stmts.length === 0) return bodyCode;
    const getLoc = (s) => {
      if (s == null) return null;
      if (!Array.isArray(s)) return s?.loc?.r ?? null;
      if (s.loc?.r) return s.loc.r;
      if (s[0]?.loc?.r) return s[0].loc.r;
      for (const child of s) {
        if (child?.loc?.r) return child.loc.r;
        if (Array.isArray(child)) {
          const l = getLoc(child);
          if (l != null) return l;
        }
      }
      return null;
    };
    const srcLines = stmts.map(getLoc);
    if (srcLines.every(l => l == null)) return bodyCode;
    const lines = bodyCode.split('\n');
    let si = 0;
    for (let i = 0; i < lines.length && si < srcLines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;
      if (trimmed === '{' || trimmed === '}' || trimmed.startsWith('//')) continue;
      if (lines[i].includes('@rip-src:')) { si++; continue; }
      if (srcLines[si] != null) {
        lines[i] = `${lines[i]} // @rip-src:${srcLines[si]}`;
      }
      si++;
    }
    return lines.join('\n');
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
  proto.emitComponent = function(head, rest, context, sexpr) {
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
        // Bare prop form: `(. this name)` — no default value.
        // `@name`     → required (caller must pass)
        // `@name?`    → optional (caller may omit; value will be undefined)
        // `@name?:: T`→ optional, typed
        const varName = (typeof stmt[2] === 'string' || stmt[2] instanceof String) ? stmt[2].valueOf() : null;
        if (varName) {
          const optional = getMemberOptional(stmt);
          stateVars.push({ name: varName, value: undefined, isPublic: true, type: stmt[2]?.type || null, required: !optional, optional, srcLine: stmt.loc?.r });
          memberNames.add(varName);
          reactiveMembers.add(varName);
        }
      } else if (op === 'state') {
        const varName = getMemberName(stmt[1]);
        if (varName) {
          stateVars.push({ name: varName, value: stmt[2], isPublic: isPublicProp(stmt[1]), type: getMemberType(stmt[1]), optional: getMemberOptional(stmt[1]), srcLine: stmt.loc?.r });
          memberNames.add(varName);
          reactiveMembers.add(varName);
        }
      } else if (op === 'computed') {
        const varName = getMemberName(stmt[1]);
        if (varName) {
          derivedVars.push({ name: varName, expr: stmt[2], type: getMemberType(stmt[1]), srcLine: stmt.loc?.r });
          memberNames.add(varName);
          reactiveMembers.add(varName);
        }
      } else if (op === 'readonly') {
        const varName = getMemberName(stmt[1]);
        if (varName) {
          readonlyVars.push({ name: varName, value: stmt[2], isPublic: isPublicProp(stmt[1]), type: getMemberType(stmt[1]), optional: getMemberOptional(stmt[1]), srcLine: stmt.loc?.r });
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
              stateVars.push({ name: varName, value: val, isPublic: isPublicProp(stmt[1]), srcLine: stmt.loc?.r });
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

    // When extends-ing a tag, expose `@rest` as a reactive view of caller props
    // not consumed by declared @props. Reads (e.g. `@rest.disabled`) track via
    // `this.rest.value`; `_setRestProp` mutates and calls `.touch()` to notify.
    if (inheritsTag) {
      memberNames.add('rest');
      reactiveMembers.add('rest');
    }

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
      // Strip Rip's `::` annotation sigil to TypeScript's `:` separator.
      const expandType = (t) => t ? t.replace(/::/g, ':') : null;

      const sl = [];
      const componentTypeParams = this._componentTypeParams || '';
      sl.push(`class ${componentTypeParams}{`);
      // Injected `this` shape for every component. The compiler stays
      // context-free; `declare app: any` and `declare router: any` are
      // rewritten by typecheck.js to typed shapes when the project anchor /
      // stash file is discoverable. `params`, `query`, `children`, and the
      // lifecycle hooks are stable across all projects, so they're typed
      // here directly. User-defined hooks are emitted later as real methods;
      // skip the optional-signature declaration for those names to avoid
      // overload-optionality mismatches.
      // Combine all injected declarations onto a single line to preserve the
      // stub's prior line count.  Source-map gap-fill interpolates linearly
      // between marker lines (e.g. between @rip-src markers from `@count`
      // and a downstream method), so adding stub header lines pushes the
      // method bodies past where interpolation expects them — breaking
      // @ts-expect-error injection.  Keeping a single header line preserves
      // the relative offsets.
      sl.push('  declare _root: Element | null; declare app: any; declare router: any; declare params: Record<string, string>; declare query: URLSearchParams; declare children: any;');
      const userHookNames = new Set(lifecycleHooks.map(h => h.name));
      const hookDecls = [];
      if (!userHookNames.has('beforeMount'))   hookDecls.push('beforeMount?(): void;');
      if (!userHookNames.has('mounted'))       hookDecls.push('mounted?(): void;');
      if (!userHookNames.has('beforeUnmount')) hookDecls.push('beforeUnmount?(): void;');
      if (!userHookNames.has('unmounted'))     hookDecls.push('unmounted?(): void;');
      if (!userHookNames.has('onError'))       hookDecls.push('onError?(err: { status?: number; message?: string; error?: Error; path?: string }): void;');
      if (hookDecls.length) sl.push('  ' + hookDecls.join(' '));
      sl.push('  emit(_name: string, _detail?: any): void {}');

      // Constructor — typed props for public state/readonly (matches DTS)
      const propEntries = [];
      for (const { name, type, isPublic, required, optional } of stateVars) {
        if (!isPublic) continue;
        const ts = expandType(type);
        const opt = (optional ?? !required) ? '?' : '';
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
        const hasRequired = propEntries.length > 0 && stateVars.some(v => v.isPublic && v.required && !v.optional);
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
      for (const { name, type, value, optional, srcLine } of stateVars) {
        const ts = expandType(type) || inferLiteralType(value);
        // Optional prop with no default: field can be undefined at runtime
        // (we don't synthesize a `?? null` fallback below), so the Signal's
        // payload type must include undefined.
        const optNoDefault = optional && value === undefined;
        const wrapped = ts ? (optNoDefault ? `${ts} | undefined` : ts) : null;
        const marker = srcLine != null ? ` // @rip-src:${srcLine}` : '';
        sl.push((wrapped ? `  declare ${name}: Signal<${wrapped}>;` : `  declare ${name}: Signal<any>;`) + marker);
      }
      if (inheritsTag) {
        sl.push(`  declare rest: Signal<__RipProps<'${inheritsTag}'>>;`);
      }
      for (const { name, type, value } of readonlyVars) {
        const ts = expandType(type) || inferLiteralType(value);
        sl.push(ts ? `  declare ${name}: ${ts};` : `  declare ${name}: any;`);
      }
      for (const { name, expr, type } of derivedVars) {
        const ts = expandType(type);
        const typeAnnot = ts ? `: Computed<${ts}>` : '';
        if (this.is(expr, 'block')) {
          const transformed = this.transformComponentMembers(expr);
          const body = this.emitFunctionBody(transformed);
          sl.push(`  ${name}${typeAnnot} = __computed(() => ${body});`);
        } else {
          const val = this.emitInComponent(expr, 'value');
          sl.push(`  ${name}${typeAnnot} = __computed(() => ${val});`);
        }
      }

      // _init body — readonly, state, computed assignments (skip accepted/offered)
      sl.push('  _init(props) {');
      for (const { name, value, isPublic, srcLine } of readonlyVars) {
        const val = this.emitInComponent(value, 'value');
        const marker = srcLine != null ? ` // @rip-src:${srcLine}` : '';
        sl.push((isPublic ? `    this.${name} = props.${name} ?? ${val};` : `    this.${name} = ${val};`) + marker);
      }
      for (const { name, value, isPublic, required, type, srcLine } of stateVars) {
        const marker = srcLine != null ? ` // @rip-src:${srcLine}` : '';
        if (isPublic && (required || value === undefined)) {
          sl.push(`    this.${name} = __state(props.__bind_${name}__ ?? props.${name});` + marker);
        } else if (isPublic) {
          const val = this.emitInComponent(value, 'value');
          sl.push(`    this.${name} = __state(props.__bind_${name}__ ?? props.${name} ?? ${val});` + marker);
        } else {
          const val = this.emitInComponent(value, 'value');
          sl.push(`    this.${name} = __state(${val});` + marker);
        }
      }

      for (const effect of effects) {
        const effectBody = effect[2];
        const isAsync = this.containsAwait(effectBody) ? 'async ' : '';
        if (this.is(effectBody, 'block')) {
          const transformed = this.transformComponentMembers(effectBody);
          // sideEffectOnly: false so the body's last expression is
          // returned. The reactive runtime treats a returned function as
          // the effect's cleanup — that's how '~> ARIA.bindPopover ...'
          // gets its disposer registered. Disposer is also auto-tracked
          // via __getCurrentComponent for unmount cleanup.
          const body = this.emitFunctionBody(transformed);
          sl.push(`    __effect(${isAsync}() => ${body});`);
        } else {
          const effectCode = this.emitInComponent(effectBody, 'value');
          sl.push(`    __effect(${isAsync}() => { return ${effectCode}; });`);
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
          let bodyCode = this.emitFunctionBody(transformed, params || []);
          // Inject @rip-src markers on each body statement line so that
          // @ts-expect-error injection and hover/diagnostics resolve to the
          // user's actual source line, instead of relying on linear gap-fill
          // interpolation across the stub (which is brittle to stub size).
          bodyCode = this.addBodyRipSrcMarkers(bodyCode, methodBody);
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
          let bodyCode = this.emitFunctionBody(transformed, params || []);
          bodyCode = this.addBodyRipSrcMarkers(bodyCode, hookBody);
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
          const sideExprs = [];
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
                const srcLine = pair.loc?.r ?? obj.loc?.r;
                // `@event` props on a component (parsed as `(. this name)`)
                // — not part of the declared prop type, but emit the value
                // as a bare expression so TS sees identifiers in the
                // handler body (hover, completion, identifier resolution).
                if (Array.isArray(key) && key[0] === '.' && key[1] === 'this') {
                  try {
                    const val = this.emitInComponent(value, 'value');
                    sideExprs.push({ code: val, srcLine });
                  } catch {}
                  continue;
                }
                if (typeof key === 'string' && key.startsWith('@')) {
                  try {
                    const val = this.emitInComponent(value, 'value');
                    sideExprs.push({ code: val, srcLine });
                  } catch {}
                  continue;
                }
                if (typeof key === 'string') {
                  if (key.startsWith('__bind_') && key.endsWith('__')) {
                    // Two-way binding: emit the Signal object (this.xxx), not this.xxx.value
                    const member = typeof value === 'string' && this.reactiveMembers?.has(value) ? `this.${value}` : this.emitInComponent(value, 'value');
                    props.push({ code: `${key}: ${member}`, srcLine });
                  } else {
                    const val = this.emitInComponent(value, 'value');
                    props.push({ code: `${key}: ${val}`, srcLine });
                  }
                }
              }
            }
          }
          props.sideExprs = sideExprs;
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
                  const val = this.emitInComponent(value, 'value');
                  props.push({ code: `'${eventKey}': ${val}`, srcLine });
                } else if (typeof key === 'string') {
                  if (key === 'key') {
                    // key: is not an HTML attribute, but emit its value
                    // expression for type-checking and semantic tokens
                    const val = this.emitInComponent(value, 'value');
                    const marker = srcLine != null ? ` // @rip-src:${srcLine}` : '';
                    constructions.push(`    (${val});${marker}`);
                    continue;
                  }
                  if (key.startsWith('__bind_') && key.endsWith('__')) {
                    const propName = key.slice(7, -2);
                    const val = this.emitInComponent(value, 'value');
                    props.push({ code: `${propName}: ${val}`, srcLine });
                  } else {
                    const val = this.emitInComponent(value, 'value');
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
          let head = node[0]?.valueOf?.() ?? node[0];

          // Tag shorthand normalization: `button.outline` is parsed as a
          // member-access s-expression `(. button outline)`. For render-block
          // type-checking we want to treat it as a regular tag node with a
          // string head `"button.outline"` so the existing intrinsic-tag
          // logic (which splits on `[.#]`) picks it up. Without this the
          // entire subtree (including @event handler bodies) is silently
          // skipped from the type-check stub.
          if (Array.isArray(head) && head[0] === '.') {
            const parts = [];
            const collect = (h) => {
              if (typeof h === 'string') { parts.push(h); return true; }
              if (Array.isArray(h) && h[0] === '.' && parts.length === 0) {
                if (!collect(h[1])) return false;
                if (typeof h[2] !== 'string' || !/^[\w-]+$/.test(h[2])) return false;
                parts.push('.', h[2]);
                return true;
              }
              return false;
            };
            if (collect(head) && parts.length >= 3 && /^[a-z][\w-]*$/.test(parts[0])) {
              const flat = parts.join('');
              const reshaped = [flat];
              for (let i = 1; i < node.length; i++) reshaped.push(node[i]);
              if (node.loc) reshaped.loc = node.loc;
              // Carry an _astNode back-reference so emitBareIdent can attach
              // anchors (used by recordSubMappings) on the original AST node
              // rather than this throwaway reshape, since recordSubMappings
              // walks the original tree.
              reshaped._astNode = node;
              // Strip .loc from the original tag-shorthand `(. tag class ...)`
              // chain so collectSubExprs (used by recordSubMappings) does not
              // anchor source identifiers (the class names) onto unrelated
              // gen-side property accesses with the same name. The class
              // segments (e.g. `image` in `div.image`) are CSS classes, not
              // identifier references, and should not participate in
              // identifier-name source-mapping heuristics.
              const stripLoc = (h) => {
                if (Array.isArray(h) && h[0] === '.') {
                  if (h.loc) delete h.loc;
                  stripLoc(h[1]);
                }
              };
              stripLoc(head);
              node = reshaped;
              head = flat;
            }
          }

          // Object nodes are property bags (key-value pairs) — their values
          // are code expressions (event handlers, bindings, literals), not
          // render template. extractIntrinsicProps handles them separately.
          // Walking into them would treat function bodies as template content
          // (e.g. `@blur: (e) -> p(e)` would emit `e;` and `__ripEl('p')`).
          if (head === 'object') return;

          // Type-check conditional and loop expressions in render blocks.
          // Without this, `if labelz` (a typo for `label`) silently evaluates
          // as undefined and skips the block — the condition goes unchecked.
          // Similarly, `switch statusz` and `for item in itemsz` go unchecked.
          if (head === 'if' || head === 'unless') {
            const condition = node[1];
            if (condition != null) {
              const condCode = this.emitInComponent(condition, 'value');
              const srcLine = node.loc?.r;
              const srcMarker = srcLine != null ? ` // @rip-src:${srcLine}` : '';
              constructions.push(`    ${condCode};${srcMarker}`);
            }
          } else if (head === '?:') {
            // Emit the full ternary so all branches are type-checked
            const ternCode = this.emitInComponent(node, 'value');
            const srcLine = node.loc?.r;
            const srcMarker = srcLine != null ? ` // @rip-src:${srcLine}` : '';
            constructions.push(`    ${ternCode};${srcMarker}`);
          } else if (head === 'switch') {
            const discriminant = node[1];
            if (discriminant != null) {
              const discCode = this.emitInComponent(discriminant, 'value');
              const srcLine = node.loc?.r;
              const srcMarker = srcLine != null ? ` // @rip-src:${srcLine}` : '';
              constructions.push(`    ${discCode};${srcMarker}`);
            }
          } else if (head === 'for-in' || head === 'for-of' || head === 'for-as') {
            // Emit a real for-loop so the loop variable is in scope for the body.
            // node: [head, vars, iterable, step, guard, body]
            const vars = node[1];
            const iterable = node[2];
            if (iterable != null) {
              const iterCode = this.emitInComponent(iterable, 'value');
              const srcLine = node.loc?.r;
              const srcMarker = srcLine != null ? ` // @rip-src:${srcLine}` : '';
              // Extract loop variable pattern
              let varPattern;
              if (Array.isArray(vars)) {
                if (vars.length === 1) {
                  const v = vars[0];
                  varPattern = Array.isArray(v) ? this.emitDestructuringPattern(v) : String(v);
                } else if (head === 'for-of') {
                  // for key, val of obj — destructure as [key, val] from Object.entries
                  varPattern = `[${vars.map(v => String(v)).join(', ')}]`;
                } else {
                  // for item, index in arr — first is the item
                  varPattern = String(vars[0]);
                }
              } else {
                varPattern = String(vars);
              }
              if (head === 'for-of') {
                constructions.push(`    for (const ${varPattern} of Object.entries(${iterCode})) {${srcMarker}`);
              } else {
                constructions.push(`    for (const ${varPattern} of ${iterCode}) {${srcMarker}`);
              }
              // Walk body children (indices 3+ may contain guard, body, etc.)
              for (let bi = 3; bi < node.length; bi++) {
                if (node[bi] != null) walkRender(node[bi]);
              }
              constructions.push(`    }`);
              return; // Don't walk children again below
            }
          } else if (head === '__text__') {
            // = expr — text expression: emit the expression for type-checking.
            // Return early — the expression is fully handled; walking children
            // would mis-interpret the call target as an element tag name.
            const textExpr = node[1];
            if (textExpr != null) {
              const exprCode = this.emitInComponent(textExpr, 'value');
              const srcLine = node.loc?.r;
              const srcMarker = srcLine != null ? ` // @rip-src:${srcLine}` : '';
              constructions.push(`    ${exprCode};${srcMarker}`);
            }
            return;
          } else if (head === 'str') {
            // Interpolated string — emit the full expression so TS sees
            // references to variables/functions inside the interpolation
            // (e.g. "#{format(x)}" must count as a read of `format`).
            try {
              const exprCode = this.emitInComponent(node, 'value');
              const srcLine = node.loc?.r;
              const srcMarker = srcLine != null ? ` // @rip-src:${srcLine}` : '';
              constructions.push(`    ${exprCode};${srcMarker}`);
            } catch {}
            return;
          }

          // Emit a bare lowercase identifier as either a property access
          // (component member used as text), __ripEl (tag name check when at
          // block level), or a plain variable reference (text child of a tag).
          const emitBareIdent = (child, parentNode, isTextChild) => {
            if (typeof child !== 'string' || !/^[a-z][\w-]*$/.test(child)) return;
            if (CodeEmitter.GENERATORS[child]) return;
            if (child === 'null' || child === 'undefined' || child === 'true' || child === 'false') return;
            let srcLine = parentNode.loc?.r;
            let srcCol = null;
            if (srcLine != null && sourceLines) {
              const re = new RegExp(`\\b${child}\\b`, 'g');
              for (let ln = srcLine; ln < sourceLines.length; ln++) {
                const lineText = sourceLines[ln];
                if (!lineText) continue;
                let searchFrom = (ln === parentNode.loc.r) ? (parentNode.loc.c + 1) : 0;
                re.lastIndex = searchFrom;
                let m;
                let found = -1;
                while ((m = re.exec(lineText)) !== null) {
                  // Skip tag-shorthand class/id matches like `.error`/`#id`
                  // (e.g. the `error` in `p.error error` — the bare-ident
                  // child is the *second* `error`, not the CSS class).
                  const prev = m.index > 0 ? lineText[m.index - 1] : '';
                  if (prev === '.' || prev === '#') continue;
                  found = m.index;
                  break;
                }
                if (found >= 0) {
                  srcLine = ln;
                  srcCol = found;
                  break;
                }
              }
            }
            const srcMarker = srcLine != null ? ` // @rip-src:${srcLine}` : '';
            // Attach an anchor on the parent so collectSubExprs (used by
            // recordSubMappings) can record a precise source-map entry for
            // this bare identifier. Without this, source clicks/hovers on
            // the bare ident never resolve to the generated `this.X;` /
            // `X;` stub line, and the LSP can't route a semantic token here.
            if (srcLine != null && srcCol != null) {
              const anchorTarget = parentNode._astNode || parentNode;
              if (!anchorTarget._anchors) anchorTarget._anchors = [];
              anchorTarget._anchors.push({ name: child, origLine: srcLine, origCol: srcCol });
            }
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
          // Allow tag-shorthand heads like `div.image` or `button#submit` —
          // split on `.`/`#` and check the bare tag name. Without the
          // shorthand support here, expression children of `div.image x`
          // were silently dropped from the type-check stub even though the
          // lower `__ripEl` branch (which uses the same split) emitted the
          // tag itself.
          const isTagHead = typeof head === 'string' && /^[a-z][\w-]*(?:[.#][\w-]+)*$/.test(head) &&
              !CodeEmitter.GENERATORS[head] && TEMPLATE_TAGS.has(head.split(/[.#]/)[0]);
          if (head === 'block') {
            for (let i = 1; i < node.length; i++) emitBareIdent(node[i], node, false);
          } else if (isTagHead) {
            for (let i = 1; i < node.length; i++) emitBareIdent(node[i], node, true);
            // Emit expression children of intrinsic tags for type-checking.
            // Without this, text content like "#{item.name}" in `li "#{item.name}"`
            // is invisible to TypeScript and loop variables appear unused (TS 6133).
            for (let i = 1; i < node.length; i++) {
              const child = node[i];
              if (!Array.isArray(child)) continue;
              const ch = child[0]?.valueOf?.() ?? child[0];
              if (ch === 'object' || ch === 'block' || ch === '__text__') continue;
              if (typeof ch === 'string') {
                if (/^[A-Z]/.test(ch)) continue;
                if (TEMPLATE_TAGS.has(ch.split(/[.#]/)[0])) continue;
                if (/^[a-z][\w-]*$/.test(ch) && !CodeEmitter.GENERATORS[ch]) continue;
                if (/^(if|unless|switch|for-in|for-of|for-as|while|until|loop|loop-n|try|throw|break|continue|break-if|continue-if|control|when|return|def|->|=>|class|enum|state|computed|readonly|effect|=|program)$/.test(ch)) continue;
              }
              try {
                const exprCode = this.emitInComponent(child, 'value');
                const srcLine = child.loc?.r ?? node.loc?.r;
                const srcMarker = srcLine != null ? ` // @rip-src:${srcLine}` : '';
                constructions.push(`    ${exprCode};${srcMarker}`);
              } catch {}
            }
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
            // Emit @-event handler bodies as bare expression statements so
            // TS can resolve identifiers inside them (hover, completion).
            // They aren't part of the component's declared prop type.
            if (props.sideExprs) {
              for (const s of props.sideExprs) {
                constructions.push(`    ${s.code};` + (s.srcLine != null ? ` // @rip-src:${s.srcLine}` : ''));
              }
            }
          } else if (typeof head === 'string' && !CodeEmitter.GENERATORS[head] && (TEMPLATE_TAGS.has(head.split(/[.#]/)[0]) ||
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
      const val = this.emitInComponent(value, 'value');
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
      if (isPublic && (required || value === undefined)) {
        lines.push(`    this.${name} = __state(props.__bind_${name}__ ?? props.${name});`);
      } else if (isPublic) {
        const val = this.emitInComponent(value, 'value');
        lines.push(`    this.${name} = __state(props.__bind_${name}__ ?? props.${name} ?? ${val});`);
      } else {
        const val = this.emitInComponent(value, 'value');
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
      lines.push('    this.rest = __state(this._rest);');
    }

    // Computed (derived)
    for (const { name, expr } of derivedVars) {
      if (this.is(expr, 'block')) {
        const transformed = this.transformComponentMembers(expr);
        const body = this.emitFunctionBody(transformed);
        lines.push(`    this.${name} = __computed(() => ${body});`);
      } else {
        const val = this.emitInComponent(expr, 'value');
        lines.push(`    this.${name} = __computed(() => ${val});`);
      }
    }

    // Offered vars (share with descendants via setContext — after all members are initialized)
    for (const name of offeredVars) {
      lines.push(`    setContext('${name}', this.${name});`);
    }

    // Effects (see comment on the parallel block above)
    for (const effect of effects) {
      const effectBody = effect[2];
      const isAsync = this.containsAwait(effectBody) ? 'async ' : '';
      if (this.is(effectBody, 'block')) {
        const transformed = this.transformComponentMembers(effectBody);
        const body = this.emitFunctionBody(transformed);
        lines.push(`    __effect(${isAsync}() => ${body});`);
      } else {
        const effectCode = this.emitInComponent(effectBody, 'value');
        lines.push(`    __effect(${isAsync}() => { return ${effectCode}; });`);
      }
    }

    lines.push('  }');

    if (inheritsTag) {
      lines.push('  _setRestProp(key, value) {');
      lines.push('    if (key.startsWith(\'__bind_\')) return;');
      lines.push('    this._rest || (this._rest = {});');
      lines.push('    if (value == null) delete this._rest[key];');
      lines.push('    else this._rest[key] = value;');
      lines.push('    this.rest.touch();');
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
        const bodyCode = this.emitFunctionBody(transformed, params || []);
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
        const bodyCode = this.emitFunctionBody(transformed, params || []);
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
  proto.emitInComponent = function(sexpr, context) {
    if (typeof sexpr === 'string' && this.reactiveMembers && this.reactiveMembers.has(sexpr)) {
      return `${this._self}.${sexpr}.value`;
    }
    if (typeof sexpr === 'string' && this.componentMembers && this.componentMembers.has(sexpr)) {
      return `${this._self}.${sexpr}`;
    }
    if (Array.isArray(sexpr) && this.reactiveMembers) {
      const transformed = this.transformComponentMembers(sexpr);
      return this.emit(transformed, context);
    }
    return this.emit(sexpr, context);
  };

  /**
   * Handle standalone render (outside component): error
   */
  proto.emitRender = function(head, rest, context, sexpr) {
    this.error('render blocks can only be used inside a component', sexpr);
  };

  proto.emitOffer = function(head, rest, context, sexpr) {
    this.error('offer can only be used inside a component', sexpr);
  };

  proto.emitAccept = function(head, rest, context, sexpr) {
    this.error('accept can only be used inside a component', sexpr);
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
    this._renderLocalScope = new Set();
    this._renderTopLocals = new Set(); // class-mode (top-level _create) hoisted lets
    this._fragChildren = new Map();
    this._pendingAutoWire = false;
    this._autoWireEl = null;
    this._autoWireExplicit = null;
    this._inheritsTargetBound = false;

    const statements = this.is(body, 'block') ? body.slice(1) : [body];

    // Pre-count renderable (non-binding) statements so the single-renderable
    // optimization survives the presence of leading binding statements like
    // `code = expr`. Bindings are emitted into _createLines as JS but
    // produce no DOM child to append.
    const renderableCount = statements.reduce(
      (n, s) => n + (this._isRenderBinding(s) ? 0 : 1), 0);

    let rootVar;
    if (statements.length === 0 || (statements.length === 1 && statements[0] === 'null')) {
      rootVar = 'null';
    } else if (renderableCount === 0) {
      // All statements are bindings — emit them and return a comment placeholder
      for (const stmt of statements) this.emitNode(stmt);
      rootVar = this.newElementVar('empty');
      this._createLines.push(`${rootVar} = document.createComment('');`);
    } else if (renderableCount === 1) {
      this._pendingAutoWire = !!this._autoEventHandlers;
      let onlyRenderable = null;
      for (const stmt of statements) {
        const v = this.emitNode(stmt);
        if (v != null) onlyRenderable = v;
      }
      this._pendingAutoWire = false;
      rootVar = onlyRenderable;
    } else {
      rootVar = this.newElementVar('frag');
      this._createLines.push(`${rootVar} = document.createDocumentFragment();`);
      const children = [];
      for (const stmt of statements) {
        const childVar = this.emitNode(stmt);
        if (childVar == null) continue;
        this._createLines.push(`${rootVar}.appendChild(${childVar});`);
        children.push(childVar);
      }
      this._fragChildren.set(rootVar, children);
    }

    // Hoist class-mode render-local declarations to the top of _create() so
    // a) duplicate `name = ...` statements in source don't generate `let name`
    //    twice (strict-mode redeclaration error), and b) reads inside any
    //    enclosing IIFE/closure can see the binding.
    if (this._renderTopLocals.size > 0) {
      const decl = `let ${[...this._renderTopLocals].join(', ')};`;
      this._createLines.unshift(decl);
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

  /** Push an effect line, wrapping with disposer tracking in factory mode.
   *
   * Factory effects opt out of the runtime's auto-registration with the
   * current component (skipRegister:true). The factory's own `disposers`
   * array owns these — they're already cleaned up by d(detaching) when
   * the block is removed. Without skipRegister, every block re-render
   * would leak a stale disposer onto the parent's _disposers (the local
   * factory disposers get overwritten on each p() call, but the parent
   * keeps the stale references until parent unmount). */
  proto._pushEffect = function(body) {
    if (this._factoryMode) {
      this._setupLines.push(`disposers.push(__effect(() => { ${body} }, {skipRegister: true}));`);
    } else {
      this._setupLines.push(`__effect(() => { ${body} });`);
    }
  };

  // --------------------------------------------------------------------------
  // Render-scope locals — declarations like `code = expr` inside render
  // --------------------------------------------------------------------------
  // Tracked per-factory so emitNode can (a) emit `code = expr` as a real JS
  // local instead of a text node, and (b) treat subsequent `span code`
  // references as value reads instead of `<code>` element emissions. Each
  // block factory (loop body, conditional branch) is its own JS function,
  // so render locals don't cross factory boundaries; only loop vars do
  // (threaded via positional parameters from _loopVarStack).

  const _isPlainIdentifier = (s) =>
    typeof s === 'string' && /^[A-Za-z_$][\w$]*$/.test(s);

  // Assignment-shape heads that emit as JS statements at render-block top
  // level instead of being wrapped in createTextNode. `=` declares a new
  // local; compound forms mutate an existing one.
  const _ASSIGN_HEADS = new Set([
    '=', '+=', '-=', '*=', '/=', '%=', '**=',
    '&&=', '||=', '?=', '??=',
  ]);

  proto._isRenderBinding = function(stmt) {
    return Array.isArray(stmt) && _ASSIGN_HEADS.has(stmt[0]) && _isPlainIdentifier(stmt[1]);
  };

  proto._addRenderLocal = function(name) {
    if (this._renderLocalScope) this._renderLocalScope.add(name);
  };

  proto._isRenderLocal = function(name) {
    if (!name || typeof name !== 'string') return false;
    if (this._renderLocalScope && this._renderLocalScope.has(name)) return true;
    if (this._loopVarStack) {
      // Loop vars ARE threaded across nested factories as positional
      // parameters, so any ancestor loop var is in scope inside any
      // descendant factory function.
      for (const v of this._loopVarStack) {
        if (v.itemVar === name || v.indexVar === name) return true;
      }
    }
    return false;
  };

  // --------------------------------------------------------------------------
  // emitNode — main dispatch for all render tree nodes
  // --------------------------------------------------------------------------

  proto.emitNode = function(sexpr) {
    // Render-scope assignment — `code = expr` and compound forms (`+=`,
    // `-=`, etc.) become JS statements at this position rather than text
    // nodes. Returning null tells the caller "no DOM child to append".
    // `=` also declares the local: hoisted via _factoryVars (factory mode)
    // or _renderTopLocals (class mode) and added to _renderLocalScope so
    // subsequent references resolve to the local instead of an HTML tag.
    if (this._isRenderBinding(sexpr)) {
      const [op, name, expr] = sexpr;
      const exprCode = this.emitInComponent(expr, 'value');
      if (op === '=') {
        (this._factoryMode ? this._factoryVars : this._renderTopLocals).add(name);
        this._addRenderLocal(name);
      }
      this._createLines.push(`${name} ${op} ${exprCode};`);
      return null;
    }

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
      // Render-scope local (binding from `code = expr` or a loop var) — emit
      // as a value read, NOT a tag. Lexical bindings shadow HTML tag names.
      if (this._isRenderLocal(str)) {
        const textVar = this.newTextVar();
        this._createLines.push(`${textVar} = document.createTextNode(String(${str}));`);
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
      return this.emitChildComponent(headStr, rest);
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
        if (Array.isArray(chain) && chain[0] === 'if') return this.emitConditional(chain);
        return this.emitTemplateBlock(chain);
      }
      const cv = this.newElementVar('c');
      this._createLines.push(`${cv} = document.createComment('switch');`);
      return cv;
    }

    // HTML tag (possibly with #id, e.g. div#content). A render-local with
    // the same name as an HTML tag wins — `code "hi"` after `code = fn`
    // is a function call, not a `<code>` element. Checking the full
    // headStr (not just the part before `#id`) means `div#main` naturally
    // dispatches as a tag even when a `div` local exists, since locals
    // are plain identifiers and can't contain `#`.
    if (headStr && this.isHtmlTag(headStr) && !meta(head, 'text') &&
        !this._isRenderLocal(headStr)) {
      let [tagName, id] = headStr.split('#');
      return this.emitTag(tagName || 'div', [], rest, id);
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

      // HTML tag with classes (div.class) — skip if base is marked .text by
      // = prefix, and skip if the root is a render-local (so `code.value`
      // after `code = obj` reads obj.value, not <code class="value">).
      const { tag, classes, id, base } = this.collectTemplateClasses(sexpr);
      if (!meta(base, 'text') && tag && this.isHtmlTag(tag) && !this._isRenderLocal(tag)) {
        return this.emitTag(tag, classes, [], id);
      }

      // General property access (e.g., item.name in a loop)
      const textVar = this.newTextVar();
      const exprCode = this.emitInComponent(sexpr, 'value');
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
            return this.emitDynamicTag(tag, classExprs, rest, staticArgs, id);
          }
        }
        const tag = typeof tagExpr === 'string' ? tagExpr : tagExpr.valueOf();
        return this.emitDynamicTag(tag, classExprs, rest);
      }

      const { tag, classes, id } = this.collectTemplateClasses(head);
      if (tag && this.isHtmlTag(tag) && !this._isRenderLocal(tag)) {
        // Dynamic class syntax: div.("classes") or div.card.("classes")
        if (classes.length > 0 && classes[classes.length - 1] === '__clsx') {
          const staticClasses = classes.slice(0, -1);
          const staticArgs = staticClasses.map(c => `"${c}"`);
          return this.emitDynamicTag(tag, rest, [], staticArgs, id);
        }
        return this.emitTag(tag, classes, rest, id);
      }
    }

    // Arrow function (children block)
    if (headStr === '->' || headStr === '=>') {
      return this.emitTemplateBlock(rest[1]);
    }

    // Conditional: if/else
    if (headStr === 'if') {
      return this.emitConditional(sexpr);
    }

    // For loop
    if (headStr === 'for' || headStr === 'for-in' || headStr === 'for-of' || headStr === 'for-as') {
      return this.emitTemplateLoop(sexpr);
    }

    // Synthetic text node inserted by rewriteRender for `= expr`
    if (headStr === '__text__') {
      const expr = rest[0] ?? 'undefined';
      const textVar = this.newTextVar();
      const exprCode = this.emitInComponent(expr, 'value');
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
    const exprCode = this.emitInComponent(sexpr, 'value');
    if (this.hasReactiveDeps(sexpr)) {
      this._createLines.push(`${textVar} = document.createTextNode('');`);
      this._pushEffect(`${textVar}.data = ${exprCode};`);
    } else {
      this._createLines.push(`${textVar} = document.createTextNode(String(${exprCode}));`);
    }
    return textVar;
  };

  // --------------------------------------------------------------------------
  // appendChildren — shared child-processing loop for emitTag/emitDynamicTag
  // --------------------------------------------------------------------------

  proto.appendChildren = function(elVar, args) {
    for (const arg of args) {
      if (this.is(arg, '->') || this.is(arg, '=>')) {
        const block = arg[2];
        if (this.is(block, 'block')) {
          for (const child of block.slice(1)) {
            if (this.is(child, 'object')) {
              this.emitAttributes(elVar, child);
            } else {
              const childVar = this.emitNode(child);
              if (childVar == null) continue;
              this._createLines.push(`${elVar}.appendChild(${childVar});`);
            }
          }
        } else if (block) {
          const childVar = this.emitNode(block);
          if (childVar != null) {
            this._createLines.push(`${elVar}.appendChild(${childVar});`);
          }
        }
      }
      else if (this.is(arg, 'object')) {
        this.emitAttributes(elVar, arg);
      }
      else if (typeof arg === 'string' || arg instanceof String) {
        const val = arg.valueOf();
        // Template tag appearing as a string arg (e.g., slot after multi-line attrs).
        // Render-scope locals (and loop vars) take precedence over the HTML tag
        // sugar — `for code in items \n span code` should mean text content,
        // not a nested <code> element. JSX-equivalent: if `code` is a let
        // binding in scope, `<span>{code}</span>`, never `<span><code/></span>`.
        // (Render-local names are plain identifiers — no `#id` or `.class`
        // tail can ever be one — so checking the base name alone is enough.)
        const baseName = val.split(/[#.]/)[0];
        if (!this._isRenderLocal(baseName) && (this.isHtmlTag(baseName || 'div') || this.isComponent(baseName))) {
          const childVar = this.emitNode(arg);
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
            this._createLines.push(`${textVar} = document.createTextNode(${this.emitInComponent(arg, 'value')});`);
          }
          this._createLines.push(`${elVar}.appendChild(${textVar});`);
        }
      }
      else if (arg) {
        const childVar = this.emitNode(arg);
        if (childVar != null) {
          this._createLines.push(`${elVar}.appendChild(${childVar});`);
        }
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
  // emitTag — HTML element with static classes and children
  // --------------------------------------------------------------------------

  proto.emitTag = function(tag, classes, args, id) {
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
  // emitDynamicTag — tag with .() CLSX dynamic classes
  // --------------------------------------------------------------------------

  proto.emitDynamicTag = function(tag, classExprs, children, staticClassArgs, id) {
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
    const classArgs = [...(staticClassArgs || []), ...classExprs.map(e => this.emitInComponent(e, 'value'))];
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
  // emitAttributes — attributes, events, and bindings on an element
  // --------------------------------------------------------------------------

  proto.emitAttributes = function(elVar, objExpr) {
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
          const handlerCode = this.emitInComponent(value, 'value');
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
          const valueCode = this.emitInComponent(value, 'value');
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
          const valueCode = this.emitInComponent(value, 'value');

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

        const valueCode = this.emitInComponent(value, 'value');

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
  // emitTemplateBlock — a block of template children
  // --------------------------------------------------------------------------

  proto.emitTemplateBlock = function(body) {
    if (!Array.isArray(body) || body[0] !== 'block') {
      const v = this.emitNode(body);
      if (v != null) return v;
      // Lone binding (e.g., `code = expr`) at the position where a child
      // node was expected — emit a placeholder so the caller has something
      // to insert. The binding itself was already pushed into _createLines.
      const commentVar = this.newElementVar('empty');
      this._createLines.push(`${commentVar} = document.createComment('');`);
      return commentVar;
    }

    const statements = body.slice(1);
    if (statements.length === 0) {
      const commentVar = this.newElementVar('empty');
      this._createLines.push(`${commentVar} = document.createComment('');`);
      return commentVar;
    }

    const renderableCount = statements.reduce(
      (n, s) => n + (this._isRenderBinding(s) ? 0 : 1), 0);

    if (renderableCount === 0) {
      for (const stmt of statements) this.emitNode(stmt);
      const commentVar = this.newElementVar('empty');
      this._createLines.push(`${commentVar} = document.createComment('');`);
      return commentVar;
    }

    if (renderableCount === 1) {
      let only = null;
      for (const stmt of statements) {
        const v = this.emitNode(stmt);
        if (v != null) only = v;
      }
      return only;
    }

    const fragVar = this.newElementVar('frag');
    this._createLines.push(`${fragVar} = document.createDocumentFragment();`);
    const children = [];
    for (const stmt of statements) {
      const childVar = this.emitNode(stmt);
      if (childVar == null) continue;
      this._createLines.push(`${fragVar}.appendChild(${childVar});`);
      children.push(childVar);
    }
    this._fragChildren.set(fragVar, children);
    return fragVar;
  };

  // --------------------------------------------------------------------------
  // emitConditional — reactive if/else using block factories
  // --------------------------------------------------------------------------

  proto.emitConditional = function(sexpr) {
    this._pendingAutoWire = false;

    // Fold flat else-if chains into nested structure.
    // Parser emits: ['if', c1, t1, ['if', c2, t2], ..., finalElse]
    // We need:      ['if', c1, t1, ['if', c2, t2, [..., finalElse]]]
    if (sexpr.length > 4) {
      let chain = sexpr[sexpr.length - 1];
      for (let i = sexpr.length - 2; i >= 3; i--) {
        chain = [...sexpr[i], chain];
      }
      sexpr = [sexpr[0], sexpr[1], sexpr[2], chain];
    }

    const [, condition, thenBlock, elseBlock] = sexpr;

    const anchorVar = this.newElementVar('anchor');
    this._createLines.push(`${anchorVar} = document.createComment('if');`);

    const condCode = this.emitInComponent(condition, 'value');

    const outerParams = this._loopVarStack.map(v => `${v.itemVar}, ${v.indexVar}`).join(', ');
    const outerExtra = outerParams ? `, ${outerParams}` : '';

    const thenBlockName = this.newBlockVar();
    this.emitConditionBranch(thenBlockName, thenBlock);

    let elseBlockName = null;
    if (elseBlock) {
      elseBlockName = this.newBlockVar();
      this.emitConditionBranch(elseBlockName, elseBlock);
    }

    const setupLines = [];
    setupLines.push(`// Conditional: ${thenBlockName}${elseBlockName ? ' / ' + elseBlockName : ''}`);
    setupLines.push(`{`);
    setupLines.push(`  const anchor = ${anchorVar};`);
    setupLines.push(`  let currentBlock = null;`);
    setupLines.push(`  let showing = null;`);
    // Factory effects skip auto-registration on the parent component
    // (their disposers live in the local `disposers` array and are
    // cleaned up by d(detaching)). Class-mode effects auto-register
    // on `this` via the runtime's __getCurrentComponent bridge.
    const effOpen = this._factoryMode ? 'disposers.push(__effect(() => {' : '__effect(() => {';
    const effClose = this._factoryMode ? '}, {skipRegister: true}));' : '});';
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
    // Block teardown: when this conditional's enclosing scope ends
    // (factory block detach, or parent component unmount), destroy
    // the currentBlock so its DOM, effects, and child components
    // are fully cleaned up. Without this, parent unmount would
    // dispose the reactive effect (preventing future re-runs) but
    // leave currentBlock alive — its child components, signal
    // subscriptions, and detached DOM stay pinned in memory.
    if (this._factoryMode) {
      setupLines.push(`  disposers.push(() => { if (currentBlock) { currentBlock.d(true); currentBlock = null; } });`);
    } else {
      // Class mode: register on parent component's _disposers via the
      // __getCurrentComponent bridge (the same pathway __effect uses).
      setupLines.push(`  { const __cur = globalThis.__ripComponent?.__getCurrentComponent?.(); if (__cur) (__cur._disposers ??= []).push(() => { if (currentBlock) { currentBlock.d(true); currentBlock = null; } }); }`);
    }
    setupLines.push(`}`);

    this._setupLines.push(setupLines.join('\n    '));

    return anchorVar;
  };

  // --------------------------------------------------------------------------
  // emitConditionBranch — block factory for a conditional branch
  // --------------------------------------------------------------------------

  proto.emitConditionBranch = function(blockName, block) {
    const saved = [this._createLines, this._setupLines, this._factoryMode, this._factoryVars, this._renderLocalScope];

    this._createLines = [];
    this._setupLines = [];
    this._factoryMode = true;
    this._factoryVars = new Set();
    // Fresh render-local scope per factory function (see emitTemplateLoop).
    this._renderLocalScope = new Set();

    const rootVar = this.emitTemplateBlock(block);
    const createLines = this._createLines;
    const setupLines = this._setupLines;
    const factoryVars = this._factoryVars;

    [this._createLines, this._setupLines, this._factoryMode, this._factoryVars, this._renderLocalScope] = saved;

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
    // Per-factory list of child-component instances created inside this
    // block. d(detaching) calls .unmount() on each so child lifecycle
    // hooks fire and child effects get cleaned up when the block is
    // removed by reactive rendering (a `for` loop iteration changing,
    // an `if` branch flipping, etc.). Without this, child instances
    // were only ever unmounted when the OUTER component itself died,
    // which silently broke the `beforeUnmount` / `unmounted` contract
    // for any child rendered inside a conditional or loop.
    factoryLines.push(`  let _factoryChildren = [];`);

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
    // Unmount any child components inside this block FIRST, so their
    // lifecycle hooks and effect disposers fire before we drop our own
    // disposers and DOM. removeDOM:false because the parent DOM removal
    // (below) will detach the whole subtree in one shot.
    factoryLines.push(`      for (const __c of _factoryChildren) { try { __c.unmount?.({removeDOM: false}); } catch (__e) { console.error('[Rip] factory child unmount error:', __e); } }`);
    factoryLines.push(`      _factoryChildren = [];`);
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
  // emitTemplateLoop — reactive for-loop with keyed reconciliation
  // --------------------------------------------------------------------------

  proto.emitTemplateLoop = function(sexpr) {
    this._pendingAutoWire = false;
    const [head, vars, collection, guard, step, body] = sexpr;

    const blockName = this.newBlockVar();

    const anchorVar = this.newElementVar('anchor');
    this._createLines.push(`${anchorVar} = document.createComment('for');`);

    const varNames = Array.isArray(vars) ? vars : [vars];
    const itemVar = varNames[0];
    let indexVar = varNames[1] || null;
    if (!indexVar) {
      // Pick a name that won't collide with:
      //   * outer loop vars (already in _loopVarStack)
      //   * the current item var
      //   * any explicit `for` var or render-local declaration ANYWHERE in
      //     the body subtree (any depth, through conditionals and nested
      //     loops alike)
      // The third check is what closes the "duplicate-name" family of
      // strict-mode errors: the outer loop's auto-index becomes a
      // positional parameter of every nested factory's patch function, so
      // any `let i;` (from `i = ...`) or any explicit `for v, i in ...`
      // anywhere inside would clash with an auto-allocated `i`.
      const usedNames = new Set(this._loopVarStack.flatMap(v => [v.itemVar, v.indexVar]));
      usedNames.add(itemVar);
      this._collectBodyBindings(body, usedNames);
      for (const candidate of ['i', 'j', 'k', 'l', 'm', 'n']) {
        if (!usedNames.has(candidate)) { indexVar = candidate; break; }
      }
      // Last-resort fallback uses a mangled name no normal user identifier
      // collides with (double underscore prefix matches the convention used
      // by other compiler-internal names like __ripComponent, __reconcile).
      indexVar = indexVar || `__rip_idx${this._loopVarStack.length}`;
    }

    const collectionCode = this.emitInComponent(collection, 'value');

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
                keyExpr = this.emit(v, 'value');
                break;
              }
            }
          }
          if (keyExpr !== itemVar) break;
        }
      }
    }

    const saved = [this._createLines, this._setupLines, this._factoryMode, this._factoryVars, this._renderLocalScope];

    this._createLines = [];
    this._setupLines = [];
    this._factoryMode = true;
    this._factoryVars = new Set();
    // Loop body is its own JS factory function — render locals from the
    // surrounding scope are NOT visible here. Loop vars are explicitly
    // threaded as positional parameters via _loopVarStack.
    this._renderLocalScope = new Set();

    const outerParams = this._loopVarStack.map(v => `${v.itemVar}, ${v.indexVar}`).join(', ');
    const outerExtra = outerParams ? `, ${outerParams}` : '';

    this._loopVarStack.push({ itemVar, indexVar });
    const itemNode = this.emitTemplateBlock(body);
    this._loopVarStack.pop();
    const itemCreateLines = this._createLines;
    const itemSetupLines = this._setupLines;
    const itemFactoryVars = this._factoryVars;

    [this._createLines, this._setupLines, this._factoryMode, this._factoryVars, this._renderLocalScope] = saved;

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
    // Same skipRegister contract as the conditional emitter above.
    const effOpen = this._factoryMode ? 'disposers.push(__effect(() => {' : '__effect(() => {';
    const effClose = this._factoryMode ? '}, {skipRegister: true}));' : '});';
    setupLines.push(`  ${effOpen}`);
    setupLines.push(`    __reconcile(${anchorVar}, __s, ${collectionCode}, ${this._self}, ${blockName}, ${keyFnCode}${outerArgs});`);
    setupLines.push(`  ${effClose}`);
    // Loop teardown: destroy every block in state.blocks on parent
    // unmount (or enclosing factory detach). __reconcile only destroys
    // blocks that are removed mid-render; blocks that exist at the
    // time the parent dies would otherwise leak their DOM, child
    // components, and effect subscriptions. Same shape as the
    // conditional emitter's block-teardown disposer.
    if (this._factoryMode) {
      setupLines.push(`  disposers.push(() => { for (const __b of __s.blocks) { try { __b.d(true); } catch {} } __s.blocks = []; __s.keys = []; __s.items = []; });`);
    } else {
      setupLines.push(`  { const __cur = globalThis.__ripComponent?.__getCurrentComponent?.(); if (__cur) (__cur._disposers ??= []).push(() => { for (const __b of __s.blocks) { try { __b.d(true); } catch {} } __s.blocks = []; __s.keys = []; __s.items = []; }); }`);
    }
    setupLines.push(`}`);

    this._setupLines.push(setupLines.join('\n    '));

    return anchorVar;
  };

  // --------------------------------------------------------------------------
  // emitChildComponent — instantiate a child component
  // --------------------------------------------------------------------------

  proto.emitChildComponent = function(componentName, args) {
    this._pendingAutoWire = false;
    const instVar = this.newElementVar('inst');
    const elVar = this.newElementVar('el');
    const { propsCode, reactiveProps, eventBindings, childrenSetupLines } = this.buildComponentProps(args);

    const s = this._self;
    // Push parent (s) so its constructor-time __pushComponent stack is
    // preserved across child instantiation. Then push the CHILD around
    // its _create() / _setup() calls so any __effect those methods
    // create auto-registers on the child's _disposers, not the parent's.
    //
    // Partial-construction failure handling. Two cases produce a broken
    // child whose _create/_setup would crash:
    //   1. _init throws and a parent onError boundary handles it. The
    //      constructor sets ._initFailed and returns the (broken)
    //      instance. We detect via the flag.
    //   2. _init throws and no boundary handles it. __handleComponentError
    //      re-throws from the constructor; OR _create itself throws
    //      after a successful _init. The outer try/catch handles both.
    // In all failure modes we substitute a comment-node placeholder so
    // the parent's appendChild later still finds a valid node, log the
    // error, and don't push the broken instance onto _children (so the
    // unmount cascade doesn't walk into it).
    this._createLines.push(`{ const __prev = __pushComponent(${s}); try {`);
    this._createLines.push(`try {`);
    this._createLines.push(`${instVar} = new ${componentName}(${propsCode});`);
    this._createLines.push(`if (${instVar} && ${instVar}._initFailed) {`);
    // _init may have registered effects, contexts, or sub-children
    // before throwing. unmount({removeDOM:false}) releases them; the
    // instance never reached a usable state but its partial side
    // effects need cleanup. Idempotent so safe even when nothing was
    // registered yet.
    this._createLines.push(`  try { ${instVar}.unmount({removeDOM: false}); } catch (__ue) { console.error('[Rip] partial-init unmount error:', __ue); }`);
    this._createLines.push(`  ${instVar} = null;`);
    this._createLines.push(`  ${elVar} = document.createComment('rip:child-init-failed: ${componentName}');`);
    this._createLines.push(`} else {`);
    this._createLines.push(`  { const __cprev = __pushComponent(${instVar}); try {`);
    this._createLines.push(`    ${elVar} = ${instVar}._root = ${instVar}._create();`);
    this._createLines.push(`  } finally { __popComponent(__cprev); } }`);
    if (this._factoryMode) {
      // Factory blocks (for/if in render) own their child instances
      // exclusively. Don't pin them on the PARENT's _children — that
      // array would grow unboundedly on loop churn (every removed
      // iteration would leave a stale reference). The factory's
      // d(detaching) iterates _factoryChildren and unmounts them; on
      // parent unmount, the parent's own disposer chain destroys the
      // factory block, which cascades to these children via d().
      this._createLines.push(`  _factoryChildren.push(${instVar});`);
    } else {
      // Class-mode children: parent's _children is the canonical owner.
      // Parent.unmount() cascades to _children for proper teardown.
      this._createLines.push(`  (${s}._children || (${s}._children = [])).push(${instVar});`);
    }
    this._createLines.push(`}`);
    this._createLines.push(`} catch (__childErr) {`);
    this._createLines.push(`  console.error('[Rip] ${componentName} construction failed:', __childErr);`);
    // If _init succeeded but _create threw, the partial instance has
    // _init-time effects, contexts, and possibly children registered.
    // Unmount it (with removeDOM:false; nothing was inserted into DOM
    // yet) so those resources release. unmount is idempotent so
    // redundant calls are safe.
    this._createLines.push(`  if (${instVar}) { try { ${instVar}.unmount({removeDOM: false}); } catch (__ue) { console.error('[Rip] partial-child unmount error:', __ue); } }`);
    this._createLines.push(`  ${instVar} = null;`);
    this._createLines.push(`  ${elVar} = document.createComment('rip:child-error: ${componentName}');`);
    this._createLines.push(`}`);
    this._createLines.push(`} finally { __popComponent(__prev); } }`);

    for (const { event, value } of eventBindings) {
      const handlerCode = this.emitInComponent(value, 'value');
      this._createLines.push(`if (${instVar}) ${elVar}.addEventListener('${event}', (e) => __batch(() => (${handlerCode})(e)));`);
    }

    // Per-child push wrap for the full lifecycle invocation. ALL of
    // beforeMount, _setup, and mounted run with the child as the
    // current component, so any __effect they create auto-registers
    // on the child's _disposers (via the __getCurrentComponent
    // bridge), not the parent's. Guards:
    //   - instVar null-check (failed-init placeholder branch above).
    //   - _isSetup flag so the lifecycle runs ONCE even when this
    //     setupLines block is re-executed by a factory's p() on every
    //     reactive update. Class mode runs setupLines once anyway;
    //     the flag is harmless there.
    //   - Flag set BEFORE the calls so a recursive setup couldn't
    //     re-enter and loop.
    //   - beforeMount fires before _setup so user code has a hook
    //     after construction but before reactive bindings activate
    //     (matches the renderer's contract for page/layout
    //     components).
    this._setupLines.push(`if (${instVar} && !${instVar}._isSetup) { ${instVar}._isSetup = true; const __cprev = __pushComponent(${instVar}); try { try { if (${instVar}.beforeMount) ${instVar}.beforeMount(); if (${instVar}._setup) ${instVar}._setup(); if (${instVar}.mounted) ${instVar}.mounted(); } catch (__e) { __handleComponentError(__e, ${instVar}); } } finally { __popComponent(__cprev); } }`);

    for (const { key, valueCode } of reactiveProps) {
      // Outer instVar guard: if _init / _create failed and the
      // placeholder branch substituted null for the instance, this
      // prop-updater effect would otherwise dereference null on every
      // signal change. The guard mirrors the event-listener emission
      // a few lines above.
      this._pushEffect(`if (${instVar}) { if (${instVar}.${key} && typeof ${instVar}.${key} === 'object' && 'value' in ${instVar}.${key}) ${instVar}.${key}.value = ${valueCode}; else if (${instVar}._setRestProp) ${instVar}._setRestProp('${key}', ${valueCode}); }`);
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
        const valueCode = this.emitInComponent(value, 'value');
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

    // Bare identifier args become boolean prop shorthand:
    //   Button outline, link, "Save"
    // is equivalent to:
    //   Button outline: true, link: true, "Save"
    // Matches JSX semantics — the bare identifier is ALWAYS a literal `true`
    // prop key, never a variable reference, even if a same-named local
    // binding exists in scope. To pass a variable, write `outline: outline`.
    // Scoped to PascalCase component calls (this function's only caller is
    // emitChildComponent), so DOM element calls and non-render imperative
    // calls are unaffected.
    const BARE_IDENT_RE = /^[a-zA-Z_$][\w$]*$/;
    const isBareIdent = (a) => typeof a === 'string' && BARE_IDENT_RE.test(a);

    for (const arg of args) {
      if (this.is(arg, 'object')) {
        addObjectProps(arg);
      } else if (isBareIdent(arg)) {
        addProp(arg, 'true');
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
            // Save _createLines/_setupLines only — _factoryVars and
            // _renderLocalScope are intentionally shared because the
            // children-block JS is spliced back into the parent factory's
            // body (same JS function, same lexical scope).
            const savedCreateLines = this._createLines;
            const savedSetupLines = this._setupLines;
            this._createLines = [];
            this._setupLines = [];

            childrenVar = this.emitTemplateBlock(block);

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
        const exprCode = this.emitInComponent(arg, 'value');
        if (this.hasReactiveDeps(arg)) {
          this._createLines.push(`${textVar} = document.createTextNode('');`);
          const body = `${textVar}.data = ${exprCode};`;
          const effect = this._factoryMode
            ? `disposers.push(__effect(() => { ${body} }, {skipRegister: true}));`
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

  // _collectBodyBindings — gather every name bound inside a render subtree
  // --------------------------------------------------------------------------
  // Used by emitTemplateLoop to skip auto-allocating an outer index name
  // that would later show up as either a positional parameter (explicit
  // `for-in`/`for-of`/`for-as` var at any depth) or a hoisted `let`
  // (`name = expr` at any depth) inside a descendant factory function. A
  // collision at any nesting depth is real because the outer index is
  // threaded as a positional parameter of EVERY descendant factory.

  proto._collectBodyBindings = function(node, set) {
    if (!Array.isArray(node)) return;
    const head = node[0];
    if (head === 'for-in' || head === 'for-of' || head === 'for-as') {
      const vars = node[1];
      const names = Array.isArray(vars) ? vars : [vars];
      for (const n of names) {
        if (typeof n === 'string') set.add(n);
      }
    } else if (head === '=' && _isPlainIdentifier(node[1])) {
      set.add(node[1]);
    }
    for (let i = 1; i < node.length; i++) {
      this._collectBodyBindings(node[i], set);
    }
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
  // The component stack tracks the currently-active scope (so __effect
  // and friends can find it). Parent assignment happens ONCE — on the
  // first push that has a non-self predecessor. Later pushes (mount,
  // beforeMount, factory re-entry) preserve the existing chain.
  //
  // Without the "set once" guard, the renderer's careful threading of
  // outer-layout -> inner-layout -> page would survive construction
  // but get clobbered the moment any of those components got re-pushed
  // for its own lifecycle — a subsequent push with prev=null would
  // overwrite the construction-time parent. Cross-layout context
  // (offer in outer / accept in page) was silently broken.
  const prev = __currentComponent;
  if (component && component._parent == null && prev && prev !== component) {
    component._parent = prev;
  }
  __currentComponent = component;
  return prev;
}

function __popComponent(prev) {
  __currentComponent = prev;
}

// Bridge for the reactive runtime in compiler.js. __effect calls this to
// auto-register its disposer with the component currently being
// constructed/mounted, so the disposer fires on component unmount.
function __getCurrentComponent() {
  return __currentComponent;
}

function setContext(key, value) {
  if (!__currentComponent) throw new Error('setContext must be called during component initialization');
  if (!__currentComponent._context) __currentComponent._context = new Map();
  __currentComponent._context.set(key, value);
}

function getContext(key) {
  let component = __currentComponent;
  // Cycle guard: see __handleComponentError above. A buggy _parent
  // chain shouldn't hang lookup of a missing key.
  const visited = new Set();
  while (component && !visited.has(component)) {
    visited.add(component);
    if (component._context && component._context.has(key)) return component._context.get(key);
    component = component._parent;
  }
  return undefined;
}

function hasContext(key) {
  let component = __currentComponent;
  const visited = new Set();
  while (component && !visited.has(component)) {
    visited.add(component);
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
  const oldItems = state.items || [];
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
    state.items = items.slice();
    state.blocks = newBlocks;
    return;
  }

  // Phase 1: prefix scan — skip p() ONLY when key AND item identity
  // match. With a custom keyFn, a stable key can be reused across
  // different item references (e.g. when the user replaces an item
  // object with a new one that has the same id but different fields);
  // skipping p() in that case would leave the block displaying stale
  // data. Reference identity guards this.
  let start = 0;
  const minLen = oldLen < newLen ? oldLen : newLen;
  while (start < minLen && oldKeys[start] === newKeys[start]) {
    if (oldItems[start] !== items[start]) {
      const block = oldBlocks[start];
      if (!block._s) block.p(ctx, items[start], start, ...outer);
    }
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
  state.items = items.slice();
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
  // Defensive cycle guard: if the parent chain is corrupted (e.g. by
  // a buggy _parent assignment), we still terminate. The fix is in
  // __pushComponent above, but cycle detection here is cheap belt-
  // and-suspenders so a bad _parent never hangs the runtime.
  const visited = new Set();
  while (current && !visited.has(current)) {
    visited.add(current);
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
    try {
      this._init(props);
    } catch (e) {
      __popComponent(prev);
      // Mark this instance as having failed initialization so parent
      // emit-sites (emitChildComponent) can substitute a placeholder
      // instead of running _create / _setup on a broken instance.
      this._initFailed = true;
      // Run the user's error hook (parent-onError walk). If a boundary
      // handles it, control returns here and we leave the broken
      // instance to be handled via _initFailed. If no boundary exists,
      // __handleComponentError re-throws and the caller's outer
      // try/catch in emitChildComponent will substitute the same
      // placeholder.
      __handleComponentError(e, this);
      return;
    }
    __popComponent(prev);
  }
  _init() {}
  mount(target) {
    if (typeof target === "string") target = document.querySelector(target);
    this._target = target;
    // _create / _setup are wrapped with __pushComponent so any __effect
    // created inside (reactive attribute bindings, reactive text nodes,
    // child components, user '~>' effects) auto-registers its disposer
    // with this component via __getCurrentComponent in the runtime.
    // Without this wrapping, effects created here lived forever and
    // their cleanup functions never fired on unmount.
    const prev = __pushComponent(this);
    try {
      this._root = this._create();
      if (this._root) target.appendChild(this._root);
      if (this._setup) this._setup();
      if (this.mounted) this.mounted();
    } catch (error) {
      __handleComponentError(error, this);
    } finally {
      __popComponent(prev);
    }
    return this;
  }
  unmount({ removeDOM = true } = {}) {
    // Symmetric to mount: tear down lifecycle hooks, all auto-registered
    // effect disposers, child components, and (optionally) the DOM.
    //
    //   beforeUnmount  - user hook; runs while signals/effects are still
    //                    live, so user code can read final state.
    //   children       - cascade BEFORE this instance's disposers so
    //                    children can react to parent state during their
    //                    own teardown.
    //   _disposers     - effect disposers auto-registered by __effect
    //                    (cleared eagerly so a re-mount starts fresh).
    //   unmounted      - user hook; final notification.
    //   DOM removal    - skipped when caller wants to keep the old DOM
    //                    visible until replacement (route transitions).
    //
    // Idempotent: a child can be unmounted by its enclosing factory's
    // d(detaching) AND later by the parent's unmount cascade. Without
    // the _unmounted guard, beforeUnmount/unmounted hooks would re-fire
    // and cleanup would walk an already-empty graph for no benefit.
    if (this._unmounted) return;
    this._unmounted = true;
    try {
      if (this.beforeUnmount) this.beforeUnmount();
    } catch (e) { console.error('[Rip] beforeUnmount error:', e); }
    if (this._children) {
      for (const child of this._children) {
        try { child.unmount({ removeDOM }); }
        catch (e) { console.error('[Rip] child unmount error:', e); }
      }
      this._children = null;
    }
    if (this._disposers) {
      for (const d of this._disposers) {
        try { d(); } catch (e) { console.error('[Rip] effect disposer error:', e); }
      }
      this._disposers = null;
    }
    try {
      if (this.unmounted) this.unmounted();
    } catch (e) { console.error('[Rip] unmounted error:', e); }
    if (removeDOM && this._root && this._root.parentNode) {
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
  globalThis.__ripComponent = { __pushComponent, __popComponent, __getCurrentComponent, setContext, getContext, hasContext, __clsx, __lis, __reconcile, __transition, __handleComponentError, __Component };
}

`;
  };
}
