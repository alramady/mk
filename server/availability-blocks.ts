/**
 * Availability Blocks Module
 * 
 * Source of truth for property/unit occupancy.
 * Creates and manages date-range blocks when bookings become active,
 * and cancels them when bookings are cancelled/refunded.
 * 
 * Block Types:
 *   BOOKING        — Created when booking status → 'active' (payment confirmed)
 *   MAINTENANCE    — Created by admin for maintenance periods
 *   BEDS24_IMPORT  — Created by Beds24 sync for external bookings
 *   MANUAL_BLOCK   — Created by admin for arbitrary blocks
 * 
 * Status:
 *   ACTIVE    — Block is in effect
 *   CANCELLED — Block was cancelled (booking cancelled/refunded)
 *   EXPIRED   — Block end date has passed (set by cron/cleanup)
 */

import { getPool } from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// ─── Types ──────────────────────────────────────────────────────────

export type BlockType = "BOOKING" | "MAINTENANCE" | "BEDS24_IMPORT" | "MANUAL_BLOCK";
export type BlockStatus = "ACTIVE" | "CANCELLED" | "EXPIRED";
export type BlockSource = "LOCAL" | "BEDS24" | "ICAL" | "ADMIN";

export interface AvailabilityBlock {
  id: number;
  propertyId: number;
  unitId: number | null;
  bookingId: number | null;
  blockType: BlockType;
  status: BlockStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  source: BlockSource;
  sourceRef: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Core Operations ────────────────────────────────────────────────

/**
 * Create a booking block when a booking becomes active (payment confirmed).
 * Idempotent: if a block already exists for this bookingId, it updates it.
 */
export async function createBookingBlock(params: {
  propertyId: number;
  unitId?: number;
  bookingId: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  source?: BlockSource;
  sourceRef?: string;
}): Promise<number> {
  const pool = getPool();
  if (!pool) throw new Error("Database not available");

  const { propertyId, unitId, bookingId, startDate, endDate, source = "LOCAL", sourceRef } = params;

  // Upsert: if block exists for this booking, update it; otherwise insert
  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT id, status FROM availability_blocks WHERE bookingId = ? AND blockType = 'BOOKING'",
    [bookingId]
  );

  if (existing.length > 0) {
    const block = existing[0];
    if (block.status === "ACTIVE") {
      // Already active, just update dates if changed
      await pool.execute(
        "UPDATE availability_blocks SET startDate = ?, endDate = ?, updatedAt = NOW() WHERE id = ?",
        [startDate, endDate, block.id]
      );
      return block.id;
    } else {
      // Reactivate cancelled/expired block
      await pool.execute(
        "UPDATE availability_blocks SET status = 'ACTIVE', startDate = ?, endDate = ?, updatedAt = NOW() WHERE id = ?",
        [startDate, endDate, block.id]
      );
      return block.id;
    }
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO availability_blocks (propertyId, unitId, bookingId, blockType, status, startDate, endDate, source, sourceRef)
     VALUES (?, ?, ?, 'BOOKING', 'ACTIVE', ?, ?, ?, ?)`,
    [propertyId, unitId || null, bookingId, startDate, endDate, source, sourceRef || null]
  );

  return result.insertId;
}

/**
 * Cancel a booking block when a booking is cancelled/refunded.
 */
export async function cancelBookingBlock(bookingId: number, reason?: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;

  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE availability_blocks SET status = 'CANCELLED', notes = CONCAT(IFNULL(notes, ''), ?), updatedAt = NOW() WHERE bookingId = ? AND blockType = 'BOOKING' AND status = 'ACTIVE'",
    [reason ? `\nCancelled: ${reason}` : "\nCancelled", bookingId]
  );

  return result.affectedRows > 0;
}

/**
 * Create a maintenance block for a property/unit.
 */
export async function createMaintenanceBlock(params: {
  propertyId: number;
  unitId?: number;
  startDate: string;
  endDate: string;
  notes?: string;
  createdBy?: number;
}): Promise<number> {
  const pool = getPool();
  if (!pool) throw new Error("Database not available");

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO availability_blocks (propertyId, unitId, blockType, status, startDate, endDate, source, notes)
     VALUES (?, ?, 'MAINTENANCE', 'ACTIVE', ?, ?, 'ADMIN', ?)`,
    [params.propertyId, params.unitId || null, params.startDate, params.endDate, params.notes || null]
  );

  return result.insertId;
}

/**
 * Remove a maintenance block.
 */
