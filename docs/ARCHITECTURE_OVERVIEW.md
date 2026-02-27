# Monthly Key — Architecture Overview

**Document Version:** 1.0
**Date:** February 25, 2026
**Author:** Manus AI

---

## 1. System Architecture

Monthly Key is a **multi-channel rental marketplace** built as a monorepo with a layered architecture. The system consists of a consumer-facing web application, a central hub API for multi-channel orchestration, channel-specific adapter APIs, a background worker, and external integrations.

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Monthly Key   │  │   CoBnB      │  │  Ops Web     │          │
│  │ Main SPA      │  │   Web App    │  │  Dashboard   │          │
│  │ (React 19)    │  │  (React 19)  │  │  (React 19)  │          │
│  │ client/src/   │  │ apps/cobnb/  │  │ apps/ops/    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
│         └──────────────────┼──────────────────┘                  │
│                            │ HTTPS                               │
└────────────────────────────┼────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                     SERVER LAYER                                 │
│                            │                                     │
│  ┌─────────────────────────┴─────────────────────────┐          │
│  │           Main Application Server                  │          │
│  │     Express + tRPC + Vite SSR (Port 3000)         │          │
│  │                                                    │          │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │          │
│  │  │  Auth    │ │  tRPC    │ │  Middleware       │  │          │
│  │  │  Routes  │ │  Router  │ │  (Security, CSP,  │  │          │
│  │  │          │ │          │ │   Compression,    │  │          │
│  │  │          │ │          │ │   Prerender)      │  │          │
│  │  └──────────┘ └──────────┘ └──────────────────┘  │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
│  ┌───────────────────────────────────────────────────┐          │
│  │              Microservices                         │          │
│  │                                                    │          │
│  │  ┌─────────────┐  ┌──────────────────────────┐   │          │
│  │  │  Hub API     │  │  Channel Adapters        │   │          │
│  │  │  (Port 4000) │  │                          │   │          │
│  │  │  PostgreSQL  │  │  ┌─────────────────────┐ │   │          │
│  │  │  Booking     │  │  │ MonthlyKey Adapter  │ │   │          │
│  │  │  Orchestrator│  │  │ CoBnB Adapter       │ │   │          │
│  │  └─────────────┘  │  └─────────────────────┘ │   │          │
│  │                    └──────────────────────────┘   │          │
│  │  ┌─────────────┐                                  │          │
│  │  │  Worker      │  Background job processing      │          │
│  │  └─────────────┘                                  │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                     DATA LAYER                                   │
│                            │                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   MySQL       │  │  PostgreSQL  │  │   Redis      │          │
│  │  (TiDB Cloud) │  │  (Hub API)   │  │  (Cache)     │          │
│  │  30 tables    │  │  14 tables   │  │  Optional    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                  EXTERNAL SERVICES                               │
│                            │                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Beds24     │  │   PayPal     │  │  AWS S3      │          │
│  │   PMS API    │  │   Payments   │  │  File Storage│          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Google Maps  │  │  Nodemailer  │  │  Web Push    │          │
│  │  (via Proxy)  │  │  (Email)     │  │  (Notifs)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Descriptions

**Main Application Server** (`server/` + `client/`): The monolithic Express application that serves the primary Monthly Key website. It handles authentication, tRPC API routes, static file serving, and SSR prerendering. In development, Vite provides HMR; in production, pre-built static files are served. This is the only service deployed to Railway with a public domain.

**Hub API** (`services/hub-api/`): A standalone Express API that acts as the central orchestrator for multi-channel booking management. It maintains its own PostgreSQL database and coordinates data flow between the main application, channel adapters, and Beds24. It implements OTP-based authentication, feature flags, and idempotent booking operations.

**Channel Adapters** (`services/cobnb-adapter-api/`, `services/monthlykey-adapter-api/`): Thin API layers that translate between the Hub API's canonical data model and channel-specific formats. Each adapter handles webhook ingestion and data transformation for its respective brand.

**Worker** (`services/worker/`): A background job processor for asynchronous operations such as scheduled syncs, email sending, and data cleanup tasks.

**Beds24 SDK** (`packages/beds24-sdk/`): A TypeScript SDK that wraps the Beds24 REST API V2. It handles token management (automatic refresh), provides typed wrappers for properties, bookings, inventory, and guests, and includes an admin proxy for secure API access from the frontend.

---

