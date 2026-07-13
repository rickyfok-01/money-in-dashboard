# 08 — Submit Channel (tab 7)

The **core of Query 2**: the submit-channel mix — DDE, BATCH, PORTAL, BULK_UPLOAD,
OTHER. This is the tab the source query was written to answer.

## Drives
- snapshot (default latest) · scheme.

## Measures
`DDE/BATCH/PORTAL/BULKUPLOAD/OTHER_SUBMIT_COUNT` → channel **share** of all submits.
(submit totals are bill-level "≥1 submit" flags summed; channel counts are raw submit
counts — document this nuance in the chart caption so shares are read correctly.)

## Charts (top)
1. **Channel share per month** — stacked column (6 months × 5 channels), **categorical**
   fixed slot order. Legend + selective labels.
2. **Channel totals** — horizontal bar, categorical 5, direct-labeled with count + %.
3. **Channel usage per scheme** — stacked horizontal bar (top-N schemes × 5 channels),
   categorical. *(if all 25 schemes crowd it, show top-10 + "Other")*
4. **Overall part-to-whole** — single 100% stacked bar or donut, categorical 5,
   direct-labeled.

## Tables (below)
1. **Channel — data** (all-time snapshot total):
   | CHANNEL | Type | Submit count | Share % |
   - 5 rows; mono numbers.
   - Type column shows Electronic/Paper badge.

2. **Channel — last 3 months** (current mode):
   | Month | DDE | DDE % | BATCH | BATCH % | PORTAL | PORTAL % | BULK | BULK % | OTHER | OTHER % | Total |
   - Shows count and percentage for each channel by month.
   - Displays the 3 most recent contribution months.

## Modes
- Current (default) · **Compare** (channel-share shift A vs B — a diverging stacked or
  Δ column) · **Trend** (channel share over 6 months = chart 1). All meaningful.
- Trend mode table also includes % columns for each channel by month.

## Notes
- Channels are **identity** → categorical, fixed slot order (DDE→BATCH→PORTAL→
  BULK→OTHER). Never reorder by value.
- This is the tab Summary's channel-mix chart drills into.
- Percentage columns help identify adoption trends and channel shifts month-over-month.
