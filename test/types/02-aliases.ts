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

// ── Gap: function type aliases ──
// These work in TypeScript but currently parse-error in Rip.
// Function types work as structural type members but not as
// standalone type alias values.
//
type Callback = (error: Error, data: string) => void
type Comparator = (a: number, b: number) => number
type Handler = () => void
