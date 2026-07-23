// POST /api/admin/reseed — re-ingest all CSVs from /data into the DB.
// Returns the new table row counts once complete.
import { reseedDatabase, getDbState } from '../../lib/db'
import { KNOWN_TABLES } from '../../lib/schema'
import { getDb } from '../../lib/db'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const state = getDbState()
  if (state.seeding) {
    return { ok: false, message: 'Seed already in progress', state }
  }
  await reseedDatabase(config.dataDir, config.dbDir)
  const db = await getDb(config.dataDir, config.dbDir)
  const counts: { name: string; rows: number }[] = []
  for (const name of KNOWN_TABLES) {
    const { rows } = await db.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM ${name}`)
    counts.push({ name, rows: rows[0]?.c ?? 0 })
  }
  return { ok: true, tables: counts, state: getDbState() }
})
