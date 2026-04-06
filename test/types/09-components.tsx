// 09-components.tsx — Typed component props
//
// React equivalent of the Rip component file. Direct comparison:
// Rip's @prop:: type := default → React's destructured props + useState
// Rip's ~= computed             → React's useMemo
// Rip's toggle: -> ...          → React's useCallback
// Rip's render block            → React's JSX return
// Rip's <=> two-way bind        → React's value + onChange (no equivalent)

import { SubmitEventHandler, useState, ComponentProps, MouseEventHandler } from 'react'

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

// ── Negative: render block conditional type checking ──
//
// In Rip, conditionals, switch discriminants, and loop iterables in render
// blocks are now type-checked. JSX already catches these via standard scoping.

function RenderCondTest() {
  const [label] = useState('')
  const [error] = useState('')
  const [items] = useState(['a', 'b'])
  const [status] = useState('active')
  const [loading] = useState(false)
  const [count] = useState(42)

  return (
    <div>
      {/* @ts-expect-error — typo: 'labelz' does not exist */}
      {labelz && <span>label</span>}
      {/* @ts-expect-error — typo: 'loadingz' does not exist */}
      {!loadingz && <span>ready</span>}
      {/* @ts-expect-error — typo: 'statusz' does not exist */}
      {statusz === 'active' ? <span>on</span> : <span>off</span>}
      {/* @ts-expect-error — typo: 'itemsz' does not exist */}
      {itemsz.map((item: string) => <span key={item}>{item}</span>)}
      {/* @ts-expect-error — typo: 'countz' does not exist */}
      {countz}
    </div>
  )
}

// ── Event handler typing ──
//
// Both inline and named method refs are typed.
// In React, event handler params get contextual typing from JSX attributes
// (onClick types e as MouseEvent, onSubmit types e as FormEvent, etc.)

function EventHandlerTest() {
  // Named method refs — explicit parameter types
  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (e) => e.preventDefault()
  const handleClick: MouseEventHandler<HTMLButtonElement> = (e) => console.log(e.clientX)

  return (
    <form onSubmit={handleSubmit}>
      <button onClick={handleClick}>Click</button>
      {/* Inline handlers — contextual typing from JSX attributes */}
      <button onClick={(e) => console.log(e.clientX)}>Inline</button>
      <input onKeyDown={(e) => console.log(e.key)} />
    </form>
  )
}

// ── Generic components ──
//
// TypeScript supports generic components where T is bounded by a known shape.
// The constraint flows through all props — options must satisfy TOptionShape,
// and the component knows how to render them without extra callbacks.
// Rip supports this via `Name<T extends Constraint> = component` syntax.

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

function GenericUsageTests() {
  return (
    <div>
      {/* Simple: string options */}
      <Select options={['Red', 'Green', 'Blue']} />

      {/* Structured: { value, label } options */}
      <Select options={[{ value: 'admin', label: 'Admin' }, { value: 'user', label: 'User' }]} />

      {/* @ts-expect-error — number doesn't extend TOptionShape */}
      <Select options={[1, 2, 3]} />

      {/* @ts-expect-error — object missing 'label' field (has 'name' instead) */}
      <Select options={[{ value: 'a', name: 'A' }]} />
    </div>
  )
}

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

// Components — cart used in render (JSX equivalent of Rip render blocks)

function CartDemo() {
  const cart = useCart()

  return (
    <div>
      <span>{cart.items.length} items — ${cart.total()}</span>
      <button onClick={() => cart.addItem({ id: 1, name: 'Widget', price: 9.99, quantity: 1 })}>
        Add to Cart
      </button>
      <ul>
        {cart.items.map((item) => (
          <li key={item.id}>{item.name} x{item.quantity} — ${item.price}</li>
        ))}
      </ul>
    </div>
  )
}

// ── Negative tests: zustand catches every mistake ──

// @ts-expect-error — wrong type: items should be CartItem[], not string
const bad1 = create<Cart>(() => ({ items: 'not an array', addItem: () => { }, removeItem: () => { }, total: () => 0 }))

// The remaining negative tests call useCart() which invokes React hooks.
// They must live inside a function body to avoid the "invalid hook call"
// error at runtime (hooks require a React component/render context).
function _negativeTests() {
  const cart = useCart()

  // Writes
  // @ts-expect-error — wrong item shape: missing required fields
  cart.addItem({ broken: true })
  // @ts-expect-error — wrong arg type: number instead of CartItem
  cart.removeItem(42)

  // Reads
  // @ts-expect-error — typo: 'item' doesn't exist, it's 'items'
  const bad3 = cart.item
  // @ts-expect-error — nonexistent path
  const bad4 = cart.tax
}

// All caught at compile time. Rip's typed stash catches the same
// errors — the :: annotation flows through to the .d.ts.
