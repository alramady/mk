import { useState, useRef, useEffect } from "react";
import { Search, SlidersHorizontal, ChevronDown, ChevronUp, RotateCcw, X } from "lucide-react";
import { useLocale } from "../contexts/LocaleContext";

/**
 * FilterSheet — Clean search bar + "More options" toggle underneath.
 * Top: single clean search input + search button.
 * Below: toggle that expands all filters (city, type, budget, bedrooms, bathrooms, area, amenities).
 * Mobile: filters expand as bottom sheet.
 * Desktop: filters expand inline below the bar.
 * Full AR/EN + RTL/LTR support.
 */

export interface FilterValues {
  city: string;
  type: string;
  minBudget: string;
  maxBudget: string;
  bedrooms: string;
  bathrooms: string;
  furnished: string;
  minArea: string;
  maxArea: string;
  amenities: string[];
}

export const EMPTY_FILTERS: FilterValues = {
  city: "",
  type: "",
  minBudget: "",
  maxBudget: "",
  bedrooms: "",
  bathrooms: "",
  furnished: "",
  minArea: "",
  maxArea: "",
  amenities: [],
};

/* ─── Data ─── */
const CITIES_AR = [
  { value: "", label: "الكل" },
  { value: "الرياض", label: "الرياض" },
  { value: "جدة", label: "جدة" },
  { value: "الدمام", label: "الدمام" },
  { value: "مكة", label: "مكة المكرمة" },
  { value: "المدينة", label: "المدينة المنورة" },
  { value: "الخبر", label: "الخبر" },
  { value: "أبها", label: "أبها" },
  { value: "تبوك", label: "تبوك" },
];
const CITIES_EN = [
  { value: "", label: "All" },
  { value: "الرياض", label: "Riyadh" },
  { value: "جدة", label: "Jeddah" },
  { value: "الدمام", label: "Dammam" },
  { value: "مكة", label: "Makkah" },
  { value: "المدينة", label: "Madinah" },
  { value: "الخبر", label: "Khobar" },
  { value: "أبها", label: "Abha" },
  { value: "تبوك", label: "Tabuk" },
];

const TYPES_AR = [
  { value: "", label: "الكل" },
  { value: "شقة", label: "شقة" },
  { value: "فيلا", label: "فيلا" },
  { value: "استوديو", label: "استوديو" },
  { value: "غرفة مفروشة", label: "غرفة مفروشة" },
  { value: "دوبلكس", label: "دوبلكس" },
  { value: "مجمع سكني", label: "مجمع سكني" },
  { value: "شقة فندقية", label: "شقة فندقية" },
];
const TYPES_EN = [
  { value: "", label: "All" },
  { value: "شقة", label: "Apartment" },
  { value: "فيلا", label: "Villa" },
  { value: "استوديو", label: "Studio" },
  { value: "غرفة مفروشة", label: "Furnished Room" },
  { value: "دوبلكس", label: "Duplex" },
  { value: "مجمع سكني", label: "Residential Complex" },
  { value: "شقة فندقية", label: "Hotel Apartment" },
];

const BEDROOMS = ["", "1", "2", "3", "4"];
const BATHROOMS = ["", "1", "2", "3"];

const AMENITIES_AR = [
  { value: "parking", label: "موقف سيارات" },
  { value: "pool", label: "مسبح" },
  { value: "gym", label: "صالة رياضية" },
  { value: "elevator", label: "مصعد" },
  { value: "security", label: "حراسة أمنية" },
  { value: "garden", label: "حديقة" },
  { value: "ac", label: "تكييف مركزي" },
  { value: "kitchen", label: "مطبخ مجهز" },
];
const AMENITIES_EN = [
  { value: "parking", label: "Parking" },
  { value: "pool", label: "Pool" },
  { value: "gym", label: "Gym" },
  { value: "elevator", label: "Elevator" },
  { value: "security", label: "Security" },
  { value: "garden", label: "Garden" },
  { value: "ac", label: "Central AC" },
  { value: "kitchen", label: "Equipped Kitchen" },
];

