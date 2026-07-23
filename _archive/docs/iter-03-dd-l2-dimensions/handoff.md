# 2026-07-17 — iter-03 — DD L2 dimensions — Direct Debit L2

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
5. reference tab: `docs/08-submit-channel.md` + `js/tabs-detail.js` (`renderChannel` @ `:2`) — the custom 3-mode structure to mirror. **Also** `js/tabs-dd-overview.js` — the DD access pattern/helpers/tone to reuse.

DO NOT READ (context control): anything under `docs/archive/`, any other plan in
`docs/superpowers/plans/`, or `docs/ITERATION-LOG.md` past its last row.

State at branch `feat/loop-agile`: next free tab = **27**. `TABS` registry at
`js/app.js:131` (last entry `dd-overview` @ `:211-212`, closing `];` @ `:213`).
`NAV_GROUPS` at `js/app.js:248`; the **"direct-debit"** group already exists from
iter-02 at `js/app.js:255` (`ids:["dd-overview"]`). Script load order (`index.html:76-84`):
`data.js → core → charts → tabs-summary → tabs-detail → tabs-settings → tabs-alloc →
tabs-summary-v2 → tabs-dd-overview → {NEW modules} → app.js` (new modules load at
`index.html:84-85`, **before** `app.js`; `app.js` shifts `:84 → :86`).

---

