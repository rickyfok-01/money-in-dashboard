# STATUS — money-in-dashboard (current state)

> **Read this first.** Current-state snapshot. Last updated 2026-07-17.
> Iteration history → `docs/ITERATION-LOG.md`. **Start an iteration** → `docs/AGILE.md`
> (read-set §4, skill map §2); copy `docs/superpowers/plans/_template.md`; execute via
> `superpowers:subagent-driven-development`.

## Current iteration
**iter-01 — Bill audit** — pending (plan not yet written). Next free tab: **26**.
See ROADMAP row 1 (`docs/ROADMAP.md`). Pre-flight: refresh stale `data.js`
(CSVs are one snapshot ahead) and add `data/constant-scheme-info.xlsx` (else `DATA.names` is empty).

## Orientation
A no-build vanilla-JS MPF dashboard: `index.html` + `js/*.js` plain `<script>` modules
(Chart.js 4.4.7 + D3 7 via CDN). `scripts/build_data.py` folds 7 CSV families + 1 xlsx
into `data.js` (`const DATA`). **26 tabs** (00–25) across 3 data areas (Bill / Payment /
Direct Debit). Scheme is the primary entity; latest 6 contribution months only.

## Run / verify
```bash
python scripts/build_data.py   # regenerate data.js after any CSV/xlsx change
start index.html               # open in browser (Windows)
```
**jsdom smoke harness** (the verification method — no canvas in jsdom, so it catches
`ReferenceError`/logic throws, not pixels):
1. Build the app string from `index.html` body + a `<script src data.js>` block.
2. jsdom `beforeParse(window)` — inject Chart.js + d3 via `window.eval(lib)`, then
   `window.eval(dataJs + "\n;globalThis.DATA = DATA;")`. (**Not** inline `<script>` —
   that throws `SyntaxError`; the eval path works. `const DATA` is eval-scoped, hence
   the `globalThis.DATA` append in the *same* eval.)
3. Stub `window.ResizeObserver` (no-ops); filter canvas `getContext` errors.
4. `window.eval(appJs)`, render each target tab into a host div; assert
   `window.onerror` / `uncaughtException` fired **0** times.

## Next free tab
**26** (after 25 Summary V2). Tab numbering is strict-sequential; inserting mid-array
requires renumbering the `TABS` tail — prefer appending.

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
- **Strict sequential tab numbering** (00–25); write `docs/NN-*.md` spec before implementing.

## Git state
Branch `feat/loop-agile`. Commit style terse/casual (personal project). Raw CSVs/xlsx in
`data/` are gitignored; the repo ships the built `data.js`.
