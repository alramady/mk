/**
 * ═══════════════════════════════════════════════════════════════
 *  Booking Service — Hub-API Side Writer Lock
 * ═══════════════════════════════════════════════════════════════
 *
 *  Hub-api is the booking writer ONLY for brands in integrated mode.
 *  For brands in standalone mode, hub-api MUST reject writes with 409.
 *
 *  Flow for integrated brands:
 *    1. Writer-lock check: reject if brand is standalone (409)
 *    2. Validate brand rules (night limits)
 *    3. Require Idempotency-Key (from HTTP header, NOT auto-generated)
 *    4. Idempotency dedup: return cached response if key exists
 *    5. Availability re-check IMMEDIATELY before write
 *    6. Create booking in local DB
 *    7. If ENABLE_BEDS24=true, push to Beds24 via SDK
 *    8. Cache idempotency response
 *    9. Return booking
 * ═══════════════════════════════════════════════════════════════
 */

import { eq, and, gte, lte, not, inArray } from "drizzle-orm";
import { db } from "../db/connection.js";
import { bookings, units, idempotencyStore } from "../db/schema.js";
import {
  hubShouldRejectWrites,
  hubIsWriter,
  getWriter,
  getBrandMode,
  isIntegrated,
  isFeatureEnabled,
  config,
} from "../config.js";
import { logger } from "../lib/logger.js";
import { BRAND_RULES, ERROR_CODES, HTTP_STATUS, IDEMPOTENCY_TTL_MS } from "@mk/shared";
import type { Brand, BookingCreateParams, Booking, WriterLockError } from "@mk/shared";
import { createHash } from "crypto";

export class BookingService {
  // ═══════════════════════════════════════════════════════════
  //  QUOTE — Read-only, no writer-lock needed
  // ═══════════════════════════════════════════════════════════

  async quote(params: {
    brand: Brand;
    unitId: string;
    checkIn: string;
    checkOut: string;
  }) {
    const unit = await db.query.units.findFirst({
      where: eq(units.id, params.unitId),
    });
    if (!unit) throw new ServiceError("Unit not found", HTTP_STATUS.NOT_FOUND);

    const checkIn = new Date(params.checkIn);
    const checkOut = new Date(params.checkOut);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000);

    this.validateNights(params.brand, nights);

    const pricePerNight = params.brand === "MONTHLYKEY"
      ? Math.round((unit.monthlyPrice ?? 0) / 30)
      : (unit.dailyPrice ?? 0);

    const total = pricePerNight * nights;
    const available = await this.checkLocalAvailability(params.unitId, params.checkIn, params.checkOut);

