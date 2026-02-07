// =============================================================================
// Reactive Stash — Deep reactive state tree with path navigation
//
// Combines:
//   - Stash's deep path navigation (get/set/has/del/inc/merge/keys/values)
//   - Vue-style deep Proxy reactivity (every nested property is tracked)
//   - Rip's signal model (state/computed/effect with auto-tracking)
//
// Usage:
//   const app = stash({ user: null, theme: 'light', cart: { items: [] } })
//   app.user = { name: "Alice" }        // triggers reactive updates
//   app.get("cart.items[0].price")       // deep path access
//   app.set("user.name", "Bob")         // deep path write, triggers updates
//   effect(() => console.log(app.theme)) // re-runs when theme changes
//
// Author: Steve Shreeve <steve.shreeve@gmail.com>
//   Date: February 2026
// =============================================================================

// ---------------------------------------------------------------------------
// Reactive core — same algorithm as Rip's runtime, standalone for the browser
// ---------------------------------------------------------------------------

let currentEffect = null;
let pendingEffects = new Set();
let batching = false;

function flushEffects() {
  const effects = [...pendingEffects];
  pendingEffects.clear();
  for (const e of effects) e.run();
}

// Create a reactive signal for a single value
function signal(initialValue) {
  let value = initialValue;
  const subscribers = new Set();
  let notifying = false;

  return {
    get() {
      if (currentEffect) {
        subscribers.add(currentEffect);
        currentEffect.dependencies.add(subscribers);
      }
      return value;
    },
    set(newValue) {
      if (newValue === value || notifying) return;
      value = newValue;
      notifying = true;
      for (const sub of subscribers) {
        if (sub.markDirty) sub.markDirty();
        else pendingEffects.add(sub);
      }
      if (!batching) flushEffects();
      notifying = false;
    },
    peek() { return value; },
    subscribers
  };
}

// Create a computed value that auto-tracks dependencies
export function computed(fn) {
  let value;
  let dirty = true;
  const subscribers = new Set();

  const comp = {
    dependencies: new Set(),
    markDirty() {
      if (dirty) return;
      dirty = true;
      for (const sub of subscribers) {
        if (sub.markDirty) sub.markDirty();
        else pendingEffects.add(sub);
      }
    },
    get value() {
      if (currentEffect) {
        subscribers.add(currentEffect);
        currentEffect.dependencies.add(subscribers);
      }
      if (dirty) {
        for (const dep of comp.dependencies) dep.delete(comp);
        comp.dependencies.clear();
        const prev = currentEffect;
        currentEffect = comp;
        try { value = fn(); } finally { currentEffect = prev; }
        dirty = false;
      }
      return value;
    },
    peek() { return value; }
  };
  return comp;
}

// Create a side effect that re-runs when its dependencies change
export function effect(fn) {
  const eff = {
    dependencies: new Set(),
    run() {
      for (const dep of eff.dependencies) dep.delete(eff);
      eff.dependencies.clear();
      const prev = currentEffect;
      currentEffect = eff;
      try { fn(); } finally { currentEffect = prev; }
    },
    stop() {
      for (const dep of eff.dependencies) dep.delete(eff);
      eff.dependencies.clear();
    }
  };
  eff.run();
  return eff;
}

// Group multiple updates — effects only run once at the end
export function batch(fn) {
  if (batching) return fn();
  batching = true;
  try { return fn(); }
  finally { batching = false; flushEffects(); }
}

// ---------------------------------------------------------------------------
// Path navigation — adapted from Stash
// ---------------------------------------------------------------------------

