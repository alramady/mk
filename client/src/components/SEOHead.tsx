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
  image?: string;
  imageAlt?: string;
  jsonLd?: Record<string, any> | Record<string, any>[];
}

const BASE_URL = "https://monthlykey.com";
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
  image,
  imageAlt,
  jsonLd,
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
      fullTitle = lang === "ar" 
        ? `المفتاح الشهري - Monthly Key`
        : `Monthly Key - المفتاح الشهري`;
    }

    const fullDesc =
      (lang === "ar" ? (descriptionAr || description) : (description || descriptionAr)) ||
      (lang === "ar"
        ? "المفتاح الشهري - المنصة الرائدة للتأجير الشهري في المملكة العربية السعودية"
        : "Monthly Key - The leading monthly rental platform in Saudi Arabia");

    const url = `${BASE_URL}${path}`;
    const ogImage = image || `${BASE_URL}/api/og/homepage.png`;
    const ogImageAlt = imageAlt || (lang === "ar" ? "المفتاح الشهري" : "Monthly Key");

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

    // Helper to set/create link tag
    const setLink = (rel: string, extraAttr?: string, extraVal?: string) => {
      const selector = extraAttr
        ? `link[rel="${rel}"][${extraAttr}="${extraVal}"]`
        : `link[rel="${rel}"]`;
      return (href: string) => {
        let el = document.querySelector(selector) as HTMLLinkElement | null;
        if (!el) {
          el = document.createElement("link");
          el.setAttribute("rel", rel);
          if (extraAttr && extraVal) el.setAttribute(extraAttr, extraVal);
          document.head.appendChild(el);
        }
        el.setAttribute("href", href);
      };
    };

    // Standard meta
    setMeta("name", "description", fullDesc);
    if (noindex) {
      setMeta("name", "robots", "noindex, nofollow");
    } else {
      setMeta("name", "robots", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
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
    setMeta("property", "og:image", ogImage);
    setMeta("property", "og:image:width", "1200");
    setMeta("property", "og:image:height", "630");
    setMeta("property", "og:image:alt", ogImageAlt);

    // Twitter
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", fullDesc);
    setMeta("name", "twitter:url", url);
    setMeta("name", "twitter:image", ogImage);
    setMeta("name", "twitter:image:alt", ogImageAlt);

    // Canonical
    setLink("canonical")(url);

    // Hreflang
    setLink("alternate", "hreflang", "ar")(url);
    setLink("alternate", "hreflang", "en")(url);
    setLink("alternate", "hreflang", "x-default")(url);

    // JSON-LD structured data
    const existingJsonLd = document.querySelectorAll('script[data-seo-head="true"]');
    existingJsonLd.forEach((el) => el.remove());

    if (jsonLd) {
      const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      items.forEach((item) => {
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute("data-seo-head", "true");
        script.textContent = JSON.stringify(item);
        document.head.appendChild(script);
      });
    }

    return () => {
      // Reset title on unmount
      const resetName = lang === "ar" ? SITE_NAME_AR : SITE_NAME_EN;
      const resetTag = lang === "ar" ? TAGLINE_AR : TAGLINE_EN;
      document.title = `${resetName} | ${resetTag}`;
      // Clean up injected JSON-LD
      const injected = document.querySelectorAll('script[data-seo-head="true"]');
      injected.forEach((el) => el.remove());
    };
  }, [title, titleAr, description, descriptionAr, path, type, noindex, image, imageAlt, jsonLd, lang]);

  return null;
}
