import { useCallback, useEffect, useState } from "react";
import ImageLightboxOverlay, {
  type LightboxImage,
} from "./ImageLightboxOverlay";

interface StaticImageLightboxProps {
  images: LightboxImage[];
  mode: "grid" | "single";
  gridClassName?: string;
  itemClassName?: string;
  imageClassName?: string;
}

export default function StaticImageLightbox({
  images,
  mode,
  gridClassName = "",
  itemClassName = "",
  imageClassName = "",
}: StaticImageLightboxProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const close = useCallback(() => setLightboxIdx(null), []);
  const prev = useCallback(
    () =>
      setLightboxIdx((i) =>
        i !== null ? (i - 1 + images.length) % images.length : null,
      ),
    [images.length],
  );
  const next = useCallback(
    () => setLightboxIdx((i) => (i !== null ? (i + 1) % images.length : null)),
    [images.length],
  );

  useEffect(() => {
    if (lightboxIdx === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIdx, close, prev, next]);

  if (images.length === 0) return null;

  const imageNodes = images.map((image, i) => (
    <button
      key={`${image.src}-${i}`}
      type="button"
      className={`${itemClassName} cursor-pointer group border-0 p-0`}
      onClick={() => setLightboxIdx(i)}
    >
      <img
        src={image.src}
        alt={image.alt || ""}
        className={imageClassName}
        loading="lazy"
      />
    </button>
  ));

  return (
    <>
      {mode === "grid" ? (
        <div className={gridClassName}>{imageNodes}</div>
      ) : (
        imageNodes[0]
      )}

      {lightboxIdx !== null && (
        <ImageLightboxOverlay
          images={images}
          currentIndex={lightboxIdx}
          onClose={close}
          onPrev={prev}
          onNext={next}
        />
      )}
    </>
  );
}
