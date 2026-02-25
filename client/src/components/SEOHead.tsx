import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";

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
const SITE_NAME_EN = "Monthly Key";
const SITE_NAME_AR = "المفتاح الشهري";
const TAGLINE_EN = "Premium Monthly Rentals in Saudi Arabia";
const TAGLINE_AR = "منصة التأجير الشهري في السعودية";

export default function SEOHead({
  title,
  titleAr,
  description,
  descriptionAr,
  path = "",
  type = "website",
  noindex = false,
}: SEOHeadProps) {
  const { lang } = useI18n();

  useEffect(() => {
    const siteName = lang === "ar" ? SITE_NAME_AR : SITE_NAME_EN;
    const tagline = lang === "ar" ? TAGLINE_AR : TAGLINE_EN;

    let fullTitle: string;
    if (title || titleAr) {
      const pageTitle = lang === "ar" ? (titleAr || title) : (title || titleAr);
      fullTitle = `${pageTitle} - ${siteName}`;
    } else {
      fullTitle = `${siteName} | ${tagline}`;
    }

    const fullDesc =
      (lang === "ar" ? (descriptionAr || description) : (description || descriptionAr)) ||
      (lang === "ar"
        ? "المفتاح الشهري - المنصة الرائدة للتأجير الشهري في المملكة العربية السعودية"
        : "Monthly Key - The leading monthly rental platform in Saudi Arabia");

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

    // Update html lang and dir
    document.documentElement.lang = lang === "ar" ? "ar" : "en";
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

    // Open Graph
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", fullDesc);
    setMeta("property", "og:url", url);
    setMeta("property", "og:type", type);
    setMeta("property", "og:site_name", siteName);
    setMeta("property", "og:locale", lang === "ar" ? "ar_SA" : "en_US");

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
      const resetName = lang === "ar" ? SITE_NAME_AR : SITE_NAME_EN;
      const resetTag = lang === "ar" ? TAGLINE_AR : TAGLINE_EN;
      document.title = `${resetName} | ${resetTag}`;
    };
  }, [title, titleAr, description, descriptionAr, path, type, noindex, lang]);

  return null;
}
