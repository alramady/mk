import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { MapView as GoogleMap } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, BedDouble, Bath, Maximize2, SlidersHorizontal, List, X, ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { Link } from "wouter";

// Property type labels
const propertyTypeLabels: Record<string, { en: string; ar: string }> = {
  apartment: { en: "Apartment", ar: "شقة" },
  villa: { en: "Villa", ar: "فيلا" },
  studio: { en: "Studio", ar: "استوديو" },
  duplex: { en: "Duplex", ar: "دوبلكس" },
  furnished_room: { en: "Furnished Room", ar: "غرفة مفروشة" },
  compound: { en: "Compound", ar: "كمباوند" },
  hotel_apartment: { en: "Hotel Apartment", ar: "شقة فندقية" },
};

// Marker colors by property type
const markerColors: Record<string, string> = {
  apartment: "#3ECFC0",
  villa: "#E8B931",
  studio: "#8B5CF6",
  duplex: "#F97316",
  furnished_room: "#EC4899",
  compound: "#14B8A6",
  hotel_apartment: "#6366F1",
};

type MapProperty = {
  id: number;
  titleEn: string;
  titleAr: string;
  propertyType: string;
  city: string | null;
  cityAr: string | null;
  district: string | null;
  districtAr: string | null;
  latitude: string | null;
  longitude: string | null;
  monthlyRent: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqm: number | null;
  furnishedLevel: string | null;
  photos: string[] | null;
  isFeatured: boolean | null;
};

