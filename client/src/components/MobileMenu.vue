<template>
  <div class="relative sm:hidden">
    <button
      @click="open = !open"
      class="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
      title="更多"
      type="button"
    >
      <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="5" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="19" cy="12" r="1.6" />
      </svg>
    </button>

    <div v-if="open" class="fixed inset-0 z-10" @click="open = false"></div>
    <div
      v-if="open"
      class="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
    >
      <button
        v-for="item in items"
        :key="item.label"
        @click="item.onClick(); open = false"
        class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
        type="button"
      >
        {{ item.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

export interface MobileMenuItem {
  label: string
  onClick: () => void
}

defineProps<{ items: MobileMenuItem[] }>()

const open = ref(false)
</script>
