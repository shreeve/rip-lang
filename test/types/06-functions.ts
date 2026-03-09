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

// ── Known gaps (Rip only) ──

// Named/destructured param — TS handles natively
export function createUser({ name, age }: { name: string, age: number }): string {
  return `${name} is ${age}`
}

createUser({ name: 'Jane', age: 30 })
