<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.png" style="width:50px" /> <br>

# Rip Analytics - @rip-lang/analytics

> **SQL-driven analytics dashboards — write annotated queries, get interactive charts**

Write SQL with type annotations like `::BARCHART`, `::XAXIS`, and `::LINECHART`.
Rip Analytics executes the queries against a running `rip-db` instance (DuckDB
over HTTP) and renders the results as interactive charts and tables using Rip UI
components. No build step, no React, no chart library configuration.

## Quick Start

**`index.rip`** — the server:

```coffee
import { get, use, start, notFound } from '@rip-lang/api'
import { ripUI } from '@rip-lang/ui/serve'

dir = import.meta.dir
use ripUI dir: dir, components: 'pages', watch: true, title: 'My Dashboard'
notFound -> @send "#{dir}/index.html", 'text/html; charset=UTF-8'
start port: 3000
```

**`index.html`** — the page:

```html
<script type="module" src="/rip/rip-ui.min.js"></script>
<script type="text/rip">
  { launch } = importRip! 'ui.rip'
  launch()
</script>
```

**`pages/index.rip`** — a dashboard page:

```coffee
export Dashboard = component
  data := null
  loading := true

  onMount: ->
    res = fetch!('/api/dashboard', method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(sql: dashboardSQL)).json!
    data = res
    loading = false

  render
    .
      h1 "Sales Dashboard"
      if loading
        p "Loading..."
      else
        Chart data: data
```

Start `rip-db mydata.duckdb` on port 4213, then `bun index.rip` on port 3000.

## How It Works

```
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│  Rip UI     │  fetch   │   rip-db    │   FFI    │   DuckDB    │
│  (Browser)  │─────────▶│   (HTTP)    │◀────────▶│  (native)   │
└─────────────┘          └─────────────┘          └─────────────┘
      │
      │ SQL with type annotations
      │ e.g. SELECT date::XAXIS, revenue::BARCHART FROM sales
      │
      ▼
  Parse column types → Render charts
```

1. **You write SQL** with type annotations — DuckDB casts that drive visualization
2. **rip-db executes** the query via its `POST /sql` endpoint and returns JSON
3. **Rip Analytics parses** column type metadata to determine chart types
4. **Rip UI renders** interactive charts, tables, and controls — no React, no bundler

The entire visualization layer is Rip components. The entire data layer is
DuckDB over HTTP. Nothing else.

## SQL Type Annotations

Annotate SQL columns with DuckDB type casts to control how results are rendered.
The column name becomes the series label, and the type cast determines the
visualization.

### Charts

```sql
-- Line chart: revenue over time
SELECT
  date::XAXIS,
  revenue::LINECHART
FROM monthly_sales
ORDER BY date;

-- Bar chart: sales by region
SELECT
  region::XAXIS,
  total_sales::BARCHART
FROM regional_sales;

-- Stacked bar chart: sales by region and category
SELECT
  region::XAXIS,
  sales::BARCHART_STACKED,
  category::CATEGORY
FROM sales_breakdown;

-- Pie chart: market share
SELECT
  company::CATEGORY,
  share::PIECHART
FROM market_data;

-- Multiple series on one chart
SELECT
  date::XAXIS,
  revenue::LINECHART,
  costs::LINECHART,
  profit::BARCHART
FROM financials
ORDER BY date;
```

### Single Values

```sql
-- KPI card
SELECT
  total_revenue::VALUE,
  last_month_revenue::COMPARE,
  'Total Revenue'::LABEL
FROM summary;
```

### Sections and Labels

```sql
-- Section header
SELECT 'Revenue Analysis'::SECTION;

-- Chart with a label
SELECT
  date::XAXIS,
  amount::LINECHART,
  'Monthly Revenue'::LABEL
FROM revenue;
```

### Interactive Controls

```sql
-- Dropdown filter
SELECT DISTINCT region::DROPDOWN FROM sales;

-- Date range picker
SELECT
  CURRENT_DATE - INTERVAL '30 days'::DATEPICKER_FROM,
  CURRENT_DATE::DATEPICKER_TO;

-- Text input
SELECT ''::INPUT, 'Search...'::HINT;
```

