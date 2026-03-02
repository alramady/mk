/**
 * beds24-sync.ts — Full Beds24 ↔ MonthlyKey sync engine
 * 
 * Responsibilities:
 * 1. Beds24 API v2 client (auth, bookings, calendar)
 * 2. Inbound sync: Beds24 → MK (import reservations as bookings + availability_blocks)
 * 3. Outbound sync: MK → Beds24 (push blocks when MK booking becomes active/cancelled)
 * 4. Reconciliation: compare Beds24 vs MK and surface mismatches
 * 5. Integration logging: every API call logged to integration_logs
 */

import { getPool } from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// ─── Types ──────────────────────────────────────────────────────────

interface Beds24Config {
  apiUrl: string;
  refreshToken: string;
}

interface Beds24Token {
  token: string;
  expiresAt: number; // epoch ms
}

export interface Beds24Booking {
  id: number;
  propertyId: number;
  roomId: number;
  unitId?: number;
  status: "confirmed" | "request" | "new" | "cancelled" | "black" | "inquiry";
  arrival: string;   // YYYY-MM-DD
  departure: string; // YYYY-MM-DD
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  numAdult?: number;
  numChild?: number;
  price?: number;
  deposit?: number;
  tax?: number;
  commission?: number;
  apiSource?: string;
  apiSourceId?: number;
  channel?: string;
  apiReference?: string;
  comments?: string;
  notes?: string;
  bookingTime?: string;
  modifiedTime?: string;
  cancelTime?: string;
}

export interface SyncResult {
  created: number;
  updated: number;
  cancelled: number;
  skipped: number;
  errors: string[];
}

export interface ReconciliationMismatch {
  type: "MISSING_IN_MK" | "MISSING_IN_BEDS24" | "STATUS_MISMATCH" | "DATE_MISMATCH";
  beds24BookingId?: number;
  mkBookingId?: number;
  beds24Status?: string;
  mkStatus?: string;
  beds24Dates?: { arrival: string; departure: string };
  mkDates?: { moveIn: string; moveOut: string };
  description: string;
}

export interface ReconciliationReport {
  runAt: string;
  totalBeds24: number;
  totalMK: number;
  mismatches: ReconciliationMismatch[];
  syncedOk: number;
}

// ─── Beds24 API Client ──────────────────────────────────────────────

let _cachedToken: Beds24Token | null = null;

function getBeds24Config(): Beds24Config | null {
  const apiUrl = process.env.BEDS24_API_URL || "https://beds24.com/api/v2";
  const refreshToken = process.env.BEDS24_REFRESH_TOKEN;
  if (!refreshToken) return null;
  return { apiUrl, refreshToken };
}

async function getConfigFromDb(): Promise<Beds24Config | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT configJson FROM integration_configs WHERE integrationKey = 'beds24' AND isEnabled = 1 LIMIT 1"
    );
    if (!rows[0]) return null;
    const config = typeof rows[0].configJson === "string"
      ? JSON.parse(rows[0].configJson)
      : rows[0].configJson;
    const apiUrl = config.apiUrl || process.env.BEDS24_API_URL || "https://beds24.com/api/v2";
    const refreshToken = config.refreshToken || process.env.BEDS24_REFRESH_TOKEN;
    if (!refreshToken) return null;
    return { apiUrl, refreshToken };
  } catch {
    return getBeds24Config();
  }
}

