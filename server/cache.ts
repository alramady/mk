/**
 * Server-side in-memory cache with TTL
 * Reduces DB hits for frequently accessed data (settings, counts, homepage data)
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Cleanup expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    const keys = Array.from(this.store.keys());
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  invalidateAll(): void {
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.store.entries());
    for (const [key, entry] of entries) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  get size(): number {
    return this.store.size;
  }

  destroy(): void {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Singleton instance
export const cache = new MemoryCache();

// Cache TTL constants (milliseconds)
export const CACHE_TTL = {
  SETTINGS: 60_000,         // 1 minute — site settings rarely change
  PROPERTY_COUNTS: 30_000,  // 30 seconds — counts can be slightly stale
  HOMEPAGE_DATA: 60_000,    // 1 minute — featured properties, cities
  CITY_LIST: 300_000,       // 5 minutes — cities/districts rarely change
  PROPERTY_DETAIL: 15_000,  // 15 seconds — individual property pages
  SEARCH_RESULTS: 10_000,   // 10 seconds — search results
  ANALYTICS: 120_000,       // 2 minutes — admin analytics
  USER_COUNT: 60_000,       // 1 minute
} as const;

// Cache key generators
export const CACHE_KEYS = {
  settings: () => 'settings:all',
  settingsSingle: (key: string) => `settings:${key}`,
  propertyCount: (status?: string) => `property:count:${status || 'all'}`,
  userCount: () => 'user:count',
  bookingCount: (status?: string) => `booking:count:${status || 'all'}`,
  featuredCities: () => 'cities:featured',
  allCities: (activeOnly: boolean) => `cities:all:${activeOnly}`,
  districts: (city: string) => `districts:${city}`,
  propertyDetail: (id: number) => `property:${id}`,
  searchResults: (hash: string) => `search:${hash}`,
  homepageStats: () => 'homepage:stats',
  analytics: (key: string) => `analytics:${key}`,
} as const;

/**
 * Cache-through helper: get from cache or fetch from DB
 */
export async function cacheThrough<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== null) return cached;
  const data = await fetcher();
  cache.set(key, data, ttlMs);
  return data;
}
