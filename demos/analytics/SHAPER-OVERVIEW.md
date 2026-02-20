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
