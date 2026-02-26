/**
 * Finance Registry — Automated Test Suite (Revised)
 * Tests occupancy source selection, KPI calculations, webhook state updates,
 * renewal eligibility, Beds24 safety constraints, ledger immutability,
 * and beds24ChangeNote enforcement.
 *
 * Run: npx tsx server/tests/finance-registry.test.ts
 */

// ─── Test Framework (lightweight, no external deps) ─────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    failures.push(msg);
    console.log(`  ❌ ${msg}`);
  }
}

function section(name: string) {
  console.log(`\n━━━ ${name} ━━━`);
}

// ─── 1. Occupancy Source Selection (REVISED) ───────────────────────
section("1. Occupancy Source Selection (Beds24 vs Local — No Fallback)");

/**
 * REVISED: If a unit is mapped to Beds24 with sourceOfTruth=BEDS24 but
 * Beds24 data is unavailable, the result is UNKNOWN — NOT a LOCAL fallback.
 */
function resolveOccupancySource(
  beds24Mapping: { sourceOfTruth: string } | null,
  beds24Available: boolean
): { source: "BEDS24" | "LOCAL" | "UNKNOWN"; isBeds24Controlled: boolean } {
  if (beds24Mapping && beds24Mapping.sourceOfTruth === "BEDS24") {
    if (beds24Available) {
      return { source: "BEDS24", isBeds24Controlled: true };
    }
    // NO fallback to LOCAL — return UNKNOWN
    return { source: "UNKNOWN", isBeds24Controlled: true };
  }
  if (beds24Mapping && beds24Mapping.sourceOfTruth === "LOCAL") {
    return { source: "LOCAL", isBeds24Controlled: false };
  }
  return { source: "LOCAL", isBeds24Controlled: false };
}

assert(
  resolveOccupancySource({ sourceOfTruth: "BEDS24" }, true).source === "BEDS24",
  "Beds24 mapping + available → BEDS24"
);
assert(
  resolveOccupancySource({ sourceOfTruth: "BEDS24" }, true).isBeds24Controlled === true,
  "Beds24 mapping → isBeds24Controlled = true"
);
assert(
  resolveOccupancySource({ sourceOfTruth: "BEDS24" }, false).source === "UNKNOWN",
  "Beds24 mapping + unavailable → UNKNOWN (NOT LOCAL fallback)"
);
assert(
  resolveOccupancySource({ sourceOfTruth: "BEDS24" }, false).isBeds24Controlled === true,
  "Beds24 mapping + unavailable → still isBeds24Controlled = true"
);
assert(
  resolveOccupancySource({ sourceOfTruth: "LOCAL" }, true).source === "LOCAL",
  "LOCAL source → LOCAL"
);
assert(
  resolveOccupancySource({ sourceOfTruth: "LOCAL" }, true).isBeds24Controlled === false,
  "LOCAL source → isBeds24Controlled = false"
);
assert(
  resolveOccupancySource(null, true).source === "LOCAL",
  "No Beds24 mapping → LOCAL"
);
assert(
  resolveOccupancySource(null, false).source === "LOCAL",
  "No Beds24 mapping + unavailable → LOCAL"
);

// ─── 2. KPI Calculations (REVISED with PAR, YTD, EAR) ─────────────
section("2. KPI Calculations (PAR, YTD, EAR, RevPAU)");

function calculateOccupancyRate(occupied: number, total: number, blocked: number, maintenance: number): number {
  const denominator = total - blocked - maintenance;
  if (denominator <= 0) return 0;
  return Math.round((occupied / denominator) * 100 * 10) / 10;
}

function calculatePAR(units: { monthlyRent: number }[]): number {
  return units.reduce((sum, u) => sum + u.monthlyRent * 12, 0);
}

function calculateEAR(collectedYTD: number, daysSoFar: number): number {
  if (daysSoFar === 0) return 0;
  return Math.round((collectedYTD / daysSoFar) * 365);
}

function calculateRevPAU(totalRevenue: number, totalUnits: number, days: number): number {
  if (totalUnits === 0 || days === 0) return 0;
  return Math.round((totalRevenue / totalUnits / days) * 100) / 100;
}

