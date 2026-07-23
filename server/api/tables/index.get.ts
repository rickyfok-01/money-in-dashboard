// GET /api/tables — list all known tables with row counts + columns.
import { KNOWN_TABLES } from '../../lib/schema'
import { getDb } from '../../lib/db'
import type { TableInfo } from '../../types'

export default defineEventHandler(async (event): Promise<TableInfo[]> => {
  const config = useRuntimeConfig()
  const db = await getDb(config.dataDir, config.dbDir)
  const out: TableInfo[] = []
  for (const name of KNOWN_TABLES) {
    const { rows: countRows } = await db.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM ${name}`,
    )
    const { rows: colRows } = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = $1 AND table_schema = 'public'
       ORDER BY ordinal_position`,
      [name],
    )
    out.push({
      name,
      rows: countRows[0]?.c ?? 0,
      columns: colRows.map(r => r.column_name),
    })
  }
  return out
})
