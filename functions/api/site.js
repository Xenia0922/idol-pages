/**
 * GET  /api/site — 公开：返回站点可编辑内容（关于页文字、特典规则/图、各平台链接）
 * PUT  /api/site — 管理：更新部分字段（upsert），需 ADMIN_CODE
 *
 * 表 site_config 为 key-value，首次请求自动建表并播种（来自 site.json + 关于/特典 硬编码文案）。
 */

import { adminOk, adminGuard, json, withTable } from '../_shared.js';

const DDL = `CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT
);`;

// 允许的字段（白名单，防止写入无关 key）
const ALLOWED = [
  'about_worldview', 'about_intro',
  'weidian', 'staff_qq',
  'tokuten_rules', 'tokuten_images',
  'featured_square',
  'weibo', 'weibo_name', 'weibo_desc',
  'xiaohongshu', 'douyin',
  'hero_config',
  'blocked_words',
];

const SEED = {
  about_worldview: '「在这里写下你们团体的世界观设定，可以是奇幻故事、日常设定，或者任何你们想传达的理念。」',
  about_intro: 'XXX 是一支来自[你的城市]的地下偶像团体。成员们以[角色设定]的身份活跃于 Livehouse 和动漫展会。',
  weidian: '',
  staff_qq: '',
  tokuten_rules: JSON.stringify([
    '特典规则以官方发布为准',
    '团切仅在个人队列开始前售卖10分钟',
    '电切可通过官方渠道预约',
    '详细规则请关注官方账号获取最新信息',
  ]),
  tokuten_images: JSON.stringify([]),
  weibo: '',
  weibo_name: '@你的团体微博',
  weibo_desc: '非官方粉丝应援站 ✨',
  xiaohongshu: '',
  douyin: '',
  hero_config: JSON.stringify({
    title: 'Your Idol Group',
    subtitle: '在这里写下你们团体的简介标语',
    logo: '/logo.png',
    bg: '/hero-bg.webp',
    bgOpacity: 0.22,
    bgPosition: 'center center',
  }),
  blocked_words: JSON.stringify(['加微信', '加qq', '代购', '兼职', '招募代理', 'http://', 'https://']),
};
};

async function ensureTable(env) {
  await env.DB.prepare(DDL).run();
  try {
    const { results } = await env.DB.prepare('SELECT COUNT(*) AS c FROM site_config').all();
    if (results[0] && results[0].c === 0) {
      for (const [k, v] of Object.entries(SEED)) {
        await env.DB.prepare('INSERT INTO site_config (key, value) VALUES (?, ?)').bind(k, v).run();
      }
    }
  } catch (e) { console.error('[site] seed failed:', e.message); }
}

const JSON_KEYS = new Set(['tokuten_rules', 'tokuten_images', 'featured_square', 'hero_config', 'blocked_words']);

async function loadConfig(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM site_config').all();
  const cfg = {};
  for (const r of results) {
    cfg[r.key] = JSON_KEYS.has(r.key) ? safeParse(r.value, r.key === 'hero_config' ? {} : []) : r.value;
    // 防御旧 bug 数据：hero_config 曾被 updateConfig 存为 '[]'，强制转为 {}
    if (r.key === 'hero_config' && Array.isArray(cfg[r.key])) cfg[r.key] = {};
  }
  return cfg;
}

function safeParse(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

export async function onRequest(context) {
  const { request, env } = context;
  try { await ensureTable(env); } catch (e) { console.error('[site] ensureTable error:', e.message); }

  if (request.method === 'GET') return withTable(env, ensureTable, async () => json(await loadConfig(env)));
  if (request.method === 'PUT') return withTable(env, ensureTable, () => updateConfig(request, env));
  return new Response('Method not allowed', { status: 405 });
}

async function updateConfig(request, env) {
  const denied = await adminGuard(request, env); if (denied) return denied;
  try {
    const b = await request.json();
    const entries = Object.entries(b).filter(([k]) => ALLOWED.includes(k));
    if (entries.length === 0) return json({ error: '无有效字段' }, 400);
    for (const [k, v] of entries) {
      // JSON 字段：tokuten_rules/tokuten_images/featured_square 是数组，hero_config 是对象；
      // 直接 stringify 原值（null 兜底为空数组/空对象），不再强制转数组（否则 hero_config 对象会变成 []）
      const val = JSON_KEYS.has(k)
        ? JSON.stringify(v == null ? (k === 'hero_config' ? {} : []) : v)
        : String(v == null ? '' : v).slice(0, 2000);
      await env.DB.prepare('INSERT INTO site_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?')
        .bind(k, val, val).run();
    }
    return json({ ok: true, cfg: await loadConfig(env) });
  } catch (e) { return json({ error: e.message }, 500); }
}

