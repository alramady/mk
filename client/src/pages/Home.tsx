import SEOHead from "@/components/SEOHead";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PropertyCard from "@/components/PropertyCard";
import { PropertyCardSkeletonGrid } from "@/components/PropertyCardSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Building2, Key, Home as HomeIcon, Shield, MapPin,
  ArrowLeft, ArrowRight, Star, Users, CheckCircle, Headphones,
  TrendingUp, Paintbrush, UserCheck, BarChart3, Quote, Sparkles,
  SlidersHorizontal, ChevronDown, ChevronUp, X, RotateCcw
} from "lucide-react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useScrollAnimation, useParallax } from "@/hooks/useScrollAnimation";

/* ─── Animated Counter ─── */
function AnimatedCounter({ target, suffix = "" }: { target: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

  const numericTarget = parseInt(target.replace(/[^0-9]/g, "")) || 0;
  const hasPlus = target.includes("+");
  const hasPercent = target.includes("%");

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const duration = 2000;
    const steps = 60;
    const increment = numericTarget / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= numericTarget) {
        setCount(numericTarget);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [started, numericTarget]);

  return (
    <div ref={ref} className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#3ECFC0] font-heading counter-glow">
      <SEOHead title="Monthly Rental Platform" titleAr="منصة التأجير الشهري" description="Find furnished apartments, studios, and villas for monthly rent across Saudi Arabia." path="/" />
      {count.toLocaleString("en-US")}{hasPercent ? "%" : ""}{hasPlus ? "+" : ""}{suffix}
    </div>
  );
}

