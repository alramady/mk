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
import { useState, useMemo, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";

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
  const [page, setPage] = useState(0);
  const debouncedSearchText = useDebounce(searchText, 300);

  // Lock body scroll when mobile filter overlay is open
  useEffect(() => {
    if (showFilters && window.innerWidth < 768) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [showFilters]);

  // Load districts from DB
  const districtsQuery = trpc.districts.all.useQuery();
  const cities = useMemo(() => {
    if (!districtsQuery.data) return [];
    const cityMap = new Map<string, { city: string; cityAr: string }>();
    (districtsQuery.data as any[]).forEach((d: any) => {
      if (!cityMap.has(d.city)) cityMap.set(d.city, { city: d.city, cityAr: d.cityAr });
    });
    return Array.from(cityMap.values()).sort((a, b) => a.city.localeCompare(b.city));
  }, [districtsQuery.data]);

  const districtsForCity = useMemo(() => {
    if (!districtsQuery.data || !city) return [];
    return (districtsQuery.data as any[]).filter((d: any) => d.city.toLowerCase() === city.toLowerCase());
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
          {/* Filters Sidebar */}
          <div className={`${showFilters ? "fixed inset-0 z-40 bg-background/95 backdrop-blur-sm overflow-y-auto p-4 pt-6 pb-24 md:relative md:inset-auto md:z-auto md:bg-transparent md:backdrop-blur-none md:overflow-visible md:p-0 md:pt-0 md:pb-0" : "hidden"} md:block w-full md:w-72 shrink-0`}>
            {/* Mobile close button */}
            <div className="flex items-center justify-between mb-4 md:hidden">
              <h2 className="text-lg font-semibold">{t("search.filters")}</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowFilters(false)} className="h-9 w-9">
                <X className="h-5 w-5" />
              </Button>
            </div>
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
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            {/* Mobile sticky Apply/Close bar */}
            <div className="fixed bottom-0 inset-x-0 z-50 bg-background border-t p-3 flex gap-3 md:hidden" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
              <Button variant="outline" className="flex-1" onClick={clearFilters}>
                <X className="h-4 w-4 me-1.5" />
                {lang === "ar" ? "مسح" : "Clear"}
              </Button>
              <Button className="flex-1 bg-[#3ECFC0] hover:bg-[#2ab5a6] text-[#0B1E2D]" onClick={() => setShowFilters(false)}>
                {lang === "ar" ? "عرض النتائج" : "Show Results"}
              </Button>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1">
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
              <div className={`grid gap-6 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
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
                <div className={`grid gap-6 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
                  {results.data.items.map((prop) => (
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
              </Card>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
