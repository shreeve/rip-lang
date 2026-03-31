// 09-components.tsx — Typed component props
//
// React equivalent of the Rip component file. Direct comparison:
// Rip's @prop:: type := default → React's destructured props + useState
// Rip's ~= computed             → React's useMemo
// Rip's toggle: -> ...          → React's useCallback
// Rip's render block            → React's JSX return
// Rip's <=> two-way bind        → React's value + onChange (no equivalent)

import { SubmitEventHandler, useState, ComponentProps } from 'react'

// ── Prop types ──

type InputProps = ComponentProps<'input'> & {
  label?: string
  error?: string
}

type ButtonProps = ComponentProps<'button'> & {
  variant: 'primary' | 'secondary'
  shape?: 'rounded' | 'pill'
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

function Button({ variant, shape = 'rounded', loading, children, ...props }: ButtonProps) {
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

  const onSubmit: SubmitEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault()
    setLoading(true)
    console.log(`Signing in: ${email}`)
    setLoading(false)
  }

  return (
    <form onSubmit={onSubmit}>
      <h1>{title}</h1>
      <Input
        label='Email'
        value={email}
        placeholder='jane@example.com'
        type='email'
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label='Password'
        value={password}
        placeholder='••••••••'
        type='password'
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button
        variant='primary'
        type='submit'
        loading={loading}>
        Sign In
      </Button>
    </form>
  )
}

// ── Negative: wrong prop types must be caught ──

function PropTypeTests() {
  return (
    <div>
      {/* @ts-expect-error — wrong variant literal */}
      <Button variant='danger' />
      {/* @ts-expect-error — disabled expects boolean */}
      <Button variant='primary' disabled='yes' />
      {/* @ts-expect-error — wrong type for label */}
      <Input label={123} />
      {/* @ts-expect-error — inherited intrinsic: maxLength expects number */}
      <Input maxLength='ten' />
    </div>
  )
}

// ── Negative: type safety inside component bodies ──

function TypeTestComp({ variant = 'primary' as 'primary' | 'secondary', count = 0 }) {
  const ok = variant === 'primary' ? '#0066ff' : '#e5e5e5'

  // @ts-expect-error — toFixed doesn't exist on string union
  const badFixed = variant.toFixed(2)

  // @ts-expect-error — arithmetic on string type
  const badMath = variant * 2

  function badMethod() {
    // @ts-expect-error — string assigned to number variable
    const x: number = 'hello'
  }

  function badBodyAssign() {
    // @ts-expect-error — string assigned to inferred boolean variable
    const loading: boolean = 'wrong'
  }

  return null
}

// ── Generic components ──
//
// TypeScript supports generic components where T is bounded by a known shape.
// The constraint flows through all props — options must satisfy TOptionShape,
// and the component knows how to render them without extra callbacks.
// Rip can't parameterize components by type — options would be `any[]`.

type TOptionShape = string | { value: string; label: string }

type SelectProps<TOption extends TOptionShape> = ComponentProps<'select'> & {
  label?: string
  options: TOption[]
  placeholder?: string
  error?: string
}

function Select<TOption extends TOptionShape>({ label, options, placeholder, error, ...props }: SelectProps<TOption>) {
  return (
    <fieldset>
      {label && <label>{label}</label>}
      <select {...props}>
        {placeholder && <option value='' disabled>{placeholder}</option>}
        {options.map((option) => {
          const value = typeof option === 'string' ? option : option.value
          const label = typeof option === 'string' ? option : option.label
          return <option key={value} value={value}>{label}</option>
        })}
      </select>
      {error && <div>{error}</div>}
    </fieldset>
  )
}

// Usage — T is inferred from the options array

// Simple: string options
const colors = ['Red', 'Green', 'Blue']
const stringSelect = (
  <Select
    options={colors} // T inferred as string
    label='Color'
  />
)

// Structured: { value, label } options
const roles = [{ value: 'admin', label: 'Admin' }, { value: 'user', label: 'User' }]
const roleSelect = (
  <Select
    options={roles} // T inferred as { value: string; label: string }
    label='Role'
  />
)

// Negative tests — TOption must satisfy TOptionShape

// @ts-expect-error — number doesn't extend TOptionShape
const badSelect1 = <Select options={[1, 2, 3]} />

// @ts-expect-error — object missing 'label' field (has 'name' instead)
const badSelect2 = <Select options={[{ value: 'a', name: 'A' }]} />

// @ts-expect-error — error expects string | boolean, not number
const badSelect3 = <Select options={['a']} error={42} />

// In Rip, a Select component can't express `TOption extends TOptionShape`. The
// @options prop would be typed as `any[]` or a specific concrete type —
// there's no way to say "anything that's a string or { value, label }"
// and have that constraint checked at the call site.

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
const bad1 = create<Cart>(() => ({ items: 'not an array', addItem: () => { }, removeItem: () => { }, total: () => 0 }))

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
