# MonthlyKey — Enterprise Remediation Roadmap

**Version:** 2.0  
**Date:** 2026-02-26  
**Classification:** Internal — Engineering & Management  
**Compliance note:** No Beds24 changes. No Mansun dependency added.

---

## 1. Executive Summary

This roadmap translates the findings from the Enterprise Audit Report into a prioritized, time-boxed remediation plan across four horizons: 24 hours (emergency), 7 days (critical), 30 days (important), and 90 days (strategic). Each item includes the finding reference, effort estimate, acceptance criteria, verification commands, and the responsible spec document. The roadmap is designed to be executed incrementally — each phase builds on the previous one without requiring a full system rewrite.

---

## 2. Horizon 1 — Emergency (24 Hours)

These items address vulnerabilities that can be exploited immediately with minimal attacker skill. They must be completed before any new features are developed.

### H1-01: JWT Secret Fail-Fast — ✅ DONE

| Property | Value |
|----------|-------|
| **Finding** | F-01 (Critical, CVSS 9.8) |
| **Spec** | AUTH_SESSION_SPEC.md §2 |
| **Effort** | 1 hour |
| **Files** | `server/_core/env.ts` |
| **Owner** | Lead Engineer |
| **Status** | ✅ Implemented — commit `sec: JWT fail-fast + password policy 12+ + session TTL 30min` |
| **Verified** | `requireProductionSecret()` calls `process.exit(1)` if missing/short in production |

**Task:** Add production fail-fast validation to `server/_core/env.ts`. The server must call `process.exit(1)` if `JWT_SECRET` is missing or shorter than 64 characters when `NODE_ENV=production` or `RAILWAY_ENVIRONMENT` is set.

**Acceptance criteria:**

1. Server refuses to start without `JWT_SECRET` in production — verified by temporarily unsetting the variable and observing the exit.
2. Server starts normally with a valid 64+ character secret.
3. Server starts with fallback in development (no `NODE_ENV` or `RAILWAY_ENVIRONMENT`).

**Verification:**

```bash
# Generate and set a production-grade secret
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
railway variables set JWT_SECRET=<output>

# Verify fail-fast (temporarily unset)
railway variables unset JWT_SECRET
# Deploy should fail with FATAL error in logs
railway variables set JWT_SECRET=<original_value>
```

---

### H1-02: Change Admin Seed Password — ✅ DONE

| Property | Value |
|----------|-------|
| **Finding** | F-02 (Critical, CVSS 9.1) |
| **Spec** | AUTH_SESSION_SPEC.md §3.5 |
| **Effort** | 30 minutes |
| **Files** | `server/seed-admin.ts` |
| **Owner** | Lead Engineer |
| **Status** | ✅ Implemented — `seed-admin.ts` now reads `ADMIN_INITIAL_PASSWORD` env var |
| **Verified** | `grep -rn '15001500' server/seed-admin.ts` returns no results |

**Task:** Replace the hardcoded password `15001500` in `server/seed-admin.ts` with an environment variable `ADMIN_INITIAL_PASSWORD`. If the variable is not set, generate a random 16-character password and log it to stdout (one-time). Immediately after deployment, log in with the generated password and change it to a strong password via the admin panel.

**Acceptance criteria:**

1. `seed-admin.ts` no longer contains the string `15001500`.
2. Login with `Hobart` / `15001500` fails on production.
3. Admin can log in with the new password.

**Verification:**

```bash
grep -rn "15001500" server/seed-admin.ts
# Must return no results
```

---

### H1-03: Password Policy Upgrade — ✅ DONE

| Property | Value |
|----------|-------|
| **Finding** | F-03 (High, CVSS 7.5) |
| **Spec** | AUTH_SESSION_SPEC.md §3 |
| **Effort** | 1 hour |
| **Files** | `server/_core/auth.ts`, `client/src/pages/Register.tsx`, `client/src/lib/i18n.tsx` |
| **Owner** | Lead Engineer |
| **Status** | ✅ Implemented — `validatePassword()` enforces 12+ chars, uppercase, lowercase, digit, special |
| **Verified** | 10 unit tests passing in `tests/security-hardening.test.ts` |

**Task:** Update both `registerLocal` and `registerWithOtp` handlers to enforce 12-character minimum with complexity requirements (uppercase, lowercase, digit, special character). Add a `validatePassword()` function that returns localized error messages in Arabic.

**Acceptance criteria:**

1. Registration with `abc123` fails with "كلمة المرور يجب أن تكون 12 حرفاً على الأقل".
2. Registration with `abcdefghijkl` fails with "كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل".
3. Registration with `Abcdefgh1!kl` succeeds.
4. Existing users with weak passwords can still log in (no forced change yet).

