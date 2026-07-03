/**
 * API client for communicating with the Deno backend.
 * All requests go to /api/* which is proxied to Deno in dev,
 * or served by the same origin in production.
 *
 * CSRF: On initialization, fetches /api/config to obtain a CSRF token.
 * The token is sent in X-CSRF-Token header on all mutation requests.
 */

// ── Types ────────────────────────────────────────────────────────

interface ApiEnvelope<T = unknown> {
  ok: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

export interface UserInfo {
  id: number
  login: string
  name: string
  avatarUrl: string
}

export interface AppConfig {
  csrfToken: string
  features: Record<string, boolean>
}

export interface RepoItem {
  owner: string
  name: string
  defaultBranch: string
  description?: string | null
  updatedAt?: string
  permissions: { admin: boolean; push: boolean; pull: boolean }
}

export interface FrontmatterField {
  key: string
  type: 'string' | 'date' | 'string[]' | 'boolean' | 'number'
  label: string
  required?: boolean
  default?: unknown
}

export interface RepoConfig {
  postsDir: string
  layout: 'folder' | 'flat'
  assetsMode: 'co-located' | 'public'
  assetsPublicDir: string
  assetsNaming: string
  extensions: string[]
  configFilePatterns: string[]
  commitMessageTemplate: string
  frontmatterFields: FrontmatterField[]
  frontmatterRequired: string[]
  frontmatterDefaults: Record<string, unknown>
}

// ── State ────────────────────────────────────────────────────────

const BASE = '/api'
let csrfToken: string | null = null
let configPromise: Promise<AppConfig> | null = null

// ── Init ─────────────────────────────────────────────────────────

export async function initApi(): Promise<AppConfig> {
  if (!configPromise) {
    configPromise = api.get<AppConfig>('/config').then((cfg) => {
      csrfToken = cfg.csrfToken
      return cfg
    })
  }
  return configPromise
}

export function resetApi(): void {
  csrfToken = null
  configPromise = null
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Encode a repo file path for use in a URL.
 * Unlike encodeURIComponent, this preserves '/' so that paths like
 * `src/content/posts/my-post/index.md` stay as nested path segments
 * rather than becoming a single `%2F`-encoded path segment.
 * Individual segments are still encoded for safety.
 */
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

// ── Request helper ───────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (method !== 'GET' && method !== 'HEAD') {
    if (!csrfToken) {
      await initApi()
    }
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken
    }
  }

  const opts: RequestInit = {
    method,
    headers,
    credentials: 'same-origin',
  }
  if (body !== undefined) {
    opts.body = JSON.stringify(body)
  }

  const res = await fetch(`${BASE}${path}`, opts)
  const json: ApiEnvelope<T> = await res.json()

  if (!json.ok) {
    const err = new Error(json.error?.message || 'Request failed') as Error & {
      code: string
    }
    err.code = json.error?.code || 'UNKNOWN'
    throw err
  }

  return json.data as T
}

// ── File upload helper ────────────────────────────────────────────

async function uploadFile<T>(
  url: string,
  file: File,
  destDir?: string,
  naming?: string,
): Promise<T> {
  if (!csrfToken) {
    await initApi()
  }

  const formData = new FormData()
  formData.append('file', file)
  if (destDir) formData.append('destDir', destDir)
  if (naming) formData.append('naming', naming)

  const headers: Record<string, string> = {}
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    credentials: 'same-origin',
    body: formData,
  })

  const json: ApiEnvelope<T> = await res.json()

  if (!json.ok) {
    const err = new Error(json.error?.message || 'Upload failed') as Error & {
      code: string
    }
    err.code = json.error?.code || 'UNKNOWN'
    throw err
  }

  return json.data as T
}

// ── Public API ───────────────────────────────────────────────────

