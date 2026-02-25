import { useState, useRef, useEffect } from "react";
import { Home, ImageOff } from "lucide-react";

/**
 * SafeImage — Premium image component with:
 *   1. Skeleton shimmer while loading
 *   2. Actual image once loaded
 *   3. Branded blur fallback if image fails (never shows broken icon)
 *   4. Optional photo count badge
 *   5. Optional hover carousel for multi-photo cards
 */

interface SafeImageProps {
  src?: string | null;
  photos?: { url: string }[];
  alt: string;
  className?: string;
  aspectRatio?: string;
  photoCount?: number;
  showBadge?: boolean;
  enableHoverCarousel?: boolean;
  onClick?: () => void;
}

export default function SafeImage({
  src,
  photos,
  alt,
  className = "",
  aspectRatio = "4/3",
  photoCount = 0,
  showBadge = true,
  enableHoverCarousel = true,
  onClick,
}: SafeImageProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    src ? "loading" : "error"
  );
  const [hoverIndex, setHoverIndex] = useState(0);
  const [hoverLoaded, setHoverLoaded] = useState<Set<number>>(new Set([0]));
  const containerRef = useRef<HTMLDivElement>(null);

  const allPhotos = photos && photos.length > 1 ? photos : null;
  const displayCount = photoCount || (allPhotos?.length ?? (src ? 1 : 0));
  const imgRef = useRef<HTMLImageElement>(null);
  const currentSrc = allPhotos && hoverIndex > 0 ? allPhotos[hoverIndex]?.url : src;

  useEffect(() => {
    if (!src) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    setHoverIndex(0);
  }, [src]);

  // Safety timeout: if image hasn't loaded after 5s, show error
  useEffect(() => {
    if (status !== "loading") return;
    const timer = setTimeout(() => {
      if (status === "loading") setStatus("error");
    }, 5000);
    return () => clearTimeout(timer);
  }, [status]);

  // Hover carousel: divide container into zones
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!enableHoverCarousel || !allPhotos || allPhotos.length <= 1) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const zone = Math.floor((x / rect.width) * Math.min(allPhotos.length, 5));
    const idx = Math.min(zone, allPhotos.length - 1);
    if (idx !== hoverIndex) {
      setHoverIndex(idx);
      if (!hoverLoaded.has(idx)) {
        // Preload the image
        const img = new Image();
        img.src = allPhotos[idx].url;
        img.onload = () => setHoverLoaded((prev) => new Set(prev).add(idx));
      }
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(0);
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-gray-100 group/img ${className}`}
      style={{ aspectRatio }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      {/* Skeleton shimmer */}
      {status === "loading" && (
        <div className="absolute inset-0 animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
        </div>
      )}

      {/* Branded fallback — blur + icon */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="w-16 h-16 rounded-full bg-mk-navy/5 flex items-center justify-center mb-2.5">
            <Home size={28} className="text-mk-navy/25" />
          </div>
          <div className="flex items-center gap-1.5 text-gray-400">
            <ImageOff size={12} />
            <span className="text-xs font-medium">صورة غير متوفرة</span>
          </div>
        </div>
      )}

      {/* Actual image */}
      {currentSrc && (
        <img
          ref={imgRef}
          key={currentSrc}
          src={currentSrc}
          alt={alt}
          loading="lazy"
          onLoad={() => {
            const img = imgRef.current;
            if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
              setStatus("loaded");
            } else {
              setStatus("error");
            }
          }}
          onError={() => setStatus("error")}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            status === "loaded" || hoverIndex > 0 ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* Photo count badge */}
      {showBadge && displayCount > 1 && (
        <div className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded-md text-xs font-medium flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          <span>+{displayCount}</span>
        </div>
      )}

      {/* Hover carousel indicators */}
      {enableHoverCarousel && allPhotos && allPhotos.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200">
          {allPhotos.slice(0, 5).map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-200 ${
                i === hoverIndex
                  ? "w-4 bg-white"
                  : "w-1.5 bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
