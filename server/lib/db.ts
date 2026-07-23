// PGlite client — spawns the standalone db-worker.mjs child process and
// proxies SQL calls to it over line-delimited JSON-RPC.
//
// The worker runs under plain `node` (not bundled by Nitro), so PGlite's
// Emscripten runtime resolves its .wasm via a correct import.meta.url. This
// is the only reliable way to load PGlite server-side under Nuxt on Windows;
// Nitro's dev bundler rewrites import.meta.url into a bare path that Node's
// ESM loader rejects.
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

// A virtual "db" handle: same query/exec surface the API routes expect.
export interface DbHandle {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; fields: unknown[] }>
  exec(sql: string): Promise<void>
}

export interface DbState {
  ready: boolean
  seeding: boolean
  lastError: string | null
  seededAt: Date | null
}

let worker: ReturnType<typeof spawn> | null = null
let ready = false
let seeding = false
let lastError: string | null = null
let seededAt: Date | null = null
let nextId = 1
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
let buf = ''
let bootPromise: Promise<void> | null = null

function spawnWorker(dbDir: string): ReturnType<typeof spawn> {
  // Resolve the worker from the project root (process.cwd() in dev). The
  // worker is a standalone .mjs that imports schema.ts/seed.ts via Node's
  // native TS support — it must NOT live under server/ (Nitro would bundle it).
  const workerPath = resolve(process.cwd(), 'db-worker.mjs')
  const child = spawn(process.execPath, [workerPath, dbDir], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd(),
  })
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    buf += chunk
    let nl
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      try {
        onMessage(JSON.parse(line))
      } catch {
        // ignore malformed
      }
    }
  })
  // Capture stderr so PGlite/Emscripten aborts are visible, not swallowed.
  child.stderr.setEncoding('utf8')
  let stderrBuf = ''
  child.stderr.on('data', (chunk: string) => {
    stderrBuf += chunk
    let nl
    while ((nl = stderrBuf.indexOf('\n')) >= 0) {
      const line = stderrBuf.slice(0, nl)
      stderrBuf = stderrBuf.slice(nl + 1)
      console.error(`[db-worker] ${line}`)
    }
  })
  child.on('exit', (code) => {
    if (code !== 0) lastError = lastError || `db-worker exited with code ${code}`
    ready = false
    worker = null
    bootPromise = null
    // Reject any in-flight requests and the boot promise if still pending.
    for (const [, p] of pending) p.reject(new Error(lastError || 'db-worker exited'))
    pending.clear()
    readyReject?.(new Error(lastError || 'db-worker exited before ready'))
    readyResolve = null
    readyReject = null
  })
  return child
}

let readyResolve: (() => void) | null = null
let readyReject: ((e: Error) => void) | null = null

function onMessage(msg: any) {
  // Boot notification from the worker.
  if (msg.method === 'ready') {
    if (msg.ok) {
      ready = true
      seededAt = new Date()
      readyResolve?.()
    } else {
      lastError = msg.error || 'db-worker boot failed'
      readyReject?.(new Error(lastError))
    }
    readyResolve = null
    readyReject = null
    return
  }
  const p = pending.get(msg.id)
  if (!p) return
  pending.delete(msg.id)
  if (msg.ok) p.resolve(msg)
  else p.reject(new Error(msg.error || 'query failed'))
}

function send(req: Record<string, unknown>): Promise<any> {
  if (!worker) return Promise.reject(new Error(lastError || 'db-worker not running'))
  return new Promise((resolveP, rejectP) => {
    const id = nextId++
    pending.set(id, { resolve: resolveP, reject: rejectP })
    worker!.stdin.write(JSON.stringify({ id, ...req }) + '\n')
  })
}

async function ensureBooted(dbDir: string): Promise<void> {
  if (ready) return
  if (!bootPromise) {
    bootPromise = new Promise<void>((resolveBoot, rejectBoot) => {
      readyResolve = resolveBoot
      readyReject = rejectBoot
      worker = spawnWorker(dbDir)
    })
  }
  await bootPromise
}

export function getDbState(): DbState {
  return { ready, seeding, lastError, seededAt }
}

/** Get a virtual db handle bound to the worker. Boots on first call. */
export async function getDb(_dataDir: string, dbDir: string): Promise<DbHandle> {
  await ensureBooted(dbDir)
  return {
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const res = await send({ method: 'query', sql, params })
      return { rows: res.rows as T[], fields: res.fields }
    },
    async exec(sql: string) {
      await send({ method: 'exec', sql })
    },
  }
}

/** Trigger a full reseed in the worker. */
export async function reseedDatabase(_dataDir: string, dbDir: string): Promise<void> {
  await ensureBooted(dbDir)
  if (seeding) throw new Error('Seed already in progress')
  seeding = true
  try {
    await send({ method: 'reseed' })
    seededAt = new Date()
    lastError = null
  } finally {
    seeding = false
  }
}
