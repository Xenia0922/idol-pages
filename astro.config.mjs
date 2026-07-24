// @ts-check
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

// 部署目标切换（通过环境变量）：
//   默认 / Cloudflare Pages（README 主推）：npm run build
//   GitHub Pages 演示站（子路径 /idol-pages/）：GITHUB_PAGES=1 npm run build
const isGitHubPages = process.env.GITHUB_PAGES === "1";

const config = {
  // GitHub Pages 项目页必须用真实仓库地址，否则资源全部 404
  site: isGitHubPages
    ? "https://xenia0922.github.io/idol-pages/"
    : "https://your-group.pages.dev", // ← 部署到 Cloudflare 时改为你的 pages.dev 域名
  integrations: [tailwind(), react(), sitemap()],
  output: "static",
  build: { inlineStylesheets: "auto" },
};

// GitHub Pages 项目页位于子路径 /idol-pages/，必须设置 base；
// Cloudflare Pages 部署在根路径，不设置 base（使用默认 "/"）
if (isGitHubPages) {
  config.base = "/idol-pages/";
}

export default defineConfig(config);
