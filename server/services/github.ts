/**
 * GitHub REST API 封装。
 *
 * 所有请求直接使用 fetch，不引入重量级 SDK。
 * GitHub API base: https://api.github.com
 *
 * 优化：
 * - ETag/If-None-Match 条件请求：304 不计入 API 配额
 * - 内存缓存：同一请求生命周期内复用 ETag
 * - 速率限制跟踪
 */

const GITHUB_API = 'https://api.github.com'
const USER_AGENT = 'hexo-backend'

// ── ETag cache ─────────────────────────────────────────────────────

interface CacheEntry {
  etag: string
  data: unknown
  timestamp: number
}

/** In-memory ETag cache. TTL: 5 minutes for most resources. */
const etagCache = new Map<string, CacheEntry>()
const ETAG_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCached(url: string): CacheEntry | undefined {
  const entry = etagCache.get(url)
  if (!entry) return undefined
  if (Date.now() - entry.timestamp > ETAG_CACHE_TTL) {
    etagCache.delete(url)
    return undefined
  }
  return entry
}

function setCached(url: string, etag: string, data: unknown): void {
  etagCache.set(url, { etag, data, timestamp: Date.now() })
}

// ── Rate limit tracking ────────────────────────────────────────────

/** Exposed for logging middleware */
export let lastRateLimit = {
  remaining: -1,
  limit: -1,
  reset: 0,
}

function updateRateLimit(res: Response): void {
  const remaining = res.headers.get('x-ratelimit-remaining')
  const limit = res.headers.get('x-ratelimit-limit')
  const reset = res.headers.get('x-ratelimit-reset')
  if (remaining !== null) lastRateLimit.remaining = parseInt(remaining, 10)
  if (limit !== null) lastRateLimit.limit = parseInt(limit, 10)
  if (reset !== null) lastRateLimit.reset = parseInt(reset, 10)
}

/**
 * Check if we're close to hitting the rate limit.
 * Returns a warning message if remaining quota is low.
 */
export function checkRateLimit(): string | null {
  const { remaining, limit, reset } = lastRateLimit
  // -1 means unknown (no API calls made yet)
  if (remaining < 0 || limit <= 0) return null
  if (remaining <= 0) {
    const resetDate = reset > 0
      ? new Date(reset * 1000).toLocaleTimeString('zh-CN')
      : '未知时间'
    return `GitHub API 配额已用尽，将于 ${resetDate} 重置。请稍后再试。`
  }
  if (remaining < 10) {
    return `GitHub API 配额即将用尽（剩余 ${remaining}/${limit}）。建议稍后再试。`
  }
  return null
}

// ── ETag-aware fetch ───────────────────────────────────────────────

/**
 * Perform a GitHub API request with ETag caching.
 * On cache hit (304 Not Modified), returns cached data without consuming quota.
 */
async function githubFetch<T>(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<{ data: T; cached: boolean }> {
  const headers = new Headers(init?.headers || {})
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Accept', 'application/vnd.github+json')
  headers.set('User-Agent', USER_AGENT)
  headers.set('X-GitHub-Api-Version', '2022-11-28')

  // Attach ETag if we have one cached
  const cached = getCached(url)
  if (cached) {
    headers.set('If-None-Match', cached.etag)
  }

  const res = await fetch(url, { ...init, headers })
  updateRateLimit(res)

  // 304 Not Modified — use cached data
  if (res.status === 304) {
    return { data: cached!.data as T, cached: true }
  }

  if (!res.ok) throw toGitHubError(res, 'GitHub API 请求')

  const data = await res.json() as T

  // Store ETag for future requests
  const etag = res.headers.get('etag')
  if (etag) {
    setCached(url, etag, data)
  }

  return { data, cached: false }
}

// ── Types ────────────────────────────────────────────────────────

export interface GitHubUser {
  id: number
  login: string
  name: string
  avatar_url: string
}

export interface GitHubRepo {
  id: number
  name: string
  owner: { login: string; avatar_url: string }
  default_branch: string
  permissions: { admin: boolean; push: boolean; pull: boolean }
  description: string | null
  updated_at: string
}

export interface GitHubRepoInfo {
  default_branch: string
}

export interface GitHubFile {
  path: string
  name: string
  sha: string
  size: number
  content: string // base64-encoded
  encoding: string
  type: 'file' | 'dir'
}

// ── Error ────────────────────────────────────────────────────────

export class GitHubError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number,
  ) {
    super(message)
    this.name = 'GitHubError'
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': USER_AGENT,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function toGitHubError(res: Response, action: string): GitHubError {
  if (res.status === 401 || res.status === 403) {
    return new GitHubError(
      'TOKEN_INVALID',
      'GitHub Token 无效或权限不足',
      res.status,
    )
  }
  if (res.status === 404) {
    return new GitHubError(
      'NOT_FOUND',
      `${action}失败：资源不存在`,
      res.status,
    )
  }
  return new GitHubError(
    'GITHUB_ERROR',
    `${action}失败 (${res.status})`,
    res.status,
  )
}

// ── User ─────────────────────────────────────────────────────────

