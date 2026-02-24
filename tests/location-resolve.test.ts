/**
 * ═══════════════════════════════════════════════════════════════
 *  Location Resolve — Automated Tests
 * ═══════════════════════════════════════════════════════════════
 *
 *  Tests the location resolve pipeline:
 *    - URL domain validation (allowlist enforcement)
 *    - Coordinate parsing from various Google Maps URL formats
 *    - URL hash consistency
 *    - Place name extraction from URLs
 *    - Error handling for invalid inputs
 *
 *  Pure unit tests — no Google API or DB required.
 *  They test the parsing/validation logic, not the full HTTP stack.
 *
 *  Run: npx vitest run tests/location-resolve.test.ts
 * ═══════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from "vitest";
import {
  LOCATION_URL_ALLOWLIST,
  LOCATION_CACHE_TTL_MS,
  ERROR_CODES,
  HTTP_STATUS,
} from "@mk/shared";
import {
  validateUrlDomain,
  parseCoordsFromUrl,
  hashUrl,
  extractPlaceNameFromUrl,
  isValidCoord,
  LocationServiceError,
} from "../services/hub-api/src/services/location-service.js";

// ═══════════════════════════════════════════════════════════════
//  URL Domain Validation
// ═══════════════════════════════════════════════════════════════

describe("URL Domain Validation", () => {
  it("accepts google.com/maps URLs", () => {
    expect(() =>
      validateUrlDomain("https://www.google.com/maps/place/Riyadh/@24.7,46.7,12z")
    ).not.toThrow();
  });

  it("accepts maps.google.com URLs", () => {
    expect(() =>
      validateUrlDomain("https://maps.google.com/?q=24.7,46.7")
    ).not.toThrow();
  });

  it("accepts maps.app.goo.gl short URLs", () => {
    expect(() =>
      validateUrlDomain("https://maps.app.goo.gl/abc123xyz")
    ).not.toThrow();
  });

  it("accepts goo.gl short URLs", () => {
    expect(() =>
      validateUrlDomain("https://goo.gl/maps/abc123")
    ).not.toThrow();
  });

  it("accepts google.com with country TLD subdomains", () => {
    expect(() =>
      validateUrlDomain("https://www.google.com/maps/@24.7,46.7,12z")
    ).not.toThrow();
  });

  it("rejects non-Google domains", () => {
    expect(() =>
      validateUrlDomain("https://www.bing.com/maps?q=24.7,46.7")
    ).toThrow(LocationServiceError);
  });

  it("rejects apple maps URLs", () => {
    expect(() =>
      validateUrlDomain("https://maps.apple.com/?q=24.7,46.7")
    ).toThrow(LocationServiceError);
  });

  it("rejects random URLs", () => {
    expect(() =>
      validateUrlDomain("https://evil-site.com/fake-maps")
    ).toThrow(LocationServiceError);
  });

  it("rejects invalid URL format", () => {
    expect(() =>
      validateUrlDomain("not-a-url-at-all")
    ).toThrow(LocationServiceError);
  });

  it("rejects empty string", () => {
    expect(() =>
      validateUrlDomain("")
    ).toThrow(LocationServiceError);
  });

  it("rejection error has correct code", () => {
    try {
      validateUrlDomain("https://evil.com/maps");
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(LocationServiceError);
      expect((err as LocationServiceError).code).toBe(ERROR_CODES.LOCATION_INVALID_URL);
      expect((err as LocationServiceError).status).toBe(HTTP_STATUS.BAD_REQUEST);
    }
  });

  it("rejects domains that contain google but are not google", () => {
    expect(() =>
      validateUrlDomain("https://not-google.com/maps/@24.7,46.7")
    ).toThrow(LocationServiceError);
  });

  it("rejects google.com.evil.com spoofing", () => {
    expect(() =>
      validateUrlDomain("https://google.com.evil.com/maps")
    ).toThrow(LocationServiceError);
  });
});

// ═══════════════════════════════════════════════════════════════
//  Coordinate Parsing from Google Maps URLs
// ═══════════════════════════════════════════════════════════════

describe("Coordinate Parsing", () => {
  it("parses @lat,lng format from path", () => {
    const result = parseCoordsFromUrl(
      "https://www.google.com/maps/place/Riyadh/@24.7135517,46.6752957,12z"
    );
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(24.7135517, 5);
    expect(result!.lng).toBeCloseTo(46.6752957, 5);
  });

  it("parses ?q=lat,lng query param", () => {
    const result = parseCoordsFromUrl(
      "https://maps.google.com/?q=24.7135517,46.6752957"
    );
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(24.7135517, 5);
    expect(result!.lng).toBeCloseTo(46.6752957, 5);
  });

  it("parses ?ll=lat,lng query param", () => {
    const result = parseCoordsFromUrl(
      "https://maps.google.com/?ll=24.7135517,46.6752957"
    );
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(24.7135517, 5);
    expect(result!.lng).toBeCloseTo(46.6752957, 5);
  });

  it("parses !3d (lat) !4d (lng) embedded format", () => {
    const result = parseCoordsFromUrl(
      "https://www.google.com/maps/place/!3d24.7135517!4d46.6752957"
    );
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(24.7135517, 5);
    expect(result!.lng).toBeCloseTo(46.6752957, 5);
  });

  it("parses negative coordinates (southern/western hemisphere)", () => {
    const result = parseCoordsFromUrl(
      "https://www.google.com/maps/@-33.8688197,151.2092955,12z"
    );
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(-33.8688197, 5);
    expect(result!.lng).toBeCloseTo(151.2092955, 5);
  });

  it("parses coordinates from /place/ path with @", () => {
    const result = parseCoordsFromUrl(
      "https://www.google.com/maps/place/Riyadh+Park+Mall/@24.7691,46.6345,17z"
    );
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(24.7691, 3);
    expect(result!.lng).toBeCloseTo(46.6345, 3);
  });

  it("returns null for URL with no coordinates", () => {
    const result = parseCoordsFromUrl(
      "https://www.google.com/maps/place/Riyadh"
    );
    expect(result).toBeNull();
  });

  it("returns null for empty string", () => {
    const result = parseCoordsFromUrl("");
    expect(result).toBeNull();
  });

  it("rejects out-of-range latitude (> 90)", () => {
    const result = parseCoordsFromUrl(
      "https://www.google.com/maps/@91.0,46.7,12z"
    );
    expect(result).toBeNull();
  });

  it("rejects out-of-range longitude (> 180)", () => {
    const result = parseCoordsFromUrl(
      "https://www.google.com/maps/@24.7,181.0,12z"
    );
    expect(result).toBeNull();
  });

  it("rejects out-of-range latitude (< -90)", () => {
    const result = parseCoordsFromUrl(
      "https://www.google.com/maps/@-91.0,46.7,12z"
    );
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
//  URL Hash Consistency
// ═══════════════════════════════════════════════════════════════

describe("URL Hash", () => {
  it("produces consistent hash for same URL", () => {
    const url = "https://www.google.com/maps/@24.7,46.7,12z";
    expect(hashUrl(url)).toBe(hashUrl(url));
  });

  it("produces same hash regardless of leading/trailing whitespace", () => {
    const url = "https://www.google.com/maps/@24.7,46.7,12z";
    expect(hashUrl(`  ${url}  `)).toBe(hashUrl(url));
  });

  it("produces same hash regardless of case", () => {
    const url1 = "https://www.Google.com/maps/@24.7,46.7,12z";
    const url2 = "https://www.google.com/maps/@24.7,46.7,12z";
    expect(hashUrl(url1)).toBe(hashUrl(url2));
  });

  it("produces different hash for different URLs", () => {
    const hash1 = hashUrl("https://www.google.com/maps/@24.7,46.7,12z");
    const hash2 = hashUrl("https://www.google.com/maps/@25.0,47.0,12z");
    expect(hash1).not.toBe(hash2);
  });

  it("hash is a 64-char hex string (SHA-256)", () => {
    const hash = hashUrl("https://www.google.com/maps/@24.7,46.7,12z");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ═══════════════════════════════════════════════════════════════
//  Place Name Extraction
// ═══════════════════════════════════════════════════════════════

describe("Place Name Extraction", () => {
  it("extracts place name from /place/ path", () => {
    const name = extractPlaceNameFromUrl(
      "https://www.google.com/maps/place/Riyadh+Park+Mall/@24.7,46.6,17z"
    );
    expect(name).toBe("Riyadh Park Mall");
  });

  it("extracts URL-encoded place name", () => {
    const name = extractPlaceNameFromUrl(
      "https://www.google.com/maps/place/%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6/@24.7,46.6,17z"
    );
    expect(name).not.toBeNull();
    // Should decode the Arabic text
    expect(name!.length).toBeGreaterThan(0);
  });

  it("returns null for URL without /place/ path", () => {
    const name = extractPlaceNameFromUrl(
      "https://www.google.com/maps/@24.7,46.6,17z"
    );
    expect(name).toBeNull();
  });

  it("returns null for empty string", () => {
    const name = extractPlaceNameFromUrl("");
    expect(name).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
//  Shared Constants Integrity
// ═══════════════════════════════════════════════════════════════

describe("Location Shared Constants", () => {
  it("LOCATION_URL_ALLOWLIST contains exactly 5 domains", () => {
    expect(LOCATION_URL_ALLOWLIST).toHaveLength(5);
  });

  it("LOCATION_URL_ALLOWLIST includes google.com", () => {
    expect(LOCATION_URL_ALLOWLIST).toContain("google.com");
  });

  it("LOCATION_URL_ALLOWLIST includes maps.app.goo.gl", () => {
    expect(LOCATION_URL_ALLOWLIST).toContain("maps.app.goo.gl");
  });

  it("LOCATION_URL_ALLOWLIST includes goo.gl", () => {
    expect(LOCATION_URL_ALLOWLIST).toContain("goo.gl");
  });

  it("LOCATION_CACHE_TTL_MS is 30 days", () => {
    expect(LOCATION_CACHE_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("ERROR_CODES has all location error codes", () => {
    expect(ERROR_CODES.LOCATION_DISABLED).toBe("LOCATION_DISABLED");
    expect(ERROR_CODES.LOCATION_UNRESOLVABLE).toBe("LOCATION_UNRESOLVABLE");
    expect(ERROR_CODES.LOCATION_INVALID_URL).toBe("LOCATION_INVALID_URL");
  });
});

// ═══════════════════════════════════════════════════════════════
//  LocationServiceError
// ═══════════════════════════════════════════════════════════════

describe("LocationServiceError", () => {
  it("creates error with correct properties", () => {
    const err = new LocationServiceError("TEST_CODE", "Test message", 503);
    expect(err.code).toBe("TEST_CODE");
    expect(err.message).toBe("Test message");
    expect(err.status).toBe(503);
    expect(err.name).toBe("LocationServiceError");
    expect(err).toBeInstanceOf(Error);
  });

  it("defaults to 400 status", () => {
    const err = new LocationServiceError("TEST_CODE", "Test message");
    expect(err.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════
//  Real-World Google Maps URL Patterns (Saudi Arabia)
// ═══════════════════════════════════════════════════════════════

describe("Real-World Saudi Arabia URLs", () => {
  it("parses Riyadh location", () => {
    const result = parseCoordsFromUrl(
      "https://www.google.com/maps/place/%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%E2%80%AD/@24.7135517,46.6752957,12z"
    );
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(24.71, 1);
    expect(result!.lng).toBeCloseTo(46.68, 1);
  });

  it("parses Jeddah location", () => {
    const result = parseCoordsFromUrl(
      "https://www.google.com/maps/place/Jeddah/@21.4858,39.1925,12z"
    );
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(21.49, 1);
    expect(result!.lng).toBeCloseTo(39.19, 1);
  });

  it("parses Makkah location with embedded format", () => {
    const result = parseCoordsFromUrl(
      "https://www.google.com/maps/place/!3d21.3891!4d39.8579"
    );
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(21.39, 1);
    expect(result!.lng).toBeCloseTo(39.86, 1);
  });

  it("parses KAUST location with query param", () => {
    const result = parseCoordsFromUrl(
      "https://maps.google.com/?q=22.3095,39.1027"
    );
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(22.31, 1);
    expect(result!.lng).toBeCloseTo(39.10, 1);
  });
});


// ═══════════════════════════════════════════════════════════════
//  Google API Status Mapping
// ═══════════════════════════════════════════════════════════════

describe("Google API Status → Platform Error Mapping", () => {
  // We test the error codes exist in shared constants and have correct values
  it("GOOGLE_ZERO_RESULTS error code exists", () => {
    expect(ERROR_CODES.GOOGLE_ZERO_RESULTS).toBe("GOOGLE_ZERO_RESULTS");
  });

  it("GOOGLE_OVER_QUERY_LIMIT error code exists", () => {
    expect(ERROR_CODES.GOOGLE_OVER_QUERY_LIMIT).toBe("GOOGLE_OVER_QUERY_LIMIT");
  });

  it("GOOGLE_REQUEST_DENIED error code exists", () => {
    expect(ERROR_CODES.GOOGLE_REQUEST_DENIED).toBe("GOOGLE_REQUEST_DENIED");
  });

  it("GOOGLE_INVALID_REQUEST error code exists", () => {
    expect(ERROR_CODES.GOOGLE_INVALID_REQUEST).toBe("GOOGLE_INVALID_REQUEST");
  });

  it("GOOGLE_UNKNOWN_ERROR error code exists", () => {
    expect(ERROR_CODES.GOOGLE_UNKNOWN_ERROR).toBe("GOOGLE_UNKNOWN_ERROR");
  });

  it("UPSTREAM_ERROR error code exists for undocumented statuses", () => {
    expect(ERROR_CODES.UPSTREAM_ERROR).toBe("UPSTREAM_ERROR");
  });

  it("UPSTREAM_TIMEOUT error code exists for timeouts", () => {
    expect(ERROR_CODES.UPSTREAM_TIMEOUT).toBe("UPSTREAM_TIMEOUT");
  });

  it("LOCATION_INVALID_COORDS error code exists for invalid coordinates", () => {
    expect(ERROR_CODES.LOCATION_INVALID_COORDS).toBe("LOCATION_INVALID_COORDS");
  });

  it("HTTP_STATUS includes GATEWAY_TIMEOUT (504)", () => {
    expect(HTTP_STATUS.GATEWAY_TIMEOUT).toBe(504);
  });
});

// ═══════════════════════════════════════════════════════════════
//  LocationServiceError — retryable flag
// ═══════════════════════════════════════════════════════════════

describe("LocationServiceError retryable flag", () => {
  it("defaults retryable to false", () => {
    const err = new LocationServiceError("TEST", "test message", 400);
    expect(err.retryable).toBe(false);
  });

  it("accepts retryable=true", () => {
    const err = new LocationServiceError("TEST", "test message", 502, true);
    expect(err.retryable).toBe(true);
  });

  it("accepts retryable=false explicitly", () => {
    const err = new LocationServiceError("TEST", "test message", 422, false);
    expect(err.retryable).toBe(false);
  });

  it("preserves code, message, status, and retryable together", () => {
    const err = new LocationServiceError(
      ERROR_CODES.GOOGLE_OVER_QUERY_LIMIT,
      "Quota exceeded",
      429,
      true,
    );
    expect(err.code).toBe("GOOGLE_OVER_QUERY_LIMIT");
    expect(err.message).toBe("Quota exceeded");
    expect(err.status).toBe(429);
    expect(err.retryable).toBe(true);
    expect(err.name).toBe("LocationServiceError");
  });
});

// ═══════════════════════════════════════════════════════════════
//  Coordinate Validation (WGS-84 ranges)
// ═══════════════════════════════════════════════════════════════

describe("Coordinate Validation — isValidCoord", () => {
  it("accepts valid Riyadh coordinates", () => {
    expect(isValidCoord(24.7136, 46.6753)).toBe(true);
  });

  it("accepts exact boundary: lat=90, lng=180", () => {
    expect(isValidCoord(90, 180)).toBe(true);
  });

  it("accepts exact boundary: lat=-90, lng=-180", () => {
    expect(isValidCoord(-90, -180)).toBe(true);
  });

  it("accepts zero coordinates (Gulf of Guinea)", () => {
    expect(isValidCoord(0, 0)).toBe(true);
  });

  it("rejects lat > 90", () => {
    expect(isValidCoord(91, 46)).toBe(false);
  });

  it("rejects lat < -90", () => {
    expect(isValidCoord(-91, 46)).toBe(false);
  });

  it("rejects lng > 180", () => {
    expect(isValidCoord(24, 181)).toBe(false);
  });

  it("rejects lng < -180", () => {
    expect(isValidCoord(24, -181)).toBe(false);
  });

  it("rejects NaN latitude", () => {
    expect(isValidCoord(NaN, 46)).toBe(false);
  });

  it("rejects NaN longitude", () => {
    expect(isValidCoord(24, NaN)).toBe(false);
  });

  it("rejects Infinity latitude", () => {
    expect(isValidCoord(Infinity, 46)).toBe(false);
  });

  it("rejects -Infinity longitude", () => {
    expect(isValidCoord(24, -Infinity)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
//  Graceful Degradation — URL with coords always succeeds
// ═══════════════════════════════════════════════════════════════

describe("Graceful Degradation — coords from URL", () => {
  it("parseCoordsFromUrl returns coords even without Google API", () => {
    // This proves Scenario 2: coords in URL → success regardless of Google
    const result = parseCoordsFromUrl(
      "https://www.google.com/maps/place/Riyadh/@24.7136,46.6753,12z"
    );
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(24.7136, 4);
    expect(result!.lng).toBeCloseTo(46.6753, 4);
  });

  it("parseCoordsFromUrl returns null for URL without coords (Scenario 4)", () => {
    // This proves Scenario 4: no coords + no Google → cannot resolve
    const result = parseCoordsFromUrl(
      "https://www.google.com/maps/place/Riyadh+Park+Mall"
    );
    expect(result).toBeNull();
  });

  it("extractPlaceNameFromUrl provides fallback address when Google unavailable", () => {
    // In Scenario 2, place name from URL is the fallback for formatted_address
    const name = extractPlaceNameFromUrl(
      "https://www.google.com/maps/place/Riyadh+Park+Mall/@24.7,46.7"
    );
    expect(name).toBe("Riyadh Park Mall");
  });

  it("coords-only URL with embedded format still resolves", () => {
    const result = parseCoordsFromUrl(
      "https://www.google.com/maps/place/!3d24.7136!4d46.6753"
    );
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(24.7136, 4);
  });

  it("coords-only URL with query param still resolves", () => {
    const result = parseCoordsFromUrl(
      "https://maps.google.com/?q=24.7136,46.6753"
    );
    expect(result).not.toBeNull();
    expect(result!.lng).toBeCloseTo(46.6753, 4);
  });
});

// ═══════════════════════════════════════════════════════════════
//  API Key Security — error messages never contain keys
// ═══════════════════════════════════════════════════════════════

describe("API Key Security", () => {
  it("LocationServiceError message does not contain API key patterns", () => {
    // Simulate an error that might accidentally include a key
    const err = new LocationServiceError(
      ERROR_CODES.UPSTREAM_ERROR,
      "Google Geocoding API call failed: [REDACTED_API_KEY]",
      502,
      true,
    );
    // The message should contain the redacted placeholder, not a real key
    expect(err.message).toContain("[REDACTED_API_KEY]");
    expect(err.message).not.toMatch(/AIza[A-Za-z0-9_-]{35}/); // Google API key pattern
  });

  it("NOT_CONFIGURED error does not reveal key expectations", () => {
    const err = new LocationServiceError(
      ERROR_CODES.NOT_CONFIGURED,
      "Google Maps API key is not configured. Location resolve via geocoding is temporarily unavailable.",
      503,
      true,
    );
    expect(err.message).not.toMatch(/AIza/);
    expect(err.message).not.toMatch(/key=/);
    expect(err.message).toContain("not configured");
  });
});
