// GET /api/admin/status — DB readiness, seed state, per-table row counts,
// and the seed history log. Drives the status panel in the UI.
import { getDb, getDbState } from '../../lib/db'
import { KNOWN_TABLES } from '../../lib/schema'
import type { SeedStatus } from '../../types'

export default defineEventHandler(async (event): Promise<SeedStatus> => {
  const config = useRuntimeConfig()
  const state = getDbState()
  const tables: { name: string; rows: number }[] = []
  let history: SeedStatus['history'] = []

  try {
    const db = await getDb(config.dataDir, config.dbDir)
    for (const name of KNOWN_TABLES) {
      const { rows } = await db.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM ${name}`)
      tables.push({ name, rows: rows[0]?.c ?? 0 })
    }
    const hist = await db.query(
      'SELECT snapshot_date, ingested_at, source_files, row_counts FROM seed_history ORDER BY snapshot_date DESC, ingested_at DESC LIMIT 50',
    )
    history = hist.rows as SeedStatus['history']
  } catch {
    // DB not ready yet — return empty tables + history; UI shows "seeding".
  }

  return {
    ready: state.ready,
    seeding: state.seeding,
    tables,
    history,
    lastError: state.lastError,
  }
})
