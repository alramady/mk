/**
 * Occupancy Module — Revised per Integration Safety Report
 * 
 * Strict source-of-truth rules:
 * 1. If unit has beds24_map with sourceOfTruth='BEDS24':
 *    - Occupancy comes from Beds24 data ONLY
 *    - If Beds24 data is not present → status is UNKNOWN (never LOCAL fallback)
 * 2. If no beds24_map or sourceOfTruth='LOCAL':
 *    - Occupancy may be computed from local bookings
 * 3. Units with unitStatus in BLOCKED/MAINTENANCE are excluded from available denominators
 */
import { getPool } from "./db";
import type { RowDataPacket } from "mysql2";

export type OccupancySource = "BEDS24" | "LOCAL" | "UNKNOWN";

export interface UnitOccupancyResult {
  occupied: boolean;
  source: OccupancySource;
  bookingRef?: string;
  /** true if Beds24-controlled but no data available */
  isUnknown: boolean;
}

// ─── Source of Truth Detection ──────────────────────────────────────
export async function getOccupancySource(unitId: number): Promise<{
  source: "BEDS24" | "LOCAL";
  isBeds24Controlled: boolean;
}> {
  const pool = getPool();
  if (!pool) return { source: "LOCAL", isBeds24Controlled: false };
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT sourceOfTruth FROM beds24_map WHERE unitId = ? LIMIT 1", [unitId]
  );
  if (rows[0]?.sourceOfTruth === "BEDS24") {
    return { source: "BEDS24", isBeds24Controlled: true };
  }
  return { source: rows[0] ? "LOCAL" : "LOCAL", isBeds24Controlled: !!rows[0] };
}

