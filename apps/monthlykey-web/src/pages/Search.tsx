import { MapPin, Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useState, useMemo } from "react";
import MobileHeader from "../components/MobileHeader";
import HelpFAB from "../components/HelpFAB";
import { SearchBarWithFilters, EMPTY_FILTERS, type FilterValues } from "../components/FilterSheet";
import SafeImage from "../components/SafeImage";
import { useLocale } from "../contexts/LocaleContext";
import { filterSeedListings } from "../data/seed-listings";

const PAGE_SIZE = 9;

export default function Search() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { locale, t } = useLocale();

  const city = params.get("city") ?? "";
  const query = params.get("q") ?? "";
  const type = params.get("type") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1"));

  const [searchQuery, setSearchQuery] = useState(query);
  const [filters, setFilters] = useState<FilterValues>({
    ...EMPTY_FILTERS,
    city,
    type,
    minBudget: params.get("minPrice") ?? "",
    maxBudget: params.get("maxPrice") ?? "",
    bedrooms: params.get("beds") ?? "",
    bathrooms: params.get("baths") ?? "",
    furnished: params.get("furnished") ?? "",
    minArea: params.get("minArea") ?? "",
    maxArea: params.get("maxArea") ?? "",
    amenities: params.get("amenities") ? params.get("amenities")!.split(",") : [],
  });

  const results = useMemo(() => {
    return filterSeedListings({
      city: city || undefined,
      type: type || undefined,
      minPrice: params.get("minPrice") ? Number(params.get("minPrice")) : undefined,
      maxPrice: params.get("maxPrice") ? Number(params.get("maxPrice")) : undefined,
      beds: params.get("beds") ? Number(params.get("beds")) : undefined,
      q: query || undefined,
      page,
      limit: PAGE_SIZE,
    });
  }, [city, type, query, page, params]);

  const handleApplyFilters = () => {
    const p = new URLSearchParams();
    if (searchQuery) p.set("q", searchQuery);
    if (filters.city) p.set("city", filters.city);
    if (filters.type) p.set("type", filters.type);
    if (filters.minBudget) p.set("minPrice", filters.minBudget);
    if (filters.maxBudget) p.set("maxPrice", filters.maxBudget);
    if (filters.bedrooms) p.set("beds", filters.bedrooms);
    if (filters.bathrooms) p.set("baths", filters.bathrooms);
    if (filters.furnished) p.set("furnished", filters.furnished);
    if (filters.minArea) p.set("minArea", filters.minArea);
    if (filters.maxArea) p.set("maxArea", filters.maxArea);
    if (filters.amenities?.length) p.set("amenities", filters.amenities.join(","));
    navigate(`/search?${p}`);
  };

  const handleSearch = () => {
    handleApplyFilters();
  };

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setSearchQuery("");
  };

  const goToPage = (p: number) => {
    const newParams = new URLSearchParams(params);
    newParams.set("page", String(p));
    setParams(newParams);
  };

  return (
    <div className="min-h-screen bg-mk-light">
      <MobileHeader />

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-5">
          <Link to="/" className="hover:text-mk-teal transition-colors">
            {t("الرئيسية", "Home")}
          </Link>
          <span>/</span>
          <span className="text-mk-navy font-medium">
            {t("نتائج البحث", "Search Results")}
            {(city || query) && (
              <span className="text-gray-400 font-normal"> — {city || query}</span>
            )}
          </span>
        </div>

        {/* Search Bar + Quick Filters + Advanced */}
        <div className="mb-6">
          <SearchBarWithFilters
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSearch={handleSearch}
            filters={filters}
            onFiltersChange={setFilters}
            onApply={handleApplyFilters}
            onReset={handleReset}
          />
        </div>

        {/* Results count */}
        <p className="text-sm text-gray-500 mb-4">
          {t(
            `${results.total} عقار متاح`,
            `${results.total} properties available`
          )}
          {results.totalPages > 1 && (
            <span className="text-gray-400">
              {" "}— {t(`صفحة ${page} من ${results.totalPages}`, `Page ${page} of ${results.totalPages}`)}
            </span>
          )}
        </p>

        {/* Listing grid */}
        {results.data.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {results.data.map((listing) => (
              <div
                key={listing.id}
                onClick={() => navigate(`/unit/${listing.id}`)}
                className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-lg hover:border-mk-teal/20 transition-all cursor-pointer group"
              >
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
                  <div className="absolute top-3 end-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 z-[5]">
                    <div className="w-6 h-6 rounded-full bg-mk-teal text-white text-[10px] font-bold flex items-center justify-center">
                      {listing.manager.initials}
                    </div>
                    <span className="text-xs text-gray-700 font-medium">
                      {locale === "ar" ? listing.manager.name_ar : listing.manager.name_en}
                    </span>
                  </div>
                  {/* Price badge */}
                  <div className="absolute bottom-3 start-3 bg-mk-navy/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-sm font-bold z-[5]">
                    {listing.price.toLocaleString()} {t("ر.س", "SAR")}{" "}
                    <span className="text-gray-300 font-normal text-xs">/ {t("شهر", "mo")}</span>
                  </div>
                </div>
                <div className="p-4">
                  <span className="text-xs font-medium text-mk-teal">
                    {locale === "ar" ? listing.type_ar : listing.type_en}
                  </span>
                  <h3 className="font-semibold text-mk-navy text-sm mt-1 mb-1.5 line-clamp-1 group-hover:text-mk-teal transition-colors">
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
                    <span className="flex items-center gap-1"><Building2 size={12} /> {listing.beds}</span>
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
        ) : (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
            <MapPin size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="text-mk-navy font-medium mb-1">
              {t("لا توجد نتائج", "No results found")}
            </p>
            <p className="text-gray-400 text-sm">
              {t("حاول تعديل معايير البحث", "Try adjusting your search criteria")}
            </p>
          </div>
        )}

        {/* Pagination */}
        {results.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {locale === "ar" ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            {Array.from({ length: results.totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => goToPage(p)}
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                  p === page
                    ? "bg-mk-teal text-white"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= results.totalPages}
              className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {locale === "ar" ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
        )}
      </div>

      {/* Bottom spacer for FABs on mobile */}
      <div className="h-20 sm:h-0" />

      <HelpFAB locale={locale} />
    </div>
  );
}
