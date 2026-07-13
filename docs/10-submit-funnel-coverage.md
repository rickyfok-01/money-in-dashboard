# 10 — Submit Funnel & Coverage (tab 9)

The bill→submit→on-time **funnel** and the **coverage** ratio
(`TOTAL_SUBMIT_COUNT / BILL_COUNT` — share of bills that were submitted at all).

## Drives
- snapshot (default latest) · scheme.

## Measures
`BILL_COUNT → TOTAL_SUBMIT_COUNT → ONTIME_SUBMIT_COUNT` (3-stage funnel);
coverage = Σtotal / Σbill.

## Charts (top)
1. **Funnel** — 3 stages (Billed → Submitted → On-time), **ordinal** blue ramp
   (light→dark, light end ≥ step 250 for ≥2:1 on surface). Direct-label each stage
   with count + % of bills.
2. **Coverage per scheme** — horizontal bar, **diverging** around 100% (or a target),
   sorted desc. Direct-label % .
3. **Per-month stack** — billed vs submitted-not-on-time vs on-time, stacked column
   (6 months), categorical 3.

## Table (below)
| scheme | bills | submitted | submitted% (coverage) | on-time | on-time-of-submitted% |
- Sorted by bills desc; mono numbers.

## Modes
- Current (default) · **Compare** (funnel A vs B side-by-side; coverage Δ) · **Trend**
  (coverage over 6 months). All meaningful.

## Notes
- Funnel stages are **ordinal** (ordered) → one-hue ramp, not 3 categorical colors.
- Distinguish two on-time denominators on this tab: on-time **of submitted**
  (ontime/total) vs on-time **of billed** (ontime/bill). Label both clearly.
