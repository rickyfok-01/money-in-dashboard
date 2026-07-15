# AGENTS.md — money-in-dashboard

High-signal facts for OpenCode sessions working in this repo. Read docs/STATUS.md first in a zero-context session.

## Setup & commands

- **No build step, no package.json, no CI.** Vanilla JS, plain `<script>` tags, runs from `file://`.
- `python scripts/build_data.py` — regenerate `data.js` from CSVs + xlsx (run after any CSV change).
- `start index.html` — open in browser on Windows.
- Internet needed for charts (Chart.js 4.4.7 + D3 7 via CDN); tables work offline.
- No automated test runner. Verification is a jsdom smoke harness (described in docs/STATUS.md §3).
- No linter, formatter, typechecker.

## Critical gotchas

- **`data.js` IS tracked and committed** despite `.gitignore` line 10 saying `data.js` — ignore that stale Vite cruft. Never hand-edit `data.js`; regenerate via `build_data.py`.
- **Never `git add -A` or `git add .`** — `data/` may contain stray Vite files (listed in `.gitignore`) that must never be committed. Stage explicitly.
- **D3 is NOT dead weight.** Removing the `d3@7` `<script>` tag breaks the Summary tab (SVG charts). Always keep it.
- **Global filter toolbar is dead code.** `#fMode` element doesn't exist in the DOM. No functional Current/Compare/Trend toggle in chrome. Tab-internal mode switches (like Money Allocation's) work on their own.
- **Git commit style:** terse/casual (`change`, `New`, `x`) — personal project.
- **Adding a tab:** tabs use strict sequential numbering 00–24; inserting requires renumbering the `TABS` tail. Write `docs/NN-*.md` spec first, then implement.

## Load order (must preserve)

Script tags in `index.html` load in this exact order:

```
data.js → core.js → charts.js → tabs-summary.js → tabs-detail.js → tabs-settings.js → tabs-alloc.js → app.js
```

`app.js` (TABS dispatch + init) loads last because `TABS` references render functions from the `tabs-*.js` files.

## Architecture

- **25 tabs** (0–24), each with a spec in `docs/NN-*.md`. `docs/00-architecture.md` covers design system + data model.
- **Global `DATA`** object: `DATA.rows` (bill data), `DATA.pym` (payment data), `DATA.names` (scheme/trustee name lookup).
- **Key measurements:** `BILL_COUNT`, `ONTIME_SUBMIT_COUNT`, `TOTAL_SUBMIT_COUNT`, 5 channel counts, `PAY_AMT`, `AVAIL_AMOUNT`.
- **Derived metrics (client-side):** on-time rate = `ONTIME/TOTAL`, submit coverage = `TOTAL/BILL`, ALLOC% = `ΣPAY / (ΣPAY + ΣAVAIL)`.
- **Scheme is primary entity.** Scheme picker drives every tab; every table keyed by `SCHEME_CODE`.
- **Latest 6 YEAR_MONTHs only** — older months dropped by `build_data.py`.

## Source data (not committed)

All raw CSVs + xlsx in `data/` are gitignored. The repo ships the built `data.js` instead:
- `data/con-bill-6mon-*.csv` → `DATA.rows`
- `data/con-pym-6mon-*.csv` → `DATA.pym`
- `data/constant-scheme-info.xlsx` → `DATA.names`
- `data/dda-*.csv`, `data/ddi-*.csv` — ignored (not consumed by build script)

## Data collection tooling

`data/data-source/` contains `Run-StatisticQueries.ps1` (PowerShell Oracle data collector). Its `.env` holds live DB credentials — never commit. See `data/data-source/README.md`.