/* ─── Pill Selector ─── */
function PillSelector({
  label,
  options,
  value,
  onChange,
  allLabel,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-mk-navy mb-2">{label}</label>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`min-w-[44px] h-10 px-3 rounded-lg text-sm border font-medium transition-colors ${
              value === opt
                ? "bg-mk-teal text-white border-mk-teal"
                : "bg-white text-gray-600 border-gray-200 hover:border-mk-teal/50"
            }`}
          >
            {opt === "" ? allLabel : opt === "4" ? "4+" : opt}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── All Filters Content (used in both inline expand and mobile sheet) ─── */
function AllFiltersContent({
  values,
  onChange,
  onApply,
  onReset,
}: {
  values: FilterValues;
  onChange: (v: FilterValues) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const { locale, t } = useLocale();
  const update = (key: keyof FilterValues, val: any) => onChange({ ...values, [key]: val });
  const cities = locale === "ar" ? CITIES_AR : CITIES_EN;
  const types = locale === "ar" ? TYPES_AR : TYPES_EN;
  const amenities = locale === "ar" ? AMENITIES_AR : AMENITIES_EN;

  const toggleAmenity = (a: string) => {
    const current = values.amenities || [];
    update("amenities", current.includes(a) ? current.filter((x) => x !== a) : [...current, a]);
  };

  return (
    <div className="space-y-5">
      {/* Row 1: City & Type */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-mk-navy mb-2">
            {t("المدينة", "City")}
          </label>
          <select
            value={values.city}
            onChange={(e) => update("city", e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-mk-teal/30 focus:border-mk-teal appearance-none"
          >
            {cities.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-mk-navy mb-2">
            {t("نوع العقار", "Property Type")}
          </label>
          <select
            value={values.type}
            onChange={(e) => update("type", e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-mk-teal/30 focus:border-mk-teal appearance-none"
          >
            {types.map((tp) => (
              <option key={tp.value} value={tp.value}>{tp.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Price Range */}
      <div>
        <label className="block text-sm font-semibold text-mk-navy mb-2">
          {t("نطاق السعر (ر.س/شهر)", "Price Range (SAR/mo)")}
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            value={values.minBudget}
            onChange={(e) => update("minBudget", e.target.value)}
            placeholder={t("من", "Min")}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mk-teal/30 focus:border-mk-teal"
          />
          <span className="text-gray-400 text-sm">—</span>
          <input
            type="number"
            value={values.maxBudget}
            onChange={(e) => update("maxBudget", e.target.value)}
            placeholder={t("إلى", "Max")}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mk-teal/30 focus:border-mk-teal"
          />
        </div>
      </div>

      {/* Row 3: Bedrooms & Bathrooms */}
      <div className="grid grid-cols-2 gap-4">
        <PillSelector
          label={t("غرف النوم", "Bedrooms")}
          options={BEDROOMS}
          value={values.bedrooms}
          onChange={(v) => update("bedrooms", v)}
          allLabel={t("الكل", "All")}
        />
        <PillSelector
          label={t("دورات المياه", "Bathrooms")}
          options={BATHROOMS}
          value={values.bathrooms}
          onChange={(v) => update("bathrooms", v)}
          allLabel={t("الكل", "All")}
        />
      </div>


      {/* Row 5: Property Size */}
      <div>
        <label className="block text-sm font-semibold text-mk-navy mb-2">
          {t("المساحة (م²)", "Size (m²)")}
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            value={values.minArea}
            onChange={(e) => update("minArea", e.target.value)}
            placeholder={t("من", "Min")}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mk-teal/30 focus:border-mk-teal"
          />
          <span className="text-gray-400 text-sm">—</span>
          <input
            type="number"
            value={values.maxArea}
            onChange={(e) => update("maxArea", e.target.value)}
            placeholder={t("إلى", "Max")}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mk-teal/30 focus:border-mk-teal"
          />
        </div>
      </div>

      {/* Row 6: Amenities */}
      <div>
        <label className="block text-sm font-semibold text-mk-navy mb-2">
          {t("المرافق", "Amenities")}
        </label>
        <div className="flex flex-wrap gap-2">
          {amenities.map((a) => (
            <button
              key={a.value}
              onClick={() => toggleAmenity(a.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                (values.amenities || []).includes(a.value)
                  ? "bg-mk-teal/10 text-mk-teal border-mk-teal/30"
                  : "bg-white text-gray-500 border-gray-200 hover:border-mk-teal/30"
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
          onClick={onReset}
          className="flex items-center justify-center gap-1.5 flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RotateCcw size={14} />
          {t("إعادة تعيين", "Reset")}
        </button>
        <button
          onClick={onApply}
          className="flex items-center justify-center gap-1.5 flex-1 py-3 rounded-xl bg-mk-teal text-white text-sm font-medium hover:bg-mk-teal/90 transition-colors shadow-sm"
        >
          <Search size={14} />
          {t("عرض النتائج", "Show Results")}
        </button>
      </div>
    </div>
  );
}

/* ─── Mobile Bottom Sheet (for "More options" on mobile) ─── */
function MobileFilterSheet({
  open,
  onClose,
  values,
  onChange,
  onApply,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  values: FilterValues;
  onChange: (v: FilterValues) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 16px))" }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="font-bold text-mk-navy text-lg">
            {t("خيارات إضافية", "More Options")}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <div className="px-5 py-4">
          <AllFiltersContent
            values={values}
            onChange={onChange}
            onApply={() => { onApply(); onClose(); }}
            onReset={onReset}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Main Export: SearchBarWithFilters ─── */
export function SearchBarWithFilters({
  query,
  onQueryChange,
  onSearch,
  filters,
  onFiltersChange,
  onApply,
  onReset,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  onSearch: () => void;
  filters: FilterValues;
  onFiltersChange: (f: FilterValues) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const [mobileSheet, setMobileSheet] = useState(false);

  const activeCount = [
    filters.city,
    filters.type,
    filters.minBudget || filters.maxBudget ? "budget" : "",
    filters.bedrooms,
    filters.bathrooms,

    filters.minArea || filters.maxArea ? "area" : "",
    ...(filters.amenities || []),
  ].filter(Boolean).length;

  return (
    <div className="w-full">
      {/* ── Clean Search Bar ── */}
      <div className="flex items-center bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-mk-teal/30 transition-all overflow-hidden">
        <div className="flex items-center flex-1 px-4 gap-3">
          <Search size={20} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            placeholder={t(
              "ابحث بالمدينة، الحي، أو اسم العقار...",
              "Search by city, neighborhood, or property name..."
            )}
            className="flex-1 py-3.5 text-sm text-mk-navy placeholder:text-gray-400 focus:outline-none bg-transparent"
          />
        </div>
        <button
          onClick={onSearch}
          className="bg-mk-teal text-white px-6 py-3.5 text-sm font-semibold hover:bg-mk-teal/90 transition-colors shrink-0"
        >
          {t("بحث", "Search")}
        </button>
      </div>

      {/* ── "More Options" Toggle ── */}
      <div className="flex justify-center mt-3">
        {/* Desktop: toggle inline expand */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            expanded || activeCount > 0
              ? "bg-mk-navy text-white shadow-sm"
              : "bg-white/80 text-gray-600 border border-gray-200 hover:border-mk-navy/40 hover:text-mk-navy"
          }`}
        >
          <SlidersHorizontal size={15} />
          <span>{t("خيارات إضافية", "More Options")}</span>
          {activeCount > 0 && (
            <span className="bg-mk-teal text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {activeCount}
            </span>
          )}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Mobile: open bottom sheet */}
        <button
          onClick={() => setMobileSheet(true)}
          className={`md:hidden flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            activeCount > 0
              ? "bg-mk-navy text-white shadow-sm"
              : "bg-white/80 text-gray-600 border border-gray-200 hover:border-mk-navy/40 hover:text-mk-navy"
          }`}
        >
          <SlidersHorizontal size={15} />
          <span>{t("خيارات إضافية", "More Options")}</span>
          {activeCount > 0 && (
            <span className="bg-mk-teal text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {activeCount}
            </span>
          )}
          <ChevronDown size={14} />
        </button>
      </div>

      {/* ── Desktop: Inline Expanded Filters ── */}
      {expanded && (
        <div className="hidden md:block mt-4 bg-white rounded-2xl border border-gray-100 shadow-lg p-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <AllFiltersContent
            values={filters}
            onChange={onFiltersChange}
            onApply={() => { onApply(); setExpanded(false); }}
            onReset={onReset}
          />
        </div>
      )}

      {/* ── Mobile: Bottom Sheet ── */}
      <MobileFilterSheet
        open={mobileSheet}
        onClose={() => setMobileSheet(false)}
        values={filters}
        onChange={onFiltersChange}
        onApply={() => { onApply(); setMobileSheet(false); }}
        onReset={onReset}
      />
    </div>
  );
}

/* ─── Legacy compat exports ─── */
export default function FilterSheet({
  open,
  onOpenChange,
  values,
  onChange,
  onApply,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  values: FilterValues;
  onChange: (v: FilterValues) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  // Legacy wrapper — not used by new SearchBarWithFilters
  return null;
}

export function FilterTrigger({
  onClick,
  activeCount = 0,
}: {
  onClick: () => void;
  activeCount?: number;
}) {
  const { t } = useLocale();
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-mk-navy hover:border-mk-teal hover:text-mk-teal transition-colors bg-white relative"
    >
      <SlidersHorizontal size={15} />
      <span>{t("فلاتر", "Filters")}</span>
      {activeCount > 0 && (
        <span className="absolute -top-1.5 -start-1.5 w-5 h-5 rounded-full bg-mk-teal text-white text-[10px] font-bold flex items-center justify-center">
          {activeCount}
        </span>
      )}
    </button>
  );
}
