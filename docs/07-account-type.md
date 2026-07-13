# 07 — Account Type (tab 6)

`SHORT_CODE` — 6 member account types: TVC, SVC, REE, CEE, PAH, SEP.

## Drives
- snapshot (default latest) · scheme.

## Measures
bill, total submit, on-time, 5 channels → on-time%, coverage%, channel shares.

## Charts (top)
1. **Bills per account type** — horizontal bar, **categorical** 6 slots, direct-label.
2. **Account-type mix per month** — stacked column (6 months), categorical 6.
3. **Channel mix per account type** — stacked horizontal bar, categorical 5 (channels)
   grouped by account type.

## Table (below)
| account type | bills | submits | on-time% | coverage% | DDE% | BATCH% | PORTAL% | BULK% | OTHER% |
- Sorted by bills desc; mono numbers.

## Modes
- Current (default) · **Compare** (per-type Δ A vs B) · **Trend** (mix over 6 months).
  All meaningful.

## Notes
- 6 series is within the categorical cap; legend + selective direct labels.
- Channel-vs-accountType is the richest chart here (the Query-2 core viewed by
  account type) — keep it the widest tile.
