// =============================================================================
// Component Renderer — Mounts compiled Rip components into the DOM
//
// Orchestrates the lifecycle of routed components:
//   - Compiles .rip source to JS component classes (via Rip compiler)
//   - Mounts/unmounts components on route changes
//   - Nests layout components (wrapping page content)
//   - Provides app-level stash context to all components
//   - Manages transitions between route changes
//
// The Rip compiler generates component classes with:
//   _create()   — builds DOM nodes
//   _setup()    — wires reactive effects
//   mount(el)   — appends to DOM, runs lifecycle hooks
//   unmount()   — removes from DOM, runs cleanup
//
// This renderer manages WHEN and WHERE those components appear.
//
// Author: Steve Shreeve <steve.shreeve@gmail.com>
//   Date: February 2026
// =============================================================================

import { effect } from './stash.js';

// ---------------------------------------------------------------------------
// Layout Manager — nests layout components around page content
// ---------------------------------------------------------------------------

// Build a nested layout chain: outermost layout wraps the next, etc.
// Returns the mount point element where the page content goes
function createLayoutShell(layouts, container) {
  if (!layouts || layouts.length === 0) return container;

  let current = container;
  const instances = [];

  for (const layout of layouts) {
    // Create a slot div for this layout's content
    const slot = document.createElement('div');
    slot.setAttribute('data-layout-slot', '');

    // Mount the layout, passing the slot as its content target
    const instance = new layout({ slot });
    const root = instance._create();
    current.appendChild(root);
    if (instance._setup) instance._setup();
    if (instance.mounted) instance.mounted();
    instances.push(instance);

    // The next layout (or the page) mounts into this layout's slot
    current = root.querySelector('[data-slot]') || slot;
    if (current === slot) {
      // Layout didn't define a slot — append slot to layout root
      root.appendChild(slot);
      current = slot;
    }
  }

  return { mountPoint: current, instances };
}

// ---------------------------------------------------------------------------
// Renderer — ties router, VFS, compiler, and stash together
// ---------------------------------------------------------------------------

