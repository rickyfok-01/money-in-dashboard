#!/usr/bin/env node
// scripts/reseed.mjs — CLI entry point for re-ingesting /data CSVs into PGlite.
//
// Usage:  npm run reseed
//
// Opens the same PGlite store the server uses, truncates the fact tables, and
// re-seeds from every CSV in /data. Useful when you drop new daily CSVs in and
// don't want to go through the HTTP endpoint.
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { SCHEMA_SQL } from '../server/lib/schema.ts'
import { collectAll } from '../server/lib/seed.ts'

const dataDir = resolve(process.env.DATA_DIR || './data')
const dbDir = resolve(process.env.DB_DIR || './data/.pglite')

console.log(`[reseed] dataDir = ${dataDir}`)
console.log(`[reseed] dbDir   = ${dbDir}`)

const db = await new PGlite(dbDir)
await db.exec(SCHEMA_SQL)
await db.exec('BEGIN')
await db.exec(`
  TRUNCATE bill_rows, payment_rows, ao_aging,
           ddi_30day, ddi_aging, dda_30day, dda_aging,
           code_names, seed_history RESTART IDENTITY;
`)

const data = await collectAll(dataDir)

async function bulkInsert(table, rows, cols) {
  if (!rows.length) return
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`
  for (const row of rows) {
    await db.query(sql, cols.map(c => row[c]))
  }
  console.log(`  ${table.padEnd(14)} ${rows.length} rows`)
}

await bulkInsert('bill_rows', data.bill.rows, ['snapshot_date','trustee_code','scheme_code','status_code','contribution_mode','frequency_type','account_type','contribution_month','bill_count','ontime_submit_count','total_submit_count','submit_dde_count','submit_batch_count','submit_portal_count','submit_bulkupload_count','submit_other_count','er_submitted_amount','pending_tagging_amount'])
await bulkInsert('payment_rows', data.pym.rows, ['snapshot_date','trustee_code','scheme_code','pay_channel_code','tag_status_code','pay_method_code','contribution_month','payment_count','pay_amount','avail_amount'])
await bulkInsert('ao_aging', data.aoAging.rows, ['snapshot_date','trustee_code','scheme_code','pay_channel_code','tag_status_code','pay_method_code','total_count','aging_00_06_count','aging_07_14_count','aging_15_21_count','aging_22_30_count','aging_31_more_count'])
await bulkInsert('ddi_30day', data.ddi30.rows, ['snapshot_date','trustee_code','scheme_code','account_type','request_date','total_count','submitted_to_bank_count','success_count','rejected_count'])
await bulkInsert('ddi_aging', data.ddiAging.rows, ['snapshot_date','trustee_code','scheme_code','account_type','total_count','aging_00_06_count','aging_07_14_count','aging_15_21_count','aging_22_30_count','aging_31_more_count'])
await bulkInsert('dda_30day', data.dda30.rows, ['snapshot_date','trustee_code','scheme_code','account_type','total_count','submitted_to_pig_count','submitted_to_bank_count','active_count','inactive_count','rejected_count','suspend_count'])
await bulkInsert('dda_aging', data.ddaAging.rows, ['snapshot_date','trustee_code','scheme_code','account_type','total_count','aging_00_06_count','aging_07_14_count','aging_15_21_count','aging_22_30_count','aging_31_more_count'])
await bulkInsert('code_names', data.names.rows, ['kind','code','name'])

await db.exec('COMMIT')
console.log('[reseed] done.')
await db.close()
