import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cache, cacheThrough, CACHE_TTL, CACHE_KEYS } from "./cache";
import { rateLimiter, RATE_LIMITS } from "./rate-limiter";

describe("Cache System", () => {
  beforeEach(() => {
    cache.invalidateAll();
  });

  it("should store and retrieve values", () => {
    cache.set("test:key", { data: "hello" }, 60_000);
    expect(cache.get("test:key")).toEqual({ data: "hello" });
  });

  it("should return null for missing keys", () => {
    expect(cache.get("nonexistent")).toBeNull();
  });

  it("should expire entries after TTL", async () => {
    cache.set("test:expire", "value", 50); // 50ms TTL
    expect(cache.get("test:expire")).toBe("value");
    await new Promise(r => setTimeout(r, 100));
    expect(cache.get("test:expire")).toBeNull();
  });

  it("should invalidate by prefix", () => {
    cache.set("settings:all", "data1", 60_000);
    cache.set("settings:maintenance", "data2", 60_000);
    cache.set("property:featured", "data3", 60_000);
    cache.invalidatePrefix("settings:");
    expect(cache.get("settings:all")).toBeNull();
    expect(cache.get("settings:maintenance")).toBeNull();
    expect(cache.get("property:featured")).toBe("data3");
  });

  it("should clear all entries", () => {
    cache.set("a", 1, 60_000);
    cache.set("b", 2, 60_000);
    cache.invalidateAll();
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBeNull();
  });

  it("should invalidate specific keys", () => {
    cache.set("del:test", "value", 60_000);
    cache.invalidate("del:test");
    expect(cache.get("del:test")).toBeNull();
  });

  it("should report correct size", () => {
    cache.set("a", 1, 60_000);
    cache.set("b", 2, 60_000);
    expect(cache.size).toBe(2);
  });
});

describe("cacheThrough", () => {
  beforeEach(() => {
    cache.invalidateAll();
  });

  it("should call factory on cache miss", async () => {
    let calls = 0;
    const result = await cacheThrough("test:through", 60_000, () => {
      calls++;
      return Promise.resolve({ value: 42 });
    });
    expect(result).toEqual({ value: 42 });
    expect(calls).toBe(1);
  });

  it("should return cached value on cache hit", async () => {
    let calls = 0;
    const factory = () => { calls++; return Promise.resolve({ value: calls }); };
    await cacheThrough("test:hit", 60_000, factory);
    const result = await cacheThrough("test:hit", 60_000, factory);
    expect(result).toEqual({ value: 1 });
    expect(calls).toBe(1); // Factory only called once
  });

  it("should re-fetch after TTL expires", async () => {
    let calls = 0;
    const factory = () => { calls++; return Promise.resolve(calls); };
    await cacheThrough("test:ttl", 50, factory);
    await new Promise(r => setTimeout(r, 100));
    const result = await cacheThrough("test:ttl", 50, factory);
    expect(result).toBe(2);
    expect(calls).toBe(2);
  });
});

describe("CACHE_KEYS", () => {
  it("should generate consistent keys for settings", () => {
    expect(CACHE_KEYS.settings()).toBe("settings:all");
    expect(CACHE_KEYS.settingsSingle("maintenance.enabled")).toBe("settings:maintenance.enabled");
  });

  it("should generate consistent keys for search", () => {
    const hash = JSON.stringify({ city: "Riyadh", limit: 12 });
    expect(CACHE_KEYS.searchResults(hash)).toContain("search:");
  });

  it("should generate consistent keys for cities", () => {
    expect(CACHE_KEYS.allCities(true)).toBe("cities:all:true");
    expect(CACHE_KEYS.allCities(false)).toBe("cities:all:false");
    expect(CACHE_KEYS.featuredCities()).toBe("cities:featured");
  });
});

