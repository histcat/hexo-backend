/**
 * Shared Hono application (API only).
 *
 * Used by:
 *   - Vercel serverless function: api/[[...all]].ts
 *   - Local dev server:           server/dev.ts
 *
 * Static files (client/dist) and the SPA fallback are handled by the host:
 *   - Vercel: vercel.json rewrites
 *   - Local:  Vite dev server (client/, port 5173, proxies /api to :8000)
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { webcrypto } from 'node:crypto'
import { apiRouter } from './router.js'
import { initEnv } from './services/env.js'

// Node < 19 (e.g. Node 18 runtimes) does not expose globalThis.crypto,
// but the CSRF / JWT services rely on Web Crypto. Provide it when missing.
if (!globalThis.crypto) {
  ;(globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as Crypto
}

export function createApp(): Hono {
  const app = new Hono()

  // Seed env vars from process.env (Vercel project settings / local .env)
  app.use('/api/*', async (_c, next) => {
    initEnv(typeof process !== 'undefined' ? process.env.JWT_SECRET : undefined)
    await next()
  })

  // CORS only matters for cross-origin local dev (Vite :5173 -> API :8000).
  // In production the frontend and API are served from the same origin.
  app.use(
    '/api/*',
    cors({
      origin: ['http://localhost:5173', 'http://localhost:8000', 'http://localhost:3000'],
      credentials: true,
    }),
  )

  app.route('/api', apiRouter)

  return app
}

export const app = createApp()
