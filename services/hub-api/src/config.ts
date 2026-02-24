/**
 * ═══════════════════════════════════════════════════════════════
 *  Hub-API Configuration — Feature Flags & Writer Lock
 * ═══════════════════════════════════════════════════════════════
 *
 *  Writer Lock Rules (enforced by hub-api):
 *    MODE_COBNB=standalone     → hub-api REJECTS COBNB booking writes (409)
 *    MODE_COBNB=integrated     → hub-api IS the COBNB booking writer
 *    MODE_MONTHLYKEY=standalone → hub-api REJECTS MONTHLYKEY booking writes (409)
 *    MODE_MONTHLYKEY=integrated → hub-api IS the MONTHLYKEY booking writer
 *
 *  Feature Flags (safest defaults = ALL OFF):
 *    ENABLE_BEDS24=false            → Beds24 SDK not initialized
 *    ENABLE_BEDS24_WEBHOOKS=false   → Webhook endpoint returns 204 (no-op)
 *    ENABLE_BEDS24_PROXY=false      → Admin proxy endpoint returns 403
 *    ENABLE_AUTOMATED_TICKETS=false → No auto-ticket creation from webhooks
 *    ENABLE_PAYMENTS=false          → Payment endpoints disabled
 *    ENABLE_BANK_TRANSFER=false     → Bank transfer option hidden
 * ═══════════════════════════════════════════════════════════════
 */

import type { OperationMode, Brand, BookingWriter } from "@mk/shared";
import { isWriterAllowed, getDesignatedWriter } from "@mk/shared";

// ─── Helper: parse boolean env vars safely ─────────────────
function envBool(key: string, defaultValue: boolean): boolean {
  const val = process.env[key];
  if (val === undefined || val === "") return defaultValue;
  return val === "true" || val === "1";
}

// ─── Main Config ───────────────────────────────────────────
export const config = {
  port: parseInt(process.env.PORT_HUB_API ?? "4000", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  jwtSecret: process.env.JWT_SECRET ?? "change-me-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  logLevel: process.env.LOG_LEVEL ?? "info",

  // ── Operation Modes (default: standalone = safest) ───────
  modes: {
    cobnb: (process.env.MODE_COBNB ?? "standalone") as OperationMode,
    monthlykey: (process.env.MODE_MONTHLYKEY ?? "standalone") as OperationMode,
    ops: (process.env.MODE_OPS ?? "standalone") as OperationMode,
  },

  // ── Feature Flags (default: ALL OFF = safest) ────────────
  features: {
    beds24: envBool("ENABLE_BEDS24", false),
    beds24Webhooks: envBool("ENABLE_BEDS24_WEBHOOKS", false),
    beds24Proxy: envBool("ENABLE_BEDS24_PROXY", false),
    automatedTickets: envBool("ENABLE_AUTOMATED_TICKETS", false),
    payments: envBool("ENABLE_PAYMENTS", false),
    bankTransfer: envBool("ENABLE_BANK_TRANSFER", false),
    locationResolve: envBool("ENABLE_LOCATION_RESOLVE", false),
    googleMaps: envBool("ENABLE_GOOGLE_MAPS", false),
    mapboxMaps: envBool("ENABLE_MAPBOX_MAPS", false),
  },

  // ── Location / Maps (only used when ENABLE_LOCATION_RESOLVE=true) ──
  location: {
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
    mapboxPublicToken: process.env.MAPBOX_PUBLIC_TOKEN ?? "",
  },

  // ── Beds24 (only used when ENABLE_BEDS24=true) ──────────
  beds24: {
    apiUrl: process.env.BEDS24_API_URL ?? "https://api.beds24.com",
    refreshToken: process.env.BEDS24_REFRESH_TOKEN ?? "",
    // Static shared secret for webhook verification.
    // NOT HMAC — Beds24 does not sign webhooks. This is a plain string
    // that must match the "Custom Header" value set in Beds24 dashboard.
    webhookSecret: process.env.BEDS24_WEBHOOK_SECRET ?? "",
    // Previous secret — accepted during rotation window for zero-downtime rotation.
    // Set this to the OLD secret when rotating, then clear it after the window expires.
    webhookSecretPrevious: process.env.BEDS24_WEBHOOK_SECRET_PREVIOUS ?? "",
    // ISO 8601 timestamp when the rotation started. After ROTATION_WINDOW_DAYS
    // from this time, the previous secret is no longer accepted.
    webhookSecretRotationStart: process.env.BEDS24_WEBHOOK_SECRET_ROTATION_START ?? "",
    // Number of days to accept the previous secret after rotation starts.
    // Default: 7 days — gives ample time to update Beds24 dashboard.
    webhookSecretRotationWindowDays: parseInt(process.env.BEDS24_WEBHOOK_SECRET_ROTATION_WINDOW_DAYS ?? "7", 10),
    // Header name where Beds24 sends the shared secret.
    // Must match the "Custom Header" name set in Beds24 dashboard.
    webhookSecretHeader: (process.env.BEDS24_WEBHOOK_SECRET_HEADER ?? "x-webhook-secret").toLowerCase(),
  },

   // ── Admin Proxy Rate Limit ──────────────────────────
  adminProxy: {
    maxRequestsPerMinute: parseInt(process.env.ADMIN_PROXY_RATE_LIMIT ?? "30", 10),
  },

  // ── Location Resolve Rate Limit ─────────────────────
  locationResolve: {
    maxRequestsPerMinute: parseInt(process.env.LOCATION_RESOLVE_RATE_LIMIT ?? "20", 10),
  },
} as const;

// ═══════════════════════════════════════════════════════════
//  Writer Lock Helpers — Hub-API Side
// ═══════════════════════════════════════════════════════════

/** Get the operation mode for a brand. */
export function getBrandMode(brand: Brand): OperationMode {
  return brand === "COBNB" ? config.modes.cobnb : config.modes.monthlykey;
}

/** Check if hub-api is the designated writer for a brand. */
export function hubIsWriter(brand: Brand): boolean {
  const mode = getBrandMode(brand);
  return isWriterAllowed(mode, "hub-api");
}

/** Check if hub-api should REJECT writes for a brand (brand is in standalone mode). */
export function hubShouldRejectWrites(brand: Brand): boolean {
  return !hubIsWriter(brand);
}

/** Get the designated writer for a brand. */
export function getWriter(brand: Brand): BookingWriter {
  const mode = getBrandMode(brand);
  return getDesignatedWriter(mode);
}

/** Check if a brand is in integrated mode. */
export function isIntegrated(brand: Brand): boolean {
  return getBrandMode(brand) === "integrated";
}

/** Check if a brand is in standalone mode. */
export function isStandalone(brand: Brand): boolean {
  return getBrandMode(brand) === "standalone";
}

// ═══════════════════════════════════════════════════════════
//  Feature Flag Helpers
// ═══════════════════════════════════════════════════════════

/** Check if a feature is enabled. */
export function isFeatureEnabled(feature: keyof typeof config.features): boolean {
  return config.features[feature];
}

/** Get a summary of all feature flags for health/debug endpoints. */
export function getFeatureSummary() {
  return {
    modes: {
      cobnb: config.modes.cobnb,
      monthlykey: config.modes.monthlykey,
      ops: config.modes.ops,
    },
    writerLock: {
      cobnb: { mode: config.modes.cobnb, writer: getWriter("COBNB"), hubWrites: hubIsWriter("COBNB") },
      monthlykey: { mode: config.modes.monthlykey, writer: getWriter("MONTHLYKEY"), hubWrites: hubIsWriter("MONTHLYKEY") },
    },
    features: { ...config.features },
  };
}
