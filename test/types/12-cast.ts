// 12-cast.ts — companion to 12-cast.rip (must produce identical output)

type Base = { id: number }
type Rich = { id: number; label: string }

function makeRich(): Rich {
  return { id: 1, label: 'one' }
}

// ── Downcast: base type → richer subtype ──

const b: Base = makeRich()
// @ts-expect-error — `label` is not on Base
b.label
const r = b as Rich
console.log(r.label)

// ── `unknown` → concrete ──

let raw: unknown = 'hello'
// @ts-expect-error — value is of type 'unknown'
raw.toUpperCase()
const upper = (raw as string).toUpperCase()
console.log(upper)

// ── Augmented shape (extra custom property) — mirrors the ARIA `__aria*` props ──

type Meta = { tag: string; __meta: number }

function getEl(): { tag: string } {
  const o = { tag: 'div', __meta: 9 }
  return o
}

const e = getEl()
// @ts-expect-error — `__meta` is not on { tag: string }
e.__meta
console.log((e as Meta).__meta)

// ── Precedence: the cast binds tighter than `+` ──

let n: unknown = 3
// @ts-expect-error — arithmetic on 'unknown'
n + 1
const sum = (n as number) + 1
console.log(sum)

// ── Chained cast: unknown → Base → Rich ──

let u: unknown = makeRich()
const chained = (u as Base as Rich).label
console.log(chained)

// ── Member access narrows too (the carrier is the property) ──

const box: { inner: Base } = { inner: makeRich() }
// @ts-expect-error — `label` is not on Base
box.inner.label
const mlabel = (box.inner as Rich).label
console.log(mlabel)

// ── Known gap (pending RFC-12): call / index / parenthesized results do NOT
// narrow. The runtime erase is still correct; only the type narrowing is lost,
// so these forms are deliberately NOT exercised as positive narrowing cases.
// e.g. `(makeRich() as Rich)`, `(arr[0] as Rich)`, and `((b) as Rich)` compile
// and erase, but the assertion is dropped from the checker's view. Use an
// identifier or member-access carrier when you need narrowing today.
