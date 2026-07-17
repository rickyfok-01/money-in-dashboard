# 26 — DD Overview (tab 26)

A dedicated Direct Debit overview page — "how healthy is the DDI (instructions)
+ DDA (agreements) pipeline right now, how has it aged, and how is it moving
snapshot-to-snapshot?" One compact page; mirrors the Summary V2 density.

## Data sources

| Metric family | CSV | DATA key |
|---|---|---|
| DDI 30-day (req / success / rejected) | `ddi-30day-*.csv` (SQL-01) | `DATA.ddi30` |
| DDI aging (0-6d … 31d+) | `ddi-aging-*.csv` (SQL-02) | `DATA.ddiAging` |
| DDA 30-day (active / inactive / rej / suspend) | `dda-30day-*.csv` (SQL-03) | `DATA.dda30` |
| DDA aging (0-6d … 31d+) | `dda-aging-*.csv` (SQL-04) | `DATA.ddaAging` |

All four are **snapshot-level** (no `ym`) — they ignore the month range but
respect scheme / trustee filters. Each dataset may carry a **different snapshot
set**; Trend uses each dataset's own snapshots.

## Drives
snapshot (default latest) · scheme (default All) · trustee (default All). Mode:
**Current · Compare · Trend**.

## Measures (derived — ratio of sums, never mean of ratios)
- DDI success% = `Σsuccess / Σtotal`
- DDA active% = `Σactive / Σtotal`
- Aging 31d+ share = `Σd31 / Σtotal`
- Tone band `ddTone(v)` (success/active): ≥0.98 green / ≥0.95 yellow / else red
  (mirrors ALLOC%). Not applied to 31d+ (lower-is-better).

## Layout (no scroll)
```
KPI rib (6 pills): DDI req | DDI success% | DDA req | DDA active% | DDI 31d+ | DDA 31d+
Chart row (2×2):  DDI 30-day doughnut · DDA 30-day doughnut
                   DDI aging ramp bar  · DDA aging ramp bar
Per-scheme relief table: sc | DDI req | DDI success% | DDI rej | DDA req | DDA active% |
                         DDA rej | DDI 31d+ | DDA 31d+   (sortable; click row to focus scheme)
```
Aging ramp (green→red): `#16a34a #f59e0b #f97316 #ef4444 #991b1b`.

## Modes
- **Current** — single-snapshot values + 4 charts + per-scheme table.
- **Compare** — KPI pills show Δ (counts `signed()`, rates `pp()`); charts become
  A-vs-B grouped bars; table is `Metric | A | B | Δ` with `delta-up/dn/flat`.
- **Trend** — each dataset trended across its own snapshots: 30-day line charts
  (total + success/active + rejected) + aging stacked bars per snapshot. KPI pills
  show the selected snapshot's values. Note: "Trend is across snapshot dates — DD
  data has no month dimension." Per-snapshot table underneath.

## Notes / known limitations
- **`ddiAging` is thin/noisy.** Its source `data/ddi-aging-20260713.csv` is a
  malformed SQL dump, so `DATA.ddiAging` ships only 4 snapshots (20260714–17)
  vs 5 for the other DD datasets. The Trend `<2-snapshot` guard renders a
  `pend-empty` "Not enough snapshots yet…" state for any dataset with fewer
  than 2 snapshots instead of a broken chart. The Oracle re-export is tracked
  as a separate, non-blocking data-hygiene follow-up (not this iteration).
- Read-only — no drill-through navigation (rows focus the scheme picker only).
- Reuses the global DD filter helpers from tab 25 (`ddi30For`/`ddiAgingFor`/
  `dda30For`/`ddaAgingFor`/`sumAO`) — not redefined.
