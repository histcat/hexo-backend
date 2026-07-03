<template>
  <div class="flex h-screen flex-col bg-white transition-colors dark:bg-gray-900">
    <!-- Top bar -->
    <header class="flex items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
      <button
        @click="goBack"
        class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        title="返回"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div class="min-w-0 flex-1">
        <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ fileName }}</span>
        <span class="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-500 dark:bg-gray-700 dark:text-gray-400">
          {{ file?.type.toUpperCase() || '...' }}
        </span>
      </div>

      <!-- Save state -->
      <span
        v-if="saveState === 'saving'"
        class="hidden text-xs text-blue-500 sm:inline"
      >保存中...</span>
      <span
        v-else-if="saveState === 'saved'"
        class="hidden text-xs text-green-600 dark:text-green-400 sm:inline"
      >✓ 已保存</span>
      <span
        v-else-if="saveState === 'error'"
        class="hidden text-xs text-red-500 sm:inline"
      >保存失败</span>
      <span
        v-else-if="isDirty"
        class="hidden text-xs text-amber-500 sm:inline"
      >未保存</span>

      <!-- Tab switcher -->
      <div
        v-if="hasParsed"
        class="flex rounded-lg border border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800"
      >
        <button
          @click="tab = 'code'"
          :class="[
            'rounded-lg px-3 py-1 text-xs font-medium transition',
            tab === 'code' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400',
          ]"
        >
          代码
        </button>
        <button
          @click="tab = 'form'"
          :class="[
            'rounded-lg px-3 py-1 text-xs font-medium transition',
            tab === 'form' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400',
          ]"
        >
          表单
        </button>
      </div>

      <DarkToggle />

      <button
        @click="doSave"
        :disabled="saving"
        class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 dark:bg-blue-500 dark:hover:bg-blue-600"
      >
        保存
      </button>
    </header>

    <!-- Error banner -->
    <div
      v-if="error"
      class="mx-4 mt-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
    >
      {{ error }}
      <button @click="error = ''" class="ml-2 underline">关闭</button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-1 items-center justify-center">
      <svg class="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>

    <!-- Editor body -->
    <div v-else class="flex min-h-0 flex-1 flex-col p-4">
      <!-- Code view -->
      <div v-show="tab === 'code'" class="flex min-h-0 flex-1 flex-col">
        <label class="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">直接编辑</label>
        <CodeEditor
          ref="codeEditorRef"
          v-model="content"
          :disabled="saving"
          placeholder="输入配置内容..."
          :spellcheck="false"
        />
      </div>

      <!-- Form view -->
      <div v-show="tab === 'form'" class="min-h-0 flex-1 overflow-y-auto">
        <label class="mb-2 block text-xs font-medium text-gray-500 dark:text-gray-400">结构化编辑</label>
        <div v-if="parsedData && tab === 'form'">
          <ConfigForm
            :modelValue="parsedData"
            @update:modelValue="onFormUpdate"
            :disabled="saving"
          />
        </div>
        <p v-else class="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
          此文件无法以表单形式编辑
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api, type ConfigFile } from '../api'
import CodeEditor from '../components/CodeEditor.vue'
import ConfigForm from '../components/ConfigForm.vue'
import DarkToggle from '../components/DarkToggle.vue'

const router = useRouter()
const route = useRoute()

// ── State ──────────────────────────────────────────────────────

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const saveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const tab = ref<'code' | 'form'>('code')
const content = ref('')
const file = ref<ConfigFile | null>(null)
const codeEditorRef = ref<InstanceType<typeof CodeEditor> | null>(null)

let originalSha = ''
let originalContent = ''

// ── Computed ───────────────────────────────────────────────────

const fileName = computed(() => {
  const path = (route.query.path as string) || ''
  return path.split('/').pop() || path
})

const hasParsed = computed(() => {
  return file.value?.parsed && typeof file.value.parsed === 'object'
})

const isDirty = computed(() => {
  return content.value !== originalContent
})

const parsedData = ref<Record<string, unknown>>({})

