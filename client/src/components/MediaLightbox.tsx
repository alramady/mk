import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, Play, ImageIcon } from "lucide-react";

interface MediaItem {
  url: string;
  type: "image" | "video";
}

interface MediaLightboxProps {
  items: MediaItem[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

export function MediaLightbox({ items, initialIndex = 0, open, onClose }: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setZoom(1);
    }
  }, [open, initialIndex]);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % items.length);
    setZoom(1);
  }, [items.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + items.length) % items.length);
    setZoom(1);
  }, [items.length]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 3));
      if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 0.5));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, goNext, goPrev, onClose]);

  if (!open || items.length === 0) return null;

  const current = items[currentIndex];
  const isVideo = current.type === "video";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10">
        <span dir="ltr" className="text-white/70 text-sm font-medium">
          {currentIndex + 1} / {items.length}
        </span>
        <div className="flex items-center gap-2">
          {!isVideo && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(z + 0.25, 3)); }}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="تكبير / Zoom In"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.max(z - 0.25, 0.5)); }}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="تصغير / Zoom Out"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
            </>
          )}
          <a
            href={current.url}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="تحميل / Download"
          >
            <Download className="w-5 h-5" />
          </a>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="إغلاق / Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation arrows */}
      {items.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-110"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-110"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Content */}
      <div
        className="relative z-[1] max-w-[90vw] max-h-[85vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          <video
            src={current.url}
            controls
            autoPlay
            className="max-w-[90vw] max-h-[85vh] rounded-lg shadow-2xl"
          />
        ) : (
          <img
            src={current.url}
            alt={`Attachment ${currentIndex + 1}`}
            className="max-h-[85vh] rounded-lg shadow-2xl transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
            draggable={false}
            onError={(e) => { const el = e.currentTarget; el.style.display = 'none'; const fb = el.parentElement?.querySelector('.lb-fallback') as HTMLElement; if (fb) fb.style.display = 'flex'; }}
          />
        )}
        <div className="lb-fallback hidden items-center justify-center text-white/60" style={{ display: 'none' }}>
          <div className="text-center">
            <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Image unavailable</p>
          </div>
        </div>
      </div>

      {/* Thumbnail strip */}
      {items.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 p-2 rounded-xl bg-black/50 backdrop-blur-sm">
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); setZoom(1); }}
              className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                idx === currentIndex ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {item.type === "video" ? (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <Play className="w-5 h-5 text-white" />
                </div>
              ) : (
                <img src={item.url} alt="" className="w-full h-full object-cover" onError={(e) => { const el = e.currentTarget; el.style.opacity = '0'; }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Helper: detect media type from URL */
export function getMediaType(url: string): "image" | "video" {
  const videoExts = [".mp4", ".webm", ".mov", ".avi", ".mkv"];
  const lower = url.toLowerCase();
  return videoExts.some((ext) => lower.includes(ext)) ? "video" : "image";
}

/** Helper: convert URL array to MediaItem array */
export function urlsToMediaItems(urls: string[]): MediaItem[] {
  return urls.map((url) => ({ url, type: getMediaType(url) }));
}
