/**
 * ═══════════════════════════════════════════════════════════════
 *  Booking Routes — Hub-API
 * ═══════════════════════════════════════════════════════════════
 *
 *  POST /bookings:
 *    - Extracts Idempotency-Key from HTTP header (REQUIRED)
 *    - Passes it to BookingService.create() as part of params
 *    - BookingService enforces writer-lock (409 for standalone brands)
 *
 *  GET /bookings, GET /bookings/:id:
 *    - Read-only, no writer-lock needed
 * ═══════════════════════════════════════════════════════════════
 */

import { Router } from "express";
import { BookingService, ServiceError, WriterLockViolation } from "../services/booking-service.js";
import { bookingCreateSchema, quoteParamsSchema } from "@mk/shared";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { ERROR_CODES, HTTP_STATUS } from "@mk/shared";
import { logger } from "../lib/logger.js";

const router = Router();
const bookingService = new BookingService();

/** POST /bookings/quote — Public: get a price quote. */
router.post("/quote", optionalAuth, async (req, res) => {
  try {
    const parsed = quoteParamsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: ERROR_CODES.VALIDATION,
        message: parsed.error.message,
      });
    }
    const result = await bookingService.quote(parsed.data);
    res.json(result);
  } catch (err) {
    if (err instanceof ServiceError) {
      return res.status(err.statusCode).json({ code: err.code, message: err.message });
    }
    logger.error({ err }, "Quote failed");
    res.status(HTTP_STATUS.INTERNAL).json({ code: ERROR_CODES.INTERNAL, message: "Quote failed" });
  }
});

/**
 * POST /bookings — Create a booking.
 *
 * REQUIRES: Idempotency-Key HTTP header (min 8 chars).
 * ENFORCES: Writer-lock — returns 409 if brand is in standalone mode.
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    // ── Extract Idempotency-Key from HTTP header ───────────
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    if (!idempotencyKey || idempotencyKey.length < 8) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
        message: "Idempotency-Key header is required (min 8 chars) for booking creation",
      });
    }

    // ── Validate request body ──────────────────────────────
    const parsed = bookingCreateSchema.safeParse({
      ...req.body,
      idempotencyKey, // Inject from header into validated params
    });
    if (!parsed.success) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: ERROR_CODES.VALIDATION,
        message: parsed.error.message,
      });
    }

    // ── Create booking (writer-lock enforced inside) ───────
    const booking = await bookingService.create(parsed.data);
    res.status(HTTP_STATUS.CREATED).json(booking);
  } catch (err) {
    // ── WriterLockViolation → 409 with full context ────────
    if (err instanceof WriterLockViolation) {
      return res.status(err.statusCode).json(err.body);
    }
    // ── ServiceError → appropriate status code ─────────────
    if (err instanceof ServiceError) {
      return res.status(err.statusCode).json({ code: err.code, message: err.message });
    }
    logger.error({ err }, "Booking creation failed");
    res.status(HTTP_STATUS.INTERNAL).json({ code: ERROR_CODES.INTERNAL, message: "Booking creation failed" });
  }
});

/** GET /bookings — List bookings (authenticated). */
router.get("/", requireAuth, async (req, res) => {
  try {
    // TODO: Implement booking list with filters
    res.json({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
  } catch (err) {
    logger.error({ err }, "Failed to list bookings");
    res.status(HTTP_STATUS.INTERNAL).json({ code: ERROR_CODES.INTERNAL, message: "Failed to list bookings" });
  }
});

/** GET /bookings/:id — Get booking detail (authenticated). */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    // TODO: Implement booking detail lookup
    res.status(HTTP_STATUS.NOT_FOUND).json({ code: ERROR_CODES.NOT_FOUND, message: "Not implemented yet" });
  } catch (err) {
    logger.error({ err }, "Failed to fetch booking");
    res.status(HTTP_STATUS.INTERNAL).json({ code: ERROR_CODES.INTERNAL, message: "Failed to fetch booking" });
  }
});

export default router;
