// =============================================================================
// Comprehensive test suite for @rip-lang/http.
//
// Runs the same tests against both the typed (http-typed.rip) and untyped
// (http.rip) versions to:
//   1. Verify behavioral parity on every public-surface feature.
//   2. Surface, as failures on the untyped version, the bugs that types caught.
//
// Run: bun test packages/http/http.test.js
// =============================================================================

import { test, expect, describe } from 'bun:test'
import httpTyped   from './http-typed.rip'
import httpUntyped from './http.rip'

// -----------------------------------------------------------------------------
// Harness
// -----------------------------------------------------------------------------

const VERSIONS = [
  ['typed',   httpTyped],
  ['untyped', httpUntyped],
]

// Run the same test body for both versions.
const both = (name, fn) => {
  for (const [label, http] of VERSIONS) {
    test(`[${label}] ${name}`, () => fn(http, label))
  }
}

const startServer = (handler) => {
  const server = Bun.serve({ port: 0, fetch: handler })
  return {
    url:  `http://localhost:${server.port}`,
    stop: () => server.stop(true),
  }
}

const echoServer = () =>
  startServer(async (req) => {
    const body = req.body ? await req.text() : null
    return Response.json({
      method:  req.method,
      url:     req.url,
      headers: Object.fromEntries(req.headers),
      body,
    })
  })

// -----------------------------------------------------------------------------
// Method shortcuts
// -----------------------------------------------------------------------------

describe('Methods', () => {
  for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
    const shortcut = m === 'DELETE' ? 'del' : m.toLowerCase()
    both(`${shortcut}() sends ${m}`, async (http) => {
      const s = startServer((req) => new Response(req.method, { headers: { 'x-m': req.method } }))
      const res = await http[shortcut](s.url)
      expect(res.headers.get('x-m')).toBe(m)
      s.stop()
    })
  }

  both('default method is GET', async (http) => {
    const s = startServer((req) => new Response(req.method))
    const res = await http(s.url)
    expect(await res.text()).toBe('GET')
    s.stop()
  })

  both('explicit method option', async (http) => {
    const s = startServer((req) => new Response(req.method))
    const res = await http(s.url, { method: 'patch' }) // lowercase, must uppercase
    expect(await res.text()).toBe('PATCH')
    s.stop()
  })
})

// -----------------------------------------------------------------------------
// URL handling
// -----------------------------------------------------------------------------

describe('URL handling', () => {
  both('absolute string URL', async (http) => {
    const s = startServer((req) => new Response(req.url))
    const res = await http(`${s.url}/foo`)
    expect(await res.text()).toMatch(/\/foo$/)
    s.stop()
  })

  both('URL instance input', async (http) => {
    const s = startServer((req) => new Response(req.url))
    const res = await http(new URL(`${s.url}/bar`))
    expect(await res.text()).toMatch(/\/bar$/)
    s.stop()
  })

  both('prefixUrl + relative path', async (http) => {
    const s = startServer((req) => new Response(req.url))
    const res = await http('items/42', { prefixUrl: `${s.url}/api/` })
    expect(await res.text()).toMatch(/\/api\/items\/42$/)
    s.stop()
  })

  both('prefixUrl auto-adds trailing slash', async (http) => {
    const s = startServer((req) => new Response(req.url))
    const res = await http('items', { prefixUrl: `${s.url}/api` }) // no slash
    expect(await res.text()).toMatch(/\/api\/items$/)
    s.stop()
  })

  both('prefixUrl strips leading slash from input', async (http) => {
    const s = startServer((req) => new Response(req.url))
    const res = await http('/items', { prefixUrl: `${s.url}/api/` })
    expect(await res.text()).toMatch(/\/api\/items$/)
    s.stop()
  })

  both('searchParams as object', async (http) => {
    const s = startServer((req) => new Response(req.url))
    const res = await http(s.url, { searchParams: { a: 1, b: 'two' } })
    const url = await res.text()
    expect(url).toContain('a=1')
    expect(url).toContain('b=two')
    s.stop()
  })

  both('searchParams as string', async (http) => {
    const s = startServer((req) => new Response(req.url))
    const res = await http(s.url, { searchParams: 'x=1&y=2' })
    const url = await res.text()
    expect(url).toContain('x=1')
    expect(url).toContain('y=2')
    s.stop()
  })

  both('searchParams as URLSearchParams', async (http) => {
    const s = startServer((req) => new Response(req.url))
    const res = await http(s.url, { searchParams: new URLSearchParams('q=hello') })
    expect(await res.text()).toContain('q=hello')
    s.stop()
  })

  both('searchParams skips null/undefined', async (http) => {
    const s = startServer((req) => new Response(req.url))
    const res = await http(s.url, { searchParams: { a: 1, b: null, c: undefined, d: 0 } })
    const url = await res.text()
    expect(url).toContain('a=1')
    expect(url).toContain('d=0')
    expect(url).not.toContain('b=')
    expect(url).not.toContain('c=')
    s.stop()
  })

  both('prefixUrl as URL instance', async (http) => {
    const s = startServer((req) => new Response(req.url))
    const res = await http('foo', { prefixUrl: new URL(`${s.url}/api/`) })
    expect(await res.text()).toMatch(/\/api\/foo$/)
    s.stop()
  })
})

