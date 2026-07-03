import { Hono } from 'jsr:@hono/hono'
import { setCookie, deleteCookie } from 'jsr:@hono/hono/cookie'
import { requestLogger } from './middleware/logger.ts'
import { requireAuth, AUTH_COOKIE } from './middleware/auth.ts'
import { applyCsrfCookie, csrfGuard } from './middleware/csrf.ts'
import { signJwt, encryptToken } from './services/jwt.ts'
import {
  fetchGitHubUser,
  listUserRepos,
  fetchRepoInfo,
  fetchRepoTree,
  fetchFileContent,
  createOrUpdateFile,
  deleteFile,
  GitHubError,
  checkRateLimit,
  lastRateLimit,
  type GitHubRepo,
  type GitHubTreeEntry,
} from './services/github.ts'
import { load } from 'js-yaml'
import { fetchRepoConfig } from './services/config-scanner.ts'
import { cache } from './services/cache.ts'
import {
  parseFrontmatter,
  serializePost,
  extractTitle,
  extractTags,
  extractCategory,
  extractPublished,
} from './services/frontmatter.ts'
import type { ApiResponse, UserInfo, RepoRef, RepoConfig, PostSummary, ConfigFileSummary, Session } from './types.ts'

/**
 * Extract the file path from a wildcard route's URL.
 *
 * Hono's `c.req.param('*')` can be unreliable for deeply nested paths
 * when routes are mounted via `app.route()`. This helper reads the path
 * directly from `c.req.path`, which is always correct.
 *
 * @param c - Hono context (from inside the sub-router)
 * @param routePrefix - e.g. '/posts/' or '/config-files/'
 */
function getWildcardPath(c: import('jsr:@hono/hono').Context, routePrefix: string): string {
  return decodeURIComponent(c.req.path.slice(routePrefix.length))
}

/** Map a GitHubError to a typed HTTP status code */
function errorStatus(e: GitHubError): 400 | 401 | 403 | 404 | 409 | 422 | 500 | 502 {
  if (e.status) {
    const s = e.status
    if (s === 400 || s === 401 || s === 403 || s === 404 || s === 409 || s === 422 || s === 500 || s === 502) {
      return s
    }
  }
  return 502
}

export const apiRouter = new Hono()

// ── Global middleware ───────────────────────────────────────────

apiRouter.use('*', requestLogger)
apiRouter.use('*', csrfGuard) // All mutation requests require CSRF

// ── Public endpoints ────────────────────────────────────────────

apiRouter.get('/health', (c) => {
  const rateWarning = checkRateLimit()

  return c.json({
    ok: true,
    data: {
      status: 'ok',
      runtime: 'deno',
      timestamp: new Date().toISOString(),
      githubRateLimit: lastRateLimit.remaining >= 0
        ? {
            remaining: lastRateLimit.remaining,
            limit: lastRateLimit.limit,
            reset: lastRateLimit.reset > 0
              ? new Date(lastRateLimit.reset * 1000).toISOString()
              : null,
          }
        : null,
      warning: rateWarning,
    },
  } satisfies ApiResponse)
})

/**
 * GET /api/config
 * Public configuration + CSRF token bootstrap.
 */
apiRouter.get('/config', (c) => {
  const csrfToken = applyCsrfCookie(c)

  return c.json({
    ok: true,
    data: {
      csrfToken,
      features: {
        multiRepo: true,
        configFiles: true,
      },
    },
  } satisfies ApiResponse<{ csrfToken: string; features: Record<string, boolean> }>)
})

// ── Auth endpoints ──────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Body: { token: string } — GitHub Personal Access Token
 */
apiRouter.post('/auth/login', async (c) => {
  let body: { token?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '请求体格式错误' },
    } satisfies ApiResponse, 400)
  }

  const rawToken = body?.token?.trim()
  if (!rawToken) {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '请提供 GitHub Token' },
    } satisfies ApiResponse, 400)
  }

  // Validate the token by calling GitHub API
  let user: { id: number; login: string; name: string; avatar_url: string }
  try {
    user = await fetchGitHubUser(rawToken)
  } catch (e) {
    if (e instanceof GitHubError) {
      return c.json({
        ok: false,
        error: { code: e.code, message: e.message },
      } satisfies ApiResponse, e.status === 401 || e.status === 403 ? 401 : 502)
    }
    console.error('Unexpected error during login:', e)
    return c.json({
      ok: false,
      error: { code: 'GITHUB_ERROR', message: '验证 GitHub Token 时发生错误' },
    } satisfies ApiResponse, 502)
  }

  // Encrypt the token and sign a JWT
  const encryptedToken = await encryptToken(rawToken)
  const jwt = await signJwt({
    sub: user.id,
    login: user.login,
    name: user.name || user.login,
    avatarUrl: user.avatar_url,
    encryptedToken,
  })

  const isProd = Deno.env.get('DENO_ENV') === 'production'

  // Set HttpOnly Secure cookie
  setCookie(c, AUTH_COOKIE, jwt, {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    maxAge: 24 * 60 * 60, // 24 hours
  })

  const userInfo: UserInfo = {
    id: user.id,
    login: user.login,
    name: user.name || user.login,
    avatarUrl: user.avatar_url,
  }

  return c.json({
    ok: true,
    data: { user: userInfo },
  } satisfies ApiResponse<{ user: UserInfo }>)
})

/**
 * POST /api/auth/logout
 * Clears the auth cookie.
 */
apiRouter.post('/auth/logout', (c) => {
  deleteCookie(c, AUTH_COOKIE, { path: '/' })
  return c.json({
    ok: true,
    data: null,
  } satisfies ApiResponse)
})

/**
 * GET /api/user
 * Returns the current authenticated user's profile.
 */
apiRouter.get('/user', requireAuth, (c) => {
  const session = c.get('session')

  const userInfo: UserInfo = {
    id: session.sub,
    login: session.login,
    name: session.name,
    avatarUrl: session.avatarUrl,
  }

  return c.json({
    ok: true,
    data: { user: userInfo },
  } satisfies ApiResponse<{ user: UserInfo }>)
})

