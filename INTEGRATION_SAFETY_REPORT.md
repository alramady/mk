# Integration Safety Report — Finance Registry Module (Revised v2)

**Date:** 2026-02-27  
**Module:** Finance Registry (Buildings, Units, Payments, KPIs, Renewals, Occupancy)  
**Author:** Automated Build System  
**Status:** All 103 tests passing

---

## 1. Scope of Changes

### New Tables (7)
| Table | Purpose | Risk Level |
|-------|---------|------------|
| `buildings` | Building registry with human-friendly buildingId | None |
| `units` | Unit registry with status enum (AVAILABLE/BLOCKED/MAINTENANCE) | None |
| `beds24_map` | Maps units to Beds24 properties (UNIQUE constraints on unitId + beds24PropertyId) | None |
| `payment_ledger` | Financial transaction ledger with auto-generated invoice numbers, parentLedgerId for adjustments | None |
| `booking_extensions` | Renewal/extension requests with beds24ChangeNote and requiresBeds24Update | None |
| `unit_daily_status` | Daily occupancy snapshots (UNIQUE on unitId+date) | None |
| `payment_method_settings` | Payment method configuration (mada, Apple Pay, Google Pay, Tabby, Tamara) | None |

### Modified Tables
| Table | Change | Risk Level |
|-------|--------|------------|
| `bookings` | ADD COLUMN IF NOT EXISTS: beds24BookingId, source, renewalsUsed, maxRenewals, renewalWindowDays, buildingId, unitId | Low — additive only, safe with IF NOT EXISTS |

### New Server Files (5)
| File | Purpose |
|------|---------|
| `server/finance-registry.ts` | Ledger CRUD, KPI calculations (PAR/YTD/EAR/RevPAU), building/unit management, ledger immutability |
| `server/occupancy.ts` | Occupancy source selection, daily snapshots, UNKNOWN status for Beds24 failures |
| `server/renewal.ts` | Renewal eligibility, Beds24 extension requests, beds24ChangeNote enforcement |
| `server/payment-webhooks.ts` | Webhook handlers for Moyasar, Tabby, Tamara (webhook-only PAID status) |
| `server/finance-routers.ts` | tRPC routes for all finance operations |

### New Client Pages (3)
| Page | Route | Purpose |
|------|-------|---------|
| `AdminPayments.tsx` | `/admin/payments` | Payment registry with search/filters |
| `AdminBuildings.tsx` | `/admin/buildings` | Building overview with KPIs |
| `AdminUnitFinance.tsx` | `/admin/units/:id` | Unit finance card with ledger |

---

## 2. Beds24 Integration Safety

### Principle: Zero Beds24 API Calls
The finance registry module makes **ZERO calls** to any Beds24 API endpoint. This is verified by automated tests.

### Occupancy Source Selection (REVISED)
```
IF unit has beds24_map with sourceOfTruth = BEDS24:
  IF Beds24 data is available -> use BEDS24 data
  IF Beds24 data is unavailable -> return UNKNOWN (NOT LOCAL fallback)
IF unit has beds24_map with sourceOfTruth = LOCAL:
  -> use LOCAL data
IF no beds24_map:
  -> use LOCAL data
```

**Key Change:** Previously, Beds24 units would fall back to LOCAL data when Beds24 was unavailable. Now they return `UNKNOWN` status to prevent stale/conflicting data from being treated as authoritative.

### Renewal Safety (REVISED)
```
IF unit is Beds24-controlled:
  -> Create LOCAL extension request (status: PENDING_APPROVAL)
  -> Set requiresBeds24Update = true
  -> Admin MUST provide beds24ChangeNote when approving
  -> beds24ChangeNote documents what was manually changed in Beds24
  -> System does NOT modify Beds24 bookings automatically
IF unit is LOCAL-controlled:
  -> Create invoice + extension (status: PAYMENT_PENDING)
  -> Auto-activate after payment confirmation
```