// -----------------------------------------------------------------------------
// Headers
// -----------------------------------------------------------------------------

describe('Headers', () => {
  both('per-request headers as object', async (http) => {
    const s = startServer((req) => new Response(req.headers.get('x-custom') || ''))
    const res = await http(s.url, { headers: { 'X-Custom': 'hello' } })
    expect(await res.text()).toBe('hello')
    s.stop()
  })

  both('per-request headers as Headers instance', async (http) => {
    const s = startServer((req) => new Response(req.headers.get('x-custom') || ''))
    const h = new Headers({ 'X-Custom': 'world' })
    const res = await http(s.url, { headers: h })
    expect(await res.text()).toBe('world')
    s.stop()
  })

  both('default headers from create()', async (http) => {
    const s = startServer((req) => new Response(req.headers.get('x-token') || ''))
    const inst = http.create({ headers: { 'X-Token': 'abc' } })
    const res = await inst(s.url)
    expect(await res.text()).toBe('abc')
    s.stop()
  })

  both('extend() merges headers', async (http) => {
    const s = startServer((req) => Response.json({
      a: req.headers.get('x-a'),
      b: req.headers.get('x-b'),
    }))
    const a = http.create({ headers: { 'X-A': '1' } })
    const b = a.extend({ headers: { 'X-B': '2' } })
    const res = await b(s.url)
    expect(await res.json()).toEqual({ a: '1', b: '2' })
    s.stop()
  })

  both('per-request header overrides default', async (http) => {
    const s = startServer((req) => new Response(req.headers.get('x-tok')))
    const inst = http.create({ headers: { 'X-Tok': 'old' } })
    const res = await inst(s.url, { headers: { 'X-Tok': 'new' } })
    expect(await res.text()).toBe('new')
    s.stop()
  })
})

// -----------------------------------------------------------------------------
// Body / JSON
// -----------------------------------------------------------------------------

describe('Body and JSON', () => {
  both('body passthrough', async (http) => {
    const s = startServer(async (req) => new Response(await req.text()))
    const res = await http.post(s.url, { body: 'hello' })
    expect(await res.text()).toBe('hello')
    s.stop()
  })

  both('json: sets content-type and stringifies', async (http) => {
    const s = startServer(async (req) => Response.json({
      ct:   req.headers.get('content-type'),
      body: await req.text(),
    }))
    const res = await http.post(s.url, { json: { hello: 'world' } })
    const got = await res.json()
    expect(got.ct).toBe('application/json')
    expect(JSON.parse(got.body)).toEqual({ hello: 'world' })
    s.stop()
  })

  both('json: does not override existing content-type', async (http) => {
    const s = startServer((req) => new Response(req.headers.get('content-type')))
    const res = await http.post(s.url, {
      json: { a: 1 },
      headers: { 'content-type': 'application/vnd.foo+json' },
    })
    expect(await res.text()).toBe('application/vnd.foo+json')
    s.stop()
  })
})

