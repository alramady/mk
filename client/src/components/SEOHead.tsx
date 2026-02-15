import { useEffect } from "react";

interface SEOHeadProps {
  title?: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  path?: string;
  type?: string;
  noindex?: boolean;
}

const BASE_URL = "https://www.monthlykey.com";
const SITE_NAME = "المفتاح الشهري";

export default function SEOHead({
  title,
  titleAr,
  description,
  descriptionAr,
  path = "",
  type = "website",
  noindex = false,
}: SEOHeadProps) {
  useEffect(() => {
    const fullTitle = title
      ? `${title}${titleAr ? ` | ${titleAr}` : ""} - ${SITE_NAME}`
      : `${SITE_NAME} | إيجار شهري - منصة التأجير الشهري في السعودية`;

    const fullDesc =
      description ||
      descriptionAr ||
      "المفتاح الشهري - المنصة الرائدة للتأجير الشهري في المملكة العربية السعودية";

    const url = `${BASE_URL}${path}`;

    // Update title
    document.title = fullTitle;

    // Helper to set/create meta tag
    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    // Standard meta
    setMeta("name", "description", fullDesc);
    if (noindex) {
      setMeta("name", "robots", "noindex, nofollow");
    }

    // Open Graph
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", fullDesc);
    setMeta("property", "og:url", url);
    setMeta("property", "og:type", type);

    // Twitter
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", fullDesc);
    setMeta("name", "twitter:url", url);

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", url);

    return () => {
      // Reset title on unmount
      document.title = `${SITE_NAME} - منصة التأجير الشهري في السعودية`;
    };
  }, [title, titleAr, description, descriptionAr, path, type, noindex]);

  return null;
}
