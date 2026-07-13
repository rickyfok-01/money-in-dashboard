# 01 — Summary (tab 0)

The overview. KPIs at the top, then clickable charts that drill through to the
detail tabs, then a top-schemes table. This is the landing tab.

## Drives
- snapshot (default `latest`) · scheme (default *All*) · month range (default all 6).
- **Compare** shows KPI Δ vs the previous snapshot; **Trend** shows high-level
  6-month lines (counts, status mix, on-time rate vs median, coverage). The
  dedicated Monthly Trend tab owns the full per-key + A-vs-B overlay toolkit.

## Measures
All (bill, total submit, on-time, 5 channels) + derived rates.

## Layout
1. **KPI row** — 6 stat tiles (not charts):
   Total Bills · Total Submits · On-time Rate · Submit Coverage · Active Schemes ·
   Trustees. Each tile features:
   - Label in teal color (`#0D7D80`), uppercase, small caps
   - Large monospace value
   - Month-over-month (MoM) indicator with arrow and percentage (up=teal, down=red)
   - Sub-text description below the value
   - Mini line chart showing trend vs target baseline
   In Compare mode each tile shows Δ vs previous snapshot (↑↓ ink/status).
2. **Charts grid** (each clickable → detail tab):
   - **Scheme × Month heatmap** of `BILL_COUNT` — sequential blue ramp.
     Click a cell → **Scheme Scorecard** with that scheme pre-selected. *(click)*
   - **Status mix** — horizontal stacked bar, status lifecycle order, categorical.
     Click a segment → **Status Lifecycle**. *(click)*
   - **Submit-channel mix** — stacked bar of the 5 channels, categorical.
     Click a segment → **Submit Channel**. *(click)*
3. **Table** — top-10 schemes summary (scheme · bills · submits · on-time% · coverage%).
   Row click → **Scheme Scorecard**.
4. **Submission status by month** — 100% stacked status bar per cell. Placed above the heatmap. Same design as item 4 above (same bar-in-cell, same 4 buckets). A header above the table maps the four colors to bucket names.

## Modes
- Current (default) · Compare (Δ on KPI tiles vs previous snapshot) · Trend
  (6-month lines: counts, status mix, on-time rate vs median, coverage).

## KPI Tile Design
Each KPI tile follows this visual structure:
- **Label**: Teal color (`#0D7D80`), uppercase, `0.7rem`, letter-spacing `0.06em`
- **Value**: Large monospace font (`2.1rem`), bold
- **MoM indicator**: Arrow (↑/↓/→) + percentage, teal for positive, red for negative
- **Sub text**: Small muted description below
- **Mini chart**: Line chart with actual value (solid teal line) vs target (dashed gray line), 36px tall

## Notes
- This is the only tab that *navigates* to others; keep the click affordance obvious
  (cursor pointer, hover ring, "click to drill" hint in tile footer).
- KPI tiles use monospace font for values (consistent with the design system).
