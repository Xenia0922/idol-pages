# 地下偶像应援站模板

基于 **Astro 5 + React 19 + Tailwind CSS 3 + Cloudflare Pages** 的开箱即用地偶应援站模板。

## 功能特性

- **成员展示** — 列表 + 详情页 + 成员色主题切换
- **演出日程** — 即将到来 / 过往行程，含 Markdown 详情正文
- **画廊** — 官方精选照片 + 灯箱浏览
- **粉丝广场** — 留言板 + 返图上传（含图片审核流程）
- **特典规则** — 特典/物贩展示
- **管理后台** — 可视化编辑成员/日程/画廊/留言/站点配置
- **暗色模式** — 自适应 + 手动切换
- **响应式** — 手机/平板/桌面全适配

## 快速开始

### 1. 克隆并安装

```bash
cd 010/
npm install
```

### 2. 修改站点信息

按顺序编辑：

| 文件 | 说明 |
|------|------|
| `src/data/site.json` | 团体名称、简介、社交链接、Hero 配置 |
| `src/data/members.json` | 成员（名称、颜色、生日、照片路径） |
| `src/data/schedule.json` | 演出日程（日期、地点、参演成员） |
| `src/data/eventBodies.ts` | 活动详情正文（Markdown 格式） |
| `src/utils/members.ts` | 成员元数据（emoji、颜色映射） |
| `src/utils/eventImages.ts` | 活动 ID → 封面图路径 |
| `astro.config.mjs` | 站点域名 `site` 字段 |

### 3. 替换图片

| 路径 | 说明 |
|------|------|
| `public/logo.png` | 站点 Logo（圆形，256×256） |
| `public/hero-bg.webp` | 首页 Hero 背景 |
| `public/favicon.ico` | 浏览器标签图标 |
| `public/og-image.png` | 社交媒体分享图（1200×630） |
| `public/images/members/{id}/*.webp` | 成员照片 |
| `public/images/events/*.webp` | 活动封面图 |

### 4. 本地预览

```bash
npm run dev
# → http://localhost:4321
```

### 5. 构建

```bash
npm run build
# 产物在 dist/
```

## 部署到 Cloudflare Pages

### 创建资源

1. **Pages 项目**：Workers & Pages → Create → Pages → 连接 Git 仓库
2. **D1 数据库**：D1 → Create database
3. **R2 存储桶**：R2 → Create bucket

### 绑定资源

Pages 项目 → Settings → Bindings：
- D1：变量名 `DB`
- R2：变量名 `PHOTOS`

### 环境变量

Pages 项目 → Settings → Environment variables：

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `ADMIN_CODE` | 后台管理密码 | 是 |
| `TURNSTILE_SITE_KEY` | Turnstile site key | 否* |
| `TURNSTILE_SECRET_KEY` | Turnstile secret | 否* |

> *不配置时自动跳过人机验证

### 构建配置

- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 18+

## 后台管理

访问 `/admin` → 输入密码 → 管理：

| Tab | 功能 |
|-----|------|
| 成员 | 增删改成员信息 |
| 日程 | 增删改演出（含 Markdown 编辑器） |
| 特典 | 编辑特典规则 |
| 站点 | 编辑关于页、社交链接、Hero、屏蔽词 |
| 留言 | 删除不当留言 |
| 画廊 | 审核粉丝照片 + 编辑精选 |
| 招募 | 首页广告横幅 |

> 后台修改实时生效（写入 D1），无需重建。

## 自定义

### 主题色

- 默认：`#e83e8c`（粉色）
- 每位成员可设独立颜色（`members.json` → `color`）
- 用户点击成员色圆点切换全站主题色

### 屏蔽词

后台 "站点" Tab → "留言屏蔽词"：
- 普通文本：子串匹配（大小写不敏感）
- 正则：用 `/ /` 包裹，如 `/微信\\|wechat/i`

## 项目结构

```
├── astro.config.mjs
├── tailwind.config.mjs
├── package.json
├── .env.example
│
├── public/                 # 静态资源
│   ├── logo.png / hero-bg.webp / favicon.ico
│   └── images/
│       ├── members/{id}/   # 成员照片
│       └── events/         # 活动封面
│
├── src/
│   ├── data/               # 种子数据 (JSON)
│   │   ├── site.json / members.json / schedule.json
│   │   └── eventBodies.ts
│   ├── layouts/BaseLayout.astro
│   ├── pages/              # 路由页面
│   ├── components/         # React + Astro 组件
│   │   └── admin/          # 后台管理组件
│   ├── utils/              # 工具函数
│   └── styles/globals.css
│
├── functions/              # Cloudflare Functions (后端 API)
│   ├── _middleware.js      # SSR 数据注入
│   ├── _shared.js          # 公共工具
│   ├── _seed.js            # 数据播种
│   └── api/                # RESTful API
│       ├── events.js / members.js / gallery.js
│       ├── messages.js / photos.js / site.js
│       └── upload.js / reactions.js / recruits.js
│
└── scripts/
```

## 核心设计："零二次加载"

- 构建期：Astro SSG 预渲染完整静态 HTML
- 运行时：Cloudflare Functions 中间件注入 D1 实时数据到 `window.__SSR_DATA__`
- 客户端：React 优先读 SSR 数据，无需二次 API 请求
- 结果：首屏直出内容，无空白 loading

## 注意事项

1. `functions/` 中的 `.js` 必须纯 JS（不可含 TS 类型注解），否则 CF 部署失败
2. `src/data/` JSON 与 `functions/` SEED 应保持同步
3. 新增日程需同时在 `schedule.json` + `_seed.js` 添加
4. 成员照片建议 .webp 格式，50-100KB/张

## License

MIT