// ── Repo endpoints ──────────────────────────────────────────────

/**
 * GET /api/repos
 * List repositories the current user can push to.
 * Query: ?page=1 (default)
 */
apiRouter.get('/repos', requireAuth, async (c) => {
  const session = c.get('session')
  const page = parseInt(c.req.query('page') || '1', 10) || 1

  let repos: GitHubRepo[]
  try {
    repos = await listUserRepos(session.githubToken, page)
  } catch (e) {
    if (e instanceof GitHubError) {
      return c.json({
        ok: false,
        error: { code: e.code, message: e.message },
      } satisfies ApiResponse, 502)
    }
    console.error('Unexpected error listing repos:', e)
    return c.json({
      ok: false,
      error: { code: 'GITHUB_ERROR', message: '获取仓库列表失败' },
    } satisfies ApiResponse, 502)
  }

  const repoRefs: RepoRef[] = repos.map((r) => ({
    owner: r.owner.login,
    name: r.name,
    defaultBranch: r.default_branch,
    description: r.description,
    updatedAt: r.updated_at,
    permissions: {
      admin: r.permissions.admin,
      push: r.permissions.push,
      pull: true,
    },
  }))

  return c.json({
    ok: true,
    data: { repos: repoRefs },
  } satisfies ApiResponse<{ repos: RepoRef[] }>)
})

/**
 * POST /api/repo/select
 * Select a repo and store its config in the session JWT.
 * Body: { owner: string, name: string }
 */
apiRouter.post('/repo/select', requireAuth, async (c) => {
  const session = c.get('session')

  let body: { owner?: string; name?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '请求体格式错误' },
    } satisfies ApiResponse, 400)
  }

  const { owner, name } = body
  if (!owner || !name) {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '请提供 owner 和 name' },
    } satisfies ApiResponse, 400)
  }

  // Fetch repo info (default branch) and config in parallel
  let repoInfo: { default_branch: string }
  let repoConfig: RepoConfig

  try {
    ;[repoInfo, repoConfig] = await Promise.all([
      fetchRepoInfo(session.githubToken, owner, name),
      fetchRepoConfig(session.githubToken, owner, name),
    ])
  } catch (e) {
    if (e instanceof GitHubError) {
      const status = e.code === 'NOT_FOUND' ? 404 : 502
      return c.json({
        ok: false,
        error: { code: e.code, message: e.message },
      } satisfies ApiResponse, status)
    }
    console.error('Unexpected error selecting repo:', e)
    return c.json({
      ok: false,
      error: { code: 'GITHUB_ERROR', message: '获取仓库信息失败' },
    } satisfies ApiResponse, 502)
  }

  // Re-sign JWT with repo selection included
  const newJwt = await signJwt({
    sub: session.sub,
    login: session.login,
    name: session.name,
    avatarUrl: session.avatarUrl,
    encryptedToken: session.encryptedToken,
    selectedRepo: {
      owner,
      name,
      defaultBranch: repoInfo.default_branch,
    },
    repoConfig,
  })

  const isProd = Deno.env.get('DENO_ENV') === 'production'
  setCookie(c, AUTH_COOKIE, newJwt, {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    maxAge: 24 * 60 * 60,
  })

  return c.json({
    ok: true,
    data: {
      repo: {
        owner,
        name,
        defaultBranch: repoInfo.default_branch,
      },
      config: repoConfig,
    },
  } satisfies ApiResponse<{ repo: RepoRef; config: RepoConfig }>)
})

/**
 * GET /api/repo/current
 * Return the currently selected repo and its config (from JWT session).
 * Useful for restoring editor state after a page refresh.
 */
apiRouter.get('/repo/current', requireAuth, (c) => {
  const session = c.get('session')

  if (!session.selectedRepo || !session.repoConfig) {
    return c.json({
      ok: false,
      error: { code: 'NO_REPO_SELECTED', message: '未选择仓库' },
    } satisfies ApiResponse, 400)
  }

  return c.json({
    ok: true,
    data: {
      repo: session.selectedRepo,
      config: session.repoConfig,
    },
  } satisfies ApiResponse<{ repo: RepoRef; config: RepoConfig }>)
})

// ── Posts endpoints ─────────────────────────────────────────────

/**
 * GET /api/posts
 * List posts under the configured postsDir with frontmatter summaries.
 * Query params: q (search), tag, category, page (default 1), pageSize (default 20)
 *
 * Uses Git Trees API for fast directory listing, then fetches frontmatter
 * for each matching file in parallel.
 */
