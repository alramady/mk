/**
 * Maps Service — Hardened, Admin-First
 * Handles: provider abstraction, geocoding with cache, rate limiting, cost protection
 * Security: keys never logged, masked in responses, encrypted at rest via integration_configs
 */
import crypto from "crypto";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { ENV } from "./_core/env";
import { eq, and, sql } from "drizzle-orm";
import { integrationConfigs, geocodeCache, properties, auditLog } from "../drizzle/schema";

const pool = mysql.createPool(ENV.databaseUrl);
const db = drizzle(pool);

// ─── Types ──────────────────────────────────────────────────────────

export interface MapsConfig {
  provider: "GOOGLE" | "MAPBOX" | "DISABLED";
  apiKey: string;
  mapId?: string;
  mapboxToken?: string;
  enabled: boolean;
  showOnPropertyPage: boolean;
  enableGeocodingInAdmin: boolean;
  enablePinPickerInAdmin: boolean;
  defaultCity: string;
  defaultCenterLat: number;
  defaultCenterLng: number;
  defaultZoom: number;
  mapTheme: "light" | "dark";
  geocodeDailyCap: number;
  geocodeRateLimitPerAdmin: number;
  geocodeCacheTTLDays: number;
}

const DEFAULT_CONFIG: MapsConfig = {
  provider: "GOOGLE",
  apiKey: "",
  enabled: false,
  showOnPropertyPage: true,
  enableGeocodingInAdmin: true,
  enablePinPickerInAdmin: true,
  defaultCity: "Riyadh",
  defaultCenterLat: 24.7136,
  defaultCenterLng: 46.6753,
  defaultZoom: 12,
  mapTheme: "light",
  geocodeDailyCap: 200,
  geocodeRateLimitPerAdmin: 10,
  geocodeCacheTTLDays: 90,
};

