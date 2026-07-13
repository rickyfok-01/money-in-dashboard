# 03 — Status Lifecycle (tab 2)

Distribution of bills across the 10-value `AV_STATUS_CODE` lifecycle, shown as a
lifecycle (left→right), not alphabetically.

## Canonical order
`OPEN → PARTIAL_SUBMIT → SUBMITTED → APPROVED → PARTIAL_PAID → FULLY_PAID → CLOSED`
(forward path), plus terminal/edge `OVERPAID`, `REFUND_OVERPAID`, `WAIVED`.

## Drives
- snapshot (default latest) · scheme.

## Measures
`BILL_COUNT` split by status. (% of total = status bills / Σ bills.)

## Charts (top)
1. **Status mix per month** — stacked column, 6 months × 10 statuses, **categorical**,
   lifecycle slot order. Legend present (10 > 4 → legend, no per-point labels).
2. **Total bills by status** — horizontal bar in lifecycle order, **sequential**
   one-hue (identity is the lifecycle *position*, which is ordinal → one hue).
3. **Forward-path funnel** — `OPEN → SUBMITTED(group) → APPROVED → PAID → CLOSED`,
   **ordinal** blue ramp (light→dark, light end ≥ step 250 for ≥2:1).

## Table (below)
| status | bills | % of total | (per selected scheme: bills) |
- Lifecycle order; mono numbers, right-aligned.

## Modes
- Current (default) · **Compare** (status mix A vs B — side-by-side stacked or Δ
  column) · **Trend** (the per-month stacked chart *is* the trend). All meaningful.

## Notes
- Status order is structural — never sort alphabetically on this tab.
- 10 categorical series is at the token ceiling; if a chart feels crowded, split the
  forward-path funnel (ordinal) from the edge statuses.
