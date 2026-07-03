import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import { routes } from './router'
import { draftStore } from './composables/useDraftStore'
import './style.css'

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const app = createApp(App)
app.use(router)
app.mount('#app')

// ── PWA: Register service worker ─────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (reg) => {
        console.log('[SW] Registered:', reg.scope)
      },
      (err) => {
        console.warn('[SW] Registration failed:', err)
      },
    )
  })
}

// ── Migrate localStorage drafts to IndexedDB ────────────────────

draftStore.migrateFromLocalStorage().then((count) => {
  if (count > 0) {
    console.log(`[DraftStore] Migrated ${count} draft(s) from localStorage to IndexedDB`)
  }
}).catch(() => {
  /* IndexedDB not available — drafts will use fallback */
})
