/**
 * Finance Registry Module
 * 
 * Provides CRUD operations for buildings, units, payment ledger,
 * and KPI calculations. All operations are additive — no existing
 * tables or endpoints are modified.
 */
import { getPool } from "./db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// ─── Invoice Number Generator ───────────────────────────────────────
export function generateInvoiceNumber(type: string): string {
  const prefix = type === "RENT" ? "INV" : type === "RENEWAL_RENT" ? "RNW" : type === "REFUND" ? "REF" : "INV";
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

// ─── Buildings ──────────────────────────────────────────────────────
export async function createBuilding(data: {
  buildingName: string;
  buildingNameAr?: string;
  address?: string;
  addressAr?: string;
  city?: string;
  cityAr?: string;
  district?: string;
  districtAr?: string;
  latitude?: string;
  longitude?: string;
  totalUnits?: number;
  managerId?: number;
  notes?: string;
}): Promise<number> {
  const pool = getPool();
  if (!pool) throw new Error("Database not available");
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO buildings (buildingName, buildingNameAr, address, addressAr, city, cityAr, district, districtAr, latitude, longitude, totalUnits, managerId, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.buildingName, data.buildingNameAr || null, data.address || null, data.addressAr || null,
     data.city || null, data.cityAr || null, data.district || null, data.districtAr || null,
     data.latitude || null, data.longitude || null, data.totalUnits || 0, data.managerId || null, data.notes || null]
  );
  return result.insertId;
}

export async function getBuildings(filters?: { isActive?: boolean; limit?: number; offset?: number }) {
  const pool = getPool();
  if (!pool) return { items: [], total: 0 };
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  let where = "1=1";
  const params: any[] = [];
  if (filters?.isActive !== undefined) { where += " AND isActive = ?"; params.push(filters.isActive); }
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM buildings WHERE ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  const [countResult] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM buildings WHERE ${where}`, params);
  return { items: rows, total: (countResult[0] as any)?.total || 0 };
}

export async function getBuildingById(id: number) {
  const pool = getPool();
  if (!pool) return null;
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM buildings WHERE id = ?", [id]);
  return rows[0] || null;
}

export async function updateBuilding(id: number, data: Partial<{
  buildingName: string; buildingNameAr: string; address: string; addressAr: string;
  city: string; cityAr: string; district: string; districtAr: string;
  totalUnits: number; managerId: number; notes: string; isActive: boolean;
}>) {
  const pool = getPool();
  if (!pool) return;
  const fields: string[] = [];
  const values: any[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) { fields.push(`\`${key}\` = ?`); values.push(val); }
  }
  if (fields.length === 0) return;
  values.push(id);
  await pool.execute(`UPDATE buildings SET ${fields.join(", ")} WHERE id = ?`, values);
}

// ─── Units ──────────────────────────────────────────────────────────
export async function createUnit(data: {
  buildingId: number; unitNumber: string; floor?: number;
  bedrooms?: number; bathrooms?: number; sizeSqm?: number;
  unitStatus?: string; monthlyBaseRentSAR?: string; propertyId?: number; notes?: string;
}): Promise<number> {
  const pool = getPool();
  if (!pool) throw new Error("Database not available");
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO units (buildingId, unitNumber, floor, bedrooms, bathrooms, sizeSqm, unitStatus, monthlyBaseRentSAR, propertyId, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.buildingId, data.unitNumber, data.floor || null, data.bedrooms || 1, data.bathrooms || 1,
     data.sizeSqm || null, data.unitStatus || "AVAILABLE", data.monthlyBaseRentSAR || null,
     data.propertyId || null, data.notes || null]
  );
  return result.insertId;
}

export async function getUnitsByBuilding(buildingId: number) {
  const pool = getPool();
  if (!pool) return [];
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM units WHERE buildingId = ? ORDER BY unitNumber ASC", [buildingId]
  );
  return rows;
}

export async function getUnitById(id: number) {
  const pool = getPool();
  if (!pool) return null;
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM units WHERE id = ?", [id]);
  return rows[0] || null;
}

