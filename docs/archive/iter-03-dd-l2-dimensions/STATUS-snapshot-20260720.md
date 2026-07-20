# STATUS — money-in-dashboard (current state)

> **Read this first.** Current-state snapshot. Last updated 2026-07-17.
> Iteration history → `docs/ITERATION-LOG.md`. **Start an iteration** → `docs/AGILE.md`
> (read-set §4, skill map §2); copy `docs/superpowers/plans/_template.md`; execute via
> `superpowers:subagent-driven-development`.

## Current iteration
**iter-03 — DD L2 (DDI + DDA Dimensions, parallel build) — not started. Next free tab: 27.**
See ROADMAP row 3 (`docs/ROADMAP.md`). iter-02 (DD Overview tab #26) shipped.
Framework-friction backlog (iter-0 patch) → `docs/FRAMEWORK-BACKLOG.md`.
Note: `data/ddi-aging-20260713.csv` is a malformed SQL dump → `ddiAging` ships only 4 snapshots
(20260714–17). Tab 26 guards this (<2-snapshot `pend-empty`); Oracle re-export remains open, non-blocking.

## Orientation
A no-build vanilla-JS MPF dashboard: `index.html` + `js/*.js` plain `<script>` modules
(Chart.js 4.4.7 + D3 7 via CDN). `scripts/build_data.py` folds 7 CSV families + 1 xlsx
into `data.js` (`const DATA`). **27 tabs** (00–26) across 3 data areas (Bill / Payment /
Direct Debit). Scheme is the primary entity; latest 6 contribution months only.

## Run / verify
```bash
python scripts/build_data.py   # regenerate data.js after any CSV/xlsx change
start index.html               # open in browser (Windows)
```
**jsdom smoke harness** (catches `ReferenceError`/logic throws, not pixels — no canvas in jsdom):
1. App string = `index.html` body + a `<script src data.js>` block.
2. `beforeParse(window)`: inject Chart.js + d3 via `window.eval(lib)`, then
   `window.eval(dataJs + "\n;globalThis.DATA = DATA;")` (inline `<script>` throws
   `SyntaxError`; `const DATA` is eval-scoped → append `globalThis.DATA` in the *same* eval).
3. Stub `window.ResizeObserver`; filter canvas `getContext` errors.
4. `window.eval(appJs)`, render each target tab into a host div; assert 0 `onerror`/`uncaughtException`.

## Next free tab
**27** (after 26 DD Overview). Strict-sequential; inserting mid-array renumbers the
`TABS` tail — prefer appending.

## Live files
| File | Role |
|---|---|
| `index.html` | the app — sidebar + content; Chart.js + D3 via CDN |
| `data.js` | generated `const DATA`; **never hand-edit** |
| `scripts/build_data.py` | CSVs + xlsx → data.js; emits `rows, pym, aoAging, ddi30, ddiAging, dda30, ddaAging, names` |
| `js/core.js` `js/charts.js` `js/tabs-*.js` `js/app.js` | modules; load order in `AGENTS.md §Load order` |
| `docs/AGILE.md` `docs/ROADMAP.md` | iteration system (superpowers backbone) |
| `docs/00-architecture.md` | data model + design system (durable foundation) |
| `CLAUDE.md` / `AGENTS.md` | how to work here + critical gotchas |

## Gotchas (compressed — full detail in `AGENTS.md §Critical gotchas`)
- **D3 is load-bearing** — never delete its `<script>` tag (breaks Summary's SVG charts).
- **No functional global filter toolbar** — `#fMode` is dead code; tabs read `state.*` defaults.
- **eval scope in the smoke harness** — append `globalThis.DATA = DATA` in the same eval.
- **`data.js` IS tracked** despite `.gitignore` line 10 (stale Vite cruft).
- **Never `git add -A` / `git add .`** — `data/` may hold stray Vite files. Stage explicitly.
- **Strict sequential tab numbering** (00–26); write `docs/NN-*.md` spec before implementing.

## Git state
Branch `feat/loop-agile`. Commit style terse/casual (personal project). Raw CSVs/xlsx in
`data/` are gitignored; the repo ships the built `data.js`.
