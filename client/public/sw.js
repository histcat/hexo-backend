/**
 * Service Worker for hexo-backend PWA.
 *
 * Strategy:
 * - Static assets (JS, CSS, fonts, images): Cache-first with background update
 * - HTML (app shell): Network-first, fall back to cache
 * - API calls: Network-only (we don't cache API responses)
 */

const CACHE_NAME = 'hexo-editor-v1'
const STATIC_CACHE = 'hexo-static-v1'

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
]

// ── Install: pre-cache app shell ──────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS)
    }).then(() => {
      // @ts-ignore: skipWaiting is available in SW context
      return self.skipWaiting()
    }),
  )
})

// ── Activate: clean old caches ────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map((key) => caches.delete(key)),
      )
    }).then(() => {
      // @ts-ignore: clients.claim is available in SW context
      return self.clients.claim()
    }),
  )
})

// ── Fetch: route by request type ──────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // API calls: network-only
  if (url.pathname.startsWith('/api/')) {
    return // Let the default (network) handle it
  }

  // Static assets (JS, CSS, fonts, images): cache-first
  if (
    url.pathname.match(/\.(js|css|woff2?|png|jpe?g|gif|svg|ico)$/i)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(event.request, clone)
            })
          }
          return response
        })
        return cached || fetchPromise
      }),
    )
    return
  }

  // HTML / navigation: network-first, fall back to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone()
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(event.request, clone)
          })
          return response
        })
        .catch(() => {
          return caches.match(event.request)
        }),
    )
  }
})