export async function updateUnit(id: number, data: Partial<{
  unitNumber: string; floor: number; bedrooms: number; bathrooms: number;
  sizeSqm: number; unitStatus: string; monthlyBaseRentSAR: string;
  propertyId: number; notes: string;
}>) {
  const pool = getPool();
  if (!pool) return;
  const fields: string[] = [];
  const values: any[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) { fields.push(`\`${key}\` = ?`); values.push(val); }
  }
  if (fields.length === 0) return;
  values.push(id);
  await pool.execute(`UPDATE units SET ${fields.join(", ")} WHERE id = ?`, values);
}

// ─── Beds24 Map ─────────────────────────────────────────────────────
export async function getBeds24MapByUnit(unitId: number) {
  const pool = getPool();
  if (!pool) return null;
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM beds24_map WHERE unitId = ?", [unitId]);
  return rows[0] || null;
}

export async function isUnitBeds24Controlled(unitId: number): Promise<boolean> {
  const mapping = await getBeds24MapByUnit(unitId);
  return mapping?.sourceOfTruth === "BEDS24";
}

// ─── Payment Ledger ─────────────────────────────────────────────────
export async function createLedgerEntry(data: {
  bookingId?: number; beds24BookingId?: string;
  customerId?: number; guestName?: string; guestEmail?: string; guestPhone?: string;
  buildingId?: number; unitId?: number; unitNumber?: string; propertyDisplayName?: string;
  type: string; direction?: string; amount: string; currency?: string;
  status?: string; paymentMethod?: string; provider?: string; providerRef?: string;
  dueAt?: Date; notes?: string; notesAr?: string; createdBy?: number;
}): Promise<{ id: number; invoiceNumber: string }> {
  const pool = getPool();
  if (!pool) throw new Error("Database not available");
  const invoiceNumber = generateInvoiceNumber(data.type);
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO payment_ledger (invoiceNumber, bookingId, beds24BookingId, customerId, guestName, guestEmail, guestPhone,
     buildingId, unitId, unitNumber, propertyDisplayName, type, direction, amount, currency, status,
     paymentMethod, provider, providerRef, dueAt, notes, notesAr, createdBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [invoiceNumber, data.bookingId || null, data.beds24BookingId || null,
     data.customerId || null, data.guestName || null, data.guestEmail || null, data.guestPhone || null,
     data.buildingId || null, data.unitId || null, data.unitNumber || null, data.propertyDisplayName || null,
     data.type, data.direction || "IN", data.amount, data.currency || "SAR",
     data.status || "DUE", data.paymentMethod || null, data.provider || null, data.providerRef || null,
     data.dueAt || null, data.notes || null, data.notesAr || null, data.createdBy || null]
  );
  return { id: result.insertId, invoiceNumber };
}

export async function updateLedgerStatus(id: number, status: string, extras?: {
  paymentMethod?: string; provider?: string; providerRef?: string; paidAt?: Date;
}) {
  const pool = getPool();
  if (!pool) return;
  const fields = ["`status` = ?"];
  const values: any[] = [status];
  if (extras?.paymentMethod) { fields.push("`paymentMethod` = ?"); values.push(extras.paymentMethod); }
  if (extras?.provider) { fields.push("`provider` = ?"); values.push(extras.provider); }
  if (extras?.providerRef) { fields.push("`providerRef` = ?"); values.push(extras.providerRef); }
  if (extras?.paidAt) { fields.push("`paidAt` = ?"); values.push(extras.paidAt); }
  if (status === "PAID" && !extras?.paidAt) { fields.push("`paidAt` = NOW()"); }
  values.push(id);
  await pool.execute(`UPDATE payment_ledger SET ${fields.join(", ")} WHERE id = ?`, values);
}

