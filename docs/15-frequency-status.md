# 15 — Frequency × Status (tab 14)

Cross-analysis: how **contribution frequency** maps to **lifecycle status** outcomes. Status as columns (lifecycle order), frequency as rows.

## Drives
snapshot · scheme (multi-select).

## Measures
`BILL_COUNT` per (frequency, status) cell.

## Charts (top)
1. **Status mix per frequency** — horizontal stacked bar, categorical (statuses, lifecycle order).
2. **Frequency × Status matrix** — heatmap (sequential blue), row=freq, col=status.

## Table
`FREQUENCY | <each status> | Total` (rows sorted by total; blank freq = `(unset)`).

## Modes
Current · Compare (Δ total per frequency). Trend hidden.

## Notes
- Col is a **dimension** here (status), so cells are grouped bill counts (Path B crosstab).
- Tests e.g. whether MONTHLY bills complete differently from LUMP_SUM.
