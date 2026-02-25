import { useState, useRef, useEffect } from "react";
import { Home } from "lucide-react";

/**
 * PropertyImage — premium image component with skeleton loading + fallback.
 * Never shows a broken image icon. Shows:
 * 1. Skeleton shimmer while loading
 * 2. Actual image once loaded
 * 3. Branded fallback placeholder if image fails or is empty
 */

interface PropertyImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  aspectRatio?: string; // e.g. "4/3", "16/9"
}

export default function PropertyImage({
  src,
  alt,
  className = "",
  aspectRatio = "4/3",
}: PropertyImageProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    src ? "loading" : "error"
  );
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!src) {
      setStatus("error");
      return;
    }
    setStatus("loading");
  }, [src]);

  // Safety timeout: if image hasn't loaded after 5s, show error
  useEffect(() => {
    if (status !== "loading") return;
    const timer = setTimeout(() => {
      if (status === "loading") setStatus("error");
    }, 5000);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <div
      className={`relative overflow-hidden bg-gray-100 ${className}`}
      style={{ aspectRatio }}
    >
      {/* Skeleton shimmer — visible while loading */}
      {status === "loading" && (
        <div className="absolute inset-0 animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
        </div>
      )}

      {/* Branded fallback — visible on error or empty src */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="w-14 h-14 rounded-full bg-mk-navy/5 flex items-center justify-center mb-2">
            <Home size={24} className="text-mk-navy/30" />
          </div>
          <span className="text-xs text-gray-400 font-medium">
            صورة غير متوفرة
          </span>
        </div>
      )}

      {/* Actual image — hidden until loaded */}
      {src && (
        <img
          ref={imgRef}
          src={src}
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
            status === "loaded" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}
