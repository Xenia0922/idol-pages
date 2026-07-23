/**
 * POST /api/upload — 后台上传图片到 R2（需 ADMIN_CODE）
 *   formData: file (必填), section (可选，如 members/events/tokuten，默认 admin)
 * 返回 { ok, url, key }，url 形如 /api/photos?key=admin/members/<id>.<ext>
 *   图片经由现有 /api/photos?key= 提供访问（任意 key 均可 serve）。
 */

import { json } from "../_shared.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return json("Method not allowed", 405);
  try {
    const admin = request.headers.get("x-admin-code") || "";
    if (admin !== env.ADMIN_CODE) return json({ error: "无权限" }, 403);

    const formData = await request.formData();
    const file = formData.get("file");
    const section =
      String(formData.get("section") || "admin")
        .replace(/[^a-z0-9_-]/gi, "")
        .toLowerCase() || "admin";

    if (!file || !(file instanceof File))
      return json({ error: "请选择图片" }, 400);
    if (file.size > 15 * 1024 * 1024)
      return json({ error: "图片不能超过 15MB" }, 400);

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type))
      return json({ error: "仅支持 JPG/PNG/WEBP/GIF" }, 400);

    const rawExt = (file.name.split(".").pop() || "").toLowerCase();
    const ext = ["jpg", "jpeg", "png", "webp", "gif"].includes(rawExt)
      ? rawExt
      : "jpg";
    const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const key = `admin/${section}/${id}.${ext}`;

    await env.PHOTOS.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    return json({
      ok: true,
      key,
      url: `/api/photos?key=${encodeURIComponent(key)}`,
    });
  } catch (e) {
    return json({ error: "上传失败: " + e.message }, 500);
  }
}