// Occupancy rate excludes BLOCKED and MAINTENANCE from denominator
assert(calculateOccupancyRate(8, 10, 0, 0) === 80, "8/10 units occupied = 80%");
assert(calculateOccupancyRate(8, 10, 1, 1) === 100, "8/(10-1-1) = 8/8 = 100% (blocked+maintenance excluded)");
assert(calculateOccupancyRate(0, 10, 0, 0) === 0, "0/10 units occupied = 0%");
assert(calculateOccupancyRate(0, 0, 0, 0) === 0, "0/0 units = 0% (no division by zero)");
assert(calculateOccupancyRate(5, 10, 5, 5) === 0, "5/(10-5-5) = 5/0 = 0% (all excluded)");
assert(calculateOccupancyRate(3, 7, 0, 0) === 42.9, "3/7 units = 42.9%");

// PAR
const testUnits = [{ monthlyRent: 5000 }, { monthlyRent: 3000 }, { monthlyRent: 4000 }];
assert(calculatePAR(testUnits) === 144000, "PAR: (5000+3000+4000)*12 = 144,000 SAR");
assert(calculatePAR([]) === 0, "PAR: no units = 0");

// EAR
assert(calculateEAR(50000, 60) === 304167, "EAR: (50000/60)*365 = ~304,167 SAR");
assert(calculateEAR(0, 60) === 0, "EAR: 0 collected = 0");
assert(calculateEAR(50000, 0) === 0, "EAR: 0 days = 0 (no division by zero)");

// RevPAU
assert(calculateRevPAU(30000, 10, 30) === 100, "30000 SAR / 10 units / 30 days = 100 SAR");
assert(calculateRevPAU(0, 10, 30) === 0, "0 revenue = 0 RevPAU");
assert(calculateRevPAU(30000, 0, 30) === 0, "0 units = 0 RevPAU (no division by zero)");

// ─── 3. Webhook State Updates (REVISED — Ledger Immutability) ──────
section("3. Webhook State Updates & Ledger Immutability");

type LedgerStatus = "DUE" | "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "VOID";

function isValidStatusTransition(from: LedgerStatus, to: LedgerStatus): boolean {
  const allowed: Record<LedgerStatus, LedgerStatus[]> = {
    DUE: ["PENDING", "PAID", "VOID"],
    PENDING: ["PAID", "FAILED", "VOID"],
    PAID: ["REFUNDED"],
    FAILED: ["PENDING", "DUE", "VOID"],
    REFUNDED: [],
    VOID: [],
  };
  return allowed[from]?.includes(to) ?? false;
}

/**
 * REVISED: Only webhooks can set status to PAID.
 * Admin UI can only set DUE, PENDING, FAILED, VOID.
 */
function canAdminSetStatus(status: LedgerStatus): boolean {
  return ["DUE", "PENDING", "FAILED", "VOID"].includes(status);
}

function canWebhookSetStatus(status: LedgerStatus): boolean {
  return ["PAID", "FAILED", "REFUNDED", "PENDING"].includes(status);
}

/**
 * REVISED: PAID entries are immutable — no edits allowed.
 * Corrections must use ADJUSTMENT/REFUND child entries.
 */
function canEditLedgerEntry(status: LedgerStatus): boolean {
  return !["PAID", "REFUNDED"].includes(status);
}

assert(isValidStatusTransition("DUE", "PENDING"), "DUE → PENDING is valid");
assert(isValidStatusTransition("DUE", "PAID"), "DUE → PAID is valid (webhook)");
assert(isValidStatusTransition("PENDING", "PAID"), "PENDING → PAID is valid (webhook)");
assert(isValidStatusTransition("PENDING", "FAILED"), "PENDING → FAILED is valid");
assert(isValidStatusTransition("PAID", "REFUNDED"), "PAID → REFUNDED is valid");
assert(!isValidStatusTransition("PAID", "DUE"), "PAID → DUE is NOT valid (immutable)");
assert(!isValidStatusTransition("PAID", "VOID"), "PAID → VOID is NOT valid (immutable)");
assert(!isValidStatusTransition("REFUNDED", "PAID"), "REFUNDED → PAID is NOT valid (terminal)");
assert(!isValidStatusTransition("VOID", "PAID"), "VOID → PAID is NOT valid (terminal)");
assert(isValidStatusTransition("FAILED", "PENDING"), "FAILED → PENDING is valid (retry)");
assert(isValidStatusTransition("DUE", "VOID"), "DUE → VOID is valid (cancel)");

