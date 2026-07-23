import { useState, useEffect } from "react";
import { SiteSocial } from "./SiteBits";

interface Cfg {
  about_worldview?: string;
  about_intro?: string;
  weidian?: string;
  staff_qq?: string;
  weibo?: string;
  weibo_name?: string;
  weibo_desc?: string;
  xiaohongshu?: string;
  douyin?: string;
}

const DEFAULTS: Cfg = {
  about_worldview:
    "「在这里写下你们团体的世界观设定，可以是奇幻故事、日常设定，或者任何你们想传达的理念。」",
  about_intro:
    "XXX 是一支来自[你的城市]的地下偶像团体。成员们以[角色设定]的身份活跃于 Livehouse 和动漫展会。",
};

export default function AboutContent({
  siteName,
  initial,
}: {
  siteName: string;
  initial: Cfg;
}) {
  const ssr =
    typeof window !== "undefined" ? (window as any).__SSR_DATA__ : null;
  const [cfg, setCfg] = useState<Cfg>(() => ({
    ...DEFAULTS,
    ...(initial || {}),
    ...(ssr?.siteConfig || {}),
  }));

  useEffect(() => {
    if (ssr?.siteConfig) return; // 已有 SSR 数据
    let alive = true;
    fetch("/api/site")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d) setCfg({ ...DEFAULTS, ...d });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <div
        className="card p-8 mb-8"
        data-reveal
        style={{ ["--reveal-delay" as any]: "0ms" }}
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          ✦ 世界观
        </h2>
        <blockquote className="text-gray-600 dark:text-gray-400 leading-relaxed italic border-l-4 border-pink-300 pl-4">
          {cfg.about_worldview}
        </blockquote>
      </div>

      <div
        className="card p-8 mb-8"
        data-reveal
        style={{ ["--reveal-delay" as any]: "70ms" }}
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          ✦ {siteName}
        </h2>
        <p className="text-gray-600 leading-relaxed mb-4">{cfg.about_intro}</p>
      </div>

      <div
        className="card p-8 mb-8"
        data-reveal
        style={{ ["--reveal-delay" as any]: "140ms" }}
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          ✦ 支持我们
        </h2>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="rounded-3xl p-4 backdrop-blur-sm bg-white/30 dark:bg-white/[0.02] flex flex-col items-center">
            <p className="text-xs text-gray-400 mb-1">微店</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {cfg.weidian}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">官方周边</p>
          </div>
          <div className="rounded-3xl p-4 backdrop-blur-sm bg-white/30 dark:bg-white/[0.02] flex flex-col items-center">
            <p className="text-xs text-gray-400 mb-1">官方QQ</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {cfg.staff_qq}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">电切电聊</p>
          </div>
        </div>
      </div>

      <div
        className="card p-8 text-center"
        data-reveal
        style={{ ["--reveal-delay" as any]: "210ms" }}
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-6">
          ✦ 关注 {siteName}
        </h2>
        <SiteSocial variant="buttons" />
      </div>
    </>
  );
}
