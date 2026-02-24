/**
 * ═══════════════════════════════════════════════════════════════
 *  Beds24 Admin Proxy — SDK Layer (Hardened)
 * ═══════════════════════════════════════════════════════════════
 *
 *  This is the SDK-level proxy executor. It:
 *    - Validates that the path starts with /api/v2/
 *    - Blocks authentication/account endpoints unconditionally
 *    - Performs deep PII redaction on request/response for audit
 *    - Executes the request via the authenticated Beds24Client
 *
 *  NOTE: Allowlist enforcement, rate limiting, and feature-flag
 *  checks happen in the hub-api admin route BEFORE this is called.
 *  This layer is the last line of defense.
 * ═══════════════════════════════════════════════════════════════
 */

import { Beds24Client } from "../auth/client.js";
import type { Beds24ProxyRequest, Beds24ProxyResponse } from "@mk/shared";
import { PII_FIELDS } from "@mk/shared";

// ─── Unconditionally Blocked Paths ─────────────────────────
// These are blocked at the SDK level regardless of allowlist.
// Even if someone bypasses the hub-api allowlist, these are safe.
const HARD_BLOCKED_PATHS = [
  "/api/v2/authentication",
  "/api/v2/account",
  "/api/v2/users",
];

export interface ProxyAuditEntry {
  method: string;
  path: string;
  query?: Record<string, string>;
  bodyRedacted: unknown;
  responseRedacted: unknown;
  responseStatus: number;
  timestamp: string;
  durationMs: number;
}

// ═══════════════════════════════════════════════════════════
//  Deep PII Redaction
// ═══════════════════════════════════════════════════════════

/**
 * Recursively redact PII fields from any object.
 * Uses the shared PII_FIELDS list for consistency.
 * Handles nested objects, arrays, and mixed structures.
 */
function redactPII(obj: unknown, depth = 0): unknown {
  // Prevent infinite recursion on deeply nested objects
  if (depth > 10) return "[DEPTH_LIMIT]";

  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj;
  if (typeof obj === "number" || typeof obj === "boolean") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactPII(item, depth + 1));
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const keyLower = key.toLowerCase();

      // Check if this key matches any PII field pattern
      const isPII = PII_FIELDS.some((piiField) => keyLower.includes(piiField));

      if (isPII) {
        result[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        result[key] = redactPII(value, depth + 1);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return obj;
}

// ═══════════════════════════════════════════════════════════
//  Beds24 Admin Proxy Class
// ═══════════════════════════════════════════════════════════

export class Beds24AdminProxy {
  constructor(private client: Beds24Client) {}

  /**
   * Execute a proxy request to Beds24.
   *
   * Pre-conditions (enforced by hub-api admin route):
   *   - ENABLE_BEDS24_PROXY=true
   *   - User has ADMIN role
   *   - Rate limit not exceeded
   *   - Path is in the allowlist
   *
   * This layer adds:
   *   - Hard-blocked path check (defense in depth)
   *   - Deep PII redaction for audit
   *   - Timing information
   */
  async execute(
    req: Beds24ProxyRequest
  ): Promise<{ response: Beds24ProxyResponse; audit: ProxyAuditEntry }> {
    const startTime = Date.now();

    // ── Validate path prefix ───────────────────────────────
    if (!req.path.startsWith("/api/v2/")) {
      throw new ProxyError("Path must start with /api/v2/", 400);
    }

    // ── Hard-blocked paths (defense in depth) ──────────────
    const normalizedPath = req.path.replace(/\/+/g, "/").replace(/\/$/, "");
    for (const blocked of HARD_BLOCKED_PATHS) {
      if (normalizedPath.startsWith(blocked)) {
        throw new ProxyError(
          `Path "${blocked}" is unconditionally blocked at SDK level`,
          403
        );
      }
    }

    // ── Execute the request ────────────────────────────────
    const result = await this.client.request(req.method, req.path, {
      query: req.query,
      body: req.body,
    });

    const durationMs = Date.now() - startTime;

    // ── Build audit entry with PII redaction ───────────────
    const audit: ProxyAuditEntry = {
      method: req.method,
      path: req.path,
      query: req.query,
      bodyRedacted: redactPII(req.body),
      responseRedacted: redactPII(result.data),
      responseStatus: result.status,
      timestamp: new Date().toISOString(),
      durationMs,
    };

    return {
      response: { status: result.status, data: result.data },
      audit,
    };
  }
}

export class ProxyError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = "ProxyError";
  }
}
