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

In standalone mode, the adapter is a **fully independent service** with zero hub-api dependency for core operations. The adapter reads AND writes to Beds24 directly using `@mk/beds24-sdk`.

```
┌──────────────┐     reads + writes     ┌──────────────┐
│   Adapter    │ ◄──────────────────────► │   Beds24     │
│  (writer)    │     @mk/beds24-sdk      │   API V2     │
└──────────────┘                         └──────────────┘
        ▲
        │  serves frontend directly
        │  (units, availability, quotes, bookings)
        ▼
┌──────────────┐
│   Frontend   │
└──────────────┘

┌──────────────┐
│   Hub-API    │  ❌ REJECTS booking writes for this brand (409)
└──────────────┘  ❌ Has NO Beds24 write authority for this brand
```

The adapter handles all operations for its brand:

| Operation | Source | Target |
|-----------|--------|--------|
| List units | Adapter → Beds24 | `GET /api/v2/properties` |
| Check availability | Adapter → Beds24 | `GET /api/v2/inventory` |
| Get quote | Adapter → Beds24 | `GET /api/v2/inventory` (calendar) |
| Create booking | Adapter → Beds24 | `POST /api/v2/bookings` |
| Read bookings | Adapter → Beds24 | `GET /api/v2/bookings` |
| Auth (login/register) | Adapter → Hub-API | Proxied to hub-api |

Hub-api is only used for shared concerns (auth, user management). All Beds24 data flows are adapter-direct.

**Integrated mode:**

In integrated mode, hub-api is the **single writer** for the brand. The adapter rejects booking writes with 409 and may proxy **reads** to hub-api (or to Beds24 directly for read-only operations). The frontend calls hub-api directly for booking creation.

```
┌──────────────┐     reads only          ┌──────────────┐
│   Adapter    │ ─────────────────────── │   Hub-API    │
│  (read proxy)│     proxy reads         │  (writer)    │
└──────────────┘                         └──────┬───────┘
        ▲                                       │
        │  serves reads                         │ reads + writes
        ▼                                       ▼
┌──────────────┐                         ┌──────────────┐
│   Frontend   │ ── booking writes ────► │   Beds24     │
│              │    (via hub-api)         │   API V2     │
└──────────────┘                         └──────────────┘
```

### Brand Rules — Night Limits

Each brand has hard-coded night-limit rules enforced on **every booking write** (both adapter and hub-api). These rules ensure brand segmentation: CoBnB handles short-stay and MonthlyKey handles long-stay.

| Brand | Min Nights | Max Nights | Label (EN) | Label (AR) |
|-------|-----------|-----------|------------|------------|
| CoBnB | 1 | 27 | CoBnB KSA | كو بي إن بي |
| MonthlyKey | 28 | 365 | Monthly Key | المفتاح الشهري |

The rules are defined in `packages/shared/src/constants.ts` as `BRAND_RULES` and are imported by both adapters and hub-api. There is **no gap and no overlap** between the two brands: night 27 is CoBnB's maximum and night 28 is MonthlyKey's minimum.

If a booking request violates the brand's night limits, the response is:

```json
{
  "code": "BRAND_RULE_VIOLATION",
  "message": "COBNB requires 1-27 nights, got 30"
}
```

HTTP status: `400 Bad Request`.

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

### Webhook Authenticity Verification

> **Important:** Beds24 does **NOT** sign webhooks with HMAC. Their V2 booking and inventory webhooks are plain POST requests with a JSON body. There is no `x-beds24-signature` header or equivalent. This was confirmed by reviewing all Beds24 API V2 documentation, the Swagger spec, and the wiki.

Webhook requests from Beds24 are verified using a **two-layer authenticity check** before any processing occurs.

#### Layer 1 — Static Shared Secret Header (PRIMARY)

This is the **primary authentication layer**. Beds24 supports adding a "Custom Header" to webhook requests in their dashboard. You set a header name and value in Beds24, and Beds24 includes it verbatim in every webhook POST. Our server performs a constant-time string comparison against the expected value.

This is **not HMAC** — Beds24 does not compute signatures. It simply forwards the header as-is. We use constant-time comparison to prevent timing attacks.

