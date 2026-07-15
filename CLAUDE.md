# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

A **no-build HTML dashboard** that visualizes **MPF contribution bill &
submit-channel statistics** across daily DB snapshots. The app is split across
`index.html` (markup + `<script>` bootstrap), `styles.css`, and a small set of
plain `<script>` modules in `js/` (loaded in dependency order — see
*Repository layout*). It
replaces ad-hoc Excel inspection of the `con-bill-6mon-YYYYMMDD.csv` exports
produced by `data/sql/contribution.sql` (Query 2 — submit-channel roll-up).

The app is **snapshot-aware**: it loads every CSV in `data/` (each tagged with a
`SNAPSHOT_DATE`) and offers two cross-snapshot features on every meaningful tab —

- **Compare** — pick any two snapshot dates, see the metric delta (Δ).
- **Trend** — the metric across the latest 6 contribution months (YEAR_MONTH).

— on top of a normal "current snapshot" view. **Every page is `scheme_code`-based**:
a global scheme selector drives every tab, and every data table is keyed by scheme.

## Quick start

```bash
python scripts/build_data.py   # data/con-bill-6mon-*.csv  ->  data.js
start index.html               # Windows: open in browser (or double-click)
```

No server, no install. Charts need internet (Chart.js **and** D3 via CDN); tables work offline.

## Repository layout

```
index.html              # markup + <script>/<link> bootstrap (loads data.js → js/*.js in order)
styles.css              # all CSS (was inline <style>; extracted, no behavior change)
js/                     # vanilla-JS modules, plain <script> tags (no ES modules → runs from file://)
  core.js               # palette, format, state, data access            (loads 1st)
  charts.js             # Chart.js/D3 chart + table infrastructure
  tabs-summary.js       # generic dimension renderer + Summary tab
  tabs-detail.js        # Channel … Trustee Portfolio detail tabs
  tabs-settings.js      # Settings + Theme + preferences
  tabs-alloc.js         # Contribution Pend Tagging + Money Allocation
  app.js                # scope bar, TABS dispatch, nav, init             (loads last)
data.js                 # generated dataset (committed; regenerate via scripts/)
scripts/
  build_data.py             # CSV -> data.js (type-coerce, latest-6-month window)
data/
  con-bill-6mon-YYYYMMDD.csv  # snapshot exports (Query 2 of contribution.sql)
  sql/contribution.sql        # authoritative source query + column semantics
docs/                     # all documentation (one markdown spec per tab + architecture + specs)
  README.md               # plan index
  00-architecture.md      # data model, design system, shared features
  01-summary.md … 21-trustee-portfolio.md  # one doc per tab (21 detail tabs)
  STATUS.md               # current-state snapshot (read first in zero-context session)
  SPEC-contribution-tagging.md  # spec for tab 01 (Contribution Pend Tagging)
  SPEC-money-allocation.md      # spec for tab 02 (Money Allocation)
```

## Data pipeline

```
data/con-bill-6mon-YYYYMMDD.csv  →  scripts/build_data.py  →  data.js  →  index.html
```

