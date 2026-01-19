# RARE - Realtime Application Rendering Engine

RARE is a complete UI framework specification written as a SPOT type schema. The `rare.spot` file (1,896 lines) defines everything needed to dynamically instantiate full desktop or web applications at runtime.

## Overview

RARE enables **server-driven UI** at its most sophisticated — entire application structures are data that can be:
- Generated dynamically per user/context
- Updated without app deployment
- Rendered identically on desktop, web, or mobile

## Core Architecture: Type Inheritance Tree

The schema builds a sophisticated widget hierarchy using `::= Extends`:

```
Renderer (base painting)
  └── RenderableItem (alignment, icons, states)
        └── Widget (name, bounds, events, data binding)
              └── Viewer (containers, scripts, context URLs)
                    ├── MainWindow, MenuBar, ToolBar, StatusBar
                    ├── Form → GroupBox → GridPane/StackPane/SplitPane/TabPane
                    ├── Table → TreeTable
                    ├── Tree → CheckBoxTree  
                    ├── ListBox → CheckBoxList
                    ├── Chart, Canvas, Carousel, Browser, MediaPlayer
                    └── DocumentPane, ImagePane, WidgetPane
              ├── TextField → PasswordField, TextArea
              ├── Button → PushButton, RadioButton, CheckBox
              ├── ComboBox, Navigator, Label, Slider, ProgressBar
              └── Spinner → NumberSpinner, DateSpinner, TimeSpinner, DateTimeSpinner
```

## Type Definition Grammar

Each type follows this pattern:

```spot
TypeName ::= Extends ParentType {
  fieldName FieldType Constraints Default value [attributes], // Category~hints: description
} [eventHandlers]
```

**Components:**
- `::=` — Type definition operator (ASN.1-inspired)
- `Extends` — Single inheritance
- Field definitions inside `{ }`
- `[attributes]` — Inline modifiers (e.g., `[os, inline, url]`)
- Trailing `[events]` — Declares supported callbacks
- Structured comments: `// Category~hint~hint: description`

## Primitive Types

```spot
PrintableString Range(0..255)     # Bounded strings
Integer Range(-1..100)            # Bounded integers  
Real Range(0..1)                  # Bounded floats
Boolean Default true              # Booleans with defaults
Date, Time, DateTime              # Temporal types
Enumerated { name (value), ... }  # Named enums with numeric codes
Set { item Type }                 # Collections
Sequence { ... }                  # Ordered structures
Any DefinedBy Widget              # Polymorphic/dynamic typing
```

## Key Features

### Complete Application Definition

The `Application` type configures:
- i18n/l10n (locale-sensitive resources)
- Custom widget handlers per OS
- Scripting language
- Date/time formats
- Authentication handling
- The entire main window hierarchy

```spot
Application ::= Sequence {
  name PrintableString Range(0..32) Optional,
  contextURL PrintableString Range(0..255) Optional [ redirect ],
  lookAndFeelPropertiesURL PrintableString Optional [ inline, locale="en_US" ],
  resourceStringsURL PrintableString Optional [ inline, locale="en_US" ],
  mainWindow MainWindow Reference,
  ...
} [ onAuthFailure, onFocusChange, onChange, ... ]
```

### Platform-Aware Rendering

The `[os]` attribute throughout allows targeting specific platforms:
- Windows, Linux, OS X, iOS, Android

### Multi-State Rendering

Every widget can have completely different visual states:

```spot
selectedRenderer Renderer Reference,
pressedRenderer Renderer Reference,
disabledRenderer Renderer Reference,
rolloverRenderer Renderer Reference,
focusRenderer Renderer Reference,
```

### Metadata System

Comments encode structured metadata:

```
// Category~hint1~hint2: Human description
```

**Categories:** Design, Appearance, Behavior, Layout, Hidden

**Hints:** ~url, ~resource, ~color, ~font, ~icon, ~unit, ~reload, ~class, ~widget

