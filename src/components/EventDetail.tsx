import { useState, useEffect } from 'react';
import StaticImageLightbox from './StaticImageLightbox';
import Skeleton from './Skeleton';

interface EventDetailProps {
  id: string;
  /** 构建期由 [id].astro 注入（含 bodyHtml——body 的预渲染 HTML），
   *  或运行时由 middleware 注入 window.__SSR_DATA__.event（含 body，不含 bodyHtml）。
   *  存在时直接渲染，不发起 fetch、无布局跳动；bodyHtml 缺失时才动态 import marked 兜底。 */
  event?: any;
}

export default function EventDetail({ id, event: eventProp }: EventDetailProps) {
  // 优先：构建期 prop -> 运行时 SSR 注入，二者皆无才回退 fetch
  const ssr = typeof window !== 'undefined' ? (window as any).__SSR_DATA__ : null;
  const initialEvent = eventProp || (ssr && ssr.event) || null;

  const [ev, setEv] = useState<any>(initialEvent);
  const [loading, setLoading] = useState(!initialEvent);
  const [bodyHtml, setBodyHtml] = useState<string>(initialEvent?.bodyHtml || '');

  // 更新浏览器标题——覆盖 404 页继承的「404 | 页面未找到」
  useEffect(() => {
    if (ev && typeof document !== 'undefined') {
      document.title = ev.title + ' | ' + ((window as any).__SSR_DATA__?.siteConfig?.name || 'Fansite');
    }
  }, [ev]);

  // body 转换：优先用构建期预渲染的 bodyHtml，缺失时才动态加载 marked（仅运行时新增日程触发）
  useEffect(() => {
    if (!ev) return;
    if (ev.bodyHtml) {
      setBodyHtml(ev.bodyHtml);
      return;
    }
    if (!ev.body) {
      setBodyHtml('');
      return;
    }
    import('marked').then((mod) => {
      const { marked: parser } = mod;
      const html = (
        typeof parser.parse === 'function'
          ? parser.parse(ev.body, { async: false })
          : parser(ev.body)
      ) as string;
      setBodyHtml(html);
    });
  }, [ev]);

  useEffect(() => {
    if (initialEvent) return; // 已有同步数据，无需 fetch
    let alive = true;
    fetch('/api/events?id=' + encodeURIComponent(id))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('not found'))))
      .then((d) => {
        if (alive) {
          setEv(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (!ev) {
    if (loading) return (
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-16" aria-hidden="true">
        <Skeleton className="h-4 w-24 rounded-full mb-6" />
        <div className="flex flex-wrap gap-2 mb-6">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-2/3 rounded-full mb-6" />
        <Skeleton className="w-full aspect-[16/9] rounded-2xl mb-6" />
        <div className="space-y-3">
          <Skeleton className="h-3 rounded-full w-full" />
          <Skeleton className="h-3 rounded-full w-full" />
          <Skeleton className="h-3 rounded-full w-4/5" />
          <Skeleton className="h-3 rounded-full w-3/4" />
        </div>
      </div>
    );
    return <p className="text-center text-gray-400 py-16">未找到该日程</p>;
  }

  const d = new Date(ev.date);

  return (
    <article className="max-w-3xl mx-auto px-4 py-12 md:py-16 content-enter">
      <a
        href="/schedule"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 mb-6"
      >
        ← 返回日程
      </a>

      <div className="flex flex-wrap gap-2 mb-6 text-sm">
        <span className="bg-pink-50 dark:bg-gray-800 text-pink-600 dark:text-pink-300 px-3 py-1.5 rounded-full font-medium">
          {d.getMonth() + 1}月{d.getDate()}日
        </span>
        {ev.time && (
          <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-full">
            {ev.time}
          </span>
        )}
        {ev.venue && (
          <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-full">
            {ev.venue}
          </span>
        )}
      </div>

      <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-gray-100 mb-2">{ev.title}</h1>

      {ev.image && (
        <StaticImageLightbox
          mode="single"
          images={[{ src: ev.image, alt: ev.title }]}
          itemClassName="block w-full mb-8 bg-transparent appearance-none"
          imageClassName="w-full rounded-2xl object-cover max-h-[500px] bg-gray-100 dark:bg-gray-800 cursor-zoom-in hover:opacity-95 transition-opacity"
        />
      )}

      <div className="event-detail" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
    </article>
  );
}