describe("CACHE_TTL", () => {
  it("should have reasonable TTL values", () => {
    expect(CACHE_TTL.SETTINGS).toBeGreaterThanOrEqual(30_000);
    expect(CACHE_TTL.SEARCH_RESULTS).toBeGreaterThanOrEqual(10_000);
    expect(CACHE_TTL.HOMEPAGE_DATA).toBeGreaterThanOrEqual(30_000);
    expect(CACHE_TTL.CITY_LIST).toBeGreaterThanOrEqual(60_000);
  });
});

describe("Rate Limiter", () => {
  it("should allow requests within limit", () => {
    const result = rateLimiter.check("test:allow", 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("should block requests exceeding limit", () => {
    for (let i = 0; i < 5; i++) {
      rateLimiter.check("test:block", 5, 60_000);
    }
    const result = rateLimiter.check("test:block", 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetIn).toBeGreaterThan(0);
  });

  it("should reset after window expires", async () => {
    for (let i = 0; i < 3; i++) {
      rateLimiter.check("test:reset", 3, 100);
    }
    const blocked = rateLimiter.check("test:reset", 3, 100);
    expect(blocked.allowed).toBe(false);
    await new Promise(r => setTimeout(r, 150));
    const allowed = rateLimiter.check("test:reset", 3, 100);
    expect(allowed.allowed).toBe(true);
  });

  it("should track different keys independently", () => {
    for (let i = 0; i < 3; i++) {
      rateLimiter.check("test:ip1", 3, 60_000);
    }
    const ip1 = rateLimiter.check("test:ip1", 3, 60_000);
    const ip2 = rateLimiter.check("test:ip2", 3, 60_000);
    expect(ip1.allowed).toBe(false);
    expect(ip2.allowed).toBe(true);
  });
});

describe("RATE_LIMITS presets", () => {
  it("should have appropriate limits for different tiers", () => {
    expect(RATE_LIMITS.PUBLIC_READ.maxRequests).toBeGreaterThan(RATE_LIMITS.WRITE.maxRequests);
    expect(RATE_LIMITS.AUTH_READ.maxRequests).toBeGreaterThan(RATE_LIMITS.PUBLIC_READ.maxRequests);
    expect(RATE_LIMITS.AUTH.maxRequests).toBeLessThanOrEqual(15);
    expect(RATE_LIMITS.UPLOAD.maxRequests).toBeLessThanOrEqual(30);
  });
});

describe("Performance characteristics", () => {
  beforeEach(() => {
    cache.invalidateAll();
  });

  it("cache should handle 10,000 entries efficiently", () => {
    const start = performance.now();
    for (let i = 0; i < 10_000; i++) {
      cache.set(`perf:${i}`, { id: i, data: `value-${i}` }, 60_000);
    }
    const writeTime = performance.now() - start;
    
    const readStart = performance.now();
    for (let i = 0; i < 10_000; i++) {
      cache.get(`perf:${i}`);
    }
    const readTime = performance.now() - readStart;

    // Write 10k entries should take < 100ms
    expect(writeTime).toBeLessThan(100);
    // Read 10k entries should take < 50ms
    expect(readTime).toBeLessThan(50);
    expect(cache.size).toBe(10_000);
  });

  it("rate limiter should handle rapid checks efficiently", () => {
    const start = performance.now();
    for (let i = 0; i < 10_000; i++) {
      rateLimiter.check(`perf:ip${i % 100}`, 1000, 60_000);
    }
    const elapsed = performance.now() - start;
    // 10k rate limit checks should take < 100ms
    expect(elapsed).toBeLessThan(100);
  });

  it("prefix invalidation should be efficient with many keys", () => {
    for (let i = 0; i < 5_000; i++) {
      cache.set(`search:${i}`, i, 60_000);
    }
    for (let i = 0; i < 5_000; i++) {
      cache.set(`other:${i}`, i, 60_000);
    }
    const start = performance.now();
    cache.invalidatePrefix("search:");
    const elapsed = performance.now() - start;
    // Invalidating 5k keys should take < 50ms
    expect(elapsed).toBeLessThan(50);
    expect(cache.size).toBe(5_000); // Only "other:" keys remain
  });
});
