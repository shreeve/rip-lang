# Shaper Dashboard Engine — Pseudo-Code Overview

Source: `misc/shaper/server/core/get_dashboard.go` (2,069 lines of Go)

The Shaper dashboard engine is a SQL-to-dashboard compiler. It takes a blob of SQL,
runs each statement against DuckDB, and builds a JSON structure that tells a frontend
exactly what to render. Column types carry hidden rendering instructions via DuckDB's
UNION type system — the SQL itself *is* the dashboard definition.

---

## QueryDashboard — The Main Loop

```
function QueryDashboard(sqlContent, queryParams, variables):
    result = { sections: [] }
    nextLabel = ""
    hideNextContent = false
    skipNext = false
    nextMarkLines = []
    singleVars = extractSingleVars(variables)    # { name: "'value'" }
    multiVars  = extractMultiVars(variables)      # { name: ["a", "b"] }

    queries = splitSQL(stripComments(sqlContent))
    conn = openDuckDBConnection()

    for each sql in queries:
        if skipNext:
            skipNext = false
            continue

        # Inject current variable values before each query
        prefix = buildVarPrefix(singleVars, multiVars)
        rows = conn.execute(prefix + sql)

        if isSideEffect(sql):        # SET, ATTACH, CREATE TEMP, etc.
            continue

        if isLabel(columns, rows):    # Single LABEL column, single row
            nextLabel = rows[0][0]
            continue

        if isSectionTitle(columns, rows):
            if rows is empty:
                hideNextContent = true
            else:
                addHeaderSection(result, title: rows[0][0])
            continue

        if isReload(columns, rows):
            result.reloadAt = parseReloadInterval(rows)
            continue

        if isHeaderImage(columns, rows):
            result.headerImage = rows[0][0]
            continue

        if isFooterLink(columns, rows):
            result.footerLink = rows[0][0]
            continue

        if markLines = getMarkLines(columns, rows):
            nextMarkLines += markLines
            continue

        # --- This is a real displayable query ---

        renderInfo = getRenderInfo(columns, rows, nextLabel, nextMarkLines)

        if renderInfo.download in ["csv", "xlsx"]:
            skipNext = true    # Next query is the download data source

        # Map column types and assign tags
        for each column:
            column.type = mapDBType(column.dbType)    # VARCHAR→string, DOUBLE→number, etc.
            column.tag  = mapTag(column.index, renderInfo)  # "index", "value", "category", etc.
            if column.tag == "download":
                rows[0][column.index] = buildDownloadURL(dashboardId, queryIndex, filename)

        # Collect variable values from controls
        collectVars(singleVars, multiVars, renderInfo.type, queryParams, columns, rows)

        # Transform cell values to JSON-safe types
        for each cell in rows:
            cell = unwrapUnion(cell)
            cell = convertTimestamp(cell)    # time.Time → milliseconds
            cell = convertNaN(cell)          # NaN → null
            cell = convertDecimal(cell)      # Decimal → float
            cell = convertInterval(cell)     # Interval → milliseconds
            cell = convertUUID(cell)         # bytes → "8-4-4-4-12" string
            cell = convertMap(cell)          # DuckDB Map → plain object

        # Place into correct section
        if renderInfo.type in [dropdown, dropdownMulti, button, datepicker, daterangePicker, input]:
            addToSection(result, type: "header", query)
        else if not hideNextContent:
            addToSection(result, type: "content", query)

        nextLabel = ""
        nextMarkLines = []

    return result
```

## getRenderInfo — Chart Type Detection

