import { compile as twCompile } from 'tailwindcss'
import { parse } from 'css-tree'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const tailwindDir = dirname(fileURLToPath(import.meta.resolve('tailwindcss/package.json')))
const tailwindCss = {
  'tailwindcss': readFileSync(join(tailwindDir, 'index.css'), 'utf8'),
  'tailwindcss/preflight.css': readFileSync(join(tailwindDir, 'preflight.css'), 'utf8'),
  'tailwindcss/theme.css': readFileSync(join(tailwindDir, 'theme.css'), 'utf8'),
  'tailwindcss/utilities.css': readFileSync(join(tailwindDir, 'utilities.css'), 'utf8'),
}

function baseCssForConfig(config = {}) {
  const baseCss = `
@layer theme, base, components, utilities;
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
@config;
`
  return { baseCss, config }
}

async function createCompiler(config = {}) {
  const { baseCss } = baseCssForConfig(config)
  return twCompile(baseCss, {
    async loadModule(id, base, resourceHint) {
      if (resourceHint === 'config') return { path: id, base, module: config }
      throw new Error(`Unsupported Tailwind resource hint: ${resourceHint}`)
    },
    polyfills: 0,
    async loadStylesheet(id, base) {
      const content = tailwindCss[id]
      if (!content) throw new Error(`Unsupported Tailwind stylesheet: ${id}`)
      return { base, path: id, content }
    },
  })
}

function stableSerialize(value, seen = new WeakSet()) {
  if (value === null) return 'null'

  const kind = typeof value
  if (kind === 'string') return JSON.stringify(value)
  if (kind === 'number' || kind === 'boolean' || kind === 'bigint') return String(value)
  if (kind === 'undefined') return 'undefined'
  if (kind === 'symbol') return value.toString()
  if (kind === 'function') return `[Function:${value.toString()}]`

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry, seen)).join(',')}]`
  }

  if (kind === 'object') {
    if (seen.has(value)) return '[Circular]'
    seen.add(value)

    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key], seen)}`)

    seen.delete(value)
    return `{${entries.join(',')}}`
  }

  return String(value)
}

export function configCacheKey(config = {}) {
  return stableSerialize(config)
}

const compilerCache = new Map()
const compilerPromises = new Map()
const defaultCompiler = await createCompiler({})
compilerCache.set(configCacheKey({}), defaultCompiler)

export async function prepareConfig(config = {}) {
  const key = configCacheKey(config)
  if (compilerCache.has(key)) return compilerCache.get(key)
  if (compilerPromises.has(key)) return compilerPromises.get(key)

  const promise = createCompiler(config).then((compiler) => {
    compilerCache.set(key, compiler)
    compilerPromises.delete(key)
    return compiler
  })

  compilerPromises.set(key, promise)
  return promise
}

export function compile(classes = [], config = {}) {
  const key = configCacheKey(config)
  const compiler = compilerCache.get(key)

  if (!compiler) {
    throw new Error(
      'Tailwind config is not prepared for synchronous compile(). Call await prepareConfig(config) before rendering themed email or browser CSS in the synchronous unified-ui path.',
    )
  }

  const css = compiler.build(classes)
  return { css, styleSheet: parse(css), rulesPerClass: new Map() }
}
