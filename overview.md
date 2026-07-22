# 地下偶像应援站模板

> Astro 5 + React 19 + Tailwind 3 + Cloudflare Pages (D1 + R2)

## 这是什么？

一个开箱即用的地下偶像团体非官方粉丝应援站模板。从 Gleams 应援站抽离而来，保留了完整的前后端架构。

## 功能

- 成员展示（列表 + 详情 + 成员色主题切换）
- 演出日程（即将到来 + 过往行程 + Markdown 详情正文）
- 画廊（官方精选 + 灯箱浏览）
- 粉丝广场（留言板 + 返图上传 + 图片审核）
- 特典规则
- 管理后台（可视化编辑，无需改代码）
- 暗色模式 + 移动端适配

## 快速上手

1. `npm install`
2. 修改 `src/data/site.json` — 团体基本信息
3. 修改 `src/data/members.json` — 成员信息
4. 替换 `public/` 中的图片（logo, hero-bg, 成员/活动照片）
5. `npm run dev` 预览
6. 部署到 Cloudflare Pages（详见 README.md）

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Astro 5 (SSG 静态生成) |
| UI | React 19 (交互孤岛) + Tailwind CSS 3 |
| 后端 | Cloudflare Pages Functions |
| 数据库 | Cloudflare D1 (SQLite) |
| 存储 | Cloudflare R2 (粉丝上传图片) |
