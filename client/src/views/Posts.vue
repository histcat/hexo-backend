<template>
  <div class="min-h-screen bg-gray-50 transition-colors dark:bg-gray-900">
    <!-- Header -->
    <header class="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div
        class="mx-auto flex max-w-4xl items-center justify-between px-4 py-4"
      >
        <div>
          <h1 class="text-lg font-bold text-gray-900 dark:text-gray-100">文章列表</h1>
          <p v-if="user" class="text-sm text-gray-500 dark:text-gray-400">
            {{ user.login }}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <button
            @click="newPost"
            class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            新建文章
          </button>
          <button
            @click="router.push('/media')"
            class="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            资源
          </button>
          <button
            @click="refresh"
            class="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            :disabled="loading"
          >
            刷新
          </button>
          <DarkToggle />
          <button
            @click="doLogout"
            class="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            退出
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-4xl px-4 py-8">
      <!-- Tab switcher -->
      <div class="mb-6 flex rounded-lg border border-gray-300 bg-gray-50 p-0.5 dark:border-gray-600 dark:bg-gray-800">
        <button
          @click="activeTab = 'posts'"
          :class="[
            'flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition',
            activeTab === 'posts'
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
          ]"
        >
          文章
        </button>
        <button
          @click="activeTab = 'config'"
          :class="[
            'flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition',
            activeTab === 'config'
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
          ]"
        >
          配置文件
        </button>
      </div>

      <!-- Search & Filters (posts only) -->
      <div v-if="activeTab === 'posts'" class="mb-6 space-y-4">
        <div class="relative">
          <svg
            class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            v-model="search"
            @input="onSearchInput"
            placeholder="搜索文章标题..."
            class="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
          />
        </div>

        <!-- Tag filters -->
        <div v-if="allTags.length > 0" class="flex flex-wrap gap-2">
          <button
            v-for="tag in allTags"
            :key="tag"
            @click="toggleTag(tag)"
            :class="[
              'rounded-full px-3 py-1 text-xs font-medium transition',
              selectedTag === tag
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600',
            ]"
          >
            {{ tag }}
          </button>
        </div>

        <!-- Category filters -->
        <div v-if="allCategories.length > 0" class="flex flex-wrap gap-2">
          <span class="mr-1 self-center text-xs font-medium text-gray-400 dark:text-gray-500">
            分类:
          </span>
          <button
            @click="selectedCategory = ''"
            :class="[
              'rounded-full px-3 py-1 text-xs font-medium transition',
              !selectedCategory
                ? 'bg-green-600 text-white dark:bg-green-500'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600',
            ]"
          >
            全部
          </button>
          <button
            v-for="cat in allCategories"
            :key="cat"
            @click="selectedCategory = cat"
            :class="[
              'rounded-full px-3 py-1 text-xs font-medium transition',
              selectedCategory === cat
                ? 'bg-green-600 text-white dark:bg-green-500'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600',
            ]"
          >
            {{ cat }}
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-12">
        <svg
          class="h-8 w-8 animate-spin text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>

      <!-- Error -->
      <div
        v-else-if="error"
        class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400"
      >
        {{ error }}
        <button @click="refresh" class="ml-2 underline">重试</button>
      </div>

      <!-- Empty (posts) -->
      <div
        v-else-if="activeTab === 'posts' && posts.length === 0"
        class="py-12 text-center text-gray-500 dark:text-gray-400"
      >
        <p v-if="hasFilter">
          没有匹配的文章，
          <button @click="clearFilters" class="underline">清除筛选</button>
        </p>
        <p v-else>还没有文章。创建第一篇博文开始写作吧。</p>
      </div>

      <!-- Post list -->
      <ul v-else-if="activeTab === 'posts'" class="space-y-3">
        <li v-for="post in posts" :key="post.path">
          <button
            @click="openPost(post.path)"
            class="flex w-full items-start gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600 dark:shadow-gray-950/30"
          >
            <div class="min-w-0 flex-1">
              <div class="truncate font-medium text-gray-900 dark:text-gray-100">
                {{ post.frontmatter.title || post.name }}
              </div>
              <div
                class="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400 dark:text-gray-500"
              >
                <span v-if="post.frontmatter.published">
                  {{ formatDate(post.frontmatter.published) }}
                </span>
                <span
                  v-if="post.frontmatter.category"
                  class="rounded bg-green-50 px-1.5 py-0.5 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                >
                  {{ post.frontmatter.category }}
                </span>
                <span
                  v-for="tag in post.frontmatter.tags"
                  :key="tag"
                  class="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                >
                  {{ tag }}
                </span>
                <span
                  v-if="post.frontmatter.draft"
                  class="rounded bg-yellow-50 px-1.5 py-0.5 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
                >
                  草稿
                </span>
              </div>
            </div>
            <div
              class="flex shrink-0 flex-col items-end gap-1 text-xs text-gray-400 dark:text-gray-500"
            >
              <span>{{ post.ext.toUpperCase() }}</span>
              <span class="max-w-[120px] truncate">{{ post.path }}</span>
            </div>
          </button>
        </li>
      </ul>

      <!-- Pagination (posts) -->
      <div
        v-if="activeTab === 'posts' && totalPages > 1"
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
          {{ page }} / {{ totalPages }}（共 {{ total }} 篇）
        </span>
        <button
          @click="goPage(page + 1)"
          :disabled="page >= totalPages"
          class="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          下一页
        </button>
      </div>

      <!-- Config files list -->
      <div v-if="activeTab === 'config'">
        <!-- Config loading -->
        <div v-if="configLoading" class="flex justify-center py-12">
          <svg class="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>

        <!-- Config error -->
        <div
          v-else-if="configError"
          class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400"
        >
          {{ configError }}
          <button @click="fetchConfigFiles" class="ml-2 underline">重试</button>
        </div>

        <!-- Config empty -->
        <div
          v-else-if="configFiles.length === 0"
          class="py-12 text-center text-gray-500 dark:text-gray-400"
        >
          未发现配置文件
        </div>

        <!-- Config file list -->
        <ul v-else class="space-y-2">
          <li v-for="cf in configFiles" :key="cf.path">
            <button
              @click="openConfigFile(cf.path)"
              class="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-purple-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-purple-600 dark:shadow-gray-950/30"
            >
              <!-- Type icon -->
              <span
                :class="[
                  'rounded px-1.5 py-0.5 text-xs font-mono font-bold',
                  cf.type === 'json'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                    : cf.type === 'yaml'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                      : cf.type === 'toml'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
                ]"
              >
                {{ cf.type.toUpperCase() }}
              </span>

              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {{ cf.name }}
                </div>
                <div class="truncate text-xs text-gray-400 dark:text-gray-500">
                  {{ cf.path }}
                </div>
              </div>

              <svg class="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </li>
        </ul>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api, type PostSummary, type UserInfo, type ConfigFileSummary } from '../api'