// -----------------------------------------------------------------------------
// Errors
// -----------------------------------------------------------------------------

describe('Errors', () => {
  both('throws HTTPError on 4xx by default', async (http) => {
    const s = startServer(() => new Response('nope', { status: 404 }))
    let err
    try { await http(s.url) } catch (e) { err = e }
    s.stop()
    expect(err).toBeDefined()
    expect(err.name).toBe('HTTPError')
    expect(err.message).toContain('404')
    expect(err.response).toBeDefined()
    expect(err.request).toBeDefined()
    expect(err.options).toBeDefined()
  })

  both('throws HTTPError on 5xx by default', async (http) => {
    const s = startServer(() => new Response('boom', { status: 500 }))
    let err
    try { await http(s.url) } catch (e) { err = e }
    s.stop()
    expect(err?.name).toBe('HTTPError')
    expect(err?.response.status).toBe(500)
  })

  both('throwHttpErrors: false returns response', async (http) => {
    const s = startServer(() => new Response('nope', { status: 404 }))
    const res = await http(s.url, { throwHttpErrors: false })
    expect(res.status).toBe(404)
    s.stop()
  })

  both('HTTPError exposed on instance', async (http) => {
    expect(typeof http.HTTPError).toBe('function')
    expect(typeof http.TimeoutError).toBe('function')
  })
})

// -----------------------------------------------------------------------------
// Timeout
// -----------------------------------------------------------------------------

describe('Timeout', () => {
  both('throws TimeoutError on slow response', async (http) => {
    const s = startServer(async () => {
      await new Promise(r => setTimeout(r, 200))
      return new Response('late')
    })
    let err
    try { await http(s.url, { timeout: 50, retry: 0 }) } catch (e) { err = e }
    s.stop()
    expect(err?.name).toBe('TimeoutError')
  })

  both('caller-provided signal preserved', async (http) => {
    const ctrl = new AbortController()
    const s = startServer(async () => {
      await new Promise(r => setTimeout(r, 200))
      return new Response('late')
    })
    setTimeout(() => ctrl.abort(), 30)
    let err
    try { await http(s.url, { signal: ctrl.signal, retry: 0, timeout: 5000 }) } catch (e) { err = e }
    s.stop()
    // Aborted by caller — should surface as some kind of error (Timeout or AbortError)
    expect(err).toBeDefined()
  })
})

// -----------------------------------------------------------------------------
// Retry
// -----------------------------------------------------------------------------

