/**
 * 广告/招募管理 Tab — 从 AdminPanel 中拆分出来的独立组件。
 * 职责：广告卡片 CRUD + 拖拽排序 + 实时预览（浅色/暗色）。
 */
import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { INPUT_CLS } from '../AdminPanel';

export interface Recruit {
  id: number;
  title: string;
  subtitle: string | null;
  body: string;
  cta_text: string;
  cta_url: string;
  deadline: string | null;
  enabled: number;
  sort_order: number;
  created_at: string;
}

interface RecruitForm {
  id: number | null;
  title: string;
  subtitle: string;
  body: string;
  cta_text: string;
  cta_url: string;
  deadline: string;
  enabled: boolean;
  sort_order: number;
}

const EMPTY_FORM: RecruitForm = {
  id: null, title: '', subtitle: '', body: '', cta_text: '',
  cta_url: '', deadline: '', enabled: true, sort_order: 0,
};

const fmtDeadline = (d: string) => {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(d);
  if (!m) return d;
  const base = parseInt(m[2], 10) + '.' + m[3];
  if (m[4] && m[5]) return base + ' ' + m[4] + ':' + m[5];
  return base;
};

interface Props {
  code: string;
}

export default function AdminRecruits({ code }: Props) {
  const [recruits, setRecruits] = useState<Recruit[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<RecruitForm>(EMPTY_FORM);
  const [dragId, setDragId] = useState<number | null>(null);

  const fetchRecruits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recruits?all=1', { headers: { 'x-admin-code': code } });
      const data = await res.json();
      if (Array.isArray(data)) setRecruits(data);
      else if (data.error) alert(data.error);
    } catch { /* fail silent */ }
    finally { setLoading(false); }
  }, [code]);

  useEffect(() => { fetchRecruits(); }, [fetchRecruits]);

  const nextSortOrder = () => {
    if (recruits.length === 0) return 1;
    return Math.max(...recruits.map(r => Number(r.sort_order) || 0)) + 1;
  };

  useEffect(() => {
    if (!form.id && form.sort_order === 0 && !loading) {
      setForm(f => ({ ...f, sort_order: nextSortOrder() }));
    }
  }, [form.id, form.sort_order, loading]);

  const editRecruit = (r: Recruit) => {
    setForm({
      id: r.id, title: r.title, subtitle: r.subtitle || '', body: r.body, cta_text: r.cta_text,
      cta_url: r.cta_url, deadline: r.deadline || '',
      enabled: !!r.enabled, sort_order: r.sort_order,
    });
  };

  const submitRecruit = async () => {
    if (!form.title.trim() || !form.body.trim() || !form.cta_url.trim()) {
      alert('标题 / 正文 / 链接必填');
      return;
    }
    if (!/^https?:\/\//.test(form.cta_url.trim())) {
      alert('链接需以 http(s):// 开头');
      return;
    }
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      body: form.body.trim(),
      cta_text: form.cta_text.trim(),
      cta_url: form.cta_url.trim(),
      deadline: form.deadline || null,
      enabled: form.enabled ? 1 : 0,
      sort_order: Number(form.sort_order) || 0,
    };
    try {
      const res = await fetch('/api/recruits', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify(form.id ? { ...payload, id: form.id } : payload),
      });
      const data = await res.json();
      if (data.ok) { setForm(EMPTY_FORM); fetchRecruits(); }
      else alert(data.error || '保存失败');
    } catch {
      alert('网络错误，保存失败');
    }
  };

  const delRecruit = async (r: Recruit) => {
    if (!confirm(`删除「${r.title}」？`)) return;
    try {
      const res = await fetch('/api/recruits', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify({ id: r.id }),
      });
      const data = await res.json();
      if (data.ok) fetchRecruits();
      else alert(data.error || '删除失败');
    } catch {
      alert('网络错误，删除失败');
    }
  };

  const reorderRecruits = async (order: { id: number; sort_order: number }[]) => {
    try {
      const res = await fetch('/api/recruits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-code': code },
        body: JSON.stringify({ order }),
      });
      const data = await res.json();
      if (data.ok) fetchRecruits();
      else alert(data.error || '排序保存失败');
    } catch {
      alert('网络错误，排序保存失败');
    }
  };

  const handleDrop = (targetId: number) => {
    if (dragId == null || dragId === targetId) { setDragId(null); return; }
    const from = recruits.findIndex(r => r.id === dragId);
    const to = recruits.findIndex(r => r.id === targetId);
    if (from === -1 || to === -1) { setDragId(null); return; }
    const next = [...recruits];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setRecruits(next);
    reorderRecruits(next.map((r, i) => ({ id: r.id, sort_order: i })));
    setDragId(null);
  };

  // --- 实时预览卡片 ---
  const AdCard = ({ dark }: { dark: boolean }) => {
    const title = form.title.trim() || '主标题';
    const subtitle = form.subtitle.trim() || '';
    const body = form.body.trim() || '正文内容';
    const ctaRaw = form.cta_text.trim() || '查看详情 →';
    const cta = /[→➔➡]/u.test(ctaRaw) ? ctaRaw : ctaRaw + ' →';
    const dl = fmtDeadline(form.deadline);
    const accent = 'var(--accent)';
    const cardStyle: CSSProperties = dark
      ? {
          background: 'linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.035))',
          border: '1px solid rgba(255,255,255,0.09)',
          borderLeft: `3px solid ${accent}`,
          color: '#c8c3da',
          boxShadow: 'var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.07)',
        }
      : {
          background: 'linear-gradient(160deg, rgba(255,255,255,0.72), rgba(255,255,255,0.52))',
          border: '1px solid rgba(255,255,255,0.6)',
          borderLeft: `3px solid ${accent}`,
          color: 'var(--text)',
          boxShadow: 'var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.5)',
        };
    return (
      <div style={cardStyle} className="rounded-2xl p-4">
        <p style={{ color: accent }} className="font-bold text-[15px] leading-snug mb-1.5">{title}</p>
        <p style={{ color: dark ? '#a59fc0' : 'var(--text-soft)' }} className="text-xs leading-snug mb-2">
          {subtitle || '　副标题'}
        </p>
        <p style={{ color: dark ? '#a59fc0' : 'var(--text-soft)' }} className="text-xs leading-snug mb-2.5">
          {body || '正文内容'}
        </p>
        <span style={{ color: accent }} className="inline-flex items-center gap-1 text-[13px] font-bold">{cta}</span>
      </div>
    );
  };

  if (loading) {
    return <p className="text-center text-gray-400 py-8">加载中...</p>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* 列表 */}
      <div className="space-y-3">
        <p className="text-[11px] text-gray-400">拖动卡片左侧 ⋮⋮ 可调整投放顺序（越靠前越优先展示）</p>
        {recruits.map(r => (
          <div
            key={r.id}
            className="frost-card p-4"
            draggable
            onDragStart={(e) => { setDragId(r.id); e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
            onDrop={() => handleDrop(r.id)}
            onDragEnd={() => setDragId(null)}
            style={dragId === r.id ? { opacity: 0.4 } : undefined}
          >
            <div className="flex items-start gap-3">
              <span
                className="flex-shrink-0 cursor-grab active:cursor-grabbing select-none text-gray-300 dark:text-gray-600 mt-0.5 text-lg leading-none"
                title="拖动调整顺序"
              >⋮⋮</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-bold text-[var(--accent)]">{r.title}</span>
                  {r.enabled ? (
                    <span className="chip text-[10px] !py-0">投放中</span>
                  ) : (
                    <span className="text-[10px] bg-gray-200 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">已停投</span>
                  )}
                  {r.deadline && <span className="text-xs text-gray-400">截止 {fmtDeadline(r.deadline)}</span>}
                  <span className="text-xs text-gray-300 dark:text-gray-600">#{r.sort_order}</span>
                </div>
                {r.subtitle && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 break-words">{r.subtitle}</p>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-300 break-words">{r.body}</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{r.cta_url}</p>
              </div>
              <div className="flex-shrink-0 flex flex-col gap-1">
                <button
                  onClick={() => editRecruit(r)}
                  className="text-xs text-[var(--accent)] hover:opacity-70 px-2 py-1 rounded-full hover:bg-white/40 dark:hover:bg-white/5 transition-colors"
                >编辑</button>
                <button
                  onClick={() => delRecruit(r)}
                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >删除</button>
              </div>
            </div>
          </div>
        ))}
        {recruits.length === 0 && (
          <p className="text-center text-gray-400 py-8">暂无广告，在下方表单新建第一条</p>
        )}
      </div>

      {/* 实时预览 */}
      <div className="frost-card p-5">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-3">实时预览（浅色 / 暗色）</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] text-gray-400 mb-1.5">浅色模式</p>
            <div style={{ background: '#f5f2fb', padding: '10px', borderRadius: '16px' }}>
              <AdCard dark={false} />
            </div>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 mb-1.5">暗色模式</p>
            <div style={{ background: '#0c0b14', padding: '10px', borderRadius: '16px' }}>
              <AdCard dark={true} />
            </div>
          </div>
        </div>
      </div>

      {/* 新建 / 编辑表单 */}
      <div className="frost-card p-5">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-4">
          {form.id ? `编辑 #${form.id}` : '新建广告'}
        </h3>
        <div className="space-y-3">
          <input
            value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="标题（如：研修生招募）" className={INPUT_CLS}
          />
          <input
            value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })}
            placeholder="副标题（如：你的团体简介标语）" className={INPUT_CLS}
          />
          <textarea
            value={form.body} onChange={e => setForm({ ...form, body: e.target.value })}
            placeholder="正文（如：微博转发关注抽 52 元偶活基金）"
            rows={2} className={`${INPUT_CLS} resize-none`}
          />
          <input
            value={form.cta_text} onChange={e => setForm({ ...form, cta_text: e.target.value })}
            placeholder="按钮文案（可留空，默认「查看详情 →」）" className={INPUT_CLS}
          />
          <input
            value={form.cta_url} onChange={e => setForm({ ...form, cta_url: e.target.value })}
            placeholder="跳转链接（需 http(s):// 开头）" className={INPUT_CLS}
          />
          <div className="flex gap-3 flex-wrap items-center">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              截止时间
              <input
                type="datetime-local" value={form.deadline}
                onChange={e => setForm({ ...form, deadline: e.target.value })}
                className={`${INPUT_CLS} w-auto`}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              排序
              <input
                type="number" value={form.sort_order}
                onChange={e => setForm({ ...form, sort_order: +e.target.value })}
                className={`${INPUT_CLS} w-20`}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox" checked={form.enabled}
                onChange={e => setForm({ ...form, enabled: e.target.checked })}
              />
              投放中
            </label>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={submitRecruit} className="btn-pink text-xs !px-4 !py-1.5">
              {form.id ? '保存修改' : '创建投放'}
            </button>
            {form.id && (
              <button onClick={() => setForm(EMPTY_FORM)} className="btn-outline text-xs !px-4 !py-1.5">
                取消
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
