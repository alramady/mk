/**
 * Renewal Module
 * 
 * Handles booking renewal/extension logic with Beds24 safety.
 * 
 * Rules:
 * - term=1 month, renewals_used=0, active, within renewal_window_days before end_date
 * - Renewal generates a new invoice (payment_ledger entry type=RENEWAL_RENT, status=DUE)
 * - If unit is Beds24-controlled: creates "local extension request" requiring admin approval
 *   (does NOT modify Beds24 bookings automatically)
 * - If unit is LOCAL-controlled: can auto-extend after payment
 */
import { getPool } from "./db";
import { createLedgerEntry, generateInvoiceNumber } from "./finance-registry";
import { getOccupancySource } from "./occupancy";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// ─── Renewal Eligibility Check ──────────────────────────────────────
export interface RenewalEligibility {
  eligible: boolean;
  reason?: string;
  bookingId: number;
  currentEndDate: Date;
  renewalsUsed: number;
  maxRenewals: number;
  renewalWindowDays: number;
  daysUntilEnd: number;
  beds24Controlled: boolean;
  monthlyRent: string;
}

export async function checkRenewalEligibility(bookingId: number): Promise<RenewalEligibility | null> {
  const pool = getPool();
  if (!pool) return null;

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM bookings WHERE id = ?", [bookingId]
  );
  if (!rows[0]) return null;
  const booking = rows[0];

  const now = new Date();
  const endDate = new Date(booking.moveOutDate);
  const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  const renewalsUsed = booking.renewalsUsed || 0;
  const maxRenewals = booking.maxRenewals || 1;
  const renewalWindowDays = booking.renewalWindowDays || 14;

  // Check Beds24 control
  let beds24Controlled = false;
  if (booking.unitId) {
    const { isBeds24Controlled } = await getOccupancySource(booking.unitId);
    beds24Controlled = isBeds24Controlled;
  }

  const base: Omit<RenewalEligibility, "eligible" | "reason"> = {
    bookingId,
    currentEndDate: endDate,
    renewalsUsed,
    maxRenewals,
    renewalWindowDays,
    daysUntilEnd,
    beds24Controlled,
    monthlyRent: booking.monthlyRent,
  };

  // Check conditions
  if (booking.status !== "active") {
    return { ...base, eligible: false, reason: "BOOKING_NOT_ACTIVE" };
  }
  if (renewalsUsed >= maxRenewals) {
    return { ...base, eligible: false, reason: "MAX_RENEWALS_REACHED" };
  }
  if (daysUntilEnd > renewalWindowDays) {
    return { ...base, eligible: false, reason: "NOT_IN_RENEWAL_WINDOW" };
  }
  if (daysUntilEnd < 0) {
    return { ...base, eligible: false, reason: "BOOKING_EXPIRED" };
  }

  return { ...base, eligible: true };
}

