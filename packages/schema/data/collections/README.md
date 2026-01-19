# DataCollection Schema System

This directory contains a complete example of the SPOT schema-to-code pipeline for defining healthcare data collections. It demonstrates how a single SPOT schema definition generates Java classes and how RML (Row Markup Language) instance files serialize real clinical data structures.

## Directory Structure

```
collections/
├── spot/                    # SPOT schema definitions
│   └── DataCollection.spot  # Core schema (139 lines)
├── src/                     # Auto-generated Java classes
│   ├── DataCollection.java  # Main collection class (367 lines)
│   ├── DataColumn.java      # Column definition (446 lines)
│   ├── DataView.java        # View/query definitions (185 lines)
│   ├── CollectionTarget.java # UI binding configuration (332 lines)
│   └── GroupingInfo.java    # Grouping/sorting config (100 lines)
└── rml/                     # Serialized instance files (36 files)
    ├── vitals.rml           # Vital signs collection
    ├── labs.rml             # Laboratory results
    ├── medications.rml      # Medication orders
    └── ... (33 more clinical data types)
```

## The Schema: DataCollection.spot

The SPOT schema defines 5 types for managing typed data collections:

### DataCollection

The root type representing a named, typed collection of tabular data:

```spot
DataCollection ::= Sequence {
  name PrintableString Range(0..64),
  title PrintableString Range(0..64) Optional,
  description PrintableString Range(0..255) Optional,
  dataURL PrintableString Optional [ mimeType, method, columnSeparator, ... ],
  columns Set { column DataColumn } Reference,
  queryParameters Set { column DataColumn } Reference,
  views Set { view DataView } Reference,
  sort Boolean Default false [ column, descending, caseInsensitive ],
  parsingFilterURL PrintableString Optional,
  transformURL PrintableString Optional,
  ...
} [ onCreated, onDispose, onStartedLoading, onFinishedLoading ]
```

### DataColumn

Defines column metadata with rich typing:

```spot
DataColumn ::= Sequence {
  name PrintableString Range(0..64),
  title PrintableString Range(0..64) Optional,
  valueType Enumerated {
    string_type (1), integer_type (2), decimal_type (3),
    date_time_type (4), date_type (5), time_type (6),
    boolean_type (7), bytes_base64_type (8), struct_type (9),
    array_type (10), number_range_type (11), enum_type (12),
    widget_type (98), custom_type (99)
  } Default string_type,
  columnType Enumerated {
    other (0), id (1), timestamp (2), name (3), name_linked_id (4),
    domain (5), value (6), value_units (7), value_range (8),
    description (9), mime_type (10), href (11), hidden (12),
    linked_id (13), category (16)
  } Default other,
  converterClass PrintableString Optional,
  valueContext PrintableString Optional,
  structColumns Set { column DataColumn } Reference
}
```

### DataView

Defines filtered/transformed views of a collection:

```spot
DataView ::= Sequence {
  name PrintableString Range(0..255) Optional,
  title PrintableString Range(0..64) Optional,
  sourceView PrintableString Optional [ isURLSegment ],
  queryURL PrintableString [ mimeType, inline ],
  transformURL PrintableString Optional,
  updateInline Boolean Default false,
  graphable Boolean Optional,
  register Boolean Optional
}
```

### CollectionTarget

Binds collections to UI widgets:

```spot
CollectionTarget ::= Sequence {
  targetName PrintableString Range(0..64),
  dataURL PrintableString Optional,
  collectionName PrintableString Optional,
  queryURL PrintableString Optional,
  transformURL PrintableString Optional,
  fieldMapping PrintableString Optional,
  replaceTableColumns Boolean Default false,
  grouping GroupingInfo Reference
}
```

### GroupingInfo

Configuration for grouping and sorting:

```spot
GroupingInfo ::= Sequence {
  columns PrintableString,
  groupTitleColumnPosition Integer Default 1,
  preserveGroupingColumns Boolean Default true,
  groupingSortOrder PrintableString Optional,
  sortingColumn PrintableString Optional [ sortOrder="1" ]
}
```

## Auto-Generated Java Classes

The SPOT compiler generates fully-typed Java classes with:

- **Public fields** for each schema element
- **Nested enum classes** for Enumerated types (e.g., `CValueType`, `CColumnType`)
- **Getter/setter methods** for Reference types
- **Attribute definitions** matching SPOT `[attribute]` syntax
- **Preserved user code blocks** between marker comments

Example from `DataColumn.java`:

```java
public class DataColumn extends SPOTSequence {
  public SPOTPrintableString name = new SPOTPrintableString(null, 0, 64, false);
  public SPOTPrintableString title = new SPOTPrintableString(null, 0, 64, true);
  public CValueType valueType = new CValueType(null, null, CValueType.string_type, "string_type", false);
  public CColumnType columnType = new CColumnType(null, null, CColumnType.other, "other", false);

  public static class CValueType extends SPOTEnumerated {
    public final static int string_type = 1;
    public final static int integer_type = 2;
    public final static int decimal_type = 3;
    // ... 14 enum values total
  }
}
```

## RML Instance Files

RML (Row Markup Language) files are serialized `DataCollection` instances using SPOT's SDF-like syntax. The 36 files define healthcare clinical data structures:

### Clinical Data Types

