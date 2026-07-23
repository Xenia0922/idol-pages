import { useState, useRef, useEffect } from 'react';

/**
 * Emoji 选择器 — 偶像应援站风格，偏可爱/应援/闪光系。
 * 分类 tab + 网格，frost-card 风格，弹出动画统一。
 */

interface EmojiCategory {
  id: string;
  icon: string;
  label: string;
  emojis: string[];
}

const CATEGORIES: EmojiCategory[] = [
  {
    id: 'face',
    icon: '🥰',
    label: '表情',
    emojis: ['🥰', '😍', '🥺', '😭', '😅', '😊', '😘', '🤣', '😂', '😇', '🤩', '🥳', '😎', '🤔', '😱', '😤', '🥵', '🥶', '😋', '😜', '🤪', '🤗', '🤭', '🙈', '🙉', '🙊', '😴', '🤤', '🤒', '🤧', '🥲', '☺️', '🙂', '🙃', '😉', '😌', '😔', '😖', '🥹', '😩'],
  },
  {
    id: 'heart',
    icon: '❤️',
    label: '爱心',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌'],
  },
  {
    id: 'sparkle',
    icon: '✨',
    label: '闪光',
    emojis: ['✨', '🌟', '💫', '⚡', '🔥', '💥', '☀️', '🌈', '☁️', '⭐', '🌙', '☄️', '🌠', '❄️', '☃️', '🌸', '🌺', '🌻', '🌼', '🌷', '🌹', '🥀', '💐', '🍁', '🍀', '🌿', '💎', '👑', '🦋', '🎈', '🎉', '🎊', '🎁', '🎀', '🪄', '💫'],
  },
  {
    id: 'support',
    icon: '👑',
    label: '应援',
    emojis: ['👑', '💖', '💗', '💞', '💓', '💕', '🎤', '🎵', '🎶', '🎸', '🎹', '🥁', '🎬', '📸', '🎥', '💃', '🕺', '👗', '💄', '💋', '💅', '🎂', '🍰', '🧁', '🍭', '🍬', '🍫', '🍪', '🎁', '🏆', '🥇', '💎', '🪩', '🎟️', '🎫'],
  },
  {
    id: 'gesture',
    icon: '👍',
    label: '手势',
    emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🖐️', '🖖', '👋', '🤝', '🙏', '💪', '🙌', '👏', '🫶', '🫰', '🤲'],
  },
  {
    id: 'symbol',
    icon: '✅',
    label: '符号',
    emojis: ['✅', '❌', '❓', '❗', '‼️', '⁉️', '💯', '🔔', '🔕', '🎵', '〽️', '✳️', '✴️', '❇️', '©️', '®️', '™️', '#️⃣', '*️⃣', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '🔟', '➡️', '⬅️', '⬆️', '⬇️', '☑️', '✔️'],
  },
];

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
  onClose?: () => void;
}

export default function EmojiPicker({ onPick, onClose }: EmojiPickerProps) {
  const [activeCat, setActiveCat] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    }
    // 延迟绑定，避免触发弹出时的同一次 click 关闭
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  const current = CATEGORIES[activeCat];

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full mb-2 left-0 z-50 w-[300px] max-w-[calc(100vw-2rem)] frost-card p-3 shadow-lg emoji-picker-enter"
      role="dialog"
      aria-label="选择 emoji"
    >
      {/* 分类 tab */}
      <div className="flex gap-1 mb-2 pb-2 border-b border-gray-100 dark:border-white/10 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat.id}
            onClick={() => setActiveCat(i)}
            className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all ${
              activeCat === i
                ? 'bg-[var(--accent-soft)] scale-110'
                : 'hover:bg-gray-100 dark:hover:bg-white/5 opacity-60 hover:opacity-100'
            }`}
            aria-label={cat.label}
            aria-pressed={activeCat === i}
            title={cat.label}
          >
            {cat.icon}
          </button>
        ))}
      </div>

      {/* emoji 网格 */}
      <div className="grid grid-cols-8 gap-0.5 max-h-[180px] overflow-y-auto scrollbar-thin">
        {current.emojis.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            onClick={() => onPick(emoji)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xl hover:bg-[var(--accent-soft)] hover:scale-125 active:scale-95 transition-all duration-150"
            aria-label={`插入 ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
