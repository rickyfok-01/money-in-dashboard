# STATUS — current state of the contribution dashboard

> **Read this first in a zero-context session.** It is the *current-state snapshot*
> (what is done, how to resume, where the traps are). For the architecture, design
> system, and full tab catalogue, read **`CLAUDE.md`** — this file does not repeat
> it. Last updated 2026-07-10.

---

## 1. One-paragraph orientation

`empf-dashboard/contribution` is a **single self-contained HTML dashboard**
(`index.html`, plain vanilla JS, no build step, Chart.js `4.4.7` + D3 `7` via CDN).
Two source CSV families + one xlsx are folded by `scripts/build_data.py` into
`data.js` (`const DATA = {...}`), which `index.html` loads. There are **25 tabs**
(00–24). The dashboards were **merged onto `index.html` on 2026-07-10**
(`admin.html` deleted; index wins all conflicts; all admin-only features dropped).
All work from the recent sessions is **complete and verified**.

## 2. What is done & verified (2026-07-10)

- **Dashboard merge** — `index.html` + `admin.html` → one `index.html`. Removed:
  the `admin.html` link, the `#viewSwitch` Standard/Admin redirector, `docs/admin-view.md`.
  Confirmed by `grep -c viewSwitch index.html` → `0`.
- **Money Allocation tab (02)** — *matrix-only* (no tiles/charts). One control bar
  above one matrix:
  - **Left:** snapshot `<select>`(s) + `[By trustee][By scheme]` toggle (default trustee).
  - **Right:** on-tab **`[Current][Compare]`** switch — this tab's sole mode control
    (`TABS.modes:["current"]`; no global mode toggle exists in the chrome anyway;
    **Trend removed**).
  - **Current** matrix = code-only labels, no Total column, 3 sub-cols/month
    (Pay / Avail / ALLOC%).
  - **Compare** adds a 2nd snapshot `<select>` (A default latest−1, B default latest)
    and widens each month group to **5** sub-cols: Pay / Avail / ALLOC% / **pre ALLOC%**
    / **change %** (B − A, signed pp, green/red dot).
  - Header merged: page title is "Money Allocation"; the old in-content
    "Contribution Allocation" heading is gone.
- **Summary (00) sections restored** after the merge dropped them — the merge had
  also deleted the D3 `<script>` tag, which broke Summary (see gotcha §5.1). Fixed
  and re-verified.
- Verified end-to-end with a **jsdom smoke harness** (real d3 + Chart.js + data.js):
  0 runtime errors in Current and Compare; switching / snapshot-change / By-toggle
  all re-render cleanly.

## 3. Run / verify

```bash
python scripts/build_data.py   # re-generates data.js from the CSVs + xlsx (run after any CSV change)
start index.html               # Windows: open in a browser
```

**jsdom smoke test** (the established verification harness — no canvas in jsdom, so
it catches `ReferenceError`/logic throws, not pixel output):
1. Save `index.html` app + a `<script src data.js>` block to a string.
2. Use jsdom `beforeParse(window)` and inject libs with `window.eval(chartJs)`,
   `window.eval(d3Js)`, then `window.eval(dataJs + "\n;globalThis.DATA = DATA;")`.
   **Do not** inject libs as inline `<script>` HTML — that path throws
   `SyntaxError: missing ) after argument list`; the `beforeParse`+`eval` path works.
3. Stub `window.ResizeObserver` (`observe/unobserve/disconnect` no-ops) and filter
   canvas `getContext` errors (jsdom has no canvas).
4. `window.eval(appJs)`, then call each tab's render into a host `div`; assert
   `window.onerror`/`uncaughtException` fired 0 times.

## 4. Key files (what each is, focus = recently changed)

| File | Role |
|---|---|
| `index.html` | **the app** — sidebar nav + tabbed content; Chart.js + D3 via CDN; one vanilla-JS module |
| `data.js` | generated dataset (`const DATA`); **never hand-edit** — regenerate via `scripts/build_data.py` |
| `scripts/build_data.py` | CSVs + xlsx → `data.js`; type-coerces measures, keeps latest 6 YEAR_MONTHs; emits `DATA`, `DATA.pym`, `DATA.names` |
| `SPEC_money_allocation_by_scheme.md` | requirements + UX/UI spec for tab 02 (mirror of `SPEC_contribution_tagging_by_scheme.md`) |
| `CLAUDE.md` | architecture + tab catalogue + conventions (the authoritative "how to work here") |
| `docs/` | one spec per tab + `00-architecture.md` (build plan / design system) |
| `data/con-bill-6mon-*.csv` | bill source (Query 2 of `data/sql/contribution.sql`) |
| `data/con-pym-6mon-*.csv` | payment source (Pay AMT / Avail AMT) → `DATA.pym` |
| `data/constant-scheme-info.xlsx` | code→name lookup → `DATA.names` |
| `index-old.html` | **merge backup only** (pre-merge `index.html`) — not part of the live app; safe to delete once confident |