apiRouter.get('/posts', requireAuth, async (c) => {
  const session = c.get('session')

  if (!session.selectedRepo || !session.repoConfig) {
    return c.json({
      ok: false,
      error: { code: 'NO_REPO_SELECTED', message: '请先选择一个仓库' },
    } satisfies ApiResponse, 400)
  }

  const { owner, name, defaultBranch } = session.selectedRepo
  const { postsDir, extensions } = session.repoConfig
  const token = session.githubToken

  // Parse query params
  const q = c.req.query('q')?.toLowerCase() || ''
  const tagFilter = c.req.query('tag') || ''
  const categoryFilter = c.req.query('category') || ''
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1)
  const pageSize = Math.min(50, Math.max(1, parseInt(c.req.query('pageSize') || '20', 10) || 20))

  // Cache key: per repo (the expensive part is tree + frontmatter fetch)
  const cacheKey = `posts:${owner}:${name}:${defaultBranch}`

  // 1. Try cache first
  let summaries: PostSummary[] = cache.get<PostSummary[]>(cacheKey) || []

  if (summaries.length === 0) {
    // 2. Get file tree
    let tree: GitHubTreeEntry[]
    try {
      tree = await fetchRepoTree(token, owner, name, defaultBranch)
    } catch (e) {
      if (e instanceof GitHubError) {
        return c.json({
          ok: false,
          error: { code: e.code, message: e.message },
        } satisfies ApiResponse, 502)
      }
      return c.json({
        ok: false,
        error: { code: 'GITHUB_ERROR', message: '获取目录树失败' },
      } satisfies ApiResponse, 502)
    }

    // 3. Filter: only blobs under postsDir matching extensions
    const extSet = new Set(extensions.map((e) => e.toLowerCase()))
    const postEntries = tree.filter((entry) => {
      if (entry.type !== 'blob') return false
      if (!entry.path || !entry.path.startsWith(postsDir)) return false
      const ext = entry.path.toLowerCase().split('.').pop()
      return ext && extSet.has('.' + ext)
    })

    // 4. Fetch frontmatter for each post in parallel (with concurrency limit)
    const CONCURRENCY = 8
    summaries = []

    for (let i = 0; i < postEntries.length; i += CONCURRENCY) {
      const batch = postEntries.slice(i, i + CONCURRENCY)
      const results = await Promise.allSettled(
        batch.map(async (entry) => {
          const file = await fetchFileContent(token, owner, name, entry.path)
          if (!file) return null

          const { frontmatter } = parseFrontmatter(file.content)
          const nameParts = entry.path.split('/')
          const fileName = nameParts[nameParts.length - 1]

          return {
            path: entry.path,
            name: fileName,
            sha: file.sha,
            size: entry.size || 0,
            ext: fileName.endsWith('.mdx') ? 'mdx' as const : 'md' as const,
            frontmatter: {
              title: extractTitle(frontmatter, fileName.replace(/\.[^.]+$/, '')),
              published: extractPublished(frontmatter) as string || undefined,
              tags: extractTags(frontmatter),
              category: extractCategory(frontmatter) || undefined,
              abbrlink: typeof frontmatter.abbrlink === 'string' ? frontmatter.abbrlink : undefined,
              draft: frontmatter.draft === true ? true : undefined,
            },
          }
        }),
      )

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) summaries.push(r.value)
      }
    }

    // Cache for 5 minutes
    cache.set(cacheKey, summaries, 5 * 60 * 1000)
  }

  // 5. Apply filters
  let filtered = summaries

  if (q) {
    filtered = filtered.filter((s) => {
      const title = (s.frontmatter.title || '').toLowerCase()
      const abbrlink = (s.frontmatter.abbrlink || '').toLowerCase()
      const desc = ((s.frontmatter as Record<string, unknown>).description as string || '').toLowerCase()
      return title.includes(q) || abbrlink.includes(q) || desc.includes(q)
    })
  }

  if (tagFilter) {
    filtered = filtered.filter((s) =>
      s.frontmatter.tags?.some((t) => t.toLowerCase() === tagFilter.toLowerCase())
    )
  }

  if (categoryFilter) {
    filtered = filtered.filter((s) =>
      s.frontmatter.category?.toLowerCase() === categoryFilter.toLowerCase()
    )
  }

  // Sort by published date descending (newest first)
  filtered.sort((a, b) => {
    const da = a.frontmatter.published || ''
    const db = b.frontmatter.published || ''
    return db.localeCompare(da)
  })

  // 5. Paginate
  const total = filtered.length
  const totalPages = Math.ceil(total / pageSize)
  const start = (page - 1) * pageSize
  const paged = filtered.slice(start, start + pageSize)

  return c.json({
    ok: true,
    data: {
      posts: paged,
      page,
      pageSize,
      total,
      totalPages,
    },
  })
})

/**
 * GET /api/posts/*
 * Fetch a single post with full content and frontmatter.
 * The wildcard path is relative to the repo root (e.g., src/content/posts/my-post/index.md).
 */
apiRouter.get('/posts/*', requireAuth, async (c) => {
  const session = c.get('session')

  if (!session.selectedRepo) {
    return c.json({
      ok: false,
      error: { code: 'NO_REPO_SELECTED', message: '请先选择一个仓库' },
    } satisfies ApiResponse, 400)
  }

  const filePath = getWildcardPath(c, '/api/posts/')
  if (!filePath) {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '请提供文件路径' },
    } satisfies ApiResponse, 400)
  }

  const { owner, name } = session.selectedRepo
  const token = session.githubToken

  let file: { sha: string; content: string } | null
  try {
    file = await fetchFileContent(token, owner, name, filePath)
  } catch (e) {
    if (e instanceof GitHubError) {
      return c.json({
        ok: false,
        error: { code: e.code, message: e.message },
      } satisfies ApiResponse, e.code === 'NOT_FOUND' ? 404 : 502)
    }
    return c.json({
      ok: false,
      error: { code: 'GITHUB_ERROR', message: '获取文章失败' },
    } satisfies ApiResponse, 502)
  }

  if (!file) {
    return c.json({
      ok: false,
      error: { code: 'POST_NOT_FOUND', message: '文章不存在' },
    } satisfies ApiResponse, 404)
  }

  const { frontmatter, content } = parseFrontmatter(file.content)
  const nameParts = filePath.split('/')
  const fileName = nameParts[nameParts.length - 1]

  // Extract raw YAML frontmatter string so the client can display it
  // verbatim (avoiding a parse→dump round-trip that adds quotes).
  const fmMatch = file.content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const frontmatterRaw = fmMatch ? fmMatch[1] : ''

  const post = {
    path: filePath,
    name: fileName,
    sha: file.sha,
    size: new TextEncoder().encode(file.content).length,
    ext: fileName.endsWith('.mdx') ? ('mdx' as const) : ('md' as const),
    frontmatter,
    frontmatterRaw,
    content,
  }

  return c.json({
    ok: true,
    data: { post },
  })
})

// ── Post CRUD (create / update / rename / delete) ───────────────

/**
 * POST /api/posts
 * Create a new post.
 * Body: { path, mode, frontmatter?, content, commitMessage? }
 */
