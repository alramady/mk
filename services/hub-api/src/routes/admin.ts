/**
 * ═══════════════════════════════════════════════════════════════
 *  Admin Routes — Hub-API
 * ═══════════════════════════════════════════════════════════════
 *
 *  Feature Flags: CRUD for runtime feature toggles
 *
 *  Beds24 Admin Proxy (HARDENED):
 *    - Disabled by default (ENABLE_BEDS24_PROXY=false)
 *    - ADMIN role required
 *    - Endpoint allowlist: only pre-approved Beds24 paths
 *    - Rate limit: configurable per-minute cap
 *    - Audit log: every request logged with PII redaction
 *    - PII fields (email, phone, name, etc.) replaced with [REDACTED]
 *
 *  System Health: feature summary, writer-lock status
 * ═══════════════════════════════════════════════════════════════
 */

import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { featureFlags, auditLog, proxyAuditLog } from "../db/schema.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { featureFlagUpdateSchema, beds24ProxySchema } from "@mk/shared";
import { invalidateFeatureFlagCache } from "../lib/feature-flags.js";
import { createBeds24SDK } from "@mk/beds24-sdk";
import { isFeatureEnabled, config, getFeatureSummary } from "../config.js";
import { logger } from "../lib/logger.js";
import {
  BEDS24_PROXY_ALLOWLIST,
  PII_FIELDS,
  ERROR_CODES,
  HTTP_STATUS,
} from "@mk/shared";

const router = Router();

// ═══════════════════════════════════════════════════════════
//  Rate Limiter (in-memory, per-process)
// ═══════════════════════════════════════════════════════════

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const maxPerMinute = config.adminProxy.maxRequestsPerMinute;
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + 60_000;
    rateLimitMap.set(userId, { count: 1, resetAt });
    return { allowed: true, remaining: maxPerMinute - 1, resetAt };
  }

  if (entry.count >= maxPerMinute) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxPerMinute - entry.count, resetAt: entry.resetAt };
}

// ═══════════════════════════════════════════════════════════
//  PII Redaction — Deep recursive
// ═══════════════════════════════════════════════════════════

function redactPII(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj;
  if (Array.isArray(obj)) return obj.map(redactPII);
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const keyLower = key.toLowerCase();
      if (PII_FIELDS.some((pii) => keyLower.includes(pii))) {
        result[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        result[key] = redactPII(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  return obj;
}

// ═══════════════════════════════════════════════════════════
//  Allowlist Check
// ═══════════════════════════════════════════════════════════

function isPathAllowed(method: string, path: string): { allowed: boolean; reason: string } {
  const normalizedPath = path.replace(/\/+/g, "/").replace(/\/$/, "");
  const normalizedMethod = method.toUpperCase();

  for (const entry of BEDS24_PROXY_ALLOWLIST) {
    const entryPath = entry.path.replace(/\/+/g, "/").replace(/\/$/, "");

    // Check if path matches (supports wildcard suffix *)
    let pathMatch = false;
    if (entryPath.endsWith("*")) {
      pathMatch = normalizedPath.startsWith(entryPath.slice(0, -1));
    } else {
      pathMatch = normalizedPath === entryPath;
    }

    if (pathMatch && entry.methods.includes(normalizedMethod)) {
      return { allowed: true, reason: `Matched allowlist: ${entry.description}` };
    }
  }

  return {
    allowed: false,
    reason: `Path "${normalizedMethod} ${normalizedPath}" is not in the Beds24 proxy allowlist`,
  };
}

// ═══════════════════════════════════════════════════════════
//  Feature Flags
// ═══════════════════════════════════════════════════════════

/** GET /admin/feature-flags — List all flags. */
router.get("/feature-flags", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  try {
    const flags = await db.query.featureFlags.findMany();
    res.json(flags);
  } catch (err) {
    logger.error({ err }, "Failed to list feature flags");
    res.status(HTTP_STATUS.INTERNAL).json({ code: ERROR_CODES.INTERNAL, message: "Failed to list flags" });
  }
});

/** PUT /admin/feature-flags — Update a flag. */
router.put("/feature-flags", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const parsed = featureFlagUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: ERROR_CODES.VALIDATION,
        message: parsed.error.message,
      });
    }

    const { key, enabled, scope, description } = parsed.data;

    const [updated] = await db.update(featureFlags)
      .set({ enabled, scope, description: description ?? "", updatedAt: new Date() })
      .where(eq(featureFlags.key, key))
      .returning();

    if (!updated) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        code: ERROR_CODES.NOT_FOUND,
        message: "Flag not found",
      });
    }

    invalidateFeatureFlagCache();

    await db.insert(auditLog).values({
      actorUserId: req.auth!.userId,
      action: "UPDATE_FEATURE_FLAG",
      entityType: "feature_flag",
      entityId: key,
      payload: { enabled, scope },
    });

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Failed to update feature flag");
    res.status(HTTP_STATUS.INTERNAL).json({ code: ERROR_CODES.INTERNAL, message: "Failed to update flag" });
  }
});

// ═══════════════════════════════════════════════════════════
//  Beds24 Admin Proxy — HARDENED
// ═══════════════════════════════════════════════════════════

/**
 * POST /admin/beds24/proxy — Hardened passthrough proxy.
 *
 * Security layers:
 *   1. ENABLE_BEDS24_PROXY feature flag (default: OFF)
 *   2. ADMIN role required
 *   3. Rate limit per user
 *   4. Endpoint allowlist
 *   5. Full audit log with PII redaction
 */
