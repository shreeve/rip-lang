# SPOT - Sparse Notation

**SPOT** (Sparse Notation) is a schema definition language that makes data structures readable, shareable, and understandable—even by non-programmers. First specified in 2005 and refined over two decades of production use, SPOT draws on ASN.1's proven foundations while stripping away its complexity.

## The Problem

Traditional schema languages require expertise to read and write:

- **JSON Schema** — Verbose, deeply nested, requires understanding of `$ref`, `allOf`, `anyOf`
- **XML Schema** — Notoriously complex, often longer than the data it describes
- **Protocol Buffers** — Developer-focused, requires compilation toolchain

When business analysts, product managers, and developers can't share a common language for data, miscommunication happens. Requirements get lost in translation.

## The Solution

SPOT provides a clean, readable syntax that bridges the gap:

```
Person ::= Sequence {
  id         Integer          Range(1..),
  name       PrintableString  Range(1..100),
  email      PrintableString  Optional,
  birthDate  Date             Optional,
  isActive   Boolean          Default true,
  tags       Set<PrintableString> Range(0..10) Optional,
}

Status ::= Enumerated {
  pending(0), active(1), completed(2), cancelled(3)
}
```

Compare this to equivalent JSON Schema or XML Schema—SPOT is dramatically more readable.

Anyone can read this. Anyone can discuss it. Yet it's precise enough to generate type-safe code.

## Heritage

SPOT's design draws from **ASN.1** (Abstract Syntax Notation One), an international standard (ITU-T X.680) created in 1984 that has proven itself in critical infrastructure:

- **LDAP** — Directory services powering enterprise authentication
- **SNMP** — Network management for millions of devices worldwide
- **X.509** — The certificates securing SSL/TLS connections
- **GSM/LTE** — Mobile networks serving billions of users

ASN.1 demonstrated that abstract, implementation-independent data definitions work at scale. But it came bundled with complex binary encoding rules (BER, DER, PER) and arcane modifiers (IMPLICIT, EXPLICIT, UNIVERSAL).

**SPOT's key insight:** Separate the description language from encoding rules entirely. Let them evolve independently. This decoupling is what makes SPOT both simpler and more flexible.

## Why It Works

- **Human-readable** — Schema definitions look like natural descriptions
- **Self-documenting** — Inline comments and clear naming conventions
- **Type-safe** — Strong typing with constraints (ranges, optionality, defaults)
- **Extensible** — Inheritance via `Extends` and refinement via `Refine`
- **Encoding-agnostic** — Same schema works with JSON, SDF, binary, or custom formats
- **Accessible** — Business and technical teams share one source of truth

## Success in Practice

The [`rare/`](../rare/) directory demonstrates SPOT's capabilities at scale. **RARE** (Realtime Application Rendering Engine) uses SPOT to define an entire server-driven UI framework—nearly 2,000 lines of schema that specify:

- Window and viewer configurations
- Widget hierarchies and layouts
- Data binding and event handling
- Styling and rendering pipelines

A complete application UI system, defined declaratively, readable by anyone, and executable at runtime. This is what SPOT enables.

## Directory Structure

```
spot/
├── README.md       # This file
├── SPOT.spot       # Meta-schema defining SPOT primitive types
└── src/            # Java implementation (29 files)
```

## SPOT.spot — The Meta-Schema

The [`SPOT.spot`](SPOT.spot) file is remarkable: it defines SPOT's primitive types using SPOT notation itself. This bootstrapping serves as:

1. **Authoritative documentation** — The canonical reference for primitives
2. **Learning resource** — See how primitives are defined
3. **Tooling foundation** — Enables code generation and validation

## Data Types

| Type | Description |
|------|-------------|
| `Boolean` | Logical true/false |
| `Integer` | Whole numbers with optional range |
| `Real` | Floating-point numbers with optional range |
| `PrintableString` | Text strings with length constraints |
| `OctetString` | Base64-encoded binary data |
| `ByteString` | Raw binary data |
| `DateTime` | Combined date and time (ISO 8601) |
| `Date` | Date only |
| `Time` | Time only |
| `Enumerated` | Named integer constants |
| `Set` | Unordered collection of elements |
| `Sequence` | Ordered named fields (struct/object) |
| `Any` | Element of any defined type |

## Modifiers

| Modifier | Description |
|----------|-------------|
| `Optional` | Element need not be present |
| `Default` | Default value when element is absent |
| `Range` | Constrains value (meaning depends on type) |
| `Extends` | Inherit from a parent type |
| `Refine` | Restrict/specialize a base type |
| `DefinedBy` | Constrains `Any` to a specific class |
| `Reference` | Instantiation happens at runtime |
| `Choice` | Confines `PrintableString` to predefined values |

## The Java Implementation

The `src/` directory contains the runtime engine:

- **Parsing** — `SDFParser.java`, `SDFNode.java` parse SDF (SPOT Data Format)
- **Type System** — Each primitive has a corresponding `SPOT*.java` class
- **Serialization** — Convert between SPOT objects and JSON, binary, streams
- **Validation** — Range checking, required fields, type constraints

## Usage

SPOT schemas (`.spot` files) define data structures that can be:

1. **Compiled** — Generate type-safe code in Java or other languages
2. **Interpreted** — Dynamically create and validate objects at runtime
3. **Serialized** — Output to SDF (text), JSON, or binary formats

## Related

- [`../rare/`](../rare/) — RARE UI framework (comprehensive SPOT example)
- [`../collections/`](../collections/) — DataCollection schema and instances
- [`../medical/`](../medical/) — Medical demo application