export async function searchLedger(filters: {
  buildingId?: number; unitId?: number; unitNumber?: string;
  customerId?: number; guestNameOrPhone?: string;
  bookingId?: number; beds24BookingId?: string; invoiceNumber?: string;
  status?: string; type?: string; paymentMethod?: string;
  dateFrom?: string; dateTo?: string;
  limit?: number; offset?: number;
}) {
  const pool = getPool();
  if (!pool) return { items: [], total: 0 };
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;
  let where = "1=1";
  const params: any[] = [];

  if (filters.buildingId) { where += " AND pl.buildingId = ?"; params.push(filters.buildingId); }
  if (filters.unitId) { where += " AND pl.unitId = ?"; params.push(filters.unitId); }
  if (filters.unitNumber) { where += " AND pl.unitNumber LIKE ?"; params.push(`%${filters.unitNumber}%`); }
  if (filters.customerId) { where += " AND pl.customerId = ?"; params.push(filters.customerId); }
  if (filters.guestNameOrPhone) {
    where += " AND (pl.guestName LIKE ? OR pl.guestPhone LIKE ?)";
    params.push(`%${filters.guestNameOrPhone}%`, `%${filters.guestNameOrPhone}%`);
  }
  if (filters.bookingId) { where += " AND pl.bookingId = ?"; params.push(filters.bookingId); }
  if (filters.beds24BookingId) { where += " AND pl.beds24BookingId = ?"; params.push(filters.beds24BookingId); }
  if (filters.invoiceNumber) { where += " AND pl.invoiceNumber LIKE ?"; params.push(`%${filters.invoiceNumber}%`); }
  if (filters.status) { where += " AND pl.status = ?"; params.push(filters.status); }
  if (filters.type) { where += " AND pl.type = ?"; params.push(filters.type); }
  if (filters.paymentMethod) { where += " AND pl.paymentMethod = ?"; params.push(filters.paymentMethod); }
  if (filters.dateFrom) { where += " AND pl.createdAt >= ?"; params.push(filters.dateFrom); }
  if (filters.dateTo) { where += " AND pl.createdAt <= ?"; params.push(filters.dateTo); }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT pl.*, b.buildingName, b.buildingNameAr
     FROM payment_ledger pl
     LEFT JOIN buildings b ON pl.buildingId = b.id
     WHERE ${where}
     ORDER BY pl.createdAt DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countResult] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM payment_ledger pl WHERE ${where}`, params
  );
  return { items: rows, total: (countResult[0] as any)?.total || 0 };
}

export async function getLedgerEntry(id: number) {
  const pool = getPool();
  if (!pool) return null;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT pl.*, b.buildingName, b.buildingNameAr
     FROM payment_ledger pl
     LEFT JOIN buildings b ON pl.buildingId = b.id
     WHERE pl.id = ?`, [id]
  );
  return rows[0] || null;
}

// ─── KPI Calculations ───────────────────────────────────────────────
export interface BuildingKPIs {
  buildingId: number;
  buildingName: string;
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  collectedMTD: number;
  outstandingBalance: number;
  overdueCount: number;
  avgDailyRate: number;
  revPAU: number;
}

