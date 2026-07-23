import { useState, useEffect, useRef } from "react";
import AdminMembers from "./admin/AdminMembers";
import AdminEvents from "./admin/AdminEvents";
import AdminTokuten from "./admin/AdminTokuten";
import AdminSite from "./admin/AdminSite";
import AdminMessages from "./admin/AdminMessages";
import AdminGallery from "./admin/AdminGallery";
import AdminGalleryEdit from "./admin/AdminGalleryEdit";
import AdminRecruits from "./admin/AdminRecruits";
import AdminModeration from "./admin/AdminModeration";
import ErrorBoundary from "./ErrorBoundary";

// 登录失败次数限制：30 分钟内最多 5 次，超出锁定至窗口结束
const ATT_KEY = "fansite-admin-attempts";
const ATT_MAX = 5;
const ATT_WINDOW = 30 * 60 * 1000;

function getAttempts() {
  try {
    const a = JSON.parse(localStorage.getItem(ATT_KEY) || "null");
    if (a && typeof a.count === "number" && typeof a.firstTs === "number") {
      if (Date.now() - a.firstTs > ATT_WINDOW) return { count: 0, firstTs: 0 }; // 窗口已过，重置
      return a;
    }
  } catch (e) {}
  return { count: 0, firstTs: 0 };
}
function recordAttempt() {
  const a = getAttempts();
  if (a.count === 0) a.firstTs = Date.now();
  a.count += 1;
  try {
    localStorage.setItem(ATT_KEY, JSON.stringify(a));
  } catch (e) {}
  return a;
}
function clearAttempts() {
  try {
    localStorage.removeItem(ATT_KEY);
  } catch (e) {}
}
function lockReleaseText() {
  const a = getAttempts();
  if (!a.firstTs) return "";
  const t = new Date(a.firstTs + ATT_WINDOW);
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  return hh + ":" + mm;
}

export const INPUT_CLS =
  "w-full px-3 py-2 rounded-xl text-sm bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-[var(--accent)] transition-colors";

