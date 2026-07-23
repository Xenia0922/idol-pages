import { useState, useEffect, useCallback } from "react";
import { useEvents } from "../useEvents";

interface Photo {
  key: string;
  url: string;
  uploaded: string;
  member?: string;
  event?: string | null;
  thumbUrl?: string | null;
}

const MEMBER_OPTS = [
  { id: "member-a", label: "💗 成员A" },
  { id: "member-b", label: "💙 成员B" },
  { id: "member-c", label: "💚 成员C" },
  { id: "other", label: "⭐ 其他" },
];

export default function AdminGallery({ code }: { code: string }) {
  const { events, loading: evLoading } = useEvents();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [featuredKeys, setFeaturedKeys] = useState<Set<string>>(new Set());
  const [featuredMap, setFeaturedMap] = useState<Map<string, string>>(
    new Map(),
  ); // key → galleryId
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [member, setMember] = useState("other");
  const [event, setEvent] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [photoRes, siteRes] = await Promise.all([
        fetch("/api/photos"),
        fetch("/api/site"),
      ]);
      const photoData = await photoRes.json();
      const siteData = await siteRes.json();
      if (Array.isArray(photoData)) setPhotos(photoData);
      else if (photoData.error) setErr(photoData.error);
      const entries = siteData.featured_square;
      if (Array.isArray(entries)) {
        const keys = new Set<string>();
        const map = new Map<string, string>();
        for (const e of entries) {
          const k = typeof e === "string" ? e : e.key;
          if (k) keys.add(k);
          if (e.galleryId) map.set(k, e.galleryId);
        }
        setFeaturedKeys(keys);
        setFeaturedMap(map);
      }
    } catch {
      setErr("加载失败");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("member", member);
      fd.append("event", event);
      const res = await fetch("/api/photos", {
        method: "POST",
        headers: { "x-admin-code": code },
        body: fd,
      });
      const data = await res.json();
      if (data.ok) {
        setFile(null);
        load();
      } else setErr(data.error || "上传失败");
    } catch {
      setErr("上传失败");
    } finally {
      setBusy(false);
    }
  };

  const del = async (p: Photo) => {
    if (!confirm("删除这张照片？")) return;
    try {
      const res = await fetch("/api/photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-admin-code": code },
        body: JSON.stringify({ key: p.key }),
      });
      const data = await res.json();
      if (data.ok) load();
      else alert(data.error || "删除失败");
    } catch {
      alert("删除失败");
    }
  };

  const toggleFeatured = async (p: Photo) => {
    const next = new Set(featuredKeys);
    const nextMap = new Map(featuredMap);

    if (next.has(p.key)) {
      // 取消精选：删除画廊同步 + 移除标记
      const gid = nextMap.get(p.key);
      if (gid) {
        try {
          await fetch("/api/gallery?id=" + encodeURIComponent(gid), {
            method: "DELETE",
            headers: { "x-admin-code": code },
          });
        } catch {
          /* ignore */
        }
      }
      next.delete(p.key);
      nextMap.delete(p.key);
    } else {
      // 设为精选：同步到画廊
      try {
        const res = await fetch("/api/gallery", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-code": code },
          body: JSON.stringify({
            url: p.url,
            member:
              p.member === "other" ? "__extra__" : p.member || "__extra__",
          }),
        });
        const data = await res.json();
        if (data.ok && data.id) {
          nextMap.set(p.key, data.id);
        }
      } catch {
        /* ignore */
      }
      next.add(p.key);
    }

    const arr = Array.from(next).map((k) => ({
      key: k,
      galleryId: nextMap.get(k) || "",
    }));
    try {
      const res = await fetch("/api/site", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-code": code },
        body: JSON.stringify({ featured_square: arr }),
      });
      const data = await res.json();
      if (data.ok) {
        setFeaturedKeys(next);
        setFeaturedMap(nextMap);
      } else alert(data.error || "操作失败");
    } catch {
      alert("网络错误");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="frost-card p-4">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">
          广场返图
        </h3>
        <p className="text-xs text-gray-400 mb-3">
          粉丝在广场上传的应援返图（与「画廊」页里的「画廊页独立照片」不是同一处）。
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-xs"
          />
          <select
            value={member}
            onChange={(e) => setMember(e.target.value)}
            className="text-sm px-3 py-2 rounded-xl bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10"
          >
            {MEMBER_OPTS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={event}
            onChange={(e) => setEvent(e.target.value)}
            disabled={evLoading}
            className="text-sm px-3 py-2 rounded-xl bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 disabled:opacity-50"
          >
            <option value="">
              {evLoading ? "加载中..." : "🎫 关联场次（选填）"}
            </option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.date} {ev.title}
              </option>
            ))}
          </select>
          <button
            onClick={upload}
            disabled={!file || busy}
            className="btn-pink text-xs !px-4 !py-1.5 disabled:opacity-50"
          >
            {busy ? "上传中…" : "上传"}
          </button>
        </div>
        {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-8">加载中…</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map((p) => (
            <div
              key={p.key}
              className="frost-card overflow-hidden group relative"
            >
              <img
                src={p.thumbUrl || p.url}
                alt=""
                className="w-full aspect-[4/5] object-cover"
                loading="lazy"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFeatured(p);
                }}
                title={featuredKeys.has(p.key) ? "取消精选" : "设为精选"}
                className={`absolute top-2 left-2 text-xs px-2 py-1 rounded-full transition-all ${
                  featuredKeys.has(p.key)
                    ? "bg-[var(--accent)] text-white"
                    : "bg-white/60 dark:bg-white/10 text-gray-400 opacity-0 group-hover:opacity-100"
                }`}
              >
                {featuredKeys.has(p.key) ? "★" : "☆"}
              </button>
              <button
                onClick={() => del(p)}
                className="absolute top-2 right-2 text-xs bg-red-500/80 hover:bg-red-600 text-white px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                删除
              </button>
            </div>
          ))}
          {photos.length === 0 && (
            <p className="text-center text-gray-400 py-8 col-span-full">
              暂无照片
            </p>
          )}
        </div>
      )}
    </div>
  );
}
