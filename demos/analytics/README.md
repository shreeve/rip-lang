# Rip Analytics Demo

SQL-driven analytics dashboard powered by DuckDB, ECharts, and Rip UI.
Write SQL with annotated column aliases, and the dashboard automatically renders
the right chart for each query — no JavaScript glue code, no chart configuration.

## Quick Start

```bash
# Terminal 1: Start DuckDB server (in-memory)
rip-db :memory:

# Terminal 2: Start the demo app
cd demos/analytics
rip api/index.rip
```

Open **http://localhost:3000** — the dashboard seeds sample data on first load and
renders value cards, line charts, bar charts, a pie chart, and a data table.

## The Core Idea: SQL as the Dashboard Language

Instead of writing chart configurations in JavaScript, you write SQL. Column aliases
encode what kind of visualization each column should use:

```sql
-- This renders a line chart with Month on the x-axis and three line series
SELECT
  month    AS "xaxis:Month",
  revenue  AS "linechart:Revenue",
  costs    AS "linechart:Costs",
  profit   AS "linechart:Profit"
FROM monthly_sales
```

The convention is `"type:Label"` in the column alias:
- The **type** prefix tells the Dashboard which chart component to use
- The **label** suffix becomes the display name (axis label, legend entry, card title)
- Columns without a `:` prefix are treated as plain table data

A dashboard is just a sequence of SQL queries. Each query produces a visualization.
The order of queries defines the layout:

```sql
-- 1. KPI cards (one query per card)
SELECT sum(revenue) AS "value:Total Revenue", 'Total Revenue' AS "label:Label" FROM sales
SELECT count(*)     AS "value:Orders",        'Orders'        AS "label:Label" FROM orders

-- 2. Line chart (time series)
SELECT month AS "xaxis:Month", revenue AS "linechart:Revenue", costs AS "linechart:Costs"
FROM monthly_sales

-- 3. Bar chart (comparisons)
SELECT region AS "xaxis:Region", sales AS "barchart:Sales" FROM regional_sales

-- 4. Pie chart (proportions)
SELECT product AS "category:Product", amount AS "piechart:Amount" FROM products

-- 5. Data table (plain columns, no annotations)
SELECT id, customer, amount, status FROM orders ORDER BY order_date DESC
```

### Supported Annotation Types

| Column prefix | Renders as | Example |
|---|---|---|
| `value:` | KPI value card | `sum(revenue) AS "value:Total Revenue"` |
| `label:` | Card label (paired with `value:`) | `'Revenue' AS "label:Label"` |
| `xaxis:` | X-axis for line/bar charts | `month AS "xaxis:Month"` |
| `linechart:` | Line series (needs `xaxis:`) | `revenue AS "linechart:Revenue"` |
| `barchart:` | Bar series (needs `xaxis:`) | `revenue AS "barchart:Revenue"` |
| `piechart:` | Pie/donut slice (needs `category:`) | `amount AS "piechart:Amount"` |
| `category:` | Pie chart category labels | `product AS "category:Product"` |
| *(none)* | Data table column | `id, customer, amount` |

### Classification Logic

The `Dashboard` component inspects the column prefixes to decide how to render each
query result:

1. Any column has `value:` → **ValueCard**
2. Has `xaxis:` + `linechart:` → **LineChart**
3. Has `xaxis:` + `barchart:` → **BarChart**
4. Has `piechart:` + (`category:` or `xaxis:`) → **PieChart**
5. No recognized prefixes → **DataTable** (fallback)

## Architecture

```
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│   Rip UI    │  fetch   │  Demo API   │  proxy   │   rip-db    │
│  (Browser)  │─────────▶│  (port 3000)│─────────▶│ (port 4213) │
│  + ECharts  │  /sql    │  rip-api    │  /sql    │  Bun FFI    │
└─────────────┘          └─────────────┘          └─────────────┘
                                                        │
                                                   DuckDB (native)
```

The design is deliberately minimal:

- **No message broker** — queries go directly to DuckDB via HTTP
- **No separate state store** — DuckDB is the single source of truth
- **No build step** — Rip UI compiles components in the browser
- **No chart library configuration** — column annotations drive rendering
- **No React, no bundler** — Rip components all the way down

The demo server (`api/index.rip`) does three things:
1. **Serves the Rip UI client** — `index.html`, components, and the Rip UI runtime
2. **Proxies SQL** — forwards `POST /sql` to rip-db and returns the JSON result
3. **Seeds sample data** — `POST /seed` creates tables with demo data on first load

The browser never talks to rip-db directly. The demo server acts as a thin proxy,
which means you can add authentication, rate limiting, or query validation in one place.

## File Structure

