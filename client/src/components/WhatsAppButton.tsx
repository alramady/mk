import { useI18n } from "@/lib/i18n";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";

/**
 * WhatsApp floating action button — fully backend-controlled.
 *
 * Feature flag:  whatsapp.enabled  ("true" / "false")
 * Route flags:   whatsapp.showOnHome, whatsapp.showOnSearch, whatsapp.showOnPropertyDetail
 * Hidden on:     /login, /register, /verify*, /otp*, /auth*, /admin*, /owner*
 *
 * Context-aware message templates:
 *   home    → whatsapp.homeMessageTemplateAr / En
 *   search  → whatsapp.searchMessageTemplateAr / En
 *   property_detail → whatsapp.propertyMessageTemplateAr / En  (with placeholders)
 *   fallback → whatsapp.defaultMessageAr / En
 */

// ── Types ────────────────────────────────────────────────────────────
export type WhatsAppContext = "home" | "search" | "property_detail" | "default";

export interface WhatsAppFABProps {
  /** Override the auto-detected context */
  context?: WhatsAppContext;
  /** Property name — used when context is "property_detail" */
  propertyName?: string;
  /** City name — used when context is "property_detail" */
  city?: string;
  /** Property ID — used when context is "property_detail" */
  propertyId?: string | number;
  /** Full property URL — used when context is "property_detail" */
  propertyUrl?: string;
}

// ── Route deny-list ──────────────────────────────────────────────────
const HIDDEN_PREFIXES = [
  "/login",
  "/register",
  "/verify",
  "/otp",
  "/auth",
  "/admin",
  "/owner",
];

// ── Route → setting key + context mapping ────────────────────────────
interface RouteInfo {
  settingKey: string;
  context: WhatsAppContext;
}

function getRouteInfo(path: string): RouteInfo | null {
  if (path === "/" || path === "") return { settingKey: "whatsapp.showOnHome", context: "home" };
  if (path.startsWith("/search") || path.startsWith("/properties")) return { settingKey: "whatsapp.showOnSearch", context: "search" };
  if (path.startsWith("/property/")) return { settingKey: "whatsapp.showOnPropertyDetail", context: "property_detail" };
  return null; // unknown route → hide by default
}

// ── URL builder ──────────────────────────────────────────────────────
/**
 * Build a WhatsApp click-to-chat URL using the official api.whatsapp.com format.
 * Phone is converted to digits-only (strips + and spaces).
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const digitsOnly = phone.replace(/[^0-9]/g, "");
  return `https://api.whatsapp.com/send/?phone=${digitsOnly}&text=${encodeURIComponent(message)}`;
}

// ── Template filler ──────────────────────────────────────────────────
/** Fill property placeholders in a message template */
export function buildPropertyMessage(
  template: string,
  props: { title: string; id: string | number; city: string; url: string }
): string {
  return template
    .replace(/\{\{property_title\}\}/g, props.title)
    .replace(/\{\{property_id\}\}/g, String(props.id))
    .replace(/\{\{city\}\}/g, props.city)
    .replace(/\{\{url\}\}/g, props.url);
}

