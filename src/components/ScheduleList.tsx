import { useState, useEffect, useMemo } from 'react';
import { getEventImage } from '../utils/eventImages';
import Skeleton from './Skeleton';

interface ScheduleEvent {
  id: string;
  date: string;
  time?: string;
  title: string;
  venue?: string;
  performers?: string[];
  status?: string;
  image?: string;
}

const MEMBER_MAP: Record<string, { name: string; emoji: string }> = {
  'member-a': { name: '成员A', emoji: '💗' },
  'member-b': { name: '成员B', emoji: '💙' },
  'member-c': { name: '成员C', emoji: '💚' },
};

/**
 * 日程列表（/schedule）。优先顺序：
 *   1. 构建期 initial（来自 schedule.json）—— 静态 HTML 直接含完整列表，无占位、无布局跳动；
 *   2. 运行时 window.__SSR_DATA__.events（由 _middleware.js 注入，含后台最新编辑/新增）；
 *   3. 以上皆无才回退一次 fetch（极少见：全新 D1 且中间件尚未播种）。
 */
export default function ScheduleList({ initial }: { initial?: ScheduleEvent[] }) {
  const ssr = typeof window !== 'undefined' ? (window as any).__SSR_DATA__ : null;
  // 骨架优先：初始空 + loading，useEffect 按 SSR > 种子 > fetch 填充（消除写死种子先出的闪动）
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ssr?.events && ssr.events.length) {
      setEvents(ssr.events);
      setLoading(false);
      return;
    }
    if (initial && initial.length) {
      setEvents(initial);
      setLoading(false);
      return;
    }
    // 兜底：无 SSR 也无 initial（极少见），回退一次 fetch
    let alive = true;
    fetch('/api/events')
      .then((r) => r.json())
      .then((d) => {
        if (alive && Array.isArray(d) && d.length) setEvents(d);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const groups = useMemo(() => {
    const sorted = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const map = new Map<string, ScheduleEvent[]>();
    for (const e of sorted) {
      const d = new Date(e.date);
      const key = d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries());
  }, [events]);

  const card = (evt: ScheduleEvent, i: number) => {
    const d = new Date(evt.date);
    const img = evt.image || getEventImage(evt.id);
    const isPast = evt.status === 'past';
    const chips = (evt.performers || [])
      .map((pid: string) => {
        const m = MEMBER_MAP[pid];
        return m ? `${m.emoji}${m.name}` : '';
      })
      .filter(Boolean);
    return (
      <a
        key={evt.id}
        href={'/schedule/' + evt.id}
        className={`card group flex flex-col ${isPast ? 'opacity-90 hover:opacity-100' : ''}`}
      >
        <div className="aspect-[16/9] overflow-hidden bg-gray-100 dark:bg-gray-800">
          <img
            src={img}
            alt={evt.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        </div>
        <div className="p-4 flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold text-pink-500">
              {d.getMonth() + 1}/{d.getDate()}
            </span>
            <span className="text-xs text-gray-400">{d.getFullYear()}</span>
            {evt.time && <span className="text-xs text-gray-400">· {evt.time}</span>}
            {isPast ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 ml-auto">
                已结束
              </span>
            ) : (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full ml-auto"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                即将到来
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-2">{evt.title}</h3>
          <p className="text-xs text-gray-400 mt-1">{evt.venue}</p>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-x-2 gap-y-1 mt-2">
              {chips.map((c, i) => (
                <span key={i} className="text-[11px] text-gray-500 dark:text-gray-400">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      </a>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 md:py-16">
      <div className="text-center mb-10" data-reveal>
        <p className="text-pink-500">✦</p>
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-gray-100 mt-1">日程</h1>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card overflow-hidden">
              <Skeleton className="aspect-[16/9] rounded-none" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-3 w-16 rounded-full" />
                <Skeleton className="h-4 w-3/4 rounded-full" />
                <Skeleton className="h-3 w-1/2 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-center text-gray-400 py-16">暂无日程</p>
      ) : (
        <div className="content-enter">
          {groups.map(([month, evts]) => (
            <div key={month} className="mb-10">
              <h2 className="text-sm font-bold text-pink-500 tracking-widest mb-4">{month}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {evts.map((evt, i) => card(evt, i))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
