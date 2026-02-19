# Evidence.dev — Architecture Analysis

> Notes from studying the [Evidence.dev](https://github.com/evidence-dev/evidence) open-source BI
> framework to understand what's worth learning from and what we've already covered.

## How Evidence Works

Evidence is a Svelte/SvelteKit-based BI framework. You author dashboards in **Markdown files with
embedded SQL**. The rendering pipeline:

```
SQL in Markdown → Query Object → QueryLoad (async) → Chart Component → ECharts
```

### Chart Architecture (4 layers)

Every chart follows the same pattern:

```
BarChart.svelte  →  Chart.svelte  →  _Chart.svelte  →  ECharts.svelte
  (public API)      (query load)     (config builder)    (renderer)
```

- `_Chart.svelte` (~1000+ lines) is the core — analyzes columns, infers types, builds axes,
  tooltips, legends, and grid config
- Child components (`Bar.svelte`, `Line.svelte`, etc.) push series configs into a shared Svelte
  context store via `config.update()`
- `ECharts.svelte` takes the final merged config and renders it

### Key Utilities

| Utility | Purpose |
|---------|---------|
| `getColumnSummary()` | Analyze columns, infer types (number/string/date), detect format hints from names (`_usd`, `_pct`) |
| `getSeriesConfig()` | Transform row data into ECharts series format; handles single/multi Y, grouping, y2 axis |
| `getCompletedData()` | Fill missing data points for time series (important for stacked charts) |
| `inferColumnTypes()` | Type inference from first non-null value per column |
| Formatting system | Excel-style format codes, auto-formatting by value range, context-aware (axis vs tooltip) |

### Column Mapping

Evidence uses **explicit props** or **auto-inference**:

```svelte
<BarChart data={orders} x="region" y="total_sales" series="category" />
```

If `x` and `y` aren't specified, it auto-detects: first column → x, all numeric columns → y.
Column names can include format tags (`revenue_usd`, `growth_pct`) for auto-formatting.

## Evidence Component Inventory

### Charts (all ECharts-based)

| Component | Description |
|-----------|-------------|
| BarChart | Grouped, stacked, stacked 100%, horizontal |
| LineChart | Multi-series, step mode, handle missing (gap/zero/connect) |
| AreaChart | Filled line chart (line + `areaStyle`) |
| ScatterPlot | X-Y scatter |
| BubbleChart | Scatter with size dimension |
| BoxPlot | Statistical box-and-whisker |
| Histogram | Frequency distribution |
| FunnelChart | Pipeline/conversion funnel |
| SankeyDiagram | Flow diagram |
| Heatmap | Color-coded grid |
| CalendarHeatmap | GitHub-style calendar grid |
| Venn | Set overlap diagram |
| Map | Geographic visualization (GeoJSON) |
| Sparkline | Mini inline chart for KPI cards |
| Custom ECharts | Direct ECharts config passthrough |

### Values & Indicators

| Component | Description |
|-----------|-------------|
| BigValue | KPI card with title, value, optional sparkline and delta comparison |
| Value | Inline formatted value |
| Delta | Change indicator (▲/▼) with color coding and `downIsGood` option |

### Annotations

| Component | Description |
|-----------|-------------|
| ReferenceLine | Horizontal/vertical/sloped reference lines on any chart |
| ReferenceArea | Highlighted region bands |
| ReferencePoint | Individual labeled points |

### Data Display

| Component | Description |
|-----------|-------------|
| DataTable | Full pivot table — pagination, sorting, grouping (accordion/section), subtotals, search, aggregation, fullscreen |
| Column | Child of DataTable for per-column config (format, agg, style) |

### Controls

| Component | Description |
|-----------|-------------|
| Dropdown | Single-select filter |
| TextInput | Text filter |
| DateRange | Date range picker |
| ButtonGroup | Toggle button filter |
| DimensionGrid | Multi-dimension selector |

## Comparison: Evidence vs Rip Analytics

### Similarities

Both follow the same core idea:

- SQL is the primary interface
- ECharts for rendering
- DuckDB for data
- Column metadata drives visualization
- Interactive controls filter downstream queries

### Key Differences

| | Evidence | Rip Analytics |
|---|---|---|
| Authoring | Markdown + Svelte component tags | SQL annotations parsed automatically |
| Framework | SvelteKit (Node build required) | Rip UI (zero-build, browser-compiled) |
| Chart config | Explicit props per chart type | Embedded in SQL (`AS "linechart:Revenue"`) |
| Complexity | ~1000+ lines for `_Chart.svelte` alone | ~60 lines per chart component |
| Column mapping | Manual or auto-inferred from data | Annotation-driven from SQL |
| Build step | Full SvelteKit build pipeline | None — `.rip` compiles in browser |
| Dependencies | 50+ npm packages | ECharts CDN + Rip UI runtime |

### What We Already Cover

All of the following Evidence features are implemented in Rip Analytics:

- Bar chart (grouped, stacked)
- Line chart (multi-series)
- Pie / Donut chart
- Box plot
- Gauge
- Value cards (KPI)
- Data table
- Dropdown (single + multi-select)
- Date picker (single + range)
- Text input filter
- CSV download/export
- Variable substitution (control → query)

### What Evidence Has That We Don't (Yet)

#### High Value

| Feature | Effort | Notes |
|---------|--------|-------|
| **Sparklines in value cards** | Low | Mini inline chart showing trend; just a small ECharts instance |
| **Delta/comparison on value cards** | Low | ▲12% / ▼3% indicators with color coding |
| **Area chart** | Trivial | Line chart + `areaStyle: {}` in ECharts config |
| **Reference lines/areas** | Medium | Annotate charts with targets, thresholds, bands |
| **Data completion for time series** | Medium | Fill missing points so stacked charts don't break |

#### Medium Value

| Feature | Effort | Notes |
|---------|--------|-------|
| Scatter / Bubble chart | Low | New component, straightforward ECharts config |
| Histogram | Low | Bar chart variant with binning logic |
| Funnel chart | Low | Simple ECharts series type |
| Table subtotals / grouping | Medium | Aggregation logic + expandable rows |
| Table search/filter | Low | Client-side text filtering |
| Column auto-formatting | Medium | Detect `_usd`, `_pct` suffixes or value ranges |

#### Lower Priority

| Feature | Effort | Notes |
|---------|--------|-------|
| Sankey diagram | Medium | Requires different data shape (source → target → value) |
| Heatmap / Calendar heatmap | Medium | Specialized ECharts config |
| Map / Geographic | High | Needs GeoJSON data, different rendering approach |
| Venn diagram | Low | Niche use case |

## Architecture Takeaway

Evidence needs **thousands of lines of Svelte** and a complex 4-layer component hierarchy to achieve
what Rip Analytics does in ~210 lines of dashboard orchestration + ~60 lines per chart component.
Their architecture is designed for a framework that must be infinitely configurable via props. The
SQL-annotation approach in Rip sidesteps most of that complexity — the SQL _is_ the configuration.

The ECharts option objects themselves are essentially the same between both systems. Porting specific
chart types or features from Evidence means studying their ECharts configs, not their Svelte
framework code.

**Source:** https://github.com/evidence-dev/evidence (MIT license, ~6K stars)
