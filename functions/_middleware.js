/**
 * _middleware.js — 拦截所有 HTML 响应，注入 D1 最新数据。
 * React 组件通过 window.__SSR_DATA__ 读取，不再客户端 fetch（避免影响布局的二次加载）。
 *
 * 注入内容：
 *   - siteConfig      所有页面（SiteBits 等）
 *   - events          首页 / 成员 / 画廊 / 日程（列表与详情）
 *   - event           日程详情页 /schedule/:id（含 body，供 EventDetail 直接渲染，免 fetch）
 *   - members         首页 / 成员
 *   - galleryPhotos   画廊（成员分组图）
 *   - featuredFan     画廊「粉丝精选」区（已由 R2 解析出 url，免二次 fetch）
 */
import { ensureEvents } from "./_seed.js";
import { listPhotosData } from "./api/photos.js";
import { marked } from "marked";

const EVENT_DDL = `CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, date TEXT, time TEXT, title TEXT, venue TEXT, performers TEXT, status TEXT, image TEXT, body TEXT, created_at TEXT)`;
const MEMBER_DDL = `CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, name TEXT, nameJP TEXT, color TEXT, emoji TEXT, birthday TEXT, constellation TEXT, status TEXT, image TEXT, gallery TEXT, weibo TEXT, weiboName TEXT, weiboDesc TEXT, intro TEXT, sort_order INTEGER DEFAULT 0)`;
const GALLERY_DDL = `CREATE TABLE IF NOT EXISTS gallery_photos (id TEXT PRIMARY KEY, url TEXT NOT NULL, member TEXT, sort INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`;
const SITE_DDL = `CREATE TABLE IF NOT EXISTS site_config (key TEXT PRIMARY KEY, value TEXT)`;

async function ensureTables(env) {
  try {
    await env.DB.batch([
      env.DB.prepare(EVENT_DDL),
      env.DB.prepare(MEMBER_DDL),
      env.DB.prepare(GALLERY_DDL),
      env.DB.prepare(SITE_DDL),
    ]);
  } catch (e) {
    /* ignore */
  }
}

async function fetchEvents(env) {
  const { results } = await env.DB.prepare(
    "SELECT id,date,time,title,venue,performers,status,image FROM events ORDER BY date DESC",
  ).all();
  return (results || []).map((r) => {
    let performers = [];
    try {
      performers = JSON.parse(r.performers || "[]");
    } catch {}
    return { ...r, performers };
  });
}