router.post("/beds24/proxy", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const userId = req.auth!.userId;
  let proxyPath = "";
  let proxyMethod = "";
  let allowed = false;

  try {
    // ── Layer 1: Feature flag ──────────────────────────────
    if (!isFeatureEnabled("beds24Proxy")) {
      const reason = "ENABLE_BEDS24_PROXY is disabled (default: OFF for safety)";
      await logProxyAudit(userId, "POST", req.body?.path ?? "unknown", false, 403, reason);
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        code: ERROR_CODES.FEATURE_DISABLED,
        message: reason,
      });
    }

    // ── Layer 2: Rate limit ────────────────────────────────
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
      const reason = `Rate limit exceeded (${config.adminProxy.maxRequestsPerMinute}/min)`;
      await logProxyAudit(userId, "POST", req.body?.path ?? "unknown", false, 429, reason);
      res.set("Retry-After", String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)));
      return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        code: ERROR_CODES.RATE_LIMITED,
        message: reason,
        retryAfter: Math.ceil((rateCheck.resetAt - Date.now()) / 1000),
      });
    }

    // ── Layer 3: Validate request ──────────────────────────
    const parsed = beds24ProxySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: ERROR_CODES.VALIDATION,
        message: parsed.error.message,
      });
    }

    proxyPath = parsed.data.path;
    proxyMethod = parsed.data.method;

    // ── Layer 4: Allowlist check ───────────────────────────
    const allowCheck = isPathAllowed(proxyMethod, proxyPath);
    if (!allowCheck.allowed) {
      await logProxyAudit(userId, proxyMethod, proxyPath, false, 403, allowCheck.reason);
      logger.warn({ userId, method: proxyMethod, path: proxyPath }, "Proxy request blocked by allowlist");
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        code: ERROR_CODES.PROXY_NOT_ALLOWED,
        message: allowCheck.reason,
      });
    }

    // ── Layer 5: Check Beds24 configuration ────────────────
    if (!config.beds24.refreshToken) {
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        code: ERROR_CODES.NOT_CONFIGURED,
        message: "Beds24 refresh token not configured",
      });
    }

    // ── Execute proxy request ──────────────────────────────
    const sdk = createBeds24SDK({
      apiUrl: config.beds24.apiUrl,
      refreshToken: config.beds24.refreshToken,
    });

    const { response, audit } = await sdk.adminProxy.execute(parsed.data);
    allowed = true;

    // ── Layer 6: Audit log with PII redaction ──────────────
    const redactedBody = redactPII(parsed.data.body ?? {});
    await logProxyAudit(
      userId,
      proxyMethod,
      proxyPath,
      true,
      response.status,
      allowCheck.reason,
      parsed.data.query,
      redactedBody
    );

    // Also log to general audit log
    await db.insert(auditLog).values({
      actorUserId: userId,
      action: "BEDS24_PROXY",
      entityType: "beds24",
      entityId: proxyPath,
      payload: {
        method: proxyMethod,
        path: proxyPath,
        responseStatus: response.status,
        bodyRedacted: redactedBody,
      },
    });

    res.status(response.status).json(response.data);
  } catch (err: any) {
    logger.error({ err, userId, path: proxyPath }, "Beds24 proxy error");

    // Audit the failure too
    await logProxyAudit(
      userId,
      proxyMethod || "UNKNOWN",
      proxyPath || "unknown",
      allowed,
      err.statusCode ?? 500,
      `Error: ${err.message}`
    ).catch(() => {}); // Don't fail on audit write errors

    const status = err.statusCode ?? HTTP_STATUS.INTERNAL;
    res.status(status).json({ code: ERROR_CODES.PROXY_ERROR, message: err.message });
  }
});

/** Helper: write to proxy_audit_log table. */
async function logProxyAudit(
  actorUserId: string,
  method: string,
  path: string,
  allowed: boolean,
  responseStatus: number,
  reason?: string,
  query?: Record<string, string>,
  bodyRedacted?: unknown
) {
  try {
    await db.insert(proxyAuditLog).values({
      actorUserId,
      method,
      path,
      query: query ?? {},
      bodyRedacted: (bodyRedacted ?? {}) as Record<string, unknown>,
      responseStatus,
      allowed,
      reason: reason ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to write proxy audit log");
  }
}

// ═══════════════════════════════════════════════════════════
//  Audit Log
// ═══════════════════════════════════════════════════════════

/** GET /admin/audit-log — List audit entries. */
router.get("/audit-log", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const offset = (page - 1) * limit;

    const entries = await db.query.auditLog.findMany({
      orderBy: (al, { desc }) => [desc(al.createdAt)],
      limit,
      offset,
    });

    res.json({ data: entries, page, limit });
  } catch (err) {
    logger.error({ err }, "Failed to list audit log");
    res.status(HTTP_STATUS.INTERNAL).json({ code: ERROR_CODES.INTERNAL, message: "Failed to list audit log" });
  }
});

/** GET /admin/proxy-audit-log — List proxy audit entries. */
router.get("/proxy-audit-log", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const offset = (page - 1) * limit;

    const entries = await db.query.proxyAuditLog.findMany({
      orderBy: (pal, { desc }) => [desc(pal.createdAt)],
      limit,
      offset,
    });

    res.json({ data: entries, page, limit });
  } catch (err) {
    logger.error({ err }, "Failed to list proxy audit log");
    res.status(HTTP_STATUS.INTERNAL).json({ code: ERROR_CODES.INTERNAL, message: "Failed to list proxy audit log" });
  }
});

// ═══════════════════════════════════════════════════════════
//  System Health
// ═══════════════════════════════════════════════════════════

/** GET /admin/system — Feature summary, writer-lock status. */
router.get("/system", requireAuth, requireRole("ADMIN"), async (_req, res) => {
  res.json(getFeatureSummary());
});

export default router;
