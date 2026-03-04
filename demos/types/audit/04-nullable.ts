// 04-nullable.ts — Nullable and optional types

// Nullable variables use explicit unions
let optionalName: string | undefined = undefined
let nullableCount: number | null = null

// Optional properties in structural types
type ContactInfo = {
  email: string
  phone?: string
  fax?: string
}

const info: ContactInfo = { email: 'test@example.com' }
console.log('email:', info.email)
console.log('phone:', info.phone)
