/**
 * Environment variable access for Cloudflare Workers / Pages Functions.
 *
 * In the Workers runtime, secrets from wrangler.toml / dashboard are
 * exposed via `c.env` (the Hono Context).  Because `c.env` is only
 * available during a request, we initialize the module-level cache
 * once per request via middleware.  The JWT_SECRET is idempotent across
 * requests so this is safe.
 */

let _jwtSecret: string | null = null

/** Call once per request from middleware to seed env values. */
export function initEnv(secret: string | undefined): void {
  if (secret) _jwtSecret = secret
}

/** Get the JWT secret.  Throws if never initialized. */
export function getJwtSecret(): string {
  if (!_jwtSecret) {
    throw new Error('JWT_SECRET is not configured. Set it in wrangler.toml [vars] or via `wrangler secret put JWT_SECRET`.')
  }
  return _jwtSecret
}

/** Always true in deployed CF Workers context (local dev may use `wrangler dev`). */
export function isProduction(): boolean {
  // wrangler dev sets CF_PAGES (or we check hostname)
  // In production CF always provides HTTPS
  return true
}
