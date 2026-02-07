<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.svg" style="width:50px" /> <br>

# Schema Notation Ideas

Exploring syntax options for Rip Schema, ranging from the original SPOT/ASN.1 style to compact sigil-based alternatives.

## Background

SPOT (part of the Sage framework) uses an ASN.1-inspired syntax that proved itself at enterprise scale for building complex applications like hospital systems. The question: should Rip Schema preserve SPOT's clarity, adopt a more compact syntax, or find a middle ground?

## Key Design Questions

1. **Standalone vs Computable** — Is schema a neutral data format or executable Rip code?
2. **Verbosity vs Clarity** — `Optional` is clear, `?` is compact
3. **Colons** — `name: Type` vs `name Type`
4. **Braces** — Required `{ }` vs whitespace-sensitive
5. **Type syntax** — `PrintableString Range(0..32)` vs `string(32)`
6. **Events/Attributes** — Trailing `[ ]` vs directives

---

## Original SPOT Syntax

From `sage.spot` — the proven baseline:

```
Application ::= Sequence {
  name PrintableString Range(0..32) Optional,
  lookAndFeel PrintableString Range(0..255) Optional [ style ],
  widgetHandlers Set {
    widget NameValuePair [ os ]
  } Reference,
  deferredLoadingMode Enumerated {
    auto   (0),
    always (1),
    never  (2)
  } Default auto,
  defaultScriptingLanguage PrintableString Range(0..64) Default "text/javascript",
  mainWindow MainWindow
} [ onAuthFailure, onChange ]

MainWindow ::= Sequence {
  templateURL PrintableString Optional [ inline, cache ],
  title PrintableString Range(0..80) Optional,
  icon PrintableString Range(0..255) Optional [ alt, slice, base, size ],
  font Font Optional,
  menuBar MenuBar Reference [ url ],
  toolbars Set {
    toolbar ToolBar
  } Reference [ url ],
  visible Boolean Default true
} [ onCreated, onOpened, onWillClose ]

MenuBar ::= Extends Viewer {
  undockable Boolean Default false,
  hideable Boolean Default false,
  rearrangeable Boolean Default false
} [ onAction ]

ToolBar ::= Extends Viewer {
  location Enumerated {
    north (1),
    south (2),
    east  (3),
    west  (4)
  } Default north,
  row Integer Range(0..3) Default 0,
  horizontal Boolean Default true,
  detachable Boolean Default false
}
```

**Strengths:**
- Self-documenting: reads like English
- No ambiguity about types, constraints, defaults
- Proven at scale (2000+ line schemas)
- Language-neutral

**Weaknesses:**
- Verbose keywords (`PrintableString`, `Sequence`, `Enumerated`)
- Lots of punctuation (`{ }`, `,`)
- `::=` feels dated

---

## Option A: Whitespace-Sensitive SPOT

Minimal change: drop `{ }` and `,`, use indentation.

```
Application ::= Sequence [onAuthFailure, onChange]
  name PrintableString Range(0..32) Optional
  lookAndFeel PrintableString Range(0..255) Optional [style]
  widgetHandlers Set Reference
    widget NameValuePair [os]
  deferredLoadingMode Enumerated Default auto
    auto   (0)
    always (1)
    never  (2)
  defaultScriptingLanguage PrintableString Range(0..64) Default "text/javascript"
  mainWindow MainWindow

MainWindow ::= Sequence [onCreated, onOpened, onWillClose]
  templateURL PrintableString Optional [inline, cache]
  title PrintableString Range(0..80) Optional
  icon PrintableString Range(0..255) Optional [alt, slice, base, size]
  font Font Optional
  menuBar MenuBar Reference [url]
  toolbars Set Reference [url]
    toolbar ToolBar
  visible Boolean Default true

MenuBar ::= Extends Viewer [onAction]
  undockable Boolean Default false
  hideable Boolean Default false
  rearrangeable Boolean Default false

ToolBar ::= Extends Viewer
  location Enumerated Default north
    north (1)
    south (2)
    east  (3)
    west  (4)
  row Integer Range(0..3) Default 0
  horizontal Boolean Default true
  detachable Boolean Default false
```

---

## Option B: Colons + Shorter Types