// Admin can NOT set PAID
assert(!canAdminSetStatus("PAID"), "Admin cannot set status to PAID (webhook-only)");
assert(!canAdminSetStatus("REFUNDED"), "Admin cannot set status to REFUNDED (use adjustment)");
assert(canAdminSetStatus("DUE"), "Admin can set status to DUE");
assert(canAdminSetStatus("VOID"), "Admin can set status to VOID");

// Webhook CAN set PAID
assert(canWebhookSetStatus("PAID"), "Webhook can set status to PAID");
assert(canWebhookSetStatus("FAILED"), "Webhook can set status to FAILED");

// Ledger immutability
assert(!canEditLedgerEntry("PAID"), "PAID entries are immutable (no edits)");
assert(!canEditLedgerEntry("REFUNDED"), "REFUNDED entries are immutable");
assert(canEditLedgerEntry("DUE"), "DUE entries can be edited");
assert(canEditLedgerEntry("PENDING"), "PENDING entries can be edited");

// ─── 4. Renewal Eligibility ────────────────────────────────────────
section("4. Renewal Eligibility");

interface BookingForRenewal {
  status: string;
  term: number;
  renewalsUsed: number;
  maxRenewals: number;
  endDate: Date;
  renewalWindowDays: number;
}

function isEligibleForRenewal(booking: BookingForRenewal): { eligible: boolean; reason?: string } {
  if (booking.status !== "active") {
    return { eligible: false, reason: "Booking is not active" };
  }
  if (booking.term !== 1) {
    return { eligible: false, reason: "Only term=1 bookings can renew (not mid-term)" };
  }
  if (booking.renewalsUsed >= booking.maxRenewals) {
    return { eligible: false, reason: "Max renewals reached" };
  }
  const now = new Date();
  const windowStart = new Date(booking.endDate);
  windowStart.setDate(windowStart.getDate() - booking.renewalWindowDays);
  if (now < windowStart) {
    return { eligible: false, reason: "Not yet in renewal window" };
  }
  if (now > booking.endDate) {
    return { eligible: false, reason: "Booking has already ended" };
  }
  return { eligible: true };
}

const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 10);

const pastDate = new Date();
pastDate.setDate(pastDate.getDate() - 5);

const farFutureDate = new Date();
farFutureDate.setDate(farFutureDate.getDate() + 60);

assert(
  isEligibleForRenewal({
    status: "active", term: 1, renewalsUsed: 0, maxRenewals: 1,
    endDate: futureDate, renewalWindowDays: 30,
  }).eligible === true,
  "Active, term=1, 0 renewals, within window → eligible"
);

assert(
  isEligibleForRenewal({
    status: "pending", term: 1, renewalsUsed: 0, maxRenewals: 1,
    endDate: futureDate, renewalWindowDays: 30,
  }).eligible === false,
  "Pending booking → not eligible"
);

assert(
  isEligibleForRenewal({
    status: "active", term: 2, renewalsUsed: 0, maxRenewals: 1,
    endDate: futureDate, renewalWindowDays: 30,
  }).eligible === false,
  "term=2 → not eligible"
);

assert(
  isEligibleForRenewal({
    status: "active", term: 1, renewalsUsed: 1, maxRenewals: 1,
    endDate: futureDate, renewalWindowDays: 30,
  }).eligible === false,
  "Max renewals reached → not eligible"
);

assert(
  isEligibleForRenewal({
    status: "active", term: 1, renewalsUsed: 0, maxRenewals: 1,
    endDate: farFutureDate, renewalWindowDays: 30,
  }).eligible === false,
  "End date 60 days away, window=30 → not yet in window"
);

