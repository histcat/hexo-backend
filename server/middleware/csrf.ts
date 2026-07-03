/**
 * CSRF 防护中间件。
 *
 * 采用 Double Submit Cookie 模式：
 *   1. GET /api/config 生成随机 token，同时设置 Cookie 和返回 body
 *   2. 前端读取 cookie 或 body，在后续非 GET 请求中携带 X-CSRF-Token Header
 *   3. csrfGuard 中间件校验 Header 与 Cookie 的值一致
 *
 * Cookie 为非 HttpOnly（允许 JS 读取），SameSite=Lax。
 */

import type { MiddlewareHandler } from 'jsr:@hono/hono'
import { getCookie, setCookie } from 'jsr:@hono/hono/cookie'

// ── Constants ────────────────────────────────────────────────────

export const CSRF_COOKIE = 'hexo_csrf'
const CSRF_HEADER = 'X-CSRF-Token'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// ── Token Generation ─────────────────────────────────────────────

/**
 * Generate a cryptographically random CSRF token (base64url, 256 bits).
 */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Set the CSRF cookie on the response and return the token value.
 * Call this in the /api/config handler.
 */
export function setCsrfCookie(c: Parameters<MiddlewareHandler>[0]): string {
  // Use the Hono context directly
  const token = generateCsrfToken()
  // We need to return the token so the handler can include it in the response body.
  // The cookie will be set when the response is sent.
  return token
}

/**
 * Helper: set the CSRF cookie on a context. Call this from route handlers.
 * We use this pattern because Hono's setCookie needs the raw context.
 */
function isSecureEnv(): boolean {
  return Deno.env.get('DENO_ENV') === 'production'
}

export function applyCsrfCookie(c: Parameters<MiddlewareHandler>[0]): string {
  const token = generateCsrfToken()
  setCookie(c, CSRF_COOKIE, token, {
    path: '/',
    secure: isSecureEnv(),
    sameSite: isSecureEnv() ? 'Lax' : 'Lax',
    httpOnly: false, // Frontend needs to read it for the header
    maxAge: 86400,   // 24 hours
  })
  return token
}

/**
 * Middleware: validate CSRF token on mutation requests.
 * Compares X-CSRF-Token header against the CSRF cookie.
 */
export const csrfGuard: MiddlewareHandler = async (c, next) => {
  // Skip CSRF check for safe methods
  if (SAFE_METHODS.has(c.req.method)) {
    return next()
  }

  const cookieToken = getCookie(c, CSRF_COOKIE)
  const headerToken = c.req.header(CSRF_HEADER)

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'CSRF_INVALID',
          message: 'CSRF 校验失败，请刷新页面后重试',
        },
      },
      403,
    )
  }

  await next()
}