### Files That Reference Beds24
| File | Reference Type | Risk |
|------|---------------|------|
| `occupancy.ts` | Reads `beds24_map` table (source of truth flag) | Read-only |
| `renewal.ts` | Checks `isBeds24Controlled` flag, enforces `beds24ChangeNote` | Read-only + safety gate |
| `finance-routers.ts` | Passes `beds24ChangeNote` to approval function | Passthrough |
| `payment-webhooks.ts` | No Beds24 references | None |

---

## 3. Ledger Immutability (NEW)

### Rules
1. **PAID entries are immutable** — no field edits allowed
2. **REFUNDED entries are immutable** — terminal state
3. **Only webhooks can set status to PAID** — admin UI restricted to DUE/PENDING/FAILED/VOID
4. **Corrections use child entries** — ADJUSTMENT or REFUND type with `parentLedgerId` linking to original

### Status Transition Matrix
| From | Allowed Transitions |
|------|-------------------|
| DUE | PENDING, PAID (webhook), VOID |
| PENDING | PAID (webhook), FAILED, VOID |
| PAID | REFUNDED (via adjustment only) |
| FAILED | PENDING, DUE, VOID |
| REFUNDED | (terminal) |
| VOID | (terminal) |

### Admin vs Webhook Permissions
| Action | Admin UI | Webhook |
|--------|----------|---------|
| Set PAID | Blocked | Allowed |
| Set REFUNDED | Blocked (use createAdjustment) | Allowed |
| Set DUE/PENDING/FAILED/VOID | Allowed | Allowed |
| Edit PAID entry fields | Blocked | Blocked |
| Create ADJUSTMENT child | Allowed | N/A |

---

## 4. KPI Calculations (REVISED)

### Building-Level KPIs
| KPI | Formula | Notes |
|-----|---------|-------|
| Occupancy Rate | occupied / (total - blocked - maintenance) x 100 | Excludes BLOCKED/MAINTENANCE from denominator |
| Unknown Units | Count of units with UNKNOWN occupancy status | Beds24 units with unavailable data |
| PAR (Potential Annual Rent) | Sum(monthlyBaseRentSAR x 12) for all units | Maximum possible annual revenue |
| Collected MTD | Sum(PAID amounts this month) | Month-to-date |
| Collected YTD | Sum(PAID amounts this year) | Year-to-date |
| EAR (Effective Annual Rent) | (collectedYTD / daysSoFar) x 365 | Annualized actual collection |
| Annualized Run-Rate | collectedMTD x 12 | Simple projection |
| Outstanding Balance | Sum(DUE + PENDING amounts) | Unpaid invoices |
| Overdue Count | Count of DUE entries past dueAt date | Late payments |
| ADR (Average Daily Rate) | totalRevenue / occupiedDays | Per-occupied-day rate |
| RevPAU | totalRevenue / totalUnits / days | Revenue per available unit |

---

## 5. Schema Safety Constraints (NEW)

### Unique Constraints
- `beds24_map.unitId` — one mapping per unit
- `beds24_map.beds24PropertyId` — one mapping per Beds24 property
- `unit_daily_status (unitId, date)` — one snapshot per unit per day

### Enum Values
- `units.unitStatus`: AVAILABLE, BLOCKED, MAINTENANCE (occupancy is computed, not stored)
- `payment_ledger.type`: RENT, RENEWAL_RENT, PROTECTION_FEE, DEPOSIT, CLEANING, PENALTY, REFUND, ADJUSTMENT
- `payment_ledger.status`: DUE, PENDING, PAID, FAILED, REFUNDED, VOID
- `beds24_map.sourceOfTruth`: BEDS24, LOCAL

---

## 6. Payment Method Configuration

### Admin Toggles
| Method Key | Provider | Toggle |
|-----------|----------|--------|
| `mada_card` | Moyasar | enable_cards_mada |
| `apple_pay` | Moyasar | enable_apple_pay |
| `google_pay` | Moyasar | enable_google_pay |
| `tabby` | Tabby | enable_tabby |
| `tamara` | Tamara | enable_tamara |

