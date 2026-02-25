# Monthly Key — Development Roadmap & Guardrails

**Document Version:** 1.0
**Date:** February 25, 2026
**Author:** Manus AI

---

## Table of Contents

1. [Phase 1: Stability & Hardening](#phase-1-stability--hardening-weeks-16)
2. [Phase 2: Admin Panel & Automation](#phase-2-admin-panel--automation-weeks-714)
3. [Phase 3: Mobile App Readiness](#phase-3-mobile-app-readiness-weeks-1522)
4. [Phase 4: Enterprise Scaling](#phase-4-enterprise-scaling-weeks-2330)
5. [DO NOT BREAK — Guardrails for Safe Development](#do-not-break--guardrails-for-safe-development)

---

## Phase 1: Stability & Hardening (Weeks 1–6)

**Objective:** Resolve all Critical and High severity audit findings. Establish a secure, tested, and observable foundation.

### Week 1–2: Critical Security Fixes

| Task | Priority | Effort | Audit Ref |
|------|----------|--------|-----------|
| Replace default JWT secret with cryptographically random 64-char secret | P0 | 1h | SEC-01 |
| Add startup validation that rejects default JWT secret | P0 | 2h | SEC-01 |
| Implement strong password policy (12+ chars, complexity) | P0 | 4h | SEC-02 |
| Reduce access token expiration to 15 minutes | P0 | 4h | SEC-03 |
| Implement refresh token mechanism (30-day expiry, rotation) | P0 | 8h | SEC-03 |
| Fix upload directory permissions (755, dedicated user) | P0 | 2h | SEC-06 |
| Remove `unsafe-inline` and `unsafe-eval` from CSP | P1 | 16h | SEC-04 |

### Week 3–4: Data Integrity & Reliability

| Task | Priority | Effort | Audit Ref |
|------|----------|--------|-----------|
| Add foreign key constraints to all MySQL tables | P0 | 8h | DAT-01 |
| Wrap all multi-step DB operations in transactions | P0 | 12h | DAT-02 |
| Add idempotency keys to bookings and payments tables | P1 | 6h | DAT-03 |
| Deploy Redis on Railway | P0 | 2h | PERF-01 |
| Switch cache layer to Redis | P0 | 4h | PERF-01 |
| Switch rate limiter to Redis-backed | P1 | 4h | SEC-05 |
| Make migration failures fatal in start.sh | P1 | 1h | REL-03 |
| Update Railway health check path to `/health` | P1 | 0.5h | REL-01 |

### Week 5–6: CI/CD & Testing

| Task | Priority | Effort | Audit Ref |
|------|----------|--------|-----------|
| Create GitHub Actions CI pipeline (lint, typecheck, test, build, audit) | P0 | 8h | OPS-01 |
| Add `npm audit` to CI pipeline | P1 | 2h | OPS-03 |
| Remove debug collector from production builds | P1 | 1h | ARC-03 |
| Extract seed scripts from startup into standalone commands | P1 | 4h | ARC-02 |
| Add safe area CSS support | P1 | 2h | FE-01 |
| Begin `any` type reduction (target: 50% reduction) | P2 | 16h | ARC-01 |

**Phase 1 Exit Criteria:**
- All Critical and High findings resolved
- CI pipeline running on every PR
- Redis deployed and active
- Security checklist items 1.1–2.8 all pass

---

## Phase 2: Admin Panel & Automation (Weeks 7–14)

**Objective:** Enhance the admin experience, automate operational workflows, and improve landlord tools.

### Week 7–9: Admin Enhancements

| Task | Priority | Effort |
|------|----------|--------|
| Real-time analytics dashboard with WebSocket updates | P1 | 20h |
| Property approval workflow (pending → approved → published) | P1 | 12h |
| Landlord verification process with document upload | P1 | 16h |
| Enhanced user management (search, filter, bulk actions) | P1 | 12h |
| Admin activity audit log (all CRUD operations) | P1 | 8h |

### Week 10–12: Automation & Integration

| Task | Priority | Effort |
|------|----------|--------|
| Automated Beds24 property sync (scheduled worker, every 6 hours) | P1 | 16h |
| Email notification system (booking confirmation, reminders, receipts) | P1 | 20h |
| Automated lease contract generation (PDF with digital signatures) | P1 | 16h |
| WhatsApp notification integration (booking updates) | P2 | 12h |

### Week 13–14: Landlord Dashboard

| Task | Priority | Effort |
|------|----------|--------|
| Revenue analytics with charts (monthly, quarterly, yearly) | P1 | 12h |
| Unified calendar view across all properties | P1 | 16h |
| Occupancy rate tracking and forecasting | P2 | 8h |
| Property performance comparison | P2 | 8h |

**Phase 2 Exit Criteria:**
- Admin can approve/reject properties from dashboard
- Beds24 sync runs automatically without manual intervention
- Email notifications sent for all booking lifecycle events
- Landlord dashboard shows revenue and occupancy data

---

## Phase 3: Mobile App Readiness (Weeks 15–22)

**Objective:** Stabilize the API for mobile consumption, implement caching and push notifications, and prepare for PWA/native app.

### Week 15–17: API Stabilization

| Task | Priority | Effort |
|------|----------|--------|
| Version all API endpoints (prefix with `/v1/`) | P0 | 12h |
| Generate OpenAPI/Swagger documentation from tRPC | P1 | 8h |
| Implement ETags and conditional requests (304 responses) | P1 | 8h |
| Add response pagination to all list endpoints | P1 | 8h |
| Standardize error response format across all services | P1 | 6h |

### Week 18–20: Push Notifications & PWA

| Task | Priority | Effort |
|------|----------|--------|
| Web push notification infrastructure (VAPID keys, service worker) | P1 | 16h |
| Notification preferences UI (per-category opt-in/out) | P1 | 8h |
| Service worker for offline support (cached pages, assets) | P1 | 16h |
| App manifest for PWA install prompt | P1 | 4h |
| Background sync for offline actions | P2 | 12h |

### Week 21–22: Performance Optimization

| Task | Priority | Effort |
|------|----------|--------|
| Custom Vite code splitting (vendor chunk, route-based) | P1 | 8h |
| Image CDN integration (Cloudflare Images or Imgix) | P1 | 12h |
| Implement responsive images with srcset | P1 | 8h |
| Lighthouse audit — target all metrics green | P1 | 8h |
| Complete `any` type elimination | P2 | 16h |

**Phase 3 Exit Criteria:**
- All API endpoints versioned and documented
- Push notifications working for booking events
- PWA installable on mobile devices
- Lighthouse performance score ≥ 90

---

## Phase 4: Enterprise Scaling (Weeks 23–30)

**Objective:** Prepare the platform for high traffic, multi-region deployment, and enterprise features.

### Week 23–25: Infrastructure Scaling

| Task | Priority | Effort |
|------|----------|--------|
| Message queue integration (BullMQ with Redis) for async operations | P1 | 20h |
| CDN deployment (Cloudflare) for static assets | P1 | 8h |
| Database read replicas for query scaling | P1 | 12h |
| Connection pooling optimization (PgBouncer for PostgreSQL) | P1 | 8h |
| Load testing with k6 (target: 1000 concurrent users) | P1 | 12h |

### Week 26–28: Payment & Financial

| Task | Priority | Effort |
|------|----------|--------|
| Stripe payment integration (alongside PayPal) | P1 | 20h |
| Apple Pay / Google Pay support via Stripe | P2 | 8h |
| Mada card support (Saudi debit cards) | P1 | 12h |
| Automated invoicing and receipt generation | P1 | 12h |
| Financial reporting dashboard for admin | P1 | 16h |

### Week 29–30: Multi-Region & Enterprise

| Task | Priority | Effort |
|------|----------|--------|
| Multi-region readiness assessment (GCC expansion) | P2 | 8h |
| Data residency compliance (Saudi PDPL) | P1 | 12h |
| Advanced analytics (custom dashboards, CSV/PDF export) | P2 | 16h |
| API rate limiting tiers (free/premium) | P2 | 8h |
| Comprehensive regression test suite | P1 | 20h |

**Phase 4 Exit Criteria:**
- Platform handles 1000+ concurrent users
- Multiple payment methods available
- CDN serving all static assets
- Full regression test suite with > 80% coverage

---

## DO NOT BREAK — Guardrails for Safe Development

This section defines absolute constraints that must be respected by every developer working on the Monthly Key codebase. Violating any of these guardrails requires explicit written approval from the project lead.

### Guardrail 1: Beds24 Integration Must Remain Stable

The Beds24 integration is the backbone of property and booking management. Any change to the `packages/beds24-sdk/` package or to code that interacts with Beds24 must follow these rules:

| Rule | Details |
|------|---------|
| **No breaking changes to SDK interface** | The public API of `@mk/beds24-sdk` (exported functions, types, and classes) must not change without a major version bump. |
| **Token manager is untouchable** | `packages/beds24-sdk/src/auth/token-manager.ts` handles automatic token refresh. Do not modify the refresh logic without running the full test suite. |
| **Webhook handler must be idempotent** | Processing the same webhook event twice must produce the same result. Always check for existing records before creating new ones. |
| **Beds24 API version pinning** | The SDK targets Beds24 API V2. Do not upgrade to a new API version without a full compatibility assessment. |
| **Fallback on Beds24 failure** | If Beds24 API is unreachable, the application must continue to function using locally cached data. Never block the user experience on a Beds24 API call. |

### Guardrail 2: No Breaking Changes to Current Endpoints Without Versioning

| Rule | Details |
|------|---------|
| **tRPC procedures are contracts** | Existing tRPC procedure names, input schemas, and output shapes must not change. Add new procedures instead of modifying existing ones. |
| **Deprecate, don't delete** | Mark old procedures as deprecated with a `@deprecated` JSDoc comment and a sunset date. Remove only after 2 release cycles. |
| **Version new APIs** | When a breaking change is unavoidable, create a new versioned endpoint (e.g., `getPropertiesV2`) and maintain the old one. |
| **Database migrations are append-only** | Never modify an existing migration file. Always create a new migration. Never use `DROP COLUMN` without a data migration plan. |

### Guardrail 3: Required Regression Tests Before Any Deploy

Every production deployment must pass the following regression tests:

| Test Category | What to Test | How |
|--------------|-------------|-----|
| **Auth flow** | Login, register, logout, password change | Automated (Vitest) |
| **Booking flow** | Create booking, payment callback, status transitions | Automated (Vitest) |
| **Property CRUD** | Create, read, update, deactivate property | Automated (Vitest) |
| **Beds24 sync** | Token refresh, property fetch, booking push | Automated (SDK tests) |
| **Search** | Location search, filters, map view | Manual or E2E |
| **Admin operations** | User management, settings, analytics | Manual or E2E |
| **Maintenance flow** | Create ticket, update status, escalate | Automated (Vitest) |
| **Messaging** | Send message, receive notification | Manual or E2E |

### Guardrail 4: Mandatory Environment Variable Validation

The application must validate the following environment variables on startup and **refuse to start** if any required variable is missing or invalid:

| Variable | Required | Validation |
|----------|----------|-----------|
| `DATABASE_URL` | Yes | Must be a valid MySQL connection string |
| `JWT_SECRET` | Yes | Must be ≥ 64 characters, must NOT match default |
| `NODE_ENV` | Yes | Must be `development`, `staging`, or `production` |
| `BEDS24_REFRESH_TOKEN` | If `ENABLE_BEDS24=true` | Must be non-empty string |
| `BEDS24_WEBHOOK_SECRET` | If `ENABLE_BEDS24_WEBHOOKS=true` | Must be non-empty string |
| `PAYPAL_CLIENT_ID` | If payments enabled | Must be non-empty string |
| `PAYPAL_CLIENT_SECRET` | If payments enabled | Must be non-empty string |
| `S3_ACCESS_KEY_ID` | If S3 storage enabled | Must be non-empty string |
| `S3_SECRET_ACCESS_KEY` | If S3 storage enabled | Must be non-empty string |
| `S3_BUCKET` | If S3 storage enabled | Must be non-empty string |
| `REDIS_URL` | Recommended for production | Must be a valid Redis connection string |

### Guardrail 5: Coding Standards & Folder Conventions

| Standard | Rule |
|----------|------|
| **File naming** | PascalCase for React components (`PropertyDetail.tsx`), camelCase for utilities (`rate-limiter.ts`), kebab-case for CSS modules |
| **Page components** | Must live in `client/src/pages/`. One file per route. |
| **Reusable components** | Must live in `client/src/components/`. Must accept props, not fetch data directly. |
| **Data access** | All database queries must go through `server/db.ts`. No direct Drizzle calls from routers. |
| **API routes** | All tRPC procedures must be defined in `server/routers.ts`. |
| **Validation** | All API inputs must use Zod schemas. No `any` in new code. |
| **Error handling** | Use `TRPCError` for API errors. Never expose stack traces to clients. |
| **Imports** | Use `@/` alias for client imports. Use relative paths for server imports. |
| **Tests** | Every new feature must include at least one test file. Place in the same directory as the source file with `.test.ts` suffix. |
| **Commits** | Follow Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:` |
| **PRs** | Every PR must pass CI checks. At least one approval required. No direct pushes to `main`. |

---

## Summary Timeline

```
Week  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30
      ├──────────────────┤  ├──────────────────────────────┤  ├──────────────────────────┤  ├──────────────────────────┤
      Phase 1: Hardening    Phase 2: Admin & Automation       Phase 3: Mobile Ready        Phase 4: Enterprise Scale
      (Security, DB, CI)    (Workflows, Email, Analytics)     (API, PWA, Push, Perf)       (Queue, CDN, Payments)
```

---

*End of Roadmap & Guardrails*