// ── Component ────────────────────────────────────────────────────────
export default function WhatsAppButton({
  context: contextOverride,
  propertyName,
  city,
  propertyId,
  propertyUrl,
}: WhatsAppFABProps = {}) {
  const { lang } = useI18n();
  const { get: s } = useSiteSettings();
  const [location] = useLocation();
  const [visible, setVisible] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [pulse, setPulse] = useState(true);

  // ── Feature flag ───────────────────────────────────────────────────
  const isEnabled = s("whatsapp.enabled", "false") === "true";
  const phone = s("whatsapp.number", "");

  // ── Route-based visibility ─────────────────────────────────────────
  const isHiddenRoute = HIDDEN_PREFIXES.some(
    (p) => location === p || location.startsWith(p + "/") || location.startsWith(p)
  );
  const routeInfo = getRouteInfo(location);
  const isRouteAllowed = routeInfo ? s(routeInfo.settingKey, "true") === "true" : false;

  // ── Resolve context ────────────────────────────────────────────────
  const resolvedContext: WhatsAppContext = contextOverride || routeInfo?.context || "default";

  // ── Build message based on context ─────────────────────────────────
  const message = useMemo(() => {
    const suffix = lang === "ar" ? "Ar" : "En";
    const fallback =
      lang === "ar"
        ? s("whatsapp.defaultMessageAr", s("whatsapp.message", "مرحباً، أحتاج مساعدة بخصوص الإيجار الشهري"))
        : s("whatsapp.defaultMessageEn", "Hello, I need help regarding monthly rental");

    switch (resolvedContext) {
      case "home": {
        const tmpl = s(`whatsapp.homeMessageTemplate${suffix}`, "");
        return tmpl || fallback;
      }
      case "search": {
        const tmpl = s(`whatsapp.searchMessageTemplate${suffix}`, "");
        return tmpl || fallback;
      }
      case "property_detail": {
        const tmpl = s(
          `whatsapp.propertyMessageTemplate${suffix}`,
          lang === "ar"
            ? "مرحباً، أنا مهتم بالعقار: {{property_title}} (رقم: {{property_id}}) في {{city}}. الرابط: {{url}}"
            : "Hello, I'm interested in: {{property_title}} (ID: {{property_id}}) in {{city}}. Link: {{url}}"
        );
        if (propertyName || propertyId) {
          return buildPropertyMessage(tmpl, {
            title: propertyName || "",
            id: propertyId || "",
            city: city || "",
            url: propertyUrl || window.location.href,
          });
        }
        return fallback;
      }
      default:
        return fallback;
    }
  }, [resolvedContext, lang, s, propertyName, propertyId, city, propertyUrl]);

  // ── Animations ─────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const show = setTimeout(() => setShowTooltip(true), 4000);
    const hide = setTimeout(() => setShowTooltip(false), 10000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setPulse(false), 12000);
    return () => clearTimeout(timer);
  }, []);

  // ── Bail out if disabled, no phone, or wrong route ─────────────────
  if (!isEnabled || !phone || isHiddenRoute || !isRouteAllowed) return null;

  // ── Build link ─────────────────────────────────────────────────────
  const tooltipText =
    lang === "ar" ? s("whatsapp.textAr", "تواصل معنا") : s("whatsapp.textEn", "Chat with us");
  const waUrl = buildWhatsAppUrl(phone, message);

  return (
    <div
      className={`fixed z-50 flex items-end gap-3 transition-all duration-700 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
      }`}
      style={{
        bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
        ...(lang === "ar" ? { left: "1.5rem" } : { right: "1.5rem" }),
      }}
    >
      {/* Tooltip bubble */}
      <div
        className={`bg-white rounded-2xl shadow-2xl px-4 py-2.5 text-sm font-medium text-gray-800 border border-gray-100 transition-all duration-500 whitespace-nowrap ${
          showTooltip
            ? "opacity-100 translate-x-0 scale-100"
            : "opacity-0 translate-x-4 scale-90 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
          {tooltipText}
        </div>
        <div className="absolute -start-2 bottom-3 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-e-[8px] border-e-white" />
      </div>

      {/* WhatsApp Button */}
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative"
        title={tooltipText}
        aria-label={tooltipText}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {pulse && (
          <>
            <span className="absolute inset-0 rounded-full bg-[#25D366]/30 animate-ping" />
            <span className="absolute inset-[-4px] rounded-full bg-[#25D366]/15 animate-pulse" />
          </>
        )}
        <div className="relative w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg shadow-[#25D366]/30 group-hover:shadow-xl group-hover:shadow-[#25D366]/40 group-hover:scale-110 transition-all duration-300 group-active:scale-95">
          <svg className="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </div>
      </a>
    </div>
  );
}
