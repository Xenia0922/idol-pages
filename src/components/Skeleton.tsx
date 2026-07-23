interface SkeletonProps {
  className?: string;
  style?: Record<string, string | number>;
}

/**
 * 统一骨架屏占位块（微光动画见 globals.css 的 .skeleton）。
 * 用于列表/卡片/图片加载态，全站视觉一致；装饰性元素 aria-hidden。
 */
export function Skeleton({ className = "", style }: SkeletonProps) {
  return (
    <div className={`skeleton ${className}`} style={style} aria-hidden="true" />
  );
}

export default Skeleton;
