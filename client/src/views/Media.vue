<template>
  <div class="min-h-screen bg-gray-50 transition-colors dark:bg-gray-900">
    <!-- Header -->
    <header class="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div class="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <div>
          <h1 class="text-lg font-bold text-gray-900 dark:text-gray-100">资源管理</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">图片与媒体文件</p>
        </div>
        <div class="flex items-center gap-3">
          <DarkToggle />
          <button
            @click="router.push('/posts')"
            class="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            返回
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-4xl px-4 py-8">
      <!-- Upload area -->
      <div class="mb-6 rounded-xl border-2 border-dashed border-gray-300 bg-white p-6 dark:border-gray-600 dark:bg-gray-800">
        <div class="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
          <label
            class="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            选择图片
            <input
              type="file"
              accept="image/*"
              @change="onFileSelected"
              class="hidden"
              ref="fileInput"
              :disabled="uploading"
            />
          </label>
          <span class="text-xs text-gray-400 dark:text-gray-500">
            支持 PNG、JPEG、GIF、SVG、WebP（最大 10 MB）
          </span>
          <span v-if="uploading" class="text-sm text-blue-500">上传中...</span>
        </div>
        <!-- Upload progress -->
        <div v-if="uploadResult" class="mt-3 rounded-lg bg-green-50 px-4 py-2 dark:bg-green-900/30">
          <p class="text-sm text-green-700 dark:text-green-400">✓ 上传成功</p>
          <div class="mt-1 flex items-center gap-2">
            <input
              :value="uploadResult.url"
              readonly
              class="flex-1 truncate rounded border border-green-200 bg-white px-2 py-1 font-mono text-xs text-gray-600 dark:border-green-800 dark:bg-gray-700 dark:text-gray-300"
              @focus="onUrlFocus"
            />
            <button
              @click="copyUrl"
              class="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
            >
              {{ copied ? '已复制' : '复制' }}
            </button>
          </div>
        </div>
        <!-- Upload error -->
        <div v-if="uploadError" class="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {{ uploadError }}
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-12">
        <svg class="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>

      <!-- Error -->
      <div
        v-else-if="error"
        class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400"
      >
        {{ error }}
        <button @click="fetchMedia" class="ml-2 underline">重试</button>
      </div>

      <!-- Empty -->
      <div
        v-else-if="files.length === 0"
        class="py-12 text-center text-sm text-gray-400 dark:text-gray-500"
      >
        还没有上传的资源文件
      </div>

      <!-- File grid -->
      <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <div
          v-for="f in files"
          :key="f.path"
          class="group rounded-xl border border-gray-200 bg-white p-2 shadow-sm hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600 dark:shadow-gray-950/30"
        >
          <!-- Preview -->
          <div class="mb-2 flex h-32 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700">
            <img
              v-if="isImage(f.name)"
              :src="f.url"
              :alt="f.name"
              loading="lazy"
              class="h-full w-full object-cover"
              @error="($event.target as HTMLImageElement).style.display = 'none'"
            />
            <svg v-else class="h-10 w-10 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>

          <!-- Info -->
          <div class="min-w-0">
            <p class="truncate text-xs font-medium text-gray-700 dark:text-gray-300" :title="f.name">
              {{ f.name }}
            </p>
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ formatSize(f.size) }}</p>
          </div>

          <!-- Actions -->
          <button
            @click="copyFileUrl(f.url)"
            class="mt-1 w-full rounded bg-gray-100 py-1 text-xs text-gray-500 hover:bg-blue-100 hover:text-blue-700 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-400"
          >
            复制链接
          </button>
        </div>
      </div>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="mt-6 flex items-center justify-center gap-2"
      >
        <button
          @click="goPage(page - 1)"
          :disabled="page <= 1"
          class="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          上一页
        </button>
        <span class="text-sm text-gray-500 dark:text-gray-400">
          {{ page }} / {{ totalPages }}（共 {{ total }} 个文件）
        </span>
        <button
          @click="goPage(page + 1)"
          :disabled="page >= totalPages"
          class="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          下一页
        </button>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api, type AssetItem, type AssetUploadResult } from '../api'
import DarkToggle from '../components/DarkToggle.vue'

const router = useRouter()

// ── State ──────────────────────────────────────────────────────

const files = ref<AssetItem[]>([])
const loading = ref(true)
const error = ref('')
const page = ref(1)
const pageSize = 24
const total = ref(0)
const totalPages = ref(0)

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const uploadError = ref('')
const uploadResult = ref<AssetUploadResult | null>(null)
const copied = ref(false)

// ── Methods ────────────────────────────────────────────────────

function isImage(name: string): boolean {
  return /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i.test(name)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function fetchMedia() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.listMedia({ page: page.value, pageSize })
    files.value = data.files
    total.value = data.total
    totalPages.value = data.totalPages
  } catch (e) {
    if ((e as { code?: string }).code === 'NO_REPO_SELECTED') {
      router.replace('/repos')
      return
    }
    if ((e as { code?: string }).code === 'AUTH_REQUIRED') {
      router.replace('/login')
      return
    }
    error.value = e instanceof Error ? e.message : '加载资源列表失败'
  } finally {
    loading.value = false
  }
}

function goPage(p: number) {
  page.value = p
  fetchMedia()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploading.value = true
  uploadError.value = ''
  uploadResult.value = null

  try {
    const result = await api.uploadImage(file)
    uploadResult.value = result
    // Refresh the list
    await fetchMedia()
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : '上传失败'
  } finally {
    uploading.value = false
    // Clear the input so the same file can be re-selected
    if (fileInput.value) fileInput.value.value = ''
  }
}

function copyUrl() {
  if (!uploadResult.value) return
  navigator.clipboard.writeText(uploadResult.value.url).then(() => {
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  }).catch(() => {
    // Fallback: select the text
    // Already selected via @focus
  })
}

function copyFileUrl(url: string) {
  navigator.clipboard.writeText(url).catch(() => {
    /* ignore */
  })
}

function onUrlFocus(e: Event) {
  ;(e.target as HTMLInputElement).select()
}

onMounted(fetchMedia)
</script>
