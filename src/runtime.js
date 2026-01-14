// ============================================================================
// Rip Reactive Runtime
// ============================================================================
// Minimal reactive primitives that get inlined into compiled output.
// Zero dependencies, ~150 lines.

// Current tracking context (the effect/computed currently being executed)
let currentEffect = null;

// Batch state
let batchDepth = 0;
let pendingEffects = new Set();

// ============================================================================
// Signal - Reactive value
// ============================================================================
export function signal(initialValue) {
  let value = initialValue;
  const subscribers = new Set();

  const sig = {
    get value() {
      // Track dependency if we're inside an effect/computed
      if (currentEffect) {
        subscribers.add(currentEffect);
        currentEffect.dependencies.add(subscribers);
      }
      return value;
    },
    set value(newValue) {
      if (newValue !== value) {
        value = newValue;
        // Notify all subscribers
        for (const effect of subscribers) {
          if (batchDepth > 0) {
            pendingEffects.add(effect);
          } else {
            effect.run();
          }
        }
      }
    },
    // Allow reading without tracking
    peek() {
      return value;
    }
  };

  return sig;
}

// ============================================================================
// Computed - Derived value with automatic dependency tracking
// ============================================================================
export function computed(fn) {
  let value;
  let dirty = true;
  const subscribers = new Set();

  const comp = {
    // Internal effect to track dependencies
    dependencies: new Set(),
    run() {
      dirty = true;
      // Notify our subscribers that we changed
      for (const effect of subscribers) {
        if (batchDepth > 0) {
          pendingEffects.add(effect);
        } else {
          effect.run();
        }
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
    peek() {
      if (dirty) {
        const prevEffect = currentEffect;
        currentEffect = null; // Don't track during peek
        try {
          value = fn();
        } finally {
          currentEffect = prevEffect;
        }
        dirty = false;
      }
      return value;
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
// Batch - Group updates to prevent cascading
// ============================================================================
export function batch(fn) {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      // Run all pending effects
      const effects = [...pendingEffects];
      pendingEffects.clear();
      for (const effect of effects) {
        effect.run();
      }
    }
  }
}

// ============================================================================
// Readonly - Constant value that cannot be reassigned
// ============================================================================
export function readonly(value) {
  return Object.freeze({ value });
}

// ============================================================================
// Runtime code as string (for inlining into compiled output)
// ============================================================================
export const RUNTIME_CODE = `
// === Rip Reactive Runtime ===
let __currentEffect = null;
let __batchDepth = 0;
let __pendingEffects = new Set();

function __signal(initialValue) {
  let value = initialValue;
  const subscribers = new Set();
  return {
    get value() {
      if (__currentEffect) {
        subscribers.add(__currentEffect);
        __currentEffect.dependencies.add(subscribers);
      }
      return value;
    },
    set value(newValue) {
      if (newValue !== value) {
        value = newValue;
        for (const effect of subscribers) {
          if (__batchDepth > 0) {
            __pendingEffects.add(effect);
          } else {
            effect.run();
          }
        }
      }
    },
    peek() { return value; }
  };
}

function __computed(fn) {
  let value, dirty = true;
  const subscribers = new Set();
  const comp = {
    dependencies: new Set(),
    run() {
      dirty = true;
      for (const effect of subscribers) {
        if (__batchDepth > 0) __pendingEffects.add(effect);
        else effect.run();
      }
    },
    get value() {
      if (__currentEffect) {
        subscribers.add(__currentEffect);
        __currentEffect.dependencies.add(subscribers);
      }
      if (dirty) {
        for (const dep of comp.dependencies) dep.delete(comp);
        comp.dependencies.clear();
        const prev = __currentEffect;
        __currentEffect = comp;
        try { value = fn(); }
        finally { __currentEffect = prev; }
        dirty = false;
      }
      return value;
    }
  };
  return comp;
}

function __effect(fn) {
  const eff = {
    dependencies: new Set(),
    run() {
      for (const dep of eff.dependencies) dep.delete(eff);
      eff.dependencies.clear();
      const prev = __currentEffect;
      __currentEffect = eff;
      try { fn(); }
      finally { __currentEffect = prev; }
    },
    dispose() {
      for (const dep of eff.dependencies) dep.delete(eff);
      eff.dependencies.clear();
    }
  };
  eff.run();
  return () => eff.dispose();
}

function __batch(fn) {
  __batchDepth++;
  try { fn(); }
  finally {
    __batchDepth--;
    if (__batchDepth === 0) {
      const effects = [...__pendingEffects];
      __pendingEffects.clear();
      for (const effect of effects) effect.run();
    }
  }
}

function __readonly(value) {
  return Object.freeze({ value });
}
// === End Rip Reactive Runtime ===
`;
