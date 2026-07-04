/**
 * Cloudflare Pages Functions — API catch-all.
 *
 * Pages maps `functions/api/[[route]].ts` to every /api/* request.
 * The built Vue SPA is served by Pages from the
 * configured output directory (client/dist).
 *
 * For local development:  npx wrangler pages dev client/dist
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { apiRouter } from '../../server/router'
import { initEnv } from '../../server/services/env'

const app = new Hono()

// Seed env vars from CF bindings on every request (idempotent)
app.use('*', async (c, next) => {
  const env = c.env as { JWT_SECRET?: string }
  initEnv(env.JWT_SECRET)
  await next()
})

app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:8788'],
  credentials: true,
}))

// Mount all API routes
app.route('/api', apiRouter)

// Hono's fetch method is compatible with Pages Functions onRequest
export const onRequest = app
