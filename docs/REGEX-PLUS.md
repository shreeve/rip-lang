<p><img src="rip.svg" alt="Rip Logo" width="100"></p>

# Rip Regex+ Features

**Ruby-Inspired Regex Matching with Automatic Capture**

Rip extends CoffeeScript with two powerful regex features inspired by Ruby: the **`=~` match operator** and **regex indexing**. Both features automatically manage match results in a global `_` variable, enabling elegant pattern matching and data extraction.

---

## Feature 1: `=~` Match Operator

### Syntax

```rip
text =~ /pattern/
```

### Behavior

- Executes: `(_ = toSearchable(text).match(/pattern/))`
- Stores match result in `_` variable (accessible immediately)
- Returns: the match result (truthy) or `null`
- Auto-injects: `toSearchable()` helper and `_` variable

### Examples

**Basic matching:**
```rip
text = "hello world"
if text =~ /world/
  console.log("Found:", _[0])  # "world"
```

**Capture groups:**
```rip
email = "user@example.com"
if email =~ /(.+)@(.+)/
  username = _[1]  # "user"
  domain = _[2]    # "example.com"
```

**Email domain extraction:**
```rip
email =~ /@(.+)$/
domain = _[1]  # Use capture immediately
```

**Phone number parsing:**
```rip
phone = "2125551234"
if phone =~ /^([2-9]\d\d)([2-9]\d\d)(\d{4})$/
  formatted = "(#{_[1]}) #{_[2]}-#{_[3]}"
  # Result: "(212) 555-1234"
```

---

## Feature 2: Regex Indexing

### Syntax

```rip
value[/pattern/]      # Returns full match (capture 0)
value[/pattern/, n]   # Returns capture group n
```

### Behavior

- Executes: `(_ = toSearchable(value).match(/pattern/)) && _[index]`
- Stores match in `_` for further use
- Returns: matched string or `null`
- Default index: `0` (full match)

### Examples

**Simple match:**
```rip
"steve"[/eve/]           # Returns "eve"
```

**Capture group:**
```rip
"steve"[/e(v)e/, 1]      # Returns "v"
```

**Email domain:**
```rip
domain = "user@example.com"[/@(.+)$/, 1]
# Returns: "example.com"
```

**URL parsing:**
```rip
url = "https://example.com/path"
hostname = url[/\/\/([\w.]+)/, 1]  # Returns "example.com"
```

**Multiple captures:**
```rip
text = "hello world"
first = text[/(\w+) (\w+)/, 1]   # "hello"
second = text[/(\w+) (\w+)/, 2]  # "world"
```

---

## Combined Usage

The real power comes from using both features together:

```rip
# Parse, validate, and format in clean steps
email = "Admin@Company.COM"
if email =~ /^([^@]+)@([^@]+)$/i
  username = _[1].toLowerCase()   # "admin"
  domain = _[2].toLowerCase()     # "company.com"
  "#{username}@#{domain}"         # Normalized email
```

```rip
# Chain regex operations
url = "https://api.example.com/v1/users"
if url =~ /\/\/([^\/]+)/
  host = _[1]                     # "api.example.com"
  subdomain = host[/^(\w+)\./, 1] # "api"
```

---

## Elegant Validator Pattern

One of the most powerful use cases is building validators:

```rip
validators =
  # Extract and validate in one expression
  id:       (v) -> v[/^([1-9]\d{0,19})$/] and parseInt(_[1])
  email:    (v) -> v[/^([^@]+)@([^@]+\.[a-z]{2,})$/i] and _[0]
  zip:      (v) -> v[/^(\d{5})/] and _[1]
  phone:    (v) -> v[/^(\d{10})$/] and formatPhone(_[1])

  # Normalize formats
  ssn:      (v) -> v[/^(\d{3})-?(\d{2})-?(\d{4})$/] and "#{_[1]}#{_[2]}#{_[3]}"
  zipplus4: (v) -> v[/^(\d{5})-?(\d{4})$/] and "#{_[1]}-#{_[2]}"

  # Boolean validators with =~
  truthy:   (v) -> (v =~ /^(true|t|1|yes|y|on)$/i) and true
  falsy:    (v) -> (v =~ /^(false|f|0|no|n|off)$/i) and true
  bool:     (v) -> (v =~ /^(true|t|1|yes|y|on|false|f|0|no|n|off)$/i) and
                   (v =~ /^(true|t|1|yes|y|on)$/i)
```

