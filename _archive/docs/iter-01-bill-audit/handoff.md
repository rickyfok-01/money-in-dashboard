# 2026-07-17 — iter-01 — bill-audit — Bill audit (L1/L2/L3 coverage + data hygiene)

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
5. reference tab: **none** (ROADMAP row 1 has `Pattern: —`, `Ref tab: —`; this is a hygiene+audit iter, no new tab to copy a pattern from)

DO NOT READ (context control): anything under `docs/archive/`, any other plan in
`docs/superpowers/plans/`, or `docs/ITERATION-LOG.md` past its last row.

State at branch: next free tab = **26** (audit confirms no new tab needed — see §3).
`TABS` registry at `js/app.js:131` (first entry line 132, last at line 209),
`NAV_GROUPS` at `js/app.js:246`. Script load order (`index.html`) is unchanged
this iteration — no new module.

---

**Goal:** Confirm the Bill domain already covers L1/L2/L3 in depth and close the
one data-hygiene pre-flight defect (the `ddiAging` blank-row artifact), so the
Payment and Direct-Debit iterations start from a clean dataset.

**Architecture:** No view-layer change. Two deliverables only: (a) harden the
CSV readers in `scripts/build_data.py` against blank source-lines so
`DATA.ddiAging.rows[0]` is no longer an `{tr:'',sc:'',…}` artifact (and the same
guard is applied to every reader that shares the shape); (b) a coverage matrix
that maps every existing Bill tab to its tier and records the conclusion
(**complete — no gap-fill**).

**Tech Stack:** vanilla JS (plain `<script>`, no build), Chart.js 4.4.7 + D3 7
via CDN, CSS custom properties; Python 3 stdlib (`csv`/`glob`/`json`) for the
data pipeline. No new dependency.

---

## 1. Scope

- **IN-SCOPE:**
  - **Data hygiene fix** — `scripts/build_data.py`: skip rows where `TR_CODE`
    and `SCHEME_CODE` are both blank, in every reader that builds a
    `{tr, sc, …}` row (`read_con_bill`, `read_pym`, `read_ao_aging`,
    `read_ddi`, `read_dda`). Regenerate `data.js`.
  - **Coverage audit** — produce the L1/L2/L3 matrix for the Bill domain
    (this plan §3) and record the no-gap conclusion. No code.
  - **Verify** — jsdom smoke still 0 errors; `ddiAging.rows[0]` is real data;
    `ddaAging` row count (~379) unchanged; scheme/trustee names render.
- **OUT-OF-SCOPE:**
  - Any new tab. Any change to `js/`, `index.html`, or `styles.css`.
  - Payment / Direct Debit feature work (those are iter-02 onward).
  - Doc-consistency fix for the stale `(tab N)` headers in `docs/NN-*.md`
    (that is iter-07 polish — noted here so it is not accidentally re-scoped).

## 2. Data hygiene

### 2.1 Already done by lead (verify only — do NOT redo)
- `data/constant-scheme-info.xlsx` present → `DATA.names` populated (27 schemes,
  13 trustees).
- `data.js` regenerated: 5 snapshots (latest `20260717`), 31831 bill rows,
  `ddaAging` 379 rows clean, `ddiAging` ships a blank-row artifact at index 0.

### 2.2 The defect
`scripts/build_data.py` `read_ddi()` aging loop builds a row for every
`csv.DictReader` row whose `SNAPSHOT_DATE` resolves. When a source CSV contains
a blank line (trailing separator / editor artifact), `DictReader` yields a row
whose values are all `None`; `SNAPSHOT_DATE` is `None` → falls back to
`snap_file` (filename-derived, **non-empty**) → the `if not snap: continue`
guard at `scripts/build_data.py:200-201` lets the row through, producing an
artifact `{s:'<snap>', tr:'', sc:'', at:'', total:0, d00_06:0, …}` at the head
of `DATA.ddiAging.rows`. Confirmed symptom: `DATA.ddiAging.rows[0]` is that
blank row. `ddaAging` happens to be clean because its source CSV has no blank
line, but the **bug class** is shared by every reader with the same shape.

