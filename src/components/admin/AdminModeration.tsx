import { useState, useEffect, useCallback } from 'react';

interface Photo {
  key: string;
  url: string;
  uploaded: string;
  member?: string;
  event?: string | null;
  status: string;
}

const MEMBER_LABEL: Record<string, string> = {
  hakusai: '💛 白菜',
  kumo: '💙 云团',
  yuzi: '💚 柚子',
  other: '⭐ 多人/其他',
};

export default function AdminModeration({ code }: { code: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/photos?all=1', { headers: { 'x-admin-code': code } });
      const data = await res.json();
      if (Array.isArray(data)) {
        setPhotos(data.filter((p: Photo) => p.status === 'pending'));
      }
    } catch { setErr('加载失败'); }
    setLoading(false);
  }, [code]);

  useEffect(() => { load(); }, [load]);

  const moderate = async (key: string, action: 'approve' | 'reject') => {
    if (action === 'reject' && !confirm('确定拒绝这张照片？将永久删除。')) return;
    setBusy(key);
    setErr('');
    try {
      const res = await fetch('/api/photos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify({ key, action }),
      });
      const data = await res.json();
      if (data.ok) {
        setPhotos(prev => prev.filter(p => p.key !== key));
      } else {
        setErr(data.error || '操作失败');
      }
    } catch { setErr('操作失败'); }
    setBusy(null);
  };

  if (loading) return <p className="text-center text-gray-400 py-8">加载中…</p>;

  return (
    <div className="frost-card p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">返图审核</h3>
        {photos.length > 0 && (
          <span className="text-xs text-[var(--accent)] font-bold">{photos.length} 张待审</span>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-4">粉丝上传的照片默认待审核，审核通过后才在广场公开展示。拒绝会永久删除。</p>
      {err && <p className="text-xs text-red-500 mb-3">{err}</p>}
      {photos.length === 0 ? (
        <p className="text-center text-gray-400 py-8">没有待审核的照片 ✨</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map(p => (
            <div key={p.key} className="relative aspect-[4/5] rounded-3xl overflow-hidden glass group">
              <img src={p.url} alt="" className="w-full h-full object-cover" loading="lazy" />
              {p.member && MEMBER_LABEL[p.member] && (
                <span className="absolute top-2 left-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/75 backdrop-blur text-gray-600">
                  {MEMBER_LABEL[p.member]}
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 p-2 flex gap-2 bg-gradient-to-t from-black/70 to-transparent">
                <button
                  onClick={() => moderate(p.key, 'approve')}
                  disabled={busy === p.key}
                  className="flex-1 text-xs bg-green-500 hover:bg-green-600 text-white py-1.5 rounded-full disabled:opacity-50 transition-colors"
                >通过</button>
                <button
                  onClick={() => moderate(p.key, 'reject')}
                  disabled={busy === p.key}
                  className="flex-1 text-xs bg-red-500 hover:bg-red-600 text-white py-1.5 rounded-full disabled:opacity-50 transition-colors"
                >拒绝</button>
              </div>
              {busy === p.key && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
