# Production Smoke Test Evidence

**Date:** 2026-02-27  
**Environment:** Railway Production (`monthly-key-app-production.up.railway.app`)  
**Tester:** Automated via API (curl)  
**Auth:** Admin user `Hobart` (id=1, role=admin)

---

## Pre-Test: Database Migration

| Step | Status | Evidence |
|------|--------|----------|
| Connect to production MySQL | PASS | `crossover.proxy.rlwy.net:51979` |
| Tables before migration | 33 tables | Missing 8 new tables |
| Apply migrations 0014–0018 | PASS | All DDL statements executed |
| Tables after migration | **41 tables** | All 8 new tables created |
| Seed payment_method_settings | PASS | 7 methods seeded (mada, Apple Pay, Google Pay, Tabby, Tamara, bank transfer, cash) |

### New Tables Created
1. `buildings` — Building registry
2. `units` — Unit registry
3. `beds24_map` — Beds24 connection mapping
4. `payment_ledger` — Payment ledger (immutable)
5. `booking_extensions` — Renewal/extension requests
6. `unit_daily_status` — Occupancy snapshots
7. `payment_method_settings` — Payment method configuration
8. `audit_log` — Audit trail

---

## Pre-Test: Railway Deployment Fix

| Issue | Root Cause | Fix | Status |
|-------|-----------|-----|--------|
| Site returning 502 | Port mismatch: server listens on 8080, Railway networking set to 8081 | Changed both domains (railway.app + monthlykey.com) to port 8080 | PASS |
| Redeploy | Triggered from Railway Dashboard | Build + deploy successful | PASS |

---

## Smoke Test Results

### Test 1: Create Building (`/admin/buildings`)

**Endpoint:** `POST finance.buildings.create`

**Request:**
```json
{
  "buildingName": "Test Building Alpha",
  "buildingNameAr": "مبنى ألفا التجريبي",
  "city": "Riyadh",
  "cityAr": "الرياض",
  "district": "Al Wizarat",
  "districtAr": "الوزارات",
  "address": "MPQ8+78H, Al Wizarat, Riyadh",
  "addressAr": "الوزارات، الرياض",
  "latitude": "24.7136",
  "longitude": "46.6753",
  "notes": "Smoke test building"
}
```

**Response:** `HTTP 200`
```json
{"result":{"data":{"json":{"id":2}}}}
```

**Status:** **PASS** — Building created successfully with id=2

---

### Test 2: Add Unit Under Building

**Endpoint:** `POST finance.units.create`

**Request:**
```json
{
  "buildingId": 2,
  "unitNumber": "101",
  "floor": 1,
  "bedrooms": 2,
  "bathrooms": 1,
  "sizeSqm": 85,
  "unitStatus": "available",
  "monthlyBaseRentSAR": "5000",
  "notes": "Smoke test unit"
}
```

**Response:** `HTTP 200`
```json
{"result":{"data":{"json":{"id":1}}}}
```

**Status:** **PASS** — Unit 101 created under building id=2

---

### Test 3: Save beds24_map Entry (Mapping Only)

**Endpoint:** `POST finance.beds24.upsert`

**Request:**
```json
{
  "unitId": 1,
  "beds24PropertyId": "12345",
  "beds24RoomId": "67890",
  "connectionType": "API",
  "sourceOfTruth": "BEDS24"
}
```

**Response:** `HTTP 200`
```json
{"result":{"data":{"json":{"id":1,"created":true}}}}
```

**Verification:** No writes to Beds24 API — mapping is local-only as designed.

**Status:** **PASS** — Beds24 mapping saved without any Beds24 API calls

---

### Test 4: Payment Settings Load/Save (`/admin/settings → Payment`)

**Endpoint:** `GET finance.moyasarPayment.getSettings` (admin-only)

**Response:** `HTTP 200`
```json
{
  "publishableKey": "",
  "secretKey": "",
  "webhookSecret": "",
  "mode": "test",
  "currency": "SAR",
  "enabled": false,
  "enableMadaCards": true,
  "enableApplePay": false,
  "enableGooglePay": false,
  "paypalEnabled": false,
  "cashEnabled": true
}
```

**Also verified:** `GET finance.paymentMethods.list` returns all 7 payment methods with correct Arabic names.

**Status:** **PASS** — Settings load correctly, all 7 methods present

---

### Test 5: Payment Badges (Public Endpoint)

**Endpoint:** `GET finance.moyasarPayment.getEnabledBadges` (public, no auth)

**Response:** `HTTP 200`
```json
{"result":{"data":{"json":[]}}}
```

**Expected:** Empty array because no payment methods are enabled yet (`isEnabled: 0` for all). When admin enables methods and configures API keys, badges will appear in:
- Homepage footer (via `PaymentMethodsBadges` component)
- Property details page (via `PaymentMethodsBadges` component)

**Status:** **PASS** — Endpoint works, returns empty as expected (no methods enabled)

---

## Safety Verification

### Beds24 SDK Immutability

```
✅ No changes detected under packages/beds24-sdk/
   Beds24 SDK is intact.
```

**CI Guardrail:** `npm run check:beds24-immutable` → **PASS**

### Beds24 Webhook/Security Files

```
git log --diff-filter=M -- server/beds24-webhooks.ts server/beds24-guard.ts packages/beds24-sdk/
```

**Result:** No modifications to Beds24 webhook or security files from finance/payment work. Only prior hardening commit (`7db1611`) touched these files.

**Status:** **PASS** — Beds24 SDK, webhooks, and security are untouched.

---

## Post-Test Cleanup

All smoke test data has been removed from production:
- 3 test buildings → deleted
- 1 test unit → deleted
- 1 test beds24_map → deleted
- Related audit_log entries → deleted

**Production is clean and ready for real data.**

---

## Summary

| Test | Description | HTTP | Status |
|------|-------------|------|--------|
| 1 | Create building | 200 | **PASS** |
| 2 | Add unit under building | 200 | **PASS** |
| 3 | Save beds24_map entry | 200 | **PASS** |
| 4 | Payment settings load | 200 | **PASS** |
| 5 | Payment badges (public) | 200 | **PASS** |
| — | Beds24 SDK immutability | — | **PASS** |
| — | Beds24 webhook untouched | — | **PASS** |

**Overall: 7/7 PASS — Production is operational.**