### 2.3 The fix (one Task)

**Files:**
- Modify: `scripts/build_data.py` — readers at lines 105–135 (`read_pym`),
  138–166 (`read_ao_aging`), 169–217 (`read_ddi`), 220–270 (`read_dda`),
  and the bill reader (`read_con_bill`, the loop whose guard is at line 327).
- Test: `scripts/test_build_data.py` (new — repo has no test runner; this is a
  plain `python -m unittest` module the Engineer creates alongside the fix).

**Interfaces:**
- Consumes: nothing (pure stdlib refactor of existing functions).
- Produces: identical `DATA` shape, with blank-source rows dropped. No DATA key
  added, removed, or renamed — downstream `js/` is unaffected.

- [ ] **Step 1: Write the failing test**

```python
# scripts/test_build_data.py
import os, unittest, sys
sys.path.insert(0, os.path.dirname(__file__))
import build_data as bd

class BlankRowTests(unittest.TestCase):
    def _row(self, **over):
        base = {"SNAPSHOT_DATE":"20260717","TR_CODE":"BCT","SCHEME_CODE":"AD"}
        base.update(over); return base

    def test_read_ddi_drops_blank_line_in_aging(self, tmp_path=None):
        # Simulate a DictReader row that is all empty strings (blank CSV line).
        import types, csv
        blank = {h: "" for h in [
            "SNAPSHOT_DATE","TR_CODE","SCHEME_CODE","SHORT_CODE","TOTAL",
            "DAY_00_06","DAY_07_14","DAY_15_21","DAY_22_30","DAY_31_MORE"]}
        real  = self._row(SCHEME_CODE="AD", TOTAL="5")
        # Patch glob + open via a tiny in-memory stub.
        rows = bd._read_aging_from_rows([blank, real], snap_file="20260717")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["sc"], "AD")
        self.assertNotEqual(rows[0]["tr"], "")

if __name__ == "__main__":
    unittest.main()
```

