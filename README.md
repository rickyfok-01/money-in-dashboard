# Money-In Dashboard

An MPF contribution monitoring dashboard. Nuxt 3 fullstack app with an
embedded [PGlite](https://pglite.dev/) database (Postgres compiled to WASM,
running server-side) seeded from CSV extracts of Oracle.

This repository is mid-migration from a zero-build vanilla-JS app (preserved
in [`_archive/`](_archive/)) to Nuxt + PGlite. See
[`docs/migration-to-nuxt-pglite.md`](docs/migration-to-nuxt-pglite.md) for the
full plan and status.

> **Current state:** Phase 1 complete — the app boots, seeds the database from
> CSV, and exposes a **data explorer** (browse tables at 100 rows/page, run
> ad-hoc SQL, trigger reseeds). The 28 dashboard tabs are planned for later
> phases.

---

## Prerequisites

- **Node.js 24+** (the seed worker uses Node's native TypeScript type-stripping)
- **npm 10+** (bundled with Node 24)
- The `/data` folder populated with CSV extracts (see [Data](#data) below)

Check your versions:

```bash
node -v   # v24.x or newer
npm -v    # 10.x or newer
```

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server (boots on http://localhost:3000)
npm run dev
```

The first request triggers the database to seed from every `data/*.csv`
(this takes ~25–30 seconds for a full dataset of ~100k rows). Subsequent
restarts load instantly — the seeded database persists to disk at
`data/.pglite/` and is only rebuilt when you reseed.

Open **http://localhost:3000** in your browser.

---

## Daily operation

### Adding new data

Your daily workflow when fresh Oracle extracts arrive:

1. **Drop the new CSVs into `data/`**, following the existing naming pattern:
   - `con-bill-6mon-YYYYMMDD.csv`
   - `con-pym-6mon-YYYYMMDD.csv`
   - `con-pym-ao-aging-YYYYMMDD.csv`
   - `ddi-30day-YYYYMMDD.csv`
   - `ddi-aging-YYYYMMDD.csv`
   - `dda-30day-YYYYMMDD.csv`
   - `dda-aging-YYYYMMDD.csv`
2. **Reseed** the database to ingest them (data only accumulates — nothing is
   deleted):

   **Option A — from the UI:** open the app → **Status** tab → click the
   **Reseed** button. A banner shows progress.

   **Option B — from the terminal** (no browser needed):
   ```bash
   npm run reseed
   ```
3. Refresh the browser. The new snapshot is now queryable.

The reseed is **idempotent**: it truncates and re-inserts from every CSV, so
running it twice is safe. Each run is recorded in the `seed_history` table.

### What "Reseed" does

- Truncates all fact tables (`bill_rows`, `payment_rows`, `ao_aging`,
  `ddi_30day`, `ddi_aging`, `dda_30day`, `dda_aging`, `code_names`)
- Re-reads every CSV in `data/` and bulk-inserts the rows
- Derives the `er_submitted_amount` / `pending_tagging_amount` columns from
  the status sets (mirrors the original `build_data.py` logic)
- Writes one `seed_history` row per snapshot with the source files and row
  counts

### Changing the database location

By default the PGlite database lives at `data/.pglite/` (gitignored). To put
it elsewhere, set an environment variable before starting:

```bash
DB_DIR=./var/db DATA_DIR=./data npm run dev
```

To **start fresh** (wipe and re-seed from scratch):

```bash
rm -rf data/.pglite
npm run dev   # first request re-seeds
```

---

## Using the data explorer

The app has three tabs:

### Browse

- Pick a table from the left sidebar (shows row counts).
- The main panel shows rows, **100 per page**, with pagination at the bottom.
- Click a column header to sort ascending/descending.
- Use the **search** box (top-right) to filter across all text columns.

### SQL

- Write any `SELECT` query against the database and click **Run query**.
- Results are capped at 1000 rows by default (override with a `limit` in the
  request body). Truncated results are flagged.
- **Write statements** (`INSERT`, `UPDATE`, `DELETE`, `DROP`, …) are blocked
  with a `403` — this is a read-only explorer.

Example queries:

```sql
-- How many bills per snapshot?
SELECT snapshot_date, COUNT(*) AS bills, SUM(bill_count) AS total
FROM bill_rows
GROUP BY snapshot_date
ORDER BY snapshot_date DESC;

-- Top 10 schemes by bill volume in the latest snapshot
SELECT scheme_code, SUM(bill_count) AS total
FROM bill_rows
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM bill_rows)
GROUP BY scheme_code
ORDER BY total DESC
LIMIT 10;
```

### Status

- Shows the database readiness state and per-table row counts.
- Lists the seed history (which snapshots were ingested, and when).
- Surfaces the Reseed button and any seed errors.

---

## Database schema

Nine tables with **descriptive column names** (not the terse codes of the
legacy `data.js`). Full DDL lives in
[`server/lib/schema.ts`](server/lib/schema.ts).

| Table | Source CSV | Grain |
|---|---|---|
| `bill_rows` | `con-bill-6mon-*.csv` | snapshot × trustee × scheme × status × mode × freq × account × month |
| `payment_rows` | `con-pym-6mon-*.csv` | snapshot × trustee × scheme × channel × tag × method × month |
| `ao_aging` | `con-pym-ao-aging-*.csv` | snapshot × trustee × scheme × channel × tag × method |
| `ddi_30day` | `ddi-30day-*.csv` | snapshot × trustee × scheme × account × request date |
| `ddi_aging` | `ddi-aging-*.csv` | snapshot × trustee × scheme × account |
| `dda_30day` | `dda-30day-*.csv` | snapshot × trustee × scheme × account |
| `dda_aging` | `dda-aging-*.csv` | snapshot × trustee × scheme × account |
| `code_names` | `constant-scheme-info.xlsx` | code → friendly name (scheme/trustee) |
| `seed_history` | (generated) | one row per ingested snapshot |

### Column naming

Examples of the descriptive naming:

| Legacy code | Database column |
|---|---|
| `s` | `snapshot_date` |
| `tr` | `trustee_code` |
| `sc` | `scheme_code` |
| `bill` | `bill_count` |
| `ontime` | `ontime_submit_count` |
| `dde` / `batch` / `portal` / `bulk` / `other` | `submit_dde_count` / `submit_batch_count` / `submit_portal_count` / `submit_bulkupload_count` / `submit_other_count` |
| `a` | `er_submitted_amount` |
| `b` | `pending_tagging_amount` |
| `d00_06` | `aging_00_06_count` |

---

## API reference

All endpoints are under `/api`. They return JSON.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/tables` | List all tables with row counts and columns |
| `GET` | `/api/tables/:table?page=1&pageSize=100&sort=&dir=&search=` | Browse one table, paginated |
| `POST` | `/api/sql` | Run a read-only SQL query (body: `{ sql, limit? }`) |
| `GET` | `/api/admin/status` | Database readiness, row counts, seed history |
| `POST` | `/api/admin/reseed` | Trigger a full re-ingest from CSV |

---

## Data

The `data/` directory holds the CSV source of truth (generated upstream by
Oracle collection scripts in `data/data-source/`). It is **not committed** to
git — see `.gitignore`. The schemas of each CSV family are documented in the
per-tab specs under `docs/`.

The PGlite database (`data/.pglite/`) is also gitignored — it is always
regenerable from the CSVs via `npm run reseed`.

### CSV families

| Pattern | Description |
|---|---|
| `con-bill-6mon-YYYYMMDD.csv` | Contribution bill rows (main fact table) |
| `con-pym-6mon-YYYYMMDD.csv` | Payment rows (amounts) |
| `con-pym-ao-aging-YYYYMMDD.csv` | AO aging buckets |
| `ddi-30day-YYYYMMDD.csv` | DDI direct debit — last 30 days |
| `ddi-aging-YYYYMMDD.csv` | DDI aging buckets |
| `dda-30day-YYYYMMDD.csv` | DDA mandates — last 30 days |
| `dda-aging-YYYYMMDD.csv` | DDA aging buckets |
| `constant-scheme-info.xlsx` | Code → name lookup |

---

## Architecture (Phase 1)

```
            browser
               │  HTTP (SSR)
               ▼
   ┌───────────────────────────────┐
   │   Nuxt server (Nitro / Node)   │
   │   server/lib/db.ts             │ ◄── thin client, spawns worker
   │   server/api/*                 │     (JSON-RPC over stdio)
   └───────────────┬───────────────┘
                   │ spawn
                   ▼
   ┌───────────────────────────────┐
   │   db-worker.mjs (plain node)   │
   │   PGlite (Postgres-in-WASM)    │ ◄── seeds from data/*.csv
   │   persists to data/.pglite/    │
   └───────────────────────────────┘
```

PGlite runs in a **separate child process** (`db-worker.mjs`) rather than
inside the Nitro server. This is deliberate: PGlite's Emscripten runtime
resolves its `.wasm` via `import.meta.url`, which Nitro's dev bundler rewrites
to a bare Windows path that Node rejects. Running PGlite under plain `node`
(where `import.meta.url` is correct) sidesteps the issue entirely. The Nuxt
server talks to the worker over line-delimited JSON-RPC.

- **SSR is on** (Nuxt default). The page shell renders server-side; data
  fetches happen client-side.
- **The latest-6-month window** is applied at query time (a default filter),
  not by deleting rows — all historical data stays queryable.

---

## NPM scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server at http://localhost:3000 |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |
| `npm run reseed` | Re-ingest all CSVs into the database (CLI) |

---

## Project structure

```
.
├── app.vue                     # Root component
├── nuxt.config.ts              # Nuxt / Nitro config
├── db-worker.mjs               # PGlite child process (plain node)
├── package.json
├── pages/
│   └── index.vue               # Data explorer (browse / SQL / status)
├── server/
│   ├── api/
│   │   ├── tables/             # GET /api/tables, /api/tables/:table
│   │   ├── sql/                # POST /api/sql
│   │   └── admin/              # GET status, POST reseed
│   ├── lib/
│   │   ├── db.ts               # Worker client (spawns db-worker.mjs)
│   │   ├── schema.ts           # SQL DDL + status-set constants
│   │   └── seed.ts             # CSV → row objects
│   ├── plugins/
│   │   └── pglite.ts           # Boots the worker on server start
│   └── types.ts                # Shared API types
├── data/                       # CSV source of truth (gitignored)
│   └── .pglite/                # PGlite database (gitignored)
├── docs/
│   ├── 00-28 *.md              # Per-tab specs (acceptance criteria)
│   └── migration-to-nuxt-pglite.md
└── _archive/                   # Pre-migration vanilla-JS app (reference)
```

---

## Troubleshooting

**The first page load is slow / shows "seeding…".**
This is expected — the database seeds from CSV on the first request after a
fresh start, which takes ~25–30 seconds for ~100k rows. Once seeded, it
persists to `data/.pglite/` and subsequent restarts are instant.

**A query returns `Aborted(). Build with -sASSERTIONS for more info.`**
A previous worker process may have left the database locked. Wipe and re-seed:
```bash
rm -rf data/.pglite
npm run dev
```

**Port 3000 is already in use.**
Nuxt auto-selects the next free port (check the dev server output for the
actual URL, e.g. `http://localhost:3001`), or kill stale Node processes:
```bash
# Windows (Git Bash)
taskkill //F //IM node.exe
```

**`code_names` table is empty.**
The `constant-scheme-info.xlsx` header keys didn't match the expected names.
The dashboard degrades to showing raw codes (same as the legacy app did).
This is a known minor gap, not blocking.

**Reseed button in the UI does nothing.**
Check the **Status** tab for the `lastError` field, and the dev server console
for `[db-worker]` log lines (the worker's stderr is forwarded there).
