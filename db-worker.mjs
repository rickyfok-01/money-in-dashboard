// PGlite worker — a standalone Node process that owns the embedded Postgres
// database and speaks line-delimited JSON-RPC over stdio.
//
// Why a separate process: PGlite's Emscripten runtime resolves its .wasm via
// import.meta.url. Under Nuxt/Nitro's dev bundler that URL is rewritten to a
// bare Windows path ("C:\...") which Node's ESM loader rejects. Running
// PGlite under plain `node` (where import.meta.url is correct) side-steps the
// bundler entirely. The Nuxt server talks to this process over IPC.
//
// Protocol: each request is one JSON line on stdin:
//   { "id": 1, "method": "exec" | "query", "sql": "...", "params": [...] }
// Each response is one JSON line on stdout:
//   { "id": 1, "ok": true, "rows": [...], "fields": [...] }
//   { "id": 1, "ok": false, "error": "..." }
// A non-JSON line on stderr is forwarded as a "log" notification.
import { PGlite } from '@electric-sql/pglite'
import { SCHEMA_SQL } from './server/lib/schema.ts'
import { collectAll } from './server/lib/seed.ts'

const args = process.argv.slice(2)
const dbDir = args[0] || './data/.pglite'
const dataDir = args[1] || './data'

let db
let ready = false
let seeding = false
let lastError = null

async function boot() {
  db = await new PGlite(dbDir)
  await db.exec(SCHEMA_SQL)
  const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM bill_rows')
  if (rows[0]?.count === 0) {
    await seed()
  }
  ready = true
  send({ id: 0, method: 'ready', ok: true })
}

async function seed() {
  if (seeding) return
  seeding = true
  try {
    await db.exec('BEGIN')
    await db.exec(`
      TRUNCATE bill_rows, payment_rows, ao_aging,
               ddi_30day, ddi_aging, dda_30day, dda_aging,
               code_names, seed_history RESTART IDENTITY;
    `)
    const data = await collectAll(dataDir)
    await bulkInsert('bill_rows', data.bill.rows, BILL_COLS)
    await bulkInsert('payment_rows', data.pym.rows, PYM_COLS)
    await bulkInsert('ao_aging', data.aoAging.rows, AO_COLS)
    await bulkInsert('ddi_30day', data.ddi30.rows, DDI30_COLS)
    await bulkInsert('ddi_aging', data.ddiAging.rows, DDI_AGING_COLS)
    await bulkInsert('dda_30day', data.dda30.rows, DDA30_COLS)
    await bulkInsert('dda_aging', data.ddaAging.rows, DDA_AGING_COLS)
    await bulkInsert('code_names', data.names.rows, NAME_COLS)
    await recordHistory(data)
    await db.exec('COMMIT')
    lastError = null
  } catch (err) {
    await db.exec('ROLLBACK').catch(() => {})
    lastError = err?.message || String(err)
    throw err
  } finally {
    seeding = false
  }
}

async function bulkInsert(table, rows, cols) {
  if (!rows.length) return
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`
  for (const row of rows) {
    await db.query(sql, cols.map(c => row[c]))
  }
}

async function recordHistory(data) {
  const snaps = await db.query('SELECT DISTINCT snapshot_date FROM bill_rows ORDER BY snapshot_date')
  const allFiles = [...new Set([
    ...data.bill.files, ...data.pym.files, ...data.aoAging.files,
    ...data.ddi30.files, ...data.ddiAging.files,
    ...data.dda30.files, ...data.ddaAging.files,
  ])]
  const tables = ['bill_rows','payment_rows','ao_aging','ddi_30day','ddi_aging','dda_30day','dda_aging']
  for (const { snapshot_date } of snaps.rows) {
    const counts = {}
    for (const t of tables) {
      const { rows } = await db.query(`SELECT COUNT(*)::int AS c FROM ${t} WHERE snapshot_date = $1`, [snapshot_date])
      counts[t] = rows[0]?.c ?? 0
    }
    await db.query(
      'INSERT INTO seed_history (snapshot_date, source_files, row_counts) VALUES ($1, $2, $3)',
      [snapshot_date, allFiles, JSON.stringify(counts)],
    )
  }
}

// Column lists (must match the row object key order produced by seed.ts).
const BILL_COLS = ['snapshot_date','trustee_code','scheme_code','status_code','contribution_mode','frequency_type','account_type','contribution_month','bill_count','ontime_submit_count','total_submit_count','submit_dde_count','submit_batch_count','submit_portal_count','submit_bulkupload_count','submit_other_count','er_submitted_amount','pending_tagging_amount']
const PYM_COLS = ['snapshot_date','trustee_code','scheme_code','pay_channel_code','tag_status_code','pay_method_code','contribution_month','payment_count','pay_amount','avail_amount']
const AO_COLS = ['snapshot_date','trustee_code','scheme_code','pay_channel_code','tag_status_code','pay_method_code','total_count','aging_00_06_count','aging_07_14_count','aging_15_21_count','aging_22_30_count','aging_31_more_count']
const DDI30_COLS = ['snapshot_date','trustee_code','scheme_code','account_type','request_date','total_count','submitted_to_bank_count','success_count','rejected_count']
const DDI_AGING_COLS = ['snapshot_date','trustee_code','scheme_code','account_type','total_count','aging_00_06_count','aging_07_14_count','aging_15_21_count','aging_22_30_count','aging_31_more_count']
const DDA30_COLS = ['snapshot_date','trustee_code','scheme_code','account_type','total_count','submitted_to_pig_count','submitted_to_bank_count','active_count','inactive_count','rejected_count','suspend_count']
const DDA_AGING_COLS = ['snapshot_date','trustee_code','scheme_code','account_type','total_count','aging_00_06_count','aging_07_14_count','aging_15_21_count','aging_22_30_count','aging_31_more_count']
const NAME_COLS = ['kind','code','name']

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

async function handle(req) {
  const { id, method } = req
  try {
    if (method === 'exec') {
      await db.exec(req.sql)
      send({ id, ok: true })
    } else if (method === 'query') {
      const res = await db.query(req.sql, req.params || [])
      send({ id, ok: true, rows: res.rows, fields: res.fields || [] })
    } else if (method === 'reseed') {
      await seed()
      send({ id, ok: true })
    } else if (method === 'state') {
      send({ id, ok: true, state: { ready, seeding, lastError } })
    } else {
      send({ id, ok: false, error: `Unknown method: ${method}` })
    }
  } catch (err) {
    send({ id, ok: false, error: err?.message || String(err) })
  }
}

let buf = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  buf += chunk
  let nl
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim()
    buf = buf.slice(nl + 1)
    if (!line) continue
    try {
      handle(JSON.parse(line))
    } catch (err) {
      send({ id: null, ok: false, error: `Bad request: ${err?.message || err}` })
    }
  }
})

boot().catch((err) => {
  lastError = err?.message || String(err)
  send({ id: 0, method: 'ready', ok: false, error: lastError })
})
