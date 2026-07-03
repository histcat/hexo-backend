import type { MiddlewareHandler } from 'jsr:@hono/hono'
import { lastRateLimit } from '../services/github.ts'

/**
 * Request logger for /api/* routes.
 *
 * Logs: method, path, status, latency, and GitHub API rate limit status.
 * Token and file content are never logged.
 */
export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start

  const rateInfo =
    lastRateLimit.remaining >= 0
      ? ` | GH rate: ${lastRateLimit.remaining}/${lastRateLimit.limit}`
      : ''

  console.log(
    `${c.req.method} ${c.req.path} → ${c.res.status} (${ms}ms${rateInfo})`,
  )
}