**Setup in Beds24 Dashboard — Booking Webhooks:**

| Step | Action |
|------|--------|
| 1 | Log in to Beds24 → **Settings** → **Account** → **Booking Webhooks** |
| 2 | Set **URL** to `https://your-hub-api.example.com/api/v1/webhooks/beds24` |
| 3 | Under **Custom Headers**, add a new header: |
| | **Header Name:** `X-Webhook-Secret` |
| | **Header Value:** A strong random string, e.g. `mk-wh-2026-a7b3c9d1e5f2` |
| 4 | Set **Events** to the booking events you want to receive (e.g., `new`, `modify`, `cancel`) |
| 5 | Click **Save** |

**Setup in Beds24 Dashboard — Inventory Webhooks:**

| Step | Action |
|------|--------|
| 1 | Log in to Beds24 → **Settings** → **Account** → **Inventory Webhooks** |
| 2 | Set **URL** to `https://your-hub-api.example.com/api/v1/webhooks/beds24` |
| 3 | Under **Custom Headers**, add a new header: |
| | **Header Name:** `X-Webhook-Secret` (same name as booking webhooks) |
| | **Header Value:** Same secret value as booking webhooks: `mk-wh-2026-a7b3c9d1e5f2` |
| 4 | Set **Events** to the inventory events you want to receive |
| 5 | Click **Save** |

**Matching `.env` configuration:**

```bash
# PRIMARY: Static shared secret (must match Custom Header value in Beds24 dashboard)
BEDS24_WEBHOOK_SECRET=mk-wh-2026-a7b3c9d1e5f2
BEDS24_WEBHOOK_SECRET_HEADER=x-webhook-secret   # must match the Custom Header name (lowercase)
```

If the header is missing or the value does not match, the request is rejected with `401 Unauthorized` and `WEBHOOK_INVALID_SIGNATURE` error code. When `BEDS24_WEBHOOK_SECRET` is empty (default), this check is skipped.

#### Layer 2 — IP Allowlist (OPTIONAL, defense in depth)

Beds24 server IPs may change without notice, so this layer is **optional**. When configured, it provides defense-in-depth alongside the shared secret. If `BEDS24_WEBHOOK_IP_ALLOWLIST` is populated in `.env`, only requests from those source IPs are accepted. The check uses `x-forwarded-for` (first entry) or `socket.remoteAddress` as fallback.

```bash
# OPTIONAL: IP allowlist (get IPs from Beds24 support or observe X-Forwarded-For)
# Comma-separated. Empty = IP check disabled.
BEDS24_WEBHOOK_IP_ALLOWLIST=52.58.0.0,52.58.0.1
```

The IP check supports both exact matches and simplified CIDR prefix matching (e.g., `52.58.0.0/16` matches any IP starting with `52.58.`). When the allowlist is empty (default), IP checking is disabled.

#### Verification Order

```
Request arrives → Feature flag check (204 if off)
  → Layer 1: Shared secret header check (401 if mismatch) — PRIMARY
    → Layer 2: IP allowlist check (403 if blocked) — OPTIONAL
      → Schema validation (400 if malformed)
        → Dedup check → Queue for processing → 200
```

#### Secret Handling Guarantees

The webhook secret value is **never logged, stored in audit logs, or exposed in any endpoint**:

| Concern | Guarantee |
|---------|-----------|
| Log messages | Only indicate "mismatch" or "missing" — the secret value is never included |
| `/webhooks/status` endpoint | Shows only `configured: true/false` (boolean) — never the value |
| Audit logs | Do not store any HTTP header values — only event metadata |
| Error responses | Say "Invalid or missing webhook secret" — never echo the expected or received value |
| Morgan access logs | Use `short` format which does not include request headers |

#### Configuration Summary

```bash
# PRIMARY: Static shared secret (set matching Custom Header in Beds24 dashboard)
BEDS24_WEBHOOK_SECRET=your-random-secret
BEDS24_WEBHOOK_SECRET_HEADER=x-webhook-secret

# OPTIONAL: IP allowlist (Beds24 IPs may change — use as defense-in-depth)
BEDS24_WEBHOOK_IP_ALLOWLIST=52.58.0.0,52.58.0.1
```

