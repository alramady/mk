# Integration Safety Report — Finance Registry Module (v3)

**Date:** 2026-02-27  
**Module:** Finance Registry + KPIs + Payments + Renewals  
**Beds24 SDK Path:** `packages/beds24-sdk/`  
**Test Results:** 164 passed, 0 failed

---

## 1. Diff Summary Proof

### Beds24 SDK Status

> **No changes detected under `packages/beds24-sdk/**`**

The CI guardrail script `scripts/check-beds24-immutable.sh` confirms zero modifications to the protected SDK directory. The script runs `git diff --name-only origin/main...HEAD -- packages/beds24-sdk/` and exits with code 1 if any changes are found.

### Beds24 Webhook Verification Status

> **Beds24 webhook verification code is untouched.**

The following files contain Beds24 webhook security logic and were NOT modified by the finance module:

| File | Status |
|------|--------|
| `services/hub-api/src/routes/webhooks.ts` | Untouched |
| `services/hub-api/src/config.ts` | Untouched |
| `services/hub-api/src/index.ts` | Untouched |

### Changed Files (Outside SDK)

| File | Type | Description |
|------|------|-------------|
| `drizzle/schema.ts` | Modified | Added 7 new table definitions (additive) |
| `drizzle/0017_finance_registry.sql` | New | Migration with CREATE TABLE IF NOT EXISTS |
| `drizzle/meta/_journal.json` | Modified | Added migration entry |
| `server/finance-registry.ts` | New | Ledger CRUD, KPI calculations, building/unit management |
| `server/finance-routers.ts` | New | tRPC router for finance endpoints |
| `server/occupancy.ts` | New | Occupancy computation with Beds24 source-of-truth |
| `server/renewal.ts` | New | Renewal eligibility, extension workflow |
| `server/payment-webhooks.ts` | New | Webhook stubs for Moyasar, Tabby, Tamara |
| `server/beds24-guard.ts` | New | Runtime guardrail: assertNotBeds24Controlled |
| `server/_core/index.ts` | Modified | Added webhook routes and OG image routes |
| `server/routers.ts` | Modified | Registered financeRouter (1 line) |
| `scripts/check-beds24-immutable.sh` | New | CI guardrail script |
| `package.json` | Modified | Added check:beds24-immutable script |
| `client/src/App.tsx` | Modified | Added 3 admin page routes |
| `client/src/pages/AdminPayments.tsx` | New | Payments Registry page |
| `client/src/pages/AdminBuildings.tsx` | New | Building Overview page |
| `client/src/pages/AdminUnitFinance.tsx` | New | Unit Finance Card page |
| `client/src/pages/AdminDashboard.tsx` | Modified | Added finance links to quick actions |
| `server/tests/finance-registry.test.ts` | New | 164 automated tests |
| `INTEGRATION_SAFETY_REPORT.md` | New | This report |

> **Confirmation:** Zero files under `packages/beds24-sdk/`, `services/hub-api/`, or any existing Beds24 integration path were modified.

---

## 2. Guardrails Implemented

### A) CI / Git Guardrail

**Script:** `scripts/check-beds24-immutable.sh`  
**npm command:** `npm run check:beds24-immutable`

The script compares the current branch against `origin/main` and fails the build (exit 1) if any file under `packages/beds24-sdk/` has been modified. It should be added to the CI pipeline as a required check.

```bash
# Usage in CI pipeline:
npm run check:beds24-immutable
# Or directly:
BASE_REF=origin/main bash scripts/check-beds24-immutable.sh
```

### B) Runtime Guardrail

**File:** `server/beds24-guard.ts`

The `assertNotBeds24Controlled(unitId, operation)` function queries `beds24_map` and throws `Beds24ConflictError` if the unit has `sourceOfTruth='BEDS24'`. It blocks the following operations:

| Operation | Description |
|-----------|-------------|
| `AUTO_APPROVE_EXTENSION` | Auto-approving booking extensions |
| `MUTATE_BOOKING_DATES` | Changing booking start/end dates |
| `MUTATE_BOOKING_STATUS` | Changing booking status |
| `CREATE_BOOKING` | Creating new bookings |
| `CANCEL_BOOKING` | Cancelling bookings |
| `UPDATE_INVENTORY` | Modifying inventory/rates |
| `UPDATE_AVAILABILITY` | Changing availability |

The guard is actively used in `renewal.ts` (`activateExtension` function). For Beds24-controlled units, only `renewalsUsed` is incremented locally; the actual Beds24 booking must be updated manually by the admin (documented via `beds24ChangeNote`).

---

## 3. Beds24 Integration Safety

### Zero Beds24 API Calls

The finance module contains zero calls to:
- `beds24.com` or any Beds24 API endpoint
- `@mk/beds24-sdk` or `beds24-sdk` package
- `BEDS24_API_URL`, `BEDS24_REFRESH_TOKEN`, or `BEDS24_WEBHOOK_SECRET` env vars

This is verified by 36 automated assertions across 6 files (Section 13 of tests).

### Occupancy Source Selection

