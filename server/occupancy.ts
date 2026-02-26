/**
 * Occupancy Module
 * 
 * Handles occupancy computation with Beds24 vs Local source-of-truth logic.
 * Provides daily snapshot generation and occupancy rate calculations.
 * 
 * Source-of-truth rules:
 * - If unit has beds24_map entry with sourceOfTruth=BEDS24 → use Beds24 data
 * - Otherwise → use local bookings table
 * - Never mix sources for the same unit
 */
import { getPool } from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// ─── Source of Truth Detection ──────────────────────────────────────
export async function getOccupancySource(unitId: number): Promise<"BEDS24" | "LOCAL"> {
  const pool = getPool();
  if (!pool) return "LOCAL";
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT sourceOfTruth FROM beds24_map WHERE unitId = ? LIMIT 1", [unitId]
  );
  return (rows[0]?.sourceOfTruth as "BEDS24" | "LOCAL") || "LOCAL";
}

// ─── Check if Unit is Occupied (real-time) ──────────────────────────
export async function isUnitOccupied(unitId: number, date?: Date): Promise<{
  occupied: boolean;
  source: "BEDS24" | "LOCAL";
  bookingRef?: string;
}> {
  const pool = getPool();
  if (!pool) return { occupied: false, source: "LOCAL" };
  
  const checkDate = date || new Date();
  const source = await getOccupancySource(unitId);

  if (source === "BEDS24") {
    // For Beds24-controlled units, check the daily status snapshot
    // (populated by external sync, not by this module)
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT occupied, bookingRef FROM unit_daily_status
       WHERE unitId = ? AND DATE(date) = DATE(?) AND source = 'BEDS24'
       ORDER BY createdAt DESC LIMIT 1`,
      [unitId, checkDate]
    );
    if (rows[0]) {
      return { occupied: !!rows[0].occupied, source: "BEDS24", bookingRef: rows[0].bookingRef };
    }
    // No snapshot yet — check beds24_map for any active booking
    const [mapRows] = await pool.query<RowDataPacket[]>(
      "SELECT beds24BookingId FROM beds24_map WHERE unitId = ? AND beds24BookingId IS NOT NULL", [unitId]
    );
    return { occupied: mapRows.length > 0, source: "BEDS24", bookingRef: mapRows[0]?.beds24BookingId };
  }

  // LOCAL source: check bookings table
  const [bookingRows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM bookings
     WHERE unitId = ? AND status = 'active'
     AND moveInDate <= ? AND moveOutDate >= ?
     LIMIT 1`,
    [unitId, checkDate, checkDate]
  );
  return {
    occupied: bookingRows.length > 0,
    source: "LOCAL",
    bookingRef: bookingRows[0]?.id?.toString(),
  };
}

// ─── Generate Daily Snapshot for All Units ──────────────────────────
export async function generateDailySnapshot(date?: Date): Promise<{
  processed: number;
  occupied: number;
  errors: string[];
}> {
  const pool = getPool();
  if (!pool) return { processed: 0, occupied: 0, errors: [] };

  const snapshotDate = date || new Date();
  const dateStr = snapshotDate.toISOString().split("T")[0];
  let processed = 0;
  let occupied = 0;
  const errors: string[] = [];

  // Get all units
  const [units] = await pool.query<RowDataPacket[]>(
    "SELECT u.id, u.buildingId FROM units u"
  );

  for (const unit of units) {
    try {
      const status = await isUnitOccupied(unit.id, snapshotDate);
      
      // Upsert daily status (unique on date+unitId)
      await pool.execute(
        `INSERT INTO unit_daily_status (date, buildingId, unitId, occupied, available, source, bookingRef)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE occupied = VALUES(occupied), available = VALUES(available), source = VALUES(source), bookingRef = VALUES(bookingRef)`,
        [dateStr, unit.buildingId, unit.id, status.occupied, !status.occupied, status.source, status.bookingRef || null]
      );

      processed++;
      if (status.occupied) occupied++;
    } catch (err: any) {
      errors.push(`Unit ${unit.id}: ${err.message}`);
    }
  }

  return { processed, occupied, errors };
}

// ─── Occupancy Rate for Building (from snapshots) ───────────────────
export async function getBuildingOccupancyRate(buildingId: number, days: number = 30): Promise<{
  avgOccupancyRate: number;
  dailyRates: Array<{ date: string; rate: number }>;
}> {
  const pool = getPool();
  if (!pool) return { avgOccupancyRate: 0, dailyRates: [] };

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE(date) as d,
       COUNT(*) as totalUnits,
       SUM(CASE WHEN occupied = true THEN 1 ELSE 0 END) as occupiedUnits
     FROM unit_daily_status
     WHERE buildingId = ? AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY)
     GROUP BY DATE(date)
     ORDER BY DATE(date) ASC`,
    [buildingId, days]
  );

  const dailyRates = rows.map((r: any) => ({
    date: r.d instanceof Date ? r.d.toISOString().split("T")[0] : String(r.d),
    rate: r.totalUnits > 0 ? Math.round((r.occupiedUnits / r.totalUnits) * 10000) / 100 : 0,
  }));

  const avgOccupancyRate = dailyRates.length > 0
    ? Math.round(dailyRates.reduce((sum, d) => sum + d.rate, 0) / dailyRates.length * 100) / 100
    : 0;

  return { avgOccupancyRate, dailyRates };
}

// ─── Global Occupancy Stats ─────────────────────────────────────────
export async function getGlobalOccupancyStats(days: number = 30) {
  const pool = getPool();
  if (!pool) return { avgOccupancyRate: 0, totalSnapshots: 0 };

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
       COUNT(*) as totalSnapshots,
       SUM(CASE WHEN occupied = true THEN 1 ELSE 0 END) as occupiedSnapshots
     FROM unit_daily_status
     WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY)`,
    [days]
  );

  const total = (rows[0] as any)?.totalSnapshots || 0;
  const occ = (rows[0] as any)?.occupiedSnapshots || 0;

  return {
    avgOccupancyRate: total > 0 ? Math.round((occ / total) * 10000) / 100 : 0,
    totalSnapshots: total,
  };
}
