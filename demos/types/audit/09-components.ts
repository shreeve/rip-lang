// 09-components.ts — Typed component props
//
// Rip components have no direct TS equivalent. The closest analog
// is React-style typed props: define prop interfaces, write render
// functions that accept them, then get full type safety at the call
// site — exactly what Rip's @prop:: annotations achieve.

// ── Prop types (what Rip's .d.ts emits) ──

type ButtonProps = {
  variant?: 'primary' | 'secondary'
  loading?: boolean
  disabled?: boolean
  children?: string // slot content in Rip
}

type SelectProps = {
  options: string[]
  label?: string
  placeholder?: string
  value?: string
  error?: string
}

// ── Components as render functions (React-style) ──

function Button(props: ButtonProps = {}) {
  const { variant = 'primary', loading = false, disabled = false } = props
  return { variant, loading, disabled }
}

function Select(props: SelectProps) {
  const { options, label = '', placeholder = 'Select...', value = '', error = '' } = props
  return { options, label, placeholder, value, error }
}

// ── Parent renders children with type-safe props ──

function App(props: { title?: string } = {}) {
  const title = props.title ?? 'My App'
  const role = 'admin'
  let loading = false

  // Computed — mirrors `isAdmin ~= role is "admin"`
  const isAdmin = role === 'admin'

  // Method — mirrors `toggle: -> loading = not loading`
  const toggle = () => { loading = !loading }

  // Correct usage — TypeScript validates every prop
  const ok1 = Button({ variant: 'primary', loading, children: 'Save changes' })
  const ok2 = Button({ children: 'Cancel' })
  const ok3 = Select(isAdmin ? { options: ['a', 'b', 'c'], value: 'a' } : { options: [] })
  const ok4 = Select({ options: ['x', 'y'] })

  return { title, toggle, ok1, ok2, ok3, ok4 }
}

// ── Negative: wrong prop types must be caught ──

// @ts-expect-error — wrong variant literal
const badBtn = Button({ variant: 'danger' })
// @ts-expect-error — disabled expects boolean
const badBtn2 = Button({ disabled: 'yes' })
// @ts-expect-error — wrong type for options
const badSel = Select({ options: 123 })
