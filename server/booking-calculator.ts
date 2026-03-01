/**
 * booking-calculator.ts
 * 
 * Shared, pure calculation function used by BOTH:
 *   1. calculator.calculate  (public cost preview)
 *   2. booking.create        (authoritative total stored on booking)
 *
 * All amounts are in SAR, rounded to nearest integer (no halalah fractions).
 * Math.round is used consistently — same rounding rule everywhere.
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface CalcInput {
  monthlyRent: number;       // SAR per month (from property or unit)
  durationMonths: number;    // 1, 2, etc.
}

export interface CalcSettings {
  insuranceMode: "percentage" | "fixed";
  insuranceRate: number;           // e.g. 10 means 10%
  insuranceFixedAmount: number;    // SAR, used when mode=fixed
  serviceFeeRate: number;          // e.g. 5 means 5%
  vatRate: number;                 // e.g. 15 means 15%
  hideInsuranceFromTenant: boolean;
  currency: string;                // e.g. "SAR"
}

export interface CalcResult {
  // Core amounts (all in SAR, rounded integers)
  baseRentTotal: number;       // monthlyRent × durationMonths
  insuranceAmount: number;     // deposit / insurance
  serviceFeeAmount: number;    // platform service fee
  subtotal: number;            // baseRent + insurance + serviceFee
  vatAmount: number;           // VAT on subtotal
  grandTotal: number;          // subtotal + VAT  (this is what tenant pays)

  // Display variants (for tenant-facing UI)
  displayRentTotal: number;    // if hideInsurance, includes insurance merged into rent
  displayInsurance: number;    // 0 if hidden, else insuranceAmount
  displaySubtotal: number;     // adjusted subtotal for display

  // Snapshot of rates used (frozen at booking creation time)
  appliedRates: {
    insuranceRate: number;     // percentage value, e.g. 10
    insuranceMode: "percentage" | "fixed";
    serviceFeeRate: number;    // percentage value, e.g. 5
    vatRate: number;           // percentage value, e.g. 15
    hideInsuranceFromTenant: boolean;
  };

  currency: string;
  hideInsuranceFromTenant: boolean;
}

// ─── Pure Calculation ────────────────────────────────────────────────

export function calculateBookingTotal(
  input: CalcInput,
  settings: CalcSettings
): CalcResult {
  const { monthlyRent, durationMonths } = input;
  const {
    insuranceMode,
    insuranceRate,
    insuranceFixedAmount,
    serviceFeeRate,
    vatRate,
    hideInsuranceFromTenant,
    currency,
  } = settings;

  // Step 1: Base rent
  const baseRentTotal = Math.round(monthlyRent * durationMonths);

  // Step 2: Insurance (based on monthly rent, not total)
  const insuranceAmount = insuranceMode === "fixed"
    ? Math.round(insuranceFixedAmount)
    : Math.round(monthlyRent * (insuranceRate / 100));

  // Step 3: Service fee (based on base rent total)
  const serviceFeeAmount = Math.round(baseRentTotal * (serviceFeeRate / 100));

  // Step 4: Subtotal (always includes all components for correct VAT)
  const subtotal = baseRentTotal + insuranceAmount + serviceFeeAmount;

  // Step 5: VAT on subtotal
  const vatAmount = Math.round(subtotal * (vatRate / 100));

  // Step 6: Grand total
  const grandTotal = subtotal + vatAmount;

  // Display variants (tenant-facing)
  const displayRentTotal = hideInsuranceFromTenant
    ? baseRentTotal + insuranceAmount
    : baseRentTotal;
  const displayInsurance = hideInsuranceFromTenant ? 0 : insuranceAmount;
  const displaySubtotal = hideInsuranceFromTenant
    ? displayRentTotal + serviceFeeAmount
    : subtotal;

  return {
    baseRentTotal,
    insuranceAmount,
    serviceFeeAmount,
    subtotal,
    vatAmount,
    grandTotal,
    displayRentTotal,
    displayInsurance,
    displaySubtotal,
    appliedRates: {
      insuranceRate,
      insuranceMode,
      serviceFeeRate,
      vatRate,
      hideInsuranceFromTenant,
    },
    currency,
    hideInsuranceFromTenant,
  };
}

// ─── Helper: Parse settings from DB record ───────────────────────────

export function parseCalcSettings(
  settings: Record<string, string>
): CalcSettings {
  return {
    insuranceMode: (settings["calculator.insuranceMode"] || "percentage") as "percentage" | "fixed",
    insuranceRate: parseFloat(settings["fees.depositPercent"] || "10"),
    insuranceFixedAmount: parseFloat(settings["calculator.insuranceFixedAmount"] || "0"),
    serviceFeeRate: parseFloat(settings["fees.serviceFeePercent"] || "5"),
    vatRate: parseFloat(settings["fees.vatPercent"] || "15"),
    hideInsuranceFromTenant: settings["calculator.hideInsuranceFromTenant"] === "true",
    currency: settings["payment.currency"] || "SAR",
  };
}
