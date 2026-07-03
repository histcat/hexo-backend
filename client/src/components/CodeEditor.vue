<template>
  <div class="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-300 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
    <!-- Line numbers gutter -->
    <div
      ref="gutterRef"
      class="select-none overflow-hidden bg-gray-50 py-3 pl-3 pr-1 text-right font-mono text-xs leading-5 text-gray-400"
      aria-hidden="true"
    >
      <template v-for="n in lineCount" :key="n">
        {{ n }}<br />
      </template>
    </div>

    <!-- Textarea -->
    <textarea
      ref="textareaRef"
      :value="modelValue"
      @input="onInput"
      @keydown="onKeydown"
      @scroll="syncScroll"
      :disabled="disabled"
      :placeholder="placeholder"
      :spellcheck="spellcheck"
      class="min-h-0 flex-1 resize-none border-0 bg-transparent px-3 py-3 font-mono text-sm leading-5 text-gray-900 placeholder-gray-400 focus:outline-none"
      wrap="off"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    disabled?: boolean
    placeholder?: string
    spellcheck?: boolean
  }>(),
  {
    disabled: false,
    placeholder: '',
    spellcheck: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const gutterRef = ref<HTMLDivElement | null>(null)

const lineCount = computed(() => {
  // Count newlines + at least 1 line
  const lines = props.modelValue.split('\n').length
  return Math.max(1, lines)
})

function onInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}

function onKeydown(e: KeyboardEvent) {
  // Tab key inserts spaces
  if (e.key === 'Tab') {
    e.preventDefault()
    const ta = textareaRef.value
    if (!ta) return

    const start = ta.selectionStart
    const end = ta.selectionEnd
    const value = props.modelValue

    if (e.shiftKey) {
      // Shift+Tab: unindent
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const line = value.slice(lineStart, start)
      const match = line.match(/^ {1,2}/)
      if (match) {
        const newValue =
          value.slice(0, lineStart) + line.slice(match[0].length) + value.slice(start)
        emit('update:modelValue', newValue)
        // Restore cursor after DOM update
        void nextTick(() => {
          ta.selectionStart = ta.selectionEnd = start - match[0].length
        })
      }
    } else {
      const newValue = value.slice(0, start) + '  ' + value.slice(end)
      emit('update:modelValue', newValue)
      void nextTick(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      })
    }
  }
}

function syncScroll() {
  if (gutterRef.value && textareaRef.value) {
    gutterRef.value.scrollTop = textareaRef.value.scrollTop
  }
}

// Expose focus method
function focus() {
  textareaRef.value?.focus()
}

defineExpose({ focus })
</script>
