# MonthlyKey — Enterprise Audit Report

**Version:** 2.0  
**Date:** 2026-02-26  
**Auditor:** the platform  
**Classification:** Internal — Engineering & Security  
**Compliance note:** No Beds24 changes. No Mansun dependency added.

---

## 1. Executive Summary

This report presents the findings of a comprehensive security and architecture audit of the MonthlyKey monorepo. The audit examined authentication, session management, database integrity, caching, financial operations, input validation, deployment practices, and the Hub-API/Beds24 integration layer. The codebase demonstrates solid foundational engineering — Drizzle ORM prevents SQL injection, Zod schemas validate tRPC inputs, and the modular architecture separates concerns effectively. However, several critical gaps exist that must be addressed before the platform handles real financial transactions or scales beyond a single instance.

### Maturity Assessment

| Domain | Rating | Summary |
|--------|--------|---------|
| **Security** | ⚠️ Medium Risk | JWT secret fallback, 6-char passwords, 365-day sessions, hardcoded admin password |
| **Reliability** | ⚠️ Medium Risk | Zero transactions on financial operations, zero FK constraints, zero indexes |
| **Maintainability** | ✅ Good | Clean TypeScript, modular architecture, Drizzle ORM, tRPC type safety |
| **Scalability** | ⚠️ Medium Risk | In-memory cache/rate-limiter, single-instance only, no Redis |
| **DevOps** | ❌ High Risk | No CI/CD pipeline, no staging environment, no automated testing in workflow |
| **Observability** | ⚠️ Medium Risk | Basic health check exists, no structured logging, no metrics |

### Top 10 Findings (by severity)

| # | Finding | Severity | CVSS | Spec Document |
|---|---------|----------|------|---------------|
| F-01 | JWT secret uses publicly known fallback in production | **Critical** | 9.8 | AUTH_SESSION_SPEC §2 |
| F-02 | Admin seed password hardcoded as `15001500` | **Critical** | 9.1 | AUTH_SESSION_SPEC §3.5 |
| F-03 | 6-character minimum password (SRS requires 12) | **High** | 7.5 | AUTH_SESSION_SPEC §3 |
| F-04 | 365-day session tokens with no refresh/revocation | **High** | 7.2 | AUTH_SESSION_SPEC §4 |
| F-05 | Zero database transactions on financial operations | **High** | 7.0 | DB_INTEGRITY_SPEC §3 |
| F-06 | Zero foreign key constraints (33 tables) | **High** | 6.5 | DB_INTEGRITY_SPEC §2 |
| F-07 | Zero non-PK indexes (full table scans on every query) | **Medium** | 5.0 | DB_INTEGRITY_SPEC §5 |
| F-08 | In-memory cache/rate-limiter (resets on deploy) | **Medium** | 5.0 | CACHING_SCALABILITY_PLAN §2 |
| F-09 | No CI/CD pipeline (no automated quality gates) | **Medium** | 4.5 | CICD_RELEASE_PLAN §2 |
| F-10 | No account lockout after failed login attempts | **Medium** | 4.0 | AUTH_SESSION_SPEC §5 |

---

## 2. Authentication & Authorization

### 2.1 JWT Implementation

The application uses `jsonwebtoken` for session management. The JWT is signed with `HS256` and stored in an httpOnly cookie with `SameSite=Lax` and `Secure=true` (in production). These cookie settings are correct.

**Finding F-01: JWT Secret Fallback**

The file `server/_core/env.ts` contains:

```typescript
cookieSecret: process.env.JWT_SECRET ?? "local-jwt-secret-key-for-development-only-change-in-production"
```

If the `JWT_SECRET` environment variable is missing or unset in the Railway deployment, the server starts with this publicly known string. Any attacker who reads the open-source code can forge valid session tokens for any user, including the admin. This is a **critical** vulnerability.

> **Remediation:** Add fail-fast validation in `env.ts` that calls `process.exit(1)` if `JWT_SECRET` is missing or shorter than 64 characters in production. See `AUTH_SESSION_SPEC.md` §2 for the exact implementation.

**Finding F-04: Session Lifetime**

Sessions are issued with a 365-day expiry (`ONE_YEAR_MS` from `shared/const.ts`). There is no refresh token mechanism and no way to revoke a compromised session short of rotating the JWT secret (which invalidates all sessions for all users).

> **Remediation:** Implement dual-token architecture with 15-minute access tokens and 7-day refresh tokens with rotation and reuse detection. See `AUTH_SESSION_SPEC.md` §4.

### 2.2 Password Policy

**Finding F-03: Weak Password Minimum**