```
demos/analytics/
├── api/
│   └── index.rip              # Server: UI middleware + SQL proxy + seed endpoint
├── app/
│   ├── index.html             # HTML shell: loads Tailwind, ECharts, Rip UI runtime
│   ├── routes/
│   │   └── index.rip          # Page: seeds data, defines SQL queries, renders Dashboard
│   └── components/
│       ├── dashboard.rip      # Orchestrator: executes SQL, classifies, renders charts
│       ├── line-chart.rip     # ECharts line chart wrapper
│       ├── bar-chart.rip      # ECharts bar chart wrapper
│       ├── pie-chart.rip      # ECharts pie/donut chart wrapper
│       ├── value-card.rip     # KPI metric card
│       └── data-table.rip     # HTML table for raw data
└── README.md
```

### Separation of Concerns

**`routes/index.rip`** (the page) knows *what* to show:
- Seeds sample data into DuckDB on first load
- Defines the SQL queries that drive the dashboard
- Provides the page title and layout
- Passes queries to the `Dashboard` component

**`components/dashboard.rip`** (the engine) knows *how* to show it:
- Takes `queries` (array of SQL strings) and `endpoint` (URL) as props
- Executes each query via `POST /sql`
- Parses column aliases and classifies each result into a chart type
- Uses computed properties to group results by type (valueCards, lineCharts, etc.)
- Renders the appropriate component for each group

This means any page can drop in a `Dashboard` with different SQL and get a
fully working, auto-classified visualization:

```coffee
Dashboard queries: myQueries, endpoint: '/sql'
```

### Chart Components

Each chart component follows the same pattern:
- **Props**: `@chartData` (row arrays from rip-db), `@columns` (parsed column metadata)
- **Init**: creates a `<div>`, calls `echarts.init()` on mount via `requestAnimationFrame`
- **Render**: extracts x-axis values and series data from columns/rows by type prefix
- **React**: watches `chartData` for changes and re-renders the chart
- **Cleanup**: calls `echarts.dispose()` when unmounted

## rip-db Response Format

All SQL queries return JSON from rip-db's `POST /sql` endpoint:

```json
{
  "meta": [
    { "name": "xaxis:Month", "type": "VARCHAR" },
    { "name": "linechart:Revenue", "type": "DOUBLE" }
  ],
  "data": [
    ["Jan", 42000],
    ["Feb", 48000]
  ],
  "rows": 12,
  "time": 0.003
}
```

The `meta` array carries the annotated column names. The `data` array is row-major
(each inner array is one row, column order matches `meta`). This format is what the
Dashboard's `classify` method parses to determine chart type and extract display labels.

## The Stack

| Layer | Package | Role |
|-------|---------|------|
| Data | `@rip-lang/db` (`rip-db`) | DuckDB HTTP server (Bun FFI, JSON API) |
| Server | `@rip-lang/api` | HTTP routing and middleware |
| UI | `rip-lang` (built-in) | Reactive components, browser-side compilation |
| Charts | ECharts 6 (CDN) | Chart rendering |
| Styling | Tailwind CSS 4 (CDN) | Utility-first CSS |

## Adding New Chart Types

To add a new visualization (e.g., a scatter plot):

1. Create `app/components/scatter-chart.rip` following the existing chart pattern
2. Add a new annotation prefix (e.g., `scatter:`)
3. Add a classification rule in `dashboard.rip`'s `classify` method
4. Add a render section in `dashboard.rip`'s `render` block
5. Write SQL using the new prefix: `x AS "xaxis:X", y AS "scatter:Y"`

No build step needed — Rip UI compiles components in the browser.

## Roadmap: Planned Annotation Types

The annotation system is designed to grow. These types are planned but not yet
implemented:

| Annotation | Purpose |
|---|---|
| **Charts** | |
| `barchart_stacked:` | Stacked bar chart series |
| `barchart_percent:` | Percentage bar chart |
| `linechart_percent:` | Percentage line chart |
| `donutchart:` | Donut chart series |
| `gauge:` | Gauge chart value |
| `boxplot:` | Box plot data |
| **Layout** | |
| `section:` | Section divider with title |
| `compare:` | Comparison value (shown with `value:`) |
| `trend:` | Trend indicator (up/down arrow) |
| `color:` | Custom color assignment |
| **Interactive Controls** | |
| `dropdown:` | Single-select filter dropdown |
| `dropdown_multi:` | Multi-select filter dropdown |
| `datepicker:` | Date picker |
| `datepicker_from:` | Date range start |
| `datepicker_to:` | Date range end |
| `input:` | Text input filter |
| `hint:` | Placeholder text for input |
| **Downloads** | |
| `download_csv:` | CSV export button |
| `download_xlsx:` | Excel export button |

### Interactive Controls (Planned)

The vision is for control annotations to set variables that subsequent queries
can reference via DuckDB's `getvariable()` function:

```sql
-- Filter dropdown (sets a variable)
SELECT DISTINCT region AS "dropdown:Region" FROM sales

-- Chart filtered by the control's value
SELECT
  month    AS "xaxis:Month",
  revenue  AS "linechart:Revenue"
FROM sales
WHERE region = getvariable('region')
```

This keeps the entire dashboard definition in SQL — layout, data, and interactivity.