// ─── Rate Limiter (in-memory, per-admin) ────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(adminId: number, limitPerMinute: number): boolean {
  const key = `geocode:${adminId}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= limitPerMinute) return false;
  entry.count++;
  return true;
}

// Daily cap tracking (in-memory, resets at midnight)
let dailyGeocodeCount = 0;
let dailyResetDate = new Date().toDateString();

function checkDailyCap(cap: number): boolean {
  const today = new Date().toDateString();
  if (today !== dailyResetDate) {
    dailyGeocodeCount = 0;
    dailyResetDate = today;
  }
  if (dailyGeocodeCount >= cap) return false;
  dailyGeocodeCount++;
  return true;
}

// ─── Config Helpers ─────────────────────────────────────────────────

export async function getMapsConfig(): Promise<MapsConfig> {
  try {
    const [row] = await db.select().from(integrationConfigs)
      .where(eq(integrationConfigs.integrationKey, "maps"));
    if (!row) return { ...DEFAULT_CONFIG };
    const stored = row.configJson ? JSON.parse(row.configJson) : {};
    return {
      provider: stored.provider || DEFAULT_CONFIG.provider,
      apiKey: stored.apiKey || "",
      mapId: stored.mapId || "",
      mapboxToken: stored.mapboxToken || "",
      enabled: row.isEnabled,
      showOnPropertyPage: stored.showOnPropertyPage !== false,
      enableGeocodingInAdmin: stored.enableGeocodingInAdmin !== false,
      enablePinPickerInAdmin: stored.enablePinPickerInAdmin !== false,
      defaultCity: stored.defaultCity || DEFAULT_CONFIG.defaultCity,
      defaultCenterLat: parseFloat(stored.defaultCenterLat) || DEFAULT_CONFIG.defaultCenterLat,
      defaultCenterLng: parseFloat(stored.defaultCenterLng) || DEFAULT_CONFIG.defaultCenterLng,
      defaultZoom: parseInt(stored.defaultZoom) || DEFAULT_CONFIG.defaultZoom,
      mapTheme: stored.mapTheme || DEFAULT_CONFIG.mapTheme,
      geocodeDailyCap: parseInt(stored.geocodeDailyCap) || DEFAULT_CONFIG.geocodeDailyCap,
      geocodeRateLimitPerAdmin: parseInt(stored.geocodeRateLimitPerAdmin) || DEFAULT_CONFIG.geocodeRateLimitPerAdmin,
      geocodeCacheTTLDays: parseInt(stored.geocodeCacheTTLDays) || DEFAULT_CONFIG.geocodeCacheTTLDays,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/** Return config safe for client (no secrets) */
export async function getMapsConfigPublic(): Promise<Omit<MapsConfig, "apiKey" | "mapboxToken"> & { hasKey: boolean }> {
  const config = await getMapsConfig();
  return {
    provider: config.provider,
    enabled: config.enabled,
    showOnPropertyPage: config.showOnPropertyPage,
    enableGeocodingInAdmin: config.enableGeocodingInAdmin,
    enablePinPickerInAdmin: config.enablePinPickerInAdmin,
    defaultCity: config.defaultCity,
    defaultCenterLat: config.defaultCenterLat,
    defaultCenterLng: config.defaultCenterLng,
    defaultZoom: config.defaultZoom,
    mapTheme: config.mapTheme,
    geocodeDailyCap: config.geocodeDailyCap,
    geocodeRateLimitPerAdmin: config.geocodeRateLimitPerAdmin,
    geocodeCacheTTLDays: config.geocodeCacheTTLDays,
    hasKey: !!(config.apiKey || config.mapboxToken),
    mapId: config.mapId,
  };
}

// ─── Address Normalization & Hashing ────────────────────────────────

function normalizeAddress(parts: { city?: string; district?: string; address?: string; country?: string }): string {
  const normalized = [
    parts.address?.trim().toLowerCase() || "",
    parts.district?.trim().toLowerCase() || "",
    parts.city?.trim().toLowerCase() || "",
    (parts.country || "SA").trim().toUpperCase(),
  ].filter(Boolean).join("|");
  return normalized;
}

function hashAddress(normalized: string): string {
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

// ─── Geocode Cache ──────────────────────────────────────────────────

interface GeocodeResult {
  lat: number;
  lng: number;
  placeId?: string;
  formattedAddress?: string;
  fromCache: boolean;
  provider: string;
}

async function getCachedGeocode(addressHash: string, provider: string): Promise<GeocodeResult | null> {
  try {
    const [row] = await db.select().from(geocodeCache)
      .where(and(
        eq(geocodeCache.addressHash, addressHash),
        eq(geocodeCache.provider, provider),
      ));
    if (!row) return null;
    // Check expiry
    if (new Date(row.expiresAt) < new Date()) return null;
    // Increment hit count
    await db.update(geocodeCache)
      .set({ hitCount: sql`${geocodeCache.hitCount} + 1` })
      .where(eq(geocodeCache.id, row.id));
    return {
      lat: parseFloat(String(row.lat)),
      lng: parseFloat(String(row.lng)),
      placeId: row.placeId || undefined,
      formattedAddress: row.formattedAddress || undefined,
      fromCache: true,
      provider: row.provider,
    };
  } catch {
    return null;
  }
}

async function setCachedGeocode(
  addressHash: string,
  provider: string,
  result: { lat: number; lng: number; placeId?: string; formattedAddress?: string },
  ttlDays: number
): Promise<void> {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);
    // Upsert: try insert, on duplicate update
    const rawPool = pool;
    await rawPool.execute(
      `INSERT INTO geocode_cache (addressHash, provider, lat, lng, placeId, formattedAddress, expiresAt, hitCount, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())
       ON DUPLICATE KEY UPDATE lat = VALUES(lat), lng = VALUES(lng), placeId = VALUES(placeId),
         formattedAddress = VALUES(formattedAddress), expiresAt = VALUES(expiresAt), hitCount = 0`,
      [addressHash, provider, result.lat, result.lng, result.placeId || null, result.formattedAddress || null, expiresAt]
    );
  } catch (err: any) {
    console.error("[Maps] Cache write error:", err.message);
  }
}

// ─── Google Geocoding ───────────────────────────────────────────────

async function geocodeGoogle(address: string, apiKey: string): Promise<GeocodeResult | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&language=ar&region=sa`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await resp.json();
    if (data.status !== "OK" || !data.results?.length) return null;
    const result = data.results[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      placeId: result.place_id,
      formattedAddress: result.formatted_address,
      fromCache: false,
      provider: "google",
    };
  } catch (err: any) {
    console.error("[Maps] Google geocode error:", err.message);
    return null;
  }
}

// ─── Mapbox Geocoding ───────────────────────────────────────────────

