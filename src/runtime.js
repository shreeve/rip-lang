// ============================================================================
// Rip Reactive Runtime
// ============================================================================
// Minimal reactive primitives that get inlined into compiled output.
// Zero dependencies.

// Current tracking context (the effect/computed currently being executed)
let currentEffect = null;

// Pending effects to run
let pendingEffects = new Set();

// ============================================================================
// Signal - Reactive value
// ============================================================================
export function signal(initialValue) {
  let value = initialValue;
  const subscribers = new Set();
  let notifying = false;

  return {
    get value() {
      // Track dependency if we're inside an effect/computed
      if (currentEffect) {
        subscribers.add(currentEffect);
        currentEffect.dependencies.add(subscribers);
      }
      return value;
    },
    set value(newValue) {
      if (newValue !== value && !notifying) {
        value = newValue;
        notifying = true;
        // Mark all computeds dirty first
        for (const s of subscribers) if (s.markDirty) s.markDirty();
        // Then queue effects
        for (const s of subscribers) if (!s.markDirty) pendingEffects.add(s);
        // Flush effects
        const fx = [...pendingEffects];
        pendingEffects.clear();
        for (const e of fx) e.run();
        notifying = false;
      }
    },
    // Allow reading without tracking
    read() {
      return value;
    },
    // Auto-unwrap for REPL and primitive coercion
    valueOf() {
      return this.value;
    },
    toString() {
      return String(this.value);
    },
    [Symbol.toPrimitive](hint) {
      return hint === 'string' ? this.toString() : this.valueOf();
    }
  };
}

// ============================================================================
// Computed - Derived value with automatic dependency tracking
// ============================================================================
export function computed(fn) {
  let value;
  let dirty = true;
  const subscribers = new Set();

  const comp = {
    dependencies: new Set(),
    markDirty() {
      if (!dirty) {
        dirty = true;
        // Propagate to dependent computeds first, then queue effects
        for (const s of subscribers) if (s.markDirty) s.markDirty();
        for (const s of subscribers) if (!s.markDirty) pendingEffects.add(s);
      }
    },
    get value() {
      // Track this computed as a dependency
      if (currentEffect) {
        subscribers.add(currentEffect);
        currentEffect.dependencies.add(subscribers);
      }

      // Recompute if dirty
      if (dirty) {
        // Clean up old dependencies
        for (const dep of comp.dependencies) {
          dep.delete(comp);
        }
        comp.dependencies.clear();

        // Track new dependencies
        const prevEffect = currentEffect;
        currentEffect = comp;
        try {
          value = fn();
        } finally {
          currentEffect = prevEffect;
        }
        dirty = false;
      }
      return value;
    },
    read() {
      if (dirty) {
        const prevEffect = currentEffect;
        currentEffect = null; // Don't track during read
        try {
          value = fn();
        } finally {
          currentEffect = prevEffect;
        }
        dirty = false;
      }
      return value;
    },
    // Auto-unwrap for REPL and primitive coercion
    valueOf() {
      return this.value;
    },
    toString() {
      return String(this.value);
    },
    [Symbol.toPrimitive](hint) {
      return hint === 'string' ? this.toString() : this.valueOf();
    }
  };

  return comp;
}

// ============================================================================
// Effect - Side effect that re-runs when dependencies change
// ============================================================================
export function effect(fn) {
  const eff = {
    dependencies: new Set(),
    run() {
      // Clean up old dependencies
      for (const dep of eff.dependencies) {
        dep.delete(eff);
      }
      eff.dependencies.clear();

      // Run the effect, tracking dependencies
      const prevEffect = currentEffect;
      currentEffect = eff;
      try {
        fn();
      } finally {
        currentEffect = prevEffect;
      }
    },
    dispose() {
      // Clean up all dependencies
      for (const dep of eff.dependencies) {
        dep.delete(eff);
      }
      eff.dependencies.clear();
    }
  };

  // Run immediately
  eff.run();

  // Return dispose function
  return () => eff.dispose();
}

// ============================================================================
// Batch - Group updates (simplified - signals handle their own notifications)
// ============================================================================
export function batch(fn) {
  fn();
}

// ============================================================================
// Readonly - Constant value that cannot be reassigned
// ============================================================================
export function readonly(value) {
  return Object.freeze({ value });
}

// ============================================================================
// Template Runtime - DOM creation helper
// ============================================================================

// SVG namespace
const SVG_NS = 'http://www.w3.org/2000/svg';

// SVG tags that need createElementNS
const SVG_TAGS = new Set([
  'svg', 'animate', 'animateMotion', 'animateTransform', 'circle', 'clipPath',
  'defs', 'desc', 'ellipse', 'feBlend', 'feColorMatrix', 'feComponentTransfer',
  'feComposite', 'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap',
  'feDistantLight', 'feDropShadow', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG',
  'feFuncR', 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode', 'feMorphology',
  'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile',
  'feTurbulence', 'filter', 'foreignObject', 'g', 'image', 'line', 'linearGradient',
  'marker', 'mask', 'metadata', 'mpath', 'path', 'pattern', 'polygon', 'polyline',
  'radialGradient', 'rect', 'set', 'stop', 'switch', 'symbol', 'text', 'textPath',
  'title', 'tspan', 'use', 'view'
]);