// Rebuild parsedData when switching to form view or when file loads
watch(
  [() => file.value?.parsed, tab],
  () => {
    if (file.value?.parsed && tab.value === 'form') {
      parsedData.value = JSON.parse(JSON.stringify(file.value.parsed))
    }
  },
  { immediate: true },
)

// ── Lifecycle ──────────────────────────────────────────────────

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)

  const filePath = route.query.path as string | undefined
  if (!filePath) {
    error.value = '未指定配置文件路径'
    loading.value = false
    return
  }

  try {
    const { file: f } = await api.getConfigFile(filePath)
    file.value = f
    content.value = f.content
    originalSha = f.sha
    originalContent = f.content

    if (f.parsed) {
      parsedData.value = JSON.parse(JSON.stringify(f.parsed))
    }
  } catch (e) {
    const err = e as Error & { code?: string }
    if (err.code === 'AUTH_REQUIRED') {
      router.replace('/login')
      return
    }
    if (err.code === 'NO_REPO_SELECTED') {
      router.replace('/repos')
      return
    }
    error.value = err.message || '加载配置文件失败'
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})

// ── Save ───────────────────────────────────────────────────────

async function doSave() {
  if (saving.value || !file.value) return

  saving.value = true
  saveState.value = 'saving'
  error.value = ''

  try {
    const result = await api.updateConfigFile(file.value.path, {
      sha: originalSha,
      content: content.value,
    })

    file.value = result.file
    originalSha = result.file.sha
    originalContent = result.file.content
    content.value = result.file.content

    if (result.file.parsed) {
      parsedData.value = JSON.parse(JSON.stringify(result.file.parsed))
    }

    saveState.value = 'saved'
    setTimeout(() => {
      if (saveState.value === 'saved') saveState.value = 'idle'
    }, 2000)
  } catch (e) {
    const err = e as Error & { code?: string }
    if (err.code === 'CONFLICT_SHA_MISMATCH') {
      error.value = '文件已被他人更新，请刷新页面后重新编辑。建议先复制本地修改再刷新。'
    } else {
      error.value = err.message || '保存失败'
    }
    saveState.value = 'error'
  } finally {
    saving.value = false
  }
}

// ── Form sync ──────────────────────────────────────────────────

function onFormUpdate(updated: Record<string, unknown>) {
  parsedData.value = updated

  // Serialize back to the appropriate format
  const ft = file.value?.type
  if (ft === 'json') {
    content.value = JSON.stringify(updated, null, 2) + '\n'
  } else if (ft === 'yaml') {
    content.value = serializeYaml(updated)
  } else {
    content.value = JSON.stringify(updated, null, 2) + '\n'
  }
}

/** Minimal YAML serializer for simple config objects */
function serializeYaml(obj: Record<string, unknown>, indent = ''): string {
  let out = ''
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      out += `${indent}${key}:\n`
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      out += `${indent}${key}: ${value}\n`
    } else if (typeof value === 'string') {
      const needsQuotes = value.includes(':') || value.includes('#') || value.includes('\n')
      if (needsQuotes) {
        out += `${indent}${key}: "${value.replace(/"/g, '\\"')}"\n`
      } else {
        out += `${indent}${key}: ${value}\n`
      }
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        out += `${indent}${key}: []\n`
      } else if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
        out += `${indent}${key}:\n`
        for (const item of value) {
          out += `${indent}  - ${item}\n`
        }
      } else {
        out += `${indent}${key}:\n`
        for (const item of value) {
          out += `${indent}  - ${JSON.stringify(item)}\n`
        }
      }
    } else if (typeof value === 'object') {
      out += `${indent}${key}:\n`
      out += serializeYaml(value as Record<string, unknown>, indent + '  ')
    }
  }
  return out
}

// ── Navigation ─────────────────────────────────────────────────

function goBack() {
  if (isDirty.value && !confirm('有未保存的修改，确定要离开吗？')) return
  router.back()
}

// ── Keyboard ───────────────────────────────────────────────────

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    doSave()
  }
}
</script>
