# Spec: "Contribution Tagging by Scheme" Section

> **Purpose of this document:** A self-contained requirements + UX/UI spec for the
> "Contribution Tagging by Scheme" panel of the Tagging dashboard. It is written
> so a different AI agent (without codebase context) can implement the same panel
> from scratch against a comparable dataset.

---

## 1. What this panel is

A full-width, fixed-height table card that sits at the **bottom** of the
"Contribution → Report" sub-tab of the Tagging dashboard.

It is the deep-dive counterpart to the **trend** strip (3 small cards) and the
"ER Submitted Cont. by period" chart that sit above it. The trend strip and
chart summarize; **this table lets the user inspect every (scheme × period)
row** for two snapshots side by side.

**User intent at this point in the flow:** the user has narrowed down
"which periods and which snapshots are interesting" using the filter bar
above. Now they want to **see the raw per-row evidence** and scan for outliers.

---

## 2. Data model

### 2.1 Input data (one row per scheme × trustee × year-month × snapshot)

```ts
type ContributionRow = {
  SCHEME_CODE: string;            // e.g. "AD"
  TR_CODE: string;                // trustee code, e.g. "BCT"
  YEAR_MONTH: string;             // "YYYY-MM"
  SNAPSHOT_DATE: string;          // "YYYY-MM-DD"
  ER_SUBMITTED_CONTR_DATA_COUNT: number;  // "A"
  PENDING_TAGGING_COUNT: number;          // "B"
  // ...other counts exist but are not used by this panel
};
```

### 2.2 Computed per (scheme × period) row

For every scheme that appears in **either** the Earlier or Latest snapshot,
group all matching rows by `YEAR_MONTH`:

```ts
type SchemePeriodRow = {
  scheme: string;
  trustee: string;                // first non-empty TR_CODE for the scheme
  period: string;                 // "YYYY-MM"
  earlier: { a: number; b: number; records: number };  // A, B, row count
  latest:  { a: number; b: number; records: number };
  earlier_pct: number;            // (earlier.b / earlier.a) * 100
  latest_pct: number;             // (latest.b / latest.a) * 100
};
```

Skipped if `a === 0`, `b === 0`, and `records === 0` in **both** snapshots.

### 2.3 Tone color (used for the % column dot and the trend strip)

```ts
function tone(pct: number): 'green' | 'yellow' | 'red' {
  if (pct <= 30) return 'green';
  if (pct <= 50) return 'yellow';
  return 'red';
}
```

### 2.4 Footer "Total" row

A single virtual row that sums every visible data row's `a`, `b`, and
`records`. Pct is `(sum_b / sum_a) * 100`.

### 2.5 Filter pipeline (top → bottom)

The panel is the last stage of a pipeline. Each filter is applied to the
**scheme × period list** *before* it reaches the table:

1. **Scheme universe:** `C` — list of scheme codes with at least one row in
   the Latest snapshot and matching the user's scheme filter.
2. **Scheme mode:** `mode ∈ {'large' (top 5 by latest.b), 'filtered' (user picked)}`.
3. **Period filter:** `c` — array of `YEAR_MONTH` strings the user selected
   in the multi-select above.
4. **Tone filter:** `tone ∈ {'green', 'yellow', 'red', 'all'}`.
5. **Scheme grouping:** rows are grouped by `scheme`. The first row in each
   group gets the scheme `rowSpan`; subsequent rows of the same scheme
   have their scheme cell hidden.
6. **Sort:** stable insertion order; the user does not manually sort.

---

## 3. UX — Information architecture

### 3.1 Position and sizing

- **Location:** bottom of the "Contribution" sub-tab, below the filter bar
  + trend strip + chart.
- **Width:** full content width (same gutter as the cards above).
- **Height:** fills remaining viewport height (`flex-1 min-h-0`); the
  table scrolls vertically **inside** the card, never the page.
- **Padding:** `p-5 sm:p-7` outside, table itself is `min-w-0`.

### 3.2 Visual hierarchy

