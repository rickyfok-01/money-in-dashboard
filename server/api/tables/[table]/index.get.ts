// GET /api/tables/:table?sort=&dir=&search=&page=1&pageSize=100
// Browse one table, paginated (default/max 100 per page). Sort and substring
// search are optional. The table name is validated against KNOWN_TABLES.
import { KNOWN_TABLES } from '../../../lib/schema'
import { getDb } from '../../../lib/db'
import type { TablePage } from '../../../types'

const DEFAULT_PAGE_SIZE = 100

export default defineEventHandler(async (event): Promise<TablePage> => {
  const config = useRuntimeConfig()
  const db = await getDb(config.dataDir, config.dbDir)
  const table = getRouterParam(event, 'table') || ''

  if (!KNOWN_TABLES.includes(table as never)) {
    throw createError({ statusCode: 400, statusMessage: `Unknown table: ${table}` })
  }

  const q = getQuery(event)
  const page = Math.max(1, Number(q.page) || 1)
  const pageSize = Math.min(
    Math.max(1, Number(q.pageSize) || DEFAULT_PAGE_SIZE),
    config.pageSize || DEFAULT_PAGE_SIZE,
  )

  // Optional sort — column name validated against the table's actual columns
  // to avoid injecting arbitrary identifiers.
  const { rows: colRows } = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = $1 AND table_schema = 'public'`,
    [table],
  )
  const validCols = new Set(colRows.map(r => r.column_name))

  let orderBy = '1'
  const sort = typeof q.sort === 'string' ? q.sort : ''
  if (sort && validCols.has(sort)) {
    const dir = String(q.dir || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC'
    orderBy = `"${sort}" ${dir}`
  }

  // Optional substring search across any text column — simple but safe.
  let whereClause = ''
  const params: unknown[] = []
  const search = typeof q.search === 'string' ? q.search.trim() : ''
  if (search) {
    const textCols = (await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = $1 AND table_schema = 'public'
         AND data_type IN ('text', 'character varying')`,
      [table],
    )).rows.map(r => r.column_name)
    if (textCols.length) {
      const clauses = textCols.map(c => `"${c}"::text ILIKE $1`)
      whereClause = `WHERE ${clauses.join(' OR ')}`
      params.push(`%${search}%`)
    }
  }

  const { rows: countRows } = await db.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM ${table} ${whereClause}`,
    params,
  )
  const total = countRows[0]?.c ?? 0

  params.push(pageSize, (page - 1) * pageSize)
  const { rows } = await db.query(
    `SELECT * FROM ${table} ${whereClause} ORDER BY ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  )

  return {
    table,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    columns: rows.length ? Object.keys(rows[0]) : colRows.map(r => r.column_name),
    rows,
  }
})
