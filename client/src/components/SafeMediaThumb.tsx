/**
 * SafeMediaThumb — A small, reliable image thumbnail component.
 *
 * FIX (Phase 1 P0): Removed opacity-0/opacity-100 state machine that caused
 * loaded R2 images to stay invisible. Now uses simple direct img with onError.
 *
 * Shows a placeholder icon on error. Works on iPhone Safari + desktop.
 */
import { useRef } from "react";
import { ImageIcon } from "lucide-react";
import { normalizeMediaUrl } from "@/lib/utils";

interface SafeMediaThumbProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  /** Extra classes for the outer wrapper (default: aspect-square) */
  wrapperClassName?: string;
  onClick?: () => void;
}

export function SafeMediaThumb({
  src,
  alt = "",
  className = "w-full h-full object-cover",
  wrapperClassName = "relative block rounded-lg overflow-hidden border bg-muted aspect-square",
  onClick,
}: SafeMediaThumbProps) {
  const normalizedUrl = normalizeMediaUrl(src);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // No src at all — show placeholder immediately
  if (!normalizedUrl) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${wrapperClassName} cursor-pointer hover:ring-2 hover:ring-[#3ECFC0] transition-all`}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted text-muted-foreground">
          <ImageIcon className="h-5 w-5 opacity-50" />
          <span className="text-[10px] mt-1 opacity-40">{alt || "\u2014"}</span>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${wrapperClassName} cursor-pointer hover:ring-2 hover:ring-[#3ECFC0] transition-all`}
    >
      {/* Direct img — visible immediately, no opacity tricks */}
      <img
        ref={imgRef}
        src={normalizedUrl}
        alt={alt}
        className={className}
        onLoad={() => {
          // Extra safety: if the image loads but is actually HTML (server returned SPA),
          // the naturalWidth will be 0 in some browsers.
          const img = imgRef.current;
          if (img && img.naturalWidth === 0 && img.naturalHeight === 0) {
            img.style.display = "none";
            const fallback = img.nextElementSibling as HTMLElement | null;
            if (fallback) fallback.style.display = "flex";
          }
        }}
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = "none";
          const fallback = target.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.display = "flex";
        }}
        loading="lazy"
      />
      {/* Error fallback (hidden by default) */}
      <div style={{ display: "none" }} className="absolute inset-0 flex-col items-center justify-center bg-muted text-muted-foreground">
        <ImageIcon className="h-5 w-5 opacity-50" />
        <span className="text-[10px] mt-1 opacity-40">{alt || "\u2014"}</span>
      </div>
    </button>
  );
}
