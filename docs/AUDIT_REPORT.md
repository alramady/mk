# Monthly Key — Comprehensive Audit Report

**Document Version:** 1.0
**Audit Date:** February 25, 2026
**Auditor:** Manus AI — Enterprise Audit Engine
**Codebase Snapshot:** `raneemndmo-collab/mk` (main branch)

---

## Executive Summary

This report presents the results of a comprehensive security, architecture, and quality audit of the **Monthly Key** platform — a monthly rental marketplace serving the Saudi Arabian market. The audit covered approximately **60,927 lines of TypeScript/TSX** across **433 source files**, including the main web application, four microservices (`hub-api`, `cobnb-adapter-api`, `monthlykey-adapter-api`, `worker`), three frontend apps (`monthlykey-web`, `cobnb-web`, `ops-web`), and two shared packages (`beds24-sdk`, `shared`).

The audit identified **1 Critical**, **10 High**, **12 Medium**, and **7 Low** severity findings across seven audit domains. The most urgent finding is an insecure default JWT secret that could allow complete account takeover. Several high-severity issues relate to missing database integrity constraints, weak password policies, and in-memory caching that will not scale.

| Severity | Count | Immediate Action Required |
|----------|-------|--------------------------|
| **Critical** | 1 | Yes — within 24 hours |
| **High** | 10 | Yes — within 1 week |
| **Medium** | 12 | Plan for next sprint |
| **Low** | 7 | Backlog / best practice |
| **Total** | **30** | |

---

## Table of Contents