```
┌──────────────────────────────────────────────────────────────────────┐
│  Contribution Tagging by Scheme                                      │  H1
│  Two-snapshot comparison                                             │  subtitle
│                                                                      │
│  ┌─────────┬────────────┬─────────────────────────────┬───────────┐  │
│  │ Scheme  │ Period     │  Latest · <date>            │ Earlier · │  │  table
│  │         │            │   A   │   B   │  % Pending  │  <date>   │  │
│  │  (15%)  │   (5%)     │  (5%) │  (5%) │   (5%)      │  same 3   │  │
│  ├─────────┼────────────┼───────┼───────┼─────────────┼───────────┤  │
│  │ AD  BCT │  May 26    │ 35│30% │ 6     │ 🔴  17.1%  │ ...       │  │
│  │         │  Jun 26    │ 40│35% │ 4     │ 🟢  10.0%  │ ...       │  │
│  │ (next)  │  Jul 26    │  ...                       │           │  │
│  ├─────────┼────────────┼───────┼───────┼─────────────┼───────────┤  │
│  │  Total  │ 4 rows     │ 152   │ 14    │  🔴  9.2%   │  ...      │  │  footer
│  └─────────┴────────────┴───────┴───────┴─────────────┴───────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.3 Header

- **H1:** "Contribution Tagging by Scheme" — `text-xl font-semibold tracking-normal`.
- **Subtitle:** "Two-snapshot comparison" — `text-sm text-muted-foreground`.
- Header sits in a fixed-height row at the top of the card so it never
  scrolls away with the rows.

### 3.4 Column group headers

Two top-level groups, in this order:

1. **Latest · `<SNAPSHOT_DATE>`** — date formatted as the user selected it
   (e.g. "2026-06-26"). The `<date>` is the active "Latest snapshot" value.
2. **Earlier · `<SNAPSHOT_DATE>`** — date is the active "Earlier snapshot"
   value.

The "Latest" group is always to the **left** of the "Earlier" group. The
subhead dates update live when the user changes the snapshot dropdowns.

### 3.5 Column definitions

| # | Header                              | Width | Alignment | Type        | Cell content                                                       |
|---|-------------------------------------|-------|-----------|-------------|--------------------------------------------------------------------|
| 1 | Scheme                              | 15%   | left      | rowSpan     | Scheme code on top (medium), trustee code below (xs, muted)       |
| 2 | Contribution period                 |  5%   | left      | text        | "May 26" (R9 format)                                               |
| 3 | ER submitted Cont. data (A) — Latest | 5% | right     | progress+num| Number + `|` + pct-of-base + 1.5px rounded bar                     |
| 4 | Pending Tagging (B) — Latest       |  5%   | right     | numeric     | Bold, destructive color                                            |
| 5 | % Pending Tagging (B/A) — Latest    |  5%   | right     | dot+num     | 10px colored dot + percentage                                      |
| 6 | ER submitted Cont. data (A) — Earlier | 5% | right    | progress+num| Same shape as col 3                                                |
| 7 | Pending Tagging (B) — Earlier       |  5%   | right     | numeric     | Bold, destructive color                                            |
| 8 | % Pending Tagging (B/A) — Earlier   |  5%   | right     | dot+num     | Same shape as col 5                                                |

The two "Latest" columns (3-4-5) and "Earlier" columns (6-7-8) are
**visually identical** so the eye can compare the same metric across
snapshots at a glance.

### 3.6 Scheme column (col 1) — group behavior

- The scheme cell uses `rowSpan` equal to the count of periods in that
  group. Subsequent rows of the same scheme have their scheme cell
  hidden (rendered as `display:none` for the cell, not as a blank cell).
- The cell content is **two stacked lines**:
  - Line 1: scheme code — `font-medium`, wraps to multiple lines if long.
  - Line 2: trustee code — `text-xs leading-tight text-muted-foreground`,
    wraps to multiple lines.
- Both lines use `whitespace-normal break-words` so long scheme codes do
  not blow out the column.
- The cell is `align-top` so the text sits at the top of the spanned
  rows (visually anchored to the first row).

### 3.7 "A" column (cols 3 and 6) — progress cell

A single right-aligned flex row containing, in this order:

1. The number, formatted by the project's `I9` integer formatter.
2. A muted `|` separator.
3. The percentage `(value / base) * 100`, formatted as `XX.X%` in 10px
   muted text.
4. A 56px-wide (`w-14`) × 6px-tall (`h-1.5`) rounded bar:
   - Track: `bg-muted`, full width, `rounded-full overflow-hidden`.
   - Fill: `bg-pccw-blue`, width = `clamp(0, 100, value/base*100)%`,
     `h-full rounded-full`.

**Base value:** the first row's `a` for the same scheme in the same
snapshot group (i.e. the A value of the earliest visible period for that
scheme in the Latest snapshot becomes the 100% reference for all rows of
that scheme in the Latest group; the same for the Earlier group).

**Edge case:** when `base === 0` the bar is empty and the pct reads `0.0%`.

### 3.8 "B" column (cols 4 and 7) — plain number

- Right-aligned, `tabular-nums`.
- Color: `text-destructive` (red).
- Formatted with `I9` (e.g. "1,234").

### 3.9 "% Pending" column (cols 5 and 8) — tone dot + number

A right-aligned flex row containing:

1. A 10px (`size-2.5`) circular dot with a 1px inset ring
   (`ring-1 ring-inset ring-black/10`) for definition on light backgrounds.
2. The percentage `(B / A) * 100`, formatted with the project's `z9`
   formatter (e.g. "12.3%").

**Dot color** comes from `tone(pct)`:

| pct    | tone   | color token                   | hex fallback |
|--------|--------|-------------------------------|--------------|
| ≤ 30%  | green  | `var(--color-success, #16a34a)` | `#16a34a`  |
| ≤ 50%  | yellow | `var(--color-warning, #f59e0b)` | `#f59e0b`  |
| > 50%  | red    | `var(--color-destructive, #ef4444)` | `#ef4444` |

When `a === 0`, the dot is hidden and only the percentage is shown
(reads as "0.0%" or "—").

### 3.10 Footer / Total row

- A single row at the bottom of the table, visually separated by a
  thicker top border (`border-t-2` or `bg-muted/30`).
- Scheme cell: **"Total"** (font-medium).
- Period cell: `"<N> rows"` (where N is the count of visible data rows).
- A columns: **integer sum** of all visible A values, no progress bar.
- B columns: **integer sum** of all visible B values, destructive color.
- % columns: **(sum_b / sum_a) * 100** with the matching tone dot.

### 3.11 Empty state

When the filter pipeline produces zero rows:

- The card body shows a centered message: **"No rows match the current
  filter"** in `text-sm text-muted-foreground`.
- No table chrome is rendered (no headers, no footer).

### 3.12 Loading / error state

Not applicable — the dashboard is a static HTML page; data is inlined
into a global `window.CSV_DATA` object at load time. If the global is
absent, the entire page shows a full-screen empty state ("No Tagging
Data" + "No data file was found for this page. Run the parser to
generate data.").

---

## 4. UX — Interaction details

### 4.1 No row click

Rows are **not clickable**. They are pure read-only display. Future
"drill into this row" is out of scope.

### 4.2 No column sort

The table does not support click-to-sort headers. Columns are fixed in
the order described in §3.5. Sort happens upstream in the filter
pipeline (top-5-by-b, or user selection order).

### 4.3 No pagination

All matching rows are shown. The card body scrolls vertically when the
row count exceeds the available height.

### 4.4 No column resize

Column widths are fixed percentages (15% + 7 × 5% + 5% gutter = ~70%
accounted for; the remainder is padding/scrollbar). The whole table
fits inside the card without horizontal scroll.

### 4.5 Header height

The table header row(s) are **sticky** — they stay visible at the top of
the card as the user scrolls the rows. This is critical for the
"Latest · date" / "Earlier · date" group headers, which are the
orientation cue.

### 4.6 Theme

- Light theme only (the rest of the project does not have dark mode).
- All colors come from CSS variables (`--border`, `--muted-foreground`,
  `--foreground`, `--destructive`, `--pccw-blue`, `--color-success`,
  `--color-warning`, `--color-destructive`) so a future dark mode
  change is one CSS swap.

---

## 5. Visual specifications (CSS / Tailwind)

### 5.1 Card

- `border border-border`, `rounded-md`, `bg-card`, `p-5 sm:p-7` (page gutter).
- `flex flex-col min-h-0` so the inner body can scroll.

### 5.2 Header

```html
<header>
  <h1 class="text-xl font-semibold tracking-normal">Contribution Tagging by Scheme</h1>
  <p class="text-sm text-muted-foreground">Two-snapshot comparison</p>
</header>
```

### 5.3 Table

- `table-fixed` so column widths are honored.
- `min-w-0` so the card width wins.
- All cells: `whitespace-normal break-words` so long scheme codes wrap.
- `align-top` on the scheme cell to anchor it to the first row.
- Header cells: `text-[9px] leading-tight` (the project uses very tight
  table headers), with `text-muted-foreground` for the date sub-header.
- A sub-header for the date uses the same `text-[9px] leading-tight` style.
- Numeric cells: `text-right tabular-nums block`.

### 5.4 Progress bar

```html
<div class="flex items-center justify-end gap-2">
  <span class="flex items-center gap-1 tabular-nums">
    <span>1,234</span>
    <span class="text-muted-foreground">|</span>
    <span class="text-[10px] text-muted-foreground">30.5%</span>
  </span>
  <div class="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
    <div class="h-full rounded-full bg-pccw-blue" style="width: 30.5%"></div>
  </div>
</div>
```

### 5.5 Tone dot

```html
<span class="size-2.5 rounded-full ring-1 ring-inset ring-black/10"
      style="background-color: var(--color-success, #16a34a)"
      aria-hidden="true"></span>
```

### 5.6 Footer row

- `font-semibold` (or `font-medium`) on every cell.
- Top border thicker than row borders (`border-t-2` or distinct background).
- Scheme cell: text "Total".
- Period cell: text "<N> rows".

---

## 6. Number formatters (project conventions)

These are helper functions in the project. Reproduce their behavior if
you do not have the originals:

- **`I9(n)`** — integer with thousands separator, no decimals. e.g.
  `1234 → "1,234"`. Used for counts.
- **`z9(num, denom)`** — `(num/denom)*100` formatted as a percentage with
  one decimal. Returns `"—"` if `denom === 0`. e.g. `z9(2, 30) → "6.7%"`.
- **`R9(period)`** — `"2026-05" → "May 26"`. Two-digit year + month name.
- **`F9(trustee)`** — trustee code formatter; for this panel it is the
  identity (just renders the string).

---

## 7. Implementation checklist

1. Compute `rows` (the array of `SchemePeriodRow`):
   - Union of `(scheme, year_month)` keys present in either snapshot.
   - For each key, look up `earlier` and `latest` aggregates (a, b, records).
   - Skip all-zero keys.
2. Apply the **scheme** filter (top-5 vs user-selected).
3. Apply the **period** filter (only keep rows whose `period` is in `c`).
4. Apply the **tone** filter on `latest_pct`.
5. Group by `scheme`, recording the rowSpan count and the "first row" of
   each group (used to hide subsequent scheme cells and to look up the
   base A value).
6. Build column array:
   - `scheme` — rowSpan + hideCell meta
   - `period` — `R9(value)`
   - `latest_a` — `renderProgress(value, baseLatestA.get(scheme) ?? value)`
   - `latest_b` — `<span class="text-right text-destructive">I9(value)</span>`
   - `latest_pct` — dot + `z9(b, a)`
   - `earlier_a` / `earlier_b` / `earlier_pct` — same pattern
7. Build the footer row by reducing `rows` for sum_a, sum_b, sum_records
   and computing `(sum_b / sum_a) * 100` for the percentages.
8. Render the card with sticky table header, scrollable body, fixed
   footer.
9. Render the empty state when `rows.length === 0`.

---

## 8. Acceptance criteria

- [ ] The table shows one row per (scheme × period) intersection present
      in the filtered dataset, plus a Total row at the bottom.
- [ ] The Latest group is always left of the Earlier group.
- [ ] The sub-header in each group is the active snapshot date.
- [ ] The scheme cell spans all rows of the same scheme and is hidden
      for non-first rows.
- [ ] The A column shows integer + percentage of the first-row base + a
      rounded bar of the same percentage.
- [ ] The B column is destructive-colored and right-aligned.
- [ ] The % Pending column shows a colored dot (green/yellow/red per
      §3.9) followed by `B / A` as a percentage.
- [ ] The Total row sums the visible rows and uses the same visual
      language.
- [ ] The card body scrolls vertically when content overflows; the
      header is sticky.
- [ ] When no rows match, only a centered muted message is shown.
- [ ] No row is clickable, no header sorts, no column resizes, no
      pagination.

---

## 9. Out of scope

- Drill-into-row (clicking a row to see underlying records).
- Export to CSV / Excel.
- Bulk actions.
- Dark mode.
- Server-side data (the data source is a static `window.CSV_DATA`).
- Any change to the **trend strip** (3 cards above) or the
  **chart** — those are separate panels with their own specs.