```
function getRenderInfo(columns, rows, label, markLines):
    xaxis     = findColumnByTag(columns, "XAXIS")
    yaxis     = findColumnByTag(columns, "YAXIS")
    linechart = findColumnByTag(columns, "LINECHART") or findColumnByTag(columns, "LINECHART_PERCENT")
    barchart  = findColumnByTag(columns, "BARCHART") or findColumnByTag(columns, "BARCHART_PERCENT")
    stacked   = findColumnByTag(columns, "BARCHART_STACKED") or findColumnByTag(columns, "BARCHART_STACKED_PERCENT")
    category  = findColumnByTag(columns, "BARCHART_CATEGORY") or findColumnByTag(columns, "CATEGORY")
    color     = findColumnByTag(columns, "COLOR") or chart-specific color tag

    # --- Charts ---

    if linechart and xaxis:
        return { type: "linechart", indexAxis: xaxis, value: linechart, category?, color?, markLines }

    if barchart and xaxis:
        return { type: "barchartHorizontal", indexAxis: xaxis, value: barchart, category?, color?, markLines }

    if stacked and xaxis and category:
        return { type: "barchartHorizontalStacked", indexAxis: xaxis, value: stacked, category, color?, markLines }

    if barchart and yaxis:
        return { type: "barchartVertical", indexAxis: yaxis, value: barchart, category?, color?, markLines }

    if stacked and yaxis and category:
        return { type: "barchartVerticalStacked", indexAxis: yaxis, value: stacked, category, color?, markLines }

    # --- Controls ---

    if findColumnByTag("DROPDOWN"):
        return { type: "dropdown", value: dropdown, label?, hint? }

    if findColumnByTag("DROPDOWN_MULTI"):
        return { type: "dropdownMulti", value: dropdownMulti, label?, hint? }

    if findColumnByTag("DATEPICKER"):
        return { type: "datepicker", value: datepicker }

    if findColumnByTag("DATEPICKER_FROM") and findColumnByTag("DATEPICKER_TO"):
        return { type: "daterangePicker", from: from, to: to }

    # --- Downloads ---

    if findColumnByTag("DOWNLOAD_CSV"):  return { type: "button", download: "csv" }
    if findColumnByTag("DOWNLOAD_XLSX"): return { type: "button", download: "xlsx" }
    if findColumnByTag("DOWNLOAD_PDF"):  return { type: "button", download: "pdf" }

    # --- Special types ---

    if findColumnByTag("PLACEHOLDER"):
        return { type: "placeholder" }

    if findColumnByTag("GAUGE") and rows.length == 1:
        range  = parseArray(row, "RANGE")  or autoRange(gaugeValue)
        labels = parseArray(row, "LABELS") or []
        colors = parseArray(row, "COLORS") or []
        categories = zipRangeSegments(range, labels, colors)
        return { type: "gauge", value: gauge, gaugeCategories: categories }

    if findColumnByTag("PIECHART" or "DONUTCHART"):
        return { type: "piechart" or "donutchart", value: pie, category?, color? }

    if findColumnByTag("BOXPLOT") and xaxis:
        return { type: "boxplot", indexAxis: xaxis, value: boxplot, color?, markLines }

    if findColumnByTag("INPUT") and rows.length == 1:
        return { type: "input", hint: input }

    # --- Value cards ---

    if rows.length == 1 and columns.length == 1:
        return { type: "value" }

    if rows.length == 1 and columns.length == 2 and findColumnByTag("COMPARE"):
        return { type: "value", compare: compareIndex }

    # --- Fallback ---

    return { type: "table", trendIndices: findAllColumnsByTag("TREND") }
```

## collectVars — Extract Control Values

```
function collectVars(singleVars, multiVars, renderType, queryParams, columns, rows):

    if renderType == "dropdown":
        varName = column where tag == "value" → column.name
        selected = queryParams[varName]
        if selected and selected in rows:
            singleVars[varName] = quote(selected)
        else:
            singleVars[varName] = quote(rows[0].value)    # default to first option

    if renderType == "dropdownMulti":
        varName = column where tag == "value" → column.name
        selected = queryParams.getAll(varName)
        selected = selected.filter(s => s exists in rows)  # validate
        if no selection was provided:
            selected = all row values                       # default to all
        multiVars[varName] = selected

    if renderType == "datepicker":
        varName = column where tag == "default" → column.name
        date = queryParams[varName] or rows[0].defaultDate
        singleVars[varName] = "DATE '" + date + "'"

    if renderType == "daterangePicker":
        fromVar = column where tag == "defaultFrom" → column.name
        toVar   = column where tag == "defaultTo"   → column.name
        fromDate = queryParams[fromVar] or rows[0].defaultFrom
        toDate   = queryParams[toVar]   or rows[0].defaultTo
        singleVars[fromVar] = "TIMESTAMP '" + fromDate + "'"
        singleVars[toVar]   = "TIMESTAMP '" + toDate + " 23:59:59.999999'"

    if renderType == "input":
        varName = column where tag == "hint" → column.name
        value = queryParams[varName]
        if value:
            singleVars[varName] = quote(value)
```

