/**
 * GET  /api/reactions?type=message&id=xxx  — 获取某条内容的反应统计 [{emoji, count}]
 * POST /api/reactions   { type, id, emoji } — 添加反应（IP 去重，toggle：已存在则取消）
 *
 * target_type: 'message' | 'photo'
 * target_id: message id 或 photo key
 * 预设 emoji 白名单：👍 ❤️ 😂 🥰 😢 👏
 */

import { json } from '../_shared.js';

const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '🥰', '😢', '👏'];
const ALLOWED_TYPES = new Set(['message', 'photo']);

const DDL = `CREATE TABLE IF NOT EXISTS reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  ip TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(target_type, target_id, emoji, ip)
)`;

async function ensureTable(env) {
  try {
    await env.DB.prepare(DDL).run();
  } catch (e) { /* ignore */ }
}

export async function onRequest(context) {
  const { request, env } = context;
  await ensureTable(env);

  if (request.method === 'GET') return getReactions(request, env);
  if (request.method === 'POST') return toggleReaction(request, env);
  return new Response('Method not allowed', { status: 405 });
}

async function getReactions(request, env) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  if (!type || !ALLOWED_TYPES.has(type)) {
    return json({ error: '参数无效' }, 400);
  }

  // 批量查询：?type=message&ids=id1,id2,id3 → { id1: { reactions: [{emoji,count}], mine: [emoji] }, ... }
  const idsParam = url.searchParams.get('ids');
  if (idsParam) {
    const ids = idsParam.split(',').filter(Boolean);
    if (!ids.length) return json({});
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const placeholders = ids.map(() => '?').join(',');
    const { results } = await env.DB
      .prepare(`SELECT target_id, emoji, COUNT(*) as count FROM reactions WHERE target_type = ? AND target_id IN (${placeholders}) GROUP BY target_id, emoji`)
      .bind(type, ...ids)
      .all();
    const { results: mine } = await env.DB
      .prepare(`SELECT target_id, emoji FROM reactions WHERE target_type = ? AND target_id IN (${placeholders}) AND ip = ?`)
      .bind(type, ...ids, ip)
      .all();
    const map = {};
    for (const r of (results || [])) {
      if (!map[r.target_id]) map[r.target_id] = { reactions: [], mine: [] };
      map[r.target_id].reactions.push({ emoji: r.emoji, count: r.count });
    }
    for (const m of (mine || [])) {
      if (!map[m.target_id]) map[m.target_id] = { reactions: [], mine: [] };
      map[m.target_id].mine.push(m.emoji);
    }
    return json(map);
  }

  // 单条查询：?type=message&id=xxx → [{emoji,count}]
  const id = url.searchParams.get('id');
  if (!id) return json({ error: '缺少 id 或 ids' }, 400);
  const { results } = await env.DB
    .prepare('SELECT emoji, COUNT(*) as count FROM reactions WHERE target_type = ? AND target_id = ? GROUP BY emoji')
    .bind(type, id)
    .all();
  return json(results || []);
}

async function toggleReaction(request, env) {
  try {
    const body = await request.json();
    const { type, id, emoji } = body;
    if (!type || !id || !emoji) return json({ error: '缺少参数' }, 400);
    if (!ALLOWED_TYPES.has(type)) return json({ error: '类型无效' }, 400);
    if (!ALLOWED_EMOJIS.includes(emoji)) return json({ error: 'emoji 不在白名单' }, 400);

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';

    // toggle：已存在则删除，不存在则插入
    const existing = await env.DB
      .prepare('SELECT id FROM reactions WHERE target_type = ? AND target_id = ? AND emoji = ? AND ip = ?')
      .bind(type, id, emoji, ip)
      .first();

    if (existing) {
      await env.DB
        .prepare('DELETE FROM reactions WHERE target_type = ? AND target_id = ? AND emoji = ? AND ip = ?')
        .bind(type, id, emoji, ip)
        .run();
      // 返回新的 count
      const { results } = await env.DB
        .prepare('SELECT COUNT(*) as count FROM reactions WHERE target_type = ? AND target_id = ? AND emoji = ?')
        .bind(type, id, emoji)
        .all();
      return json({ ok: true, action: 'removed', count: results[0]?.count || 0 });
    } else {
      await env.DB
        .prepare('INSERT INTO reactions (target_type, target_id, emoji, ip, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(type, id, emoji, ip, new Date().toISOString())
        .run();
      const { results } = await env.DB
        .prepare('SELECT COUNT(*) as count FROM reactions WHERE target_type = ? AND target_id = ? AND emoji = ?')
        .bind(type, id, emoji)
        .all();
      return json({ ok: true, action: 'added', count: results[0]?.count || 1 });
    }
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
