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
        <input
          v-if="post.frontmatter.title !== undefined"
          :value="post.frontmatter.title as string"
          @input="onTitleInput"
          placeholder="✏️ 输入文章标题..."
          class="w-full rounded-md border border-dashed border-gray-300 bg-gray-50/50 px-2.5 py-1.5 text-base font-semibold text-gray-900 placeholder-gray-300 hover:border-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-100 dark:placeholder-gray-500 dark:hover:border-gray-500 dark:focus:border-blue-500 dark:focus:bg-gray-800"
        />
        <span v-else class="text-sm text-gray-400 dark:text-gray-500">
          {{ isNew ? '新建文章' : post.name }}
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

      <DarkToggle />

      <button
        @click="doSave"
        :disabled="saving"
        class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 dark:bg-blue-500 dark:hover:bg-blue-600"
      >
        保存
      </button>

      <!-- More menu -->
      <div v-if="!isNew" class="relative">
        <button
          @click="menuOpen = !menuOpen"
          class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          title="更多操作"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01" />
          </svg>
        </button>
        <div
          v-if="menuOpen"
          class="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
          @click.stop
        >
          <button
            @click="startRename"
            class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            重命名 / 移动
          </button>
          <button
            @click="confirmDelete"
            class="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
          >
            删除文章
          </button>
        </div>
      </div>
    </header>

    <!-- Rename dialog -->
    <div
      v-if="showRename"
      class="mx-4 mt-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-900/30"
    >
      <label class="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">新路径</label>
      <div class="flex gap-2">
        <input
          v-model="renamePath"
          @keydown.enter="doRename"
          class="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
        <button
          @click="doRename"
          :disabled="!renamePath.trim() || renamePath === post.path"
          class="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-40 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          确认
        </button>
        <button
          @click="showRename = false"
          class="rounded bg-gray-100 px-3 py-1 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          取消
        </button>
      </div>
    </div>

    <!-- Delete confirm -->
    <div
      v-if="showDelete"
      class="mx-4 mt-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/30"
    >
      <p class="mb-2 text-sm text-red-700 dark:text-red-400">
        确定要删除「{{ post.frontmatter.title || post.name }}」吗？此操作不可撤销。
      </p>
      <div class="flex gap-2">
        <button
          @click="doDelete"
          :disabled="saving"
          class="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-40"
        >
          确认删除
        </button>
        <button
          @click="showDelete = false"
          class="rounded bg-gray-100 px-3 py-1 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          取消
        </button>
      </div>
    </div>

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
    <div v-else class="flex min-h-0 flex-1 flex-col md:flex-row">
      <!-- Left: Forms + Editor -->
      <div class="flex min-h-0 flex-1 flex-col border-r border-gray-200 dark:border-gray-700">
        <!-- Frontmatter YAML editor (collapsible) -->
        <details class="border-b border-gray-200 dark:border-gray-700" open>
          <summary class="flex cursor-pointer items-center gap-2 px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800">
            Frontmatter (YAML)
            <span v-if="yamlError" class="text-red-500">— {{ yamlError }}</span>
          </summary>
          <div class="px-4 pb-3">
            <textarea
              :value="frontmatterRaw"
              @input="onFmInput"
              :disabled="saving"
              :class="[
                'w-full rounded-lg border px-3 py-2 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 dark:text-gray-100',
                yamlError
                  ? 'border-red-300 bg-red-50 focus:ring-red-300 dark:border-red-700 dark:bg-red-900/20'
                  : 'border-gray-300 bg-gray-50 focus:border-blue-500 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800',
              ]"
              rows="6"
              spellcheck="false"
              placeholder="title: 文章标题&#10;published: 2025-01-01&#10;tags:&#10;  - tag1&#10;  - tag2"
            ></textarea>
          </div>
        </details>

        <!-- Markdown editor -->
        <div class="flex min-h-0 flex-1 flex-col">
          <!-- Mobile tabs -->
          <div class="flex border-b border-gray-200 md:hidden dark:border-gray-700">
            <button
              @click="mobileTab = 'edit'"
              :class="[
                'flex-1 py-2 text-center text-xs font-medium',
                mobileTab === 'edit'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400',
              ]"
            >
              编辑
            </button>
            <button
              @click="mobileTab = 'preview'"
              :class="[
                'flex-1 py-2 text-center text-xs font-medium',
                mobileTab === 'preview'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400',
              ]"
            >
              预览
            </button>
          </div>

          <div
            :class="[
              'flex min-h-0 flex-1',
              mobileTab === 'edit' ? 'flex' : 'hidden',
              'md:flex',
            ]"
          >
            <MarkdownEditor
              :modelValue="post.content"
              @update:modelValue="setContent"
              @upload-image="onUploadImage"
              :disabled="saving"
              placeholder="开始撰写 Markdown 内容..."
            />
          </div>
        </div>
      </div>

      <!-- Right: Preview (desktop always visible, mobile via tab) -->
      <div
        :class="[
          'min-h-0 flex-1 flex-col bg-gray-50 dark:bg-gray-800',
          mobileTab === 'preview' ? 'flex' : 'hidden',
          'md:flex',
        ]"
      >
        <div class="hidden border-b border-gray-200 px-4 py-2 md:block dark:border-gray-700">
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400">预览</span>
        </div>
        <MarkdownPreview :content="post.content" />
      </div>

      <!-- Hidden file input for image upload -->
      <input
        ref="imageInput"
        type="file"
        accept="image/*"
        class="hidden"
        @change="onImageSelected"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api, type RepoConfig } from '../api'