// ─── Request Renewal ────────────────────────────────────────────────
export async function requestRenewal(bookingId: number, requestedBy: number): Promise<{
  success: boolean;
  extensionId?: number;
  invoiceNumber?: string;
  requiresApproval: boolean;
  error?: string;
}> {
  const pool = getPool();
  if (!pool) return { success: false, error: "Database not available", requiresApproval: false };

  const eligibility = await checkRenewalEligibility(bookingId);
  if (!eligibility) return { success: false, error: "Booking not found", requiresApproval: false };
  if (!eligibility.eligible) return { success: false, error: eligibility.reason, requiresApproval: false };

  const newEndDate = new Date(eligibility.currentEndDate);
  newEndDate.setMonth(newEndDate.getMonth() + 1);

  // Get booking details for ledger entry
  const [bookingRows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM bookings WHERE id = ?", [bookingId]
  );
  const booking = bookingRows[0];

  // Get unit info
  let unitNumber: string | undefined;
  let buildingId: number | undefined;
  if (booking.unitId) {
    const [unitRows] = await pool.query<RowDataPacket[]>("SELECT * FROM units WHERE id = ?", [booking.unitId]);
    if (unitRows[0]) {
      unitNumber = unitRows[0].unitNumber;
      buildingId = unitRows[0].buildingId;
    }
  }

  // Get tenant info
  const [tenantRows] = await pool.query<RowDataPacket[]>("SELECT * FROM users WHERE id = ?", [booking.tenantId]);
  const tenant = tenantRows[0];

  if (eligibility.beds24Controlled) {
    // ─── BEDS24 CONTROLLED: Create extension request requiring admin approval ───
    // Do NOT create or modify Beds24 bookings automatically
    const [extResult] = await pool.execute<ResultSetHeader>(
      `INSERT INTO booking_extensions (bookingId, unitId, originalEndDate, newEndDate, extensionMonths, status, beds24Controlled, requiresBeds24Update, requestedBy)
       VALUES (?, ?, ?, ?, 1, 'PENDING_APPROVAL', true, true, ?)`,
      [bookingId, booking.unitId || null, eligibility.currentEndDate, newEndDate, requestedBy]
    );

    return {
      success: true,
      extensionId: extResult.insertId,
      requiresApproval: true,
    };
  }

  // ─── LOCAL CONTROLLED: Create invoice + extension request ─────────
  // Create ledger entry (invoice)
  const ledgerResult = await createLedgerEntry({
    bookingId,
    customerId: booking.tenantId,
    guestName: tenant?.displayName || tenant?.name || null,
    guestEmail: tenant?.email || null,
    guestPhone: tenant?.phone || null,
    buildingId: buildingId || booking.buildingId,
    unitId: booking.unitId,
    unitNumber,
    type: "RENEWAL_RENT",
    amount: eligibility.monthlyRent,
    status: "DUE",
    dueAt: eligibility.currentEndDate,
    notes: `Renewal for booking #${bookingId}, extending to ${newEndDate.toISOString().split("T")[0]}`,
    createdBy: requestedBy,
  });

  // Create extension record
  const [extResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO booking_extensions (bookingId, unitId, originalEndDate, newEndDate, extensionMonths, status, beds24Controlled, requiresBeds24Update, ledgerEntryId, requestedBy)
     VALUES (?, ?, ?, ?, 1, 'PAYMENT_PENDING', false, false, ?, ?)`,
    [bookingId, booking.unitId || null, eligibility.currentEndDate, newEndDate, ledgerResult.id, requestedBy]
  );

  return {
    success: true,
    extensionId: extResult.insertId,
    invoiceNumber: ledgerResult.invoiceNumber,
    requiresApproval: false,
  };
}

//// ─── Admin Approve Extension (for Beds24 units) ────────────────
// SAFETY: For Beds24-controlled extensions, beds24ChangeNote is REQUIRED.
// This note documents what manual changes the admin made in Beds24.
export async function approveExtension(extensionId: number, adminId: number, beds24ChangeNote?: string): Promise<{
  success: boolean;
  invoiceNumber?: string;
  error?: string;
}> {
  const pool = getPool();
  if (!pool) return { success: false, error: "Database not available" };

  const [extRows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM booking_extensions WHERE id = ?", [extensionId]
  );
  if (!extRows[0]) return { success: false, error: "Extension not found" };
  const ext = extRows[0];

  if (ext.status !== "PENDING_APPROVAL") {
    return { success: false, error: `Extension is in ${ext.status} status, cannot approve` };
  }

  // SAFETY: Beds24-controlled extensions REQUIRE a change note
  if (ext.requiresBeds24Update && !beds24ChangeNote) {
    return { success: false, error: "Beds24 change note is required for Beds24-controlled extensions. Document what was changed in Beds24." };
  }

  // Get booking details
  const [bookingRows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM bookings WHERE id = ?", [ext.bookingId]
  );
  const booking = bookingRows[0];
  if (!booking) return { success: false, error: "Booking not found" };

  // Get tenant info
  const [tenantRows] = await pool.query<RowDataPacket[]>("SELECT * FROM users WHERE id = ?", [booking.tenantId]);
  const tenant = tenantRows[0];

  // Get unit info
  let unitNumber: string | undefined;
  let buildingId: number | undefined;
  if (booking.unitId) {
    const [unitRows] = await pool.query<RowDataPacket[]>("SELECT * FROM units WHERE id = ?", [booking.unitId]);
    if (unitRows[0]) { unitNumber = unitRows[0].unitNumber; buildingId = unitRows[0].buildingId; }
  }

  // Create ledger entry
  const ledgerResult = await createLedgerEntry({
    bookingId: ext.bookingId,
    customerId: booking.tenantId,
    guestName: tenant?.displayName || tenant?.name || null,
    guestEmail: tenant?.email || null,
    guestPhone: tenant?.phone || null,
    buildingId: buildingId || booking.buildingId,
    unitId: booking.unitId,
    unitNumber,
    type: "RENEWAL_RENT",
    amount: booking.monthlyRent,
    status: "DUE",
    dueAt: ext.originalEndDate,
    notes: `Approved Beds24 extension for booking #${ext.bookingId}. Admin must update Beds24 manually.`,
    createdBy: adminId,
  });

  // Update extension status + store Beds24 change note
  await pool.execute(
    `UPDATE booking_extensions SET status = 'PAYMENT_PENDING', ledgerEntryId = ?, approvedBy = ?, approvedAt = NOW(), beds24ChangeNote = ? WHERE id = ?`,
    [ledgerResult.id, adminId, beds24ChangeNote || null, extensionId]
  );

  return { success: true, invoiceNumber: ledgerResult.invoiceNumber };
}

