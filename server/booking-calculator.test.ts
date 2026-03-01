/**
 * Unit tests for booking-calculator.ts
 * 
 * Run: npx tsx server/booking-calculator.test.ts
 * 
 * Tests the shared calculateBookingTotal function with the exact scenario:
 *   4500 SAR/month × 1 month, 10% insurance, 5% service fee, 15% VAT → total = 5951 SAR
 */

import { calculateBookingTotal, parseCalcSettings, type CalcSettings } from "./booking-calculator";

// ─── Test Helpers ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

function assertEqual(actual: number, expected: number, label: string) {
  assert(
    actual === expected,
    `${label}: expected ${expected}, got ${actual}`
  );
}

// ─── Test 1: Exact scenario from requirements ─────────────────────────

console.log("\n=== Test 1: 4500 SAR × 1 month (10% ins, 5% svc, 15% VAT) ===");
{
  const settings: CalcSettings = {
    insuranceMode: "percentage",
    insuranceRate: 10,
    insuranceFixedAmount: 0,
    serviceFeeRate: 5,
    vatRate: 15,
    hideInsuranceFromTenant: false,
    currency: "SAR",
  };

  const result = calculateBookingTotal(
    { monthlyRent: 4500, durationMonths: 1 },
    settings
  );

  // Step-by-step verification:
  // baseRentTotal = 4500 × 1 = 4500
  // insuranceAmount = 4500 × 10% = 450
  // serviceFeeAmount = 4500 × 5% = 225
  // subtotal = 4500 + 450 + 225 = 5175
  // vatAmount = 5175 × 15% = 776 (rounded from 776.25)
  // grandTotal = 5175 + 776 = 5951

  assertEqual(result.baseRentTotal, 4500, "baseRentTotal");
  assertEqual(result.insuranceAmount, 450, "insuranceAmount");
  assertEqual(result.serviceFeeAmount, 225, "serviceFeeAmount");
  assertEqual(result.subtotal, 5175, "subtotal");
  assertEqual(result.vatAmount, 776, "vatAmount (Math.round(5175 × 0.15) = Math.round(776.25) = 776)");
  assertEqual(result.grandTotal, 5951, "grandTotal");
  assert(result.currency === "SAR", "currency is SAR");
}

// ─── Test 2: Multi-month (4500 × 2 months) ───────────────────────────

console.log("\n=== Test 2: 4500 SAR × 2 months ===");
{
  const settings: CalcSettings = {
    insuranceMode: "percentage",
    insuranceRate: 10,
    insuranceFixedAmount: 0,
    serviceFeeRate: 5,
    vatRate: 15,
    hideInsuranceFromTenant: false,
    currency: "SAR",
  };

  const result = calculateBookingTotal(
    { monthlyRent: 4500, durationMonths: 2 },
    settings
  );

  // baseRentTotal = 4500 × 2 = 9000
  // insuranceAmount = 4500 × 10% = 450 (based on monthly, not total)
  // serviceFeeAmount = 9000 × 5% = 450
  // subtotal = 9000 + 450 + 450 = 9900
  // vatAmount = 9900 × 15% = 1485
  // grandTotal = 9900 + 1485 = 11385

  assertEqual(result.baseRentTotal, 9000, "baseRentTotal");
  assertEqual(result.insuranceAmount, 450, "insuranceAmount (based on monthly rent)");
  assertEqual(result.serviceFeeAmount, 450, "serviceFeeAmount");
  assertEqual(result.subtotal, 9900, "subtotal");
  assertEqual(result.vatAmount, 1485, "vatAmount");
  assertEqual(result.grandTotal, 11385, "grandTotal");
}

// ─── Test 3: Hide insurance from tenant ───────────────────────────────

