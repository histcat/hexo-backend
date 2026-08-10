<template>
  <div class="min-h-screen bg-gray-50 transition-colors dark:bg-gray-900">
    <!-- Header -->
    <header class="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div class="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
        <div>
          <h1 class="text-lg font-bold text-gray-900 dark:text-gray-100">说说管理</h1>
          <p v-if="user" class="text-sm text-gray-500 dark:text-gray-400">{{ user.login }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            @click="router.push('/posts')"
            class="rounded-lg px-2.5 py-1 text-sm text-gray-600 hover:bg-gray-100 sm:px-3 sm:py-1.5 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            文章
          </button>
          <button
            @click="router.push('/media')"
            class="rounded-lg px-2.5 py-1 text-sm text-gray-600 hover:bg-gray-100 sm:px-3 sm:py-1.5 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            资源
          </button>
          <DarkToggle />
          <button
            @click="doLogout"
            class="rounded-lg px-2.5 py-1 text-sm text-gray-600 hover:bg-gray-100 sm:px-3 sm:py-1.5 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            退出
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-4xl px-4 py-8">
      <!-- 连接 Worker -->
      <section
        class="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <h2 class="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          连接说说服务（Cloudflare Worker）
        </h2>
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="workerBaseUrl"
            type="text"
            placeholder="Worker 地址，如 https://shuoshuo-worker.xxx.workers.dev"
            class="min-w-[220px] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            @keydown.enter="testConnection"
          />
          <button
            @click="testConnection"
            class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            :disabled="testing"
          >
            测试连接
          </button>
        </div>
        <p
          v-if="connStatus"
          class="mt-2 text-xs"
          :class="connOk ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
        >
          {{ connStatus }}
        </p>
      </section>

      <!-- 管理员登录 -->
      <section
        class="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <h2 class="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">管理员登录</h2>
        <div v-if="!worker.loggedIn.value" class="flex flex-wrap items-center gap-2">
          <input
            v-model="password"
            type="password"
            placeholder="管理员密码"
            class="min-w-[180px] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            @keydown.enter="doLogin"
          />
          <button
            @click="doLogin"
            class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            :disabled="loggingIn"
          >
            登录
          </button>
        </div>
        <div v-else class="flex flex-wrap items-center gap-3">
          <span class="text-sm text-green-600 dark:text-green-400">
            已登录：可以发布、删除、以博主身份回复
          </span>
          <button
            @click="worker.logout()"
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:border-blue-500 hover:text-blue-600 dark:border-gray-600 dark:text-gray-400 dark:hover:text-blue-400"
          >
            退出登录
          </button>
        </div>
        <p class="mt-2 text-xs text-gray-400 dark:text-gray-500">
          密码不会保存；登录后仅在当前标签页保留 24 小时有效的 token（sessionStorage）。
        </p>
      </section>

      <!-- 发布新说说（管理员） -->
      <section
        v-if="worker.loggedIn.value"
        class="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <h2 class="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">发布新说说</h2>
        <textarea
          v-model="newContent"
          rows="4"
          placeholder="支持 Markdown，例如：**今天**天气不错～ 图片直接贴 URL：![](https://example.com/a.png)"
          class="mb-2 w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
        ></textarea>
        <div class="flex flex-wrap items-center gap-2">
          <button
            @click="previewOpen = !previewOpen"
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:border-blue-500 hover:text-blue-600 dark:border-gray-600 dark:text-gray-400 dark:hover:text-blue-400"
          >
            {{ previewOpen ? '收起预览' : '预览' }}
          </button>
          <button
            @click="publish"
            class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            :disabled="publishing"
          >
            发布
          </button>
        </div>
        <div
          v-if="previewOpen"
          class="prose prose-sm dark:prose-invert mt-3 max-w-none rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-sm dark:border-gray-600 dark:bg-gray-900/40"
          v-html="renderMarkdown(newContent)"
        ></div>
      </section>

      <!-- 说说列表 -->
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">全部说说</h2>
        <button
          @click="refresh"
          class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:border-blue-500 hover:text-blue-600 dark:border-gray-600 dark:text-gray-400 dark:hover:text-blue-400"
          :disabled="loading"
        >
          刷新列表
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-12">
        <svg class="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
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

      <!-- Empty -->
      <div v-else-if="list.length === 0" class="py-12 text-center text-gray-500 dark:text-gray-400">
        还没有说说，登录后在上方发布第一条吧～
      </div>

      <!-- List -->
      <div v-else class="space-y-3">
        <article
          v-for="item in list"
          :key="item.id"
          class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <div
            class="prose prose-sm dark:prose-invert max-w-none break-words prose-img:rounded-lg"
            v-html="renderMarkdown(item.content)"
          ></div>
          <div
            class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-gray-500"
          >
            <span>#{{ item.id }}</span>
            <span>{{ fmtTime(item.created_at) }}</span>
            <span>回复 {{ item.reply_count }}</span>
            <span class="flex-1"></span>
            <button
              @click="toggleReplies(item.id)"
              class="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:border-blue-500 hover:text-blue-600 dark:border-gray-600 dark:text-gray-400 dark:hover:text-blue-400"
            >
              {{ openIds.has(item.id) ? '收起回复' : '查看回复' }}
            </button>
            <button
              v-if="worker.loggedIn.value"
              @click="delTalk(item)"
              class="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:border-red-500 hover:text-red-600 dark:border-gray-600 dark:text-gray-400 dark:hover:text-red-400"
            >
              删除说说
            </button>
          </div>

          <!-- 回复区 -->
          <div
            v-if="openIds.has(item.id)"
            class="mt-3 border-t border-dashed border-gray-200 pt-3 dark:border-gray-700"
          >
            <p class="px-1 pb-1 text-xs text-gray-400 dark:text-gray-500">
              共 {{ repliesMap.get(item.id)?.length || 0 }} 条回复
            </p>
            <div
              v-if="!repliesMap.get(item.id)?.length"
              class="px-1 pb-2 text-xs text-gray-400 dark:text-gray-500"
            >
              还没有回复
            </div>
            <div
              v-for="r in repliesMap.get(item.id) || []"
              :key="r.id"
              class="border-b border-gray-100 py-2 last:border-b-0 dark:border-gray-700/60"
            >
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
                <span class="font-medium text-gray-700 dark:text-gray-200">{{ r.nickname }}</span>
                <span
                  v-if="r.is_admin === 1"
                  class="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] text-white"
                >
                  博主
                </span>
                <span>{{ fmtTime(r.created_at) }}</span>
                <span class="flex-1"></span>
                <button
                  v-if="worker.loggedIn.value"
                  @click="delReply(item, r)"
                  class="rounded-lg border border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-red-500 hover:text-red-600 dark:border-gray-600 dark:text-gray-400 dark:hover:text-red-400"
                >
                  删除
                </button>
              </div>
              <div
                class="prose prose-sm dark:prose-invert mt-1 max-w-none break-words prose-img:rounded-lg"
                v-html="renderMarkdown(r.content)"
              ></div>
            </div>

            <!-- 博主回复 -->
            <div v-if="worker.loggedIn.value" class="mt-3 flex flex-wrap gap-2">
              <input
                v-model="worker.adminNickname.value"
                maxlength="30"
                placeholder="昵称（博主）"
                class="min-w-[110px] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
              <input
                v-model="worker.adminEmail.value"
                maxlength="100"
                placeholder="邮箱（仅存档）"
                class="min-w-[160px] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
              />
              <input
                v-model="replyContent[item.id]"
                maxlength="2000"
                placeholder="以博主身份回复…"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                @keydown.enter="adminReply(item.id)"
              />
              <button
                @click="adminReply(item.id)"
                class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                :disabled="replying"
              >
                回复
              </button>
            </div>
          </div>
        </article>
      </div>

      <!-- 分页 -->
      <div v-if="total > 0" class="mt-6 flex items-center justify-center gap-4">
        <button
          @click="prevPage"
          class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:border-blue-500 hover:text-blue-600 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:text-blue-400"
          :disabled="page <= 1"
        >
          上一页
        </button>
        <span class="text-xs text-gray-400 dark:text-gray-500">
          第 {{ page }} / {{ totalPages }} 页，共 {{ total }} 条
        </span>
        <button
          @click="nextPage"
          class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:border-blue-500 hover:text-blue-600 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:text-blue-400"
          :disabled="!hasMore"
        >
          下一页
        </button>
      </div>
    </main>

    <!-- Toast -->
    <transition name="fade">
      <div
        v-if="toast.show"
        class="fixed bottom-6 left-1/2 z-[99] max-w-[90%] -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm text-white shadow-lg"
        :class="toast.error ? 'bg-red-700' : 'bg-gray-900 dark:bg-gray-700'"
      >
        {{ toast.message }}
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api, type UserInfo } from '../api'
import DarkToggle from '../components/DarkToggle.vue'
import {
  useShuoshuo,
  renderMarkdown,
  fmtShuoshuoTime,
  type ShuoshuoListItem,
  type Reply,
} from '../composables/useShuoshuo'