(The Engineer adds a thin `_read_aging_from_rows` test seam to `build_data.py`,
or rewrites the test to drive `read_ddi` against a temp CSV via `tmp_path` —
either is acceptable as long as the test exercises a blank source row.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `python scripts/test_build_data.py`
Expected: **FAIL** — blank row is not dropped, `len(rows) == 2`.

- [ ] **Step 3: Implement the guard**

Add a single helper near the other small helpers (after `to_float`, around
`scripts/build_data.py:97`):

```python
def _blank_row(r) -> bool:
    """True when a DictReader row has no TR_CODE and no SCHEME_CODE
    (blank source line / trailing separator). Such rows are artifacts:
    snapshot falls back to the filename, so the `if not snap` guard alone
    does not catch them."""
    tr = (r.get("TR_CODE") or "").strip()
    sc = (r.get("SCHEME_CODE") or "").strip()
    return not tr and not sc
```

Then in **every** reader loop, immediately after the `snap` extraction and
*before* building the row dict, add:

```python
                if not snap:
                    continue
                if _blank_row(r):
                    continue
```

Apply at: `read_pym` (after line 119), `read_ao_aging` (after 149),
`read_ddi` 30-day loop (after 180), `read_ddi` aging loop (after 201),
`read_dda` 30-day loop (after 231), `read_dda` aging loop (after 254),
and `read_con_bill` (after 327's `if not snap`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `python scripts/test_build_data.py`
Expected: **PASS** — blank row dropped, `len(rows) == 1`.

- [ ] **Step 5: Regenerate `data.js` and eyeball the printout**

Run: `python scripts/build_data.py`
Expected: stdout reports `ddiAging : <N>` where N is one less than before
(the artifact is gone); `ddaAging` count **unchanged** (~379); bill row count
unchanged (~31831). `git diff data.js` shows only the artifact row removed from
`ddiAging.rows`.

- [ ] **Step 6: Commit**

```bash
git add scripts/build_data.py scripts/test_build_data.py data.js
git commit -m "build_data: skip blank TR/SC rows (ddiAging artifact fix)"
```

## 3. Bill L1/L2/L3 coverage matrix (audit)

The Bill domain (`DATA.rows`, source `con-bill-6mon-*.csv`) is served by the
tabs below. Tab IDs are from `js/app.js:131-209` (the `TABS` registry); the
`(tab N)` header in some `docs/NN-*.md` files is stale (an `(NN-1)` off-by-one
drift) and is tracked separately as iter-07 polish — it does not affect
coverage.

| Tier | Tab # | Tab | Bill dimension / angle | Doc |
|---|---|---|---|---|
| **L1 Overview** | 0  | Summary                 | KPIs + drill-through charts (landing)        | `docs/01-summary.md` |
| L1              | 1  | Contribution Pend Tagging | ER-submitted (A) vs Pending-Tagging (B)    | `docs/SPEC-contribution-tagging.md` |
| L1              | 25 | Summary V2              | compact 3-area overview (Bill + pym + DD)    | `docs/25-summary-v2.md` |
| **L2 Dimensions** | 3 | Scheme Scorecard       | `SCHEME_CODE` (scheme-centric master)        | `docs/02-scheme-scorecard.md` |
| L2              | 4  | Status Lifecycle        | `AV_STATUS_CODE` (canonical lifecycle order) | `docs/03-status-lifecycle.md` |
| L2              | 5  | Trustee                 | `TR_CODE` (12 trustees)                      | `docs/04-trustee.md` |
| L2              | 6  | Contribution Mode       | `AV_BILL_CONTR_MODE` (REG/LUMP/SURCHARGE)    | `docs/05-contribution-mode.md` |
| L2              | 7  | Frequency               | `AV_FREQ_TYPE` (9 freqs, incl. blank)        | `docs/06-frequency.md` |
| L2              | 8  | Account Type            | `SHORT_CODE` (REE/CEE/SEP/PAH/TVC/SVC)       | `docs/07-account-type.md` |
| L2              | 9  | Submit Channel          | 5-channel mix (DDE/BATCH/PORTAL/BULK/OTHER)  | `docs/08-submit-channel.md` |
| **L3 Analysis** | 10 | On-time Performance     | on-time rate, ranked vs median               | `docs/09-ontime-performance.md` |
| L3              | 11 | Submit Funnel & Coverage | BILL → submitted → on-time funnel            | `docs/10-submit-funnel-coverage.md` |
| L3              | 12 | Monthly Trend           | time-series across 6 months                  | `docs/11-monthly-trend.md` |
| L3              | 13 | Snapshot Comparison     | A-vs-B delta across the dataset              | `docs/12-snapshot-comparison.md` |
| L3              | 14 | Status × Channel        | crosstab — channel mix per status            | `docs/13-status-channel.md` |
| L3              | 15 | Trustee × Channel       | crosstab — channel mix per trustee           | `docs/14-trustee-channel.md` |
| L3              | 16 | Frequency × Status      | crosstab — status outcomes per frequency     | `docs/15-frequency-status.md` |
| L3              | 17 | Payment Outcome         | FULLY_PAID/OVERPAID/WAIVED/… split           | `docs/16-payment-outcome.md` |
| L3              | 18 | Backlog & Pending       | OPEN/SUBMITTED/APPROVED WIP                  | `docs/17-backlog.md` |
| L3              | 19 | Completion Rate         | terminal-state completion, ranked            | `docs/18-completion.md` |
| L3              | 20 | Outliers & Exceptions   | schemes >1σ from peer mean (watchlist)       | `docs/19-outliers.md` |
| L3              | 21 | Volume Tiers            | XS…XL volume tiers vs quality                | `docs/20-volume-tiers.md` |
| L3              | 22 | Trustee Portfolio       | trustee breadth + concentration              | `docs/21-trustee-portfolio.md` |

**Dimension completeness check** (every `con-bill` dim has a tab):
`SCHEME_CODE` → 3 · `AV_STATUS_CODE` → 4 · `TR_CODE` → 5 ·
`AV_BILL_CONTR_MODE` → 6 · `AV_FREQ_TYPE` → 7 · `SHORT_CODE` → 8 ·
channel mix (derived) → 9 · `YEAR_MONTH` → 12 (trend) ·
`SNAPSHOT_DATE` → 13 (compare). All nine dimensions covered.

**Conclusion — no gap-fill tab.** L1 (3 tabs) + L2 (7 tabs) + L3 (13 tabs) =
23 Bill tabs, all three tiers complete. Tab 26 stays free for iter-02
(DD Overview). ROADMAP row 1's `New tabs: 0–1` resolves to **0**.

## 4. Files to touch

| File | Where | Change |
|---|---|---|
| `scripts/build_data.py` | after line 97 + 7 reader loops (lines cited §2.3) | add `_blank_row(r)` helper; add `if _blank_row(r): continue` after each `if not snap: continue` |
| `scripts/test_build_data.py` | new | one `unittest` proving a blank source row is dropped (test seam or `tmp_path` CSV) |
| `data.js` | regenerated | one blank row removed from `DATA.ddiAging.rows`; nothing else moves |

No `js/`, `index.html`, `styles.css`, or `docs/NN-*.md` changes this iteration.

## 5. UX / layout

N/A — no view-layer change. Every tab renders exactly as before; the only
user-visible difference is that Direct-Debit tabs (when built in iter-02+) will
no longer see the phantom `{tr:'',sc:''}` row at the head of `ddiAging`.

## 6. Acceptance criteria

- [ ] `scripts/test_build_data.py` passes (blank row dropped)
- [ ] `python scripts/build_data.py` regenerates `data.js`; stdout shows
      `ddiAging` count down by exactly 1 (artifact gone), `ddaAging`
      count unchanged, bill row count unchanged
- [ ] `DATA.ddiAging.rows[0].tr` and `.sc` are both non-empty
- [ ] jsdom smoke (`docs/STATUS.md §3`) — render every tab 0,1,3–22,25 in
      current mode (and compare/trend where the tab lists it in
      `js/app.js:131-209`) — **0** `window.onerror` / `uncaughtException`
- [ ] scheme + trustee names still render (Money Allocation, Summary V2) —
      eyeball on `start index.html`; `DATA.names.scheme` and
      `DATA.names.trustee` non-empty
- [ ] Bill coverage matrix (§3 above) recorded; no gap-fill tab added
- [ ] next free tab still **26** (unchanged)

## 7. Verify recipe

1. `python scripts/test_build_data.py` → PASS.
2. `python scripts/build_data.py` → regenerate; check stdout counts.
3. jsdom smoke (`docs/STATUS.md §3`): build the app string from `index.html`
   body + a `<script src data.js>` block; in jsdom `beforeParse(window)`
   inject Chart.js + d3 via `window.eval(lib)`, then
   `window.eval(dataJs + "\n;globalThis.DATA = DATA;")` (**not** inline
   `<script>` — that throws `SyntaxError`; `const DATA` is eval-scoped, hence
   the `globalThis.DATA` append in the *same* eval); stub
   `window.ResizeObserver` (no-ops); filter canvas `getContext` errors;
   `window.eval(appJs)`; render each target tab into a host div; assert
   `window.onerror` / `uncaughtException` fired **0** times.
4. `start index.html` → click Summary V2 and Money Allocation → confirm codes
   are paired with names; click any Direct-Debit-related surface (none yet —
   that is iter-02) → N/A for now.
5. `git diff data.js | head` → the only hunk in `ddiAging` is the dropped
   blank row.

## 8. Archive checklist (Doc-keeper fills at close)

- [ ] this plan `git mv` → `docs/archive/iter-01-bill-audit/handoff.md`
- [ ] `docs/STATUS.md` copied → `docs/archive/iter-01-bill-audit/STATUS-snapshot-20260717.md`
- [ ] `docs/ITERATION-LOG.md` row appended (iter-01: Bill audit, 0 new tabs,
      ddiAging blank-row fix)
- [ ] `docs/STATUS.md` refreshed: current-iter pointer → iter-02 (DD L1),
      next-free-tab still **26**, ≤60 lines
- [ ] `docs/ROADMAP.md` row 1 status flipped `next` → `shipped`
- [ ] no spec to archive (no new tab)