describe('Retry', () => {
  both('retry: 0 disables retries', async (http) => {
    let hits = 0
    const s = startServer(() => { hits++; return new Response('x', { status: 503 }) })
    try { await http(s.url, { retry: 0 }) } catch {}
    s.stop()
    expect(hits).toBe(1)
  })

  both('retry: false disables retries', async (http) => {
    let hits = 0
    const s = startServer(() => { hits++; return new Response('x', { status: 503 }) })
    try { await http(s.url, { retry: false }) } catch {}
    s.stop()
    expect(hits).toBe(1)
  })

  both('retry: number sets limit', async (http) => {
    let hits = 0
    const s = startServer(() => { hits++; return new Response('x', { status: 503, headers: { 'Retry-After': '0' } }) })
    try { await http(s.url, { retry: 3 }) } catch {}
    s.stop()
    expect(hits).toBe(4) // initial + 3 retries
  })

  both('retry config: methods filter (POST not retried by default)', async (http) => {
    let hits = 0
    const s = startServer(() => { hits++; return new Response('x', { status: 503, headers: { 'Retry-After': '0' } }) })
    try { await http.post(s.url, { retry: 3 }) } catch {}
    s.stop()
    expect(hits).toBe(1) // POST not in default RETRY_METHODS
  })

  both('retry config: custom methods allow POST retry', async (http) => {
    let hits = 0
    const s = startServer(() => { hits++; return new Response('x', { status: 503, headers: { 'Retry-After': '0' } }) })
    try { await http.post(s.url, { retry: { limit: 2, methods: ['POST'], statusCodes: [503] } }) } catch {}
    s.stop()
    expect(hits).toBe(3)
  })

  both('retry config: statusCodes filter (404 not retried)', async (http) => {
    let hits = 0
    const s = startServer(() => { hits++; return new Response('x', { status: 404 }) })
    try { await http(s.url, { retry: 3 }) } catch {}
    s.stop()
    expect(hits).toBe(1) // 404 not in default RETRY_CODES
  })

  both('custom delay function used', async (http) => {
    let hits = 0
    const s = startServer(() => { hits++; return new Response('x', { status: 503 }) })
    let delayCalls = 0
    try {
      await http(s.url, {
        retry: { limit: 2, statusCodes: [503], methods: ['GET'], delay: (a) => { delayCalls++; return 5 } },
      })
    } catch {}
    s.stop()
    expect(hits).toBe(3)
    expect(delayCalls).toBe(2)
  })

  both('Retry-After: numeric seconds honored', async (http) => {
    let hits = 0
    const s = startServer(() => {
      hits++
      return new Response('x', { status: 503, headers: { 'Retry-After': '0' } })
    })
    const start = Date.now()
    try { await http(s.url, { retry: { limit: 1, statusCodes: [503], methods: ['GET'] } }) } catch {}
    const elapsed = Date.now() - start
    s.stop()
    expect(hits).toBe(2)
    expect(elapsed).toBeLessThan(100) // Retry-After: 0 → no wait
  })

  // ---------- Retry-After unparseable ----------

  both('Retry-After: garbage falls back to backoff (~300ms)', async (http) => {
    let hits = 0
    const s = startServer(() => { hits++; return new Response('x', { status: 503, headers: { 'Retry-After': 'bananas' } }) })
    const start = Date.now()
    try { await http(s.url, { retry: { limit: 1, statusCodes: [503], methods: ['GET'] } }) } catch {}
    const elapsed = Date.now() - start
    s.stop()
    expect(hits).toBe(2)
    expect(elapsed).toBeGreaterThan(200) // proper backoff
  })
})

// -----------------------------------------------------------------------------
// Hooks
// -----------------------------------------------------------------------------

describe('Hooks', () => {
  both('beforeRequest can mutate request via return', async (http) => {
    const s = startServer((req) => new Response(req.headers.get('x-injected') || ''))
    const res = await http(s.url, {
      hooks: {
        beforeRequest: [(req) => new Request(req, { headers: { ...Object.fromEntries(req.headers), 'X-Injected': 'yes' } })],
      },
    })
    expect(await res.text()).toBe('yes')
    s.stop()
  })

  both('beforeRequest can short-circuit with Response', async (http) => {
    let hits = 0
    const s = startServer(() => { hits++; return new Response('real') })
    const res = await http(s.url, {
      hooks: {
        beforeRequest: [() => new Response('cached')],
      },
    })
    expect(await res.text()).toBe('cached')
    expect(hits).toBe(0)
    s.stop()
  })

  both('beforeRetry called on retry', async (http) => {
    let calls = 0
    const s = startServer(() => new Response('x', { status: 503, headers: { 'Retry-After': '0' } }))
    try {
      await http(s.url, {
        retry: { limit: 2, statusCodes: [503], methods: ['GET'] },
        hooks: { beforeRetry: [() => { calls++ }] },
      })
    } catch {}
    s.stop()
    expect(calls).toBe(2)
  })

  both('afterResponse can replace response', async (http) => {
    const s = startServer(() => new Response('original'))
    const res = await http(s.url, {
      hooks: {
        afterResponse: [() => new Response('replaced')],
      },
    })
    expect(await res.text()).toBe('replaced')
    s.stop()
  })

  both('beforeError can replace error', async (http) => {
    const s = startServer(() => new Response('nope', { status: 500 }))
    let err
    try {
      await http(s.url, {
        retry: 0,
        hooks: {
          beforeError: [(e) => {
            e.message = 'custom: ' + e.message
            return e
          }],
        },
      })
    } catch (e) { err = e }
    s.stop()
    expect(err?.message).toMatch(/^custom:/)
  })
})

// -----------------------------------------------------------------------------
// Factory
// -----------------------------------------------------------------------------