// ─── Check if Unit is Occupied (real-time) ──────────────────────────
export async function isUnitOccupied(unitId: number, date?: Date): Promise<UnitOccupancyResult> {
  const pool = getPool();
  if (!pool) return { occupied: false, source: "LOCAL", isUnknown: false };
  
  const checkDate = date || new Date();
  const { source, isBeds24Controlled } = await getOccupancySource(unitId);

  if (source === "BEDS24") {
    // For Beds24-controlled units, ONLY use Beds24 data
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT occupied, bookingRef FROM unit_daily_status
       WHERE unitId = ? AND DATE(date) = DATE(?) AND source = 'BEDS24'
       ORDER BY createdAt DESC LIMIT 1`,
      [unitId, checkDate]
    );
    if (rows[0]) {
      return {
        occupied: !!rows[0].occupied,
        source: "BEDS24",
        bookingRef: rows[0].bookingRef,
        isUnknown: false,
      };
    }
    // NO Beds24 data available → UNKNOWN (never fall back to local)
    return { occupied: false, source: "UNKNOWN", isUnknown: true };
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
    isUnknown: false,
  };
}

// ─── Generate Daily Snapshot for All Units ──────────────────────────
export async function generateDailySnapshot(date?: Date): Promise<{
  processed: number;
  occupied: number;
  unknown: number;
  errors: string[];
}> {
  const pool = getPool();
  if (!pool) return { processed: 0, occupied: 0, unknown: 0, errors: [] };

  const snapshotDate = date || new Date();
  const dateStr = snapshotDate.toISOString().split("T")[0];
  let processed = 0;
  let occupied = 0;
  let unknown = 0;
  const errors: string[] = [];

  // Get all units (exclude BLOCKED/MAINTENANCE from available flag)
  const [units] = await pool.query<RowDataPacket[]>(
    "SELECT u.id, u.buildingId, u.unitStatus FROM units u"
  );

  for (const unit of units) {
    try {
      const isAvailable = unit.unitStatus === "AVAILABLE";
      const status = await isUnitOccupied(unit.id, snapshotDate);
      
      // Upsert daily status (unique on date+unitId)
      await pool.execute(
        `INSERT INTO unit_daily_status (date, buildingId, unitId, occupied, available, source, bookingRef)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE occupied = VALUES(occupied), available = VALUES(available), source = VALUES(source), bookingRef = VALUES(bookingRef)`,
        [dateStr, unit.buildingId, unit.id, status.occupied, isAvailable, status.source, status.bookingRef || null]
      );

      processed++;
      if (status.occupied) occupied++;
      if (status.isUnknown) unknown++;
    } catch (err: any) {
      errors.push(`Unit ${unit.id}: ${err.message}`);
    }
  }

  return { processed, occupied, unknown, errors };
}

// ─── Today's Occupancy for Building ─────────────────────────────────
export async function getBuildingOccupancyToday(buildingId: number): Promise<{
  occupiedUnits: number;
  totalAvailableUnits: number;
  unknownUnits: number;
  occupancyRate: number;
}> {
  const pool = getPool();
  if (!pool) return { occupiedUnits: 0, totalAvailableUnits: 0, unknownUnits: 0, occupancyRate: 0 };

  // Count units by status (exclude BLOCKED/MAINTENANCE from denominator)
  const [unitRows] = await pool.query<RowDataPacket[]>(
    `SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN unitStatus = 'AVAILABLE' THEN 1 ELSE 0 END) as available
     FROM units WHERE buildingId = ?`,
    [buildingId]
  );
  const totalAvailable = Number(unitRows[0]?.available || 0);

  // Get today's snapshot data
  const [snapRows] = await pool.query<RowDataPacket[]>(
    `SELECT 
       SUM(CASE WHEN occupied = true AND source != 'UNKNOWN' THEN 1 ELSE 0 END) as occupiedCount,
       SUM(CASE WHEN source = 'UNKNOWN' THEN 1 ELSE 0 END) as unknownCount
     FROM unit_daily_status
     WHERE buildingId = ? AND DATE(date) = CURRENT_DATE()`,
    [buildingId]
  );

  const occupiedCount = Number(snapRows[0]?.occupiedCount || 0);
  const unknownCount = Number(snapRows[0]?.unknownCount || 0);
  
  // Occupancy rate: unknown units excluded from denominator
  const denominator = totalAvailable - unknownCount;
  const occupancyRate = denominator > 0
    ? Math.round((occupiedCount / denominator) * 10000) / 100
    : 0;

  return {
    occupiedUnits: occupiedCount,
    totalAvailableUnits: totalAvailable,
    unknownUnits: unknownCount,
    occupancyRate,
  };
}

// ─── Occupancy Rate for Building (historical, from snapshots) ───────
export async function getBuildingOccupancyRate(buildingId: number, days: number = 30): Promise<{
  avgOccupancyRate: number;
  dailyRates: Array<{ date: string; rate: number; unknown: number }>;
}> {
  const pool = getPool();
  if (!pool) return { avgOccupancyRate: 0, dailyRates: [] };

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE(date) as d,
       SUM(CASE WHEN available = true THEN 1 ELSE 0 END) as availableUnits,
       SUM(CASE WHEN occupied = true AND source != 'UNKNOWN' THEN 1 ELSE 0 END) as occupiedUnits,
       SUM(CASE WHEN source = 'UNKNOWN' THEN 1 ELSE 0 END) as unknownUnits
     FROM unit_daily_status
     WHERE buildingId = ? AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY)
     GROUP BY DATE(date)
     ORDER BY DATE(date) ASC`,
    [buildingId, days]
  );

  const dailyRates = rows.map((r: any) => {
    const available = Number(r.availableUnits || 0);
    const unknown = Number(r.unknownUnits || 0);
    const occupied = Number(r.occupiedUnits || 0);
    const denominator = available - unknown;
    return {
      date: r.d instanceof Date ? r.d.toISOString().split("T")[0] : String(r.d),
      rate: denominator > 0 ? Math.round((occupied / denominator) * 10000) / 100 : 0,
      unknown,
    };
  });

  const avgOccupancyRate = dailyRates.length > 0
    ? Math.round(dailyRates.reduce((sum, d) => sum + d.rate, 0) / dailyRates.length * 100) / 100
    : 0;

  return { avgOccupancyRate, dailyRates };
}

// ─── Global Occupancy Stats ─────────────────────────────────────────
export async function getGlobalOccupancyStats(days: number = 30) {
  const pool = getPool();
  if (!pool) return { avgOccupancyRate: 0, totalSnapshots: 0, unknownSnapshots: 0 };

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
       COUNT(*) as totalSnapshots,
       SUM(CASE WHEN occupied = true AND source != 'UNKNOWN' THEN 1 ELSE 0 END) as occupiedSnapshots,
       SUM(CASE WHEN source = 'UNKNOWN' THEN 1 ELSE 0 END) as unknownSnapshots
     FROM unit_daily_status
     WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY)`,
    [days]
  );

  const total = Number((rows[0] as any)?.totalSnapshots || 0);
  const occ = Number((rows[0] as any)?.occupiedSnapshots || 0);
  const unk = Number((rows[0] as any)?.unknownSnapshots || 0);
  const denominator = total - unk;

  return {
    avgOccupancyRate: denominator > 0 ? Math.round((occ / denominator) * 10000) / 100 : 0,
    totalSnapshots: total,
    unknownSnapshots: unk,
  };
}