**Each validator:**
- Validates format
- Extracts/transforms data
- Returns normalized value or falsy
- **All in one line!**

---

## The `toSearchable()` Helper

Both features use a universal type coercion function for safety and flexibility:

### Type Handling

| Input Type | Conversion | Example |
|------------|-----------|---------|
| `string` | Returns as-is* | `"hello"` → `"hello"` |
| `null`/`undefined` | `""` | `null` → `""` |
| `number` | `String()` | `123` → `"123"` |
| `boolean` | `String()` | `true` → `"true"` |
| `bigint` | `String()` | `123n` → `"123"` |
| `symbol` | `.description` | `Symbol('x')` → `"x"` |
| `Array` | `.join(',')` | `[1,2,3]` → `"1,2,3"` |
| `Uint8Array` | Decode UTF-8 | Binary → text |
| `ArrayBuffer` | Decode UTF-8 | Binary → text |
| Custom `toString()` | Call it | Works with objects |

**Security:** By default, rejects strings with `\n` or `\r` (injection protection)
**Override:** Regex with `/m` flag automatically passes `allowNewlines: true`

### Examples

```rip
# Works with numbers
123 =~ /\d{3}/              # Matches!
num = 456[/(\d)(\d)/, 2]    # Returns "5"

# Works with nulls
x = null
x =~ /test/                 # Returns null (empty string doesn't match)

# Works with arrays
arr = ['foo', 'bar']
arr =~ /foo/                # Matches "foo,bar"

# Multiline with /m flag
text = "line1\nline2"
text =~ /line2/m            # Allows newlines automatically!
```

---

## Why This is Powerful

### 1. Eliminates Boilerplate

**JavaScript:**
```javascript
const match = email.match(/(.+)@(.+)/);
const domain = match ? match[2] : null;
```

**Rip:**
```rip
domain = email[/@(.+)$/, 1]
```

**Result:** 3 lines → 1 line

### 2. Enables Chaining

```rip
# Extract, validate, transform - all clean
url =~ /\/\/([^\/]+)/
host = _[1]
subdomain = host[/^(\w+)\./, 1]
```

No intermediate variables for match results!

### 3. Perfect for Validation

```rip
# One-line validators that extract AND validate
validate = (v) -> v[/^(\d{5})$/] and _[1]
```

Cleaner than any validation library!

### 4. Type-Safe

```rip
# Handles any input safely
123[/\d+/]           # Works (converts to "123")
null[/test/]         # Returns null (safe)
['a','b'][/a/]       # Works (joins to "a,b")
```

No type checking needed!

---

## Comparison to Other Languages

### Ruby
```ruby
email =~ /(.+)@(.+)/
domain = $2  # Uses $1, $2, etc.
```

### Perl
```perl
$email =~ /(.+)@(.+)/;
$domain = $2;  # Uses $1, $2, etc.
```

### JavaScript (Standard)
```javascript
const match = email.match(/(.+)@(.+)/);
const domain = match ? match[2] : null;
```

### Rip
```rip
email =~ /(.+)@(.+)/
domain = _[2]  # Clean, simple, one variable
```

**Rip combines:**
- Ruby's elegance (`=~`)
- JavaScript's familiarity (`[]` syntax)
- Better naming (`_` instead of `$1, $2, $3`)
- Type safety (toSearchable)

---

