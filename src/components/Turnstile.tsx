import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: any;
  }
}

// Turnstile 脚本只加载一次（多组件共享）
let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => resolve(); // 加载失败也 resolve，widget 不渲染（后端 fail-open 兜底）
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Cloudflare Turnstile 人机验证 widget。
 * siteKey 从 middleware 注入的 __SSR_DATA__.turnstileSiteKey 读取（env.TURNSTILE_SITE_KEY）。
 * 未配置时 widget 不渲染，后端 fail-open 兜底。
 * data-action="turnstile-spin-v2" + render option action 用于 analytics 归因。
 *
 * 注：用 explicit render（turnstile.render）而非 declarative cf-turnstile div，
 * 因为 React 重渲染会导致 declarative widget 丢失。action 参数与 data-action 等价。
 */
export default function Turnstile({
  onToken,
  onReady,
}: {
  onToken: (t: string) => void;
  onReady?: () => void;
}) {
  const ssr =
    typeof window !== "undefined" ? (window as any).__SSR_DATA__ : null;
  const siteKey: string | null = ssr?.turnstileSiteKey || null;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  // onToken/onReady 用 ref 持有，避免 callback 变化导致 widget 重建
  const cbRef = useRef(onToken);
  cbRef.current = onToken;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    if (!siteKey) return; // 未配置 site key，widget 不渲染
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !window.turnstile || !containerRef.current) return;
      try {
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: "turnstile-spin-v2", // analytics 归因（等价于 declarative data-action）
          callback: (token: string) => cbRef.current(token),
          "expired-callback": () => cbRef.current(""),
          "error-callback": () => cbRef.current(""),
        });
        readyRef.current?.(); // widget 渲染成功，通知父组件可要求 token
      } catch {
        /* 渲染失败静默，后端 fail-open 兜底 */
      }
    });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {}
      }
    };
  }, [siteKey]);

  if (!siteKey) return null; // 未配置时不渲染
  return (
    <div
      ref={containerRef}
      className="flex justify-center"
      data-action="turnstile-spin-v2"
    />
  );
}
