// 04-nullable.ts — Nullable and optional types

// Nullable variables use explicit unions
let optionalName: string | undefined = undefined;
let nullableCount: number | null = null;

// Optional properties in structural types
type ContactInfo = {
  email: string;
  phone?: string;
  fax?: string;
};

// ── Use the types ──

const info: ContactInfo = { email: "test@example.com" };
const fullContact: ContactInfo = { email: "a@b.com", phone: "555-0100", fax: "555-0199" };
const minContact: ContactInfo = { email: "min@test.com" };

const maybeName: string | undefined = "hello";
const resetName: string | undefined = undefined;
const maybeCount: number | null = 42;
const resetCount: number | null = null;

console.log("email:", info.email);
console.log("phone:", info.phone);
console.log("fullContact:", fullContact);
console.log("maybeName:", maybeName);
console.log("maybeCount:", maybeCount);

// ── Negative: wrong types must be caught ──

// @ts-expect-error — number not assignable to string | undefined
const badOptional: string | undefined = 123;
// @ts-expect-error — string not assignable to number | null
const badNullable: number | null = "oops";
// @ts-expect-error — missing required field (email)
const badContact: ContactInfo = { phone: "555-0100" };
// @ts-expect-error — wrong type for optional field
const badPhone: ContactInfo = { email: "a@b.com", phone: 12345 };
