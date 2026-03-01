import { useI18n } from "@/lib/i18n";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { Mail, Phone, MapPin, Shield, Building2, Receipt, FileCheck, ExternalLink, Clock } from "lucide-react";
import PaymentMethodsBadges from "@/components/PaymentMethodsBadges";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

export default function Footer() {
  const { t, lang } = useI18n();
  const { get: s, getByLang: sl } = useSiteSettings();
  const year = new Date().getFullYear();

  const siteName = s("site.nameAr") || "المفتاح الشهري";
  const aboutText = sl("footer.about", lang) || t("footer.aboutText");
  const email = s("footer.email");
  const phone = s("footer.phone");
  const address = sl("footer.address", lang);
  const twitter = s("footer.twitter");
  const instagram = s("footer.instagram");
  const linkedin = s("footer.linkedin");

  const tourismLicence = s("legal.tourismLicence");
  const crNumber = s("legal.crNumber");
  const vatNumber = s("legal.vatNumber");
  const ejarLicence = s("legal.ejarLicence");
  const hasLicences = tourismLicence || crNumber || vatNumber || ejarLicence;

  return (
    <footer className="bg-[#0B1E2D] text-white/90 mt-auto">
      {/* Top accent line */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-[#3ECFC0] to-transparent" />

      {/* Main footer content */}
      <div className="container py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8">
          
          {/* Brand column */}
          <div className="md:col-span-4 flex flex-col items-center md:items-start">
            {/* Logo — light variant on dark footer, locale-aware */}
            <img 
              src="/assets/brand/mk-logo-dark.svg"
              alt={lang === "ar" ? "المفتاح الشهري" : "Monthly Key"} 
              className="h-16 sm:h-20 w-auto object-contain mb-5"
              style={{ maxWidth: '240px' }} 
            />
            <div className="w-12 h-0.5 bg-gradient-to-r from-[#C9A96E] to-[#3ECFC0] mb-4 rounded-full" />
            <p className="text-white/75 text-sm leading-relaxed text-center md:text-start max-w-xs">{aboutText}</p>
            
            {/* Social Links */}
            {(twitter || instagram || linkedin) && (
              <div className="flex gap-3 mt-6">
                {twitter && (
                  <a href={twitter} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/75 hover:text-[#3ECFC0] hover:bg-[#3ECFC0]/10 hover:border-[#3ECFC0]/30 transition-all duration-300">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </a>
                )}
                {instagram && (
                  <a href={instagram} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/75 hover:text-[#3ECFC0] hover:bg-[#3ECFC0]/10 hover:border-[#3ECFC0]/30 transition-all duration-300">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                  </a>
                )}
                {linkedin && (
                  <a href={linkedin} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/75 hover:text-[#3ECFC0] hover:bg-[#3ECFC0]/10 hover:border-[#3ECFC0]/30 transition-all duration-300">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Links columns */}
          <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-4">
            {/* Contact */}
            <div>
              <h4 className="font-heading font-semibold text-sm mb-4 text-white/80 uppercase tracking-wider">
                {lang === "ar" ? "تواصل معنا" : "Contact Us"}
              </h4>
              <div className="space-y-3 text-xs text-white/75">
                {email && (
                  <a href={`mailto:${email}`} className="flex items-center gap-2 hover:text-[#3ECFC0] transition-colors">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-[#3ECFC0]/50" /> <span className="truncate">{email}</span>
                  </a>
                )}
                {phone && (
                  <a href={`tel:${phone}`} className="flex items-center gap-2 hover:text-[#3ECFC0] transition-colors" dir="ltr">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-[#3ECFC0]/50" /> {phone}
                  </a>
                )}
                {address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#3ECFC0]/50" /> <span>{address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-heading font-semibold text-sm mb-4 text-white/80 uppercase tracking-wider">{t("footer.quickLinks")}</h4>
              <ul className="space-y-2.5 text-xs text-white/75">
                <li><Link href="/search" className="hover:text-[#3ECFC0] transition-colors inline-flex items-center gap-1">{t("nav.search")}</Link></li>
                <li><Link href="/list-property" className="hover:text-[#3ECFC0] transition-colors inline-flex items-center gap-1">{t("nav.listProperty")}</Link></li>
                <li><Link href="/" className="hover:text-[#3ECFC0] transition-colors inline-flex items-center gap-1">{t("nav.home")}</Link></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-heading font-semibold text-sm mb-4 text-white/80 uppercase tracking-wider">{t("footer.support")}</h4>
              <ul className="space-y-2.5 text-xs text-white/75">
                <li><Link href="/faq" className="hover:text-[#3ECFC0] transition-colors">{t("footer.faq")}</Link></li>
                <li><Link href="/contact" className="hover:text-[#3ECFC0] transition-colors">{t("footer.contact")}</Link></li>
                <li><Link href="/terms" className="hover:text-[#3ECFC0] transition-colors">{t("footer.terms")}</Link></li>
                <li><Link href="/privacy" className="hover:text-[#3ECFC0] transition-colors">{t("footer.privacy")}</Link></li>
              </ul>
            </div>

            {/* Cities — dynamic from DB */}
            <FooterCities lang={lang} />
          </div>
        </div>
      </div>

      {/* Licences & Registration Bar */}
      {hasLicences && (
        <div className="border-t border-white/5">
          <div className="container py-4">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] text-white/45">
              {tourismLicence && (
                <div className="flex items-center gap-1">
                  <Shield className="h-3 w-3 text-[#C9A96E]/40" />
                  <span>{lang === "ar" ? "ترخيص وزارة السياحة:" : "Tourism Licence:"}</span>
                  <span className="text-white/75 font-medium" dir="ltr">{tourismLicence}</span>
                </div>
              )}
              {crNumber && (
                <div className="flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-[#C9A96E]/40" />
                  <span>{lang === "ar" ? "سجل تجاري:" : "CR:"}</span>
                  <span className="text-white/75 font-medium" dir="ltr">{crNumber}</span>
                </div>
              )}
              {vatNumber && (
                <div className="flex items-center gap-1">
                  <Receipt className="h-3 w-3 text-[#C9A96E]/40" />
                  <span>{lang === "ar" ? "الرقم الضريبي:" : "VAT:"}</span>
                  <span className="text-white/75 font-medium" dir="ltr">{vatNumber}</span>
                </div>
              )}
              {ejarLicence && (
                <div className="flex items-center gap-1">
                  <FileCheck className="h-3 w-3 text-[#C9A96E]/40" />
                  <span>{lang === "ar" ? "ترخيص إيجار:" : "Ejar:"}</span>
                  <span className="text-white/75 font-medium" dir="ltr">{ejarLicence}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Method Badges */}
      <div className="container pb-4">
        <PaymentMethodsBadges variant="footer" />
      </div>

      {/* Copyright Bar */}
      <div className="border-t border-white/5 bg-[#071520]">
        <div className="container py-3.5 pb-24 sm:pb-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-white/40">
          <p>&copy; {year} Monthly Key - {siteName}. {t("footer.rights")}.</p>
          <div className="flex items-center gap-3">
            <Link href="/privacy" className="hover:text-[#3ECFC0] transition-colors">{t("footer.privacy")}</Link>
            <span className="text-white/20">|</span>
            <Link href="/terms" className="hover:text-[#3ECFC0] transition-colors">{t("footer.terms")}</Link>
            <span className="text-white/20">|</span>
            <span className="font-mono text-white/25" title={`Full build: ${typeof __APP_BUILD_DATE__ !== 'undefined' ? __APP_BUILD_DATE__ : ''}`}>
              Build {typeof __APP_BUILD_VERSION__ !== 'undefined' ? __APP_BUILD_VERSION__ : 'dev'}
              {typeof __APP_GIT_SHA__ !== 'undefined' && __APP_GIT_SHA__ !== 'unknown' ? ` • SHA: ${__APP_GIT_SHA__}` : ''}
              {' • monthly-key-app'}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── Footer Cities (dynamic from DB) ─── */
function FooterCities({ lang }: { lang: string }) {
  const citiesQuery = trpc.cities.all.useQuery({ activeOnly: false });
  const allCities = citiesQuery.data || [];
  const activeCities = allCities.filter((c: any) => c.isActive !== false);
  const comingSoonCities = allCities.filter((c: any) => c.isActive === false);

  return (
    <div>
      <h4 className="font-heading font-semibold text-sm mb-4 text-white/80 uppercase tracking-wider">
        {lang === "ar" ? "المدن" : "Cities"}
      </h4>
      <ul className="space-y-2.5 text-xs text-white/75">
        {activeCities.map((city: any) => (
          <li key={city.id}>
            <Link
              href={`/search?city=${city.nameEn?.toLowerCase()}`}
              className="hover:text-[#3ECFC0] transition-colors"
            >
              {lang === "ar" ? city.nameAr : city.nameEn}
            </Link>
          </li>
        ))}
        {comingSoonCities.map((city: any) => (
          <li key={city.id} className="flex items-center gap-1.5 text-white/40">
            <span>{lang === "ar" ? city.nameAr : city.nameEn}</span>
            <span className="inline-flex items-center gap-0.5 bg-[#C9A96E]/20 text-[#C9A96E] text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              <Clock className="h-2.5 w-2.5" />
              {lang === "ar" ? "قريباً" : "Soon"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