## buildVarPrefix — Inject Variables Into SQL

```
function buildVarPrefix(singleVars, multiVars):
    prefix = ""
    cleanup = ""
    for name, value in singleVars:
        prefix  += 'SET VARIABLE "name" = value;\n'
        cleanup += 'RESET VARIABLE "name";\n'
    for name, values in multiVars:
        list = values.map(v => "'" + escape(v) + "'").join(", ")
        prefix  += 'SET VARIABLE "name" = [list]::VARCHAR[];\n'
        cleanup += 'RESET VARIABLE "name";\n'
    return prefix, cleanup
```

## mapDBType — Database Type to Frontend Type

```
function mapDBType(dbTypeName, rows, columnIndex):
    match dbTypeName:
        "BOOLEAN"                          → "boolean"
        "VARCHAR"                          → sniff rows for JSON → "object" | "array" | "string"
        "DOUBLE", "FLOAT", "INTEGER", ... → "number"
        "DECIMAL(x,y)"                    → "number"
        "DATE"                            → "date"
        "TIMESTAMP*"                      → scanTimestampResolution(rows)
                                             → "year" | "month" | "date" | "hour" | "timestamp"
        "INTERVAL"                        → "duration"
        "TIME"                            → "time"
        "JSON"                            → "object"
        "UUID"                            → "string"
        "BLOB", "ENUM"                    → "string"
        "VARCHAR[]"                       → "stringArray"
        "MAP(VARCHAR, VARCHAR)"           → "object"
        "STRUCT(...)"                     → "object"
        custom UNION type                 → "chart" (number) | "axis" (detect from values)
```

## isSideEffect — Should This Query Be Silent?

```
function isSideEffect(sql):
    normalized = uppercase(trim(sql))
    return normalized starts with any of:
        "ATTACH", "USE", "SET", "BEGIN", "COMMIT", "ROLLBACK", "ABORT", "CALL",
        "CREATE TEMPORARY TABLE", "CREATE TEMP VIEW",
        "CREATE OR REPLACE TEMP MACRO", ...
```

---

## Output Structure

The result is a `GetResult` JSON structure:

```json
{
  "name": "Dashboard Title",
  "sections": [
    {
      "type": "header",
      "title": "Filters",
      "queries": [
        { "render": { "type": "dropdown" }, "columns": [...], "rows": [...] },
        { "render": { "type": "datepicker" }, "columns": [...], "rows": [...] }
      ]
    },
    {
      "type": "content",
      "title": "Revenue",
      "queries": [
        { "render": { "type": "linechart" }, "columns": [...], "rows": [...] },
        { "render": { "type": "value" }, "columns": [...], "rows": [...] }
      ]
    }
  ],
  "minTimeValue": 1706745600000,
  "maxTimeValue": 1709251200000
}
```

The frontend receives this and renders each query according to its `render.type`,
using `columns[].tag` to know which column is the x-axis, which is the value,
which is the category, etc.

---

## Pipeline

```
SQL (with UNION-typed columns)
  → Go server executes against DuckDB
  → Go server inspects column types, transforms values
  → JSON dashboard spec (GetResult)
  → Shaper frontend reads the spec
  → Frontend maps each query to an ECharts component
  → ECharts renders the chart
```

## Notes

Everything else in the 2,069 lines is Go type assertions, DuckDB Union unwrapping,
error propagation, and the duplicated `collectDownloadLinkParams` (which is literally
`collectVars` copy-pasted but writing to a different map).

---
---

# JSON Output Specification

This section documents every field in the JSON response produced by
`QueryDashboard`. The response is serialized via Go's `encoding/json`
with `json` struct tags controlling field names and omission.

---

## Top Level — `GetResult`

```json
{
  "name":         "Dashboard Title",
  "visibility":   "public",
  "sections":     [ ... ],
  "minTimeValue": 1706745600000,
  "maxTimeValue": 1709251200000,
  "reloadAt":     1709337600000,
  "headerImage":  "https://example.com/logo.png",
  "footerLink":   "https://example.com"
}
```

