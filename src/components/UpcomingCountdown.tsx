import { useState, useEffect } from 'react';
import { type EventRow } from './EventCardGrid';
import Skeleton from './Skeleton';
import SkeletonSwap from './SkeletonSwap';

function firstUpcoming(list: EventRow[]): EventRow | null {
  const up = list
    .filter((e) => e.status === 'upcoming')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return up.length > 0 ? up[0] : null;
}

function calcCountdown(target: Date) {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}
function fm(n: number) { return String(n).padStart(2, '0'); }

export default function UpcomingCountdown({ initial = [] }: { initial?: EventRow[] }) {
  const ssr = typeof window !== 'undefined' ? (window as any).__SSR_DATA__ : null;
  // 骨架优先：初始空 + loading，useEffect 按 SSR > 种子 > fetch 填充
  const [event, setEvent] = useState<EventRow | null>(null);
  const [cd, setCd] = useState<ReturnType<typeof calcCountdown>>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    // 优先用本地数据源（SSR > initial）找 upcoming；找到立即 setEvent，无 fetch（零二次加载）
    const localSources = [ssr?.events, initial].filter((s): s is EventRow[] => Array.isArray(s) && s.length > 0);
    for (const src of localSources) {
      const up = firstUpcoming(src);
      if (up) { setEvent(up); return; }
    }
    // 本地数据源都没有 upcoming（D1 偶发失败或 ssr 缺失时的异常恢复，非正常流程）
    let alive = true;
    fetch('/api/events')
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        if (Array.isArray(data) && data.length) {
          const up = firstUpcoming(data);
          if (up) setEvent(up);
          else { setEmpty(true); setLoading(false); }
        } else { setEmpty(true); setLoading(false); }
      })
      .catch(() => { if (alive) { setEmpty(true); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  // 倒计时 tick：event 就绪后计算 cd 并关闭骨架（确保骨架与内容交叉淡入，无空档）
  useEffect(() => {
    if (!event) return;
    const tick = () => {
      const d = event.time ? event.date + 'T' + event.time + ':00' : event.date + 'T00:00:00';
      setCd(calcCountdown(new Date(d)));
    };
    tick();
    const t = setInterval(tick, 1000);
    setLoading(false);
    return () => clearInterval(t);
  }, [event]);

  if (!loading && empty) return (
    <p className="text-center text-gray-400 text-sm py-4 content-enter">暂无即将到来的演出</p>
  );

  const text = cd && cd.days > 0
    ? cd.days + ' 天 ' + fm(cd.hours) + ':' + fm(cd.minutes) + ':' + fm(cd.seconds)
    : (cd ? fm(cd.hours) + ':' + fm(cd.minutes) + ':' + fm(cd.seconds) : '');
  const dd = event ? new Date(event.date) : null;
  const w = ['日', '一', '二', '三', '四', '五', '六'];
  const ds = dd ? String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0') + ' 周' + w[dd.getDay()] : '';

  return (
    <SkeletonSwap
      loading={loading}
      skeleton={
        <div className="frost-card p-4 text-center max-w-sm mx-auto" aria-hidden="true">
          <Skeleton className="h-3 w-24 mx-auto rounded-full mb-2" />
          <Skeleton className="h-4 w-40 mx-auto rounded-full mb-2" />
          <Skeleton className="h-6 w-32 mx-auto rounded-full" />
        </div>
      }
    >
      {event && cd && (
        <div className="frost-card p-4 text-center max-w-sm mx-auto">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider">Next Live</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-400">{ds}</span>
          </div>
          <p className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">{event.title}</p>
          {event.venue && <p className="text-[11px] text-gray-400 mb-1.5">{event.venue}</p>}
          <p className="text-xl font-black text-[var(--accent)] tabular-nums font-mono">{text}</p>
        </div>
      )}
    </SkeletonSwap>
  );
}
