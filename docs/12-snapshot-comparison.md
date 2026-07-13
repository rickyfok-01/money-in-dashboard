# 12 — Snapshot Comparison (tab 11)

The dedicated **A-vs-B delta** tab — pick two snapshot dates and see how every metric
moved across the whole dataset. (Compare is also a mode on other tabs; this tab is the
all-in-one comparison.)

## Drives
- **two snapshot selectors**: snapshot A (default previous) and snapshot B (default latest).
- scheme (default All → deltas per scheme; selecting one narrows to that scheme's Δ).
- mode toggle locked to **Compare**.

## Measures
Δ = B − A for counts; Δ for rates (on-time%, coverage%) shown in percentage-points.

## Charts (top)
1. **Δ bills per scheme** — horizontal diverging bar around 0, **diverging** blue↔red,
   gray midpoint. Sorted by Δ desc. Direct-label Δ.
2. **Δ on-time rate per scheme** — horizontal diverging bar (percentage-points).
3. **KPI Δ tiles** — Total Bills Δ · Submits Δ · On-time Rate Δ · Coverage Δ, each with
   ↑/↓ arrow + status ink (good/crit), `Fraunces` hero figure.

## Table (below)
| scheme | bills_A | bills_B | Δ bills | on-time%_A | on-time%_B | Δ rate | coverage%_A | coverage%_B | Δ coverage |
- Δ columns color-coded by sign (ink, not the diverging fill, per dataviz rule: values
  wear text tokens); a small ▲/▼ glyph + diverging-tinted chip for sign.

## Modes
- **Compare is the whole tab** — mode toggle hidden/locked.

## Notes
- Diverging midpoint is 0 (no change), gray. Positive (B>A) = blue, negative = red.
- Text/values stay in ink tokens; only the bar *fill* and a tiny sign chip use the
  diverging hues — never color the number itself.
- This tab and the per-tab Compare mode share the same `compareRows(A,B, keyFn)`
  helper.
