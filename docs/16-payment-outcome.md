# 16 — Payment Outcome (tab 15)

Among **paid-outcome bills** only — the split across `FULLY_PAID / PARTIAL_PAID / OVERPAID / REFUND_OVERPAID / WAIVED`.

## Drives
snapshot · scheme (multi-select).

## Measures
`BILL_COUNT` restricted to the 5 paid-outcome statuses.

## Charts (top)
1. **Outcome mix** — doughnut, categorical 5.
2. **Paid outcome over months** — stacked column (6 months), categorical 5.

## Table
`SCHEME | FULLY_PAID | PARTIAL_PAID | OVERPAID | REFUND_OVERPAID | WAIVED | Paid total`
(sorted by paid total; click a scheme to focus).

## Modes
Current · Compare. (Trend hidden; the per-month stack is the trend view.)

## Notes
- Filters the dataset to paid-outcome bills before aggregating.
- Surfaces overpayment / waiver patterns by scheme.
