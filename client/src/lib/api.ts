/**
 * Monthly Key API Client
 * Connects to monthlykey.com tRPC endpoints
 * Uses Vite proxy in dev (/api/trpc → monthlykey.com/api/trpc)
 * In production, set VITE_API_BASE to your API URL or use a reverse proxy
 */

const API_BASE = import.meta.env.VITE_API_BASE
  ? `${import.meta.env.VITE_API_BASE}/api/trpc`
  : "/api/trpc";

// ─── Types matching the real API response shapes ───

export interface ApiProperty {
  id: number;
  landlordId: number;
  titleEn: string;
  titleAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  propertyType: "apartment" | "villa" | "studio" | "duplex" | "furnished_room" | "compound" | "hotel_apartment";
  status: string;
  pricingSource: string | null;
  city: string;
  cityAr: string;
  district: string;
  districtAr: string;
  address: string | null;
  addressAr: string | null;
  latitude: string | null;
  longitude: string | null;
  googleMapsUrl: string | null;
  bedrooms: number;
  bathrooms: number;
  sizeSqm: number;
  floor: number;
  totalFloors: number;
  yearBuilt: number | null;
  furnishedLevel: "unfurnished" | "semi_furnished" | "fully_furnished";
  monthlyRent: string; // "12000.00"
  securityDeposit: string | null;
  amenities: string[];
  utilitiesIncluded: string[];
  houseRules: string | null;
  houseRulesAr: string | null;
  minStayMonths: number;
  maxStayMonths: number;
  instantBook: boolean;
  photos: string[];
  videoUrl: string | null;
  virtualTourUrl: string | null;
  isVerified: boolean;
  isFeatured: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  manager?: {
    id: number;
    name: string;
    phone: string;
  } | null;
}

export interface ApiCity {
  id: number;
  name: string;
  nameAr: string;
  regionAr: string;
  imageUrl: string | null;
  isActive: boolean;
}

export interface SearchParams {
  query?: string;
  city?: string;
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  furnishedLevel?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  items: ApiProperty[];
  total: number;
}

export interface CalcConfig {
  allowedMonths: number[];
  insuranceRate: number;
  insuranceMode: "percentage" | "fixed";
  insuranceFixedAmount: number;
  serviceFeeRate: number;
  vatRate: number;
  hideInsuranceFromTenant: boolean;
  currency: string;
  version: string;
  labels: Record<string, string>;
}

// ─── tRPC Response Wrapper ───

interface TrpcResponse<T> {
  result: {
    data: {
      json: T;
    };
  };
}

// ─── API Functions ───

async function trpcQuery<T>(procedure: string, input?: object): Promise<T> {
  let url = `${API_BASE}/${procedure}`;
  if (input) {
    const encoded = encodeURIComponent(JSON.stringify({ json: input }));
    url += `?input=${encoded}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data: TrpcResponse<T> = await response.json();
  return data.result.data.json;
}

/** Get featured properties (homepage) */
export async function getFeaturedProperties(): Promise<ApiProperty[]> {
  return trpcQuery<ApiProperty[]>("property.featured");
}

/** Search properties with filters */
export async function searchProperties(params: SearchParams): Promise<SearchResult> {
  return trpcQuery<SearchResult>("property.search", params);
}

/** Get a single property by ID */
export async function getPropertyById(id: number): Promise<ApiProperty | null> {
  return trpcQuery<ApiProperty | null>("property.getById", { id });
}

/** Get all active cities */
export async function getCities(): Promise<ApiCity[]> {
  return trpcQuery<ApiCity[]>("cities.all");
}

/** Get calculator config */
export async function getCalcConfig(): Promise<CalcConfig> {
  return trpcQuery<CalcConfig>("calculator.config");
}

/** Get property reviews */
export async function getPropertyReviews(propertyId: number): Promise<{ reviews: unknown[]; avgRating: number | null }> {
  return trpcQuery("property.getReviews", { propertyId });
}

// ─── Pricing Calculator (matches server/booking-calculator.ts) ───

export function calculateBookingTotal(
  monthlyRent: number,
  durationMonths: number,
  config?: Partial<CalcConfig>
) {
  const insuranceRate = config?.insuranceRate ?? 10;
  const insuranceMode = config?.insuranceMode ?? "percentage";
  const insuranceFixedAmount = config?.insuranceFixedAmount ?? 0;
  const serviceFeeRate = config?.serviceFeeRate ?? 5;
  const vatRate = config?.vatRate ?? 15;
  const hideInsurance = config?.hideInsuranceFromTenant ?? false;

  const baseRentTotal = Math.round(monthlyRent * durationMonths);

  let insuranceAmount: number;
  if (insuranceMode === "fixed") {
    insuranceAmount = Math.round(insuranceFixedAmount);
  } else {
    insuranceAmount = Math.round(monthlyRent * (insuranceRate / 100));
  }

  const serviceFeeAmount = Math.round(baseRentTotal * (serviceFeeRate / 100));
  const subtotal = baseRentTotal + insuranceAmount + serviceFeeAmount;
  const vatAmount = Math.round(subtotal * (vatRate / 100));
  const grandTotal = subtotal + vatAmount;

  return {
    baseRentTotal,
    insuranceAmount,
    serviceFeeAmount,
    subtotal,
    vatAmount,
    grandTotal,
    displayInsurance: hideInsurance ? 0 : insuranceAmount,
    hideInsuranceFromTenant: hideInsurance,
    currency: config?.currency ?? "SAR",
    appliedRates: {
      insuranceRate,
      insuranceMode,
      serviceFeeRate,
      vatRate,
      hideInsuranceFromTenant: hideInsurance,
    },
  };
}

// ─── Property Type Labels ───

export const propertyTypeLabels: Record<string, string> = {
  apartment: "شقة",
  villa: "فيلا",
  studio: "استوديو",
  duplex: "دوبلكس",
  furnished_room: "غرفة مفروشة",
  compound: "مجمع سكني",
  hotel_apartment: "شقة فندقية",
};

export const furnishedLabels: Record<string, string> = {
  unfurnished: "غير مفروش",
  semi_furnished: "مفروش جزئياً",
  fully_furnished: "مفروش بالكامل",
};
