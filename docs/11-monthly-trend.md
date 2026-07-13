# 11 — Monthly Trend (tab 10)

The dedicated **time-series** tab — every metric across the 6 contribution months.
(Trend is also a mode on other tabs; this tab is the all-in-one trend view.)

## Drives
- snapshot (default latest — trend is computed *within* the selected snapshot) · scheme.
- **Compare** is allowed here as an overlay: two snapshot trend-lines per metric.

## Measures
bill, total submit, on-time → rates, per YEAR_MONTH.

## Charts (top)
1. **Multi-line: bills / submits / on-time over months** — 3 lines, **categorical** 3,
   crosshair+tooltip, direct-labeled at the last point.
2. **Status mix over months** — stacked area, categorical (lifecycle order).
3. **On-time rate over months** — single line + target reference line, **emphasis**
   (one accent hue + gray target).
4. **Coverage over months** — single line, emphasis.

## Table (below)
| month | bills | submits | on-time | on-time% | coverage% |
- 6 rows, month ascending; mono numbers.

## Modes
- **Trend is the whole tab** — mode toggle is locked to Trend (hidden or disabled),
  since every chart is already a time series.
- Compare overlay: in Compare, each line chart shows snapshot A (solid) + B (dashed),
  same hue per metric, distinguished by stroke pattern not extra color.

## Notes
- Time axis = the 6 YEAR_MONTHs, evenly spaced, categorical x (not continuous time).
- In Compare overlay, keep one hue per metric; don't double the categorical palette.
