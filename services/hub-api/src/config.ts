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
  },

  // ── Beds24 (only used when ENABLE_BEDS24=true) ──────────
  beds24: {
    apiUrl: process.env.BEDS24_API_URL ?? "https://api.beds24.com",
    refreshToken: process.env.BEDS24_REFRESH_TOKEN ?? "",
    webhookSecret: process.env.BEDS24_WEBHOOK_SECRET ?? "",
  },

  // ── Admin Proxy Rate Limit ──────────────────────────────
  adminProxy: {
    maxRequestsPerMinute: parseInt(process.env.ADMIN_PROXY_RATE_LIMIT ?? "30", 10),
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