export async function removeMaintenanceBlock(blockId: number): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;

  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE availability_blocks SET status = 'CANCELLED', updatedAt = NOW() WHERE id = ? AND blockType = 'MAINTENANCE'",
    [blockId]
  );

  return result.affectedRows > 0;
}

// ─── Query Operations ───────────────────────────────────────────────

/**
 * Get all active blocks for a property in a date range.
 */
export async function getActiveBlocks(propertyId: number, from?: string, to?: string): Promise<AvailabilityBlock[]> {
  const pool = getPool();
  if (!pool) return [];

  let sql = "SELECT * FROM availability_blocks WHERE propertyId = ? AND status = 'ACTIVE'";
  const params: any[] = [propertyId];

  if (from) {
    sql += " AND endDate >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND startDate <= ?";
    params.push(to);
  }

  sql += " ORDER BY startDate ASC";

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows as AvailabilityBlock[];
}

/**
 * Check if a property is available for a date range (no overlapping active blocks).
 */
export async function isPropertyAvailable(propertyId: number, startDate: string, endDate: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return true; // Fail open if DB unavailable

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as cnt FROM availability_blocks 
     WHERE propertyId = ? AND status = 'ACTIVE' 
     AND startDate < ? AND endDate > ?`,
    [propertyId, endDate, startDate]
  );

  return Number(rows[0]?.cnt || 0) === 0;
}

/**
 * Get occupancy stats for analytics dashboard.
 * Returns: total property-days available, total property-days booked, occupancy rate.
 */
export async function getOccupancyStats(days: number = 30): Promise<{
  totalPropertyDays: number;
  bookedDays: number;
  maintenanceDays: number;
  occupancyRate: number;
}> {
  const pool = getPool();
  if (!pool) return { totalPropertyDays: 0, bookedDays: 0, maintenanceDays: 0, occupancyRate: 0 };

  // Count published properties
  const [propRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) as cnt FROM properties WHERE status IN ('published', 'active')"
  );
  const publishedCount = Number(propRows[0]?.cnt || 0);
  const totalPropertyDays = publishedCount * days;

  if (totalPropertyDays === 0) {
    return { totalPropertyDays: 0, bookedDays: 0, maintenanceDays: 0, occupancyRate: 0 };
  }

  // Count booked days from availability_blocks
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = new Date().toISOString().split("T")[0];

  const [blockRows] = await pool.query<RowDataPacket[]>(
    `SELECT blockType, 
       SUM(DATEDIFF(LEAST(endDate, ?), GREATEST(startDate, ?)) + 1) as totalDays
     FROM availability_blocks 
     WHERE status = 'ACTIVE' 
     AND endDate >= ? AND startDate <= ?
     GROUP BY blockType`,
    [endStr, startStr, startStr, endStr]
  );

  let bookedDays = 0;
  let maintenanceDays = 0;
  for (const row of blockRows) {
    const d = Number(row.totalDays || 0);
    if (row.blockType === "BOOKING" || row.blockType === "BEDS24_IMPORT") {
      bookedDays += d;
    } else if (row.blockType === "MAINTENANCE") {
      maintenanceDays += d;
    }
  }

  // Occupancy = booked / (available - maintenance)
  const availableDays = Math.max(totalPropertyDays - maintenanceDays, 1);
  const occupancyRate = Math.round((bookedDays / availableDays) * 10000) / 100;

  return {
    totalPropertyDays,
    bookedDays,
    maintenanceDays,
    occupancyRate: Math.min(occupancyRate, 100), // Cap at 100%
  };
}

/**
 * Backfill availability blocks from existing active bookings.
 * Run once to populate blocks for bookings that were created before this module.
 */
export async function backfillFromBookings(): Promise<number> {
  const pool = getPool();
  if (!pool) return 0;

  const [bookings] = await pool.query<RowDataPacket[]>(
    `SELECT id, propertyId, unitId, moveInDate, moveOutDate 
     FROM bookings 
     WHERE status = 'active' 
     AND moveInDate IS NOT NULL AND moveOutDate IS NOT NULL`
  );

  let created = 0;
  for (const b of bookings) {
    try {
      const startDate = new Date(b.moveInDate).toISOString().split("T")[0];
      const endDate = new Date(b.moveOutDate).toISOString().split("T")[0];
      await createBookingBlock({
        propertyId: b.propertyId,
        unitId: b.unitId || undefined,
        bookingId: b.id,
        startDate,
        endDate,
      });
      created++;
    } catch {
      // Duplicate key = already exists, skip
    }
  }

  return created;
}
