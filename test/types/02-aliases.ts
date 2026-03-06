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
const defaults = { theme: 'dark', lang: 'en' }
type Defaults = typeof defaults

// ── Use the aliases ──

const userId: ID = 42
const name: Name = 'Jane'
const email: Email = 'jane@example.com'
const ts: Timestamp = Date.now()

const mixedId: UserID = 'abc-123'
const prim: Primitive = true

const prefs: Defaults = { theme: 'light', lang: 'fr' }

console.log('userId:', userId)
console.log('name:', name)
console.log('email:', email)
console.log('ts:', ts)
console.log('mixedId:', mixedId)
console.log('prim:', prim)
console.log('prefs:', prefs)

// ── Negative: wrong types must be caught ──

// @ts-expect-error — string assigned to ID (number)
const badId: ID = 'not-a-number'
// @ts-expect-error — number assigned to Name (string)
const badName: Name = 42
// @ts-expect-error — boolean assigned to Email (string)
const badEmail: Email = true
// @ts-expect-error — wrong shape for Defaults
const badPrefs: Defaults = { theme: 123, lang: true }