## 2. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | React | 19.2 | UI framework |
| | Tailwind CSS | 4.1 | Utility-first styling |
| | shadcn/ui + Radix | Latest | Component library |
| | Wouter | 3.3 | Client-side routing |
| | TanStack Query | 5.90 | Server state management |
| | tRPC Client | 11.6 | Type-safe API calls |
| | Leaflet | 1.9 | Map rendering |
| | Framer Motion | 12.23 | Animations |
| | Recharts | 2.15 | Data visualization |
| **Backend** | Express | 4.21 | HTTP server |
| | tRPC Server | 11.6 | Type-safe API layer |
| | Drizzle ORM | 0.44 | Database ORM |
| | jose | 6.1 | JWT handling |
| | bcryptjs | 3.0 | Password hashing |
| | sharp | 0.34 | Image processing |
| | Zod | 4.1 | Schema validation |
| **Database** | MySQL (TiDB Cloud) | 8.0 compat | Main application data |
| | PostgreSQL | 15+ | Hub API data |
| **Infrastructure** | Railway | — | Hosting & deployment |
| | AWS S3 | — | File/image storage |
| | Docker | — | Containerization |
| **Build** | Vite | 7.1 | Frontend bundler |
| | esbuild | 0.25 | Server bundler |
| | TypeScript | 5.9 | Type system |
| | pnpm | 10.15 | Package manager |

---

## 3. Data Flow Patterns

### 3.1 Booking Creation Flow

```
Tenant (Browser)
    │
    ▼
[1] POST /api/trpc/createBooking
    │
    ▼
Main Server (tRPC Router)
    │
    ├──[2] Validate input (Zod)
    ├──[3] Check availability (MySQL query)
    ├──[4] Calculate pricing
    ├──[5] Create booking record (MySQL, status: pending)
    ├──[6] Create payment record
    │
    ▼
[7] Redirect to PayPal
    │
    ▼
PayPal (External)
    │
    ▼
[8] PayPal callback → Main Server
    │
    ├──[9] Verify payment
    ├──[10] Update booking status → confirmed
    ├──[11] Push booking to Beds24 (via SDK)
    ├──[12] Send confirmation email (Nodemailer)
    └──[13] Send push notification
```

### 3.2 Beds24 Sync Flow

```
Beds24 Cloud
    │
    ▼ (Webhook POST)
Hub API (/webhooks/beds24)
    │
    ├── Verify webhook secret
    ├── Parse event type
    │
    ├── booking.new → Create/update local booking
    ├── booking.modified → Update local booking
    ├── booking.cancelled → Mark booking cancelled
    └── property.updated → Re-sync property data
         │
         ▼
    Channel Adapters
         │
         ├── MonthlyKey Adapter → Main App MySQL
         └── CoBnB Adapter → CoBnB data store
```

### 3.3 Authentication Flow

```
User (Browser)
    │
    ▼
[1] POST /api/auth/login { email, password }
    │
    ▼
Main Server (auth.ts)
    │
    ├──[2] Find user by email (MySQL)
    ├──[3] Verify password (bcrypt.compare)
    ├──[4] Generate JWT (jose.SignJWT)
    │       Claims: { userId, role, email }
    │       Expiry: 365 days (⚠️ should be 15 min)
    ├──[5] Set HTTP-only cookie
    └──[6] Return user profile
```

---

## 4. Deployment Architecture

### 4.1 Current (Railway Single Service)

The entire main application (frontend + backend) is deployed as a single Railway service using Docker. The `Dockerfile` builds both the Vite frontend and the esbuild server bundle, then runs `start.sh` which executes migrations and starts the Node.js server.

```
Railway Project: Monthly Key App
    │
    └── Service: Main App
         ├── Docker Image (multi-stage build)
         ├── Port: 3000 (auto-detected)
         ├── Volume: /app/uploads (persistent)
         ├── Health: / (should be /health)
         ├── Restart: ON_FAILURE (max 10)
         └── Domain: monthlykey.com (custom)
                     monthly-key-app-production.up.railway.app (auto)
```

### 4.2 Recommended (Multi-Service)

```
Railway Project: Monthly Key
    │
    ├── Service: Web App (main)
    │    ├── Port 3000
    │    └── Domain: monthlykey.com
    │
    ├── Service: Hub API
    │    ├── Port 4000
    │    └── Internal only
    │
    ├── Service: Worker
    │    └── No port (background)
    │
    ├── Service: Redis
    │    ├── Port 6379
    │    └── Internal only
    │
    ├── Database: MySQL (TiDB Cloud)
    │    └── External connection
    │
    └── Database: PostgreSQL
         └── Railway managed
```

---

## 5. Security Architecture

