# Cloudflare Pages 部署教程

无需命令行，在 Cloudflare 网页上导入 GitHub 仓库即可。

---

## 第一步：确认仓库结构

```
your-repo/
├── functions/             ← Pages 自动识别为 Functions
│   └── api/
│       └── [[route]].ts   ← 处理所有 /api/* 请求
├── server/                ← 后端代码
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
├── client/                ← Vue 3 + Vite 前端
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── package.json           ← 只有 hono / jose / js-yaml，没有 wrangler
└── tsconfig.json
```

> **关键：仓库里不能有 `wrangler.toml`，`package.json` 里不能有 `wrangler` 或 `@cloudflare/workers-types` 依赖。** 这些东西会让 Cloudflare 误判为 Workers 项目。

---

## 第二步：在 Cloudflare 创建项目

1. 打开 [dash.cloudflare.com](https://dash.cloudflare.com)
2. 左侧菜单 **Workers & Pages** → **Overview**
3. 点击 **Create application**
4. **← 最关键的一步：选择「Pages」标签，不是「Workers」！**
5. 点击 **Connect to Git**，授权并选择仓库
6. 点击 **Begin setup**

---

## 第三步：配置构建设置

| 配置项 | 值 |
|--------|-----|
| **Production branch** | `main` |
| **Framework preset** | `None` |
| **Build command** | `cd client && npm install && npm run build` |
| **Build output directory** | `client/dist` |

> Cloudflare 会自动在根目录执行 `npm install` 安装 Functions 的依赖（hono / jose / js-yaml）。

---

## 第四步：设置环境变量

在页面下方 **Environment Variables** 中添加：

| 变量名 | 值 |
|--------|-----|
| `JWT_SECRET` | 至少 32 字符的随机字符串（点 Encrypt 加密） |

---

## 第五步：部署

点击 **Save and Deploy**，等 2-3 分钟。部署成功后会得到：
```
https://你的项目名.pages.dev
```

之后每次 `git push` 自动重新部署。

---

## 第六步：使用

1. 打开 `https://你的项目名.pages.dev`
2. 输入 GitHub Personal Access Token 登录（Token 需要 `repo` 权限）
3. 选择仓库，开始编辑

---

## 常见问题

### "Missing entry-point to Worker script" 或 "You've run a Workers-specific command in a Pages project"

三个原因，逐一排查：

1. **创建项目时选错了标签** → 删除项目，重新创建时必须选 **Pages** 标签，不能选 Workers
2. **`package.json` 里写了 `wrangler` 或 `@cloudflare/workers-types`** → 删掉
3. **仓库里有 `wrangler.toml`** → 删掉

三者同时存在时就会在两个错误之间反复跳。

### 页面空白或 API 404

检查 Cloudflare Dashboard → 项目 → Settings → Functions → **Compatibility date**，设为 `2024-12-01` 或更新。

### 登录报错 "JWT_SECRET environment variable is required"

环境变量没配。Dashboard → Settings → Environment Variables → 添加 `JWT_SECRET`。

---

## 本地开发（可选）

```bash
npm install
cd client && npm install && cd ..
npm run build
npx wrangler pages dev client/dist
```

浏览器打开 `http://localhost:8788`。本地用的 `wrangler` 不要提交到 `package.json`。
