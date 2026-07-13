# 02 — Scheme Scorecard (tab 1)

The scheme-centric master view. A row per scheme with every key metric + a monthly
sparkline. This is the primary "all pages are scheme_code based" landing from the
scheme dimension.

## Drives
- snapshot (default latest) · month range.
- scheme filter is **not** a narrowing filter here — the table lists **all** schemes;
  instead, **clicking a scheme row sets the global scheme filter** for the other tabs.

## Measures
bill, total submit, on-time, 5 channels → on-time%, coverage%, channel shares.

## Charts (top)
1. **Bills per scheme** — horizontal bar, sorted desc, sequential (one-hue) with the
   top bar emphasized.
2. **On-time rate per scheme** — horizontal bar, diverging blue↔red vs a target line
   (default target = dataset median; configurable).
3. **Coverage per scheme** — small horizontal bar, sequential (one-hue).

## Table (below)
| scheme_code | trustee | bills | submitted | on-time | on-time% | coverage% | DDE% | BATCH% | PORTAL% | BULK% | OTHER% | ▦ sparkline |
- Sorted by bills desc by default; all columns sortable.
- `sparkline` = monthly `BILL_COUNT` for that scheme (6-pt line), monospace-aligned.
- Row click → sets global `scheme` filter (highlights the row, narrows other tabs).

## Modes
- **Current** (default) · **Compare** (each scheme's metrics show Δ between snapshot
  A and B — a Δ column appears) · **Trend** (sparkline column expands; or toggle the
  top chart to a per-scheme monthly line). All three are meaningful here.

## Notes
- The most data-dense table; keep numbers `tabular-nums`, right-aligned, mono.
- scheme_code rendered in `--mono`.
