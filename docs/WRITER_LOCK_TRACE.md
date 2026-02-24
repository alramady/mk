# Writer Lock — Code Location Trace

> This document maps every enforcement point in the dual-mode writer lock system.
> **Invariant:** Exactly ONE writer per brand at any time. Never zero, never two.

---

## 1. Shared Foundation (both sides import these)

### `isWriterAllowed(mode, caller)` — The core predicate

| Attribute | Value |
|-----------|-------|
| **File** | `packages/shared/src/constants.ts` |
| **Line** | 53–58 |
| **Signature** | `isWriterAllowed(mode: "standalone" \| "integrated", caller: "adapter" \| "hub-api"): boolean` |
| **Logic** | Returns `true` if `WRITER_LOCK[mode].writer === caller` |

### `getDesignatedWriter(mode)` — Returns who SHOULD write

| Attribute | Value |
|-----------|-------|
| **File** | `packages/shared/src/constants.ts` |
| **Line** | 43–45 |
| **Returns** | `"adapter"` for standalone, `"hub-api"` for integrated |

### `WRITER_LOCK` constant — The truth table

| Attribute | Value |
|-----------|-------|
| **File** | `packages/shared/src/constants.ts` |
| **Line** | 27–36 |
| **Structure** | `{ standalone: { writer: "adapter", rejector: "hub-api" }, integrated: { writer: "hub-api", rejector: "adapter" } }` |

---

## 2. Adapter Side — CoBnB

### Mode resolution (startup)

| Attribute | Value |
|-----------|-------|
| **File** | `services/cobnb-adapter-api/src/index.ts` |
| **Line** | 41 |
| **Code** | `const MODE = (process.env.MODE_COBNB ?? "standalone") as OperationMode;` |

### Writer-lock check (startup constant)

| Attribute | Value |
|-----------|-------|
| **File** | `services/cobnb-adapter-api/src/index.ts` |
| **Line** | 55 |
| **Code** | `const ADAPTER_IS_WRITER = isWriterAllowed(MODE, "adapter");` |

### Route guard — `POST /api/v1/bookings`

| Attribute | Value |
|-----------|-------|
| **File** | `services/cobnb-adapter-api/src/index.ts` |
| **Line** | 268–272 |
| **Code** | `if (!ADAPTER_IS_WRITER) { return writerLockReject(res); }` |
| **Effect** | Returns HTTP 409 with `WriterLockError` body when `MODE_COBNB=integrated` |

### `writerLockReject()` helper

| Attribute | Value |
|-----------|-------|
| **File** | `services/cobnb-adapter-api/src/index.ts` |
| **Line** | 127–141 |
| **Returns** | `{ code: "WRITER_LOCK_VIOLATION", message, brand, mode, designatedWriter, rejectedBy: "adapter" }` |

---

## 3. Adapter Side — MonthlyKey

### Mode resolution (startup)

| Attribute | Value |
|-----------|-------|
| **File** | `services/monthlykey-adapter-api/src/index.ts` |
| **Line** | 38 |
| **Code** | `const MODE = (process.env.MODE_MONTHLYKEY ?? "standalone") as OperationMode;` |

### Writer-lock check (startup constant)

| Attribute | Value |
|-----------|-------|
| **File** | `services/monthlykey-adapter-api/src/index.ts` |
| **Line** | 52 |
| **Code** | `const ADAPTER_IS_WRITER = isWriterAllowed(MODE, "adapter");` |

### Route guard — `POST /api/v1/bookings`

| Attribute | Value |
|-----------|-------|
| **File** | `services/monthlykey-adapter-api/src/index.ts` |
| **Line** | 266–270 |
| **Code** | `if (!ADAPTER_IS_WRITER) { return writerLockReject(res); }` |
| **Effect** | Returns HTTP 409 with `WriterLockError` body when `MODE_MONTHLYKEY=integrated` |

---

## 4. Hub-API Side

### `hubShouldRejectWrites(brand)` — Hub's rejection predicate

| Attribute | Value |
|-----------|-------|
| **File** | `services/hub-api/src/config.ts` |
| **Line** | 88–90 |
| **Code** | `return !hubIsWriter(brand);` |
| **Logic** | Returns `true` when brand is in standalone mode (adapter is the writer) |

### `hubIsWriter(brand)` — Hub's writer check

| Attribute | Value |
|-----------|-------|
| **File** | `services/hub-api/src/config.ts` |
| **Line** | 82–85 |
| **Code** | `return isWriterAllowed(mode, "hub-api");` |

### `getBrandMode(brand)` — Resolves env var to mode

| Attribute | Value |
|-----------|-------|
| **File** | `services/hub-api/src/config.ts` |
| **Line** | 77–79 |
| **Code** | `return brand === "COBNB" ? config.modes.cobnb : config.modes.monthlykey;` |

### Service-level enforcement — `BookingService.create()`

| Attribute | Value |
|-----------|-------|
| **File** | `services/hub-api/src/services/booking-service.ts` |
| **Line** | 91–110 |
| **Code** | `if (hubShouldRejectWrites(brand)) { throw new WriterLockViolation(error); }` |
| **Effect** | Throws `WriterLockViolation` with full context when brand is standalone |

### Route-level catch — `POST /bookings`

| Attribute | Value |
|-----------|-------|
| **File** | `services/hub-api/src/routes/bookings.ts` |
| **Line** | 81–83 |
| **Code** | `if (err instanceof WriterLockViolation) { return res.status(err.statusCode).json(err.body); }` |
| **Effect** | Catches `WriterLockViolation` from service and returns HTTP 409 |

### `WriterLockViolation` error class

| Attribute | Value |
|-----------|-------|
| **File** | `services/hub-api/src/services/booking-service.ts` |
| **Line** | 297–305 |
| **Properties** | `statusCode = 409`, `body: WriterLockError` |

---

## 5. Truth Table

| MODE_COBNB | Adapter `POST /bookings` | Hub `POST /bookings` (brand=COBNB) |
|---|---|---|
| `standalone` | ✅ Writes to Beds24 directly | ❌ 409 `WRITER_LOCK_VIOLATION` |
| `integrated` | ❌ 409 `WRITER_LOCK_VIOLATION` | ✅ Writes to local DB + Beds24 |

| MODE_MONTHLYKEY | Adapter `POST /bookings` | Hub `POST /bookings` (brand=MONTHLYKEY) |
|---|---|---|
| `standalone` | ✅ Writes to Beds24 directly | ❌ 409 `WRITER_LOCK_VIOLATION` |
| `integrated` | ❌ 409 `WRITER_LOCK_VIOLATION` | ✅ Writes to local DB + Beds24 |

---

## 6. Additional Guards on the Write Path

Both adapter and hub-api enforce these BEFORE writing:

| Guard | HTTP Status | Error Code | Location (adapter) | Location (hub-api) |
|-------|-------------|------------|--------------------|--------------------|
| Idempotency-Key required | 400 | `IDEMPOTENCY_KEY_REQUIRED` | Line 284–289 | Line 57–62 (route) + Line 121–127 (service) |
| Idempotency-Key reused with different body | 422 | `IDEMPOTENCY_KEY_REUSED` | Line 296–299 | Line 137–142 (service) |
| Brand night-limit violation | 400 | `BRAND_RULE_VIOLATION` | Line 314–319 | Line 228–237 (service) |
| Availability re-check failed | 409 | `AVAILABILITY_CHANGED` | Line 324–329 | Line 150–157 (service) |