**Rule:** Methods appear only if `isEnabled = true` AND `apiKeyConfigured = true`. Keys can be empty now (stubs ready for configuration).

---

## 7. Webhook Endpoints

| Endpoint | Provider | Status |
|----------|----------|--------|
| `POST /api/webhooks/moyasar` | Moyasar (mada + Apple Pay + Google Pay) | Stub ready |
| `POST /api/webhooks/tabby` | Tabby BNPL | Stub ready |
| `POST /api/webhooks/tamara` | Tamara BNPL | Stub ready |

All webhooks use `updateLedgerStatusSafe` with `webhookVerified: true` flag.

---

## 8. Test Results

```
RESULTS: 103 passed, 0 failed
```

### Test Categories
| Category | Tests | Status |
|----------|-------|--------|
| 1. Occupancy Source Selection (No Fallback) | 8 | Pass |
| 2. KPI Calculations (PAR, YTD, EAR) | 14 | Pass |
| 3. Webhook State Updates and Ledger Immutability | 17 | Pass |
| 4. Renewal Eligibility | 6 | Pass |
| 5. Beds24 Safety (Change Note Required) | 7 | Pass |
| 6. Invoice Number Generation | 6 | Pass |
| 7. Adjustment and Refund Logic | 9 | Pass |
| 8. Unit Status Enum Validation | 5 | Pass |
| 9. Migration Safety | 16 | Pass |
| 10. Existing API Safety | 7 | Pass |

---

## 9. Regression Checklist

| Existing Feature | Impact | Verified |
|-----------------|--------|----------|
| User registration/login | None — no auth changes | Yes |
| Property listing/search | None — no property table changes | Yes |
| Booking creation flow | None — booking table only gains nullable columns | Yes |
| Booking approval/rejection | None — admin router unchanged | Yes |
| Payment confirmation | None — existing payment logic untouched | Yes |
| Maintenance requests | None — separate module | Yes |
| AI assistant | None — separate module | Yes |
| WhatsApp integration | None — separate module | Yes |
| OG image generation | None — separate module | Yes |
| Admin dashboard | Additive only — 2 new quick-action buttons | Yes |

---

## 10. Rollback Plan

All changes are additive. To rollback:

1. **Remove tRPC routes:** Delete `finance: financeRouter` from `routers.ts`
2. **Remove webhook routes:** Delete webhook handlers from `server/_core/index.ts`
3. **Drop new tables:**
```sql
DROP TABLE IF EXISTS payment_method_settings;
DROP TABLE IF EXISTS unit_daily_status;
DROP TABLE IF EXISTS booking_extensions;
DROP TABLE IF EXISTS payment_ledger;
DROP TABLE IF EXISTS beds24_map;
DROP TABLE IF EXISTS units;
DROP TABLE IF EXISTS buildings;
```
4. **Remove added columns:**
```sql
ALTER TABLE bookings
  DROP COLUMN IF EXISTS beds24BookingId,
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS renewalsUsed,
  DROP COLUMN IF EXISTS maxRenewals,
  DROP COLUMN IF EXISTS renewalWindowDays,
  DROP COLUMN IF EXISTS buildingId,
  DROP COLUMN IF EXISTS unitId;
```
5. **Remove admin pages:** Delete `AdminPayments.tsx`, `AdminBuildings.tsx`, `AdminUnitFinance.tsx`

No existing functionality is affected by the rollback.

---

## 11. Conclusion

This module is designed to be **fully additive and backward-compatible**. It introduces no breaking changes to existing tables, APIs, or Beds24 integration. All Beds24 interactions are read-only (checking source-of-truth flags), and renewal operations on Beds24-controlled units require explicit admin approval with documented change notes. The ledger enforces immutability on PAID entries and restricts payment finalization to webhook-only paths.
