<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Rip CSV - @rip-lang/csv

> **Fast, flexible CSV parser and writer — indexOf ratchet engine, auto-detection, zero dependencies**

A high-performance CSV library for Rip that uses the JavaScript engine's
SIMD-accelerated `indexOf` to skip over content in bulk. Auto-detects
delimiters, quoting, escaping, BOM, and line endings. Supports excel mode,
relax mode, headers, comments, streaming via row callback, and reusable
writer instances. ~300 lines of Rip, zero dependencies.

## Quick Start

```bash
bun add @rip-lang/csv
```

```coffee
import { CSV } from '@rip-lang/csv'

# Parse a string
rows = CSV.read "name,age\nAlice,30\nBob,25\n"
# [['name','age'], ['Alice','30'], ['Bob','25']]

# Parse with headers (returns objects)
users = CSV.read "name,age\nAlice,30\nBob,25\n", headers: true
# [{name: 'Alice', age: '30'}, {name: 'Bob', age: '25'}]

# Parse a file
data = CSV.load! 'data.csv'
data = CSV.load! 'data.csv', headers: true

# Write CSV
str = CSV.write [['a','b'], ['1','2']]
# "a,b\n1,2\n"

# Write to file
CSV.save! 'out.csv', rows
```

## How It Works

The parser uses an **indexOf ratchet** — a technique where the JavaScript
engine's native `indexOf` (backed by SIMD instructions in V8 and JSC) does
the heavy lifting. Instead of inspecting every character, the parser calls
`indexOf` to jump directly to the next delimiter, newline, or quote. Each
call can skip hundreds of bytes in a single native operation.

```
Source string:  "Alice,30,New York\nBob,25,Chicago\n..."
                 ↑     ↑  ↑         ↑
                 │     │  │         └── indexOf('\n') jumps here
                 │     │  └── indexOf(',') jumps here
                 │     └── indexOf(',') jumps here
                 └── start

Each indexOf call skips bulk content via SIMD — no per-byte scanning in JS.
```

The parser has two code paths, selected at startup by probing the first ~8KB:

- **Fast path** — no quotes detected: pure indexOf for separators and newlines
- **Full path** — quotes present: indexOf ratchet with quote/escape handling

## Reading

### Basic Parsing

```coffee
# Auto-detects delimiter, quoting, line endings
rows = CSV.read str

# Tab-separated, pipe-separated — auto-detected
rows = CSV.read "a\tb\tc\n1\t2\t3\n"
rows = CSV.read "a|b|c\n1|2|3\n"

# Explicit separator
rows = CSV.read str, sep: ';'
```

### Headers Mode

```coffee
# First row becomes object keys
users = CSV.read str, headers: true
# [{name: 'Alice', age: '30'}, ...]

console.log users[0].name  # "Alice"
```

### Row-by-Row Processing

```coffee
# Process rows one at a time without building an array
count = CSV.read str, each: (row, index) ->
  console.log "Row #{index}: #{row}"

# Early halt by returning false
CSV.read str, each: (row) ->
  if row[0] is 'STOP'
    return false
  process(row)
```

### File I/O

```coffee
# Read a file (async)
rows = CSV.load! 'data.csv'
rows = CSV.load! 'data.csv', headers: true, strip: true

# Row-by-row file processing
CSV.load! 'huge.csv', each: (row) -> db.insert!(row)
```

### Excel Mode

```coffee
# Handles ="01" literals (preserves leading zeros)
rows = CSV.read '="01",hello\n', excel: true
# [['01', 'hello']]
```

### Relax Mode

```coffee
# Recovers from stray/unmatched quotes instead of throwing
rows = CSV.read str, relax: true
```

## Writing

### Basic Writing

```coffee
str = CSV.write [['name','age'], ['Alice','30']]
# "name,age\nAlice,30\n"

# Write to file (async)
CSV.save! 'out.csv', rows
```

### Format a Single Row

```coffee
line = CSV.formatRow ['Alice', 'New York, NY', '30']
# 'Alice,"New York, NY",30'
```

### Reusable Writer

```coffee
w = CSV.writer(sep: '\t', excel: true)

for record in records
  line = w.row(record)
  stream.write "#{line}\n"

# Or format all at once
output = w.rows(records)
```

### Writer Modes

