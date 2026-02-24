import SEOHead from "@/components/SEOHead";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { MapView } from "@/components/Map";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import {
  Heart, Share2, MapPin, BedDouble, Bath, Maximize2, Building, Calendar,
  CheckCircle, Star, MessageSquare, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight,
  Wifi, Car, Dumbbell, Shield, Wind, Droplets, Zap, Flame, Tv, Shirt,
  Phone, UserCog, Clock, Eye, Calculator, X, TrendingUp, Percent, DollarSign
} from "lucide-react";
import { useState, useRef, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
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
  const mapRef = useRef<L.Map | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcMonths, setCalcMonths] = useState(1);

  const id = Number(params?.id);
  const property = trpc.property.getById.useQuery({ id }, { enabled: !!id });
  const reviews = trpc.property.getReviews.useQuery({ propertyId: id }, { enabled: !!id });
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

  // Finance calculator values
  const serviceFeePercent = Number(siteSetting("fees.serviceFeePercent", "5"));
  const vatPercent = Number(siteSetting("fees.vatPercent", "15"));
  const depositPercent = Number(siteSetting("fees.depositPercent", "10"));

  const prop = property.data;

  // Calculator computations
  const calcData = useMemo(() => {
    if (!prop) return null;
    const rent = Number(prop.monthlyRent);
    const totalRent = rent * calcMonths;
    const deposit = rent * (depositPercent / 100);
    const serviceFee = totalRent * (serviceFeePercent / 100);
    const subtotal = totalRent + deposit + serviceFee;
    const vat = subtotal * (vatPercent / 100);
    const grandTotal = subtotal + vat;
    return { rent, totalRent, deposit, serviceFee, subtotal, vat, grandTotal };
  }, [prop, calcMonths, serviceFeePercent, vatPercent, depositPercent]);

  // Map ready handler with Leaflet popup
  const handleMapReady = useCallback((map: L.Map) => {
    if (!prop) return;
    mapRef.current = map;
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

    // Add Leaflet marker with popup
    const marker = L.marker([lat, lng]).addTo(map);
    marker.bindPopup(popupContent, { maxWidth: 300 }).openPopup();
  }, [prop, lang, dir]);

  if (property.isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <SEOHead title="Property Details" titleAr="تفاصيل العقار" description="View property details, photos, amenities and book monthly rental in Saudi Arabia" path="/property" />
        <Navbar />
        <div className="container py-8 space-y-6">
          <Skeleton className="h-[400px] rounded-xl" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>
    );
  }

  if (!prop) {
    return (
      <div className="min-h-screen flex flex-col">
        <SEOHead title="Property Details" titleAr="تفاصيل العقار" description="View property details, photos, amenities and book monthly rental in Saudi Arabia" path="/property" />
        <Navbar />
        <div className="container py-20 text-center">
          <p className="text-muted-foreground">{lang === "ar" ? "العقار غير موجود" : "Property not found"}</p>
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
  const photos = prop.photos?.length ? prop.photos : [
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800&h=600&fit=crop",
  ];

  const lat = prop.latitude ? Number(prop.latitude) : 24.7136;
  const lng = prop.longitude ? Number(prop.longitude) : 46.6753;

  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead title="Property Details" titleAr="تفاصيل العقار" description="View property details, photos, amenities and book monthly rental in Saudi Arabia" path="/property" />
      <Navbar />

      <div className="container py-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => setLocation("/search")} className="mb-4">
          <BackArrow className="h-4 w-4 me-1.5" />
          {t("common.back")}
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Photo gallery */}
            <div className="relative rounded-xl overflow-hidden aspect-[16/10]">
              <img
                src={photos[currentPhoto]}
                alt={title}
                className="w-full h-full object-cover"
              />
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentPhoto(p => (p - 1 + photos.length) % photos.length)}
                    className="absolute start-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center hover:bg-white"
                  >
                    {dir === "rtl" ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={() => setCurrentPhoto(p => (p + 1) % photos.length)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center hover:bg-white"
                  >
                    {dir === "rtl" ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </button>
                  <div className="absolute bottom-3 start-1/2 -translate-x-1/2 flex gap-1.5">
                    {photos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPhoto(i)}
                        className={`h-2 rounded-full transition-all ${i === currentPhoto ? "w-6 bg-white" : "w-2 bg-white/50"}`}
                      />
                    ))}
                  </div>
                </>
              )}
              {/* Actions */}
              <div className="absolute top-3 end-3 flex gap-2">
                <button
                  onClick={() => {
                    if (!isAuthenticated) { toast.error(lang === "ar" ? "يرجى تسجيل الدخول" : "Please sign in"); return; }
                    toggleFav.mutate({ propertyId: id });
                  }}
                  className="h-10 w-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center hover:bg-white"
                >
                  <Heart className={`h-5 w-5 ${favCheck.data?.isFavorite ? "fill-destructive text-destructive" : ""}`} />
                </button>
                <button
                  onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success(lang === "ar" ? "تم نسخ الرابط" : "Link copied"); }}
                  className="h-10 w-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center hover:bg-white"
                >
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
              {/* Badges */}
              <div className="absolute top-3 start-3 flex gap-2">
                {prop.isVerified && (
                  <Badge className="bg-primary text-primary-foreground gap-1">
                    <CheckCircle className="h-3 w-3" /> {t("property.verified")}
                  </Badge>
                )}
              </div>
            </div>

            {/* Title & Location */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Badge variant="secondary" className="mb-2">{t(`type.${prop.propertyType}` as any)}</Badge>
                  <h1 className="text-2xl font-heading font-bold">{title}</h1>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {prop.bedrooms != null && (
                <Card><CardContent className="p-4 flex items-center gap-3">
                  <BedDouble className="h-5 w-5 text-primary" />
                  <div><div className="text-sm text-muted-foreground">{t("search.bedrooms")}</div><div className="font-semibold">{prop.bedrooms}</div></div>
                </CardContent></Card>
              )}
              {prop.bathrooms != null && (
                <Card><CardContent className="p-4 flex items-center gap-3">
                  <Bath className="h-5 w-5 text-primary" />
                  <div><div className="text-sm text-muted-foreground">{t("search.bathrooms")}</div><div className="font-semibold">{prop.bathrooms}</div></div>
                </CardContent></Card>
              )}
              {prop.sizeSqm != null && (
                <Card><CardContent className="p-4 flex items-center gap-3">
                  <Maximize2 className="h-5 w-5 text-primary" />
                  <div><div className="text-sm text-muted-foreground">{t("property.size")}</div><div className="font-semibold">{prop.sizeSqm} {t("property.sqm")}</div></div>
                </CardContent></Card>
              )}
              {prop.floor != null && (
                <Card><CardContent className="p-4 flex items-center gap-3">
                  <Building className="h-5 w-5 text-primary" />
                  <div><div className="text-sm text-muted-foreground">{t("property.floor")}</div><div className="font-semibold">{prop.floor}</div></div>
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
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <span>{district && `${district}، `}{city}</span>
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
                              <p className="font-medium text-sm">{lang === "ar" ? (r.tenantNameAr || r.tenantName) : r.tenantName}</p>
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
            <div className="sticky top-20 space-y-4">

              {/* Booking Card — hidden when calculator is open */}
              {!showCalculator && (
                <Card className="shadow-lg">
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <div className="text-3xl font-bold text-primary font-heading">
                        {Number(prop.monthlyRent).toLocaleString()} {t("payment.sar")}
                      </div>
                      <span className="text-muted-foreground text-sm">{t("property.perMonth")}</span>
                    </div>

                    <Separator />

                    {prop.securityDeposit && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("property.securityDeposit")}</span>
                        <span className="font-medium">{Number(prop.securityDeposit).toLocaleString()} {t("payment.sar")}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{lang === "ar" ? "الحد الأدنى للإقامة" : "Min Stay"}</span>
                      <span className="font-medium">1 {lang === "ar" ? "شهر" : "Month"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{lang === "ar" ? "الحد الأقصى للإقامة" : "Max Stay"}</span>
                      <span className="font-medium">2 {lang === "ar" ? "أشهر" : "Months"}</span>
                    </div>

                    {prop.furnishedLevel && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("search.furnished")}</span>
                        <span className="font-medium">{t(`search.${prop.furnishedLevel}` as any)}</span>
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
                  </CardContent>
                </Card>
              )}

              {/* Finance Calculator — shown when toggled, replaces booking card */}
              {showCalculator && calcData && (
                <Card className="shadow-lg border-[#C9A96E]/30 overflow-hidden">
                  {/* Calculator Header */}
                  <div className="bg-gradient-to-r from-[#0B1E2D] to-[#132d42] p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-white">
                        <Calculator className="h-5 w-5 text-[#C9A96E]" />
                        <span className="font-heading font-bold text-lg">
                          {lang === "ar" ? "حاسبة التكاليف" : "Cost Calculator"}
                        </span>
                      </div>
                      <button
                        onClick={() => setShowCalculator(false)}
                        className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                      >
                        <X className="h-4 w-4 text-white" />
                      </button>
                    </div>
                    <p className="text-white/60 text-xs mt-1">
                      {lang === "ar" ? "احسب التكلفة الإجمالية للإيجار" : "Calculate your total rental cost"}
                    </p>
                  </div>

                  <CardContent className="p-5 space-y-5">
                    {/* Monthly Rent Display */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-[#3ECFC0]/10 border border-[#3ECFC0]/20">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-[#3ECFC0]" />
                        <span className="text-sm font-medium">{lang === "ar" ? "الإيجار الشهري" : "Monthly Rent"}</span>
                      </div>
                      <span className="font-bold text-[#3ECFC0]">{calcData.rent.toLocaleString()} {lang === "ar" ? "ر.س" : "SAR"}</span>
                    </div>

                    {/* Duration Slider */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-1.5 text-sm">
                          <Calendar className="h-4 w-4 text-[#C9A96E]" />
                          {lang === "ar" ? "مدة الإيجار" : "Rental Duration"}
                        </Label>
                        <Badge variant="secondary" className="bg-[#C9A96E]/10 text-[#C9A96E] border-[#C9A96E]/20">
                          {calcMonths} {calcMonths === 1 ? (lang === "ar" ? "شهر" : "month") : (lang === "ar" ? "أشهر" : "months")}
                        </Badge>
                      </div>
                      <Slider
                        value={[calcMonths]}
                        onValueChange={(v) => setCalcMonths(v[0])}
                        min={1}
                        max={12}
                        step={1}
                        className="py-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>1 {lang === "ar" ? "شهر" : "mo"}</span>
                        <span>6 {lang === "ar" ? "أشهر" : "mo"}</span>
                        <span>12 {lang === "ar" ? "شهر" : "mo"}</span>
                      </div>
                    </div>

                    <Separator />

                    {/* Cost Breakdown */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        {lang === "ar" ? "تفاصيل التكلفة" : "Cost Breakdown"}
                      </h4>

                      <div className="space-y-2.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {lang === "ar" ? `الإيجار (${calcMonths} ${calcMonths === 1 ? "شهر" : "أشهر"})` : `Rent (${calcMonths} ${calcMonths === 1 ? "month" : "months"})`}
                          </span>
                          <span className="font-medium">{calcData.totalRent.toLocaleString()} {lang === "ar" ? "ر.س" : "SAR"}</span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            {lang === "ar" ? `التأمين (${depositPercent}%)` : `Deposit (${depositPercent}%)`}
                          </span>
                          <span className="font-medium">{calcData.deposit.toLocaleString()} {lang === "ar" ? "ر.س" : "SAR"}</span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            {lang === "ar" ? `رسوم الخدمة (${serviceFeePercent}%)` : `Service Fee (${serviceFeePercent}%)`}
                          </span>
                          <span className="font-medium">{calcData.serviceFee.toLocaleString()} {lang === "ar" ? "ر.س" : "SAR"}</span>
                        </div>

                        <Separator className="my-1" />

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{lang === "ar" ? "المجموع الفرعي" : "Subtotal"}</span>
                          <span className="font-medium">{calcData.subtotal.toLocaleString()} {lang === "ar" ? "ر.س" : "SAR"}</span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Percent className="h-3 w-3" />
                            {lang === "ar" ? `ضريبة القيمة المضافة (${vatPercent}%)` : `VAT (${vatPercent}%)`}
                          </span>
                          <span className="font-medium">{calcData.vat.toLocaleString(undefined, { maximumFractionDigits: 0 })} {lang === "ar" ? "ر.س" : "SAR"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Grand Total */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-[#0B1E2D] to-[#132d42] text-white">
                      <div className="flex items-center justify-between">
                        <span className="text-white/80 text-sm">{lang === "ar" ? "الإجمالي الكلي" : "Grand Total"}</span>
                        <div className="text-end">
                          <div className="text-2xl font-bold font-heading text-[#3ECFC0]">
                            {calcData.grandTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </div>
                          <div className="text-xs text-white/50">{lang === "ar" ? "ريال سعودي" : "SAR"}</div>
                        </div>
                      </div>
                    </div>

                    {/* Back to booking button */}
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
                      variant="ghost"
                      className="w-full text-muted-foreground"
                      onClick={() => setShowCalculator(false)}
                    >
                      <ArrowLeft className="h-4 w-4 me-2" />
                      {lang === "ar" ? "العودة لتفاصيل السعر" : "Back to pricing details"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Property Manager Card */}
              {(prop as any).manager && (
                <Card className="shadow-md border-[#3ECFC0]/20">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4 mb-3">
                      {(prop as any).manager.photoUrl ? (
                        <img src={(prop as any).manager.photoUrl} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-[#3ECFC0]/30" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-[#3ECFC0]/10 flex items-center justify-center">
                          <UserCog className="h-6 w-6 text-[#3ECFC0]" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold font-heading">
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

      <Footer />
    </div>
  );
}
