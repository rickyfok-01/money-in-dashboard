# 04 — Trustee (tab 3)

Per-trustee roll-up across the 12 `TR_CODE` trustees.

## Drives
- snapshot (default latest) · scheme.

## Measures
bill, total submit, on-time, 5 channels → on-time%, coverage%, channel shares.
+ "# schemes covered" (distinct scheme_code per trustee).

## Charts (top)
1. **Bills per trustee** — horizontal bar, sorted desc, **sequential** one-hue.
2. **Channel mix per trustee** — stacked horizontal bar, **categorical** (5 channels).
3. **On-time rate per trustee** — horizontal bar, **diverging** vs target line.

## Table (below)
| trustee | schemes covered | bills | submits | on-time% | coverage% | DDE% | BATCH% | PORTAL% | BULK% | OTHER% |
- Sorted by bills desc; sortable columns; mono numbers.

## Modes
- Current (default) · **Compare** (per-trustee Δ A vs B) · **Trend** (bills/rate over
  6 months, one line per trustee — ≤4 directly labeled, rest in legend; if all 12,
  prefer small multiples or top-N + Other). All meaningful.

## Notes
- 12 trustees > 8 categorical token ceiling for a 12-line trend → cap multi-line at
  top-8 by bills, fold the rest into "Other", or use small multiples.
