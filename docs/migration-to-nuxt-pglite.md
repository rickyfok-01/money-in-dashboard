# Migration Plan: Vanilla JS → Nuxt 3 fullstack + server-side PGlite

> **Status:** DRAFT — awaiting your approval. No code has been written yet.
> **Date:** 2026-07-22 (rev 2)

---

## 0. TL;DR

Rewrite `money-in-dashboard` as a **fullstack Nuxt 3 app**: a Node server backed by an embedded **[PGlite](https://pglite.dev/)** database (Postgres-in-WASM, run server-side), plus a Vue 3 front end. The server owns the database — it seeds from CSV and exposes typed query API routes; the client renders 28 dashboard tabs and calls those routes.

Replaces the frozen 11 MB `data.js` blob and the Python `build_data.py` pipeline. **Data accumulates** in `/data` over your working days; a reseed command (CLI + admin endpoint) ingests new CSVs into the running DB. **All HTML/UI is revamped** into Vue components and Tailwind. **DB columns are fully descriptive** (`snapshot_date`, `trustee_code`, `bill_count`, …).

> The previous draft was client-side-only and contradicted itself about a server layer. This rev commits to a **server-owned PGlite** — the corrected shape now that you've confirmed a server can be hosted.

---

## 1. Goal & non-goals

**Goal.** A fullstack Nuxt app functionally identical to today's dashboard — same 28 tabs, same calculations, same ordering, same Current/Compare/Trend modes — backed by a queryable server-side Postgres (PGlite) that accumulates data over time, with a revamped Vue/Tailwind UI and descriptive DB columns.

**Non-goals:**
- No new analytics, tabs, or chart types.
- No change to the `data/*.csv` format or the Oracle `.ps1` collection scripts — they remain the source of truth.
- No auth / multi-tenant / row-level security (single shared dataset; can be added later).

---

## 2. What was archived (done, verified)

Moved to `_archive/`, byte-verified identical to `HEAD` (only CRLF/LF differences — no data loss):

| Archived | Why |
|---|---|
| `js/*` (11 files, ~5,300 LOC) | Rewritten as Vue 3 pages + composables |
| `index.html` | Replaced by `app.vue` + `pages/` (full UI revamp) |
| `styles.css` (839 lines) | Replaced by Tailwind + scoped CSS |
| `data.js` (11 MB) | Replaced by PGlite tables |
| `scripts/build_data.py`, `test_build_data.py` | Seed logic moves to the Nuxt server |
| `.claude/`, `CLAUDE.md`, `AGENTS.md` | Old agent config |
| `docs/AGILE.md`, `ROADMAP.md`, `ITERATION-LOG.md`, `FRAMEWORK-BACKLOG.md`, `SPEC-*.md`, `iter-*`, `pre-agile/`, `superpowers/` | Historical process docs |

**Kept untouched** — the source of truth and the acceptance specs:
- `data/` — CSVs + `.ps1` Oracle collection scripts.
- `docs/00-architecture.md` … `docs/28-dda-dimensions.md` — tab specs.
- `docs/README.md`, `docs/STATUS.md`.

---

## 3. Architecture — server-owned PGlite

```
                ┌─────────────────────────────────────┐
                │        Nuxt server (Nitro/Node)      │
                │                                      │
                │   server/plugins/pglite.ts            │
                │     └─ single PGlite instance         │
                │        (persists to ./data/.pglite)   │
                │           ▲                           │
                │           │ seed on boot if empty;    │
                │           │ reseed on /api/admin/reseed│
                │   server/lib/seed.ts                  │
                │     └─ reads /data/*.csv + .xlsx      │
                │           ▲                           │
                │           │ SQL                       │
                │   server/api/query/*.ts               │
                │     /summary  /dimensions             │
                │     /pym      /ddi       /dda  ...    │
                └───────────────┬───────────────────────┘
                                │  $fetch('/api/query/…')
                                ▼
                ┌─────────────────────────────────────┐
                │          Nuxt client (Vue 3)         │
                │   app.vue  +  pages/*.vue (28)       │
                │   <ScopeBar/>  <Sidebar/>            │
                │   composables/useAnalytics.ts        │
                │   components/BaseChart.vue, …        │
                └─────────────────────────────────────┘
```

**Key properties:**
- **PGlite is server-side.** Initialized once in a Nitro plugin, shared across requests via `useStorage()` / a module-scoped singleton. Persists to disk (`./data/.pglite/`) so data survives restarts.
- **No browser DB.** The client never touches SQL — only typed JSON from `/api/query/*`. Smaller bundle, no WASM download for users, works on every device.
- **SSR on or off?** Default **SSR on** (Nuxt default) for fast first paint and SEO-friendly shells; charts wrapped in `<ClientOnly>` so Chart.js/canvas never run on the server. Can flip to SPA (`ssr:false`) later if desired — the API contract is identical either way.
- **Accumulation model.** New daily CSVs land in `/data`; an operator runs `npm run reseed` (or POSTs `/api/admin/reseed`) to upsert the new snapshot into the running DB. No file deletion, no rebuild script — data only grows.

---

## 4. Technology replacement table (names verified)

| Old | New | Notes |
|---|---|---|
| `data.js` JSON blob | PGlite tables (server-side) | Queryable; accumulates over time |
| `js/core.js` (state, filters, aggregations) | `composables/useAnalytics.ts` | Reactive; calls API routes |
| `js/app.js` (TABS, scope bar, router) | `app.vue` + `pages/*.vue` + `<ScopeBar/>` | Nuxt file routing |
| `js/charts.js` (1,340-line Chart.js wrapper) | `components/BaseChart.vue` over `chart.js` | Same Chart.js 4.x configs |
| `js/tabs-*.js` × 12 | `pages/*.vue` × 28 | one page per tab |
| `scripts/build_data.py` | `server/lib/seed.ts` + `/api/admin/reseed` | Runs server-side |
| Python `csv` | `csv-parse` (sync, server) | Robust CSV parse |
| `openpyxl` (xlsx read) | `xlsx` (SheetJS, server) | Reads `constant-scheme-info.xlsx` |
| raw `styles.css` | Tailwind + scoped `<style>` | keep the 4-theme palette as CSS custom properties |
| D3.js (Summary tab only) | native Vue `<svg>` (`<rect>`/`<circle>`) | drop the D3 CDN |

**Deps:**
```bash
npx nuxi@latest init .                 # Nuxt 3
npm i @electric-sql/pglite             # Postgres-in-WASM, server-side
npm i csv-parse                        # CSV seed parse (sync)
npm i xlsx                             # read constant-scheme-info.xlsx
npm i chart.js vue-chartjs             # charts
npm i -D tailwindcss @nuxtjs/tailwindcss
```

---

## 5. Database schema — descriptive columns

Seven fact tables + a names lookup. Columns use full names so anyone querying the DB (you, future tools) reads them without a glossary. Derived from the archived `build_data.py` reader fields.

```sql
-- Contribution bill rows (con-bill-6mon-*.csv) — the main fact table.
CREATE TABLE bill_rows (
  snapshot_date    DATE,
  trustee_code     TEXT,
  scheme_code      TEXT,
  status_code      TEXT,        -- AV_STATUS_CODE
  contribution_mode TEXT,       -- AV_BILL_CONTR_MODE (REGULAR / LUMP_SUM / SURCHARGE)
  frequency_type   TEXT,        -- AV_FREQ_TYPE (blank → '(unset)')
  account_type     TEXT,        -- SHORT_CODE
  contribution_month TEXT,      -- YEAR_MONTH 'YYYY-MM'
  bill_count         INT,
  ontime_submit_count INT,
  total_submit_count  INT,
  submit_dde_count    INT,
  submit_batch_count  INT,
  submit_portal_count INT,
  submit_bulkupload_count INT,
  submit_other_count  INT,
  er_submitted_amount INT,      -- = bill_count if status ∈ A_STATUSES else 0
  pending_tagging_amount INT    -- = bill_count if status ∈ B_STATUSES else 0
);

-- Payment rows (con-pym-6mon-*.csv) — different grain.
CREATE TABLE payment_rows (
  snapshot_date   DATE,
  trustee_code    TEXT,
  scheme_code     TEXT,
  pay_channel_code TEXT,
  tag_status_code  TEXT,
  pay_method_code  TEXT,
  contribution_month TEXT,
  payment_count   INT,
  pay_amount      NUMERIC(18,2),    -- HKD, cents
  avail_amount    NUMERIC(18,2)
);

-- AO aging (con-pym-ao-aging-*.csv).
CREATE TABLE ao_aging (
  snapshot_date   DATE,
  trustee_code    TEXT, scheme_code TEXT,
  pay_channel_code TEXT, tag_status_code TEXT, pay_method_code TEXT,
  total_count INT,
  aging_00_06_count INT, aging_07_14_count INT, aging_15_21_count INT,
  aging_22_30_count INT, aging_31_more_count INT
);

-- DDI 30-day (ddi-30day-*.csv).
CREATE TABLE ddi_30day (
  snapshot_date DATE, trustee_code TEXT, scheme_code TEXT, account_type TEXT,
  request_date  DATE,
  total_count INT, submitted_to_bank_count INT,
  success_count INT, rejected_count INT
);

-- DDI aging (ddi-aging-*.csv).
CREATE TABLE ddi_aging (
  snapshot_date DATE, trustee_code TEXT, scheme_code TEXT, account_type TEXT,
  total_count INT,
  aging_00_06_count INT, aging_07_14_count INT, aging_15_21_count INT,
  aging_22_30_count INT, aging_31_more_count INT
);

-- DDA 30-day (dda-30day-*.csv).
CREATE TABLE dda_30day (
  snapshot_date DATE, trustee_code TEXT, scheme_code TEXT, account_type TEXT,
  total_count INT,
  submitted_to_pig_count INT, submitted_to_bank_count INT,
  active_count INT, inactive_count INT,
  rejected_count INT, suspend_count INT
);

-- DDA aging (dda-aging-*.csv).
CREATE TABLE dda_aging (
  snapshot_date DATE, trustee_code TEXT, scheme_code TEXT, account_type TEXT,
  total_count INT,
  aging_00_06_count INT, aging_07_14_count INT, aging_15_21_count INT,
  aging_22_30_count INT, aging_31_more_count INT
);

-- Code → friendly name (constant-scheme-info.xlsx).
CREATE TABLE code_names (
  kind TEXT,          -- 'scheme' | 'trustee'
  code TEXT,
  name TEXT,
  PRIMARY KEY (kind, code)
);

-- Seed audit log (which snapshots have been ingested).
CREATE TABLE seed_history (
  snapshot_date DATE PRIMARY KEY,
  source_files  TEXT[],
  ingested_at   TIMESTAMPTZ DEFAULT now(),
  row_counts    JSONB
);
```

**Status-set constants** (compute `er_submitted_amount` / `pending_tagging_amount` at seed time, exactly as `build_data.py`):
- `A_STATUSES` (ER-submitted) = `{PARTIAL_SUBMIT, SUBMITTED, APPROVED, PARTIAL_PAID, FULLY_PAID}`
- `B_STATUSES` (pending tagging) = `{PARTIAL_SUBMIT, SUBMITTED, APPROVED}`

**Month window.** Keep the latest 6 distinct `contribution_month`s — enforced as a **view** or at query time, not by deleting rows (so historical data is retained as it accumulates).

**Indexes** (after seed):
```sql
CREATE INDEX ON bill_rows (snapshot_date, contribution_month);
CREATE INDEX ON bill_rows (scheme_code, trustee_code);
CREATE INDEX ON payment_rows (snapshot_date, contribution_month);
CREATE INDEX ON ddi_30day (snapshot_date);
CREATE INDEX ON dda_30day (snapshot_date);
```

---

## 6. Seed pipeline (server-side, replaces `build_data.py`)

```
server/lib/seed.ts
  seedIfEmpty(db)            // called from the pglite Nitro plugin on boot
  reseed(db)                 // full re-ingest: called by CLI + /api/admin/reseed
    1. BEGIN;
    2. for each CSV family (con-bill, con-pym, ao-aging, ddi-30day, …):
         read /data/<glob> with csv-parse (sync, utf-8-sig)
         coerce numerics exactly like build_data.py: toInt / toFloat
         drop blank rows (no trustee_code AND no scheme_code)
         backfill snapshot_date from filename when CSV column missing
         compute er_submitted_amount / pending_tagging_amount per row
         INSERT … in batches of ~5,000
    3. read constant-scheme-info.xlsx → code_names
    4. upsert seed_history(snapshot_date, source_files, row_counts)
    5. CREATE INDEX IF NOT EXISTS …
    6. COMMIT;
```

**Accumulation / reseed behavior** (your decision: drop into `/data` + reseed command):
- Drop new daily CSVs into `/data/` (e.g. `con-bill-6mon-20260723.csv`).
- Run **`npm run reseed`** (CLI script) **or** POST **`/api/admin/reseed`**.
- `reseed` is **idempotent**: it upserts by `(snapshot_date, …)` natural keys and writes to `seed_history`, so running it twice is safe and old snapshots are preserved. New snapshots simply append.
- The PGlite DB file lives at `./data/.pglite/` and persists across server restarts, so you only reseed when new CSVs arrive.

**Coercion rules** (ported verbatim from `build_data.py`, since the 20260708 export ships floats like `9.0` and must normalize): `toInt` rounds `float(str)`; `toFloat` rounds to 2 decimals; empty string → `0`.

---

## 7. Server API routes

Thin typed wrappers over SQL. The client depends only on these.

```
server/api/query/
  meta.ts          → GET  /api/query/meta
                       { snapshots[], latest, months[], schemes[],
                         trustees[], statuses[], modes[], freqs[],
                         accountTypes[], channels[] }
  bill.ts          → GET  /api/query/bill?snapshot=&schemes=&trustees=&
                                accountType=&from=&to=
                       rows matching the scope (replaces core.js rowsFor)
  summary.ts       → GET  /api/query/summary?…   — Tab 00 KPIs
  dimensions.ts    → GET  /api/query/dimensions?tab=…&group=…
                       generic groupBy for the dimension tabs (03–09)
  pym.ts           → GET  /api/query/pym?…        — Tabs 02, 17
  aging.ts         → GET  /api/query/aging?kind=ao|ddi|dda
  dd.ts            → GET  /api/query/dd?kind=ddi|dda&window=30day|aging
  compare.ts       → GET  /api/query/compare?snapA=&snapB=&…
                       delta computation for Compare mode

server/api/admin/
  reseed.ts        → POST /api/admin/reseed      — triggers server/lib/seed.reseed()
  status.ts        → GET  /api/admin/status       — seed_history + row counts
```

Query params are validated with `zod`; responses are typed TS interfaces shared with the client via a `server/types/api.ts` (importable from both sides).

---

## 8. Client data layer — `useAnalytics`

A direct conceptual port of `core.js`, but reactive over API data instead of a global `DATA`:

```ts
// composables/useAnalytics.ts
export const useAnalytics = () => {
  const state = reactive({
    snapshot: '', snapshotA: '', snapshotB: '',
    schemes: [] as string[],     // multi-select, all by default
    trustees: [] as string[],
    accountType: '',
    monthFrom: '', monthTo: '',
    mode: 'current' as 'current' | 'compare' | 'trend',
  })

  const { data: meta } = useFetch('/api/query/meta')          // fills dropdowns
  const bill = computed(() => useFetch('/api/query/bill', { query: () => scopeParams(state) }))
  // …per-tab fetches, memoized by scope

  // Pure aggregation helpers (blank/add/totals/ranked/monthKeySeries)
  // port from core.js unchanged — they operate on row arrays the API returns.
  return { state, meta, bill, ranked, monthKeySeries, /* … */ }
}
```

The `blank()`/`add()`/`totals()`/`ranked()` helpers stay pure-TS (not SQL) to avoid re-debugging subtle ordering and "Other" roll-up logic; the API returns filtered rows and the client aggregates. The three modes map to different endpoint/param combinations.

---

## 9. Routing & shell (full UI revamp)

Nuxt file-based routing; the 28-page list and 7 sidebar groups are lifted from `js/app.js`'s `TABS`:

```
pages/   index.vue (00 Summary)  pend-tagging.vue (01)
  money-allocation.vue (02)  scheme-scorecard.vue (03)
  status-lifecycle.vue (04)  trustee.vue (05)
  contribution-mode.vue (06) frequency.vue (07)
  account-type.vue (08)      submit-channel.vue (09)
  ontime-performance.vue (10) submit-funnel-coverage.vue (11)
  monthly-trend.vue (12)     snapshot-comparison.vue (13)
  status-channel.vue (14)    trustee-channel.vue (15)
  frequency-status.vue (16)  payment-outcome.vue (17)
  backlog.vue (18)           completion.vue (19)
  outliers.vue (20)          volume-tiers.vue (21)
  trustee-portfolio.vue (22)
  settings.vue (23, noScope) theme.vue (24, noScope)
  summary-v2.vue (25)        dd-overview.vue (26)
  ddi-dimensions.vue (27)    dda-dimensions.vue (28)
```

`app.vue` is the revamped shell: collapsible sidebar (7 groups), sticky `<ScopeBar/>`, and `<NuxtPage/>`. The Current/Compare/Trend buttons enable/disable per-tab via each page's `definePageMeta({ modes: [...] })`, mirroring `updateScopeBar()`.

**Drill-through** (clicking a chart narrows scope) is preserved via query params (`?scheme=VC&trustee=AIA`).

Since you've greenlit a full UI revamp, Phase 6 includes a deliberate design pass: clearer hierarchy, consistent card spacing, a polished data table component, loading/skeleton states during API fetches, and a small admin page exposing the reseed endpoint with a progress indicator.

---

## 10. Charts & styling

- `<BaseChart>` wraps `chart.js` 4.x (`vue-chartjs`); all 1,340 lines of `js/charts.js` collapse to `baseOpts()` + per-tab dataset builders returning `ChartConfiguration`. Wrap in `<ClientOnly>`.
- The **single D3 usage** (Summary tab) becomes a small native-SVG Vue component — removes the D3 CDN.
- **Tailwind** for layout; the **4-theme palette** stays as CSS custom properties on `:root[data-theme="…"]`, toggled by Settings → Theme. `tone()`/`toneHex()` helpers port unchanged.
- Fonts (Inter, monospace for codes, Fraunces for titles) self-hosted under `/public/fonts` — no Google Fonts CDN.
- `card-stagger` entrance animation → Vue `<TransitionGroup>`.

---

## 11. Phased plan — "set up a good base first"

Per your steer, Phases 1–3 build the foundation (server + DB + seed + core composable + shell) and stand on their own before any tab work begins.

| Phase | Scope | Exit criterion | Sessions |
|---|---|---|---|
| **1. Scaffold** | `nuxi init`; deps (§4); `nuxt.config` (pglite nitro wasm flag, tailwind module); empty `app.vue` | `npm run dev` serves a blank themed page | 1 |
| **2. DB + seed** | PGlite Nitro plugin (server singleton, persists to `./data/.pglite`); schema (§5); `server/lib/seed.ts`; `reseed` CLI + `/api/admin/reseed`; `/api/admin/status` | All 8 tables populated; row counts match CSVs; `seed_history` records each snapshot; re-running reseed is idempotent | 2 |
| **3. Core base** | `/api/query/meta` + `/api/query/bill`; `useAnalytics` (state + scope params + `ranked`/`monthKeySeries` port); `app.vue` shell; sidebar; `<ScopeBar/>`; routing; loading skeletons | Can navigate all 28 routes; scope bar filters flow through `/api/query/bill` and return correct rows | 1–2 |
| **4. Charts** | `<BaseChart>`, `baseOpts()`, dataset builders; D3→SVG Summary component | A throwaway page renders one of each chart type correctly | 1 |
| **5. Tabs** | Migrate 28 pages per `docs/00-…28`; remaining query routes (summary/dimensions/pym/aging/dd/compare) | Each page's numbers cross-check vs. the archived `data.js` dashboard | 4–5 |
| **6. UI revamp** | Design pass: card hierarchy, data-table component, skeletons, admin page, transitions, fonts | Visual parity + polish vs. current dashboard | 1–2 |
| **7. Build & verify** | `npm run build`; smoke test prod server; short README + ops note for reseed | Prod build seeds and renders Summary end-to-end; reseed adds a new snapshot correctly | 1 |

**Total: ~11–14 sessions.** Phase 2 grows vs. the client-side plan because the seed/accumulation model and reseed idempotency need real care.

---

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| PGlite concurrency under a real server | PGlite is single-connection; route handlers share the singleton via the Nitro plugin. Acceptable for a single-operator internal dashboard. If load grows, swap PGlite for real Postgres later — schema is portable. |
| Concurrent reseed during requests | `reseed` runs in one transaction; queries either see pre- or post-seed state. Show a "reseeding…" banner via `/api/admin/status`. |
| Seed performance on 100k+ rows | Batched INSERTs of 5,000 inside a transaction; server-side parse is fast. |
| Chart.js + canvas under SSR | `<ClientOnly>` wrappers; SSR renders the shell, not canvases. |
| Subtle aggregation drift vs. `data.js` | Phase 5 cross-checks each tab's numbers against the archived dashboard before the tab is called done. |
| Column rename introduces bugs | One mapping layer in `server/lib/seed.ts` (CSV header → descriptive column); covered by `test_build_data.py` logic ported into a seed unit test. |

---

## 13. Notes to reviewer

- **Nothing in `data/` changes** — CSVs and `.ps1` scripts remain the authority; they just accumulate.
- **No data is lost** — pre-migration app fully preserved in `_archive/`, byte-verified.
- **Server-owned PGlite** (this rev): the DB lives on the server, persists to disk, and is the single source for all client queries. The browser runs no SQL.
- **Accumulation**: drop CSVs into `/data`, run `npm run reseed` (or hit `/api/admin/reseed`). Idempotent; history preserved in `seed_history`.
- **Descriptive columns** throughout the DB — `snapshot_date`, `bill_count`, `ontime_submit_count`, `er_submitted_amount`, etc.
- **Full UI revamp** is in scope (Phase 6) per your call.
- Tab specs (`docs/00-…28`) remain the acceptance criteria.

---

## 14. Decisions (approved 2026-07-22)

1. **PGlite persistence path** → `./data/.pglite/` confirmed. No change.
2. **Reseed trigger** → **both**: CLI (`npm run reseed`) **and** HTTP (`POST /api/admin/reseed`). Both already implemented in Phase 1.
3. **SSR** → **on** (Nuxt default). Charts will be wrapped in `<ClientOnly>` so Chart.js/canvas never run server-side.
4. **Latest-6-month window** → **applied at query time**. All historical rows are retained and queryable; the window is a default filter in `useAnalytics` / query routes, not a row-deletion rule. This preserves accumulated history as daily data grows.
5. **Migration order** → **base first** (Phases 1–3), then charts, then tabs Summary-first. Phase 1 (scaffold + DB + seed + data explorer) is **done and verified**.

> Status of each phase as of 2026-07-22:
> - **Phase 1 — Scaffold + DB + seed + data explorer**: ✅ complete (106,790 rows seeded, table browser + SQL runner verified end-to-end).
> - Phase 2 (DB + seed) was effectively folded into Phase 1 — the schema, seed pipeline, reseed CLI, and `/api/admin/reseed` all shipped.
> - Phases 3–7 remain.