export async function getBuildingKPIs(buildingId: number): Promise<BuildingKPIs | null> {
  const pool = getPool();
  if (!pool) return null;

  // Building info
  const [buildingRows] = await pool.query<RowDataPacket[]>("SELECT * FROM buildings WHERE id = ?", [buildingId]);
  if (!buildingRows[0]) return null;
  const building = buildingRows[0];

  // Total units
  const [unitCountRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) as total FROM units WHERE buildingId = ?", [buildingId]
  );
  const totalUnits = (unitCountRows[0] as any)?.total || 0;

  // Occupied units (status = OCCUPIED)
  const [occupiedRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) as total FROM units WHERE buildingId = ? AND unitStatus = 'OCCUPIED'", [buildingId]
  );
  const occupiedUnits = (occupiedRows[0] as any)?.total || 0;

  // Collected MTD (current month, PAID entries)
  const [collectedRows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM payment_ledger
     WHERE buildingId = ? AND status = 'PAID' AND direction = 'IN'
     AND MONTH(paidAt) = MONTH(CURRENT_DATE()) AND YEAR(paidAt) = YEAR(CURRENT_DATE())`,
    [buildingId]
  );
  const collectedMTD = parseFloat((collectedRows[0] as any)?.total || "0");

  // Outstanding balance (DUE + PENDING)
  const [outstandingRows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM payment_ledger
     WHERE buildingId = ? AND status IN ('DUE', 'PENDING') AND direction = 'IN'`,
    [buildingId]
  );
  const outstandingBalance = parseFloat((outstandingRows[0] as any)?.total || "0");

  // Overdue count (DUE and past dueAt)
  const [overdueRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM payment_ledger
     WHERE buildingId = ? AND status = 'DUE' AND dueAt < NOW()`,
    [buildingId]
  );
  const overdueCount = (overdueRows[0] as any)?.total || 0;

  // Avg daily rate: total collected in last 30 days / 30
  const [adrRows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM payment_ledger
     WHERE buildingId = ? AND status = 'PAID' AND direction = 'IN'
     AND paidAt >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)`,
    [buildingId]
  );
  const last30Revenue = parseFloat((adrRows[0] as any)?.total || "0");
  const avgDailyRate = totalUnits > 0 ? last30Revenue / 30 : 0;

  // RevPAU: Revenue Per Available Unit (monthly)
  const revPAU = totalUnits > 0 ? collectedMTD / totalUnits : 0;

  const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

  return {
    buildingId,
    buildingName: building.buildingName,
    totalUnits,
    occupiedUnits,
    occupancyRate: Math.round(occupancyRate * 100) / 100,
    collectedMTD: Math.round(collectedMTD * 100) / 100,
    outstandingBalance: Math.round(outstandingBalance * 100) / 100,
    overdueCount,
    avgDailyRate: Math.round(avgDailyRate * 100) / 100,
    revPAU: Math.round(revPAU * 100) / 100,
  };
}

export async function getGlobalKPIs() {
  const pool = getPool();
  if (!pool) return null;

  const [totalUnitsRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as total FROM units");
  const totalUnits = (totalUnitsRows[0] as any)?.total || 0;

  const [occupiedRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) as total FROM units WHERE unitStatus = 'OCCUPIED'"
  );
  const occupiedUnits = (occupiedRows[0] as any)?.total || 0;

  const [collectedRows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM payment_ledger
     WHERE status = 'PAID' AND direction = 'IN'
     AND MONTH(paidAt) = MONTH(CURRENT_DATE()) AND YEAR(paidAt) = YEAR(CURRENT_DATE())`
  );
  const collectedMTD = parseFloat((collectedRows[0] as any)?.total || "0");

  const [outstandingRows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM payment_ledger
     WHERE status IN ('DUE', 'PENDING') AND direction = 'IN'`
  );
  const outstandingBalance = parseFloat((outstandingRows[0] as any)?.total || "0");

  const [overdueRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) as total FROM payment_ledger WHERE status = 'DUE' AND dueAt < NOW()"
  );
  const overdueCount = (overdueRows[0] as any)?.total || 0;

  const [buildingCount] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) as total FROM buildings WHERE isActive = true");

  return {
    totalBuildings: (buildingCount[0] as any)?.total || 0,
    totalUnits,
    occupiedUnits,
    occupancyRate: totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 10000) / 100 : 0,
    collectedMTD: Math.round(collectedMTD * 100) / 100,
    outstandingBalance: Math.round(outstandingBalance * 100) / 100,
    overdueCount,
    revPAU: totalUnits > 0 ? Math.round((collectedMTD / totalUnits) * 100) / 100 : 0,
  };
}

