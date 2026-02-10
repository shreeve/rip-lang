<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.png" style="width:50px" /> <br>

# Rip Utils - @rip-lang/utils

> **Small single-script utilities for common tasks — zero dependencies, runs on Bun**

Rip Utils is a collection of standalone scripts, each solving one problem
cleanly. Every script is a single `.rip` file with no dependencies beyond
Rip itself. Run them directly, copy them into your projects, or use them
as examples of practical Rip code.

---

## Utilities

### curl.rip — HTTP Client with Variable Interpolation

A command-line HTTP client that parses a compact request format with
variable interpolation. Variables resolve from three sources in priority
order: CLI arguments, a local `.auth` file, and environment variables.

**Usage:**

```bash
rip curl.rip [key=val ...] 'request'
```

**Examples:**

```bash
# Simple GET
rip curl.rip 'https://api.example.com/users'

# POST with headers and JSON body
rip curl.rip token=abc123 '
POST https://api.example.com/users
Authorization: Bearer ${token}
Content-Type: application/json
{ "name": "Alice", "role": "admin" }
'

# Variables from .auth file (key=value format, one per line)
echo 'token=secret123' > .auth
rip curl.rip '
GET https://api.example.com/me
Authorization: Bearer ${token}
'
```

**Request format:**

```
[METHOD] URL              ← first line (METHOD optional, defaults to GET or POST)
Header-Name: value        ← headers (until blank line or body start)
                          ← optional blank line
{ "json": "body" }       ← body (auto-sets method to POST if present)
```

**Variable resolution:** `${name}` and `#{name}` are replaced from:

1. CLI arguments (`key=val` pairs before the request)
2. `.auth` file (key=value, one per line, `#` comments)
3. Environment variables (`Bun.env`)

If a variable is undefined in all three sources, the script exits with
an error. JSON responses are automatically pretty-printed.

**Features:**

- Auto-detects HTTP method (POST if body present, GET otherwise)
- Parses headers from colon-separated lines
- Pretty-prints JSON responses, passes through plain text
- Loads credentials from `.auth` file (gitignore-friendly)
- Supports all standard HTTP methods (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)

---

## Adding a Utility

Drop a `.rip` file into this directory. Each utility should:

- Be a single self-contained script
- Start with a usage comment block
- Have zero external dependencies
- Solve one problem well
