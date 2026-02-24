/**
 * ═══════════════════════════════════════════════════════════════
 *  Webhook Routes — Hub-API
 * ═══════════════════════════════════════════════════════════════
 *
 *  ENABLE_BEDS24_WEBHOOKS=false (default, safest):
 *    → Returns 204 No Content immediately (no-op)
 *
 *  ENABLE_BEDS24_WEBHOOKS=true:
 *    → Layer 1: Static shared secret header (PRIMARY)
 *               Supports zero-downtime rotation: accepts current
 *               + previous secret during a configurable window.
 *    → Layer 2: IP allowlist (OPTIONAL)
 *    → Dedup via webhook_events table (UNIQUE on event_id)
 *    → Queue to BullMQ → 200
 *
 *  SECRET ROTATION (zero-downtime):
 *    1. Generate a new secret.
 *    2. Set BEDS24_WEBHOOK_SECRET=<new>, BEDS24_WEBHOOK_SECRET_PREVIOUS=<old>,
 *       BEDS24_WEBHOOK_SECRET_ROTATION_START=<now ISO 8601>. Deploy.
 *    3. Update Beds24 dashboard Custom Header to the new secret.
 *    4. Both secrets are accepted for ROTATION_WINDOW_DAYS (default 7).
 *    5. After the window: clear PREVIOUS and ROTATION_START. Deploy.
 *
 *  SECURITY — Secret Handling:
 *    - Secret values are NEVER logged, not even partially.
 *    - Log messages indicate "mismatch", "missing", or "matched-previous"
 *      without revealing any value.
 *    - /webhooks/status shows only booleans and metadata.
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
const WEBHOOK_SECRET = config.beds24.webhookSecret;
const WEBHOOK_SECRET_PREVIOUS = config.beds24.webhookSecretPrevious;
const WEBHOOK_SECRET_HEADER = config.beds24.webhookSecretHeader;
const ROTATION_START = config.beds24.webhookSecretRotationStart;
const ROTATION_WINDOW_DAYS = config.beds24.webhookSecretRotationWindowDays;

// IP allowlist (OPTIONAL secondary layer)
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
//  Constant-Time String Comparison
// ═══════════════════════════════════════════════════════════

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// ═══════════════════════════════════════════════════════════
//  Rotation Window Check
// ═══════════════════════════════════════════════════════════
//
// Returns true if the previous secret should still be accepted.
// The window is open from ROTATION_START for ROTATION_WINDOW_DAYS.
// If ROTATION_START is empty or unparseable, the previous secret
// is accepted indefinitely (operator must clear it manually).
//

function isPreviousSecretInWindow(): boolean {
  if (!WEBHOOK_SECRET_PREVIOUS) return false;

  // No rotation start set → accept previous indefinitely (safe fallback)
  if (!ROTATION_START) return true;

  const startDate = new Date(ROTATION_START);
  if (isNaN(startDate.getTime())) {
    // Unparseable date → accept previous indefinitely, log warning
    logger.warn(
      { rotationStart: ROTATION_START },
      "BEDS24_WEBHOOK_SECRET_ROTATION_START is not a valid ISO 8601 date — previous secret accepted indefinitely"
    );
    return true;
  }

  const windowEndMs = startDate.getTime() + ROTATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();

  if (now > windowEndMs) {
    logger.info(
      { rotationStart: ROTATION_START, windowDays: ROTATION_WINDOW_DAYS },
      "Webhook secret rotation window has expired — previous secret no longer accepted. Clear BEDS24_WEBHOOK_SECRET_PREVIOUS and BEDS24_WEBHOOK_SECRET_ROTATION_START."
    );
    return false;
  }

  return true;
}

// ═══════════════════════════════════════════════════════════
//  Layer 1: Shared Secret Verification (PRIMARY)
//           with Rotation Support
// ═══════════════════════════════════════════════════════════
//
// Verification order:
//   1. Try current secret (BEDS24_WEBHOOK_SECRET)
//   2. If mismatch and rotation window is open, try previous secret
//   3. If previous matches, log "matched-previous" (rotation in progress)
//   4. If neither matches, reject with 401
//
// SECURITY: Secret values are NEVER logged. Only the match result
// ("verified", "matched-previous", "mismatch", "missing") is logged.
//

type SecretCheckResult = {
  ok: boolean;
  reason: string;
  matchedSecret: "current" | "previous" | "none" | "not-configured";
};

function verifySharedSecret(req: import("express").Request): SecretCheckResult {
  // No secrets configured at all → skip check
  if (!WEBHOOK_SECRET && !WEBHOOK_SECRET_PREVIOUS) {
    return { ok: true, reason: "shared-secret-not-configured", matchedSecret: "not-configured" };
  }

  const provided = req.headers[WEBHOOK_SECRET_HEADER] as string | undefined;

  if (!provided) {
    return {
      ok: false,
      reason: `shared-secret-header-missing (expected header: ${WEBHOOK_SECRET_HEADER})`,
      matchedSecret: "none",
    };
  }

  // ── Try current secret first ────────────────────────────
  if (WEBHOOK_SECRET && constantTimeEqual(provided, WEBHOOK_SECRET)) {
    return { ok: true, reason: "shared-secret-verified", matchedSecret: "current" };
  }

  // ── Try previous secret if rotation window is open ──────
  if (WEBHOOK_SECRET_PREVIOUS && isPreviousSecretInWindow()) {
    if (constantTimeEqual(provided, WEBHOOK_SECRET_PREVIOUS)) {
      return { ok: true, reason: "shared-secret-matched-previous", matchedSecret: "previous" };
    }
  }

  // ── Neither matched ─────────────────────────────────────
  return { ok: false, reason: "shared-secret-mismatch", matchedSecret: "none" };
}

// ═══════════════════════════════════════════════════════════
//  Layer 2: IP Allowlist Verification (OPTIONAL)
// ═══════════════════════════════════════════════════════════

function verifySourceIP(req: import("express").Request): { ok: boolean; ip: string } {
  if (WEBHOOK_IP_ALLOWLIST.length === 0) {
    return { ok: true, ip: "check-disabled" };
  }

  const forwarded = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim();
  const ip = forwarded ?? req.socket.remoteAddress ?? "unknown";

  const allowed = WEBHOOK_IP_ALLOWLIST.some((entry) => {
    if (ip === entry) return true;
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
      logger.warn(
        { reason: secretCheck.reason, headerName: WEBHOOK_SECRET_HEADER },
        "Webhook rejected — shared secret verification failed"
      );
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: ERROR_CODES.WEBHOOK_INVALID_SIGNATURE,
        message: "Invalid or missing webhook secret — check Custom Header configuration in Beds24 dashboard",
      });
    }

    // Log if matched previous secret (rotation in progress)
    if (secretCheck.matchedSecret === "previous") {
      logger.warn(
        { headerName: WEBHOOK_SECRET_HEADER, rotationStart: ROTATION_START, windowDays: ROTATION_WINDOW_DAYS },
        "Webhook authenticated via PREVIOUS secret — rotation in progress. Update Beds24 dashboard Custom Header to the new secret."
      );
    }

    // ── Layer 2: IP allowlist check (OPTIONAL) ────────────
    const ipCheck = verifySourceIP(req);
    if (!ipCheck.ok) {
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
      if (err.code === "23505" || err.message?.includes("unique") || err.message?.includes("duplicate")) {
        logger.info({ eventId }, "Webhook event deduplicated — already received");
        return res.status(HTTP_STATUS.OK).json({
          received: true,
          deduplicated: true,
          eventId,
          message: "Event already received and is being processed",
        });
      }
      throw err;
    }

    // ── Enqueue for async processing ───────────────────────
    const queue = await getQueue();
    if (queue) {
      await queue.add("process-webhook", {
        eventId,
        eventType: event.type,
        payload: req.body,
      }, {
        jobId: `webhook-${eventId}`,
        attempts: 1,
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
// SECURITY: NEVER exposes secret values. Only booleans and metadata.
//

router.get("/status", async (_req, res) => {
  // Compute rotation window status
  const rotationActive = !!WEBHOOK_SECRET_PREVIOUS && isPreviousSecretInWindow();
  let rotationExpiresAt: string | null = null;
  if (ROTATION_START && WEBHOOK_SECRET_PREVIOUS) {
    const startDate = new Date(ROTATION_START);
    if (!isNaN(startDate.getTime())) {
      rotationExpiresAt = new Date(startDate.getTime() + ROTATION_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  res.json({
    enabled: isFeatureEnabled("beds24Webhooks"),
    behavior: isFeatureEnabled("beds24Webhooks") ? "200 + queue" : "204 no-op",
    security: {
      sharedSecret: {
        configured: !!WEBHOOK_SECRET,
        headerName: WEBHOOK_SECRET_HEADER,
        priority: "PRIMARY",
        rotation: {
          previousSecretConfigured: !!WEBHOOK_SECRET_PREVIOUS,
          windowActive: rotationActive,
          windowDays: ROTATION_WINDOW_DAYS,
          rotationStartedAt: ROTATION_START || null,
          windowExpiresAt: rotationExpiresAt,
          note: rotationActive
            ? "Rotation in progress — both current and previous secrets are accepted"
            : WEBHOOK_SECRET_PREVIOUS
              ? "Rotation window expired — previous secret is no longer accepted. Clear BEDS24_WEBHOOK_SECRET_PREVIOUS."
              : "No rotation in progress",
        },
      },
      ipAllowlist: {
        configured: WEBHOOK_IP_ALLOWLIST.length > 0,
        count: WEBHOOK_IP_ALLOWLIST.length,
        priority: "OPTIONAL",
      },
    },
    verificationOrder: [
      "1. Feature flag (204 if off)",
      "2. Shared secret header (401 if mismatch) — PRIMARY (current + previous during rotation)",
      "3. IP allowlist (403 if blocked) — OPTIONAL",
      "4. Schema validation (400 if malformed)",
      "5. Dedup check → Queue → 200",
    ],
    redisUrl: config.redisUrl ? "configured" : "not configured",
  });
});

export default router;
