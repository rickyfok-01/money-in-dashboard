# 18 — Completion Rate (tab 17)

Share of bills reaching a **terminal** state — `(CLOSED + FULLY_PAID + WAIVED + REFUND_OVERPAID) / bills` — ranked by scheme.

## Drives
snapshot · scheme (multi-select).

## Measures
completion rate = Σ terminal bills / Σ bills (ratio of sums).

## Charts (top)
1. **Completion rate by scheme (ranked)** — horizontal bar, **diverging** vs the dataset median.
2. **Completion vs coverage** — scatter (x=coverage, y=completion, dot=scheme); outliers labeled.

## Table
`SCHEME | Bills | Completed | Completion % | vs median` (status chip).

## Modes
Current · Compare.

## Notes
- Terminal = `CLOSED / FULLY_PAID / WAIVED / REFUND_OVERPAID`.
- Complements Coverage (submitted/billed) — this is the "finished" rate.