## 5. Gotchas & conventions (the non-obvious traps)

### 5.1 D3 is NOT dead weight — never delete its `<script>` tag
The 2026-07-10 merge removed the `d3@7` tag thinking it was Bill-Volume-Race-only
(a dropped admin feature). But D3 powers the **Summary (00)** tab's hand-built SVG
charts (`buildStatusStackedByMonth` = *Bills by status · monthly*,
`buildStatusByMonthWithTrustee` = *Submission status by month*). Without it,
`renderSummary` throws `d3 is not defined` mid-render and the Summary's lower
sections vanish. The tag was restored; **CLAUDE.md warns about it.** Always
re-verify a merge with a Summary render in the smoke harness.

### 5.2 No functional global filter toolbar
`index.html` has **no working filter bar** — `state.schemes`/`state.snap` default to
"all"; scheme scoping is by table click-through. The `#fMode` global mode toggle is
**dead code** (the element does not exist in the DOM). Tabs must degrade gracefully
with defaults (mirror the Pend Tagging tab's `state.*` access). Because of this, the
Money Allocation on-tab Current/Compare switch is cleanly the tab's sole control.

### 5.3 eval/inline-script scoping in the smoke harness
`const DATA` evaluated inside `window.eval(...)` is **eval-scoped, not global** —
the app code can't see it. Always append `globalThis.DATA = DATA` in the *same* eval.

### 5.4 Stray files — leave untouched
`data/` contains stray copies from a **separate Vite project** (`data/CLAUDE.md`,
`data/SPEC_contribution_tagging_by_scheme.md`, `data/.gitignore`, `data/image.png`).
They reference `npm run data:convert` / `public/data/*.json` / `.vite` — none of
which exist in this plain-HTML project. **Leave them alone.** The **root `.gitignore`
is also Vite cruft** — it even lists `data.js` (which is tracked and committed here);
treat that line as wrong, not as a signal to stop tracking `data.js`.

### 5.5 Adding a tab
Tabs use **strict sequential numbering** (`n` = "00"… "24"); inserting one requires
a deterministic re-walk of the `TABS` array to renumber the tail. Add the
`docs/NN-*.md` spec first, then build to it (overview tabs get a root `SPEC_*.md`
instead). `TABS[i].modes` controls which global modes a tab offers — but since the
global toggle is dead code (§5.2), this mostly matters for tab-internal mode logic
like Money Allocation's.

### 5.6 Data regeneration
Re-run `python scripts/build_data.py` after **any** CSV/xlsx change. ALLOC% (tab 02) =
`Σpay / (Σpay + Σavail)` computed as a **ratio of sums**, never a mean of per-row
ratios; `allocTone`: ≥98 green / ≥95 yellow / else red (good-when-high, the inverse
of the bill `tone`).

## 6. Git / commit state

- This **is** a git repo on `branch main` (tracking `origin/main`). Commit style is
  terse/casual (`change`, `New`, `x`) — a personal project, not precious about hygiene.
- **Tracked & committed:** `index.html`, `data.js`, `CLAUDE.md`, `scripts/`,
  `docs/`, the root `SPEC_*.md`, root `.gitignore`.
- **Not committed (deliberately):** the raw source CSVs/xlsx
  (`data/con-bill-*`, `data/con-pym-*`, `data/constant-scheme-info.xlsx`,
  `data/contribution-allocation.xlsx`) and the merge backup `index-old.html`. The
  repo ships the built `data.js`, not the source data — matching the established
  pattern. (Re-derive source from the CSVs by running the build script.)
- **Never committed (Vite cruft, §5.4):** everything under `data/` that is not a
  bill/pym CSV — `data/CLAUDE.md`, `data/SPEC_*.md`, `data/.gitignore`,
  `data/image.png`, plus `scripts/image_to_excel.py`.
- When committing dashboard work, **stage explicitly** (`git add -u` for tracked
  mod/deletes, then `git add` the specific new files). **Never `git add -A`/`. `** —
  it would pull in the stray Vite files.

## 7. Possible next steps (none are blocking)

- **Visual review** of the Money Allocation Compare view (open `start index.html` →
  Overview → Money Allocation → Compare) — eyeball the 5-col month groups and the
  `change %` tone/format.
- **Restore Trend** for tab 02 if a time-series of ALLOC% across the 6 months is
  wanted later (it was removed when the on-tab switch took over; re-add by widening
  `TABS.modes` and resurrecting `renderMoneyAllocationTrend`).
- **Surface `DATA.names`** on the bill tabs (currently only tab 02 renders names;
  the lookup is available globally).
- **Clean the stray `.gitignore`** (root + `data/`) of Vite cruft, and decide once
  whether the raw source CSVs belong in the repo — both are tidy-up items, not in
  scope of the current work.
