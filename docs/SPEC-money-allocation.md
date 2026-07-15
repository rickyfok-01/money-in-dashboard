# Spec: "Money Allocation" tab

> **Purpose of this document:** A self-contained requirements + UX/UI spec for the
> **Money Allocation** overview tab of the contribution dashboard. Written so the
> panel can be re-implemented from scratch against a comparable dataset. Mirrors
> the structure of `SPEC-contribution-tagging.md`.

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

The tab is **matrix-only**. Controls use the **global scope bar** (snapshot A/B,
Current/Compare mode toggle, scheme/trustee pickers, month range) — the same
shared filter surface used by all other tabs. The only tab-specific control is
the **`[By trustee][By scheme]`** toggle in the scope bar (dimmed on other tabs).
`TABS.modes = ["current","compare"]`; Trend is not available for this tab.

### 3.1 Current view

The Current view is **matrix-only** — no tiles, no charts, just the allocation
matrix. Layout:

```
┌─────────────────────────────────────────────────────────────┐
│  Money Allocation                           (page header)    │
├─────────────────────────────────────────────────────────────┤
│  (global scope bar: snap · mode · schemes · trustee · mo)   │
├─────────────────────────────────────────────────────────────┤
│  ┌────────┬─────────┬─────────┬─────────┐                   │
│  │Trustee │ Feb 26  │ Mar 26  │ … Jul 26│  (no Total col)   │
│  │        │P|A|Al%  │P|A|Al%  │ P|A|Al% │                   │
│  ├────────┼─────────┼─────────┼─────────┤                   │
│  │ BCT    │ …       │ …       │ …       │                   │
│  │ Grand total …                    │                       │
│  └────────┴─────────┴─────────┴─────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

- **Matrix table:** rows = trustees **or** schemes (toggle); label cell shows
  **code only** — no scheme/trustee full name; columns = one group per visible
  month (Pay / Avail / ALLOC %), **no Total column**; **Grand total** footer
  row (per-month only).

### 3.2 Compare view (global scope bar)

The global **Compare** mode renders a two-snapshot comparison matrix.
Each month group widens from 3 to **5 sub-columns**:

```
  Pay · Avail · ALLOC% · ←% · Δ%
