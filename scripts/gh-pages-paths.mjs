// scripts/gh-pages-paths.mjs
// GitHub Pages 项目页（https://<user>.github.io/idol-pages/）部署后处理：
// 把 dist/ 中所有"本地根绝对路径"（/logo.png、/members、/favicon.ico 等）
// 统一加上子路径前缀 /idol-pages/。
//
// 背景：Astro 的 base 配置只会改写它自己生成的 CSS/JS 与 sitemap，
// 组件模板里手写的 href="/members"、src="/logo.png" 等裸路径不会被加前缀，
// 导致在子路径下这些资源/路由 404。本脚本补齐这部分。
//
// 安全规则（避免误改）：
//  - 跳过协议相对路径  //...
//  - 跳过 /api/...       （GitHub Pages 无 Cloudflare Functions 后端，调用会 404，属预期，保持原样）
//  - 跳过已带 /idol-pages/ 的路径（幂等，可重复执行）
//  - 含协议的外链 https://... 引号后不是 /，自然被排除

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "..", "dist");
const BASE = "/idol-pages/";

const EXT = /\.(html|js|css|json|xml|webmanifest|txt)$/i;

// 引号紧跟 / 的本地路径：  "/x" 或 '/x'
const RE_QUOTE = /(["'])(\/)(?!\/)(?!api\/)(?!idol-pages\/)/g;
// CSS 裸写法 url(/...)（无引号）：  url(/x)
const RE_URL = /url\(\s*(\/)(?!\/)(?!api\/)(?!idol-pages\/)/g;

function rewrite(text) {
  return text
    .replace(RE_QUOTE, `$1${BASE}`)
    .replace(RE_URL, `url(${BASE}`);
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
    } else if (EXT.test(name)) {
      const before = readFileSync(full, "utf8");
      const after = rewrite(before);
      if (after !== before) writeFileSync(full, after);
    }
  }
}

if (!statSync(DIST, { throwIfNoEntry: false })) {
  console.error("❌ 未找到 dist/，请先运行 GITHUB_PAGES=1 npm run build");
  process.exit(1);
}
walk(DIST);
console.log(`✅ GitHub Pages 路径前缀化完成（前缀 ${BASE}）`);
