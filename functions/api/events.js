/**
 * GET  /api/events          — 公开：全部日程（按日期降序）
 * GET  /api/events?id=xxx   — 公开：单条日程（含 body 日程详情）
 * GET  /api/events?all=1    — 管理：同公开（保留接口一致），需 ADMIN_CODE
 * POST /api/events          — 新建，需 ADMIN_CODE（id 必填）
 * PUT  /api/events          — 修改，需 ADMIN_CODE
 * DELETE /api/events        — 删除，需 ADMIN_CODE
 *
 * 表 events 由 ensureEvents 首次请求时自动创建并播种（无需手动 migration）。
 * ensureEvents 定义在 ../_seed.js，与 _middleware.js 共用同一份真实种子数据，
 * 杜绝曾经 schedule.js 写入虚构标题的问题。
 * body 字段存「日程详情」Markdown 正文。
 */

import { adminOk, adminGuard, json, withTable } from '../_shared.js';
import { ensureEvents } from '../_seed.js';

function parseEvent(row) {
  if (!row) return row;
  try {
    row.performers = JSON.parse(row.performers || '[]');
  } catch {
    row.performers = [];
  }
  return row;
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    await ensureEvents(env);
  } catch (e) {
    console.error('[events] ensureEvents error:', e.message);
  }

  if (request.method === 'GET') return withTable(env, ensureEvents, () => listEvents(request, env));
  if (request.method === 'POST') return withTable(env, ensureEvents, () => createEvent(request, env));
  if (request.method === 'PUT') return withTable(env, ensureEvents, () => putEvent(request, env));
  if (request.method === 'DELETE') return withTable(env, ensureEvents, () => deleteEvent(request, env));
  return new Response('Method not allowed', { status: 405 });
}

async function listEvents(request, env) {
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === '1';

  // 单条查询（含 body 日程详情）
  const id = url.searchParams.get('id');
  if (id) {
    const { results } = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).all();
    if (!results.length) return json({ error: '未找到该日程' }, 404);
    return json(parseEvent(results[0]));
  }

  if (all && !adminOk(request, env)) return json({ error: '无权限' }, 403);
  // 列表接口不查 body（最长 20000 字），节省带宽；单条查询（带 id）才返回 body
  const { results } = await env.DB.prepare(
    'SELECT id,date,time,title,venue,performers,status,image FROM events ORDER BY date DESC, id DESC'
  ).all();
  results.forEach(parseEvent);
  return json(results);
}

async function createEvent(request, env) {
  const denied = await adminGuard(request, env); if (denied) return denied;
  try {
    const b = await request.json();
    const id = String(b.id || '').trim();
    const title = String(b.title || '').trim().slice(0, 80);
    if (!id || !title) return json({ error: 'id 与标题必填' }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date || ''))) return json({ error: '日期格式应为 YYYY-MM-DD' }, 400);
    const performers = Array.isArray(b.performers) ? b.performers : [];
    await env.DB
      .prepare(
        `INSERT INTO events (id,date,time,title,venue,performers,status,image,body,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      )
      .bind(
        id,
        String(b.date),
        String(b.time || '').slice(0, 10),
        title,
        String(b.venue || '').slice(0, 80),
        JSON.stringify(performers),
        b.status === 'upcoming' || b.status === 'past' ? b.status : 'upcoming',
        String(b.image || '').slice(0, 255),
        String(b.body || '').slice(0, 20000),
        new Date().toISOString()
      )
      .run();
    return json({ ok: true, id });
  } catch (e) {
    if (/UNIQUE|primary key/i.test(e.message || '')) return json({ error: '该 id 已存在' }, 409);
    return json({ error: e.message }, 500);
  }
}

async function putEvent(request, env) {
  const denied = await adminGuard(request, env); if (denied) return denied;
  try {
    const b = await request.json();
    const id = String(b.id || '').trim();
    if (!id) return json({ error: '缺少 id' }, 400);
    const sets = [];
    const binds = [];
    if (b.title !== undefined) {
      sets.push('title = ?');
      binds.push(String(b.title).trim().slice(0, 80));
    }
    if (b.date !== undefined) {
      sets.push('date = ?');
      binds.push(String(b.date).slice(0, 10));
    }
    if (b.time !== undefined) {
      sets.push('time = ?');
      binds.push(String(b.time).slice(0, 10));
    }
    if (b.venue !== undefined) {
      sets.push('venue = ?');
      binds.push(String(b.venue || '').slice(0, 80));
    }
    if (b.performers !== undefined) {
      sets.push('performers = ?');
      binds.push(JSON.stringify(Array.isArray(b.performers) ? b.performers : []));
    }
    if (b.status !== undefined) {
      sets.push('status = ?');
      binds.push(b.status === 'upcoming' || b.status === 'past' ? b.status : 'upcoming');
    }
    if (b.image !== undefined) {
      sets.push('image = ?');
      binds.push(String(b.image || '').slice(0, 255));
    }
    if (b.body !== undefined) {
      sets.push('body = ?');
      binds.push(String(b.body || '').slice(0, 20000));
    }
    if (sets.length === 0) return json({ ok: true });
    binds.push(id);
    await env.DB.prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function deleteEvent(request, env) {
  const denied = await adminGuard(request, env); if (denied) return denied;
  try {
    const { id } = await request.json();
    if (!id) return json({ error: '缺少 id' }, 400);
    await env.DB.prepare('DELETE FROM events WHERE id = ?').bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
