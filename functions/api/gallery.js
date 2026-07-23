/**
 * /api/gallery — 照片画廊页数据（已独立于成员简介九宫格）
 *
 *   GET    /api/gallery
 *           → { photos:[{id,url,member,featured}], featured:[...], isAdmin }
 *             photos 来自独立的 gallery_photos 表（首次自动从成员简介九宫格
 *             复制一份快照 + 合并原 gallery_extras），之后与 members.gallery 完全解耦。
 *             featured 为精选照片列表（featured=1），前台展示"粉丝精选"板块。
 *             isAdmin 仅当请求带正确 x-admin-code 时为 true（供前台决定是否显示增删控件）
 *
 *   POST   /api/gallery  （需 ADMIN_CODE） body { url,member } → 新增一张画廊照片
 *   PUT    /api/gallery  （需 ADMIN_CODE） body { id, featured: 0|1 } → 切换精选状态
 *   PATCH  /api/gallery  （需 ADMIN_CODE） body { order:[id,...] } → 按数组顺序重排 sort
 *   DELETE /api/gallery?id=xxx （需 ADMIN_CODE） → 删除一张画廊照片
 *
 * 表 gallery_photos / gallery_meta 由本接口首次请求时自动创建（无需手动 migration）。
 */

import { adminOk, adminGuard, json } from '../_shared.js';

