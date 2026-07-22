/**
 * GET  /api/recruits        — 公开：返回当前有效招募（enabled=1 且未过期），按 sort_order 升序，取首条
 * GET  /api/recruits?all=1 — 管理：返回全量（含禁用/过期），需 ADMIN_CODE
 * POST /api/recruits        — 新建，需 ADMIN_CODE
 * PUT  /api/recruits        — 修改，需 ADMIN_CODE
 * DELETE /api/recruits      — 删除，需 ADMIN_CODE
 *
 * 表 recruits 由本接口在首次请求时自动创建（CREATE TABLE IF NOT EXISTS），
 * 无需在 Cloudflare 控制台手动执行 migration。
 */

import { adminOk, adminGuard, json, withTable } from '../_shared.js';
import { rateAllow, rateLog } from './_rate.js';

const DDL = `CREATE TABLE IF NOT EXISTS recruits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT,
  body TEXT NOT NULL,
  cta_text TEXT NOT NULL DEFAULT '查看详情',
  cta_url TEXT NOT NULL,
  deadline TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);`;

// 与项目内其余 D1 调用一致，用 prepare().run() 建表（exec 在部分 D1 环境下不可靠）
async function ensureTable(env) {
  await env.DB.prepare(DDL).run();
  try { await env.DB.prepare('ALTER TABLE recruits ADD COLUMN subtitle TEXT').run(); } catch (e) { /* 已存在则忽略 */ }
  try {
    const { results } = await env.DB.prepare('SELECT COUNT(*) AS c FROM recruits').all();
    if (results[0] && results[0].c === 0) {
      await env.DB
        .prepare(
          `INSERT INTO recruits (title, subtitle, body, cta_text, cta_url, deadline, enabled, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          '研修生招募',
          '公主风王道系地下偶像团体',
          '微博转发关注抽 52 元偶活基金',
          '查看详情 →',
          '',
          '2026-08-10',
          1,
          0,
          new Date().toISOString()
        )
        .run();
    }
  } catch (e) { console.error('[recruits] seed failed:', e.message); }
}

export async function onRequest(context) {
  const { request, env } = context;
  try { await ensureTable(env); } catch (e) { console.error('[recruits] ensureTable error:', e.message); }
  if (request.method === 'GET') return withTable(env, ensureTable, () => listRecruits(request, env));
  if (request.method === 'POST') return withTable(env, ensureTable, () => createRecruit(request, env));
  if (request.method === 'PUT') return withTable(env, ensureTable, () => putRecruit(request, env));
  if (request.method === 'DELETE') return withTable(env, ensureTable, () => deleteRecruit(request, env));
  return new Response('Method not allowed', { status: 405 });
}

async function listRecruits(request, env) {
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === '1';

  if (all) {
    // 服务端登录尝试限制：30 分钟 5 次（前端 localStorage 可绕过，这里兜底）
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const allowed = await rateAllow(env, ip, 'admin', 5, 30 * 60 * 1000);
    if (!allowed) return json({ error: '尝试过多，请30分钟后再试' }, 429);
    if (!adminOk(request, env)) {
      await rateLog(env, ip, 'admin');
      return json({ error: '无权限' }, 403);
    }
    const { results } = await env.DB
      .prepare('SELECT * FROM recruits ORDER BY sort_order ASC, id DESC')
      .all();
    return json(results);
  }

  // 公开：启用中的广告（自动清理过期广告 + 返回有效广告）
  // deadline 可为 'YYYY-MM-DD'（当天 23:59:59 过期）或 'YYYY-MM-DDTHH:MM'（具体时刻过期）
  try {
    const { results: all } = await env.DB
      .prepare('SELECT id, deadline FROM recruits WHERE enabled = 1')
      .all();
    const now = Date.now();
    const expiredIds = (all || []).filter(r => {
      if (!r.deadline) return false;
      let end;
      if (r.deadline.length > 10) {
        end = new Date(r.deadline + ':00+08:00');
      } else {
        end = new Date(r.deadline + 'T23:59:59+08:00');
      }
      return now > end.getTime();
    }).map(r => r.id);
    // 批量删除过期广告
    for (const id of expiredIds) {
      await env.DB.prepare('DELETE FROM recruits WHERE id = ?').bind(id).run();
    }
  } catch (e) {
    console.error('[recruits] cleanup failed:', e.message);
  }

  const { results } = await env.DB
    .prepare(
      `SELECT id, title, subtitle, body, cta_text, cta_url, deadline
       FROM recruits
       WHERE enabled = 1
       ORDER BY sort_order ASC, id DESC LIMIT 10`
    )
    .all();
  return json(results);
}

async function createRecruit(request, env) {
  const denied = await adminGuard(request, env); if (denied) return denied;
  try {
    const b = await request.json();
    const title = String(b.title || '').trim().slice(0, 60);
    const subtitle = b.subtitle ? String(b.subtitle).trim().slice(0, 60) : '';
    const body = String(b.body || '').trim().slice(0, 200);
    const cta_text = String(b.cta_text || '查看详情 →').trim().slice(0, 40);
    const cta_url = String(b.cta_url || '').trim().slice(0, 500);
    const deadline = b.deadline ? String(b.deadline).slice(0, 16) : null;
    const enabled = b.enabled === false || b.enabled === 0 ? 0 : 1;
    let sort_order = Number.isFinite(+b.sort_order) ? +b.sort_order : 0;
    // 未指定或 <=0 时自动排到已有广告之后
    if (!sort_order || sort_order < 0) {
      const { results } = await env.DB.prepare('SELECT MAX(sort_order) AS m FROM recruits').all();
      const maxSo = results[0] && results[0].m != null ? results[0].m : 0;
      sort_order = maxSo + 1;
    }

    if (!title || !body || !cta_url) return json({ error: '标题 / 正文 / 链接必填' }, 400);
    if (!/^https?:\/\//.test(cta_url)) return json({ error: '链接需以 http(s):// 开头' }, 400);

    const info = await env.DB
      .prepare(
        `INSERT INTO recruits (title, subtitle, body, cta_text, cta_url, deadline, enabled, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(title, subtitle, body, cta_text, cta_url, deadline, enabled, sort_order, new Date().toISOString())
      .run();

    return json({ ok: true, id: info.meta ? info.meta.last_row_id : null });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// PUT 入口：body 含 order 数组 → 批量重排；否则单条更新
async function putRecruit(request, env) {
  const denied = await adminGuard(request, env); if (denied) return denied;
  try {
    const b = await request.json();
    if (Array.isArray(b.order)) return reorderRecruits(b.order, env);
    return updateRecruit(b, env);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function reorderRecruits(order, env) {
  for (const item of order) {
    const id = +item.id;
    const so = Number.isFinite(+item.sort_order) ? +item.sort_order : 0;
    if (id) {
      await env.DB.prepare('UPDATE recruits SET sort_order = ? WHERE id = ?').bind(so, id).run();
    }
  }
  return json({ ok: true });
}

async function updateRecruit(b, env) {
  try {
    const id = +b.id;
    if (!id) return json({ error: '缺少 id' }, 400);

    const sets = [];
    const binds = [];
    if (b.title !== undefined) { sets.push('title = ?'); binds.push(String(b.title).trim().slice(0, 60)); }
    if (b.subtitle !== undefined) { sets.push('subtitle = ?'); binds.push(String(b.subtitle).trim().slice(0, 60)); }
    if (b.body !== undefined) { sets.push('body = ?'); binds.push(String(b.body).trim().slice(0, 200)); }
    if (b.cta_text !== undefined) { sets.push('cta_text = ?'); binds.push(String(b.cta_text).trim().slice(0, 40)); }
    if (b.cta_url !== undefined) {
      const u = String(b.cta_url).trim().slice(0, 500);
      if (u && !/^https?:\/\//.test(u)) return json({ error: '链接需以 http(s):// 开头' }, 400);
      sets.push('cta_url = ?'); binds.push(u);
    }
    if (b.deadline !== undefined) { sets.push('deadline = ?'); binds.push(b.deadline ? String(b.deadline).slice(0, 16) : null); }
    if (b.enabled !== undefined) { sets.push('enabled = ?'); binds.push(b.enabled === false || b.enabled === 0 ? 0 : 1); }
    if (b.sort_order !== undefined) { sets.push('sort_order = ?'); binds.push(Number.isFinite(+b.sort_order) ? +b.sort_order : 0); }

    if (sets.length === 0) return json({ ok: true });
    binds.push(id);
    await env.DB.prepare(`UPDATE recruits SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function deleteRecruit(request, env) {
  const denied = await adminGuard(request, env); if (denied) return denied;
  try {
    const { id } = await request.json();
    if (!id) return json({ error: '缺少 id' }, 400);
    await env.DB.prepare('DELETE FROM recruits WHERE id = ?').bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
