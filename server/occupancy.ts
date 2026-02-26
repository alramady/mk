/**
 * Occupancy Module — Revised with API/iCal Connection Types
 * 
 * Strict source-of-truth rules:
 * 1. If unit has beds24_map with sourceOfTruth='BEDS24':
 *    a) connectionType='API': occupancy from Beds24 API data only
 *    b) connectionType='ICAL': occupancy from parsed iCal feed
 *    c) If neither data source is available → status is UNKNOWN (never LOCAL fallback)
 * 2. If no beds24_map or sourceOfTruth='LOCAL':
 *    - Occupancy computed from local bookings
 * 3. Units with unitStatus in BLOCKED/MAINTENANCE are excluded from available denominators
 */
import { getPool } from "./db";
import type { RowDataPacket } from "mysql2";

export type OccupancySource = "BEDS24" | "LOCAL" | "UNKNOWN";
export type ConnectionType = "API" | "ICAL";

export interface UnitOccupancyResult {
  occupied: boolean;
  source: OccupancySource;
  connectionType?: ConnectionType;
  bookingRef?: string;
  /** true if Beds24-controlled but no data available */
  isUnknown: boolean;
}

export interface Beds24MappingInfo {
  source: "BEDS24" | "LOCAL";
  isBeds24Controlled: boolean;
  connectionType: ConnectionType | null;
  icalImportUrl: string | null;
  beds24ApiKey: string | null;
  lastSyncStatus: string | null;
}

// ─── iCal Parser (lightweight, no external deps) ────────────────────
interface ICalEvent {
  uid: string;
  dtstart: Date;
  dtend: Date;
  summary?: string;
  status?: string;
}

function parseICalFeed(icalText: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  const blocks = icalText.split("BEGIN:VEVENT");
  
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VEVENT")[0];
    const lines = block.split(/\r?\n/);
    
    let uid = "";
    let dtstart: Date | null = null;
    let dtend: Date | null = null;
    let summary = "";
    let status = "";
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("UID:")) uid = trimmed.substring(4);
      else if (trimmed.startsWith("SUMMARY:")) summary = trimmed.substring(8);
      else if (trimmed.startsWith("STATUS:")) status = trimmed.substring(7);
      else if (trimmed.startsWith("DTSTART")) {
        const val = trimmed.includes(":") ? trimmed.split(":").pop()! : "";
        dtstart = parseICalDate(val);
      }
      else if (trimmed.startsWith("DTEND")) {
        const val = trimmed.includes(":") ? trimmed.split(":").pop()! : "";
        dtend = parseICalDate(val);
      }
    }
    
    if (uid && dtstart && dtend) {
      events.push({ uid, dtstart, dtend, summary, status });
    }
  }
  
  return events;
}

function parseICalDate(val: string): Date | null {
  if (!val) return null;
  // Handle YYYYMMDD format (date only)
  if (val.length === 8) {
    return new Date(`${val.slice(0,4)}-${val.slice(4,6)}-${val.slice(6,8)}T00:00:00Z`);
  }
  // Handle YYYYMMDDTHHMMSSZ format
  if (val.length >= 15) {
    const y = val.slice(0,4), m = val.slice(4,6), d = val.slice(6,8);
    const h = val.slice(9,11), mi = val.slice(11,13), s = val.slice(13,15);
    return new Date(`${y}-${m}-${d}T${h}:${mi}:${s}Z`);
  }
  return new Date(val);
}

function isDateInEvent(date: Date, event: ICalEvent): boolean {
  const checkDate = new Date(date.toISOString().split("T")[0] + "T12:00:00Z");
  return checkDate >= event.dtstart && checkDate < event.dtend;
}

// ─── Fetch iCal Feed ────────────────────────────────────────────────
async function fetchICalOccupancy(icalUrl: string, date: Date): Promise<{
  occupied: boolean;
  bookingRef?: string;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(icalUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "MonthlyKey-OccupancySync/1.0" },
    });
    clearTimeout(timeout);
    
    if (!response.ok) {
      return { occupied: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
    
    const icalText = await response.text();
    const events = parseICalFeed(icalText);
    
    // Check if any event covers the check date (excluding CANCELLED)
    const activeEvent = events.find(e => 
      isDateInEvent(date, e) && 
      e.status?.toUpperCase() !== "CANCELLED"
    );
    
    return {
      occupied: !!activeEvent,
      bookingRef: activeEvent?.uid || activeEvent?.summary,
    };
  } catch (err: any) {
    return { occupied: false, error: err.message || "iCal fetch failed" };
  }
}

