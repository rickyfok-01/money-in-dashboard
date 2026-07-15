# data-source

PowerShell tool that collects the dashboard's source data from the Oracle DB,
running 7 statistic queries and packaging the results as a daily CSV zip. The
zip's `con-bill-6mon-{YYYYMMDD}.csv` and `con-pym-6mon-{YYYYMMDD}.csv` feeds the
dashboard via `scripts/build_data.py` (see repo `CLAUDE.md`).

## Layout

```
Run-StatisticQueries.ps1   # entry point — runs all 7 queries, zips results
Modules/
  Config.psm1              # loads .env, builds the Oracle connection string
  Oracle.psm1              # connection mgmt + query execution (ODP.NET)
  Template.psm1            # {{param}} placeholder engine for SQL
sql/
  sql-01.sql … sql-07.sql  # the 7 queries (numbered = run order)
statistic_optimized.sql    # full annotated SQL doc (source of the 7 queries)
.env.example               # config template — copy to .env and fill in
data/                      # runtime output (gitignored except .gitkeep)
  temp/                    # per-run CSVs (cleared after each run)
  log/                     # transcript logs ({YYYYMMDD}.log)
```

## Setup

1. **Oracle Managed Data Access** — install the *Oracle Client for Microsoft
   Tools*; the runner loads `Oracle.ManagedDataAccess.dll` via `ORACLE_DLL_PATH`.
2. **Configure credentials** — copy the template and fill in your values:

   ```powershell
   Copy-Item .env.example .env
   # then edit .env: DB_USERNAME, DB_PASSWORD, DB_HOST, DB_SERVICE_NAME, ORACLE_DLL_PATH, ...
   ```

   `.env` is gitignored — it holds live DB credentials and must never be committed.

## Run

```powershell
# from this directory
./Run-StatisticQueries.ps1
```

Connects to Oracle, initializes the session (`DB_INIT_SQL`, if set), runs
`sql-01` … `sql-07` writing each result to `data/temp/{pattern}-{YYYYMMDD}.csv`,
then zips them to `data/{YYYYMMDD}.zip` and clears `data/temp/`. A transcript is
written to `data/log/{YYYYMMDD}.log`. Exits non-zero if any query failed.

## Feed the dashboard

Unzip the output and drop the CSVs into the repo's `data/` directory (next to
`scripts/build_data.py`), then rebuild the dashboard dataset:

```bash
python scripts/build_data.py
```
