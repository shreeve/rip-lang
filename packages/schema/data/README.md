<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.svg" style="width:50px" /> <br>

# Schema Data

Reference implementations and examples for schema-driven applications.

## Directories

### [collections/](collections/)

Healthcare data collection definitions using SPOT schemas and RML (Row Markup Language) instances.

- **rml/** — 36 RML files defining clinical data structures (observations, medications, labs, vitals, allergies, procedures, etc.)
- **spot/** — SPOT schema definition for `DataCollection`
- **src/** — Java implementation classes for collection handling

### [healthstream/](healthstream/)

Client configuration for healthcare data streaming.

- `client.json` — Full configuration in JSON format
- `client.rip` — Same configuration in Rip object syntax
- `feed.json` — Sample feed data

### [medical/](medical/)

Complete medical demo application built with Sage/SDF.

- **Root files** — Application screens (`summary.sdf`, `labs.sdf`, `medications.sdf`, `orders.sdf`, etc.)
- **data/** — Sample patient data (labs, vitals, allergies, medications, problems, documents)
- **documents/** — Document viewer and composer widgets

This demonstrates a full hospital-style application with patient headers, tabbed views, and clinical data displays.

### [rare/](rare/)

RARE application framework schema definitions.

- `rare.spot` — 1,896-line SPOT schema defining a complete mobile/cross-platform application framework (Application, MainWindow, Viewers, Widgets, Tables, Forms, etc.)

### [spot/](spot/)

Core SPOT parser and runtime implementation in Java.

- **Parsers** — `SDFParser.java`, `SDFNode.java`
- **Type classes** — `SPOTSequence`, `SPOTSet`, `SPOTEnumerated`, `SPOTInteger`, `SPOTBoolean`, `SPOTReal`, `SPOTPrintableString`, etc.
- **Utilities** — `SPOTHelper`, `SPOTUtils`, `SPOTJSONWriter`

This is the reference implementation for parsing SPOT schemas and SDF data files.
