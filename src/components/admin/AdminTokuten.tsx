import { useState, useEffect, useCallback } from 'react';
import ImageUpload from './ImageUpload';

const INPUT =
  'w-full px-3 py-2 rounded-xl text-sm bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-[var(--accent)] transition-colors';

export default function AdminTokuten({ code }: { code: string }) {
  const [rules, setRules] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/site');
      const data = await res.json();
      setRules((data.tokuten_rules || []).join('\n'));
      setImages(data.tokuten_images || []);
    } catch { setErr('加载失败'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setErr(''); setSaved(false);
    const body = {
      tokuten_rules: rules.split('\n').map(s => s.trim()).filter(Boolean),
      tokuten_images: images.filter(Boolean),
    };
    try {
      const res = await fetch('/api/site', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) setSaved(true);
      else setErr(data.error || '保存失败');
    } catch { setErr('保存失败'); }
  };

  if (loading) return <p className="text-center text-gray-400 py-8">加载中…</p>;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">特典文字规则</h3>
        <p className="text-[11px] text-gray-400 mb-2">每行一条</p>
        <textarea value={rules} onChange={e => setRules(e.target.value)} rows={5} className={INPUT + ' resize-none'} />
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-2">特典详情图</h3>
        <div className="space-y-3">
          {images.map((img, i) => (
            <div key={i} className="frost-card p-3">
              <ImageUpload
                code={code}
                section="tokuten"
                value={img}
                onChange={v => setImages(arr => arr.map((x, j) => (j === i ? v : x)))}
              />
              <button onClick={() => setImages(arr => arr.filter((_, j) => j !== i))}
                className="text-xs text-red-400 hover:text-red-600 mt-2">移除这张</button>
            </div>
          ))}
        </div>
        <button onClick={() => setImages(arr => [...arr, ''])}
          className="btn-outline text-xs !px-4 !py-1.5 mt-3">+ 添加一张</button>
      </div>

      {err && <p className="text-xs text-red-500">{err}</p>}
      {saved && <p className="text-xs text-green-500">已保存</p>}
      <button onClick={save} className="btn-pink text-xs !px-4 !py-1.5">保存特典设置</button>
    </div>
  );
}
