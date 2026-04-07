// 02-aliases.ts — Type aliases (simple, union, typeof)

// Simple aliases
type ID = number
type Name = string
type Email = string
type Timestamp = number

// Union aliases
type UserID = number | string
type Primitive = string | number | boolean

// typeof in type position
let defaults = { theme: 'dark', lang: 'en' }
type Defaults = typeof defaults

// ── Use the aliases ──

let userId: ID = 42
let name: Name = 'Jane'
let email: Email = 'jane@example.com'
let ts: Timestamp = 1700000000000

let mixedId: UserID = 'abc-123'
let prim: Primitive = true

let prefs: Defaults = { theme: 'light', lang: 'fr' }

console.log('userId:', userId)
console.log('name:', name)
console.log('email:', email)
console.log('ts:', ts)
console.log('mixedId:', mixedId)
console.log('prim:', prim)
console.log('prefs:', prefs)

// ── Negative: wrong types must be caught ──

// @ts-expect-error — string assigned to ID (number)
let badId: ID = 'not-a-number'
// @ts-expect-error — number assigned to Name (string)
let badName: Name = 42
// @ts-expect-error — boolean assigned to Email (string)
let badEmail: Email = true
// @ts-expect-error — wrong shape for Defaults
let badPrefs: Defaults = { theme: 123, lang: true }

// ── Function type aliases ──

type Comparator = (a: number, b: number) => number
type Getter = () => string
type Transform<T, R> = (input: T) => R

let sorter: Comparator = (a, b) => a - b
let greet: Getter = () => 'hello'
let toStr: Transform<number, string> = (n) => String(n)

console.log('sorter:', sorter(3, 1))
console.log('greet:', greet())
console.log('toStr:', toStr(42))

// @ts-expect-error — wrong return type for Comparator (string instead of number)
let badSorter: Comparator = (a, b) => 'nope'