Add colons for visual separation, use shorter type names.

```
Application ::= Sequence [onAuthFailure, onChange]
  name:                      string(32)   Optional
  lookAndFeel:               string(255)  Optional  [style]
  widgetHandlers:            Set<NameValuePair>  Reference
  deferredLoadingMode:       enum  Default(auto)
    auto   (0)
    always (1)
    never  (2)
  defaultScriptingLanguage:  string(64)  Default("text/javascript")
  mainWindow:                MainWindow

MainWindow ::= Sequence [onCreated, onOpened, onWillClose]
  templateURL:  string    Optional  [inline, cache]
  title:        string(80)  Optional
  icon:         string(255)  Optional  [alt, slice, base, size]
  font:         Font  Optional
  menuBar:      MenuBar  Reference  [url]
  toolbars:     Set<ToolBar>  Reference  [url]
  visible:      bool  Default(true)

MenuBar ::= Extends Viewer [onAction]
  undockable:    bool  Default(false)
  hideable:      bool  Default(false)
  rearrangeable: bool  Default(false)

ToolBar ::= Extends Viewer
  location:    enum  Default(north)
    north (1)
    south (2)
    east  (3)
    west  (4)
  row:         int(0..3)  Default(0)
  horizontal:  bool  Default(true)
  detachable:  bool  Default(false)
```

---

## Option C: Sigil Modifiers

Replace keywords with sigils: `?` optional, `!` required, `#` unique, `= x` default.

```
Application ::= Sequence [onAuthFailure, onChange]
  name?                      string(32)
  lookAndFeel?               string(255)  [style]
  widgetHandlers             Set<NameValuePair>  Reference
  deferredLoadingMode        enum = auto
    auto   (0)
    always (1)
    never  (2)
  defaultScriptingLanguage   string(64) = "text/javascript"
  mainWindow                 MainWindow

MainWindow ::= Sequence [onCreated, onOpened, onWillClose]
  templateURL?   string       [inline, cache]
  title?         string(80)
  icon?          string(255)  [alt, slice, base, size]
  font?          Font
  menuBar        MenuBar  Reference  [url]
  toolbars       Set<ToolBar>  Reference  [url]
  visible        bool = true

MenuBar ::= Extends Viewer [onAction]
  undockable     bool = false
  hideable       bool = false
  rearrangeable  bool = false

ToolBar ::= Extends Viewer
  location       enum = north
    north (1)
    south (2)
    east  (3)
    west  (4)
  row            int(0..3) = 0
  horizontal     bool = true
  detachable     bool = false
```

---

## Option D: Hybrid with Directives

Move events to `@events` directive, use modern declaration style.

```
Application ::= Sequence
  @events onAuthFailure, onChange

  name?                      string(32)
  lookAndFeel?               string(255)  [style]
  widgetHandlers             Set<NameValuePair>  Reference
  deferredLoadingMode        enum = auto
    auto   (0)
    always (1)
    never  (2)
  defaultScriptingLanguage   string(64) = "text/javascript"
  mainWindow                 MainWindow

MainWindow ::= Sequence
  @events onCreated, onOpened, onWillClose

  templateURL?   string       [inline, cache]
  title?         string(80)
  icon?          string(255)  [alt, slice, base, size]
  font?          Font
  menuBar        MenuBar  Reference  [url]
  toolbars       Set<ToolBar>  Reference  [url]
  visible        bool = true

MenuBar ::= Extends Viewer
  @events onAction

  undockable     bool = false
  hideable       bool = false
  rearrangeable  bool = false

ToolBar ::= Extends Viewer
  location       enum = north
    north (1)
    south (2)
    east  (3)
    west  (4)
  row            int(0..3) = 0
  horizontal     bool = true
  detachable     bool = false
```

---

## Option E: Rip-Native (@model style)

Schemas as Rip code, using `@model`, `@enum` directives.

