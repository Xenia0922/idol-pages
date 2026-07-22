/**
 * GET  /api/photos?key=xxx        — 读取单张图片
 * GET  /api/photos                 — 列出已审核照片（粉丝上传默认 pending，admin ?all=1 看全部）
 * POST /api/photos                 — 上传照片（最多 9 张，单张 ≤23MB，粉丝需 Turnstile + 审核后才公开）
 * PUT  /api/photos                 — admin 审核（approve/reject，需 ADMIN_CODE）
 * DELETE /api/photos               — 删除照片（需 ADMIN_CODE）
 */

import { rateAllow, rateLog } from './_rate.js';
import { adminOk, adminGuard, json, verifyTurnstile } from '../_shared.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'GET' && url.searchParams.has('key')) {
    return servePhoto(env, url.searchParams.get('key'));
  }

  if (request.method === 'GET') {
    return listPhotos(request, env);
  }

  if (request.method === 'POST') {
    return uploadPhoto(request, env);
  }

  if (request.method === 'PUT') {
    return moderatePhoto(request, env);
  }

  if (request.method === 'DELETE') {
    return deletePhoto(request, env);
  }

  return new Response('Method not allowed', { status: 405 });
}

const THUMB_SUFFIX = '_thumb';
const MAX_FILES = 9;
const MAX_SIZE = 23 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function isThumbKey(key) {
  return new RegExp(`${THUMB_SUFFIX}\\.\\w+$`).test(key);
}

function toThumbKey(key) {
  return key.replace(/\.(\w+)$/, `${THUMB_SUFFIX}.$1`);
}

async function uploadPhoto(request, env) {
  try {
    const formData = await request.formData();
    const isAdmin = adminOk(request, env);

    // 收集文件：兼容多文件 fields=('files') 与旧单文件('file')
    let files = formData.getAll('files').filter(f => f instanceof File);
    const single = formData.get('file');
    if (single && single instanceof File) files.push(single);
    if (files.length === 0) return json({ error: '请选择图片' }, 400);
    if (files.length > MAX_FILES) return json({ error: `一次最多上传 ${MAX_FILES} 张` }, 400);

    // 粉丝走 Turnstile 人机验证（admin 免）
    if (!isAdmin) {
      const token = formData.get('turnstileToken')?.toString() || '';
      const ip = request.headers.get('cf-connecting-ip') || '';
      const ok = await verifyTurnstile(token, ip, env);
      if (!ok) return json({ error: '人机验证失败，请刷新重试' }, 403);
    }

    // 逐张校验类型与大小
    for (const f of files) {
      if (!ALLOWED.includes(f.type)) return json({ error: '仅支持 JPG/PNG/WEBP/GIF' }, 400);
      if (f.size > MAX_SIZE) return json({ error: '单张图片不能超过 23MB' }, 400);
    }

    // 限流（粉丝）：5 秒内本 IP 上传图片总数不超过 MAX_FILES
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    if (!isAdmin) {
      const allowed = await rateAllow(env, ip, 'photo', MAX_FILES, 5000, files.length);
      if (!allowed) return json({ error: '操作太频繁，请 5 秒后再试' }, 429);
    }

    const rawMember = formData.get('member');
    const member = isAdmin
      ? (rawMember || 'other')
      : (['hakusai', 'kumo', 'yuzi', 'other'].includes(rawMember) ? rawMember : 'other');
    const nickname = formData.get('nickname')?.slice(0, 20) || '匿名骑士';
    const event = (formData.get('event') || '').slice(0, 40) || null;

    const urls = [];
    const keys = [];

    for (const file of files) {
      const rawExt = (file.name.split('.').pop() || '').toLowerCase();
      const ext = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(rawExt) ? rawExt : 'jpg';
      const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      // 粉丝上传进 pending 前缀（审核后才公开），admin 上传直接进 uploads/
      const key = isAdmin ? `uploads/${member}/${id}.${ext}` : `uploads/pending/${member}/${id}.${ext}`;
      await env.PHOTOS.put(key, file.stream(), {
        httpMetadata: { contentType: file.type },
        customMetadata: { nickname, member, event: event || '', uploadedAt: new Date().toISOString() },
      });
      urls.push(`/api/photos?key=${encodeURIComponent(key)}`);
      keys.push(key);
      if (!isAdmin) await rateLog(env, ip, 'photo');
    }

    return json({
      ok: true,
      count: files.length,
      urls,
      keys,
      // 兼容单图消费的旧客户端
      url: urls[0] || null,
      key: keys[0] || null,
      // 粉丝上传需审核后才公开（admin 上传直接公开）
      pending: !isAdmin,
    });
  } catch (e) {
    return json({ error: '上传失败: ' + e.message }, 500);
  }
}

