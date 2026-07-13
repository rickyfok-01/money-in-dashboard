# 19 — Outliers & Exceptions (tab 18)

A **watchlist**: schemes (≥50 bills) deviating more than 1σ from the peer mean on on-time rate **or** coverage.

## Drives
snapshot (scheme filter does not apply — this tab intentionally scans all schemes).

## Measures
on-time rate, coverage → z-scores (per-scheme, unweighted) vs the peer mean/std.

## Charts (top)
1. **Exception schemes (|z|>1)** — horizontal bar of max|z|, red if >2σ.
2. **On-time rate vs bills** — scatter of all qualifying schemes, outliers highlighted red.

## Table
`SCHEME | Bills | On-time % | OT z | Coverage % | Cov z | Flag` (Flag = which metric + direction, as a status chip).

## Modes
Current only (a snapshot diagnostic; min-volume = 50 bills).

## Notes
- This is where genuinely anomalous schemes surface (e.g. a large scheme with unusually low on-time).
- z = (value − mean) / std across the qualifying scheme set.
