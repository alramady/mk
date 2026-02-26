import SEOHead from "@/components/SEOHead";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { MapView, type MapInstance } from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
// Slider removed — calculator now uses button chips
import CostCalculator from "@/components/CostCalculator";
import {
  Heart, Share2, MapPin, BedDouble, Bath, Maximize2, Building, Calendar,
  CheckCircle, Star, MessageSquare, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight,
  Wifi, Car, Dumbbell, Shield, Wind, Droplets, Zap, Flame, Tv, Shirt,
  Phone, UserCog, Clock, Eye, Calculator, X
} from "lucide-react";
import { useState, useRef, useMemo, useCallback } from "react";
import { MediaLightbox } from "@/components/MediaLightbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { buildWhatsAppUrl, buildPropertyMessage } from "@/components/WhatsAppButton";
import { useRoute, useLocation } from "wouter";
import { toast } from "sonner";

const amenityIcons: Record<string, any> = {
  wifi: Wifi, parking: Car, gym: Dumbbell, security: Shield,
  ac: Wind, water: Droplets, electricity: Zap, gas: Flame,
  tv: Tv, laundry: Shirt, elevator: CheckCircle, pool: Droplets,
  balcony: CheckCircle, furnished: CheckCircle, kitchen: CheckCircle,
};

const amenityAr: Record<string, string> = {
  wifi: "واي فاي", parking: "موقف سيارات", gym: "نادي رياضي",
  security: "حراسة أمنية", ac: "تكييف", water: "مياه",
  electricity: "كهرباء", gas: "غاز", tv: "تلفزيون",
  laundry: "غسيل", elevator: "مصعد", pool: "مسبح",
  balcony: "شرفة", furnished: "مفروش", kitchen: "مطبخ",
  garden: "حديقة", storage: "مستودع", "maid room": "غرفة خادمة",
  "central ac": "تكييف مركزي", "satellite/cable": "قنوات فضائية",
  internet: "إنترنت", maintenance: "صيانة",
  concierge: "خدمة الاستقبال", "smart home": "منزل ذكي",
  "private entrance": "مدخل خاص", "driver room": "غرفة سائق",
  "rooftop": "سطح", "playground": "ملعب أطفال",
  "bbq area": "منطقة شواء", "sauna": "ساونا",
  "jacuzzi": "جاكوزي", "mosque": "مسجد",
  "cctv": "كاميرات مراقبة", "intercom": "انتركم",
  "fire system": "نظام إطفاء", "backup generator": "مولد احتياطي",
  "water tank": "خزان مياه", "central heating": "تدفئة مركزية",
  "washer": "غسالة", "dryer": "مجفف",
  "dishwasher": "غسالة صحون", "microwave": "ميكروويف",
  "oven": "فرن", "refrigerator": "ثلاجة",
  "iron": "مكواة", "closet": "خزانة ملابس",
  "desk": "مكتب", "sofa": "أريكة",
  "maid_room": "غرفة خادمة", "driver_room": "غرفة سائق",
};