import DarkToggle from '../components/DarkToggle.vue'

const router = useRouter()

// ── State ──────────────────────────────────────────────────────

const activeTab = ref<'posts' | 'config'>('posts')
const user = ref<UserInfo | null>(null)
const posts = ref<PostSummary[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const selectedTag = ref('')
const selectedCategory = ref('')
const page = ref(1)
const pageSize = 20
const total = ref(0)
const totalPages = ref(0)

// Config files state
const configFiles = ref<ConfigFileSummary[]>([])
const configLoading = ref(false)
const configError = ref('')

let searchTimer: ReturnType<typeof setTimeout> | null = null

// ── Computed ───────────────────────────────────────────────────

const hasFilter = computed(
  () => !!(search.value || selectedTag.value || selectedCategory.value),
)

const allTags = computed(() => {
  const tags = new Set<string>()
  for (const p of posts.value) {
    for (const t of p.frontmatter.tags || []) tags.add(t)
  }
  return [...tags].sort()
})

const allCategories = computed(() => {
  const cats = new Set<string>()
  for (const p of posts.value) {
    if (p.frontmatter.category) cats.add(p.frontmatter.category)
  }
  return [...cats].sort()
})

// ── Methods ────────────────────────────────────────────────────

async function fetchPosts() {
  loading.value = true
  error.value = ''
  try {
    try {
      const userData = await api.user()
      user.value = userData.user
    } catch {
      router.replace('/login')
      return
    }

    const data = await api.listPosts({
      q: search.value || undefined,
      tag: selectedTag.value || undefined,
      category: selectedCategory.value || undefined,
      page: page.value,
      pageSize,
    })
    posts.value = data.posts
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
    error.value = e instanceof Error ? e.message : '加载文章列表失败'
  } finally {
    loading.value = false
  }
}

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    fetchPosts()
  }, 300)
}

function toggleTag(tag: string) {
  selectedTag.value = selectedTag.value === tag ? '' : tag
  page.value = 1
  fetchPosts()
}

function clearFilters() {
  search.value = ''
  selectedTag.value = ''
  selectedCategory.value = ''
  page.value = 1
  fetchPosts()
}

function goPage(p: number) {
  page.value = p
  fetchPosts()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function newPost() {
  router.push('/editor?new=true')
}

function openPost(postPath: string) {
  router.push(`/editor?path=${encodeURIComponent(postPath)}`)
}

function openConfigFile(cfPath: string) {
  router.push(`/config-editor?path=${encodeURIComponent(cfPath)}`)
}

function refresh() {
  if (activeTab.value === 'posts') {
    fetchPosts()
  } else {
    fetchConfigFiles()
  }
}

async function fetchConfigFiles() {
  configLoading.value = true
  configError.value = ''
  try {
    const data = await api.listConfigFiles()
    configFiles.value = data.files
  } catch (e) {
    if ((e as { code?: string }).code === 'NO_REPO_SELECTED') {
      router.replace('/repos')
      return
    }
    if ((e as { code?: string }).code === 'AUTH_REQUIRED') {
      router.replace('/login')
      return
    }
    configError.value = e instanceof Error ? e.message : '加载配置文件列表失败'
  } finally {
    configLoading.value = false
  }
}

async function doLogout() {
  try { await api.logout() } catch { /* ignore */ }
  router.replace('/login')
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return iso
  }
}

watch(selectedCategory, () => {
  page.value = 1
  fetchPosts()
})

watch(activeTab, (tab) => {
  if (tab === 'config' && configFiles.value.length === 0 && !configLoading.value) {
    fetchConfigFiles()
  }
})

onMounted(fetchPosts)
</script>
