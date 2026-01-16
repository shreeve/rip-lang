<p><img src="rip.svg" alt="Rip Logo" width="100"></p>

# Rip in the Browser

**Complete Language + Reactive Framework in 51KB**

Rip compiles to modern JavaScript and runs beautifully in the browser. With brotli compression, the entire package—compiler, reactive runtime, template engine, and component system—fits in just **51KB**. That's a complete framework in less space than most utility libraries!

---

## 📦 Build Sizes

```
rip.browser.js         587 KB  (readable, for debugging)
rip.browser.min.js     367 KB  (minified, 37% smaller)
rip.browser.min.js.br   51 KB  (brotli, 91% smaller!)
```

**What's in that 51KB?**
- Complete compiler (lexer, parser, code generator)
- Reactive runtime (signals, derived values, effects)
- Template engine (S-expression syntax, dynamic classes)
- Component system (props, lifecycle, fine-grained updates)
- Zero dependencies

**For comparison:**
- React (min+gzip): ~42KB (just the library, no compiler)
- Vue (min+gzip): ~34KB (just the library, no compiler)
- Svelte: ~2KB runtime (but requires build step + compiler)
- **Rip: 51KB (complete language + framework, runs anywhere!)**

---

## 🚀 Quick Start

### Build the Browser Bundle

```bash
bun run build:browser
```

This creates all three versions automatically.

### Serve Locally

```bash
bun run serve
```

Then open: `http://localhost:3000/`

The server automatically serves `.br` files with brotli encoding to supporting browsers!

---

## 🎮 Triple REPL Support

**Rip gives you THREE ways to code interactively!**

### 1. Terminal REPL

Full-featured command-line REPL with persistent history:

```bash
# Just run rip with no arguments
./bin/rip

# Or explicitly request REPL
./bin/rip -r
```

**Features:**
- ✅ Variable persistence across evaluations
- ✅ Multi-line input (automatic detection)
- ✅ Command history with arrow keys (saved to `~/.rip_history`)
- ✅ Special commands (.help, .vars, .clear, .history, .exit)
- ✅ Debug toggles (.tokens, .sexp, .js)
- ✅ Pretty printing with colors
- ✅ `_` variable stores last result

**Example Session:**
```
Rip 1.0.0 - Interactive REPL
Type .help for commands, Ctrl+C to exit

rip> x = 10
→ 10

rip> y = x + 5
→ 15

rip> console.log "x is #{x}, y is #{y}"
x is 10, y is 15
→ undefined

rip> # Test heregex
rip> pattern = ///
....>   \d+      # digits
....>   [a-z]+   # letters
....> ///
→ /\d+[a-z]+/

rip> pattern.test('123abc')
→ true

rip> .vars
Defined variables:
  x = 10
  y = 15
  pattern = /\d+[a-z]+/
  _ = true

rip> .exit
Goodbye!
```

### 2. Browser REPL

**The Ultimate Rip Experience in Your Browser!**

```bash
# Build and serve
bun run build:browser
bun run serve

# Open in browser
http://localhost:3000/
# (auto-redirects to REPL)
```

Visit `docs/repl.html` for a full-featured browser REPL with **two powerful tabs:**

#### Tab 1: REPL Console

Terminal-like interactive environment:

```
rip> x = 42
→ 42

rip> pattern = ///
....>   \d+      # digits
....>   [a-z]+   # letters
....> ///
→ /\d+[a-z]+/

rip> "user@example.com"[/@(.+)$/, 1]
→ "example.com"

rip> .vars
Variables:
  x = 42
  pattern = /\d+[a-z]+/
  _ = "example.com"
```

**Features:**
- ✅ Multi-line input (automatic detection)
- ✅ Command history (↑↓ arrow keys)
- ✅ Special commands (.help, .vars, .sexp, .tokens, .clear)
- ✅ Variable persistence across evaluations
- ✅ `_` variable for last result
- ✅ Colored output (prompts, results, errors)
- ✅ Auto-scrolling

#### Tab 2: Live Compiler

Split-pane editor showing real-time compilation:

**Left Pane (Rip):**
```rip
def fibonacci(n)
  if n <= 1
    n
  else
    fibonacci(n - 1) + fibonacci(n - 2)

pattern = ///
  ^ \d+      # starts with digits
  \s*        # optional space
  [a-z]+     # followed by letters
  $
///i
```

