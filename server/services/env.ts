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
  const secret =
    _jwtSecret ??
    (typeof process !== 'undefined' ? process.env.JWT_SECRET : undefined)
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
  return (
    (typeof process !== 'undefined' && process.env.VERCEL_ENV === 'production') ||
    (typeof process !== 'undefined' && process.env.NODE_ENV === 'production')
  )
}

/**
 * 媒体文件对外 URL 的 CDN 前缀（jsDelivr 风格，`/gh/{owner}/{repo}@{branch}/{path}`）。
 * 默认使用 js.histcat.top（反向代理 cdn.jsdelivr.net），可通过环境变量 MEDIA_CDN_BASE 覆盖。
 */
export function getMediaCdnBase(): string {
  return (
    (typeof process !== 'undefined' && process.env.MEDIA_CDN_BASE) ||
    'https://js.histcat.top/gh'
  )
}
