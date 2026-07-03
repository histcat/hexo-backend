<template>
  <div
    v-if="renderedHtml"
    class="prose prose-sm dark:prose-invert max-w-none overflow-y-auto p-4 prose-headings:border-b prose-headings:border-gray-200 dark:prose-headings:border-gray-700 prose-headings:pb-1 prose-img:rounded-lg prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-pre:bg-gray-50 prose-pre:text-gray-800 prose-pre:border prose-pre:border-gray-200 dark:prose-pre:bg-slate-800 dark:prose-pre:text-gray-200 dark:prose-pre:border-slate-700"
    v-html="renderedHtml"
  />
  <div v-else class="flex items-center justify-center p-8 text-sm text-gray-400">
    预览区域（开始编辑内容以查看预览）
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.min.css'
import katex from 'katex'
import 'katex/dist/katex.min.css'

const props = defineProps<{
  content: string
}>()

// ── Syntax highlighting ──────────────────────────────────────────

// Cache the hljs result to avoid re-highlighting identical code
const hlCache = new Map<string, string>()

function highlight(code: string, lang: string): string {
  const cacheKey = `${lang}\x00${code}`
  const cached = hlCache.get(cacheKey)
  if (cached) return cached

  try {
    if (lang && hljs.getLanguage(lang)) {
      const result = hljs.highlight(code, { language: lang }).value
      hlCache.set(cacheKey, result)
      return result
    }
  } catch {
    /* fall through to auto-detection */
  }

  try {
    const result = hljs.highlightAuto(code).value
    hlCache.set(cacheKey, result)
    return result
  } catch {
    const escaped = escapeHtml(code)
    hlCache.set(cacheKey, escaped)
    return escaped
  }
}

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
})

// Use the highlight option on marked
marked.use({
  renderer: {
    code(this: unknown, { text, lang }: { text: string; lang?: string }): string {
      const highlighted = highlight(text, lang || '')
      const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : ''
      return `<pre><code${langAttr}>${highlighted}</code></pre>\n`
    },
  },
})

// ── Math rendering ────────────────────────────────────────────────

/**
 * Render LaTeX math in a block of text.
 * - $$...$$ or \[...\] → display math
 * - $...$ or \(...\) → inline math
 */
function renderMath(text: string): string {
  // Protect code blocks first
  const codeBlocks: string[] = []
  let protected_ = text
    .replace(/```[\s\S]*?```/g, (m) => {
      codeBlocks.push(m)
      return `\x00CODE${codeBlocks.length - 1}\x00`
    })
    .replace(/`[^`]+`/g, (m) => {
      codeBlocks.push(m)
      return `\x00CODE${codeBlocks.length - 1}\x00`
    })

  // Display math: $$...$$ or \[...\]
  protected_ = protected_.replace(/\$\$([\s\S]*?)\$\$/g, (_, formula: string) => {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode: true,
        throwOnError: false,
      })
    } catch {
      return `<pre class="text-red-500 text-xs">Math error: ${escapeHtml(formula)}</pre>`
    }
  })

  protected_ = protected_.replace(/\\\[([\s\S]*?)\\\]/g, (_, formula: string) => {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode: true,
        throwOnError: false,
      })
    } catch {
      return `<pre class="text-red-500 text-xs">Math error: ${escapeHtml(formula)}</pre>`
    }
  })

  // Inline math: $...$ (must not be followed/preceded by $)
  protected_ = protected_.replace(/\$(.+?)\$/g, (_, formula: string) => {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode: false,
        throwOnError: false,
      })
    } catch {
      return `<code class="text-red-500">${escapeHtml(formula)}</code>`
    }
  })

  protected_ = protected_.replace(/\\\((.+?)\\\)/g, (_, formula: string) => {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode: false,
        throwOnError: false,
      })
    } catch {
      return `<code class="text-red-500">${escapeHtml(formula)}</code>`
    }
  })

  // Restore code blocks
  protected_ = protected_.replace(/\x00CODE(\d+)\x00/g, (_, i: string) => {
    return codeBlocks[parseInt(i)] || ''
  })

  return protected_
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ── Render ────────────────────────────────────────────────────────

const renderedHtml = computed(() => {
  if (!props.content?.trim()) return ''

  try {
    // Step 1: render math with KaTeX
    const withMath = renderMath(props.content)

    // Step 2: parse remaining markdown with marked
    const html = marked.parse(withMath) as string

    return html
  } catch {
    return '<p class="text-red-500">Markdown 解析错误</p>'
  }
})
</script>
