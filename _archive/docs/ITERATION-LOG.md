# Iteration log — money-in-dashboard

> **Append-only.** One entry per iteration, oldest → newest. A fresh session reads
> the **last** row to corroborate `docs/STATUS.md`. **Never edit a past row** — if a
> shipped iteration needs a correction, open a new follow-up iteration.

---

## iter-00 — 2026-07-17 — Agile system (superpowers backbone)
- **Goal:** establish the agile framework on the superpowers plugin as backbone —
  roadmap, iteration-plan template, archive mechanism, zero-context handoff
  protocol, 4-role subagent team, STATUS refactor. No app code.
- **Shipped:**
  - `docs/AGILE.md` — the playbook (4-phase lifecycle, zero-context protocol, archive rules)
  - `docs/ROADMAP.md` — 8-iteration backlog (3 areas × 3 levels)
  - `docs/superpowers/plans/_template.md` — the iteration-plan template
  - `docs/ITERATION-LOG.md` + `docs/archive/README.md` — history infrastructure
  - `.claude/agents/{analyst,engineer,reviewer,doc-keeper}.md` — the team
  - `docs/STATUS.md` — refactored to lean live (≤60 lines) + current-iter pointer
  - `docs/README.md` — amended with agile-doc pointers
- **Files touched:** `docs/` + `.claude/` only. No `js/`, `index.html`, `data.js`, `styles.css`.
- **DATA:** n/a (docs only).
- **Verify:** artifact well-formedness + zero-context simulation (a fresh agent
  given only `STATUS.md` correctly reports the current iteration, next free tab #,
  the bounded read-set, and the executing superpowers skill).
- **Handoff:** `docs/archive/iter-00-agile/handoff.md`
- **Status:** shipped.

## iter-01 — 2026-07-17 — Bill audit (L1/L2/L3 coverage + data hygiene)
- **Goal:** confirm Bill covers L1/L2/L3; fix the `ddiAging` blank-row artifact.
- **Shipped:** `scripts/build_data.py` (`_blank_row` guard across all 7 readers) + `scripts/test_build_data.py` (8 tests); `data.js` regenerated. **0 new tabs** — coverage complete (L1×3, L2×7, L3×13 = 23 Bill tabs).
- **Files:** `scripts/build_data.py`, `scripts/test_build_data.py`, `data.js`.
- **DATA:** `rows` (audit); `ddiAging` 380→298 (dropped 82 garbage rows — `data/ddi-aging-20260713.csv` is a SQL dump, not CSV).
- **Verify:** `test_build_data` 8/8; reviewer 0 blocking; jsdom deferred (data-only, no JS changed).
- **Follow-up:** `data/ddi-aging-20260713.csv` needs Oracle re-export (carried to iter-02 DD).
- **Handoff:** `docs/archive/iter-01-bill-audit/handoff.md`
- **Status:** shipped.

## iter-02 — 2026-07-17 — DD L1 (Direct Debit Overview)
- **Goal:** a dedicated Direct Debit overview page (tab 26) — DDI + DDA 30-day + aging KPIs on one compact page, with current/compare/trend modes. Adds the "Direct Debit" sidebar group.
- **Shipped:** `js/tabs-dd-overview.js` (Pattern B renderer — KPI rib + 2×2 charts + per-scheme relief table, 3 modes, `<2`-snapshot `pend-empty` guard), `js/app.js` (`TABS` entry #26 + `direct-debit` NAV group), `index.html` (script tag before `app.js`), `styles.css` (`.ddo-*`), `docs/26-dd-overview.md` (spec), `.gitignore` (+`.smoke/`). **1 new tab (#26).**
- **Files:** `js/tabs-dd-overview.js`, `js/app.js`, `index.html`, `styles.css`, `.gitignore`, `docs/26-dd-overview.md`.
- **DATA:** `ddi30, ddiAging, dda30, ddaAging` (consumed read-only; `data.js` untouched — no CSV change this iter).
- **Verify:** jsdom smoke 0 errors across current/compare/trend + `<2`-snapshot guard asserted; reviewer 0 blocking; process-reviewer 0 blocking (4 framework-friction items logged for an iter-0 patch → `docs/FRAMEWORK-BACKLOG.md`).
- **Follow-up:** `data/ddi-aging-20260713.csv` Oracle re-export still open (non-blocking; tab 26 guards it via the `<2`-snapshot state).
- **Handoff:** `docs/archive/iter-02-dd-overview/handoff.md`
- **Status:** shipped.

## iter-03 — 2026-07-20 — DD L2 (DDI + DDA Dimensions, parallel build)
- **Goal:** the L2 "dimensions" view under the DD Overview — break the Direct Debit
  pipeline down by scheme / trustee / account-type, exposing which dimension drives
  DDI success rate and DDA active rate, and how those rates shift between snapshots.
  Two Pattern-A twin tabs built in parallel (one Engineer per tab).
- **Shipped:** `js/tabs-ddi-dimensions.js` (tab **#27** — `renderDDIDim` + Current/Compare/Trend
  + local `ddiDimToggle`/`ddiDimAgg`; measures total/submitted/success/rejected; rate=`successRate`)
  + `js/tabs-dda-dimensions.js` (tab **#28** — `renderDDADim` + Current/Compare/Trend + local
  `ddaDimToggle`/`ddaDimAgg`; measures total/active/inactive/rejected/suspend; rate=`activeRate`)
  + `docs/27-ddi-dimensions.md` + `docs/28-dda-dimensions.md` (specs); wiring in `js/app.js`
  (TABS +2, `direct-debit` NAV_GROUPS +2 ids), `index.html` (+2 `<script>` before `app.js`),
  `styles.css` (`ddi-dim-*` rules). **2 new tabs (#27, #28).**
- **Files:** `js/tabs-ddi-dimensions.js`, `js/tabs-dda-dimensions.js`, `js/app.js`,
  `index.html`, `styles.css`, `docs/27-ddi-dimensions.md`, `docs/28-dda-dimensions.md`.
- **DATA:** `ddi30, dda30` (consumed read-only; `data.js` untouched — no CSV change this iter).
- **Verify:** Reviewer independent jsdom smoke **0/18** (both tabs × current/compare/trend ×
  scheme/trustee/account-type) + sign-off 0 blocking; Process Reviewer 0 blocking (4
  framework-friction items logged → `docs/FRAMEWORK-BACKLOG.md` #5–8).
- **Follow-up:** N3 spec-trim deferred (both specs 45–54 lines vs ~25-line contract — left
  for an iter-07 doc pass, logged in FRAMEWORK-BACKLOG #5). `data/ddi-aging-20260713.csv`
  Oracle re-export still open (non-blocking; affects `ddiAging`, NOT `ddi30`/`dda30`).
- **Notes:** parallel build (one Engineer per tab; `js/app.js` + `index.html` sequenced after
  both landed). Three non-blocking review fixes (N1/N2/N4 — color-literal/comment-only: DDI
  `DDI_DIM_RATE_HEX`→`#16a34a/#f59e0b/#ef4444`; DDA Trend Rejected line `CAT[6]`→`#ef4444`; DDA
  reuse comment dropped stale `groupBy`) were applied by the **lead** directly after both
  engineer agents died on a 429 usage-limit mid-loop — Process-Reviewer-ruled an acceptable
  mechanical exception to "lead does not write code" (framework friction #7).
- **Handoff:** `docs/archive/iter-03-dd-l2-dimensions/handoff.md`
- **Status:** shipped.
