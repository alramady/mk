/**
 * ═══════════════════════════════════════════════════════════════
 *  Writer Lock — Automated Tests
 * ═══════════════════════════════════════════════════════════════
 *
 *  These tests prove the writer-lock invariant:
 *
 *    STANDALONE mode:
 *      ✅ Adapter POST /bookings → works (201)
 *      ❌ Hub-API POST /bookings → 409 WRITER_LOCK_VIOLATION
 *
 *    INTEGRATED mode:
 *      ❌ Adapter POST /bookings → 409 WRITER_LOCK_VIOLATION
 *      ✅ Hub-API POST /bookings → works (201)
 *
 *  Tests are pure unit tests — no Beds24 or DB required.
 *  They test the decision logic, not the full HTTP stack.
 *
 *  Run: npx vitest run tests/writer-lock.test.ts
 * ═══════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from "vitest";
import {
  isWriterAllowed,
  getDesignatedWriter,
  WRITER_LOCK,
  ERROR_CODES,
  HTTP_STATUS,
  BRAND_RULES,
} from "@mk/shared";
import type { Brand, OperationMode, WriterLockError } from "@mk/shared";

// ═══════════════════════════════════════════════════════════
//  1. Shared Foundation Tests — isWriterAllowed / getDesignatedWriter
// ═══════════════════════════════════════════════════════════

describe("WRITER_LOCK constant", () => {
  it("standalone mode designates adapter as writer", () => {
    expect(WRITER_LOCK.standalone.writer).toBe("adapter");
    expect(WRITER_LOCK.standalone.rejector).toBe("hub-api");
  });

  it("integrated mode designates hub-api as writer", () => {
    expect(WRITER_LOCK.integrated.writer).toBe("hub-api");
    expect(WRITER_LOCK.integrated.rejector).toBe("adapter");
  });
});

describe("getDesignatedWriter()", () => {
  it("returns 'adapter' for standalone mode", () => {
    expect(getDesignatedWriter("standalone")).toBe("adapter");
  });

  it("returns 'hub-api' for integrated mode", () => {
    expect(getDesignatedWriter("integrated")).toBe("hub-api");
  });
});

describe("isWriterAllowed()", () => {
  // ── Standalone mode ──────────────────────────────────────
  it("standalone: adapter IS allowed to write", () => {
    expect(isWriterAllowed("standalone", "adapter")).toBe(true);
  });

  it("standalone: hub-api is NOT allowed to write", () => {
    expect(isWriterAllowed("standalone", "hub-api")).toBe(false);
  });

  // ── Integrated mode ──────────────────────────────────────
  it("integrated: hub-api IS allowed to write", () => {
    expect(isWriterAllowed("integrated", "hub-api")).toBe(true);
  });

  it("integrated: adapter is NOT allowed to write", () => {
    expect(isWriterAllowed("integrated", "adapter")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
//  2. Adapter-Side Writer Lock Simulation
//     Simulates the exact guard logic from adapter code
// ═══════════════════════════════════════════════════════════

/**
 * Simulates the adapter's POST /bookings route guard.
 * This is the exact logic from:
 *   services/cobnb-adapter-api/src/index.ts:268-272
 *   services/monthlykey-adapter-api/src/index.ts:266-270
 */
function simulateAdapterBookingCreate(
  brand: Brand,
  mode: OperationMode
): { status: number; body: WriterLockError | { id: string; writer: string } } {
  const ADAPTER_IS_WRITER = isWriterAllowed(mode, "adapter");
  const DESIGNATED_WRITER = getDesignatedWriter(mode);

  // This is the exact guard from the adapter code
  if (!ADAPTER_IS_WRITER) {
    return {
      status: HTTP_STATUS.CONFLICT, // 409
      body: {
        code: ERROR_CODES.WRITER_LOCK_VIOLATION,
        message: `Booking writes for ${brand} are locked to ${DESIGNATED_WRITER}.`,
        brand,
        mode,
        designatedWriter: DESIGNATED_WRITER,
        rejectedBy: "adapter",
      },
    };
  }

  // Adapter would write to Beds24 here
  return {
    status: HTTP_STATUS.CREATED, // 201
    body: { id: "booking-123", writer: "adapter" },
  };
}

describe("Adapter-side writer lock (CoBnB)", () => {
  it("STANDALONE: adapter POST /bookings → 201 (adapter writes to Beds24)", () => {
    const result = simulateAdapterBookingCreate("COBNB", "standalone");
    expect(result.status).toBe(201);
    expect((result.body as any).writer).toBe("adapter");
  });

  it("INTEGRATED: adapter POST /bookings → 409 WRITER_LOCK_VIOLATION", () => {
    const result = simulateAdapterBookingCreate("COBNB", "integrated");
    expect(result.status).toBe(409);
    const body = result.body as WriterLockError;
    expect(body.code).toBe("WRITER_LOCK_VIOLATION");
    expect(body.brand).toBe("COBNB");
    expect(body.mode).toBe("integrated");
    expect(body.designatedWriter).toBe("hub-api");
    expect(body.rejectedBy).toBe("adapter");
  });
});

