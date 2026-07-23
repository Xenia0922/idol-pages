import { useState, useEffect } from "react";
import Skeleton from "./Skeleton";
import SkeletonSwap from "./SkeletonSwap";

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
}

export default function HomeMembers({ initial }: { initial: Member[] }) {
  const ssr =
    typeof window !== "undefined" ? (window as any).__SSR_DATA__ : null;
  // 骨架优先：初始空 + loading，useEffect 按 SSR > 种子 > fetch 填充
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeColor, setActiveColor] = useState("");

  useEffect(() => {
    if (ssr?.members && ssr.members.length) {
      setMembers(ssr.members);
      setLoading(false);
      return;
    }
    if (initial && initial.length) {
      setMembers(initial);
      setLoading(false);
      return;
    }
    let alive = true;
    fetch("/api/members")
      .then((r) => r.json())
      .then((d) => {
        if (alive && Array.isArray(d) && d.length) setMembers(d);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

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

  const isActive = (c?: string) =>
    !!c && !!activeColor && c.toLowerCase() === activeColor.toLowerCase();

  const active = members.filter((m) => m.status !== "graduated");

  return (
    <SkeletonSwap
      loading={loading}
      skeleton={
        <div className="grid grid-cols-3 gap-4 sm:gap-6" aria-hidden="true">
          {Array.from({ length: initial?.length || 3 }).map((_, i) => (
            <div key={i} className="text-center">
              <Skeleton className="aspect-[4/5] rounded-3xl mb-3" />
              <Skeleton className="h-4 w-16 mx-auto rounded-full mb-2" />
              <Skeleton className="h-3 w-12 mx-auto rounded-full mb-2" />
              <Skeleton className="h-3 w-20 mx-auto rounded-full" />
            </div>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-4 sm:gap-6">
        {active.map((m, i) => (
          <a
            key={m.id}
            href={`/members/detail?id=${m.id}`}
            className="group block text-center transition-transform duration-300 group-hover:-translate-y-1"
          >
            <div className="aspect-[4/5] rounded-3xl overflow-hidden mb-3 glass shadow-md group-hover:shadow-lg transition-shadow">
              {m.image ? (
                <img
                  src={m.image}
                  alt={m.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-5xl">
                  {m.emoji}
                </div>
              )}
            </div>
            <span className="text-xl">{m.emoji}</span>
            <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">
              {m.name}
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {m.name_jp}
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <span
                data-member-color={m.id}
                data-color={m.color}
                className={
                  "inline-block w-2.5 h-2.5 rounded-full " +
                  (isActive(m.color)
                    ? "ring-2 ring-offset-1 dark:ring-offset-gray-900 ring-[var(--accent)]"
                    : "")
                }
                style={{ background: m.color }}
                title={`切换${m.name}主题色`}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {m.birthday} · {m.constellation}
              </span>
            </div>
          </a>
        ))}
      </div>
    </SkeletonSwap>
  );
}