export function createRenderer(options = {}) {
  const {
    router,
    fs,
    stash: appStash,
    compile,     // (source: string) => string — Rip compiler function
    target,      // DOM element or selector
    onError,     // error handler
    transition   // optional transition config
  } = options;

  // Resolve target element
  let container = typeof target === 'string'
    ? document.querySelector(target)
    : target || document.getElementById('app');

  if (!container) {
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);
  }

  // Current state
  let currentComponent = null;
  let currentLayouts = [];
  let layoutInstances = [];
  let routeStash = null;      // per-route state
  let disposeEffect = null;    // cleanup for route-watching effect

  // Unmount current component and layouts
  function unmountCurrent() {
    if (currentComponent) {
      if (currentComponent.unmounted) currentComponent.unmounted();
      if (currentComponent._root?.parentNode) {
        currentComponent._root.parentNode.removeChild(currentComponent._root);
      }
      currentComponent = null;
    }
    for (const layout of layoutInstances.reverse()) {
      if (layout.unmounted) layout.unmounted();
      if (layout._root?.parentNode) {
        layout._root.parentNode.removeChild(layout._root);
      }
    }
    layoutInstances = [];
    routeStash = null;
  }

  // Mount a component for the current route
  async function mountRoute(routeInfo) {
    const { route, params, layouts: layoutFiles } = routeInfo;
    if (!route) return;

    try {
      // Read and compile the page component
      const source = fs.read(route.file);
      if (!source) {
        if (onError) onError({ status: 404, message: `File not found: ${route.file}` });
        return;
      }

      const js = compile(source);

      // Execute the compiled JS
      const blob = new Blob([js], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      let module;
      try {
        module = await import(url);
      } finally {
        URL.revokeObjectURL(url);
      }

      // Find the component class (first class export, or default)
      const ComponentClass = findComponentClass(module);
      if (!ComponentClass) {
        if (onError) onError({ status: 500, message: `No component found in ${route.file}` });
        return;
      }

      // Check if layouts changed
      const layoutsChanged = !arraysEqual(
        layoutFiles.map(f => f),
        currentLayouts.map(f => f)
      );

      // Unmount previous
      if (layoutsChanged) {
        unmountCurrent();
      } else if (currentComponent) {
        // Same layouts, different page — just swap the page
        if (currentComponent.unmounted) currentComponent.unmounted();
        if (currentComponent._root?.parentNode) {
          currentComponent._root.parentNode.removeChild(currentComponent._root);
        }
        currentComponent = null;
      }

      // Determine mount point
      let mountPoint = container;

      // Compile and mount layouts if they changed
      if (layoutsChanged && layoutFiles.length > 0) {
        container.innerHTML = '';
        mountPoint = container;

        for (const layoutFile of layoutFiles) {
          const layoutSource = fs.read(layoutFile);
          if (!layoutSource) continue;

          const layoutJs = compile(layoutSource);
          const layoutBlob = new Blob([layoutJs], { type: 'application/javascript' });
          const layoutUrl = URL.createObjectURL(layoutBlob);
          let layoutModule;
          try {
            layoutModule = await import(layoutUrl);
          } finally {
            URL.revokeObjectURL(layoutUrl);
          }

          const LayoutClass = findComponentClass(layoutModule);
          if (!LayoutClass) continue;

          const layoutInstance = new LayoutClass({
            app: appStash,
            params,
            router
          });

          const wrapper = document.createElement('div');
          wrapper.setAttribute('data-layout', layoutFile);
          mountPoint.appendChild(wrapper);
          layoutInstance.mount(wrapper);
          layoutInstances.push(layoutInstance);

          // Find the slot within this layout for nested content
          const slot = wrapper.querySelector('[data-slot]')
                    || wrapper.querySelector('.slot')
                    || wrapper;
          mountPoint = slot;
        }
        currentLayouts = [...layoutFiles];
      } else if (layoutsChanged) {
        container.innerHTML = '';
        currentLayouts = [];
      }

      // Apply transition (if configured)
      if (transition && mountPoint.children.length > 0) {
        mountPoint.classList.add('route-transition-exit');
        await wait(transition.duration || 200);
        mountPoint.classList.remove('route-transition-exit');
      }

      // Mount the page component
      const pageWrapper = document.createElement('div');
      pageWrapper.setAttribute('data-page', route.file);
      if (transition) pageWrapper.classList.add('route-transition-enter');

      mountPoint.appendChild(pageWrapper);

      const instance = new ComponentClass({
        app: appStash,
        params,
        query: routeInfo.query,
        router
      });
      instance.mount(pageWrapper);
      currentComponent = instance;

      // Run load function if defined (for data fetching)
      if (instance.load) {
        try {
          await instance.load(params, routeInfo.query);
        } catch (err) {
          if (onError) onError({ status: 500, message: err.message, error: err });
        }
      }

      if (transition) {
        await wait(16); // next frame
        pageWrapper.classList.remove('route-transition-enter');
      }

    } catch (err) {
      console.error(`Renderer: error mounting ${route.file}:`, err);
      if (onError) onError({ status: 500, message: err.message, error: err });
      renderError(container, err);
    }
  }

  // Start the renderer — watch for route changes
  function start() {
    // React to route changes
    disposeEffect = effect(() => {
      const current = router.current;
      if (current.route) {
        mountRoute(current);
      }
    });

    // Initialize the router (resolve current URL)
    router.init();

    return renderer;
  }

  // Stop the renderer
  function stop() {
    unmountCurrent();
    if (disposeEffect) {
      disposeEffect.stop();
      disposeEffect = null;
    }
    container.innerHTML = '';
  }

  // Public API
  const renderer = {
    start,
    stop,

    // Mount a specific component class to a target
    mount(ComponentClass, target, props = {}) {
      const el = typeof target === 'string' ? document.querySelector(target) : target;
      if (!el) return null;
      const instance = new ComponentClass({ app: appStash, ...props });
      instance.mount(el);
      return instance;
    },

    // Compile and mount a .rip source string
    async mountSource(source, target, props = {}) {
      const js = compile(source);
      const blob = new Blob([js], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      let module;
      try { module = await import(url); }
      finally { URL.revokeObjectURL(url); }
      const ComponentClass = findComponentClass(module);
      if (!ComponentClass) return null;
      return renderer.mount(ComponentClass, target, props);
    },

    get container() { return container; },
    get current() { return currentComponent; }
  };

  return renderer;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Find the first component class in a module
function findComponentClass(module) {
  // Check default export
  if (module.default && isComponentClass(module.default)) return module.default;

  // Check named exports
  for (const key of Object.keys(module)) {
    if (isComponentClass(module[key])) return module[key];
  }

  // Check if module itself is a class (direct eval result)
  if (isComponentClass(module)) return module;

  return null;
}

// Check if something looks like a Rip component class
function isComponentClass(obj) {
  if (typeof obj !== 'function') return false;
  const proto = obj.prototype;
  return proto && (typeof proto.mount === 'function' || typeof proto._create === 'function');
}

// Simple array equality check
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Promise-based wait
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Render an error message to the container
function renderError(container, error) {
  const el = document.createElement('div');
  el.style.cssText = 'padding:2rem;font-family:monospace;background:#1a1a2e;color:#e94560;border-radius:8px;margin:1rem;';
  el.innerHTML = `
    <h2 style="margin:0 0 1rem;color:#e94560;">Rip Error</h2>
    <pre style="white-space:pre-wrap;color:#eee;background:#16213e;padding:1rem;border-radius:4px;overflow:auto;">${escapeHtml(error.message || String(error))}</pre>
    ${error.stack ? `<details style="margin-top:1rem"><summary style="cursor:pointer;color:#0f3460">Stack trace</summary><pre style="white-space:pre-wrap;color:#888;font-size:0.85em;margin-top:0.5rem">${escapeHtml(error.stack)}</pre></details>` : ''}
  `;
  container.innerHTML = '';
  container.appendChild(el);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default createRenderer;
