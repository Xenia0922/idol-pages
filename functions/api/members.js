/**
 * GET  /api/members        — 公开：成员列表（不含 gallery/weibo 冗余），按 sort_order 升序
 * GET  /api/members?id=xxx — 公开：单条详情（含 gallery/weibo/intro）
 * GET  /api/members?all=1 — 管理：全量（含 gallery/weibo/intro），需 ADMIN_CODE
 * POST /api/members        — 新建，需 ADMIN_CODE（id 必填，作为 slug）
 * PUT  /api/members        — 修改，需 ADMIN_CODE
 * DELETE /api/members      — 删除，需 ADMIN_CODE
 *
 * 表 members 由本接口首次请求时自动创建并播种（无需手动 migration）。
 */

import { adminOk, adminGuard, json, withTable } from "../_shared.js";

const DDL = `CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_jp TEXT,
  color TEXT,
  emoji TEXT,
  birthday TEXT,
  constellation TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  image TEXT,
  gallery TEXT NOT NULL DEFAULT '[]',
  weibo TEXT,
  weibo_name TEXT,
  weibo_desc TEXT,
  intro TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);`;

// 种子：来自 src/data/members.json 当前内容
const SEED = [
  {
    id: "member-a",
    name: "成员A",
    nameJP: "Member A",
    color: "#FF6B9D",
    emoji: "💗",
    birthday: "01-01",
    constellation: "摩羯座",
    status: "active",
    image: "/images/members/member-a/member-a_01.webp",
    gallery: [
      "/images/members/member-a/member-a_01.webp",
      "/images/members/member-a/member-a_02.webp",
      "/images/members/member-a/member-a_03.webp",
    ],
    weibo: "",
    weiboName: "@成员A",
    weiboDesc: "替换为成员的微博简介",
    intro: "替换为成员的自我介绍。",
  },
  {
    id: "member-b",
    name: "成员B",
    nameJP: "Member B",
    color: "#4DA6FF",
    emoji: "💙",
    birthday: "02-14",
    constellation: "水瓶座",
    status: "active",
    image: "/images/members/member-b/member-b_01.webp",
    gallery: [
      "/images/members/member-b/member-b_01.webp",
      "/images/members/member-b/member-b_02.webp",
      "/images/members/member-b/member-b_03.webp",
    ],
    weibo: "",
    weiboName: "@成员B",
    weiboDesc: "替换为成员的微博简介",
    intro: "替换为成员的自我介绍。",
  },
  {
    id: "member-c",
    name: "成员C",
    nameJP: "Member C",
    color: "#48D1A0",
    emoji: "💚",
    birthday: "09-04",
    constellation: "处女座",
    status: "active",
    image: "/images/members/member-c/member-c_01.webp",
    gallery: [
      "/images/members/member-c/member-c_01.webp",
      "/images/members/member-c/member-c_02.webp",
      "/images/members/member-c/member-c_03.webp",
    ],
    weibo: "",
    weiboName: "@成员C",
    weiboDesc: "替换为成员的微博简介",
    intro: "替换为成员的自我介绍。",
  },
];

