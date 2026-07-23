// CSV → PGlite seed pipeline. Server-side port of the archived
// scripts/build_data.py, using descriptive column names.
//
// Reads every /data/<family>-*.csv, coerces numerics (the 20260708-style
// exports ship floats like "9.0"; normalize to int), drops blank rows, and
// backfills snapshot_date from the filename when the CSV column is missing.
// Computed columns (er_submitted_amount / pending_tagging_amount) are derived
// from A_STATUSES / B_STATUSES exactly as build_data.py does.
import { parse } from 'csv-parse/sync'
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx'
import { A_STATUSES, B_STATUSES } from './schema.ts'

const UNSET = '(unset)'

// ---- Low-level helpers ----------------------------------------------------

/** Glob -> sorted list of forward-slash paths. Works on Windows. */
async function globSorted(pattern: string): Promise<string[]> {
  const { glob } = await import('node:fs/promises')
  const files: string[] = []
  for await (const f of glob(pattern)) files.push(f.replace(/\\/g, '/'))
  return files.sort()
}

/** Pull YYYYMMDD out of a path like ".../con-bill-6mon-20260722.csv". */
function snapFromDateName(path: string): string {
  const m = path.match(/(\d{8})\.csv$/)
  return m ? m[1] : ''
}

/** Coerce '9.0' / '9' / '' -> 9 / 9 / 0 (mirrors build_data.py to_int). */
function toInt(v: unknown): number {
  if (v == null) return 0
  const str = String(v).trim()
  if (str === '') return 0
  const n = Number(str)
  return Number.isFinite(n) ? Math.round(n) : 0
}

