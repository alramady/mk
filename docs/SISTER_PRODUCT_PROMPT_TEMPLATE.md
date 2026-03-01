# Sister-Product Website — Reusable Prompt Template

> **Purpose:** This document is a ready-to-use prompt template for instructing any AI coding agent (Monthly Key, Cursor, Claude, etc.) to build a new product website that integrates with the MonthlyKey ecosystem. Copy the relevant sections, fill in the `{{placeholders}}`, and paste into your agent.
>
> **Version:** 2.0 — 2026-02-26  
> **Maintainer:** MonthlyKey Engineering

---

## Table of Contents

1. [Quick-Start Prompt (Copy & Paste)](#1-quick-start-prompt)
2. [MonthlyKey Integration Contract](#2-monthlykey-integration-contract)
3. [Mandatory UX Rules (Mobile-First, Saudi Market)](#3-mandatory-ux-rules)
4. [Feature Flags & Config Placeholders](#4-feature-flags--config-placeholders)
5. [Security & Compliance Baseline](#5-security--compliance-baseline)
6. [Architecture Constraints](#6-architecture-constraints)
7. [Database Schema Conventions](#7-database-schema-conventions)
8. [API Contract Templates](#8-api-contract-templates)
9. [Design System & Branding](#9-design-system--branding)
10. [Deployment & DevOps](#10-deployment--devops)
11. [DO NOT BREAK Guardrails](#11-do-not-break-guardrails)
12. [Example: Cobnb KSA](#12-example-cobnb-ksa)
13. [Example: Cleaning & Maintenance Company](#13-example-cleaning--maintenance-company)

---

## 1. Quick-Start Prompt

Copy the block below, replace every `{{...}}` placeholder, and paste it into your AI agent:

```markdown
# Project: {{PRODUCT_NAME}}

## Overview
Build a production-ready web application for **{{PRODUCT_NAME}}** ({{ARABIC_BRAND_NAME}}) —
{{ONE_LINE_DESCRIPTION}}.
This product is part of the **MonthlyKey ecosystem** and must integrate with the MonthlyKey
platform via its Hub API, adapters, and webhooks.

## Branding
- English name: {{ENGLISH_BRAND_NAME}}
- Arabic name: {{ARABIC_BRAND_NAME}}
- Domain: {{DOMAIN}}
- Primary color: {{PRIMARY_COLOR_HEX}}
- Logo: {{LOGO_URL_OR_DESCRIPTION}}

## Tech Stack (MUST match MonthlyKey)
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4 + shadcn/ui + Radix UI
- **Backend**: Express.js + tRPC v11 + Drizzle ORM
- **Database**: MySQL 8 (separate instance, product-prefixed tables)
- **Auth**: JWT-based (HS256), compatible with MonthlyKey's auth system
- **Styling**: Tailwind CSS with MonthlyKey brand tokens (see Design System section)
- **i18n**: Arabic (RTL, primary) + English (LTR, secondary)
- **Deployment**: Railway (Docker) with persistent volume for uploads

## Primary Users
{{PRIMARY_USERS}}
<!-- Example: Tenants looking for short-term furnished rentals in Saudi Arabia -->

## Core Flows
{{CORE_FLOWS}}
<!-- Example:
1. Guest searches for property by city/dates
2. Guest views property details with photos, amenities, pricing
3. Guest books and pays online
4. Host receives booking notification and confirms
5. Guest checks in, stays, checks out
6. Both parties leave reviews
-->

## MonthlyKey Integration
This product connects to MonthlyKey via:
1. **Hub API** (`https://{{HUB_API_DOMAIN}}/api/v1/`) — for cross-product data exchange
2. **Shared Auth** — JWT tokens issued by MonthlyKey are accepted by this product
3. **Beds24 SDK** — if this product needs PMS data, use the shared `@mk/beds24-sdk` package
4. **Webhook Events** — subscribe to: {{LIST_EVENTS_NEEDED}}
   <!-- Example: booking.created, booking.cancelled, tenant.checkout, property.updated -->

## Integrations Needed
{{INTEGRATIONS_NEEDED}}
<!-- Example:
- Hub API: property listing sync, booking creation
- Beds24 SDK: availability calendar, pricing
- WhatsApp: backend-controlled click-to-chat
- Google Maps: property location display
- PayPal/Stripe: payment processing
-->

## Pages Required
{{LIST_PAGES}}

## API Endpoints Required
{{LIST_API_ENDPOINTS}}

## Database Tables Required
{{LIST_TABLES_WITH_COLUMNS}}

## Non-Functional Requirements
- Response time: < 200ms for API calls, < 3s for page load
- Mobile-first responsive design (Saudi market: 70%+ mobile traffic)
- WCAG 2.1 AA accessibility
- Rate limiting on all public endpoints
- Input validation with Zod on both client and server
- Error boundaries on all page components
- Arabic RTL as default layout direction

## Constraints
- MUST NOT break any existing MonthlyKey functionality
- MUST use the same JWT secret as MonthlyKey for token verification
- MUST follow the same database naming conventions (camelCase columns)
- MUST support Arabic RTL layout as the primary language
- MUST NOT use any the platform automations or proprietary services
- MUST NOT use Monthly Keycdn or any Monthly Key-specific CDN
- No new paid dependencies without explicit approval
```

---

## 2. MonthlyKey Integration Contract

### 2.1 Hub API Endpoints

The Hub API is the central integration point for all sister products. Base URL is configured via `HUB_API_URL` environment variable.

| Endpoint | Method | Auth | Purpose | Rate Limit |
|----------|--------|------|---------|-----------|
| `/api/v1/health` | GET | None | Health check | 120/min |
| `/api/v1/ready` | GET | None | Readiness check (DB + Beds24) | 120/min |
| `/api/v1/properties` | GET | Optional | List properties with filters (`city`, `type`, `priceMin`, `priceMax`, `page`, `limit`) | 60/min |
| `/api/v1/properties/:id` | GET | Optional | Get property details (title, description, photos, amenities, pricing, location) | 60/min |
| `/api/v1/properties/:id/calendar` | GET | Optional | Get availability calendar for date range | 60/min |
| `/api/v1/bookings` | POST | Required (JWT) | Create a booking (`propertyId`, `checkIn`, `checkOut`, `guestData`, `idempotencyKey`) | 20/5min |
| `/api/v1/bookings/:id` | GET | Required (JWT) | Get booking details | 60/min |
| `/api/v1/bookings/:id` | PATCH | Required (JWT) | Update booking status (`confirmed`, `cancelled`, `completed`) | 20/5min |
| `/api/v1/guests/:id` | GET | Required (JWT) | Get guest profile | 60/min |
| `/api/v1/webhooks/subscribe` | POST | Required (API Key) | Subscribe to events | 10/min |
| `/api/v1/webhooks/subscribe/:id` | DELETE | Required (API Key) | Unsubscribe from events | 10/min |

### 2.2 Webhook Events & Payload Shapes

Sister products subscribe to events via the Hub API. Events are delivered as HTTP POST requests to the registered callback URL.

| Event | Payload Shape | When Emitted |
|-------|--------------|-------------|
| `booking.created` | `{ version: 1, event: "booking.created", bookingId: number, propertyId: number, tenantId: number, checkIn: "YYYY-MM-DD", checkOut: "YYYY-MM-DD", totalAmount: string, currency: "SAR" }` | New booking created in MonthlyKey |
| `booking.approved` | `{ version: 1, event: "booking.approved", bookingId: number, propertyId: number, approvedBy: number }` | Landlord approves a booking |
| `booking.cancelled` | `{ version: 1, event: "booking.cancelled", bookingId: number, reason: string, cancelledBy: "tenant" \| "landlord" \| "admin" }` | Booking cancelled by any party |
| `payment.completed` | `{ version: 1, event: "payment.completed", paymentId: number, bookingId: number, amount: string, method: "paypal" \| "bank_transfer", currency: "SAR" }` | Payment confirmed |
| `property.updated` | `{ version: 1, event: "property.updated", propertyId: number, changes: string[] }` | Property details changed (title, price, photos, etc.) |
| `maintenance.created` | `{ version: 1, event: "maintenance.created", ticketId: number, propertyId: number, urgency: "normal" \| "emergency", category: string }` | New maintenance request submitted |
| `maintenance.resolved` | `{ version: 1, event: "maintenance.resolved", ticketId: number, resolution: string }` | Maintenance ticket resolved |
| `tenant.checkin` | `{ version: 1, event: "tenant.checkin", bookingId: number, tenantId: number, propertyId: number }` | Tenant checks into property |
| `tenant.checkout` | `{ version: 1, event: "tenant.checkout", bookingId: number, tenantId: number, propertyId: number }` | Tenant checks out of property |

**Webhook delivery rules:**

- Delivery timeout: 10 seconds. If the endpoint does not respond within 10s, the delivery is marked as failed.
- Retry policy: 3 retries with exponential backoff (10s, 60s, 300s). After 3 failures, the event is moved to a dead letter queue.
- Idempotency: Every event includes a unique `eventId` (UUID). Consumers MUST check for duplicate `eventId` before processing.
- Signature: Every webhook request includes an `X-Webhook-Signature` header containing `HMAC-SHA256(payload, webhook_secret)`. Consumers MUST verify this signature.

### 2.3 Authentication Methods

| Method | Use Case | Implementation |
|--------|----------|---------------|
| **JWT (user-facing)** | Browser → sister product API | Same `JWT_SECRET` as MonthlyKey. Verify with `jsonwebtoken.verify()`. Token payload: `{ id, email, name, role, iat, exp }`. |
| **API Key (service-to-service)** | Sister product → Hub API (webhook subscription) | `X-API-Key` header. Key generated by MonthlyKey admin and stored in `HUB_API_KEY` env var. |
| **Bearer JWT (service-to-service)** | Sister product → Hub API (data queries) | Standard `Authorization: Bearer <token>` header. Token issued by MonthlyKey auth system. |

### 2.4 Rate Limits, Retries & Idempotency

**Rate limits (Hub API):**

| Endpoint Category | Limit | Window |
|------------------|-------|--------|
| Auth endpoints | 20 requests | 15 minutes |
| Search/read endpoints | 60 requests | 1 minute |
| Write endpoints (bookings, updates) | 20 requests | 5 minutes |
| General | 120 requests | 1 minute |

**Retry policy for sister products calling Hub API:**

- On `429 Too Many Requests`: respect `Retry-After` header. If absent, wait 60 seconds.
- On `5xx` errors: retry up to 3 times with exponential backoff (1s, 5s, 15s).
- On `4xx` errors (except 429): do not retry. Log and alert.

**Idempotency rules:**

- All POST requests to Hub API MUST include an `Idempotency-Key` header (UUID v4).
- The Hub API stores idempotency keys for 24 hours. Duplicate requests within this window return the original response without re-processing.
- Sister products MUST generate and store idempotency keys before making requests, so they can safely retry on network failures.

### 2.5 Data Model Mapping

| MonthlyKey Concept | Hub API Field | Sister Product Mapping | Notes |
|-------------------|---------------|----------------------|-------|
| Property | `propertyId` (int) | Reference as `mkPropertyId` in your tables | Never store property details locally — always fetch from Hub API |
| Unit/Room | `roomId` (int) within property | Reference as `mkRoomId` | A property can have multiple rooms |
| Booking | `bookingId` (int) | Reference as `mkBookingId` | Bookings are created via Hub API, not directly in MonthlyKey DB |
| Customer/Tenant | `tenantId` (int) | Reference as `mkUserId` | User data fetched via Hub API `/guests/:id` |
| Landlord/Host | `landlordId` (int) | Reference as `mkUserId` with role check | Same user table, different role |
| Maintenance Ticket | `ticketId` (int) | Reference as `mkTicketId` | Subscribe to `maintenance.created` webhook |
| City | `cityId` (int) | Use MonthlyKey's city/district hierarchy | Fetch via Hub API or sync on startup |
| District | `districtId` (int) | Nested under city | Same as above |

### 2.6 Beds24 Synchronization Boundaries

| Operation | Who Can Do It | How |
|-----------|--------------|-----|
| **Read** property details | Any sister product | Via Hub API `/properties/:id` (Hub API caches Beds24 data) |
| **Read** availability/pricing | Any sister product | Via Hub API `/properties/:id/calendar` |
| **Create** a booking | Any sister product | Via Hub API `POST /bookings` (Hub API writes to Beds24) |
| **Update** a booking | Only MonthlyKey or the creating product | Via Hub API `PATCH /bookings/:id` |
| **Write** property details | Only MonthlyKey admin | Direct Beds24 SDK access (not available to sister products) |
| **Sync** property data | Hub API worker | Automatic periodic sync + webhook-triggered sync |

**Rule:** Sister products MUST NOT call the Beds24 API directly. All Beds24 interactions go through the Hub API, which handles token management, rate limiting, and data consistency.

---

## 3. Mandatory UX Rules

### 3.1 Mobile-First Layouts

The Saudi market is predominantly mobile (70%+ of traffic comes from smartphones). All sister products must follow these rules:

| Rule | Implementation |
|------|---------------|
| **Design for 375px first** | Use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`) to scale up, not down |
| **Touch targets: 44×44px minimum** | All buttons, links, and interactive elements must meet this minimum |
| **Safe areas for iOS** | Use `env(safe-area-inset-*)` CSS variables for notched devices. Add `viewport-fit=cover` to meta tag. |
| **Bottom navigation on mobile** | Primary navigation should be a fixed bottom bar on mobile viewports (< 640px) |
| **No hover-dependent interactions** | All hover effects must have touch/tap equivalents |
| **Lazy load images** | Use `loading="lazy"` on all images below the fold. Use `srcset` for responsive images. |
| **JavaScript bundle < 300KB gzipped** | Monitor with `vite-plugin-compression`. Split routes with `React.lazy()`. |

### 3.2 Language & Content Rules

| Rule | Details |
|------|---------|
| **No mixed-language fields** | A field is either Arabic (`titleAr`) or English (`titleEn`). Never store both in one field. |
| **Arabic forms show Arabic-first** | When `lang=ar`, form labels, placeholders, and validation messages are in Arabic. Input direction is RTL. |
| **English forms show English-only** | When `lang=en`, everything is in English. Input direction is LTR. |
| **Language toggle** | Visible in header/footer. Persisted in `localStorage` and sent as `Accept-Language` header. |
| **Error messages are bilingual** | API returns both `message` (English) and `messageAr` (Arabic). Frontend displays based on current language. |
| **Currency: SAR** | Arabic: `١٬٥٠٠٫٠٠ ر.س` — English: `SAR 1,500.00`. Use `Intl.NumberFormat` with appropriate locale. |
| **Phone: +966 format** | Always store in E.164 (`+9665XXXXXXXX`). Display with local formatting. Validate Saudi number pattern. |

### 3.3 RTL/LTR Implementation

| Aspect | Rule |
|--------|------|
| **CSS logical properties** | Use `margin-inline-start` instead of `margin-left`. Use `padding-inline-end` instead of `padding-right`. |
| **Tailwind RTL plugin** | Use `tailwindcss-rtl` or Tailwind's built-in `rtl:` variant for direction-specific styles. |
| **Icons** | Directional icons (arrows, chevrons) must flip in RTL. Use `rtl:rotate-180` class. |
| **Text alignment** | Use `text-start` and `text-end` instead of `text-left` and `text-right`. |
| **HTML `dir` attribute** | Set `dir="rtl"` on `<html>` for Arabic, `dir="ltr"` for English. Dynamic switching via React context. |
| **Testing** | Every page must be visually tested in both RTL and LTR before merge. |

### 3.4 WhatsApp Integration

WhatsApp is the dominant communication channel in Saudi Arabia. All sister products should support backend-controlled WhatsApp integration.

| Feature | Implementation |
|---------|---------------|
| **Floating WhatsApp button** | Controlled by `ENABLE_WHATSAPP_WIDGET` feature flag. Hidden on auth pages. RTL-aware placement (left in RTL, right in LTR). |
| **Click-to-chat links** | Generate `https://wa.me/<E164>?text=<urlencoded message>`. Phone number from `whatsapp_phone_e164` setting. |
| **Per-entity message templates** | Backend stores templates with placeholders: `{{property_title}}`, `{{booking_id}}`, `{{city}}`, `{{url}}`. Templates available in Arabic and English. |
| **No external dependencies** | WhatsApp integration is a simple URL redirect. No Twilio, no WhatsApp Business API. Just `wa.me` links. |

### 3.5 Maps & Location

| Feature | Implementation |
|---------|---------------|
| **Map display** | Use Leaflet + OpenStreetMap (free, no API key). Google Maps available via MonthlyKey proxy (no key needed). |
| **Geocoding** | Use Google Maps Geocoding API via proxy for address → coordinates conversion. |
| **Location search** | Use Google Places Autocomplete via proxy for city/district search. |
| **Feature flag** | `ENABLE_LOCATION_RESOLVE` controls whether location features are active. |
| **Fallback** | If maps are disabled, show text address with a link to Google Maps. |

---

## 4. Feature Flags & Config Placeholders

Every sister product should define these feature flags and config values as environment variables. All are **placeholders only** — set actual values at deployment time.

### 4.1 Feature Flags

```bash
# WhatsApp
ENABLE_WHATSAPP_WIDGET=false
WHATSAPP_PHONE_E164=+966XXXXXXXXX
WHATSAPP_DEFAULT_MESSAGE_AR=مرحباً، أحتاج مساعدة
WHATSAPP_DEFAULT_MESSAGE_EN=Hello, I need help
WHATSAPP_BRAND_NAME=SET_LATER

# Maps & Location
ENABLE_LOCATION_RESOLVE=false
GOOGLE_MAPS_API_KEY=SET_LATER

# Beds24 Integration
ENABLE_BEDS24_SYNC=false
BEDS24_REFRESH_TOKEN=SET_LATER

# Payments
ENABLE_PAYPAL=false
PAYPAL_CLIENT_ID=SET_LATER
PAYPAL_CLIENT_SECRET=SET_LATER
ENABLE_STRIPE=false
STRIPE_SECRET_KEY=SET_LATER
STRIPE_PUBLISHABLE_KEY=SET_LATER

# AI Assistant
ENABLE_AI_ASSISTANT=false
AI_API_KEY=SET_LATER

# Push Notifications
ENABLE_PUSH_NOTIFICATIONS=false
VAPID_PUBLIC_KEY=SET_LATER
VAPID_PRIVATE_KEY=SET_LATER

# Maintenance Mode
ENABLE_MAINTENANCE_MODE=false
MAINTENANCE_MESSAGE_AR=الموقع تحت الصيانة
MAINTENANCE_MESSAGE_EN=Site under maintenance
```

### 4.2 Core Config

```bash
# Application
NODE_ENV=production
PORT=3000
PUBLIC_URL=https://{{DOMAIN}}

# Database
DATABASE_URL=mysql://user:pass@host:3306/{{DB_NAME}}

# Authentication
JWT_SECRET={{SAME_AS_MONTHLYKEY}}

# MonthlyKey Integration
HUB_API_URL=https://{{HUB_API_DOMAIN}}/api/v1
HUB_API_KEY={{GENERATED_API_KEY}}

# File Storage
UPLOAD_DIR=/app/uploads

# Cache (optional, recommended for production)
REDIS_URL=redis://default:pass@host:6379

# Email (optional)
SMTP_HOST=SET_LATER
SMTP_PORT=587
SMTP_USER=SET_LATER
SMTP_PASS=SET_LATER
EMAIL_FROM=SET_LATER
```

---

## 5. Security & Compliance Baseline

Every sister product MUST implement these security measures from day one.

### 5.1 OTP Rules

| Rule | Specification |
|------|--------------|
| OTP length | 6 digits, cryptographically random (`crypto.randomBytes`) |
| OTP storage | SHA-256(code + random salt) — never plaintext |
| TTL | 5 minutes from generation |
| Resend cooldown | 60 seconds between resend requests |
| Max verification attempts | 5 per code. After 5 failures, code is invalidated. |
| Rate limiting | 10 OTP requests per phone/email per hour |
| Provider abstraction | Use `SmsProvider` / `EmailProvider` interfaces. Console stub in development. |

### 5.2 Session Policy

| Parameter | Value |
|-----------|-------|
| Access token type | JWT (HS256) |
| Access token TTL | 15 minutes |
| Refresh token type | Opaque (stored in DB) |
| Refresh token TTL | 30 days |
| Refresh rotation | New refresh token issued on every refresh. Old token invalidated. |
| Cookie flags | `httpOnly: true`, `secure: true` (production), `sameSite: lax`, `path: /` |
| Token revocation | Increment `token_version` on user record. All refresh tokens for that user become invalid. |

### 5.3 Password Policy

| Rule | Specification |
|------|--------------|
| Minimum length | 12 characters |
| Complexity | At least 1 uppercase, 1 lowercase, 1 digit, 1 special character |
| Validation | Zod schema: `z.string().min(12).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)` |
| Hashing | bcrypt with cost factor 12 |
| Strength meter | Display on frontend during registration and password change |
| Breach check (optional) | Check against Have I Been Pwned API (k-anonymity model) |

### 5.4 Audit Logs

| What to Log | Fields |
|-------------|--------|
| All authentication events | `timestamp`, `userId`, `action` (LOGIN, LOGOUT, REGISTER, PASSWORD_CHANGE, OTP_SEND, OTP_VERIFY), `ipAddress`, `userAgent`, `success` (boolean) |
| All admin mutations | `timestamp`, `userId`, `action` (CREATE, UPDATE, DELETE), `resourceType`, `resourceId`, `previousValue` (JSON), `newValue` (JSON), `ipAddress` |
| All payment events | `timestamp`, `userId`, `action`, `paymentId`, `amount`, `currency`, `status`, `provider` |
| All webhook deliveries | `timestamp`, `eventId`, `eventType`, `targetUrl`, `statusCode`, `duration`, `retryCount` |

**Rules:**

- Audit logs are append-only. Never delete or modify.
- No secrets, passwords, or tokens in logs. Mask sensitive fields: `email` → `a***@example.com`, `phone` → `+966****6528`.
- Store in a separate table (`audit_log`) with indexes on `userId`, `action`, `createdAt`.
- Retain for minimum 2 years (PDPL compliance).

### 5.5 CI/CD Checks Required

Every sister product's CI pipeline MUST include:

1. **Lint** (`eslint`) — zero warnings policy
2. **TypeScript** (`tsc --noEmit`) — zero errors
3. **Unit tests** (`vitest`) — all pass
4. **Dependency audit** (`pnpm audit --audit-level=high`) — zero high/critical
5. **License check** (`license-checker --failOn "GPL-3.0;AGPL-3.0"`) — no copyleft in production deps
6. **Secret scan** (TruffleHog or similar) — zero secrets in code
7. **No proprietary check** — grep for `Monthly Key`, `Monthly Keycdn`, `Monthly Key.im` in runtime code paths

---

## 6. Architecture Constraints

### 6.1 Hard Constraints

1. **Same JWT Secret:** Use the same `JWT_SECRET` env var as MonthlyKey. Tokens issued by MonthlyKey must be valid in the sister product.
2. **Reference MonthlyKey Users by ID:** Do NOT create a separate users table. Use Hub API to fetch user data. Store `mkUserId` as a foreign reference.
3. **Arabic-First:** All UI text must have Arabic translations. RTL layout is the default. Use `useI18n()` hook pattern.
4. **Mobile-First:** Design for mobile viewport first. Test on iPhone Safari and Android Chrome.
5. **Railway Deployment:** Docker-based deployment on Railway. Use persistent volumes for file uploads.
6. **No Hardcoded URLs:** All external URLs must be environment variables.
7. **Zod Validation:** All API inputs must be validated with Zod schemas.
8. **Error Boundaries:** Every page component must have an error boundary.
9. **No Monthly Key Dependencies:** No `Monthly Keycdn`, no the platform automations, no Monthly Key-specific services.

### 6.2 Soft Constraints (Strongly Recommended)

1. Use tRPC for type-safe API calls (matches MonthlyKey pattern).
2. Use Drizzle ORM for database access (matches MonthlyKey pattern).
3. Use shadcn/ui components (matches MonthlyKey UI library).
4. Use sonner for toast notifications (matches MonthlyKey pattern).
5. Use Lucide icons (matches MonthlyKey icon library).
6. Use wouter for client-side routing (matches MonthlyKey router).
7. Use pino for structured logging (target state for MonthlyKey).

---

## 7. Database Schema Conventions

When defining new tables for a sister product, follow these conventions:

```typescript
import { mysqlTable, int, varchar, text, json, timestamp, mysqlEnum, decimal } from "drizzle-orm/mysql-core";

// Table naming: product prefix + snake_case concept
// Column naming: camelCase
export const {{prefix}}_orders = mysqlTable("{{prefix}}_orders", {
  id: int("id").autoincrement().primaryKey(),

  // Foreign key to MonthlyKey users (always reference by ID)
  userId: int("userId").notNull(),

  // Foreign key to MonthlyKey properties (if applicable)
  mkPropertyId: int("mkPropertyId"),

  // Foreign key to MonthlyKey bookings (if applicable)
  mkBookingId: int("mkBookingId"),

  // Bilingual fields pattern
  title: varchar("title", { length: 255 }).notNull(),
  titleAr: varchar("titleAr", { length: 255 }),
  description: text("description"),
  descriptionAr: text("descriptionAr"),

  // Status enum pattern
  status: mysqlEnum("status", ["pending", "active", "completed", "cancelled"])
    .default("pending").notNull(),

  // Price pattern (store as decimal string in SAR)
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("SAR").notNull(),

  // JSON fields for flexible data
  metadata: json("metadata").$type<Record<string, unknown>>(),
  imageUrls: json("imageUrls").$type<string[]>(),

  // Timestamps (always include both)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
```

**Rules:**

- Table prefix matches product name: `cobnb_`, `clean_`, `furnish_`, etc.
- Always include `createdAt` and `updatedAt` timestamps.
- Always include `id` as auto-incrementing primary key.
- Reference MonthlyKey entities with `mk` prefix: `mkUserId`, `mkPropertyId`, `mkBookingId`.
- Use `decimal(10,2)` for monetary amounts, not `int` (halalat) — consistency with MonthlyKey.
- Add foreign key constraints and indexes from day one (unlike MonthlyKey's current state).

---

## 8. API Contract Templates

### 8.1 tRPC Router Template

```typescript
import { router, protectedProcedure, publicProcedure } from "./trpc";
import { z } from "zod";

export const {{routerName}}Router = router({
  // Public: list items with pagination
  list: publicProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      status: z.enum(["pending", "active", "completed"]).optional(),
    }))
    .query(async ({ input }) => {
      // Implementation
    }),

  // Protected: create item
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      titleAr: z.string().min(1).max(255).optional(),
      description: z.string().min(1),
      mkPropertyId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // ctx.user is available from JWT
    }),

  // Protected: update item
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["pending", "active", "completed"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Implementation
    }),
});
```

### 8.2 Hub API Client Template

```typescript
// lib/hub-api.ts — calling MonthlyKey Hub API from sister product
const HUB_API_URL = process.env.HUB_API_URL!;
const HUB_API_KEY = process.env.HUB_API_KEY!;

interface HubApiOptions {
  method?: string;
  body?: unknown;
  token?: string; // User JWT for user-context requests
  idempotencyKey?: string;
}

async function hubApi<T>(path: string, options: HubApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": HUB_API_KEY,
  };
  if (options.token) headers["Authorization"] = `Bearer ${options.token}`;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  const res = await fetch(`${HUB_API_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`Hub API ${res.status}: ${error.message}`);
  }
  return res.json();
}

// Usage examples:
export const hubProperties = {
  list: (filters?: Record<string, string>) =>
    hubApi<Property[]>(`/properties?${new URLSearchParams(filters)}`),
  get: (id: number) => hubApi<Property>(`/properties/${id}`),
  calendar: (id: number, start: string, end: string) =>
    hubApi<CalendarDay[]>(`/properties/${id}/calendar?start=${start}&end=${end}`),
};

export const hubBookings = {
  create: (data: CreateBookingInput, idempotencyKey: string, token: string) =>
    hubApi<Booking>("/bookings", { method: "POST", body: data, idempotencyKey, token }),
  get: (id: number, token: string) =>
    hubApi<Booking>(`/bookings/${id}`, { token }),
};
```

### 8.3 Webhook Receiver Template

```typescript
// routes/webhooks.ts — receiving MonthlyKey webhook events
import crypto from "crypto";
import { Router } from "express";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;

function verifySignature(payload: string, signature: string): boolean {
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

const router = Router();

router.post("/webhooks/monthlykey", async (req, res) => {
  const signature = req.headers["x-webhook-signature"] as string;
  const rawBody = JSON.stringify(req.body);

  if (!signature || !verifySignature(rawBody, signature)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const { eventId, event, ...payload } = req.body;

  // Idempotency check
  const alreadyProcessed = await db.query.webhookEvents.findFirst({
    where: eq(webhookEvents.eventId, eventId),
  });
  if (alreadyProcessed) {
    return res.status(200).json({ status: "already_processed" });
  }

  // Store event for idempotency
  await db.insert(webhookEvents).values({ eventId, event, payload, processedAt: new Date() });

  // Route to handler
  switch (event) {
    case "booking.created": await handleBookingCreated(payload); break;
    case "tenant.checkout": await handleTenantCheckout(payload); break;
    case "maintenance.created": await handleMaintenanceCreated(payload); break;
    default: console.log(`Unhandled event: ${event}`);
  }

  res.status(200).json({ status: "processed" });
});
```

---

## 9. Design System & Branding

### 9.1 MonthlyKey Color Palette

Sister products should use their own brand colors but maintain compatibility with MonthlyKey's palette for shared components.

```css
/* MonthlyKey Brand Colors — reference for shared UI */
:root {
  --mk-primary: #3ECFC0;        /* Teal — primary actions, CTAs */
  --mk-primary-hover: #2AB5A6;  /* Darker teal — hover states */
  --mk-dark: #0B1E2D;           /* Navy — backgrounds, text */
  --mk-dark-lighter: #132D3F;   /* Lighter navy — cards on dark bg */
  --mk-accent: #F59E0B;         /* Amber — warnings, highlights */
  --mk-success: #10B981;        /* Green — success states */
  --mk-danger: #EF4444;         /* Red — errors, destructive */
  --mk-muted: #64748B;          /* Slate — secondary text */
  --mk-border: #1E3A4F;         /* Dark border */
}
```

### 9.2 Typography

```css
/* Arabic-first font stack — use in all sister products */
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');

:root {
  --font-heading: 'IBM Plex Sans Arabic', 'Inter', sans-serif;
  --font-body: 'IBM Plex Sans Arabic', 'Inter', sans-serif;
}
```

### 9.3 Component Patterns

```tsx
// Primary Button
<Button className="bg-[var(--mk-primary)] text-[var(--mk-dark)] hover:bg-[var(--mk-primary-hover)] border-0 font-semibold">
  {label}
</Button>

// Card Pattern
<Card className="border-[var(--mk-border)] bg-[var(--mk-dark-lighter)]">
  <CardContent className="p-6">{/* content */}</CardContent>
</Card>

// Loading State
<Loader2 className="h-8 w-8 animate-spin text-[var(--mk-primary)]" />
```

---

## 10. Deployment & DevOps

### 10.1 Railway Configuration

```toml
# railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "./start.sh"
healthcheckPath = "/api/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[[deploy.volumes]]
mountPath = "/app/uploads"
name = "uploads-volume"
```

### 10.2 Dockerfile Template

```dockerfile
FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/package.json ./
COPY --from=build /app/start.sh ./
RUN chmod +x start.sh
RUN mkdir -p /app/uploads && chmod 777 /app/uploads
ENV UPLOAD_DIR=/app/uploads
EXPOSE ${PORT:-3000}
CMD ["./start.sh"]
```

### 10.3 Start Script

```bash
#!/bin/sh
echo "[Start] Running database migrations..."
npx drizzle-kit migrate 2>&1 || echo "[Start] Migration failed or already applied"
echo "[Start] Starting server..."
exec node dist/index.js
```

---

## 11. DO NOT BREAK Guardrails

Include these guardrails in every sister-product prompt to protect the MonthlyKey ecosystem:

1. **NEVER modify MonthlyKey's database tables directly.** Use Hub API or create your own tables with a product prefix.
2. **NEVER change the JWT secret or token format.** Sister products MUST accept MonthlyKey-issued tokens as-is.
3. **NEVER expose MonthlyKey internal APIs publicly.** All cross-product communication goes through the Hub API.
4. **NEVER store passwords in plaintext.** Use bcrypt with cost factor 12 or higher.
5. **NEVER disable CORS or CSP headers.** Follow the same security header pattern as MonthlyKey.
6. **NEVER use synchronous file I/O in request handlers.** Use async/await for all file operations.
7. **NEVER return stack traces in production error responses.** Log internally, return generic error messages to clients.
8. **NEVER hardcode the MonthlyKey domain or API URLs.** Always use environment variables.
9. **ALWAYS validate webhook signatures** before processing events.
10. **ALWAYS include rate limiting** on public-facing endpoints.
11. **NEVER use the platform automations, Monthly Keycdn, or any Monthly Key-specific services.**
12. **NEVER introduce paid dependencies** without explicit approval from the project owner.

---

## 12. Example: Cobnb KSA

### 12.1 Overview

**Cobnb KSA** (كوبنب السعودية) is a short-term rental marketplace for Saudi Arabia, similar to Airbnb but localized for the Saudi market. It integrates with MonthlyKey to share property inventory, availability, and booking data via the Hub API and Beds24 SDK.

### 12.2 Pages

| Page | Route | Auth | Description |
|------|-------|------|-------------|
| Home | `/` | Public | Hero search bar (city, dates, guests), featured properties, popular cities |
| Search Results | `/search` | Public | Property grid/list with filters (city, price, type, amenities), map view |
| Property Detail | `/property/:id` | Public | Photos gallery, description (AR/EN), amenities, availability calendar, pricing, reviews, host info, WhatsApp CTA, map |
| Booking Flow | `/book/:id` | Required | Date selection, guest count, price breakdown, payment (PayPal/bank), terms acceptance |
| Guest Dashboard | `/dashboard` | Required (tenant) | My bookings (upcoming, past, cancelled), messages, favorites, profile |
| Host Dashboard | `/host` | Required (landlord) | My properties, booking requests, earnings, calendar management, reviews |
| Admin Panel | `/admin` | Required (admin) | Users, properties, bookings, payments, analytics, settings, feature flags |
| Login | `/login` | Public | Phone/email + password. OTP verification option. |
| Register | `/register` | Public | Name, phone, email, password. Role selection (guest/host). |
| About | `/about` | Public | Company info, team, mission |
| Contact | `/contact` | Public | Contact form, WhatsApp link, office address |
| Privacy Policy | `/privacy` | Public | PDPL-compliant privacy policy |
| Terms | `/terms` | Public | Terms of service |

### 12.3 Entities

| Entity | Table | Key Fields |
|--------|-------|-----------|
| Property (cached from Hub) | `cobnb_properties_cache` | `mkPropertyId`, `titleAr`, `titleEn`, `type`, `city`, `district`, `nightlyPrice`, `monthlyPrice`, `images`, `amenities`, `latitude`, `longitude`, `lastSyncedAt` |
| Booking | Created via Hub API | `mkBookingId` reference stored locally for tracking |
| Review | `cobnb_reviews` | `id`, `mkBookingId`, `guestId`, `hostId`, `rating`, `commentAr`, `commentEn`, `createdAt` |
| Favorite | `cobnb_favorites` | `id`, `userId`, `mkPropertyId`, `createdAt` |
| Host Profile | `cobnb_host_profiles` | `id`, `mkUserId`, `bioAr`, `bioEn`, `responseRate`, `responseTime`, `superhost`, `verifiedAt` |
| Payout | `cobnb_payouts` | `id`, `hostId`, `mkBookingId`, `amount`, `currency`, `status`, `bankAccount`, `processedAt` |

### 12.4 Integrations

| Integration | Method | Details |
|-------------|--------|---------|
| **Property sync** | Hub API + webhook | Fetch properties on startup. Subscribe to `property.updated` webhook for real-time updates. Cache locally with 5-minute TTL. |
| **Availability** | Hub API | Call `/properties/:id/calendar` on property detail page load. Show calendar with available/unavailable dates. |
| **Booking** | Hub API | `POST /bookings` with idempotency key. Subscribe to `booking.approved`, `booking.cancelled` webhooks. |
| **Beds24** | Via Hub API only | Cobnb does NOT call Beds24 directly. Hub API handles all Beds24 synchronization. |
| **WhatsApp** | Backend flag | Floating button on property pages. Per-property message: "مرحباً، أنا مهتم بالعقار: {{property_title}} في {{city}}". |
| **Maps** | Google Maps via proxy | Property location on detail page. Search results map view. Geocoding for address input. |
| **Payments** | PayPal + bank transfer | PayPal for instant payment. Bank transfer for manual confirmation. Payout to hosts via bank transfer. |

### 12.5 Role Model

| Role | Permissions |
|------|------------|
| **Guest (tenant)** | Search properties, view details, book, pay, message host, leave reviews, manage favorites, submit maintenance requests |
| **Host (landlord)** | List properties (via MonthlyKey), manage bookings (approve/reject), respond to messages, view earnings, manage calendar, respond to reviews |
| **Admin** | All of the above + user management, property moderation, payment oversight, analytics, feature flags, settings |

### 12.6 WhatsApp & Maps Behavior

**WhatsApp:**
- Floating button appears on: Home, Search, Property Detail pages.
- Hidden on: Login, Register, Booking Flow, Admin pages.
- Property Detail page has an additional "تواصل عبر واتساب" CTA in the booking card.
- Message template (AR): `مرحباً، أنا مهتم بالعقار: {{property_title}} (رقم: {{property_id}}) في {{city}}. الرابط: {{url}}`
- Message template (EN): `Hello, I'm interested in: {{property_title}} (ID: {{property_id}}) in {{city}}. Link: {{url}}`

**Maps:**
- Property Detail: Full-width map showing property location with marker.
- Search Results: Split view — property list on left, map on right (desktop). Toggle between list and map on mobile.
- Booking Confirmation: Small map showing property location with directions link.

---

## 13. Example: Cleaning & Maintenance Company

### 13.1 Overview

**MK Clean** (إم كي كلين) is a professional cleaning and maintenance service marketplace for MonthlyKey properties. It connects tenants and landlords with vetted cleaning providers, and integrates with MonthlyKey's maintenance ticket system for seamless service dispatch.

### 13.2 Service Booking Flow

```
1. Tenant/Landlord opens MK Clean app
2. Selects service type:
   - Regular cleaning (تنظيف دوري)
   - Deep cleaning (تنظيف عميق)
   - Move-in cleaning (تنظيف استلام)
   - Move-out cleaning (تنظيف تسليم)
   - AC maintenance (صيانة مكيفات)
   - Plumbing (سباكة)
   - Electrical (كهرباء)
3. Selects property (auto-populated from MonthlyKey bookings)
4. Selects date/time slot
5. Adds notes and photos (optional)
6. Reviews price estimate
7. Confirms and pays
8. Provider receives notification and accepts
9. Provider arrives, completes work, uploads completion photos
10. Customer rates and reviews
```

### 13.3 Pages

| Page | Route | Auth | Description |
|------|-------|------|-------------|
| Home | `/` | Public | Service categories, featured providers, how it works, pricing |
| Service Catalog | `/services` | Public | All service types with descriptions, pricing, estimated duration |
| Book Service | `/book` | Required | Multi-step form: service type → property → date/time → notes → payment |
| Order Tracking | `/orders/:id` | Required | Real-time status, provider info, ETA, completion photos |
| Customer Dashboard | `/dashboard` | Required (tenant/landlord) | My orders, upcoming services, past orders, favorites providers |
| Provider Dashboard | `/provider` | Required (provider) | Available jobs, accepted jobs, schedule, earnings, ratings |
| Provider Profile | `/provider/:id` | Public | Bio, ratings, reviews, services offered, availability |
| Admin Panel | `/admin` | Required (admin) | Providers, orders, pricing, analytics, dispatch, settings |
| Login | `/login` | Public | Phone/email + password |
| Register | `/register` | Public | Name, phone, email, password. Role: customer or provider. |

### 13.4 Dispatch & Technician Flow

```
Order Created → Status: PENDING
  ↓
System finds available providers (by service type, location, rating)
  ↓
Notification sent to top 3 providers
  ↓
Provider accepts → Status: ACCEPTED
  ↓
Provider en route → Status: EN_ROUTE (optional GPS tracking)
  ↓
Provider arrives → Status: IN_PROGRESS
  ↓
Provider completes work → Status: COMPLETED
  ↓
Provider uploads completion photos
  ↓
Customer reviews → Status: REVIEWED
  ↓
Payment released to provider → Status: PAID
```

**Dispatch rules:**

| Rule | Details |
|------|---------|
| **Provider matching** | Match by: service type capability, city/district, availability, rating (descending) |
| **Acceptance timeout** | Provider has 15 minutes to accept. After timeout, offer to next provider. |
| **Max offers** | Maximum 5 providers offered per order. If none accept, escalate to admin. |
| **Emergency orders** | Skip matching queue. Notify all available providers simultaneously. |
| **Recurring orders** | Assign to same provider if available. Otherwise, match by rating. |

### 13.5 Entities

| Entity | Table | Key Fields |
|--------|-------|-----------|
| Provider | `clean_providers` | `id`, `mkUserId`, `nameAr`, `nameEn`, `phone`, `services` (JSON array), `cityId`, `districtId`, `rating`, `completedOrders`, `isActive`, `isVerified`, `bankAccount` |
| Service Type | `clean_services` | `id`, `nameAr`, `nameEn`, `descriptionAr`, `descriptionEn`, `basePrice`, `estimatedDuration`, `category` (cleaning/maintenance), `isActive` |
| Order | `clean_orders` | `id`, `customerId`, `mkPropertyId`, `mkBookingId`, `serviceId`, `providerId`, `status`, `scheduledAt`, `completedAt`, `totalPrice`, `notes`, `photos` (JSON), `completionPhotos` (JSON) |
| Order Item | `clean_order_items` | `id`, `orderId`, `serviceId`, `quantity`, `unitPrice`, `subtotal` |
| Review | `clean_reviews` | `id`, `orderId`, `customerId`, `providerId`, `rating`, `commentAr`, `commentEn` |
| Schedule | `clean_schedules` | `id`, `customerId`, `mkPropertyId`, `serviceId`, `frequency` (weekly/biweekly/monthly), `preferredDay`, `preferredTime`, `isActive` |
| Payout | `clean_payouts` | `id`, `providerId`, `orderId`, `amount`, `status`, `processedAt` |

### 13.6 Maintenance Tickets Integration with MonthlyKey

MK Clean subscribes to MonthlyKey's maintenance webhook events to automatically create service orders.

| MonthlyKey Event | MK Clean Action |
|-----------------|----------------|
| `maintenance.created` with category "cleaning" | Auto-create a cleaning order. Notify matching providers. |
| `maintenance.created` with category "plumbing" | Auto-create a plumbing order. Notify matching providers. |
| `maintenance.created` with category "electrical" | Auto-create an electrical order. Notify matching providers. |
| `maintenance.created` with urgency "emergency" | Create emergency order. Notify ALL available providers in the area. |
| `maintenance.resolved` | Update corresponding MK Clean order status. Trigger payout if applicable. |
| `tenant.checkout` | Auto-suggest move-out cleaning to landlord. Create draft order. |
| `booking.approved` | Auto-suggest move-in cleaning to tenant. Create draft order. |

**Integration flow:**

```
MonthlyKey Maintenance Ticket Created
  ↓
Webhook: POST /webhooks/monthlykey
  ↓
Verify signature + idempotency check
  ↓
Map category to MK Clean service type
  ↓
Create clean_order with mkTicketId reference
  ↓
Dispatch to providers
  ↓
Provider completes work
  ↓
MK Clean calls Hub API: PATCH /maintenance/:ticketId
  → Update status to "resolved" with resolution notes
```

### 13.7 WhatsApp Support Templates

| Template | Arabic | English |
|----------|--------|---------|
| **Order confirmation** | `تم تأكيد طلبك رقم {{order_id}}. الخدمة: {{service_name}}. الموعد: {{date}} الساعة {{time}}. مزود الخدمة: {{provider_name}}. للاستفسار: {{support_url}}` | `Your order #{{order_id}} is confirmed. Service: {{service_name}}. Date: {{date}} at {{time}}. Provider: {{provider_name}}. Questions: {{support_url}}` |
| **Provider assigned** | `تم تعيين مزود خدمة لطلبك رقم {{order_id}}. الاسم: {{provider_name}}. الهاتف: {{provider_phone}}. الوصول المتوقع: {{eta}}.` | `A provider has been assigned to order #{{order_id}}. Name: {{provider_name}}. Phone: {{provider_phone}}. ETA: {{eta}}.` |
| **Service completed** | `تم إنجاز الخدمة لطلبك رقم {{order_id}}. يرجى تقييم الخدمة: {{review_url}}` | `Service completed for order #{{order_id}}. Please rate: {{review_url}}` |
| **Emergency dispatch** | `طلب طوارئ رقم {{order_id}} في {{property_address}}. النوع: {{service_type}}. يرجى القبول فوراً: {{accept_url}}` | `Emergency order #{{order_id}} at {{property_address}}. Type: {{service_type}}. Accept now: {{accept_url}}` |
| **Recurring reminder** | `تذكير: خدمة {{service_name}} المجدولة غداً {{date}} الساعة {{time}} للعقار {{property_title}}.` | `Reminder: {{service_name}} scheduled tomorrow {{date}} at {{time}} for {{property_title}}.` |
| **General support** | `مرحباً، أحتاج مساعدة بخصوص طلب رقم {{order_id}}. {{custom_message}}` | `Hello, I need help with order #{{order_id}}. {{custom_message}}` |

### 13.8 User Roles

| Role | Permissions |
|------|------------|
| **Customer (tenant/landlord)** | Browse services, book, pay, track orders, rate providers, manage recurring schedules, view order history |
| **Provider (technician)** | View available jobs, accept/reject, update status, upload photos, view earnings, manage availability |
| **Admin** | All of the above + provider verification, pricing management, dispatch override, analytics, payouts, settings |

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-25 | the platform | Initial template |
| 2.0 | 2026-02-26 | the platform | Added: Integration Contract (Section 2), Mandatory UX Rules (Section 3), Feature Flags (Section 4), Security Baseline (Section 5), Cobnb KSA example (Section 12), Cleaning Company example (Section 13). Updated: Quick-Start Prompt with new placeholders, Architecture Constraints, Database Conventions. |

---

*This template is maintained in the MonthlyKey repository at `docs/SISTER_PRODUCT_PROMPT_TEMPLATE.md`. Update it whenever the MonthlyKey architecture, API contracts, or conventions change.*
