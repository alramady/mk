# Sister-Product Website — Reusable Prompt Template

> **Purpose**: This document is a ready-to-use prompt template for instructing any AI coding agent (Manus, Cursor, Claude, etc.) to build a new product website that integrates with the MonthlyKey ecosystem. Copy the relevant sections, fill in the `{{placeholders}}`, and paste into your agent.

---

## Table of Contents

1. [Quick-Start Prompt (Copy & Paste)](#1-quick-start-prompt)
2. [MonthlyKey Ecosystem Context](#2-monthlykey-ecosystem-context)
3. [Integration Points Reference](#3-integration-points-reference)
4. [Architecture Constraints](#4-architecture-constraints)
5. [Database Schema Conventions](#5-database-schema-conventions)
6. [API Contract Templates](#6-api-contract-templates)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Design System & Branding](#8-design-system--branding)
9. [Deployment & DevOps](#9-deployment--devops)
10. [DO NOT BREAK Guardrails](#10-do-not-break-guardrails)
11. [Example: Cleaning Service Product](#11-example-cleaning-service-product)

---

## 1. Quick-Start Prompt

Copy the block below, replace every `{{...}}` placeholder, and paste it into your AI agent:

```markdown
# Project: {{PRODUCT_NAME}}

## Overview
Build a production-ready web application for **{{PRODUCT_NAME}}** — {{ONE_LINE_DESCRIPTION}}.
This product is part of the **MonthlyKey ecosystem** and must integrate with the MonthlyKey
platform via its Hub API and shared authentication.

## Tech Stack (MUST match MonthlyKey)
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4 + shadcn/ui + Radix UI
- **Backend**: Express.js + tRPC v11 + Drizzle ORM
- **Database**: MySQL 8 (shared or separate instance — see constraints below)
- **Auth**: JWT-based (HS256), compatible with MonthlyKey's auth system
- **Styling**: Tailwind CSS with MonthlyKey brand tokens (see Design System section)
- **i18n**: Arabic (RTL) + English, Arabic-first
- **Deployment**: Railway (Docker) with persistent volume for uploads

## MonthlyKey Integration
This product connects to MonthlyKey via:
1. **Hub API** (`https://{{HUB_API_DOMAIN}}/api/v1/`) — for cross-product data exchange
2. **Shared Auth** — JWT tokens issued by MonthlyKey are accepted by this product
3. **Beds24 SDK** — if this product needs PMS data, use the shared `@mk/beds24-sdk` package
4. **Webhook Events** — subscribe to MonthlyKey events: {{LIST_EVENTS_NEEDED}}

## Core Features
{{LIST_CORE_FEATURES}}

## User Roles
{{LIST_USER_ROLES_AND_PERMISSIONS}}

## Pages Required
{{LIST_PAGES}}

## API Endpoints Required
{{LIST_API_ENDPOINTS}}

## Database Tables Required
{{LIST_TABLES_WITH_COLUMNS}}

## Integration Endpoints (MonthlyKey ↔ This Product)
{{LIST_INTEGRATION_ENDPOINTS}}

## Non-Functional Requirements
- Response time: < 200ms for API calls, < 3s for page load
- Mobile-first responsive design
- WCAG 2.1 AA accessibility
- Rate limiting on all public endpoints
- Input validation with Zod on both client and server
- Error boundaries on all page components

## Constraints
- MUST NOT break any existing MonthlyKey functionality
- MUST use the same JWT secret as MonthlyKey for token verification
- MUST follow the same database naming conventions (camelCase columns, snake_case tables)
- MUST support Arabic RTL layout as the primary language
- MUST use the MonthlyKey color palette and typography system
```

---

## 2. MonthlyKey Ecosystem Context

Provide this context block to any agent working on a sister product:

```markdown
### What is MonthlyKey?
MonthlyKey is a monthly rental management platform for Saudi Arabia. It handles:
- Property listing and search (with city/district filtering)
- Booking flow (request → approval → payment → check-in)
- Tenant and landlord dashboards
- Maintenance requests (regular + emergency)
- Lease contract generation (PDF)
- AI-powered assistant (property Q&A, knowledge base)
- Payment processing (PayPal, bank transfer)
- Push notifications (web push via VAPID)
- Admin panel with role-based permissions
- Beds24 PMS integration for availability/booking sync
- Property manager assignments and inspection workflows

### Architecture
MonthlyKey is a monorepo with:
- `client/` — React 19 SPA (Vite, Tailwind 4, shadcn/ui)
- `server/` — Express + tRPC API server
- `drizzle/` — Database schema and migrations (MySQL 8)
- `packages/beds24-sdk/` — Shared Beds24 API wrapper
- `services/hub-api/` — Cross-product integration hub
- `services/cobnb-adapter-api/` — Cobnb channel adapter
- `services/monthlykey-adapter-api/` — MonthlyKey adapter for Hub
- `services/worker/` — Background job processor

### Database (32 tables)
Key tables: users, properties, propertyAvailability, bookings, payments,
conversations, messages, maintenanceRequests, reviews, notifications,
emergencyMaintenance, maintenanceUpdates, cities, districts,
propertyManagers, propertyManagerAssignments, inspectionRequests,
platformSettings, platformServices, serviceRequests, knowledgeBase,
aiConversations, aiMessages, aiDocuments, pushSubscriptions, roles,
adminPermissions, userActivities, savedSearches, contactMessages, favorites

### tRPC Router Namespaces
auth, property, favorite, booking, payment, message, maintenance,
notification, review, savedSearch, admin, siteSettings, ai, knowledge,
lease, activity, permissions, cities, districts, emergencyMaintenance
```

---

## 3. Integration Points Reference

When building a sister product, these are the available integration mechanisms:

### 3.1 Hub API

The Hub API (`services/hub-api/`) is the central integration point. It exposes REST endpoints for cross-product communication.

```
Base URL: https://{{HUB_API_DOMAIN}}/api/v1/

Available Endpoints:
GET    /health                    — Health check
GET    /ready                     — Readiness check (DB + Beds24)
GET    /properties                — List properties (with filters)
GET    /properties/:id            — Get property details
GET    /properties/:id/calendar   — Get availability calendar
POST   /bookings                  — Create a booking
GET    /bookings/:id              — Get booking details
PATCH  /bookings/:id              — Update booking status
GET    /guests/:id                — Get guest profile
POST   /webhooks/subscribe        — Subscribe to events
DELETE /webhooks/subscribe/:id    — Unsubscribe from events
```

### 3.2 Webhook Events

MonthlyKey emits these events that sister products can subscribe to:

| Event | Payload | When |
|-------|---------|------|
| `booking.created` | `{ bookingId, propertyId, tenantId, checkIn, checkOut }` | New booking created |
| `booking.approved` | `{ bookingId, propertyId }` | Landlord approves booking |
| `booking.cancelled` | `{ bookingId, reason }` | Booking cancelled |
| `payment.completed` | `{ paymentId, bookingId, amount, method }` | Payment confirmed |
| `property.updated` | `{ propertyId, changes[] }` | Property details changed |
| `maintenance.created` | `{ ticketId, propertyId, urgency, category }` | New maintenance request |
| `maintenance.resolved` | `{ ticketId, resolution }` | Maintenance resolved |
| `tenant.checkin` | `{ bookingId, tenantId, propertyId }` | Tenant checks in |
| `tenant.checkout` | `{ bookingId, tenantId, propertyId }` | Tenant checks out |

### 3.3 Beds24 SDK

If the sister product needs PMS data:

```typescript
import { Beds24Client } from "@mk/beds24-sdk";

const client = new Beds24Client({
  refreshToken: process.env.BEDS24_REFRESH_TOKEN,
});

// Available methods:
await client.getProperties();
await client.getProperty(id);
await client.getAvailability(propertyId, startDate, endDate);
await client.getBookings(filters);
await client.createBooking(data);
await client.getGuest(guestId);
```

### 3.4 Shared Database Access

Sister products can either:

**Option A: Separate database** (recommended for isolation)
- Own MySQL instance on Railway
- Sync data via Hub API webhooks
- Use a `mk_` prefix for any shared reference columns

**Option B: Shared database** (for tightly coupled products)
- Same MySQL instance as MonthlyKey
- New tables with product-specific prefix (e.g., `cleaning_`, `furnish_`)
- Read-only access to MonthlyKey tables via views
- MUST NOT modify MonthlyKey tables directly

---

## 4. Architecture Constraints

Include these constraints in every sister-product prompt:

```markdown
### Hard Constraints
1. **Same JWT Secret**: Use the same JWT_SECRET env var as MonthlyKey.
   Tokens issued by MonthlyKey must be valid in the sister product.
2. **Same User Table**: Reference MonthlyKey's `users` table by ID.
   Do NOT create a separate users table. Use Hub API to fetch user data.
3. **Arabic-First**: All UI text must have Arabic translations.
   RTL layout is the default. Use `useI18n()` hook pattern.
4. **Mobile-First**: Design for mobile viewport first.
   Test on iPhone Safari and Android Chrome.
5. **Railway Deployment**: Docker-based deployment on Railway.
   Use persistent volumes for file uploads.
6. **No Hardcoded URLs**: All external URLs must be environment variables.
7. **Zod Validation**: All API inputs must be validated with Zod schemas.
8. **Error Boundaries**: Every page component must have an error boundary.

### Soft Constraints (Strongly Recommended)
1. Use tRPC for type-safe API calls (matches MonthlyKey pattern)
2. Use Drizzle ORM for database access (matches MonthlyKey pattern)
3. Use shadcn/ui components (matches MonthlyKey UI library)
4. Use sonner for toast notifications (matches MonthlyKey pattern)
5. Use Lucide icons (matches MonthlyKey icon library)
6. Use wouter for client-side routing (matches MonthlyKey router)
```

---

## 5. Database Schema Conventions

When defining new tables for a sister product, follow these conventions:

```typescript
// Naming: snake_case for table names, camelCase for column names
export const {{prefix}}_orders = mysqlTable("{{prefix}}_orders", {
  id: int("id").autoincrement().primaryKey(),
  
  // Foreign key to MonthlyKey users (always reference by ID)
  userId: int("userId").notNull(),
  
  // Foreign key to MonthlyKey properties (if applicable)
  propertyId: int("propertyId"),
  
  // Foreign key to MonthlyKey bookings (if applicable)
  bookingId: int("bookingId"),
  
  // Bilingual fields pattern
  title: varchar("title", { length: 255 }).notNull(),
  titleAr: varchar("titleAr", { length: 255 }),
  description: text("description"),
  descriptionAr: text("descriptionAr"),
  
  // Status enum pattern
  status: mysqlEnum("status", ["pending", "active", "completed", "cancelled"])
    .default("pending").notNull(),
  
  // Price pattern (store in halalat/cents, display in SAR)
  amount: int("amount").notNull(), // in halalat (1 SAR = 100 halalat)
  currency: varchar("currency", { length: 3 }).default("SAR").notNull(),
  
  // JSON fields for flexible data
  metadata: json("metadata").$type<Record<string, any>>(),
  imageUrls: json("imageUrls").$type<string[]>(),
  
  // Timestamps (always include both)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
```

---

## 6. API Contract Templates

### 6.1 tRPC Router Template

```typescript
import { router, protectedProcedure, publicProcedure } from "./trpc";
import { z } from "zod";

export const {{routerName}}Router = router({
  // Public: list items
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
      titleAr: z.string().optional(),
      description: z.string().min(1),
      propertyId: z.number(),
      // ... other fields
    }))
    .mutation(async ({ ctx, input }) => {
      // ctx.user is available from JWT
      // Implementation
    }),

  // Protected: update item
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["pending", "active", "completed"]).optional(),
      // ... other fields
    }))
    .mutation(async ({ ctx, input }) => {
      // Implementation
    }),
});
```

### 6.2 Hub API Integration Template

```typescript
// In your server code — calling MonthlyKey Hub API
const HUB_API_URL = process.env.HUB_API_URL || "http://localhost:4000/api/v1";

async function getPropertyFromHub(propertyId: number) {
  const res = await fetch(`${HUB_API_URL}/properties/${propertyId}`, {
    headers: { "Authorization": `Bearer ${process.env.HUB_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Hub API error: ${res.status}`);
  return res.json();
}

async function subscribeToWebhook(event: string, callbackUrl: string) {
  const res = await fetch(`${HUB_API_URL}/webhooks/subscribe`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.HUB_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ event, callbackUrl }),
  });
  return res.json();
}
```

---

## 7. Authentication & Authorization

### JWT Token Structure (MonthlyKey-issued)

```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "Ahmed",
  "role": "tenant",
  "iat": 1700000000,
  "exp": 1700086400
}
```

### Middleware Template

```typescript
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

// Verify MonthlyKey-issued tokens
function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as {
    id: number;
    email: string;
    name: string;
    role: "admin" | "landlord" | "tenant" | "agent";
  };
}

// Express middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
```

### Role Hierarchy

| Role | Level | Can Access |
|------|-------|------------|
| `admin` | 4 | Everything |
| `landlord` | 3 | Own properties + tenants |
| `agent` | 2 | Assigned properties |
| `tenant` | 1 | Own bookings + requests |

---

## 8. Design System & Branding

### Color Palette

```css
/* MonthlyKey Brand Colors — use in all sister products */
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

### Typography

```css
/* Font stack — Arabic-first */
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');

:root {
  --font-heading: 'IBM Plex Sans Arabic', 'Inter', sans-serif;
  --font-body: 'IBM Plex Sans Arabic', 'Inter', sans-serif;
}
```

### Component Patterns

```tsx
// Primary Button
<Button className="bg-[#3ECFC0] text-[#0B1E2D] hover:bg-[#2ab5a6] border-0 font-semibold">
  {label}
</Button>

// Card Pattern
<Card className="border-[#1E3A4F] bg-[#132D3F]">
  <CardContent className="p-6">
    {/* content */}
  </CardContent>
</Card>

// Status Badge Pattern
<Badge className="bg-green-100 text-green-800">Active</Badge>
<Badge className="bg-red-100 text-red-800">Urgent</Badge>

// Loading State
<Loader2 className="h-8 w-8 animate-spin text-[#3ECFC0]" />
```

### i18n Pattern

```tsx
import { useI18n } from "@/lib/i18n";

function MyComponent() {
  const { t, lang, dir } = useI18n();
  
  return (
    <div dir={dir}>
      <h1>{lang === "ar" ? "عنوان بالعربي" : "English Title"}</h1>
      <p>{t("common.submit")}</p>
    </div>
  );
}
```

---

## 9. Deployment & DevOps

### Railway Configuration Template

```toml
# railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "node dist/index.js"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[[deploy.volumes]]
mountPath = "/app/uploads"
name = "uploads-volume"
```

### Dockerfile Template

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

RUN mkdir -p /app/uploads && chmod 777 /app/uploads
ENV UPLOAD_DIR=/app/uploads
ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Required Environment Variables

```bash
# Core
NODE_ENV=production
PORT=3000
JWT_SECRET={{SAME_AS_MONTHLYKEY}}
DATABASE_URL=mysql://user:pass@host:3306/{{DB_NAME}}

# MonthlyKey Integration
HUB_API_URL=https://{{HUB_API_DOMAIN}}/api/v1
HUB_API_KEY={{GENERATED_API_KEY}}

# Optional: Beds24
BEDS24_REFRESH_TOKEN={{IF_NEEDED}}
ENABLE_BEDS24=true

# Optional: Email
SMTP_HOST={{SMTP_HOST}}
SMTP_PORT=587
SMTP_USER={{SMTP_USER}}
SMTP_PASS={{SMTP_PASS}}
EMAIL_FROM={{FROM_EMAIL}}

# File Storage
UPLOAD_DIR=/app/uploads
PUBLIC_URL=https://{{PRODUCT_DOMAIN}}
```

---

## 10. DO NOT BREAK Guardrails

Include these guardrails in every sister-product prompt to protect the MonthlyKey ecosystem:

```markdown
### Critical Guardrails — NEVER violate these:

1. **NEVER modify MonthlyKey's database tables directly.**
   Use Hub API or create your own tables with a product prefix.

2. **NEVER change the JWT secret or token format.**
   Sister products MUST accept MonthlyKey-issued tokens as-is.

3. **NEVER expose MonthlyKey internal APIs publicly.**
   All cross-product communication goes through the Hub API.

4. **NEVER store passwords in plaintext.**
   Use bcrypt with cost factor ≥ 12 (matching MonthlyKey).

5. **NEVER disable CORS or CSP headers.**
   Follow the same security header pattern as MonthlyKey.

6. **NEVER use synchronous file I/O in request handlers.**
   Use async/await for all file operations.

7. **NEVER return stack traces in production error responses.**
   Log internally, return generic error messages to clients.

8. **NEVER hardcode the MonthlyKey domain or API URLs.**
   Always use environment variables.

9. **ALWAYS validate webhook signatures** before processing events.

10. **ALWAYS include rate limiting** on public-facing endpoints.
```

---

## 11. Example: Cleaning Service Product

Here is a complete example of how to use this template for a hypothetical "MK Clean" sister product:

```markdown
# Project: MK Clean

## Overview
Build a production-ready web application for **MK Clean** — a professional
cleaning service marketplace for MonthlyKey properties. Tenants can book
cleaning services, landlords can manage cleaning schedules, and cleaning
providers can accept and fulfill orders.

## Core Features
1. Cleaning service catalog (deep clean, regular, move-in/move-out)
2. Booking flow with date/time selection
3. Provider dashboard (accept orders, update status, upload photos)
4. Tenant dashboard (book, track, rate services)
5. Landlord dashboard (schedule recurring cleans, view history)
6. Admin panel (manage providers, pricing, analytics)
7. Push notifications for order updates
8. Integration with MonthlyKey bookings (auto-suggest cleaning on checkout)

## Database Tables
- `clean_providers` — Cleaning service providers
- `clean_services` — Service types and pricing
- `clean_orders` — Booking orders
- `clean_order_items` — Line items per order
- `clean_reviews` — Provider reviews
- `clean_schedules` — Recurring cleaning schedules

## Integration Endpoints
- Subscribe to `tenant.checkout` webhook → auto-suggest cleaning
- Subscribe to `booking.approved` webhook → offer move-in cleaning
- Call Hub API `/properties/:id` → get property size for pricing
- Call Hub API `/bookings/:id` → verify active booking for tenant

## User Roles
- Tenant: book cleaning, track orders, rate providers
- Landlord: schedule recurring cleans, view property cleaning history
- Provider: accept orders, update status, upload completion photos
- Admin: manage everything, set pricing, view analytics
```

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-25 | Manus AI | Initial template |

---

*This template is maintained in the MonthlyKey repository at `docs/SISTER_PRODUCT_PROMPT_TEMPLATE.md`. Update it whenever the MonthlyKey architecture, API contracts, or conventions change.*