**Iteration kind:** feature — ships 2 new tabs (#27 DDI Dimensions, #28 DDA Dimensions).

**Goal:** Break the Direct Debit pipeline down by scheme / trustee / account-type —
which dimension drives DDI success rate and DDA active rate, and how do those rates
shift between snapshots? (The L2 "dimensions" view under the iter-02 DD Overview.)

**Architecture:** Two twin custom dimension-renderer tabs, one per DD data area
(`DATA.ddi30` / `DATA.dda30`). Each renders a dimension breakdown (scheme / trustee /
account-type via a tab-internal toggle), in Current / Compare / Trend modes, reusing
the DD access helpers (`ddi30For`/`dda30For`/`sumAO` @ `js/tabs-summary-v2.js:19/29/35`),
the rate tone (`ddTone` @ `js/tabs-dd-overview.js:27`), and chart primitives
(`newBar`/`newLine`/`newDoughnut`/`buildTable` @ `js/charts.js`).

**Tech Stack:** vanilla JS (plain `<script>`, no build), Chart.js 4.4.7 + D3 7 via CDN, CSS custom properties.

**Why custom renderers, not `renderGrouped` (Pattern A):** `renderGrouped`
(`js/tabs-summary.js:2`) is hard-wired to bill data — it calls `rowsFor(state.snap)`
(bill rows), sums bill measures (`bill/total/ontime/dde/…`), and trends across
`DATA.months` via `monthKeySeries`. DD rows have **no `ym`** and a different measure
set, so it cannot be reused verbatim. The submit-channel tab (`renderChannel`) is the
correct structural model: a custom renderer with `Current/Compare/Trend` sub-fns that
reads its own data source. We mirror that shape, pointed at the DD helpers.

---

## 1. Scope

- **IN-SCOPE:** tab **27 "DDI Dimensions"** (`DATA.ddi30`) + tab **28 "DDA Dimensions"**
  (`DATA.dda30`); each = dimension breakdown (scheme/trustee/account-type) ×
  Current/Compare/Trend; per-tab spec docs `docs/27-ddi-dimensions.md` + `docs/28-dda-dimensions.md`.
- **OUT-OF-SCOPE:** aging crosstabs + outliers (iter-04, `ddiAging`/`ddaAging`); any
  global scope-bar / `#scopeAllocBy` change (the dimension toggle is **tab-internal**);
  the `date` field of `ddi30` (too granular to group by); Payment L2 (iter-05).

## 2. Data contract  (self-contained — row shapes copied verbatim from `scripts/build_data.py`)

### 2.1 DATA keys used
- `DATA.ddi30` — from `data/ddi-30day-*.csv` (SQL-01). **5 snapshots** in the current
  build: `["20260713","20260714","20260715","20260716","20260717"]` (grep-verifiable in
  `data.js`). Intact — **not** the malformed `ddiAging` (4 snapshots; STATUS note).
- `DATA.dda30` — from `data/dda-30day-*.csv` (SQL-03). **5 snapshots**, same set as DDI.
- Both shape: `{ snapshots:[...], rows:[...] }`, **snapshot-level — NO `ym`** (no month range).

### 2.2 Row shapes  (verbatim from `scripts/build_data.py`)
```ts
// ddi30  (build_data.py:199-209)
type DDI30Row = {
  s: string;          // SNAPSHOT_DATE
  tr: string;         // TR_CODE
  sc: string;         // SCHEME_CODE
  at: string;         // SHORT_CODE (account type)
  date: string;       // DDI_REQUEST_DATE  (not grouped — out of scope)
  total: int;         // COUNT
  submitted: int;     // SUBMITTED_TO_BANK
  success: int;       // SUCCESS
  rejected: int;      // REJECTED
};
// dda30  (build_data.py:254-266)
type DDA30Row = {
  s: string; tr: string; sc: string; at: string;   // same keys as DDI
  total: int;          // TOTAL
  submitted_pig: int;  // SUBMITTED_TO_PIG
  submitted_bank: int; // SUBMITTED_TO_BANK
  active: int;         // ACTIVE
  inactive: int;       // INACTIVE
  rejected: int;       // REJECTED
  suspend: int;        // SUSPEND
};
```

### 2.3 Filter helper  (REUSE — already defined, do not redeclare)
```js
ddi30For(snap)  // js/tabs-summary-v2.js:19  — rows for snap, scoped by global scheme + trustee pickers
dda30For(snap)  // js/tabs-summary-v2.js:29
sumAO(arr, key) // js/tabs-summary-v2.js:35  — Σ of one measure over a row list
```
Dimension grouping uses the shared `groupBy(rows, keyFn)` (`js/core.js`), `keyFn` ∈
`r=>r.sc` (Scheme, default) · `r=>r.tr` (Trustee) · `r=>r.at` (Account type).

### 2.4 Derived metrics  (ratio of sums — never mean of per-row ratios)
- **DDI:** `successRate = Σsuccess / Σtotal`; `rejectedShare = Σrejected / Σtotal`;
  `pending = Σtotal − Σsuccess − Σrejected`; `pendingShare = pending / Σtotal`.
- **DDA:** `activeRate = Σactive / Σtotal`; `inactiveShare`, `rejectedShare`,
  `suspendShare` (each `Σx / Σtotal`).

### 2.5 Tone / thresholds  (REUSE — `ddTone` @ `js/tabs-dd-overview.js:27`)
- `ddTone(v)` → `≥0.98 "tone-g" · ≥0.95 "tone-y" · else "tone-r"`. Applied to
  `successRate` (DDI) and `activeRate` (DDA) only — never to rejected/pending shares
  (lower-is-better; directional tone would mislabel them, per DD Overview convention).

## 3. Tab pattern

**Pattern A in spirit** (generic dimension breakdown) **implemented as custom
renderers** (see *Why custom* above). Reference impls to mirror:
- `renderChannel` (`js/tabs-detail.js:2`) + `renderChannelCompare`/`renderChannelTrend`
  — the custom Current/Compare/Trend split + per-mode table.
- `renderDDOverview` (`js/tabs-dd-overview.js:76`) — DD data access, snapshot-level
  trend (across `DATA.ddi30.snapshots`, not months), and the `<2-snapshot` pend-empty guard.

Each tab = `"use strict";` + `render{Tab}(content)` dispatching on `state.mode` →
`{Tab}Current/Compare/Trend`, plus a small **local** dimension-toggle helper
(`dimToggle(parent, get, set)` — 3 buttons: Scheme/Trustee/Account type) and a
**local** aggregator (`dimAgg(rows, keyFn, measures)` → `[{k,total,…,rate}]`). Toggle
state lives on a module-level `let` (e.g. `let __ddiDim="sc";`), default `"sc"` (Scheme).
Modes: **current, compare, trend**.

## 4. Files to touch

| File | Where | Change |
|---|---|---|
| `js/tabs-ddi-dimensions.js` | **new** | `renderDDIDim` + `DDIDimCurrent/Compare/Trend` + local `ddiDimToggle`/`ddiDimAgg`; measures total/success/submitted/rejected; rate = successRate |
| `js/tabs-dda-dimensions.js` | **new** | `renderDDADim` + `DDADimCurrent/Compare/Trend` + local `ddaDimToggle`/`ddaDimAgg`; measures total/active/inactive/rejected/suspend/(submitted_pig|bank); rate = activeRate |
| `js/app.js` | `TABS` `:211-213` | append 2 entries after `dd-overview` (shapes below) |
| `js/app.js` | `NAV_GROUPS` `:255` | append `"ddi-dimensions","dda-dimensions"` to the `direct-debit` group's `ids:[...]` |
| `index.html` | script list `:84-85` | two `<script src="js/tabs-dd{a,i}-dimensions.js"></script>` before `app.js` |
| `styles.css` | append | `.{ns}-*` classes (toggle row + table tone reuse existing `tone-g/y/r`, `delta-up/dn/flat`) |
| `docs/27-ddi-dimensions.md` | **new** | ~25-line spec (Purpose·Drives·Measures·Charts·Table·Modes·Notes) |
| `docs/28-dda-dimensions.md` | **new** | ~25-line spec (same skeleton, DDA measures) |

**TABS entry shape** (append, verbatim field order matches `js/app.js:211-212`):
```js
{id:"ddi-dimensions",n:"27",title:"DDI Dimensions",sub:"DDI 30-day requests by scheme / trustee / account-type — success rate + rejected/pending mix.",modes:["current","compare","trend"],render:renderDDIDim},
{id:"dda-dimensions",n:"28",title:"DDA Dimensions",sub:"DDA 30-day mandates by scheme / trustee / account-type — active rate + inactive/rejected/suspend mix.",modes:["current","compare","trend"],render:renderDDADim},
```

**Missing-data guard** at the top of each renderer:
```js
if(!DATA.ddi30||!DATA.ddi30.rows||!DATA.ddi30.rows.length){content.appendChild(el("div","pend-empty","No DDI data."));return;}
```
(and the `dda30` equivalent). Push every Chart.js instance through `newBar`/`newLine`/
`newDoughnut` (auto-registers for `clearCharts()`); any raw `new Chart(...)` must be
`chartRegistry.push()`-ed (see `renderChannel` pattern).

## 5. UX / layout

```
[ Snapshot ▼ ] [ Scheme ▼ ] [ Trustee ▼ ] [ Current | Compare | Trend ]   ← global scope bar (shared)

DDI Dimensions (#27)                       DDA Dimensions (#28)
┌ Group by: [Scheme*] [Trustee] [Account type] ┐   tab-internal toggle; default Scheme
├ charts grid (top) ────────────────────────────┤
│ A. outcome mix per <dim>   stacked bar, categorical identity               │  DDI: Success·Rejected·Pending
│ B. <rate> by <dim>         horizontal bar, tone-coloured vs ddTone bands   │  DDA: Active·Inactive·Rejected·Suspend
│ C. overall outcome mix     donut (part-to-whole)                           │  rate = successRate (DDI) / activeRate (DDA)
├ data table (below) ────────────────────────────┤
│ <Dim> | Total | <Good-col> | Rate% | Rejected | <other measures> | Pending │  Rate% cell wears ddTone class
└────────────────────────────────────────────────┘
Compare → Δ rate (pp) per <dim> diverging bar (POS/NEG) + A | B | Δ table (signed()/pp(), delta-up/dn/flat)
Trend   → rate + total lines across DATA.{ddi|dda}30.snapshots + per-snapshot table  (NO month axis — DD is snapshot-level)
```
Sort dimension values by `total` desc (ranked); row click sets `state.schemes=[r.k]`
only when grouping by scheme (mirrors `renderChannel`/`renderGrouped` onRowClick).

## 6. Acceptance criteria

- [ ] process-reviewer (phase 4) signed off — framework adherence OK (or friction logged for an iter-0 patch)
- [ ] tabs appear as **27 DDI Dimensions** + **28 DDA Dimensions** in the **Direct Debit** sidebar group
- [ ] both tabs render Current/Compare/Trend with **0** `onerror`/`uncaughtException` (jsdom smoke)
- [ ] successRate (DDI) / activeRate (DDA) computed as ratio of sums; `ddTone` bands correct on rate cells
- [ ] dimension toggle (Scheme/Trustee/Account-type) re-groups charts + table; default = Scheme
- [ ] each data table ships as the relief channel; Compare deltas use `signed()`/`pp()` + `delta-up/dn/flat`
- [ ] Trend uses snapshot axis (not months); `<2-snapshot` dataset shows pend-empty guard (both keys have 5, so this is a safety net)
- [ ] switching mode / snapshot / scheme / trustee / dimension re-renders clean
- [ ] `docs/27-ddi-dimensions.md` + `docs/28-dda-dimensions.md` written (~25 lines each)

## 7. Verify recipe

1. (only if CSV changed) `python scripts/build_data.py` — confirm `ddi30`/`dda30` still
   print 5 snapshots each (stdout lines `ddi30 : … snapshots: […]` / `dda30 : …`).
2. jsdom smoke (`docs/STATUS.md §3`): inject `data.js`+d3+Chart.js via jsdom
   `beforeParse`+`window.eval`; stub `ResizeObserver`; filter canvas `getContext`
   errors; `window.eval(appJs)`; render **both** tabs into a host div in **each** mode
   (current/compare/trend) and **each** dimension (scheme/trustee/account-type); assert
   `window.onerror`/`uncaughtException` fired **0** times. (`const DATA` is eval-scoped —
   append `globalThis.DATA=DATA` in the same eval.)
3. `start index.html` → click **27** then **28** → exercise the dimension toggle + all 3
   modes + a snapshot/scheme switch → eyeball on a 1920×1080 screen.

## 8. Archive checklist (Doc-keeper fills at close)

- [ ] `docs/27-ddi-dimensions.md` + `docs/28-dda-dimensions.md` specs present
- [ ] this plan `git mv` → `docs/archive/iter-03-dd-l2-dimensions/handoff.md`
- [ ] `STATUS.md` copied → `docs/archive/iter-03-dd-l2-dimensions/STATUS-snapshot-20260717.md`
- [ ] `docs/ITERATION-LOG.md` row appended
- [ ] `STATUS.md` refreshed: current-iter pointer → iter-04, next-free-tab → 29, ≤60 lines
- [ ] any superseded spec `git mv`'d into the archive folder (none expected — both tabs are new)

## 9. Parallel build plan  (AGILE §6 — ≥2 independent tabs)

The two tabs share **no source file** except `js/app.js` (TABS + NAV_GROUPS) and
`index.html` (script tags). Fan out Build phase with **one Engineer per tab**:

- **Engineer A — tab #27 DDI:** creates `js/tabs-ddi-dimensions.js` + `docs/27-ddi-dimensions.md`.
- **Engineer B — tab #28 DDA:** creates `js/tabs-dda-dimensions.js` + `docs/28-dda-dimensions.md`.
- **Sequenced after both land (single Engineer, no conflict):** edit `js/app.js:211-213`
  (TABS +2) + `js/app.js:255` (NAV_GROUPS +2 ids) + `index.html:84-85` (+2 script tags) +
  `styles.css` (append). Then run §7 verify.

Each new module is **self-contained** (own renderer + own local `dimToggle`/`dimAgg`
helpers) so the two Engineers never touch the same file. Minor helper duplication
(~15 lines) is the deliberate trade for conflict-free parallel build; the Reviewer may
DRY into `js/tabs-dd-overview.js` (already loaded) if warranted — non-blocking. If the
lead prefers zero duplication up front, extract the shared toggle+aggregator into
`js/tabs-dd-overview.js` as a pre-step (Engineer A) before the parallel fan-out.

**Decision to confirm (lead):** each tab surfaces all three named dimensions via a
**tab-internal** Scheme/Trustee/Account-type toggle (default Scheme). Alternative
considered: scheme-only breakdown (simpler, but under-delivers the "per trustee /
scheme / account-type" ROADMAP wording) — rejected. Confirm before Engineer builds.