async function servePhoto(env, key) {
  try {
    const obj = await env.PHOTOS.get(key);
    if (!obj) return new Response('Not found', { status: 404 });
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Cache-Control', 'public, max-age=31536000');
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(obj.body, { headers });
  } catch {
    return new Response('Error', { status: 500 });
  }
}

/**
 * 列出 R2 中已上传的照片（不含缩略图对象）。
 * 审核状态用 key 前缀区分：uploads/pending/{member}/... = 待审，uploads/{member}/... = 已通过。
 * 不依赖 R2 customMetadata（list 不保证返回 customMetadata，曾导致审核过滤失效）。
 * @param approvedOnly true 时只返回已审核（不含 uploads/pending/ 前缀）；false 时返回全部。
 * 同时被 GET /api/photos（包装成 JSON）与 _middleware.js（SSR 注入 featuredFan）复用。
 */
export async function listPhotosData(env, approvedOnly = true) {
  try {
    const { objects } = await env.PHOTOS.list({ limit: 1000, prefix: 'uploads/' });
    return objects
      .filter(o => !isThumbKey(o.key))
      .filter(o => !approvedOnly || !o.key.startsWith('uploads/pending/'))
      .map(o => {
        const isPending = o.key.startsWith('uploads/pending/');
        // member：uploads/pending/{member}/... 或 uploads/{member}/...
        const parts = o.key.split('/');
        const member = isPending ? (parts[2] || 'other') : (parts[1] || 'other');
        return {
          key: o.key,
          url: `/api/photos?key=${encodeURIComponent(o.key)}`,
          uploaded: o.uploaded,
          member,
          event: o.customMetadata?.event || null,
          status: isPending ? 'pending' : 'approved',
        };
      });
  } catch (e) {
    console.error('[photos] list failed:', e.message);
    return [];
  }
}

async function listPhotos(request, env) {
  const url = new URL(request.url);
  const all = url.searchParams.get('all') === '1';
  // admin 可看全部（含 pending）；公开只返回 approved
  const approvedOnly = !all || !adminOk(request, env);
  return json(await listPhotosData(env, approvedOnly));
}

async function deletePhoto(request, env) {
  try {
    const admin = request.headers.get('x-admin-code') || '';
    if (admin !== env.ADMIN_CODE) return json({ error: '无权限' }, 403);
    const { key } = await request.json();
    if (!key || !key.startsWith('uploads/')) return json({ error: '无效 key' }, 400);
    await env.PHOTOS.delete(key);
    await env.PHOTOS.delete(toThumbKey(key)).catch(() => {});
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// admin 审核：approve（R2 不支持单独更新 metadata，需 get+put 重写）/ reject（删 R2 对象）
async function moderatePhoto(request, env) {
  const denied = await adminGuard(request, env); if (denied) return denied;
  try {
    const { key, action } = await request.json();
    if (!key || !key.startsWith('uploads/')) return json({ error: '无效 key' }, 400);
    if (action !== 'approve' && action !== 'reject') return json({ error: '无效操作' }, 400);

    if (action === 'reject') {
      await env.PHOTOS.delete(key);
      await env.PHOTOS.delete(toThumbKey(key)).catch(() => {});
      return json({ ok: true, action: 'rejected' });
    }

    // approve：从 uploads/pending/{member}/... copy 到 uploads/{member}/...，删 pending key
    const obj = await env.PHOTOS.get(key);
    if (!obj) return json({ error: '图片不存在' }, 404);
    const body = await obj.arrayBuffer();
    const newKey = key.replace('uploads/pending/', 'uploads/');
    await env.PHOTOS.put(newKey, body, {
      httpMetadata: obj.httpMetadata,
      customMetadata: { ...(obj.customMetadata || {}), status: 'approved' },
    });
    if (newKey !== key) {
      await env.PHOTOS.delete(key);
      await env.PHOTOS.delete(toThumbKey(key)).catch(() => {});
    }
    return json({ ok: true, action: 'approved' });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