apiRouter.post('/posts', requireAuth, async (c) => {
  const session = c.get('session')

  if (!session.selectedRepo || !session.repoConfig) {
    return c.json({
      ok: false,
      error: { code: 'NO_REPO_SELECTED', message: '请先选择一个仓库' },
    } satisfies ApiResponse, 400)
  }

  let body: {
    path?: string
    mode?: string
    frontmatter?: Record<string, unknown>
    frontmatterRaw?: string
    content?: string
    commitMessage?: string
  }
  try {
    body = await c.req.json()
  } catch {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '请求体格式错误' },
    } satisfies ApiResponse, 400)
  }

  const { owner, name, defaultBranch: _defaultBranch } = session.selectedRepo
  const { postsDir, layout, extensions, commitMessageTemplate } =
    session.repoConfig
  const token = session.githubToken

  // Validate path
  let filePath = body.path?.trim()
  if (!filePath) {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '请提供文件路径 (slug)' },
    } satisfies ApiResponse, 400)
  }

  // Determine ext
  const mode = body.mode === 'mdx' ? 'mdx' : 'md'
  const ext = '.' + mode

  // Build full path based on layout
  if (!filePath.startsWith(postsDir)) {
    if (layout === 'folder') {
      // folder layout: postsDir/slug/index.md
      // If user just provides slug, construct the full path
      const slug = filePath.replace(/\/+$/, '')
      filePath = `${postsDir}${slug}/index${ext}`
    } else {
      // flat layout: postsDir/slug.md
      if (!filePath.endsWith(ext)) filePath = filePath + ext
      if (!filePath.startsWith(postsDir)) filePath = postsDir + filePath
    }
  }

  // Validate extension
  const fileExt = '.' + (filePath.split('.').pop() || '')
  if (!extensions.includes(fileExt)) {
    return c.json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `不支持的文件类型 ${fileExt}，仅支持 ${extensions.join(', ')}`,
      },
    } satisfies ApiResponse, 400)
  }

  // Validate path doesn't escape repo root
  if (filePath.includes('..')) {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '路径非法' },
    } satisfies ApiResponse, 400)
  }

  const content = body.content || ''
  const frontmatterRaw = (body.frontmatterRaw || '').trim()

  // Validate raw YAML is parseable
  let frontmatter: Record<string, unknown>
  try {
    const parsed = load(frontmatterRaw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return c.json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Frontmatter 必须是一个 YAML 对象' },
      } satisfies ApiResponse, 400)
    }
    frontmatter = parsed as Record<string, unknown>
  } catch {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Frontmatter YAML 格式错误' },
    } satisfies ApiResponse, 400)
  }

  // Write raw YAML verbatim — no parse→serialize round-trip
  const raw = `---\n${frontmatterRaw}\n---\n\n${content}`

  // Commit message
  const title = typeof frontmatter.title === 'string' ? frontmatter.title : slugFromPath(filePath)
  const commitMessage =
    body.commitMessage?.trim() ||
    commitMessageTemplate.replace('{title}', title)

  try {
    const result = await createOrUpdateFile(
      token, owner, name, filePath, raw, commitMessage,
    )

    // Invalidate post list cache
    cache.delete(`posts:${owner}:${name}:${_defaultBranch}`)

    return c.json({
      ok: true,
      data: {
        post: {
          path: filePath,
          name: filePath.split('/').pop() || '',
          sha: result.sha,
          size: new TextEncoder().encode(raw).length,
          ext: mode,
          frontmatter,
          content,
        },
      },
    } satisfies ApiResponse, 201)
  } catch (e) {
    if (e instanceof GitHubError) {
      return c.json({
        ok: false,
        error: { code: e.code, message: e.message },
      } satisfies ApiResponse, errorStatus(e))
    }
    throw e
  }
})

/**
 * PUT /api/posts/*
 * Update an existing post.
 * Body: { sha, frontmatter?, content?, commitMessage? }
 */
apiRouter.put('/posts/*', requireAuth, async (c) => {
  const session = c.get('session')

  if (!session.selectedRepo || !session.repoConfig) {
    return c.json({
      ok: false,
      error: { code: 'NO_REPO_SELECTED', message: '请先选择一个仓库' },
    } satisfies ApiResponse, 400)
  }

  const filePath = getWildcardPath(c, '/api/posts/')
  if (!filePath) {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '请提供文件路径' },
    } satisfies ApiResponse, 400)
  }

  let body: {
    sha?: string
    frontmatter?: Record<string, unknown>
    frontmatterRaw?: string
    content?: string
    commitMessage?: string
  }
  try {
    body = await c.req.json()
  } catch {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '请求体格式错误' },
    } satisfies ApiResponse, 400)
  }

  if (!body.sha) {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '缺少文件 SHA（并发冲突检测）' },
    } satisfies ApiResponse, 400)
  }

  const { owner, name } = session.selectedRepo
  const { commitMessageTemplate } = session.repoConfig
  const token = session.githubToken

  // Fetch current file to get existing frontmatter + content
  let existing: { sha: string; content: string }
  try {
    const file = await fetchFileContent(token, owner, name, filePath)
    if (!file) {
      return c.json({
        ok: false,
        error: { code: 'POST_NOT_FOUND', message: '文章不存在' },
      } satisfies ApiResponse, 404)
    }
    existing = file
  } catch (e) {
    if (e instanceof GitHubError) {
      return c.json({
        ok: false,
        error: { code: e.code, message: e.message },
      } satisfies ApiResponse, 502)
    }
    throw e
  }

  const { content: currentBody } = parseFrontmatter(existing.content)
  const newContent = body.content !== undefined ? body.content : currentBody
  const frontmatterRaw = (body.frontmatterRaw || '').trim()

  // Validate raw YAML is parseable
  let mergedFm: Record<string, unknown>
  try {
    const parsed = load(frontmatterRaw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return c.json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Frontmatter 必须是一个 YAML 对象' },
      } satisfies ApiResponse, 400)
    }
    mergedFm = parsed as Record<string, unknown>
  } catch {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Frontmatter YAML 格式错误' },
    } satisfies ApiResponse, 400)
  }

  // Write raw YAML verbatim — no parse→serialize round-trip
  const raw = `---\n${frontmatterRaw}\n---\n\n${newContent}`

  const title = typeof mergedFm.title === 'string' ? mergedFm.title : slugFromPath(filePath)
  const commitMessage =
    body.commitMessage?.trim() ||
    commitMessageTemplate.replace('{title}', title)

  try {
    const result = await createOrUpdateFile(
      token, owner, name, filePath, raw, commitMessage, body.sha,
    )

    // Invalidate post list cache
    cache.delete(`posts:${owner}:${name}:${session.selectedRepo.defaultBranch}`)

    return c.json({
      ok: true,
      data: {
        post: {
          path: filePath,
          name: filePath.split('/').pop() || '',
          sha: result.sha,
          size: new TextEncoder().encode(raw).length,
          ext: filePath.endsWith('.mdx') ? ('mdx' as const) : ('md' as const),
          frontmatter: mergedFm,
          content: newContent,
        },
      },
    })
  } catch (e) {
    if (e instanceof GitHubError) {
      return c.json({
        ok: false,
        error: { code: e.code, message: e.message },
      } satisfies ApiResponse, errorStatus(e))
    }
    throw e
  }
})