describe('Factory', () => {
  both('create() makes independent instance', async (http) => {
    const s = startServer((req) => new Response(req.headers.get('x-tok') || 'none'))
    const a = http.create({ headers: { 'X-Tok': 'A' } })
    const b = http.create({ headers: { 'X-Tok': 'B' } })
    const ra = await a(s.url)
    const rb = await b(s.url)
    expect(await ra.text()).toBe('A')
    expect(await rb.text()).toBe('B')
    s.stop()
  })

  both('extend() inherits and overrides', async (http) => {
    const s = startServer((req) => Response.json({
      a: req.headers.get('x-a'),
      b: req.headers.get('x-b'),
    }))
    const base = http.create({ headers: { 'X-A': '1', 'X-B': 'old' } })
    const ext  = base.extend({ headers: { 'X-B': 'new' } })
    expect(await (await ext(s.url)).json()).toEqual({ a: '1', b: 'new' })
    s.stop()
  })

  both('extend() merges hooks (does not replace)', async (http) => {
    let baseCalls = 0, extCalls = 0
    const s = startServer(() => new Response('ok'))
    const base = http.create({ hooks: { beforeRequest: [() => { baseCalls++ }] } })
    const ext  = base.extend({ hooks: { beforeRequest: [() => { extCalls++ }] } })
    await ext(s.url)
    s.stop()
    expect(baseCalls).toBe(1)
    expect(extCalls).toBe(1)
  })
})

// -----------------------------------------------------------------------------
// Error classes
// -----------------------------------------------------------------------------

describe('Error classes', () => {
  both('HTTPError instanceof Error', async (http) => {
    const s = startServer(() => new Response('x', { status: 500 }))
    let err
    try { await http(s.url, { retry: 0 }) } catch (e) { err = e }
    s.stop()
    expect(err instanceof Error).toBe(true)
    expect(err instanceof http.HTTPError).toBe(true)
    expect(err.name).toBe('HTTPError')
  })

  both('TimeoutError instanceof Error', async (http) => {
    const s = startServer(async () => {
      await new Promise(r => setTimeout(r, 200))
      return new Response('late')
    })
    let err
    try { await http(s.url, { timeout: 30, retry: 0 }) } catch (e) { err = e }
    s.stop()
    expect(err instanceof Error).toBe(true)
    expect(err instanceof http.TimeoutError).toBe(true)
    expect(err.name).toBe('TimeoutError')
  })

  both('HTTPError carries response/request/options', async (http) => {
    const s = startServer(() => new Response('boom', { status: 503 }))
    let err
    try { await http(s.url, { retry: 0, timeout: 1000 }) } catch (e) { err = e }
    s.stop()
    expect(err.response).toBeInstanceOf(Response)
    expect(err.request).toBeInstanceOf(Request)
    expect(err.options).toBeDefined()
    expect(err.options.timeout).toBe(1000)
  })
})

// -----------------------------------------------------------------------------
// Option passthrough — fetch RequestInit fields baked into Request
// -----------------------------------------------------------------------------

describe('RequestInit passthrough', () => {
  // Spy on the Request the library hands to fetch — that's what our code controls.
  // (Bun's Request constructor doesn't faithfully round-trip every RequestInit field
  // when you read it back, so we capture by stubbing fetch.)
  const captureRequest = async (http, opts) => {
    const orig = globalThis.fetch
    let captured
    globalThis.fetch = (req) => { captured = req; return Promise.resolve(new Response('ok')) }
    try {
      await http('http://example.test/x', opts)
    } finally {
      globalThis.fetch = orig
    }
    return captured
  }

  both('passes credentials and redirect through to Request', async (http) => {
    // Note: Bun's Request constructor drops most RequestInit fields when read
    // back (mode, cache, referrer, referrerPolicy, integrity, keepalive). The
    // library passes them through to fetch — Bun just doesn't expose them on
    // the constructed Request. Limit assertions to fields Bun round-trips.
    const req = await captureRequest(http, {
      credentials: 'include',
      redirect:    'manual',
    })
    expect(req.credentials).toBe('include')
    expect(req.redirect).toBe('manual')
  })
})

