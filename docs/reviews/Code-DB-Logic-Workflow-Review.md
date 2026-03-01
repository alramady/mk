# Full Technical Review — Code, Database, Logic & Workflows

**Date:** 2026-02-27  
**Reviewer:** the platform  
**Scope:** Complete codebase audit of Monthly Key platform  
**Codebase Stats:** 314 TypeScript files, 74,326 lines, 42 DB tables, 37 test files

---

## Executive Summary

This review covers the entire Monthly Key codebase across six dimensions: architecture, database, business logic, workflows, security, and performance. Findings are grouped by severity. The system is broadly well-structured with strong safety guardrails around the Beds24 integration, but several areas need attention before production launch.

---

## 1. Codebase Architecture

### Module Boundaries

The codebase follows a monorepo structure with clear separation between client (React 19 + Tailwind 4) and server (Express + tRPC + Drizzle ORM). The server layer is organized into functional modules.

| Module | File | Lines | Responsibility |
|--------|------|-------|---------------|
| Core Router | `server/routers.ts` | ~1,500 | All tRPC route definitions |
| Finance Registry | `server/finance-registry.ts` | 806 | Building/unit/ledger CRUD + KPIs |
| Finance Routes | `server/finance-routers.ts` | 608 | tRPC router for finance endpoints |
| Occupancy | `server/occupancy.ts` | 510 | Occupancy calculation + snapshots |
| Renewal | `server/renewal.ts` | 363 | Extension eligibility + workflow |
| Moyasar | `server/moyasar.ts` | 368 | Payment provider adapter |
| Webhooks | `server/payment-webhooks.ts` | 217 | Webhook handlers |
| Beds24 Guard | `server/beds24-guard.ts` | 110 | Runtime safety guardrail |
| Audit Log | `server/audit-log.ts` | 106 | Immutable audit trail |
| DB Layer | `server/db.ts` | ~1,500 | Legacy database operations |

### Coupling Assessment

The `server/routers.ts` file at approximately 1,500 lines is the largest single file and acts as a "god router" containing all route definitions. While this is functional, it creates a coupling risk as the system grows. The finance module demonstrates a better pattern by extracting routes into `finance-routers.ts`.

**Finding [MED-01]:** `server/routers.ts` should be progressively decomposed into domain-specific router files (following the `finance-routers.ts` pattern) to improve maintainability.

**Finding [LOW-01]:** `server/db.ts` at ~1,500 lines mixes multiple domain concerns (properties, bookings, users, search). Consider splitting into domain-specific data access modules.

---

## 2. Database Schema

### Table Inventory

The schema defines 42 tables across these domains:

| Domain | Tables | Key Tables |
|--------|--------|------------|
| Users & Auth | 3 | `users`, `adminPermissions`, `userActivities` |
| Properties | 4 | `properties`, `propertyAvailability`, `favorites`, `savedSearches` |
| Bookings | 2 | `bookings`, `bookingExtensions` |
| Finance | 3 | `buildings`, `units`, `paymentLedger` |
| Payments | 2 | `payments`, `paymentMethodSettings` |
| Beds24 | 2 | `beds24Map`, `unitDailyStatus` |
| CMS | 5 | `platformSettings`, `cities`, `districts`, `faqEntries`, `knowledgeBase` |
| Communication | 3 | `conversations`, `messages`, `notifications` |
| AI | 2 | `aiConversations`, `aiMessages` |
| Audit | 1 | `auditLog` |
| Other | 15 | Reviews, maintenance, lease, OTP, etc. |

### Index Analysis

**Finding [HIGH-01]:** The schema has only 8 explicit indexes/unique constraints across 42 tables. Several high-traffic query patterns lack supporting indexes:

| Table | Missing Index | Impact |
|-------|--------------|--------|
| `payment_ledger` | `(buildingId, status, paidAt)` | KPI queries scan full table |
| `payment_ledger` | `(unitId, type, status)` | Unit finance card queries |
| `unit_daily_status` | `(unitId, date)` | Occupancy lookups |
| `bookings` | `(unitId, status, moveOutDate)` | Renewal eligibility checks |
| `bookings` | `(propertyId, status)` | Property occupancy queries |
| `audit_log` | `(entityType, entityId)` | Audit trail lookups |
| `beds24_map` | `(sourceOfTruth)` | Occupancy source filtering |

**Recommended fix:** Add a migration `0019_add_indexes.sql` with these indexes. This is additive and safe.

### Constraint Analysis

**Finding [MED-02]:** Several foreign key relationships are implicit (enforced in application code) rather than explicit database constraints. The `payment_ledger.buildingId` and `payment_ledger.unitId` columns reference `buildings.id` and `units.id` but lack `FOREIGN KEY` constraints. While this is acceptable for flexibility, it risks orphaned records.

**Finding [LOW-02]:** The `payment_ledger.parentLedgerId` self-reference lacks a foreign key constraint. Adding `REFERENCES payment_ledger(id)` would enforce referential integrity for refund/adjustment chains.

### Migration Safety

