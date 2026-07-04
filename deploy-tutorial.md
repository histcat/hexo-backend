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
├── wrangler.toml          ← 只有 pages_build_output_dir 和 compatibility_date 两行
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

> Cloudflare Pages 会自动在根目录执行 `npm install`，所以 Functions 的依赖（hono / jose / js-yaml）会被安装。Build Command 只需确保前端也被构建即可。

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

---

## 常见问题

### 部署时报错 "You've run a Workers-specific command in a Pages project" 或 "Missing entry-point to Worker script"

**原因**：`wrangler.toml` 包含了 Workers 专用字段（`name`、`main`、`[vars]`、`[dev]` 等），导致 Cloudflare 误判项目类型。

**解决**：确保仓库根目录的 `wrangler.toml` **只含下面两行**，没有其他字段：

```toml
pages_build_output_dir = "client/dist"
compatibility_date = "2024-12-01"
```

> 缺少 `wrangler.toml` 也会触发这个错误——Cloudflare 需要这个文件来判断项目结构。但里面的 Workers 字段（`name`、`main`、`[vars]`）会起反作用。

### 部署成功但页面空白 / API 返回 404

检查 Cloudflare Dashboard → 项目 Settings → Functions 中 **Compatibility date** 是否太旧。建议设为 `2024-12-01` 或更新。

### 登录时报错 "JWT_SECRET environment variable is required"

环境变量没配。回到项目 Settings → Environment Variables，确认已添加 `JWT_SECRET`。

