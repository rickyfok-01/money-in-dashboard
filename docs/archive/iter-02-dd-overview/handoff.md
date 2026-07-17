# 2026-07-17 — iter-02 — dd-overview — DD L1

> **For agentic workers:** REQUIRED SUB-SKILL: implement this plan with
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans`, task-by-task. Steps use checkbox (`- [ ]`)
> syntax for tracking. Team topology + handoffs: see `docs/AGILE.md`.

---

## START HERE (zero-context checklist)

READ, in order — nothing else:

1. `docs/STATUS.md` — current-iter pointer + next free tab #
2. **this plan**
3. `docs/00-architecture.md` — data model, design system, shared features
4. `AGENTS.md §Critical gotchas` — D3 load-bearing, dead global mode toggle, eval scope, gitignore cruft, sequential tab numbering
5. reference tab: `docs/25-summary-v2.md` + `js/tabs-summary-v2.js` (the Pattern B overview to copy)

DO NOT READ (context control): anything under `docs/archive/`, any other plan in
`docs/superpowers/plans/`, or `docs/ITERATION-LOG.md` past its last row.

State at branch: next free tab = **26**. `TABS` registry at `js/app.js:131`,
`NAV_GROUPS` at `js/app.js:246`. Script load order (`index.html`):
`data.js → core → charts → tabs-summary → tabs-detail → tabs-settings → tabs-alloc → tabs-summary-v2 → tabs-dd-overview → app.js` (new module loads **before** `app.js`).

---

**Iteration kind:** **feature** (ships 1 new tab).

**Goal:** A dedicated Direct Debit Overview page (tab 26) answering "how healthy is the DDI (instructions) + DDA (agreements) pipeline right now, how has it aged, and how is it moving snapshot-to-snapshot?"

**Architecture:** New `js/tabs-dd-overview.js` renderer (Pattern B, modelled on summary-v2) consumes all 4 DD DATA keys. A new "Direct Debit" sidebar group holds it. DD data is snapshot-level (no `ym`), so Trend plots across **each dataset's own snapshots** (not months).

**Tech Stack:** vanilla JS (plain `<script>`, no build), Chart.js 4.4.7 + D3 7 via CDN, CSS custom properties.

---

## 1. Scope

- **IN-SCOPE:** tab 26 "DD Overview" — KPI rib + 4 charts + 2 cards + per-scheme relief table; modes current/compare/trend; new `direct-debit` NAV group; `docs/26-dd-overview.md` spec.
- **OUT-OF-SCOPE:** DD L2 dimensions (iter-03), DD L3 aging crosstabs/outliers (iter-04), any bill/payment data (already on tabs 0/02/25), a global filter-bar mode toggle (#fMode is dead — tab reads `state.*`), fixing the malformed `ddi-aging-20260713.csv` source (data-hygiene follow-up, non-blocking).

## 2. Data contract  (self-contained — copy the row shape, don't link)

### 2.1 DATA keys used
- `DATA.ddi30` — from `data/ddi-30day-*.csv` (SQL-01). Shape `{snapshots:[...], rows:[...]}`.
- `DATA.ddiAging` — from `data/ddi-aging-*.csv` (SQL-02). Same shape.
- `DATA.dda30` — from `data/dda-30day-*.csv` (SQL-03). Same shape.
- `DATA.ddaAging` — from `data/dda-aging-*.csv` (SQL-04). Same shape.
- All four are **snapshot-level — no `ym`** (ignore month range). Aged datasets (`ddiAging`,`ddaAging`) and 30-day datasets (`ddi30`,`dda30`) may carry **different snapshot sets** — trend each on its own `snapshots` list. Top-level assembly: `scripts/build_data.py:446-449`.

### 2.2 Row shape  (verbatim from `scripts/build_data.py`)

```ts
// ddi30  (build_data.py:199-210)
{ s:string; tr:string; sc:string; at:string;            // SNAPSHOT_DATE, TR_CODE, SCHEME_CODE, SHORT_CODE
  date:string;                                          // DDI_REQUEST_DATE
  total:int; submitted:int; success:int; rejected:int } // COUNT, SUBMITTED_TO_BANK, SUCCESS, REJECTED

// ddiAging  (build_data.py:222-233)  — ddaAging is identical (:279-290)
{ s:string; tr:string; sc:string; at:string;
  total:int; d00_06:int; d07_14:int; d15_21:int; d22_30:int; d31:int }  // TOTAL, DAY_00_06..DAY_31_MORE

