# 27 — DDI Dimensions (tab 27)

The L2 "dimensions" view under the DD Overview (#26) — break the **DDI 30-day**
request pipeline down by scheme / trustee / account-type. Which dimension
drives DDI success rate, and how do those rates shift between snapshots?

## Data source

| Metric family | CSV | DATA key |
|---|---|---|
| DDI 30-day (req / submitted / success / rejected) | `ddi-30day-*.csv` (SQL-01) | `DATA.ddi30` |

`DATA.ddi30` is **snapshot-level** (`{snapshots, rows}`, no `ym`) — it ignores the
month range but respects the global scheme + trustee pickers. Ships 5 snapshots
in the current build. Row: `{s, tr, sc, at, date, total, submitted, success, rejected}`
(`date` is not grouped — too granular).

## Drives
snapshot (default latest) · scheme (default All) · trustee (default All) ·
**tab-internal Group-by toggle** (Scheme / Trustee / Account type, default Scheme —
does not surface the global `#scopeAllocBy`). Mode: **Current · Compare · Trend**.

## Measures (derived — ratio of sums, never mean of ratios)
- **successRate** = `Σsuccess / Σtotal` — the headline rate
- rejectedShare = `Σrejected / Σtotal`; pendingShare = `(Σtotal − Σsuccess − Σrejected) / Σtotal`
- Tone band `ddTone(v)` on the rate (mirrors ALLOC%): ≥0.98 green · ≥0.95 amber · else red.
  Not applied to rejected/pending shares (lower-is-better).

## Charts
- **Current** — (A) outcome mix per dim · stacked bar (Success·Rejected·Pending);
  (B) success rate per dim · horizontal bar, coloured by ddTone band;
  (C) overall DDI outcome · donut.
- **Compare** — (A) Δ success rate (pp) per dim · diverging bar (POS/NEG);
  (B) total requests per dim · A vs B grouped.
- **Trend** — success-rate + total-request **lines across `DATA.ddi30.snapshots`**
  per dim (snapshot axis — **no month axis**; DD data has no month dimension).

## Table (the relief channel)
- **Current** — `<Dim> | Total | Success | Success% | Rejected | Rej% | Submitted |
  Pending | Pend%` (sortable; Success% cell wears the ddTone class; TOTAL row).
- **Compare** — `<Dim> | Success% A | Success% B | Δ Rate | Total A | Total B`
  (Δ Rate uses `pp()` + `delta-up/dn/flat`).
- **Trend** — one row per snapshot: `Snapshot | Total | Success | Success% | Rejected | Submitted`.
Row click focuses the scheme picker **only when grouping by Scheme**.

## Notes / known limitations
- Reuses the global DD helpers (`ddi30For`/`sumAO` @ tabs-summary-v2.js, `ddTone`
  @ tabs-dd-overview.js) and chart primitives (`newBar`/`newLine`/`newDoughnut`/
  `buildTable`/`card`) — not redefined. Ships its own ~15-line local `ddiDimAgg`
  (core.js's `groupBy`/`add` accumulator is bill-measure-specific and would NaN-
  poison DD rows); DRY deferred to the Reviewer.
- Read-only — no drill-through navigation (rows focus the scheme picker only).
- `<2-snapshot` dataset shows a `pend-empty` "Not enough snapshots…" guard
  instead of a broken trend chart (ddi30 ships 5, so this is a safety net).