| Field          | Type       | Required | Description |
|----------------|------------|----------|-------------|
| `name`         | string     | Always   | Dashboard title. Taken from the first section's `title` if one exists, otherwise `""`. |
| `visibility`   | string     | No       | Omitted if null. Set from the dashboard's stored visibility (e.g., `"public"`, `"private"`). |
| `sections`     | Section[]  | Always   | Array of sections. May be empty `[]` if all queries were side-effects or metadata. |
| `minTimeValue` | integer    | Always   | Smallest timestamp (ms since epoch) seen in any column tagged `"index"` with a time-based type. Defaults to `9223372036854775807` (max int64) if no time data exists. |
| `maxTimeValue` | integer    | Always   | Largest timestamp (ms since epoch) seen in any `"index"` time column. Defaults to `0` if no time data exists. |
| `reloadAt`     | integer    | Always   | Milliseconds since epoch when the dashboard should auto-reload. `0` means no auto-reload. Computed from a `RELOAD` query returning either a future timestamp or an interval added to `now()`. |
| `headerImage`  | string     | No       | Omitted if null. URL of an image to display in the dashboard header. Set by a `HEADER_IMAGE` query. |
| `footerLink`   | string     | No       | Omitted if null. URL for a link in the dashboard footer. Set by a `FOOTER_LINK` query. |

---

## Section

Sections organize queries into visual groups. There are two types:

- **`"header"`** — Contains interactive controls (dropdowns, date pickers, inputs, buttons). Rendered as a toolbar/filter bar.
- **`"content"`** — Contains visualizations (charts, tables, values, gauges). Rendered as the dashboard body.

Sections are created implicitly as queries are processed. Adjacent queries of the
same section type are grouped into the same section. A `SECTION` title query forces
a new section boundary.

```json
{
  "title":   "Revenue Overview",
  "type":    "header",
  "queries": [ ... ]
}
```

| Field     | Type     | Required | Description |
|-----------|----------|----------|-------------|
| `title`   | string   | No       | Null if no title was set via a `SECTION` query. When set, the frontend renders it as a section heading. The first section's title also becomes `GetResult.name`. |
| `type`    | string   | Always   | Either `"header"` or `"content"`. |
| `queries` | Query[]  | Always   | One or more query results belonging to this section. |

### Section Type Assignment

A query is placed in a `"header"` section if its render type is one of:

- `"dropdown"`
- `"dropdownMulti"`
- `"button"` (download buttons)
- `"datepicker"`
- `"daterangePicker"`
- `"input"`

Everything else goes into a `"content"` section.

### Section Visibility

When a `SECTION` query returns zero rows, the next content section is hidden
entirely — its queries still execute (for side effects and variable collection)
but the section is not added to the output.

---

## Query

Each query represents one executed SQL statement and its results, annotated with
rendering instructions.

```json
{
  "render": {
    "type":  "linechart",
    "label": "Monthly Revenue"
  },
  "columns": [
    { "name": "month",   "type": "string", "nullable": false, "tag": "index" },
    { "name": "revenue", "type": "number", "nullable": false, "tag": "value" }
  ],
  "rows": [
    ["Jan", 42000],
    ["Feb", 48000],
    ["Mar", 51000]
  ]
}
```

| Field     | Type      | Required | Description |
|-----------|-----------|----------|-------------|
| `render`  | Render    | Always   | Describes how to visualize this query. |
| `columns` | Column[]  | Always   | Ordered column metadata. Length matches the width of each row. |
| `rows`    | any[][]   | Always   | Array of rows. Each row is an array of cell values aligned to `columns`. |

---

## Render

The rendering configuration for a query. Tells the frontend which component to
instantiate and provides chart-specific metadata.

```json
{
  "type":            "gauge",
  "label":           "CPU Usage",
  "gaugeCategories": [ ... ],
  "markLines":       [ ... ]
}
```

| Field              | Type              | Required | Description |
|--------------------|-------------------|----------|-------------|
| `type`             | string            | Always   | The visualization type. See **Render Types** below. |
| `label`            | string            | No       | Null if no label. Set by a preceding `LABEL` query. Used as the chart/card title. |
| `gaugeCategories`  | GaugeCategory[]   | No       | Omitted unless `type` is `"gauge"`. Defines the gauge's range segments. |
| `markLines`        | MarkLine[]        | No       | Omitted if empty. Reference lines overlaid on charts. Set by preceding `XLINE`/`YLINE` queries. |

