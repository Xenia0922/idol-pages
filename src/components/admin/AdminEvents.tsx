import { useState, useEffect, useCallback } from 'react';
import ImageUpload from './ImageUpload';

interface EventRow {
  id: string;
  date: string;
  time?: string;
  title: string;
  venue?: string;
  performers?: string[];
  status?: string;
  image?: string;
  body?: string;
}

const MEMBER_OPTS = [
  { id: 'hakusai', label: '💛 白菜' },
  { id: 'kumo', label: '💙 云团' },
  { id: 'yuzi', label: '💚 柚子' },
  { id: 'other', label: '⭐ 其他' },
];

const INPUT =
  'w-full px-3 py-2 rounded-xl text-sm bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-[var(--accent)] transition-colors';

export default function AdminEvents({ code }: { code: string }) {
  const [list, setList] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [form, setForm] = useState<Partial<EventRow>>({});
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/events?all=1', { headers: { 'x-admin-code': code } });
      const data = await res.json();
      if (Array.isArray(data)) setList(data);
      else if (data.error) setErr(data.error);
    } catch { setErr('加载失败'); }
    setLoading(false);
  }, [code]);

  useEffect(() => { load(); }, [load]);

  const startNew = () => {
    setErr('');
    const today = new Date().toISOString().slice(0, 10);
    setForm({ status: 'upcoming', performers: [], date: today, id: 'live-' + today });
    setEditing({ id: 'new' } as EventRow);
  };
  const startEdit = (e: EventRow) => {
    setErr('');
    setForm({ ...e, performers: e.performers || [] });
    setEditing(e);
  };

  const togglePerformer = (pid: string) => {
    const cur = form.performers || [];
    setForm(f => ({ ...f, performers: cur.includes(pid) ? cur.filter(p => p !== pid) : [...cur, pid] }));
  };

  const save = async () => {
    if (!form.title?.trim() || !form.date) { setErr('标题与日期必填'); return; }
    setErr('');
    const body = { ...form, title: form.title.trim() };
    try {
      const isNew = !editing || editing.id === 'new';
      const res = await fetch('/api/events', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) { setEditing(null); load(); }
      else setErr(data.error || '保存失败');
    } catch { setErr('保存失败'); }
  };

  const del = async (e: EventRow) => {
    if (!confirm(`删除「${e.title}」？`)) return;
    try {
      const res = await fetch('/api/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify({ id: e.id }),
      });
      const data = await res.json();
      if (data.ok) load();
      else alert(data.error || '删除失败');
    } catch { alert('删除失败'); }
  };

  if (editing) {
    const set = (k: keyof EventRow, v: any) => setForm(f => ({ ...f, [k]: v }));
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
          {editing.id === 'new' ? '新建日程' : `编辑 ${form.title || ''}`}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">ID（唯一，新建必填）</span>
            <input disabled={editing.id !== 'new'} value={form.id || ''} onChange={e => set('id', e.target.value.trim())} placeholder="live-2026-08-01" className={INPUT} />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">日期</span>
            <input type="date" value={form.date || ''} onChange={e => {
              const d = e.target.value;
              set('date', d);
              // 新日程或 ID 以 live- 开头：自动同步为 live-YYYY-MM-DD
              if (editing?.id === 'new' || (form.id && /^live-/.test(form.id))) {
                set('id', 'live-' + d);
              }
            }} className={INPUT} />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">时间</span>
            <input value={form.time || ''} onChange={e => set('time', e.target.value)} placeholder="14:00" className={INPUT} />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">状态</span>
            <select value={form.status || 'upcoming'} onChange={e => set('status', e.target.value)} className={INPUT}>
              <option value="upcoming">未开始</option>
              <option value="past">已结束</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">标题</span>
          <input value={form.title || ''} onChange={e => set('title', e.target.value)} className={INPUT} />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">地点</span>
          <input value={form.venue || ''} onChange={e => set('venue', e.target.value)} className={INPUT} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">日程详情（支持 Markdown，活动结算 / 歌单等）</span>
          <textarea
            value={form.body || ''}
            onChange={e => set('body', e.target.value)}
            rows={10}
            placeholder={"## 标题\n\n正文…（**加粗**、列表、- 项目符号 均支持）"}
            className={INPUT + ' font-mono resize-y leading-relaxed'}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">活动图片（海报 / 现场图）</span>
          <ImageUpload code={code} section="events" value={form.image || ''} onChange={v => set('image', v)} label="活动图片" />
        </label>
        <div>
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">参演成员</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {MEMBER_OPTS.map(m => {
              const on = (form.performers || []).includes(m.id);
              return (
                <button key={m.id} type="button" onClick={() => togglePerformer(m.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${on ? 'btn-pink' : 'btn-outline'}`}>
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
        {err && <p className="text-xs text-red-500">{err}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={save} className="btn-pink text-xs !px-4 !py-1.5">保存</button>
          <button onClick={() => setEditing(null)} className="btn-outline text-xs !px-4 !py-1.5">返回列表</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-[11px] text-gray-400">共 {list.length} 场</p>
        <button onClick={startNew} className="btn-pink text-xs !px-4 !py-1.5">+ 新建日程</button>
      </div>
      {loading ? <p className="text-center text-gray-400 py-8">加载中…</p> : list.map(e => (
        <div key={e.id} className="frost-card p-4 flex items-start gap-3">
          <div className="flex-shrink-0 text-center min-w-[44px]">
            <span className="text-base font-extrabold text-pink-500">{e.date.slice(5).replace('-', '/')}</span>
            {e.time && <p className="text-[10px] text-gray-400 mt-0.5">{e.time}</p>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{e.title}</span>
              {e.status === 'past' && <span className="text-[10px] bg-gray-200 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">已结束</span>}
              {e.status === 'upcoming' && <span className="text-[10px] bg-[var(--accent)]/15 text-[var(--accent)] px-2 py-0.5 rounded-full font-semibold">即将到来</span>}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{e.venue}</p>
          </div>
          <button onClick={() => startEdit(e)} className="text-xs text-[var(--accent)] hover:opacity-70 px-2 py-1 rounded-full hover:bg-white/40 dark:hover:bg-white/5">编辑</button>
          <button onClick={() => del(e)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20">删除</button>
        </div>
      ))}
    </div>
  );
}
