# Spec: "Money Allocation" tab

> **Purpose of this document:** A self-contained requirements + UX/UI spec for the
> **Money Allocation** overview tab of the contribution dashboard. Written so the
> panel can be re-implemented from scratch against a comparable dataset. Mirrors
> the structure of `SPEC_contribution_tagging_by_scheme.md`.

---

## 1. What this panel is

An **overview tab** (sidebar group *Overview*, slot **02**, directly below
*Contribution Pend Tagging*) that shows how received contribution **money** is
**allocated** — i.e. how much has been applied to member accounts vs. how much
sits unallocated. It is the money counterpart to the bill-count views: every
other tab counts *bills*; this tab counts **dollars**.

It is driven by a **second dataset**, `DATA.pym` (from
`data/con-pym-6mon-YYYYMMDD.csv`), laid out per the user's template
`data/contribution-allocation.xlsx` (a trustee × month matrix of
Pay AMT / Avail AMT / ALLOC %), and enriched with human-readable names from
`DATA.names` (`data/constant-scheme-info.xlsx`).

**User intent:** "Of the contribution money a scheme/trustee received this month,
how much was allocated to accounts, and how much is still sitting unallocated
(at risk)? Which allocators are below the 95 % target?"

---

## 2. Data model

### 2.1 Source rows (`DATA.pym.rows`)

One row per `snapshot × trustee × scheme × pay channel × tag status × pay method × contribution month`:

```ts
type PymRow = {
  s: string;     // SNAPSHOT_DATE  "20260710"
  tr: string;    // TR_CODE        "BCT"
  sc: string;    // SCHEME_CODE    "AD"
  chan: string;  // AV_PAY_CHANNEL_CODE  "PIG_DEF"
  tag: string;   // AV_TAG_STATUS_CODE   "FULLY_USED"
  pm: string;    // PAY_METHOD_CODE      "DIRECT_DEBIT"
  ym: string;    // MONTH          "2026-07"
  pc: number;    // PAYMENT_COUNT  (int)
  pay: number;   // PAY_AMT        (float HKD, cents)
  avail: number; // AVAIL_AMOUNT   (float HKD, cents)
};
```

`DATA.pym = { snapshots: [...], months: [...], rows: [...] }`. Only the latest 6
`YEAR_MONTH`s are kept (same window as the bill dataset).

### 2.2 Code → name lookup (`DATA.names`)

```ts
type Names = { scheme: Record<string,string>; trustee: Record<string,string> };
// e.g. names.scheme["AD"] = "AMTD MPF Scheme"; names.trustee["BCT"] = "Bank Consortium Trust Company Limited"
```

When a code has no name, the code itself is shown.

### 2.3 Derived metric — ALLOC %

$$ \text{ALLOC\%} = \frac{\Sigma \text{PAY\_AMT}}{\Sigma \text{PAY\_AMT}\ +\ \Sigma \text{AVAIL\_AMT}} $$

Computed as a **ratio of sums** over the filtered rows (never a mean of per-row
ratios). Confirmed against the template: EA Feb 377.9 / (377.9 + 5.8) = 0.985.
`null` when pay + avail = 0 (rendered as "—").

> Note: the template's own cell values are from an older cut and do **not** match
> the live CSV — the CSV is the source of truth; the template is a layout guide
> only. Trustee aliases in the template (EA, BCT1/2, HSBC 1/2, …) are **not** used;
> canonical `TR_CODE`s + `DATA.names` are.

### 2.4 Tone (good-when-high, the inverse of the bill `tone`)

```ts
function allocTone(pct: number|null): 'green'|'yellow'|'red'|null {
  if (pct == null) return null;
  if (pct >= 98) return 'green';
  if (pct >= 95) return 'yellow';
  return 'red';
}
```

Reuses the existing `toneHex(t)` → `#16a34a / #f59e0b / #ef4444`. The **95 %
target** is the reference line on the charts and the tile threshold.

---

## 3. UX — Information architecture

The tab is **matrix-only** and carries its own **on-tab mode control** — there is
no global filter bar / mode toggle in the chrome. The page header is the single
"Money Allocation" title (the former in-content "Contribution Allocation" heading
was merged into it). Below it sits one **control bar** above one **matrix table**:

- **Control bar, LEFT:** snapshot selector(s), then the **`[By trustee][By scheme]`**
  toggle (default **By trustee**).
- **Control bar, RIGHT:** the **`[Current][Compare]`** switch — this tab's mode
  control. `TABS.modes = ["current"]`; the old global Compare/Trend paths for this
  tab were removed (Trend is gone).

