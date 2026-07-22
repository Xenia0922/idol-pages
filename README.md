# idol-pages

> 地下偶像应援站模板 — Astro 5 + React 19 + Tailwind CSS 3 + Cloudflare Pages

开箱即用的地偶粉丝站。含成员展示、演出日程、画廊、粉丝广场、管理后台。

[在线 Demo](https://xenia0922.github.io/idol-pages/) · [GitHub](https://github.com/Xenia0922/idol-pages)

## 功能

| 模块 | 说明 |
|------|------|
| 成员 | 列表 + 详情页 + 成员色主题切换 |
| 日程 | 即将到来 / 过往行程，含 Markdown 详情正文 |
| 画廊 | 官方精选照片 + 灯箱浏览 |
| 粉丝广场 | 留言板 + 返图上传（含图片审核流程） |
| 特典 | 特典/物贩规则展示 |
| 后台 | 可视化编辑成员、日程、画廊、留言、站点配置 |
| 其他 | 暗色模式、移动端适配、SEO |

## 快速开始（本地）

```bash
git clone https://github.com/Xenia0922/idol-pages.git my-fansite
cd my-fansite
npm install
npm run dev        # → http://localhost:4321
```

### 定制你的站点

按顺序改这几个文件：

1. **`src/data/site.json`** — 团体名、简介、社交链接
2. **`src/data/members.json`** — 成员信息（名称、颜色、生日、照片路径）
3. **`src/data/schedule.json`** — 演出日程
4. **`src/data/eventBodies.ts`** — 活动详情正文（Markdown）
5. **`src/utils/members.ts`** — 成员 emoji/颜色映射
6. **`src/utils/eventImages.ts`** — 活动 ID → 封面图路径
7. **`astro.config.mjs`** — 改 `site` 为你的域名

### 替换图片

| 文件 | 用途 | 建议尺寸 |
|------|------|----------|
| `public/logo.png` | 站点 Logo | 256×256 |
| `public/hero-bg.webp` | 首页 Hero 背景 | 1920×1080 |
| `public/favicon.ico` | 浏览器图标 | 32×32 |
| `public/og-image.png` | 社交分享图 | 1200×630 |
| `public/images/members/{id}/*.webp` | 成员照片 | 800×800+ |
| `public/images/events/*.webp` | 活动封面 | 1200×630 |

> 图片用 .webp 格式，单张控制在 50-100KB。目录结构参考 `public/images/members/` 和 `public/images/events/` 下的 README。

---

## 部署到 Cloudflare Pages（完整教程）

### 前提

- 一个 [Cloudflare](https://dash.cloudflare.com) 账号（免费）
- 你的代码已推送到 GitHub 仓库

### 第一步：创建 D1 数据库

1. Cloudflare Dashboard → **Workers & Pages** → **D1**
2. 点击 **Create database**
3. 名称随意（如 `fansite-db`），点 **Create**

### 第二步：创建 R2 存储桶

1. Cloudflare Dashboard → **R2**
2. 点击 **Create bucket**
3. 名称随意（如 `fansite-photos`），点 **Create bucket**

### 第三步：创建 Pages 项目

1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 选择你的 GitHub 仓库，点 **Begin setup**
3. 构建配置：
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. 先不要点 Deploy——先配环境变量和绑定

### 第四步：绑定 D1 和 R2

在 Pages 项目设置页面往下翻到 **Bindings**：

1. 点 **Add binding** → 类型选 **D1 database**
   - **Variable name**: `DB`（必须叫这个名字）
   - **D1 database**: 选第一步创建的
2. 再点 **Add binding** → 类型选 **R2 bucket**
   - **Variable name**: `PHOTOS`（必须叫这个名字）
   - **R2 bucket**: 选第二步创建的

### 第五步：配置环境变量

在 **Settings** → **Environment variables**：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `ADMIN_CODE` | 你自己设的密码 | 后台 /admin 登录用 |
| `TURNSTILE_SITE_KEY` | （可选） | Cloudflare Turnstile site key |
| `TURNSTILE_SECRET_KEY` | （可选） | Turnstile secret key |

> Turnstile 用于粉丝留言/上传时的人机验证。国内网络加载可能不稳定，**不配置会自动跳过**，不影响正常使用。

### 第六步：部署

回到 **Deployments** → 点 **Deploy**。

首次部署需要 1-2 分钟。部署完成后，Cloudflare 会给你一个 `*.pages.dev` 的域名。

### 第七步：绑定自定义域名（可选）

1. Pages 项目 → **Custom domains**
2. 输入你的域名（如 `fansite.example.com`）
3. 按提示在域名 DNS 处添加 CNAME 记录

---

## 部署验证清单

部署完成后，依次检查：

- [ ] 首页能正常打开，Hero 区域显示你的团体名和 Logo
- [ ] 访问 `/members` 看到你的成员列表
- [ ] 访问 `/schedule` 看到你的演出日程
- [ ] 访问 `/admin` 输入密码能进入后台
- [ ] 后台能成功新增/编辑成员（验证 D1 正常工作）
- [ ] 后台能上传图片（验证 R2 正常工作）

---

## 调试指南

### 本地开发正常，部署后页面空白/报错

1. 检查 Cloudflare Dashboard 的部署日志（Pages → 你的项目 → Deployments → 点最新的 → View logs）
2. 常见问题：`functions/` 目录下的 `.js` 文件不要写 TypeScript 类型注解（如 `: string`），CF esbuild 打包时不支持

### 后台登录后看不到任何数据

这是正常的——首次部署时 D1 数据库是空的，API 会自动建表和播种。刷新页面或等几秒，种子数据（`src/data/` 中的内容）会自动写入。

### 粉丝上传图片后看不到

图片上传后进入 `uploads/pending/` 目录（待审核状态）。需要去后台 **画廊** Tab 审核通过后才会公开展示。

### Turnstile 验证码加载不出来（国内用户）

跳过即可。Turnstile 在国内网络环境下加载慢是正常的。这个模板设计为 **fail-open**：未配置 Turnstile 或加载失败时自动放行，不影响使用。

### 想改站点默认粉色主题

编辑 `src/styles/globals.css`，搜索 `#e83e8c` 替换为你的主色。或修改 `src/components/ColorTheme.astro` 第 17 行的 `DEFAULT` 变量。

---

## 后台管理

访问 `https://你的域名/admin` → 输入 `ADMIN_CODE` 密码：

| Tab | 功能 |
|-----|------|
| **成员** | 增删改成员（名称、颜色、照片、社交链接） |
| **日程** | 增删改演出（含 Markdown 正文编辑器） |
| **特典** | 编辑特典规则 + 上传示例图片 |
| **站点** | 编辑关于页文案、社交链接、Hero 配置、屏蔽词 |
| **留言** | 删除不当留言 |
| **画廊** | 审核粉丝照片 + 编辑官方精选 |
| **招募** | 首页广告横幅管理 |

> 后台修改**即时生效**（写入 D1 数据库），无需重新构建部署。

---

## 架构

```
Astro 5 (SSG)        ← 构建时生成静态 HTML
React 19 (孤岛)       ← 交互组件（后台面板、留言板、画廊……）
Tailwind CSS 3        ← 玻璃拟态设计系统
Cloudflare Pages      ← 托管 + 边缘函数
  ├── D1 (SQLite)     ← 数据库（成员、日程、留言、配置）
  └── R2 (对象存储)    ← 粉丝上传图片
```

**核心设计：零二次加载** — 构建期静态 HTML + 运行时中间件注入实时数据，首屏直出内容，无空白 loading。

---

## 项目结构

```
├── src/
│   ├── data/              # 种子数据（site.json, members.json, schedule.json）
│   ├── pages/             # 路由页面
│   ├── components/        # React + Astro 组件
│   │   └── admin/         # 后台管理
│   ├── layouts/           # 页面布局
│   ├── utils/             # 工具函数
│   └── styles/            # 全局样式
├── public/                # 静态资源（图片、favicon 等）
├── functions/             # Cloudflare Functions（后端 API）
│   ├── _middleware.js     # SSR 数据注入
│   └── api/               # RESTful API（events, members, gallery...）
├── astro.config.mjs
├── tailwind.config.mjs
└── .env.example           # 环境变量模板
```

## License

MIT — 自由使用、修改、商用。只需保留版权声明。
