# 13 — Status × Channel (tab 12)

Cross-analysis: does the **submit-channel mix** differ by bill **status**? Channels as columns (measures), statuses as rows (lifecycle order).

## Drives
snapshot · scheme (multi-select).

## Measures
the 5 channel counts (`dde/batch/portal/bulk/other`) summed per status.

## Charts (top)
1. **Channel mix per status** — horizontal stacked bar, **categorical** 5 (channels).
2. **Status × Channel matrix** — heatmap of bills (sequential blue), row=status, col=channel.

## Table
`STATUS | DDE | BATCH | PORTAL | BULK | OTHER | Total` (lifecycle order).

## Modes
Current · Compare (Δ total per status). Trend hidden (crosstab).

## Notes
- Channel counts are submit-level and summable per group — valid cross.
- Read it as: "do APPROVED/CLOSED bills use a different channel mix than OPEN?"