    return {
      unitId: params.unitId,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      nights,
      pricePerNight,
      total,
      currency: unit.currency,
      available,
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  CREATE — Writer Lock Enforced
  // ═══════════════════════════════════════════════════════════

  /**
   * Create a booking. The idempotencyKey MUST come from the
   * Idempotency-Key HTTP header — it is NOT auto-generated.
   */
  async create(params: BookingCreateParams): Promise<Booking> {
    const { brand, idempotencyKey } = params;

    // ── Step 1: WRITER LOCK CHECK ──────────────────────────
    // Hub-api rejects writes for brands in standalone mode.
    // In standalone mode, the adapter is the designated writer.
    if (hubShouldRejectWrites(brand)) {
      const mode = getBrandMode(brand);
      const writer = getWriter(brand);
      const error: WriterLockError = {
        code: ERROR_CODES.WRITER_LOCK_VIOLATION,
        message:
          `Hub-API cannot write bookings for ${brand} because it is in ${mode} mode. ` +
          `The designated writer is: ${writer} (the adapter). ` +
          `To use hub-api as the writer, set MODE_${brand}=integrated.`,
        brand,
        mode,
        designatedWriter: writer,
        rejectedBy: "hub-api",
      };
      logger.warn({ brand, mode, writer }, "Writer lock: hub-api rejected booking write");
      throw new WriterLockViolation(error);
    }

    // ── Step 2: VALIDATE BRAND RULES ───────────────────────
    const checkIn = new Date(params.checkIn);
    const checkOut = new Date(params.checkOut);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
    this.validateNights(brand, nights);

    // ── Step 3: REQUIRE IDEMPOTENCY KEY ────────────────────
    // The key comes from the HTTP header, extracted by the route handler.
    // It must be present and at least 8 chars.
    if (!idempotencyKey || idempotencyKey.length < 8) {
      throw new ServiceError(
        "Idempotency-Key header is required (min 8 chars) for booking creation",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED
      );
    }

    // ── Step 4: IDEMPOTENCY DEDUP ──────────────────────────
    const requestHash = this.hashRequest(params);

    const existing = await db.query.idempotencyStore.findFirst({
      where: eq(idempotencyStore.key, idempotencyKey),
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ServiceError(
          "This Idempotency-Key was already used with different request parameters",
          HTTP_STATUS.UNPROCESSABLE,
          ERROR_CODES.IDEMPOTENCY_KEY_REUSED
        );
      }
      logger.info({ idempotencyKey }, "Returning cached booking response (idempotent replay)");
      return existing.responseBody as unknown as Booking;
    }

    // ── Step 5: AVAILABILITY RE-CHECK ──────────────────────
    // This happens IMMEDIATELY before the write to prevent race conditions.
    const available = await this.checkLocalAvailability(params.unitId, params.checkIn, params.checkOut);
    if (!available) {
      throw new ServiceError(
        "Unit is no longer available for the selected dates (availability re-check failed)",
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.AVAILABILITY_CHANGED
      );
    }

    // ── Step 6: GET UNIT FOR PRICING ───────────────────────
    const unit = await db.query.units.findFirst({
      where: eq(units.id, params.unitId),
    });
    if (!unit) throw new ServiceError("Unit not found", HTTP_STATUS.NOT_FOUND);

    const pricePerNight = brand === "MONTHLYKEY"
      ? Math.round((unit.monthlyPrice ?? 0) / 30)
      : (unit.dailyPrice ?? 0);
    const total = pricePerNight * nights;

    // ── Step 7: CREATE BOOKING IN LOCAL DB ─────────────────
    const [booking] = await db.insert(bookings).values({
      brand,
      unitId: params.unitId,
      guestName: params.guestName,
      guestEmail: params.guestEmail,
      guestPhone: params.guestPhone,
      checkIn,
      checkOut,
      nights,
      total,
      currency: unit.currency,
      status: "PENDING",
      paymentStatus: params.paymentMethod === "BANK_TRANSFER" ? "PENDING_BANK_TRANSFER" : "INITIATED",
      paymentMethod: params.paymentMethod,
      idempotencyKey,
      idempotencyHash: requestHash,
    }).returning();

    // ── Step 8: PUSH TO BEDS24 (if enabled) ────────────────
    if (isFeatureEnabled("beds24")) {
      try {
        // TODO: Call beds24 SDK to create booking
        logger.info(
          { bookingId: booking.id, brand, writer: "hub-api" },
          "Would push to Beds24 (integrated mode)"
        );
      } catch (err) {
        logger.error(
          { err, bookingId: booking.id },
          "Failed to push booking to Beds24 — booking saved locally"
        );
        // Don't fail the booking — it's saved in local DB
      }
    }

    // ── Step 9: CACHE IDEMPOTENCY RESPONSE ─────────────────
    const bookingResponse = this.toBookingResponse(booking);
    await db.insert(idempotencyStore).values({
      key: idempotencyKey,
      requestHash,
      responseStatus: HTTP_STATUS.CREATED,
      responseBody: bookingResponse as unknown as Record<string, unknown>,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
    }).onConflictDoNothing();

    logger.info(
      { bookingId: booking.id, brand, idempotencyKey, writer: "hub-api" },
      "Booking created (hub-api integrated mode)"
    );

    return bookingResponse;
  }

  // ═══════════════════════════════════════════════════════════
  //  Private Helpers
  // ═══════════════════════════════════════════════════════════

  private validateNights(brand: Brand, nights: number) {
    const rules = BRAND_RULES[brand];
    if (nights < rules.minNights || nights > rules.maxNights) {
      throw new ServiceError(
        `${brand} requires ${rules.minNights}-${rules.maxNights} nights, got ${nights}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.BRAND_RULE_VIOLATION
      );
    }
  }

  private async checkLocalAvailability(
    unitId: string,
    checkIn: string,
    checkOut: string
  ): Promise<boolean> {
    const overlapping = await db.query.bookings.findFirst({
      where: and(
        eq(bookings.unitId, unitId),
        not(inArray(bookings.status, ["CANCELLED", "NO_SHOW"])),
        lte(bookings.checkIn, new Date(checkOut)),
        gte(bookings.checkOut, new Date(checkIn))
      ),
    });
    return !overlapping;
  }

  private hashRequest(params: BookingCreateParams): string {
    return createHash("sha256").update(JSON.stringify(params)).digest("hex");
  }

  private toBookingResponse(row: typeof bookings.$inferSelect): Booking {
    return {
      id: row.id,
      brand: row.brand,
      unitId: row.unitId,
      beds24BookingId: row.beds24BookingId,
      guestName: row.guestName,
      guestEmail: row.guestEmail,
      guestPhone: row.guestPhone,
      checkIn: row.checkIn.toISOString().split("T")[0],
      checkOut: row.checkOut.toISOString().split("T")[0],
      nights: row.nights,
      total: row.total,
      currency: row.currency,
      status: row.status,
      paymentStatus: row.paymentStatus,
      paymentMethod: row.paymentMethod,
      idempotencyKey: row.idempotencyKey,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

// ═══════════════════════════════════════════════════════════
//  Error Classes
// ═══════════════════════════════════════════════════════════

export class ServiceError extends Error {
  public code: string;
  constructor(message: string, public statusCode: number, code?: string) {
    super(message);
    this.name = "ServiceError";
    this.code = code ?? "INTERNAL";
  }
}

export class WriterLockViolation extends Error {
  public statusCode = HTTP_STATUS.CONFLICT;
  public body: WriterLockError;
  constructor(body: WriterLockError) {
    super(body.message);
    this.name = "WriterLockViolation";
    this.body = body;
  }
}
