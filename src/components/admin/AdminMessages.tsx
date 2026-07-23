import { useState, useEffect, useCallback } from 'react';
import { useEvents } from '../useEvents';

const MEMBER_OPTS = [
  { id: '', label: '无 / 其他' },
  { id: 'member-a', label: '💗 成员A' },
  { id: 'member-b', label: '💙 成员B' },
  { id: 'member-c', label: '💚 成员C' },
  { id: 'other', label: '⭐ 其他' },
];

interface Msg {
  id: string;
  name: string;
  message: string;
  member: string | null;
  event?: string | null;
  created_at: string;
}

const INPUT =
  'w-full px-3 py-2 rounded-xl text-sm bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-[var(--accent)] transition-colors';

export default function AdminMessages({ code }: { code: string }) {
  const { events, loading: evLoading } = useEvents();
  const [list, setList] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [form, setForm] = useState({ name: '', message: '', member: '', event: '' });
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/messages');
      const data = await res.json();
      if (Array.isArray(data)) setList(data);
      else if (data.error) setErr(data.error);
    } catch { setErr('加载失败'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (m: Msg) => { setErr(''); setForm({ name: m.name, message: m.message, member: m.member || '', event: m.event || '' }); setEditing(m); };
  const startNew = () => { setErr(''); setForm({ name: '', message: '', member: '', event: '' }); setEditing({ id: 'new' } as Msg); };

  const save = async () => {
    if (!form.message.trim()) { setErr('内容必填'); return; }
    setErr('');
    const body = { name: form.name.trim() || '匿名粉丝', message: form.message.trim(), member: form.member || null, event: form.event || null };
    try {
      const isNew = !editing || editing.id === 'new';
      const res = await fetch('/api/messages', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify(isNew ? body : { ...body, id: editing!.id }),
      });
      const data = await res.json();
      if (data.ok) { setEditing(null); load(); }
      else setErr(data.error || '保存失败');
    } catch { setErr('保存失败'); }
  };

  const del = async (m: Msg) => {
    if (!confirm('删除这条留言？')) return;
    try {
      const res = await fetch('/api/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify({ id: m.id }),
      });
      const data = await res.json();
      if (data.ok) load();
      else alert(data.error || '删除失败');
    } catch { alert('删除失败'); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-[11px] text-gray-400">共 {list.length} 条留言</p>
        <button onClick={startNew} className="btn-pink text-xs !px-4 !py-1.5">+ 添加留言</button>
      </div>

      {editing && (
        <div className="frost-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="昵称" className={INPUT} />
            <select value={form.member} onChange={e => setForm(f => ({ ...f, member: e.target.value }))} className={INPUT}>
              {MEMBER_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <select value={form.event} onChange={e => setForm(f => ({ ...f, event: e.target.value }))} disabled={evLoading} className={INPUT + ' disabled:opacity-50'}>
            <option value="">{evLoading ? '加载中...' : '🎫 关联场次（选填）'}</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.date} {ev.title}</option>)}
          </select>
          <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={3} placeholder="留言内容" className={INPUT + ' resize-none'} />
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="flex gap-2">
            <button onClick={save} className="btn-pink text-xs !px-4 !py-1.5">保存</button>
            <button onClick={() => setEditing(null)} className="btn-outline text-xs !px-4 !py-1.5">取消</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-center text-gray-400 py-8">加载中…</p> : list.map(m => (
        <div key={m.id} className="frost-card p-4 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{m.name}</span>
              {m.event && <span className="text-[11px] text-gray-400">🎫 {m.event}</span>}
              <span className="text-xs text-gray-400">{new Date(m.created_at + 'Z').toLocaleString('zh-CN')}</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 break-words">{m.message}</p>
          </div>
          <button onClick={() => startEdit(m)} className="text-xs text-[var(--accent)] hover:opacity-70 px-2 py-1 rounded-full hover:bg-white/40 dark:hover:bg-white/5">编辑</button>
          <button onClick={() => del(m)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20">删除</button>
        </div>
      ))}
      {!loading && list.length === 0 && <p className="text-center text-gray-400 py-8">暂无留言</p>}
    </div>
  );
}