### Render Types

All possible values of `render.type`:

| Type                          | Section   | Description |
|-------------------------------|-----------|-------------|
| `"linechart"`                 | content   | Line chart. Requires columns tagged `"index"` (x-axis) and `"value"` (y-axis). Optionally `"category"` to pivot into multiple series and `"color"` for per-series colors. |
| `"barchartHorizontal"`        | content   | Horizontal bar chart. `"index"` on y-axis (categories), `"value"` on x-axis (lengths). Optional `"category"` for grouped bars, `"color"` for bar colors. |
| `"barchartHorizontalStacked"` | content   | Stacked horizontal bar chart. Requires `"index"`, `"value"`, and `"category"`. Optional `"color"`. |
| `"barchartVertical"`          | content   | Vertical bar chart. `"index"` on x-axis, `"value"` on y-axis. Optional `"category"` and `"color"`. |
| `"barchartVerticalStacked"`   | content   | Stacked vertical bar chart. Requires `"index"`, `"value"`, and `"category"`. Optional `"color"`. |
| `"piechart"`                  | content   | Pie chart. `"value"` for slice sizes. Optional `"category"` for slice labels, `"color"` for slice colors. |
| `"donutchart"`                | content   | Donut chart. Same structure as piechart. |
| `"gauge"`                     | content   | Gauge meter. Single-row result. `"value"` column for the needle value. `gaugeCategories` defines segments. |
| `"boxplot"`                   | content   | Box plot. `"index"` for categories, `"value"` for boxplot stats (struct with min, q1, q2, q3, max, outliers). Optional `"color"`. |
| `"value"`                     | content   | KPI value card. Single row. All columns tagged `"value"` except one optionally tagged `"compare"` for delta display. |
| `"table"`                     | content   | Data table. Fallback when no chart type is detected. Columns may have `"trend"` tags for inline sparklines. |
| `"placeholder"`               | content   | Empty placeholder. Reserves visual space in the layout. |
| `"dropdown"`                  | header    | Single-select dropdown filter. `"value"` column for option values, optional `"label"` for display text. |
| `"dropdownMulti"`             | header    | Multi-select dropdown. `"value"` for option values, optional `"label"` and `"hint"`. |
| `"datepicker"`                | header    | Single date picker. `"default"` column for the initial date value. |
| `"daterangePicker"`           | header    | Date range picker. `"defaultFrom"` and `"defaultTo"` columns for initial range. |
| `"input"`                     | header    | Text input field. `"hint"` column for placeholder text. |
| `"button"`                    | header    | Download button. `"download"` column contains the generated download URL. |

---

## Column

Metadata for a single column in the query result.

```json
{
  "name":     "revenue",
  "type":     "number",
  "nullable": true,
  "tag":      "value"
}
```

| Field      | Type    | Required | Description |
|------------|---------|----------|-------------|
| `name`     | string  | Always   | The column name from the SQL query (the `AS` alias or the original column name). |
| `type`     | string  | Always   | The frontend data type. See **Column Types** below. |
| `nullable` | boolean | Always   | Whether the column can contain null values. |
| `tag`      | string  | Always   | The column's semantic role. See **Column Tags** below. Empty string `""` if no special role. |

### Column Types

All possible values of `column.type`, derived from the database type:

