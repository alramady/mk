/**
 * ═══════════════════════════════════════════════════════════════
 *  Webhook Routes — Hub-API
 * ═══════════════════════════════════════════════════════════════
 *
 *  ENABLE_BEDS24_WEBHOOKS=false (default, safest):
 *    → Returns 204 No Content immediately (no-op)
 *    → No processing, no queuing, no DB writes
 *
 *  ENABLE_BEDS24_WEBHOOKS=true:
 *    → Layer 1: Static shared secret header (PRIMARY — set matching
 *               "Custom Header" in Beds24 dashboard)
 *    → Layer 2: IP allowlist (OPTIONAL — Beds24 IPs may change)
 *    → Dedup via webhook_events table (UNIQUE on event_id)
 *    → If duplicate: returns 200 with dedup notice (skip)
 *    → If new: inserts PENDING event, enqueues to BullMQ, returns 200
 *    → Processing happens asynchronously in the worker service
 *
 *  IMPORTANT — Beds24 Webhook Security:
 *    Beds24 does NOT send HMAC signatures on webhooks. Their V2
 *    booking webhooks are plain POST requests with JSON body.
 *    The only built-in security options are:
 *      1. Static shared secret via "Custom Header" in Beds24 dashboard
 *         (set a header like X-Webhook-Secret: your-secret, we verify it)
 *      2. IP allowlist (restrict to Beds24 server IPs)
 *      3. URL token (include a secret in the webhook URL path/query)
 *
 *    We implement options 1 (PRIMARY) and 2 (OPTIONAL).
 *    Option 3 is not used because it leaks secrets in access logs.
 *
 *  SECURITY — Secret Handling:
 *    - The webhook secret value is NEVER logged, not even partially.
 *    - Log messages only indicate "mismatch" or "missing" without the value.
 *    - The /webhooks/status endpoint shows only a boolean (configured or not).
 *    - Audit logs do not store any header values.
 * ═══════════════════════════════════════════════════════════════
 */

import { Router } from "express";
import { db } from "../db/connection.js";
import { webhookEvents } from "../db/schema.js";
import { isFeatureEnabled, config } from "../config.js";
import { logger } from "../lib/logger.js";
import { webhookEventSchema, ERROR_CODES, HTTP_STATUS, WEBHOOK_MAX_RETRIES } from "@mk/shared";

const router = Router();

// ─── Configuration ────────────────────────────────────────
// Static shared secret: set in Beds24 dashboard as a Custom Header.
// This is the PRIMARY authentication layer.
// Header name is configurable via BEDS24_WEBHOOK_SECRET_HEADER.
const WEBHOOK_SECRET = config.beds24.webhookSecret;
const WEBHOOK_SECRET_HEADER = config.beds24.webhookSecretHeader;

// IP allowlist: loaded from env at startup. Comma-separated.
// This is the OPTIONAL secondary layer (Beds24 IPs may change).
// Empty = IP check disabled.
const WEBHOOK_IP_ALLOWLIST: string[] = (process.env.BEDS24_WEBHOOK_IP_ALLOWLIST ?? "")
  .split(",")
  .map((ip) => ip.trim())
  .filter(Boolean);

// ─── BullMQ Queue (lazy-initialized) ───────────────────────
let webhookQueue: any = null;