// -----------------------------------------------------------------------------
// Additional gap coverage
// -----------------------------------------------------------------------------

describe('Headers — array form', () => {
  both('accepts [[k,v], ...] tuple form', async (http) => {
    const s = startServer((req) => new Response(req.headers.get('x-a') + ',' + req.headers.get('x-b')))
    const res = await http(s.url, { headers: [['x-a', '1'], ['x-b', '2']] })
    expect(await res.text()).toBe('1,2')
    s.stop()
  })
})

describe('searchParams — array values', () => {
  both('array value coerces via String()', async (http) => {
    const s = startServer((req) => new Response(req.url))
    const res = await http(s.url, { searchParams: { tag: ['a', 'b'] } })
    // Array stringifies to "a,b"; URL encodes comma as %2C
    expect(await res.text()).toMatch(/tag=a%2Cb/)
    s.stop()
  })
})

describe('json — falsy values', () => {
  both('json: null is treated as absent (no body, no content-type)', async (http) => {
    const s = startServer(async (req) => Response.json({
      ct:   req.headers.get('content-type'),
      body: req.body ? await req.text() : null,
    }))
    const res = await http(s.url, { method: 'POST', json: null })
    const data = await res.json()
    expect(data.ct).toBeNull()
    expect(data.body).toBeNull()
    s.stop()
  })

  both('json: 0 is sent (falsy but defined)', async (http) => {
    const s = startServer(async (req) => Response.json({
      ct:   req.headers.get('content-type'),
      body: await req.text(),
    }))
    const res = await http(s.url, { method: 'POST', json: 0 })
    const data = await res.json()
    expect(data.ct).toMatch(/application\/json/)
    expect(data.body).toBe('0')
    s.stop()
  })
})

describe('prefixUrl — absolute input ignores prefix', () => {
  both('absolute URL input bypasses prefixUrl', async (http) => {
    // Only one server is hit; prefixUrl points to a black hole.
    const s = startServer((req) => new Response(req.url))
    const res = await http(s.url + '/direct', { prefixUrl: 'http://blackhole.invalid/api/' })
    expect(await res.text()).toMatch(/\/direct$/)
    s.stop()
  })
})

describe('extend — multi-level chain', () => {
  both('two levels of extend merge headers cumulatively', async (http) => {
    const s = startServer((req) => Response.json(Object.fromEntries(req.headers)))
    const a = http.create({ headers: { 'x-a': '1' } })
    const b = a.extend({ headers: { 'x-b': '2' } })
    const c = b.extend({ headers: { 'x-c': '3' } })
    const res  = await c(s.url)
    const hdrs = await res.json()
    expect(hdrs['x-a']).toBe('1')
    expect(hdrs['x-b']).toBe('2')
    expect(hdrs['x-c']).toBe('3')
    s.stop()
  })
})

describe('Hook ordering', () => {
  both('multiple beforeRequest hooks run in order; first Response short-circuits', async (http) => {
    const calls = []
    const stub  = new Response('stub')
    const res   = await http('http://example.test/x', {
      hooks: {
        beforeRequest: [
          (req) => { calls.push('a'); return undefined },
          (req) => { calls.push('b'); return stub },
          (req) => { calls.push('c'); return undefined }, // must not run
        ],
      },
    })
    expect(calls).toEqual(['a', 'b'])
    expect(await res.text()).toBe('stub')
  })

  both('multiple afterResponse hooks run in order; later replaces earlier', async (http) => {
    const s = startServer(() => new Response('orig'))
    const res = await http(s.url, {
      hooks: {
        afterResponse: [
          (req, opts, r) => new Response('first'),
          (req, opts, r) => new Response((r.statusText || '') + 'second'),
        ],
      },
    })
    expect(await res.text()).toBe('second')
    s.stop()
  })
})

describe('Retry — backoffLimit cap', () => {
  both('backoffLimit caps backoff wait', async (http) => {
    let hits = 0
    const s = startServer(() => { hits++; return new Response('x', { status: 503 }) })
    const start = Date.now()
    try {
      await http(s.url, { retry: { limit: 1, statusCodes: [503], methods: ['GET'], backoffLimit: 50 } })
    } catch {}
    const elapsed = Date.now() - start
    s.stop()
    expect(hits).toBe(2)
    // Without cap, attempt-1 backoff is ~1000ms*jitter. Cap of 50ms → well under 200ms total.
    expect(elapsed).toBeLessThan(200)
  })
})