const DDL = `
CREATE TABLE IF NOT EXISTS gallery_photos (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  member TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gallery_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

function parseGallery(v) {
  try {
    const a = JSON.parse(v || '[]');
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

async function ensureTable(env) {
  await env.DB.prepare(DDL).run();
  // 旧表补 featured 列（幂等）
  try {
    await env.DB.prepare('ALTER TABLE gallery_photos ADD COLUMN featured INTEGER NOT NULL DEFAULT 0').run();
  } catch (e) { /* 列已存在则忽略 */ }
}

// 首次播种：把成员简介九宫格 + 原 gallery_extras 复制进独立的 gallery_photos，
// 并用 gallery_meta(seeded) 标记，避免之后被误清空时反复重生。
async function seedIfEmpty(env) {
  const cnt = await env.DB.prepare('SELECT COUNT(*) c FROM gallery_photos').first();
  if (cnt && cnt.c > 0) return;
  const seeded = await env.DB.prepare("SELECT value FROM gallery_meta WHERE key='seeded'").first();
  if (seeded) return;

  let sort = 0;
  const rows = [];

  // 1) 成员简介九宫格（快照）
  const { results: mres } = await env.DB.prepare(
    "SELECT id, gallery FROM members WHERE status='active' ORDER BY sort_order ASC, id ASC"
  ).all();
  for (const m of mres || []) {
    const arr = parseGallery(m.gallery);
    for (const url of arr) {
      if (typeof url === 'string' && url.trim()) {
        rows.push({
          id: crypto.randomUUID(),
          url: url.trim(),
          member: m.id,
          sort: sort++,
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  // 2) 合并原「画廊页独立照片」（若表存在）
  try {
    await env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS gallery_extras (id TEXT PRIMARY KEY, url TEXT NOT NULL, caption TEXT, sort INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)'
    ).run();
    const { results: eres } = await env.DB.prepare('SELECT id,url FROM gallery_extras').all();
    for (const e of eres || []) {
      if (e.url && e.url.trim()) {
        rows.push({
          id: e.id || crypto.randomUUID(),
          url: e.url.trim(),
          member: '__extra__',
          sort: sort++,
          created_at: new Date().toISOString(),
        });
      }
    }
  } catch {
    /* 旧环境没有该表则忽略 */
  }

  if (rows.length) {
    const stmt = env.DB.prepare(
      'INSERT OR IGNORE INTO gallery_photos (id,url,member,sort,created_at) VALUES (?,?,?,?,?)'
    );
    const batch = rows.map((r) => stmt.bind(r.id, r.url, r.member, r.sort, r.created_at));
    await env.DB.batch(batch);
  }
  await env.DB.prepare("INSERT OR IGNORE INTO gallery_meta (key,value) VALUES ('seeded','1')").run();
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    await ensureTable(env);
  } catch (e) {
    console.error('[gallery] ensureTable:', e.message);
  }

  // ---- 公开读取 ----
  if (request.method === 'GET') {
    try {
      await seedIfEmpty(env);
      const { results } = await env.DB.prepare(
        'SELECT id,url,member FROM gallery_photos ORDER BY sort ASC, created_at ASC'
      ).all();
      const all = (results || []).map((r) => ({
        id: r.id,
        url: r.url,
        member: r.member || '__extra__',
      }));
      return json({
        photos: all,
        isAdmin: adminOk(request, env),
      });
    } catch (e) {
      return json({ photos: [], featured: [], isAdmin: false, error: e.message }, 500);
    }
  }

  // ---- 管理员：新增照片 ----
  if (request.method === 'POST') {
    const denied = await adminGuard(request, env); if (denied) return denied;
    try {
      const b = await request.json().catch(() => ({}));
      const url = String(b.url || '').trim();
      if (!url) return json({ error: '缺少图片地址' }, 400);
      if (!/^\/api\/photos|^https?:\/\//.test(url)) {
        return json({ error: '仅支持本站图片（/api/photos?...）或 http(s) 链接' }, 400);
      }
      const max = await env.DB.prepare('SELECT COALESCE(MAX(sort),0) m FROM gallery_photos').first();
      const id = crypto.randomUUID();
      await env.DB.prepare(
        'INSERT INTO gallery_photos (id,url,member,sort,created_at) VALUES (?,?,?,?,?)'
      )
        .bind(id, url, String(b.member || '__extra__'), (max ? max.m : 0) + 1, new Date().toISOString())
        .run();
      return json({ ok: true, id });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  // ---- 管理员：切换精选 ----
  if (request.method === 'PUT') {
    const denied = await adminGuard(request, env); if (denied) return denied;
    try {
      const b = await request.json().catch(() => ({}));
      const id = String(b.id || '').trim();
      if (!id) return json({ error: '缺少 id' }, 400);
      const featured = b.featured === 1 || b.featured === true ? 1 : 0;
      // 尝试更新 featured；若列不存在则重试 ALTER TABLE 后再试
      try {
        await env.DB.prepare('UPDATE gallery_photos SET featured = ? WHERE id = ?')
          .bind(featured, id).run();
      } catch (colErr) {
        if (/no such column: featured/i.test(colErr.message || '')) {
          await env.DB.prepare('ALTER TABLE gallery_photos ADD COLUMN featured INTEGER NOT NULL DEFAULT 0').run();
          await env.DB.prepare('UPDATE gallery_photos SET featured = ? WHERE id = ?')
            .bind(featured, id).run();
        } else {
          throw colErr;
        }
      }
      return json({ ok: true, id, featured });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  // ---- 管理员：排序 ----
  if (request.method === 'PATCH') {
    const denied = await adminGuard(request, env); if (denied) return denied;
    try {
      const b = await request.json().catch(() => ({}));
      // 支持两种格式：
      //   新：{ groups: [{ member, ids:[...] }, ...] } —— 按成员分组，组内单独排序
      //   旧：{ order: [id,...] } —— 全局扁平排序（兼容保留）
      const assignments = [];
      if (Array.isArray(b.groups)) {
        let gi = 0;
        for (const grp of b.groups) {
          if (!grp || !Array.isArray(grp.ids)) continue;
          const ids = grp.ids.map(String).filter(Boolean);
          ids.forEach((id, wi) => assignments.push({ id, sort: gi * 1000000 + wi }));
          gi++;
        }
      } else if (Array.isArray(b.order)) {
        b.order.forEach((id, i) => assignments.push({ id, sort: i + 1 }));
      }
      if (!assignments.length) return json({ error: '缺少排序' }, 400);
      const stmt = env.DB.prepare('UPDATE gallery_photos SET sort = ? WHERE id = ?');
      const batch = assignments.map((a) => stmt.bind(a.sort, a.id));
      await env.DB.batch(batch);
      return json({ ok: true });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  // ---- 管理员：删除 ----
  if (request.method === 'DELETE') {
    const denied = await adminGuard(request, env); if (denied) return denied;
    try {
      const id = new URL(request.url).searchParams.get('id');
      if (!id) return json({ error: '缺少 id' }, 400);
      await env.DB.prepare('DELETE FROM gallery_photos WHERE id = ?').bind(id).run();
      return json({ ok: true });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  return new Response('Method not allowed', { status: 405 });
}
