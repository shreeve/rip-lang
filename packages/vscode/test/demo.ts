// ============================================================================
// TypeScript Syntax Highlighting Demo
// ============================================================================
//
// Open this file side-by-side with demo.rip and use
// "Developer: Inspect Editor Tokens and Scopes" to compare.

// --- Comments ---------------------------------------------------------------

// This is a line comment
/* This is a
block comment */

// --- Variables & Constants --------------------------------------------------

let myName = "Alice"
let count = 0
let items = [1, 2, 3]
const MAX = 100

// --- Type Annotations -------------------------------------------------------

let age: number = 25
let label: string = "hello"
let active: boolean = true
let scores: number[] = [90, 95, 88]
let cache: Map<string, number> = new Map()

// --- Type Aliases & Interfaces ----------------------------------------------

type ID = number
type UserID = number | string
type Point = { x: number; y: number }

type User = {
  id: number
  name: string
  email?: string
}

type Status =
  | "active"
  | "inactive"
  | "pending"

interface Shape {
  area: () => number
  name: string
}

interface Widget extends Shape {
  render: () => void
}

enum Color {
  Red,
  Green,
  Blue,
}

enum HttpCode {
  ok = 200,
  created = 201,
  notFound = 404,
}

// --- Numbers ----------------------------------------------------------------

let decimal = 42
let float = 3.14
let negative = -7
let sci = 1.5e10
let hex = 0xFF
let octal = 0o77
let binary = 0b1010
let big = 100n
let underscore = 1_000_000

// --- Strings ----------------------------------------------------------------

let single = 'hello'
let double = "world"
let interp = `name is ${name}`
let template = `count is ${count}`

// (no heredoc equivalent)

// --- Regex ------------------------------------------------------------------

let pattern = /[a-z]+/gi
let match = "test".match(/es/)

// (no heregex equivalent in TypeScript)

// --- Booleans & Null --------------------------------------------------------

let yesVal = true
let noVal = false
let nothing: null = null
let missing: undefined = undefined
let inf = Infinity
let nan = NaN
let selfRef = this

// --- Functions --------------------------------------------------------------

function greet(person: string): string {
  return `Hello, ${person}!`
}

function add(a: number, b: number): number {
  return a + b
}

const square = (x: number) => x * x
const doubleFn = (x: number) => x * 2

function noop(): void {
  return
}

// --- Classes ----------------------------------------------------------------

class Animal {
  name: string
  sound: string

  constructor(name: string, sound: string) {
    this.name = name
    this.sound = sound
  }

  speak() {
    return `${this.name} says ${this.sound}`
  }
}

class Dog extends Animal {
  constructor(name: string) {
    super(name, "Woof")
  }

  fetch(item: string) {
    return `${this.name} fetches ${item}`
  }
}

let dog = new Dog("Buddy")

// --- Operators --------------------------------------------------------------

function operators(a: number, b: number) {
  // Arithmetic
  let sum = 1 + 2
  let diff = 5 - 3
  let prod = 4 * 2
  let quot = 10 / 3
  let floorDiv = Math.floor(7 / 2)
  let modulo = ((10 % 3) + 3) % 3
  let power = 2 ** 8

  // Comparison
  let eq = a == b
  let neq = a != b
  let lt = a < b
  let gt = a > b
  let lte = a <= b
  let gte = a >= b

  // Logical
  let both = a && b
  let either = a || b
  let negated = !a
  let same = a === b
  let different = a !== b

  // Bitwise
  let bitAnd = a & b
  let bitOr = a | b
  let bitXor = a ^ b
  let bitNot = ~a
  let lshift = a << 2
  let rshift = a >> 2

  // Increment / Decrement
  count++
  count--
}

// --- TypeScript-Specific Operators ------------------------------------------

function tsOperators(obj: any, val: string | null, arr: number[]) {
  // Optional chaining
  let safe = obj?.prop
  let safeFn = obj?.fn()
  let safeIdx = arr?.[0]

  // Nullish coalescing
  let fallback = val ?? "default"

  // Spread
  let [first, ...rest] = arr
  let merged = { ...obj, extra: 1 }
}

// --- Assignment Operators ---------------------------------------------------

function assignments() {
  let x = 1
  x += 2
  x -= 1
  x *= 3
  x /= 2
  x %= 4
  x **= 2
  x &&= 1
  x ||= 0
  x ??= 0
}

// --- Destructuring ----------------------------------------------------------

function destructuring(person: { name: string; age: number }, list: number[]) {
  let { name: userName, age } = person
  let [head, ...tail] = list
}

// --- Control Flow -----------------------------------------------------------

function controlFlow(active: boolean, items: number[], obj: Record<string, number>, x: number) {
  if (active) {
    console.log("yes")
  } else if (count === 0) {
    console.log("zero")
  } else {
    console.log("no")
  }

  let result = active ? "a" : "b"

  // postfix if / unless → inline conditionals
  if (true) console.log("done")
  if (!true) return "error"

  // unless → negated if
  if (!false) {
    console.log("proceed")
  }

  for (let item of items) {
    console.log(item)
  }

  for (let [key, val] of Object.entries(obj)) {
    console.log(key, val)
  }

  // for...as with when → for...of with filter
  for (let x of items) {
    if (x > 0) console.log(x)
  }

  // for...by -1 → reverse loop
  for (let i = items.length - 1; i >= 0; i--) {
    console.log(items[i])
  }

  while (count > 0) {
    count--
  }

  // until → do...while with negation
  let done = false
  do {
    done = true
  } while (!done)

  switch (x) {
    case 1: console.log("one"); break
    case 2: console.log("two"); break
    default: console.log("other")
  }

  for (let i = 0; i < 5; i++) {
    console.log("repeat")
  }

  // Comprehensions → map/filter
  let squares = Array.from({ length: 10 }, (_, i) => (i + 1) ** 2)
  let evens = Array.from({ length: 20 }, (_, i) => i + 1).filter(x => x % 2 === 0)
}

// --- Async / Await ----------------------------------------------------------

async function fetchData() {
  let response = await fetch("/api")
  let data = await response.json()
  return data
}

// --- Module Imports ---------------------------------------------------------

// import fs from "fs";
// import { readFile, writeFile } from "fs/promises";
// import * as path from "path";
//
// export default greet;
// export { add, square };

// --- Utility Functions (analogous to Rip standard library) ------------------

console.log("hello")
console.log(JSON.stringify({ a: 1 }, null, 2))
console.assert(true, "must be true")
typeof 42

// --- Components (no direct TS equivalent) -----------------------------------

// Counter = component
//   @count := 0
//   render
//     div "Count: {@count}"
