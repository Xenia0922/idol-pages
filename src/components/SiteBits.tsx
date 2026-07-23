import { useState, useEffect } from "react";

interface Cfg {
  weibo?: string;
  weibo_name?: string;
  weibo_desc?: string;
  xiaohongshu?: string;
  douyin?: string;
}

// 模块级缓存：同一页面的多个社交组件只拉一次 /api/site
let cfgPromise: Promise<Cfg> | null = null;
function getSite(): Promise<Cfg> {
  // 优先用 middleware 注入的 SSR 数据
  if (
    typeof window !== "undefined" &&
    (window as any).__SSR_DATA__?.siteConfig
  ) {
    return Promise.resolve((window as any).__SSR_DATA__.siteConfig as Cfg);
  }
  if (!cfgPromise) {
    cfgPromise = fetch("/api/site")
      .then((r) => r.json())
      .catch(() => ({}) as Cfg);
  }
  return cfgPromise;
}

export function SiteSocial({
  variant = "buttons",
  initial,
}: {
  variant?: "icons" | "list" | "buttons";
  initial?: Cfg;
}) {
  const [cfg, setCfg] = useState<Cfg>(initial || {});

  useEffect(() => {
    let alive = true;
    getSite()
      .then((d) => {
        if (alive && d) setCfg(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const weibo = cfg.weibo || "";
  const xhs = cfg.xiaohongshu || "";
  const douyin = cfg.douyin || "";

  if (variant === "icons") {
    return (
      <>
        <a
          href={weibo}
          target="_blank"
          rel="noopener"
          className="opacity-50 hover:opacity-100 hover:scale-110 transition-all duration-200"
          title="微博"
        >
          <img src="/icon-weibo.png" alt="微博" className="w-4 h-4" />
        </a>
        <a
          href={xhs}
          target="_blank"
          rel="noopener"
          className="opacity-50 hover:opacity-100 hover:scale-110 transition-all duration-200"
          title="小红书"
        >
          <img src="/icon-xhs.png" alt="小红书" className="w-4 h-4" />
        </a>
        <a
          href={douyin}
          target="_blank"
          rel="noopener"
          className="opacity-50 hover:opacity-100 hover:scale-110 transition-all duration-200"
          title="抖音"
        >
          <img src="/icon-douyin.png" alt="抖音" className="w-4 h-4" />
        </a>
      </>
    );
  }

  if (variant === "list") {
    return (
      <div className="space-y-2.5 inline-block text-left">
        <a
          href={weibo}
          target="_blank"
          rel="noopener"
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-pink-500 dark:hover:text-pink-400 transition-colors"
        >
          <img src="/icon-weibo.png" alt="" className="w-4 h-4" /> 微博
        </a>
        <a
          href={xhs}
          target="_blank"
          rel="noopener"
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-pink-500 dark:hover:text-pink-400 transition-colors"
        >
          <img src="/icon-xhs.png" alt="" className="w-4 h-4" /> 小红书
        </a>
        <a
          href={douyin}
          target="_blank"
          rel="noopener"
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-pink-500 dark:hover:text-pink-400 transition-colors"
        >
          <img src="/icon-douyin.png" alt="" className="w-4 h-4" /> 抖音
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-center gap-3">
      <a
        href={weibo}
        target="_blank"
        rel="noopener"
        className="btn-outline text-sm !px-5 !py-3"
      >
        微博
      </a>
      <a
        href={xhs}
        target="_blank"
        rel="noopener"
        className="btn-outline text-sm !px-5 !py-3"
      >
        小红书
      </a>
      <a
        href={douyin}
        target="_blank"
        rel="noopener"
        className="btn-outline text-sm !px-5 !py-3"
      >
        抖音
      </a>
    </div>
  );
}

export function LiveLink({
  field,
  label,
  initial,
  className,
}: {
  field: keyof Cfg;
  label: string;
  initial?: string;
  className?: string;
}) {
  const [href, setHref] = useState(initial || "");

  useEffect(() => {
    let alive = true;
    getSite()
      .then((d) => {
        if (alive && d[field]) setHref(d[field] as string);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [field]);

  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener" className={className}>
      {label}
    </a>
  );
}

export function SiteMeta({
  field,
  initial,
  className,
}: {
  field: keyof Cfg;
  initial?: string;
  className?: string;
}) {
  const [text, setText] = useState(initial || "");

  useEffect(() => {
    let alive = true;
    getSite()
      .then((d) => {
        if (alive && d[field]) setText(d[field] as string);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [field]);

  return <>{text}</>;
}
