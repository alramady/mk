// ═══════════════════════════════════════════════════════════
//  Brand Rules — Night limits per brand
// ═══════════════════════════════════════════════════════════

export const BRAND_RULES = {
  COBNB: {
    minNights: 1,
    maxNights: 27,
    label: "CoBnB KSA",
    labelAr: "كو بي إن بي",
  },
  MONTHLYKEY: {
    minNights: 28,
    maxNights: 365,
    label: "Monthly Key",
    labelAr: "المفتاح الشهري",
  },
} as const;

// ═══════════════════════════════════════════════════════════
//  Writer Lock — Who is allowed to write bookings per mode
//
//  standalone:  adapter is the writer  → hub-api MUST reject
//  integrated:  hub-api is the writer  → adapter MUST reject
// ═══════════════════════════════════════════════════════════

export const WRITER_LOCK = {
  standalone: {
    writer: "adapter",
    rejector: "hub-api",
  },
  integrated: {
    writer: "hub-api",
    rejector: "adapter",
  },
} as const;

/**
 * Determine who the designated booking writer is for a brand.
 * @param mode - "standalone" or "integrated"
 * @returns "adapter" or "hub-api"
 */
export function getDesignatedWriter(mode: "standalone" | "integrated"): "adapter" | "hub-api" {
  return WRITER_LOCK[mode].writer;
}

/**
 * Check if a given caller is allowed to write bookings for a brand.
 * @param mode - The brand's operation mode
 * @param caller - "adapter" or "hub-api"
 * @returns true if the caller is the designated writer
 */
export function isWriterAllowed(
  mode: "standalone" | "integrated",
  caller: "adapter" | "hub-api"
): boolean {
  return WRITER_LOCK[mode].writer === caller;
}

// ═══════════════════════════════════════════════════════════
//  Error Codes — Canonical error codes for the platform
// ═══════════════════════════════════════════════════════════

export const ERROR_CODES = {
  // Writer lock
  WRITER_LOCK_VIOLATION: "WRITER_LOCK_VIOLATION",
  // Idempotency
  IDEMPOTENCY_KEY_REQUIRED: "IDEMPOTENCY_KEY_REQUIRED",
  IDEMPOTENCY_KEY_REUSED: "IDEMPOTENCY_KEY_REUSED",
  // Availability
  NOT_AVAILABLE: "NOT_AVAILABLE",
  AVAILABILITY_CHANGED: "AVAILABILITY_CHANGED",
  // Brand rules
  BRAND_RULE_VIOLATION: "BRAND_RULE_VIOLATION",
  // Validation
  VALIDATION: "VALIDATION",
  // Auth
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  // Resources
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  // Proxy
  PROXY_ERROR: "PROXY_ERROR",
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  // Feature flags
  FEATURE_DISABLED: "FEATURE_DISABLED",
  // SDK
  SDK_NOT_INITIALIZED: "SDK_NOT_INITIALIZED",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  // Webhook
  WEBHOOK_DUPLICATE: "WEBHOOK_DUPLICATE",
  WEBHOOK_INVALID_SIGNATURE: "WEBHOOK_INVALID_SIGNATURE",
  // Payments
  PAYMENTS_DISABLED: "PAYMENTS_DISABLED",
  // Location
  LOCATION_DISABLED: "LOCATION_DISABLED",
  LOCATION_UNRESOLVABLE: "LOCATION_UNRESOLVABLE",
  LOCATION_INVALID_URL: "LOCATION_INVALID_URL",
  LOCATION_INVALID_COORDS: "LOCATION_INVALID_COORDS",
  // Google Geocoding API status mapping
  GOOGLE_ZERO_RESULTS: "GOOGLE_ZERO_RESULTS",
  GOOGLE_OVER_QUERY_LIMIT: "GOOGLE_OVER_QUERY_LIMIT",
  GOOGLE_REQUEST_DENIED: "GOOGLE_REQUEST_DENIED",
  GOOGLE_INVALID_REQUEST: "GOOGLE_INVALID_REQUEST",
  GOOGLE_UNKNOWN_ERROR: "GOOGLE_UNKNOWN_ERROR",
  // Upstream
  UPSTREAM_TIMEOUT: "UPSTREAM_TIMEOUT",
  // General
  INTERNAL: "INTERNAL",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  BAD_REQUEST: "BAD_REQUEST",
} as const;

