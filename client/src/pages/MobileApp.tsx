/**
 * MobileApp — Full mobile app preview inside a phone frame
 * Design: "Oasis" — Organic Saudi Tech
 * Arabic-first RTL, deep navy, frosted glass, Tajawal typography
 * Auth: Supabase Auth (email/password + phone OTP)
 * Data: Real API from monthlykey.com via server proxy
 * Features: Interactive map, bookings tracking, phone OTP login
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Search, CalendarDays, User, ChevronRight, MapPin, BedDouble, Bath,
  Maximize, Wifi, Car, Wind, Star, Heart, Bell, Filter, X, Check,
  CreditCard, Building2, ChevronLeft, Loader2, Eye, EyeOff, Mail, Lock,
  UserPlus, LogIn, RefreshCw, ImageOff, Phone, MapPinned, Navigation,
  Clock, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  getFeaturedProperties, searchProperties, getPropertyById,
  calculateBookingTotal, propertyTypeLabels, furnishedLabels,
  type ApiProperty, type SearchParams,
} from "@/lib/api";

// ─── Hero Image (generated) ───
const HERO_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/Qa7Q2PtJqyYVmLJFM69a8Y/hero-riyadh-mrK3PJVdGeLBcb9uR3WKW9.webp";

// ─── Fallback placeholder for properties with no photos ───
const PLACEHOLDER_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/Qa7Q2PtJqyYVmLJFM69a8Y/property-modern-XQ4H9LtYsmuJGgmBS6peYS.webp";

// ─── Pricing Utils ───
function formatPrice(amount: number): string {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getPropertyImage(property: ApiProperty, index = 0): string {
  if (property.photos && property.photos.length > index) {
    return property.photos[index];
  }
  return PLACEHOLDER_IMG;
}

// ─── Tab Types ───
type TabId = "home" | "search" | "bookings" | "profile";
type ScreenId = "tabs" | "property-detail" | "booking-flow" | "login";

// ─── Booking Status Types ───
interface UserBooking {
  id: string;
  property: ApiProperty;
  months: number;
  totalAmount: number;
  status: "pending" | "confirmed" | "active" | "completed" | "cancelled";
  createdAt: Date;
  startDate?: Date;
}

const bookingStatusLabels: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "قيد المراجعة", color: "#F59E0B", icon: Clock },
  confirmed: { label: "مؤكد", color: "#10B981", icon: CheckCircle2 },
  active: { label: "نشط", color: "#2563EB", icon: CheckCircle2 },
  completed: { label: "مكتمل", color: "#6B7280", icon: Check },
  cancelled: { label: "ملغي", color: "#EF4444", icon: XCircle },
};

// ─── Amenity Icon Map ───
function AmenityIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (t.includes("wifi") || t.includes("internet")) return <Wifi className="w-4 h-4" />;
  if (t.includes("parking") || t.includes("موقف")) return <Car className="w-4 h-4" />;
  if (t.includes("ac") || t.includes("تكييف") || t.includes("air")) return <Wind className="w-4 h-4" />;
  return <Star className="w-4 h-4" />;
}

const amenityLabels: Record<string, string> = {
  wifi: "واي فاي",
  parking: "موقف سيارات",
  ac: "تكييف",
  pool: "مسبح",
  gym: "صالة رياضية",
  elevator: "مصعد",
  security: "أمن",
  garden: "حديقة",
  balcony: "بلكونة",
  kitchen: "مطبخ",
  laundry: "غسالة",
};

// ─── Known cities for quick filter ───
const QUICK_CITIES = ["الرياض", "جدة", "المدينة المنورة", "الدمام", "مكة المكرمة", "الخبر"];

// ─── Interactive Map Component ───
function PropertyMap({ latitude, longitude, title, googleMapsUrl }: {
  latitude: string | null;
  longitude: string | null;
  title: string;
  googleMapsUrl: string | null;
}) {
  const lat = latitude ? parseFloat(latitude) : null;
  const lng = longitude ? parseFloat(longitude) : null;

  if (!lat || !lng) {
    return (
      <div className="glass rounded-2xl p-4 flex flex-col items-center justify-center h-[200px]">
        <MapPinned className="w-8 h-8 text-muted-foreground/40 mb-2" />
        <p className="text-xs text-muted-foreground">الموقع غير متاح على الخريطة</p>
      </div>
    );
  }

  // Use OpenStreetMap embed (no API key needed, fully independent)
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.008},${lng + 0.01},${lat + 0.008}&layer=mapnik&marker=${lat},${lng}`;
  const fullMapUrl = googleMapsUrl || `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div className="rounded-2xl overflow-hidden border border-border/50">
      <div className="relative h-[200px]">
        <iframe
          src={mapUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          title={`موقع ${title}`}
        />
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "linear-gradient(to bottom, rgba(11,20,38,0.1) 0%, transparent 20%, transparent 80%, rgba(11,20,38,0.3) 100%)"
        }} />
      </div>
      <a
        href={fullMapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 py-3 glass text-sm font-medium text-primary transition-all hover:bg-card/80"
      >
        <Navigation className="w-4 h-4" />
        <span>فتح في خرائط جوجل</span>
      </a>
    </div>
  );
}

// ─── Main Component ───
export default function MobileApp() {
  const { user, isLoggedIn, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [screen, setScreen] = useState<ScreenId>("tabs");
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [selectedPropertyData, setSelectedPropertyData] = useState<ApiProperty | null>(null);
  const [bookingStep, setBookingStep] = useState(0);
  const [bookingMonths, setBookingMonths] = useState(1);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [userBookings, setUserBookings] = useState<UserBooking[]>([]);

  // API data state
  const [featuredProperties, setFeaturedProperties] = useState<ApiProperty[]>([]);
  const [searchResults, setSearchResults] = useState<ApiProperty[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorFeatured, setErrorFeatured] = useState<string | null>(null);

  // Fetch featured properties on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingFeatured(true);
    setErrorFeatured(null);
    getFeaturedProperties()
      .then((data) => {
        if (!cancelled) {
          setFeaturedProperties(data);
          setLoadingFeatured(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorFeatured("تعذر تحميل العقارات. تحقق من الاتصال بالإنترنت.");
          setLoadingFeatured(false);
          console.error("Failed to fetch featured:", err);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Search properties when filters change
  useEffect(() => {
    let cancelled = false;
    const params: SearchParams = { limit: 20 };
    if (searchQuery.trim()) params.query = searchQuery.trim();
    if (selectedCity) params.city = selectedCity;

    setLoadingSearch(true);
    searchProperties(params)
      .then((data) => {
        if (!cancelled) {
          setSearchResults(data.items);
          setSearchTotal(data.total);
          setLoadingSearch(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadingSearch(false);
          console.error("Search failed:", err);
        }
      });
    return () => { cancelled = true; };
  }, [searchQuery, selectedCity]);

  const openProperty = useCallback(async (property: ApiProperty) => {
    setSelectedPropertyId(property.id);
    setSelectedPropertyData(property);
    setScreen("property-detail");
    setLoadingDetail(true);
    try {
      const full = await getPropertyById(property.id);
      if (full) setSelectedPropertyData(full);
    } catch (err) {
      console.error("Failed to fetch property detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const startBooking = useCallback(() => {
    if (!isLoggedIn) {
      setScreen("login");
      return;
    }
    setBookingStep(0);
    setBookingConfirmed(false);
    setScreen("booking-flow");
  }, [isLoggedIn]);

  const goBack = useCallback(() => {
    if (screen === "booking-flow" && bookingStep > 0) {
      setBookingStep((s) => s - 1);
      return;
    }
    setScreen("tabs");
    setSelectedPropertyId(null);
    setSelectedPropertyData(null);
    setBookingStep(0);
    setBookingConfirmed(false);
  }, [screen, bookingStep]);

  const toggleFavorite = useCallback((id: number) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleLogout = useCallback(async () => {
    await signOut();
    setScreen("tabs");
    setActiveTab("home");
    setUserBookings([]);
    toast.success("تم تسجيل الخروج بنجاح");
  }, [signOut]);

  const handleLoginSuccess = useCallback(() => {
    if (selectedPropertyData) {
      setBookingStep(0);
      setBookingConfirmed(false);
      setScreen("booking-flow");
    } else {
      setScreen("tabs");
    }
    toast.success("تم تسجيل الدخول بنجاح");
  }, [selectedPropertyData]);

  const handleBookingComplete = useCallback((property: ApiProperty, months: number, totalAmount: number) => {
    const newBooking: UserBooking = {
      id: `BK-${Date.now()}`,
      property,
      months,
      totalAmount,
      status: "pending",
      createdAt: new Date(),
    };
    setUserBookings((prev) => [newBooking, ...prev]);
  }, []);

  const userDisplayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "مستخدم";
  const userEmail = user?.email || user?.phone || "";
  const userInitials = userDisplayName.slice(0, 2);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8" style={{ background: "linear-gradient(135deg, #050A15 0%, #0B1426 40%, #0D1A33 100%)" }}>
      <div className="phone-frame bg-background relative flex flex-col">
        <div className="phone-notch" />
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {screen === "tabs" && (
              <motion.div key="tabs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="h-full flex flex-col">
                <div className="flex-1 overflow-y-auto" style={{ paddingBottom: "80px" }}>
                  {activeTab === "home" && (
                    <HomeTab
                      properties={featuredProperties}
                      loading={loadingFeatured}
                      error={errorFeatured}
                      onOpenProperty={openProperty}
                      favorites={favorites}
                      onToggleFavorite={toggleFavorite}
                      onRetry={() => {
                        setLoadingFeatured(true);
                        setErrorFeatured(null);
                        getFeaturedProperties().then(setFeaturedProperties).catch(() => setErrorFeatured("تعذر تحميل العقارات")).finally(() => setLoadingFeatured(false));
                      }}
                    />
                  )}
                  {activeTab === "search" && (
                    <SearchTab
                      properties={searchResults}
                      total={searchTotal}
                      loading={loadingSearch}
                      onOpenProperty={openProperty}
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      selectedCity={selectedCity}
                      onCityChange={setSelectedCity}
                      showFilter={showFilter}
                      onToggleFilter={() => setShowFilter(!showFilter)}
                      favorites={favorites}
                      onToggleFavorite={toggleFavorite}
                    />
                  )}
                  {activeTab === "bookings" && (
                    <BookingsTab
                      isLoggedIn={isLoggedIn}
                      onLogin={() => setScreen("login")}
                      bookings={userBookings}
                      onOpenProperty={openProperty}
                    />
                  )}
                  {activeTab === "profile" && (
                    <ProfileTab isLoggedIn={isLoggedIn} onLogin={() => setScreen("login")} onLogout={handleLogout} userName={userDisplayName} userEmail={userEmail} userInitials={userInitials} />
                  )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 glass-strong" style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}>
                  <div className="flex items-center justify-around h-16">
                    {([
                      { id: "home" as TabId, icon: Home, label: "الرئيسية" },
                      { id: "search" as TabId, icon: Search, label: "البحث" },
                      { id: "bookings" as TabId, icon: CalendarDays, label: "حجوزاتي" },
                      { id: "profile" as TabId, icon: User, label: "حسابي" },
                    ]).map((tab) => (
                      <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="flex flex-col items-center gap-1 transition-all duration-200">
                        <tab.icon className={`w-5 h-5 transition-colors ${activeTab === tab.id ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-[10px] font-medium transition-colors ${activeTab === tab.id ? "text-primary" : "text-muted-foreground"}`}>{tab.label}</span>
                        {activeTab === tab.id && <motion.div layoutId="tab-indicator" className="w-1 h-1 rounded-full bg-primary" />}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {screen === "property-detail" && selectedPropertyData && (
              <motion.div key="detail" initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -100, opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="h-full">
                <PropertyDetail
                  property={selectedPropertyData}
                  loading={loadingDetail}
                  onBack={goBack}
                  onBook={startBooking}
                  isFavorite={favorites.has(selectedPropertyData.id)}
                  onToggleFavorite={() => toggleFavorite(selectedPropertyData.id)}
                />
              </motion.div>
            )}

            {screen === "booking-flow" && selectedPropertyData && (
              <motion.div key="booking" initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="h-full">
                <BookingFlow
                  property={selectedPropertyData}
                  step={bookingStep}
                  months={bookingMonths}
                  onMonthsChange={setBookingMonths}
                  onNext={() => {
                    if (bookingStep < 3) setBookingStep((s) => s + 1);
                    if (bookingStep === 2) {
                      setBookingConfirmed(true);
                      const breakdown = calculateBookingTotal(parseFloat(selectedPropertyData.monthlyRent), bookingMonths);
                      handleBookingComplete(selectedPropertyData, bookingMonths, breakdown.grandTotal);
                    }
                  }}
                  onBack={goBack}
                  confirmed={bookingConfirmed}
                />
              </motion.div>
            )}

            {screen === "login" && (
              <motion.div key="login" initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="h-full">
                <LoginScreen onSuccess={handleLoginSuccess} onBack={goBack} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Home Tab ───
function HomeTab({
  properties, loading, error, onOpenProperty, favorites, onToggleFavorite, onRetry,
}: {
  properties: ApiProperty[];
  loading: boolean;
  error: string | null;
  onOpenProperty: (p: ApiProperty) => void;
  favorites: Set<number>;
  onToggleFavorite: (id: number) => void;
  onRetry: () => void;
}) {
  const recent = useMemo(() => [...properties].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4), [properties]);
  const popular = useMemo(() => [...properties].sort((a, b) => b.viewCount - a.viewCount), [properties]);

  return (
    <div className="pt-12">
      <div className="relative h-[280px] overflow-hidden">
        <img src={HERO_IMAGE} alt="الرياض" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(11,20,38,0.3) 0%, rgba(11,20,38,0.8) 80%)" }} />
        <div className="absolute bottom-6 right-4 left-4">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">متاح الآن</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">المفتاح الشهري</h1>
          <p className="text-sm text-white/70">اكتشف أفضل العقارات للإيجار الشهري في المملكة</p>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {QUICK_CITIES.map((city) => (
            <button key={city} className="px-4 py-2 rounded-full text-xs font-medium glass whitespace-nowrap transition-all hover:bg-card/80">{city}</button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
          <p className="text-sm text-muted-foreground">جاري تحميل العقارات...</p>
        </div>
      )}

      {error && (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-destructive mb-3">{error}</p>
          <button onClick={onRetry} className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl glass text-sm">
            <RefreshCw className="w-4 h-4" /> إعادة المحاولة
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="px-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">عقارات مميزة</h2>
              <span className="text-[11px] text-muted-foreground">{properties.length} عقار</span>
            </div>
            <div className="flex gap-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {recent.map((property, i) => (
                <motion.div key={property.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="min-w-[260px]">
                  <PropertyCard property={property} onPress={() => onOpenProperty(property)} isFavorite={favorites.has(property.id)} onToggleFavorite={() => onToggleFavorite(property.id)} />
                </motion.div>
              ))}
            </div>
          </div>

          <div className="px-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">الأكثر مشاهدة</h2>
            </div>
            <div className="flex flex-col gap-3">
              {popular.map((property, i) => (
                <motion.div key={property.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <PropertyCard property={property} onPress={() => onOpenProperty(property)} isFavorite={favorites.has(property.id)} onToggleFavorite={() => onToggleFavorite(property.id)} size="compact" />
                </motion.div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Property Card ───
function PropertyCard({
  property, onPress, isFavorite, onToggleFavorite, size = "large",
}: {
  property: ApiProperty;
  onPress: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  size?: "large" | "compact";
}) {
  const rent = parseFloat(property.monthlyRent);
  const isNew = (Date.now() - new Date(property.createdAt).getTime()) < 7 * 24 * 60 * 60 * 1000;
  const typeLabel = propertyTypeLabels[property.propertyType] || property.propertyType;
  const [imgError, setImgError] = useState(false);
  const imgSrc = imgError ? PLACEHOLDER_IMG : getPropertyImage(property);

  if (size === "compact") {
    return (
      <button onClick={onPress} className="w-full flex gap-3 glass rounded-2xl p-3 text-right transition-all hover:bg-card/80 active:scale-[0.98]">
        <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0">
          <img src={imgSrc} alt={property.titleAr} className="w-full h-full object-cover" onError={() => setImgError(true)} />
          {isNew && (
            <div className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>جديد</div>
          )}
        </div>
        <div className="flex-1 flex flex-col justify-between py-0.5">
          <div>
            <h3 className="text-sm font-bold leading-tight mb-1">{property.titleAr}</h3>
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span className="text-[11px]">{property.cityAr} - {property.districtAr}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-0.5"><BedDouble className="w-3 h-3" />{property.bedrooms}</span>
              <span className="flex items-center gap-0.5"><Bath className="w-3 h-3" />{property.bathrooms}</span>
              {property.sizeSqm > 0 && <span className="flex items-center gap-0.5"><Maximize className="w-3 h-3" />{property.sizeSqm}م²</span>}
            </div>
            <span className="text-sm font-bold gradient-text">{formatPrice(rent)}</span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button onClick={onPress} className="w-full rounded-2xl overflow-hidden glass text-right transition-all hover:bg-card/80 active:scale-[0.98]">
      <div className="relative h-[160px]">
        <img src={imgSrc} alt={property.titleAr} className="w-full h-full object-cover" onError={() => setImgError(true)} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(11,20,38,0.7) 0%, transparent 50%)" }} />
        <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }} className="absolute top-3 left-3 w-8 h-8 rounded-full glass flex items-center justify-center">
          <Heart className={`w-4 h-4 ${isFavorite ? "fill-red-500 text-red-500" : "text-white/70"}`} />
        </button>
        {isNew && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>جديد</div>
        )}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full glass">
          <span className="text-[10px] text-white/80">{typeLabel}</span>
        </div>
        <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full glass">
          <Eye className="w-3 h-3 text-white/60" />
          <span className="text-[10px] text-white/80">{property.viewCount}</span>
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-bold mb-1 leading-tight">{property.titleAr}</h3>
        <div className="flex items-center gap-1 text-muted-foreground mb-2">
          <MapPin className="w-3 h-3" />
          <span className="text-[11px]">{property.cityAr} - {property.districtAr}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-0.5"><BedDouble className="w-3 h-3" />{property.bedrooms}</span>
            <span className="flex items-center gap-0.5"><Bath className="w-3 h-3" />{property.bathrooms}</span>
          </div>
          <div className="text-left">
            <span className="text-base font-bold gradient-text">{formatPrice(rent)}</span>
            <span className="text-[10px] text-muted-foreground mr-1">/ شهرياً</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Search Tab ───
function SearchTab({
  properties, total, loading, onOpenProperty, searchQuery, onSearchChange,
  selectedCity, onCityChange, showFilter, onToggleFilter, favorites, onToggleFavorite,
}: {
  properties: ApiProperty[];
  total: number;
  loading: boolean;
  onOpenProperty: (p: ApiProperty) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCity: string | null;
  onCityChange: (city: string | null) => void;
  showFilter: boolean;
  onToggleFilter: () => void;
  favorites: Set<number>;
  onToggleFavorite: (id: number) => void;
}) {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  useEffect(() => {
    const t = setTimeout(() => onSearchChange(localQuery), 400);
    return () => clearTimeout(t);
  }, [localQuery, onSearchChange]);

  return (
    <div className="pt-12">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold mb-3">البحث عن عقار</h1>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 glass rounded-xl px-3 py-2.5">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              placeholder="ابحث بالحي أو المدينة..."
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              className="bg-transparent text-sm w-full outline-none placeholder:text-muted-foreground"
              dir="rtl"
            />
            {localQuery && (
              <button onClick={() => { setLocalQuery(""); onSearchChange(""); }}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <button onClick={onToggleFilter} className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${showFilter ? "bg-primary text-white" : "glass"}`}>
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showFilter && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-3">
              <p className="text-xs text-muted-foreground mb-2">المدينة</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => onCityChange(null)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${!selectedCity ? "bg-primary text-white" : "glass"}`}>الكل</button>
                {QUICK_CITIES.map((city) => (
                  <button key={city} onClick={() => onCityChange(city === selectedCity ? null : city)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${selectedCity === city ? "bg-primary text-white" : "glass"}`}>{city}</button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4">
        <p className="text-xs text-muted-foreground mb-3">
          {loading ? "جاري البحث..." : `${total} نتيجة`}
        </p>
        <div className="flex flex-col gap-3 pb-4">
          {loading ? (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">لا توجد نتائج</p>
            </div>
          ) : (
            properties.map((property, i) => (
              <motion.div key={property.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <PropertyCard property={property} onPress={() => onOpenProperty(property)} isFavorite={favorites.has(property.id)} onToggleFavorite={() => onToggleFavorite(property.id)} size="compact" />
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Property Detail with Interactive Map ───
function PropertyDetail({
  property, loading, onBack, onBook, isFavorite, onToggleFavorite,
}: {
  property: ApiProperty;
  loading: boolean;
  onBack: () => void;
  onBook: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const rent = parseFloat(property.monthlyRent);
  const deposit = property.securityDeposit ? parseFloat(property.securityDeposit) : 0;
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = property.photos?.length ? property.photos : [PLACEHOLDER_IMG];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {/* Photo Gallery */}
        <div className="relative h-[300px]">
          <img src={photos[photoIndex]} alt={property.titleAr} className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(11,20,38,0.4) 0%, transparent 30%, rgba(11,20,38,0.9) 90%)" }} />

          {photos.length > 1 && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full glass text-[10px] text-white">
              {photoIndex + 1} / {photos.length}
            </div>
          )}

          {photos.length > 1 && (
            <>
              <button onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full glass flex items-center justify-center">
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
              <button onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)} className="absolute right-14 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full glass flex items-center justify-center">
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </>
          )}

          <div className="absolute top-12 right-4 flex items-center gap-2">
            <button onClick={onBack} className="w-10 h-10 rounded-full glass flex items-center justify-center">
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </div>
          <div className="absolute top-12 left-4 flex gap-2">
            <button onClick={onToggleFavorite} className="w-10 h-10 rounded-full glass flex items-center justify-center">
              <Heart className={`w-5 h-5 ${isFavorite ? "fill-red-500 text-red-500" : "text-white"}`} />
            </button>
          </div>

          <div className="absolute bottom-4 right-4 left-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
                {propertyTypeLabels[property.propertyType] || property.propertyType}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] glass text-white/80">
                {furnishedLabels[property.furnishedLevel] || property.furnishedLevel}
              </span>
            </div>
            <h1 className="text-xl font-bold text-white mb-1">{property.titleAr}</h1>
            <div className="flex items-center gap-1 text-white/70">
              <MapPin className="w-3.5 h-3.5" />
              <span className="text-sm">{property.cityAr} - {property.districtAr}</span>
            </div>
          </div>
        </div>

        {/* Price Badge */}
        <div className="px-4 -mt-3 relative z-10">
          <div className="inline-flex items-baseline gap-1 px-4 py-2.5 rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(124,58,237,0.15))", border: "1px solid rgba(37,99,235,0.2)" }}>
            <span className="text-2xl font-bold gradient-text">{formatPrice(rent)}</span>
            <span className="text-xs text-muted-foreground">/ شهرياً</span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="px-4 mt-5">
          <div className="grid grid-cols-3 gap-2">
            <div className="glass rounded-xl p-3 text-center">
              <BedDouble className="w-5 h-5 text-primary mx-auto mb-1" />
              <span className="text-lg font-bold block">{property.bedrooms}</span>
              <span className="text-[10px] text-muted-foreground">غرف النوم</span>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <Bath className="w-5 h-5 text-primary mx-auto mb-1" />
              <span className="text-lg font-bold block">{property.bathrooms}</span>
              <span className="text-[10px] text-muted-foreground">دورات المياه</span>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <Maximize className="w-5 h-5 text-primary mx-auto mb-1" />
              <span className="text-lg font-bold block">{property.sizeSqm || "—"}</span>
              <span className="text-[10px] text-muted-foreground">م²</span>
            </div>
          </div>
        </div>

        {/* Description */}
        {property.descriptionAr && (
          <div className="px-4 mt-5">
            <h3 className="text-base font-bold mb-2">الوصف</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{property.descriptionAr}</p>
          </div>
        )}

        {/* Interactive Map */}
        <div className="px-4 mt-5">
          <h3 className="text-base font-bold mb-3">
            <span className="flex items-center gap-2">
              <MapPinned className="w-4 h-4 text-primary" />
              الموقع على الخريطة
            </span>
          </h3>
          <PropertyMap
            latitude={property.latitude}
            longitude={property.longitude}
            title={property.titleAr}
            googleMapsUrl={property.googleMapsUrl}
          />
        </div>

        {/* Amenities */}
        {property.amenities && property.amenities.length > 0 && (
          <div className="px-4 mt-5">
            <h3 className="text-base font-bold mb-3">المرافق والخدمات</h3>
            <div className="flex flex-wrap gap-2">
              {property.amenities.map((amenity) => (
                <div key={amenity} className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass">
                  <AmenityIcon type={amenity} />
                  <span className="text-xs">{amenityLabels[amenity.toLowerCase()] || amenity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rental Details */}
        <div className="px-4 mt-5 mb-4">
          <div className="glass rounded-2xl p-4">
            <h3 className="text-sm font-bold mb-2">تفاصيل الإيجار</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">الإيجار الشهري</span>
                <span className="font-bold gradient-text">{formatPrice(rent)}</span>
              </div>
              {deposit > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">مبلغ التأمين</span>
                  <span className="font-medium">{formatPrice(deposit)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">الحد الأدنى للإقامة</span>
                <span className="font-medium">{property.minStayMonths} {property.minStayMonths === 1 ? "شهر" : "أشهر"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">الحد الأقصى للإقامة</span>
                <span className="font-medium">{property.maxStayMonths} {property.maxStayMonths === 1 ? "شهر" : "أشهر"}</span>
              </div>
              {property.instantBook && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">حجز فوري متاح</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Photo Thumbnails */}
        {photos.length > 1 && (
          <div className="px-4 mb-4">
            <h3 className="text-sm font-bold mb-2">الصور ({photos.length})</h3>
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {photos.slice(0, 8).map((photo, i) => (
                <button key={i} onClick={() => setPhotoIndex(i)} className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${i === photoIndex ? "border-primary" : "border-transparent"}`}>
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
              {photos.length > 8 && (
                <div className="w-16 h-16 rounded-lg glass flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-muted-foreground">+{photos.length - 8}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Book Button */}
      <div className="p-4 glass-strong">
        <button onClick={onBook} className="w-full h-12 rounded-xl font-bold text-white text-base transition-all active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
          إتمام الحجز
        </button>
      </div>
    </div>
  );
}

// ─── Booking Flow ───
function BookingFlow({
  property, step, months, onMonthsChange, onNext, onBack, confirmed,
}: {
  property: ApiProperty;
  step: number;
  months: number;
  onMonthsChange: (m: number) => void;
  onNext: () => void;
  onBack: () => void;
  confirmed: boolean;
}) {
  const rent = parseFloat(property.monthlyRent);
  const allowedMonths = useMemo(() => {
    const min = property.minStayMonths || 1;
    const max = property.maxStayMonths || 12;
    const options = [];
    for (let m = min; m <= max; m++) options.push(m);
    return options;
  }, [property.minStayMonths, property.maxStayMonths]);

  const breakdown = useMemo(() => calculateBookingTotal(rent, months), [rent, months]);
  const steps = ["المدة", "التكلفة", "الدفع", "التأكيد"];

  return (
    <div className="h-full flex flex-col">
      <div className="pt-12 px-4 pb-3 glass-strong">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="w-9 h-9 rounded-full glass flex items-center justify-center">
            <ChevronRight className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold">إتمام الحجز</h2>
          <div className="w-9" />
        </div>
        <div className="flex items-center gap-1">
          {steps.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={`h-1 w-full rounded-full transition-all ${i <= step ? "bg-primary" : "bg-muted"}`} />
              <span className={`text-[9px] ${i <= step ? "text-primary font-medium" : "text-muted-foreground"}`}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="duration" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <h3 className="text-lg font-bold mb-4">اختر مدة الإقامة</h3>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {allowedMonths.map((m) => (
                  <button key={m} onClick={() => onMonthsChange(m)} className={`py-4 rounded-xl text-center transition-all ${months === m ? "text-white font-bold" : "glass"}`} style={months === m ? { background: "linear-gradient(135deg, #2563EB, #7C3AED)" } : {}}>
                    <span className="text-xl font-bold block">{m}</span>
                    <span className="text-[10px]">{m === 1 ? "شهر" : m < 11 ? "أشهر" : "شهر"}</span>
                  </button>
                ))}
              </div>
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <img src={getPropertyImage(property)} alt="" className="w-12 h-12 rounded-xl object-cover" />
                  <div>
                    <h4 className="text-sm font-bold">{property.titleAr}</h4>
                    <p className="text-[11px] text-muted-foreground">{property.cityAr} - {property.districtAr}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{months} {months === 1 ? "شهر" : "أشهر"} × {formatPrice(rent)}</span>
                  <span className="font-bold gradient-text">{formatPrice(rent * months)}</span>
                </div>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="cost" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <h3 className="text-lg font-bold mb-4">تفاصيل التكلفة</h3>
              <div className="glass rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">الإيجار ({months} {months === 1 ? "شهر" : "أشهر"})</span>
                  <span className="font-medium">{formatPrice(breakdown.baseRentTotal)}</span>
                </div>
                {!breakdown.hideInsuranceFromTenant && breakdown.insuranceAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">تأمين ({breakdown.appliedRates.insuranceRate}%)</span>
                    <span className="font-medium">{formatPrice(breakdown.insuranceAmount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">رسوم الخدمة ({breakdown.appliedRates.serviceFeeRate}%)</span>
                  <span className="font-medium">{formatPrice(breakdown.serviceFeeAmount)}</span>
                </div>
                <div className="border-t border-border/50 pt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">المجموع الفرعي</span>
                  <span className="font-medium">{formatPrice(breakdown.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">ضريبة القيمة المضافة ({breakdown.appliedRates.vatRate}%)</span>
                  <span className="font-medium">{formatPrice(breakdown.vatAmount)}</span>
                </div>
                <div className="border-t border-border/50 pt-3 flex items-center justify-between">
                  <span className="font-bold">المجموع الكلي</span>
                  <span className="text-xl font-bold gradient-text">{formatPrice(breakdown.grandTotal)}</span>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="payment" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <h3 className="text-lg font-bold mb-4">طريقة الدفع</h3>
              <div className="space-y-3">
                {[
                  { id: "bank", label: "تحويل بنكي", icon: Building2, desc: "تحويل مباشر لحساب المالك" },
                  { id: "card", label: "بطاقة ائتمان", icon: CreditCard, desc: "فيزا أو ماستركارد" },
                  { id: "mada", label: "مدى", icon: CreditCard, desc: "بطاقة مدى المحلية" },
                ].map((method, i) => (
                  <motion.button key={method.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} onClick={onNext} className="w-full flex items-center gap-3 glass rounded-xl p-4 text-right transition-all hover:bg-card/80 active:scale-[0.98]">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(124,58,237,0.15))" }}>
                      <method.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold block">{method.label}</span>
                      <span className="text-[11px] text-muted-foreground">{method.desc}</span>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && confirmed && (
            <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-12">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 10, stiffness: 200, delay: 0.2 }} className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: "linear-gradient(135deg, #10B981, #059669)" }}>
                <Check className="w-10 h-10 text-white" />
              </motion.div>
              <h3 className="text-xl font-bold mb-2">تم إنشاء الحجز بنجاح!</h3>
              <p className="text-sm text-muted-foreground text-center mb-6">سيتم مراجعة حجزك من قبل المالك وإشعارك بالنتيجة</p>
              <div className="glass rounded-2xl p-4 w-full">
                <div className="flex items-center gap-3 mb-3">
                  <img src={getPropertyImage(property)} alt="" className="w-12 h-12 rounded-xl object-cover" />
                  <div>
                    <h4 className="text-sm font-bold">{property.titleAr}</h4>
                    <p className="text-[11px] text-muted-foreground">{months} {months === 1 ? "شهر" : "أشهر"}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">المجموع</span>
                  <span className="font-bold gradient-text">{formatPrice(breakdown.grandTotal)}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {step < 2 && (
        <div className="p-4 glass-strong">
          <button onClick={onNext} className="w-full h-12 rounded-xl font-bold text-white text-base transition-all active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
            {step === 0 ? "التالي" : "اختر طريقة الدفع"}
          </button>
        </div>
      )}

      {step === 3 && confirmed && (
        <div className="p-4 glass-strong">
          <button onClick={onBack} className="w-full h-12 rounded-xl font-bold text-white text-base transition-all active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
            العودة للرئيسية
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Bookings Tab (Real bookings tracking) ───
function BookingsTab({ isLoggedIn, onLogin, bookings, onOpenProperty }: {
  isLoggedIn: boolean;
  onLogin: () => void;
  bookings: UserBooking[];
  onOpenProperty: (p: ApiProperty) => void;
}) {
  if (!isLoggedIn) {
    return (
      <div className="pt-12 flex flex-col items-center justify-center h-full px-8">
        <CalendarDays className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-bold mb-2">حجوزاتي</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">سجل الدخول لعرض حجوزاتك</p>
        <button onClick={onLogin} className="px-8 py-3 rounded-xl font-bold text-white text-sm transition-all active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
          تسجيل الدخول
        </button>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="pt-12 px-4">
        <h1 className="text-xl font-bold mb-4 pt-4">حجوزاتي</h1>
        <div className="text-center py-12">
          <CalendarDays className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">لا توجد حجوزات حالياً</p>
          <p className="text-xs text-muted-foreground/60 mt-1">ابدأ بالبحث عن عقار وحجز إقامتك</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-12 px-4">
      <h1 className="text-xl font-bold mb-4 pt-4">حجوزاتي</h1>
      <div className="flex flex-col gap-3 pb-4">
        {bookings.map((booking, i) => {
          const statusInfo = bookingStatusLabels[booking.status];
          const StatusIcon = statusInfo.icon;
          return (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <button
                onClick={() => onOpenProperty(booking.property)}
                className="w-full glass rounded-2xl p-4 text-right transition-all hover:bg-card/80 active:scale-[0.98]"
              >
                <div className="flex gap-3 mb-3">
                  <img
                    src={getPropertyImage(booking.property)}
                    alt={booking.property.titleAr}
                    className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                  />
                  <div className="flex-1">
                    <h3 className="text-sm font-bold leading-tight mb-1">{booking.property.titleAr}</h3>
                    <div className="flex items-center gap-1 text-muted-foreground mb-1">
                      <MapPin className="w-3 h-3" />
                      <span className="text-[11px]">{booking.property.cityAr} - {booking.property.districtAr}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusIcon className="w-3.5 h-3.5" style={{ color: statusInfo.color }} />
                      <span className="text-[11px] font-medium" style={{ color: statusInfo.color }}>{statusInfo.label}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {booking.months} {booking.months === 1 ? "شهر" : "أشهر"}
                    </span>
                    <span>رقم الحجز: {booking.id}</span>
                  </div>
                  <span className="text-sm font-bold gradient-text">{formatPrice(booking.totalAmount)}</span>
                </div>
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Profile Tab ───
function ProfileTab({
  isLoggedIn, onLogin, onLogout, userName, userEmail, userInitials,
}: {
  isLoggedIn: boolean;
  onLogin: () => void;
  onLogout: () => void;
  userName: string;
  userEmail: string;
  userInitials: string;
}) {
  if (!isLoggedIn) {
    return (
      <div className="pt-12 flex flex-col items-center justify-center h-full px-8">
        <User className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-bold mb-2">حسابي</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">سجل الدخول للوصول إلى حسابك</p>
        <button onClick={onLogin} className="px-8 py-3 rounded-xl font-bold text-white text-sm transition-all active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
          تسجيل الدخول
        </button>
      </div>
    );
  }

  return (
    <div className="pt-12 px-4">
      <div className="pt-4 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
            {userInitials}
          </div>
          <div>
            <h2 className="text-lg font-bold">{userName}</h2>
            <p className="text-sm text-muted-foreground">{userEmail}</p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {[
          { label: "الإعدادات", icon: "⚙️" },
          { label: "اللغة", icon: "🌐", value: "العربية" },
          { label: "المظهر", icon: "🌙", value: "داكن" },
          { label: "الإشعارات", icon: "🔔" },
          { label: "المساعدة", icon: "❓" },
        ].map((item) => (
          <button key={item.label} className="w-full flex items-center justify-between glass rounded-xl p-4 transition-all hover:bg-card/80">
            <div className="flex items-center gap-3">
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </div>
            <div className="flex items-center gap-2">
              {item.value && <span className="text-xs text-muted-foreground">{item.value}</span>}
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>
      <button onClick={onLogout} className="w-full mt-6 py-3 rounded-xl text-sm font-bold text-destructive glass transition-all hover:bg-destructive/10">
        تسجيل الخروج
      </button>
    </div>
  );
}

// ─── Login Screen (Supabase Auth: Email + Phone OTP) ───
function LoginScreen({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const { signIn, signUp, signInWithPhone, verifyOtp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "phone" | "otp">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  const handleEmailSubmit = async () => {
    setError(null);
    if (!email.trim()) { setError("يرجى إدخال البريد الإلكتروني"); return; }
    if (!password.trim() || password.length < 6) { setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }

    setLoading(true);
    try {
      if (mode === "login") {
        const { error: authError } = await signIn(email, password);
        if (authError) {
          setError(authError.message.includes("Invalid login") ? "البريد الإلكتروني أو كلمة المرور غير صحيحة" : authError.message);
          return;
        }
        onSuccess();
      } else {
        if (!fullName.trim()) { setError("يرجى إدخال الاسم الكامل"); setLoading(false); return; }
        const { error: authError } = await signUp(email, password, fullName);
        if (authError) {
          setError(authError.message.includes("already registered") ? "هذا البريد الإلكتروني مسجل بالفعل" : authError.message);
          return;
        }
        toast.success("تم إنشاء الحساب بنجاح! تحقق من بريدك الإلكتروني لتأكيد الحساب.");
        setMode("login");
      }
    } catch {
      setError("حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async () => {
    setError(null);
    const cleanPhone = phoneNumber.replace(/\s/g, "");
    if (!cleanPhone || cleanPhone.length < 9) {
      setError("يرجى إدخال رقم جوال صحيح");
      return;
    }

    const fullPhone = cleanPhone.startsWith("+") ? cleanPhone : `+966${cleanPhone.startsWith("0") ? cleanPhone.slice(1) : cleanPhone}`;

    setLoading(true);
    try {
      const { error: authError } = await signInWithPhone(fullPhone);
      if (authError) {
        setError(authError.message.includes("Phone") ? "رقم الجوال غير صحيح أو الخدمة غير مفعلة" : authError.message);
        return;
      }
      setMode("otp");
      toast.success("تم إرسال رمز التحقق إلى جوالك");
      setTimeout(() => otpInputRef.current?.focus(), 300);
    } catch {
      setError("حدث خطأ. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    setError(null);
    if (!otpCode || otpCode.length !== 6) {
      setError("يرجى إدخال رمز التحقق المكون من 6 أرقام");
      return;
    }

    const cleanPhone = phoneNumber.replace(/\s/g, "");
    const fullPhone = cleanPhone.startsWith("+") ? cleanPhone : `+966${cleanPhone.startsWith("0") ? cleanPhone.slice(1) : cleanPhone}`;

    setLoading(true);
    try {
      const { error: authError } = await verifyOtp(fullPhone, otpCode);
      if (authError) {
        setError("رمز التحقق غير صحيح أو منتهي الصلاحية");
        return;
      }
      onSuccess();
    } catch {
      setError("حدث خطأ. يرجى المحاولة مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="pt-12 px-4 pb-3">
        <button onClick={mode === "otp" ? () => setMode("phone") : onBack} className="w-9 h-9 rounded-full glass flex items-center justify-center">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 px-6 flex flex-col justify-center">
        <div className="mb-8">
          {mode === "login" && (
            <>
              <h1 className="text-2xl font-bold mb-2">مرحباً بك</h1>
              <p className="text-sm text-muted-foreground">سجل الدخول للمتابعة</p>
            </>
          )}
          {mode === "signup" && (
            <>
              <h1 className="text-2xl font-bold mb-2">إنشاء حساب جديد</h1>
              <p className="text-sm text-muted-foreground">أنشئ حسابك للبدء في استخدام المفتاح الشهري</p>
            </>
          )}
          {mode === "phone" && (
            <>
              <h1 className="text-2xl font-bold mb-2">الدخول برقم الجوال</h1>
              <p className="text-sm text-muted-foreground">أدخل رقم جوالك وسنرسل لك رمز تحقق</p>
            </>
          )}
          {mode === "otp" && (
            <>
              <h1 className="text-2xl font-bold mb-2">رمز التحقق</h1>
              <p className="text-sm text-muted-foreground">أدخل الرمز المرسل إلى {phoneNumber}</p>
            </>
          )}
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-4 p-3 rounded-xl text-sm font-medium" style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Email/Password Form */}
        {(mode === "login" || mode === "signup") && (
          <div className="space-y-4">
            <AnimatePresence>
              {mode === "signup" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <label className="text-xs text-muted-foreground mb-1.5 block">الاسم الكامل</label>
                  <div className="relative">
                    <UserPlus className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="أحمد محمد" className="w-full h-12 pr-10 pl-4 rounded-xl glass bg-transparent text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground" dir="rtl" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} placeholder="email@example.com" className="w-full h-12 px-10 rounded-xl glass bg-transparent text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground" dir="ltr" />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} placeholder="••••••••" className="w-full h-12 px-10 rounded-xl glass bg-transparent text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground" dir="ltr" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                  {showPassword ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
            </div>

            <button onClick={handleEmailSubmit} disabled={loading} className="w-full h-12 rounded-xl font-bold text-white text-base transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /><span>جاري {mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب"}...</span></>
              ) : (
                <>{mode === "login" ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}<span>{mode === "login" ? "تسجيل الدخول" : "إنشاء حساب"}</span></>
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-[11px] text-muted-foreground">أو</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {/* Phone OTP Button */}
            <button onClick={() => { setMode("phone"); setError(null); }} className="w-full h-12 rounded-xl font-bold text-sm glass flex items-center justify-center gap-2 transition-all hover:bg-card/80">
              <Phone className="w-5 h-5 text-primary" />
              <span>الدخول برقم الجوال</span>
            </button>

            <p className="text-center text-xs text-muted-foreground mt-2">
              {mode === "login" ? (
                <>ليس لديك حساب؟{" "}<button onClick={() => { setMode("signup"); setError(null); }} className="text-primary font-medium">إنشاء حساب</button></>
              ) : (
                <>لديك حساب بالفعل؟{" "}<button onClick={() => { setMode("login"); setError(null); }} className="text-primary font-medium">تسجيل الدخول</button></>
              )}
            </p>
          </div>
        )}

        {/* Phone Number Input */}
        {mode === "phone" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">رقم الجوال</label>
              <div className="flex gap-2">
                <div className="flex items-center gap-1.5 px-3 h-12 rounded-xl glass text-sm font-medium flex-shrink-0">
                  <span>🇸🇦</span>
                  <span dir="ltr">+966</span>
                </div>
                <div className="relative flex-1">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => { setPhoneNumber(e.target.value.replace(/[^\d\s]/g, "")); setError(null); }}
                    placeholder="5XX XXX XXXX"
                    className="w-full h-12 pr-10 pl-4 rounded-xl glass bg-transparent text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                    dir="ltr"
                    maxLength={12}
                  />
                </div>
              </div>
            </div>

            <button onClick={handlePhoneSubmit} disabled={loading} className="w-full h-12 rounded-xl font-bold text-white text-base transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /><span>جاري الإرسال...</span></>
              ) : (
                <><Phone className="w-5 h-5" /><span>إرسال رمز التحقق</span></>
              )}
            </button>

            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-[11px] text-muted-foreground">أو</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            <button onClick={() => { setMode("login"); setError(null); }} className="w-full h-12 rounded-xl font-bold text-sm glass flex items-center justify-center gap-2 transition-all hover:bg-card/80">
              <Mail className="w-5 h-5 text-primary" />
              <span>الدخول بالبريد الإلكتروني</span>
            </button>
          </div>
        )}

        {/* OTP Verification */}
        {mode === "otp" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">رمز التحقق (6 أرقام)</label>
              <input
                ref={otpInputRef}
                type="text"
                inputMode="numeric"
                value={otpCode}
                onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(null); }}
                placeholder="000000"
                className="w-full h-14 rounded-xl glass bg-transparent text-2xl text-center font-bold tracking-[0.5em] outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/30"
                dir="ltr"
                maxLength={6}
                autoComplete="one-time-code"
              />
            </div>

            <button onClick={handleOtpVerify} disabled={loading || otpCode.length !== 6} className="w-full h-12 rounded-xl font-bold text-white text-base transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /><span>جاري التحقق...</span></>
              ) : (
                <><Check className="w-5 h-5" /><span>تأكيد</span></>
              )}
            </button>

            <button onClick={handlePhoneSubmit} disabled={loading} className="w-full text-center text-xs text-primary font-medium mt-2">
              لم يصلك الرمز؟ إعادة الإرسال
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
