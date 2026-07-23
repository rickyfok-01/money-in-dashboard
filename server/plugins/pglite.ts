// Nitro server plugin — boots the shared PGlite instance on server start.
//
// Init happens lazily on the first /api/* request that calls getDb(), but we
// also kick it off eagerly here so the seed runs while the server warms up
// rather than blocking the first user query.
import { getDb } from '../lib/db'

export default defineNitroPlugin((nitro) => {
  const config = useRuntimeConfig()
  // Fire-and-forget: the first /api/* call will await the same promise.
  getDb(config.dataDir, config.dbDir).catch((err) => {
    // Logged via the db state surfaced at /api/admin/status; no throw here so
    // the server still boots and can report the error.
    console.error('[pglite] boot failed:', err)
  })
  nitro.hooks.hook('request', () => {
    // Touch the promise on each request so a failed boot retries.
    const config2 = useRuntimeConfig()
    getDb(config2.dataDir, config2.dbDir).catch(() => {})
  })
})
