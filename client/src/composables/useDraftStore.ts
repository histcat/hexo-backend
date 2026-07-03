/**
 * IndexedDB-backed draft store for offline editing.
 *
 * Replaces localStorage with a structured async store that:
 * - Survives larger drafts (IndexedDB has no 5-10 MB limit like localStorage)
 * - Supports listing all saved drafts
 * - Migrates existing localStorage drafts on first use
 */

const DB_NAME = 'hexo-editor'
const DB_VERSION = 1
const STORE_NAME = 'drafts'

export interface DraftEntry {
  /** Draft key (e.g. "hexo:draft:new" or "hexo:draft:src/content/posts/...") */
  key: string
  /** Serialized draft data */
  data: string
  /** ISO timestamp of last save */
  savedAt: string
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      dbPromise = null
      reject(request.error)
    }
  })

  return dbPromise
}

function withStore(
  mode: IDBTransactionMode,
): Promise<IDBObjectStore> {
  return openDB().then((db) => {
    const tx = db.transaction(STORE_NAME, mode)
    return tx.objectStore(STORE_NAME)
  })
}

// ── Public API ────────────────────────────────────────────────────

export const draftStore = {
  /** Save a draft (upsert) */
  async save(key: string, data: Record<string, unknown>): Promise<void> {
    const store = await withStore('readwrite')
    const entry: DraftEntry = {
      key,
      data: JSON.stringify(data),
      savedAt: new Date().toISOString(),
    }
    return new Promise((resolve, reject) => {
      const req = store.put(entry)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  },

  /** Load a draft by key */
  async load(key: string): Promise<Record<string, unknown> | null> {
    const store = await withStore('readonly')
    return new Promise((resolve, reject) => {
      const req = store.get(key)
      req.onsuccess = () => {
        const entry = req.result as DraftEntry | undefined
        if (!entry) return resolve(null)
        try {
          resolve(JSON.parse(entry.data))
        } catch {
          resolve(null)
        }
      }
      req.onerror = () => reject(req.error)
    })
  },

  /** Delete a draft by key */
  async delete(key: string): Promise<void> {
    const store = await withStore('readwrite')
    return new Promise((resolve, reject) => {
      const req = store.delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  },

  /** List all saved drafts */
  async list(): Promise<DraftEntry[]> {
    const store = await withStore('readonly')
    return new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result as DraftEntry[])
      req.onerror = () => reject(req.error)
    })
  },

  /**
   * One-time migration from localStorage to IndexedDB.
   * Call once on app startup. Existing localStorage keys matching
   * the hexo:draft:* prefix are moved to IndexedDB and removed from localStorage.
   */
  async migrateFromLocalStorage(): Promise<number> {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('hexo:draft:')) {
        keys.push(key)
      }
    }

    if (keys.length === 0) return 0

    let migrated = 0
    for (const key of keys) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        const data = JSON.parse(raw)
        await this.save(key, data)
        localStorage.removeItem(key)
        migrated++
      } catch {
        // Corrupted data — remove it
        localStorage.removeItem(key)
      }
    }

    return migrated
  },
}
