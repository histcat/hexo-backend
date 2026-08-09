# hexo-backend — Astro 博客在线编辑器

给存放在 GitHub 仓库里的 Astro 博客（hexo 风格 frontmatter）提供一个随时随地在浏览器里打开即可编辑的在线界面：登录后选择仓库，直接在浏览器里增删改文章、编辑配置文件、上传图片，所有变更通过 GitHub API 提交回你的博客仓库。

- 后端：Hono（Vercel Serverless Function，Node.js 运行时）
- 前端：Vue 3 + Vite + TailwindCSS
- 鉴权：GitHub Personal Access Token（用户自备），会话使用 JWT HttpOnly Cookie，GitHub Token 经 AES-256-GCM 加密后存入 JWT
- 部署：Vercel 一键部署，前端静态资源与 API 同源托管，无需自己购买服务器

---

## 目录

- [一键部署到 Vercel](#一键部署到-vercel)
- [环境变量](#环境变量)
- [本地开发](#本地开发)
- [项目结构](#项目结构)
- [使用说明](#使用说明)
- [安全说明](#安全说明)
- [常见问题](#常见问题)

---

## 一键部署到 Vercel

点击下方按钮，把仓库导入 Vercel 即可完成部署：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyour-username%2Fhexo-backend&env=JWT_SECRET)

> 按钮链接里的 `your-username/hexo-backend` 是占位地址。发布前请把它替换为你自己的 GitHub 仓库地址（URL 编码后的完整地址），或直接复制下面的链接到浏览器后修改：
>
> `https://vercel.com/new/clone?repository-url=<你的仓库地址>&env=JWT_SECRET`

部署步骤：

1. 点击上方按钮，用 GitHub 账号登录 Vercel；
2. Vercel 会自动导入仓库并读取 `vercel.json` 中的构建配置；
3. 按向导提示填写环境变量 `JWT_SECRET`（至少 32 位的随机字符串）；
4. 点击 **Deploy**，等待 1~2 分钟即可访问部署好的地址。

部署完成后，把 `JWT_SECRET` 保存好。Vercel 的 Preview 环境会为每次提交自动生成预览地址，Production 环境对应你的正式域名。

### 手动部署（命令行）

```bash
npm install
npm run build        # 构建前端到 client/dist
npx vercel login
npx vercel --prod    # 或 npm run deploy
```

### 手动部署（Dashboard）

1. 打开 [Vercel Dashboard](https://vercel.com) → **Add New** → **Project**；
2. 导入本仓库，框架选择 **Other**（`vercel.json` 已配置好 Build Command 与 Output Directory）；
3. 在 **Environment Variables** 中添加 `JWT_SECRET`；
4. 点击 **Deploy**。

---

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `JWT_SECRET` | 是 | 用于签发会话 JWT 并加密 GitHub Token。至少 32 位随机字符串，修改后所有已登录会话立即失效 |

生成一个随机密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Vercel 会自动注入 `VERCEL_ENV` / `NODE_ENV`，无需手动配置。

---

## 本地开发

前置要求：Node.js >= 20、npm。

```bash
# 1. 安装根目录依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# Windows: copy .env.example .env

# 3. 启动 API 服务（http://localhost:8000）
npm run dev:api

# 4. 另开一个终端，安装并启动前端（http://localhost:5173）
cd client
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`，Vite 会把 `/api` 请求代理到 `http://localhost:8000`，与生产环境同源调用保持一致。

本地开发时的鉴权 Cookie 通过 `http://localhost` 生效（Chrome/Edge 将 localhost 视为安全上下文）；如遇到登录后立刻失效的问题，请确认浏览器允许 Cookie，或在 `server/services/env.ts` 中检查 `isProduction()` 的判定。

---

## 项目结构

```
hexo-backend/
├── api/
│   └── [[...all]].ts        # Vercel Serverless Function 入口，转发所有 /api/* 请求
├── server/                  # 后端（与部署平台无关的 Hono 应用）
│   ├── app.ts               # Hono 应用入口（环境变量注入、CORS、路由挂载）
│   ├── dev.ts               # 本地开发服务器（@hono/node-server，默认 8000）
│   ├── router.ts            # 全部 /api/* 端点（认证、仓库、文章、配置、媒体）
│   ├── middleware/          # auth（JWT）、csrf（Double Submit Cookie）、logger
│   ├── services/            # github、jwt、frontmatter、config-scanner、cache、env
│   └── types.ts             # 共享类型定义
├── client/                  # 前端 SPA（Vite + Vue 3 + TailwindCSS）
│   └── src/
│       ├── views/           # Login、Repos、Posts、Editor、ConfigEditor、Media
│       ├── components/      # 可复用组件（Markdown 编辑器、代码编辑器、表单等）
│       ├── composables/     # useDraftStore（IndexedDB 草稿）
│       ├── router.ts        # Vue Router 路由
│       └── api.ts           # 后端 API 调用封装
├── vercel.json              # Vercel 构建 / 函数 / 路由配置
├── package.json
└── README.md
```

---

## 使用说明

### 1. 登录

1. 打开部署后的地址，页面会自动跳转到 `/login`；
2. 创建一个 GitHub Personal Access Token（[github.com/settings/tokens](https://github.com/settings/tokens)），勾选 **repo** 权限（完整仓库读写）；
3. 粘贴 Token 并点击「登录」。后端会用该 Token 调用 GitHub API 验证身份，验证通过后签发 JWT 并写入 HttpOnly Cookie。

### 2. 选择仓库

1. 登录后显示你有写权限的所有仓库；
2. 点击你的博客仓库（例如 `my-blog`）；
3. 后端自动读取仓库根目录的 `.astro-editor.yml` 配置；没有该文件时使用默认配置（文章目录 `src/content/posts/`，folder 布局）。

### 3. 编辑文章

1. 文章列表显示配置目录下的所有 `.md` / `.mdx` 文件，支持按分类 / 标签筛选和搜索；
2. 点击「新建文章」进入编辑器（新建模式），点击已有文章进入编辑模式；
3. 左侧为 frontmatter 动态表单（字段由 `.astro-editor.yml` 定义）和 Markdown 编辑区，右侧为实时预览；
4. 支持加粗、斜体、标题、链接、行内代码、代码块、列表、引用、图片上传等工具栏操作，`Ctrl+S` 保存；
5. 每 3 秒自动将草稿保存到 IndexedDB（离线可用）；
6. 支持重命名 / 移动 / 删除文章。

### 4. 编辑配置文件

1. 在文章列表页切换到「配置文件」Tab；
2. 列表显示仓库中的 JSON / YAML / TOML 等配置文件；
3. 在线编辑并保存，保存前会校验 JSON / YAML 语法。

### 5. 媒体管理

1. 在「媒体」页浏览仓库中的图片（按配置的 `assetsPublicDir` 或 `postsDir` 扫描）；
2. 支持图片上传（PNG / JPG / GIF / SVG / WebP / BMP，单文件不超过 10 MB），上传后自动返回 URL 可插入文章。

---

## 安全说明

- GitHub Token 仅在服务端使用，前端不可见；Token 经 AES-256-GCM 加密后存放在 JWT 中，密钥由 `JWT_SECRET` 派生；
- 会话 Cookie 为 HttpOnly + SameSite=Lax，生产环境（Vercel）自动启用 Secure；
- 所有写操作（POST / PUT / PATCH / DELETE）均需通过 CSRF 校验（Double Submit Cookie 模式）；
- `JWT_SECRET` 是唯一的部署密钥，请妥善保管，不要提交到仓库；泄露或修改后，所有已登录会话立即失效，需要重新登录。

---

## 常见问题

### 打开网站提示 "A server error has occurred" / "Unexpected token 'A', ... is not valid JSON"

这是前端调用 `/api/*` 时收到了 Vercel 的 500 错误页（不是 JSON）。历史上有两个常见原因：

1. 函数入口使用了 Next.js 风格的 named exports（`export const GET = ...`），而 Vercel 普通函数要求 default export，导致所有 API 请求返回 `FUNCTION_INVOCATION_FAILED`；
2. 旧部署运行在缺少全局 Web Crypto 的 Node 18 运行时，导致 CSRF Token 生成崩溃。

请确认部署的是最新代码（函数入口为 `export default handle(app)`、`package.json` 中 `engines.node >= 20`，并已包含 Web Crypto 兼容修复）；如仍复现，可在 Vercel 项目的 **Functions** 日志中查看具体报错。

### 登录 / 接口报 "JWT_SECRET is not configured"

没有配置 `JWT_SECRET`。在 Vercel 项目 **Settings → Environment Variables** 中添加该变量后重新部署；本地开发时在根目录 `.env` 中配置。

### 部署后页面能打开但接口 404

确认 `vercel.json` 存在且 `api/[[...all]].ts` 未被删除；`/api/*` 请求由该 Serverless Function 处理，其余路径回退到 `index.html`（SPA 路由）。

### 登录后操作报 CSRF 校验失败

刷新页面重新获取 CSRF Token；确认浏览器允许 Cookie（尤其是浏览器隐私模式 / 第三方 Cookie 限制）。

### GitHub API 限流（403 / rate limit）

服务端对 GitHub API 结果做了内存缓存（文章列表 5 分钟、仓库树 3 分钟等），限流会在冷启动后自然恢复；频繁触发可稍等片刻再试。

### 大仓库或大量文件导致接口超时

`vercel.json` 已将 API 函数的最大执行时长设置为 60 秒；若仍超时，可减少 `postsDir` 下的文件数量或调整缓存。

### 之前的 Cloudflare Workers / Deno 部署

本项目已迁移为 Vercel 部署，`wrangler.toml`、`worker/` 目录及旧部署教程均已移除。核心 API 逻辑（`server/`）与前端（`client/`）保持不变。

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 部署 | Vercel（静态托管 + Serverless Function） |
| 后端 | Hono、jose（JWT / AES-GCM）、js-yaml |
| 前端 | Vue 3、Vite、TailwindCSS、marked、highlight.js、KaTeX |
| 数据源 | GitHub REST API（仓库、Contents、Trees） |
