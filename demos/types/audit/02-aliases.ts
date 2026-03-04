// 02-aliases.ts — Type aliases (simple, union, typeof)

// Simple aliases
type ID = number
type Name = string
type Email = string
type Timestamp = number

// Union aliases
type UserID = number | string
type Primitive = string | number | boolean
type Nullable = string | null

// typeof in type position — extract a type from a runtime value
const defaults = { theme: 'dark', lang: 'en' }
type Defaults = typeof defaults
