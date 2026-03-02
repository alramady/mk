import SEOHead from "@/components/SEOHead";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PropertyCard from "@/components/PropertyCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Search as SearchIcon, SlidersHorizontal, Grid3X3, List, MapPin, X, Building2, Navigation } from "lucide-react";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { SERVICE_AREAS, getComingSoonMessage } from "@shared/service_areas";
import { toast } from "sonner";

export default function Search() {
  const { t, lang } = useI18n();

  // Read URL query parameters on mount
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const [searchText, setSearchText] = useState(urlParams.get('q') || "");
  const [city, setCity] = useState(urlParams.get('city') || "");
  const [district, setDistrict] = useState("");
  const [propertyType, setPropertyType] = useState(urlParams.get('type') || "");
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [bedrooms, setBedrooms] = useState<number | undefined>();

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<string>("newest");
  const [page, setPage] = useState(0);
  const debouncedSearchText = useDebounce(searchText, 300);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when mobile filter overlay is open
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (showFilters && isMobile) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.overflow = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [showFilters]);

  // Load districts from DB + merge with SERVICE_AREAS static data
  const districtsQuery = trpc.districts.all.useQuery();
  const cities = useMemo(() => {
    const cityMap = new Map<string, { city: string; cityAr: string; status: string }>();
    if (districtsQuery.data) {
      (districtsQuery.data as any[]).forEach((d: any) => {
        if (!cityMap.has(d.city)) {
          const sa = SERVICE_AREAS.find(s => s.name_en.toLowerCase() === d.city.toLowerCase());
          cityMap.set(d.city, { city: d.city, cityAr: d.cityAr, status: sa?.status || "active" });
        }
      });
    }
    // Add coming_soon cities from SERVICE_AREAS that aren't in DB
    SERVICE_AREAS.filter(s => s.status === "coming_soon").forEach(s => {
      if (!cityMap.has(s.name_en)) {
        cityMap.set(s.name_en, { city: s.name_en, cityAr: s.name_ar, status: "coming_soon" });
      }
    });
    return Array.from(cityMap.values()).sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (a.status !== "active" && b.status === "active") return 1;
      return a.city.localeCompare(b.city);
    });
  }, [districtsQuery.data]);

  const selectedCityStatus = useMemo(() => {
    if (!city) return null;
    return cities.find(c => c.city.toLowerCase() === city.toLowerCase())?.status || null;
  }, [city, cities]);

  const districtsForCity = useMemo(() => {
    if (!city) return [];
    // Try DB districts first
    const dbDistricts = (districtsQuery.data as any[] || []).filter((d: any) => d.city.toLowerCase() === city.toLowerCase());
    if (dbDistricts.length > 0) return dbDistricts;
    // Fallback to SERVICE_AREAS static data
    const sa = SERVICE_AREAS.find(s => s.name_en.toLowerCase() === city.toLowerCase());
    if (sa) return sa.districts.map((d, i) => ({ id: i + 1, nameEn: d.en, nameAr: d.ar, city: sa.name_en, cityAr: sa.name_ar }));
    return [];
  }, [districtsQuery.data, city]);

  // Debounce numeric inputs to reduce API calls during rapid changes
  const debouncedMinPrice = useDebounce(minPrice, 400);
  const debouncedMaxPrice = useDebounce(maxPrice, 400);
  const debouncedBedrooms = useDebounce(bedrooms, 300);

  const searchInput = useMemo(() => ({
    query: debouncedSearchText || undefined,
    city: city || undefined,
    propertyType: propertyType || undefined,
    minPrice: debouncedMinPrice,
    maxPrice: debouncedMaxPrice,
    bedrooms: debouncedBedrooms,

    limit: 12,
    offset: page * 12,
  }), [debouncedSearchText, city, propertyType, debouncedMinPrice, debouncedMaxPrice, debouncedBedrooms, page]);

  const results = trpc.property.search.useQuery(searchInput, { placeholderData: (prev: any) => prev });

  const propertyTypes = [
    { value: "apartment", label: t("type.apartment") },
    { value: "villa", label: t("type.villa") },
    { value: "studio", label: t("type.studio") },
    { value: "duplex", label: t("type.duplex") },
    { value: "furnished_room", label: t("type.furnished_room") },
    { value: "compound", label: t("type.compound") },
    { value: "hotel_apartment", label: t("type.hotel_apartment") },
  ];

  const clearFilters = () => {
    setSearchText(""); setCity(""); setDistrict(""); setPropertyType(""); setMinPrice(undefined); setMaxPrice(undefined);
    setBedrooms(undefined); setPage(0);
    // Clear URL params
    window.history.replaceState({}, '', '/search');
  };

  const closeFilters = useCallback(() => {
    setShowFilters(false);
  }, []);

  const hasFilters = searchText || city || district || propertyType || minPrice || maxPrice || bedrooms;

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead title="Search Properties" titleAr="البحث عن عقارات" description="Search furnished apartments and properties for monthly rent in Saudi Arabia" path="/search" />
      <Navbar />

      <div className="container py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading font-bold">{t("search.title")}</h1>
            {results.data && (
              <p className="text-sm text-muted-foreground mt-1">
                {results.data.total} {lang === "ar" ? "نتيجة" : "results"}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Sort dropdown */}
            <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(0); }}>
              <SelectTrigger className="w-[140px] sm:w-[160px] h-9 text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{lang === "ar" ? "الأحدث" : "Newest"}</SelectItem>
                <SelectItem value="price_asc">{lang === "ar" ? "السعر: الأقل" : "Price: Low"}</SelectItem>
                <SelectItem value="price_desc">{lang === "ar" ? "السعر: الأعلى" : "Price: High"}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="md:hidden"
            >
              <SlidersHorizontal className="h-4 w-4 me-1.5" />
              {t("search.filters")}
            </Button>
            <div className="hidden md:flex border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-9 w-9 rounded-none"
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-9 w-9 rounded-none"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          {/* ── Mobile Filter Bottom Sheet ── */}
          {showFilters && (
            <div className="fixed inset-0 z-50 md:hidden">
              {/* Backdrop — tap to close */}
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-200"
                onClick={closeFilters}
              />
              {/* Bottom Sheet Panel — 85% height, rounded top */}
              <div
                ref={filterPanelRef}
                className="absolute inset-x-0 bottom-0 bg-background rounded-t-2xl overflow-y-auto overscroll-contain animate-in slide-in-from-bottom duration-300"
                style={{ maxHeight: "85vh" }}
              >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                </div>
                {/* Sheet header bar */}
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-3 flex items-center justify-between">
                  <h2 className="text-lg font-heading font-semibold">{t("search.filters")}</h2>
                  <Button variant="ghost" size="icon" onClick={closeFilters} className="h-9 w-9 -me-2">
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                {/* Filter content */}
                <div className="px-4 py-5 space-y-5">
                  {/* Clear filters link */}
                  {hasFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-sm text-[#3ECFC0] hover:underline flex items-center gap-1"
                    >
                      <X className="h-3.5 w-3.5" />
                      {t("search.clearFilters")}
                    </button>
                  )}

                  {/* Text Search */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      {lang === "ar" ? "بحث" : "Search"}
                    </label>
                    <div className="relative">
                      <SearchIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={searchText}
                        onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
                        placeholder={lang === "ar" ? "اسم العقار، الحي، الوصف..." : "Property name, district, description..."}
                        className="ps-9 h-11"
                        dir={lang === "ar" ? "rtl" : "ltr"}
                      />
                      {searchText && (
                        <button
                          type="button"
                          onClick={() => setSearchText("")}
                          className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* City */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t("search.city")}</label>
                    <Select value={city} onValueChange={(v) => { setCity(v); setDistrict(""); setPage(0); }}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder={t("search.city")} />
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map(c => (
                          <SelectItem key={c.city} value={c.city.toLowerCase()}>
                            {lang === "ar" ? c.cityAr : c.city}
                            {c.status === "coming_soon" ? ` (${lang === "ar" ? "قريباً" : "Soon"})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Coming soon banner */}
                    {selectedCityStatus === "coming_soon" && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 leading-relaxed">
                        {getComingSoonMessage(lang)}
                      </p>
                    )}
                  </div>

                  {/* District */}
                  {city && districtsForCity.length > 0 && (
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        {lang === "ar" ? "الحي" : "District"}
                      </label>
                      <Select value={district} onValueChange={(v) => { setDistrict(v); setPage(0); }}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder={lang === "ar" ? "اختر الحي" : "Select district"} />
                        </SelectTrigger>
                        <SelectContent>
                          {districtsForCity.map((d: any) => (
                            <SelectItem key={d.id} value={d.nameEn.toLowerCase()}>
                              {lang === "ar" ? d.nameAr : d.nameEn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Property Type */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t("search.propertyType")}</label>
                    <Select value={propertyType} onValueChange={(v) => { setPropertyType(v); setPage(0); }}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder={t("search.propertyType")} />
                      </SelectTrigger>
                      <SelectContent>
                        {propertyTypes.map(pt => (
                          <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Price Range */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t("search.priceRange")}</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder={t("search.minPrice")}
                        value={minPrice ?? ""}
                        onChange={(e) => { setMinPrice(e.target.value ? Number(e.target.value) : undefined); setPage(0); }}
                        className="h-11"
                      />
                      <Input
                        type="number"
                        placeholder={t("search.maxPrice")}
                        value={maxPrice ?? ""}
                        onChange={(e) => { setMaxPrice(e.target.value ? Number(e.target.value) : undefined); setPage(0); }}
                        className="h-11"
                      />
                    </div>
                  </div>

                  {/* Bedrooms */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t("search.bedrooms")}</label>
                    <div className="flex gap-2 flex-wrap">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Button
                          key={n}
                          variant={bedrooms === n ? "default" : "outline"}
                          size="sm"
                          className="h-10 w-10 p-0"
                          onClick={() => { setBedrooms(bedrooms === n ? undefined : n); setPage(0); }}
                        >
                          {n}{n === 5 ? "+" : ""}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sticky bottom bar — Show Results + Clear */}
                <div
                  className="sticky bottom-0 bg-background border-t px-4 py-3 flex gap-3"
                  style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
                >
                  <Button variant="outline" className="flex-1 h-11" onClick={() => { clearFilters(); closeFilters(); }}>
                    <X className="h-4 w-4 me-1.5" />
                    {lang === "ar" ? "مسح" : "Clear"}
                  </Button>
                  <Button className="flex-1 h-11 bg-[#3ECFC0] hover:bg-[#2ab5a6] text-[#0B1E2D] font-semibold" onClick={() => { closeFilters(); setTimeout(() => { resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100); }}>
                    {lang === "ar" ? "عرض النتائج" : "Show Results"}
                    {results.data ? ` (${results.data.total})` : ""}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Desktop Filters Sidebar ── */}
          <div className="hidden md:block w-72 shrink-0">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{t("search.filters")}</CardTitle>
                  {hasFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">
                      <X className="h-3 w-3 me-1" />
                      {t("search.clearFilters")}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Text Search */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    {lang === "ar" ? "بحث" : "Search"}
                  </label>
                  <div className="relative">
                    <SearchIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchText}
                      onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
                      placeholder={lang === "ar" ? "اسم العقار، الحي، الوصف..." : "Property name, district, description..."}
                      className="ps-9"
                      dir={lang === "ar" ? "rtl" : "ltr"}
                    />
                    {searchText && (
                      <button
                        type="button"
                        onClick={() => setSearchText("")}
                        className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* City */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t("search.city")}</label>
                  <Select value={city} onValueChange={(v) => { setCity(v); setDistrict(""); setPage(0); }}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("search.city")} />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map(c => (
                        <SelectItem key={c.city} value={c.city.toLowerCase()}>
                          {lang === "ar" ? c.cityAr : c.city}
                          {c.status === "coming_soon" ? ` (${lang === "ar" ? "قريباً" : "Soon"})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Coming soon banner */}
                  {selectedCityStatus === "coming_soon" && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 leading-relaxed">
                      {getComingSoonMessage(lang)}
                    </p>
                  )}
                </div>

                {/* District */}
                {city && districtsForCity.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      {lang === "ar" ? "الحي" : "District"}
                    </label>
                    <Select value={district} onValueChange={(v) => { setDistrict(v); setPage(0); }}>
                      <SelectTrigger>
                        <SelectValue placeholder={lang === "ar" ? "اختر الحي" : "Select district"} />
                      </SelectTrigger>
                      <SelectContent>
                        {districtsForCity.map((d: any) => (
                          <SelectItem key={d.id} value={d.nameEn.toLowerCase()}>
                            {lang === "ar" ? d.nameAr : d.nameEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Property Type */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t("search.propertyType")}</label>
                  <Select value={propertyType} onValueChange={(v) => { setPropertyType(v); setPage(0); }}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("search.propertyType")} />
                    </SelectTrigger>
                    <SelectContent>
                      {propertyTypes.map(pt => (
                        <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Price Range */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t("search.priceRange")}</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder={t("search.minPrice")}
                      value={minPrice ?? ""}
                      onChange={(e) => { setMinPrice(e.target.value ? Number(e.target.value) : undefined); setPage(0); }}
                    />
                    <Input
                      type="number"
                      placeholder={t("search.maxPrice")}
                      value={maxPrice ?? ""}
                      onChange={(e) => { setMaxPrice(e.target.value ? Number(e.target.value) : undefined); setPage(0); }}
                    />
                  </div>
                </div>

                {/* Bedrooms */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t("search.bedrooms")}</label>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Button
                        key={n}
                        variant={bedrooms === n ? "default" : "outline"}
                        size="sm"
                        className="h-9 w-9 p-0"
                        onClick={() => { setBedrooms(bedrooms === n ? undefined : n); setPage(0); }}
                      >
                        {n}{n === 5 ? "+" : ""}
                      </Button>
                    ))}
                  </div>
                </div>

              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="flex-1" ref={resultsRef}>
            {/* Active filters */}
            {hasFilters && (
              <div className="flex flex-wrap gap-2 mb-4">
                {searchText && (
                  <Badge variant="secondary" className="gap-1">
                    <SearchIcon className="h-3 w-3" /> "{searchText}"
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchText("")} />
                  </Badge>
                )}
                {city && (
                  <Badge variant="secondary" className="gap-1">
                    <MapPin className="h-3 w-3" /> {city}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setCity("")} />
                  </Badge>
                )}
                {propertyType && (
                  <Badge variant="secondary" className="gap-1">
                    {propertyTypes.find(p => p.value === propertyType)?.label}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setPropertyType("")} />
                  </Badge>
                )}
                {bedrooms && (
                  <Badge variant="secondary" className="gap-1">
                    {bedrooms} {t("search.bedrooms")}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setBedrooms(undefined)} />
                  </Badge>
                )}
              </div>
            )}

            {results.isLoading ? (
              <div className={`grid gap-4 sm:gap-6 ${viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Card key={i} className="overflow-hidden">
                    <Skeleton className="aspect-[4/3]" />
                    <CardContent className="p-4 space-y-3">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-4 w-32" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : results.data && results.data.items.length > 0 ? (
              <>
                <div className={`grid gap-4 sm:gap-6 ${viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
                  {[...results.data.items].sort((a: any, b: any) => {
                    if (sortBy === "price_asc") return (a.monthlyPrice || 0) - (b.monthlyPrice || 0);
                    if (sortBy === "price_desc") return (b.monthlyPrice || 0) - (a.monthlyPrice || 0);
                    // newest — sort by id descending (higher id = newer)
                    return (b.id || 0) - (a.id || 0);
                  }).map((prop) => (
                    <PropertyCard key={prop.id} property={prop} />
                  ))}
                </div>
                {/* Pagination */}
                {results.data.total > 12 && (
                  <div className="flex justify-center gap-2 mt-8">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage(p => p - 1)}
                    >
                      {t("common.previous")}
                    </Button>
                    <span className="flex items-center px-3 text-sm text-muted-foreground">
                      {page + 1} / {Math.ceil(results.data.total / 12)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={(page + 1) * 12 >= results.data.total}
                      onClick={() => setPage(p => p + 1)}
                    >
                      {t("common.next")}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <Card className="p-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{t("search.noResults")}</p>
                {selectedCityStatus === "coming_soon" && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-3">
                    {getComingSoonMessage(lang)}
                  </p>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
