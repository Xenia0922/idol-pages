/**
 * Cloudflare Pages Functions — 共享工具函数
 * 消除各 API 文件中的 adminOk / json / withTable 重复代码。
 *
 * 每个 API 文件只需：
 *   import { adminOk, json, withTable } from '../_shared.js';
 */

import { rateAllow, rateLog } from "./api/_rate.js";

/**
 * 返回 JSON Response（含安全头）
 */
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/**
 * 验证管理后台暗号
 */
export function adminOk(request, env) {
  return (request.headers.get("x-admin-code") || "") === env.ADMIN_CODE;
}

/**
 * admin 操作防护：权限验证 + IP 限流（24h 100 次）。
 * 通过返回 null（即 undefined）；拒绝返回 json Response 可直接 return。
 * 用法：const denied = await adminGuard(request, env); if (denied) return denied;
 */
export async function adminGuard(request, env) {
  if (!adminOk(request, env)) return json({ error: "无权限" }, 403);
  try {
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const allowed = await rateAllow(env, ip, "admin", 500, 24 * 3600 * 1000);
    if (!allowed) return json({ error: "操作过于频繁，请稍后再试" }, 429);
    await rateLog(env, ip, "admin");
  } catch (e) {
    // rateAllow/rateLog 内部已 try/catch，此处兜底：任何意外异常都 fail-open 放行
    console.error("[adminGuard] rate check/log failed, fail-open:", e.message);
  }
  return null;
}

/**
 * 验证 Cloudflare Turnstile token（canonical siteverify）。
 * - 未配置 TURNSTILE_SECRET_KEY：fail-open（返回 true）
 * - token 空（Turnstile 脚本加载失败，国内常见）：fail-open（返回 true，靠限流+屏蔽词+审核兜底）
 * - token 非空：siteverify 验证，success===true 放行，否则拒绝
 */
export async function verifyTurnstile(token, ip, env) {
  if (!env.TURNSTILE_SECRET_KEY) return true; // 未配置，fail-open
  if (!token) return true; // token 空（Turnstile 脚本加载失败），fail-open
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET_KEY,
          response: token,
          remoteip: ip || "",
        }).toString(),
      },
    );
    const data = await res.json();
    return data.success === true;
  } catch (e) {
    console.error("[turnstile] verify failed:", e.message);
    return false; // 验证服务异常，fail-closed
  }
}

/**
 * 屏蔽词命中检查。
 * - 普通词：子串匹配（大小写不敏感，含该词即命中）
 * - /pattern/ 格式：正则匹配（如 /加.{0,2}信/ 匹配"加微信/加q信"）
 * 普通词不会被正则元字符误伤（. * + 等按字面匹配）。
 */
export function containsBlocked(text, words) {
  if (!words || !Array.isArray(words) || !words.length || !text) return false;
  const lower = String(text).toLowerCase();
  for (const w of words) {
    if (!w) continue;
    const reMatch = /^\/(.+)\/([imu]*)$/.exec(w);
    if (reMatch) {
      try {
        if (new RegExp(reMatch[1], reMatch[2] || "i").test(text)) return true;
      } catch {
        /* 无效正则跳过 */
      }
    } else {
      if (lower.includes(String(w).toLowerCase())) return true;
    }
  }
  return false;
}

/**
 * 表不存在时自动建表并重试一次，避免首请求直接 500。
 * @param {D1Database} env.DB — 从 env 传入的 D1 绑定
 * @param {() => Promise<void>} ensureTable — 建表/播种函数（每个 API 文件自定义）
 * @param {() => Promise<Response>} fn — 业务处理函数
 */
export async function withTable(env, ensureTable, fn) {
  try {
    return await fn();
  } catch (e) {
    if (/no such table/i.test(e.message || "")) {
      await ensureTable(env);
      return await fn();
    }
    throw e;
  }
}