**Right Pane (JavaScript - updates as you type!):**
```javascript
function fibonacci(n) {
  if ((n <= 1)) {
    return n;
  } else {
    return (fibonacci((n - 1)) + fibonacci((n - 2)));
  }
}

let pattern;

pattern = /^\d+\s*[a-z]+$/i;
```

**Features:**
- ✅ Live compilation (instant feedback)
- ✅ Toggle s-expression display
- ✅ Toggle token display
- ✅ Syntax highlighting
- ✅ Beautiful dark theme
- ✅ All Rip features work

### 3. Console REPL

**Quick tests in any browser console!**

The browser bundle exports a global `rip()` function:

```javascript
// In browser console (F12) - after loading Rip
rip('x = 42')              // → 42
rip('x + 10')              // → 52
rip('"test"[/e(s)t/, 1]')  // → "s"
rip('_')                   // → "s" (last result)
```

**Features:**
- ✅ Global `rip()` function
- ✅ Variable persistence (stored as globals)
- ✅ `_` variable for last result
- ✅ Perfect for quick experiments

---

## 💡 Usage Patterns

### Pattern 1: Inline Rip Execution

Write Rip directly in your HTML - it executes automatically:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Rip App</title>
</head>
<body>
  <h1>Hello from Rip!</h1>
  <div id="output"></div>

  <!-- Write Rip code directly! -->
  <script type="text/rip">
    # Define functions in Rip
    def greet(name)
      "Hello, #{name}! 👋"

    # Use heregex for readable patterns
    emailPattern = ///
      ^([^@]+)    # username
      @           # at sign
      ([^@]+)     # domain
      $
    ///

    # Ruby-style regex matching
    email = "user@example.com"
    if email =~ emailPattern
      username = _[1]
      domain = _[2]
      document.getElementById('output').textContent =
        "User: #{username}, Domain: #{domain}"
  </script>

  <!-- Load Rip compiler (must come after Rip scripts) -->
  <script type="module" src="https://your-cdn.com/rip.browser.min.js"></script>
</body>
</html>
```

**The Rip code runs automatically when the page loads!**

### Pattern 2: Interactive Compiler

Use Rip to compile code on-demand in the browser:

```html
<script type="module">
  import { compile } from './dist/rip.browser.min.js';

  const ripCode = `
    def fibonacci(n)
      if n <= 1
        n
      else
        fibonacci(n - 1) + fibonacci(n - 2)
  `;

  const result = compile(ripCode);
  console.log(result.code);  // Generated JavaScript

  // Execute it
  eval(result.code);
  console.log(fibonacci(10));  // 55
</script>
```

### Pattern 3: Dynamic Code Generation

Build tools, playgrounds, or educational apps:

```html
<script type="module">
  import { compile } from './dist/rip.browser.min.js';

  // Live code editor
  document.getElementById('compile-btn').addEventListener('click', () => {
    const source = document.getElementById('editor').value;

    try {
      const { code, sexpr, tokens } = compile(source);

      document.getElementById('js-output').textContent = code;
      document.getElementById('sexp-output').textContent =
        JSON.stringify(sexpr, null, 2);

      // Show tokens for learning
      document.getElementById('tokens-output').textContent =
        tokens.map(t => `${t[0]}: ${t[1]}`).join('\n');

    } catch (error) {
      document.getElementById('error').textContent = error.message;
    }
  });
</script>
```

---

## 🎨 What Works in the Browser

### All Rip Features Available

**✅ Modern Syntax:**
```rip
# Destructuring
{name, age} = person
[first, ...rest] = array

# Optional chaining (dual syntax)
user?.profile?.name
arr?[0]

# Nullish coalescing
port = config.port ?? 8080

# Heregex
pattern = ///
  ^ \d+      # starts with digits
  \s*        # whitespace
  [a-z]+     # letters
  $
///gi
```

**✅ Ruby-Style Regex:**
```rip
# Match operator
email =~ /(.+)@(.+)/
domain = _[2]

# Regex indexing
zip = "12345-6789"[/^(\d{5})/, 1]  # "12345"
```

**✅ Functions:**
```rip
# Three styles
def add(a, b)         # Hoisted
  a + b

multiply = (a, b) ->  # Unbound this
  a * b

divide = (a, b) =>    # Bound this
  a / b
```

**✅ Classes:**
```rip
class Person
  constructor: (@name, @age) ->

  greet: ->
    "Hi, I'm #{@name}!"
```

**✅ Async/Await:**
```rip
# Auto-detected!
fetchData = ->
  response = await fetch(url)
  await response.json()

# Or use dammit operator
getData = ->
  result = fetchData!
  result
