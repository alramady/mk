import React, { useState, useCallback } from "react";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
}

/**
 * Optimized image component with:
 * - Native lazy loading (loading="lazy")
 * - Graceful fallback on error
 * - Fade-in animation on load
 * - Decoding="async" for non-blocking rendering
 */
export function LazyImage({ fallback, className, onError, onLoad, style, ...props }: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    setLoaded(true);
    onLoad?.(e);
  }, [onLoad]);

  const handleError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    setError(true);
    if (fallback && e.currentTarget.src !== fallback) {
      e.currentTarget.src = fallback;
    }
    onError?.(e);
  }, [fallback, onError]);

  return (
    <img
      {...props}
      className={className}
      loading="lazy"
      decoding="async"
      onLoad={handleLoad}
      onError={handleError}
      style={{
        ...style,
        opacity: loaded || error ? 1 : 0,
        transition: "opacity 0.3s ease-in-out",
      }}
    />
  );
}

export default LazyImage;
