<template>
  <div
    v-if="renderedHtml"
    class="prose prose-sm dark:prose-invert max-w-none overflow-y-auto p-4 prose-headings:border-b prose-headings:border-gray-200 dark:prose-headings:border-gray-700 prose-headings:pb-1 prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm dark:prose-code:bg-gray-800 dark:prose-code:text-gray-300 prose-pre:code:bg-transparent prose-pre:code:p-0 prose-pre:code:rounded-none prose-img:rounded-lg prose-a:text-blue-600 dark:prose-a:text-blue-400"
    v-html="renderedHtml"
  />
  <div v-else class="flex items-center justify-center p-8 text-sm text-gray-400">
    预览区域（开始编辑内容以查看预览）
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import katex from 'katex'
import 'katex/dist/katex.min.css'

const props = defineProps<{
  content: string
}>()

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
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
