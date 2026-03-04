// 09-reactive.ts — Typed reactive state (:=, ~=, ~>, =!)
//
// Rip's reactive operators have no direct TypeScript equivalent.
// This file shows the closest plain-TS approximation for each.

// Typed state (:=) — in Rip, := creates a reactive signal
let clicks: number = 0
let username: string = 'Rip'
let enabled: boolean = true
let tags: string[] = []

// Typed computed (~=) — in Rip, ~= creates a reactive computed
// TS has no built-in computed; we use getters as the closest analog
const clicksDoubled: number = clicks * 2
const greeting: string = `Hello, ${username}!`
const hasTags: boolean = tags.length > 0

// Typed readonly (=!) — compiles to plain const, identical in TS
const MAX_RETRIES: number = 3
const API_VERSION: string = 'v2'

// Typed effect (~>) — in Rip, ~> creates a reactive side-effect
// TS has no equivalent; a plain function call is the closest analog
const clickLogger: Function = () => console.log('clicks changed:', clicks)

// ── Use the types ──

console.log('clicks:', clicks)
console.log('username:', username)
console.log('enabled:', enabled)
console.log('clicksDoubled:', clicksDoubled)
console.log('greeting:', greeting)
console.log('hasTags:', hasTags)
console.log('MAX_RETRIES:', MAX_RETRIES)
console.log('API_VERSION:', API_VERSION)

// ── Negative: wrong types must be caught ──

// @ts-expect-error — string assigned to number state
const badClicks: number = 'oops'
// @ts-expect-error — number assigned to string state
const badName: string = 42
// @ts-expect-error — string assigned to boolean state
const badEnabled: boolean = 'yes'
// @ts-expect-error — number[] assigned to string[] state
const badTags: string[] = [1, 2, 3]