describe('Retry — network-error path', () => {
  both('retries on connection failure, then throws', async (http) => {
    // Bind a server, capture port, stop it — that port is now refused.
    const probe = Bun.serve({ port: 0, fetch: () => new Response('') })
    const url   = `http://localhost:${probe.port}`
    probe.stop(true)

    let retries = 0
    let err
    try {
      await http(url, {
        timeout: 2000,
        retry:   { limit: 2, methods: ['GET'], statusCodes: [], backoffLimit: 10, delay: () => 5 },
        hooks:   { beforeRetry: [() => { retries++ }] },
      })
    } catch (e) { err = e }
    expect(err).toBeDefined()
    expect(retries).toBe(2)
  })
})

describe('Retry — exhausted error carries last response', () => {
  both('HTTPError after retries holds the final failing Response', async (http) => {
    let hits = 0
    const s = startServer(() => {
      hits++
      return new Response('boom', { status: 503, headers: { 'x-hit': String(hits) } })
    })
    let err
    try {
      await http(s.url, { retry: { limit: 2, statusCodes: [503], methods: ['GET'], delay: () => 1 } })
    } catch (e) { err = e }
    s.stop()
    expect(hits).toBe(3)
    expect(err).toBeInstanceOf(http.HTTPError)
    expect(err.response.status).toBe(503)
    expect(err.response.headers.get('x-hit')).toBe('3')
  })
})

// -----------------------------------------------------------------------------
// Runtime contracts — behaviors types cannot express
//
// These tests assert semantic guarantees that no type system catches, even a
// fully-typed one: input immutability, concurrency isolation, retry-body
// correctness, abort signal propagation, header case normalization, encoding
// correctness, edge-case retry limits. A regression in any of these would
// compile cleanly under both Rip's TS-strict pass and untouched by `tsc`.
// -----------------------------------------------------------------------------

describe('Input immutability', () => {
  both('caller options object is not mutated', async (http) => {
    const s = startServer(() => new Response('ok'))
    const opts = {
      method:  'POST',
      headers: { 'x-a': '1' },
      json:    { x: 1 },
      retry:   { limit: 0 },
    }
    const snapshot = JSON.parse(JSON.stringify(opts))
    await http(s.url, opts)
    s.stop()
    expect(opts).toEqual(snapshot) // no body added, no headers normalization leaked
  })

  both('caller Headers instance is not mutated', async (http) => {
    const s  = startServer(() => new Response('ok'))
    const hs = new Headers({ 'x-a': '1' })
    const before = [...hs.entries()].sort()
    await http(s.url, { method: 'POST', json: { x: 1 }, headers: hs })
    s.stop()
    const after = [...hs.entries()].sort()
    expect(after).toEqual(before) // json:'s content-type didn't leak into caller's Headers
  })

  both('caller defaults survive across many requests via create()', async (http) => {
    const s = startServer((req) => new Response(req.headers.get('x-tag') ?? ''))
    const inst = http.create({ headers: { 'x-tag': 'persist' } })
    await inst(s.url)
    await inst(s.url, { headers: { 'x-tag': 'override' } })
    const r3 = await inst(s.url) // must still see 'persist', not 'override'
    s.stop()
    expect(await r3.text()).toBe('persist')
  })
})

describe('Retry-After — HTTP-date format', () => {
  both('Retry-After: past HTTP-date retries immediately (clamped to 0)', async (http) => {
    let hits = 0
    const s = startServer(() => {
      hits++
      const past = new Date(Date.now() - 60_000).toUTCString()
      return new Response('x', { status: 503, headers: { 'Retry-After': past } })
    })
    const start = Date.now()
    try { await http(s.url, { retry: { limit: 1, statusCodes: [503], methods: ['GET'] } }) } catch {}
    const elapsed = Date.now() - start
    s.stop()
    expect(hits).toBe(2)
    expect(elapsed).toBeLessThan(100) // negative delta clamped to 0
  })
})

