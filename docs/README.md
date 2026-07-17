# Contribution Snapshot Dashboard — build plan

This folder is the plan. Each tab has its own spec; build follows the specs in order.
Read `00-architecture.md` first — it defines the data model, the design system
(palette + type), and the shared features (filters, Compare/Trend, drill-through)
that every tab reuses.

## Agile workflow

Work proceeds in **iterations** on the **superpowers plugin** backbone (already
enabled in `.claude/settings.json`). To add or change a tab, run an iteration —
not a one-off edit:

- `docs/AGILE.md` — the playbook (5-role team: Analyst → Engineer → Reviewer → Process Reviewer → Doc-keeper; superpowers skills; zero-context protocol; archive rules).
- `docs/ROADMAP.md` — the sequenced backlog (3 data areas × 3 depth levels → 8 iterations).
- `docs/STATUS.md` — read first in any session; current iteration + next free tab.
- `docs/ITERATION-LOG.md` — append-only history, one row per iteration.
- `docs/superpowers/plans/_template.md` — copy this to start an iteration plan.

Start an iteration: copy the template → **Analyst** fills it → **Engineer** builds →
**Reviewer** verifies (code) → **Process Reviewer** audits the process → **Doc-keeper**
archives. Full detail in `docs/AGILE.md`.

## Spec index

| Doc | Tab | Dimension / angle |
|---|---|---|
| `00-architecture.md` | — | data model, design system, shared features |
| `01-summary.md` | **Summary** (tab 0) | overview; KPIs + clickable charts → detail tabs |
| `02-scheme-scorecard.md` | tab 1 | per-scheme master table (scheme-centric) |
| `03-status-lifecycle.md` | tab 2 | `AV_STATUS_CODE` |
| `04-trustee.md` | tab 3 | `TR_CODE` (12 trustees) |
| `05-contribution-mode.md` | tab 4 | `AV_BILL_CONTR_MODE` (REGULAR/LUMP_SUM/SURCHARGE) |
| `06-frequency.md` | tab 5 | `AV_FREQ_TYPE` (9 frequencies) |
| `07-account-type.md` | tab 6 | `SHORT_CODE` (6 account types) |
| `08-submit-channel.md` | tab 7 | DDE/BATCH/PORTAL/BULKUPLOAD/OTHER mix |
| `09-ontime-performance.md` | tab 8 | on-time submit rate, ranked vs target |
| `10-submit-funnel-coverage.md` | tab 9 | BILL → submitted → on-time funnel + coverage |
| `11-monthly-trend.md` | tab 10 | time-series across the 6 months |
| `12-snapshot-comparison.md` | tab 11 | A-vs-B delta across the whole dataset |
| `13-status-channel.md` | tab 12 | Status × Channel crosstab |
| `14-trustee-channel.md` | tab 13 | Trustee × Channel crosstab |
| `15-frequency-status.md` | tab 14 | Frequency × Status crosstab |
| `16-payment-outcome.md` | tab 15 | paid-outcome status split |
| `17-backlog.md` | tab 16 | pending / work-in-progress |
| `18-completion.md` | tab 17 | terminal-state completion rate |
| `19-outliers.md` | tab 18 | schemes >1σ from the peer mean |
| `20-volume-tiers.md` | tab 19 | XS…XL volume tiers |
| `21-trustee-portfolio.md` | tab 20 | trustee breadth & concentration |
| `25-summary-v2.md` | tab 25 | **Summary V2** — compact 3-category overview (bill, payment, direct debit) |

## Build order

1. `scripts/build_data.py` → `data.js` (one row per dim-combo per snapshot; latest 6 months only).
2. `index.html` shell: design-system CSS, sidebar nav, global filter bar, tab router, shared chart/table/aggregation helpers.
3. Tabs in doc order (01 → 12); each = charts-on-top + table-below, driven by the global filters.
4. Wire Summary chart clicks → detail-tab navigation (drill-through).
5. Validate categorical palette (already PASS — see architecture); eyeball every chart for collisions/overflow.

## Per-tab doc contract

Every tab doc states: **Purpose · Drives · Measures · Charts (form + color job) ·
Table columns · Modes (Current/Compare/Trend applicability) · Notes.** Build each
tab to match its doc exactly.