/** Coerce '72900929.46' / '' -> 72900929.46 / 0 (mirrors to_float). */
function toFloat(v: unknown): number {
  if (v == null) return 0
  const str = String(v).trim()
  if (str === '') return 0
  const n = Number(str)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

/** Trim to a string ('' for null/undefined). */
function txt(v: unknown): string {
  return v == null ? '' : String(v).trim()
}

/** A CSV row is "blank" when it has neither trustee nor scheme code —
 *  an artifact of source exports (blank lines / wrong-header parses). */
function isBlank(r: Record<string, string>): boolean {
  return txt(r.TR_CODE) === '' && txt(r.SCHEME_CODE) === ''
}

/** Resolve authoritative snapshot: CSV column wins, else filename; must be 8 digits. */
function resolveSnap(r: Record<string, string>, fallback: string): string {
  const v = txt(r.SNAPSHOT_DATE)
  return /^\d{8}$/.test(v) ? v : fallback
}

async function readFileText(path: string): Promise<string> {
  const fs = await import('node:fs/promises')
  const buf = await fs.readFile(path)
  let str = buf.toString('utf-8')
  if (str.charCodeAt(0) === 0xfeff) str = str.slice(1) // strip BOM
  return str
}

/** Parse one CSV file to rows. csv-parse handles BOM and ragged lines. */
function parseCsv(text: string): Record<string, string>[] {
  return parse(text, {
    columns: true,
    trim: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[]
}

/** Iterate rows of all files matching `pattern`, yielding { row, snap, path }. */
async function readRows(
  pattern: string,
  cb: (r: Record<string, string>, snap: string, path: string) => void,
): Promise<string[]> {
  const files = await globSorted(pattern)
  for (const path of files) {
    const fb = snapFromDateName(path)
    const parsed = parseCsv(await readFileText(path))
    for (const r of parsed) {
      if (isBlank(r)) continue
      const snap = resolveSnap(r, fb)
      if (!/^\d{8}$/.test(snap)) continue
      cb(r, snap, path)
    }
  }
  return files
}

// ---- Row types ------------------------------------------------------------

export interface BillRow {
  snapshot_date: string
  trustee_code: string
  scheme_code: string
  status_code: string
  contribution_mode: string
  frequency_type: string
  account_type: string
  contribution_month: string
  bill_count: number
  ontime_submit_count: number
  total_submit_count: number
  submit_dde_count: number
  submit_batch_count: number
  submit_portal_count: number
  submit_bulkupload_count: number
  submit_other_count: number
  er_submitted_amount: number
  pending_tagging_amount: number
}

export interface PymRow {
  snapshot_date: string
  trustee_code: string
  scheme_code: string
  pay_channel_code: string
  tag_status_code: string
  pay_method_code: string
  contribution_month: string
  payment_count: number
  pay_amount: number
  avail_amount: number
}

export interface AgingRow {
  snapshot_date: string
  trustee_code: string
  scheme_code: string
  account_type?: string
  pay_channel_code?: string
  tag_status_code?: string
  pay_method_code?: string
  total_count: number
  aging_00_06_count: number
  aging_07_14_count: number
  aging_15_21_count: number
  aging_22_30_count: number
  aging_31_more_count: number
}

export interface DDI30Row {
  snapshot_date: string
  trustee_code: string
  scheme_code: string
  account_type: string
  request_date: string
  total_count: number
  submitted_to_bank_count: number
  success_count: number
  rejected_count: number
}

export interface DDA30Row {
  snapshot_date: string
  trustee_code: string
  scheme_code: string
  account_type: string
  total_count: number
  submitted_to_pig_count: number
  submitted_to_bank_count: number
  active_count: number
  inactive_count: number
  rejected_count: number
  suspend_count: number
}

export interface CodeNameRow {
  kind: string
  code: string
  name: string
}

// ---- Per-family readers ---------------------------------------------------

export async function readBillRows(dataDir: string): Promise<{ rows: BillRow[]; files: string[] }> {
  const rows: BillRow[] = []
  const files = await readRows(`${dataDir}/con-bill-6mon-*.csv`, (r, snap) => {
    const status = txt(r.AV_STATUS_CODE)
    const bill = toInt(r.BILL_COUNT)
    rows.push({
      snapshot_date: snap,
      trustee_code: txt(r.TR_CODE),
      scheme_code: txt(r.SCHEME_CODE),
      status_code: status,
      contribution_mode: txt(r.AV_BILL_CONTR_MODE),
      frequency_type: txt(r.AV_FREQ_TYPE) || UNSET,
      account_type: txt(r.SHORT_CODE),
      contribution_month: txt(r.YEAR_MONTH),
      bill_count: bill,
      ontime_submit_count: toInt(r.ONTIME_SUBMIT_COUNT),
      total_submit_count: toInt(r.TOTAL_SUBMIT_COUNT),
      submit_dde_count: toInt(r.DDE_SUBMIT_COUNT),
      submit_batch_count: toInt(r.BATCH_SUBMIT_COUNT),
      submit_portal_count: toInt(r.PORTAL_SUBMIT_COUNT),
      submit_bulkupload_count: toInt(r.BULKUPLOAD_SUBMIT_COUNT),
      submit_other_count: toInt(r.OTHER_SUBMIT_COUNT),
      er_submitted_amount: A_STATUSES.has(status) ? bill : 0,
      pending_tagging_amount: B_STATUSES.has(status) ? bill : 0,
    })
  })
  return { rows, files }
}

export async function readPaymentRows(dataDir: string): Promise<{ rows: PymRow[]; files: string[] }> {
  const rows: PymRow[] = []
  const files = await readRows(`${dataDir}/con-pym-6mon-*.csv`, (r, snap) => {
    rows.push({
      snapshot_date: snap,
      trustee_code: txt(r.TR_CODE),
      scheme_code: txt(r.SCHEME_CODE),
      pay_channel_code: txt(r.AV_PAY_CHANNEL_CODE),
      tag_status_code: txt(r.AV_TAG_STATUS_CODE),
      pay_method_code: txt(r.PAY_METHOD_CODE),
      contribution_month: txt(r.MONTH),
      payment_count: toInt(r.PAYMENT_COUNT),
      pay_amount: toFloat(r.PAY_AMT),
      avail_amount: toFloat(r.AVAIL_AMOUNT),
    })
  })
  return { rows, files }
}

export async function readAoAging(dataDir: string): Promise<{ rows: AgingRow[]; files: string[] }> {
  const rows: AgingRow[] = []
  const files = await readRows(`${dataDir}/con-pym-ao-aging-*.csv`, (r, snap) => {
    rows.push({
      snapshot_date: snap,
      trustee_code: txt(r.TR_CODE),
      scheme_code: txt(r.SCHEME_CODE),
      pay_channel_code: txt(r.AV_PAY_CHANNEL_CODE),
      tag_status_code: txt(r.AV_TAG_STATUS_CODE),
      pay_method_code: txt(r.PAY_METHOD_CODE),
      total_count: toInt(r.TOTAL),
      aging_00_06_count: toInt(r.DAY_00_06),
      aging_07_14_count: toInt(r.DAY_07_14),
      aging_15_21_count: toInt(r.DAY_15_21),
      aging_22_30_count: toInt(r.DAY_22_30),
      aging_31_more_count: toInt(r.DAY_31_MORE),
    })
  })
  return { rows, files }
}

export async function readDDI30(dataDir: string): Promise<{ rows: DDI30Row[]; files: string[] }> {
  const rows: DDI30Row[] = []
  const files = await readRows(`${dataDir}/ddi-30day-*.csv`, (r, snap) => {
    rows.push({
      snapshot_date: snap,
      trustee_code: txt(r.TR_CODE),
      scheme_code: txt(r.SCHEME_CODE),
      account_type: txt(r.SHORT_CODE),
      request_date: txt(r.DDI_REQUEST_DATE),
      total_count: toInt(r.COUNT),
      submitted_to_bank_count: toInt(r.SUBMITTED_TO_BANK),
      success_count: toInt(r.SUCCESS),
      rejected_count: toInt(r.REJECTED),
    })
  })
  return { rows, files }
}

export async function readDDIAging(dataDir: string): Promise<{ rows: AgingRow[]; files: string[] }> {
  const rows: AgingRow[] = []
  const files = await readRows(`${dataDir}/ddi-aging-*.csv`, (r, snap) => {
    rows.push({
      snapshot_date: snap,
      trustee_code: txt(r.TR_CODE),
      scheme_code: txt(r.SCHEME_CODE),
      account_type: txt(r.SHORT_CODE),
      total_count: toInt(r.TOTAL),
      aging_00_06_count: toInt(r.DAY_00_06),
      aging_07_14_count: toInt(r.DAY_07_14),
      aging_15_21_count: toInt(r.DAY_15_21),
      aging_22_30_count: toInt(r.DAY_22_30),
      aging_31_more_count: toInt(r.DAY_31_MORE),
    })
  })
  return { rows, files }
}

export async function readDDA30(dataDir: string): Promise<{ rows: DDA30Row[]; files: string[] }> {
  const rows: DDA30Row[] = []
  const files = await readRows(`${dataDir}/dda-30day-*.csv`, (r, snap) => {
    rows.push({
      snapshot_date: snap,
      trustee_code: txt(r.TR_CODE),
      scheme_code: txt(r.SCHEME_CODE),
      account_type: txt(r.SHORT_CODE),
      total_count: toInt(r.TOTAL),
      submitted_to_pig_count: toInt(r.SUBMITTED_TO_PIG),
      submitted_to_bank_count: toInt(r.SUBMITTED_TO_BANK),
      active_count: toInt(r.ACTIVE),
      inactive_count: toInt(r.INACTIVE),
      rejected_count: toInt(r.REJECTED),
      suspend_count: toInt(r.SUSPEND),
    })
  })
  return { rows, files }
}

export async function readDDAAging(dataDir: string): Promise<{ rows: AgingRow[]; files: string[] }> {
  const rows: AgingRow[] = []
  const files = await readRows(`${dataDir}/dda-aging-*.csv`, (r, snap) => {
    rows.push({
      snapshot_date: snap,
      trustee_code: txt(r.TR_CODE),
      scheme_code: txt(r.SCHEME_CODE),
      account_type: txt(r.SHORT_CODE),
      total_count: toInt(r.TOTAL),
      aging_00_06_count: toInt(r.DAY_00_06),
      aging_07_14_count: toInt(r.DAY_07_14),
      aging_15_21_count: toInt(r.DAY_15_21),
      aging_22_30_count: toInt(r.DAY_22_30),
      aging_31_more_count: toInt(r.DAY_31_MORE),
    })
  })
  return { rows, files }
}

// Code → friendly name (constant-scheme-info.xlsx).
export async function readCodeNames(dataDir: string): Promise<{ rows: CodeNameRow[]; file: string }> {
  const path = `${dataDir}/constant-scheme-info.xlsx`
  const out: CodeNameRow[] = []
  try {
    const wb = xlsxRead(path)
    const sheetName = wb.SheetNames.includes('Export Worksheet') ? 'Export Worksheet' : wb.SheetNames[0]
    const sheet = wb.Sheets[sheetName]
    const json = xlsxUtils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    for (const r of json) {
      // Headers vary across exports; resolve by regex on header keys.
      const keys = Object.keys(r)
      const trKey = keys.find(k => /^TR_CODE$/i.test(k)) || ''
      const trNameKey = keys.find(k => /^TR_NAME$/i.test(k)) || ''
      const scKey = keys.find(k => /^SCHEME_CODE$/i.test(k)) || ''
      const scNameKey = keys.find(k => /^SCHEME_NAME$/i.test(k)) || ''
      const tr = txt(r[trKey])
      const trName = txt(r[trNameKey])
      const sc = txt(r[scKey])
      const scName = txt(r[scNameKey])
      if (tr && trName) out.push({ kind: 'trustee', code: tr, name: trName })
      if (sc && scName) out.push({ kind: 'scheme', code: sc, name: scName })
    }
  } catch {
    // Workbook missing/unreadable — degrade to raw codes (as build_data.py does).
  }
  return { rows: out, file: path }
}

// ---- Orchestrator ---------------------------------------------------------

export interface CollectedData {
  bill: { rows: BillRow[]; files: string[] }
  pym: { rows: PymRow[]; files: string[] }
  aoAging: { rows: AgingRow[]; files: string[] }
  ddi30: { rows: DDI30Row[]; files: string[] }
  ddiAging: { rows: AgingRow[]; files: string[] }
  dda30: { rows: DDA30Row[]; files: string[] }
  ddaAging: { rows: AgingRow[]; files: string[] }
  names: { rows: CodeNameRow[]; file: string }
}

export async function collectAll(dataDir: string): Promise<CollectedData> {
  const [bill, pym, aoAging, ddi30, ddiAging, dda30, ddaAging, names] = await Promise.all([
    readBillRows(dataDir),
    readPaymentRows(dataDir),
    readAoAging(dataDir),
    readDDI30(dataDir),
    readDDIAging(dataDir),
    readDDA30(dataDir),
    readDDAAging(dataDir),
    readCodeNames(dataDir),
  ])
  return { bill, pym, aoAging, ddi30, ddiAging, dda30, ddaAging, names }
}