// dda30  (build_data.py:254-266)
{ s:string; tr:string; sc:string; at:string;
  total:int; submitted_pig:int; submitted_bank:int; active:int; inactive:int; rejected:int; suspend:int }
  // TOTAL, SUBMITTED_TO_PIG, SUBMITTED_TO_BANK, ACTIVE, INACTIVE, REJECTED, SUSPEND
// All measures are int (to_int). No floats in DD data.
```

### 2.3 Filter helper  (snapshot-level — no month range; mirror `js/tabs-summary-v2.js:14-33`)
```js
function ddi30For(snap){  if(!DATA.ddi30)   return []; return DATA.ddi30.rows.filter(r=>r.s===snap&&schemeOn(r)&&trusteeOn(r)); }
function ddiAgingFor(snap){if(!DATA.ddiAging)return []; return DATA.ddiAging.rows.filter(r=>r.s===snap&&schemeOn(r)&&trusteeOn(r)); }
function dda30For(snap){  if(!DATA.dda30)   return []; return DATA.dda30.rows.filter(r=>r.s===snap&&schemeOn(r)&&trusteeOn(r)); }
function ddaAgingFor(snap){if(!DATA.ddaAging)return []; return DATA.ddaAging.rows.filter(r=>r.s===snap&&schemeOn(r)&&trusteeOn(r)); }
function sumDD(a,k){ return a.reduce((s,r)=>s+(r[k]||0),0); }   // mirror sumAO (:35)
```
(`schemeOn`/`trusteeOn` from `js/core.js`. These helpers are identical to summary-v2's globals — define locally so the module is self-contained.)

### 2.4 Derived metrics  (ratio of sums — never mean of per-row ratios)
- DDI success% = `Σsuccess / Σtotal` (over filtered `ddi30For(snap)`)
- DDA active% = `Σactive / Σtotal` (over filtered `dda30For(snap)`)
- Aging 31d+ share = `Σd31 / Σtotal` (per aging dataset)
- Aging buckets labels: `["0-6d","7-14d","15-21d","22-30d","31d+"]` ← keys `d00_06,d07_14,d15_21,d22_30,d31`.

### 2.5 Tone / thresholds
- `ddTone(v)`: `≥0.98 → green / ≥0.95 → yellow / else red` (mirrors ALLOC% band at `js/tabs-summary-v2.js:183`). Aging ramp (green→red): `["#16a34a","#f59e0b","#f97316","#ef4444","#991b1b"]` (same as summary-v2).

## 3. Tab pattern

Pattern **B** — custom overview. Reference impl: `renderSummaryV2` (`js/tabs-summary-v2.js:84`), esp. its `renderSV2Current/Compare/Trend` structure and `miniBar`/`bucketCard`/`kpiPill`. Reuse `state.*` (`js/core.js`), `rowsFor`/`groupBy`/`ranked`/`el`/`card`/`buildTable` (`js/core.js`,`js/charts.js`), chart primitives `newBar`/`newLine`/`newDoughnut` (`js/charts.js`). Modes: **current · compare · trend**.

## 4. Files to touch

| File | Where | Change |
|---|---|---|
| `js/tabs-dd-overview.js` | new | `"use strict";` + `renderDDOverview(content)` (dispatch on `state.mode`) + `DDOverviewCurrent/Compare/Trend` + the §2.3 helpers |
| `js/app.js` | `TABS` `:131` (after summary-v2 `:209`) | add `{id:"dd-overview",n:"26",title:"DD Overview",sub:"Direct Debit pipeline — DDI+DDA 30-day + aging KPIs, one page.",modes:["current","compare","trend"],render:renderDDOverview}` |
| `js/app.js` | `NAV_GROUPS` `:246` | add `{key:"direct-debit",label:"Direct Debit",locked:false,ids:["dd-overview"]}` after `overtime`, before `settings` |
| `index.html` | script list | `<script src="js/tabs-dd-overview.js"></script>` **after** `tabs-summary-v2.js`, **before** `app.js` |
| `styles.css` | append | `.ddo-*` classes (reuse `.sv-*` patterns: `.ddo-rib`, `.ddo-card-row`, `.ddo-card`, `.ddo-tbl`, `.ddo-note`) |
| `docs/26-dd-overview.md` | new | ~25-line spec (Purpose·Drives·Measures·Charts·Table·Modes·Notes) |

Guard missing data at renderer top (all four DD datasets empty → empty state):
```js
if([DATA.ddi30,DATA.ddiAging,DATA.dda30,DATA.ddaAging].every(k=>!k||!k.rows.length)){
  content.appendChild(el("div","pend-empty","No Direct Debit data.")); return; }
