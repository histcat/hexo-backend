/**
 * Cloudflare Workers entry point.
 *
 * One Worker handles everything:
 *   /api/*   → Hono (JWT, GitHub API, file CRUD)
 *   /*       → static assets from client/dist (SPA, with index.html fallback)
 *
 * Local dev:  npm run build && npx wrangler dev
 * Deploy:     npm run deploy
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { apiRouter } from '../server/router'
import { initEnv } from '../server/services/env'

const app = new Hono()

// ── Middleware ──────────────────────────────────────────────────

// Seed env vars from CF bindings
app.use('/api/*', async (c, next) => {
  const env = c.env as { JWT_SECRET?: string }
  initEnv(env.JWT_SECRET)
  await next()
})

app.use('/api/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:8787'],
  credentials: true,
}))

// ── API routes ──────────────────────────────────────────────────

app.route('/api', apiRouter)

// ── Static assets + SPA fallback ────────────────────────────────

app.get('*', async (c) => {
  const env = c.env as { ASSETS: { fetch: (req: Request) => Promise<Response> } }
  // Try the exact path first (JS, CSS, images, etc.)
  try {
    const res = await env.ASSETS.fetch(c.req.raw)
    if (res.status < 400) return res
  } catch {
    // ASSETS binding not available — will fall through to SPA
  }
  // SPA fallback: any unknown route → index.html
  const indexReq = new Request(new URL('/index.html', c.req.url))
  return env.ASSETS.fetch(indexReq)
})

// Hono's fetch is Cloudflare Workers' default export
export default app
