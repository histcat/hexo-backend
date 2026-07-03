<template>
  <div class="space-y-3">
    <template v-for="entry in entries" :key="entry.key">
      <div class="rounded-lg border border-gray-200 bg-white">
        <!-- Nested object -->
        <template v-if="entry.kind === 'object' && entry.value">
          <details class="group" :open="entry.expanded">
            <summary class="cursor-pointer px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              {{ entry.key }}
            </summary>
            <div class="border-t border-gray-100 px-4 pb-3 pt-2">
              <ConfigForm
                :modelValue="entry.value as Record<string, unknown>"
                @update:modelValue="(v) => updateField(entry.key, v)"
                :disabled="disabled"
              />
            </div>
          </details>
        </template>

        <!-- Array -->
        <template v-else-if="entry.kind === 'array'">
          <details class="group" :open="entry.expanded">
            <summary class="cursor-pointer px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              {{ entry.key }}
              <span class="ml-1 text-xs text-gray-400">({{ (entry.value as unknown[]).length }} 项)</span>
            </summary>
            <div class="border-t border-gray-100 px-4 pb-3 pt-2">
              <div class="space-y-1.5">
                <div
                  v-for="(item, idx) in (entry.value as unknown[])"
                  :key="idx"
                  class="flex items-center gap-2"
                >
                  <span class="font-mono text-xs text-gray-400">{{ idx }}</span>
                  <input
                    :value="stringifyValue(item)"
                    @input="(e) => updateArrayItem(entry.key, idx, (e.target as HTMLInputElement).value)"
                    :disabled="disabled"
                    class="flex-1 rounded border border-gray-300 px-2 py-1 text-sm font-mono focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                  />
                  <button
                    @click="removeArrayItem(entry.key, idx)"
                    :disabled="disabled"
                    class="rounded p-0.5 text-gray-400 hover:text-red-500 disabled:opacity-30"
                    title="移除"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <button
                  @click="addArrayItem(entry.key)"
                  :disabled="disabled"
                  class="rounded border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-30"
                >
                  + 添加项
                </button>
              </div>
            </div>
          </details>
        </template>

        <!-- Scalar values -->
        <template v-else>
          <div class="flex items-center gap-3 px-3 py-2">
            <label class="min-w-0 shrink-0 text-sm font-medium text-gray-600">
              {{ entry.key }}
            </label>
            <div class="min-w-0 flex-1">
              <!-- Boolean -->
              <label v-if="entry.kind === 'boolean'" class="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  :checked="!!entry.value"
                  @change="(e) => updateField(entry.key, (e.target as HTMLInputElement).checked)"
                  :disabled="disabled"
                  class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span class="text-xs text-gray-400 font-mono">{{ entry.value ? 'true' : 'false' }}</span>
              </label>

              <!-- Number -->
              <input
                v-else-if="entry.kind === 'number'"
                type="number"
                :value="entry.value as number"
                @input="(e) => updateField(entry.key, parseFloat((e.target as HTMLInputElement).value) || 0)"
                :disabled="disabled"
                class="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
              />

              <!-- String -->
              <input
                v-else
                :value="entry.value as string"
                @input="(e) => updateField(entry.key, (e.target as HTMLInputElement).value)"
                :disabled="disabled"
                :placeholder="entry.kind === 'null' ? 'null' : ''"
                class="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
              />
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- Empty state -->
    <p v-if="entries.length === 0" class="py-6 text-center text-sm text-gray-400">
      空对象
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: Record<string, unknown>
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>]
}>()

interface FieldEntry {
  key: string
  kind: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null'
  value: unknown
  expanded: boolean
}

const entries = computed<FieldEntry[]>(() => {
  const obj = props.modelValue
  if (!obj || typeof obj !== 'object') return []

  return Object.entries(obj).map(([key, value]) => {
    let kind: FieldEntry['kind']
    let expanded = false

    if (value === null || value === undefined) {
      kind = 'null'
    } else if (typeof value === 'boolean') {
      kind = 'boolean'
    } else if (typeof value === 'number') {
      kind = 'number'
    } else if (Array.isArray(value)) {
      kind = 'array'
      expanded = value.length > 0
    } else if (typeof value === 'object') {
      kind = 'object'
      expanded = Object.keys(value as Record<string, unknown>).length > 0
    } else {
      kind = 'string'
    }

    return { key, kind, value, expanded }
  })
})

function stringifyValue(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

function updateField(key: string, value: unknown) {
  const updated = { ...props.modelValue, [key]: value }
  emit('update:modelValue', updated)
}

function updateArrayItem(key: string, idx: number, raw: string) {
  const arr = [...(props.modelValue[key] as unknown[])]
  // Try to parse as number/boolean, fall back to string
  if (raw === 'true') arr[idx] = true
  else if (raw === 'false') arr[idx] = false
  else if (raw === 'null') arr[idx] = null
  else {
    const num = Number(raw)
    arr[idx] = !isNaN(num) && raw.trim() !== '' ? num : raw
  }
  emit('update:modelValue', { ...props.modelValue, [key]: arr })
}

function addArrayItem(key: string) {
  const arr = [...(props.modelValue[key] as unknown[]), '']
  emit('update:modelValue', { ...props.modelValue, [key]: arr })
}

function removeArrayItem(key: string, idx: number) {
  const arr = [...(props.modelValue[key] as unknown[])]
  arr.splice(idx, 1)
  emit('update:modelValue', { ...props.modelValue, [key]: arr })
}
</script>