async function getQueue() {
  if (webhookQueue) return webhookQueue;
  try {
    const { Queue } = await import("bullmq");
    webhookQueue = new Queue("webhook-events", {
      connection: { url: config.redisUrl },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
    return webhookQueue;
  } catch (err) {
    logger.warn({ err }, "BullMQ not available — webhook events stored but not queued");
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
//  Layer 1: Static Shared Secret Header (PRIMARY)
// ═══════════════════════════════════════════════════════════
//
// Beds24's Inventory Webhooks support "Custom Header" fields in
// their dashboard. You set a header name + value in Beds24, and
// Beds24 includes it in every webhook request as-is.
//
// This is NOT HMAC — it's a simple static string comparison.
// We use constant-time comparison to prevent timing attacks.
//
// SECURITY: The secret value is NEVER logged. Log messages only
// indicate "missing" or "mismatch" without revealing the value.
//
function verifySharedSecret(req: import("express").Request): { ok: boolean; reason: string } {
  if (!WEBHOOK_SECRET) {
    return { ok: true, reason: "shared-secret-not-configured" };
  }

  const provided = req.headers[WEBHOOK_SECRET_HEADER] as string | undefined;

  if (!provided) {
    return {
      ok: false,
      reason: `shared-secret-header-missing (expected header: ${WEBHOOK_SECRET_HEADER})`,
    };
  }

  // Constant-time comparison to prevent timing attacks
  if (provided.length !== WEBHOOK_SECRET.length) {
    return { ok: false, reason: "shared-secret-mismatch" };
  }

  let mismatch = 0;
  for (let i = 0; i < provided.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ WEBHOOK_SECRET.charCodeAt(i);
  }

  if (mismatch !== 0) {
    return { ok: false, reason: "shared-secret-mismatch" };
  }

  return { ok: true, reason: "shared-secret-verified" };
}

// ═══════════════════════════════════════════════════════════
//  Layer 2: IP Allowlist Verification (OPTIONAL)
// ═══════════════════════════════════════════════════════════
//
// Beds24 server IPs may change without notice, so this layer
// is optional. When configured, it provides defense-in-depth.
// Populate BEDS24_WEBHOOK_IP_ALLOWLIST with IPs from Beds24
// support or by observing X-Forwarded-For during initial testing.
//
// SECURITY: Source IPs are logged on rejection (acceptable for
// debugging). The allowlist itself is logged at startup only.
//
function verifySourceIP(req: import("express").Request): { ok: boolean; ip: string } {
  if (WEBHOOK_IP_ALLOWLIST.length === 0) {
    return { ok: true, ip: "check-disabled" };
  }

  const forwarded = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim();
  const ip = forwarded ?? req.socket.remoteAddress ?? "unknown";

  const allowed = WEBHOOK_IP_ALLOWLIST.some((entry) => {
    // Exact match
    if (ip === entry) return true;
    // CIDR prefix match (simplified: /16 → first two octets, /24 → first three)
    if (entry.includes("/")) {
      const prefix = entry.split("/")[0];
      const cidr = parseInt(entry.split("/")[1], 10);
      const octets = Math.floor(cidr / 8);
      const prefixParts = prefix.split(".");
      const ipParts = ip.split(".");
      return prefixParts.slice(0, octets).join(".") === ipParts.slice(0, octets).join(".");
    }
    return false;
  });

  return { ok: allowed, ip };
}

// ═══════════════════════════════════════════════════════════
//  POST /webhooks/beds24 — Beds24 Webhook Receiver
// ═══════════════════════════════════════════════════════════

router.post("/beds24", async (req, res) => {
  // ── Feature flag: disabled → 204 No Content ──────────────
  if (!isFeatureEnabled("beds24Webhooks")) {
    logger.debug("Webhook received but ENABLE_BEDS24_WEBHOOKS=false — returning 204");
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }

  try {
    // ── Layer 1: Shared secret check (PRIMARY) ────────────
    const secretCheck = verifySharedSecret(req);
    if (!secretCheck.ok) {
      // SECURITY: Never log the secret value itself
      logger.warn(
        { reason: secretCheck.reason, headerName: WEBHOOK_SECRET_HEADER },
        "Webhook rejected — shared secret verification failed"
      );
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: ERROR_CODES.WEBHOOK_INVALID_SIGNATURE,
        message: "Invalid or missing webhook secret — check Custom Header configuration in Beds24 dashboard",
      });
    }

    // ── Layer 2: IP allowlist check (OPTIONAL) ────────────
    const ipCheck = verifySourceIP(req);
    if (!ipCheck.ok) {
      // IP is safe to log for debugging
      logger.warn(
        { ip: ipCheck.ip, allowlistCount: WEBHOOK_IP_ALLOWLIST.length },
        "Webhook rejected — source IP not in allowlist"
      );
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        code: ERROR_CODES.FORBIDDEN,
        message: "Source IP not in webhook allowlist",
      });
    }

    // ── Parse event ────────────────────────────────────────
    const parsed = webhookEventSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn({ errors: parsed.error.message }, "Webhook payload validation failed");
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: ERROR_CODES.VALIDATION,
        message: "Invalid webhook payload",
      });
    }

    const event = parsed.data;
    const eventId = String(event.id);

    // ── Dedup: insert into webhook_events (UNIQUE on event_id) ─
    try {
      await db.insert(webhookEvents).values({
        eventId,
        eventType: event.type,
        source: "beds24",
        payload: req.body as Record<string, unknown>,
        status: "PENDING",
        attempts: 0,
        maxRetries: WEBHOOK_MAX_RETRIES,
      });
    } catch (err: any) {
      // UNIQUE constraint violation = duplicate event
      if (err.code === "23505" || err.message?.includes("unique") || err.message?.includes("duplicate")) {
        logger.info({ eventId }, "Webhook event deduplicated — already received");
        return res.status(HTTP_STATUS.OK).json({
          received: true,
          deduplicated: true,
          eventId,
          message: "Event already received and is being processed",
        });
      }
      throw err; // Re-throw unexpected errors
    }

    // ── Enqueue for async processing ───────────────────────
    const queue = await getQueue();
    if (queue) {
      await queue.add("process-webhook", {
        eventId,
        eventType: event.type,
        payload: req.body,
      }, {
        jobId: `webhook-${eventId}`, // Prevent duplicate jobs
        attempts: 1, // Worker handles its own retry logic via DB
      });
      logger.info({ eventId, eventType: event.type }, "Webhook event queued for processing");
    } else {
      logger.warn({ eventId }, "Webhook event stored but BullMQ unavailable — needs manual processing");
    }

    // ── Ack fast ───────────────────────────────────────────
    return res.status(HTTP_STATUS.OK).json({
      received: true,
      deduplicated: false,
      eventId,
      message: "Event received and queued for processing",
    });
  } catch (err) {
    logger.error({ err }, "Webhook processing failed");
    // Still return 200 to prevent Beds24 from retrying
    return res.status(HTTP_STATUS.OK).json({
      received: true,
      error: "Internal processing error — event may need manual review",
    });
  }
});