/**
 * PATCH /api/posts/*
 * Rename / move a post.
 * Body: { newPath, sha, commitMessage? }
 *
 * Strategy: create a new file at newPath with the same content,
 * then delete the old file. This preserves history.
 */
apiRouter.patch('/posts/*', requireAuth, async (c) => {
  const session = c.get('session')

  if (!session.selectedRepo || !session.repoConfig) {
    return c.json({
      ok: false,
      error: { code: 'NO_REPO_SELECTED', message: '请先选择一个仓库' },
    } satisfies ApiResponse, 400)
  }

  const oldPath = getWildcardPath(c, '/api/posts/')
  if (!oldPath) {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '请提供文件路径' },
    } satisfies ApiResponse, 400)
  }

  let body: {
    newPath?: string
    sha?: string
    commitMessage?: string
  }
  try {
    body = await c.req.json()
  } catch {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '请求体格式错误' },
    } satisfies ApiResponse, 400)
  }

  const newPath = body.newPath?.trim()
  if (!newPath) {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '请提供新路径' },
    } satisfies ApiResponse, 400)
  }

  if (!body.sha) {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '缺少文件 SHA' },
    } satisfies ApiResponse, 400)
  }

  // Validate paths
  if (oldPath.includes('..') || newPath.includes('..')) {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '路径非法' },
    } satisfies ApiResponse, 400)
  }

  if (oldPath === newPath) {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '新路径与旧路径相同' },
    } satisfies ApiResponse, 400)
  }

  // Validate new extension
  const { extensions } = session.repoConfig
  const newExt = '.' + (newPath.split('.').pop() || '')
  if (!extensions.includes(newExt)) {
    return c.json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `不支持的文件类型 ${newExt}`,
      },
    } satisfies ApiResponse, 400)
  }

  const { owner, name } = session.selectedRepo
  const token = session.githubToken

  // 1. Fetch the current file content
  let fileContent: string
  try {
    const file = await fetchFileContent(token, owner, name, oldPath)
    if (!file) {
      return c.json({
        ok: false,
        error: { code: 'POST_NOT_FOUND', message: '文章不存在' },
      } satisfies ApiResponse, 404)
    }
    fileContent = file.content
  } catch (e) {
    if (e instanceof GitHubError) {
      return c.json({
        ok: false,
        error: { code: e.code, message: e.message },
      } satisfies ApiResponse, 502)
    }
    throw e
  }

  // 2. Update abbrlink/aliases in frontmatter
  const { frontmatter, content } = parseFrontmatter(fileContent)
  if (frontmatter.aliases && Array.isArray(frontmatter.aliases)) {
    const aliases = frontmatter.aliases as string[]
    if (!aliases.includes(oldPath)) aliases.push(oldPath)
  }

  const newRaw = serializePost(frontmatter, content)
  const commitMessage =
    body.commitMessage?.trim() ||
    `rename: ${oldPath} → ${newPath}`

  // 3. Create new file + delete old file
  try {
    // Create at new location
    const createResult = await createOrUpdateFile(
      token, owner, name, newPath, newRaw, commitMessage,
    )

    // Delete old file
    await deleteFile(token, owner, name, oldPath, body.sha, commitMessage)

    // Invalidate post list cache
    cache.delete(`posts:${owner}:${name}:${session.selectedRepo.defaultBranch}`)

    return c.json({
      ok: true,
      data: {
        post: {
          path: newPath,
          name: newPath.split('/').pop() || '',
          sha: createResult.sha,
          size: new TextEncoder().encode(newRaw).length,
          ext: newPath.endsWith('.mdx') ? ('mdx' as const) : ('md' as const),
          frontmatter,
          content,
        },
      },
    })
  } catch (e) {
    if (e instanceof GitHubError) {
      return c.json({
        ok: false,
        error: { code: e.code, message: e.message },
      } satisfies ApiResponse, errorStatus(e))
    }
    throw e
  }
})

/**
 * DELETE /api/posts/*
 * Delete a post.
 * Body: { sha, commitMessage? }
 */
