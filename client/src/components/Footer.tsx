import { useI18n } from "@/lib/i18n";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { Building2, Mail, Phone, MapPin } from "lucide-react";
import { Link } from "wouter";

export default function Footer() {
  const { t, lang } = useI18n();
  const { get: s, getByLang: sl } = useSiteSettings();
  const year = new Date().getFullYear();

  const siteName = sl("site.name", lang, lang === "ar" ? "إيجار" : "Ijar");
  const aboutText = sl("footer.about", lang) || t("footer.aboutText");
  const email = s("footer.email", "info@ijar.sa");
  const phone = s("footer.phone", "+966500000000");
  const address = sl("footer.address", lang);
  const twitter = s("footer.twitter");
  const instagram = s("footer.instagram");
  const linkedin = s("footer.linkedin");

  return (
    <footer className="bg-[#0B1E2D] text-white/90 mt-auto">
      <div className="container py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-5">
              {s("site.logoUrl") ? (
                <img src={s("site.logoUrl")} alt="Logo" className="h-9 w-9 rounded-lg object-contain" />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-[#3ECFC0] flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-[#0B1E2D]" />
                </div>
              )}
              <span className="text-xl font-bold font-heading">{siteName}</span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed mb-5">{aboutText}</p>
            {/* Contact info */}
            <div className="space-y-2.5 text-sm text-white/50">
              {email && (
                <a href={`mailto:${email}`} className="flex items-center gap-2 hover:text-[#3ECFC0] transition-colors">
                  <Mail className="h-4 w-4" /> {email}
                </a>
              )}
              {phone && (
                <a href={`tel:${phone}`} className="flex items-center gap-2 hover:text-[#3ECFC0] transition-colors" dir="ltr">
                  <Phone className="h-4 w-4" /> {phone}
                </a>
              )}
              {address && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0" /> {address}
                </div>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-heading font-semibold mb-5 text-[#3ECFC0]">{t("footer.quickLinks")}</h4>
            <ul className="space-y-2.5 text-sm text-white/50">
              <li><Link href="/search" className="hover:text-[#3ECFC0] transition-colors">{t("nav.search")}</Link></li>
              <li><Link href="/list-property" className="hover:text-[#3ECFC0] transition-colors">{t("nav.listProperty")}</Link></li>
              <li><Link href="/" className="hover:text-[#3ECFC0] transition-colors">{t("nav.home")}</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-heading font-semibold mb-5 text-[#3ECFC0]">{t("footer.support")}</h4>
            <ul className="space-y-2.5 text-sm text-white/50">
              <li><span className="hover:text-[#3ECFC0] transition-colors cursor-pointer">{t("footer.faq")}</span></li>
              <li><span className="hover:text-[#3ECFC0] transition-colors cursor-pointer">{t("footer.contact")}</span></li>
              <li><span className="hover:text-[#3ECFC0] transition-colors cursor-pointer">{t("footer.terms")}</span></li>
              <li><span className="hover:text-[#3ECFC0] transition-colors cursor-pointer">{t("footer.privacy")}</span></li>
            </ul>
          </div>

          {/* Cities */}
          <div>
            <h4 className="font-heading font-semibold mb-5 text-[#3ECFC0]">
              {lang === "ar" ? "المدن" : "Cities"}
            </h4>
            <ul className="space-y-2.5 text-sm text-white/50">
              <li><Link href="/search?city=riyadh" className="hover:text-[#3ECFC0] transition-colors">{t("city.riyadh")}</Link></li>
              <li><Link href="/search?city=jeddah" className="hover:text-[#3ECFC0] transition-colors">{t("city.jeddah")}</Link></li>
              <li><Link href="/search?city=dammam" className="hover:text-[#3ECFC0] transition-colors">{t("city.dammam")}</Link></li>
              <li><Link href="/search?city=makkah" className="hover:text-[#3ECFC0] transition-colors">{t("city.makkah")}</Link></li>
              <li><Link href="/search?city=madinah" className="hover:text-[#3ECFC0] transition-colors">{t("city.madinah")}</Link></li>
              <li><Link href="/search?city=khobar" className="hover:text-[#3ECFC0] transition-colors">{t("city.khobar")}</Link></li>
            </ul>

            {/* Social Links */}
            {(twitter || instagram || linkedin) && (
              <div className="mt-5 pt-5 border-t border-white/10">
                <div className="flex gap-3">
                  {twitter && (
                    <a href={twitter} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-[#3ECFC0] hover:bg-white/10 hover:scale-110 transition-all duration-300">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    </a>
                  )}
                  {instagram && (
                    <a href={instagram} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-[#3ECFC0] hover:bg-white/10 hover:scale-110 transition-all duration-300">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    </a>
                  )}
                  {linkedin && (
                    <a href={linkedin} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-[#3ECFC0] hover:bg-white/10 hover:scale-110 transition-all duration-300">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/30">
          <p>&copy; {year} {siteName}. {t("footer.rights")}.</p>
          <p>{lang === "ar" ? "صُنع بـ ❤️ في المملكة العربية السعودية" : "Made with ❤️ in Saudi Arabia"}</p>
        </div>
      </div>
    </footer>
  );
}
