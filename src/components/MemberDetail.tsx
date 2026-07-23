import { useState, useEffect, useMemo, useCallback } from "react";
import ImageLightboxOverlay from "./ImageLightboxOverlay";
import Skeleton from "./Skeleton";

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
}

export default function MemberDetail({
  slug,
  initial,
}: {
  slug?: string;
  initial?: Member | null;
}) {
  const id = useMemo(() => {
    if (slug) return slug;
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("id");
      if (p) return p;
    }
    return "";
  }, [slug]);

  const [member, setMember] = useState<Member | null>(initial || null);
  const [loading, setLoading] = useState(!initial);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [activeColor, setActiveColor] = useState("");

  useEffect(() => {
    setActiveColor(
      typeof window !== "undefined"
        ? localStorage.getItem("fansite-accent") || ""
        : "",
    );
    const onTheme = (e: Event) =>
      setActiveColor((e as CustomEvent<{ color: string }>).detail?.color || "");
    window.addEventListener("fansite:theme", onTheme as EventListener);
    return () =>
      window.removeEventListener("fansite:theme", onTheme as EventListener);
  }, []);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    fetch("/api/members?id=" + encodeURIComponent(id))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && !d.error) setMember(d);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const gallery = member?.gallery || [];
  const lightboxImages = gallery.map((src) => ({
    src,
    alt: member?.name || "",
  }));
  const close = useCallback(() => setLightboxIdx(null), []);
  const prev = useCallback(
    () =>
      setLightboxIdx((i) =>
        i !== null ? (i - 1 + gallery.length) % gallery.length : null,
      ),
    [gallery.length],
  );
  const next = useCallback(
    () => setLightboxIdx((i) => (i !== null ? (i + 1) % gallery.length : null)),
    [gallery.length],
  );

  useEffect(() => {
    if (lightboxIdx === null) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [lightboxIdx, close, prev, next]);

  if (loading)
    return (
      <div
        className="flex flex-col md:flex-row gap-6 md:gap-10 items-center md:items-start"
        aria-hidden="true"
      >
        <Skeleton className="md:w-80 max-w-56 md:max-w-none aspect-[4/5] rounded-3xl" />
        <div className="flex-1 space-y-5 w-full">
          <Skeleton className="h-8 w-40 rounded-full" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </div>
    );
  if (!member)
    return <p className="text-center text-gray-400 py-16">未找到该成员</p>;

  const [month, day] = (member.birthday || "--").split("-");

  return (
    <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start content-enter">
      {/* 左：sticky 信息名片（桌面端跟随滚动，紧凑呈现头像+基本信息+微博） */}
      <div className="md:w-72 flex-shrink-0 w-full max-w-xs md:sticky md:top-24">
        <div className="frost-card p-5 space-y-4">
          <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-lg mx-auto max-w-[220px]">
            {member.image ? (
              <img
                src={member.image}
                alt={member.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl">
                {member.emoji}
              </div>
            )}
          </div>
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">{member.emoji}</span>
              <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
                {member.name}
              </h1>
            </div>
            <p className="text-sm text-gray-400">{member.name_jp}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            <span className="frost-card px-3 py-1 rounded-full text-gray-600">
              {month}月{day}日
            </span>
            <span className="frost-card px-3 py-1 rounded-full text-gray-600">
              {member.constellation}
            </span>
            <span
              data-member-color={member.id}
              data-color={member.color}
              className={
                "inline-flex items-center gap-1.5 frost-card px-3 py-1 rounded-full text-gray-600 cursor-pointer " +
                (activeColor &&
                activeColor.toLowerCase() === (member.color || "").toLowerCase()
                  ? "ring-2 ring-[var(--accent)]"
                  : "")
              }
              title={`切换${member.name}主题色`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: member.color }}
              />
              成员色
            </span>
          </div>
          {member.weibo && (
            <div className="text-center pt-3 border-t border-gray-100 dark:border-gray-800">
              <a
                href={member.weibo}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 text-sm text-pink-500 hover:text-pink-600 font-medium"
              >
                {member.weibo_name}
              </a>
              {member.weibo_desc && (
                <p className="text-xs text-gray-400 mt-1">
                  {member.weibo_desc}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 右：主内容流（简介 + 画廊），长内容自然展开，左侧 sticky 名片平衡视觉 */}
      <div className="flex-1 space-y-8 w-full min-w-0">
        {member.intro && (
          <div className="frost-card p-5 md:p-6">
            <h2 className="text-sm font-bold text-[var(--accent)] tracking-wider mb-3">
              ✦ 简介
            </h2>
            <div className="space-y-3">
              {member.intro
                .split("\n")
                .filter(Boolean)
                .map((line, i) => (
                  <p
                    key={i}
                    className="text-[15px] text-gray-700 dark:text-gray-300 leading-loose"
                  >
                    {line.trim()}
                  </p>
                ))}
            </div>
          </div>
        )}

        {gallery.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-bold text-[var(--accent)] tracking-wider">
                ✦ 更多照片
              </h2>
              <span className="text-xs text-gray-400">
                {gallery.length} 张
                {gallery.length > 9 ? "（显示前 9 张，点开看全部）" : ""}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              {gallery.slice(0, 9).map((img, i) => (
                <div
                  key={i}
                  className="aspect-[4/5] rounded-2xl md:rounded-3xl overflow-hidden glass block w-full cursor-pointer group"
                  onClick={() => setLightboxIdx(i)}
                >
                  <img
                    src={img}
                    alt={member.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {lightboxIdx !== null && (
        <ImageLightboxOverlay
          images={lightboxImages}
          currentIndex={lightboxIdx}
          onClose={close}
          onPrev={prev}
          onNext={next}
        />
      )}
    </div>
  );
}
