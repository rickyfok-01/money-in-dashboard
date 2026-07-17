# {YYYY-MM-DD} — iter-{NN} — {slug} — {domain} {L1|L2|L3}

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
5. reference tab: `docs/{REF_NN}-{ref-name}.md` + `js/tabs-{ref-name}.js` (the pattern to copy)

DO NOT READ (context control): anything under `docs/archive/`, any other plan in
`docs/superpowers/plans/`, or `docs/ITERATION-LOG.md` past its last row.

State at branch: next free tab = **{NN}**. `TABS` registry at `js/app.js:~131`,
`NAV_GROUPS` at `js/app.js:~246`. Script load order (`index.html`):
`data.js → core → charts → tabs-summary → tabs-detail → tabs-settings → tabs-alloc → tabs-summary-v2 → {NEW tabs module} → app.js` (new module loads **before** `app.js`).

---

**Goal:** {one sentence — the user question this iteration answers}

**Architecture:** {1–3 sentences — what changes structurally, what's reused}

**Tech Stack:** vanilla JS (plain `<script>`, no build), Chart.js 4.4.7 + D3 7 via CDN, CSS custom properties.

---

## 1. Scope

- **IN-SCOPE:** {concrete deliverables — tab IDs, e.g. tab 26 "DD Overview"}
- **OUT-OF-SCOPE:** {explicit non-goals — prevents drift}

## 2. Data contract  (self-contained — copy the row shape, don't link)

### 2.1 DATA keys used
- `DATA.{key}` — from `data/{csv-glob}` (SQL-{NN}). ~{N} rows in the current snapshot.
  Shape: `{ snapshots:[...], rows:[...] }` (pym also has `months`; aging/30-day are snapshot-level, **no `ym`**).

### 2.2 Row shape  (copy verbatim from `scripts/build_data.py`)
```ts
type Row = {
  s: string;   // SNAPSHOT_DATE
  tr: string;  // TR_CODE
  sc: string;  // SCHEME_CODE
  // ...domain fields...
  // measure fields are int (to_int) unless HKD → float (to_float)
};
```

### 2.3 Filter helper  (mirror `rowsFor` in `js/core.js`; aging/30-day have no month range)
```js
function xxxFor(snap){
  if(!DATA.{key}) return [];
  return DATA.{key}.rows.filter(r => r.s===snap && schemeOn(r) && trusteeOn(r));
}
```

### 2.4 Derived metrics  (ratio of sums — never mean of per-row ratios)
- `{metric}` = `Σa / Σb`

### 2.5 Tone / thresholds
- `function xxxTone(v): 'green'|'yellow'|'red'` — {≥X green / ≥Y yellow / else red}

## 3. Tab pattern

Pattern **{A|B|C|D}** — {A=`renderGrouped` generic dimension · B=custom overview · C=pym-style matrix · D=`renderCross` crosstab}.
Reference impl: `js/tabs-{ref-name}.js` `render{Ref}`. Reuse `state.*` (`js/core.js`),
`rowsFor`/`groupBy`/`blank`/`add`/`totals`/`ranked` (`js/core.js`), chart primitives
`newBar`/`newLine`/`newDoughnut`/`buildTable`/`kpiTile` (`js/charts.js`). Modes: **{current|compare|trend}**.

## 4. Files to touch

| File | Where | Change |
|---|---|---|
| `js/tabs-{domain}.js` | new | renderer (`"use strict";` + `render{Tab}(content)` + `{Tab}Current/Compare/Trend`) |
| `js/app.js` | `TABS` ~:131 | add entry `{id,n:"{NN}",title,sub,modes:[...],render:render{Tab}}` |
| `js/app.js` | `NAV_GROUPS` ~:246 | add id to the right group's `ids:[...]` |
| `index.html` | script list | `<script src="js/tabs-{domain}.js"></script>` **before** `app.js` |
| `styles.css` | append | `.{ns}-*` classes |
| `docs/{NN}-{name}.md` | new | ~25-line per-tab spec (Purpose·Drives·Measures·Charts·Table·Modes·Notes) |

Guard missing data at renderer top: `if(!DATA.{key}||!DATA.{key}.rows.length){content.appendChild(el("div","pend-empty","No {x} data."));return;}`. Push every Chart.js instance via `newBar/newLine/newDoughnut` (auto-registers for `clearCharts()`).

## 5. UX / layout

```
{ASCII layout — charts on top, data table below; modes noted}
```

## 6. Acceptance criteria

- [ ] tab appears as **{NN} {title}** in the right sidebar group
- [ ] {Current/Compare/Trend} render without `ReferenceError` (jsdom smoke: 0 `onerror`)
- [ ] {domain}-specific metric computed as ratio of sums; tone bands correct
- [ ] data table ships as the relief channel; Compare deltas use `signed()`/`pp()` + `delta-up/dn/flat`
- [ ] switching mode / snapshot / scheme re-renders clean
- [ ] `docs/{NN}-{name}.md` written

## 7. Verify recipe

1. (only if CSV changed) `python scripts/build_data.py`
2. jsdom smoke (`docs/STATUS.md §3`): inject `data.js`+d3+Chart.js via jsdom `beforeParse`+`window.eval`; stub `ResizeObserver`; filter canvas `getContext` errors; `window.eval(appJs)`; render the new tab into a host div in each mode; assert `window.onerror`/`uncaughtException` fired **0** times. (`const DATA` is eval-scoped — append `globalThis.DATA=DATA` in the same eval.)
3. `start index.html` → click new tab → exercise Current/Compare/Trend + snapshot switch → eyeball on a 1920×1080 screen.

## 8. Archive checklist (Doc-keeper fills at close)

- [ ] `docs/{NN}-{name}.md` spec present
- [ ] this plan `git mv` → `docs/archive/iter-{NN}-{slug}/handoff.md`
- [ ] `STATUS.md` copied → `docs/archive/iter-{NN}-{slug}/STATUS-snapshot-{YYYYMMDD}.md`
- [ ] `docs/ITERATION-LOG.md` row appended
- [ ] `docs/STATUS.md` refreshed: current-iter pointer advanced, next-free-tab bumped, ≤60 lines
- [ ] any superseded spec `git mv`'d into the archive folder
