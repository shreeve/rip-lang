// 01-basic.ts — Basic type annotations on variables (incl. nullable)

let count: number = 0
let label: string = 'Rip'
let active: boolean = true
let ratio: number = 3.14
let items: string[] = ['alpha', 'bravo', 'charlie']
let ids: number[] = [1, 2, 3]
let pair: [string, number] = ['hello', 42]

// ── Derive (let inference work — no annotations) ──

let total = count + ratio
let greeting = `${label} is ${active}`
let first = items[0]
let allIds = ids.reduce((a, b) => a + b, 0)
let pairLabel = pair[0]
let pairValue = pair[1]

console.log('total:', total)
console.log('greeting:', greeting)
console.log('first:', first)
console.log('allIds:', allIds)
console.log('pairLabel:', pairLabel)
console.log('pairValue:', pairValue)

// ── Negative: wrong types must be caught ──

// Wrong literals assigned to annotated variables
// @ts-expect-error — string assigned to number
let badCount: number = 'oops'
// @ts-expect-error — number assigned to string
let badLabel: string = 42
// @ts-expect-error — string assigned to boolean
let badActive: boolean = 'yes'
// @ts-expect-error — string[] assigned to number[]
let badIds: number[] = ['a', 'b']
// @ts-expect-error — swapped tuple members
let badPair: [string, number] = [123, 'hello']

// Wrong types on derived expressions
// @ts-expect-error — number + number can't be string
let badTotal: string = count + ratio
// @ts-expect-error — template literal can't be number
let badGreeting: number = `${label} is ${active}`
// @ts-expect-error — string[] element can't be boolean
let badFirst: boolean = items[0]
// @ts-expect-error — reduce of number[] can't be string
let badAllIds: string = ids.reduce((a, b) => a + b, 0)
// @ts-expect-error — tuple[0] is string, not number
let badPairLabel: number = pair[0]
// @ts-expect-error — tuple[1] is number, not string
let badPairValue: string = pair[1]

// ── Nullable and optional types ──

let optionalName: string | undefined = undefined
let nullableCount: number | null = null
let maybeName: string | undefined = 'hello'
let maybeCount: number | null = 42

console.log('optionalName:', optionalName)
console.log('nullableCount:', nullableCount)
console.log('maybeName:', maybeName)
console.log('maybeCount:', maybeCount)

// @ts-expect-error — number not assignable to string | undefined
let badOptional: string | undefined = 123
// @ts-expect-error — string not assignable to number | null
let badNullable: number | null = 'oops'

// ── Readonly (=!) — compiles to const ──

const MAX: number = 3
console.log('MAX:', MAX)

// @ts-expect-error — cannot reassign const
MAX = 999
