import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ImageUpload from './ImageUpload';
import ImageLightboxOverlay from '../ImageLightboxOverlay';

interface Photo {
  id: string;
  url: string;
  member: string;
}

const EXTRA_GROUP = { key: '__extra__', name: '不分类', color: '#e83e8c' };

export default function AdminGalleryEdit({ code }: { code: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [featuredIds, setFeaturedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [cat, setCat] = useState('__extra__');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: { src: string }[]; idx: number } | null>(null);
  const [groups, setGroups] = useState<{ key: string; name: string; color: string }[]>([EXTRA_GROUP]);
  const photosRef = useRef<Photo[]>([]);
  useEffect(() => { photosRef.current = photos; }, [photos]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [galleryRes, siteRes, membersRes] = await Promise.all([
        fetch('/api/gallery'),
        fetch('/api/site'),
        fetch('/api/members'),
      ]);
      const galleryData = await galleryRes.json();
      const siteData = await siteRes.json();
      const membersData = await membersRes.json().catch(() => []);

      // 动态成员分组 + 不分类兜底（新增成员无需改代码）
      if (Array.isArray(membersData)) {
        const mg = membersData
          .filter((m: any) => m.status !== 'graduated')
          .map((m: any) => ({ key: m.id, name: m.name, color: m.color || '#888' }));
        setGroups([...mg, EXTRA_GROUP]);
      }

      if (Array.isArray(galleryData.photos)) setPhotos(galleryData.photos);
      else if (galleryData.error) setErr(galleryData.error);

      // 提取广场精选同步到画廊的 gallery_photos id
      const raw = siteData.featured_square || [];
      if (Array.isArray(raw)) {
        const ids = new Set<string>();
        for (const e of raw) {
          const gid = typeof e === 'string' ? null : e.galleryId;
          if (gid) ids.add(gid);
        }
        setFeaturedIds(ids);
      }
    } catch { setErr('加载失败'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // 分离：普通画廊照片 / 广场精选同步过来的
  const { regular, featured } = useMemo(() => {
    const reg: Photo[] = [];
    const feat: Photo[] = [];
    for (const p of photos) {
      if (featuredIds.has(p.id)) feat.push(p);
      else reg.push(p);
    }
    return { regular: reg, featured: feat };
  }, [photos, featuredIds]);

  // 普通照片按成员分组（动态成员 + 不分类兜底）
  const grouped = useMemo(() => {
    const map = new Map<string, Photo[]>();
    for (const g of groups) map.set(g.key, []);
    for (const p of regular) {
      const key = map.has(p.member) ? p.member : '__extra__';
      map.get(key)!.push(p);
    }
    return groups.map((g) => ({ ...g, items: map.get(g.key)! }));
  }, [regular, groups]);

  const badgeOf = (m: string) => groups.find((g) => g.key === m) || groups[groups.length - 1];

  const add = async (url: string) => {
    if (!url) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify({ url, member: cat }),
      });
      const data = await res.json();
      if (data.ok) { setDraft(''); load(); }
      else setErr(data.error || '添加失败');
    } catch { setErr('添加失败'); }
    finally { setBusy(false); }
  };

  const del = async (p: Photo) => {
    if (!confirm('从画廊删除这张照片？')) return;
    try {
      const res = await fetch('/api/gallery?id=' + encodeURIComponent(p.id), {
        method: 'DELETE', headers: { 'x-admin-code': code },
      });
      const data = await res.json();
      if (data.ok) load();
      else alert(data.error || '删除失败');
    } catch { alert('删除失败'); }
  };

  // 组内拖拽排序
  const getMember = (id: string) => photosRef.current.find((p) => p.id === id)?.member;
  const applyReorder = (member: string, fromId: string, toId: string) => {
    const prev = photosRef.current;
    const sub = prev.filter((p) => p.member === member);
    const from = sub.findIndex((p) => p.id === fromId);
    const to = sub.findIndex((p) => p.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    const nextSub = [...sub];
    const [item] = nextSub.splice(from, 1);
    nextSub.splice(to, 0, item);
    const newFlat = [...prev];
    let k = 0;
    for (let i = 0; i < newFlat.length; i++) {
      if (newFlat[i].member === member) newFlat[i] = nextSub[k++];
    }
    photosRef.current = newFlat;
    setPhotos(newFlat);
  };

  // 广场精选排序（独立拖拽）
  const applyFeaturedReorder = (fromId: string, toId: string) => {
    const prev = photosRef.current;
    const fids = Array.from(featuredIds);
    const sub = prev.filter((p) => fids.includes(p.id));
    const from = sub.findIndex((p) => p.id === fromId);
    const to = sub.findIndex((p) => p.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    const nextSub = [...sub];
    const [item] = nextSub.splice(from, 1);
    nextSub.splice(to, 0, item);
    const newFlat = [...prev];
    let k = 0;
    for (let i = 0; i < newFlat.length; i++) {
      if (fids.includes(newFlat[i].id)) newFlat[i] = nextSub[k++];
    }
    photosRef.current = newFlat;
    setPhotos(newFlat);
  };

  const persistOrder = useCallback(async (arr: Photo[]) => {
    setSaving(true);
    const fids = Array.from(featuredIds);
    // 普通分组
    const groupPayload = groups.map((g) => ({
      member: g.key,
      ids: arr.filter((p) => !fids.includes(p.id) && p.member === g.key).map((p) => p.id),
    }));
    // 广场精选
    groupPayload.push({
      member: '__featured__',
      ids: arr.filter((p) => fids.includes(p.id)).map((p) => p.id),
    });
    try {
      await fetch('/api/gallery', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify({ groups: groupPayload }),
      });
    } catch { /* ignore */ }
    finally { setTimeout(() => setSaving(false), 800); }
  }, [code, featuredIds, groups]);

  return (
    <div className="frost-card p-5">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">画廊照片</h3>
      <p className="text-xs text-gray-400 mb-3">
        按成员分组管理。拖拽可在同组内调整顺序，松手自动保存。
      </p>

      <div className="flex items-center gap-2 mb-4">
        <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">上传到</label>
        <select value={cat} onChange={(e) => setCat(e.target.value)}
          className="flex-1 px-3 py-2 rounded-full text-sm bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-[var(--accent)] transition-colors">
          {groups.map((g) => (
            <option key={g.key} value={g.key}>{g.name}</option>
          ))}
        </select>
      </div>

      <ImageUpload code={code} section="gallery" value={draft}
        onChange={(u) => { if (u) add(u); setDraft(''); }}
        label={`添加画廊照片（${badgeOf(cat).name}）`}
      />
      {busy && <p className="text-xs text-gray-400 mt-2">上传中…</p>}
      {err && <p className="text-xs text-red-500 mt-2">{err}</p>}

      {loading ? (
        <p className="text-center text-gray-400 py-6">加载中…</p>
      ) : (
        <div className="space-y-6 mt-5">
          {/* 普通画廊照片 — 按成员分组 */}
          {grouped.map((g) => (
            <div key={g.key}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold" style={{ color: g.color }}>{g.name}</span>
                <span className="text-xs text-gray-400">{g.items.length} 张</span>
                {g.items.length > 1 && <span className="text-[10px] text-gray-300 dark:text-gray-500">· 可拖拽排序</span>}
              </div>
              {g.items.length === 0 ? (
                <p className="text-xs text-gray-300 dark:text-gray-600 py-2">暂无</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {g.items.map((p) => (
                    <div key={p.id} draggable
                      onDragStart={() => setDragId(p.id)}
                      onDragOver={(e) => { e.preventDefault(); if (dragId && dragId !== p.id) applyReorder(getMember(dragId) || '', dragId, p.id); }}
                      onDrop={(e) => { e.preventDefault(); setDragId(null); persistOrder(photosRef.current); }}
                      onClick={() => setLightbox({ images: g.items.map((x) => ({ src: x.url })), idx: g.items.indexOf(p) })}
                      className={`relative aspect-[4/5] rounded-3xl overflow-hidden glass cursor-grab active:cursor-grabbing group ${dragId === p.id ? 'ring-2 ring-[var(--accent)] opacity-60' : ''}`}>
                      <img src={p.url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" draggable={false} />
                      <button onClick={(e) => { e.stopPropagation(); del(p); }}
                        className="absolute top-2 right-2 text-xs bg-red-500/80 hover:bg-red-600 text-white px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">删除</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* 广场精选 — 独立分组 */}
          {featured.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold text-[var(--accent)]">广场精选</span>
                <span className="text-xs text-gray-400">{featured.length} 张</span>
                {featured.length > 1 && <span className="text-[10px] text-gray-300 dark:text-gray-500">· 可拖拽排序</span>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {featured.map((p) => (
                  <div key={p.id} draggable
                    onDragStart={() => setDragId(p.id)}
                    onDragOver={(e) => { e.preventDefault(); if (dragId && dragId !== p.id) applyFeaturedReorder(dragId, p.id); }}
                    onDrop={(e) => { e.preventDefault(); setDragId(null); persistOrder(photosRef.current); }}
                    onClick={() => setLightbox({ images: featured.map((x) => ({ src: x.url })), idx: featured.indexOf(p) })}
                    className={`relative aspect-[4/5] rounded-3xl overflow-hidden glass cursor-grab active:cursor-grabbing group ring-1 ring-[var(--accent)]/30 ${dragId === p.id ? 'ring-2 ring-[var(--accent)] opacity-60' : ''}`}>
                    <img src={p.url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" draggable={false} />
                    <button onClick={(e) => { e.stopPropagation(); del(p); }}
                      className="absolute top-2 right-2 text-xs bg-red-500/80 hover:bg-red-600 text-white px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">删除</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {saving && <p className="text-xs text-gray-400 mt-3 text-center">排序已保存</p>}

      {lightbox && (
        <ImageLightboxOverlay images={lightbox.images} currentIndex={lightbox.idx}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox((l) => (l ? { ...l, idx: (l.idx - 1 + l.images.length) % l.images.length } : l))}
          onNext={() => setLightbox((l) => (l ? { ...l, idx: (l.idx + 1) % l.images.length } : l))} />
      )}
    </div>
  );
}
