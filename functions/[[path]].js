/**
 * [[path]].js — catch-all 兜底。
 * 日程详情页 /schedule/:id 中：
 *   - 已构建的静态详情页（构建种子里的活动）→ 由 next() 直接放行（middleware 已注入 __SSR_DATA__），最快。
 *   - 后台 admin 新增的活动（不在构建种子、无静态文件）→ 本兜底按 D1 实时查询，复用站点外壳服务端渲染详情，返回 200，消除 404 闪现。
 *
 * 健壮性要点（修复 Error 1101 / HTTP 500）：
 *   - next() 在 Cloudflare 边缘对「已存在静态页」的调用可能抛异常（未捕获 → 1101/500）。
 *     故 next() 全程用 .catch 兜底；整函数再包一层 try/catch，确保任何意外都「降级返回响应」而非抛到边缘。
 *   - 若 next() 抛错/返回非 200 HTML，则回退动态渲染：查 D1 → 复用 next() 的 404 响应作外壳（轻量），
 *     若连 404 响应都拿不到再回退 fetch('/') 取站点外壳；把 <main> 替换为真实详情返回 200。
 *   - 数据库确实无此活动 → 维持 404（或 next() 异常时的兜底 404）。
 *
 * 注意：本文件为 Cloudflare Pages Functions，必须纯 JS（不可用 TS 注解）。
 */
import { marked } from "marked";

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function renderDetail(row) {
  const id = row.id;
  const title = row.title || id;

  let dateLabel = "";
  const d = new Date(row.date);
  if (!isNaN(d.getTime())) {
    dateLabel = d.getMonth() + 1 + "月" + d.getDate() + "日";
  }

  let bodyHtml = "";
  if (row.body) {
    try {
      bodyHtml = marked.parse(row.body, { async: false });
    } catch (e) {
      bodyHtml = "";
    }
  }

  const time = row.time
    ? '<span class="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-full">' +
      escapeHtml(row.time) +
      "</span>"
    : "";
  const venue = row.venue
    ? '<span class="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-full">' +
      escapeHtml(row.venue) +
      "</span>"
    : "";
  const image = row.image
    ? '<img src="' +
      escapeAttr(row.image) +
      '" alt="' +
      escapeAttr(title) +
      '" class="w-full rounded-2xl object-cover max-h-[500px] bg-gray-100 dark:bg-gray-800 mb-8" loading="lazy" decoding="async" />'
    : "";

  return (
    "\n" +
    '  <article class="max-w-3xl mx-auto px-4 py-12 md:py-16 content-enter">\n' +
    '    <a href="/schedule" class="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 mb-6">← 返回日程</a>\n' +
    '    <div class="flex flex-wrap gap-2 mb-6 text-sm">\n' +
    '      <span class="bg-pink-50 dark:bg-gray-800 text-pink-600 dark:text-pink-300 px-3 py-1.5 rounded-full font-medium">' +
    dateLabel +
    "</span>\n" +
    time +
    "\n" +
    venue +
    "\n" +
    "    </div>\n" +
    '    <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-2">' +
    escapeHtml(title) +
    "</h1>\n" +
    image +
    "\n" +
    '    <div class="event-detail">' +
    bodyHtml +
    "</div>\n" +
    "  </article>"
  );
}

function notFound() {
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    const m = path.match(/^\/schedule\/([A-Za-z0-9_-]+)$/);
    if (!m || m[1] === "index") return next();

    // 先尝试静态详情页（构建产物）。next() 在边缘可能对已存在静态页抛异常 → 用 .catch 兜底，绝不 500。
    const resp = await next().catch(() => null);
    const ct =
      resp && resp.headers && resp.headers.get
        ? resp.headers.get("Content-Type") || ""
        : "";
    if (
      resp &&
      resp.status >= 200 &&
      resp.status < 400 &&
      ct.includes("text/html")
    ) {
      return resp; // 已构建静态页，直接放行（middleware 已注入数据），最快路径
    }

    // 静态缺失或 next() 异常 → 按 D1 实时查询兜底
    const id = m[1];
    let row = null;
    try {
      if (env && env.DB) {
        const r = await env.DB.prepare("SELECT * FROM events WHERE id = ?")
          .bind(id)
          .all();
        row = r && r.results && r.results[0] ? r.results[0] : null;
      }
    } catch (e) {
      console.error("[path] d1 error", e && e.message);
    }
    if (!row) {
      // 确实不存在：维持原响应（404；若 next() 异常则给兜底 404），绝不抛异常
      return resp || notFound();
    }

    // 取外壳：优先复用 next() 的响应（404 壳最轻量）；若 next() 异常/返回 500 则回退 fetch('/') 取站点外壳
    let shellText = null;
    if (resp && resp.status < 500) {
      try {
        shellText = await resp.text();
      } catch (_) {}
    }
    if (!shellText) {
      try {
        const home = await fetch(new URL("/", request.url));
        shellText = await home.text();
      } catch (_) {}
    }
    if (!shellText) return resp || notFound();

    const mainOpen = shellText.search(/<main[\s>]/i);
    const mainClose = shellText.search(/<\/main>/i);
    if (mainOpen === -1 || mainClose === -1) return resp || notFound();

    const gt = shellText.indexOf(">", mainOpen) + 1;
    let html =
      shellText.slice(0, gt) + renderDetail(row) + shellText.slice(mainClose);
    let siteName = "Fansite";
    try {
      const siteRow = await env.DB.prepare(
        "SELECT value FROM site_config WHERE key = 'hero_config'",
      ).first();
      if (siteRow && siteRow.value) {
        const hc = JSON.parse(siteRow.value);
        if (hc && hc.title) siteName = hc.title;
      }
    } catch (_) {}
    html = html.replace(
      /<title>[\s\S]*?<\/title>/i,
      "<title>" +
        escapeHtml(row.title || id) +
        " | " +
        escapeHtml(siteName) +
        "</title>",
    );

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    // 任何意外，绝不抛到边缘（避免 1101）；降级为 404
    console.error("[path] fatal", e && e.message, e && e.stack);
    try {
      return notFound();
    } catch (_) {
      return new Response("Not Found", { status: 404 });
    }
  }
}