import { load as parseYaml, dump as stringifyYaml } from 'js-yaml'
import MarkdownEditor from '../components/MarkdownEditor.vue'
import MarkdownPreview from '../components/MarkdownPreview.vue'
import DarkToggle from '../components/DarkToggle.vue'

const router = useRouter()
const route = useRoute()

// ── State ──────────────────────────────────────────────────────

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const saveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const menuOpen = ref(false)
const showRename = ref(false)
const showDelete = ref(false)
const renamePath = ref('')
const mobileTab = ref<'edit' | 'preview'>('edit')
const frontmatterRaw = ref('')
const yamlError = ref('')

const config = ref<RepoConfig | null>(null)

const post = reactive<{
  path: string
  name: string
  sha: string
  ext: 'md' | 'mdx'
  frontmatter: Record<string, unknown>
  content: string
}>({
  path: '',
  name: '',
  sha: '',
  ext: 'md',
  frontmatter: {},
  content: '',
})

let originalSha = ''
let originalContent = ''
let originalFm: Record<string, unknown> = {}

// ── Computed ───────────────────────────────────────────────────

const isNew = computed(() => !route.query.path)

const isDirty = computed(() => {
  if (isNew.value) {
    return !!(
      post.content.trim() || (post.frontmatter.title as string)?.trim()
    )
  }
  return (
    post.sha !== originalSha ||
    post.content !== originalContent ||
    JSON.stringify(post.frontmatter) !== JSON.stringify(originalFm)
  )
})

// ── Lifecycle ──────────────────────────────────────────────────

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)

  try {
    // Load repo config
    try {
      const { config: cfg } = await api.repoCurrent()
      config.value = cfg
    } catch (e) {
      if ((e as { code?: string }).code === 'NO_REPO_SELECTED') {
        router.replace('/repos')
        return
      }
      if ((e as { code?: string }).code === 'AUTH_REQUIRED') {
        router.replace('/login')
        return
      }
      throw e
    }

    // Load post
    const postPath = route.query.path as string | undefined
    if (postPath) {
      await loadPost(postPath)
    } else {
      await initNewPost()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载编辑器失败'
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})

