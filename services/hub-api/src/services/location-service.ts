/**
 * ═══════════════════════════════════════════════════════════════
 *  Location Resolve Service — Hybrid Maps
 * ═══════════════════════════════════════════════════════════════
 *
 *  FULLY ADDITIVE — does NOT touch writer-lock, webhooks, or
 *  any existing code paths.
 *
 *  Resolution pipeline:
 *    1. Validate URL domain against allowlist
 *    2. Check Redis cache (fast path)
 *    3. Check Postgres cache (warm path)
 *    4. Expand short URL (follow redirects)
 *    5. Parse lat/lng from expanded URL query params
 *    6. If no coords in URL → call Google Geocoding API (requires key)
 *    7. Store result in Redis + Postgres cache
 *    8. Return resolved location
 *
 *  Key constraints:
 *    - Missing Google API key → 503 at resolve time (NOT startup failure)
 *    - All cache columns nullable-safe, no backfills
 *    - Domain allowlist: google.com, maps.google.com, maps.app.goo.gl, goo.gl
 *    - Secrets (API keys) are NEVER logged — fetch errors are sanitized
 *
 *  Graceful degradation policy:
 *    - Coords in URL + Google unavailable → SUCCESS with lat/lng + empty address
 *    - No coords in URL + Google unavailable → 503 (cannot resolve without API)
 *    - Google returns non-OK status → mapped to specific error code + retryable flag
 * ═══════════════════════════════════════════════════════════════
 */

import { createHash } from "crypto";
import { config, isFeatureEnabled } from "../config.js";
import {
  LOCATION_URL_ALLOWLIST,
  LOCATION_CACHE_TTL_MS,
  ERROR_CODES,
  HTTP_STATUS,
} from "@mk/shared";
import type { LocationResolveRequest, LocationResolveResult } from "@mk/shared";

// ─── Types ────────────────────────────────────────────────────

interface CacheEntry {
  lat: number;
  lng: number;
  formatted_address: string;
  place_id: string | null;
  final_url: string;
  resolved_via: string;
}

export class LocationServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "LocationServiceError";
  }
}

// ─── Google Status → Platform Error Mapping ──────────────────

/**
 * Maps every documented Google Geocoding API status to a platform
 * error code, HTTP status, human message, and retryable flag.
 *
 * Reference: https://developers.google.com/maps/documentation/geocoding/requests-geocoding#StatusCodes
 */
interface GoogleStatusMapping {
  code: string;
  status: number;
  message: string;
  retryable: boolean;
}

const GOOGLE_STATUS_MAP: Record<string, GoogleStatusMapping> = {
  ZERO_RESULTS: {
    code: ERROR_CODES.GOOGLE_ZERO_RESULTS,
    status: HTTP_STATUS.UNPROCESSABLE,
    message: "Google Geocoding found no results for the given address.",
    retryable: false,
  },
  OVER_QUERY_LIMIT: {
    code: ERROR_CODES.GOOGLE_OVER_QUERY_LIMIT,
    status: 429,
    message: "Google Geocoding API quota exceeded. Please retry later.",
    retryable: true,
  },
  REQUEST_DENIED: {
    code: ERROR_CODES.GOOGLE_REQUEST_DENIED,
    status: HTTP_STATUS.FORBIDDEN,
    message: "Google Geocoding API request was denied. Check API key permissions.",
    retryable: false,
  },
  INVALID_REQUEST: {
    code: ERROR_CODES.GOOGLE_INVALID_REQUEST,
    status: HTTP_STATUS.BAD_REQUEST,
    message: "Google Geocoding API received an invalid request.",
    retryable: false,
  },
  UNKNOWN_ERROR: {
    code: ERROR_CODES.GOOGLE_UNKNOWN_ERROR,
    status: HTTP_STATUS.BAD_GATEWAY,
    message: "Google Geocoding API returned an unknown error. Please retry.",
    retryable: true,
  },
};

/**
 * Map a Google Geocoding API status string to a LocationServiceError.
 * Falls back to UPSTREAM_ERROR for undocumented statuses.
 */
