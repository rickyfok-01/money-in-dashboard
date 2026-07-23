<script setup lang="ts">
// Data Explorer — table browser + ad-hoc SQL runner.
//
// Phase 1 surface: pick a table (paginated, sortable, searchable) or write
// your own SELECT in the SQL tab. All queries hit the server-side PGlite DB
// through /api/tables and /api/query.
import type { TableInfo, TablePage, QueryResult, SeedStatus } from '../server/types'

type Tab = 'browse' | 'sql' | 'status'

const tab = ref<Tab>('browse')

// ---- Status (polled across tabs) -----------------------------------------
const status = ref<SeedStatus | null>(null)
async function refreshStatus() {
  status.value = await $fetch<SeedStatus>('/api/admin/status')
}
const reseeding = ref(false)
async function reseed() {
  reseeding.value = true
  try {
    await $fetch('/api/admin/reseed', { method: 'POST' })
    await refreshStatus()
    await loadTables()
    if (tab.value === 'browse' && selectedTable.value) await loadPage(1)
  } finally {
    reseeding.value = false
  }
}

// ---- Table list ----------------------------------------------------------
const tables = ref<TableInfo[]>([])
async function loadTables() {
  tables.value = await $fetch<TableInfo[]>('/api/tables')
}
const selectedTable = ref<string>('')

// ---- Table browser state -------------------------------------------------
const page = ref(1)
const pageSize = ref(100)
const sort = ref<string>('')
const sortDir = ref<'asc' | 'desc'>('asc')
const search = ref('')
const data = ref<TablePage | null>(null)
const loading = ref(false)

async function loadPage(p = page.value) {
  if (!selectedTable.value) return
  loading.value = true
  try {
    data.value = await $fetch<TablePage>(`/api/tables/${selectedTable.value}`, {
      params: {
        page: p,
        pageSize: pageSize.value,
        sort: sort.value || undefined,
        dir: sortDir.value,
        search: search.value || undefined,
      },
    })
    page.value = p
  } finally {
    loading.value = false
  }
}

function selectTable(name: string) {
  selectedTable.value = name
  sort.value = ''
  sortDir.value = 'asc'
  search.value = ''
  page.value = 1
  loadPage(1)
}

function toggleSort(col: string) {
  if (sort.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sort.value = col
    sortDir.value = 'asc'
  }
  loadPage(1)
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadPage(1), 300)
}

// ---- SQL runner ----------------------------------------------------------
const sqlText = ref('SELECT snapshot_date, COUNT(*) AS rows\nFROM bill_rows\nGROUP BY snapshot_date\nORDER BY snapshot_date DESC\nLIMIT 100')
const sqlResult = ref<QueryResult | null>(null)
const sqlError = ref('')
const sqlLoading = ref(false)

async function runSql() {
  sqlLoading.value = true
  sqlError.value = ''
  sqlResult.value = null
  try {
    sqlResult.value = await $fetch<QueryResult>('/api/sql', {
      method: 'POST',
      body: { sql: sqlText.value },
    })
  } catch (e: any) {
    sqlError.value = e?.data?.statusMessage || e?.message || 'Query failed'
  } finally {
    sqlLoading.value = false
  }
}

// ---- Formatting ----------------------------------------------------------
function fmtCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return v.toLocaleString('en-US')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

// ---- Init ----------------------------------------------------------------
onMounted(async () => {
  await Promise.all([loadTables(), refreshStatus()])
  if (tables.value.length) selectTable(tables.value[0].name)
})
</script>