// Watch for route query changes (e.g. navigating from one post to another,
// or from a post to "new post"). Vue reuses the same component for /editor,
// so we must manually reinitialize state when the query changes.
let routeReady = false
watch(
  () => route.query.path,
  async (newPath) => {
    if (!routeReady) {
      routeReady = true
      return // initial load handled by onMounted
    }

    loading.value = true
    error.value = ''
    menuOpen.value = false
    showRename.value = false
    showDelete.value = false
    saveState.value = 'idle'

    try {
      if (newPath) {
        await loadPost(newPath as string)
      } else {
        await initNewPost()
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载编辑器失败'
    } finally {
      loading.value = false
    }
  },
)

// ── Load / Init ────────────────────────────────────────────────

function fmToYaml(fm: Record<string, unknown>): string {
  if (!fm || Object.keys(fm).length === 0) return ''
  try {
    return stringifyYaml(fm, { lineWidth: -1 }).trim()
  } catch {
    return ''
  }
}

async function loadPost(postPath: string) {
  const { post: p } = await api.getPost(postPath)
  post.path = p.path
  post.name = p.name
  post.sha = p.sha
  post.ext = p.ext
  post.frontmatter = { ...p.frontmatter }
  post.content = p.content
  originalSha = p.sha
  originalContent = p.content
  originalFm = { ...p.frontmatter }

  if (!post.frontmatter.title) {
    post.frontmatter.title = post.name.replace(/\.[^.]+$/, '')
  }
  // Use the raw YAML from the server so we don't alter formatting
  frontmatterRaw.value = p.frontmatterRaw || fmToYaml(post.frontmatter)
  yamlError.value = ''
}

async function initNewPost() {
  const defaults = config.value?.frontmatterDefaults || {}
  post.path = ''
  post.name = 'new-post.md'
  post.sha = ''
  post.ext = 'md'
  post.frontmatter = {
    title: '',
    category: '',
    published: new Date().toISOString(),
    tags: [],
    ...defaults,
  }
  post.content = ''
  originalSha = ''
  originalContent = ''
  originalFm = {}
  frontmatterRaw.value = fmToYaml(post.frontmatter)
  yamlError.value = ''
}

// ── Frontmatter YAML ↔ Object ──────────────────────────────────

function onTitleInput(e: Event) {
  const title = (e.target as HTMLInputElement).value
  post.frontmatter.title = title
  // Sync YAML
  const current = frontmatterRaw.value
  if (current.includes('title:')) {
    frontmatterRaw.value = current.replace(/^title:.*$/m, `title: ${title}`)
  } else {
    frontmatterRaw.value = `title: ${title}\n${current}`
  }
}

function onFmInput(e: Event) {
  const raw = (e.target as HTMLTextAreaElement).value
  frontmatterRaw.value = raw

  if (!raw.trim()) {
    post.frontmatter = {}
    yamlError.value = ''
    return
  }

  try {
    const parsed = parseYaml(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      post.frontmatter = parsed as Record<string, unknown>
      yamlError.value = ''
    } else {
      yamlError.value = 'Frontmatter 必须是一个 YAML 对象（键值对）'
    }
  } catch (e) {
    yamlError.value = `YAML 格式错误: ${(e as Error).message}`
  }
}

function setContent(content: string) {
  post.content = content
}

// ── Save ───────────────────────────────────────────────────────

async function doSave() {
  if (saving.value) return

  // Validate YAML before saving
  if (frontmatterRaw.value.trim()) {
    try {
      const parsed = parseYaml(frontmatterRaw.value)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        error.value = 'Frontmatter 必须是一个 YAML 对象'
        return
      }
    } catch (e) {
      error.value = `Frontmatter YAML 格式错误: ${(e as Error).message}`
      return
    }
  }

  // Check required fields from config
  for (const key of config.value?.frontmatterRequired || []) {
    const val = post.frontmatter[key]
    if (!val && val !== false && val !== 0) {
      error.value = `请填写必填字段: ${key}`
      return
    }
  }

  saving.value = true
  saveState.value = 'saving'
  error.value = ''

  try {
    const title = (post.frontmatter.title as string) || 'untitled'

    if (isNew.value) {
      const slug = ((post.frontmatter.title as string) || 'untitled')
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase() || 'untitled'

      const postsDir = config.value?.postsDir || 'src/content/posts/'
      const layout = config.value?.layout || 'folder'
      const ext = post.ext === 'mdx' ? '.mdx' : '.md'
      let filePath: string

      if (layout === 'folder') {
        filePath = `${postsDir}${slug}/index${ext}`
      } else {
        filePath = `${postsDir}${slug}${ext}`
      }

      const result = await api.createPost({
        path: filePath,
        mode: post.ext,
        frontmatter: post.frontmatter,
        frontmatterRaw: frontmatterRaw.value,
        content: post.content,
      })

      post.path = result.post.path
      post.sha = result.post.sha
      post.name = result.post.name
      originalSha = result.post.sha
      originalContent = post.content
      originalFm = { ...post.frontmatter }

      router.replace({ query: { path: result.post.path } })
    } else {
      const result = await api.updatePost(post.path, {
        sha: post.sha,
        frontmatter: post.frontmatter,
        frontmatterRaw: frontmatterRaw.value,
        content: post.content,
      })

      post.sha = result.post.sha
      originalSha = result.post.sha
      originalContent = post.content
      originalFm = { ...post.frontmatter }
    }

    saveState.value = 'saved'
    setTimeout(() => {
      if (saveState.value === 'saved') saveState.value = 'idle'
    }, 2000)
  } catch (e) {
    const err = e as Error & { code?: string }
    if (err.code === 'CONFLICT_SHA_MISMATCH') {
      error.value =
        '文件已被他人更新，请刷新页面后重新编辑。建议先复制本地修改再刷新。'
    } else {
      error.value = err.message || '保存失败'
    }
    saveState.value = 'error'
  } finally {
    saving.value = false
  }
}