async function getAuthToken(): Promise<string | null> {
  // Return cached token if still valid (with 5min buffer)
  if (_cachedToken && _cachedToken.expiresAt > Date.now() + 300_000) {
    return _cachedToken.token;
  }
  const config = await getConfigFromDb();
  if (!config) return null;

  try {
    const resp = await fetch(`${config.apiUrl}/authentication/token`, {
      headers: { "token": config.refreshToken },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) {
      console.error(`[Beds24] Auth failed: ${resp.status} ${resp.statusText}`);
      return null;
    }
    const data = await resp.json();
    _cachedToken = {
      token: data.token,
      expiresAt: Date.now() + (data.expiresIn || 3600) * 1000,
    };
    return _cachedToken.token;
  } catch (e: any) {
    console.error(`[Beds24] Auth error: ${e.message}`);
    return null;
  }
}

async function beds24Fetch(path: string, options: RequestInit = {}): Promise<any> {
  const config = await getConfigFromDb();
  if (!config) throw new Error("Beds24 not configured");

  const token = await getAuthToken();
  if (!token) throw new Error("Failed to get Beds24 auth token");

  const url = `${config.apiUrl}${path}`;
  const start = Date.now();
  let status: "SUCCESS" | "FAILED" = "SUCCESS";
  let errorMessage: string | undefined;
  let responseData: any;

  try {
    const resp = await fetch(url, {
      ...options,
      headers: {
        "token": token,
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: AbortSignal.timeout(30_000),
    });

    responseData = await resp.json();
    if (!resp.ok || responseData.success === false) {
      status = "FAILED";
      errorMessage = `HTTP ${resp.status}: ${JSON.stringify(responseData).substring(0, 500)}`;
      throw new Error(errorMessage);
    }
    return responseData;
  } catch (e: any) {
    status = "FAILED";
    errorMessage = e.message;
    throw e;
  } finally {
    // Log the API call
    await logIntegration({
      direction: options.method === "POST" ? "OUTBOUND" : "INBOUND",
      action: `${options.method || "GET"} ${path}`,
      status,
      errorMessage,
      durationMs: Date.now() - start,
      requestPayload: options.body ? JSON.parse(options.body as string) : undefined,
      responsePayload: responseData ? JSON.stringify(responseData).substring(0, 5000) : undefined,
    });
  }
}

// ─── Integration Logging ────────────────────────────────────────────

async function logIntegration(params: {
  direction: "INBOUND" | "OUTBOUND" | "RECONCILE";
  action: string;
  entityType?: string;
  entityId?: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  errorMessage?: string;
  durationMs?: number;
  requestPayload?: any;
  responsePayload?: any;
}): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.execute(
      `INSERT INTO integration_logs (integrationKey, direction, action, entityType, entityId, requestPayload, responsePayload, status, errorMessage, durationMs)
       VALUES ('beds24', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.direction,
        params.action,
        params.entityType || null,
        params.entityId || null,
        params.requestPayload ? JSON.stringify(params.requestPayload) : null,
        params.responsePayload ? (typeof params.responsePayload === "string" ? params.responsePayload : JSON.stringify(params.responsePayload)) : null,
        params.status,
        params.errorMessage || null,
        params.durationMs || null,
      ]
    );
  } catch (e: any) {
    console.error(`[Beds24] Failed to log integration:`, e.message);
  }
}

// ─── Inbound Sync: Beds24 → MonthlyKey ─────────────────────────────

/**
 * Fetch bookings from Beds24 for all mapped properties/rooms and import them.
 * Uses modifiedFrom for incremental sync.
 */
export async function syncInbound(options?: {
  modifiedFrom?: string; // ISO datetime
  propertyId?: number;   // Beds24 property ID
  fullSync?: boolean;    // Ignore modifiedFrom, get all
}): Promise<SyncResult> {
  const pool = getPool();
  if (!pool) throw new Error("Database not available");

  const result: SyncResult = { created: 0, updated: 0, cancelled: 0, skipped: 0, errors: [] };

  // Get all Beds24 mappings with sourceOfTruth = 'BEDS24' and connectionType = 'API'
  const [mappings] = await pool.query<RowDataPacket[]>(
    `SELECT bm.*, u.propertyId as mkPropertyId
     FROM beds24_map bm
     LEFT JOIN units u ON bm.unitId = u.id
     WHERE bm.connectionType = 'API' AND bm.sourceOfTruth = 'BEDS24'
     ${options?.propertyId ? "AND bm.beds24PropertyId = ?" : ""}`,
    options?.propertyId ? [String(options.propertyId)] : []
  );

  if (mappings.length === 0) {
    result.errors.push("No API mappings with sourceOfTruth=BEDS24 found");
    return result;
  }

  // Group mappings by Beds24 propertyId for batch fetching
  const byProperty = new Map<string, RowDataPacket[]>();
  for (const m of mappings) {
    const key = m.beds24PropertyId;
    if (!key) continue;
    if (!byProperty.has(key)) byProperty.set(key, []);
    byProperty.get(key)!.push(m);
  }

  for (const [beds24PropId, propMappings] of byProperty) {
    try {
      // Build query params
      const params = new URLSearchParams();
      params.set("propertyId", beds24PropId);
      params.set("status", "confirmed,request,new,cancelled");
      if (!options?.fullSync && options?.modifiedFrom) {
        params.set("modifiedFrom", options.modifiedFrom);
      } else if (!options?.fullSync) {
        // Default: last 24 hours
        const yesterday = new Date(Date.now() - 86400_000).toISOString().replace("Z", "");
        params.set("modifiedFrom", yesterday);
      }

      const data = await beds24Fetch(`/bookings?${params.toString()}`);
      const bookings: Beds24Booking[] = data.data || [];

      for (const b24 of bookings) {
        try {
          // Find the mapping for this room
          const mapping = propMappings.find(m => String(m.beds24RoomId) === String(b24.roomId));
          if (!mapping) {
            result.skipped++;
            continue;
          }

          await importSingleBooking(b24, mapping);

          if (b24.status === "cancelled") {
            result.cancelled++;
          } else {
            // Check if this booking already exists
            const [existing] = await pool.query<RowDataPacket[]>(
              "SELECT id FROM bookings WHERE externalReservationId = ?",
              [`beds24:${b24.id}`]
            );
            if (existing[0]) {
              result.updated++;
            } else {
              result.created++;
            }
          }
        } catch (e: any) {
          result.errors.push(`Booking ${b24.id}: ${e.message}`);
        }
      }

      // Update sync status for all mappings in this property
      for (const m of propMappings) {
        await pool.execute(
          "UPDATE beds24_map SET lastSyncedAt = NOW(), lastSyncStatus = 'SUCCESS' WHERE id = ?",
          [m.id]
        );
      }
    } catch (e: any) {
      result.errors.push(`Property ${beds24PropId}: ${e.message}`);
      for (const m of propMappings) {
        await pool.execute(
          "UPDATE beds24_map SET lastSyncedAt = NOW(), lastSyncStatus = 'FAILED', lastSyncError = ? WHERE id = ?",
          [e.message, m.id]
        );
      }
    }
  }

  await logIntegration({
    direction: "INBOUND",
    action: "syncInbound",
    status: result.errors.length > 0 ? "FAILED" : "SUCCESS",
    errorMessage: result.errors.length > 0 ? result.errors.join("; ") : undefined,
    responsePayload: result,
  });

  return result;
}

async function importSingleBooking(b24: Beds24Booking, mapping: RowDataPacket): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  const externalId = `beds24:${b24.id}`;
  const guestName = [b24.firstName, b24.lastName].filter(Boolean).join(" ") || "Beds24 Guest";

  // Check if booking already exists
  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT id, status FROM bookings WHERE externalReservationId = ?",
    [externalId]
  );

  if (b24.status === "cancelled") {
    // If exists in MK, cancel it
    if (existing[0]) {
      await pool.execute(
        "UPDATE bookings SET status = 'cancelled', updatedAt = NOW() WHERE id = ?",
        [existing[0].id]
      );
      // Cancel the availability block
      try {
        const { cancelBookingBlock } = await import("./availability-blocks.js");
        await cancelBookingBlock(existing[0].id, "Cancelled in Beds24");
      } catch { /* block may not exist */ }
    }
    return;
  }

  // Map Beds24 status to MK status
  const mkStatus = b24.status === "confirmed" ? "approved" : "pending";

  if (existing[0]) {
    // Update existing booking
    await pool.execute(
      `UPDATE bookings SET
        status = ?, moveInDate = ?, moveOutDate = ?,
        totalAmount = ?, updatedAt = NOW()
       WHERE id = ?`,
      [mkStatus, b24.arrival, b24.departure, b24.price || 0, existing[0].id]
    );

    // Update availability block dates if changed
    try {
      const { cancelBookingBlock, createBookingBlock } = await import("./availability-blocks.js");
      await cancelBookingBlock(existing[0].id, "Dates updated from Beds24");
      await createBookingBlock({
        propertyId: mapping.mkPropertyId || mapping.propertyId,
        unitId: mapping.unitId,
        bookingId: existing[0].id,
        startDate: b24.arrival,
        endDate: b24.departure,
        source: "BEDS24",
      });
    } catch { /* best effort */ }
  } else {
    // Create new booking
    // Find or create a guest user for this Beds24 booking
    let tenantId = 1; // Default system user
    if (b24.email) {
      const [userRows] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE email = ? LIMIT 1",
        [b24.email]
      );
      if (userRows[0]) {
        tenantId = userRows[0].id;
      }
    }

    // Calculate duration in months (approximate)
    const arrDate = new Date(b24.arrival);
    const depDate = new Date(b24.departure);
    const durationDays = Math.ceil((depDate.getTime() - arrDate.getTime()) / 86400_000);
    const durationMonths = Math.max(1, Math.round(durationDays / 30));

    const [insertResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO bookings (
        propertyId, tenantId, status, moveInDate, moveOutDate,
        durationMonths, monthlyRent, totalAmount, source,
        beds24BookingId, externalReservationId, unitId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BEDS24', ?, ?, ?, NOW(), NOW())`,
      [
        mapping.mkPropertyId || mapping.propertyId || 0,
        tenantId,
        mkStatus,
        b24.arrival,
        b24.departure,
        durationMonths,
        b24.price ? Math.round((b24.price / durationMonths) * 100) / 100 : 0,
        b24.price || 0,
        String(b24.id),
        externalId,
        mapping.unitId,
      ]
    );

    // Create availability block
    try {
      const { createBookingBlock } = await import("./availability-blocks.js");
      await createBookingBlock({
        propertyId: mapping.mkPropertyId || mapping.propertyId,
        unitId: mapping.unitId,
        bookingId: insertResult.insertId,
        startDate: b24.arrival,
        endDate: b24.departure,
        source: "BEDS24",
      });
    } catch (e: any) {
      console.error(`[Beds24] Failed to create availability block for booking ${b24.id}:`, e.message);
    }
  }
}