/* ─── Scroll Section Wrapper ─── */
function ScrollSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, isVisible } = useScrollAnimation();
  return (
    <div
      ref={ref}
      className={`animate-on-scroll ${isVisible ? "visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── Stagger Grid Wrapper ─── */
function StaggerGrid({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { ref, isVisible } = useScrollAnimation();
  return (
    <div ref={ref} className={`stagger-children ${isVisible ? "visible" : ""} ${className}`}>
      {children}
    </div>
  );
}

/* ─── Hero Search Bar (Clean: input + button + "More options" toggle) ─── */
function HeroSearchBar({ lang, cities, onSearch }: {
  lang: string;
  cities: Array<{ id: number; nameAr: string; nameEn: string }>;
  onSearch: (query: string, city: string, type: string, maxPrice: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [minArea, setMinArea] = useState("");
  const [maxArea, setMaxArea] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [mobileSheet, setMobileSheet] = useState(false);

  const propertyTypes = [
    { value: "apartment", ar: "شقة", en: "Apartment" },
    { value: "villa", ar: "فيلا", en: "Villa" },
    { value: "studio", ar: "استوديو", en: "Studio" },
    { value: "duplex", ar: "دوبلكس", en: "Duplex" },
    { value: "furnished_room", ar: "غرفة مفروشة", en: "Furnished Room" },
    { value: "compound", ar: "كمباوند", en: "Compound" },
    { value: "hotel_apartment", ar: "شقة فندقية", en: "Hotel Apartment" },
  ];

  const amenityOptions = lang === "ar"
    ? [
        { value: "parking", label: "موقف سيارات" },
        { value: "pool", label: "مسبح" },
        { value: "gym", label: "صالة رياضية" },
        { value: "elevator", label: "مصعد" },
        { value: "security", label: "حراسة أمنية" },
        { value: "garden", label: "حديقة" },
        { value: "ac", label: "تكييف مركزي" },
        { value: "kitchen", label: "مطبخ مجهز" },
      ]
    : [
        { value: "parking", label: "Parking" },
        { value: "pool", label: "Pool" },
        { value: "gym", label: "Gym" },
        { value: "elevator", label: "Elevator" },
        { value: "security", label: "Security" },
        { value: "garden", label: "Garden" },
        { value: "ac", label: "Central AC" },
        { value: "kitchen", label: "Equipped Kitchen" },
      ];

  const toggleAmenity = (a: string) => {
    setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  };

  const activeCount = [city, type, maxPrice, bedrooms, bathrooms, minArea || maxArea ? "area" : "", ...amenities].filter(Boolean).length;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    onSearch(query, city, type, maxPrice);
  };

  const handleReset = () => {
    setCity(""); setType(""); setMaxPrice(""); setBedrooms(""); setBathrooms("");
    setMinArea(""); setMaxArea(""); setAmenities([]);
  };

  // Lock body scroll when mobile sheet is open
  useEffect(() => {
    if (mobileSheet) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileSheet]);

  /* ── Filters content (shared between desktop inline + mobile sheet) ── */
  const filtersContent = (
    <div className="space-y-5">
      {/* City & Type */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-[#0B1E2D] dark:text-gray-100 mb-2">
            {lang === "ar" ? "المدينة" : "City"}
          </label>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-[#0B1E2D] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#3ECFC0]/30 focus:border-[#3ECFC0] appearance-none"
          >
            <option value="">{lang === "ar" ? "الكل" : "All"}</option>
            {cities.map(c => (
              <option key={c.id} value={c.nameEn}>{lang === "ar" ? c.nameAr : c.nameEn}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-[#0B1E2D] dark:text-gray-100 mb-2">
            {lang === "ar" ? "نوع العقار" : "Property Type"}
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-[#0B1E2D] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#3ECFC0]/30 focus:border-[#3ECFC0] appearance-none"
          >
            <option value="">{lang === "ar" ? "الكل" : "All"}</option>
            {propertyTypes.map(pt => (
              <option key={pt.value} value={pt.value}>{lang === "ar" ? pt.ar : pt.en}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Price Range */}
      <div>
        <label className="block text-sm font-semibold text-[#0B1E2D] dark:text-gray-100 mb-2">
          {lang === "ar" ? "نطاق السعر (ر.س/شهر)" : "Price Range (SAR/mo)"}
        </label>
        <div className="flex gap-2 items-center">
          <select
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-[#0B1E2D] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#3ECFC0]/30 focus:border-[#3ECFC0] appearance-none"
          >
            <option value="">{lang === "ar" ? "الكل" : "All"}</option>
            <option value="3000">{lang === "ar" ? "حتى 3,000 ر.س" : "Up to 3,000 SAR"}</option>
            <option value="5000">{lang === "ar" ? "حتى 5,000 ر.س" : "Up to 5,000 SAR"}</option>
            <option value="8000">{lang === "ar" ? "حتى 8,000 ر.س" : "Up to 8,000 SAR"}</option>
            <option value="12000">{lang === "ar" ? "حتى 12,000 ر.س" : "Up to 12,000 SAR"}</option>
            <option value="20000">{lang === "ar" ? "حتى 20,000 ر.س" : "Up to 20,000 SAR"}</option>
            <option value="50000">{lang === "ar" ? "أكثر من 20,000 ر.س" : "20,000+ SAR"}</option>
          </select>
        </div>
      </div>

      {/* Bedrooms & Bathrooms */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-[#0B1E2D] dark:text-gray-100 mb-2">
            {lang === "ar" ? "غرف النوم" : "Bedrooms"}
          </label>
          <div className="flex gap-2 flex-wrap">
            {["", "1", "2", "3", "4"].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setBedrooms(opt)}
                className={`min-w-[44px] h-10 px-3 rounded-lg text-sm border font-medium transition-colors ${
                  bedrooms === opt
                    ? "bg-[#3ECFC0] text-white border-[#3ECFC0]"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-[#3ECFC0]/50"
                }`}
              >
                {opt === "" ? (lang === "ar" ? "الكل" : "All") : opt === "4" ? "4+" : opt}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-[#0B1E2D] dark:text-gray-100 mb-2">
            {lang === "ar" ? "دورات المياه" : "Bathrooms"}
          </label>
          <div className="flex gap-2 flex-wrap">
            {["", "1", "2", "3"].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setBathrooms(opt)}
                className={`min-w-[44px] h-10 px-3 rounded-lg text-sm border font-medium transition-colors ${
                  bathrooms === opt
                    ? "bg-[#3ECFC0] text-white border-[#3ECFC0]"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-[#3ECFC0]/50"
                }`}
              >
                {opt === "" ? (lang === "ar" ? "الكل" : "All") : opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Property Size */}
      <div>
        <label className="block text-sm font-semibold text-[#0B1E2D] dark:text-gray-100 mb-2">
          {lang === "ar" ? "المساحة (م²)" : "Size (m²)"}
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            value={minArea}
            onChange={(e) => setMinArea(e.target.value)}
            placeholder={lang === "ar" ? "من" : "Min"}
            className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-[#0B1E2D] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#3ECFC0]/30 focus:border-[#3ECFC0]"
          />
          <span className="text-gray-400 text-sm">—</span>
          <input
            type="number"
            value={maxArea}
            onChange={(e) => setMaxArea(e.target.value)}
            placeholder={lang === "ar" ? "إلى" : "Max"}
            className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-[#0B1E2D] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#3ECFC0]/30 focus:border-[#3ECFC0]"
          />
        </div>
      </div>

      {/* Amenities */}
      <div>
        <label className="block text-sm font-semibold text-[#0B1E2D] dark:text-gray-100 mb-2">
          {lang === "ar" ? "المرافق" : "Amenities"}
        </label>
        <div className="flex flex-wrap gap-2">
          {amenityOptions.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => toggleAmenity(a.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                amenities.includes(a.value)
                  ? "bg-[#3ECFC0]/10 text-[#3ECFC0] border-[#3ECFC0]/30"
                  : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-[#3ECFC0]/30"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center justify-center gap-1.5 flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {lang === "ar" ? "إعادة تعيين" : "Reset"}
        </button>
        <button
          type="button"
          onClick={() => { handleSubmit(); setExpanded(false); setMobileSheet(false); }}
          className="flex items-center justify-center gap-1.5 flex-1 py-3 rounded-xl bg-[#3ECFC0] text-white text-sm font-medium hover:bg-[#2ab5a6] transition-colors shadow-sm"
        >
          <Search className="h-3.5 w-3.5" />
          {lang === "ar" ? "عرض النتائج" : "Show Results"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 fade-up visible" style={{ animationDelay: '0.4s' }}>
      {/* ── Clean Search Bar ── */}
      <form onSubmit={handleSubmit} className="flex items-center bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl shadow-black/20 transition-all duration-300 hover:bg-white/15 hover:border-white/30 overflow-hidden">
        <div className="flex items-center flex-1 px-4 gap-3">
          <Search className="h-5 w-5 text-[#3ECFC0] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === "ar" ? "ابحث بالمدينة، الحي، أو اسم العقار..." : "Search by city, neighborhood, or property..."}
            className="flex-1 py-3.5 text-sm sm:text-base text-white placeholder-white/70 focus:outline-none bg-transparent"
            dir={lang === "ar" ? "rtl" : "ltr"}
          />
        </div>
        <button
          type="submit"
          className="bg-[#3ECFC0] hover:bg-[#2ab5a6] text-[#0B1E2D] px-6 py-3.5 text-sm font-bold transition-colors shrink-0"
        >
          {lang === "ar" ? "بحث" : "Search"}
        </button>
      </form>

      {/* ── "More Options" Toggle ── */}
      <div className="flex justify-center mt-3">
        {/* Desktop: toggle inline expand */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            expanded || activeCount > 0
              ? "bg-white/20 text-white shadow-sm border border-white/30"
              : "bg-white/10 text-white/85 border border-white/15 hover:border-white/30 hover:text-white"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>{lang === "ar" ? "خيارات إضافية" : "More Options"}</span>
          {activeCount > 0 && (
            <span className="bg-[#3ECFC0] text-[#0B1E2D] text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {activeCount}
            </span>
          )}
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {/* Mobile: open bottom sheet */}
        <button
          type="button"
          onClick={() => setMobileSheet(true)}
          className={`md:hidden flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            activeCount > 0
              ? "bg-white/20 text-white shadow-sm border border-white/30"
              : "bg-white/10 text-white/85 border border-white/15 hover:border-white/30 hover:text-white"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>{lang === "ar" ? "خيارات إضافية" : "More Options"}</span>
          {activeCount > 0 && (
            <span className="bg-[#3ECFC0] text-[#0B1E2D] text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {activeCount}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Desktop: Inline Expanded Filters ── */}
      {expanded && (
        <div className="hidden md:block mt-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg p-6">
          {filtersContent}
        </div>
      )}

      {/* ── Mobile: Bottom Sheet ── */}
      {mobileSheet && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileSheet(false)} />
          <div
            className="absolute bottom-0 inset-x-0 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 16px))" }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="font-bold text-[#0B1E2D] text-lg">
                {lang === "ar" ? "خيارات إضافية" : "More Options"}
              </h3>
              <button type="button" onClick={() => setMobileSheet(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="px-5 py-4">
              {filtersContent}
            </div>
          </div>
        </div>
      )}

      {/* Quick city tags */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
        {["الرياض", "جدة", "المدينة المنورة", "الدمام"].map((cityName, i) => {
          const cityEn = ["Riyadh", "Jeddah", "Madinah", "Dammam"][i];
          return (
            <button
              key={cityName}
              type="button"
              onClick={() => { setCity(cityEn); onSearch("", cityEn, "", ""); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/10 hover:border-white/25 transition-all duration-200 backdrop-blur-sm"
            >
              <MapPin className="h-3 w-3" />
              {lang === "ar" ? cityName : cityEn}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const { t, lang, dir } = useI18n();
  const { get: s, getByLang: sl } = useSiteSettings();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLDivElement>(null);

  const featured = trpc.property.featured.useQuery();
  // Fetch ALL cities so we can show inactive ones as "coming soon" from DB
  const citiesQuery = trpc.cities.all.useQuery({ activeOnly: false });
  const activeCities = useMemo(() => (citiesQuery.data || []).filter((c: any) => c.isActive !== false), [citiesQuery.data]);
  const comingSoonCitiesDB = useMemo(() => (citiesQuery.data || []).filter((c: any) => c.isActive === false), [citiesQuery.data]);

  // Parallax mouse tracking for hero
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    setMousePos({
      x: (e.clientX - rect.left - rect.width / 2) / rect.width,
      y: (e.clientY - rect.top - rect.height / 2) / rect.height,
    });
  }, []);

  const handleSearch = () => {
    setLocation(`/search?city=${encodeURIComponent(searchQuery)}`);
  };

  const stats = [
    { value: s("stats.properties", "500+"), labelAr: s("stats.propertiesLabelAr", "عقار متاح"), labelEn: s("stats.propertiesLabelEn", "Properties Available") },
    { value: s("stats.tenants", "1000+"), labelAr: s("stats.tenantsLabelAr", "مستأجر سعيد"), labelEn: s("stats.tenantsLabelEn", "Happy Tenants") },
    { value: s("stats.cities", "50+"), labelAr: s("stats.citiesLabelAr", "مدينة"), labelEn: s("stats.citiesLabelEn", "Cities") },
    { value: s("stats.satisfaction", "98%"), labelAr: s("stats.satisfactionLabelAr", "رضا العملاء"), labelEn: s("stats.satisfactionLabelEn", "Satisfaction Rate") },
  ];

  const services = [
    { icon: Building2, titleAr: "إدارة العقارات", titleEn: "Property Management", descAr: "إدارة شاملة لعقارك الشهري مع تقارير دورية", descEn: "Complete monthly property management with periodic reports" },
    { icon: Key, titleAr: "الإيجار الشهري", titleEn: "Monthly Rentals", descAr: "تأجير مرن بعقود رقمية متوافقة", descEn: "Flexible rentals with Ejar-compliant digital contracts" },
    { icon: TrendingUp, titleAr: "إدارة الإيرادات", titleEn: "Revenue Management", descAr: "تسعير ذكي وتحسين العوائد بناءً على السوق", descEn: "Smart pricing and yield optimization based on market data" },
    { icon: Paintbrush, titleAr: "العناية بالعقار", titleEn: "Property Care", descAr: "صيانة وتجديد وتصميم داخلي احترافي", descEn: "Professional maintenance, renovation & interior design" },
    { icon: Headphones, titleAr: "تجربة المستأجر", titleEn: "Tenant Experience", descAr: "دعم المستأجرين على مدار الساعة بالعربية", descEn: "24/7 Arabic tenant support" },
    { icon: UserCheck, titleAr: "التحقق والأمان", titleEn: "Verification & Security", descAr: "تحقق من الهوية الوطنية وعقود رقمية آمنة", descEn: "National ID verification & secure digital contracts" },
  ];

  const steps = [
    { num: "01", titleAr: "ابحث عن عقارك", titleEn: "Search Properties", descAr: "تصفح مئات العقارات المتاحة للتأجير الشهري في مدينتك", descEn: "Browse hundreds of monthly rental properties in your city" },
    { num: "02", titleAr: "احجز إقامتك", titleEn: "Book Your Stay", descAr: "اختر المدة المناسبة واحجز بسهولة مع عقد رقمي", descEn: "Choose your duration and book easily with a digital contract" },
    { num: "03", titleAr: "استمتع بسكنك", titleEn: "Enjoy Your Home", descAr: "انتقل واستمتع بإقامة مريحة مع دعم متواصل", descEn: "Move in and enjoy a comfortable stay with ongoing support" },
  ];

  // Testimonials: load from CMS settings, fall back to defaults
  const defaultTestimonials = [
    { textAr: "منصة المفتاح الشهري سهّلت علي البحث عن شقة شهرية في الرياض. الخدمة ممتازة والعقود واضحة.", textEn: "المفتاح الشهري made it easy to find a monthly apartment in Riyadh. Excellent service and clear contracts.", nameAr: "أحمد المطيري", nameEn: "Ahmed Al-Mutairi", roleAr: "مستأجر - الرياض", roleEn: "Tenant - Riyadh", rating: 5 },
    { textAr: "سعيدة جداً باختياري لمنصة المفتاح الشهري. من البحث وحتى التوقيع، كل شيء كان سلس واحترافي.", textEn: "Very happy with المفتاح الشهري. From search to signing, everything was smooth and professional.", nameAr: "سارة الحربي", nameEn: "Sara Al-Harbi", roleAr: "مستأجرة - جدة", roleEn: "Tenant - Jeddah", rating: 5 },
    { textAr: "كمالك عقار، المفتاح الشهري وفّرت لي إدارة كاملة لشقتي. العوائد ممتازة والتواصل مع المستأجرين سهل.", textEn: "As a property owner, المفتاح الشهري provided complete management. Great returns and easy tenant communication.", nameAr: "خالد العتيبي", nameEn: "Khaled Al-Otaibi", roleAr: "مالك عقار - المدينة", roleEn: "Property Owner - Madinah", rating: 5 },
  ];
  const testimonials = defaultTestimonials.map((def, idx) => {
    const i = idx + 1;
    return {
      textAr: s(`testimonial.${i}.textAr`, def.textAr),
      textEn: s(`testimonial.${i}.textEn`, def.textEn),
      nameAr: s(`testimonial.${i}.nameAr`, def.nameAr),
      nameEn: s(`testimonial.${i}.nameEn`, def.nameEn),
      roleAr: s(`testimonial.${i}.roleAr`, def.roleAr),
      roleEn: s(`testimonial.${i}.roleEn`, def.roleEn),
      rating: parseInt(s(`testimonial.${i}.rating`, String(def.rating))) || def.rating,
    };
  });

  const ArrowIcon = dir === "rtl" ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* ═══ Hero Section - Video/Image Background ═══ */}
      <section
        ref={heroRef}
        onMouseMove={handleMouseMove}
        className={`relative text-white overflow-hidden min-h-[70vh] sm:min-h-[80vh] flex items-center ${
          s("hero.bgType", "image") === "video" && s("hero.bgVideo") ? "bg-black" : "bg-[#0B1E2D]"
        }`}
      >
        {/* Dynamic Background: Video or Image from CMS */}
        {s("hero.bgType", "image") === "video" && s("hero.bgVideo") ? (
          <>
            {/* Video background */}
            <video
              autoPlay muted loop playsInline preload="auto"
              className="absolute inset-0 w-full h-full object-cover z-[1]"
              poster={s("hero.bgImage") || undefined}
              src={s("hero.bgVideo")}
              onLoadedData={(e) => {
                (e.target as HTMLVideoElement).play().catch(() => {});
              }}
            />
            {/* Poster image fallback behind video (shows while video loads) */}
            {s("hero.bgImage") && (
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat z-[0]"
                style={{ backgroundImage: `url(${s("hero.bgImage")})` }}
              />
            )}
            {/* Gradient overlay for text readability: top darker → bottom lighter */}
            <div className="absolute inset-0 z-[2] bg-gradient-to-b from-black/55 via-black/30 to-black/20 pointer-events-none" />
          </>
        ) : s("hero.bgImage") ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat z-[0]"
              style={{ backgroundImage: `url(${s("hero.bgImage")})` }}
            />
            {/* Dark overlay with configurable opacity */}
            <div
              className="absolute inset-0 z-[1]"
              style={{
                backgroundColor: "#0B1E2D",
                opacity: parseInt(s("hero.overlayOpacity", "60")) / 100
              }}
            />
            <div className="absolute inset-0 z-[2] bg-gradient-to-b from-black/55 via-black/25 to-black/15 pointer-events-none" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 pattern-bg opacity-30" />
            <div
              className="absolute inset-0 z-[1]"
              style={{
                backgroundColor: "#0B1E2D",
                opacity: parseInt(s("hero.overlayOpacity", "60")) / 100
              }}
            />
            <div className="absolute inset-0 z-[2] bg-gradient-to-b from-black/55 via-black/25 to-black/15 pointer-events-none" />
          </>  
        )}
        
        {/* Floating decorative elements */}
        <div
          className="absolute top-20 start-[10%] w-64 h-64 rounded-full bg-[#3ECFC0]/5 blur-3xl animate-float-slow z-[3]"
          style={{ transform: `translate(${mousePos.x * -20}px, ${mousePos.y * -20}px)` }}
        />
        <div
          className="absolute bottom-10 end-[15%] w-48 h-48 rounded-full bg-[#C9A96E]/5 blur-3xl animate-float z-[3]"
          style={{ transform: `translate(${mousePos.x * 15}px, ${mousePos.y * 15}px)` }}
        />
        <div
          className="absolute top-1/3 end-[5%] w-2 h-2 rounded-full bg-[#3ECFC0]/40 animate-pulse z-[3]"
          style={{ transform: `translate(${mousePos.x * -30}px, ${mousePos.y * -30}px)` }}
        />
        <div
          className="absolute bottom-1/3 start-[8%] w-3 h-3 rounded-full bg-[#C9A96E]/30 animate-pulse z-[3]"
          style={{ transform: `translate(${mousePos.x * 25}px, ${mousePos.y * 25}px)`, animationDelay: '1s' }}
        />

        <div className="container relative z-[3] py-16 sm:py-24 md:py-36">
          <div className="max-w-3xl mx-auto text-center px-2 sm:px-0">
            {/* Brand Logo in Hero — locale-aware, light variant on dark hero */}
            <div className="hero-logo mb-3 animate-slide-right">
              <img 
                src={lang === "ar" ? "/logo-ar-light.png" : "/logo-horizontal-light.png"}
                alt={lang === "ar" ? "المفتاح الشهري" : "Monthly Key"}
                className="h-[48px] sm:h-[64px] md:h-[80px] w-auto object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                style={{ maxWidth: '360px' }}
              />
            </div>

            {/* Animated Badge */}
            <div className="inline-flex items-center gap-2 border border-[#C5A55A]/30 rounded-full px-4 py-1.5 mb-6 animate-slide-left glass-card">
              <span className="w-2 h-2 rounded-full bg-[#C5A55A] animate-pulse" />
              <span className="text-sm text-[#C5A55A]">
                {lang === "ar" ? "خبير الإيجار الشهري الآن في السعودية" : "Monthly Rental Expert in Saudi Arabia"}
              </span>
              <Sparkles className="h-3.5 w-3.5 text-[#C5A55A] animate-pulse" />
            </div>

            <h1 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-heading font-extrabold mb-4 sm:mb-6 leading-snug sm:leading-tight">
              {sl("hero.title", lang) || (lang === "ar"
                ? "إدارة إيجارات شهرية متميزة"
                : "Premium Monthly Rental Management")}
            </h1>
            <p className="text-sm sm:text-lg md:text-xl text-white/85 mb-6 sm:mb-10 leading-relaxed max-w-2xl mx-auto fade-up visible" style={{ animationDelay: '0.3s' }}>
              {sl("hero.subtitle", lang) || (lang === "ar"
                ? "إدارة إيجارات شهرية متميزة | الرياض • جدة • المدينة المنورة"
                : "Premium monthly rental management | Riyadh • Jeddah • Madinah")}
            </p>

            {/* Hero Search Bar */}
            <HeroSearchBar lang={lang} cities={activeCities} onSearch={(q, c, t, mp) => {
              const params = new URLSearchParams();
              if (q) params.set('q', q);
              if (c) params.set('city', c);
              if (t) params.set('type', t);
              if (mp) params.set('maxPrice', mp);
              setLocation(`/search?${params.toString()}`);
            }} />

            {/* CTA — tenant only (landlord CTA available in nav menu) */}
            <div className="flex items-center justify-center mt-6">
              <Button
                size="lg"
                className="btn-animate bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] border-0 font-bold text-sm sm:text-base px-6 sm:px-8 h-11 sm:h-12 w-full sm:w-auto"
                onClick={() => setLocation("/search")}
              >
                {lang === "ar" ? "احجز إقامتك" : "Book Your Stay"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Stats Section with Animated Counters ═══ */}
      <section className="bg-white dark:bg-background border-b border-border/50 section-transition">
        <div className="container py-8 sm:py-12">
          <StaggerGrid className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center group">
                <AnimatedCounter target={stat.value} />
                <div className="text-sm text-muted-foreground mt-2 font-medium group-hover:text-[#3ECFC0] transition-colors duration-300">
                  {lang === "ar" ? stat.labelAr : stat.labelEn}
                </div>
              </div>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ═══ Services Section with Staggered Cards ═══ */}
      <section className="bg-[#f5f7fa] dark:bg-[#0f1a24] py-12 sm:py-20 section-transition">
        <div className="container">
          <ScrollSection>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold text-center mb-3 text-[#0B1E2D] dark:text-white">
              {lang === "ar" ? "خدماتنا" : "Our Services"}
            </h2>
            <p className="text-[#4a5568] dark:text-gray-300/90 text-center mb-12 max-w-xl mx-auto">
              {lang === "ar" ? "نقدم مجموعة متكاملة من الخدمات لتسهيل تجربة التأجير الشهري" : "A complete suite of services for a seamless monthly rental experience"}
            </p>
          </ScrollSection>
          <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {services.map((service, i) => (
              <Card key={i} className="group card-hover border-border/50 bg-white dark:bg-card cursor-default">
                <CardContent className="p-4 sm:p-6">
                  <div className="w-12 h-12 rounded-xl bg-[#3ECFC0]/10 flex items-center justify-center mb-4 group-hover:bg-[#3ECFC0]/20 transition-all duration-500 group-hover:scale-110">
                    <service.icon className="h-6 w-6 text-[#3ECFC0] icon-hover transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <h3 className="font-heading font-semibold text-lg mb-2 text-[#0B1E2D] dark:text-card-foreground group-hover:text-[#3ECFC0] transition-colors duration-300">
                    {lang === "ar" ? service.titleAr : service.titleEn}
                  </h3>
                  <p className="text-[#4a5568] dark:text-gray-300 text-sm leading-relaxed">
                    {lang === "ar" ? service.descAr : service.descEn}
                  </p>
                </CardContent>
              </Card>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ═══ How It Works - Dark Section with Step Animation ═══ */}
      <section className="bg-[#0B1E2D] text-white py-12 sm:py-20 section-transition relative overflow-hidden">
        <div className="absolute inset-0 pattern-bg opacity-10" />
        <div className="container relative">
          <ScrollSection>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold text-center mb-3">
              {lang === "ar" ? "كيف يعمل" : "How It Works"}
            </h2>
            <p className="text-white/90 text-center mb-14 max-w-xl mx-auto">
              {lang === "ar" ? "ثلاث خطوات بسيطة للحصول على سكنك الشهري المثالي" : "Three simple steps to find your perfect monthly home"}
            </p>
          </ScrollSection>
          <StaggerGrid className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10">
            {steps.map((step, i) => (
              <div key={i} className="text-center group relative">
                {/* Connecting line between steps */}
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 start-[60%] w-[80%] h-[2px] bg-gradient-to-r from-[#3ECFC0]/30 to-transparent" />
                )}
                <div className="relative inline-block mb-4">
                  <div className="text-4xl sm:text-5xl font-heading font-extrabold text-[#3ECFC0]/20 group-hover:text-[#3ECFC0]/40 transition-colors duration-500">
                    {step.num}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-[#3ECFC0]/10 group-hover:bg-[#3ECFC0]/20 group-hover:scale-125 transition-all duration-500" />
                  </div>
                </div>
                <h3 className="text-xl font-heading font-semibold mb-3 group-hover:text-[#3ECFC0] transition-colors duration-300">
                  {lang === "ar" ? step.titleAr : step.titleEn}
                </h3>
                <p className="text-white/90 text-sm leading-relaxed">
                  {lang === "ar" ? step.descAr : step.descEn}
                </p>
              </div>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ═══ Featured Properties with Slide Animation ═══ */}
      <section className="py-12 sm:py-20 bg-white dark:bg-background section-transition">
        <div className="container">
          <ScrollSection>
            <div className="flex items-center justify-between mb-6 sm:mb-10">
              <div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold text-[#0B1E2D] dark:text-foreground">
                  {lang === "ar" ? "عقارات مميزة" : "Featured Properties"}
                </h2>
                <p className="text-[#4a5568] dark:text-gray-300 mt-1">
                  {lang === "ar" ? "اكتشف أفضل العقارات المتاحة للتأجير الشهري" : "Discover the best monthly rental properties"}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setLocation("/search")}
                className="hidden md:flex border-[#3ECFC0] text-[#3ECFC0] hover:bg-[#3ECFC0]/10 btn-animate"
              >
                {t("common.viewAll")}
                <ArrowIcon className="h-4 w-4 ms-1.5" />
              </Button>
            </div>
          </ScrollSection>

          {featured.isLoading ? (
            <PropertyCardSkeletonGrid count={6} />
          ) : featured.data && featured.data.length > 0 ? (
            <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {featured.data.map((prop) => (
                <div key={prop.id} className="card-hover">
                  <PropertyCard property={prop} />
                </div>
              ))}
            </StaggerGrid>
          ) : (
            <Card className="p-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4 animate-float" />
              <p className="text-muted-foreground">
                {lang === "ar" ? "لا توجد عقارات متاحة حالياً" : "No properties available yet"}
              </p>
              <Button className="mt-4 bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] border-0 btn-animate" onClick={() => setLocation("/search")}>
                {lang === "ar" ? "تصفح العقارات" : "Browse Properties"}
              </Button>
            </Card>
          )}

          <div className="text-center mt-8 md:hidden">
            <Button variant="outline" onClick={() => setLocation("/search")} className="border-[#3ECFC0] text-[#3ECFC0] hover:bg-[#3ECFC0]/10 btn-animate">
              {t("common.viewAll")}
              <ArrowIcon className="h-4 w-4 ms-1.5" />
            </Button>
          </div>
        </div>
      </section>

      {/* ═══ Cities Section with Photo Cards ═══ */}
      <section className="bg-[#f5f7fa] dark:bg-[#0f1a24] py-12 sm:py-20 section-transition">
        <div className="container">
          <ScrollSection>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold text-center mb-3 text-[#0B1E2D] dark:text-foreground">
              {lang === "ar" ? "مدننا" : "Our Cities"}
            </h2>
            <p className="text-[#4a5568] dark:text-gray-300 text-center mb-12">
              {lang === "ar" ? "اكتشف العقارات المتاحة في أبرز المدن السعودية" : "Discover properties in Saudi Arabia's top cities"}
            </p>
          </ScrollSection>
          <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Active cities — clickable, with images */}
            {activeCities.slice(0, 6).map((city) => (
              <div
                key={city.id}
                onClick={() => setLocation(`/search?city=${city.nameEn?.toLowerCase()}`)}
                className="group cursor-pointer card-hover relative rounded-2xl overflow-hidden aspect-[4/3] shadow-md"
              >
                {city.imageUrl ? (
                  <img
                    src={city.imageUrl}
                    alt={lang === "ar" ? city.nameAr : city.nameEn}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0B1E2D] to-[#1a3a4f] flex items-center justify-center">
                    <MapPin className="h-16 w-16 text-[#3ECFC0]/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute bottom-0 start-0 end-0 p-5">
                  <h3 className="font-heading font-bold text-xl text-white mb-1 group-hover:text-[#3ECFC0] transition-colors duration-300">
                    {lang === "ar" ? city.nameAr : city.nameEn}
                  </h3>
                  {(city.region || city.regionAr) && (
                    <p className="text-white/90 text-sm">
                      {lang === "ar" ? (city.regionAr || city.region || "") : (city.region || "")}
                    </p>
                  )}
                </div>
                <div className="absolute top-4 end-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:bg-[#3ECFC0]">
                  <ArrowIcon className="h-5 w-5 text-white" />
                </div>
              </div>
            ))}
            {/* Coming Soon cities — from DB (isActive=false), not clickable */}
            {comingSoonCitiesDB.map((city) => (
              <div
                key={city.id}
                className="relative rounded-2xl overflow-hidden aspect-[4/3] shadow-md opacity-75"
              >
                {city.imageUrl ? (
                  <img
                    src={city.imageUrl}
                    alt={lang === "ar" ? city.nameAr : city.nameEn}
                    className="absolute inset-0 w-full h-full object-cover opacity-60"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0B1E2D] to-[#1a3a4f] flex items-center justify-center">
                    <MapPin className="h-16 w-16 text-[#C9A96E]/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute top-4 start-4">
                  <span className="inline-flex items-center gap-1 bg-[#C9A96E]/90 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {lang === "ar" ? "قريباً" : "Coming Soon"}
                  </span>
                </div>
                <div className="absolute bottom-0 start-0 end-0 p-5">
                  <h3 className="font-heading font-bold text-xl text-white/80 mb-1">
                    {lang === "ar" ? city.nameAr : city.nameEn}
                  </h3>
                  {(city.region || city.regionAr) && (
                    <p className="text-white/60 text-sm">
                      {lang === "ar" ? (city.regionAr || city.region || "") : (city.region || "")}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ═══ Testimonials with Glassmorphism ═══ */}
      <section className="py-12 sm:py-20 bg-white dark:bg-background section-transition">
        <div className="container">
          <ScrollSection>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold text-center mb-3 text-[#0B1E2D] dark:text-foreground">
              {lang === "ar" ? "آراء عملائنا" : "What Our Clients Say"}
            </h2>
            <p className="text-[#4a5568] dark:text-gray-300 text-center mb-12">
              {lang === "ar" ? "تجارب حقيقية من مستأجرين وملاك عقارات" : "Real experiences from tenants and property owners"}
            </p>
          </ScrollSection>
          <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {testimonials.map((item, i) => (
              <Card key={i} className="border-border/50 card-hover group relative overflow-hidden">
                {/* Subtle gradient accent on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#3ECFC0]/0 to-[#3ECFC0]/0 group-hover:from-[#3ECFC0]/3 group-hover:to-transparent transition-all duration-500" />
                <CardContent className="p-6 relative">
                  <Quote className="h-8 w-8 text-[#3ECFC0]/30 mb-4 group-hover:text-[#3ECFC0]/50 transition-colors duration-300" />
                  {/* Star rating */}
                  <div className="flex gap-1 mb-3">
                    {Array.from({ length: item.rating }).map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-[#C9A96E] text-[#C9A96E]" />
                    ))}
                  </div>
                  <p className="text-foreground/80 text-sm leading-relaxed mb-6 min-h-[80px]">
                    "{lang === "ar" ? item.textAr : item.textEn}"
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                    <div className="w-10 h-10 rounded-full bg-[#0B1E2D] flex items-center justify-center text-white font-bold text-sm group-hover:bg-[#3ECFC0] group-hover:text-[#0B1E2D] transition-all duration-500">
                      {(lang === "ar" ? item.nameAr : item.nameEn).charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{lang === "ar" ? item.nameAr : item.nameEn}</div>
                      <div className="text-xs text-muted-foreground">{lang === "ar" ? item.roleAr : item.roleEn}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </StaggerGrid>
        </div>
      </section>

      {/* ═══ CTA Section with Animated Background ═══ */}
      <section className="bg-[#0B1E2D] text-white py-12 sm:py-20 relative overflow-hidden section-transition">
        <div className="absolute inset-0 pattern-bg opacity-20" />
        {/* Animated gradient orbs */}
        <div className="absolute top-0 start-1/4 w-96 h-96 rounded-full bg-[#3ECFC0]/5 blur-3xl animate-float-slow" />
        <div className="absolute bottom-0 end-1/4 w-72 h-72 rounded-full bg-[#C9A96E]/5 blur-3xl animate-float" />
        
        <ScrollSection className="container relative text-center">
          {/* Brand watermark */}
          <img 
            src="/logo-mark.png" 
            alt="" 
            className="h-20 sm:h-24 w-auto object-contain mx-auto mb-6 opacity-10" 
          />
          <h2 className="text-xl sm:text-2xl md:text-4xl font-heading font-bold mb-4">
            {lang === "ar" ? "حقق أقصى استفادة من عقارك" : "Maximize Your Property's Potential"}
          </h2>
          <p className="text-white/90 mb-6 sm:mb-10 max-w-lg mx-auto text-sm sm:text-lg">
            {lang === "ar"
              ? "احصل على تقييم إيجار مجاني واكتشف كم يمكن أن يحقق عقارك"
              : "Get a free rental assessment and discover your property's earning potential"}
          </p>
          <div className="flex items-center justify-center">
            <Button
              size="lg"
              className="btn-animate bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] border-0 font-bold text-sm sm:text-base px-6 sm:px-8 h-11 sm:h-12 w-full sm:w-auto animate-glow"
              onClick={() => setLocation("/search")}
            >
              {lang === "ar" ? "تصفح العقارات" : "Browse Properties"}
            </Button>
          </div>
        </ScrollSection>
      </section>

      <Footer />
    </div>
  );
}