### 3.1 Current view

The Current view is **matrix-only** — the tile strip and the two summary charts
were removed at the user's request (2026-07-10) so the tab focuses on the
allocation matrix. The layout is:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Money Allocation                                (page header — merged) │
├──────────────────────────────────────────────────────────────────────┤
│  Snapshot [20260710 ▾] [By trustee][By scheme]          [Current][Compare] │  control bar
├──────────────────────────────────────────────────────────────────────┤
│  ┌────────┬─────────┬─────────┬─────────┐                            │  matrix table
│  │Trustee │ Feb 26  │ Mar 26  │ … Jul 26│   (no Total column)        │  (code only —
│  │        │P|A|Al%  │P|A|Al%  │ P|A|Al% │                            │    no full names)
│  ├────────┼─────────┼─────────┼─────────┤                            │
│  │ BCT    │ …       │ …       │ …       │                            │
│  │ Grand total …                              │                        │  footer
│  └────────┴─────────┴─────────┴─────────┘                            │
└──────────────────────────────────────────────────────────────────────┘
```

- **Control bar (left):** one **snapshot `<select>`** (default `pymSnap(state.snap)`,
  held in `__allocSnap`) followed by the **`[By trustee][By scheme]`** toggle
  (default **By trustee**, `__allocBy`). **Control bar (right):** the
  **`[Current][Compare]`** switch (`__allocView`). Any control re-renders.
- **Matrix table:** rows = trustees **or** schemes (toggle); the **label cell
  shows the code only** — no scheme full name, no trustee full name; columns =
  one group per visible month (Pay / Avail / ALLOC %), **no Total column**;
  **Grand total** footer row (per-month only).

### 3.2 Compare view (on-tab switch)

Flipping the right-side switch to **Compare** swaps in a two-snapshot comparison.
The control bar gains a **second snapshot `<select>`** (Snapshot A and Snapshot B):

```
  Snapshot A [20260709 ▾]  Snapshot B [20260710 ▾]  [By trustee][By scheme]   [Current][Compare]
