# 06 — Frequency (tab 5)

`AV_FREQ_TYPE` — 9 contribution frequencies (MONTHLY, FORTNIGHTLY, WEEKLY,
SEMI_MONTHLY, BI_MONTHLY, QUARTERLY, SEMI_ANNUALLY, ANNUALLY, DAILY) + a blank value
rendered as `(unset)`.

## Drives
- snapshot (default latest) · scheme.

## Measures
bill, total submit, on-time → on-time%, coverage%.

## Charts (top)
1. **Bills per frequency** — horizontal bar, sorted desc, **sequential** one-hue
   (identity is "which frequency" but ordered by magnitude → one hue, not 9 colors).
2. **Frequency mix per month** — stacked column (6 months). 9 series → keep legend,
   fold the smallest into "Other" if any slice < ~2% to stay readable.
3. **On-time rate per frequency** — horizontal bar, sequential one-hue.

## Table (below)
| frequency | bills | submits | on-time% | coverage% | % of bills |
- Sorted by bills desc; mono numbers.

## Modes
- Current (default) · **Compare** (per-frequency Δ A vs B) · **Trend** (the per-month
  stacked chart). All meaningful.

## Notes
- 9 series > 8 token ceiling → for the per-month stack, group the 3–4 smallest
  frequencies into "Other" rather than adding a 9th hue.
- Sort frequencies by bills (magnitude), not alphabetically — the chart's job is
  "which frequencies carry the volume".