### 5.1 Authentication Layers

| Layer | Mechanism | Scope |
|-------|-----------|-------|
| Main App | JWT in HTTP-only cookie | Tenant, Landlord, Admin |
| Hub API | OTP via phone + JWT | Hub API users |
| Beds24 SDK | Refresh token → Access token | Server-to-server |
| Admin Proxy | JWT + role check | Admin-only Beds24 access |

### 5.2 Middleware Stack

The Express middleware stack is applied in the following order:

1. **Security Headers** (`server/middleware/security-headers.ts`) — CSP, HSTS, X-Frame-Options, etc.
2. **Compression** (`server/middleware/compression.ts`) — Gzip/Brotli response compression
3. **Body Parser** — JSON (50MB limit) and URL-encoded parsing
4. **Static Files** — `/uploads` directory served with 7-day cache
5. **Sitemap** — Dynamic sitemap generation at `/sitemap.xml`
6. **Auth Routes** — Login, register, change-password at `/api/auth/*`
7. **tRPC** — All API routes at `/api/trpc/*` with context injection
8. **Vite/Static** — Frontend serving (dev: Vite HMR, prod: static files)

---

## 6. Folder Convention Reference

```
mk-repo/
├── client/                    # Main SPA frontend
│   ├── public/                # Static assets (favicon, robots.txt)
│   ├── src/
│   │   ├── pages/             # Route-level page components (40 files)
│   │   ├── components/        # Reusable UI components (18 files)
│   │   │   └── ui/            # shadcn/ui primitives
│   │   ├── contexts/          # React context providers
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utility functions
│   │   ├── App.tsx            # Root component + routes
│   │   ├── main.tsx           # React entry point
│   │   └── index.css          # Global styles + Tailwind config
│   └── index.html             # HTML template
│
├── server/                    # Main backend
│   ├── _core/                 # Framework setup (Express, tRPC, auth, Vite)
│   ├── middleware/             # Express middleware (security, compression, prerender, sitemap)
│   ├── db.ts                  # Data access layer (1,750 lines)
│   ├── routers.ts             # tRPC router definitions
│   ├── security.ts            # Security utilities
│   ├── permissions.ts         # Role-based access control
│   ├── rate-limiter.ts        # Rate limiting
│   ├── cache.ts               # Caching layer (in-memory + Redis)
│   ├── storage.ts             # S3 file storage
│   ├── email.ts               # Email sending (Nodemailer)
│   ├── push.ts                # Web push notifications
│   ├── ai-assistant.ts        # AI chat assistant
│   ├── lease-contract.ts      # Lease PDF generation
│   ├── image-optimizer.ts     # Image processing (Sharp)
│   └── *.test.ts              # Test files (22 test files)
│
├── services/                  # Microservices
│   ├── hub-api/               # Central booking orchestrator
│   │   ├── src/
│   │   │   ├── db/            # PostgreSQL schema, connection, migrations
│   │   │   ├── routes/        # Express routes (admin, auth, bookings, units, webhooks)
│   │   │   ├── services/      # Business logic (booking, location, OTP, ticket)
│   │   │   ├── middleware/     # Auth middleware
│   │   │   └── lib/           # Feature flags, logger
│   │   └── Dockerfile
│   ├── cobnb-adapter-api/     # CoBnB channel adapter
│   ├── monthlykey-adapter-api/# MonthlyKey channel adapter
│   └── worker/                # Background job processor
│
├── apps/                      # Standalone frontend apps
│   ├── monthlykey-web/        # MonthlyKey standalone frontend
│   ├── cobnb-web/             # CoBnB standalone frontend
│   └── ops-web/               # Operations dashboard
│
├── packages/                  # Shared packages
│   ├── beds24-sdk/            # Beds24 API V2 SDK
│   │   └── src/
│   │       ├── auth/          # Token management
│   │       ├── wrappers/      # API endpoint wrappers
│   │       └── proxy/         # Admin proxy
│   └── shared/                # Shared types, validators, constants
│
├── drizzle/                   # Database migrations & schema
│   ├── schema.ts              # MySQL table definitions (30 tables)
│   ├── relations.ts           # Table relationships
│   └── 0000-0013/             # Migration files
│
├── tests/                     # Integration tests
├── scripts/                   # Utility scripts
├── Dockerfile                 # Production Docker image
├── railway.toml               # Railway deployment config
├── start.sh                   # Container startup script
├── vite.config.ts             # Vite build configuration
└── package.json               # Dependencies & scripts
```

---

*End of Architecture Overview*