// ─── Source of Truth Detection (with connection type) ───────────────
export async function getOccupancySource(unitId: number): Promise<Beds24MappingInfo> {
  const pool = getPool();
  if (!pool) return { source: "LOCAL", isBeds24Controlled: false, connectionType: null, icalImportUrl: null, beds24ApiKey: null, lastSyncStatus: null };
  
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT sourceOfTruth, connectionType, icalImportUrl, beds24ApiKey, lastSyncStatus FROM beds24_map WHERE unitId = ? LIMIT 1",
    [unitId]
  );
  
  if (rows[0]?.sourceOfTruth === "BEDS24") {
    return {
      source: "BEDS24",
      isBeds24Controlled: true,
      connectionType: rows[0].connectionType as ConnectionType,
      icalImportUrl: rows[0].icalImportUrl,
      beds24ApiKey: rows[0].beds24ApiKey,
      lastSyncStatus: rows[0].lastSyncStatus,
    };
  }
  
  return {
    source: rows[0] ? "LOCAL" : "LOCAL",
    isBeds24Controlled: !!rows[0],
    connectionType: rows[0]?.connectionType as ConnectionType || null,
    icalImportUrl: rows[0]?.icalImportUrl || null,
    beds24ApiKey: rows[0]?.beds24ApiKey || null,
    lastSyncStatus: rows[0]?.lastSyncStatus || null,
  };
}

// ─── Update Sync Status ────────────────────────────────────────────
async function updateSyncStatus(unitId: number, status: "SUCCESS" | "FAILED", error?: string) {
  const pool = getPool();
  if (!pool) return;
  await pool.execute(
    "UPDATE beds24_map SET lastSyncedAt = NOW(), lastSyncStatus = ?, lastSyncError = ? WHERE unitId = ?",
    [status, error || null, unitId]
  );
}

// ─── Check if Unit is Occupied (real-time) ──────────────────────────
export async function isUnitOccupied(unitId: number, date?: Date): Promise<UnitOccupancyResult> {
  const pool = getPool();
  if (!pool) return { occupied: false, source: "LOCAL", isUnknown: false };
  
  const checkDate = date || new Date();
  const mapping = await getOccupancySource(unitId);

  if (mapping.source === "BEDS24") {
    // ── iCal Connection: fetch live from iCal feed ──
    if (mapping.connectionType === "ICAL" && mapping.icalImportUrl) {
      const icalResult = await fetchICalOccupancy(mapping.icalImportUrl, checkDate);
      
      if (icalResult.error) {
        // iCal fetch failed → update sync status and return UNKNOWN
        await updateSyncStatus(unitId, "FAILED", icalResult.error);
        return { occupied: false, source: "UNKNOWN", connectionType: "ICAL", isUnknown: true };
      }
      
      await updateSyncStatus(unitId, "SUCCESS");
      return {
        occupied: icalResult.occupied,
        source: "BEDS24",
        connectionType: "ICAL",
        bookingRef: icalResult.bookingRef,
        isUnknown: false,
      };
    }
    
    // ── API Connection: check stored snapshot data ──
    if (mapping.connectionType === "API") {
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
          connectionType: "API",
          bookingRef: rows[0].bookingRef,
          isUnknown: false,
        };
      }
    }
    
    // NO data available (API without snapshot, or ICAL without URL) → UNKNOWN
    return { occupied: false, source: "UNKNOWN", connectionType: mapping.connectionType || undefined, isUnknown: true };
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