/**
 * Create a DOM element with props and children
 * @param {string} tag - Tag name (can include classes: "div.card.active")
 * @param {object|null|0} props - Attributes, events, and special props
 * @param {any} children - Child elements, text, or array
 * @returns {Element}
 *
 * Props:
 * - class: "card" or ["card", "active"] → className
 * - on*: onclick, onkeydown → addEventListener
 * - ref: variable → assigns element to variable (handled in generated code)
 * - key: value → data-key attribute
 * - others: setAttribute
 *
 * Children:
 * - string → text node
 * - Element → appendChild
 * - array → each child appended
 * - null/undefined → ignored
 */
export function h(tag, props, children) {
  // Parse tag for ID and classes: "div#main.card.active" → tag="div", id="main", classes=["card", "active"]
  let tagName = tag;
  let tagId = null;
  let tagClasses = null;

  // Handle #id and .class in any order
  const hashIndex = tag.indexOf('#');
  const dotIndex = tag.indexOf('.');

  if (hashIndex !== -1 || dotIndex !== -1) {
    // Find where the selectors start
    const selectorStart = hashIndex === -1 ? dotIndex : dotIndex === -1 ? hashIndex : Math.min(hashIndex, dotIndex);
    tagName = tag.slice(0, selectorStart);
    
    // Parse the rest for #id and .classes
    const rest = tag.slice(selectorStart);
    const parts = rest.split(/(?=[#.])/);  // Split keeping delimiters
    
    for (const part of parts) {
      if (part.startsWith('#')) {
        tagId = part.slice(1);
      } else if (part.startsWith('.')) {
        if (!tagClasses) tagClasses = [];
        tagClasses.push(part.slice(1));
      }
    }
  }

  // Create element (SVG needs namespace)
  const el = SVG_TAGS.has(tagName)
    ? document.createElementNS(SVG_NS, tagName)
    : document.createElement(tagName);

  // Apply ID from tag selector
  if (tagId) {
    el.id = tagId;
  }

  // Apply classes from tag selector
  if (tagClasses) {
    if (SVG_TAGS.has(tagName)) {
      el.setAttribute('class', tagClasses.join(' '));
    } else {
      el.className = tagClasses.join(' ');
    }
  }

  // Process props
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (k === 'class') {
        // Process with cx() for clsx-style handling (arrays, objects, conditionals)
        const cls = typeof v === 'string' ? v : cx(v);
        if (cls) {
          if (SVG_TAGS.has(tagName)) {
            const existing = el.getAttribute('class');
            el.setAttribute('class', existing ? existing + ' ' + cls : cls);
          } else {
            el.className = el.className ? el.className + ' ' + cls : cls;
          }
        }
      } else if (k === 'key') {
        // Special: data-key for list reconciliation
        el.dataset.key = v;
      } else if (k.startsWith('on')) {
        // Event handler: onclick → click
        const event = k.slice(2).toLowerCase();
        el.addEventListener(event, v);
      } else {
        // Regular attribute
        el.setAttribute(k, v);
      }
    }
  }

  // Append children
  if (children != null) {
    if (Array.isArray(children)) {
      for (const c of children) {
        if (c != null) {
          el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        }
      }
    } else if (typeof children === 'string') {
      el.appendChild(document.createTextNode(children));
    } else {
      el.appendChild(children);
    }
  }

  return el;
}

/**
 * Create a document fragment from multiple elements
 * @param  {...Element} children - Elements to wrap
 * @returns {DocumentFragment}
 */
export function frag(...children) {
  const f = document.createDocumentFragment();
  for (const c of children) {
    if (c != null) {
      f.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
  }
  return f;
}

/**
 * Create a text node
 * @param {any} value - Value to convert to text
 * @returns {Text}
 */
export function txt(value) {
  return document.createTextNode(String(value));
}

/**
 * clsx-style class name builder
 * @param {...any} args - Strings, arrays, objects, or falsy values
 * @returns {string} - Space-separated class names
 *
 * Examples:
 *   cx('foo', 'bar')                    → 'foo bar'
 *   cx('foo', false && 'bar')           → 'foo'
 *   cx('foo', isActive && 'active')     → 'foo active' (if isActive)
 *   cx({ foo: true, bar: false })       → 'foo'
 *   cx(['foo', 'bar'])                  → 'foo bar'
 *   cx('a', ['b', { c: true }], 'd')    → 'a b c d'
 */
export function cx(...args) {
  let result = '';
  for (const arg of args) {
    if (!arg) continue;
    if (typeof arg === 'string') {
      result += (result && ' ') + arg;
    } else if (Array.isArray(arg)) {
      const nested = cx(...arg);
      if (nested) result += (result && ' ') + nested;
    } else if (typeof arg === 'object') {
      for (const k in arg) {
        if (arg[k]) result += (result && ' ') + k;
      }
    }
  }
  return result;
}
