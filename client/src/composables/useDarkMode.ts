import { ref, watch } from 'vue'

const STORAGE_KEY = 'hexo-editor:dark-mode'

// Read initial state from localStorage or system preference
function getInitial(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) return stored === 'true'
  } catch {
    // localStorage unavailable
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

const isDark = ref(getInitial())

// Apply dark class to <html> on init
if (isDark.value) {
  document.documentElement.classList.add('dark')
} else {
  document.documentElement.classList.remove('dark')
}

// Watch for changes
watch(isDark, (val) => {
  if (val) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  try {
    localStorage.setItem(STORAGE_KEY, String(val))
  } catch {
    // ignore
  }
})

// Listen for system preference changes
const mq = window.matchMedia('(prefers-color-scheme: dark)')
mq.addEventListener('change', (e) => {
  // Only auto-switch if user hasn't manually set a preference
  try {
    if (localStorage.getItem(STORAGE_KEY) === null) {
      isDark.value = e.matches
    }
  } catch {
    isDark.value = e.matches
  }
})

export function useDarkMode() {
  function toggle() {
    isDark.value = !isDark.value
  }

  return {
    isDark,
    toggle,
  }
}