// ═══════════════════════════════════════════════════════════
//  Webhook Event Statuses
// ═══════════════════════════════════════════════════════════

export const WEBHOOK_EVENT_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  DEAD_LETTER: "DEAD_LETTER",
} as const;

export const WEBHOOK_MAX_RETRIES = 5;

/** Exponential backoff delays in seconds: 30s, 2m, 8m, 32m, 2h */
export const WEBHOOK_RETRY_DELAYS_SEC = [30, 120, 480, 1920, 7200] as const;

// ═══════════════════════════════════════════════════════════
//  Admin Proxy — Endpoint Allowlist
// ═══════════════════════════════════════════════════════════

/**
 * Only these Beds24 API paths can be proxied.
 * Everything else is blocked. Paths are prefix-matched.
 */
export const ADMIN_PROXY_ALLOWLIST = [
  "/api/v2/properties",
  "/api/v2/rooms",
  "/api/v2/bookings",
  "/api/v2/inventory",
  "/api/v2/guests",
  "/api/v2/channels",
  "/api/v2/reports",
] as const;

/**
 * These paths are ALWAYS blocked, even if they match the allowlist.
 * Takes precedence over allowlist.
 */
export const ADMIN_PROXY_BLOCKLIST = [
  "/api/v2/authentication",
  "/api/v2/account",
  "/api/v2/billing",
  "/api/v2/users",
] as const;

/**
 * PII field names to redact in audit logs.
 * Matched case-insensitively against object keys at any depth.
 */
export const PII_FIELDS = [
  "email",
  "phone",
  "guestEmail",
  "guestPhone",
  "guest_email",
  "guest_phone",
  "firstName",
  "lastName",
  "guestFirstName",
  "guestLastName",
  "guest_first_name",
  "guest_last_name",
  "first_name",
  "last_name",
  "address",
  "streetAddress",
  "street_address",
  "idNumber",
  "id_number",
  "passport",
  "iban",
  "creditCard",
  "credit_card",
  "cardNumber",
  "card_number",
] as const;

// ═══════════════════════════════════════════════════════════
//  Operational Constants
// ═══════════════════════════════════════════════════════════

export const TICKET_SLA_HOURS: Record<string, number> = {
  CLEANING: 4,
  MAINTENANCE: 24,
  INSPECTION: 8,
  GUEST_ISSUE: 2,
};

export const CHECKOUT_CLEANING_BUFFER_MINUTES = 60;

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Beds24 webhook IP allowlist (PRIMARY authentication).
 * Beds24 does NOT sign webhooks with HMAC — IP allowlist is the
 * strongest authentication available.
 *
 * IMPORTANT: This is a compile-time default only. In production,
 * use the BEDS24_WEBHOOK_IP_ALLOWLIST env var (comma-separated)
 * which is loaded at runtime in the webhook route handler.
 *
 * Empty array = IP check disabled (not recommended for production).
 * Get IPs from Beds24 support or observe X-Forwarded-For in testing.
 */
export const BEDS24_WEBHOOK_IP_ALLOWLIST: string[] = [
  // Populate from Beds24 support when available.
  // Example: "52.58.0.0/16"
];

export const SAUDI_CITIES = [
  "الرياض",
  "جدة",
  "الدمام",
  "مكة المكرمة",
  "المدينة المنورة",
  "الخبر",
  "الطائف",
  "تبوك",
  "أبها",
  "الجبيل",
] as const;

export const FEATURE_FLAG_KEYS = [
  "ENABLE_BEDS24",
  "ENABLE_BEDS24_WEBHOOKS",
  "ENABLE_BEDS24_PROXY",
  "ENABLE_AUTOMATED_TICKETS",
  "ENABLE_PAYMENTS",
  "ENABLE_BANK_TRANSFER",
  "ENABLE_LOCATION_RESOLVE",
  "ENABLE_GOOGLE_MAPS",
  "ENABLE_MAPBOX_MAPS",
] as const;

// ═══════════════════════════════════════════════════════════
//  Location Resolve — URL Domain Allowlist
// ═══════════════════════════════════════════════════════════

/** Only these domains are accepted for location resolve input URLs. */
export const LOCATION_URL_ALLOWLIST = [
  "google.com",
  "www.google.com",
  "maps.google.com",
  "maps.app.goo.gl",
  "goo.gl",
] as const;

/** Cache TTL for resolved locations: 30 days in milliseconds. */
export const LOCATION_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;