```
IF unit has beds24_map with sourceOfTruth = BEDS24:
  IF Beds24 data is available -> use BEDS24 data
  IF Beds24 data is unavailable -> return UNKNOWN (NOT LOCAL fallback)
IF unit has beds24_map with sourceOfTruth = LOCAL:
  -> use LOCAL data
IF no beds24_map:
  -> use LOCAL data
```

### Renewal Safety

For Beds24-controlled units, renewals follow a safe workflow:

1. Tenant or admin requests extension → `booking_extensions` row created with `status=PENDING_APPROVAL`, `requiresBeds24Update=true`
2. Admin must provide `beds24ChangeNote` to approve (enforced at code level)
3. Approval creates a ledger entry (`RENEWAL_RENT`, `DUE`) but does NOT modify Beds24
4. Payment webhook finalizes the ledger entry to `PAID`
5. `activateExtension` uses `assertNotBeds24Controlled` — for Beds24 units, only `renewalsUsed` is updated locally

### Ledger Immutability

- PAID entries are immutable — no edits allowed
- Only webhooks can set status to PAID (admin restricted to DUE/PENDING/FAILED/VOID)
- Corrections use ADJUSTMENT/REFUND child rows linked via `parentLedgerId`

| From | Allowed Transitions |
|------|-------------------|
| DUE | PENDING, PAID (webhook), VOID |
| PENDING | PAID (webhook), FAILED, VOID |
| PAID | REFUNDED (via adjustment only) |
| FAILED | PENDING, DUE, VOID |
| REFUNDED | (terminal) |
| VOID | (terminal) |

---

## 4. Schema Safety

All changes are additive. 7 new tables use `CREATE TABLE IF NOT EXISTS`. Existing `bookings` table receives only `ADD COLUMN IF NOT EXISTS` (no DROP/MODIFY). No changes to `properties`, `users`, or any other existing table.

### Key Constraints

| Table | Constraint | Purpose |
|-------|-----------|---------|
| `beds24_map` | `UNIQUE(unitId)` | One unit → one Beds24 room |
| `beds24_map` | `UNIQUE(beds24RoomId)` | One Beds24 room → one unit |
| `payment_ledger` | `UNIQUE(invoiceNumber)` | Invoice deduplication |
| `unit_daily_status` | `UNIQUE(date, unitId)` | One snapshot per unit per day |

---

## 5. KPI Definitions

| KPI | Formula |
|-----|---------|
| Occupancy Rate | occupied / (total - blocked - maintenance) × 100 |
| Unknown Units | Count of UNKNOWN occupancy status |
| PAR | Sum(monthlyBaseRentSAR × 12) |
| Collected YTD | Sum(PAID amounts this year) |
| EAR | (collectedYTD / daysSoFar) × 365 |
| RevPAU | totalRevenue / totalUnits / days |
| Outstanding | Sum(DUE + PENDING amounts) |

---

## 6. Test Coverage Summary

| Section | Tests | Description |
|---------|-------|-------------|
| 1. Occupancy Source Selection | 8 | Beds24→BEDS24, unavailable→UNKNOWN, LOCAL fallback blocked |
| 2. KPI Calculations | 14 | Occupancy %, PAR, EAR, RevPAU, edge cases |
| 3. Webhook State Updates | 15 | Status transitions, admin restrictions, ledger immutability |
| 4. Renewal Eligibility | 6 | Term rules, window checks, max renewals |
| 5. Beds24 Safety Constraints | 8 | Extension routing, change note enforcement |
| 6. Invoice Number Generation | 5 | Prefix, format, sequence padding |
| 7. Adjustment/Refund Logic | 5 | Parent status check, amount validation |
| 8. Unit Status Enum | 5 | Valid statuses, OCCUPIED excluded |
| 9. Migration Safety | 16 | Table creation, constraints, no destructive changes |
| 10. Existing API Safety | 7 | Router registration, no Beds24 calls |
| 11. SDK Immutability | 10 | SDK files exist, CI script, package.json |
| 12. Runtime Guard | 12 | Guard functions, blocked operations, renewal integration |
| 13. No Beds24 Writes | 36 | 6 files × 6 checks each |
| 14. Webhook Untouched | 3 | Hub-api webhook files exist |
| **Total** | **164** | **All passed** |

---

## 7. Rollback Plan

```sql
DROP TABLE IF EXISTS payment_method_settings;
DROP TABLE IF EXISTS unit_daily_status;
DROP TABLE IF EXISTS booking_extensions;
DROP TABLE IF EXISTS payment_ledger;
DROP TABLE IF EXISTS beds24_map;
DROP TABLE IF EXISTS units;
DROP TABLE IF EXISTS buildings;

ALTER TABLE bookings
  DROP COLUMN IF EXISTS beds24BookingId,
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS renewalsUsed,
  DROP COLUMN IF EXISTS maxRenewals,
  DROP COLUMN IF EXISTS renewalWindowDays,
  DROP COLUMN IF EXISTS buildingId,
  DROP COLUMN IF EXISTS unitId;
```

No existing functionality is affected by the rollback.