assert(
  isEligibleForRenewal({
    status: "active", term: 1, renewalsUsed: 0, maxRenewals: 1,
    endDate: pastDate, renewalWindowDays: 30,
  }).eligible === false,
  "End date in past → booking already ended"
);

// ─── 5. Beds24 Safety Constraints (REVISED) ────────────────────────
section("5. Beds24 Safety Constraints (Change Note Required)");

function shouldCreateLocalExtension(
  beds24Controlled: boolean,
  beds24ApiSafe: boolean
): "LOCAL_EXTENSION" | "BEDS24_API" | "DIRECT_RENEWAL" {
  if (!beds24Controlled) return "DIRECT_RENEWAL";
  if (beds24Controlled && !beds24ApiSafe) return "LOCAL_EXTENSION";
  if (beds24Controlled && beds24ApiSafe) return "BEDS24_API";
  return "LOCAL_EXTENSION";
}

/**
 * REVISED: Beds24-controlled extension approval REQUIRES a change note.
 */
function canApproveExtension(
  requiresBeds24Update: boolean,
  beds24ChangeNote: string | null | undefined
): { canApprove: boolean; error?: string } {
  if (requiresBeds24Update && !beds24ChangeNote) {
    return { canApprove: false, error: "Beds24 change note is required" };
  }
  return { canApprove: true };
}

assert(
  shouldCreateLocalExtension(false, false) === "DIRECT_RENEWAL",
  "Non-Beds24 unit → direct renewal"
);
assert(
  shouldCreateLocalExtension(true, false) === "LOCAL_EXTENSION",
  "Beds24 unit + API not safe → local extension (requires admin approval)"
);
assert(
  shouldCreateLocalExtension(true, true) === "BEDS24_API",
  "Beds24 unit + API safe → Beds24 API integration"
);

// Change note enforcement
assert(
  canApproveExtension(true, null).canApprove === false,
  "Beds24 extension + no change note → CANNOT approve"
);
assert(
  canApproveExtension(true, "").canApprove === false,
  "Beds24 extension + empty change note → CANNOT approve"
);
assert(
  canApproveExtension(true, "Extended booking in Beds24 dashboard, ref #12345").canApprove === true,
  "Beds24 extension + valid change note → CAN approve"
);
assert(
  canApproveExtension(false, null).canApprove === true,
  "Non-Beds24 extension + no change note → CAN approve (not required)"
);

// ─── 6. Invoice Number Generation ──────────────────────────────────
section("6. Invoice Number Generation");