apiRouter.delete('/posts/*', requireAuth, async (c) => {
  const session = c.get('session')

  if (!session.selectedRepo || !session.repoConfig) {
    return c.json({
      ok: false,
      error: { code: 'NO_REPO_SELECTED', message: '请先选择一个仓库' },
    } satisfies ApiResponse, 400)
  }

  const filePath = getWildcardPath(c, '/api/posts/')
  if (!filePath) {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '请提供文件路径' },
    } satisfies ApiResponse, 400)
  }

  let body: { sha?: string; commitMessage?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '请求体格式错误' },
    } satisfies ApiResponse, 400)
  }

  if (!body.sha) {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '缺少文件 SHA' },
    } satisfies ApiResponse, 400)
  }

  const { owner, name } = session.selectedRepo
  const token = session.githubToken
  const title = slugFromPath(filePath)
  const commitMessage = body.commitMessage?.trim() || `delete: ${title}`

  try {
    await deleteFile(token, owner, name, filePath, body.sha, commitMessage)

    // Invalidate post list cache
    cache.delete(`posts:${owner}:${name}:${session.selectedRepo.defaultBranch}`)

    return c.json({
      ok: true,
      data: { deleted: filePath },
    })
  } catch (e) {
    if (e instanceof GitHubError) {
      return c.json({
        ok: false,
        error: { code: e.code, message: e.message },
      } satisfies ApiResponse, errorStatus(e))
    }
    throw e
  }
})

// ── Config files endpoints ─────────────────────────────────────

/**
 * GET /api/config-files
 * Scan the repo for config files matching configFilePatterns.
 * Returns a list of config files with type info.
 */
apiRouter.get('/config-files', requireAuth, async (c) => {
  const session = c.get('session')

  if (!session.selectedRepo || !session.repoConfig) {
    return c.json({
      ok: false,
      error: { code: 'NO_REPO_SELECTED', message: '请先选择一个仓库' },
    } satisfies ApiResponse, 400)
  }

  const { owner, name, defaultBranch } = session.selectedRepo
  const { configFilePatterns } = session.repoConfig
  const token = session.githubToken

  // 1. Get repo tree
  let tree: GitHubTreeEntry[]
  try {
    tree = await fetchRepoTree(token, owner, name, defaultBranch)
  } catch (e) {
    if (e instanceof GitHubError) {
      return c.json({
        ok: false,
        error: { code: e.code, message: e.message },
      } satisfies ApiResponse, 502)
    }
    return c.json({
      ok: false,
      error: { code: 'GITHUB_ERROR', message: '获取目录树失败' },
    } satisfies ApiResponse, 502)
  }

  // 2. Filter: blobs matching configFilePatterns
  const configEntries = tree.filter((entry) => {
    if (entry.type !== 'blob') return false
    if (!entry.path) return false
    const name = entry.path.split('/').pop() || ''
    return configFilePatterns.some((pattern) => matchGlob(name, pattern))
  })

  // 3. Build summaries
  const files: ConfigFileSummary[] = configEntries.map((entry) => {
    const name = entry.path.split('/').pop() || entry.path
    return {
      path: entry.path,
      name,
      sha: entry.sha,
      type: detectConfigType(entry.path),
    }
  })

  // Sort: root-level first, then by name
  files.sort((a, b) => {
    const aDepth = a.path.split('/').length
    const bDepth = b.path.split('/').length
    if (aDepth !== bDepth) return aDepth - bDepth
    return a.path.localeCompare(b.path)
  })

  return c.json({
    ok: true,
    data: { files },
  } satisfies ApiResponse<{ files: ConfigFileSummary[] }>)
})

/**
 * GET /api/config-files/*
 * Read a single config file with parsed content.
 */
apiRouter.get('/config-files/*', requireAuth, async (c) => {
  const session = c.get('session')

  if (!session.selectedRepo) {
    return c.json({
      ok: false,
      error: { code: 'NO_REPO_SELECTED', message: '请先选择一个仓库' },
    } satisfies ApiResponse, 400)
  }

  const filePath = getWildcardPath(c, '/api/config-files/')
  if (!filePath) {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '请提供文件路径' },
    } satisfies ApiResponse, 400)
  }

  const { owner, name } = session.selectedRepo
  const token = session.githubToken

  let file: { sha: string; content: string } | null
  try {
    file = await fetchFileContent(token, owner, name, filePath)
  } catch (e) {
    if (e instanceof GitHubError) {
      return c.json({
        ok: false,
        error: { code: e.code, message: e.message },
      } satisfies ApiResponse, e.code === 'NOT_FOUND' ? 404 : 502)
    }
    return c.json({
      ok: false,
      error: { code: 'GITHUB_ERROR', message: '获取配置文件失败' },
    } satisfies ApiResponse, 502)
  }

  if (!file) {
    return c.json({
      ok: false,
      error: { code: 'CONFIG_NOT_FOUND', message: '配置文件不存在' },
    } satisfies ApiResponse, 404)
  }

  const type = detectConfigType(filePath)
  const parsed = parseConfigContent(file.content, type)

  return c.json({
    ok: true,
    data: {
      file: {
        path: filePath,
        sha: file.sha,
        content: file.content,
        type,
        parsed,
      },
    },
  })
})

/**
 * PUT /api/config-files/*
 * Update a config file. Requires sha for conflict detection.
 * Validates JSON/YAML content before saving.
 */
