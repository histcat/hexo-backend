<template>
  <div
    class="flex min-h-screen items-center justify-center bg-gray-50 px-4 transition-colors dark:bg-gray-900"
  >
    <div class="w-full max-w-sm">
      <div
        class="rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800 dark:shadow-gray-950/50"
      >
        <h1
          class="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100"
        >
          hexo-backend
        </h1>
        <p class="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
          在线管理你的 Astro 博客
        </p>

        <form class="mt-6 space-y-4" @submit.prevent="login">
          <div>
            <label
              for="token"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              GitHub Token
            </label>
            <input
              id="token"
              v-model="token"
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              :disabled="loading"
              class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
            />
            <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
              需要
              <code class="rounded bg-gray-100 px-1 dark:bg-gray-700 dark:text-gray-300">repo</code>
              权限。Token 仅存储在服务端，前端不可见。
            </p>
          </div>

          <button
            type="submit"
            :disabled="!token || loading"
            class="flex w-full items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
          >
            <svg
              v-if="loading"
              class="-ml-1 mr-2 h-4 w-4 animate-spin"
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
            {{ loading ? '正在登录...' : '登录' }}
          </button>
        </form>

        <p
          v-if="error"
          class="mt-4 rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400"
        >
          {{ error }}
        </p>

        <p class="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          登录即表示你信任此服务使用你的 GitHub Token 进行仓库读写操作。
          <br />
          可随时在
          <a
            href="https://github.com/settings/tokens"
            target="_blank"
            rel="noopener"
            class="underline"
          >
            GitHub 设置
          </a>
          中撤销。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, initApi } from '../api'

const router = useRouter()
const token = ref('')
const error = ref('')
const loading = ref(false)

async function login() {
  if (!token.value.trim()) return

  error.value = ''
  loading.value = true

  try {
    // Bootstrap CSRF token before login
    await initApi()
    await api.login(token.value.trim())
    // Clear token from memory immediately
    token.value = ''
    router.replace('/repos')
  } catch (e) {
    if (e instanceof Error) {
      error.value = e.message
    } else {
      error.value = '登录失败，请稍后重试'
    }
  } finally {
    loading.value = false
  }
}
</script>
