import { MapPin, Building2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import MobileHeader from "../components/MobileHeader";
import HelpFAB from "../components/HelpFAB";
import { SearchBarWithFilters, EMPTY_FILTERS, type FilterValues } from "../components/FilterSheet";
import SafeImage from "../components/SafeImage";
import { useLocale } from "../contexts/LocaleContext";
import { SEED_LISTINGS } from "../data/seed-listings";

/** Show first 6 listings on the homepage */
const FEATURED = SEED_LISTINGS.slice(0, 6);

export default function Home() {
  const navigate = useNavigate();
  const { locale, t } = useLocale();
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);

  const handleApplyFilters = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (filters.city) params.set("city", filters.city);
    if (filters.type) params.set("type", filters.type);
    if (filters.minBudget) params.set("minPrice", filters.minBudget);
    if (filters.maxBudget) params.set("maxPrice", filters.maxBudget);
    if (filters.bedrooms) params.set("beds", filters.bedrooms);
    if (filters.bathrooms) params.set("baths", filters.bathrooms);
    if (filters.furnished) params.set("furnished", filters.furnished);
    if (filters.minArea) params.set("minArea", filters.minArea);
    if (filters.maxArea) params.set("maxArea", filters.maxArea);
    if (filters.amenities?.length) params.set("amenities", filters.amenities.join(","));
    navigate(`/search?${params}`);
  };

  return (
    <div className="min-h-screen bg-mk-light">
      {/* Header */}
      <MobileHeader />

      {/* Hero */}
      <section className="bg-gradient-to-br from-mk-navy to-mk-dark py-16 md:py-20 px-4 md:px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(46,196,182,0.08),transparent_70%)]" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 leading-tight">
            {t("سكنك الشهري", "Your Monthly Home")}{" "}
            <span className="text-mk-gold">{t("بمفتاح واحد", "One Key Away")}</span>
          </h1>
          <p className="text-gray-300 text-base md:text-lg mb-8 max-w-xl mx-auto">
            {t(
              "شقق مفروشة بعقود شهرية مرنة في أفضل أحياء المملكة",
              "Furnished apartments with flexible monthly contracts in the best neighborhoods"
            )}
          </p>

          {/* Search bar */}
          <div className="max-w-2xl mx-auto">
            <SearchBarWithFilters
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onSearch={handleApplyFilters}
              filters={filters}
              onFiltersChange={setFilters}
              onApply={handleApplyFilters}
              onReset={() => { setFilters(EMPTY_FILTERS); setSearchQuery(""); }}
            />
          </div>
        </div>
      </section>

      {/* Featured Listings */}
      <section className="py-12 md:py-16 px-4 md:px-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-mk-navy">
            {t("اكتشف أفضل العقارات المتاحة للتأجير الشهري", "Discover Top Monthly Rentals")}
          </h2>
          <button
            onClick={() => navigate("/search")}
            className="text-mk-teal text-sm font-medium hover:underline flex items-center gap-1"
          >
            {t("عرض الكل", "View All")}
            <ArrowLeft size={14} className={locale === "en" ? "rotate-180" : ""} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURED.map((listing) => (
            <div
              key={listing.id}
              onClick={() => navigate(`/unit/${listing.id}`)}
              className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-lg hover:border-mk-teal/20 transition-all cursor-pointer group"
            >
              {/* Image with SafeImage + photo count + hover carousel */}
              <div className="relative">
                <SafeImage
                  src={listing.cover_photo_url}
                  photos={listing.photos}
                  alt={locale === "ar" ? listing.title_ar : listing.title_en}
                  aspectRatio="4/3"
                  photoCount={listing.photo_count}
                  className="rounded-t-xl"
                />
                {/* Manager badge */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 z-[5]">
                  <div className="w-6 h-6 rounded-full bg-mk-teal text-white text-[10px] font-bold flex items-center justify-center">
                    {listing.manager.initials}
                  </div>
                  <span className="text-xs text-gray-700 font-medium">
                    {locale === "ar" ? listing.manager.name_ar : listing.manager.name_en}
                  </span>
                </div>
                {/* Favorite */}
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-12 left-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors z-[5]"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
                {/* Price badge */}
                <div className="absolute bottom-3 left-3 bg-mk-navy/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-sm font-bold z-[5]">
                  {listing.price.toLocaleString()} {t("ر.س", "SAR")}{" "}
                  <span className="text-gray-300 font-normal text-xs">/ {t("شهر", "mo")}</span>
                </div>
              </div>

              {/* Card body */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-mk-teal">
                    {locale === "ar" ? listing.type_ar : listing.type_en}
                  </span>
                </div>
                <h3 className="font-semibold text-mk-navy text-sm mb-1.5 line-clamp-1 group-hover:text-mk-teal transition-colors">
                  {locale === "ar" ? listing.title_ar : listing.title_en}
                </h3>
                <div className="flex items-center gap-1 text-gray-500 text-xs mb-3">
                  <MapPin size={12} />
                  <span>
                    {locale === "ar"
                      ? `${listing.district_ar}، ${listing.city_ar}`
                      : `${listing.district_en}, ${listing.city_en}`}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 border-t border-gray-50 pt-2.5">
                  <span className="flex items-center gap-1">
                    <Building2 size={12} /> {listing.beds}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h16M4 12v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M6 12V5a2 2 0 0 1 2-2h2v4h4V3h2a2 2 0 0 1 2 2v7" /></svg>
                    {listing.baths}
                  </span>
                  <span>{listing.area} {t("م²", "m²")}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Cities */}
      <section className="py-12 px-4 md:px-6 max-w-6xl mx-auto">
        <h2 className="text-xl md:text-2xl font-bold text-mk-navy mb-6">
          {t("مدننا", "Our Cities")}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { name_ar: "الرياض", name_en: "Riyadh", count: 8 },
            { name_ar: "جدة", name_en: "Jeddah", count: 8 },
            { name_ar: "مكة المكرمة", name_en: "Makkah", count: 6 },
            { name_ar: "المدينة المنورة", name_en: "Madinah", count: 4 },
            { name_ar: "الخبر", name_en: "Khobar", count: 4 },
          ].map((c) => (
            <div
              key={c.name_ar}
              onClick={() => navigate(`/search?city=${c.name_ar}`)}
              className="bg-white rounded-xl border border-gray-100 p-5 cursor-pointer hover:shadow-md hover:border-mk-teal/30 transition-all"
            >
              <MapPin size={22} className="text-mk-teal mb-2.5" />
              <h3 className="font-semibold text-mk-navy text-sm">
                {locale === "ar" ? c.name_ar : c.name_en}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {c.count}+ {t("وحدة", "units")}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-mk-navy text-white py-10 pb-24 sm:pb-10 px-4 md:px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <img
                src="/mark-header-gold.png"
                alt="MonthlyKey"
                className="shrink-0 h-[30px] w-auto"
              />
              <span className="font-bold text-base">
                {t("المفتاح الشهري", "Monthly Key")}
              </span>
            </div>
            <p className="text-gray-400 text-sm">
              {t("منصة التأجير الشهري في السعودية", "Saudi Monthly Rental Platform")}
            </p>
          </div>
          <div className="text-sm text-gray-400">
            <p>&copy; 2026 {t("المفتاح الشهري. جميع الحقوق محفوظة.", "Monthly Key. All rights reserved.")}</p>
          </div>
        </div>
      </footer>

      {/* Help FAB */}
      <HelpFAB locale={locale} />
    </div>
  );
}