// ─── Outbound Sync: MonthlyKey → Beds24 ────────────────────────────

/**
 * Push a booking block to Beds24 when a MK booking becomes active.
 * This creates a booking in Beds24 to block the dates.
 */
export async function pushBookingToBeds24(bookingId: number): Promise<{ success: boolean; beds24BookingId?: number; error?: string }> {
  const pool = getPool();
  if (!pool) return { success: false, error: "Database not available" };

  try {
    // Get the booking details
    const [bookingRows] = await pool.query<RowDataPacket[]>(
      `SELECT b.*, u.unitNumber
       FROM bookings b
       LEFT JOIN units u ON b.unitId = u.id
       WHERE b.id = ?`,
      [bookingId]
    );
    const booking = bookingRows[0];
    if (!booking) return { success: false, error: "Booking not found" };

    // Skip if already from Beds24 (avoid loop)
    if (booking.source === "BEDS24") {
      return { success: true, beds24BookingId: parseInt(booking.beds24BookingId) };
    }

    // Get the Beds24 mapping for this unit/property
    const unitId = booking.unitId;
    if (!unitId) return { success: false, error: "No unitId on booking" };

    const [mappingRows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM beds24_map WHERE unitId = ? AND connectionType = 'API' AND sourceOfTruth = 'LOCAL'",
      [unitId]
    );
    const mapping = mappingRows[0];
    if (!mapping) {
      // No outbound mapping — this is fine, just skip
      return { success: true };
    }

    // Get tenant info
    const [tenantRows] = await pool.query<RowDataPacket[]>(
      "SELECT firstName, lastName, email, phone FROM users WHERE id = ?",
      [booking.tenantId]
    );
    const tenant = tenantRows[0] || {};

    const moveIn = booking.moveInDate ? new Date(booking.moveInDate).toISOString().split("T")[0] : null;
    const moveOut = booking.moveOutDate ? new Date(booking.moveOutDate).toISOString().split("T")[0] : null;
    if (!moveIn || !moveOut) return { success: false, error: "Missing dates" };

    // Create booking in Beds24
    const beds24Payload = [{
      propertyId: parseInt(mapping.beds24PropertyId),
      roomId: parseInt(mapping.beds24RoomId),
      arrival: moveIn,
      departure: moveOut,
      firstName: tenant.firstName || "MK Guest",
      lastName: tenant.lastName || "",
      email: tenant.email || "",
      phone: tenant.phone || "",
      status: "confirmed",
      price: parseFloat(booking.totalAmount) || 0,
      apiReference: `MK-${bookingId}`,
      notes: `MonthlyKey Booking #${bookingId}`,
    }];

    const resp = await beds24Fetch("/bookings", {
      method: "POST",
      body: JSON.stringify(beds24Payload),
    });

    // Extract the created booking ID
    const createdId = resp.data?.[0]?.id;
    if (createdId) {
      await pool.execute(
        "UPDATE bookings SET beds24BookingId = ? WHERE id = ?",
        [String(createdId), bookingId]
      );
    }

    await logIntegration({
      direction: "OUTBOUND",
      action: "pushBookingToBeds24",
      entityType: "booking",
      entityId: String(bookingId),
      status: "SUCCESS",
      responsePayload: resp,
    });

    return { success: true, beds24BookingId: createdId };
  } catch (e: any) {
    await logIntegration({
      direction: "OUTBOUND",
      action: "pushBookingToBeds24",
      entityType: "booking",
      entityId: String(bookingId),
      status: "FAILED",
      errorMessage: e.message,
    });
    return { success: false, error: e.message };
  }
}