```

- **Defaults:** A = **latest − 1**, B = **latest** pym snapshot (`__allocSnapA` /
  `__allocSnapB`; `null` → defaults).
- **Matrix** keeps the per-(allocator × month) shape, but each month group widens
  from 3 to **5 sub-columns**: `Pay · Avail · ALLOC% · pre ALLOC% · change %`.
  - `Pay / Avail / ALLOC%` are for **snapshot B** (the later one).
  - `pre ALLOC%` is snapshot **A**'s allocation rate for that (allocator, month).
  - `change %` = `(ALLOC%_B − ALLOC%_A) × 100` in percentage points, signed
    `+`/`−`, with a green/red tone dot (green = improved allocation).
  - Header group `colspan="5"`; the 5-label sub-header repeats per month; the
    **Grand total** footer aggregates A and B separately per month.

### 3.3 (removed — Trend)

The Trend view was removed when the on-tab Current/Compare switch took over
(2026-07-10). There is no Trend path for this tab.

### 3.4 Snapshot selection

Payment data covers fewer snapshots than the bill dataset
(`DATA.pym.snapshots` ⊆ `DATA.snapshots`) and there is no global snapshot
selector, so the tab carries its own. **Current** uses one (`__allocSnap`);
**Compare** uses two (`__allocSnapA` / `__allocSnapB`, default latest−1 / latest).
All default to `pymSnap(state.snap)` semantics (active snapshot if it has pym
data, else the latest pym source) and persist across re-renders until changed.

---

## 4. UX — Interaction

- **`[Current][Compare]` switch** (right of the control bar) is the tab's mode
  control — `__allocView`; there is no global mode toggle. Current = single-
  snapshot matrix; Compare = two-snapshot matrix with pre ALLOC% / change %.
- **Snapshot `<select>`(s)** — one in Current (`__allocSnap`), two in Compare
  (`__allocSnapA` / `__allocSnapB`, default latest−1 / latest).
- **`[By trustee][By scheme]` toggle** (left) re-renders the matrix; state in
  `__allocBy`, default **By trustee**.
- **Scheme picker** scopes the matrix (the global behaviour, where wired).
- Matrix rows are **not clickable**; no column sort (sorted by total Pay AMT desc);
  no pagination. The body scrolls; the header is sticky; the label column sticks
  left during horizontal scroll.

---

## 5. Visual specifications

- **No tiles, no charts** — the tab is a single matrix (`.alloc-*` table CSS:
  sticky `thead`, `tfoot` grand total, tone dots via `.pend-dot`, tabular-nums).
- **Control bar** uses pill toggles (`.alloc-toggle`) for both the By toggle and
  the Current/Compare switch, plus `.alloc-snap` selects.
- **Tone dots** carry the status: ALLOC% wears the good-when-high band (≥98 green /
  ≥95 yellow / else red via `allocTone`); Compare `change %` wears green for an
  increase, red for a decrease.
- Text wears ink tokens; the colored dot carries the tone, never the value text.
- Light theme only; colors via CSS variables.

---

## 6. Number formatters (project conventions)

- **`money(v)`** — `$78.63B` / `$953.5M` / `$12.3K` / `$456`; signed `−` for
  negatives; `"—"` for null/NaN.
- **`R9(ym)`** — `"2026-07" → "Jul 26"` (month group headers).
- **`I9(n)`** — integer with thousands separator (used elsewhere; this tab uses
  `money` for amounts).
- ALLOC % is rendered as `XX.X%`; deltas as `±X.XX pp`.

---

## 7. Implementation checklist

1. `pymSnap(snap)` — resolve to a snapshot that exists in `DATA.pym`.
2. `pymFilter(snap)` — `DATA.pym.rows` ∩ {snap, month-range, selected schemes}.
3. `pymAggregate(snap, by)` — group by scheme (`sc`) or trustee (`tr`); sum
   `pay`/`avail` per month + a total (used for sort); capture the trustee per
   scheme.
4. `allocOf(pay, avail)` + `allocTone(pct)` + `toneHex` for the dots.
5. `allocCells(m, strong)` → 3 `<td>`s (Pay / Avail / ALLOC %+dot).
6. `drawAllocTable({agg, by})` — Current matrix; two header rows (rowspan-2 label
   + colspan-3 month groups — **no Total group**); tbody with **code-only** label
   cells; tfoot grand total (per-month only).
7. `drawAllocCompareTableLocal({a, b, by})` — Compare matrix; colspan-**5** month
   groups (`Pay / Avail / ALLOC% / pre ALLOC% / change %`); `cmpCells(vb, va)`
   renders B's Pay/Avail/ALLOC% + A's pre ALLOC% + the signed change %.
8. `allocSnapField / allocByToggle / allocViewSwitch` — shared control-bar pieces.
9. `renderMoneyAllocationCurrent` — **control bar** (left: snapshot `<select>` +
   By toggle; right: Current/Compare switch) → `drawAllocTable`. `__allocSnap`
   holds the snapshot, `__allocBy` the grouping. **No section cap (header merged
   into the page title); no tiles, no charts.**
10. `renderMoneyAllocationCompare` — control bar with **two** snapshot `<select>`s
    (A/B, default latest−1/latest) + By toggle + switch → `drawAllocCompareTableLocal`.
11. `renderMoneyAllocation(content)` dispatches on `__allocView`; guards the
    no-pym case. `TABS.modes = ["current"]` (on-tab switch is the sole control).

---

## 8. Acceptance criteria

- [ ] Tab appears in the **Overview** group as **02 Money Allocation**, below
      Contribution Pend Tagging.
- [ ] **Single header** — page title "Money Allocation"; no in-content
      "Contribution Allocation" heading.
- [ ] **Control bar:** left = snapshot `<select>` + `[By trustee][By scheme]`
      (default trustee); right = `[Current][Compare]` (default Current).
- [ ] **Current** matrix: code-only labels, no Total column, 3 sub-cols/month
      (Pay/Avail/ALLOC%); ALLOC% = Pay ÷ (Pay + Avail). Trustee view = 12 rows,
      scheme view = 24.
- [ ] **Compare** adds a 2nd snapshot `<select>` (A default latest−1, B latest);
      each month group widens to 5 sub-cols (`…/pre ALLOC%/change %`); `change %`
      is signed pp with a green/red dot.
- [ ] Switching Current⇄Compare, changing any snapshot `<select>`, or the By
      toggle re-renders without error.
- [ ] `TABS.modes = ["current"]` (no global Compare/Trend for this tab; Trend
      removed).
- [ ] No `ReferenceError` / uncaught error in either view (jsdom smoke: 0 errors).

---

## 9. Out of scope

- Per-channel / per-tag-status / per-pay-method breakdowns (the data supports
  them; only the scheme/trustee × month allocation is surfaced here).
- Drill-through from a matrix cell to underlying pym rows.
- Export to CSV / Excel.
- Dark mode.
- Surfacing `DATA.names` on the other (bill) tabs — available globally, used here
  only.
