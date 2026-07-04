# Cloudflare Workers 部署教程

单个 Worker 处理所有请求：`/api/*` 走 Hono 后端，其余走静态文件（Vue SPA）。

---

## 第一步：仓库结构

```
your-repo/
├── worker/
│   └── index.ts            ← Workers 入口（Hono + 静态资源托管）
├── server/                 ← 后端代码
│   ├── router.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── csrf.ts
│   │   └── logger.ts
│   └── services/
│       ├── github.ts
│       ├── jwt.ts
│       ├── frontmatter.ts
│       ├── config-scanner.ts
│       ├── cache.ts
│       └── env.ts
├── client/                 ← Vue 3 + Vite 前端
├── wrangler.toml           ← Workers 配置
├── package.json
└── tsconfig.json
```

---

## 第二步：部署到 Cloudflare Workers

### 方式一：命令行

```bash
npm install                  # 安装依赖
npm run build                # 构建前端
npx wrangler login           # 登录 Cloudflare（仅首次）
npx wrangler secret put JWT_SECRET   # 设置密钥（仅首次）
npm run deploy               # 部署
```

### 方式二：Dashboard（GitHub 自动部署）

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Overview**
2. **Create application** → 选择 **Workers** 标签
3. **Connect to Git** → 授权并选择仓库
4. 配置：

| 配置项 | 值 |
|--------|-----|
| **Build command** | `npm install && npm run build` |
| **Deploy command** | `npx wrangler deploy` |

5. 在 Settings → Variables 中添加 `JWT_SECRET`（点 Encrypt）
6. 部署完成后得到 `https://hexo-backend.你的用户名.workers.dev`

---

## 第三步：使用

1. 打开 Worker 域名
2. 输入 GitHub Personal Access Token 登录（需要 `repo` 权限）
3. 选择仓库 → 开始编辑

---

## 本地开发

```bash
npm install
npm run build          # 先构建前端
npx wrangler dev       # 启动本地 Worker（端口 8787）
```

---

## 常见问题

### 部署报错

确认 `wrangler.toml` 中有正确的 Worker 配置（`name`、`main`、`[assets]`）。

### 页面空白 / API 404

确认 `compatibility_date` 不早于 `2024-12-01`。

### 登录报 "JWT_SECRET required"

Worker 的环境变量没配。Dashboard → Settings → Variables → 添加 `JWT_SECRET`。命令行部署需 `npx wrangler secret put JWT_SECRET`。