Both layers are independent: you can use shared secret only, IP only, or both together. For production, we recommend **at minimum** the shared secret header.

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

### Payments-Off Behavior

When `ENABLE_PAYMENTS=false` (the default), the platform **blocks booking creation** rather than allowing unpaid bookings.

**Decision: BLOCK with `503 Service Unavailable`**

The alternative (allowing unpaid bookings) was rejected because it creates reconciliation debt, potential fraud vectors, and inconsistent booking states. Blocking is the safer default.

When payments are disabled, `POST /api/v1/bookings` returns:

```json
{
  "code": "PAYMENTS_DISABLED",
  "message": "Booking creation is temporarily unavailable: payment processing is not enabled. Contact support.",
  "retryable": true
}
```

HTTP status: `503 Service Unavailable` with `retryable: true` so clients know to retry later.

This guard is enforced at the **route level** in hub-api (`services/hub-api/src/routes/bookings.ts`) before any other booking write guards. It is the first check in the chain:

```
Payments check (503) → Writer lock (409) → Idempotency (400/422) → Brand rules (400) → Availability (409) → Write (201)
```

In standalone adapter mode, the adapter does not enforce this guard because the adapter may have its own payment integration. The guard only applies to hub-api integrated mode booking writes.

**Read operations are unaffected** — quotes, availability checks, and booking reads work regardless of the payments flag.

### Observability Endpoints — /health, /ready, /metrics

Every service exposes three standard observability endpoints at the root level (not under `/api/v1/`):

| Endpoint | Purpose | Status Codes | Auth Required |
|----------|---------|-------------|---------------|
| `GET /health` | **Liveness** — Is the process alive? | Always `200` | No |
| `GET /ready` | **Readiness** — Are dependencies reachable? | `200` (ready) or `503` (not ready) | No |
| `GET /metrics` | **Metrics** — Operational counters and memory | Always `200` | No |

**`/health` (liveness probe)**

Returns `200` as long as the process is running. Used by container orchestrators (Docker, K8s) to detect crashed processes.

```json
{
  "status": "ok",
  "service": "hub-api",
  "version": "1.0.0",
  "modes": { "cobnb": "standalone", "monthlykey": "standalone", "ops": "standalone" },
  "features": { "beds24": false, "beds24Webhooks": false, ... },
  "uptime": 3600.5,
  "timestamp": "2026-02-25T12:00:00.000Z"
}
```

**`/ready` (readiness probe)**

Checks that all required dependencies are reachable. Returns `503` if any check fails. Used by load balancers to remove unhealthy instances from rotation.

| Service | Standalone Checks | Integrated Checks |
|---------|-------------------|--------------------|
| Hub-API | Database (Postgres) | Database + Redis (if webhooks on) + Beds24 token |
| Adapter | Beds24 SDK initialized | Hub-API `/health` reachable |

```json
{
  "ready": true,
  "service": "cobnb-adapter-api",
  "mode": "standalone",
  "checks": { "beds24Sdk": true },
  "timestamp": "2026-02-25T12:00:00.000Z"
}
```

**`/metrics` (operational counters)**

Returns basic process metrics for monitoring dashboards. Not a Prometheus exporter (yet), but structured JSON that can be scraped.

```json
{
  "service": "hub-api",
  "uptime_seconds": 3600,
  "memory": { "rss_mb": 85, "heap_used_mb": 42, "heap_total_mb": 64 },
  "modes": { ... },
  "features": { ... },
  "node_version": "v22.13.0",
  "timestamp": "2026-02-25T12:00:00.000Z"
}
```

**Docker / K8s configuration example:**

```yaml
# docker-compose.yml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
  interval: 30s
  timeout: 5s
  retries: 3

# kubernetes deployment
livenessProbe:
  httpGet:
    path: /health
    port: 4000
  initialDelaySeconds: 10
  periodSeconds: 30
readinessProbe:
  httpGet:
    path: /ready
    port: 4000
  initialDelaySeconds: 5
  periodSeconds: 10
```

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
