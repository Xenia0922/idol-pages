import { useState, useEffect } from 'react';
import EventDetail from './EventDetail';

/**
 * 404 页面兜底。SSR 时返回 null（不预渲染任何 404 内容，避免运行时日程请求闪出 404 文本），
 * 客户端 mount 后再根据实际 URL 决定渲染日程详情还是 404 页面。
 */
export default function NotFoundHandler() {
  const [id, setId] = useState<string | null | false>(null);

  useEffect(() => {
    const m = location.pathname.match(/^\/schedule\/([\w-]+)/);
    setId(m && m[1] !== 'index' ? m[1] : false);
  }, []);

  // SSR：不渲染任何内容（等待客户端判定）
  if (id === null) return null;

  // 客户端判定为日程路由 → 直接渲染 EventDetail（无 404 闪烁）
  if (typeof id === 'string') return <EventDetail id={id} />;

  // 客户端判定为真正 404
  return (
    <section className="min-h-[60vh] flex items-center justify-center px-4 text-center">
      <div>
        <p className="text-8xl font-extrabold text-pink-200 mb-4">404</p>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">页面未找到</h1>
        <p className="text-gray-400 mb-8">页面未找到，返回首页吧</p>
        <div className="flex justify-center gap-3">
          <a href="/" className="btn-pink">返回首页</a>
          <a href="/schedule" className="btn-outline">演出日程</a>
        </div>
      </div>
    </section>
  );
}