- **`scripts/build_data.py`** — globs `data/con-bill-6mon-*.csv`, sorts by the date
  in the filename, coerces every measure column to **int** (the `20260708` export
  ships floats like `9.0`; `20260707` ships ints — normalize both), keeps only the
  **latest 6 distinct YEAR_MONTHs** (older months are dropped — "recent 6 months
  only, others ignored"), and writes a single `const DATA = {...}` to `data.js`.
  It also reads `data/con-pym-6mon-*.csv` → `DATA.pym` and
  `data/constant-scheme-info.xlsx` → `DATA.names` (see below).
  **Re-run whenever CSVs change.**

## Data model (`data.js`)

Each CSV row is one combination of **snapshot × trustee × scheme × status × bill
mode × frequency × account type × contribution month**, with these measures:

| Column | Kind | Meaning |
|---|---|---|
| `SNAPSHOT_DATE` | key | `YYYYMMDD` export date |
| `TR_CODE` | dim | trustee code (12 distinct) |
| `SCHEME_CODE` | dim | scheme (25 distinct) — **primary entity** |
| `AV_STATUS_CODE` | dim | bill status lifecycle (10 distinct) |
| `AV_BILL_CONTR_MODE` | dim | REGULAR / LUMP_SUM / SURCHARGE |
| `AV_FREQ_TYPE` | dim | contribution frequency (9 distinct, incl. blank) |
| `SHORT_CODE` | dim | member account type (eMPF member-type codes: REE=Regular Employee, CEE=Casual Employee, SEP=自僱人士, PAH=Personal Account Holder, TVC, SVC) |
| `YEAR_MONTH` | dim | `YYYY-MM` contribution month (latest 6 kept) |
| `BILL_COUNT` | measure | number of bills |
| `ONTIME_SUBMIT_COUNT` | measure | bills with ≥1 on-time submit |
| `TOTAL_SUBMIT_COUNT` | measure | bills with ≥1 submit (any date) |
| `DDE / BATCH / PORTAL / BULKUPLOAD / OTHER_SUBMIT_COUNT` | measure | submit-channel mix |

**Derived metrics used throughout** (computed client-side):

- **On-time submit rate** = `ONTIME_SUBMIT_COUNT / TOTAL_SUBMIT_COUNT`
- **Submit coverage** = `TOTAL_SUBMIT_COUNT / BILL_COUNT` (share of bills that were submitted at all)
- **Channel share** = `channel_count / sum(all channel counts)`

The full column semantics live in `data/sql/contribution.sql`.

### Payment dataset (`DATA.pym`) + name lookup (`DATA.names`)

`build_data.py` also reads a **second** dataset and a lookup, appended to the same
`DATA` object:

- **`DATA.pym`** — from `data/con-pym-6mon-YYYYMMDD.csv`. One row per
  `snapshot × trustee × scheme × pay channel × tag status × pay method × month`
  with `PAY_AMT` / `AVAIL_AMOUNT` (float HKD) and `PAYMENT_COUNT`. Same latest-6-
  month window. Drives the **Money Allocation** overview tab; **ALLOC % =
  `Σ PAY / (Σ PAY + Σ AVAIL)`**.
- **`DATA.names`** — from `data/constant-scheme-info.xlsx`:
  `{scheme:{code:name}, trustee:{code:name}}` (27 schemes, 13 trustees). Renders
  codes + human-readable names on the Money Allocation tab; available globally.

Bill data and the `a`/`b` flags are unaffected by these additions.

## Tab system

A left sidebar switches tabs, grouped (Overview · Dimensions · Cross-analysis ·
Performance · Outcomes & ops · Over time · Settings). The **Overview** group
holds **Summary**, **Contribution Pend Tagging**, and **Money Allocation**; the
rest are detail tabs. Each detail tab has the same anatomy: **charts on top →
data table below**, is driven by the global filters, and supports Compare/Trend
where meaningful.

| # | Tab | Dimension / angle |
|---|---|---|
| 0 | **Summary** | overview — KPIs + clickable charts that jump to detail tabs |
| 1 | **Contribution Pend Tagging** | overview — ER-submitted (A) vs Pending-Tagging (B) per (scheme × period) |
| 2 | **Money Allocation** | overview — payment allocation: Pay AMT / Avail AMT / ALLOC % per (scheme × month) (`con-pym-6mon-*.csv`) |
| 3 | Scheme Scorecard | per-scheme master table (the scheme-centric view) |
| 4 | Status Lifecycle | `AV_STATUS_CODE` |
| 5 | Trustee | `TR_CODE` |
| 6 | Contribution Mode | `AV_BILL_CONTR_MODE` |
| 7 | Frequency | `AV_FREQ_TYPE` |
| 8 | Account Type | `SHORT_CODE` |
| 9 | Submit Channel | DDE/BATCH/PORTAL/BULKUPLOAD/OTHER mix (the core of Query 2) |
| 10 | On-time Performance | on-time submit rate, ranked vs median |
| 11 | Submit Funnel & Coverage | BILL → submitted → on-time funnel + coverage ratio |
| 12 | Monthly Trend | dedicated time-series across the 6 months |
| 13 | Snapshot Comparison | dedicated A-vs-B delta across the whole dataset |
| 14 | Status × Channel | crosstab — channel mix per lifecycle status |
| 15 | Trustee × Channel | crosstab — channel mix per trustee |
| 16 | Frequency × Status | crosstab — status outcomes per frequency |
| 17 | Payment Outcome | paid-status split (FULLY_PAID/OVERPAID/WAIVED/…) |
| 18 | Backlog & Pending | work-in-progress (OPEN/SUBMITTED/APPROVED) |
| 19 | Completion Rate | terminal-state completion, ranked |
| 20 | Outliers & Exceptions | schemes >1σ from the peer mean (watchlist) |
| 21 | Volume Tiers | XS…XL bill-volume tiers vs quality |
| 22 | Trustee Portfolio | trustee breadth & top-scheme concentration |
| 23 | Settings | app preferences (display, navigation, dataset, theme) |
| 24 | Theme | choose a visual theme |

Each tab has its own spec in `docs/`.

## Shared features

- **Global filter bar** (top of content): snapshot selector (defaults to latest),
  a **multi-select scheme picker** (searchable dropdown with checkboxes; defaults
  to all schemes — pick any subset and every tab re-scopes to it), month range,
  and a **mode toggle** — `Current | Compare | Trend`. The mode toggle is the
  cross-tab Compare/Trend feature; tabs where a mode is not meaningful hide it.
- **Scheme-based everywhere.** Scheme is the primary entity; the scheme picker
  drives every tab, and every table is keyed by `SCHEME_CODE` (or scoped to the
  selected scheme set). A few diagnostic tabs (Outliers, Volume Tiers, Trustee
  Portfolio) intentionally span all schemes and ignore the picker.
- **Recent 6 months only.** The pipeline drops older months; the app trusts that.
- **Drill-through.** Clicking a Summary chart navigates to the relevant detail tab
  (and pre-sets a filter, e.g. a specific trustee or scheme).
- **Every tab ships a data table** — this is also the dataviz *relief channel*:
  three light-mode categorical hues sit below 3:1 contrast, so the table (and
  direct labels/legend) keep identity legible without color alone.

## Design system

**Aesthetic — "editorial data observatory."** Refined, paper-and-ink, serious.
Deliberately *not* the generic AI look (no Inter, no purple-on-white gradients).

- **Theme:** single light theme. Warm off-white surfaces, near-black ink.
- **Type:** `Fraunces` (characterful display serif) for the brand title, page H1s
  and hero figures only — **never inside a chart**. `IBM Plex Sans` for UI body and
  all chart text; `IBM Plex Mono` for scheme codes, figures, and aligned table
  columns (`font-variant-numeric: tabular-nums`).
- **Palette (validated, see `docs/00-architecture.md`):**
  - Categorical identity — 8 fixed-order hues (blue, aqua, yellow, green, violet,
    red, magenta, orange). Assigned in order, never cycled; a 9th series folds into
    "Other" or small multiples.
  - Sequential magnitude — single-hue blue ramp (light→dark) for heatmaps/bars by size.
  - Diverging — blue↔red with a gray midpoint, for the Compare deltas (Δ).
  - Status — fixed good/warning/serious/critical, icon+label, reserved meaning.
- **Charts (Chart.js + D3, via CDN).** Thin marks, 2px lines, ≥8px markers, recessive
  grid/axes, legend for ≥2 series, selective direct labels. One axis per chart
  (never dual-axis). Text wears ink tokens, never the series color. **D3 (`d3@7`)
  is not dead weight** — it powers the custom hand-built SVG charts (Summary's
  *Bills by status · monthly* stacked/grouped bar and *Submission status by
  month* trustees panel). Do **not** remove the D3 `<script>` tag thinking it's
  only for a dropped tab; removing it breaks the Summary tab (`renderSummary`
  throws mid-render and drops its charts + tables).
- **Motion:** CSS-only — staggered fade-up on tab load, hover lift on cards/tiles,
  smooth chart redraws.

## Conventions

- Match the surrounding code style. The app is vanilla JS split across
  `index.html` + `styles.css` + `js/*.js`, loaded as plain `<script>` tags in
  **dependency order** (`index.html` lists them: `data.js → core → charts →
  tabs-* → app`). No build step, no framework, no ES modules — so it still runs
  from `file://` (double-click). Preserve that load order when editing: the
  foundational consts are in `core.js`, and `app.js` (TABS dispatch + `init`)
  loads last because `TABS` references the render functions defined in the
  `tabs-*.js` files.
- Keep the data layer (`data.js`) and the view layer (`index.html` + `js/`) separate;
  re-run `build_data.py` after any CSV change, never hand-edit `data.js`.
- When adding a tab, add its `docs/NN-*.md` spec first and follow it.
- Charts follow the dataviz method: pick the form by the data's job, assign color
  by job, keep marks thin, ship a table as the relief channel.