async function geocodeMapbox(address: string, token: string): Promise<GeocodeResult | null> {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&country=sa&language=ar&limit=1`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await resp.json();
    if (!data.features?.length) return null;
    const feature = data.features[0];
    return {
      lat: feature.center[1],
      lng: feature.center[0],
      placeId: feature.id,
      formattedAddress: feature.place_name,
      fromCache: false,
      provider: "mapbox",
    };
  } catch (err: any) {
    console.error("[Maps] Mapbox geocode error:", err.message);
    return null;
  }
}

// ─── Nominatim (Free OSM) Geocoding ───────────────────────────────

async function geocodeNominatim(address: string): Promise<GeocodeResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=sa&limit=1&accept-language=ar`;
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "MonthlyKey/1.0 (admin geocoding)" },
    });
    const data = await resp.json();
    if (!Array.isArray(data) || !data.length) return null;
    const result = data[0];
    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      placeId: `osm-${result.osm_type}-${result.osm_id}`,
      formattedAddress: result.display_name,
      fromCache: false,
      provider: "nominatim",
    };
  } catch (err: any) {
    console.error("[Maps] Nominatim geocode error:", err.message);
    return null;
  }
}

// ─── Public Geocode API ─────────────────────────────────────────────

export async function geocodeAddress(
  addressParts: { city?: string; district?: string; address?: string },
  adminId: number
): Promise<{ success: boolean; result?: GeocodeResult; error?: string }> {
  const config = await getMapsConfig();

  if (!config.enabled || config.provider === "DISABLED") {
    return { success: false, error: "Maps integration is disabled" };
  }
  if (!config.enableGeocodingInAdmin) {
    return { success: false, error: "Geocoding is disabled in admin settings" };
  }

  // Rate limit check
  if (!checkRateLimit(adminId, config.geocodeRateLimitPerAdmin)) {
    return { success: false, error: `Rate limit exceeded (${config.geocodeRateLimitPerAdmin}/min)` };
  }

  const normalized = normalizeAddress(addressParts);
  const addrHash = hashAddress(normalized);
  const providerKey = config.provider.toLowerCase();

  // Check cache first (check both configured provider and nominatim fallback)
  const cached = await getCachedGeocode(addrHash, providerKey);
  if (cached) {
    return { success: true, result: cached };
  }
  // Also check nominatim cache if we'll fall back to it
  if ((config.provider === "GOOGLE" && !config.apiKey) || (config.provider === "MAPBOX" && !config.mapboxToken)) {
    const nominatimCached = await getCachedGeocode(addrHash, "nominatim");
    if (nominatimCached) {
      return { success: true, result: nominatimCached };
    }
  }

  // Daily cap check (only for actual API calls)
  if (!checkDailyCap(config.geocodeDailyCap)) {
    return { success: false, error: `Daily geocoding cap reached (${config.geocodeDailyCap}/day)` };
  }

  // Build full address string
  const fullAddress = [addressParts.address, addressParts.district, addressParts.city, "Saudi Arabia"]
    .filter(Boolean).join(", ");

  let result: GeocodeResult | null = null;

  if (config.provider === "GOOGLE" && config.apiKey) {
    result = await geocodeGoogle(fullAddress, config.apiKey);
  } else if (config.provider === "MAPBOX" && config.mapboxToken) {
    result = await geocodeMapbox(fullAddress, config.mapboxToken);
  } else {
    // Fallback to free Nominatim (OpenStreetMap) when no API key is configured
    console.log("[Maps] No API key — falling back to Nominatim (free OSM geocoding)");
    result = await geocodeNominatim(fullAddress);
    if (!result) {
      return { success: false, error: "Geocoding returned no results (using free Nominatim fallback)" };
    }
    // Cache and return early
    await setCachedGeocode(addrHash, "nominatim", result, config.geocodeCacheTTLDays);
    return { success: true, result };
  }

  if (!result) {
    return { success: false, error: "Geocoding returned no results for this address" };
  }

  // Cache the result
  await setCachedGeocode(addrHash, providerKey, result, config.geocodeCacheTTLDays);

  return { success: true, result };
}

// ─── Test Geocoding (safe test address) ─────────────────────────────