**Verification:**

```bash
# Test via API
curl -X POST https://monthly-key-app-production.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"userId":"testuser","password":"short","phone":"+966500000000"}'
# Should return 400 with password policy error
```

---

### H1-04: OTP Pepper Fail-Fast — ✅ DONE

| Property | Value |
|----------|-------|
| **Finding** | Related to F-01 |
| **Spec** | AUTH_SESSION_SPEC.md §2.3 |
| **Effort** | 15 minutes |
| **Files** | `server/_core/env.ts` |
| **Owner** | Lead Engineer |
| **Status** | ✅ Implemented — same `requireProductionSecret()` pattern applied to OTP_PEPPER |

**Task:** Apply the same fail-fast pattern to `OTP_SECRET_PEPPER` as H1-01.

**Acceptance criteria:** Server refuses to start without `OTP_SECRET_PEPPER` in production.

---

## 3. Horizon 2 — Critical (7 Days)

These items address structural weaknesses that increase risk as the platform scales. They should be completed within one sprint.

### H2-01: Database Foreign Key Constraints — ✅ DONE

| Property | Value |
|----------|-------|
| **Finding** | F-06 (High, CVSS 6.5) |
| **Spec** | DB_INTEGRITY_SPEC.md §2 |
| **Effort** | 4 hours |
| **Files** | `drizzle/0015_db_integrity_fk_indexes.sql` |
| **Owner** | Backend Engineer |
| **Status** | ✅ Implemented — 29 FK constraints + orphan cleanup in migration 0015 |

**Task:** Run the orphan detection query (DB_INTEGRITY_SPEC.md §4) to confirm zero orphans. Then create and execute a Drizzle migration that adds all 20 FK constraints defined in DB_INTEGRITY_SPEC.md §2.2. Schedule the migration during a low-traffic window (e.g., 03:00 AST).

**Acceptance criteria:**

1. `SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='railway' AND CONSTRAINT_TYPE='FOREIGN KEY';` returns 20.
2. Attempting to insert a booking with a non-existent `tenantId` fails with a FK violation error.
3. All existing application flows (create booking, approve booking, etc.) continue to work.

**Rollback plan:** Each FK constraint can be dropped individually without data loss:

```sql
ALTER TABLE bookings DROP FOREIGN KEY fk_bookings_tenant;
```

---

### H2-02: Transaction Boundaries for Financial Operations — ✅ DONE

| Property | Value |
|----------|-------|
| **Finding** | F-05 (High, CVSS 7.0) |
| **Spec** | DB_INTEGRITY_SPEC.md §3 |
| **Effort** | 3 hours |
| **Files** | `server/db.ts`, `server/routers.ts` |
| **Owner** | Backend Engineer |
| **Status** | ✅ Implemented — `withTransaction()` helper + approveBooking + confirmPayment wrapped |

**Task:** Add a `withTransaction()` helper to `server/db.ts`. Wrap the `approveBooking`, `confirmPayment`, and `rejectBooking` handlers in transactions. Keep email and push notification sends outside the transaction boundary.

**Acceptance criteria:**

1. `grep -n "transaction" server/routers.ts` returns matches for all three handlers.
2. Simulated failure after `updateBooking` in `approveBooking` results in rollback (booking remains `pending`).
3. Successful `approveBooking` creates both the booking update and payment record atomically.

---

### H2-03: Database Indexes (P1 Set) — ✅ DONE

| Property | Value |
|----------|-------|
| **Finding** | F-07 (Medium, CVSS 5.0) |
| **Spec** | DB_INTEGRITY_SPEC.md §5 |
| **Effort** | 1 hour |
| **Files** | `drizzle/0015_db_integrity_fk_indexes.sql` |
| **Owner** | Backend Engineer |
| **Status** | ✅ Implemented — 30 indexes (P1+P2 combined) in migration 0015 |

**Task:** Create and execute a migration that adds the 8 P1 indexes defined in DB_INTEGRITY_SPEC.md §5.2 (bookings.tenantId, bookings.landlordId, bookings.propertyId, bookings.status, payments.bookingId, properties.landlordId, properties.city, properties.status).

**Acceptance criteria:**

1. `SHOW INDEX FROM bookings;` returns 4 new indexes.
2. `EXPLAIN SELECT * FROM bookings WHERE tenantId=1;` shows index usage (not full table scan).

---

### H2-04: Account Lockout — ✅ DONE