```
Push every Chart.js instance via `newBar/newLine/newDoughnut` (auto-registers for `clearCharts()`).

## 5. UX / layout

**Current:**
```
┌─ KPI rib (6 pills) ────────────────────────────────────────────────────┐
│ DDI req │ DDI success% │ DDA req │ DDA active% │ DDI 31d+ │ DDA 31d+   │
├────────────────────────────────────────────────────────────────────────┤
│ ┌─ DDI 30-day doughnut ──┐ ┌─ DDA 30-day doughnut ───────────────────┐ │
│ │ success / rejected /    │ │ active / inactive / rejected / suspend   │ │
│ │ (total−success−rejected)│ └──────────────────────────────────────────┘ │
│ ┌─ DDI aging stacked bar ┐ ┌─ DDA aging stacked bar ─────────────────┐ │
│ │ 0-6d 7-14d 15-21d 22-30d 31d+  (green→red ramp)                    │ │
│ └─────────────────────────┘ └─────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│ Per-scheme relief table: sc | DDI req | DDI success% | DDI rej |        │
│   DDA req | DDA active% | DDA rej | DDI 31d+ | DDA 31d+  (sortable)    │
└────────────────────────────────────────────────────────────────────────┘
```
**Compare:** KPI pills show Δ (counts `signed()`, rates `pp()`); `ddo-note` "Comparing snapA → snapB. Deltas B−A."; grouped aging bar (A vs B per bucket) for DDI + DDA; table gains `A | B | Δ` columns with `delta-up/dn/flat`.
**Trend:** trend each metric across **that dataset's own `snapshots`** (not months); line chart (total + success/active) + aging stacked bar per snapshot; KPI pills show the latest snapshot's values; `ddo-note` "Trend is across snapshot dates — DD data has no month dimension." **Guard:** for any DD dataset with `<2` snapshots, render `pend-empty` "Not enough snapshots yet for {DDI/DDA} {30-day/aging} trend." instead of a broken/empty chart. `ddiAging` is the thin/noisy one (~4 snapshots, malformed 20260713 dump).

## 6. Acceptance criteria

- [ ] process-reviewer (phase 4) signed off — framework adherence OK (or friction logged for an iter-0 patch)
- [ ] tab appears as **26 DD Overview** in a new **Direct Debit** sidebar group (between "Over time" and "Settings")
- [ ] Current/Compare/Trend render without `ReferenceError` (jsdom smoke: 0 `onerror`)
- [ ] DDI success% / DDA active% computed as ratio of sums; tone bands (≥98 g / ≥95 y / else r) correct
- [ ] aging stacked bars use the green→red ramp; relief table ships per-scheme rows (the contrast channel)
- [ ] Compare deltas use `signed()`/`pp()` + `delta-up/dn/flat`; Trend plots across each dataset's own snapshots
- [ ] **<2-snapshot guard:** a DD dataset with <2 snapshots shows the `pend-empty` "Not enough snapshots yet…" state, no thrown error, no empty chart
- [ ] switching mode / snapshot / scheme / trustee re-renders clean
- [ ] `docs/26-dd-overview.md` written
- [ ] ddiAging noise acknowledged in the spec's Notes (known limitation, non-blocking; Oracle re-export is a separate follow-up)

## 7. Verify recipe

1. (no CSV change this iter — skip rebuild; if data.js is regenerated, `python scripts/build_data.py`)
2. jsdom smoke (`docs/STATUS.md §3`): inject `data.js`+d3+Chart.js via jsdom `beforeParse`+`window.eval`; stub `ResizeObserver`; filter canvas `getContext` errors; `window.eval(appJs)`; render tab `dd-overview` into a host div in each of current/compare/trend; assert `window.onerror`/`uncaughtException` fired **0** times. (`const DATA` is eval-scoped — append `globalThis.DATA=DATA` in the same eval.) Also stub the <2-snapshot case by mocking `DATA.ddiAging.snapshots=["20260717"]` before the trend render and assert the `pend-empty` state appears with 0 errors.
3. `start index.html` → click **26 DD Overview** → exercise Current/Compare/Trend + snapshot switch + scheme/trustee filter → eyeball on a 1920×1080 screen; confirm no-scroll layout and the ddiAging trend guard when applicable.

## 8. Archive checklist (Doc-keeper fills at close)

- [ ] `docs/26-dd-overview.md` spec present
- [ ] this plan `git mv` → `docs/archive/iter-02-dd-overview/handoff.md`
- [ ] `STATUS.md` copied → `docs/archive/iter-02-dd-overview/STATUS-snapshot-20260717.md`
- [ ] `docs/ITERATION-LOG.md` row appended
- [ ] `STATUS.md` refreshed: current-iter pointer advanced, next-free-tab bumped (→27), ≤60 lines
- [ ] any superseded spec `git mv`'d into the archive folder
