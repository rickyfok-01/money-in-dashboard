# ROADMAP — sequenced backlog

The master plan: build **depth tiers** (L1 Overview → L2 Dimensions → L3 Analysis)
across **3 data areas** — Contribution Bill, Contribution Payment, Direct Debit
(DDA + DDI). Each row is one iteration (one superpowers plan; see `docs/AGILE.md`).

> Mutate this file as priorities shift. Status lives in `docs/STATUS.md`;
> history in `docs/ITERATION-LOG.md`.

## Legend
- **Levels:** L1 Overview (KPIs) · L2 Dimensions (breakdowns) · L3 Analysis (crosstab/aging/outliers)
- **Tab patterns:** A=`renderGrouped` (generic dimension) · B=custom overview · C=pym-style matrix · D=`renderCross` (crosstab) · `—`=audit/hygiene (no new tab; e.g. iter-01, iter-07)
- **DATA keys:** `rows` (bill, sql-05) · `pym`+`aoAging` (payment, sql-06/07) · `ddi30`/`ddiAging` (sql-01/02) · `dda30`/`ddaAging` (sql-03/04)

## Area coverage today
- **Bill** (`DATA.rows`) — L1+L2+L3 already complete (tabs 0,1,25 / 3–9 / 10–22). Audit-only.
- **Payment** (`DATA.pym`, `DATA.aoAging`) — L1 done (tab 02 Money Allocation + Summary V2). L2+L3 to build.
- **Direct Debit** (`DATA.ddi*`, `DATA.dda*`) — greenfield. L1+L2+L3 to build.

## Iterations

| Iter | Domain / Level | Goal (one line) | DATA keys | Pattern | Ref tab | New tabs | Status |
|---|---|---|---|---|---|---|---|
| 00 | meta | Build the agile system (superpowers backbone). | — | — | — | none | shipped |
| 01 | Bill audit | Confirm Bill L1/L2/L3 coverage; gap-fill if any; refresh stale `data.js` + add `constant-scheme-info.xlsx` (pre-flight). | `rows` | — | — | 0–1 | shipped |
| 02 | DD L1 | Direct Debit Overview — DDI+DDA 30-day + aging KPIs, one page. **Adds "Direct Debit" sidebar group.** | `ddi30,ddiAging,dda30,ddaAging` | B | summary-v2 (25) | 1 (#26) | — |
| 03 | DD L2 | DDI Dimensions + DDA Dimensions (per trustee/scheme/account-type). **Parallel build.** | `ddi30,dda30` | A | submit-channel (09) | 2 (#27,28) | — |
| 04 | DD L3 | DDI/DDA aging crosstabs + outlier schemes on success/active rates. | `ddiAging,ddaAging` | D + outliers | status-channel (14) | 2 (#29,30) | — |
| 05 | Payment L2 | Trustee / Channel / Tag-status Allocation. **Adds "Payment" sidebar group; moves tab 02 into it.** | `pym` | A/C | money-allocation (02) | 3 (#31,32,33) | — |
| 06 | Payment L3 | AO-aging deep dive + ALLOC% outlier watchlist + ALLOC% monthly trend. | `aoAging,pym` | D + outliers | outliers (20) | 2 (#34,35) | — |
| 07 | polish | Nav rework, cross-domain review, doc-consistency pass (fix `docs/README.md` spec-index drift). | — | — | — | 0 | — |

**Total:** ~10–11 new tabs across 8 iterations. Each Payment/DD iteration is
independently shippable.

## Sequencing rationale
- **DD first** — greenfield, no nav conflict with existing tabs; proves the
  playbook on a clean area.
- **Payment L2 second** — tab 02 already establishes the `DATA.pym` access pattern.
- **Bill audit (iter-01)** — light; confirms no gaps before deeper work and
  refreshes the stale dataset.
- **Polish last** — nav rework + doc-consistency once all tabs exist.

## Data hygiene (iter-01 pre-flight, flagged during iter-0 exploration)
- `data.js` is one snapshot behind the CSVs on disk (CSVs through 20260717;
  `DATA.snapshots` stops at 20260716) → re-run `python scripts/build_data.py`.
- `data/constant-scheme-info.xlsx` is absent → `DATA.names` is empty `{}` → obtain
  the xlsx so codes render with names.
- `DATA.ddiAging.rows[0]` is a blank-row artifact → confirm/handle in the DD tabs.
