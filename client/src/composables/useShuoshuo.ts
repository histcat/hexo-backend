/**
 * 说说 (Shuoshuo) API client.
 *
 * Connects to the standalone talk-talk Worker (Cloudflare Workers + D1)
 * that stores talks and public replies. All responses use the envelope
 * { code: 0, data } / { error: "..." }.
 *
 * The Worker URL and admin session are kept in localStorage/sessionStorage
 * so the admin page survives reloads, exactly like the standalone
 * admin/index.html it replaces.
 */
import { ref } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

// ── Types (mirrors talk-talk API.md) ─────────────────────────────

export interface ShuoshuoListItem {
  id: number
  content: string
  reply_count: number
  created_at: string
  updated_at: string | null
  latest_reply: string | null
  latest_reply_nickname: string | null
  latest_reply_at: string | null
}

export interface Reply {
  id: number
  shuoshuo_id: number
  nickname: string
  content: string
  is_admin: 0 | 1
  created_at: string
}

export interface ShuoshuoDetail {
  id: number
  content: string
  reply_count: number
  created_at: string
  updated_at: string | null
  replies: Reply[]
}

export interface ShuoshuoListData {
  list: ShuoshuoListItem[]
  page: number
  pageSize: number
  total: number
  has_more: boolean
}

// ── Persistent state ─────────────────────────────────────────────

const BASE_KEY = 'shuoshuo_admin_base_url'
const TOKEN_KEY = 'shuoshuo_token'
const NICK_KEY = 'shuoshuo_admin_nickname'
const EMAIL_KEY = 'shuoshuo_admin_email'

function load(key: string): string {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function loadSession(key: string): string {
  try {
    return sessionStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

// 默认指向部署好的说说服务；仍可在页面里修改并保存（localStorage 优先）。
const baseUrl = ref(
  load(BASE_KEY) || import.meta.env.VITE_SHUOSHUO_URL || 'https://talktalkend.histcat.top',
)
const token = ref(loadSession(TOKEN_KEY))
const adminNickname = ref(load(NICK_KEY) || '博主')
const adminEmail = ref(load(EMAIL_KEY) || 'admin@example.com')

const loggedIn = ref(!!token.value)

// ── Error / helpers ──────────────────────────────────────────────

export class ShuoshuoError extends Error {}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

function setToken(value: string): void {
  token.value = value
  loggedIn.value = !!value
  try {
    if (value) sessionStorage.setItem(TOKEN_KEY, value)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  auth = false,
): Promise<T> {
  const base = baseUrl.value.trim().replace(/\/+$/, '')
  if (!base) throw new ShuoshuoError('请先填写 Worker 地址')

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) {
    if (!token.value) throw new ShuoshuoError('尚未登录（缺少管理员 token）')
    headers.Authorization = `Bearer ${token.value}`
  }

  let res: Response
  try {
    res = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ShuoshuoError('网络错误，无法连接 Worker，请检查地址')
  }

  let data: { code?: number; data?: T; error?: string } | null = null
  try {
    const parsed = (await res.json()) as { code?: number; data?: T; error?: string }
    data = parsed
  } catch {
    /* non-JSON response */
  }

  if (!res.ok || !data || data.code !== 0) {
    if (res.status === 401) setToken('')
    throw new ShuoshuoError((data && data.error) || `HTTP ${res.status}`)
  }
  return data.data as T
}

// ── Exposed API ──────────────────────────────────────────────────

export function useShuoshuo() {
  function testConnection(): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>('GET', '/api/health')
  }

  async function login(password: string): Promise<void> {
    const data = await request<{ token: string }>('POST', '/api/auth', { password })
    setToken(data.token)
  }

  function logout(): void {
    setToken('')
  }

  function listTalks(page: number, pageSize: number): Promise<ShuoshuoListData> {
    return request<ShuoshuoListData>(
      'GET',
      `/api/shuoshuo?page=${page}&pageSize=${pageSize}`,
    )
  }

  function getTalk(id: number): Promise<ShuoshuoDetail> {
    return request<ShuoshuoDetail>('GET', `/api/shuoshuo/${id}`)
  }

  function createTalk(content: string): Promise<ShuoshuoListItem> {
    return request<ShuoshuoListItem>('POST', '/api/shuoshuo', { content }, true)
  }

  function deleteTalk(id: number): Promise<{ deleted: boolean }> {
    return request<{ deleted: boolean }>('DELETE', `/api/shuoshuo/${id}`, undefined, true)
  }

  function createReply(
    id: number,
    payload: { nickname: string; email: string; content: string },
  ): Promise<Reply> {
    return request<Reply>('POST', `/api/shuoshuo/${id}/replies`, payload, true)
  }

  function deleteReply(id: number): Promise<{ deleted: boolean }> {
    return request<{ deleted: boolean }>('DELETE', `/api/replies/${id}`, undefined, true)
  }

  return {
    baseUrl,
    token,
    loggedIn,
    adminNickname,
    adminEmail,
    testConnection,
    login,
    logout,
    listTalks,
    getTalk,
    createTalk,
    deleteTalk,
    createReply,
    deleteReply,
    saveBaseUrl: (v: string) => {
      baseUrl.value = v
      save(BASE_KEY, v)
    },
    saveNickname: (v: string) => {
      adminNickname.value = v
      save(NICK_KEY, v)
    },
    saveEmail: (v: string) => {
      adminEmail.value = v
      save(EMAIL_KEY, v)
    },
  }
}

// ── Markdown rendering (sanitized) ───────────────────────────────

export function renderMarkdown(text: string): string {
  if (!text) return ''
  try {
    const html = marked.parse(text) as string
    return DOMPurify.sanitize(html)
  } catch {
    return '<p class="text-red-500">Markdown 解析错误</p>'
  }
}

export function escapeHtml(text: string): string {
  return String(text).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )
}

/** Worker 返回 UTC "YYYY-MM-DD HH:MM:SS"，转本地时间展示。 */
export function fmtShuoshuoTime(value: string | null | undefined): string {
  if (!value) return ''
  try {
    return new Date(String(value).replace(' ', 'T') + 'Z').toLocaleString('zh-CN', {
      hour12: false,
    })
  } catch {
    return value || ''
  }
}
