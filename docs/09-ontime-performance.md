# 09 — On-time Performance (tab 8)

On-time submit **rate** analysis — `ONTIME_SUBMIT_COUNT / TOTAL_SUBMIT_COUNT` —
ranked across schemes and trustees, read against a target.

## Drives
- snapshot (default latest) · scheme.
- target (default = dataset **median** on-time rate; configurable via a small input).

## Measures
on-time rate = Σontime / Σtotal. (Ratio of sums.)

## Charts (top)
1. **Ranked on-time rate per scheme** — horizontal bar sorted by rate, **diverging**
   blue↔red around the target line (above target = blue/positive, below = red).
   Direct-label rate% on each bar.
2. **Bills vs on-time rate** — scatter, one dot per scheme (x = bills, y = on-time%),
   **categorical by slot is wrong here** → use a single hue + a target horizontal line;
   label outliers. (`--pairs all` if any two dots can be neighbors.)
3. **On-time rate per trustee** — horizontal bar, diverging vs target.

## Table (below)
| scheme | bills | submitted | on-time | on-time% | rank | vs target |
- Sorted by on-time% desc; `vs target` = status chip (good/serious/crit).
- mono numbers; status chip carries icon+label (never color alone).

## Modes
- Current (default) · **Compare** (rate Δ A vs B per scheme — diverging Δ column) ·
  **Trend** (rate over 6 months, one line per top-N scheme). All meaningful — Compare
  is especially valuable here (did timeliness improve snapshot-over-snapshot?).

## Notes
- Rate is a ratio → always Σ/Σ, never average of per-row rates.
- Diverging midpoint = the target, drawn as a hairline reference, not a colored band.
