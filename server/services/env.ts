/**
 * Environment variable access for Vercel (Node.js) / local dev.
 *
 * Vercel injects project environment variables into process.env at
 * runtime. We also keep a module-level cache initialized once per request
 * via middleware. The JWT_SECRET is idempotent across requests, so this
 * is safe.
 */

let _jwtSecret: string | null = null

/** Call once per request from middleware to seed env values. */
export function initEnv(secret: string | undefined): void {
  if (secret) _jwtSecret = secret
}

/** Get the JWT secret.  Throws if never initialized. */
export function getJwtSecret(): string {
  const secret = _jwtSecret ?? process.env.JWT_SECRET
  if (!secret) {
    throw new Error(
      'JWT_SECRET is not configured. Set it in Vercel -> Project Settings -> Environment Variables, or in a local .env file.',
    )
  }
  return secret
}

/** True on Vercel (always HTTPS) and in production Node deployments. */
export function isProduction(): boolean {
  // Local dev has no VERCEL_ENV and runs over plain HTTP.
  return !!process.env.VERCEL_ENV || process.env.NODE_ENV === 'production'
}