Both `registerLocal` and `registerWithOtp` in `server/_core/auth.ts` enforce a 6-character minimum with no complexity requirements. The SRS_ENTERPRISE.md document specifies 12+ characters — a direct contradiction.

```typescript
// Current code
if (password.length < 6) {
  return res.status(400).json({ message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
}
```

> **Remediation:** Increase to 12-character minimum with uppercase, lowercase, digit, and special character requirements. See `AUTH_SESSION_SPEC.md` §3.

**Finding F-02: Hardcoded Admin Password**

The file `server/seed-admin.ts` contains the hardcoded password `15001500` for the admin user `Hobart`. This password is committed to the repository and is publicly visible.

> **Remediation:** Replace with environment variable `ADMIN_INITIAL_PASSWORD` or generate a random password on first seed. See `AUTH_SESSION_SPEC.md` §3.5.

### 2.3 OTP System

The OTP implementation in `server/otp.ts` is well-designed with proper HMAC-based verification, TTL enforcement, and attempt limiting. The OTP codes are not stored in plaintext — only the HMAC hash is stored. This is a positive finding.

| OTP Property | Value | Assessment |
|-------------|-------|------------|
| Algorithm | HMAC-SHA256 with pepper | ✅ Secure |
| TTL | 5 minutes | ✅ Appropriate |
| Max attempts | 5 | ✅ Appropriate |
| Storage | Hash only (no plaintext) | ✅ Secure |
| Rate limiting | 5 requests per 5 minutes | ✅ Appropriate |

### 2.4 Authorization

The admin permission system uses a dedicated `adminPermissions` table with granular permissions (`manage_users`, `manage_properties`, `manage_bookings`, `manage_cms`, `manage_reports`, `manage_settings`). The `isRoot` flag grants all permissions. The permission check middleware in `server/permissions.ts` correctly validates permissions on every admin request.

**Positive finding:** The permission system is well-structured and follows the principle of least privilege.

---

## 3. Database Integrity

### 3.1 Schema Analysis

The production MySQL database contains 33 tables managed by Drizzle ORM. The schema is defined in `drizzle/schema.ts` and uses Drizzle's `.references()` declarations, but these are **documentation-only** — no actual FK constraints exist in the database.

**Finding F-06: Zero Foreign Key Constraints**

Verified by querying `information_schema.TABLE_CONSTRAINTS`:

```sql
SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
WHERE CONSTRAINT_SCHEMA='railway' AND CONSTRAINT_TYPE='FOREIGN KEY';
-- Result: 0
```

This means the database cannot prevent orphan records at the storage layer. Any application bug, manual SQL operation, or race condition can silently corrupt referential integrity.

> **Remediation:** Add 20 FK constraints as specified in `DB_INTEGRITY_SPEC.md` §2. Pre-flight orphan check must pass before migration.

**Finding F-07: Missing Indexes**

The database has only 6 non-primary-key indexes (3 unique constraints on `users` and `platformSettings`, 2 on `otp_codes`, 1 on `propertyManagers`). Every query that filters by `tenantId`, `landlordId`, `propertyId`, `status`, `city`, or `conversationId` performs a full table scan.

> **Remediation:** Add 16 indexes as specified in `DB_INTEGRITY_SPEC.md` §5. Current data volume is small (most tables have 0-5 rows), so migration cost is negligible.

### 3.2 Orphan Record Scan (2026-02-26)

A comprehensive orphan detection scan was performed against the production database. All 13 relationship checks returned zero orphans. This confirms that the application layer has maintained referential integrity so far, but this is not guaranteed without FK constraints.

### 3.3 Connection Pool

Three separate MySQL connection pools exist in the codebase:

| Pool | File | Configuration |
|------|------|--------------|
| Main pool | `server/db.ts` | Default settings (no limits) |
| Push pool | `server/push.ts` | Default settings (no limits) |
| Shared pool | `server/routers.ts` | Default settings (no limits) |

> **Remediation:** Consolidate to a single shared pool with explicit `connectionLimit: 10`. See `DB_INTEGRITY_SPEC.md` §6.

---

## 4. Financial Operations

### 4.1 Transaction Boundaries

**Finding F-05: Zero Transactions**

The entire codebase contains zero uses of `db.transaction()`. The following multi-step financial operations are at risk of partial completion:

| Operation | Steps | Failure Scenario |
|-----------|-------|-----------------|
| **Approve Booking** | Update booking → Create payment → Create notification | Booking approved but no payment record |
| **Confirm Payment** | Update booking → Loop update payments → Create notification | Booking confirmed but payments not updated |
| **Create Booking** | Create booking → Create notification → Send email | Booking created but no notification |

