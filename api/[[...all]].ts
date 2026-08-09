/**
 * Vercel serverless function entry (optional catch-all).
 *
 * Every /api/* request is forwarded to the shared Hono app, so the API
 * code is identical between local dev and Vercel. Static files
 * (client/dist) and the SPA fallback are handled by Vercel (vercel.json).
 *
 * Plain Vercel Functions use the "fetch Web Standard export": a default
 * export object with a fetch(request) method that receives a standard
 * Request and returns a Response. (A bare default function is treated as
 * a Node (req, res) handler by Vercel, which would hang / time out.)
 */
import { app } from '../server/app.js'

export default {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request)
  },
}
