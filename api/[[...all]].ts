/**
 * Vercel serverless function entry (optional catch-all).
 *
 * Every /api/* request is forwarded to the shared Hono app, so the API
 * code is identical between local dev and Vercel. Static files
 * (client/dist) and the SPA fallback are handled by Vercel (vercel.json).
 */
import { handle } from 'hono/vercel'
import { app } from '../server/app.ts'

// Node.js runtime (process.env, Web Crypto, fetch)
export const runtime = 'nodejs'

export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const PATCH = handle(app)
export const DELETE = handle(app)
export const OPTIONS = handle(app)
export const HEAD = handle(app)