export const api = {
  get<T>(path: string) {
    return request<T>('GET', path)
  },
  post<T>(path: string, body?: unknown) {
    return request<T>('POST', path, body)
  },
  put<T>(path: string, body?: unknown) {
    return request<T>('PUT', path, body)
  },
  patch<T>(path: string, body?: unknown) {
    return request<T>('PATCH', path, body)
  },
  del<T>(path: string, body?: unknown) {
    return request<T>('DELETE', path, body)
  },

  // ── Auth ───────────────────────────────────────────────────────

  health() {
    return this.get<{ status: string; runtime: string; timestamp: string }>(
      '/health',
    )
  },

  login(token: string) {
    return this.post<{ user: UserInfo }>('/auth/login', { token })
  },

  logout() {
    return this.post<null>('/auth/logout').then(() => {
      resetApi()
    })
  },

  /** Get current user and selected repo (from JWT cookie) */
  user() {
    return this.get<{ user: UserInfo }>('/user')
  },

  // ── Repos ─────────────────────────────────────────────────────

  /** List repos with write access + current user info */
  listRepos() {
    return Promise.all([
      this.get<{ repos: RepoItem[] }>('/repos'),
      this.user(),
    ]).then(([reposData, userData]) => ({
      repos: reposData.repos,
      user: userData.user,
    }))
  },

  /** Select a repo and fetch its config */
  selectRepo(owner: string, name: string) {
    return this.post<{ repo: RepoItem; config: RepoConfig }>('/repo/select', {
      owner,
      name,
    })
  },

  /** Get the currently selected repo and config (from JWT session) */
  repoCurrent() {
    return this.get<{ repo: RepoItem; config: RepoConfig }>('/repo/current')
  },

  // ── Posts ──────────────────────────────────────────────────────

  /**
   * List posts with frontmatter summaries.
   * Supports filters: q, tag, category, page, pageSize.
   */
  listPosts(params?: {
    q?: string
    tag?: string
    category?: string
    page?: number
    pageSize?: number
  }) {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.tag) qs.set('tag', params.tag)
    if (params?.category) qs.set('category', params.category)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize))
    const query = qs.toString()
    return this.get<{
      posts: PostSummary[]
      page: number
      pageSize: number
      total: number
      totalPages: number
    }>(`/posts${query ? '?' + query : ''}`)
  },

  /** Get a single post with full content */
  getPost(path: string) {
    return this.get<{ post: Post }>(`/posts/${encodePath(path)}`)
  },

  /** Create a new post */
  createPost(params: {
    path: string
    mode?: 'md' | 'mdx'
    frontmatter?: Record<string, unknown>
    content?: string
    commitMessage?: string
  }) {
    return this.post<{ post: Post }>('/posts', params)
  },

  /** Update an existing post (requires sha for conflict detection) */
  updatePost(
    path: string,
    params: {
      sha: string
      frontmatter?: Record<string, unknown>
      content?: string
      commitMessage?: string
    },
  ) {
    return this.put<{ post: Post }>(
      `/posts/${encodePath(path)}`,
      params,
    )
  },

  /** Rename / move a post */
  movePost(
    oldPath: string,
    params: {
      newPath: string
      sha: string
      commitMessage?: string
    },
  ) {
    return this.patch<{ post: Post }>(
      `/posts/${encodePath(oldPath)}`,
      params,
    )
  },

  /** Delete a post */
  deletePost(path: string, params: { sha: string; commitMessage?: string }) {
    return this.del<{ deleted: string }>(
      `/posts/${encodePath(path)}`,
      params,
    )
  },

  // ── Media (assets) ────────────────────────────────────────────

  /**
   * Upload an image file via multipart/form-data.
   * @param file - The File object to upload
   * @param destDir - Optional destination directory
   * @param naming - Optional naming pattern
   */
  async uploadImage(
    file: File,
    destDir?: string,
    naming?: string,
  ): Promise<AssetUploadResult> {
    return uploadFile<AssetUploadResult>(`${BASE}/media`, file, destDir, naming)
  },

  /** List media files with optional prefix filtering */
  listMedia(params?: { prefix?: string; page?: number; pageSize?: number }) {
    const qs = new URLSearchParams()
    if (params?.prefix) qs.set('prefix', params.prefix)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize))
    const query = qs.toString()
    return this.get<{
      files: AssetItem[]
      page: number
      pageSize: number
      total: number
      totalPages: number
    }>(`/media${query ? '?' + query : ''}`)
  },

  // ── Config files ───────────────────────────────────────────────

  /** List config files in the selected repo */
  listConfigFiles() {
    return this.get<{ files: ConfigFileSummary[] }>('/config-files')
  },

  /** Get a single config file with full content and parsed data */
  getConfigFile(path: string) {
    return this.get<{ file: ConfigFile }>(
      `/config-files/${encodePath(path)}`,
    )
  },

  /** Update a config file (requires sha) */
  updateConfigFile(
    path: string,
    params: { sha: string; content: string; commitMessage?: string },
  ) {
    return this.put<{ file: ConfigFile }>(
      `/config-files/${encodePath(path)}`,
      params,
    )
  },
}

// ── Post types ──────────────────────────────────────────────────

export interface PostSummary {
  path: string
  name: string
  sha: string
  size: number
  ext: 'md' | 'mdx'
  frontmatter: {
    title?: string
    published?: string
    tags?: string[]
    category?: string
    abbrlink?: string
    draft?: boolean
  }
}

export interface Post extends PostSummary {
  content: string
  frontmatter: Record<string, unknown>
}

// ── Config file types ────────────────────────────────────────────

export interface ConfigFileSummary {
  path: string
  name: string
  sha: string
  type: 'json' | 'yaml' | 'toml' | 'text'
}

export interface ConfigFile {
  path: string
  sha: string
  content: string
  type: 'json' | 'yaml' | 'toml' | 'text'
  parsed: Record<string, unknown> | null
}

// ── Media types ──────────────────────────────────────────────────

export interface AssetItem {
  path: string
  name: string
  sha: string
  size: number
  url: string
}

export interface AssetUploadResult {
  path: string
  sha: string
  url: string
  size: number
}