| File | Description |
|------|-------------|
| `vitals.rml` | Vital signs (BP, pulse, temp, etc.) |
| `labs.rml` | Laboratory test results |
| `medications.rml` | Medication orders with dosing |
| `allergies.rml` | Patient allergy records |
| `conditions.rml` | Medical conditions/diagnoses |
| `procedures.rml` | Clinical procedures |
| `immunizations.rml` | Vaccination records |
| `observations.rml` | Base observation type (extended by vitals, labs) |
| `orders.rml` | Clinical orders |
| `diagnostic_reports.rml` | Diagnostic report results |
| `imaging.rml` | Imaging studies |
| `family_history.rml` | Family medical history |
| `social_history.rml` | Social history data |

### Patient & Administrative

| File | Description |
|------|-------------|
| `patient.rml` | Single patient record |
| `patients.rml` | Patient list |
| `demographics.rml` | Patient demographics |
| `person.rml` | Generic person record |
| `users.rml` | System users |
| `careteam.rml` | Care team members |
| `encounter.rml` | Clinical encounters |
| `appointments.rml` | Appointment scheduling |
| `schedule.rml` | Schedule data |

### Documents & Structure

| File | Description |
|------|-------------|
| `documents.rml` | Clinical documents |
| `document_index.rml` | Document indexing |
| `composition.rml` | Document compositions |
| `section.rml` | Document sections |
| `bundle.rml` | FHIR-style bundles |

### Supporting Types

| File | Description |
|------|-------------|
| `alerts.rml` | Clinical alerts |
| `flags.rml` | Patient flags |
| `ivs.rml` | IV medication orders |
| `nutrition.rml` | Nutrition orders |
| `ordering.rml` | Order entry |
| `medical_equipment.rml` | Medical equipment |
| `name_value.rml` | Generic name/value pairs |
| `struct.rml` | Struct type template |
| `place_holder.rml` | Placeholder template |

## RML Syntax Examples

### Simple Collection (vitals.rml)

```rml
DataCollection {
  name: "vitals"
  title: "Vital Signs"
  dataURL: "svc:///vitals/" [columnSeparator="^", ldSeparator="|"]
  transformURL: ".healthcare.VitalsBPTransform" [mimeType="application/java"]
  registerViewsByDefault: true
} [data_extends="observations"]
```

### Collection with Columns (allergies.rml)

```rml
DataCollection {
  name: "allergies"
  dataURL: "svc:///patient/allergies/" [columnSeparator="^", ldSeparator="|"]
  columns {
    { name: "id", columnType: id }
    { name: "allergen", title: "Allergen", columnType: name }
    { name: "reaction", title: "Reaction", valueType: array_type }
    { name: "clinicalStatus" }
    { name: "verificationStatus", title: "Verification" }
    { name: "onset", valueType: date_time_type }
    { name: "criticality", title: "Criticality" }
    { name: "category" }
    { name: "notes", title: "Notes", valueType: array_type }
  }
}
```

### Collection with Transform Script (observations.rml)

```rml
DataCollection {
  name: "observations"
  title: "Observations"
  columns {
    { name: "date", valueType: date_time_type, columnType: timestamp_linked_id }
    { name: "name", columnType: name_linked_id }
    { name: "value", columnType: value }
    { name: "unit", columnType: value_units }
    { name: "range", title: "Reference Range", columnType: value_range }
  }
  presentationTransformURL: <<
    rows.eachItem(function(result, unit, refRange) {
      var u = unit.value;
      if (notEmpty(result.linkedData)) {
        result.setPresentationClass("abnormal-result");
        result.value = concat(result.value, " (", result.linkedData, ")");
      }
    }, 2, 3, 4);
    return false;
  >> [mimeType="application/x-appnativa-script", inline="true"]
  queryParameters {
    { name: "patient", title: "Patient ID:", valueType: string_type }
    { name: "from", title: "From Date:", valueType: date_time_type }
    { name: "to", title: "To Date:", valueType: date_time_type }
  }
  sort: true [descending=true]
}
```

## Key Features Demonstrated

### 1. Schema Inheritance
RML files use `[data_extends="..."]` to inherit from base collections:
```rml
DataCollection { ... } [data_extends="observations"]
```

### 2. Inline Transforms
Scripts can be embedded directly using heredoc syntax:
```rml
transformURL: << ... javascript code ... >> [mimeType="...", inline="true"]
```

### 3. Rich Column Typing
Columns specify both value type and semantic column type:
```rml
{ name: "date", valueType: date_time_type, columnType: timestamp_linked_id }
```

### 4. Data Source Configuration
URLs with parsing attributes:
```rml
dataURL: "svc:///medications/" [columnSeparator="^", ldSeparator="|"]
```

### 5. Query Parameters
Collections can define filterable parameters:
```rml
queryParameters {
  { name: "patientID", valueType: string_type }
  { name: "from", valueType: date_time_type }
}
```

## The Pipeline

```
┌─────────────────────┐
│ DataCollection.spot │  SPOT Schema Definition
└──────────┬──────────┘
           │ SPOT Compiler
           ▼
┌─────────────────────┐
│   Java Classes      │  Type-safe runtime objects
│  (src/*.java)       │
└──────────┬──────────┘
           │ Runtime Parser
           ▼
┌─────────────────────┐
│   RML Instances     │  Serialized data definitions
│  (rml/*.rml)        │
└──────────┬──────────┘
           │ Runtime
           ▼
┌─────────────────────┐
│  Live Collections   │  In-memory typed data
│  bound to UI        │
└─────────────────────┘
```

This demonstrates the full power of SPOT: a single schema definition generates both the code infrastructure and the serialization format for a complete healthcare data management system.