const router = useRouter()
const worker = useShuoshuo()

// ── State ──────────────────────────────────────────────────────

const user = ref<UserInfo | null>(null)
const workerBaseUrl = ref(worker.baseUrl.value)
const password = ref('')
const connStatus = ref('')
const connOk = ref(false)
const testing = ref(false)
const loggingIn = ref(false)
const publishing = ref(false)
const replying = ref(false)

const newContent = ref('')
const previewOpen = ref(false)

const page = ref(1)
const pageSize = 20
const list = ref<ShuoshuoListItem[]>([])
const total = ref(0)
const hasMore = ref(false)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const loading = ref(false)
const error = ref('')

const openIds = ref(new Set<number>())
const repliesMap = ref(new Map<number, Reply[]>())
const replyContent = ref<Record<number, string>>({})

const toast = ref({ show: false, message: '', error: false })
let toastTimer: ReturnType<typeof setTimeout> | null = null

// ── Helpers ─────────────────────────────────────────────────────

function showToast(message: string, isError = false): void {
  toast.value = { show: true, message, error: isError }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value.show = false
  }, 2600)
}

const fmtTime = fmtShuoshuoTime

// ── Actions ─────────────────────────────────────────────────────

async function testConnection(): Promise<void> {
  const url = workerBaseUrl.value.trim().replace(/\/+$/, '')
  if (!url) {
    connStatus.value = '请先填写 Worker 地址'
    connOk.value = false
    return
  }
  worker.saveBaseUrl(url)
  testing.value = true
  connStatus.value = ''
  try {
    await worker.testConnection()
    connOk.value = true
    connStatus.value = '连接成功 ✓'
    page.value = 1
    await loadList()
  } catch (err) {
    connOk.value = false
    connStatus.value = `连接失败：${(err as Error).message}`
  } finally {
    testing.value = false
  }
}

