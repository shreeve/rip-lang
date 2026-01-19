# Medical Demo Application

This directory contains a complete, functional medical records application built entirely with **Sage SDF** (Sage Data Format) — demonstrating how the SPOT/RARE schema system enables building sophisticated healthcare applications through declarative UI definitions.

## Overview

The Medical Demo is a patient-centric clinical application featuring:
- **Patient Summary** — Cover sheet with problems, allergies, medications, vitals, labs, visits
- **Problems List** — Active/inactive conditions with filtering
- **Orders** — Hierarchical TreeTable of medication and nursing orders
- **Lab Results** — Multi-column lab grid with interactive charting
- **Documents** — Clinical document viewer with rich text editing
- **Reports** — Chart examples (line, bar, pie, area)
- **Expenses** — Grouped financial data with TreeTable

## Directory Structure

```
medical/
├── application.sdf          # Main application configuration (238 lines)
├── menu.sdf                 # Menu bar definition
├── infobar.sdf              # Patient demographics header
├── template.sdf             # Reusable widget templates
├── summary.sdf              # Patient summary/cover sheet
├── problems.sdf             # Problems list view
├── orders.sdf               # Orders TreeTable view
├── labs.sdf                 # Lab results with charting
├── documents.sdf            # Document management
├── reports.sdf              # Chart examples
├── expenses.sdf             # Financial data TreeTable
├── patient_lookup_window.sdf # Patient search dialog
├── documents/               # Document viewer components
│   ├── reader.sdf           # Document reader/editor (413 lines)
│   ├── compose.sdf          # Note composition
│   └── qref.sdf             # Quick reference panel
└── data/                    # Sample data files (24 files)
    ├── vitals.txt           # Vital signs
    ├── labs.txt             # Laboratory results
    ├── allergies.txt        # Allergy records
    ├── problems.txt         # Medical problems
    ├── orders.txt           # Clinical orders
    ├── medications.txt      # Medication list
    └── ... (18 more data files)
```

## Application Architecture

### Main Application (application.sdf)

The root `Application` object configures the entire application:

```sdf
Application {
  name: "Medical Demo"
  
  # Inline look-and-feel properties with OS-specific variants
  lookAndFeelPropertiesURL: << ... >> [inline="true"]
  
  # Application-wide icons
  resourceIconsURL: << ... >> [inline="true"]
  
  # Reusable action definitions
  actionItemsURL: << Set { ... } >> [inline="true"]
  
  # Main window configuration
  mainWindow {
    templateURL: "template.sdf" [cache="true"]
    title: "Sage - Medical App Demo"
    menuBar { dataURL: "menu.sdf" }
    statusBar { bgColor: "infobarColor" }
    
    viewer {
      GridPane {
        regions {
          { dataURL: "infobar.sdf" }  # Patient header
          { viewer { DocumentTabPane { tabs { ... } } } }  # Tab pane
        }
      }
    }
  }
}
```

### Key Features Demonstrated

#### 1. Inline Data & Scripts (Heredoc Syntax)

SDF supports inline data and scripts using `<<` heredoc syntax:

```sdf
scriptURL: << 
  function showGraph(table) {
    var row = table.getSelectedItem()
    var chart = labChart
    chart.clearChartData()
    // ... JavaScript code
  }
>> [inline="true"]

dataURL: <<
  Clinton, Bill
  Reagan, Ronald
  Washington, George
>> [inline="true"]
```

#### 2. Template System (template.sdf)

Reusable widget templates avoid repetition:

```sdf
TemplateContext {
  widgets {
    {
      Table {
        templateName: "prototypeTable"
        titleLocation: "top_left"
        alternatingHighlightType: "row"
        borders: "shadow" [thickness="7"]
        selectionMode: "single"
        boldColumnHeaders: "true"
      }
    }
    {
      TextField {
        templateName: "infobar.field"
        bgColor: "defaultBackground"
        editable: false
        borders { line_3d [cornerArc=6] }
      }
    }
  }
}
```

Templates are applied via `templateName: "prototypeTable"`.

#### 3. Dynamic Data Binding

Widgets bind to data via embedded references:

```sdf
Label {
  value: "{/ordersTable/%selectionValue[1]}"  # Reference to table selection
}

TextField {
  value: "{$$sage.intValue(sage.createDate('T').year-73)}"  # Computed value
}

collapsedTitle: "<html><b>Patient:</b> {$ucase(name)} - <b>Age:</b> {age}</html>"
```

#### 4. Relative Date/Time Values

The system supports relative date expressions:

```sdf
# T = today, Y = this year
dataURL: "data/orders.txt"  # Contains: T-3, T-180, Y-1

columns {
  { title: "<html>{$dateTime('T-9@0600','MMM dd, yyyy')}</html>" }
  { title: "<html>{$dateTime('T-8@0600','MMM dd, yyyy')}</html>" }
  # ... dynamic column headers based on current date
}
```