The `approveBooking` operation is the highest risk because it creates a payment record that is used for financial reconciliation. If the payment insert fails after the booking status is updated, the system enters an inconsistent state where a booking is "approved" but has no associated payment.

> **Remediation:** Wrap all multi-step financial operations in `db.transaction()`. See `DB_INTEGRITY_SPEC.md` §3 for the implementation pattern.

### 4.2 PayPal Integration

The PayPal integration stores client ID and secret in the `platformSettings` database table. While these values are only accessible to admin users, storing API secrets in a database table (rather than environment variables) increases the attack surface — a SQL injection or admin account compromise would expose payment credentials.

> **Remediation (P2):** Move PayPal credentials to environment variables. The admin panel should display masked values and allow updates via a dedicated endpoint that writes to env vars.

---

## 5. Input Validation & XSS

### 5.1 tRPC Input Validation

All tRPC mutations use Zod schemas for input validation. This is a strong positive finding — Zod provides runtime type checking and prevents type confusion attacks. The validation is applied at the tRPC middleware layer, so it cannot be bypassed by the client.

### 5.2 XSS Vectors

**`dangerouslySetInnerHTML` usage:**

The codebase contains 3 instances of `dangerouslySetInnerHTML`:

| File | Line | Content Source | Risk |
|------|------|---------------|------|
| `PropertyDetail.tsx` | ~350 | `formatMarkdown(property.description)` | **Medium** — user-generated content |
| `PropertyDetail.tsx` | ~380 | `formatMarkdown(property.houseRules)` | **Medium** — user-generated content |
| `AIAssistant.tsx` | ~120 | `formatMarkdown(message.content)` | **Low** — AI-generated content |

The `formatMarkdown` function in `client/src/lib/utils.ts` converts markdown to HTML using regex replacements. It does **not** use DOMPurify or any sanitization library. While the content is typically entered by landlords (trusted users), a compromised landlord account could inject malicious scripts into property descriptions that execute in tenant browsers.

> **Remediation (P2):** Add DOMPurify sanitization before `dangerouslySetInnerHTML`. Install `dompurify` and `@types/dompurify` as dependencies.

### 5.3 Server-Side Sanitization

The `sanitizeText` function in `server/security.ts` strips HTML tags and trims whitespace. The `sanitizeObject` function applies `sanitizeText` recursively to all string values in an object. These functions are used in the image upload validation flow but are **not applied to all tRPC inputs** — they are only used for specific security-sensitive operations.

---

## 6. Security Headers

The `server/middleware/security-headers.ts` middleware sets the following headers:

| Header | Value | Assessment |
|--------|-------|------------|
| `X-Content-Type-Options` | `nosniff` | ✅ Correct |
| `X-Frame-Options` | `DENY` | ✅ Correct |
| `X-XSS-Protection` | `1; mode=block` | ⚠️ Deprecated but harmless |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ Correct |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | ✅ Correct |
| `Content-Security-Policy` | Not set | ⚠️ Missing — should be added |
| `Permissions-Policy` | Not set | ⚠️ Missing — low priority |

> **Remediation (P1):** Add a Content-Security-Policy header. Start with a report-only policy to identify violations before enforcing.

---

## 7. Rate Limiting

The rate limiter in `server/rate-limiter.ts` uses an in-memory `Map` with sliding window counters. The configuration is appropriate for the current traffic level:

| Endpoint | Window | Max Requests | Assessment |
|----------|--------|-------------|------------|
| Auth endpoints | 5 min | 10 | ✅ Appropriate |
| OTP send | 5 min | 5 | ✅ Appropriate |
| OTP verify | 5 min | 10 | ✅ Appropriate |
| General API | 1 min | 100 | ✅ Appropriate |

**Finding F-08:** The rate limiter resets on every deploy (Railway restarts the container). An attacker can time brute-force attacks around known deploy windows. Additionally, with multiple instances, each instance maintains independent counters, allowing an attacker to multiply their allowed attempts by the number of instances.

> **Remediation:** Migrate to Redis-backed rate limiting. See `CACHING_SCALABILITY_PLAN.md` §4.

---

## 8. Hub-API & Beds24 Integration

### 8.1 Architecture

The Hub-API is a separate Express service that acts as a proxy between MonthlyKey and the Beds24 API. It maintains its own PostgreSQL database, BullMQ job queue, and Beds24 token manager. The Hub-API is authenticated via a shared `HUB_API_SECRET` between the main application and the Hub-API.

### 8.2 Beds24 Token Management

The `Beds24TokenManager` in `server/beds24-sdk.ts` manages OAuth2 access tokens for the Beds24 API. Tokens are stored in-memory with automatic refresh 5 minutes before expiry. The refresh token is stored in the Hub-API's PostgreSQL database.