/**
 * Cancel a booking in Beds24 when a MK booking is cancelled.
 */
export async function cancelBookingInBeds24(bookingId: number): Promise<{ success: boolean; error?: string }> {
  const pool = getPool();
  if (!pool) return { success: false, error: "Database not available" };

  try {
    const [bookingRows] = await pool.query<RowDataPacket[]>(
      "SELECT beds24BookingId, source FROM bookings WHERE id = ?",
      [bookingId]
    );
    const booking = bookingRows[0];
    if (!booking?.beds24BookingId) return { success: true }; // Nothing to cancel

    // Skip if booking came from Beds24 (it was already cancelled there)
    if (booking.source === "BEDS24") return { success: true };

    const beds24Id = parseInt(booking.beds24BookingId);
    if (isNaN(beds24Id)) return { success: false, error: "Invalid beds24BookingId" };

    // Update the booking status in Beds24
    await beds24Fetch("/bookings", {
      method: "POST",
      body: JSON.stringify([{
        id: beds24Id,
        status: "cancelled",
      }]),
    });

    await logIntegration({
      direction: "OUTBOUND",
      action: "cancelBookingInBeds24",
      entityType: "booking",
      entityId: String(bookingId),
      status: "SUCCESS",
    });

    return { success: true };
  } catch (e: any) {
    await logIntegration({
      direction: "OUTBOUND",
      action: "cancelBookingInBeds24",
      entityType: "booking",
      entityId: String(bookingId),
      status: "FAILED",
      errorMessage: e.message,
    });
    return { success: false, error: e.message };
  }
}