```coffee
@model Application
  @events onAuthFailure, onChange

  name?:                     string, [0, 32]
  lookAndFeel?:              string, [0, 255]  [style]
  widgetHandlers:            Set<NameValuePair>  Reference
  deferredLoadingMode:       DeferredLoadingMode = auto
  defaultScriptingLanguage:  string = "text/javascript", [0, 64]
  mainWindow:                MainWindow

@enum DeferredLoadingMode
  auto   (0)
  always (1)
  never  (2)

@model MainWindow
  @events onCreated, onOpened, onWillClose

  templateURL?:  string  [inline, cache]
  title?:        string, [0, 80]
  icon?:         string, [0, 255]  [alt, slice, base, size]
  font?:         Font
  menuBar:       MenuBar  Reference  [url]
  toolbars:      Set<ToolBar>  Reference  [url]
  visible:       bool = true

@model MenuBar < Viewer
  @events onAction

  undockable:    bool = false
  hideable:      bool = false
  rearrangeable: bool = false

@model ToolBar < Viewer
  location:    Location = north
  row:         int = 0, [0, 3]
  horizontal:  bool = true
  detachable:  bool = false

@enum Location
  north (1)
  south (2)
  east  (3)
  west  (4)
```

---

## Option F: Maximum Compactness

Sigils everywhere, minimal keywords.

```
Application :: [onAuthFailure, onChange]
  name?             str(32)
  lookAndFeel?      str(255) [style]
  widgetHandlers    Set<NameValuePair> &
  deferredLoadingMode  = auto : auto(0) | always(1) | never(2)
  defaultScriptingLanguage  str(64) = "text/javascript"
  mainWindow        MainWindow

MainWindow :: [onCreated, onOpened, onWillClose]
  templateURL?  str [inline, cache]
  title?        str(80)
  icon?         str(255) [alt, slice, base, size]
  font?         Font
  menuBar       MenuBar & [url]
  toolbars      Set<ToolBar> & [url]
  visible       bool = true

MenuBar :: < Viewer [onAction]
  undockable    bool = false
  hideable      bool = false
  rearrangeable bool = false

ToolBar :: < Viewer
  location    = north : north(1) | south(2) | east(3) | west(4)
  row         int(0..3) = 0
  horizontal  bool = true
  detachable  bool = false
```

---

## Comparison Table

| Feature | SPOT | A | B | C | D | E | F |
|---------|------|---|---|---|---|---|---|
| Braces `{ }` | Yes | No | No | No | No | No | No |
| Commas | Yes | No | No | No | No | No | No |
| Colons | No | No | Yes | No | No | Yes | No |
| `::=` | Yes | Yes | Yes | Yes | Yes | No | `::` |
| `Optional` keyword | Yes | Yes | Yes | No | No | No | No |
| `?` modifier | No | No | No | Yes | Yes | Yes | Yes |
| `Default x` | Yes | Yes | Yes | No | No | No | No |
| `= x` default | No | No | No | Yes | Yes | Yes | Yes |
| `@events` directive | No | No | No | No | Yes | Yes | No |
| Inline enums | Yes | Yes | Yes | Yes | Yes | No | `|` syntax |
| Language-neutral | Yes | Yes | Yes | Yes | Yes | No | Maybe |

---

## The Fundamental Tradeoff

**Standalone Format (Options A-D, F)**
- Language-neutral: can generate TypeScript, Go, Rust, Python
- Schema is *data*, not *code*
- Clear separation of concerns
- Proven at scale (SPOT/Sage)

**Computable Rip Code (Option E)**
- Schemas are first-class values
- Can extend, compose, compute schemas at runtime
- Reactive schemas possible (`:=`)
- Tighter IDE/tooling integration
- But: tied to Rip

**Path Forward: Both?**
- `.schema` files with clean SPOT-like syntax (Options C or D)
- Rip parser produces S-expressions
- S-expressions can be:
  - Interpreted by runtime
  - Imported into Rip as values
  - Used to generate code for other languages

---

## Next Steps

1. Write real schemas in multiple styles
2. See which one is most pleasant to edit over time
3. Decide on standalone vs computable (or both)
4. Build parser for chosen syntax
5. Iterate based on real usage

---

## References

- `misc/Sage/` — Original SPOT/Sage files
- `misc/Sage/pc/sage-v1_0b2-dev-runtime/guru/ui_guru/sage.spot` — 2261 lines of real SPOT
- `misc/Sage/pc/sage-v1_0b2-dev-runtime/demos/medical/` — Medical app demo