1. [Architecture & Code Health](#1-architecture--code-health)
2. [Security Audit (Web + API)](#2-security-audit-web--api)
3. [Data Layer & Integrity](#3-data-layer--integrity)
4. [Performance & Scalability](#4-performance--scalability)
5. [Reliability & Observability](#5-reliability--observability)
6. [Frontend Quality (Mobile-first)](#6-frontend-quality-mobile-first)
7. [DevOps / CI/CD Readiness](#7-devops--cicd-readiness)
8. [Consolidated Findings Table](#8-consolidated-findings-table)

---

## 1. Architecture & Code Health

### 1.1 Monorepo Structure Review

The project follows a monorepo structure with the following layout:

```
mk-repo/
├── client/src/          # Main React SPA (40 pages, 18 components)
├── server/              # Express + tRPC backend (1,750-line db.ts, auth, middleware)
├── services/
│   ├── hub-api/         # Central booking/property hub (Express, PostgreSQL)
│   ├── cobnb-adapter-api/   # CoBnB channel adapter
│   ├── monthlykey-adapter-api/  # MonthlyKey channel adapter
│   └── worker/          # Background job processor
├── apps/
│   ├── monthlykey-web/  # Standalone MonthlyKey frontend
│   ├── cobnb-web/       # Standalone CoBnB frontend
│   └── ops-web/         # Operations dashboard
├── packages/
│   ├── beds24-sdk/      # Beds24 API integration SDK
│   └── shared/          # Shared types, validators, constants
├── drizzle/             # MySQL schema & migrations (main app)
└── Dockerfile, railway.toml, start.sh
```

The monorepo houses **two distinct database technologies**: the main application uses **MySQL** (via Drizzle ORM with `mysqlTable`), while `hub-api` uses **PostgreSQL** (via Drizzle ORM with `pgTable`). This dual-database approach adds operational complexity but is architecturally sound for separating concerns between the consumer-facing app and the internal hub.

### 1.2 Findings

#### ARC-01: Excessive Use of `any` Type — HIGH

- **Files:** 32 files across the codebase (163 instances)
- **Risk:** The `any` type disables TypeScript's type checking, effectively reverting those code paths to untyped JavaScript. This increases the risk of runtime errors, makes refactoring dangerous, and reduces developer confidence. Key offenders include `server/db.ts`, `server/routers.ts`, and several service files.
- **Recommendation:** Undertake a phased refactoring effort. Replace `any` with `unknown` where the type is genuinely unknown, and define explicit interfaces for all API responses, database query results, and function parameters. Prioritize `server/db.ts` (1,750 lines) as it is the most critical data access layer.

#### ARC-02: Automatic Data Seeding on Every Startup — MEDIUM

- **File:** `server/_core/index.ts`, lines 92–94
- **Risk:** The server runs `seedAdminUser()`, `seedCitiesAndDistricts()`, and `seedDefaultSettings()` on every startup. In production with multiple instances, this creates race conditions and unnecessary database load. If seeding logic has a bug, it could corrupt production data on every deploy.
- **Recommendation:** Extract seeding into standalone scripts (`pnpm db:seed`) that run once during deployment, not on every server start. Ensure all seed operations are idempotent with proper `ON DUPLICATE KEY UPDATE` guards.

#### ARC-03: Debug Collector Plugin in Production Build — MEDIUM

- **File:** `vite.config.ts`, line 153
- **Risk:** The `vitePluginManusDebugCollector` is included unconditionally in the Vite plugin array. In production builds, this collector may expose internal debugging information to end users and adds unnecessary bundle overhead.
- **Recommendation:** Conditionally include the plugin only when `process.env.NODE_ENV !== 'production'`.

#### ARC-04: Outdated Dependencies — HIGH

- **File:** `package.json` (76 dependencies, 27 devDependencies)
- **Risk:** Without regular dependency updates, the application is exposed to known vulnerabilities in third-party packages. The project uses `@paypal/checkout-server-sdk@^1.0.3` which is significantly outdated, and several Radix UI packages may have security patches in newer versions.
- **Recommendation:** Run `pnpm outdated` weekly. Integrate `npm audit` or Snyk into CI. Pin critical dependencies and test upgrades in staging before production.

---

## 2. Security Audit (Web + API)

### 2.1 Authentication & Authorization

The application uses **JWT-based authentication** with `jose` library for token signing and verification. Three user roles exist: `tenant`, `landlord`, and `admin`. The `hub-api` service has its own separate auth system using OTP-based phone verification.

### 2.2 Findings

#### SEC-01: Insecure Default JWT Secret — CRITICAL

- **File:** `.env.platform.example`, line 95
- **Risk:** The default JWT secret is a weak, publicly visible string in the example environment file. If this default is used in production (which is likely if the operator copies the example file without modification), an attacker can forge valid JWTs for any user, including admin accounts, achieving **complete account takeover**.
- **Recommendation:** Generate a cryptographically random secret of at least 64 characters using `openssl rand -base64 64`. Add a startup validation check that refuses to start if the JWT secret matches the default value. Document this requirement prominently.

#### SEC-02: Weak Password Policy — HIGH

- **File:** `server/_core/auth.ts`, line 133
- **Risk:** The password policy only enforces a minimum length of 6 characters with no complexity requirements. This makes accounts vulnerable to brute-force and dictionary attacks. OWASP recommends a minimum of 8 characters with complexity requirements.
- **Recommendation:** Enforce minimum 12 characters with at least one uppercase letter, one lowercase letter, one digit, and one special character. Consider integrating a password strength estimator like `zxcvbn`.

#### SEC-03: Excessively Long Session Expiration — HIGH

- **File:** `server/_core/auth.ts`, line 77
- **Risk:** Session tokens are valid for **one year** (365 days). This dramatically increases the window for session hijacking. If a token is compromised, the attacker has a full year of access.
- **Recommendation:** Reduce access token expiration to 15–30 minutes. Implement refresh tokens with a 7–30 day expiration. Add token rotation on each refresh.

#### SEC-04: Unsafe CSP Directives — HIGH

- **File:** `server/middleware/security-headers.ts`, line 44
- **Risk:** The Content Security Policy includes `'unsafe-inline'` and `'unsafe-eval'`, which effectively nullify XSS protections. An attacker who can inject content into the page can execute arbitrary JavaScript.
- **Recommendation:** Remove `'unsafe-inline'` by using nonce-based CSP or hashing inline scripts. Remove `'unsafe-eval'` by eliminating any use of `eval()` or `new Function()`. This is a significant refactoring effort but critical for XSS prevention.

#### SEC-05: In-Memory Rate Limiting — MEDIUM

- **File:** `server/rate-limiter.ts`, line 11
- **Risk:** Rate limiting is implemented using an in-memory store. In a multi-instance deployment, each instance maintains its own counter, allowing attackers to bypass limits by distributing requests across instances. An attacker could multiply their allowed attempts by the number of running instances.
- **Recommendation:** Switch to Redis-backed rate limiting using `rate-limiter-flexible` with a Redis store. The codebase already supports Redis via the cache layer — reuse that connection.

#### SEC-06: Insecure Upload Directory Permissions — HIGH (via Dockerfile)

- **File:** `Dockerfile`, line 27
- **Risk:** The uploads directory is created with `chmod 777`, granting read, write, and execute permissions to all users. This could allow an attacker who gains limited access to upload and execute malicious files.
- **Recommendation:** Create a dedicated application user in the Dockerfile. Set permissions to `755` with ownership by that user. Validate uploaded file types and sizes server-side.

#### SEC-07: Missing CSRF Protection — LOW

- **Risk:** The application does not implement anti-CSRF tokens. While JWT-based auth in headers provides some protection, cookie-based sessions (if any) remain vulnerable.
- **Recommendation:** Implement the double-submit cookie pattern or use the `SameSite=Strict` cookie attribute for all session cookies.

#### SEC-08: Username Enumeration — LOW

- **File:** `services/hub-api/src/routes/auth.ts`, line 126
- **Risk:** The registration endpoint reveals whether a user ID already exists, enabling attackers to enumerate valid usernames for targeted attacks.
- **Recommendation:** Return a generic "Registration failed" message regardless of the specific error cause.

#### SEC-09: Potential PII Leakage in Logs — MEDIUM

- **File:** `services/hub-api/src/routes/admin.ts`, line 68
- **Risk:** The admin proxy audit logs attempt to redact PII, but the implementation may not cover all sensitive fields. Logged PII creates compliance risks under Saudi data protection regulations.
- **Recommendation:** Implement a comprehensive PII redaction middleware that covers all known PII fields (name, email, phone, national ID, address). Test with sample data to verify completeness.

#### SEC-10: Lack of Password Confirmation on Registration — MEDIUM

- **File:** `services/hub-api/src/routes/auth.ts`, line 82
- **Risk:** Users can create accounts with mistyped passwords and then be unable to log in, leading to support overhead and poor user experience.
- **Recommendation:** Add a `password_confirm` field to registration and verify match server-side.

---

## 3. Data Layer & Integrity

### 3.1 Schema Overview

The main application defines **30 tables** in MySQL via `drizzle/schema.ts`:

| Table | Purpose |
|-------|---------|
| `users` | All user accounts (tenant, landlord, admin) |
| `properties` | Rental property listings |
| `propertyAvailability` | Calendar availability per property |
| `favorites` | User-saved properties |
| `bookings` | Rental bookings |
| `payments` | Payment records |
| `conversations` / `messages` | In-app messaging |
| `maintenanceRequests` | Maintenance tickets |
| `reviews` | Property reviews |
| `notifications` | Push/in-app notifications |
| `savedSearches` | User search preferences |
| `platformSettings` | Admin-configurable settings |
| `aiConversations` / `aiMessages` | AI assistant chat history |
| `knowledgeBase` | FAQ/knowledge articles |
| `userActivities` | Activity audit log |
| `adminPermissions` | Role-based permissions |
| `cities` / `districts` | Geographic data |
| `propertyManagers` / `propertyManagerAssignments` | Property management |
| `inspectionRequests` | Property inspections |
| `contactMessages` | Contact form submissions |
| `platformServices` / `serviceRequests` | Platform services |
| `emergencyMaintenance` / `maintenanceUpdates` | Emergency maintenance |
| `pushSubscriptions` | Web push notification subscriptions |

The `hub-api` service defines **14 tables** in PostgreSQL with a separate schema focused on multi-channel booking orchestration.

### 3.2 Findings

#### DAT-01: Missing Foreign Key Constraints — HIGH

- **File:** `drizzle/schema.ts`
- **Risk:** The MySQL schema does not define explicit foreign key relationships between tables. For example, `bookings.propertyId` and `bookings.tenantId` have no `references()` constraint. This means the database cannot enforce referential integrity — a property can be deleted while its bookings remain, creating orphaned records and potential application crashes.
- **Recommendation:** Add foreign key constraints to all relationship columns using Drizzle's `references()` function. Choose appropriate `onDelete` behavior (`cascade`, `restrict`, or `set null`) based on business logic. Apply via a migration.

#### DAT-02: Missing Database Transactions for Multi-Step Operations — HIGH

- **File:** `server/db.ts`, lines 1089–1118 (and similar functions)
- **Risk:** Functions like `updateBookingPayment` perform multiple database writes without wrapping them in a transaction. If the second write fails, the first is not rolled back, leaving the database in an inconsistent state. This is especially dangerous for financial operations.
- **Recommendation:** Wrap all multi-step database operations in `db.transaction()`. Prioritize payment and booking operations. Audit all functions in `server/db.ts` that perform more than one write.

#### DAT-03: Inconsistent Idempotency Implementation — MEDIUM

- **Files:** `server/db.ts`, `services/hub-api/src/db/schema.ts`
- **Risk:** The `hub-api` correctly implements idempotency keys for bookings, but the main application's `bookings` and `payments` tables lack this mechanism. Network retries or double-clicks could create duplicate records.
- **Recommendation:** Add an `idempotencyKey` column to all critical tables in the main schema. Check for existing keys before inserting, within a transaction.

#### DAT-04: Raw SQL Usage Risk — MEDIUM

- **File:** `server/db.ts`, lines 205–206
- **Risk:** The `getMapProperties` function uses raw `sql` template literals from `drizzle-orm`. While currently safe (no user input interpolation), this pattern is fragile — future modifications could introduce SQL injection.
- **Recommendation:** Replace raw SQL with Drizzle's built-in operators (`isNotNull`, `between`, etc.). Establish a coding standard that prohibits raw SQL without explicit security review.

#### DAT-05: Missing Application-Layer Validation — LOW

- **File:** `server/db.ts` (all data creation/update functions)
- **Risk:** Data access functions do not validate input before database operations. Invalid data (malformed emails, negative prices) could be persisted.
- **Recommendation:** Implement Zod validation schemas for all data input boundaries. The `packages/shared/src/validators.ts` file exists but is not comprehensively used.

---

## 4. Performance & Scalability

### 4.1 Findings

#### PERF-01: In-Memory Cache Not Suitable for Multi-Instance Production — HIGH

- **File:** `server/cache.ts`, lines 193–202
- **Risk:** The default cache is in-memory. In a multi-instance Railway deployment, each instance maintains a separate cache, leading to inconsistent data, reduced hit ratios, and increased database load. Users may see stale data depending on which instance serves their request.
- **Recommendation:** Deploy Redis and set the `REDIS_URL` environment variable. The codebase already includes `RedisCompatibleCache` — it just needs to be activated. This is a configuration change, not a code change.

#### PERF-02: In-Memory Prerender Cache — MEDIUM

- **File:** `server/middleware/prerender.ts`, lines 334–352
- **Risk:** The SEO prerendering middleware caches generated HTML in memory. Same multi-instance issues as PERF-01, plus redundant CPU work generating the same pages on each instance.
- **Recommendation:** Store prerendered HTML in Redis alongside the main application cache.

#### PERF-03: No Custom Code Splitting Strategy — LOW

- **File:** `vite.config.ts`, lines 167–179
- **Risk:** Vite's automatic code splitting is used without a custom chunking strategy. Vendor libraries may be duplicated across route chunks, increasing total bundle size.
- **Recommendation:** Add `build.rollupOptions.output.manualChunks` to create a dedicated `vendor` chunk for large dependencies like React, Radix UI, and Leaflet.

#### PERF-04: Image Optimization Strategy — LOW

- **File:** `server/image-optimizer.ts`
- **Risk:** The image optimizer exists but its usage across the application is inconsistent. Some property images may be served at full resolution, impacting mobile load times.
- **Recommendation:** Ensure all user-uploaded images pass through the optimizer pipeline. Implement responsive image serving with `srcset` attributes. Consider a CDN with on-the-fly image transformation (Cloudflare Images, Imgix).

---

## 5. Reliability & Observability

### 5.1 Findings

#### REL-01: Generic Health Check Path — LOW

- **File:** `railway.toml`, line 7
- **Risk:** The health check path is set to `/` instead of the dedicated `/health` endpoint. The root path serves the SPA HTML, which could return 200 even when the backend is down.
- **Recommendation:** Change `healthcheckPath` to `/health` in `railway.toml`.

#### REL-02: No Error Tracking Service — MEDIUM

- **Risk:** The application has no integration with an error tracking service (Sentry, Bugsnag, etc.). Production errors may go unnoticed until users report them.
- **Recommendation:** Integrate Sentry with both the frontend (React Error Boundary) and backend (Express error handler). Set up alerts for error rate spikes.

#### REL-03: Migration Failure Suppression — MEDIUM

- **File:** `start.sh`, line 3
- **Risk:** The startup script suppresses migration errors with `|| echo "Migration failed or already applied"`. The application starts even if the database schema is outdated or corrupted.
- **Recommendation:** Make migration failures fatal. The container should not start if migrations fail. Use `set -e` in the shell script and remove the error suppression.

---

## 6. Frontend Quality (Mobile-first)

### 6.1 Overview

The main client application has **40 pages** and **18 reusable components**. It uses React 19, Tailwind CSS 4, shadcn/ui, Wouter for routing, and supports Arabic/English with RTL/LTR switching.

### 6.2 Findings

#### FE-01: Missing Safe Area Support — HIGH

- **Risk:** On devices with notches or rounded corners (iPhone 14+, Samsung Galaxy S series), UI elements can be obscured. The CSS does not use `env(safe-area-inset-*)` variables.
- **Recommendation:** Add safe area padding to the root layout:
  ```css
  body {
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  ```

#### FE-02: Incomplete Accessibility (WCAG 2.2 AA) — MEDIUM

- **Files:** `client/src/index.css`, `client/src/pages/Home.tsx`, `client/src/pages/PropertyDetail.tsx`, `client/src/pages/Search.tsx`
- **Risk:** Contrast ratios may not meet 4.5:1 minimum in all cases. Keyboard navigation has not been systematically tested. Missing `aria-label` attributes on interactive elements.
- **Recommendation:** Run Lighthouse accessibility audit on all pages. Fix contrast issues. Add `aria-label` to all icon-only buttons. Test full keyboard navigation flow.

#### FE-03: Incomplete RTL Layout Adjustments — MEDIUM

- **File:** `client/src/pages/PropertyDetail.tsx`, line 201
- **Risk:** While the app has good i18n support, some components use hardcoded directional margins (`margin-left`, `padding-right`) instead of logical properties (`margin-inline-start`, `padding-inline-end`).
- **Recommendation:** Audit all CSS for directional properties and replace with logical equivalents. Use `eslint-plugin-logical-properties` to prevent regressions.

#### FE-04: Inconsistent Focus State Styling — LOW

- **File:** `client/src/index.css`, lines 132–134
- **Risk:** The default focus style may not be visually distinct enough on all backgrounds, making keyboard navigation difficult for sighted users.
- **Recommendation:** Define a prominent `focus-visible` ring style using `ring-2 ring-ring ring-offset-2` and apply consistently across all interactive elements.

---

## 7. DevOps / CI/CD Readiness

### 7.1 Current State

The project uses a single `Dockerfile` for the main application. Railway handles deployment with automatic restarts on failure. There are **32 test files** covering various modules, but no CI/CD pipeline configuration was found (no `.github/workflows/`, no `Jenkinsfile`, no `gitlab-ci.yml`).

### 7.2 Findings

#### OPS-01: No CI/CD Pipeline — HIGH

- **Risk:** Without automated CI/CD, every deployment is manual and untested. Code can be pushed to production without passing linting, type checking, or tests.
- **Recommendation:** Create a GitHub Actions workflow that runs on every PR:
  1. `pnpm install`
  2. `pnpm check` (TypeScript)
  3. `pnpm test` (Vitest)
  4. `pnpm build` (build verification)
  5. `npm audit` (security scan)

#### OPS-02: No Environment Separation — MEDIUM

- **Risk:** There is no clear separation between development, staging, and production environments. The same Railway project appears to serve all purposes.
- **Recommendation:** Create three Railway environments: `dev`, `staging`, `production`. Use branch-based deployments (e.g., `develop` → staging, `main` → production).

#### OPS-03: No Automated Security Scanning — MEDIUM

- **File:** `package.json`
- **Risk:** No `npm audit`, Snyk, or SAST tools are configured. Vulnerable dependencies may go undetected.
- **Recommendation:** Add `"audit": "npm audit --audit-level=high"` to package.json scripts. Integrate into CI pipeline.

#### OPS-04: No Rollback Strategy — LOW

- **File:** `railway.toml`
- **Risk:** While Railway supports automatic rollback, there is no explicit versioning or rollback strategy documented.
- **Recommendation:** Tag Docker images with git commit hashes. Document the rollback procedure. Test rollback in staging before production.

---

## 8. Consolidated Findings Table

| ID | Finding | Severity | File(s) | Category |
|----|---------|----------|---------|----------|
| SEC-01 | Insecure Default JWT Secret | **Critical** | `.env.platform.example:95` | Security |
| ARC-01 | Excessive `any` Type Usage (163 instances) | **High** | 32 files | Architecture |
| ARC-04 | Outdated Dependencies | **High** | `package.json` | Architecture |
| SEC-02 | Weak Password Policy (min 6 chars) | **High** | `server/_core/auth.ts:133` | Security |
| SEC-03 | 1-Year Session Expiration | **High** | `server/_core/auth.ts:77` | Security |
| SEC-04 | Unsafe CSP (`unsafe-inline`, `unsafe-eval`) | **High** | `server/middleware/security-headers.ts:44` | Security |
| SEC-06 | Upload Directory `chmod 777` | **High** | `Dockerfile:27` | Security |
| DAT-01 | Missing Foreign Key Constraints | **High** | `drizzle/schema.ts` | Data Layer |
| DAT-02 | Missing DB Transactions | **High** | `server/db.ts:1089-1118` | Data Layer |
| PERF-01 | In-Memory Cache (not scalable) | **High** | `server/cache.ts:193-202` | Performance |
| FE-01 | Missing Safe Area Support | **High** | `client/src/index.css` | Frontend |
| OPS-01 | No CI/CD Pipeline | **High** | N/A | DevOps |
| ARC-02 | Auto-Seeding on Startup | **Medium** | `server/_core/index.ts:92-94` | Architecture |
| ARC-03 | Debug Plugin in Production | **Medium** | `vite.config.ts:153` | Architecture |
| SEC-05 | In-Memory Rate Limiting | **Medium** | `server/rate-limiter.ts:11` | Security |
| SEC-09 | PII Leakage in Logs | **Medium** | `services/hub-api/src/routes/admin.ts:68` | Security |
| SEC-10 | No Password Confirmation | **Medium** | `services/hub-api/src/routes/auth.ts:82` | Security |
| DAT-03 | Inconsistent Idempotency | **Medium** | `server/db.ts`, `hub-api/schema.ts` | Data Layer |
| DAT-04 | Raw SQL Usage Risk | **Medium** | `server/db.ts:205-206` | Data Layer |
| PERF-02 | In-Memory Prerender Cache | **Medium** | `server/middleware/prerender.ts:334-352` | Performance |
| REL-02 | No Error Tracking (Sentry) | **Medium** | N/A | Reliability |
| REL-03 | Migration Failure Suppression | **Medium** | `start.sh:3` | Reliability |
| FE-02 | Incomplete WCAG 2.2 AA | **Medium** | Multiple pages | Frontend |
| FE-03 | Incomplete RTL Adjustments | **Medium** | `PropertyDetail.tsx:201` | Frontend |
| OPS-02 | No Environment Separation | **Medium** | N/A | DevOps |
| OPS-03 | No Security Scanning | **Medium** | `package.json` | DevOps |
| SEC-07 | Missing CSRF Protection | **Low** | N/A | Security |
| SEC-08 | Username Enumeration | **Low** | `hub-api/routes/auth.ts:126` | Security |
| DAT-05 | Missing App-Layer Validation | **Low** | `server/db.ts` | Data Layer |
| PERF-03 | No Custom Code Splitting | **Low** | `vite.config.ts:167-179` | Performance |
| PERF-04 | Inconsistent Image Optimization | **Low** | `server/image-optimizer.ts` | Performance |
| REL-01 | Generic Health Check Path | **Low** | `railway.toml:7` | Reliability |
| FE-04 | Inconsistent Focus States | **Low** | `client/src/index.css:132-134` | Frontend |
| OPS-04 | No Rollback Strategy | **Low** | `railway.toml` | DevOps |

---

## Appendix A: Codebase Statistics

| Metric | Value |
|--------|-------|
| Total TypeScript/TSX Lines | 60,927 |
| Total Source Files | 433 |
| Client Pages | 40 |
| Client Reusable Components | 18 |
| Server Routes/Routers | 12+ |
| Database Tables (Main — MySQL) | 30 |
| Database Tables (Hub API — PostgreSQL) | 14 |
| Microservices | 4 |
| Frontend Apps | 3 |
| Shared Packages | 2 |
| Test Files | 32 |
| Production Dependencies | 76 |
| Dev Dependencies | 27 |
| Drizzle Migrations | 13 |

---

*End of Audit Report*