// ─── Unit Finance Details ───────────────────────────────────────────
export async function getUnitFinanceDetails(unitId: number) {
  const pool = getPool();
  if (!pool) return null;

  const [unitRows] = await pool.query<RowDataPacket[]>(
    `SELECT u.*, b.buildingName, b.buildingNameAr
     FROM units u LEFT JOIN buildings b ON u.buildingId = b.id
     WHERE u.id = ?`, [unitId]
  );
  if (!unitRows[0]) return null;
  const unit = unitRows[0];

  // Ledger entries for this unit
  const [ledgerRows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM payment_ledger WHERE unitId = ? ORDER BY createdAt DESC LIMIT 100", [unitId]
  );

  // Outstanding balance
  const [outstandingRows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM payment_ledger
     WHERE unitId = ? AND status IN ('DUE', 'PENDING') AND direction = 'IN'`, [unitId]
  );
  const outstandingBalance = parseFloat((outstandingRows[0] as any)?.total || "0");

  // Beds24 mapping
  const [beds24Rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM beds24_map WHERE unitId = ?", [unitId]
  );

  // Daily status history (last 90 days)
  const [dailyRows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM unit_daily_status WHERE unitId = ? AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY) ORDER BY date ASC`,
    [unitId]
  );

  return {
    unit,
    ledger: ledgerRows,
    outstandingBalance: Math.round(outstandingBalance * 100) / 100,
    beds24Mapping: beds24Rows[0] || null,
    occupancyTimeline: dailyRows,
  };
}

// ─── Building Units with Finance Summary ────────────────────────────
export async function getBuildingUnitsWithFinance(buildingId: number) {
  const pool = getPool();
  if (!pool) return [];

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.*,
       (SELECT COALESCE(SUM(pl.amount), 0) FROM payment_ledger pl
        WHERE pl.unitId = u.id AND pl.status = 'PAID' AND pl.direction = 'IN'
        AND MONTH(pl.paidAt) = MONTH(CURRENT_DATE()) AND YEAR(pl.paidAt) = YEAR(CURRENT_DATE())) as collectedMTD,
       (SELECT COALESCE(SUM(pl.amount), 0) FROM payment_ledger pl
        WHERE pl.unitId = u.id AND pl.status IN ('DUE', 'PENDING') AND pl.direction = 'IN') as outstandingBalance,
       (SELECT COUNT(*) FROM payment_ledger pl
        WHERE pl.unitId = u.id AND pl.status = 'DUE' AND pl.dueAt < NOW()) as overdueCount,
       (SELECT pl.dueAt FROM payment_ledger pl
        WHERE pl.unitId = u.id AND pl.status = 'DUE' AND pl.direction = 'IN'
        ORDER BY pl.dueAt ASC LIMIT 1) as nextDueDate,
       (SELECT pl.guestName FROM payment_ledger pl
        WHERE pl.unitId = u.id ORDER BY pl.createdAt DESC LIMIT 1) as lastGuestName
     FROM units u
     WHERE u.buildingId = ?
     ORDER BY u.unitNumber ASC`,
    [buildingId]
  );
  return rows;
}

// ─── Payment Method Settings ────────────────────────────────────────
export async function getPaymentMethods() {
  const pool = getPool();
  if (!pool) return [];
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM payment_method_settings ORDER BY sortOrder ASC"
    );
    return rows;
  } catch {
    return [];
  }
}

export async function updatePaymentMethod(methodKey: string, data: {
  isEnabled?: boolean; apiKeyConfigured?: boolean; configJson?: Record<string, unknown>;
}) {
  const pool = getPool();
  if (!pool) return;
  const fields: string[] = [];
  const values: any[] = [];
  if (data.isEnabled !== undefined) { fields.push("`isEnabled` = ?"); values.push(data.isEnabled); }
  if (data.apiKeyConfigured !== undefined) { fields.push("`apiKeyConfigured` = ?"); values.push(data.apiKeyConfigured); }
  if (data.configJson !== undefined) { fields.push("`configJson` = ?"); values.push(JSON.stringify(data.configJson)); }
  if (fields.length === 0) return;
  values.push(methodKey);
  await pool.execute(`UPDATE payment_method_settings SET ${fields.join(", ")} WHERE methodKey = ?`, values);
}

export async function getEnabledPaymentMethods() {
  const pool = getPool();
  if (!pool) return [];
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM payment_method_settings WHERE isEnabled = true AND apiKeyConfigured = true ORDER BY sortOrder ASC"
    );
    return rows;
  } catch {
    return [];
  }
}