apiRouter.put('/config-files/*', requireAuth, async (c) => {
  const session = c.get('session')

  if (!session.selectedRepo || !session.repoConfig) {
    return c.json({
      ok: false,
      error: { code: 'NO_REPO_SELECTED', message: '请先选择一个仓库' },
    } satisfies ApiResponse, 400)
  }

  const filePath = getWildcardPath(c, '/api/config-files/')
  if (!filePath) {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '请提供文件路径' },
    } satisfies ApiResponse, 400)
  }

  let body: {
    sha?: string
    content?: string
    commitMessage?: string
  }
  try {
    body = await c.req.json()
  } catch {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '请求体格式错误' },
    } satisfies ApiResponse, 400)
  }

  if (!body.sha) {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '缺少文件 SHA' },
    } satisfies ApiResponse, 400)
  }

  if (body.content === undefined || body.content === null) {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '缺少文件内容' },
    } satisfies ApiResponse, 400)
  }

  // Validate content for structured formats
  const type = detectConfigType(filePath)
  if (type === 'json') {
    try { JSON.parse(body.content) } catch {
      return c.json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'JSON 格式错误，请检查语法' },
      } satisfies ApiResponse, 400)
    }
  } else if (type === 'yaml') {
    try {
      const parsed = load(body.content)
      if (parsed !== null && typeof parsed !== 'object') {
        throw new Error('YAML must be an object')
      }
    } catch {
      return c.json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'YAML 格式错误，请检查语法' },
      } satisfies ApiResponse, 400)
    }
  }

  const { owner, name } = session.selectedRepo
  const { commitMessageTemplate } = session.repoConfig
  const token = session.githubToken
  const commitMessage =
    body.commitMessage?.trim() ||
    commitMessageTemplate.replace('{title}', filePath.split('/').pop() || filePath)

  try {
    const result = await createOrUpdateFile(
      token, owner, name, filePath, body.content, commitMessage, body.sha,
    )

    // Re-parse after successful save
    const parsed = parseConfigContent(body.content, type)

    return c.json({
      ok: true,
      data: {
        file: {
          path: filePath,
          sha: result.sha,
          content: body.content,
          type,
          parsed,
        },
      },
    })
  } catch (e) {
    if (e instanceof GitHubError) {
      return c.json({
        ok: false,
        error: { code: e.code, message: e.message },
      } satisfies ApiResponse, errorStatus(e))
    }
    throw e
  }
})

// ── Media (asset) endpoints ────────────────────────────────────

/** Allowed image MIME types for upload */
const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/svg+xml',
  'image/webp',
  'image/bmp',
])

/** Extensions recognized as images for listing */
const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico',
])

/** Max upload size: 10 MB */
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024

/**
 * POST /api/media
 * Upload an image file. Accepts multipart/form-data.
 * Fields: file (required), destDir (optional), naming (optional)
 * Returns the created file's path, sha, url, and size.
 */