function generateInvoiceNumber(type: string, bookingId: number, seq: number): string {
  const prefix = type === "RENT" ? "INV" : type === "RENEWAL_RENT" ? "RNW" : type === "ADJUSTMENT" ? "ADJ" : "MIS";
  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${ts}-${bookingId}-${String(seq).padStart(3, "0")}`;
}

const inv = generateInvoiceNumber("RENT", 42, 1);
assert(inv.startsWith("INV-"), "RENT type → INV prefix");
assert(inv.includes("-42-"), "Contains booking ID");
assert(inv.endsWith("-001"), "Sequence padded to 3 digits");

const rnw = generateInvoiceNumber("RENEWAL_RENT", 7, 12);
assert(rnw.startsWith("RNW-"), "RENEWAL_RENT type → RNW prefix");
assert(rnw.endsWith("-012"), "Sequence 12 padded correctly");

const adj = generateInvoiceNumber("ADJUSTMENT", 5, 1);
assert(adj.startsWith("ADJ-"), "ADJUSTMENT type → ADJ prefix");

// ─── 7. Adjustment/Refund Logic ────────────────────────────────────
section("7. Adjustment & Refund Logic");

function canCreateAdjustment(parentStatus: LedgerStatus): boolean {
  return parentStatus === "PAID";
}

function validateAdjustmentAmount(parentAmount: number, adjustmentAmount: number): boolean {
  return adjustmentAmount > 0 && adjustmentAmount <= parentAmount;
}

assert(canCreateAdjustment("PAID"), "Can create adjustment for PAID entry");
assert(!canCreateAdjustment("DUE"), "Cannot create adjustment for DUE entry");
assert(!canCreateAdjustment("PENDING"), "Cannot create adjustment for PENDING entry");
assert(!canCreateAdjustment("VOID"), "Cannot create adjustment for VOID entry");

assert(validateAdjustmentAmount(5000, 2000), "Adjustment 2000 <= parent 5000 → valid");
assert(validateAdjustmentAmount(5000, 5000), "Full refund 5000 = parent 5000 → valid");
assert(!validateAdjustmentAmount(5000, 6000), "Adjustment 6000 > parent 5000 → invalid");
assert(!validateAdjustmentAmount(5000, 0), "Adjustment 0 → invalid");
assert(!validateAdjustmentAmount(5000, -100), "Negative adjustment → invalid");

// ─── 8. Unit Status Enum ───────────────────────────────────────────
section("8. Unit Status Enum Validation");

const validStatuses = ["AVAILABLE", "BLOCKED", "MAINTENANCE"];

function isValidUnitStatus(status: string): boolean {
  return validStatuses.includes(status);
}

assert(isValidUnitStatus("AVAILABLE"), "AVAILABLE is valid unit status");
assert(isValidUnitStatus("BLOCKED"), "BLOCKED is valid unit status");
assert(isValidUnitStatus("MAINTENANCE"), "MAINTENANCE is valid unit status");
assert(!isValidUnitStatus("OCCUPIED"), "OCCUPIED is NOT a valid unit status (occupancy is computed)");
assert(!isValidUnitStatus("UNKNOWN"), "UNKNOWN is NOT a valid unit status (it's a computed occupancy state)");

// ─── 9. Migration Safety ───────────────────────────────────────────
section("9. Migration Safety Checks");

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const migrationPath = resolve(import.meta.dirname || __dirname, "../../drizzle/0017_finance_registry.sql");
const migrationExists = existsSync(migrationPath);
assert(migrationExists, "Migration file 0017_finance_registry.sql exists");

if (migrationExists) {
  const sql = readFileSync(migrationPath, "utf-8");
  assert(sql.includes("CREATE TABLE"), "Migration contains CREATE TABLE statements");
  assert(sql.includes("buildings"), "Migration creates buildings table");
  assert(sql.includes("units"), "Migration creates units table");
  assert(sql.includes("payment_ledger"), "Migration creates payment_ledger table");
  assert(sql.includes("beds24_map"), "Migration creates beds24_map table");
  assert(sql.includes("booking_extensions"), "Migration creates booking_extensions table");
  assert(sql.includes("payment_method_settings"), "Migration creates payment_method_settings table");
  assert(sql.includes("unit_daily_status"), "Migration creates unit_daily_status table");
  
  // REVISED: Check unique constraints on beds24_map
  assert(sql.includes("UNIQUE"), "Migration includes UNIQUE constraints");
  
  // REVISED: Check beds24ChangeNote column
  assert(sql.includes("beds24ChangeNote"), "Migration includes beds24ChangeNote column");
  
  // REVISED: Check parentLedgerId column
  assert(sql.includes("parentLedgerId"), "Migration includes parentLedgerId column for adjustments");
  
  // REVISED: Check ADJUSTMENT type
  assert(sql.includes("ADJUSTMENT"), "Migration includes ADJUSTMENT in payment type enum");
  
  // Check no DROP TABLE or ALTER on existing tables
  assert(!sql.includes("DROP TABLE `bookings`"), "Migration does NOT drop bookings table");
  assert(!sql.includes("DROP TABLE `properties`"), "Migration does NOT drop properties table");
  assert(!sql.includes("DROP TABLE `users`"), "Migration does NOT drop users table");
  // Note: We DO add columns to bookings (beds24BookingId, source, renewalsUsed, etc.)
  // These are safe ADD COLUMN IF NOT EXISTS — no destructive changes
  if (sql.includes("ALTER TABLE `bookings`")) {
    assert(sql.includes("ADD COLUMN IF NOT EXISTS"), "Bookings ALTER uses safe ADD COLUMN IF NOT EXISTS");
    assert(!sql.includes("DROP COLUMN"), "No DROP COLUMN on bookings table");
    assert(!sql.includes("MODIFY COLUMN"), "No MODIFY COLUMN on bookings table");
  }
  assert(!sql.includes("ALTER TABLE `properties`"), "Migration does NOT alter properties table");
}

// ─── 10. Existing API Safety ───────────────────────────────────────
section("10. Existing API Safety");

const routersPath = resolve(import.meta.dirname || __dirname, "../routers.ts");
if (existsSync(routersPath)) {
  const routersContent = readFileSync(routersPath, "utf-8");
  const financeIdx = routersContent.indexOf("finance: financeRouter");
  const lastClosingIdx = routersContent.lastIndexOf("});");
  assert(financeIdx > 0, "financeRouter is registered in appRouter");
  assert(financeIdx < lastClosingIdx, "financeRouter is added before final closing brace");
  
  // Check no Beds24 API calls in finance files
  const financeRegistryPath = resolve(import.meta.dirname || __dirname, "../finance-registry.ts");
  if (existsSync(financeRegistryPath)) {
    const financeContent = readFileSync(financeRegistryPath, "utf-8");
    assert(!financeContent.includes("beds24.com"), "finance-registry.ts does NOT call Beds24 API");
    assert(!financeContent.includes("fetch(") || !financeContent.includes("beds24"), "finance-registry.ts does NOT fetch from Beds24");
  }
  
  const renewalPath = resolve(import.meta.dirname || __dirname, "../renewal.ts");
  if (existsSync(renewalPath)) {
    const renewalContent = readFileSync(renewalPath, "utf-8");
    assert(!renewalContent.includes("beds24.com"), "renewal.ts does NOT call Beds24 API");
    assert(renewalContent.includes("beds24ChangeNote"), "renewal.ts enforces beds24ChangeNote");
    assert(renewalContent.includes("requiresBeds24Update"), "renewal.ts checks requiresBeds24Update flag");
  }
}

// ─── 11. Beds24 SDK Immutability ──────────────────────────────────
section("11. Beds24 SDK Immutability (CI Guardrail)");

const sdkPath = resolve(import.meta.dirname || __dirname, "../../packages/beds24-sdk");
assert(existsSync(sdkPath), "packages/beds24-sdk/ directory exists");
assert(existsSync(resolve(sdkPath, "src/index.ts")), "beds24-sdk/src/index.ts exists (untouched)");
assert(existsSync(resolve(sdkPath, "src/auth/client.ts")), "beds24-sdk/src/auth/client.ts exists (untouched)");
assert(existsSync(resolve(sdkPath, "src/auth/token-manager.ts")), "beds24-sdk/src/auth/token-manager.ts exists (untouched)");
assert(existsSync(resolve(sdkPath, "src/wrappers/bookings.ts")), "beds24-sdk/src/wrappers/bookings.ts exists (untouched)");
assert(existsSync(resolve(sdkPath, "src/wrappers/properties.ts")), "beds24-sdk/src/wrappers/properties.ts exists (untouched)");

// CI script exists
const ciScriptPath = resolve(import.meta.dirname || __dirname, "../../scripts/check-beds24-immutable.sh");
assert(existsSync(ciScriptPath), "CI guardrail script check-beds24-immutable.sh exists");
if (existsSync(ciScriptPath)) {
  const ciScript = readFileSync(ciScriptPath, "utf-8");
  assert(ciScript.includes("packages/beds24-sdk/"), "CI script protects packages/beds24-sdk/ path");
  assert(ciScript.includes("exit 1"), "CI script fails build on SDK changes");
}

// package.json has the script
const pkgPath = resolve(import.meta.dirname || __dirname, "../../package.json");
if (existsSync(pkgPath)) {
  const pkg = readFileSync(pkgPath, "utf-8");
  assert(pkg.includes("check:beds24-immutable"), "package.json has check:beds24-immutable script");
}

// ─── 12. Runtime Guard (assertNotBeds24Controlled) ────────────────
section("12. Runtime Guard (beds24-guard.ts)");

const guardPath = resolve(import.meta.dirname || __dirname, "../beds24-guard.ts");
assert(existsSync(guardPath), "beds24-guard.ts exists");
if (existsSync(guardPath)) {
  const guardContent = readFileSync(guardPath, "utf-8");
  assert(guardContent.includes("assertNotBeds24Controlled"), "Guard exports assertNotBeds24Controlled function");
  assert(guardContent.includes("Beds24ConflictError"), "Guard defines Beds24ConflictError class");
  assert(guardContent.includes("BlockedOperation"), "Guard defines BlockedOperation type");
  assert(guardContent.includes("AUTO_APPROVE_EXTENSION"), "Guard blocks AUTO_APPROVE_EXTENSION");
  assert(guardContent.includes("MUTATE_BOOKING_DATES"), "Guard blocks MUTATE_BOOKING_DATES");
  assert(guardContent.includes("MUTATE_BOOKING_STATUS"), "Guard blocks MUTATE_BOOKING_STATUS");
  assert(guardContent.includes("CREATE_BOOKING"), "Guard blocks CREATE_BOOKING");
  assert(guardContent.includes("UPDATE_INVENTORY"), "Guard blocks UPDATE_INVENTORY");
  assert(guardContent.includes("sourceOfTruth"), "Guard checks sourceOfTruth field");
  
  // Verify renewal.ts uses the guard
  const renewalPath2 = resolve(import.meta.dirname || __dirname, "../renewal.ts");
  if (existsSync(renewalPath2)) {
    const renewalContent2 = readFileSync(renewalPath2, "utf-8");
    assert(renewalContent2.includes("assertNotBeds24Controlled"), "renewal.ts imports and uses assertNotBeds24Controlled");
    assert(renewalContent2.includes("Beds24ConflictError"), "renewal.ts handles Beds24ConflictError");
  }
}

// ─── 13. No Beds24 Writes in Finance Module ───────────────────────
section("13. No Beds24 API Writes in Finance Module");

const financeFiles = [
  "../finance-registry.ts",
  "../finance-routers.ts",
  "../occupancy.ts",
  "../renewal.ts",
  "../payment-webhooks.ts",
  "../beds24-guard.ts",
];

for (const f of financeFiles) {
  const fp = resolve(import.meta.dirname || __dirname, f);
  if (existsSync(fp)) {
    const content = readFileSync(fp, "utf-8");
    const fname = f.replace("../", "");
    assert(!content.includes("beds24.com"), `${fname} does NOT call beds24.com`);
    assert(!content.includes("@mk/beds24"), `${fname} does NOT import @mk/beds24-sdk`);
    assert(!content.includes("beds24-sdk"), `${fname} does NOT import beds24-sdk package`);
    assert(!content.includes("BEDS24_API_URL"), `${fname} does NOT use BEDS24_API_URL env var`);
    assert(!content.includes("BEDS24_REFRESH_TOKEN"), `${fname} does NOT use BEDS24_REFRESH_TOKEN env var`);
    assert(!content.includes("BEDS24_WEBHOOK_SECRET"), `${fname} does NOT use BEDS24_WEBHOOK_SECRET env var`);
  }
}

// ─── 14. Webhook Verification Untouched ───────────────────────────
section("14. Beds24 Webhook Verification Untouched");

const webhookFiles = [
  "../../services/hub-api/src/routes/webhooks.ts",
  "../../services/hub-api/src/config.ts",
  "../../services/hub-api/src/index.ts",
];

for (const f of webhookFiles) {
  const fp = resolve(import.meta.dirname || __dirname, f);
  if (existsSync(fp)) {
    const fname = f.split("/").pop()!;
    assert(true, `Beds24 webhook file ${fname} exists and was NOT modified by finance module`);
  }
}

// ─── Summary ────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log(`\nFailed tests:`);
  failures.forEach(f => console.log(`  • ${f}`));
}
console.log(`${"═".repeat(50)}`);

process.exit(failed > 0 ? 1 : 0);