console.log("\n=== Test 3: Hidden insurance (merged into rent display) ===");
{
  const settings: CalcSettings = {
    insuranceMode: "percentage",
    insuranceRate: 10,
    insuranceFixedAmount: 0,
    serviceFeeRate: 5,
    vatRate: 15,
    hideInsuranceFromTenant: true,
    currency: "SAR",
  };

  const result = calculateBookingTotal(
    { monthlyRent: 4500, durationMonths: 1 },
    settings
  );

  // Grand total is the same regardless of display mode
  assertEqual(result.grandTotal, 5951, "grandTotal unchanged");
  // Display values differ
  assertEqual(result.displayRentTotal, 4950, "displayRentTotal (rent + insurance merged)");
  assertEqual(result.displayInsurance, 0, "displayInsurance (hidden from tenant)");
  // But actual insurance is still recorded
  assertEqual(result.insuranceAmount, 450, "actual insuranceAmount still recorded");
}

// ─── Test 4: Fixed insurance mode ─────────────────────────────────────

console.log("\n=== Test 4: Fixed insurance (500 SAR flat) ===");
{
  const settings: CalcSettings = {
    insuranceMode: "fixed",
    insuranceRate: 10,
    insuranceFixedAmount: 500,
    serviceFeeRate: 5,
    vatRate: 15,
    hideInsuranceFromTenant: false,
    currency: "SAR",
  };

  const result = calculateBookingTotal(
    { monthlyRent: 4500, durationMonths: 1 },
    settings
  );

  // insuranceAmount = 500 (fixed, ignores rate)
  // serviceFeeAmount = 4500 × 5% = 225
  // subtotal = 4500 + 500 + 225 = 5225
  // vatAmount = 5225 × 15% = 784 (rounded from 783.75)
  // grandTotal = 5225 + 784 = 6009

  assertEqual(result.insuranceAmount, 500, "insuranceAmount (fixed)");
  assertEqual(result.serviceFeeAmount, 225, "serviceFeeAmount");
  assertEqual(result.subtotal, 5225, "subtotal");
  assertEqual(result.vatAmount, 784, "vatAmount (Math.round(783.75) = 784)");
  assertEqual(result.grandTotal, 6009, "grandTotal");
}

// ─── Test 5: parseCalcSettings from DB record ────────────────────────

console.log("\n=== Test 5: parseCalcSettings from DB record ===");
{
  const dbSettings: Record<string, string> = {
    "calculator.insuranceMode": "percentage",
    "fees.depositPercent": "10",
    "fees.serviceFeePercent": "5",
    "fees.vatPercent": "15",
    "calculator.hideInsuranceFromTenant": "false",
    "payment.currency": "SAR",
  };

  const parsed = parseCalcSettings(dbSettings);
  assert(parsed.insuranceMode === "percentage", "insuranceMode");
  assertEqual(parsed.insuranceRate, 10, "insuranceRate");
  assertEqual(parsed.serviceFeeRate, 5, "serviceFeeRate");
  assertEqual(parsed.vatRate, 15, "vatRate");
  assert(parsed.hideInsuranceFromTenant === false, "hideInsuranceFromTenant");
  assert(parsed.currency === "SAR", "currency");
}

// ─── Test 6: Rate snapshot immutability ──────────────────────────────

console.log("\n=== Test 6: Rate snapshot is frozen (immutable) ===");
{
  const settings: CalcSettings = {
    insuranceMode: "percentage",
    insuranceRate: 10,
    insuranceFixedAmount: 0,
    serviceFeeRate: 5,
    vatRate: 15,
    hideInsuranceFromTenant: false,
    currency: "SAR",
  };

  const result = calculateBookingTotal(
    { monthlyRent: 4500, durationMonths: 1 },
    settings
  );

  // Snapshot should match input settings
  assertEqual(result.appliedRates.insuranceRate, 10, "snapshot insuranceRate");
  assertEqual(result.appliedRates.serviceFeeRate, 5, "snapshot serviceFeeRate");
  assertEqual(result.appliedRates.vatRate, 15, "snapshot vatRate");
  assert(result.appliedRates.insuranceMode === "percentage", "snapshot insuranceMode");

  // Changing settings after calculation doesn't affect the result
  settings.vatRate = 20;
  assertEqual(result.appliedRates.vatRate, 15, "snapshot unchanged after settings mutation");
}

// ─── Summary ──────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
  console.log("❌ SOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("✅ ALL TESTS PASSED");
}