// ─── Reconciliation ─────────────────────────────────────────────────

/**
 * Compare Beds24 bookings with MK bookings and surface mismatches.
 */
export async function reconcile(options?: {
  propertyId?: number; // Beds24 property ID
  daysAhead?: number;  // How many days ahead to check (default 90)
}): Promise<ReconciliationReport> {
  const pool = getPool();
  if (!pool) throw new Error("Database not available");

  const report: ReconciliationReport = {
    runAt: new Date().toISOString(),
    totalBeds24: 0,
    totalMK: 0,
    mismatches: [],
    syncedOk: 0,
  };

  const daysAhead = options?.daysAhead || 90;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + daysAhead);
  const cutoff = cutoffDate.toISOString().split("T")[0];

  // Get all API mappings
  const [mappings] = await pool.query<RowDataPacket[]>(
    `SELECT bm.*, u.propertyId as mkPropertyId
     FROM beds24_map bm
     LEFT JOIN units u ON bm.unitId = u.id
     WHERE bm.connectionType = 'API'
     ${options?.propertyId ? "AND bm.beds24PropertyId = ?" : ""}`,
    options?.propertyId ? [String(options.propertyId)] : []
  );

  if (mappings.length === 0) {
    return report;
  }

  // Fetch all Beds24 bookings
  const beds24Bookings = new Map<number, Beds24Booking>();
  const beds24PropIds = [...new Set(mappings.map(m => m.beds24PropertyId).filter(Boolean))];

  for (const propId of beds24PropIds) {
    try {
      const params = new URLSearchParams();
      params.set("propertyId", propId);
      params.set("departureTo", cutoff);
      params.set("status", "confirmed,request,new");
      const data = await beds24Fetch(`/bookings?${params.toString()}`);
      for (const b of (data.data || [])) {
        beds24Bookings.set(b.id, b);
      }
    } catch (e: any) {
      report.mismatches.push({
        type: "MISSING_IN_MK",
        description: `Failed to fetch Beds24 property ${propId}: ${e.message}`,
      });
    }
  }

  report.totalBeds24 = beds24Bookings.size;

  // Get all MK bookings with Beds24 source or beds24BookingId
  const mkPropertyIds = mappings.map(m => m.mkPropertyId).filter(Boolean);
  if (mkPropertyIds.length === 0) return report;

  const placeholders = mkPropertyIds.map(() => "?").join(",");
  const [mkBookings] = await pool.query<RowDataPacket[]>(
    `SELECT id, propertyId, unitId, status, moveInDate, moveOutDate, beds24BookingId, externalReservationId, source
     FROM bookings
     WHERE propertyId IN (${placeholders})
     AND moveOutDate >= CURDATE()
     AND moveOutDate <= ?
     AND status NOT IN ('cancelled')`,
    [...mkPropertyIds, cutoff]
  );

  report.totalMK = mkBookings.length;

  // Build lookup maps
  const mkByExtId = new Map<string, RowDataPacket>();
  const mkByBeds24Id = new Map<string, RowDataPacket>();
  for (const mk of mkBookings) {
    if (mk.externalReservationId) mkByExtId.set(mk.externalReservationId, mk);
    if (mk.beds24BookingId) mkByBeds24Id.set(mk.beds24BookingId, mk);
  }

  // Check each Beds24 booking against MK
  for (const [b24Id, b24] of beds24Bookings) {
    const extId = `beds24:${b24Id}`;
    const mkBooking = mkByExtId.get(extId) || mkByBeds24Id.get(String(b24Id));

    if (!mkBooking) {
      report.mismatches.push({
        type: "MISSING_IN_MK",
        beds24BookingId: b24Id,
        beds24Status: b24.status,
        beds24Dates: { arrival: b24.arrival, departure: b24.departure },
        description: `Beds24 booking #${b24Id} (${b24.arrival} → ${b24.departure}) not found in MK`,
      });
      continue;
    }

    // Check status match
    const expectedMkStatus = b24.status === "confirmed" ? "approved" : "pending";
    const mkStatus = mkBooking.status;
    if (mkStatus !== expectedMkStatus && mkStatus !== "active") {
      report.mismatches.push({
        type: "STATUS_MISMATCH",
        beds24BookingId: b24Id,
        mkBookingId: mkBooking.id,
        beds24Status: b24.status,
        mkStatus,
        description: `Status mismatch: Beds24=${b24.status} → expected MK=${expectedMkStatus}, actual MK=${mkStatus}`,
      });
      continue;
    }

    // Check date match
    const mkMoveIn = mkBooking.moveInDate ? new Date(mkBooking.moveInDate).toISOString().split("T")[0] : "";
    const mkMoveOut = mkBooking.moveOutDate ? new Date(mkBooking.moveOutDate).toISOString().split("T")[0] : "";
    if (mkMoveIn !== b24.arrival || mkMoveOut !== b24.departure) {
      report.mismatches.push({
        type: "DATE_MISMATCH",
        beds24BookingId: b24Id,
        mkBookingId: mkBooking.id,
        beds24Dates: { arrival: b24.arrival, departure: b24.departure },
        mkDates: { moveIn: mkMoveIn, moveOut: mkMoveOut },
        description: `Date mismatch: Beds24=${b24.arrival}→${b24.departure}, MK=${mkMoveIn}→${mkMoveOut}`,
      });
      continue;
    }

    report.syncedOk++;
  }

  // Check MK bookings that should be in Beds24 (outbound check)
  for (const mk of mkBookings) {
    if (mk.source === "BEDS24") continue; // Already checked above
    if (!mk.beds24BookingId) continue; // Not pushed to Beds24

    const b24Id = parseInt(mk.beds24BookingId);
    if (!beds24Bookings.has(b24Id)) {
      report.mismatches.push({
        type: "MISSING_IN_BEDS24",
        mkBookingId: mk.id,
        mkStatus: mk.status,
        mkDates: {
          moveIn: mk.moveInDate ? new Date(mk.moveInDate).toISOString().split("T")[0] : "",
          moveOut: mk.moveOutDate ? new Date(mk.moveOutDate).toISOString().split("T")[0] : "",
        },
        description: `MK booking #${mk.id} has beds24BookingId=${mk.beds24BookingId} but not found in Beds24`,
      });
    }
  }

  await logIntegration({
    direction: "RECONCILE",
    action: "reconcile",
    status: report.mismatches.length > 0 ? "FAILED" : "SUCCESS",
    errorMessage: report.mismatches.length > 0 ? `${report.mismatches.length} mismatches found` : undefined,
    responsePayload: {
      totalBeds24: report.totalBeds24,
      totalMK: report.totalMK,
      mismatches: report.mismatches.length,
      syncedOk: report.syncedOk,
    },
  });

  return report;
}

