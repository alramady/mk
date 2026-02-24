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
 *    → Validates webhook signature (if BEDS24_WEBHOOK_SECRET set)
 *    → Dedup via webhook_events table (UNIQUE on event_id)
 *    → If duplicate: returns 200 with dedup notice (skip)
 *    → If new: inserts PENDING event, enqueues to BullMQ, returns 200
 *    → Processing happens asynchronously in the worker service
 * ═══════════════════════════════════════════════════════════════
 */

import { Router } from "express";
import { createHmac } from "crypto";
import { db } from "../db/connection.js";
import { webhookEvents } from "../db/schema.js";
import { isFeatureEnabled, config } from "../config.js";
import { logger } from "../lib/logger.js";
import { webhookEventSchema, ERROR_CODES, HTTP_STATUS, WEBHOOK_MAX_RETRIES } from "@mk/shared";

const router = Router();

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

// ─── Signature Verification ────────────────────────────────
function verifySignature(body: string, signature: string | undefined): boolean {
  const secret = config.beds24.webhookSecret;
  if (!secret) return true; // No secret configured = skip verification
  if (!signature) return false;

  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return signature === expected || signature === `sha256=${expected}`;
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
    // ── Signature verification ─────────────────────────────
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers["x-beds24-signature"] as string | undefined;

    if (config.beds24.webhookSecret && !verifySignature(rawBody, signature)) {
      logger.warn("Webhook signature verification failed");
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: ERROR_CODES.WEBHOOK_INVALID_SIGNATURE,
        message: "Invalid webhook signature",
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

router.get("/status", async (_req, res) => {
  res.json({
    enabled: isFeatureEnabled("beds24Webhooks"),
    behavior: isFeatureEnabled("beds24Webhooks") ? "200 + queue" : "204 no-op",
    webhookSecretConfigured: !!config.beds24.webhookSecret,
    redisUrl: config.redisUrl ? "configured" : "not configured",
  });
});

export default router;
