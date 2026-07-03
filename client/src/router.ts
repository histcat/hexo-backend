import type { RouteRecordRaw } from 'vue-router'
import { api } from './api'
import Login from './views/Login.vue'
import Repos from './views/Repos.vue'
import Posts from './views/Posts.vue'
import Editor from './views/Editor.vue'
import ConfigEditor from './views/ConfigEditor.vue'
import Media from './views/Media.vue'

export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/repos' },
  { path: '/login', component: Login, meta: { title: '登录' } },
  { path: '/repos', component: Repos, meta: { title: '选择仓库' } },
  { path: '/posts', component: Posts, meta: { title: '文章列表' } },
  { path: '/editor', component: Editor, meta: { title: '编辑器' } },
  { path: '/config-editor', component: ConfigEditor, meta: { title: '配置文件编辑器' } },
  { path: '/media', component: Media, meta: { title: '资源管理' } },
]

/**
 * Global navigation guard: verify JWT cookie is valid before
 * entering any protected route. Redirects to /login if not.
 */
export async function authGuard(toPath: string): Promise<boolean | string> {
  if (toPath === '/login') return true

  try {
    await api.user()
    return true
  } catch (e) {
    if ((e as { code?: string }).code === 'AUTH_REQUIRED') {
      return '/login'
    }
    // Other errors (NO_REPO_SELECTED, etc.) — let the page handle it
    return true
  }
}