```

**✅ String Interpolation:**
```rip
name = "World"
message = "Hello, #{name}!"

# Heredocs
text = """
  Multi-line
  strings
  """
```

---

## 🌐 CDN Deployment

### Recommended Setup

**1. Build for production:**
```bash
bun run build:browser
```

**2. Upload to CDN:**
```bash
# Upload all three versions
aws s3 cp docs/dist/rip.browser.js s3://your-bucket/
aws s3 cp docs/dist/rip.browser.min.js s3://your-bucket/
aws s3 cp docs/dist/rip.browser.min.js.br s3://your-bucket/
```

**3. Configure CDN headers:**
```nginx
# For .br files
location ~ \.js\.br$ {
  add_header Content-Encoding br;
  add_header Content-Type application/javascript;
  add_header Cache-Control "public, max-age=31536000";
}

# For regular .js files
location ~ \.js$ {
  add_header Content-Type application/javascript;
  add_header Cache-Control "public, max-age=31536000";
}
```

**4. Use in HTML:**
```html
<!-- Browsers with brotli support get 51KB version automatically -->
<script type="module" src="https://cdn.example.com/rip.browser.min.js"></script>
```

---

## 📊 Performance

### Bundle Size Breakdown

| Version | Size | Reduction | Use Case |
|---------|------|-----------|----------|
| **rip.browser.js** | 587 KB | - | Development, debugging |
| **rip.browser.min.js** | 367 KB | 37% | Production without brotli |
| **rip.browser.min.js.br** | 51 KB | **91%** | Production with brotli ✨ |

### Load Times

**On 3G connection (750 Kbps):**
- Unminified: ~6.5 seconds
- Minified: ~4.3 seconds
- **Brotli: ~0.47 seconds** ⚡

**On Cable (5 Mbps):**
- Unminified: ~1 second
- Minified: ~640ms
- **Brotli: ~70ms** 🚀

**Brotli support:** ~95% of browsers (all modern browsers)

---

## 🎯 Use Cases

### 1. Interactive Playgrounds

Build Rip learning environments:
```html
<textarea id="editor">def greet(name)
  "Hello, #{name}!"</textarea>
<button id="run">Run</button>
<pre id="output"></pre>

<script type="module">
  import { compile } from './rip.browser.min.js';

  document.getElementById('run').onclick = () => {
    const code = compile(editor.value).code;
    output.textContent = eval(code);
  };
</script>
```

### 2. Client-Side Templating

Use Rip for dynamic content generation:
```html
<script type="text/rip">
  # Data from API
  users = await fetch('/api/users').then(r -> r.json())

  # Generate HTML with comprehensions
  html = ("""
    <div class="user">
      <h3>#{user.name}</h3>
      <p>#{user.email}</p>
    </div>
    """ for user in users).join('')

  document.getElementById('users').innerHTML = html
</script>
```

### 3. Form Validation

Elegant validators in the browser:
```html
<script type="text/rip">
  validators =
    email: (v) -> v[/^[^@]+@[^@]+\.[a-z]{2,}$/i] and _[0]
    phone: (v) -> v[/^(\d{10})$/] and _[1]
    zip: (v) -> v[/^(\d{5})(-\d{4})?$/, 1] and _[1]

  def validate(field, value)
    validator = validators[field]
    if validator
      result = validator(value)
      if result
        {valid: true, normalized: result}
      else
        {valid: false, error: "Invalid #{field}"}
    else
      {valid: true, normalized: value}
</script>
```

### 4. Dynamic Dashboards

Real-time data processing with clean syntax:
```html
<script type="text/rip">
  # WebSocket connection
  ws = new WebSocket('ws://localhost:8080')

  ws.onmessage = (event) ->
    data = JSON.parse(event.data)

    # Extract with regex
    if data.message =~ /ERROR: (.+)/
      showAlert(_[1])
    else if data.message =~ /SUCCESS: (.+)/
      showSuccess(_[1])

    # Update UI
    updateDashboard(data)
</script>
```

---

## 🔒 Security Considerations

### Safe Regex Matching

The `toSearchable()` helper includes injection protection:

```rip
# Safe by default - rejects newlines
userInput =~ /^[a-z]+$/  # Returns null if input has \n

# Explicit multiline when needed
text =~ /pattern/m       # Allows newlines with /m flag
```

### Sandboxed Execution

Browser environment is naturally sandboxed:
- No file system access
- No process execution
- Same-origin policy applies

---

## 📚 REPL Examples

### Basic Operations

```
rip> x = 42
→ 42