async function fetchPageData(path, env) {
  const data = {};

  // Turnstile site key（从环境变量读取，注入前端 widget 用）
  data.turnstileSiteKey = env.TURNSTILE_SITE_KEY || null;

  // 所有页面都可能需要 site_config (SiteBits 组件)
  try {
    const { results } = await env.DB.prepare(
      "SELECT key, value FROM site_config",
    ).all();
    if (results && results.length) {
      const cfg = {};
      for (const r of results) {
        try {
          cfg[r.key] = [
            "tokuten_rules",
            "tokuten_images",
            "featured_square",
            "hero_config",
            "blocked_words",
          ].includes(r.key)
            ? JSON.parse(r.value)
            : r.value;
          // 防御旧 bug 数据：hero_config 曾被 updateConfig 存为 '[]'，强制转为 {}
          if (r.key === "hero_config" && Array.isArray(cfg[r.key]))
            cfg[r.key] = {};
        } catch {
          cfg[r.key] = r.value;
        }
      }
      data.siteConfig = cfg;
    }
  } catch {}

  // 首页 / 成员页 / 日程页 / 画廊页 都需要 events
  if (
    path === "/" ||
    path === "/members" ||
    path === "/gallery" ||
    path === "/fans" ||
    path.startsWith("/schedule")
  ) {
    try {
      let events = null;
      try {
        events = await fetchEvents(env);
      } catch (e) {
        // D1 偶发超时/错误，重试一次
        console.error("[middleware] fetchEvents first try failed:", e.message);
        events = await fetchEvents(env);
      }
      // 全新 D1：首次访问时确保已播种真实数据，再取一次
      if (!events || !events.length) {
        await ensureEvents(env);
        events = await fetchEvents(env);
      }
      data.events = events || [];
    } catch (e) {
      console.error("[middleware] fetchEvents all retries failed:", e.message);
    }
  }

  // 首页 / 成员页 需要 members
  if (path === "/" || path === "/members" || path.startsWith("/members/")) {
    try {
      const { results } = await env.DB.prepare(
        "SELECT id,name,nameJP,color,emoji,birthday,constellation,status,image,gallery,weibo,weiboName,weiboDesc,intro,sort_order FROM members ORDER BY sort_order ASC, id ASC",
      ).all();
      data.members = (results || []).map((r) => {
        let gallery = [];
        try {
          gallery = JSON.parse(r.gallery || "[]");
        } catch {}
        return { ...r, gallery };
      });
    } catch {}
  }

  // 画廊页 / 粉丝广场页需要成员 meta（分组显示/筛选）
  if (path === "/gallery" || path === "/fans") {
    try {
      const { results } = await env.DB.prepare(
        "SELECT id,name,emoji,color FROM members WHERE status='active' ORDER BY sort_order ASC, id ASC",
      ).all();
      data.membersMeta = results || [];
    } catch {}
  }

  // 画廊页需要 gallery photos + 粉丝精选（已解析 url，免二次 fetch）
  if (path === "/gallery") {
    try {
      const { results } = await env.DB.prepare(
        "SELECT id,url,member FROM gallery_photos ORDER BY sort ASC, created_at ASC",
      ).all();
      data.galleryPhotos = results || [];
    } catch {}
    try {
      const fs = await env.DB.prepare(
        "SELECT value FROM site_config WHERE key='featured_square'",
      ).first();
      const featuredSquare = fs?.value ? JSON.parse(fs.value) : [];
      const featuredKeys = Array.isArray(featuredSquare)
        ? featuredSquare
            .map((e) => (typeof e === "string" ? e : e.key))
            .filter(Boolean)
        : [];
      if (featuredKeys.length) {
        const photos = await listPhotosData(env);
        const keySet = new Set(featuredKeys);
        data.featuredFan = photos.filter((p) => keySet.has(p.key));
      } else {
        data.featuredFan = [];
      }
    } catch {}
  }

  // 日程详情页：注入单条完整 event（含 body + bodyHtml），EventDetail 直接渲染，无需 fetch、无需客户端异步加载 marked
  const m = path.match(/^\/schedule\/([\w-]+)$/);
  if (m && m[1] !== "index") {
    try {
      const { results } = await env.DB.prepare(
        "SELECT * FROM events WHERE id = ?",
      )
        .bind(m[1])
        .all();
      if (results && results.length) {
        const row = results[0];
        try {
          row.performers = JSON.parse(row.performers || "[]");
        } catch {
          row.performers = [];
        }
        // 服务端预渲染 body 为 HTML，客户端 Get 到即可直接使用，无需异步加载 marked
        if (row.body) {
          try {
            row.bodyHtml = marked.parse(row.body, { async: false });
          } catch {
            row.bodyHtml = "";
          }
        } else {
          row.bodyHtml = "";
        }
        data.event = row;
      }
    } catch {}
  }

  return data;
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// hero 栏可自定义：对 `/` 路径，按 D1 hero_config 替换 data-hero 元素（首屏直出最新值，无闪烁）。
// 替换失败（匹配不到）则保留原样，不影响渲染。
function applyHero(html, hero, weiboDesc) {
  if (!hero) return html;
  if (hero.title) {
    html = html.replace(
      /(<[^>]*data-hero="title"[^>]*>)([\s\S]*?)(<\/[a-z0-9]+>)/i,
      (m, a, _c, b) => a + escapeHtml(hero.title) + b,
    );
  }
  if (hero.subtitle) {
    html = html.replace(
      /(<[^>]*data-hero="subtitle"[^>]*>)([\s\S]*?)(<\/[a-z0-9]+>)/i,
      (m, a, _c, b) => a + escapeHtml(hero.subtitle) + b,
    );
  }
  // desc 复用 weibo_desc
  if (weiboDesc) {
    html = html.replace(
      /(<[^>]*data-hero="desc"[^>]*>)([\s\S]*?)(<\/[a-z0-9]+>)/i,
      (m, a, _c, b) => a + escapeHtml(weiboDesc) + b,
    );
  }
  if (hero.logo) {
    // src 可能在 data-hero 前或后，先匹配整个 img 标签再替换其 src（与属性顺序无关）
    html = html.replace(/<img[^>]*data-hero="logo"[^>]*>/i, (m) =>
      m.replace(/\bsrc="[^"]*"/i, `src="${escapeHtml(hero.logo)}"`),
    );
  }
  if (hero.bg || hero.bgOpacity != null || hero.bgPosition != null) {
    // bg img：替换 src + 替换 style（--bg-opacity + object-position）
    const opacity = hero.bgOpacity != null ? hero.bgOpacity : 0.22;
    const pos = hero.bgPosition || "center center";
    html = html.replace(/<img[^>]*data-hero="bg"[^>]*>/i, (m) => {
      let out = m;
      if (hero.bg) {
        out = out.replace(/\bsrc="[^"]*"/i, `src="${escapeHtml(hero.bg)}"`);
      }
      // bg img 的 style 只含 --bg-opacity 与 object-position，整段替换安全
      const newStyle = `--bg-opacity:${opacity};object-position:${escapeHtml(pos)}`;
      if (/\bstyle="[^"]*"/i.test(out)) {
        out = out.replace(/\bstyle="[^"]*"/i, `style="${newStyle}"`);
      } else {
        out = out.replace(/\/?>/, ` style="${newStyle}"$&`);
      }
      return out;
    });
  }
  return html;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 只处理 HTML 页面请求
  const isPage =
    !path.startsWith("/api/") &&
    !path.startsWith("/_astro/") &&
    !path.match(/\.(js|css|png|jpg|jpeg|webp|svg|ico|json|xml|txt|woff2?)$/i) &&
    !path.startsWith("/admin");

  if (!isPage) return next();

  // 获取原始响应
  const response = await next();

  // 只处理 HTML 响应
  const ct = response.headers.get("Content-Type") || "";
  if (!ct.includes("text/html")) return response;

  try {
    await ensureTables(env);
    const pageData = await fetchPageData(path, env);

    if (Object.keys(pageData).length === 0) return response;

    // 注入数据脚本（转义 < 防止数据含 </script> 破坏 HTML，JSON.parse 自动还原）
    const html = await response.text();
    const dataStr = JSON.stringify(pageData).replace(/</g, "\\u003c");
    const dataScript = `<script>window.__SSR_DATA__=${dataStr};</script>`;
    let modified = html.replace("</body>", dataScript + "</body>");
    // hero 栏可自定义：对 `/` 路径替换 data-hero 元素（首屏直出 D1 最新值，无闪烁）
    if (
      path === "/" &&
      pageData.siteConfig &&
      pageData.siteConfig.hero_config
    ) {
      modified = applyHero(
        modified,
        pageData.siteConfig.hero_config,
        pageData.siteConfig.weibo_desc,
      );
    }

    const respHeaders = new Headers(response.headers);
    respHeaders.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
    return new Response(modified, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
    });
  } catch (e) {
    console.error("[middleware] error:", e.message);
    return response;
  }
}
