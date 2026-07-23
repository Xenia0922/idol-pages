/**
 * 轻量级每 IP 限流（基于 D1，无需 KV）。
 * 用于拦截类似 DDoS 的密集上传：在滑动时间窗内限制某 IP 的上传次数/图片数。
 * 表 upload_log(ip, ts, kind) 自举创建；查询失败则 fail-open（放行），避免误伤正常用户。
 */

const DDL = `CREATE TABLE IF NOT EXISTS upload_log (ip TEXT, ts INTEGER, kind TEXT)`;

let ensured = false;
async function ensure(env) {
  if (ensured) return;
  await env.DB.prepare(DDL)
    .run()
    .catch(() => {});
  ensured = true;
}

/**
 * 是否允许本次操作：滑动窗内已有次数 + 本次 n 不能超过 limit。
 */
export async function rateAllow(env, ip, kind, limit, windowMs, n = 1) {
  try {
    await ensure(env);
    const since = Date.now() - windowMs;
    const { results } = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM upload_log WHERE ip = ? AND kind = ? AND ts > ?",
    )
      .bind(ip, kind, since)
      .all();
    const count = (results && results[0] && results[0].c) || 0;
    return count + n <= limit;
  } catch (e) {
    console.error("[rate] check failed, fail-open:", e.message);
    return true;
  }
}

/** 记录一次命中（按 n 张图片逐条写入，便于精确计数）。 */
export async function rateLog(env, ip, kind, n = 1) {
  try {
    await ensure(env);
    const now = Date.now();
    for (let i = 0; i < n; i++) {
      await env.DB.prepare(
        "INSERT INTO upload_log (ip, ts, kind) VALUES (?, ?, ?)",
      )
        .bind(ip, now, kind)
        .run();
    }
    // 轻量清理：1 小时前的记录
    const cutoff = now - 3600 * 1000;
    await env.DB.prepare("DELETE FROM upload_log WHERE ts < ?")
      .bind(cutoff)
      .run()
      .catch(() => {});
  } catch (e) {
    console.error("[rate] log failed:", e.message);
  }
}
