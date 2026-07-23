# idol-pages

地下偶像应援站模板 —— 开箱即用，部署到 Cloudflare Pages 就能跑。

**[在线 Demo](https://xenia0922.github.io/idol-pages/)** · **[一键部署教程](#部署)**

> Astro 5 · React 19 · Tailwind CSS 3 · Cloudflare D1 · Cloudflare R2

## 功能

| 模块 | 说明 |
|------|------|
| 成员 | 列表 / 详情 / 成员色主题切换 |
| 日程 | 即将到来 / 过往行程 / Markdown 详情正文 |
| 画廊 | 官方精选照片 + 灯箱浏览 |
| 广场 | 留言板 + 粉丝返图上传 + 审核流程 |
| 特典 | 特典规则展示 |
| 后台 | 可视化编辑所有内容，无需改代码 |
| 其他 | 暗色模式 / 移动端 / SEO / RSS |

## 快速开始

```bash
git clone https://github.com/Xenia0922/idol-pages.git my-fansite
cd my-fansite
npm install
npm run dev          # http://localhost:4321
```

### 然后改这些文件

按顺序来：

1. **`src/data/site.json`** —— 团体名、简介、社交链接
2. **`src/data/members.json`** —— 成员信息
3. **`src/data/schedule.json`** —— 演出日程
4. **`src/data/eventBodies.ts`** —— 活动详情正文（Markdown）
5. **`src/utils/members.ts`** —— 成员 emoji / 颜色映射（和 members.json 里的 id 对应）
6. **`src/utils/eventImages.ts`** —— 活动封面图路径
7. **`astro.config.mjs`** —— 把 `site` 改成你的域名

### 替换图片

| 文件 | 说明 | 建议 |
|------|------|------|
| `public/logo.png` | 站点 Logo | 256×256 圆形 |
| `public/hero-bg.webp` | 首页 Hero 背景 | 1920×1080 |
| `public/favicon.ico` | 浏览器图标 | 32×32 |
| `public/og-image.png` | 社交分享图 | 1200×630 |
| `public/apple-touch-icon.png` | iOS 桌面图标 | 180×180 |
| `public/images/members/{id}/*.webp` | 成员照片 | 800×800 以上 .webp |
| `public/images/events/*.webp` | 活动封面 | 1200×630 .webp |

> 图片用 .webp 格式，单张 50–100KB。成员照片按 `成员id_01.webp`、`成员id_02.webp` 命名。

---

## 部署

部署到 Cloudflare Pages（免费额度足够中小规模应援站使用）。

### 1. 创建 D1 数据库

Cloudflare Dashboard → Workers & Pages → D1 → Create database（名称随意，如 `fansite-db`）

### 2. 创建 R2 存储桶

Cloudflare Dashboard → R2 → Create bucket（名称随意，如 `fansite-photos`）

### 3. 创建 Pages 项目

Workers & Pages → Create → Pages → Connect to Git → 选你的仓库

构建配置：
- Build command: `npm run build`
- Output directory: `dist`

### 4. 绑定资源

Pages 项目 → Settings → Bindings：

| 类型 | 变量名 | 值 |
|------|--------|-----|
| D1 database | `DB` | 第一步创建的数据库 |
| R2 bucket | `PHOTOS` | 第二步创建的存储桶 |

### 5. 配置环境变量

Settings → Environment variables：

| 变量名 | 说明 |
|--------|------|
| `ADMIN_CODE` | 后台登录密码（**必需**） |
| `TURNSTILE_SITE_KEY` | Turnstile site key（可选） |
| `TURNSTILE_SECRET_KEY` | Turnstile secret（可选） |

> Turnstile 不配置会自动跳过，不影响使用。

### 6. 部署

回到 Deployments → Deploy。首次 1–2 分钟。完成后得到一个 `*.pages.dev` 域名。

### 7. 验证

部署完依次检查：

- [ ] 首页打开，Hero 区域显示你的团体名
- [ ] `/members` 看到成员列表
- [ ] `/schedule` 看到日程
- [ ] `/admin` 输入密码进入后台
- [ ] 后台新增成员成功 → D1 正常
- [ ] 后台上传图片成功 → R2 正常

---

## 后台

访问 `/admin`，输入 `ADMIN_CODE` 密码登录：

| Tab | 能做什么 |
|-----|----------|
| 成员 | 增删改、排序、上传照片 |
| 日程 | 增删改演出、Markdown 正文编辑器 |
| 特典 | 编辑规则、上传示例图 |
| 站点 | 关于页文案、社交链接、Hero 配置、屏蔽词 |
| 留言 | 删除不当留言 |
| 画廊 | 审核粉丝返图、编辑官方精选 |
| 招募 | 管理首页广告横幅 |

> 后台修改**即时生效**（写 D1），无需重新构建。

---

## 调试

### 部署后页面空白 / 报错

看 Cloudflare Dashboard 的构建日志（Deployments → 最新一条 → View logs）。注意 `functions/` 下的 `.js` 文件不能写 TypeScript 类型注解。

### 后台看不到数据

正常现象。首次部署时 D1 数据库为空，API 会自动建表并播种 `src/data/` 中的种子数据。等几秒刷新即可。

### 粉丝上传图片后不显示

图片进入 `uploads/pending/` 待审核。去后台「画廊」Tab 审核通过后公开展示。

### Turnstile 加载不出来

国内网络下 Turnstile 可能慢。模板是 **fail-open** 设计：验证码加载失败自动放行。

### 改默认粉色主题

`src/components/ColorTheme.astro` 第 17 行改 `DEFAULT` 变量，或全局搜索 `#e83e8c` 替换。

---

## 架构

```
Astro 5 (SSG)         构建时预渲染全部页面为静态 HTML
React 19 (孤岛)        交互组件（后台、留言、画廊……）
Tailwind CSS 3         原子化样式 + 玻璃拟态
Cloudflare Pages       托管 + 边缘函数
  ├── D1 (SQLite)      数据库
  └── R2 (对象存储)     粉丝上传图片
```

**零二次加载**：构建期静态 HTML 已含完整内容；运行时中间件注入 D1 最新数据到 `window.__SSR_DATA__`；React 优先读 SSR 数据，无需额外 API 请求。首屏直出，无 loading 空白。

---

## 项目结构

```
├── src/
│   ├── data/          种子数据（site.json / members.json / schedule.json / eventBodies.ts）
│   ├── pages/         页面路由
│   ├── components/    React + Astro 组件
│   │   └── admin/     后台管理面板
│   ├── layouts/       布局
│   ├── utils/         工具函数
│   └── styles/        全局样式
├── public/            静态资源（图片、favicon）
├── functions/         Cloudflare Functions
│   ├── _middleware.js SSR 数据注入（核心）
│   └── api/           RESTful API
├── astro.config.mjs
├── .env.example       环境变量模板
└── LICENSE            MIT
```

## License

MIT —— 自由使用、修改、商用，保留版权声明即可。
