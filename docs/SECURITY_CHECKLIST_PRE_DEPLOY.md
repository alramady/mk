# MonthlyKey — Pre-Deploy Security Checklist

**Version:** 2.0  
**Date:** 2026-02-26  
**Classification:** Internal — Engineering & DevOps  
**Compliance note:** No Beds24 changes. No Mansun dependency added.

---

## Purpose

This checklist must be completed before every production deployment. Each item includes a verification command or manual step. A deployment **must not proceed** if any P0 item fails. P1 items should be resolved within 48 hours of deployment; P2 items are tracked in the backlog.

---

## Section A — Secrets & Environment Variables

| # | Check | Priority | Verification | Status |
|---|-------|----------|--------------|--------|
| A-1 | `JWT_SECRET` is set and is not the default fallback value | **P0** | `railway variables list \| grep JWT_SECRET` — must exist and not equal `"local-jwt-secret-key-for-development-only-change-in-production"` | ☐ |
| A-2 | `JWT_SECRET` is at least 64 characters of cryptographic randomness | **P0** | `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` — generate and set if needed | ☐ |
| A-3 | `OTP_SECRET_PEPPER` is set and is not the default fallback value | **P0** | `railway variables list \| grep OTP_SECRET_PEPPER` — must exist and not equal `"dev-otp-pepper-change-in-production"` | ☐ |
| A-4 | `DATABASE_URL` uses TLS (`?ssl={"rejectUnauthorized":true}`) | **P1** | Check Railway MySQL connection string for SSL parameter | ☐ |
| A-5 | No secrets are committed to the repository | **P0** | `git log --all -p -S "password" -- "*.ts" "*.json" \| grep -i "15001500\|secret\|apikey" \| head -20` — must return nothing sensitive | ☐ |
| A-6 | Admin seed password has been changed from `15001500` | **P0** | Login with `Hobart` / `15001500` should fail. If it succeeds, change immediately via admin panel. | ☐ |
| A-7 | VAPID keys are set for push notifications (if push is enabled) | **P2** | `railway variables list \| grep VAPID` — both `VITE_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` must exist | ☐ |
| A-8 | PayPal credentials are not stored in `platformSettings` (move to env vars) | **P2** | `SELECT settingKey FROM platformSettings WHERE settingKey LIKE 'paypal%';` — should return only non-secret config | ☐ |

---

## Section B — Authentication & Sessions

| # | Check | Priority | Verification | Status |
|---|-------|----------|--------------|--------|
| B-1 | Password minimum length is 12 characters | **P0** | `grep -n "password.length" server/_core/auth.ts` — must show `< 12` not `< 6` | ☐ |
| B-2 | Password complexity requires uppercase + lowercase + digit + special | **P1** | Review password validation regex in `server/_core/auth.ts` | ☐ |
| B-3 | Session token lifetime is ≤ 15 minutes (access token) | **P1** | `grep -n "expiresIn\|ONE_YEAR" server/_core/auth.ts shared/const.ts` — must not reference `ONE_YEAR_MS` | ☐ |
| B-4 | Refresh token mechanism is implemented with 7-day lifetime | **P1** | Review `server/_core/auth.ts` for refresh token logic | ☐ |
| B-5 | Account lockout after 5 failed attempts (30-min cooldown) | **P1** | `grep -n "lockout\|failedAttempts" server/_core/auth.ts` — must exist | ☐ |
| B-6 | bcrypt cost factor is ≥ 12 | **P0** | `grep -n "genSalt" server/_core/auth.ts server/seed-admin.ts` — must show `genSalt(12)` or higher | ☐ |
| B-7 | OTP max attempts is ≤ 5 | **P0** | `grep -n "MAX_ATTEMPTS\|maxAttempts" server/otp.ts` — must show 5 or less | ☐ |
| B-8 | OTP TTL is ≤ 300 seconds | **P0** | `grep -n "OTP_TTL\|expiresAt" server/otp.ts` — must show 300s or less | ☐ |

---

## Section C — Database Integrity

| # | Check | Priority | Verification | Status |
|---|-------|----------|--------------|--------|
| C-1 | Foreign key constraints exist on `bookings.tenantId → users.id` | **P1** | `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_NAME='bookings' AND REFERENCED_TABLE_NAME='users';` — must return results | ☐ |
| C-2 | Foreign key constraints exist on `bookings.propertyId → properties.id` | **P1** | Same query pattern for `bookings.propertyId` | ☐ |
| C-3 | Foreign key constraints exist on `payments.bookingId → bookings.id` | **P1** | Same query pattern for `payments.bookingId` | ☐ |
| C-4 | Index exists on `bookings.tenantId` | **P1** | `SHOW INDEX FROM bookings WHERE Column_name='tenantId';` — must return a row | ☐ |
| C-5 | Index exists on `properties.landlordId` | **P1** | `SHOW INDEX FROM properties WHERE Column_name='landlordId';` — must return a row | ☐ |
| C-6 | Index exists on `payments.bookingId` | **P1** | `SHOW INDEX FROM payments WHERE Column_name='bookingId';` — must return a row | ☐ |
| C-7 | Zero orphan records exist | **P0** | Run the orphan detection query from `DB_INTEGRITY_SPEC.md` §4 — all counts must be 0 | ☐ |
| C-8 | Transaction boundaries wrap `approveBooking` and `confirmPayment` | **P1** | `grep -n "transaction\|db\.transaction" server/routers.ts` — must show usage around booking approval | ☐ |

