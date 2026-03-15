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
let interp = `name is ${myName}`
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

function doNothing(): void {
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
  let mod = ((10 % 3) + 3) % 3
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
  // x &&= 1              // TODO: TS narrows x to literal 1 after &&=, blocking ||= and ??=
  // x ||= 0
  // x ??= 0
}

// --- Destructuring ----------------------------------------------------------

function destructuring(person: { name: string; age: number }, list: number[]) {
  let { name: userName, age } = person
  let [head, ...tail] = list
}

// --- Control Flow -----------------------------------------------------------

function controlFlow(active: boolean, items: number[], obj: Record<string, number>, x: number) {
  let count = 10
  if (active) {
    console.log("yes")
  } else if (count === 0) {
    console.log("zero")
  } else {
    console.log("no")
  }

  let result = active ? "a" : "b"

  // postfix if / unless → inline conditionals
  if (active) console.log("done")
  if (!active) return "error"

  // unless → negated if
  if (!active) {
    console.log("skip")
  }

  for (let item of items) {
    console.log(item)
  }

  for (let [key, val] of Object.entries(obj)) {
    console.log(key, val)
  }

  // for...in with when → for...of with filter
  for (let n of items) {
    if (n > 0) console.log(n)
  }

  // for...by -1 → reverse loop
  for (let i = items.length - 1; i >= 0; i--) {
    console.log(items[i])
  }

  while (count > 0) {
    count--
  }

  // let done = false               // TODO: TS narrows done to literal false, blocking done = true
  // do {
  //   done = true
  // } while (!done)

  for (let i = 0; i < 5; i++) {
    console.log("repeat")
  }

  // let squares = items.map(n => n * n)                // TODO: comprehension compiles to [] then push, TS infers never[]
  // let evens = items.filter(n => n % 2 === 0)

  switch (x) {
    case 1: console.log("one"); break
    case 2: console.log("two"); break
    default: console.log("other")
  }
}

// --- Guard Clauses ---------------------------------------------------------

function guardClauses(getValue: Function, lookup: Function) {
  let x = getValue() || (() => { return })()  // or return
  let y = lookup() ?? (() => { throw new Error("missing") })()
}

// --- Async / Await ----------------------------------------------------------

async function fetchData() {
  let response = await fetch("/api")
  let data = await response.json()
  return data
}

// --- Instance Variables -----------------------------------------------------

class UserAccount {
  constructor(public name: string, public email: string) {}

  display() {
    console.log(this.name, this.email)
  }
}

// --- Data Attributes (no direct TS equivalent) ------------------------------

// Rip uses $-prefixed variables for data attributes:
// $visible = true

// --- Embedded JavaScript (no direct TS equivalent) --------------------------

// Rip supports inline JS with backticks:
// `const raw = "inline JS"`

// --- Module Imports ---------------------------------------------------------

// import fs from "fs"
// import { readFile, writeFile } from "fs/promises"
// import * as path from "path"
//
// export { greet, add, square }

// --- Standard Library (analogous to Rip stdlib) ----------------------------

console.log('hello')                            // p 'hello'
console.log(JSON.stringify({ a: 1 }, null, 2))  // pp { a: 1 }
console.assert(true, 'must be true')            // assert true, 'must be true'
typeof 42                                       // kind 42
await new Promise(r => setTimeout(r, 100))      // sleep 100
Math.floor(Math.random() * 10) + 1              // rand 1, 10

// --- Deprecated API (strikethrough test) -------------------------------------

let escaped: string = escape('hello & world')

// --- Word Literal (no direct TS equivalent) ---------------------------------

// Rip: colors = %w[red green blue]
let colors = ['red', 'green', 'blue']

// --- Reactivity (no direct TS equivalent) -----------------------------------

// Rip reactive operators:
//
// counter := 0
// doubled ~= counter * 2
// ~> console.log('counter changed:', counter)
// logger ~> console.log('logged:', counter)
//
// Typed reactive variables:
//
// clicks:: number := 0              // typed state (Signal<number>)
// username:: string := 'Rip'        // typed state (Signal<string>)
// enabled:: boolean := true
// tags:: string[] := []
// clicksDoubled:: number ~= clicks * 2
// greeting ~= 'Hello, ' + username + '!'
// MAX_RETRIES:: number =! 3         // typed readonly (const)
// clickLogger:: Function ~> ...     // typed effect

// --- Components (no direct TS equivalent) -----------------------------------

// Rip components are a language feature:
//
// Counter = component
//   count := 0
//
//   render
//     input <=> count
//     div 'Count: #{count}'
//
// Typed components:
//
// Button = component
//   @label:: string := 'Click'
//   @variant:: 'primary' | 'secondary' := 'primary'
//   @disabled:: boolean := false
//
//   bg ~= if @variant is 'primary' then '#06f' else '#e5e5e5'
//
//   render
//     button disabled: @disabled, style: 'background: #{bg}'
//       slot
