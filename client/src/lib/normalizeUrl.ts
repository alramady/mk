/**
 * Normalize an uploaded file URL.
 * - Relative /uploads/... paths → use as-is
 * - Old absolute URLs with /uploads/ → strip domain, use relative path
 * - External URLs (Unsplash etc.) → return as-is
 * - data: URLs → return as-is
 */
export function normalizeUploadUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("/uploads/")) return url;
  if (url.includes("/uploads/")) return "/uploads/" + url.split("/uploads/").pop();
  if (url.startsWith("/site-assets/")) return url;
  if (url.includes("/site-assets/")) return "/site-assets/" + url.split("/site-assets/").pop();
  return url;
}
