# SPOT - Schema Package for Object Transmission

This directory contains the core implementation of SPOT, a powerful schema definition language inspired by [ASN.1](https://en.wikipedia.org/wiki/ASN.1) (Abstract Syntax Notation One).

## What is SPOT?

SPOT (**S**chema **P**ackage for **O**bject **T**ransmission) is a notation for defining structured data types and objects. It provides a clean, readable syntax that allows developers—and even non-technical stakeholders—to understand, discuss, and collaborate on data models without getting lost in implementation details.

### Why SPOT?

Traditional schema languages like JSON Schema, XML Schema, or Protocol Buffers are powerful but can be verbose and difficult for non-programmers to read. SPOT takes inspiration from **ASN.1** (originally developed by ITU-T in the 1980s for telecommunications protocols) and modernizes it with a cleaner, more approachable syntax.

**Key benefits:**

- **Human-readable** — Schema definitions look like natural descriptions of data
- **Self-documenting** — Inline comments and clear naming conventions
- **Type-safe** — Strong typing with constraints (ranges, optionality, defaults)
- **Extensible** — Inheritance via `Extends` and refinement via `Refine`
- **Accessible** — Non-technical team members can review and discuss schemas

### Example

Here's what a SPOT schema looks like:

```spot
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

## Directory Structure

```
spot/
├── README.md       # This file
├── SPOT.spot       # Meta-schema defining SPOT primitive types
└── src/            # Java implementation of the SPOT engine
    ├── aSPOTElement.java      # Abstract base class for all elements
    ├── iSPOTElement.java      # Core interface for SPOT objects
    ├── iSPOTConstants.java    # Type codes and constants
    ├── SPOTInteger.java       # Integer primitive
    ├── SPOTBoolean.java       # Boolean primitive
    ├── SPOTPrintableString.java # String primitive
    ├── SPOTSequence.java      # Struct/object container
    ├── SPOTSet.java           # Collection container
    └── ... (29 files total)
```

## SPOT.spot — The Meta-Schema

The [`SPOT.spot`](SPOT.spot) file is a unique self-describing document: it defines the SPOT primitive types using SPOT notation itself. This "bootstrapping" approach serves multiple purposes:

1. **Authoritative documentation** — The canonical reference for SPOT primitives
2. **Learning resource** — Understand SPOT syntax by seeing how primitives are defined
3. **Tooling foundation** — Can be used for code generation and validation

### Primitive Types

SPOT provides these fundamental types:

| Type | Code | Description |
|------|------|-------------|
| `Boolean` | 13 | Logical true/false |
| `Integer` | 10 | Whole numbers with optional range |
| `Real` | 11 | Floating-point numbers with optional range |
| `PrintableString` | 1 | Text strings with length constraints |
| `OctetString` | 2 | Base64-encoded binary data |
| `ByteString` | 14 | Raw binary data |
| `DateTime` | 7 | Combined date and time (ISO 8601) |
| `Date` | 8 | Date only |
| `Time` | 9 | Time only |
| `Enumerated` | 12 | Named integer constants |
| `Set` | 3 | Unordered collection of elements |
| `Sequence` | 4 | Ordered named fields (struct/object) |
| `Any` | 5 | Polymorphic container |

### Type Modifiers

- `Extends` (15) — Inherit from a parent type
- `Refine` (16) — Restrict/specialize a base type

## ASN.1 Heritage

SPOT's design draws heavily from **ASN.1** (Abstract Syntax Notation One), an international standard (ITU-T X.680) originally created in 1984 for defining data structures in telecommunications protocols. ASN.1 has been used to define protocols like:

- LDAP (Lightweight Directory Access Protocol)
- SNMP (Simple Network Management Protocol)
- X.509 certificates (SSL/TLS)
- GSM/LTE mobile networks

SPOT modernizes ASN.1's concepts with:

- Cleaner syntax (no `SEQUENCE OF`, `CHOICE`, etc.)
- Simpler constraint notation (`Range(0..100)` vs `(0..100)`)
- Built-in attribute system for metadata
- Streamlined inheritance model

## The Java Implementation

The `src/` directory contains the Java runtime that powers SPOT:

- **Parsing** — `SDFParser.java`, `SDFNode.java` parse SDF (SPOT Data Format) files
- **Type System** — Each primitive has a corresponding `SPOT*.java` class
- **Serialization** — Convert between SPOT objects and JSON, binary, streams
- **Validation** — Range checking, required fields, type constraints

The implementation uses:
- `iSPOTElement` — Interface all SPOT objects implement
- `aSPOTElement` — Abstract base providing common functionality
- `SPOTSequence` — Container for named heterogeneous fields
- `SPOTSet` — Container for homogeneous collections

## Usage

SPOT schemas (`.spot` files) define data structures. These can be:

1. **Compiled** to generate type-safe code in Java or other languages
2. **Interpreted** at runtime to dynamically create and validate objects
3. **Serialized** to SDF (text), JSON, or binary formats

See the [`rare/`](../rare/) directory for a comprehensive example of SPOT in action—the RARE (Realtime Application Rendering Engine) framework defines an entire UI system using SPOT schemas.

## Related Directories

- [`../rare/`](../rare/) — RARE framework built on SPOT primitives
- [`../collections/`](../collections/) — DataCollection schema and examples
- [`../medical/`](../medical/) — Medical demo application using SPOT/SDF
