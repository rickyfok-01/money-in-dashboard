// SQL schema for the embedded PGlite database.
//
// Tables are keyed to the CSV families in /data. Column names are descriptive
// (not the terse s/tr/sc codes of the legacy data.js) so anyone querying the
// DB directly can read them without a glossary. Derivation documented in
// docs/migration-to-nuxt-pglite.md §5.

// Statuses that count as "ER-submitted contribution data" (A) vs "Pending
// Tagging" (B). Used to compute the derived amount columns at seed time,
// mirroring scripts/build_data.py A_STATUSES / B_STATUSES.
export const A_STATUSES = new Set([
  'PARTIAL_SUBMIT',
  'SUBMITTED',
  'APPROVED',
  'PARTIAL_PAID',
  'FULLY_PAID',
])
export const B_STATUSES = new Set([
  'PARTIAL_SUBMIT',
  'SUBMITTED',
  'APPROVED',
])

export const SCHEMA_SQL = /* sql */ `
DROP TABLE IF EXISTS bill_rows;
DROP TABLE IF EXISTS payment_rows;
DROP TABLE IF EXISTS ao_aging;
DROP TABLE IF EXISTS ddi_30day;
DROP TABLE IF EXISTS ddi_aging;
DROP TABLE IF EXISTS dda_30day;
DROP TABLE IF EXISTS dda_aging;
DROP TABLE IF EXISTS code_names;
DROP TABLE IF EXISTS seed_history;

-- Contribution bill rows (con-bill-6mon-*.csv) — main fact table.
CREATE TABLE bill_rows (
  id                    SERIAL PRIMARY KEY,
  snapshot_date         TEXT NOT NULL,
  trustee_code          TEXT NOT NULL,
  scheme_code           TEXT NOT NULL,
  status_code           TEXT,
  contribution_mode     TEXT,
  frequency_type        TEXT,
  account_type          TEXT,
  contribution_month    TEXT,
  bill_count            INT,
  ontime_submit_count   INT,
  total_submit_count    INT,
  submit_dde_count      INT,
  submit_batch_count    INT,
  submit_portal_count   INT,
  submit_bulkupload_count INT,
  submit_other_count    INT,
  er_submitted_amount   INT,
  pending_tagging_amount INT,
  ingested_at           TIMESTAMPTZ DEFAULT now()
);

-- Payment rows (con-pym-6mon-*.csv).
CREATE TABLE payment_rows (
  id                    SERIAL PRIMARY KEY,
  snapshot_date         TEXT NOT NULL,
  trustee_code          TEXT NOT NULL,
  scheme_code           TEXT NOT NULL,
  pay_channel_code      TEXT,
  tag_status_code       TEXT,
  pay_method_code       TEXT,
  contribution_month    TEXT,
  payment_count         INT,
  pay_amount            NUMERIC(18,2),
  avail_amount          NUMERIC(18,2),
  ingested_at           TIMESTAMPTZ DEFAULT now()
);

-- AO aging (con-pym-ao-aging-*.csv).
CREATE TABLE ao_aging (
  id                    SERIAL PRIMARY KEY,
  snapshot_date         TEXT NOT NULL,
  trustee_code          TEXT NOT NULL,
  scheme_code           TEXT NOT NULL,
  pay_channel_code      TEXT,
  tag_status_code       TEXT,
  pay_method_code       TEXT,
  total_count           INT,
  aging_00_06_count     INT,
  aging_07_14_count     INT,
  aging_15_21_count     INT,
  aging_22_30_count     INT,
  aging_31_more_count   INT,
  ingested_at           TIMESTAMPTZ DEFAULT now()
);

-- DDI 30-day (ddi-30day-*.csv).
CREATE TABLE ddi_30day (
  id                    SERIAL PRIMARY KEY,
  snapshot_date         TEXT NOT NULL,
  trustee_code          TEXT NOT NULL,
  scheme_code           TEXT NOT NULL,
  account_type          TEXT,
  request_date          TEXT,
  total_count           INT,
  submitted_to_bank_count INT,
  success_count         INT,
  rejected_count        INT,
  ingested_at           TIMESTAMPTZ DEFAULT now()
);

-- DDI aging (ddi-aging-*.csv).
CREATE TABLE ddi_aging (
  id                    SERIAL PRIMARY KEY,
  snapshot_date         TEXT NOT NULL,
  trustee_code          TEXT NOT NULL,
  scheme_code           TEXT NOT NULL,
  account_type          TEXT,
  total_count           INT,
  aging_00_06_count     INT,
  aging_07_14_count     INT,
  aging_15_21_count     INT,
  aging_22_30_count     INT,
  aging_31_more_count   INT,
  ingested_at           TIMESTAMPTZ DEFAULT now()
);

-- DDA 30-day (dda-30day-*.csv).
CREATE TABLE dda_30day (
  id                    SERIAL PRIMARY KEY,
  snapshot_date         TEXT NOT NULL,
  trustee_code          TEXT NOT NULL,
  scheme_code           TEXT NOT NULL,
  account_type          TEXT,
  total_count           INT,
  submitted_to_pig_count INT,
  submitted_to_bank_count INT,
  active_count          INT,
  inactive_count        INT,
  rejected_count        INT,
  suspend_count         INT,
  ingested_at           TIMESTAMPTZ DEFAULT now()
);

-- DDA aging (dda-aging-*.csv).
CREATE TABLE dda_aging (
  id                    SERIAL PRIMARY KEY,
  snapshot_date         TEXT NOT NULL,
  trustee_code          TEXT NOT NULL,
  scheme_code           TEXT NOT NULL,
  account_type          TEXT,
  total_count           INT,
  aging_00_06_count     INT,
  aging_07_14_count     INT,
  aging_15_21_count     INT,
  aging_22_30_count     INT,
  aging_31_more_count   INT,
  ingested_at           TIMESTAMPTZ DEFAULT now()
);

-- Code → friendly name (constant-scheme-info.xlsx).
CREATE TABLE code_names (
  kind TEXT NOT NULL,   -- 'scheme' | 'trustee'
  code TEXT NOT NULL,
  name TEXT,
  PRIMARY KEY (kind, code)
);

-- Seed audit log.
CREATE TABLE seed_history (
  snapshot_date TEXT NOT NULL,
  ingested_at   TIMESTAMPTZ DEFAULT now(),
  source_files  TEXT[] NOT NULL,
  row_counts    JSONB NOT NULL,
  PRIMARY KEY (snapshot_date, ingested_at)
);

CREATE INDEX idx_bill_snap_month ON bill_rows (snapshot_date, contribution_month);
CREATE INDEX idx_bill_scheme_tr  ON bill_rows (scheme_code, trustee_code);
CREATE INDEX idx_pym_snap_month  ON payment_rows (snapshot_date, contribution_month);
CREATE INDEX idx_ddi30_snap      ON ddi_30day (snapshot_date);
CREATE INDEX idx_dda30_snap      ON dda_30day (snapshot_date);
`

// Allow-list for the table browser / query runner so user-supplied table
// names can't wander into arbitrary SQL objects (PGlite has no pg_catalog
// restrictions; we gate manually).
export const KNOWN_TABLES = [
  'bill_rows',
  'payment_rows',
  'ao_aging',
  'ddi_30day',
  'ddi_aging',
  'dda_30day',
  'dda_aging',
  'code_names',
  'seed_history',
] as const