async function doLogin(): Promise<void> {
  const pwd = password.value
  if (!pwd) {
    showToast('请输入密码', true)
    return
  }
  loggingIn.value = true
  try {
    await worker.login(pwd)
    password.value = ''
    showToast('登录成功')
    page.value = 1
    await loadList()
  } catch (err) {
    showToast((err as Error).message, true)
  } finally {
    loggingIn.value = false
  }
}

async function loadList(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const data = await worker.listTalks(page.value, pageSize)
    list.value = data.list
    total.value = data.total
    hasMore.value = data.has_more
    const ids = new Set(data.list.map((i) => i.id))
    for (const id of [...openIds.value]) {
      if (!ids.has(id)) openIds.value.delete(id)
    }
    openIds.value = new Set(openIds.value)
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

function refresh(): void {
  page.value = 1
  loadList()
}

function prevPage(): void {
  if (page.value > 1) {
    page.value--
    loadList()
  }
}

function nextPage(): void {
  page.value++
  loadList()
}

async function publish(): Promise<void> {
  const content = newContent.value.trim()
  if (!content) {
    showToast('说说内容不能为空', true)
    return
  }
  publishing.value = true
  try {
    await worker.createTalk(content)
    newContent.value = ''
    previewOpen.value = false
    page.value = 1
    showToast('发布成功')
    await loadList()
  } catch (err) {
    showToast((err as Error).message, true)
  } finally {
    publishing.value = false
  }
}

async function toggleReplies(id: number): Promise<void> {
  if (openIds.value.has(id)) {
    openIds.value.delete(id)
    openIds.value = new Set(openIds.value)
    return
  }
  try {
    const detail = await worker.getTalk(id)
    repliesMap.value.set(id, detail.replies)
    openIds.value.add(id)
    openIds.value = new Set(openIds.value)
  } catch (err) {
    showToast((err as Error).message, true)
  }
}

async function adminReply(id: number): Promise<void> {
  const nickname = worker.adminNickname.value.trim()
  const email = worker.adminEmail.value.trim()
  const content = (replyContent.value[id] || '').trim()
  if (!nickname || !email || !content) {
    showToast('昵称、邮箱、回复内容都不能为空', true)
    return
  }
  worker.saveNickname(nickname)
  worker.saveEmail(email)
  replying.value = true
  try {
    await worker.createReply(id, { nickname, email, content })
    replyContent.value[id] = ''
    showToast('已以博主身份回复')
    const detail = await worker.getTalk(id)
    repliesMap.value.set(id, detail.replies)
    await loadList()
  } catch (err) {
    showToast((err as Error).message, true)
  } finally {
    replying.value = false
  }
}

async function delTalk(item: ShuoshuoListItem): Promise<void> {
  if (!confirm(`确定删除说说 #${item.id} 及其全部回复？此操作不可恢复。`)) return
  try {
    await worker.deleteTalk(item.id)
    openIds.value.delete(item.id)
    repliesMap.value.delete(item.id)
    showToast('已删除')
    await loadList()
  } catch (err) {
    showToast((err as Error).message, true)
  }
}

async function delReply(item: ShuoshuoListItem, reply: Reply): Promise<void> {
  if (!confirm('确定删除这条回复？此操作不可恢复。')) return
  try {
    await worker.deleteReply(reply.id)
    showToast('已删除回复')
    const detail = await worker.getTalk(item.id)
    repliesMap.value.set(item.id, detail.replies)
    await loadList()
  } catch (err) {
    showToast((err as Error).message, true)
  }
}

async function doLogout(): Promise<void> {
  try {
    await api.logout()
  } catch {
    /* ignore */
  }
  router.push('/login')
}

// ── Init ────────────────────────────────────────────────────────

onMounted(async () => {
  try {
    const userData = await api.user()
    user.value = userData.user
  } catch {
    /* authGuard already redirected if needed */
  }
  if (workerBaseUrl.value) {
    await testConnection()
  }
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
