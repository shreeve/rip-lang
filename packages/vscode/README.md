# Rip Language Support

Syntax highlighting and editor integration for [Rip](https://github.com/shreeve/rip-lang), a modern reactive language that compiles to JavaScript.

## Features

- Full syntax highlighting for `.rip` files
- Comment toggling (`#` line, `###` block)
- Bracket matching and auto-closing
- Indentation-based code folding
- Type annotation highlighting (`::`, `::=`)
- Reactive operator highlighting (`:=`, `~=`, `~>`)

## Rip at a Glance

```coffee
# Types (optional, emit .d.ts)
def greet(name:: string):: string
  "Hello, #{name}!"

User ::= type
  id: number
  name: string

# Reactivity (language-level operators)
count := 0
doubled ~= count * 2
~> console.log doubled

# Modern syntax
data = fetchUsers!                  # Dammit operator (call + await)
squares = (x * x for x in [1..10]) # Comprehensions
str =~ /Hello, (\w+)/              # Regex match
```

## Requirements

No additional dependencies required. This extension provides syntax highlighting out of the box.

## Links

- [Rip Language](https://github.com/shreeve/rip-lang)
- [Rip Types Documentation](https://github.com/shreeve/rip-lang/blob/main/docs/RIP-TYPES.md)
