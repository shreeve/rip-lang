// 08-reactive.ts — Typed reactive state (:=, ~=, ~>, =!)
//
// React equivalents of Rip's reactive operators:
// Rip's := (state)    → React's useState
// Rip's ~= (computed) → no equivalent; derived values recalculate every render
// Rip's ~> (effect)   → React's useEffect
// Rip's =! (readonly) → plain const (identical)
//
// Note: React hooks require a component/hook context. Rip's reactive
// primitives work at module scope — no wrapper needed.

import { useState, useEffect } from 'react'

// Typed readonly (=!) — plain const, no hook needed
const MAX_RETRIES: number = 3
const API_VERSION: string = 'v2'

function useReactiveDemo() {
  // Typed state (:=)
  const [clicks, setClicks] = useState<number>(0)
  const [username, setUsername] = useState<string>('Rip')
  const [enabled, setEnabled] = useState<boolean>(true)
  const [tags, setTags] = useState<string[]>([])

  // Typed computed (~=)
  const clicksDoubled: number = clicks * 2
  const greeting: string = `Hello, ${username}!`
  const hasTags: boolean = tags.length > 0

  // Typed effect (~>)
  useEffect(() => {
    console.log('clicks changed:', clicks)
  }, [clicks])

  return { clicks, username, enabled, tags, clicksDoubled, greeting, hasTags }
}

// ── Negative: wrong types must be caught ──

function useNegatives() {
  // @ts-expect-error — string assigned to number state
  const [badClicks] = useState<number>('oops')
  // @ts-expect-error — number assigned to string state
  const [badName] = useState<string>(42)
  // @ts-expect-error — string assigned to boolean state
  const [badEnabled] = useState<boolean>('yes')
  // @ts-expect-error — number[] assigned to string[] state
  const [badTags] = useState<string[]>([1, 2, 3])

  // @ts-expect-error — string assigned to number readonly
  const badMax: number = 'nope'
  // @ts-expect-error — number assigned to string computed
  const badComputed: string = 1 * 2
}
