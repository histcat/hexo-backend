<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <!-- Toolbar -->
    <div
      class="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800"
    >
      <button
        v-for="btn in toolbar"
        :key="btn.label"
        @click="btn.action"
        :disabled="disabled"
        :title="btn.label"
        class="rounded p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-200"
        type="button"
        v-html="btn.icon"
      />
      <span class="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-600" />
      <button
        @click="insertImage"
        :disabled="disabled"
        title="插入图片"
        class="rounded p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-200"
        type="button"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
    </div>

    <!-- Textarea -->
    <textarea
      ref="textareaRef"
      :value="modelValue"
      @input="onInput"
      @keydown.tab.prevent="insertTab"
      :disabled="disabled"
      :placeholder="placeholder"
      class="min-h-0 flex-1 resize-none border-0 bg-white p-4 font-mono text-sm leading-relaxed text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-0 disabled:bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:placeholder-gray-500 dark:disabled:bg-gray-800"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  modelValue: string
  disabled?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'upload-image': []
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}

// ── Toolbar actions ───────────────────────────────────────────────

interface ToolbarBtn {
  label: string
  icon: string
  action: () => void
}

const toolbar: ToolbarBtn[] = [
  {
    label: '加粗',
    icon: '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg>',
    action: () => wrapSelection('**', '**'),
  },
  {
    label: '斜体',
    icon: '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="19" y1="4" x2="10" y2="4" stroke-width="2" stroke-linecap="round"/><line x1="14" y1="20" x2="5" y2="20" stroke-width="2" stroke-linecap="round"/><line x1="15" y1="4" x2="9" y2="20" stroke-width="2" stroke-linecap="round"/></svg>',
    action: () => wrapSelection('*', '*'),
  },
  {
    label: '标题',
    icon: '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8M4 18h16"/></svg>',
    action: () => prefixLine('## '),
  },
  {
    label: '链接',
    icon: '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>',
    action: () => {
      const sel = getSelection()
      if (sel) {
        insertText(`[${sel}](url)`)
      } else {
        insertText('[链接文字](url)')
      }
    },
  },
  {
    label: '行内代码',
    icon: '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>',
    action: () => wrapSelection('`', '`'),
  },
  {
    label: '代码块',
    icon: '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>',
    action: () => wrapSelection('\n```\n', '\n```\n'),
  },
  {
    label: '无序列表',
    icon: '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>',
    action: () => prefixLine('- '),
  },
  {
    label: '引用',
    icon: '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>',
    action: () => prefixLine('> '),
  },
]

function insertImage() {
  emit('upload-image')
}

// ── Textarea manipulation ─────────────────────────────────────────

function getTextarea(): HTMLTextAreaElement | null {
  return textareaRef.value
}

function getSelection(): string {
  const ta = getTextarea()
  if (!ta) return ''
  return ta.value.substring(ta.selectionStart, ta.selectionEnd)
}

function insertText(text: string) {
  const ta = getTextarea()
  if (!ta) return
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const before = ta.value.substring(0, start)
  const after = ta.value.substring(end)
  const newValue = before + text + after
  emit('update:modelValue', newValue)
  // Restore cursor position after Vue re-render
  requestAnimationFrame(() => {
    ta.focus()
    ta.selectionStart = ta.selectionEnd = start + text.length
  })
}

function wrapSelection(before: string, after: string) {
  const ta = getTextarea()
  if (!ta) return
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const sel = ta.value.substring(start, end)
  const replacement = sel ? before + sel + after : before + after
  const newValue =
    ta.value.substring(0, start) + replacement + ta.value.substring(end)
  emit('update:modelValue', newValue)
  requestAnimationFrame(() => {
    ta.focus()
    if (sel) {
      ta.selectionStart = start + before.length
      ta.selectionEnd = end + before.length
    } else {
      ta.selectionStart = ta.selectionEnd = start + before.length
    }
  })
}

function prefixLine(prefix: string) {
  const ta = getTextarea()
  if (!ta) return
  const start = ta.selectionStart
  // Find the start of the current line
  const beforeCursor = ta.value.substring(0, start)
  const lineStart = beforeCursor.lastIndexOf('\n') + 1
  const newValue =
    ta.value.substring(0, lineStart) +
    prefix +
    ta.value.substring(lineStart)
  emit('update:modelValue', newValue)
  requestAnimationFrame(() => {
    ta.focus()
    ta.selectionStart = ta.selectionEnd =
      lineStart + prefix.length + (start - lineStart)
  })
}

function insertTab() {
  insertText('  ')
}
</script>
