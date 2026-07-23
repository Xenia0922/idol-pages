/**
 * POST /api/messages — 提交留言 → D1（需暗号）
 * GET  /api/messages — 获取最近留言 ← D1
 * DELETE /api/messages — 删除留言（需 ADMIN_CODE）
 */

import {
  adminOk,
  adminGuard,
  json,
  verifyTurnstile,
  containsBlocked,
} from "../_shared.js";

export async function onRequest(context) {
  const { request, env } = context;
  // 旧手动建表补 event 列（幂等，仅首次执行）
  try {
    await ensureColumns(env);
  } catch (e) {
    /* 忽略，交由各 handler 处理 */
  }
  if (request.method === "GET") return listMessages(env);
  if (request.method === "POST") return postMessage(request, env);
  if (request.method === "PUT") return editMessage(request, env);
  if (request.method === "DELETE") return deleteMessage(request, env);
  return new Response("Method not allowed", { status: 405 });
}

// messages 表为手动建表，这里补 event 列（部署前已存在的旧表兼容）
async function ensureColumns(env) {
  try {
    await env.DB.prepare("ALTER TABLE messages ADD COLUMN event TEXT").run();
  } catch (e) {
    /* 列已存在则忽略 */
  }
}

async function postMessage(request, env) {
  try {
    const body = await request.json();
    const isAdmin = adminOk(request, env);
    const name = body.name?.trim().slice(0, 30) || "匿名粉丝";
    const message = body.message?.trim().slice(0, 500);
    const member = body.member || null;
    const event = body.event?.trim().slice(0, 40) || null;

    if (!message) return json({ error: "内容不能为空" }, 400);

    // 粉丝走 Turnstile 人机验证（admin 免）
    if (!isAdmin) {
      const ip = request.headers.get("cf-connecting-ip") || "";
      const ok = await verifyTurnstile(body.turnstileToken, ip, env);
      if (!ok) return json({ error: "人机验证失败，请刷新重试" }, 403);
    }

    // 屏蔽词检查（admin 免）：从 site_config 读 blocked_words
    if (!isAdmin) {
      let blockedWords = [];
      try {
        const r = await env.DB.prepare(
          "SELECT value FROM site_config WHERE key='blocked_words'",
        ).first();
        if (r?.value) blockedWords = JSON.parse(r.value);
      } catch {}
      if (containsBlocked(message + " " + name, blockedWords)) {
        return json({ error: "内容包含敏感词，请修改后重试" }, 400);
      }
    }

    // 粉丝走 IP 限流；后台发帖不受限
    if (!isAdmin) {
      const ip = request.headers.get("cf-connecting-ip") || "unknown";
      const { results: recent } = await env.DB.prepare(
        "SELECT created_at FROM messages WHERE ip = ? ORDER BY created_at DESC LIMIT 1",
      )
        .bind(ip)
        .all();
      if (
        recent.length > 0 &&
        Date.now() - new Date(recent[0].created_at + "Z").getTime() < 30000
      ) {
        return json({ error: "发太快了，等30秒再试" }, 429);
      }
    }

    const id =
      Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    await env.DB.prepare(
      "INSERT INTO messages (id, name, message, member, event, ip) VALUES (?,?,?,?,?,?)",
    )
      .bind(id, name, message, member, event, ip)
      .run();

    return json({ ok: true, msg: { id, name, message, member, event } });
  } catch (e) {
    return json({ error: "留言失败: " + e.message }, 500);
  }
}

// 后台编辑：可修改 name / message / member
async function editMessage(request, env) {
  const denied = await adminGuard(request, env);
  if (denied) return denied;
  try {
    const b = await request.json();
    const id = String(b.id || "").trim();
    if (!id) return json({ error: "缺少 id" }, 400);
    const sets = [];
    const binds = [];
    if (b.name !== undefined) {
      sets.push("name = ?");
      binds.push(String(b.name).trim().slice(0, 30));
    }
    if (b.message !== undefined) {
      sets.push("message = ?");
      binds.push(String(b.message).trim().slice(0, 500));
    }
    if (b.member !== undefined) {
      sets.push("member = ?");
      binds.push(b.member || null);
    }
    if (b.event !== undefined) {
      sets.push("event = ?");
      binds.push(b.event ? String(b.event).slice(0, 40) : null);
    }
    if (sets.length === 0) return json({ ok: true });
    binds.push(id);
    await env.DB.prepare(`UPDATE messages SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...binds)
      .run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: "修改失败: " + e.message }, 500);
  }
}

async function listMessages(env) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, name, message, member, event, created_at FROM messages ORDER BY created_at DESC LIMIT 50",
    ).all();
    return json(results);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function deleteMessage(request, env) {
  try {
    const admin = request.headers.get("x-admin-code") || "";
    if (admin !== env.ADMIN_CODE) return json({ error: "无权限" }, 403);
    const { id } = await request.json();
    if (!id) return json({ error: "缺少 id" }, 400);
    await env.DB.prepare("DELETE FROM messages WHERE id = ?").bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