## Security Features

### Injection Protection

By default, **rejects strings with newlines**:

```rip
# Safe - rejects malicious input
userInput = "test\nmalicious"
userInput =~ /^test$/   # Returns null! (newline detected)

# Explicit multiline when needed
text = "line1\nline2"
text =~ /line2/m        # Works! (/m flag allows newlines)
```

This prevents common regex injection attacks where attackers use `\n` to break out of patterns.

### Override

Use `/m` flag when you explicitly need multiline matching:

```rip
text =~ /pattern/m  # Passes allowNewlines: true to toSearchable
```

---

## Implementation Details

### Grammar

```coffeescript
RegexWithIndex: [
  o 'Regex , Expression', '["regex-index", 1, 3]'     # With capture
  o 'Regex'             , '["regex-index", 1, null]'  # Without
]
```

### Codegen

**=~ operator:**
```javascript
case '=~':
  this.helpers.add('toSearchable');
  this.programVars.add('_');
  return `(_ = toSearchable(${left}${allowNewlines}).match(${right}))`;
```

**Regex indexing:**
```javascript
case 'regex-index':
  this.helpers.add('toSearchable');
  this.programVars.add('_');
  const index = captureIndex !== null ? captureIndex : '0';
  return `(_ = toSearchable(${value}${allowNewlines}).match(${regex})) && _[${index}]`;
```

### Helper Function

The `toSearchable()` helper handles universal type coercion:
- Strings → validated for newlines
- Primitives → converted to strings
- Nulls → empty string
- Arrays → joined
- Binary data → decoded
- Custom objects → toString()

---

## Use Cases

### 1. Data Validation

```rip
isValidEmail = (email) ->
  email[/^[^@]+@[^@]+\.[a-z]{2,}$/i]

isValidPhone = (phone) ->
  phone =~ /^\d{10}$/ and true
```

### 2. Data Extraction

```rip
extractDomain = (email) -> email[/@(.+)$/, 1]
extractUsername = (email) -> email[/^(.+)@/, 1]
extractArea = (phone) -> phone[/^(\d{3})/, 1]
```

### 3. Data Normalization

```rip
normalizeSSN = (ssn) ->
  ssn[/^(\d{3})-?(\d{2})-?(\d{4})$/] and "#{_[1]}-#{_[2]}-#{_[3]}"

normalizeZip = (zip) ->
  zip[/^(\d{5})-?(\d{4})?$/] and if _[2] then "#{_[1]}-#{_[2]}" else _[1]
```

### 4. Conditional Logic

```rip
if url =~ /^https:\/\/([^\/]+)/
  hostname = _[1]
  console.log "Secure site:", hostname
else
  console.log "Not HTTPS"
```

---

## Testing

Comprehensive test suite: `test/rip/05-extras/regex-features.rip`

**35 tests covering:**
- Basic matching and captures (13 tests)
- Regex indexing forms (12 tests)
- Combined usage patterns (3 tests)
- Real-world validators (5 tests)
- Edge cases (2 tests)

**All 35 tests passing!** ✅

---

## Summary

**Rip's regex features are a MAJOR innovation:**

✅ **Concise** - Reduce 3-5 lines to 1
✅ **Elegant** - Ruby-inspired syntax
✅ **Powerful** - Enables validator patterns
✅ **Safe** - Built-in injection protection
✅ **Universal** - Works with any type
✅ **Composable** - Use in expressions
✅ **Well-tested** - 35 comprehensive tests

**These features make Rip uniquely productive for:**
- Form validation
- Data parsing
- Text extraction
- Pattern matching
- Data normalization

**CoffeeScript doesn't have this. JavaScript requires verbose code. Rip makes it elegant.** 🎨

---

**See Also:**
- [AGENT.md](AGENT.md) - AI developer guide
- [README.md](README.md) - User guide
- Test examples: `test/rip/05-extras/regex-features.rip`
