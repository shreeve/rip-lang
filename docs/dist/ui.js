let PATH_RE, PROXIES, RAW, SIGNALS, STASH, __batch, __effect, __state, _keysVersion, _proxy, _toFn, _writeVersion, arraysEqual, buildComponentMap, buildRoutes, compileAndImport, connectWatch, fileToComponentName, fileToPattern, findAllComponents, findComponent, getContext, getLayoutChain, getSignal, hasContext, keysSignal, makeProxy, matchRoute, patternToRegex, setContext, stashGet, stashSet, walk, wrapDeep;

({__state, __effect, __batch} = globalThis.__rip);
({setContext, getContext, hasContext} = globalThis.__ripComponent || {});
STASH = Symbol('stash');
SIGNALS = Symbol('signals');
RAW = Symbol('raw');
PROXIES = new WeakMap();
_keysVersion = 0;
_writeVersion = __state(0);
getSignal = function(target, prop) {
  let sig;
  if (!target[SIGNALS]) {
    Object.defineProperty(target, SIGNALS, {value: new Map(), enumerable: false});
  }
  sig = target[SIGNALS].get(prop);
  if (!sig) {
    sig = __state(target[prop]);
    target[SIGNALS].set(prop, sig);
  }
  return sig;
};
keysSignal = function(target) {
  return getSignal(target, Symbol.for('keys'));
};
wrapDeep = function(value) {
  let existing;
  if (!((value != null) && (typeof value === 'object'))) return value;
  if (value[STASH]) return value;
  if ((value instanceof Date) || (value instanceof RegExp) || (value instanceof Map) || (value instanceof Set) || (value instanceof Promise)) return value;
  existing = PROXIES.get(value);
  if (existing) return existing;
  return makeProxy(value);
};
makeProxy = function(target) {
  let handler, proxy;
  proxy = null;
  handler = {get: (function(target, prop) {
    let sig, val;
    if (prop === STASH) return true;
    if (prop === RAW) return target;
    if (typeof prop === 'symbol') return Reflect.get(target, prop);
    if ((prop === 'length') && Array.isArray(target)) {
      keysSignal(target).value;
      return target.length;
    }
    if (prop === 'get') return (function(path) {
      return stashGet(proxy, path);
    });
    if (prop === 'set') return (function(path, val) {
      return stashSet(proxy, path, val);
    });
    sig = getSignal(target, prop);
    val = sig.value;
    if ((val != null) && (typeof val === 'object')) return wrapDeep(val);
    return val;
  }), set: (function(target, prop, value) {
    let old, r;
    old = target[prop];
    r = value?.[RAW] ? value[RAW] : value;
    if (r === old) return true;
    target[prop] = r;
    if (target[SIGNALS]?.has(prop)) {
      target[SIGNALS].get(prop).value = r;
    }
    if ((old === undefined) && (r !== undefined)) {
      keysSignal(target).value = ++_keysVersion;
    }
    (_writeVersion.value++);
    return true;
  }), deleteProperty: (function(target, prop) {
    let sig;
    (delete target[prop]);
    sig = target[SIGNALS]?.get(prop);
    if (sig) sig.value = undefined;
    keysSignal(target).value = ++_keysVersion;
    return true;
  }), ownKeys: (function(target) {
    keysSignal(target).value;
    return Reflect.ownKeys(target);
  })};
  proxy = new Proxy(target, handler);
  PROXIES.set(target, proxy);
  return proxy;
};
PATH_RE = /([./][^./\[\s]+|\[[-+]?\d+\]|\[(?:"[^"]+"|'[^']+')\])/;
walk = function(path) {
  let chr, i, list, part, result;
  list = ('.' + path).split(PATH_RE);
  list.shift();
  result = [];
  i = 0;
  while (i < list.length) {
    part = list[i];
    chr = part[0];
    if ((chr === '.') || (chr === '/')) {
      result.push(part.slice(1));
    } else if (chr === '[') {
      if ((part[1] === '"') || (part[1] === "'")) {
        result.push(part.slice(2, -2));
      } else {
        result.push(+part.slice(1, -1));
      }
    }
    i += 2;
  }
  return result;
};
stashGet = function(proxy, path) {
  let obj, segs;
  segs = walk(path);
  obj = proxy;
  for (const seg of segs) {
    if (!(obj != null)) return undefined;
    obj = obj[seg];
  }
  return obj;
};
stashSet = function(proxy, path, value) {
  let obj, segs;
  segs = walk(path);
  obj = proxy;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (i === (segs.length - 1)) {
      obj[seg] = value;
    } else {
      if (!(obj[seg] != null)) obj[seg] = {};
      obj = obj[seg];
    }
  }
  return value;
};
_toFn = function(source) {
  return ((typeof source === 'function') ? source : (function() {
    return source.value;
  }));
};
_proxy = function(out, source) {
  let obj;
  obj = {read: (function() {
    return out.read();
  })};
  Object.defineProperty(obj, 'value', {get: (function() {
    return out.value;
  }), set: (function(v) {
    return (source.value = v);
  })});
  return obj;
};
fileToPattern = function(rel) {
  let pattern;
  pattern = rel.replace(/\.rip$/, '');
  pattern = pattern.replace(/\[\.\.\.(\w+)\]/g, '*$1');
  pattern = pattern.replace(/\[(\w+)\]/g, ':$1');
  if (pattern === 'index') return '/';
  pattern = pattern.replace(/\/index$/, '');
  return ('/' + pattern);
};
patternToRegex = function(pattern) {
  let names, str;
  names = [];
  str = pattern.replace(/\*(\w+)/g, function(_, name) {
    names.push(name);
    return '(.+)';
  }).replace(/:(\w+)/g, function(_, name) {
    names.push(name);
    return '([^/]+)';
  });
  return {regex: new RegExp(('^' + str) + '$'), names};
};
matchRoute = function(path, routes) {
  let match, params;
  for (const route of routes) {
    match = path.match(route.regex.regex);
    if (match) {
      params = {};
      for (let i = 0; i < route.regex.names.length; i++) {
        const name = route.regex.names[i];
        params[name] = decodeURIComponent(match[i + 1]);
      }
      return {route, params};
    }
  }
  return null;
};
buildRoutes = function(components, root = 'components') {
  let allFiles, dir, layouts, name, regex, rel, routes, urlPattern;
  routes = [];
  layouts = new Map();
  allFiles = components.listAll(root);
  for (const filePath of allFiles) {
    rel = filePath.slice(root.length + 1);
    if (!rel.endsWith('.rip')) continue;
    name = rel.split('/').pop();
    if (name === '_layout.rip') {
      dir = (rel === '_layout.rip') ? '' : rel.slice(0, -'/_layout.rip'.length);
      layouts.set(dir, filePath);
      continue;
    }
    if (name.startsWith('_')) continue;
    urlPattern = fileToPattern(rel);
    regex = patternToRegex(urlPattern);
    routes.push({pattern: urlPattern, regex, file: filePath, rel});
  }
  routes.sort(function(a, b) {
    let aCatch, aDyn, bCatch, bDyn;
    aDyn = (a.pattern.match(/:/g) || []).length;
    bDyn = (b.pattern.match(/:/g) || []).length;
    aCatch = a.pattern.includes('*') ? 1 : 0;
    bCatch = b.pattern.includes('*') ? 1 : 0;
    if (aCatch !== bCatch) return (aCatch - bCatch);
    if (aDyn !== bDyn) return (aDyn - bDyn);
    return a.pattern.localeCompare(b.pattern);
  });
  return {routes, layouts};
};
getLayoutChain = function(routeFile, root, layouts) {
  let chain, dir, rel, segments;
  chain = [];
  rel = routeFile.slice(root.length + 1);
  segments = rel.split('/');
  dir = '';
  if (layouts.has('')) chain.push(layouts.get(''));
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (i === (segments.length - 1)) break;
    dir = dir ? ((dir + '/') + seg) : seg;
    if (layouts.has(dir)) chain.push(layouts.get(dir));
  }
  return chain;
};
arraysEqual = function(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const item = a[i];
    if (item !== b[i]) return false;
  }
  return true;
};
findComponent = function(mod) {
  for (const key in mod) {
  const val = mod[key];
  if ((typeof val === 'function') && (val.prototype?.mount || val.prototype?._create)) return val;
  }
  return ((typeof mod.default === 'function') ? mod.default : undefined);
};
findAllComponents = function(mod) {
  let result;
  result = {};
  for (const key in mod) {
  const val = mod[key];
  if ((typeof val === 'function') && (val.prototype?.mount || val.prototype?._create)) {
      result[key] = val;
    }
  }
  return result;
};
fileToComponentName = function(filePath) {
  let name;
  name = filePath.split('/').pop().replace(/\.rip$/, '');
  return name.replace(/(^|[-_])([a-z])/g, function(_, sep, ch) {
    return ch.toUpperCase();
  });
};
buildComponentMap = function(components, root = 'components') {
  let fileName, map, name;
  map = {};
  for (const path of components.listAll(root)) {
    if (!path.endsWith('.rip')) continue;
    fileName = path.split('/').pop();
    if (fileName.startsWith('_')) continue;
    name = fileToComponentName(path);
    if (map[name]) {
      console.warn(`[Rip] Component name collision: ${name} (${map[name]} vs ${path})`);
    }
    map[name] = path;
  }
  return map;
};
compileAndImport = async function(source, compile, components = null, path = null, resolver = null) {
  let blob, cached, depMod, depSource, found, js, mod, names, needed, preamble, url;
  if (components && path) {
    cached = components.getCompiled(path);
    if (cached) return cached;
  }
  js = compile(source);
  if (resolver) {
    needed = {};
    for (const name in resolver.map) {
    const depPath = resolver.map[name];
    if ((depPath !== path) && js.includes(`new ${name}(`)) {
        if (!resolver.classes[name]) {
          depSource = components.read(depPath);
          if (depSource) {
            depMod = await compileAndImport(depSource, compile, components, depPath, resolver);
            found = findAllComponents(depMod);
            for (const k in found) {
              const v = found[k];
              resolver.classes[k] = v;
            };
          }
        }
        if (resolver.classes[name]) needed[name] = true;
      }
    }
    names = Object.keys(needed);
    if (names.length > 0) {
      preamble = `const {${names.join(', ')}} = globalThis['${resolver.key}'];\n`;
      js = preamble + js;
    }
  }
  blob = new Blob([js], {type: 'application/javascript'});
  url = URL.createObjectURL(blob);
  try {
    mod = await import(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  if (resolver) {
    found = findAllComponents(mod);
    for (const k in found) {
      const v = found[k];
      resolver.classes[k] = v;
    };
  }
  if (components && path) components.setCompiled(path, mod);
  return mod;
};
connectWatch = function(components, router, renderer, url, base = '') {
  let connect, maxDelay, retryDelay;
  retryDelay = 1000;
  maxDelay = 30000;
  connect = function() {
    let es;
    es = new EventSource(url);
    es.addEventListener('connected', function() {
      retryDelay = 1000;
      return console.log('[Rip] Hot reload connected');
    });
    es.addEventListener('changed', async function(e) {
      let current, failed, paths, results, toFetch;
      ({paths} = JSON.parse(e.data));
      for (const path of paths) {
        components.del(path);
      }
      router.rebuild();
      current = router.current;
      toFetch = paths.filter(function(p) {
        return ((p === current.route?.file) || current.layouts?.includes(p));
      });
      if ((toFetch.length > 0)) {
        results = await Promise.allSettled(toFetch.map(async function(path) {
          let content, res;
          res = await fetch((base + '/') + path);
          content = await res.text();
          return components.write(path, content);
        }));
        failed = results.filter(function(r) {
          return (r.status === 'rejected');
        });
        for (const r of failed) {
          console.error('[Rip] Hot reload fetch error:', r.reason);
        };
        return renderer.remount();
      }    });
    return (es.onerror = function() {
      es.close();
      console.log(`[Rip] Hot reload reconnecting in ${(retryDelay / 1000)}s...`);
      setTimeout(connect, retryDelay);
      return (retryDelay = Math.min(retryDelay * 2, maxDelay));
    });
  };
  return connect();
};
export { setContext, getContext, hasContext };
export const stash = (function(data = {}) {
  return makeProxy(data);
});
export const raw = (function(proxy) {
  return (proxy?.[RAW] ? proxy[RAW] : proxy);
});
export const isStash = (function(obj) {
  return (obj?.[STASH] === true);
});
export const createResource = (function(fn, opts = {}) {
  let _data, _error, _loading, load, resource;
  _data = __state(opts.initial || null);
  _loading = __state(false);
  _error = __state(null);
  load = async function() {
    let result;
    _loading.value = true;
    _error.value = null;
    return (async () => { try {
      result = await fn();
      return (_data.value = result);
    } catch (err) {
      return (_error.value = err);
    } finally {
      _loading.value = false;
    } })();
  };
  resource = {data: undefined, loading: undefined, error: undefined, refetch: load};
  Object.defineProperty(resource, 'data', {get: (function() {
    return _data.value;
  })});
  Object.defineProperty(resource, 'loading', {get: (function() {
    return _loading.value;
  })});
  Object.defineProperty(resource, 'error', {get: (function() {
    return _error.value;
  })});
  if (!opts.lazy) load();
  return resource;
});
export const delay = (function(ms, source) {
  let fn, out;
  fn = _toFn(source);
  out = __state(!(!fn()));
  __effect(function() {
    let t;
    if (fn()) {
      t = setTimeout(function() {
        return (out.value = true);
      }, ms);
      return (function() {
        return clearTimeout(t);
      });
    } else {
      return (out.value = false);
    }  });
  return ((typeof source !== 'function') ? _proxy(out, source) : out);
});
export const debounce = (function(ms, source) {
  let fn, out;
  fn = _toFn(source);
  out = __state(fn());
  __effect(function() {
    let t, val;
    val = fn();
    t = setTimeout(function() {
      return (out.value = val);
    }, ms);
    return (function() {
      return clearTimeout(t);
    });
  });
  return ((typeof source !== 'function') ? _proxy(out, source) : out);
});
export const throttle = (function(ms, source) {
  let fn, last, out;
  fn = _toFn(source);
  out = __state(fn());
  last = 0;
  __effect(function() {
    let now, remaining, t, val;
    val = fn();
    now = Date.now();
    remaining = ms - (now - last);
    if ((remaining <= 0)) {
      out.value = val;
      return (last = now);
    } else {
      t = setTimeout(function() {
        out.value = fn();
        return (last = Date.now());
      }, remaining);
      return (function() {
        return clearTimeout(t);
      });
    }  });
  return ((typeof source !== 'function') ? _proxy(out, source) : out);
});
export const hold = (function(ms, source) {
  let fn, out;
  fn = _toFn(source);
  out = __state(!(!fn()));
  __effect(function() {
    let t;
    if (fn()) {
      return (out.value = true);
    } else {
      t = setTimeout(function() {
        return (out.value = false);
      }, ms);
      return (function() {
        return clearTimeout(t);
      });
    }  });
  return ((typeof source !== 'function') ? _proxy(out, source) : out);
});
export const createComponents = (function() {
  let compiled, files, notify, watchers;
  files = new Map();
  watchers = [];
  compiled = new Map();
  notify = function(event, path) {
    for (const watcher of watchers) {
      watcher(event, path);
    }
  };
  return {read: (function(path) {
    return files.get(path);
  }), write: (function(path, content) {
    let isNew;
    isNew = !files.has(path);
    files.set(path, content);
    compiled.delete(path);
    return notify(isNew ? 'create' : 'change', path);
  }), del: (function(path) {
    files.delete(path);
    compiled.delete(path);
    return notify('delete', path);
  }), exists: (function(path) {
    return files.has(path);
  }), size: (function() {
    return files.size;
  }), list: (function(dir = '') {
    let prefix, rest, result;
    result = [];
    prefix = dir ? (dir + '/') : '';
    for (const [path] of files) {
      if (path.startsWith(prefix)) {
        rest = path.slice(prefix.length);
        if (rest.includes('/')) continue;
        result.push(path);
      }
    }
    return result;
  }), listAll: (function(dir = '') {
    let prefix, result;
    result = [];
    prefix = dir ? (dir + '/') : '';
    for (const [path] of files) {
      if (path.startsWith(prefix)) result.push(path);
    }
    return result;
  }), load: (function(obj) {
    for (const key in obj) {
    const content = obj[key];
    files.set(key, content);
    }
  }), watch: (function(fn) {
    watchers.push(fn);
    return (function() {
      return watchers.splice(watchers.indexOf(fn), 1);
    });
  }), getCompiled: (function(path) {
    return compiled.get(path);
  }), setCompiled: (function(path, result) {
    return compiled.set(path, result);
  })};
});
export const createRouter = (function(components, opts = {}) {
  let _hash, _layouts, _navigating, _params, _path, _query, _route, addBase, base, hashMode, navCallbacks, onClick, onError, onPopState, readUrl, resolve, root, router, stripBase, tree, writeUrl;
  root = opts.root || 'components';
  base = opts.base || '';
  hashMode = opts.hash || false;
  onError = opts.onError || null;
  stripBase = function(url) {
    return ((base && url.startsWith(base)) ? (url.slice(base.length) || '/') : url);
  };
  addBase = function(path) {
    return (base ? (base + path) : path);
  };
  readUrl = function() {
    return (hashMode ? (location.hash.slice(1) || '/') : ((location.pathname + location.search) + location.hash));
  };
  writeUrl = function(path) {
    return (hashMode ? ('#' + path) : addBase(path));
  };
  _path = __state(stripBase(hashMode ? (location.hash.slice(1) || '/') : location.pathname));
  _params = __state({});
  _route = __state(null);
  _layouts = __state([]);
  _query = __state({});
  _hash = __state('');
  _navigating = delay(100, __state(false));
  tree = buildRoutes(components, root);
  navCallbacks = new Set();
  components.watch(function(event, path) {
    if (!(path.startsWith(root + '/'))) return;
    return (tree = buildRoutes(components, root));
  });
  resolve = function(url) {
    let hash, path, queryStr, rawPath, result;
    rawPath = url.split('?')[0].split('#')[0];
    path = stripBase(rawPath);
    queryStr = url.split('?')[1]?.split('#')[0] || '';
    hash = url.includes('#') ? url.split('#')[1] : '';
    result = matchRoute(path, tree.routes);
    if (result) {
      __batch(function() {
        _path.value = path;
        _params.value = result.params;
        _route.value = result.route;
        _layouts.value = getLayoutChain(result.route.file, root, tree.layouts);
        _query.value = Object.fromEntries(new URLSearchParams(queryStr));
        return (_hash.value = hash);
      });
      for (const cb of navCallbacks) {
        cb(router.current);
      };
      return true;
    }
    if (onError) onError({status: 404, path});
    return false;
  };
  onPopState = function() {
    return resolve(readUrl());
  };
  if (typeof window !== 'undefined') window.addEventListener('popstate', onPopState);
  onClick = function(e) {
    let dest, target, url;
    if ((e.button !== 0) || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    target = e.target;
    while (target && (target.tagName !== 'A')) {
      target = target.parentElement;
    }
    if (!target?.href) return;
    url = new URL(target.href, location.origin);
    if (url.origin !== location.origin) return;
    if ((target.target === '_blank') || target.hasAttribute('data-external')) return;
    e.preventDefault();
    dest = (hashMode && url.hash) ? (url.hash.slice(1) || '/') : ((url.pathname + url.search) + url.hash);
    return router.push(dest);
  };
  if (typeof document !== 'undefined') document.addEventListener('click', onClick);
  router = {push: (function(url) {
    return (resolve(url) ? history.pushState(null, '', writeUrl(_path.read())) : undefined);
  }), replace: (function(url) {
    return (resolve(url) ? history.replaceState(null, '', writeUrl(_path.read())) : undefined);
  }), back: (function() {
    return history.back();
  }), forward: (function() {
    return history.forward();
  }), current: undefined, path: undefined, params: undefined, route: undefined, layouts: undefined, query: undefined, hash: undefined, navigating: undefined, onNavigate: (function(cb) {
    navCallbacks.add(cb);
    return (function() {
      return navCallbacks.delete(cb);
    });
  }), rebuild: (function() {
    return (tree = buildRoutes(components, root));
  }), routes: undefined, init: (function() {
    resolve(readUrl());
    return router;
  }), destroy: (function() {
    if (typeof window !== 'undefined') window.removeEventListener('popstate', onPopState);
    if (typeof document !== 'undefined') document.removeEventListener('click', onClick);
    return navCallbacks.clear();
  })};
  Object.defineProperty(router, 'current', {get: (function() {
    return {path: _path.value, params: _params.value, route: _route.value, layouts: _layouts.value, query: _query.value, hash: _hash.value};
  })});
  Object.defineProperty(router, 'path', {get: (function() {
    return _path.value;
  })});
  Object.defineProperty(router, 'params', {get: (function() {
    return _params.value;
  })});
  Object.defineProperty(router, 'route', {get: (function() {
    return _route.value;
  })});
  Object.defineProperty(router, 'layouts', {get: (function() {
    return _layouts.value;
  })});
  Object.defineProperty(router, 'query', {get: (function() {
    return _query.value;
  })});
  Object.defineProperty(router, 'hash', {get: (function() {
    return _hash.value;
  })});
  Object.defineProperty(router, 'navigating', {get: (function() {
    return _navigating.value;
  }), set: (function(v) {
    return (_navigating.value = v);
  })});
  Object.defineProperty(router, 'routes', {get: (function() {
    return tree.routes;
  })});
  return router;
});
export const createRenderer = (function(opts = {}) {
  let app, cacheComponent, compile, componentCache, components, container, currentComponent, currentLayouts, currentRoute, disposeEffect, generation, layoutInstances, maxCacheSize, mountPoint, mountRoute, onError, renderer, resolver, router, target, unmount;
  ({router, app, components, resolver, compile, target, onError} = opts);
  container = (typeof target === 'string') ? document.querySelector(target) : (target || document.getElementById('app'));
  if (!container) {
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);
  }
  container.style.opacity = '0';
  currentComponent = null;
  currentRoute = null;
  currentLayouts = [];
  layoutInstances = [];
  mountPoint = container;
  generation = 0;
  disposeEffect = null;
  componentCache = new Map();
  maxCacheSize = opts.cacheSize || 10;
  cacheComponent = function() {
    let evicted, oldest;
    if ((currentComponent && currentRoute)) {
      if (currentComponent.beforeUnmount) currentComponent.beforeUnmount();
      componentCache.set(currentRoute, currentComponent);
      if (componentCache.size > maxCacheSize) {
        oldest = componentCache.keys().next().value;
        evicted = componentCache.get(oldest);
        if (evicted.unmounted) evicted.unmounted();
        componentCache.delete(oldest);
      };
      currentComponent = null;
      return (currentRoute = null);
    }  };
  unmount = function() {
    cacheComponent();
    for (let _i = layoutInstances.length - 1; _i >= 0; _i--) {
    const inst = layoutInstances[_i];
    if (inst.beforeUnmount) inst.beforeUnmount();
    if (inst.unmounted) inst.unmounted();
    inst._root?.remove();
    }
    layoutInstances = [];
    return (mountPoint = container);
  };
  components.watch(function(event, path) {
    let evicted;
    if (componentCache.has(path)) {
      evicted = componentCache.get(path);
      if (evicted.unmounted) evicted.unmounted();
      return componentCache.delete(path);
    }  });
  mountRoute = async function(info) {
    let Component, LayoutClass, cached, gen, handled, inst, instance, layoutFiles, layoutMod, layoutSource, layoutsChanged, mod, mp, oldRoot, pageWrapper, params, pre, query, route, slot, source, wrapper;
    ({route, params, layouts: layoutFiles, query} = info);
    if (!route) return;
    if (route.file === currentRoute) return;
    gen = ++generation;
    router.navigating = true;
    return (async () => { try {
      source = components.read(route.file);
      if (!source) {
        if (onError) onError({status: 404, message: `File not found: ${route.file}`});
        router.navigating = false;
        return;
      };
      mod = await compileAndImport(source, compile, components, route.file, resolver);
      if (gen !== generation) {
        router.navigating = false;
        return;
      };
      Component = findComponent(mod);
      if (!Component) {
        if (onError) onError({status: 500, message: `No component found in ${route.file}`});
        router.navigating = false;
        return;
      };
      layoutsChanged = !arraysEqual(layoutFiles, currentLayouts);
      oldRoot = currentComponent?._root;
      if (layoutsChanged) {
        unmount();
      } else {
        cacheComponent();
      };
      mp = layoutsChanged ? container : mountPoint;
      if (layoutsChanged && (layoutFiles.length > 0)) {
        container.innerHTML = '';
        mp = container;
        for (const layoutFile of layoutFiles) {
          layoutSource = components.read(layoutFile);
          if (!layoutSource) continue;
          layoutMod = await compileAndImport(layoutSource, compile, components, layoutFile, resolver);
          if (gen !== generation) {
            router.navigating = false;
            return;
          }
          LayoutClass = findComponent(layoutMod);
          if (!LayoutClass) continue;
          inst = new LayoutClass({app, params, router});
          if (inst.beforeMount) inst.beforeMount();
          wrapper = document.createElement('div');
          wrapper.setAttribute('data-layout', layoutFile);
          mp.appendChild(wrapper);
          inst.mount(wrapper);
          layoutInstances.push(inst);
          slot = wrapper.querySelector('#content') || wrapper;
          mp = slot;
        }
        currentLayouts = [...layoutFiles];
        mountPoint = mp;
      } else if (layoutsChanged) {
        container.innerHTML = '';
        currentLayouts = [];
        mountPoint = container;
      };
      cached = componentCache.get(route.file);
      if (cached) {
        componentCache.delete(route.file);
        mp.appendChild(cached._root);
        currentComponent = cached;
        currentRoute = route.file;
      } else {
        pageWrapper = document.createElement('div');
        pageWrapper.setAttribute('data-component', route.file);
        mp.appendChild(pageWrapper);
        instance = new Component({app, params, query, router});
        if (instance.beforeMount) instance.beforeMount();
        instance.mount(pageWrapper);
        currentComponent = instance;
        currentRoute = route.file;
        if (instance.load) await instance.load(params, query);
      };
      oldRoot?.remove();
      router.navigating = false;
      return ((container.style.opacity === '0') ? document.fonts.ready.then(function() {
        return requestAnimationFrame(function() {
          container.style.transition = 'opacity 150ms ease-in';
          return (container.style.opacity = '1');
        });
      }) : undefined);
    } catch (err) {
      router.navigating = false;
      container.style.opacity = '1';
      console.error(`Renderer: error mounting ${route.file}:`, err);
      if (onError) onError({status: 500, message: err.message, error: err});
      handled = false;
      for (let _i = layoutInstances.length - 1; _i >= 0; _i--) {
      const inst = layoutInstances[_i];
      if (inst.onError) {
          try {
            inst.onError(err);
            handled = true;
            break;
          } catch (boundaryErr) {
            console.error("Renderer: error boundary failed:", boundaryErr);
          }
        }
      };
      return (!handled ? container.appendChild(pre) : undefined);
    } })();
  };
  renderer = {start: (function() {
    disposeEffect = __effect(function() {
      let current;
      current = router.current;
      return (current.route ? mountRoute(current) : undefined);
    });
    router.init();
    return renderer;
  }), stop: (function() {
    unmount();
    if (disposeEffect) {
      disposeEffect();
      disposeEffect = null;
    }
    return (container.innerHTML = '');
  }), remount: (function() {
    let current;
    current = router.current;
    return (current.route ? mountRoute(current) : undefined);
  }), cache: componentCache};
  return renderer;
});
export const launch = (async function(appBase = '', opts = {}) {
  let _save, _storage, _storageKey, app, appComponents, bundle, bundleUrl, classesKey, compile, el, hash, persist, renderer, res, resolver, router, saved, savedData, target;
  appBase = appBase.replace(/\/+$/, '');
  target = opts.target || '#app';
  compile = opts.compile || null;
  persist = opts.persist || false;
  hash = opts.hash || false;
  if (!compile) {
    compile = globalThis?.compileToJS || null;
  }
  if ((typeof document !== 'undefined') && (!document.querySelector(target))) {
    el = document.createElement('div');
    el.id = target.replace(/^#/, '');
    document.body.prepend(el);
  }
  if (opts.bundle) {
    bundle = opts.bundle;
  } else {
    bundleUrl = `${appBase}/bundle`;
    res = await fetch(bundleUrl);
    if (!(res.ok)) {
      throw new Error(`launch: ${bundleUrl} (${res.status})`);
    };
    bundle = await res.json();
  }
  app = stash({components: {}, routes: {}, data: {}});
  if (bundle.data) app.data = bundle.data;
  if (bundle.routes) {
    app.routes = bundle.routes;
  }
  if (persist && (typeof sessionStorage !== 'undefined')) {
    _storageKey = `__rip_${appBase}`;
    _storage = (persist === 'local') ? localStorage : sessionStorage;
    try {
      saved = _storage.getItem(_storageKey);
      if (saved) {
        savedData = JSON.parse(saved);
        for (const k in savedData) {
          const v = savedData[k];
          app.data[k] = v;
        };
      }
    } catch {
      null;
    }
    _save = function() {
      return (() => { try {
        return _storage.setItem(_storageKey, JSON.stringify(raw(app.data)));
      } catch {
        return null;
      } })();
    };
    __effect(function() {
      let t;
      _writeVersion.value;
      t = setTimeout(_save, 2000);
      return (function() {
        return clearTimeout(t);
      });
    });
    window.addEventListener('beforeunload', _save);
  }
  appComponents = createComponents();
  if (bundle.components) appComponents.load(bundle.components);
  classesKey = `__rip_${(appBase.replace(/\//g, '_') || 'app')}`;
  resolver = {map: buildComponentMap(appComponents), classes: {}, key: classesKey};
  if (typeof globalThis !== 'undefined') globalThis[classesKey] = resolver.classes;
  if (app.data.title && (typeof document !== 'undefined')) document.title = app.data.title;
  router = createRouter(appComponents, {root: 'components', base: appBase, hash: hash, onError: (function(err) {
    return console.error(`[Rip] Error ${err.status}: ${(err.message || err.path)}`);
  })});
  renderer = createRenderer({router: router, app: app, components: appComponents, resolver: resolver, compile: compile, target: target, onError: (function(err) {
    return console.error(`[Rip] ${err.message}`, err.error);
  })});
  renderer.start();
  if (bundle.data?.watch) {
    connectWatch(appComponents, router, renderer, `${appBase}/watch`, appBase);
  }
  if (typeof window !== 'undefined') {
    window.app = app;
    window.__RIP__ = {app: app, components: appComponents, router: router, renderer: renderer, cache: renderer.cache, version: '0.3.0'};
  }
  return {app, components: appComponents, router, renderer};
});