import { useState, useEffect } from "react";

/**
 * 骨架屏 → 真实内容的「交叉淡入」过渡组件。
 *
 * 解决硬切时的两个体感问题：
 *  1) 骨架瞬间消失、内容从 opacity:0 淡入之间有一帧「空档」（视觉抖动）；
 *  2) 骨架与内容高度不完全一致时的布局跳动。
 *
 * 行为：
 *  - loading=true：只渲染骨架（由骨架决定容器高度）。
 *  - 数据到达（loading=false）：真实内容挂载并以其高度撑开容器，
 *    骨架以 absolute 覆盖层保持「不透明」一帧后淡出（300ms），
 *    内容同时 content-enter 淡入（450ms），形成连贯的 morph，无空档、无跳动。
 *  - reduced-motion：.content-enter 与 .skeleton::after 已在 globals.css 降级，本组件不额外处理。
 */
export default function SkeletonSwap({
  loading,
  skeleton,
  children,
  className = "",
}: {
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  // 过渡态：数据到达后保留骨架短暂淡出，与内容淡入交叉，消除「空档」
  const [showSk, setShowSk] = useState(loading);
  const [skFading, setSkFading] = useState(false);

  useEffect(() => {
    if (loading) {
      setShowSk(true);
      setSkFading(false);
      return;
    }
    // 数据到达：保持骨架并下一帧触发淡出；内容(content-enter)同时淡入；320ms 后卸载骨架
    setShowSk(true);
    const raf = requestAnimationFrame(() => setSkFading(true));
    const t = setTimeout(() => {
      setShowSk(false);
      setSkFading(false);
    }, 320);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [loading]);

  if (loading) {
    return <div className={className}>{skeleton}</div>;
  }

  return (
    <div className={`relative ${className}`}>
      <div className="content-enter">{children}</div>
      {showSk && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-300 ${skFading ? "opacity-0" : "opacity-100"}`}
        >
          {skeleton}
        </div>
      )}
    </div>
  );
}
