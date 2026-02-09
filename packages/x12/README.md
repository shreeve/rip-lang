<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.png" style="width:50px" /> <br>

# Rip X12 - @rip-lang/x12

> **X12 EDI parser, editor, and query engine**

Parse, query, and edit X12 EDI transactions (270/271, 835, 837, etc.) with a path-based addressing system. Auto-detects field, repetition, component, and segment separators from the ISA header.

## Quick Start

```bash
# Install
bun add -g @rip-lang/x12

# Show fields
rip-x12 -f message.x12

# Query specific values
rip-x12 -q "ISA-6,GS-2" message.x12

# Show message body
rip-x12 -m message.x12

# Recursive directory scan
rip-x12 -d -f /path/to/edi/
```

## Library Usage

```coffee
import { X12 } from '@rip-lang/x12'

# Parse an X12 message
x12 = new X12 rawString

# Get values using path addressing
sender   = x12.get "ISA-6"        # ISA segment, field 6
receiver = x12.get "ISA-8"        # ISA segment, field 8
code     = x12.get "EB-1"         # First EB segment, field 1
third    = x12.get "EB(3)-4"      # 3rd EB segment, field 4
comp     = x12.get "EB(3)-4(2).1" # 3rd EB, field 4, repeat 2, component 1
count    = x12.get "EB(?)"        # Count of EB segments

# Set values
x12.set "ISA-6", "NEWSENDER"
x12.set "GS-2", "NEWID"

# Query multiple values at once
[sender, receiver] = x12.find "ISA-6", "ISA-8"

# Display formatted output
x12.show 'down', 'full'   # lowercase segments, show body

# Iterate segments
x12.each (row) -> console.log row[0]
x12.each 'EB', (row) -> console.log row

# Get raw X12 string
output = x12.raw()
```

## Path Addressing

```
seg(num)-fld(rep).com

seg      — Segment name (2-3 chars): ISA, GS, EB, CLP, etc.
(num)    — Segment occurrence: (1)=first, (3)=third, (?)=count, (*)=all, (+)=new
-fld     — Field number (1-based)
(rep)    — Repetition within field: (1)=first, (?)=count, (*)=all, (+)=new
.com     — Component within repeat (1-based)
```

### Examples

| Path | Meaning |
|------|---------|
| `ISA-6` | ISA segment, field 6 |
| `EB(3)-4` | 3rd EB segment, field 4 |
| `EB(*)-4` | Field 4 from ALL EB segments |
| `EB(?)-4` | COUNT of EB segments |
| `EB(3)-4(2)` | 3rd EB, field 4, 2nd repetition |
| `EB(3)-4(2).1` | 3rd EB, field 4, 2nd rep, 1st component |

## Separators

X12 uses four delimiter levels, auto-detected from the ISA header:

| Separator | ISA Position | Default | Purpose |
|-----------|-------------|---------|---------|
| Field | 4 | `*` | Separates fields within a segment |
| Repetition | 83 | `^` | Separates repeated values within a field |
| Component | 105 | `:` | Separates sub-components |
| Segment | 106 | `~` | Ends a segment |

## CLI Options

| Flag | Description |
|------|-------------|
| `-a, --after <date>` | Filter files modified after date (YYYYMMDD) |
| `--ansi` | ANSI color output |
| `-c, --count` | Count messages |
| `-d, --dive` | Recursive directory scan |
| `-f, --fields` | Show fields |
| `-F, --fields-only` | Fields only, no repeat indicators |
| `-h, --help` | Help |
| `-i, --ignore` | Skip malformed files |
| `-l, --lower` | Lowercase segment names |
| `-m, --message` | Show message body |
| `-p, --path` | Show file path |
| `-q, --query <val>` | Query specific values |
| `-s, --spacer` | Blank line between messages |
| `-t, --tsv` | Tab-delimited output |
| `-v, --version` | Show version |

## Links

- [Rip Language](https://github.com/shreeve/rip-lang)
- [X12 Standard](https://x12.org)
