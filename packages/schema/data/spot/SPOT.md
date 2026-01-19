# SPOT Data Types Reference

This document describes the primitive data types defined in [`SPOT.spot`](SPOT.spot). Read this alongside the schema file to understand each type's purpose, fields, and usage.

## Overview

SPOT (Sparse Notation) defines data structures using a small set of primitive types. All types inherit from `Element`, which provides common properties like name, optionality, and attributes.

**Type Codes:**

| Code | Type | Code | Type |
|------|------|------|------|
| 1 | PrintableString | 10 | Integer |
| 2 | OctetString | 11 | Real |
| 3 | Set | 12 | Enumerated |
| 4 | Sequence | 13 | Boolean |
| 5 | Any | 14 | ByteString |
| 7 | DateTime | 15 | Extends |
| 8 | Date | 16 | Refine |
| 9 | Time | 20 | UserClass |

---

## Attribute

Attributes provide metadata for any element via `[key="value"]` syntax. They are orthogonal to the type system and can be attached to any element.

**Definition:**

```
Attribute ::= Sequence [intrinsic] {
  name   PrintableString,
  value  PrintableString Optional,
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | PrintableString | Yes | The attribute key |
| `value` | PrintableString | No | The attribute value (flag-style if omitted) |

**Example:**

```
field Integer [displayName="Count", required]
field Boolean [intrinsic]
field String [hint="Enter your name", maxLength="100"]
```

When `value` is omitted, the attribute acts as a flag (e.g., `[required]` vs `[required="true"]`).

---

## Element

The abstract base type. All SPOT types inherit from Element, defining the common interface for name, optionality, read-only status, and attributes.

**Definition:**

```
Element ::= Sequence [intrinsic] {
  name        PrintableString   Optional,
  isOptional  Boolean           Optional Default false,
  isReadOnly  Boolean           Optional Default false,
  attributes  Set<Attribute>    Optional,
}
```

**Fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | PrintableString | No | — | Element name within parent container |
| `isOptional` | Boolean | No | `false` | Whether the field is optional |
| `isReadOnly` | Boolean | No | `false` | Whether the field is read-only |
| `attributes` | Set\<Attribute\> | No | — | User-defined metadata |

---

## Boolean

A simple type with two distinguished values: `true` or `false`.

**Type Code:** 13

**Definition:**

```
Boolean ::= Extends Element [intrinsic] {
  value         Boolean Optional,
  defaultValue  Boolean Optional,
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | Boolean | No | Current value |
| `defaultValue` | Boolean | No | Default when value is not set |

**Example:**

```
Settings ::= Sequence {
  isEnabled    Boolean Default true,
  showAdvanced Boolean Optional,
  autoSave     Boolean Default false,
}
```

---

## Integer

A simple type representing positive and negative whole numbers, including zero. Supports optional range constraints. Uses arbitrary precision internally.

**Type Code:** 10

**Definition:**

```
Integer ::= Extends Element [intrinsic] {
  value         Integer Optional,
  defaultValue  Integer Optional,
  rangeMin      Integer Optional,
  rangeMax      Integer Optional,
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | Integer | No | Current value |
| `defaultValue` | Integer | No | Default when value is not set |
| `rangeMin` | Integer | No | Minimum allowed value (inclusive) |
| `rangeMax` | Integer | No | Maximum allowed value (inclusive) |

**Example:**

```
Product ::= Sequence {
  id       Integer Range(1..),
  quantity Integer Range(0..999) Default 1,
  priority Integer Range(1..10),
}
```

**Range Syntax:**

- `Range(0..100)` — Value must be between 0 and 100
- `Range(1..)` — Value must be at least 1 (no maximum)
- `Range(..100)` — Value must be at most 100 (no minimum)

---

## Real

A simple type representing floating-point numbers (members of the set of real numbers). Supports optional range constraints. Uses arbitrary precision internally.

**Type Code:** 11

**Definition:**

```
Real ::= Extends Element [intrinsic] {
  value         Real Optional,
  defaultValue  Real Optional,
  rangeMin      Real Optional,
  rangeMax      Real Optional,
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | Real | No | Current value |
| `defaultValue` | Real | No | Default when value is not set |
| `rangeMin` | Real | No | Minimum allowed value (inclusive) |
| `rangeMax` | Real | No | Maximum allowed value (inclusive) |

**Example:**

```
Measurement ::= Sequence {
  temperature Real Range(-273.15..),
  percentage  Real Range(0.0..100.0),
  latitude    Real Range(-90.0..90.0),
  longitude   Real Range(-180.0..180.0),
}
```

---

## PrintableString

A simple type representing text strings. Values are an ordered sequence of characters consisting of ASCII 10 (newline), 13 (carriage return), and ASCII 32-126 (printable characters).

**Type Code:** 1

**Definition:**

```
PrintableString ::= Extends Element [intrinsic] {
  value         PrintableString       Optional,
  defaultValue  PrintableString       Optional,
  rangeMin      Integer               Optional,
  rangeMax      Integer               Optional,
  choices       Set<PrintableString>  Optional,
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | PrintableString | No | Current value |
| `defaultValue` | PrintableString | No | Default when value is not set |
| `rangeMin` | Integer | No | Minimum string length |
| `rangeMax` | Integer | No | Maximum string length |
| `choices` | Set\<PrintableString\> | No | Allowed values (enumerated strings) |

**Example:**

```
User ::= Sequence {
  username  PrintableString Range(3..20),
  email     PrintableString Range(5..255),
  country   PrintableString Range(2) Default "US",
  status    PrintableString Choice { "active", "inactive", "pending" },
}
```

**Range Syntax (for strings):**

- `Range(10)` — String must be exactly 10 characters
- `Range(1..100)` — String length must be between 1 and 100
- `Range(1..)` — String must have at least 1 character

---

## OctetString

A simple type representing binary data as a Base64-encoded string. Values are an ordered sequence of octets (bytes), each being 8 bits.

**Type Code:** 2

**Definition:**

```
OctetString ::= Extends Element [intrinsic] {
  value         OctetString Optional,
  defaultValue  OctetString Optional,
  rangeMin      Integer     Optional,
  rangeMax      Integer     Optional,
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | OctetString | No | Base64-encoded binary data |
| `defaultValue` | OctetString | No | Default when value is not set |
| `rangeMin` | Integer | No | Minimum byte length |
| `rangeMax` | Integer | No | Maximum byte length |

**Example:**

```
Document ::= Sequence {
  content   OctetString,
  thumbnail OctetString Range(..102400) Optional,
  signature OctetString Range(256),
}
```

---

## ByteString

A simple type representing raw binary data directly (not Base64-encoded). Similar to OctetString but stored as raw bytes.

**Type Code:** 14

**Definition:**

```
ByteString ::= Extends Element [intrinsic] {
  value         ByteString Optional,
  defaultValue  ByteString Optional,
  rangeMin      Integer    Optional,
  rangeMax      Integer    Optional,
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | ByteString | No | Raw byte array |
| `defaultValue` | ByteString | No | Default when value is not set |
| `rangeMin` | Integer | No | Minimum byte length |
| `rangeMax` | Integer | No | Maximum byte length |

**Example:**

```
BinaryMessage ::= Sequence {
  header  ByteString Range(12),
  payload ByteString Range(..65535),
}
```

---

## DateTime

Represents a combined date and time value in ISO 8601 format. This is the base type for `Date` and `Time` specializations.

**Type Code:** 7

**Format:**

```
YYYY-MM-DDThh:mm:ssZ
YYYY-MM-DDThh:mm:ss+hh:mm
YYYY-MM-DDThh:mm:ss-hh:mm
```

- `YYYY` — Four-digit year
- `MM` — Two-digit month (01-12)
- `DD` — Two-digit day (01-31)
- `T` — Separator between date and time
- `hh:mm:ss` — Hours, minutes, seconds
- `Z` — UTC timezone
- `+hh:mm` / `-hh:mm` — Timezone offset from UTC

**Definition:**

```
DateTime ::= Extends Element [intrinsic] {
  value         DateTime Optional,
  defaultValue  DateTime Optional,
  rangeMin      DateTime Optional,
  rangeMax      DateTime Optional,
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | DateTime | No | Current value |
| `defaultValue` | DateTime | No | Default when value is not set |
| `rangeMin` | DateTime | No | Minimum allowed date/time |
| `rangeMax` | DateTime | No | Maximum allowed date/time |

**Example:**

```
Event ::= Sequence {
  startTime DateTime,
  endTime   DateTime Optional,
  created   DateTime Default "2024-01-01T00:00:00Z",
}
```

---

## Date

Represents a date value without time component. Extends `DateTime`.

**Type Code:** 8

**Format:** `YYYY-MM-DD`

**Definition:**

```
Date ::= Extends DateTime [intrinsic] {
  value         Date Optional,
  defaultValue  Date Optional,
  rangeMin      Date Optional,
  rangeMax      Date Optional,
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | Date | No | Current value |
| `defaultValue` | Date | No | Default when value is not set |
| `rangeMin` | Date | No | Minimum allowed date |
| `rangeMax` | Date | No | Maximum allowed date |

**Example:**

```
Person ::= Sequence {
  birthDate     Date,
  hireDate      Date Optional,
  expirationDate Date Range("2024-01-01"..),
}
```

---

## Time

Represents a time value without date component. Extends `DateTime`.

**Type Code:** 9

**Format:** `hh:mm:ss` or `hh:mm`

**Definition:**

```
Time ::= Extends DateTime [intrinsic] {
  value         Time Optional,
  defaultValue  Time Optional,
  rangeMin      Time Optional,
  rangeMax      Time Optional,
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | Time | No | Current value |
| `defaultValue` | Time | No | Default when value is not set |
| `rangeMin` | Time | No | Minimum allowed time |
| `rangeMax` | Time | No | Maximum allowed time |

**Example:**

```
Schedule ::= Sequence {
  openTime  Time Default "09:00",
  closeTime Time Default "17:00",
  lunchTime Time Range("11:00".."14:00") Optional,
}
```

---

## EnumeratedChoice

A helper type representing a single choice within an `Enumerated` type. Each choice has a string name and an associated integer value.

**Definition:**

```
EnumeratedChoice ::= Sequence {
  name   PrintableString,
  value  Integer,
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | PrintableString | Yes | The choice name |
| `value` | Integer | Yes | The choice integer value |

---

## Enumerated

A simple type representing a fixed, named set of integer values. Each value has both a string name and an associated integer.

**Type Code:** 12

**Definition:**

```
Enumerated ::= Extends Element [intrinsic] {
  value         Integer                 Optional,
  stringValue   PrintableString         Optional,
  defaultValue  Integer                 Optional,
  choices       Set<EnumeratedChoice>,
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `value` | Integer | No | Current selection (as integer) |
| `stringValue` | PrintableString | No | Current selection (as name) |
| `defaultValue` | Integer | No | Default when value is not set |
| `choices` | Set\<EnumeratedChoice\> | Yes | The allowed name/value pairs |

**Example:**

```
Status ::= Enumerated {
  pending    (0),
  active     (1),
  completed  (2),
  cancelled  (3)
}

Priority ::= Enumerated {
  low    (1),
  medium (2),
  high   (3),
  urgent (4)
}

Task ::= Sequence {
  title    PrintableString Range(1..100),
  status   Status Default pending,
  priority Priority Default medium,
}
```

---

## Set

Represents an unordered collection of zero or more elements of a single type. Think of it as an array or list.

**Type Code:** 3

**Definition:**

```
Set ::= Extends Element [intrinsic] {
  elementType   PrintableString  Optional,
  definedBy     PrintableString  Optional,
  rangeMin      Integer          Optional,
  rangeMax      Integer          Optional,
  elements      Set<Any>         Optional,
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `elementType` | PrintableString | No | Type name of contained elements |
| `definedBy` | PrintableString | No | Class name for element instances |
| `rangeMin` | Integer | No | Minimum element count |
| `rangeMax` | Integer | No | Maximum element count (-1 = unlimited) |
| `elements` | Set\<Any\> | No | The actual elements |

**Example:**

```
ShoppingCart ::= Sequence {
  items Set<CartItem> Range(0..100),
  tags  Set<PrintableString> Range(0..10) Optional,
}

PhoneNumbers ::= Set<PrintableString> Range(1..5)
```

**Range Syntax (for collections):**

- `Range(5)` — Set must have exactly 5 elements
- `Range(1..10)` — Set must have between 1 and 10 elements
- `Range(1..)` — Set must have at least 1 element

---

## Sequence

Represents an ordered collection of named, heterogeneous fields. Analogous to a struct, record, or object in programming languages.

**Type Code:** 4

**Definition:**

```
Sequence ::= Extends Element [intrinsic] {
  allowsDynamicElements  Boolean   Optional Default false,
  elements               Set<Any>  Optional,
}
```

**Fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `allowsDynamicElements` | Boolean | No | `false` | Allow fields not defined in schema |
| `elements` | Set\<Any\> | No | — | Named child elements |

**Example:**

```
Address ::= Sequence {
  street     PrintableString Range(1..100),
  city       PrintableString Range(1..50),
  state      PrintableString Range(2) Optional,
  postalCode PrintableString Range(5..10),
  country    PrintableString Range(2) Default "US",
}

User ::= Sequence {
  id        Integer Range(1..),
  name      PrintableString Range(1..100),
  email     PrintableString Range(5..255),
  address   Address Optional,
  isActive  Boolean Default true,
}
```

---

## Any

A polymorphic container that can hold any SPOT type. Optionally constrained to a specific base type via `DefinedBy`.

**Type Code:** 5

**Definition:**

```
Any ::= Extends Element [intrinsic] {
  definedBy  PrintableString  Optional,
  value      Any              Optional,
}
```

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `definedBy` | PrintableString | No | Constraining base type name |
| `value` | Any | No | The wrapped element |

**Example:**

```
Response ::= Sequence {
  success Boolean,
  data    Any Optional,
  error   Any DefinedBy Error Optional,
}

Container ::= Sequence {
  content Any DefinedBy Widget,
}
```

When `DefinedBy` is specified, the `Any` element can only hold values of the specified type or its subtypes.

---

## Modifiers Reference

Modifiers alter the behavior of fields within a type definition.

### Optional

Specifies that the element need not be present. Fields are required by default.

```
email PrintableString Optional
```

### Default

Assigns a default value when the element is not present.

```
isActive Boolean Default true
count    Integer Default 0
status   PrintableString Default "pending"
```

### Range

Constrains the value of an element. Meaning depends on the type:

| Type | Range Meaning |
|------|---------------|
| Integer, Real | Value bounds (min/max) |
| PrintableString, OctetString, ByteString | Length bounds |
| Set | Element count bounds |
| DateTime, Date, Time | Temporal bounds |

```
age      Integer Range(0..150)
name     PrintableString Range(1..100)
items    Set<Item> Range(1..10)
```

### Extends

Allows inheritance from a previously defined type.

```
Employee ::= Extends Person {
  employeeId  Integer,
  department  PrintableString,
}
```

### Refine

Restricts or specializes a base type by constraining existing fields.

```
SeniorEmployee ::= Refine Employee {
  yearsOfService Integer Range(5..),
}
```

### DefinedBy

Constrains an `Any` element to a specific class or its subtypes.

```
content Any DefinedBy Widget
```

### Reference

Hints that instantiation happens at runtime rather than compile time. Typically used with user-defined types.

```
configuration Config Reference
```

### Choice

Confines a `PrintableString` to one of a predefined set of values.

```
status PrintableString Choice { "draft", "published", "archived" }
```

---

## Complete Example

```
/**
 * A complete example demonstrating SPOT types and modifiers.
 */

Status ::= Enumerated {
  draft     (0),
  published (1),
  archived  (2)
}

Author ::= Sequence {
  id    Integer Range(1..),
  name  PrintableString Range(1..100),
  email PrintableString Range(5..255) Optional,
}

Tag ::= Sequence {
  name  PrintableString Range(1..50),
  color PrintableString Range(7) Default "#000000",
}

Article ::= Sequence {
  id          Integer Range(1..),
  title       PrintableString Range(1..200),
  content     PrintableString,
  author      Author,
  status      Status Default draft,
  publishDate Date Optional,
  tags        Set<Tag> Range(0..10) Optional,
  viewCount   Integer Range(0..) Default 0,
  isFeature   Boolean Default false,
}

Blog ::= Sequence {
  name     PrintableString Range(1..100),
  articles Set<Article>,
  created  DateTime,
}
```
