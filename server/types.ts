// Shared types for the server↔client API contract.

export type TableName =
  | 'bill_rows'
  | 'payment_rows'
  | 'ao_aging'
  | 'ddi_30day'
  | 'ddi_aging'
  | 'dda_30day'
  | 'dda_aging'
  | 'code_names'
  | 'seed_history'

export interface ColumnInfo {
  name: string
  dataType: string
}

export interface TableInfo {
  name: TableName | string
  rows: number
  columns: string[]
}

export interface TablePage {
  table: string
  page: number
  pageSize: number
  total: number
  totalPages: number
  columns: string[]
  rows: Record<string, unknown>[]
}

export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  truncated: boolean
  maxRows: number
  elapsedMs: number
}

export interface SeedStatus {
  ready: boolean
  seeding: boolean
  tables: { name: string; rows: number }[]
  history: SeedHistoryRow[]
  lastError: string | null
}

export interface SeedHistoryRow {
  snapshot_date: string
  ingested_at: string
  source_files: string[]
  row_counts: Record<string, number>
}
