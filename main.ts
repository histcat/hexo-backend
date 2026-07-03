import { Hono } from 'jsr:@hono/hono'
import { logger } from 'jsr:@hono/hono/logger'
import { cors } from 'jsr:@hono/hono/cors'
import { apiRouter } from './server/router.ts'

const app = new Hono()

// Global middleware
app.use('*', logger())
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:8000'],
  credentials: true,
}))

// API routes under /api
app.route('/api', apiRouter)

// Production: serve built Vue SPA
// In development, Vite dev server on :5173 proxies /api to :8000
const isProd = Deno.env.get('DENO_ENV') === 'production'

if (isProd) {
  app.get('/*', async (c) => {
    const path = c.req.path
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.mjs': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff2': 'font/woff2',
    }
    const ext = '.' + (path.split('.').pop() || '')
    const contentType = mimeTypes[ext] || 'application/octet-stream'

    try {
      const file = await Deno.readFile(`./client/dist${path}`)
      return new Response(file, { headers: { 'Content-Type': contentType } })
    } catch {
      // SPA fallback
      try {
        const indexHtml = await Deno.readTextFile('./client/dist/index.html')
        return new Response(indexHtml, { headers: { 'Content-Type': 'text/html' } })
      } catch {
        return new Response('Not Found', { status: 404 })
      }
    }
  })
}

Deno.serve({ port: 8000, reuseAddr: true }, app.fetch)