```

- `Pay / Avail / ALLOC%` are for **snapshot B** (the later one).
- `←%` (short for "pre ALLOC%") is snapshot **A**'s allocation rate for that
  (allocator, month). Tooltip reads "Snapshot A allocation %".
- `Δ%` = `(ALLOC%_B − ALLOC%_A) × 100`, signed `+`/`−`. Displayed as `±X.XX%`
  (no "pp" suffix).
- Header group `colspan="5"`; the 5-label sub-header repeats per month; the
  **Grand total** footer aggregates A and B separately per month.

#### Cell highlights (compare mode)

Both `←%` and `Δ%` cells carry a subtle **background tint** based on value tone:

| Cell | Tone | Background |
|---|---|---|
| `←%` (prev. alloc%) | ≥98% green, ≥95% yellow, else red | `rgba` tint matching tone |
| `Δ%` (change) | positive = green, negative = red | `rgba` tint matching tone |

A **color legend** is rendered below the table showing the dot-and-label key:
"≥98% & improvement · ≥95% · below target & deterioration".

#### Month group separation

Even month blocks (2nd, 4th, 6th) get a subtle `var(--surface-2)` alternating
background. A vertical `border-right` on the `Δ%` column separates groups.

#### Compact sizing (compare mode)

Compare mode uses a tighter `font-size: .7rem` with reduced cell padding
(`4px 5px` tbody, `5px 5px` thead) to fit all 5 sub-columns × 6 months in a
desktop browser window with the sidebar visible.

---

## 4. UX — Interaction

- **Mode toggle** uses the global Compare mode from the scope bar
  (`state.mode === "compare"`). No tab-local mode switch.
- **Snapshot A / B** are set via the global scope bar's snapshot selects
  (`state.snapA` / `state.snapB`).
- **`[By trustee][By scheme]` toggle** sits in the global scope bar, dimmed on
  other tabs. State held in `window.__allocBy` ("tr" / "sc"), default **By
  trustee**.
- **Scheme picker / trustee picker / month range** use the global scope bar
  controls shared with all tabs.
- Matrix rows are **not clickable**; no column sort (sorted by total Pay AMT
  desc); no pagination. The body scrolls; the header is sticky; the label
  column sticks left during horizontal scroll.

---

## 5. Visual specifications

- **No tiles, no charts** — the tab is a single matrix (`.alloc-*` table CSS:
  sticky `thead`, `tfoot` grand total, tone dots via `.pend-dot`, tabular-nums).
- **Compare mode** (`.alloc.is-compare`): tighter padding/font, month-group
  vertical separators (`th.grp-end` / `td.grp-end`), alternating tint on even
  month blocks, cell-level tone highlights (`.tone-green` / `.tone-yellow` /
  `.tone-red`) with background `rgba` tint.
- **Color legend** (`.alloc-legend`) sits below the compare table, showing dot
  + label for each tone band.
- **Tone dots** carry the status: ALLOC% wears the good-when-high band (≥98 green /
  ≥95 yellow / else red via `allocTone`); Compare `Δ%` wears green for an
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
- ALLOC % is rendered as `XX.X%`; `Δ%` deltas as `±X.XX%` (no "pp" suffix).

---

## 7. Implementation checklist

1. `pymFilter(snap)` — `DATA.pym.rows` ∩ {snap, month-range, selected schemes}.
2. `pymAggregate(snap, by)` — group by scheme (`sc`) or trustee (`tr`); sum
   `pay`/`avail` per month + a total (used for sort); capture the trustee per
   scheme.
3. `allocOf(pay, avail)` + `allocTone(pct)` + `toneHex` for the dots.
4. `allocCells(m, strong)` → 3 `<td>`s (Pay / Avail / ALLOC %+dot).
5. `drawAllocTable({agg, by})` — Current matrix; two header rows (rowspan-2 label
   + colspan-3 month groups — **no Total group**); tbody with **code-only** label
   cells; tfoot grand total (per-month only).
6. `drawAllocCompareTableLocal({a, b, by})` — Compare matrix; colspan-**5** month
   groups (`Pay · Avail · ALLOC% · ←% · Δ%`); `cmpCells(vb, va)` renders B's
   Pay/Avail/ALLOC% + A's ←% + Δ% with tone-based cell background, tone dot,
   and signed `±X.XX%` value. Includes `.alloc-legend` below the table.
7. `window.__allocBy` — "tr" / "sc" grouping state, wired through the global
   scope bar `#scopeAllocBy` toggle (dimmed on non-alloc tabs).
8. `renderMoneyAllocationCurrent` — table only (controls live in scope bar).
   Calls `drawAllocTable` with `state.snap`.
9. `renderMoneyAllocationCompare` — table only. Calls
   `drawAllocCompareTableLocal` with `state.snapA` / `state.snapB`.
10. `renderMoneyAllocation(content)` dispatches on `state.mode`; guards the
    no-pym case. `TABS.modes = ["current","compare"]` (no Trend).

---

## 8. Acceptance criteria

- [ ] Tab appears in the **Overview** group as **02 Money Allocation**, below
      Contribution Pend Tagging.
- [ ] **Single header** — page title "Money Allocation"; no in-content heading.
- [ ] **Controls live in the global scope bar:** snapshot A/B, Current/Compare
      mode toggle, scheme/trustee/month selectors, plus the `[By trustee][By
      scheme]` toggle (dimmed on other tabs).
- [ ] **Current** matrix: code-only labels, no Total column, 3 sub-cols/month
      (Pay/Avail/ALLOC%); ALLOC% = Pay ÷ (Pay + Avail).
- [ ] **Compare** matrix: 5 sub-cols/month (`Pay · Avail · ALLOC% · ←% · Δ%`);
      `←%` = snapshot A's alloc%, `Δ%` = signed `±X.XX%` (no "pp").
- [ ] **Compare cell highlights:** `←%` cells tinted green/red by alloc-tone;
      `Δ%` cells tinted green (improvement) / red (deterioration). Legend below
      table.
- [ ] **Month separation:** vertical border after each `Δ%` column; alternating
      tint on even month blocks.
- [ ] **Compact sizing:** compare mode fits 5 cols × 6 months in a desktop
      browser window with sidebar visible.
- [ ] Switching Current⇄Compare, changing any scope-bar control, or the By
      toggle re-renders without error.
- [ ] `TABS.modes = ["current","compare"]` (no Trend).
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