**Positive findings:**

- Token refresh is automatic and handles expiry correctly.
- The SDK uses proper error handling with retry logic.
- API calls are rate-limited to prevent Beds24 API abuse.

**No changes are recommended for the Beds24 integration.** The current implementation is functional and stable.

### 8.3 Hub-API Security

The Hub-API uses a shared secret for authentication between services. This is acceptable for internal service-to-service communication but should be rotated periodically. The Hub-API's PostgreSQL database has proper indexes and uses Drizzle ORM with FK references.

---

## 9. Deployment & Infrastructure

### 9.1 Current Deployment

| Component | Platform | Configuration |
|-----------|----------|--------------|
| Main App | Railway | Auto-deploy on `main` push, single instance |
| Hub-API | Railway | Separate service, same project |
| MySQL | Railway | Managed MySQL 8, single instance |
| PostgreSQL | Railway | Managed PostgreSQL (Hub-API only) |
| Redis | Not deployed | — |
| Staging | Not configured | — |

### 9.2 Dockerfile

The Dockerfile uses a multi-stage build with Node.js 22 Alpine. The application runs as the default user (root) inside the container. While Railway's container runtime provides isolation, running as root increases the blast radius of a container escape.

> **Remediation (P2):** Add a non-root user to the Dockerfile.

### 9.3 Start Script

The `start.sh` script runs `drizzle-kit migrate` before starting the Node.js server. This ensures database migrations are applied on every deploy. However, there is no rollback mechanism if a migration fails — the server starts with a partially migrated database.

> **Remediation (P2):** Add migration status check after `drizzle-kit migrate`. If migration fails, exit with a non-zero code to prevent the server from starting.

---

## 10. Positive Findings

The following aspects of the codebase demonstrate good engineering practices:

| Finding | Details |
|---------|---------|
| **SQL injection prevention** | Drizzle ORM parameterizes all queries. No raw SQL concatenation found. |
| **Type safety** | Full TypeScript with tRPC provides end-to-end type safety from client to server. |
| **Input validation** | Zod schemas on all tRPC mutations prevent invalid data from reaching handlers. |
| **OTP security** | HMAC-based OTP with pepper, no plaintext storage, proper TTL and attempt limits. |
| **Cookie security** | httpOnly, Secure, SameSite=Lax — correct configuration for session cookies. |
| **Security headers** | HSTS, X-Frame-Options, X-Content-Type-Options all correctly set. |
| **File upload validation** | Content type allowlist, size limits, and sanitization applied to uploads. |
| **Modular architecture** | Clean separation of concerns: auth, routes, DB, cache, permissions, security. |
| **Beds24 integration** | Proper token management, error handling, and rate limiting. |
| **Admin permissions** | Granular permission system with least-privilege enforcement. |

---

## 11. Document Cross-References

| Finding | Severity | Remediation Document | Section |
|---------|----------|---------------------|---------|
| F-01: JWT secret fallback | Critical | AUTH_SESSION_SPEC.md | §2 |
| F-02: Hardcoded admin password | Critical | AUTH_SESSION_SPEC.md | §3.5 |
| F-03: 6-char password minimum | High | AUTH_SESSION_SPEC.md | §3 |
| F-04: 365-day sessions | High | AUTH_SESSION_SPEC.md | §4 |
| F-05: Zero transactions | High | DB_INTEGRITY_SPEC.md | §3 |
| F-06: Zero FK constraints | High | DB_INTEGRITY_SPEC.md | §2 |
| F-07: Missing indexes | Medium | DB_INTEGRITY_SPEC.md | §5 |
| F-08: In-memory cache/rate-limiter | Medium | CACHING_SCALABILITY_PLAN.md | §2-4 |
| F-09: No CI/CD pipeline | Medium | CICD_RELEASE_PLAN.md | §3-4 |
| F-10: No account lockout | Medium | AUTH_SESSION_SPEC.md | §5 |
| XSS via dangerouslySetInnerHTML | Medium | This document §5.2 |
| Missing CSP header | Medium | This document §6 |
| PayPal secrets in DB | Low | This document §4.2 |
| Root user in Docker | Low | This document §9.2 |

---

## 12. Confirmation Statements

**No Beds24 changes.** This audit report does not recommend any modifications to the Beds24 SDK, Hub-API Beds24 integration, or Beds24 API contracts.

**No Mansun dependency added.** All recommended tools and libraries are open-source with permissive licenses (MIT, Apache 2.0). No proprietary services, SDKs, or telemetry are introduced.

**No vendor lock-in.** The entire stack runs on standard Node.js + MySQL + Redis infrastructure. Railway is used as the hosting platform but can be replaced with any container hosting service without code changes.
