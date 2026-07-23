// POST /api/sql  body: { sql: string, limit?: number }
// Run an ad-hoc read-only SQL query against PGlite. Capped at maxRows (default
// 1000) to keep responses bounded. Only SELECT is allowed: the route rejects
// any statement that looks like a write — PGlite has no role-based
// permissions, so this is the only line of defense short of parsing the
// statement.
import { getDb } from '../../lib/db'
import type { QueryResult } from '../../types'

const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|VACUUM|COPY|MERGE)\b/i

export default defineEventHandler(async (event): Promise<QueryResult> => {
  const config = useRuntimeConfig()
  const db = await getDb(config.dataDir, config.dbDir)
  const body = await readBody<{ sql?: string; limit?: number }>(event)
  const sql = (body?.sql || '').trim()

  if (!sql) {
    throw createError({ statusCode: 400, statusMessage: 'Missing SQL body' })
  }
  if (FORBIDDEN.test(sql)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only SELECT queries are allowed.',
    })
  }

  const maxRows = Math.min(Math.max(1, Number(body.limit) || config.maxRows || 1000), 5000)
  const started = Date.now()
  // Wrap in a subselect to hard-cap rows regardless of the user's LIMIT.
  const wrapped = `SELECT * FROM (${sql.replace(/;+\s*$/, '')}) AS q LIMIT ${maxRows + 1}`
  const { rows } = await db.query(wrapped)

  const truncated = rows.length > maxRows
  const visible = truncated ? rows.slice(0, maxRows) : rows
  const columns = visible.length ? Object.keys(visible[0]) : []

  return {
    columns,
    rows: visible,
    rowCount: visible.length,
    truncated,
    maxRows,
    elapsedMs: Date.now() - started,
  }
})
