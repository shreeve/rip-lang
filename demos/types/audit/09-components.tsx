// 09-components.tsx — Typed component props
//
// React equivalent of the Rip component file. Direct comparison:
// Rip's @prop:: type := default → React's destructured props + useState
// Rip's ~= computed             → React's useMemo
// Rip's toggle: -> ...          → React's useCallback
// Rip's render block            → React's JSX return
// Rip's <=> two-way bind        → React's value + onChange (no equivalent)

import { useState, type ComponentProps } from 'react'

// ── Prop types ──

type InputProps = ComponentProps<'input'> & {
  label?: string
  error?: string
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary'
  loading?: boolean
}

// ── Components ──

function Input({ label, error, ...props }: InputProps) {
  return (
    <fieldset>
      {label && <label>{label}</label>}
      <input {...props} />
      {error && <div>{error}</div>}
    </fieldset>
  )
}

function Button({ variant = 'primary', loading, children, ...props }: ButtonProps) {
  const style = {
    background: variant === 'primary' ? '#0066ff' : '#e5e5e5',
    color: variant === 'primary' ? '#fff' : '#333',
  }
  return (
    <button style={style} {...props}>
      {loading ? 'Loading...' : children}
    </button>
  )
}

// ── Parent: sign-in form ──

function Form({ title = 'Sign In' }: { title?: string } = {}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    setLoading(true)
    console.log(`Signing in: ${email}`)
    setLoading(false)
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit() }}>
      <h1>{title}</h1>
      <Input
        label='Email'
        type='email'
        placeholder='jane@example.com'
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label='Password'
        type='password'
        placeholder='••••••••'
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type='submit' variant='primary' loading={loading}>Sign In</Button>
    </form>
  )
}

// ── Negative: wrong prop types must be caught ──

// @ts-expect-error — wrong variant literal
const badBtn = <Button variant='danger' />
// @ts-expect-error — disabled expects boolean
const badBtn2 = <Button disabled='yes' />
// @ts-expect-error — wrong type for label
const badInput = <Input label={123} />

// ── Event handler typing ──
//
// TypeScript + React gives typed event handlers automatically:
// onSubmit in the Form above gets React.FormEvent<HTMLFormElement>.
// onClick on <button> gives React.MouseEvent<HTMLButtonElement>.
// In Rip, `(e) ->` gives `any` for all handler params.

// ── Element type inheritance ──
//
// ComponentProps<'input'> (used by InputProps above) gives ALL of
// <input>'s props — onChange, onFocus, aria-*, etc. — for free.
// In Rip, each prop must be listed explicitly or it's unknown.

// ── Generic components ──
//
// TypeScript supports generic components:
//   function Select<T>({ options, value }: { options: T[], value: T }) { ... }
// The caller gets type-safe option/value types. Rip can't parameterize
// components by type — options and value are unrelated types.

// ── Context typing ──
//
// In practice, most React apps use zustand over createContext for
// global typed state — less boilerplate, same functionality:
//   const useStore = create<{ active: string }>((set) => ({ active: 'overview' }))
//   const active = useStore((s) => s.active)  // typed as string
// Rip's offer/accept have no type annotations — shared values are untyped.