describe("Adapter-side writer lock (MonthlyKey)", () => {
  it("STANDALONE: adapter POST /bookings → 201 (adapter writes to Beds24)", () => {
    const result = simulateAdapterBookingCreate("MONTHLYKEY", "standalone");
    expect(result.status).toBe(201);
    expect((result.body as any).writer).toBe("adapter");
  });

  it("INTEGRATED: adapter POST /bookings → 409 WRITER_LOCK_VIOLATION", () => {
    const result = simulateAdapterBookingCreate("MONTHLYKEY", "integrated");
    expect(result.status).toBe(409);
    const body = result.body as WriterLockError;
    expect(body.code).toBe("WRITER_LOCK_VIOLATION");
    expect(body.brand).toBe("MONTHLYKEY");
    expect(body.mode).toBe("integrated");
    expect(body.designatedWriter).toBe("hub-api");
    expect(body.rejectedBy).toBe("adapter");
  });
});

// ═══════════════════════════════════════════════════════════
//  3. Hub-API Side Writer Lock Simulation
//     Simulates the exact guard logic from hub-api
// ═══════════════════════════════════════════════════════════

/**
 * Simulates hub-api's BookingService.create() writer-lock check.
 * This is the exact logic from:
 *   services/hub-api/src/config.ts:82-90 (hubIsWriter, hubShouldRejectWrites)
 *   services/hub-api/src/services/booking-service.ts:91-110
 */
function simulateHubBookingCreate(
  brand: Brand,
  brandMode: OperationMode
): { status: number; body: WriterLockError | { id: string; writer: string } } {
  // This mirrors hubShouldRejectWrites() from config.ts:88-90
  const hubIsWriter = isWriterAllowed(brandMode, "hub-api");
  const hubShouldReject = !hubIsWriter;

  if (hubShouldReject) {
    const writer = getDesignatedWriter(brandMode);
    return {
      status: HTTP_STATUS.CONFLICT, // 409
      body: {
        code: ERROR_CODES.WRITER_LOCK_VIOLATION,
        message:
          `Hub-API cannot write bookings for ${brand} because it is in ${brandMode} mode. ` +
          `The designated writer is: ${writer} (the adapter).`,
        brand,
        mode: brandMode,
        designatedWriter: writer,
        rejectedBy: "hub-api",
      },
    };
  }

  // Hub would write to local DB + Beds24 here
  return {
    status: HTTP_STATUS.CREATED, // 201
    body: { id: "booking-456", writer: "hub-api" },
  };
}

describe("Hub-API side writer lock (CoBnB)", () => {
  it("STANDALONE: hub POST /bookings → 409 WRITER_LOCK_VIOLATION", () => {
    const result = simulateHubBookingCreate("COBNB", "standalone");
    expect(result.status).toBe(409);
    const body = result.body as WriterLockError;
    expect(body.code).toBe("WRITER_LOCK_VIOLATION");
    expect(body.brand).toBe("COBNB");
    expect(body.mode).toBe("standalone");
    expect(body.designatedWriter).toBe("adapter");
    expect(body.rejectedBy).toBe("hub-api");
  });

  it("INTEGRATED: hub POST /bookings → 201 (hub writes to DB + Beds24)", () => {
    const result = simulateHubBookingCreate("COBNB", "integrated");
    expect(result.status).toBe(201);
    expect((result.body as any).writer).toBe("hub-api");
  });
});

describe("Hub-API side writer lock (MonthlyKey)", () => {
  it("STANDALONE: hub POST /bookings → 409 WRITER_LOCK_VIOLATION", () => {
    const result = simulateHubBookingCreate("MONTHLYKEY", "standalone");
    expect(result.status).toBe(409);
    const body = result.body as WriterLockError;
    expect(body.code).toBe("WRITER_LOCK_VIOLATION");
    expect(body.brand).toBe("MONTHLYKEY");
    expect(body.mode).toBe("standalone");
    expect(body.designatedWriter).toBe("adapter");
    expect(body.rejectedBy).toBe("hub-api");
  });

  it("INTEGRATED: hub POST /bookings → 201 (hub writes to DB + Beds24)", () => {
    const result = simulateHubBookingCreate("MONTHLYKEY", "integrated");
    expect(result.status).toBe(201);
    expect((result.body as any).writer).toBe("hub-api");
  });
});

// ═══════════════════════════════════════════════════════════
//  4. Cross-Validation: Exactly ONE writer per brand
// ═══════════════════════════════════════════════════════════