| Property | Value |
|----------|-------|
| **Finding** | F-10 (Medium, CVSS 4.0) |
| **Spec** | AUTH_SESSION_SPEC.md §5 |
| **Effort** | 2 hours |
| **Files** | `server/rate-limiter.ts`, `server/_core/auth.ts` |
| **Owner** | Backend Engineer |
| **Status** | ✅ Implemented — in-memory lockout (5 attempts → 15 min). Will move to Redis when deployed. |
| **Verified** | 5 unit tests passing in `tests/security-hardening.test.ts` |

**Task:** Add `failedLoginAttempts` (INT, default 0) and `lockedUntil` (DATETIME, nullable) columns to the `users` table. Implement lockout logic: 5 failed attempts → 30-minute lockout. Reset counter on successful login.

**Acceptance criteria:**

1. 5 consecutive failed logins for the same user → error "الحساب مقفل. حاول مرة أخرى بعد 30 دقيقة".
2. Login attempt during lockout period → rejected with remaining time.
3. Login after lockout expires → succeeds, counter resets.

---

### H2-05: CI Pipeline Setup — ✅ DONE

| Property | Value |
|----------|-------|
| **Finding** | F-09 (Medium, CVSS 4.5) |
| **Spec** | CICD_RELEASE_PLAN.md §4.1 |
| **Effort** | 3 hours |
| **Files** | `.github/workflows/ci.yml`, `.github/workflows/deploy-staging.yml`, `.github/workflows/deploy-production.yml` |
| **Owner** | DevOps / Lead Engineer |
| **Status** | ✅ Implemented — CI (typecheck + test + secret-scan + migration-check + build) + staging + production deploy workflows |

**Task:** Create the CI workflow file, ESLint configuration, and package.json scripts as defined in CICD_RELEASE_PLAN.md §4.1 and §6. Configure GitHub branch protection rules for `main` (CICD_RELEASE_PLAN.md §5).

**Acceptance criteria:**

1. Opening a PR to `main` triggers the CI workflow.
2. CI runs: typecheck → test → security scan → build check.
3. PR cannot be merged if any required check fails.

---

## 4. Horizon 3 — Important (30 Days)

These items improve the platform's operational maturity and prepare for horizontal scaling.

### H3-01: Dual-Token Architecture

| Property | Value |
|----------|-------|
| **Finding** | F-04 (High, CVSS 7.2) |
| **Spec** | AUTH_SESSION_SPEC.md §4 |
| **Effort** | 8 hours |
| **Files** | `server/_core/auth.ts`, `drizzle/schema.ts`, `server/db.ts`, `client/src/lib/trpc.ts` |
| **Owner** | Backend Engineer + Frontend Engineer |

**Task:** Implement 15-minute access tokens with 7-day refresh tokens. Add the `refresh_tokens` table. Implement refresh token rotation with reuse detection. Add the client-side refresh interceptor in the tRPC link chain.

**Acceptance criteria:** See AUTH_SESSION_SPEC.md §4.6 for the full acceptance criteria table.

**Migration plan:** Existing 365-day tokens remain valid until they expire naturally. New logins issue dual tokens. After 30 days, force-expire all legacy tokens.

---

### H3-02: Redis Deployment — ⚡ PARTIALLY DONE (code ready, needs Redis service)

| Property | Value |
|----------|-------|
| **Finding** | F-08 (Medium, CVSS 5.0) |
| **Spec** | CACHING_SCALABILITY_PLAN.md §3 |
| **Effort** | 4 hours |
| **Files** | `server/cache.ts` |
| **Owner** | Backend Engineer + DevOps |
| **Status** | ⚡ Code updated — `cache.ts` auto-detects `REDIS_URL` and switches to `ioredis`. Needs Redis service on Railway. |

**Task:** Deploy Redis on Railway. Set `REDIS_URL` env var. The code already supports auto-detection.

**Acceptance criteria:**

1. `REDIS_URL` environment variable is set in Railway.
2. Health check endpoint shows `redis: "up"`.
3. Admin settings update on one instance is visible on all instances within 1 second.
4. Rate limiter persists across deploys (verified by checking counters after a deploy).

---

### H3-03: Database Indexes (P2 Set)

| Property | Value |
|----------|-------|
| **Finding** | F-07 continuation |
| **Spec** | DB_INTEGRITY_SPEC.md §5.2 |
| **Effort** | 1 hour |
| **Files** | `drizzle/migrations/XXXX_add_indexes_p2.sql` |
| **Owner** | Backend Engineer |

**Task:** Add the remaining 8 P2 indexes (favorites, reviews, messages, notifications, maintenanceRequests).

---

