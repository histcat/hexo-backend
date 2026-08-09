/**
 * Local development server.
 *
 * Serves only the Hono API on http://localhost:8000 - the port the Vite
 * dev server (client/) proxies /api requests to.
 *
 * Run: npm run dev:api  (tsx watch server/dev.ts)
 */
import 'dotenv/config'
import { serve } from '@hono/node-server'
import { app } from './app.ts'

const port = Number(process.env.PORT || 8000)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API server listening on http://localhost:${info.port}`)
})