All migrations use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` patterns, which is correct and safe. The migration journal in `drizzle/meta/_journal.json` is properly maintained.

---

## 3. Business Logic

### Payment Flow

The payment flow is correctly implemented with webhook-only finalization:

```
Invoice Created → Ledger Entry (DUE) → Moyasar Payment Init (PENDING)
    → Webhook Received → HMAC-SHA256 Verified → Ledger Updated (PAID)
```

**Finding [PASS]:** The `updateLedgerStatusSafe()` function correctly enforces:
- PAID rows cannot be modified (except to REFUNDED)
- REFUNDED/VOID rows are immutable
- PAID transition requires `webhookVerified=true` flag
- `timingSafeEqual` used for HMAC comparison (prevents timing attacks)

**Finding [MED-03]:** The Moyasar webhook handler at `moyasar.ts:231` logs a warning but continues processing when no webhook secret is configured. In production, this should be a hard failure to prevent unsigned webhook acceptance.

### Occupancy Logic

**Finding [PASS]:** Beds24-controlled units correctly derive occupancy from Beds24 data only, with UNKNOWN fallback. Local bookings are never used as fallback for Beds24 units.

**Finding [MED-04]:** The iCal sync function (`occupancy.ts:251`) fetches external URLs but has no timeout configuration. A slow or unresponsive iCal endpoint could block the sync process. Add a 10-second timeout.

### Renewal Logic

**Finding [PASS]:** The renewal eligibility check correctly enforces:
- 1-month bookings: exactly 1 extension allowed
- Beds24-controlled units: requires admin approval + change note
- System never writes to Beds24

**Finding [LOW-03]:** The `maxRenewals` field defaults to 1 for all bookings regardless of duration. For 2-month bookings, this should default to 0. Currently, the business rule is enforced in the UI but not in the database default.

### Ledger Immutability

**Finding [PASS]:** The ledger immutability model is sound. Corrections use child entries (REFUND/ADJUSTMENT) linked via `parentLedgerId`, preserving the audit trail.

---

## 4. Workflow Correctness

### Edge Cases Reviewed

| Scenario | Handling | Status |
|----------|----------|--------|
| Double webhook delivery | Idempotent — checks current status before update | PASS |
| Payment timeout (no webhook) | Stays in PENDING — manual review needed | MED-05 |
| Beds24 unit with no data | Returns UNKNOWN — excluded from KPI denominators | PASS |
| Concurrent extension requests | First request wins — subsequent blocked by status check | PASS |
| Archive building with active bookings | Blocked — returns error with reason | PASS |
| Archive unit with active ledger entries | Blocked — returns error with reason | PASS |

**Finding [MED-05]:** There is no automated process to detect and flag payments stuck in PENDING status for extended periods. A scheduled job should mark payments as FAILED or flag them for review after 24 hours.

### Error Handling

The codebase has 115 try-catch blocks across server modules, which is adequate. However:

**Finding [MED-06]:** Several catch blocks in `finance-registry.ts` and `occupancy.ts` log errors to console but return `null` or empty results silently. This can mask real issues. Consider throwing typed errors that the tRPC error handler can translate to appropriate HTTP status codes.

---

## 5. Security

### Secrets Handling

**Finding [PASS]:** Moyasar keys are stored in `platformSettings` (database) rather than environment variables, allowing runtime configuration without redeployment.

**Finding [MED-07]:** The Moyasar secret key is stored in plaintext in `platformSettings`. While the database is access-controlled, encrypting sensitive keys at rest would add defense-in-depth. Consider using AES-256 encryption with a server-side key.

### Webhook Validation

**Finding [PASS]:** HMAC-SHA256 with `timingSafeEqual` is correctly implemented for Moyasar webhooks.

**Finding [HIGH-02]:** The webhook endpoint at `payment-webhooks.ts` does not implement IP allowlisting for Moyasar's webhook source IPs. While HMAC verification provides strong authentication, IP allowlisting adds defense-in-depth.

### RBAC

**Finding [PASS]:** The finance module correctly uses `adminProcedure` and `adminWithPermission` middleware for all admin operations. 155 route definitions use RBAC middleware.

### Input Validation

**Finding [PASS]:** 597 Zod validation schemas are used across the codebase, providing strong input validation for tRPC procedures.

**Finding [LOW-04]:** The `audit-log.ts:78` constructs a WHERE clause dynamically. While parameters are properly bound, the `where` variable is built from string concatenation. Consider using a query builder pattern for consistency.

### Rate Limiting

**Finding [MED-08]:** Rate limiting is implemented for OTP endpoints (`server/otp.ts`) but not for the webhook endpoint or payment creation endpoint. A malicious actor could flood the webhook endpoint with invalid payloads, causing unnecessary HMAC computations.

---

## 6. Performance

### Query Optimization

**Finding [HIGH-01]:** (Repeated) Missing indexes on high-traffic query patterns. The KPI calculation in `getBuildingKPIs()` performs 5+ sequential queries against `payment_ledger` and `units` tables. Without proper indexes, this will degrade as data grows.

**Finding [MED-09]:** The `searchLedger()` function in `finance-registry.ts:251` supports text search across multiple columns using `LIKE '%query%'`. This pattern cannot use indexes and will perform full table scans. Consider implementing full-text search indexes for the `payment_ledger` table.

### Pagination

**Finding [PASS]:** Pagination is implemented across admin list endpoints using `limit` and `offset` parameters. 198 references to pagination-related code exist.

**Finding [LOW-05]:** Offset-based pagination is used throughout. For large datasets, cursor-based pagination would be more efficient, but this is a low-priority optimization.

### Caching

**Finding [PASS]:** The codebase has 170 references to caching logic, primarily through `server/cache.ts`. Site settings and permissions are cached appropriately.

**Finding [MED-10]:** KPI calculations are not cached. Each dashboard load triggers 5+ database queries per building. Consider caching KPI results with a 5-minute TTL.

---

## 7. Observability

**Finding [MED-11]:** The system uses `console.log` and `console.warn` for logging. There is no structured logging framework (e.g., Winston, Pino) that would enable log aggregation, filtering by severity, or correlation IDs for request tracing.

**Finding [LOW-06]:** No health check endpoint exists for the finance module specifically. The general `/api/health` endpoint checks database connectivity but does not verify Moyasar configuration or Beds24 mapping integrity.

---

## Findings Summary

| Severity | ID | Finding | Recommended Fix |
|----------|-----|---------|----------------|
| **BLOCKER** | — | None | — |
| **HIGH** | HIGH-01 | Missing database indexes on high-traffic tables | Add migration `0019_add_indexes.sql` |
| **HIGH** | HIGH-02 | No IP allowlisting for webhook endpoint | Add Moyasar IP allowlist middleware |
| **MED** | MED-01 | God router file (routers.ts ~1,500 lines) | Progressive decomposition |
| **MED** | MED-02 | Implicit foreign keys | Add FK constraints in next migration |
| **MED** | MED-03 | Webhook processes without secret configured | Hard-fail when no secret |
| **MED** | MED-04 | iCal sync has no timeout | Add 10s fetch timeout |
| **MED** | MED-05 | No stale PENDING payment detection | Add scheduled cleanup job |
| **MED** | MED-06 | Silent error swallowing in catch blocks | Throw typed errors |
| **MED** | MED-07 | Moyasar secret key stored in plaintext | Encrypt at rest |
| **MED** | MED-08 | No rate limiting on webhook endpoint | Add rate limiter |
| **MED** | MED-09 | LIKE '%query%' search pattern | Add full-text search index |
| **MED** | MED-10 | KPI calculations not cached | Add 5-min TTL cache |
| **MED** | MED-11 | No structured logging | Adopt Pino or Winston |
| **LOW** | LOW-01 | db.ts mixes domain concerns | Split into domain modules |
| **LOW** | LOW-02 | parentLedgerId lacks FK constraint | Add self-referencing FK |
| **LOW** | LOW-03 | maxRenewals default doesn't match business rule | Set default based on duration |
| **LOW** | LOW-04 | Dynamic WHERE clause in audit-log | Use query builder |
| **LOW** | LOW-05 | Offset-based pagination | Consider cursor-based |
| **LOW** | LOW-06 | No finance-specific health check | Add module health endpoint |

---

## "Do Not Change" List

The following files and integrations are sensitive and must NOT be modified without explicit approval and comprehensive testing:

| Path / Component | Reason |
|-------------------|--------|
| `packages/beds24-sdk/**` | External SDK — immutable by policy |
| `services/hub-api/src/routes/webhooks.ts` | Beds24 webhook security |
| `services/hub-api/src/config.ts` | Beds24 configuration |
| `services/hub-api/src/index.ts` | Hub API entry point |
| `server/moyasar.ts:206-215` | HMAC verification — security-critical |
| `server/finance-registry.ts:352-390` | Ledger immutability guard — audit-critical |
| `server/beds24-guard.ts` | Runtime safety guardrail |
| `drizzle/schema.ts` (existing tables) | Only additive changes allowed |

---

## Test Gap Analysis

| Area | Current Coverage | Recommended Addition |
|------|-----------------|---------------------|
| Finance Registry | 219 tests (custom) | Add Vitest integration tests with DB mocks |
| Moyasar Payment | 35 tests (custom) | Add end-to-end webhook flow test |
| Payment Badges | 58 tests (custom) | Add visual regression tests |
| Occupancy iCal | Covered in finance suite | Add timeout/error handling tests |
| KPI Calculations | Covered in finance suite | Add edge case tests (zero units, all UNKNOWN) |
| Stale PENDING cleanup | Not tested | Add scheduled job tests |
| Rate limiting (webhook) | Not tested | Add load test for webhook endpoint |
| Concurrent extensions | Logic tested | Add race condition test |

---

## Conclusion

The Monthly Key platform is architecturally sound with strong safety guardrails around the Beds24 integration. The finance module is well-tested (312 custom tests passing) and follows good patterns for ledger immutability and webhook-only payment finalization. The primary areas for improvement are database indexing (HIGH-01), webhook IP allowlisting (HIGH-02), and several medium-severity items around error handling, caching, and observability. No blockers were found.