| Column Type     | Source DB Types                                     | JSON Cell Values |
|-----------------|-----------------------------------------------------|------------------|
| `"boolean"`     | `BOOLEAN`                                           | `true`, `false`, `null` |
| `"string"`      | `VARCHAR`, `UUID`, `BLOB`, `ENUM`                   | `"text"`, `null` |
| `"number"`      | `DOUBLE`, `FLOAT`, `INTEGER`, `BIGINT`, `SMALLINT`, `TINYINT`, `HUGEINT`, all unsigned variants, `DECIMAL(x,y)` | `42000`, `3.14`, `null` |
| `"date"`        | `DATE`, or `TIMESTAMP` where all values have day precision | `1706745600000` (ms since epoch), `null` |
| `"year"`        | `TIMESTAMP` where all values are Jan 1              | `1704067200000` (ms since epoch), `null` |
| `"month"`       | `TIMESTAMP` where all values are 1st of month       | `1706745600000` (ms since epoch), `null` |
| `"hour"`        | `TIMESTAMP` where all values are on the hour        | `1706781600000` (ms since epoch), `null` |
| `"timestamp"`   | `TIMESTAMP`, `TIMESTAMP_NS`, `TIMESTAMP_MS`, `TIMESTAMP_S`, `TIMESTAMPTZ` (with sub-hour precision) | `1706781623000` (ms since epoch), `null` |
| `"time"`        | `TIME`, or `TIMESTAMP` where all values lack date components | `43200000` (ms since midnight), `null` |
| `"duration"`    | `INTERVAL`                                          | `3600000` (ms), `null` |
| `"object"`      | `JSON`, `MAP(VARCHAR, VARCHAR)`, `STRUCT(...)`, or `VARCHAR` containing a JSON object | `{ "key": "value" }`, `null` |
| `"array"`       | `VARCHAR` containing a JSON array                   | Not typically in output rows (detected during type mapping) |
| `"stringArray"` | `VARCHAR[]`                                         | `"a, b, c"` (joined with `", "`), `null` |
| `"percent"`     | Custom UNION types ending in `_PERCENT`             | `0.75` (as a number, where 1.0 = 100%), `null` |

**Timestamp resolution detection:** When the database type is `TIMESTAMP`, the engine
scans all non-null values to determine the most precise granularity present in the data.
If every timestamp is midnight on January 1st → `"year"`. If every timestamp is
midnight on the 1st of each month → `"month"`. And so on through `"date"`, `"hour"`,
and `"timestamp"`. This lets the frontend format axis labels appropriately
(e.g., "2024" vs. "Jan 2024" vs. "Jan 15" vs. "14:00" vs. "Jan 15 14:23").

### Column Tags

All possible values of `column.tag`, determined by the render type and column position:

