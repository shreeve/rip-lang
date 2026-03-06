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

// ── Stash vs zustand: shared client state (shopping cart) ──

import { create } from 'zustand'

// Same shape as CartItem in 09-components.rip
type CartItem = {
  id: number
  name: string
  price: number
  quantity: number
}

type Cart = Readonly<{
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (item: CartItem) => void
  total: () => number
}>

const useCart = create<Cart>()((set, get) => ({
  items: [],
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  removeItem: (item) => set((s) => ({ items: s.items.filter((i) => i.id !== item.id) })),
  total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
}))

// Components — every selector is typed

function CartBadge() {
  const items = useCart((s) => s.items)              // typed: CartItem[]
  return <span>{items.length} items</span>
}

function CartTotal() {
  const total = useCart((s) => s.total)              // typed: () => number
  return <div>Total: ${total()}</div>
}

function AddToCart() {
  const addItem = useCart((s) => s.addItem)          // typed: (item: CartItem) => void
  return (
    <button onClick={() => addItem({ id: 1, name: 'Widget', price: 9.99, quantity: 1 })}>
      Add to Cart
    </button>
  )
}

// ── Negative tests: zustand catches every mistake ──

// @ts-expect-error — wrong type: items should be CartItem[], not string
const bad1 = create<Cart>(() => ({ items: 'not an array', addItem: () => {}, removeItem: () => {}, total: () => 0 }))

// The remaining negative tests call useCart() which invokes React hooks.
// They must live inside a function body to avoid the "invalid hook call"
// error at runtime (hooks require a React component/render context).
function _negativeTests() {
  // @ts-expect-error — wrong item shape: missing required fields
  const bad2 = useCart((s) => s.addItem({ broken: true }))

  // @ts-expect-error — typo: 'item' doesn't exist, it's 'items'
  const bad3 = useCart((s) => s.item)

  // @ts-expect-error — nonexistent path
  const bad4 = useCart((s) => s.tax)

  // @ts-expect-error — wrong arg type: number instead of CartItem
  const bad5 = useCart((s) => s.removeItem(42))
}

// All five caught at compile time. In Rip's stash, all five
// compile silently — the types exist in .d.ts but have no
// connection to the stash proxy.
