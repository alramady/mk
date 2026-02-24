/**
 * ═══════════════════════════════════════════════════════════════
 *  Worker Service — BullMQ Queue Consumer
 * ═══════════════════════════════════════════════════════════════
 *
 *  Queues:
 *    webhook-events:  Process Beds24 webhook events with retry
 *    auto-ticket:     Auto-create cleaning/maintenance tickets
 *    notification:    Send notifications (email/SMS/push)
 *
 *  Webhook Retry Strategy:
 *    - Reads from webhook_events table (status=PENDING)
 *    - Exponential backoff: 30s, 1m, 2m, 4m, 8m (configurable)
 *    - Max retries from WEBHOOK_MAX_RETRIES (default: 5)
 *    - After max retries → DEAD_LETTER status
 *    - Each attempt updates the DB: attempts++, lastError, nextRetryAt
 *    - COMPLETED on success, FAILED on retriable error, DEAD_LETTER on exhaustion
 *
 *  Retry Worker:
 *    - Polls webhook_events where status=FAILED AND nextRetryAt <= now
 *    - Re-enqueues them for processing
 *    - Runs every 30 seconds
 * ═══════════════════════════════════════════════════════════════
 */

import { Worker, Queue } from "bullmq";
import IORedis from "ioredis";
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const DATABASE_URL = process.env.DATABASE_URL ?? "";
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

// ─── Base backoff: 30s, multiplied by 2^attempt ───────────
const BASE_BACKOFF_MS = 30_000;

function calculateNextRetry(attempt: number): Date {
  const delayMs = BASE_BACKOFF_MS * Math.pow(2, attempt);
  const jitterMs = Math.random() * 5_000; // Add 0-5s jitter
  return new Date(Date.now() + delayMs + jitterMs);
}

// ─── Queues ─────────────────────────────────────────────────
export const webhookQueue = new Queue("webhook-events", { connection });
export const ticketQueue = new Queue("auto-ticket", { connection });
export const notificationQueue = new Queue("notification", { connection });

// ═══════════════════════════════════════════════════════════
//  Webhook Event Worker — Process + Retry + Dead-Letter
// ═══════════════════════════════════════════════════════════

const webhookWorker = new Worker(
  "webhook-events",
  async (job) => {
    const { eventId, eventType, payload } = job.data;
    logger.info({ eventId, eventType, jobId: job.id }, "Processing webhook event");

    // ── Update status to PROCESSING ────────────────────────
    await updateWebhookStatus(eventId, "PROCESSING");

    try {
      // ── Dispatch by event type ───────────────────────────
      switch (eventType) {
        case "booking.created":
          logger.info({ bookingId: payload.bookingId }, "New booking from Beds24");
          // TODO: Sync booking to local DB
          // Auto-create cleaning ticket for checkout date
          if (process.env.ENABLE_AUTOMATED_TICKETS === "true") {
            await ticketQueue.add("auto-clean", {
              type: "CHECKOUT_CLEAN",
              bookingId: payload.bookingId,
              unitId: payload.propertyId,
              dueAt: payload.checkOut,
            });
          }
          break;

        case "booking.modified":
          logger.info({ bookingId: payload.bookingId }, "Booking modified in Beds24");
          // TODO: Update local booking record
          break;

        case "booking.cancelled":
          logger.info({ bookingId: payload.bookingId }, "Booking cancelled in Beds24");
          // TODO: Cancel local booking, cancel related tickets
          break;

        case "property.updated":
          logger.info({ propertyId: payload.propertyId }, "Property updated in Beds24");
          // TODO: Sync property changes to local DB
          break;

        default:
          logger.warn({ eventType }, "Unknown Beds24 event type — marking as completed");
      }

      // ── Success → COMPLETED ──────────────────────────────
      await updateWebhookStatus(eventId, "COMPLETED", null, new Date());
      logger.info({ eventId, eventType }, "Webhook event processed successfully");
    } catch (err: any) {
      // ── Failure → check retry budget ─────────────────────
      const currentAttempts = await incrementAttempt(eventId);
      const maxRetries = job.data.maxRetries ?? 5;

      if (currentAttempts >= maxRetries) {
        // ── Exhausted → DEAD_LETTER ────────────────────────
        await updateWebhookStatus(eventId, "DEAD_LETTER", err.message);
        logger.error(
          { eventId, eventType, attempts: currentAttempts, maxRetries },
          "Webhook event moved to DEAD_LETTER after max retries"
        );
        // Don't throw — job is done (dead-lettered)
      } else {
        // ── Retriable → FAILED with nextRetryAt ────────────
        const nextRetry = calculateNextRetry(currentAttempts);
        await updateWebhookStatus(eventId, "FAILED", err.message, null, nextRetry);
        logger.warn(
          { eventId, eventType, attempt: currentAttempts, maxRetries, nextRetry: nextRetry.toISOString() },
          "Webhook event failed — scheduled for retry"
        );
        // Don't throw — retry worker will pick it up
      }
    }
  },
  {
    connection,
    concurrency: 5,
    limiter: { max: 10, duration: 1000 },
  }
);

// ═══════════════════════════════════════════════════════════
//  Retry Poller — Re-enqueue FAILED events whose nextRetryAt has passed
// ═══════════════════════════════════════════════════════════

let retryInterval: ReturnType<typeof setInterval> | null = null;