| Tag             | Used With Render Types                              | Meaning |
|-----------------|-----------------------------------------------------|---------|
| `""`            | Any                                                 | No special role. For tables, these are normal data columns. |
| `"index"`       | `linechart`, `barchartHorizontal*`, `barchartVertical*`, `boxplot`, `piechart`, `donutchart` | The independent axis (x-axis for line/horizontal bar, y-axis for vertical bar, categories for pie). This is what the chart is "indexed by." |
| `"value"`       | `linechart`, `barchart*`, `piechart`, `donutchart`, `gauge`, `value`, `dropdown`, `dropdownMulti` | The measured quantity. For charts: the dependent axis values. For controls: the option values. For value cards: the displayed metric. |
| `"category"`    | `linechart`, `barchart*`, `piechart`, `donutchart`  | Groups data into multiple series/slices. Each unique category value becomes a separate line, bar group, or pie slice. |
| `"color"`       | `linechart`, `barchart*`, `piechart`, `boxplot`     | Per-row or per-series color override. Cell values are CSS color strings (e.g., `"#ff6600"`, `"red"`). |
| `"label"`       | `dropdown`, `dropdownMulti`                         | Display text for dropdown options (when different from the value). |
| `"hint"`        | `dropdownMulti`, `input`                            | Placeholder or hint text. For dropdowns: supplementary text shown alongside options. For inputs: the placeholder text. |
| `"default"`     | `datepicker`                                        | The default/initial date value. |
| `"defaultFrom"` | `daterangePicker`                                   | The default start date. |
| `"defaultTo"`   | `daterangePicker`                                   | The default end date. |
| `"download"`    | `button`                                            | The cell value is replaced with a generated download URL path (e.g., `"api/dashboards/{id}/query/{n}/filename.csv"`). |
| `"compare"`     | `value`                                             | A comparison value for delta display on KPI cards (e.g., previous period's value, shown as an up/down arrow with percentage change). |
| `"trend"`       | `table`                                             | Column contains numeric values rendered as an inline sparkline within the table cell. Multiple columns can have this tag. |

---

## GaugeCategory

Defines a colored segment of a gauge meter's arc. The gauge is divided into
contiguous segments where each segment's `from` equals the previous segment's `to`.

```json
{
  "from":  0,
  "to":    50,
  "label": "Low",
  "color": "#52c41a"
}
```

| Field   | Type   | Required | Description |
|---------|--------|----------|-------------|
| `from`  | number | Always   | Start of this segment on the gauge scale. |
| `to`    | number | Always   | End of this segment on the gauge scale. |
| `label` | string | No       | Omitted if empty. Human-readable name for this range (e.g., "Low", "Medium", "High"). |
| `color` | string | No       | Omitted if empty. CSS color for this segment (e.g., `"#52c41a"`, `"red"`). |

**Auto-ranging:** If the SQL provides fewer than 2 unique range values, the engine
auto-generates a range:
- If a single positive range value is given and the gauge value is non-negative: `[0, rangeValue]`
- If the value is an interval (duration): `[0, 3600000]` (one hour in ms)
- If a percent gauge with value in 0..1: `[0, 1]`
- Otherwise: `[0, nextPowerOf10]` or `[-nextPowerOf10, nextPowerOf10]` for negative values

---

## MarkLine

A reference line drawn on a chart at a fixed position. Set by `XLINE` or `YLINE`
queries that precede the chart query.

```json
{
  "isYAxis": true,
  "value":   50000,
  "label":   "Target"
}
```

| Field     | Type          | Required | Description |
|-----------|---------------|----------|-------------|
| `isYAxis` | boolean       | Always   | `true` if this is a horizontal line across the chart (at a Y value). `false` for a vertical line (at an X value). |
| `value`   | string/number | Always   | The position on the axis. Can be a string (for categorical axes), a number, or an integer representing milliseconds since epoch (for time axes) or milliseconds since midnight (for time-of-day axes). |
| `label`   | string        | No       | Omitted if empty. Text label displayed alongside the reference line. |

---

## Row Cell Values

After transformation, every cell in `rows` is one of these JSON types:

| JSON Type | When Used | Example |
|-----------|-----------|---------|
| `null`    | Any nullable column with a null value, or `NaN` floats | `null` |
| `string`  | String columns, UUID columns, string arrays (joined), download URLs | `"Acme Corp"` |
| `number` (float) | Number columns (integers become floats in JSON) | `42000`, `3.14` |
| `number` (integer) | Timestamps (ms since epoch), time-of-day (ms since midnight), durations (ms) | `1706745600000` |
| `boolean` | Boolean columns | `true` |
| `object`  | JSON objects, MAP types, STRUCT types | `{ "key": "value" }` |

**Key transformations applied to cell values:**

- **Timestamps** → milliseconds since epoch (int64). The column's `type` field tells
  the frontend what resolution to format at (`"year"`, `"month"`, `"date"`, `"hour"`,
  `"timestamp"`).
- **Time-of-day** → milliseconds since midnight (int64). Column type is `"time"`.
- **Durations/Intervals** → total milliseconds (int64). Column type is `"duration"`.
  Calculated as `micros/1000 + days*86400000 + months*2592000000`.
- **Decimals** → float64. No precision loss for display purposes.
- **NaN/Inf** → `null`. Prevents JSON serialization errors.
- **UUIDs** → `"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"` formatted string.
- **String arrays** → comma-joined string: `"a, b, c"`.
- **DuckDB Maps/Structs** → recursively converted to plain JSON objects.
- **Download columns** → cell value replaced with a URL path string.

---

## Complete Example

A dashboard with a dropdown filter, a KPI value, and a line chart:

```json
{
  "name": "Sales Dashboard",
  "sections": [
    {
      "title": null,
      "type": "header",
      "queries": [
        {
          "render": { "type": "dropdown", "label": null },
          "columns": [
            { "name": "region",      "type": "string", "nullable": false, "tag": "value" },
            { "name": "region_name", "type": "string", "nullable": false, "tag": "label" }
          ],
          "rows": [
            ["us", "United States"],
            ["eu", "Europe"],
            ["ap", "Asia Pacific"]
          ]
        }
      ]
    },
    {
      "title": "Overview",
      "type": "content",
      "queries": [
        {
          "render": { "type": "value", "label": "Total Revenue" },
          "columns": [
            { "name": "total", "type": "number", "nullable": false, "tag": "value" }
          ],
          "rows": [
            [758000]
          ]
        },
        {
          "render": { "type": "value", "label": "Growth" },
          "columns": [
            { "name": "current", "type": "number", "nullable": false, "tag": "value" },
            { "name": "previous", "type": "number", "nullable": false, "tag": "compare" }
          ],
          "rows": [
            [85000, 71000]
          ]
        },
        {
          "render": {
            "type": "linechart",
            "label": "Monthly Revenue",
            "markLines": [
              { "isYAxis": true, "value": 60000, "label": "Target" }
            ]
          },
          "columns": [
            { "name": "month",   "type": "date",   "nullable": false, "tag": "index" },
            { "name": "revenue", "type": "number", "nullable": false, "tag": "value" },
            { "name": "product", "type": "string", "nullable": false, "tag": "category" }
          ],
          "rows": [
            [1704067200000, 42000, "Product A"],
            [1704067200000, 18000, "Product B"],
            [1706745600000, 48000, "Product A"],
            [1706745600000, 21000, "Product B"],
            [1709251200000, 51000, "Product A"],
            [1709251200000, 24000, "Product B"]
          ]
        }
      ]
    }
  ],
  "minTimeValue": 1704067200000,
  "maxTimeValue": 1709251200000,
  "reloadAt": 0
}
```

In this example:
- The **dropdown** provides a `region` variable. The frontend renders a select control.
  The selected value is sent as a query parameter on the next request, and the Go
  engine injects `SET VARIABLE "region" = 'us';` before each subsequent SQL statement.
- The first **value** query has one column, one row — displayed as a large KPI number.
- The second **value** query has two columns with a `"compare"` tag — displayed as a
  KPI with a delta indicator (e.g., "85,000 ▲ 19.7%").
- The **linechart** has a `"category"` column (`product`), so the flat rows are pivoted
  into two series ("Product A" and "Product B"), each plotted as a separate line. The
  `"index"` column (`month`) provides the x-axis, and `"value"` (`revenue`) provides
  the y-axis. A horizontal mark line is drawn at y=60,000 labeled "Target".

---

## Gauge Example

A gauge with custom segments:

```json
{
  "render": {
    "type": "gauge",
    "label": "CPU Usage",
    "gaugeCategories": [
      { "from": 0,  "to": 60,  "label": "Normal", "color": "#52c41a" },
      { "from": 60, "to": 85,  "label": "Warning", "color": "#faad14" },
      { "from": 85, "to": 100, "label": "Critical", "color": "#f5222d" }
    ]
  },
  "columns": [
    { "name": "cpu", "type": "number", "nullable": false, "tag": "value" }
  ],
  "rows": [
    [73.5]
  ]
}
```

The gauge renders a semicircular meter with three colored segments. The needle
points to 73.5, which falls in the "Warning" (yellow) zone.

---

## Download Button Example

```json
{
  "render": { "type": "button", "label": "Export Data" },
  "columns": [
    { "name": "filename", "type": "string", "nullable": false, "tag": "download" }
  ],
  "rows": [
    ["api/dashboards/sales-q1/query/5/sales-report.csv?region=us"]
  ]
}
```

The cell value is a server-generated URL path. The frontend renders a button that,
when clicked, fetches this URL to trigger the download. The next SQL statement in the
dashboard file (index 5) contains the actual data query — the server re-executes it
with the same variables when the download URL is requested.

---

## Table with Trend Sparklines

```json
{
  "render": { "type": "table", "label": "Regional Performance" },
  "columns": [
    { "name": "region",   "type": "string", "nullable": false, "tag": "" },
    { "name": "revenue",  "type": "number", "nullable": false, "tag": "" },
    { "name": "trend_q1", "type": "number", "nullable": true,  "tag": "trend" },
    { "name": "trend_q2", "type": "number", "nullable": true,  "tag": "trend" },
    { "name": "trend_q3", "type": "number", "nullable": true,  "tag": "trend" },
    { "name": "trend_q4", "type": "number", "nullable": true,  "tag": "trend" }
  ],
  "rows": [
    ["North America", 340000, 75000, 82000, 88000, 95000],
    ["Europe",        215000, 48000, 51000, 55000, 61000],
    ["Asia Pacific",  180000, 40000, 44000, 47000, 49000]
  ]
}
```

Columns tagged `"trend"` are grouped together and rendered as a tiny inline sparkline
within each table row, rather than as separate numeric cells.
