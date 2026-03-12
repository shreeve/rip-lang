// 08-reactive.ts — Typed reactive state (:=, ~=, ~>)
//
// React equivalents of Rip's reactive operators:
// Rip's := (state)    → React's useState
// Rip's ~= (computed) → derived const (recalculated every render)
// Rip's ~> (effect)   → console.log in render body (useEffect doesn't fire in SSR)
//
// Rip's reactive primitives work at module scope with auto-tracking.
// React hooks require a component context — we use renderToString
// to execute the component and produce matching runtime output.

import { useState, createElement } from 'react'
import { renderToString } from 'react-dom/server'

function ReactiveDemo() {
  // Typed state (:=)
  const [clicks] = useState(0)
  const [username] = useState('Rip')
  const [enabled] = useState(true)
  const [tags] = useState<string[]>([])

  // Computed (~=) — inferred from expression
  const clicksDoubled = clicks * 2
  const greeting = `Hello, ${username}!`
  const hasTags = tags.length > 0

  // Typed effect (~>) — runs in render body for SSR output
  console.log('clicks changed:', clicks)

  // ── Use the types ──
  console.log('clicks:', clicks)
  console.log('username:', username)
  console.log('enabled:', enabled)
  console.log('clicksDoubled:', clicksDoubled)
  console.log('greeting:', greeting)
  console.log('hasTags:', hasTags)
  return null
}

// Execute the component via SSR — hooks run, output is produced
renderToString(createElement(ReactiveDemo))

// ── Negative: wrong types must be caught ──

// @ts-expect-error — string assigned to number state
function useNeg1() { const [x] = useState<number>('oops'); return x }
// @ts-expect-error — number assigned to string state
function useNeg2() { const [x] = useState<string>(42); return x }
// @ts-expect-error — string assigned to boolean state
function useNeg3() { const [x] = useState<boolean>('yes'); return x }
// @ts-expect-error — number[] assigned to string[] state
function useNeg4() { const [x] = useState<string[]>([1, 2, 3]); return x }

// @ts-expect-error — number assigned to string computed
const badComputed: string = 0 * 2
