# Cloudflare Pages 部署教程

无需任何命令行工具，直接在 Cloudflare 网页导入 GitHub 仓库即可运行。

---

## 第一步：确保代码已推送到 GitHub

你的仓库结构应该是这样的：

```
your-repo/
├── functions/
│   └── api/
│       └── [[route]].ts
├── server/
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
├── client/               ← Vue 3 + Vite 前端
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── wrangler.toml
├── package.json
└── tsconfig.json
```

---

## 第二步：打开 Cloudflare Dashboard

1. 访问 [dash.cloudflare.com](https://dash.cloudflare.com)
2. 左侧菜单选择 **Workers & Pages** → **Overview**
3. 点击 **Create application** → 选择 **Pages** 标签
4. 点击 **Connect to Git**
5. 授权 Cloudflare 访问你的 GitHub 账户，选择对应的仓库
6. 点击 **Begin setup**

---

## 第三步：配置构建设置

在 "Set up builds and deployments" 页面填写：

| 配置项 | 值 |
|--------|-----|
| **Production branch** | `main` |
| **Framework preset** | `None`（或选择 `Vue`） |
| **Build command** | `cd client && npm install && npm run build` |
| **Build output directory** | `client/dist` |
| **Root directory** | `/`（留空，默认为仓库根目录） |

> **重要**：由于项目有根目录的 `package.json`（Hono / jose / js-yaml 等服务端依赖）和 `client/package.json`（Vue 前端依赖），构建时需要分两步。Cloudflare Pages 会自动执行根目录的 `npm install`，所以 `wrangler.toml` 中的 `pages_build_output_dir` 已经指定了 `client/dist`。

---

## 第四步：设置环境变量

在同一个页面下方，展开 **Environment Variables**，添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `JWT_SECRET` | 点击 **Encrypt** 后输入 | 用于签发 JWT 和加密 GitHub Token |

> `JWT_SECRET` 应该是至少 32 字符的随机字符串。可以用 `openssl rand -base64 32` 生成，或者直接键盘乱敲一串。

不需要设置其他变量。

---

## 第五步：保存并部署

1. 点击 **Save and Deploy**
2. Cloudflare 会自动：
   - Clone 你的仓库
   - 安装根目录依赖（hono / jose / js-yaml）
   - 安装前端依赖（vue / vite / tailwindcss ...）
   - 构建前端（`vite build`）
   - 部署静态文件到 Pages CDN
   - 部署 `functions/` 中的 API 代码

3. 等待 2-3 分钟，部署完成后会得到一个域名：
   ```
   https://your-project-name.pages.dev
   ```

---

## 第六步：使用

1. 打开 `https://your-project.pages.dev`
2. 输入 GitHub Personal Access Token 登录
3. 选择仓库 → 开始编辑

---

## 后续更新

每次 `git push` 到 `main` 分支，Cloudflare 会自动重新部署，无需手动操作。

---

## 本地开发（可选）

如果想在本地调试：

```bash
# 安装依赖
npm install
cd client && npm install && cd ..

# 构建前端
npm run build

# 启动本地 Pages 环境（含 Functions）
npx wrangler pages dev client/dist
```

浏览器打开 `http://localhost:8788`。
