/**
 * Vercel serverless function entry (optional catch-all).
 *
 * Every /api/* request is forwarded to the shared Hono app, so the API
 * code is identical between local dev and Vercel. Static files
 * (client/dist) and the SPA fallback are handled by Vercel (vercel.json).
 *
 * Plain Vercel Functions (files under api/) are invoked via their default
 * export. The handler receives the raw Web Request and returns a Response.
 */
import { handle } from 'hono/vercel'
import { app } from '../server/app.ts'

export default handle(app)
