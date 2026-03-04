// 12-components.ts — Typed component props
//
// Rip's component system has no direct TypeScript equivalent.
// This file shows the closest structural approximation: typed
// prop interfaces that mirror what Rip's @prop:: annotations produce.

// In Rip: export Button = component with @variant:: 'primary' | 'secondary' := 'primary'
// The .d.ts that Rip emits is essentially a class with typed properties.

interface ButtonProps {
  variant: 'primary' | 'secondary'
  compact: boolean
  loading: boolean
  label: string
  notes: string
}

class Button {
  variant: 'primary' | 'secondary' = 'primary'
  compact: boolean = false
  loading: boolean = false
  readonly label: string = 'Click me'
  notes!: string
  disabled: boolean = false
}

interface SelectProps {
  options: string[]
  value: string
  error: string | boolean
}

class Select {
  readonly options: string[] = []
  value: string = ''
  error: string | boolean = false
}