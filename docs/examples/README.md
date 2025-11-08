# Rip Examples

This directory contains practical examples demonstrating Rip's features.

## Core Examples

### [fibonacci.rip](fibonacci.rip)
Classic recursive Fibonacci implementation showing:
- Function definitions with `def`
- Implicit returns
- Conditional expressions
- No semicolons needed

### [arrows.rip](arrows.rip)
Comprehensive arrow function examples:
- Fat arrows (`=>`) with bound `this`
- Thin arrows (`->`) with dynamic `this`
- Implicit object returns
- Arrow functions as callbacks
- Method shorthand in objects

### [async-await.rip](async-await.rip)
Modern async patterns:
- Auto-detected `async` functions
- Await expressions
- Dammit operator (`!`) for call-and-await
- Async error handling

## Language Features

### [existential.rip](existential.rip)
Comprehensive guide to optional/nullish operators:
- Nullish coalescing (`??`) vs logical OR (`||`)
- Existential assignment (`?=` and `??=`)
- Logical assignment (`||=` and `&&=`)
- Real-world examples with detailed comparisons

### [ranges.rip](ranges.rip)
Range operators and optimizations:
- Inclusive ranges (`..`)
- Exclusive ranges (`...`)
- Range-based loops (optimized to traditional for-loops)
- Reverse iteration

### [switch.rip](switch.rip)
Switch statements and pattern matching:
- Value-based switches
- Condition-based switches (if-else chains)
- Fall-through behavior
- Context-aware compilation (IIFE in expressions)

### [ternary.rip](ternary.rip)
Ternary operator (JavaScript-style):
- Both `? :` and `if-then-else` syntax
- Nested ternaries
- Comparison with if-expressions

## Advanced Features

### [object-syntax.rip](object-syntax.rip)
Object literal features:
- Property shorthand (`{x, y}`)
- Implicit braces for single-line objects
- Computed properties
- Nested objects
- Methods in objects

### [prototype.rip](prototype.rip)
Prototype access shortcuts:
- Prototype access (`::`)
- Optional prototype access (`?::`)
- Adding methods to prototypes
- Prototype method calls

## ES6 Modules

### [module.rip](module.rip)
ES6 import/export patterns:
- Named imports/exports
- Default exports
- Re-exporting
- Dynamic imports

### [utils.rip](utils.rip)
Simple utility module (pairs with module.rip):
- Function exports
- Object exports
- Mixed exports

## Running Examples

**Easiest way - Direct execution with Bun:**

```bash
# Just run it! (thanks to bunfig.toml + rip-loader.js)
bun www/examples/fibonacci.rip

# Import and use modules
bun www/examples/module.rip
```

**Other options:**

```bash
# Compile to JavaScript
./bin/rip www/examples/fibonacci.rip

# See s-expressions
./bin/rip -s www/examples/fibonacci.rip

# Compile to file
./bin/rip -o output.js www/examples/fibonacci.rip

# Try in the REPL
./bin/rip
```

## Browser Usage

All examples work in the browser! See [BROWSER.md](../../docs/BROWSER.md) for details.

```html
<!-- Load Rip compiler -->
<script src="dist/rip.browser.js"></script>

<!-- Write Rip code inline -->
<script type="text/rip">
  def greet(name)
    console.log "Hello, ${name}!"

  greet("World")
</script>
```

## Example Organization

**Removed examples (redundant):**
- ~~features.rip~~ → Covered in main README
- ~~auto-hoist.rip~~ → Feature shown in other examples
- ~~math.rip~~ → Too simple, see fibonacci.rip and utils.rip
- ~~implicit-arrows.rip~~ → Merged into arrows.rip

**Kept examples focus on:**
- Unique language features
- Real-world patterns
- Feature comparisons
- Practical use cases

---

**See also:**
- [README.md](../../README.md) - Main documentation
- [AGENT.md](../../AGENT.md) - Developer guide
- [docs/](../../docs/) - Complete documentation library
