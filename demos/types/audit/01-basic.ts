// 01-basic.ts — Basic type annotations on variables (incl. nullable)

const count: number = 0
const label: string = 'Rip'
const active: boolean = true
const ratio: number = 3.14
const items: string[] = ['alpha', 'bravo', 'charlie']
const ids: number[] = [1, 2, 3]
const pair: [string, number] = ['hello', 42]

// ── Derive (let inference work — no annotations) ──

const total = count + ratio
const greeting = `${label} is ${active}`
const first = items[0]
const allIds = ids.reduce((a, b) => a + b, 0)
const pairLabel = pair[0]
const pairValue = pair[1]

console.log('total:', total)
console.log('greeting:', greeting)
console.log('first:', first)
console.log('allIds:', allIds)
console.log('pairLabel:', pairLabel)
console.log('pairValue:', pairValue)

// ── Negative: wrong types must be caught ──

// Wrong literals assigned to annotated variables
// @ts-expect-error — string assigned to number
const badCount: number = 'oops'
// @ts-expect-error — number assigned to string
const badLabel: string = 42
// @ts-expect-error — string assigned to boolean
const badActive: boolean = 'yes'
// @ts-expect-error — string[] assigned to number[]
const badIds: number[] = ['a', 'b']
// @ts-expect-error — swapped tuple members
const badPair: [string, number] = [123, 'hello']

// Wrong types on derived expressions
// @ts-expect-error — number + number can't be string
const badTotal: string = count + ratio
// @ts-expect-error — template literal can't be number
const badGreeting: number = `${label} is ${active}`
// @ts-expect-error — string[] element can't be boolean
const badFirst: boolean = items[0]
// @ts-expect-error — reduce of number[] can't be string
const badAllIds: string = ids.reduce((a, b) => a + b, 0)
// @ts-expect-error — tuple[0] is string, not number
const badPairLabel: number = pair[0]
// @ts-expect-error — tuple[1] is number, not string
const badPairValue: string = pair[1]

// ── Nullable and optional types ──

let optionalName: string | undefined = undefined
let nullableCount: number | null = null
const maybeName: string | undefined = 'hello'
const maybeCount: number | null = 42

console.log('optionalName:', optionalName)
console.log('nullableCount:', nullableCount)
console.log('maybeName:', maybeName)
console.log('maybeCount:', maybeCount)

// @ts-expect-error — number not assignable to string | undefined
const badOptional: string | undefined = 123
// @ts-expect-error — string not assignable to number | null
const badNullable: number | null = 'oops'