async function ensureTable(env) {
  await env.DB.prepare(DDL).run();
  try {
    const { results } = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM members",
    ).all();
    if (results[0] && results[0].c === 0) {
      for (let i = 0; i < SEED.length; i++) {
        const m = SEED[i];
        await env.DB.prepare(
          `INSERT INTO members (id,name,name_jp,color,emoji,birthday,constellation,status,image,gallery,weibo,weibo_name,weibo_desc,intro,sort_order,created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
          .bind(
            m.id,
            m.name,
            m.nameJP,
            m.color,
            m.emoji,
            m.birthday,
            m.constellation,
            m.status,
            m.image,
            JSON.stringify(m.gallery || []),
            m.weibo,
            m.weiboName,
            m.weiboDesc,
            m.intro,
            i + 1,
            new Date().toISOString(),
          )
          .run();
      }
    }
  } catch (e) {
    console.error("[members] seed failed:", e.message);
  }
}

function parseMember(row) {
  if (!row) return row;
  try {
    row.gallery = JSON.parse(row.gallery || "[]");
  } catch {
    row.gallery = [];
  }
  return row;
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    await ensureTable(env);
  } catch (e) {
    console.error("[members] ensureTable error:", e.message);
  }

  if (request.method === "GET")
    return withTable(env, ensureTable, () => listMembers(request, env));
  if (request.method === "POST")
    return withTable(env, ensureTable, () => createMember(request, env));
  if (request.method === "PUT")
    return withTable(env, ensureTable, () => putMember(request, env));
  if (request.method === "DELETE")
    return withTable(env, ensureTable, () => deleteMember(request, env));
  return new Response("Method not allowed", { status: 405 });
}

async function listMembers(request, env) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const all = url.searchParams.get("all") === "1";

  if (id) {
    const { results } = await env.DB.prepare(
      "SELECT * FROM members WHERE id = ?",
    )
      .bind(id)
      .all();
    if (!results.length) return json({ error: "未找到成员" }, 404);
    return json(parseMember(results[0]));
  }

  const isAdmin = all && adminOk(request, env);
  if (all && !isAdmin) return json({ error: "无权限" }, 403);

  const cols = isAdmin
    ? "*"
    : "id,name,name_jp,color,emoji,birthday,constellation,status,image";
  const { results } = await env.DB.prepare(
    `SELECT ${cols} FROM members ORDER BY sort_order ASC, id ASC`,
  ).all();
  if (isAdmin) results.forEach(parseMember);
  return json(results);
}

async function createMember(request, env) {
  const denied = await adminGuard(request, env);
  if (denied) return denied;
  try {
    const b = await request.json();
    const id = String(b.id || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    const name = String(b.name || "")
      .trim()
      .slice(0, 30);
    if (!id || !name) return json({ error: "id 与名称必填" }, 400);
    if (
      b.image &&
      !/^https?:\/\//.test(String(b.image).trim()) &&
      !String(b.image).startsWith("/")
    ) {
      return json({ error: "头像需为图片链接或 / 开头路径" }, 400);
    }
    const gallery = Array.isArray(b.gallery) ? b.gallery : [];
    await env.DB.prepare(
      `INSERT INTO members (id,name,name_jp,color,emoji,birthday,constellation,status,image,gallery,weibo,weibo_name,weibo_desc,intro,sort_order,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
      .bind(
        id,
        name,
        String(b.nameJP || "")
          .trim()
          .slice(0, 30),
        String(b.color || "#e83e8c").slice(0, 20),
        String(b.emoji || "⭐").slice(0, 8),
        String(b.birthday || "").slice(0, 10),
        String(b.constellation || "").slice(0, 10),
        b.status === "graduated" ? "graduated" : "active",
        String(b.image || "").slice(0, 500),
        JSON.stringify(gallery),
        String(b.weibo || "").slice(0, 200),
        String((b.weibo_name ?? b.weiboName) || "").slice(0, 60),
        String((b.weibo_desc ?? b.weiboDesc) || "").slice(0, 120),
        String(b.intro || ""),
        Number.isFinite(+b.sort_order) ? +b.sort_order : 99,
        new Date().toISOString(),
      )
      .run();
    return json({ ok: true, id });
  } catch (e) {
    if (/UNIQUE|primary key/i.test(e.message || ""))
      return json({ error: "该 id 已存在" }, 409);
    return json({ error: e.message }, 500);
  }
}

async function putMember(request, env) {
  const denied = await adminGuard(request, env);
  if (denied) return denied;
  try {
    const b = await request.json();
    const id = String(b.id || "").trim();
    if (!id) return json({ error: "缺少 id" }, 400);
    const sets = [];
    const binds = [];
    const map = {
      name: 30,
      nameJP: 30,
      color: 20,
      emoji: 8,
      birthday: 10,
      constellation: 10,
      image: 500,
      weibo: 200,
      weibo_name: 60,
      weibo_desc: 120,
      intro: 10000,
    };
    for (const k of Object.keys(map)) {
      if (b[k] !== undefined) {
        sets.push(`${k} = ?`);
        binds.push(String(b[k]).trim().slice(0, map[k]));
      }
    }
    if (b.status !== undefined) {
      sets.push("status = ?");
      binds.push(b.status === "graduated" ? "graduated" : "active");
    }
    if (b.gallery !== undefined) {
      sets.push("gallery = ?");
      binds.push(JSON.stringify(Array.isArray(b.gallery) ? b.gallery : []));
    }
    if (b.sort_order !== undefined) {
      sets.push("sort_order = ?");
      binds.push(Number.isFinite(+b.sort_order) ? +b.sort_order : 0);
    }
    if (sets.length === 0) return json({ ok: true });
    binds.push(id);
    await env.DB.prepare(`UPDATE members SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...binds)
      .run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function deleteMember(request, env) {
  const denied = await adminGuard(request, env);
  if (denied) return denied;
  try {
    const { id } = await request.json();
    if (!id) return json({ error: "缺少 id" }, 400);
    await env.DB.prepare("DELETE FROM members WHERE id = ?").bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
