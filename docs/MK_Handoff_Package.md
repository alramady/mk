# Monthly Key — Project Handoff Package

**Version**: 1.0  
**Date**: March 4, 2026  
**Author**: Manus AI  
**Repository**: `github.com/raneemndmo-collab/mk`  
**Production URL**: `https://monthlykey.com`

---

## Table of Contents

- [Executive Summary](#executive-summary)
- **Part A — Website Handoff**
  - [1. Architecture Overview](#1-architecture-overview)
  - [2. Module Specifications](#2-module-specifications)
  - [3. Payment & Finance System](#3-payment--finance-system)
  - [4. Renewal & Lease Management](#4-renewal--lease-management)
  - [5. Storage, Maps & Media Pipeline](#5-storage-maps--media-pipeline)
  - [6. Beds24 Integration](#6-beds24-integration)
  - [7. QA & Regression Test Plan](#7-qa--regression-test-plan)
  - [8. Operations Handbook](#8-operations-handbook)
- **Part B — Mobile App PRD**
  - [9. Mobile App Scope & Personas](#9-mobile-app-scope--personas)
  - [10. Technology Recommendation](#10-technology-recommendation)
  - [11. API Contract & Backend Readiness](#11-api-contract--backend-readiness)
  - [12. Mobile Payments & Uploads](#12-mobile-payments--uploads)
  - [13. Analytics & Push Notifications](#13-analytics--push-notifications)
  - [14. Mobile QA & Rollout Plan](#14-mobile-qa--rollout-plan)
- [Appendix A — Environment Variables Reference](#appendix-a--environment-variables-reference)
- [Appendix B — Database Schema (All Tables)](#appendix-b--database-schema-all-tables)
- [Appendix C — Prioritized Backlog](#appendix-c--prioritized-backlog)

---

## Executive Summary

Monthly Key (المفتاح الشهري) is a production-grade, bilingual (Arabic/English) monthly rental marketplace serving the Saudi Arabian market. The platform connects tenants seeking furnished apartments with property owners and managers, handling the full lifecycle from property discovery through booking, payment, lease generation, renewal, and maintenance.

The system is deployed on **Railway** using a Docker-based production pipeline. The frontend is a React 19 single-page application with Tailwind CSS 4 and shadcn/ui, while the backend runs on Express with tRPC for type-safe API communication. Data is stored in a MySQL database (PlanetScale-compatible), files in Cloudflare R2 (S3-compatible), and caching uses an in-memory store with optional Redis upgrade path.

The platform currently supports **8 Saudi cities** (Riyadh, Jeddah, Dammam, Makkah, Madinah, Khobar, Abha, Tabuk), processes payments through **Moyasar** (mada, Apple Pay, Google Pay) and **PayPal**, and integrates with **Beds24** for channel management and occupancy synchronization. The admin panel provides comprehensive property management, user management, financial dashboards, CMS, audit logging, and integration configuration — all accessible through a role-based permission system with break-glass emergency access.

This handoff package documents every module in production-level detail, provides a complete mobile app PRD for the next development phase, and includes a prioritized backlog of remaining work items.

---

# Part A — Website Handoff

---

## 1. Architecture Overview

![Monthly Key Architecture Diagram](docs/architecture_diagram.png)

### 1.1 Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend | React | 19 | UI framework |
| Styling | Tailwind CSS | 4 | Utility-first CSS |
| UI Components | shadcn/ui | Latest | Accessible component library |
| Client Routing | Wouter | Latest | Lightweight SPA routing |
| State/Data | TanStack Query + tRPC | v5 / v11 | Type-safe data fetching |
| Backend | Express.js | 4.x | HTTP server |
| API Layer | tRPC | 11 | End-to-end type-safe API |
| Database | MySQL | 8.x | Primary data store (PlanetScale) |
| ORM | Drizzle ORM | Latest | Type-safe SQL queries |
| File Storage | Cloudflare R2 | S3-compatible | Images, documents, uploads |
| Image Processing | Sharp | Latest | Server-side image optimization |
| Payments | Moyasar + PayPal | v1 / v2 | Payment processing |
| Channel Manager | Beds24 | API v2 + iCal | Occupancy sync |
| Email | Nodemailer | Latest | SMTP-based transactional email |
| SMS | Unifonic / Twilio | Latest | OTP delivery |
| Push Notifications | web-push (VAPID) | Latest | Browser push notifications |
| AI Assistant | OpenAI GPT-4o-mini | Latest | In-app conversational AI |
| Deployment | Railway + Docker | Node 22-slim | Container-based deployment |
| CDN/Cache | In-memory + optional Redis | — | Request caching |

### 1.2 Repository Structure

```
mk/
├── client/                     # Frontend SPA
│   ├── index.html              # Entry HTML with GA4, JSON-LD, PWA manifest
│   ├── public/                 # Static assets (robots.txt, icons, manifest)
│   └── src/
│       ├── App.tsx             # Route definitions (30+ routes)
│       ├── index.css           # Tailwind theme, RTL utilities, design tokens
│       ├── pages/              # Page-level components (25+ pages)
│       ├── components/         # Reusable UI (PropertyCard, Navbar, Map, SEOHead, etc.)
│       ├── contexts/           # React contexts (Auth, I18n, SiteSettings, Theme)
│       ├── hooks/              # Custom hooks (useAuth, useMediaQuery, etc.)
│       └── lib/                # Utilities (i18n translations, trpc client, utils)
├── server/                     # Backend
│   ├── _core/                  # Core infrastructure (env, trpc, llm, vite)
│   ├── middleware/             # Express middleware (security, compression, prerender, sitemap)
│   ├── routers.ts              # Main tRPC appRouter (4000+ lines, all procedures)
│   ├── finance-routers.ts      # Finance/building/unit/ledger tRPC procedures
│   ├── finance-registry.ts     # Finance business logic (buildings, units, ledger, KPIs)
│   ├── moyasar.ts              # Moyasar payment gateway integration
│   ├── paypal.ts               # PayPal payment gateway integration
│   ├── booking-calculator.ts   # Rent + insurance + service fee + VAT calculation
│   ├── renewal.ts              # Booking renewal/extension logic
│   ├── lease-contract.ts       # PDF lease contract generation
│   ├── beds24-sync.ts          # Beds24 ↔ MK bidirectional sync engine
│   ├── beds24-guard.ts         # Beds24 source-of-truth enforcement
│   ├── occupancy.ts            # Unit occupancy calculation (API/iCal/Local)
│   ├── availability-blocks.ts  # Date-range occupancy blocks
│   ├── storage.ts              # S3/local file storage abstraction
│   ├── image-optimizer.ts      # Sharp-based image optimization (thumbnail/medium/original)
│   ├── maps-service.ts         # Google Maps geocoding with cache
│   ├── email.ts                # SMTP email service (templates for all events)
│   ├── whatsapp-cloud.ts       # WhatsApp Cloud API (Meta) integration
│   ├── push.ts                 # VAPID web push notifications
│   ├── otp-providers.ts        # SMS/Email OTP (Unifonic, Twilio, SMTP, Dev)
│   ├── ai-assistant.ts         # OpenAI-powered conversational AI
│   ├── cache.ts                # In-memory/Redis cache with TTL and coalescing
│   ├── rate-limiter.ts         # Per-endpoint rate limiting with account lockout
│   ├── audit-log.ts            # Immutable audit trail for admin actions
│   ├── feature-flags.ts        # Runtime feature flag system
│   ├── breakglass.ts           # Emergency admin bypass
│   ├── permissions.ts          # RBAC permission matrix
│   ├── kyc-adapter.ts          # KYC provider abstraction
│   └── db.ts                   # Database connection pool + query helpers
├── drizzle/
│   └── schema.ts               # 40+ MySQL table definitions
├── packages/
│   └── beds24-sdk/             # Standalone Beds24 API v2 SDK (DO NOT MODIFY)
├── Dockerfile                  # Multi-stage Docker build
├── start.sh                    # Production boot sequence (fix-columns → migrate → start)
└── fix-columns.mjs             # Pre-migration column safety net
```

### 1.3 Deployment Pipeline

The production deployment follows a multi-stage Docker build on Railway:

1. **Base stage**: Node 22-slim with Arabic/Noto fonts (for Sharp SVG text rendering in OG images) and pnpm.
2. **Deps stage**: `pnpm install --frozen-lockfile` from `package.json` + `pnpm-lock.yaml`.
3. **Build stage**: Copies source, runs `pnpm build` which executes Vite (frontend) + esbuild (server) in parallel.
4. **Production stage**: Copies only `dist/`, `drizzle/`, `node_modules/`, `start.sh`, and `fix-columns.mjs`. Creates `/app/uploads` directory.
5. **Boot sequence** (`start.sh`):
   - Validates database URL source (PROD_DATABASE_URL > STAGING_DATABASE_URL > DATABASE_URL)
   - Runs `fix-columns.mjs` to safely add any missing columns (idempotent ALTER TABLE)
   - Runs `drizzle-kit migrate` for schema migrations
   - Starts `node dist/index.js`

Railway auto-deploys on every push to `main`. Preview deploys use `STAGING_DATABASE_URL` if set, with safety warnings if not.

### 1.4 Authentication & Authorization

The platform uses a session-based authentication system with JWT cookies:

**Authentication Flow:**
1. User registers with email + password (bcrypt-hashed)
2. Login creates a JWT session cookie (`mk_session`, httpOnly, secure, sameSite=lax)
3. Session TTL: 30 minutes (production) / 24 hours (development)
4. Optional OTP verification via SMS (Unifonic/Twilio) or Email (SMTP)

**Role-Based Access Control (RBAC):**

| Role | Access Level | Key Permissions |
|------|-------------|-----------------|
| `user` | Base authenticated | Browse, search, favorite, message |
| `tenant` | User + active booking | Dashboard, payments, maintenance, reviews |
| `landlord` | User + property owner | Property management, booking approval, analytics |
| `admin` | Full platform access | All CRUD, settings, integrations, audit |

**Permission Matrix** (26 granular permissions):

| Permission | Description |
|-----------|-------------|
| `VIEW_DASHBOARD` | Access admin dashboard |
| `MANAGE_PROPERTIES` | Create/edit/delete properties |
| `MANAGE_BOOKINGS` | Approve/reject/cancel bookings |
| `MANAGE_USERS` | Edit user profiles, assign roles |
| `MANAGE_PAYMENTS` | View/process payments, refunds |
| `MANAGE_SETTINGS` | Edit platform settings, integrations |
| `VIEW_ANALYTICS` | Access financial KPIs, reports |
| `MANAGE_CONTENT` | CMS pages, knowledge base |
| `MANAGE_ROLES` | Create/edit roles and permissions |
| `MANAGE_AI` | Configure AI assistant |
| `MANAGE_INTEGRATIONS` | Configure third-party integrations |
| `MANAGE_FEATURE_FLAGS` | Toggle feature flags |
| `MANAGE_KYC` | Review KYC submissions |

**Break-Glass Access**: Hardcoded admin emails/IDs in `BREAKGLASS_ADMIN_EMAILS` env var bypass all permission checks. This ensures platform recovery even if the roles table is corrupted.

### 1.5 Internationalization (i18n)

The platform is fully bilingual (Arabic/English) with the following architecture:

- **Client-side**: `I18nProvider` context in `client/src/lib/i18n.tsx` with ~400 translation keys per language.
- **RTL support**: `document.documentElement.dir = "rtl"` and `lang="ar"` set dynamically. CSS utilities in `index.css` handle flex-direction reversal, timeline arrows, invoice code isolation, and tab ordering.
- **Server-side**: Prerender middleware detects bot user-agents and injects Arabic/English meta tags based on URL patterns.
- **Database**: All content fields have dual columns (e.g., `title` + `titleAr`, `description` + `descriptionAr`).
- **Sitemap**: hreflang annotations for `ar`, `en`, and `x-default` on all public URLs.

---

## 2. Module Specifications

### 2.1 Public Site Modules

**Property Search & Discovery**

The search system supports full-text filtering by city, district, property type, price range, bedrooms, bathrooms, size, and amenities. Results are paginated (20 per page) with server-side caching (10-second TTL). The search page uses `useEffect` with debounced URL parameters to avoid excessive API calls.

| Feature | Implementation |
|---------|---------------|
| City/District filter | Dropdown from `cities` + `districts` tables |
| Property type | Enum: apartment, studio, villa, duplex, compound, room, chalet, resort, hotel_apartment, furnished_apartment, commercial, other |
| Price range | Min/max slider, stored as `monthlyRent` decimal(10,2) |
| Amenities | JSON array in `amenities` column, filtered client-side |
| Sort | Price (asc/desc), newest, featured first |
| Map view | Google Maps integration with property markers |
| Pagination | Offset-based, 20 items per page |

**Property Detail Page**

Each property page displays: image gallery (with optimized variants), title/description (bilingual), specs (beds/baths/size), amenities grid, location map (with privacy levels: EXACT/APPROXIMATE/HIDDEN), pricing breakdown, availability calendar, landlord info, reviews, and a booking CTA. SEO metadata is dynamically generated with JSON-LD `RealEstateListing` schema.

**AI Assistant**

An OpenAI-powered conversational AI (GPT-4o-mini) is embedded in the platform. It has access to:
- Platform statistics (property count, booking count)
- CMS knowledge base articles
- Admin-uploaded reference documents (extracted text)
- Configurable personality (professional, friendly, formal, casual)
- Bilingual responses (Arabic primary, English secondary)
- Rate-limited to 15 requests/minute

### 2.2 Tenant Dashboard

The tenant dashboard (`/tenant`) provides a tabbed interface with 9 sections:

| Tab | Features |
|-----|----------|
| **حجوزاتي (Bookings)** | Active/past bookings, timeline stepper (requested → approved → paid → active), invoice display, payment CTA, renewal eligibility |
| **مدفوعاتي (Payments)** | Payment history, ledger entries (RENT, INSURANCE, SERVICE_FEE, VAT, RENEWAL_RENT), status badges (DUE, PAID, OVERDUE, REFUNDED) |
| **المفضلة (Favorites)** | Saved properties with quick-view cards |
| **طلبات الصيانة (Maintenance)** | Submit/track maintenance requests with photo uploads, priority levels, status tracking |
| **الإشعارات (Notifications)** | In-app notifications with read/unread state, push notification subscription |
| **الملف الشخصي (Profile)** | Personal info, ID documents (front/back upload), bio, emergency contact |
| **طلبات المعاينة (Inspections)** | Request property inspections, track status |
| **الخدمات (Services)** | Platform services catalog, service request submission |
| **طوارئ الصيانة (Emergency)** | Emergency maintenance form with urgency levels (low/medium/high/critical), category selection, photo upload, admin email notification |

### 2.3 Landlord Dashboard

The landlord dashboard (`/landlord`) provides:

| Feature | Description |
|---------|-------------|
| Property management | View/edit listed properties, photos, pricing |
| Booking management | Approve/reject booking requests, view tenant info |
| Financial overview | Revenue summary, payment status per booking |
| Messages | Direct messaging with tenants |
| Analytics | Occupancy rates, revenue trends |

### 2.4 Admin Panel

The admin panel (`/admin`) is a comprehensive management interface with 20+ sub-pages:

| Section | Key Capabilities |
|---------|-----------------|
| **Dashboard** | KPI cards (properties, bookings, revenue, users), recent activity |
| **Properties** | Full CRUD, photo management, Beds24 mapping, geocoding, status management |
| **Bookings** | Approve/reject/cancel, payment tracking, lease generation, extension management |
| **Users** | Role assignment, profile editing, activity log, KYC review |
| **Finance** | Buildings, units, payment ledger, KPIs (occupancy rate, revenue, average rent), payment method settings |
| **Messages** | View all conversations, admin can join threads |
| **Maintenance** | Review/assign/close maintenance requests |
| **Settings** | Platform name, logo, contact info, social links, legal pages, SEO settings |
| **CMS** | Page content management, media library, content versioning |
| **Integrations** | Configure Beds24, Moyasar, PayPal, WhatsApp, SMTP, SMS, GA4, KYC providers |
| **Feature Flags** | Toggle: email_verification, phone_verification, verification_gate_booking, kyc_required, maintenance_mode, online_payment, beds24_sync |
| **Roles** | Create custom roles, assign granular permissions |
| **Audit Log** | Immutable log of all admin actions (CREATE, UPDATE, DELETE, LOGIN, SETTINGS_CHANGE) |
| **AI Configuration** | AI name, personality, welcome message, custom instructions, document uploads, knowledge base |
| **Submissions** | Review property submissions from landlords, approve/reject with notes |
| **Database Status** | Connection health, table counts, migration status |

---

## 3. Payment & Finance System

### 3.1 Payment Gateways

**Moyasar (Primary — Saudi Market)**

Moyasar is the primary payment gateway, supporting mada debit cards, Apple Pay, and Google Pay. Configuration is stored in the `integrationConfigs` table (encrypted credentials) and managed through the admin panel.

| Setting | Description |
|---------|-------------|
| `publishableKey` | Client-side key for Moyasar.js form |
| `secretKey` | Server-side key for API calls and webhook verification |
| `callbackUrl` | Redirect URL after payment (e.g., `https://monthlykey.com/payment-callback`) |
| `webhookSecret` | HMAC secret for webhook signature verification |
| `isEnabled` | Feature flag for online payments |

**Payment Flow (Moyasar):**

```
1. Tenant clicks "Pay" on booking
2. Client creates Moyasar payment form (mada/Apple Pay/Google Pay)
3. Moyasar processes payment, redirects to callbackUrl with payment_id
4. Client calls tRPC `booking.verifyPayment({ paymentId })`
5. Server fetches payment status from Moyasar API
6. If status=paid → updates payment_ledger entry to PAID
7. Moyasar sends webhook (POST /api/webhooks/moyasar)
8. Server verifies HMAC signature, updates ledger (idempotent)
9. If PAID → booking status changes to 'active', availability block created
10. If renewal payment → booking extension activated
```

**PayPal (International)**

PayPal integration supports the PayPal JavaScript SDK for international tenants. The flow is similar but uses PayPal's order capture API.

**Cash Payment**

When online payment is disabled (feature flag `online_payment = OFF`), the platform displays a message directing tenants to contact admin for bank transfer or cash payment arrangements.

### 3.2 Booking Calculator

The booking calculator (`server/booking-calculator.ts`) is a pure function that computes the total cost breakdown:

```
Input:
  - monthlyRent: number
  - durationMonths: number

Settings (from admin panel):
  - insuranceMode: "percentage" | "fixed"
  - insuranceRate: number (e.g., 10%)
  - insuranceFixedAmount: number
  - serviceFeeRate: number (e.g., 5%)
  - vatRate: number (e.g., 15%)
  - hideInsuranceFromTenant: boolean
  - currency: string (default "SAR")

Output:
  - baseRentTotal = monthlyRent × durationMonths
  - insuranceAmount = (percentage mode) monthlyRent × rate/100, or (fixed mode) fixedAmount
  - serviceFee = baseRentTotal × serviceFeeRate/100
  - subtotal = baseRentTotal + insuranceAmount + serviceFee
  - vatAmount = subtotal × vatRate/100
  - grandTotal = subtotal + vatAmount
  - amountHalalah = grandTotal × 100 (integer, for Moyasar)
```

If `hideInsuranceFromTenant` is true, the insurance amount is excluded from the tenant-facing breakdown but still included in the grand total.

### 3.3 Payment Ledger

The `payment_ledger` table is the single source of truth for all financial transactions:

| Column | Type | Description |
|--------|------|-------------|
| `id` | int | Primary key |
| `bookingId` | int | Associated booking |
| `invoiceNumber` | varchar | Format: `INV-YYYY-XXXXX` (auto-generated) |
| `entryType` | enum | RENT, INSURANCE, SERVICE_FEE, VAT, RENEWAL_RENT, REFUND, ADJUSTMENT |
| `status` | enum | DUE, PAID, OVERDUE, REFUNDED, CANCELLED, WRITE_OFF |
| `amount` | decimal(12,2) | Transaction amount in SAR |
| `currency` | varchar | Default "SAR" |
| `dueDate` | date | Payment due date |
| `paidAt` | datetime | When payment was confirmed |
| `paymentMethod` | varchar | MADA_CARD, APPLE_PAY, GOOGLE_PAY, PAYPAL, CASH, BANK_TRANSFER |
| `provider` | varchar | moyasar, paypal, manual |
| `providerRef` | varchar | External payment reference ID |
| `webhookVerified` | boolean | Whether webhook confirmed the payment |
| `calcSnapshot` | json | Frozen calculation at time of invoice creation |

### 3.4 Financial KPIs (Admin Dashboard)

The finance module exposes the following KPIs:

| KPI | Calculation |
|-----|-------------|
| Total Revenue | SUM of PAID ledger entries |
| Outstanding | SUM of DUE + OVERDUE ledger entries |
| Occupancy Rate | Active bookings / Total available units |
| Average Monthly Rent | AVG of monthlyRent for active bookings |
| Collection Rate | PAID entries / (PAID + OVERDUE) entries |
| Revenue by Month | Grouped SUM by paidAt month |

---

## 4. Renewal & Lease Management

### 4.1 Renewal System

The renewal module (`server/renewal.ts`) handles booking extensions with Beds24 safety:

**Eligibility Rules:**
- Booking must be `active` status
- `renewalsUsed < maxRenewals` (default max: 1)
- Current date must be within `renewalWindowDays` (default: 14) of the booking end date
- Beds24-controlled units require admin approval (no automatic extension)

**Renewal Flow:**

```
1. Tenant checks eligibility → tRPC finance.renewals.checkEligibility({ bookingId })
2. If eligible → tRPC finance.renewals.requestRenewal({ bookingId })
3. System creates:
   a. New payment_ledger entry (type=RENEWAL_RENT, status=DUE)
   b. New booking_extensions record (status=PAYMENT_PENDING)
4. If unit is LOCAL-controlled:
   a. Tenant pays via Moyasar/PayPal
   b. Webhook confirms payment → extension activated
   c. Booking moveOutDate extended by 1 month
5. If unit is Beds24-controlled:
   a. Extension created with status=PENDING_ADMIN
   b. Admin reviews and manually approves in Beds24
   c. Admin confirms in MK → extension activated
```

**Booking Extensions Table:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | int | Primary key |
| `bookingId` | int | Parent booking |
| `extensionMonths` | int | Duration (default 1) |
| `newEndDate` | date | Extended end date |
| `status` | enum | PAYMENT_PENDING, PENDING_ADMIN, ACTIVE, CANCELLED, EXPIRED |
| `ledgerEntryId` | int | Associated payment ledger entry |
| `beds24Controlled` | boolean | Whether Beds24 approval is needed |

### 4.2 Lease Contract Generation

The lease contract module (`server/lease-contract.ts`) generates bilingual PDF lease agreements:

**Contract Data Fields:**
- Contract number (auto-generated)
- Gregorian and Hijri dates
- Landlord details (name AR/EN, ID, phone, email)
- Tenant details (name AR/EN, ID, phone, email)
- Property details (title AR/EN, type, address AR/EN, city AR/EN, specs)
- Lease terms (start/end date, duration, monthly rent, security deposit)
- Payment schedule
- Terms and conditions (bilingual)

The contract is generated as a PDF using the `storagePut` function and stored in R2/local storage.

---

## 5. Storage, Maps & Media Pipeline

### 5.1 Storage Abstraction

The storage module (`server/storage.ts`) provides a unified interface for file operations with two backends:

**S3-Compatible (Production — Cloudflare R2):**

| Env Variable | Description |
|-------------|-------------|
| `S3_ENDPOINT` | R2 endpoint URL |
| `S3_BUCKET` | Bucket name |
| `S3_ACCESS_KEY_ID` | Access key |
| `S3_SECRET_ACCESS_KEY` | Secret key |
| `S3_REGION` | Region (default "auto") |
| `S3_PUBLIC_BASE_URL` | CDN URL for public access |

Operations: `storagePut(key, buffer, contentType)`, `storageDelete(key)`, `storageGet(key)`, `storageHead(key)`.

**Local Filesystem (Fallback):**
- Upload directory: `/app/uploads` (Railway volume mount)
- Files served via Express static middleware
- Admin warning displayed when using local storage

### 5.2 Image Optimization Pipeline

On upload, every image is processed through Sharp to generate three variants:

| Variant | Dimensions | Quality | Use Case |
|---------|-----------|---------|----------|
| `thumbnail` | 400×300 | 75% | List cards, search results |
| `medium` | 800×600 | 80% | Property detail gallery |
| `original` | 1600×1200 | 85% | Full-screen lightbox |

All variants are converted to WebP format and stored with unique nanoid-based keys. The upload router enforces a 50MB file size limit (`MAX_UPLOAD_SIZE`).

### 5.3 Google Maps Integration

The maps service (`server/maps-service.ts`) provides geocoding with a database cache:

**Geocoding Flow:**
1. Check `geocode_cache` table for existing result
2. If cache hit and not expired → return cached coordinates
3. If cache miss → call Google Maps Geocoding API
4. Store result in cache with TTL
5. Return coordinates + place ID

**Location Privacy Levels:**

| Level | Behavior |
|-------|----------|
| `EXACT` | Show precise pin on map |
| `APPROXIMATE` | Show circle area (±500m) |
| `HIDDEN` | Show city-level only, no pin |

The frontend map component (`client/src/components/Map.tsx`) uses a proxy-authenticated Google Maps JavaScript API — no API key is exposed to the client.

---

## 6. Beds24 Integration

### 6.1 Architecture

The Beds24 integration consists of four modules working together:

1. **beds24-sdk** (`packages/beds24-sdk/`) — Standalone TypeScript SDK for Beds24 API v2. Provides typed wrappers for Properties, Inventory, Bookings, Guests, and an Admin Proxy. **This package must NOT be modified.**

2. **beds24-sync** (`server/beds24-sync.ts`) — Bidirectional sync engine:
   - **Inbound**: Beds24 → MK (import reservations as bookings + availability blocks)
   - **Outbound**: MK → Beds24 (push blocks when MK booking becomes active/cancelled)
   - **Reconciliation**: Compare Beds24 vs MK and surface mismatches

3. **beds24-guard** (`server/beds24-guard.ts`) — Source-of-truth enforcement. Prevents local modifications to Beds24-controlled units.

4. **occupancy** (`server/occupancy.ts`) — Occupancy calculation with strict source-of-truth rules.

### 6.2 Connection Types

| Type | Data Source | Sync Method |
|------|-----------|-------------|
| `API` | Beds24 API v2 | Token-based auth, full CRUD, real-time sync |
| `ICAL` | iCal feed URL | Read-only import, parsed with built-in iCal parser |

### 6.3 Source-of-Truth Rules

```
IF unit has beds24_map with sourceOfTruth='BEDS24':
  IF connectionType='API':
    → Occupancy from Beds24 API data ONLY
    → Local booking modifications BLOCKED by beds24-guard
  IF connectionType='ICAL':
    → Occupancy from parsed iCal feed
    → Local booking modifications BLOCKED
  IF neither data source available:
    → Status is UNKNOWN (never LOCAL fallback)

IF no beds24_map OR sourceOfTruth='LOCAL':
  → Occupancy computed from local bookings
  → Full local CRUD allowed
```

### 6.4 Beds24 Map Table

The `beds24_map` table links MK properties/units to Beds24 entities:

| Column | Type | Description |
|--------|------|-------------|
| `propertyId` | int | MK property ID |
| `unitId` | int | MK unit ID (nullable) |
| `beds24PropertyId` | int | Beds24 property ID |
| `beds24RoomId` | int | Beds24 room ID |
| `connectionType` | enum | API, ICAL |
| `sourceOfTruth` | enum | BEDS24, LOCAL |
| `icalImportUrl` | text | iCal feed URL (for ICAL type) |
| `lastSyncAt` | datetime | Last successful sync timestamp |
| `lastSyncStatus` | varchar | SUCCESS, FAILED, PARTIAL |

### 6.5 Sync Results

Each sync operation returns a `SyncResult`:
- `created`: New bookings imported from Beds24
- `updated`: Existing bookings updated with Beds24 changes
- `cancelled`: Bookings cancelled in Beds24
- `skipped`: Bookings already in sync
- `errors`: Error messages for failed operations

All API calls are logged to the `integration_logs` table for audit and debugging.

---

## 7. QA & Regression Test Plan

### 7.1 Critical Path Tests

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 1 | User Registration | Register → verify email → login | Account created, session cookie set |
| 2 | Property Search | Search by city + type + price range | Filtered results, correct count |
| 3 | Property Detail | View property → check gallery, map, pricing | All sections render, SEO meta correct |
| 4 | Booking Creation | Select dates → calculate → submit | Booking created with status "requested" |
| 5 | Booking Approval | Admin approves booking | Status → "approved", tenant notified |
| 6 | Payment (Moyasar) | Pay via mada → webhook received | Ledger PAID, booking active, availability block created |
| 7 | Payment (PayPal) | Pay via PayPal → capture confirmed | Same as above |
| 8 | Renewal | Check eligibility → request → pay | Extension created, end date extended |
| 9 | Maintenance Request | Submit with photos → admin reviews | Request created, admin email sent |
| 10 | Emergency Maintenance | Submit critical → admin notified | Urgent notification, email alert |
| 11 | Arabic RTL | Switch to Arabic → navigate all pages | Full RTL layout, no English strings, no overflow |
| 12 | Mobile Responsive | View on 375px width | No horizontal scroll, readable text, functional buttons |

### 7.2 Integration Tests

| # | Integration | Test |
|---|-------------|------|
| 1 | Moyasar Webhook | Send test webhook → verify HMAC → check ledger update |
| 2 | Beds24 Sync | Trigger inbound sync → verify bookings imported |
| 3 | WhatsApp | Send template message → verify delivery status |
| 4 | Email (SMTP) | Trigger welcome email → verify delivery |
| 5 | SMS (OTP) | Request OTP → verify code received |
| 6 | Google Maps | Geocode address → verify cache hit on second call |
| 7 | R2 Storage | Upload image → verify 3 variants created |

### 7.3 Security Tests

| # | Test | Expected |
|---|------|----------|
| 1 | Rate limiting | 11th login attempt in 5 min → 429 |
| 2 | Account lockout | 6th failed login → 15 min lockout |
| 3 | CSRF protection | Cross-origin POST → rejected |
| 4 | CSP headers | Inline script from unknown origin → blocked |
| 5 | Break-glass | Break-glass admin → full access regardless of role |
| 6 | Permission check | User without MANAGE_PROPERTIES → 403 on property edit |

---

## 8. Operations Handbook

### 8.1 Environment Variables

See [Appendix A](#appendix-a--environment-variables-reference) for the complete list. Critical production variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `PROD_DATABASE_URL` | Yes | MySQL connection string (PlanetScale) |
| `JWT_SECRET` | Yes | Session cookie signing key (≥32 chars) |
| `S3_BUCKET` + credentials | Yes | Cloudflare R2 for file storage |
| `BREAKGLASS_ADMIN_EMAILS` | Yes | Emergency admin bypass emails |

### 8.2 Database Operations

**Migrations**: Drizzle ORM manages schema migrations. Run `npx drizzle-kit generate` to create new migrations, `npx drizzle-kit migrate` to apply. The `start.sh` script runs migrations automatically on every deploy.

**Column Safety Net**: `fix-columns.mjs` runs before migrations to add any columns that migrations failed to create. Each ALTER TABLE is wrapped in try/catch so duplicate column errors are silently ignored.

**Backup**: PlanetScale handles automated backups. For manual backup, use `mysqldump` with the `PROD_DATABASE_URL`.

### 8.3 Monitoring

| Signal | Source | Action |
|--------|--------|--------|
| Server errors | Railway logs | Check `start.sh` output, DB connection |
| Payment failures | Moyasar dashboard + audit_log | Verify webhook delivery, check ledger |
| Beds24 sync failures | integration_logs table | Check API token expiry, rate limits |
| High latency | Railway metrics | Check cache hit rates, DB query performance |
| Storage errors | R2 dashboard | Verify credentials, bucket permissions |

### 8.4 Common Operations

**Add a new city:**
1. Admin panel → Settings → Cities → Add City
2. Provide Arabic + English name, region, coordinates
3. Upload city image
4. Set `isActive = true`

**Configure a new integration:**
1. Admin panel → Integrations → Select provider
2. Enter credentials (encrypted at rest)
3. Click "Test Connection"
4. Enable the integration

**Emergency: Break-glass access:**
1. Ensure your email is in `BREAKGLASS_ADMIN_EMAILS` env var
2. Login with that email — all permission checks are bypassed
3. Fix the issue (e.g., restore corrupted roles)
4. Remove break-glass access when resolved

### 8.5 Security & Compliance Posture

The platform implements multiple layers of security hardening that are critical to understand for ongoing maintenance and compliance.

**Authentication & Session Security:**

| Mechanism | Implementation | Notes |
|-----------|---------------|-------|
| Password hashing | bcrypt (10 rounds) | Stored in `users.password` |
| Session tokens | JWT signed with `JWT_SECRET` | httpOnly, Secure, SameSite=Strict cookies |
| Rate limiting | 10 login attempts / 5 min per IP | Configurable via `rate-limiter.ts` |
| Account lockout | 5 failed attempts → 15 min lockout | Progressive lockout |
| OTP verification | HMAC-SHA256 with pepper, 5 min TTL | Phone (SMS) + Email channels |
| Break-glass | Email-based bypass for emergency admin access | `BREAKGLASS_ADMIN_EMAILS` env var |

**Transport & Header Security:**

| Header | Value | Purpose |
|--------|-------|--------|
| `Content-Security-Policy` | Strict CSP with nonce | Prevents XSS |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Forces HTTPS |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage |
| `Permissions-Policy` | Restricts camera, microphone, geolocation | Minimizes attack surface |

**Data Protection:**

| Data Type | Protection | Storage |
|-----------|-----------|--------|
| Integration credentials | AES-256-GCM encryption at rest | `integration_credentials` table, encrypted with `SETTINGS_ENCRYPTION_KEY` |
| User passwords | bcrypt hash | `users.password` column |
| ID documents | R2 with restricted access | Admin-only viewing via signed URLs |
| OTP codes | HMAC-SHA256 with server pepper | `otp_codes` table, auto-expire after TTL |
| Payment data | Never stored locally | Moyasar/PayPal handle PCI compliance |
| Audit trail | Immutable append-only log | `audit_log` table with IP, user agent |

**Saudi PDPL (Personal Data Protection Law) Considerations:**

The platform collects personal data (name, phone, email, national ID) from Saudi residents. Under PDPL (effective September 2023), the following obligations apply and should be maintained:

| Obligation | Current Status | Action Needed |
|-----------|---------------|---------------|
| Privacy policy disclosure | Published at `/privacy` | Review annually |
| Consent for data collection | Implicit via registration | Consider explicit consent checkbox |
| Data minimization | Collects only necessary fields | Compliant |
| Right to access/delete | Not yet automated | Build self-service data export/deletion |
| Cross-border transfer | Data in PlanetScale (US region) | Consider Saudi-region hosting |
| Breach notification | No automated detection | Implement breach detection + 72hr notification |
| Data retention policy | No automatic purging | Define retention periods, implement auto-purge |

---

# Part B — Mobile App PRD

---

## 9. Mobile App Scope & Personas

### 9.1 Product Vision

The Monthly Key mobile app extends the existing web platform to native iOS and Android, providing a faster, more immersive experience for property discovery, booking, and tenant management. The app targets the Saudi Arabian market where mobile usage dominates internet access (>90% penetration).

### 9.2 Target Personas

| Persona | Description | Primary Use Cases |
|---------|-------------|-------------------|
| **Tenant (Primary)** | Saudi/expat professional seeking monthly furnished rental | Search properties, book, pay, manage lease, request maintenance |
| **Property Browser** | Casual user exploring rental options | Browse listings, save favorites, compare prices, share listings |
| **Landlord (Secondary)** | Property owner managing listings | View bookings, approve/reject, track revenue, respond to messages |
| **Admin (Out of Scope)** | Platform administrator | Admin functions remain web-only for v1 |

### 9.3 MVP Feature Scope (v1.0)

**In Scope:**

| Feature | Priority | Notes |
|---------|----------|-------|
| Property search & filters | P0 | City, type, price, beds, baths, size, amenities |
| Property detail with gallery | P0 | Swipeable image gallery, map, specs, pricing |
| Map-based search | P0 | Google Maps with property markers |
| User registration/login | P0 | Email + password, social login (Apple/Google) |
| Booking creation | P0 | Date selection, cost breakdown, submit request |
| Payment (Moyasar) | P0 | mada, Apple Pay, Google Pay (native SDKs) |
| Tenant dashboard | P0 | Bookings, payments, maintenance, profile |
| Push notifications | P0 | Booking updates, payment reminders, messages |
| Messaging | P1 | Tenant ↔ landlord real-time chat |
| Favorites | P1 | Save/unsave properties |
| Maintenance requests | P1 | Submit with camera photos, track status |
| Emergency maintenance | P1 | Urgent request with priority levels |
| Profile & ID upload | P1 | Camera/gallery upload for ID documents |
| Bilingual (AR/EN) | P0 | Full RTL support, language toggle |
| Offline mode | P2 | Cache recent searches, saved properties |
| Landlord dashboard | P2 | View bookings, approve/reject, revenue |

**Out of Scope (v1.0):**
- Admin panel (web-only)
- AI assistant (web-only for v1)
- CMS management
- Beds24 configuration
- Lease contract generation (view-only, generated server-side)

### 9.4 User Flows

**Primary Flow — Tenant Booking:**

```
App Launch → Onboarding (3 screens) → Home (Featured + Cities)
  → Search (filters + map toggle) → Property Detail
  → Select Dates → Cost Breakdown → Login/Register (if needed)
  → Submit Booking → Await Approval (push notification)
  → Payment Screen → Moyasar (mada/Apple Pay) → Confirmation
  → Tenant Dashboard → Active Booking → Maintenance/Renewal
```

**Secondary Flow — Property Discovery:**

```
App Launch → Home → Browse by City → Filter Results
  → View Property → Save to Favorites → Share via WhatsApp/iMessage
  → Compare saved properties → Book preferred
```

---

## 10. Technology Recommendation

### 10.1 Framework Comparison

| Criterion | React Native (Expo) | Flutter | Native (Swift/Kotlin) |
|-----------|--------------------|---------|-----------------------|
| Code sharing with web | High (shared types, hooks logic) | Low | None |
| Development speed | Fast | Fast | Slow |
| Team ramp-up | Low (existing React team) | Medium | High |
| Performance | Good (Hermes engine) | Excellent | Best |
| Native feel | Good (with native modules) | Good (Material/Cupertino) | Best |
| Apple Pay/Google Pay | Expo modules available | Plugins available | Native SDKs |
| Maps integration | react-native-maps (mature) | google_maps_flutter | MapKit/Google Maps |
| Push notifications | expo-notifications | firebase_messaging | APNs/FCM |
| RTL support | Built-in (I18nManager) | Built-in | Built-in |
| App Store compliance | Good | Good | Best |

### 10.2 Recommendation: React Native with Expo

**Rationale:**

1. **Type sharing**: The existing tRPC client types can be directly reused. The `@trpc/client` package works in React Native, providing the same type-safe API calls as the web app.

2. **Translation reuse**: The i18n translation keys (~400 per language) can be extracted to a shared JSON file and consumed by both web and mobile.

3. **Business logic reuse**: Hooks like `useAuth`, booking calculation utilities, and date formatting can be shared via a `shared/` package.

4. **Team continuity**: The existing development team knows React and TypeScript. React Native minimizes the learning curve.

5. **Expo ecosystem**: Expo provides managed builds (EAS Build), OTA updates (EAS Update), push notifications (expo-notifications), camera (expo-camera), image picker (expo-image-picker), and secure storage (expo-secure-store) — all critical for the app's feature set.

### 10.3 Recommended Architecture

```
monorepo/
├── packages/
│   ├── shared/              # Shared types, translations, utils
│   │   ├── types/           # tRPC router types, DB types
│   │   ├── i18n/            # Translation JSON files
│   │   └── utils/           # Date formatting, price formatting
│   ├── beds24-sdk/          # Existing SDK (unchanged)
│   └── mobile-ui/           # Mobile-specific UI components
├── apps/
│   ├── web/                 # Existing React web app
│   ├── mobile/              # React Native (Expo) app
│   │   ├── app/             # Expo Router file-based routing
│   │   ├── components/      # Mobile UI components
│   │   ├── hooks/           # Mobile-specific hooks
│   │   └── lib/             # tRPC client, storage, push
│   └── server/              # Existing Express server
```

### 10.4 Key Dependencies

| Package | Purpose |
|---------|---------|
| `expo` ~52 | Managed workflow, build tools |
| `expo-router` | File-based navigation (tabs, stacks, modals) |
| `@trpc/client` | Type-safe API calls to existing backend |
| `@tanstack/react-query` | Data fetching, caching, optimistic updates |
| `react-native-maps` | Google Maps integration |
| `expo-notifications` | Push notifications (APNs + FCM) |
| `expo-camera` | Camera for maintenance photos, ID upload |
| `expo-image-picker` | Gallery access |
| `expo-secure-store` | Encrypted token storage |
| `react-native-moyasar` | Moyasar payment SDK (or WebView fallback) |
| `expo-apple-authentication` | Apple Sign-In |
| `@react-native-google-signin/google-signin` | Google Sign-In |
| `react-native-reanimated` | Smooth animations |
| `nativewind` | Tailwind CSS for React Native |

---

## 11. API Contract & Backend Readiness

### 11.1 Existing tRPC Endpoints (Mobile-Ready)

The existing backend exposes all endpoints needed for the mobile app via tRPC. The mobile app connects to the same server — no separate mobile API is needed.

**Authentication Namespace (`auth.*`):**

| Procedure | Type | Input | Output | Mobile Notes |
|-----------|------|-------|--------|-------------|
| `auth.register` | mutation | `{ email, password, name, phone }` | `{ user, token }` | Add social auth (Apple/Google) |
| `auth.login` | mutation | `{ email, password }` | `{ user, token }` | Store token in SecureStore |
| `auth.logout` | mutation | — | `{ success }` | Clear SecureStore |
| `auth.me` | query | — | `{ user }` | Session validation |
| `auth.requestOtp` | mutation | `{ phone, channel }` | `{ sent }` | Same flow |
| `auth.verifyOtp` | mutation | `{ phone, code }` | `{ verified }` | Same flow |

**Property Namespace (`property.*`):**

| Procedure | Type | Input | Output |
|-----------|------|-------|--------|
| `property.search` | query | `{ city, type, minPrice, maxPrice, beds, baths, page }` | `{ properties[], total, page }` |
| `property.getById` | query | `{ id }` | `{ property }` |
| `property.getFeatured` | query | `{ limit }` | `{ properties[] }` |
| `property.getByCity` | query | `{ citySlug, page }` | `{ properties[], total }` |
| `property.toggleFavorite` | mutation | `{ propertyId }` | `{ isFavorite }` |
| `property.getFavorites` | query | — | `{ properties[] }` |

**Booking Namespace (`booking.*`):**

| Procedure | Type | Input | Output |
|-----------|------|-------|--------|
| `booking.calculate` | query | `{ propertyId, months }` | `{ breakdown }` |
| `booking.create` | mutation | `{ propertyId, startDate, months }` | `{ booking }` |
| `booking.getMyBookings` | query | — | `{ bookings[] }` |
| `booking.verifyPayment` | mutation | `{ paymentId }` | `{ booking, ledger }` |
| `booking.cancel` | mutation | `{ bookingId }` | `{ booking }` |

**Finance Namespace (`finance.*`):**

| Procedure | Type | Input | Output |
|-----------|------|-------|--------|
| `finance.ledger.getByBooking` | query | `{ bookingId }` | `{ entries[] }` |
| `finance.renewals.checkEligibility` | query | `{ bookingId }` | `{ eligible, reason }` |
| `finance.renewals.requestRenewal` | mutation | `{ bookingId }` | `{ extension, ledger }` |

**Messaging Namespace (`messaging.*`):**

| Procedure | Type | Input | Output |
|-----------|------|-------|--------|
| `messaging.getConversations` | query | — | `{ conversations[] }` |
| `messaging.getMessages` | query | `{ conversationId }` | `{ messages[] }` |
| `messaging.send` | mutation | `{ conversationId, text }` | `{ message }` |
| `messaging.startConversation` | mutation | `{ recipientId, propertyId }` | `{ conversation }` |

**Maintenance Namespace (`maintenance.*`):**

| Procedure | Type | Input | Output |
|-----------|------|-------|--------|
| `maintenance.create` | mutation | `{ title, description, category, urgency, photos[] }` | `{ request }` |
| `maintenance.getMyRequests` | query | — | `{ requests[] }` |
| `maintenance.createEmergency` | mutation | `{ title, description, category, urgency, photos[] }` | `{ request }` |

### 11.2 Backend Changes Required for Mobile

| Change | Priority | Description |
|--------|----------|-------------|
| **Token-based auth** | P0 | Add Bearer token auth alongside cookie-based sessions. Mobile apps can't use httpOnly cookies reliably. Add `Authorization: Bearer <token>` header support to the tRPC context. |
| **Social auth endpoints** | P0 | Add `auth.loginWithApple({ identityToken })` and `auth.loginWithGoogle({ idToken })` mutations that verify tokens with Apple/Google and create/link accounts. |
| **Push token registration** | P0 | Add `push.registerDevice({ token, platform })` mutation. Store FCM/APNs tokens in a `device_tokens` table. Modify push notification sender to support both web-push (VAPID) and FCM/APNs. |
| **Image upload endpoint** | P1 | The existing upload endpoint works via multipart form data, which React Native supports. No changes needed, but consider adding chunked upload for large files on slow connections. |
| **Refresh token** | P1 | Add refresh token rotation for mobile sessions (longer-lived than web). Store refresh token in SecureStore, access token in memory. |
| **API versioning** | P2 | Consider adding `/api/v1/` prefix for future backward compatibility. Currently all endpoints are unversioned. |

### 11.3 Authentication Strategy for Mobile

```
Mobile Auth Flow:
1. User logs in (email/password or social)
2. Server returns { accessToken (JWT, 15min), refreshToken (opaque, 30 days) }
3. Mobile stores refreshToken in SecureStore (encrypted)
4. Mobile stores accessToken in memory (not persisted)
5. tRPC client sends Authorization: Bearer <accessToken> on every request
6. On 401 → use refreshToken to get new accessToken
7. On refreshToken expiry → redirect to login
```

---

## 12. Mobile Payments & Uploads

### 12.1 Moyasar Mobile SDK

Moyasar provides native iOS and Android SDKs that offer a better payment experience than WebView:

**iOS (Swift):**
- `MoyasarSdk` pod — native Apple Pay sheet, mada card form
- Supports 3D Secure in-app

**Android (Kotlin):**
- `com.moyasar:moyasar-android-sdk` — native Google Pay sheet, mada card form
- Supports 3D Secure in-app

**React Native Integration Options:**

| Option | Pros | Cons |
|--------|------|------|
| Native module wrapper | Best UX, native Apple Pay/Google Pay | Requires native code per platform |
| WebView with Moyasar.js | Zero native code, same as web | Slower, less native feel |
| `react-native-moyasar` (if available) | Community package | May not be maintained |

**Recommendation**: Start with WebView approach for MVP (fastest to ship), then migrate to native modules for v1.1.

**Payment Flow (Mobile):**

```
1. App shows cost breakdown (from tRPC booking.calculate)
2. User taps "Pay" → opens Moyasar payment screen
3. Option A (WebView): Load Moyasar.js form in WebView
   - On success: WebView redirects to callback URL
   - App intercepts redirect, extracts payment_id
   - Calls tRPC booking.verifyPayment({ paymentId })
4. Option B (Native): Use Moyasar native SDK
   - Apple Pay / Google Pay sheet appears natively
   - SDK returns payment result
   - Calls tRPC booking.verifyPayment({ paymentId })
5. Server verifies with Moyasar API → updates ledger → activates booking
6. App shows confirmation screen + push notification
```

### 12.2 Camera & File Uploads

**Maintenance Photos:**
```
1. User taps "Add Photo" → expo-image-picker (camera or gallery)
2. Image resized client-side to max 1200px (expo-image-manipulator)
3. Upload via multipart POST to /api/upload
4. Server processes through image optimizer (thumbnail + medium + original)
5. Returns { url, thumbnailUrl } → stored with maintenance request
```

**ID Document Upload:**
```
1. User taps "Upload ID Front/Back"
2. expo-camera with document mode (auto-crop, flash)
3. Upload to /api/upload with metadata { type: "id_front" | "id_back" }
4. Server stores in R2 with restricted access (admin-only viewing)
```

---

## 13. Analytics & Push Notifications

### 13.1 Analytics Strategy

| Layer | Tool | Purpose |
|-------|------|---------|
| Web | Google Analytics 4 (gtag.js) | Page views, events, conversions |
| Mobile | Firebase Analytics | Screen views, events, crashes |
| Server | Custom audit_log table | Admin actions, payment events |
| Business | Admin dashboard KPIs | Revenue, occupancy, collection rate |

**Key Mobile Events to Track:**

| Event | Parameters | Trigger |
|-------|-----------|---------|
| `search_performed` | city, type, price_range | User submits search |
| `property_viewed` | property_id, city, type | Property detail opened |
| `property_favorited` | property_id | Heart icon tapped |
| `booking_started` | property_id, months | Date selection started |
| `booking_submitted` | booking_id, amount | Booking request sent |
| `payment_initiated` | booking_id, method | Payment screen opened |
| `payment_completed` | booking_id, amount, method | Payment confirmed |
| `maintenance_submitted` | category, urgency | Request submitted |
| `language_changed` | from, to | Language toggled |

### 13.2 Push Notifications

**Current Web Push (VAPID):**
The existing system uses `web-push` with VAPID keys for browser notifications. The `push_subscriptions` table stores endpoint + keys per user.

**Mobile Push Architecture:**

```
                    ┌─────────────┐
                    │  MK Server  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────┴─────┐ ┌───┴───┐ ┌─────┴─────┐
        │  web-push  │ │  FCM  │ │   APNs    │
        │  (VAPID)   │ │       │ │           │
        └─────┬─────┘ └───┬───┘ └─────┬─────┘
              │            │            │
        ┌─────┴─────┐ ┌───┴───┐ ┌─────┴─────┐
        │  Browser   │ │Android│ │   iOS     │
        └───────────┘ └───────┘ └───────────┘
```

**Required Backend Changes:**
1. Add `device_tokens` table: `{ userId, token, platform (ios/android), createdAt }`
2. Add `push.registerDevice` tRPC mutation
3. Modify notification sender to dispatch to web-push (existing) + FCM (new)
4. FCM handles both iOS (via APNs proxy) and Android

**Notification Types:**

| Type | Trigger | Title (AR) | Body (AR) |
|------|---------|-----------|-----------|
| `booking_approved` | Admin approves | تم قبول حجزك | تم الموافقة على حجزك — يرجى إكمال الدفع |
| `booking_rejected` | Admin rejects | تم رفض الحجز | للأسف تم رفض طلب الحجز |
| `payment_confirmed` | Webhook received | تم تأكيد الدفع | تم استلام دفعتك بنجاح |
| `payment_reminder` | 3 days before due | تذكير بالدفع | موعد الدفع خلال 3 أيام |
| `maintenance_update` | Status change | تحديث طلب الصيانة | تم تحديث حالة طلب الصيانة |
| `new_message` | Message received | رسالة جديدة | لديك رسالة جديدة من {sender} |
| `renewal_eligible` | 14 days before end | تجديد الإيجار | يمكنك الآن تجديد عقد الإيجار |

---

## 14. Mobile QA & Rollout Plan

### 14.1 Testing Strategy

| Phase | Focus | Tools |
|-------|-------|-------|
| Unit Tests | Business logic, hooks, utils | Jest + React Native Testing Library |
| Component Tests | UI components render correctly | React Native Testing Library |
| Integration Tests | API calls, auth flow, payment | Detox (E2E) |
| RTL Tests | Arabic layout, text alignment | Manual + screenshot comparison |
| Device Matrix | iPhone 13-16, Samsung S23-S25, Pixel 7-9 | BrowserStack / physical devices |
| Performance | App startup, scroll FPS, memory | React Native Performance Monitor |
| Accessibility | VoiceOver (iOS), TalkBack (Android) | Manual testing |

### 14.2 App Store Submission Checklist

| Requirement | iOS (App Store) | Android (Google Play) |
|-------------|----------------|----------------------|
| App name | المفتاح الشهري - Monthly Key | Same |
| Category | Lifestyle / Real Estate | House & Home |
| Age rating | 4+ | Everyone |
| Privacy policy | Required (link to monthlykey.com/privacy) | Required |
| Screenshots | 6.7" (iPhone 15 Pro Max) + 12.9" (iPad) | Phone + 7" tablet + 10" tablet |
| App review notes | Test account credentials, payment sandbox | Same |
| In-app purchases | None (payments via Moyasar, not IAP) | Same |
| Data safety | Collects: name, email, phone, location, photos | Same |

### 14.3 Rollout Plan

| Phase | Timeline | Scope | Success Criteria |
|-------|----------|-------|-----------------|
| **Alpha** | Week 1-8 | Internal team (5 users) | Core flows work, no crashes |
| **Closed Beta** | Week 9-12 | 50 invited tenants | 90% task completion, <2% crash rate |
| **Open Beta** | Week 13-14 | TestFlight / Google Play Beta | <1% crash rate, 4+ star rating |
| **Production** | Week 15 | Full launch | 10K+ downloads in first month |
| **v1.1** | Week 16-20 | Native payments, offline mode, landlord dashboard | Improved conversion rate |

### 14.4 KPIs to Track Post-Launch

| KPI | Target | Measurement |
|-----|--------|-------------|
| App crash rate | <1% | Firebase Crashlytics |
| App startup time | <2 seconds | Firebase Performance |
| Booking conversion (mobile) | >5% | Firebase Analytics funnel |
| Payment success rate | >95% | Server-side ledger analysis |
| Push notification opt-in | >60% | Device token registration rate |
| DAU/MAU ratio | >20% | Firebase Analytics |
| App Store rating | >4.0 | App Store Connect / Play Console |

---

# Appendices

---

## Appendix A — Environment Variables Reference

### Required (Production)

| Variable | Description | Example |
|----------|-------------|---------|
| `PROD_DATABASE_URL` | MySQL connection string | `mysql://user:pass@host:3306/db?ssl={"rejectUnauthorized":true}` |
| `JWT_SECRET` | Session signing key (≥32 chars) | `a1b2c3d4e5f6...` (random) |
| `S3_ENDPOINT` | Cloudflare R2 endpoint | `https://xxxx.r2.cloudflarestorage.com` |
| `S3_BUCKET` | R2 bucket name | `monthly-key-uploads` |
| `S3_ACCESS_KEY_ID` | R2 access key | `xxxx` |
| `S3_SECRET_ACCESS_KEY` | R2 secret key | `xxxx` |
| `S3_PUBLIC_BASE_URL` | CDN URL for public files | `https://cdn.monthlykey.com` |
| `BREAKGLASS_ADMIN_EMAILS` | Emergency admin emails (comma-separated) | `admin@monthlykey.com` |

### Optional (Feature-Dependent)

| Variable | Default | Description |
|----------|---------|-------------|
| `STAGING_DATABASE_URL` | — | Staging DB for preview deploys |
| `REDIS_URL` | — | Redis for distributed caching |
| `GOOGLE_MAPS_API_KEY` | — | Server-side geocoding |
| `OPENAI_API_KEY` | — | AI assistant |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI endpoint |
| `OPENAI_MODEL` | `gpt-4o-mini` | AI model |
| `SMTP_HOST` | `localhost` | Email server |
| `SMTP_PORT` | `587` | Email port |
| `SMTP_USER` | `noreply@localhost` | Email username |
| `SMTP_PASS` | — | Email password |
| `SMTP_FROM` | `noreply@localhost` | Sender address |
| `SMTP_SECURE` | `false` | Use TLS |
| `SMS_PROVIDER` | `dev` | OTP provider (unifonic/twilio/dev) |
| `SMS_API_KEY` | — | SMS provider API key |
| `EMAIL_PROVIDER` | `dev` | Email OTP provider (smtp/resend/dev) |
| `EMAIL_API_KEY` | — | Email provider API key |
| `VITE_VAPID_PUBLIC_KEY` | — | Web push public key |
| `VAPID_PRIVATE_KEY` | — | Web push private key |
| `OTP_SECRET_PEPPER` | `dev-otp-pepper...` | OTP HMAC pepper (≥32 chars) |
| `OTP_TTL_SECONDS` | `300` | OTP expiry (5 minutes) |
| `SETTINGS_ENCRYPTION_KEY` | — | Integration credential encryption |
| `MAX_UPLOAD_SIZE` | `52428800` | Max upload size (50MB) |
| `PUBLIC_URL` | auto-detected | Base URL for links |
| `S3_REGION` | `auto` | R2 region |

### Client-Side (VITE_ prefix)

| Variable | Description |
|----------|-------------|
| `VITE_GA_MEASUREMENT_ID` | Google Analytics 4 ID |
| `VITE_VAPID_PUBLIC_KEY` | Web push public key (client) |

---

## Appendix B — Database Schema (All Tables)

The database contains **51 tables** managed by Drizzle ORM, plus 2 auto-migrated tables (`availability_blocks`, `integration_logs`).

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts | id, email, password, name, nameAr, phone, role, isVerified, emailVerified, phoneVerified, avatarUrl, idFrontUrl, idBackUrl |
| `properties` | Property listings | id, ownerId, title, titleAr, description, descriptionAr, propertyType, city, cityAr, district, districtAr, monthlyRent, bedrooms, bathrooms, size, amenities, status, isVerified, isFeatured, lat, lng, locationPrivacy |
| `bookings` | Booking records | id, propertyId, tenantId, startDate, endDate, moveOutDate, status (requested/approved/active/completed/cancelled/rejected), totalAmount, insuranceAmount, serviceFee, vatAmount, paymentStatus, paymentMethod |
| `payments` | Legacy payment records | id, bookingId, amount, status, paymentMethod, transactionId |
| `payment_ledger` | Financial ledger (SoT) | id, bookingId, invoiceNumber, entryType, status, amount, currency, dueDate, paidAt, paymentMethod, provider, providerRef, webhookVerified, calcSnapshot |
| `booking_extensions` | Renewal records | id, bookingId, extensionMonths, newEndDate, status, ledgerEntryId, beds24Controlled |

### Property Management

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `buildings` | Building/complex records | id, name, nameAr, address, addressAr, cityId, districtId, totalUnits, managerId |
| `units` | Individual rental units | id, buildingId, propertyId, unitNumber, floor, bedrooms, bathrooms, size, monthlyRent, status |
| `beds24_map` | Beds24 ↔ MK mapping | id, propertyId, unitId, beds24PropertyId, beds24RoomId, connectionType, sourceOfTruth, icalImportUrl, lastSyncAt |
| `unit_daily_status` | Daily occupancy tracking | id, unitId, date, status (available/occupied/maintenance/blocked), bookingId |
| `property_availability` | Availability windows | id, propertyId, startDate, endDate, isAvailable |
| `property_managers` | Property manager profiles | id, userId, companyName, companyNameAr, licenseNumber, phone, email |
| `property_manager_assignments` | Manager ↔ property links | id, managerId, propertyId |

### Communication

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `conversations` | Chat threads | id, propertyId, participants (JSON) |
| `messages` | Chat messages | id, conversationId, senderId, content, readAt |
| `notifications` | In-app notifications | id, userId, type, title, titleAr, message, messageAr, isRead, data (JSON) |
| `whatsapp_messages` | WhatsApp message log | id, userId, phone, templateName, status, direction, messageId |
| `push_subscriptions` | Web push endpoints | id, userId, endpoint, p256dh, auth |

### Maintenance

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `maintenance_requests` | Standard maintenance | id, tenantId, propertyId, title, description, category, status, priority, images (JSON) |
| `emergency_maintenance` | Emergency requests | id, tenantId, bookingId, title, description, category, urgency, status, images (JSON), adminNotes |
| `maintenance_updates` | Status update log | id, requestId, status, note, updatedBy |

### Platform Services

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `platform_services` | Service catalog | id, name, nameAr, description, descriptionAr, price, category, isActive |
| `service_requests` | Service orders | id, userId, serviceId, status, notes |

### Content & AI

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `knowledge_base` | AI knowledge articles | id, title, titleAr, content, contentAr, category, tags, isPublished |
| `ai_conversations` | AI chat sessions | id, userId, title, model |
| `ai_messages` | AI chat messages | id, conversationId, role, content |
| `ai_documents` | Uploaded reference docs | id, title, fileName, extractedText, category |
| `cms_content_versions` | CMS page versions | id, pageSlug, content, contentAr, version, publishedAt |
| `cms_media` | CMS media library | id, fileName, url, mimeType, size, alt, altAr |

### Geography

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `cities` | Saudi cities | id, name, nameAr, region, regionAr, lat, lng, imageUrl, isActive |
| `districts` | City districts | id, cityId, name, nameAr, lat, lng, isActive |
| `geocode_cache` | Geocoding cache | id, address, lat, lng, placeId, expiresAt |

### Security & Admin

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `roles` | Custom roles | id, name, nameAr, description, permissions (JSON), isSystem |
| `admin_permissions` | Permission assignments | id, userId, roleId, permissions (JSON) |
| `audit_log` | Admin action log | id, userId, action, entityType, entityId, details (JSON), ipAddress |
| `otp_codes` | OTP verification | id, userId, phone, email, code, channel, expiresAt, verified |
| `user_activities` | User activity log | id, userId, action, details, ipAddress, userAgent |

### Integrations

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `integration_configs` | Provider settings | id, provider, isEnabled, settings (JSON, encrypted) |
| `integration_credentials` | Provider credentials | id, provider, credentialType, value (encrypted) |
| `payment_method_settings` | Payment method config | id, method, isEnabled, provider, settings (JSON) |

### Submissions & KYC

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `property_submissions` | Landlord property submissions | id, userId, title, titleAr, propertyType, city, district, monthlyRent, bedrooms, bathrooms, size, description, status (pending/approved/rejected), adminNotes |
| `submission_photos` | Submission images | id, submissionId, url, order |
| `kyc_requests` | KYC verification requests | id, userId, status (pending/approved/rejected), documentType, documentNumber, expiryDate |
| `kyc_documents` | KYC uploaded documents | id, kycRequestId, type, url, verified |

### Other

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `favorites` | Saved properties | id, userId, propertyId |
| `reviews` | Property reviews | id, propertyId, userId, rating, comment |
| `saved_searches` | Saved search filters | id, userId, name, filters (JSON) |
| `platform_settings` | Key-value settings | id, key, value, category |
| `contact_messages` | Contact form submissions | id, name, email, phone, subject, message, status |
| `inspection_requests` | Property inspection requests | id, userId, propertyId, preferredDate, status, notes |

### Auto-Migrated Tables (Raw SQL)

| Table | Purpose |
|-------|---------|
| `availability_blocks` | Date-range occupancy blocks (bookingId, unitId, startDate, endDate, blockType, status) |
| `integration_logs` | Integration API call logs (provider, action, status, requestPayload, responsePayload, errorMessage) |

---

## Appendix C — Prioritized Backlog

### P0 — Critical (Before Mobile Launch)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 1 | Token-based auth (Bearer) for mobile | 3 days | Add alongside cookie auth, not replace |
| 2 | Social auth (Apple Sign-In, Google Sign-In) | 3 days | Server-side token verification |
| 3 | FCM push notification support | 2 days | Add FCM sender alongside web-push |
| 4 | Device token registration endpoint | 1 day | New table + tRPC mutation |
| 5 | Refresh token rotation | 2 days | SecureStore on mobile, httpOnly cookie on web |

### P1 — High (Mobile v1.0)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 6 | Moyasar native SDK integration (React Native) | 5 days | Or WebView fallback for MVP |
| 7 | Camera/gallery upload optimization | 2 days | Client-side resize before upload |
| 8 | Offline property cache | 3 days | AsyncStorage + TanStack Query persist |
| 9 | Deep linking (property URLs → app) | 2 days | Universal Links (iOS) + App Links (Android) |
| 10 | App Store assets (screenshots, descriptions) | 2 days | Arabic + English |

### P2 — Medium (Post-Launch)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 11 | Landlord mobile dashboard | 5 days | Booking approval, revenue view |
| 12 | AI assistant in mobile | 3 days | Chat UI + existing API |
| 13 | Biometric auth (Face ID / fingerprint) | 1 day | expo-local-authentication |
| 14 | In-app review prompt | 1 day | After successful booking completion |
| 15 | WhatsApp share integration | 1 day | Deep link to WhatsApp with property URL |

### P3 — Low (Future)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 16 | API versioning (`/api/v1/`) | 2 days | Backward compatibility for mobile |
| 17 | GraphQL gateway (optional) | 5 days | If mobile needs different data shapes |
| 18 | Real-time messaging (WebSocket) | 3 days | Replace polling with live updates |
| 19 | AR property preview | 10 days | ARKit/ARCore for virtual tours |
| 20 | Automated lease renewal reminders | 2 days | Cron job + push notification |

### Website Backlog (Existing)

| # | Item | Priority | Notes |
|---|------|----------|-------|
| 21 | Complete KYC provider integration | P1 | Currently adapter-only, no real provider |
| 22 | Stripe integration (international) | P2 | For non-Saudi payment methods |
| 23 | Multi-language CMS content | P2 | Currently hardcoded bilingual |
| 24 | Advanced analytics dashboard | P2 | GA4 server-side data + custom charts |
| 25 | Automated Beds24 sync scheduling | P1 | Currently manual trigger only |
| 26 | Email template builder (admin) | P3 | Currently hardcoded HTML templates |
| 27 | Property comparison feature | P2 | Side-by-side comparison UI |
| 28 | Tenant screening/credit check | P3 | Third-party integration |
| 29 | Automated rent collection (recurring) | P2 | Moyasar recurring payments API |
| 30 | Multi-currency support | P3 | USD, EUR alongside SAR |

---

*End of Monthly Key Project Handoff Package*
