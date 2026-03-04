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
  const num = parseInt(input)
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

// ── Use: let TS infer return types from function signatures ──

const result1 = add(3, 4)
const result2 = greet('World')
const result3 = clamp(15, 0, 10)
const result4 = makePoint(1, 2)
const result5 = parse('42')
const result6 = sum(1, 2, 3, 4)
const result7 = isPositive(5)
const result8 = formal('Smith')
const result9 = formal('Smith', 'Dr')
logMsg('hello')

console.log(result1, result2, result3, result4, result5, result6, result7, result8, result9)

// ── Negative: wrong param types ──

// @ts-expect-error — string args where numbers expected
const badAdd: number = add('a', 'b')
// @ts-expect-error — number arg where string expected
const badGreet: string = greet(42)
// @ts-expect-error — too few arguments
const badClamp: number = clamp(5, 0)
// @ts-expect-error — boolean arg where number expected
const badPoint: Point = makePoint(true, false)
// @ts-expect-error — number arg where string expected
const badParse: number | null = parse(123)
// @ts-expect-error — string args where numbers expected
const badSum: number = sum('a', 'b')
// @ts-expect-error — string arg where number expected
const badPos: boolean = isPositive('five')

// ── Negative: wrong return types ──

// @ts-expect-error — add returns number, not string
const badRet1: string = add(1, 2)
// @ts-expect-error — greet returns string, not number
const badRet2: number = greet('hi')
// @ts-expect-error — makePoint returns Point, not string
const badRet3: string = makePoint(1, 2)
// @ts-expect-error — sum returns number, not boolean
const badRet4: boolean = sum(1, 2, 3)
// @ts-expect-error — isPositive returns boolean, not number
const badRet5: number = isPositive(1)

// ── Arrow functions and array transforms ──

const nums: number[] = [1, 2, 3, 4, 5]
const doubled: number[] = nums.map((x) => x * 2)
const evens: number[] = nums.filter((x) => x % 2 === 0)
const arrTotal: number = nums.reduce((acc, x) => acc + x, 0)

const words: string[] = ['hello', 'world', 'rip']
const upper: string[] = words.map((w) => w.toUpperCase())
const long: string[] = words.filter((w) => w.length > 3)
const joined: string = words.join(', ')

console.log('doubled:', doubled)
console.log('evens:', evens)
console.log('arrTotal:', arrTotal)
console.log('upper:', upper)
console.log('long:', long)
console.log('joined:', joined)

// @ts-expect-error — map returns number[], not string[]
const badMap: string[] = nums.map((x) => x * 2)
// @ts-expect-error — filter returns number[], not string[]
const badFilter: string[] = nums.filter((x) => x > 2)
// @ts-expect-error — reduce returns number, not string
const badReduce: string = nums.reduce((acc, x) => acc + x, 0)

// ── Works in TS but not in Rip (see .rip known gaps) ──

// Optional param — TS handles natively
export function greetOpt(name: string, title?: string): string {
  return title ? `${title} ${name}` : name
}

// Named/destructured param — TS handles natively
export function createUser({ name, age }: { name: string, age: number }): string {
  return `${name} is ${age}`
}

const r10 = greetOpt('Smith')
const r11 = greetOpt('Smith', 'Dr')
const r12 = createUser({ name: 'Jane', age: 30 })
console.log(r10, r11, r12)