describe('Concurrency isolation', () => {
  both('concurrent calls via the same instance retry independently', async (http) => {
    const counts = new Map()
    const s = startServer((req) => {
      const id    = new URL(req.url).searchParams.get('id')
      const count = (counts.get(id) ?? 0) + 1
      counts.set(id, count)
      return count === 1 ? new Response('x', { status: 503 }) : new Response('ok')
    })
    const inst = http.create({
      retry: { limit: 1, statusCodes: [503], methods: ['GET'], delay: () => 1 },
    })
    const results = await Promise.all([1, 2, 3].map(id =>
      inst(s.url, { searchParams: { id: String(id) } }).then(r => r.ok)))
    s.stop()
    expect(results).toEqual([true, true, true])
    expect(counts.get('1')).toBe(2)
    expect(counts.get('2')).toBe(2)
    expect(counts.get('3')).toBe(2)
  })
})

describe('Retry — body re-sent', () => {
  both('POST body is re-sent on retry (Request.clone())', async (http) => {
    const bodies = []
    const s = startServer(async (req) => {
      bodies.push(await req.text())
      return bodies.length === 1
        ? new Response('x', { status: 503 })
        : new Response('ok')
    })
    const res = await http(s.url, {
      method: 'POST',
      json:   { ping: 1 },
      retry:  { limit: 1, statusCodes: [503], methods: ['POST'], delay: () => 1 },
    })
    s.stop()
    expect(res.ok).toBe(true)
    expect(bodies).toEqual(['{"ping":1}', '{"ping":1}'])
  })
})

describe('AbortSignal mid-retry', () => {
  both('caller abort during retry delay short-circuits the loop', async (http) => {
    let hits = 0
    const s = startServer(() => { hits++; return new Response('x', { status: 503 }) })
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 25)
    const start = Date.now()
    let err
    try {
      await http(s.url, {
        signal: ctrl.signal,
        retry:  { limit: 5, statusCodes: [503], methods: ['GET'], delay: () => 200 },
      })
    } catch (e) { err = e }
    const elapsed = Date.now() - start
    s.stop()
    expect(err).toBeDefined()
    expect(hits).toBeLessThan(5)        // exhausted retries would mean 6 hits
    expect(elapsed).toBeLessThan(1000)  // 5 * 200ms = 1000ms ceiling
  })
})

describe('Header case-insensitivity', () => {
  both('json: respects caller Content-Type even when capitalized', async (http) => {
    const s = startServer(async (req) => Response.json({ ct: req.headers.get('content-type') }))
    const res = await http(s.url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/vnd.custom+json' }, // capitalized
      json:    { x: 1 },
    })
    const data = await res.json()
    s.stop()
    expect(data.ct).toBe('application/vnd.custom+json')
  })

  both('per-request header overrides default regardless of case', async (http) => {
    const s    = startServer((req) => new Response(req.headers.get('x-tag')))
    const inst = http.create({ headers: { 'X-Tag': 'default' } })
    const res  = await inst(s.url, { headers: { 'x-tag': 'override' } })
    s.stop()
    expect(await res.text()).toBe('override')
  })
})

describe('searchParams — encoding correctness', () => {
  both('special characters in keys and values are URL-encoded', async (http) => {
    const s   = startServer((req) => new Response(req.url))
    const res = await http(s.url, { searchParams: { 'q a': 'a&b=c d' } })
    const url = await res.text()
    s.stop()
    // Key: space encoded as %20 or +
    expect(url).toMatch(/q(\+|%20)a=/)
    // Value: & = space all escaped
    expect(url).toMatch(/a%26b%3Dc(\+|%20)d/)
  })
})

describe('retry edge limits', () => {
  both('retry: { limit: 0 } sends one request, no retries', async (http) => {
    let hits = 0
    const s = startServer(() => { hits++; return new Response('x', { status: 503 }) })
    try {
      await http(s.url, { retry: { limit: 0, statusCodes: [503], methods: ['GET'] } })
    } catch {}
    s.stop()
    expect(hits).toBe(1)
  })
})