Variables set by controls are referenced in subsequent queries using DuckDB's
`getvariable()` function:

```sql
SELECT
  date::XAXIS,
  revenue::LINECHART
FROM sales
WHERE region = getvariable('region')
  AND date >= getvariable('dateFrom');
```

### Complete Type Reference

| Annotation | Purpose |
|------------|---------|
| **Axes** | |
| `::XAXIS` | X-axis values (dates, categories, numbers) |
| `::YAXIS` | Y-axis values |
| `::XLINE` | Vertical reference line |
| `::YLINE` | Horizontal reference line |
| **Charts** | |
| `::BARCHART` | Bar chart series |
| `::BARCHART_STACKED` | Stacked bar chart series |
| `::BARCHART_PERCENT` | Percentage bar chart |
| `::LINECHART` | Line chart series |
| `::LINECHART_PERCENT` | Percentage line chart |
| `::PIECHART` | Pie chart series |
| `::DONUTCHART` | Donut chart series |
| `::GAUGE` | Gauge chart value |
| `::BOXPLOT` | Box plot data |
| **Grouping** | |
| `::CATEGORY` | Category grouping for any chart type |
| `::COLOR` | Custom color assignment |
| **Metadata** | |
| `::LABEL` | Title for a chart or value |
| `::SECTION` | Section divider with title |
| `::VALUE` | Single metric display |
| `::COMPARE` | Comparison value (shown with VALUE) |
| `::TREND` | Trend indicator |
| **Controls** | |
| `::DROPDOWN` | Single-select dropdown |
| `::DROPDOWN_MULTI` | Multi-select dropdown |
| `::DATEPICKER` | Date picker |
| `::DATEPICKER_FROM` | Date range start |
| `::DATEPICKER_TO` | Date range end |
| `::INPUT` | Text input |
| `::HINT` | Placeholder text for input |
| **Downloads** | |
| `::DOWNLOAD_CSV` | CSV download button |
| `::DOWNLOAD_XLSX` | Excel download button |

## Dashboard Structure

A dashboard is a sequence of SQL statements. Each statement produces a section,
a control, or a visualization. The order of statements defines the layout:

```sql
-- 1. Dashboard title
SELECT 'Sales Overview'::SECTION;

-- 2. Filter controls (rendered as a toolbar)
SELECT DISTINCT region::DROPDOWN FROM sales;
SELECT CURRENT_DATE - INTERVAL '90 days'::DATEPICKER_FROM, CURRENT_DATE::DATEPICKER_TO;

-- 3. KPI cards
SELECT count(*)::VALUE, 'Total Orders'::LABEL FROM orders;
SELECT sum(revenue)::VALUE, 'Revenue'::LABEL FROM orders;

-- 4. Charts section
SELECT 'Trends'::SECTION;

SELECT
  date_trunc('month', order_date)::XAXIS,
  sum(revenue)::LINECHART,
  'Monthly Revenue'::LABEL
FROM orders
WHERE region = getvariable('region')
GROUP BY 1
ORDER BY 1;

-- 5. Data table
SELECT order_id, customer, amount, status FROM orders LIMIT 100;
```

Statements are executed sequentially. Control queries (dropdowns, date pickers)
run first so their variables are available to subsequent chart queries.

## Architecture

Rip Analytics is deliberately minimal:

- **No message broker** — queries go directly to DuckDB via HTTP
- **No separate state store** — DuckDB is the single source of truth
- **No build step** — Rip UI compiles components in the browser
- **No chart library configuration** — type annotations drive rendering

The stack:

| Layer | Package | Role |
|-------|---------|------|
| Data | `@rip-lang/db` | DuckDB HTTP server (FFI, JSON API) |
| Server | `@rip-lang/api` | HTTP routing and middleware |
| UI | `@rip-lang/ui` | Reactive components, client-side rendering |
| Analytics | `@rip-lang/analytics` | SQL parsing, type detection, chart components |

## License

MIT