rip> doubled = x * 2
→ 84

rip> [1..5]
→ [1, 2, 3, 4, 5]
```

### Heregex

```
rip> pattern = ///
....>   ^ \d+      # starts with digits
....>   \s*        # optional whitespace
....>   [a-z]+     # followed by letters
....>   $          # end of string
....> ///gi
→ /^\d+\s*[a-z]+$/gi

rip> pattern.test('123abc')
→ true
```

### Ruby-Style Regex

```
rip> email = "user@example.com"
→ "user@example.com"

rip> email =~ /(.+)@(.+)/
→ ["user@example.com", "user", "example.com"]

rip> username = _[1]
→ "user"

rip> domain = _[2]
→ "example.com"

rip> # Inline extraction
rip> "12345-6789"[/^(\d{5})/, 1]
→ "12345"
```

### Functions and Classes

```
rip> def factorial(n)
....>   if n <= 1
....>     1
....>   else
....>     n * factorial(n - 1)
→ [Function: factorial]

rip> factorial(5)
→ 120

rip> class Point
....>   constructor: (@x, @y) ->
....>   distance: ->
....>     Math.sqrt(@x**2 + @y**2)
→ [class Point]

rip> p = new Point(3, 4)
→ Point { x: 3, y: 4 }

rip> p.distance()
→ 5
```

### REPL Commands

```
rip> .help
Rip REPL Commands:

Special Commands:
  .help          Show this help message
  .clear         Clear the context (reset all variables)
  .vars          Show all defined variables
  .history       Show command history
  .exit          Exit the REPL (or Ctrl+C)

Debug Toggles:
  .tokens        Toggle token stream display
  .sexp          Toggle s-expression display
  .js            Toggle compiled JavaScript display

Tips:
  - Multi-line input is supported (press Enter mid-expression)
  - Use Tab for history navigation
  - Previous results stored in _ variable
  - Use Ctrl+C to cancel multi-line input or exit
```

---

## 🔧 API Reference

### compile(source, options)

```javascript
import { compile } from './rip.browser.min.js';

const result = compile('x = 42');

// Returns:
{
  tokens: [[...], ...],  // Lexer tokens
  sexpr: [...],          // S-expressions
  code: "let x;\n\nx = 42;",  // JavaScript
  data: null             // __DATA__ section if present
}
```

### compileToJS(source, options)

```javascript
import { compileToJS } from './rip.browser.min.js';

const js = compileToJS('def add(a, b)\n  a + b');
// Returns: "function add(a, b) { return (a + b); }"
```

### Auto-Execution

Just load the script - it automatically finds and compiles all `<script type="text/rip">` tags:

```html
<script type="text/rip">
  console.log "This runs automatically!"
</script>

<script type="module" src="./rip.browser.min.js"></script>
```

### rip() Function (Console REPL)

```javascript
// Globally available after loading browser bundle
rip('x = 42')         // Returns 42, stores in global x
rip('x * 2')          // Returns 84
rip('[1..10]')        // Returns [1, 2, 3, ..., 10]
```

---

## 🎨 Advanced Examples

### Real-Time Data Processing

```html
<script type="text/rip">
  # Parse server logs with regex
  def parseLog(line)
    if line =~ /\[(\w+)\] (.+?) - (.+)$/
      level: _[1]
      timestamp: _[2]
      message: _[3]
    else
      null

  # Process stream
  ws = new WebSocket('ws://localhost:8080/logs')
  ws.onmessage = (event) ->
    parsed = parseLog(event.data)
    if parsed?.level is 'ERROR'
      showAlert(parsed.message)
</script>
```

### Form Validation

```html
<script type="text/rip">
  validators =
    email: (v) ->
      v[/^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/] and _[0]

    phone: (v) ->
      if v =~ /^(\d{3})(\d{3})(\d{4})$/
        "(#{_[1]}) #{_[2]}-#{_[3]}"
      else
        null

    zip: (v) ->
      v[/^(\d{5})(-\d{4})?$/] and _[1] + (if _[2] then _[2] else "")

  def validateForm(form)
    errors = []

    for field in ['email', 'phone', 'zip']
      value = form[field]
      validator = validators[field]
      unless validator(value)
        errors.push "Invalid #{field}"

    if errors.length is 0
      {valid: true}
    else
      {valid: false, errors: errors}
