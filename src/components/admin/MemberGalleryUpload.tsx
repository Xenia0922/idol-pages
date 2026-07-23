import { useState, useEffect, useRef, useCallback } from "react";

interface Props {
  code: string;
  section: string;
  value: string[];
  onChange: (updater: (prev: string[]) => string[]) => void;
  label?: string;
}

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX = 15 * 1024 * 1024;

// 成员画廊（九宫格）多图上传：逐个上传 + 缩略图 + 拖动排序
export default function MemberGalleryUpload({
  code,
  section,
  value,
  onChange,
  label = "画廊图片",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // onChange 直接透传 updater 给父组件的函数式 setState，
  // 父组件用 updater(最新 state) 计算新值——零延迟、单一真相源，不再需要 ref 中间层。
  const update = useCallback(
    (updater: (prev: string[]) => string[]) => {
      onChange(updater);
    },
    [onChange],
  );

  const addFile = useCallback(
    async (file?: File | null) => {
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
        if (data.ok) {
          // 严格追加：绝不动已有元素；重复 URL 直接跳过（防止手滑重复传同一张）。
          update((prev) =>
            prev.includes(data.url) ? prev : [...prev, data.url],
          );
        } else setErr(data.error || "上传失败");
      } catch {
        setErr("上传失败，请重试");
      } finally {
        setBusy(false);
      }
    },
    [code, section, update],
  );

  // 文档级粘贴捕获（焦点不在输入框时）。用 ref 持有最新 addFile，避免反复绑定 / 解绑。
  const addFileRef = useRef(addFile);
  addFileRef.current = addFile;
  useEffect(() => {
    const onDocPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/"),
      );
      if (item) {
        e.preventDefault();
        addFileRef.current(item.getAsFile());
      }
    };
    document.addEventListener("paste", onDocPaste);
    return () => document.removeEventListener("paste", onDocPaste);
  }, []);

  // 删除按 URL 而非下标：无论列表顺序、并发上传如何变化，都精确删掉点的那张，绝不误删。
  const remove = useCallback(
    (url: string) => update((prev) => prev.filter((u) => u !== url)),
    [update],
  );

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFile(e.target.files?.[0]);
    e.target.value = ""; // 允许再次选择同一文件
  };

  const onDropAdd = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (busy) return;
    addFile(e.dataTransfer.files?.[0]);
  };

  // 缩略图上松手：如果拖进来的是「文件」→ 当作添加；否则是缩略图互拖 → 调整顺序。
  const onThumbDrop = (e: React.DragEvent, i: number) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      if (!busy) addFile(e.dataTransfer.files?.[0]);
      return;
    }
    handleReorder(i);
  };

  const handleReorder = (i: number) => {
    if (dragIdx === null || dragIdx === i) return;
    update((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(i, 0, moved);
      return next;
    });
    setDragIdx(null);
  };

  return (
    <div>
      <div
        className={
          "grid grid-cols-3 gap-2 " +
          (drag ? "rounded-xl ring-2 ring-[var(--accent)]/40" : "")
        }
      >
        {value.map((url, i) => (
          <div
            key={url}
            draggable
            onDragStart={(e) => {
              setDragIdx(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onThumbDrop(e, i)}
            onDragEnd={() => setDragIdx(null)}
            className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-white/10 cursor-grab active:cursor-grabbing"
          >
            <img
              src={url}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              draggable={false}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                remove(url);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onDragStart={(e) => e.stopPropagation()}
              aria-label="删除图片"
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity z-10"
            >
              ×
            </button>
          </div>
        ))}
        <div
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDropAdd}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!busy) inputRef.current?.click();
            }
          }}
          aria-label={`${label}：点击或拖拽图片上传，也可直接粘贴剪贴板图片`}
          className={
            "relative flex items-center justify-center aspect-square rounded-xl cursor-pointer border transition-colors " +
            (drag
              ? "border-[var(--accent)] bg-[var(--accent)]/5"
              : "border-dashed border-gray-300 dark:border-white/15 hover:border-[var(--accent)]")
          }
        >
          {busy ? (
            <span className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="text-gray-300 dark:text-gray-600 text-2xl">
              ＋
            </span>
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
      {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
      <p className="text-[10px] text-gray-400 mt-1">
        逐个上传，拖动缩略图可调整顺序；也可直接 Ctrl/⌘+V 粘贴剪贴板图片；JPG /
        PNG / WEBP / GIF，≤15MB
      </p>
    </div>
  );
}