const PATH_RE = /([./][^./\[\s]+|\[[-+]?\d+\]|\[(?:"[^"]+"|'[^']+')\])/;
const isNum = (v) => /^-?\d+$/.test(v);

function walk(path) {
  const list = ('.' + path).split(PATH_RE);
  list.shift();
  const result = [];
  for (let i = 0; i < list.length; i += 2) {
    const part = list[i];
    const chr = part[0];
    if (chr === '.' || chr === '/') result.push(part.slice(1));
    else if (chr === '[') {
      if (part[1] === '"' || part[1] === "'") result.push(part.slice(2, -2));
      else result.push(+(part.slice(1, -1)));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Reactive Stash — deep Proxy wrapping with signal-per-property
// ---------------------------------------------------------------------------

const STASH = Symbol('stash');
const SIGNALS = Symbol('signals');
const RAW = Symbol('raw');

// Get or create a signal for a property on a target
function getSignal(target, prop) {
  let signals = target[SIGNALS];
  if (!signals) {
    signals = new Map();
    Object.defineProperty(target, SIGNALS, { value: signals, enumerable: false });
  }
  let sig = signals.get(prop);
  if (!sig) {
    sig = signal(target[prop]);
    signals.set(prop, sig);
  }
  return sig;
}

// Keys signal — tracks when keys are added/removed
function getKeysSignal(target) {
  return getSignal(target, Symbol.for('keys'));
}

// Recursively wrap nested objects/arrays in reactive proxies
function wrapDeep(value) {
  if (value === null || typeof value !== 'object') return value;
  if (value[STASH]) return value; // already wrapped
  if (value instanceof Date || value instanceof RegExp || value instanceof Map ||
      value instanceof Set || value instanceof WeakMap || value instanceof WeakSet ||
      value instanceof Promise) return value;
  return createProxy(value);
}

function createProxy(target) {
  const proxy = new Proxy(target, {
    get(target, prop, receiver) {
      // Internal markers
      if (prop === STASH) return true;
      if (prop === RAW) return target;

      // Stash API methods — don't track these
      if (typeof prop === 'string' && STASH_METHODS.has(prop)) {
        return stashMethods[prop].bind(null, proxy);
      }

      // Symbol access — pass through
      if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);

      // Track key enumeration
      if (prop === 'length' && Array.isArray(target)) {
        getKeysSignal(target).get();
        return target.length;
      }

      // Get the signal for this property
      const sig = getSignal(target, prop);
      const value = sig.get();

      // Wrap nested objects lazily
      if (value !== null && typeof value === 'object' && !value[STASH]) {
        const wrapped = wrapDeep(value);
        if (wrapped !== value) {
          target[prop] = wrapped;
          sig.set(wrapped);
        }
        return wrapped;
      }
      return value;
    },

    set(target, prop, value, receiver) {
      const sig = getSignal(target, prop);
      const old = sig.peek();

      // Wrap nested objects
      const wrapped = wrapDeep(value);
      target[prop] = wrapped;
      sig.set(wrapped);

      // If adding a new key, notify keys watchers
      if (old === undefined && wrapped !== undefined) {
        getKeysSignal(target).set(Object.keys(target));
      }
      return true;
    },

    deleteProperty(target, prop) {
      const had = prop in target;
      delete target[prop];
      if (had) {
        const sig = getSignal(target, prop);
        sig.set(undefined);
        getKeysSignal(target).set(Object.keys(target));
      }
      return true;
    },

    has(target, prop) {
      if (prop === STASH || prop === RAW) return true;
      getKeysSignal(target).get();
      return prop in target;
    },

    ownKeys(target) {
      getKeysSignal(target).get();
      return Reflect.ownKeys(target);
    }
  });

  return proxy;
}

// ---------------------------------------------------------------------------
// Stash API methods — path-based access on the reactive tree
// ---------------------------------------------------------------------------

const stashMethods = {
  // Get value at deep path
  get(proxy, path, defaultValue) {
    const list = walk(path);
    let current = proxy;
    for (const prop of list) {
      if (current == null || typeof current !== 'object') return defaultValue;
      const key = isNum(String(prop)) && Array.isArray(current[RAW] ?? current) && +prop < 0
        ? (current[RAW] ?? current).length + +prop
        : prop;
      current = current[key];
    }
    return current != null ? current : defaultValue;
  },

  // Set value at deep path, creating intermediate objects/arrays as needed
  set(proxy, path, value) {
    const list = walk(path);
    const last = list.length - 1;
    let current = proxy;
    for (let i = 0; i < list.length; i++) {
      const prop = list[i];
      const key = isNum(String(prop)) && Array.isArray(current[RAW] ?? current) && +prop < 0
        ? (current[RAW] ?? current).length + +prop
        : prop;
      if (i === last) {
        current[key] = value;
      } else {
        let next = current[key];
        if (next == null || typeof next !== 'object') {
          next = isNum(String(list[i + 1])) ? [] : {};
          current[key] = next;
        }
        current = current[key]; // re-read to get proxy-wrapped version
      }
    }
    return value;
  },

  // Check if path exists
  has(proxy, path) {
    return stashMethods.get(proxy, path) != null;
  },

  // Delete value at path
  del(proxy, path) {
    const list = walk(path);
    if (list.length === 0) return;
    const parentPath = list.slice(0, -1);
    const key = list[list.length - 1];
    const parent = parentPath.length > 0
      ? stashMethods.get(proxy, parentPath.map(p => typeof p === 'number' ? `[${p}]` : p).join('.'))
      : proxy;
    if (parent != null && typeof parent === 'object') {
      delete parent[key];
    }
  },

  // Increment a numeric value at path
  inc(proxy, path, step = 1, init = 0) {
    const current = stashMethods.get(proxy, path);
    const next = typeof current === 'number' ? current + step : init;
    stashMethods.set(proxy, path, next);
    return next;
  },

  // Get all keys at path (or root)
  keys(proxy, path) {
    const target = path ? stashMethods.get(proxy, path) : proxy;
    if (target == null || typeof target !== 'object') return [];
    return Object.keys(target[RAW] ?? target);
  },

  // Get all values at path (or root)
  values(proxy, path) {
    const target = path ? stashMethods.get(proxy, path) : proxy;
    if (target == null || typeof target !== 'object') return [];
    return Object.values(target[RAW] ?? target);
  },

  // Merge data into path (or root)
  merge(proxy, pathOrObj, obj) {
    if (typeof pathOrObj === 'object' && obj === undefined) {
      obj = pathOrObj;
      batch(() => { for (const [k, v] of Object.entries(obj)) proxy[k] = v; });
    } else {
      const target = stashMethods.get(proxy, pathOrObj);
      if (target != null && typeof target === 'object') {
        batch(() => { for (const [k, v] of Object.entries(obj)) target[k] = v; });
      }
    }
    return proxy;
  },

  // Run a function stored at path
  run(proxy, path, ...args) {
    const fn = stashMethods.get(proxy, path);
    if (typeof fn === 'function') return fn.call(proxy, ...args);
    console.warn(`stash.run: not a function at '${path}'`);
  },

  // Get raw (unwrapped) data
  toJSON(proxy) {
    return JSON.parse(JSON.stringify(proxy[RAW]));
  },

  // Pretty print
  toString(proxy) {
    return JSON.stringify(proxy[RAW], null, 2);
  }
};

const STASH_METHODS = new Set(Object.keys(stashMethods));

// ---------------------------------------------------------------------------
// Factory — create a Reactive Stash
// ---------------------------------------------------------------------------

export function stash(data = {}) {
  // Handle ES module default export
  if (data.default != null) data = data.default;
  return wrapDeep(data);
}

// Alias
export const Stash = stash;

// Get the raw unwrapped object from a reactive stash
export function raw(proxy) {
  return proxy?.[RAW] ?? proxy;
}

// Check if something is a reactive stash
export function isStash(obj) {
  return obj?.[STASH] === true;
}

// Export reactive primitives not already exported inline
export { signal, walk };

// Default export
export default stash;