async function pollForRetries() {
  if (!DATABASE_URL) return; // No DB = skip

  try {
    // This uses raw SQL because drizzle may not be available in worker
    // In production, this would use the shared DB connection
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();

    try {
      const result = await client.query(
        `SELECT event_id, event_type, payload, max_retries
         FROM webhook_events
         WHERE status = 'FAILED'
           AND next_retry_at <= NOW()
         ORDER BY next_retry_at ASC
         LIMIT 20`
      );

      for (const row of result.rows) {
        logger.info({ eventId: row.event_id }, "Re-enqueuing failed webhook event for retry");

        await webhookQueue.add("process-webhook", {
          eventId: row.event_id,
          eventType: row.event_type,
          payload: row.payload,
          maxRetries: row.max_retries,
        }, {
          jobId: `webhook-retry-${row.event_id}-${Date.now()}`,
          attempts: 1,
        });
      }

      if (result.rows.length > 0) {
        logger.info({ count: result.rows.length }, "Re-enqueued failed webhook events");
      }
    } finally {
      await client.end();
    }
  } catch (err) {
    logger.error({ err }, "Retry poller error");
  }
}

// Poll every 30 seconds
retryInterval = setInterval(pollForRetries, 30_000);

// ═══════════════════════════════════════════════════════════
//  DB Helpers — Update webhook_events status
// ═══════════════════════════════════════════════════════════

async function updateWebhookStatus(
  eventId: string,
  status: string,
  lastError?: string | null,
  processedAt?: Date | null,
  nextRetryAt?: Date | null
) {
  if (!DATABASE_URL) return;

  try {
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();

    try {
      await client.query(
        `UPDATE webhook_events
         SET status = $1,
             last_error = COALESCE($2, last_error),
             processed_at = COALESCE($3, processed_at),
             next_retry_at = $4,
             updated_at = NOW()
         WHERE event_id = $5`,
        [status, lastError ?? null, processedAt ?? null, nextRetryAt ?? null, eventId]
      );
    } finally {
      await client.end();
    }
  } catch (err) {
    logger.error({ err, eventId, status }, "Failed to update webhook event status");
  }
}

async function incrementAttempt(eventId: string): Promise<number> {
  if (!DATABASE_URL) return 1;

  try {
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();

    try {
      const result = await client.query(
        `UPDATE webhook_events
         SET attempts = attempts + 1, updated_at = NOW()
         WHERE event_id = $1
         RETURNING attempts`,
        [eventId]
      );
      return result.rows[0]?.attempts ?? 1;
    } finally {
      await client.end();
    }
  } catch (err) {
    logger.error({ err, eventId }, "Failed to increment webhook attempt");
    return 1;
  }
}

// ═══════════════════════════════════════════════════════════
//  Auto-Ticket Worker
// ═══════════════════════════════════════════════════════════

const ticketWorker = new Worker(
  "auto-ticket",
  async (job) => {
    const { type, bookingId, unitId, dueAt } = job.data;
    logger.info({ type, bookingId, unitId }, "Creating auto-ticket");

    // TODO: Call Hub API to create ticket
    // POST /api/v1/tickets { type: "CLEANING", unitId, bookingId, dueAt }
    logger.info(
      { type, unitId, dueAt },
      "Would create cleaning ticket for checkout"
    );
  },
  {
    connection,
    concurrency: 3,
  }
);

// ═══════════════════════════════════════════════════════════
//  Notification Worker
// ═══════════════════════════════════════════════════════════

const notificationWorker = new Worker(
  "notification",
  async (job) => {
    const { channel, recipient, subject, body } = job.data;
    logger.info({ channel, recipient, subject }, "Sending notification");

    switch (channel) {
      case "email":
        // TODO: Integrate with email service (SendGrid, SES, etc.)
        logger.info({ recipient }, "Would send email notification");
        break;
      case "sms":
        // TODO: Integrate with SMS service (Twilio, Unifonic, etc.)
        logger.info({ recipient }, "Would send SMS notification");
        break;
      case "push":
        // TODO: Integrate with push notification service
        logger.info({ recipient }, "Would send push notification");
        break;
      default:
        logger.warn({ channel }, "Unknown notification channel");
    }
  },
  {
    connection,
    concurrency: 10,
  }
);

// ═══════════════════════════════════════════════════════════
//  Graceful Shutdown
// ═══════════════════════════════════════════════════════════

async function shutdown() {
  logger.info("Shutting down workers...");
  if (retryInterval) clearInterval(retryInterval);
  await Promise.all([
    webhookWorker.close(),
    ticketWorker.close(),
    notificationWorker.close(),
  ]);
  await connection.quit();
  logger.info("Workers shut down gracefully");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ═══════════════════════════════════════════════════════════
//  Worker Event Handlers
// ═══════════════════════════════════════════════════════════

for (const [name, worker] of Object.entries({
  webhook: webhookWorker,
  ticket: ticketWorker,
  notification: notificationWorker,
})) {
  worker.on("completed", (job) => {
    logger.info({ worker: name, jobId: job.id }, "Job completed");
  });
  worker.on("failed", (job, err) => {
    logger.error({ worker: name, jobId: job?.id, err: err.message }, "Job failed");
  });
}

logger.info("Worker service started — listening for jobs on 3 queues");
logger.info(`Redis: ${REDIS_URL}`);
logger.info("Webhook retry poller: active (every 30s)");
