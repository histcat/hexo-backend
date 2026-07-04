/**
 * JWT 鉴权中间件。
 *
 * 从 Cookie 中提取 JWT，验证后解密 GitHub Token，
 * 将用户信息注入 Hono Context（c.set('session', ...)）。
 *
 * 用法：
 *   apiRouter.use('/posts/*', requireAuth)
 *   apiRouter.use('/repos/*', requireAuth)
 *
 * 在 route handler 中获取会话：
 *   const session = c.get('session') as Session
 */

import type { MiddlewareHandler } from 'hono'
import { getCookie, deleteCookie } from 'hono/cookie'
import { verifyJwt, decryptToken } from '../services/jwt.ts'
import type { Session } from '../types.ts'

// ── Cookie name ──────────────────────────────────────────────────

export const AUTH_COOKIE = 'hexo_session'

// ── Middleware ────────────────────────────────────────────────────

/**
 * Hono middleware: require valid JWT for protected routes.
 * On failure returns 401 with AUTH_REQUIRED error.
 */
export const requireAuth: MiddlewareHandler = async (c, next) => {
  const token = getCookie(c, AUTH_COOKIE)

  if (!token) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: '请先登录',
        },
      },
      401,
    )
  }

  const payload = await verifyJwt(token)

  if (!payload) {
    // Clear the invalid/expired cookie
    deleteCookie(c, AUTH_COOKIE, { path: '/' })

    return c.json(
      {
        ok: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: '登录已过期，请重新登录',
        },
      },
      401,
    )
  }

  // Decrypt the GitHub token
  let githubToken: string
  try {
    githubToken = await decryptToken(payload.encryptedToken)
  } catch {
    deleteCookie(c, AUTH_COOKIE, { path: '/' })
    return c.json(
      {
        ok: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: '会话损坏，请重新登录',
        },
      },
      401,
    )
  }

  // Inject session into context
  c.set('session', {
    sub: payload.sub,
    login: payload.login,
    name: payload.name,
    avatarUrl: payload.avatarUrl,
    githubToken,
    encryptedToken: payload.encryptedToken,
    selectedRepo: payload.selectedRepo,
    repoConfig: payload.repoConfig,
  } satisfies Session)

  await next()
}

/**
 * Optional auth: attaches session if valid JWT present, but doesn't
 * reject the request if not. Useful for endpoints that work both ways.
 */
export const optionalAuth: MiddlewareHandler = async (c, next) => {
  const token = getCookie(c, AUTH_COOKIE)
  if (!token) return next()

  const payload = await verifyJwt(token)
  if (!payload) return next()

  try {
    const githubToken = await decryptToken(payload.encryptedToken)
    c.set('session', {
      sub: payload.sub,
      login: payload.login,
      name: payload.name,
      avatarUrl: payload.avatarUrl,
      githubToken,
      encryptedToken: payload.encryptedToken,
    } satisfies Session)
  } catch {
    // If decryption fails, just continue without session
  }

  await next()
}
