/**
 * Vercel serverless function entry.
 *
 * Every /api/* request is rewritten to this single function by
 * vercel.json (source "/api/(.*)" -> "/api/index"), then forwarded to
 * the shared Hono app. The function receives the original URL, so Hono
 * routing stays identical between local dev and Vercel.
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