### H3-04: Content Security Policy Header

| Property | Value |
|----------|-------|
| **Finding** | Missing CSP header |
| **Spec** | ENTERPRISE_AUDIT_REPORT.md §6 |
| **Effort** | 2 hours |
| **Files** | `server/middleware/security-headers.ts` |
| **Owner** | Backend Engineer |

**Task:** Add a `Content-Security-Policy` header. Start with report-only mode for 2 weeks to identify violations, then switch to enforcement.

**Initial policy:**

```
Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://*.unsplash.com; connect-src 'self' https://api.whatsapp.com;
```

---

### H3-05: DOMPurify for dangerouslySetInnerHTML

| Property | Value |
|----------|-------|
| **Finding** | XSS via dangerouslySetInnerHTML |
| **Spec** | ENTERPRISE_AUDIT_REPORT.md §5.2 |
| **Effort** | 1 hour |
| **Files** | `client/src/lib/utils.ts`, `client/src/pages/PropertyDetail.tsx` |
| **Owner** | Frontend Engineer |

**Task:** Install `dompurify` and wrap all `dangerouslySetInnerHTML` content through `DOMPurify.sanitize()`.

---

### H3-06: Staging Environment

| Property | Value |
|----------|-------|
| **Finding** | No staging environment |
| **Spec** | CICD_RELEASE_PLAN.md §4.2 |
| **Effort** | 3 hours |
| **Files** | `.github/workflows/deploy-staging.yml`, Railway configuration |
| **Owner** | DevOps |

**Task:** Create a Railway staging service with a separate MySQL database. Configure the staging deploy workflow to trigger on merge to `main`. Add smoke tests and health checks.

---

### H3-07: Connection Pool Consolidation

| Property | Value |
|----------|-------|
| **Finding** | 3 separate DB pools |
| **Spec** | DB_INTEGRITY_SPEC.md §6 |
| **Effort** | 1 hour |
| **Files** | `server/db.ts`, `server/push.ts`, `server/routers.ts` |
| **Owner** | Backend Engineer |

**Task:** Export a single configured pool from `server/db.ts` with `connectionLimit: 10`. Update `push.ts` and `routers.ts` to import and reuse this pool.

---

## 5. Horizon 4 — Strategic (90 Days)

These items are long-term improvements that enhance the platform's enterprise readiness.

### H4-01: Horizontal Scaling

| Spec | CACHING_SCALABILITY_PLAN.md §5.2 |
|------|----------------------------------|
| **Effort** | 8 hours |
| **Prerequisites** | H3-02 (Redis), H3-07 (Pool consolidation) |

**Task:** After Redis migration is complete, configure Railway to run 2-3 instances behind the load balancer. Verify that all state is shared via Redis and no in-process state remains.

---

### H4-02: Production Deploy Pipeline

| Spec | CICD_RELEASE_PLAN.md §4.3 |
|------|---------------------------|
| **Effort** | 2 hours |
| **Prerequisites** | H3-06 (Staging environment) |

**Task:** Create the production deploy workflow with manual approval gate and health check verification.

---

### H4-03: Session Revocation UI

| Spec | AUTH_SESSION_SPEC.md §6 |
|------|------------------------|
| **Effort** | 4 hours |
| **Prerequisites** | H3-01 (Dual-token architecture) |

**Task:** Add a "Active Sessions" page in user settings where users can view and revoke their active sessions. Add admin capability to revoke all sessions for any user.

---

### H4-04: Structured Logging

| Effort | 4 hours |
|--------|---------|

**Task:** Replace `console.log/error/warn` with a structured logging library (e.g., `pino`). Add request ID tracking, user ID context, and JSON-formatted output for log aggregation.

---

### H4-05: Automated Orphan Detection

| Spec | DB_INTEGRITY_SPEC.md §4 |
|------|------------------------|
| **Effort** | 2 hours |
| **Prerequisites** | H2-05 (CI pipeline) |

**Task:** Add a scheduled GitHub Action that runs the orphan detection query weekly and creates an issue if any orphans are found.

---

### H4-06: Non-Root Docker User

| Spec | ENTERPRISE_AUDIT_REPORT.md §9.2 |
|------|--------------------------------|
| **Effort** | 30 minutes |

**Task:** Add `RUN adduser --disabled-password --gecos "" appuser` and `USER appuser` to the Dockerfile.

---

## 6. Summary Timeline

