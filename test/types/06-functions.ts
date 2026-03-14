// 06-functions.ts — Typed functions, arrows, and array transforms

type Point = {
  x: number
  y: number
}

// ── Declare: typed functions ──

export function add(a: number, b: number): number {
  return a + b
}

export function greet(name: string): string {
  return `Hello, ${name}!`
}

export function clamp(val: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, val))
}

export function makePoint(x: number, y: number): Point {
  return { x, y }
}

export function parse(input: string): number | null {
  let num = parseInt(input)
  return isNaN(num) ? null : num
}

export function sum(...nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0)
}

export function isPositive(n: number): boolean {
  return n > 0
}

// Default param
export function formal(name: string, title: string = 'Mr'): string {
  return `${title} ${name}`
}

// Void return
export function logMsg(msg: string): void {
  console.log(msg)
}

// Optional param (? suffix)
export function greetOpt(name: string, title?: string): string {
  return title ? `${title} ${name}` : name
}

// Inferred return type (no annotation — TS infers from body)
export function double(n: number) {
  return n * 2
}

// ── Use: inferred results (no type annotations) ──

let result1 = add(3, 4)
let result2 = greet('World')
let result3 = clamp(15, 0, 10)
let result4 = makePoint(1, 2)
let result5 = parse('42')
let result6 = sum(1, 2, 3, 4)
let result7 = isPositive(5)
let result8 = formal('Smith')
let result9 = formal('Smith', 'Dr')
logMsg('hello')
let result10 = greetOpt('Smith')
let result11 = greetOpt('Smith', 'Dr')
let result12 = double(21)

console.log(result1, result2, result3, result4, result5, result6, result7, result8, result9, result10, result11, result12)

// ── Negative: wrong param types ──

// @ts-expect-error — string args where numbers expected
let badAdd: number = add('a', 'b')
// @ts-expect-error — number arg where string expected
let badGreet: string = greet(42)
// @ts-expect-error — too few arguments
let badClamp: number = clamp(5, 0)
// @ts-expect-error — boolean arg where number expected
let badPoint: Point = makePoint(true, false)
// @ts-expect-error — number arg where string expected
let badParse: number | null = parse(123)
// @ts-expect-error — string args where numbers expected
let badSum: number = sum('a', 'b')
// @ts-expect-error — string arg where number expected
let badPos: boolean = isPositive('five')

// ── Negative: wrong return types ──

// @ts-expect-error — add returns number, not string
let badRet1: string = add(1, 2)
// @ts-expect-error — greet returns string, not number
let badRet2: number = greet('hi')
// @ts-expect-error — makePoint returns Point, not string
let badRet3: string = makePoint(1, 2)
// @ts-expect-error — sum returns number, not boolean
let badRet4: boolean = sum(1, 2, 3)
// @ts-expect-error — isPositive returns boolean, not number
let badRet5: number = isPositive(1)
// @ts-expect-error — double infers number return, not string
let badRet6: string = double(1)

// ── Arrow functions and array transforms ──

let nums: number[] = [1, 2, 3, 4, 5]
let doubled = nums.map((x) => x * 2)
let evens = nums.filter((x) => x % 2 === 0)
let arrTotal = nums.reduce((acc, x) => acc + x, 0)

let words: string[] = ['hello', 'world', 'rip']
let upper = words.map((w) => w.toUpperCase())
let long = words.filter((w) => w.length > 3)
let joined = words.join(', ')

console.log('doubled:', doubled)
console.log('evens:', evens)
console.log('arrTotal:', arrTotal)
console.log('upper:', upper)
console.log('long:', long)
console.log('joined:', joined)

// @ts-expect-error — map returns number[], not string[]
let badMap: string[] = nums.map((x) => x * 2)
// @ts-expect-error — filter returns number[], not string[]
let badFilter: string[] = nums.filter((x) => x > 2)
// @ts-expect-error — reduce returns number, not string
let badReduce: string = nums.reduce((acc, x) => acc + x, 0)

// ── Destructured params ──

export function createUser({ name, age }: { name: string, age: number }): string {
  return `${name} is ${age}`
}

let result13 = createUser({ name: 'Jane', age: 30 })

console.log(result13)

// @ts-expect-error — number where string expected in destructured param
let badCreate: string = createUser({ name: 42, age: 30 })

// ── Destructured params: defaults ──

export function withDefaults({ name = 'anon', age = 0 }: { name?: string, age?: number } = {}): string {
  return `${name} is ${age}`
}

let result14 = withDefaults({})
let result15 = withDefaults({ name: 'Eve', age: 25 })

console.log(result14, result15)

// @ts-expect-error — number where string expected
let badDefaults: string = withDefaults({ name: 42 })

// ── Destructured params: rest ──

export function withRest({ name, ...rest }: { name: string, [key: string]: unknown }): string {
  return `${name}`
}

let result16 = withRest({ name: 'Alice', extra: true })

console.log(result16)

// ── Destructured params: rename ──

export function withRename({ name: userName, age }: { name: string, age: number }): string {
  return `${userName} is ${age}`
}

let result17 = withRename({ name: 'Bob', age: 42 })

console.log(result17)

// @ts-expect-error — number where string expected in renamed prop
let badRename: string = withRename({ name: 123, age: 42 })

// ── Destructured params: array ──

export function withArray([first, second]: [string, string]): string {
  return `${first} and ${second}`
}

let result18 = withArray(['hello', 'world'])

console.log(result18)

// @ts-expect-error — number where string expected in array destructured param
let badArray: string = withArray([42, 'world'])

// ── Destructured params: nested ──

export function withNested({ user: { name, age } }: { user: { name: string, age: number } }): string {
  return `${name} is ${age}`
}

let result19 = withNested({ user: { name: 'Carol', age: 35 } })

console.log(result19)

// @ts-expect-error — number where string expected in nested destructured param
let badNested: string = withNested({ user: { name: 123, age: 35 } })

// ── Semantic token showcase ──

export function parseNums(input: string, radix: number, fallback: number): number[] {
  return input.split(',').map(function(part) {
    let parsed = parseInt(part.trim(), radix)
    let value = isNaN(parsed) ? fallback : parsed
    return Math.max(0, Math.min(value, 1000))
  })
}

let result20 = parseNums('10, 20, ff, zz', 16, -1)
let result21 = [1, 2, 3].map(double)
let result22 = ['3', '7', 'nope'].map(function(it) { return (parseInt(it) || 0) })
console.log('parseNums:', result20)
console.log('map double:', result21)
console.log('map it:', result22)

// ── Async/await with ! (dammit) operator ──
// The ! (dammit) operator in Rip calls a function and awaits the result.
// In TS, this is just async/await. Return types flow through.

async function delay(ms: number): Promise<string> {
  await new Promise(r => setTimeout(r, ms))
  return `done after ${ms}ms`
}

let r1 = await delay(50)
console.log(`r1: ${r1}`)

// If we wrote `let r2: number = await delay(50)`, tsc catches:
//   "Type 'string' is not assignable to type 'number'" ✓

// Without return annotation, TS infers the return type from the body
async function delayUntyped(ms: number) {
  await new Promise(r => setTimeout(r, ms))
  return `untyped after ${ms}ms`
}

let r3 = await delayUntyped(50)
console.log(`r3: ${r3}`)
// r3 is inferred as string — assigning to number is caught
// @ts-expect-error — string is not assignable to number
let r4: number = r3
