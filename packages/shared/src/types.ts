// ─── Enums ──────────────────────────────────────────────────
export type Brand = "COBNB" | "MONTHLYKEY";
export type OperationMode = "standalone" | "integrated";
export type BookingWriter = "adapter" | "hub-api";

export type UserRole =
  | "ADMIN"
  | "OPS_MANAGER"
  | "CLEANER"
  | "TECHNICIAN"
  | "VENDOR"
  | "SUPPORT"
  | "OWNER"
  | "TENANT";

export type TicketType = "CLEANING" | "MAINTENANCE" | "INSPECTION" | "GUEST_ISSUE";
export type TicketStatus = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type BookingStatus = "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";
export type PaymentStatus = "INITIATED" | "PAID" | "FAILED" | "PENDING_BANK_TRANSFER" | "REFUNDED";
export type PaymentMethod = "CARD" | "BANK_TRANSFER" | "CASH";

export type UnitStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE";
export type Channel = "COBNB" | "MONTHLYKEY";

export type FeatureFlagScope = "GLOBAL" | "COBNB" | "MONTHLYKEY" | "OPS";

export type WebhookEventStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "DEAD_LETTER";

// ─── Data Models ────────────────────────────────────────────
export interface Unit {
  id: string;
  beds24PropertyId: string | null;
  beds24RoomId: string | null;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  city: string;
  zone: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  areaSqm: number | null;
  amenities: string[];
  images: string[];
  channelsEnabled: Channel[];
  status: UnitStatus;
  monthlyPrice: number | null;
  dailyPrice: number | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  brand: Brand;
  unitId: string;
  beds24BookingId: string | null;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  total: number;
  currency: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  idempotencyKey: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  id: string;
  type: TicketType;
  unitId: string;
  bookingId: string | null;
  title: string;
  description: string;
  dueAt: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  assignedToUserId: string | null;
  zone: string | null;
  notes: string | null;
  costMaterials: number;
  costLabor: number;
  costVendor: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface TicketTask {
  id: string;
  ticketId: string;
  title: string;
  done: boolean;
  photoUrls: string[];
  completedAt: string | null;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  zones: string[];
  isActive: boolean;
  createdAt: string;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  scope: FeatureFlagScope;
  description: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

// ─── Webhook Event ─────────────────────────────────────────
export interface WebhookEvent {
  id: string;
  eventId: string;
  eventType: string;
  source: string;
  payload: Record<string, unknown>;
  status: WebhookEventStatus;
  attempts: number;
  maxRetries: number;
  lastError: string | null;
  nextRetryAt: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Writer Lock Error ─────────────────────────────────────
export interface WriterLockError {
  code: "WRITER_LOCK_VIOLATION";
  message: string;
  brand: Brand;
  mode: OperationMode;
  designatedWriter: BookingWriter;
  rejectedBy: BookingWriter;
}

// ─── Idempotency ───────────────────────────────────────────
export interface IdempotencyEntry {
  key: string;
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
  createdAt: string;
  expiresAt: string;
}

// ─── API Request/Response ───────────────────────────────────
export interface SearchParams {
  brand: Brand;
  city?: string;
  zone?: string;
  checkIn?: string;
  checkOut?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  guests?: number;
  page?: number;
  limit?: number;
}

export interface QuoteParams {
  brand: Brand;
  unitId: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
}

export interface QuoteResult {
  unitId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  pricePerNight: number;
  total: number;
  currency: string;
  available: boolean;
}

export interface BookingCreateParams {
  brand: Brand;
  unitId: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guests: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  /** Provided by the caller via HTTP header, NOT auto-generated. */
  idempotencyKey: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ─── Location Resolve ──────────────────────────────────────
export interface LocationResolveRequest {
  google_maps_url: string;
  unit_number?: string | null;
  address_notes?: string | null;
}

export type ResolutionQuality = "full" | "coords_only" | "geocoded";

export interface LocationResolveResult {
  lat: number;
  lng: number;
  formatted_address: string;
  place_id: string | null;
  google_maps_url: string; // final expanded URL
  unit_number: string | null;
  address_notes: string | null;
  /** true when reverse geocode failed — UI should show "Address pending" */
  degraded: boolean;
  /** full = coords + address + place_id, coords_only = lat/lng only, geocoded = via Google Geocode */
  resolution_quality: ResolutionQuality;
  /** How the coordinates were obtained */
  resolved_via: "url_parse" | "google_geocode" | "cache";
}

export interface LocationCacheEntry {
  id: string;
  urlHash: string;
  finalUrl: string;
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

// ─── Beds24 Proxy ───────────────────────────────────────────
export interface Beds24ProxyRequest {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
}

export interface Beds24ProxyResponse {
  status: number;
  data: unknown;
}

// ─── Admin Proxy Audit ─────────────────────────────────────
export interface ProxyAuditEntry {
  actorUserId: string;
  method: string;
  path: string;
  query?: Record<string, string>;
  bodyRedacted: unknown;
  responseStatus: number;
  allowed: boolean;
  reason?: string;
  timestamp: string;
}
