/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 说说 Worker 地址（可选，也可在页面里手动填写并保存） */
  readonly VITE_SHUOSHUO_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