function mapGoogleStatus(googleStatus: string): LocationServiceError {
  const mapping = GOOGLE_STATUS_MAP[googleStatus];
  if (mapping) {
    return new LocationServiceError(
      mapping.code,
      mapping.message,
      mapping.status,
      mapping.retryable,
    );
  }
  // Undocumented status — treat as upstream error, retryable
  return new LocationServiceError(
    ERROR_CODES.UPSTREAM_ERROR,
    `Google Geocoding API returned unexpected status: ${googleStatus}`,
    HTTP_STATUS.BAD_GATEWAY,
    true,
  );
}

// ─── API Key Sanitization ────────────────────────────────────

/**
 * Sanitize any error message or URL string to remove API keys.
 * This prevents accidental key leakage via stack traces or error logs.
 */
function sanitizeApiKey(text: string): string {
  const apiKey = config.location.googleMapsApiKey;
  if (!apiKey) return text;
  return text.replaceAll(apiKey, "[REDACTED_API_KEY]");
}

// ─── URL Domain Validation ────────────────────────────────────

/**
 * Validate that the URL belongs to an allowed domain.
 * Accepts: google.com, www.google.com, maps.google.com, maps.app.goo.gl, goo.gl
 */
export function validateUrlDomain(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new LocationServiceError(
      ERROR_CODES.LOCATION_INVALID_URL,
      "Invalid URL format. Must be a valid Google Maps URL.",
      HTTP_STATUS.BAD_REQUEST,
      false,
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  const isAllowed = LOCATION_URL_ALLOWLIST.some((allowed) => {
    return hostname === allowed || hostname.endsWith(`.${allowed}`);
  });

  if (!isAllowed) {
    throw new LocationServiceError(
      ERROR_CODES.LOCATION_INVALID_URL,
      `Domain "${hostname}" is not in the allowed list. Only Google Maps URLs are accepted.`,
      HTTP_STATUS.BAD_REQUEST,
      false,
    );
  }
}

// ─── URL Hash ─────────────────────────────────────────────────

export function hashUrl(url: string): string {
  return createHash("sha256").update(url.trim().toLowerCase()).digest("hex");
}

// ─── URL Expansion (follow redirects) ─────────────────────────

/**
 * Expand a short URL (e.g., maps.app.goo.gl/xxx) by following redirects.
 * Uses HEAD requests to avoid downloading full page content.
 * Times out after 10 seconds.
 */
export async function expandUrl(shortUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    // Use fetch with redirect: "follow" — Node 18+ supports this natively
    const response = await fetch(shortUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "MK-LocationResolver/1.0",
      },
    });
    return response.url; // final URL after all redirects
  } catch (err: unknown) {
    // If HEAD fails (some servers block it), try GET
    try {
      const response = await fetch(shortUrl, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "MK-LocationResolver/1.0",
        },
      });
      return response.url;
    } catch {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      throw new LocationServiceError(
        isTimeout ? ERROR_CODES.UPSTREAM_TIMEOUT : ERROR_CODES.LOCATION_UNRESOLVABLE,
        `Failed to expand URL: ${shortUrl}`,
        HTTP_STATUS.BAD_GATEWAY,
        true, // URL expansion failures are retryable
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Coordinate Validation ───────────────────────────────────

interface ParsedCoords {
  lat: number;
  lng: number;
}

/**
 * Validate that lat/lng are within valid WGS-84 ranges.
 * lat: -90 to 90, lng: -180 to 180.
 */
export function isValidCoord(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Validate coords and throw if invalid. Used after Google API returns.
 */
function assertValidCoords(lat: number, lng: number, source: string): void {
  if (!isValidCoord(lat, lng)) {
    throw new LocationServiceError(
      ERROR_CODES.LOCATION_INVALID_COORDS,
      `${source} returned invalid coordinates: lat=${lat}, lng=${lng}. ` +
        "Valid ranges: lat [-90, 90], lng [-180, 180].",
      HTTP_STATUS.BAD_GATEWAY,
      false,
    );
  }
}

// ─── Parse Coordinates from Google Maps URL ───────────────────

/**
 * Attempt to extract lat/lng from a Google Maps URL.
 *
 * Supported patterns:
 *   - @lat,lng,zoom (in path)
 *   - ?q=lat,lng
 *   - ?ll=lat,lng
 *   - /place/.../@lat,lng
 *   - !3dlat!4dlng (embedded format)
 */
export function parseCoordsFromUrl(url: string): ParsedCoords | null {
  // Pattern 1: @lat,lng in path (most common)
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidCoord(lat, lng)) return { lat, lng };
  }

  // Pattern 2: query params ?q=lat,lng or ?ll=lat,lng
  try {
    const parsed = new URL(url);
    for (const key of ["q", "ll", "center", "query"]) {
      const val = parsed.searchParams.get(key);
      if (val) {
        const coordMatch = val.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
        if (coordMatch) {
          const lat = parseFloat(coordMatch[1]);
          const lng = parseFloat(coordMatch[2]);
          if (isValidCoord(lat, lng)) return { lat, lng };
        }
      }
    }
  } catch {
    // Not a valid URL for query parsing — continue
  }

  // Pattern 3: !3d (lat) !4d (lng) embedded format
  const embedLat = url.match(/!3d(-?\d+\.?\d*)/);
  const embedLng = url.match(/!4d(-?\d+\.?\d*)/);
  if (embedLat && embedLng) {
    const lat = parseFloat(embedLat[1]);
    const lng = parseFloat(embedLng[1]);
    if (isValidCoord(lat, lng)) return { lat, lng };
  }

  return null;
}

// ─── Google Geocoding API ─────────────────────────────────────

interface GeocodeResult {
  lat: number;
  lng: number;
  formatted_address: string;
  place_id: string | null;
}

/**
 * Call Google Geocoding API to resolve an address string.
 *
 * Error handling:
 *   - Missing API key → 503 NOT_CONFIGURED (retryable: true)
 *   - HTTP error → UPSTREAM_ERROR (retryable: true)
 *   - Timeout → UPSTREAM_TIMEOUT (retryable: true)
 *   - ZERO_RESULTS → GOOGLE_ZERO_RESULTS (retryable: false)
 *   - OVER_QUERY_LIMIT → GOOGLE_OVER_QUERY_LIMIT (retryable: true)
 *   - REQUEST_DENIED → GOOGLE_REQUEST_DENIED (retryable: false)
 *   - INVALID_REQUEST → GOOGLE_INVALID_REQUEST (retryable: false)
 *   - UNKNOWN_ERROR → GOOGLE_UNKNOWN_ERROR (retryable: true)
 *   - Invalid coords in response → LOCATION_INVALID_COORDS (retryable: false)
 *
 * API keys are NEVER logged. All fetch errors are sanitized.
 */
export async function geocodeViaGoogle(address: string): Promise<GeocodeResult> {
  const apiKey = config.location.googleMapsApiKey;
  if (!apiKey) {
    throw new LocationServiceError(
      ERROR_CODES.NOT_CONFIGURED,
      "Google Maps API key is not configured. Location resolve via geocoding is temporarily unavailable.",
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      true, // Retryable — key might be configured later
    );
  }

  const params = new URLSearchParams({
    address,
    key: apiKey,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
      { signal: controller.signal },
    );

    if (!response.ok) {
      throw new LocationServiceError(
        ERROR_CODES.UPSTREAM_ERROR,
        `Google Geocoding API returned HTTP ${response.status}`,
        HTTP_STATUS.BAD_GATEWAY,
        true, // HTTP errors are retryable
      );
    }

    const data = (await response.json()) as {
      status: string;
      error_message?: string;
      results: Array<{
        geometry: { location: { lat: number; lng: number } };
        formatted_address: string;
        place_id: string;
      }>;
    };

    // Map non-OK Google statuses to specific platform errors
    if (data.status !== "OK") {
      throw mapGoogleStatus(data.status);
    }

    if (!data.results?.length) {
      throw new LocationServiceError(
        ERROR_CODES.GOOGLE_ZERO_RESULTS,
        "Google Geocoding returned OK but with empty results array.",
        HTTP_STATUS.UNPROCESSABLE,
        false,
      );
    }

    const result = data.results[0];
    const lat = result.geometry.location.lat;
    const lng = result.geometry.location.lng;

    // Validate returned coordinates
    assertValidCoords(lat, lng, "Google Geocoding API");

    return {
      lat,
      lng,
      formatted_address: result.formatted_address,
      place_id: result.place_id ?? null,
    };
  } catch (err: unknown) {
    // Re-throw LocationServiceError as-is
    if (err instanceof LocationServiceError) throw err;

    // AbortError = timeout
    if (err instanceof Error && err.name === "AbortError") {
      throw new LocationServiceError(
        ERROR_CODES.UPSTREAM_TIMEOUT,
        "Google Geocoding API request timed out after 10 seconds.",
        HTTP_STATUS.GATEWAY_TIMEOUT,
        true,
      );
    }

    // Unknown fetch error — sanitize to prevent API key leakage
    const rawMessage = err instanceof Error ? err.message : String(err);
    throw new LocationServiceError(
      ERROR_CODES.UPSTREAM_ERROR,
      `Google Geocoding API call failed: ${sanitizeApiKey(rawMessage)}`,
      HTTP_STATUS.BAD_GATEWAY,
      true,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Call Google Reverse Geocoding API to get formatted address for coords.
 *
 * This is a NON-CRITICAL call used for enrichment. Failures return null
 * (graceful degradation) — the caller already has lat/lng from URL parsing.
 *
 * Error handling:
 *   - Missing API key → null (graceful, not an error)
 *   - HTTP error → null (graceful)
 *   - Timeout → null (graceful)
 *   - Non-OK status → null (graceful)
 *   - All errors sanitized to prevent API key leakage
 *
 * Input lat/lng are validated before calling Google.
 */
export async function reverseGeocodeViaGoogle(
  lat: number,
  lng: number,
): Promise<{ formatted_address: string; place_id: string | null } | null> {
  const apiKey = config.location.googleMapsApiKey;
  if (!apiKey) return null; // Graceful degradation — not an error

  // Validate input coordinates before sending to Google
  if (!isValidCoord(lat, lng)) return null;

  const params = new URLSearchParams({
    latlng: `${lat},${lng}`,
    key: apiKey,
    language: "ar", // Arabic results for Saudi context
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
      { signal: controller.signal },
    );

    if (!response.ok) return null; // Graceful — caller has coords

    const data = (await response.json()) as {
      status: string;
      results: Array<{
        formatted_address: string;
        place_id: string;
      }>;
    };

    if (data.status !== "OK" || !data.results?.length) return null;

    return {
      formatted_address: data.results[0].formatted_address,
      place_id: data.results[0].place_id ?? null,
    };
  } catch {
    // All errors are graceful — caller already has lat/lng
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Extract Place Name from URL ──────────────────────────────

/**
 * Try to extract a human-readable place name from a Google Maps URL path.
 * e.g., /maps/place/Riyadh+Park+Mall/ → "Riyadh Park Mall"
 */
export function extractPlaceNameFromUrl(url: string): string | null {
  const placeMatch = url.match(/\/place\/([^/@]+)/);
  if (placeMatch) {
    return decodeURIComponent(placeMatch[1].replace(/\+/g, " ")).trim();
  }
  return null;
}

// ─── Main Resolve Function ────────────────────────────────────

/**
 * Resolve a Google Maps URL to lat/lng + formatted address.
 *
 * Pipeline:
 *   1. Validate domain
 *   2. Expand short URL
 *   3. Parse coords from URL
 *   4. If no coords → extract place name → geocode via Google
 *   5. Optionally reverse-geocode for formatted address
 *   6. Return result
 *
 * ═══════════════════════════════════════════════════════════════
 *  GRACEFUL DEGRADATION POLICY
 * ═══════════════════════════════════════════════════════════════
 *
 *  Scenario 1: Coords in URL + Google available
 *    → SUCCESS: lat/lng + formatted_address + place_id from reverse geocode
 *    → resolved_via: "url_parse"
 *
 *  Scenario 2: Coords in URL + Google unavailable/disabled
 *    → SUCCESS: lat/lng + place name from URL (or empty string) + null place_id
 *    → resolved_via: "url_parse"
 *    → This is the KEY graceful degradation: we return what we have
 *
 *  Scenario 3: No coords in URL + Google available
 *    → SUCCESS: lat/lng + formatted_address + place_id from geocode
 *    → resolved_via: "google_geocode"
 *
 *  Scenario 4: No coords in URL + Google unavailable/disabled
 *    → FAILURE: 503 (cannot resolve without API)
 *    → retryable: true
 *
 * ═══════════════════════════════════════════════════════════════
 *
 * This function does NOT handle caching — that's done at the route level
 * with Redis (fast) + Postgres (persistent).
 */
export async function resolveLocation(
  request: LocationResolveRequest,
): Promise<LocationResolveResult & { resolved_via: string }> {
  // Guard: feature must be enabled
  if (!isFeatureEnabled("locationResolve")) {
    throw new LocationServiceError(
      ERROR_CODES.LOCATION_DISABLED,
      "Location resolve feature is disabled.",
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      false,
    );
  }

  const rawUrl = request.google_maps_url.trim();

  // Step 1: Validate domain
  validateUrlDomain(rawUrl);

  // Step 2: Expand short URL if needed
  let finalUrl = rawUrl;
  const isShortUrl =
    rawUrl.includes("goo.gl/") ||
    rawUrl.includes("maps.app.goo.gl/");

  if (isShortUrl) {
    finalUrl = await expandUrl(rawUrl);
    // Re-validate the expanded URL domain
    validateUrlDomain(finalUrl);
  }

  // Step 3: Parse coords from URL
  const parsed = parseCoordsFromUrl(finalUrl);

  if (parsed) {
    // ── Scenario 1 or 2: Coords found in URL ──
    // We ALWAYS return success here — Google enrichment is optional
    let formatted_address = "";
    let place_id: string | null = null;

    // Try place name from URL first (zero-cost fallback)
    const placeName = extractPlaceNameFromUrl(finalUrl);

    // Try reverse geocode for proper address (non-blocking, graceful)
    if (isFeatureEnabled("googleMaps")) {
      const reverseResult = await reverseGeocodeViaGoogle(parsed.lat, parsed.lng);
      if (reverseResult) {
        formatted_address = reverseResult.formatted_address;
        place_id = reverseResult.place_id;
      }
    }

    // Fallback: use place name from URL if no geocode result
    if (!formatted_address && placeName) {
      formatted_address = placeName;
    }

    return {
      lat: parsed.lat,
      lng: parsed.lng,
      formatted_address,
      place_id,
      google_maps_url: finalUrl,
      unit_number: request.unit_number ?? null,
      address_notes: request.address_notes ?? null,
      resolved_via: "url_parse",
    };
  }

  // ── Scenario 3 or 4: No coords in URL ──
  // Must use Google Geocoding API — if unavailable, 503

  const placeName = extractPlaceNameFromUrl(finalUrl);

  if (placeName && isFeatureEnabled("googleMaps")) {
    const geocodeResult = await geocodeViaGoogle(placeName);
    return {
      lat: geocodeResult.lat,
      lng: geocodeResult.lng,
      formatted_address: geocodeResult.formatted_address,
      place_id: geocodeResult.place_id,
      google_maps_url: finalUrl,
      unit_number: request.unit_number ?? null,
      address_notes: request.address_notes ?? null,
      resolved_via: "google_geocode",
    };
  }

  // Last resort — try geocoding the full URL as a query
  if (isFeatureEnabled("googleMaps")) {
    const geocodeResult = await geocodeViaGoogle(finalUrl);
    return {
      lat: geocodeResult.lat,
      lng: geocodeResult.lng,
      formatted_address: geocodeResult.formatted_address,
      place_id: geocodeResult.place_id,
      google_maps_url: finalUrl,
      unit_number: request.unit_number ?? null,
      address_notes: request.address_notes ?? null,
      resolved_via: "google_geocode",
    };
  }

  // Scenario 4: No coords + no Google → 503
  throw new LocationServiceError(
    ERROR_CODES.LOCATION_UNRESOLVABLE,
    "Could not extract coordinates from the URL and Google Maps API is not enabled. " +
      "Enable ENABLE_GOOGLE_MAPS=true and set GOOGLE_MAPS_API_KEY, or provide a URL with coordinates.",
    HTTP_STATUS.UNPROCESSABLE,
    true, // Retryable — Google might be enabled later
  );
}
