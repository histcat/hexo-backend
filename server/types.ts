// ── Hono Context variable augmentation ──────────────────────────

declare module 'hono' {
  interface ContextVariableMap {
    session: import('./types.ts').Session
  }
}

// ── API Response envelope ─────────────────────────────────────

export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

// ── Session / JWT ─────────────────────────────────────────────

/** JWT payload stored in HttpOnly cookie */
export interface SessionPayload {
  sub: number          // GitHub user id
  login: string        // GitHub username
  name: string
  avatarUrl: string
  encryptedToken: string // GitHub PAT encrypted with JWT_SECRET
  iat: number
  exp: number
}

/** Session attached to Hono context after successful auth */
export interface Session {
  sub: number
  login: string
  name: string
  avatarUrl: string
  /** Decrypted GitHub PAT */
  githubToken: string
  /** Encrypted GitHub PAT (for JWT re-signing) */
  encryptedToken: string
  /** Selected repo info (set after /api/repo/select) */
  selectedRepo?: {
    owner: string
    name: string
    defaultBranch: string
  }
  /** Parsed repo config (set after /api/repo/select) */
  repoConfig?: RepoConfig
}

/** User profile returned to the frontend (no token!) */
export interface UserInfo {
  id: number
  login: string
  name: string
  avatarUrl: string
}

// ── Domain entities ───────────────────────────────────────────

export interface RepoRef {
  owner: string
  name: string
  defaultBranch: string
  description?: string | null
  updatedAt?: string
  permissions?: {
    admin: boolean
    push: boolean
    pull: boolean
  }
}

/** A single frontmatter field definition from .astro-editor.yml */
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
  /** Frontmatter form field definitions */
  frontmatterFields: FrontmatterField[]
  /** Required field keys */
  frontmatterRequired: string[]
  /** Default values for new posts */
  frontmatterDefaults: Record<string, unknown>
}

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

/** Lightweight summary for config file list */
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

export interface Asset {
  path: string
  sha: string
  size: number
  url: string
}
