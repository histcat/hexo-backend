<template>
  <div class="min-h-screen bg-gray-50 transition-colors dark:bg-gray-900">
    <header class="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div class="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <div>
          <h1 class="text-lg font-bold text-gray-900 dark:text-gray-100">hexo-backend</h1>
          <p v-if="user" class="text-sm text-gray-500 dark:text-gray-400">
            {{ user.login }}
          </p>
        </div>
        <div class="flex items-center gap-3">
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
      <div class="mb-6">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">选择仓库</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          选择一个你有写权限的仓库开始编辑
        </p>
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
        <button @click="fetchRepos" class="ml-2 underline">重试</button>
      </div>

      <!-- Empty -->
      <div
        v-else-if="repos.length === 0"
        class="py-12 text-center text-gray-500 dark:text-gray-400"
      >
        <p>没有找到你有写权限的仓库</p>
        <p class="mt-1 text-sm">
          请在 GitHub 上创建一个仓库，并确保你的 Token 有
          <code class="rounded bg-gray-100 px-1 dark:bg-gray-700 dark:text-gray-300">repo</code>
          权限
        </p>
      </div>

      <!-- Repo list -->
      <ul v-else class="space-y-3">
        <li v-for="repo in repos" :key="repo.owner + '/' + repo.name">
          <button
            @click="select(repo)"
            :disabled="selecting === repo.owner + '/' + repo.name"
            class="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600 dark:shadow-gray-950/30"
          >
            <div>
              <div class="font-medium text-gray-900 dark:text-gray-100">
                {{ repo.owner }} /
                <span class="font-semibold">{{ repo.name }}</span>
              </div>
              <div class="mt-1 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                <span>{{ repo.defaultBranch }}</span>
                <span v-if="repo.description" class="truncate max-w-xs">
                  {{ repo.description }}
                </span>
              </div>
            </div>
            <svg
              v-if="selecting === repo.owner + '/' + repo.name"
              class="h-4 w-4 animate-spin text-blue-500"
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
            <svg
              v-else
              class="h-4 w-4 text-gray-300 dark:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </li>
      </ul>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api, type UserInfo } from '../api'
import DarkToggle from '../components/DarkToggle.vue'

interface RepoItem {
  owner: string
  name: string
  defaultBranch: string
  description?: string | null
  updatedAt?: string
  permissions: { admin: boolean; push: boolean; pull: boolean }
}

const router = useRouter()
const user = ref<UserInfo | null>(null)
const repos = ref<RepoItem[]>([])
const loading = ref(true)
const error = ref('')
const selecting = ref('')

async function fetchRepos() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.listRepos()
    repos.value = data.repos
    user.value = data.user
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载仓库列表失败'
  } finally {
    loading.value = false
  }
}

async function select(repo: RepoItem) {
  selecting.value = repo.owner + '/' + repo.name
  error.value = ''
  try {
    await api.selectRepo(repo.owner, repo.name)
    router.replace('/posts')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '选择仓库失败'
  } finally {
    selecting.value = ''
  }
}

async function doLogout() {
  try {
    await api.logout()
  } catch {
    // ignore
  }
  router.replace('/login')
}

onMounted(fetchRepos)
</script>