This metadata drives:
- IDE tooling (property inspectors)
- Documentation generation
- Validation rules
- Hot-reload behavior (`~reload` hints)

### Data Binding Architecture

Multiple data mechanisms coexist:

```spot
dataURL PrintableString Optional [ mimeType, method, deferred, ... ],
linkedData PrintableString Optional,
submitValue Enumerated { selected_value_text, selected_linked_data, ... },
```

This enables:
- URL-based lazy loading (`dataURL`)
- Direct data binding (`linkedData`)
- Form submission with multiple value extraction strategies

### Layout System

Multiple layout paradigms:

```spot
layout Enumerated {
  absolute (1),   # Pixel positioning
  table    (2),   # Grid layout
  forms    (3),   # JGoodies FormLayout
  flow     (4),   # Flow layout
  custom   (10)   # Custom layout manager
} Default table
```

Sophisticated unit support:
```
px, pt, pc, in, cm, mm, ch (character), ln (line), ex, em, %
```

## What RARE Can Dynamically Create

From a single JSON/XML/SDF instance conforming to this schema:

- **Full desktop applications** — menus, toolbars, status bars, keyboard shortcuts
- **Complex data grids** — TreeTables with sorting, filtering, editing, drag-drop
- **Rich forms** — validation, submission, field types, masks
- **Charts** — 20+ chart types with axes, legends, tooltips, annotations
- **Image viewers** — zoom, pan, rotate, selection
- **Media players** — video/audio playback
- **Embedded browsers** — with location bar, status bar options
- **Carousels** — image galleries with reflections, animations
- **Collapsible panels** — with animation transitions
- **Tab/Split/Stack panes** — arbitrary nesting of views

## How It Works

The schema is self-describing enough that a runtime can:

1. **Parse** an instance document (JSON, XML, SDF)
2. **Validate** against the type constraints
3. **Instantiate** native widgets on any platform
4. **Bind** data sources to UI elements
5. **Wire** event handlers to scripts
6. **Apply** themes/templates dynamically
7. **Handle** i18n/l10n automatically

## Widget Categories

### Containers/Viewers
- `MainWindow` — Application main window with menu, toolbar, status bar
- `Form` / `GroupBox` — Widget containers with layout management
- `GridPane` — Cell-based layout with regions
- `StackPane` — Card-style stacked views
- `SplitPane` — Resizable split regions
- `TabPane` — Tabbed interface
- `CollapsiblePane` — Expandable/collapsible sections

### Data Display
- `Table` / `TreeTable` — Data grids with sorting, filtering, editing
- `Tree` / `CheckBoxTree` — Hierarchical data display
- `ListBox` / `CheckBoxList` — List widgets
- `Chart` — 20+ chart types (line, bar, pie, area, candlestick, etc.)
- `Carousel` — Image/widget carousels

### Input Widgets
- `TextField` / `TextArea` / `PasswordField` — Text input
- `ComboBox` — Dropdown selection
- `CheckBox` / `RadioButton` — Boolean/choice selection
- `Slider` — Range selection
- `Spinner` — Number/Date/Time spinners
- `DateChooser` / `ColorChooser` — Specialized pickers

### Navigation
- `Navigator` — Breadcrumb/toggle navigation
- `PushButton` — Action buttons with multiple styles

### Media
- `ImagePane` — Image viewing with zoom/pan/rotate
- `DocumentPane` — Document display/editing
- `Browser` — Embedded web browser
- `MediaPlayer` — Audio/video playback
- `Canvas` — HTML5-compatible drawing surface

## Design Philosophy

RARE represents **"UI as Data"** — the entire application structure is declarative:
- Single inheritance with `Extends`
- Rich inline attributes with `[ ]`
- Self-documenting structured comments
- Platform abstraction via `[os]`
- Complete event model via trailing `[ handlers ]`

This is essentially **React + Material UI + Redux + Router + i18n + Accessibility** expressed as a declarative type schema, enabling enterprise applications to be built entirely from configuration data.