apiRouter.post('/media', requireAuth, async (c) => {
  const session = c.get('session')

  if (!session.selectedRepo || !session.repoConfig) {
    return c.json({
      ok: false,
      error: { code: 'NO_REPO_SELECTED', message: '请先选择一个仓库' },
    } satisfies ApiResponse, 400)
  }

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await c.req.raw.formData()
  } catch {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '请求格式错误，需要 multipart/form-data' },
    } satisfies ApiResponse, 400)
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '请选择要上传的文件' },
    } satisfies ApiResponse, 400)
  }

  // Validate file type
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return c.json({
      ok: false,
      error: {
        code: 'UNSUPPORTED_FILE_TYPE',
        message: `不支持的文件类型 ${file.type || '未知'}，仅支持常见图片格式`,
      },
    } satisfies ApiResponse, 400)
  }

  // Validate file size
  if (file.size > MAX_UPLOAD_SIZE) {
    return c.json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `文件大小不能超过 10 MB（当前 ${(file.size / 1024 / 1024).toFixed(1)} MB）`,
      },
    } satisfies ApiResponse, 400)
  }

  const { owner, name } = session.selectedRepo
  const {
    postsDir,
    layout,
    assetsMode,
    assetsPublicDir,
    assetsNaming,
  } = session.repoConfig
  const token = session.githubToken

  // Determine destination directory
  let destDir = (formData.get('destDir') as string)?.trim() || ''
  if (!destDir) {
    if (assetsMode === 'public') {
      destDir = assetsPublicDir.replace(/\/$/, '')
    } else {
      // Co-located: put image next to a post. If no destDir specified,
      // default to postsDir root for simplicity.
      destDir = postsDir.replace(/\/$/, '')
    }
  }

  // Get original filename and extension
  const originalName = file.name || 'image.png'
  const ext = (originalName.lastIndexOf('.') > 0
    ? originalName.slice(originalName.lastIndexOf('.'))
    : '.png').toLowerCase()

  // Generate filename based on naming convention
  let fileName: string
  const namingPattern = (formData.get('naming') as string)?.trim() || assetsNaming

  if (namingPattern.includes('{')) {
    const slug = originalName.replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*]/g, '-')
    const now = new Date()
    const yyyy = String(now.getFullYear())
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const rand6 = String(Math.floor(Math.random() * 1000000)).padStart(6, '0')

    fileName = namingPattern
      .replace('{slug}', slug)
      .replace('{yyyy}', yyyy)
      .replace('{mm}', mm)
      .replace('{dd}', dd)
      .replace('{rand6}', rand6)
    if (!fileName.endsWith(ext)) fileName += ext
  } else {
    fileName = originalName
  }

  const filePath = `${destDir}/${fileName}`.replace(/\/+/g, '/')

  // Validate path doesn't escape repo
  if (filePath.includes('..')) {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '路径非法' },
    } satisfies ApiResponse, 400)
  }

  // Read file content and encode as base64
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    return c.json({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: '无法读取文件内容' },
    } satisfies ApiResponse, 400)
  }

  // Encode to base64
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64Content = btoa(binary)

  // Push to GitHub
  const commitMessage = `upload: ${fileName}`
  const body: Record<string, unknown> = { message: commitMessage, content: base64Content }

  try {
    const url = `https://api.github.com/repos/${owner}/${name}/contents/${filePath}`
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'hexo-backend',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      if (res.status === 422) {
        // File already exists — add a random suffix
        const base = fileName.replace(/\.[^.]+$/, '')
        const retryName = `${base}-${Math.floor(Math.random() * 10000)}${ext}`
        const retryPath = `${destDir}/${retryName}`.replace(/\/+/g, '/')
        const retryBody = { message: `upload: ${retryName}`, content: base64Content }
        const retryRes = await fetch(
          `https://api.github.com/repos/${owner}/${name}/contents/${retryPath}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github+json',
              'User-Agent': 'hexo-backend',
              'X-GitHub-Api-Version': '2022-11-28',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(retryBody),
          },
        )
        if (!retryRes.ok) {
          throw new GitHubError(
            'GITHUB_ERROR',
            `上传失败 (${retryRes.status})`,
            retryRes.status,
          )
        }
        const retryData = await retryRes.json() as {
          content: { sha: string; html_url?: string; download_url?: string; size: number }
        }
        return c.json({
          ok: true,
          data: {
            path: retryPath,
            sha: retryData.content.sha,
            url: retryData.content.download_url || retryData.content.html_url || retryPath,
            size: bytes.length,
          },
        } satisfies ApiResponse, 201)
      }
      throw new GitHubError('GITHUB_ERROR', `上传失败 (${res.status})`, res.status)
    }

    const data = await res.json() as {
      content: { sha: string; html_url?: string; download_url?: string; size: number }
    }

    return c.json({
      ok: true,
      data: {
        path: filePath,
        sha: data.content.sha,
        url: data.content.download_url || data.content.html_url || filePath,
        size: bytes.length,
      },
    } satisfies ApiResponse, 201)
  } catch (e) {
    if (e instanceof GitHubError) {
      return c.json({
        ok: false,
        error: { code: e.code, message: e.message },
      } satisfies ApiResponse, errorStatus(e))
    }
    throw e
  }
})

/**
 * GET /api/media
 * List media files (images) in the repo.
 * Query: prefix (optional directory prefix), page, pageSize
 */
apiRouter.get('/media', requireAuth, async (c) => {
  const session = c.get('session')

  if (!session.selectedRepo || !session.repoConfig) {
    return c.json({
      ok: false,
      error: { code: 'NO_REPO_SELECTED', message: '请先选择一个仓库' },
    } satisfies ApiResponse, 400)
  }

  const { owner, name, defaultBranch } = session.selectedRepo
  const { postsDir, assetsPublicDir, assetsMode } = session.repoConfig
  const token = session.githubToken

  const prefix = c.req.query('prefix') || ''
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1)
  const pageSize = Math.min(50, Math.max(1, parseInt(c.req.query('pageSize') || '30', 10) || 30))

  // Get repo tree
  let tree: GitHubTreeEntry[]
  try {
    tree = await fetchRepoTree(token, owner, name, defaultBranch)
  } catch (e) {
    if (e instanceof GitHubError) {
      return c.json({
        ok: false,
        error: { code: e.code, message: e.message },
      } satisfies ApiResponse, 502)
    }
    return c.json({
      ok: false,
      error: { code: 'GITHUB_ERROR', message: '获取目录树失败' },
    } satisfies ApiResponse, 502)
  }

  // Determine scan directories
  const scanDirs: string[] = []
  if (assetsMode === 'public') {
    scanDirs.push(assetsPublicDir.replace(/\/$/, ''))
  } else {
    scanDirs.push(postsDir.replace(/\/$/, ''))
  }

  // Filter: blobs with image extensions under scan dirs
  let entries = tree.filter((entry) => {
    if (entry.type !== 'blob') return false
    if (!entry.path) return false
    const lower = entry.path.toLowerCase()
    const ext = lower.slice(lower.lastIndexOf('.'))
    if (!IMAGE_EXTENSIONS.has(ext)) return false
    // Must be under a scan dir
    return scanDirs.some((dir) =>
      entry.path.startsWith(dir + '/') || entry.path.startsWith(dir),
    )
  })

  // Apply prefix filter
  if (prefix) {
    entries = entries.filter((e) => e.path.startsWith(prefix))
  }

  // Sort: newest-ish first (approximate by path)
  entries.sort((a, b) => b.path.localeCompare(a.path))

  // Paginate
  const total = entries.length
  const totalPages = Math.ceil(total / pageSize)
  const start = (page - 1) * pageSize
  const paged = entries.slice(start, start + pageSize)

  // Build response
  const files = paged.map((entry) => ({
    path: entry.path,
    name: entry.path.split('/').pop() || entry.path,
    sha: entry.sha,
    size: entry.size || 0,
    url: `https://raw.githubusercontent.com/${owner}/${name}/${defaultBranch}/${entry.path}`,
  }))

  return c.json({
    ok: true,
    data: {
      files,
      page,
      pageSize,
      total,
      totalPages,
    },
  })
})

// ── Helpers ──────────────────────────────────────────────────────

/** Extract a readable slug from a file path for commit messages */
function slugFromPath(filePath: string): string {
  const parts = filePath.replace(/\/$/, '').split('/')
  const last = parts[parts.length - 1]
  // If it's a folder layout (index.md), use the parent dir name
  if (last === 'index.md' || last === 'index.mdx') {
    return parts[parts.length - 2] || last
  }
  return last.replace(/\.[^.]+$/, '')
}

/**
 * Simple glob match for config file patterns.
 * Patterns are matched against filenames (not full paths).
 * Supports * as wildcard (e.g. "*.json", "astro.config.*").
 */
function matchGlob(filename: string, pattern: string): boolean {
  // Escape regex special chars except *
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const regexStr = '^' + escaped.replace(/\*/g, '.*') + '$'
  return new RegExp(regexStr, 'i').test(filename)
}

/** Detect config file type from its extension */
function detectConfigType(path: string): 'json' | 'yaml' | 'toml' | 'text' {
  const lower = path.toLowerCase()
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.yml') || lower.endsWith('.yaml')) return 'yaml'
  if (lower.endsWith('.toml')) return 'toml'
  return 'text'
}

/** Parse config file content into structured object (null if unparseable or text) */
function parseConfigContent(
  content: string,
  type: 'json' | 'yaml' | 'toml' | 'text',
): Record<string, unknown> | null {
  if (type === 'json') {
    try {
      const parsed = JSON.parse(content)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
      // Arrays are valid JSON too — wrap them
      if (Array.isArray(parsed)) {
        return { _array: parsed }
      }
    } catch { /* ignore */ }
  }
  if (type === 'yaml') {
    try {
      const parsed = load(content)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch { /* ignore */ }
  }
  return null
}