// ═══════════════════════════════════════════════════════════
//  GET /webhooks/status — Health check for webhook system
// ═══════════════════════════════════════════════════════════
//
// SECURITY: This endpoint NEVER exposes secret values.
// It only shows boolean flags and non-sensitive metadata.
//

router.get("/status", async (_req, res) => {
  res.json({
    enabled: isFeatureEnabled("beds24Webhooks"),
    behavior: isFeatureEnabled("beds24Webhooks") ? "200 + queue" : "204 no-op",
    security: {
      sharedSecret: {
        configured: !!WEBHOOK_SECRET,
        headerName: WEBHOOK_SECRET_HEADER,
        priority: "PRIMARY",
        note: "Set matching Custom Header in Beds24 dashboard — NOT HMAC, static string comparison",
      },
      ipAllowlist: {
        configured: WEBHOOK_IP_ALLOWLIST.length > 0,
        count: WEBHOOK_IP_ALLOWLIST.length,
        priority: "OPTIONAL",
        note: "Beds24 IPs may change — use as defense-in-depth, not sole auth",
      },
    },
    verificationOrder: [
      "1. Feature flag (204 if off)",
      "2. Shared secret header (401 if mismatch) — PRIMARY",
      "3. IP allowlist (403 if blocked) — OPTIONAL",
      "4. Schema validation (400 if malformed)",
      "5. Dedup check → Queue → 200",
    ],
    redisUrl: config.redisUrl ? "configured" : "not configured",
  });
});

export default router;
