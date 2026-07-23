import { useRef, useState } from "react";

interface Props {
  code: string;
  section: string;
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

const INPUT =
  "w-full px-3 py-2 rounded-xl text-sm bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 outline-none focus:border-[var(--accent)] transition-colors";

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX = 15 * 1024 * 1024;

// 后台图片上传控件：点击/拖拽/粘贴上传到 R2，或粘贴已有图片链接
export default function ImageUpload({
  code,
  section,
  value,
  onChange,
  label = "图片",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState("");

  const upload = async (file?: File | null) => {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) {
      setErr("仅支持 JPG / PNG / WEBP / GIF");
      return;
    }
    if (file.size > MAX) {
      setErr("图片过大，请控制在 15MB 以内");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("section", section);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "x-admin-code": code },
        body: fd,
      });
      const data = await res.json();
      if (data.ok) onChange(data.url);
      else setErr(data.error || "上传失败");
    } catch {
      setErr("上传失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    upload(e.target.files?.[0]);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    upload(e.dataTransfer.files?.[0]);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) =>
      i.type.startsWith("image/"),
    );
    if (item) {
      e.preventDefault();
      upload(item.getAsFile());
    }
  };

  const clickZone = () => {
    if (!busy) inputRef.current?.click();
  };

  return (
    <div onPaste={onPaste}>
      <div
        onClick={clickZone}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            clickZone();
          }
        }}
        aria-label={`${label}：点击或拖拽图片上传`}
        className={
          "group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-colors " +
          (drag
            ? "border-[var(--accent)] bg-[var(--accent)]/5"
            : "border-dashed border-gray-300 dark:border-white/15 hover:border-[var(--accent)]")
        }
      >
        <div className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-white/10">
          {value ? (
            <img
              src={value}
              alt=""
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600 text-2xl">
              ＋
            </div>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-black/40">
              <span className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {value
              ? "点击或拖拽以更换图片"
              : "点击选择、拖拽图片到此，或直接 Ctrl/⌘+V 粘贴"}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            JPG / PNG / WEBP / GIF，≤15MB
          </p>
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="text-xs text-red-400 hover:text-red-600 mt-1.5"
            >
              清除
            </button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
      />

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="或粘贴图片链接（/images/... 或 http(s)://）"
        className={INPUT + " mt-2"}
      />
      {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
    </div>
  );
}
