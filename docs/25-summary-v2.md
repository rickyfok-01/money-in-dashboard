# 25 — Summary V2 (tab 25)

Compact 3-category overview — Contribution Bill, Contribution Payment, and Direct Debit (DDI + DDA) — in one no-scroll page. Complements the original Summary (tab 0) with a denser layout and coverage of all 7 SQL data sources.

## Data sources

| Category | SQL | CSV | DATA key |
|---|---|---|---|
| Contribution Bill | SQL-05 | `con-bill-6mon-*.csv` | `DATA.rows` |
| Contribution Payment | SQL-06 | `con-pym-6mon-*.csv` | `DATA.pym` |
| AO Aging | SQL-07 | `con-pym-ao-aging-*.csv` | `DATA.aoAging` |
| DDI 30-day | SQL-01 | `ddi-30day-*.csv` | `DATA.ddi30` |
| DDI Aging | SQL-02 | `ddi-aging-*.csv` | `DATA.ddiAging` |
| DDA 30-day | SQL-03 | `dda-30day-*.csv` | `DATA.dda30` |
| DDA Aging | SQL-04 | `dda-aging-*.csv` | `DATA.ddaAging` |

## Drives

- snapshot (default `latest`) · scheme (default *All*) · trustee (default *All*) · month range (default all 6).
- **Current** — single-snapshot values.
- **Compare** — B − A deltas in a compact table.
- **Trend** — 6-month line charts (bills/submits/ontime + pay/avail/alloc%).

## Layout (no scroll)

```
┌─ KPI rib (6 pills) ─────────────────────────────────────────────┐
│ Bills │ On-time% │ Coverage% │ Pay AMT │ Avail AMT │ ALLOC%     │
├─────────────────────────────────────────────────────────────────┤
│ ┌─ Contribution Bill ─┐ ┌─ Payment ──────────┐ ┌─ Direct Debit ──┐ │
│ │ Bills               │ │ Pay AMT            │ │ DDI 30d reqs    │ │
│ │ On-time rate        │ │ Avail AMT          │ │ DDA 30d reqs    │ │
│ │ Coverage rate       │ │ ALLOC%             │ │ DDI aging bars  │ │
│ │ Channel mix bar     │ │ AO aging bars      │ │ DDA aging bars  │ │
│ └─────────────────────┘ └────────────────────┘ └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ Status mix │ AO aging │ DDI aging │ DDA aging                    │
│ (4 bucket bars - segment-colored by age bucket or status)       │
└─────────────────────────────────────────────────────────────────┘
```

### 1. KPI rib (`sv-rib`)

6 compact stat pills in one row:

Pill | Source
---|---
Bills | `DATA.rows` — `SUM(BILL_COUNT)` for current snapshot and month range
On-time% | `Σontime / Σtotal`
Coverage% | `Σtotal / Σbill`
Pay AMT | `DATA.pym` — `SUM(PAY_AMT)`
Avail AMT | `DATA.pym` — `SUM(AVAIL_AMOUNT)`
ALLOC% | `Σpay / (Σpay + Σavail)`

In **Compare** mode each pill shows Δ (signed integer or percentage points). In **Trend** mode pills show 6-month totals/aggregates.

### 2. Category cards (`sv-card-row`)

3 equal-width compact cards:

**Contribution Bill** — stat rows + channel mix mini bar:
- Bills (count)
- On-time (percentage + fraction)
- Coverage (percentage)
- Mini horizontal stacked bar: DDE / BATCH / PORTAL / BULK / OTHER using `SEQ[0]` / `CAT[1]` / `CAT[2]` / `CAT[4]` / `CAT[7]` colors, with comma-separated channel counts below.

**Contribution Payment** — stat rows + AO aging mini bar:
- Pay AMT (HKD, rounded)
- Avail AMT (HKD, rounded)
- ALLOC% (tone: ≥98% green, ≥95% yellow, else red)
- Mini bar: AO aging buckets (0-6d / 7-14d / 15-21d / 22-30d / 31d+) with semantic green→red gradient (`#16a34a`→`#f59e0b`→`#f97316`→`#ef4444`→`#991b1b`), with bucket labels below.

**Direct Debit** — stat rows + DDI / DDA aging mini bars:
- DDI 30-day: total requests, success count, rejected count
- DDA 30-day: total requests, active count, rejected count
- DDI aging mini bar (same bucket colors as AO aging)
- DDA aging mini bar (same bucket colors as AO aging)

### 3. Bucket bar row (`sv-buck-row`)

4 equal-width bucket cards, each a horizontal 100% stacked bar with colored segments and per-segment labels:

Card | Segments | Colors
---|---|---
**Status mix** | Lifecycle statuses (OPEN, SUBMITTED, APPROVED, PAID, CLOSED, etc.) | `STATUS_COLORS` from design system
**AO aging** | 0-6d / 7-14d / 15-21d / 22-30d / 31d+ | Green→red semantic ramp
**DDI aging** | Same 5 buckets | Same ramp
**DDA aging** | Same 5 buckets | Same ramp

Each segment shows a short label when ≥8% wide. Total count is displayed right-aligned below the bar.

## Modes

- **Current** (default) — static values from the selected snapshot/month range.
- **Compare** — replaces cards with a compact delta table listing every metric's A value, B value, and signed Δ (B − A). KPI pills show Δ inline.
- **Trend** — replaces category cards with two line charts (Chart.js):
  1. Bills / Submits / On-time counts across the 6 months.
  2. Pay AMT / Avail AMT / ALLOC% across the 6 months.
  KPI pills show 6-month totals. Bottom bucket bar is hidden in Trend mode.

## CSS

All styles live in `styles.css` under the `.sv-*` namespace:
- `.sv-rib` — 6-column grid for KPI pills
- `.sv-kpi` / `.svk-*` — compact stat pill
- `.sv-card-row` — 3-column grid for category cards
- `.sv-card` / `.svc-*` — category card
- `.sv-mini-bar` — small stacked bar (8px tall)
- `.sv-buck-row` — 4-column grid for bucket cards
- `.sv-buck-card` / `.sv-buck-bar` / `.sv-buck-seg` — bucket card and 18px tall segment bar

Responsive breakpoints at 1100px (stacks cards, halves KPIs) and 680px (single-column).

## Notes

- This tab is **read-only** — no drill-through navigation (unlike the original Summary). The purpose is a single-pane status glance.
- DDI / DDA aging and AO aging are **snapshot-level** data (no `ym` field), so they ignore the month range filter but respect scheme/trustee filters.
- Pending tagging (tab 01) and Money Allocation (tab 02) data are NOT included — this tab is about the raw contribution pipeline, not the allocation/tagging workflow.
