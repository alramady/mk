# MK Platform — Architecture Overview

> Multi-brand property management platform built as a pnpm monorepo alongside the existing MonthlyKey application.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MK Repository                           │
│                                                             │
│  ┌──────────────────────────────────────────────┐           │
│  │  Existing MonthlyKey App (root)              │  Railway  │
│  │  client/ + server/ + drizzle/ (MySQL)        │  ◄─ LIVE  │
│  └──────────────────────────────────────────────┘           │
│                                                             │
│  ┌──────────────────────────────────────────────┐           │
│  │  Platform Layer (new)                        │           │
│  │                                              │           │
│  │  packages/                                   │           │
│  │  ├── shared/      (types, validators)        │           │
│  │  └── beds24-sdk/  (API V2 SDK)               │           │
│  │                                              │           │
│  │  services/                                   │           │
│  │  ├── hub-api/     (central API, Postgres)    │           │
│  │  ├── cobnb-adapter-api/                      │           │
│  │  ├── monthlykey-adapter-api/                 │           │
│  │  └── worker/      (BullMQ consumer)          │           │
│  │                                              │           │
│  │  apps/                                       │           │
│  │  ├── ops-web/     (cleaning & maintenance)   │           │
│  │  ├── cobnb-web/   (COBNB storefront)         │           │
│  │  └── monthlykey-web/ (MK storefront v2)      │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## Key Principles

1. **Additive only** — No existing files from `main` are modified
2. **Feature-flag everything** — All integrations start OFF
3. **Independent deployment** — Each service has its own Dockerfile
4. **Shared history** — Branch is merge-friendly with `main`
5. **Gradual migration** — Move to platform services one feature at a time

## Getting Started

```bash
# Clone and switch to platform branch
git clone https://github.com/raneemndmo-collab/mk.git
cd mk
git checkout platform/monorepo

# Install dependencies
pnpm install

# Start infrastructure
docker compose up -d postgres redis

# Start hub-api
pnpm --filter @mk/hub-api dev

# Start ops portal
pnpm --filter @mk/ops-web dev
```

## Documentation

- [Migration Plan](./MIGRATION_PLAN.md) — Step-by-step integration guide
- [Writer Lock Trace](./WRITER_LOCK_TRACE.md) — Exact code locations for writer-lock enforcement
- [Hub API OpenAPI Spec](../services/hub-api/openapi.yaml) — API documentation
- [Environment Variables](../.env.platform.example) — All configuration options

---

## Platform Modes and Feature Flags

### Operation Modes

Each brand has an independent operation mode that controls **who writes bookings to Beds24**.

| Env Var | Values | Default | Effect |
|---------|--------|---------|--------|
| `MODE_COBNB` | `standalone` \| `integrated` | `standalone` | Controls CoBnB booking writer |
| `MODE_MONTHLYKEY` | `standalone` \| `integrated` | `standalone` | Controls MonthlyKey booking writer |
| `MODE_OPS` | `standalone` \| `integrated` | `standalone` | Controls Ops portal mode |

### Writer Lock — The Core Invariant

