# 28 — DDA Dimensions (tab 28)

The **L2 dimension view** under DD Overview for the **DDA 30-day** mandate
pipeline (`DATA.dda30`, from `data/dda-30day-*.csv` / SQL-03). Splits Direct
Debit *Authorization* mandates by scheme / trustee / account-type so you can
see which dimension drives the **active rate** and how the inactive /
rejected / suspend mix shifts.

## Drives
- snapshot (default latest) · scheme · trustee (global pickers).
- a **tab-internal** Group-by toggle: **Scheme** (default) / Trustee / Account type.

## Measures
`total · submitted_pig · submitted_bank · active · inactive · rejected · suspend`.
Headline rate = **active rate** = `Σactive / Σtotal` (ratio of sums, never a
mean of per-row ratios). inactive / rejected / suspend shares are each `Σx / Σtotal`.
Rows are snapshot-level — **no `ym`**, no month dimension.

## Charts (top)
1. **Outcome mix per <dim>** — stacked horizontal bar; categorical identity
   (Active · Inactive · Rejected · Suspend), fixed slot order.
2. **Active rate by <dim>** — horizontal bar, tone-coloured vs `ddTone` bands
   (≥98% green / ≥95% amber / else red). Sorted by total desc.
3. **Overall outcome mix** — donut, part-to-whole (same 4 identity colours).

## Table (below)
`<Dim> | Total | Active | Active% | Inactive | Rejected | Suspend | Subm. bank`.
The **Active%** cell wears the `ddTone` colour; the table is the contrast-relief
channel. Row click sets `state.schemes=[k]` **only** when grouping by scheme.

## Modes
- **Current** (default) · **Compare** (Δ active-rate pp per dim, diverging
  blue↔red bar + `A | B | Δ` table with `signed()`/`pp()` + `delta-up/dn/flat`)
  · **Trend** (active-rate line + total/active/rejected count lines across
  `DATA.dda30.snapshots` + per-snapshot table). **Trend is snapshot-level — no
  month axis.**

## Notes
- Reuses `dda30For` / `sumAO` (`js/tabs-summary-v2.js`) + `ddTone`
  (`js/tabs-dd-overview.js`) + `newBar`/`newLine`/`newDoughnut`/`buildTable`.
- `<2-snapshot` dataset shows a `pend-empty` guard in Trend (dda30 ships 5 — safety net).
- `ddTone` is applied to the **active rate only** — never to inactive/rejected/
  suspend shares (lower-is-better; a directional tone would mislabel them).
- Twin of tab 27 (DDI Dimensions); the dimension toggle + aggregator are
  duplicated locally for conflict-free parallel build.