/**
 * Validate a GitHub PAT by calling GET /user.
 * Returns the authenticated user's profile on success.
 * Throws GitHubError with code TOKEN_INVALID on 401.
 */
export async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  const { data } = await githubFetch<GitHubUser>(`${GITHUB_API}/user`, token)
  return data
}

export interface GitHubTreeEntry {
  path: string
  mode: string
  type: 'blob' | 'tree'
  sha: string
  size?: number
  url: string
}

// ── Repos ────────────────────────────────────────────────────────

/**
 * List repositories the authenticated user has push access to.
 * Sorted by last updated, 30 per page.
 */
export async function listUserRepos(
  token: string,
  page = 1,
  perPage = 30,
): Promise<GitHubRepo[]> {
  const url =
    `${GITHUB_API}/user/repos?type=owner&sort=updated&per_page=${perPage}&page=${page}`

  const { data: repos } = await githubFetch<GitHubRepo[]>(url, token)

  // Only return repos with push access
  return repos.filter((r) => r.permissions.push)
}

/**
 * Get basic repo metadata including default branch.
 */
export async function fetchRepoInfo(
  token: string,
  owner: string,
  name: string,
): Promise<GitHubRepoInfo> {
  const { data } = await githubFetch<GitHubRepoInfo>(
    `${GITHUB_API}/repos/${owner}/${name}`,
    token,
  )
  return data
}

/**
 * Fetch a single file from a repo (Contents API).
 * For files ≤ 1 MB the response includes base64-encoded content.
 */
export async function fetchFileContent(
  token: string,
  owner: string,
  name: string,
  path: string,
): Promise<{ sha: string; content: string } | null> {
  const url = `${GITHUB_API}/repos/${owner}/${name}/contents/${path}`

  try {
    const { data: file } = await githubFetch<GitHubFile>(url, token)

    if (file.encoding !== 'base64') {
      throw new GitHubError(
        'UNSUPPORTED_ENCODING',
        `文件编码 ${file.encoding} 不支持`,
      )
    }

    // Decode base64 content with proper UTF-8 handling.
    // atob() produces a binary string (one char per byte); TextDecoder
    // correctly decodes multi-byte UTF-8 sequences (e.g., CJK characters).
    const binaryStr = atob(file.content.replace(/\n/g, ''))
    const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0))
    const decoded = new TextDecoder().decode(bytes)

    return { sha: file.sha, content: decoded }
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null
    throw e
  }
}

// ── Trees ────────────────────────────────────────────────────────

/**
 * Get a recursive Git tree for a repo branch.
 * The Trees API returns all files & directories under the ref.
 * A single call can return the entire repo structure (useful for listing posts).
 */
export async function fetchRepoTree(
  token: string,
  owner: string,
  name: string,
  branch: string,
): Promise<GitHubTreeEntry[]> {
  const url =
    `${GITHUB_API}/repos/${owner}/${name}/git/trees/${branch}?recursive=1`

  const { data } = await githubFetch<{ tree: GitHubTreeEntry[] }>(url, token)
  return data.tree
}

// ── Write helpers ──────────────────────────────────────────────────

/**
 * Create or update a file via the Contents API.
 * If sha is provided, it's an update (requires sha for conflict detection).
 * If sha is omitted, it's a create (fails if file already exists).
 *
 * Returns the new sha of the created/updated file.
 */
export async function createOrUpdateFile(
  token: string,
  owner: string,
  name: string,
  path: string,
  content: string,
  message: string,
  sha?: string,
): Promise<{ sha: string }> {
  // Encode content as UTF-8 base64
  const encoder = new TextEncoder()
  const bytes = encoder.encode(content)
  // Use a streaming-safe base64 encode (btoa with manual chunking for UTF-8)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64Content = btoa(binary)

  const body: Record<string, unknown> = {
    message,
    content: base64Content,
  }
  if (sha) body.sha = sha

  const url = `${GITHUB_API}/repos/${owner}/${name}/contents/${path}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  updateRateLimit(res)

  if (!res.ok) {
    if (res.status === 409) {
      throw new GitHubError(
        'CONFLICT_SHA_MISMATCH',
        '文件已被他人更新，请刷新后重试',
        res.status,
      )
    }
    if (res.status === 422) {
      throw new GitHubError(
        'FILE_EXISTS',
        '文件已存在',
        res.status,
      )
    }
    throw toGitHubError(res, '保存文件')
  }

  const data = await res.json() as { content: { sha: string } }
  return { sha: data.content.sha }
}

/**
 * Delete a file via the Contents API.
 * Requires the file's current sha.
 */
export async function deleteFile(
  token: string,
  owner: string,
  name: string,
  path: string,
  sha: string,
  message: string,
): Promise<void> {
  const url = `${GITHUB_API}/repos/${owner}/${name}/contents/${path}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, sha }),
  })
  updateRateLimit(res)

  if (!res.ok) {
    if (res.status === 409) {
      throw new GitHubError(
        'CONFLICT_SHA_MISMATCH',
        '文件已被他人更新，请刷新后重试',
        res.status,
      )
    }
    throw toGitHubError(res, '删除文件')
  }
}
