# 21 — Trustee Portfolio (tab 20)

Per **trustee**: how many schemes it runs, total bills, and how **concentrated** each portfolio is (share of bills from its single largest scheme).

## Drives
snapshot (scheme filter does not apply — spans all trustees).

## Measures
distinct scheme count, Σ bills, on-time %, coverage %, top scheme + its share.

## Charts (top)
1. **Schemes per trustee** — horizontal bar, sequential (portfolio breadth).
2. **Top-scheme concentration per trustee** — horizontal bar, diverging vs 50% (concentration = top scheme's bills / trustee's bills).

## Table
`TRUSTEE | Schemes | Bills | On-time % | Coverage % | Top scheme | Concentration %`.

## Modes
Current only.

## Notes
- High concentration = a trustee's volume rests mostly on one scheme (risk/concentration signal).
- Complements the Trustee tab (which shows channel mix); this shows portfolio shape.
