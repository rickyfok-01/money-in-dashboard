# 05 — Contribution Mode (tab 4)

`AV_BILL_CONTR_MODE` — REGULAR vs LUMP_SUM vs SURCHARGE (3 values).

## Drives
- snapshot (default latest) · scheme.

## Measures
bill, total submit, on-time → on-time%, coverage%, mode share.

## Charts (top)
1. **Bills by mode** — vertical bar, **categorical** 3 slots (REGULAR/LUMP_SUM/SURCHARGE).
   3 series ≤ 3 → comfortable; direct-label each bar.
2. **Mode share per month** — stacked column (6 months), categorical 3.
3. **Mode part-to-whole** — single horizontal stacked bar (100%), categorical 3,
   direct-labeled with %.

## Table (below)
| mode | bills | submits | on-time% | coverage% | % of bills |
- 3 rows; mono numbers.

## Modes
- Current (default) · **Compare** (mode share A vs B) · **Trend** (mode share over
  6 months = the stacked column chart). All meaningful.

## Notes
- Only 3 categories — ideal for direct labels; no legend box needed (title names them).