> **Exactly ONE writer per brand at any time. Never zero, never two.**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WRITER LOCK TRUTH TABLE                          │
├──────────────────┬───────────────────┬──────────────────────────────┤
│ Mode             │ Adapter            │ Hub-API                      │
├──────────────────┼───────────────────┼──────────────────────────────┤
│ standalone       │ ✅ Writes to Beds24 │ ❌ 409 WRITER_LOCK_VIOLATION │
│ integrated       │ ❌ 409 WRITER_LOCK  │ ✅ Writes to DB + Beds24     │
└──────────────────┴───────────────────┴──────────────────────────────┘
```

**Enforcement points (both sides check independently):**

| Side | Function | File | Line |
|------|----------|------|------|
| Shared | `isWriterAllowed(mode, caller)` | `packages/shared/src/constants.ts` | 53 |
| Shared | `getDesignatedWriter(mode)` | `packages/shared/src/constants.ts` | 43 |
| Adapter | `ADAPTER_IS_WRITER` startup check | `services/*/src/index.ts` | 55 (COBNB), 52 (MK) |
| Adapter | Route guard `if (!ADAPTER_IS_WRITER)` | `services/*/src/index.ts` | 270 |
| Hub-API | `hubShouldRejectWrites(brand)` | `services/hub-api/src/config.ts` | 88 |
| Hub-API | Service guard in `BookingService.create()` | `services/hub-api/src/services/booking-service.ts` | 94 |
| Hub-API | Route catch `WriterLockViolation` | `services/hub-api/src/routes/bookings.ts` | 81 |

**Standalone mode (default, safest):**
- Each adapter calls Beds24 directly via `@mk/beds24-sdk`
- No dependency on hub-api for booking writes
- Hub-api rejects writes for that brand with HTTP 409
- Ideal for: independent operation, initial deployment, testing

**Integrated mode:**
- Hub-api is the single writer for that brand
- Adapter rejects booking writes with HTTP 409
- Frontend calls hub-api directly for booking creation
- Ideal for: centralized management, cross-brand coordination

### Feature Flags

All flags default to `false` (OFF) for maximum safety.

| Env Var | Default | Effect When OFF | Effect When ON |
|---------|---------|-----------------|----------------|
| `ENABLE_BEDS24` | `false` | Beds24 SDK not initialized in hub-api | Hub-api can push bookings to Beds24 |
| `ENABLE_BEDS24_WEBHOOKS` | `false` | Webhook endpoint returns `204 No Content` (silent accept) | Webhook events are deduplicated, stored in `webhook_events` table, and queued for processing. Returns `200 OK`. |
| `ENABLE_BEDS24_PROXY` | `false` | Admin proxy endpoint returns `403 Forbidden` | ADMIN-only proxy to Beds24 API with: endpoint allowlist, rate limiting (30 req/min), audit log with PII redaction |
| `ENABLE_AUTOMATED_TICKETS` | `false` | No auto-ticket creation | Worker creates cleaning tickets on booking checkout |
| `ENABLE_PAYMENTS` | `false` | Payment endpoints disabled | Moyasar payment processing active |
| `ENABLE_BANK_TRANSFER` | `false` | Bank transfer option hidden | Bank transfer payment method available |

### Booking Write Guards

Every booking write (adapter standalone or hub-api integrated) enforces these guards **in order**:

| # | Guard | HTTP Status | Error Code |
|---|-------|-------------|------------|
| 1 | Writer lock check | 409 | `WRITER_LOCK_VIOLATION` |
| 2 | `Idempotency-Key` header required (min 8 chars) | 400 | `IDEMPOTENCY_KEY_REQUIRED` |
| 3 | Idempotency dedup (same key, different body) | 422 | `IDEMPOTENCY_KEY_REUSED` |
| 4 | Brand night-limit validation | 400 | `BRAND_RULE_VIOLATION` |
| 5 | Availability re-check immediately before write | 409 | `AVAILABILITY_CHANGED` |
| 6 | Write to Beds24 / local DB | 201 | — |
| 7 | Cache idempotency response | — | — |

### Webhook Processing Pipeline

```
Beds24 → POST /api/v1/webhooks/beds24
  │
  ├─ ENABLE_BEDS24_WEBHOOKS=false → 204 (silent accept, no processing)
  │
  └─ ENABLE_BEDS24_WEBHOOKS=true
       │
       ├─ Dedup check (webhook_events.event_id)
       │   └─ Duplicate → 200 + {"status": "duplicate"}
       │
       └─ New event
            ├─ Insert into webhook_events (status=PENDING)
            ├─ Queue for processing (BullMQ)
            └─ Return 200 immediately

Worker picks up job:
  ├─ Success → status=COMPLETED
  └─ Failure → status=FAILED, schedule retry
       ├─ Exponential backoff: 30s, 2m, 8m, 32m, 2h
       └─ After 5 attempts → status=DEAD_LETTER

Retry Poller (every 30s):
  └─ SELECT FROM webhook_events WHERE status=FAILED AND next_retry_at <= NOW()
       └─ Re-enqueue for processing
```

### Beds24 Admin Proxy — Security Layers

The admin proxy is disabled by default (`ENABLE_BEDS24_PROXY=false`).
When enabled, it enforces **5 security layers**:

| Layer | Enforcement | Location |
|-------|-------------|----------|
| 1. Feature flag | `ENABLE_BEDS24_PROXY` must be `true` | Hub-API admin route |
| 2. Role check | User must have `ADMIN` role | Hub-API auth middleware |
| 3. Rate limit | Max 30 requests/minute per user | Hub-API admin route |
| 4. Endpoint allowlist | Only `/api/v2/properties`, `/bookings`, `/rooms`, `/inventory`, `/guests`, `/channels`, `/reports` | Hub-API admin route (from `ADMIN_PROXY_ALLOWLIST`) |
| 5. Hard blocklist | `/api/v2/authentication`, `/account`, `/billing`, `/users` always blocked | SDK proxy layer (defense in depth) |

All proxy requests are logged to an audit trail with **deep PII redaction**:
- Redacted fields: email, phone, name, address, ID numbers, payment info
- Matching is case-insensitive and recursive (nested objects, arrays)
- Both request body and response body are redacted in the audit log

### Automated Tests

The writer-lock invariant is proven by 33 automated tests:

```bash
# Run writer-lock tests
npx vitest run tests/writer-lock.test.ts
```

Test coverage:
- `isWriterAllowed()` — 4 tests (all mode×caller combinations)
- Adapter-side lock (CoBnB) — 2 tests (standalone=201, integrated=409)
- Adapter-side lock (MonthlyKey) — 2 tests (standalone=201, integrated=409)
- Hub-API side lock (CoBnB) — 2 tests (standalone=409, integrated=201)
- Hub-API side lock (MonthlyKey) — 2 tests (standalone=409, integrated=201)
- XOR invariant — 4 tests (exactly one writer per brand×mode)
- Full matrix — 4 tests (both sides correct per combination)
- Response shape — 3 tests (all required fields present)
- Brand rules — 3 tests (night ranges, no gap, no overlap)
- HTTP status codes — 3 tests (409, 201, 400)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Packages | TypeScript, Zod |
| Hub API | Express, Drizzle ORM, Postgres, BullMQ |
| Web Apps | React 18, Vite, Tailwind CSS, React Router |
| Infrastructure | Docker, Redis, Postgres |
| SDK | Beds24 API V2, Axios |