</script>
```

### Data Transformation

```html
<script type="text/rip">
  # Transform API response
  def normalizeUsers(users)
    for user in users
      # Extract name parts
      fullName = user.name
      if fullName =~ /^(\w+)\s+(\w+)$/
        firstName: _[1]
        lastName: _[2]
      else
        firstName: fullName
        lastName: ""

      # Normalize email
      email: user.email.toLowerCase()

      # Format phone
      phone: if user.phone =~ /(\d{10})/
        "(#{_[1][0..2]}) #{_[1][3..5]}-#{_[1][6..9]}"
      else
        user.phone
</script>
```

---

## 🚀 Performance Tips

### 1. Use Brotli

Always use `.min.js.br` with proper Content-Encoding:
```nginx
Content-Encoding: br
Content-Type: application/javascript
```

**Saves 89% bandwidth!**

### 2. Cache Aggressively

The compiler is deterministic - same input = same output:
```nginx
Cache-Control: public, max-age=31536000, immutable
```

### 3. Precompile for Production

For best performance, precompile to JavaScript during build:
```bash
# Development: inline Rip (51KB framework overhead)
<script type="text/rip">...</script>

# Production: precompiled JavaScript (no compiler needed)
<script>... compiled JS ...</script>
```

Use browser builds for:
- Rapid prototyping
- Interactive tools
- Educational demos
- Dynamic code generation

---

## 📚 Examples

See the `docs/examples/` directory for working demos:

**index.html** - Landing page with REPL redirect

**repl.html** - Interactive REPL and Live Compiler
- REPL Console tab (terminal-like with commands and history)
- Live Compiler tab (resizable split panes)
- Beautiful canonical s-expression display
- Tokens, s-expressions, and JavaScript views
- All features working

**example.html** - Auto-executing Rip scripts
- Multiple `<script type="text/rip">` blocks
- Functions available globally
- Interactive buttons calling Rip functions
- Demonstrates inline script execution

---

## 🌟 Why Rip in the Browser?

**1. Incredible Value**
- 51KB delivers compiler + reactive runtime + templates + components
- More features than most frameworks, smaller than most libraries
- Fast loading even on mobile

**2. Complete Framework**
- Reactive primitives (signals, derived, effects)
- S-expression templates with fine-grained updates
- Component system with props and lifecycle
- Modern ES6+ output

**3. Zero Build Step**
- Write Rip directly in HTML
- Auto-compiles on page load
- Perfect for prototyping

**4. Developer Experience**
- Clean, expressive syntax
- Readable code
- Interactive debugging
- Three REPL modes!

**5. Production Ready**
- Well-tested (1046/1046 tests passing)
- ES6+ output
- Reliable compilation
- Self-hosting compiler

---

## 📦 Installation

### From CDN (Coming Soon)

```html
<script type="module" src="https://unpkg.com/rip-lang/dist/rip.browser.min.js"></script>
```

### Self-Hosted

```html
<script type="module" src="/path/to/rip.browser.min.js"></script>
```

### NPM Package

```bash
npm install rip-lang
```

Then serve `node_modules/rip-lang/dist/rip.browser.min.js`

---

## 📖 Documentation

**Learn More:**
- [README.md](../README-ORIG.md) - Getting started
- [AGENT.md](../AGENT-ORIG.md) - AI developer guide
- [REGEX-PLUS.md](REGEX-PLUS.md) - Regex features guide
- [COMPREHENSIONS.md](COMPREHENSIONS.md) - Context-aware comprehensions
- [DAMMIT-OPERATOR.md](DAMMIT-OPERATOR.md) - Async shorthand syntax

---

## 🎉 Summary

**Rip in the browser gives you:**

✅ **51KB** - Complete language + reactive framework (brotli)
✅ **Reactivity** - Signals, derived values, effects
✅ **Templates** - S-expression syntax, fine-grained DOM updates
✅ **Components** - Props, lifecycle, zero virtual DOM
✅ **Triple REPL** - Terminal, Browser, Console
✅ **Modern ES6+** - Output works everywhere
✅ **Zero build** - Write Rip directly in HTML
✅ **Auto-execution** - `<script type="text/rip">` just works

**Perfect for:**
- 🎓 Learning and education
- 🔬 Experimentation and prototyping
- 🛠️ Building reactive applications
- 📊 Dynamic dashboards
- ✅ Client-side validation
- 🎨 Creative coding

---

**A complete language and reactive framework in 51KB.** ✨

---

**See Also:**
- Examples: `docs/examples/` directory
- Server: `bun run serve`
- Build: `bun run build:browser`
