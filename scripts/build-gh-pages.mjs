// scripts/build-gh-pages.mjs
// 跨平台构建 GitHub Pages 演示站（项目页，子路径 /idol-pages/）：
//   1) 注入 GITHUB_PAGES=1 环境变量（astro.config 据此启用 base=/idol-pages/ 与正确的 site）
//   2) 运行 astro build
//   3) 运行路径前缀化脚本，补齐组件模板里手写的裸根路径（/logo.png、/members 等）
//
// 用 node 包装而非 inline env（GITHUB_PAGES=1 astro build），
// 是因为 Windows 的 cmd.exe 不支持 bash 式 VAR=val 前缀语法，
// 而 npm run 在 Windows 上用 cmd /c 包裹脚本，会导致构建失败。
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// 关键：在 astro 读取配置前注入环境变量
process.env.GITHUB_PAGES = "1";

console.log("▶ 构建 GitHub Pages 演示站（base=/idol-pages/）");
const build = spawnSync("npx", ["astro", "build"], {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
  env: process.env,
});
if (build.status !== 0) {
  console.error("❌ astro build 失败");
  process.exit(build.status ?? 1);
}

console.log("▶ 路径前缀化（/idol-pages/）");
const paths = spawnSync("node", ["scripts/gh-pages-paths.mjs"], {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
  env: process.env,
});
if (paths.status !== 0) {
  console.error("❌ 路径前缀化失败");
  process.exit(paths.status ?? 1);
}

// GitHub Pages 默认用 Jekyll 处理，会忽略 _astro/ 等下划线目录导致资源 404。
// 必须在产物里放 .nojekyll（之前是手动加到 gh-pages 分支的，这里固化进构建）。
import { writeFileSync, existsSync } from "node:fs";
if (!existsSync(join(ROOT, "dist", ".nojekyll"))) {
  writeFileSync(join(ROOT, "dist", ".nojekyll"), "");
  console.log("▶ 已写入 dist/.nojekyll（禁用 Jekyll）");
}

console.log("✅ 完成：将 dist/ 推送到 gh-pages 分支即可上线");
