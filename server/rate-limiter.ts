/**
 * In-memory rate limiter for API endpoints
 * Protects against abuse and ensures fair usage under high traffic
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Cleanup expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const entries = Array.from(this.store.entries());
      for (const [key, entry] of entries) {
        if (now > entry.resetAt) {
          this.store.delete(key);
        }
      }
    }, 60_000);
  }

  /**
   * Check if request is allowed
   * @returns { allowed: boolean, remaining: number, resetIn: number }
   */
  check(key: string, maxRequests: number, windowMs: number): {
    allowed: boolean;
    remaining: number;
    resetIn: number;
  } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
    }

    entry.count++;
    if (entry.count > maxRequests) {
      return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
    }

    return { allowed: true, remaining: maxRequests - entry.count, resetIn: entry.resetAt - now };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

export const rateLimiter = new RateLimiter();

// Rate limit presets
export const RATE_LIMITS = {
  // Public endpoints (search, browse)
  PUBLIC_READ: { maxRequests: 120, windowMs: 60_000 },     // 120 req/min
  // Authenticated reads
  AUTH_READ: { maxRequests: 200, windowMs: 60_000 },       // 200 req/min
  // Write operations (create, update)
  WRITE: { maxRequests: 30, windowMs: 60_000 },            // 30 req/min
  // Auth operations (login, register)
  AUTH: { maxRequests: 10, windowMs: 300_000 },             // 10 per 5 min
  // File uploads
  UPLOAD: { maxRequests: 20, windowMs: 300_000 },           // 20 per 5 min
  // AI operations
  AI: { maxRequests: 15, windowMs: 60_000 },                // 15 req/min
  // Admin operations
  ADMIN: { maxRequests: 100, windowMs: 60_000 },            // 100 req/min
} as const;

/**
 * Get client IP from request
 */
export function getClientIP(req: { headers: Record<string, string | string[] | undefined>; ip?: string; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0];
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