// ─── Reject Extension ───────────────────────────────────────────────
export async function rejectExtension(extensionId: number, adminId: number, reason?: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  await pool.execute(
    `UPDATE booking_extensions SET status = 'REJECTED', adminNotes = ?, approvedBy = ?, approvedAt = NOW() WHERE id = ?`,
    [reason || "Rejected by admin", adminId, extensionId]
  );
  return true;
}

// ─── Activate Extension (after payment) ─────────────────────────────
export async function activateExtension(extensionId: number): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;

  const [extRows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM booking_extensions WHERE id = ?", [extensionId]
  );
  if (!extRows[0]) return false;
  const ext = extRows[0];

  if (ext.status !== "PAYMENT_PENDING") return false;

  // Check if ledger entry is paid
  if (ext.ledgerEntryId) {
    const [ledgerRows] = await pool.query<RowDataPacket[]>(
      "SELECT status FROM payment_ledger WHERE id = ?", [ext.ledgerEntryId]
    );
    if (ledgerRows[0]?.status !== "PAID") return false;
  }

  // Update extension status
  await pool.execute("UPDATE booking_extensions SET status = 'ACTIVE' WHERE id = ?", [extensionId]);

  // For Beds24-controlled units, only update local booking record
  // The actual Beds24 booking must have been updated manually by admin (documented in beds24ChangeNote)
  await pool.execute(
    `UPDATE bookings SET moveOutDate = ?, renewalsUsed = COALESCE(renewalsUsed, 0) + 1 WHERE id = ?`,
    [ext.newEndDate, ext.bookingId]
  );

  return true;
}

// ─── List Extensions ────────────────────────────────────────────────
export async function listExtensions(filters?: {
  bookingId?: number; status?: string; beds24Only?: boolean;
  limit?: number; offset?: number;
}) {
  const pool = getPool();
  if (!pool) return { items: [], total: 0 };

  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  let where = "1=1";
  const params: any[] = [];

  if (filters?.bookingId) { where += " AND be.bookingId = ?"; params.push(filters.bookingId); }
  if (filters?.status) { where += " AND be.status = ?"; params.push(filters.status); }
  if (filters?.beds24Only) { where += " AND be.beds24Controlled = true"; }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT be.*, b.tenantId, b.landlordId, b.propertyId, b.monthlyRent,
       u.displayName as tenantName, u.phone as tenantPhone
     FROM booking_extensions be
     LEFT JOIN bookings b ON be.bookingId = b.id
     LEFT JOIN users u ON b.tenantId = u.id
     WHERE ${where}
     ORDER BY be.createdAt DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countResult] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM booking_extensions be WHERE ${where}`, params
  );
  return { items: rows, total: (countResult[0] as any)?.total || 0 };
}
