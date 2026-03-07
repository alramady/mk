/**
 * MobileApp — Full mobile app preview inside a phone frame
 * Design: "Oasis" — Organic Saudi Tech
 * Arabic-first RTL, deep navy, frosted glass, Tajawal typography
 * Auth: Supabase Auth (email/password + phone OTP)
 * Data: Real API from monthlykey.com via server proxy
 * Features: Interactive map, bookings tracking, phone OTP login,
 *           Supabase-backed favorites, push notifications, favorites tab
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Search, CalendarDays, User, ChevronRight, MapPin, BedDouble, Bath,
  Maximize, Wifi, Car, Wind, Star, Heart, Bell, Filter, X, Check,
  CreditCard, Building2, ChevronLeft, Loader2, Eye, EyeOff, Mail, Lock,
  UserPlus, LogIn, RefreshCw, Phone, MapPinned, Navigation,
  Clock, CheckCircle2, XCircle, BellRing, BellOff, Settings,
  SlidersHorizontal, MessageSquare, Send, Trash2, Info,
  ArrowUpDown, ArrowUp, ArrowDown,
  Wallet, ThumbsUp, Globe, HelpCircle, FileText, Shield,
  Users, Share2, BarChart3, ShieldCheck, UserCog, Briefcase,
  Calendar, ChevronDown, MoreHorizontal,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  getFeaturedProperties, searchProperties, getPropertyById,
  calculateBookingTotal, propertyTypeLabels, furnishedLabels,
  type ApiProperty, type SearchParams,
} from "@/lib/api";
import {
  fetchFavorites, addFavorite, removeFavorite,
  getLocalFavorites, addLocalFavorite, removeLocalFavorite, syncLocalToSupabase,
} from "@/lib/favorites";
import {
  getNotificationPrefs, saveNotificationPrefs, requestNotificationPermission,
  sendLocalNotification, notificationTemplates,
  type NotificationPrefs,
} from "@/lib/notifications";
import {
  fetchReviews, submitReview, getAverageRating, generateDemoReviews, getDemoAverageRating,
  type Review,
} from "@/lib/reviews";
import {
  getRecentlyViewed, addRecentlyViewed, clearRecentlyViewed,
  type RecentlyViewedEntry,
} from "@/lib/recentlyViewed";

// ─── Hero Image (generated) ───
const HERO_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/Qa7Q2PtJqyYVmLJFM69a8Y/hero-riyadh-mrK3PJVdGeLBcb9uR3WKW9.webp";

// ─── MK Logo (SVG, transparent) ───
const MK_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663340926600/Qa7Q2PtJqyYVmLJFM69a8Y/mk-logo_78e14317.svg";

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
type TabId = "home" | "search" | "favorites" | "bookings" | "profile";
type ScreenId = "tabs" | "property-detail" | "booking-flow" | "login" | "notifications-settings" | "twilio-setup" | "profile-completion" | "admin-panel";
type SortOption = "default" | "price_asc" | "price_desc" | "newest" | "rating";

const SORT_OPTIONS: { value: SortOption; label: string; icon: typeof ArrowUpDown }[] = [
  { value: "default", label: "الافتراضي", icon: ArrowUpDown },
  { value: "price_asc", label: "السعر: الأقل", icon: ArrowUp },
  { value: "price_desc", label: "السعر: الأعلى", icon: ArrowDown },
  { value: "newest", label: "الأحدث", icon: Clock },
  { value: "rating", label: "التقييم", icon: Star },
];

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
  wifi: "واي فاي", parking: "موقف سيارات", ac: "تكييف", pool: "مسبح",
  gym: "صالة رياضية", elevator: "مصعد", security: "أمن", garden: "حديقة",
  balcony: "بلكونة", kitchen: "مطبخ", laundry: "غسالة",
};

// ─── Known cities for quick filter ───
const QUICK_CITIES = ["الرياض", "جدة", "المدينة المنورة", "الدمام", "مكة المكرمة", "الخبر"];

// ─── Interactive Map Component ───
function PropertyMap({ latitude, longitude, title, googleMapsUrl }: {
  latitude: string | null; longitude: string | null; title: string; googleMapsUrl: string | null;
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

  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.008},${lng + 0.01},${lat + 0.008}&layer=mapnik&marker=${lat},${lng}`;
  const fullMapUrl = googleMapsUrl || `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div className="rounded-2xl overflow-hidden border border-border/50">
      <div className="relative h-[200px]">
        <iframe src={mapUrl} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" title={`موقع ${title}`} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(11,20,38,0.1) 0%, transparent 20%, transparent 80%, rgba(11,20,38,0.3) 100%)" }} />
      </div>
      <a href={fullMapUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-3 glass text-sm font-medium text-primary transition-all hover:bg-card/80">
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
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedEntry[]>([]);

  // Load recently viewed on mount
  useEffect(() => {
    setRecentlyViewed(getRecentlyViewed());
  }, []);

  // API data state
  const [featuredProperties, setFeaturedProperties] = useState<ApiProperty[]>([]);
  const [searchResults, setSearchResults] = useState<ApiProperty[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [filterMinPrice, setFilterMinPrice] = useState<number | null>(null);
  const [filterMaxPrice, setFilterMaxPrice] = useState<number | null>(null);
  const [filterBedrooms, setFilterBedrooms] = useState<number | null>(null);
  const [filterFurnished, setFilterFurnished] = useState<string | null>(null);
  const [filterPropertyType, setFilterPropertyType] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorFeatured, setErrorFeatured] = useState<string | null>(null);

  // Load favorites from Supabase or localStorage
  useEffect(() => {
    if (isLoggedIn && user?.id) {
      setFavoritesLoading(true);
      syncLocalToSupabase(user.id).then(() =>
        fetchFavorites(user.id).then((ids) => {
          setFavorites(new Set(ids));
          setFavoritesLoading(false);
        })
      ).catch(() => setFavoritesLoading(false));
    } else {
      const localFavs = getLocalFavorites();
      setFavorites(new Set(localFavs));
    }
  }, [isLoggedIn, user?.id]);

  // Fetch featured properties on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingFeatured(true);
    setErrorFeatured(null);
    getFeaturedProperties()
      .then((data) => {
        if (!cancelled) { setFeaturedProperties(data); setLoadingFeatured(false); }
      })
      .catch((err) => {
        if (!cancelled) { setErrorFeatured("تعذر تحميل العقارات. تحقق من الاتصال بالإنترنت."); setLoadingFeatured(false); console.error("Failed to fetch featured:", err); }
      });
    return () => { cancelled = true; };
  }, []);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterMinPrice !== null) count++;
    if (filterMaxPrice !== null) count++;
    if (filterBedrooms !== null) count++;
    if (filterFurnished !== null) count++;
    if (filterPropertyType !== null) count++;
    if (selectedCity) count++;
    return count;
  }, [filterMinPrice, filterMaxPrice, filterBedrooms, filterFurnished, filterPropertyType, selectedCity]);

  const clearAllFilters = useCallback(() => {
    setFilterMinPrice(null);
    setFilterMaxPrice(null);
    setFilterBedrooms(null);
    setFilterFurnished(null);
    setFilterPropertyType(null);
    setSelectedCity(null);
  }, []);

  // Search properties when filters change
  useEffect(() => {
    let cancelled = false;
    const params: SearchParams = { limit: 20 };
    if (searchQuery.trim()) params.query = searchQuery.trim();
    if (selectedCity) params.city = selectedCity;
    if (filterMinPrice !== null) params.minPrice = filterMinPrice;
    if (filterMaxPrice !== null) params.maxPrice = filterMaxPrice;
    if (filterBedrooms !== null) params.bedrooms = filterBedrooms;
    if (filterFurnished !== null) params.furnishedLevel = filterFurnished;
    if (filterPropertyType !== null) params.propertyType = filterPropertyType;

    setLoadingSearch(true);
    searchProperties(params)
      .then((data) => {
        if (!cancelled) { setSearchResults(data.items); setSearchTotal(data.total); setLoadingSearch(false); }
      })
      .catch((err) => {
        if (!cancelled) { setLoadingSearch(false); console.error("Search failed:", err); }
      });
    return () => { cancelled = true; };
  }, [searchQuery, selectedCity, filterMinPrice, filterMaxPrice, filterBedrooms, filterFurnished, filterPropertyType]);

  const openProperty = useCallback(async (property: ApiProperty) => {
    setSelectedPropertyId(property.id);
    setSelectedPropertyData(property);
    setScreen("property-detail");
    setLoadingDetail(true);
    // Track in recently viewed
    addRecentlyViewed(property);
    setRecentlyViewed(getRecentlyViewed());
    try {
      const full = await getPropertyById(property.id);
      if (full) {
        setSelectedPropertyData(full);
        // Update recently viewed with full data
        addRecentlyViewed(full);
        setRecentlyViewed(getRecentlyViewed());
      }
    } catch (err) {
      console.error("Failed to fetch property detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const startBooking = useCallback(() => {
    if (!isLoggedIn) { setScreen("login"); return; }
    setBookingStep(0);
    setBookingConfirmed(false);
    setScreen("booking-flow");
  }, [isLoggedIn]);

  const goBack = useCallback(() => {
    if (screen === "booking-flow" && bookingStep > 0) { setBookingStep((s) => s - 1); return; }
    if (screen === "notifications-settings" || screen === "twilio-setup" || screen === "profile-completion" || screen === "admin-panel") { setScreen("tabs"); return; }
    setScreen("tabs");
    setSelectedPropertyId(null);
    setSelectedPropertyData(null);
    setBookingStep(0);
    setBookingConfirmed(false);
  }, [screen, bookingStep]);

  const toggleFavorite = useCallback(async (id: number) => {
    const isFav = favorites.has(id);
    // Optimistic update
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    // Persist
    if (isLoggedIn && user?.id) {
      if (isFav) {
        await removeFavorite(user.id, id);
      } else {
        await addFavorite(user.id, id);
      }
    } else {
      if (isFav) {
        removeLocalFavorite(id);
      } else {
        addLocalFavorite(id);
      }
    }
  }, [favorites, isLoggedIn, user?.id]);

  const handleLogout = useCallback(async () => {
    await signOut();
    setScreen("tabs");
    setActiveTab("home");
    setUserBookings([]);
    setFavorites(new Set(getLocalFavorites()));
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

    // Send push notification if enabled
    const prefs = getNotificationPrefs();
    if (prefs.enabled && prefs.bookingUpdates) {
      const { title, body } = notificationTemplates.bookingConfirmed(property.titleAr);
      sendLocalNotification(title, body);
    }
  }, []);

  const userDisplayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "مستخدم";
  const userEmail = user?.email || user?.phone || "";
  const userInitials = userDisplayName.slice(0, 2);

  // Get favorite properties for the favorites tab
  const favoriteProperties = useMemo(() => {
    const allProperties = [...featuredProperties, ...searchResults];
    const uniqueMap = new Map<number, ApiProperty>();
    allProperties.forEach((p) => uniqueMap.set(p.id, p));
    return Array.from(uniqueMap.values()).filter((p) => favorites.has(p.id));
  }, [featuredProperties, searchResults, favorites]);

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
                      properties={featuredProperties} loading={loadingFeatured} error={errorFeatured}
                      onOpenProperty={openProperty} favorites={favorites} onToggleFavorite={toggleFavorite}
                      recentlyViewed={recentlyViewed}
                      onClearRecentlyViewed={() => { clearRecentlyViewed(); setRecentlyViewed([]); }}
                      onRetry={() => {
                        setLoadingFeatured(true); setErrorFeatured(null);
                        getFeaturedProperties().then(setFeaturedProperties).catch(() => setErrorFeatured("تعذر تحميل العقارات")).finally(() => setLoadingFeatured(false));
                      }}
                    />
                  )}
                  {activeTab === "search" && (
                    <SearchTab
                      properties={searchResults} total={searchTotal} loading={loadingSearch}
                      onOpenProperty={openProperty} searchQuery={searchQuery} onSearchChange={setSearchQuery}
                      selectedCity={selectedCity} onCityChange={setSelectedCity}
                      showFilter={showFilter} onToggleFilter={() => setShowFilter(!showFilter)}
                      favorites={favorites} onToggleFavorite={toggleFavorite}
                      filterMinPrice={filterMinPrice} onMinPriceChange={setFilterMinPrice}
                      filterMaxPrice={filterMaxPrice} onMaxPriceChange={setFilterMaxPrice}
                      filterBedrooms={filterBedrooms} onBedroomsChange={setFilterBedrooms}
                      filterFurnished={filterFurnished} onFurnishedChange={setFilterFurnished}
                      filterPropertyType={filterPropertyType} onPropertyTypeChange={setFilterPropertyType}
                      activeFilterCount={activeFilterCount} onClearFilters={clearAllFilters}
                      sortBy={sortBy} onSortChange={setSortBy}
                    />
                  )}
                  {activeTab === "favorites" && (
                    <FavoritesTab
                      properties={favoriteProperties} loading={favoritesLoading}
                      onOpenProperty={openProperty} onToggleFavorite={toggleFavorite}
                    />
                  )}
                  {activeTab === "bookings" && (
                    <BookingsTab isLoggedIn={isLoggedIn} onLogin={() => setScreen("login")} bookings={userBookings} onOpenProperty={openProperty} />
                  )}
                  {activeTab === "profile" && (
                    <ProfileTab
                      isLoggedIn={isLoggedIn} onLogin={() => setScreen("login")} onLogout={handleLogout}
                      userName={userDisplayName} userEmail={userEmail} userInitials={userInitials}
                      onOpenNotifications={() => setScreen("notifications-settings")}
                      onOpenTwilioSetup={() => setScreen("twilio-setup")}
                      onOpenProfile={() => setScreen("profile-completion")}
                      onOpenAdmin={() => setScreen("admin-panel")}
                      userBookingsCount={userBookings.length}
                    />
                  )}
                </div>
                {/* Bottom Navigation — 5 tabs */}
                <div className="absolute bottom-0 left-0 right-0 glass-strong" style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}>
                  <div className="flex items-center justify-around h-16">
                    {([
                      { id: "home" as TabId, icon: Home, label: "الرئيسية" },
                      { id: "search" as TabId, icon: Search, label: "البحث" },
                      { id: "favorites" as TabId, icon: Heart, label: "المفضلة" },
                      { id: "bookings" as TabId, icon: CalendarDays, label: "حجوزاتي" },
                      { id: "profile" as TabId, icon: MoreHorizontal, label: "المزيد" },
                    ]).map((tab) => (
                      <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="flex flex-col items-center gap-1 transition-all duration-200 relative">
                        <tab.icon className={`w-5 h-5 transition-colors ${activeTab === tab.id ? "text-primary" : "text-muted-foreground"} ${tab.id === "favorites" && favorites.size > 0 ? (activeTab === tab.id ? "fill-primary" : "") : ""}`} />
                        <span className={`text-[10px] font-medium transition-colors ${activeTab === tab.id ? "text-primary" : "text-muted-foreground"}`}>{tab.label}</span>
                        {activeTab === tab.id && <motion.div layoutId="tab-indicator" className="w-1 h-1 rounded-full bg-primary" />}
                        {tab.id === "favorites" && favorites.size > 0 && (
                          <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full text-[8px] font-bold text-white flex items-center justify-center" style={{ background: "linear-gradient(135deg, #EF4444, #DC2626)" }}>
                            {favorites.size > 9 ? "9+" : favorites.size}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {screen === "property-detail" && selectedPropertyData && (
              <motion.div key="detail" initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -100, opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="h-full">
                <PropertyDetail
                  property={selectedPropertyData} loading={loadingDetail} onBack={goBack} onBook={startBooking}
                  isFavorite={favorites.has(selectedPropertyData.id)} onToggleFavorite={() => toggleFavorite(selectedPropertyData.id)}
                  isLoggedIn={isLoggedIn} userId={user?.id} userName={user?.user_metadata?.full_name || user?.email || "مستخدم"}
                />
              </motion.div>
            )}

            {screen === "booking-flow" && selectedPropertyData && (
              <motion.div key="booking" initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="h-full">
                <BookingFlow
                  property={selectedPropertyData} step={bookingStep} months={bookingMonths} onMonthsChange={setBookingMonths}
                  onNext={() => {
                    if (bookingStep < 3) setBookingStep((s) => s + 1);
                    if (bookingStep === 2) {
                      setBookingConfirmed(true);
                      const breakdown = calculateBookingTotal(parseFloat(selectedPropertyData.monthlyRent), bookingMonths);
                      handleBookingComplete(selectedPropertyData, bookingMonths, breakdown.grandTotal);
                    }
                  }}
                  onBack={goBack} confirmed={bookingConfirmed}
                />
              </motion.div>
            )}

            {screen === "notifications-settings" && (
              <motion.div key="notifications" initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -100, opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="h-full">
                <NotificationsSettings onBack={goBack} />
              </motion.div>
            )}

            {screen === "twilio-setup" && (
              <motion.div key="twilio" initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -100, opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="h-full">
                <TwilioSetupGuide onBack={goBack} />
              </motion.div>
            )}

            {screen === "profile-completion" && (
              <motion.div key="profile-completion" initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -100, opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="h-full">
                <ProfileCompletionScreen onBack={goBack} userId={user?.id} />
              </motion.div>
            )}

            {screen === "admin-panel" && (
              <motion.div key="admin-panel" initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -100, opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="h-full">
                <AdminPanel onBack={goBack} />
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
  recentlyViewed, onClearRecentlyViewed,
}: {
  properties: ApiProperty[]; loading: boolean; error: string | null;
  onOpenProperty: (p: ApiProperty) => void; favorites: Set<number>;
  onToggleFavorite: (id: number) => void; onRetry: () => void;
  recentlyViewed: RecentlyViewedEntry[]; onClearRecentlyViewed: () => void;
}) {
  const recent = useMemo(() => [...properties].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4), [properties]);
  const popular = useMemo(() => [...properties].sort((a, b) => b.viewCount - a.viewCount), [properties]);

  // Format relative time for recently viewed
  const formatViewedTime = (viewedAt: number): string => {
    const diff = Date.now() - viewedAt;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "الآن";
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "أمس";
    return `منذ ${days} أيام`;
  };

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

      {/* Recently Viewed Section */}
      {recentlyViewed.length > 0 && (
        <div className="px-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <h2 className="text-base font-bold">شوهدت مؤخراً</h2>
            </div>
            <button onClick={onClearRecentlyViewed} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
              <Trash2 className="w-3 h-3" />
              مسح
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {recentlyViewed.map((entry, i) => (
              <motion.div
                key={`rv-${entry.property.id}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="min-w-[180px] max-w-[180px] flex-shrink-0"
              >
                <button
                  onClick={() => onOpenProperty(entry.property)}
                  className="w-full glass rounded-2xl overflow-hidden text-right transition-all hover:bg-card/80 active:scale-[0.97]"
                >
                  <div className="relative h-[110px] overflow-hidden">
                    <img
                      src={getPropertyImage(entry.property)}
                      alt={entry.property.titleAr}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }}
                    />
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 50%, rgba(11,20,38,0.7) 100%)" }} />
                    <div className="absolute bottom-2 right-2 left-2">
                      <p className="text-[10px] text-white/70 truncate">{entry.property.cityAr} - {entry.property.districtAr}</p>
                    </div>
                  </div>
                  <div className="p-2.5">
                    <h3 className="text-xs font-bold leading-tight mb-1 truncate">{entry.property.titleAr}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-primary">{formatPrice(parseFloat(entry.property.monthlyRent))}</span>
                      <span className="text-[9px] text-muted-foreground">{formatViewedTime(entry.viewedAt)}</span>
                    </div>
                  </div>
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

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
  property: ApiProperty; onPress: () => void; isFavorite: boolean; onToggleFavorite: () => void; size?: "large" | "compact";
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
          {isNew && <div className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>جديد</div>}
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
          <Heart className={`w-4 h-4 transition-all ${isFavorite ? "fill-red-500 text-red-500 scale-110" : "text-white/70"}`} />
        </button>
        {isNew && <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>جديد</div>}
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

// ─── Favorites Tab ───
function FavoritesTab({
  properties, loading, onOpenProperty, onToggleFavorite,
}: {
  properties: ApiProperty[]; loading: boolean;
  onOpenProperty: (p: ApiProperty) => void; onToggleFavorite: (id: number) => void;
}) {
  return (
    <div className="pt-12 px-4">
      <div className="pt-4 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">المفضلة</h1>
          <div className="flex items-center gap-1.5">
            <Heart className="w-4 h-4 fill-red-500 text-red-500" />
            <span className="text-sm text-muted-foreground">{properties.length} عقار</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
          <p className="text-sm text-muted-foreground">جاري تحميل المفضلة...</p>
        </div>
      )}

      {!loading && properties.length === 0 && (
        <div className="text-center py-16">
          <Heart className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-lg font-bold mb-2">لا توجد عقارات مفضلة</h3>
          <p className="text-sm text-muted-foreground max-w-[250px] mx-auto">اضغط على أيقونة القلب في أي عقار لإضافته إلى المفضلة</p>
        </div>
      )}

      {!loading && properties.length > 0 && (
        <div className="flex flex-col gap-3 pb-4">
          {properties.map((property, i) => (
            <motion.div key={property.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <PropertyCard property={property} onPress={() => onOpenProperty(property)} isFavorite={true} onToggleFavorite={() => onToggleFavorite(property.id)} size="compact" />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Price Range Presets ───
const PRICE_PRESETS = [
  { label: "الكل", min: null, max: null },
  { label: "أقل من ٣٠٠٠", min: null, max: 3000 },
  { label: "٣٠٠٠ - ٥٠٠٠", min: 3000, max: 5000 },
  { label: "٥٠٠٠ - ٨٠٠٠", min: 5000, max: 8000 },
  { label: "٨٠٠٠ - ١٢٠٠٠", min: 8000, max: 12000 },
  { label: "أكثر من ١٢٠٠٠", min: 12000, max: null },
];

// ─── Search Tab with Advanced Filters ───
function SearchTab({
  properties, total, loading, onOpenProperty, searchQuery, onSearchChange,
  selectedCity, onCityChange, showFilter, onToggleFilter, favorites, onToggleFavorite,
  filterMinPrice, onMinPriceChange, filterMaxPrice, onMaxPriceChange,
  filterBedrooms, onBedroomsChange, filterFurnished, onFurnishedChange,
  filterPropertyType, onPropertyTypeChange, activeFilterCount, onClearFilters,
  sortBy, onSortChange,
}: {
  properties: ApiProperty[]; total: number; loading: boolean;
  onOpenProperty: (p: ApiProperty) => void; searchQuery: string; onSearchChange: (q: string) => void;
  selectedCity: string | null; onCityChange: (city: string | null) => void;
  showFilter: boolean; onToggleFilter: () => void; favorites: Set<number>; onToggleFavorite: (id: number) => void;
  filterMinPrice: number | null; onMinPriceChange: (v: number | null) => void;
  filterMaxPrice: number | null; onMaxPriceChange: (v: number | null) => void;
  filterBedrooms: number | null; onBedroomsChange: (v: number | null) => void;
  filterFurnished: string | null; onFurnishedChange: (v: string | null) => void;
  filterPropertyType: string | null; onPropertyTypeChange: (v: string | null) => void;
  activeFilterCount: number; onClearFilters: () => void;
  sortBy: SortOption; onSortChange: (s: SortOption) => void;
}) {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  useEffect(() => {
    const t = setTimeout(() => onSearchChange(localQuery), 400);
    return () => clearTimeout(t);
  }, [localQuery, onSearchChange]);

  const activePricePreset = PRICE_PRESETS.findIndex(
    (p) => p.min === filterMinPrice && p.max === filterMaxPrice
  );

  // Sort properties based on selected sort option
  const sortedProperties = useMemo(() => {
    if (sortBy === "default" || properties.length === 0) return properties;

    const sorted = [...properties];
    switch (sortBy) {
      case "price_asc":
        sorted.sort((a, b) => parseFloat(a.monthlyRent) - parseFloat(b.monthlyRent));
        break;
      case "price_desc":
        sorted.sort((a, b) => parseFloat(b.monthlyRent) - parseFloat(a.monthlyRent));
        break;
      case "newest":
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "rating":
        sorted.sort((a, b) => {
          const ratingA = getDemoAverageRating(a.id).average;
          const ratingB = getDemoAverageRating(b.id).average;
          return ratingB - ratingA;
        });
        break;
    }
    return sorted;
  }, [properties, sortBy]);

  return (
    <div className="pt-12">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold mb-3">البحث عن عقار</h1>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 glass rounded-xl px-3 py-2.5">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input type="text" placeholder="ابحث بالحي أو المدينة..." value={localQuery} onChange={(e) => setLocalQuery(e.target.value)} className="bg-transparent text-sm w-full outline-none placeholder:text-muted-foreground" dir="rtl" />
            {localQuery && <button onClick={() => { setLocalQuery(""); onSearchChange(""); }}><X className="w-4 h-4 text-muted-foreground" /></button>}
          </div>
          <button onClick={onToggleFilter} className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all ${showFilter ? "bg-primary text-white" : "glass"}`}>
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full text-[8px] font-bold text-white flex items-center justify-center" style={{ background: "linear-gradient(135deg, #EF4444, #DC2626)" }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showFilter && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-4">
              {/* Clear All Filters */}
              {activeFilterCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-primary font-medium">{activeFilterCount} فلتر نشط</span>
                  <button onClick={onClearFilters} className="text-xs text-destructive font-medium flex items-center gap-1">
                    <X className="w-3 h-3" /> مسح الكل
                  </button>
                </div>
              )}

              {/* City Filter */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">المدينة</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onCityChange(null)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${!selectedCity ? "bg-primary text-white" : "glass"}`}>الكل</button>
                  {QUICK_CITIES.map((city) => (
                    <button key={city} onClick={() => onCityChange(city === selectedCity ? null : city)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${selectedCity === city ? "bg-primary text-white" : "glass"}`}>{city}</button>
                  ))}
                </div>
              </div>

              {/* Price Range Filter */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">نطاق السعر (ر.س / شهرياً)</p>
                <div className="flex flex-wrap gap-2">
                  {PRICE_PRESETS.map((preset, i) => (
                    <button
                      key={i}
                      onClick={() => { onMinPriceChange(preset.min); onMaxPriceChange(preset.max); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activePricePreset === i ? "bg-primary text-white" : "glass"}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bedrooms Filter */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">عدد غرف النوم</p>
                <div className="flex gap-2">
                  <button onClick={() => onBedroomsChange(null)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterBedrooms === null ? "bg-primary text-white" : "glass"}`}>الكل</button>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => onBedroomsChange(filterBedrooms === n ? null : n)} className={`w-9 h-9 rounded-full text-xs font-medium transition-all flex items-center justify-center ${filterBedrooms === n ? "bg-primary text-white" : "glass"}`}>
                      {n}{n === 5 ? "+" : ""}
                    </button>
                  ))}
                </div>
              </div>

              {/* Furnishing Level Filter */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">التأثيث</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onFurnishedChange(null)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterFurnished === null ? "bg-primary text-white" : "glass"}`}>الكل</button>
                  {Object.entries(furnishedLabels).map(([key, label]) => (
                    <button key={key} onClick={() => onFurnishedChange(filterFurnished === key ? null : key)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterFurnished === key ? "bg-primary text-white" : "glass"}`}>{label}</button>
                  ))}
                </div>
              </div>

              {/* Property Type Filter */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">نوع العقار</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onPropertyTypeChange(null)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterPropertyType === null ? "bg-primary text-white" : "glass"}`}>الكل</button>
                  {Object.entries(propertyTypeLabels).map(([key, label]) => (
                    <button key={key} onClick={() => onPropertyTypeChange(filterPropertyType === key ? null : key)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterPropertyType === key ? "bg-primary text-white" : "glass"}`}>{label}</button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sort Bar */}
      <div className="px-4 mb-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground">{loading ? "جاري البحث..." : `${total} نتيجة`}</p>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <ArrowUpDown className="w-3 h-3" />
            <span>ترتيب</span>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {SORT_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = sortBy === option.value;
            return (
              <button
                key={option.value}
                onClick={() => onSortChange(option.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  isActive ? "bg-primary text-white shadow-sm" : "glass hover:bg-card/80"
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <div className="px-4">
        <div className="flex flex-col gap-3 pb-4">
          {loading ? (
            <div className="flex flex-col items-center py-12"><Loader2 className="w-8 h-8 text-primary animate-spin mb-3" /></div>
          ) : sortedProperties.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">لا توجد نتائج</p>
              {activeFilterCount > 0 && (
                <button onClick={onClearFilters} className="mt-3 text-xs text-primary font-medium">مسح الفلاتر وإعادة البحث</button>
              )}
            </div>
          ) : (
            sortedProperties.map((property, i) => (
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

// ─── Star Rating Component ───
function StarRating({ rating, size = 16, interactive = false, onChange }: {
  rating: number; size?: number; interactive?: boolean; onChange?: (r: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => interactive && onChange?.(star)}
          className={`transition-all ${interactive ? "cursor-pointer hover:scale-110" : "cursor-default"}`}
          disabled={!interactive}
        >
          <Star
            style={{ width: size, height: size }}
            className={`transition-colors ${
              star <= rating
                ? "fill-amber-400 text-amber-400"
                : star - 0.5 <= rating
                ? "fill-amber-400/50 text-amber-400"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Reviews Section Component ───
function ReviewsSection({ propertyId, isLoggedIn, userId, userName }: {
  propertyId: number; isLoggedIn: boolean; userId?: string; userName?: string;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState<{ average: number; count: number }>({ average: 0, count: 0 });
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingReviews(true);

    Promise.all([
      fetchReviews(propertyId),
      getAverageRating(propertyId),
    ]).then(([reviewsData, ratingData]) => {
      if (cancelled) return;
      // If no real reviews, show demo reviews
      if (reviewsData.length === 0) {
        const demoReviews = generateDemoReviews(propertyId);
        const demoRating = getDemoAverageRating(propertyId);
        setReviews(demoReviews);
        setAvgRating(demoRating);
      } else {
        setReviews(reviewsData);
        setAvgRating(ratingData);
      }
      setLoadingReviews(false);
    }).catch(() => {
      if (cancelled) return;
      const demoReviews = generateDemoReviews(propertyId);
      const demoRating = getDemoAverageRating(propertyId);
      setReviews(demoReviews);
      setAvgRating(demoRating);
      setLoadingReviews(false);
    });

    return () => { cancelled = true; };
  }, [propertyId]);

  const handleSubmitReview = async () => {
    if (!userId || !userName) return;
    if (newRating === 0) { toast.error("يرجى اختيار التقييم"); return; }
    if (!newComment.trim()) { toast.error("يرجى كتابة تعليق"); return; }

    setSubmitting(true);
    const success = await submitReview({
      propertyId,
      userId,
      userName,
      rating: newRating,
      comment: newComment.trim(),
    });

    if (success) {
      toast.success("تم إرسال تقييمك بنجاح");
      // Add to local list
      const newReview: Review = {
        id: `new-${Date.now()}`,
        propertyId,
        userId,
        userName,
        rating: newRating,
        comment: newComment.trim(),
        createdAt: new Date().toISOString(),
      };
      setReviews((prev) => [newReview, ...prev]);
      setAvgRating((prev) => {
        const newCount = prev.count + 1;
        const newAvg = (prev.average * prev.count + newRating) / newCount;
        return { average: Math.round(newAvg * 10) / 10, count: newCount };
      });
      setNewRating(0);
      setNewComment("");
      setShowForm(false);
    } else {
      toast.error("فشل في إرسال التقييم");
    }
    setSubmitting(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return "اليوم";
    if (diffDays === 1) return "أمس";
    if (diffDays < 7) return `منذ ${diffDays} أيام`;
    if (diffDays < 30) return `منذ ${Math.floor(diffDays / 7)} أسابيع`;
    return `منذ ${Math.floor(diffDays / 30)} أشهر`;
  };

  return (
    <div className="px-4 mt-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          التقييمات والمراجعات
        </h3>
        {avgRating.count > 0 && (
          <div className="flex items-center gap-1.5">
            <StarRating rating={avgRating.average} size={14} />
            <span className="text-sm font-bold text-amber-400">{avgRating.average.toFixed(1)}</span>
            <span className="text-[11px] text-muted-foreground">({avgRating.count})</span>
          </div>
        )}
      </div>

      {/* Add Review Button */}
      {isLoggedIn && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full mb-3 py-2.5 rounded-xl glass text-sm font-medium flex items-center justify-center gap-2 transition-all hover:bg-card/80"
        >
          <Star className="w-4 h-4 text-primary" />
          <span>أضف تقييمك</span>
        </button>
      )}

      {/* Review Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-3"
          >
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold">تقييمك</h4>
                <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="flex items-center justify-center mb-3">
                <StarRating rating={newRating} size={28} interactive onChange={setNewRating} />
              </div>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="شاركنا تجربتك..."
                className="w-full h-20 rounded-xl glass bg-transparent text-sm p-3 outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground resize-none"
                dir="rtl"
                maxLength={500}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-muted-foreground">{newComment.length}/500</span>
                <button
                  onClick={handleSubmitReview}
                  disabled={submitting || newRating === 0}
                  className="px-4 py-2 rounded-xl font-bold text-white text-xs transition-all active:scale-[0.98] disabled:opacity-60 flex items-center gap-1.5"
                  style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>إرسال</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reviews List */}
      {loadingReviews ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-6 glass rounded-2xl">
          <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">لا توجد تقييمات بعد</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reviews.slice(0, 5).map((review, i) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-xl p-3"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
                    {review.userName.slice(0, 2)}
                  </div>
                  <div>
                    <span className="text-xs font-bold">{review.userName}</span>
                    <span className="text-[10px] text-muted-foreground mr-2">{formatDate(review.createdAt)}</span>
                  </div>
                </div>
                <StarRating rating={review.rating} size={12} />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{review.comment}</p>
            </motion.div>
          ))}
          {reviews.length > 5 && (
            <p className="text-center text-[11px] text-muted-foreground py-2">
              و {reviews.length - 5} تقييمات أخرى
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Property Detail with Interactive Map ───
function PropertyDetail({
  property, loading, onBack, onBook, isFavorite, onToggleFavorite, isLoggedIn, userId, userName,
}: {
  property: ApiProperty; loading: boolean; onBack: () => void; onBook: () => void;
  isFavorite: boolean; onToggleFavorite: () => void;
  isLoggedIn: boolean; userId?: string; userName?: string;
}) {
  const rent = parseFloat(property.monthlyRent);
  const deposit = property.securityDeposit ? parseFloat(property.securityDeposit) : 0;
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = property.photos?.length ? property.photos : [PLACEHOLDER_IMG];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div className="relative h-[300px]">
          <img src={photos[photoIndex]} alt={property.titleAr} className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(11,20,38,0.4) 0%, transparent 30%, rgba(11,20,38,0.9) 90%)" }} />
          {photos.length > 1 && <div className="absolute top-12 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full glass text-[10px] text-white">{photoIndex + 1} / {photos.length}</div>}
          {photos.length > 1 && (
            <>
              <button onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full glass flex items-center justify-center"><ChevronLeft className="w-4 h-4 text-white" /></button>
              <button onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)} className="absolute right-14 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full glass flex items-center justify-center"><ChevronRight className="w-4 h-4 text-white" /></button>
            </>
          )}
          <div className="absolute top-12 right-4 flex items-center gap-2">
            <button onClick={onBack} className="w-10 h-10 rounded-full glass flex items-center justify-center"><ChevronRight className="w-5 h-5 text-white" /></button>
          </div>
          <div className="absolute top-12 left-4 flex gap-2">
            <button onClick={onToggleFavorite} className="w-10 h-10 rounded-full glass flex items-center justify-center">
              <Heart className={`w-5 h-5 transition-all ${isFavorite ? "fill-red-500 text-red-500 scale-110" : "text-white"}`} />
            </button>
          </div>
          <div className="absolute bottom-4 right-4 left-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>{propertyTypeLabels[property.propertyType] || property.propertyType}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] glass text-white/80">{furnishedLabels[property.furnishedLevel] || property.furnishedLevel}</span>
            </div>
            <h1 className="text-xl font-bold text-white mb-1">{property.titleAr}</h1>
            <div className="flex items-center gap-1 text-white/70"><MapPin className="w-3.5 h-3.5" /><span className="text-sm">{property.cityAr} - {property.districtAr}</span></div>
          </div>
        </div>

        <div className="px-4 -mt-3 relative z-10">
          <div className="inline-flex items-baseline gap-1 px-4 py-2.5 rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(124,58,237,0.15))", border: "1px solid rgba(37,99,235,0.2)" }}>
            <span className="text-2xl font-bold gradient-text">{formatPrice(rent)}</span>
            <span className="text-xs text-muted-foreground">/ شهرياً</span>
          </div>
        </div>

        <div className="px-4 mt-5">
          <div className="grid grid-cols-3 gap-2">
            <div className="glass rounded-xl p-3 text-center"><BedDouble className="w-5 h-5 text-primary mx-auto mb-1" /><span className="text-lg font-bold block">{property.bedrooms}</span><span className="text-[10px] text-muted-foreground">غرف النوم</span></div>
            <div className="glass rounded-xl p-3 text-center"><Bath className="w-5 h-5 text-primary mx-auto mb-1" /><span className="text-lg font-bold block">{property.bathrooms}</span><span className="text-[10px] text-muted-foreground">دورات المياه</span></div>
            <div className="glass rounded-xl p-3 text-center"><Maximize className="w-5 h-5 text-primary mx-auto mb-1" /><span className="text-lg font-bold block">{property.sizeSqm || "—"}</span><span className="text-[10px] text-muted-foreground">م²</span></div>
          </div>
        </div>

        {property.descriptionAr && (
          <div className="px-4 mt-5"><h3 className="text-base font-bold mb-2">الوصف</h3><p className="text-sm text-muted-foreground leading-relaxed">{property.descriptionAr}</p></div>
        )}

        <div className="px-4 mt-5">
          <h3 className="text-base font-bold mb-3"><span className="flex items-center gap-2"><MapPinned className="w-4 h-4 text-primary" />الموقع على الخريطة</span></h3>
          <PropertyMap latitude={property.latitude} longitude={property.longitude} title={property.titleAr} googleMapsUrl={property.googleMapsUrl} />
        </div>

        {property.amenities && property.amenities.length > 0 && (
          <div className="px-4 mt-5">
            <h3 className="text-base font-bold mb-3">المرافق والخدمات</h3>
            <div className="flex flex-wrap gap-2">
              {property.amenities.map((amenity) => (
                <div key={amenity} className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass"><AmenityIcon type={amenity} /><span className="text-xs">{amenityLabels[amenity.toLowerCase()] || amenity}</span></div>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 mt-5 mb-4">
          <div className="glass rounded-2xl p-4">
            <h3 className="text-sm font-bold mb-2">تفاصيل الإيجار</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">الإيجار الشهري</span><span className="font-bold gradient-text">{formatPrice(rent)}</span></div>
              {deposit > 0 && <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">مبلغ التأمين</span><span className="font-medium">{formatPrice(deposit)}</span></div>}
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">الحد الأدنى للإقامة</span><span className="font-medium">{property.minStayMonths} {property.minStayMonths === 1 ? "شهر" : "أشهر"}</span></div>
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">الحد الأقصى للإقامة</span><span className="font-medium">{property.maxStayMonths} {property.maxStayMonths === 1 ? "شهر" : "أشهر"}</span></div>
              {property.instantBook && <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50"><Check className="w-4 h-4 text-emerald-400" /><span className="text-xs text-emerald-400 font-medium">حجز فوري متاح</span></div>}
            </div>
          </div>
        </div>

        {photos.length > 1 && (
          <div className="px-4 mb-4">
            <h3 className="text-sm font-bold mb-2">الصور ({photos.length})</h3>
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {photos.slice(0, 8).map((photo, i) => (
                <button key={i} onClick={() => setPhotoIndex(i)} className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${i === photoIndex ? "border-primary" : "border-transparent"}`}>
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
              {photos.length > 8 && <div className="w-16 h-16 rounded-lg glass flex items-center justify-center flex-shrink-0"><span className="text-xs text-muted-foreground">+{photos.length - 8}</span></div>}
            </div>
          </div>
        )}
        {/* Reviews Section */}
        <ReviewsSection propertyId={property.id} isLoggedIn={isLoggedIn} userId={userId} userName={userName} />

        <div className="h-6" />
      </div>

      <div className="p-4 glass-strong">
        <button onClick={onBook} className="w-full h-12 rounded-xl font-bold text-white text-base transition-all active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>إتمام الحجز</button>
      </div>
    </div>
  );
}

// ─── Booking Flow ───
function BookingFlow({
  property, step, months, onMonthsChange, onNext, onBack, confirmed,
}: {
  property: ApiProperty; step: number; months: number; onMonthsChange: (m: number) => void;
  onNext: () => void; onBack: () => void; confirmed: boolean;
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
          <button onClick={onBack} className="w-9 h-9 rounded-full glass flex items-center justify-center"><ChevronRight className="w-5 h-5" /></button>
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
                  <div><h4 className="text-sm font-bold">{property.titleAr}</h4><p className="text-[11px] text-muted-foreground">{property.cityAr} - {property.districtAr}</p></div>
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
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">الإيجار ({months} {months === 1 ? "شهر" : "أشهر"})</span><span className="font-medium">{formatPrice(breakdown.baseRentTotal)}</span></div>
                {!breakdown.hideInsuranceFromTenant && breakdown.insuranceAmount > 0 && (
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">تأمين ({breakdown.appliedRates.insuranceRate}%)</span><span className="font-medium">{formatPrice(breakdown.insuranceAmount)}</span></div>
                )}
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">رسوم الخدمة ({breakdown.appliedRates.serviceFeeRate}%)</span><span className="font-medium">{formatPrice(breakdown.serviceFeeAmount)}</span></div>
                <div className="border-t border-border/50 pt-2 flex items-center justify-between text-sm"><span className="text-muted-foreground">المجموع الفرعي</span><span className="font-medium">{formatPrice(breakdown.subtotal)}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">ضريبة القيمة المضافة ({breakdown.appliedRates.vatRate}%)</span><span className="font-medium">{formatPrice(breakdown.vatAmount)}</span></div>
                <div className="border-t border-border/50 pt-3 flex items-center justify-between"><span className="font-bold">المجموع الكلي</span><span className="text-xl font-bold gradient-text">{formatPrice(breakdown.grandTotal)}</span></div>
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
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(124,58,237,0.15))" }}><method.icon className="w-5 h-5 text-primary" /></div>
                    <div className="flex-1"><span className="text-sm font-bold block">{method.label}</span><span className="text-[11px] text-muted-foreground">{method.desc}</span></div>
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
                  <div><h4 className="text-sm font-bold">{property.titleAr}</h4><p className="text-[11px] text-muted-foreground">{months} {months === 1 ? "شهر" : "أشهر"}</p></div>
                </div>
                <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">المجموع</span><span className="font-bold gradient-text">{formatPrice(breakdown.grandTotal)}</span></div>
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
          <button onClick={onBack} className="w-full h-12 rounded-xl font-bold text-white text-base transition-all active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>العودة للرئيسية</button>
        </div>
      )}
    </div>
  );
}

// ─── Bookings Tab ───
function BookingsTab({ isLoggedIn, onLogin, bookings, onOpenProperty }: {
  isLoggedIn: boolean; onLogin: () => void; bookings: UserBooking[]; onOpenProperty: (p: ApiProperty) => void;
}) {
  if (!isLoggedIn) {
    return (
      <div className="pt-12 flex flex-col items-center justify-center h-full px-8">
        <CalendarDays className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-bold mb-2">حجوزاتي</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">سجل الدخول لعرض حجوزاتك</p>
        <button onClick={onLogin} className="px-8 py-3 rounded-xl font-bold text-white text-sm transition-all active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>تسجيل الدخول</button>
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
            <motion.div key={booking.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <button onClick={() => onOpenProperty(booking.property)} className="w-full glass rounded-2xl p-4 text-right transition-all hover:bg-card/80 active:scale-[0.98]">
                <div className="flex gap-3 mb-3">
                  <img src={getPropertyImage(booking.property)} alt={booking.property.titleAr} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-bold leading-tight mb-1">{booking.property.titleAr}</h3>
                    <div className="flex items-center gap-1 text-muted-foreground mb-1"><MapPin className="w-3 h-3" /><span className="text-[11px]">{booking.property.cityAr} - {booking.property.districtAr}</span></div>
                    <div className="flex items-center gap-1.5"><StatusIcon className="w-3.5 h-3.5" style={{ color: statusInfo.color }} /><span className="text-[11px] font-medium" style={{ color: statusInfo.color }}>{statusInfo.label}</span></div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{booking.months} {booking.months === 1 ? "شهر" : "أشهر"}</span>
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

// ─── Notifications Settings Screen ───
function NotificationsSettings({ onBack }: { onBack: () => void }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(getNotificationPrefs());
  const [permissionGranted, setPermissionGranted] = useState(
    typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted"
  );

  const handleToggleEnabled = async () => {
    if (!prefs.enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        toast.error("يرجى السماح بالإشعارات من إعدادات المتصفح");
        return;
      }
      setPermissionGranted(true);
      const updated = { ...prefs, enabled: true };
      setPrefs(updated);
      saveNotificationPrefs(updated);
      toast.success("تم تفعيل الإشعارات");

      // Send test notification
      sendLocalNotification("المفتاح الشهري", "تم تفعيل الإشعارات بنجاح! ستصلك تنبيهات عند تحديث حجوزاتك.");
    } else {
      const updated = { ...prefs, enabled: false };
      setPrefs(updated);
      saveNotificationPrefs(updated);
      toast.success("تم إيقاف الإشعارات");
    }
  };

  const togglePref = (key: keyof Omit<NotificationPrefs, "enabled">) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    saveNotificationPrefs(updated);
  };

  const notificationOptions = [
    { key: "bookingUpdates" as const, label: "تحديثات الحجوزات", desc: "إشعارات عند تأكيد أو تحديث حجوزاتك", icon: CalendarDays },
    { key: "newProperties" as const, label: "عقارات جديدة", desc: "إشعارات عند إضافة عقارات جديدة في مدينتك", icon: Home },
    { key: "priceDrops" as const, label: "انخفاض الأسعار", desc: "إشعارات عند انخفاض أسعار العقارات المفضلة", icon: Star },
    { key: "promotions" as const, label: "العروض والتخفيضات", desc: "إشعارات بالعروض الخاصة والتخفيضات", icon: Bell },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="pt-12 px-4 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-full glass flex items-center justify-center"><ChevronRight className="w-5 h-5" /></button>
          <h1 className="text-lg font-bold">إعدادات الإشعارات</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        {/* Main Toggle */}
        <div className="glass rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: prefs.enabled ? "linear-gradient(135deg, #2563EB, #7C3AED)" : "rgba(255,255,255,0.05)" }}>
                {prefs.enabled ? <BellRing className="w-5 h-5 text-white" /> : <BellOff className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div>
                <h3 className="text-sm font-bold">الإشعارات</h3>
                <p className="text-[11px] text-muted-foreground">{prefs.enabled ? "مفعلة" : "متوقفة"}</p>
              </div>
            </div>
            <button
              onClick={handleToggleEnabled}
              className={`w-12 h-7 rounded-full transition-all duration-300 relative ${prefs.enabled ? "bg-primary" : "bg-muted"}`}
            >
              <motion.div
                className="w-5 h-5 rounded-full bg-white absolute top-1"
                animate={{ left: prefs.enabled ? 24 : 4 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </div>

        {/* Permission Warning */}
        {!permissionGranted && prefs.enabled && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-3 rounded-xl text-sm" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <p className="text-amber-400 text-xs">يرجى السماح بالإشعارات من إعدادات المتصفح لتلقي التنبيهات</p>
          </motion.div>
        )}

        {/* Notification Categories */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-muted-foreground mb-2">أنواع الإشعارات</h3>
          {notificationOptions.map((option) => (
            <div key={option.key} className="glass rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <option.icon className="w-5 h-5 text-primary flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium">{option.label}</h4>
                    <p className="text-[11px] text-muted-foreground">{option.desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => togglePref(option.key)}
                  disabled={!prefs.enabled}
                  className={`w-10 h-6 rounded-full transition-all duration-300 relative flex-shrink-0 ${prefs[option.key] && prefs.enabled ? "bg-primary" : "bg-muted"} ${!prefs.enabled ? "opacity-40" : ""}`}
                >
                  <motion.div
                    className="w-4 h-4 rounded-full bg-white absolute top-1"
                    animate={{ left: prefs[option.key] && prefs.enabled ? 20 : 4 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="mt-6 p-4 glass rounded-xl">
          <div className="flex items-start gap-3">
            <Settings className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold mb-1">ملاحظة</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                يستخدم التطبيق إشعارات المتصفح (Web Push). للتطبيق الأصلي على الهاتف، سيتم استخدام Firebase Cloud Messaging لإرسال إشعارات Push حقيقية حتى عند إغلاق التطبيق.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Profile Tab (Gathern-Style) ───
function ProfileTab({
  isLoggedIn, onLogin, onLogout, userName, userEmail, userInitials,
  onOpenNotifications, onOpenTwilioSetup, onOpenProfile, onOpenAdmin,
  userBookingsCount,
}: {
  isLoggedIn: boolean; onLogin: () => void; onLogout: () => void;
  userName: string; userEmail: string; userInitials: string;
  onOpenNotifications: () => void; onOpenTwilioSetup: () => void;
  onOpenProfile: () => void; onOpenAdmin: () => void;
  userBookingsCount: number;
}) {
  const [showHostSheet, setShowHostSheet] = useState(false);

  // Guest menu items (shown when not logged in)
  const guestMenuItems: { label: string; icon: React.ReactNode; action?: () => void; requiresAuth?: boolean }[] = [
    { label: "استضف معنا (سجّل عقارك)", icon: <Building2 className="w-5 h-5" />, action: () => setShowHostSheet(true) },
    { label: "الأسئلة الشائعة", icon: <HelpCircle className="w-5 h-5" />, action: () => toast.info("قريباً") },
    { label: "شروط الاستخدام", icon: <FileText className="w-5 h-5" />, action: () => toast.info("قريباً") },
    { label: "سياسة الخصوصية", icon: <Shield className="w-5 h-5" />, action: () => toast.info("قريباً") },
    { label: "تغيير اللغة", icon: <Globe className="w-5 h-5" />, action: () => toast.info("قريباً") },
  ];

  if (!isLoggedIn) {
    return (
      <div className="pt-12 h-full overflow-y-auto pb-24">
        {/* Login prompt header */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden" style={{ background: "linear-gradient(135deg, #6B21A8, #7C3AED)" }}>
              <img src={MK_LOGO} alt="MK" className="w-10 h-10 object-contain" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold">مرحباً</h2>
              <p className="text-xs text-muted-foreground">سجل الدخول للوصول إلى حسابك</p>
            </div>
          </div>
          <button onClick={onLogin} className="w-full mt-4 py-3 rounded-xl font-bold text-white text-sm transition-all active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #6B21A8, #7C3AED)" }}>تسجيل الدخول</button>
        </div>

        {/* Guest Menu Items */}
        <div className="px-4 mt-2">
          {guestMenuItems.map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="w-full flex items-center justify-between py-4 border-b border-border/20 transition-all active:bg-card/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </div>
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Footer - Commercial Info */}
        <div className="px-4 mt-6 mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">السجل التجاري</span>
            <span className="text-xs font-medium">7007384501</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">رخصة وزارة السياحة</span>
            <span className="text-xs font-medium">73102999</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">تصنيف الرخصة</span>
            <span className="text-xs font-medium">حجز وحدات سكنية</span>
          </div>
          <p className="text-center text-xs text-muted-foreground/60 mt-4">v 9.13.1 (838)</p>
        </div>

        {/* Host With Us Bottom Sheet */}
        <AnimatePresence>
          {showHostSheet && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 z-50"
                onClick={() => setShowHostSheet(false)}
              />
              <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl p-6"
              >
                <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
                <p className="text-center text-sm leading-relaxed mb-6">
                  أضف عقارك مع المفتاح الشهري، واستضف بانتظام وزد دخلك.
                  سيتم توجيهك إلى تطبيق المفتاح الشهري للأعمال لتسجيل عقارك.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { window.open("https://monthlykey.com", "_blank"); setShowHostSheet(false); }}
                    className="flex-1 py-3 rounded-xl font-bold text-white text-sm" style={{ background: "#6B21A8" }}
                  >
                    موافق
                  </button>
                  <button
                    onClick={() => setShowHostSheet(false)}
                    className="flex-1 py-3 rounded-xl font-bold text-sm border-2" style={{ borderColor: "#6B21A8", color: "#6B21A8" }}
                  >
                    إلغاء
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const menuItems: { label: string; icon: React.ReactNode; action?: () => void; value?: string; divider?: boolean }[] = [
    { label: "الملف الشخصي", icon: <User className="w-5 h-5" />, action: onOpenProfile },
    { label: "سجل المحفظة", icon: <Wallet className="w-5 h-5" />, action: () => toast.info("قريباً") },
    { label: "قيّمنا", icon: <ThumbsUp className="w-5 h-5" />, action: () => toast.info("قريباً") },
    { label: "استضف معنا (سجّل عقارك)", icon: <Building2 className="w-5 h-5" />, action: () => setShowHostSheet(true) },
    { label: "طرق الدفع", icon: <CreditCard className="w-5 h-5" />, action: () => toast.info("قريباً") },
    { label: "تواصل مع تجربة الضيف", icon: <Mail className="w-5 h-5" />, action: () => toast.info("قريباً") },
    { label: "دعوة أصدقاء", icon: <Share2 className="w-5 h-5" />, action: () => toast.info("قريباً") },
    { label: "الأسئلة الشائعة", icon: <HelpCircle className="w-5 h-5" />, action: () => toast.info("قريباً") },
    { label: "شروط الاستخدام", icon: <FileText className="w-5 h-5" />, action: () => toast.info("قريباً") },
    { label: "سياسة الخصوصية", icon: <Shield className="w-5 h-5" />, action: () => toast.info("قريباً") },
    { label: "تغيير اللغة", icon: <Globe className="w-5 h-5" />, action: () => toast.info("قريباً") },
    { label: "الإشعارات", icon: <Bell className="w-5 h-5" />, action: onOpenNotifications },
    { label: "إعداد SMS (Twilio)", icon: <Phone className="w-5 h-5" />, action: onOpenTwilioSetup },
    { label: "لوحة التحكم", icon: <ShieldCheck className="w-5 h-5" />, action: onOpenAdmin },
    { label: "تسجيل الخروج", icon: <Clock className="w-5 h-5" />, action: onLogout },
  ];

  return (
    <div className="pt-12 h-full overflow-y-auto pb-24">
      {/* Header with avatar */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden" style={{ background: "linear-gradient(135deg, #6B21A8, #7C3AED)" }}>
              <img src={MK_LOGO} alt="MK" className="w-10 h-10 object-contain" />
            </div>
          <h2 className="text-lg font-bold">{userName}</h2>
        </div>
      </div>

      {/* Stats Section */}
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between py-2 border-b border-border/30">
          <span className="text-sm text-muted-foreground">الحجوزات</span>
          <span className="text-sm font-semibold">{userBookingsCount}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-border/30">
          <span className="text-sm text-muted-foreground">رصيد المحفظة</span>
          <span className="text-sm font-semibold">0 ر.س</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-border/30">
          <span className="text-sm text-muted-foreground">التقييمات (من المضيفين)</span>
          <span className="text-sm font-semibold">10 / 0.0 (0)</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-border/30">
          <span className="text-sm text-muted-foreground">المضيفون الذين حظروك</span>
          <span className="text-sm font-semibold">0</span>
        </div>
      </div>

      {/* Menu Items */}
      <div className="px-4 mt-2">
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className={`w-full flex items-center justify-between py-4 border-b border-border/20 transition-all active:bg-card/50 ${
              item.label === "تسجيل الخروج" ? "text-muted-foreground" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </div>
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Footer - Commercial Info */}
      <div className="px-4 mt-6 mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">السجل التجاري</span>
          <span className="text-xs font-medium">7007384501</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">رخصة وزارة السياحة</span>
          <span className="text-xs font-medium">73102999</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">تصنيف الرخصة</span>
          <span className="text-xs font-medium">حجز وحدات سكنية</span>
        </div>
        <p className="text-center text-xs text-muted-foreground/60 mt-4">v 9.13.1 (838)</p>
      </div>

      {/* Host With Us Bottom Sheet */}
      <AnimatePresence>
        {showHostSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setShowHostSheet(false)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl p-6"
            >
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
              <p className="text-center text-sm leading-relaxed mb-6">
                أضف عقارك مع المفتاح الشهري، واستضف بانتظام وزد دخلك.
                سيتم توجيهك إلى تطبيق المفتاح الشهري للأعمال لتسجيل عقارك.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { window.open("https://monthlykey.com", "_blank"); setShowHostSheet(false); }}
                  className="flex-1 py-3 rounded-xl font-bold text-white text-sm" style={{ background: "#6B21A8" }}
                >
                  موافق
                </button>
                <button
                  onClick={() => setShowHostSheet(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm border-2" style={{ borderColor: "#6B21A8", color: "#6B21A8" }}
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Profile Completion Screen (Identity Verification) ───
const NATIONALITIES = [
  "السعودية", "الإمارات", "الكويت", "البحرين", "قطر", "عُمان",
  "مصر", "الأردن", "لبنان", "سوريا", "العراق", "فلسطين",
  "اليمن", "ليبيا", "تونس", "الجزائر", "المغرب", "السودان",
  "موريتانيا", "الصومال", "جيبوتي", "جزر القمر",
  "أفغانستان", "إندونيسيا", "باكستان", "بنغلاديش", "الهند",
  "تركيا", "إيران", "ماليزيا", "الفلبين", "نيجيريا",
  "إثيوبيا", "كينيا", "جنوب أفريقيا",
  "المملكة المتحدة", "فرنسا", "ألمانيا", "الولايات المتحدة", "كندا",
  "أستراليا", "اليابان", "الصين", "كوريا الجنوبية",
];

const HIJRI_MONTHS = [
  "محرم", "صفر", "ربيع الأول", "ربيع الثاني", "جمادى الأولى", "جمادى الثانية",
  "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
];

type IdentityType = "saudi" | "resident" | "visitor" | null;

function ProfileCompletionScreen({ onBack, userId }: { onBack: () => void; userId?: string }) {
  const [identityType, setIdentityType] = useState<IdentityType>(null);
  const [nationalId, setNationalId] = useState("");
  const [residentNo, setResidentNo] = useState("");
  const [passportNo, setPassportNo] = useState("");
  const [nationality, setNationality] = useState("");
  const [dobGregorian, setDobGregorian] = useState("");
  const [dobHijriMonth, setDobHijriMonth] = useState(9); // Ramadan
  const [dobHijriDay, setDobHijriDay] = useState(18);
  const [dobHijriYear, setDobHijriYear] = useState(1447);
  const [calendarMode, setCalendarMode] = useState<"hijri" | "gregorian">("hijri");
  const [showNationalitySheet, setShowNationalitySheet] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const isFormValid = useMemo(() => {
    if (!identityType) return false;
    if (identityType === "saudi") return nationalId.length >= 9 && (calendarMode === "gregorian" ? dobGregorian.length > 0 : true);
    if (identityType === "resident") return residentNo.length >= 9 && (calendarMode === "gregorian" ? dobGregorian.length > 0 : true);
    if (identityType === "visitor") return passportNo.length >= 4 && nationality.length > 0;
    return false;
  }, [identityType, nationalId, residentNo, passportNo, nationality, dobGregorian, calendarMode]);

  const handleVerify = async () => {
    if (!isFormValid) return;
    setSaving(true);
    try {
      const profileData: Record<string, unknown> = { identityType };
      if (identityType === "saudi") {
        profileData.nationalId = nationalId;
        profileData.dateOfBirth = calendarMode === "gregorian" ? dobGregorian : `${dobHijriDay}/${dobHijriMonth}/${dobHijriYear}`;
        profileData.calendarMode = calendarMode;
      } else if (identityType === "resident") {
        profileData.residentNo = residentNo;
        profileData.dateOfBirth = calendarMode === "gregorian" ? dobGregorian : `${dobHijriDay}/${dobHijriMonth}/${dobHijriYear}`;
        profileData.calendarMode = calendarMode;
      } else {
        profileData.passportNo = passportNo;
        profileData.nationality = nationality;
      }

      // Save to localStorage for persistence
      localStorage.setItem("mk_profile_data", JSON.stringify({ ...profileData, userId, updatedAt: Date.now() }));

      // Also attempt to save via API
      try {
        const res = await fetch("/api/trpc/profile.save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profileData),
        });
        if (!res.ok) throw new Error("API save failed");
      } catch {
        // API save is best-effort, localStorage is primary
      }

      toast.success("تم حفظ الملف الشخصي بنجاح");
      onBack();
    } catch {
      toast.error("حدث خطأ في حفظ البيانات");
    } finally {
      setSaving(false);
    }
  };

  // Load saved profile data on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mk_profile_data");
      if (saved) {
        const data = JSON.parse(saved);
        if (data.identityType) setIdentityType(data.identityType);
        if (data.nationalId) setNationalId(data.nationalId);
        if (data.residentNo) setResidentNo(data.residentNo);
        if (data.passportNo) setPassportNo(data.passportNo);
        if (data.nationality) setNationality(data.nationality);
        if (data.calendarMode) setCalendarMode(data.calendarMode);
        if (data.dateOfBirth && data.calendarMode === "gregorian") setDobGregorian(data.dateOfBirth);
      }
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-14 pb-3">
        <button onClick={onBack} className="p-2 -ml-2">
          <ChevronRight className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold" style={{ color: "#6B21A8" }}>الملف الشخصي</h1>
        <button onClick={() => toast.info("حذف الحساب — قريباً")} className="p-2 -mr-2">
          <Trash2 className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-32">
        {/* Instructions */}
        <p className="text-sm font-semibold mb-4">أكمل المعلومات التالية لإتمام الحجز</p>

        {/* Identity Type Selection */}
        <div className="space-y-3 mb-6">
          {([
            { type: "saudi" as IdentityType, label: "سعودي" },
            { type: "resident" as IdentityType, label: "مقيم (غير سعودي)" },
            { type: "visitor" as IdentityType, label: "زائر / سائح" },
          ]).map((opt) => (
            <button
              key={opt.type}
              onClick={() => setIdentityType(opt.type)}
              className="flex items-center gap-3 w-full text-right"
            >
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                identityType === opt.type ? "border-[#6B21A8] bg-[#6B21A8]" : "border-muted-foreground/40"
              }`}>
                {identityType === opt.type && <Check className="w-4 h-4 text-white" />}
              </div>
              <span className="text-sm">{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Saudi National Fields */}
        {identityType === "saudi" && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block" style={{ color: "#6B21A8" }}>رقم الهوية الوطنية</label>
              <input
                type="tel" inputMode="numeric" value={nationalId}
                onChange={(e) => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="106452248"
                className="w-full px-4 py-3 rounded-lg border border-border/40 bg-transparent text-sm focus:outline-none focus:border-[#6B21A8]"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block" style={{ color: "#6B21A8" }}>تاريخ الميلاد</label>
              <button
                onClick={() => setShowDatePicker(true)}
                className="w-full px-4 py-3 rounded-lg border border-border/40 bg-transparent text-sm text-right"
              >
                {calendarMode === "gregorian" && dobGregorian ? dobGregorian : calendarMode === "hijri" ? `${dobHijriDay} ${HIJRI_MONTHS[dobHijriMonth - 1]} ${dobHijriYear}` : "تاريخ الميلاد"}
              </button>
            </div>
          </div>
        )}

        {/* Resident Fields */}
        {identityType === "resident" && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block" style={{ color: "#6B21A8" }}>رقم الإقامة</label>
              <input
                type="tel" inputMode="numeric" value={residentNo}
                onChange={(e) => setResidentNo(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="106452248"
                className="w-full px-4 py-3 rounded-lg border border-border/40 bg-transparent text-sm focus:outline-none focus:border-[#6B21A8]"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block" style={{ color: "#6B21A8" }}>تاريخ الميلاد</label>
              <button
                onClick={() => setShowDatePicker(true)}
                className="w-full px-4 py-3 rounded-lg border border-border/40 bg-transparent text-sm text-right"
              >
                {calendarMode === "gregorian" && dobGregorian ? dobGregorian : calendarMode === "hijri" ? `${dobHijriDay} ${HIJRI_MONTHS[dobHijriMonth - 1]} ${dobHijriYear}` : "تاريخ الميلاد"}
              </button>
            </div>
          </div>
        )}

        {/* Visitor Fields */}
        {identityType === "visitor" && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block" style={{ color: "#6B21A8" }}>رقم جواز السفر</label>
              <input
                type="text" value={passportNo}
                onChange={(e) => setPassportNo(e.target.value.slice(0, 20))}
                placeholder="A542817"
                className="w-full px-4 py-3 rounded-lg border border-border/40 bg-transparent text-sm focus:outline-none focus:border-[#6B21A8]"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block" style={{ color: "#6B21A8" }}>الجنسية</label>
              <button
                onClick={() => setShowNationalitySheet(true)}
                className="w-full px-4 py-3 rounded-lg border border-border/40 bg-transparent text-sm text-right"
              >
                {nationality || "الجنسية"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Verify Button */}
      <div className="absolute bottom-0 left-0 right-0 p-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 16px)" }}>
        <button
          onClick={handleVerify}
          disabled={!isFormValid || saving}
          className={`w-full py-4 rounded-xl font-bold text-sm transition-all ${
            isFormValid ? "text-white" : "text-muted-foreground"
          }`}
          style={{ background: isFormValid ? "#6B21A8" : "#9CA3AF" }}
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "تحقق"}
        </button>
      </div>

      {/* Nationality Bottom Sheet */}
      <AnimatePresence>
        {showNationalitySheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowNationalitySheet(false)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl max-h-[60vh] flex flex-col"
            >
              <div className="p-4 flex items-center justify-between border-b border-border/30">
                <h3 className="text-base font-bold" style={{ color: "#6B21A8" }}>اختر الجنسية</h3>
                <button onClick={() => setShowNationalitySheet(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {NATIONALITIES.map((n) => (
                  <button
                    key={n}
                    onClick={() => { setNationality(n); setShowNationalitySheet(false); }}
                    className={`w-full text-right px-4 py-3 border-b border-border/10 text-sm transition-all ${
                      nationality === n ? "bg-[#6B21A8]/10 font-bold" : ""
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Date Picker Bottom Sheet */}
      <AnimatePresence>
        {showDatePicker && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowDatePicker(false)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl p-4"
            >
              {/* Calendar Mode Toggle */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-muted-foreground">
                  {calendarMode === "hijri" ? `${dobHijriDay} ${HIJRI_MONTHS[dobHijriMonth - 1]} ${dobHijriYear}` : dobGregorian || "اختر التاريخ"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {calendarMode === "gregorian" ? dobGregorian || "" : ""}
                </span>
              </div>
              <div className="flex rounded-lg overflow-hidden border border-border/40 mb-4">
                <button
                  onClick={() => setCalendarMode("hijri")}
                  className={`flex-1 py-2 text-sm font-medium transition-all ${
                    calendarMode === "hijri" ? "bg-white text-black" : "bg-transparent text-muted-foreground"
                  }`}
                >هجري</button>
                <button
                  onClick={() => setCalendarMode("gregorian")}
                  className={`flex-1 py-2 text-sm font-medium transition-all ${
                    calendarMode === "gregorian" ? "bg-white text-black" : "bg-transparent text-muted-foreground"
                  }`}
                >ميلادي</button>
              </div>

              {calendarMode === "hijri" ? (
                <div className="flex gap-2 mb-4">
                  {/* Hijri Month Picker */}
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">الشهر</label>
                    <select
                      value={dobHijriMonth}
                      onChange={(e) => setDobHijriMonth(Number(e.target.value))}
                      className="w-full px-2 py-2 rounded-lg border border-border/40 bg-transparent text-sm"
                    >
                      {HIJRI_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                  {/* Hijri Day Picker */}
                  <div className="w-20">
                    <label className="text-xs text-muted-foreground mb-1 block">اليوم</label>
                    <select
                      value={dobHijriDay}
                      onChange={(e) => setDobHijriDay(Number(e.target.value))}
                      className="w-full px-2 py-2 rounded-lg border border-border/40 bg-transparent text-sm"
                    >
                      {Array.from({ length: 30 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                    </select>
                  </div>
                  {/* Hijri Year Picker */}
                  <div className="w-24">
                    <label className="text-xs text-muted-foreground mb-1 block">السنة</label>
                    <select
                      value={dobHijriYear}
                      onChange={(e) => setDobHijriYear(Number(e.target.value))}
                      className="w-full px-2 py-2 rounded-lg border border-border/40 bg-transparent text-sm"
                    >
                      {Array.from({ length: 80 }, (_, i) => {
                        const year = 1400 + i;
                        return <option key={year} value={year}>{year} هـ</option>;
                      })}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <input
                    type="date"
                    value={dobGregorian}
                    onChange={(e) => setDobGregorian(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border/40 bg-transparent text-sm"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-white text-sm" style={{ background: "#6B21A8" }}
                >موافق</button>
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm border-2" style={{ borderColor: "#6B21A8", color: "#6B21A8" }}
                >إلغاء</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Twilio SMS Setup Guide ───
function TwilioSetupGuide({ onBack }: { onBack: () => void }) {
  const steps = [
    {
      title: "١. إنشاء حساب Twilio",
      desc: "اذهب إلى twilio.com وأنشئ حساباً مجانياً. ستحصل على رصيد تجريبي للبدء.",
      icon: "🔑",
    },
    {
      title: "٢. الحصول على Account SID و Auth Token",
      desc: "من لوحة تحكم Twilio Console → Account Info، انسخ Account SID و Auth Token.",
      icon: "📋",
    },
    {
      title: "٣. شراء رقم هاتف",
      desc: "اشترِ رقم هاتف يدعم SMS من Phone Numbers → Buy a Number. اختر رقماً يدعم المملكة العربية السعودية.",
      icon: "📱",
    },
    {
      title: "٤. إعداد Verify Service",
      desc: "اذهب إلى Verify → Services → Create Service. فعّل قناة SMS واضبط طول الرمز (6 أرقام) ومدة الصلاحية (10 دقائق).",
      icon: "✅",
    },
    {
      title: "٥. ربط Twilio مع Supabase",
      desc: "في Supabase Dashboard → Authentication → Providers → Phone:\n• فعّل Phone Provider\n• اختر Twilio كمزود SMS\n• أدخل Account SID و Auth Token و Verify Service SID\n• أدخل رقم الهاتف المرسل",
      icon: "🔗",
    },
    {
      title: "٦. اختبار الإرسال",
      desc: "استخدم شاشة تسجيل الدخول برقم الهاتف في التطبيق لإرسال OTP تجريبي. تأكد من استخدام التنسيق الدولي +966.",
      icon: "🧪",
    },
  ];

  const troubleshooting = [
    { q: "لا يصل رمز OTP؟", a: "تأكد من أن رقم الهاتف بالتنسيق الدولي (+966XXXXXXXXX) وأن Twilio Verify Service مفعّل." },
    { q: "خطأ في المصادقة؟", a: "تحقق من Account SID و Auth Token في إعدادات Supabase. تأكد أنها مطابقة للوحة Twilio." },
    { q: "رسوم Twilio؟", a: "الحساب التجريبي يوفر رصيد ~$15. كل رسالة SMS للسعودية تكلف ~$0.05. للإنتاج اشحن رصيدك." },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <button onClick={onBack} className="w-9 h-9 rounded-full glass flex items-center justify-center">
          <ChevronRight className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">إعداد Twilio SMS</h1>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6" style={{ scrollbarWidth: "none" }}>
        {/* Intro */}
        <div className="glass rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #F22F46, #E91E63)" }}>
              <Phone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold">تفعيل تسجيل الدخول برقم الهاتف</h2>
              <p className="text-[11px] text-muted-foreground">عبر Twilio + Supabase Auth</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            لتفعيل تسجيل الدخول برقم الهاتف (OTP) في التطبيق، تحتاج إلى ربط حساب Twilio مع Supabase.
            اتبع الخطوات التالية:
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-6">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass rounded-xl p-3"
            >
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{step.icon}</span>
                <div>
                  <h3 className="text-xs font-bold mb-1">{step.title}</h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-line">{step.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Troubleshooting */}
        <div className="mb-4">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            حل المشاكل
          </h3>
          <div className="space-y-2">
            {troubleshooting.map((item, i) => (
              <div key={i} className="glass rounded-xl p-3">
                <p className="text-xs font-bold mb-1">{item.q}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div className="glass rounded-2xl p-4">
          <h3 className="text-sm font-bold mb-3">روابط سريعة</h3>
          <div className="space-y-2">
            {[
              { label: "Twilio Console", url: "https://console.twilio.com" },
              { label: "Supabase Dashboard", url: "https://supabase.com/dashboard" },
              { label: "Twilio Verify Docs", url: "https://www.twilio.com/docs/verify" },
            ].map((link) => (
              <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between py-2 px-3 rounded-lg glass text-xs font-medium transition-all hover:bg-card/80">
                <span>{link.label}</span>
                <Navigation className="w-3 h-3 text-primary" />
              </a>
            ))}
          </div>
        </div>

        {/* Phone number format note */}
        <div className="mt-4 glass rounded-xl p-3 border border-amber-500/20">
          <div className="flex items-start gap-2">
            <span className="text-amber-400 text-sm">⚠️</span>
            <div>
              <p className="text-xs font-bold text-amber-400 mb-1">تنسيق رقم الهاتف السعودي</p>
              <p className="text-[11px] text-muted-foreground">
                يجب إدخال الرقم بالتنسيق الدولي: +966 5XXXXXXXX
                (بدون الصفر البادئ)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Panel (Control Panel for Website & App) ───
function AdminPanel({ onBack }: { onBack: () => void }) {
  const [activeSection, setActiveSection] = useState<"dashboard" | "properties" | "users" | "bookings" | "settings">("dashboard");
  const [stats, setStats] = useState({ totalProperties: 0, totalUsers: 0, totalBookings: 0, revenue: 0, loading: true });
  const [properties, setProperties] = useState<ApiProperty[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);

  // Fetch dashboard stats from the real API
  useEffect(() => {
    const loadStats = async () => {
      try {
        const [featured, searchResult] = await Promise.all([
          getFeaturedProperties(),
          searchProperties({ limit: 1 }),
        ]);
        setStats({
          totalProperties: searchResult.total || featured.length,
          totalUsers: 0, // Will be populated when user management API is available
          totalBookings: 0,
          revenue: 0,
          loading: false,
        });
      } catch {
        setStats(prev => ({ ...prev, loading: false }));
      }
    };
    loadStats();
  }, []);

  // Load properties for management
  useEffect(() => {
    if (activeSection === "properties") {
      setPropertiesLoading(true);
      searchProperties({ limit: 20 })
        .then(res => setProperties(res.items))
        .catch(() => toast.error("فشل تحميل العقارات"))
        .finally(() => setPropertiesLoading(false));
    }
  }, [activeSection]);

  const sections: { id: typeof activeSection; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "لوحة المعلومات", icon: <BarChart3 className="w-5 h-5" /> },
    { id: "properties", label: "إدارة العقارات", icon: <Building2 className="w-5 h-5" /> },
    { id: "users", label: "إدارة المستخدمين", icon: <Users className="w-5 h-5" /> },
    { id: "bookings", label: "إدارة الحجوزات", icon: <CalendarDays className="w-5 h-5" /> },
    { id: "settings", label: "إعدادات النظام", icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-14 pb-3 border-b border-border/30">
        <button onClick={onBack} className="p-2 -ml-2">
          <ChevronRight className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold" style={{ color: "#6B21A8" }}>لوحة التحكم</h1>
        <div className="w-9" />
      </div>

      {/* Section Tabs */}
      <div className="flex overflow-x-auto gap-1 px-3 py-2 border-b border-border/20 no-scrollbar">
        {sections.map(sec => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeSection === sec.id
                ? "text-white"
                : "text-muted-foreground bg-card/50"
            }`}
            style={activeSection === sec.id ? { background: "linear-gradient(135deg, #6B21A8, #7C3AED)" } : {}}
          >
            {sec.icon}
            {sec.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {/* Dashboard Section */}
        {activeSection === "dashboard" && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold mb-3">نظرة عامة</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "إجمالي العقارات", value: stats.loading ? "..." : stats.totalProperties.toString(), icon: <Building2 className="w-5 h-5" />, color: "#6B21A8" },
                { label: "المستخدمون", value: stats.loading ? "..." : stats.totalUsers.toString(), icon: <Users className="w-5 h-5" />, color: "#2563EB" },
                { label: "الحجوزات", value: stats.loading ? "..." : stats.totalBookings.toString(), icon: <CalendarDays className="w-5 h-5" />, color: "#059669" },
                { label: "الإيرادات (ر.س)", value: stats.loading ? "..." : stats.revenue.toLocaleString(), icon: <Wallet className="w-5 h-5" />, color: "#D97706" },
              ].map(stat => (
                <div key={stat.label} className="rounded-xl p-4 border border-border/30 bg-card/50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}20`, color: stat.color }}>
                      {stat.icon}
                    </div>
                  </div>
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <h2 className="text-sm font-bold mt-6 mb-3">إجراءات سريعة</h2>
            <div className="space-y-2">
              {[
                { label: "إضافة عقار جديد", desc: "أضف عقاراً جديداً للمنصة", icon: <Building2 className="w-5 h-5" />, action: () => window.open("https://monthlykey.com/admin/properties/new", "_blank") },
                { label: "مراجعة الحجوزات المعلقة", desc: "عرض الحجوزات التي تنتظر الموافقة", icon: <CalendarDays className="w-5 h-5" />, action: () => window.open("https://monthlykey.com/admin/bookings", "_blank") },
                { label: "إدارة المستخدمين", desc: "عرض وإدارة حسابات المستخدمين", icon: <Users className="w-5 h-5" />, action: () => window.open("https://monthlykey.com/admin/users", "_blank") },
                { label: "فتح لوحة تحكم الموقع", desc: "الانتقال إلى لوحة تحكم monthlykey.com", icon: <Globe className="w-5 h-5" />, action: () => window.open("https://monthlykey.com/admin", "_blank") },
              ].map(action => (
                <button
                  key={action.label}
                  onClick={action.action}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card/50 transition-all active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#6B21A820", color: "#6B21A8" }}>
                    {action.icon}
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.desc}</p>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Properties Management Section */}
        {activeSection === "properties" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold">العقارات ({properties.length})</h2>
              <button
                onClick={() => window.open("https://monthlykey.com/admin/properties/new", "_blank")}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: "#6B21A8" }}
              >
                + إضافة عقار
              </button>
            </div>
            {propertiesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : properties.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">لا توجد عقارات</p>
              </div>
            ) : (
              properties.map(prop => (
                <div key={prop.id} className="rounded-xl border border-border/30 bg-card/50 p-3">
                  <div className="flex gap-3">
                    <img
                      src={prop.photos?.[0] || PLACEHOLDER_IMG}
                      alt={prop.titleAr}
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{prop.titleAr}</p>
                      <p className="text-xs text-muted-foreground">{prop.cityAr} - {prop.districtAr}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold" style={{ color: "#6B21A8" }}>{formatPrice(Number(prop.monthlyRent))} ر.س/شهر</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          prop.status === "active" ? "bg-green-500/10 text-green-600" :
                          prop.status === "pending" ? "bg-yellow-500/10 text-yellow-600" :
                          "bg-red-500/10 text-red-600"
                        }`}>
                          {prop.status === "active" ? "نشط" : prop.status === "pending" ? "معلق" : prop.status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => window.open(`https://monthlykey.com/admin/properties/${prop.id}`, "_blank")}
                      className="p-2 self-center"
                    >
                      <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Users Management Section */}
        {activeSection === "users" && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold mb-3">إدارة المستخدمين</h2>
            <div className="space-y-2">
              {[
                { label: "عرض جميع المستخدمين", desc: "قائمة بجميع المستخدمين المسجلين", icon: <Users className="w-5 h-5" />, url: "https://monthlykey.com/admin/users" },
                { label: "المضيفون", desc: "إدارة حسابات الملاك والمضيفين", icon: <UserCog className="w-5 h-5" />, url: "https://monthlykey.com/admin/landlords" },
                { label: "التحقق من الهوية", desc: "مراجعة طلبات التحقق المعلقة", icon: <ShieldCheck className="w-5 h-5" />, url: "https://monthlykey.com/admin/verification" },
                { label: "المستخدمون المحظورون", desc: "عرض وإدارة الحسابات المحظورة", icon: <Shield className="w-5 h-5" />, url: "https://monthlykey.com/admin/banned" },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => window.open(item.url, "_blank")}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card/50 transition-all active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#2563EB20", color: "#2563EB" }}>
                    {item.icon}
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bookings Management Section */}
        {activeSection === "bookings" && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold mb-3">إدارة الحجوزات</h2>
            <div className="space-y-2">
              {[
                { label: "الحجوزات المعلقة", desc: "حجوزات تنتظر الموافقة أو التأكيد", icon: <Clock className="w-5 h-5" />, color: "#D97706", url: "https://monthlykey.com/admin/bookings?status=pending" },
                { label: "الحجوزات المؤكدة", desc: "حجوزات تم تأكيدها ونشطة حالياً", icon: <CheckCircle2 className="w-5 h-5" />, color: "#059669", url: "https://monthlykey.com/admin/bookings?status=confirmed" },
                { label: "الحجوزات الملغاة", desc: "حجوزات تم إلغاؤها", icon: <XCircle className="w-5 h-5" />, color: "#DC2626", url: "https://monthlykey.com/admin/bookings?status=cancelled" },
                { label: "تقارير الحجوزات", desc: "إحصائيات وتقارير مفصلة", icon: <BarChart3 className="w-5 h-5" />, color: "#6B21A8", url: "https://monthlykey.com/admin/reports" },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => window.open(item.url, "_blank")}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card/50 transition-all active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${item.color}20`, color: item.color }}>
                    {item.icon}
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* System Settings Section */}
        {activeSection === "settings" && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold mb-3">إعدادات النظام</h2>
            <div className="space-y-2">
              {[
                { label: "إعدادات الحاسبة", desc: "تعديل نسب التأمين والرسوم والضريبة", icon: <Settings className="w-5 h-5" />, url: "https://monthlykey.com/admin/settings/calculator" },
                { label: "إدارة المدن", desc: "إضافة أو تعديل المدن المتاحة", icon: <MapPin className="w-5 h-5" />, url: "https://monthlykey.com/admin/settings/cities" },
                { label: "إعدادات الإشعارات", desc: "تكوين إشعارات النظام والمستخدمين", icon: <Bell className="w-5 h-5" />, url: "https://monthlykey.com/admin/settings/notifications" },
                { label: "إعدادات الدفع", desc: "إدارة بوابات الدفع والعملات", icon: <CreditCard className="w-5 h-5" />, url: "https://monthlykey.com/admin/settings/payment" },
                { label: "Supabase Dashboard", desc: "إدارة قاعدة البيانات والمصادقة", icon: <Globe className="w-5 h-5" />, url: "https://supabase.com/dashboard" },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => window.open(item.url, "_blank")}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card/50 transition-all active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#6B21A820", color: "#6B21A8" }}>
                    {item.icon}
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>

            {/* Admin Access Info */}
            <div className="mt-6 p-4 rounded-xl border border-border/30 bg-card/30">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4" style={{ color: "#6B21A8" }} />
                <p className="text-sm font-bold">الوصول كمسؤول</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                للوصول كمسؤول رئيسي (Root Admin) إلى التطبيق والموقع، قم بتسجيل الدخول عبر monthlykey.com/admin باستخدام بيانات المسؤول.
                يمكنك إدارة جميع العقارات والمستخدمين والحجوزات من لوحة التحكم هذه أو من لوحة تحكم الموقع مباشرة.
              </p>
              <button
                onClick={() => window.open("https://monthlykey.com/admin", "_blank")}
                className="mt-3 w-full py-2.5 rounded-lg text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, #6B21A8, #7C3AED)" }}
              >
                فتح لوحة تحكم الموقع
              </button>
            </div>
          </div>
        )}
      </div>
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
        if (authError) { setError(authError.message.includes("Invalid login") ? "البريد الإلكتروني أو كلمة المرور غير صحيحة" : authError.message); return; }
        onSuccess();
      } else {
        if (!fullName.trim()) { setError("يرجى إدخال الاسم الكامل"); setLoading(false); return; }
        const { error: authError } = await signUp(email, password, fullName);
        if (authError) { setError(authError.message.includes("already registered") ? "هذا البريد الإلكتروني مسجل بالفعل" : authError.message); return; }
        toast.success("تم إنشاء الحساب بنجاح! تحقق من بريدك الإلكتروني لتأكيد الحساب.");
        setMode("login");
      }
    } catch { setError("حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى."); } finally { setLoading(false); }
  };

  const handlePhoneSubmit = async () => {
    setError(null);
    const cleanPhone = phoneNumber.replace(/\s/g, "");
    if (!cleanPhone || cleanPhone.length < 9) { setError("يرجى إدخال رقم جوال صحيح"); return; }
    const fullPhone = cleanPhone.startsWith("+") ? cleanPhone : `+966${cleanPhone.startsWith("0") ? cleanPhone.slice(1) : cleanPhone}`;
    setLoading(true);
    try {
      const { error: authError } = await signInWithPhone(fullPhone);
      if (authError) { setError(authError.message.includes("Phone") ? "رقم الجوال غير صحيح أو الخدمة غير مفعلة" : authError.message); return; }
      setMode("otp");
      toast.success("تم إرسال رمز التحقق إلى جوالك");
      setTimeout(() => otpInputRef.current?.focus(), 300);
    } catch { setError("حدث خطأ. يرجى المحاولة مرة أخرى."); } finally { setLoading(false); }
  };

  const handleOtpVerify = async () => {
    setError(null);
    if (!otpCode || otpCode.length !== 6) { setError("يرجى إدخال رمز التحقق المكون من 6 أرقام"); return; }
    const cleanPhone = phoneNumber.replace(/\s/g, "");
    const fullPhone = cleanPhone.startsWith("+") ? cleanPhone : `+966${cleanPhone.startsWith("0") ? cleanPhone.slice(1) : cleanPhone}`;
    setLoading(true);
    try {
      const { error: authError } = await verifyOtp(fullPhone, otpCode);
      if (authError) { setError("رمز التحقق غير صحيح أو منتهي الصلاحية"); return; }
      onSuccess();
    } catch { setError("حدث خطأ. يرجى المحاولة مرة أخرى."); } finally { setLoading(false); }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="pt-12 px-4 pb-3">
        <button onClick={mode === "otp" ? () => setMode("phone") : onBack} className="w-9 h-9 rounded-full glass flex items-center justify-center"><ChevronRight className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 px-6 flex flex-col justify-center">
        <div className="mb-8">
          {mode === "login" && <><h1 className="text-2xl font-bold mb-2">مرحباً بك</h1><p className="text-sm text-muted-foreground">سجل الدخول للمتابعة</p></>}
          {mode === "signup" && <><h1 className="text-2xl font-bold mb-2">إنشاء حساب جديد</h1><p className="text-sm text-muted-foreground">أنشئ حسابك للبدء في استخدام المفتاح الشهري</p></>}
          {mode === "phone" && <><h1 className="text-2xl font-bold mb-2">الدخول برقم الجوال</h1><p className="text-sm text-muted-foreground">أدخل رقم جوالك وسنرسل لك رمز تحقق</p></>}
          {mode === "otp" && <><h1 className="text-2xl font-bold mb-2">رمز التحقق</h1><p className="text-sm text-muted-foreground">أدخل الرمز المرسل إلى {phoneNumber}</p></>}
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-4 p-3 rounded-xl text-sm font-medium" style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>{error}</motion.div>
          )}
        </AnimatePresence>

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
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /><span>جاري {mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب"}...</span></> : <>{mode === "login" ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}<span>{mode === "login" ? "تسجيل الدخول" : "إنشاء حساب"}</span></>}
            </button>

            <div className="flex items-center gap-3 my-2"><div className="flex-1 h-px bg-border/50" /><span className="text-[11px] text-muted-foreground">أو</span><div className="flex-1 h-px bg-border/50" /></div>

            <button onClick={() => { setMode("phone"); setError(null); }} className="w-full h-12 rounded-xl font-bold text-sm glass flex items-center justify-center gap-2 transition-all hover:bg-card/80">
              <Phone className="w-5 h-5 text-primary" /><span>الدخول برقم الجوال</span>
            </button>

            <p className="text-center text-xs text-muted-foreground mt-2">
              {mode === "login" ? <>ليس لديك حساب؟{" "}<button onClick={() => { setMode("signup"); setError(null); }} className="text-primary font-medium">إنشاء حساب</button></> : <>لديك حساب بالفعل؟{" "}<button onClick={() => { setMode("login"); setError(null); }} className="text-primary font-medium">تسجيل الدخول</button></>}
            </p>
          </div>
        )}

        {mode === "phone" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">رقم الجوال</label>
              <div className="flex gap-2">
                <div className="flex items-center gap-1.5 px-3 h-12 rounded-xl glass text-sm font-medium flex-shrink-0"><span>🇸🇦</span><span dir="ltr">+966</span></div>
                <div className="relative flex-1">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="tel" value={phoneNumber} onChange={(e) => { setPhoneNumber(e.target.value.replace(/[^\d\s]/g, "")); setError(null); }} placeholder="5XX XXX XXXX" className="w-full h-12 pr-10 pl-4 rounded-xl glass bg-transparent text-sm outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground" dir="ltr" maxLength={12} />
                </div>
              </div>
            </div>

            <button onClick={handlePhoneSubmit} disabled={loading} className="w-full h-12 rounded-xl font-bold text-white text-base transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /><span>جاري الإرسال...</span></> : <><Phone className="w-5 h-5" /><span>إرسال رمز التحقق</span></>}
            </button>

            <div className="flex items-center gap-3 my-2"><div className="flex-1 h-px bg-border/50" /><span className="text-[11px] text-muted-foreground">أو</span><div className="flex-1 h-px bg-border/50" /></div>

            <button onClick={() => { setMode("login"); setError(null); }} className="w-full h-12 rounded-xl font-bold text-sm glass flex items-center justify-center gap-2 transition-all hover:bg-card/80">
              <Mail className="w-5 h-5 text-primary" /><span>الدخول بالبريد الإلكتروني</span>
            </button>
          </div>
        )}

        {mode === "otp" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">رمز التحقق (6 أرقام)</label>
              <input ref={otpInputRef} type="text" inputMode="numeric" value={otpCode} onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(null); }} placeholder="000000" className="w-full h-14 rounded-xl glass bg-transparent text-2xl text-center font-bold tracking-[0.5em] outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/30" dir="ltr" maxLength={6} autoComplete="one-time-code" />
            </div>

            <button onClick={handleOtpVerify} disabled={loading || otpCode.length !== 6} className="w-full h-12 rounded-xl font-bold text-white text-base transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}>
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /><span>جاري التحقق...</span></> : <><Check className="w-5 h-5" /><span>تأكيد</span></>}
            </button>

            <button onClick={handlePhoneSubmit} disabled={loading} className="w-full text-center text-xs text-primary font-medium mt-2">لم يصلك الرمز؟ إعادة الإرسال</button>
          </div>
        )}
      </div>
    </div>
  );
}
