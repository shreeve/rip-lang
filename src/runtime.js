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
    peek() {
      return value;
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