<template>
  <div class="mx-auto max-w-screen-2xl p-4">
    <!-- Header -->
    <header class="mb-4 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Money-In Dashboard · Data Explorer</h1>
        <p class="text-sm text-slate-500">
          Server-side PGlite · {{ status?.tables.reduce((s, t) => s + t.rows, 0).toLocaleString() || 0 }} rows across
          {{ status?.tables.length || 0 }} tables
        </p>
      </div>
      <div class="flex items-center gap-3">
        <span v-if="status?.seeding" class="flex items-center gap-2 text-sm text-amber-600">
          <span class="h-2 w-2 animate-pulse rounded-full bg-amber-500" /> seeding…
        </span>
        <span v-else-if="status?.ready" class="flex items-center gap-2 text-sm text-emerald-600">
          <span class="h-2 w-2 rounded-full bg-emerald-500" /> ready
        </span>
        <button
          class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          :disabled="reseeding || status?.seeding"
          @click="reseed"
        >
          {{ reseeding ? 'Reseeding…' : 'Reseed' }}
        </button>
      </div>
    </header>

    <!-- Tabs -->
    <nav class="mb-4 flex gap-1 border-b border-slate-200">
      <button
        v-for="t in (['browse','sql','status'] as Tab[])"
        :key="t"
        class="-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize"
        :class="tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'"
        @click="tab = t"
      >{{ t }}</button>
    </nav>

    <!-- Browse -->
    <section v-if="tab === 'browse'" class="grid grid-cols-[200px_1fr] gap-4">
      <!-- Table list -->
      <aside class="rounded-lg border border-slate-200 bg-white">
        <ul class="divide-y divide-slate-100">
          <li v-for="t in tables" :key="t.name">
            <button
              class="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
              :class="selectedTable === t.name ? 'bg-blue-50 text-blue-700' : ''"
              @click="selectTable(t.name)"
            >
              <span class="font-mono">{{ t.name }}</span>
              <span class="text-xs text-slate-400">{{ t.rows.toLocaleString() }}</span>
            </button>
          </li>
        </ul>
      </aside>

      <!-- Table content -->
      <div class="rounded-lg border border-slate-200 bg-white">
        <div v-if="!selectedTable" class="p-8 text-center text-sm text-slate-400">Select a table.</div>
        <template v-else>
          <!-- Toolbar -->
          <div class="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2">
            <div class="flex items-center gap-2">
              <h2 class="font-mono text-sm font-semibold">{{ selectedTable }}</h2>
              <span class="text-xs text-slate-400" v-if="data">
                {{ data.total.toLocaleString() }} rows
              </span>
            </div>
            <input
              v-model="search"
              class="w-64 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="search text columns…"
              @input="onSearchInput"
            >
          </div>

          <!-- Table -->
          <div class="overflow-x-auto">
            <table v-if="data && data.rows.length" class="w-full text-sm">
              <thead class="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th
                    v-for="col in data.columns"
                    :key="col"
                    class="cursor-pointer select-none px-3 py-2 text-left font-medium hover:text-slate-800"
                    @click="toggleSort(col)"
                  >
                    {{ col }}
                    <span v-if="sort === col" class="text-blue-600">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="(row, i) in data.rows" :key="i" class="hover:bg-slate-50">
                  <td v-for="col in data.columns" :key="col" class="px-3 py-1.5 font-mono text-xs">
                    {{ fmtCell(row[col]) }}
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else-if="!loading" class="p-8 text-center text-sm text-slate-400">No rows.</div>
          </div>

          <!-- Pagination -->
          <div v-if="data && data.totalPages > 1" class="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-sm">
            <span class="text-slate-500">
              page {{ data.page }} / {{ data.totalPages }}
            </span>
            <div class="flex gap-1">
              <button
                class="rounded border border-slate-300 px-2 py-1 disabled:opacity-30"
                :disabled="data.page <= 1"
                @click="loadPage(data.page - 1)"
              >prev</button>
              <button
                class="rounded border border-slate-300 px-2 py-1 disabled:opacity-30"
                :disabled="data.page >= data.totalPages"
                @click="loadPage(data.page + 1)"
              >next</button>
            </div>
          </div>
        </template>
      </div>
    </section>

    <!-- SQL -->
    <section v-else-if="tab === 'sql'" class="rounded-lg border border-slate-200 bg-white">
      <div class="border-b border-slate-100 p-3">
        <textarea
          v-model="sqlText"
          rows="6"
          class="w-full rounded-md border border-slate-300 p-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
          spellcheck="false"
        />
        <div class="mt-2 flex items-center gap-3">
          <button
            class="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            :disabled="sqlLoading"
            @click="runSql"
          >{{ sqlLoading ? 'Running…' : 'Run query' }}</button>
          <span v-if="sqlResult" class="text-xs text-slate-500">
            {{ sqlResult.rowCount.toLocaleString() }} rows
            <span v-if="sqlResult.truncated" class="text-amber-600"> (truncated at {{ sqlResult.maxRows }})</span>
            · {{ sqlResult.elapsedMs }} ms
          </span>
        </div>
      </div>

      <div v-if="sqlError" class="m-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{{ sqlError }}</div>

      <div class="overflow-x-auto" v-if="sqlResult && sqlResult.rows.length">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th v-for="col in sqlResult.columns" :key="col" class="px-3 py-2 text-left font-medium">{{ col }}</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="(row, i) in sqlResult.rows" :key="i" class="hover:bg-slate-50">
              <td v-for="col in sqlResult.columns" :key="col" class="px-3 py-1.5 font-mono text-xs">{{ fmtCell(row[col]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else-if="sqlResult && !sqlResult.rows.length" class="p-8 text-center text-sm text-slate-400">No rows.</div>
    </section>

    <!-- Status -->
    <section v-else class="rounded-lg border border-slate-200 bg-white">
      <div class="border-b border-slate-100 px-4 py-2"><h2 class="text-sm font-semibold">Database status</h2></div>
      <div class="p-4">
        <table class="w-full text-sm">
          <thead class="text-xs uppercase text-slate-500">
            <tr><th class="py-1 text-left">Table</th><th class="py-1 text-right">Rows</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="t in status?.tables || []" :key="t.name">
              <td class="py-1 font-mono">{{ t.name }}</td>
              <td class="py-1 text-right font-mono">{{ t.rows.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>

        <h3 class="mt-6 mb-2 text-sm font-semibold">Seed history</h3>
        <table class="w-full text-sm" v-if="status?.history?.length">
          <thead class="text-xs uppercase text-slate-500">
            <tr><th class="py-1 text-left">Snapshot</th><th class="py-1 text-left">Ingested at</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="h in status.history" :key="h.snapshot_date + h.ingested_at">
              <td class="py-1 font-mono">{{ h.snapshot_date }}</td>
              <td class="py-1 text-slate-500">{{ h.ingested_at }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="text-sm text-slate-400">No seed history yet.</p>

        <p v-if="status?.lastError" class="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{{ status.lastError }}</p>
      </div>
    </section>
  </div>
</template>
