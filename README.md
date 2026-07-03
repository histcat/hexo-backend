# hexo-backend — Astro 博客在线编辑器

给存放在 GitHub 仓库里的 Astro 博客（hexo 风格 frontmatter）提供一个随时随地打开即可编辑的在线界面。

- 后端：Deno Deploy + Hono
- 前端：Vue 3 + TailwindCSS
- 鉴权：GitHub Personal Access Token（用户自备），JWT HttpOnly Cookie

---

## 目录

- [环境要求](#环境要求)
- [项目结构](#项目结构)
- [本地开发](#本地开发)
  - [启动后端](#启动后端)
  - [启动前端](#启动前端)
  - [TLS 证书问题（Windows）](#tls-证书问题windows)
- [完整测试流程](#完整测试流程)
  - [第一步：创建 GitHub Personal Access Token](#第一步创建-github-personal-access-token)
  - [第二步：启动服务](#第二步启动服务)
  - [第三步：浏览器端操作](#第三步浏览器端操作)
  - [第四步：用 curl 测试 API](#第四步用-curl-测试-api)
- [部署到 Deno Deploy](#部署到-deno-deploy)
- [常用命令](#常用命令)

---

## 环境要求

- **Deno** ≥ 2.x（[安装指南](https://deno.com/)）
- **Node.js** ≥ 18 + npm（前端 Vite 构建用）
- **GitHub 账号** + 一个有写权限的博客仓库

---

## 项目结构

```
hexo-backend/
├── main.ts                  # Hono 入口，Deno Deploy fetch handler
├── deno.json                # Deno 配置（tasks, imports）
├── server/                  # 后端
│   ├── router.ts            # 路由注册（所有 /api/* 端点）
│   ├── middleware/           # 中间件（auth, csrf, logger）
│   ├── services/            # 业务逻辑（github, jwt, frontmatter, config-scanner, cache）
│   └── types.ts             # 共享类型定义
├── client/                  # 前端 SPA（Vite + Vue 3）
│   ├── src/
│   │   ├── views/           # 页面组件（Login, Repos, Posts, Editor, ConfigEditor, Media）
│   │   ├── components/      # 可复用组件（PostForm, MarkdownEditor, CodeEditor, ConfigForm...）
│   │   ├── composables/     # 组合式函数（useDraftStore / IndexedDB 草稿）
│   │   ├── router.ts        # Vue Router 路由
│   │   └── api.ts           # 后端 API 调用封装
│   └── public/              # PWA manifest + Service Worker
└── tests/                   # 测试（待补充）
```

---

## 快速开始

### 1. 配置环境变量

```bash
# 复制 .env.example 为 .env
cp .env.example .env

# 生成一个随机的 JWT_SECRET（已有可跳过）
deno eval "console.log(Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join(''))"
# 把输出的字符串替换 .env 中的 JWT_SECRET 值
```

> `.env` 文件已加入 `.gitignore`，不会提交到仓库。Deno 需要 `--env-file=.env` 才会加载。

### 2. 启动后端

```bash
# 推荐：使用 deno task（已配置好 --env-file 和 TLS）
deno task dev

# 或者手动指定：
DENO_TLS_CA_STORE=system deno run --allow-net --allow-env --allow-read --env-file=.env --watch main.ts

# 后端运行在 http://localhost:8000
```

### 3. 启动前端

```bash
cd client
npm install
npm run dev

# 前端运行在 http://localhost:5173
# Vite 自动将 /api 请求代理到 localhost:8000
```

### TLS 证书问题（Windows）

Windows 下 Deno 可能报 `invalid peer certificate: UnknownIssuer`，无法连接 `api.github.com`。这是因为 Deno 默认使用自带的 Mozilla 证书库，与某些 Windows 环境不兼容。

**解决方案：** 启动时加 `DENO_TLS_CA_STORE=system` 使用系统证书（`deno task dev` 已内置）。

验证 TLS 是否正常：

```bash
DENO_TLS_CA_STORE=system deno eval '
  const res = await fetch("https://api.github.com")
  console.log("GitHub API:", res.status)
'
# 输出：GitHub API: 200  ← 正常
```

验证 TLS 是否正常：

```bash
DENO_TLS_CA_STORE=system deno eval '
  const res = await fetch("https://api.github.com")
  console.log("GitHub API:", res.status)
'
# 输出：GitHub API: 200  ← 正常
```

---

## 完整测试流程

### 第一步：创建 GitHub Personal Access Token

1. 打开 https://github.com/settings/tokens
2. 点击 **Generate new token (classic)**
3. 设置一个名字（如 `hexo-backend`）
4. 勾选 **repo** 权限（完整的仓库读写权限）
5. 点击 **Generate token**
6. 复制生成的 `ghp_xxxxxxxxxxxxxxxxxxxx`（**只显示一次，务必保存好**）

> 这个 Token 就是你的"密码"。服务端会用它调用 GitHub API 读取/写入你的博客仓库。Token 只在服务端内存中存在，前端不可见，存入 HttpOnly Cookie 中。

### 第二步：启动服务

打开两个终端：

**终端 1 — 后端：**

```bash
DENO_TLS_CA_STORE=system deno run --allow-net --allow-env --allow-read main.ts
```

看到 `Listening on http://localhost:8000/` 表示启动成功。

**终端 2 — 前端：**

```bash
cd client
npm run dev
```

看到 `http://localhost:5173/` 表示启动成功。

### 第三步：浏览器端操作

打开 `http://localhost:5173`，按以下流程操作：

#### 3.1 登录

1. 页面自动跳转到 `/login`
2. 粘贴你的 GitHub PAT（`ghp_xxx`）
3. 点击"登录"
4. 后端验证 Token → 签发 JWT → 存入 HttpOnly Cookie → 跳转仓库列表

#### 3.2 选择仓库

1. 列表显示你有写权限的所有仓库
2. 点击你的博客仓库（如 `my-blog`）
3. 后端自动读取仓库根目录的 `.astro-editor.yml` 配置文件
4. 如果仓库中没有这个文件，使用默认配置（文章目录 `src/content/posts/`，文件夹布局）

#### 3.3 文章列表

1. 显示 `src/content/posts/` 下所有 `.md` / `.mdx` 文件
2. 顶部分类/标签筛选 + 搜索框
3. 右侧 Tab 可切换「文章」/「配置文件」
4. 点击"新建文章"跳转到编辑器（新建模式）
5. 点击文章进入编辑器（编辑模式）

#### 3.4 编辑文章

1. **顶部标题栏**：返回、标题、保存状态、保存按钮、更多菜单（重命名/删除）
2. **左侧**：动态 frontmatter 表单（字段由 `.astro-editor.yml` 定义）+ Markdown 编辑区（带格式工具栏）
3. **右侧**：Markdown 实时预览
4. **工具栏功能**：加粗、斜体、标题、链接、行内代码、代码块、列表、引用、图片上传
5. **快捷键**：`Ctrl+S` 保存
6. **自动草稿**：每 3 秒自动保存到 IndexedDB（离线可用）
7. **图片上传**：点工具栏图片按钮 → 选择文件 → 自动上传并插入 `![alt](url)`

#### 3.5 配置文件编辑

1. 在文章列表页切换到「配置文件」Tab
2. 列表显示仓库中的 JSON / YAML / TOML / 配置文件
3. 点击进入配置编辑器
4. **代码模式**：带行号的代码编辑器
5. **表单模式**（JSON / YAML）：结构化表单视图，支持嵌套对象、数组增删

#### 3.6 资源管理

1. 顶栏"资源"按钮进入 `/media`
2. 上传区域：拖拽或点击选择图片（支持 PNG / JPEG / GIF / SVG / WebP，最大 10 MB）
3. 网格显示已上传的图片，可复制链接

### 第四步：用 curl 测试 API

如果你没有浏览器或想直接测试后端 API：

```bash
# ── 1. 获取 CSRF Token ──────────────────────────────────────────

# CSRF 机制：Double Submit Cookie
# 服务端在 /api/config 响应中同时返回 Cookie (hexo_csrf) 和 Body (csrfToken)
# 后续所有非 GET 请求必须同时发送 Cookie 和 X-CSRF-Token Header，且值必须一致

CSRF=$(curl -s http://localhost:8000/api/config \
  | grep -o '"csrfToken":"[^"]*"' \
  | sed 's/"csrfToken":"//;s/"//')

echo "CSRF Token: $CSRF"


# ── 2. 健康检查 ──────────────────────────────────────────────────

curl -s http://localhost:8000/api/health | python3 -m json.tool
# 返回: { "ok": true, "data": { "status": "ok", "runtime": "deno",
#         "githubRateLimit": null, "warning": null } }


# ── 3. 登录 ──────────────────────────────────────────────────────

# 注意：CSRF Cookie 和 X-CSRF-Token Header 必须使用同一个 Token 值
curl -v -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Cookie: hexo_csrf=$CSRF" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"token":"你的_ghp_xxx_TOKEN"}'

# 成功响应（200）：
# { "ok": true, "data": { "user": { "id": 12345, "login": "你的用户名", ... } } }
# 同时 Set-Cookie: hexo_session=<JWT>; HttpOnly; Secure; SameSite=Lax
# 后续请求自动携带此 Cookie

# 失败响应（401）：
# { "ok": false, "error": { "code": "TOKEN_INVALID", "message": "..." } }


# ── 4. 获取当前用户信息 ──────────────────────────────────────────

# 登录成功后，用 hexo_session Cookie 访问需要鉴权的端点
curl -s -b /tmp/cookies http://localhost:8000/api/user


# ── 5. 列出仓库 ──────────────────────────────────────────────────

curl -s -b /tmp/cookies http://localhost:8000/api/repos
# 返回你有写权限的仓库列表


# ── 6. 选择仓库 ──────────────────────────────────────────────────

curl -s -b /tmp/cookies -X POST http://localhost:8000/api/repo/select \
  -H "Content-Type: application/json" \
  -H "Cookie: hexo_csrf=$CSRF" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"owner":"你的用户名","name":"你的博客仓库名"}'
# 返回仓库配置和默认分支信息
# 服务端重新签发 JWT，包含 selectedRepo + repoConfig


# ── 7. 列出文章 ──────────────────────────────────────────────────

curl -s -b /tmp/cookies "http://localhost:8000/api/posts?page=1&pageSize=10"
# 支持筛选：?tag=xxx&category=xxx&q=搜索关键词


# ── 8. 读取单篇文章 ─────────────────────────────────────────────

curl -s -b /tmp/cookies \
  "http://localhost:8000/api/posts/src/content/posts/my-post/index.md"


# ── 9. 新建文章（文件夹布局） ────────────────────────────────────

curl -s -b /tmp/cookies -X POST http://localhost:8000/api/posts \
  -H "Content-Type: application/json" \
  -H "Cookie: hexo_csrf=$CSRF" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{
    "path": "new-post",
    "frontmatter": { "title": "我的新文章", "tags": ["demo"] },
    "content": "## 开始写作\n\n这是一篇测试文章。",
    "commitMessage": "新建：我的新文章"
  }'


# ── 10. 更新文章 ─────────────────────────────────────────────────

curl -s -b /tmp/cookies -X PUT \
  "http://localhost:8000/api/posts/src/content/posts/new-post/index.md" \
  -H "Content-Type: application/json" \
  -H "Cookie: hexo_csrf=$CSRF" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{
    "sha": "上一步返回的 sha",
    "frontmatter": { "title": "修改后的标题" },
    "content": "更新后的内容..."
  }'


# ── 11. 重命名/移动文章 ──────────────────────────────────────────

curl -s -b /tmp/cookies -X PATCH \
  "http://localhost:8000/api/posts/src/content/posts/old-name/index.md" \
  -H "Content-Type: application/json" \
  -H "Cookie: hexo_csrf=$CSRF" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{
    "newPath": "src/content/posts/new-name/index.md",
    "sha": "当前文件 sha"
  }'


# ── 12. 删除文章 ─────────────────────────────────────────────────

curl -s -b /tmp/cookies -X DELETE \
  "http://localhost:8000/api/posts/src/content/posts/my-post/index.md" \
  -H "Content-Type: application/json" \
  -H "Cookie: hexo_csrf=$CSRF" \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"sha":"文件 sha"}'


# ── 13. 列出配置文件 ─────────────────────────────────────────────

curl -s -b /tmp/cookies http://localhost:8000/api/config-files


# ── 14. 读取单个配置文件 ────────────────────────────────────────

curl -s -b /tmp/cookies \
  "http://localhost:8000/api/config-files/.astro-editor.yml"


# ── 15. 上传图片 ─────────────────────────────────────────────────

curl -s -b /tmp/cookies -X POST http://localhost:8000/api/media \
  -H "Cookie: hexo_csrf=$CSRF" \
  -H "X-CSRF-Token: $CSRF" \
  -F "file=@/path/to/your/image.png"
# 注意：/api/media 使用 multipart/form-data，不是 JSON


# ── 16. 列出已上传的图片 ─────────────────────────────────────────

curl -s -b /tmp/cookies "http://localhost:8000/api/media?page=1&pageSize=20"


# ── 17. 登出 ──────────────────────────────────────────────────────

curl -s -b /tmp/cookies -X POST http://localhost:8000/api/auth/logout \
  -H "Cookie: hexo_csrf=$CSRF" \
  -H "X-CSRF-Token: $CSRF"
# 清除 hexo_session Cookie
```

---

## 部署到 Deno Deploy

### 1. 安装 deployctl

```bash
deno install -A --global jsr:@deno/deployctl
```

### 2. 设置环境变量

在 Deno Deploy 控制台添加：

| 变量 | 值 |
|------|-----|
| `JWT_SECRET` | 一个随机字符串（越长越好，用于签发 JWT） |
| `DENO_ENV` | `production` |

生成随机 JWT_SECRET：
```bash
deno eval "console.log(Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join(''))"
```

### 3. 构建并部署

```bash
# 构建前端
cd client && npm run build && cd ..

# 部署
deployctl deploy --project=hexo-backend main.ts
```

Deno Deploy 会自动分发到全球边缘节点。

---

## 常用命令

```bash
# 后端开发
deno task dev               # 启动 Hono 开发服务器（--watch 热重载）

# 前端开发
deno task dev:client        # 启动 Vite dev server（http://localhost:5173）

# 构建
deno task build             # 构建前端静态资源（vue-tsc + vite build）

# 部署
deno task deploy            # 部署到 Deno Deploy

# 类型检查（后端）
deno check server/router.ts

# 类型检查（前端）
cd client && npx vue-tsc --noEmit
```

---

## 仓库配置文件（.astro-editor.yml）

放在博客仓库根目录，用于自定义编辑器行为。完整示例：

```yaml
repo:
  postsDir: src/content/posts/          # 文章目录
  layout: folder                         # "folder" | "flat"
  assets:
    mode: co-located                     # "co-located" | "public"
    publicDir: public/images/blog
    naming: "{slug}-{yyyy}{mm}{dd}-{rand6}"
  extensions: [".md", ".mdx"]
  configFilePatterns:
    - "*.json"
    - "*.yml"
    - "*.yaml"
    - "*.toml"
    - "astro.config.*"
    - "*.config.*"
    - ".env.example"

workflow:
  saveMode: direct                       # V1 仅 direct
  commitMessageTemplate: "edit: {title}"

frontmatter:
  required: ["title"]
  defaults:
    draft: false
    tags: []
    category: ""
  fields:
    - key: title
      type: string
      label: 标题
      required: true
    - key: published
      type: date
      label: 发布日期
    - key: tags
      type: string[]
      label: 标签
    - key: category
      type: string
      label: 分类
    - key: abbrlink
      type: string
      label: 永久链接标识
    - key: description
      type: string
      label: 摘要
    - key: cover
      type: string
      label: 封面图

editor:
  previewTheme: system
  autoSaveIntervalMs: 5000

permissions:
  allowUsers: []                         # GitHub 用户名白名单，空则不限
```
