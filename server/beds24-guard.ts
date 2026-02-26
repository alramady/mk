/**
 * Beds24 Runtime Guardrail
 * 
 * Prevents local operations that would conflict with Beds24-controlled units.
 * This guard MUST be called before any operation that could affect:
 * - Booking dates/status
 * - Inventory/availability
 * - Auto-approving extensions
 * 
 * For units where source_of_truth='BEDS24', these operations are BLOCKED.
 * The admin must make changes directly in Beds24 and document them via beds24ChangeNote.
 */
import { getPool } from "./db";
import type { RowDataPacket } from "mysql2";

export type BlockedOperation =
  | "AUTO_APPROVE_EXTENSION"
  | "MUTATE_BOOKING_DATES"
  | "MUTATE_BOOKING_STATUS"
  | "CREATE_BOOKING"
  | "CANCEL_BOOKING"
  | "UPDATE_INVENTORY"
  | "UPDATE_AVAILABILITY";

export class Beds24ConflictError extends Error {
  public readonly unitId: number;
  public readonly operation: BlockedOperation;
  public readonly beds24PropertyId: string | null;

  constructor(unitId: number, operation: BlockedOperation, beds24PropertyId: string | null) {
    super(
      `Operation "${operation}" is BLOCKED for unit ${unitId}. ` +
      `This unit is controlled by Beds24 (property: ${beds24PropertyId || "unknown"}). ` +
      `Changes must be made directly in Beds24, not through the local system.`
    );
    this.name = "Beds24ConflictError";
    this.unitId = unitId;
    this.operation = operation;
    this.beds24PropertyId = beds24PropertyId;
  }
}

/**
 * Assert that a unit is NOT Beds24-controlled before performing a local operation.
 * 
 * @throws Beds24ConflictError if the unit is mapped with source_of_truth='BEDS24'
 * 
 * Usage:
 *   await assertNotBeds24Controlled(unitId, "MUTATE_BOOKING_DATES");
 *   // ... proceed with local operation only if no error thrown
 */
export async function assertNotBeds24Controlled(
  unitId: number,
  operation: BlockedOperation
): Promise<void> {
  const pool = getPool();
  if (!pool) return; // No DB = no guard (dev mode)

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT beds24PropertyId, sourceOfTruth FROM beds24_map WHERE unitId = ? LIMIT 1",
    [unitId]
  );

  if (rows[0] && rows[0].sourceOfTruth === "BEDS24") {
    throw new Beds24ConflictError(unitId, operation, rows[0].beds24PropertyId);
  }
}

/**
 * Check if a unit is Beds24-controlled (non-throwing version).
 * Returns the mapping info or null.
 */
export async function getBeds24Guard(unitId: number): Promise<{
  isBeds24Controlled: boolean;
  beds24PropertyId: string | null;
  sourceOfTruth: "BEDS24" | "LOCAL";
  connectionType: "API" | "ICAL" | null;
} | null> {
  const pool = getPool();
  if (!pool) return null;

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT beds24PropertyId, sourceOfTruth, connectionType FROM beds24_map WHERE unitId = ? LIMIT 1",
    [unitId]
  );

  if (!rows[0]) return null;

  return {
    isBeds24Controlled: rows[0].sourceOfTruth === "BEDS24",
    beds24PropertyId: rows[0].beds24PropertyId,
    sourceOfTruth: rows[0].sourceOfTruth,
    connectionType: rows[0].connectionType,
  };
}

/**
 * Batch check: returns a Set of unit IDs that are Beds24-controlled.
 * Useful for filtering lists.
 */
export async function getBeds24ControlledUnitIds(): Promise<Set<number>> {
  const pool = getPool();
  if (!pool) return new Set();

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT unitId FROM beds24_map WHERE sourceOfTruth = 'BEDS24'"
  );

  return new Set(rows.map((r) => r.unitId));
}
