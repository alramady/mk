/**
 * MobileApp — Full mobile app preview inside a phone frame
 * Design: "Oasis" — Organic Saudi Tech
 * Arabic-first RTL, deep navy, frosted glass, Tajawal typography
 * Auth: Supabase Auth (real email/password)
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Search, CalendarDays, User, ChevronRight, MapPin, BedDouble, Bath, Maximize, Wifi, Car, Wind, Star, Heart, Bell, Filter, X, Check, CreditCard, Building2, ChevronLeft, Loader2, Eye, EyeOff, Mail, Lock, UserPlus, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ─── Image URLs ───
const IMAGES = {
  hero: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/Qa7Q2PtJqyYVmLJFM69a8Y/hero-riyadh-mrK3PJVdGeLBcb9uR3WKW9.webp",
  luxury: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/Qa7Q2PtJqyYVmLJFM69a8Y/property-luxury-P8wFPV68gDRvJhc7kvWgqa.webp",
  modern: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/Qa7Q2PtJqyYVmLJFM69a8Y/property-modern-XQ4H9LtYsmuJGgmBS6peYS.webp",
  family: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/Qa7Q2PtJqyYVmLJFM69a8Y/property-family-8VQZMgL2X4fWP3Q8HELFip.webp",
  searchBg: "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/Qa7Q2PtJqyYVmLJFM69a8Y/search-bg-eBLVDmGqvnWDmR6SpuS84U.webp",
};

// ─── Mock Data ───
interface Property {
  id: number;
  titleAr: string;
  city: string;
  district: string;
  monthlyRate: number;
  dailyRate: number;
  bedrooms: number;
  bathrooms: number;
  area: number;
  image: string;
  amenities: string[];
  rating: number;
  isNew: boolean;
}

const PROPERTIES: Property[] = [
  {
    id: 1,
    titleAr: "شقة فاخرة في حي العليا",
    city: "الرياض",
    district: "العليا",
    monthlyRate: 12300,
    dailyRate: 500,
    bedrooms: 3,
    bathrooms: 2,
    area: 180,
    image: IMAGES.luxury,
    amenities: ["wifi", "parking", "ac"],
    rating: 4.8,
    isNew: true,
  },
  {
    id: 2,
    titleAr: "استوديو عصري بإطلالة بحرية",
    city: "جدة",
    district: "الشاطئ",
    monthlyRate: 8500,
    dailyRate: 345,
    bedrooms: 1,
    bathrooms: 1,
    area: 65,
    image: IMAGES.modern,
    amenities: ["wifi", "ac"],
    rating: 4.5,
    isNew: false,
  },
  {
    id: 3,
    titleAr: "فيلا عائلية مع مسبح خاص",
    city: "الرياض",
    district: "النخيل",
    monthlyRate: 25000,
    dailyRate: 1015,
    bedrooms: 5,
    bathrooms: 4,
    area: 350,
    image: IMAGES.family,
    amenities: ["wifi", "parking", "ac", "pool"],
    rating: 4.9,
    isNew: true,
  },
  {
    id: 4,
    titleAr: "شقة مفروشة في حي الملقا",
    city: "الرياض",
    district: "الملقا",
    monthlyRate: 9800,
    dailyRate: 398,
    bedrooms: 2,
    bathrooms: 2,
    area: 120,
    image: IMAGES.luxury,
    amenities: ["wifi", "parking", "ac"],
    rating: 4.6,
    isNew: false,
  },
  {
    id: 5,
    titleAr: "شقة حديثة قرب البوليفارد",
    city: "الرياض",
    district: "حطين",
    monthlyRate: 15000,
    dailyRate: 610,
    bedrooms: 3,
    bathrooms: 3,
    area: 200,
    image: IMAGES.modern,
    amenities: ["wifi", "parking", "ac", "gym"],
    rating: 4.7,
    isNew: true,
  },
];

const CITIES = ["الرياض", "جدة", "الدمام", "مكة المكرمة", "المدينة المنورة", "الخبر"];

// ─── Pricing Utils ───
function formatPrice(amount: number): string {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function calculateBookingTotal(monthlyRent: number, months: number) {
  const baseRent = monthlyRent * months;
  const serviceFee = baseRent * 0.05;
  const vat = (baseRent + serviceFee) * 0.15;
  const deposit = monthlyRent;
  const total = baseRent + serviceFee + vat + deposit;
  return { baseRent, serviceFee, vat, deposit, total };
}

// ─── Tab Types ───
type TabId = "home" | "search" | "bookings" | "profile";
type ScreenId = "tabs" | "property-detail" | "booking-flow" | "login";

// ─── Amenity Icon Map ───
function AmenityIcon({ type }: { type: string }) {
  switch (type) {
    case "wifi": return <Wifi className="w-4 h-4" />;
    case "parking": return <Car className="w-4 h-4" />;
    case "ac": return <Wind className="w-4 h-4" />;
    default: return <Star className="w-4 h-4" />;
  }
}

const amenityLabels: Record<string, string> = {
  wifi: "واي فاي",
  parking: "موقف سيارات",
  ac: "تكييف",
  pool: "مسبح",
  gym: "صالة رياضية",
};

// ─── Main Component ───
export default function MobileApp() {
  const { user, isLoggedIn, isLoading: authLoading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [screen, setScreen] = useState<ScreenId>("tabs");
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [bookingStep, setBookingStep] = useState(0);
  const [bookingMonths, setBookingMonths] = useState(3);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [showFilter, setShowFilter] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  const openProperty = useCallback((property: Property) => {
    setSelectedProperty(property);
    setScreen("property-detail");
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
    setSelectedProperty(null);
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
    toast.success("تم تسجيل الخروج بنجاح");
  }, [signOut]);

  const handleLoginSuccess = useCallback(() => {
    if (selectedProperty) {
      setBookingStep(0);
      setBookingConfirmed(false);
      setScreen("booking-flow");
    } else {
      setScreen("tabs");
    }
    toast.success("تم تسجيل الدخول بنجاح");
  }, [selectedProperty]);

  const filteredProperties = PROPERTIES.filter((p) => {
    if (selectedCity && p.city !== selectedCity) return false;
    if (searchQuery && !p.titleAr.includes(searchQuery) && !p.district.includes(searchQuery)) return false;
    return true;
  });

  // Get user display info
  const userDisplayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "مستخدم";
  const userEmail = user?.email || "";
  const userInitials = userDisplayName.slice(0, 2);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8" style={{ background: "linear-gradient(135deg, #050A15 0%, #0B1426 40%, #0D1A33 100%)" }}>
      {/* Phone Frame */}
      <div className="phone-frame bg-background relative flex flex-col">
        {/* Notch */}
        <div className="phone-notch" />

        {/* Screen Content */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {screen === "tabs" && (
              <motion.div
                key="tabs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="h-full flex flex-col"
              >
                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto" style={{ paddingBottom: "80px" }}>
                  {activeTab === "home" && (
                    <HomeTab
                      properties={PROPERTIES}
                      onOpenProperty={openProperty}
                      favorites={favorites}
                      onToggleFavorite={toggleFavorite}
                    />
                  )}
                  {activeTab === "search" && (
                    <SearchTab
                      properties={filteredProperties}
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
                    <BookingsTab isLoggedIn={isLoggedIn} onLogin={() => setScreen("login")} />
                  )}
                  {activeTab === "profile" && (
                    <ProfileTab
                      isLoggedIn={isLoggedIn}
                      onLogin={() => setScreen("login")}
                      onLogout={handleLogout}
                      userName={userDisplayName}
                      userEmail={userEmail}
                      userInitials={userInitials}
                    />
                  )}
                </div>

                {/* Bottom Tab Bar */}
                <div className="absolute bottom-0 left-0 right-0 glass-strong" style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}>
                  <div className="flex items-center justify-around h-16">
                    {([
                      { id: "home" as TabId, icon: Home, label: "الرئيسية" },
                      { id: "search" as TabId, icon: Search, label: "البحث" },
                      { id: "bookings" as TabId, icon: CalendarDays, label: "حجوزاتي" },
                      { id: "profile" as TabId, icon: User, label: "حسابي" },
                    ]).map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="flex flex-col items-center gap-1 transition-all duration-200"
                      >
                        <tab.icon
                          className={`w-5 h-5 transition-colors ${
                            activeTab === tab.id ? "text-primary" : "text-muted-foreground"
                          }`}
                        />
                        <span
                          className={`text-[10px] font-medium transition-colors ${
                            activeTab === tab.id ? "text-primary" : "text-muted-foreground"
                          }`}
                        >
                          {tab.label}
                        </span>
                        {activeTab === tab.id && (
                          <motion.div
                            layoutId="tab-indicator"
                            className="w-1 h-1 rounded-full bg-primary"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {screen === "property-detail" && selectedProperty && (
              <motion.div
                key="detail"
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -100, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="h-full"
              >
                <PropertyDetail
                  property={selectedProperty}
                  onBack={goBack}
                  onBook={startBooking}
                  isFavorite={favorites.has(selectedProperty.id)}
                  onToggleFavorite={() => toggleFavorite(selectedProperty.id)}
                />
              </motion.div>
            )}

            {screen === "booking-flow" && selectedProperty && (
              <motion.div
                key="booking"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="h-full"
              >
                <BookingFlow
                  property={selectedProperty}
                  step={bookingStep}
                  months={bookingMonths}
                  onMonthsChange={setBookingMonths}
                  onNext={() => {
                    if (bookingStep < 3) setBookingStep((s) => s + 1);
                    if (bookingStep === 2) setBookingConfirmed(true);
                  }}
                  onBack={goBack}
                  confirmed={bookingConfirmed}
                />
              </motion.div>
            )}

            {screen === "login" && (
              <motion.div
                key="login"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="h-full"
              >
                <LoginScreen
                  onSuccess={handleLoginSuccess}
                  onBack={goBack}
                />
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
  properties,
  onOpenProperty,
  favorites,
  onToggleFavorite,
}: {
  properties: Property[];
  onOpenProperty: (p: Property) => void;
  favorites: Set<number>;
  onToggleFavorite: (id: number) => void;
}) {
  const featured = properties.filter((p) => p.isNew);
  const popular = properties.filter((p) => p.rating >= 4.7);

  return (
    <div className="pt-12">
      {/* Hero Section */}
      <div className="relative h-[280px] overflow-hidden">
        <img
          src={IMAGES.hero}
          alt="الرياض"
          className="w-full h-full object-cover"
        />
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

      {/* City Pills */}
      <div className="px-4 py-4">
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {CITIES.map((city) => (
            <button key={city} className="px-4 py-2 rounded-full text-xs font-medium glass whitespace-nowrap transition-all hover:bg-card/80">
              {city}
            </button>
          ))}
        </div>
      </div>

      {/* Featured */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">عقارات مميزة</h2>
          <button className="text-xs text-primary flex items-center gap-0.5">
            عرض الكل <ChevronLeft className="w-3 h-3" />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {featured.map((property, i) => (
            <motion.div
              key={property.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="min-w-[260px]"
            >
              <PropertyCard
                property={property}
                onPress={() => onOpenProperty(property)}
                isFavorite={favorites.has(property.id)}
                onToggleFavorite={() => onToggleFavorite(property.id)}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Popular */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">الأكثر طلباً</h2>
          <button className="text-xs text-primary flex items-center gap-0.5">
            عرض الكل <ChevronLeft className="w-3 h-3" />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {popular.map((property, i) => (
            <motion.div
              key={property.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <PropertyCard
                property={property}
                onPress={() => onOpenProperty(property)}
                isFavorite={favorites.has(property.id)}
                onToggleFavorite={() => onToggleFavorite(property.id)}
                size="compact"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Property Card ───
function PropertyCard({
  property,
  onPress,
  isFavorite,
  onToggleFavorite,
  size = "large",
}: {
  property: Property;
  onPress: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  size?: "large" | "compact";
}) {
  if (size === "compact") {
    return (
      <button onClick={onPress} className="w-full flex gap-3 glass rounded-2xl p-3 text-right transition-all hover:bg-card/80 active:scale-[0.98]">
        <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0">
          <img src={property.image} alt={property.titleAr} className="w-full h-full object-cover" />
          {property.isNew && (
            <div className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
              جديد
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col justify-between py-0.5">
          <div>
            <h3 className="text-sm font-bold leading-tight mb-1">{property.titleAr}</h3>
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span className="text-[11px]">{property.city} - {property.district}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-0.5"><BedDouble className="w-3 h-3" />{property.bedrooms}</span>
              <span className="flex items-center gap-0.5"><Bath className="w-3 h-3" />{property.bathrooms}</span>
              <span className="flex items-center gap-0.5"><Maximize className="w-3 h-3" />{property.area}م²</span>
            </div>
            <span className="text-sm font-bold gradient-text">{formatPrice(property.monthlyRate)}</span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button onClick={onPress} className="w-full rounded-2xl overflow-hidden glass text-right transition-all hover:bg-card/80 active:scale-[0.98]">
      <div className="relative h-[160px]">
        <img src={property.image} alt={property.titleAr} className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(11,20,38,0.7) 0%, transparent 50%)" }} />
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className="absolute top-3 left-3 w-8 h-8 rounded-full glass flex items-center justify-center"
        >
          <Heart className={`w-4 h-4 ${isFavorite ? "fill-red-500 text-red-500" : "text-white/70"}`} />
        </button>
        {property.isNew && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
            جديد
          </div>
        )}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full glass">
          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
          <span className="text-[11px] font-bold text-white">{property.rating}</span>
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-sm font-bold mb-1 leading-tight">{property.titleAr}</h3>
        <div className="flex items-center gap-1 text-muted-foreground mb-2">
          <MapPin className="w-3 h-3" />
          <span className="text-[11px]">{property.city} - {property.district}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-0.5"><BedDouble className="w-3 h-3" />{property.bedrooms}</span>
            <span className="flex items-center gap-0.5"><Bath className="w-3 h-3" />{property.bathrooms}</span>
          </div>
          <div className="text-left">
            <span className="text-base font-bold gradient-text">{formatPrice(property.monthlyRate)}</span>
            <span className="text-[10px] text-muted-foreground mr-1">/ شهرياً</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Search Tab ───
function SearchTab({
  properties,
  onOpenProperty,
  searchQuery,
  onSearchChange,
  selectedCity,
  onCityChange,
  showFilter,
  onToggleFilter,
  favorites,
  onToggleFavorite,
}: {
  properties: Property[];
  onOpenProperty: (p: Property) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCity: string | null;
  onCityChange: (city: string | null) => void;
  showFilter: boolean;
  onToggleFilter: () => void;
  favorites: Set<number>;
  onToggleFavorite: (id: number) => void;
}) {
  return (
    <div className="pt-12">
      {/* Search Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold mb-3">البحث عن عقار</h1>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 glass rounded-xl px-3 py-2.5">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              placeholder="ابحث بالحي أو المدينة..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-transparent text-sm w-full outline-none placeholder:text-muted-foreground"
              dir="rtl"
            />
            {searchQuery && (
              <button onClick={() => onSearchChange("")}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <button
            onClick={onToggleFilter}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${showFilter ? "bg-primary text-white" : "glass"}`}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* City Filter */}
      <AnimatePresence>
        {showFilter && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              <p className="text-xs text-muted-foreground mb-2">المدينة</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onCityChange(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${!selectedCity ? "bg-primary text-white" : "glass"}`}
                >
                  الكل
                </button>
                {CITIES.map((city) => (
                  <button
                    key={city}
                    onClick={() => onCityChange(city === selectedCity ? null : city)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${selectedCity === city ? "bg-primary text-white" : "glass"}`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <div className="px-4">
        <p className="text-xs text-muted-foreground mb-3">{properties.length} نتيجة</p>
        <div className="flex flex-col gap-3 pb-4">
          {properties.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">لا توجد نتائج</p>
            </div>
          ) : (
            properties.map((property, i) => (
              <motion.div
                key={property.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <PropertyCard
                  property={property}
                  onPress={() => onOpenProperty(property)}
                  isFavorite={favorites.has(property.id)}
                  onToggleFavorite={() => onToggleFavorite(property.id)}
                  size="compact"
                />
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Property Detail ───
function PropertyDetail({
  property,
  onBack,
  onBook,
  isFavorite,
  onToggleFavorite,
}: {
  property: Property;
  onBack: () => void;
  onBook: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {/* Hero Image */}
        <div className="relative h-[300px]">
          <img src={property.image} alt={property.titleAr} className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(11,20,38,0.4) 0%, transparent 30%, rgba(11,20,38,0.9) 90%)" }} />

          {/* Top Bar */}
          <div className="absolute top-12 right-4 left-4 flex items-center justify-between">
            <button onClick={onBack} className="w-10 h-10 rounded-full glass flex items-center justify-center">
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
            <div className="flex gap-2">
              <button onClick={onToggleFavorite} className="w-10 h-10 rounded-full glass flex items-center justify-center">
                <Heart className={`w-5 h-5 ${isFavorite ? "fill-red-500 text-red-500" : "text-white"}`} />
              </button>
              <button className="w-10 h-10 rounded-full glass flex items-center justify-center">
                <Bell className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Bottom Info */}
          <div className="absolute bottom-4 right-4 left-4">
            <div className="flex items-center gap-1 mb-1">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-sm font-bold text-white">{property.rating}</span>
            </div>
            <h1 className="text-xl font-bold text-white mb-1">{property.titleAr}</h1>
            <div className="flex items-center gap-1 text-white/70">
              <MapPin className="w-3.5 h-3.5" />
              <span className="text-sm">{property.city} - {property.district}</span>
            </div>
          </div>
        </div>

        {/* Price Badge */}
        <div className="px-4 -mt-3 relative z-10">
          <div className="inline-flex items-baseline gap-1 px-4 py-2.5 rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(124,58,237,0.15))", border: "1px solid rgba(37,99,235,0.2)" }}>
            <span className="text-2xl font-bold gradient-text">{formatPrice(property.monthlyRate)}</span>
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
              <span className="text-lg font-bold block">{property.area}</span>
              <span className="text-[10px] text-muted-foreground">م²</span>
            </div>
          </div>
        </div>

        {/* Amenities */}
        <div className="px-4 mt-5">
          <h3 className="text-base font-bold mb-3">المرافق والخدمات</h3>
          <div className="flex flex-wrap gap-2">
            {property.amenities.map((amenity) => (
              <div key={amenity} className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass">
                <AmenityIcon type={amenity} />
                <span className="text-xs">{amenityLabels[amenity] || amenity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Rate Info */}
        <div className="px-4 mt-5 mb-4">
          <div className="glass rounded-2xl p-4">
            <h3 className="text-sm font-bold mb-2">تفاصيل السعر</h3>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-muted-foreground">السعر اليومي</span>
              <span className="font-bold">{formatPrice(property.dailyRate)}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-muted-foreground">الإيجار الشهري</span>
              <span className="font-bold gradient-text">{formatPrice(property.monthlyRate)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">الخصم الشهري</span>
              <span className="font-bold text-accent">18%</span>
            </div>
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-[11px] text-muted-foreground">
                الإيجار الشهري = السعر اليومي × 30 × (1 - 18%)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Book Button */}
      <div className="p-4 glass-strong">
        <button
          onClick={onBook}
          className="w-full h-12 rounded-xl font-bold text-white text-base transition-all active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}
        >
          إتمام الحجز
        </button>
      </div>
    </div>
  );
}

// ─── Booking Flow ───
function BookingFlow({
  property,
  step,
  months,
  onMonthsChange,
  onNext,
  onBack,
  confirmed,
}: {
  property: Property;
  step: number;
  months: number;
  onMonthsChange: (m: number) => void;
  onNext: () => void;
  onBack: () => void;
  confirmed: boolean;
}) {
  const breakdown = calculateBookingTotal(property.monthlyRate, months);
  const steps = ["المدة", "التكلفة", "الدفع", "التأكيد"];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="pt-12 px-4 pb-3 glass-strong">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="w-9 h-9 rounded-full glass flex items-center justify-center">
            <ChevronRight className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold">إتمام الحجز</h2>
          <div className="w-9" />
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-1">
          {steps.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={`h-1 w-full rounded-full transition-all ${i <= step ? "bg-primary" : "bg-muted"}`} />
              <span className={`text-[9px] ${i <= step ? "text-primary font-medium" : "text-muted-foreground"}`}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="duration" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <h3 className="text-lg font-bold mb-4">اختر مدة الإقامة</h3>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[1, 3, 6, 9, 12].map((m) => (
                  <button
                    key={m}
                    onClick={() => onMonthsChange(m)}
                    className={`py-4 rounded-xl text-center transition-all ${months === m ? "text-white font-bold" : "glass"}`}
                    style={months === m ? { background: "linear-gradient(135deg, #2563EB, #7C3AED)" } : {}}
                  >
                    <span className="text-xl font-bold block">{m}</span>
                    <span className="text-[10px]">{m === 1 ? "شهر" : m < 11 ? "أشهر" : "شهر"}</span>
                  </button>
                ))}
              </div>

              <div className="glass rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <img src={property.image} alt="" className="w-14 h-14 rounded-xl object-cover" />
                  <div>
                    <h4 className="text-sm font-bold">{property.titleAr}</h4>
                    <p className="text-[11px] text-muted-foreground">{property.city} - {property.district}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">الإيجار الشهري</span>
                  <span className="font-bold">{formatPrice(property.monthlyRate)}</span>
                </div>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="cost" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <h3 className="text-lg font-bold mb-4">تفاصيل التكلفة</h3>
              <div className="glass rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">الإيجار الأساسي ({months} أشهر)</span>
                  <span className="font-medium">{formatPrice(breakdown.baseRent)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">رسوم الخدمة (5%)</span>
                  <span className="font-medium">{formatPrice(breakdown.serviceFee)}</span>
                </div>
                <div className="h-px bg-border/50" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">ضريبة القيمة المضافة (15%)</span>
                  <span className="font-medium">{formatPrice(breakdown.vat)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">مبلغ التأمين (شهر واحد)</span>
                  <span className="font-medium">{formatPrice(breakdown.deposit)}</span>
                </div>
                <div className="h-px bg-border/50" />
                <div className="flex items-center justify-between">
                  <span className="font-bold">المجموع</span>
                  <span className="text-xl font-bold gradient-text">{formatPrice(breakdown.total)}</span>
                </div>
              </div>

              <div className="mt-4 glass rounded-xl p-3">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  ضريبة القيمة المضافة محسوبة على الإيجار + رسوم الخدمة. مبلغ التأمين قابل للاسترداد عند انتهاء العقد.
                </p>
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
                  <motion.button
                    key={method.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={onNext}
                    className="w-full flex items-center gap-3 glass rounded-xl p-4 text-right transition-all hover:bg-card/80 active:scale-[0.98]"
                  >
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
            <motion.div
              key="confirmed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 10, stiffness: 200, delay: 0.2 }}
                className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
                style={{ background: "linear-gradient(135deg, #10B981, #059669)" }}
              >
                <Check className="w-10 h-10 text-white" />
              </motion.div>
              <h3 className="text-xl font-bold mb-2">تم إنشاء الحجز بنجاح!</h3>
              <p className="text-sm text-muted-foreground text-center mb-6">
                سيتم مراجعة حجزك من قبل المالك وإشعارك بالنتيجة
              </p>
              <div className="glass rounded-2xl p-4 w-full">
                <div className="flex items-center gap-3 mb-3">
                  <img src={property.image} alt="" className="w-12 h-12 rounded-xl object-cover" />
                  <div>
                    <h4 className="text-sm font-bold">{property.titleAr}</h4>
                    <p className="text-[11px] text-muted-foreground">{months} أشهر</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">المجموع</span>
                  <span className="font-bold gradient-text">{formatPrice(breakdown.total)}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Action */}
      {step < 2 && (
        <div className="p-4 glass-strong">
          <button
            onClick={onNext}
            className="w-full h-12 rounded-xl font-bold text-white text-base transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}
          >
            {step === 0 ? "التالي" : step === 1 ? "اختر طريقة الدفع" : "تأكيد"}
          </button>
        </div>
      )}

      {step === 3 && confirmed && (
        <div className="p-4 glass-strong">
          <button
            onClick={onBack}
            className="w-full h-12 rounded-xl font-bold text-white text-base transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}
          >
            العودة للرئيسية
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Bookings Tab ───
function BookingsTab({ isLoggedIn, onLogin }: { isLoggedIn: boolean; onLogin: () => void }) {
  if (!isLoggedIn) {
    return (
      <div className="pt-12 flex flex-col items-center justify-center h-full px-8">
        <CalendarDays className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-bold mb-2">حجوزاتي</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">سجل الدخول لعرض حجوزاتك</p>
        <button
          onClick={onLogin}
          className="px-8 py-3 rounded-xl font-bold text-white text-sm transition-all active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}
        >
          تسجيل الدخول
        </button>
      </div>
    );
  }

  const mockBookings = [
    { id: 1, title: "شقة فاخرة في حي العليا", status: "confirmed", amount: 23112, date: "2026-04-01" },
    { id: 2, title: "استوديو عصري بإطلالة بحرية", status: "pending", amount: 18000, date: "2026-05-15" },
  ];

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    confirmed: { bg: "rgba(16,185,129,0.15)", text: "#10B981", label: "مؤكد" },
    pending: { bg: "rgba(245,158,11,0.15)", text: "#F59E0B", label: "قيد المراجعة" },
    rejected: { bg: "rgba(239,68,68,0.15)", text: "#EF4444", label: "مرفوض" },
  };

  return (
    <div className="pt-12 px-4">
      <h1 className="text-xl font-bold mb-4 pt-4">حجوزاتي</h1>
      <div className="space-y-3">
        {mockBookings.map((booking, i) => {
          const status = statusColors[booking.status] || statusColors.pending;
          return (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-2xl p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-bold flex-1">{booking.title}</h3>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: status.bg, color: status.text }}>
                  {status.label}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground text-xs">{booking.date}</span>
                <span className="font-bold gradient-text">{formatPrice(booking.amount)}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Profile Tab ───
function ProfileTab({
  isLoggedIn,
  onLogin,
  onLogout,
  userName,
  userEmail,
  userInitials,
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
        <button
          onClick={onLogin}
          className="px-8 py-3 rounded-xl font-bold text-white text-sm transition-all active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}
        >
          تسجيل الدخول
        </button>
      </div>
    );
  }

  return (
    <div className="pt-12 px-4">
      {/* Profile Header */}
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

      {/* Menu Items */}
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

      {/* Logout */}
      <button
        onClick={onLogout}
        className="w-full mt-6 py-3 rounded-xl text-sm font-bold text-destructive glass transition-all hover:bg-destructive/10"
      >
        تسجيل الخروج
      </button>
    </div>
  );
}

// ─── Login Screen (Real Supabase Auth) ───
function LoginScreen({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (!email.trim()) {
      setError("يرجى إدخال البريد الإلكتروني");
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const { error: authError } = await signIn(email, password);
        if (authError) {
          if (authError.message.includes("Invalid login")) {
            setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
          } else {
            setError(authError.message);
          }
          return;
        }
        onSuccess();
      } else {
        if (!fullName.trim()) {
          setError("يرجى إدخال الاسم الكامل");
          setLoading(false);
          return;
        }
        const { error: authError } = await signUp(email, password, fullName);
        if (authError) {
          if (authError.message.includes("already registered")) {
            setError("هذا البريد الإلكتروني مسجل بالفعل");
          } else {
            setError(authError.message);
          }
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="pt-12 px-4 pb-3">
        <button onClick={onBack} className="w-9 h-9 rounded-full glass flex items-center justify-center">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 px-6 flex flex-col justify-center">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">
            {mode === "login" ? "مرحباً بك" : "إنشاء حساب جديد"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "سجل الدخول للمتابعة" : "أنشئ حسابك للبدء في استخدام المفتاح الشهري"}
          </p>
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 rounded-xl text-sm font-medium"
              style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <div className="space-y-4">
          {/* Full Name (signup only) */}
          <AnimatePresence>
            {mode === "signup" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <label className="text-xs text-muted-foreground mb-1.5 block">الاسم الكامل</label>
                <div className="relative">
                  <UserPlus className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="أحمد محمد"
                    className="w-full h-12 pr-10 pl-4 rounded-xl glass bg-transparent text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                    dir="rtl"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="email@example.com"
                className="w-full h-12 px-10 rounded-xl glass bg-transparent text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                dir="ltr"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder="••••••••"
                className="w-full h-12 pl-10 pr-12 rounded-xl glass bg-transparent text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Eye className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full h-12 rounded-xl font-bold text-white text-base mt-6 transition-all active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>جاري {mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب"}...</span>
            </>
          ) : (
            <>
              {mode === "login" ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              <span>{mode === "login" ? "تسجيل الدخول" : "إنشاء حساب"}</span>
            </>
          )}
        </button>

        {/* Toggle Mode */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          {mode === "login" ? (
            <>
              ليس لديك حساب؟{" "}
              <button onClick={() => { setMode("signup"); setError(null); }} className="text-primary font-medium">
                إنشاء حساب
              </button>
            </>
          ) : (
            <>
              لديك حساب بالفعل؟{" "}
              <button onClick={() => { setMode("login"); setError(null); }} className="text-primary font-medium">
                تسجيل الدخول
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