---

## Section D — Network & Headers

| # | Check | Priority | Verification | Status |
|---|-------|----------|--------------|--------|
| D-1 | HSTS header is present with `max-age ≥ 31536000` | **P0** | `curl -sI https://monthly-key-app-production.up.railway.app \| grep -i strict-transport` | ☐ |
| D-2 | X-Content-Type-Options is `nosniff` | **P0** | `curl -sI https://monthly-key-app-production.up.railway.app \| grep -i x-content-type` | ☐ |
| D-3 | X-Frame-Options is `DENY` or `SAMEORIGIN` | **P0** | `curl -sI https://monthly-key-app-production.up.railway.app \| grep -i x-frame` | ☐ |
| D-4 | CSP header is present | **P1** | `curl -sI https://monthly-key-app-production.up.railway.app \| grep -i content-security-policy` | ☐ |
| D-5 | CORS is restricted to known origins (not `*`) | **P1** | `grep -n "cors\|origin" server/_core/index.ts` — must not show `origin: '*'` in production | ☐ |
| D-6 | Rate limiter is active on auth endpoints | **P0** | `curl -X POST https://monthly-key-app-production.up.railway.app/api/auth/login -d '{}' -H 'Content-Type: application/json'` — repeat 11 times, 11th should return 429 | ☐ |

---

## Section E — Input Validation & Uploads

| # | Check | Priority | Verification | Status |
|---|-------|----------|--------------|--------|
| E-1 | All tRPC mutations use Zod schemas for input validation | **P0** | `grep -c "\.input(z\." server/routers.ts` — count should match total mutations | ☐ |
| E-2 | File uploads validate content type against allowlist | **P0** | `grep -n "validateContentType" server/routers.ts` — must appear before every upload handler | ☐ |
| E-3 | File upload size limit is ≤ 10MB | **P0** | `grep -n "MAX_BASE64_SIZE" server/security.ts` — must show `14_000_000` (≈10MB after base64 encoding) | ☐ |
| E-4 | `dangerouslySetInnerHTML` uses DOMPurify sanitization | **P2** | `grep -rn "dangerouslySetInnerHTML" client/src/` — all instances must use DOMPurify | ☐ |
| E-5 | No `eval()` in application code | **P0** | `grep -rn "\beval\b" server/ client/src/ --include="*.ts" --include="*.tsx" \| grep -v node_modules \| grep -v ".test."` — must return nothing | ☐ |

---

## Section F — Deployment & Infrastructure

| # | Check | Priority | Verification | Status |
|---|-------|----------|--------------|--------|
| F-1 | Dockerfile uses multi-stage build with non-root user | **P2** | `grep -n "USER\|adduser\|useradd" Dockerfile` — should show non-root user | ☐ |
| F-2 | `start.sh` runs migrations before starting the server | **P0** | `cat start.sh` — must show `drizzle-kit migrate` or equivalent before `node` | ☐ |
| F-3 | Health check endpoint exists and is monitored | **P1** | `curl https://monthly-key-app-production.up.railway.app/api/health` — must return 200 | ☐ |
| F-4 | Error responses do not leak stack traces to clients | **P1** | `curl -X POST https://monthly-key-app-production.up.railway.app/api/trpc/nonexistent` — response must not contain file paths or stack traces | ☐ |
| F-5 | Node.js version is LTS (≥ 20) | **P1** | `grep "node" Dockerfile \| head -3` — must show node:20 or node:22 | ☐ |
| F-6 | `npm audit` shows no critical vulnerabilities | **P1** | `cd /path/to/repo && npm audit --production` — 0 critical | ☐ |

---

## Section G — CI/CD Pipeline (when implemented)

| # | Check | Priority | Verification | Status |
|---|-------|----------|--------------|--------|
| G-1 | GitHub Actions workflow runs on every PR to `main` | **P2** | `.github/workflows/ci.yml` exists and triggers on `pull_request` | ☐ |
| G-2 | Pipeline includes TypeScript type-checking (`tsc --noEmit`) | **P2** | Workflow file contains `tsc` step | ☐ |
| G-3 | Pipeline includes linting (`eslint`) | **P2** | Workflow file contains `eslint` step | ☐ |
| G-4 | Pipeline includes test execution (`vitest run`) | **P2** | Workflow file contains `vitest` step | ☐ |
| G-5 | Pipeline includes secret scanning (e.g., `trufflehog`, `gitleaks`) | **P2** | Workflow file contains secret scanning step | ☐ |
| G-6 | Staging deployment exists and is tested before production | **P2** | Railway staging environment is configured | ☐ |

---

## Deployment Gate Rules

A deployment is **blocked** if any of the following conditions are true:

1. Any **P0** item has status ☐ (unchecked).
2. The `JWT_SECRET` environment variable is missing or matches the default fallback.
3. The admin seed password has not been changed from `15001500`.
4. `npm audit` reports any **critical** severity vulnerability.
5. The orphan record detection query returns any non-zero count.

A deployment **proceeds with tracking** if:

1. All P0 items are ☑.
2. P1 items that are ☐ have been logged as tickets with a 48-hour SLA.
3. P2 items that are ☐ have been added to the sprint backlog.

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Lead Engineer | | | |
| Security Reviewer | | | |
| DevOps | | | |

---

**No Beds24 changes.** This checklist does not include any items that modify Beds24 integration.  
**No Mansun dependency added.** All verification commands use standard tools (curl, grep, mysql, node).