// ─── Sync iCal Feed for a Single Unit ──────────────────────────────
export async function syncICalUnit(unitId: number, date?: Date): Promise<{
  success: boolean;
  occupied: boolean;
  error?: string;
}> {
  const mapping = await getOccupancySource(unitId);
  if (mapping.connectionType !== "ICAL" || !mapping.icalImportUrl) {
    return { success: false, occupied: false, error: "Unit is not iCal-connected or no import URL" };
  }
  
  const checkDate = date || new Date();
  const result = await fetchICalOccupancy(mapping.icalImportUrl, checkDate);
  
  if (result.error) {
    await updateSyncStatus(unitId, "FAILED", result.error);
    return { success: false, occupied: false, error: result.error };
  }
  
  // Store snapshot
  const pool = getPool();
  if (pool) {
    const dateStr = checkDate.toISOString().split("T")[0];
    const [unitRows] = await pool.query<RowDataPacket[]>(
      "SELECT buildingId, unitStatus FROM units WHERE id = ?", [unitId]
    );
    const buildingId = unitRows[0]?.buildingId;
    const isAvailable = unitRows[0]?.unitStatus === "AVAILABLE";
    
    await pool.execute(
      `INSERT INTO unit_daily_status (date, buildingId, unitId, occupied, available, source, bookingRef)
       VALUES (?, ?, ?, ?, ?, 'BEDS24', ?)
       ON DUPLICATE KEY UPDATE occupied = VALUES(occupied), available = VALUES(available), source = 'BEDS24', bookingRef = VALUES(bookingRef)`,
      [dateStr, buildingId, unitId, result.occupied, isAvailable, result.bookingRef || null]
    );
  }
  
  await updateSyncStatus(unitId, "SUCCESS");
  return { success: true, occupied: result.occupied };
}

// ─── Sync All iCal Units ───────────────────────────────────────────
export async function syncAllICalUnits(date?: Date): Promise<{
  synced: number;
  failed: number;
  errors: string[];
}> {
  const pool = getPool();
  if (!pool) return { synced: 0, failed: 0, errors: [] };
  
  const [icalUnits] = await pool.query<RowDataPacket[]>(
    "SELECT unitId FROM beds24_map WHERE connectionType = 'ICAL' AND icalImportUrl IS NOT NULL AND sourceOfTruth = 'BEDS24'"
  );
  
  let synced = 0, failed = 0;
  const errors: string[] = [];
  
  for (const row of icalUnits) {
    const result = await syncICalUnit(row.unitId, date);
    if (result.success) {
      synced++;
    } else {
      failed++;
      errors.push(`Unit ${row.unitId}: ${result.error}`);
    }
  }
  
  return { synced, failed, errors };
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

// ─── Get Connection Stats ──────────────────────────────────────────
export async function getConnectionStats(): Promise<{
  totalMapped: number;
  apiConnections: number;
  icalConnections: number;
  syncSuccess: number;
  syncFailed: number;
  syncPending: number;
}> {
  const pool = getPool();
  if (!pool) return { totalMapped: 0, apiConnections: 0, icalConnections: 0, syncSuccess: 0, syncFailed: 0, syncPending: 0 };

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       COUNT(*) as totalMapped,
       SUM(CASE WHEN connectionType = 'API' THEN 1 ELSE 0 END) as apiConnections,
       SUM(CASE WHEN connectionType = 'ICAL' THEN 1 ELSE 0 END) as icalConnections,
       SUM(CASE WHEN lastSyncStatus = 'SUCCESS' THEN 1 ELSE 0 END) as syncSuccess,
       SUM(CASE WHEN lastSyncStatus = 'FAILED' THEN 1 ELSE 0 END) as syncFailed,
       SUM(CASE WHEN lastSyncStatus = 'PENDING' OR lastSyncStatus IS NULL THEN 1 ELSE 0 END) as syncPending
     FROM beds24_map`
  );

  return {
    totalMapped: Number(rows[0]?.totalMapped || 0),
    apiConnections: Number(rows[0]?.apiConnections || 0),
    icalConnections: Number(rows[0]?.icalConnections || 0),
    syncSuccess: Number(rows[0]?.syncSuccess || 0),
    syncFailed: Number(rows[0]?.syncFailed || 0),
    syncPending: Number(rows[0]?.syncPending || 0),
  };
}