export default function PropertyDetail() {
  const { t, lang, dir } = useI18n();
  const { isAuthenticated } = useAuth();
  const [, params] = useRoute("/property/:id");
  const [, setLocation] = useLocation();
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const mapRef = useRef<MapInstance | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const id = Number(params?.id);
  const property = trpc.property.getById.useQuery({ id }, { enabled: !!id });
  const reviews = trpc.property.getReviews.useQuery({ propertyId: id }, { enabled: !!id });
  // Fetch calculator config to check if insurance should be hidden from tenant
  const calcConfig = trpc.calculator.getConfig.useQuery(undefined, { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false });
  const favCheck = trpc.favorite.check.useQuery({ propertyId: id }, { enabled: isAuthenticated && !!id });
  const toggleFav = trpc.favorite.toggle.useMutation({
    onSuccess: () => {
      trpc.useUtils().favorite.check.invalidate({ propertyId: id });
    },
  });

  const { get: siteSetting } = useSiteSettings();
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [inspectionDate, setInspectionDate] = useState("");
  const [inspectionTime, setInspectionTime] = useState("");
  const [inspectionName, setInspectionName] = useState("");
  const [inspectionPhone, setInspectionPhone] = useState("");
  const [inspectionNotes, setInspectionNotes] = useState("");

  const createInspection = trpc.inspection.create.useMutation({
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم إرسال طلب المعاينة بنجاح" : "Inspection request submitted successfully");
      setInspectionOpen(false);
      setInspectionDate(""); setInspectionTime(""); setInspectionNotes("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const timeSlots = useMemo(() => {
    try {
      const raw = siteSetting("inspection.timeSlots", '["09:00-10:00","10:00-11:00","11:00-12:00","14:00-15:00","15:00-16:00","16:00-17:00"]');
      return JSON.parse(raw) as string[];
    } catch { return ["09:00-10:00","10:00-11:00","14:00-15:00","15:00-16:00"]; }
  }, [siteSetting]);

  const prop = property.data;

  // Map ready handler - works with both Google Maps and Leaflet
  const handleMapReady = useCallback((mapInst: MapInstance) => {
    if (!prop) return;
    mapRef.current = mapInst;
    const lat = prop.latitude ? Number(prop.latitude) : 24.7136;
    const lng = prop.longitude ? Number(prop.longitude) : 46.6753;

    const titleText = lang === "ar" ? prop.titleAr : prop.titleEn;
    const cityText = lang === "ar" ? prop.cityAr : prop.city;
    const districtText = lang === "ar" ? prop.districtAr : prop.district;
    const locationText = districtText ? `${districtText}، ${cityText}` : cityText;
    const rentText = `${Number(prop.monthlyRent).toLocaleString()} ${lang === "ar" ? "ر.س" : "SAR"}`;
    const monthLabel = lang === "ar" ? "شهرياً" : "/month";
    const bedsLabel = lang === "ar" ? "غرف" : "beds";
    const bathsLabel = lang === "ar" ? "حمام" : "baths";
    const sqmLabel = lang === "ar" ? "م²" : "sqm";

    const popupContent = `
      <div style="font-family:'Tajawal',sans-serif;direction:${dir};padding:8px;min-width:220px;max-width:300px;">
        <div style="font-weight:700;font-size:15px;color:#0B1E2D;margin-bottom:4px;">${titleText || ""}</div>
        <div style="font-size:12px;color:#666;margin-bottom:8px;display:flex;align-items:center;gap:4px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3ECFC0" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${locationText || ""}
        </div>
        <div style="display:flex;gap:12px;font-size:12px;color:#555;margin-bottom:8px;">
          ${prop.bedrooms != null ? `<span>🛏 ${prop.bedrooms} ${bedsLabel}</span>` : ""}
          ${prop.bathrooms != null ? `<span>🚿 ${prop.bathrooms} ${bathsLabel}</span>` : ""}
          ${prop.sizeSqm != null ? `<span>📐 ${prop.sizeSqm} ${sqmLabel}</span>` : ""}
        </div>
        <div style="background:linear-gradient(135deg,#0B1E2D,#132d42);color:#3ECFC0;padding:8px 12px;border-radius:8px;text-align:center;">
          <span style="font-size:18px;font-weight:700;">${rentText}</span>
          <span style="font-size:11px;color:#8ecfc4;margin-${dir === "rtl" ? "right" : "left"}:4px;">${monthLabel}</span>
        </div>
      </div>
    `;

    // Add marker with popup using unified interface
    const marker = mapInst.addMarker(lat, lng, {
      color: "#3ECFC0",
      label: rentText,
      title: titleText || "",
    });
    mapInst.addPopup(marker, popupContent);
  }, [prop, lang, dir]);

  if (property.isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <SEOHead title="Property Details" titleAr="تفاصيل العقار" description="View property details, photos, amenities and book monthly rental in Saudi Arabia" path="/property" />
        <Navbar />
        <div className="container pt-3 pb-4 sm:py-8 space-y-6 flex-1">
          <Skeleton className="h-[300px] sm:h-[400px] rounded-lg sm:rounded-xl" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>
    );
  }

  if (!prop) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <SEOHead title="Property Details" titleAr="تفاصيل العقار" description="View property details, photos, amenities and book monthly rental in Saudi Arabia" path="/property" />
        <Navbar />
        <div className="container pt-3 pb-4 sm:py-20 text-center flex-1">
          <p className="text-muted-foreground mt-16">{lang === "ar" ? "العقار غير موجود" : "Property not found"}</p>
          <Button className="mt-4" onClick={() => setLocation("/search")}>{t("common.back")}</Button>
        </div>
        <Footer />
      </div>
    );
  }

  const title = lang === "ar" ? prop.titleAr : prop.titleEn;
  const description = lang === "ar" ? prop.descriptionAr : prop.descriptionEn;
  const city = lang === "ar" ? prop.cityAr : prop.city;
  const district = lang === "ar" ? prop.districtAr : prop.district;
  // Helper: proxy external URLs through our server
  const proxyUrl = (url: string) => {
    if (!url || url.startsWith("/") || url.startsWith("data:")) return url;
    return `/api/img-proxy?url=${encodeURIComponent(url)}`;
  };
  // Filter out broken /uploads/ URLs, proxy the rest
  const validPhotos = (prop.photos || []).filter((url: string) => url && url.startsWith("http") && !url.includes("/uploads/")).map(proxyUrl);
  const photos = validPhotos.length ? validPhotos : [
    proxyUrl("https://files.manuscdn.com/user_upload_by_module/session_file/310519663340926600/sKmnJUKXqXLRtgLT.jpg"),
    proxyUrl("https://files.manuscdn.com/user_upload_by_module/session_file/310519663340926600/aQahktKcFBRaoOks.jpg"),
    proxyUrl("https://files.manuscdn.com/user_upload_by_module/session_file/310519663340926600/mONAuqBKEeQxVXtD.jpg"),
  ];

  const lat = prop.latitude ? Number(prop.latitude) : 24.7136;
  const lng = prop.longitude ? Number(prop.longitude) : 46.6753;

  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SEOHead title="Property Details" titleAr="تفاصيل العقار" description="View property details, photos, amenities and book monthly rental in Saudi Arabia" path="/property" />
      <Navbar />

      <div className="container pt-3 pb-4 sm:py-6 flex-1">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => setLocation("/search")} className="mb-3 sm:mb-4">
          <BackArrow className="h-4 w-4 me-1.5" />
          {t("common.back")}
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Photo gallery — touch swipe enabled; buttons use data-action to bypass swipe */}
            <div
              className="relative rounded-lg sm:rounded-xl overflow-hidden aspect-[16/10] cursor-pointer bg-muted"
              onTouchStart={(e) => {
                // Skip swipe tracking if touch started on an action button
                const el = e.target as HTMLElement;
                if (el.closest('[data-action]')) return;
                touchStartX.current = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                // Skip if touch started on action button or no start recorded
                const el = e.target as HTMLElement;
                if (el.closest('[data-action]')) return;
                if (touchStartX.current === null) return;
                const dx = e.changedTouches[0].clientX - touchStartX.current;
                const threshold = 50;
                if (Math.abs(dx) > threshold) {
                  if (dir === "rtl" ? dx > 0 : dx < 0) {
                    setCurrentPhoto(p => (p + 1) % photos.length);
                  } else {
                    setCurrentPhoto(p => (p - 1 + photos.length) % photos.length);
                  }
                } else {
                  setLightboxOpen(true);
                }
                touchStartX.current = null;
              }}
            >
              <img
                src={photos[currentPhoto]}
                alt={title}
                loading="eager"
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-[1.02]"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.dataset.fallback) {
                    target.dataset.fallback = "1";
                    target.src = `/api/img-proxy?url=${encodeURIComponent("https://files.manuscdn.com/user_upload_by_module/session_file/310519663340926600/sKmnJUKXqXLRtgLT.jpg")}`;
                  }
                }}
              />
              {/* Photo count badge */}
              <div className="absolute bottom-3 end-3 text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 z-10" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', color: '#ffffff' }}>
                <Eye className="h-3 w-3" />
                {currentPhoto + 1} / {photos.length}
              </div>
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentPhoto(p => (p - 1 + photos.length) % photos.length)}
                    data-action="true"
                    className="absolute start-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', color: '#1f2937' }}
                  >
                    {dir === "rtl" ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={() => setCurrentPhoto(p => (p + 1) % photos.length)}
                    data-action="true"
                    className="absolute end-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', color: '#1f2937' }}
                  >
                    {dir === "rtl" ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </button>
                  <div className="absolute bottom-3 start-1/2 -translate-x-1/2 flex gap-1.5">
                    {photos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPhoto(i)}
                        className={`h-2 rounded-full transition-all ${i === currentPhoto ? "w-6" : "w-2"}`}
                        style={{ backgroundColor: i === currentPhoto ? '#ffffff' : 'rgba(255,255,255,0.5)' }}
                      />
                    ))}
                  </div>
                </>
              )}
              {/* Actions — two small circular buttons, top-end, consistent light/dark */}
              <div className="absolute top-2 sm:top-3 end-2 sm:end-3 z-30 flex items-center gap-1.5 pointer-events-auto" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }} data-action="true">
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!isAuthenticated) { toast.error(lang === "ar" ? "يرجى تسجيل الدخول" : "Please sign in"); return; } toggleFav.mutate({ propertyId: id }); }}
                  onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); if (!isAuthenticated) { toast.error(lang === "ar" ? "يرجى تسجيل الدخول" : "Please sign in"); return; } toggleFav.mutate({ propertyId: id }); }}
                  className="h-11 w-11 rounded-full flex items-center justify-center active:scale-90 transition-all touch-manipulation"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--background, #fff) 85%, transparent)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}
                  aria-label={lang === "ar" ? "إضافة للمفضلة" : "Add to favorites"}
                >
                  <Heart className={`h-4 w-4 ${favCheck.data?.isFavorite ? "fill-red-500 text-red-500" : "text-foreground/70"}`} />
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (navigator.share) { navigator.share({ title: document.title, url: window.location.href }).catch(() => {}); } else { navigator.clipboard.writeText(window.location.href); toast.success(lang === "ar" ? "تم نسخ الرابط" : "Link copied"); } }}
                  onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); if (navigator.share) { navigator.share({ title: document.title, url: window.location.href }).catch(() => {}); } else { navigator.clipboard.writeText(window.location.href); toast.success(lang === "ar" ? "تم نسخ الرابط" : "Link copied"); } }}
                  className="h-11 w-11 rounded-full flex items-center justify-center active:scale-90 transition-all touch-manipulation"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--background, #fff) 85%, transparent)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}
                  aria-label={lang === "ar" ? "مشاركة العقار" : "Share property"}
                >
                  <Share2 className="h-4 w-4 text-foreground/70" />
                </button>
              </div>
              {/* Badges */}
              <div className="absolute top-[max(1rem,calc(1rem+env(safe-area-inset-top)))] sm:top-3 start-4 sm:start-3 flex gap-2">
                {prop.isVerified && (
                  <Badge className="bg-primary text-primary-foreground gap-1">
                    <CheckCircle className="h-3 w-3" /> {t("property.verified")}
                  </Badge>
                )}
              </div>
            </div>
            {/* Thumbnail strip */}
            {photos.length > 1 && (
              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-thin -mx-1 px-1">
                {photos.map((photo, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPhoto(i)}
                    className={`shrink-0 w-16 h-12 sm:w-20 sm:h-14 rounded-lg overflow-hidden border-2 transition-all duration-300 ${
                      i === currentPhoto
                        ? "border-[#3ECFC0] shadow-md shadow-[#3ECFC0]/20 scale-105"
                        : "border-transparent opacity-60 hover:opacity-100 hover:border-border"
                    }`}
                  >
                    <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
            {/* Lightbox */}
            <MediaLightbox
              items={photos.map(url => ({ url, type: "image" as const }))}
              initialIndex={currentPhoto}
              open={lightboxOpen}
              onClose={() => setLightboxOpen(false)}
            />

            {/* Title & Location */}
            <div className="bg-background">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Badge variant="secondary" className="mb-2">{t(`type.${prop.propertyType}` as any)}</Badge>
                  <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">{title}</h1>
                </div>
                {reviews.data && reviews.data.avgRating > 0 && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Star className="h-5 w-5 fill-[#C9A96E] text-[#C9A96E]" />
                    <span className="font-semibold">{Number(reviews.data.avgRating).toFixed(1)}</span>
                    <span className="text-muted-foreground text-sm">({reviews.data.reviews.length})</span>
                  </div>
                )}
              </div>
              {(city || district) && (
                <div className="flex items-center gap-1 text-muted-foreground mt-2">
                  <MapPin className="h-4 w-4" />
                  <span>{district && `${district}، `}{city}</span>
                </div>
              )}
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {prop.bedrooms != null && (
                <Card><CardContent className="p-4 flex items-center gap-3">
                  <BedDouble className="h-5 w-5 text-primary" />
                  <div><div className="text-sm text-muted-foreground">{t("search.bedrooms")}</div><div className="font-semibold text-foreground">{prop.bedrooms}</div></div>
                </CardContent></Card>
              )}
              {prop.bathrooms != null && (
                <Card><CardContent className="p-4 flex items-center gap-3">
                  <Bath className="h-5 w-5 text-primary" />
                  <div><div className="text-sm text-muted-foreground">{t("search.bathrooms")}</div><div className="font-semibold text-foreground">{prop.bathrooms}</div></div>
                </CardContent></Card>
              )}
              {prop.sizeSqm != null && (
                <Card><CardContent className="p-4 flex items-center gap-3">
                  <Maximize2 className="h-5 w-5 text-primary" />
                  <div><div className="text-sm text-muted-foreground">{t("property.size")}</div><div className="font-semibold text-foreground">{prop.sizeSqm} {t("property.sqm")}</div></div>
                </CardContent></Card>
              )}
              {prop.floor != null && (
                <Card><CardContent className="p-4 flex items-center gap-3">
                  <Building className="h-5 w-5 text-primary" />
                  <div><div className="text-sm text-muted-foreground">{t("property.floor")}</div><div className="font-semibold text-foreground">{prop.floor}</div></div>
                </CardContent></Card>
              )}
            </div>

            {/* Description */}
            {description && (
              <Card>
                <CardHeader><CardTitle>{t("property.description")}</CardTitle></CardHeader>
                <CardContent><p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{description}</p></CardContent>
              </Card>
            )}

            {/* Amenities */}
            {prop.amenities && prop.amenities.length > 0 && (
              <Card>
                <CardHeader><CardTitle>{t("property.amenities")}</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {prop.amenities.map((amenity: string, i: number) => {
                      const key = amenity.toLowerCase();
                      const Icon = amenityIcons[key] || CheckCircle;
                      const label = lang === "ar" ? (amenityAr[key] || amenity) : amenity;
                      return (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <Icon className="h-4 w-4 text-primary shrink-0" />
                          <span>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Map with property info */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" />{t("property.location")}</CardTitle></CardHeader>
              <CardContent>
                <MapView
                  className="h-[350px] rounded-lg"
                  initialCenter={{ lat, lng }}
                  initialZoom={15}
                  onMapReady={handleMapReady}
                />
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <span>{district && `${district}، `}{city}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5 border-[#3ECFC0]/40 text-[#3ECFC0] hover:bg-[#3ECFC0]/10"
                    onClick={() => {
                      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                      const url = isIOS
                        ? `maps://maps.apple.com/?daddr=${lat},${lng}`
                        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                      window.open(url, "_blank");
                    }}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {lang === "ar" ? "الاتجاهات" : "Directions"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Reviews Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-[#C9A96E]" />
                    {lang === "ar" ? "التقييمات والمراجعات" : "Ratings & Reviews"}
                  </span>
                  {reviews.data && reviews.data.avgRating > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-2xl font-bold">{Number(reviews.data.avgRating).toFixed(1)}</span>
                      <div className="flex">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} className={`h-4 w-4 ${s <= Math.round(Number(reviews.data?.avgRating ?? 0)) ? 'fill-[#C9A96E] text-[#C9A96E]' : 'text-muted-foreground/30'}`} />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">({reviews.data.reviews.length})</span>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reviews.data && reviews.data.reviews.length > 0 ? (
                  <div className="space-y-4">
                    {reviews.data.reviews.map((r: any) => (
                      <div key={r.id} className="p-4 rounded-lg bg-muted/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {r.tenantAvatar ? (
                              <img src={r.tenantAvatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-[#3ECFC0]/20 flex items-center justify-center text-sm font-bold text-[#3ECFC0]">
                                {(lang === "ar" ? (r.tenantNameAr || r.tenantName) : r.tenantName)?.charAt(0) ?? "?"}
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-sm text-foreground">{lang === "ar" ? (r.tenantNameAr || r.tenantName) : r.tenantName}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(r.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { year: "numeric", month: "short", day: "numeric" })}
                              </p>
                            </div>
                          </div>
                          <div className="flex">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} className={`h-3.5 w-3.5 ${s <= r.rating ? 'fill-[#C9A96E] text-[#C9A96E]' : 'text-muted-foreground/30'}`} />
                            ))}
                          </div>
                        </div>
                        {(lang === "ar" ? (r.commentAr || r.comment) : r.comment) && (
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {lang === "ar" ? (r.commentAr || r.comment) : r.comment}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Star className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p>{lang === "ar" ? "لا توجد تقييمات بعد" : "No reviews yet"}</p>
                    <p className="text-xs mt-1">{lang === "ar" ? "كن أول من يقيم هذا العقار" : "Be the first to review this property"}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-20 space-y-4">

              {/* Booking Card — hidden when calculator is open */}
              {!showCalculator && (
                <Card className="shadow-lg">
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold text-primary font-heading">
                        {Number(prop.monthlyRent).toLocaleString()} {t("payment.sar")}
                      </div>
                      <span className="text-muted-foreground text-sm">{t("property.perMonth")}</span>
                    </div>

                    <Separator />

                    {/* Hide security deposit when admin has enabled insurance hiding */}
                    {prop.securityDeposit && !calcConfig.data?.hideInsuranceFromTenant && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("property.securityDeposit")}</span>
                        <span className="font-medium text-foreground">{Number(prop.securityDeposit).toLocaleString()} {t("payment.sar")}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{lang === "ar" ? "الحد الأدنى للإقامة" : "Min Stay"}</span>
                      <span className="font-medium text-foreground">1 {lang === "ar" ? "شهر" : "Month"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{lang === "ar" ? "الحد الأقصى للإقامة" : "Max Stay"}</span>
                      <span className="font-medium text-foreground">2 {lang === "ar" ? "أشهر" : "Months"}</span>
                    </div>

                    {prop.furnishedLevel && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("search.furnished")}</span>
                        <span className="font-medium text-foreground">{t(`search.${prop.furnishedLevel}` as any)}</span>
                      </div>
                    )}

                    <Separator />

                    <Button
                      className="w-full bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] btn-animate border-0 font-semibold"
                      size="lg"
                      onClick={() => {
                        if (!isAuthenticated) { toast.error(lang === "ar" ? "يرجى تسجيل الدخول أولاً" : "Please sign in first"); return; }
                        setLocation(`/book/${id}`);
                      }}
                    >
                      {prop.instantBook ? t("property.bookNow") : t("property.requestBooking")}
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        if (!isAuthenticated) { toast.error(lang === "ar" ? "يرجى تسجيل الدخول أولاً" : "Please sign in first"); return; }
                        setLocation(`/messages?to=${prop.landlordId}&property=${id}`);
                      }}
                    >
                      <MessageSquare className="h-4 w-4 me-2" />
                      {t("property.contactLandlord")}
                    </Button>

                    {/* Inspection Request Button */}
                    <Dialog open={inspectionOpen} onOpenChange={setInspectionOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full border-[#3ECFC0]/40 text-[#3ECFC0] hover:bg-[#3ECFC0]/10">
                          <Eye className="h-4 w-4 me-2" />
                          {lang === "ar" ? "طلب معاينة" : "Request Inspection"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md" dir={dir}>
                        <DialogHeader>
                          <DialogTitle className="font-heading">
                            {lang === "ar" ? "طلب معاينة العقار" : "Request Property Inspection"}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>{lang === "ar" ? "الاسم الكامل" : "Full Name"}</Label>
                            <Input value={inspectionName} onChange={(e) => setInspectionName(e.target.value)} placeholder={lang === "ar" ? "أدخل اسمك" : "Enter your name"} />
                          </div>
                          <div className="space-y-2">
                            <Label>{lang === "ar" ? "رقم الهاتف" : "Phone Number"}</Label>
                            <Input value={inspectionPhone} onChange={(e) => setInspectionPhone(e.target.value)} placeholder="05xxxxxxxx" dir="ltr" />
                          </div>
                          <div className="space-y-2">
                            <Label>{lang === "ar" ? "تاريخ المعاينة" : "Inspection Date"}</Label>
                            <Input type="date" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} min={new Date().toISOString().split('T')[0]} dir="ltr" />
                          </div>
                          <div className="space-y-2">
                            <Label>{lang === "ar" ? "الوقت المفضل" : "Preferred Time"}</Label>
                            <Select value={inspectionTime} onValueChange={setInspectionTime}>
                              <SelectTrigger><SelectValue placeholder={lang === "ar" ? "اختر الوقت" : "Select time"} /></SelectTrigger>
                              <SelectContent>
                                {timeSlots.map(slot => (
                                  <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>{lang === "ar" ? "ملاحظات" : "Notes"}</Label>
                            <Textarea value={inspectionNotes} onChange={(e) => setInspectionNotes(e.target.value)} placeholder={lang === "ar" ? "أي ملاحظات إضافية..." : "Any additional notes..."} />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            className="w-full bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] font-semibold"
                            disabled={createInspection.isPending || !inspectionDate || !inspectionTime || !inspectionName || !inspectionPhone}
                            onClick={() => {
                              createInspection.mutate({
                                propertyId: id,
                                requestedDate: inspectionDate,
                                requestedTimeSlot: inspectionTime,
                                fullName: inspectionName,
                                phone: inspectionPhone,
                                notes: inspectionNotes,
                              });
                            }}
                          >
                            {createInspection.isPending 
                              ? (lang === "ar" ? "جاري الإرسال..." : "Submitting...") 
                              : (lang === "ar" ? "إرسال طلب المعاينة" : "Submit Inspection Request")}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Calculator Toggle Button */}
                    <Button
                      variant="outline"
                      className="w-full border-[#C9A96E]/40 text-[#C9A96E] hover:bg-[#C9A96E]/10"
                      onClick={() => setShowCalculator(true)}
                    >
                      <Calculator className="h-4 w-4 me-2" />
                      {lang === "ar" ? "حاسبة التكاليف" : "Cost Calculator"}
                    </Button>

                    {/* WhatsApp CTA — config-driven */}
                    {siteSetting("whatsapp.enabled", "false") === "true" && siteSetting("whatsapp.number") && (
                      <a
                        href={buildWhatsAppUrl(
                          siteSetting("whatsapp.number"),
                          buildPropertyMessage(
                            lang === "ar"
                              ? siteSetting("whatsapp.propertyMessageTemplateAr", "مرحباً، أنا مهتم بالعقار: {{property_title}} (رقم: {{property_id}}) في {{city}}. الرابط: {{url}}")
                              : siteSetting("whatsapp.propertyMessageTemplateEn", "Hello, I'm interested in: {{property_title}} (ID: {{property_id}}) in {{city}}. Link: {{url}}"),
                            {
                              title: title || "",
                              id: prop.id,
                              city: city || "",
                              url: window.location.href,
                            }
                          )
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full rounded-lg py-2.5 text-sm font-medium text-white bg-[#25D366] hover:bg-[#20bd5a] transition-colors"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        {lang === "ar"
                          ? siteSetting("whatsapp.textAr", "تواصل معنا")
                          : siteSetting("whatsapp.textEn", "Chat with us")}
                      </a>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Finance Calculator — backend-driven component */}
              {showCalculator && (
                <CostCalculator
                  monthlyRent={Number(prop.monthlyRent)}
                  propertyTitle={lang === "ar" ? prop.titleAr : prop.titleEn}
                  onClose={() => setShowCalculator(false)}
                  onBook={() => {
                    if (!isAuthenticated) { toast.error(lang === "ar" ? "يرجى تسجيل الدخول أولاً" : "Please sign in first"); return; }
                    setLocation(`/book/${id}`);
                  }}
                  bookLabel={prop.instantBook ? t("property.bookNow") : t("property.requestBooking")}
                />
              )}

              {/* Property Manager Card */}
              {(prop as any).manager && (
                <Card className="shadow-md border-[#3ECFC0]/20">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4 mb-3">
                      {(prop as any).manager.photoUrl ? (
                        <img src={(prop as any).manager.photoUrl} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-[#3ECFC0]/30" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
                      ) : null}
                      <div className={`w-14 h-14 rounded-full bg-gradient-to-br from-[#3ECFC0] to-[#2ab5a6] flex items-center justify-center text-white font-bold text-lg select-none ${(prop as any).manager.photoUrl ? 'hidden' : ''}`}>
                        {((prop as any).manager.name || '').split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || 'PM'}
                      </div>
                      <div>
                        <h4 className="font-semibold font-heading text-foreground">
                          {lang === "ar" ? ((prop as any).manager.nameAr || (prop as any).manager.name) : (prop as any).manager.name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {lang === "ar" ? ((prop as any).manager.titleAr || "مدير العقار") : ((prop as any).manager.title || "Property Manager")}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {(prop as any).manager.phone && (
                        <a href={`tel:${(prop as any).manager.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#3ECFC0] transition-colors">
                          <Phone className="h-4 w-4" />
                          <span dir="ltr">{(prop as any).manager.phone}</span>
                        </a>
                      )}
                      {(prop as any).manager.whatsapp && (
                        <a href={`https://wa.me/${(prop as any).manager.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-green-500 transition-colors">
                          <MessageSquare className="h-4 w-4" />
                          <span>{lang === "ar" ? "تواصل عبر واتساب" : "Chat on WhatsApp"}</span>
                        </a>
                      )}
                    </div>
                    <a href={`/agent/${(prop as any).manager.id}`} className="mt-3 block text-center text-sm text-[#3ECFC0] hover:underline">
                      {lang === "ar" ? "عرض الملف الشخصي" : "View Profile"}
                    </a>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom spacer for mobile FABs (WhatsApp + AI buttons) */}
      <div className="h-28 sm:h-0" />
      <Footer />
    </div>
  );
}