export default function AdminPanel() {
  const [code, setCode] = useState(() => {
    if (typeof window !== "undefined")
      return localStorage.getItem("fansite-admin") || "";
    return "";
  });
  const [authed, setAuthed] = useState(false);
  const [err, setErr] = useState(() =>
    getAttempts().count >= ATT_MAX
      ? `尝试次数过多，请于 ${lockReleaseText()} 后再试`
      : "",
  );
  const [checking, setChecking] = useState(false);
  const [tab, setTab] = useState<
    | "members"
    | "events"
    | "photos"
    | "messages"
    | "moderation"
    | "tokuten"
    | "site"
    | "recruits"
  >("members");

  // 挂载时校验已存储的暗号：仅服务端 200 才放行，否则清空并停在登录态
  const inited = useRef(false);
  useEffect(() => {
    if (inited.current) return;
    inited.current = true;
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem("fansite-admin") || ""
        : "";
    if (!stored) return;
    (async () => {
      try {
        const res = await fetch("/api/recruits?all=1", {
          headers: { "x-admin-code": stored },
        });
        if (res.ok) {
          setCode(stored);
          setAuthed(true);
          clearAttempts();
        } else if (res.status === 403) {
          localStorage.removeItem("fansite-admin");
          setCode("");
          setAuthed(false);
        } else {
          // 网络/5xx：不放心，停在登录态（保留存储，登录时可重试）
          setAuthed(false);
        }
      } catch (e) {
        setAuthed(false);
      }
    })();
  }, []);

  // 登录：先用服务端校验暗号，正确才存储并放行；错误累计尝试次数
  const login = async () => {
    if (getAttempts().count >= ATT_MAX) {
      setErr(`尝试次数过多，请于 ${lockReleaseText()} 后再试`);
      return;
    }
    const c = code.trim();
    if (!c) {
      setErr("请输入管理暗号");
      return;
    }
    setErr("");
    setChecking(true);
    try {
      const res = await fetch("/api/recruits?all=1", {
        headers: { "x-admin-code": c },
      });
      if (res.ok) {
        localStorage.setItem("fansite-admin", c);
        clearAttempts();
        setErr("");
        setAuthed(true);
      } else if (res.status === 403) {
        const a = recordAttempt();
        if (a.count >= ATT_MAX)
          setErr(`尝试次数过多，请于 ${lockReleaseText()} 后再试`);
        else setErr(`暗号错误，还剩 ${ATT_MAX - a.count} 次机会`);
      } else {
        setErr("验证失败，请稍后重试");
      }
    } catch (e) {
      setErr("验证失败，请稍后重试");
    } finally {
      setChecking(false);
    }
  };

  // 退出登录：清掉本地存储的暗号并回到登录态（服务端下次仍会校验）
  const logout = () => {
    try {
      localStorage.removeItem("fansite-admin");
    } catch (e) {}
    setCode("");
    setAuthed(false);
  };

  if (!authed) {
    const effLocked = getAttempts().count >= ATT_MAX;
    const lockMsg = `尝试次数过多，请于 ${lockReleaseText()} 后再试`;
    return (
      <div className="frost-card p-8 text-center max-w-sm mx-auto">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          管理员登录
        </h2>
        <input
          type="password"
          value={code}
          disabled={effLocked || checking}
          onChange={(e) => setCode(e.target.value)}
          placeholder="管理员暗号"
          aria-invalid={!!err}
          className="w-full px-4 py-2 rounded-full text-sm text-center bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-[var(--accent)] transition-colors mb-2 disabled:opacity-50"
          onKeyDown={(e) => e.key === "Enter" && !effLocked && login()}
        />
        <p
          className={`text-xs mb-3 min-h-[1rem] ${effLocked || err ? "text-red-500 dark:text-red-400" : "text-transparent"}`}
        >
          {effLocked ? lockMsg : err || " "}
        </p>
        <button
          onClick={login}
          disabled={effLocked || checking}
          className="btn-pink text-xs !px-4 !py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {checking ? "验证中…" : effLocked ? "已锁定" : "进入"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={logout}
          className="text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded-full transition-colors"
        >
          退出登录
        </button>
      </div>
      <div className="flex gap-2 mb-6 justify-center flex-wrap">
        <button
          onClick={() => setTab("members")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${tab === "members" ? "btn-pink" : "btn-outline"}`}
        >
          成员
        </button>
        <button
          onClick={() => setTab("events")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${tab === "events" ? "btn-pink" : "btn-outline"}`}
        >
          日程
        </button>
        <button
          onClick={() => setTab("photos")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${tab === "photos" ? "btn-pink" : "btn-outline"}`}
        >
          画廊
        </button>
        <button
          onClick={() => setTab("messages")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${tab === "messages" ? "btn-pink" : "btn-outline"}`}
        >
          广场
        </button>
        <button
          onClick={() => setTab("moderation")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${tab === "moderation" ? "btn-pink" : "btn-outline"}`}
        >
          审核
        </button>
        <button
          onClick={() => setTab("tokuten")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${tab === "tokuten" ? "btn-pink" : "btn-outline"}`}
        >
          特典
        </button>
        <button
          onClick={() => setTab("site")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${tab === "site" ? "btn-pink" : "btn-outline"}`}
        >
          关于
        </button>
        <button
          onClick={() => setTab("recruits")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${tab === "recruits" ? "btn-pink" : "btn-outline"}`}
        >
          广告
        </button>
      </div>

      <ErrorBoundary>
        {tab === "members" && <AdminMembers code={code} />}
        {tab === "events" && <AdminEvents code={code} />}
        {tab === "photos" && <AdminGalleryEdit code={code} />}
        {tab === "messages" && (
          <div className="space-y-8">
            <AdminMessages code={code} />
            <AdminGallery code={code} />
          </div>
        )}
        {tab === "moderation" && <AdminModeration code={code} />}
        {tab === "tokuten" && <AdminTokuten code={code} />}
        {tab === "site" && <AdminSite code={code} />}
        {tab === "recruits" && <AdminRecruits code={code} />}
      </ErrorBoundary>
    </div>
  );
}