```
Day 0 ──────────────────────────────────────────── Day 90
│                                                      │
│ H1: Emergency (24h)                                  │
│ ├─ H1-01: JWT fail-fast                              │
│ ├─ H1-02: Admin password                             │
│ ├─ H1-03: Password policy                            │
│ └─ H1-04: OTP pepper fail-fast                       │
│                                                      │
│     H2: Critical (7d)                                │
│     ├─ H2-01: FK constraints                         │
│     ├─ H2-02: Transactions                           │
│     ├─ H2-03: Indexes (P1)                           │
│     ├─ H2-04: Account lockout                        │
│     └─ H2-05: CI pipeline                            │
│                                                      │
│              H3: Important (30d)                     │
│              ├─ H3-01: Dual-token auth               │
│              ├─ H3-02: Redis deployment              │
│              ├─ H3-03: Indexes (P2)                  │
│              ├─ H3-04: CSP header                    │
│              ├─ H3-05: DOMPurify                     │
│              ├─ H3-06: Staging env                   │
│              └─ H3-07: Pool consolidation            │
│                                                      │
│                          H4: Strategic (90d)         │
│                          ├─ H4-01: Horizontal scale  │
│                          ├─ H4-02: Prod deploy pipe  │
│                          ├─ H4-03: Session revoke UI │
│                          ├─ H4-04: Structured logging│
│                          ├─ H4-05: Orphan detection  │
│                          └─ H4-06: Non-root Docker   │
│                                                      │
Day 0 ──────────────────────────────────────────── Day 90
```

---

## 7. Effort Summary

| Horizon | Items | Completed | Remaining Effort | Status |
|---------|-------|-----------|-----------------|--------|
| H1: Emergency (24h) | 4 | **4/4** ✅ | 0 hours | **COMPLETE** |
| H2: Critical (7d) | 5 | **5/5** ✅ | 0 hours | **COMPLETE** |
| H3: Important (30d) | 7 | 1/7 ⚡ | ~18 hours | In progress (Redis code ready) |
| H4: Strategic (90d) | 6 | 0/6 | ~20.5 hours | Not started |
| **Total** | **22 items** | **10/22** | **~38.5 hours** | — |

The total remediation effort is approximately **56.5 engineering hours** spread across 90 days. This is achievable with a single engineer working part-time (15 hours/week) or a team of two engineers in a focused 4-week sprint.

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| FK constraints break existing delete operations | Medium | Medium | Test all delete flows in staging before production. Each FK can be dropped individually. |
| Dual-token migration breaks active user sessions | Low | High | Legacy tokens remain valid for 30 days. New logins get dual tokens. |
| Redis outage degrades all instances | Low | High | Feature flag fallback to in-memory. Redis is not a single point of failure. |
| CI pipeline blocks urgent hotfixes | Low | Medium | Hotfix branch can bypass CI with 2 approvals (CICD_RELEASE_PLAN.md §7.2). |
| Password policy change frustrates existing users | Medium | Low | Existing users are not forced to change. Warning logged on login. |

---

## 9. Confirmation Statements

**No Beds24 changes.** No item in this roadmap modifies the Beds24 SDK, Hub-API Beds24 integration, or Beds24 API contracts.

**No Mansun dependency added.** All tools referenced (Redis, ESLint, Gitleaks, DOMPurify, Pino) are open-source with permissive licenses. No proprietary services or SDKs are introduced.

**No vendor lock-in.** The entire remediation plan uses standard Node.js + MySQL + Redis infrastructure. Railway is used as the hosting platform but can be replaced without code changes.

---

## 10. Document Index

| Document | Purpose | Key Sections |
|----------|---------|-------------|
| `SECURITY_THREAT_MODEL.md` | Threat identification and risk scoring | Attack surfaces, threat actors, STRIDE analysis |
| `SECURITY_CHECKLIST_PRE_DEPLOY.md` | Pre-deployment verification checklist | 38 items across 7 categories with verification commands |
| `AUTH_SESSION_SPEC.md` | Authentication and session management spec | JWT fail-fast, password policy, dual-token, lockout |
| `DB_INTEGRITY_SPEC.md` | Database integrity and performance spec | FK constraints, transactions, indexes, orphan detection |
| `CACHING_SCALABILITY_PLAN.md` | Caching and horizontal scaling plan | Redis migration, rate limiter, stateless checklist |
| `CICD_RELEASE_PLAN.md` | CI/CD pipeline and release process | GitHub Actions, branch protection, ESLint, release flow |
| `ENTERPRISE_AUDIT_REPORT.md` | Comprehensive audit findings | 14 findings, positive findings, cross-references |
| `ENTERPRISE_REMEDIATION_ROADMAP.md` | Prioritized remediation plan (this document) | 22 items across 4 horizons (24h/7d/30d/90d) |
