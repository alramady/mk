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
 *    - Secrets (API keys) are NEVER logged
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
  ) {
    super(message);
    this.name = "LocationServiceError";
  }
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
      throw new LocationServiceError(
        ERROR_CODES.LOCATION_UNRESOLVABLE,
        `Failed to expand URL: ${shortUrl}`,
        HTTP_STATUS.BAD_GATEWAY,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Parse Coordinates from Google Maps URL ───────────────────

interface ParsedCoords {
  lat: number;
  lng: number;
}

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

function isValidCoord(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
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
 * Returns 503 if GOOGLE_MAPS_API_KEY is not configured (NOT a startup failure).
 */
export async function geocodeViaGoogle(address: string): Promise<GeocodeResult> {
  const apiKey = config.location.googleMapsApiKey;
  if (!apiKey) {
    throw new LocationServiceError(
      ERROR_CODES.NOT_CONFIGURED,
      "Google Maps API key is not configured. Location resolve via geocoding is temporarily unavailable.",
      HTTP_STATUS.SERVICE_UNAVAILABLE,
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
        `Google Geocoding API returned ${response.status}`,
        HTTP_STATUS.BAD_GATEWAY,
      );
    }

    const data = (await response.json()) as {
      status: string;
      results: Array<{
        geometry: { location: { lat: number; lng: number } };
        formatted_address: string;
        place_id: string;
      }>;
    };

    if (data.status !== "OK" || !data.results?.length) {
      throw new LocationServiceError(
        ERROR_CODES.LOCATION_UNRESOLVABLE,
        `Google Geocoding returned status: ${data.status}. Could not resolve location.`,
        HTTP_STATUS.UNPROCESSABLE,
      );
    }

    const result = data.results[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted_address: result.formatted_address,
      place_id: result.place_id ?? null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Call Google Place Details API to get formatted address for coords.
 * Returns null if API key missing or call fails (non-critical).
 */
export async function reverseGeocodeViaGoogle(
  lat: number,
  lng: number,
): Promise<{ formatted_address: string; place_id: string | null } | null> {
  const apiKey = config.location.googleMapsApiKey;
  if (!apiKey) return null; // Graceful degradation — not an error

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

    if (!response.ok) return null;

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
    return null; // Non-critical failure
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
    // We have coords — try to get formatted address via reverse geocode
    let formatted_address = "";
    let place_id: string | null = null;

    // Try place name from URL first
    const placeName = extractPlaceNameFromUrl(finalUrl);

    // Try reverse geocode for proper address (non-blocking)
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

  // Step 4: No coords in URL — try to extract place name and geocode
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

  // Step 5: Last resort — try geocoding the full URL as a query
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

  // No coords found and no Google API available
  throw new LocationServiceError(
    ERROR_CODES.LOCATION_UNRESOLVABLE,
    "Could not extract coordinates from the URL and Google Maps API is not enabled. " +
      "Enable ENABLE_GOOGLE_MAPS=true and set GOOGLE_MAPS_API_KEY, or provide a URL with coordinates.",
    HTTP_STATUS.UNPROCESSABLE,
  );
}