#### 5. Interactive Charting

The labs view includes live charting with selection-driven updates:

```sdf
Chart {
  name: "labChart"
  domainAxis {
    valueType: date_time_type
    subItems {
      { value: "T-9@0600" }
      { value: "T-8@0600" }
      # ... domain values
    }
  } [timeUnit="hour"]
  rangeAxis { valueType: integer_type; value: "Result" }
  plot {
    bgColor: "white"
    gridLine: auto [color="gray"]
    noDataMessage { value: "Please select a lab test..." }
  }
} [onChange="showGraph(widget)"]
```

#### 6. Hierarchical TreeTable

Orders display in a collapsible tree structure:

```sdf
TreeTable {
  name: "ordersTable"
  dataURL: "data/orders.txt" [riSeparator=","]
  columnSpanningAllowed: true
  expandAll: true
  columns {
    { title: "Order"; textWrapping: line }
    { title: "Start date"; valueType: date_time_type }
    { title: "Status" }
    # ...
  }
}
```

#### 7. Rich Text Document Editing

The document reader supports full rich text editing:

```sdf
DocumentPane {
  name: "noteField"
  editable: "true"
  cursorShown: "always"
  styleActions: "true"  # Enable formatting toolbar
  dataURL: "../data/documents_note.html"
}

# Formatting toolbar
ToolBar {
  widgets {
    { PushButton { name: "Sage.action.text.bold" } }
    { PushButton { name: "Sage.action.text.italic" } }
    { PushButton { name: "Sage.action.text.underline" } }
    # ...
  }
}
```

#### 8. Popup Widgets

Buttons can display inline popup content:

```sdf
PushButton {
  actionType: "popup_widget"
  popupWidget {
    Table {
      dataURL: "../data/documents_attachments.txt"
      columns {
        { headerIcon: "resource:Sage.icon.paperclip" }
        { title: "Date"; valueType: "date_time_type" }
        { title: "Description" }
      }
    }
  }
}
```

#### 9. OS-Specific Styling

Properties can target specific operating systems:

```sdf
lookAndFeelPropertiesURL: <<
  defaultBackground=ColorShade|#DCE0DC [os="windows"]
  defaultBackground=ColorShade|#E8E8E8 [os="os x,linux"]
  infobarColor=Color|#bcbcbc,#cccccc [os="os x"]
>> [inline="true"]
```

## Data Format

Sample data files use pipe-delimited format with inline styling:

```
# vitals.txt - Simple pipe-delimited
TEMP|99.5 F|T-1@13:45
PULSE|93|T-1@13:11
{tooltip: "Blood Pressure"}BP|150/110|T-1@16:08

# labs.txt - With inline cell formatting
CHLORIDE|106|103|{fgColor: abnormal}99 L|101|100-112|meq/L
GLUCOSE|{fgColor: abnormal}121 H|103|101|70-105|mg/dL

# orders.txt - Hierarchical with linked data
1,{columnSpan: -1; font-style: bold}Outpatient Medications
2,{linkedData: "Outpatient Medications"}|METFORMIN TAB...|T-180|Active
```

## Widget Types Used

| Widget | Purpose |
|--------|---------|
| `Application` | Root application configuration |
| `MainWindow` | Application window with menu, status bar |
| `GridPane` | Grid-based layout container |
| `SplitPane` | Resizable split regions |
| `TabPane` / `DocumentTabPane` | Tabbed interface |
| `Form` / `GroupBox` | Form containers with layout |
| `Table` / `TreeTable` | Data grids (flat and hierarchical) |
| `ListBox` | List display |
| `Chart` | Line, bar, pie, area charts |
| `DocumentPane` | Rich text editor |
| `TextField` / `TextArea` | Text input |
| `ComboBox` | Dropdown selection |
| `DateChooser` | Date picker |
| `CheckBox` | Boolean input |
| `PushButton` | Actions and menus |
| `Label` | Text display |
| `ToolBar` | Button groups |
| `Line` | Visual separator |
| `MenuBar` | Application menu |

## What This Demonstrates

1. **Declarative UI** — The entire application is defined in SDF without compiled code
2. **Data Binding** — Live binding between widgets and data sources
3. **Templating** — Reusable widget configurations
4. **Scripting** — Inline JavaScript for dynamic behavior
5. **Rich Components** — Tables, trees, charts, rich text editors
6. **Theming** — Platform-aware styling
7. **Modular Design** — Separate SDF files for each view
8. **Healthcare Domain** — Real clinical data structures

## Running the Application

This application requires the **Sage runtime** to execute. The SDF files are loaded and instantiated dynamically to create a fully functional medical records browser.

The demo showcases how complex healthcare applications — traditionally requiring thousands of lines of code — can be built declaratively using SPOT/RARE schema definitions and the SDF instance format.
