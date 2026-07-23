// Nuxt config — fullstack app with an embedded PGlite (server-side Postgres).
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  ssr: true,
  nitro: {
    experimental: {
      // PGlite ships a .wasm asset that Nitro must allow through.
      wasm: true,
    },
  },
  // Expose runtime config to server routes; overrideable via env vars at boot.
  runtimeConfig: {
    dataDir: process.env.DATA_DIR || './data',
    dbDir: process.env.DB_DIR || './data/.pglite',
    pageSize: Number(process.env.PAGE_SIZE || 100),
    maxRows: Number(process.env.MAX_ROWS || 1000),
  },
  app: {
    head: {
      title: 'Money-In Dashboard',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
})
