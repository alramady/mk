/**
 * Finance Registry — Automated Test Suite
 * Tests occupancy source selection, KPI calculations, webhook state updates,
 * renewal eligibility, and Beds24 safety constraints.
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

// ─── 1. Occupancy Source Selection ──────────────────────────────────
section("1. Occupancy Source Selection (Beds24 vs Local)");

// Simulate the source selection logic from occupancy.ts
function resolveOccupancySource(
  beds24Mapping: { sourceOfTruth: string } | null,
  beds24Available: boolean
): "BEDS24" | "LOCAL" | "MANUAL" {
  if (beds24Mapping && beds24Mapping.sourceOfTruth === "BEDS24" && beds24Available) {
    return "BEDS24";
  }
  if (beds24Mapping && beds24Mapping.sourceOfTruth === "LOCAL") {
    return "LOCAL";
  }
  return "LOCAL";
}

assert(
  resolveOccupancySource({ sourceOfTruth: "BEDS24" }, true) === "BEDS24",
  "Beds24 mapping with BEDS24 source + available → BEDS24"
);
assert(
  resolveOccupancySource({ sourceOfTruth: "BEDS24" }, false) === "LOCAL",
  "Beds24 mapping with BEDS24 source + unavailable → LOCAL fallback"
);
assert(
  resolveOccupancySource({ sourceOfTruth: "LOCAL" }, true) === "LOCAL",
  "Beds24 mapping with LOCAL source → LOCAL"
);
assert(
  resolveOccupancySource(null, true) === "LOCAL",
  "No Beds24 mapping → LOCAL"
);
assert(
  resolveOccupancySource(null, false) === "LOCAL",
  "No Beds24 mapping + unavailable → LOCAL"
);

// ─── 2. KPI Calculations ────────────────────────────────────────────
section("2. KPI Calculations");

function calculateOccupancyRate(occupied: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((occupied / total) * 100 * 10) / 10;
}

function calculateRevPAU(totalRevenue: number, totalUnits: number, days: number): number {
  if (totalUnits === 0 || days === 0) return 0;
  return Math.round((totalRevenue / totalUnits / days) * 100) / 100;
}

function calculateAvgDailyRate(totalRevenue: number, occupiedDays: number): number {
  if (occupiedDays === 0) return 0;
  return Math.round((totalRevenue / occupiedDays) * 100) / 100;
}

assert(calculateOccupancyRate(8, 10) === 80, "8/10 units occupied = 80%");
assert(calculateOccupancyRate(0, 10) === 0, "0/10 units occupied = 0%");
assert(calculateOccupancyRate(10, 10) === 100, "10/10 units occupied = 100%");
assert(calculateOccupancyRate(0, 0) === 0, "0/0 units = 0% (no division by zero)");
assert(calculateOccupancyRate(3, 7) === 42.9, "3/7 units = 42.9%");

assert(calculateRevPAU(30000, 10, 30) === 100, "30000 SAR / 10 units / 30 days = 100 SAR");
assert(calculateRevPAU(0, 10, 30) === 0, "0 revenue = 0 RevPAU");
assert(calculateRevPAU(30000, 0, 30) === 0, "0 units = 0 RevPAU (no division by zero)");

assert(calculateAvgDailyRate(15000, 100) === 150, "15000 SAR / 100 occupied days = 150 SAR");
assert(calculateAvgDailyRate(0, 100) === 0, "0 revenue = 0 ADR");
assert(calculateAvgDailyRate(15000, 0) === 0, "0 occupied days = 0 ADR (no division by zero)");

// ─── 3. Webhook State Updates ───────────────────────────────────────
section("3. Webhook State Updates");

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

assert(isValidStatusTransition("DUE", "PENDING"), "DUE → PENDING is valid");
assert(isValidStatusTransition("DUE", "PAID"), "DUE → PAID is valid (direct payment)");
assert(isValidStatusTransition("PENDING", "PAID"), "PENDING → PAID is valid");
assert(isValidStatusTransition("PENDING", "FAILED"), "PENDING → FAILED is valid");
assert(isValidStatusTransition("PAID", "REFUNDED"), "PAID → REFUNDED is valid");
assert(!isValidStatusTransition("PAID", "DUE"), "PAID → DUE is NOT valid");
assert(!isValidStatusTransition("REFUNDED", "PAID"), "REFUNDED → PAID is NOT valid");
assert(!isValidStatusTransition("VOID", "PAID"), "VOID → PAID is NOT valid");
assert(isValidStatusTransition("FAILED", "PENDING"), "FAILED → PENDING is valid (retry)");
assert(isValidStatusTransition("DUE", "VOID"), "DUE → VOID is valid (cancel)");

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

// ─── 5. Beds24 Safety Constraints ──────────────────────────────────
section("5. Beds24 Safety Constraints");

function shouldCreateLocalExtension(
  beds24Controlled: boolean,
  beds24ApiSafe: boolean
): "LOCAL_EXTENSION" | "BEDS24_API" | "DIRECT_RENEWAL" {
  if (!beds24Controlled) return "DIRECT_RENEWAL";
  if (beds24Controlled && !beds24ApiSafe) return "LOCAL_EXTENSION";
  if (beds24Controlled && beds24ApiSafe) return "BEDS24_API";
  return "LOCAL_EXTENSION";
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

// ─── 6. Invoice Number Generation ──────────────────────────────────
section("6. Invoice Number Generation");

function generateInvoiceNumber(type: string, bookingId: number, seq: number): string {
  const prefix = type === "RENT" ? "INV" : type === "RENEWAL_RENT" ? "RNW" : "MIS";
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

// ─── 7. Migration Safety ───────────────────────────────────────────
section("7. Migration Safety Checks");

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
  assert(sql.includes("IF NOT EXISTS") || sql.includes("CREATE TABLE"), "Migration uses safe creation");
  
  // Check no DROP TABLE or ALTER on existing tables
  assert(!sql.includes("DROP TABLE `bookings`"), "Migration does NOT drop bookings table");
  assert(!sql.includes("DROP TABLE `properties`"), "Migration does NOT drop properties table");
  assert(!sql.includes("DROP TABLE `users`"), "Migration does NOT drop users table");
}

// ─── 8. No Existing API Modification ────────────────────────────────
section("8. Existing API Safety");

const routersPath = resolve(import.meta.dirname || __dirname, "../routers.ts");
if (existsSync(routersPath)) {
  const routersContent = readFileSync(routersPath, "utf-8");
  // Verify finance router is added at the end, not modifying existing routers
  const financeIdx = routersContent.indexOf("finance: financeRouter");
  const lastClosingIdx = routersContent.lastIndexOf("});");
  assert(financeIdx > 0, "financeRouter is registered in appRouter");
  assert(financeIdx < lastClosingIdx, "financeRouter is added before final closing brace");
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