export default function MapViewPage() {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";

  // Filters
  const [city, setCity] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [bedrooms, setBedrooms] = useState<number | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const [showList, setShowList] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<MapProperty | null>(null);

  // Map refs
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // Debounce price
  const debouncedMinPrice = useDebounce(minPrice, 400);
  const debouncedMaxPrice = useDebounce(maxPrice, 400);

  // Load districts for city filter
  const districtsQuery = trpc.districts.all.useQuery();
  const cities = useMemo(() => {
    if (!districtsQuery.data) return [];
    const cityMap = new Map<string, { city: string; cityAr: string }>();
    (districtsQuery.data as any[]).forEach((d: any) => {
      if (!cityMap.has(d.city)) cityMap.set(d.city, { city: d.city, cityAr: d.cityAr });
    });
    return Array.from(cityMap.values()).sort((a, b) => a.city.localeCompare(b.city));
  }, [districtsQuery.data]);

  // Fetch map data
  const filterInput = useMemo(() => ({
    city: city || undefined,
    propertyType: propertyType || undefined,
    minPrice: debouncedMinPrice,
    maxPrice: debouncedMaxPrice,
    bedrooms: bedrooms,
  }), [city, propertyType, debouncedMinPrice, debouncedMaxPrice, bedrooms]);

  const { data: properties, isLoading } = trpc.property.mapData.useQuery(filterInput, {
    placeholderData: (prev) => prev,
  });

  // Create info window HTML content
  const createInfoContent = useCallback((prop: MapProperty) => {
    const title = isAr ? prop.titleAr : prop.titleEn;
    const location = isAr
      ? [prop.districtAr, prop.cityAr].filter(Boolean).join("، ")
      : [prop.district, prop.city].filter(Boolean).join(", ");
    const typeLabel = propertyTypeLabels[prop.propertyType]?.[isAr ? "ar" : "en"] || prop.propertyType;
    const photo = prop.photos?.[0] || "";
    const rent = Number(prop.monthlyRent).toLocaleString();
    const dir = isAr ? "rtl" : "ltr";

    return `
      <div style="direction:${dir};font-family:Tajawal,sans-serif;width:280px;padding:0;margin:0;">
        ${photo ? `<div style="width:100%;height:140px;overflow:hidden;border-radius:8px 8px 0 0;">
          <img src="${photo}" style="width:100%;height:100%;object-fit:cover;" alt="${title}" />
        </div>` : ""}
        <div style="padding:12px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <span style="background:#3ECFC0;color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;">${typeLabel}</span>
            ${prop.isFeatured ? `<span style="background:#E8B931;color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;">${isAr ? "مميز" : "Featured"}</span>` : ""}
          </div>
          <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;color:#1a2332;line-height:1.3;">${title}</h3>
          <p style="margin:0 0 8px;font-size:12px;color:#666;display:flex;align-items:center;gap:4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3ECFC0" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${location}
          </p>
          <div style="display:flex;align-items:center;gap:12px;font-size:12px;color:#888;margin-bottom:8px;">
            ${prop.bedrooms ? `<span>${prop.bedrooms} ${isAr ? "غرف" : "bd"}</span>` : ""}
            ${prop.bathrooms ? `<span>${prop.bathrooms} ${isAr ? "حمام" : "ba"}</span>` : ""}
            ${prop.sizeSqm ? `<span>${prop.sizeSqm} ${isAr ? "م²" : "m²"}</span>` : ""}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:16px;font-weight:800;color:#3ECFC0;">${rent} <span style="font-size:11px;font-weight:400;color:#888;">${isAr ? "ر.س/شهر" : "SAR/mo"}</span></span>
            <a href="/property/${prop.id}" style="background:#1a2332;color:#fff;padding:6px 14px;border-radius:6px;font-size:12px;text-decoration:none;font-weight:600;">${isAr ? "التفاصيل" : "Details"}</a>
          </div>
        </div>
      </div>
    `;
  }, [isAr]);

  // Create custom marker element
  const createMarkerElement = useCallback((prop: MapProperty) => {
    const color = markerColors[prop.propertyType] || "#3ECFC0";
    const rent = Number(prop.monthlyRent).toLocaleString();
    const el = document.createElement("div");
    el.className = "map-marker-pin";
    el.innerHTML = `
      <div style="
        background:${color};
        color:#fff;
        padding:4px 10px;
        border-radius:20px;
        font-size:12px;
        font-weight:700;
        font-family:Tajawal,sans-serif;
        box-shadow:0 2px 8px rgba(0,0,0,0.25);
        cursor:pointer;
        white-space:nowrap;
        transition:transform 0.15s ease;
        border:2px solid #fff;
      ">${rent}</div>
    `;
    el.addEventListener("mouseenter", () => {
      (el.firstElementChild as HTMLElement).style.transform = "scale(1.15)";
    });
    el.addEventListener("mouseleave", () => {
      (el.firstElementChild as HTMLElement).style.transform = "scale(1)";
    });
    return el;
  }, []);

  // Update markers when properties change
  useEffect(() => {
    if (!mapRef.current || !properties) return;
    const map = mapRef.current;

    // Clear existing markers
    markersRef.current.forEach(m => (m.map = null));
    markersRef.current = [];

    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow({ maxWidth: 300 });
    }

    const bounds = new google.maps.LatLngBounds();
    let hasValidMarker = false;

    (properties as MapProperty[]).forEach((prop) => {
      const lat = parseFloat(prop.latitude || "");
      const lng = parseFloat(prop.longitude || "");
      if (isNaN(lat) || isNaN(lng)) return;

      const position = { lat, lng };
      bounds.extend(position);
      hasValidMarker = true;

      const markerEl = createMarkerElement(prop);
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        content: markerEl,
        title: isAr ? prop.titleAr : prop.titleEn,
      });

      marker.addListener("click", () => {
        infoWindowRef.current?.setContent(createInfoContent(prop));
        infoWindowRef.current?.open({ anchor: marker, map });
        setSelectedProperty(prop);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds if we have markers
    if (hasValidMarker && markersRef.current.length > 1) {
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: showList ? 380 : 50 });
    } else if (hasValidMarker && markersRef.current.length === 1) {
      const first = markersRef.current[0];
      if (first.position) {
        map.setCenter(first.position as google.maps.LatLngLiteral);
        map.setZoom(14);
      }
    }
  }, [properties, isAr, createMarkerElement, createInfoContent, showList]);

  // Handle map ready
  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Reset filters
  const resetFilters = () => {
    setCity("");
    setPropertyType("");
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setBedrooms(undefined);
  };

  const hasFilters = city || propertyType || minPrice || maxPrice || bedrooms;
  const propertyCount = properties?.length ?? 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {/* Header bar */}
      <div className="bg-navy text-white py-3 px-4 flex items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-teal" />
          <div>
            <h1 className="text-base font-bold">{t("map.title")}</h1>
            <p className="text-xs text-white/60">
              {propertyCount} {t("map.properties")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="border-white/20 text-white hover:bg-white/10 bg-transparent"
          >
            <SlidersHorizontal className="h-4 w-4 me-1" />
            {t("map.filters")}
            {hasFilters && (
              <Badge className="ms-1 bg-teal text-white text-[10px] px-1.5 py-0">
                !
              </Badge>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowList(!showList)}
            className="border-white/20 text-white hover:bg-white/10 bg-transparent"
          >
            <List className="h-4 w-4 me-1" />
            {showList ? t("map.hideList") : t("map.showList")}
          </Button>
        </div>
      </div>

      {/* Filters bar */}
      {showFilters && (
        <div className="bg-card border-b border-border px-4 py-3 flex flex-wrap items-center gap-3 z-20">
          {/* City */}
          <Select value={city} onValueChange={(v) => { setCity(v === "all" ? "" : v); }}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder={t("map.allCities")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("map.allCities")}</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c.city} value={c.city}>
                  {isAr ? c.cityAr : c.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Property Type */}
          <Select value={propertyType} onValueChange={(v) => setPropertyType(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder={t("map.allTypes")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("map.allTypes")}</SelectItem>
              {Object.entries(propertyTypeLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {isAr ? label.ar : label.en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Bedrooms */}
          <Select value={bedrooms?.toString() || ""} onValueChange={(v) => setBedrooms(v === "any" ? undefined : Number(v))}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue placeholder={isAr ? "الغرف" : "Beds"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{isAr ? "الكل" : "Any"}</SelectItem>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={n.toString()}>
                  {n} {isAr ? "غرف" : "beds"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Price range */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder={isAr ? "أقل سعر" : "Min SAR"}
              value={minPrice ?? ""}
              onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : undefined)}
              className="w-[100px] h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
            <span className="text-muted-foreground text-sm">-</span>
            <input
              type="number"
              placeholder={isAr ? "أعلى سعر" : "Max SAR"}
              value={maxPrice ?? ""}
              onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
              className="w-[100px] h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-destructive">
              <X className="h-4 w-4 me-1" />
              {t("map.resetFilters")}
            </Button>
          )}
        </div>
      )}

      {/* Main content: map + optional list */}
      <div className="flex-1 flex relative" style={{ height: "calc(100vh - 120px)" }}>
        {/* Side list panel */}
        {showList && (
          <div className="w-[360px] border-e border-border bg-card overflow-y-auto flex-shrink-0 z-10">
            <div className="p-3 border-b border-border">
              <p className="text-sm font-medium text-foreground">
                {propertyCount} {t("map.properties")}
              </p>
            </div>
            {isLoading ? (
              <div className="p-3 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-lg" />
                ))}
              </div>
            ) : propertyCount === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{t("map.noResults")}</p>
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {(properties as MapProperty[])?.map((prop) => (
                  <PropertyListItem
                    key={prop.id}
                    property={prop}
                    isAr={isAr}
                    isSelected={selectedProperty?.id === prop.id}
                    onClick={() => {
                      setSelectedProperty(prop);
                      const lat = parseFloat(prop.latitude || "");
                      const lng = parseFloat(prop.longitude || "");
                      if (!isNaN(lat) && !isNaN(lng) && mapRef.current) {
                        mapRef.current.panTo({ lat, lng });
                        mapRef.current.setZoom(16);
                        // Open info window for this marker
                        const marker = markersRef.current.find((m) => {
                          const pos = m.position as google.maps.LatLngLiteral;
                          return Math.abs(pos.lat - lat) < 0.0001 && Math.abs(pos.lng - lng) < 0.0001;
                        });
                        if (marker && infoWindowRef.current) {
                          infoWindowRef.current.setContent(createInfoContent(prop));
                          infoWindowRef.current.open({ anchor: marker, map: mapRef.current });
                        }
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Google Map */}
        <div className="flex-1 relative">
          {isLoading && !properties && (
            <div className="absolute inset-0 z-20 bg-background/80 flex items-center justify-center">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-teal border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{t("map.loading")}</p>
              </div>
            </div>
          )}
          <GoogleMap
            className="w-full h-full"
            initialCenter={{ lat: 24.7136, lng: 46.6753 }} // Riyadh center
            initialZoom={6}
            onMapReady={handleMapReady}
          />
        </div>
      </div>
    </div>
  );
}

// Compact property list item for the side panel
function PropertyListItem({
  property,
  isAr,
  isSelected,
  onClick,
}: {
  property: MapProperty;
  isAr: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const title = isAr ? property.titleAr : property.titleEn;
  const location = isAr
    ? [property.districtAr, property.cityAr].filter(Boolean).join("، ")
    : [property.district, property.city].filter(Boolean).join(", ");
  const typeLabel = propertyTypeLabels[property.propertyType]?.[isAr ? "ar" : "en"] || property.propertyType;
  const rent = Number(property.monthlyRent).toLocaleString();
  const photo = property.photos?.[0];
  const color = markerColors[property.propertyType] || "#3ECFC0";

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? "ring-2 ring-teal shadow-md" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-2">
        <div className="flex gap-3">
          {/* Thumbnail */}
          <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
            {photo ? (
              <img src={photo} alt={title} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Building2 className="h-6 w-6 text-muted-foreground/40" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="text-[10px] font-semibold text-white px-1.5 py-0.5 rounded-full"
                style={{ background: color }}
              >
                {typeLabel}
              </span>
              {property.isFeatured && (
                <span className="text-[10px] font-semibold text-white bg-gold px-1.5 py-0.5 rounded-full">
                  {isAr ? "مميز" : "Featured"}
                </span>
              )}
            </div>
            <h4 className="text-sm font-semibold text-foreground truncate">{title}</h4>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 text-teal flex-shrink-0" />
              {location}
            </p>
            <div className="flex items-center justify-between mt-1.5">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {property.bedrooms && (
                  <span className="flex items-center gap-0.5">
                    <BedDouble className="h-3 w-3" /> {property.bedrooms}
                  </span>
                )}
                {property.bathrooms && (
                  <span className="flex items-center gap-0.5">
                    <Bath className="h-3 w-3" /> {property.bathrooms}
                  </span>
                )}
                {property.sizeSqm && (
                  <span className="flex items-center gap-0.5">
                    <Maximize2 className="h-3 w-3" /> {property.sizeSqm}
                  </span>
                )}
              </div>
              <span className="text-sm font-bold text-teal">{rent}</span>
            </div>
          </div>
        </div>

        {/* View details link */}
        <Link href={`/property/${property.id}`}>
          <Button variant="ghost" size="sm" className="w-full mt-2 h-7 text-xs text-teal hover:text-teal hover:bg-teal/10">
            {isAr ? "عرض التفاصيل" : "View Details"} →
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