// ─── Integration Logs Query ─────────────────────────────────────────

export async function getIntegrationLogs(params?: {
  direction?: "INBOUND" | "OUTBOUND" | "RECONCILE";
  status?: "SUCCESS" | "FAILED" | "SKIPPED";
  limit?: number;
  offset?: number;
}): Promise<{ logs: any[]; total: number }> {
  const pool = getPool();
  if (!pool) return { logs: [], total: 0 };

  const where: string[] = ["1=1"];
  const queryParams: any[] = [];

  if (params?.direction) {
    where.push("direction = ?");
    queryParams.push(params.direction);
  }
  if (params?.status) {
    where.push("status = ?");
    queryParams.push(params.status);
  }

  const limit = params?.limit || 50;
  const offset = params?.offset || 0;

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM integration_logs WHERE ${where.join(" AND ")}`,
    queryParams
  );
  const total = countRows[0]?.total || 0;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM integration_logs WHERE ${where.join(" AND ")} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
    [...queryParams, limit, offset]
  );

  return { logs: rows, total };
}

// ─── Analytics Helpers ──────────────────────────────────────────────

export async function getBookingSourceBreakdown(days: number = 30): Promise<{
  local: number;
  beds24: number;
  ical: number;
  total: number;
}> {
  const pool = getPool();
  if (!pool) return { local: 0, beds24: 0, ical: 0, total: 0 };

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       COALESCE(source, 'LOCAL') as src,
       COUNT(*) as cnt
     FROM bookings
     WHERE createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
     AND status NOT IN ('cancelled')
     GROUP BY COALESCE(source, 'LOCAL')`,
    [days]
  );

  const breakdown = { local: 0, beds24: 0, ical: 0, total: 0 };
  for (const row of rows) {
    const count = parseInt(row.cnt);
    breakdown.total += count;
    switch (row.src) {
      case "BEDS24": breakdown.beds24 = count; break;
      case "ICAL": breakdown.ical = count; break;
      default: breakdown.local = count; break;
    }
  }
  return breakdown;
}