```coffee
# Compact (default): quote only when necessary
CSV.write rows, mode: 'compact'

# Full: quote every field
CSV.write rows, mode: 'full'

# Excel: emit ="0123" for leading-zero numbers
CSV.write rows, excel: true

# Drop trailing empty columns
CSV.write rows, drop: true
```

## Options Reference

### Reader Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sep` | string | auto | Field delimiter (`,` `\t` `\|` `;` or any string) |
| `quote` | string | `"` | Quote/enclosure character |
| `escape` | string | same as `quote` | Escape character (`"` for doubled, `\` for backslash) |
| `headers` | boolean | `false` | First row as keys — return objects |
| `excel` | boolean | `false` | Handle `="01"` literals |
| `relax` | boolean | `false` | Recover from stray quotes |
| `strip` | boolean | `false` | Trim whitespace from fields |
| `comments` | string | `null` | Skip lines starting with this character |
| `skipBlanks` | boolean | `true` | Skip blank lines |
| `row` | string | auto | Line ending override (`\n`, `\r\n`, `\r`) |
| `each` | function | `null` | `(row, index) ->` callback per row |

### Writer Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sep` | string | `','` | Field delimiter |
| `quote` | string | `'"'` | Quote character |
| `escape` | string | same as `quote` | Escape character |
| `mode` | string | `'compact'` | `'compact'` or `'full'` |
| `excel` | boolean | `false` | Emit `="0123"` for leading zeros |
| `drop` | boolean | `false` | Drop trailing empty columns |
| `rowsep` | string | `'\n'` | Row separator |

> **Note:** The writer defaults to doubled-quote escaping (`""`). Pass
> `escape: '\\'` for backslash style.

## Auto-Detection

When you call `CSV.read(str)` with no options, the probe function scans the
first ~8KB to automatically detect:

- **BOM** — strips UTF-8 BOM if present
- **`sep=` header** — Excel convention for declaring delimiter
- **Delimiter** — tries `,` `\t` `|` `;`, picks the most frequent
- **Quote character** — detects if `"` appears in the sample
- **Escape style** — `\"` (backslash) vs `""` (doubled quote)
- **Line endings** — `\r\n`, `\n`, or `\r`

User options override any probed value.

## API Summary

```coffee
CSV.read(str, opts)            # parse string -> rows or objects
CSV.load!(path, opts)          # parse file (async)
CSV.write(rows, opts)          # format rows -> CSV string
CSV.save!(path, rows, opts)    # write to file (async)
CSV.writer(opts)               # create reusable Writer instance
CSV.formatRow(row, opts)       # format single row -> string
```

## Performance

The parser consistently delivers **300-430 MB/s** throughput on real-world
CSV files, scaling linearly from kilobytes to gigabytes:

| File | Size | Rows | Fields/row | Time | Throughput |
|------|------|------|-----------|------|-----------|
| Medical records | 10.5 MB | 43,962 | 44 | 39ms | 269 MB/s |
| Japanese postal codes | 10.9 MB | 124,565 | 15 | 26ms | 414 MB/s |
| Geodata | 24.8 MB | 662,061 | 6 | 65ms | 382 MB/s |
| Lab results (large) | 137.3 MB | 493,962 | 44 | 466ms | 294 MB/s |
| Lab results (XL) | 315.8 MB | 997,195 | 44 | 1.1s | 287 MB/s |
| Lab results (1GB+) | 1.2 GB | 3,497,822 | 44 | 4.1s | 298 MB/s |

Quote-free files hit the fast path (~420 MB/s). Files with quoted fields
use the full path (~300 MB/s). The `each` callback mode is slightly faster
than array mode since it skips array allocation.

For context, popular JS CSV parsers typically achieve 30-120 MB/s (Papa Parse,
csv-parse, d3-dsv). This library is comfortably in the top tier of the JS
ecosystem.

## Roadmap

- **Streaming file reader** — chunked parsing for files that don't fit in
  memory, splitting at safe quote boundaries
- **`transform` callback** — per-cell value transformation during parsing
- **`dynamicTyping`** — auto-convert `"42"` to `42`, `"true"` to `true`
- **Column selection** — parse only specific columns by index or name
- **Error/warning collection** — report recovered issues in relax mode

## License

MIT
