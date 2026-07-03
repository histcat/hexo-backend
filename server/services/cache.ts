/**
 * Simple TTL (Time-To-Live) in-memory cache.
 *
 * Used for caching expensive GitHub API results within a single
 * Deno Deploy isolate lifetime. Cache is cleared on cold start.
 *
 * Typical TTLs:
 * - Repo tree: 3 minutes
 * - Post list with summaries: 5 minutes
 * - Repo config (.astro-editor.yml): 10 minutes
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

/** Periodic cleanup of expired entries */
let cleanupTimer: ReturnType<typeof setInterval> | null = null

function ensureCleanup(): void {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) store.delete(key)
    }
  }, 60_000) // Every minute
}

export const cache = {
  /**
   * Get a cached value. Returns undefined if missing or expired.
   */
  get<T>(key: string): T | undefined {
    const entry = store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      store.delete(key)
      return undefined
    }
    return entry.data as T
  },

  /**
   * Set a cached value with TTL in milliseconds.
   */
  set<T>(key: string, data: T, ttlMs: number): void {
    ensureCleanup()
    store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    })
  },

  /**
   * Delete a specific key.
   */
  delete(key: string): void {
    store.delete(key)
  },

  /**
   * Invalidate all keys matching a prefix.
   */
  invalidatePrefix(prefix: string): void {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key)
    }
  },

  /**
   * Clear all cached data.
   */
  clear(): void {
    store.clear()
  },

  /** Number of entries in cache (for debugging) */
  get size(): number {
    return store.size
  },
}
