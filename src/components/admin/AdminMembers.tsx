import { useState, useEffect, useCallback } from 'react';
import ImageUpload from './ImageUpload';
import MemberGalleryUpload from './MemberGalleryUpload';

interface Member {
  id: string;
  name: string;
  name_jp?: string;
  color?: string;
  emoji?: string;
  birthday?: string;
  constellation?: string;
  status?: string;
  image?: string;
  gallery?: string[];
  weibo?: string;
  weibo_name?: string;
  weibo_desc?: string;
  intro?: string;
  sort_order?: number;
}

const INPUT =
  'w-full px-3 py-2 rounded-xl text-sm bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-[var(--accent)] transition-colors';

export default function AdminMembers({ code }: { code: string }) {
  const [list, setList] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Member | null>(null); // null=列表, 'new'=新建, Member=编辑
  const [form, setForm] = useState<Partial<Member>>({});
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/members?all=1', { headers: { 'x-admin-code': code } });
      const data = await res.json();
      if (Array.isArray(data)) setList(data);
      else if (data.error) setErr(data.error);
    } catch {
      setErr('加载失败');
    }
    setLoading(false);
  }, [code]);

  useEffect(() => { load(); }, [load]);

  const startNew = () => {
    setErr('');
    setForm({ status: 'active', gallery: [], sort_order: list.length + 1 });
    setEditing({ id: 'new' } as Member);
  };

  const startEdit = (m: Member) => {
    setErr('');
    setForm({ ...m });
    setEditing(m);
  };

  const save = async () => {
    if (!form.name?.trim()) { setErr('名称必填'); return; }
    setErr('');
    const body = {
      ...form,
      name: form.name.trim(),
      gallery: Array.isArray(form.gallery) ? form.gallery : [],
      sort_order: form.sort_order != null && Number.isFinite(+form.sort_order) ? +form.sort_order : 99,
    };
    try {
      const isNew = !editing || editing.id === 'new';
      const res = await fetch('/api/members', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) { setEditing(null); load(); }
      else setErr(data.error || '保存失败');
    } catch {
      setErr('保存失败');
    }
  };

  const del = async (m: Member) => {
    if (!confirm(`删除成员「${m.name}」？`)) return;
    try {
      const res = await fetch('/api/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify({ id: m.id }),
      });
      const data = await res.json();
      if (data.ok) load();
      else alert(data.error || '删除失败');
    } catch { alert('删除失败'); }
  };

  if (editing) {
    const set = (k: keyof Member, v: any) => setForm(f => ({ ...f, [k]: v }));
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
          {editing.id === 'new' ? '新建成员' : `编辑 ${form.name || ''}`}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ID（slug，新建必填）">
            <input disabled={editing.id !== 'new'} value={form.id || ''} onChange={e => set('id', e.target.value.trim().toLowerCase())} placeholder="如 member-a" className={INPUT} />
          </Field>
          <Field label="名称">
            <input value={form.name || ''} onChange={e => set('name', e.target.value)} className={INPUT} />
          </Field>
          <Field label="日文名">
            <input value={form.name_jp || ''} onChange={e => set('name_jp', e.target.value)} className={INPUT} />
          </Field>
          <Field label="成员色">
            <input value={form.color || ''} onChange={e => set('color', e.target.value)} placeholder="#FFD700" className={INPUT} />
          </Field>
          <Field label="emoji">
            <input value={form.emoji || ''} onChange={e => set('emoji', e.target.value)} placeholder="💛" className={INPUT} />
          </Field>
          <Field label="生日">
            <input value={form.birthday || ''} onChange={e => set('birthday', e.target.value)} placeholder="06-27" className={INPUT} />
          </Field>
          <Field label="星座">
            <input value={form.constellation || ''} onChange={e => set('constellation', e.target.value)} className={INPUT} />
          </Field>
          <Field label="状态">
            <select value={form.status || 'active'} onChange={e => set('status', e.target.value)} className={INPUT}>
              <option value="active">在籍</option>
              <option value="graduated">已毕业</option>
            </select>
          </Field>
        </div>
        <Field label="头像">
          <ImageUpload code={code} section="members" value={form.image || ''} onChange={v => set('image', v)} />
        </Field>
        <Field label="画廊图片（九宫格，逐个上传）">
          <MemberGalleryUpload code={code} section="members" value={form.gallery || []} onChange={updater => setForm(f => ({ ...f, gallery: updater(f.gallery || []) }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="微博链接">
            <input value={form.weibo || ''} onChange={e => set('weibo', e.target.value)} className={INPUT} />
          </Field>
          <Field label="微博名">
            <input value={form.weibo_name || ''} onChange={e => set('weibo_name', e.target.value)} className={INPUT} />
          </Field>
        </div>
        <Field label="微博简介">
          <input value={form.weibo_desc || ''} onChange={e => set('weibo_desc', e.target.value)} className={INPUT} />
        </Field>
        <Field label="简介（换行分段，会按段落显示在详情页）">
          <textarea value={form.intro || ''} onChange={e => set('intro', e.target.value)} rows={6} className={INPUT + ' resize-y'} />
        </Field>
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
        <p className="text-[11px] text-gray-400">共 {list.length} 位成员</p>
        <button onClick={startNew} className="btn-pink text-xs !px-4 !py-1.5">+ 新建成员</button>
      </div>
      {loading ? <p className="text-center text-gray-400 py-8">加载中…</p> : list.map(m => (
        <div key={m.id} className="frost-card p-4 flex items-center gap-3">
          <img src={m.image || ''} alt="" className="w-12 h-12 rounded-xl object-cover bg-gray-100 dark:bg-gray-800" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{m.name}</span>
              <span className="text-xs text-gray-400">{m.emoji} {m.name_jp}</span>
              {m.status === 'graduated' && <span className="text-[10px] bg-gray-200 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">已毕业</span>}
            </div>
            <p className="text-xs text-gray-400 truncate">/{m.id}</p>
          </div>
          <button onClick={() => startEdit(m)} className="text-xs text-[var(--accent)] hover:opacity-70 px-2 py-1 rounded-full hover:bg-white/40 dark:hover:bg-white/5">编辑</button>
          <button onClick={() => del(m)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20">删除</button>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{label}</span>
      {children}
    </label>
  );
}
