/**
 * Feature Flags Module
 *
 * Centralized reader for platform_settings-based feature flags.
 * All flags have hardcoded defaults (OFF) so deploying code changes nothing.
 * Flags are cached for 60 seconds to reduce DB hits.
 *
 * If a flag row is missing from DB, the default is used.
 * If a flag value is invalid (not "true"), it is treated as "false".
 */

import * as db from "./db";

// ─── Flag Definitions with Defaults ─────────────────────────────────
export const FLAG_DEFAULTS: Record<string, string> = {
  // Master switch: when OFF, all provider selection uses env vars as today
  "USE_DB_INTEGRATIONS": "false",
  // Admin write lock: when OFF, Integration Settings panel is read-only
  "ENABLE_INTEGRATION_PANEL_WRITE": "false",
  // Per-channel kill switches
  "SMS_ENABLED": "true",
  "EMAIL_OTP_ENABLED": "true",
  "WHATSAPP_ENABLED": "true",
  // WhatsApp OTP experiment (reserved, not implemented)
  "WHATSAPP_OTP_EXPERIMENT": "false",
  // Verification gates
  "verification.requireForInstantBook": "false",
  "verification.requireForPayment": "false",
  // SMS routing: +966 -> Unifonic, others -> Twilio
  "verification.smsRoutingEnabled": "false",
  // Taqnyat integration switches
  "TAQNYAT_SMS_ENABLED": "false",
  "TAQNYAT_WHATSAPP_ENABLED": "false",
  // KYC gates
  "kyc.enableGating": "false",
  "kyc.enableSubmission": "false",
};

// ─── Cache ──────────────────────────────────────────────────────────
let _cache: Record<string, string> = {};
let _cacheTs = 0;
const CACHE_TTL = 60_000; // 60 seconds

async function refreshCache(): Promise<void> {
  try {
    const all = await db.getAllSettings();
    _cache = all;
    _cacheTs = Date.now();
  } catch (err) {
    console.warn("[FeatureFlags] Failed to refresh cache from DB:", err);
    // Keep stale cache if DB is down — flags will use defaults
  }
}

/**
 * Get the value of a feature flag.
 * Returns the DB value if present, otherwise the hardcoded default.
 * If the flag key is unknown, returns "false".
 */
export async function getFlag(key: string): Promise<string> {
  // Refresh cache if stale
  if (Date.now() - _cacheTs > CACHE_TTL) {
    await refreshCache();
  }

  // DB value takes precedence
  if (key in _cache && _cache[key] !== undefined && _cache[key] !== "") {
    return _cache[key];
  }

  // Fall back to hardcoded default
  return FLAG_DEFAULTS[key] ?? "false";
}

/**
 * Check if a boolean flag is enabled (value === "true").
 * Any value other than "true" (including "yes", "1", etc.) is treated as false.
 */
export async function isFlagOn(key: string): Promise<boolean> {
  const val = await getFlag(key);
  return val === "true";
}

/**
 * Get all flags with their current effective values (for admin display).
 */
export async function getAllFlags(): Promise<Record<string, { value: string; source: "db" | "default" }>> {
  if (Date.now() - _cacheTs > CACHE_TTL) {
    await refreshCache();
  }

  const result: Record<string, { value: string; source: "db" | "default" }> = {};

  for (const key of Object.keys(FLAG_DEFAULTS)) {
    if (key in _cache && _cache[key] !== undefined && _cache[key] !== "") {
      result[key] = { value: _cache[key], source: "db" };
    } else {
      result[key] = { value: FLAG_DEFAULTS[key], source: "default" };
    }
  }

  return result;
}

/**
 * Force-refresh the flag cache. Call after admin updates a setting.
 */
export function invalidateFlagCache(): void {
  _cacheTs = 0;
}