describe("Writer lock invariant: exactly ONE writer per brand", () => {
  const brands: Brand[] = ["COBNB", "MONTHLYKEY"];
  const modes: OperationMode[] = ["standalone", "integrated"];

  for (const brand of brands) {
    for (const mode of modes) {
      it(`${brand} in ${mode} mode: exactly one writer, never zero, never two`, () => {
        const adapterCanWrite = isWriterAllowed(mode, "adapter");
        const hubCanWrite = isWriterAllowed(mode, "hub-api");

        // XOR: exactly one must be true
        expect(adapterCanWrite !== hubCanWrite).toBe(true);

        // Verify the designated writer matches
        const designated = getDesignatedWriter(mode);
        if (adapterCanWrite) {
          expect(designated).toBe("adapter");
        } else {
          expect(designated).toBe("hub-api");
        }
      });
    }
  }
});

// ═══════════════════════════════════════════════════════════
//  5. Full Matrix: Both sides reject/accept correctly
// ═══════════════════════════════════════════════════════════

describe("Full writer-lock matrix", () => {
  it("COBNB standalone: adapter=201, hub=409", () => {
    const adapter = simulateAdapterBookingCreate("COBNB", "standalone");
    const hub = simulateHubBookingCreate("COBNB", "standalone");
    expect(adapter.status).toBe(201);
    expect(hub.status).toBe(409);
  });

  it("COBNB integrated: adapter=409, hub=201", () => {
    const adapter = simulateAdapterBookingCreate("COBNB", "integrated");
    const hub = simulateHubBookingCreate("COBNB", "integrated");
    expect(adapter.status).toBe(409);
    expect(hub.status).toBe(201);
  });

  it("MONTHLYKEY standalone: adapter=201, hub=409", () => {
    const adapter = simulateAdapterBookingCreate("MONTHLYKEY", "standalone");
    const hub = simulateHubBookingCreate("MONTHLYKEY", "standalone");
    expect(adapter.status).toBe(201);
    expect(hub.status).toBe(409);
  });

  it("MONTHLYKEY integrated: adapter=409, hub=201", () => {
    const adapter = simulateAdapterBookingCreate("MONTHLYKEY", "integrated");
    const hub = simulateHubBookingCreate("MONTHLYKEY", "integrated");
    expect(adapter.status).toBe(409);
    expect(hub.status).toBe(201);
  });
});

// ═══════════════════════════════════════════════════════════
//  6. Error Response Shape Validation
// ═══════════════════════════════════════════════════════════

describe("WriterLockError response shape", () => {
  it("409 response includes all required fields", () => {
    const result = simulateAdapterBookingCreate("COBNB", "integrated");
    expect(result.status).toBe(409);

    const body = result.body as WriterLockError;
    expect(body).toHaveProperty("code", "WRITER_LOCK_VIOLATION");
    expect(body).toHaveProperty("message");
    expect(body).toHaveProperty("brand");
    expect(body).toHaveProperty("mode");
    expect(body).toHaveProperty("designatedWriter");
    expect(body).toHaveProperty("rejectedBy");
    expect(typeof body.message).toBe("string");
    expect(body.message.length).toBeGreaterThan(0);
  });

  it("adapter rejection says rejectedBy=adapter", () => {
    const result = simulateAdapterBookingCreate("COBNB", "integrated");
    expect((result.body as WriterLockError).rejectedBy).toBe("adapter");
  });

  it("hub rejection says rejectedBy=hub-api", () => {
    const result = simulateHubBookingCreate("COBNB", "standalone");
    expect((result.body as WriterLockError).rejectedBy).toBe("hub-api");
  });
});

// ═══════════════════════════════════════════════════════════
//  7. Brand Rules Validation
// ═══════════════════════════════════════════════════════════

describe("Brand rules", () => {
  it("COBNB allows 1-27 nights", () => {
    expect(BRAND_RULES.COBNB.minNights).toBe(1);
    expect(BRAND_RULES.COBNB.maxNights).toBe(27);
  });

  it("MONTHLYKEY allows 28-365 nights", () => {
    expect(BRAND_RULES.MONTHLYKEY.minNights).toBe(28);
    expect(BRAND_RULES.MONTHLYKEY.maxNights).toBe(365);
  });

  it("brands have no gap and no overlap in night ranges", () => {
    expect(BRAND_RULES.COBNB.maxNights + 1).toBe(BRAND_RULES.MONTHLYKEY.minNights);
  });
});

// ═══════════════════════════════════════════════════════════
//  8. HTTP Status Code Constants
// ═══════════════════════════════════════════════════════════

describe("HTTP_STATUS constants used in writer lock", () => {
  it("CONFLICT is 409", () => {
    expect(HTTP_STATUS.CONFLICT).toBe(409);
  });

  it("CREATED is 201", () => {
    expect(HTTP_STATUS.CREATED).toBe(201);
  });

  it("BAD_REQUEST is 400", () => {
    expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
  });
});