// ── Rename ─────────────────────────────────────────────────────

function startRename() {
  renamePath.value = post.path
  showRename.value = true
  menuOpen.value = false
}

async function doRename() {
  const newPath = renamePath.value.trim()
  if (!newPath || newPath === post.path) return

  saving.value = true
  error.value = ''

  try {
    const result = await api.movePost(post.path, {
      newPath,
      sha: post.sha,
      commitMessage: `rename: ${post.name} → ${newPath}`,
    })

    post.path = result.post.path
    post.sha = result.post.sha
    post.name = result.post.name
    originalSha = result.post.sha
    originalContent = post.content
    originalFm = { ...post.frontmatter }
    showRename.value = false

    router.replace({ query: { path: result.post.path } })
  } catch (e) {
    error.value = e instanceof Error ? e.message : '重命名失败'
  } finally {
    saving.value = false
  }
}

// ── Delete ─────────────────────────────────────────────────────

function confirmDelete() {
  showDelete.value = true
  menuOpen.value = false
}

async function doDelete() {
  saving.value = true
  error.value = ''

  try {
    await api.deletePost(post.path, {
      sha: post.sha,
      commitMessage: `delete: ${post.frontmatter.title || post.name}`,
    })

    router.replace('/posts')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除失败'
    showDelete.value = false
  } finally {
    saving.value = false
  }
}

// ── Image upload ────────────────────────────────────────────────

const imageInput = ref<HTMLInputElement | null>(null)

function onUploadImage() {
  imageInput.value?.click()
}

async function onImageSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // Validate file type
  if (!file.type.startsWith('image/')) {
    error.value = '请选择图片文件'
    return
  }

  // Validate size (10 MB)
  if (file.size > 10 * 1024 * 1024) {
    error.value = '图片大小不能超过 10 MB'
    return
  }

  saving.value = true
  error.value = ''

  try {
    const result = await api.uploadImage(file)
    // Insert Markdown image syntax at the end of content
    const alt = file.name.replace(/\.[^.]+$/, '') || 'image'
    const mdImage = `![${alt}](${result.url})`
    post.content = post.content ? post.content + '\n\n' + mdImage : mdImage
  } catch (e) {
    error.value = e instanceof Error ? e.message : '上传图片失败'
  } finally {
    saving.value = false
    // Clear input so same file can be re-selected
    if (imageInput.value) imageInput.value.value = ''
  }
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