export async function testGeocoding(): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  const config = await getMapsConfig();
  if (!config.enabled || config.provider === "DISABLED") {
    return { success: false, message: "Maps integration is disabled" };
  }

  const testAddress = "King Fahd Road, Riyadh, Saudi Arabia";
  const start = Date.now();

  let result: GeocodeResult | null = null;
  if (config.provider === "GOOGLE" && config.apiKey) {
    result = await geocodeGoogle(testAddress, config.apiKey);
  } else if (config.provider === "MAPBOX" && config.mapboxToken) {
    result = await geocodeMapbox(testAddress, config.mapboxToken);
  } else {
    return { success: false, message: "No API key configured" };
  }

  const latencyMs = Date.now() - start;

  if (result) {
    return {
      success: true,
      message: `PASS — ${config.provider} geocoded to ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)} in ${latencyMs}ms`,
      latencyMs,
    };
  }
  return { success: false, message: `FAIL — ${config.provider} returned no results (${latencyMs}ms)` };
}

// ─── Privacy: Approximate Coordinates ───────────────────────────────

/**
 * For APPROXIMATE visibility, offset coordinates by ~200-500m random jitter
 * and round to 3 decimal places (~111m precision)
 */
export function approximateCoordinates(lat: number, lng: number): { lat: number; lng: number } {
  // Random offset: ±0.002 to ±0.005 degrees (~200-500m)
  const latOffset = (Math.random() * 0.003 + 0.002) * (Math.random() > 0.5 ? 1 : -1);
  const lngOffset = (Math.random() * 0.003 + 0.002) * (Math.random() > 0.5 ? 1 : -1);
  return {
    lat: Math.round((lat + latOffset) * 1000) / 1000,
    lng: Math.round((lng + lngOffset) * 1000) / 1000,
  };
}

// ─── Update Property Location ───────────────────────────────────────

export async function updatePropertyLocation(
  propertyId: number,
  data: {
    latitude: string;
    longitude: string;
    locationSource: "MANUAL" | "GEOCODE" | "PIN";
    locationVisibility?: "EXACT" | "APPROXIMATE" | "HIDDEN";
    placeId?: string;
    geocodeProvider?: string;
  },
  adminId: number
): Promise<{ success: boolean }> {
  const rawPool = pool;
  const sets: string[] = [
    "latitude = ?",
    "longitude = ?",
    "locationSource = ?",
  ];
  const params: any[] = [data.latitude, data.longitude, data.locationSource];

  if (data.locationVisibility) {
    sets.push("locationVisibility = ?");
    params.push(data.locationVisibility);
  }
  if (data.placeId !== undefined) {
    sets.push("placeId = ?");
    params.push(data.placeId || null);
  }
  if (data.geocodeProvider !== undefined) {
    sets.push("geocodeProvider = ?");
    params.push(data.geocodeProvider || null);
  }
  if (data.locationSource === "GEOCODE") {
    sets.push("geocodeLastCheckedAt = NOW()");
  }

  params.push(propertyId);
  await rawPool.execute(
    `UPDATE properties SET ${sets.join(", ")} WHERE id = ?`,
    params
  );

  // Audit log
  await db.insert(auditLog).values({
    userId: adminId,
    userName: "admin",
    action: data.locationSource === "PIN" ? "PIN_SET" : data.locationSource === "GEOCODE" ? "GEOCODE" : "UPDATE",
    entityType: "PROPERTY",
    entityId: propertyId,
    entityLabel: `Property #${propertyId}`,
    metadata: {
      lat: data.latitude,
      lng: data.longitude,
      source: data.locationSource,
      provider: data.geocodeProvider || null,
    } as any,
  });

  return { success: true };
}

// ─── Geocode Cache Stats ────────────────────────────────────────────

export async function getGeocodeStats(): Promise<{
  totalEntries: number;
  totalHits: number;
  todayApiCalls: number;
  dailyCap: number;
}> {
  try {
    const config = await getMapsConfig();
    const [countResult] = await pool.execute("SELECT COUNT(*) as cnt, SUM(hitCount) as hits FROM geocode_cache");
    const row = (countResult as any[])[0];
    return {
      totalEntries: row?.cnt || 0,
      totalHits: row?.hits || 0,
      todayApiCalls: dailyGeocodeCount,
      dailyCap: config.geocodeDailyCap,
    };
  } catch {
    return { totalEntries: 0, totalHits: 0, todayApiCalls: 0, dailyCap: 200 };
  }
}
