<template>
  <div class="space-y-4">
    <div
      v-for="field in fields"
      :key="field.key"
      class="space-y-1"
    >
      <label
        :for="'fm-' + field.key"
        class="block text-xs font-medium text-gray-600"
      >
        {{ field.label }}
        <span v-if="field.required" class="text-red-500">*</span>
      </label>

      <!-- string -->
      <input
        v-if="field.type === 'string'"
        :id="'fm-' + field.key"
        :value="(local[field.key] as string) || ''"
        @input="setField(field.key, ($event.target as HTMLInputElement).value)"
        :disabled="disabled"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
      />

      <!-- date -->
      <input
        v-else-if="field.type === 'date'"
        :id="'fm-' + field.key"
        type="datetime-local"
        :value="toDatetimeLocal(local[field.key])"
        @input="setField(field.key, ($event.target as HTMLInputElement).value)"
        :disabled="disabled"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
      />

      <!-- boolean -->
      <label
        v-else-if="field.type === 'boolean'"
        class="flex cursor-pointer items-center gap-2"
      >
        <input
          type="checkbox"
          :checked="!!local[field.key]"
          @change="setField(field.key, ($event.target as HTMLInputElement).checked)"
          :disabled="disabled"
          class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span class="text-sm text-gray-500">是</span>
      </label>

      <!-- string[] (tags) -->
      <div v-else-if="field.type === 'string[]'" class="space-y-2">
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="(tag, i) in tagList(field.key)"
            :key="i"
            class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
          >
            {{ tag }}
            <button
              @click="removeTag(field.key, i)"
              :disabled="disabled"
              class="ml-0.5 text-blue-400 hover:text-blue-600 disabled:opacity-30"
              type="button"
            >
              ×
            </button>
          </span>
        </div>
        <div class="flex gap-1">
          <input
            :id="'fm-' + field.key"
            :value="tagInput[field.key] || ''"
            @input="tagInput[field.key] = ($event.target as HTMLInputElement).value"
            @keydown.enter.prevent="addTag(field.key)"
            @keydown.,.prevent="addTag(field.key)"
            :disabled="disabled"
            :placeholder="tagList(field.key).length ? '添加标签...' : '输入标签，回车添加'"
            class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            @click="addTag(field.key)"
            :disabled="disabled || !tagInput[field.key]?.trim()"
            class="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 disabled:opacity-30"
            type="button"
          >
            添加
          </button>
        </div>
      </div>

      <!-- number -->
      <input
        v-else-if="field.type === 'number'"
        :id="'fm-' + field.key"
        type="number"
        :value="local[field.key] ?? ''"
        @input="setField(field.key, parseFloat(($event.target as HTMLInputElement).value) || undefined)"
        :disabled="disabled"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { FrontmatterField } from '../api'

const props = defineProps<{
  modelValue: Record<string, unknown>
  fields: FrontmatterField[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>]
}>()

// Local reactive copy
const local = reactive<Record<string, unknown>>({ ...props.modelValue })
const tagInput = reactive<Record<string, string>>({})

// Sync parent → local
watch(
  () => props.modelValue,
  (v) => Object.assign(local, v),
  { deep: true },
)

// Emit local → parent
function setField(key: string, value: unknown) {
  local[key] = value
  emit('update:modelValue', { ...local })
}

// ── Date helpers ──────────────────────────────────────────────────

function toDatetimeLocal(value: unknown): string {
  if (!value) return ''
  try {
    const d = typeof value === 'string' ? new Date(value) : new Date(value as number)
    if (isNaN(d.getTime())) return ''
    // Format as YYYY-MM-DDTHH:mm (datetime-local input format)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

// ── Tag helpers ───────────────────────────────────────────────────

function tagList(key: string): string[] {
  const val = local[key]
  if (Array.isArray(val)) return val.filter((t) => typeof t === 'string')
  return []
}

function addTag(key: string) {
  const raw = (tagInput[key] || '').trim()
  if (!raw) return
  // Split by comma or space
  const newTags = raw
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
  const current = tagList(key)
  const merged = [...current]
  for (const t of newTags) {
    if (!merged.includes(t)) merged.push(t)
  }
  local[key] = merged
  tagInput[key] = ''
  emit('update:modelValue', { ...local })
}

function removeTag(key: string, index: number) {
  const current = tagList(key)
  current.splice(index, 1)
  local[key] = [...current]
  emit('update:modelValue', { ...local })
}
</script>
