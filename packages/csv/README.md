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

## Special Cases (Relax + Excel)

When `relax: true` and `excel: true` are both enabled, the parser recovers
from common real-world CSV malformations — stray quotes, unescaped embedded
quotes, and Excel `="..."` literals. These patterns appear frequently in
exports from systems like Labcorp, legacy Excel, and other enterprise tools.

The following table shows how the parser handles each case:

| Row | Input | Fields | Key behavior |
|-----|-------|--------|-------------|
| 0 | `"AAA "BBB",CCC,"DDD"` | 3 | Stray quotes recovered (relax) |
| 1 | `"CHUI, LOK HANG "BENNY",…,=""` | 5 | Stray quotes + excel empty |
| 2 | `"Don",="007",10,"Ed"` | 4 | Excel literal preserves leading zero |
| 6 | `Charlie or "Chuck",=B2 + B3,9` | 3 | Unquoted stray quotes + bare formula |
| 10 | `A,B,C",D` | 4 | Trailing stray quote preserved |
| 12 | `…,"CHO, JOELLE "JOJO"",08/19/2022` | 7 | Stray quotes + excel literals |
| 14 | `"CHO, JOELLE "JOJO"",456` | 3 | Stray quotes (relax) |
| 15 | `"CHO, JOELLE ""JOJO""",456` | 3 | Properly doubled quotes — same result |
| 16 | `=,=x,x=,="x",="","","=",…` | 11 | Full excel + quoting matrix |

```coffee
# Parse messy real-world CSV with both modes enabled
rows = CSV.read str, relax: true, excel: true

# Load a Labcorp file
rows = CSV.load! 'labcorp.csv', relax: true, excel: true, headers: true
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

## CLI

The library doubles as a command-line tool for converting CSV files:

```bash
# Clean up a malformed Labcorp file
bun csv.rip -r -e input.csv output.csv

# Protect leading zeros for Google Sheets / Excel
bun csv.rip -r -e -z input.csv output.csv

# Pipe to stdout
bun csv.rip -r -e input.csv

# Show version
bun csv.rip -v
```

```
Usage: bun csv.rip [options] <input> [output]

Read options:
  -r, --relax        Recover from stray/malformed quotes
  -e, --excel        Handle Excel ="..." literals on input
  -s, --strip        Strip whitespace from fields

Write options:
  -z, --zeros        Protect leading zeros with ="0123"

General:
  -v, --version      Show version
  -h, --help         Show this help

If output is omitted, writes to stdout.
```

## Performance

The parser consistently delivers **250-530 MB/s** throughput on real-world
CSV files with `relax: true, excel: true` enabled:

| File | Size | Rows | Time | Throughput |
|------|------|------|------|-----------|
| Geodata | 24.8 MB | 662,061 | 75ms | 329 MB/s |
| Medical records | 22.8 MB | 93,963 | 86ms | 264 MB/s |
| Japanese postal codes | 10.9 MB | 124,565 | 29ms | 370 MB/s |
| Japanese postal codes (100K) | 8.8 MB | 100,000 | 20ms | 442 MB/s |
| Labcorp charges | 3.6 MB | 20,035 | 7ms | 528 MB/s |
| UTF-8 data | 2.5 MB | 30,000 | 7ms | 354 MB/s |
| Mixed data | 2.6 MB | 30,000 | 8ms | 340 MB/s |
| Lab results | 1.8 MB | 4,894 | 7ms | 254 MB/s |

Quote-free files hit the fast path (~440 MB/s). Files with quoted fields
use the full path (~300 MB/s). The relax+excel heuristics add zero overhead
on clean data — they only fire when an actual stray quote is encountered.

### Comparison with Other JS Parsers

Benchmarked against the [uDSV benchmark suite](https://github.com/leeoniya/uDSV/tree/main/bench)
(the most comprehensive JS CSV benchmark), which tests ~20 parsers on Bun:

| Parser | Strings | Quoted | Large (36 MB) | Notes |
|--------|---------|--------|---------------|-------|
| **Rip CSV** | **~370 MB/s** | **~330 MB/s** | **~329 MB/s** | indexOf ratchet, relax+excel |
| uDSV | 287 MB/s | 188 MB/s | 293 MB/s | Fastest pure-JS parser (5KB) |
| csv-simple-parser | 223 MB/s | 206 MB/s | 233 MB/s | |
| d3-dsv | 275 MB/s | 110 MB/s | 285 MB/s | |
| PapaParse | 252 MB/s | 59 MB/s | 292 MB/s | Drops 4x on quoted data |
| csv-parse/sync | 20 MB/s | 19 MB/s | 18 MB/s | Node.js built-in |

Rip CSV is in the same tier as uDSV — the acknowledged fastest JS CSV parser —
while also supporting relax mode and Excel literal recovery that no other
parser offers. On quoted files, Rip CSV is **5x faster** than PapaParse and
**15x faster** than csv-parse.

## Roadmap

- **Streaming file reader** — chunked parsing for files that don't fit in
  memory, splitting at safe quote boundaries
- **`transform` callback** — per-cell value transformation during parsing
- **`dynamicTyping`** — auto-convert `"42"` to `42`, `"true"` to `true`
- **Column selection** — parse only specific columns by index or name
- **Error/warning collection** — report recovered issues in relax mode

## License

MIT
