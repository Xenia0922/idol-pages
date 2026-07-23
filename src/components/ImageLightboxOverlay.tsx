import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface LightboxImage {
  src: string;
  alt?: string;
}

interface ImageLightboxOverlayProps {
  images: LightboxImage[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

const ZOOM = 2;

export default function ImageLightboxOverlay({
  images,
  currentIndex,
  onClose,
  onPrev,
  onNext,
}: ImageLightboxOverlayProps) {
  const image = images[currentIndex];
  if (!image) return null;

  const [zoomed, setZoomed] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const movedRef = useRef(false);

  // 切换图片时重置缩放与平移
  useEffect(() => {
    setZoomed(false);
    setPan({ x: 0, y: 0 });
  }, [currentIndex]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y, moved: false };
    movedRef.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.moved = true;
      movedRef.current = true;
    }
    if (zoomed) {
      setPan({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy });
    }
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const onImgClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (movedRef.current) return; // 拖动过则不切换
    setZoomed(v => !v);
    setPan({ x: 0, y: 0 });
  };

  const imgStyle: React.CSSProperties = zoomed
    ? { transform: `translate(${pan.x}px, ${pan.y}px) scale(${ZOOM})`, transformOrigin: 'center center', cursor: 'grab' }
    : { cursor: 'zoom-in' };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/95" onClick={onClose} role="dialog" aria-modal="true" aria-label="图片灯箱">
      <button
        onClick={e => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-5 right-5 sm:top-6 sm:right-6 text-white/60 hover:text-white text-sm z-20 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
      >
        ✕ 关闭
      </button>
      <span className="absolute top-5 left-5 sm:top-6 sm:left-6 text-white/40 text-sm z-20 select-none">
        {currentIndex + 1} / {images.length}
      </span>

      <span className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/40 text-xs z-20 select-none">
        {zoomed ? '再次点击还原' : '点击放大 · 拖动查看'}
      </span>

      {images.length > 1 && (
        <>
          <button
            onClick={e => {
              e.stopPropagation();
              onPrev();
            }}
            className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-3xl z-20 p-4"
          >
            ‹
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-3xl z-20 p-4"
          >
            ›
          </button>
        </>
      )}

      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={image.src}
          alt={image.alt || ''}
          onClick={onImgClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className="max-w-full max-h-full object-contain select-none"
          style={imgStyle}
          draggable={false}
        />
      </div>
    </div>,
    document.body
  );
}
